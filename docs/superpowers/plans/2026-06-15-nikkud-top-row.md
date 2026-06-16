# Nikkud Top-Row Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `topRow` nikkud mode where all visible nikkud signs appear as a persistent centered row above the keyboard rows when nikkud mode is active, replacing the per-letter popup.

**Architecture:** `DiacriticsSettings` gains a `nikkudMode` field. `KeyboardRenderer` renders an extra nikkud row above normal rows when `nikkudActive && isTopRowMode`, and exposes a public getter so `BaseKeyboardViewController` can account for the extra row height. Normal popup mode is completely unchanged.

**Tech Stack:** Swift, UIKit, iOS keyboard extension

---

## File Map

| File | Change |
|------|--------|
| `ios/Shared/KeyboardModels.swift` | Add `nikkudMode: String?` + `isTopRowMode: Bool` to `DiacriticsSettings` |
| `ios/Shared/KeyboardRenderer.swift` | Add `isNikkudTopRowActive` getter, update `calculateKeyboardHeight`, inject nikkud row in `renderKeyboard`, add `buildNikkudTopRow` |
| `ios/Shared/BaseKeyboardViewController.swift` | Pass `nikkudTopRowActive` to `calculateKeyboardHeight` |

---

### Task 1: Add `nikkudMode` to `DiacriticsSettings` model

**Files:**
- Modify: `ios/Shared/KeyboardModels.swift` — `DiacriticsSettings` struct (around line 265)

- [ ] **Step 1: Add the field and computed property**

Open `ios/Shared/KeyboardModels.swift`. Find `DiacriticsSettings`:

```swift
struct DiacriticsSettings: Codable {
    let hidden: [String]?
    let disabledModifiers: [String]?
    let disabled: Bool?
    let nikkudMode: String?    // add this line

    enum CodingKeys: String, CodingKey {
        case hidden, disabledModifiers, disabled
        case nikkudMode                            // add this line
    }

    func isModifierEnabled(_ modifierId: String) -> Bool {
        guard let disabled = disabledModifiers else { return true }
        return !disabled.contains(modifierId)
    }

    var isDisabled: Bool {
        return disabled ?? false
    }

    var isTopRowMode: Bool {                       // add this computed property
        return nikkudMode == "topRow"
    }
}
```

- [ ] **Step 2: Build the iOS target to confirm it compiles**

In Xcode, select any keyboard target (e.g. `IssieBoardHe`) and press **Cmd+B**.  
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add ios/Shared/KeyboardModels.swift
git commit -m "feat(nikkud): add nikkudMode field to DiacriticsSettings"
```

---

### Task 2: Add public getter `isNikkudTopRowActive` to `KeyboardRenderer`

**Files:**
- Modify: `ios/Shared/KeyboardRenderer.swift` — public methods section (around line 474)

- [ ] **Step 1: Add the public getter**

In `KeyboardRenderer`, find the `// MARK: - Public Methods` section. Add this getter after `isInCursorMoveMode()`:

```swift
/// Returns true when nikkud top-row mode is active (nikkud toggle on + config set to topRow).
/// Used by BaseKeyboardViewController to compute the correct keyboard height.
var isNikkudTopRowActive: Bool {
    guard nikkudActive else { return false }
    return config?.diacriticsSettings?[currentKeyboardId ?? ""]?.isTopRowMode ?? false
}
```

- [ ] **Step 2: Build to confirm it compiles**

