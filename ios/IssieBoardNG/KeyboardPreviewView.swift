import UIKit
import React

/**
 * iOS keyboard preview component for React Native
 * Supports two modes:
 * 1. Config Mode (IssieBoard): Visual preview for key selection and styling
 * 2. Input Mode (IssieVoice): Full keyboard with text synchronization
 *
 * Mode is determined by whether the 'text' prop is provided.
 */
@objc(KeyboardPreviewView)
class KeyboardPreviewView: UIView {

    // MARK: - Properties

    // Keyboard engine for input mode (nil in config mode)
    private var keyboardEngine: KeyboardEngine?

    // Custom text proxy for input mode (nil in config mode)
    private var textProxy: CustomTextDocumentProxy?

    // Standalone renderer for config mode (nil in input mode)
    private var configModeRenderer: KeyboardRenderer?

    // Parsed config
    private var parsedConfig: KeyboardConfig?
    private var currentLanguage: String?

    // Event callbacks for React Native
    @objc var onKeyPress: RCTBubblingEventBlock?
    @objc var onSuggestionSelect: RCTBubblingEventBlock?
    @objc var onSuggestionsChange: RCTBubblingEventBlock?
    @objc var onLanguageChange: RCTDirectEventBlock?
    @objc var onOpenSettings: RCTBubblingEventBlock?

    // Selected keys for edit mode visualization (config mode only)
    private var selectedKeyIds: Set<String> = []

    // Whether to hide the globe (next-keyboard) button — controlled by React prop
    @objc var hideGlobeButton: Bool = false {
        didSet {
            renderer?.setShowGlobeButton(!hideGlobeButton)
        }
    }

    // Layout tracking to prevent infinite loops
    private var lastRenderedWidth: CGFloat = 0
    private var lastStoredConfigJson: String?

    // Event callback for height changes
    @objc var onHeightChange: RCTBubblingEventBlock?

    // Maximum height for preview scaling
    private var previewMaxHeight: CGFloat?

    // Fixed render height — overrides heightPreset, rows expand to fill exactly
    private var targetRenderHeight: CGFloat?

    // Synced text that mirrors React Native state (single source of truth proxy)
    private var syncedText: String = ""

    // The last text value sent to React Native via text_changed
    private var lastNotifiedText: String = ""

    // Track if we're processing a keyboard operation to prevent double-handling
    private var isProcessingKeyboardOperation: Bool = false

    // Whether a deferred text notification is pending (coalesces rapid changes)
    private var hasPendingTextNotification: Bool = false

    // Minimum length syncedText reached during a pending coalesced operation.
    // Used to tell React how many chars were deleted before new chars were added.
    private var pendingMinLength: Int = Int.max

    // MARK: - Mode Detection

    /// True if in input mode (IssieVoice), false if in config mode (IssieBoard)
    private var isInputMode: Bool {
        return textProxy != nil
    }

    // MARK: - Initialization

