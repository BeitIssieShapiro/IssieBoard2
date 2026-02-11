package org.issieshapiro.issieboard

import android.content.Context
import android.graphics.Color
import android.view.Gravity
import android.view.View
import android.view.View.MeasureSpec
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import org.issieshapiro.issieboard.shared.*

/**
 * Native keyboard preview view for React Native
 * Port of ios/IssieBoardNG/KeyboardPreviewView.swift
 * 
 * Renders a preview of the keyboard configuration for the editor UI.
 * This is used in the main app to show a live preview of the keyboard
 * while editing configurations.
 * 
 * Architecture: FrameLayout (this) -> LinearLayout (keyboardContainer) -> Keyboard rows
 * The LinearLayout is used because React Native handles LinearLayout children better than
 * FrameLayout children for layout calculations.
 */
class KeyboardPreviewView(context: Context) : FrameLayout(context) {
    
    private var configJson: String? = null
    private var selectedKeys: String? = null  // JSON array of selected key IDs
    private var renderer: KeyboardRenderer? = null
    private var parsedConfig: KeyboardConfig? = null
    
    // Word suggestion controller - shared logic with keyboard extension
    private var suggestionController: WordSuggestionController? = null
    
    // Track typed text (for preview testing)
    private var typedText: String = ""
    
