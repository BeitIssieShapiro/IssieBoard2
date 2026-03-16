# V1 Migration & Compatibility Layer Design

## Overview

IssieBoard v2 (IssieBoardNG) replaces v1 (oldIssieBoard) in the App Store as an in-place upgrade. This design covers three aspects of the transition:

1. **Data migration** — Convert v1 Templates (Core Data) to v2 Profiles
2. **Device setup guidance** — v1 had one keyboard with internal language switching; v2 has separate keyboard extensions per language
3. **Compatibility UI** — A classic settings screen for v1 users, backed by the v2 data model

## Constraints & Decisions

- **Same bundle ID**: v2 replaces v1 in the App Store. The app inherits v1's data directory, Core Data store, and App Group.
- **App Group**: v2 adopts v1's App Group identifier (`group.com.issieshapiro.Issieboard` — capital I, confirmed from v1's `IssieBoard.entitlements`) since v2 is not yet released. Note: the casing is `Issieboard` not `issieboard`.
- **iOS only**: v1 was iOS-only, so migration logic exists only in Swift. No Android migration needed.
- **Automatic migration**: Silent, on first launch, idempotent with a flag. No user notification.
- **iOS-first development**: Per project conventions, all new native code is implemented in iOS first.

---

## Component 1: Data Migration (Swift)

### File

`ios/Shared/V1Migration.swift`

### Trigger

Called from `AppDelegate` or native module initialization, before React Native loads.

### Flow

1. Read `v2_migration_completed` flag from shared UserDefaults (`group.com.issieshapiro.Issieboard`).
2. If `true`, return immediately.
3. Open Core Data store (`IssieBoard.sqlite`, model version `IssieBoard 2.xcdatamodel`).
4. Fetch all `ConfigSet` entities.
5. For each template, determine languages from `ISSIE_KEYBOARD_LANGUAGES`:

| v1 Value | Languages to Create |
|----------|-------------------|
| `"HE"` | `[he]` |
| `"EN"` | `[en]` |
| `"AR"` | `[ar]` |
| `"BOTH"` | `[he, en]` |
| `"AR_EN"` | `[ar, en]` |
| `"AR_HE"` | `[ar, he]` |

6. For each language, create a v2 profile:
   - **id**: `"v1_migrated_{templateIndex}_{language}"` (e.g., `"v1_migrated_0_he"`)
   - **name**: template's `configurationName`
   - **version**: `"1.0.0"`
   - **language**: mapped language code
   - **keyboardId**: `"he_ordered"` if language is Hebrew AND `"@"` suffix on language value, else standard (`"he"`, `"en"`, `"ar"`). The `"@"` suffix only has effect for Hebrew since no ordered variants exist for English or Arabic.
   - **backgroundColor**: converted from v1 RGBA string to hex
   - **keysBgColor**: from `ISSIE_KEYBOARD_KEYS_COLOR` (master key color)
   - **textColor**: from `ISSIE_KEYBOARD_TEXT_COLOR` (master text color)
   - **groups**: instantiated from presets (see Group Mapping below)
   - **wordSuggestionsEnabled**: `true` (default)
   - **settingsButtonEnabled**: `true` (default)
7. Write profile and style groups to KeyboardPreferences (see Storage Keys below).
8. Add each profile to the saved list.
9. Set the first migrated profile as active for each language.
10. Set flags: `v2_migration_completed = true`, `v1_user = true`.

### Storage Keys

The `KeyboardPreferences` class uses a `profile_` prefix for `setProfileJSON()`/`getProfileJSON()` methods (line 89 of `KeyboardPreferences.swift`), and no prefix for `setString()`/`getString()`. The migration must use the correct API to match what React Native reads.

React Native passes keys like `"profile_def_{profileId}"` through the bridge to `setProfileJSON()`, which adds `"profile_"`, resulting in UD key `"profile_profile_def_{profileId}"`. The V1Migration Swift code must use the same `forKey` values that RN uses:

**Profile definition**: Use `setProfileJSON(json, forKey: "profile_def_{profileId}")` — this stores at UserDefaults key `profile_profile_def_{profileId}`, matching what RN reads via `getProfile("profile_def_{profileId}")`.

**Style groups**: Stored **separately** from the profile definition. Use `setProfileJSON(json, forKey: "{profileId}_styleGroups")` — stores at UD key `profile_{profileId}_styleGroups`. Each migrated profile's style groups are a JSON array of `StyleGroup` objects.

**Saved list**: Use `setProfileJSON(json, forKey: "saved_list")` — stores at UD key `profile_saved_list`. The list is a JSON array of `{ name, key, language, keyboardId }` objects.

**Active profile per language**: Use `setProfileJSON(profileId, forKey: "active_profile_issieboard_{language}")` — stores at UD key `profile_active_profile_issieboard_{language}`.

