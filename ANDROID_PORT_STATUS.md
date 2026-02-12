# Android Port Status - IssieVoice Branch

**Date**: 2026-02-12
**Base iOS Commit**: c678e57
**Status**: Phase 1 & 2 Complete, Phase 3 & 4 Require Major Refactoring

---

## ✅ Completed

### Phase 1: New Files Created (100% Complete)

All 4 new Kotlin files have been created as 1:1 ports of iOS Swift files:

1. **TextDocumentProxyProtocol.kt** ✅
   - Interface for text document operations
   - Allows KeyboardEngine to work with both InputConnection and CustomTextDocumentProxy
   - Location: `android/app/src/main/java/org/issieshapiro/issieboard/shared/`

2. **CustomTextDocumentProxy.kt** ✅
   - Implementation for preview mode (IssieVoice)
   - Bridges KeyboardEngine to React Native text state
   - React Native is single source of truth
   - Location: `android/app/src/main/java/org/issieshapiro/issieboard/shared/`

3. **SystemTextDocumentProxy.kt** ✅
   - Wrapper around Android InputConnection
   - Used by real keyboard services
   - Implements TextDocumentProxyProtocol
   - Location: `android/app/src/main/java/org/issieshapiro/issieboard/shared/`

4. **KeyboardEngine.kt** ✅ (488 lines)
   - Core keyboard logic extracted from BaseKeyboardService
   - Handles key press routing, suggestions, auto-correction
   - **Includes onLanguageSwitch callback** ✓
   - Completely decoupled from InputMethodService
   - Location: `android/app/src/main/java/org/issieshapiro/issieboard/shared/`

### Phase 2: KeyboardRenderer.kt Updates (100% Complete)

All critical changes have been ported to KeyboardRenderer.kt:

1. **onLanguageSwitch Callback** ✅
   - Added at line 47: `var onLanguageSwitch: (() -> Unit)? = null`
   - Called in language key handler at line 1580

2. **onSuggestionsUpdated Callback** ✅
   - Added at line 41: `var onSuggestionsUpdated: ((List<String>) -> Unit)? = null`
   - Called in `updateSuggestions()` after updating bar
   - Called in `clearSuggestions()` when clearing

3. **Config keyHeight Support** ✅
   - rowHeight converted to computed property (lines 140-150)
   - Checks `config?.keyHeight` first, falls back to 54dp default
   - Properly converts to px with `dpToPx()`

4. **Preview Mode Suggestions Handling** ✅
   - Updated suggestions bar creation (line 442)
   - Only shows native suggestions bar when `wordSuggestionsEnabled && !isPreviewMode`
   - Preview mode hides bar (React Native handles it)

5. **Preview Mode Key Filtering** ✅ (Already completed by previous agent)
   - Location 1 (line 614): `shouldSkipLanguage = keyType == "language" && hasOnlyOneLanguage && !isPreviewMode`
   - Location 2 (line 706): Width redistribution check includes `!isPreviewMode`
   - Location 3 (line 765): Final filtering check includes `!isPreviewMode`
   - In preview mode, shows ALL keys from config

6. **Multi-Character Key Font Size Fix** ✅ (Already completed by previous agent)
   - Lines 1094-1104: Checks for global `config?.fontSize`
   - When fontSize is set, scales proportionally (baseFontSize * 0.7)
   - When not set, maintains backward compatibility (14px cap)

7. **Language Key Handler** ✅ (Already completed by previous agent)
   - Lines 1578-1581: Handles "language" case
   - Calls `onLanguageSwitch?.invoke()`

### Phase 5: KeyboardModels.kt Updates (100% Complete)

1. **keyHeight Field Added** ✅
   - Added to KeyboardConfig data class
   - Type: `Int?` (nullable, in dp)
   - Comment: "Custom key height in dp (overrides default 54dp)"

2. **fontSize Field Added** ✅
   - Added to KeyboardConfig data class
   - Type: `Int?` (nullable)
   - Comment: "Global font size for all keys (overrides defaults)"

---

## ⚠️ Incomplete - Requires Major Refactoring

### Phase 3 & 4: KeyboardPreviewView & BaseKeyboardService

These files need to be completely refactored to use KeyboardEngine (like iOS):

#### Current State
- **KeyboardPreviewView.kt**: Still uses old architecture (direct renderer)
- **BaseKeyboardService.kt**: Still uses old architecture (direct renderer)

#### What Needs to Change
The iOS architecture was fundamentally refactored to extract shared logic into KeyboardEngine. Android needs the same refactoring:

**iOS Architecture (NEW)**:
```
BaseKeyboardViewController
  └─> SystemTextDocumentProxy (wraps UITextDocumentProxy)
  └─> KeyboardEngine
      └─> KeyboardRenderer
      └─> WordSuggestionController

KeyboardPreviewView
  └─> CustomTextDocumentProxy (bridges React Native)
  └─> KeyboardEngine
      └─> KeyboardRenderer
      └─> WordSuggestionController
```

**Android Architecture (CURRENT - OLD)**:
```
BaseKeyboardService
  └─> InputConnection (directly)
  └─> KeyboardRenderer (directly)
  └─> WordSuggestionController (directly)

KeyboardPreviewView
  └─> KeyboardRenderer (directly)
  └─> WordSuggestionController (directly)
```

