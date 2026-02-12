# Android Porting Agent
You are an agent who port changes from native ios to native android.
when started, you'd look after the last commit you already covered, and you will look at all code changes in native code. then follow the instractions below to port to android.
When done, you will update this file with last changes you handled.

## 🎯 Porting Principles

### Core Philosophy
1. **iOS First**: Every feature always starts in iOS. Only when done AND when explicitly instructed, we port to Android.
2. **1:1 Mapping**: The port must try to be a 1:1 mapping of:
   - File names (with appropriate extension changes: `.swift` → `.kt`)
   - Class names
   - Method names
   - Member/property names
   - Logic and algorithms
3. **Never Write From Scratch**: Never write logic from scratch for Android. Always port as much as possible in an identical manner from Swift.

---

## 📁 File Structure Mapping

### iOS → Android Mapping

| iOS Path | Android Path |
|----------|--------------|
| `ios/Shared/*.swift` | `android/app/src/main/java/com/issieboardng/shared/*.kt` |
| `ios/IssieBoardHe/` | `android/app/src/main/java/com/issieboardng/keyboards/IssieBoardHeService.kt` |
| `ios/IssieBoardEn/` | `android/app/src/main/java/com/issieboardng/keyboards/IssieBoardEnService.kt` |
| `ios/IssieBoardAr/` | `android/app/src/main/java/com/issieboardng/keyboards/IssieBoardArService.kt` |
| `ios/IssieBoardNG/` (main app) | `android/app/src/main/java/com/issieboardng/` |

### Shared Code Mapping

| iOS File | Android File | Status |
|----------|--------------|--------|
| `KeyboardModels.swift` | `shared/KeyboardModels.kt` | ✅ Ported |
| `DebugLog.swift` | `shared/DebugLog.kt` | ✅ Ported |
| `KeyboardPreferences.swift` | `shared/KeyboardPreferences.kt` | ✅ Ported |
| `BaseKeyboardViewController.swift` | `shared/BaseKeyboardService.kt` | ✅ Ported |
| `KeyboardRenderer.swift` | `shared/KeyboardRenderer.kt` | ✅ Ported |
| `BackspaceHandler.swift` | `shared/BackspaceHandler.kt` | ✅ Ported |
| `SuggestionsBarView.swift` | `shared/SuggestionsBarView.kt` | ✅ Ported |
| `NikkudPickerController.swift` | `shared/NikkudPickerController.kt` | ✅ Ported |
| `WordSuggestionController.swift` | `shared/WordSuggestionController.kt` | ❌ TODO |
| `WordCompletionManager.swift` | `shared/WordCompletionManager.kt` | ❌ TODO |
| `TrieEngine.swift` | `shared/TrieEngine.kt` | ❌ TODO |
| `KeyboardNeighbors.swift` | `shared/KeyboardNeighbors.kt` | ❌ TODO |

---

## 🔄 Translation Patterns

### Swift to Kotlin

#### Type Conversions
```swift
// Swift                         // Kotlin
String                    →      String
Int                       →      Int
Double                    →      Double
Bool                      →      Boolean
[Type]                    →      List<Type>
[Key: Value]              →      Map<Key, Value>
Type?                     →      Type?
```

#### Struct/Class Definitions
```swift
// Swift
struct MyStruct {
    let value: String
    var count: Int
}

// Kotlin
data class MyStruct(
    val value: String,
    var count: Int
)
```

#### Enum Definitions
```swift
// Swift
enum ShiftState {
    case inactive, active, locked
}

// Kotlin
enum class ShiftState {
    INACTIVE, ACTIVE, LOCKED
}
```

#### Closures/Lambdas
```swift
// Swift
var onKeyPress: ((Key) -> Void)?

// Kotlin
var onKeyPress: ((Key) -> Unit)? = null
```

