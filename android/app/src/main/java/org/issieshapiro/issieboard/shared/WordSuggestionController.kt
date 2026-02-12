package org.issieshapiro.issieboard.shared

import android.content.Context

/**
 * WordSuggestionController - Manages word suggestion state and logic
 * 
 * Port of ios/Shared/WordSuggestionController.swift
 * 
 * This controller eliminates duplication between BaseKeyboardService
 * and KeyboardPreviewView by centralizing all word suggestion logic.
 * 
 * Usage:
 * 1. Create an instance with a KeyboardRenderer reference
 * 2. Call initialize() with a Context to enable dictionary loading
 * 3. Call handleCharacterTyped(), handleBackspace(), handleSpace(), handleEnter()
 * 4. Controller automatically updates the renderer's suggestions bar
 */
class WordSuggestionController(private var renderer: KeyboardRenderer? = null) {
    
    // MARK: - Properties
    
    /** Current word being typed (text between last space and cursor) */
    var currentWord: String = ""
        private set
    
    /** Current language for suggestions */
    var currentLanguage: String = ""
        private set
    
    /** Whether word suggestions are enabled */
    var isEnabled: Boolean = true
        private set
    
    /** Whether auto-correct is enabled (replace on space with fuzzy match) */
    var isAutoCorrectEnabled: Boolean = true
        private set
    
    /** Last suggestion result with fuzzy metadata */
    private var lastSuggestionResult: WordCompletionManager.SuggestionResult? = null
    
    /** Last completed word (for predictions) */
    var lastCompletedWord: String = ""
        private set
    
    /** Whether we're currently in prediction mode (showing next-word predictions) */
    var isPredictionMode: Boolean = false
        private set
    
    // MARK: - Initialization
    
    init {
        debugLog("📝 WordSuggestionController initialized")
    }
    
    /**
     * Initialize the controller with a context for dictionary loading
     * This must be called before suggestions will work
     * @param context Android context for asset access
     */
    fun initialize(context: Context) {
        WordCompletionManager.shared.initialize(context)
        debugLog("📝 WordSuggestionController: Initialized with context")
    }
    
    // MARK: - Configuration
    
    /** Set the renderer to update with suggestions */
    fun setRenderer(renderer: KeyboardRenderer) {
        this.renderer = renderer
    }
    
    /** Set the current language for suggestions */
    fun setLanguage(language: String) {
        if (language == currentLanguage) return
        currentLanguage = language
        WordCompletionManager.shared.setLanguage(language)
        debugLog("📝 WordSuggestionController: Language set to '$language'")
    }
    
    /** Enable or disable word suggestions */
    fun setEnabled(enabled: Boolean) {
        isEnabled = enabled
        if (!enabled) {
            clearSuggestions()
        }
    }
    
    /** Enable or disable auto-correct */
    fun setAutoCorrectEnabled(enabled: Boolean) {
        isAutoCorrectEnabled = enabled
        WordCompletionManager.shared.smartAutoReplaceEnabled = enabled
    }
    
    // MARK: - Input Handling
    
    /** Handle a character being typed */
    fun handleCharacterTyped(character: String) {
        debugLog("📝 WordSuggestionController.handleCharacterTyped: '$character', isEnabled=$isEnabled, currentWord='$currentWord'")
        if (!isEnabled) {
            debugLog("📝 WordSuggestionController: Suggestions disabled, skipping")
            return
        }
        
        // Exit prediction mode when user starts typing
        isPredictionMode = false
        
        currentWord += character
        debugLog("📝 WordSuggestionController: currentWord is now '$currentWord'")
        updateSuggestions()
    }
    
    /** Handle backspace - remove last character from current word */
    fun handleBackspace(): Boolean {
        if (!isEnabled) return false

        if (currentWord.isNotEmpty()) {
            alwaysLog("⌫ handleBackspace: removing char from currentWord='$currentWord'")
            currentWord = currentWord.dropLast(1)
            alwaysLog("⌫ handleBackspace: currentWord is now='$currentWord'")

            if (currentWord.isEmpty()) {
                // We just emptied currentWord - check if we should show predictions
                // This happens when backspacing "get k" → "get " (removing 'k')
                if (lastCompletedWord.isNotEmpty()) {
                    alwaysLog("⌫ handleBackspace: currentWord now empty but have lastCompletedWord='$lastCompletedWord', showing predictions")
                    isPredictionMode = true
                    showWordPredictions()
                } else {
                    alwaysLog("⌫ handleBackspace: currentWord now empty, showing defaults")
                    showDefaultSuggestions()
                }
            } else {
                // Still have characters in currentWord, show completions
                updateSuggestions()
            }
            return true
        }
        alwaysLog("⌫ handleBackspace: currentWord empty, returning false (will call detectCurrentWord)")
        return false
    }
    
