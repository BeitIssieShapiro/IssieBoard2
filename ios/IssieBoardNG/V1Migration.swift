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

        runMigration()
    }

    /// Force re-run the migration (for testing). Clears the completed flag first.
    func forceMigrate() {
        let defaults = UserDefaults(suiteName: KeyboardPreferences.appGroupIdentifier)
        defaults?.removeObject(forKey: V1Migration.migrationCompletedKey)
        defaults?.synchronize()
        print("[V1Migration] Cleared migration flag, re-running...")
        runMigration()
    }

    private func runMigration() {
        let defaults = UserDefaults(suiteName: KeyboardPreferences.appGroupIdentifier)

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

            // Skip v1 built-in templates (e.g. "תבנית מוכנה 1 ברירת מחדל", "תבנית מוכנה 2", "תבנית מוכנה 3")
            if parsed.name.hasPrefix("תבנית מוכנה") {
                print("[V1Migration] Skipping built-in template: \(parsed.name)")
                continue
            }

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
                    keyboardId: keyboardId,
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
                    "key": profileId,
                    "name": parsed.name,
                    "language": lang,
                    "keyboardId": keyboardId
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
        // "@" suffix means ABC/alphabetical order
        if hasAtSuffix {
            return "\(language)_ordered"
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
        keyboardId: String,
        parsed: ParsedTemplate
    ) -> [[String: Any]] {
        var groups: [[String: Any]] = []
        var counter = 0

        // All letter keys for this language (used to filter cross-language chars)
        let languageKeys = allLetterKeys(language: language, keyboardId: keyboardId)

        // Determine division mode
        let isByRows = (parsed.rowOrColumn ?? "By Rows") == "By Rows"

        // Charset group info
        let charsetGroupDefs = buildCharsetGroupDefs(language: language, keyboardId: keyboardId, isByRows: isByRows)

        // Charset 1
        if let bgColor = parsed.charset1KeysColor, let textColor = parsed.charset1TextColor {
            groups.append(makeGroup(
                profileId: profileId,
                counter: &counter,
                name: charsetGroupDefs[0].name,
                members: charsetGroupDefs[0].members,
                bgColor: bgColor,
                textColor: textColor,
                active: true,
                presetId: charsetGroupDefs[0].presetId
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
                active: isActive,
                presetId: charsetGroupDefs[1].presetId
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
                active: true,
                presetId: charsetGroupDefs[2].presetId
            ))
        }

        // Action key groups
        if let color = parsed.spaceColor {
            groups.append(makeGroup(
                profileId: profileId,
                counter: &counter,
                name: localizedActionKeyName("space", language: language),
                members: [" "],
                bgColor: color,
                textColor: nil,
                active: true,
                presetId: "space-key"
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
                active: true,
                presetId: "delete-key"
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
                active: true,
                presetId: "enter-key"
            ))
        }

        if let color = parsed.otherKeysColor {
            groups.append(makeGroup(
                profileId: profileId,
                counter: &counter,
                name: localizedActionKeyName("other", language: language),
                members: ["keyset", "next-keyboard", "settings", "close", "nikkud"],
                bgColor: color,
                textColor: nil,
                active: true,
                presetId: "other-keys"
            ))
        }

        // Special keys group (highlighted characters)
        // Filter to only chars that exist on this language's keyboard.
        // Skip if the chars exactly match a preset group (row/third) — that's a v1 default, not user config.
        if let specialText = parsed.specialKeysText, !specialText.isEmpty,
           let specialBg = parsed.specialKeysColor {
            let allMembers = specialText.map { String($0) }
            let members = allMembers.filter { languageKeys.contains($0) }
            let membersSet = Set(members)
            let isPresetDefault = presetGroupSets(language: language, keyboardId: keyboardId).contains(membersSet)
            if !members.isEmpty && !isPresetDefault {
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
        }

        // Visible keys group
        // Filter to only chars on this language's keyboard.
        // If the result covers all keys, it means "show all" — skip the group entirely.
        if let visibleKeys = parsed.visibleKeys, !visibleKeys.isEmpty {
            let allMembers = visibleKeys.map { String($0) }
            let members = allMembers.filter { languageKeys.contains($0) }
            let coversAll = languageKeys.allSatisfy { members.contains($0) }
            if !coversAll && !members.isEmpty {
                groups.append(makeVisibilityGroup(
                    profileId: profileId,
                    counter: &counter,
                    members: members
                ))
            }
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
        active: Bool,
        presetId: String? = nil
    ) -> [String: Any] {
        let idSuffix = presetId ?? "\(counter)"
        let id = "v1_migration_\(profileId)_\(idSuffix)"
        counter += 1

        var style: [String: Any] = ["bgColor": bgColor]
        if let tc = textColor {
            style["color"] = tc
        }

        var result: [String: Any] = [
            "id": id,
            "name": name,
            "members": members,
            "style": style,
            "createdAt": migrationTimestamp,
            "active": active,
            "isBuiltIn": false
        ]

        if let pid = presetId {
            result["presetId"] = pid
        }

        return result
    }

    private func makeVisibilityGroup(
        profileId: String,
        counter: inout Int,
        members: [String]
    ) -> [String: Any] {
        let id = "v1_migration_\(profileId)_visible-keys"
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

    // MARK: - Predefined Rules (loaded from bundled JSON)

    private struct PredefinedRule {
        let id: String
        let name: String
        let members: [String]
        let orderedMembers: [String]?
    }

    private var rulesCache: [String: [PredefinedRule]] = [:]

    private func loadRules(language: String) -> [PredefinedRule] {
        if let cached = rulesCache[language] { return cached }

        guard let url = Bundle.main.url(forResource: "predefined_rules_\(language)", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let rulesArray = json["rules"] as? [[String: Any]] else {
            print("[V1Migration] WARNING: Could not load predefined_rules_\(language).json from bundle")
            return []
        }

        let rules = rulesArray.compactMap { dict -> PredefinedRule? in
            guard let id = dict["id"] as? String,
                  let name = dict["name"] as? String,
                  let members = dict["members"] as? [String] else { return nil }
            let orderedMembers = dict["orderedMembers"] as? [String]
            return PredefinedRule(id: id, name: name, members: members, orderedMembers: orderedMembers)
        }

        rulesCache[language] = rules
        return rules
    }

    private func findRule(language: String, id: String) -> PredefinedRule? {
        return loadRules(language: language).first { $0.id == id }
    }

    /// Resolve members for a rule, using orderedMembers when keyboardId ends with _ordered.
    private func resolveMembers(rule: PredefinedRule, keyboardId: String) -> [String] {
        if keyboardId.hasSuffix("_ordered"), let ordered = rule.orderedMembers {
            return ordered
        }
        return rule.members
    }

    // MARK: - Charset Group Definitions

    private struct CharsetGroupDef {
        let name: String
        let members: [String]
        let presetId: String  // e.g. "top-row", "right-third" — must match classicProfileBridge patterns
    }

    private func buildCharsetGroupDefs(language: String, keyboardId: String, isByRows: Bool) -> [CharsetGroupDef] {
        if isByRows {
            return buildRowGroupDefs(language: language, keyboardId: keyboardId)
        } else {
            return buildSectionGroupDefs(language: language, keyboardId: keyboardId)
        }
    }

    private func buildRowGroupDefs(language: String, keyboardId: String) -> [CharsetGroupDef] {
        let ids = ["top-row", "mid-row", "bottom-row"]
        return ids.compactMap { id in
            guard let rule = findRule(language: language, id: id) else { return nil }
            return CharsetGroupDef(name: rule.name, members: resolveMembers(rule: rule, keyboardId: keyboardId), presetId: id)
        }
    }

    private func buildSectionGroupDefs(language: String, keyboardId: String) -> [CharsetGroupDef] {
        let isRTL = (language == "he" || language == "ar")
        let orderedIds = isRTL
            ? ["right-third", "mid-third", "left-third"]   // RTL: charset1=right, charset2=mid, charset3=left
            : ["left-third", "mid-third", "right-third"]   // LTR: charset1=left, charset2=mid, charset3=right

        return orderedIds.compactMap { id in
            guard let rule = findRule(language: language, id: id) else { return nil }
            return CharsetGroupDef(name: rule.name, members: resolveMembers(rule: rule, keyboardId: keyboardId), presetId: id)
        }
    }

    /// All unique letter keys for a given language (union of all row rules).
    private func allLetterKeys(language: String, keyboardId: String) -> Set<String> {
        var keys = Set<String>()
        for id in ["top-row", "mid-row", "bottom-row"] {
            if let rule = findRule(language: language, id: id) {
                for k in resolveMembers(rule: rule, keyboardId: keyboardId) { keys.insert(k) }
            }
        }
        return keys
    }

    /// All preset group member sets (rows and thirds) for detecting v1 defaults.
    private func presetGroupSets(language: String, keyboardId: String) -> [Set<String>] {
        let ids = ["top-row", "mid-row", "bottom-row", "left-third", "mid-third", "right-third"]
        return ids.compactMap { id in
            guard let rule = findRule(language: language, id: id) else { return nil }
            return Set(resolveMembers(rule: rule, keyboardId: keyboardId))
        }
    }

    private func localizedActionKeyName(_ type: String, language: String) -> String {
        let ruleId: String
        switch type {
        case "space":  ruleId = "space-key"
        case "delete": ruleId = "delete-key"
        case "enter":  ruleId = "enter-key"
        case "other":  ruleId = "other-keys"
        default:       return type
        }
        return findRule(language: language, id: ruleId)?.name ?? type
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
