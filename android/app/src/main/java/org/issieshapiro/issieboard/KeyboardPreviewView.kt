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
    private var parsedConfig: KeyboardConfig? = null
    private var currentLanguage: String? = null

    // Standalone renderer for config mode (IssieBoard editor).
    // In input mode the engine owns the renderer instead — see the `renderer` accessor.
    private var configModeRenderer: KeyboardRenderer? = null

    // Keyboard engine for input mode (null in config mode)
    private var keyboardEngine: KeyboardEngine? = null

    // Custom text proxy for input mode (null in config mode)
    private var textProxy: CustomTextDocumentProxy? = null

    // Word suggestion controller for config mode. In input mode the engine owns one.
    private var configModeSuggestionController: WordSuggestionController? = null

    // Track typed text (config mode only — input mode uses syncedText via the proxy)
    private var typedText: String = ""

    // Preview max height (for scaling)
    private var previewMaxHeight: Int? = null

    // Fixed render height — overrides heightPreset, rows expand to fill exactly
    private var targetRenderHeight: Int? = null

    // Synced text that mirrors React Native state (single source of truth proxy)
    private var syncedText: String = ""

    // The last text value sent to React Native via text_changed
    private var lastNotifiedText: String = ""

    // Track if we're processing a keyboard operation to prevent double-handling
    private var isProcessingKeyboardOperation: Boolean = false

    // Whether a deferred text notification is pending (coalesces rapid changes)
    private var hasPendingTextNotification: Boolean = false

    // Minimum length syncedText reached during a pending coalesced operation.
    // Used to tell React how many chars were deleted before new chars were added.
    // Measured in UTF-16 code units — see notifyReactNativeOfTextChange.
    private var pendingMinLength: Int = Int.MAX_VALUE

    /** True if in input mode (IssieVoice), false if in config mode (IssieBoard) */
    private val isInputMode: Boolean
        get() = textProxy != null

    /** The active renderer: the engine's in input mode, the standalone one otherwise */
    private val renderer: KeyboardRenderer?
        get() = keyboardEngine?.renderer ?: configModeRenderer

    /** The active suggestion controller */
    private val suggestionController: WordSuggestionController?
        get() = keyboardEngine?.suggestionController ?: configModeSuggestionController


    // Keyboard container - LinearLayout for better React Native compatibility
    private val keyboardContainer = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        layoutParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        )
        setBackgroundColor(Color.parseColor("#D2D5DB"))  // Default keyboard background
        clipChildren = false  // Allow scaled content to overflow
        clipToPadding = false
    }
    
    init {
        // Set default background
        setBackgroundColor(Color.parseColor("#D2D5DB"))
        clipChildren = false  // Allow touches to scaled content outside bounds
        clipToPadding = false

        // Extend touch delegate to allow touches outside visual bounds
        isClickable = false  // Don't intercept touches at this level

        // Add keyboard container at index 0 (bottom layer)
        addView(keyboardContainer, 0)
        
        // Create the config-mode renderer. Input mode replaces this with the engine's
        // renderer when setText() first arrives (see initializeInputMode).
        val r = KeyboardRenderer(context)
        configModeRenderer = r

        // Setup suggestion controller with context for dictionary loading
        configModeSuggestionController = WordSuggestionController(r).apply {
            initialize(context)
            setLanguage("en")
        }

        // In preview mode, hide the globe (language) button - it's redundant
        r.setShowGlobeButton(false)

        // Initially set preview mode without maxHeight (will be set via prop)
        r.setPreviewMode(maxHeight = null)

        r.onKeyPress = { key ->
            handleKeyPress(key)
        }

        r.onDeleteCharacter = {
            handleBackspace()
        }

        r.onDeleteWord = {
            handleDeleteWord()
        }

        // onSuggestionSelected is NOT set here — only set when entering input mode (setText).
        // In config mode, the renderer's fallback creates a synthetic "suggestion" key
        // and routes through onKeyPress, which is correct for group selection.

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

        r.onOpenSettings = {
            // Emit open-settings event to React Native
            emitOpenSettingsEvent()
        }

        r.onSuggestionsUpdated = { suggestions ->
            // Emit suggestions-change event to React Native
            debugLog("🔮 Sending ${suggestions.size} suggestions to React Native: $suggestions")
            emitSuggestionsChangeEvent(suggestions)
        }

        // Only set onKeyLongPress in config mode (IssieBoard editor)
        // In input mode (IssieVoice), we don't want selection mode
        // This will be set conditionally when we detect the mode

        r.onLanguageSwitch = {
            // Emit language switch event to React Native
            val eventData: WritableMap = Arguments.createMap().apply {
                putString("type", "language")
                putString("value", "")
                putString("label", "")
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

            // Reset keyset so defaultKeyset from the new config takes effect
            renderer?.currentKeysetId = ""

            renderKeyboard()
        } catch (e: Exception) {
            errorLog("Failed to parse config: ${e.message}")
            showPlaceholder("Invalid configuration")
        }
    }
    
    /**
     * Set selected key IDs for visual highlighting (config mode only)
     * @param keys JSON array string, e.g., '["abc:0:3", "abc:1:2"]'
     */
    fun setSelectedKeys(keys: String?) {
        debugLog("🔧 setSelectedKeys called")

        // Selected keys indicate config mode (IssieBoard editor)
        if (!isInputMode && renderer?.onKeyLongPress == null) {
            debugLog("🔧 Setting up CONFIG MODE (IssieBoard)")

            // In config mode, enable key selection via long press
            renderer?.onKeyLongPress = { key ->
                // Emit long-press event for keyset/nikkud key selection in edit mode
                val eventData: WritableMap = Arguments.createMap().apply {
                    putString("type", "longpress")
                    putString("value", key.type)
                    putString("label", key.label)
                    putBoolean("hasNikkud", false)
                }
                emitKeyPressEvent(eventData)
            }
        }

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

    /**
     * Set maximum height for preview scaling
     * @param maxHeight Maximum height in density-independent pixels (dp)
     */
    fun setMaxHeight(maxHeight: Double) {
        val heightPx = (maxHeight * resources.displayMetrics.density).toInt()

        // Skip if maxHeight hasn't changed
        if (heightPx == previewMaxHeight) {
            return
        }

        previewMaxHeight = heightPx
        debugLog("🔧 setMaxHeight: ${maxHeight}dp = ${heightPx}px")

        // Update renderer with new max height
        renderer?.setPreviewMode(maxHeight = heightPx)

        // Re-render with new scale if we have a config
        if (parsedConfig != null) {
            renderKeyboard()
        }
    }

    /**
     * Set a fixed render height (bypasses heightPreset)
     * @param height Height in density-independent pixels (dp), or null to clear
     */
    fun setTargetHeight(height: Double?) {
        if (height != null && height > 0) {
            val heightPx = (height * resources.displayMetrics.density).toInt()
            targetRenderHeight = heightPx
            renderer?.setFixedRenderHeight(heightPx)
        } else {
            targetRenderHeight = null
            renderer?.setFixedRenderHeight(null)
        }
        // Re-render with new fixed height if we have a config
        if (parsedConfig != null) {
            renderKeyboard()
        }
    }

    /**
     * Set the current text for input mode (IssieVoice)
     * @param text Current text content
     */
    fun setText(text: String?) {
        val newText = text ?: ""
        debugLog("🔧 setText called with: '$newText'")

        // First time setText is called - enter input mode (IssieVoice)
        if (textProxy == null) {
            debugLog("🔧 Entering INPUT MODE (IssieVoice)")
            initializeInputMode(newText)
            return
        }

        // Update synced text to match React Native
        if (syncedText != newText) {
            debugLog("📝 setText syncing '${newText.takeLast(20)}', fromKeyboard: $isProcessingKeyboardOperation")
            val oldText = syncedText
            syncedText = newText
            // Keep lastNotifiedText in sync — React already knows this text
            lastNotifiedText = newText

            // If text was cleared (became empty or much shorter), force update even
            // during a keyboard operation
            val wasCleared = newText.isEmpty() && oldText.isNotEmpty()
            val wasShortenedSignificantly = newText.length < oldText.length - 5

            if (wasCleared || wasShortenedSignificantly) {
                debugLog("📝 Text cleared or shortened significantly - forcing handleTextChanged()")
                keyboardEngine?.handleTextChanged()
                keyboardEngine?.autoShiftAfterPunctuation()
                return
            }

            // If this came from keyboard, skip re-processing (keyboard already updated
            // suggestions). syncedText is still updated above so queries return the right value.
            if (isProcessingKeyboardOperation) {
                debugLog("📝 Skipping handleTextChanged (keyboard already handled it)")
                return
            }

            // External change (clicking suggestion or external keyboard)
            debugLog("📝 setText: External change - calling handleTextChanged()")
            keyboardEngine?.handleTextChanged()
        }
    }

    // MARK: - Mode Initialization

    /**
     * Enter input mode: wire a CustomTextDocumentProxy to React Native and drive a
     * KeyboardEngine with it. Port of ios/IssieBoardNG/KeyboardPreviewView.swift
     * initializeInputMode(with:).
     */
    private fun initializeInputMode(initialText: String) {
        debugLog("📱 Initializing INPUT MODE with text: '$initialText', language: $currentLanguage")

        // Create custom text proxy (pure bridge, no internal state)
        val proxy = CustomTextDocumentProxy()
        textProxy = proxy

        // Wire up proxy to React Native - proxy queries the internal mirror of RN state
        proxy.getCurrentText = { syncedText }

        proxy.onInsertText = { text ->
            // Set flag to prevent double-processing in setText
            isProcessingKeyboardOperation = true
            syncedText += text
            // Defer notification to coalesce compound operations (e.g. delete+insert for "i"→"I")
            scheduleDeferredTextNotification()
        }

        proxy.onDeleteBackward = {
            if (syncedText.isNotEmpty()) {
                isProcessingKeyboardOperation = true
                // Remove a whole grapheme cluster, so a vocalized Hebrew letter and its
                // marks disappear together — matching Swift's String.removeLast().
                val breaker = java.text.BreakIterator.getCharacterInstance()
                breaker.setText(syncedText)
                breaker.last()
                syncedText = syncedText.substring(0, breaker.previous())
                scheduleDeferredTextNotification()
            }
        }

        proxy.onDeleteScalarBackward = {
            if (syncedText.isNotEmpty()) {
                isProcessingKeyboardOperation = true
                // Remove exactly one scalar, so replacing a nikkud vowel strips only
                // the mark and leaves the base letter intact.
                val lastCodePoint = syncedText.codePointBefore(syncedText.length)
                syncedText = syncedText.substring(0, syncedText.length - Character.charCount(lastCodePoint))
                scheduleDeferredTextNotification()
            }
        }

        proxy.onCursorMove = { offset ->
            val eventData: WritableMap = Arguments.createMap().apply {
                putString("type", "cursor_move")
                putString("value", offset.toString())
                putString("label", "")
                putBoolean("hasNikkud", false)
            }
            emitKeyPressEvent(eventData)
        }

        // Initialize synced text with initial value
        syncedText = initialText
        lastNotifiedText = initialText

        // Create keyboard engine with the proxy
        val language = currentLanguage ?: "en"
        debugLog("📱 Creating KeyboardEngine with language: $language")
        val engine = KeyboardEngine(proxy, language, context)
        keyboardEngine = engine
        engine.suggestionController.initialize(context)
        engine.suggestionController.setLanguage(language)

        setupEngineCallbacks(engine)

        // Re-render with the engine's renderer
        if (parsedConfig != null) {
            debugLog("📱 Rendering keyboard with engine")
            renderKeyboard()
        } else {
            debugLog("⚠️ No config available yet - will render when config is set")
        }
    }

    /**
     * Wire the engine's renderer callbacks to React Native.
     * Port of ios/IssieBoardNG/KeyboardPreviewView.swift setupEngineCallbacks().
     */
    private fun setupEngineCallbacks(engine: KeyboardEngine) {
        val r = engine.renderer

        // In preview mode, hide the globe (language) button - it's redundant
        r.setShowGlobeButton(false)
        r.setPreviewMode(maxHeight = previewMaxHeight)

        // Chain our callback with the engine's own onKeyPress
        val engineOnKeyPress = r.onKeyPress
        r.onKeyPress = { key ->
            // First, let the engine handle it
            engineOnKeyPress?.invoke(key)

            // Then forward event-type keys to React Native
            if (key.type.lowercase() == "event") {
                debugLog("📢 Forwarding event key to React Native: ${key.value}")
                emitKeyPress(key)
            }
        }

        r.onSuggestionsUpdated = { suggestions ->
            debugLog("🔮 Sending ${suggestions.size} suggestions to React Native: $suggestions")
            emitSuggestionsChangeEvent(suggestions)
        }

        r.onOpenSettings = {
            emitOpenSettingsEvent()
        }

        r.onKeysetChanged = { newKeyset ->
            val eventData: WritableMap = Arguments.createMap().apply {
                putString("type", "keyset-changed")
                putString("value", newKeyset)
                putString("label", "")
                putBoolean("hasNikkud", false)
            }
            emitKeyPressEvent(eventData)
        }

        r.onStateChange = {
            forceLayoutRefresh()
        }

        // Re-report height when the nikkud top-row activates/deactivates
        r.onNikkudStateChanged = {
            renderKeyboard()
        }

        engine.getCurrentText = { syncedText }

        engine.onRenderKeyboard = {
            renderKeyboard()
        }

        engine.onLanguageSwitch = {
            val eventData: WritableMap = Arguments.createMap().apply {
                putString("type", "language")
                putString("value", "")
                putString("label", "")
                putBoolean("hasNikkud", false)
            }
            emitKeyPressEvent(eventData)
        }

        // Report LTR so the renderer does not invert the space-swipe offset.
        // The system keyboard needs that inversion because it drives the input
        // connection, which works in reading order. In the preview the offset instead
        // becomes a string-index delta, and React applies the RTL inversion itself —
        // without this, both layers invert and cancel out, leaving the caret moving
        // the wrong way or not at all.
        engine.onGetTextDirection = { false }

        // Provide the base letter before cursor for modifier filtering in top-row nikkud
        r.onGetCharBeforeCursor = {
            if (syncedText.isEmpty()) {
                null
            } else {
                val breaker = java.text.BreakIterator.getCharacterInstance()
                breaker.setText(syncedText)
                breaker.last()
                val lastCluster = syncedText.substring(breaker.previous())
                lastCluster.codePoints().toArray()
                    .firstOrNull { Character.isLetter(it) }
                    ?.let { String(Character.toChars(it)) }
            }
        }
    }

    // MARK: - React Native Text Notification

    private fun notifyReactNativeOfTextChange(newText: String, deletedDownTo: Int? = null) {
        // Lengths MUST be in UTF-16 code units, because React slices the string with
        // these values as JS indices and JS strings are UTF-16 indexed. Kotlin's
        // String.length is already UTF-16, so it is the correct measure here — counting
        // code points instead would collapse a Hebrew letter + nikkud into one unit
        // where JS sees two, making React slice mid-cluster and duplicate text.
        val prevLen = lastNotifiedText.length
        lastNotifiedText = newText
        // deletedTo: the number of chars that survived deletion.
        // For pure inserts: equals prevLen (nothing deleted).
        // For pure deletes: equals newText length (chars removed from tail).
        // For compound delete+insert (e.g. "i"→"I"): the minimum length reached mid-operation.
        val deletedTo = deletedDownTo ?: minOf(prevLen, newText.length)
        debugLog("📝 Notifying React Native of text change: '$newText' (prevLen: $prevLen, deletedTo: $deletedTo)")

        val eventData: WritableMap = Arguments.createMap().apply {
            putString("type", "text_changed")
            putString("value", newText)
            putInt("prevLength", prevLen)
            putInt("deletedTo", deletedTo)
            putString("label", "")
            putBoolean("hasNikkud", false)
        }
        emitKeyPressEvent(eventData)
    }

    /**
     * Schedule a deferred text notification.
     * Multiple calls within the same main-looper pass are coalesced — only the final
     * syncedText value is sent. This prevents stale-state races in React when a single
     * key operation does multiple insert/delete steps (e.g., "i"→"I" auto-capitalize).
     */
    private fun scheduleDeferredTextNotification() {
        // Track the minimum length reached during this operation.
        // Initialize from lastNotifiedText (the pre-operation baseline) on first call.
        // UTF-16 code units, to match the indices React slices with.
        if (!hasPendingTextNotification) {
            pendingMinLength = lastNotifiedText.length
        }
        pendingMinLength = minOf(pendingMinLength, syncedText.length)

        hasPendingTextNotification = true

        post {
            if (hasPendingTextNotification) {
                hasPendingTextNotification = false
                val minLen = pendingMinLength
                pendingMinLength = Int.MAX_VALUE
                notifyReactNativeOfTextChange(syncedText, minLen)
                // Clear the keyboard operation flag after React Native has time to process
                postDelayed({ isProcessingKeyboardOperation = false }, 50)
            }
        }
    }

    /**
     * Set selected key IDs for visual highlighting (config mode only)
     * @param keys JSON array string, e.g., '["abc:0:3", "abc:1:2"]'
     */
    /**
     * Set the keyboard language
     * @param language Language code (e.g., "en", "he", "ar")
     */
    fun setLanguage(language: String?) {
        val lang = language ?: "en"
        debugLog("🔧 setLanguage called with: $lang")

        if (currentLanguage == lang) return
        currentLanguage = lang

        // Reset renderer's keyset to default when language changes
        // so it doesn't try to use a stale keyset ID from the old config
        renderer?.currentKeysetId = ""

        if (keyboardEngine != null) {
            // KeyboardEngine.language is a val (unlike iOS, where it is mutable), so a
            // language change means building a new engine. syncedText carries over —
            // initializeInputMode seeds the fresh proxy with it.
            debugLog("🔧 Language changed in input mode - recreating engine")
            initializeInputMode(syncedText)
            return
        }

        // Update suggestion controller language
        suggestionController?.setLanguage(lang)
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
            ?: ""

        // Use renderer's current keyset if it's valid in this config
        val rendererKeyset = renderer?.currentKeysetId
        val currentKeyset = if (!rendererKeyset.isNullOrEmpty() && availableKeysets.contains(rendererKeyset)) {
            rendererKeyset
        } else {
            defaultKeyset
        }

        debugLog("🔧 Rendering with keyset: $currentKeyset (default: $defaultKeyset, available: $availableKeysets)")

        // Calculate scale factor if we have maxHeight
        val scale = if (previewMaxHeight != null && previewMaxHeight!! > 0) {
            val fullKeyboardHeight = renderer?.calculateKeyboardHeight(
                config,
                currentKeyset,
                config.isWordSuggestionsEnabled,
                nikkudTopRowActive = renderer?.isNikkudTopRowActive ?: false
            ) ?: 0

            if (fullKeyboardHeight > 0) {
                val rawScale = previewMaxHeight!!.toFloat() / fullKeyboardHeight.toFloat()
                // Never upscale — only scale down to fit maxHeight
                minOf(rawScale, 1.0f)
            } else {
                1.0f
            }
        } else {
            1.0f
        }

        // Container width should never exceed the view width
        val scaledWidth = minOf((width * scale).toInt(), width)
        debugLog("🔧 Scaling container: originalWidth=$width, scale=$scale, scaledWidth=$scaledWidth, previewMaxHeight=$previewMaxHeight")

        keyboardContainer.layoutParams = FrameLayout.LayoutParams(
            scaledWidth,
            FrameLayout.LayoutParams.MATCH_PARENT
        ).apply {
            gravity = Gravity.CENTER_HORIZONTAL  // Center the scaled container
        }

        // Set preview mode with maxHeight before rendering
        if (previewMaxHeight != null) {
            renderer?.setPreviewMode(maxHeight = previewMaxHeight)
        } else {
            renderer?.setPreviewMode(maxHeight = null)
        }

        // Apply fixed render height if set
        renderer?.setFixedRenderHeight(targetRenderHeight)

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

        // Calculate and report keyboard height to React Native (matching iOS behavior)
        // calculateKeyboardHeight returns pixels, convert to dp for React Native
        val suggestionsEnabled = config.isWordSuggestionsEnabled
        val calculatedHeightPx = renderer?.calculateKeyboardHeight(config, currentKeyset, suggestionsEnabled, nikkudTopRowActive = renderer?.isNikkudTopRowActive ?: false) ?: 0
        val calculatedHeightDp = (calculatedHeightPx.toFloat() / resources.displayMetrics.density).toInt()
        debugLog("📐 [KeyboardPreviewView] Calculated height: ${calculatedHeightPx}px / ${calculatedHeightDp}dp for keyset: $currentKeyset")
        emitHeightChangeEvent(calculatedHeightDp, currentKeyset)
        
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

    private fun emitOpenSettingsEvent() {
        val reactContext = context as? ReactContext ?: return

        // Use new architecture event dispatcher
        val surfaceId = UIManagerHelper.getSurfaceId(reactContext)
        val eventDispatcher = UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)

        eventDispatcher?.dispatchEvent(
            OpenSettingsEvent(surfaceId, id)
        )
    }

    private fun emitSuggestionsChangeEvent(suggestions: List<String>) {
        val reactContext = context as? ReactContext ?: return

        // Use new architecture event dispatcher
        val surfaceId = UIManagerHelper.getSurfaceId(reactContext)
        val eventDispatcher = UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)

        eventDispatcher?.dispatchEvent(
            SuggestionsChangeEvent(surfaceId, id, suggestions)
        )
    }

    private fun emitHeightChangeEvent(height: Int, keysetId: String) {
        val reactContext = context as? ReactContext ?: return

        val surfaceId = UIManagerHelper.getSurfaceId(reactContext)
        val eventDispatcher = UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)

        eventDispatcher?.dispatchEvent(
            HeightChangeEvent(surfaceId, id, height, keysetId)
        )
    }

    // MARK: - Key Press Handling
    
    /**
     * Config-mode key handling: maintain a local typedText buffer and emit one event
     * per key, which MainScreen handles on its legacy path.
     *
     * Input mode never reaches here — the engine owns the text via
     * CustomTextDocumentProxy and emits text_changed instead. These callbacks are only
     * installed on configModeRenderer.
     */
    private fun handleKeyPress(key: ParsedKey) {
        when (key.type.lowercase()) {
            "event", "suggestion" -> {
                // Event-only and suggestion keys - just emit to React Native, don't modify text
                debugLog("📢 Event/suggestion key: ${key.value}")
                emitKeyPress(key)
            }
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

/**
 * Custom event class for open settings events
 * Used with the new React Native architecture event system
 */
class OpenSettingsEvent(
    surfaceId: Int,
    viewTag: Int
) : Event<OpenSettingsEvent>(surfaceId, viewTag) {

    override fun getEventName(): String = "onOpenSettings"

    override fun getEventData(): WritableMap = Arguments.createMap()
}

/**
 * Custom event class for suggestions change events
 * Used with the new React Native architecture event system
 */
class SuggestionsChangeEvent(
    surfaceId: Int,
    viewTag: Int,
    private val suggestions: List<String>
) : Event<SuggestionsChangeEvent>(surfaceId, viewTag) {

    override fun getEventName(): String = "onSuggestionsChange"

    override fun getEventData(): WritableMap {
        val eventData = Arguments.createMap()
        val suggestionsArray = Arguments.createArray()
        suggestions.forEach { suggestionsArray.pushString(it) }
        eventData.putArray("suggestions", suggestionsArray)
        return eventData
    }
}

/**
 * Custom event class for height change events
 * Used with the new React Native architecture event system
 */
class HeightChangeEvent(
    surfaceId: Int,
    viewTag: Int,
    private val height: Int,
    private val keysetId: String
) : Event<HeightChangeEvent>(surfaceId, viewTag) {

    override fun getEventName(): String = "onHeightChange"

    override fun getEventData(): WritableMap {
        val eventData = Arguments.createMap()
        eventData.putDouble("height", height.toDouble())
        eventData.putString("keysetId", keysetId)
        return eventData
    }
}