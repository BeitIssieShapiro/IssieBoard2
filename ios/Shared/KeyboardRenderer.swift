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
    
    // Callbacks for system keyboard actions (only used by actual keyboard)
    var onNextKeyboard: (() -> Void)?
    var onDismissKeyboard: (() -> Void)?
    var onOpenSettings: (() -> Void)?
    
    // Internal state - managed entirely by renderer
    private var shiftState: ShiftState = .inactive
    private var nikkudActive: Bool = false
    private var config: KeyboardConfig?
    var currentKeysetId: String = "abc"  // Public so container can read it (but shouldn't write)
    private var editorContext: (enterVisible: Bool, enterLabel: String, enterAction: Int)?
    
    // Shift double-click detection
    private var lastShiftClickTime: TimeInterval = 0
    private let doubleClickThreshold: TimeInterval = 0.5
    
    // Selected keys for visual highlighting (edit mode)
    private var selectedKeyIds: Set<String> = []
    
    // Container reference - renderer owns the rendering
    private weak var container: UIView?
    
    // Layout tracking to prevent infinite loops
    private var lastRenderedWidth: CGFloat = 0
    
    // UI Constants - same for preview and keyboard
    private let rowHeight: CGFloat = 50
    private let keySpacing: CGFloat = 6
    private let rowSpacing: CGFloat = 10
    private let keyCornerRadius: CGFloat = 5
    private let fontSize: CGFloat = 18
    private let largeFontSize: CGFloat = 24
    
    // MARK: - Initialization
    
    init() {
        print("🎨 KeyboardRenderer created")
    }
    
    // MARK: - Public Methods
    
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
        
        // Clear existing views, but preserve nikkud picker overlay if present
        container.subviews.forEach { subview in
            if subview.tag != 999 {  // Don't remove nikkud picker overlay
                subview.removeFromSuperview()
            }
        }
        
        // Set background color
        if let bgColorString = config.backgroundColor,
           let bgColor = UIColor(hexString: bgColorString) {
            container.backgroundColor = bgColor
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
        
        // Create rows
        let rowsContainer = UIView()
        container.addSubview(rowsContainer)
        
        rowsContainer.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            rowsContainer.leftAnchor.constraint(equalTo: container.leftAnchor),
            rowsContainer.rightAnchor.constraint(equalTo: container.rightAnchor),
            rowsContainer.topAnchor.constraint(equalTo: container.topAnchor, constant: 4),
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
        
        for row in rows {
            var rowWidth: CGFloat = 0
            for key in row.keys {
                let parsedKey = ParsedKey(from: key, groups: groups,
                                         defaultTextColor: .black,
                                         defaultBgColor: .white)
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
        let rowContainer = UIView()
        var currentX: CGFloat = 0
        var keyIndex = 0
        
        for key in row.keys {
            let parsedKey = ParsedKey(from: key, groups: groups,
                                     defaultTextColor: .black,
                                     defaultBgColor: .white)
            
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
    ) -> UIButton {
        let button = UIButton(type: .system)
        
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
        
        button.setTitle(finalText, for: .normal)
        
        // Font size
        let isLargeKey = ["shift", "backspace", "enter"].contains(key.type.lowercased())
        let isMultiChar = finalText.count > 1
        let baseFontSize: CGFloat = isLargeKey ? largeFontSize : fontSize
        let finalFontSize = isMultiChar ? min(baseFontSize * 0.7, 14) : baseFontSize
        
        button.titleLabel?.font = UIFont.systemFont(ofSize: finalFontSize, weight: .regular)
        button.titleLabel?.adjustsFontSizeToFitWidth = true
        button.titleLabel?.minimumScaleFactor = 0.3
        button.titleLabel?.numberOfLines = 1
        button.contentEdgeInsets = UIEdgeInsets(top: 2, left: 2, bottom: 2, right: 2)
        
        // Colors
        var bgColor = key.backgroundColor
        if key.type.lowercased() == "shift" && shiftState.isActive() {
            bgColor = .systemGreen
        } else if key.type.lowercased() == "nikkud" && nikkudActive {
            bgColor = .systemYellow
        }
        
        button.backgroundColor = bgColor
        button.setTitleColor(key.textColor, for: .normal)
        button.layer.cornerRadius = keyCornerRadius
        button.layer.shadowColor = UIColor.black.cgColor
        button.layer.shadowOffset = CGSize(width: 0, height: 1)
        button.layer.shadowOpacity = 0.2
        button.layer.shadowRadius = 1
        
        // Selection highlight for edit mode
        if isSelected {
            button.layer.borderWidth = 3.0
            button.layer.borderColor = UIColor.systemBlue.cgColor
        }
        
        button.addTarget(self, action: #selector(keyTapped(_:)), for: .touchUpInside)
        button.accessibilityIdentifier = encodeKeyInfo(key)
        
        return button
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
        case "language", "next-keyboard":
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
                currentKeysetId = key.keysetValue
                shiftState = .inactive
                nikkudActive = false  // Deactivate nikkud on keyset change
                rerender()
            }
            
        case "language":
            // Language switching handled internally
            print("   → Handling LANGUAGE")
            switchLanguage()
            
        case "next-keyboard":
            // For actual keyboard: call system callback
            // For preview: just switch language internally
            print("   → Handling NEXT-KEYBOARD")
            if let onNextKeyboard = onNextKeyboard {
                onNextKeyboard()
            } else {
                switchLanguage()
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
            if nikkudActive && !key.nikkud.isEmpty {
                showNikkudPicker(key.nikkud, anchorView: keyView)
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
    
    // MARK: - Nikkud Picker
    
    private func showNikkudPicker(_ nikkudOptions: [NikkudOption], anchorView: UIView) {
        print("🎯 Showing nikkud picker with \(nikkudOptions.count) options")
        
        guard let container = container else {
            print("❌ No container available for nikkud picker")
            return
        }
        
        print("   Container bounds: \(container.bounds)")
        print("   Container frame: \(container.frame)")
        
        // Create overlay background - use custom touch-intercepting view
        let overlay = TouchInterceptingOverlay()
        overlay.backgroundColor = UIColor.black.withAlphaComponent(0.3)
        overlay.tag = 999
        overlay.translatesAutoresizingMaskIntoConstraints = false
        
        // Set high z-position for React Native compatibility
        overlay.layer.zPosition = 9999
        
        // Enable user interaction
        overlay.isUserInteractionEnabled = true
        
        // Set callback for tap outside
        overlay.onTapOutside = { [weak self] in
            self?.dismissNikkudPicker()
        }
        
        container.addSubview(overlay)
        container.bringSubviewToFront(overlay)
        
        // Set the frame immediately with a large size to capture all touches
        overlay.frame = container.bounds
        
        // Pin overlay to fill entire container
        NSLayoutConstraint.activate([
            overlay.leftAnchor.constraint(equalTo: container.leftAnchor),
            overlay.rightAnchor.constraint(equalTo: container.rightAnchor),
            overlay.topAnchor.constraint(equalTo: container.topAnchor),
            overlay.bottomAnchor.constraint(equalTo: container.bottomAnchor)
        ])
        
        print("   Overlay added to container")
        
        // Nikkud picker button size
        let buttonSize: CGFloat = 60
        let spacing: CGFloat = 12
        let padding: CGFloat = 20
        
        // Calculate available width (80% of container width)
        let maxAvailableWidth = container.bounds.width * 0.8
        
        // Force 2 rows for better layout
        let itemsPerRow = (nikkudOptions.count + 1) / 2
        
        // Calculate button size based on available width and number of items per row
        let totalSpacing = spacing * CGFloat(itemsPerRow - 1) + 2 * padding
        let calculatedButtonSize = (maxAvailableWidth - totalSpacing) / CGFloat(itemsPerRow)
        let finalButtonSize = min(buttonSize, calculatedButtonSize)
        
        print("   Container width: \(container.bounds.width)")
        print("   Available width (80%): \(maxAvailableWidth)")
        print("   Items per row: \(itemsPerRow)")
        print("   Button size: \(finalButtonSize)")
        
        // Create picker container
        let picker = UIView()
        picker.backgroundColor = UIColor.systemGray6
        picker.layer.cornerRadius = 16
        picker.layer.shadowColor = UIColor.black.cgColor
        picker.layer.shadowOffset = CGSize(width: 0, height: 4)
        picker.layer.shadowOpacity = 0.3
        picker.layer.shadowRadius = 8
        
        // Create flex container for RTL layout
        let flexContainer = UIView()
        picker.addSubview(flexContainer)
        
        // First pass: collect buttons into rows
        var rows: [[UIButton]] = [[]]
        
        for (index, option) in nikkudOptions.enumerated() {
            let value = option.value
            let caption = option.caption ?? value
            
            // Force new row after itemsPerRow items
            if index > 0 && index % itemsPerRow == 0 {
                rows.append([])
            }
            
            let button = UIButton(type: .system)
            button.setTitle(caption, for: .normal)
            button.titleLabel?.font = UIFont.systemFont(ofSize: 28)
            button.titleLabel?.adjustsFontSizeToFitWidth = true
            button.titleLabel?.minimumScaleFactor = 0.5
            button.backgroundColor = .white
            button.layer.cornerRadius = 8
            button.layer.borderWidth = 1
            button.layer.borderColor = UIColor.systemGray4.cgColor
            button.contentEdgeInsets = UIEdgeInsets(top: 4, left: 4, bottom: 4, right: 4)
            button.addTarget(self, action: #selector(nikkudOptionTapped(_:)), for: .touchUpInside)
            button.accessibilityIdentifier = value
            
            rows[rows.count - 1].append(button)
        }
        
        // Second pass: position buttons RTL, centered per row
        var currentY: CGFloat = 0
        var maxRowWidth: CGFloat = 0
        
        for row in rows {
            let rowWidth = CGFloat(row.count) * finalButtonSize + CGFloat(row.count - 1) * spacing
            maxRowWidth = max(maxRowWidth, rowWidth)
            
            // Position buttons RTL (right to left)
            for (index, button) in row.enumerated() {
                let reversedIndex = row.count - 1 - index  // Reverse for RTL
                let x = CGFloat(reversedIndex) * (finalButtonSize + spacing)
                button.frame = CGRect(x: x, y: currentY, width: finalButtonSize, height: finalButtonSize)
                flexContainer.addSubview(button)
            }
            
            currentY += finalButtonSize + spacing
        }
        
        // Calculate final container size
        let containerWidth = maxRowWidth
        let containerHeight = currentY - spacing  // Remove last spacing
        
        flexContainer.frame = CGRect(x: padding, y: padding, width: containerWidth, height: containerHeight)
        
        overlay.addSubview(picker)
        picker.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            picker.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            picker.centerYAnchor.constraint(equalTo: overlay.centerYAnchor),
            picker.widthAnchor.constraint(equalToConstant: containerWidth + 2 * padding),
            picker.heightAnchor.constraint(equalToConstant: containerHeight + 2 * padding)
        ])
        
        // Tap overlay to dismiss
        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(dismissNikkudPicker))
        overlay.addGestureRecognizer(tapGesture)
        
        print("✅ Nikkud picker displayed")
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