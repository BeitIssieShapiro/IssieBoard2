package com.issieboardng.shared

import android.content.Context
import android.content.Intent
import android.inputmethodservice.InputMethodService
import android.net.Uri
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader

/**
 * Base Android Keyboard Service
 * Port of ios/Shared/BaseKeyboardViewController.swift
 * 
 * Shared keyboard service that handles system keyboard integration.
 * Each language-specific keyboard service inherits from this class.
 * Routes key presses to the system input connection.
 */
abstract class BaseKeyboardService : InputMethodService() {
    
    // MARK: - Properties
    
    private var keyboardView: View? = null
    private val preferences by lazy { KeyboardPreferences(this) }
    
    // Keyboard renderer - handles all UI rendering and keyboard state
    private var renderer: KeyboardRenderer? = null
    private var parsedConfig: KeyboardConfig? = null
    
    // Word suggestion controller - handles all word completion logic
    private var suggestionController: WordSuggestionController? = null
    
    // Double-space shortcut (". " instead of "  ")
    private var lastSpaceTime: Long = 0
    private val doubleSpaceThreshold: Long = 2000  // milliseconds
    
    // Track if backspace is currently being pressed (to avoid re-render during touch)
    private var isBackspaceActive: Boolean = false
    
    /** Override this in subclasses to specify the keyboard language */
    abstract val keyboardLanguage: String
    
    /** Override this in subclasses to specify the config file name */
    open val defaultConfigFileName: String = "default_config"
    
    // MARK: - Lifecycle
    
    override fun onCreate() {
        super.onCreate()
        alwaysLog("🚀 BaseKeyboardService onCreate - Language: $keyboardLanguage")
        
        setupRenderer()
        setupSuggestionController()
    }
    
    override fun onCreateInputView(): View {
        alwaysLog("🎨 BaseKeyboardService onCreateInputView - starting")
        
        // Create the keyboard container view
        keyboardView = KeyboardContainerView(this)
        
        alwaysLog("🎨 BaseKeyboardService onCreateInputView - created view: ${keyboardView != null}")
        
        // Load config and render SYNCHRONOUSLY before returning (like old SimpleKeyboardService)
        loadPreferences()
        renderKeyboard(null)
        
        return keyboardView!!
    }
    
    override fun onEvaluateInputViewShown(): Boolean {
        super.onEvaluateInputViewShown()
        return true  // Always show the keyboard view
    }
    
    override fun onStartInputView(info: EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        alwaysLog("📱 onStartInputView - restarting: $restarting, keyboardView: ${keyboardView != null}")
        
        // Ensure we have a keyboard view - create if needed
        if (keyboardView == null) {
            alwaysLog("📱 onStartInputView - creating keyboard view")
            keyboardView = KeyboardContainerView(this)
            setInputView(keyboardView)
        }
        
        loadPreferences()
        suggestionController?.detectCurrentWord(currentInputConnection?.getTextBeforeCursor(100, 0)?.toString())
        
        // Apply auto-shift if at beginning of sentence
        autoShiftAfterPunctuation()
        
        // Update editor context based on EditorInfo
        val editorContext = analyzeEditorContext(info)
        renderKeyboard(editorContext)
    }
    
    override fun onShowInputRequested(flags: Int, configChange: Boolean): Boolean {
        alwaysLog("📱 onShowInputRequested - flags: $flags, configChange: $configChange, keyboardView: ${keyboardView != null}")
        
        // Do NOT create views here - that happens in onCreateInputView()
        // Just return true to indicate we want to show the keyboard
        return true
    }
    
    override fun onFinishInputView(finishingInput: Boolean) {
        super.onFinishInputView(finishingInput)
        debugLog("📱 onFinishInputView")
    }
    
    override fun onWindowShown() {
        super.onWindowShown()
        alwaysLog("📱 onWindowShown called - now rendering keyboard")
        loadPreferences()
        val editorContext = analyzeEditorContext(currentInputEditorInfo)
        renderKeyboard(editorContext)
    }
    
