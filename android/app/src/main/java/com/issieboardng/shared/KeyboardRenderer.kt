package com.issieboardng.shared

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs
import kotlin.math.max

/**
 * Self-contained keyboard renderer that manages all keyboard logic internally.
 * Used for bot in-app preview and the actual keyboard extension.
 * Container only needs to provide the view and listen to final key output.
 * 
 * Port of ios/Shared/KeyboardRenderer.swift
 */
class KeyboardRenderer(private val context: Context) {
    
    // MARK: - Properties
    
    // Callbacks for key output
    var onKeyPress: ((ParsedKey) -> Unit)? = null
    var onNikkudSelected: ((String) -> Unit)? = null
    
    // Callback for word suggestion selection
    var onSuggestionSelected: ((String) -> Unit)? = null
    
    // Whether to show the globe (next-keyboard) button
    private var showGlobeButton: Boolean = true
    
    // Callbacks for system keyboard actions (only used by actual keyboard)
    var onNextKeyboard: (() -> Unit)? = null
    var onDismissKeyboard: (() -> Unit)? = null
    var onOpenSettings: (() -> Unit)? = null
    
    // Callbacks for backspace touch state (to coordinate with controller)
    var onBackspaceTouchBegan: (() -> Unit)? = null
    var onBackspaceTouchEnded: (() -> Unit)? = null
    
    // Callbacks for backspace long-press actions
    var onDeleteCharacter: (() -> Unit)? = null
    var onDeleteWord: (() -> Unit)? = null
    
    // Word suggestions to display
    private var currentSuggestions: List<String> = emptyList()
    
    // Index of suggestion to highlight (for fuzzy matches)
    private var suggestionHighlightIndex: Int? = null
    
    // Whether word suggestions are enabled (from config, can be overridden by controller)
    private var wordSuggestionsEnabled: Boolean = true
    private var wordSuggestionsOverrideEnabled: Boolean? = null
    
    // Internal state - managed entirely by renderer
    private var shiftState: ShiftState = ShiftState.INACTIVE
    private var nikkudActive: Boolean = false
    private var cursorMoveMode: Boolean = false
    private var config: KeyboardConfig? = null
    var currentKeysetId: String = "abc"  // Public so container can read it
    private var editorContext: EditorContext? = null
    
    // Cursor movement tracking
    private var cursorMoveStartPoint: android.graphics.PointF = android.graphics.PointF(0f, 0f)
    private var cursorMoveAccumulatedDistance: Float = 0f
    private val cursorMoveSensitivity: Float = 30f  // 30px = 1 character movement
    private var cursorMoveDirectionIsRTL: Boolean = false  // Direction locked at start of session
    
    // Keyset button return state tracking
    private var keysetButtonReturnState: MutableMap<String, Pair<String, String>> = mutableMapOf()
    
    // Diacritics settings (from profile, keyed by keyboard ID)
    private var diacriticsSettings: Map<String, DiacriticsSettings> = emptyMap()
    
    // Current keyboard ID for diacritics lookup
    private var currentKeyboardId: String? = null
    
    // Shift double-click detection
    private var lastShiftClickTime: Long = 0
    private val doubleClickThreshold: Long = 500  // milliseconds
    
    // Selected keys for visual highlighting (edit mode)
    private var selectedKeyIds: Set<String> = emptySet()
    
    // Container reference - renderer owns the rendering
    private var container: ViewGroup? = null
    
    // Overlay container reference (for nikkud picker - must be a FrameLayout)
    private var overlayContainer: ViewGroup? = null
    
    // Callback for keyset changes (so controller can save to preferences)
    var onKeysetChanged: ((String) -> Unit)? = null
    
    // Callback for state changes (shift, nikkud, keyset) to trigger layout refresh
    var onStateChange: (() -> Unit)? = null
    
    // Callback for long-press selection (for nikkud/keyset keys in edit mode)
    var onKeyLongPress: ((ParsedKey) -> Unit)? = null
    
    // Callback for cursor movement requests
    var onCursorMove: ((Int) -> Unit)? = null
    
    // Callback to get text direction at cursor (returns true if RTL, false if LTR)
    var onGetTextDirection: (() -> Boolean)? = null
    
    // Layout tracking to prevent infinite loops
    private var lastRenderedWidth: Int = 0
    
    // Screen size detection for showOn filtering
    private val isLargeScreen: Boolean
        get() {
            val screenLayout = context.resources.configuration.screenLayout
            val screenSize = screenLayout and android.content.res.Configuration.SCREENLAYOUT_SIZE_MASK
            // SCREENLAYOUT_SIZE_LARGE or SCREENLAYOUT_SIZE_XLARGE = tablet
            return screenSize >= android.content.res.Configuration.SCREENLAYOUT_SIZE_LARGE
        }
    
    // UI Constants - same for preview and keyboard
    private val rowHeight: Int = dpToPx(54)
    private val keySpacing: Int = 0
    private val keyInternalPadding: Int = dpToPx(3)
    private val rowSpacing: Int = 0
    private val keyCornerRadius: Float = dpToPx(5).toFloat()
    private val fontSize: Float = 24f
    private val largeFontSize: Float = 28f
    private val suggestionsBarHeight: Int = dpToPx(40)
    
    // Suggestions bar view reference for updates
    private var suggestionsBar: ViewGroup? = null
    
    // MARK: - Modular Helper Classes
    
    /** Handles long-press backspace logic */
    private val backspaceHandler = BackspaceHandler()
    
    /** Manages the suggestions bar UI */
    private val suggestionsBarView = SuggestionsBarView(context)
    
    /** Manages the nikkud picker popup */
    private val nikkudPickerController = NikkudPickerController(context)
    
    // MARK: - Initialization
    
    init {
        debugLog("🎨 KeyboardRenderer created")
        setupHelperCallbacks()
    }
    
    /** Wire up callbacks for helper classes */
    private fun setupHelperCallbacks() {
        // BackspaceHandler callbacks
        backspaceHandler.onDeleteCharacter = {
            performBackspaceDeleteViaCallback()
        }
        backspaceHandler.onDeleteWord = {
            performWordDeleteViaCallback()
        }
        
        // SuggestionsBarView callbacks
        suggestionsBarView.onSuggestionSelected = { suggestion ->
            onSuggestionSelected?.invoke(suggestion)
        }
        
        // NikkudPickerController callbacks
        nikkudPickerController.onNikkudSelected = { value ->
            onNikkudSelected?.invoke(value)
        }
        nikkudPickerController.onDismiss = {
            rerender()
        }
    }
    
