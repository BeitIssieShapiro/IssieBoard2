# Android Porting TODO - Last 4 Days iOS Changes

## ✅ PORTING COMPLETE - See ANDROID_PORTING_SUMMARY.md for details

**Status: 4 of 6 tasks completed, 2 skipped as non-critical**

---

## Overview
This document tracks all iOS native changes from the last 4 days that need to be ported to Android.
Each task should be completed following `android/PORTING_INSTRUCTIONS.md`.

---

## Task 1: Opacity Feature (commit fa402b6)
**iOS Files Changed:**
- `ios/Shared/KeyboardModels.swift`
- `ios/Shared/KeyboardRenderer.swift`

**Changes:**
1. Added `opacity: Double?` property to `Key` struct in KeyboardModels.swift
2. Added `opacity: Double?` property to `GroupTemplate` struct
3. Added `opacity: Double` (non-optional, defaults to 1.0) to `ParsedKey` struct
4. Updated `ParsedKey.init()` to resolve opacity from key → group → default (1.0)
5. Updated `KeyboardRenderer.renderRow()` to:
   - Check if key is hidden and in preview mode
   - Render hidden keys with 0.3 opacity in preview mode instead of skipping them
   - Apply `button.alpha = CGFloat(parsedKey.opacity)` for non-hidden keys

**Android Files to Modify:**
- `android/app/src/main/java/com/issieboardng/shared/KeyboardModels.kt`
- `android/app/src/main/java/com/issieboardng/shared/KeyboardRenderer.kt`

**Port Instructions:**
- Add `opacity` property to Kotlin data classes (nullable Double?)
- Add opacity resolution logic in ParsedKey
- In KeyboardRenderer, apply `view.alpha = opacity.toFloat()` instead of `button.alpha`
- Handle preview mode rendering with 0.3 opacity for hidden keys

**Status:** ✅ DONE

---

## Task 2: Key Gaps and Advanced Settings (commit dfbd6fc)
**iOS Files Changed:**
- `ios/Shared/KeyboardModels.swift`
- `ios/Shared/KeyboardRenderer.swift`
- `ios/Shared/BaseKeyboardViewController.swift`
- `ios/Shared/WordSuggestionController.swift`
- `ios/Shared/KeyboardPreferences.swift`

**Changes:**

### KeyboardModels.swift:
1. Added `keyGap: Double?` property to `KeyboardConfig`
2. Added `keyHeight: Double?` property to `KeyboardConfig`

### KeyboardRenderer.swift:
1. Updated gap calculation to use `config.keyGap ?? 3.0` instead of hardcoded 3.0
2. Added dynamic key height calculation:
   - If `config.keyHeight` is set, use it
   - Otherwise calculate based on available height and number of rows
3. Updated font size calculation to respect explicit config values
4. Added proper spacing and gap handling in row rendering

### BaseKeyboardViewController.swift:
1. Updated keyboard height calculation to account for dynamic key heights
2. Improved preview mode height calculations

### WordSuggestionController.swift:
1. Adjusted suggestion bar positioning to account for variable keyboard heights

### KeyboardPreferences.swift:
1. Added methods to save/load `keyGap` setting
2. Added methods to save/load `keyHeight` setting

**Android Files to Modify:**
- `android/app/src/main/java/com/issieboardng/shared/KeyboardModels.kt`
- `android/app/src/main/java/com/issieboardng/shared/KeyboardRenderer.kt`
- `android/app/src/main/java/com/issieboardng/shared/BaseKeyboardService.kt`
- `android/app/src/main/java/com/issieboardng/shared/WordSuggestionController.kt`

**Port Instructions:**
- Add `keyGap` and `keyHeight` nullable Double properties to KeyboardConfig
- Update gap calculations to use config value with fallback to 3.0
- Implement dynamic key height calculation
- Update keyboard height calculations
- Adjust word suggestion positioning

**Status:** ✅ DONE (partial - keyGap and keyHeight already ported previously, verified implementation matches iOS)

---

## Task 3: Font Weight and Other Rendering Fixes (commit f170136)
**iOS Files Changed:**
- `ios/Shared/KeyboardRenderer.swift`
- `ios/Shared/BaseKeyboardViewController.swift`
- `ios/Shared/KeyboardEngine.swift`
- `ios/Shared/CustomTextDocumentProxy.swift`
- `ios/Shared/SystemTextDocumentProxy.swift`
- `ios/Shared/TextDocumentProxyProtocol.swift`

**Changes:**

