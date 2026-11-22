# Android Port TODO - IssieVoice Branch Changes

This document lists all iOS changes that need to be ported to Android following the iOS-first development model.

**Base Commit**: `9dc9344` (feat: Add IssieVoice - Assistive Communication App)
**Current HEAD**: `c678e57` (docu cleanups)

## NEW FILES (Need to Create in Android)

### 1. KeyboardEngine.swift → KeyboardEngine.kt
**Path**: `ios/Shared/KeyboardEngine.swift` (NEW FILE - 488 lines)

**Purpose**: Extracted shared keyboard logic from BaseKeyboardViewController that works with both:
- Real keyboard extensions (using SystemTextDocumentProxy)
- Preview mode (using CustomTextDocumentProxy for React Native)

**Key Features**:
- Uses TextDocumentProxyProtocol for text operations (decoupled from UIKit)
- Handles key press routing, suggestions, auto-correction, auto-capitalization
- Callbacks for: nextKeyboard, dismissKeyboard, openSettings, **languageSwitch** (NEW)

**Port To**: `android/app/src/main/java/org/issieshapiro/issieboard/shared/KeyboardEngine.kt`

**Critical Changes**:
```swift
// NEW CALLBACK
var onLanguageSwitch: (() -> Void)?

// Wire up in setupCallbacks()
renderer.onLanguageSwitch = { [weak self] in
    self?.onLanguageSwitch?()
}
```

### 2. TextDocumentProxyProtocol.swift → TextDocumentProxyProtocol.kt
**Path**: `ios/Shared/TextDocumentProxyProtocol.swift` (NEW FILE)

**Purpose**: Protocol/interface that abstracts text document operations
- Allows KeyboardEngine to work with both UITextDocumentProxy (real keyboard) and CustomTextDocumentProxy (preview)

**Port To**: `android/app/src/main/java/org/issieshapiro/issieboard/shared/TextDocumentProxyProtocol.kt`

### 3. CustomTextDocumentProxy.swift → CustomTextDocumentProxy.kt
**Path**: `ios/Shared/CustomTextDocumentProxy.swift` (NEW FILE)

**Purpose**: Custom implementation of TextDocumentProxyProtocol for preview mode
- Maintains its own text buffer
- Synchronizes with React Native text state
- Provides same API as UITextDocumentProxy but for preview

**Port To**: `android/app/src/main/java/org/issieshapiro/issieboard/shared/CustomTextDocumentProxy.kt`

### 4. SystemTextDocumentProxy.swift → SystemTextDocumentProxy.kt
**Path**: `ios/Shared/SystemTextDocumentProxy.swift` (NEW FILE)

**Purpose**: Wrapper around UITextDocumentProxy that implements TextDocumentProxyProtocol
- Used by real keyboard extensions
- Bridges system API to protocol

**Port To**: `android/app/src/main/java/org/issieshapiro/issieboard/shared/SystemTextDocumentProxy.kt`

## MODIFIED FILES (Need to Port Changes)

### 1. KeyboardRenderer.swift
**Path**: `ios/Shared/KeyboardRenderer.swift`

**Changes**:

#### A. NEW Callback: onLanguageSwitch
```swift
// Line 30
var onLanguageSwitch: (() -> Void)?
```

#### B. NEW Callback: onSuggestionsUpdated
```swift
// Line 19-20
// Callback for suggestions update (to send to React Native)
var onSuggestionsUpdated: (([String]) -> Void)?
```

**Used in**:
- `updateSuggestions()` - line 301
- `clearSuggestions()` - line 309

#### C. Config keyHeight Support
```swift
// Lines 112-120
private var rowHeight: CGFloat {
    // Check if config specifies a custom key height
    if let customHeight = config?.keyHeight {
        return CGFloat(customHeight)
    }

    // Otherwise use default logic
    let baseHeight: CGFloat = 54
    if isLargeScreen && !isPreviewMode {
        return baseHeight + 20  // 74px on iPad actual keyboard
    }
    return baseHeight
}
```

#### D. Preview Mode Suggestions Handling
```swift
// Lines 435-447
// Show suggestions bar in real keyboard, hide in preview (preview sends to React Native)
var topOffset: CGFloat = 4

if wordSuggestionsEnabled && !isPreviewMode {
    // Real keyboard - show native suggestions bar
    let bar = suggestionsBarView.createBar(width: container.bounds.width)
    container.addSubview(bar)
    topOffset = 50
    suggestionsBar = bar  // Store UIView reference for legacy code
} else {
    // Preview mode - don't show bar (React Native handles it)
    suggestionsBar = nil
}
```

