# Platform Feature Comparison: iOS vs Android

## Overview
This document provides a systematic comparison of features between the iOS and Android keyboard implementations.

---

## ✅ Feature Parity (Implemented in Both)

### Core Keyboard Features
| Feature | iOS | Android | Notes |
|---------|-----|---------|-------|
| JSON-based rendering | ✅ | ✅ | Both parse config from shared preferences |
| Dynamic layout generation | ✅ | ✅ | Width-based proportional sizing |
| Multiple keysets | ✅ | ✅ | abc, 123, #+= |
| Keyset switching | ✅ | ✅ | Buttons to switch between keysets |
| All key types | ✅ | ✅ | 10 types total |

### Key Types Supported
1. **backspace** - Delete character | ✅ iOS | ✅ Android
2. **enter/action** - Newline/action | ✅ iOS | ✅ Android
3. **shift** - Toggle case/caps lock | ✅ iOS | ✅ Android
4. **keyset** - Switch keyset | ✅ iOS | ✅ Android
5. **nikkud** - Toggle diacritics mode | ✅ iOS | ✅ Android
6. **settings** - Open main app | ✅ iOS | ✅ Android
7. **close** - Dismiss keyboard | ✅ iOS | ✅ Android
8. **language** - Cycle keyboards | ✅ iOS | ✅ Android
9. **next-keyboard** - Switch to next system keyboard | ✅ iOS | ✅ Android
10. **regular keys** - Letter/number/symbol | ✅ iOS | ✅ Android

### Advanced Features
| Feature | iOS | Android | Notes |
|---------|-----|---------|-------|
| Shift state (single tap) | ✅ | ✅ | Uppercase one char |
| Shift state (double tap) | ✅ | ✅ | Caps lock mode |
| Shift visual feedback | ✅ | ✅ | Green when active |
| Language cycling | ✅ | ✅ | Cycles through en/he/ar |
| Keyset type preservation | ✅ | ✅ | Stays in abc when switching languages |
| Nikkud/diacritics support | ✅ | ✅ | Hebrew nikkud, Arabic tashkeel |
| Nikkud toggle mode | ✅ | ✅ | Yellow/gold when active |
| Nikkud popup picker | ✅ | ✅ | 2-row grid layout |
| Group templates | ✅ | ✅ | Styling for key groups |
| Hidden keys | ✅ | ✅ | Create spacing |
| Key offset | ✅ | ✅ | Add spacing before key |
| Custom key colors | ✅ | ✅ | Hex color support |
| Custom key widths | ✅ | ✅ | Proportional sizing |
| Default labels | ✅ | ✅ | Fallback symbols |
| Real-time config updates | ✅ | ✅ | Polling (iOS 0.5s, Android via listener) |
| Baseline width calculation | ✅ | ✅ | Consistent sizing across rows |
| Row spacing | ✅ | ✅ | 10px between rows |

---

## ⚠️ Feature Gaps

### iOS Missing Features

#### 1. **Dynamic Enter Key** ✅ (Now Implemented!)
- **Both platforms**: Enter key adapts label based on input field context
  - Shows "Search" in search fields
  - Shows "Go" in URL fields
  - Shows "Send" in messaging fields
  - Shows "Done", "Next", "Continue", etc.
  - Updates automatically when switching fields
- **iOS**: Uses UIReturnKeyType from textDocumentProxy
- **Android**: Uses EditorInfo.imeOptions analysis
- **Note**: iOS always inserts newline (system limitation), Android can perform actions

#### 2. **Landscape Mode** ❌
- **Android**: Detects orientation and adjusts row height
  - Portrait: 150px rows
  - Landscape: 100px rows
- **iOS**: Fixed row height (50px)
- **Impact**: Low - iOS keyboards typically don't change in landscape

#### 3. **Config Caching** ❌
- **Android**: Parses config once, caches ParsedConfig with pre-parsed colors
  - Avoids re-parsing on every render
  - Color cache for hex parsing
- **iOS**: Re-parses JSON on every render
- **Impact**: Low - Performance difference likely negligible for keyboard size

#### 4. **Navigation Bar Overlap Handling** ❌
- **Android**: Handles modern Android navigation bar insets
  - API 30+ WindowInsets handling
  - Automatic padding adjustment
- **iOS**: No special handling
- **Impact**: Low - iOS handles this at system level

---

## 📊 Architecture Differences

### Why Android Has More Lines

1. **Data Classes** (~150 lines)
   - Android defines all models inline
   - iOS uses separate `KeyboardModels.swift` file

2. **Caching & Optimization** (~100 lines)
   - ParsedConfig structure
   - Color cache
   - Pre-parsed configs

3. **Legacy Compatibility** (~50 lines)
   - keysetsMap for backward compatibility
   - Dual parsing paths

4. **Editor Context Analysis** (~100 lines)
   - analyzeEditorInfo function
   - EditorContext data class
   - Complex enter key logic

5. **Layout System** (~50 lines)
   - Landscape/portrait detection
   - Navigation bar handling
   - Weight-based layout

6. **Comments & Documentation** (~100 lines)
   - Extensive inline documentation
   - Section markers
   - Function descriptions

**Total difference**: ~550 lines of Android-specific features/architecture

---

## 🎯 Recommendations

### High Priority
- None! Both platforms now have feature parity ✅

### Medium Priority
- None currently - other differences are architectural or low-impact

### Low Priority
- Add config caching to iOS (optimization)
- Add landscape mode support (if needed)

---

## ✅ Current Status

**Both platforms have 100% feature parity for:**
- All 10 key types
- Nikkud/diacritics
- Language switching
- Shift states
- Layout system
- Visual styling
- Real-time updates

**Platform differences:**
- Both have **dynamic enter key labels** based on context
- Android can perform specific editor actions (search, go, send)
- iOS always inserts newline (but shows appropriate label)

The line count difference is primarily due to:
1. Android's more complex architecture (caching, optimization)
2. Dynamic enter key logic
3. Extensive documentation
4. Legacy compatibility
5. Models defined inline vs separate file

---

Last Updated: 2026-01-22 13:14 (Added dynamic enter key to iOS ✅)
