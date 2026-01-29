package com.issieboardng

import android.inputmethodservice.InputMethodService
import android.view.View
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.HorizontalScrollView
import android.view.ViewGroup.LayoutParams
import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import android.os.Build
import android.view.WindowInsets
import android.view.inputmethod.EditorInfo
import android.text.InputType
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.util.TypedValue

/**
 * Android Input Method Service for IssieBoard keyboard
 * 
 * This is a clean implementation that delegates all rendering and state management
 * to KeyboardRenderer. This service only handles:
 * - IME lifecycle
 * - Config loading from SharedPreferences
 * - Dispatching key events (text input, backspace, enter, etc.)
 * - System actions (settings, close, next keyboard)
 */
class SimpleKeyboardService : InputMethodService(), SharedPreferences.OnSharedPreferenceChangeListener {

    companion object {
        private const val TAG = "SimpleKeyboardService"
        private const val PREFS_FILE = "keyboard_data"
        private const val CONFIG_KEY = "config_json"
    }

    // Main layout container
    private var mainLayout: LinearLayout? = null
    
    // Suggestions bar
    private var suggestionsBar: LinearLayout? = null
    
    // Shared components
    private lateinit var renderer: KeyboardRenderer
    private lateinit var configParser: KeyboardConfigParser
    private lateinit var wordCompletionManager: WordCompletionManager
    
    // Word completion state
    private var wordSuggestionsEnabled: Boolean = true
    private var currentWord: StringBuilder = StringBuilder()
    private var currentLanguage: String = "en"

    // ============================================================================
    // LIFECYCLE
    // ============================================================================

