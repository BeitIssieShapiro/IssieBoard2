package com.issieboardng.shared

import android.content.Context

/**
 * WordCompletionManager - Manages word completion using TrieEngine
 * 
 * Port of ios/Shared/WordCompletionManager.swift
 * 
 * Handles loading dictionaries for different languages and providing
 * word suggestions based on the current input prefix.
 * 
 * Supports fuzzy search when exact matches are insufficient,
 * allowing for typos and keyboard neighbor mistakes.
 */
class WordCompletionManager private constructor() {
    
    companion object {
        /** Singleton instance */
        val shared: WordCompletionManager by lazy { WordCompletionManager() }
    }
    
    // MARK: - Suggestion Result Types
    
    /**
     * Represents a suggestion result with metadata
     */
    data class SuggestionResult(
        val suggestions: List<String>,
        val hasFuzzyOnly: Boolean,           // True if all suggestions are from fuzzy search
        val bestFuzzyMatch: String?,         // The best fuzzy match (for auto-replace on space)
        val originalPrefix: String           // The original typed text
    )
    
    // MARK: - Properties
    
    /** Maximum number of suggestions to return */
    private val maxSuggestions = 4
    
    /** 
     * Maximum number of errors allowed in fuzzy search
     * Configurable: keyboard neighbors count as 0.5 error, others as 1.0
     */
    var fuzzyErrorBudget: Double = 3.0
    
    /**
     * Minimum number of exact matches before triggering fuzzy search
     * If exact search returns <= this many results, fuzzy search is also performed
     */
    private val fuzzyTriggerThreshold = 1
    
    /** Whether smart auto-replace is enabled (space replaces with best fuzzy match) */
    var smartAutoReplaceEnabled: Boolean = true
    
    /**
     * Hebrew prefixes that can be stripped for word lookup
     * These are common grammatical prefixes in Hebrew:
     * ה (the), ו (and), ב (in), כ (like/as), ל (to/for), מ (from), ש (that/which)
     */
    private val hebrewPrefixes: List<Char> = listOf('ה', 'ו', 'ב', 'כ', 'ל', 'מ', 'ש')
    
    /** Cache of loaded TrieEngine instances by language code */
    private val engines: MutableMap<String, TrieEngine> = mutableMapOf()
    
    /** Cache of loaded WordPredictionEngine instances by language code */
    private val predictionEngines: MutableMap<String, WordPredictionEngine> = mutableMapOf()
    
    /** Currently active language code (e.g., "en", "he", "ar") */
    private var currentLanguage: String? = null
    
    /** Application context for loading assets */
    private var appContext: Context? = null
    
    /**
     * Supported language codes and their dictionary file names
     * The bin files should be named: en.bin, he.bin, ar.bin
     */
    private val languageMap: Map<String, String> = mapOf(
        "en" to "en",
        "he" to "he",
        "ar" to "ar"
    )
    
    // MARK: - Initialization
    
    init {
        debugLog("📚 WordCompletionManager initialized")
    }
    
    /**
     * Initialize with application context (required for asset access)
     * Should be called once at app startup
     */
    fun initialize(context: Context) {
        this.appContext = context.applicationContext
        debugLog("📚 WordCompletionManager: Context initialized")
    }
    
    // MARK: - Public API
    
    /**
     * Set the current language for word completion
     * @param languageCode Language code (e.g., "en", "he", "ar")
     */
    fun setLanguage(languageCode: String) {
        debugLog("📚 WordCompletionManager: Setting language to '$languageCode'")
        currentLanguage = languageCode
        
        // Pre-load the engine for this language if not already loaded
        getEngine(languageCode)
    }
    