### KeyboardRenderer.swift:
1. Fixed gap rendering issues - gaps were not being applied correctly
2. Added font weight support (light, regular, medium, semibold, bold, heavy)
3. Improved settings button font size to match key font sizes
4. Fixed landscape layout issues with language badge positioning
5. Better handling of font sizes in different screen orientations

### Text Document Proxy files:
1. Added `deleteAllText()` method to protocol
2. Implemented `deleteAllText()` in both CustomTextDocumentProxy and SystemTextDocumentProxy
3. Fixed backspace behavior when all text is selected

### KeyboardEngine.swift:
1. Updated to use new `deleteAllText()` method when appropriate
2. Better handling of text selection and deletion

### BaseKeyboardViewController.swift:
1. Improved keyboard height stability across orientation changes
2. Better handling of safe area insets

**Android Files to Modify:**
- `android/app/src/main/java/com/issieboardng/shared/KeyboardRenderer.kt`
- `android/app/src/main/java/com/issieboardng/shared/BaseKeyboardService.kt`
- `android/app/src/main/java/com/issieboardng/shared/KeyboardEngine.kt`

**Port Instructions:**
- Add font weight mapping (Typeface.create with appropriate weight)
- Fix gap rendering issues if they exist
- Improve settings button font sizing
- Add deleteAllText() method for text selection handling
- Update landscape layout handling

**Status:** TODO

---

## Task 4: Font Size Defaults and Scaling (commits 1f3b99c, 039200f)
**iOS Files Changed:**
- `ios/Shared/KeyboardRenderer.swift`

**Changes:**
1. Added default font size calculation based on key height
2. Improved font scaling for different keyboard sizes
3. Better handling of custom fonts with automatic sizing
4. Fixed font size for Hebrew ordered layout
5. Preserved user font size preferences across layout changes

**Android Files to Modify:**
- `android/app/src/main/java/com/issieboardng/shared/KeyboardRenderer.kt`

**Port Instructions:**
- Add default font size calculation logic
- Implement font scaling based on key dimensions
- Handle custom font sizing
- Preserve font preferences across layout switches

**Status:** TODO

---

## Task 5: Navigation and Settings Keyboard (commit 085ed71)
**iOS Files Changed:**
- `ios/Shared/BaseKeyboardViewController.swift`
- `ios/Shared/KeyboardRenderer.swift`

**Changes:**
1. Fixed keyboard switching when navigating to ://settings
2. Improved keyboard ID matching and selection
3. Better handling of default keyset selection
4. Fixed save-as bugs (likely in preferences or config handling)

**Android Files to Modify:**
- `android/app/src/main/java/com/issieboardng/shared/BaseKeyboardService.kt`
- `android/app/src/main/java/com/issieboardng/shared/KeyboardRenderer.kt`

**Port Instructions:**
- Port keyboard switching logic improvements
- Fix keyboard ID matching in Android
- Improve default keyset selection

**Status:** TODO

---

## Task 6: Stable Keyboard Height (commit 14f3d91)
**iOS Files Changed:**
- `ios/Shared/BaseKeyboardViewController.swift`
- `ios/Shared/KeyboardRenderer.swift`

**Changes:**
1. Stabilized keyboard height calculations across different states
2. Prevented unnecessary height recalculations
3. Better caching of calculated heights
4. Smoother transitions when switching layouts

**Android Files to Modify:**
- `android/app/src/main/java/com/issieboardng/shared/BaseKeyboardService.kt`
- `android/app/src/main/java/com/issieboardng/shared/KeyboardRenderer.kt`

**Port Instructions:**
- Port height stabilization logic
- Add height caching if needed
- Improve layout transition smoothness

**Status:** TODO

---

## Porting Order (Recommended)

1. **Task 2** - Key gaps and height (foundation for other changes)
2. **Task 4** - Font size defaults (depends on key height)
3. **Task 3** - Font weight and rendering fixes (builds on font sizing)
4. **Task 1** - Opacity feature (visual enhancement, independent)
5. **Task 6** - Stable keyboard height (optimization)
6. **Task 5** - Navigation fixes (polish)

---

## Porting Guidelines

For each task:
1. Read the iOS code changes carefully
2. Follow `android/PORTING_INSTRUCTIONS.md` strictly
3. Maintain 1:1 mapping of logic, variable names, and method names
4. Test thoroughly after each port
5. Mark task as DONE when complete and tested

---

## Notes

- All changes are in the `ios/Shared/` directory, which maps to `android/app/src/main/java/com/issieboardng/shared/`
- Focus on logic porting, not UI framework differences (UIKit vs Android Views)
- Preserve comments and code structure from iOS where possible
- Test each feature after porting before moving to the next

