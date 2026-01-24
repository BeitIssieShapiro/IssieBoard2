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
    private val onKeyPress: ((SimpleKeyboardService.KeyConfig) -> Unit)? = null
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
                onKeyPress?.invoke(key)
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
    
    private fun showError(layout: LinearLayout, message: String) {
        val errorText = TextView(context).apply {
            text = message
            textSize = TEXT_SIZE_ERROR
        }
        layout.addView(errorText)
    }
}
