# Keyboard Height Strategy Specification

**Version**: 2.0
**Date**: March 9, 2026
**Status**: PROPOSAL

---

## Problem Statement

The current keyboard height implementation has several issues:

1. **Fixed pixel values** (54pt/74pt) don't scale well across devices
2. **Manual keyHeight setting** requires users to input exact pixel values
3. **No adaptation** to device orientation (portrait vs landscape)
4. **No consideration** for screen size differences (phone vs tablet, small vs large)
5. **Poor UX** on mobile devices where screen real estate is critical

### Current Implementation

**iOS** (`ios/Shared/KeyboardRenderer.swift:115-126`):
```swift
var baseRowHeight: CGFloat {
    if let customHeight = config?.keyHeight {
        return CGFloat(customHeight)  // User-specified exact value
    }
    let baseHeight: CGFloat = 54
    if isLargeScreen && !isPreviewMode {
        return baseHeight + 20  // 74px on iPad
    }
    return baseHeight  // 54px otherwise
}
```

**Android** (`android/.../KeyboardRenderer.kt:139-149`):
```kotlin
private fun getBaseRowHeight(): Float {
    config?.keyHeight?.let { customHeight ->
        return dpToPx(customHeight)  // User-specified exact value
    }
    return dpToPx(54)  // Default 54dp
}
```

---

## Design Goals

1. **Adaptive**: Keyboard height should automatically adapt to device and orientation
2. **Proportional**: Use percentage of screen height, not fixed pixels
3. **Predictable**: Users should understand what "Short/Normal/Tall" means
4. **Accessible**: Provide reasonable defaults that work for most users
5. **Customizable**: Allow power users to fine-tune with semantic presets
6. **Consistent**: Same behavior across iOS and Android

---

## Proposed Solution

### 1. Height Calculation Strategy

**Base Formula**:
```
keyboardHeight = screenHeight × heightPercentage × orientationMultiplier
rowHeight = (keyboardHeight - suggestionsBar - padding) / numberOfRows
```

**Target Percentages**:
- **Portrait Phone**: 40-45% of screen height
- **Landscape Phone**: 30-35% of screen height
- **Portrait Tablet**: 35-40% of screen height
- **Landscape Tablet**: 25-30% of screen height

**Rationale**:
- Portrait: More vertical space available, keyboard can be taller
- Landscape: Limited vertical space, keyboard must be compact
- Tablet: Generally more screen space, can be slightly smaller percentage-wise

---

### 2. Height Presets

Instead of fixed pixel values, provide **semantic size options**:

| Preset | Portrait % | Landscape % | Description | Use Case |
|--------|-----------|-------------|-------------|----------|
| **Compact** | 35% | 25% | Minimal keyboard, maximum content | Reading-heavy apps, viewing content |
| **Short** | 38% | 28% | Below normal | Users who want more screen space |
| **Normal** | 42% | 32% | **DEFAULT** - Balanced | Most users, general typing |
| **Tall** | 46% | 36% | Above normal | Users with larger fingers |
| **X-Tall** | 50% | 40% | Maximum comfort | Accessibility, motor challenges |

**Implementation**:
```typescript
enum KeyboardHeightPreset {
  COMPACT = 'compact',   // 35% / 25%
  SHORT = 'short',       // 38% / 28%
  NORMAL = 'normal',     // 42% / 32% [DEFAULT]
  TALL = 'tall',         // 46% / 36%
  X_TALL = 'x-tall',     // 50% / 40%
}
```

---

### 3. Device Type Detection

**Phone vs Tablet Classification**:

**iOS**:
```swift
enum DeviceType {
    case phone
    case tablet

    static var current: DeviceType {
        return UIDevice.current.userInterfaceIdiom == .pad ? .tablet : .phone
    }
}
```

**Android**:
```kotlin
enum class DeviceType {
    PHONE,
    TABLET;

    companion object {
        fun detect(context: Context): DeviceType {
            val screenLayout = context.resources.configuration.screenLayout
            val isTablet = (screenLayout and Configuration.SCREENLAYOUT_SIZE_MASK) >= Configuration.SCREENLAYOUT_SIZE_LARGE
            return if (isTablet) TABLET else PHONE
        }
    }
}
```

