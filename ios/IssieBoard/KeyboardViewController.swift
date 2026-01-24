import UIKit

class KeyboardViewController: UIInputViewController {
    
    // MARK: - Properties
    
    private var keyboardView: UIView!
    private let preferences = KeyboardPreferences()
    private var preferenceObserver: KeyboardPreferenceObserver?
    private var timestampLabel: UILabel?
    
    // Keyboard state
    private var parsedConfig: KeyboardConfig?
    private var currentKeysetId: String = "abc"
    private var shiftState: ShiftState = .inactive
    private var nikkudActive: Bool = false
    private var lastShiftClickTime: TimeInterval = 0
    private let doubleClickThreshold: TimeInterval = 0.5
    
    // UI Constants
    private let rowHeight: CGFloat = 50
    private let keySpacing: CGFloat = 6
    private let rowSpacing: CGFloat = 10
    private let keyCornerRadius: CGFloat = 5
    private let fontSize: CGFloat = 18
    private let largeFontSize: CGFloat = 24
    
    // Layout tracking to prevent infinite loops
    private var lastRenderedWidth: CGFloat = 0
    
    // MARK: - Lifecycle
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        print("🚀 KeyboardViewController viewDidLoad")
        print("📐 viewDidLoad: view.bounds = \(view.bounds)")
        
