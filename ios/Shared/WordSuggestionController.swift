import Foundation

/**
 * WordSuggestionController - Manages word suggestions and input tracking
 * 
 * This class acts as a coordinator between the keyboard UI and word completion/prediction engines.
 * It handles tracking current word, processing user input, and providing suggestions.
 */
class WordSuggestionController {
    
    // MARK: - Properties
    
    // Reference to the renderer for updating the UI
    private weak var renderer: KeyboardRenderer?
    
    // Current language code (e.g., "en", "he", "ar")
    private var currentLanguage: String = "en"
    
    // Current input word being typed
    private(set) var currentWord: String = ""
    
    // Whether suggestions are enabled
    private var suggestionsEnabled: Bool = true
    
    // Whether auto-correct is enabled
    private var autoCorrectEnabled: Bool = false
    
    // MARK: - Initialization
    
    init(renderer: KeyboardRenderer?) {
        self.renderer = renderer
    }
    
    // MARK: - Language Control
    
    /// Set the current language for suggestions
    /// - Parameter language: Language code (e.g., "en", "he", "ar")
    func setLanguage(_ language: String) {
        print("🔤 WordSuggestionController: Setting language to '\(language)'")
        if self.currentLanguage != language {
            self.currentLanguage = language
            
            // Update WordCompletionManager's language
            WordCompletionManager.shared.setLanguage(language)
            
            // Show initial suggestions for the new language
            if suggestionsEnabled {
                showDefaults()
            }
        }
    }
    
    // MARK: - Word Tracking
    
    /// Handle character typed - update current word and fetch suggestions
    /// - Parameter character: The character that was typed
    /// - Returns: true if handled, false otherwise
    func handleCharacterTyped(_ character: String) -> Bool {
        guard suggestionsEnabled else { return false }

        // Append to current word
        currentWord += character
        print("🔤 handleCharacterTyped: '\(character)' - currentWord now: '\(currentWord)'")

        // Get suggestions for current word
        updateSuggestions()

        return true
    }
    
    /// Handle space key - reset current word and show predictions
    /// - Returns: The previous word that was being typed
    func handleSpace() -> String {
        print("🔮 WordSuggestionController.handleSpace() called - currentWord: '\(currentWord)'")

        guard suggestionsEnabled else {
            let oldWord = currentWord
            currentWord = ""
            return oldWord
        }

        // If auto-correct is enabled and we have a fuzzy match, replace with best match
        if autoCorrectEnabled && currentWord.count > 1 {
            let result = WordCompletionManager.shared.getSuggestionsStructured(for: currentWord, language: currentLanguage)
            if result.hasFuzzyOnly, let bestMatch = result.bestFuzzyMatch {
                // Auto-correct would happen here in the keyboard extension
                print("🔤 WordSuggestionController: Auto-correct would replace '\(currentWord)' with '\(bestMatch)'")
            }
        }

        // Save current word before resetting (for return value)
        let oldWord = currentWord

        // Get predictions for next word
        if !currentWord.isEmpty {
            print("🔮 Getting predictions after word: '\(currentWord)'")
            // Get word predictions based on last word
            let predictions = WordCompletionManager.shared.getWordPredictions(
                afterWord: currentWord,
                language: currentLanguage
            )

            print("🔮 Got \(predictions.count) predictions: \(predictions)")

            // IMPORTANT: Reset currentWord BEFORE showing suggestions
            // This prevents showDefaults() from using the old word for completions
            currentWord = ""

            // Show predictions
            if !predictions.isEmpty {
                print("🔮 Showing predictions via renderer")
                renderer?.updateSuggestions(predictions)
            } else {
                // Show default suggestions if no predictions available
                print("🔮 No predictions, showing defaults (currentWord is now empty)")
                showDefaults()
            }
        } else {
            // If no current word, show defaults
            print("🔮 currentWord is empty, showing defaults")
            currentWord = ""
            showDefaults()
        }

        print("🔮 WordSuggestionController.handleSpace() complete - currentWord: '\(currentWord)'")

        return oldWord
    }
    
    /// Handle backspace key - update current word and fetch suggestions
    /// - Returns: true if handled, false otherwise
    func handleBackspace() -> Bool {
        guard suggestionsEnabled, !currentWord.isEmpty else { return false }
        
        // Remove last character from current word
        currentWord.removeLast()
        
        // Get suggestions for current word (or show defaults if empty)
        if !currentWord.isEmpty {
            updateSuggestions()
        } else {
            showDefaults()
        }
        
        return true
    }
    