**Orientation Detection**:
```swift
// iOS
let isPortrait = UIScreen.main.bounds.height > UIScreen.main.bounds.width

// Android
val isPortrait = context.resources.configuration.orientation == Configuration.ORIENTATION_PORTRAIT
```

---

### 4. Detailed Calculation Algorithm

```swift
// Swift example (Kotlin will mirror this)

struct KeyboardDimensions {
    let screenWidth: CGFloat
    let screenHeight: CGFloat
    let deviceType: DeviceType
    let isPortrait: Bool
    let heightPreset: KeyboardHeightPreset

    func calculateKeyboardHeight() -> CGFloat {
        // 1. Get base percentage for preset and orientation
        let percentage = getBasePercentage()

        // 2. Apply device type modifier
        let deviceModifier = getDeviceModifier()

        // 3. Calculate target height
        let targetHeight = screenHeight * percentage * deviceModifier

        // 4. Apply constraints (min/max)
        return constrain(targetHeight)
    }

    private func getBasePercentage() -> CGFloat {
        switch (heightPreset, isPortrait) {
        case (.compact, true):  return 0.35
        case (.compact, false): return 0.25
        case (.short, true):    return 0.38
        case (.short, false):   return 0.28
        case (.normal, true):   return 0.42
        case (.normal, false):  return 0.32
        case (.tall, true):     return 0.46
        case (.tall, false):    return 0.36
        case (.xTall, true):    return 0.50
        case (.xTall, false):   return 0.40
        }
    }

    private func getDeviceModifier() -> CGFloat {
        // Tablets can be slightly more compact percentage-wise
        switch deviceType {
        case .phone:  return 1.0
        case .tablet: return 0.92  // 8% reduction on tablets
        }
    }

    private func constrain(_ height: CGFloat) -> CGFloat {
        // Absolute constraints to prevent unreasonable sizes
        let minHeight: CGFloat = 180  // Never smaller than 180pt
        let maxHeight: CGFloat = screenHeight * 0.55  // Never more than 55% of screen

        return max(minHeight, min(height, maxHeight))
    }

    func calculateRowHeight(numberOfRows: Int) -> CGFloat {
        let totalHeight = calculateKeyboardHeight()
        let suggestionsBarHeight: CGFloat = 40
        let topPadding: CGFloat = 0
        let bottomPadding: CGFloat = 0
        let rowSpacing: CGFloat = 5 * CGFloat(numberOfRows - 1)  // 5pt between rows

        let availableHeight = totalHeight - suggestionsBarHeight - topPadding - bottomPadding - rowSpacing
        return availableHeight / CGFloat(numberOfRows)
    }
}
```

---

### 5. Number of Rows Calculation

**Standard Layout**:
- Row 1: Top row (qwerty, etc.)
- Row 2: Home row (asdf, etc.)
- Row 3: Bottom row (zxcv, etc.)
- Row 4: Bottom row (123/space/return)
- **Total**: 4 rows of keys

**With Suggestions**:
- Suggestions bar: 40pt fixed height
- **Total height** = suggestions bar + (4 × rowHeight) + (3 × rowSpacing)

**Without Suggestions**:
- No suggestions bar
- **Total height** = (4 × rowHeight) + (3 × rowSpacing)

---

### 6. Configuration Format

**Old Format** (DEPRECATED):
```json
{
  "keyHeight": 54  // ❌ Direct pixel value - to be removed
}
```

**New Format**:
```json
{
  "heightPreset": "normal"  // ✅ Semantic preset
}
```

**Migration Strategy**:
1. If `keyHeight` is present (old format):
   - Convert to nearest preset:
     - `< 180pt` → `compact`
     - `180-200pt` → `short`
     - `200-220pt` → `normal`
     - `220-240pt` → `tall`
     - `> 240pt` → `x-tall`
2. If `heightPreset` is present (new format):
   - Use directly
3. If neither present:
   - Default to `normal`

---

### 7. UI Changes

**Settings Panel** (`src/components/toolbox/GlobalSettingsPanel.tsx`):

**BEFORE**:
```tsx
<Slider
  label="Key Height"
  min={40}
  max={120}
  step={1}
  value={keyHeight}
  onChange={(value) => dispatch({ type: 'SET_KEY_HEIGHT', payload: value })}
/>
```