    override fun onDestroy() {
        super.onDestroy()
        debugLog("📱 BaseKeyboardService onDestroy")
    }
    
    // MARK: - Setup
    
    private fun setupRenderer() {
        renderer = KeyboardRenderer(this).apply {
            onKeysetChanged = { keysetId ->
                saveCurrentKeyset(keysetId)
            }
            
            onKeyPress = { key ->
                handleKeyPress(key)
            }
            
            onDeleteCharacter = {
                handleBackspace()
            }
            
            onDeleteWord = {
                handleDeleteWord()
            }
            
            onNikkudSelected = { value ->
                currentInputConnection?.commitText(value, 1)
                suggestionController?.handleSpace()
            }
            
            onSuggestionSelected = { suggestion ->
                handleSuggestionSelected(suggestion)
            }
            
            onNextKeyboard = {
                switchToNextInputMethod()
            }
            
            onDismissKeyboard = {
                requestHideSelf(0)
            }
            
            onOpenSettings = {
                openSettings()
            }
            
            onBackspaceTouchBegan = {
                isBackspaceActive = true
            }
            
            onBackspaceTouchEnded = {
                isBackspaceActive = false
                // Render now if shift state needs updating
                autoShiftAfterPunctuation()
            }
            
            onCursorMove = { offset ->
                handleCursorMove(offset)
            }
            
            onGetTextDirection = {
                getTextDirectionAtCursor()
            }
        }
    }
    
    private fun setupSuggestionController() {
        suggestionController = WordSuggestionController(renderer).apply {
            initialize(this@BaseKeyboardService)
            setLanguage(keyboardLanguage)
        }
    }
    
    // MARK: - Preferences
    
    private fun loadPreferences() {
        preferences.printAllPreferences()
        
        val configKey = "keyboardConfig_$keyboardLanguage"
        val configJSON = preferences.getString(configKey)
        
        if (!configJSON.isNullOrEmpty()) {
            parseKeyboardConfig(configJSON)
        } else {
            val fallbackConfigJSON = preferences.getKeyboardConfigJSON()
            if (!fallbackConfigJSON.isNullOrEmpty()) {
                parseKeyboardConfig(fallbackConfigJSON)
            } else {
                loadBundledDefaultConfig()
            }
        }
    }
    
    private fun loadBundledDefaultConfig() {
        try {
            val inputStream = assets.open("$defaultConfigFileName.json")
            val reader = BufferedReader(InputStreamReader(inputStream))
            val configJSON = reader.readText()
            reader.close()
            parseKeyboardConfig(configJSON)
        } catch (e: Exception) {
            errorLog("Failed to load bundled config: ${e.message}")
            renderFallbackKeyboard()
        }
    }
    
    private fun parseKeyboardConfig(jsonString: String) {
        try {
            parsedConfig = KeyboardConfigParser.parse(jsonString)
            renderKeyboard(null)
        } catch (e: Exception) {
            errorLog("Failed to parse config: ${e.message}")
            renderFallbackKeyboard()
        }
    }
    
    private fun saveCurrentKeyset(keysetId: String) {
        preferences.selectedLanguage = keysetId
    }
    
    private fun loadSavedKeyset(): String? {
        val savedKeyset = preferences.selectedLanguage
        if (savedKeyset.isNullOrEmpty()) {
            return null
        }
        val config = parsedConfig ?: return null
        if (config.keysets.none { it.id == savedKeyset }) {
            return null
        }
        return savedKeyset
    }
    
    // MARK: - Rendering
    
