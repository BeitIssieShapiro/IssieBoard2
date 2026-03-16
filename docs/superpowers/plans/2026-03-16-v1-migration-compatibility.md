# V1 Migration & Compatibility Layer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable seamless v1-to-v2 upgrade by migrating templates, adding missing presets, and providing a classic settings UI for existing users.

**Architecture:** Native Swift migration reads v1 Core Data on first launch and writes v2 profiles via KeyboardPreferences. A new React Native ClassicEditorScreen provides the v1-style master-detail settings UI, backed entirely by the v2 profile model. AppNavigator detects v1 users and routes them to the classic screen by default.

**Tech Stack:** Swift (Core Data, UserDefaults), React Native / TypeScript, existing KeyboardPreferences bridge

**Spec:** `docs/superpowers/specs/2026-03-16-v1-migration-compatibility-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|---|---|
| `ios/Shared/V1Migration.swift` | One-time migration: reads v1 Core Data, converts to v2 profiles, writes via KeyboardPreferences. **Add to IssieBoardNG main app target only** (not keyboard extension targets) to avoid bloating extensions with CoreData. |
| `ios/IssieBoardNG/V1DataModel.xcdatamodeld/` | Copy of v1's Core Data model (needed to read the old SQLite store) |
| `src/screens/ClassicEditorScreen.tsx` | Top-level classic editor with sections list + detail navigation |
| `src/screens/classic/ClassicSectionsList.tsx` | The scrollable settings table (master view) |
| `src/screens/classic/ClassicDetailView.tsx` | Generic detail view: back button + show keyboard toggle + control slot |
| `src/screens/classic/ClassicColorPicker.tsx` | v1-style color grid (~30 circles) for detail view |
| `src/screens/classic/classicProfileBridge.ts` | Logic to read/write v2 profile model from classic UI controls |

### Modified Files

| File | Change |
|---|---|
| `assets/predefined-rules/en.json` | Add 4 action key presets |
| `assets/predefined-rules/he.json` | Add 4 action key presets |
| `assets/predefined-rules/ar.json` | Add 4 action key presets |
| `ios/Shared/KeyboardPreferences.swift` | Update App Group identifier to `group.com.issieshapiro.Issieboard` |
| `ios/IssieBoardNG/IssieBoardNG.entitlements` | Update App Group |
| `ios/IssieBoardEn/IssieBoardEn.entitlements` | Update App Group |
| `ios/IssieBoardHe/IssieBoardHe.entitlements` | Update App Group |
| `ios/IssieBoardAr/IssieBoardAr.entitlements` | Update App Group |
| `ios/IssieBoardNG/AppDelegate.swift` | Call V1Migration on launch, before RN starts |
| `src/AppNavigator.tsx` | Add v1_user detection, classic/advanced routing |
| `src/screens/EditorScreen.tsx` | Add "Classic View" toggle button for v1 users |

---

## Chunk 1: Preset Additions + App Group Update

These are small, independent changes that must land first since the migration depends on the preset IDs.

### Task 1: Add action key presets to English predefined rules

**Files:**
- Modify: `assets/predefined-rules/en.json`

- [ ] **Step 1: Read the current file**

Open `assets/predefined-rules/en.json` and understand the existing structure. It has a `rules` array with entries like `{ id, name, description, members, style }`.

- [ ] **Step 2: Add 4 action key presets**

Append these 4 entries to the `rules` array:

```json
{
  "id": "space-key",
  "name": "Space Key",
  "description": "Space bar key",
  "members": ["space"],
  "style": { "bgColor": "#4DD0E1", "color": "#000000" }
},
{
  "id": "delete-key",
  "name": "Delete Key",
  "description": "Backspace/delete key",
  "members": ["backspace"],
  "style": { "bgColor": "#4DD0E1", "color": "#000000" }
},
{
  "id": "enter-key",
  "name": "Enter Key",
  "description": "Enter/return key",
  "members": ["enter"],
  "style": { "bgColor": "#4DD0E1", "color": "#000000" }
},
{
  "id": "other-keys",
  "name": "Other Keys",
  "description": "Mode change, globe, dismiss keys",
  "members": ["keyset", "next-keyboard", "settings", "close"],
  "style": { "bgColor": "#4DD0E1", "color": "#000000" }
}
```

- [ ] **Step 3: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('assets/predefined-rules/en.json','utf8')); console.log('OK')"`

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add assets/predefined-rules/en.json
git commit -m "feat: add action key presets to English predefined rules"
```

### Task 2: Add action key presets to Hebrew predefined rules

**Files:**
- Modify: `assets/predefined-rules/he.json`

- [ ] **Step 1: Add 4 action key presets with Hebrew names**

Append to the `rules` array (same members as English, Hebrew names):

```json
{
  "id": "space-key",
  "name": "מקש הרווח",
  "description": "מקש הרווח",
  "members": ["space"],
  "style": { "bgColor": "#4DD0E1", "color": "#000000" }
},
{
  "id": "delete-key",
  "name": "מקש מחיקה",
  "description": "מקש מחיקה",
  "members": ["backspace"],
  "style": { "bgColor": "#4DD0E1", "color": "#000000" }
},
{
  "id": "enter-key",
  "name": "מקש ירידת שורה",
  "description": "מקש ירידת שורה",
  "members": ["enter"],
  "style": { "bgColor": "#4DD0E1", "color": "#000000" }
},
{
  "id": "other-keys",
  "name": "מקשים נוספים",
  "description": "מקשים לשינוי מצב, גלובוס, סגירה",
  "members": ["keyset", "next-keyboard", "settings", "close"],
  "style": { "bgColor": "#4DD0E1", "color": "#000000" }
}
```

- [ ] **Step 2: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('assets/predefined-rules/he.json','utf8')); console.log('OK')"`

- [ ] **Step 3: Commit**

```bash
git add assets/predefined-rules/he.json
git commit -m "feat: add action key presets to Hebrew predefined rules"
```

### Task 3: Add action key presets to Arabic predefined rules

**Files:**
- Modify: `assets/predefined-rules/ar.json`

- [ ] **Step 1: Add 4 action key presets with Arabic names**

Append to the `rules` array:

```json
{
  "id": "space-key",
  "name": "مفتاح المسافة",
  "description": "مفتاح المسافة",
  "members": ["space"],
  "style": { "bgColor": "#4DD0E1", "color": "#000000" }
},
{
  "id": "delete-key",
  "name": "مفتاح الحذف",
  "description": "مفتاح الحذف",
  "members": ["backspace"],
  "style": { "bgColor": "#4DD0E1", "color": "#000000" }
},
{
  "id": "enter-key",
  "name": "مفتاح الإدخال",
  "description": "مفتاح الإدخال",
  "members": ["enter"],
  "style": { "bgColor": "#4DD0E1", "color": "#000000" }
},
{
  "id": "other-keys",
  "name": "مفاتيح أخرى",
  "description": "مفاتيح تغيير الوضع والكرة الأرضية والإغلاق",
  "members": ["keyset", "next-keyboard", "settings", "close"],
  "style": { "bgColor": "#4DD0E1", "color": "#000000" }
}
```

- [ ] **Step 2: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('assets/predefined-rules/ar.json','utf8')); console.log('OK')"`