    override init(frame: CGRect) {
        super.init(frame: frame)

        backgroundColor = UIColor(red: 0.82, green: 0.82, blue: 0.82, alpha: 1.0)
        clipsToBounds = false  // Allow touches to scaled content outside bounds

        debugLog("📱 KeyboardPreviewView initialized (mode will be determined when text prop is set)")
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    // MARK: - React Native Props

    @objc func setConfigJson(_ configJson: String?) {
        guard let configJson = configJson, !configJson.isEmpty else {
            return
        }

        // Skip if config hasn't changed (avoids unnecessary re-renders)
        if configJson == lastStoredConfigJson {
            return
        }

        // Store the config for comparison
        lastStoredConfigJson = configJson
        parseAndRender(configJson)
    }

    @objc func setSelectedKeys(_ selectedKeysJson: String?) {
        // Config mode only - for key selection in IssieBoard
        guard let jsonString = selectedKeysJson,
              let jsonData = jsonString.data(using: .utf8),
              let keys = try? JSONDecoder().decode([String].self, from: jsonData) else {
            selectedKeyIds = []
            renderer?.setSelectedKeys([])
            renderKeyboard()
            return
        }

        selectedKeyIds = Set(keys)
        renderer?.setSelectedKeys(selectedKeyIds)
        renderKeyboard()
    }

    @objc func setText(_ text: String?) {
        let newText = text ?? ""
        print("📱 KeyboardPreviewView.setText called with: '\(newText)'")

        // Check if this is the first time text prop is being set
        // Initialize input mode even if text is empty (IssieVoice starts with empty text)
        if textProxy == nil {
            print("📱 KeyboardPreviewView: Entering INPUT MODE (text prop provided)")
            initializeInputMode(with: newText)
            return
        }

        // Update synced text to match React Native
        if syncedText != newText {
            print("📝 KeyboardPreviewView: setText syncing '\(newText.suffix(20))', fromKeyboard: \(isProcessingKeyboardOperation)")
            let oldText = syncedText
            syncedText = newText
            // Keep lastNotifiedText in sync — React already knows this text
            lastNotifiedText = newText

            // If text was cleared (became empty or much shorter), force update even during keyboard operation
            let wasCleared = newText.isEmpty && !oldText.isEmpty
            let wasShortenedSignificantly = newText.count < oldText.count - 5

            if wasCleared || wasShortenedSignificantly {
                print("📝 Text cleared or shortened significantly - forcing handleTextChanged()")
                keyboardEngine?.handleTextChanged()
                keyboardEngine?.autoShiftAfterPunctuation()
                return
            }

            // If this came from keyboard, skip re-processing (keyboard already updated suggestions)
            // But we still update syncedText above so queries return the right value
            if isProcessingKeyboardOperation {
                print("📝 Skipping handleTextChanged (keyboard already handled it)")
                return
            }

            // External change (clicking suggestion or external keyboard)
            // Let KeyboardEngine's shared logic handle it
            print("📝 setText: External change - calling handleTextChanged()")
            keyboardEngine?.handleTextChanged()
        }
    }

    @objc func setMaxHeight(_ maxHeight: NSNumber?) {
        if let height = maxHeight?.doubleValue {
            previewMaxHeight = CGFloat(height)
            // Update renderer with new max height
            renderer?.setPreviewMode(maxHeight: previewMaxHeight)
            // Re-render with new scale
            renderKeyboard()
        } else {
            previewMaxHeight = nil
            renderer?.setPreviewMode(maxHeight: nil)
            // Re-render at full size
            renderKeyboard()
        }
    }

    @objc func setTargetHeight(_ targetHeight: NSNumber?) {
        if let height = targetHeight?.doubleValue, height > 0 {
            targetRenderHeight = CGFloat(height)
            renderer?.setFixedRenderHeight(CGFloat(height))
        } else {
            targetRenderHeight = nil
            renderer?.setFixedRenderHeight(nil)
        }
        renderKeyboard()
    }

    // MARK: - Mode Initialization

    private func initializeInputMode(with initialText: String) {
        print("📱 Initializing INPUT MODE with text: '\(initialText)', language: \(currentLanguage ?? "nil")")

        // Create custom text proxy (pure bridge, no internal state)
        let proxy = CustomTextDocumentProxy()
        self.textProxy = proxy

        // Wire up proxy to React Native - proxy queries React Native for current text
        proxy.getCurrentText = { [weak self] in
            // Use the internal syncedText that mirrors React Native
            return self?.syncedText ?? ""
        }

        proxy.onInsertText = { [weak self] text in
            guard let self = self else { return }
            // Set flag to prevent double-processing in setText
            self.isProcessingKeyboardOperation = true
            // Update synced text immediately
            self.syncedText += text
            // Defer notification to coalesce compound operations (e.g. delete+insert for "i"→"I")
            self.scheduleDeferredTextNotification()
        }

        proxy.onDeleteBackward = { [weak self] in
            guard let self = self else { return }
            if !self.syncedText.isEmpty {
                // Set flag to prevent double-processing in setText
                self.isProcessingKeyboardOperation = true
                self.syncedText.removeLast()
                // Defer notification to coalesce compound operations
                self.scheduleDeferredTextNotification()
            }
        }

        proxy.onCursorMove = { [weak self] offset in
            guard let self = self else { return }
            self.onKeyPress?([
                "type": "cursor_move",
                "value": String(offset),
                "label": "",
                "hasNikkud": false
            ])
        }

        // Initialize synced text with initial value
        self.syncedText = initialText
        self.lastNotifiedText = initialText

        // Create keyboard engine with the proxy
        let language = currentLanguage ?? "en"
        print("📱 Creating KeyboardEngine with language: \(language)")
        let engine = KeyboardEngine(textProxy: proxy, language: language)
        self.keyboardEngine = engine

        // Set up engine callbacks
        setupEngineCallbacks(engine)

        // Re-render with engine's renderer
        if let config = parsedConfig {
            print("📱 Rendering keyboard with engine")
            renderKeyboardWithEngine(config: config, engine: engine)
        } else {
            print("⚠️ No config available yet - will render when config is set")
        }
    }

    private func setupEngineCallbacks(_ engine: KeyboardEngine) {
        // Store the original onKeyPress from engine (set by KeyboardEngine.init)
        let engineOnKeyPress = engine.renderer.onKeyPress

        // Chain our callback with the engine's callback
        engine.renderer.onKeyPress = { [weak self] key in
            // First, let the engine handle it
            engineOnKeyPress?(key)

            // Then, forward event-type keys to React Native
            if key.type == "event" {
                print("📢 KeyboardPreviewView: Forwarding event key to React Native: \(key.value)")
                self?.onKeyPress?([
                    "type": key.type,
                    "value": key.value,
                    "label": key.label,
                    "hasNikkud": false
                ])
            }
        }

        // Set up suggestion updates callback (preview mode doesn't use highlightIndex)
        engine.renderer.onSuggestionsUpdated = { [weak self] suggestions, _ in
            self?.sendSuggestionsToReactNative(suggestions)
        }

        // Set up text getter for auto-shift
        engine.getCurrentText = { [weak self] in
            return self?.syncedText ?? ""
        }

        // Set up render callback
        engine.onRenderKeyboard = { [weak self] in
            self?.renderKeyboard()
        }

        // Set up language switch callback
        engine.onLanguageSwitch = { [weak self] in
            self?.sendLanguageSwitchToReactNative()
        }

        // Set up settings button callback
        engine.renderer.onOpenSettings = { [weak self] in
            print("⚙️ KeyboardPreviewView: Settings button pressed")
            self?.onOpenSettings?([:])
        }

        // Re-report height when nikkud top-row activates/deactivates
        engine.renderer.onNikkudStateChanged = { [weak self] in
            self?.renderKeyboard()
        }

        // Provide the base letter before cursor for modifier filtering in top-row nikkud
        engine.renderer.onGetCharBeforeCursor = { [weak self] in
            guard let text = self?.syncedText, !text.isEmpty else { return nil }
            let lastCluster = String(text.suffix(1))
            return lastCluster.unicodeScalars.first(where: {
                $0.properties.generalCategory == .otherLetter ||
                $0.properties.generalCategory == .uppercaseLetter ||
                $0.properties.generalCategory == .lowercaseLetter
            }).map { String($0) }
        }
    }

    private func notifyReactNativeOfTextChange(_ newText: String, deletedDownTo minLength: Int? = nil) {
        let prevLen = lastNotifiedText.count
        lastNotifiedText = newText
        // deletedTo: the number of chars that survived deletion.
        // For pure inserts: equals prevLen (nothing deleted).
        // For pure deletes: equals newText.count (chars removed from tail).
        // For compound delete+insert (e.g. "i"→"I"): the minimum length reached mid-operation.
        let deletedTo = minLength ?? min(prevLen, newText.count)
        print("📝 KeyboardPreviewView: Notifying React Native of text change: '\(newText)' (prevLen: \(prevLen), deletedTo: \(deletedTo))")

        onKeyPress?([
            "type": "text_changed",
            "value": newText,
            "prevLength": prevLen,
            "deletedTo": deletedTo,
            "label": "",
            "hasNikkud": false
        ])
    }

    /// Schedule a deferred text notification.
    /// Multiple calls within the same run-loop iteration are coalesced — only the final
    /// syncedText value is sent. This prevents stale-state races in React when a single
    /// key operation does multiple insert/delete steps (e.g., "i"→"I" auto-capitalize).
    private func scheduleDeferredTextNotification() {
        // Track the minimum length reached during this operation.
        // Initialize from lastNotifiedText (the pre-operation baseline) on first call.
        if !hasPendingTextNotification {
            pendingMinLength = lastNotifiedText.count
        }
        pendingMinLength = min(pendingMinLength, syncedText.count)

        hasPendingTextNotification = true

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            guard self.hasPendingTextNotification else { return }
            self.hasPendingTextNotification = false
            let minLen = self.pendingMinLength
            self.pendingMinLength = Int.max
            self.notifyReactNativeOfTextChange(self.syncedText, deletedDownTo: minLen)
            // Clear the keyboard operation flag after React Native has time to process
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                self.isProcessingKeyboardOperation = false
            }
        }
    }

    // MARK: - Config Parsing & Rendering

    private func parseAndRender(_ jsonString: String) {
        guard let jsonData = jsonString.data(using: .utf8) else {
            return
        }

        do {
            parsedConfig = try JSONDecoder().decode(KeyboardConfig.self, from: jsonData)

            // Extract language from config
            if let configJsonData = jsonString.data(using: .utf8),
               let configJson = try? JSONSerialization.jsonObject(with: configJsonData) as? [String: Any],
               let lang = configJson["language"] as? String {
                // Track language changes
                if self.currentLanguage != lang {
                    self.currentLanguage = lang

                    print("📱 KeyboardPreviewView: Language changed to '\(lang)'")

                    // Reset renderer's keyset to default when language changes
                    // so it doesn't try to use a stale keyset ID from the old config
                    if let engine = keyboardEngine {
                        engine.language = lang
                        engine.renderer.currentKeysetId = "abc"
                        engine.suggestionController.setLanguage(lang)
                        WordCompletionManager.shared.setLanguage(lang)
                        engine.autoShiftAfterPunctuation()
                    } else if let renderer = configModeRenderer {
                        renderer.currentKeysetId = "abc"
                    }
                }
            }

            // Reset keyset so defaultKeyset from the new config takes effect
            renderer?.currentKeysetId = ""

            // Check if nikkud picker is showing
            let hasNikkudPicker = subviews.contains(where: { $0.tag == 999 })

            if hasNikkudPicker {
                // Refresh the picker with new options
                renderer?.refreshNikkudPickerIfOpen(in: self, config: parsedConfig!)
            } else {
                // renderKeyboard() handles both input mode (via engine) and config mode
                renderKeyboard()
            }
        } catch {
            errorLog("Failed to parse config: \(error)")
        }
    }

    private var renderer: KeyboardRenderer? {
        if let engine = keyboardEngine {
            return engine.renderer
        }
        return configModeRenderer
    }

    private func renderKeyboard() {
        guard let config = parsedConfig else { return }

        if let engine = keyboardEngine {
            // Input mode - use engine's renderer
            renderKeyboardWithEngine(config: config, engine: engine)
        } else {
            // Config mode - create standalone renderer
            renderKeyboardConfigMode(config: config)
        }
    }

    private var hasInitialized: Bool = false

    private func renderKeyboardWithEngine(config: KeyboardConfig, engine: KeyboardEngine) {
        lastRenderedWidth = bounds.width

        let renderer = engine.renderer

        // Apply fixed render height if set
        renderer.setFixedRenderHeight(targetRenderHeight)

        // Configure for input mode — use hideGlobeButton prop
        renderer.setShowGlobeButton(!hideGlobeButton)

        // Set preview mode with maxHeight if available
        if let maxHeight = previewMaxHeight {
            renderer.setPreviewMode(maxHeight: maxHeight)
        } else {
            renderer.setPreviewMode(true)
        }

        // Configure suggestions
        engine.suggestionController.setEnabled(config.isWordSuggestionsEnabled)
        engine.suggestionController.setAutoCorrectEnabled(config.isAutoCorrectEnabled)
        renderer.setWordSuggestionsEnabled(config.isWordSuggestionsEnabled)

        let currentKeysetId = renderer.currentKeysetId.isEmpty ? (config.defaultKeyset ?? "abc") : renderer.currentKeysetId

        // Render
        renderer.renderKeyboard(
            in: self,
            config: config,
            currentKeysetId: currentKeysetId,
            editorContext: nil
        )

        // Calculate and report keyboard height to React Native
        let suggestionsEnabled = config.isWordSuggestionsEnabled
        let calculatedHeight = renderer.calculateKeyboardHeight(for: config, keysetId: currentKeysetId, suggestionsEnabled: suggestionsEnabled, nikkudTopRowActive: renderer.isNikkudTopRowActive)

        print("📐 [KeyboardPreviewView-InputMode] Calculated height: \(calculatedHeight)")

        // Report height to React Native
        onHeightChange?([
            "height": calculatedHeight,
            "keysetId": currentKeysetId
        ])

        // Show initial suggestions ONLY on first initialization
        // Don't update on every render as it overrides what we just set
        if !hasInitialized {
            hasInitialized = true

            // Apply auto-shift
            DispatchQueue.main.async { [weak self] in
                self?.keyboardEngine?.autoShiftAfterPunctuation()
            }
        }

        // Always restore suggestions after render so they aren't wiped by re-renders
        if config.isWordSuggestionsEnabled {
            engine.updateSuggestions()
        }
    }

    private func renderKeyboardConfigMode(config: KeyboardConfig) {
        // Create renderer once and reuse it
        if configModeRenderer == nil {
            configModeRenderer = KeyboardRenderer()

            // Set up callbacks for key selection
            configModeRenderer?.onKeyPress = { [weak self] key in
                self?.handleKeyPressConfigMode(key)
            }

            configModeRenderer?.onKeyLongPress = { [weak self] key in
                self?.handleKeyLongPress(key)
            }

            // Set up settings button callback for config mode
            configModeRenderer?.onOpenSettings = { [weak self] in
                print("⚙️ KeyboardPreviewView (config mode): Settings button pressed")
                self?.onOpenSettings?([:])
            }
        }

        guard let renderer = configModeRenderer else { return }

        renderer.setFixedRenderHeight(targetRenderHeight)
        renderer.setShowGlobeButton(!hideGlobeButton)  // Use prop to control globe visibility

        // Set preview mode with maxHeight if available
        if let maxHeight = previewMaxHeight {
            renderer.setPreviewMode(maxHeight: maxHeight)
        } else {
            renderer.setPreviewMode(true)
        }

        renderer.setSelectedKeys(selectedKeyIds)

        let currentKeysetId = renderer.currentKeysetId.isEmpty ? (config.defaultKeyset ?? "abc") : renderer.currentKeysetId

        renderer.renderKeyboard(
            in: self,
            config: config,
            currentKeysetId: currentKeysetId,
            editorContext: nil
        )

        lastRenderedWidth = bounds.width

        // Calculate and report keyboard height to React Native
        let suggestionsEnabled = config.wordSuggestionsEnabled ?? true
        let calculatedHeight = renderer.calculateKeyboardHeight(for: config, keysetId: currentKeysetId, suggestionsEnabled: suggestionsEnabled, nikkudTopRowActive: renderer.isNikkudTopRowActive)

        print("📐 [KeyboardPreviewView-ConfigMode] Calculated height: \(calculatedHeight)")

        // Report height to React Native
        onHeightChange?([
            "height": calculatedHeight,
            "keysetId": currentKeysetId
        ])
    }

    // MARK: - Event Handlers (Config Mode)

    /// Handle key press in config mode (for key selection in IssieBoard)
    private func handleKeyPressConfigMode(_ key: ParsedKey) {
        print("🔑 KeyboardPreviewView handleKeyPressConfigMode: type='\(key.type)'")

        // Emit key press event for selection
        onKeyPress?([
            "type": key.type,
            "value": key.value,
            "label": key.label,
            "hasNikkud": !key.nikkud.isEmpty
        ])
    }

    /// Handle long-press on keys for selection in edit mode (config mode only)
    private func handleKeyLongPress(_ key: ParsedKey) {
        print("🔑 KeyboardPreviewView handleKeyLongPress: type='\(key.type)'")

        onKeyPress?([
            "type": "longpress",
            "value": key.type,
            "label": key.label,
            "hasNikkud": false
        ])
    }

    private func sendSuggestionsToReactNative(_ suggestions: [String]) {
        guard let onSuggestionsChange = onSuggestionsChange else { return }
        print("🔮 Sending suggestions to React Native:", suggestions)
        onSuggestionsChange(["suggestions": suggestions])
    }

    private func sendLanguageSwitchToReactNative() {
        guard let onKeyPress = onKeyPress else { return }
        print("🌐 Sending language switch event to React Native")
        onKeyPress([
            "type": "language",
            "value": "",
            "label": "",
            "hasNikkud": false
        ])
    }

    // MARK: - Layout

    override func layoutSubviews() {
        super.layoutSubviews()

        let currentWidth = bounds.width
        let widthDiff = abs(currentWidth - lastRenderedWidth)

        print("📐 [KeyboardPreviewView] layoutSubviews called - currentWidth: \(currentWidth), lastRenderedWidth: \(lastRenderedWidth), diff: \(widthDiff)")

        // Don't re-render if nikkud picker is showing
        let hasNikkudPicker = subviews.contains(where: { $0.tag == 999 })
        if hasNikkudPicker {
            print("📐 [KeyboardPreviewView] Skipping render - nikkud picker is showing")
            return
        }

        // Only re-render if width changed
        if parsedConfig != nil && widthDiff > 1 {
            print("📐 [KeyboardPreviewView] Width changed significantly, re-rendering keyboard")
            renderKeyboard()
        } else {
            print("📐 [KeyboardPreviewView] Width change too small or no config, skipping render")
        }
    }
}
