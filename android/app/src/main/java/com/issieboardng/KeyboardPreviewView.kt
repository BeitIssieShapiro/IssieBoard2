package com.issieboardng

import android.content.Context
import android.content.SharedPreferences
import android.widget.LinearLayout
import android.widget.FrameLayout
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter
import org.json.JSONObject

/**
 * Android keyboard preview component that can be embedded in React Native
 * Renders the keyboard layout using shared KeyboardRenderer and emits keyPress events
 * Uses FrameLayout to support overlapping views (like nikkud popup)
 */
class KeyboardPreviewView(context: Context) : android.widget.FrameLayout(context) {
    
    companion object {
        private const val TAG = "KeyboardPreviewView"
        private const val DEFAULT_KEYSET_ID = "abc"
    }
    
    // Shared renderer
    private val renderer = KeyboardRenderer(
        context = context,
        isPreview = true,
        onKeyPress = { key -> handleKeyPress(key) },
        onNikkudSelected = { value ->
            // Emit event for nikkud selection to React Native
            val event = Arguments.createMap().apply {
                putString("type", "nikkud_selected")
                putString("value", value)
                putString("label", value)
            }
            
            val reactContext = context as? ReactContext
            reactContext?.getJSModule(RCTEventEmitter::class.java)
                ?.receiveEvent(id, "onKeyPress", event)
        },
        onRequestRerender = { renderKeyboard() }
    )
    
    // State
    private var parsedConfig: SimpleKeyboardService.ParsedConfig? = null
    private var currentKeysetId: String = DEFAULT_KEYSET_ID
    private val configParser = KeyboardConfigParser(context)
    private var configJson: String? = null
    