- [ ] **Step 3: Commit**

```bash
git add assets/predefined-rules/ar.json
git commit -m "feat: add action key presets to Arabic predefined rules"
```

### Task 4: Update App Group identifier

**Files:**
- Modify: `ios/Shared/KeyboardPreferences.swift`
- Modify: `ios/IssieBoardNG/IssieBoardNG.entitlements`
- Modify: `ios/IssieBoardEn/IssieBoardEn.entitlements`
- Modify: `ios/IssieBoardHe/IssieBoardHe.entitlements`
- Modify: `ios/IssieBoardAr/IssieBoardAr.entitlements`

- [ ] **Step 1: Update KeyboardPreferences.swift App Group**

In `ios/Shared/KeyboardPreferences.swift`, change the `appGroupIdentifier`:

```swift
// Before:
static let appGroupIdentifier = //"group.com.issieshapiro.issieboard"
    "group.org.issieshapiro.test"

// After:
static let appGroupIdentifier = "group.com.issieshapiro.Issieboard"
```

Note the exact casing: `Issieboard` with capital I, confirmed from v1's entitlements.

- [ ] **Step 2: Update all entitlements files**

In each `.entitlements` file, replace the App Group string:

```xml
<!-- Before: -->
<string>group.org.issieshapiro.test</string>

<!-- After: -->
<string>group.com.issieshapiro.Issieboard</string>
```

Files to update:
- `ios/IssieBoardNG/IssieBoardNG.entitlements`
- `ios/IssieBoardEn/IssieBoardEn.entitlements`
- `ios/IssieBoardHe/IssieBoardHe.entitlements`
- `ios/IssieBoardAr/IssieBoardAr.entitlements`

- [ ] **Step 3: Verify no other references to old App Group**

Run: `grep -r "group.org.issieshapiro.test" ios/`

Expected: No matches (or only in documentation/comments).

- [ ] **Step 4: Commit**

```bash
git add ios/Shared/KeyboardPreferences.swift ios/IssieBoardNG/IssieBoardNG.entitlements \
  ios/IssieBoardEn/IssieBoardEn.entitlements ios/IssieBoardHe/IssieBoardHe.entitlements \
  ios/IssieBoardAr/IssieBoardAr.entitlements
git commit -m "chore: update App Group to match v1 identifier for migration"
```

---

## Chunk 2: V1 Migration (Swift)

Native migration logic that reads v1 Core Data templates and writes v2 profiles.

### Task 5: Copy v1 Core Data model to v2 project

**Files:**
- Create: `ios/IssieBoardNG/V1DataModel.xcdatamodeld/`

- [ ] **Step 1: Copy the Core Data model**

Copy the v1 Core Data model directory into the v2 project:

```bash
cp -r "../oldIssieBoard/IssieBoard.xcdatamodeld" "ios/IssieBoardNG/V1DataModel.xcdatamodeld"
```

This model file is needed so `NSManagedObjectModel` can read the old SQLite store. The model will not be used for anything else — it's read-only for migration.

- [ ] **Step 2: Add to Xcode project**

The `.xcdatamodeld` must be added to the IssieBoardNG target in Xcode. Open the Xcode project, drag `V1DataModel.xcdatamodeld` into the IssieBoardNG group, and ensure it's added to the IssieBoardNG target (not the keyboard extension targets).

- [ ] **Step 3: Commit**

```bash
git add ios/IssieBoardNG/V1DataModel.xcdatamodeld
git commit -m "chore: add v1 Core Data model for migration support"
```

### Task 6: Implement V1Migration.swift — color conversion and helpers

**Files:**
- Create: `ios/Shared/V1Migration.swift`

- [ ] **Step 1: Create V1Migration.swift with color conversion and preset data**

Create `ios/Shared/V1Migration.swift` with the foundation:

```swift
import Foundation
import CoreData

/// One-time migration from IssieBoard v1 (Core Data templates) to v2 (KeyboardPreferences profiles).
/// Called from AppDelegate before React Native loads.
class V1Migration {

    private let preferences = KeyboardPreferences()
    private let migrationTimestamp = ISO8601DateFormatter().string(from: Date())
    private var groupIdCounter = 0

    // MARK: - Constants

    private static let migrationCompletedKey = "v2_migration_completed"
    private static let v1UserKey = "v1_user"

    /// Language values from v1 and their corresponding v2 language codes
    private static let languageMap: [String: [String]] = [
        "HE": ["he"],
        "EN": ["en"],
        "AR": ["ar"],
        "BOTH": ["he", "en"],
        "AR_EN": ["ar", "en"],
        "AR_HE": ["ar", "he"],
    ]

    /// Preset IDs for charset groups based on division mode and language
    private struct CharsetPresets {
        let charset1: String  // preset ID
        let charset2: String
        let charset3: String
    }

    private static func charsetPresets(divisionMode: String, language: String) -> CharsetPresets {
        if divisionMode == "By Rows" {
            return CharsetPresets(charset1: "top-row", charset2: "mid-row", charset3: "bottom-row")
        } else {
            // "By Sections" — RTL languages use right-to-left, LTR uses left-to-right
            if language == "en" {
                return CharsetPresets(charset1: "left-third", charset2: "mid-third", charset3: "right-third")
            } else {
                // Hebrew, Arabic are RTL
                return CharsetPresets(charset1: "right-third", charset2: "mid-third", charset3: "left-third")
            }
        }
    }

    /// Members for each preset, per language. Loaded from preset JSON files at build time.
    /// These must match the members arrays in assets/predefined-rules/{lang}.json
    private static let presetMembers: [String: [String: [String]]] = [
        // English presets
        "en": [
            "top-row": ["q","w","e","r","t","y","u","i","o","p","Q","W","E","R","T","Y","U","I","O","P"],
            "mid-row": ["a","s","d","f","g","h","j","k","l","A","S","D","F","G","H","J","K","L"],
            "bottom-row": ["z","x","c","v","b","n","m","Z","X","C","V","B","N","M"],
            "left-third": ["q","w","e","a","s","z","x","Q","W","E","A","S","Z","X"],
            "mid-third": ["r","t","y","d","f","g","h","c","v","b","R","T","Y","D","F","G","H","C","V","B"],
            "right-third": ["u","i","o","p","j","k","l","n","m","U","I","O","P","J","K","L","N","M"],
        ],
        // Hebrew presets
        "he": [
            "top-row": ["ק","ר","א","ט","ו","ן","ם","פ"],
            "mid-row": ["ש","ד","ג","כ","ע","י","ח","ל","ך","ף"],
            "bottom-row": ["ז","ס","ב","ה","נ","מ","צ","ת","ץ"],
            "left-third": ["ק","ר","א","ש","ד","ג","כ"],
            "mid-third": ["ט","ו","נ","כ","ע","י","מ","ה"],
            "right-third": ["פ","ם","ן","ף","ך","ל","ח","ץ","ת","צ"],
        ],
        // Arabic presets
        "ar": [
            "top-row": ["ض","ص","ث","ق","ف","غ","ع","ه","خ","ح"],
            "mid-row": ["ش","س","ي","ب","ل","ا","ت","ن","م"],
            "bottom-row": ["ء","ؤ","ر","ى","ة","و","ز","ظ"],
            "left-third": ["ض","ص","ث","ش","س","ي","ء","ؤ","ر"],
            "mid-third": ["ق","ف","غ","ع","ب","ل","ا","ى","ة","و"],
            "right-third": ["ه","خ","ح","ت","ن","م","ز","ظ"],
        ],
    ]

    /// Preset names per language
    private static let presetNames: [String: [String: String]] = [
        "en": [
            "top-row": "Top Row", "mid-row": "Middle Row", "bottom-row": "Bottom Row",
            "left-third": "Left Third", "mid-third": "Middle Third", "right-third": "Right Third",
            "space-key": "Space Key", "delete-key": "Delete Key",
            "enter-key": "Enter Key", "other-keys": "Other Keys",
        ],
        "he": [
            "top-row": "שורה עליונה", "mid-row": "שורה אמצעית", "bottom-row": "שורה תחתונה",
            "left-third": "שליש שמאל", "mid-third": "שליש אמצעי", "right-third": "שליש ימין",
            "space-key": "מקש הרווח", "delete-key": "מקש מחיקה",
            "enter-key": "מקש ירידת שורה", "other-keys": "מקשים נוספים",
        ],
        "ar": [
            "top-row": "الصف العلوي", "mid-row": "الصف الأوسط", "bottom-row": "الصف السفلي",
            "left-third": "الثلث الأيسر", "mid-third": "الثلث الأوسط", "right-third": "الثلث الأيمن",
            "space-key": "مفتاح المسافة", "delete-key": "مفتاح الحذف",
            "enter-key": "مفتاح الإدخال", "other-keys": "مفاتيح أخرى",
        ],
    ]

    // MARK: - Color Conversion

    /// Convert v1 RGBA string "R.RRRR,G.GGGG,B.BBBB,A.AAAA" to v2 hex "#RRGGBB"
    static func rgbaStringToHex(_ rgba: String?) -> String {
        guard let rgba = rgba else { return "#000000" }
        let components = rgba.split(separator: ",").compactMap { Double($0.trimmingCharacters(in: .whitespaces)) }
        guard components.count >= 3 else { return "#000000" }
        let r = min(255, max(0, Int(components[0] * 255)))
        let g = min(255, max(0, Int(components[1] * 255)))
        let b = min(255, max(0, Int(components[2] * 255)))
        return String(format: "#%02X%02X%02X", r, g, b)
    }

    /// Check if v1 color has alpha == 0 (used for 2-color mode detection)
    static func isTransparent(_ rgba: String?) -> Bool {
        guard let rgba = rgba else { return false }
        let components = rgba.split(separator: ",").compactMap { Double($0.trimmingCharacters(in: .whitespaces)) }
        guard components.count >= 4 else { return false }
        return components[3] == 0.0
    }

    /// Generate a unique group ID
    private func nextGroupId(presetId: String) -> String {
        groupIdCounter += 1
        return "v1_migration_\(presetId)_\(groupIdCounter)"
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add ios/Shared/V1Migration.swift
git commit -m "feat: add V1Migration foundation with color conversion and preset data"
```

