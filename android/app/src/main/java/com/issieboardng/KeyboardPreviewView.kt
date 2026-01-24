package com.issieboardng

import android.content.Context
import android.content.SharedPreferences
import android.widget.LinearLayout
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter
import org.json.JSONObject

/**
 * Android keyboard preview component that can be embedded in React Native
 * Renders the keyboard layout using shared KeyboardRenderer and emits keyPress events
 * Can use either provided configJson or fall back to SharedPreferences
 */
class KeyboardPreviewView(context: Context) : LinearLayout(context) {
    
    companion object {
        private const val TAG = "KeyboardPreviewView"
        private const val DEFAULT_KEYSET_ID = "abc"
    }
    
    // Shared renderer
    private val renderer = KeyboardRenderer(
        context = context,
        isPreview = true,
        onKeyPress = { key -> handleKeyPress(key) }
    )
    
    // State
    private var parsedConfig: SimpleKeyboardService.ParsedConfig? = null
    private var currentKeysetId: String = DEFAULT_KEYSET_ID
    private val configParser = KeyboardConfigParser(context)
    private var configJson: String? = null
    
    init {
        orientation = VERTICAL
        // Don't set layoutParams here - let React Native handle it via ViewManager
        
        // Set initial background
        setBackgroundColor(android.graphics.Color.parseColor("#E0E0E0"))
        
        // Add test TextView to verify component is mounting
        val testText = android.widget.TextView(context).apply {
            text = "PREVIEW LOADING..."
            textSize = 20f
            setTextColor(android.graphics.Color.BLACK)
            setPadding(20, 20, 20, 20)
        }
        addView(testText)
        
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
        
        // Use shared renderer (no editor context in preview mode)
        renderer.renderKeyboard(this, config, currentKeysetId, null)
        
        android.util.Log.d(TAG, "After render, childCount: $childCount")
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
        when (key.type.lowercase()) {
            "shift" -> {
                renderer.shiftState = renderer.shiftState.toggle()
                renderKeyboard()
            }
            "nikkud" -> {
                renderer.nikkudActive = !renderer.nikkudActive
                renderKeyboard()
            }
            "keyset" -> {
                if (key.keysetValue.isNotEmpty()) {
                    switchKeyset(key.keysetValue)
                }
            }
        }
    }
    
    private fun switchKeyset(keysetId: String) {
        val config = parsedConfig
        if (config != null && config.keysets.containsKey(keysetId)) {
            currentKeysetId = keysetId
            renderer.shiftState = SimpleKeyboardService.ShiftState.Inactive
            renderKeyboard()
        }
    }
    
}