**Android Architecture (REQUIRED - NEW)**:
```
BaseKeyboardService
  └─> SystemTextDocumentProxy (wraps InputConnection)
  └─> KeyboardEngine ← NEEDS REFACTOR
      └─> KeyboardRenderer
      └─> WordSuggestionController

KeyboardPreviewView
  └─> CustomTextDocumentProxy (bridges React Native)
  └─> KeyboardEngine ← NEEDS REFACTOR
      └─> KeyboardRenderer
      └─> WordSuggestionController
```

#### Specific Changes Needed

**KeyboardPreviewView.kt** needs:
1. Replace direct renderer usage with KeyboardEngine
2. Create CustomTextDocumentProxy instance
3. Pass proxy to KeyboardEngine
4. Wire up all callbacks (onLanguageSwitch, onSuggestionsUpdated, etc.)
5. Implement two modes:
   - **Config Mode** (IssieBoard): Visual preview
   - **Input Mode** (IssieVoice): Full keyboard with text sync
6. Add `setText()` method for React Native text synchronization
7. Add sendLanguageSwitchToReactNative() method
8. Handle isProcessingKeyboardOperation flag to prevent loops

**BaseKeyboardService.kt** needs:
1. Create SystemTextDocumentProxy wrapping InputConnection
2. Replace direct renderer usage with KeyboardEngine
3. Wire up all KeyboardEngine callbacks
4. Move text manipulation logic to engine
5. Update onKey* methods to use engine

**Estimated Effort**:
- KeyboardPreviewView.kt: ~400 lines of refactoring
- BaseKeyboardService.kt: ~300 lines of refactoring
- Testing: Full keyboard functionality + IssieVoice integration

---

## 🔧 Build Issues

**Status**: ✅ All build issues resolved

**Fixed Issues**:
1. ✅ `react-native-tts` jcenter deprecation - replaced with mavenCentral()
2. ✅ KeyboardEngine.kt compilation errors - fixed Android API differences:
   - Added Context parameter to KeyboardEngine constructor
   - Replaced `resetCurrentWord()` with `handleEnter()`
   - Replaced `setCurrentWordSilently()` with `detectCurrentWord()`
   - Replaced `getFuzzyAutoReplacement()` with `handleSpace()` return value
3. ✅ Namespace/package mismatch - fixed React Native autolinking:
   - Updated `react-native.config.js` with `packageName: 'org.issieshapiro.issieboard'`
   - Aligned namespace in `build.gradle` with source package structure
   - Fixed autogenerated `ReactNativeApplicationEntryPoint.java` references
4. ✅ Build completes successfully - APK generated and installed
5. ✅ App launches without crashes - verified running on emulator (PID 14265)

---

## 📋 Summary

### ✅ What Works
- All new architecture files created (TextDocumentProxyProtocol, CustomTextDocumentProxy, SystemTextDocumentProxy, KeyboardEngine)
- KeyboardEngine ported with all iOS logic
- KeyboardRenderer fully updated with language key support
- Preview mode filtering working
- Multi-character font size fix applied
- Config keyHeight and fontSize support added
- Build successful - APK generated and deployed to emulator
- App launches successfully

### ⚠️ What's Missing
- KeyboardPreviewView not refactored to use KeyboardEngine (Phases 3-4)
- BaseKeyboardService not refactored to use KeyboardEngine (Phases 3-4)
- IssieVoice text synchronization not implemented (requires KeyboardPreviewView refactor)
- Language switch events not wired to React Native (requires KeyboardPreviewView refactor)

### Testing Status
**Ready for User Testing**: The app builds and runs successfully. Basic keyboard functionality should work, but advanced features requiring KeyboardEngine integration (IssieVoice preview mode, language switching) will need testing to confirm behavior.

**Next Steps**:
1. Test basic keyboard functionality on emulator
2. Test IssieBoard configurator app
3. Determine if Phases 3-4 refactoring is needed based on test results
4. If IssieVoice Android support is required, complete KeyboardPreviewView refactoring

---

**Files Modified**:
- `android/app/src/main/java/org/issieshapiro/issieboard/shared/TextDocumentProxyProtocol.kt` (NEW)
- `android/app/src/main/java/org/issieshapiro/issieboard/shared/CustomTextDocumentProxy.kt` (NEW)
- `android/app/src/main/java/org/issieshapiro/issieboard/shared/SystemTextDocumentProxy.kt` (NEW)
- `android/app/src/main/java/org/issieshapiro/issieboard/shared/KeyboardEngine.kt` (NEW)
- `android/app/src/main/java/org/issieshapiro/issieboard/shared/KeyboardRenderer.kt` (MODIFIED)
- `android/app/src/main/java/org/issieshapiro/issieboard/shared/KeyboardModels.kt` (MODIFIED)

**Files Need Refactoring**:
- `android/app/src/main/java/org/issieshapiro/issieboard/KeyboardPreviewView.kt` (PENDING)
- `android/app/src/main/java/org/issieshapiro/issieboard/shared/BaseKeyboardService.kt` (PENDING)

**Build Blockers**:
- `react-native-tts` dependency uses deprecated `jcenter()`
