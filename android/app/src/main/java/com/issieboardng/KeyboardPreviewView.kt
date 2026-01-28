package com.issieboardng

import android.content.Context
import android.widget.LinearLayout
import android.widget.FrameLayout
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import android.util.Log

/**
 * Android keyboard preview component that can be embedded in React Native
 * 
 * This is a clean implementation that delegates all rendering and state management
 * to KeyboardRenderer. This view only handles:
 * - Config loading from JSON prop
 * - Emitting key events to React Native
 * 
 * Uses FrameLayout to support overlapping views (like nikkud popup)
 */
class KeyboardPreviewView(context: Context) : FrameLayout(context) {
    
    companion object {
        private const val TAG = "KeyboardPreviewView"
    }
    
    // Shared components
    private val renderer = KeyboardRenderer(
        context = context,
        isPreview = true,
        onKeyEvent = { event -> handleKeyEvent(event) },
        onStateChange = { forceLayoutRefresh() }
    )
    private val configParser = KeyboardConfigParser(context)
    
    // Config JSON from React Native prop
    private var configJson: String? = null
    
    // Selected keys JSON from React Native prop
    private var selectedKeysJson: String? = null
    
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
        
        // Add loading placeholder
        val loadingText = android.widget.TextView(context).apply {
            text = "PREVIEW LOADING..."
            textSize = 20f
            setTextColor(android.graphics.Color.BLACK)
            setPadding(20, 20, 20, 20)
        }
        keyboardContainer.addView(loadingText)
        