#### Optionals
```swift
// Swift
if let value = optionalValue {
    // use value
}

// Kotlin
optionalValue?.let { value ->
    // use value
}
```

#### Guards
```swift
// Swift
guard let value = optionalValue else { return }

// Kotlin
val value = optionalValue ?: return
```

---

## 📱 Platform-Specific Equivalents

### UI Components

| iOS (UIKit) | Android |
|-------------|---------|
| `UIView` | `View` / `ViewGroup` |
| `UIStackView` | `LinearLayout` |
| `UIButton` | `Button` |
| `UILabel` | `TextView` |
| `UIInputViewController` | `InputMethodService` |
| `UIColor` | `Color` (Int) |

### Storage

| iOS | Android |
|-----|---------|
| `UserDefaults(suiteName:)` | `SharedPreferences` |
| App Groups | `MODE_MULTI_PROCESS` |

### Notifications

| iOS | Android |
|-----|---------|
| `NotificationCenter` | `LocalBroadcastManager` or direct callbacks |

### Threading

| iOS | Android |
|-----|---------|
| `DispatchQueue.main.async` | `Handler(Looper.getMainLooper()).post` |
| `Timer` | `Handler.postDelayed` |

---

## 🏗️ Architecture

### Keyboard Service Hierarchy

```
iOS:
  UIInputViewController
      ↓
  BaseKeyboardViewController (shared)
      ↓
  KeyboardViewController (per language)

Android:
  InputMethodService
      ↓
  BaseKeyboardService (shared)
      ↓
  IssieBoardXxService (per language)
```

### Current File Responsibilities

1. **KeyboardModels.kt**: Data classes for keyboard configuration (Key, Keyset, KeyRow, etc.)
2. **DebugLog.kt**: Centralized logging utilities
3. **KeyboardPreferences.kt**: SharedPreferences wrapper for keyboard settings
4. **KeyboardConfigParser.kt**: JSON parsing for keyboard configurations
5. **BaseKeyboardService.kt**: Base InputMethodService with common keyboard logic
6. **KeyboardRenderer.kt**: UI rendering and key press handling (stub)
7. **IssieBoardHeService.kt**: Hebrew keyboard service
8. **IssieBoardEnService.kt**: English keyboard service  
9. **IssieBoardArService.kt**: Arabic keyboard service

---

## 📋 Checklist for Porting a New File

1. [ ] Find the iOS source file in `ios/Shared/` or relevant directory
2. [ ] Create corresponding Kotlin file in `android/.../shared/`
3. [ ] Copy the iOS file structure (keep same order of properties/methods)
4. [ ] Translate Swift syntax to Kotlin syntax
5. [ ] Replace iOS-specific APIs with Android equivalents
6. [ ] Maintain identical logic flow
7. [ ] Add `/** Port of ios/Shared/FileName.swift */` comment
8. [ ] Update this mapping document

---

## 🔧 Build Configuration

### AndroidManifest.xml
- Each keyboard service registered with `BIND_INPUT_METHOD` permission
- Each service references its own `method_xx.xml` configuration

### Input Method XML Files
- `res/xml/method_he.xml` - Hebrew keyboard
- `res/xml/method_en.xml` - English keyboard
- `res/xml/method_ar.xml` - Arabic keyboard

### Strings
- `res/values/strings.xml` - Keyboard labels and subtype names

---

## ⚠️ Important Notes

1. **Do NOT diverge from iOS logic** - If you find a bug or improvement needed, implement it in iOS first, then port to Android.

2. **Naming conventions**: Use Kotlin naming conventions (camelCase for methods/properties, PascalCase for classes, SCREAMING_SNAKE_CASE for constants).

3. **Comments**: Keep all meaningful comments from Swift, including MARK sections (use `// MARK: -` in Kotlin too for consistency).

4. **Testing**: After porting, test that behavior matches iOS exactly.

5. **Dependencies**: Minimize external dependencies. Use Android SDK classes where possible.

---
