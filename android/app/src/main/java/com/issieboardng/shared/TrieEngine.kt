package com.issieboardng.shared

import android.content.Context
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * TrieEngine - Binary trie dictionary engine for word suggestions
 * 
 * Port of ios/Shared/TrieEngine.swift
 * 
 * Reads binary dictionary files (.bin) with a 12-byte node structure:
 * - char (UInt16, offset 0): The character at this node
 * - flags (UInt16, offset 2): Bit flags (0x01 = isWordEnd)
 * - firstChild (Int32, offset 4): Index of first child node (-1 if none)
 * - nextSibling (Int32, offset 8): Index of next sibling node (-1 if none)
 * 
 * Methods:
 * - getSuggestions: Get prefix-based completions
 * - getFuzzySuggestions: Get fuzzy search completions allowing typos
 * - wordExists: Check if exact word exists in dictionary
 */
class TrieEngine private constructor(private val data: ByteBuffer) {
    
    companion object {
        /** Size of one node in bytes (Must match the JS build script: 12 bytes) */
        private const val NODE_SIZE = 12
        
        /**
         * Create a TrieEngine by loading dictionary from assets
         * @param context Android context for asset access
         * @param filename Language code (e.g., "en", "he", "ar")
         * @return TrieEngine instance or null if loading fails
         */
        fun create(context: Context, filename: String): TrieEngine? {
            val data = loadDictionaryData(context, filename) ?: return null
            return TrieEngine(data)
        }
        
        /**
         * Try to load dictionary data from assets
         * Searches for files with and without _50k suffix
         */
        private fun loadDictionaryData(context: Context, filename: String): ByteBuffer? {
            // List of possible filenames to try (with and without _50k suffix)
            val filenames = listOf(filename, "${filename}_50k")
            
            for (name in filenames) {
                try {
                    // Try loading from assets
                    val assetPath = "$name.bin"
                    val inputStream = context.assets.open(assetPath)
                    val bytes = inputStream.readBytes()
                    inputStream.close()
                    
                    val buffer = ByteBuffer.wrap(bytes)
                    buffer.order(ByteOrder.LITTLE_ENDIAN)
                    
                    val nodeCount = bytes.size / NODE_SIZE
                    debugLog("✅ TrieEngine: Loaded '$name.bin' with $nodeCount nodes")
                    
                    return buffer
                } catch (e: IOException) {
                    // File not found, try next
                }
            }
            
            debugLog("❌ TrieEngine: Dictionary file '$filename.bin' not found in assets")
            return null
        }
    }
    
    // MARK: - Public API
    
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
     * Returns a list of word completions for the given prefix
     * @param prefix The letters typed so far (e.g., "app")
     * @param limit Maximum number of suggestions to return (default: 3)
     * @return List of suggested words
     */
    fun getSuggestions(prefix: String, limit: Int = 3): List<String> {
        if (prefix.isEmpty()) return emptyList()
        
        val results = mutableListOf<String>()
        
        // 1. Find the node representing the last character of the prefix
        // Start searching from Root (Index 0)
        val startNodeIndex = findNodeForPrefix(0, prefix) ?: return emptyList()
        
        // 2. Collect words starting from this node (DFS)
        collectWords(startNodeIndex, prefix, results, limit)
        
        return results
    }
    
    // MARK: - Fuzzy Search
    
