package com.issieboardng

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.content.res.Configuration

/**
 * Keyboard rendering and state management
 * 
 * This is the central component that handles:
 * - All keyboard rendering
 * - Shift state management
 * - Keyset switching (abc/123/#+= layouts)
 * - Language switching
 * - Nikkud popup display
 * 
 * Users (SimpleKeyboardService and KeyboardPreviewView) only need to:
 * 1. Provide config
 * 2. Provide a callback for key events (text input, backspace, enter, etc.)
 */
class KeyboardRenderer(
    private val context: Context,
    private val isPreview: Boolean = false,
    private val onKeyEvent: ((KeyEvent) -> Unit)? = null,
    private val onStateChange: (() -> Unit)? = null  // Called after internal state changes (shift, keyset, language)
) {
    
    companion object {
        private const val TAG = "KeyboardRenderer"
        private var instanceCounter = 0
        private const val DEFAULT_KEYSET_ID = "abc"
        
        // UI Dimensions
        private const val ROW_HEIGHT_PORTRAIT = 150
        private const val ROW_HEIGHT_LANDSCAPE = 100
        private const val ROW_HEIGHT_PREVIEW = 100
        private const val KEY_CORNER_RADIUS = 8f
        private const val KEY_MARGIN_HORIZONTAL = 8
        private const val KEY_MARGIN_HORIZONTAL_PREVIEW = 6
        private const val KEY_MARGIN_VERTICAL = 6
        private const val KEY_MARGIN_VERTICAL_PREVIEW = 4
        private const val KEY_PADDING = 8
        private const val ROW_PADDING_HORIZONTAL = 16
        private const val ROW_PADDING_HORIZONTAL_PREVIEW = 12
        
        // Text Sizes
        private const val TEXT_SIZE_NORMAL = 18f
        private const val TEXT_SIZE_NORMAL_PREVIEW = 16f
        private const val TEXT_SIZE_LARGE = 36f
        private const val TEXT_SIZE_LARGE_PREVIEW = 24f
        private const val TEXT_SIZE_ERROR = 20f
        
        // Colors
        private const val DEFAULT_BG_COLOR = "#CCCCCC"
        private const val SHIFT_ACTIVE_COLOR = "#4CAF50"
        private const val DEFAULT_BASELINE_WIDTH = 10f
        
        // Timing
        private const val DOUBLE_CLICK_THRESHOLD_MS = 500L
    }
    
    private val instanceId = ++instanceCounter
    private val logTag = "$TAG-${if (isPreview) "PREVIEW" else "KEYBOARD"}-$instanceId"
    
    // Color parsing cache
    private val colorCache = mutableMapOf<String, Int>()
    
    // ============================================================================
    // STATE MANAGEMENT - All keyboard state is managed here
    // ============================================================================
    
    /** Current shift state */
    var shiftState: ShiftState = ShiftState.Inactive
        private set
    
    /** Whether nikkud mode is active */
    var nikkudActive: Boolean = false
        private set
    
    /** Current keyset ID */
    var currentKeysetId: String = DEFAULT_KEYSET_ID
        private set
    
    /** Stored config for re-rendering */
    private var currentConfig: ParsedConfig? = null
    
    /** Stored editor context for re-rendering */
    private var currentEditorContext: EditorContext? = null
    
    /** Container for rendering */
    private var currentContainer: LinearLayout? = null
    
    /** Double-click detection for shift */
    private var lastShiftClickTime: Long = 0
    
    /** Selected key IDs for visual highlighting (edit mode) */
    /** Key IDs are in format "keysetId:rowIndex:keyIndex", e.g., "abc:0:3" */
    private var selectedKeyIds: Set<String> = emptySet()
    
    /** Current keyboard ID for diacritics lookup (derived from keyset ID) */
    private var currentKeyboardId: String? = null
    
    /** Modifier toggle states for nikkud picker */
    /** Key: modifier ID, Value: selected option ID (null = off, empty string = on for simple toggle) */
    private val modifierStates = mutableMapOf<String, String?>()
    
    /** Current letter being edited in nikkud picker (for modifier toggle refresh) */
    private var currentNikkudLetter: String = ""
    
    /** Current popup window (for refreshing when modifier toggles) */
    private var currentPopupWindow: android.widget.PopupWindow? = null
    
    /** Current anchor view for popup refresh */
    private var currentPopupAnchor: View? = null
    
    /** Flag to track if popup was just dismissed - skip next key click */
    private var popupJustDismissed: Boolean = false
    
    // ============================================================================
    // PUBLIC API
    // ============================================================================
    
    /**
     * Set selected key IDs for visual highlighting in edit mode
     * @param keyIds Set of key IDs in format "keysetId:rowIndex:keyIndex"
     */
    fun setSelectedKeys(keyIds: Set<String>) {
        Log.d(logTag, "setSelectedKeys: ${keyIds.size} keys")
        selectedKeyIds = keyIds
    }
    
    /**
     * Set the config and initialize the keyset
     * Call this when config changes (e.g., from SharedPreferences)
     * 
     * @param config The new parsed configuration
     * @param resetKeyset If true, always reset to default keyset. If false, only reset if current keyset doesn't exist.
     */
    fun setConfig(config: ParsedConfig, resetKeyset: Boolean = false) {
        Log.d(logTag, "setConfig() called with ${config.keysets.size} keysets, resetKeyset=$resetKeyset")
        currentConfig = config
        
        // Reset keyset if requested or if current keyset doesn't exist in new config
        if (resetKeyset || !config.keysets.containsKey(currentKeysetId)) {
            Log.d(logTag, "setConfig() - resetting keyset from '$currentKeysetId' to '${config.defaultKeysetId}'")
            currentKeysetId = config.defaultKeysetId
            shiftState = ShiftState.Inactive
            nikkudActive = false
        }
    }
    
    /**
     * Render keyboard into a container layout
     * 
     * @param container The LinearLayout to render into
     * @param editorContext Optional editor context for dynamic key behavior (enter label, etc.)
     */
    fun renderKeyboard(
        container: LinearLayout,
        editorContext: EditorContext? = null
    ) {
        Log.d(logTag, "renderKeyboard() - keyset=$currentKeysetId, container=$container")
        
        val config = currentConfig
        if (config == null) {
            Log.e(logTag, "renderKeyboard() - config is null!")
            showError(container, "No config loaded")
            return
        }
        
        currentContainer = container
        currentEditorContext = editorContext
        
        container.removeAllViews()
        container.setBackgroundColor(config.backgroundColor)
        
        var keyset = config.keysets[currentKeysetId]
        if (keyset == null) {
            Log.w(logTag, "renderKeyboard() - Keyset '$currentKeysetId' not found! Falling back to '${config.defaultKeysetId}'")
            currentKeysetId = config.defaultKeysetId
            keyset = config.keysets[currentKeysetId]
            
            if (keyset == null) {
                // Try first available keyset
                val firstKeyset = config.keysets.entries.firstOrNull()
                if (firstKeyset != null) {
                    Log.w(logTag, "renderKeyboard() - Default keyset '${config.defaultKeysetId}' not found! Using first available: '${firstKeyset.key}'")
                    currentKeysetId = firstKeyset.key
                    keyset = firstKeyset.value
                } else {
                    Log.e(logTag, "renderKeyboard() - No keysets available!")
                    showError(container, "No keysets available")
                    return
                }
            }
        }
        
        // Derive currentKeyboardId from keyset ID (e.g., "he_abc" -> "he", "abc" -> first keyboard)
        if (config.keyboards.isNotEmpty()) {
            var foundKeyboard: String? = null
            for (keyboardId in config.keyboards) {
                if (currentKeysetId.startsWith("${keyboardId}_") || currentKeysetId == keyboardId) {
                    foundKeyboard = keyboardId
                    break
                }
            }
            // If no match found, use first keyboard
            currentKeyboardId = foundKeyboard ?: config.keyboards.firstOrNull()
            Log.d(logTag, "Current keyboard ID set to: $currentKeyboardId")
        }
        
        Log.d(logTag, "renderKeyboard() - keyset has ${keyset.rows.size} rows")
        
        val baselineWidth = calculateBaselineWidth(keyset.rows, editorContext)
        
        for ((rowIndex, rowKeys) in keyset.rows.withIndex()) {
            val rowLayout = createRowLayout(baselineWidth)
            renderRowKeys(rowLayout, rowKeys, editorContext, currentKeysetId, rowIndex)
            container.addView(rowLayout)
        }
        
        Log.d(logTag, "renderKeyboard() - done, container now has ${container.childCount} children")
    }
    
    /**
     * Re-render with same container and editor context
     * Call this after state changes (shift, keyset, etc.)
     */
    fun rerender() {
        Log.d(logTag, "rerender() called, currentContainer=${currentContainer != null}, currentKeysetId=$currentKeysetId")
        currentContainer?.let { container ->
            Log.d(logTag, "rerender() - rendering into container with ${container.childCount} children")
            renderKeyboard(container, currentEditorContext)
            Log.d(logTag, "rerender() - after render, container has ${container.childCount} children")
            
            // Notify that state changed (for layout refresh in preview)
            onStateChange?.invoke()
        } ?: run {
            Log.e(logTag, "rerender() - currentContainer is null!")
        }
    }
    
    // ============================================================================
    // STATE CHANGE HANDLERS
    // ============================================================================
    
    /**
     * Toggle shift state (single click)
     */
    private fun toggleShift() {
        shiftState = shiftState.toggle()
        rerender()
    }
    
    /**
     * Handle shift click with double-click detection for caps lock
     */
    private fun handleShiftClick() {
        val currentTime = System.currentTimeMillis()
        val timeSinceLastClick = currentTime - lastShiftClickTime
        
        if (timeSinceLastClick < DOUBLE_CLICK_THRESHOLD_MS) {
            // Double-click: toggle caps lock
            shiftState = if (shiftState is ShiftState.Locked) {
                ShiftState.Inactive
            } else {
                ShiftState.Locked
            }
        } else {
            // Single click: toggle
            shiftState = shiftState.toggle()
        }
        lastShiftClickTime = currentTime
        rerender()
    }
    
    /**
     * Toggle nikkud mode
     */
    private fun toggleNikkud() {
        nikkudActive = !nikkudActive
        rerender()
    }
    
    /**
     * Switch to a different keyset (abc, 123, #+=)
     * Maintains the current keyboard/language prefix
     */
    private fun switchKeyset(keysetValue: String) {
        if (keysetValue.isEmpty()) return
        
        val config = currentConfig ?: return
        
        // Extract the keyboard prefix from current keyset ID (e.g., "he_abc" -> "he")
        val keyboardPrefix = if (currentKeysetId.contains("_")) {
            currentKeysetId.substringBefore("_")
        } else {
            ""
        }
        
        // Build target keyset ID with same keyboard prefix
        val targetKeysetId = if (keyboardPrefix.isNotEmpty()) {
            "${keyboardPrefix}_${keysetValue}"
        } else {
            keysetValue
        }
        
        if (config.keysets.containsKey(targetKeysetId)) {
            currentKeysetId = targetKeysetId
            // Reset shift state when changing keysets
            shiftState = ShiftState.Inactive
            rerender()
        } else {
            Log.w(logTag, "Keyset not found: $targetKeysetId")
        }
    }
    
    /**
     * Switch to the next language/keyboard
     * Cycles through keyboards of the same type (abc/123/#+= stay the same)
     */
    private fun switchLanguage() {
        val config = currentConfig ?: return
        
        if (config.keysets.isEmpty()) {
            Log.w(logTag, "No keysets available for language switch")
            return
        }
        
        val allKeysetIds = config.keysets.keys.toList()
        Log.d(logTag, "Language switch: All keysets: ${allKeysetIds.joinToString()}")
        Log.d(logTag, "Language switch: Current keyset: $currentKeysetId")
        
        // Determine the keyset type (abc, 123, or #+=)
        val currentKeysetType = when {
            currentKeysetId.endsWith("_abc") -> "abc"
            currentKeysetId.endsWith("_123") -> "123"
            currentKeysetId.endsWith("_#+=") -> "#+="
            currentKeysetId == "abc" -> "abc"
            currentKeysetId == "123" -> "123"
            currentKeysetId == "#+=" -> "#+="
            else -> "abc"
        }
        
        // Find all keysets of the same type across different keyboards
        val sameTypeKeysets = allKeysetIds.filter { keysetId ->
            keysetId == currentKeysetType || keysetId.endsWith("_$currentKeysetType")
        }
        
        Log.d(logTag, "Language switch: Same type keysets ($currentKeysetType): ${sameTypeKeysets.joinToString()}")
        
        if (sameTypeKeysets.size > 1) {
            val currentIndex = sameTypeKeysets.indexOf(currentKeysetId)
            val nextIndex = (currentIndex + 1) % sameTypeKeysets.size
            val nextKeysetId = sameTypeKeysets[nextIndex]
            
            Log.d(logTag, "Language switch: Switching from $currentKeysetId to $nextKeysetId")
            
            currentKeysetId = nextKeysetId
            // Reset shift state when changing languages
            shiftState = ShiftState.Inactive
            rerender()
        } else {
            Log.d(logTag, "Language switch: Only one keyboard available for type $currentKeysetType")
        }
    }
    
    /**
     * Auto-reset shift after typing (unless locked)
     */
    private fun autoResetShift() {
        if (shiftState is ShiftState.Active) {
            shiftState = ShiftState.Inactive
            rerender()
        }
    }
    
    // ============================================================================
    // RENDERING HELPERS
    // ============================================================================
    
    private fun calculateBaselineWidth(
        rows: List<List<KeyConfig>>,
        editorContext: EditorContext?
    ): Float {
        var maxRowWidth = 0f
        
        for (rowKeys in rows) {
            var rowWidth = 0f
            for (key in rowKeys) {
                // Skip enter/action keys if they won't be visible
                if (editorContext != null && 
                    (key.type.lowercase() == "enter" || key.type.lowercase() == "action") && 
                    !editorContext.enterVisible) {
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
    
    private fun createRowLayout(baselineWidth: Float): LinearLayout {
        val isLandscape = context.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
        val rowHeight = when {
            isPreview -> ROW_HEIGHT_PREVIEW
            isLandscape -> ROW_HEIGHT_LANDSCAPE
            else -> ROW_HEIGHT_PORTRAIT
        }
        
        val padding = if (isPreview) ROW_PADDING_HORIZONTAL_PREVIEW else ROW_PADDING_HORIZONTAL
        
        return LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                rowHeight
            )
            setPadding(padding, 0, padding, 0)
            weightSum = baselineWidth
        }
    }
    
    private fun renderRowKeys(
        rowLayout: LinearLayout,
        rowKeys: List<KeyConfig>,
        editorContext: EditorContext?,
        keysetId: String,
        rowIndex: Int
    ) {
        var keyIndex = 0
        for (key in rowKeys) {
            // Skip enter/action keys if not visible
            if (editorContext != null &&
                (key.type.lowercase() == "enter" || key.type.lowercase() == "action") &&
                !editorContext.enterVisible) {
                keyIndex++
                continue
            }
            
            if (key.offset > 0) {
                rowLayout.addView(createSpacer(key.offset))
            }
            
            // Generate key identifier for selection checking
            val keyId = "$keysetId:$rowIndex:$keyIndex"
            val isSelected = selectedKeyIds.contains(keyId)
            
            if (key.hidden) {
                rowLayout.addView(createSpacer(key.width))
            } else {
                val displayCaption = if (shiftState.isActive()) key.sCaption else key.caption
                val finalLabel = if (key.label.isNotEmpty()) {
                    key.label
                } else if (displayCaption.isNotEmpty()) {
                    displayCaption
                } else if (key.value.isNotEmpty()) {
                    key.value
                } else {
                    getDefaultLabel(key.type, editorContext)
                }
                
                rowLayout.addView(createKeyButton(key, finalLabel, editorContext, isSelected))
            }
            
            keyIndex++
        }
    }
    
    private fun getDefaultLabel(type: String, editorContext: EditorContext?): String {
        return when (type.lowercase()) {
            "backspace" -> "⌫"
            "enter", "action" -> editorContext?.enterLabel ?: "↵"
            "shift" -> when (shiftState) {
                is ShiftState.Locked -> "🔒"
                is ShiftState.Active -> "⬆"
                is ShiftState.Inactive -> "⬆"
            }
            "settings" -> "⚙️"
            "close" -> "⬇"
            "language" -> "🌐"
            "next-keyboard" -> "🌐"
            "nikkud" -> if (nikkudActive) "◌ָ" else "◌"
            "space" -> "SPACE"
            else -> type.uppercase()
        }
    }
    
    private fun createSpacer(weight: Float): View {
        return View(context).apply {
            layoutParams = LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.MATCH_PARENT, weight
            )
        }
    }
    
    private fun createKeyButton(
        key: KeyConfig,
        label: String,
        editorContext: EditorContext?,
        isSelected: Boolean = false
    ): Button {
        val horizontalMargin = if (isPreview) KEY_MARGIN_HORIZONTAL_PREVIEW else KEY_MARGIN_HORIZONTAL
        val verticalMargin = if (isPreview) KEY_MARGIN_VERTICAL_PREVIEW else KEY_MARGIN_VERTICAL
        val normalSize = if (isPreview) TEXT_SIZE_NORMAL_PREVIEW else TEXT_SIZE_NORMAL
        val largeSize = if (isPreview) TEXT_SIZE_LARGE_PREVIEW else TEXT_SIZE_LARGE
        
        return Button(context).apply {
            text = label
            textSize = determineTextSize(key.type, label, normalSize, largeSize)
            setAllCaps(false)  // Important: preserve case for lowercase letters
            layoutParams = LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.MATCH_PARENT, key.width
            ).apply {
                marginStart = horizontalMargin
                marginEnd = horizontalMargin
                topMargin = verticalMargin
                bottomMargin = verticalMargin
            }
            
            val bgColor = getKeyBackgroundColor(key)
            val textColor = key.textColor
            
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                setColor(bgColor)
                cornerRadius = KEY_CORNER_RADIUS
                
                // Selection highlight for edit mode
                if (isSelected) {
                    setStroke(6, Color.parseColor("#2196F3")) // Blue border
                }
            }
            setTextColor(textColor)
            setPadding(KEY_PADDING, KEY_PADDING, KEY_PADDING, KEY_PADDING)
            
            // Handle enabled/disabled state for enter/action keys
            val keyEnabled = when {
                editorContext == null -> true // Preview mode - all enabled
                key.type.lowercase() == "enter" || key.type.lowercase() == "action" -> editorContext.enterEnabled
                else -> true
            }
            
            isEnabled = keyEnabled
            alpha = if (keyEnabled) 1.0f else 0.4f
            
            setOnClickListener {
                handleKeyClick(key, this, editorContext)
            }
        }
    }
    
    private fun determineTextSize(type: String, label: String, normalSize: Float, largeSize: Float): Float {
        return when {
            type.lowercase() == "shift" -> largeSize
            (type.lowercase() == "enter" || type.lowercase() == "action") && label.length <= 1 -> largeSize
            else -> normalSize
        }
    }
    
    private fun getKeyBackgroundColor(key: KeyConfig): Int {
        // Special handling for shift button when active
        if (key.type.lowercase() == "shift" && shiftState.isActive()) {
            return parseColor(SHIFT_ACTIVE_COLOR, Color.parseColor(SHIFT_ACTIVE_COLOR))
        }
        
        // Special handling for nikkud button when active
        if (key.type.lowercase() == "nikkud" && nikkudActive) {
            return parseColor("#FFD700", Color.parseColor("#FFD700"))
        }
        
        return key.backgroundColor
    }
    
    // ============================================================================
    // KEY CLICK HANDLING
    // ============================================================================
    
    /**
     * Handle key click - processes all key types
     * State changes (shift, keyset, language) are handled internally
     * Text input and special actions are sent to the callback
     */
    private fun handleKeyClick(key: KeyConfig, keyView: View, editorContext: EditorContext?) {
        // If there's a popup open, dismiss it and don't process this click
        // The popupJustDismissed flag prevents processing the same click twice
        val hadPopup = currentPopupWindow != null
        if (hadPopup) {
            Log.d(logTag, "handleKeyClick: dismissing popup, will not process this click")
            currentPopupWindow?.dismiss()
            currentPopupWindow = null
            return  // Just dismiss, don't process the key click
        }
        
        when (key.type.lowercase()) {
            "shift" -> {
                handleShiftClick()
            }
            "nikkud" -> {
                toggleNikkud()
            }
            "keyset" -> {
                if (key.keysetValue.isNotEmpty()) {
                    switchKeyset(key.keysetValue)
                }
            }
            "language" -> {
                // Switch language internally - Android handles the visual switch
                switchLanguage()
                // Notify React with the NEW keyset ID so it can sync directly
                onKeyEvent?.invoke(KeyEvent.Custom(KeyConfig(type = "keyset-changed", value = currentKeysetId)))
            }
            "backspace" -> {
                onKeyEvent?.invoke(KeyEvent.Backspace)
            }
            "enter", "action" -> {
                val actionId = editorContext?.actionId ?: android.view.inputmethod.EditorInfo.IME_ACTION_DONE
                onKeyEvent?.invoke(KeyEvent.Enter(actionId))
            }
            "settings" -> {
                onKeyEvent?.invoke(KeyEvent.Settings)
            }
            "close" -> {
                onKeyEvent?.invoke(KeyEvent.Close)
            }
            "next-keyboard" -> {
                // For preview: switch language internally AND notify React with new keyset ID
                // For actual keyboard: just notify (system handles the switch)
                if (isPreview) {
                    switchLanguage()
                    // Send the NEW keyset ID so React can sync directly
                    onKeyEvent?.invoke(KeyEvent.Custom(KeyConfig(type = "keyset-changed", value = currentKeysetId)))
                } else {
                    onKeyEvent?.invoke(KeyEvent.NextKeyboard)
                }
            }
            else -> {
                // Regular key - check if nikkud popup should be shown
                if (nikkudActive) {
                    // Get diacritics for this key - first try explicit nikkud, then generate from definition
                    val diacriticsOptions = getDiacriticsForKey(key)
                    if (diacriticsOptions.isNotEmpty()) {
                        showNikkudPopupWithDiacritics(key.value, diacriticsOptions, keyView)
                    } else if (key.nikkud.isNotEmpty()) {
                        // Fallback to explicit nikkud (backward compatibility)
                        showNikkudPopup(key.nikkud, keyView)
                    } else {
                        // No diacritics available, just output the key
                        val value = if (shiftState.isActive()) key.sValue else key.value
                        if (value.isNotEmpty()) {
                            onKeyEvent?.invoke(KeyEvent.TextInput(value))
                            autoResetShift()
                        }
                    }
                } else {
                    // Get the correct value based on shift state
                    val value = if (shiftState.isActive()) key.sValue else key.value
                    if (value.isNotEmpty()) {
                        onKeyEvent?.invoke(KeyEvent.TextInput(value))
                        autoResetShift()
                    }
                }
            }
        }
    }
    
    // ============================================================================
    // NIKKUD POPUP
    // ============================================================================
    
    /**
     * Shows a popup floating exactly above the pressed key.
     */
    private fun showNikkudPopup(options: List<NikkudOption>, anchorView: View) {
        val buttonSize = 140
        val spacing = 20
        val padding = 30

        // Calculate rows (Force 2 rows if many items)
        val itemsPerRow = if (options.size > 5) (options.size + 1) / 2 else options.size
        
        // Create main container
        val mainLayout = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(padding, padding, padding, padding)
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                setColor(Color.parseColor("#F0F0F0"))
                cornerRadius = 20f
                setStroke(2, Color.parseColor("#AAAAAA"))
            }
            elevation = 20f
        }

        // Build rows dynamically
        val rows = options.chunked(itemsPerRow)
        rows.forEachIndexed { rowIndex, rowOptions ->
            val rowLayout = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    if (rowIndex > 0) topMargin = spacing
                }
            }
            
            rowOptions.forEachIndexed { colIndex, option ->
                val button = Button(context).apply {
                    text = option.caption
                    textSize = 24f
                    setTextColor(Color.BLACK)
                    background = GradientDrawable().apply {
                        setColor(Color.WHITE)
                        cornerRadius = 12f
                    }
                    layoutParams = LinearLayout.LayoutParams(buttonSize, buttonSize).apply {
                        if (colIndex > 0) marginStart = spacing
                    }
                    
                    setOnClickListener {
                        onKeyEvent?.invoke(KeyEvent.TextInput(option.value))
                        (mainLayout.tag as? android.widget.PopupWindow)?.dismiss()
                    }
                }
                rowLayout.addView(button)
            }
            mainLayout.addView(rowLayout)
        }

        // Create PopupWindow
        val popupWindow = android.widget.PopupWindow(
            mainLayout,
            android.view.ViewGroup.LayoutParams.WRAP_CONTENT,
            android.view.ViewGroup.LayoutParams.WRAP_CONTENT,
            true
        ).apply {
            isOutsideTouchable = true
            isFocusable = true
            isClippingEnabled = false
            setBackgroundDrawable(android.graphics.drawable.ColorDrawable(Color.TRANSPARENT))
            elevation = 24f
            inputMethodMode = android.widget.PopupWindow.INPUT_METHOD_NOT_NEEDED
            setTouchInterceptor { _, event ->
                if (event.action == android.view.MotionEvent.ACTION_OUTSIDE) {
                    dismiss()
                    true
                } else {
                    false
                }
            }
        }
        mainLayout.tag = popupWindow

        // Measure layout to calculate offsets
        mainLayout.measure(
            View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED),
            View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED)
        )
        val popupWidth = mainLayout.measuredWidth
        val popupHeight = mainLayout.measuredHeight

        // Calculate position (center horizontally over key, place vertically above key)
        val xOffset = (anchorView.width / 2) - (popupWidth / 2)
        val yOffset = -popupHeight - (anchorView.height / 4)

        // Show popup
        try {
            popupWindow.showAsDropDown(anchorView, xOffset, yOffset)
        } catch (e: Exception) {
            Log.e(logTag, "Popup failed", e)
        }
    }
    
    // ============================================================================
    // UTILITIES
    // ============================================================================
    
    private fun parseColor(colorString: String, default: Int): Int {
        if (colorString.isEmpty()) return default
        
        return colorCache.getOrPut(colorString) {
            try {
                Color.parseColor(colorString)
            } catch (e: Exception) {
                default
            }
        }
    }
    
    private fun showError(layout: LinearLayout, message: String) {
        layout.removeAllViews()
        val errorText = TextView(context).apply {
            text = message
            textSize = TEXT_SIZE_ERROR
        }
        layout.addView(errorText)
    }
    
    // ============================================================================
    // DIACRITICS GENERATION
    // ============================================================================
    
    /**
     * Get diacritics for a key using the diacritics definition
     */
    private fun getDiacriticsForKey(key: KeyConfig): List<NikkudOption> {
        val config = currentConfig ?: return emptyList()
        val keyboardId = currentKeyboardId ?: return emptyList()
        
        val diacritics = config.getDiacritics(keyboardId) ?: return emptyList()
        val settings = config.diacriticsSettings[keyboardId]
        val hidden = settings?.hidden ?: emptyList()
        
        val letter = key.value
        if (letter.isEmpty()) return emptyList()
        
        Log.d(logTag, "getDiacriticsForKey: letter='$letter', keyboard='$keyboardId'")
        
        val result = mutableListOf<NikkudOption>()
        
        for (item in diacritics.items) {
            // Skip if hidden in profile
            if (hidden.contains(item.id)) continue
            
            // Skip if not applicable to this letter
            if (item.onlyFor != null && !item.onlyFor.contains(letter)) continue
            if (item.excludeFor != null && item.excludeFor.contains(letter)) continue
            
            // Determine the output value
            val value = if (item.isReplacement) item.mark else (letter + item.mark)
            
            result.add(NikkudOption(value, value))
        }
        
        Log.d(logTag, "getDiacriticsForKey: generated ${result.size} options")
        return result
    }
    
    /**
     * Generate nikkud options for a letter with active modifiers applied
     */
    private fun generateNikkudOptions(letter: String): List<NikkudOption> {
        val config = currentConfig ?: return emptyList()
        val keyboardId = currentKeyboardId ?: return emptyList()
        
        val diacritics = config.getDiacritics(keyboardId) ?: return emptyList()
        val settings = config.diacriticsSettings[keyboardId]
        val hidden = settings?.hidden ?: emptyList()
        val disabledMods = settings?.disabledModifiers ?: emptyList()
        
        // Get applicable modifiers for this letter
        val applicableModifiers = diacritics.getModifiersForLetter(letter).filter { 
            !disabledMods.contains(it.id)
        }
        
        val result = mutableListOf<NikkudOption>()
        
        for (item in diacritics.items) {
            // Skip if hidden in profile
            if (hidden.contains(item.id)) continue
            
            // Skip if not applicable to this letter
            if (item.onlyFor != null && !item.onlyFor.contains(letter)) continue
            if (item.excludeFor != null && item.excludeFor.contains(letter)) continue
            
            val isReplacement = item.isReplacement
            
            // Start with base value
            var value = if (isReplacement) item.mark else letter
            
            // Apply each active modifier
            if (!isReplacement) {
                for (modifier in applicableModifiers) {
                    val activeState = modifierStates[modifier.id]
                    if (activeState == null) continue  // Modifier not active
                    
                    if (modifier.isMultiOption) {
                        // Multi-option: find selected option's mark
                        val selectedOption = modifier.options?.find { it.id == activeState }
                        if (selectedOption != null) {
                            value += selectedOption.mark
                        }
                    } else if (modifier.mark != null) {
                        // Simple toggle: add mark if active (activeState is empty string)
                        value += modifier.mark
                    }
                }
                
                // Add the diacritic mark
                value += item.mark
            }
            
            result.add(NikkudOption(value, value))
        }
        
        return result
    }
    
    /**
     * Get modifiers that apply to a letter (filtered by settings)
     */
    private fun getModifiersForLetter(letter: String): List<DiacriticModifier> {
        val config = currentConfig ?: return emptyList()
        val keyboardId = currentKeyboardId ?: return emptyList()
        
        val diacritics = config.getDiacritics(keyboardId) ?: return emptyList()
        val settings = config.diacriticsSettings[keyboardId]
        val disabledMods = settings?.disabledModifiers ?: emptyList()
        
        return diacritics.getModifiersForLetter(letter).filter { !disabledMods.contains(it.id) }
    }
    
    /**
     * Show nikkud popup with diacritics and optional modifier toggles
     */
    private fun showNikkudPopupWithDiacritics(letter: String, options: List<NikkudOption>, anchorView: View) {
        currentNikkudLetter = letter
        currentPopupAnchor = anchorView
        
        val applicableModifiers = getModifiersForLetter(letter)
        val hasModifiers = applicableModifiers.isNotEmpty()
        
        // Generate options based on current modifier states
        val nikkudOptions = generateNikkudOptions(letter)
        val displayOptions = if (nikkudOptions.isNotEmpty()) nikkudOptions else options
        
        val buttonSize = 110
        val spacing = 12
        val padding = 20
        
        // Calculate items per row (max 6, or 2 rows if many)
        val itemsPerRow = if (displayOptions.size > 6) {
            (displayOptions.size + 1) / 2
        } else {
            maxOf(1, minOf(6, displayOptions.size))
        }
        
        // Create main container
        val mainLayout = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(padding, padding, padding, padding)
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                setColor(Color.parseColor("#F5F5F5"))
                cornerRadius = 16f
                setStroke(1, Color.parseColor("#CCCCCC"))
            }
            elevation = 24f
        }
        
        // Build diacritic option rows
        val rows = displayOptions.chunked(itemsPerRow)
        rows.forEachIndexed { rowIndex, rowOptions ->
            val rowLayout = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    if (rowIndex > 0) topMargin = spacing
                }
            }
            
            rowOptions.forEachIndexed { colIndex, option ->
                // Log the option value for debugging
                Log.d(logTag, "Creating diacritic button: value='${option.value}' (${option.value.length} chars), hex=${option.value.map { String.format("%04X", it.code) }.joinToString()}")
                
                val button = TextView(context).apply {
                    // Show the FULL value with diacritic (not just the caption)
                    text = option.value
                    textSize = 24f
                    setTextColor(Color.BLACK)
                    gravity = android.view.Gravity.CENTER
                    // Important: use a typeface that supports Hebrew combining marks
                    typeface = android.graphics.Typeface.DEFAULT
                    background = GradientDrawable().apply {
                        setColor(Color.WHITE)
                        cornerRadius = 10f
                        setStroke(1, Color.parseColor("#DDDDDD"))
                    }
                    layoutParams = LinearLayout.LayoutParams(buttonSize, buttonSize).apply {
                        if (colIndex > 0) marginStart = spacing
                    }
                    isClickable = true
                    isFocusable = true
                    
                    setOnClickListener {
                        onKeyEvent?.invoke(KeyEvent.TextInput(option.value))
                        currentPopupWindow?.dismiss()
                        modifierStates.clear()
                    }
                }
                rowLayout.addView(button)
            }
            mainLayout.addView(rowLayout)
        }
        
        // Add modifier row if applicable
        if (hasModifiers) {
            // Add separator
            val separator = View(context).apply {
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    2
                ).apply {
                    topMargin = spacing
                    bottomMargin = spacing / 2
                }
                setBackgroundColor(Color.parseColor("#DDDDDD"))
            }
            mainLayout.addView(separator)
            
            val modifierRow = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    topMargin = spacing / 2
                }
                gravity = android.view.Gravity.CENTER_HORIZONTAL
            }
            
            val modifierButtonSize = (buttonSize * 0.9).toInt()
            
            for ((modIndex, modifier) in applicableModifiers.withIndex()) {
                // Add spacing between modifier groups
                if (modIndex > 0) {
                    val spacer = View(context).apply {
                        layoutParams = LinearLayout.LayoutParams(spacing * 2, 1)
                    }
                    modifierRow.addView(spacer)
                }
                
                val currentState = modifierStates[modifier.id]
                
                if (modifier.isMultiOption && modifier.options != null) {
                    // Multi-option modifier: create bordered button group
                    val groupLayout = LinearLayout(context).apply {
                        orientation = LinearLayout.HORIZONTAL
                        background = GradientDrawable().apply {
                            setColor(Color.parseColor("#FAFAFA"))
                            cornerRadius = 12f
                            setStroke(2, Color.parseColor("#AAAAAA"))
                        }
                        setPadding(6, 6, 6, 6)
                    }
                    
                    // "None" button (just letter)
                    val noneButton = createModifierToggleButton(
                        letter,
                        currentState == null,
                        modifierButtonSize
                    ) {
                        modifierStates.remove(modifier.id)
                        refreshNikkudPopup()
                    }
                    groupLayout.addView(noneButton)
                    
                    // Option buttons
                    modifier.options.forEach { option ->
                        val optButton = createModifierToggleButton(
                            letter + option.mark,
                            currentState == option.id,
                            modifierButtonSize
                        ) {
                            modifierStates[modifier.id] = option.id
                            refreshNikkudPopup()
                        }
                        groupLayout.addView(optButton)
                    }
                    
                    modifierRow.addView(groupLayout)
                    
                } else if (modifier.mark != null) {
                    // Simple toggle modifier - single button, always shows with mark
                    val isActive = currentState != null
                    val toggleButton = createModifierToggleButton(
                        letter + modifier.mark,  // Always show with mark
                        isActive,
                        modifierButtonSize
                    ) {
                        if (isActive) {
                            modifierStates.remove(modifier.id)
                        } else {
                            modifierStates[modifier.id] = ""  // Empty string = on for simple toggle
                        }
                        refreshNikkudPopup()
                    }
                    modifierRow.addView(toggleButton)
                }
            }
            
            mainLayout.addView(modifierRow)
        }
        
        // Create and show popup
        // Note: isOutsideTouchable = false prevents auto-dismiss on outside clicks
        // The popup will only dismiss when:
        // 1. A diacritic option is selected
        // 2. A key on the keyboard is pressed (which will trigger a new popup or dismiss)
        // 3. The nikkud mode is toggled off
        val popupWindow = android.widget.PopupWindow(
            mainLayout,
            android.view.ViewGroup.LayoutParams.WRAP_CONTENT,
            android.view.ViewGroup.LayoutParams.WRAP_CONTENT,
            false  // Not focusable so it doesn't steal touch events
        ).apply {
            isOutsideTouchable = false  // Don't dismiss on outside clicks (like Diacritics panel)
            isFocusable = false  // Don't steal focus from the rest of the UI
            isClippingEnabled = true  // Enable clipping to keep popup on screen
            setBackgroundDrawable(android.graphics.drawable.ColorDrawable(Color.TRANSPARENT))
            elevation = 24f
            inputMethodMode = android.widget.PopupWindow.INPUT_METHOD_NOT_NEEDED
            setOnDismissListener {
                currentPopupWindow = null
                currentPopupAnchor = null
                modifierStates.clear()
            }
        }
        
        currentPopupWindow = popupWindow
        popupContentContainer = mainLayout  // Store reference for in-place updates
        
        // Measure and position
        mainLayout.measure(
            View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED),
            View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED)
        )
        val popupWidth = mainLayout.measuredWidth
        val popupHeight = mainLayout.measuredHeight
        
        // Get anchor position on screen
        val anchorLocation = IntArray(2)
        anchorView.getLocationOnScreen(anchorLocation)
        
        // Get screen dimensions
        val displayMetrics = context.resources.displayMetrics
        val screenWidth = displayMetrics.widthPixels
        
        // Calculate desired X position (centered over key)
        var xPos = anchorLocation[0] + (anchorView.width / 2) - (popupWidth / 2)
        
        // Clamp to screen bounds
        if (xPos < 0) xPos = 0
        if (xPos + popupWidth > screenWidth) xPos = screenWidth - popupWidth
        
        // Calculate offset relative to anchor
        val xOffset = xPos - anchorLocation[0]
        val yOffset = -popupHeight - (anchorView.height / 4)
        
        try {
            popupWindow.showAsDropDown(anchorView, xOffset, yOffset)
        } catch (e: Exception) {
            Log.e(logTag, "Diacritics popup failed", e)
        }
    }
    
    /**
     * Create a modifier toggle button with proper styling
     * Uses TextView instead of Button to avoid internal padding issues
     */
    private fun createModifierToggleButton(
        text: String,
        isSelected: Boolean,
        size: Int,
        onClick: () -> Unit
    ): TextView {
        return TextView(context).apply {
            this.text = text
            textSize = 20f
            setTextColor(if (isSelected) Color.parseColor("#1976D2") else Color.BLACK)
            gravity = android.view.Gravity.CENTER
            background = GradientDrawable().apply {
                setColor(if (isSelected) Color.parseColor("#BBDEFB") else Color.WHITE)
                cornerRadius = 8f
                if (isSelected) {
                    setStroke(3, Color.parseColor("#1976D2"))
                } else {
                    setStroke(1, Color.parseColor("#CCCCCC"))
                }
            }
            layoutParams = LinearLayout.LayoutParams(size, size).apply {
                marginStart = 4
                marginEnd = 4
            }
            elevation = if (isSelected) 6f else 2f
            isClickable = true
            isFocusable = true
            
            setOnClickListener { onClick() }
        }
    }
    
    // Keep old method for backward compatibility - returns View instead of Button
    private fun createModifierButton(
        text: String,
        isSelected: Boolean,
        size: Int,
        onClick: () -> Unit
    ): View = createModifierToggleButton(text, isSelected, size, onClick)
    
    /** Reference to the popup's content container for in-place updates */
    private var popupContentContainer: LinearLayout? = null
    
    /**
     * Refresh the nikkud popup with current modifier states
     * This is called when modifier toggles are pressed inside the popup
     * Updates in-place without dismiss/recreate to avoid blinking
     */
    private fun refreshNikkudPopup() {
        val container = popupContentContainer
        val letter = currentNikkudLetter
        
        if (container == null || letter.isEmpty()) return
        
        Log.d(logTag, "refreshNikkudPopup: letter='$letter', modifierStates=$modifierStates (in-place update)")
        
        // Update the popup content in-place
        updatePopupContent(container, letter)
    }
    
    /**
     * Called when config changes (e.g., diacritics settings updated from UI)
     * If a popup is open, refresh it to reflect new settings
     */
    fun onConfigUpdated() {
        val container = popupContentContainer
        val letter = currentNikkudLetter
        
        if (container != null && currentPopupWindow?.isShowing == true && letter.isNotEmpty()) {
            Log.d(logTag, "onConfigUpdated: updating popup content for letter='$letter'")
            updatePopupContent(container, letter)
        }
    }
    
    /**
     * Update popup content in-place (no dismiss/recreate)
     */
    private fun updatePopupContent(container: LinearLayout, letter: String) {
        // Clear existing content
        container.removeAllViews()
        
        val applicableModifiers = getModifiersForLetter(letter)
        val hasModifiers = applicableModifiers.isNotEmpty()
        
        // Generate options based on current modifier states and config
        val nikkudOptions = generateNikkudOptions(letter)
        val options = getDiacriticsForKey(KeyConfig(value = letter))
        val displayOptions = if (nikkudOptions.isNotEmpty()) nikkudOptions else options
        
        val buttonSize = 110
        val spacing = 12
        
        // Calculate items per row
        val itemsPerRow = if (displayOptions.size > 6) {
            (displayOptions.size + 1) / 2
        } else {
            maxOf(1, minOf(6, displayOptions.size))
        }
        
        // Build diacritic option rows
        val rows = displayOptions.chunked(itemsPerRow)
        rows.forEachIndexed { rowIndex, rowOptions ->
            val rowLayout = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    if (rowIndex > 0) topMargin = spacing
                }
            }
            
            rowOptions.forEachIndexed { colIndex, option ->
                val button = TextView(context).apply {
                    text = option.value
                    textSize = 24f
                    setTextColor(Color.BLACK)
                    gravity = android.view.Gravity.CENTER
                    typeface = android.graphics.Typeface.DEFAULT
                    background = GradientDrawable().apply {
                        setColor(Color.WHITE)
                        cornerRadius = 10f
                        setStroke(1, Color.parseColor("#DDDDDD"))
                    }
                    layoutParams = LinearLayout.LayoutParams(buttonSize, buttonSize).apply {
                        if (colIndex > 0) marginStart = spacing
                    }
                    isClickable = true
                    isFocusable = true
                    
                    setOnClickListener {
                        onKeyEvent?.invoke(KeyEvent.TextInput(option.value))
                        currentPopupWindow?.dismiss()
                        modifierStates.clear()
                    }
                }
                rowLayout.addView(button)
            }
            container.addView(rowLayout)
        }
        
        // Add modifier row if applicable
        if (hasModifiers) {
            // Add separator
            val separator = View(context).apply {
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    2
                ).apply {
                    topMargin = spacing
                    bottomMargin = spacing / 2
                }
                setBackgroundColor(Color.parseColor("#DDDDDD"))
            }
            container.addView(separator)
            
            val modifierRow = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    topMargin = spacing / 2
                }
                gravity = android.view.Gravity.CENTER_HORIZONTAL
            }
            
            val modifierButtonSize = (buttonSize * 0.9).toInt()
            
            for ((modIndex, modifier) in applicableModifiers.withIndex()) {
                if (modIndex > 0) {
                    val spacer = View(context).apply {
                        layoutParams = LinearLayout.LayoutParams(spacing * 2, 1)
                    }
                    modifierRow.addView(spacer)
                }
                
                val currentState = modifierStates[modifier.id]
                
                if (modifier.isMultiOption && modifier.options != null) {
                    val groupLayout = LinearLayout(context).apply {
                        orientation = LinearLayout.HORIZONTAL
                        background = GradientDrawable().apply {
                            setColor(Color.parseColor("#FAFAFA"))
                            cornerRadius = 12f
                            setStroke(2, Color.parseColor("#AAAAAA"))
                        }
                        setPadding(6, 6, 6, 6)
                    }
                    
                    val noneButton = createModifierToggleButton(
                        letter,
                        currentState == null,
                        modifierButtonSize
                    ) {
                        modifierStates.remove(modifier.id)
                        refreshNikkudPopup()
                    }
                    groupLayout.addView(noneButton)
                    
                    modifier.options.forEach { option ->
                        val optButton = createModifierToggleButton(
                            letter + option.mark,
                            currentState == option.id,
                            modifierButtonSize
                        ) {
                            modifierStates[modifier.id] = option.id
                            refreshNikkudPopup()
                        }
                        groupLayout.addView(optButton)
                    }
                    
                    modifierRow.addView(groupLayout)
                } else if (modifier.mark != null) {
                    val isActive = currentState != null
                    val toggleButton = createModifierToggleButton(
                        letter + modifier.mark,
                        isActive,
                        modifierButtonSize
                    ) {
                        if (isActive) {
                            modifierStates.remove(modifier.id)
                        } else {
                            modifierStates[modifier.id] = ""
                        }
                        refreshNikkudPopup()
                    }
                    modifierRow.addView(toggleButton)
                }
            }
            
            container.addView(modifierRow)
        }
        
        // Request layout update
        container.requestLayout()
        container.invalidate()
        currentPopupWindow?.update()
    }
}
