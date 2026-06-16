# Nikkud Top-Row Mode

**Date:** 2026-06-15  
**Platform:** iOS only (Android port deferred)  
**Files touched:** `KeyboardModels.swift`, `KeyboardRenderer.swift`

---

## Overview

An alternative nikkud input mode where, instead of a per-letter popup, all configured nikkud signs appear as a persistent row at the top of the keyboard when nikkud mode is active. Pressing a sign inserts just the combining mark at the current cursor position. The row stays visible until the user taps the nikkud toggle button again.

---

## Config

`DiacriticsSettings` (in `KeyboardModels.swift`) gains one new optional field:

```swift
let nikkudMode: String?   // nil = "popup" (default), "topRow" = top row mode

var isTopRowMode: Bool { nikkudMode == "topRow" }
```

JSON:
```json
"diacriticsSettings": {
  "he": {
    "nikkudMode": "topRow"
  }
}
```

The existing `hidden` list still applies — items in `hidden` are excluded from the top row.

---

## Height Calculation

`calculateKeyboardHeight(for:keysetId:suggestionsEnabled:)` passes `numberOfRows` to `dimensions.calculateRowHeight`. When top-row nikkud mode is active (`nikkudActive && isTopRowMode`), pass `numberOfRows + 1` so the extension frame grows by one row height.

`isTopRowMode` is derived at call sites from:
```swift
config?.diacriticsSettings?[currentKeyboardId ?? ""]?.isTopRowMode ?? false
```

`nikkudActive` is internal renderer state, so `calculateKeyboardHeight` needs to accept an optional `nikkudTopRowActive: Bool = false` parameter, or the caller (BaseKeyboardViewController) reads `renderer.isNikkudTopRowActive` (new public getter).

---

## Rendering

In `renderKeyboard`, after suggestions bar setup and before the key rows loop:

```swift
let isTopRowMode = config?.diacriticsSettings?[currentKeyboardId ?? ""]?.isTopRowMode ?? false
if nikkudActive && isTopRowMode {
    let nikkudRowView = buildNikkudTopRow(availableWidth: availableWidth, height: effectiveRowHeight)
    rowsContainer.addSubview(nikkudRowView)
    nikkudRowView.frame = CGRect(x: effectiveHorizontalPadding, y: currentY,
                                  width: availableWidth, height: effectiveRowHeight)
    currentY += effectiveRowHeight + effectiveRowSpacing
}
// normal key rows follow at currentY
```

---

## `buildNikkudTopRow` method

Private method on `KeyboardRenderer`.

**Items to show:**
- All `DiacriticItem`s from `config.getDiacritics(for: currentKeyboardId)?.items`
- Filter out: items in `diacriticsSettings.hidden`, items where `isReplacement == true`, item with id `"plain"` (empty mark)

**Layout:**
- Fixed button count = filtered items count
- Button width = `effectiveRowHeight` (square keys)
- Total buttons width = `buttonWidth * count + gap * (count - 1)` where `gap = scaledKeyGap`
- Left offset = `(availableWidth - totalButtonsWidth) / 2` to center the row
- Each button is `effectiveRowHeight` tall

**Button display:**
- Label text: dotted circle + mark → `"◌" + item.mark` (so combining marks render visibly)
- Font size: `~36pt` (same as nikkud key icon size, hardcoded)
- Font weight: `configFontWeight`
- Same bg color, corner radius, shadow as normal key visual views

**Tap action:**
- Calls `onNikkudSelected?(item.mark)` — inserts only the combining mark at cursor
- Does NOT dismiss or re-render — row stays

---

## Nikkud Toggle Behavior (unchanged for tap, unchanged for deactivation)

- Long-press nikkud key → activates nikkud mode → re-render adds top row (if `isTopRowMode`)
- Short tap nikkud key when active → deactivates → re-render removes top row
- Popup mode path is unchanged (when `isTopRowMode == false`, existing popup logic runs)

---

## What Does NOT Change

- `NikkudPickerController` — untouched
- Popup mode behavior — untouched
- Android — deferred, iOS-first
- `DiacriticsGenerator`, modifier logic — untouched (top-row mode inserts raw marks only, no modifier UI)

---

## Open Questions

None. Modifier toggles (dagesh, shin/sin) are intentionally excluded from top-row mode — the row shows flat marks only.
