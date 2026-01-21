package com.issieboardng

import android.inputmethodservice.InputMethodService
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.ViewGroup.LayoutParams
import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import android.os.Build // Needed for API version check
import android.view.WindowInsets // Needed for Insets
import android.view.inputmethod.EditorInfo
import android.text.InputType
import android.content.Intent
import org.json.JSONObject

class SimpleKeyboardService : InputMethodService(), SharedPreferences.OnSharedPreferenceChangeListener {

    private var mainLayout: LinearLayout? = null
    private val PREFS_FILE = "keyboard_data"

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
            // Explicitly match parent width, but allow height to wrap content + padding
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
        }

        // --- FIX FOR NAVIGATION BAR OVERLAP ---
        // This listener fires when the view is attached and learns about the system bars
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) { // Android 11+
            mainLayout?.setOnApplyWindowInsetsListener { view, insets ->
                val navInsets = insets.getInsets(WindowInsets.Type.navigationBars())
                // Apply bottom padding equal to the Nav Bar height
                view.setPadding(0, 0, 0, navInsets.bottom)
                insets
            }
        } else {
            // Fallback for older Androids (API < 30)
            // usually InputMethodService handles this better on old OS, 
            // but we can enforce fitsSystemWindows if needed.
            mainLayout?.fitsSystemWindows = true
        }

        renderKeyboard()
        return mainLayout!!
    }

    override fun onSharedPreferenceChanged(sharedPreferences: SharedPreferences?, key: String?) {
        if (key == "config_json") {
            mainLayout?.post { renderKeyboard() }
        }
    }

    // Data class to hold editor context information
    data class EditorContext(
        val enterVisible: Boolean,
        val enterEnabled: Boolean,
        val enterLabel: String,
        val actionId: Int
    )
    
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
            action == EditorInfo.IME_ACTION_NONE && !isMultiline -> false // No action and not multiline
            else -> true
        }
        
        val enterEnabled = !actionDisabled
        
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

    private fun renderKeyboard() {
        val layout = mainLayout ?: return
        layout.removeAllViews()

        // Get editor context for dynamic key behavior
        val editorContext = analyzeEditorInfo()

        // --- 1. PARSE CONFIG ---
        var bgColor = Color.LTGRAY
        var rowsArray: org.json.JSONArray? = null
        
        try {
            val prefs = getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE)
            val configString = prefs.getString("config_json", "{}")
            val json = JSONObject(configString)
            
            val colorString = json.optString("backgroundColor", "#CCCCCC")
            bgColor = Color.parseColor(colorString)
            rowsArray = json.optJSONArray("rows")
            
        } catch (e: Exception) {
            bgColor = Color.RED 
        }

        layout.setBackgroundColor(bgColor)

        // --- 2. CALCULATE BASELINE UNIT WIDTH ---
        // Find the maximum total width across all rows to establish a consistent baseline
        // Exclude enter keys that won't be visible from width calculations
        var maxRowWidth = 0f
        if (rowsArray != null) {
            for (i in 0 until rowsArray.length()) {
                val rowObj = rowsArray.getJSONObject(i)
                val keysArray = rowObj.optJSONArray("keys") ?: continue
                
                var rowWidth = 0f
                for (j in 0 until keysArray.length()) {
                    val keyObj = keysArray.getJSONObject(j)
                    val type = keyObj.optString("type", "")
                    
                    // Skip enter/action keys if they won't be visible
                    if ((type.lowercase() == "enter" || type.lowercase() == "action") && !editorContext.enterVisible) {
                        continue
                    }
                    
                    val width = keyObj.optDouble("width", 1.0).toFloat()
                    val offset = keyObj.optDouble("offset", 0.0).toFloat()
                    rowWidth += width + offset
                }
                
                if (rowWidth > maxRowWidth) {
                    maxRowWidth = rowWidth
                }
            }
        }
        
        // Use the maximum row width as the baseline for all rows
        val baselineWidth = if (maxRowWidth > 0) maxRowWidth else 10f

        // --- 3. RENDER ROWS ---
        if (rowsArray != null) {
            for (i in 0 until rowsArray.length()) {
                val rowObj = rowsArray.getJSONObject(i)
                val keysArray = rowObj.optJSONArray("keys") ?: continue

                // Row Container
                val rowLayout = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        150 // Fixed height per row (approx 50-60dp)
                    )
                    // Add horizontal padding for margins at start and end of row
                    setPadding(16, 0, 16, 0)
                    // Use weighted sum to ensure consistent key sizes across rows
                    weightSum = baselineWidth
                }

                // --- 4. RENDER KEYS ---
                for (j in 0 until keysArray.length()) {
                    val keyObj = keysArray.getJSONObject(j)
                    
                    // Parse key properties
                    val label = keyObj.optString("label", "")
                    val value = keyObj.optString("value", "")
                    val type = keyObj.optString("type", "")
                    val width = keyObj.optDouble("width", 1.0).toFloat()
                    val offset = keyObj.optDouble("offset", 0.0).toFloat()
                    val hidden = keyObj.optBoolean("hidden", false)
                    val textColor = keyObj.optString("color", "")
                    val backgroundColor = keyObj.optString("bgColor", "")
                    
                    // Skip enter/action keys if not visible (don't render at all)
                    if ((type.lowercase() == "enter" || type.lowercase() == "action") && !editorContext.enterVisible) {
                        continue
                    }
                    
                    // Add offset spacer if needed
                    if (offset > 0) {
                        val spacer = View(this).apply {
                            layoutParams = LinearLayout.LayoutParams(
                                0, LinearLayout.LayoutParams.MATCH_PARENT, offset
                            )
                        }
                        rowLayout.addView(spacer)
                    }
                    
                    // Determine label and action based on special types
                    val (finalLabel, clickAction) = getKeyBehavior(type, label, value, editorContext)
                    
                    // Create button (or invisible spacer if hidden)
                    if (hidden) {
                        // Hidden key: add spacer to occupy space
                        val spacer = View(this).apply {
                            layoutParams = LinearLayout.LayoutParams(
                                0, LinearLayout.LayoutParams.MATCH_PARENT, width
                            )
                        }
                        rowLayout.addView(spacer)
                    } else {
                        // Visible key: create button
                        val keyButton = Button(this).apply {
                            text = finalLabel
                            // Increase text size for better visibility, especially for icons
                            textSize = 18f
                            layoutParams = LinearLayout.LayoutParams(
                                0, LinearLayout.LayoutParams.MATCH_PARENT, width
                            ).apply {
                                // Add margins between keys for clear separation
                                marginStart = 8
                                marginEnd = 8
                                topMargin = 6
                                bottomMargin = 6
                            }
                            
                            // Parse colors with defaults
                            val bgColorParsed = if (backgroundColor.isNotEmpty()) {
                                try {
                                    Color.parseColor(backgroundColor)
                                } catch (e: Exception) {
                                    Log.w("SimpleKeyboardService", "Invalid background color: $backgroundColor")
                                    Color.LTGRAY
                                }
                            } else {
                                Color.LTGRAY // Default button color
                            }
                            
                            val textColorParsed = if (textColor.isNotEmpty()) {
                                try {
                                    Color.parseColor(textColor)
                                } catch (e: Exception) {
                                    Log.w("SimpleKeyboardService", "Invalid text color: $textColor")
                                    Color.BLACK
                                }
                            } else {
                                Color.BLACK // Default text color
                            }
                            
                            // Create a rounded rectangle drawable for ALL buttons
                            val drawable = GradientDrawable().apply {
                                shape = GradientDrawable.RECTANGLE
                                setColor(bgColorParsed)
                                cornerRadius = 8f // Rounded corners
                            }
                            background = drawable
                            setTextColor(textColorParsed)
                            
                            // Remove default button padding
                            setPadding(8, 8, 8, 8)
                            
                            // Handle enabled/disabled state for enter/action keys
                            val keyEnabled = if (type.lowercase() == "enter" || type.lowercase() == "action") {
                                editorContext.enterEnabled
                            } else {
                                true
                            }
                            
                            isEnabled = keyEnabled
                            alpha = if (keyEnabled) 1.0f else 0.4f // Dim disabled keys
                            
                            setOnClickListener {
                                if (keyEnabled) {
                                    clickAction()
                                }
                            }
                        }
                        rowLayout.addView(keyButton)
                    }
                }
                layout.addView(rowLayout)
            }
        } else {
            val errorText = TextView(this).apply { 
                text = "No config loaded" 
                textSize = 20f
            }
            layout.addView(errorText)
        }
    }
    
    private fun getKeyBehavior(type: String, label: String, value: String, editorContext: EditorContext): Pair<String, () -> Unit> {
        return when (type.lowercase()) {
            "backspace" -> {
                val displayLabel = label.ifEmpty { "⌫" }
                val action: () -> Unit = { 
                    currentInputConnection?.deleteSurroundingText(1, 0) 
                    Unit
                }
                Pair(displayLabel, action)
            }
            "enter", "action" -> {
                // Use dynamic label from editor context, or fallback to config label
                val displayLabel = if (label.isNotEmpty()) {
                    label
                } else {
                    editorContext.enterLabel.ifEmpty { "↵" }
                }
                val action: () -> Unit = { 
                    currentInputConnection?.performEditorAction(editorContext.actionId)
                    Unit
                }
                Pair(displayLabel, action)
            }
            "shift" -> {
                val displayLabel = label.ifEmpty { "⇧" }
                val action: () -> Unit = {
                    // TODO: Implement shift functionality for case switching
                    Log.d("SimpleKeyboardService", "Shift pressed")
                }
                Pair(displayLabel, action)
            }
            "settings" -> {
                val displayLabel = label.ifEmpty { "⚙️" }
                val action: () -> Unit = { 
                    openSettings()
                    Unit
                }
                Pair(displayLabel, action)
            }
            "close" -> {
                // Use keyboard-down icon: ⌨↓ or 🔽 or ⬇
                val displayLabel = label.ifEmpty { "⬇" }
                val action: () -> Unit = { 
                    requestHideSelf(0)
                    Unit
                }
                Pair(displayLabel, action)
            }
            else -> {
                // Regular key: use provided label and value
                // If both label and value are empty, use "?" as fallback
                val displayLabel = when {
                    label.isNotEmpty() -> label
                    value.isNotEmpty() -> value
                    else -> "?"
                }
                val action: () -> Unit = { 
                    currentInputConnection?.commitText(value, 1)
                    Unit
                }
                Pair(displayLabel, action)
            }
        }
    }
    
    private fun openSettings() {
        try {
            val intent = Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            startActivity(intent)
        } catch (e: Exception) {
            Log.e("SimpleKeyboardService", "Failed to open settings", e)
        }
    }

    override fun onEvaluateInputViewShown(): Boolean {
        super.onEvaluateInputViewShown()
        return true
    }
}
