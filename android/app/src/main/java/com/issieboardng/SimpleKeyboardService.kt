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
import android.os.Build
import android.view.WindowInsets
import android.view.inputmethod.EditorInfo
import android.text.InputType
import android.content.Intent
import android.content.res.Configuration
import org.json.JSONObject

class SimpleKeyboardService : InputMethodService(), SharedPreferences.OnSharedPreferenceChangeListener {

    // ============================================================================
    // CONSTANTS
    // ============================================================================
    companion object {
        private const val TAG = "SimpleKeyboardService"
        private const val PREFS_FILE = "keyboard_data"
        private const val CONFIG_KEY = "config_json"
        private const val DEFAULT_KEYSET_ID = "abc"
        
        // UI Dimensions
        private const val ROW_HEIGHT_PORTRAIT = 150
        private const val ROW_HEIGHT_LANDSCAPE = 100
        private const val KEY_CORNER_RADIUS = 8f
        private const val KEY_MARGIN_HORIZONTAL = 8
        private const val KEY_MARGIN_VERTICAL = 6
        private const val KEY_PADDING = 8
        private const val ROW_PADDING_HORIZONTAL = 16
        
        // Text Sizes
        private const val TEXT_SIZE_NORMAL = 18f
        private const val TEXT_SIZE_LARGE = 36f
        private const val TEXT_SIZE_ERROR = 20f
        
        // Colors
        private const val DEFAULT_BG_COLOR = "#CCCCCC"
        private const val SHIFT_ACTIVE_COLOR = "#4CAF50"
        private const val ERROR_BG_COLOR = "#FF0000"
        
        // Timing
        private const val DOUBLE_CLICK_THRESHOLD_MS = 500L
        
        // Default fallback dimensions
        private const val DEFAULT_KEY_WIDTH = 1.0f
        private const val DEFAULT_KEY_OFFSET = 0.0f
        private const val DEFAULT_BASELINE_WIDTH = 10f
    }

    // ============================================================================
    // DATA CLASSES
    // ============================================================================
    
    /**
     * Represents a complete key configuration
     */
    data class KeyConfig(
        val value: String = "",
        val caption: String = "",
        val sValue: String = "",
        val sCaption: String = "",
        val type: String = "",
        val width: Float = DEFAULT_KEY_WIDTH,
        val offset: Float = DEFAULT_KEY_OFFSET,
        val hidden: Boolean = false,
        val textColor: String = "",
        val backgroundColor: String = "",
        val label: String = "",
        val keysetValue: String = ""
    )
    
    /**
     * Group template for styling sets of keys
     */
    data class GroupTemplate(
        val width: Float?,
        val offset: Float?,
        val hidden: Boolean?,
        val color: String,
        val bgColor: String
    )
    
    /**
     * Editor context information for dynamic key behavior
     */
    data class EditorContext(
        val enterVisible: Boolean,
        val enterEnabled: Boolean,
        val enterLabel: String,
        val actionId: Int
    )

    // ============================================================================
    // STATE
    // ============================================================================
    
    private var mainLayout: LinearLayout? = null
    private var currentKeysetId: String = DEFAULT_KEYSET_ID
    private var keysetsMap: Map<String, JSONObject> = emptyMap()
    private var configJson: JSONObject? = null
    private var shiftActive: Boolean = false
    private var shiftLocked: Boolean = false
    private var lastShiftClickTime: Long = 0

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

    // ============================================================================
    // CONFIG MANAGEMENT
    // ============================================================================
    
