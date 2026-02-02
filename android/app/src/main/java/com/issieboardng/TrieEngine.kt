package com.issieboardng

import android.content.Context
import android.util.Log
import java.io.InputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * TrieEngine - High-performance word completion engine using a pre-compiled binary trie
 * 
 * Compatible with the iOS Swift implementation. Both use the same binary format:
 * - Each node is 12 bytes:
 *   - Offset 0: 2 bytes - Character code (UInt16)
 *   - Offset 2: 2 bytes - Flags (UInt16), bit 0 = isWordEnd
 *   - Offset 4: 4 bytes - First child index (Int32), -1 = no child
 *   - Offset 8: 4 bytes - Next sibling index (Int32), -1 = no sibling
 * 
 * The binary files are created by the build_dictionaries.js script.
 */
class TrieEngine private constructor(private val data: ByteBuffer) {
    
    companion object {
        private const val TAG = "TrieEngine"
        private const val NODE_SIZE = 12  // Must match the JS build script and iOS implementation
        
        /**
         * Load a TrieEngine from a binary file in assets
         * Tries multiple filename patterns and locations
         */
        fun load(context: Context, languageCode: String): TrieEngine? {
            // List of possible filenames to try (with and without _50k suffix)
            val filenames = listOf(languageCode, "${languageCode}_50k")
            
            for (filename in filenames) {
                // Try direct asset lookup
                try {
                    val inputStream = context.assets.open("$filename.bin")
                    val engine = loadFromStream(inputStream, filename)
                    if (engine != null) return engine
                } catch (e: Exception) {
                    Log.d(TAG, "Not found: $filename.bin in assets root")
                }
                
                // Try in dict subdirectory
                try {
                    val inputStream = context.assets.open("dict/$filename.bin")
                    val engine = loadFromStream(inputStream, "dict/$filename")
                    if (engine != null) return engine
                } catch (e: Exception) {
                    Log.d(TAG, "Not found: dict/$filename.bin")
                }
                
                // Try in dict/bin subdirectory
                try {
                    val inputStream = context.assets.open("dict/bin/$filename.bin")
                    val engine = loadFromStream(inputStream, "dict/bin/$filename")
                    if (engine != null) return engine
                } catch (e: Exception) {
                    Log.d(TAG, "Not found: dict/bin/$filename.bin")
                }
            }
            
            Log.e(TAG, "❌ Dictionary file for '$languageCode' not found in any location")
            return null
        }
        
        private fun loadFromStream(inputStream: InputStream, path: String): TrieEngine? {
            return try {
                val bytes = inputStream.readBytes()
                inputStream.close()
                
                val buffer = ByteBuffer.wrap(bytes)
                buffer.order(ByteOrder.LITTLE_ENDIAN)  // Binary format uses little-endian
                
                val nodeCount = bytes.size / NODE_SIZE
                Log.i(TAG, "✅ Loaded '$path.bin' with $nodeCount nodes")
                
                TrieEngine(buffer)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to load from $path: ${e.message}")
                null
            }
        }
    }
    
    /**
     * Check if a word exists exactly in the dictionary (is a complete word)
     * @param word The word to check
     * @return true if the word exists as a complete word in the dictionary
     */
    fun wordExists(word: String): Boolean {
        if (word.isEmpty()) return false
        
        // Find the node for this word
        val nodeIndex = findNodeForPrefix(0, word) ?: return false
        
        // Check if this node marks the end of a word
        val flags = getUInt16(nodeIndex, 2)
        val isWordEnd = (flags.toInt() and 0x01) != 0
        
        return isWordEnd
    }
    
    /**
     * Get word suggestions for a prefix
     * @param prefix The letters typed so far
     * @param limit Maximum number of suggestions to return
     * @return List of suggested words
     */
    fun getSuggestions(prefix: String, limit: Int = 4): List<String> {
        if (prefix.isEmpty()) return emptyList()
        
        val results = mutableListOf<String>()
        
        // Find the node representing the last character of the prefix
        val startNodeIndex = findNodeForPrefix(0, prefix) ?: return emptyList()
        
        // Collect words starting from this node
        collectWords(startNodeIndex, prefix, results, limit)
        
        return results
    }
    
    // ========== Traversal Logic ==========
    
    /**
     * Traverse the Trie down to the node representing the prefix
     */
    private fun findNodeForPrefix(rootIndex: Int, prefix: String): Int? {
        var currentNodeIndex = rootIndex
        
        // Convert to UTF-16 code units (same as iOS)
        for (char in prefix) {
            val charCode = char.code.toShort()
            
            // Get the first child of the current node
            val firstChildIndex = getInt32(currentNodeIndex, 4)
            
            if (firstChildIndex == -1) {
                return null  // Dead end, prefix doesn't exist
            }
            
            // Search the sibling list of the child to find the specific character
            val matchIndex = findSibling(firstChildIndex, charCode)
            if (matchIndex != null) {
                currentNodeIndex = matchIndex
            } else {
                return null  // Character not found among siblings
            }
        }
        
        return currentNodeIndex
    }
    
    /**
     * Scan a linked list of siblings to find a specific character
     */
    private fun findSibling(startIndex: Int, targetChar: Short): Int? {
        var currentIndex = startIndex
        
        while (currentIndex != -1) {
            val char = getUInt16(currentIndex, 0)
            
            if (char == targetChar) {
                return currentIndex
            }
            
            // Move to next sibling
            currentIndex = getInt32(currentIndex, 8)
        }
        
        return null
    }
    
    /**
     * Recursively collect valid words starting from the given node
     */
    private fun collectWords(nodeIndex: Int, currentString: String, results: MutableList<String>, limit: Int) {
        if (results.size >= limit) return
        
        // Check if the current node ends a word
        val flags = getUInt16(nodeIndex, 2)
        val isWordEnd = (flags.toInt() and 0x01) != 0
        
        if (isWordEnd) {
            results.add(currentString)
        }
        
        // Visit children
        val firstChildIndex = getInt32(nodeIndex, 4)
        if (firstChildIndex != -1) {
            collectSiblingsRecursive(firstChildIndex, currentString, results, limit)
        }
    }
    
    /**
     * Iterate through all siblings at a specific level to collect words
     */
    private fun collectSiblingsRecursive(startIndex: Int, parentString: String, results: MutableList<String>, limit: Int) {
        var currentIndex = startIndex
        
        while (currentIndex != -1 && results.size < limit) {
            // Reconstruct the string for this node
            val charCode = getUInt16(currentIndex, 0)
            val newString = parentString + charCode.toInt().toChar()
            
            // Recursively search this node's subtree
            collectWords(currentIndex, newString, results, limit)
            
            // Move to next sibling
            currentIndex = getInt32(currentIndex, 8)
        }
    }
    
    // ========== Low-Level Memory Access ==========
    
    /**
     * Read a 2-byte UInt16 from the binary blob
     */
    private fun getUInt16(nodeIndex: Int, offset: Int): Short {
        val address = (nodeIndex * NODE_SIZE) + offset
        return data.getShort(address)
    }
    
    /**
     * Read a 4-byte Int32 from the binary blob
     */
    private fun getInt32(nodeIndex: Int, offset: Int): Int {
        val address = (nodeIndex * NODE_SIZE) + offset
        return data.getInt(address)
    }
}