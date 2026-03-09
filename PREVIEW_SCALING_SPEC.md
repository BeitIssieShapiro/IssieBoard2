# Keyboard Preview Scaling Specification

**Date**: March 9, 2026
**Purpose**: Scale keyboard preview proportionally to fit container while maintaining accurate representation

---

## Problem Statement

Currently, the keyboard preview in the editor either:
1. Renders at full size and gets cut off if too tall, OR
2. Uses a fixed scale that doesn't preserve proportions

We want the preview to:
- ✅ Fit within a container of `maxHeight`
- ✅ Scale proportionally (width, height, fontSize all scale together)
- ✅ Look exactly like the real keyboard, just smaller
- ✅ Maintain aspect ratio and visual fidelity

---

## Design Goals

1. **Truthful Preview**: Preview looks exactly like the real keyboard, just scaled down
2. **Proportional Scaling**: If keyboard is scaled to 0.8×, everything (width, height, fonts) scales to 0.8×
3. **Container-Aware**: Automatically fits within provided `maxHeight`
4. **Responsive**: Recalculates when keyboard config changes or container resizes

---

## Architecture

### 1. Scale Calculation

```swift
// iOS: KeyboardRenderer.swift
private func calculatePreviewScale(keyboardHeight: CGFloat, maxHeight: CGFloat) -> CGFloat {
    guard keyboardHeight > 0 && maxHeight > 0 else {
        return 1.0
    }

    // If keyboard fits, no scaling needed
    if keyboardHeight <= maxHeight {
        return 1.0
    }

    // Scale down to fit
    let scale = maxHeight / keyboardHeight

    // Don't scale too small (min 0.5 = 50%)
    return max(scale, 0.5)
}
```

**Flow**:
1. Calculate keyboard height using adaptive dimensions (with heightPreset)
2. Compare to `maxHeight` provided by container
3. Calculate scale ratio: `scale = maxHeight / keyboardHeight`
4. Apply scale to all dimensions

### 2. What Gets Scaled

| Element | Original Value | Scaled Value |
|---------|---------------|--------------|
| **Total Height** | `keyboardHeight` | `keyboardHeight × scale` |
| **Total Width** | `containerWidth` | `containerWidth × scale` |
| **Row Height** | `rowHeight` | `rowHeight × scale` |
| **Font Size** | `fontSize` | `fontSize × scale` |
| **Key Corner Radius** | `5pt` | `5pt × scale` |
| **Key Gap** | `keyGap` (from config) | `keyGap × scale` |
| **Suggestions Bar Height** | `40pt` | `40pt × scale` |
| **Padding/Margins** | `keyInternalPadding` (3pt) | `3pt × scale` |

**⚠️ Important**: Everything scales, not just visual size. This ensures preview is pixel-perfect.

### 3. Implementation Approach

**Option A: CSS/Transform Scale** (Simplest)
```swift
// Apply transform to entire keyboard view
keyboardView.transform = CGAffineTransform(scaleX: scale, y: scale)
```
- ✅ Pro: Simple, everything scales automatically
- ❌ Con: Can cause rendering artifacts, touch targets off
- ❌ Con: Not suitable for keyboard preview (needs accurate layout)

**Option B: Scale All Dimensions** (Recommended)
```swift
// Calculate scaled dimensions
let scaledRowHeight = rowHeight * scale
let scaledFontSize = fontSize * scale
let scaledKeyGap = keyGap * scale
let scaledCornerRadius = keyCornerRadius * scale

// Use scaled values when building keyboard
```
- ✅ Pro: Accurate layout, no rendering artifacts
- ✅ Pro: Touch targets work correctly (if interactive)
- ✅ Pro: Preview exactly represents real keyboard
- ❌ Con: More code (need to scale each dimension)

**Decision**: Use **Option B** for accuracy

---

## Implementation Details

### 1. Add `maxHeight` Parameter to Renderer

**`KeyboardRenderer.swift`**:
```swift
class KeyboardRenderer {
    // MARK: - Preview Mode Properties

    /// Maximum height for preview mode (if set, keyboard will scale to fit)
    private var previewMaxHeight: CGFloat?

    /// Current scale factor (1.0 = full size, 0.8 = 80%, etc.)
    private var currentScale: CGFloat = 1.0

    // ...

    /// Set preview mode with maximum height
    func setPreviewMode(maxHeight: CGFloat?) {
        self.isPreviewMode = true
        self.previewMaxHeight = maxHeight
        // Recalculate layout with new constraints
        setNeedsLayout()
    }
}
```

### 2. Calculate Scale During Layout