### Task 7: Implement V1Migration — Core Data reading

**Files:**
- Modify: `ios/Shared/V1Migration.swift`

- [ ] **Step 1: Add Core Data reading method**

Add the following methods to `V1Migration`:

```swift
// MARK: - Core Data Access

/// Check if migration is needed and perform it
func migrateIfNeeded() {
    let userDefaults = UserDefaults(suiteName: KeyboardPreferences.appGroupIdentifier)

    // Check if already migrated
    if userDefaults?.bool(forKey: V1Migration.migrationCompletedKey) == true {
        print("📦 V1Migration: Already migrated, skipping")
        return
    }

    // Try to find the Core Data store
    guard let storeURL = findCoreDataStore() else {
        print("📦 V1Migration: No v1 Core Data store found, skipping")
        return
    }

    print("📦 V1Migration: Found v1 store at \(storeURL.path)")

    // Read templates from Core Data
    let templates = readV1Templates(storeURL: storeURL)

    if templates.isEmpty {
        print("📦 V1Migration: No templates found in v1 store")
        // Still mark as migrated and set v1_user since the store existed
        userDefaults?.set(true, forKey: V1Migration.migrationCompletedKey)
        userDefaults?.set("true", forKey: V1Migration.v1UserKey)  // String, not Bool — RN reads via getString()
        userDefaults?.synchronize()
        return
    }

    print("📦 V1Migration: Found \(templates.count) templates")

    // Convert and write profiles
    migrateTemplates(templates)

    // Set migration flags
    userDefaults?.set(true, forKey: V1Migration.migrationCompletedKey)
    userDefaults?.set("true", forKey: V1Migration.v1UserKey)  // String, not Bool — RN reads via getString()
    userDefaults?.synchronize()

    print("📦 V1Migration: Migration complete")
}

/// Find the v1 Core Data SQLite store in the app's documents directory
private func findCoreDataStore() -> URL? {
    let documentsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
    let storeURL = documentsURL?.appendingPathComponent("IssieBoard.sqlite")

    if let storeURL = storeURL, FileManager.default.fileExists(atPath: storeURL.path) {
        return storeURL
    }

    // Also check Library/Application Support (default Core Data location)
    let appSupportURL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
    let altStoreURL = appSupportURL?.appendingPathComponent("IssieBoard.sqlite")

    if let altStoreURL = altStoreURL, FileManager.default.fileExists(atPath: altStoreURL.path) {
        return altStoreURL
    }

    return nil
}

/// Read all ConfigSet entities from the v1 Core Data store
private func readV1Templates(storeURL: URL) -> [[String: String]] {
    // Load the v1 model
    guard let modelURL = Bundle.main.url(forResource: "V1DataModel", withExtension: "momd"),
          let model = NSManagedObjectModel(contentsOf: modelURL) else {
        print("📦 V1Migration: Could not load v1 Core Data model")
        return []
    }

    let coordinator = NSPersistentStoreCoordinator(managedObjectModel: model)

    do {
        try coordinator.addPersistentStore(
            ofType: NSSQLiteStoreType,
            configurationName: nil,
            at: storeURL,
            options: [
                NSMigratePersistentStoresAutomaticallyOption: true,
                NSInferMappingModelAutomaticallyOption: true,
                NSReadOnlyPersistentStoreOption: true
            ]
        )
    } catch {
        print("📦 V1Migration: Could not open v1 store: \(error)")
        return []
    }

    let context = NSManagedObjectContext(concurrencyType: .mainQueueConcurrencyType)
    context.persistentStoreCoordinator = coordinator

    let fetchRequest = NSFetchRequest<NSManagedObject>(entityName: "ConfigSet")

    do {
        let results = try context.fetch(fetchRequest)
        return results.map { configSet in
            var dict: [String: String] = [:]
            // Read all known attributes
            let attributes = [
                "configurationName",
                "iSSIE_KEYBOARD_BACKGROUND_COLOR",
                "iSSIE_KEYBOARD_KEYS_COLOR",
                "iSSIE_KEYBOARD_TEXT_COLOR",
                "iSSIE_KEYBOARD_CHARSET1_KEYS_COLOR",
                "iSSIE_KEYBOARD_CHARSET1_TEXT_COLOR",
                "iSSIE_KEYBOARD_CHARSET2_KEYS_COLOR",
                "iSSIE_KEYBOARD_CHARSET2_TEXT_COLOR",
                "iSSIE_KEYBOARD_CHARSET3_KEYS_COLOR",
                "iSSIE_KEYBOARD_CHARSET3_TEXT_COLOR",
                "iSSIE_KEYBOARD_SPACE_COLOR",
                "iSSIE_KEYBOARD_BACKSPACE_COLOR",
                "iSSIE_KEYBOARD_ENTER_COLOR",
                "iSSIE_KEYBOARD_OTHERDEFAULTKEYS_COLOR",
                "iSSIE_KEYBOARD_SPECIAL_KEYS_TEXT",
                "iSSIE_KEYBOARD_SPECIAL_KEYS_COLOR",
                "iSSIE_KEYBOARD_SPECIAL_KEYS_TEXT_COLOR",
                "iSSIE_KEYBOARD_ROW_OR_COLUMN",
                "iSSIE_KEYBOARD_VISIBLE_KEYS",
                "iSSIE_KEYBOARD_LANGUAGES",
            ]
            for attr in attributes {
                if let value = configSet.value(forKey: attr) as? String {
                    dict[attr] = value
                }
            }
            return dict
        }
    } catch {
        print("📦 V1Migration: Failed to fetch ConfigSet: \(error)")
        return []
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add ios/Shared/V1Migration.swift
git commit -m "feat: add Core Data reading to V1Migration"
```

