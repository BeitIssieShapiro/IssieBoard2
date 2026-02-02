package com.issieboardng

import android.content.Context
import android.util.Log

/**
 * WordCompletionManager - Manages word completion using TrieEngine
 * 
 * Handles loading dictionaries for different languages and providing
 * word suggestions based on the current input prefix.
 * 
 * Compatible with the iOS Swift implementation.
 */
class WordCompletionManager private constructor(private val context: Context) {
    
    companion object {
        private const val TAG = "WordCompletionManager"
        private const val MAX_SUGGESTIONS = 4
        
        /**
         * Hebrew prefixes that can be stripped for word lookup
         * These are common grammatical prefixes in Hebrew:
         * ה (the), ו (and), ב (in), כ (like/as), ל (to/for), מ (from), ש (that/which)
         */
        private val HEBREW_PREFIXES = listOf('ה', 'ו', 'ב', 'כ', 'ל', 'מ', 'ש')
        
        @Volatile
        private var instance: WordCompletionManager? = null
        
        fun getInstance(context: Context): WordCompletionManager {
            return instance ?: synchronized(this) {
                instance ?: WordCompletionManager(context.applicationContext).also { instance = it }
            }
        }
    }
    
    // Cache of loaded TrieEngine instances by language code
    private val engines = mutableMapOf<String, TrieEngine>()
    
    // Currently active language code
    private var currentLanguage: String? = null
    
    // Supported language codes
    private val languageMap = mapOf(
        "en" to "en",
        "he" to "he",
        "ar" to "ar"
    )
    
    init {
        Log.d(TAG, "📚 WordCompletionManager initialized")
    }
    
    /**
     * Set the current language for word completion
     */
    fun setLanguage(languageCode: String) {
        Log.d(TAG, "📚 Setting language to '$languageCode'")
        currentLanguage = languageCode
        
        // Pre-load the engine for this language if not already loaded
        getEngine(languageCode)
    }
    
    /**
     * Get word suggestions for the given prefix using current language
     */
    fun getSuggestions(prefix: String): List<String> {
        if (prefix.isEmpty()) {
            // Return default suggestions when no prefix (nothing typed yet)
            val defaults = getDefaultSuggestions()
            Log.d(TAG, "📚 Empty prefix, returning default suggestions: $defaults")
            return defaults
        }
        
        val language = currentLanguage
        if (language == null) {
            Log.d(TAG, "📚 No language set, returning empty suggestions")
            return emptyList()
        }
        
        return getSuggestionsInternal(prefix, language)
    }
    
    /**
     * Get word suggestions using a specific language
     */
    fun getSuggestions(prefix: String, languageCode: String): List<String> {
        if (prefix.isEmpty()) {
            // Return default suggestions when no prefix (nothing typed yet)
            val defaults = getDefaultSuggestions()
            Log.d(TAG, "📚 Empty prefix, returning default suggestions: $defaults")
            return defaults
        }
        
        return getSuggestionsInternal(prefix, languageCode)
    }
    
    /**
     * Internal method that implements exact match prioritization and Hebrew prefix stripping
     */
    private fun getSuggestionsInternal(prefix: String, languageCode: String): List<String> {
        val engine = getEngine(languageCode)
        if (engine == null) {
            Log.d(TAG, "📚 No engine available for '$languageCode'")
            return emptyList()
        }
        
        Log.d(TAG, "📚 Querying engine for prefix '$prefix' in '$languageCode' (length: ${prefix.length})")
        
        // Step 1: Check if prefix is an EXACT word in dictionary (prioritize exact matches)
        val isExactWord = engine.wordExists(prefix)
        if (isExactWord) {
            Log.d(TAG, "📚 '$prefix' is an exact word in dictionary - will prioritize")
        }
        
        // Step 2: Try prefix-based suggestions
        val exactSuggestions = engine.getSuggestions(prefix, MAX_SUGGESTIONS + 4)
        Log.d(TAG, "📚 Engine returned ${exactSuggestions.size} exact suggestions: $exactSuggestions")
        
        // Filter out single-letter suggestions
        val filteredExact = exactSuggestions.filter { it.length > 1 }.toMutableList()
        
        // Step 3: For Hebrew, try prefix stripping if we don't have enough results
        var prefixStrippedSuggestions = emptyList<String>()
        if (languageCode == "he" && filteredExact.size <= 1) {
            prefixStrippedSuggestions = getPrefixStrippedSuggestions(prefix, engine)
            Log.d(TAG, "📚 Hebrew prefix stripping returned ${prefixStrippedSuggestions.size} suggestions: $prefixStrippedSuggestions")
        }
        
        // Step 4: If exact word match, ensure it's in suggestions even if not in top results
        if (isExactWord && prefix.length > 1 && !filteredExact.contains(prefix)) {
            // Insert the exact match at the beginning
            filteredExact.add(0, prefix)
            Log.d(TAG, "📚 Added exact match '$prefix' to suggestions")
        }
        
        // Merge results: exact matches first, then prefix-stripped (avoiding duplicates)
        val merged = mutableListOf<String>()
        val seen = mutableSetOf<String>()
        
        // Add exact word match first if it exists
        if (isExactWord && prefix.length > 1) {
            merged.add(prefix)
            seen.add(prefix)
        }
        
        // Add exact matches
        for (suggestion in filteredExact) {
            if (suggestion.length > 1 && !seen.contains(suggestion)) {
                merged.add(suggestion)
                seen.add(suggestion)
            }
        }
        
        // Add prefix-stripped suggestions (for Hebrew)
        for (suggestion in prefixStrippedSuggestions) {
            if (suggestion.length > 1 && !seen.contains(suggestion)) {
                merged.add(suggestion)
                seen.add(suggestion)
            }
        }
        
        // Return top N results
        val finalSuggestions = merged.take(MAX_SUGGESTIONS)
        Log.d(TAG, "📚 Returning ${finalSuggestions.size} suggestions for '$prefix': $finalSuggestions")
        
        return finalSuggestions
    }
    
