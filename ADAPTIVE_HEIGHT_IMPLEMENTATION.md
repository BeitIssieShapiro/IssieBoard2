# Adaptive Keyboard Height - Implementation Summary

**Date**: March 9, 2026
**Status**: Ready for iOS testing (Android to follow)
**Update**: Now uses safe area height (excludes notch/Dynamic Island/home indicator)

---

## What Was Implemented

### 1. New Constants File (Merged into `ios/Shared/KeyboardModels.swift`)
✅ Created adaptive height calculator with easily adjustable constants

**4 Height Presets**:
- **Compact**: 35% portrait / 25% landscape
- **Normal**: 42% portrait / 32% landscape ← **DEFAULT**
- **Tall**: 46% portrait / 36% landscape
- **X-Tall**: 50% portrait / 40% landscape

**⚠️ IMPORTANT**: Percentages are now applied to **safe area height**, not full screen height!
- Excludes top insets (notch, Dynamic Island, status bar)
- Excludes bottom insets (home indicator)
- This prevents keyboard from being too tall on modern iPhones with notches

**Key Features**:
- Automatic device detection (phone vs tablet)
- Automatic orientation detection
- Tablet modifier (0.92x for more compact)
- Min/max constraints (180pt min, 55% max)
- Debug helper for testing

### 2. Updated Files

**iOS**:
- ✅ `ios/Shared/KeyboardDimensions.swift` - NEW calculator
- ✅ `ios/Shared/KeyboardModels.swift` - Added `heightPreset: String?` to `KeyboardConfig`
- ✅ `ios/Shared/KeyboardRenderer.swift` - Uses new calculator in `rowHeight` computed property

**TypeScript**:
- ✅ `types.ts` - Changed `keyHeight?: number` to `heightPreset?: 'compact' | 'normal' | 'tall' | 'x-tall'`

### 3. How It Works

**Old Way** (removed):
```json
{
  "keyHeight": 54  // Fixed pixels - doesn't adapt
}
```

**New Way**:
```json
{
  "heightPreset": "normal"  // Adapts automatically!
}
```

**Calculation Flow**:
1. Read `heightPreset` from config (defaults to "normal")
2. Get safe area bounds from window (excludes notch/home indicator)
3. Detect device type (phone/tablet) and orientation
4. Look up percentage from constants
5. Apply device modifier if tablet
6. Calculate: `safeAreaHeight × percentage × modifier`
7. Apply constraints (min 180pt, max 55%)
8. Divide by 4 rows to get row height

**Safe Area Example (iPhone 14 Pro Portrait)**:
- Full screen: 852pt
- Top inset (Dynamic Island): 59pt
- Bottom inset (home indicator): 34pt
- **Safe area height**: 759pt ← This is what we use
- Keyboard at 42%: 759 × 0.42 = 319pt (instead of 358pt with full screen)

---

## Constants to Tune

All percentages are in `KeyboardHeightConstants` struct:

```swift
// Portrait
static let compactPortrait: CGFloat = 0.35  // 35%
static let normalPortrait: CGFloat = 0.42   // 42% ← Try adjusting this
static let tallPortrait: CGFloat = 0.46     // 46%
static let xTallPortrait: CGFloat = 0.50    // 50%

// Landscape
static let compactLandscape: CGFloat = 0.25 // 25%
static let normalLandscape: CGFloat = 0.32  // 32% ← Try adjusting this
static let tallLandscape: CGFloat = 0.36    // 36%
static let xTallLandscape: CGFloat = 0.40   // 40%

// Modifiers
static let tabletModifier: CGFloat = 0.92   // Tablets 8% smaller
static let phoneModifier: CGFloat = 1.0     // Phones no change
```

---

## Testing Checklist

### iPhone 14 Pro (393 × 852 pt)

**Portrait Mode** (852pt height):
- [ ] Compact: Should be ~298pt (35%)
- [ ] **Normal: Should be ~358pt (42%)** ← Test this first
- [ ] Tall: Should be ~392pt (46%)
- [ ] X-Tall: Should be ~426pt (50%)

