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
    private var config: KeyboardConfig? = null
    var currentKeysetId: String = "abc"  // Public so container can read it
    private var editorContext: EditorContext? = null
    
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
    
    // Layout tracking to prevent infinite loops
    private var lastRenderedWidth: Int = 0
    
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
    fun calculateKeyboardHeight(config: KeyboardConfig, keysetId: String): Int {
        val keyset = config.keysets.find { it.id == keysetId } ?: return dpToPx(216)
        
        val numberOfRows = keyset.rows.size
        val rowsHeight = numberOfRows * rowHeight
        val spacingHeight = max(0, numberOfRows - 1) * rowSpacing
        val suggestionsHeight = if (config.isWordSuggestionsEnabled) suggestionsBarHeight + dpToPx(4) else 0
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
        
        // Build groups map
        val groups = buildGroupsMap(config.groups ?: emptyList())
        
        // Calculate baseline width
        val baselineWidth = calculateBaselineWidth(keyset.rows, groups)
        
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
                groups = groups,
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
    
    private fun buildGroupsMap(groups: List<Group>): Map<String, GroupTemplate> {
        val groupsMap = mutableMapOf<String, GroupTemplate>()
        for (group in groups) {
            for (item in group.items) {
                groupsMap[item] = group.template
            }
        }
        return groupsMap
    }
    
    private fun calculateBaselineWidth(rows: List<KeyRow>, groups: Map<String, GroupTemplate>): Double {
        var maxRowWidth = 0.0
        
        val hasOnlyOneLanguage = (config?.keyboards?.size ?: 0) <= 1
        
        for (row in rows) {
            var rowWidth = 0.0
            for (key in row.keys) {
                val parsedKey = ParsedKey.from(key, groups, Color.BLACK, Color.WHITE)
                
                val keyType = parsedKey.type.lowercase()
                if (hasOnlyOneLanguage && keyType == "language" || !showGlobeButton && keyType == "next-keyboard") {
                    continue
                }
                
                if (!parsedKey.hidden) {
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
        
        var keyIndex = 0
        val hasOnlyOneLanguage = (config?.keyboards?.size ?: 0) <= 1
        val isNikkudDisabled = config?.diacriticsSettings?.get(currentKeyboardId ?: "")?.isDisabled ?: false
        
        for (key in row.keys) {
            val parsedKey = ParsedKey.from(key, groups, Color.BLACK, Color.WHITE)
            
            val keyType = parsedKey.type.lowercase()
            if ((keyType == "language" && hasOnlyOneLanguage) || (keyType == "next-keyboard" && !showGlobeButton)) {
                keyIndex++
                continue
            }
            
            if (keyType == "nikkud" && isNikkudDisabled) {
                keyIndex++
                continue
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
            
            if (parsedKey.hidden) {
                val hiddenWidth = ((parsedKey.width / baselineWidth) * availableWidth).toInt()
                val hiddenSpacer = View(context)
                hiddenSpacer.layoutParams = LinearLayout.LayoutParams(hiddenWidth, rowHeight)
                rowContainer.addView(hiddenSpacer)
            } else {
                val keyWidth = ((parsedKey.width / baselineWidth) * availableWidth).toInt() - keySpacing
                if (keyIndex == 0 && rowIndex == 0) {
                    debugLog("📐 First key: width=$keyWidth, height=$rowHeight, caption='${parsedKey.caption}', value='${parsedKey.value}'")
                }
                val button = createKeyButton(parsedKey, keyWidth, rowHeight, editorContext, isSelected)
                rowContainer.addView(button)
            }
            
            keyIndex++
        }
        
        return rowContainer
    }
    
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
            
            setTypeface(typeface, Typeface.NORMAL)
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
            
            // Add long-press listener for keyset and nikkud keys (for selection in edit mode)
            val keyType = key.type.lowercase()
            if (keyType == "keyset" || keyType == "nikkud") {
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
            "shift" -> "⇧"
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
    
    // MARK: - Utility
    
    private fun dpToPx(dp: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            dp.toFloat(),
            context.resources.displayMetrics
        ).toInt()
    }
}
