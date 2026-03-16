import Foundation
import CoreData

/// Migrates IssieBoard v1 templates (Core Data) to v2 profiles (UserDefaults JSON).
/// Add to the IssieBoardNG main app target ONLY — not keyboard extensions.
class V1Migration {

    // MARK: - Constants

    private static let migrationCompletedKey = "v2_migration_completed"
    private static let v1UserKey = "v1_user"
    private static let coreDataFileName = "IssieBoard.sqlite"
    private static let modelResourceName = "V1DataModel"
    private static let entityName = "ConfigSet"

    private let preferences = KeyboardPreferences()
    private let migrationTimestamp: String

    init() {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        self.migrationTimestamp = formatter.string(from: Date())
    }

    // MARK: - Public Entry Point

    /// Run the v1-to-v2 migration. Safe to call on every launch — exits early if already done.
    func migrateIfNeeded() {
        let defaults = UserDefaults(suiteName: KeyboardPreferences.appGroupIdentifier)

        // 1. Check if migration already completed
        if defaults?.bool(forKey: V1Migration.migrationCompletedKey) == true {
            print("[V1Migration] Already completed, skipping.")
            return
        }

        print("[V1Migration] Starting migration...")

        // 2. Find Core Data store
        guard let storeURL = findCoreDataStore() else {
            print("[V1Migration] No v1 Core Data store found. Fresh install.")
            defaults?.set(true, forKey: V1Migration.migrationCompletedKey)
            defaults?.synchronize()
            return
        }

        print("[V1Migration] Found store at: \(storeURL.path)")

        // 3. Load managed object model
        guard let model = loadManagedObjectModel() else {
            print("[V1Migration] ERROR: Could not load V1DataModel.")
            defaults?.set(true, forKey: V1Migration.migrationCompletedKey)
            defaults?.synchronize()
            return
        }

        // 4. Fetch all ConfigSet entities (read-only)
        let templates = fetchTemplates(storeURL: storeURL, model: model)

        if templates.isEmpty {
            print("[V1Migration] No templates found in v1 store.")
            // Still mark as v1 user since the store existed
            defaults?.set("true", forKey: V1Migration.v1UserKey)
            defaults?.set(true, forKey: V1Migration.migrationCompletedKey)
            defaults?.synchronize()
            return
        }

        print("[V1Migration] Found \(templates.count) v1 template(s).")

        // 5. Migrate each template
        var savedList: [[String: Any]] = []
        var activeProfiles: [String: String] = [:] // language -> profileId
        var profileIndex = 0

        for template in templates {
            let parsed = parseTemplate(template)
            let languages = resolveLanguages(parsed.languagesRaw)
            let hasAtSuffix = parsed.languagesRaw.hasSuffix("@")

            for lang in languages {
                let profileId = "v1_migrated_\(profileIndex)_\(lang)"
                let keyboardId = buildKeyboardId(language: lang, hasAtSuffix: hasAtSuffix)

                // Build profile def
                let profileDef = buildProfileDef(
                    id: profileId,
                    name: parsed.name,
                    language: lang,
                    keyboardId: keyboardId,
                    backgroundColor: parsed.backgroundColor,
                    keysBgColor: parsed.keysBgColor,
                    textColor: parsed.textColor
                )

                // Build style groups
                let styleGroups = buildStyleGroups(
                    profileId: profileId,
                    language: lang,
                    parsed: parsed
                )

                // Write profile def via KeyboardPreferences
                if let json = serializeJSON(profileDef) {
                    preferences.setProfileJSON(json, forKey: "profile_def_\(profileId)")
                }

                // Write style groups via KeyboardPreferences
                if let json = serializeJSON(styleGroups) {
                    preferences.setProfileJSON(json, forKey: "\(profileId)_styleGroups")
                }

                // Add to saved list
                savedList.append([
                    "id": profileId,
                    "name": parsed.name,
                    "language": lang
                ])

                // Track first profile per language as active
                if activeProfiles[lang] == nil {
                    activeProfiles[lang] = profileId
                }

                profileIndex += 1
            }
        }

        // 6. Write saved list
        if let json = serializeJSON(savedList) {
            preferences.setProfileJSON(json, forKey: "saved_list")
        }

        // 7. Set active profiles per language
        for (lang, profileId) in activeProfiles {
            preferences.setProfileJSON(profileId, forKey: "active_profile_issieboard_\(lang)")
        }

        // 8. Set migration flags (direct UserDefaults, not KeyboardPreferences)
        defaults?.set("true", forKey: V1Migration.v1UserKey)
        defaults?.set(true, forKey: V1Migration.migrationCompletedKey)
        defaults?.synchronize()

        print("[V1Migration] Migration complete. Migrated \(profileIndex) profile(s) from \(templates.count) template(s).")
    }