### Task 8: Implement V1Migration — profile conversion and writing

**Files:**
- Modify: `ios/Shared/V1Migration.swift`

- [ ] **Step 1: Add template-to-profile conversion**

Add the `migrateTemplates` method and helpers:

```swift
// MARK: - Template Conversion

/// Convert v1 templates to v2 profiles and write them
private func migrateTemplates(_ templates: [[String: String]]) {
    var savedList: [[String: Any]] = []
    var activeProfiles: [String: String] = [:] // language -> profileId

    for (index, template) in templates.enumerated() {
        let languagesRaw = template["iSSIE_KEYBOARD_LANGUAGES"] ?? "HE"
        let hasABCOrder = languagesRaw.hasSuffix("@")
        let languageKey = languagesRaw.replacingOccurrences(of: "@", with: "")

        guard let languages = V1Migration.languageMap[languageKey] else {
            print("📦 V1Migration: Unknown language value '\(languagesRaw)', skipping template \(index)")
            continue
        }

        for language in languages {
            let profileId = "v1_migrated_\(index)_\(language)"
            let keyboardId: String
            if language == "he" && hasABCOrder {
                keyboardId = "he_ordered"
            } else {
                keyboardId = language
            }

            // Build style groups
            let styleGroups = buildStyleGroups(from: template, language: language)

            // Build profile definition
            let profileDef: [String: Any] = [
                "id": profileId,
                "name": template["configurationName"] ?? "Template \(index + 1)",
                "version": "1.0.0",
                "language": language,
                "keyboardId": keyboardId,
                "backgroundColor": V1Migration.rgbaStringToHex(template["iSSIE_KEYBOARD_BACKGROUND_COLOR"]),
                "keysBgColor": V1Migration.rgbaStringToHex(template["iSSIE_KEYBOARD_KEYS_COLOR"]),
                "textColor": V1Migration.rgbaStringToHex(template["iSSIE_KEYBOARD_TEXT_COLOR"]),
                "wordSuggestionsEnabled": true,
                "settingsButtonEnabled": true,
            ]

            // Write profile definition
            if let profileJson = toJSON(profileDef) {
                preferences.setProfileJSON(profileJson, forKey: "profile_def_\(profileId)")
            }

            // Write style groups separately
            if let groupsJson = toJSON(styleGroups) {
                preferences.setProfileJSON(groupsJson, forKey: "\(profileId)_styleGroups")
            }

            // Add to saved list
            savedList.append([
                "name": template["configurationName"] ?? "Template \(index + 1)",
                "key": profileId,
                "language": language,
                "keyboardId": keyboardId,
            ])

            // Set first profile per language as active
            if activeProfiles[language] == nil {
                activeProfiles[language] = profileId
            }
        }
    }

    // Write saved list
    if let savedListJson = toJSON(savedList) {
        preferences.setProfileJSON(savedListJson, forKey: "saved_list")
    }

    // Set active profiles
    for (language, profileId) in activeProfiles {
        preferences.setProfileJSON(profileId, forKey: "active_profile_issieboard_\(language)")
    }
}

/// Build style groups array from a v1 template for a given language
private func buildStyleGroups(from template: [String: String], language: String) -> [[String: Any]] {
    var groups: [[String: Any]] = []

    let divisionMode = template["iSSIE_KEYBOARD_ROW_OR_COLUMN"] ?? "By Rows"
    let presets = V1Migration.charsetPresets(divisionMode: divisionMode, language: language)

    // Charset groups
    let charsetConfigs: [(presetId: String, keysColorKey: String, textColorKey: String, charsetNum: Int)] = [
        (presets.charset1, "iSSIE_KEYBOARD_CHARSET1_KEYS_COLOR", "iSSIE_KEYBOARD_CHARSET1_TEXT_COLOR", 1),
        (presets.charset2, "iSSIE_KEYBOARD_CHARSET2_KEYS_COLOR", "iSSIE_KEYBOARD_CHARSET2_TEXT_COLOR", 2),
        (presets.charset3, "iSSIE_KEYBOARD_CHARSET3_KEYS_COLOR", "iSSIE_KEYBOARD_CHARSET3_TEXT_COLOR", 3),
    ]

    for config in charsetConfigs {
        guard let members = V1Migration.presetMembers[language]?[config.presetId] else { continue }
        let name = V1Migration.presetNames[language]?[config.presetId] ?? config.presetId

        // Charset 2 with alpha == 0 means 2-color mode — deactivate it
        let isActive = !(config.charsetNum == 2 && V1Migration.isTransparent(template[config.keysColorKey]))

        let group: [String: Any] = [
            "id": nextGroupId(presetId: config.presetId),
            "name": name,
            "members": members,
            "style": [
                "bgColor": V1Migration.rgbaStringToHex(template[config.keysColorKey]),
                "color": V1Migration.rgbaStringToHex(template[config.textColorKey]),
            ],
            "createdAt": migrationTimestamp,
            "active": isActive,
            "isBuiltIn": false,
        ]
        groups.append(group)
    }

    // Action key groups
    let actionKeyConfigs: [(presetId: String, members: [String], colorKey: String)] = [
        ("space-key", ["space"], "iSSIE_KEYBOARD_SPACE_COLOR"),
        ("delete-key", ["backspace"], "iSSIE_KEYBOARD_BACKSPACE_COLOR"),
        ("enter-key", ["enter"], "iSSIE_KEYBOARD_ENTER_COLOR"),
        ("other-keys", ["keyset", "next-keyboard", "settings", "close"], "iSSIE_KEYBOARD_OTHERDEFAULTKEYS_COLOR"),
    ]

    for config in actionKeyConfigs {
        let name = V1Migration.presetNames[language]?[config.presetId] ?? config.presetId
        let group: [String: Any] = [
            "id": nextGroupId(presetId: config.presetId),
            "name": name,
            "members": config.members,
            "style": [
                "bgColor": V1Migration.rgbaStringToHex(template[config.colorKey]),
                "color": "#000000",
            ],
            "createdAt": migrationTimestamp,
            "active": true,
            "isBuiltIn": false,
        ]
        groups.append(group)
    }

    // Special keys group (if non-empty)
    let specialKeysText = template["iSSIE_KEYBOARD_SPECIAL_KEYS_TEXT"] ?? ""
    if !specialKeysText.isEmpty {
        let members = specialKeysText.map { String($0) }
        let group: [String: Any] = [
            "id": nextGroupId(presetId: "special-keys"),
            "name": "Special Keys",
            "members": members,
            "style": [
                "bgColor": V1Migration.rgbaStringToHex(template["iSSIE_KEYBOARD_SPECIAL_KEYS_COLOR"]),
                "color": V1Migration.rgbaStringToHex(template["iSSIE_KEYBOARD_SPECIAL_KEYS_TEXT_COLOR"]),
            ],
            "createdAt": migrationTimestamp,
            "active": true,
            "isBuiltIn": false,
        ]
        groups.append(group)
    }

    // Visible keys group (if non-empty)
    let visibleKeys = template["iSSIE_KEYBOARD_VISIBLE_KEYS"] ?? ""
    if !visibleKeys.isEmpty {
        let members = visibleKeys.map { String($0) }
        let group: [String: Any] = [
            "id": nextGroupId(presetId: "visible-keys"),
            "name": "Visible Keys",
            "members": members,
            "style": [
                "visibilityMode": "showOnly",
            ],
            "createdAt": migrationTimestamp,
            "active": true,
            "isBuiltIn": false,
        ]
        groups.append(group)
    }

    return groups
}

// MARK: - JSON Helpers

private func toJSON(_ object: Any) -> String? {
    do {
        let data = try JSONSerialization.data(withJSONObject: object, options: [])
        return String(data: data, encoding: .utf8)
    } catch {
        print("📦 V1Migration: JSON serialization failed: \(error)")
        return nil
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add ios/Shared/V1Migration.swift
git commit -m "feat: add profile conversion and writing to V1Migration"
```

