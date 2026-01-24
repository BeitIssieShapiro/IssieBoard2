import UIKit

/**
 * Delegate protocol for key press events
 */
protocol KeyboardRendererDelegate: AnyObject {
    func keyboardRenderer(_ renderer: KeyboardRenderer, didPressKey key: ParsedKey)
}

/**
 * Shared keyboard rendering logic for iOS
 * Used by both KeyboardViewController and KeyboardPreviewView
 */
class KeyboardRenderer {
    
    // MARK: - Properties
    
    private let isPreview: Bool
    weak var keyPressDelegate: KeyboardRendererDelegate?
    
    // State
    var shiftState: ShiftState = .inactive
    var nikkudActive: Bool = false
    
    // UI Constants
    private let rowHeightKeyboard: CGFloat = 50
    private let rowHeightPreview: CGFloat = 40
    private let keySpacing: CGFloat = 6
    private let keySpacingPreview: CGFloat = 4
    private let rowSpacing: CGFloat = 10
    private let rowSpacingPreview: CGFloat = 6
    private let keyCornerRadius: CGFloat = 5
    private let fontSize: CGFloat = 18
    private let fontSizePreview: CGFloat = 14
    private let largeFontSize: CGFloat = 24
    private let largeFontSizePreview: CGFloat = 18
    
    // MARK: - Initialization
    
    init(isPreview: Bool = false) {
        self.isPreview = isPreview
        print("🎨 KeyboardRenderer created (isPreview: \(isPreview))")
    }
    
    // MARK: - Public Rendering
    
    func renderKeyboard(
        in container: UIView,
        config: KeyboardConfig,
        currentKeysetId: String,
        editorContext: (enterVisible: Bool, enterLabel: String, enterAction: Int)?
    ) {
        print("🎨 Rendering keyboard: keyset=\(currentKeysetId), isPreview=\(isPreview)")
        
        // Clear existing views
        container.subviews.forEach { $0.removeFromSuperview() }
        
        // Set background color
        if let bgColorString = config.backgroundColor,
           let bgColor = UIColor(hexString: bgColorString) {
            container.backgroundColor = bgColor
        }
        
        // Find current keyset
        guard let keyset = config.keysets.first(where: { $0.id == currentKeysetId }) else {
            print("❌ Keyset not found: \(currentKeysetId)")
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
        let rowHeight = isPreview ? rowHeightPreview : rowHeightKeyboard
        let spacing = isPreview ? rowSpacingPreview : rowSpacing
        var currentY: CGFloat = 0
        
        for row in keyset.rows {
            let rowView = createRow(row, groups: groups, baselineWidth: baselineWidth, 
                                   availableWidth: container.bounds.width - 8,
                                   editorContext: editorContext)
            rowsContainer.addSubview(rowView)
            
            rowView.frame = CGRect(x: 4, y: currentY, width: container.bounds.width - 8, height: rowHeight)
            currentY += rowHeight + spacing
        }
        
        print("✅ Keyboard rendered: \(keyset.rows.count) rows")
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
        editorContext: (enterVisible: Bool, enterLabel: String, enterAction: Int)?
    ) -> UIView {
        let rowContainer = UIView()
        let spacing = isPreview ? keySpacingPreview : keySpacing
        let rowHeight = isPreview ? rowHeightPreview : rowHeightKeyboard
        
        var currentX: CGFloat = 0
        
        for key in row.keys {
            let parsedKey = ParsedKey(from: key, groups: groups,
                                     defaultTextColor: .black,
                                     defaultBgColor: .white)
            
            // Handle offset
            if parsedKey.offset > 0 {
                let offsetWidth = (CGFloat(parsedKey.offset) / baselineWidth) * availableWidth
                currentX += offsetWidth
            }
            
            if parsedKey.hidden {
                let hiddenWidth = (CGFloat(parsedKey.width) / baselineWidth) * availableWidth
                currentX += hiddenWidth
            } else {
                let keyWidth = (CGFloat(parsedKey.width) / baselineWidth) * availableWidth - spacing
                let button = createKeyButton(parsedKey, width: keyWidth, height: rowHeight, 
                                            editorContext: editorContext)
                rowContainer.addSubview(button)
                
                button.frame = CGRect(x: currentX, y: 0, width: keyWidth, height: rowHeight)
                currentX += keyWidth + spacing
            }
        }
        
        return rowContainer
    }
    
    private func createKeyButton(
        _ key: ParsedKey,
        width: CGFloat,
        height: CGFloat,
        editorContext: (enterVisible: Bool, enterLabel: String, enterAction: Int)?
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
        let baseFontSize: CGFloat = isLargeKey ? 
            (isPreview ? largeFontSizePreview : largeFontSize) : 
            (isPreview ? fontSizePreview : fontSize)
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
        
        keyPressDelegate?.keyboardRenderer(self, didPressKey: key)
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
}
