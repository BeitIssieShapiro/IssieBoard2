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

    /** Shadow copy of text before cursor — updated after each native key operation.
     * Used as fallback when documentContextBeforeInput is empty (hardware keyboard case). */
    private var shadowTextBefore: String = ""

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
            insertNikkudMark(value)
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

        renderer.onGetCharBeforeCursor = {
            // Prefer live proxy context; fall back to shadow buffer (empty when hardware kb active)
            val before = textProxy.documentContextBeforeInput ?: ""
            val source = if (before.isEmpty()) shadowTextBefore else before
            if (source.isEmpty()) {
                null
            } else {
                val lastCluster = source.takeLast(1)
                // Return the letter base (strip combining marks, find first letter scalar)
                val firstLetter = lastCluster.codePoints().toArray().firstOrNull { cp ->
                    val type = Character.getType(cp)
                    type == Character.OTHER_LETTER.toInt() ||
                    type == Character.UPPERCASE_LETTER.toInt() ||
                    type == Character.LOWERCASE_LETTER.toInt()
                }
                if (firstLetter != null) {
                    String(Character.toChars(firstLetter))
                } else {
                    val first = lastCluster.codePoints().toArray().firstOrNull()
                    if (first != null) String(Character.toChars(first)) else ""
                }
            }
        }
    }

    // MARK: - Public Methods

    /**
     * Handle text change and update suggestions appropriately
     * This is the SINGLE method that decides what suggestions to show based on text state
     */
    fun handleTextChanged() {
        val liveText = getCurrentText?.invoke() ?: ""
        // When proxy returns empty (e.g. external keyboard context restriction), fall back to shadow
        val fullText = if (liveText.isEmpty()) shadowTextBefore else liveText

        if (fullText.isEmpty()) {
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

            "event" -> {
                // Event-only key - just emit the key press, don't modify text
                // Used for custom actions like clear-all, save, load, etc.
                // The container (React Native) will handle the action
            }

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

        // Sync shadow context after every native key operation; pass inserted text as fallback
        // for when proxy is empty (external keyboard context restriction)
        val insertedValue: String = when (key.type.lowercase()) {
            "backspace", "enter", "action", "keyset", "next-keyboard" -> ""
            "space" -> " "
            else -> {
                if (renderer.isShiftActive() && key.sValue.isNotEmpty()) key.sValue
                else key.value
            }
        }
        syncShadowContext(inserted = insertedValue)

        if (renderer.isNikkudTopRowActive) {
            renderer.updateNikkudTopRowModifierStates()
        }
    }

    /** Seed the shadow text buffer from the actual proxy context (call at keyboard load). */
    fun seedShadowContext() {
        val live = textProxy.documentContextBeforeInput ?: ""
        if (live.isNotEmpty()) { shadowTextBefore = live }
    }

    /** Update shadow buffer from live proxy after a native operation.
     * When proxy is empty (external keyboard context), append `inserted` to shadow as fallback. */
    private fun syncShadowContext(inserted: String = "") {
        val live = textProxy.documentContextBeforeInput ?: ""
        if (live.isNotEmpty()) {
            shadowTextBefore = live
        } else if (inserted.isNotEmpty()) {
            shadowTextBefore += inserted
        }
    }

    private fun handleBackspace() {
        // Always attempt deleteBackward — hasText is unreliable when hardware keyboard
        // has typed text (documentContextBeforeInput is empty in that case)
        textProxy.deleteBackward()
        // Try live proxy first; if empty (external kb context), trim shadow manually
        val live = textProxy.documentContextBeforeInput ?: ""
        if (live.isNotEmpty()) {
            shadowTextBefore = live
        } else if (shadowTextBefore.isNotEmpty()) {
            // Remove the last grapheme cluster from shadow to keep it in sync
            shadowTextBefore = shadowTextBefore.dropLast(1)
        }
        if (!suggestionController.handleBackspace()) {
            suggestionController.detectCurrentWord(textProxy.documentContextBeforeInput ?: "")
        }

        if (renderer.isNikkudTopRowActive) {
            renderer.updateNikkudTopRowModifierStates()
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

        // Kotlin equivalent of Swift's defer { autoReturnFromSpecialChars() }
        try {
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
        } finally {
            autoReturnFromSpecialChars()
        }
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

    /**
     * Insert a nikkud combining mark, handling conflicts:
     * - Vowels (U+05B0–U+05BB, U+05C7) are mutually exclusive — replace existing vowel
     * - Dagesh (U+05BC) toggles: if already present remove it, otherwise add it
     * - Shin/sin dots (U+05C1/U+05C2) replace each other
     * Port of ios/Shared/KeyboardEngine.swift insertNikkudMark()
     */
    private fun insertNikkudMark(mark: String) {
        val hebrewVowels: Set<Int> = setOf(
            0x05B0, 0x05B1, 0x05B2, 0x05B3, 0x05B4,
            0x05B5, 0x05B6, 0x05B7, 0x05B8, 0x05B9,
            0x05BA, 0x05BB, 0x05C7
        )
        val dagesh = 0x05BC
        val shinDot = 0x05C1
        val sinDot = 0x05C2

        val incomingScalar = mark.codePoints().toArray().firstOrNull()
        if (incomingScalar == null) {
            textProxy.insertText(mark)
            return
        }
        val inVal = incomingScalar

        // Determine which conflict group this mark belongs to
        val isVowel = hebrewVowels.contains(inVal)
        val isDagesh = inVal == dagesh
        val isShinSin = inVal == shinDot || inVal == sinDot

        if (!isVowel && !isDagesh && !isShinSin) {
            textProxy.insertText(mark)
            return
        }

        val before = textProxy.documentContextBeforeInput
        if (before.isNullOrEmpty()) {
            textProxy.insertText(mark)
            return
        }

        // Get the last grapheme cluster
        val lastCluster = before.takeLast(1)
        val scalars = lastCluster.codePoints().toArray()

        // Find an existing mark in the same conflict group
        val conflictIndex: Int? = when {
            isVowel -> scalars.indices.lastOrNull { hebrewVowels.contains(scalars[it]) }
            isDagesh -> scalars.indices.lastOrNull { scalars[it] == dagesh }
            else -> scalars.indices.lastOrNull { scalars[it] == shinDot || scalars[it] == sinDot }
        }

        if (conflictIndex == null) {
            textProxy.insertText(mark)
            return
        }

        val scalarsAfter = scalars.size - 1 - conflictIndex

        // Delete everything from the existing mark to end of cluster
        repeat(scalarsAfter) { textProxy.deleteBackward() }
        textProxy.deleteBackward() // delete the existing mark

        // Re-insert tail (marks after the conflicting one)
        if (scalarsAfter > 0) {
            val tail = scalars.toList().takeLast(scalarsAfter).map { String(Character.toChars(it)) }.joinToString("")
            textProxy.insertText(tail)
        }

        // For dagesh: if same mark was already there, we removed it — don't re-insert (toggle off)
        val existingVal = scalars[conflictIndex]
        val isSameMark = existingVal == inVal
        if (isDagesh && isSameMark) {
            return // toggled off
        }

        textProxy.insertText(mark)
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
    fun autoReturnFromSpecialChars() {
        val currentKeyset = renderer.currentKeysetId

        // Check if we're on a special characters keyset
        if (currentKeyset == "123" || currentKeyset == "#+=") {
            debugLog("Auto-returning from $currentKeyset to abc")
            renderer.currentKeysetId = "abc"
            onRenderKeyboard?.invoke()
        }
    }

    companion object {
        private const val TAG = "KeyboardEngine"
    }
}