Press **Cmd+B**.  
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add ios/Shared/KeyboardRenderer.swift
git commit -m "feat(nikkud): expose isNikkudTopRowActive getter on KeyboardRenderer"
```

---

### Task 3: Update `calculateKeyboardHeight` to accept `nikkudTopRowActive`

**Files:**
- Modify: `ios/Shared/KeyboardRenderer.swift` — `calculateKeyboardHeight(for:keysetId:suggestionsEnabled:)` method (around line 482)

- [ ] **Step 1: Add the parameter and row count adjustment**

Find `func calculateKeyboardHeight(for config: KeyboardConfig, keysetId: String, suggestionsEnabled: Bool) -> CGFloat`. Change the signature and add the row count bump:

```swift
func calculateKeyboardHeight(
    for config: KeyboardConfig,
    keysetId: String,
    suggestionsEnabled: Bool,
    nikkudTopRowActive: Bool = false
) -> CGFloat {
    guard let keyset = config.keysets.first(where: { $0.id == keysetId }) else {
        return 216
    }

    guard let container = container else {
        return 216
    }

    let preset = KeyboardHeightPreset(rawValue: (UIDevice.current.userInterfaceIdiom == .pad ? config.heightPreset_large : nil) ?? config.heightPreset ?? "normal") ?? .normal
    let fontPreset = FontSizePreset(rawValue: (UIDevice.current.userInterfaceIdiom == .pad ? config.fontSizePreset_large : nil) ?? config.fontSizePreset ?? "normal") ?? .normal

    let screenBounds: CGRect
    if let windowScene = container.window?.windowScene {
        screenBounds = windowScene.screen.bounds
    } else {
        screenBounds = UIScreen.main.bounds
    }

    let safeAreaInsets = container.window?.safeAreaInsets ?? .zero
    let availableHeight = screenBounds.height - safeAreaInsets.top - safeAreaInsets.bottom

    let dimensions = KeyboardDimensions(
        screenWidth: container.bounds.width,
        screenHeight: availableHeight,
        deviceType: .current,
        heightPreset: preset,
        fontSizePreset: fontPreset
    )

    // Add 1 extra row when nikkud top-row is active
    let numberOfRows = keyset.rows.count + (nikkudTopRowActive ? 1 : 0)
    let calculatedRowHeight = dimensions.calculateRowHeight(numberOfRows: numberOfRows, hasSuggestions: suggestionsEnabled)

    let rowsHeight = CGFloat(numberOfRows) * calculatedRowHeight
    let spacingHeight = CGFloat(max(0, numberOfRows - 1)) * rowSpacing
    let suggestionsHeight = suggestionsEnabled ? calculatedRowHeight * 0.75 : 0
    let topPadding: CGFloat = 0
    let bottomPadding: CGFloat = 4

    let totalHeight = rowsHeight + spacingHeight + suggestionsHeight + topPadding + bottomPadding

    print("📐 [calculateKeyboardHeight] preset: \(preset), rowHeight: \(calculatedRowHeight), rows: \(numberOfRows), nikkudTopRow: \(nikkudTopRowActive), total: \(totalHeight)")

    return totalHeight
}
```

- [ ] **Step 2: Build to confirm it compiles**

Press **Cmd+B**.  
Expected: Build succeeds (default parameter means all existing call sites still work).

- [ ] **Step 3: Commit**

```bash
git add ios/Shared/KeyboardRenderer.swift
git commit -m "feat(nikkud): calculateKeyboardHeight accepts nikkudTopRowActive param"
```

---

### Task 4: Update `BaseKeyboardViewController` to pass `nikkudTopRowActive`

**Files:**
- Modify: `ios/Shared/BaseKeyboardViewController.swift` — `updateKeyboardHeight()` method (around line 166)

- [ ] **Step 1: Pass `isNikkudTopRowActive` to the height calculation**

Find `updateKeyboardHeight()`. Change the `calculateKeyboardHeight` call:

```swift
private func updateKeyboardHeight() {
    guard let config = parsedConfig else { return }

    let shouldDisable = shouldDisableSuggestionsForKeyboardType()
    let suggestionsEnabled = config.isWordSuggestionsEnabled && !shouldDisable

    let requiredHeight = keyboardEngine.renderer.calculateKeyboardHeight(
        for: config,
        keysetId: keyboardEngine.renderer.currentKeysetId,
        suggestionsEnabled: suggestionsEnabled,
        nikkudTopRowActive: keyboardEngine.renderer.isNikkudTopRowActive
    )

    if keyboardHeightConstraint?.constant != requiredHeight {
        keyboardHeightConstraint?.constant = requiredHeight
        view.setNeedsLayout()
        persistKeyboardHeight(requiredHeight)
    }
}
```

- [ ] **Step 2: Build to confirm it compiles**

Press **Cmd+B**.  
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add ios/Shared/BaseKeyboardViewController.swift
git commit -m "feat(nikkud): pass isNikkudTopRowActive to calculateKeyboardHeight"
```

