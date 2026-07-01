# Nikkud Button Short-Tap as Space Fallback

## Problem

Users frequently mis-tap the space bar, hitting the adjacent nikkud button instead with their right thumb. The nikkud button currently ignores short taps (when nikkud is inactive), so the space is silently lost.

## Solution

When the nikkud button receives a short tap (nikkud inactive, normal keyboard mode), and the space key is narrower than 6 key-widths, treat the tap as a space press — routing through the same `onKeyPress` path as a real space tap.

## Scope

- iOS only (Android port deferred until iOS is approved)
- File: `ios/Shared/KeyboardRenderer.swift`

## Behavior Matrix

| Nikkud state | Layout | Short tap result |
|---|---|---|
| Active | any | Deactivate nikkud (unchanged) |
| Inactive | space < 6 key-widths | Emit space (new) |
| Inactive | space ≥ 6 key-widths | Ignore (unchanged, iPad/wide) |
| Inactive | selection/edit mode | Emit key press for selection (unchanged) |

Long-press behavior is unchanged in all cases.

## Implementation

### 1. Store `keyWidth` at render time

In `KeyboardRenderer`, add a stored property:

```swift
private var lastRenderedKeyWidth: CGFloat = 44
```

When building key rows, capture the width of any regular key button (not backspace/space/special) and store it in `lastRenderedKeyWidth`.

### 2. Find space button frame at tap time

Traverse `subviews` of the keyboard view to find the button whose encoded `accessibilityIdentifier` has `type == "space"`. Read its `frame.width`.

### 3. Synthesize space ParsedKey

Decode the space button's `accessibilityIdentifier` to get its `ParsedKey` (same mechanism already used for backspace and other keys). Pass it to `onKeyPress?`.

### 4. Guard condition

```swift
case "nikkud":
    if nikkudActive {
        // deactivate — unchanged
    } else if onKeyLongPress != nil {
        // selection mode — unchanged
    } else {
        // NEW: fallback to space if layout is narrow
        if let spaceKey = findSpaceParsedKey(),
           let spaceWidth = findSpaceButtonWidth(),
           spaceWidth < lastRenderedKeyWidth * 6 {
            onKeyPress?(spaceKey)
        }
        // else: ignore (wide layout / iPad)
    }
```

## Side Effects

Routing through `onKeyPress?` with the real space `ParsedKey` means:
- Word completion fires (suggestion accepted or word inserted)
- Shift resets to lowercase after sentence end
- All other space key observers fire normally

No special-casing needed.

## Out of Scope

- Android port (deferred)
- Haptic feedback difference between real space and nikkud-as-space
- Any change to long-press nikkud activation threshold