    // MARK: - Core Data Discovery

    private func findCoreDataStore() -> URL? {
        let fileManager = FileManager.default

        // Check Documents directory
        if let documentsDir = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first {
            let documentsURL = documentsDir.appendingPathComponent(V1Migration.coreDataFileName)
            if fileManager.fileExists(atPath: documentsURL.path) {
                return documentsURL
            }
        }

        // Check Application Support directory
        if let appSupportDir = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first {
            let appSupportURL = appSupportDir.appendingPathComponent(V1Migration.coreDataFileName)
            if fileManager.fileExists(atPath: appSupportURL.path) {
                return appSupportURL
            }
        }

        return nil
    }

    private func loadManagedObjectModel() -> NSManagedObjectModel? {
        // Look for the compiled model in the main bundle
        guard let modelURL = Bundle.main.url(forResource: V1Migration.modelResourceName, withExtension: "momd") else {
            print("[V1Migration] Could not find \(V1Migration.modelResourceName).momd in bundle.")
            return nil
        }
        return NSManagedObjectModel(contentsOf: modelURL)
    }

    private func fetchTemplates(storeURL: URL, model: NSManagedObjectModel) -> [NSManagedObject] {
        let coordinator = NSPersistentStoreCoordinator(managedObjectModel: model)

        let options: [String: Any] = [
            NSReadOnlyPersistentStoreOption: true,
            NSMigratePersistentStoresAutomaticallyOption: false,
            NSInferMappingModelAutomaticallyOption: false
        ]

        do {
            try coordinator.addPersistentStore(
                ofType: NSSQLiteStoreType,
                configurationName: nil,
                at: storeURL,
                options: options
            )
        } catch {
            print("[V1Migration] ERROR opening Core Data store: \(error)")
            return []
        }

        let context = NSManagedObjectContext(concurrencyType: .mainQueueConcurrencyType)
        context.persistentStoreCoordinator = coordinator

        let fetchRequest = NSFetchRequest<NSManagedObject>(entityName: V1Migration.entityName)

        do {
            return try context.fetch(fetchRequest)
        } catch {
            print("[V1Migration] ERROR fetching ConfigSet: \(error)")
            return []
        }
    }

    // MARK: - Template Parsing

    struct ParsedTemplate {
        let name: String
        let languagesRaw: String
        let backgroundColor: String
        let keysBgColor: String
        let textColor: String
        let charset1KeysColor: String?
        let charset1TextColor: String?
        let charset2KeysColor: String?
        let charset2TextColor: String?
        let charset2Alpha: Double
        let charset3KeysColor: String?
        let charset3TextColor: String?
        let spaceColor: String?
        let backspaceColor: String?
        let enterColor: String?
        let otherKeysColor: String?
        let specialKeysText: String?
        let specialKeysColor: String?
        let specialKeysTextColor: String?
        let rowOrColumn: String?
        let visibleKeys: String?
    }