### Task 9: Wire V1Migration into AppDelegate

**Files:**
- Modify: `ios/IssieBoardNG/AppDelegate.swift`

- [ ] **Step 1: Call migration before React Native starts**

In `AppDelegate.swift`, add the migration call in `didFinishLaunchingWithOptions`, right before `factory.startReactNative(...)`:

```swift
// Add this line before factory.startReactNative(...)
V1Migration().migrateIfNeeded()
```

The full method should look like:

```swift
func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    // Migrate v1 templates to v2 profiles (one-time, idempotent)
    V1Migration().migrateIfNeeded()

    window = UIWindow(frame: UIScreen.main.bounds)

    let bundleId = Bundle.main.bundleIdentifier ?? ""
    print("🔍 Bundle ID: \(bundleId)")

    let moduleName = bundleId.contains("IssieVoice") ? "IssieVoice" : "IssieBoardNG"
    print("🎯 Loading module: \(moduleName)")

    factory.startReactNative(
        withModuleName: moduleName,
        in: window,
        launchOptions: launchOptions
    )

    return true
}
```

- [ ] **Step 2: Verify the project builds**

Open Xcode and build the IssieBoardNG target. Ensure no compile errors.

- [ ] **Step 3: Commit**

```bash
git add ios/IssieBoardNG/AppDelegate.swift
git commit -m "feat: wire V1Migration into AppDelegate"
```

---

## Chunk 3: AppNavigator + v1 Detection

### Task 10: Add v1 user detection and classic/advanced routing to AppNavigator

**Files:**
- Modify: `src/AppNavigator.tsx`

- [ ] **Step 1: Read current AppNavigator.tsx**

Read `src/AppNavigator.tsx` to understand the current navigation state model.

- [ ] **Step 2: Add v1_user detection and screen routing**

Update the `Screen` type union to include a classic screen:

```typescript
type Screen =
  | { type: 'legacy' }
  | { type: 'editor'; profileId?: string; initialLanguage?: LanguageId }
  | { type: 'classic'; initialLanguage?: LanguageId };
```

Add state for v1 user detection:

```typescript
const [isV1User, setIsV1User] = useState<boolean | null>(null);  // null = loading
```

In the `useEffect` that runs on mount, after the existing preference checks, add:

```typescript
// Check if this is a v1 user (migrated from old IssieBoard)
const v1Flag = await KeyboardPreferences.getString('v1_user');
const isV1 = v1Flag === '1' || v1Flag === 'true';
setIsV1User(isV1);

// If v1 user and no specific deep link, default to classic editor
if (isV1 && !hasDeepLink) {
    setScreen({ type: 'classic', initialLanguage: determinedLanguage });
    return;
}
```

In the render section, add the classic screen case:

```typescript
if (screen.type === 'classic') {
    return (
        <ClassicEditorScreen
            key={`classic-${editorKey}`}
            initialLanguage={screen.initialLanguage}
            onSwitchToAdvanced={(language) => {
                setScreen({ type: 'editor', initialLanguage: language });
            }}
        />
    );
}
```

Also pass `isV1User` and an `onSwitchToClassic` callback to `EditorScreen`:

```typescript
<EditorScreen
    key={`editor-${editorKey}`}
    initialLanguage={screen.initialLanguage}
    isV1User={isV1User ?? false}
    onSwitchToClassic={(language) => {
        setScreen({ type: 'classic', initialLanguage: language });
    }}
/>
```

- [ ] **Step 3: Add import for ClassicEditorScreen**

```typescript
import ClassicEditorScreen from './screens/ClassicEditorScreen';
```

Note: This will cause a compile error until ClassicEditorScreen is created in Task 12. Create a placeholder:

```typescript
// src/screens/ClassicEditorScreen.tsx (placeholder)
import React from 'react';
import { View, Text } from 'react-native';

interface ClassicEditorScreenProps {
    initialLanguage?: string;
    onSwitchToAdvanced: (language?: string) => void;
}

const ClassicEditorScreen: React.FC<ClassicEditorScreenProps> = ({ onSwitchToAdvanced }) => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Classic Editor (coming soon)</Text>
    </View>
);

export default ClassicEditorScreen;
```

- [ ] **Step 4: Add "Classic View" toggle to EditorScreen**

In `src/screens/EditorScreen.tsx`, add props for the toggle:

```typescript
interface EditorScreenProps {
    initialLanguage?: LanguageId;
    isV1User?: boolean;
    onSwitchToClassic?: (language?: LanguageId) => void;
    // ... existing props
}
```

In the profile row / header area, add a button (only shown when `isV1User` is true):

```typescript
{isV1User && onSwitchToClassic && (
    <TouchableOpacity
        onPress={() => onSwitchToClassic(currentLanguage)}
        style={styles.classicViewButton}
    >
        <Text style={styles.classicViewText}>Classic View</Text>
    </TouchableOpacity>
)}
```

- [ ] **Step 5: Commit**

```bash
git add src/AppNavigator.tsx src/screens/ClassicEditorScreen.tsx src/screens/EditorScreen.tsx
git commit -m "feat: add v1 user detection and classic/advanced navigation routing"
```