    private fun renderKeyboard(editorContext: EditorContext?) {
        val config = parsedConfig ?: run {
            renderFallbackKeyboard()
            return
        }
        
        val container = keyboardView as? android.view.ViewGroup
        if (container == null) {
            alwaysLog("⚠️ renderKeyboard: container is null!")
            return
        }
        
        // Log container state
        alwaysLog("📐 renderKeyboard: container width=${container.width}, height=${container.height}, visibility=${container.visibility}, isAttached=${container.isAttachedToWindow}")
        
        // Configure suggestion controller based on config and input type
        val shouldDisable = shouldDisableSuggestionsForInputType()
        val suggestionsEnabled = config.isWordSuggestionsEnabled && !shouldDisable
        
        suggestionController?.setEnabled(suggestionsEnabled)
        suggestionController?.setAutoCorrectEnabled(config.isAutoCorrectEnabled)
        suggestionController?.setLanguage(keyboardLanguage)
        
        renderer?.setWordSuggestionsEnabled(suggestionsEnabled)
        
        var initialKeyset: String
        val currentKeysetId = renderer?.currentKeysetId ?: ""
        if (currentKeysetId.isNotEmpty() && currentKeysetId != "abc") {
            initialKeyset = currentKeysetId
        } else {
            initialKeyset = loadSavedKeyset() ?: config.defaultKeyset ?: "abc"
        }
        
        renderer?.renderKeyboard(
            container = container,
            config = config,
            currentKeysetId = initialKeyset,
            editorContext = editorContext
        )
        
        // Show default suggestions only if enabled for this field type
        if (suggestionsEnabled && suggestionController?.currentWord?.isEmpty() == true) {
            suggestionController?.showDefaults()
        }
        
        // Force a layout pass after rendering
        container.requestLayout()
        container.invalidate()
    }
    
    private fun renderFallbackKeyboard() {
        debugLog("⚠️ Rendering fallback keyboard")
        // TODO: Implement fallback keyboard UI
    }
    
    // MARK: - Editor Context
    
    private fun analyzeEditorContext(info: EditorInfo?): EditorContext {
        val imeOptions = info?.imeOptions ?: 0
        val actionId = imeOptions and EditorInfo.IME_MASK_ACTION
        
        val enterLabel = when (actionId) {
            EditorInfo.IME_ACTION_SEARCH -> "Search"
            EditorInfo.IME_ACTION_GO -> "Go"
            EditorInfo.IME_ACTION_SEND -> "Send"
            EditorInfo.IME_ACTION_NEXT -> "Next"
            EditorInfo.IME_ACTION_DONE -> "Done"
            EditorInfo.IME_ACTION_PREVIOUS -> "Previous"
            else -> "↵"
        }
        
        return EditorContext(
            enterVisible = true,
            enterLabel = enterLabel,
            enterAction = actionId
        )
    }
    
    private fun shouldDisableSuggestionsForInputType(): Boolean {
        val editorInfo = currentInputEditorInfo ?: return false
        val inputType = editorInfo.inputType
        
        debugLog("🔍 Input type detected: $inputType (class: ${inputType and android.text.InputType.TYPE_MASK_CLASS})")
        
        return when (inputType and android.text.InputType.TYPE_MASK_CLASS) {
            android.text.InputType.TYPE_CLASS_NUMBER,
            android.text.InputType.TYPE_CLASS_PHONE -> {
                debugLog("🔍 Should disable suggestions: true (number/phone)")
                true
            }
            android.text.InputType.TYPE_CLASS_TEXT -> {
                val variation = inputType and android.text.InputType.TYPE_MASK_VARIATION
                debugLog("🔍 Text variation: $variation")
                when (variation) {
                    android.text.InputType.TYPE_TEXT_VARIATION_URI,
                    android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS,
                    android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD,
                    android.text.InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD,
                    android.text.InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS,
                    android.text.InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD -> {
                        debugLog("🔍 Should disable suggestions: true (URL/email/password)")
                        true
                    }
                    else -> {
                        debugLog("🔍 Should disable suggestions: false")
                        false
                    }
                }
            }
            else -> {
                debugLog("🔍 Should disable suggestions: false (other class)")
                false
            }
        }
    }
    
    // MARK: - Key Press Handling
    
