import UIKit


/**
 * Custom overlay view that intercepts all touches
 */
class TouchInterceptingOverlay: UIView {
    var onTapOutside: (() -> Void)?
    
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        let result = super.hitTest(point, with: event)
        // If the hit is on the overlay itself (not a subview), return self to capture the touch
        if result == self {
            return self
        }
        return result
    }
    
    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        // Check if touch is outside the picker (on the dimmed area)
        if let touch = touches.first {
            let location = touch.location(in: self)
            
            // Check if touch is on the overlay background (not on picker)
            var hitPicker = false
            for subview in subviews {
                if subview.frame.contains(location) {
                    hitPicker = true
                    break
                }
            }
            
            if !hitPicker {
                print("🎯 Touch outside picker, dismissing")
                onTapOutside?()
            }
        }
    }
}

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
    
    // Callbacks for backspace long-press actions
    var onDeleteCharacter: (() -> Void)?     // Delete single character
    var onDeleteWord: (() -> Void)?          // Delete entire word
    
    // Word suggestions to display
    private var currentSuggestions: [String] = []
    
    // Whether word suggestions are enabled (from config)
    private var wordSuggestionsEnabled: Bool = true
    
    // Internal state - managed entirely by renderer
    private var shiftState: ShiftState = .inactive
    private var nikkudActive: Bool = false
    private var config: KeyboardConfig?
    var currentKeysetId: String = "abc"  // Public so container can read it (but shouldn't write)
    private var editorContext: (enterVisible: Bool, enterLabel: String, enterAction: Int)?
    
    // Diacritics settings (from profile, keyed by keyboard ID)
    private var diacriticsSettings: [String: DiacriticsSettings] = [:]
    
    // Current keyboard ID for diacritics lookup
    private var currentKeyboardId: String?
    
    // Modifier toggle states for nikkud picker
    // Key: modifier ID, Value: selected option ID (nil = off, empty string = on for simple toggle, option ID for multi-option)
    private var modifierStates: [String: String?] = [:]
    
    // Current letter being edited in nikkud picker (for modifier toggle refresh)
    private var currentNikkudLetter: String = ""
    
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
    
    // MARK: - Long Press Backspace
    
    // Backspace long-press state
    private var backspaceTimer: Timer?
    private var backspacePressStartTime: Date?
    private var backspaceDeleteCount: Int = 0
    private var lastBackspaceDeleteTime: Date?
    
    // Long-press timing constants
    private let charDeleteStartDelay: TimeInterval = 0.5    // Start deleting after 0.5 seconds (was 2.0)
    private let wordDeleteStartDelay: TimeInterval = 3.0    // Switch to word delete after 3 seconds (was 6.0)
    private let initialDeleteInterval: TimeInterval = 0.2   // Initial delete interval (200ms)
    private let minDeleteInterval: TimeInterval = 0.05      // Minimum delete interval (50ms)
    private let deleteSpeedupFactor: Double = 0.9           // Speed up factor per delete
    
    // Current delete interval (decreases as user holds longer)
    private var currentDeleteInterval: TimeInterval = 0.2
    
    // MARK: - Initialization
    
    init() {
        print("🎨 KeyboardRenderer created")
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
    /// - Parameter suggestions: Array of suggested words (max 4)
    func updateSuggestions(_ suggestions: [String]) {
        print("📝 KeyboardRenderer updateSuggestions: \(suggestions)")
        currentSuggestions = suggestions
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
        if let keyboards = config.keyboards, !keyboards.isEmpty {
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
            print("📱 Current keyboard ID set to: \(self.currentKeyboardId ?? "nil")")
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
        
        // Build groups map
        let groups = buildGroupsMap(config.groups ?? [])
        
        // Calculate baseline width
        let baselineWidth = calculateBaselineWidth(keyset.rows, groups: groups)
        
        // Update word suggestions enabled state from config
        wordSuggestionsEnabled = config.isWordSuggestionsEnabled
        print("📝 Word suggestions enabled: \(wordSuggestionsEnabled)")
        
        // Calculate top offset based on whether suggestions bar is shown
        var topOffset: CGFloat = 4
        
        // Create suggestions bar at the top only if enabled
        if wordSuggestionsEnabled {
            let bar = createSuggestionsBar(width: container.bounds.width)
            container.addSubview(bar)
            suggestionsBar = bar
            
            // Update suggestions bar with current suggestions
            updateSuggestionsBar()
            
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
        
        for (rowIndex, row) in keyset.rows.enumerated() {
            let rowView = createRow(row, groups: groups, baselineWidth: baselineWidth, 
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
    
    private func buildGroupsMap(_ groups: [Group]) -> [String: GroupTemplate] {
        var groupsMap: [String: GroupTemplate] = [:]
        for group in groups {
            for item in group.items {
                groupsMap[item] = group.template
            }
        }
        return groupsMap
    }
    
    private func calculateBaselineWidth(_ rows: [KeyRow], groups: [String: GroupTemplate]) -> CGFloat {
        var maxRowWidth: CGFloat = 0
        
        // Check if we have only one language (keyboard)
        let hasOnlyOneLanguage = (config?.keyboards?.count ?? 0) <= 1
        
        for row in rows {
            var rowWidth: CGFloat = 0
            for key in row.keys {
                let parsedKey = ParsedKey(from: key, groups: groups,
                                         defaultTextColor: .black,
                                         defaultBgColor: .white)
                
                // Skip language/next-keyboard keys if only one language
                let keyType = parsedKey.type.lowercased()
                if hasOnlyOneLanguage && keyType == "language" || !showGlobeButton && keyType == "next-keyboard" {
                    continue
                }
                
                if !parsedKey.hidden {
                    rowWidth += CGFloat(parsedKey.width + parsedKey.offset)
                }
            }
            
            if rowWidth > maxRowWidth {
                maxRowWidth = rowWidth
            }
        }
        
        return maxRowWidth > 0 ? maxRowWidth : 10.0
    }
    
    private func createRow(
        _ row: KeyRow,
        groups: [String: GroupTemplate],
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
            
            // Handle offset
            if parsedKey.offset > 0 {
                let offsetWidth = (CGFloat(parsedKey.offset) / baselineWidth) * availableWidth
                currentX += offsetWidth
            }
            
            // Generate key identifier for selection checking
            let keyId = "\(keysetId):\(rowIndex):\(keyIndex)"
            let isSelected = selectedKeyIds.contains(keyId)
            
            if parsedKey.hidden {
                let hiddenWidth = (CGFloat(parsedKey.width) / baselineWidth) * availableWidth
                currentX += hiddenWidth
            } else {
                let keyWidth = (CGFloat(parsedKey.width) / baselineWidth) * availableWidth - keySpacing
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
        
        // For backspace key, add long-press handling using touch events
        if key.type.lowercased() == "backspace" {
            button.addTarget(self, action: #selector(backspaceTouchDown(_:)), for: .touchDown)
            button.addTarget(self, action: #selector(backspaceTouchUp(_:)), for: .touchUpInside)
            button.addTarget(self, action: #selector(backspaceTouchUp(_:)), for: .touchUpOutside)
            button.addTarget(self, action: #selector(backspaceTouchCancelled(_:)), for: .touchCancel)
        } else {
            button.addTarget(self, action: #selector(keyTapped(_:)), for: .touchUpInside)
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
        let finalText: String
        if !key.label.isEmpty {
            finalText = key.label
        } else if !displayText.isEmpty {
            finalText = displayText
        } else if !key.value.isEmpty {
            finalText = key.value
        } else {
            finalText = getDefaultLabel(for: key.type, editorContext: editorContext)
        }
        
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
        } else {
            label.text = finalText
        }
        
        // Font size
        let isLargeKey = ["shift", "backspace", "enter"].contains(key.type.lowercased())
        let isMultiChar = finalText.count > 1
        let baseFontSize: CGFloat = isLargeKey ? largeFontSize : fontSize
        let finalFontSize = isMultiChar ? min(baseFontSize * 0.7, 14) : baseFontSize
        
        label.font = UIFont.systemFont(ofSize: finalFontSize, weight: .regular)
        label.adjustsFontSizeToFitWidth = true
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
    
    // MARK: - Backspace Touch Handling
    
    // Track if backspace was held long enough to start continuous delete
    private var backspaceStartedContinuousDelete: Bool = false
    
    // Reference to the backspace button for long press
    private weak var backspaceButton: UIButton?
    
    /// Called when backspace button is touched down
    @objc private func backspaceTouchDown(_ sender: UIButton) {
        print("⌫ Backspace touch DOWN - button: \(sender)")
        
        // Store reference
        backspaceButton = sender
        
        // Record the start time BEFORE anything else
        let startTime = Date()
        
        // Reset counters
        backspaceDeleteCount = 0
        currentDeleteInterval = initialDeleteInterval
        lastBackspaceDeleteTime = nil
        backspaceStartedContinuousDelete = false
        
        // Perform initial delete immediately
        performBackspaceDelete()
        
        // Set the start time AFTER performBackspaceDelete to avoid it being cleared
        backspacePressStartTime = startTime
        print("⌫ Start time set to: \(startTime)")
        
        // Start the timer for long-press detection and continuous deletion
        startBackspaceTimer()
    }
    
    /// Called when backspace button is released
    @objc private func backspaceTouchUp(_ sender: UIButton) {
        print("⌫ Backspace touch UP - stopping timer")
        stopBackspaceTimer()
    }
    
    /// Called when backspace button touch is cancelled
    @objc private func backspaceTouchCancelled(_ sender: UIButton) {
        print("⌫ Backspace touch CANCELLED - stopping timer")
        stopBackspaceTimer()
    }
    
    /// Start the backspace long-press timer
    private func startBackspaceTimer() {
        // Just invalidate any existing timer, don't clear other state
        backspaceTimer?.invalidate()
        backspaceTimer = nil
        
        // Create timer and add to common run loop modes for keyboard extension compatibility
        let timer = Timer(timeInterval: 0.05, repeats: true) { [weak self] _ in
            self?.handleBackspaceTimerTick()
        }
        // Add to common modes to ensure it fires during tracking (touch events)
        RunLoop.main.add(timer, forMode: .common)
        backspaceTimer = timer
        
        print("⌫ Timer started and added to run loop")
    }
    
    /// Stop the backspace timer and clear all state
    private func stopBackspaceTimer() {
        backspaceTimer?.invalidate()
        backspaceTimer = nil
        backspacePressStartTime = nil
        lastBackspaceDeleteTime = nil
        backspaceDeleteCount = 0
        currentDeleteInterval = initialDeleteInterval
    }
    
    /// Handle each tick of the backspace timer
    private func handleBackspaceTimerTick() {
        guard let startTime = backspacePressStartTime else {
            print("⌫ Timer tick: No start time, stopping")
            stopBackspaceTimer()
            return
        }
        
        let now = Date()
        let elapsed = now.timeIntervalSince(startTime)
        
        // Only start deleting after the initial delay (0.5 seconds)
        guard elapsed >= charDeleteStartDelay else {
            // Log occasionally to show timer is running
            if Int(elapsed * 10) % 5 == 0 {
                print("⌫ Timer tick: waiting... elapsed=\(String(format: "%.2f", elapsed))s, need \(charDeleteStartDelay)s")
            }
            return
        }
        
        // Check if enough time has passed since the last delete
        let timeSinceLastDelete: TimeInterval
        if let lastDelete = lastBackspaceDeleteTime {
            timeSinceLastDelete = now.timeIntervalSince(lastDelete)
        } else {
            // First delete after the 2-second delay
            timeSinceLastDelete = currentDeleteInterval  // Force immediate first delete
        }
        
        // If we've waited long enough, perform a delete
        if timeSinceLastDelete >= currentDeleteInterval {
            lastBackspaceDeleteTime = now
            performBackspaceAction(elapsed: elapsed)
        }
    }
    
    /// Perform the appropriate backspace action based on elapsed time
    private func performBackspaceAction(elapsed: TimeInterval) {
        if elapsed >= wordDeleteStartDelay {
            // After 6 seconds: delete whole words
            print("⌫ Deleting WORD (elapsed: \(String(format: "%.1f", elapsed))s)")
            performWordDelete()
        } else {
            // Between 2-6 seconds: delete characters at increasing speed
            print("⌫ Deleting CHAR (elapsed: \(String(format: "%.1f", elapsed))s, interval: \(String(format: "%.3f", currentDeleteInterval))s)")
            performBackspaceDelete()
        }
        
        // Increase speed (decrease interval) after each delete
        backspaceDeleteCount += 1
        currentDeleteInterval = max(minDeleteInterval, currentDeleteInterval * deleteSpeedupFactor)
    }
    
    /// Delete a single character
    private func performBackspaceDelete() {
        // Use the onDeleteCharacter callback if available, otherwise fall back to onKeyPress
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
                nikkud: nil
            )
            let parsedKey = ParsedKey(from: backspaceKey, groups: [:], defaultTextColor: .black, defaultBgColor: .white)
            onKeyPress?(parsedKey)
        }
    }
    
    /// Delete an entire word
    private func performWordDelete() {
        // Use the onDeleteWord callback if available
        if let onDeleteWord = onDeleteWord {
            onDeleteWord()
        } else {
            // Fall back to character delete
            performBackspaceDelete()
        }
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
            return shiftState.isActive() ? "⇧" : "⬆"
        case "settings":
            return "⚙"
        case "close":
            return "⬇"
        case "language":
            return "<->"
        case "next-keyboard":
            return "🌐"
        case "nikkud":
            return nikkudActive ? "◌ָ" : "◌"
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
    
    private func handleKeyClick(_ key: ParsedKey, keyView: UIButton) {
        print("🔑 Key clicked: type='\(key.type)', value='\(key.value)'")
        
        switch key.type.lowercased() {
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
            print("   → Handling KEYSET: keysetValue='\(key.keysetValue)'")
            if !key.keysetValue.isEmpty {
                switchKeyset(key.keysetValue)
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
                    if case .active = shiftState {
                        shiftState = .inactive
                        rerender()
                    }
                }
            } else {
                // Output FINAL key press to container
                onKeyPress?(key)
                
                // For shift-active (but not locked) regular keys, reset shift after key press
                // Locked shift stays active until explicitly toggled off
                if case .active = shiftState {
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
            label: "",
            keysetValue: keysetValue,
            nikkud: nikkudOptions.isEmpty ? nil : nikkudOptions
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
    
    // MARK: - Diacritics Generation
    
    /// Check if diacritics popup should be shown for this key
    /// Returns true if:
    /// 1. The key has explicit nikkud options, OR
    /// 2. The key's character is in the diacritics appliesTo list for the current keyboard
    private func shouldShowDiacriticsPopup(for key: ParsedKey) -> Bool {
        // If the key has explicit nikkud options, always show popup
        if !key.nikkud.isEmpty {
            print("   → shouldShowDiacriticsPopup: YES (explicit nikkud)")
            return true
        }
        
        // Check if the character is in the appliesTo list
        guard let config = config,
              let diacritics = config.getDiacritics(for: currentKeyboardId) else {
            print("   → shouldShowDiacriticsPopup: NO (no diacritics definition)")
            return false
        }
        
        let applies = diacritics.appliesTo(character: key.value)
        print("   → shouldShowDiacriticsPopup: \(applies ? "YES" : "NO") (character '\(key.value)' \(applies ? "is" : "is NOT") in appliesTo)")
        return applies
    }
    
    /// Get diacritics for a key, using explicit nikkud if present, otherwise generating from diacritics definition
    private func getDiacriticsForKey(_ key: ParsedKey) -> [NikkudOption] {
        print("🔍 getDiacriticsForKey: value='\(key.value)', explicit nikkud=\(key.nikkud.count)")
        
        // If the key has explicit nikkud options, use them (backward compatibility)
        if !key.nikkud.isEmpty {
            print("   → Using explicit nikkud (\(key.nikkud.count) options)")
            return key.nikkud
        }
        
        // Try to generate diacritics from the keyboard's diacritics definition
        guard let config = config else {
            print("   → No config available!")
            return []
        }
        
        // Get diacritics for the current keyboard (uses allDiacritics or falls back to legacy diacritics)
        let diacritics = config.getDiacritics(for: currentKeyboardId)
        print("   → Config available, diacritics for '\(currentKeyboardId ?? "nil")': \(diacritics != nil ? "YES" : "NO")")
        
        guard let diacritics = diacritics else {
            print("   → No diacritics definition for this keyboard")
            return []
        }
        
        print("   → Diacritics definition found with \(diacritics.items.count) items")
        
        // Get settings for the current keyboard (if available)
        let settings = config.diacriticsSettings?[currentKeyboardId ?? ""] ?? nil
        
        // Generate diacritics using the DiacriticsGenerator
        let generated = DiacriticsGenerator.getDiacritics(
            for: key,
            diacritics: diacritics,
            settings: settings
        )
        print("   → Generated \(generated.count) diacritics options")
        return generated
    }
    
    // MARK: - Nikkud Picker
    
    /// Show nikkud picker for a letter, with modifier toggle if applicable
    private func showNikkudPicker(_ nikkudOptions: [NikkudOption], anchorView: UIView) {
        print("📋 showNikkudPicker called with \(nikkudOptions.count) options")
        
        // Get the letter from the first option (for modifier toggle refresh)
        if let firstOption = nikkudOptions.first {
            // Extract the base letter from the first option's value
            if let firstChar = firstOption.value.first {
                currentNikkudLetter = String(firstChar)
                print("   Current letter set to: '\(currentNikkudLetter)'")
            }
        }
        
        // Check if we should use the diacritics system (with modifier toggle)
        // We use the diacritics system if:
        // 1. We have a diacritics config available for the current keyboard
        // 2. We have a valid current letter
        if config?.getDiacritics(for: currentKeyboardId) != nil && !currentNikkudLetter.isEmpty {
            print("   Using diacritics system with modifier toggle")
            showNikkudPickerInternal(forLetter: currentNikkudLetter, anchorView: anchorView)
        } else if !nikkudOptions.isEmpty {
            // Fallback to explicit options (backward compatibility)
            print("   Using explicit nikkud options (backward compatibility)")
            showNikkudPickerWithOptions(nikkudOptions, anchorView: anchorView)
        }
    }
    
    /// Show nikkud picker with explicit options (backward compatibility)
    private func showNikkudPickerWithOptions(_ nikkudOptions: [NikkudOption], anchorView: UIView) {
        print("🎯 Showing nikkud picker with \(nikkudOptions.count) explicit options")
        
        guard let container = container else {
            print("❌ No container available for nikkud picker")
            return
        }
        
        // Remove existing overlay if any
        container.subviews.filter { $0.tag == 999 }.forEach { $0.removeFromSuperview() }
        
        // Create overlay
        let overlay = TouchInterceptingOverlay()
        overlay.backgroundColor = UIColor.black.withAlphaComponent(0.3)
        overlay.tag = 999
        overlay.translatesAutoresizingMaskIntoConstraints = false
        overlay.layer.zPosition = 9999
        overlay.isUserInteractionEnabled = true
        
        overlay.onTapOutside = { [weak self] in
            self?.dismissNikkudPicker()
        }
        
        container.addSubview(overlay)
        container.bringSubviewToFront(overlay)
        overlay.frame = container.bounds
        
        NSLayoutConstraint.activate([
            overlay.leftAnchor.constraint(equalTo: container.leftAnchor),
            overlay.rightAnchor.constraint(equalTo: container.rightAnchor),
            overlay.topAnchor.constraint(equalTo: container.topAnchor),
            overlay.bottomAnchor.constraint(equalTo: container.bottomAnchor)
        ])
        
        // Layout constants
        let buttonSize: CGFloat = 50
        let spacing: CGFloat = 10
        let padding: CGFloat = 16
        let maxAvailableWidth = container.bounds.width * 0.85
        let itemsPerRow = min(6, max(3, nikkudOptions.count))
        let totalSpacing = spacing * CGFloat(itemsPerRow - 1) + 2 * padding
        let calculatedButtonSize = (maxAvailableWidth - totalSpacing) / CGFloat(itemsPerRow)
        let finalButtonSize = min(buttonSize, calculatedButtonSize)
        
        // Create picker container
        let picker = UIView()
        picker.backgroundColor = UIColor.systemGray6
        picker.layer.cornerRadius = 16
        picker.layer.shadowColor = UIColor.black.cgColor
        picker.layer.shadowOffset = CGSize(width: 0, height: 4)
        picker.layer.shadowOpacity = 0.3
        picker.layer.shadowRadius = 8
        
        let flexContainer = UIView()
        picker.addSubview(flexContainer)
        
        var rows: [[UIButton]] = [[]]
        
        for (index, option) in nikkudOptions.enumerated() {
            let value = option.value
            let caption = option.caption ?? value
            
            if index > 0 && index % itemsPerRow == 0 {
                rows.append([])
            }
            
            let button = UIButton(type: .system)
            button.setTitle(caption, for: .normal)
            button.titleLabel?.font = UIFont.systemFont(ofSize: 24)
            button.titleLabel?.adjustsFontSizeToFitWidth = true
            button.titleLabel?.minimumScaleFactor = 0.5
            // Use systemBackground for dark mode support
            button.backgroundColor = UIColor.systemBackground
            button.setTitleColor(.label, for: .normal)
            button.layer.cornerRadius = 8
            button.layer.borderWidth = 1
            button.layer.borderColor = UIColor.systemGray4.cgColor
            button.contentEdgeInsets = UIEdgeInsets(top: 4, left: 4, bottom: 4, right: 4)
            button.addTarget(self, action: #selector(nikkudOptionTapped(_:)), for: .touchUpInside)
            button.accessibilityIdentifier = value
            
            rows[rows.count - 1].append(button)
        }
        
        var currentY: CGFloat = 0
        var maxRowWidth: CGFloat = 0
        
        for row in rows {
            let rowWidth = CGFloat(row.count) * finalButtonSize + CGFloat(row.count - 1) * spacing
            maxRowWidth = max(maxRowWidth, rowWidth)
            
            for (index, button) in row.enumerated() {
                let reversedIndex = row.count - 1 - index
                let x = CGFloat(reversedIndex) * (finalButtonSize + spacing)
                button.frame = CGRect(x: x, y: currentY, width: finalButtonSize, height: finalButtonSize)
                flexContainer.addSubview(button)
            }
            
            currentY += finalButtonSize + spacing
        }
        
        let buttonsHeight = currentY - spacing
        let containerWidth = maxRowWidth
        
        flexContainer.frame = CGRect(x: padding, y: padding, width: containerWidth, height: buttonsHeight)
        
        let totalHeight = buttonsHeight + 2 * padding
        
        overlay.addSubview(picker)
        picker.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            picker.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            picker.centerYAnchor.constraint(equalTo: overlay.centerYAnchor),
            picker.widthAnchor.constraint(equalToConstant: containerWidth + 2 * padding),
            picker.heightAnchor.constraint(equalToConstant: totalHeight)
        ])
        
        print("✅ Nikkud picker displayed with \(nikkudOptions.count) explicit options")
    }
    
    /// Internal method to show nikkud picker with modifier support
    private func showNikkudPickerInternal(forLetter letter: String, anchorView: UIView) {
        print("🎯 Showing nikkud picker for letter '\(letter)', modifiers: \(modifierStates)")
        
        guard let container = container else {
            print("❌ No container available for nikkud picker")
            return
        }
        
        // Remove existing overlay if any
        container.subviews.filter { $0.tag == 999 }.forEach { $0.removeFromSuperview() }
        
        // Check if modifier is available for this letter
        let hasModifier = checkIfModifierApplies(to: letter)
        
        // Generate options - for now, pass the hasModifier flag
        // TODO: Update to use modifierStates for each modifier
        let anyModifierActive = !modifierStates.isEmpty && modifierStates.values.contains(where: { $0 != nil })
        let nikkudOptions = generateNikkudOptions(forLetter: letter, withModifier: anyModifierActive && hasModifier)
        
        print("   Container bounds: \(container.bounds)")
        print("   Has modifier: \(hasModifier)")
        print("   Options count: \(nikkudOptions.count)")
        
        // Create overlay background - use custom touch-intercepting view
        let overlay = TouchInterceptingOverlay()
        overlay.backgroundColor = UIColor.black.withAlphaComponent(0.3)
        overlay.tag = 999
        overlay.translatesAutoresizingMaskIntoConstraints = false
        
        // Set high z-position for React Native compatibility
        overlay.layer.zPosition = 9999
        overlay.isUserInteractionEnabled = true
        
        // Set callback for tap outside
        overlay.onTapOutside = { [weak self] in
            self?.dismissNikkudPicker()
        }
        
        container.addSubview(overlay)
        container.bringSubviewToFront(overlay)
        overlay.frame = container.bounds
        
        NSLayoutConstraint.activate([
            overlay.leftAnchor.constraint(equalTo: container.leftAnchor),
            overlay.rightAnchor.constraint(equalTo: container.rightAnchor),
            overlay.topAnchor.constraint(equalTo: container.topAnchor),
            overlay.bottomAnchor.constraint(equalTo: container.bottomAnchor)
        ])
        
        // Layout constants
        let buttonSize: CGFloat = 50
        let spacing: CGFloat = 10
        let padding: CGFloat = 16
        let toggleHeight: CGFloat = hasModifier ? 44 : 0
        let toggleSpacing: CGFloat = hasModifier ? 12 : 0
        
        // Calculate available width (85% of container width)
        let maxAvailableWidth = container.bounds.width * 0.85
        
        // Calculate items per row (aim for 5-6 per row)
        let itemsPerRow = min(6, max(3, nikkudOptions.count))
        
        // Calculate button size based on available width
        let totalSpacing = spacing * CGFloat(itemsPerRow - 1) + 2 * padding
        let calculatedButtonSize = (maxAvailableWidth - totalSpacing) / CGFloat(itemsPerRow)
        let finalButtonSize = min(buttonSize, calculatedButtonSize)
        
        // Create picker container
        let picker = UIView()
        picker.backgroundColor = UIColor.systemGray6
        picker.layer.cornerRadius = 16
        picker.layer.shadowColor = UIColor.black.cgColor
        picker.layer.shadowOffset = CGSize(width: 0, height: 4)
        picker.layer.shadowOpacity = 0.3
        picker.layer.shadowRadius = 8
        
        // Create flex container for buttons
        let flexContainer = UIView()
        picker.addSubview(flexContainer)
        
        // Create buttons in rows
        var rows: [[UIButton]] = [[]]
        
        for (index, option) in nikkudOptions.enumerated() {
            let value = option.value
            let caption = option.caption ?? value
            
            if index > 0 && index % itemsPerRow == 0 {
                rows.append([])
            }
            
            let button = UIButton(type: .system)
            button.setTitle(caption, for: .normal)
            button.titleLabel?.font = UIFont.systemFont(ofSize: 24)
            button.titleLabel?.adjustsFontSizeToFitWidth = true
            button.titleLabel?.minimumScaleFactor = 0.5
            // Use systemBackground for dark mode support
            button.backgroundColor = UIColor.systemBackground
            button.setTitleColor(.label, for: .normal)
            button.layer.cornerRadius = 8
            button.layer.borderWidth = 1
            button.layer.borderColor = UIColor.systemGray4.cgColor
            button.contentEdgeInsets = UIEdgeInsets(top: 4, left: 4, bottom: 4, right: 4)
            button.addTarget(self, action: #selector(nikkudOptionTapped(_:)), for: .touchUpInside)
            button.accessibilityIdentifier = value
            
            rows[rows.count - 1].append(button)
        }
        
        // Position buttons RTL
        var currentY: CGFloat = 0
        var maxRowWidth: CGFloat = 0
        
        for row in rows {
            let rowWidth = CGFloat(row.count) * finalButtonSize + CGFloat(row.count - 1) * spacing
            maxRowWidth = max(maxRowWidth, rowWidth)
            
            for (index, button) in row.enumerated() {
                let reversedIndex = row.count - 1 - index
                let x = CGFloat(reversedIndex) * (finalButtonSize + spacing)
                button.frame = CGRect(x: x, y: currentY, width: finalButtonSize, height: finalButtonSize)
                flexContainer.addSubview(button)
            }
            
            currentY += finalButtonSize + spacing
        }
        
        let buttonsHeight = currentY - spacing
        let containerWidth = maxRowWidth
        
        // Add close button (X) in top-right corner
        let closeButtonSize: CGFloat = 30
        let closeButton = UIButton(type: .system)
        closeButton.setTitle("✕", for: .normal)
        closeButton.titleLabel?.font = UIFont.systemFont(ofSize: 18, weight: .medium)
        closeButton.setTitleColor(.systemGray, for: .normal)
        closeButton.addTarget(self, action: #selector(dismissNikkudPicker), for: .touchUpInside)
        picker.addSubview(closeButton)
        closeButton.frame = CGRect(x: containerWidth + 2 * padding - closeButtonSize - 4, y: 4, width: closeButtonSize, height: closeButtonSize)
        
        flexContainer.frame = CGRect(x: padding, y: padding, width: containerWidth, height: buttonsHeight)
        
        // Add modifier row if applicable - all modifiers on same row
        var totalHeight = buttonsHeight + 2 * padding
        let modifierY: CGFloat = buttonsHeight + toggleSpacing
        
        // Modifier button constants - smaller key-sized buttons
        let modifierButtonSize: CGFloat = finalButtonSize * 0.85  // Slightly smaller than vowel keys
        let modifierButtonSpacing: CGFloat = 6
        let groupPadding: CGFloat = 8
        
        if hasModifier {
            let applicableModifiers = getModifiersForLetter(letter)
            
            // Create a single row container for all modifiers
            let modifierRowContainer = UIView()
            var totalRowWidth: CGFloat = 0
            var rowElements: [(view: UIView, width: CGFloat)] = []
            
            for modifier in applicableModifiers {
                let currentState = modifierStates[modifier.id] ?? nil
                
                if modifier.isMultiOption, let options = modifier.options {
                    // Multi-option modifier: bordered group with buttons
                    let groupContainer = UIView()
                    groupContainer.backgroundColor = UIColor.systemGray6.withAlphaComponent(0.5)
                    groupContainer.layer.cornerRadius = 10
                    groupContainer.layer.borderWidth = 1.5
                    groupContainer.layer.borderColor = UIColor.systemGray3.cgColor
                    
                    let totalButtonCount = options.count + 1
                    let groupWidth = CGFloat(totalButtonCount) * modifierButtonSize + CGFloat(totalButtonCount - 1) * modifierButtonSpacing + 2 * groupPadding
                    
                    var buttonX: CGFloat = groupPadding
                    
                    // "None" button
                    let noneButton = createModifierKeyButton(
                        title: letter,
                        isSelected: currentState == nil,
                        size: modifierButtonSize
                    )
                    noneButton.addTarget(self, action: #selector(multiOptionModifierTapped(_:)), for: .touchUpInside)
                    noneButton.accessibilityHint = "\(modifier.id):none"
                    noneButton.frame = CGRect(x: buttonX, y: groupPadding, width: modifierButtonSize, height: modifierButtonSize)
                    groupContainer.addSubview(noneButton)
                    buttonX += modifierButtonSize + modifierButtonSpacing
                    
                    // Option buttons
                    for option in options {
                        let displayText = letter + option.mark
                        let optionButton = createModifierKeyButton(
                            title: displayText,
                            isSelected: currentState == option.id,
                            size: modifierButtonSize
                        )
                        optionButton.addTarget(self, action: #selector(multiOptionModifierTapped(_:)), for: .touchUpInside)
                        optionButton.accessibilityHint = "\(modifier.id):\(option.id)"
                        optionButton.frame = CGRect(x: buttonX, y: groupPadding, width: modifierButtonSize, height: modifierButtonSize)
                        groupContainer.addSubview(optionButton)
                        buttonX += modifierButtonSize + modifierButtonSpacing
                    }
                    
                    let groupHeight = modifierButtonSize + 2 * groupPadding
                    groupContainer.frame = CGRect(x: 0, y: 0, width: groupWidth, height: groupHeight)
                    rowElements.append((view: groupContainer, width: groupWidth))
                    totalRowWidth += groupWidth
                    
                } else if let mark = modifier.mark {
                    // Simple toggle modifier - single key button
                    // Always show the letter WITH the modifier mark (e.g., בּ for dagesh)
                    // The selected state shows the visual highlight, not the text
                    let isActive = currentState != nil
                    let displayText = letter + mark  // Always show with mark
                    
                    let toggleButton = createModifierKeyButton(
                        title: displayText,
                        isSelected: isActive,
                        size: modifierButtonSize
                    )
                    toggleButton.addTarget(self, action: #selector(modifierToggleTapped(_:)), for: .touchUpInside)
                    toggleButton.accessibilityHint = modifier.id
                    toggleButton.frame = CGRect(x: 0, y: 0, width: modifierButtonSize, height: modifierButtonSize)
                    rowElements.append((view: toggleButton, width: modifierButtonSize))
                    totalRowWidth += modifierButtonSize
                }
            }
            
            // Add spacing between elements
            if rowElements.count > 1 {
                totalRowWidth += CGFloat(rowElements.count - 1) * modifierButtonSpacing
            }
            
            // Position all elements in the row, centered
            let rowHeight = modifierButtonSize + 2 * groupPadding
            var currentX = (containerWidth - totalRowWidth) / 2
            
            for element in rowElements {
                element.view.frame.origin.x = currentX
                // Vertically center single buttons with grouped buttons
                if element.view is UIButton {
                    element.view.frame.origin.y = groupPadding
                }
                modifierRowContainer.addSubview(element.view)
                currentX += element.width + modifierButtonSpacing
            }
            
            picker.addSubview(modifierRowContainer)
            modifierRowContainer.frame = CGRect(x: padding, y: padding + modifierY, width: containerWidth, height: rowHeight)
            
            totalHeight = modifierY + rowHeight + padding
        }
        
        overlay.addSubview(picker)
        picker.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            picker.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            picker.centerYAnchor.constraint(equalTo: overlay.centerYAnchor),
            picker.widthAnchor.constraint(equalToConstant: containerWidth + 2 * padding),
            picker.heightAnchor.constraint(equalToConstant: totalHeight)
        ])
        
        print("✅ Nikkud picker displayed with \(nikkudOptions.count) options, modifier toggle: \(hasModifier)")
    }
    
    /// Create a raised key-style button for modifiers
    private func createModifierKeyButton(title: String, isSelected: Bool, size: CGFloat) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(title, for: .normal)
        button.titleLabel?.font = UIFont.systemFont(ofSize: 20, weight: .medium)
        button.titleLabel?.adjustsFontSizeToFitWidth = true
        button.titleLabel?.minimumScaleFactor = 0.6
        
        // Raised key style with shadow - use adaptive colors for dark mode support
        if isSelected {
            button.backgroundColor = UIColor.systemBlue.withAlphaComponent(0.3)
            button.setTitleColor(.systemBlue, for: .normal)
            button.layer.borderWidth = 2
            button.layer.borderColor = UIColor.systemBlue.cgColor
        } else {
            // Use systemBackground instead of .white for dark mode support
            button.backgroundColor = UIColor.systemBackground
            button.setTitleColor(.label, for: .normal)
            button.layer.borderWidth = 1
            button.layer.borderColor = UIColor.systemGray4.cgColor
        }
        
        button.layer.cornerRadius = keyCornerRadius
        button.layer.shadowColor = UIColor.black.cgColor
        button.layer.shadowOffset = CGSize(width: 0, height: 2)
        button.layer.shadowOpacity = isSelected ? 0.15 : 0.25
        button.layer.shadowRadius = isSelected ? 1 : 2
        button.contentEdgeInsets = UIEdgeInsets(top: 4, left: 4, bottom: 4, right: 4)
        
        return button
    }
    
    /// Get modifiers that apply to the given letter (filtered by settings)
    private func getModifiersForLetter(_ letter: String) -> [DiacriticModifier] {
        guard let diacritics = config?.getDiacritics(for: currentKeyboardId) else {
            return []
        }
        
        // Get settings to filter disabled modifiers
        let settings = config?.diacriticsSettings?[currentKeyboardId ?? ""]
        
        // Get all applicable modifiers for this letter
        let allModifiers = diacritics.getModifiers(for: letter)
        
        // Filter out disabled modifiers
        return allModifiers.filter { modifier in
            settings?.isModifierEnabled(modifier.id) ?? true
        }
    }
    
    /// Check if any modifier applies to the given letter
    private func checkIfModifierApplies(to letter: String) -> Bool {
        return !getModifiersForLetter(letter).isEmpty
    }
    
    /// Generate nikkud options for a letter, applying active modifiers
    private func generateNikkudOptions(forLetter letter: String, withModifier: Bool) -> [NikkudOption] {
        guard let config = config,
              let diacritics = config.getDiacritics(for: currentKeyboardId) else {
            print("🔍 generateNikkudOptions: No config or diacritics for '\(currentKeyboardId ?? "nil")'!")
            return []
        }
        
        let keyboardId = currentKeyboardId ?? ""
        let settings = config.diacriticsSettings?[keyboardId]
        let hidden = settings?.hidden ?? []
        let disabledMods = settings?.disabledModifiers ?? []
        
        print("🔍 generateNikkudOptions for '\(letter)':")
        print("   keyboardId: '\(keyboardId)'")
        print("   hidden items: \(hidden)")
        print("   disabled modifiers: \(disabledMods)")
        
        // Get all applicable modifiers and their current states
        let applicableModifiers = getModifiersForLetter(letter)
        
        var result: [NikkudOption] = []
        
        for item in diacritics.items {
            // Skip if hidden in profile
            if hidden.contains(item.id) { continue }
            
            // Skip if not applicable to this letter
            if let onlyFor = item.onlyFor, !onlyFor.contains(letter) { continue }
            if let excludeFor = item.excludeFor, excludeFor.contains(letter) { continue }
            
            let isReplacement = item.isReplacement ?? false
            
            // Start with base value
            var value: String = isReplacement ? item.mark : letter
            
            // Apply each active modifier
            if !isReplacement {
                for modifier in applicableModifiers {
                    // Check if this modifier is active
                    guard let activeState = modifierStates[modifier.id], activeState != nil else {
                        continue
                    }
                    
                    if modifier.isMultiOption {
                        // Multi-option modifier: find the selected option's mark
                        if let selectedOptionId = activeState,
                           let selectedOption = modifier.options?.first(where: { $0.id == selectedOptionId }) {
                            value += selectedOption.mark
                        }
                    } else if let mark = modifier.mark {
                        // Simple toggle modifier: add the mark if active
                        value += mark
                    }
                }
                
                // Add the diacritic mark
                value += item.mark
            }
            
            result.append(NikkudOption(
                value: value,
                caption: value,
                sValue: nil,
                sCaption: nil
            ))
        }
        
        return result
    }
    
    /// Handle modifier toggle tap (simple ON/OFF) - refresh the picker with new options
    @objc private func modifierToggleTapped(_ sender: UIButton) {
        // Get modifier ID from the button
        let modifierId = sender.accessibilityHint ?? "dagesh"
        let currentState = modifierStates[modifierId] ?? nil
        
        print("🔄 Modifier toggle tapped: '\(modifierId)', was: \(String(describing: currentState))")
        
        // Toggle the modifier state
        // For simple toggle: nil (off) -> "" (on) -> nil (off)
        if currentState != nil {
            modifierStates[modifierId] = nil  // Turn off
        } else {
            modifierStates[modifierId] = ""  // Turn on (empty string = active for simple toggle)
        }
        
        // Refresh the picker with the same letter but new modifier state
        if !currentNikkudLetter.isEmpty, let container = container {
            showNikkudPickerInternal(forLetter: currentNikkudLetter, anchorView: container)
        }
    }
    
    /// Handle multi-option modifier button tap (None or specific option)
    @objc private func multiOptionModifierTapped(_ sender: UIButton) {
        // AccessibilityHint format: "modifierId:optionId" or "modifierId:none"
        guard let hint = sender.accessibilityHint else { return }
        
        let parts = hint.split(separator: ":")
        guard parts.count == 2 else { return }
        
        let modifierId = String(parts[0])
        let optionId = String(parts[1])
        
        print("🔄 Multi-option modifier tapped: '\(modifierId)' option: '\(optionId)'")
        
        // Set the modifier state
        if optionId == "none" {
            modifierStates[modifierId] = nil  // Deactivate
        } else {
            modifierStates[modifierId] = optionId  // Set to specific option
        }
        
        // Refresh the picker with the same letter but new modifier state
        if !currentNikkudLetter.isEmpty, let container = container {
            showNikkudPickerInternal(forLetter: currentNikkudLetter, anchorView: container)
        }
    }
    
    @objc private func nikkudOptionTapped(_ sender: UIButton) {
        print("🎯 Nikkud option tapped: \(sender.accessibilityIdentifier ?? "nil")")
        if let value = sender.accessibilityIdentifier {
            onNikkudSelected?(value)
        }
        dismissNikkudPicker()
    }
    
    @objc private func dismissNikkudPicker() {
        print("🎯 Dismissing nikkud picker")
        // Remove overlay - find by tag
        if let overlay = container?.subviews.first(where: { $0.tag == 999 }) {
            print("   Found overlay, removing...")
            overlay.removeFromSuperview()
        } else {
            print("   ⚠️ Overlay not found!")
        }
        
        // Reset all modifier toggle states when popup is closed
        modifierStates.removeAll()
        
        // Do NOT deactivate nikkud mode here - it stays active until toggled off
        // Just rerender to update the UI
        rerender()
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
    
    // MARK: - Suggestions Bar
    
    /// Check if the current keyboard is RTL (Hebrew or Arabic)
    private func isCurrentKeyboardRTL() -> Bool {
        guard let keyboardId = currentKeyboardId else { return false }
        return keyboardId == "he" || keyboardId == "ar"
    }
    
    /// Update the suggestions bar with current suggestions
    /// Renders suggestions as plain text with dividers, spread evenly across the row
    /// For RTL languages (Hebrew, Arabic), the first suggestion is on the right
    private func updateSuggestionsBar() {
        guard let container = container else { return }
        
        // Find existing suggestions bar or skip if not rendered yet
        guard let bar = suggestionsBar else {
            print("📝 updateSuggestionsBar: No suggestions bar found, skipping")
            return
        }
        
        // Clear existing subviews
        bar.subviews.forEach { $0.removeFromSuperview() }
        
        // If no suggestions, show nothing
        guard !currentSuggestions.isEmpty else {
            print("📝 updateSuggestionsBar: No suggestions to display")
            return
        }
        
        print("📝 updateSuggestionsBar: Displaying \(currentSuggestions.count) suggestions")
        
        let suggestionCount = min(currentSuggestions.count, 4)
        // Use container width if bar hasn't been laid out yet
        let barWidth = bar.bounds.width > 0 ? bar.bounds.width : container.bounds.width
        let barHeight = bar.bounds.height > 0 ? bar.bounds.height : suggestionsBarHeight
        
        // Skip if we still don't have valid dimensions
        guard barWidth > 0, barHeight > 0 else {
            print("📝 updateSuggestionsBar: Bar dimensions are 0, skipping")
            return
        }
        
        let cellWidth = barWidth / CGFloat(suggestionCount)
        let dividerWidth: CGFloat = 1.0
        
        // Check if we should use RTL layout (Hebrew or Arabic keyboards)
        let isRTL = isCurrentKeyboardRTL()
        print("📝 updateSuggestionsBar: isRTL=\(isRTL), keyboard=\(currentKeyboardId ?? "nil")")
        
        for (index, suggestion) in currentSuggestions.prefix(4).enumerated() {
            // Create tappable label/button with transparent background
            let button = UIButton(type: .system)
            button.setTitle(suggestion, for: .normal)
            // Use dedicated suggestions font size (larger than key font for better readability)
            button.titleLabel?.font = UIFont.systemFont(ofSize: suggestionsFontSize, weight: .medium)
            button.titleLabel?.adjustsFontSizeToFitWidth = true
            button.titleLabel?.minimumScaleFactor = 0.6
            button.titleLabel?.textAlignment = .center
            button.backgroundColor = .clear
            // Use adaptive colors for dark mode support - brighter text
            button.setTitleColor(.label, for: .normal)
            button.setTitleColor(.secondaryLabel, for: .highlighted)
            
            // Store suggestion in accessibility identifier for retrieval on tap
            button.accessibilityIdentifier = suggestion
            button.addTarget(self, action: #selector(suggestionTapped(_:)), for: .touchUpInside)
            
            // For RTL languages, reverse the position (first suggestion on the right)
            let x: CGFloat
            if isRTL {
                // RTL: first suggestion at the rightmost position
                x = barWidth - CGFloat(index + 1) * cellWidth
            } else {
                // LTR: first suggestion at the leftmost position
                x = CGFloat(index) * cellWidth
            }
            
            button.frame = CGRect(x: x, y: 0, width: cellWidth, height: barHeight)
            bar.addSubview(button)
            
            // Add divider after each cell except the last one
            if index < suggestionCount - 1 {
                let divider = UIView()
                divider.backgroundColor = UIColor.systemGray3
                
                let dividerX: CGFloat
                if isRTL {
                    // RTL: divider on the left side of each cell
                    dividerX = x - (dividerWidth / 2)
                } else {
                    // LTR: divider on the right side of each cell
                    dividerX = x + cellWidth - (dividerWidth / 2)
                }
                
                divider.frame = CGRect(
                    x: dividerX,
                    y: barHeight * 0.2,
                    width: dividerWidth,
                    height: barHeight * 0.6
                )
                bar.addSubview(divider)
            }
        }
    }
    
    /// Handle suggestion button tap
    @objc private func suggestionTapped(_ sender: UIButton) {
        guard let suggestion = sender.accessibilityIdentifier else { return }
        print("📝 Suggestion tapped: '\(suggestion)'")
        onSuggestionSelected?(suggestion)
    }
    
    /// Create the suggestions bar view
    private func createSuggestionsBar(width: CGFloat) -> UIView {
        let bar = UIView()
        bar.backgroundColor = UIColor.systemGray5
        bar.frame = CGRect(x: 0, y: 0, width: width, height: suggestionsBarHeight)
        bar.tag = 888  // Tag to identify suggestions bar
        return bar
    }
    
    // MARK: - Keyset Switching
    
    /// Switch to a different keyset (abc, 123, #+=) while staying on the same keyboard/language
    private func switchKeyset(_ keysetValue: String) {
        guard !keysetValue.isEmpty, let config = config else { return }
        
        // Use currentKeyboardId to determine which keyboard we're on
        // This is more reliable than extracting prefix from keyset ID
        let keyboardId = currentKeyboardId
        
        // Try to find the keyset for the current keyboard
        // Priority: 1. prefixed keyset (e.g., "he_abc"), 2. plain keyset (e.g., "abc")
        var candidates: [String] = []
        
        // Add prefixed version if we know the keyboard
        if let keyboardId = keyboardId, !keyboardId.isEmpty {
            candidates.append("\(keyboardId)_\(keysetValue)")
        }
        
        // Also try the keyset ID that matches the pattern of the current keyset
        // If current is "he_123", target should be "he_abc"
        if currentKeysetId.contains("_") {
            let prefix = currentKeysetId.components(separatedBy: "_").first ?? ""
            if !prefix.isEmpty {
                candidates.append("\(prefix)_\(keysetValue)")
            }
        }
        
        // Finally, try the plain keyset value (for first keyboard which has no prefix)
        candidates.append(keysetValue)
        
        // Find the first matching keyset
        let allKeysetIds = config.keysets.map { $0.id }
        let targetKeysetId = candidates.first { allKeysetIds.contains($0) }
        
        if let targetKeysetId = targetKeysetId {
            print("switchKeyset: switching from '\(currentKeysetId)' to '\(targetKeysetId)' (candidates: \(candidates))")
            currentKeysetId = targetKeysetId
            shiftState = .inactive
            nikkudActive = false
            rerender()
        } else {
            print("⚠️ Keyset not found for value '\(keysetValue)'. Tried: \(candidates)")
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