    // Keyboard container - LinearLayout for better React Native compatibility
    private val keyboardContainer = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        layoutParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        )
        setBackgroundColor(Color.parseColor("#D2D5DB"))  // Default keyboard background
    }
    
    init {
        // Set default background
        setBackgroundColor(Color.parseColor("#D2D5DB"))
        
        // Add keyboard container at index 0 (bottom layer)
        addView(keyboardContainer, 0)
        
        // Create renderer
        val r = KeyboardRenderer(context)
        renderer = r
        
        // Setup suggestion controller with context for dictionary loading
        suggestionController = WordSuggestionController(r).apply {
            initialize(context)
            setLanguage("en")
        }
        
        // In preview mode, hide the globe (language) button - it's redundant
        r.setShowGlobeButton(false)
        
        r.onKeyPress = { key ->
            handleKeyPress(key)
        }
        
        r.onDeleteCharacter = {
            handleBackspace()
        }
        
        r.onDeleteWord = {
            handleDeleteWord()
        }
        
        r.onSuggestionSelected = { suggestion ->
            handleSuggestionSelected(suggestion)
        }
        
        r.onNikkudSelected = { value ->
            handleNikkudSelected(value)
        }
        
        r.onKeysetChanged = { newKeyset ->
            // Emit keyset-changed event to React Native
            val eventData: WritableMap = Arguments.createMap().apply {
                putString("type", "keyset-changed")
                putString("value", newKeyset)
                putString("label", "")
                putBoolean("hasNikkud", false)
            }
            emitKeyPressEvent(eventData)
        }
        
        r.onKeyLongPress = { key ->
            // Emit long-press event for keyset/nikkud key selection in edit mode
            val eventData: WritableMap = Arguments.createMap().apply {
                putString("type", "longpress")
                putString("value", key.type)  // Use type (e.g., "keyset", "nikkud") as the value for group matching
                putString("label", key.label)
                putBoolean("hasNikkud", false)
            }
            emitKeyPressEvent(eventData)
        }
        
        r.onStateChange = {
            // Force layout refresh when renderer state changes (shift, nikkud, keyset)
            forceLayoutRefresh()
        }
        
        // Show placeholder initially
        showPlaceholder("Loading keyboard preview...")
        
        debugLog("🔧 KeyboardPreviewView init")
    }
    
    /**
     * Set the keyboard configuration JSON
     * Only re-renders if the config actually changed
     */
    fun setConfigJson(json: String?) {
        debugLog("🔧 setConfigJson called, current length: ${configJson?.length ?: 0}, new length: ${json?.length ?: 0}")
        
        // Skip if config hasn't changed (compare content, not reference)
        if (json != null && configJson != null && json == configJson) {
            debugLog("🔧 Config unchanged, skipping render")
            return
            
        }
        
        // Also skip if both are null or empty
        if (json.isNullOrEmpty() && configJson.isNullOrEmpty()) {
            debugLog("🔧 Both configs empty, skipping")
            return
        }
        
        configJson = json
        if (json.isNullOrEmpty()) {
            showPlaceholder("No configuration")
            return
        }
        
        try {
            debugLog("🔧 Parsing new config...")
            parsedConfig = KeyboardConfigParser.parse(json)
            renderKeyboard()
        } catch (e: Exception) {
            errorLog("Failed to parse config: ${e.message}")
            showPlaceholder("Invalid configuration")
        }
    }
    
    /**
     * Set selected key IDs for visual highlighting
     * @param keys JSON array string, e.g., '["abc:0:3", "abc:1:2"]'
     */
    fun setSelectedKeys(keys: String?) {
        // Skip if selected keys haven't changed
        if (keys == selectedKeys) {
            return
        }
        
        selectedKeys = keys
        // Parse selected keys and pass to renderer
        val keyIds: Set<String> = if (keys == null || keys.isEmpty() || keys == "[]") {
            emptySet()
        } else {
            try {
                val jsonArray = org.json.JSONArray(keys)
                val parsedIds = mutableSetOf<String>()
                for (i in 0 until jsonArray.length()) {
                    parsedIds.add(jsonArray.getString(i))
                }
                parsedIds
            } catch (e: Exception) {
                errorLog("Failed to parse selectedKeys JSON: ${e.message}")
                emptySet()
            }
        }
        
        renderer?.setSelectedKeys(keyIds)
        
        // Only re-render if we have a config
        if (parsedConfig != null) {
            renderKeyboard()
        }
    }
    
    private fun renderKeyboard() {
        val config = parsedConfig ?: return
        
        // Wait for layout if width is 0
        if (width == 0) {
            debugLog("🔧 Width is 0, postponing render until layout")
            post { renderKeyboard() }
            return
        }
        
        debugLog("🔧 renderKeyboard: width=$width, height=$height")
        
        // Don't clear keyboardContainer here - the renderer handles it internally
        
        // Use config's default keyset, or first available keyset
        val availableKeysets = config.keysets.map { it.id }
        val defaultKeyset = config.defaultKeyset 
            ?: availableKeysets.firstOrNull() 
            ?: "abc"
        
        // Use renderer's current keyset if it's valid in this config
        val rendererKeyset = renderer?.currentKeysetId
        val currentKeyset = if (rendererKeyset != null && availableKeysets.contains(rendererKeyset)) {
            rendererKeyset
        } else {
            defaultKeyset
        }
        
        debugLog("🔧 Rendering with keyset: $currentKeyset (default: $defaultKeyset, available: $availableKeysets)")
        
        // Configure suggestion controller based on config
        suggestionController?.setEnabled(config.isWordSuggestionsEnabled)
        suggestionController?.setAutoCorrectEnabled(config.isAutoCorrectEnabled)
        
        // Update language from config's first keyboard
        config.keyboards?.firstOrNull()?.let { firstKeyboard ->
            suggestionController?.setLanguage(firstKeyboard)
        }
        
        renderer?.setWordSuggestionsEnabled(config.isWordSuggestionsEnabled)
        
        renderer?.renderKeyboard(
            container = keyboardContainer,
            config = config,
            currentKeysetId = currentKeyset,
            editorContext = EditorContext(
                enterVisible = true,
                enterLabel = "↵",
                enterAction = 0,
                fieldType = "default"
            ),
            overlayContainer = this  // Pass this (FrameLayout) as overlay container for nikkud picker
        )
        
        // Show initial suggestions if enabled
        if (config.isWordSuggestionsEnabled && (suggestionController?.currentWord?.isEmpty() == true)) {
            post {
                suggestionController?.showDefaults()
            }
        }
        
        // Force layout update after rendering
        debugLog("🔧 Forcing layout update, keyboardContainer.childCount=${keyboardContainer.childCount}")
        forceLayoutRefresh()
    }
    
    /**
     * Force layout refresh after renderer state changes
     * This is needed because React Native views need explicit layout updates
     */
    private fun forceLayoutRefresh() {
        debugLog("🔧 forceLayoutRefresh called")
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
            (parent as? View)?.requestLayout()

            debugLog("🔧 Layout refresh complete, keyboardContainer childCount: ${keyboardContainer.childCount}")
        }
    }
    
    private fun showPlaceholder(message: String) {
        keyboardContainer.removeAllViews()
        
        val placeholder = TextView(context).apply {
            text = message
            gravity = Gravity.CENTER
            setTextColor(Color.GRAY)
            textSize = 16f
        }
        
        val params = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.MATCH_PARENT
        )
        keyboardContainer.addView(placeholder, params)
    }
    
    private fun sendKeyPressEvent(key: ParsedKey) {
        val eventData: WritableMap = Arguments.createMap().apply {
            putString("type", key.type)
            putString("value", key.value)
            putString("label", key.label.ifEmpty { key.caption })
            putBoolean("hasNikkud", key.nikkud.isNotEmpty())
        }
        emitKeyPressEvent(eventData)
    }
    
    private fun emitKeyPressEvent(eventData: WritableMap) {
        val reactContext = context as? ReactContext ?: return
        
        // Use new architecture event dispatcher
        val surfaceId = UIManagerHelper.getSurfaceId(reactContext)
        val eventDispatcher = UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)
        
        eventDispatcher?.dispatchEvent(
            KeyPressEvent(surfaceId, id, eventData)
        )
    }
    
    // MARK: - Key Press Handling
    
    private fun handleKeyPress(key: ParsedKey) {
        when (key.type.lowercase()) {
            "backspace" -> {
                handleBackspace()
            }
            "enter", "action" -> {
                typedText += "\n"
                suggestionController?.handleEnter()
                emitKeyPress(key)
            }
            "space" -> {
                typedText += " "
                suggestionController?.handleSpace()
                emitKeyPress(key)
            }
            else -> {
                val value = key.value
                if (value.isNotEmpty()) {
                    if (value == " ") {
                        typedText += " "
                        suggestionController?.handleSpace()
                    } else {
                        typedText += value
                        suggestionController?.handleCharacterTyped(value)
                    }
                }
                emitKeyPress(key)
            }
        }
    }
    
    private fun handleBackspace() {
        if (typedText.isNotEmpty()) {
            typedText = typedText.dropLast(1)
        }
        
        if (suggestionController?.handleBackspace() != true) {
            detectCurrentWord()
        }
        
        // Emit backspace event
        val eventData: WritableMap = Arguments.createMap().apply {
            putString("type", "backspace")
            putString("value", "")
            putString("label", "⌫")
            putBoolean("hasNikkud", false)
        }
        emitKeyPressEvent(eventData)
    }
    
    private fun handleDeleteWord() {
        val currentWord = suggestionController?.currentWord ?: ""
        
        // Delete from typedText
        if (currentWord.isNotEmpty()) {
            repeat(currentWord.length) {
                if (typedText.isNotEmpty()) {
                    typedText = typedText.dropLast(1)
                }
            }
        } else if (typedText.isNotEmpty()) {
            // Delete backwards to previous word boundary
            while (typedText.isNotEmpty()) {
                val lastChar = typedText.last()
                typedText = typedText.dropLast(1)
                if (lastChar == ' ' || lastChar == '\n') {
                    break
                }
            }
        }
        
        detectCurrentWord()
        
        val eventData: WritableMap = Arguments.createMap().apply {
            putString("type", "backspace")
            putString("value", "")
            putString("label", "⌫")
            putBoolean("hasNikkud", false)
        }
        emitKeyPressEvent(eventData)
    }
    
    private fun handleSuggestionSelected(suggestion: String) {
        val currentWord = suggestionController?.currentWord ?: ""
        
        // Remove current word from typedText
        repeat(currentWord.length) {
            if (typedText.isNotEmpty()) {
                typedText = typedText.dropLast(1)
            }
        }
        
        // Add the suggestion + space
        typedText += suggestion + " "

        suggestionController?.handleSuggestionSelected(suggestion)
        
        // Emit event to React Native
        val eventData: WritableMap = Arguments.createMap().apply {
            putString("type", "suggestion")
            putString("value", "$suggestion ")
            putString("label", suggestion)
            putBoolean("hasNikkud", false)
        }
        emitKeyPressEvent(eventData)
    }
    
    private fun handleNikkudSelected(value: String) {
        debugLog("🎯 KeyboardPreviewView handleNikkudSelected: '$value'")
        
        // Add the nikkud character to typed text
        typedText += value
        
        // Notify suggestion controller
        suggestionController?.handleCharacterTyped(value)
        
        // Emit event to React Native
        val eventData: WritableMap = Arguments.createMap().apply {
            putString("type", "nikkud")
            putString("value", value)
            putString("label", value)
            putBoolean("hasNikkud", false)
        }
        emitKeyPressEvent(eventData)
    }
    
    private fun detectCurrentWord() {
        suggestionController?.detectCurrentWord(typedText)
    }
    
    private fun emitKeyPress(key: ParsedKey) {
        val eventData: WritableMap = Arguments.createMap().apply {
            putString("type", key.type)
            putString("value", key.value)
            putString("label", key.label.ifEmpty { key.caption })
            putBoolean("hasNikkud", key.nikkud.isNotEmpty())
        }
        emitKeyPressEvent(eventData)
    }
    
    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        super.onMeasure(widthMeasureSpec, heightMeasureSpec)
        
        // Ensure minimum height for keyboard preview
        val minHeight = (216 * resources.displayMetrics.density).toInt()
        val measuredHeight = MeasureSpec.getSize(heightMeasureSpec)
        
        if (measuredHeight < minHeight) {
            setMeasuredDimension(measuredWidth, minHeight)
        }
    }
}

/**
 * Custom event class for key press events
 * Used with the new React Native architecture event system
 */
class KeyPressEvent(
    surfaceId: Int,
    viewTag: Int,
    private val eventData: WritableMap
) : Event<KeyPressEvent>(surfaceId, viewTag) {
    
    override fun getEventName(): String = "onKeyPress"
    
    override fun getEventData(): WritableMap = eventData
}