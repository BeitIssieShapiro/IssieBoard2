import Foundation

/**
 * WordCompletionManager - Manages word completion using TrieEngine
 * 
 * Handles loading dictionaries for different languages and providing
 * word suggestions based on the current input prefix.
 */
class WordCompletionManager {
    
    // MARK: - Singleton
    
    static let shared = WordCompletionManager()
    
    // MARK: - Properties
    
    /// Maximum number of suggestions to return
    private let maxSuggestions = 4
    
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
        
        guard let engine = getEngine(for: language) else {
            print("📚 WordCompletionManager: No engine available for '\(language)'")
            return []
        }
        
        print("📚 WordCompletionManager: Querying engine for prefix '\(prefix)' (length: \(prefix.count))")
        
        // Request extra suggestions to account for filtering
        let suggestions = engine.getSuggestions(for: prefix, limit: maxSuggestions + 4)
        print("📚 WordCompletionManager: Engine returned \(suggestions.count) raw suggestions: \(suggestions)")
        
        // Filter out single-letter suggestions - they're already typed
        let filteredSuggestions = Array(suggestions.filter { $0.count > 1 }.prefix(maxSuggestions))
        print("📚 WordCompletionManager: Returning \(filteredSuggestions.count) filtered suggestions for '\(prefix)': \(filteredSuggestions)")
        return filteredSuggestions
    }
    
    /// Get word suggestions using a specific language
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
        
        guard let engine = getEngine(for: languageCode) else {
            print("📚 WordCompletionManager: No engine available for '\(languageCode)'")
            return []
        }
        
        print("📚 WordCompletionManager: Querying engine for prefix '\(prefix)' in '\(languageCode)' (length: \(prefix.count))")
        
        // Request extra suggestions to account for filtering
        let suggestions = engine.getSuggestions(for: prefix, limit: maxSuggestions + 4)
        print("📚 WordCompletionManager: Engine returned \(suggestions.count) raw suggestions: \(suggestions)")
        
        // Filter out single-letter suggestions - they're already typed
        let filteredSuggestions = Array(suggestions.filter { $0.count > 1 }.prefix(maxSuggestions))
        print("📚 WordCompletionManager: Returning \(filteredSuggestions.count) filtered suggestions for '\(prefix)' in '\(languageCode)': \(filteredSuggestions)")
        return filteredSuggestions
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