**Migration flags**: Use direct `UserDefaults.set()` on the shared suite (no prefix needed, these are internal flags not read via KeyboardPreferences):
- `v2_migration_completed`: `Bool`, set to `true`
- `v1_user`: `Bool`, set to `true` — read by React Native via `KeyboardPreferences.getString("v1_user")`

### Style Group Fields

Each migrated style group must include all required `StyleGroup` fields:
- **id**: Generate unique ID, e.g., `"v1_migration_{presetId}_{timestamp}"` or `"group_{Date.now}_{random}"`
- **name**: From the preset's localized name
- **members**: From the preset
- **style**: `{ bgColor, color, visibilityMode }` from v1 colors
- **createdAt**: ISO 8601 timestamp string (e.g., `"2026-03-16T00:00:00.000Z"`)
- **active**: `true` or `false` (see Group Mapping)
- **isBuiltIn**: `false`

### Color Conversion

v1 RGBA string `"R.RRRR,G.GGGG,B.BBBB,A.AAAA"` (e.g., `"1.0000,1.0000,0.0000,1.0000"`) converts to v2 hex `"#RRGGBB"`:

```swift
func rgbaStringToHex(_ rgba: String) -> String {
    let components = rgba.split(separator: ",").compactMap { Double($0) }
    guard components.count >= 3 else { return "#000000" }
    let r = Int(components[0] * 255)
    let g = Int(components[1] * 255)
    let b = Int(components[2] * 255)
    return String(format: "#%02X%02X%02X", r, g, b)
}
```

### Group Mapping

For each migrated profile, instantiate style groups from v2 presets, copying v1 colors:

**Charset groups** — determined by `ISSIE_KEYBOARD_ROW_OR_COLUMN`:

| v1 Division Mode | Charset 1 Preset | Charset 2 Preset | Charset 3 Preset |
|---|---|---|---|
| "By Rows" | `top-row` | `mid-row` | `bottom-row` |
| "By Sections" (HE, AR — RTL) | `right-third` | `mid-third` | `left-third` |
| "By Sections" (EN — LTR) | `left-third` | `mid-third` | `right-third` |

Each charset group gets:
- `members`: from the preset
- `bgColor`: from `ISSIE_KEYBOARD_CHARSET{N}_KEYS_COLOR`
- `color`: from `ISSIE_KEYBOARD_CHARSET{N}_TEXT_COLOR`
- `active`: `true` (except charset 2 if its alpha == 0 in v1, indicating 2-color mode)
- `name`: preset's localized name

**Action key groups** — 4 separate groups:

| Group Name | Members | Color Source |
|---|---|---|
| Space Key | `["space"]` | `ISSIE_KEYBOARD_SPACE_COLOR` |
| Delete Key | `["backspace"]` | `ISSIE_KEYBOARD_BACKSPACE_COLOR` |
| Enter Key | `["enter"]` | `ISSIE_KEYBOARD_ENTER_COLOR` |
| Other Keys | `["keyset", "next-keyboard", "settings", "close"]` | `ISSIE_KEYBOARD_OTHERDEFAULTKEYS_COLOR` |

**Special keys group** — only if `ISSIE_KEYBOARD_SPECIAL_KEYS_TEXT` is non-empty:
- `members`: individual characters from the special keys text string
- `bgColor`: from `ISSIE_KEYBOARD_SPECIAL_KEYS_COLOR`
- `color`: from `ISSIE_KEYBOARD_SPECIAL_KEYS_TEXT_COLOR`
- `visibilityMode`: `"default"` (highlight, not hide)

**Visible keys group** — only if `ISSIE_KEYBOARD_VISIBLE_KEYS` is non-empty:
- `members`: individual characters from the visible keys string
- `visibilityMode`: `"showOnly"`

### Core Data Access

The v1 Core Data model has entity `ConfigSet` with all-optional String attributes. Key naming: Core Data uses `iSSIE_` prefix (lowercase `i`), UserDefaults uses `ISSIE_` (uppercase). The migration reads from Core Data directly.

Attributes read per ConfigSet:

