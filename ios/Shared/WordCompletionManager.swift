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
    
    // MARK: - Properties
    
    /// Maximum number of suggestions to return
    private let maxSuggestions = 4
    
    /// Maximum number of errors allowed in fuzzy search
    /// Configurable: keyboard neighbors count as 0.5 error, others as 1.0
    var fuzzyErrorBudget: Double = 3.0
    
    /// Minimum number of exact matches before triggering fuzzy search
    /// If exact search returns <= this many results, fuzzy search is also performed
    private let fuzzyTriggerThreshold = 1
    
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
        guard let engine = getEngine(for: languageCode) else {
            print("📚 WordCompletionManager: No engine available for '\(languageCode)'")
            return []
        }
        
        print("📚 WordCompletionManager: Querying engine for prefix '\(prefix)' in '\(languageCode)' (length: \(prefix.count))")
        
        // Step 1: Try exact match first
        let exactSuggestions = engine.getSuggestions(for: prefix, limit: maxSuggestions + 4)
        print("📚 WordCompletionManager: Engine returned \(exactSuggestions.count) exact suggestions: \(exactSuggestions)")
        
        // Filter out single-letter suggestions
        var filteredExact = exactSuggestions.filter { $0.count > 1 }
        
        // Step 2: If exact matches are insufficient, try fuzzy search
        if filteredExact.count <= fuzzyTriggerThreshold && prefix.count >= 2 {
            print("📚 WordCompletionManager: Few exact matches (\(filteredExact.count)), trying fuzzy search with budget \(fuzzyErrorBudget)")
            
            // Get keyboard neighbors for fuzzy search
            let neighbors = KeyboardNeighbors.neighbors(for: languageCode)
            
            // Perform fuzzy search
            let fuzzySuggestions = engine.getFuzzySuggestions(
                for: prefix,
                errorBudget: fuzzyErrorBudget,
                neighbors: neighbors,
                limit: maxSuggestions + 4
            )
            print("📚 WordCompletionManager: Fuzzy search returned \(fuzzySuggestions.count) suggestions: \(fuzzySuggestions)")
            
            // Merge results: exact matches first, then fuzzy matches (avoiding duplicates)
            var seen = Set(filteredExact)
            for fuzzySuggestion in fuzzySuggestions {
                if fuzzySuggestion.count > 1 && !seen.contains(fuzzySuggestion) {
                    filteredExact.append(fuzzySuggestion)
                    seen.insert(fuzzySuggestion)
                }
            }
            
            print("📚 WordCompletionManager: After merging fuzzy results: \(filteredExact.count) total suggestions")
        }
        
        // Return top N results
        let finalSuggestions = Array(filteredExact.prefix(maxSuggestions))
        print("📚 WordCompletionManager: Returning \(finalSuggestions.count) suggestions for '\(prefix)': \(finalSuggestions)")
        return finalSuggestions
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