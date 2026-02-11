package com.issieboardng.shared

import android.content.Context
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * WordPredictionEngine - Next-word prediction engine
 * 
 * Port of ios/Shared/WordPredictionEngine.swift
 * 
 * Loads binary prediction files and provides next-word predictions based on bigram probabilities.
 * Uses hybrid storage format (dictionary indices + inline words) for space efficiency.
 * 
 * Binary format:
 * - Header: magic number (4 bytes) + entry count (4 bytes)
 * - Index: sorted array of (word_index: UInt16, offset: UInt32) pairs
 * - Data: prediction entries with probabilities and target words
 */
class WordPredictionEngine private constructor(
    private val data: ByteBuffer,
    private val entryCount: Int,
    private val trieEngine: TrieEngine?
) {
    
    companion object {
        private const val MAGIC_NUMBER = 0x50524544 // "PRED" in ASCII
        
        /**
         * Create a WordPredictionEngine by loading from assets
         * @param context Android context for asset access
         * @param filename Prediction file name (e.g., "he_predictions.bin")
         * @param trieEngine Optional TrieEngine for index-to-word conversion
         * @return WordPredictionEngine instance or null if loading fails
         */
        fun create(context: Context, filename: String, trieEngine: TrieEngine?): WordPredictionEngine? {
            val data = loadPredictionData(context, filename) ?: return null
            
            // Validate magic number
            val magic = data.getInt(0)
            if (magic != MAGIC_NUMBER) {
                debugLog("❌ WordPredictionEngine: Invalid magic number in $filename")
                return null
            }
            
            val entryCount = data.getInt(4)
            debugLog("✅ WordPredictionEngine: Loaded $filename with $entryCount entries")
            
            return WordPredictionEngine(data, entryCount, trieEngine)
        }
        
        private fun loadPredictionData(context: Context, filename: String): ByteBuffer? {
            try {
                val inputStream = context.assets.open(filename)
                val bytes = inputStream.readBytes()
                inputStream.close()
                
                val buffer = ByteBuffer.wrap(bytes)
                buffer.order(ByteOrder.LITTLE_ENDIAN)
                
                return buffer
            } catch (e: IOException) {
                debugLog("❌ WordPredictionEngine: File '$filename' not found")
                return null
            }
        }
    }
    
    /**
     * Prediction result with word and probability
     */
    data class Prediction(
        val word: String,
        val probability: UByte
    )
    
    /**
     * Get next-word predictions for a given source word
     * @param afterWord The word to predict after
     * @param limit Maximum number of predictions to return (default: 6)
     * @return List of predictions sorted by probability (highest first)
     */
    fun getPredictions(afterWord: String, limit: Int = 6): List<Prediction> {
        // Get word index from trie
        val wordIndex = trieEngine?.getWordIndex(afterWord) ?: run {
            debugLog("🔮 WordPredictionEngine: Word '$afterWord' not found in trie")
            return emptyList()
        }
        
        // Binary search in index to find prediction data offset
        val offset = binarySearchIndex(wordIndex) ?: run {
            debugLog("🔮 WordPredictionEngine: No predictions for word '$afterWord' (index $wordIndex)")
            return emptyList()
        }
        
        // Read predictions from data section
        return readPredictions(offset, limit)
    }
    
    /**
     * Binary search the index section to find the offset for a word
     * Index section starts at byte 8 and contains (word_index: UInt16, offset: UInt32) pairs
     */
    private fun binarySearchIndex(wordIndex: UShort): Int? {
        var left = 0
        var right = entryCount - 1
        
        while (left <= right) {
            val mid = (left + right) / 2
            val entryAddress = 8 + (mid * 6) // Header=8, each entry=6 bytes
            
            val currentWordIndex = data.getShort(entryAddress).toUShort()
            
            when {
                currentWordIndex == wordIndex -> {
                    // Found it - return the offset
                    val offset = data.getInt(entryAddress + 2)
                    return offset
                }
                currentWordIndex < wordIndex -> left = mid + 1
                else -> right = mid - 1
            }
        }
        
        return null
    }
    
    /**
     * Read prediction data from the data section
     * Format: prediction_count (UInt8) followed by predictions
     * Each prediction: type (UInt8), probability (UInt8), then either:
     *   - type=0: word_index (UInt16)
     *   - type=1: length (UInt8), utf8_bytes
     */
    private fun readPredictions(offset: Int, limit: Int): List<Prediction> {
        val predictions = mutableListOf<Prediction>()
        var position = offset
        
        // Read prediction count
        val count = data.get(position).toUByte()
        position += 1
        
        val actualCount = minOf(count.toInt(), limit)
        
        for (i in 0 until actualCount) {
            val type = data.get(position).toUByte()
            position += 1
            
            val probability = data.get(position).toUByte()
            position += 1
            
            val word = when (type.toInt()) {
                0 -> {
                    // Type 0: Index reference
                    val wordIndex = data.getShort(position).toUShort()
                    position += 2
                    
                    trieEngine?.getWord(wordIndex) ?: run {
                        debugLog("⚠️ WordPredictionEngine: Could not resolve index $wordIndex")
                        continue
                    }
                }
                1 -> {
                    // Type 1: Inline word
                    val length = data.get(position).toUByte().toInt()
                    position += 1
                    
                    val bytes = ByteArray(length)
                    for (j in 0 until length) {
                        bytes[j] = data.get(position + j)
                    }
                    position += length
                    
                    String(bytes, Charsets.UTF_8)
                }
                else -> {
                    debugLog("⚠️ WordPredictionEngine: Unknown type $type")
                    continue
                }
            }
            
            predictions.add(Prediction(word, probability))
        }
        
        // Sort by probability (highest first)
        predictions.sortByDescending { it.probability }
        
        return predictions
    }
}