import Foundation

/**
 * WordCompletionManager - Manages word completion using TrieEngine
 * 
 * Handles loading dictionaries for different languages and providing
 * word suggestions based on the current input prefix.
 * 
 * Supports fuzzy search when exact matches are insufficient,
 * allowing for typos and keyboard neighbor mistakes.
 */
class WordCompletionManager {
    
    // MARK: - Singleton
    
    static let shared = WordCompletionManager()
    
    // MARK: - Suggestion Result Types
    
    /// Represents a suggestion result with metadata
    struct SuggestionResult {
        let suggestions: [String]
        let hasFuzzyOnly: Bool           // True if all suggestions are from fuzzy search
        let bestFuzzyMatch: String?       // The best fuzzy match (for auto-replace on space)
        let originalPrefix: String        // The original typed text
    }
    
    // MARK: - Properties
    
    /// Maximum number of suggestions to return
    private let maxSuggestions = 4
    
    /// Maximum number of errors allowed in fuzzy search
    /// Configurable: keyboard neighbors count as 0.5 error, others as 1.0
    var fuzzyErrorBudget: Double = 3.0
    
    /// Minimum number of exact matches before triggering fuzzy search
    /// If exact search returns <= this many results, fuzzy search is also performed
    private let fuzzyTriggerThreshold = 1
    
    /// Whether smart auto-replace is enabled (space replaces with best fuzzy match)
    var smartAutoReplaceEnabled: Bool = true
    
    /// Hebrew prefixes that can be stripped for word lookup
    /// These are common grammatical prefixes in Hebrew:
    /// ה (the), ו (and), ב (in), כ (like/as), ל (to/for), מ (from), ש (that/which)
    private let hebrewPrefixes: [Character] = ["ה", "ו", "ב", "כ", "ל", "מ", "ש"]
    
    /// Cache of loaded TrieEngine instances by language code
    private var engines: [String: TrieEngine] = [:]
    
    /// Currently active language code (e.g., "en", "he", "ar")
    private var currentLanguage: String?
    
    /// Supported language codes and their dictionary file names
    /// The bin files should be named: en.bin, he.bin, ar.bin
    private let languageMap: [String: String] = [
        "en": "en",
        "he": "he",
        "ar": "ar"
    ]
    
    // MARK: - Initialization
    
    private init() {
        print("📚 WordCompletionManager initialized")
    }
    
    // MARK: - Public API
    
    /// Set the current language for word completion
    /// - Parameter languageCode: Language code (e.g., "en", "he", "ar")
    func setLanguage(_ languageCode: String) {
        print("📚 WordCompletionManager: Setting language to '\(languageCode)'")
        currentLanguage = languageCode
        
        // Pre-load the engine for this language if not already loaded
        _ = getEngine(for: languageCode)
    }
    
    /// Get word suggestions for the given prefix using current language
    /// Uses fuzzy search when exact matches are insufficient
    /// - Parameter prefix: The current word prefix to complete
    /// - Returns: Array of suggested words (max 4)
    func getSuggestions(for prefix: String) -> [String] {
        guard !prefix.isEmpty else {
            // Return default suggestions when no prefix (nothing typed yet)
            let defaults = getDefaultSuggestions()
            print("📚 WordCompletionManager: Empty prefix, returning default suggestions: \(defaults)")
            return defaults
        }
        
        guard let language = currentLanguage else {
            print("📚 WordCompletionManager: No language set, returning empty suggestions")
            return []
        }
        
        return getSuggestionsWithFuzzy(for: prefix, language: language)
    }
    
    /// Get word suggestions using a specific language
    /// Uses fuzzy search when exact matches are insufficient
    /// - Parameters:
    ///   - prefix: The current word prefix to complete
    ///   - languageCode: The language to use for suggestions
    /// - Returns: Array of suggested words (max 4)
    func getSuggestions(for prefix: String, language languageCode: String) -> [String] {
        guard !prefix.isEmpty else {
            // Return default suggestions when no prefix (nothing typed yet)
            let defaults = getDefaultSuggestions()
            print("📚 WordCompletionManager: Empty prefix, returning default suggestions: \(defaults)")
            return defaults
        }
        
        return getSuggestionsWithFuzzy(for: prefix, language: languageCode)
    }
    
    /// Internal method that performs both exact and fuzzy search
    private func getSuggestionsWithFuzzy(for prefix: String, language languageCode: String) -> [String] {
        let result = getSuggestionsStructured(for: prefix, language: languageCode)
        return result.suggestions
    }
    