    /**
     * For Hebrew: Try stripping common prefixes and find root words
     */
    private fun getPrefixStrippedSuggestions(word: String, engine: TrieEngine): List<String> {
        if (word.length <= 1) return emptyList()
        
        val suggestions = mutableListOf<String>()
        val firstChar = word.first()
        
        // Check if first character is a Hebrew prefix
        if (HEBREW_PREFIXES.contains(firstChar)) {
            val strippedWord = word.drop(1)
            
            // Check if the stripped word exists in dictionary
            if (engine.wordExists(strippedWord)) {
                // The original word with prefix is likely valid
                // Add the original word as a suggestion (prefix + root)
                suggestions.add(word)
                Log.d(TAG, "📚 Hebrew prefix '$firstChar' + root '$strippedWord' found in dictionary")
            }
            
            // Also get suggestions for the stripped prefix
            if (strippedWord.length > 1) {
                val strippedSuggestions = engine.getSuggestions(strippedWord, 3)
                for (suggestion in strippedSuggestions) {
                    // Reconstruct with the original prefix
                    val reconstructed = "$firstChar$suggestion"
                    if (!suggestions.contains(reconstructed)) {
                        suggestions.add(reconstructed)
                    }
                }
            }
        }
        
        return suggestions
    }
    
    /**
     * Check if a dictionary is available for the given language
     */
    fun isDictionaryAvailable(languageCode: String): Boolean {
        return languageMap.containsKey(languageCode)
    }
    
    /**
     * Preload dictionaries for all available languages
     */
    fun preloadAllDictionaries() {
        Log.d(TAG, "📚 Preloading all dictionaries...")
        for (languageCode in languageMap.keys) {
            getEngine(languageCode)
        }
    }
    
    /**
     * Clear cached engines to free memory
     */
    fun clearCache() {
        Log.d(TAG, "📚 Clearing engine cache")
        engines.clear()
    }
    
    /**
     * Get default suggestions to show when no prefix is typed
     * These are common words that users frequently start typing
     * Language-specific defaults for: en, he, ar
     */
    private fun getDefaultSuggestions(): List<String> {
        return getDefaultSuggestions(currentLanguage)
    }
    
    /**
     * Get language-specific default suggestions
     */
    private fun getDefaultSuggestions(languageCode: String?): List<String> {
        return when (languageCode) {
            "he" -> listOf("אני", "זה", "לא")
            "ar" -> listOf("أنا", "هذا", "لا")
            else -> listOf("I", "the", "I'm") // Default to English
        }
    }
    
    /**
     * Get or load a TrieEngine for the given language
     */
    private fun getEngine(languageCode: String): TrieEngine? {
        // Return cached engine if available
        engines[languageCode]?.let { return it }
        
        // Get the dictionary filename for this language
        val filename = languageMap[languageCode]
        if (filename == null) {
            Log.d(TAG, "📚 No dictionary mapping for '$languageCode'")
            return null
        }
        
        // Try to load the engine
        val engine = TrieEngine.load(context, filename)
        if (engine != null) {
            engines[languageCode] = engine
            Log.d(TAG, "📚 Loaded engine for '$languageCode'")
            return engine
        }
        
        Log.d(TAG, "📚 Failed to load engine for '$languageCode'")
        return null
    }
}