    /** Internal delete character (called by backspace handler) */
    private fun performBackspaceDeleteViaCallback() {
        val callback = onDeleteCharacter
        if (callback != null) {
            callback()
        } else {
            // Create a backspace key and emit through onKeyPress
            val backspaceKey = Key(
                value = "",
                sValue = null,
                caption = null,
                sCaption = null,
                type = "backspace",
                width = null,
                offset = null,
                hidden = null,
                color = null,
                bgColor = null,
                label = null,
                keysetValue = null,
                returnKeysetValue = null,
                returnKeysetLabel = null,
                nikkud = null
            )
            val parsedKey = ParsedKey.from(backspaceKey, emptyMap(), Color.BLACK, Color.WHITE)
            onKeyPress?.invoke(parsedKey)
        }
    }
    
    /** Internal delete word (called by backspace handler) */
    private fun performWordDeleteViaCallback() {
        val callback = onDeleteWord
        if (callback != null) {
            callback()
        } else {
            performBackspaceDeleteViaCallback()
        }
    }
    
    // MARK: - Public Methods
    
    /** Calculate the required keyboard height based on the current config */
    fun calculateKeyboardHeight(config: KeyboardConfig, keysetId: String, suggestionsEnabled: Boolean): Int {
        val keyset = config.keysets.find { it.id == keysetId } ?: return dpToPx(216)
        
        val numberOfRows = keyset.rows.size
        val rowsHeight = numberOfRows * rowHeight
        val spacingHeight = max(0, numberOfRows - 1) * rowSpacing
        // Only include suggestions height if suggestions are actually enabled for this field
        val suggestionsHeight = if (suggestionsEnabled) suggestionsBarHeight + dpToPx(4) else 0
        val topPadding = dpToPx(4)
        val bottomPadding = dpToPx(4)
        
        return rowsHeight + spacingHeight + suggestionsHeight + topPadding + bottomPadding
    }
    
    /** Check if width changed and re-render is needed */
    fun needsRender(width: Int): Boolean {
        return abs(width - lastRenderedWidth) > 1
    }
    
    /** Set selected key IDs for visual highlighting */
    fun setSelectedKeys(keyIds: Set<String>) {
        debugLog("🎯 KeyboardRenderer setSelectedKeys: ${keyIds.size} keys")
        selectedKeyIds = keyIds
    }
    
    /** Update word suggestions displayed in the suggestions bar */
    fun updateSuggestions(suggestions: List<String>, highlightIndex: Int? = null) {
        debugLog("📝 KeyboardRenderer updateSuggestions: $suggestions, highlight: ${highlightIndex?.toString() ?: "none"}, suggestionsBar=${suggestionsBar != null}")
        currentSuggestions = suggestions
        suggestionHighlightIndex = highlightIndex
        updateSuggestionsBar()
    }
    
    /** Clear all suggestions */
    fun clearSuggestions() {
        currentSuggestions = emptyList()
        updateSuggestionsBar()
    }
    
    /** Set whether to show the globe (next-keyboard) button */
    fun setShowGlobeButton(show: Boolean) {
        if (showGlobeButton != show) {
            showGlobeButton = show
            debugLog("🌐 setShowGlobeButton: $show")
            rerender()
        }
    }
    
    /** Set whether word suggestions are enabled (override config setting) */
    fun setWordSuggestionsEnabled(enabled: Boolean?) {
        if (wordSuggestionsOverrideEnabled != enabled) {
            wordSuggestionsOverrideEnabled = enabled
            debugLog("📝 setWordSuggestionsEnabled override: $enabled")
        }
    }
    
    // MARK: - Public Rendering
    
