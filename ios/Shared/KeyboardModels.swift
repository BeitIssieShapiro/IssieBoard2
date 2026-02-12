import Foundation
import UIKit

// MARK: - Keyboard Configuration Models

struct KeyboardConfig: Codable {
    let backgroundColor: String?
    let keysBgColor: String?  // Default background color for keys
    let textColor: String?    // Default text color for keys
    let defaultKeyset: String?
    let keysets: [Keyset]
    let groups: [Group]?
    let keyboards: [String]?
    let defaultKeyboard: String?
    let diacritics: DiacriticsDefinition?  // Backward compatibility
    let allDiacritics: [String: DiacriticsDefinition]?  // Per-keyboard diacritics definitions
    let diacriticsSettings: [String: DiacriticsSettings]?  // Per-keyboard settings from profile
    let wordSuggestionsEnabled: Bool?  // Enable/disable word suggestions (default: true)
    let autoCorrectEnabled: Bool?  // Enable/disable auto-correct on space (default: false)
    let fontName: String?  // Custom font name to use for character keys (e.g., 'DanaYadAlefAlefAlef-Normal')
    let fontSize: Double?  // Global font size for all keys (default varies by platform). Individual keys can override this.
    let keyHeight: Double?  // Custom key row height in points (default: 54 for iPhone, 74 for iPad keyboard extension)

    enum CodingKeys: String, CodingKey {
        case backgroundColor
        case keysBgColor
        case textColor
        case defaultKeyset
        case keysets
        case groups
        case keyboards
        case defaultKeyboard
        case diacritics
        case allDiacritics
        case diacriticsSettings
        case wordSuggestionsEnabled
        case autoCorrectEnabled
        case fontName
        case fontSize
        case keyHeight
    }
    
    /// Check if word suggestions are enabled (defaults to true if not specified)
    var isWordSuggestionsEnabled: Bool {
        return wordSuggestionsEnabled ?? true
    }
    
    /// Check if auto-correct is enabled (defaults to false if not specified)
    var isAutoCorrectEnabled: Bool {
        return autoCorrectEnabled ?? false
    }
    
    /// Get diacritics for a specific keyboard ID
    func getDiacritics(for keyboardId: String?) -> DiacriticsDefinition? {
        guard let keyboardId = keyboardId else {
            return diacritics  // Fallback to legacy field
        }
        return allDiacritics?[keyboardId] ?? diacritics
    }
}

struct Keyset: Codable {
    let id: String
    let rows: [KeyRow]
}

struct KeyRow: Codable {
    let keys: [Key]
}

/// Screen size types for showOn property
enum ScreenSizeType: String, Codable {
    case mobile = "mobile"           // iPhone-size screens
    case largeScreen = "large-screen" // iPad-size screens
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
    let fontSize: Double?  // Custom font size for this key (overrides default)
    let label: String?
    let keysetValue: String?
    let returnKeysetValue: String?
    let returnKeysetLabel: String?
    let nikkud: [NikkudOption]?
    let showOn: [ScreenSizeType]?  // Filter key visibility by screen size
    let flex: Bool?  // If true, this key absorbs extra width from hidden keys in the same row
    let showForField: [String]?  // Filter key visibility by input field type (e.g., "email", "url")
    
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
        case fontSize
        case label
        case keysetValue
        case returnKeysetValue
        case returnKeysetLabel
        case nikkud
        case showOn
        case flex
        case showForField
    }
    
    /// Check if the key should be shown on the current screen size
    /// - Parameter isLargeScreen: true for iPad, false for iPhone
    /// - Returns: true if key should be shown
    func shouldShow(isLargeScreen: Bool) -> Bool {
        guard let showOn = showOn, !showOn.isEmpty else {
            return true  // No filter = show everywhere
        }
        
        if isLargeScreen {
            return showOn.contains(.largeScreen)
        } else {
            return showOn.contains(.mobile)
        }
    }
    
    /// Check if the key should be shown for the current field type
    /// - Parameter fieldType: The input field type (e.g., "email", "url", "default")
    /// - Returns: true if key should be shown
    func shouldShow(forFieldType fieldType: String?) -> Bool {
        guard let showForField = showForField, !showForField.isEmpty else {
            return true  // No filter = show for all field types
        }
        
        guard let fieldType = fieldType else {
            return false  // Has filter but no field type = don't show
        }
        
        return showForField.contains(fieldType)
    }
}

struct NikkudOption: Codable {
    let value: String
    let caption: String?
    let sValue: String?
    let sCaption: String?
}

// MARK: - Diacritics System (New)

/// Individual diacritic mark definition
struct DiacriticItem: Codable {
    let id: String           // Unique identifier (e.g., "kamatz", "patach")
    let mark: String         // Unicode combining mark or replacement character
    let name: String         // Display name in the keyboard's language
    let onlyFor: [String]?   // If present, only show for these letters
    let excludeFor: [String]? // If present, don't show for these letters
    let isReplacement: Bool? // If true, replaces the letter entirely
    
