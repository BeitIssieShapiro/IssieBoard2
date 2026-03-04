package org.issieshapiro.issieboard.shared

import android.util.Log
import java.util.Date

/**
 * Port of ios/Shared/KeyboardEngine.swift
 *
 * KeyboardEngine - Core Keyboard Logic
 *
 * Extracted shared logic from BaseKeyboardService that can be used by:
 * - BaseKeyboardService (real keyboard service with InputConnection)
 * - KeyboardPreviewView (preview with CustomTextDocumentProxy for React Native)
 *
 * This class handles:
 * - Key press logic and routing
 * - Suggestion management
 * - Auto-correction and auto-capitalization
 * - Text manipulation (backspace, delete word, etc.)
 *
 * It's completely decoupled from InputMethodService, using TextDocumentProxyProtocol
 * for text operations, making it reusable across different contexts.
 */
class KeyboardEngine(
    private val textProxy: TextDocumentProxyProtocol,
    val language: String,
    context: android.content.Context
) {

    // MARK: - Properties

    /** Keyboard renderer - handles all UI rendering */
    val renderer: KeyboardRenderer = KeyboardRenderer(context)

    /** Word suggestion controller - handles completions and predictions */
    val suggestionController: WordSuggestionController = WordSuggestionController(renderer)

    /** Double-space shortcut (". " instead of "  ") */
    private var lastSpaceTime: Date? = null
    private val doubleSpaceThreshold: Long = 2000 // 2 seconds in milliseconds

    /** Track if backspace is currently being pressed (to avoid re-render during touch) */
    var isBackspaceActive: Boolean = false

    // MARK: - Callbacks

    /** Called when next keyboard button is pressed (for system keyboard only) */
    var onNextKeyboard: (() -> Unit)? = null

    /** Called when dismiss keyboard button is pressed */
    var onDismissKeyboard: (() -> Unit)? = null

    /** Called when settings button is pressed */
    var onOpenSettings: (() -> Unit)? = null

    /** Called when language switch button is pressed */
    var onLanguageSwitch: (() -> Unit)? = null

    /** Called when keyset changes (for state persistence) */
    var onKeysetChanged: ((String) -> Unit)? = null

    /** Called to get text direction at cursor (for RTL detection) */
    var onGetTextDirection: (() -> Boolean)? = null

    /** Called to get current text for auto-shift detection */
    var getCurrentText: (() -> String)? = null

    /** Called to trigger keyboard re-render after shift state changes */
    var onRenderKeyboard: (() -> Unit)? = null

    init {
        // Initialize suggestion controller
        suggestionController.initialize(context)
        suggestionController.setLanguage(language)

        setupCallbacks()
    }

    // MARK: - Setup

    private fun setupCallbacks() {
        renderer.onKeysetChanged = { keysetId ->
            onKeysetChanged?.invoke(keysetId)
        }

        renderer.onKeyPress = { key ->
            handleKeyPress(key)
        }

        renderer.onDeleteCharacter = {
            handleBackspace()
        }

        renderer.onDeleteWord = {
            handleDeleteWord()
        }

        renderer.onNikkudSelected = { value ->
            textProxy.insertText(value)
            suggestionController.handleSpace()
        }

        renderer.onSuggestionSelected = { suggestion ->
            handleSuggestionSelected(suggestion)
        }

        renderer.onNextKeyboard = {
            onNextKeyboard?.invoke()
        }

        renderer.onDismissKeyboard = {
            onDismissKeyboard?.invoke()
        }

        renderer.onOpenSettings = {
            onOpenSettings?.invoke()
        }

        renderer.onLanguageSwitch = {
            onLanguageSwitch?.invoke()
        }

        renderer.onBackspaceTouchBegan = {
            isBackspaceActive = true
        }

        renderer.onBackspaceTouchEnded = {
            isBackspaceActive = false
            autoShiftAfterPunctuation()
        }

        renderer.onCursorMove = { offset ->
            handleCursorMove(offset)
        }

        renderer.onGetTextDirection = {
            onGetTextDirection?.invoke() ?: false
        }
    }

    // MARK: - Public Methods

    /**
     * Handle text change and update suggestions appropriately
     * This is the SINGLE method that decides what suggestions to show based on text state
     */
    fun handleTextChanged() {
        val fullText = getCurrentText?.invoke()
        if (fullText == null) {
            suggestionController.handleEnter()  // Clears current word and shows defaults
            return
        }

        Log.d(TAG, "handleTextChanged - text: '${fullText.takeLast(30)}'")

        val lastChar = fullText.lastOrNull()

        // Check if text ends with sentence-ending punctuation (with or without space after)
        val endsWithSentenceEnd = lastChar == '.' || lastChar == '?' || lastChar == '!'
        val endsWithSpace = lastChar?.isWhitespace() == true

        when {
            endsWithSentenceEnd -> {
                // Sentence ended (e.g., "Get.") → defaults
                Log.d(TAG, "Sentence ended → defaults")
                suggestionController.handleEnter()  // Clears current word and shows defaults
            }
            endsWithSpace || fullText.endsWith("\n") -> {
                // Text ends with space - check what came before
                val trimmed = fullText.trim()
                val beforeSpaceChar = trimmed.lastOrNull()
                val isNewSentence = beforeSpaceChar == '.' || beforeSpaceChar == '?' || beforeSpaceChar == '!' || trimmed.isEmpty()

                if (isNewSentence) {
                    // New sentence (e.g., "Get. ") → defaults
                    Log.d(TAG, "New sentence → defaults")
                    suggestionController.handleEnter()  // Clears current word and shows defaults
                } else {
                    // Word done (e.g., "hello ") → predictions
                    // detectCurrentWord will handle this properly
                    Log.d(TAG, "Word done → predictions")
                    suggestionController.detectCurrentWord(fullText)
                }
            }
            else -> {
                // Typing word (e.g., "Get") → completions
                Log.d(TAG, "Typing word → completions")
                suggestionController.detectCurrentWord(fullText)
            }
        }
    }

    /** Update suggestions based on current text context (legacy method) */
    fun updateSuggestions() {
        handleTextChanged()
    }

    // MARK: - Key Press Handling

    private fun handleKeyPress(key: ParsedKey) {
        when (key.type.lowercase()) {
            "backspace" -> handleBackspace()

            "enter", "action" -> {
                textProxy.insertText("\n")
                suggestionController.handleEnter()
            }

            "space" -> handleSpaceKey()

            "keyset" -> {
                // Keyset switch - handled by renderer
            }

            "language" -> onLanguageSwitch?.invoke()

            "next-keyboard" -> onNextKeyboard?.invoke()

            else -> {
                // Determine which value to use based on shift state
                val valueToInsert = if (renderer.isShiftActive() && key.sValue.isNotEmpty()) {
                    key.sValue
                } else {
                    key.value
                }

                if (valueToInsert.isNotEmpty()) {
                    if (valueToInsert == " ") {
                        handleSpaceKey()
                    } else {
                        textProxy.insertText(valueToInsert)

                        // Check if we just typed sentence-ending punctuation
                        if (valueToInsert == "." || valueToInsert == "?" || valueToInsert == "!") {
                            // Sentence ended → reset and show defaults
                            Log.d(TAG, "Sentence-ending punctuation typed → defaults")
                            suggestionController.handleEnter()  // Clears current word and shows defaults
                        } else {
                            // Normal character → show completions
                            suggestionController.handleCharacterTyped(valueToInsert)
                        }
                    }
                }
            }
        }
    }

    private fun handleBackspace() {
        // Check if there's any text or selection to delete
        // Check both if there's text before cursor OR if there's a text selection
        val beforeText = textProxy.documentContextBeforeInput ?: ""
        val selectedText = textProxy.getSelectedText(0)
        val hasText = beforeText.isNotEmpty() || !selectedText.isNullOrEmpty()

        if (!hasText) {
            return
        }

        textProxy.deleteBackward()
        if (!suggestionController.handleBackspace()) {
            suggestionController.detectCurrentWord(textProxy.documentContextBeforeInput ?: "")
        }

        autoShiftAfterPunctuation()
    }

    private fun handleDeleteWord() {
        val beforeText = textProxy.documentContextBeforeInput
        if (beforeText.isNullOrEmpty()) {
            textProxy.deleteBackward()
            return
        }

        var charsToDelete = 0
        var foundNonSpace = false

        for (char in beforeText.reversed()) {
            if (char.isWhitespace()) {
                if (foundNonSpace) break
                charsToDelete++
            } else {
                foundNonSpace = true
                charsToDelete++
            }
        }

        if (charsToDelete > 0) {
            repeat(charsToDelete) {
                textProxy.deleteBackward()
            }
        } else {
            textProxy.deleteBackward()
        }

        suggestionController.detectCurrentWord(textProxy.documentContextBeforeInput ?: "")
    }

    private fun handleSuggestionSelected(suggestion: String) {
        val replacedWord = suggestionController.handleSuggestionSelected(suggestion)

        // Delete the replaced word if any (when in typing mode)
        repeat(replacedWord.length) {
            textProxy.deleteBackward()
        }

        // Insert suggestion with space
        textProxy.insertText("$suggestion ")

        // Apply auto-shift after suggestion
        autoShiftAfterPunctuation()
    }

    private fun handleSpaceKey() {
        val now = Date()

        // Check for auto-capitalize "i" to "I"
        val beforeText = textProxy.documentContextBeforeInput
        if (beforeText != null && beforeText.endsWith("i")) {
            val textBeforeI = beforeText.dropLast(1)
            if (textBeforeI.isEmpty() || textBeforeI.last().isWhitespace()) {
                textProxy.deleteBackward()
                textProxy.insertText("I ")
                lastSpaceTime = now
                handleSuggestionsAfterSpace()
                autoShiftAfterPunctuation()
                return
            }
        }

        // Check for fuzzy auto-replace (handleSpace returns replacement if auto-correct triggered)
        val currentWord = suggestionController.currentWord
        val replacement = suggestionController.handleSpace()

        if (replacement != null) {
            // Auto-correct triggered - delete typed word and insert replacement with space
            repeat(currentWord.length) {
                textProxy.deleteBackward()
            }
            textProxy.insertText("$replacement ")
            lastSpaceTime = now
            autoShiftAfterPunctuation()
            return
        }

        // Double-space shortcut for period
        val lastTime = lastSpaceTime
        if (lastTime != null && (now.time - lastTime.time) < doubleSpaceThreshold) {
            val beforeText2 = textProxy.documentContextBeforeInput
            if (beforeText2 != null && beforeText2.endsWith(" ")) {
                val textBeforeSpace = beforeText2.dropLast(1)
                val charBeforeSpace = textBeforeSpace.lastOrNull()

                if (charBeforeSpace != ' ' && charBeforeSpace != '.') {
                    textProxy.deleteBackward()
                    textProxy.insertText(". ")
                    lastSpaceTime = null
                    // After ". " show defaults (new sentence)
                    suggestionController.showDefaults()
                    autoShiftAfterPunctuation()
                    return
                }
            }
        }

        // Normal space (handleSpace already called above, which switched to prediction mode)
        textProxy.insertText(" ")
        lastSpaceTime = now
        autoShiftAfterPunctuation()
    }

    /** Determine what suggestions to show after space is inserted */
    private fun handleSuggestionsAfterSpace() {
        val fullText = getCurrentText?.invoke()
        if (fullText == null) {
            suggestionController.showDefaults()
            return
        }

        Log.d(TAG, "handleSuggestionsAfterSpace - fullText: '${fullText.takeLast(30)}'")

        // Text now ends with space, check what came before
        val trimmed = fullText.trim()

        // Check for sentence-ending punctuation
        val lastChar = trimmed.lastOrNull()
        val isNewSentence = lastChar == '.' || lastChar == '?' || lastChar == '!' || trimmed.isEmpty()

        if (isNewSentence) {
            // New sentence → reset and show defaults
            Log.d(TAG, "New sentence (ends with '$lastChar') → defaults")
            suggestionController.handleEnter()  // Clears current word and shows defaults
        } else {
            // Word is done → show predictions
            // detectCurrentWord will handle this properly since text ends with space
            // It will extract the last completed word and show predictions
            Log.d(TAG, "Space after word → let detectCurrentWord handle predictions")
            suggestionController.detectCurrentWord(fullText)
        }
    }

    private fun handleCursorMove(offset: Int) {
        textProxy.adjustTextPosition(offset)
        Log.d(TAG, "Cursor moved by $offset characters")
    }

    // MARK: - Auto Behaviors

    /** Check and apply auto-shift after text changes */
    fun autoShiftAfterPunctuation() {
        // Only apply to English keyboard
        if (language != "en") return

        val beforeText = getCurrentText?.invoke() ?: return

        Log.d(TAG, "autoShiftAfterPunctuation - text: '${beforeText.takeLast(20)}', isEmpty: ${beforeText.isEmpty()}")

        // Check if text is empty
        if (beforeText.isEmpty()) {
            Log.d(TAG, "  ⇧ Empty text - activating shift")
            renderer.activateShift()
            onRenderKeyboard?.invoke()
            return
        }

        // Check if ends with sentence-ending punctuation followed by space(s)
        val trimmed = beforeText.trimEnd()
        val endsWithSpace = beforeText.lastOrNull()?.isWhitespace() == true
        val endsWithPunctuation = trimmed.lastOrNull() in setOf('.', '?', '!')
        val endsWithNewline = beforeText.endsWith("\n")

        val shouldActivateShift = (endsWithPunctuation && endsWithSpace) || endsWithNewline

        Log.d(TAG, "  endsWithSpace: $endsWithSpace, endsWithPunctuation: $endsWithPunctuation, shouldActivate: $shouldActivateShift")

        when {
            shouldActivateShift && !renderer.isShiftActive() -> {
                Log.d(TAG, "  ⇧ Activating shift after punctuation")
                renderer.activateShift()
                onRenderKeyboard?.invoke()
            }
            !shouldActivateShift && renderer.isShiftActive() -> {
                Log.d(TAG, "  ⇩ Deactivating shift")
                renderer.deactivateShift()
                onRenderKeyboard?.invoke()
            }
        }
    }

    /** Auto-return from special characters keyboard (123/#+=) to main keyboard (abc) after space */
    fun autoReturnFromSpecialChars(config: KeyboardConfig) {
        val currentKeyset = renderer.currentKeysetId

        // Check if we're on a special characters keyset
        if (currentKeyset == "123" || currentKeyset == "#+=") {
            // Switch back to abc keyset
            if (config.keysets.any { it.id == "abc" }) {
                Log.d(TAG, "Auto-returning from $currentKeyset to abc")
                renderer.currentKeysetId = "abc"
                onRenderKeyboard?.invoke()
            }
        }
    }

    companion object {
        private const val TAG = "KeyboardEngine"
    }
}