#### E. Preview Mode Key Filtering
**Three locations need updating**:

**Location 1** - Line 533-539:
```swift
// Skip language/next-keyboard keys if only one language (except in preview mode - let config decide)
// In preview mode (IssieBoard/IssieVoice), show all keys defined in config and let them emit events
let shouldSkipLanguage = keyType == "language" && hasOnlyOneLanguage && !isPreviewMode
let shouldSkipNextKeyboard = keyType == "next-keyboard" && !showGlobeButton
if shouldSkipLanguage || shouldSkipNextKeyboard {
    continue
}
```

**Location 2** - Line 684:
```swift
// Check for hidden language/next-keyboard keys - these ARE in baseline, so redistribute
// In preview mode, show all keys defined in config (let config decide)
if keyType == "language" && hasOnlyOneLanguage && !isPreviewMode {
    hiddenWidthToRedistribute += parsedKey.width
    continue
}
```

**Location 3** - Lines 733-741:
```swift
// Skip language/next-keyboard keys based on:
// 1. Only one language configured (but NOT in preview mode - let config decide), OR
// 2. System is showing globe button (needsInputModeSwitchKey is false)
let keyType = parsedKey.type.lowercased()
// In preview mode (IssieBoard/IssieVoice), show all keys in config - they emit events, don't insert text
let shouldHideLanguageKey = keyType == "language" && hasOnlyOneLanguage && !isPreviewMode
let shouldHideNextKeyboard = keyType == "next-keyboard" && !showGlobeButton

if (shouldHideLanguageKey || shouldHideNextKeyboard) {
    // Skip if only one language (except in preview) OR if system doesn't need us to show the globe
    keyIndex += 1
    continue
}
```

#### F. Multi-Character Key Font Size Fix
```swift
// Lines 1117-1148
// Font size - check for custom fontSize first, then global config fontSize, then use defaults
let isLargeKey = ["shift", "backspace", "enter"].contains(key.type.lowercased())
let isMultiChar = finalText.count > 1

var finalFontSize: CGFloat
if let customFontSize = key.fontSize {
    // Use custom font size if specified on the key
    finalFontSize = CGFloat(customFontSize)
} else {
    // Use global config fontSize, or fall back to default sizing logic
    let defaultFontSize: CGFloat = fontSize
    let defaultLargeFontSize: CGFloat = largeFontSize

    // Check for global fontSize in config
    let globalFontSize: CGFloat = config?.fontSize.map { CGFloat($0) } ?? defaultFontSize
    let globalLargeFontSize: CGFloat = config?.fontSize.map { CGFloat($0) * (defaultLargeFontSize / defaultFontSize) } ?? defaultLargeFontSize

    let baseFontSize: CGFloat = isLargeKey ? globalLargeFontSize : globalFontSize

    // For multi-character keys, scale down proportionally but still respect global fontSize
    if isMultiChar {
        // If global fontSize is set, use it as base and scale down proportionally
        if config?.fontSize != nil {
            finalFontSize = baseFontSize * 0.7
        } else {
            // No global fontSize, use old logic with 14px cap
            finalFontSize = min(baseFontSize * 0.7, 14)
        }
    } else {
        finalFontSize = baseFontSize
    }

    // Make nikkud diacritic mark larger for visibility
    if isNikkudKey {
        finalFontSize = 36
    }
}
```

#### G. Language Key Handler
```swift
// Lines 1757-1766
case "language":
    print("   → Handling LANGUAGE SWITCH")
    // In selection mode, emit key press for selection
    // In normal mode, call the language switch callback
    if onKeyLongPress != nil {
        print("   → Selection mode: emitting key press")
        onKeyPress?(key)
    } else {
        onLanguageSwitch?()
    }
```

### 2. KeyboardPreviewView.swift
**Path**: `ios/IssieBoardNG/KeyboardPreviewView.swift`

**Major Changes**:
- NOW USES KeyboardEngine (instead of direct renderer)
- Supports TWO MODES:
  1. **Config Mode** (IssieBoard): Visual preview, uses configModeRenderer
  2. **Input Mode** (IssieVoice): Full keyboard with text sync, uses KeyboardEngine + CustomTextDocumentProxy