    /// Get structured suggestion results with metadata about fuzzy matches
    /// - Parameters:
    ///   - prefix: The current word prefix to complete
    ///   - languageCode: The language to use for suggestions
    /// - Returns: SuggestionResult with suggestions and fuzzy metadata
    func getSuggestionsStructured(for prefix: String, language languageCode: String? = nil) -> SuggestionResult {
        let language = languageCode ?? currentLanguage ?? "en"
        
        guard !prefix.isEmpty else {
            let defaults = getDefaultSuggestions(for: language)
            return SuggestionResult(
                suggestions: defaults,
                hasFuzzyOnly: false,
                bestFuzzyMatch: nil,
                originalPrefix: prefix
            )
        }
        
        guard let engine = getEngine(for: language) else {
            print("📚 WordCompletionManager: No engine available for '\(language)'")
            return SuggestionResult(
                suggestions: [],
                hasFuzzyOnly: false,
                bestFuzzyMatch: nil,
                originalPrefix: prefix
            )
        }
        
        print("📚 WordCompletionManager: Querying engine for prefix '\(prefix)' in '\(language)' (length: \(prefix.count))")
        
        // Step 1: Check if prefix is an EXACT word in dictionary (prioritize exact matches)
        let isExactWord = engine.wordExists(prefix)
        if isExactWord {
            print("📚 WordCompletionManager: '\(prefix)' is an exact word in dictionary - will prioritize")
        }
        
        // Step 2: Try prefix-based suggestions
        let exactSuggestions = engine.getSuggestions(for: prefix, limit: maxSuggestions + 4)
        print("📚 WordCompletionManager: Engine returned \(exactSuggestions.count) exact suggestions: \(exactSuggestions)")
        
        // Filter out single-letter suggestions
        var filteredExact = exactSuggestions.filter { $0.count > 1 }
        
        // Step 3: For Hebrew, try prefix stripping if we don't have enough results
        var prefixStrippedSuggestions: [String] = []
        if language == "he" && filteredExact.count <= fuzzyTriggerThreshold {
            prefixStrippedSuggestions = getPrefixStrippedSuggestions(for: prefix, engine: engine)
            print("📚 WordCompletionManager: Hebrew prefix stripping returned \(prefixStrippedSuggestions.count) suggestions: \(prefixStrippedSuggestions)")
        }
        
        // Step 4: If exact word match, ensure it's in suggestions even if not in top results
        if isExactWord && prefix.count > 1 && !filteredExact.contains(prefix) {
            // Insert the exact match at the beginning
            filteredExact.insert(prefix, at: 0)
            print("📚 WordCompletionManager: Added exact match '\(prefix)' to suggestions")
        }
        
        // Step 5: If exact matches are sufficient (including prefix-stripped), return them
        let combinedExact = filteredExact + prefixStrippedSuggestions.filter { !filteredExact.contains($0) }
        if combinedExact.count > fuzzyTriggerThreshold || prefix.count < 2 {
            var finalSuggestions = Array(combinedExact.prefix(maxSuggestions))
            // Ensure no duplicates
            var seen = Set<String>()
            finalSuggestions = finalSuggestions.filter { 
                if seen.contains($0) { return false }
                seen.insert($0)
                return true
            }
            return SuggestionResult(
                suggestions: finalSuggestions,
                hasFuzzyOnly: false,
                bestFuzzyMatch: nil,
                originalPrefix: prefix
            )
        }
        
        // Step 6: Exact matches insufficient, try fuzzy search
        print("📚 WordCompletionManager: Few exact matches (\(combinedExact.count)), trying fuzzy search with budget \(fuzzyErrorBudget)")
        
        // Get keyboard neighbors for fuzzy search
        let neighbors = KeyboardNeighbors.neighbors(for: language)
        
        // Perform fuzzy search
        let fuzzySuggestions = engine.getFuzzySuggestions(
            for: prefix,
            errorBudget: fuzzyErrorBudget,
            neighbors: neighbors,
            limit: maxSuggestions + 4
        )
        print("📚 WordCompletionManager: Fuzzy search returned \(fuzzySuggestions.count) suggestions: \(fuzzySuggestions)")
        
        // Determine if we have ONLY fuzzy matches (no exact matches)
        let hasFuzzyOnly = combinedExact.isEmpty && !fuzzySuggestions.isEmpty
        
        // Get the best fuzzy match (first one is best due to error sorting)
        let bestFuzzyMatch = fuzzySuggestions.first { $0.count > 1 }
        
        // Merge results: exact matches first, then prefix-stripped, then fuzzy matches (avoiding duplicates)
        var merged: [String] = []
        var seen = Set<String>()
        
        // Add exact word match first if it exists
        if isExactWord && prefix.count > 1 {
            merged.append(prefix)
            seen.insert(prefix)
        }
        
        // Add exact matches
        for suggestion in filteredExact {
            if suggestion.count > 1 && !seen.contains(suggestion) {
                merged.append(suggestion)
                seen.insert(suggestion)
            }
        }
        
        // Add prefix-stripped suggestions (for Hebrew)
        for suggestion in prefixStrippedSuggestions {
            if suggestion.count > 1 && !seen.contains(suggestion) {
                merged.append(suggestion)
                seen.insert(suggestion)
            }
        }
        
        // Add fuzzy matches
        for suggestion in fuzzySuggestions {
            if suggestion.count > 1 && !seen.contains(suggestion) {
                merged.append(suggestion)
                seen.insert(suggestion)
            }
        }
        
        print("📚 WordCompletionManager: After merging fuzzy results: \(merged.count) total suggestions")
        
        // Return top N results
        let finalSuggestions = Array(merged.prefix(maxSuggestions))
        print("📚 WordCompletionManager: Returning \(finalSuggestions.count) suggestions for '\(prefix)': \(finalSuggestions), hasFuzzyOnly: \(hasFuzzyOnly), bestFuzzy: \(bestFuzzyMatch ?? "none")")
        
        return SuggestionResult(
            suggestions: finalSuggestions,
            hasFuzzyOnly: hasFuzzyOnly,
            bestFuzzyMatch: bestFuzzyMatch,
            originalPrefix: prefix
        )
    }
    