    /**
     * Get word suggestions for the given prefix using current language
     * Uses fuzzy search when exact matches are insufficient
     * @param prefix The current word prefix to complete
     * @return List of suggested words (max 4)
     */
    fun getSuggestions(prefix: String): List<String> {
        if (prefix.isEmpty()) {
            // Return default suggestions when no prefix (nothing typed yet)
            val defaults = getDefaultSuggestions()
            debugLog("📚 WordCompletionManager: Empty prefix, returning default suggestions: $defaults")
            return defaults
        }
        
        val language = currentLanguage
        if (language == null) {
            debugLog("📚 WordCompletionManager: No language set, returning empty suggestions")
            return emptyList()
        }
        
        return getSuggestionsWithFuzzy(prefix, language)
    }
    
    /**
     * Get word suggestions using a specific language
     * Uses fuzzy search when exact matches are insufficient
     * @param prefix The current word prefix to complete
     * @param languageCode The language to use for suggestions
     * @return List of suggested words (max 4)
     */
    fun getSuggestions(prefix: String, languageCode: String): List<String> {
        if (prefix.isEmpty()) {
            // Return default suggestions when no prefix (nothing typed yet)
            val defaults = getDefaultSuggestions()
            debugLog("📚 WordCompletionManager: Empty prefix, returning default suggestions: $defaults")
            return defaults
        }
        
        return getSuggestionsWithFuzzy(prefix, languageCode)
    }
    
    /**
     * Internal method that performs both exact and fuzzy search
     */
    private fun getSuggestionsWithFuzzy(prefix: String, languageCode: String): List<String> {
        val result = getSuggestionsStructured(prefix, languageCode)
        return result.suggestions
    }
    
