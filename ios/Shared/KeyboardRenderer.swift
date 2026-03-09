import UIKit

/**
 * Self-contained keyboard renderer that manages all keyboard logic internally.
 * Used for both the in-app preview and the actual keyboard extension.
 * Container only needs to provide the view and listen to final key output.
 */
class KeyboardRenderer {
    
    // MARK: - Properties
    
    // Callbacks for key output
    var onKeyPress: ((ParsedKey) -> Void)?
    var onNikkudSelected: ((String) -> Void)?
    
    // Callback for word suggestion selection
    var onSuggestionSelected: ((String) -> Void)?
    
    // Callback for suggestions update (to send to React Native)
    var onSuggestionsUpdated: (([String], Int?) -> Void)?
    
    // Whether to show the globe (next-keyboard) button
    // This is controlled by needsInputModeSwitchKey from the keyboard extension
    private var showGlobeButton: Bool = true
    
    // Callbacks for system keyboard actions (only used by actual keyboard)
    var onNextKeyboard: (() -> Void)?
    var onShowKeyboardList: ((UIView, UILongPressGestureRecognizer) -> Void)?  // Pass button and gesture for positioning
    var onDismissKeyboard: (() -> Void)?
    var onOpenSettings: (() -> Void)?
    var onLanguageSwitch: (() -> Void)?
    
    // Callbacks for backspace touch state (to coordinate with controller)
    var onBackspaceTouchBegan: (() -> Void)?
    var onBackspaceTouchEnded: (() -> Void)?
    
    // Callbacks for backspace long-press actions
    var onDeleteCharacter: (() -> Void)?     // Delete single character
    var onDeleteWord: (() -> Void)?          // Delete entire word
    
    // Callback for long-press selection (for nikkud/keyset keys in edit mode)
    var onKeyLongPress: ((ParsedKey) -> Void)?
    
    // Callback for cursor movement requests
    var onCursorMove: ((Int) -> Void)?
    
    // Callback to get text direction at cursor (returns true if RTL, false if LTR)
    var onGetTextDirection: (() -> Bool)?
    
    // Word suggestions to display
    private var currentSuggestions: [String] = []
    
    // Index of suggestion to highlight (for fuzzy matches)
    // nil = no highlight, 0 = first suggestion, 1 = second, etc.
    private var suggestionHighlightIndex: Int?
    
    // Whether word suggestions are enabled (from config, can be overridden by controller)
    private var wordSuggestionsEnabled: Bool = true
    // Override flag set by controller (e.g., for URL/email input types)
    private var wordSuggestionsOverrideEnabled: Bool? = nil
    
    // Internal state - managed entirely by renderer
    private var shiftState: ShiftState = .inactive
    private var nikkudActive: Bool = false
    private var cursorMoveMode: Bool = false
    private var config: KeyboardConfig?
    var currentKeysetId: String = "abc"  // Public so container can read it (but shouldn't write)
    private var editorContext: (enterVisible: Bool, enterLabel: String, enterAction: Int, fieldType: String)?
    
    // Cursor movement tracking
    private var cursorMoveStartPoint: CGPoint = .zero
    private var cursorMoveAccumulatedDistance: CGFloat = 0
    private let cursorMoveSensitivity: CGFloat = 30.0  // 30px = 1 character movement
    private var cursorMoveDirectionIsRTL: Bool = false  // Direction locked at start of session
    
    // Keyset button return state tracking
    // When a keyset button is pressed, it enters "return mode" where pressing again returns to the original keyset
    // Key: keysetValue (the keyset we navigated TO), Value: (returnKeysetValue, returnKeysetLabel)
    private var keysetButtonReturnState: [String: (returnValue: String, returnLabel: String)] = [:]
    
    // Diacritics settings (from profile, keyed by keyboard ID)
    private var diacriticsSettings: [String: DiacriticsSettings] = [:]
    
    // Current keyboard ID for diacritics lookup
    private var currentKeyboardId: String?
    
    // Shift double-click detection
    private var lastShiftClickTime: TimeInterval = 0
    private let doubleClickThreshold: TimeInterval = 0.5
    
    // Selected keys for visual highlighting (edit mode)
    private var selectedKeyIds: Set<String> = []
    
    // Container reference - renderer owns the rendering
    private weak var container: UIView?
    
    // Callback for keyset changes (so controller can save to preferences)
    var onKeysetChanged: ((String) -> Void)?
    
    // Layout tracking to prevent infinite loops
    private var lastRenderedWidth: CGFloat = 0
    
    // Preview mode flag - set by KeyboardPreviewView to disable key bubble
    private var isPreviewMode: Bool = false
    
    // Screen size detection for showOn filtering
    private var isLargeScreen: Bool {
        // iPad or large screen detection
        return UIDevice.current.userInterfaceIdiom == .pad
    }
    
    // UI Constants - same for preview and keyboard
    // Dynamic row height: uses adaptive calculation based on screen size and preset
    private var rowHeight: CGFloat {
        guard let container = container else {
            return 54  // Fallback if no container
        }

        // Get height preset from config (defaults to .normal)
        let preset: KeyboardHeightPreset
        if let presetString = config?.heightPreset {
            preset = KeyboardHeightPreset(rawValue: presetString) ?? .normal
        } else {
            preset = .normal
        }

        // Get screen height from window scene if available, otherwise use main screen
        let screenBounds: CGRect
        if let windowScene = container.window?.windowScene {
            screenBounds = windowScene.screen.bounds
        } else {
            screenBounds = UIScreen.main.bounds
        }

        // Calculate available height considering safe area insets
        // This is crucial for iPhones with notches/Dynamic Island
        let safeAreaInsets = container.window?.safeAreaInsets ?? .zero
        let availableHeight = screenBounds.height - safeAreaInsets.top - safeAreaInsets.bottom

        // Use available height (safe area) instead of full screen height
        let screenHeight = availableHeight

        // Create dimensions calculator
        let dimensions = KeyboardDimensions(
            screenWidth: container.bounds.width,
            screenHeight: screenHeight,
            deviceType: .current,
            heightPreset: preset
        )

        // Calculate row height (4 rows, with or without suggestions)
        // Check if suggestions are enabled (considering both config and override)
        let hasSuggestions = wordSuggestionsOverrideEnabled ?? wordSuggestionsEnabled
        return dimensions.calculateRowHeight(numberOfRows: 4, hasSuggestions: hasSuggestions)
    }
    private let keySpacing: CGFloat = 0       // No spacing between key tap areas
    private let keyInternalPadding: CGFloat = 3  // Visual gap between keys (internal margin)
    private let rowSpacing: CGFloat = 0       // No spacing between row tap areas (visual gap from keyInternalPadding)
    private let keyVerticalPadding: CGFloat = 5  // Vertical padding for visual gap between rows (2px more than horizontal)
    private let keyCornerRadius: CGFloat = 5
    private let fontSize: CGFloat = 24
    private let largeFontSize: CGFloat = 28
    private let suggestionsBarHeight: CGFloat = 32  // Reduced by 20% from 40
    private let suggestionsFontSize: CGFloat = 26  // Larger than key font (24) for better readability
    
    // Suggestions bar view reference for updates
    private weak var suggestionsBar: UIView?
    
    // MARK: - Modular Helper Classes
    
    /// Handles long-press backspace logic
    private let backspaceHandler = BackspaceHandler()
    
    /// Manages the suggestions bar UI
    private let suggestionsBarView = SuggestionsBarView()
    
    /// Manages the nikkud picker popup
    private let nikkudPickerController = NikkudPickerController()
    
    // MARK: - Initialization
    
    init() {
        debugLog("🎨 KeyboardRenderer created")
        setupHelperCallbacks()
    }
    
    /// Wire up callbacks for helper classes
    private func setupHelperCallbacks() {
        // BackspaceHandler callbacks
        backspaceHandler.onDeleteCharacter = { [weak self] in
            self?.performBackspaceDeleteViaCallback()
        }
        backspaceHandler.onDeleteWord = { [weak self] in
            self?.performWordDeleteViaCallback()
        }
        
        // SuggestionsBarView callbacks
        suggestionsBarView.onSuggestionSelected = { [weak self] suggestion in
            self?.onSuggestionSelected?(suggestion)
        }
        
        // NikkudPickerController callbacks
        nikkudPickerController.onNikkudSelected = { [weak self] value in
            self?.onNikkudSelected?(value)
        }
        nikkudPickerController.onDismiss = { [weak self] in
            self?.rerender()
        }
    }
    
    /// Internal delete character (called by backspace handler)
    private func performBackspaceDeleteViaCallback() {
        if let onDeleteCharacter = onDeleteCharacter {
            onDeleteCharacter()
        } else {
            // Create a backspace key and emit through onKeyPress
            let backspaceKey = Key(
                value: "",
                sValue: nil,
                caption: nil,
                sCaption: nil,
                type: "backspace",
                width: nil,
                offset: nil,
                hidden: nil,
                opacity: nil,
                color: nil,
                bgColor: nil,
                fontSize: nil,
                label: nil,
                keysetValue: nil,
                returnKeysetValue: nil,
                returnKeysetLabel: nil,
                nikkud: nil,
                showOn: nil,
                flex: nil,
                showForField: nil
            )
            let parsedKey = ParsedKey(from: backspaceKey, groups: [:], defaultTextColor: .black, defaultBgColor: .white)
            onKeyPress?(parsedKey)
        }
    }
    
    /// Internal delete word (called by backspace handler)
    private func performWordDeleteViaCallback() {
        if let onDeleteWord = onDeleteWord {
            onDeleteWord()
        } else {
            performBackspaceDeleteViaCallback()
        }
    }
    
    // MARK: - Helper Methods for Default Colors
    
    /// Get default text color from config, fallback to black
    private func getDefaultTextColor() -> UIColor {
        guard let config = config,
              let textColorString = config.textColor,
              !textColorString.isEmpty,
              textColorString.lowercased() != "default" else {
            return .black
        }
        return UIColor(hexString: textColorString) ?? .black
    }
    
    /// Get default key background color from config, fallback to white
    private func getDefaultKeyBgColor() -> UIColor {
        guard let config = config,
              let bgColorString = config.keysBgColor,
              !bgColorString.isEmpty,
              bgColorString.lowercased() != "default" else {
            return .white
        }
        return UIColor(hexString: bgColorString) ?? .white
    }
    
    // MARK: - Public Methods
    