**AFTER**:
```tsx
<SegmentedControl
  label="Keyboard Height"
  options={[
    { value: 'compact', label: 'Compact' },
    { value: 'short', label: 'Short' },
    { value: 'normal', label: 'Normal' },
    { value: 'tall', label: 'Tall' },
    { value: 'x-tall', label: 'X-Tall' },
  ]}
  value={heightPreset}
  onChange={(value) => dispatch({ type: 'SET_HEIGHT_PRESET', payload: value })}
  description="Height adapts automatically to device and orientation"
/>
```

---

### 8. Example Calculations

**iPhone 14 Pro** (393 × 852 points):

| Preset | Portrait | Landscape | Portrait Row | Landscape Row |
|--------|----------|-----------|--------------|----------------|
| Compact | 298pt (35%) | 137pt (25%) | 60pt | 24pt |
| Short | 324pt (38%) | 153pt (28%) | 66pt | 28pt |
| **Normal** | **358pt (42%)** | **175pt (32%)** | **73pt** | **34pt** |
| Tall | 392pt (46%) | 197pt (36%) | 80pt | 39pt |
| X-Tall | 426pt (50%) | 219pt (40%) | 87pt | 45pt |

**iPad Pro 12.9"** (1024 × 1366 points):

| Preset | Portrait | Landscape | Portrait Row | Landscape Row |
|--------|----------|-----------|--------------|----------------|
| Compact | 439pt (32%) | 256pt (25%) | 90pt | 52pt |
| Short | 478pt (35%) | 286pt (28%) | 98pt | 58pt |
| **Normal** | **528pt (39%)** | **327pt (32%)** | **108pt** | **67pt** |
| Tall | 577pt (42%) | 368pt (36%) | 118pt | 75pt |
| X-Tall | 627pt (46%) | 410pt (40%) | 128pt | 84pt |

*(Note: Tablet values use 0.92 device modifier)*

---

### 9. Implementation Phases

**Phase 1: Core Logic** (Week 1)
- [ ] Implement `KeyboardDimensions` calculator (iOS)
- [ ] Implement `KeyboardDimensions` calculator (Android)
- [ ] Add device type detection
- [ ] Add orientation detection
- [ ] Add preset-to-percentage mapping
- [ ] Add constraint logic

**Phase 2: Integration** (Week 1-2)
- [ ] Update `KeyboardRenderer` to use new calculator (iOS)
- [ ] Update `KeyboardRenderer` to use new calculator (Android)
- [ ] Add migration logic for old `keyHeight` values
- [ ] Update config models to include `heightPreset`
- [ ] Update parser to read `heightPreset`

**Phase 3: UI** (Week 2)
- [ ] Replace slider with segmented control
- [ ] Add preset descriptions
- [ ] Update preview to show keyboard with new heights
- [ ] Add visual indicator of current height percentage

**Phase 4: Testing** (Week 2-3)
- [ ] Test on iPhone SE (small phone)
- [ ] Test on iPhone 14 Pro (standard phone)
- [ ] Test on iPhone 14 Pro Max (large phone)
- [ ] Test on iPad (standard tablet)
- [ ] Test on iPad Pro 12.9" (large tablet)
- [ ] Test portrait and landscape for each device
- [ ] Test all 5 presets on each device/orientation
- [ ] Verify migration from old keyHeight values

**Phase 5: Documentation** (Week 3)
- [ ] Update user documentation
- [ ] Update developer documentation
- [ ] Add migration guide
- [ ] Update built-in profiles to use presets

---

### 10. Built-In Profile Updates

Update built-in profiles to use semantic presets:

**Classic Profile**:
```typescript
{
  id: 'classic',
  config: {
    backgroundColor: '#A0A0A0',
    keysBgColor: '#FFEB3B',
    textColor: '#0000FF',
    fontSize: 48,
    fontWeight: 'heavy',
    heightPreset: 'normal',  // ✅ Use semantic preset
    keyGap: 3,
    // ... other settings
  }
}
```

**High Contrast Profile**:
```typescript
{
  id: 'high-contrast',
  config: {
    backgroundColor: '#000000',
    keysBgColor: '#FFFFFF',
    textColor: '#000000',
    fontSize: 56,
    fontWeight: 'black',
    heightPreset: 'tall',  // ✅ Taller for accessibility
    keyGap: 6,
    // ... other settings
  }
}
```

