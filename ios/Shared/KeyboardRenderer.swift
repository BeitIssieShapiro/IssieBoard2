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
    
    // Whether to show the globe (next-keyboard) button
    // This is controlled by needsInputModeSwitchKey from the keyboard extension
    private var showGlobeButton: Bool = true
    
    // Callbacks for system keyboard actions (only used by actual keyboard)
    var onNextKeyboard: (() -> Void)?
    var onDismissKeyboard: (() -> Void)?
    var onOpenSettings: (() -> Void)?
    
    // Callbacks for backspace touch state (to coordinate with controller)
    var onBackspaceTouchBegan: (() -> Void)?
    var onBackspaceTouchEnded: (() -> Void)?
    
    // Callbacks for backspace long-press actions
    var onDeleteCharacter: (() -> Void)?     // Delete single character
    var onDeleteWord: (() -> Void)?          // Delete entire word
    
    // Callback for long-press selection (for nikkud/keyset keys in edit mode)
    var onKeyLongPress: ((ParsedKey) -> Void)?
    
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
    private var config: KeyboardConfig?
    var currentKeysetId: String = "abc"  // Public so container can read it (but shouldn't write)
    private var editorContext: (enterVisible: Bool, enterLabel: String, enterAction: Int)?
    
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
    
    // Screen size detection for showOn filtering
    private var isLargeScreen: Bool {
        // iPad or large screen detection
        return UIDevice.current.userInterfaceIdiom == .pad
    }
    
    // UI Constants - same for preview and keyboard
    private let rowHeight: CGFloat = 54  // Increased from 44 for taller keys
    private let keySpacing: CGFloat = 0       // No spacing between key tap areas
    private let keyInternalPadding: CGFloat = 3  // Visual gap between keys (internal margin)
    private let rowSpacing: CGFloat = 0       // No spacing between row tap areas (visual gap from keyInternalPadding)
    private let keyCornerRadius: CGFloat = 5
    private let fontSize: CGFloat = 24
    private let largeFontSize: CGFloat = 28
    private let suggestionsBarHeight: CGFloat = 40
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
                color: nil,
                bgColor: nil,
                label: nil,
                keysetValue: nil,
                returnKeysetValue: nil,
                returnKeysetLabel: nil,
                nikkud: nil,
                showOn: nil,
                flex: nil
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
    
    // MARK: - Public Methods
    
    /// Calculate the required keyboard height based on the current config
    /// This returns the dynamic height needed to display the keyboard with all its rows
    /// - Parameters:
    ///   - config: The keyboard configuration
    ///   - keysetId: The keyset ID to calculate height for
    /// - Returns: The required height in points
    func calculateKeyboardHeight(for config: KeyboardConfig, keysetId: String) -> CGFloat {
        // Find the keyset
        guard let keyset = config.keysets.first(where: { $0.id == keysetId }) else {
            return 216  // Default iOS keyboard height
        }
        
        let numberOfRows = keyset.rows.count
        let rowsHeight = CGFloat(numberOfRows) * rowHeight
        let spacingHeight = CGFloat(max(0, numberOfRows - 1)) * rowSpacing
        let suggestionsHeight = config.isWordSuggestionsEnabled ? suggestionsBarHeight + 4 : 0
        let topPadding: CGFloat = 4
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
    }
    
    /// Clear all suggestions
    func clearSuggestions() {
        currentSuggestions = []
        updateSuggestionsBar()
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
        editorContext: (enterVisible: Bool, enterLabel: String, enterAction: Int)?
    ) {
        let currentWidth = container.bounds.width
        print("📐 RENDER START =================")
        print("📐 RENDER: container.bounds.width = \(currentWidth), lastRenderedWidth = \(lastRenderedWidth)")
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
        
        // Calculate top offset based on whether suggestions bar is shown
        var topOffset: CGFloat = 4
        
        // Create suggestions bar at the top only if enabled
        if wordSuggestionsEnabled {
            // Use the modular SuggestionsBarView helper
            suggestionsBarView.currentKeyboardId = currentKeyboardId
            let bar = suggestionsBarView.createBar(width: container.bounds.width)
            container.addSubview(bar)
            suggestionsBar = bar
            
            // Update suggestions bar with current suggestions
            suggestionsBarView.updateSuggestions(currentSuggestions, highlightIndex: suggestionHighlightIndex)
            
            topOffset = suggestionsBarHeight + 4
        } else {
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
        
        for row in rows {
            var rowWidth: CGFloat = 0
            for key in row.keys {
                let parsedKey = ParsedKey(from: key, groups: groups,
                                         defaultTextColor: .black,
                                         defaultBgColor: .white)
                
                let keyType = parsedKey.type.lowercased()
                
                // Skip language/next-keyboard keys if only one language
                if hasOnlyOneLanguage && keyType == "language" || !showGlobeButton && keyType == "next-keyboard" {
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
            let essentialTypes: Set<String> = ["space", "backspace", "enter"]
            
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
        editorContext: (enterVisible: Bool, enterLabel: String, enterAction: Int)?,
        keysetId: String,
        rowIndex: Int
    ) -> UIView {
        // Simple row container - buttons handle their own touches
        let rowContainer = UIView()
        var currentX: CGFloat = 0
        var keyIndex = 0
        
        // Check if we have only one language (keyboard)
        let hasOnlyOneLanguage = (config?.keyboards?.count ?? 0) <= 1
        
        // Check if nikkud is disabled for the current keyboard
        let isNikkudDisabled = config?.diacriticsSettings?[currentKeyboardId ?? ""]?.isDisabled ?? false
        
        // FIRST PASS: Calculate hidden width due to showOn filter and count flex keys
        var hiddenWidthFromShowOn: Double = 0
        var flexKeyCount = 0
        
        for key in row.keys {
            let parsedKey = ParsedKey(from: key, groups: groups,
                                     defaultTextColor: .black,
                                     defaultBgColor: .white)
            
            let keyType = parsedKey.type.lowercased()
            
            // Skip language/next-keyboard keys
            if keyType == "language" && hasOnlyOneLanguage || keyType == "next-keyboard" && !showGlobeButton {
                continue
            }
            
            // Skip nikkud key if disabled
            if keyType == "nikkud" && isNikkudDisabled {
                continue
            }
            
            // Check if key is hidden due to showOn filter
            if !key.shouldShow(isLargeScreen: isLargeScreen) {
                // Accumulate the width of hidden keys
                hiddenWidthFromShowOn += parsedKey.width
                continue
            }
            
            // Count flex keys
            if key.flex == true {
                flexKeyCount += 1
            }
        }
        
        // Calculate extra width per flex key
        let extraWidthPerFlexKey: Double = flexKeyCount > 0 ? hiddenWidthFromShowOn / Double(flexKeyCount) : 0
        
        // SECOND PASS: Render keys with redistributed width
        for key in row.keys {
            let parsedKey = ParsedKey(from: key, groups: groups,
                                     defaultTextColor: .black,
                                     defaultBgColor: .white)
            
            // Skip language/next-keyboard keys based on:
            // 1. Only one language configured, OR
            // 2. System is showing globe button (needsInputModeSwitchKey is false)
            let keyType = parsedKey.type.lowercased()
            if (keyType == "language" && hasOnlyOneLanguage || keyType == "next-keyboard" && !showGlobeButton) {
                // Skip if only one language OR if system doesn't need us to show the globe
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
            
            if isKeyHidden {
                let hiddenWidth = (CGFloat(parsedKey.width) / baselineWidth) * availableWidth
                currentX += hiddenWidth
            } else {
                // Calculate key width, adding extra width if this is a flex key
                var effectiveWidth = parsedKey.width
                if key.flex == true {
                    effectiveWidth += extraWidthPerFlexKey
                }
                
                let keyWidth = (CGFloat(effectiveWidth) / baselineWidth) * availableWidth - keySpacing
                let button = createKeyButton(parsedKey, width: keyWidth, height: rowHeight, 
                                            editorContext: editorContext,
                                            isSelected: isSelected)
                rowContainer.addSubview(button)
                
                button.frame = CGRect(x: currentX, y: 0, width: keyWidth, height: rowHeight)
                currentX += keyWidth + keySpacing
            }
            
            keyIndex += 1
        }
        
        return rowContainer
    }
    
    private func createKeyButton(
        _ key: ParsedKey,
        width: CGFloat,
        height: CGFloat,
        editorContext: (enterVisible: Bool, enterLabel: String, enterAction: Int)?,
        isSelected: Bool = false
    ) -> UIView {
        // Create the main button that fills the ENTIRE tap area (no gaps)
        let button = UIButton(type: .system)
        // UIButton needs some visible content to have a hit area
        // Using a nearly invisible background to ensure it's tappable
        button.backgroundColor = UIColor(white: 1.0, alpha: 0.001)
        
        // For backspace key, use gesture recognizer for reliable long-press detection
        if key.type.lowercased() == "backspace" {
            // Tap for single delete
            button.addTarget(self, action: #selector(keyTapped(_:)), for: .touchUpInside)
            
            // Gesture recognizer for long-press repeat
            let longPressGesture = UILongPressGestureRecognizer(target: self, action: #selector(backspaceLongPressed(_:)))
            longPressGesture.minimumPressDuration = 0.5
            button.addGestureRecognizer(longPressGesture)
        } else {
            button.addTarget(self, action: #selector(keyTapped(_:)), for: .touchUpInside)
            
            // Add long-press gesture for keyset and nikkud keys (for selection in edit mode)
            let keyType = key.type.lowercased()
            if keyType == "keyset" || keyType == "nikkud" {
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

        // For settings key, use SF Symbol image
        if key.type.lowercased() == "settings" {
            if let gearImage = UIImage(systemName: "gearshape.fill") {
                let imageView = UIImageView(image: gearImage)
                imageView.contentMode = .scaleAspectFit
                imageView.tintColor = .label
                imageView.isUserInteractionEnabled = false
                visualKeyView.addSubview(imageView)
                imageView.translatesAutoresizingMaskIntoConstraints = false
                NSLayoutConstraint.activate([
                    imageView.centerXAnchor.constraint(equalTo: visualKeyView.centerXAnchor),
                    imageView.centerYAnchor.constraint(equalTo: visualKeyView.centerYAnchor),
                    imageView.widthAnchor.constraint(equalToConstant: 24),
                    imageView.heightAnchor.constraint(equalToConstant: 24)
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
                imageView.tintColor = .label
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
        
        // Font size - special handling for nikkud key when showing just the diacritic mark
        let isLargeKey = ["shift", "backspace", "enter"].contains(key.type.lowercased())
        let isMultiChar = finalText.count > 1
        let baseFontSize: CGFloat = isLargeKey ? largeFontSize : fontSize
        var finalFontSize = isMultiChar ? min(baseFontSize * 0.7, 14) : baseFontSize
        
        // Make nikkud diacritic mark larger and use bold weight for visibility
        if isNikkudKey {
            finalFontSize = 36  // Extra large for the diacritic mark to be readable
        }
        
        let fontWeight: UIFont.Weight = .regular
        label.font = UIFont.systemFont(ofSize: finalFontSize, weight: fontWeight)
        label.adjustsFontSizeToFitWidth = isNikkudKey ? false : true
        label.minimumScaleFactor = 0.3
        label.numberOfLines = 1
        label.textAlignment = .center
        
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
        
        // Add visual key view to button (with padding for visual gap)
        button.addSubview(visualKeyView)
        visualKeyView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            visualKeyView.topAnchor.constraint(equalTo: button.topAnchor, constant: keyInternalPadding),
            visualKeyView.leadingAnchor.constraint(equalTo: button.leadingAnchor, constant: keyInternalPadding),
            visualKeyView.trailingAnchor.constraint(equalTo: button.trailingAnchor, constant: -keyInternalPadding),
            visualKeyView.bottomAnchor.constraint(equalTo: button.bottomAnchor, constant: -keyInternalPadding)
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
        editorContext: (enterVisible: Bool, enterLabel: String, enterAction: Int)?
    ) -> String {
        switch type.lowercased() {
        case "backspace":
            return "⌫"
        case "enter", "action":
            return editorContext?.enterLabel ?? "↵"
        case "shift":
            return "⇧"
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
    
    /// Handle long-press on keyset/nikkud keys for selection in edit mode
    @objc private func keyLongPressed(_ gesture: UILongPressGestureRecognizer) {
        // Only trigger on initial recognition, not continued updates
        guard gesture.state == .began else { return }
        
        guard let button = gesture.view as? UIButton,
              let keyInfo = decodeKeyInfo(button.accessibilityIdentifier),
              let key = parseKeyFromInfo(keyInfo) else {
            return
        }
        
        print("🔑 Key long-pressed for selection: type='\(key.type)', value='\(key.value)'")
        
        // Emit the long-press selection event
        onKeyLongPress?(key)
    }
    
    private func handleKeyClick(_ key: ParsedKey, keyView: UIButton) {
        print("🔑 Key clicked: type='\(key.type)', value='\(key.value)'")
        
        switch key.type.lowercased() {
        case "backspace":
            // Backspace single tap - emit the key press but don't reset shift
            print("   → Backspace tap")
            onKeyPress?(key)
            return
        
        case "shift":
            // Handle shift with double-click for lock
            print("   → Handling SHIFT")
            handleShiftTap()
            
        case "nikkud":
            // Toggle nikkud and re-render internally
            print("   → Handling NIKKUD")
            nikkudActive = !nikkudActive
            rerender()
            
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
            onDismissKeyboard?()
            
        case "settings":
            print("   → Handling SETTINGS")
            onOpenSettings?()
            
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
            color: nil,
            bgColor: nil,
            label: label,
            keysetValue: keysetValue,
            returnKeysetValue: returnKeysetValue,
            returnKeysetLabel: returnKeysetLabel,
            nikkud: nikkudOptions.isEmpty ? nil : nikkudOptions,
            showOn: nil,
            flex: nil
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
                color: nil,
                bgColor: nil,
                label: nil,
                keysetValue: nil,
                returnKeysetValue: nil,
                returnKeysetLabel: nil,
                nikkud: nikkudOptions,
                showOn: nil,
                flex: nil
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