---

## Chunk 4: Classic Editor — Core Structure

### Task 11: Create classicProfileBridge.ts — logic layer

**Files:**
- Create: `src/screens/classic/classicProfileBridge.ts`

This module contains all the logic for reading/writing v2 profile data from the classic UI perspective. It maps classic UI concepts (charsets, division mode, action keys) to v2 style groups.

- [ ] **Step 1: Create the bridge module**

```typescript
// src/screens/classic/classicProfileBridge.ts
import { StyleGroup } from '../../../types';

// Known preset IDs for charset groups
const ROW_PRESETS = ['top-row', 'mid-row', 'bottom-row'];
const THIRD_PRESETS = ['left-third', 'mid-third', 'right-third'];
const ACTION_PRESETS = ['space-key', 'delete-key', 'enter-key', 'other-keys'];

export type DivisionMode = 'rows' | 'sections';

export interface ClassicState {
    divisionMode: DivisionMode;
    threeColorMode: boolean;  // true = 3 groups, false = 2 (middle disabled)
    charsetGroups: [StyleGroup | null, StyleGroup | null, StyleGroup | null];
    actionGroups: {
        space: StyleGroup | null;
        delete: StyleGroup | null;
        enter: StyleGroup | null;
        other: StyleGroup | null;
    };
    specialKeysGroup: StyleGroup | null;
    visibleKeysGroup: StyleGroup | null;
}

/**
 * Extract classic-UI-relevant state from v2 style groups.
 * Identifies charset groups, action groups, special keys, visible keys
 * from the full list of style groups.
 */
export function extractClassicState(styleGroups: StyleGroup[]): ClassicState {
    // Find charset groups by checking if their name matches known presets
    // Migration creates groups with preset names, so we match by name pattern
    const rowGroups = findGroupsByIdPattern(styleGroups, ROW_PRESETS);
    const thirdGroups = findGroupsByIdPattern(styleGroups, THIRD_PRESETS);

    // Determine division mode based on which groups exist and are active
    const hasActiveRows = rowGroups.some(g => g?.active !== false);
    const hasActiveThirds = thirdGroups.some(g => g?.active !== false);
    const divisionMode: DivisionMode = hasActiveThirds && !hasActiveRows ? 'sections' : 'rows';

    const charsetGroups = divisionMode === 'rows' ? rowGroups : thirdGroups;

    // Middle group (index 1) being inactive = 2-color mode
    const threeColorMode = charsetGroups[1]?.active !== false;

    // Find action key groups
    const space = findGroupByIdPattern(styleGroups, 'space-key');
    const del = findGroupByIdPattern(styleGroups, 'delete-key');
    const enter = findGroupByIdPattern(styleGroups, 'enter-key');
    const other = findGroupByIdPattern(styleGroups, 'other-keys');

    // Find special keys group (has a bgColor but not a known preset)
    const specialKeysGroup = styleGroups.find(g =>
        g.active !== false &&
        g.style.bgColor &&
        !isKnownPresetGroup(g)
    ) ?? null;

    // Find visible keys group (has visibilityMode: 'showOnly')
    const visibleKeysGroup = styleGroups.find(g =>
        g.style.visibilityMode === 'showOnly'
    ) ?? null;

    return {
        divisionMode,
        threeColorMode,
        charsetGroups: [charsetGroups[0], charsetGroups[1], charsetGroups[2]],
        actionGroups: { space, delete: del, enter, other },
        specialKeysGroup,
        visibleKeysGroup,
    };
}

function findGroupsByIdPattern(groups: StyleGroup[], presetIds: string[]): [StyleGroup | null, StyleGroup | null, StyleGroup | null] {
    return presetIds.map(presetId =>
        groups.find(g => g.id.includes(presetId)) ?? null
    ) as [StyleGroup | null, StyleGroup | null, StyleGroup | null];
}

function findGroupByIdPattern(groups: StyleGroup[], presetId: string): StyleGroup | null {
    return groups.find(g => g.id.includes(presetId)) ?? null;
}

function isKnownPresetGroup(group: StyleGroup): boolean {
    const knownPatterns = [...ROW_PRESETS, ...THIRD_PRESETS, ...ACTION_PRESETS, 'visible-keys'];
    return knownPatterns.some(pattern => group.id.includes(pattern));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/classic/classicProfileBridge.ts
git commit -m "feat: add classicProfileBridge for mapping classic UI to v2 model"
```

### Task 12: Create ClassicColorPicker component

**Files:**
- Create: `src/screens/classic/ClassicColorPicker.tsx`

- [ ] **Step 1: Create the v1-style color grid component**

This is a grid of ~30 color circles matching the v1 palette, plus a current-color indicator strip. Reuse the v1 color set from `ColorUtility.swift`.

```typescript
// src/screens/classic/ClassicColorPicker.tsx
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';

// v1's color palette (30 colors matching the old ColorUtility grid)
const V1_COLORS = [
    '#800080', '#4B0082', '#8B00FF', '#DDA0DD', '#FF00FF', '#7B68EE',
    '#0000FF', '#000080', '#0066FF', '#00FFFF', '#87CEEB', '#98FFE0',
    '#006400', '#00FF00', '#00FF00', '#FFFF00', '#F0E68C', '#FFA500',
    '#FF8C00', '#FF0000', '#8B0000', '#808000', '#D2B48C', '#FFDAB9',
    '#FFB6C1', '#FFFFFF', '#C0C0C0', '#808080', '#696969', '#000000',
];

interface ClassicColorPickerProps {
    currentColor: string;
    onColorSelected: (color: string) => void;
}

const ClassicColorPicker: React.FC<ClassicColorPickerProps> = ({
    currentColor,
    onColorSelected,
}) => {
    return (
        <View style={styles.container}>
            {/* Current color strip */}
            <View style={[styles.currentColorStrip, { backgroundColor: currentColor }]} />

            {/* Color grid */}
            <View style={styles.grid}>
                {V1_COLORS.map((color, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[
                            styles.colorCircle,
                            { backgroundColor: color },
                            color === currentColor && styles.selectedCircle,
                            color === '#FFFFFF' && styles.whiteCircle,
                        ]}
                        onPress={() => onColorSelected(color)}
                    />
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
    },
    currentColorStrip: {
        height: 44,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#000',
        marginBottom: 16,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 12,
    },
    colorCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    selectedCircle: {
        borderWidth: 3,
        borderColor: '#007AFF',
    },
    whiteCircle: {
        borderWidth: 1,
        borderColor: '#CCC',
    },
});

export default ClassicColorPicker;
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/classic/ClassicColorPicker.tsx
git commit -m "feat: add ClassicColorPicker with v1-style color grid"
```

### Task 13: Create ClassicDetailView component

**Files:**
- Create: `src/screens/classic/ClassicDetailView.tsx`

- [ ] **Step 1: Create the generic detail view wrapper**