    /// For Hebrew: Try stripping common prefixes and find root words
    /// - Parameters:
    ///   - word: The word to check with prefix
    ///   - engine: The TrieEngine to search in
    /// - Returns: Array of suggestions based on stripped prefix + root word found
    private func getPrefixStrippedSuggestions(for word: String, engine: TrieEngine) -> [String] {
        guard word.count > 1 else { return [] }
        
        var suggestions: [String] = []
        let firstChar = word.first!
        
        // Check if first character is a Hebrew prefix
        if hebrewPrefixes.contains(firstChar) {
            let strippedWord = String(word.dropFirst())
            
            // Check if the stripped word exists in dictionary
            if engine.wordExists(strippedWord) {
                // The original word with prefix is likely valid
                // Add the original word as a suggestion (prefix + root)
                suggestions.append(word)
                print("📚 WordCompletionManager: Hebrew prefix '\(firstChar)' + root '\(strippedWord)' found in dictionary")
            }
            
            // Also get suggestions for the stripped prefix
            if strippedWord.count > 1 {
                let strippedSuggestions = engine.getSuggestions(for: strippedWord, limit: 3)
                for suggestion in strippedSuggestions {
                    // Reconstruct with the original prefix
                    let reconstructed = String(firstChar) + suggestion
                    if !suggestions.contains(reconstructed) {
                        suggestions.append(reconstructed)
                    }
                }
            }
        }
        
        return suggestions
    }
    
    /// Check if a dictionary is available for the given language
    /// - Parameter languageCode: Language code to check
    /// - Returns: true if dictionary is available
    func isDictionaryAvailable(for languageCode: String) -> Bool {
        return languageMap[languageCode] != nil
    }
    
    /// Preload dictionaries for all available languages
    func preloadAllDictionaries() {
        print("📚 WordCompletionManager: Preloading all dictionaries...")
        for (languageCode, _) in languageMap {
            _ = getEngine(for: languageCode)
        }
    }
    
    /// Clear cached engines to free memory
    func clearCache() {
        print("📚 WordCompletionManager: Clearing engine cache")
        engines.removeAll()
    }
    
    // MARK: - Private Helpers
    
    /// Get default suggestions to show when no prefix is typed
    /// These are common words that users frequently start typing
    /// Language-specific defaults for: en, he, ar
    private func getDefaultSuggestions() -> [String] {
        return getDefaultSuggestions(for: currentLanguage)
    }
    
    /// Get language-specific default suggestions
    private func getDefaultSuggestions(for languageCode: String?) -> [String] {
        switch languageCode {
        case "he":
            return ["אני", "זה", "לא"]
        case "ar":
            return ["أنا", "هذا", "لا"]
        default:
            // Default to English
            return ["I", "the", "I'm"]
        }
    }
    
    /// Get or load a TrieEngine for the given language
    private func getEngine(for languageCode: String) -> TrieEngine? {
        // Return cached engine if available
        if let engine = engines[languageCode] {
            return engine
        }
        
        // Get the dictionary filename for this language
        guard let filename = languageMap[languageCode] else {
            print("📚 WordCompletionManager: No dictionary mapping for '\(languageCode)'")
            return nil
        }
        
        // Try to load the engine
        if let engine = TrieEngine(filename: filename) {
            engines[languageCode] = engine
            print("📚 WordCompletionManager: Loaded engine for '\(languageCode)'")
            return engine
        }
        
        print("📚 WordCompletionManager: Failed to load engine for '\(languageCode)'")
        return nil
    }
}