    /**
     * Get structured suggestion results with metadata about fuzzy matches
     * @param prefix The current word prefix to complete
     * @param languageCode The language to use for suggestions (optional, uses current if null)
     * @return SuggestionResult with suggestions and fuzzy metadata
     */
    fun getSuggestionsStructured(prefix: String, languageCode: String? = null): SuggestionResult {
        val language = languageCode ?: currentLanguage ?: "en"
        
        if (prefix.isEmpty()) {
            val defaults = getDefaultSuggestions(language)
            return SuggestionResult(
                suggestions = defaults,
                hasFuzzyOnly = false,
                bestFuzzyMatch = null,
                originalPrefix = prefix
            )
        }
        
        val engine = getEngine(language)
        if (engine == null) {
            debugLog("📚 WordCompletionManager: No engine available for '$language'")
            return SuggestionResult(
                suggestions = emptyList(),
                hasFuzzyOnly = false,
                bestFuzzyMatch = null,
                originalPrefix = prefix
            )
        }
        
        debugLog("📚 WordCompletionManager: Querying engine for prefix '$prefix' in '$language' (length: ${prefix.length})")
        
        // Step 1: Check if prefix is an EXACT word in dictionary (prioritize exact matches)
        val isExactWord = engine.wordExists(prefix)
        if (isExactWord) {
            debugLog("📚 WordCompletionManager: '$prefix' is an exact word in dictionary - will prioritize")
        }
        
        // Step 2: Try prefix-based suggestions
        val exactSuggestions = engine.getSuggestions(prefix, maxSuggestions + 4)
        debugLog("📚 WordCompletionManager: Engine returned ${exactSuggestions.size} exact suggestions: $exactSuggestions")
        
        // Filter out single-letter suggestions
        var filteredExact = exactSuggestions.filter { it.length > 1 }.toMutableList()
        
        // Step 3: For Hebrew, try prefix stripping if we don't have enough results
        var prefixStrippedSuggestions: List<String> = emptyList()
        if (language == "he" && filteredExact.size <= fuzzyTriggerThreshold) {
            prefixStrippedSuggestions = getPrefixStrippedSuggestions(prefix, engine)
            debugLog("📚 WordCompletionManager: Hebrew prefix stripping returned ${prefixStrippedSuggestions.size} suggestions: $prefixStrippedSuggestions")
        }
        
        // Step 4: If exact word match, ensure it's in suggestions even if not in top results
        if (isExactWord && prefix.length > 1 && !filteredExact.contains(prefix)) {
            // Insert the exact match at the beginning
            filteredExact.add(0, prefix)
            debugLog("📚 WordCompletionManager: Added exact match '$prefix' to suggestions")
        }
        
        // Step 5: If exact matches are sufficient (including prefix-stripped), return them
        val combinedExact = filteredExact + prefixStrippedSuggestions.filter { !filteredExact.contains(it) }
        if (combinedExact.size > fuzzyTriggerThreshold || prefix.length < 2) {
            var finalSuggestions = combinedExact.take(maxSuggestions)
            // Ensure no duplicates
            val seen = mutableSetOf<String>()
            finalSuggestions = finalSuggestions.filter { 
                if (seen.contains(it)) false
                else {
                    seen.add(it)
                    true
                }
            }
            return SuggestionResult(
                suggestions = finalSuggestions,
                hasFuzzyOnly = false,
                bestFuzzyMatch = null,
                originalPrefix = prefix
            )
        }
        
        // Step 6: Exact matches insufficient, try fuzzy search
        debugLog("📚 WordCompletionManager: Few exact matches (${combinedExact.size}), trying fuzzy search with budget $fuzzyErrorBudget")
        
        // Get keyboard neighbors for fuzzy search
        val neighbors = KeyboardNeighbors.neighbors(language)
        
        // Perform fuzzy search
        val fuzzySuggestions = engine.getFuzzySuggestions(
            prefix = prefix,
            errorBudget = fuzzyErrorBudget,
            neighbors = neighbors,
            limit = maxSuggestions + 4
        )
        debugLog("📚 WordCompletionManager: Fuzzy search returned ${fuzzySuggestions.size} suggestions: $fuzzySuggestions")
        
        // Determine if we have ONLY fuzzy matches (no exact matches)
        val hasFuzzyOnly = combinedExact.isEmpty() && fuzzySuggestions.isNotEmpty()
        
        // Get the best fuzzy match (first one is best due to error sorting)
        val bestFuzzyMatch = fuzzySuggestions.firstOrNull { it.length > 1 }
        
        // Merge results: exact matches first, then prefix-stripped, then fuzzy matches (avoiding duplicates)
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
        
        // Add fuzzy matches
        for (suggestion in fuzzySuggestions) {
            if (suggestion.length > 1 && !seen.contains(suggestion)) {
                merged.add(suggestion)
                seen.add(suggestion)
            }
        }
        
        debugLog("📚 WordCompletionManager: After merging fuzzy results: ${merged.size} total suggestions")
        
        // Return top N results
        val finalSuggestions = merged.take(maxSuggestions)
        debugLog("📚 WordCompletionManager: Returning ${finalSuggestions.size} suggestions for '$prefix': $finalSuggestions, hasFuzzyOnly: $hasFuzzyOnly, bestFuzzy: ${bestFuzzyMatch ?: "none"}")
        
        return SuggestionResult(
            suggestions = finalSuggestions,
            hasFuzzyOnly = hasFuzzyOnly,
            bestFuzzyMatch = bestFuzzyMatch,
            originalPrefix = prefix
        )
    }
    