        setupKeyboard()
        loadPreferences()
        startObservingPreferences()
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        print("📐 viewWillAppear: view.bounds = \(view.bounds)")
        loadPreferences()
    }
    
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let currentWidth = view.bounds.width
        print("📐 viewDidLayoutSubviews: view.bounds = \(view.bounds), lastRenderedWidth = \(lastRenderedWidth)")
        
        // Only re-render if width has actually changed (prevents infinite loop)
        if parsedConfig != nil && abs(currentWidth - lastRenderedWidth) > 1 {
            print("📐 Width changed from \(lastRenderedWidth) to \(currentWidth), re-rendering")
            renderKeyboard()
        }
    }
    
    override func viewWillTransition(to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator) {
        super.viewWillTransition(to: size, with: coordinator)
        print("📐 viewWillTransition: new size = \(size), lastRenderedWidth = \(lastRenderedWidth)")
        
        coordinator.animate(alongsideTransition: { _ in
            print("📐 viewWillTransition animate: view.bounds = \(self.view.bounds)")
        }, completion: { _ in
            print("📐 viewWillTransition completion: view.bounds = \(self.view.bounds)")
            // Re-render after rotation completes (viewDidLayoutSubviews will handle this)
        })
    }
    
    override func textWillChange(_ textInput: UITextInput?) {
        super.textWillChange(textInput)
        // Re-render keyboard when text input changes (e.g., switching fields)
        // This updates the enter key label
        renderKeyboard()
    }
    
    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        stopObservingPreferences()
    }
    
    deinit {
        stopObservingPreferences()
    }
    
    // MARK: - Preferences Management
    
    func loadPreferences() {
        print("🔄 Loading keyboard preferences...")
        preferences.printAllPreferences()
        
        if let configJSON = preferences.getKeyboardConfigJSON() {
            print("⚙️ Parsing keyboard config...")
            print("   Config length: \(configJSON.count) chars")
            parseKeyboardConfig(configJSON)
        } else {
            print("⚠️ No keyboard config found - using fallback")
            renderFallbackKeyboard()
        }
    }
    
    func parseKeyboardConfig(_ jsonString: String) {
        guard let jsonData = jsonString.data(using: .utf8) else {
            print("❌ Failed to convert config string to data")
            renderFallbackKeyboard()
            return
        }
        
        do {
            let decoder = JSONDecoder()
            parsedConfig = try decoder.decode(KeyboardConfig.self, from: jsonData)
            
            // Set default keyset
            if let defaultKeyset = parsedConfig?.defaultKeyset {
                currentKeysetId = defaultKeyset
            }
            
            print("✅ Config parsed successfully")
            print("   Keysets: \(parsedConfig?.keysets.map { $0.id }.joined(separator: ", ") ?? "none")")
            print("   Current keyset: \(currentKeysetId)")
            
            renderKeyboard()
        } catch {
            print("❌ Failed to parse config: \(error)")
            renderFallbackKeyboard()
        }
    }
    
    func startObservingPreferences() {
        preferenceObserver = KeyboardPreferenceObserver(preferences: preferences) { [weak self] in
            print("🔔 Preferences changed! Reloading keyboard...")
            self?.loadPreferences()
        }
        
        preferenceObserver?.startObserving(interval: 0.5)
        print("👁️ Started observing preference changes")
    }
    
    func stopObservingPreferences() {
        preferenceObserver?.stopObserving()
        preferenceObserver = nil
    }
    
    // MARK: - Keyboard Setup
    
    func setupKeyboard() {
        keyboardView = UIView()
        keyboardView.backgroundColor = UIColor(red: 0.82, green: 0.82, blue: 0.82, alpha: 1.0)
        view.addSubview(keyboardView)
        
        keyboardView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            keyboardView.leftAnchor.constraint(equalTo: view.leftAnchor),
            keyboardView.rightAnchor.constraint(equalTo: view.rightAnchor),
            keyboardView.topAnchor.constraint(equalTo: view.topAnchor),
            keyboardView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            keyboardView.heightAnchor.constraint(greaterThanOrEqualToConstant: 300)
        ])
    }
    
    // MARK: - Editor Context Analysis
    
    func analyzeEditorContext() -> (enterVisible: Bool, enterLabel: String, enterAction: Int) {
        guard let textDocumentProxy = textDocumentProxy as UITextDocumentProxy? else {
            return (true, "↵", UIReturnKeyType.default.rawValue)
        }
        
        // Get keyboard type and return key type
        let keyboardType = textDocumentProxy.keyboardType ?? .default
        let returnKeyType = textDocumentProxy.returnKeyType ?? .default
        
        // Determine enter label based on return key type
        let enterLabel: String
        switch returnKeyType {
        case .search:
            enterLabel = "Search"
        case .go:
            enterLabel = "Go"
        case .send:
            enterLabel = "Send"
        case .next:
            enterLabel = "Next"
        case .done:
            enterLabel = "Done"
        case .continue:
            enterLabel = "Continue"
        case .join:
            enterLabel = "Join"
        case .route:
            enterLabel = "Route"
        case .emergencyCall:
            enterLabel = "Call"
        case .google:
            enterLabel = "Google"
        case .yahoo:
            enterLabel = "Yahoo"
        default:
            enterLabel = "↵"
        }
        
        // Enter is always visible unless explicitly hidden by config
        let enterVisible = true
        
        return (enterVisible, enterLabel, returnKeyType.rawValue)
    }
    
    // MARK: - Rendering
    
    func renderKeyboard() {
        let currentWidth = view.bounds.width
        print("🎨 Rendering keyboard from JSON...")
        print("📐 renderKeyboard: view.bounds.width = \(currentWidth), keyboardView.bounds.width = \(keyboardView?.bounds.width ?? 0), lastRenderedWidth = \(lastRenderedWidth)")
        
        // Update last rendered width
        lastRenderedWidth = currentWidth
        
        keyboardView.subviews.forEach { $0.removeFromSuperview() }
        
        guard let config = parsedConfig else {
            print("❌ No config to render")
            renderFallbackKeyboard()
            return
        }
        
        // Set background color
        if let bgColorString = config.backgroundColor,
           let bgColor = UIColor(hexString: bgColorString) {
            keyboardView.backgroundColor = bgColor
        }
        
        // Find current keyset
        guard let keyset = config.keysets.first(where: { $0.id == currentKeysetId }) else {
            print("❌ Keyset not found: \(currentKeysetId)")
            renderFallbackKeyboard()
            return
        }
        
        print("   Rendering keyset '\(currentKeysetId)' with \(keyset.rows.count) rows")
        
        // Build groups map
        let groups = buildGroupsMap(config.groups ?? [])
        
        // Calculate baseline width across ALL rows (like Android)
        let baselineWidth = calculateBaselineWidth(keyset.rows, groups: groups)
        print("   Baseline width: \(baselineWidth)")
        
        // Create container for rows (no stack view - manual layout for spacing)
        let rowsContainer = UIView()
        keyboardView.addSubview(rowsContainer)
        
        rowsContainer.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            rowsContainer.leftAnchor.constraint(equalTo: keyboardView.leftAnchor),
            rowsContainer.rightAnchor.constraint(equalTo: keyboardView.rightAnchor),
            rowsContainer.topAnchor.constraint(equalTo: keyboardView.topAnchor, constant: 4),
            rowsContainer.bottomAnchor.constraint(equalTo: keyboardView.bottomAnchor, constant: -4)
        ])
        
        // Render each row with manual positioning
        var currentY: CGFloat = 0
        for (index, row) in keyset.rows.enumerated() {
            print("   Row \(index): \(row.keys.count) keys, y=\(currentY)")
            let rowView = createRow(row, groups: groups, baselineWidth: baselineWidth)
            rowsContainer.addSubview(rowView)
            
            rowView.frame = CGRect(x: 4, y: currentY, width: view.bounds.width - 8, height: rowHeight)
            currentY += rowHeight + rowSpacing
        }
        
        print("   Total height needed: \(currentY)")
        print("✅ Keyboard rendered")
    }
    
    func renderFallbackKeyboard() {
        print("📱 Rendering fallback keyboard")
        
        keyboardView.subviews.forEach { $0.removeFromSuperview() }
        
        let label = UILabel()
        label.text = "Loading keyboard...\nSwitch profiles in app"
        label.numberOfLines = 0
        label.textAlignment = .center
        label.textColor = .darkGray
        keyboardView.addSubview(label)
        
        label.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: keyboardView.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: keyboardView.centerYAnchor)
        ])
        
    }
    
    func buildGroupsMap(_ groups: [Group]) -> [String: GroupTemplate] {
        var groupsMap: [String: GroupTemplate] = [:]
        for group in groups {
            for item in group.items {
                groupsMap[item] = group.template
            }
        }
        return groupsMap
    }
    
    func calculateBaselineWidth(_ rows: [KeyRow], groups: [String: GroupTemplate]) -> CGFloat {
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
    
    func createRow(_ row: KeyRow, groups: [String: GroupTemplate], baselineWidth: CGFloat) -> UIView {
        let rowContainer = UIView()
        
        // Calculate total weight
        var totalWeight: CGFloat = 0
        for key in row.keys {
            let parsedKey = ParsedKey(from: key, groups: groups, 
                                     defaultTextColor: .black, 
                                     defaultBgColor: .white)
            if !parsedKey.hidden {
                totalWeight += CGFloat(parsedKey.width + parsedKey.offset)
            }
        }
        
        if totalWeight == 0 { totalWeight = 1.0 }
        
        var currentX: CGFloat = 0
        let availableWidth = view.bounds.width - 8
        
        for key in row.keys {
            let parsedKey = ParsedKey(from: key, groups: groups,
                                     defaultTextColor: .black,
                                     defaultBgColor: .white)
            
            // Handle offset - add spacing BEFORE the key
            if parsedKey.offset > 0 {
                let offsetWidth = (CGFloat(parsedKey.offset) / baselineWidth) * availableWidth
                print("      Offset: \(parsedKey.offset) → \(offsetWidth)px at x=\(currentX)")
                currentX += offsetWidth
            }
            
            if parsedKey.hidden {
                // Hidden key - just add spacing
                let hiddenWidth = (CGFloat(parsedKey.width) / baselineWidth) * availableWidth
                print("      Hidden: width=\(parsedKey.width) → \(hiddenWidth)px at x=\(currentX)")
                currentX += hiddenWidth
            } else {
                // Visible key - create button
                let keyWidth = (CGFloat(parsedKey.width) / baselineWidth) * availableWidth - keySpacing
                print("      Key: width=\(parsedKey.width) → \(keyWidth)px at x=\(currentX), value='\(parsedKey.value)'")
                
                let button = createKeyButton(parsedKey, width: keyWidth)
                rowContainer.addSubview(button)
                
                button.frame = CGRect(x: currentX, y: 0, width: keyWidth, height: rowHeight)
                currentX += keyWidth + keySpacing
            }
        }
        
        return rowContainer
    }
    
    func createKeyButton(_ key: ParsedKey, width: CGFloat) -> UIButton {
        let button = UIButton(type: .system)
        
        // Display text based on shift state
        let displayText = shiftState.isActive() ? key.sCaption : key.caption
        
        // Get editor context for dynamic enter key
        let editorContext = analyzeEditorContext()
        
        // Determine final text with fallbacks including default labels for special keys
        let finalText: String
        if !key.label.isEmpty {
            finalText = key.label
        } else if !displayText.isEmpty {
            finalText = displayText
        } else if !key.value.isEmpty {
            finalText = key.value
        } else {
            // Provide default labels for special keys that have no text
            switch key.type.lowercased() {
            case "backspace":
                finalText = "⌫"
            case "enter", "action":
                finalText = editorContext.enterLabel
            case "shift":
                finalText = shiftState.isActive() ? "⇧" : "⬆"
            case "settings":
                finalText = "⚙"
            case "close":
                finalText = "⬇"
            case "language":
                finalText = "🌐"
            case "next-keyboard":
                finalText = "🌐"
            case "nikkud":
                finalText = "◌ָ"
            case "space":
                finalText = "SPACE"
            default:
                finalText = key.type.uppercased()  // Show type as fallback
            }
        }
        
        // Debug output with hex values
        let hexValues = finalText.unicodeScalars.map { String(format: "%04X", $0.value) }.joined(separator: " ")
        print("   Button: text='\(finalText)' hex=[\(hexValues)] type=\(key.type) label='\(key.label)' caption='\(displayText)'")
        
        button.setTitle(finalText, for: .normal)
        
        // Font size - use smaller font for multi-character labels
        let isLargeKey = ["shift", "backspace", "enter"].contains(key.type.lowercased())
        let isMultiChar = finalText.count > 1
        let baseFontSize: CGFloat = isLargeKey ? largeFontSize : fontSize
        let finalFontSize = isMultiChar ? min(baseFontSize * 0.7, 14) : baseFontSize
        
        // Try different fonts for better Unicode support
        button.titleLabel?.font = UIFont.systemFont(ofSize: finalFontSize, weight: .regular)
        button.titleLabel?.adjustsFontSizeToFitWidth = true
        button.titleLabel?.minimumScaleFactor = 0.3  // Allow more shrinking
        button.titleLabel?.numberOfLines = 1
        button.titleLabel?.lineBreakMode = .byClipping
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
        
        button.addTarget(self, action: #selector(keyTapped(_:)), for: .touchUpInside)
        button.accessibilityIdentifier = encodeKeyInfo(key)
        
        return button
    }
    
    func encodeKeyInfo(_ key: ParsedKey) -> String {
        var dict: [String: Any] = [
            "type": key.type,
            "value": key.value,
            "sValue": key.sValue,
            "keysetValue": key.keysetValue,
            "hasNikkud": !key.nikkud.isEmpty
        ]
        
        // Encode nikkud array
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
    
    func decodeKeyInfo(_ identifier: String?) -> [String: Any]? {
        guard let identifier = identifier,
              let data = identifier.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        return dict
    }
    
    @objc func keyTapped(_ sender: UIButton) {
        guard let keyInfo = decodeKeyInfo(sender.accessibilityIdentifier) else { return }
        
        let type = (keyInfo["type"] as? String) ?? ""
        let value = shiftState.isActive() ? ((keyInfo["sValue"] as? String) ?? "") : ((keyInfo["value"] as? String) ?? "")
        let keysetValue = (keyInfo["keysetValue"] as? String) ?? ""
        let hasNikkud = (keyInfo["hasNikkud"] as? Bool) ?? false
        
        print("🔘 Key tapped: type=\(type), value=\(value), hasNikkud=\(hasNikkud)")
        
        switch type.lowercased() {
        case "backspace":
            textDocumentProxy.deleteBackward()
            
        case "enter", "action":
            textDocumentProxy.insertText("\n")
            
        case "shift":
            handleShiftTap()
            
        case "nikkud":
            handleNikkudTap()
            
        case "keyset":
            if !keysetValue.isEmpty {
                switchKeyset(keysetValue)
            }
            
        case "close":
            closeKeyboard()
            
        case "settings":
            openSettings()
            
        case "language":
            switchLanguage()
            
        case "next-keyboard":
            advanceToNextInputMode()
            
        default:
            // Check if this key has nikkud and nikkud mode is active
            if nikkudActive && hasNikkud, let nikkudArray = keyInfo["nikkud"] as? [[String: String]] {
                showNikkudPicker(nikkudArray)
            } else if !value.isEmpty {
                textDocumentProxy.insertText(value)
                
                if case .active = shiftState {
                    shiftState = .inactive
                    renderKeyboard()
                }
            }
        }
    }
    
    func handleNikkudTap() {
        nikkudActive = !nikkudActive
        print("◌ָ Nikkud mode: \(nikkudActive ? "ON" : "OFF")")
        renderKeyboard()
    }
    
    func showNikkudPicker(_ nikkudOptions: [[String: String]]) {
        print("Showing nikkud picker with \(nikkudOptions.count) options")
        
        // Create overlay background
        let overlay = UIView(frame: view.bounds)
        overlay.backgroundColor = UIColor.black.withAlphaComponent(0.3)
        overlay.tag = 999
        view.addSubview(overlay)
        
        let buttonSize: CGFloat = 60
        let spacing: CGFloat = 12
        let padding: CGFloat = 20
        let maxWidth: CGFloat = view.bounds.width * 0.9
        
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
        // Force 2 rows if more than 6 items
        let itemsPerRow = nikkudOptions.count > 6 ? (nikkudOptions.count + 1) / 2 : nikkudOptions.count
        var rows: [[UIButton]] = [[]]
        
        for (index, option) in nikkudOptions.enumerated() {
            let value = option["value"] ?? ""
            let caption = option["caption"] ?? value
            
            // Force new row after itemsPerRow items
            if index > 0 && index % itemsPerRow == 0 {
                rows.append([])
            }
            
            let button = UIButton(type: .system)
            button.setTitle(caption, for: .normal)
            button.titleLabel?.font = UIFont.systemFont(ofSize: 28)
            button.backgroundColor = .white
            button.layer.cornerRadius = 8
            button.layer.borderWidth = 1
            button.layer.borderColor = UIColor.systemGray4.cgColor
            button.addTarget(self, action: #selector(nikkudOptionTapped(_:)), for: .touchUpInside)
            button.accessibilityIdentifier = value
            
            rows[rows.count - 1].append(button)
        }
        
        // Second pass: position buttons RTL, centered per row
        var currentY: CGFloat = 0
        var maxRowWidth: CGFloat = 0
        
        for row in rows {
            let rowWidth = CGFloat(row.count) * buttonSize + CGFloat(row.count - 1) * spacing
            maxRowWidth = max(maxRowWidth, rowWidth)
            
            // Position buttons RTL (right to left)
            for (index, button) in row.enumerated() {
                let reversedIndex = row.count - 1 - index  // Reverse for RTL
                let x = CGFloat(reversedIndex) * (buttonSize + spacing)
                button.frame = CGRect(x: x, y: currentY, width: buttonSize, height: buttonSize)
                flexContainer.addSubview(button)
            }
            
            currentY += buttonSize + spacing
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
    }
    
    @objc func nikkudOptionTapped(_ sender: UIButton) {
        if let value = sender.accessibilityIdentifier {
            textDocumentProxy.insertText(value)
        }
        dismissNikkudPicker()
    }
    
    @objc func dismissNikkudPicker() {
        // Remove overlay
        view.subviews.first(where: { $0.tag == 999 })?.removeFromSuperview()
    }
    
    func closeKeyboard() {
        // Dismiss the keyboard
        dismissKeyboard()
    }
    
    func openSettings() {
        print("⚙️ Settings button tapped - attempting to open main app")
        
        // Try to open the main app using a URL scheme
        // This requires:
        // 1. RequestsOpenAccess = YES in Info.plist
        // 2. URL scheme configured in main app
        // 3. User grants "Full Access" permission
        
        if let url = URL(string: "issieboard://") {
            extensionContext?.open(url, completionHandler: { success in
                print(success ? "✅ Opened main app" : "⚠️ Could not open app - Full Access may be required")
                if !success {
                    // If opening fails, just dismiss the keyboard
                    self.dismissKeyboard()
                }
            })
        } else {
            // Fallback: just dismiss keyboard
            dismissKeyboard()
        }
    }
    
    func handleShiftTap() {
        let currentTime = Date().timeIntervalSince1970
        if currentTime - lastShiftClickTime < doubleClickThreshold {
            shiftState = (shiftState == .locked) ? .inactive : .locked
        } else {
            shiftState = shiftState.toggle()
        }
        lastShiftClickTime = currentTime
        renderKeyboard()
    }
    
    func switchKeyset(_ keysetId: String) {
        guard let config = parsedConfig,
              config.keysets.contains(where: { $0.id == keysetId }) else {
            print("⚠️ Keyset '\(keysetId)' not found")
            return
        }
        
        currentKeysetId = keysetId
        shiftState = .inactive
        renderKeyboard()
    }
    
    func switchLanguage() {
        print("🌐 Language button tapped - cycling to next language")
        
        guard let config = parsedConfig else {
            print("❌ No parsed config")
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
                switchKeyset(nextKeysetId)
            } else {
                print("⚠️ Current keyset not found in same-type list")
            }
        } else {
            print("   Only one keyboard available for type \(currentKeysetType)")
        }
    }
    
    // MARK: - Timestamp
    
    func formatTimestamp(_ timeInterval: TimeInterval) -> String {
        if timeInterval == 0 { return "No sync" }
        let date = Date(timeIntervalSince1970: timeInterval)
        let formatter = DateFormatter()
        formatter.timeStyle = .medium
        formatter.dateStyle = .none
        return formatter.string(from: date)
    }
}
