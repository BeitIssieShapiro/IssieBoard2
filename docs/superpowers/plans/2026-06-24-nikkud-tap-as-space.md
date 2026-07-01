# Nikkud Tap as Space Fallback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the nikkud button is short-tapped while inactive and the space key is narrower than 6 key-widths, treat the tap as a space press with full side effects (word completion, shift reset).

**Architecture:** Single change in `KeyboardRenderer.swift`. Store the width of a regular (non-special) key during render. In the `case "nikkud"` tap handler, when nikkud is inactive and normal keyboard mode, find the space button's frame, compare to `lastRenderedRegularKeyWidth * 6`, and if narrower, synthesize a `ParsedKey` from the space button's `accessibilityIdentifier` and call `onKeyPress?` with it.

**Tech Stack:** Swift, UIKit, `KeyboardRenderer.swift`

---

## File Map

| File | Change |
|---|---|
| `ios/Shared/KeyboardRenderer.swift` | Add stored property + helper method + guard in `case "nikkud"` |

---

### Task 1: Store regular key width during render

**Files:**
- Modify: `ios/Shared/KeyboardRenderer.swift` — stored properties block (~line 166) and row-render loop (~line 1478)

**Context:** The row-render loop builds each key button. Regular keys (not space/backspace/shift/keyset/nikkud/enter) have a consistent single-unit width. We capture that width so we can use it at tap time.

- [ ] **Step 1: Add stored property**

In the stored properties block (around line 166, after `private var lastRenderedWidth: CGFloat = 0`), add:

```swift
private var lastRenderedRegularKeyWidth: CGFloat = 44
```

- [ ] **Step 2: Capture regular key width in the render loop**

In `buildRowView` (the SECOND PASS loop around line 1478), after `let keyWidth = (CGFloat(effectiveWidth) / baselineWidth) * availableWidth`, add a capture for regular keys. Find the block that creates a button — it looks like:

```swift
let keyWidth = (CGFloat(effectiveWidth) / baselineWidth) * availableWidth
let button = createKeyButton(parsedKey, width: keyWidth, height: scaledRowHeight, ...)
```

Immediately after the `let keyWidth =` line, add:

```swift
let regularKeyTypes: Set<String> = ["space", "backspace", "shift", "keyset", "nikkud", "enter", "next-keyboard", "settings", "close", "language"]
if !regularKeyTypes.contains(parsedKey.type.lowercased()) && parsedKey.width == 1 {
    lastRenderedRegularKeyWidth = keyWidth
}
```

- [ ] **Step 3: Build and confirm no compiler errors**

Open Xcode, build the Hebrew keyboard target (`IssieBoardHe`). Expected: build succeeds, no new warnings.

---

### Task 2: Add `findSpaceKeyInfo()` helper

**Files:**
- Modify: `ios/Shared/KeyboardRenderer.swift` — add private helper near the other private helpers (around line 2820, before `encodeKeyInfo`)

**Context:** At tap time we need the space button's `ParsedKey` and frame width. We get both by walking the view hierarchy looking for a button whose decoded `accessibilityIdentifier` has `type == "space"`.

- [ ] **Step 1: Add the helper method**

Add this private method before `encodeKeyInfo` (~line 2820):

```swift
/// Find the space button and return its ParsedKey and frame width.
/// Returns nil if no space key is rendered (e.g. numeric keysets).
/// View hierarchy: container → rowsContainer → rowView → button (3 levels deep)
private func findSpaceKeyInfo() -> (key: ParsedKey, width: CGFloat)? {
    guard let container = container else { return nil }
    for rowsContainer in container.subviews {
        for rowView in rowsContainer.subviews {
            for button in rowView.subviews.compactMap({ $0 as? UIButton }) {
                guard let info = decodeKeyInfo(button.accessibilityIdentifier),
                      let type = info["type"] as? String,
                      type.lowercased() == "space",
                      let key = parseKeyFromInfo(info) else { continue }
                return (key: key, width: button.frame.width)
            }
        }
    }
    return nil
}
```

- [ ] **Step 2: Build and confirm no compiler errors**

Build `IssieBoardHe` in Xcode. Expected: build succeeds.

---

### Task 3: Redirect nikkud short-tap to space

**Files:**
- Modify: `ios/Shared/KeyboardRenderer.swift` — `case "nikkud":` block in `handleKeyTap` (~line 2651)

**Context:** The current `case "nikkud":` block has three branches: active (deactivate), selection mode (emit key), else (ignore). We replace the final `else { return }` with the space fallback logic.

- [ ] **Step 1: Locate the exact lines to replace**

The current `else` branch is:

```swift
} else {
    // Normal mode, nikkud inactive: requires 0.5 sec long-press to activate
    print("   → Ignoring quick tap on NIKKUD (requires 0.5 sec press to activate)")
    return
}
```

- [ ] **Step 2: Replace the else branch**

Replace those lines with:

```swift
} else {
    // Normal mode, nikkud inactive: short tap = space if layout is narrow
    if let spaceInfo = findSpaceKeyInfo(),
       spaceInfo.width < lastRenderedRegularKeyWidth * 6 {
        print("   → Nikkud short-tap: forwarding as space (spaceWidth=\(spaceInfo.width), threshold=\(lastRenderedRegularKeyWidth * 6))")
        onKeyPress?(spaceInfo.key)
    } else {
        print("   → Ignoring quick tap on NIKKUD (wide layout or no space key)")
    }
}
```

- [ ] **Step 3: Build and confirm no compiler errors**

Build `IssieBoardHe` in Xcode. Expected: build succeeds.

---

### Task 4: Manual test

**Context:** No unit test harness exists for `KeyboardRenderer`. Test manually in a real app session with the Hebrew keyboard.

- [ ] **Step 1: Deploy to device**

Deploy `IssieBoardHe` to a physical iPhone via Xcode. Switch system keyboard to IssieBoard Hebrew.

- [ ] **Step 2: Test — nikkud inactive, short tap on nikkud button**

Open any text field. Nikkud should be inactive (button not highlighted). Tap the nikkud button quickly.
Expected: a space is inserted in the text field.

- [ ] **Step 3: Test — word completion side effect**

Type "של" then quick-tap the nikkud button.
Expected: space inserted, word suggestions update (same as pressing real space).

- [ ] **Step 4: Test — shift reset side effect**

Type a sentence ending with period. Keyboard should auto-shift. Type a capital letter. Quick-tap nikkud.
Expected: space inserted, shift resets to lowercase.

- [ ] **Step 5: Test — nikkud active, short tap**

Long-press the nikkud button to activate nikkud mode (button highlighted). Then short-tap it.
Expected: nikkud deactivates. No space inserted.

- [ ] **Step 6: Test — long-press still activates nikkud**

Nikkud inactive. Long-press (0.5s) nikkud button.
Expected: nikkud activates. No space inserted.

- [ ] **Step 7: Test — iPad (if available)**

On iPad, quick-tap the nikkud button while inactive.
Expected: nothing happens (space key is wide, `spaceInfo.width >= lastRenderedRegularKeyWidth * 6`).

If no iPad available, verify with Xcode Simulator using an iPad target.