    override fun onCreate() {
        super.onCreate()
        val prefs = getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE)
        prefs.registerOnSharedPreferenceChangeListener(this)
    }

    override fun onDestroy() {
        super.onDestroy()
        val prefs = getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE)
        prefs.unregisterOnSharedPreferenceChangeListener(this)
    }

    override fun onCreateInputView(): View {
        mainLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
        }

        // Handle navigation bar overlap for modern Android versions
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            mainLayout?.setOnApplyWindowInsetsListener { view, insets ->
                val navInsets = insets.getInsets(WindowInsets.Type.navigationBars())
                view.setPadding(0, 0, 0, navInsets.bottom)
                insets
            }
        } else {
            mainLayout?.fitsSystemWindows = true
        }

        // Initialize shared components
        configParser = KeyboardConfigParser(this)
        wordCompletionManager = WordCompletionManager.getInstance(this)
        renderer = KeyboardRenderer(
            context = this,
            isPreview = false,
            onKeyEvent = { event -> handleKeyEvent(event) }
        )

        // Load config and render
        loadConfig()
        renderKeyboard()
        
        return mainLayout!!
    }

    override fun onSharedPreferenceChanged(sharedPreferences: SharedPreferences?, key: String?) {
        if (key == CONFIG_KEY) {
            loadConfig()
            mainLayout?.post { renderKeyboard() }
        }
    }
    
    override fun onEvaluateInputViewShown(): Boolean {
        super.onEvaluateInputViewShown()
        return true
    }
    
    override fun onStartInputView(info: EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        // Re-render keyboard when switching to a new input field
        // This ensures the enter key label and behavior updates appropriately
        mainLayout?.post { renderKeyboard() }
    }

    // ============================================================================
    // CONFIG MANAGEMENT
    // ============================================================================
    
    private fun loadConfig() {
        val config = configParser.loadAndParseConfig()
        if (config != null) {
            renderer.setConfig(config)
            
            // Update word suggestions state from config
            wordSuggestionsEnabled = config.wordSuggestionsEnabled
            Log.d(TAG, "📝 Word suggestions enabled: $wordSuggestionsEnabled")
            
            // Initialize word completion if enabled
            if (wordSuggestionsEnabled) {
                // Detect language from default keyset
                val defaultKeysetId = config.defaultKeysetId
                currentLanguage = detectLanguageFromKeyset(defaultKeysetId)
                Log.d(TAG, "📝 Setting initial language to: $currentLanguage (from keyset: $defaultKeysetId)")
                wordCompletionManager.setLanguage(currentLanguage)
            } else {
                // Clear word state if disabled
                currentWord.clear()
            }
        } else {
            Log.e(TAG, "Failed to load config")
        }
    }
    
    /**
     * Detect language code from a keyset ID
     */
    private fun detectLanguageFromKeyset(keysetId: String): String {
        return when {
            keysetId.startsWith("he") || keysetId.contains("hebrew") -> "he"
            keysetId.startsWith("ar") || keysetId.contains("arabic") -> "ar"
            else -> "en"
        }
    }

    // ============================================================================
    // RENDERING
    // ============================================================================

    private fun renderKeyboard() {
        val layout = mainLayout ?: return
        
        // Clear existing views
        layout.removeAllViews()
        
        // Add suggestions bar at the top if enabled
        if (wordSuggestionsEnabled) {
            suggestionsBar = createSuggestionsBar()
            layout.addView(suggestionsBar)
            updateSuggestionsBar()
        } else {
            suggestionsBar = null
        }
        
        // Create a container for the keyboard rows
        val keyboardContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
        }
        layout.addView(keyboardContainer)
        
        // Get editor context for dynamic key behavior
        val editorContext = analyzeEditorInfo()
        
        // Render using the shared renderer
        renderer.renderKeyboard(keyboardContainer, editorContext)
    }
    
    // ============================================================================
    // SUGGESTIONS BAR
    // ============================================================================
    
    private fun createSuggestionsBar(): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, dpToPx(44))
            setBackgroundColor(Color.parseColor("#E8E8E8"))
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dpToPx(4), 0, dpToPx(4), 0)
        }
    }
    
    private fun updateSuggestionsBar() {
        val bar = suggestionsBar ?: return
        bar.removeAllViews()
        
        if (!wordSuggestionsEnabled || currentWord.isEmpty()) {
            return
        }
        
        val suggestions = wordCompletionManager.getSuggestions(currentWord.toString())
        if (suggestions.isEmpty()) {
            return
        }
        
        Log.d(TAG, "📝 Displaying ${suggestions.size} suggestions for '${currentWord}'")
        
        val suggestionCount = minOf(suggestions.size, 4)
        
        for ((index, suggestion) in suggestions.take(4).withIndex()) {
            // Create suggestion text view
            val textView = TextView(this).apply {
                text = suggestion
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
                setTextColor(Color.DKGRAY)
                gravity = Gravity.CENTER
                layoutParams = LinearLayout.LayoutParams(0, LayoutParams.MATCH_PARENT, 1f)
                setPadding(dpToPx(8), 0, dpToPx(8), 0)
                isClickable = true
                isFocusable = true
                
                // Handle click
                setOnClickListener {
                    handleSuggestionSelected(suggestion)
                }
            }
            bar.addView(textView)
            
            // Add divider (except after last item)
            if (index < suggestionCount - 1) {
                val divider = View(this).apply {
                    layoutParams = LinearLayout.LayoutParams(dpToPx(1), LayoutParams.MATCH_PARENT).apply {
                        setMargins(0, dpToPx(8), 0, dpToPx(8))
                    }
                    setBackgroundColor(Color.parseColor("#C0C0C0"))
                }
                bar.addView(divider)
            }
        }
    }
    
    private fun handleSuggestionSelected(suggestion: String) {
        Log.d(TAG, "📝 Suggestion selected: '$suggestion', current word: '$currentWord'")
        
        val ic = currentInputConnection ?: return
        
        // Begin batch edit for atomic operation
        ic.beginBatchEdit()
        
        // Delete the current word
        val wordLength = currentWord.length
        ic.deleteSurroundingText(wordLength, 0)
        
        // Finish any composing text first
        ic.finishComposingText()
        
        // Insert the suggestion followed by a space
        val textWithSpace = suggestion + " "
        Log.d(TAG, "📝 Inserting text: '$textWithSpace' (length: ${textWithSpace.length})")
        ic.commitText(textWithSpace, 1)
        
        // End batch edit
        ic.endBatchEdit()
        
        // Clear current word and suggestions
        currentWord.clear()
        updateSuggestionsBar()
    }
    
    private fun dpToPx(dp: Int): Int {
        return (dp * resources.displayMetrics.density).toInt()
    }
    
    // ============================================================================
    // EDITOR CONTEXT ANALYSIS
    // ============================================================================
    
    private fun analyzeEditorInfo(): EditorContext {
        val editorInfo = currentInputEditorInfo
        val imeOptions = editorInfo?.imeOptions ?: 0
        val inputType = editorInfo?.inputType ?: 0
        
        // Check if multiline input (enter should insert newline)
        val isMultiline = (inputType and InputType.TYPE_TEXT_FLAG_MULTI_LINE) != 0
        
        // Get the action from IME options
        val action = imeOptions and EditorInfo.IME_MASK_ACTION
        
        // Check if enter action is disabled
        val actionDisabled = (imeOptions and EditorInfo.IME_FLAG_NO_ENTER_ACTION) != 0
        
        // Determine visibility and enablement
        val enterVisible = when {
            action == EditorInfo.IME_ACTION_NONE && !isMultiline -> false
            else -> true
        }
        
        // Always enable enter for critical actions (like URL navigation)
        // regardless of the NO_ENTER_ACTION flag
        val enterEnabled = when {
            // Critical actions should always be enabled
            action == EditorInfo.IME_ACTION_GO -> true
            action == EditorInfo.IME_ACTION_SEARCH -> true
            action == EditorInfo.IME_ACTION_SEND -> true
            // For multiline, enter is for newlines, always enabled
            isMultiline -> true
            // For other actions, respect the disabled flag
            else -> !actionDisabled
        }
        
        // Get the action label
        val enterLabel = when {
            !enterVisible -> ""
            editorInfo?.actionLabel != null -> editorInfo.actionLabel.toString()
            isMultiline -> "↵"
            else -> when (action) {
                EditorInfo.IME_ACTION_SEARCH -> "Search"
                EditorInfo.IME_ACTION_SEND -> "Send"
                EditorInfo.IME_ACTION_GO -> "Go"
                EditorInfo.IME_ACTION_NEXT -> "Next"
                EditorInfo.IME_ACTION_DONE -> "Done"
                EditorInfo.IME_ACTION_PREVIOUS -> "Prev"
                else -> "↵"
            }
        }
        
        val actionId = if (action != EditorInfo.IME_ACTION_NONE) action else EditorInfo.IME_ACTION_DONE
        
        return EditorContext(enterVisible, enterEnabled, enterLabel, actionId)
    }

    // ============================================================================
    // KEY EVENT HANDLING
    // ============================================================================
    
    /**
     * Handle key events from the renderer
     * This is the only callback needed - all state management is in renderer
     */
    private fun handleKeyEvent(event: KeyEvent) {
        when (event) {
            is KeyEvent.TextInput -> {
                currentInputConnection?.commitText(event.text, 1)
                // Track the current word for suggestions
                if (wordSuggestionsEnabled) {
                    // Check if this is a word separator (space, punctuation)
                    val isWordSeparator = event.text.all { it.isWhitespace() || it in ".,;:!?-()[]{}\"'" }
                    if (isWordSeparator) {
                        // Word completed - clear current word
                        currentWord.clear()
                    } else {
                        // Continue building the word
                        currentWord.append(event.text)
                    }
                    updateSuggestionsBar()
                }
            }
            is KeyEvent.Backspace -> {
                currentInputConnection?.deleteSurroundingText(1, 0)
                // Update current word on backspace
                if (wordSuggestionsEnabled && currentWord.isNotEmpty()) {
                    currentWord.deleteCharAt(currentWord.length - 1)
                    updateSuggestionsBar()
                } else if (wordSuggestionsEnabled) {
                    // Try to detect current word from context
                    detectCurrentWord()
                }
            }
            is KeyEvent.Enter -> {
                currentInputConnection?.performEditorAction(event.actionId)
                // Clear current word on enter
                if (wordSuggestionsEnabled) {
                    currentWord.clear()
                    updateSuggestionsBar()
                }
            }
            is KeyEvent.Settings -> {
                openSettings()
            }
            is KeyEvent.Close -> {
                requestHideSelf(0)
            }
            is KeyEvent.NextKeyboard -> {
                switchToNextKeyboard()
            }
            is KeyEvent.Custom -> {
                // Handle keyset changes - update language for word completion
                val key = event.key
                when (key.type.lowercase()) {
                    "keyset" -> {
                        updateLanguageFromKeyset(key.keysetValue)
                    }
                    "space" -> {
                        // Space was handled as custom - clear current word
                        if (wordSuggestionsEnabled) {
                            currentWord.clear()
                            updateSuggestionsBar()
                        }
                    }
                }
                Log.d(TAG, "Custom key event: ${event.key.type}")
            }
        }
    }
    
    // ============================================================================
    // WORD COMPLETION HELPERS
    // ============================================================================
    
    /**
     * Detect current word from text document context
     */
    private fun detectCurrentWord() {
        val beforeText = currentInputConnection?.getTextBeforeCursor(50, 0)?.toString() ?: ""
        
        // Find the last word (characters after the last space/newline)
        val trimmed = beforeText.trimEnd()
        val lastSpaceIndex = trimmed.lastIndexOfAny(charArrayOf(' ', '\n', '\t'))
        
        currentWord.clear()
        if (lastSpaceIndex >= 0 && lastSpaceIndex < trimmed.length - 1) {
            currentWord.append(trimmed.substring(lastSpaceIndex + 1))
        } else if (lastSpaceIndex < 0) {
            currentWord.append(trimmed)
        }
        
        Log.d(TAG, "📝 Detected current word: '$currentWord'")
        updateSuggestionsBar()
    }
    
    /**
     * Update language based on keyset ID
     */
    private fun updateLanguageFromKeyset(keysetId: String) {
        val newLanguage = when {
            keysetId.startsWith("he") || keysetId.contains("hebrew") -> "he"
            keysetId.startsWith("ar") || keysetId.contains("arabic") -> "ar"
            else -> "en"
        }
        
        if (newLanguage != currentLanguage) {
            currentLanguage = newLanguage
            if (wordSuggestionsEnabled) {
                wordCompletionManager.setLanguage(currentLanguage)
            }
            Log.d(TAG, "📝 Language changed to: $currentLanguage")
            updateSuggestionsBar()
        }
    }
    
    // ============================================================================
    // SYSTEM ACTIONS
    // ============================================================================
    
    private fun openSettings() {
        try {
            val intent = Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open settings", e)
        }
    }
    
    private fun switchToNextKeyboard() {
        val inputMethodManager = getSystemService(Context.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager
        inputMethodManager.switchToNextInputMethod(window?.window?.attributes?.token, false)
    }
}