    enum CodingKeys: String, CodingKey {
        case id, mark, name, onlyFor, excludeFor, isReplacement
    }
}

/// Option for a multi-option modifier (like shin/sin)
struct DiacriticModifierOption: Codable {
    let id: String           // Unique identifier (e.g., "shin", "sin")
    let mark: String         // Unicode combining mark
    let name: String         // Display name
    
    enum CodingKeys: String, CodingKey {
        case id, mark, name
    }
}

/// Modifier that can combine with other diacritics (like dagesh or shadda)
struct DiacriticModifier: Codable {
    let id: String            // Unique identifier (e.g., "dagesh", "shinSin")
    let mark: String?         // Unicode combining mark (for simple toggle, nil for multi-option)
    let name: String          // Display name
    let appliesTo: [String]?  // If present, only applies to these letters
    let excludeFor: [String]? // If present, doesn't apply to these letters
    let options: [DiacriticModifierOption]?  // If present, this is a multi-option modifier
    
    enum CodingKeys: String, CodingKey {
        case id, mark, name, appliesTo, excludeFor, options
    }
    
    /// Check if this modifier has options (multi-option) vs simple toggle
    var isMultiOption: Bool {
        return options != nil && !(options?.isEmpty ?? true)
    }
}

/// Diacritics definition for a keyboard
struct DiacriticsDefinition: Codable {
    let appliesTo: [String]?             // Characters that should trigger diacritics popup
    let items: [DiacriticItem]
    let modifier: DiacriticModifier?     // Backward compatibility - single modifier
    let modifiers: [DiacriticModifier]?  // New - array of modifiers
    
    enum CodingKeys: String, CodingKey {
        case appliesTo, items, modifier, modifiers
    }
    
    /// Check if diacritics apply to a given character
    func appliesTo(character: String) -> Bool {
        guard let validChars = appliesTo else {
            return false  // If appliesTo is not defined, diacritics don't apply to any character
        }
        return validChars.contains(character)
    }
    
    /// Get all applicable modifiers (prefers modifiers array, falls back to single modifier)
    func getModifiers() -> [DiacriticModifier] {
        if let mods = modifiers, !mods.isEmpty {
            return mods
        }
        if let mod = modifier {
            return [mod]
        }
        return []
    }
    
    /// Get modifiers that apply to a specific letter
    func getModifiers(for letter: String) -> [DiacriticModifier] {
        return getModifiers().filter { modifier in
            if let appliesTo = modifier.appliesTo {
                return appliesTo.contains(letter)
            }
            if let excludeFor = modifier.excludeFor {
                return !excludeFor.contains(letter)
            }
            return true
        }
    }
}

/// Per-keyboard diacritics settings in profile
struct DiacriticsSettings: Codable {
    let hidden: [String]?             // Array of diacritic IDs to hide
    let disabledModifiers: [String]?  // Array of modifier IDs to disable
    let disabled: Bool?               // If true, completely disable nikkud for this keyboard (hide nikkud key)
    
    enum CodingKeys: String, CodingKey {
        case hidden, disabledModifiers, disabled
    }
    
    /// Check if a specific modifier is enabled
    func isModifierEnabled(_ modifierId: String) -> Bool {
        guard let disabled = disabledModifiers else { return true }
        return !disabled.contains(modifierId)
    }
    
    /// Check if diacritics are completely disabled for this keyboard
    var isDisabled: Bool {
        return disabled ?? false
    }
}

/// Generated diacritic option for display
struct GeneratedDiacriticOption {
    let id: String
    let value: String
    let name: String
}

struct Group: Codable {
    let items: [String]
    let template: GroupTemplate
}

/// Visibility mode for style groups
enum VisibilityMode: String, Codable {
    case `default` = "default"   // No effect on visibility
    case hide = "hide"           // Hide the selected keys
    case showOnly = "showOnly"   // Show only the selected keys (hide all others)
}

struct GroupTemplate: Codable {
    let width: Double?
    let offset: Double?
    let hidden: Bool?            // Backward compatibility
    let visibilityMode: VisibilityMode?  // New tri-state visibility
    let color: String?
    let bgColor: String?
    let fontSize: Double?        // Font size for keys in this group

    enum CodingKeys: String, CodingKey {
        case width, offset, hidden, visibilityMode, color, bgColor, fontSize
    }
    
    /// Get effective visibility mode (handles backward compatibility with hidden boolean)
    var effectiveVisibilityMode: VisibilityMode {
        // New visibilityMode takes precedence
        if let mode = visibilityMode {
            return mode
        }
        // Fall back to legacy hidden boolean
        if hidden == true {
            return .hide
        }
        return .default
    }
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
    let fontSize: Double?  // Custom font size (nil = use default)
    let label: String
    let keysetValue: String
    let returnKeysetValue: String
    let returnKeysetLabel: String
    let nikkud: [NikkudOption]
    
