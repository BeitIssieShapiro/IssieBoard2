# Rounded Keys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `roundedKeys` boolean to `KeyboardConfig` that makes key corner radius 50% of row height, and enable it for IssieCalc via `default_config.json`.

**Architecture:** Add `roundedKeys: Bool?` to the config model, change `keyCornerRadius` in the renderer from a stored constant to a computed property that reads the config flag, and set the flag in IssieCalc's default config. No new types, no UI changes.

**Tech Stack:** Swift (UIKit), JSON config

## Global Constraints

- iOS only — no Android changes
- No settings UI — config injection only for IssieCalc
- `roundedKeys` absent or `nil` must behave identically to current (corner radius = 5)
- Use `rowHeight` (unscaled) in `keyCornerRadius`, not `scaledRowHeight` — `scaledCornerRadius` already applies `effectiveDimensionScale`
- No commits — developer commits manually

---

### Task 1: Add `roundedKeys` to `KeyboardConfig`

**Files:**
- Modify: `ios/Shared/KeyboardModels.swift` — add property + coding key to `KeyboardConfig`

**Interfaces:**
- Produces: `KeyboardConfig.roundedKeys: Bool?` — consumed by Task 2

- [ ] **Step 1: Add the property and coding key**

In `ios/Shared/KeyboardModels.swift`, find `struct KeyboardConfig: Codable` (line ~6).

Add `let roundedKeys: Bool?` after `fontSizePreset_large`:

```swift
    let fontSizePreset_large: String?
    let roundedKeys: Bool?  // Add this line
```

In the same struct's `CodingKeys` enum, add:

```swift
        case fontSizePreset_large
        case roundedKeys  // Add this line
```

- [ ] **Step 2: Verify the project builds**

Open Xcode, select the IssieCalc scheme, and build (`Cmd+B`). Expected: build succeeds with no errors. The new optional field defaults to `nil` for all existing configs — no existing JSON needs updating.

---

### Task 2: Make `keyCornerRadius` config-aware in `KeyboardRenderer`

**Files:**
- Modify: `ios/Shared/KeyboardRenderer.swift` — change `keyCornerRadius` from stored constant to computed property

**Interfaces:**
- Consumes: `KeyboardConfig.roundedKeys: Bool?` from Task 1
- Consumes: `rowHeight: CGFloat` — existing computed property on `KeyboardRenderer` (line ~193)
- Consumes: `scaledCornerRadius: CGFloat` — existing computed property (line ~360) that multiplies `keyCornerRadius * effectiveDimensionScale`; no changes needed there

- [ ] **Step 1: Replace the stored constant with a computed property**

In `ios/Shared/KeyboardRenderer.swift`, find line ~311:

```swift
    private let keyCornerRadius: CGFloat = 5
```

Replace with:

```swift
    private var keyCornerRadius: CGFloat {
        guard config?.roundedKeys == true else { return 5 }
        return rowHeight * 0.5
    }
```

- [ ] **Step 2: Verify the project still builds**

Build in Xcode (`Cmd+B`). Expected: build succeeds. `scaledCornerRadius` uses `keyCornerRadius` unchanged, so all existing call sites (`visualKeyView.layer.cornerRadius = scaledCornerRadius`, `outlineView.layer.cornerRadius = scaledCornerRadius + 2`) are unaffected.

- [ ] **Step 3: Smoke-test with a non-IssieCalc keyboard**

Run any existing keyboard (e.g. IssieBoard English) in the simulator. Keys should look identical to before — `roundedKeys` is `nil` in all existing configs, so the guard returns `5` as before.

---

### Task 3: Enable rounded keys in IssieCalc's default config

**Files:**
- Modify: `ios/IssieCalc/default_config.json` — add `"roundedKeys": true`

**Interfaces:**
- Consumes: `KeyboardConfig.roundedKeys: Bool?` from Task 1

- [ ] **Step 1: Add the flag to the config**

In `ios/IssieCalc/default_config.json`, add `"roundedKeys": true` after `"keyGap_large": 4`:

```json
  "keyGap_large": 4,
  "roundedKeys": true,
  "fontWeight": "regular",
```

- [ ] **Step 2: Run IssieCalc in the simulator**

Select the IssieCalc scheme, run on simulator. Expected: all keys on the basic and scientific keysets have fully rounded (pill/circle) corners. Digit keys (square aspect ratio) should appear as circles. Operator keys (same aspect ratio) should appear as circles. The visual gap between keys (controlled by `keyGap`) should still be visible.

- [ ] **Step 3: Check preview mode scaling**

In the IssieCalc React Native app, if a `KeyboardPreview` is visible, verify the rounded keys scale correctly in preview — no exaggerated or flat corners.
