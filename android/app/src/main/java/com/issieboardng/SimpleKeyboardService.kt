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
import android.content.res.Configuration
import org.json.JSONObject

class SimpleKeyboardService : InputMethodService(), SharedPreferences.OnSharedPreferenceChangeListener {

    private var mainLayout: LinearLayout? = null
    private val PREFS_FILE = "keyboard_data"
    private var currentKeysetId: String = "abc" // Default keyset
    private var keysetsMap: Map<String, org.json.JSONObject> = emptyMap()
    private var configJson: JSONObject? = null
    private var shiftActive: Boolean = false // Track shift state
    private var shiftLocked: Boolean = false // Track caps lock state
    private var lastShiftClickTime: Long = 0 // For double-click detection

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
            // Reset to default keyset when config changes
            loadConfig()
            mainLayout?.post { renderKeyboard() }
        }
    }
    
    // Data class for group template
    data class GroupTemplate(
        val width: Float?,
        val offset: Float?,
        val hidden: Boolean?,
        val color: String,
        val bgColor: String
    )
    
    private fun loadConfig() {
        try {
            val prefs = getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE)
            val configString = prefs.getString("config_json", "{}")
            configJson = JSONObject(configString)
            
            // Load default keyset
            currentKeysetId = configJson?.optString("defaultKeyset", "abc") ?: "abc"
            
            // Build keysets map for quick lookup
            val keysetsArray = configJson?.optJSONArray("keysets")
            val tempMap = mutableMapOf<String, JSONObject>()
            
            if (keysetsArray != null) {
                for (i in 0 until keysetsArray.length()) {
                    val keysetObj = keysetsArray.getJSONObject(i)
                    val id = keysetObj.optString("id", "")
                    if (id.isNotEmpty()) {
                        tempMap[id] = keysetObj
                    }
                }
            }
            
            keysetsMap = tempMap
        } catch (e: Exception) {
            Log.e("SimpleKeyboardService", "Failed to load config", e)
            keysetsMap = emptyMap()
        }
    }
    
    private fun findGroupTemplate(value: String, keyset: JSONObject): GroupTemplate? {
        try {
            val groupsArray = keyset.optJSONArray("groups") ?: return null
            
            for (i in 0 until groupsArray.length()) {
                val groupObj = groupsArray.getJSONObject(i)
                val itemsArray = groupObj.optJSONArray("items") ?: continue
                
                // Check if value is in this group's items
                for (j in 0 until itemsArray.length()) {
                    val item = itemsArray.getString(j)
                    if (item == value) {
                        // Found matching group, parse template
                        val templateObj = groupObj.optJSONObject("template") ?: return null
                        return GroupTemplate(
                            width = if (templateObj.has("width")) templateObj.optDouble("width", 1.0).toFloat() else null,
                            offset = if (templateObj.has("offset")) templateObj.optDouble("offset", 0.0).toFloat() else null,
                            hidden = if (templateObj.has("hidden")) templateObj.optBoolean("hidden", false) else null,
                            color = templateObj.optString("color", ""),
                            bgColor = templateObj.optString("bgColor", "")
                        )
                    }
                }
            }
        } catch (e: Exception) {
            Log.w("SimpleKeyboardService", "Error finding group template", e)
        }
        return null
    }
    
    private fun switchKeyset(keysetId: String) {
        if (keysetsMap.containsKey(keysetId)) {
            currentKeysetId = keysetId
            // Reset shift state when changing keysets
            shiftActive = false
            shiftLocked = false
            renderKeyboard()
        } else {
            Log.w("SimpleKeyboardService", "Keyset not found: $keysetId")
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

        // Load config if not already loaded
        if (configJson == null) {
            loadConfig()
        }

        // Get editor context for dynamic key behavior
        val editorContext = analyzeEditorInfo()

        // --- 1. PARSE CONFIG ---
        var bgColor = Color.LTGRAY
        var rowsArray: org.json.JSONArray? = null
        
        try {
            val colorString = configJson?.optString("backgroundColor", "#CCCCCC") ?: "#CCCCCC"
            bgColor = Color.parseColor(colorString)
            
            // Get rows from current keyset
            val currentKeyset = keysetsMap[currentKeysetId]
            rowsArray = currentKeyset?.optJSONArray("rows")
            
            // Fallback to old format if keysets not found
            if (rowsArray == null) {
                rowsArray = configJson?.optJSONArray("rows")
            }
            
        } catch (e: Exception) {
            Log.e("SimpleKeyboardService", "Failed to parse config", e)
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

                // Determine row height based on orientation
                val isLandscape = resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
                val rowHeight = if (isLandscape) 100 else 150 // Smaller in landscape
                
                // Row Container
                val rowLayout = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        rowHeight
                    )
                    // Add horizontal padding for margins at start and end of row
                    setPadding(16, 0, 16, 0)
                    // Use weighted sum to ensure consistent key sizes across rows
                    weightSum = baselineWidth
                }

                // --- 4. RENDER KEYS ---
                for (j in 0 until keysArray.length()) {
                    val keyObj = keysArray.getJSONObject(j)
                    
                    // Regular key parsing
                    val value = keyObj.optString("value", "")
                    
                    // Try to find group template for this key's value
                    val currentKeyset = keysetsMap[currentKeysetId]
                    val groupTemplate = if (value.isNotEmpty() && currentKeyset != null) {
                        findGroupTemplate(value, currentKeyset)
                    } else {
                        null
                    }
                    
                    // Parse key properties, using group template as defaults
                    val caption = keyObj.optString("caption", value)
                    val sValue = keyObj.optString("sValue", value)
                    val sCaption = keyObj.optString("sCaption", "").ifEmpty { 
                        keyObj.optString("sValue", caption)
                    }
                    val type = keyObj.optString("type", "")
                    val width = if (keyObj.has("width")) {
                        keyObj.optDouble("width", 1.0).toFloat()
                    } else {
                        groupTemplate?.width ?: 1.0f
                    }
                    val offset = if (keyObj.has("offset")) {
                        keyObj.optDouble("offset", 0.0).toFloat()
                    } else {
                        groupTemplate?.offset ?: 0.0f
                    }
                    val hidden = if (keyObj.has("hidden")) {
                        keyObj.optBoolean("hidden", false)
                    } else {
                        groupTemplate?.hidden ?: false
                    }
                    val textColor = keyObj.optString("color", "").ifEmpty { groupTemplate?.color ?: "" }
                    val backgroundColor = keyObj.optString("bgColor", "").ifEmpty { groupTemplate?.bgColor ?: "" }
                    val label = keyObj.optString("label", "")
                    val keysetValue = keyObj.optString("keysetValue", "")
                    
                    // Render this key
                    renderKey(
                        rowLayout, value, caption, sValue, sCaption, type, width, offset,
                        hidden, textColor, backgroundColor, label, keysetValue, editorContext
                    )
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
    
    private fun renderKey(
        rowLayout: LinearLayout,
        value: String,
        caption: String,
        sValue: String,
        sCaption: String,
        type: String,
        width: Float,
        offset: Float,
        hidden: Boolean,
        textColor: String,
        backgroundColor: String,
        label: String,
        keysetValue: String,
        editorContext: EditorContext
    ) {
        // Skip enter/action keys if not visible (don't render at all)
        if ((type.lowercase() == "enter" || type.lowercase() == "action") && !editorContext.enterVisible) {
            return
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
        
        // Determine display caption and value based on shift state
        val displayCaption = if (shiftActive) sCaption else caption
        val displayValue = if (shiftActive) sValue else value
        
        // Determine label and action based on special types
        val (finalLabel, clickAction) = getKeyBehavior(
            type, label, displayCaption, displayValue, editorContext
        )
        
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
                // Increase text size - larger for special keys with single character
                textSize = when {
                    type.lowercase() == "shift" -> 36f  // Always large
                    (type.lowercase() == "enter" || type.lowercase() == "action") && finalLabel.length <= 1 -> 36f
                    else -> 18f
                }
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
                // For shift button, use highlighted color when active
                val bgColorParsed = if (type.lowercase() == "shift" && shiftActive) {
                    Color.parseColor("#4CAF50") // Green when shift is active
                } else if (backgroundColor.isNotEmpty()) {
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
                
                // Handle enabled/disabled state for enter/action keys only
                val keyEnabled = when (type.lowercase()) {
                    "enter", "action" -> editorContext.enterEnabled
                    else -> true
                }
                
                isEnabled = keyEnabled
                alpha = if (keyEnabled) 1.0f else 0.4f // Dim disabled keys
                
                setOnClickListener {
                    // Handle double-click for shift to lock
                    if (type.lowercase() == "shift") {
                        val currentTime = System.currentTimeMillis()
                        val timeSinceLastClick = currentTime - lastShiftClickTime
                        
                        if (timeSinceLastClick < 500) { // Double-click within 500ms
                            // Double-click detected - toggle caps lock
                            shiftLocked = !shiftLocked
                            shiftActive = shiftLocked
                            renderKeyboard()
                        } else {
                            // Single click - use normal action
                            clickAction()
                        }
                        
                        lastShiftClickTime = currentTime
                    } else if (type.lowercase() == "keyset" && keysetValue.isNotEmpty()) {
                        // Handle keyset switching
                        switchKeyset(keysetValue)
                    } else {
                        // Normal click action
                        clickAction()
                    }
                }
            }
            rowLayout.addView(keyButton)
        }
    }
    
    private fun getKeyBehavior(type: String, label: String, caption: String, value: String, editorContext: EditorContext): Pair<String, () -> Unit> {
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
                    val editorInfo = currentInputEditorInfo
                    val inputType = editorInfo?.inputType ?: 0
                    val isMultiline = (inputType and InputType.TYPE_TEXT_FLAG_MULTI_LINE) != 0
                    
                    if (isMultiline) {
                        // For multiline, insert newline
                        currentInputConnection?.commitText("\n", 1)
                    } else {
                        // For single-line, perform editor action
                        currentInputConnection?.performEditorAction(editorContext.actionId)
                    }
                    Unit
                }
                Pair(displayLabel, action)
            }
            "keyset" -> {
                // Keyset switcher - gets keysetValue from key config
                val displayLabel = label.ifEmpty { "⌨" }
                val action: () -> Unit = {
                    // keysetValue will be passed separately
                    Log.d("SimpleKeyboardService", "Keyset button pressed")
                }
                Pair(displayLabel, action)
            }
            "shift" -> {
                // Show different icon based on state
                val displayLabel = if (label.isNotEmpty()) {
                    label
                } else {
                    when {
                        shiftLocked -> "🔒"  // Lock icon for caps lock
                        shiftActive -> "⬆"  // Up arrow for shift active
                        else -> "⬆"         // Up arrow for shift inactive
                    }
                }
                val action: () -> Unit = {
                    if (shiftLocked) {
                        // If locked, unlock
                        shiftLocked = false
                        shiftActive = false
                    } else {
                        // Toggle shift
                        shiftActive = !shiftActive
                    }
                    renderKeyboard() // Re-render to show shifted keys
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
                // Regular key: use caption or label for display, value for output
                // Note: caption and value parameters are already shift-adjusted
                // Priority: caption > label > value
                val displayLabel = when {
                    caption.isNotEmpty() -> caption
                    label.isNotEmpty() -> label
                    value.isNotEmpty() -> value
                    else -> "?"
                }
                val action: () -> Unit = { 
                    // Use the shift-adjusted value
                    currentInputConnection?.commitText(value, 1)
                    // Auto-reset shift after typing a character (unless locked)
                    if (shiftActive && !shiftLocked) {
                        shiftActive = false
                        renderKeyboard()
                    }
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