```swift
private func calculateLayout() {
    // Step 1: Calculate keyboard dimensions at full size
    let dimensions = KeyboardDimensions(
        screenWidth: container.bounds.width,
        screenHeight: availableSafeAreaHeight,
        deviceType: .current,
        heightPreset: heightPreset
    )

    let fullKeyboardHeight = dimensions.calculateKeyboardHeight()
    let fullRowHeight = dimensions.calculateRowHeight(numberOfRows: 4, hasSuggestions: hasSuggestions)

    // Step 2: Calculate scale if in preview mode
    if isPreviewMode, let maxHeight = previewMaxHeight {
        currentScale = calculatePreviewScale(
            keyboardHeight: fullKeyboardHeight,
            maxHeight: maxHeight
        )
    } else {
        currentScale = 1.0  // Full size for actual keyboard
    }

    // Step 3: Apply scale to all dimensions
    let scaledRowHeight = fullRowHeight * currentScale
    let scaledFontSize = getFontSize() * currentScale
    let scaledKeyGap = getKeyGap() * currentScale
    // ... etc
}

private func calculatePreviewScale(keyboardHeight: CGFloat, maxHeight: CGFloat) -> CGFloat {
    guard keyboardHeight > 0 && maxHeight > 0 else {
        return 1.0
    }

    if keyboardHeight <= maxHeight {
        return 1.0  // No scaling needed
    }

    let scale = maxHeight / keyboardHeight
    return max(scale, 0.5)  // Min 50% scale
}
```

### 3. Apply Scale to All Dimensions

```swift
// Font size
private var scaledFontSize: CGFloat {
    let baseFontSize = config?.fontSize ?? 48
    return CGFloat(baseFontSize) * currentScale
}

// Row height
private var scaledRowHeight: CGFloat {
    return rowHeight * currentScale
}

// Key gap
private var scaledKeyGap: CGFloat {
    let baseKeyGap = config?.keyGap ?? 3
    return CGFloat(baseKeyGap) * currentScale
}

// Corner radius
private var scaledCornerRadius: CGFloat {
    return keyCornerRadius * currentScale
}

// Suggestions bar height
private var scaledSuggestionsBarHeight: CGFloat {
    return suggestionsBarHeight * currentScale
}

// Key padding
private var scaledKeyPadding: CGFloat {
    return keyInternalPadding * currentScale
}
```

### 4. TypeScript/React Native Side

**`InteractiveCanvas.tsx`**:
```tsx
export const InteractiveCanvas: React.FC<InteractiveCanvasProps> = ({
  onTestInput,
  height  // This is the maxHeight for the preview
}) => {
  // ... existing code ...

  // Pass maxHeight to native preview
  return (
    <KeyboardPreview
      style={{
        width: windowWidth - 60,
        height: height,  // Container height (maxHeight)
      }}
      configJson={configJson}
      maxHeight={height}  // NEW: Tell native to scale to fit this height
      onKeyPress={handleKeyPress}
      onHeightChange={handleHeightChange}
    />
  );
};
```

**`KeyboardPreview.tsx`**:
```tsx
interface KeyboardPreviewProps {
  style?: ViewStyle;
  configJson: string;
  maxHeight?: number;  // NEW: Maximum height for scaling
  onKeyPress?: (event: KeyPressEvent) => void;
  onHeightChange?: (event: { nativeEvent: { height: number } }) => void;
}

const KeyboardPreviewComponent = requireNativeComponent<KeyboardPreviewProps>(
  'KeyboardPreviewView'
);
```

**Native View Manager** (`KeyboardPreviewViewManager.m`):
```objc
RCT_EXPORT_VIEW_PROPERTY(maxHeight, NSNumber)
```

**Native View** (`KeyboardPreviewView.swift`):
```swift
@objc var maxHeight: NSNumber? {
    didSet {
        if let height = maxHeight?.doubleValue {
            renderer.setPreviewMode(maxHeight: CGFloat(height))
        }
    }
}
```

---

## Example Calculation

**iPhone 14 Pro, Portrait, Normal Preset**:

```
1. Calculate full-size keyboard:
   - Safe area height: 759pt
   - Keyboard height (42%): 319pt
   - Row height: 65pt
   - Font size: 48pt

2. Container provides maxHeight = 250pt

3. Calculate scale:
   scale = 250 / 319 = 0.784 (78.4%)

4. Apply scale to all dimensions:
   - Scaled keyboard height: 319 × 0.784 = 250pt ✅ (fits container)
   - Scaled row height: 65 × 0.784 = 51pt
   - Scaled font size: 48 × 0.784 = 38pt
   - Scaled key gap: 3 × 0.784 = 2.35pt
   - Scaled corner radius: 5 × 0.784 = 3.9pt

5. Result:
   - Preview is 78.4% of full size
   - All proportions maintained
   - Looks exactly like real keyboard, just smaller
```

---

## Edge Cases

### 1. Keyboard Already Fits
```swift
// Full keyboard height: 200pt
// Container maxHeight: 300pt
// Scale: 1.0 (no scaling needed)
```
**Result**: Keyboard renders at full size

