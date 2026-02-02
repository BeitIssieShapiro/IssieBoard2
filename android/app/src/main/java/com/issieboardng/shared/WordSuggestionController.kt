package com.issieboardng.shared

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
    var currentLanguage: String = "en"
        private set
    
    /** Whether word suggestions are enabled */
    var isEnabled: Boolean = true
        private set
    
    /** Whether auto-correct is enabled (replace on space with fuzzy match) */
    var isAutoCorrectEnabled: Boolean = true
        private set
    
    /** Last suggestion result with fuzzy metadata */
    private var lastSuggestionResult: WordCompletionManager.SuggestionResult? = null
    
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
        
        currentWord += character
        debugLog("📝 WordSuggestionController: currentWord is now '$currentWord'")
        updateSuggestions()
    }
    
    /** Handle backspace - remove last character from current word */
    fun handleBackspace(): Boolean {
        if (!isEnabled) return false
        
        if (currentWord.isNotEmpty()) {
            currentWord = currentWord.dropLast(1)
            updateSuggestions()
            return true
        }
        return false
    }
    
    /**
     * Handle space key - potentially auto-correct then clear current word
     * @return The word that should replace the typed text (if auto-correct triggered), or null
     */
    fun handleSpace(): String? {
        var replacement: String? = null
        
        // Check if we should auto-correct with fuzzy match
        if (isAutoCorrectEnabled && currentWord.isNotEmpty()) {
            val result = lastSuggestionResult
            if (result != null && result.hasFuzzyOnly && result.bestFuzzyMatch != null) {
                // Auto-replace: return the best fuzzy match to replace the typed word
                replacement = result.bestFuzzyMatch
                debugLog("📝 WordSuggestionController: Auto-correcting '${result.originalPrefix}' -> '$replacement'")
            }
        }
        
        currentWord = ""
        lastSuggestionResult = null
        showDefaultSuggestions()
        
        return replacement
    }
    
    /** Handle enter key - clears current word and shows defaults */
    fun handleEnter() {
        currentWord = ""
        lastSuggestionResult = null
        showDefaultSuggestions()
    }
    
    /** Handle suggestion selected - clears current word */
    fun handleSuggestionSelected(): String {
        val replacedWord = currentWord
        currentWord = ""
        lastSuggestionResult = null
        showDefaultSuggestions()
        return replacedWord
    }
    
    /** Show default suggestions (public method for external callers) */
    fun showDefaults() {
        showDefaultSuggestions()
    }
    
    // MARK: - Word Detection
    
    /**
     * Detect current word from text before cursor
     * Call this when keyboard appears or text field changes
     */
    fun detectCurrentWord(beforeText: String?) {
        if (!isEnabled) return
        
        if (beforeText.isNullOrEmpty()) {
            currentWord = ""
            lastSuggestionResult = null
            showDefaultSuggestions()
            return
        }
        
        // Check if cursor is right after whitespace
        if (beforeText.last().isWhitespace()) {
            currentWord = ""
            lastSuggestionResult = null
            showDefaultSuggestions()
            return
        }
        
        // Find word before cursor (characters after last whitespace)
        val words = beforeText.split(Regex("\\s+"))
        val detectedWord = words.lastOrNull() ?: ""
        
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
        
        debugLog("📝 WordSuggestionController: Got ${result.suggestions.size} suggestions for '$currentWord': ${result.suggestions}")
        
        r.updateSuggestions(result.suggestions)
    }
    
    /** Show default suggestions (when no text is being typed) */
    private fun showDefaultSuggestions() {
        if (!isEnabled) return
        val r = renderer ?: return
        
        // Get default suggestions from WordCompletionManager
        val suggestions = WordCompletionManager.shared.getSuggestions("")
        r.updateSuggestions(suggestions)
    }
    
    /** Clear all suggestions */
    private fun clearSuggestions() {
        currentWord = ""
        lastSuggestionResult = null
        renderer?.clearSuggestions()
    }
}