    /**
     * Returns fuzzy word completions for the given prefix, allowing for typos
     * Uses recursive DFS approach matching the proven TestTrie algorithm
     * 
     * @param prefix The typed prefix
     * @param errorBudget Maximum errors allowed (default: 3.0)
     * @param neighbors Keyboard neighbor map for weighted errors
     * @param limit Maximum suggestions to return
     * @return List of fuzzy matched suggestions
     */
    fun getFuzzySuggestions(
        prefix: String,
        errorBudget: Double = 3.0,
        neighbors: Map<Char, List<Char>>? = null,
        limit: Int = 3
    ): List<String> {
        if (prefix.isEmpty()) return emptyList()
        
        val results = mutableListOf<Pair<String, Double>>()
        val prefixChars = prefix.lowercase().toCharArray()
        
        // Get root's first child
        val firstChildIndex = getInt32(0, 4)
        if (firstChildIndex == -1) {
            return emptyList()
        }
        
        // Iterate through ALL siblings at root level (all starting letters)
        var siblingIndex = firstChildIndex
        while (siblingIndex != -1) {
            // Get this node's character
            val nodeCharCode = getUInt16(siblingIndex, 0)
            val nodeCharacter = nodeCharCode.toInt().toChar()
            
            fuzzySearchRecursive(
                nodeIndex = siblingIndex,
                nodeChar = nodeCharacter,
                prefixChars = prefixChars,
                prefixIndex = 0,
                currentPath = "",
                currentErrors = 0.0,
                maxErrors = errorBudget,
                neighbors = neighbors,
                results = results
            )
            
            val nextSibling = getInt32(siblingIndex, 8)
            siblingIndex = nextSibling
        }
        
        // Sort by:
        // 1. Primary: errors (lower is better)
        // 2. Secondary: prefer words closer to input length
        // 3. Tertiary: shorter words first
        val inputLength = prefix.length
        val sorted = results.sortedWith { a, b ->
            // First compare errors
            if (a.second != b.second) {
                return@sortedWith a.second.compareTo(b.second)
            }
            // Then compare length distance from input
            val aDist = kotlin.math.abs(a.first.length - inputLength)
            val bDist = kotlin.math.abs(b.first.length - inputLength)
            if (aDist != bDist) {
                return@sortedWith aDist.compareTo(bDist)
            }
            // Finally, prefer shorter words
            a.first.length.compareTo(b.first.length)
        }
        
        val seen = mutableSetOf<String>()
        val uniqueResults = mutableListOf<String>()
        for ((word, _) in sorted) {
            if (!seen.contains(word)) {
                seen.add(word)
                uniqueResults.add(word)
                if (uniqueResults.size >= limit) {
                    break
                }
            }
        }
        
        return uniqueResults
    }
    
    /**
     * Recursive fuzzy search - matches the working TestTrie algorithm
     */
    private fun fuzzySearchRecursive(
        nodeIndex: Int,
        nodeChar: Char,
        prefixChars: CharArray,
        prefixIndex: Int,
        currentPath: String,
        currentErrors: Double,
        maxErrors: Double,
        neighbors: Map<Char, List<Char>>?,
        results: MutableList<Pair<String, Double>>
    ) {
        // Prune if over budget
        if (currentErrors > maxErrors) {
            return
        }
        
        val newPath = currentPath + nodeChar
        
        // If we still have input to match
        if (prefixIndex < prefixChars.size) {
            val targetChar = prefixChars[prefixIndex]
            
            // Calculate error for this character
            val errorForChar: Double = when {
                nodeChar == targetChar -> 0.0
                neighbors?.get(targetChar)?.contains(nodeChar) == true -> 0.5 // Keyboard neighbor
                else -> 1.0 // Non-neighbor substitution
            }
            
            val newErrors = currentErrors + errorForChar
            
            if (newErrors <= maxErrors) {
                // Get children and recurse
                val firstChild = getInt32(nodeIndex, 4)
                if (firstChild != -1) {
                    var childIdx = firstChild
                    while (childIdx != -1) {
                        val childCharCode = getUInt16(childIdx, 0)
                        val childChar = childCharCode.toInt().toChar()
                        
                        fuzzySearchRecursive(
                            nodeIndex = childIdx,
                            nodeChar = childChar,
                            prefixChars = prefixChars,
                            prefixIndex = prefixIndex + 1,
                            currentPath = newPath,
                            currentErrors = newErrors,
                            maxErrors = maxErrors,
                            neighbors = neighbors,
                            results = results
                        )
                        
                        val nextSib = getInt32(childIdx, 8)
                        childIdx = nextSib
                    }
                }
                
                // If consumed all input, collect results
                if (prefixIndex + 1 >= prefixChars.size) {
                    val flags = getUInt16(nodeIndex, 2)
                    val isWordEnd = (flags.toInt() and 0x01) != 0
                    if (isWordEnd) {
                        results.add(Pair(newPath, newErrors))
                    }
                    // Collect completions from this node
                    collectFuzzyCompletions(nodeIndex, newPath, newErrors, results)
                }
            }
        } else {
            // All input consumed - add word if valid and collect completions
            val flags = getUInt16(nodeIndex, 2)
            val isWordEnd = (flags.toInt() and 0x01) != 0
            if (isWordEnd) {
                results.add(Pair(newPath, currentErrors))
            }
            collectFuzzyCompletions(nodeIndex, newPath, currentErrors, results)
        }
    }
    