    private fun loadConfig() {
        try {
            val prefs = getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE)
            val configString = prefs.getString(CONFIG_KEY, null) ?: "{}"
            configJson = JSONObject(configString)
            
            // Load default keyset
            currentKeysetId = configJson?.optString("defaultKeyset", DEFAULT_KEYSET_ID) ?: DEFAULT_KEYSET_ID
            
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
            if (BuildConfig.DEBUG) {
                Log.e(TAG, "Failed to load config", e)
            }
            keysetsMap = emptyMap()
        }
    }
    
    private fun findGroupTemplate(value: String, keyset: JSONObject): GroupTemplate? {
        if (value.isEmpty()) return null
        
        try {
            val groupsArray = keyset.optJSONArray("groups") ?: return null
            
            for (i in 0 until groupsArray.length()) {
                val groupObj = groupsArray.getJSONObject(i)
                val itemsArray = groupObj.optJSONArray("items") ?: continue
                
                // Check if value is in this group's items
                for (j in 0 until itemsArray.length()) {
                    val item = itemsArray.optString(j, "")
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
            if (BuildConfig.DEBUG) {
                Log.w(TAG, "Error finding group template for value: $value", e)
            }
        }
        return null
    }
    
    private fun switchKeyset(keysetId: String) {
        if (keysetId.isEmpty()) return
        
        if (keysetsMap.containsKey(keysetId)) {
            currentKeysetId = keysetId
            // Reset shift state when changing keysets
            shiftActive = false
            shiftLocked = false
            renderKeyboard()
        } else if (BuildConfig.DEBUG) {
            Log.w(TAG, "Keyset not found: $keysetId")
        }
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

    // ============================================================================
    // RENDERING
    // ============================================================================

    private fun renderKeyboard() {
        val layout = mainLayout ?: return
        layout.removeAllViews()

        // Load config if not already loaded
        if (configJson == null) {
            loadConfig()
        }

        // Get editor context for dynamic key behavior
        val editorContext = analyzeEditorInfo()

        // Parse background color
        val bgColor = try {
            val colorString = configJson?.optString("backgroundColor", DEFAULT_BG_COLOR) ?: DEFAULT_BG_COLOR
            Color.parseColor(colorString)
        } catch (e: Exception) {
            if (BuildConfig.DEBUG) {
                Log.e(TAG, "Failed to parse background color", e)
            }
            Color.parseColor(ERROR_BG_COLOR)
        }

        layout.setBackgroundColor(bgColor)

        // Get rows from current keyset
        val currentKeyset = keysetsMap[currentKeysetId]
        val rowsArray = currentKeyset?.optJSONArray("rows") 
            ?: configJson?.optJSONArray("rows") // Fallback to old format

        if (rowsArray == null) {
            showError(layout, "No config loaded")
            return
        }

        // Calculate baseline width for consistent key sizing
        val baselineWidth = calculateBaselineWidth(rowsArray, editorContext)

        // Render each row
        for (i in 0 until rowsArray.length()) {
            val rowObj = rowsArray.optJSONObject(i) ?: continue
            val keysArray = rowObj.optJSONArray("keys") ?: continue
            
            val rowLayout = createRowLayout(baselineWidth)
            renderRowKeys(rowLayout, keysArray, currentKeyset, editorContext)
            layout.addView(rowLayout)
        }
    }
    
    private fun calculateBaselineWidth(rowsArray: org.json.JSONArray, editorContext: EditorContext): Float {
        var maxRowWidth = 0f
        
        for (i in 0 until rowsArray.length()) {
            val rowObj = rowsArray.optJSONObject(i) ?: continue
            val keysArray = rowObj.optJSONArray("keys") ?: continue
            
            var rowWidth = 0f
            for (j in 0 until keysArray.length()) {
                val keyObj = keysArray.optJSONObject(j) ?: continue
                val type = keyObj.optString("type", "")
                
                // Skip enter/action keys if they won't be visible
                if ((type.lowercase() == "enter" || type.lowercase() == "action") && !editorContext.enterVisible) {
                    continue
                }
                
                val width = keyObj.optDouble("width", DEFAULT_KEY_WIDTH.toDouble()).toFloat()
                val offset = keyObj.optDouble("offset", DEFAULT_KEY_OFFSET.toDouble()).toFloat()
                rowWidth += width + offset
            }
            
            if (rowWidth > maxRowWidth) {
                maxRowWidth = rowWidth
            }
        }
        
        return if (maxRowWidth > 0) maxRowWidth else DEFAULT_BASELINE_WIDTH
    }
    
    private fun createRowLayout(baselineWidth: Float): LinearLayout {
        val isLandscape = resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
        val rowHeight = if (isLandscape) ROW_HEIGHT_LANDSCAPE else ROW_HEIGHT_PORTRAIT
        
        return LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                rowHeight
            )
            setPadding(ROW_PADDING_HORIZONTAL, 0, ROW_PADDING_HORIZONTAL, 0)
            weightSum = baselineWidth
        }
    }
    
    private fun renderRowKeys(
        rowLayout: LinearLayout,
        keysArray: org.json.JSONArray,
        currentKeyset: JSONObject?,
        editorContext: EditorContext
    ) {
        for (j in 0 until keysArray.length()) {
            val keyObj = keysArray.optJSONObject(j) ?: continue
            val keyConfig = parseKeyConfig(keyObj, currentKeyset)
            renderKey(rowLayout, keyConfig, editorContext)
        }
    }
    
    private fun parseKeyConfig(keyObj: JSONObject, currentKeyset: JSONObject?): KeyConfig {
        val value = keyObj.optString("value", "")
        
        // Try to find group template for this key's value
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
        
        return KeyConfig(
            value = value,
            caption = caption,
            sValue = sValue,
            sCaption = sCaption,
            type = keyObj.optString("type", ""),
            width = if (keyObj.has("width")) {
                keyObj.optDouble("width", DEFAULT_KEY_WIDTH.toDouble()).toFloat()
            } else {
                groupTemplate?.width ?: DEFAULT_KEY_WIDTH
            },
            offset = if (keyObj.has("offset")) {
                keyObj.optDouble("offset", DEFAULT_KEY_OFFSET.toDouble()).toFloat()
            } else {
                groupTemplate?.offset ?: DEFAULT_KEY_OFFSET
            },
            hidden = if (keyObj.has("hidden")) {
                keyObj.optBoolean("hidden", false)
            } else {
                groupTemplate?.hidden ?: false
            },
            textColor = keyObj.optString("color", "").ifEmpty { groupTemplate?.color ?: "" },
            backgroundColor = keyObj.optString("bgColor", "").ifEmpty { groupTemplate?.bgColor ?: "" },
            label = keyObj.optString("label", ""),
            keysetValue = keyObj.optString("keysetValue", "")
        )
    }
    
    private fun renderKey(
        rowLayout: LinearLayout,
        key: KeyConfig,
        editorContext: EditorContext
    ) {
        // Skip enter/action keys if not visible
        if ((key.type.lowercase() == "enter" || key.type.lowercase() == "action") && !editorContext.enterVisible) {
            return
        }
        
        // Add offset spacer if needed
        if (key.offset > 0) {
            rowLayout.addView(createSpacer(key.offset))
        }
        
        // Determine display caption and value based on shift state
        val displayCaption = if (shiftActive) key.sCaption else key.caption
        val displayValue = if (shiftActive) key.sValue else key.value
        
        // Determine label and action based on special types
        val (finalLabel, clickAction) = getKeyBehavior(
            key.type, key.label, displayCaption, displayValue, editorContext
        )
        
        // Create button or invisible spacer if hidden
        if (key.hidden) {
            rowLayout.addView(createSpacer(key.width))
        } else {
            rowLayout.addView(createKeyButton(key, finalLabel, clickAction, editorContext))
        }
    }
    
    private fun createSpacer(weight: Float): View {
        return View(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.MATCH_PARENT, weight
            )
        }
    }
    
    private fun createKeyButton(
        key: KeyConfig,
        label: String,
        clickAction: () -> Unit,
        editorContext: EditorContext
    ): Button {
        return Button(this).apply {
            text = label
            textSize = determineTextSize(key.type, label)
            layoutParams = createKeyLayoutParams(key.width)
            
            val bgColor = parseKeyBackgroundColor(key)
            val textColor = parseKeyTextColor(key.textColor)
            
            background = createKeyBackground(bgColor)
            setTextColor(textColor)
            setPadding(KEY_PADDING, KEY_PADDING, KEY_PADDING, KEY_PADDING)
            
            // Handle enabled/disabled state for enter/action keys
            val keyEnabled = when (key.type.lowercase()) {
                "enter", "action" -> editorContext.enterEnabled
                else -> true
            }
            
            isEnabled = keyEnabled
            alpha = if (keyEnabled) 1.0f else 0.4f
            
            setOnClickListener {
                handleKeyClick(key, clickAction)
            }
        }
    }
    
    private fun determineTextSize(type: String, label: String): Float {
        return when {
            type.lowercase() == "shift" -> TEXT_SIZE_LARGE
            (type.lowercase() == "enter" || type.lowercase() == "action") && label.length <= 1 -> TEXT_SIZE_LARGE
            else -> TEXT_SIZE_NORMAL
        }
    }
    
    private fun createKeyLayoutParams(width: Float): LinearLayout.LayoutParams {
        return LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.MATCH_PARENT, width
        ).apply {
            marginStart = KEY_MARGIN_HORIZONTAL
            marginEnd = KEY_MARGIN_HORIZONTAL
            topMargin = KEY_MARGIN_VERTICAL
            bottomMargin = KEY_MARGIN_VERTICAL
        }
    }
    
    private fun parseKeyBackgroundColor(key: KeyConfig): Int {
        // Special handling for shift button
        if (key.type.lowercase() == "shift" && shiftActive) {
            return Color.parseColor(SHIFT_ACTIVE_COLOR)
        }
        
        if (key.backgroundColor.isEmpty()) {
            return Color.LTGRAY
        }
        
        return try {
            Color.parseColor(key.backgroundColor)
        } catch (e: Exception) {
            if (BuildConfig.DEBUG) {
                Log.w(TAG, "Invalid background color: ${key.backgroundColor}")
            }
            Color.LTGRAY
        }
    }
    
    private fun parseKeyTextColor(textColor: String): Int {
        if (textColor.isEmpty()) {
            return Color.BLACK
        }
        
        return try {
            Color.parseColor(textColor)
        } catch (e: Exception) {
            if (BuildConfig.DEBUG) {
                Log.w(TAG, "Invalid text color: $textColor")
            }
            Color.BLACK
        }
    }
    
    private fun createKeyBackground(color: Int): GradientDrawable {
        return GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            setColor(color)
            cornerRadius = KEY_CORNER_RADIUS
        }
    }
    
    private fun handleKeyClick(key: KeyConfig, clickAction: () -> Unit) {
        when (key.type.lowercase()) {
            "shift" -> handleShiftClick(clickAction)
            "keyset" -> if (key.keysetValue.isNotEmpty()) switchKeyset(key.keysetValue)
            else -> clickAction()
        }
    }
    
    private fun handleShiftClick(clickAction: () -> Unit) {
        val currentTime = System.currentTimeMillis()
        val timeSinceLastClick = currentTime - lastShiftClickTime
        
        if (timeSinceLastClick < DOUBLE_CLICK_THRESHOLD_MS) {
            // Double-click detected - toggle caps lock
            shiftLocked = !shiftLocked
            shiftActive = shiftLocked
            renderKeyboard()
        } else {
            // Single click - use normal action
            clickAction()
        }
        
        lastShiftClickTime = currentTime
    }
    
    private fun showError(layout: LinearLayout, message: String) {
        val errorText = TextView(this).apply { 
            text = message
            textSize = TEXT_SIZE_ERROR
        }
        layout.addView(errorText)
    }

    // ============================================================================
    // KEY BEHAVIOR
    // ============================================================================
    
    private fun getKeyBehavior(
        type: String, 
        label: String, 
        caption: String, 
        value: String, 
        editorContext: EditorContext
    ): Pair<String, () -> Unit> {
        return when (type.lowercase()) {
            "backspace" -> createBackspaceKey(label)
            "enter", "action" -> createEnterKey(label, editorContext)
            "keyset" -> createKeysetKey(label)
            "shift" -> createShiftKey(label)
            "settings" -> createSettingsKey(label)
            "close" -> createCloseKey(label)
            else -> createRegularKey(caption, label, value)
        }
    }
    
    private fun createBackspaceKey(label: String): Pair<String, () -> Unit> {
        val displayLabel = label.ifEmpty { "⌫" }
        val action: () -> Unit = { 
            currentInputConnection?.deleteSurroundingText(1, 0)
        }
        return Pair(displayLabel, action)
    }
    
    private fun createEnterKey(label: String, editorContext: EditorContext): Pair<String, () -> Unit> {
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
                currentInputConnection?.commitText("\n", 1)
            } else {
                currentInputConnection?.performEditorAction(editorContext.actionId)
            }
        }
        return Pair(displayLabel, action)
    }
    
    private fun createKeysetKey(label: String): Pair<String, () -> Unit> {
        val displayLabel = label.ifEmpty { "⌨" }
        val action: () -> Unit = {
            // Keyset switching handled in handleKeyClick
        }
        return Pair(displayLabel, action)
    }
    
    private fun createShiftKey(label: String): Pair<String, () -> Unit> {
        val displayLabel = if (label.isNotEmpty()) {
            label
        } else {
            when {
                shiftLocked -> "🔒"
                shiftActive -> "⬆"
                else -> "⬆"
            }
        }
        
        val action: () -> Unit = {
            if (shiftLocked) {
                shiftLocked = false
                shiftActive = false
            } else {
                shiftActive = !shiftActive
            }
            renderKeyboard()
        }
        return Pair(displayLabel, action)
    }
    
    private fun createSettingsKey(label: String): Pair<String, () -> Unit> {
        val displayLabel = label.ifEmpty { "⚙️" }
        val action: () -> Unit = { openSettings() }
        return Pair(displayLabel, action)
    }
    
    private fun createCloseKey(label: String): Pair<String, () -> Unit> {
        val displayLabel = label.ifEmpty { "⬇" }
        val action: () -> Unit = { requestHideSelf(0) }
        return Pair(displayLabel, action)
    }
    
    private fun createRegularKey(caption: String, label: String, value: String): Pair<String, () -> Unit> {
        val displayLabel = when {
            caption.isNotEmpty() -> caption
            label.isNotEmpty() -> label
            value.isNotEmpty() -> value
            else -> "?"
        }
        
        val action: () -> Unit = { 
            if (value.isNotEmpty()) {
                currentInputConnection?.commitText(value, 1)
                // Auto-reset shift after typing a character (unless locked)
                if (shiftActive && !shiftLocked) {
                    shiftActive = false
                    renderKeyboard()
                }
            }
        }
        return Pair(displayLabel, action)
    }
    
    private fun openSettings() {
        try {
            val intent = Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            startActivity(intent)
        } catch (e: Exception) {
            if (BuildConfig.DEBUG) {
                Log.e(TAG, "Failed to open settings", e)
            }
        }
    }
}