```typescript
// src/screens/classic/ClassicDetailView.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { KeyboardPreview } from '../../components/KeyboardPreview';

interface ClassicDetailViewProps {
    title: string;
    onBack: () => void;
    config?: any;  // KeyboardConfig for preview
    children: React.ReactNode;
}

const ClassicDetailView: React.FC<ClassicDetailViewProps> = ({
    title,
    onBack,
    config,
    children,
}) => {
    const [showKeyboard, setShowKeyboard] = useState(false);

    return (
        <SafeAreaView style={styles.container}>
            {/* Back button */}
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
                <Text style={styles.backText}>{'>'} הגדרות</Text>
            </TouchableOpacity>

            {/* Show Keyboard toggle */}
            <TouchableOpacity
                style={styles.showKeyboardButton}
                onPress={() => setShowKeyboard(!showKeyboard)}
            >
                <Text style={styles.showKeyboardText}>
                    {showKeyboard ? 'הסתר מקלדת' : 'הצג מקלדת'}
                </Text>
            </TouchableOpacity>

            {/* Keyboard preview */}
            {showKeyboard && config && (
                <View style={styles.previewContainer}>
                    <KeyboardPreview
                        config={config}
                        style={styles.preview}
                    />
                </View>
            )}

            {/* Control content */}
            <View style={styles.content}>
                {children}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    backButton: {
        padding: 16,
        alignItems: 'flex-end',  // RTL-aware alignment for back button
    },
    backText: {
        color: '#007AFF',
        fontSize: 17,
    },
    showKeyboardButton: {
        alignSelf: 'center',
        backgroundColor: '#007AFF',
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 8,
        marginBottom: 12,
    },
    showKeyboardText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    previewContainer: {
        paddingHorizontal: 8,
        marginBottom: 12,
    },
    preview: {
        height: 200,
    },
    content: {
        flex: 1,
    },
});

export default ClassicDetailView;
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/classic/ClassicDetailView.tsx
git commit -m "feat: add ClassicDetailView with back button and keyboard preview toggle"
```

### Task 14: Create ClassicSectionsList component

**Files:**
- Create: `src/screens/classic/ClassicSectionsList.tsx`

- [ ] **Step 1: Create the master settings table**

This is the main scrollable list with all settings rows organized in sections. Each row shows the setting name and a color dot (for color settings) or summary text. Tapping a row calls `onSelectSetting` to navigate to the detail view.

```typescript
// src/screens/classic/ClassicSectionsList.tsx
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch } from 'react-native';
import { ClassicState, DivisionMode } from './classicProfileBridge';

export type SettingId =
    | 'language' | 'key-order' | 'reset'
    | 'bg-color' | 'keys-color' | 'text-color'
    | 'space-color' | 'delete-color' | 'enter-color' | 'other-color'
    | 'nikkud'
    | 'division-mode'
    | 'group1-keys-color' | 'group1-text-color'
    | 'group2-keys-color' | 'group2-text-color'
    | 'group3-keys-color' | 'group3-text-color'
    | 'special-keys-text' | 'special-keys-color' | 'special-keys-text-color'
    | 'visible-keys-text'
    | 'save' | 'my-issieboards';

interface ClassicSectionsListProps {
    classicState: ClassicState;
    backgroundColor: string;
    keysBgColor: string;
    textColor: string;
    currentLanguage: string;
    onSelectSetting: (settingId: SettingId) => void;
    onSwitchToAdvanced: () => void;
}

const ClassicSectionsList: React.FC<ClassicSectionsListProps> = ({
    classicState,
    backgroundColor,
    keysBgColor,
    textColor,
    currentLanguage,
    onSelectSetting,
    onSwitchToAdvanced,
}) => {
    const groupLabels = classicState.divisionMode === 'rows'
        ? ['שורה עליונה', 'שורה אמצעית', 'שורה תחתונה']
        : ['שליש ימין', 'שליש אמצעי', 'שליש שמאל'];

    return (
        <ScrollView style={styles.container}>
            {/* Header with profile name + Advanced View toggle */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onSwitchToAdvanced}>
                    <Text style={styles.advancedLink}>Advanced View →</Text>
                </TouchableOpacity>
            </View>

            {/* Language selector */}
            <View style={styles.languageBar}>
                {['he', 'en', 'ar'].map(lang => (
                    <TouchableOpacity
                        key={lang}
                        style={[styles.langButton, lang === currentLanguage && styles.langButtonActive]}
                        onPress={() => onSelectSetting('language')}
                    >
                        <Text style={[styles.langText, lang === currentLanguage && styles.langTextActive]}>
                            {lang === 'he' ? 'עברית' : lang === 'en' ? 'English' : 'العربية'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Main section */}
            <SectionHeader title="הגדרות ראשיות" />
            <SettingRow icon="↻" title="איפוס" onPress={() => onSelectSetting('reset')} />
            <SettingRow icon="🌐" title="סדר המקשים" onPress={() => onSelectSetting('key-order')} />

            {/* Main Colors */}
            <SectionHeader title="צבעים ראשיים" />
            <ColorRow title="רקע המקלדת" color={backgroundColor} onPress={() => onSelectSetting('bg-color')} />
            <ColorRow title="צבע המקשים" color={keysBgColor} onPress={() => onSelectSetting('keys-color')} />
            <ColorRow title="צבע הטקסט" color={textColor} onPress={() => onSelectSetting('text-color')} />

            {/* Action Keys */}
            <SectionHeader title="מקשים מיוחדים" />
            <ColorRow title="צבע מקש הרווח" color={classicState.actionGroups.space?.style.bgColor} onPress={() => onSelectSetting('space-color')} />
            <ColorRow title="צבע מקש מחיקה" color={classicState.actionGroups.delete?.style.bgColor} onPress={() => onSelectSetting('delete-color')} />
            <ColorRow title="צבע מקש ירידת שורה" color={classicState.actionGroups.enter?.style.bgColor} onPress={() => onSelectSetting('enter-color')} />
            <ColorRow title="צבע מקשים נוספים" color={classicState.actionGroups.other?.style.bgColor} onPress={() => onSelectSetting('other-color')} />

            {/* Nikkud */}
            <SectionHeader title="ניקוד" />
            <SettingRow icon="ⓘ" title="הגדרות ניקוד" onPress={() => onSelectSetting('nikkud')} />

            {/* Division Mode */}
            <SectionHeader title="שורות-אזורים" />
            <SettingRow icon="ⓘ" title="שורות-אזורים" onPress={() => onSelectSetting('division-mode')} />

            {/* Per-group colors */}
            <SectionHeader title={groupLabels[0]} />
            <ColorRow title="צבע המקשים" color={classicState.charsetGroups[0]?.style.bgColor} onPress={() => onSelectSetting('group1-keys-color')} />
            <ColorRow title="צבע הטקסט" color={classicState.charsetGroups[0]?.style.color} onPress={() => onSelectSetting('group1-text-color')} />

            {classicState.threeColorMode && (
                <>
                    <SectionHeader title={groupLabels[1]} />
                    <ColorRow title="צבע המקשים" color={classicState.charsetGroups[1]?.style.bgColor} onPress={() => onSelectSetting('group2-keys-color')} />
                    <ColorRow title="צבע הטקסט" color={classicState.charsetGroups[1]?.style.color} onPress={() => onSelectSetting('group2-text-color')} />
                </>
            )}

            <SectionHeader title={groupLabels[2]} />
            <ColorRow title="צבע המקשים" color={classicState.charsetGroups[2]?.style.bgColor} onPress={() => onSelectSetting('group3-keys-color')} />
            <ColorRow title="צבע הטקסט" color={classicState.charsetGroups[2]?.style.color} onPress={() => onSelectSetting('group3-text-color')} />

            {/* Special Keys */}
            <SectionHeader title="מקשים מודגשים" />
            <SettingRow title="תווים מודגשים" summary={classicState.specialKeysGroup?.members.join('') || 'ללא'} onPress={() => onSelectSetting('special-keys-text')} />
            <ColorRow title="צבע המקשים" color={classicState.specialKeysGroup?.style.bgColor} onPress={() => onSelectSetting('special-keys-color')} />
            <ColorRow title="צבע הטקסט" color={classicState.specialKeysGroup?.style.color} onPress={() => onSelectSetting('special-keys-text-color')} />

            {/* Visible Keys */}
            <SectionHeader title="מקשים גלויים" />
            <SettingRow title="מקשים גלויים" summary={classicState.visibleKeysGroup?.members.join('') || 'הכל'} onPress={() => onSelectSetting('visible-keys-text')} />

            {/* Save/Load */}
            <View style={styles.saveRow}>
                <TouchableOpacity style={styles.saveButton} onPress={() => onSelectSetting('save')}>
                    <Text style={styles.saveButtonText}>שמור</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.loadButton} onPress={() => onSelectSetting('my-issieboards')}>
                    <Text style={styles.loadButtonText}>הלוחות שלי</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

// Sub-components

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
    <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
);

const SettingRow: React.FC<{
    icon?: string;
    title: string;
    summary?: string;
    onPress: () => void;
}> = ({ icon, title, summary, onPress }) => (
    <TouchableOpacity style={styles.row} onPress={onPress}>
        {icon && <Text style={styles.rowIcon}>{icon}</Text>}
        <Text style={styles.rowTitle}>{title}</Text>
        {summary && <Text style={styles.rowSummary}>{summary}</Text>}
        <Text style={styles.rowChevron}>›</Text>
    </TouchableOpacity>
);

const ColorRow: React.FC<{
    title: string;
    color?: string;
    onPress: () => void;
}> = ({ title, color, onPress }) => (
    <TouchableOpacity style={styles.row} onPress={onPress}>
        <View style={[styles.colorDot, { backgroundColor: color || '#CCC' }]} />
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowChevron}>›</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F2F7' },
    header: { padding: 16, alignItems: 'flex-end' },
    advancedLink: { color: '#007AFF', fontSize: 14 },
    languageBar: { flexDirection: 'row', padding: 12, gap: 8 },
    langButton: { flex: 1, padding: 10, alignItems: 'center', backgroundColor: '#E5E5EA', borderRadius: 8 },
    langButtonActive: { backgroundColor: '#007AFF' },
    langText: { fontSize: 15, color: '#333' },
    langTextActive: { color: '#FFF', fontWeight: '600' },
    sectionHeader: { backgroundColor: '#E5E5EA', paddingHorizontal: 16, paddingVertical: 6 },
    sectionHeaderText: { fontSize: 13, color: '#6D6D72', textAlign: 'right' },
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#C6C6C8' },
    rowIcon: { fontSize: 20, marginRight: 12, width: 28, textAlign: 'center' },
    rowTitle: { flex: 1, fontSize: 17, textAlign: 'right' },
    rowSummary: { fontSize: 15, color: '#8E8E93', marginLeft: 8 },
    rowChevron: { fontSize: 20, color: '#C7C7CC', marginLeft: 8 },
    colorDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#DDD', marginRight: 12 },
    saveRow: { flexDirection: 'row', padding: 16, gap: 12 },
    saveButton: { flex: 1, backgroundColor: '#007AFF', padding: 14, borderRadius: 10, alignItems: 'center' },
    saveButtonText: { color: '#FFF', fontSize: 17, fontWeight: '600' },
    loadButton: { flex: 1, borderWidth: 1, borderColor: '#007AFF', padding: 14, borderRadius: 10, alignItems: 'center' },
    loadButtonText: { color: '#007AFF', fontSize: 17 },
});

export default ClassicSectionsList;
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/classic/ClassicSectionsList.tsx
git commit -m "feat: add ClassicSectionsList with v1-style settings table"
```

