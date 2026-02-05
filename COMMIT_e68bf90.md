# Commit e68bf90 - Port iOS Auto-Behaviors to Android

**Commit Date:** February 4, 2026, 20:36:38 +0200  
**Commit Hash:** e68bf905b0051e404673dbfda11fc0886c2d557c  
**Author:** Ariel Bentolila

## Feature/Bug Request:
Port iOS keyboard auto-behaviors to Android to achieve feature parity between platforms. The iOS keyboard (commit c04f7fa) implemented several automatic behaviors that needed to be available on Android as well.

## Changes Made:

### Android Implementation (3 files modified):

1. **BaseKeyboardService.kt** (181 lines added)
   - Added `isBackspaceActive` flag to track backspace touch state
   - Implemented auto-shift behavior for English keyboard
   - Added auto-capitalize "i" to "I" when standalone
   - Implemented auto-return from special characters (123/#+=) to abc after space
   - Added backspace touch state callbacks (onBackspaceTouchBegan, onBackspaceTouchEnded)
   - Added `autoShiftAfterPunctuation()` method for automatic shift activation
   - Added `autoReturnFromSpecialChars()` method for automatic keyset switching
   - Integrated auto-shift on keyboard appearance and after backspace

2. **KeyboardModels.kt** (59 lines added)
   - Enhanced data models to support new auto-behavior features
   - Added necessary properties and methods for shift state management
   - Extended models to track keyset changes and backspace state

3. **KeyboardRenderer.kt** (216 lines added)
   - Added backspace touch state callbacks to coordinate with controller
   - Enhanced shift state management for auto-behaviors
   - Added support for tracking backspace active state to avoid re-renders during touch
   - Implemented callbacks for backspace touch began/ended events

## Technical Implementation:

### Auto-Shift After Punctuation (English only)
- Automatically activates shift after ". ", "? ", "! " or newline
- Automatically activates shift when text field is empty
- Only applies to English keyboard (keyboardLanguage == "en")
- Defers rendering during backspace touch to avoid visual flicker

### Auto-Capitalize "i" to "I"
- Automatically converts standalone "i" to "I" when followed by space
- Checks if "i" is preceded by space or at beginning of text
- Applies universally across all keyboards

### Auto-Return from Special Characters
- When on 123 or #+= keyboard, automatically returns to abc after typing special char + space
- Improves typing flow by reducing manual keyset switching
- Only applies after space key press

### Backspace Touch State Coordination
- Added callbacks to track when backspace is being pressed
- Prevents re-rendering during long-press backspace to avoid visual issues
- Defers shift state updates until touch ends

## Leftovers/TODO:
- None - All iOS auto-behaviors successfully ported to Android

## Files Modified:
- android/app/src/main/java/com/issieboardng/shared/BaseKeyboardService.kt
- android/app/src/main/java/com/issieboardng/shared/KeyboardModels.kt
- android/app/src/main/java/com/issieboardng/shared/KeyboardRenderer.kt

## Related Commits:
- c04f7fa: Original iOS implementation of these auto-behaviors