    private func parseTemplate(_ object: NSManagedObject) -> ParsedTemplate {
        let name = stringAttr(object, "configurationName") ?? "Unnamed"
        let languagesRaw = stringAttr(object, "iSSIE_KEYBOARD_LANGUAGES") ?? "HE"

        let bgColorRaw = stringAttr(object, "iSSIE_KEYBOARD_BACKGROUND_COLOR")
        let keysColorRaw = stringAttr(object, "iSSIE_KEYBOARD_KEYS_COLOR")
        let textColorRaw = stringAttr(object, "iSSIE_KEYBOARD_TEXT_COLOR")

        let charset2KeysRaw = stringAttr(object, "iSSIE_KEYBOARD_CHARSET2_KEYS_COLOR")
        var charset2Alpha: Double = 1.0
        if let raw = charset2KeysRaw {
            charset2Alpha = extractAlpha(raw)
        }

        return ParsedTemplate(
            name: name,
            languagesRaw: languagesRaw,
            backgroundColor: rgbaToHex(bgColorRaw) ?? "#FFFFFF",
            keysBgColor: rgbaToHex(keysColorRaw) ?? "#D1D5DB",
            textColor: rgbaToHex(textColorRaw) ?? "#000000",
            charset1KeysColor: rgbaToHex(stringAttr(object, "iSSIE_KEYBOARD_CHARSET1_KEYS_COLOR")),
            charset1TextColor: rgbaToHex(stringAttr(object, "iSSIE_KEYBOARD_CHARSET1_TEXT_COLOR")),
            charset2KeysColor: rgbaToHex(charset2KeysRaw),
            charset2TextColor: rgbaToHex(stringAttr(object, "iSSIE_KEYBOARD_CHARSET2_TEXT_COLOR")),
            charset2Alpha: charset2Alpha,
            charset3KeysColor: rgbaToHex(stringAttr(object, "iSSIE_KEYBOARD_CHARSET3_KEYS_COLOR")),
            charset3TextColor: rgbaToHex(stringAttr(object, "iSSIE_KEYBOARD_CHARSET3_TEXT_COLOR")),
            spaceColor: rgbaToHex(stringAttr(object, "iSSIE_KEYBOARD_SPACE_COLOR")),
            backspaceColor: rgbaToHex(stringAttr(object, "iSSIE_KEYBOARD_BACKSPACE_COLOR")),
            enterColor: rgbaToHex(stringAttr(object, "iSSIE_KEYBOARD_ENTER_COLOR")),
            otherKeysColor: rgbaToHex(stringAttr(object, "iSSIE_KEYBOARD_OTHERDEFAULTKEYS_COLOR")),
            specialKeysText: stringAttr(object, "iSSIE_KEYBOARD_SPECIAL_KEYS_TEXT"),
            specialKeysColor: rgbaToHex(stringAttr(object, "iSSIE_KEYBOARD_SPECIAL_KEYS_COLOR")),
            specialKeysTextColor: rgbaToHex(stringAttr(object, "iSSIE_KEYBOARD_SPECIAL_KEYS_TEXT_COLOR")),
            rowOrColumn: stringAttr(object, "iSSIE_KEYBOARD_ROW_OR_COLUMN"),
            visibleKeys: stringAttr(object, "iSSIE_KEYBOARD_VISIBLE_KEYS")
        )
    }

    private func stringAttr(_ object: NSManagedObject, _ key: String) -> String? {
        return object.value(forKey: key) as? String
    }

    // MARK: - Language Resolution

    private func resolveLanguages(_ raw: String) -> [String] {
        // Strip optional "@" suffix
        let cleaned = raw.replacingOccurrences(of: "@", with: "").uppercased()

        switch cleaned {
        case "HE":    return ["he"]
        case "EN":    return ["en"]
        case "AR":    return ["ar"]
        case "BOTH":  return ["he", "en"]
        case "AR_EN": return ["ar", "en"]
        case "AR_HE": return ["ar", "he"]
        default:      return ["he"]
        }
    }

    private func buildKeyboardId(language: String, hasAtSuffix: Bool) -> String {
        // "@" suffix means ABC/alphabetical order — only affects Hebrew
        if hasAtSuffix && language == "he" {
            return "he_ordered"
        }
        return language
    }

    // MARK: - Color Conversion