    private fun handleKeyPress(key: ParsedKey) {
        val ic = currentInputConnection ?: return
        
        when (key.type.lowercase()) {
            "backspace" -> handleBackspace()
            
            "enter", "action" -> {
                // Check if we should perform an action or just insert newline
                val editorInfo = currentInputEditorInfo
                if (editorInfo != null) {
                    val imeOptions = editorInfo.imeOptions
                    val actionId = imeOptions and EditorInfo.IME_MASK_ACTION
                    if (actionId != EditorInfo.IME_ACTION_NONE && 
                        actionId != EditorInfo.IME_ACTION_UNSPECIFIED) {
                        ic.performEditorAction(actionId)
                    } else {
                        ic.commitText("\n", 1)
                    }
                } else {
                    ic.commitText("\n", 1)
                }
                suggestionController?.handleEnter()
            }
            
            "space" -> handleSpaceKey()
            
            "keyset" -> {
                // Keyset switching is handled internally by renderer
            }
            
            "next-keyboard" -> {
                switchToNextInputMethod()
            }
            
            else -> {
                // Determine which value to use based on shift state
                val valueToInsert: String = if (renderer?.isShiftActive() == true && key.sValue.isNotEmpty()) {
                    // Use shift value (uppercase) when shift is active
                    key.sValue
                } else {
                    // Use normal value (lowercase)
                    key.value
                }
                
                if (valueToInsert.isNotEmpty()) {
                    if (valueToInsert == " ") {
                        handleSpaceKey()
                    } else {
                        ic.commitText(valueToInsert, 1)
                        suggestionController?.handleCharacterTyped(valueToInsert)
                    }
                }
            }
        }
    }
    
    private fun handleBackspace() {
        val ic = currentInputConnection ?: return
        
        // Check if text is already empty before deleting
        val beforeText = ic.getTextBeforeCursor(100, 0)?.toString() ?: ""
        if (beforeText.isEmpty()) {
            // Nothing to delete - this can happen if backspace timer keeps firing
            // Just return without doing anything
            return
        }
        
        ic.deleteSurroundingText(1, 0)
        if (suggestionController?.handleBackspace() != true) {
            suggestionController?.detectCurrentWord(ic.getTextBeforeCursor(100, 0)?.toString())
        }
        
        // Always call auto-shift after backspace to update shift state
        // Don't call during long-press (isBackspaceActive will defer the render)
        autoShiftAfterPunctuation()
    }
    
    private fun handleDeleteWord() {
        val ic = currentInputConnection ?: return
        val beforeText = ic.getTextBeforeCursor(100, 0)?.toString()
        
        if (beforeText.isNullOrEmpty()) {
            ic.deleteSurroundingText(1, 0)
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
            ic.deleteSurroundingText(charsToDelete, 0)
        } else {
            ic.deleteSurroundingText(1, 0)
        }
        
        suggestionController?.detectCurrentWord(ic.getTextBeforeCursor(100, 0)?.toString())
    }
    
    private fun handleSuggestionSelected(suggestion: String) {
        val ic = currentInputConnection ?: return
        val currentWord = suggestionController?.currentWord ?: ""
        
        // Delete the current word
        ic.deleteSurroundingText(currentWord.length, 0)
        
        // Insert suggestion with space
        ic.commitText("$suggestion ", 1)
        
        suggestionController?.handleSuggestionSelected()
    }
    