    // Keyboard container that holds the keyboard rows
    private val keyboardContainer = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        layoutParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        )
        elevation = 0f  // Ensure keyboard is at bottom z-layer
    }
    
    init {
        // Set initial background
        setBackgroundColor(android.graphics.Color.parseColor("#E0E0E0"))
        
        // Add keyboard container at index 0 (bottom layer)
        addView(keyboardContainer, 0)
        
        // Add test TextView to verify component is mounting
        val testText = android.widget.TextView(context).apply {
            text = "PREVIEW LOADING..."
            textSize = 20f
            setTextColor(android.graphics.Color.BLACK)
            setPadding(20, 20, 20, 20)
        }
        keyboardContainer.addView(testText)
        
        android.util.Log.d(TAG, "KeyboardPreviewView init")
    }
    
    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        super.onMeasure(widthMeasureSpec, heightMeasureSpec)
        android.util.Log.d(TAG, "onMeasure: width=${MeasureSpec.getSize(widthMeasureSpec)}, height=${MeasureSpec.getSize(heightMeasureSpec)}")
        android.util.Log.d(TAG, "onMeasure: measured width=$measuredWidth, height=$measuredHeight")
    }
    
    /**
     * Set config JSON directly (used by React Native prop)
     */
    fun setConfigJson(json: String?) {
        android.util.Log.d(TAG, "setConfigJson called with ${json?.length ?: 0} chars")
        configJson = json
        
        if (json != null && json.isNotEmpty()) {
            loadConfig()
            // Render immediately on the same thread
            renderKeyboard()
        }
    }
    
    private fun loadConfig() {
        android.util.Log.d(TAG, "loadConfig called, configJson is ${if (configJson != null) "set" else "null"}")
        parsedConfig = if (configJson != null) {
            // Use provided config JSON
            try {
                val jsonObject = org.json.JSONObject(configJson!!)
                val parsed = configParser.parseConfig(jsonObject)
                android.util.Log.d(TAG, "Config parsed successfully, keysets: ${parsed.keysets.keys.joinToString()}")
                parsed
            } catch (e: Exception) {
                android.util.Log.e(TAG, "Failed to parse provided config", e)
                null
            }
        } else {
            // Fall back to SharedPreferences
            android.util.Log.d(TAG, "Falling back to SharedPreferences")
            configParser.loadAndParseConfig()
        }
        currentKeysetId = parsedConfig?.defaultKeysetId ?: DEFAULT_KEYSET_ID
        android.util.Log.d(TAG, "currentKeysetId set to: $currentKeysetId")
    }
    
    private fun renderKeyboard() {
        android.util.Log.d(TAG, "renderKeyboard called")
        val config = parsedConfig
        if (config == null) {
            android.util.Log.e(TAG, "renderKeyboard: parsedConfig is null!")
            return
        }
        
        android.util.Log.d(TAG, "Calling renderer.renderKeyboard with keyset: $currentKeysetId")
        android.util.Log.d(TAG, "Available keysets: ${config.keysets.keys.joinToString()}")
        
        // Verify keyset exists before rendering
        if (!config.keysets.containsKey(currentKeysetId)) {
            android.util.Log.e(TAG, "renderKeyboard: Keyset '$currentKeysetId' not found in config!")
            android.util.Log.e(TAG, "Available keysets: ${config.keysets.keys.joinToString()}")
            // Fall back to default keyset
            currentKeysetId = config.defaultKeysetId
            android.util.Log.d(TAG, "Falling back to default keyset: $currentKeysetId")
        }
        
        try {
            // Use shared renderer (no editor context in preview mode)
            renderer.renderKeyboard(keyboardContainer, config, currentKeysetId, null)
            android.util.Log.d(TAG, "After render, childCount: $childCount")
            
            // Force layout update - must be done on main thread
            post {
                android.util.Log.d(TAG, "Post block executing on thread: ${Thread.currentThread().name}")
                android.util.Log.d(TAG, "View dimensions BEFORE: width=$width, height=$height, measuredWidth=$measuredWidth, measuredHeight=$measuredHeight")
                
                // Force re-measure and re-layout
                measure(
                    MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
                    MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
                )
                layout(left, top, right, bottom)
                
                requestLayout()
                invalidate()
                
                // Also request parent to update
                (parent as? android.view.View)?.requestLayout()
                
                android.util.Log.d(TAG, "View dimensions AFTER: width=$width, height=$height, measuredWidth=$measuredWidth, measuredHeight=$measuredHeight")
                android.util.Log.d(TAG, "Requested layout update, childCount: $childCount, visibility: $visibility")
                
                // Check each child's dimensions
                for (i in 0 until childCount) {
                    val child = getChildAt(i)
                    android.util.Log.d(TAG, "Child $i: width=${child.width}, height=${child.height}, visibility=${child.visibility}")
                }
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Error rendering keyboard", e)
            e.printStackTrace()
            // Show error message
            removeAllViews()
            val errorText = android.widget.TextView(context).apply {
                text = "Error rendering keyboard: ${e.message}\n${e.stackTraceToString()}"
                textSize = 14f
                setTextColor(android.graphics.Color.RED)
                setPadding(20, 20, 20, 20)
            }
            addView(errorText)
        }
    }
    
    private fun handleKeyPress(key: SimpleKeyboardService.KeyConfig) {
        // Emit event to React Native
        val event = Arguments.createMap().apply {
            putString("type", key.type)
            putString("value", if (renderer.shiftState.isActive()) key.sValue else key.value)
            putString("label", key.label)
            putBoolean("hasNikkud", key.nikkud.isNotEmpty())
        }
        
        val reactContext = context as? ReactContext
        reactContext?.getJSModule(RCTEventEmitter::class.java)
            ?.receiveEvent(id, "onKeyPress", event)
        
        // Handle special keys that affect rendering
        // Most keys are now handled by the renderer
        when (key.type.lowercase()) {
            "keyset" -> {
                if (key.keysetValue.isNotEmpty()) {
                    switchKeyset(key.keysetValue)
                }
            }
            "language" -> {
                handleLanguageSwitch()
            }
            // Shift and nikkud are handled by renderer via onRequestRerender callback
        }
    }
    
    private fun handleLanguageSwitch() {
        android.util.Log.d(TAG, "=== handleLanguageSwitch START ===")
        val config = parsedConfig
        if (config == null) {
            android.util.Log.e(TAG, "handleLanguageSwitch: config is null!")
            return
        }
        
        if (config.keysets.isEmpty()) {
            android.util.Log.e(TAG, "handleLanguageSwitch: config.keysets is empty!")
            return
        }
        
        val allKeysetIds = config.keysets.keys.toList()
        android.util.Log.d(TAG, "All keysets: ${allKeysetIds.joinToString()}")
        android.util.Log.d(TAG, "Current keyset: $currentKeysetId")
        
        // Determine the keyset type (abc, 123, or #+=)
        val currentKeysetType = when {
            currentKeysetId.endsWith("_abc") -> "abc"
            currentKeysetId.endsWith("_123") -> "123"
            currentKeysetId.endsWith("_#+=") -> "#+="
            currentKeysetId == "abc" -> "abc"
            currentKeysetId == "123" -> "123"
            currentKeysetId == "#+=" -> "#+="
            else -> {
                android.util.Log.w(TAG, "Could not determine keyset type from: $currentKeysetId, defaulting to 'abc'")
                "abc"
            }
        }
        
        android.util.Log.d(TAG, "Current keyset type: $currentKeysetType")
        
        // Find all keysets of the same type across different keyboards
        val sameTypeKeysets = allKeysetIds.filter { keysetId ->
            keysetId == currentKeysetType || keysetId.endsWith("_$currentKeysetType")
        }
        
        android.util.Log.d(TAG, "Same type keysets ($currentKeysetType): ${sameTypeKeysets.joinToString()}")
        android.util.Log.d(TAG, "Number of same type keysets: ${sameTypeKeysets.size}")
        
        if (sameTypeKeysets.size > 1) {
            val currentIndex = sameTypeKeysets.indexOf(currentKeysetId)
            android.util.Log.d(TAG, "Current index in list: $currentIndex")
            
            val nextIndex = (currentIndex + 1) % sameTypeKeysets.size
            android.util.Log.d(TAG, "Next index: $nextIndex")
            
            val nextKeysetId = sameTypeKeysets[nextIndex]
            android.util.Log.d(TAG, "Next keyset ID: $nextKeysetId")
            
            // Verify the next keyset exists
            if (config.keysets.containsKey(nextKeysetId)) {
                android.util.Log.d(TAG, "Verified: Next keyset exists in config")
                
                val prevKeysetId = currentKeysetId
                currentKeysetId = nextKeysetId
                renderer.shiftState = SimpleKeyboardService.ShiftState.Inactive
                
                android.util.Log.d(TAG, "Calling renderKeyboard()...")
                renderKeyboard()
                
                android.util.Log.d(TAG, "Successfully switched from $prevKeysetId to $currentKeysetId")
            } else {
                android.util.Log.e(TAG, "ERROR: Next keyset '$nextKeysetId' not found in config!")
                android.util.Log.e(TAG, "Available keysets: ${config.keysets.keys.joinToString()}")
            }
        } else {
            android.util.Log.d(TAG, "Only one keyboard available for type $currentKeysetType (or none found)")
        }
        
        android.util.Log.d(TAG, "=== handleLanguageSwitch END ===")
    }
    
    private fun switchKeyset(keysetId: String) {
        // Handle keyset switching with keyboard prefix
        val keyboardPrefix = if (currentKeysetId.contains("_")) {
            currentKeysetId.substringBefore("_")
        } else {
            ""
        }
        
        val targetKeysetId = if (keyboardPrefix.isNotEmpty()) {
            "${keyboardPrefix}_${keysetId}"
        } else {
            keysetId
        }
        
        val config = parsedConfig
        if (config != null && config.keysets.containsKey(targetKeysetId)) {
            currentKeysetId = targetKeysetId
            renderer.shiftState = SimpleKeyboardService.ShiftState.Inactive
            renderKeyboard()
        } else {
            android.util.Log.w(TAG, "Keyset not found: $targetKeysetId, trying without prefix: $keysetId")
            // Try without prefix as fallback
            if (config != null && config.keysets.containsKey(keysetId)) {
                currentKeysetId = keysetId
                renderer.shiftState = SimpleKeyboardService.ShiftState.Inactive
                renderKeyboard()
            }
        }
    }
    
}
