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
    
    /// Handle space key - clears current word and shows defaults
    func handleSpace() {
        currentWord = ""
        currentSuggestionResult = nil
        showDefaultSuggestions()
    }
    
    /// Handle enter key - clears current word and shows defaults
    func handleEnter() {
        currentWord = ""
        currentSuggestionResult = nil
        showDefaultSuggestions()
    }
    
    /// Handle suggestion selected - clears current word
    /// - Returns: The word that was replaced (the current word)
    func handleSuggestionSelected() -> String {
        let replacedWord = currentWord
        currentWord = ""
        currentSuggestionResult = nil
        showDefaultSuggestions()
        return replacedWord
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
        
        guard let text = beforeText, !text.isEmpty else {
            currentWord = ""
            currentSuggestionResult = nil
            showDefaultSuggestions()
            return
        }
        
        // Check if cursor is right after whitespace
        if let lastChar = text.last, lastChar.isWhitespace {
            currentWord = ""
            currentSuggestionResult = nil
            showDefaultSuggestions()
            return
        }
        
        // Find word before cursor (characters after last whitespace)
        var wordStart = text.endIndex
        for i in text.indices.reversed() {
            let char = text[i]
            if char.isWhitespace {
                wordStart = text.index(after: i)
                break
            }
            if i == text.startIndex {
                wordStart = i
            }
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
        
        // Update renderer with suggestions
        // Only highlight the best fuzzy match if auto-correct is enabled
        let highlightIndex: Int? = (result.hasFuzzyOnly && isAutoCorrectEnabled) ? 1 : nil
        renderer.updateSuggestions(displaySuggestions, highlightIndex: highlightIndex)
    }
    
    /// Show default suggestions (when no text is being typed)
    private func showDefaultSuggestions() {
        guard isEnabled, let renderer = renderer else { return }
        
        let suggestions = WordCompletionManager.shared.getSuggestions(for: "")
        renderer.updateSuggestions(suggestions)
    }
    
    /// Clear all suggestions
    private func clearSuggestions() {
        currentWord = ""
        currentSuggestionResult = nil
        renderer?.clearSuggestions()
    }
}