    private fun handleSpaceKey() {
        val ic = currentInputConnection ?: return
        val now = System.currentTimeMillis()
        
        // Check for auto-capitalize "i" to "I"
        val beforeText = ic.getTextBeforeCursor(10, 0)?.toString()
        if (beforeText?.endsWith("i") == true) {
            // Check if "i" is standalone (preceded by space or nothing)
            val textBeforeI = beforeText.dropLast(1)
            if (textBeforeI.isEmpty() || textBeforeI.last().isWhitespace()) {
                // Replace "i" with "I"
                ic.deleteSurroundingText(1, 0)
                ic.commitText("I ", 1)
                lastSpaceTime = now
                suggestionController?.handleSpace()
                
                // Auto-return from special chars
                autoReturnFromSpecialChars()
                return
            }
        }
        
        // Get current word BEFORE calling handleSpace (which clears it)
        val wordBeforeSpace = suggestionController?.currentWord ?: ""
        
        // Check for fuzzy auto-replace
        val replacement = suggestionController?.handleSpace()
        if (replacement != null && wordBeforeSpace.isNotEmpty()) {
            // Delete the original typed word and insert the replacement
            ic.deleteSurroundingText(wordBeforeSpace.length, 0)
            ic.commitText("$replacement ", 1)
            lastSpaceTime = now
            
            // Auto-return from special chars (behavior 2)
            autoReturnFromSpecialChars()
            return
        }
        
        // Double-space shortcut for period
        if (now - lastSpaceTime < doubleSpaceThreshold) {
            val beforeText2 = ic.getTextBeforeCursor(2, 0)?.toString()
            if (beforeText2?.endsWith(" ") == true) {
                val textBeforeSpace = beforeText2.dropLast(1)
                val charBeforeSpace = textBeforeSpace.lastOrNull()
                
                if (charBeforeSpace != null && charBeforeSpace != ' ' && charBeforeSpace != '.') {
                    ic.deleteSurroundingText(1, 0)
                    ic.commitText(". ", 1)
                    lastSpaceTime = 0
                    suggestionController?.handleSpace()
                    
                    // Auto-shift after ". " (behavior 3)
                    autoShiftAfterPunctuation()
                    return
                }
            }
        }
        
        ic.commitText(" ", 1)
        lastSpaceTime = now
        suggestionController?.handleSpace()
        
        // Auto-return from special chars
        autoReturnFromSpecialChars()
        
        // Auto-shift after ". " or empty text
        autoShiftAfterPunctuation()
    }
    
    // MARK: - Auto Behaviors
    
    /**
     * Auto-return from special characters keyboard (123/#+=) to main keyboard (abc) after space
     * Behavior 2: If user is on 123 or #+= keyboard, return to abc after typing special char + space
     */
    private fun autoReturnFromSpecialChars() {
        val currentKeyset = renderer?.currentKeysetId ?: return
        
        // Check if we're on a special characters keyset (123 or #+=)
        if (currentKeyset == "123" || currentKeyset == "#+=") {
            // Switch back to abc keyset
            val config = parsedConfig ?: return
            if (config.keysets.any { it.id == "abc" }) {
                debugLog("🔄 Auto-returning from $currentKeyset to abc")
                renderer?.currentKeysetId = "abc"
                renderKeyboard(null)
            }
        }
    }
    