**Landscape Mode** (393pt height):
- [ ] Compact: Should be ~98pt (25%)
- [ ] **Normal: Should be ~126pt (32%)** ← Test this first
- [ ] Tall: Should be ~141pt (36%)
- [ ] X-Tall: Should be ~157pt (40%)

### iPad Pro 12.9" (1024 × 1366 pt)

**Portrait Mode** (1366pt height, 0.92 modifier):
- [ ] Compact: Should be ~439pt (35% × 0.92)
- [ ] **Normal: Should be ~528pt (42% × 0.92)** ← Test this first
- [ ] Tall: Should be ~577pt (46% × 0.92)
- [ ] X-Tall: Should be ~627pt (50% × 0.92)

**Landscape Mode** (1024pt height, 0.92 modifier):
- [ ] Compact: Should be ~235pt (25% × 0.92)
- [ ] **Normal: Should be ~301pt (32% × 0.92)** ← Test this first
- [ ] Tall: Should be ~338pt (36% × 0.92)
- [ ] X-Tall: Should be ~376pt (40% × 0.92)

### Rotation Test
- [ ] Start in portrait with "normal" preset
- [ ] Keyboard should be ~42% of portrait height
- [ ] Rotate to landscape
- [ ] Keyboard should automatically resize to ~32% of landscape height
- [ ] Rotate back to portrait
- [ ] Keyboard should return to ~42% of portrait height

### Edge Cases
- [ ] iPhone SE (small screen): keyboard should respect 180pt minimum
- [ ] Preview mode: should use same logic as actual keyboard
- [ ] Config without `heightPreset`: should default to "normal"

---

## Next Steps (After Approval)

1. **Add UI Control** in `GlobalSettingsPanel.tsx`:
   - Replace slider with segmented control
   - 4 buttons: Compact / Normal / Tall / X-Tall

2. **Update Built-In Profiles**:
   - `classic`: `heightPreset: "normal"`
   - `high-contrast`: `heightPreset: "tall"` (for accessibility)

3. **Port to Android** (after iOS approval):
   - Create `KeyboardDimensions.kt`
   - Update `KeyboardRenderer.kt`
   - Update `KeyboardConfigParser.kt`

---

## How to Test

### Method 1: Hardcode a preset temporarily
In `KeyboardRenderer.swift`, line ~120, temporarily hardcode:
```swift
let preset = .normal  // or .compact, .tall, .xTall
```

### Method 2: Add to config JSON
In `ios/IssieBoardHe/default_config.json`:
```json
{
  "heightPreset": "tall",
  ...
}
```

### Method 3: Use console logging
The `KeyboardDimensions` struct has a `debugDescription()` method that prints:
```
📐 Keyboard Dimensions:
   Screen: 393 × 852pt
   Device: phone
   Orientation: Portrait
   Preset: normal
   ---
   Keyboard Height: 358pt (42.0%)
   Row Height: 73pt
```

---

## If Heights Feel Wrong

**Too tall?** Reduce the percentages in `KeyboardHeightConstants`:
```swift
static let normalPortrait: CGFloat = 0.40   // Try 40% instead of 42%
static let normalLandscape: CGFloat = 0.30  // Try 30% instead of 32%
```

**Too short?** Increase the percentages:
```swift
static let normalPortrait: CGFloat = 0.45   // Try 45% instead of 42%
static let normalLandscape: CGFloat = 0.35  // Try 35% instead of 32%
```

**Different on tablet?** Adjust the tablet modifier:
```swift
static let tabletModifier: CGFloat = 0.90   // Try 90% instead of 92%
```

---

## Files Changed

```
NEW:  ios/Shared/KeyboardDimensions.swift
MOD:  ios/Shared/KeyboardModels.swift (added heightPreset)
MOD:  ios/Shared/KeyboardRenderer.swift (use new calculator)
MOD:  types.ts (changed keyHeight to heightPreset)
```

---

**Ready to test!** Build for iOS and try rotating the device to see adaptive behavior.