### Task 15: Implement ClassicEditorScreen — main screen with master-detail navigation

**Files:**
- Modify: `src/screens/ClassicEditorScreen.tsx` (replace placeholder)

- [ ] **Step 1: Implement the full ClassicEditorScreen**

Replace the placeholder with the complete implementation. This screen manages:
- Loading the active profile for the current language
- Master-detail navigation state (sections list vs detail view)
- Delegating to ClassicSectionsList and ClassicDetailView + controls
- Writing changes back to the v2 profile model via KeyboardPreferences

The screen is the orchestrator — it loads profile data, passes the `ClassicState` to the sections list, and when a setting is selected, shows the appropriate detail view with the right control.

This is the largest component. Key patterns:
- Use the same profile load/save patterns from `EditorScreen.tsx` (lines 275, 1777)
- Use `extractClassicState()` from `classicProfileBridge.ts` to derive classic state from style groups
- When a color is changed, update the relevant style group and call `saveKeyboardConfig()` to push to the keyboard extension
- Language switching loads a different profile (same pattern as EditorScreen's language tabs)

The full implementation should handle all `SettingId` values from `ClassicSectionsList`, routing each to the appropriate detail view (ClassicColorPicker, text input, or picker).

- [ ] **Step 2: Verify the app builds and navigates**

Run: `npm start` and verify on simulator that:
- Fresh install → shows EditorScreen (no classic toggle)
- With `v1_user` flag set → shows ClassicEditorScreen
- "Advanced View" navigates to EditorScreen
- "Classic View" navigates back

- [ ] **Step 3: Commit**

```bash
git add src/screens/ClassicEditorScreen.tsx
git commit -m "feat: implement ClassicEditorScreen with master-detail navigation"
```

---

## Chunk 5: Integration Testing

### Task 16: Manual integration test — migration flow

- [ ] **Step 1: Prepare test data**

On a simulator, install the v1 app (from `../oldIssieBoard`) and create a few templates with different settings:
- Template with Hebrew only, 3-color "By Rows" mode, different charset colors
- Template with "BOTH" (HE+EN), custom special keys, visible keys filter
- Template with ABC ordering (`HE@`)

- [ ] **Step 2: Install v2 over v1**

Build and install the v2 app on the same simulator (same bundle ID). It should:
- Find the v1 Core Data store
- Migrate all templates silently
- Land on the ClassicEditorScreen
- Show migrated profiles in "My IssieBoards"

- [ ] **Step 3: Verify migrated data**

For each migrated profile:
- Colors match the v1 template
- Style groups are correctly created (charset groups, action key groups, special keys, visible keys)
- Division mode matches
- ABC ordering maps to `he_ordered`
- "BOTH" template created separate profiles for Hebrew and English

- [ ] **Step 4: Verify classic UI controls**

- Changing a color in classic UI updates the keyboard preview
- Switching division mode swaps groups and preserves colors
- "Advanced View" shows the same profile with all groups visible
- "Classic View" returns without data loss

- [ ] **Step 5: Commit any fixes found during testing**

```bash
git add -A
git commit -m "fix: integration test fixes for v1 migration"
```