    /**
     * Auto-shift after punctuation or when text is empty
     * Behavior 3: For English keyboard only, activate shift after ". " or when text is empty
     */
    private fun autoShiftAfterPunctuation() {
        debugLog("🔍 autoShiftAfterPunctuation called")
        
        // Only apply to English keyboard
        if (keyboardLanguage != "en") {
            debugLog("  ❌ Not English keyboard ($keyboardLanguage), skipping")
            return
        }
        debugLog("  ✅ English keyboard")
        
        val isShiftActive = renderer?.isShiftActive() ?: false
        debugLog("  Shift active: $isShiftActive")
        
        val ic = currentInputConnection ?: return
        val beforeText = ic.getTextBeforeCursor(100, 0)?.toString() ?: ""
        debugLog("  Text before cursor: '${beforeText.takeLast(20)}'")
        
        // Check if text is empty
        if (beforeText.isEmpty()) {
            debugLog("  Should activate shift: true (empty text)")
            debugLog("  ⇧ AUTO-ACTIVATING SHIFT!")
            renderer?.activateShift()
            renderKeyboard(null)
            return
        }
        
        // Check if ends with sentence-ending punctuation followed by space(s)
        // Trim trailing whitespace to find the last non-space character
        val trimmed = beforeText.trimEnd()
        val endsWithSpace = beforeText.lastOrNull()?.isWhitespace() == true
        val endsWithPunctuation = trimmed.lastOrNull() in listOf('.', '?', '!')
        val endsWithNewline = beforeText.endsWith("\n")
        
        val shouldActivateShift = (endsWithPunctuation && endsWithSpace) || endsWithNewline
        
        debugLog("  Trimmed text ends with: '${trimmed.lastOrNull()}'")
        debugLog("  Ends with space: $endsWithSpace")
        debugLog("  Ends with punctuation: $endsWithPunctuation")
        debugLog("  Should activate shift: $shouldActivateShift")
        
        if (shouldActivateShift && !isShiftActive) {
            debugLog("  ⇧ AUTO-ACTIVATING SHIFT!")
            debugLog("  🎯 BEFORE activateShift: isShiftActive = $isShiftActive")
            val wasInactive = !isShiftActive
            renderer?.activateShift()
            val newIsShiftActive = renderer?.isShiftActive() ?: false
            debugLog("  🎯 AFTER activateShift: isShiftActive = $newIsShiftActive")
            // Only re-render if shift state actually changed from inactive to active
            // AND backspace is not currently active (to avoid re-render during backspace touch)
            if (wasInactive && newIsShiftActive) {
                if (isBackspaceActive) {
                    debugLog("  ⏸️ Backspace active, deferring render until touch ends")
                } else {
                    renderKeyboard(null)
                    debugLog("  🎯 AFTER renderKeyboard")
                }
            } else {
                debugLog("  🎯 Shift was already active, skipping render to avoid loop")
            }
        } else if (!shouldActivateShift && isShiftActive) {
            // Deactivate shift if conditions don't require it
            renderer?.deactivateShift()
            if (!isBackspaceActive) {
                renderKeyboard(null)
            }
            debugLog("  ⇧ Deactivating shift as should be inactive and is active")
        } else {
            debugLog("  ✅ Desired state and active state match - do nothing")
        }
    }
    
    // MARK: - Input Method Switching
    