    /// Calculate the required keyboard height based on the current config
    /// This returns the dynamic height needed to display the keyboard with all its rows
    /// - Parameters:
    ///   - config: The keyboard configuration
    ///   - keysetId: The keyset ID to calculate height for
    ///   - suggestionsEnabled: Whether suggestions are currently enabled (accounts for input type restrictions)
    /// - Returns: The required height in points
    func calculateKeyboardHeight(for config: KeyboardConfig, keysetId: String, suggestionsEnabled: Bool) -> CGFloat {
        // Find the keyset
        guard let keyset = config.keysets.first(where: { $0.id == keysetId }) else {
            return 216  // Default iOS keyboard height
        }
        
        let numberOfRows = keyset.rows.count
        let rowsHeight = CGFloat(numberOfRows) * rowHeight
        let spacingHeight = CGFloat(max(0, numberOfRows - 1)) * rowSpacing
        // Only include suggestions height if suggestions are actually enabled for this field
        // Reduced spacing around suggestions bar (0pt top instead of 4pt)
        let suggestionsHeight = suggestionsEnabled ? suggestionsBarHeight : 0
        let topPadding: CGFloat = 0  // Reduced from 4pt to push suggestions bar higher
        let bottomPadding: CGFloat = 4
        
        return rowsHeight + spacingHeight + suggestionsHeight + topPadding + bottomPadding
    }
    
    /// Check if width changed and re-render is needed
    func needsRender(for width: CGFloat) -> Bool {
        return abs(width - lastRenderedWidth) > 1
    }
    
    /// Trigger re-render with current config
    func rerenderIfNeeded() {
        guard let container = container, let config = config else { return }
        if needsRender(for: container.bounds.width) {
            renderKeyboard(in: container, config: config, currentKeysetId: currentKeysetId, editorContext: editorContext)
        }
    }
    
    /// Set selected key IDs for visual highlighting
    /// Key IDs are in format "keysetId:rowIndex:keyIndex", e.g., "abc:0:3"
    func setSelectedKeys(_ keyIds: Set<String>) {
        print("🎯 KeyboardRenderer setSelectedKeys: \(keyIds.count) keys")
        selectedKeyIds = keyIds
    }
    
    /// Update word suggestions displayed in the suggestions bar
    /// - Parameters:
    ///   - suggestions: Array of suggested words (max 4)
    ///   - highlightIndex: Optional index of the suggestion to highlight (for fuzzy match indication)
    func updateSuggestions(_ suggestions: [String], highlightIndex: Int? = nil) {
        print("📝 KeyboardRenderer updateSuggestions: \(suggestions), highlight: \(highlightIndex?.description ?? "none")")
        currentSuggestions = suggestions
        suggestionHighlightIndex = highlightIndex
        updateSuggestionsBar()
        // Notify callback (for system shortcuts bar or React Native)
        onSuggestionsUpdated?(suggestions, highlightIndex)
    }
    
    /// Clear all suggestions
    func clearSuggestions() {
        currentSuggestions = []
        updateSuggestionsBar()
        // Notify callback (for system shortcuts bar or React Native)
        onSuggestionsUpdated?([], nil)
    }
    
    /// Set whether to show the globe (next-keyboard) button
    /// Called by the keyboard extension based on needsInputModeSwitchKey
    func setShowGlobeButton(_ show: Bool) {
        if showGlobeButton != show {
            showGlobeButton = show
            print("🌐 setShowGlobeButton: \(show)")
            rerender()
        }
    }
    
    /// Set preview mode flag to disable key bubble in preview
    /// Called by KeyboardPreviewView during initialization
    func setPreviewMode(_ isPreview: Bool) {
        isPreviewMode = isPreview
    }
    
    /// Check if currently in cursor movement mode
    func isInCursorMoveMode() -> Bool {
        return cursorMoveMode
    }
    
    /// Set whether word suggestions are enabled (override config setting)
    /// Called by the controller when input type should disable suggestions (e.g., URL, email)
    /// Pass nil to remove override and use config value
    func setWordSuggestionsEnabled(_ enabled: Bool?) {
        if wordSuggestionsOverrideEnabled != enabled {
            wordSuggestionsOverrideEnabled = enabled
            print("📝 setWordSuggestionsEnabled override: \(String(describing: enabled))")
            // Don't rerender here - let the controller call renderKeyboard when ready
        }
    }
    
    // MARK: - Public Rendering
    
