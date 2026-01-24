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
import org.json.JSONObject

/**
 * Shared keyboard rendering logic
 * Used by both SimpleKeyboardService and KeyboardPreviewView
 */
class KeyboardRenderer(
    private val context: Context,
    private val isPreview: Boolean = false,
    private val onKeyPress: ((SimpleKeyboardService.KeyConfig) -> Unit)? = null,
    private val onNikkudSelected: ((String) -> Unit)? = null,
    private val onRequestRerender: (() -> Unit)? = null
) {
    
    companion object {
        private const val TAG = "KeyboardRenderer"
        private var instanceCounter = 0
        
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
    }
    
    private val instanceId = ++instanceCounter
    private val logTag = "$TAG-${if (isPreview) "PREVIEW" else "KEYBOARD"}-$instanceId"
    
    // Color parsing cache
    private val colorCache = mutableMapOf<String, Int>()
    
    // State
    var shiftState: SimpleKeyboardService.ShiftState = SimpleKeyboardService.ShiftState.Inactive
    var nikkudActive: Boolean = false
    
    /**
     * Render keyboard into a container layout
     */
    fun renderKeyboard(
        container: LinearLayout,
        config: SimpleKeyboardService.ParsedConfig,
        currentKeysetId: String,
        editorContext: SimpleKeyboardService.EditorContext? = null
    ) {
        lastContainer = container // Store for popup anchoring
        
        container.removeAllViews()
        container.setBackgroundColor(config.backgroundColor)
        
        val keyset = config.keysets[currentKeysetId]
        if (keyset == null) {
            showError(container, "Keyset not found: $currentKeysetId")
            return
        }
        
        val baselineWidth = calculateBaselineWidth(keyset.rows, editorContext)
        
        for (rowKeys in keyset.rows) {
            val rowLayout = createRowLayout(baselineWidth)
            renderRowKeys(rowLayout, rowKeys, editorContext)
            container.addView(rowLayout)
        }
    }
    
    private fun calculateBaselineWidth(
        rows: List<List<SimpleKeyboardService.KeyConfig>>,
        editorContext: SimpleKeyboardService.EditorContext?
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
        
        Log.d(logTag, "createRowLayout: rowHeight=$rowHeight, isPreview=$isPreview")
        
        return LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                rowHeight
            )
            setPadding(padding, 0, padding, 0)
            weightSum = baselineWidth
            
            Log.d(logTag, "Row created with layoutParams: width=${layoutParams.width}, height=${layoutParams.height}")
        }
    }
    
    private fun renderRowKeys(
        rowLayout: LinearLayout,
        rowKeys: List<SimpleKeyboardService.KeyConfig>,
        editorContext: SimpleKeyboardService.EditorContext?
    ) {
        for (key in rowKeys) {
            // Skip enter/action keys if not visible
            if (editorContext != null &&
                (key.type.lowercase() == "enter" || key.type.lowercase() == "action") &&
                !editorContext.enterVisible) {
                continue
            }
            
            if (key.offset > 0) {
                rowLayout.addView(createSpacer(key.offset))
            }
            
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
                
                rowLayout.addView(createKeyButton(key, finalLabel, editorContext))
            }
        }
    }
    
    private fun getDefaultLabel(type: String, editorContext: SimpleKeyboardService.EditorContext?): String {
        return when (type.lowercase()) {
            "backspace" -> "⌫"
            "enter", "action" -> editorContext?.enterLabel ?: "↵"
            "shift" -> when (shiftState) {
                is SimpleKeyboardService.ShiftState.Locked -> "🔒"
                is SimpleKeyboardService.ShiftState.Active -> "⬆"
                is SimpleKeyboardService.ShiftState.Inactive -> "⬆"
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
        key: SimpleKeyboardService.KeyConfig,
        label: String,
        editorContext: SimpleKeyboardService.EditorContext?
    ): Button {
        val horizontalMargin = if (isPreview) KEY_MARGIN_HORIZONTAL_PREVIEW else KEY_MARGIN_HORIZONTAL
        val verticalMargin = if (isPreview) KEY_MARGIN_VERTICAL_PREVIEW else KEY_MARGIN_VERTICAL
        val normalSize = if (isPreview) TEXT_SIZE_NORMAL_PREVIEW else TEXT_SIZE_NORMAL
        val largeSize = if (isPreview) TEXT_SIZE_LARGE_PREVIEW else TEXT_SIZE_LARGE
        
        return Button(context).apply {
            text = label
            textSize = determineTextSize(key.type, label, normalSize, largeSize)
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
                handleKeyClick(key, this)
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
    
    private fun getKeyBackgroundColor(key: SimpleKeyboardService.KeyConfig): Int {
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
    
    /**
     * Handle key click - processes special keys and regular key presses
     */
    private fun handleKeyClick(key: SimpleKeyboardService.KeyConfig, keyView: View) {
        when (key.type.lowercase()) {
            "shift" -> {
                shiftState = shiftState.toggle()
                onRequestRerender?.invoke()
            }
            "nikkud" -> {
                nikkudActive = !nikkudActive
                onRequestRerender?.invoke()
            }
            else -> {
                // For regular keys, check if nikkud popup should be shown
                if (nikkudActive && key.nikkud.isNotEmpty()) {
                    // NOW we have the specific key view to anchor to!
                    showNikkudPopup(key.nikkud, keyView)
                } else {
                    // Let the parent handle the key press (typing, backspace, etc.)
                    onKeyPress?.invoke(key)
                }
            }
        }
    }
    
    fun parseColor(colorString: String, default: Int): Int {
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
    
    // Store the last container for popup anchoring
    private var lastContainer: LinearLayout? = null
    
    private fun showError(layout: LinearLayout, message: String) {
        val errorText = TextView(context).apply {
            text = message
            textSize = TEXT_SIZE_ERROR
        }
        layout.addView(errorText)
    }
    
    
    /**
     * Shows a popup floating exactly above the pressed key.
     * Uses showAsDropDown with isClippingEnabled = false to escape React Native bounds.
     */
    fun showNikkudPopup(options: List<SimpleKeyboardService.NikkudOption>, anchorView: android.view.View) {
        val context = anchorView.context
        val buttonSize = 140
        val spacing = 20
        val padding = 30

        // 1. Calculate Rows (Force 2 rows if many items)
        val itemsPerRow = if (options.size > 5) (options.size + 1) / 2 else options.size
        
        // 2. Create Main Container (Vertical)
        val mainLayout = android.widget.LinearLayout(context).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setPadding(padding, padding, padding, padding)
            background = android.graphics.drawable.GradientDrawable().apply {
                shape = android.graphics.drawable.GradientDrawable.RECTANGLE
                setColor(android.graphics.Color.parseColor("#F0F0F0")) // Light Gray
                cornerRadius = 20f
                setStroke(2, android.graphics.Color.parseColor("#AAAAAA"))
            }
            elevation = 20f
        }

        // 3. Build Rows Dynamically
        val rows = options.chunked(itemsPerRow)
        rows.forEachIndexed { rowIndex, rowOptions ->
            val rowLayout = android.widget.LinearLayout(context).apply {
                orientation = android.widget.LinearLayout.HORIZONTAL
                layoutParams = android.widget.LinearLayout.LayoutParams(
                    android.widget.LinearLayout.LayoutParams.WRAP_CONTENT,
                    android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    if (rowIndex > 0) topMargin = spacing
                }
            }
            
            rowOptions.forEachIndexed { colIndex, option ->
                val button = android.widget.Button(context).apply {
                    text = option.caption
                    textSize = 24f
                    setTextColor(android.graphics.Color.BLACK)
                    background = android.graphics.drawable.GradientDrawable().apply {
                        setColor(android.graphics.Color.WHITE)
                        cornerRadius = 12f
                    }
                    layoutParams = android.widget.LinearLayout.LayoutParams(buttonSize, buttonSize).apply {
                        if (colIndex > 0) marginStart = spacing
                    }
                    
                    // Click Handler
                    setOnClickListener {
                        onNikkudSelected?.invoke(option.value)
                        (mainLayout.tag as? android.widget.PopupWindow)?.dismiss()
                    }
                }
                rowLayout.addView(button)
            }
            mainLayout.addView(rowLayout)
        }

        // 4. Create PopupWindow
        val popupWindow = android.widget.PopupWindow(
            mainLayout,
            android.view.ViewGroup.LayoutParams.WRAP_CONTENT,
            android.view.ViewGroup.LayoutParams.WRAP_CONTENT,
            true
        ).apply {
            isOutsideTouchable = true
            // CRITICAL: Must be true to intercept outside touches, but use INPUT_METHOD_NOT_NEEDED to keep keyboard open
            isFocusable = true
            // CRITICAL: This allows the popup to extend beyond screen/view bounds
            isClippingEnabled = false 
            setBackgroundDrawable(android.graphics.drawable.ColorDrawable(android.graphics.Color.TRANSPARENT))
            elevation = 24f
            // CRITICAL: Prevents keyboard from closing
            inputMethodMode = android.widget.PopupWindow.INPUT_METHOD_NOT_NEEDED
            // CRITICAL: Make it modal so touches outside dismiss popup without triggering underlying keys
            setTouchInterceptor { view, event ->
                if (event.action == android.view.MotionEvent.ACTION_OUTSIDE) {
                    dismiss()
                    true // Consume the event
                } else {
                    false // Let normal touch handling proceed
                }
            }
        }
        mainLayout.tag = popupWindow // Self-reference for dismiss

        // 5. Measure Layout to calculate offsets
        mainLayout.measure(
            android.view.View.MeasureSpec.makeMeasureSpec(0, android.view.View.MeasureSpec.UNSPECIFIED),
            android.view.View.MeasureSpec.makeMeasureSpec(0, android.view.View.MeasureSpec.UNSPECIFIED)
        )
        val popupWidth = mainLayout.measuredWidth
        val popupHeight = mainLayout.measuredHeight

        // 6. Calculate Position (Center Horizontally over key, Place Vertically above key)
        val xOffset = (anchorView.width / 2) - (popupWidth / 2)
        val yOffset = -popupHeight - (anchorView.height / 4)

        // 7. Show It
        try {
            // showAsDropDown anchors relative to the 'anchorView' (the key)
            popupWindow.showAsDropDown(anchorView, xOffset, yOffset)
        } catch (e: Exception) {
            Log.e(logTag, "Popup failed", e)
        }
    }
    
}