    /// Converts v1 RGBA string "R.RRRR,G.GGGG,B.BBBB,A.AAAA" to v2 hex "#RRGGBB".
    /// Returns nil if the input is nil or unparseable.
    private func rgbaToHex(_ rgba: String?) -> String? {
        guard let rgba = rgba, !rgba.isEmpty else { return nil }

        let components = rgba.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        guard components.count >= 3 else { return nil }

        guard let r = Double(components[0]),
              let g = Double(components[1]),
              let b = Double(components[2]) else { return nil }

        let rInt = min(255, max(0, Int(round(r * 255.0))))
        let gInt = min(255, max(0, Int(round(g * 255.0))))
        let bInt = min(255, max(0, Int(round(b * 255.0))))

        return String(format: "#%02X%02X%02X", rInt, gInt, bInt)
    }

    /// Extracts the alpha component from a v1 RGBA string. Returns 1.0 if unparseable.
    private func extractAlpha(_ rgba: String) -> Double {
        let components = rgba.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        guard components.count >= 4, let a = Double(components[3]) else { return 1.0 }
        return a
    }

    // MARK: - Profile Def Builder

    private func buildProfileDef(
        id: String,
        name: String,
        language: String,
        keyboardId: String,
        backgroundColor: String,
        keysBgColor: String,
        textColor: String
    ) -> [String: Any] {
        return [
            "id": id,
            "name": name,
            "version": "1.0.0",
            "language": language,
            "keyboardId": keyboardId,
            "backgroundColor": backgroundColor,
            "keysBgColor": keysBgColor,
            "textColor": textColor,
            "wordSuggestionsEnabled": true,
            "settingsButtonEnabled": true
        ]
    }

    // MARK: - Style Groups Builder

    private func buildStyleGroups(
        profileId: String,
        language: String,
        parsed: ParsedTemplate
    ) -> [[String: Any]] {
        var groups: [[String: Any]] = []
        var counter = 0

        // Determine division mode
        let isByRows = (parsed.rowOrColumn ?? "By Rows") == "By Rows"

        // Charset group info
        let charsetGroupDefs = buildCharsetGroupDefs(language: language, isByRows: isByRows)

        // Charset 1
        if let bgColor = parsed.charset1KeysColor, let textColor = parsed.charset1TextColor {
            groups.append(makeGroup(
                profileId: profileId,
                counter: &counter,
                name: charsetGroupDefs[0].name,
                members: charsetGroupDefs[0].members,
                bgColor: bgColor,
                textColor: textColor,
                active: true
            ))
        }

        // Charset 2 — alpha == 0 means 2-color mode (inactive)
        if let bgColor = parsed.charset2KeysColor, let textColor = parsed.charset2TextColor {
            let isActive = parsed.charset2Alpha > 0
            groups.append(makeGroup(
                profileId: profileId,
                counter: &counter,
                name: charsetGroupDefs[1].name,
                members: charsetGroupDefs[1].members,
                bgColor: bgColor,
                textColor: textColor,
                active: isActive
            ))
        }

        // Charset 3
        if let bgColor = parsed.charset3KeysColor, let textColor = parsed.charset3TextColor {
            groups.append(makeGroup(
                profileId: profileId,
                counter: &counter,
                name: charsetGroupDefs[2].name,
                members: charsetGroupDefs[2].members,
                bgColor: bgColor,
                textColor: textColor,
                active: true
            ))
        }

        // Action key groups
        if let color = parsed.spaceColor {
            groups.append(makeGroup(
                profileId: profileId,
                counter: &counter,
                name: localizedActionKeyName("space", language: language),
                members: ["space"],
                bgColor: color,
                textColor: nil,
                active: true
            ))
        }

        if let color = parsed.backspaceColor {
            groups.append(makeGroup(
                profileId: profileId,
                counter: &counter,
                name: localizedActionKeyName("delete", language: language),
                members: ["backspace"],
                bgColor: color,
                textColor: nil,
                active: true
            ))
        }

        if let color = parsed.enterColor {
            groups.append(makeGroup(
                profileId: profileId,
                counter: &counter,
                name: localizedActionKeyName("enter", language: language),
                members: ["enter"],
                bgColor: color,
                textColor: nil,
                active: true
            ))
        }

        if let color = parsed.otherKeysColor {
            groups.append(makeGroup(
                profileId: profileId,
                counter: &counter,
                name: localizedActionKeyName("other", language: language),
                members: ["keyset", "next-keyboard", "settings", "close"],
                bgColor: color,
                textColor: nil,
                active: true
            ))
        }

        // Special keys group (highlighted characters)
        if let specialText = parsed.specialKeysText, !specialText.isEmpty,
           let specialBg = parsed.specialKeysColor {
            let members = specialText.map { String($0) }
            groups.append(makeGroup(
                profileId: profileId,
                counter: &counter,
                name: "Special Keys",
                members: members,
                bgColor: specialBg,
                textColor: parsed.specialKeysTextColor,
                active: true
            ))
        }

        // Visible keys group
        if let visibleKeys = parsed.visibleKeys, !visibleKeys.isEmpty {
            let members = visibleKeys.map { String($0) }
            groups.append(makeVisibilityGroup(
                profileId: profileId,
                counter: &counter,
                members: members
            ))
        }

        return groups
    }