---

### Task 5: Add `buildNikkudTopRow` method to `KeyboardRenderer`

**Files:**
- Modify: `ios/Shared/KeyboardRenderer.swift` — add private method after `buildGroupsMap` (around line 924)

- [ ] **Step 1: Add the method**

After the closing brace of `buildGroupsMap`, add:

```swift
/// Build the nikkud top-row view showing all visible nikkud signs as tappable square buttons.
private func buildNikkudTopRow(availableWidth: CGFloat, height: CGFloat) -> UIView {
    let rowView = UIView()

    guard let diacriticsDefinition = config?.getDiacritics(for: currentKeyboardId) else {
        return rowView
    }

    let hidden = config?.diacriticsSettings?[currentKeyboardId ?? ""]?.hidden ?? []

    // Filter to only standalone marks (exclude plain/empty and replacement items)
    let items = diacriticsDefinition.items.filter { item in
        guard item.id != "plain" else { return false }
        guard item.isReplacement != true else { return false }
        guard !hidden.contains(item.id) else { return false }
        return true
    }

    guard !items.isEmpty else { return rowView }

    let buttonSize: CGFloat = height
    let gap: CGFloat = scaledKeyGap
    let totalWidth = buttonSize * CGFloat(items.count) + gap * CGFloat(items.count - 1)
    let leftOffset = max(0, (availableWidth - totalWidth) / 2)

    let bgColor = getDefaultKeyBgColor()
    let textColor: UIColor = UIColor { traitCollection in
        traitCollection.userInterfaceStyle == .dark ? .white : .black
    }

    for (index, item) in items.enumerated() {
        let x = leftOffset + CGFloat(index) * (buttonSize + gap)

        // Tap button (full hit area)
        let button = UIButton(type: .system)
        button.backgroundColor = UIColor(white: 1.0, alpha: 0.001)
        button.frame = CGRect(x: x, y: 0, width: buttonSize, height: height)
        button.accessibilityIdentifier = item.mark
        button.addTarget(self, action: #selector(nikkudTopRowButtonTapped(_:)), for: .touchUpInside)

        // Visual key view (with gap padding)
        let visualKeyView = UIView()
        visualKeyView.isUserInteractionEnabled = false
        visualKeyView.backgroundColor = bgColor.adaptedForDarkMode()
        visualKeyView.layer.cornerRadius = scaledCornerRadius
        visualKeyView.layer.shadowColor = UIColor.black.cgColor
        visualKeyView.layer.shadowOffset = CGSize(width: 0, height: 1 * effectiveDimensionScale)
        visualKeyView.layer.shadowOpacity = 0.2
        visualKeyView.layer.shadowRadius = 1 * effectiveDimensionScale

        let gap2 = scaledKeyGap
        visualKeyView.frame = CGRect(
            x: gap2,
            y: scaledKeyVerticalPadding,
            width: buttonSize - gap2 * 2,
            height: height - scaledKeyVerticalPadding * 2
        )

        // Label: dotted circle + combining mark so the mark is visible
        let label = UILabel()
        label.isUserInteractionEnabled = false
        label.text = "◌" + item.mark
        label.font = UIFont.systemFont(ofSize: 36, weight: configFontWeight)
        label.textAlignment = .center
        label.textColor = textColor
        label.adjustsFontSizeToFitWidth = true
        label.minimumScaleFactor = 0.5
        label.frame = visualKeyView.bounds
        label.autoresizingMask = [.flexibleWidth, .flexibleHeight]

        visualKeyView.addSubview(label)
        button.addSubview(visualKeyView)
        rowView.addSubview(button)
    }

    return rowView
}

@objc private func nikkudTopRowButtonTapped(_ sender: UIButton) {
    guard let mark = sender.accessibilityIdentifier, !mark.isEmpty else { return }
    print("🎹 Nikkud top-row tapped: '\(mark)'")
    onNikkudSelected?(mark)
}
```

- [ ] **Step 2: Add `adaptedForDarkMode()` helper extension on `UIColor`**