**New Properties**:
```swift
// Keyboard engine for input mode (nil in config mode)
private var keyboardEngine: KeyboardEngine?

// Custom text proxy for input mode (nil in config mode)
private var textProxy: CustomTextDocumentProxy?

// Standalone renderer for config mode (nil in input mode)
private var configModeRenderer: KeyboardRenderer?

// Synced text that mirrors React Native state
private var syncedText: String = ""

// Track if we're processing a keyboard operation
private var isProcessingKeyboardOperation: Bool = false
```

**New Callbacks**:
```swift
@objc var onSuggestionsChange: RCTBubblingEventBlock?
@objc var onLanguageChange: RCTDirectEventBlock?
```

**Mode Detection**:
```swift
private var isInputMode: Bool {
    return textProxy != nil
}
```

**setText Method** (NEW):
```swift
@objc func setText(_ text: String?) {
    let newText = text ?? ""

    // First time text prop is set - initialize input mode
    if textProxy == nil {
        initializeInputMode(with: newText)
        return
    }

    // Update synced text
    if syncedText != newText {
        syncedText = newText

        // Skip if keyboard is processing (avoid loops)
        if isProcessingKeyboardOperation {
            return
        }

        // External change - let KeyboardEngine handle it
        keyboardEngine?.handleTextChanged()
    }
}
```

**sendLanguageSwitchToReactNative Method** (NEW):
```swift
// Line 396-405
private func sendLanguageSwitchToReactNative() {
    guard let onLanguageChange = onLanguageChange else {
        print("⚠️ No onLanguageChange callback set")
        return
    }

    onLanguageChange([:])
    print("📤 Language switch event sent to React Native")
}
```

**Wire up in setupEngineCallbacks**:
```swift
// Line 207-209
keyboardEngine.onLanguageSwitch = { [weak self] in
    self?.sendLanguageSwitchToReactNative()
}
```

### 3. BaseKeyboardViewController.swift
**Path**: `ios/Shared/BaseKeyboardViewController.swift`

**Major Changes**:
- NOW USES KeyboardEngine (refactored)
- Uses SystemTextDocumentProxy wrapper
- Much of the logic moved to KeyboardEngine

**Port Changes**:
- Check full diff: `git diff 9dc9344..HEAD -- ios/Shared/BaseKeyboardViewController.swift`
- Main change: Integration with KeyboardEngine instead of direct renderer

### 4. KeyboardModels.swift
**Path**: `ios/Shared/KeyboardModels.swift`

**New Field**:
```swift
// Line ~40
let keyHeight: Int?
```

### 5. WordSuggestionController.swift & WordCompletionManager.swift
**Paths**:
- `ios/Shared/WordSuggestionController.swift`
- `ios/Shared/WordCompletionManager.swift`

**Changes**: Check diffs - likely integration with KeyboardEngine

## Porting Strategy

### Phase 1: Create New Files
1. Create TextDocumentProxyProtocol.kt interface
2. Create CustomTextDocumentProxy.kt implementation
3. Create SystemTextDocumentProxy.kt implementation
4. Create KeyboardEngine.kt with all callbacks

### Phase 2: Update KeyboardRenderer
1. Add onLanguageSwitch callback
2. Add onSuggestionsUpdated callback
3. Add config keyHeight support
4. Update preview mode filtering logic (3 locations)
5. Fix multi-character key font size
6. Add language key handler case

### Phase 3: Update KeyboardPreviewView
1. Add KeyboardEngine integration
2. Add mode detection (config vs input)
3. Add setText method
4. Add sendLanguageSwitchToReactNative
5. Wire up all callbacks

### Phase 4: Update BaseKeyboardService
1. Integrate with KeyboardEngine
2. Use SystemTextDocumentProxy wrapper
3. Move logic to engine where appropriate

### Phase 5: Update Models
1. Add keyHeight field to KeyboardConfig

## Testing Checklist

- [ ] Language switch button appears on keyboard in IssieVoice
- [ ] Language switch button emits event (doesn't insert text)
- [ ] Preview mode shows all keys regardless of system keyboard count
- [ ] Multi-character keys scale with global fontSize
- [ ] Suggestions update in IssieVoice
- [ ] Text synchronization works in IssieVoice
- [ ] Config mode still works in IssieBoard

---

**Last Updated**: 2026-02-12
**iOS Commit**: c678e57
**Android Status**: Not yet ported
