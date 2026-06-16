# Session Summary: Nikkud Top-Row Mode — 2026-06-16

## What We Built

### Feature: Nikkud Top-Row Mode (iOS)

A new nikkud input mode where, instead of a per-letter popup, all configured nikkud signs appear as a **persistent row above the keyboard** when nikkud mode is active. Configured via `diacriticsSettings.nikkudMode: "topRow"` in the keyboard profile.

---

## Commits on `ui-improve` (this session, newest first)

| Commit | Description |
|--------|-------------|
| `9ab4efe` | Remove timer, use `textDidChange`/`selectionDidChange` for external kb context |
| `576b220` | Shadow text buffer for char-before-cursor; fix backspace after external kb input |
| `766f750` | Fix extra brace from textWillChange |
| `d4f12c8` | Async modifier state update in textDidChange |
| `b085ac3` | Wire `updateNikkudTopRowModifierStates` to `textDidChange` |
| `8e8c13a` | Disable modifiers per char, no-flicker update, dagesh toggle, shin↔sin replace, ש for shinSin |
| `a7057ec` | Toast appears at top; classic view dirty-check |
| `d19ef6e` | Per-modifier base letter |
| `c26ed5b` | Reset `nikkudActive` when nikkud disabled in config |
| `a3b9431` | Preserve `nikkudMode` on mode change; shrink buttons to fit; modifier base letter |
| `574eb4b` | Add `simpleMode` field to Swift `DiacriticsSettings` |
| `1849930` | Mode-aware top row; modifiers filtered by char before cursor |
| `e91f021` | Scalar-level vowel replacement (no char duplication); font 1.26x |
| `bb90267` | Preview scale height fix; suggestions after re-render; vowel conflict replacement |
| `ebdfcd1` | Correct height calculation — add row on top, not shrink rows |
| `169db05` | ButtonGroupRow for input mode UI; preview height update; font 1.4x |
| `4a96a03` | Top-row mode UI toggle in DiacriticsPanel + fix preview deactivation bug |
| `45f1d37` | `onNikkudStateChanged` → `updateKeyboardHeight` |
| `184a58a` | Inject top row in `renderKeyboard`; block popup in top-row mode |
| `6b6eca2` | `buildNikkudTopRow` + `nikkudTopRowButtonTapped` |
| `111c7e5` | Pass `isNikkudTopRowActive` to `calculateKeyboardHeight` in BaseKeyboardViewController |
| `b2ec0cd` | `calculateKeyboardHeight` accepts `nikkudTopRowActive` param |
| `afed1a5` | Expose `isNikkudTopRowActive` getter on `KeyboardRenderer` |
| `1ebe5d1` | Add `nikkudMode` field to `DiacriticsSettings` (Swift + TS) |

---

## Files Changed

### iOS (native keyboard)
- `ios/Shared/KeyboardModels.swift` — Added `nikkudMode`, `simpleMode`, `isAdvanced` fields
- `ios/Shared/KeyboardRenderer.swift` — `buildNikkudTopRow`, `updateNikkudTopRowModifierStates`, `isNikkudTopRowActive`, `calculateKeyboardHeight` with `nikkudTopRowActive`, top-row injection in `renderKeyboard`, popup blocked in top-row mode, `onGetCharBeforeCursor` callback
- `ios/Shared/KeyboardEngine.swift` — `insertNikkudMark` (vowel/dagesh/shinSin conflict replacement), shadow text buffer (`shadowTextBefore`, `seedShadowContext`, `syncShadowContext`), backspace fix (removed `hasText` guard)
- `ios/Shared/BaseKeyboardViewController.swift` — `textDidChange`/`selectionDidChange` for context updates, `seedShadowContext` on load/appear
- `ios/IssieBoardNG/KeyboardPreviewView.swift` — `onNikkudStateChanged` wired to re-render, `onGetCharBeforeCursor` wired to `syncedText`, `nikkudTopRowActive` passed to height calc, suggestions restored after re-render

