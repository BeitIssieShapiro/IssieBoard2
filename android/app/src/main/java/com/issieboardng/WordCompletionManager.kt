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
        if (prefix.isEmpty()) return emptyList()
        
        val language = currentLanguage
        if (language == null) {
            Log.d(TAG, "📚 No language set, returning empty suggestions")
            return emptyList()
        }
        
        val engine = getEngine(language)
        if (engine == null) {
            Log.d(TAG, "📚 No engine available for '$language'")
            return emptyList()
        }
        
        val suggestions = engine.getSuggestions(prefix, MAX_SUGGESTIONS)
        // Filter out single-letter suggestions - they're already typed
        val filteredSuggestions = suggestions.filter { it.length > 1 }
        Log.d(TAG, "📚 Got ${filteredSuggestions.size} suggestions for '$prefix' (filtered from ${suggestions.size})")
        return filteredSuggestions
    }
    
    /**
     * Get word suggestions using a specific language
     */
    fun getSuggestions(prefix: String, languageCode: String): List<String> {
        if (prefix.isEmpty()) return emptyList()
        
        val engine = getEngine(languageCode)
        if (engine == null) {
            Log.d(TAG, "📚 No engine available for '$languageCode'")
            return emptyList()
        }
        
        val suggestions = engine.getSuggestions(prefix, MAX_SUGGESTIONS)
        // Filter out single-letter suggestions - they're already typed
        val filteredSuggestions = suggestions.filter { it.length > 1 }
        Log.d(TAG, "📚 Got ${filteredSuggestions.size} suggestions for '$prefix' in '$languageCode' (filtered from ${suggestions.size})")
        return filteredSuggestions
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