    /**
     * Handle space key - potentially auto-correct then switch to prediction mode
     * @return The word that should replace the typed text (if auto-correct triggered), or null
     */
    fun handleSpace(): String? {
        debugLog("📝 WordSuggestionController.handleSpace() called, currentWord='$currentWord', isEnabled=$isEnabled")
        var replacement: String? = null

        // Save the current word as last completed word (if any)
        if (currentWord.isNotEmpty()) {
            lastCompletedWord = currentWord
            debugLog("📝 WordSuggestionController: Saved lastCompletedWord='$lastCompletedWord'")
        }
        
        // Check if we should auto-correct with fuzzy match
        if (isAutoCorrectEnabled && currentWord.isNotEmpty()) {
            val result = lastSuggestionResult
            if (result != null && result.hasFuzzyOnly && result.bestFuzzyMatch != null) {
                // Auto-replace: return the best fuzzy match to replace the typed word
                replacement = result.bestFuzzyMatch
                lastCompletedWord = replacement
                debugLog("📝 WordSuggestionController: Auto-correcting '${result.originalPrefix}' -> '$replacement'")
            }
        }
        
        currentWord = ""
        lastSuggestionResult = null
        
        // Switch to prediction mode and show next-word predictions
        isPredictionMode = true
        showWordPredictions()
        
        return replacement
    }
    
    /** Handle enter key - clears current word and shows defaults */
    fun handleEnter() {
        currentWord = ""
        lastCompletedWord = ""
        lastSuggestionResult = null
        isPredictionMode = false
        showDefaultSuggestions()
    }
    
    /** Handle suggestion selected - updates state based on current mode */
    fun handleSuggestionSelected(selectedWord: String): String {
        val replacedWord = currentWord
        currentWord = ""
        lastSuggestionResult = null
        
        // If we were in prediction mode, stay in prediction mode with the new word
        if (isPredictionMode) {
            lastCompletedWord = selectedWord
            showWordPredictions()
            return "" // No text was replaced, word was inserted
        } else {
            // Was in typing mode - show defaults after selection
            showDefaultSuggestions()
            return replacedWord
        }
    }
    
    /** Show default suggestions (public method for external callers) */
    fun showDefaults() {
        showDefaultSuggestions()
    }
    
    // MARK: - Word Detection

