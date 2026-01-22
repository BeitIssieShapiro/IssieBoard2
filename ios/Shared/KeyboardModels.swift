import Foundation
import UIKit

// MARK: - Keyboard Configuration Models

struct KeyboardConfig: Codable {
    let backgroundColor: String?
    let defaultKeyset: String?
    let keysets: [Keyset]
    let groups: [Group]?
    let keyboards: [String]?
    let defaultKeyboard: String?
    
    enum CodingKeys: String, CodingKey {
        case backgroundColor
        case defaultKeyset
        case keysets
        case groups
        case keyboards
        case defaultKeyboard
    }
}

struct Keyset: Codable {
    let id: String
    let rows: [KeyRow]
}

struct KeyRow: Codable {
    let keys: [Key]
}

struct Key: Codable {
    let value: String?
    let sValue: String?
    let caption: String?
    let sCaption: String?
    let type: String?
    let width: Double?
    let offset: Double?
    let hidden: Bool?
    let color: String?
    let bgColor: String?
    let label: String?
    let keysetValue: String?
    let nikkud: [NikkudOption]?
    
    enum CodingKeys: String, CodingKey {
        case value
        case sValue
        case caption
        case sCaption
        case type
        case width
        case offset
        case hidden
        case color
        case bgColor
        case label
        case keysetValue
        case nikkud
    }
}

struct NikkudOption: Codable {
    let value: String
    let caption: String?
    let sValue: String?
    let sCaption: String?
}

struct Group: Codable {
    let items: [String]
    let template: GroupTemplate
}

struct GroupTemplate: Codable {
    let width: Double?
    let offset: Double?
    let hidden: Bool?
    let color: String?
    let bgColor: String?
}

// MARK: - Shift State

enum ShiftState {
    case inactive
    case active
    case locked
    
    func toggle() -> ShiftState {
        switch self {
        case .inactive: return .active
        case .active: return .inactive
        case .locked: return .inactive
        }
    }
    
    func lock() -> ShiftState {
        return .locked
    }
    
    func isActive() -> Bool {
        return self != .inactive
    }
}

// MARK: - Parsed Key Configuration (with resolved colors and groups)

struct ParsedKey {
    let value: String
    let sValue: String
    let caption: String
    let sCaption: String
    let type: String
    let width: Double
    let offset: Double
    let hidden: Bool
    let textColor: UIColor
    let backgroundColor: UIColor
    let label: String
    let keysetValue: String
    let nikkud: [NikkudOption]
    
    init(from key: Key, groups: [String: GroupTemplate], defaultTextColor: UIColor, defaultBgColor: UIColor) {
        let value = key.value ?? ""
        self.value = value
        self.sValue = key.sValue ?? value
        self.caption = key.caption ?? value
        self.sCaption = key.sCaption ?? (key.sValue ?? (key.caption ?? value))
        self.type = key.type ?? ""
        self.label = key.label ?? ""
        self.keysetValue = key.keysetValue ?? ""
        self.nikkud = key.nikkud ?? []
        
        // Get group template if exists
        let groupTemplate = groups[value]
        
        // Resolve width
        if let keyWidth = key.width {
            self.width = keyWidth
        } else {
            self.width = groupTemplate?.width ?? 1.0
        }
        
        // Resolve offset
        if let keyOffset = key.offset {
            self.offset = keyOffset
        } else {
            self.offset = groupTemplate?.offset ?? 0.0
        }
        
        // Resolve hidden
        if let keyHidden = key.hidden {
            self.hidden = keyHidden
        } else {
            self.hidden = groupTemplate?.hidden ?? false
        }
        
        // Resolve colors
        let textColorString = key.color ?? groupTemplate?.color
        if let colorStr = textColorString, !colorStr.isEmpty {
            self.textColor = UIColor(hexString: colorStr) ?? defaultTextColor
        } else {
            self.textColor = defaultTextColor
        }
        
        let bgColorString = key.bgColor ?? groupTemplate?.bgColor
        if let colorStr = bgColorString, !colorStr.isEmpty {
            self.backgroundColor = UIColor(hexString: colorStr) ?? defaultBgColor
        } else {
            self.backgroundColor = defaultBgColor
        }
    }
}

// MARK: - UIColor Extension for Hex Strings

extension UIColor {
    convenience init?(hexString: String) {
        var hex = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
        
        if hex.hasPrefix("#") {
            hex.remove(at: hex.startIndex)
        }
        
        guard hex.count == 6 || hex.count == 8 else {
            return nil
        }
        
        var rgbValue: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&rgbValue)
        
        let r, g, b, a: CGFloat
        if hex.count == 8 {
            r = CGFloat((rgbValue & 0xFF000000) >> 24) / 255.0
            g = CGFloat((rgbValue & 0x00FF0000) >> 16) / 255.0
            b = CGFloat((rgbValue & 0x0000FF00) >> 8) / 255.0
            a = CGFloat(rgbValue & 0x000000FF) / 255.0
        } else {
            r = CGFloat((rgbValue & 0xFF0000) >> 16) / 255.0
            g = CGFloat((rgbValue & 0x00FF00) >> 8) / 255.0
            b = CGFloat(rgbValue & 0x0000FF) / 255.0
            a = 1.0
        }
        
        self.init(red: r, green: g, blue: b, alpha: a)
    }
}