    private func makeGroup(
        profileId: String,
        counter: inout Int,
        name: String,
        members: [String],
        bgColor: String,
        textColor: String?,
        active: Bool
    ) -> [String: Any] {
        let id = "v1_migration_\(profileId)_\(counter)"
        counter += 1

        var style: [String: Any] = ["bgColor": bgColor]
        if let tc = textColor {
            style["color"] = tc
        }

        return [
            "id": id,
            "name": name,
            "members": members,
            "style": style,
            "createdAt": migrationTimestamp,
            "active": active,
            "isBuiltIn": false
        ]
    }

    private func makeVisibilityGroup(
        profileId: String,
        counter: inout Int,
        members: [String]
    ) -> [String: Any] {
        let id = "v1_migration_\(profileId)_\(counter)"
        counter += 1

        return [
            "id": id,
            "name": "Visible Keys",
            "members": members,
            "style": ["visibilityMode": "showOnly"],
            "createdAt": migrationTimestamp,
            "active": true,
            "isBuiltIn": false
        ]
    }

    // MARK: - Charset Group Definitions

    private struct CharsetGroupDef {
        let name: String
        let members: [String]
    }

    private func buildCharsetGroupDefs(language: String, isByRows: Bool) -> [CharsetGroupDef] {
        if isByRows {
            return buildRowGroupDefs(language: language)
        } else {
            return buildSectionGroupDefs(language: language)
        }
    }

    private func buildRowGroupDefs(language: String) -> [CharsetGroupDef] {
        let members = presetMembers(language: language)
        let names = presetNames(language: language)
        return [
            CharsetGroupDef(name: names.topRow, members: members.topRow),
            CharsetGroupDef(name: names.midRow, members: members.midRow),
            CharsetGroupDef(name: names.bottomRow, members: members.bottomRow)
        ]
    }

    private func buildSectionGroupDefs(language: String) -> [CharsetGroupDef] {
        let members = presetMembers(language: language)
        let names = presetNames(language: language)
        let isRTL = (language == "he" || language == "ar")

        if isRTL {
            // RTL: charset1=right, charset2=mid, charset3=left
            return [
                CharsetGroupDef(name: names.rightThird, members: members.rightThird),
                CharsetGroupDef(name: names.midThird, members: members.midThird),
                CharsetGroupDef(name: names.leftThird, members: members.leftThird)
            ]
        } else {
            // LTR: charset1=left, charset2=mid, charset3=right
            return [
                CharsetGroupDef(name: names.leftThird, members: members.leftThird),
                CharsetGroupDef(name: names.midThird, members: members.midThird),
                CharsetGroupDef(name: names.rightThird, members: members.rightThird)
            ]
        }
    }

    // MARK: - Preset Members (hardcoded to match assets/predefined-rules/*.json)

    private struct PresetMembers {
        let topRow: [String]
        let midRow: [String]
        let bottomRow: [String]
        let leftThird: [String]
        let midThird: [String]
        let rightThird: [String]
    }

