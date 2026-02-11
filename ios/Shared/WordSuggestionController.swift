import Foundation

/**
 * WordSuggestionController - Manages word suggestion state and logic
 * 
 * This controller eliminates duplication between BaseKeyboardViewController
 * and KeyboardPreviewView by centralizing all word suggestion logic.
 * 
 * Usage:
 * 1. Create an instance with a KeyboardRenderer reference
 * 2. Call handleCharacterTyped(), handleBackspace(), handleSpace(), handleEnter()
 * 3. Controller automatically updates the renderer's suggestions bar
 */
class WordSuggestionController {
    
    // MARK: - Properties
    
    /// The renderer to update with suggestions
    private weak var renderer: KeyboardRenderer?
    
    /// Current word being typed (text between last space and cursor)
    private(set) var currentWord: String = ""
    
    /// Current language for suggestions
    private(set) var currentLanguage: String = "en"
    
    /// Whether word suggestions are enabled
    private(set) var isEnabled: Bool = true
    
    /// Whether auto-correct is enabled (replace on space with fuzzy match)
    private(set) var isAutoCorrectEnabled: Bool = true
    
    /// Last suggestion result (for fuzzy auto-replace)
    private(set) var currentSuggestionResult: WordCompletionManager.SuggestionResult?
    
    /// Last completed word (for predictions)
    private(set) var lastCompletedWord: String = ""
    
    /// Whether we're currently in prediction mode (showing next-word predictions)
    private(set) var isPredictionMode: Bool = false
    
    // MARK: - Initialization
    
    init(renderer: KeyboardRenderer? = nil) {
        self.renderer = renderer
    }
    
    // MARK: - Configuration
    
    /// Set the renderer to update with suggestions
    func setRenderer(_ renderer: KeyboardRenderer) {
        self.renderer = renderer
    }
    
    /// Set the current language for suggestions
    func setLanguage(_ language: String) {
        guard language != currentLanguage else { return }
        currentLanguage = language
        WordCompletionManager.shared.setLanguage(language)
    }
    
    /// Enable or disable word suggestions
    func setEnabled(_ enabled: Bool) {
        isEnabled = enabled
        if !enabled {
            clearSuggestions()
        }
    }
    
    /// Enable or disable auto-correct
    func setAutoCorrectEnabled(_ enabled: Bool) {
        isAutoCorrectEnabled = enabled
    }
    
    // MARK: - Input Handling
    
    /// Handle a character being typed
    /// - Parameter character: The character that was typed
    func handleCharacterTyped(_ character: String) {
        guard isEnabled else { return }
        
        // Exit prediction mode when user starts typing
        isPredictionMode = false
        
        currentWord += character
        updateSuggestions()
    }
    
    /// Handle backspace - remove last character from current word
    /// Returns true if there was a character to remove
    @discardableResult
    func handleBackspace() -> Bool {
        guard isEnabled else { return false }
        
        if !currentWord.isEmpty {
            currentWord.removeLast()
            updateSuggestions()
            return true
        }
        return false
    }
    
    /// Handle space key - switches to prediction mode
    func handleSpace() {
        // Save the current word as last completed word (if any)
        if !currentWord.isEmpty {
            lastCompletedWord = currentWord
        }
        
        currentWord = ""
        currentSuggestionResult = nil
        
        // Switch to prediction mode and show next-word predictions
        isPredictionMode = true
        showWordPredictions()
    }
    
    /// Handle enter key - clears current word and shows defaults
    func handleEnter() {
        currentWord = ""
        lastCompletedWord = ""
        currentSuggestionResult = nil
        isPredictionMode = false
        showDefaultSuggestions()
    }
    
    /// Handle suggestion selected - updates state based on current mode
    /// - Parameter selectedWord: The word that was selected from suggestions
    /// - Returns: The word that was replaced (the current word if in typing mode, empty if in prediction mode)
    func handleSuggestionSelected(_ selectedWord: String) -> String {
        let replacedWord = currentWord
        currentWord = ""
        currentSuggestionResult = nil
        
        // If we were in prediction mode, stay in prediction mode with the new word
        if isPredictionMode {
            lastCompletedWord = selectedWord
            showWordPredictions()
            return ""  // No text was replaced, word was inserted
        } else {
            // Was in typing mode - show defaults after selection
            showDefaultSuggestions()
            return replacedWord
        }
    }
    
    /// Show default suggestions (public method for external callers)
    func showDefaults() {
        showDefaultSuggestions()
    }
    
    // MARK: - Word Detection
    
