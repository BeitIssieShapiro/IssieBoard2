# Selection Border Glow Design

## Problem

The 3pt blue selection border on keys is invisible when key or keyboard backgrounds are similar blue shades. This affects:
- Selected keys in the editor preview (AddStyleRuleModal, ClassicDetailView)
- Nikkud-active indicator
- Shift-active indicator

## Solution

Add a subtle white shadow glow behind the existing blue border on all "active indicator" borders. The glow ensures the blue border is visible against any background color.

## Scope

**iOS only** (KeyboardRenderer.swift). Android to follow later if needed.

## Visual Spec

- **Border:** Keep current `UIColor.systemBlue`, keep current width (3pt for selected, 2.5pt for nikkud/shift)
- **Shadow:** White (`UIColor.white`), opacity 0.7, radius 3pt, offset (0, 0) -- centered glow, no directional bias
- **Applies to:** All three active indicator types (selected, nikkud-active, shift-active)

## Implementation

### File: `ios/Shared/KeyboardRenderer.swift`

**Selected keys** (lines ~1434-1438):
Add shadow properties alongside the existing border:
```swift
if isSelected {
    visualKeyView.layer.borderWidth = 3.0
    visualKeyView.layer.borderColor = UIColor.systemBlue.cgColor
    visualKeyView.layer.shadowColor = UIColor.white.cgColor
    visualKeyView.layer.shadowOpacity = 0.7
    visualKeyView.layer.shadowRadius = 3.0
    visualKeyView.layer.shadowOffset = .zero
    visualKeyView.clipsToBounds = false
}
```

**Nikkud-active** (lines ~1440-1443) and **Shift-active** (lines ~1446-1449):
Same shadow properties added alongside their existing blue borders.

### Shadow Reset

Keys that don't have an active indicator should have shadow cleared (shadow properties default to no shadow on fresh views, but if views are reused, ensure reset).

### Considerations

- `clipsToBounds` must be `false` for the shadow to be visible outside the view bounds. Verify this doesn't conflict with key content clipping.
- Shadow rendering in keyboard extensions is lightweight (no blur layers, just Core Animation). Should not impact the 50MB memory limit.
- Start subtle (opacity 0.7, radius 3) and tune based on visual testing.