    init(from key: Key, groups: [String: GroupTemplate], defaultTextColor: UIColor, defaultBgColor: UIColor) {
        let value = key.value ?? ""
        let keyType = key.type ?? ""
        self.value = value
        self.sValue = key.sValue ?? value
        self.caption = key.caption ?? value
        self.sCaption = key.sCaption ?? (key.sValue ?? (key.caption ?? value))
        self.type = keyType
        self.fontSize = key.fontSize  // Pass through custom font size
        self.label = key.label ?? ""
        self.keysetValue = key.keysetValue ?? ""
        self.returnKeysetValue = key.returnKeysetValue ?? ""
        self.returnKeysetLabel = key.returnKeysetLabel ?? ""
        self.nikkud = key.nikkud ?? []
        
        // Get group template if exists - check by value first, then by type for special keys
        let groupTemplate = groups[value] ?? (value.isEmpty ? groups[keyType] : nil)
        
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

// MARK: - Diacritics Generator

/// Generates diacritic options for a letter at runtime based on keyboard definition and profile settings
class DiacriticsGenerator {
    
    /// Generate diacritic options for a specific letter
    /// - Parameters:
    ///   - letter: The base letter to generate diacritics for
    ///   - diacritics: The keyboard's diacritics definition
    ///   - settings: Optional profile settings to filter diacritics
    /// - Returns: Array of generated diacritic options
    static func generateOptions(
        for letter: String,
        diacritics: DiacriticsDefinition?,
        settings: DiacriticsSettings?
    ) -> [GeneratedDiacriticOption] {
        guard let diacritics = diacritics else {
            return []
        }
        
        let hidden = settings?.hidden ?? []
        
        var result: [GeneratedDiacriticOption] = []
        
        for item in diacritics.items {
            // Skip if hidden in profile
            if hidden.contains(item.id) {
                continue
            }
            
            // Skip if not applicable to this letter (onlyFor check)
            if let onlyFor = item.onlyFor, !onlyFor.contains(letter) {
                continue
            }
            
            // Skip if excluded for this letter
            if let excludeFor = item.excludeFor, excludeFor.contains(letter) {
                continue
            }
            
            // Determine the output value
            let isReplacement = item.isReplacement ?? false
            let value = isReplacement ? item.mark : (letter + item.mark)
            
            result.append(GeneratedDiacriticOption(
                id: item.id,
                value: value,
                name: item.name
            ))
            
            // Add modifier variant if applicable (e.g., dagesh, shadda)
            // Check each modifier independently
            for modifier in diacritics.getModifiers() {
                // Skip if this modifier is disabled in settings
                guard settings?.isModifierEnabled(modifier.id) ?? true else { continue }
                
                // Skip for replacements or plain items
                guard !isReplacement, item.id != "plain" else { continue }
                
                // Check if modifier applies to this letter
                let modifierApplies: Bool
                if let appliesTo = modifier.appliesTo {
                    modifierApplies = appliesTo.contains(letter)
                } else if let excludeFor = modifier.excludeFor {
                    modifierApplies = !excludeFor.contains(letter)
                } else {
                    modifierApplies = true
                }
                
                guard modifierApplies else { continue }
                
                if let modifierMark = modifier.mark {
                    // Simple toggle modifier: add mark
                    let modifiedValue = letter + modifierMark + item.mark
                    result.append(GeneratedDiacriticOption(
                        id: "\(item.id)+\(modifier.id)",
                        value: modifiedValue,
                        name: "\(item.name) + \(modifier.name)"
                    ))
                }
            }
        }
        
        return result
    }
    
    /// Convert generated options to NikkudOption array for compatibility with existing code
    static func toNikkudOptions(_ options: [GeneratedDiacriticOption]) -> [NikkudOption] {
        return options.map { option in
            NikkudOption(
                value: option.value,
                caption: option.value,  // Use value as caption for display
                sValue: nil,
                sCaption: nil
            )
        }
    }
    
    /// Check if a letter has diacritics available (either explicit or generated)
    static func hasDiacritics(
        for letter: String,
        explicitNikkud: [NikkudOption],
        diacritics: DiacriticsDefinition?,
        settings: DiacriticsSettings?
    ) -> Bool {
        // If explicit nikkud array exists and is not empty, use that
        if !explicitNikkud.isEmpty {
            return true
        }
        
        // Otherwise, check if we can generate diacritics
        let generated = generateOptions(for: letter, diacritics: diacritics, settings: settings)
        return !generated.isEmpty
    }
    
    /// Get diacritics for a key (prefer explicit, fall back to generated)
    static func getDiacritics(
        for key: ParsedKey,
        diacritics: DiacriticsDefinition?,
        settings: DiacriticsSettings?
    ) -> [NikkudOption] {
        // If explicit nikkud array exists, use it (backward compatibility)
        if !key.nikkud.isEmpty {
            return key.nikkud
        }
        
        // Otherwise, generate from diacritics definition
        let generated = generateOptions(for: key.value, diacritics: diacritics, settings: settings)
        return toNikkudOptions(generated)
    }
}