    /// Detect current word from text before cursor
    /// Call this when keyboard appears or text field changes
    /// - Parameter beforeText: Text before the cursor position
    func detectCurrentWord(from beforeText: String?) {
        guard isEnabled else { return }
        
        // Handle empty text - show predictions if we have a last completed word
        guard let text = beforeText, !text.isEmpty else {
            currentWord = ""
            currentSuggestionResult = nil
            
            // Show predictions if available, otherwise defaults
            if !lastCompletedWord.isEmpty {
                isPredictionMode = true
                showWordPredictions()
            } else {
                isPredictionMode = false
                showDefaultSuggestions()
            }
            return
        }
        
        // Check if cursor is right after whitespace
        if let lastChar = text.last, lastChar.isWhitespace {
            // Find the word before the whitespace for predictions
            let beforeSpace = text.dropLast()
            var lastWordStart = beforeSpace.startIndex
            
            for i in beforeSpace.indices.reversed() {
                let char = beforeSpace[i]
                if char.isWhitespace {
                    lastWordStart = beforeSpace.index(after: i)
                    break
                }
            }
            
            let completedWord = String(beforeSpace[lastWordStart...])
            
            // Update last completed word and show predictions
            if !completedWord.isEmpty {
                lastCompletedWord = completedWord
            }
            
            currentWord = ""
            currentSuggestionResult = nil
            isPredictionMode = true
            showWordPredictions()
            return
        }
        
        // User is typing - find current word and show completions
        isPredictionMode = false
        
        var wordStart = text.endIndex
        var lastCompleteWord = ""
        var foundSpace = false
        
        for i in text.indices.reversed() {
            let char = text[i]
            if char.isWhitespace {
                if !foundSpace {
                    // This is the space before current word
                    wordStart = text.index(after: i)
                    foundSpace = true
                } else {
                    // Found space before the previous word
                    let prevWordStart = text.index(after: i)
                    lastCompleteWord = String(text[prevWordStart..<wordStart])
                    break
                }
            }
            if i == text.startIndex {
                if !foundSpace {
                    wordStart = i
                } else {
                    // Previous word starts at beginning
                    lastCompleteWord = String(text[i..<wordStart])
                }
            }
        }
        
        // Update last completed word if found
        if !lastCompleteWord.isEmpty {
            lastCompletedWord = lastCompleteWord.trimmingCharacters(in: .whitespaces)
        }
        
        let detectedWord = String(text[wordStart...])
        
        // Only update if different
        if detectedWord != currentWord {
            currentWord = detectedWord
            updateSuggestions()
        }
    }
    
    // MARK: - Fuzzy Auto-Replace
    
    /// Check if fuzzy auto-replace should happen on space
    /// Returns the word to replace with, or nil if no replacement
    func getFuzzyAutoReplacement() -> String? {
        guard isAutoCorrectEnabled,
              let result = currentSuggestionResult,
              result.hasFuzzyOnly,
              WordCompletionManager.shared.smartAutoReplaceEnabled,
              let bestMatch = result.bestFuzzyMatch,
              !currentWord.isEmpty else {
            return nil
        }
        return bestMatch
    }
    
    // MARK: - Private Helpers
    
    /// Update suggestions based on current word
    private func updateSuggestions() {
        guard isEnabled, let renderer = renderer else {
            currentSuggestionResult = nil
            return
        }
        
        guard !currentWord.isEmpty else {
            currentSuggestionResult = nil
            renderer.clearSuggestions()
            return
        }
        
        let result = WordCompletionManager.shared.getSuggestionsStructured(
            for: currentWord,
            language: currentLanguage
        )
        currentSuggestionResult = result
        
        // Build display suggestions based on fuzzy state
        var displaySuggestions: [String] = []
        
        if result.hasFuzzyOnly && !result.suggestions.isEmpty {
            // Only fuzzy matches - show quoted literal first, then best fuzzy highlighted
            let quotedLiteral = "\"\(currentWord)\""
            displaySuggestions.append(quotedLiteral)
            displaySuggestions.append(contentsOf: result.suggestions)
        } else {
            displaySuggestions = result.suggestions
        }
        
        // Reverse for RTL languages (Hebrew, Arabic)
        if currentLanguage == "he" || currentLanguage == "ar" {
            displaySuggestions.reverse()
        }
        
        // Update renderer with suggestions
        // Only highlight the best fuzzy match if auto-correct is enabled
        // Adjust highlight index for RTL languages
        var highlightIndex: Int? = nil
        if result.hasFuzzyOnly && isAutoCorrectEnabled {
            if currentLanguage == "he" || currentLanguage == "ar" {
                // In RTL, index 1 becomes (count - 2) after reversal
                highlightIndex = displaySuggestions.count - 2
            } else {
                highlightIndex = 1
            }
        }
        renderer.updateSuggestions(displaySuggestions, highlightIndex: highlightIndex)
    }
    
    /// Show default suggestions (when no text is being typed)
    private func showDefaultSuggestions() {
        guard isEnabled, let renderer = renderer else { return }
        
        isPredictionMode = false
        var suggestions = WordCompletionManager.shared.getSuggestions(for: "")
        
        // Reverse for RTL languages (Hebrew, Arabic)
        if currentLanguage == "he" || currentLanguage == "ar" {
            suggestions.reverse()
        }
        
        renderer.updateSuggestions(suggestions)
    }
    
    /// Show word predictions after completing a word
    private func showWordPredictions() {
        guard isEnabled, let renderer = renderer else { return }
        
        // If no last completed word, show defaults
        guard !lastCompletedWord.isEmpty else {
            showDefaultSuggestions()
            return
        }
        
        // Get predictions for the last completed word
        var predictions = WordCompletionManager.shared.getWordPredictions(
            afterWord: lastCompletedWord,
            limit: 4
        )
        
        // If no predictions available, show defaults
        if predictions.isEmpty {
            showDefaultSuggestions()
        } else {
            // Reverse for RTL languages (Hebrew, Arabic)
            if currentLanguage == "he" || currentLanguage == "ar" {
                predictions.reverse()
            }
            renderer.updateSuggestions(predictions)
        }
    }
    
    /// Clear all suggestions
    private func clearSuggestions() {
        currentWord = ""
        lastCompletedWord = ""
        currentSuggestionResult = nil
        isPredictionMode = false
        renderer?.clearSuggestions()
    }
}