    /**
     * For Hebrew: Try stripping common prefixes and find root words
     * @param word The word to check with prefix
     * @param engine The TrieEngine to search in
     * @return List of suggestions based on stripped prefix + root word found
     */
    private fun getPrefixStrippedSuggestions(word: String, engine: TrieEngine): List<String> {
        if (word.length <= 1) return emptyList()
        
        val suggestions = mutableListOf<String>()
        val firstChar = word.first()
        
        // Check if first character is a Hebrew prefix
        if (hebrewPrefixes.contains(firstChar)) {
            val strippedWord = word.drop(1)
            
            // Check if the stripped word exists in dictionary
            if (engine.wordExists(strippedWord)) {
                // The original word with prefix is likely valid
                // Add the original word as a suggestion (prefix + root)
                suggestions.add(word)
                debugLog("📚 WordCompletionManager: Hebrew prefix '$firstChar' + root '$strippedWord' found in dictionary")
            }
            
            // Also get suggestions for the stripped prefix
            if (strippedWord.length > 1) {
                val strippedSuggestions = engine.getSuggestions(strippedWord, 3)
                for (suggestion in strippedSuggestions) {
                    // Reconstruct with the original prefix
                    val reconstructed = firstChar.toString() + suggestion
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
     * @param languageCode Language code to check
     * @return true if dictionary is available
     */
    fun isDictionaryAvailable(languageCode: String): Boolean {
        return languageMap.containsKey(languageCode)
    }
    
    /**
     * Preload dictionaries for all available languages
     */
    fun preloadAllDictionaries() {
        debugLog("📚 WordCompletionManager: Preloading all dictionaries...")
        for ((languageCode, _) in languageMap) {
            getEngine(languageCode)
        }
    }
    
    /**
     * Clear cached engines to free memory
     */
    fun clearCache() {
        debugLog("📚 WordCompletionManager: Clearing engine cache")
        engines.clear()
        predictionEngines.clear()
    }
    
    // MARK: - Word Predictions
    
    /**
     * Get next-word predictions after completing a word
     * @param afterWord The completed word to predict after
     * @param limit Maximum number of predictions to return (default: 4)
     * @return List of predicted next words
     */
    fun getWordPredictions(afterWord: String, limit: Int = 4): List<String> {
        val language = currentLanguage ?: return emptyList()
        
        val predictionEngine = getPredictionEngine(language)
        if (predictionEngine == null) {
            debugLog("🔮 WordCompletionManager: No prediction engine for '$language'")
            return emptyList()
        }
        
        val predictions = predictionEngine.getPredictions(afterWord, limit)
        return predictions.map { it.word }
    }
    
    /**
     * Check if prediction engine is available for current language
     */
    fun isPredictionAvailable(): Boolean {
        val language = currentLanguage ?: return false
        return getPredictionEngine(language) != null
    }
    
    // MARK: - Private Helpers
    
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
            else -> listOf("I", "the", "I'm")  // Default to English
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
            debugLog("📚 WordCompletionManager: No dictionary mapping for '$languageCode'")
            return null
        }
        
        // Get context for asset loading
        val context = appContext
        if (context == null) {
            debugLog("📚 WordCompletionManager: No context available - call initialize() first")
            return null
        }
        
        // Try to load the engine
        val engine = TrieEngine.create(context, filename)
        if (engine != null) {
            engines[languageCode] = engine
            debugLog("📚 WordCompletionManager: Loaded engine for '$languageCode'")
            return engine
        }
        
        debugLog("📚 WordCompletionManager: Failed to load engine for '$languageCode'")
        return null
    }
    
    /**
     * Get or load a WordPredictionEngine for the given language
     */
    private fun getPredictionEngine(languageCode: String): WordPredictionEngine? {
        // Return cached engine if available
        predictionEngines[languageCode]?.let { return it }
        
        // Get context for asset loading
        val context = appContext
        if (context == null) {
            debugLog("📚 WordCompletionManager: No context for prediction engine")
            return null
        }
        
        // Get the corresponding trie engine (needed for index-to-word conversion)
        val trieEngine = getEngine(languageCode)
        
        // Try to load the prediction engine
        val filename = "${languageCode}_predictions.bin"
        val predEngine = WordPredictionEngine.create(context, filename, trieEngine)
        
        if (predEngine != null) {
            predictionEngines[languageCode] = predEngine
            debugLog("📚 WordCompletionManager: Loaded prediction engine for '$languageCode'")
            return predEngine
        }
        
        debugLog("📚 WordCompletionManager: No prediction engine available for '$languageCode'")
        return null
    }
}