    func renderKeyboard(
        in container: UIView,
        config: KeyboardConfig,
        currentKeysetId: String,
        editorContext: (enterVisible: Bool, enterLabel: String, enterAction: Int, fieldType: String)?
    ) {
        let currentWidth = container.bounds.width
        print("📐 RENDER START =================")
        print("📐 RENDER: container.bounds.width = \(currentWidth), lastRenderedWidth = \(lastRenderedWidth)")
        print("⚙️ [Config] fontSize from config: \(config.fontSize ?? nil)")
        print("⚙️ [Config] fontName from config: \(config.fontName ?? "nil")")
        print("⚙️ [Config] fontWeight from config: \(config.fontWeight ?? "nil")")
        print("📐 RENDER CALL STACK:")
        Thread.callStackSymbols.prefix(10).forEach { print("  \($0)") }
        
        // Update last rendered width
        lastRenderedWidth = currentWidth
        
        // Store container, config, and editor context
        self.container = container
        self.config = config
        self.editorContext = editorContext
        
        // Only set currentKeysetId from parameter if renderer hasn't been initialized yet
        if self.currentKeysetId == "abc" && currentKeysetId != "abc" {
            self.currentKeysetId = currentKeysetId
        }
        
        // Derive currentKeyboardId from keyset ID (e.g., "he_abc" -> "he", "abc" -> first keyboard)
        // IMPORTANT: Reset currentKeyboardId before searching - this ensures it updates when switching languages
        if let keyboards = config.keyboards, !keyboards.isEmpty {
            // Reset to nil first to ensure we re-derive from keyset ID
            self.currentKeyboardId = nil
            
            // Check if current keyset has a prefix matching a keyboard ID
            for keyboardId in keyboards {
                if self.currentKeysetId.hasPrefix(keyboardId + "_") || self.currentKeysetId == keyboardId {
                    self.currentKeyboardId = keyboardId
                    break
                }
            }
            // If no match found, use the first keyboard
            if self.currentKeyboardId == nil {
                self.currentKeyboardId = keyboards.first
            }
            print("📱 Current keyboard ID set to: \(self.currentKeyboardId ?? "nil") (keyset: \(self.currentKeysetId))")
        }
        
        // Clear existing views, but preserve nikkud picker overlay if present
        container.subviews.forEach { subview in
            if subview.tag != 999 {  // Don't remove nikkud picker overlay
                subview.removeFromSuperview()
            }
        }
        
        // Set background color - support "default" for transparent/liquid glass effect
        if let bgColorString = config.backgroundColor {
            if bgColorString.lowercased() == "default" || bgColorString.isEmpty {
                // Use transparent background for liquid glass effect like iOS system keyboard
                container.backgroundColor = .clear
            } else if let bgColor = UIColor(hexString: bgColorString) {
                container.backgroundColor = bgColor
            }
        } else {
            // No color specified - use transparent for liquid glass effect
            container.backgroundColor = .clear
        }
        
        // Find current keyset (use self.currentKeysetId - the renderer's internal state)
        guard let keyset = config.keysets.first(where: { $0.id == self.currentKeysetId }) else {
            print("❌ Keyset not found: \(self.currentKeysetId)")
            showError(in: container, message: "Keyset not found")
            return
        }
        
        // Build groups map - returns both the map and any "showOnly" keys
        let (groupsMap, showOnlyKeys) = buildGroupsMap(config.groups ?? [])
        
        // Calculate baseline width
        let baselineWidth = calculateBaselineWidth(keyset.rows, groups: groupsMap, showOnlyKeys: showOnlyKeys)
        
        // Update word suggestions enabled state from config and override
        // If override is set, use it; otherwise use config value
        if let override = wordSuggestionsOverrideEnabled {
            wordSuggestionsEnabled = override
            print("📝 Word suggestions enabled: \(wordSuggestionsEnabled) (from controller override)")
        } else {
            wordSuggestionsEnabled = config.isWordSuggestionsEnabled
            print("📝 Word suggestions enabled: \(wordSuggestionsEnabled) (from config)")
        }
        
        // Show suggestions bar in real keyboard, hide in preview (preview sends to React Native)
        var topOffset: CGFloat = 0  // Start at 0 to push suggestions bar to very top

        if wordSuggestionsEnabled && !isPreviewMode {
            // Real keyboard - show native suggestions bar at the very top
            let bar = suggestionsBarView.createBar(width: container.bounds.width)
            container.addSubview(bar)
            topOffset = suggestionsBarHeight  // Use actual bar height (32pt)
            suggestionsBar = bar  // Store UIView reference for legacy code
        } else {
            // Preview mode - don't show bar (React Native handles it)
            suggestionsBar = nil
        }

        // Create rows container below suggestions bar (or at top if disabled)
        let rowsContainer = UIView()
        container.addSubview(rowsContainer)

        rowsContainer.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            rowsContainer.leftAnchor.constraint(equalTo: container.leftAnchor),
            rowsContainer.rightAnchor.constraint(equalTo: container.rightAnchor),
            rowsContainer.topAnchor.constraint(equalTo: container.topAnchor, constant: topOffset),
            rowsContainer.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -4)
        ])
        
        // Render each row
        var currentY: CGFloat = 0
        let availableWidth = container.bounds.width - 8
        print("📐 AVAILABLE WIDTH = \(availableWidth)")
        print("📐 RENDER END ===================")
        print("🎯 END OF RENDER: shiftState = \(shiftState)")
        
        for (rowIndex, row) in keyset.rows.enumerated() {
            let rowView = createRow(row, groups: groupsMap, showOnlyKeys: showOnlyKeys,
                                   baselineWidth: baselineWidth, 
                                   availableWidth: availableWidth,
                                   editorContext: editorContext,
                                   keysetId: self.currentKeysetId,
                                   rowIndex: rowIndex)
            rowsContainer.addSubview(rowView)
            
            rowView.frame = CGRect(x: 4, y: currentY, width: availableWidth, height: rowHeight)
            currentY += rowHeight + rowSpacing
        }
    }
    
    // MARK: - Private Helpers
    
    /// Build a map of key values to their group templates
    /// Also returns the set of keys that should be shown exclusively (if any "showOnly" group exists)
    private func buildGroupsMap(_ groups: [Group]) -> (map: [String: GroupTemplate], showOnlyKeys: Set<String>?) {
        var groupsMap: [String: GroupTemplate] = [:]
        var showOnlyKeys: Set<String>? = nil
        
        for group in groups {
            // Check if this group has "showOnly" visibility mode
            let visMode = group.template.effectiveVisibilityMode
            
            if visMode == .showOnly {
                // Collect keys that should be visible
                if showOnlyKeys == nil {
                    showOnlyKeys = Set<String>()
                }
                for item in group.items {
                    showOnlyKeys?.insert(item)
                }
            }
            
            // Store template for all items (for colors, etc.)
            for item in group.items {
                groupsMap[item] = group.template
            }
        }
        
        return (groupsMap, showOnlyKeys)
    }
    
    private func calculateBaselineWidth(_ rows: [KeyRow], groups: [String: GroupTemplate], showOnlyKeys: Set<String>?) -> CGFloat {
        var maxRowWidth: CGFloat = 0
        
        // Check if we have only one language (keyboard)
        let hasOnlyOneLanguage = (config?.keyboards?.count ?? 0) <= 1
        
        // Check if nikkud is disabled for the current keyboard
        let isNikkudDisabled = config?.diacriticsSettings?[currentKeyboardId ?? ""]?.isDisabled ?? false
        
        // Get current field type for showForField filtering
        let fieldType = editorContext?.fieldType
        
        for row in rows {
            var rowWidth: CGFloat = 0
            for key in row.keys {
                let parsedKey = ParsedKey(from: key, groups: groups,
                                         defaultTextColor: getDefaultTextColor(),
                                         defaultBgColor: getDefaultKeyBgColor())
                
                let keyType = parsedKey.type.lowercased()

                // Skip language/next-keyboard keys if only one language (except in preview mode - let config decide)
                // In preview mode (IssieBoard/IssieVoice), show all keys defined in config and let them emit events
                let shouldSkipLanguage = keyType == "language" && hasOnlyOneLanguage && !isPreviewMode
                let shouldSkipNextKeyboard = keyType == "next-keyboard" && !showGlobeButton
                if shouldSkipLanguage || shouldSkipNextKeyboard {
                    continue
                }
                
                // Skip nikkud key if disabled
                if keyType == "nikkud" && isNikkudDisabled {
                    continue
                }
                
                // Skip keys hidden by showOn filter (screen size conditional keys)
                // These keys should NOT be counted in baseline width calculation
                if !key.shouldShow(isLargeScreen: isLargeScreen) {
                    continue
                }
                
                // Skip keys hidden by showForField filter (field type conditional keys)
                if !key.shouldShow(forFieldType: fieldType) {
                    continue
                }
                
                // For baseline width calculation, we include ALL visible keys (including those hidden by style rules)
                // This ensures hidden keys still take up space and preserve the layout.
                // The only exception is keys that are hidden at the base level (parsedKey.hidden),
                // OR keys hidden via "hide" visibility mode (explicit hide, not showOnly).
                // For "showOnly" mode, we want hidden keys to still take up space.
                let keyValue = key.value ?? key.type ?? ""
                
                // Check if key is hidden via group "hide" visibility mode
                // Note: parsedKey.hidden keys (spacers) still take up space in layout,
                // so they should be counted in baseline width calculation
                let isHiddenByGroup = {
                    if let template = groups[keyValue] {
                        return template.effectiveVisibilityMode == .hide
                    }
                    return false
                }()
                
                if !isHiddenByGroup {
                    rowWidth += CGFloat(parsedKey.width + parsedKey.offset)
                }
            }
            
            if rowWidth > maxRowWidth {
                maxRowWidth = rowWidth
            }
        }
        
        return maxRowWidth > 0 ? maxRowWidth : 10.0
    }
    
    /// Determine if a key should be hidden based on visibility rules
    /// - Parameters:
    ///   - parsedKey: The parsed key configuration
    ///   - keyValue: The key's value (for special keys, use type)
    ///   - showOnlyKeys: If set, only these keys should be visible
    ///   - groups: The groups map for checking individual key visibility
    /// - Returns: True if the key should be hidden
    private func isKeyHiddenByVisibility(parsedKey: ParsedKey, keyValue: String, showOnlyKeys: Set<String>?, groups: [String: GroupTemplate]) -> Bool {
        // First check the base hidden property
        if parsedKey.hidden {
            return true
        }
        
        // Check if the key's group has an explicit "hide" visibility mode
        // This takes precedence - if explicitly marked to hide, hide it
        if let template = groups[keyValue] {
            let visMode = template.effectiveVisibilityMode
            if visMode == .hide {
                return true
            }
        }
        
        // If there's a "showOnly" rule active, check if this key is in the whitelist
        if let showOnly = showOnlyKeys {
            // Essential keys that are NEVER hidden by showOnly rule (only by explicit hide)
            // These keys are critical for typing and should always remain visible
            // unless the user explicitly creates a hide rule for them
            let essentialValues: Set<String> = [" ", ",", "."]  // space, comma, period
            let essentialTypes: Set<String> = ["space", "backspace", "enter", "next-keyboard", "settings"]
            
            // Check if this is an essential key by value or type
            if essentialValues.contains(keyValue) || essentialTypes.contains(parsedKey.type.lowercased()) {
                // Essential keys are NOT hidden by showOnly rule
                // They can only be hidden by explicit hide rule (checked above)
                return false
            }
            
            // Other special keys (shift, keyset, etc.) should check if they're in the whitelist
            let specialTypes: Set<String> = ["shift", "keyset", "nikkud", "settings", "close", "next-keyboard", "language"]
            if specialTypes.contains(parsedKey.type.lowercased()) {
                // Check if this special key is explicitly in the showOnly set
                return !showOnly.contains(keyValue) && !showOnly.contains(parsedKey.type.lowercased())
            }
            
            // For regular keys, hide if not in the showOnly set
            return !showOnly.contains(keyValue)
        }
        
        return false
    }
    
    private func createRow(
        _ row: KeyRow,
        groups: [String: GroupTemplate],
        showOnlyKeys: Set<String>?,
        baselineWidth: CGFloat,
        availableWidth: CGFloat,
        editorContext: (enterVisible: Bool, enterLabel: String, enterAction: Int, fieldType: String)?,
        keysetId: String,
        rowIndex: Int
    ) -> UIView {
        // Row container with extended tap areas for edge keys
        let rowContainer = UIView()
        var currentX: CGFloat = 0
        var keyIndex = 0
        
        // Track first and last visible keys for tap area extension
        var firstVisibleKey: (key: ParsedKey, button: UIView, x: CGFloat, width: CGFloat)? = nil
        var lastVisibleKey: (key: ParsedKey, button: UIView, x: CGFloat, width: CGFloat)? = nil
        
        // Check if we have only one language (keyboard)
        let hasOnlyOneLanguage = (config?.keyboards?.count ?? 0) <= 1
        
        // Check if nikkud is disabled for the current keyboard
        let isNikkudDisabled = config?.diacriticsSettings?[currentKeyboardId ?? ""]?.isDisabled ?? false
        
        // Get current field type for showForField filtering
        let fieldType = editorContext?.fieldType
        
        // FIRST PASS: Calculate hidden width to redistribute and count flex keys
        // We redistribute width from:
        // 1. Keys hidden by showForField (these ARE in baseline)
        // 2. next-keyboard when showGlobeButton is false (this IS in baseline)
        // 3. language when hasOnlyOneLanguage is true (this IS in baseline)
        // We do NOT redistribute from showOn-hidden keys (these are NOT in baseline)
        var hiddenWidthToRedistribute: Double = 0
        var flexKeyCount = 0
        
        for key in row.keys {
            let parsedKey = ParsedKey(from: key, groups: groups,
                                     defaultTextColor: getDefaultTextColor(),
                                     defaultBgColor: getDefaultKeyBgColor())
            
            let keyType = parsedKey.type.lowercased()
            
            // Check for hidden language/next-keyboard keys - these ARE in baseline, so redistribute
            // In preview mode, show all keys defined in config (let config decide)
            if keyType == "language" && hasOnlyOneLanguage && !isPreviewMode {
                hiddenWidthToRedistribute += parsedKey.width
                continue
            }
            if keyType == "next-keyboard" && !showGlobeButton {
                hiddenWidthToRedistribute += parsedKey.width
                continue
            }
            
            // Check for hidden nikkud key - this IS in baseline, so redistribute
            if keyType == "nikkud" && isNikkudDisabled {
                hiddenWidthToRedistribute += parsedKey.width
                continue
            }
            
            // Skip keys hidden by showOn filter - these are NOT in baseline, so don't count them
            if !key.shouldShow(isLargeScreen: isLargeScreen) {
                continue
            }
            
            // Check if key is hidden due to showForField filter (field type)
            // These keys ARE in baseline, so we need to redistribute their width
            if !key.shouldShow(forFieldType: fieldType) {
                hiddenWidthToRedistribute += parsedKey.width
                continue
            }
            
            // Count flex keys (only visible flex keys)
            if key.flex == true {
                flexKeyCount += 1
            }
        }
        
        // Calculate extra width per flex key
        let extraWidthPerFlexKey: Double = flexKeyCount > 0 ? hiddenWidthToRedistribute / Double(flexKeyCount) : 0
        
        // SECOND PASS: Render keys with redistributed width and track edge keys
        for key in row.keys {
            let parsedKey = ParsedKey(from: key, groups: groups,
                                     defaultTextColor: getDefaultTextColor(),
                                     defaultBgColor: getDefaultKeyBgColor())

            // Debug log for language key
            if parsedKey.type == "language" {
                print("🌐 FOUND LANGUAGE KEY: label=\(parsedKey.label), hidden=\(parsedKey.hidden), width=\(key.width ?? 0)")
            }
            
            // Skip language/next-keyboard keys based on:
            // 1. Only one language configured (but NOT in preview mode - let config decide), OR
            // 2. System is showing globe button (needsInputModeSwitchKey is false)
            let keyType = parsedKey.type.lowercased()
            // In preview mode (IssieBoard/IssieVoice), show all keys in config - they emit events, don't insert text
            let shouldHideLanguageKey = keyType == "language" && hasOnlyOneLanguage && !isPreviewMode
            let shouldHideNextKeyboard = keyType == "next-keyboard" && !showGlobeButton

            if (shouldHideLanguageKey || shouldHideNextKeyboard) {
                // Skip if only one language (except in preview) OR if system doesn't need us to show the globe
                keyIndex += 1
                continue
            }
            
            // Skip nikkud key if nikkud is disabled for this keyboard
            if keyType == "nikkud" && isNikkudDisabled {
                keyIndex += 1
                continue
            }
            
            // Skip key if it doesn't match the current screen size (showOn filter)
            if !key.shouldShow(isLargeScreen: isLargeScreen) {
                keyIndex += 1
                continue  // Don't add hidden width - it goes to flex keys instead
            }
            
            // Skip key if it doesn't match the current field type (showForField filter)
            if !key.shouldShow(forFieldType: fieldType) {
                keyIndex += 1
                continue  // Don't add hidden width - it goes to flex keys instead
            }
            
            // Handle offset
            if parsedKey.offset > 0 {
                let offsetWidth = (CGFloat(parsedKey.offset) / baselineWidth) * availableWidth
                currentX += offsetWidth
            }
            
            // Generate key identifier for selection checking
            let keyId = "\(keysetId):\(rowIndex):\(keyIndex)"
            let isSelected = selectedKeyIds.contains(keyId)

            // Check if key is hidden based on visibility rules
            let keyValue = key.value ?? key.type ?? ""
            let isKeyHidden = isKeyHiddenByVisibility(parsedKey: parsedKey, keyValue: keyValue, showOnlyKeys: showOnlyKeys, groups: groups)

            // In preview mode, render hidden keys with opacity instead of fully hiding them
            // This allows users to see and select keys that will be hidden
            let shouldRenderWithOpacity = isKeyHidden && isPreviewMode

            if isKeyHidden && !isPreviewMode {
                // Fully hidden - skip rendering (only when NOT in preview mode)
                let hiddenWidth = (CGFloat(parsedKey.width) / baselineWidth) * availableWidth
                currentX += hiddenWidth
            } else {
                // Calculate key width, adding extra width if this is a flex key
                var effectiveWidth = parsedKey.width
                if key.flex == true {
                    effectiveWidth += extraWidthPerFlexKey
                }

                // Calculate pixel width - the keySpacing of 0 means we don't need to subtract anything
                let keyWidth = (CGFloat(effectiveWidth) / baselineWidth) * availableWidth
                let button = createKeyButton(parsedKey, width: keyWidth, height: rowHeight,
                                            editorContext: editorContext,
                                            isSelected: isSelected)

                // Apply opacity to the button
                // Priority: 1. If key would be hidden in preview mode (showOnly/hide), use 0.3
                //           2. Otherwise use parsedKey.opacity (from explicit opacity property)
                if shouldRenderWithOpacity {
                    button.alpha = 0.3
                } else if parsedKey.opacity < 1.0 {
                    button.alpha = CGFloat(parsedKey.opacity)
                }

                rowContainer.addSubview(button)

                button.frame = CGRect(x: currentX, y: 0, width: keyWidth, height: rowHeight)

                // Track first visible key
                if firstVisibleKey == nil {
                    firstVisibleKey = (parsedKey, button, currentX, keyWidth)
                }
                // Always update last visible key
                lastVisibleKey = (parsedKey, button, currentX, keyWidth)

                currentX += keyWidth + keySpacing
            }
            
            keyIndex += 1
        }
        
        // THIRD PASS: Add extended tap areas for first and last keys
        // BUT: Skip in selection mode (preview) since extended areas would cause double-firing
        let isSelectionMode = onKeyLongPress != nil
        if !isSelectionMode {
            if let first = firstVisibleKey {
                addExtendedTapArea(
                    for: first.key,
                    button: first.button,
                    keyX: first.x,
                    keyWidth: first.width,
                    rowHeight: rowHeight,
                    availableWidth: availableWidth,
                    isLeftEdge: true,
                    container: rowContainer
                )
            }
            
            if let last = lastVisibleKey, last.button !== firstVisibleKey?.button {
                addExtendedTapArea(
                    for: last.key,
                    button: last.button,
                    keyX: last.x,
                    keyWidth: last.width,
                    rowHeight: rowHeight,
                    availableWidth: availableWidth,
                    isLeftEdge: false,
                    container: rowContainer
                )
            }
        }
        
        return rowContainer
    }
    
    /// Add extended tap area for edge keys (left or right)
    private func addExtendedTapArea(
        for key: ParsedKey,
        button: UIView,
        keyX: CGFloat,
        keyWidth: CGFloat,
        rowHeight: CGFloat,
        availableWidth: CGFloat,
        isLeftEdge: Bool,
        container: UIView
    ) {
        // Calculate extension: max half button width
        let maxExtension = keyWidth / 2
        
        // Calculate actual extension based on available space and screen boundaries
        let extensionWidth: CGFloat
        if isLeftEdge {
            // Left edge: extend to the left, but not beyond x=0
            extensionWidth = min(maxExtension, keyX)
        } else {
            // Right edge: extend to the right, but not beyond screen boundary
            let rightEdge = keyX + keyWidth
            let spaceToRight = availableWidth - rightEdge
            extensionWidth = min(maxExtension, spaceToRight)
        }
        
        // Only add extension if there's actual space
        guard extensionWidth > 0 else { return }
        
        // Create invisible button for the extended area
        let extendedButton = UIButton(type: .system)
        extendedButton.backgroundColor = UIColor(white: 1.0, alpha: 0.001)
        
        // Copy touch handlers from the main button
        extendedButton.addTarget(self, action: #selector(keyTouchDown(_:)), for: .touchDown)
        extendedButton.addTarget(self, action: #selector(keyTouchUp(_:)), for: [.touchUpInside, .touchUpOutside])
        extendedButton.addTarget(self, action: #selector(keyTouchCancelled(_:)), for: .touchCancel)
        extendedButton.addTarget(self, action: #selector(keyTapped(_:)), for: .touchUpInside)
        
        // Use the same key info as the main button
        extendedButton.accessibilityIdentifier = button.accessibilityIdentifier
        
        // Position the extended button
        let extendedFrame: CGRect
        if isLeftEdge {
            // Left extension: place to the left of the key
            extendedFrame = CGRect(x: keyX - extensionWidth, y: 0, width: extensionWidth, height: rowHeight)
        } else {
            // Right extension: place to the right of the key
            extendedFrame = CGRect(x: keyX + keyWidth, y: 0, width: extensionWidth, height: rowHeight)
        }
        
        container.addSubview(extendedButton)
        extendedButton.frame = extendedFrame
    }
    
    private func createKeyButton(
        _ key: ParsedKey,
        width: CGFloat,
        height: CGFloat,
        editorContext: (enterVisible: Bool, enterLabel: String, enterAction: Int, fieldType: String)?,
        isSelected: Bool = false
    ) -> UIView {
        // Create the main button that fills the ENTIRE tap area (no gaps)
        let button = UIButton(type: .system)
        // UIButton needs some visible content to have a hit area
        // Using a nearly invisible background to ensure it's tappable
        button.backgroundColor = UIColor(white: 1.0, alpha: 0.001)

        // Check if we're in selection/preview mode
        let isSelectionMode = onKeyLongPress != nil

        // Get key type early for all checks
        let keyType = key.type.lowercased()

        // Debug log for language key
        if keyType == "language" {
            print("🌐 CREATING LANGUAGE KEY VIEW: width=\(width), height=\(height), label=\(key.label)")
        }
        
        // For backspace key, use gesture recognizer for reliable long-press detection
        if keyType == "backspace" {
            if isSelectionMode {
                // Selection mode: tap to select (no touch handlers to avoid double-fire)
                button.addTarget(self, action: #selector(keyTapped(_:)), for: .touchUpInside)
            } else {
                // Normal keyboard mode: add touch handlers for popup bubble
                button.addTarget(self, action: #selector(keyTouchDown(_:)), for: .touchDown)
                button.addTarget(self, action: #selector(keyTouchUp(_:)), for: [.touchUpInside, .touchUpOutside])
                button.addTarget(self, action: #selector(keyTouchCancelled(_:)), for: .touchCancel)
                
                // Tap for single delete, long-press for repeat
                button.addTarget(self, action: #selector(keyTapped(_:)), for: .touchUpInside)
                
                let longPressGesture = UILongPressGestureRecognizer(target: self, action: #selector(backspaceLongPressed(_:)))
                longPressGesture.minimumPressDuration = 0.5
                button.addGestureRecognizer(longPressGesture)
            }
        } else if keyType == "settings" || keyType == "close" {
            // Settings and close: no touch handlers (to avoid popup)
            // Settings and close: always tap-selectable
            button.addTarget(self, action: #selector(keyTapped(_:)), for: .touchUpInside)
        } else if keyType == "next-keyboard" {
            // Next-keyboard (globe): tap to advance, long-press to show keyboard list
            button.addTarget(self, action: #selector(keyTapped(_:)), for: .touchUpInside)

            // Add long-press gesture to show keyboard picker
            let longPressGesture = UILongPressGestureRecognizer(target: self, action: #selector(nextKeyboardLongPressed(_:)))
            longPressGesture.minimumPressDuration = 0.5
            button.addGestureRecognizer(longPressGesture)
        } else if keyType == "shift" {
            // Shift: normal tap for toggle, long-press for selection in edit mode
            button.addTarget(self, action: #selector(keyTapped(_:)), for: .touchUpInside)
            
            if isSelectionMode {
                let longPressGesture = UILongPressGestureRecognizer(target: self, action: #selector(keyLongPressed(_:)))
                longPressGesture.minimumPressDuration = 0.5
                button.addGestureRecognizer(longPressGesture)
            }
        } else {
            // All other keys: add touch handlers for popup bubble
            button.addTarget(self, action: #selector(keyTouchDown(_:)), for: .touchDown)
            button.addTarget(self, action: #selector(keyTouchUp(_:)), for: [.touchUpInside, .touchUpOutside])
            button.addTarget(self, action: #selector(keyTouchCancelled(_:)), for: .touchCancel)
            
            button.addTarget(self, action: #selector(keyTapped(_:)), for: .touchUpInside)
            
            // Add long-press gesture for space key (for cursor movement mode)
            if keyType == "space" || key.value == " " {
                let longPressGesture = UILongPressGestureRecognizer(target: self, action: #selector(spaceLongPressed(_:)))
                longPressGesture.minimumPressDuration = 0.5
                button.addGestureRecognizer(longPressGesture)
            }
            // Add long-press gesture for keyset and nikkud keys (for selection in edit mode)
            else if keyType == "keyset" || keyType == "nikkud" {
                let longPressGesture = UILongPressGestureRecognizer(target: self, action: #selector(keyLongPressed(_:)))
                longPressGesture.minimumPressDuration = 0.5
                button.addGestureRecognizer(longPressGesture)
            }
        }
        button.accessibilityIdentifier = encodeKeyInfo(key)
        
        // Create the VISUAL key view (smaller, with padding to create visual gap)
        // This is a non-interactive view for display only
        let visualKeyView = UIView()
        visualKeyView.isUserInteractionEnabled = false  // Let touches pass through to button
        
        // Colors - use darker key colors for dark mode to match system keyboard
        var bgColor = key.backgroundColor
        if key.type.lowercased() == "shift" && shiftState.isActive() {
            bgColor = .systemGreen
        } else if key.type.lowercased() == "nikkud" && nikkudActive {
            bgColor = .systemYellow
        } else if bgColor == .white {
            // Use a darker shade for regular keys in dark mode, similar to system keyboard
            bgColor = UIColor { traitCollection in
                if traitCollection.userInterfaceStyle == .dark {
                    return UIColor(red: 0.35, green: 0.35, blue: 0.38, alpha: 1.0)
                } else {
                    return UIColor.white
                }
            }
        }
        
        visualKeyView.backgroundColor = bgColor
        visualKeyView.layer.cornerRadius = keyCornerRadius
        visualKeyView.layer.shadowColor = UIColor.black.cgColor
        visualKeyView.layer.shadowOffset = CGSize(width: 0, height: 1)
        visualKeyView.layer.shadowOpacity = 0.2
        visualKeyView.layer.shadowRadius = 1
        
        // Selection highlight for edit mode
        if isSelected {
            visualKeyView.layer.borderWidth = 3.0
            visualKeyView.layer.borderColor = UIColor.systemBlue.cgColor
        }
        
        // Create label for key text (inside the visual view)
        let label = UILabel()
        label.isUserInteractionEnabled = false
        
        // Display text based on shift state
        let displayText = shiftState.isActive() ? key.sCaption : key.caption
        
        // Determine final text
        var finalText: String
        if !key.label.isEmpty {
            finalText = key.label
        } else if !displayText.isEmpty {
            finalText = displayText
        } else if !key.value.isEmpty {
            finalText = key.value
        } else {
            finalText = getDefaultLabel(for: key.type, editorContext: editorContext)
        }
        
        // For keyset buttons in "return mode", show the return label instead
        // When we're on a keyset (e.g., "123") that has a return state, and this button
        // points to the return destination (e.g., "abc"), show the return label
        if key.type.lowercased() == "keyset" && !key.keysetValue.isEmpty {
            if let returnState = keysetButtonReturnState[currentKeysetId],
               key.keysetValue == returnState.returnValue {
                // This button points to the return destination - show the return label
                print("🔄 Keyset button '\(key.keysetValue)' in return mode, showing label: '\(returnState.returnLabel)'")
                finalText = returnState.returnLabel
            }
        }
        
        let isNikkudKey = key.type.lowercased() == "nikkud"

        // Text color - adaptive for dark/light mode
        let textColor: UIColor
        if key.textColor == .black {
            textColor = UIColor { traitCollection in
                if traitCollection.userInterfaceStyle == .dark {
                    return UIColor.white
                } else {
                    return UIColor.black
                }
            }
        } else {
            textColor = key.textColor
        }

        // Font size - check for custom fontSize first, then global config fontSize, then use defaults
        let isLargeKey = ["shift", "backspace", "enter"].contains(key.type.lowercased())
        let isMultiChar = finalText.count > 1
        let isSettingsKey = key.type.lowercased() == "settings"

        var finalFontSize: CGFloat
        if let customFontSize = key.fontSize {
            // Use custom font size if specified on the key
            finalFontSize = CGFloat(customFontSize)
            if isSettingsKey {
                print("⚙️ [Settings] Using custom fontSize: \(customFontSize)")
            }
        } else {
            // Use global config fontSize, or fall back to default sizing logic
            let defaultFontSize: CGFloat = fontSize
            let defaultLargeFontSize: CGFloat = largeFontSize

            // Check for global fontSize in config
            let globalFontSize: CGFloat = config?.fontSize.map { CGFloat($0) } ?? defaultFontSize
            let globalLargeFontSize: CGFloat = config?.fontSize.map { CGFloat($0) * (defaultLargeFontSize / defaultFontSize) } ?? defaultLargeFontSize

            if isSettingsKey {
                print("⚙️ [Settings] Config fontSize: \(config?.fontSize ?? nil)")
                print("⚙️ [Settings] Default fontSize: \(defaultFontSize), Large: \(defaultLargeFontSize)")
                print("⚙️ [Settings] Global fontSize: \(globalFontSize), Global large: \(globalLargeFontSize)")
            }

            let baseFontSize: CGFloat = isLargeKey ? globalLargeFontSize : globalFontSize

            // For multi-character keys, scale down proportionally but still respect global fontSize
            if isMultiChar {
                // If global fontSize is set, use it as base and scale down proportionally
                if config?.fontSize != nil {
                    finalFontSize = baseFontSize * 0.7
                } else {
                    // No global fontSize, use old logic with 14px cap
                    finalFontSize = min(baseFontSize * 0.7, 14)
                }
            } else {
                finalFontSize = baseFontSize
            }

            // Make nikkud diacritic mark larger for visibility
            if isNikkudKey {
                finalFontSize = 36
            }

            if isSettingsKey {
                print("⚙️ [Settings] BaseFontSize: \(baseFontSize), FinalFontSize: \(finalFontSize)")
            }
        }

        // For settings key, use SF Symbol image
        if key.type.lowercased() == "settings" {
            if let gearImage = UIImage(systemName: "gearshape.fill") {
                let imageView = UIImageView(image: gearImage)
                imageView.contentMode = .scaleAspectFit
                imageView.tintColor = textColor  // Use key's text color
                imageView.isUserInteractionEnabled = false
                visualKeyView.addSubview(imageView)
                imageView.translatesAutoresizingMaskIntoConstraints = false

                // Scale icon size based on fontSize - make icon same size as font (100%)
                // At fontSize 48: icon = 48pt
                // At fontSize 37: icon = 37pt
                let iconSize = finalFontSize
                print("⚙️ Settings icon: finalFontSize=\(finalFontSize), iconSize=\(iconSize)")

                NSLayoutConstraint.activate([
                    imageView.centerXAnchor.constraint(equalTo: visualKeyView.centerXAnchor),
                    imageView.centerYAnchor.constraint(equalTo: visualKeyView.centerYAnchor),
                    imageView.widthAnchor.constraint(equalToConstant: iconSize),
                    imageView.heightAnchor.constraint(equalToConstant: iconSize)
                ])
            } else {
                label.text = finalText
            }
        } else if isNikkudKey {
            // For nikkud key, use SVG image for the diacritical mark icon
            // The SVG images are: NikkudHatafKamatz for Hebrew, NikkudShadda for Arabic
            let imageName: String
            // Note: currentKeyboardId is optional, so unwrap it first
            if let keyboardId = currentKeyboardId {
                switch keyboardId {
                case "he":
                    imageName = "NikkudHatafKamatz"
                case "ar":
                    imageName = "NikkudShadda"
                default:
                    imageName = "NikkudHatafKamatz"  // Default to Hebrew
                }
            } else {
                imageName = "NikkudHatafKamatz"  // Default to Hebrew if not set
            }
            
            if let nikkudImage = UIImage(named: imageName)?.withRenderingMode(.alwaysTemplate) {
                let imageView = UIImageView(image: nikkudImage)
                imageView.contentMode = .scaleAspectFit
                imageView.tintColor = textColor  // Use key's text color
                imageView.isUserInteractionEnabled = false
                visualKeyView.addSubview(imageView)
                imageView.translatesAutoresizingMaskIntoConstraints = false
                NSLayoutConstraint.activate([
                    imageView.centerXAnchor.constraint(equalTo: visualKeyView.centerXAnchor),
                    imageView.centerYAnchor.constraint(equalTo: visualKeyView.centerYAnchor),
                    imageView.widthAnchor.constraint(equalToConstant: 32),
                    imageView.heightAnchor.constraint(equalToConstant: 32)
                ])
            } else {
                // Fallback to text if image not found
                label.text = finalText
            }
        } else {
            label.text = finalText
        }

        // Get font weight from config or use default
        let fontWeight: UIFont.Weight = {
            guard let weightString = config?.fontWeight else {
                return .heavy  // Default to heavy
            }
            switch weightString.lowercased() {
            case "ultralight": return .ultraLight
            case "thin": return .thin
            case "light": return .light
            case "regular": return .regular
            case "medium": return .medium
            case "semibold": return .semibold
            case "bold": return .bold
            case "heavy": return .heavy
            case "black": return .black
            default: return .heavy  // Default to heavy for unknown values
            }
        }()
        
        // Apply custom font if configured
        // Font applies to character keys in "abc" keysets (not special keys like shift, backspace, etc.)
        let isCharacterKey = !isNikkudKey &&
                            key.type.lowercased() != "shift" &&
                            key.type.lowercased() != "backspace" &&
                            key.type.lowercased() != "enter" &&
                            key.type.lowercased() != "keyset" &&
                            key.type.lowercased() != "space" &&
                            key.type.lowercased() != "settings" &&
                            key.type.lowercased() != "close" &&
                            key.type.lowercased() != "next-keyboard" &&
                            key.type.lowercased() != "language"
        
        // Check if we're in an "abc" keyset (not "123" or "#+=" keysets)
        let isAbcKeyset = currentKeysetId.hasSuffix("_abc") || currentKeysetId == "abc"
        
        let shouldUseCustomFont = isCharacterKey && isAbcKeyset && config?.fontName != nil
        
        if shouldUseCustomFont, let fontName = config?.fontName, let customFont = UIFont(name: fontName, size: finalFontSize + 2) {
            label.font = customFont
            // Add spacing for single character labels when using custom font to prevent glyph cutoff
            if finalText.count == 1 {
                label.text = " \(finalText) "
            }
        } else {
            label.font = UIFont.systemFont(ofSize: finalFontSize, weight: fontWeight)
        }
        
        label.adjustsFontSizeToFitWidth = isNikkudKey ? false : true
        label.minimumScaleFactor = 0.3
        label.numberOfLines = 1
        label.textAlignment = .center
        label.textColor = textColor
        
        // Add label to visual key view (centered)
        if key.type.lowercased() != "settings" {
            visualKeyView.addSubview(label)
            label.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([
                label.centerXAnchor.constraint(equalTo: visualKeyView.centerXAnchor),
                label.centerYAnchor.constraint(equalTo: visualKeyView.centerYAnchor),
                label.leadingAnchor.constraint(greaterThanOrEqualTo: visualKeyView.leadingAnchor, constant: 2),
                label.trailingAnchor.constraint(lessThanOrEqualTo: visualKeyView.trailingAnchor, constant: -2)
            ])
        }

        // Get key gap from config or use defaults
        let horizontalGap = CGFloat(config?.keyGap ?? 3)
        let verticalGap = horizontalGap + 2  // Vertical padding is slightly larger (2px more than horizontal)

        // Add visual key view to button (with padding for visual gap)
        button.addSubview(visualKeyView)
        visualKeyView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            visualKeyView.topAnchor.constraint(equalTo: button.topAnchor, constant: verticalGap),
            visualKeyView.leadingAnchor.constraint(equalTo: button.leadingAnchor, constant: horizontalGap),
            visualKeyView.trailingAnchor.constraint(equalTo: button.trailingAnchor, constant: -horizontalGap),
            visualKeyView.bottomAnchor.constraint(equalTo: button.bottomAnchor, constant: -verticalGap)
        ])
        
        return button
    }
    
    // MARK: - Backspace Touch Handling (delegates to BackspaceHandler)
    
    /// Called when backspace button is touched down
    @objc private func backspaceTouchDown(_ sender: UIButton) {
        debugLog("⌫ Backspace touch DOWN")
        onBackspaceTouchBegan?()
        backspaceHandler.handleTouchDown()
    }
    
    /// Called when backspace button is released
    @objc private func backspaceTouchUp(_ sender: UIButton) {
        debugLog("⌫ Backspace touch UP")
        backspaceHandler.handleTouchUp()
        onBackspaceTouchEnded?()
    }
    
    /// Called when backspace button touch is cancelled
    @objc private func backspaceTouchCancelled(_ sender: UIButton) {
        debugLog("⌫ Backspace touch CANCELLED")
        backspaceHandler.handleTouchCancelled()
        onBackspaceTouchEnded?()
    }
    
    private func getDefaultLabel(
        for type: String,
        editorContext: (enterVisible: Bool, enterLabel: String, enterAction: Int, fieldType: String)?
    ) -> String {
        switch type.lowercased() {
        case "backspace":
            return "⌫"
        case "enter", "action":
            return editorContext?.enterLabel ?? "↵"
        case "shift":
            // Show different icon for locked vs normal shift
            return shiftState == .locked ? "⇪" : "⇧"
        case "settings":
            return "⚙"
        case "close":
            return "⬇"
        case "language":
            return "<->"
        case "next-keyboard":
            return "🌐"
        case "nikkud":
            // Language-specific nikkud caption with dotted circle as base
            // The dotted circle (U+25CC) is the standard base for displaying combining marks
            // Hebrew: hataf-kamatz (חתף-קמץ)
            // Arabic: shadda (شَدّة)
            switch currentKeyboardId {
            case "he":
                return " \u{05B3}"  // Dotted circle + Hataf-kamatz
            case "ar":
                return "◌\u{0651}"  // Dotted circle + Shadda
            default:
                return "◌"  
            }
        case "space":
            return "SPACE"
        default:
            return type.uppercased()
        }
    }
    
    @objc private func keyTapped(_ sender: UIButton) {
        guard let keyInfo = decodeKeyInfo(sender.accessibilityIdentifier),
              let key = parseKeyFromInfo(keyInfo) else {
            return
        }
        
        // Handle key clicks internally, like Android does
        handleKeyClick(key, keyView: sender)
    }
    
    /// Handle long-press on backspace key for continuous deletion
    @objc private func backspaceLongPressed(_ gesture: UILongPressGestureRecognizer) {
        switch gesture.state {
        case .began:
            debugLog("⌫ Backspace long-press BEGAN")
            onBackspaceTouchBegan?()
            backspaceHandler.handleTouchDown()
            
        case .ended, .cancelled, .failed:
            debugLog("⌫ Backspace long-press ENDED/CANCELLED")
            backspaceHandler.handleTouchUp()
            onBackspaceTouchEnded?()
            
        default:
            break
        }
    }
    
    /// Handle long-press on keyset/nikkud keys
    /// For nikkud: activates nikkud mode after 0.5 sec (when inactive)
    /// For keyset: emits selection event for edit mode
    @objc private func keyLongPressed(_ gesture: UILongPressGestureRecognizer) {
        // Only trigger on initial recognition, not continued updates
        guard gesture.state == .began else { return }
        
        guard let button = gesture.view as? UIButton,
              let keyInfo = decodeKeyInfo(button.accessibilityIdentifier),
              let key = parseKeyFromInfo(keyInfo) else {
            return
        }
        
        print("🔑 Key long-pressed: type='\(key.type)', value='\(key.value)'")
        
        // Handle nikkud key - only activate if currently inactive
        if key.type.lowercased() == "nikkud" {
            if !nikkudActive {
                print("   → Activating NIKKUD mode after 0.5 sec press")
                nikkudActive = true
                rerender()
            } else {
                print("   → NIKKUD already active, ignoring long-press")
            }
        } else {
            // For other keys (keyset), emit the long-press selection event for edit mode
            print("   → Emitting long-press selection event")
            onKeyLongPress?(key)
        }
    }
    
    /// Handle long-press on space key for cursor movement mode
    @objc private func spaceLongPressed(_ gesture: UILongPressGestureRecognizer) {
        switch gesture.state {
        case .began:
            print("🔄 Space long-press BEGAN - entering cursor move mode")
            cursorMoveMode = true
            cursorMoveStartPoint = gesture.location(in: gesture.view)
            cursorMoveAccumulatedDistance = 0
            
            // Lock text direction at the start of the session based on first non-whitespace character
            cursorMoveDirectionIsRTL = onGetTextDirection?() ?? isCurrentKeyboardRTL()
            print("🔄 Direction locked: isRTL=\(cursorMoveDirectionIsRTL)")
            
            // Clear suggestions while in cursor mode
            clearSuggestions()
            
            // Dim all keys to indicate cursor mode
            dimKeysForCursorMode(true)
            
        case .changed:
            guard cursorMoveMode else { return }
            
            let currentPoint = gesture.location(in: gesture.view)
            let deltaX = currentPoint.x - cursorMoveStartPoint.x
            
            // Add to accumulated distance
            cursorMoveAccumulatedDistance += deltaX
            
            // Check if we've moved enough to trigger a cursor movement (20px = 1 character)
            let charactersToMove = Int(cursorMoveAccumulatedDistance / cursorMoveSensitivity)
            
            if charactersToMove != 0 {
                // Use the locked direction from session start (not re-evaluated during movement)
                var offset = charactersToMove
                
                // Reverse direction for RTL text
                if cursorMoveDirectionIsRTL {
                    offset = -offset
                }
                
                print("🔄 Cursor move: deltaX=\(deltaX), accumulated=\(cursorMoveAccumulatedDistance), isRTL=\(cursorMoveDirectionIsRTL), moving \(offset) characters")
                
                // Move cursor via callback
                onCursorMove?(offset)
                
                // Reset accumulated distance by the amount we just moved
                cursorMoveAccumulatedDistance -= CGFloat(charactersToMove) * cursorMoveSensitivity
                
                // Update start point for next delta calculation
                cursorMoveStartPoint = currentPoint
            }
            
        case .ended, .cancelled, .failed:
            print("🔄 Space long-press ENDED - exiting cursor move mode")
            cursorMoveMode = false
            cursorMoveStartPoint = .zero
            cursorMoveAccumulatedDistance = 0
            
            // Restore normal key appearance
            dimKeysForCursorMode(false)
            
        default:
            break
        }
    }
    
    /// Dim or restore keys for cursor movement mode
    private func dimKeysForCursorMode(_ shouldDim: Bool) {
        guard let container = container else { return }
        
        let alpha: CGFloat = shouldDim ? 0.3 : 1.0
        
        // Find all key labels and image views and adjust their alpha
        container.subviews.forEach { subview in
            // Skip suggestions bar and nikkud picker
            if subview.tag == 999 || subview === suggestionsBar {
                return
            }
            
            // Recursively find labels and image views
            dimSubviews(of: subview, alpha: alpha)
        }
    }
    
    /// Recursively dim all labels and image views
    private func dimSubviews(of view: UIView, alpha: CGFloat) {
        for subview in view.subviews {
            if subview is UILabel || subview is UIImageView {
                UIView.animate(withDuration: 0.2) {
                    subview.alpha = alpha
                }
            }
            dimSubviews(of: subview, alpha: alpha)
        }
    }

    /// Handle long-press on next-keyboard (globe) button to show keyboard list
    @objc private func nextKeyboardLongPressed(_ gesture: UILongPressGestureRecognizer) {
        // Only trigger on initial recognition, not continued updates
        guard gesture.state == .began else { return }

        guard let button = gesture.view as? UIButton else {
            return
        }

        print("🌐 Globe button long-pressed - showing keyboard list")
        onShowKeyboardList?(button, gesture)
    }

    // MARK: - Key Press Popup Bubble

    /// Show popup bubble above the key when touched down
    @objc private func keyTouchDown(_ sender: UIButton) {
        guard let keyInfo = decodeKeyInfo(sender.accessibilityIdentifier),
              let key = parseKeyFromInfo(keyInfo) else {
            return
        }
        
        showKeyPopup(for: key, on: sender)
    }
    
    /// Hide popup bubble when touch ends
    @objc private func keyTouchUp(_ sender: UIButton) {
        hideKeyPopup(on: sender)
    }
    
    /// Hide popup bubble when touch is cancelled
    @objc private func keyTouchCancelled(_ sender: UIButton) {
        hideKeyPopup(on: sender)
    }
    
    /// Create and show a popup bubble above the key
    private func showKeyPopup(for key: ParsedKey, on button: UIButton) {
        // Don't show bubble in preview mode or on large screens (iPad)
        if isPreviewMode || isLargeScreen {
            return
        }
        
        // Remove any existing popup
        button.viewWithTag(9999)?.removeFromSuperview()
        
        // Don't show popup for special key types
        let skipTypes = ["shift", "backspace", "keyset", "next-keyboard", "settings", "close", "space", "enter", "action", "nikkud", "language"]
        if skipTypes.contains(key.type.lowercased()) {
            return
        }
        
        // Also skip if the key value is a space (in case it's not typed as "space")
        if key.value == " " {
            return
        }
        
        // Get the display text (same logic as the main key label)
        let displayText = shiftState.isActive() ? key.sCaption : key.caption
        var finalText: String
        if !key.label.isEmpty {
            finalText = key.label
        } else if !displayText.isEmpty {
            finalText = displayText
        } else if !key.value.isEmpty {
            finalText = key.value
        } else {
            return // Skip popup for keys without text
        }
        
        // Determine background and text colors based on button state
        var bgColor = key.backgroundColor
        if key.type.lowercased() == "shift" && shiftState.isActive() {
            bgColor = .systemGreen
        } else if key.type.lowercased() == "nikkud" && nikkudActive {
            bgColor = .systemYellow
        } else if bgColor == .white {
            // Use adaptive color for dark mode
            bgColor = UIColor { traitCollection in
                if traitCollection.userInterfaceStyle == .dark {
                    return UIColor(red: 0.35, green: 0.35, blue: 0.38, alpha: 1.0)
                } else {
                    return UIColor.white
                }
            }
        }
        
        // Adaptive text color
        let textColor: UIColor
        if key.textColor == .black {
            textColor = UIColor { traitCollection in
                if traitCollection.userInterfaceStyle == .dark {
                    return UIColor.white
                } else {
                    return UIColor.black
                }
            }
        } else {
            textColor = key.textColor
        }
        
        // Create popup bubble container (1.3x size instead of 2x)
        let popupSize = CGSize(width: button.bounds.width * 1.3, height: button.bounds.height * 1.3)
        let popup = UIView(frame: CGRect(x: 0, y: -popupSize.height, width: popupSize.width, height: popupSize.height))
        popup.tag = 9999
        popup.isUserInteractionEnabled = false
        popup.clipsToBounds = false  // Allow bubble to extend beyond bounds
        
        // Create the bubble shape using a custom path
        let bubblePath = createBubblePath(size: popupSize, keyWidth: button.bounds.width)
        let bubbleLayer = CAShapeLayer()
        bubbleLayer.path = bubblePath.cgPath
        bubbleLayer.fillColor = bgColor.cgColor
        bubbleLayer.shadowColor = UIColor.black.cgColor
        bubbleLayer.shadowOffset = CGSize(width: 0, height: 2)
        bubbleLayer.shadowOpacity = 0.3
        bubbleLayer.shadowRadius = 4
        popup.layer.addSublayer(bubbleLayer)
        
        // Add text label
        let label = UILabel()
        label.text = finalText
        label.font = UIFont.systemFont(ofSize: 36, weight: .regular)
        label.textAlignment = .center
        label.textColor = textColor
        label.isUserInteractionEnabled = false
        popup.addSubview(label)
        
        // Position label in the top half of the bubble
        label.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: popup.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: popup.topAnchor, constant: popupSize.height * 0.35),
            label.widthAnchor.constraint(equalToConstant: popupSize.width * 0.8)
        ])
        
        // Add popup to the keyboard container with high z-index to appear above everything
        if let container = self.container {
            container.addSubview(popup)
            
            // Bring popup to front so it appears above all keys and suggestions bar
            container.bringSubviewToFront(popup)
            
            // Position popup so the diagonal connections align with the VISUAL top of the button
            // Account for keyVerticalPadding (5px) + 1px extra
            let visualMarginOffset = keyVerticalPadding + 1
            
            // Convert button's frame to container's coordinate system
            if let buttonSuperview = button.superview {
                let buttonFrameInContainer = buttonSuperview.convert(button.frame, to: container)
                
                // For top row keys, position the bubble lower to stay within bounds
                // Check if the bubble would go above the container
                let idealY = buttonFrameInContainer.minY + visualMarginOffset - popupSize.height
                let finalY: CGFloat
                if idealY < 0 {
                    // Top row - position bubble to just fit within bounds
                    finalY = 0
                } else {
                    finalY = idealY
                }
                
                popup.frame = CGRect(
                    x: buttonFrameInContainer.midX - (popupSize.width / 2),
                    y: finalY,
                    width: popupSize.width,
                    height: popupSize.height
                )
                
                // Ensure popup doesn't go off screen horizontally
                if popup.frame.minX < 0 {
                    popup.frame.origin.x = 0
                }
                if popup.frame.maxX > container.bounds.maxX {
                    popup.frame.origin.x = container.bounds.maxX - popup.frame.width
                }
            }
        }
    }
    
    /// Hide the popup bubble
    private func hideKeyPopup(on button: UIButton) {
        // Remove popup from the container where we added it
        container?.viewWithTag(9999)?.removeFromSuperview()
    }
    
    /// Create a bubble path that connects to the button below
    private func createBubblePath(size: CGSize, keyWidth: CGFloat) -> UIBezierPath {
        let path = UIBezierPath()
        let cornerRadius: CGFloat = 8
        
        // Top portion of bubble (rectangle with rounded top)
        let bubbleHeight = size.height * 0.65
        let bubbleWidth = size.width
        
        // Calculate connection points - where the bubble connects to the key
        let connectionWidth = keyWidth * 0.9
        let keyLeftX = (size.width - connectionWidth) / 2
        let keyRightX = keyLeftX + connectionWidth
        
        // Start from bottom-left corner of bubble (where diagonal starts)
        path.move(to: CGPoint(x: 0, y: bubbleHeight))
        
        // Left diagonal: from bubble bottom-left (0, bubbleHeight) to key top-left (keyLeftX, size.height)
        // This creates a "\" shape
        path.addLine(to: CGPoint(x: keyLeftX, y: size.height))
        
        // Bottom edge (along the top of the key)
        path.addLine(to: CGPoint(x: keyRightX, y: size.height))
        
        // Right diagonal: from key top-right (keyRightX, size.height) to bubble bottom-right (bubbleWidth, bubbleHeight)
        // This creates a "/" shape
        path.addLine(to: CGPoint(x: bubbleWidth, y: bubbleHeight))
        
        // Right edge going up
        path.addLine(to: CGPoint(x: bubbleWidth, y: cornerRadius))
        
        // Top-right corner
        path.addArc(withCenter: CGPoint(x: bubbleWidth - cornerRadius, y: cornerRadius),
                    radius: cornerRadius,
                    startAngle: 0,
                    endAngle: -.pi / 2,
                    clockwise: false)
        
        // Top edge
        path.addLine(to: CGPoint(x: cornerRadius, y: 0))
        
        // Top-left corner
        path.addArc(withCenter: CGPoint(x: cornerRadius, y: cornerRadius),
                    radius: cornerRadius,
                    startAngle: -.pi / 2,
                    endAngle: .pi,
                    clockwise: false)
        
        // Left edge going down
        path.addLine(to: CGPoint(x: 0, y: bubbleHeight))
        
        path.close()
        
        return path
    }
    
    private func handleKeyClick(_ key: ParsedKey, keyView: UIButton) {
        print("🔑 Key clicked: type='\(key.type)', value='\(key.value)'")
        
        switch key.type.lowercased() {
        case "backspace":
            print("   → Backspace tap")
            // In selection mode, emit for selection
            // In normal mode, call delete callback
            if onKeyLongPress != nil {
                print("   → Selection mode: emitting key press")
                onKeyPress?(key)
            } else {
                print("   → Normal mode: calling delete callback")
                onDeleteCharacter?()
            }
            return
        
        case "shift":
            // Handle shift with double-click for lock
            print("   → Handling SHIFT")
            handleShiftTap()
            
        case "nikkud":
            // Nikkud toggle behavior:
            // - When inactive: requires 0.5 sec long-press to activate (prevent accidental activation)
            // - When active: normal tap to deactivate
            if nikkudActive {
                print("   → Handling NIKKUD tap (deactivating)")
                nikkudActive = false
                rerender()
            } else {
                print("   → Ignoring quick tap on NIKKUD (requires 0.5 sec press to activate)")
                return
            }
            
        case "keyset":
            // Switch keyset and re-render internally
            // Supports return state: first press goes to keysetValue, second press returns to returnKeysetValue
            print("   → Handling KEYSET: keysetValue='\(key.keysetValue)', returnKeysetValue='\(key.returnKeysetValue)', returnKeysetLabel='\(key.returnKeysetLabel)'")
            
            if !key.keysetValue.isEmpty {
                // Check if we're in "return mode" for this keyset
                if let returnState = keysetButtonReturnState[currentKeysetId],
                   key.returnKeysetValue == returnState.returnValue {
                    // We're in return mode - pressing should return to the original keyset
                    print("   → Return mode detected! Returning to '\(returnState.returnValue)'")
                    keysetButtonReturnState.removeValue(forKey: currentKeysetId)
                    switchKeyset(returnState.returnValue)
                } else {
                    // Normal mode - switch to the target keyset and store return state
                    if !key.returnKeysetValue.isEmpty && !key.returnKeysetLabel.isEmpty {
                        // Store the return state for when we're on the target keyset
                        keysetButtonReturnState[key.keysetValue] = (returnValue: key.returnKeysetValue, returnLabel: key.returnKeysetLabel)
                        print("   → Storing return state for '\(key.keysetValue)': return to '\(key.returnKeysetValue)'")
                    }
                    switchKeyset(key.keysetValue)
                }
            }
                        
        case "next-keyboard":
            // For actual keyboard: call system callback
            // For preview: switch language internally AND notify React
            print("   → Handling NEXT-KEYBOARD")
            if let onNextKeyboard = onNextKeyboard {
                print("   → Calling onNextKeyboard (actual keyboard)")
                onNextKeyboard()
            } else {
                print("   → Preview mode: switching language and emitting event")
                switchLanguage()
                // Emit key press so React can sync its state
                print("   → Emitting onKeyPress for next-keyboard to React")
                onKeyPress?(key)
            }
            
        case "close":
            print("   → Handling CLOSE")
            // In selection mode, emit key press for selection
            // In normal mode, call the dismiss callback
            if onKeyLongPress != nil {
                print("   → Selection mode: emitting key press")
                onKeyPress?(key)
            } else {
                onDismissKeyboard?()
            }
            
        case "settings":
            print("   → Handling SETTINGS")
            // In selection mode, emit key press for selection
            // In normal mode, call the settings callback
            if onKeyLongPress != nil {
                print("   → Selection mode: emitting key press")
                onKeyPress?(key)
            } else {
                onOpenSettings?()
            }

        case "language":
            print("   → Handling LANGUAGE SWITCH")
            // In selection mode, emit key press for selection
            // In normal mode, call the language switch callback
            if onKeyLongPress != nil {
                print("   → Selection mode: emitting key press")
                onKeyPress?(key)
            } else {
                onLanguageSwitch?()
            }

        case "event":
            print("   → Handling EVENT key: \(key.value)")
            // Event-only keys - just emit the key press to container
            // Container (React Native) will handle the action
            onKeyPress?(key)

        default:
            // For regular keys, check if nikkud popup should be shown
            print("   → Handling DEFAULT key")
            
            // Check if this is a space key (value == " ")
            // Space keys should NOT reset shift here - they're handled by controller's handleSpaceKey
            let isSpace = key.value == " "
            
            // First, check if diacritics apply to this character
            let shouldShowDiacritics = shouldShowDiacriticsPopup(for: key)
            
            if nikkudActive && shouldShowDiacritics {
                // Get diacritics using the generator (falls back to explicit nikkud if present)
                let diacriticsOptions = getDiacriticsForKey(key)
                if !diacriticsOptions.isEmpty {
                    showNikkudPicker(diacriticsOptions, anchorView: keyView)
                } else {
                    // No options available, just output the key
                    onKeyPress?(key)
                    if case .active = shiftState, !isSpace {
                        shiftState = .inactive
                        rerender()
                    }
                }
            } else {
                // Output FINAL key press to container
                onKeyPress?(key)
                
                // For shift-active (but not locked) regular keys, reset shift after key press
                // BUT: Don't reset for space key - it's handled by controller's handleSpaceKey which calls autoShiftAfterPunctuation
                // Locked shift stays active until explicitly toggled off
                if case .active = shiftState, !isSpace {
                    shiftState = .inactive
                    rerender()
                }
                // .locked stays as is - doesn't reset after key press
            }
        }
    }
    
    /// Internal re-render - renderer manages its own UI updates
    private func rerender() {
        guard let container = container, let config = config else { return }
        renderKeyboard(in: container, config: config, currentKeysetId: currentKeysetId, editorContext: editorContext)
    }
    
    /// Refresh the nikkud picker if it's currently open (used when diacritics settings change)
    /// This updates the config and re-renders the picker with the same letter but new options
    func refreshNikkudPickerIfOpen(in container: UIView, config: KeyboardConfig) {
        // Update config reference
        self.config = config
        self.container = container
        
        // Check if we have a current letter being edited
        guard !currentNikkudLetter.isEmpty else {
            print("📱 refreshNikkudPickerIfOpen: No current letter, just re-rendering keyboard")
            rerender()
            return
        }
        
        print("📱 refreshNikkudPickerIfOpen: Refreshing picker for letter '\(currentNikkudLetter)'")
        
        // Re-show the picker with updated options (this will replace the existing one)
        showNikkudPickerInternal(forLetter: currentNikkudLetter, anchorView: container)
    }
    
    private func encodeKeyInfo(_ key: ParsedKey) -> String {
        var dict: [String: Any] = [
            "type": key.type,
            "value": key.value,
            "sValue": key.sValue,
            "keysetValue": key.keysetValue,
            "returnKeysetValue": key.returnKeysetValue,
            "returnKeysetLabel": key.returnKeysetLabel,
            "label": key.label,
            "hasNikkud": !key.nikkud.isEmpty
        ]
        
        if !key.nikkud.isEmpty {
            let nikkudArray = key.nikkud.map { option -> [String: String] in
                return [
                    "value": option.value,
                    "caption": option.caption ?? option.value
                ]
            }
            dict["nikkud"] = nikkudArray
        }
        
        if let jsonData = try? JSONSerialization.data(withJSONObject: dict),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            return jsonString
        }
        return "{}"
    }
    
    private func decodeKeyInfo(_ identifier: String?) -> [String: Any]? {
        guard let identifier = identifier,
              let data = identifier.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        return dict
    }
    
    private func parseKeyFromInfo(_ info: [String: Any]) -> ParsedKey? {
        let type = info["type"] as? String ?? ""
        let value = info["value"] as? String ?? ""
        let sValue = info["sValue"] as? String ?? ""
        let keysetValue = info["keysetValue"] as? String ?? ""
        let returnKeysetValue = info["returnKeysetValue"] as? String ?? ""
        let returnKeysetLabel = info["returnKeysetLabel"] as? String ?? ""
        let label = info["label"] as? String ?? ""
        
        var nikkudOptions: [NikkudOption] = []
        if let nikkudArray = info["nikkud"] as? [[String: String]] {
            for dict in nikkudArray {
                if let value = dict["value"] {
                    nikkudOptions.append(NikkudOption(
                        value: value,
                        caption: dict["caption"],
                        sValue: nil,
                        sCaption: nil
                    ))
                }
            }
        }
        
        // Create a Key object and use the existing ParsedKey initializer
        let key = Key(
            value: value,
            sValue: sValue,
            caption: value,
            sCaption: sValue,
            type: type,
            width: 1.0,
            offset: 0.0,
            hidden: false,
            opacity: nil,
            color: nil,
            bgColor: nil,
            fontSize: nil,
            label: label,
            keysetValue: keysetValue,
            returnKeysetValue: returnKeysetValue,
            returnKeysetLabel: returnKeysetLabel,
            nikkud: nikkudOptions.isEmpty ? nil : nikkudOptions,
            showOn: nil,
            flex: nil,
            showForField: nil
        )
        
        return ParsedKey(from: key, groups: [:], defaultTextColor: .black, defaultBgColor: .white)
    }
    
    private func showError(in container: UIView, message: String) {
        let label = UILabel()
        label.text = message
        label.textAlignment = .center
        label.textColor = .red
        container.addSubview(label)
        
        label.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: container.centerYAnchor)
        ])
    }
    
    // MARK: - Nikkud Picker (delegates to NikkudPickerController)
    
    /// Check if diacritics popup should be shown for this key (delegates to NikkudPickerController)
    private func shouldShowDiacriticsPopup(for key: ParsedKey) -> Bool {
        // Configure the picker with current state
        nikkudPickerController.configure(config: config, keyboardId: currentKeyboardId, container: container)
        return nikkudPickerController.shouldShowDiacriticsPopup(for: key)
    }
    
    /// Get diacritics for a key (delegates to NikkudPickerController)
    private func getDiacriticsForKey(_ key: ParsedKey) -> [NikkudOption] {
        nikkudPickerController.configure(config: config, keyboardId: currentKeyboardId, container: container)
        return nikkudPickerController.getDiacriticsForKey(key)
    }
    
    /// Show nikkud picker for a key (delegates to NikkudPickerController)
    private func showNikkudPicker(_ nikkudOptions: [NikkudOption], anchorView: UIView) {
        // Create a temporary ParsedKey from the first option to pass to the picker
        if let firstOption = nikkudOptions.first, let firstChar = firstOption.value.first {
            let tempKey = Key(
                value: String(firstChar),
                sValue: nil,
                caption: nil,
                sCaption: nil,
                type: "character",
                width: nil,
                offset: nil,
                hidden: nil,
                opacity: nil,
                color: nil,
                bgColor: nil,
                fontSize: nil,
                label: nil,
                keysetValue: nil,
                returnKeysetValue: nil,
                returnKeysetLabel: nil,
                nikkud: nikkudOptions,
                showOn: nil,
                flex: nil,
                showForField: nil
            )
            let parsedKey = ParsedKey(from: tempKey, groups: [:], defaultTextColor: .black, defaultBgColor: .white)
            
            nikkudPickerController.configure(config: config, keyboardId: currentKeyboardId, container: container)
            nikkudPickerController.showPicker(for: parsedKey, anchorView: anchorView)
        }
    }
    
    /// Property to access current nikkud letter (for external refresh)
    private var currentNikkudLetter: String {
        return nikkudPickerController.currentNikkudLetter
    }
    
    /// Internal method for showing nikkud picker - delegates to controller
    private func showNikkudPickerInternal(forLetter letter: String, anchorView: UIView) {
        nikkudPickerController.configure(config: config, keyboardId: currentKeyboardId, container: container)
        nikkudPickerController.refreshIfOpen(anchorView: anchorView)
    }
    
    // MARK: - Shift Handling
    
    private func handleShiftTap() {
        let currentTime = Date().timeIntervalSince1970
        
        if currentTime - lastShiftClickTime < doubleClickThreshold {
            // Double-click: toggle between locked and inactive
            print("   → Shift double-click detected")
            if shiftState == .locked {
                shiftState = .inactive
            } else {
                shiftState = .locked
            }
        } else {
            // Single click: toggle between inactive and active
            shiftState = shiftState.toggle()
        }
        
        lastShiftClickTime = currentTime
        print("   → New shift state: \(shiftState)")
        rerender()
    }
    
    /// Check if shift is currently active (either active or locked)
    func isShiftActive() -> Bool {
        return shiftState.isActive()
    }
    
    /// Activate shift (set to active state, not locked)
    /// This is called from the controller when auto-shift should activate
    func activateShift() {
        print("🎯 KeyboardRenderer.activateShift() called, current state: \(shiftState)")
        if shiftState == .inactive {
            shiftState = .active
            print("🎯 Shift state set to .active")
        } else {
            print("🎯 Shift already active/locked, not changing")
        }
    }
    
    /// Deactivate shift (set to inactive state)
    /// This is called from the controller when auto-shift should deactivate
    func deactivateShift() {
        print("🎯 KeyboardRenderer.deactivateShift() called, current state: \(shiftState)")
        if shiftState == .active {
            shiftState = .inactive
            print("🎯 Shift state set to .inactive")
        } else {
            print("🎯 Shift not in active state (is \(shiftState)), not changing")
        }
    }
    
    // MARK: - Suggestions Bar
    
    /// Check if the current keyboard is RTL (Hebrew or Arabic)
    private func isCurrentKeyboardRTL() -> Bool {
        guard let keyboardId = currentKeyboardId else { return false }
        return keyboardId == "he" || keyboardId == "ar"
    }
    
    /// Detect the actual text direction at the cursor position
    /// Returns true if RTL (Hebrew/Arabic), false if LTR (English/numbers)
    /// This is smarter than just checking keyboard language - it analyzes the actual text
    private func getTextDirectionAtCursor() -> Bool {
        // This will be called from BaseKeyboardViewController, so we need a callback
        // For now, return keyboard language as fallback
        return isCurrentKeyboardRTL()
    }
    
    /// Update the suggestions bar with current suggestions (delegates to SuggestionsBarView)
    private func updateSuggestionsBar() {
        suggestionsBarView.currentKeyboardId = currentKeyboardId
        suggestionsBarView.updateSuggestions(currentSuggestions, highlightIndex: suggestionHighlightIndex)
    }
    
    // MARK: - Keyset Switching
    
    /// Switch to a different keyset (abc, 123, #+=) while staying on the same keyboard/language
    /// Keyset IDs are plain (e.g., "abc", "123", "#+=") without language prefixes
    private func switchKeyset(_ keysetValue: String) {
        guard !keysetValue.isEmpty, let config = config else { return }
        
        // Check if the target keyset exists in the config
        let allKeysetIds = config.keysets.map { $0.id }
        print("switchKeyset: switching to '\(keysetValue)', available: \(allKeysetIds)")
        
        if allKeysetIds.contains(keysetValue) {
            print("switchKeyset: switching from '\(currentKeysetId)' to '\(keysetValue)'")
            currentKeysetId = keysetValue
            shiftState = .inactive
            nikkudActive = false
            rerender()
        } else {
            print("⚠️ Keyset not found: '\(keysetValue)'. Available: \(allKeysetIds)")
        }
    }
    
    // MARK: - Language Switching
    
    func switchLanguage() {
        print("🌐 Language button tapped - cycling to next language")
        
        guard let config = config else {
            print("❌ No config available")
            return
        }
        
        // Get all keyset IDs
        let allKeysetIds = config.keysets.map { $0.id }
        print("   All keysets: \(allKeysetIds.joined(separator: ", "))")
        print("   Current keyset: \(currentKeysetId)")
        
        // Determine current keyset type (abc, 123, or #+=)
        let currentKeysetType: String
        if currentKeysetId.hasSuffix("_abc") {
            currentKeysetType = "abc"
        } else if currentKeysetId.hasSuffix("_123") {
            currentKeysetType = "123"
        } else if currentKeysetId.hasSuffix("_#+=") {
            currentKeysetType = "#+="
        } else if currentKeysetId == "abc" {
            currentKeysetType = "abc"
        } else if currentKeysetId == "123" {
            currentKeysetType = "123"
        } else if currentKeysetId == "#+=" {
            currentKeysetType = "#+="
        } else {
            currentKeysetType = "abc"
        }
        
        print("   Current keyset type: \(currentKeysetType)")
        
        // Find all keysets of the same type across different keyboards
        let sameTypeKeysets = allKeysetIds.filter { keysetId in
            keysetId == currentKeysetType || keysetId.hasSuffix("_\(currentKeysetType)")
        }
        
        print("   Same type keysets (\(currentKeysetType)): \(sameTypeKeysets.joined(separator: ", "))")
        
        if sameTypeKeysets.count > 1 {
            // Find current position
            if let currentIndex = sameTypeKeysets.firstIndex(of: currentKeysetId) {
                // Cycle to next
                let nextIndex = (currentIndex + 1) % sameTypeKeysets.count
                let nextKeysetId = sameTypeKeysets[nextIndex]
                
                print("   Switching from \(currentKeysetId) to \(nextKeysetId)")
                currentKeysetId = nextKeysetId
                shiftState = .inactive  // Reset shift (including locked) on language change
                
                // Notify controller so it can save to preferences
                onKeysetChanged?(currentKeysetId)
                
                // Re-render internally
                rerender()
            } else {
                print("⚠️ Current keyset not found in same-type list")
            }
        } else {
            print("   Only one keyboard available for type \(currentKeysetType)")
        }
    }
}