In `KeyboardModels.swift`, add at the bottom of the `UIColor` extension (after `contrastingTextColor()`):

```swift
/// Returns a dark-mode-aware version of this color (darkens white for dark mode).
func adaptedForDarkMode() -> UIColor {
    if self == .white {
        return UIColor { traitCollection in
            traitCollection.userInterfaceStyle == .dark
                ? UIColor(red: 0.35, green: 0.35, blue: 0.38, alpha: 1.0)
                : .white
        }
    }
    return self
}
```

- [ ] **Step 3: Build to confirm it compiles**

Press **Cmd+B**.  
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add ios/Shared/KeyboardRenderer.swift ios/Shared/KeyboardModels.swift
git commit -m "feat(nikkud): add buildNikkudTopRow and nikkudTopRowButtonTapped"
```

---

### Task 6: Inject the nikkud top row in `renderKeyboard`

**Files:**
- Modify: `ios/Shared/KeyboardRenderer.swift` — `renderKeyboard` method, key rows loop (around line 866)

- [ ] **Step 1: Insert nikkud row before normal rows**

Find the section in `renderKeyboard` that reads:

```swift
for (rowIndex, row) in keyset.rows.enumerated() {
```

Just before that loop, add:

```swift
// Nikkud top row — rendered before normal rows when top-row mode is active
let isTopRowMode = config?.diacriticsSettings?[currentKeyboardId ?? ""]?.isTopRowMode ?? false
if nikkudActive && isTopRowMode {
    let nikkudRowView = buildNikkudTopRow(availableWidth: availableWidth, height: effectiveRowHeight)
    rowsContainer.addSubview(nikkudRowView)
    nikkudRowView.frame = CGRect(x: effectiveHorizontalPadding, y: currentY,
                                 width: availableWidth, height: effectiveRowHeight)
    currentY += effectiveRowHeight + effectiveRowSpacing
}
```

- [ ] **Step 2: Build to confirm it compiles**

Press **Cmd+B**.  
Expected: Build succeeds.

- [ ] **Step 3: Block nikkud popup for top-row mode**

In `handleKeyClick`, find the `default:` case where `nikkudActive && shouldShowDiacritics` triggers `showNikkudPicker`. Wrap the popup call so it only fires when NOT in top-row mode:

```swift
if nikkudActive && shouldShowDiacritics {
    // In top-row mode, keys type normally — nikkud is applied via the top row
    let isTopRowMode = config?.diacriticsSettings?[currentKeyboardId ?? ""]?.isTopRowMode ?? false
    if !isTopRowMode {
        let diacriticsOptions = getDiacriticsForKey(key)
        if !diacriticsOptions.isEmpty {
            showNikkudPicker(diacriticsOptions, anchorView: keyView)
        } else {
            onKeyPress?(key)
            if case .active = shiftState, !isSpace {
                shiftState = .inactive
                rerender()
            }
        }
    } else {
        // Top-row mode: regular letter key press, nikkud applied separately via top row
        onKeyPress?(key)
        if case .active = shiftState, !isSpace {
            shiftState = .inactive
            rerender()
        }
    }
} else {
    onKeyPress?(key)
    if case .active = shiftState, !isSpace {
        shiftState = .inactive
        rerender()
    }
}
```

- [ ] **Step 4: Build to confirm it compiles**

Press **Cmd+B**.  
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add ios/Shared/KeyboardRenderer.swift
git commit -m "feat(nikkud): inject top row in renderKeyboard, block popup in top-row mode"
```

---

### Task 7: Also call `updateKeyboardHeight` when nikkud state changes

**Files:**
- Modify: `ios/Shared/BaseKeyboardViewController.swift` — find where `renderer` triggers re-render after nikkud toggle

The nikkud toggle calls `rerender()` inside `KeyboardRenderer`, which calls `renderKeyboard`. But the extension height is set by `updateKeyboardHeight()` in `BaseKeyboardViewController`. We need `updateKeyboardHeight` to run after a nikkud toggle so the frame resizes.

- [ ] **Step 1: Find where renderKeyboard is called from BaseKeyboardViewController**

```bash
grep -n "renderKeyboard\|rerender\|onKeyPress\|nikkudActive\|updateKeyboardHeight" /Users/i022021/dev/Issie/IssieBoardNG/ios/Shared/BaseKeyboardViewController.swift | head -40
```

- [ ] **Step 2: Add a nikkud state change callback on KeyboardRenderer**

In `KeyboardRenderer.swift`, in the properties section near the other callbacks (around line 60), add:

```swift
/// Called when nikkud active state changes (so controller can update keyboard height)
var onNikkudStateChanged: (() -> Void)?
```

- [ ] **Step 3: Fire the callback when nikkud state changes**

In `handleKeyClick`, find both places where `nikkudActive` is toggled (`nikkudActive = true` in `keyLongPressed` and `nikkudActive = false` in the nikkud case of `handleKeyClick`). After each toggle + `rerender()` call, add:

In `keyLongPressed` (around line 1903):
```swift
if !nikkudActive {
    print("   → Activating NIKKUD mode after 0.5 sec press")
    nikkudActive = true
    rerender()
    onNikkudStateChanged?()   // add this line
}
```

In `handleKeyClick` case `"nikkud"` (around line 2426):
```swift
if nikkudActive {
    print("   → Handling NIKKUD tap (deactivating)")
    nikkudActive = false
    rerender()
    onNikkudStateChanged?()   // add this line
}
```

- [ ] **Step 4: Wire the callback in BaseKeyboardViewController**

In `BaseKeyboardViewController`, find where `keyboardEngine.renderer` callbacks are set up (search for `onKeyPress` assignment). Add:

```swift
keyboardEngine.renderer.onNikkudStateChanged = { [weak self] in
    self?.updateKeyboardHeight()
}
```

- [ ] **Step 5: Build to confirm it compiles**

Press **Cmd+B**.  
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add ios/Shared/KeyboardRenderer.swift ios/Shared/BaseKeyboardViewController.swift
git commit -m "feat(nikkud): trigger updateKeyboardHeight on nikkud state change for top-row resize"
```

---

### Task 8: Manual smoke test

No unit test harness exists for the native keyboard extension. Verify by running the keyboard in a simulator.

- [ ] **Step 1: Set `nikkudMode` in a test profile**

Find a Hebrew profile JSON in the app (or the React Native configurator). Set:

```json
"diacriticsSettings": {
  "he": {
    "nikkudMode": "topRow"
  }
}
```

Build and run the app target (not the extension) — `npm run ios` or run from Xcode.

- [ ] **Step 2: Activate the Hebrew keyboard in simulator Settings**

Settings → General → Keyboard → Keyboards → Add New Keyboard → select IssieBoard Hebrew.

- [ ] **Step 3: Open Notes and switch to the Hebrew keyboard**

Open Notes app, tap in a text field, switch to IssieBoard Hebrew.

- [ ] **Step 4: Verify inactive state**

Nikkud row should NOT be visible. Keyboard looks normal. ✓

- [ ] **Step 5: Long-press the nikkud toggle button**

Hold the nikkud (◌) button for 0.5 seconds. Expected:
- Nikkud button shows blue border
- A new row appears at the top with nikkud signs (◌ + each mark), centered
- Keyboard frame is taller by one row height ✓

- [ ] **Step 6: Tap a nikkud sign**

Tap e.g. the kamatz sign. Expected:
- The combining mark is inserted at cursor position
- The top row stays visible (does NOT dismiss) ✓

- [ ] **Step 7: Type a letter after applying nikkud**

Type a Hebrew letter. Expected:
- Letter types normally (no popup appears) ✓

- [ ] **Step 8: Tap a letter first, then tap a nikkud sign**

Type a letter, then tap a nikkud sign from the top row. Expected:
- Combining mark appended at cursor (letter + vowel) ✓

- [ ] **Step 9: Tap the nikkud button to deactivate**

Short-tap the nikkud button. Expected:
- Top row disappears
- Keyboard height returns to normal ✓

- [ ] **Step 10: Verify popup mode unaffected**

Remove `nikkudMode` from the JSON (or set it to `null`). Rebuild. Long-press nikkud, then tap a Hebrew letter. Expected: popup appears as before ✓
