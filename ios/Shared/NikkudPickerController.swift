import UIKit

/**
 * Custom overlay view that intercepts all touches for the nikkud picker.
 */
class TouchInterceptingOverlay: UIView {
    var onTapOutside: (() -> Void)?
    
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        let result = super.hitTest(point, with: event)
        if result == self {
            return self
        }
        return result
    }
    
    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        if let touch = touches.first {
            let location = touch.location(in: self)
            var hitPicker = false
            for subview in subviews {
                if subview.frame.contains(location) {
                    hitPicker = true
                    break
                }
            }
            if !hitPicker {
                debugLog("🎯 Touch outside picker, dismissing")
                onTapOutside?()
            }
        }
    }
}

/**
 * Manages the nikkud (diacritics) picker popup UI and logic.
 * 
 * Features:
 * - Shows diacritics options for a letter
 * - Supports modifier toggles (dagesh, shin/sin dots)
 * - Handles multi-option modifiers
 * - Language-aware (Hebrew/Arabic)
 *
 * This class is designed to be used by KeyboardRenderer and maps 1:1 to Kotlin.
 */
class NikkudPickerController {
    
    // MARK: - Callbacks
    
    /// Called when a nikkud option is selected
    var onNikkudSelected: ((String) -> Void)?
    
    /// Called when the picker is dismissed (to trigger keyboard re-render)
    var onDismiss: (() -> Void)?
    
    // MARK: - UI Constants
    
    private let keyCornerRadius: CGFloat = 5
    
    // MARK: - State
    
    /// Current letter being edited in nikkud picker
    private var currentLetter: String = ""
    
    /// Modifier toggle states
    /// Key: modifier ID, Value: selected option ID (nil = off)
    private var modifierStates: [String: String?] = [:]
    
    /// Reference to the container view
    private weak var container: UIView?
    
    /// Current keyboard configuration
    private var config: KeyboardConfig?
    
    /// Current keyboard ID
    private var currentKeyboardId: String?
    
    // MARK: - Initialization
    
    init() {
        debugLog("🎨 NikkudPickerController initialized")
    }
    
    // MARK: - Configuration
    
    /// Set the configuration for diacritics lookup
    func configure(config: KeyboardConfig?, keyboardId: String?, container: UIView?) {
        self.config = config
        self.currentKeyboardId = keyboardId
        self.container = container
    }
    
    /// Get the current letter being edited
    var currentNikkudLetter: String {
        return currentLetter
    }
    
    // MARK: - Public Methods
    
    /// Show nikkud picker for a key
    func showPicker(for key: ParsedKey, anchorView: UIView) {
        debugLog("📋 showPicker called for key: '\(key.value)'")
        
        // Get the letter from the key
        if let firstChar = key.value.first {
            currentLetter = String(firstChar)
            debugLog("   Current letter set to: '\(currentLetter)'")
        }
        
        // Check if we should use diacritics system (with modifier toggle)
        if config?.getDiacritics(for: currentKeyboardId) != nil && !currentLetter.isEmpty {
            debugLog("   Using diacritics system with modifier toggle")
            showPickerInternal(forLetter: currentLetter, anchorView: anchorView)
        } else if !key.nikkud.isEmpty {
            // Fallback to explicit options (backward compatibility)
            debugLog("   Using explicit nikkud options (backward compatibility)")
            showPickerWithOptions(key.nikkud, anchorView: anchorView)
        }
    }
    
    /// Refresh the picker if open (used when diacritics settings change)
    func refreshIfOpen(anchorView: UIView) {
        guard !currentLetter.isEmpty, container != nil else {
            debugLog("📱 refreshIfOpen: No current letter or container")
            return
        }
        
        debugLog("📱 refreshIfOpen: Refreshing picker for letter '\(currentLetter)'")
        showPickerInternal(forLetter: currentLetter, anchorView: anchorView)
    }
    
    /// Dismiss the picker
    func dismiss() {
        debugLog("🎯 Dismissing nikkud picker")
        
        if let overlay = container?.subviews.first(where: { $0.tag == 999 }) {
            debugLog("   Found overlay, removing...")
            overlay.removeFromSuperview()
        } else {
            debugLog("   ⚠️ Overlay not found!")
        }
        
        // Reset all modifier toggle states
        modifierStates.removeAll()
        currentLetter = ""
        
        // Notify for keyboard re-render
        onDismiss?()
    }
    
    // MARK: - Diacritics Logic
    
