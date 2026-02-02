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
    
    /** Override this in subclasses to specify the keyboard language */
    abstract val keyboardLanguage: String
    
    /** Override this in subclasses to specify the config file name */
    open val defaultConfigFileName: String = "default_config"
    
    // MARK: - Lifecycle
    
    override fun onCreate() {
        super.onCreate()
        debugLog("🚀 BaseKeyboardService onCreate - Language: $keyboardLanguage")
        
        setupRenderer()
        setupSuggestionController()
    }
    
    override fun onCreateInputView(): View {
        debugLog("🎨 BaseKeyboardService onCreateInputView")
        
        // Create the keyboard container view
        keyboardView = KeyboardContainerView(this).apply {
            // Load preferences and render keyboard
            loadPreferences()
        }
        
        return keyboardView!!
    }
    
    override fun onStartInputView(info: EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        debugLog("📱 onStartInputView - restarting: $restarting")
        
        loadPreferences()
        suggestionController?.detectCurrentWord(currentInputConnection?.getTextBeforeCursor(100, 0)?.toString())
        
        // Update editor context based on EditorInfo
        val editorContext = analyzeEditorContext(info)
        renderKeyboard(editorContext)
    }
    
    override fun onFinishInputView(finishingInput: Boolean) {
        super.onFinishInputView(finishingInput)
        debugLog("📱 onFinishInputView")
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
        
        val container = keyboardView as? android.view.ViewGroup ?: return
        
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
        
        if (suggestionsEnabled && suggestionController?.currentWord?.isEmpty() == true) {
            suggestionController?.showDefaults()
        }
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
        
        return when (inputType and android.text.InputType.TYPE_MASK_CLASS) {
            android.text.InputType.TYPE_CLASS_NUMBER,
            android.text.InputType.TYPE_CLASS_PHONE -> true
            android.text.InputType.TYPE_CLASS_TEXT -> {
                val variation = inputType and android.text.InputType.TYPE_MASK_VARIATION
                when (variation) {
                    android.text.InputType.TYPE_TEXT_VARIATION_URI,
                    android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS,
                    android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD,
                    android.text.InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD,
                    android.text.InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS,
                    android.text.InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD -> true
                    else -> false
                }
            }
            else -> false
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
                val value = key.value
                if (value.isNotEmpty()) {
                    if (value == " ") {
                        handleSpaceKey()
                    } else {
                        ic.commitText(value, 1)
                        suggestionController?.handleCharacterTyped(value)
                    }
                }
            }
        }
    }
    
    private fun handleBackspace() {
        val ic = currentInputConnection ?: return
        ic.deleteSurroundingText(1, 0)
        if (suggestionController?.handleBackspace() != true) {
            suggestionController?.detectCurrentWord(ic.getTextBeforeCursor(100, 0)?.toString())
        }
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
        
        // Get current word BEFORE calling handleSpace (which clears it)
        val wordBeforeSpace = suggestionController?.currentWord ?: ""
        
        // Check for fuzzy auto-replace
        val replacement = suggestionController?.handleSpace()
        if (replacement != null && wordBeforeSpace.isNotEmpty()) {
            // Delete the original typed word and insert the replacement
            ic.deleteSurroundingText(wordBeforeSpace.length, 0)
            ic.commitText("$replacement ", 1)
            lastSpaceTime = now
            return
        }
        
        // Double-space shortcut for period
        if (now - lastSpaceTime < doubleSpaceThreshold) {
            val beforeText = ic.getTextBeforeCursor(2, 0)?.toString()
            if (beforeText?.endsWith(" ") == true) {
                val textBeforeSpace = beforeText.dropLast(1)
                val charBeforeSpace = textBeforeSpace.lastOrNull()
                
                if (charBeforeSpace != null && charBeforeSpace != ' ' && charBeforeSpace != '.') {
                    ic.deleteSurroundingText(1, 0)
                    ic.commitText(". ", 1)
                    lastSpaceTime = 0
                    return
                }
            }
        }
        
        ic.commitText(" ", 1)
        lastSpaceTime = now
    }
    
    // MARK: - Input Method Switching
    
    private fun switchToNextInputMethod() {
        try {
            // Try modern API first (API 28+)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                switchToNextInputMethod(false)
            } else {
                // Fallback for older devices
                @Suppress("DEPRECATION")
                val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager
                val token = window?.window?.attributes?.token
                if (token != null) {
                    @Suppress("DEPRECATION")
                    imm.switchToNextInputMethod(token, false)
                }
            }
        } catch (e: Exception) {
            errorLog("Failed to switch input method: ${e.message}")
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
 * This will be replaced with actual rendering from KeyboardRenderer
 */
class KeyboardContainerView(context: Context) : android.widget.FrameLayout(context) {
    init {
        // Set minimum height for keyboard
        minimumHeight = (216 * context.resources.displayMetrics.density).toInt()
    }
}