    private fun switchToNextInputMethod() {
        alwaysLog("🌐 switchToNextInputMethod called")
        try {
            val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager
            
            // First, check if we should offer switching
            val shouldOffer = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                shouldOfferSwitchingToNextInputMethod()
            } else {
                true  // Assume yes for older devices
            }
            
            alwaysLog("🌐 shouldOfferSwitching: $shouldOffer")
            
            if (shouldOffer) {
                // Try to switch to next input method
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                    alwaysLog("🌐 Using API 28+ switchToNextInputMethod")
                    val switched = switchToNextInputMethod(false)
                    alwaysLog("🌐 switchToNextInputMethod returned: $switched")
                    if (!switched) {
                        // If switching failed, show the input method picker
                        alwaysLog("🌐 Showing input method picker as fallback")
                        imm.showInputMethodPicker()
                    }
                } else {
                    // Fallback for older devices
                    alwaysLog("🌐 Using legacy InputMethodManager")
                    val token = window?.window?.attributes?.token
                    if (token != null) {
                        @Suppress("DEPRECATION")
                        val switched = imm.switchToNextInputMethod(token, false)
                        alwaysLog("🌐 legacy switchToNextInputMethod returned: $switched")
                        if (!switched) {
                            imm.showInputMethodPicker()
                        }
                    } else {
                        alwaysLog("🌐 Token is null, showing picker instead")
                        imm.showInputMethodPicker()
                    }
                }
            } else {
                // Show input method picker if we shouldn't offer switching
                alwaysLog("🌐 Showing input method picker (no next keyboard)")
                imm.showInputMethodPicker()
            }
        } catch (e: Exception) {
            errorLog("Failed to switch input method: ${e.message}")
            e.printStackTrace()
            // Final fallback - show the picker
            try {
                val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager
                imm.showInputMethodPicker()
            } catch (e2: Exception) {
                errorLog("Failed to show input method picker: ${e2.message}")
            }
        }
    }
    
    // MARK: - Cursor Movement
    
    private fun handleCursorMove(offset: Int) {
        currentInputConnection?.setSelection(
            currentInputConnection?.getTextBeforeCursor(1000, 0)?.length?.plus(offset) ?: offset,
            currentInputConnection?.getTextBeforeCursor(1000, 0)?.length?.plus(offset) ?: offset
        )
        debugLog("🔄 Cursor moved by $offset characters")
    }
    
    /**
     * Detect the actual text direction at the cursor position
     * Returns true if RTL (Hebrew/Arabic), false if LTR (English/numbers)
     * This analyzes the actual text rather than just keyboard language
     */
    private fun getTextDirectionAtCursor(): Boolean {
        // Get text before cursor
        val ic = currentInputConnection ?: return keyboardLanguage == "he" || keyboardLanguage == "ar"
        val beforeText = ic.getTextBeforeCursor(100, 0)?.toString()
        
        if (beforeText.isNullOrEmpty()) {
            // No text - fall back to keyboard language
            return keyboardLanguage == "he" || keyboardLanguage == "ar"
        }
        
        // Check the last character before cursor
        val lastChar = beforeText.lastOrNull() ?: return keyboardLanguage == "he" || keyboardLanguage == "ar"
        
        // Hebrew Unicode range: U+0590 to U+05FF
        // Arabic Unicode range: U+0600 to U+06FF
        val unicodeValue = lastChar.code
        
        return when {
            unicodeValue in 0x0590..0x05FF -> true  // Hebrew
            unicodeValue in 0x0600..0x06FF -> true  // Arabic
            lastChar.isLetter() || lastChar.isDigit() -> false  // LTR
            else -> keyboardLanguage == "he" || keyboardLanguage == "ar"  // Fall back to keyboard language
        }
    }
    
    // MARK: - Settings
    
    private fun openSettings() {
        // Check if we have the necessary permission
        preferences.setString(keyboardLanguage, "launch_keyboard")
        
        try {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("issieboard://settings?keyboard=$keyboardLanguage")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            startActivity(intent)
            
            // Dismiss keyboard after a short delay
            android.os.Handler(mainLooper).postDelayed({
                requestHideSelf(0)
            }, 300)
        } catch (e: Exception) {
            errorLog("Failed to open settings: ${e.message}")
        }
    }
}

/**
 * Editor context information
 * Port of iOS editorContext tuple
 */
data class EditorContext(
    val enterVisible: Boolean,
    val enterLabel: String,
    val enterAction: Int
)

/**
 * Simple keyboard container view
 * Uses WRAP_CONTENT like the old SimpleKeyboardService that worked
 */
class KeyboardContainerView(context: Context) : android.widget.LinearLayout(context) {
    
    init {
        orientation = VERTICAL
        
        // Use WRAP_CONTENT like the old working SimpleKeyboardService
        layoutParams = android.view.ViewGroup.LayoutParams(
            android.view.ViewGroup.LayoutParams.MATCH_PARENT,
            android.view.ViewGroup.LayoutParams.WRAP_CONTENT
        )
        
        // Set background color so keyboard area is visible
        setBackgroundColor(android.graphics.Color.parseColor("#D2D3D9"))
        
        // Handle navigation bar insets for modern Android versions
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            setOnApplyWindowInsetsListener { view, insets ->
                val navInsets = insets.getInsets(android.view.WindowInsets.Type.navigationBars())
                view.setPadding(0, 0, 0, navInsets.bottom)
                insets
            }
        } else {
            fitsSystemWindows = true
        }
        
        // Log for debugging
        alwaysLog("📱 KeyboardContainerView created with WRAP_CONTENT height and insets handling")
    }
}