    /// Handle enter key - reset current word
    /// - Returns: true if handled, false otherwise
    func handleEnter() -> Bool {
        currentWord = ""
        
        // Show defaults since current word is empty
        if suggestionsEnabled {
            showDefaults()
        }
        
        return true
    }
    
    /// Handle suggestion selected
    /// - Parameter suggestion: The selected suggestion
    /// - Returns: The replaced word (current word)
    func handleSuggestionSelected(_ suggestion: String) -> String {
        let replacedWord = currentWord
        currentWord = ""
        
        // Show defaults since current word is now empty
        if suggestionsEnabled {
            showDefaults()
        }
        
        return replacedWord
    }
    
    // MARK: - Auto Replacement
    
    /// Get the best fuzzy replacement for the current word, if any
    /// - Returns: The best fuzzy replacement, or nil if none available
    func getFuzzyAutoReplacement() -> String? {
        guard autoCorrectEnabled, !currentWord.isEmpty else { return nil }
        
        // Get structured suggestions to check for fuzzy matches
        let result = WordCompletionManager.shared.getSuggestionsStructured(
            for: currentWord, 
            language: currentLanguage
        )
        
        // Return the best fuzzy match if available
        return result.hasFuzzyOnly ? result.bestFuzzyMatch : nil
    }
    
    // MARK: - Suggestions Management
    
    /// Update suggestions based on current word
    private func updateSuggestions() {
        guard suggestionsEnabled, !currentWord.isEmpty else { return }
        
        // Get suggestions from the word completion manager
        // Include the current word as the first suggestion
        var suggestions = WordCompletionManager.shared.getSuggestions(
            for: currentWord, 
            language: currentLanguage
        )
        
        // Only include current word as a suggestion if it's not already in the results
        if !currentWord.isEmpty && !suggestions.contains(currentWord) {
            suggestions.insert("\"\(currentWord)\"", at: 0)
        }
        
        // Show suggestions
        renderer?.updateSuggestions(suggestions)
    }
    
    /// Show default suggestions when no word is being typed
    func showDefaults() {
        guard suggestionsEnabled else { return }
        
        // Get language-specific default suggestions
        var defaults = getDefaultSuggestions()
        
        // Ensure we have at least 3 suggestions
        while defaults.count < 3 {
            defaults.append("")
        }
        
        // Show default suggestions
        renderer?.updateSuggestions(defaults)
    }
    
    /// Get default suggestions based on current language
    private func getDefaultSuggestions() -> [String] {
        // Use WordCompletionManager's defaults
        if currentWord.isEmpty {
            return WordCompletionManager.shared.getSuggestions(for: "", language: currentLanguage)
        }
        
        // Or get suggestions for current word
        return WordCompletionManager.shared.getSuggestions(for: currentWord, language: currentLanguage)
    }
    
    /// Reset the current word to empty string
    func resetCurrentWord() {
        currentWord = ""
        
        if suggestionsEnabled {
            showDefaults()
        }
    }
    
    // MARK: - Settings Management
    
    /// Set whether suggestions are enabled
    /// - Parameter enabled: true to enable suggestions, false to disable
    func setEnabled(_ enabled: Bool) {
        suggestionsEnabled = enabled
    }
    
    /// Set whether auto-correct is enabled
    /// - Parameter enabled: true to enable auto-correct, false to disable
    func setAutoCorrectEnabled(_ enabled: Bool) {
        autoCorrectEnabled = enabled
    }
    
    // MARK: - Word Extraction
    
    /// Extract current word from text
    /// - Parameter text: The full text
    func detectCurrentWord(from text: String) {
        print("🔍 detectCurrentWord called with text: '\(text)'")

        guard !text.isEmpty else {
            currentWord = ""
            if suggestionsEnabled {
                showDefaults()
            }
            return
        }

        // Extract the last word from text
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let components = trimmed.components(separatedBy: .whitespacesAndNewlines)

        if let lastWord = components.last, !lastWord.isEmpty {
            currentWord = lastWord
            print("🔍 detectCurrentWord - set currentWord to: '\(currentWord)' - calling updateSuggestions()")
            updateSuggestions()
        } else {
            currentWord = ""
            if suggestionsEnabled {
                print("🔍 detectCurrentWord - no word found, showing defaults")
                showDefaults()
            }
        }
    }

    /// Set the current word without triggering suggestions update
    /// Useful when you need to set context before calling handleSpace()
    /// - Parameter word: The word to set as current
    func setCurrentWordSilently(_ word: String) {
        currentWord = word
    }
}