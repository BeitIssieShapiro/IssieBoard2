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
     * Shift state using sealed class for type safety
     */
    sealed class ShiftState {
        object Inactive : ShiftState()
        object Active : ShiftState()
        object Locked : ShiftState()
        
        fun toggle(): ShiftState = when (this) {
            Inactive -> Active
            Active -> Inactive
            Locked -> Inactive
        }
        
        fun lock(): ShiftState = Locked
        fun unlock(): ShiftState = Inactive
        fun isActive(): Boolean = this != Inactive
    }
    
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
        val textColor: Int = Color.BLACK,  // Cached parsed color
        val backgroundColor: Int = Color.LTGRAY,  // Cached parsed color
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
     * Parsed keyset configuration (cached for performance)
     */
    data class ParsedKeyset(
        val id: String,
        val rows: List<List<KeyConfig>>,
        val groups: Map<String, GroupTemplate>
    )
    
    /**
     * Parsed configuration (cached to avoid repeated JSON parsing)
     */
    data class ParsedConfig(
        val backgroundColor: Int,
        val defaultKeysetId: String,
        val keysets: Map<String, ParsedKeyset>
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
    
    // Cached parsed configuration (Phase 2 optimization)
    private var parsedConfig: ParsedConfig? = null
    
    // Color parsing cache (Phase 2 optimization)
    private val colorCache = mutableMapOf<String, Int>()
    
    // Shift state (Phase 2 optimization: using sealed class)
    private var shiftState: ShiftState = ShiftState.Inactive
    private var lastShiftClickTime: Long = 0
    
    // Language cycling state
    private var availableKeyboardIds: List<String> = emptyList()
    private var currentKeyboardIndex: Int = 0
    
    // Legacy state (kept for backward compatibility during transition)
    private var keysetsMap: Map<String, JSONObject> = emptyMap()
    private var configJson: JSONObject? = null

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
    
    override fun onStartInputView(info: android.view.inputmethod.EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        // Re-render keyboard when switching to a new input field
        // This ensures the enter key label and behavior updates appropriately
        mainLayout?.post { renderKeyboard() }
    }

    // ============================================================================
    // CONFIG MANAGEMENT
    // ============================================================================
    
    /**
     * Load and parse configuration with caching (Phase 2 optimization)
     */
    private fun loadConfig() {
        try {
            val prefs = getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE)
            val configString = prefs.getString(CONFIG_KEY, null) ?: "{}"
            configJson = JSONObject(configString)
            
            // Parse and cache the entire config
            parsedConfig = parseConfig(configJson!!)
            currentKeysetId = parsedConfig?.defaultKeysetId ?: DEFAULT_KEYSET_ID
            
            // Legacy compatibility: Build keysets map
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
            parsedConfig = null
            keysetsMap = emptyMap()
        }
    }
    
    /**
     * Parse entire configuration into cached structures (Phase 2 optimization)
     */
    private fun parseConfig(configJson: JSONObject): ParsedConfig {
        // Parse background color with caching
        val bgColorString = configJson.optString("backgroundColor", DEFAULT_BG_COLOR)
        val backgroundColor = parseColor(bgColorString, Color.parseColor(DEFAULT_BG_COLOR))
        
        val defaultKeysetId = configJson.optString("defaultKeyset", DEFAULT_KEYSET_ID)
        
        // Parse all keysets
        val keysets = mutableMapOf<String, ParsedKeyset>()
        val keysetsArray = configJson.optJSONArray("keysets")
        
        if (keysetsArray != null) {
            for (i in 0 until keysetsArray.length()) {
                val keysetObj = keysetsArray.optJSONObject(i) ?: continue
                val keysetId = keysetObj.optString("id", "")
                if (keysetId.isEmpty()) continue
                
                // Parse groups for this keyset
                val groups = parseGroups(keysetObj)
                
                // Parse rows
                val rows = mutableListOf<List<KeyConfig>>()
                val rowsArray = keysetObj.optJSONArray("rows")
                
                if (rowsArray != null) {
                    for (j in 0 until rowsArray.length()) {
                        val rowObj = rowsArray.optJSONObject(j) ?: continue
                        val keysArray = rowObj.optJSONArray("keys") ?: continue
                        
                        val rowKeys = mutableListOf<KeyConfig>()
                        for (k in 0 until keysArray.length()) {
                            val keyObj = keysArray.optJSONObject(k) ?: continue
                            val keyConfig = parseKeyConfigWithColors(keyObj, groups)
                            rowKeys.add(keyConfig)
                        }
                        rows.add(rowKeys)
                    }
                }
                
                keysets[keysetId] = ParsedKeyset(keysetId, rows, groups)
            }
        }
        
        return ParsedConfig(backgroundColor, defaultKeysetId, keysets)
    }
    
    /**
     * Parse groups from keyset with caching
     */
    private fun parseGroups(keyset: JSONObject): Map<String, GroupTemplate> {
        val groups = mutableMapOf<String, GroupTemplate>()
        val groupsArray = keyset.optJSONArray("groups") ?: return groups
        
        for (i in 0 until groupsArray.length()) {
            val groupObj = groupsArray.optJSONObject(i) ?: continue
            val itemsArray = groupObj.optJSONArray("items") ?: continue
            val templateObj = groupObj.optJSONObject("template") ?: continue
            
            val template = GroupTemplate(
                width = if (templateObj.has("width")) templateObj.optDouble("width", 1.0).toFloat() else null,
                offset = if (templateObj.has("offset")) templateObj.optDouble("offset", 0.0).toFloat() else null,
                hidden = if (templateObj.has("hidden")) templateObj.optBoolean("hidden", false) else null,
                color = templateObj.optString("color", ""),
                bgColor = templateObj.optString("bgColor", "")
            )
            
            // Map each item to the template
            for (j in 0 until itemsArray.length()) {
                val item = itemsArray.optString(j, "")
                if (item.isNotEmpty()) {
                    groups[item] = template
                }
            }
        }
        
        return groups
    }
    
    /**
     * Parse color with caching (Phase 2 optimization)
     */
    private fun parseColor(colorString: String, default: Int): Int {
        if (colorString.isEmpty()) return default
        
        return colorCache.getOrPut(colorString) {
            try {
                Color.parseColor(colorString)
            } catch (e: Exception) {
                if (BuildConfig.DEBUG) {
                    Log.w(TAG, "Invalid color: $colorString")
                }
                default
            }
        }
    }
    
    /**
     * Parse key config with pre-cached colors (Phase 2 optimization)
     */
    private fun parseKeyConfigWithColors(keyObj: JSONObject, groups: Map<String, GroupTemplate>): KeyConfig {
        val value = keyObj.optString("value", "")
        val groupTemplate = groups[value]
        
        // Parse key properties with group template defaults
        val caption = keyObj.optString("caption", value)
        val sValue = keyObj.optString("sValue", value)
        val sCaption = keyObj.optString("sCaption", "").ifEmpty { 
            keyObj.optString("sValue", caption)
        }
        
        // Parse and cache colors immediately
        val textColorString = keyObj.optString("color", "").ifEmpty { groupTemplate?.color ?: "" }
        val bgColorString = keyObj.optString("bgColor", "").ifEmpty { groupTemplate?.bgColor ?: "" }
        
        val textColor = parseColor(textColorString, Color.BLACK)
        val backgroundColor = parseColor(bgColorString, Color.LTGRAY)
        
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
            textColor = textColor,
            backgroundColor = backgroundColor,
            label = keyObj.optString("label", ""),
            keysetValue = keyObj.optString("keysetValue", "")
        )
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
        
        val config = parsedConfig
        if (config != null && config.keysets.containsKey(keysetId)) {
            currentKeysetId = keysetId
            // Reset shift state when changing keysets
            shiftState = ShiftState.Inactive
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
    // RENDERING
    // ============================================================================

    private fun renderKeyboard() {
        val layout = mainLayout ?: return
        layout.removeAllViews()

        // Load config if not already loaded
        if (parsedConfig == null) {
            loadConfig()
        }

        val config = parsedConfig
        if (config == null) {
            showError(layout, "No config loaded")
            return
        }

        // Get editor context for dynamic key behavior
        val editorContext = analyzeEditorInfo()

        // Use cached background color
        layout.setBackgroundColor(config.backgroundColor)

        // Get cached keyset
        val keyset = config.keysets[currentKeysetId]
        if (keyset == null) {
            showError(layout, "Keyset not found: $currentKeysetId")
            return
        }

        // Calculate baseline width for consistent key sizing
        val baselineWidth = calculateBaselineWidthFromParsed(keyset.rows, editorContext)

        // Render each row from cached configuration
        for (rowKeys in keyset.rows) {
            val rowLayout = createRowLayout(baselineWidth)
            renderRowKeysFromParsed(rowLayout, rowKeys, editorContext)
            layout.addView(rowLayout)
        }
    }
    
    /**
     * Calculate baseline width from parsed config (Phase 2 optimization)
     */
    private fun calculateBaselineWidthFromParsed(rows: List<List<KeyConfig>>, editorContext: EditorContext): Float {
        var maxRowWidth = 0f
        
        for (rowKeys in rows) {
            var rowWidth = 0f
            for (key in rowKeys) {
                // Skip enter/action keys if they won't be visible
                if ((key.type.lowercase() == "enter" || key.type.lowercase() == "action") && !editorContext.enterVisible) {
                    continue
                }
                
                rowWidth += key.width + key.offset
            }
            
            if (rowWidth > maxRowWidth) {
                maxRowWidth = rowWidth
            }
        }
        
        return if (maxRowWidth > 0) maxRowWidth else DEFAULT_BASELINE_WIDTH
    }
    
    /**
     * Render row keys from parsed config (Phase 2 optimization)
     */
    private fun renderRowKeysFromParsed(
        rowLayout: LinearLayout,
        rowKeys: List<KeyConfig>,
        editorContext: EditorContext
    ) {
        for (keyConfig in rowKeys) {
            renderKey(rowLayout, keyConfig, editorContext)
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
        
        // Parse colors (legacy function needs to parse too)
        val textColorString = keyObj.optString("color", "").ifEmpty { groupTemplate?.color ?: "" }
        val bgColorString = keyObj.optString("bgColor", "").ifEmpty { groupTemplate?.bgColor ?: "" }
        
        val textColor = parseColor(textColorString, Color.BLACK)
        val backgroundColor = parseColor(bgColorString, Color.LTGRAY)
        
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
            textColor = textColor,
            backgroundColor = backgroundColor,
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
        
        // Determine display caption and value based on shift state (Phase 2: using sealed class)
        val displayCaption = if (shiftState.isActive()) key.sCaption else key.caption
        val displayValue = if (shiftState.isActive()) key.sValue else key.value
        
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
            
            // Use cached colors directly (Phase 2 optimization)
            val bgColor = getKeyBackgroundColor(key)
            val textColor = key.textColor
            
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
    
    /**
     * Get key background color with special handling for shift (Phase 2 optimization)
     */
    private fun getKeyBackgroundColor(key: KeyConfig): Int {
        // Special handling for shift button when active
        if (key.type.lowercase() == "shift" && shiftState.isActive()) {
            return parseColor(SHIFT_ACTIVE_COLOR, Color.parseColor(SHIFT_ACTIVE_COLOR))
        }
        
        // Return cached color directly
        return key.backgroundColor
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
            "keyset" -> if (key.keysetValue.isNotEmpty()) {
                // When switching keysets (abc <-> 123 <-> #+=), stay in the same language
                // Extract the keyboard prefix from current keyset ID (e.g., "he_abc" -> "he")
                val keyboardPrefix = if (currentKeysetId.contains("_")) {
                    currentKeysetId.substringBefore("_")
                } else {
                    "" // First keyboard has no prefix
                }
                
                // Build target keyset ID with same keyboard prefix
                val targetKeysetId = if (keyboardPrefix.isNotEmpty()) {
                    "${keyboardPrefix}_${key.keysetValue}"
                } else {
                    key.keysetValue
                }
                
                switchKeyset(targetKeysetId)
            }
            else -> clickAction()
        }
    }
    
    /**
     * Handle shift click with double-click detection (Phase 2: using sealed class)
     */
    private fun handleShiftClick(clickAction: () -> Unit) {
        val currentTime = System.currentTimeMillis()
        val timeSinceLastClick = currentTime - lastShiftClickTime
        
        if (timeSinceLastClick < DOUBLE_CLICK_THRESHOLD_MS) {
            // Double-click detected - toggle caps lock
            shiftState = if (shiftState is ShiftState.Locked) {
                ShiftState.Inactive
            } else {
                ShiftState.Locked
            }
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
            "language" -> createLanguageKey(label)
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
            // Use the action ID that was determined in analyzeEditorInfo
            // This ensures we send the correct action (GO, SEARCH, SEND, etc.)
            currentInputConnection?.performEditorAction(editorContext.actionId)
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
    
    /**
     * Create shift key behavior (Phase 2: using sealed class)
     */
    private fun createShiftKey(label: String): Pair<String, () -> Unit> {
        val displayLabel = if (label.isNotEmpty()) {
            label
        } else {
            when (shiftState) {
                is ShiftState.Locked -> "🔒"
                is ShiftState.Active -> "⬆"
                is ShiftState.Inactive -> "⬆"
            }
        }
        
        val action: () -> Unit = {
            shiftState = shiftState.toggle()
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
    
    /**
     * Create language switcher key behavior
     * Cycles through different keyboard layouts (languages)
     */
    private fun createLanguageKey(label: String): Pair<String, () -> Unit> {
        // Get the display label - globe icon or custom label
        val displayLabel = label.ifEmpty { "🌐" }
        
        val action: () -> Unit = {
            val config = parsedConfig
            if (config != null && config.keysets.isNotEmpty()) {
                // Get all keyset IDs
                val allKeysetIds = config.keysets.keys.toList()
                Log.d(TAG, "Language switch: All keysets: ${allKeysetIds.joinToString()}")
                Log.d(TAG, "Language switch: Current keyset: $currentKeysetId")
                
                // Determine the keyset type (abc, 123, or #+=)
                val currentKeysetType = when {
                    currentKeysetId.endsWith("_abc") -> "abc"
                    currentKeysetId.endsWith("_123") -> "123"
                    currentKeysetId.endsWith("_#+=") -> "#+="
                    currentKeysetId == "abc" -> "abc"
                    currentKeysetId == "123" -> "123"
                    currentKeysetId == "#+=" -> "#+="
                    else -> "abc"  // fallback
                }
                
                // Find all keysets of the same type across different keyboards
                val sameTypeKeysets = allKeysetIds.filter { keysetId ->
                    keysetId == currentKeysetType || keysetId.endsWith("_$currentKeysetType")
                }
                
                Log.d(TAG, "Language switch: Same type keysets ($currentKeysetType): ${sameTypeKeysets.joinToString()}")
                
                if (sameTypeKeysets.size > 1) {
                    // Find current position in this list
                    val currentIndex = sameTypeKeysets.indexOf(currentKeysetId)
                    
                    // Move to next keyboard (cycle)
                    val nextIndex = (currentIndex + 1) % sameTypeKeysets.size
                    val nextKeysetId = sameTypeKeysets[nextIndex]
                    
                    Log.d(TAG, "Language switch: Switching from $currentKeysetId to $nextKeysetId")
                    switchKeyset(nextKeysetId)
                } else {
                    Log.d(TAG, "Language switch: Only one keyboard available for type $currentKeysetType")
                }
            }
        }
        return Pair(displayLabel, action)
    }
    
    /**
     * Create regular key behavior (Phase 2: using sealed class)
     */
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
                if (shiftState is ShiftState.Active) {
                    shiftState = ShiftState.Inactive
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