    fun renderKeyboard(
        container: ViewGroup,
        config: KeyboardConfig,
        currentKeysetId: String,
        editorContext: EditorContext?,
        overlayContainer: ViewGroup? = null  // Optional FrameLayout for overlays like nikkud picker
    ) {
        var currentWidth = container.width
        debugLog("📐 RENDER START - keysetId: $currentKeysetId, width: $currentWidth")
        
        // If width is 0, use screen width as fallback (for InputMethodService where view may not be laid out)
        if (currentWidth == 0) {
            currentWidth = context.resources.displayMetrics.widthPixels
            debugLog("📐 Width was 0, using screen width: $currentWidth")
        }
        
        // Update last rendered width
        lastRenderedWidth = currentWidth
        
        // Store container, config, and editor context
        this.container = container
        this.overlayContainer = overlayContainer ?: container  // Use provided overlay or fallback to container
        this.config = config
        this.editorContext = editorContext
        
        // Only set currentKeysetId from parameter if renderer hasn't been initialized yet
        if (this.currentKeysetId == "abc" && currentKeysetId != "abc") {
            this.currentKeysetId = currentKeysetId
        }
        
        // Derive currentKeyboardId from keyset ID
        val keyboards = config.keyboards
        if (keyboards != null && keyboards.isNotEmpty()) {
            this.currentKeyboardId = null
            
            for (keyboardId in keyboards) {
                if (this.currentKeysetId.startsWith("${keyboardId}_") || this.currentKeysetId == keyboardId) {
                    this.currentKeyboardId = keyboardId
                    break
                }
            }
            if (this.currentKeyboardId == null) {
                this.currentKeyboardId = keyboards.first()
            }
            debugLog("📱 Current keyboard ID set to: ${this.currentKeyboardId} (keyset: ${this.currentKeysetId})")
        }
        
        // Clear existing views, but preserve nikkud picker overlay if present
        for (i in container.childCount - 1 downTo 0) {
            val child = container.getChildAt(i)
            if (child.tag != 999) {
                container.removeViewAt(i)
            }
        }
        
        // Set background color
        val bgColorString = config.backgroundColor
        if (bgColorString != null) {
            if (bgColorString.lowercase() == "default" || bgColorString.isEmpty()) {
                container.setBackgroundColor(Color.TRANSPARENT)
            } else {
                val bgColor = parseColor(bgColorString)
                if (bgColor != null) {
                    container.setBackgroundColor(bgColor)
                }
            }
        } else {
            container.setBackgroundColor(Color.TRANSPARENT)
        }
        
        // Find current keyset
        debugLog("📂 Looking for keyset: ${this.currentKeysetId} in ${config.keysets.map { it.id }}")
        val keyset = config.keysets.find { it.id == this.currentKeysetId }
        if (keyset == null) {
            debugLog("❌ Keyset not found: ${this.currentKeysetId}")
            showError(container, "Keyset '${this.currentKeysetId}' not found")
            return
        }
        debugLog("✅ Found keyset: ${keyset.id} with ${keyset.rows.size} rows")
        
        // Build groups map - returns both the map and any "showOnly" keys
        val (groupsMap, showOnlyKeys) = buildGroupsMap(config.groups ?: emptyList())
        
        // Calculate baseline width
        val baselineWidth = calculateBaselineWidth(keyset.rows, groupsMap, showOnlyKeys)
        
        // Update word suggestions enabled state
        val override = wordSuggestionsOverrideEnabled
        if (override != null) {
            wordSuggestionsEnabled = override
            debugLog("📝 Word suggestions enabled: $wordSuggestionsEnabled (from controller override)")
        } else {
            wordSuggestionsEnabled = config.isWordSuggestionsEnabled
            debugLog("📝 Word suggestions enabled: $wordSuggestionsEnabled (from config)")
        }
        
        // Calculate top offset
        var topOffset = dpToPx(4)
        
        // Check if container is a LinearLayout (for proper LayoutParams)
        val isLinearContainer = container is LinearLayout
        debugLog("📐 Container is LinearLayout: $isLinearContainer")
        
        // Create suggestions bar at the top only if enabled
        if (wordSuggestionsEnabled) {
            suggestionsBarView.currentKeyboardId = currentKeyboardId
            
            // Create suggestions bar - we'll add with proper params below
            val bar = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                setBackgroundColor(Color.parseColor("#E8E8E8"))
                if (isLinearContainer) {
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        suggestionsBarHeight
                    )
                } else {
                    layoutParams = FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        suggestionsBarHeight
                    )
                }
                tag = 888  // Tag to identify suggestions bar
            }
            container.addView(bar)
            suggestionsBar = bar
            suggestionsBarView.setBarView(bar)
            suggestionsBarView.updateSuggestions(currentSuggestions, suggestionHighlightIndex)
        } else {
            suggestionsBar = null
        }
        
        // Create rows container - use explicit height calculation for debugging
        val totalRowsHeight = keyset.rows.size * rowHeight
        debugLog("📐 Total rows height: $totalRowsHeight (${keyset.rows.size} rows x $rowHeight)")
        
        val rowsContainer = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.TRANSPARENT)  // Transparent to show keyboard background
            if (isLinearContainer) {
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    setMargins(0, dpToPx(4), 0, dpToPx(4))
                }
            } else {
                layoutParams = FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    totalRowsHeight
                ).apply {
                    setMargins(0, suggestionsBarHeight + dpToPx(4), 0, dpToPx(4))
                }
            }
        }
        debugLog("📐 Adding rows container to parent")
        container.addView(rowsContainer)
        
        // Render each row
        val availableWidth = currentWidth - dpToPx(8)
        debugLog("📐 Rendering ${keyset.rows.size} rows with availableWidth=$availableWidth")
        
        for ((rowIndex, row) in keyset.rows.withIndex()) {
            debugLog("📐 Creating row $rowIndex with ${row.keys.size} keys")
            val rowView = createRow(
                row = row,
                groups = groupsMap,
                showOnlyKeys = showOnlyKeys,
                baselineWidth = baselineWidth,
                availableWidth = availableWidth,
                editorContext = editorContext,
                keysetId = this.currentKeysetId,
                rowIndex = rowIndex
            )
            rowsContainer.addView(rowView)
        }
    }
    
    // MARK: - Private Helpers
    
    /**
     * Build a map of key values to their group templates
     * Also returns the set of keys that should be shown exclusively (if any "showOnly" group exists)
     */
    private fun buildGroupsMap(groups: List<Group>): Pair<Map<String, GroupTemplate>, Set<String>?> {
        val groupsMap = mutableMapOf<String, GroupTemplate>()
        var showOnlyKeys: Set<String>? = null
        
        for (group in groups) {
            // Check if this group has "showOnly" visibility mode
            val visMode = group.template.effectiveVisibilityMode
            
            if (visMode == VisibilityMode.SHOW_ONLY) {
                // Collect keys that should be visible
                if (showOnlyKeys == null) {
                    showOnlyKeys = mutableSetOf()
                }
                for (item in group.items) {
                    (showOnlyKeys as MutableSet).add(item)
                }
            }
            
            // Store template for all items (for colors, etc.)
            for (item in group.items) {
                groupsMap[item] = group.template
            }
        }
        
        return Pair(groupsMap, showOnlyKeys)
    }
    
    /**
     * Determine if a key should be hidden based on visibility rules
     * @param parsedKey The parsed key configuration
     * @param keyValue The key's value (for special keys, use type)
     * @param showOnlyKeys If set, only these keys should be visible
     * @param groups The groups map for checking individual key visibility
     * @return True if the key should be hidden
     */
    private fun isKeyHiddenByVisibility(
        parsedKey: ParsedKey,
        keyValue: String,
        showOnlyKeys: Set<String>?,
        groups: Map<String, GroupTemplate>
    ): Boolean {
        // First check the base hidden property
        if (parsedKey.hidden) {
            return true
        }
        
        // Check if the key's group has an explicit "hide" visibility mode
        val template = groups[keyValue]
        if (template != null) {
            val visMode = template.effectiveVisibilityMode
            if (visMode == VisibilityMode.HIDE) {
                return true
            }
        }
        
        // If there's a "showOnly" rule active, check if this key is in the whitelist
        if (showOnlyKeys != null) {
            // Essential keys that are NEVER hidden by showOnly rule (only by explicit hide)
            val essentialValues = setOf(" ", ",", ".")  // space, comma, period
            val essentialTypes = setOf("space", "backspace", "enter")
            
            // Check if this is an essential key by value or type
            if (essentialValues.contains(keyValue) || essentialTypes.contains(parsedKey.type.lowercase())) {
                // Essential keys are NOT hidden by showOnly rule
                return false
            }
            
            // Other special keys should check if they're in the whitelist
            val specialTypes = setOf("shift", "keyset", "nikkud", "settings", "close", "next-keyboard", "language")
            if (specialTypes.contains(parsedKey.type.lowercase())) {
                // Check if this special key is explicitly in the showOnly set
                return !showOnlyKeys.contains(keyValue) && !showOnlyKeys.contains(parsedKey.type.lowercase())
            }
            
            // For regular keys, hide if not in the showOnly set
            return !showOnlyKeys.contains(keyValue)
        }
        
        return false
    }
    
    private fun calculateBaselineWidth(rows: List<KeyRow>, groups: Map<String, GroupTemplate>, showOnlyKeys: Set<String>?): Double {
        var maxRowWidth = 0.0
        
        val hasOnlyOneLanguage = (config?.keyboards?.size ?: 0) <= 1
        val isNikkudDisabled = config?.diacriticsSettings?.get(currentKeyboardId ?: "")?.isDisabled ?: false
        
        // Get current field type for showForField filtering
        val fieldType = editorContext?.fieldType
        
        for (row in rows) {
            var rowWidth = 0.0
            for (key in row.keys) {
                val parsedKey = ParsedKey.from(key, groups, Color.BLACK, Color.WHITE)
                
                val keyType = parsedKey.type.lowercase()
                if (hasOnlyOneLanguage && keyType == "language" || !showGlobeButton && keyType == "next-keyboard") {
                    continue
                }
                
                // Skip nikkud key if disabled
                if (keyType == "nikkud" && isNikkudDisabled) {
                    continue
                }
                
                // Skip keys hidden by showOn filter (screen size conditional keys)
                if (!key.shouldShow(isLargeScreen)) {
                    continue
                }
                
                // Skip keys hidden by showForField filter (field type conditional keys)
                if (!key.shouldShow(fieldType)) {
                    continue
                }
                
                // Check if key is hidden via group "hide" visibility mode
                // Note: parsedKey.hidden keys (spacers) still take up space in layout
                val keyValue = key.value ?: key.type ?: ""
                val isHiddenByGroup = groups[keyValue]?.effectiveVisibilityMode == VisibilityMode.HIDE
                
                if (!isHiddenByGroup && !parsedKey.hidden) {
                    rowWidth += parsedKey.width + parsedKey.offset
                }
            }
            
            if (rowWidth > maxRowWidth) {
                maxRowWidth = rowWidth
            }
        }
        
        return if (maxRowWidth > 0) maxRowWidth else 10.0
    }
    
    private fun createRow(
        row: KeyRow,
        groups: Map<String, GroupTemplate>,
        showOnlyKeys: Set<String>?,
        baselineWidth: Double,
        availableWidth: Int,
        editorContext: EditorContext?,
        keysetId: String,
        rowIndex: Int
    ): ViewGroup {
        val rowContainer = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                rowHeight
            ).apply {
                setMargins(dpToPx(4), 0, dpToPx(4), 0)
            }
        }
        
        // Track first and last visible keys for tap area extension
        var firstVisibleKey: QuadTuple<ParsedKey, View, Int, Int>? = null
        var lastVisibleKey: QuadTuple<ParsedKey, View, Int, Int>? = null
        
        val hasOnlyOneLanguage = (config?.keyboards?.size ?: 0) <= 1
        val isNikkudDisabled = config?.diacriticsSettings?.get(currentKeyboardId ?: "")?.isDisabled ?: false
        
        // Get current field type for showForField filtering
        val fieldType = editorContext?.fieldType
        
        // FIRST PASS: Calculate hidden width due to showOn/showForField filters and count flex keys
        var hiddenWidthFromShowOn = 0.0
        var flexKeyCount = 0
        
        for (key in row.keys) {
            val parsedKey = ParsedKey.from(key, groups, Color.BLACK, Color.WHITE)
            
            val keyType = parsedKey.type.lowercase()
            
            // Skip language/next-keyboard keys
            if ((keyType == "language" && hasOnlyOneLanguage) || (keyType == "next-keyboard" && !showGlobeButton)) {
                continue
            }
            
            // Skip nikkud key if disabled
            if (keyType == "nikkud" && isNikkudDisabled) {
                continue
            }
            
            // Check if key is hidden due to showOn filter (screen size)
            if (!key.shouldShow(isLargeScreen)) {
                // Accumulate the width of hidden keys
                hiddenWidthFromShowOn += parsedKey.width
                continue
            }
            
            // Check if key is hidden due to showForField filter (field type)
            if (!key.shouldShow(fieldType)) {
                // Accumulate the width of hidden keys
                hiddenWidthFromShowOn += parsedKey.width
                continue
            }
            
            // Count flex keys
            if (key.flex == true) {
                flexKeyCount++
            }
        }
        
        // Calculate extra width per flex key
        val extraWidthPerFlexKey = if (flexKeyCount > 0) hiddenWidthFromShowOn / flexKeyCount else 0.0
        
        // SECOND PASS: Render keys with redistributed width and track edge keys
        var keyIndex = 0
        for (key in row.keys) {
            val parsedKey = ParsedKey.from(key, groups, Color.BLACK, Color.WHITE)
            
            val keyType = parsedKey.type.lowercase()
            
            // Skip language/next-keyboard keys
            if ((keyType == "language" && hasOnlyOneLanguage) || (keyType == "next-keyboard" && !showGlobeButton)) {
                keyIndex++
                continue
            }
            
            // Skip nikkud key if disabled
            if (keyType == "nikkud" && isNikkudDisabled) {
                keyIndex++
                continue
            }
            
            // Skip key if it doesn't match the current screen size (showOn filter)
            if (!key.shouldShow(isLargeScreen)) {
                keyIndex++
                continue  // Don't add hidden width - it goes to flex keys instead
            }
            
            // Skip key if it doesn't match the current field type (showForField filter)
            if (!key.shouldShow(fieldType)) {
                keyIndex++
                continue  // Don't add hidden width - it goes to flex keys instead
            }
            
            // Handle offset
            if (parsedKey.offset > 0) {
                val offsetWidth = ((parsedKey.offset / baselineWidth) * availableWidth).toInt()
                val spacer = View(context)
                spacer.layoutParams = LinearLayout.LayoutParams(offsetWidth, rowHeight)
                rowContainer.addView(spacer)
            }
            
            // Generate key identifier for selection checking
            val keyId = "$keysetId:$rowIndex:$keyIndex"
            val isSelected = selectedKeyIds.contains(keyId)
            
            // Check if key is hidden based on visibility rules (hide/showOnly)
            val keyValue = key.value ?: key.type ?: ""
            val isKeyHidden = isKeyHiddenByVisibility(parsedKey, keyValue, showOnlyKeys, groups)
            
            if (isKeyHidden) {
                // Hidden key - add spacer to preserve layout
                val hiddenWidth = ((parsedKey.width / baselineWidth) * availableWidth).toInt()
                val hiddenSpacer = View(context)
                hiddenSpacer.layoutParams = LinearLayout.LayoutParams(hiddenWidth, rowHeight)
                rowContainer.addView(hiddenSpacer)
            } else if (parsedKey.hidden) {
                val hiddenWidth = ((parsedKey.width / baselineWidth) * availableWidth).toInt()
                val hiddenSpacer = View(context)
                hiddenSpacer.layoutParams = LinearLayout.LayoutParams(hiddenWidth, rowHeight)
                rowContainer.addView(hiddenSpacer)
            } else {
                // Calculate key width, adding extra width if this is a flex key
                var effectiveWidth = parsedKey.width
                if (key.flex == true) {
                    effectiveWidth += extraWidthPerFlexKey
                }
                
                val keyWidth = ((effectiveWidth / baselineWidth) * availableWidth).toInt() - keySpacing
                if (keyIndex == 0 && rowIndex == 0) {
                    debugLog("📐 First key: width=$keyWidth, height=$rowHeight, caption='${parsedKey.caption}', value='${parsedKey.value}'")
                }
                val button = createKeyButton(parsedKey, keyWidth, rowHeight, editorContext, isSelected)
                rowContainer.addView(button)
                
                // Track first visible key
                if (firstVisibleKey == null) {
                    // Calculate x position from existing children
                    var currentX = 0
                    for (i in 0 until rowContainer.childCount - 1) {
                        val child = rowContainer.getChildAt(i)
                        currentX += child.layoutParams.width
                    }
                    firstVisibleKey = QuadTuple(parsedKey, button, currentX, keyWidth)
                }
                // Always update last visible key
                var currentX = 0
                for (i in 0 until rowContainer.childCount - 1) {
                    val child = rowContainer.getChildAt(i)
                    currentX += child.layoutParams.width
                }
                lastVisibleKey = QuadTuple(parsedKey, button, currentX, keyWidth)
            }
            
            keyIndex++
        }
        
        // THIRD PASS: Add extended tap areas for first and last keys
        firstVisibleKey?.let { first ->
            addExtendedTapArea(
                key = first.first,
                button = first.second,
                keyX = first.third,
                keyWidth = first.fourth,
                rowHeight = rowHeight,
                availableWidth = availableWidth,
                isLeftEdge = true,
                container = rowContainer
            )
        }
        
        lastVisibleKey?.let { last ->
            if (last.second !== firstVisibleKey?.second) {
                addExtendedTapArea(
                    key = last.first,
                    button = last.second,
                    keyX = last.third,
                    keyWidth = last.fourth,
                    rowHeight = rowHeight,
                    availableWidth = availableWidth,
                    isLeftEdge = false,
                    container = rowContainer
                )
            }
        }
        
        return rowContainer
    }
    
    /**
     * Add extended tap area for edge keys (left or right)
     */
    private fun addExtendedTapArea(
        key: ParsedKey,
        button: View,
        keyX: Int,
        keyWidth: Int,
        rowHeight: Int,
        availableWidth: Int,
        isLeftEdge: Boolean,
        container: LinearLayout
    ) {
        // Calculate extension: max half button width
        val maxExtension = keyWidth / 2
        
        // Calculate actual extension based on available space and screen boundaries
        val extensionWidth = if (isLeftEdge) {
            // Left edge: extend to the left, but not beyond x=0
            minOf(maxExtension, keyX)
        } else {
            // Right edge: extend to the right, but not beyond screen boundary
            val rightEdge = keyX + keyWidth
            val spaceToRight = availableWidth - rightEdge
            minOf(maxExtension, spaceToRight)
        }
        
        // Only add extension if there's actual space
        if (extensionWidth <= 0) return
        
        // Create invisible view for the extended area
        val extendedArea = FrameLayout(context).apply {
            layoutParams = LinearLayout.LayoutParams(extensionWidth, rowHeight)
            setBackgroundColor(android.graphics.Color.TRANSPARENT)
        }
        
        // Set up touch handling to delegate to the main button
        extendedArea.setOnClickListener {
            handleKeyClick(key, button)
        }
        
        // For backspace key, also handle long press
        if (key.type.lowercase() == "backspace") {
            extendedArea.setOnTouchListener { _, event ->
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        debugLog("⌫ Backspace extensionWidth touch DOWN")
                        backspaceHandler.handleTouchDown()
                        true
                    }
                    MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                        debugLog("⌫ Backspace extensionWidth touch UP")
                        backspaceHandler.handleTouchUp()
                        true
                    }
                    else -> false
                }
            }
        }
        
        // Store key info in tag for later retrieval
        extendedArea.tag = encodeKeyInfo(key)
        
        // Add extensionWidth to container at appropriate position
        if (isLeftEdge) {
            // Insert before the first visible key
            val buttonIndex = container.indexOfChild(button)
            container.addView(extendedArea, buttonIndex)
        } else {
            // Add after the last visible key
            container.addView(extendedArea)
        }
    }
    
    // Helper data class for tracking visible keys (since Kotlin doesn't have tuples)
    private data class QuadTuple<A, B, C, D>(
        val first: A,
        val second: B,
        val third: C,
        val fourth: D
    )
    
    @SuppressLint("ClickableViewAccessibility")
    private fun createKeyButton(
        key: ParsedKey,
        width: Int,
        height: Int,
        editorContext: EditorContext?,
        isSelected: Boolean = false
    ): View {
        // Create main button container
        val buttonContainer = FrameLayout(context).apply {
            layoutParams = LinearLayout.LayoutParams(width, height)
        }
        
        // Create visual key view with padding
        val visualKeyView = FrameLayout(context).apply {
            val bgDrawable = GradientDrawable().apply {
                // Default to white for ALL keys on Android (no transparency)
                // The key.backgroundColor might be transparent from iOS defaults which doesn't work on Android
                var bgColor = Color.WHITE  // Always default to white
                
                // Only use the key's background color if it's actually a visible color (not transparent)
                if (key.backgroundColor != Color.TRANSPARENT && 
                    key.backgroundColor != 0 && 
                    Color.alpha(key.backgroundColor) == 255) {
                    bgColor = key.backgroundColor
                }
                
                // Handle special key states
                if (key.type.lowercase() == "shift" && shiftState.isActive()) {
                    bgColor = Color.parseColor("#4CAF50")  // systemGreen
                } else if (key.type.lowercase() == "nikkud" && nikkudActive) {
                    bgColor = Color.parseColor("#FFEB3B")  // systemYellow
                }
                
                setColor(bgColor)
                cornerRadius = keyCornerRadius
            }
            background = bgDrawable
            elevation = dpToPx(2).toFloat()
            
            if (isSelected) {
                val selectedBg = background as? GradientDrawable
                selectedBg?.setStroke(dpToPx(3), Color.parseColor("#2196F3"))
            }
        }
        
        // Create label
        val label = TextView(context).apply {
            gravity = Gravity.CENTER
            
            // Determine display text based on shift state
            val displayText = if (shiftState.isActive()) key.sCaption else key.caption
            
            // Determine final text
            val finalText = when {
                key.label.isNotEmpty() -> key.label
                displayText.isNotEmpty() -> displayText
                key.value.isNotEmpty() -> key.value
                else -> getDefaultLabel(key.type, editorContext)
            }
            
            text = finalText
            
            // Font size
            val isLargeKey = listOf("shift", "backspace", "enter").contains(key.type.lowercase())
            val isMultiChar = finalText.length > 1
            val baseFontSize = if (isLargeKey) largeFontSize else fontSize
            textSize = if (isMultiChar) minOf(baseFontSize * 0.7f, 14f) else baseFontSize
            
            // Text color
            setTextColor(if (key.textColor == Color.BLACK) Color.BLACK else key.textColor)
            
            // Apply custom font if configured
            // Font applies to character keys in "abc" keysets (not special keys)
            val isCharacterKey = key.type.lowercase() !in listOf(
                "shift", "backspace", "enter", "keyset", "space", 
                "settings", "close", "next-keyboard", "language", "nikkud"
            )
            
            // Check if we're in an "abc" keyset (not "123" or "#+=" keysets)
            val isAbcKeyset = currentKeysetId.endsWith("_abc") || currentKeysetId == "abc"
            
            val shouldUseCustomFont = isCharacterKey && isAbcKeyset && config?.fontName != null
            
            if (shouldUseCustomFont) {
                try {
                    val fontName = config?.fontName
                    if (fontName != null) {
                        // Load font from assets/fonts/
                        val typeface = Typeface.createFromAsset(context.assets, "fonts/$fontName")
                        setTypeface(typeface, Typeface.NORMAL)
                    }
                } catch (e: Exception) {
                    debugLog("⚠️ Failed to load custom font: ${e.message}")
                    setTypeface(typeface, Typeface.NORMAL)
                }
            } else {
                setTypeface(typeface, Typeface.NORMAL)
            }
        }
        
        visualKeyView.addView(label, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))
        
        // Add visual key view with padding
        buttonContainer.addView(visualKeyView, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ).apply {
            setMargins(keyInternalPadding, keyInternalPadding, keyInternalPadding, keyInternalPadding)
        })
        
        // Set up touch handling
        if (key.type.lowercase() == "backspace") {
            buttonContainer.setOnTouchListener { _, event ->
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        debugLog("⌫ Backspace touch DOWN")
                        backspaceHandler.handleTouchDown()
                        true
                    }
                    MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                        debugLog("⌫ Backspace touch UP")
                        backspaceHandler.handleTouchUp()
                        true
                    }
                    else -> false
                }
            }
        } else {
            buttonContainer.setOnClickListener {
                handleKeyClick(key, it)
            }
            
            // Add long-press listener for space (cursor movement), nikkud (activate), and keyset (edit mode selection)
            val keyType = key.type.lowercase()
            if (keyType == "space" || key.value == " ") {
                // Space key: long-press for cursor movement
                var longPressHandler: android.os.Handler? = null
                var longPressRunnable: Runnable? = null
                
                buttonContainer.setOnTouchListener { _, event ->
                    when (event.action) {
                        MotionEvent.ACTION_DOWN -> {
                            // Start long-press timer for cursor mode
                            longPressHandler = android.os.Handler(android.os.Looper.getMainLooper())
                            longPressRunnable = Runnable {
                                spaceLongPressAction(event, buttonContainer)
                            }
                            longPressHandler?.postDelayed(longPressRunnable!!, 500)
                            false
                        }
                        MotionEvent.ACTION_MOVE -> {
                            if (cursorMoveMode) {
                                spaceLongPressAction(event, buttonContainer)
                                true
                            } else {
                                false
                            }
                        }
                        MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                            longPressHandler?.removeCallbacks(longPressRunnable!!)
                            if (cursorMoveMode) {
                                // End cursor mode
                                spaceLongPressEnd()
                                true
                            } else {
                                // Normal tap - let click listener handle it
                                false
                            }
                        }
                        else -> false
                    }
                }
            } else if (keyType == "nikkud") {
                // Nikkud key: requires 0.5 sec long-press to activate (when inactive), normal tap to deactivate (when active)
                var longPressHandler: android.os.Handler? = null
                var longPressRunnable: Runnable? = null
                
                buttonContainer.setOnTouchListener { _, event ->
                    when (event.action) {
                        MotionEvent.ACTION_DOWN -> {
                            if (!nikkudActive) {
                                // Inactive: start long-press timer
                                longPressHandler = android.os.Handler(android.os.Looper.getMainLooper())
                                longPressRunnable = Runnable {
                                    debugLog("🔑 Nikkud long-pressed - activating")
                                    nikkudActive = true
                                    rerender()
                                }
                                longPressHandler?.postDelayed(longPressRunnable!!, 500)
                            }
                            false
                        }
                        MotionEvent.ACTION_UP -> {
                            longPressHandler?.removeCallbacks(longPressRunnable!!)
                            if (nikkudActive) {
                                // Active: normal tap deactivates
                                debugLog("🔑 Nikkud tapped - deactivating")
                                nikkudActive = false
                                updateNikkudKeyVisual(buttonContainer)
                                true
                            } else {
                                // Inactive and released before 0.5 sec: ignore
                                debugLog("🔑 Nikkud tapped too quickly - requires 0.5 sec press")
                                false
                            }
                        }
                        MotionEvent.ACTION_CANCEL -> {
                            longPressHandler?.removeCallbacks(longPressRunnable!!)
                            false
                        }
                        else -> false
                    }
                }
            } else if (keyType == "keyset") {
                // Keyset: long-press for edit mode selection
                buttonContainer.setOnLongClickListener {
                    debugLog("🔑 Key long-pressed for selection: type='${key.type}'")
                    onKeyLongPress?.invoke(key)
                    true
                }
            }
        }
        
        // Store key info in tag for later retrieval
        buttonContainer.tag = encodeKeyInfo(key)
        
        return buttonContainer
    }
    
    private fun getDefaultLabel(type: String, editorContext: EditorContext?): String {
        return when (type.lowercase()) {
            "backspace" -> "⌫"
            "enter", "action" -> editorContext?.enterLabel ?: "↵"
            "shift" -> if (shiftState == ShiftState.LOCKED) "⇪" else "⇧"
            "settings" -> "⚙"
            "close" -> "⬇"
            "language" -> "<->"
            "next-keyboard" -> "🌐"
            "nikkud" -> when (currentKeyboardId) {
                "he" -> " \u05B3"  // Hataf-kamatz
                "ar" -> "◌\u0651"  // Shadda
                else -> "◌"
            }
            "space" -> "SPACE"
            else -> type.uppercase()
        }
    }
    
    fun handleKeyClick(key: ParsedKey, keyView: View) {
        debugLog("🔑 Key clicked: type='${key.type}', value='${key.value}'")
        
        when (key.type.lowercase()) {
            "shift" -> {
                debugLog("   → Handling SHIFT")
                handleShiftTap()
            }
            
            "nikkud" -> {
                debugLog("   → Handling NIKKUD")
                nikkudActive = !nikkudActive
                // Update only the nikkud key's background color without full re-render
                updateNikkudKeyVisual(keyView)
            }
            
            "keyset" -> {
                debugLog("   → Handling KEYSET: keysetValue='${key.keysetValue}'")
                
                if (key.keysetValue.isNotEmpty()) {
                    val returnState = keysetButtonReturnState[currentKeysetId]
                    if (returnState != null && key.returnKeysetValue == returnState.first) {
                        debugLog("   → Return mode detected! Returning to '${returnState.first}'")
                        keysetButtonReturnState.remove(currentKeysetId)
                        switchKeyset(returnState.first)
                    } else {
                        if (key.returnKeysetValue.isNotEmpty() && key.returnKeysetLabel.isNotEmpty()) {
                            keysetButtonReturnState[key.keysetValue] = Pair(key.returnKeysetValue, key.returnKeysetLabel)
                        }
                        switchKeyset(key.keysetValue)
                    }
                }
            }
            
            "next-keyboard" -> {
                debugLog("   → Handling NEXT-KEYBOARD")
                val callback = onNextKeyboard
                if (callback != null) {
                    debugLog("   → Calling onNextKeyboard (actual keyboard)")
                    callback()
                } else {
                    debugLog("   → Preview mode: switching language and emitting event")
                    switchLanguage()
                    onKeyPress?.invoke(key)
                }
            }
            
            "close" -> {
                debugLog("   → Handling CLOSE")
                onDismissKeyboard?.invoke()
            }
            
            "settings" -> {
                debugLog("   → Handling SETTINGS")
                onOpenSettings?.invoke()
            }
            
            else -> {
                debugLog("   → Handling DEFAULT key")
                
                val shouldShowDiacritics = shouldShowDiacriticsPopup(key)
                
                if (nikkudActive && shouldShowDiacritics) {
                    val diacriticsOptions = getDiacriticsForKey(key)
                    if (diacriticsOptions.isNotEmpty()) {
                        showNikkudPicker(diacriticsOptions, keyView)
                    } else {
                        onKeyPress?.invoke(key)
                        if (shiftState == ShiftState.ACTIVE) {
                            shiftState = ShiftState.INACTIVE
                            rerender()
                        }
                    }
                } else {
                    onKeyPress?.invoke(key)
                    
                    if (shiftState == ShiftState.ACTIVE) {
                        shiftState = ShiftState.INACTIVE
                        rerender()
                    }
                }
            }
        }
    }
    
    /** Internal re-render */
    private fun rerender() {
        val container = container ?: return
        val config = config ?: return
        // Preserve overlayContainer during internal re-renders
        renderKeyboard(container, config, currentKeysetId, editorContext, overlayContainer)
        // Notify that state changed so container can refresh layout
        onStateChange?.invoke()
    }
    
    /** Internal re-render without layout refresh (for visual-only changes like nikkud toggle) */
    private fun rerenderWithoutLayoutRefresh() {
        val container = container ?: return
        val config = config ?: return
        // Re-render without calling onStateChange to avoid blink
        renderKeyboard(container, config, currentKeysetId, editorContext, overlayContainer)
    }
    
    private fun encodeKeyInfo(key: ParsedKey): String {
        return try {
            val obj = JSONObject()
            obj.put("type", key.type)
            obj.put("value", key.value)
            obj.put("sValue", key.sValue)
            obj.put("keysetValue", key.keysetValue)
            obj.put("returnKeysetValue", key.returnKeysetValue)
            obj.put("returnKeysetLabel", key.returnKeysetLabel)
            obj.put("label", key.label)
            obj.put("hasNikkud", key.nikkud.isNotEmpty())
            
            if (key.nikkud.isNotEmpty()) {
                val nikkudArray = JSONArray()
                for (option in key.nikkud) {
                    val nikkudObj = JSONObject()
                    nikkudObj.put("value", option.value)
                    nikkudObj.put("caption", option.caption ?: option.value)
                    nikkudArray.put(nikkudObj)
                }
                obj.put("nikkud", nikkudArray)
            }
            
            obj.toString()
        } catch (e: Exception) {
            "{}"
        }
    }
    
    private fun showError(container: ViewGroup, message: String) {
        val errorLabel = TextView(context).apply {
            text = message
            gravity = Gravity.CENTER
            setTextColor(Color.RED)
        }
        container.addView(errorLabel, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))
    }
    
    // MARK: - Nikkud Picker (delegates to NikkudPickerController)
    
    private fun shouldShowDiacriticsPopup(key: ParsedKey): Boolean {
        // Use overlayContainer for nikkud picker (must be FrameLayout for overlay to work)
        nikkudPickerController.configure(config, currentKeyboardId, overlayContainer)
        return nikkudPickerController.shouldShowDiacriticsPopup(key)
    }
    
    private fun getDiacriticsForKey(key: ParsedKey): List<NikkudOption> {
        // Use overlayContainer for nikkud picker (must be FrameLayout for overlay to work)
        nikkudPickerController.configure(config, currentKeyboardId, overlayContainer)
        return nikkudPickerController.getDiacriticsForKey(key)
    }
    
    private fun showNikkudPicker(nikkudOptions: List<NikkudOption>, anchorView: View) {
        val firstOption = nikkudOptions.firstOrNull() ?: return
        val firstChar = firstOption.value.firstOrNull() ?: return
        
        val tempKey = Key(
            value = firstChar.toString(),
            sValue = null,
            caption = null,
            sCaption = null,
            type = "character",
            width = null,
            offset = null,
            hidden = null,
            color = null,
            bgColor = null,
            label = null,
            keysetValue = null,
            returnKeysetValue = null,
            returnKeysetLabel = null,
            nikkud = nikkudOptions
        )
        val parsedKey = ParsedKey.from(tempKey, emptyMap(), Color.BLACK, Color.WHITE)
        
        // Use overlayContainer for nikkud picker (must be FrameLayout for overlay to work)
        nikkudPickerController.configure(config, currentKeyboardId, overlayContainer)
        nikkudPickerController.showPicker(parsedKey, anchorView)
    }
    
    // MARK: - Shift Handling
    
    private fun handleShiftTap() {
        val currentTime = System.currentTimeMillis()
        
        if (currentTime - lastShiftClickTime < doubleClickThreshold) {
            debugLog("   → Shift double-click detected")
            shiftState = if (shiftState == ShiftState.LOCKED) ShiftState.INACTIVE else ShiftState.LOCKED
        } else {
            shiftState = shiftState.toggle()
        }
        
        lastShiftClickTime = currentTime
        debugLog("   → New shift state: $shiftState")
        rerender()
    }
    
    /** Check if shift is currently active (either active or locked) */
    fun isShiftActive(): Boolean {
        return shiftState.isActive()
    }
    
    /** Activate shift (set to active state, not locked) */
    fun activateShift() {
        debugLog("🎯 KeyboardRenderer.activateShift() called, current state: $shiftState")
        if (shiftState == ShiftState.INACTIVE) {
            shiftState = ShiftState.ACTIVE
            debugLog("🎯 Shift state set to ACTIVE")
        } else {
            debugLog("🎯 Shift already active/locked, not changing")
        }
    }
    
    /** Deactivate shift (set to inactive state) */
    fun deactivateShift() {
        debugLog("🎯 KeyboardRenderer.deactivateShift() called, current state: $shiftState")
        if (shiftState == ShiftState.ACTIVE) {
            shiftState = ShiftState.INACTIVE
            debugLog("🎯 Shift state set to INACTIVE")
        } else {
            debugLog("🎯 Shift not in ACTIVE state (is $shiftState), not changing")
        }
    }
    
    // MARK: - Suggestions Bar
    
    private fun updateSuggestionsBar() {
        suggestionsBarView.currentKeyboardId = currentKeyboardId
        suggestionsBarView.updateSuggestions(currentSuggestions, suggestionHighlightIndex)
    }
    
    // MARK: - Keyset Switching
    
    private fun switchKeyset(keysetValue: String) {
        if (keysetValue.isEmpty()) return
        val config = config ?: return
        
        val allKeysetIds = config.keysets.map { it.id }
        debugLog("switchKeyset: switching to '$keysetValue', available: $allKeysetIds")
        
        if (allKeysetIds.contains(keysetValue)) {
            debugLog("switchKeyset: switching from '$currentKeysetId' to '$keysetValue'")
            currentKeysetId = keysetValue
            shiftState = ShiftState.INACTIVE
            nikkudActive = false
            rerender()
        } else {
            debugLog("⚠️ Keyset not found: '$keysetValue'. Available: $allKeysetIds")
        }
    }
    
    // MARK: - Language Switching
    
    fun switchLanguage() {
        debugLog("🌐 Language button tapped - cycling to next language")
        
        val config = config
        if (config == null) {
            debugLog("❌ No config available")
            return
        }
        
        val allKeysetIds = config.keysets.map { it.id }
        debugLog("   All keysets: ${allKeysetIds.joinToString(", ")}")
        debugLog("   Current keyset: $currentKeysetId")
        
        // Determine current keyset type
        val currentKeysetType = when {
            currentKeysetId.endsWith("_abc") -> "abc"
            currentKeysetId.endsWith("_123") -> "123"
            currentKeysetId.endsWith("_#+=") -> "#+="
            currentKeysetId == "abc" -> "abc"
            currentKeysetId == "123" -> "123"
            currentKeysetId == "#+=" -> "#+="
            else -> "abc"
        }
        
        debugLog("   Current keyset type: $currentKeysetType")
        
        // Find all keysets of the same type
        val sameTypeKeysets = allKeysetIds.filter { keysetId ->
            keysetId == currentKeysetType || keysetId.endsWith("_$currentKeysetType")
        }
        
        debugLog("   Same type keysets ($currentKeysetType): ${sameTypeKeysets.joinToString(", ")}")
        
        if (sameTypeKeysets.size > 1) {
            val currentIndex = sameTypeKeysets.indexOf(currentKeysetId)
            if (currentIndex >= 0) {
                val nextIndex = (currentIndex + 1) % sameTypeKeysets.size
                val nextKeysetId = sameTypeKeysets[nextIndex]
                
                debugLog("   Switching from $currentKeysetId to $nextKeysetId")
                currentKeysetId = nextKeysetId
                shiftState = ShiftState.INACTIVE
                
                onKeysetChanged?.invoke(currentKeysetId)
                rerender()
            } else {
                debugLog("⚠️ Current keyset not found in same-type list")
            }
        } else {
            debugLog("   Only one keyboard available for type $currentKeysetType")
        }
    }
    
    // MARK: - Visual Updates (without full re-render)
    
    /** Update only the nikkud key's background color without full re-render */
    private fun updateNikkudKeyVisual(keyView: View) {
        debugLog("🎨 updateNikkudKeyVisual: nikkudActive=$nikkudActive")
        
        // keyView is the button container (FrameLayout)
        // The visual key is the first child (also a FrameLayout with background)
        val container = keyView as? ViewGroup ?: return
        val visualKeyView = container.getChildAt(0) as? ViewGroup ?: return
        
        val bgDrawable = visualKeyView.background as? GradientDrawable
        if (bgDrawable != null) {
            val newColor = if (nikkudActive) {
                Color.parseColor("#FFEB3B")  // systemYellow
            } else {
                Color.WHITE
            }
            bgDrawable.setColor(newColor)
            visualKeyView.invalidate()
            debugLog("🎨 Updated nikkud key background to: ${if (nikkudActive) "yellow" else "white"}")
        }
    }
    
    // MARK: - Cursor Movement
    
    /** Handle space long-press action (begin or move) */
    private fun spaceLongPressAction(event: MotionEvent, view: View) {
        if (!cursorMoveMode) {
            // Begin cursor mode
            debugLog("🔄 Space long-press BEGAN - entering cursor move mode")
            cursorMoveMode = true
            cursorMoveStartPoint = android.graphics.PointF(event.rawX, event.rawY)
            cursorMoveAccumulatedDistance = 0f
            
            // Lock text direction at the start of the session
            cursorMoveDirectionIsRTL = onGetTextDirection?.invoke() ?: isCurrentKeyboardRTL()
            debugLog("🔄 Direction locked: isRTL=$cursorMoveDirectionIsRTL")
            
            // Clear suggestions while in cursor mode
            clearSuggestions()
            
            // Dim all keys to indicate cursor mode
            dimKeysForCursorMode(true)
        } else {
            // Continue cursor movement
            val currentPoint = android.graphics.PointF(event.rawX, event.rawY)
            val deltaX = currentPoint.x - cursorMoveStartPoint.x
            
            // Add to accumulated distance
            cursorMoveAccumulatedDistance += deltaX
            
            // Check if we've moved enough to trigger a cursor movement
            val charactersToMove = (cursorMoveAccumulatedDistance / cursorMoveSensitivity).toInt()
            
            if (charactersToMove != 0) {
                // Use the locked direction from session start
                var offset = charactersToMove
                
                // Reverse direction for RTL text
                if (cursorMoveDirectionIsRTL) {
                    offset = -offset
                }
                
                debugLog("🔄 Cursor move: deltaX=$deltaX, accumulated=$cursorMoveAccumulatedDistance, isRTL=$cursorMoveDirectionIsRTL, moving $offset characters")
                
                // Move cursor via callback
                onCursorMove?.invoke(offset)
                
                // Reset accumulated distance by the amount we just moved
                cursorMoveAccumulatedDistance -= charactersToMove * cursorMoveSensitivity
                
                // Update start point for next delta calculation
                cursorMoveStartPoint = currentPoint
            }
        }
    }
    
    /** End space long-press (exit cursor mode) */
    private fun spaceLongPressEnd() {
        debugLog("🔄 Space long-press ENDED - exiting cursor move mode")
        cursorMoveMode = false
        cursorMoveStartPoint = android.graphics.PointF(0f, 0f)
        cursorMoveAccumulatedDistance = 0f
        
        // Restore normal key appearance
        dimKeysForCursorMode(false)
    }
    
    /** Dim or restore keys for cursor movement mode */
    private fun dimKeysForCursorMode(shouldDim: Boolean) {
        val container = container ?: return
        
        val alpha = if (shouldDim) 0.3f else 1.0f
        
        // Find all key labels and dim/restore them
        dimViewsRecursively(container, alpha)
    }
    
    /** Recursively dim all TextViews (key labels) */
    private fun dimViewsRecursively(view: View, alpha: Float) {
        if (view is TextView) {
            view.animate().alpha(alpha).setDuration(200).start()
        } else if (view is ViewGroup) {
            // Skip suggestions bar and nikkud picker
            if (view.tag == 999 || view == suggestionsBar) {
                return
            }
            
            for (i in 0 until view.childCount) {
                dimViewsRecursively(view.getChildAt(i), alpha)
            }
        }
    }
    
    /** Check if the current keyboard is RTL (Hebrew or Arabic) */
    private fun isCurrentKeyboardRTL(): Boolean {
        val keyboardId = currentKeyboardId ?: return false
        return keyboardId == "he" || keyboardId == "ar"
    }
    
    /** Check if currently in cursor movement mode */
    fun isInCursorMoveMode(): Boolean {
        return cursorMoveMode
    }
    
    // MARK: - Utility
    
    private fun dpToPx(dp: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            dp.toFloat(),
            context.resources.displayMetrics
        ).toInt()
    }
}
