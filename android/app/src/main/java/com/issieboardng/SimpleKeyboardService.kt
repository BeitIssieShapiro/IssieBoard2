package com.issieboardng

import android.inputmethodservice.InputMethodService
import android.view.View
import android.widget.LinearLayout
import android.view.ViewGroup.LayoutParams
import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import android.os.Build
import android.view.WindowInsets
import android.view.inputmethod.EditorInfo
import android.text.InputType
import android.content.Intent

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
    
    // Shared components
    private lateinit var renderer: KeyboardRenderer
    private lateinit var configParser: KeyboardConfigParser

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
        } else {
            Log.e(TAG, "Failed to load config")
        }
    }

    // ============================================================================
    // RENDERING
    // ============================================================================

    private fun renderKeyboard() {
        val layout = mainLayout ?: return
        
        // Get editor context for dynamic key behavior
        val editorContext = analyzeEditorInfo()
        
        // Render using the shared renderer
        renderer.renderKeyboard(layout, editorContext)
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
            }
            is KeyEvent.Backspace -> {
                currentInputConnection?.deleteSurroundingText(1, 0)
            }
            is KeyEvent.Enter -> {
                currentInputConnection?.performEditorAction(event.actionId)
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
                // Handle any custom key types if needed
                Log.d(TAG, "Custom key event: ${event.key.type}")
            }
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