    /**
     * Collect word completions from a node (for fuzzy search)
     */
    private fun collectFuzzyCompletions(
        nodeIndex: Int,
        path: String,
        errors: Double,
        results: MutableList<Pair<String, Double>>
    ) {
        val firstChild = getInt32(nodeIndex, 4)
        if (firstChild == -1) {
            return
        }
        
        var childIdx = firstChild
        while (childIdx != -1) {
            val childCharCode = getUInt16(childIdx, 0)
            val childChar = childCharCode.toInt().toChar()
            val newPath = path + childChar
            
            val flags = getUInt16(childIdx, 2)
            val isWordEnd = (flags.toInt() and 0x01) != 0
            if (isWordEnd) {
                results.add(Pair(newPath, errors))
            }
            
            // Recurse into children
            collectFuzzyCompletions(childIdx, newPath, errors, results)
            
            val nextSib = getInt32(childIdx, 8)
            childIdx = nextSib
        }
    }
    
    // MARK: - Traversal Logic
    
    /**
     * Traverses the Trie down to the node representing the prefix
     */
    private fun findNodeForPrefix(rootIndex: Int, prefix: String): Int? {
        var currentNodeIndex = rootIndex
        
        // Iterate through each character in the prefix (as UTF-16 code units)
        for (char in prefix) {
            val charCode = char.code.toUShort()
            
            // Get the first child of the current node
            val firstChildIndex = getInt32(currentNodeIndex, 4)
            
            if (firstChildIndex == -1) {
                return null // Dead end, prefix doesn't exist
            }
            
            // Search the sibling list of the child to find the specific character
            val matchIndex = findSibling(firstChildIndex, charCode)
            if (matchIndex != null) {
                currentNodeIndex = matchIndex
            } else {
                return null // Character not found among siblings
            }
        }
        
        return currentNodeIndex
    }
    
    /**
     * Scans a linked list of siblings to find a specific character
     */
    private fun findSibling(startIndex: Int, targetChar: UShort): Int? {
        var currentIndex = startIndex
        
        while (currentIndex != -1) {
            // Read Char (Offset 0)
            val char = getUInt16(currentIndex, 0)
            
            if (char == targetChar) {
                return currentIndex
            }
            
            // Move to next sibling (Offset 8)
            val nextSibling = getInt32(currentIndex, 8)
            currentIndex = nextSibling
        }
        
        return null
    }
    
    /**
     * Recursively collects valid words starting from the given node
     */
    private fun collectWords(
        nodeIndex: Int,
        currentString: String,
        results: MutableList<String>,
        limit: Int
    ) {
        if (results.size >= limit) return
        
        // 1. Check if the current node itself ends a word
        // Read Flags (Offset 2). 0x01 means isWordEnd.
        val flags = getUInt16(nodeIndex, 2)
        val isWordEnd = (flags.toInt() and 0x01) != 0
        
        if (isWordEnd) {
            results.add(currentString)
        }
        
        // 2. Visit Children
        val firstChildIndex = getInt32(nodeIndex, 4)
        if (firstChildIndex != -1) {
            collectSiblingsRecursive(firstChildIndex, currentString, results, limit)
        }
    }
    
    /**
     * Iterates through all siblings at a specific level to collect words
     */
    private fun collectSiblingsRecursive(
        startIndex: Int,
        parentString: String,
        results: MutableList<String>,
        limit: Int
    ) {
        var currentIndex = startIndex
        
        while (currentIndex != -1 && results.size < limit) {
            // Reconstruct the string for this node
            val charCode = getUInt16(currentIndex, 0)
            val char = charCode.toInt().toChar()
            val newString = parentString + char
            
            // Recursively search this node's subtree
            collectWords(currentIndex, newString, results, limit)
            
            // Move to next sibling
            val nextSibling = getInt32(currentIndex, 8)
            currentIndex = nextSibling
        }
    }
    
    // MARK: - Low-Level Memory Access
    
    /**
     * Reads a 2-byte UInt16 from the binary blob
     * @param nodeIndex Node index in the trie
     * @param offset Byte offset within the node (0, 2, 4, or 8)
     */
    private fun getUInt16(nodeIndex: Int, offset: Int): UShort {
        val address = (nodeIndex * NODE_SIZE) + offset
        return data.getShort(address).toUShort()
    }
    
    /**
     * Reads a 4-byte Int32 from the binary blob
     * @param nodeIndex Node index in the trie
     * @param offset Byte offset within the node (0, 2, 4, or 8)
     */
    private fun getInt32(nodeIndex: Int, offset: Int): Int {
        val address = (nodeIndex * NODE_SIZE) + offset
        return data.getInt(address)
    }
}