    /// Check if diacritics popup should be shown for this key
    func shouldShowDiacriticsPopup(for key: ParsedKey) -> Bool {
        // If the key has explicit nikkud options, always show popup
        if !key.nikkud.isEmpty {
            debugLog("   → shouldShowDiacriticsPopup: YES (explicit nikkud)")
            return true
        }
        
        // Check if the character is in the appliesTo list
        guard let config = config,
              let diacritics = config.getDiacritics(for: currentKeyboardId) else {
            debugLog("   → shouldShowDiacriticsPopup: NO (no diacritics definition)")
            return false
        }
        
        let applies = diacritics.appliesTo(character: key.value)
        debugLog("   → shouldShowDiacriticsPopup: \(applies ? "YES" : "NO") (character '\(key.value)' \(applies ? "is" : "is NOT") in appliesTo)")
        return applies
    }
    
    /// Get diacritics for a key
    func getDiacriticsForKey(_ key: ParsedKey) -> [NikkudOption] {
        debugLog("🔍 getDiacriticsForKey: value='\(key.value)', explicit nikkud=\(key.nikkud.count)")
        
        // If the key has explicit nikkud options, use them
        if !key.nikkud.isEmpty {
            debugLog("   → Using explicit nikkud (\(key.nikkud.count) options)")
            return key.nikkud
        }
        
        guard let config = config else {
            debugLog("   → No config available!")
            return []
        }
        
        let diacritics = config.getDiacritics(for: currentKeyboardId)
        debugLog("   → Config available, diacritics for '\(currentKeyboardId ?? "nil")': \(diacritics != nil ? "YES" : "NO")")
        
        guard let diacritics = diacritics else {
            debugLog("   → No diacritics definition for this keyboard")
            return []
        }
        
        debugLog("   → Diacritics definition found with \(diacritics.items.count) items")
        
        let settings = config.diacriticsSettings?[currentKeyboardId ?? ""] ?? nil
        
        let generated = DiacriticsGenerator.getDiacritics(
            for: key,
            diacritics: diacritics,
            settings: settings
        )
        debugLog("   → Generated \(generated.count) diacritics options")
        return generated
    }
    
    // MARK: - Private UI Methods
    