    private func presetMembers(language: String) -> PresetMembers {
        switch language {
        case "en":
            return PresetMembers(
                topRow: ["q","w","e","r","t","y","u","i","o","p","Q","W","E","R","T","Y","U","I","O","P"],
                midRow: ["a","s","d","f","g","h","j","k","l","A","S","D","F","G","H","J","K","L"],
                bottomRow: ["z","x","c","v","b","n","m","Z","X","C","V","B","N","M"],
                leftThird: ["q","w","e","a","s","z","x","Q","W","E","A","S","Z","X"],
                midThird: ["r","t","y","d","f","g","h","c","v","b","R","T","Y","D","F","G","H","C","V","B"],
                rightThird: ["u","i","o","p","j","k","l","n","m","U","I","O","P","J","K","L","N","M"]
            )
        case "he":
            return PresetMembers(
                topRow: ["\u{05E7}","\u{05E8}","\u{05D0}","\u{05D8}","\u{05D5}","\u{05DF}","\u{05DD}","\u{05E4}"],
                midRow: ["\u{05E9}","\u{05D3}","\u{05D2}","\u{05DB}","\u{05E2}","\u{05D9}","\u{05D7}","\u{05DC}","\u{05DA}","\u{05E3}"],
                bottomRow: ["\u{05D6}","\u{05E1}","\u{05D1}","\u{05D4}","\u{05E0}","\u{05DE}","\u{05E6}","\u{05EA}","\u{05E5}"],
                leftThird: ["\u{05E7}","\u{05E8}","\u{05D0}","\u{05E9}","\u{05D3}","\u{05D2}","\u{05DB}"],
                midThird: ["\u{05D8}","\u{05D5}","\u{05E0}","\u{05DB}","\u{05E2}","\u{05D9}","\u{05DE}","\u{05D4}"],
                rightThird: ["\u{05E4}","\u{05DD}","\u{05DF}","\u{05E3}","\u{05DA}","\u{05DC}","\u{05D7}","\u{05E5}","\u{05EA}","\u{05E6}"]
            )
        case "ar":
            return PresetMembers(
                topRow: ["\u{0636}","\u{0635}","\u{062B}","\u{0642}","\u{0641}","\u{063A}","\u{0639}","\u{0647}","\u{062E}","\u{062D}"],
                midRow: ["\u{0634}","\u{0633}","\u{064A}","\u{0628}","\u{0644}","\u{0627}","\u{062A}","\u{0646}","\u{0645}"],
                bottomRow: ["\u{0621}","\u{0624}","\u{0631}","\u{0649}","\u{0629}","\u{0648}","\u{0632}","\u{0638}"],
                leftThird: ["\u{0636}","\u{0635}","\u{062B}","\u{0634}","\u{0633}","\u{064A}","\u{0621}","\u{0624}","\u{0631}"],
                midThird: ["\u{0642}","\u{0641}","\u{063A}","\u{0639}","\u{0628}","\u{0644}","\u{0627}","\u{0649}","\u{0629}","\u{0648}"],
                rightThird: ["\u{0647}","\u{062E}","\u{062D}","\u{062A}","\u{0646}","\u{0645}","\u{0632}","\u{0638}"]
            )
        default:
            // Fallback to Hebrew
            return presetMembers(language: "he")
        }
    }

    // MARK: - Preset Names (localized per language)

    private struct PresetNames {
        let topRow: String
        let midRow: String
        let bottomRow: String
        let leftThird: String
        let midThird: String
        let rightThird: String
        let spaceKey: String
        let deleteKey: String
        let enterKey: String
        let otherKeys: String
    }