| Attribute | Purpose |
|---|---|
| `configurationName` | Profile display name |
| `iSSIE_KEYBOARD_BACKGROUND_COLOR` | Background color |
| `iSSIE_KEYBOARD_KEYS_COLOR` | Master keys color |
| `iSSIE_KEYBOARD_TEXT_COLOR` | Master text color |
| `iSSIE_KEYBOARD_CHARSET1_KEYS_COLOR` | Charset 1 bg |
| `iSSIE_KEYBOARD_CHARSET1_TEXT_COLOR` | Charset 1 text |
| `iSSIE_KEYBOARD_CHARSET2_KEYS_COLOR` | Charset 2 bg |
| `iSSIE_KEYBOARD_CHARSET2_TEXT_COLOR` | Charset 2 text |
| `iSSIE_KEYBOARD_CHARSET3_KEYS_COLOR` | Charset 3 bg |
| `iSSIE_KEYBOARD_CHARSET3_TEXT_COLOR` | Charset 3 text |
| `iSSIE_KEYBOARD_SPACE_COLOR` | Space key color |
| `iSSIE_KEYBOARD_BACKSPACE_COLOR` | Delete key color |
| `iSSIE_KEYBOARD_ENTER_COLOR` | Enter key color |
| `iSSIE_KEYBOARD_OTHERDEFAULTKEYS_COLOR` | Other keys color |
| `iSSIE_KEYBOARD_SPECIAL_KEYS_TEXT` | Highlighted characters |
| `iSSIE_KEYBOARD_SPECIAL_KEYS_COLOR` | Highlight bg color |
| `iSSIE_KEYBOARD_SPECIAL_KEYS_TEXT_COLOR` | Highlight text color |
| `iSSIE_KEYBOARD_ROW_OR_COLUMN` | Division mode |
| `iSSIE_KEYBOARD_VISIBLE_KEYS` | Visible keys filter |
| `iSSIE_KEYBOARD_LANGUAGES` | Language mode + optional "@" suffix |

---

## Component 2: Preset Additions

### New Presets

Add to each language's predefined rules file (`assets/predefined-rules/{he,en,ar}.json`):

**Action key presets** — 4 individual presets (members identical across all languages):

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

Names should be localized per language file (Hebrew, Arabic translations).

---

## Component 3: Compatibility UI (React Native)

### File

`src/screens/ClassicEditorScreen.tsx`

### Access

- Toggle button in `EditorScreen` header area, only visible when `v1_user` flag is `true` in UserDefaults.
- v1 users land on Classic Editor by default.
- "Advanced View" button switches to v2 `EditorScreen`.
- "Classic View" button in `EditorScreen` switches back.

### UI Pattern: Master-Detail

Matches v1's exact navigation pattern.

**Sections list** — scrollable table, each row is one setting with an icon or color dot on the left side:

| Section Header | Row | Detail Type |
|---|---|---|
| (Main) | Reset | Action (reset to default) |
| | Keyboard Language | Language selector (he/en/ar) |
| | Key Order | Picker (Standard / ABC) |
| Main Colors | Background Color | Color picker |
| | Keys Color | Color picker (propagates to all charset groups) |
| | Text Color | Color picker (propagates to all charset groups) |
| Action Keys | Space Key Color | Color picker |
| | Delete Key Color | Color picker |
| | Enter Key Color | Color picker |
| | Other Keys Color | Color picker |
| Nikkud | Nikkud Settings | Picker (Basic / Full) |
| Division | Rows / Sections | Picker + 2/3 color toggle |
| Group 1 (label varies) | Keys Color | Color picker |
| | Text Color | Color picker |
| Group 2 (label varies) | Keys Color | Color picker (hidden in 2-color mode) |
| | Text Color | Color picker (hidden in 2-color mode) |
| Group 3 (label varies) | Keys Color | Color picker |
| | Text Color | Color picker |
| Special Keys | Special Keys Text | Text input |
| | Keys Color | Color picker |
| | Text Color | Color picker |
| Visible Keys | Visible Keys Text | Text input |
| Templates | Save / My IssieBoards | Profile management |

Group section labels change based on division mode:
- "By Rows": "Group 1 (Top Row)", "Group 2 (Middle Row)", "Group 3 (Bottom Row)"
- "By Sections": "Group 1 (Right/Left)", "Group 2 (Middle)", "Group 3 (Left/Right)"

### Detail View