    /**
     * Detect current word from text before cursor
     * Call this when keyboard appears or text field changes
     * Port of ios/Shared/WordSuggestionController.swift detectCurrentWord(from:)
     */
    fun detectCurrentWord(beforeText: String?) {
        if (!isEnabled) return

        // Handle empty text - show predictions if we have a last completed word
        if (beforeText.isNullOrEmpty()) {
            currentWord = ""
            lastSuggestionResult = null

            // Show predictions if available, otherwise defaults
            if (lastCompletedWord.isNotEmpty()) {
                isPredictionMode = true
                showWordPredictions()
            } else {
                isPredictionMode = false
                showDefaultSuggestions()
            }
            return
        }

        // Check if cursor is right after whitespace
        if (beforeText.last().isWhitespace()) {
            alwaysLog("📝 detectCurrentWord: text ends with whitespace, beforeText='$beforeText'")
            // Find the word before the whitespace for predictions
            val beforeSpace = beforeText.dropLast(1)
            var lastWordStart = 0

            for (i in beforeSpace.length - 1 downTo 0) {
                val char = beforeSpace[i]
                if (char.isWhitespace()) {
                    lastWordStart = i + 1
                    break
                }
            }

            val completedWord = beforeSpace.substring(lastWordStart)
            alwaysLog("📝 detectCurrentWord: completedWord='$completedWord'")

            // Update last completed word and show predictions
            if (completedWord.isNotEmpty()) {
                lastCompletedWord = completedWord
                alwaysLog("📝 WordSuggestionController: Detected completed word '$completedWord', switching to prediction mode")
            }

            currentWord = ""
            lastSuggestionResult = null
            isPredictionMode = true
            showWordPredictions()
            return
        }

        // User is typing - find current word and show completions
        isPredictionMode = false

        var wordStart = beforeText.length
        var lastCompleteWord = ""
        var foundSpace = false

        for (i in beforeText.length - 1 downTo 0) {
            val char = beforeText[i]
            if (char.isWhitespace()) {
                if (!foundSpace) {
                    // This is the space before current word
                    wordStart = i + 1
                    foundSpace = true
                } else {
                    // Found space before the previous word
                    val prevWordStart = i + 1
                    lastCompleteWord = beforeText.substring(prevWordStart, wordStart)
                    break
                }
            }
            if (i == 0) {
                if (!foundSpace) {
                    wordStart = 0
                } else {
                    // Previous word starts at beginning
                    lastCompleteWord = beforeText.substring(0, wordStart)
                }
            }
        }

        // Update last completed word if found
        if (lastCompleteWord.isNotEmpty()) {
            lastCompletedWord = lastCompleteWord.trim()
        }

        val detectedWord = beforeText.substring(wordStart)

        // Only update if different
        if (detectedWord != currentWord) {
            currentWord = detectedWord
            updateSuggestions()
        }
    }
    
    // MARK: - Private Helpers
    
    /** Update suggestions based on current word */
    private fun updateSuggestions() {
        if (!isEnabled) return
        val r = renderer ?: return
        
        if (currentWord.isEmpty()) {
            r.clearSuggestions()
            lastSuggestionResult = null
            return
        }
        
        // Get structured suggestions from WordCompletionManager
        val result = WordCompletionManager.shared.getSuggestionsStructured(currentWord, currentLanguage)
        lastSuggestionResult = result
        
        var displaySuggestions = result.suggestions.toMutableList()
        
        // Reverse for RTL languages (Hebrew, Arabic)
        if (currentLanguage == "he" || currentLanguage == "ar") {
            displaySuggestions.reverse()
        }
        
        debugLog("📝 WordSuggestionController: Got ${displaySuggestions.size} suggestions for '$currentWord': $displaySuggestions")
        
        r.updateSuggestions(displaySuggestions)
    }
    
    /** Show default suggestions (when no text is being typed) */
    private fun showDefaultSuggestions() {
        if (!isEnabled) return
        val r = renderer ?: return

        isPredictionMode = false
        var suggestions = WordCompletionManager.shared.getSuggestions("").toMutableList()

        // Reverse for RTL languages (Hebrew, Arabic)
        if (currentLanguage == "he" || currentLanguage == "ar") {
            suggestions.reverse()
        }

        debugLog("📝 WordSuggestionController: Showing default suggestions: $suggestions")
        r.updateSuggestions(suggestions)
    }

    /** Show word predictions after completing a word */
    private fun showWordPredictions() {
        if (!isEnabled) return
        val r = renderer ?: return

        // If no last completed word, show defaults
        if (lastCompletedWord.isEmpty()) {
            alwaysLog("📝 No lastCompletedWord, showing defaults")
            showDefaultSuggestions()
            return
        }

        // Get predictions for the last completed word
        alwaysLog("📝 Getting predictions after '$lastCompletedWord' in language '$currentLanguage'")
        var predictions = WordCompletionManager.shared.getWordPredictions(lastCompletedWord, 4).toMutableList()

        // If no predictions available, show defaults
        if (predictions.isEmpty()) {
            alwaysLog("📝 No predictions available for '$lastCompletedWord', showing defaults")
            showDefaultSuggestions()
        } else {
            // Reverse for RTL languages (Hebrew, Arabic)
            if (currentLanguage == "he" || currentLanguage == "ar") {
                predictions.reverse()
            }
            alwaysLog("📝 Showing ${predictions.size} predictions: $predictions")
            r.updateSuggestions(predictions)
        }
    }
    
    /** Clear all suggestions */
    private fun clearSuggestions() {
        currentWord = ""
        lastSuggestionResult = null
        renderer?.clearSuggestions()
    }
}