### React Native (configurator)
- `types.ts` — Added `nikkudMode?: 'popup' | 'topRow'` to `DiacriticsSettings`
- `src/localization/strings.ts` — Added `inputMode`, `popup`, `topRow` strings (EN/HE/AR)
- `src/components/toolbox/DiacriticsPanel.tsx` — `ButtonGroupRow` for Popup/Top Row selector; `...settings` spread in all `handleModeChange` cases to preserve `nikkudMode`
- `apps/issievoice/src/screens/NewSettingsScreen.tsx` — Classic view button now checks `isDirty` before switching

### Other UI fixes
- Toast position: `bottom: 10%` → `top: 60` in `EditorScreen.tsx`

---

## How It Works

### Config
```json
"diacriticsSettings": {
  "he": {
    "nikkudMode": "topRow"
  }
}
```

### Behavior
- Long-press nikkud button → activates nikkud mode → top row appears above keyboard rows
- Top row shows all visible nikkud vowel signs + modifier buttons (dagesh, shin/sin)
- Vowel buttons: `◌ + mark`, font 1.26× base size, centered, shrink to fit if too many
- Modifier buttons: `ב + dagesh`, `ש + shin`, `ש + sin` — disabled (dimmed 40%) when char before cursor doesn't match `appliesTo`
- Mode-aware: basic mode hides `isAdvanced` items (chataf variants); full mode shows all; custom respects `hidden` list
- Tap vowel: replaces existing vowel on preceding char (scalar-level, no duplication)
- Tap dagesh: toggles on/off
- Tap shin/sin: replaces each other
- Row stays visible until nikkud button tapped again
- Keyboard grows by exactly one `rowHeight` when top row is active
- `updateNikkudTopRowModifierStates()` updates button enabled/alpha in-place (no re-render flicker)

---

## Open / Untested Items

### 1. External keyboard modifier state updates (NEEDS DEVICE TEST)
- **Status**: Implemented but only tested in simulator. Simulator does NOT fire `textDidChange`/`selectionDidChange` for hardware keyboard input — this is a known simulator limitation.
- **Implementation**: `textDidChange` → `seedShadowContext()` + `updateNikkudTopRowModifierStates()`. `selectionDidChange` → same. Shadow buffer updated after every native key press.
- **Expected on device**: Delegates should fire per Apple docs ("Handling text interactions in custom keyboards"). TestFlight build needed to verify.
- **Fallback**: Shadow buffer gives correct state for native keyboard presses regardless.

### 2. Native keyboard full-mode modifier display (NEEDS DEVICE TEST)
- User reported modifiers (dagesh/shinSin) not showing in full mode on native keyboard.
- Debug print added at `buildNikkudTopRow` entry — check logs on device for `currentKeyboardId` and `modifierCount`.
- May be a simulator-only issue.

### 3. Xcode device debugging broken
- `xcrun devicectl` crashes: CoreDevice framework has invalid code signature.
- Error: `code signature invalid in CoreDeviceCLISupport.framework`
- Fix options:
  - `sudo codesign --force --deep --sign - /Applications/Xcode.app`
  - Or `xcodebuild -runFirstLaunch`
  - Or re-download Xcode from App Store
- **Workaround used**: TestFlight distribution for device testing.

### 4. Android port
- Per CLAUDE.md: iOS-first. Android port of all nikkud top-row changes deferred.
- Files to port: `KeyboardRenderer.kt`, `KeyboardEngine.kt`, `KeyboardModels.kt` (or equivalent), `BaseKeyboardService.kt`

---

## Architecture Notes

### Height calculation
`calculateKeyboardHeight` uses base row count for row height calculation, then adds extra row height for the nikkud row — this correctly makes the keyboard taller without shrinking existing rows.

### No-flicker modifier update
`updateNikkudTopRowModifierStates()` uses `viewWithTag(nikkudTopRowTag)` (recursive) to find the top row, then updates `isEnabled`/`alpha` on tagged modifier buttons in-place. No keyboard re-render triggered.

### Shadow text buffer
`KeyboardEngine.shadowTextBefore` is seeded from `documentContextBeforeInput` at load time (when proxy has valid context) and updated after every native `insertText`/`deleteBackward`. `onGetCharBeforeCursor` uses live proxy first, falls back to shadow. This handles the case where `documentContextBeforeInput` returns empty (hardware keyboard context restriction).