### 2. Extreme Scaling
```swift
// Full keyboard height: 400pt
// Container maxHeight: 100pt
// Scale would be: 100 / 400 = 0.25 (25%)
// Apply min constraint: max(0.25, 0.5) = 0.5 (50%)
```
**Result**: Keyboard scales to 50% minimum, may not fit container
**UI Handling**: Show scrollview or increase container height

### 3. Configuration Changes
```swift
// User changes heightPreset from "normal" to "tall"
// Keyboard height increases from 319pt to 350pt
// Scale recalculates: 250 / 350 = 0.714 (71.4%)
```
**Result**: Keyboard automatically rescales to fit

### 4. Orientation Change
```swift
// Portrait: keyboard height 319pt, container 250pt, scale 0.784
// → Landscape: keyboard height 175pt, container 250pt, scale 1.0
```
**Result**: No scaling needed in landscape (keyboard fits)

---

## Testing Checklist

### Scale Calculation
- [ ] Keyboard exactly at maxHeight renders at 1.0 scale
- [ ] Keyboard 2× maxHeight renders at 0.5 scale
- [ ] Keyboard < maxHeight renders at 1.0 scale (no upscaling)
- [ ] Minimum scale constraint (0.5) is enforced

### Visual Accuracy
- [ ] Preview proportions match real keyboard
- [ ] Font sizes scale correctly
- [ ] Key shapes (corner radius) scale correctly
- [ ] Gaps between keys scale correctly
- [ ] Suggestions bar scales correctly

### Dynamic Updates
- [ ] Changing heightPreset triggers rescale
- [ ] Changing fontSize triggers rescale
- [ ] Changing keyGap triggers rescale
- [ ] Container resize triggers rescale
- [ ] Orientation change triggers rescale

### Edge Cases
- [ ] Very tall keyboard (scale < 0.5) handled gracefully
- [ ] Very short keyboard (no scaling) works correctly
- [ ] Config with no heightPreset uses default
- [ ] Missing maxHeight falls back to no scaling

---

## Implementation Phases

### Phase 1: Core Scaling Logic (iOS)
**Estimated**: 2-3 hours

- [ ] Add `previewMaxHeight` property to KeyboardRenderer
- [ ] Add `currentScale` property
- [ ] Implement `calculatePreviewScale()` method
- [ ] Update `setPreviewMode()` to accept maxHeight
- [ ] Create computed properties for scaled dimensions:
  - [ ] `scaledRowHeight`
  - [ ] `scaledFontSize`
  - [ ] `scaledKeyGap`
  - [ ] `scaledCornerRadius`
  - [ ] `scaledSuggestionsBarHeight`
  - [ ] `scaledKeyPadding`

### Phase 2: Apply Scaling to Layout (iOS)
**Estimated**: 2-3 hours

- [ ] Use scaled dimensions in key rendering
- [ ] Use scaled dimensions in row layout
- [ ] Use scaled dimensions in suggestions bar
- [ ] Test visual accuracy at different scales

### Phase 3: React Native Integration
**Estimated**: 1-2 hours

- [ ] Add `maxHeight` prop to KeyboardPreview component
- [ ] Update TypeScript types
- [ ] Update native view manager (iOS)
- [ ] Pass maxHeight from InteractiveCanvas
- [ ] Test prop changes trigger re-render

### Phase 4: Testing & Polish
**Estimated**: 1-2 hours

- [ ] Test all heightPresets with scaling
- [ ] Test orientation changes
- [ ] Test container resize
- [ ] Test min scale constraint
- [ ] Verify visual fidelity

**Total Estimated Time**: 6-10 hours

---

## Alternative: Use Native Transform (Future Optimization)

If performance becomes an issue, we could optimize by:

```swift
// Instead of scaling every dimension individually
// Apply a single transform to the entire keyboard view
let scale = calculatePreviewScale(...)
keyboardContainer.transform = CGAffineTransform(scaleX: scale, y: scale)
keyboardContainer.frame.origin = calculateCenteredOrigin()
```

**Trade-offs**:
- ✅ Much faster (single transform vs. many calculations)
- ✅ GPU-accelerated
- ❌ Touch targets need manual adjustment
- ❌ Text rendering can be blurry at certain scales
- ❌ Potential rendering artifacts

**Recommendation**: Start with dimension scaling (accurate), optimize later if needed

---

## Summary

**What**: Scale keyboard preview proportionally to fit within maxHeight
**How**: Calculate scale ratio, apply to all dimensions (height, width, fonts, gaps)
**Why**: Ensure preview accurately represents real keyboard at smaller size

**Key Changes**:
1. Add `maxHeight` parameter to renderer
2. Calculate scale = maxHeight / keyboardHeight
3. Scale all dimensions by this ratio
4. Pass maxHeight from React Native to native view

**Result**: Preview that looks exactly like the real keyboard, just proportionally smaller.

---

**Ready for implementation?** Let me know if you'd like me to start with Phase 1!