Each setting opens its own detail screen with:
- **Back button** to return to sections list
- **"Show Keyboard" button** — toggleable, shows the live `KeyboardPreview` component
- **The control**: one of:
  - **Color picker**: color strip showing current value + grid of ~30 color circles (matching v1's palette)
  - **Text input**: text field for typing characters (special keys, visible keys)
  - **Picker**: segmented control (Standard/ABC, Basic/Full, Rows/Sections)
  - **Language selector**: 3 buttons (Hebrew, English, Arabic)

### How Controls Map to v2 Model

| Classic UI Control | v2 Profile Write |
|---|---|
| Keyboard Language | Switch active language, load that language's profile |
| Key Order (Standard/ABC) | Set `keyboardId` (`"he"` vs `"he_ordered"`) |
| Background Color | Set `backgroundColor` |
| Keys Color (master) | Set `keysBgColor` + update all 3 charset groups' `bgColor` |
| Text Color (master) | Set `textColor` + update all 3 charset groups' `color` |
| Space/Delete/Enter/Other Key Color | Update respective action key style group's `bgColor` |
| Nikkud (Basic/Full) | Set `diacritics.{keyboardId}.simpleMode` (`true`/`false`) in `SavedProfileDefinition` |
| Rows/Sections toggle | Deactivate current charset groups, activate the other set (row vs third presets), preserve colors |
| 2/3 color toggle | Activate or deactivate the middle charset group |
| Group N Keys Color | Update charset group N's `bgColor` |
| Group N Text Color | Update charset group N's `color` |
| Special Keys Text | Update special keys style group `members` |
| Special Keys Color | Update special keys group `bgColor` |
| Special Keys Text Color | Update special keys group `color` |
| Visible Keys Text | Update visible keys showOnly group `members` |
| Reset | Load the v2 "classic" built-in profile |
| Save / My IssieBoards | Existing profile save/load (same as v2 editor) |

### Division Mode Switching

When toggling between "By Rows" and "By Sections":

1. Read current colors from the active charset groups
2. Deactivate current groups (set `active: false`)
3. Find or create the target groups (from the other preset set)
4. Apply the saved colors to the new groups
5. Activate new groups (set `active: true`)

This preserves the user's color choices when switching modes.

---

## Component 4: Detection & Navigation Flow

### App Launch Sequence

```
App Launch
    │
    ▼
[Swift] V1Migration.swift
    │
    ├─ v2_migration_completed? ──yes──▶ Skip
    │
    └─ no ──▶ Read Core Data
              Convert templates
              Write v2 profiles
              Set v2_migration_completed = true
              Set v1_user = true
    │
    ▼
[React Native] AppNavigator.tsx
    │
    ├─ v1_user flag? ──yes──▶ ClassicEditorScreen (default)
    │                          ├─ "Advanced View" → EditorScreen
    │                          └─ EditorScreen has "Classic View" → back
    │
    └─ no ──▶ EditorScreen (default, no classic toggle)
```

### Switching Between Views

Both views operate on the same v2 profile model (`SavedProfileDefinition` + style groups in `KeyboardPreferences`).

- **Classic → Advanced**: Profile already has all style groups visible in the groups panel.
- **Advanced → Classic**: v2-only features preserved in the profile but not shown in classic UI.

---

## Component 5: Graceful Handling of v2-Only Features

When a profile has been edited in the Advanced editor:

### Preserved but not shown in Classic UI

- Extra style groups beyond charset/action/special/visible groups
- Custom font name
- Diacritics per-item hiding (beyond basic/full)
- Key gap, height preset, font size preset, font weight

### Represented in Classic UI

- Global colors (background, keys, text)
- Charset group colors (from whichever row/third groups are active)
- Action key colors (from the 4 action key groups)
- Special keys (from the special keys group)
- Visible keys (from the showOnly group)

### Edge Cases

- **Division mode ambiguity**: If both row and third groups are active (possible from advanced editor), classic UI picks whichever set was most recently created/modified. If ambiguous, default to "By Rows."
- **Multiple special-keys-like groups**: Classic UI shows only the first group that isn't a recognized preset (charset/action/visible).
- **Missing charset groups**: If a user deleted charset groups in advanced editor, classic UI shows them as "not set" with the global color as fallback.

---

## Implementation Order

1. **Preset additions** — Add action key presets to all language files
2. **V1Migration.swift** — Core Data reading + profile conversion
3. **ClassicEditorScreen.tsx** — Master-detail settings UI
4. **AppNavigator changes** — v1_user detection + classic/advanced toggle
5. **App Group update** — Change v2's App Group to `group.com.issieshapiro.Issieboard`

---

## Files Changed/Created

| File | Change |
|---|---|
| `ios/Shared/V1Migration.swift` | **New** — Migration logic |
| `ios/Shared/KeyboardPreferences.swift` | Update App Group identifier |
| `ios/IssieBoardNG/AppDelegate.swift` or native module | Call V1Migration on launch |
| `ios/*.entitlements` | Update App Group to `group.com.issieshapiro.Issieboard` |
| `ios/IssieBoardNG/IssieBoard.xcdatamodeld/` | **New** — Copy v1's Core Data model (required to read `IssieBoard.sqlite`) |
| `assets/predefined-rules/he.json` | Add action key presets |
| `assets/predefined-rules/en.json` | Add action key presets |
| `assets/predefined-rules/ar.json` | Add action key presets |
| `src/screens/ClassicEditorScreen.tsx` | **New** — Compatibility UI |
| `src/AppNavigator.tsx` | Add v1_user detection + navigation toggle |
| `src/screens/EditorScreen.tsx` | Add "Classic View" toggle button |