---

### 11. Backward Compatibility

**Reading Old Configs**:
```swift
// iOS
func parseKeyHeight(from config: KeyboardConfig) -> KeyboardHeightPreset {
    // New format takes precedence
    if let preset = config.heightPreset {
        return KeyboardHeightPreset(rawValue: preset) ?? .normal
    }

    // Legacy format: convert keyHeight to preset
    if let oldHeight = config.keyHeight {
        return convertLegacyHeight(oldHeight)
    }

    // Default
    return .normal
}

private func convertLegacyHeight(_ height: Double) -> KeyboardHeightPreset {
    // Approximate conversions based on old 54pt default
    switch height {
    case ..<45:        return .compact
    case 45..<52:      return .short
    case 52..<60:      return .normal
    case 60..<70:      return .tall
    default:           return .xTall
    }
}
```

**Writing Configs**:
- Always write new `heightPreset` format
- Never write `keyHeight` anymore
- Migration happens transparently on first load

---

### 12. Open Questions

1. **Should we provide a "Custom" option?**
   - Pro: Power users want exact control
   - Con: Defeats the purpose of adaptive design
   - **Recommendation**: Start without it, add only if users request

2. **Should presets be per-device or universal?**
   - Pro (per-device): User sets "tall" on phone, "normal" on tablet
   - Con (per-device): More complex config management
   - **Recommendation**: Universal preset, calculator adapts

3. **Should we auto-adjust on screen rotation?**
   - Pro: Keyboard always optimal for current orientation
   - Con: Unexpected size changes might be jarring
   - **Recommendation**: YES - auto-adjust, it's expected behavior

4. **What about split keyboard on iPad?**
   - Split keyboard has different height requirements
   - **Recommendation**: Phase 2 feature, not in initial implementation

---

### 13. Success Metrics

**Quantitative**:
- [ ] Keyboard height within target % range on all devices
- [ ] Row height ≥ 44pt (iOS minimum tap target)
- [ ] Row height ≥ 48dp (Android minimum tap target)
- [ ] Preview height matches actual keyboard within 5%
- [ ] No keyboard taller than 55% of screen
- [ ] No keyboard shorter than 180pt

**Qualitative**:
- [ ] Users report keyboard "feels right" without adjustment
- [ ] Reduced support requests about keyboard size
- [ ] Positive feedback on adaptive behavior
- [ ] Smooth transition from portrait to landscape

---

### 14. Risk Assessment

**Low Risk**:
- Calculation logic is straightforward
- Can test extensively before release
- Migration is automatic

**Medium Risk**:
- Some users may prefer old fixed-height behavior
- Edge cases (very small/large screens) need testing
- Preview height calculation must match actual keyboard

**High Risk**:
- Breaking existing user configurations
- Performance impact of recalculating on rotation

**Mitigation**:
- Extensive testing on all device types
- Gradual rollout with opt-in beta period
- Fallback to reasonable defaults if calculation fails
- Keep migration logic simple and robust

---

## Summary

**Key Changes**:
1. ❌ Remove: Fixed `keyHeight` in pixels
2. ✅ Add: Semantic `heightPreset` (compact/short/normal/tall/x-tall)
3. ✅ Add: Automatic calculation based on screen size and orientation
4. ✅ Add: Device-aware adjustments (phone vs tablet)
5. ✅ Add: Migration from old format

**Benefits**:
- 🎯 Better defaults for all devices
- 📱 Adapts to portrait/landscape automatically
- ♿ Improved accessibility with semantic presets
- 🎨 Simpler UI (5 options vs infinite slider)
- 🔄 Consistent experience across iOS and Android

**Timeline**: 3 weeks (4 phases)

---

**Next Steps**:
1. Review and approve this spec
2. Create implementation tasks
3. Build calculator in iOS first (iOS-first rule)
4. Port to Android
5. Test extensively
6. Release in beta

---

**Feedback Questions**:
1. Are the target percentages (42% portrait, 32% landscape) reasonable?
2. Should we have 5 presets or more/fewer?
3. Any other factors we should consider (e.g., keyboard extension vs in-app)?
4. Should preview mode use different percentages?

**Document Status**: 📝 DRAFT - Awaiting Review