    /// Show picker with explicit options (backward compatibility)
    private func showPickerWithOptions(_ nikkudOptions: [NikkudOption], anchorView: UIView) {
        debugLog("🎯 Showing nikkud picker with \(nikkudOptions.count) explicit options")
        
        guard let container = container else {
            debugLog("❌ No container available for nikkud picker")
            return
        }
        
        // Remove existing overlay
        container.subviews.filter { $0.tag == 999 }.forEach { $0.removeFromSuperview() }
        
        // Create overlay
        let overlay = TouchInterceptingOverlay()
        overlay.backgroundColor = UIColor.black.withAlphaComponent(0.3)
        overlay.tag = 999
        overlay.translatesAutoresizingMaskIntoConstraints = false
        overlay.layer.zPosition = 9999
        overlay.isUserInteractionEnabled = true
        
        overlay.onTapOutside = { [weak self] in
            self?.dismiss()
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
        
        debugLog("✅ Nikkud picker displayed with \(nikkudOptions.count) explicit options")
    }
    
    /// Internal method to show nikkud picker with modifier support
    private func showPickerInternal(forLetter letter: String, anchorView: UIView) {
        debugLog("🎯 Showing nikkud picker for letter '\(letter)', modifiers: \(modifierStates)")
        
        guard let container = container else {
            debugLog("❌ No container available for nikkud picker")
            return
        }
        
        // Remove existing overlay
        container.subviews.filter { $0.tag == 999 }.forEach { $0.removeFromSuperview() }
        
        // Check if modifier is available
        let hasModifier = checkIfModifierApplies(to: letter)
        
        // Generate options
        let anyModifierActive = !modifierStates.isEmpty && modifierStates.values.contains(where: { $0 != nil })
        let nikkudOptions = generateNikkudOptions(forLetter: letter, withModifier: anyModifierActive && hasModifier)
        
        debugLog("   Container bounds: \(container.bounds)")
        debugLog("   Has modifier: \(hasModifier)")
        debugLog("   Options count: \(nikkudOptions.count)")
        
        // Create overlay
        let overlay = TouchInterceptingOverlay()
        overlay.backgroundColor = UIColor.black.withAlphaComponent(0.3)
        overlay.tag = 999
        overlay.translatesAutoresizingMaskIntoConstraints = false
        overlay.layer.zPosition = 9999
        overlay.isUserInteractionEnabled = true
        
        overlay.onTapOutside = { [weak self] in
            self?.dismiss()
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
        let topPadding: CGFloat = 40
        let toggleHeight: CGFloat = hasModifier ? 44 : 0
        let toggleSpacing: CGFloat = hasModifier ? 12 : 0
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
        
        // Close button
        let closeButtonSize: CGFloat = 30
        let closeButton = UIButton(type: .system)
        closeButton.setTitle("✕", for: .normal)
        closeButton.titleLabel?.font = UIFont.systemFont(ofSize: 18, weight: .medium)
        closeButton.setTitleColor(.systemGray, for: .normal)
        closeButton.addTarget(self, action: #selector(dismissPicker), for: .touchUpInside)
        picker.addSubview(closeButton)
        closeButton.frame = CGRect(x: containerWidth + 2 * padding - closeButtonSize - 8, y: 6, width: closeButtonSize, height: closeButtonSize)
        
        flexContainer.frame = CGRect(x: padding, y: topPadding, width: containerWidth, height: buttonsHeight)
        
        // Add modifier row if applicable
        var totalHeight = buttonsHeight + topPadding + padding
        let modifierY: CGFloat = buttonsHeight + toggleSpacing
        let modifierButtonSize: CGFloat = finalButtonSize * 0.85
        let modifierButtonSpacing: CGFloat = 6
        let groupPadding: CGFloat = 8
        
        if hasModifier {
            let applicableModifiers = getModifiersForLetter(letter)
            let modifierRowContainer = UIView()
            var totalRowWidth: CGFloat = 0
            var rowElements: [(view: UIView, width: CGFloat)] = []
            
            for modifier in applicableModifiers {
                let currentState = modifierStates[modifier.id] ?? nil
                
                if modifier.isMultiOption, let options = modifier.options {
                    // Multi-option modifier
                    let groupContainer = UIView()
                    groupContainer.backgroundColor = UIColor.systemGray6.withAlphaComponent(0.5)
                    groupContainer.layer.cornerRadius = 10
                    groupContainer.layer.borderWidth = 1.5
                    groupContainer.layer.borderColor = UIColor.systemGray3.cgColor
                    
                    let totalButtonCount = options.count + 1
                    let groupWidth = CGFloat(totalButtonCount) * modifierButtonSize + CGFloat(totalButtonCount - 1) * modifierButtonSpacing + 2 * groupPadding
                    
                    var buttonX: CGFloat = groupPadding
                    
                    // "None" button
                    let noneButton = createModifierKeyButton(title: letter, isSelected: currentState == nil, size: modifierButtonSize)
                    noneButton.addTarget(self, action: #selector(multiOptionModifierTapped(_:)), for: .touchUpInside)
                    noneButton.accessibilityHint = "\(modifier.id):none"
                    noneButton.frame = CGRect(x: buttonX, y: groupPadding, width: modifierButtonSize, height: modifierButtonSize)
                    groupContainer.addSubview(noneButton)
                    buttonX += modifierButtonSize + modifierButtonSpacing
                    
                    // Option buttons
                    for option in options {
                        let displayText = letter + option.mark
                        let optionButton = createModifierKeyButton(title: displayText, isSelected: currentState == option.id, size: modifierButtonSize)
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
                    // Simple toggle modifier
                    let isActive = currentState != nil
                    let displayText = letter + mark
                    
                    let toggleButton = createModifierKeyButton(title: displayText, isSelected: isActive, size: modifierButtonSize)
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
            
            // Position all elements
            let rowHeight = modifierButtonSize + 2 * groupPadding
            var currentX = (containerWidth - totalRowWidth) / 2
            
            for element in rowElements {
                element.view.frame.origin.x = currentX
                if element.view is UIButton {
                    element.view.frame.origin.y = groupPadding
                }
                modifierRowContainer.addSubview(element.view)
                currentX += element.width + modifierButtonSpacing
            }
            
            picker.addSubview(modifierRowContainer)
            modifierRowContainer.frame = CGRect(x: padding, y: topPadding + modifierY, width: containerWidth, height: rowHeight)
            
            totalHeight = topPadding + modifierY + rowHeight + padding
        }
        
        overlay.addSubview(picker)
        picker.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            picker.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            picker.centerYAnchor.constraint(equalTo: overlay.centerYAnchor),
            picker.widthAnchor.constraint(equalToConstant: containerWidth + 2 * padding),
            picker.heightAnchor.constraint(equalToConstant: totalHeight)
        ])
        
        debugLog("✅ Nikkud picker displayed with \(nikkudOptions.count) options, modifier toggle: \(hasModifier)")
    }
    
    /// Create a raised key-style button for modifiers
    private func createModifierKeyButton(title: String, isSelected: Bool, size: CGFloat) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(title, for: .normal)
        button.titleLabel?.font = UIFont.systemFont(ofSize: 20, weight: .medium)
        button.titleLabel?.adjustsFontSizeToFitWidth = true
        button.titleLabel?.minimumScaleFactor = 0.6
        
        if isSelected {
            button.backgroundColor = UIColor.systemBlue.withAlphaComponent(0.3)
            button.setTitleColor(.systemBlue, for: .normal)
            button.layer.borderWidth = 2
            button.layer.borderColor = UIColor.systemBlue.cgColor
        } else {
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
    
    // MARK: - Modifier Logic
    
    /// Get modifiers that apply to the given letter
    private func getModifiersForLetter(_ letter: String) -> [DiacriticModifier] {
        guard let diacritics = config?.getDiacritics(for: currentKeyboardId) else {
            return []
        }
        
        let settings = config?.diacriticsSettings?[currentKeyboardId ?? ""]
        let allModifiers = diacritics.getModifiers(for: letter)
        
        return allModifiers.filter { modifier in
            settings?.isModifierEnabled(modifier.id) ?? true
        }
    }
    
    /// Check if any modifier applies to the given letter
    private func checkIfModifierApplies(to letter: String) -> Bool {
        return !getModifiersForLetter(letter).isEmpty
    }
    
    /// Generate nikkud options for a letter
    private func generateNikkudOptions(forLetter letter: String, withModifier: Bool) -> [NikkudOption] {
        guard let config = config,
              let diacritics = config.getDiacritics(for: currentKeyboardId) else {
            debugLog("🔍 generateNikkudOptions: No config or diacritics!")
            return []
        }
        
        let keyboardId = currentKeyboardId ?? ""
        let settings = config.diacriticsSettings?[keyboardId]
        let hidden = settings?.hidden ?? []
        let applicableModifiers = getModifiersForLetter(letter)
        
        debugLog("🔍 generateNikkudOptions for '\(letter)':")
        debugLog("   keyboardId: '\(keyboardId)'")
        debugLog("   hidden items: \(hidden)")
        
        var result: [NikkudOption] = []
        
        for item in diacritics.items {
            // Skip if hidden
            if hidden.contains(item.id) { continue }
            
            // Skip if not applicable
            if let onlyFor = item.onlyFor, !onlyFor.contains(letter) { continue }
            if let excludeFor = item.excludeFor, excludeFor.contains(letter) { continue }
            
            let isReplacement = item.isReplacement ?? false
            var value: String = isReplacement ? item.mark : letter
            
            // Apply active modifiers
            if !isReplacement {
                for modifier in applicableModifiers {
                    guard let activeState = modifierStates[modifier.id], activeState != nil else {
                        continue
                    }
                    
                    if modifier.isMultiOption {
                        if let selectedOptionId = activeState,
                           let selectedOption = modifier.options?.first(where: { $0.id == selectedOptionId }) {
                            value += selectedOption.mark
                        }
                    } else if let mark = modifier.mark {
                        value += mark
                    }
                }
                
                // Add the diacritic mark
                value += item.mark
            }
            
            result.append(NikkudOption(value: value, caption: value, sValue: nil, sCaption: nil))
        }
        
        return result
    }
    
    // MARK: - Actions
    
    @objc private func nikkudOptionTapped(_ sender: UIButton) {
        print("🎯 Nikkud option tapped: \(sender.accessibilityIdentifier ?? "nil")")
        debugLog("🎯 Nikkud option tapped: \(sender.accessibilityIdentifier ?? "nil")")
        if let value = sender.accessibilityIdentifier {
            print("🎯 Calling onNikkudSelected callback with value: '\(value)'")
            onNikkudSelected?(value)
        } else {
            print("🎯 ⚠️ No value found in accessibilityIdentifier!")
        }
        dismiss()
    }
    
    @objc private func dismissPicker() {
        dismiss()
    }
    
    @objc private func modifierToggleTapped(_ sender: UIButton) {
        let modifierId = sender.accessibilityHint ?? "dagesh"
        let currentState = modifierStates[modifierId] ?? nil
        
        debugLog("🔄 Modifier toggle tapped: '\(modifierId)', was: \(String(describing: currentState))")
        
        if currentState != nil {
            modifierStates[modifierId] = nil
        } else {
            modifierStates[modifierId] = ""
        }
        
        // Refresh picker
        if !currentLetter.isEmpty, let container = container {
            showPickerInternal(forLetter: currentLetter, anchorView: container)
        }
    }
    
    @objc private func multiOptionModifierTapped(_ sender: UIButton) {
        guard let hint = sender.accessibilityHint else { return }
        
        let parts = hint.split(separator: ":")
        guard parts.count == 2 else { return }
        
        let modifierId = String(parts[0])
        let optionId = String(parts[1])
        
        debugLog("🔄 Multi-option modifier tapped: '\(modifierId)' option: '\(optionId)'")
        
        if optionId == "none" {
            modifierStates[modifierId] = nil
        } else {
            modifierStates[modifierId] = optionId
        }
        
        // Refresh picker
        if !currentLetter.isEmpty, let container = container {
            showPickerInternal(forLetter: currentLetter, anchorView: container)
        }
    }
}