    private func presetNames(language: String) -> PresetNames {
        switch language {
        case "en":
            return PresetNames(
                topRow: "Top Row",
                midRow: "Middle Row",
                bottomRow: "Bottom Row",
                leftThird: "Left Third",
                midThird: "Middle Third",
                rightThird: "Right Third",
                spaceKey: "Space Key",
                deleteKey: "Delete Key",
                enterKey: "Enter Key",
                otherKeys: "Other Keys"
            )
        case "he":
            return PresetNames(
                topRow: "\u{05E9}\u{05D5}\u{05E8}\u{05D4} \u{05E2}\u{05DC}\u{05D9}\u{05D5}\u{05E0}\u{05D4}",
                midRow: "\u{05E9}\u{05D5}\u{05E8}\u{05D4} \u{05D0}\u{05DE}\u{05E6}\u{05E2}\u{05D9}\u{05EA}",
                bottomRow: "\u{05E9}\u{05D5}\u{05E8}\u{05D4} \u{05EA}\u{05D7}\u{05EA}\u{05D5}\u{05E0}\u{05D4}",
                leftThird: "\u{05E9}\u{05DC}\u{05D9}\u{05E9} \u{05E9}\u{05DE}\u{05D0}\u{05DC}",
                midThird: "\u{05E9}\u{05DC}\u{05D9}\u{05E9} \u{05D0}\u{05DE}\u{05E6}\u{05E2}\u{05D9}",
                rightThird: "\u{05E9}\u{05DC}\u{05D9}\u{05E9} \u{05D9}\u{05DE}\u{05D9}\u{05DF}",
                spaceKey: "\u{05DE}\u{05E7}\u{05E9} \u{05D4}\u{05E8}\u{05D5}\u{05D5}\u{05D7}",
                deleteKey: "\u{05DE}\u{05E7}\u{05E9} \u{05DE}\u{05D7}\u{05D9}\u{05E7}\u{05D4}",
                enterKey: "\u{05DE}\u{05E7}\u{05E9} \u{05D9}\u{05E8}\u{05D9}\u{05D3}\u{05EA} \u{05E9}\u{05D5}\u{05E8}\u{05D4}",
                otherKeys: "\u{05DE}\u{05E7}\u{05E9}\u{05D9}\u{05DD} \u{05E0}\u{05D5}\u{05E1}\u{05E4}\u{05D9}\u{05DD}"
            )
        case "ar":
            return PresetNames(
                topRow: "\u{0627}\u{0644}\u{0635}\u{0641} \u{0627}\u{0644}\u{0639}\u{0644}\u{0648}\u{064A}",
                midRow: "\u{0627}\u{0644}\u{0635}\u{0641} \u{0627}\u{0644}\u{0623}\u{0648}\u{0633}\u{0637}",
                bottomRow: "\u{0627}\u{0644}\u{0635}\u{0641} \u{0627}\u{0644}\u{0633}\u{0641}\u{0644}\u{064A}",
                leftThird: "\u{0627}\u{0644}\u{062B}\u{0644}\u{062B} \u{0627}\u{0644}\u{0623}\u{064A}\u{0633}\u{0631}",
                midThird: "\u{0627}\u{0644}\u{062B}\u{0644}\u{062B} \u{0627}\u{0644}\u{0623}\u{0648}\u{0633}\u{0637}",
                rightThird: "\u{0627}\u{0644}\u{062B}\u{0644}\u{062B} \u{0627}\u{0644}\u{0623}\u{064A}\u{0645}\u{0646}",
                spaceKey: "\u{0645}\u{0641}\u{062A}\u{0627}\u{062D} \u{0627}\u{0644}\u{0645}\u{0633}\u{0627}\u{0641}\u{0629}",
                deleteKey: "\u{0645}\u{0641}\u{062A}\u{0627}\u{062D} \u{0627}\u{0644}\u{062D}\u{0630}\u{0641}",
                enterKey: "\u{0645}\u{0641}\u{062A}\u{0627}\u{062D} \u{0627}\u{0644}\u{0625}\u{062F}\u{062E}\u{0627}\u{0644}",
                otherKeys: "\u{0645}\u{0641}\u{0627}\u{062A}\u{064A}\u{062D} \u{0623}\u{062E}\u{0631}\u{0649}"
            )
        default:
            return presetNames(language: "he")
        }
    }

    private func localizedActionKeyName(_ type: String, language: String) -> String {
        let names = presetNames(language: language)
        switch type {
        case "space":  return names.spaceKey
        case "delete": return names.deleteKey
        case "enter":  return names.enterKey
        case "other":  return names.otherKeys
        default:       return type
        }
    }

    // MARK: - JSON Serialization

    private func serializeJSON(_ value: Any) -> String? {
        do {
            let data: Data
            if let str = value as? String {
                // Plain string — wrap in quotes for valid JSON storage
                return str
            }
            data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
            return String(data: data, encoding: .utf8)
        } catch {
            print("[V1Migration] JSON serialization error: \(error)")
            return nil
        }
    }
}