        Log.d(TAG, "KeyboardPreviewView init")
    }
    
    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        super.onMeasure(widthMeasureSpec, heightMeasureSpec)
        Log.d(TAG, "onMeasure: width=${MeasureSpec.getSize(widthMeasureSpec)}, height=${MeasureSpec.getSize(heightMeasureSpec)}")
    }
    
    /**
     * Set selected key IDs for visual highlighting in edit mode
     * Format: JSON array of strings like ["abc:0:3", "abc:1:2"]
     */
    fun setSelectedKeys(json: String?) {
        Log.d(TAG, "setSelectedKeys called: ${json?.length ?: 0} chars")
        
        val newKeyIds: Set<String> = if (json == null || json.isEmpty() || json == "[]") {
            emptySet()
        } else {
            try {
                val jsonArray = org.json.JSONArray(json)
                val keyIds = mutableSetOf<String>()
                for (i in 0 until jsonArray.length()) {
                    keyIds.add(jsonArray.getString(i))
                }
                Log.d(TAG, "setSelectedKeys: ${keyIds.size} keys parsed")
                keyIds
            } catch (e: Exception) {
                Log.e(TAG, "Failed to parse selectedKeys JSON", e)
                emptySet()
            }
        }
        
        // Only update if the value actually changed
        if (selectedKeysJson == json) {
            Log.d(TAG, "setSelectedKeys: no change, skipping")
            return
        }
        
        selectedKeysJson = json
        renderer.setSelectedKeys(newKeyIds)
        
        // Only re-render if config is already loaded AND renderer has config
        // This prevents render when called before config is set
        if (configJson != null && keyboardContainer.childCount > 0) {
            // Use rerender instead of renderKeyboard to preserve renderer state
            renderer.rerender()
        }
    }
    
    /**
     * Set config JSON directly (used by React Native prop)
     */
    fun setConfigJson(json: String?) {
        val newLength = json?.length ?: 0
        val oldLength = configJson?.length ?: 0
        Log.d(TAG, "setConfigJson called: newLength=$newLength, oldLength=$oldLength, same=${json == configJson}")
        
        // Always update and re-render if we have JSON
        if (json != null && json.isNotEmpty()) {
            val configChanged = json != configJson
            configJson = json
            
            Log.d(TAG, "setConfigJson: configChanged=$configChanged, loading config...")
            loadConfig()
            
            if (configChanged) {
                // Notify renderer that config changed (for popup refresh)
                renderer.onConfigUpdated()
            }
            
            Log.d(TAG, "setConfigJson: config loaded, rendering...")
            renderKeyboard()
            Log.d(TAG, "setConfigJson: render complete")
            
            // Force additional layout refresh for config changes
            forceLayoutRefresh()
        } else {
            Log.d(TAG, "setConfigJson: json is null or empty, skipping")
        }
    }
    
    private fun loadConfig() {
        Log.d(TAG, "loadConfig called")
        
        val config = if (configJson != null) {
            // Use provided config JSON
            try {
                val jsonObject = org.json.JSONObject(configJson!!)
                val parsed = configParser.parseConfig(jsonObject)
                Log.d(TAG, "Config parsed successfully, keysets: ${parsed.keysets.keys.joinToString()}")
                parsed
            } catch (e: Exception) {
                Log.e(TAG, "Failed to parse provided config", e)
                null
            }
        } else {
            // Fall back to SharedPreferences
            Log.d(TAG, "Falling back to SharedPreferences")
            configParser.loadAndParseConfig()
        }
        
        if (config != null) {
            // Reset to default keyset when config changes from prop
            // Don't reset keyset when config changes (e.g., diacritics settings toggled)
            // Only reset if the current keyset doesn't exist in the new config
            renderer.setConfig(config, resetKeyset = false)
            Log.d(TAG, "Config set to renderer, current keyset: ${renderer.currentKeysetId}")
        } else {
            Log.e(TAG, "Failed to load config")
        }
    }
    
    private fun renderKeyboard() {
        Log.d(TAG, "renderKeyboard called")
        
        try {
            // Render using the shared renderer (no editor context in preview mode)
            renderer.renderKeyboard(keyboardContainer, null)
            Log.d(TAG, "After render, childCount: $childCount")
            
            // Force layout update
            post {
                requestLayout()
                invalidate()
                (parent as? android.view.View)?.requestLayout()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error rendering keyboard", e)
            showError("Error rendering keyboard: ${e.message}")
        }
    }
    
    /**
     * Handle key events from the renderer
     * Emits events to React Native using the new architecture event dispatcher
     */
    private fun handleKeyEvent(event: KeyEvent) {
        val eventData = Arguments.createMap()
        
        when (event) {
            is KeyEvent.TextInput -> {
                eventData.putString("type", "text")
                eventData.putString("value", event.text)
            }
            is KeyEvent.Backspace -> {
                eventData.putString("type", "backspace")
                eventData.putString("value", "")
            }
            is KeyEvent.Enter -> {
                eventData.putString("type", "enter")
                eventData.putString("value", "")
            }
            is KeyEvent.Settings -> {
                eventData.putString("type", "settings")
                eventData.putString("value", "")
            }
            is KeyEvent.Close -> {
                eventData.putString("type", "close")
                eventData.putString("value", "")
            }
            is KeyEvent.NextKeyboard -> {
                eventData.putString("type", "next-keyboard")
                eventData.putString("value", "")
            }
            is KeyEvent.Custom -> {
                eventData.putString("type", event.key.type)
                eventData.putString("value", event.key.value)
            }
        }
        
        // Emit event to React Native using new architecture event dispatcher
        emitEvent("onKeyPress", eventData)
    }
    
    /**
     * Emit event to React Native using UIManagerHelper (new architecture compatible)
     */
    private fun emitEvent(eventName: String, eventData: WritableMap) {
        val reactContext = context as? ReactContext ?: return
        val surfaceId = UIManagerHelper.getSurfaceId(this)
        val eventDispatcher = UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)
        
        eventDispatcher?.dispatchEvent(
            KeyPressEvent(surfaceId, id, eventName, eventData)
        )
    }
    
    /**
     * Custom event class for key press events (new architecture compatible)
     */
    private class KeyPressEvent(
        surfaceId: Int,
        viewTag: Int,
        private val myEventName: String,
        private val myEventData: WritableMap
    ) : Event<KeyPressEvent>(surfaceId, viewTag) {
        
        override fun getEventName(): String = myEventName
        
        override fun getEventData(): WritableMap = myEventData
    }
    
    /**
     * Force layout refresh after renderer state changes
     * This is needed because React Native views need explicit layout updates
     */
    private fun forceLayoutRefresh() {
        Log.d(TAG, "forceLayoutRefresh called")
        post {
            // Force re-measure and re-layout the keyboard container
            keyboardContainer.measure(
                MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
                MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
            )
            keyboardContainer.layout(
                keyboardContainer.left,
                keyboardContainer.top,
                keyboardContainer.right,
                keyboardContainer.bottom
            )
            
            // Request layout updates
            keyboardContainer.requestLayout()
            keyboardContainer.invalidate()
            requestLayout()
            invalidate()
            
            // Also request parent to update
            (parent as? android.view.View)?.requestLayout()
            
            Log.d(TAG, "Layout refresh complete, keyboardContainer childCount: ${keyboardContainer.childCount}")
        }
    }
    
    private fun showError(message: String) {
        keyboardContainer.removeAllViews()
        val errorText = android.widget.TextView(context).apply {
            text = message
            textSize = 14f
            setTextColor(android.graphics.Color.RED)
            setPadding(20, 20, 20, 20)
        }
        keyboardContainer.addView(errorText)
    }
}
