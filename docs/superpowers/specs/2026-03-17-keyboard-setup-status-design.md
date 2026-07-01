# Keyboard Setup Status Indicator — Design Spec

## Problem

Users configure keyboard layouts in the IssieBoard app but may not complete the iOS system setup (adding the keyboard in Settings, enabling Full Access). There's no in-app feedback telling them the keyboard isn't ready to use.

## Solution

Two-tier per-language status indication in the Editor screen:

1. **Tier 1 (Critical):** Prominent yellow strip when the keyboard extension is not added in iOS Settings
2. **Tier 2 (Minor):** Small yellow badge dot on the language tab when Full Access is not enabled

## Detection Mechanisms

### Is the keyboard added?

Read `UserDefaults.standard["AppleKeyboards"]` from the container app. This returns an array of bundle identifiers for all enabled keyboard extensions on the device.

Check for the presence of:
- `com.issieshapiro.Issieboard.IssieBoardEn` (English)
- `com.issieshapiro.Issieboard.IssieBoardHe` (Hebrew)
- `com.issieshapiro.Issieboard.IssieBoardAr` (Arabic)

This approach:
- Gives exact matches (no false positives from Apple's built-in keyboards)
- Is widely used by App Store keyboard apps (Gboard, SwiftKey) without rejection

**Caveats:** This is an undocumented key. The value may be cached by the process and update when the app re-enters the foreground (not instantly). The `AppState` re-check on `active` mitigates this. If the key is nil or not an array, treat as "unknown" (do not show the strip — avoid false negatives that annoy users who ARE configured).

### Has Full Access been granted?

Only detectable from within the keyboard extension via `self.hasFullAccess`.

The keyboard extension writes `fullAccess_{language}` (`"true"` or `"false"`) to the shared App Group `UserDefaults` in `viewDidAppear`. Note: `hasFullAccess` is more reliably available in `viewDidAppear` than `viewWillAppear` across iOS versions.

The container app reads this value. If the key doesn't exist, the keyboard has never been launched — but if the keyboard IS added (per Tier 1 check), we treat missing value as "not granted."

### Mapping: language to bundle identifier

```
en -> com.issieshapiro.Issieboard.IssieBoardEn
he -> com.issieshapiro.Issieboard.IssieBoardHe
ar -> com.issieshapiro.Issieboard.IssieBoardAr
```

## UI Design

### Tier 1: Keyboard Not Added — Yellow Strip

- **Position:** Directly below the language selector tabs, above the editor content
- **Appearance:** Yellow/amber background (#FFF3CD border, #856404 text — Bootstrap warning palette), dark text, full width, padding 10px
- **Text (localized):** see Localization section below
- **Tap action:** Show an Alert with step-by-step setup instructions (localized)
- **Visibility:** Shown only when `isAdded === false` for `currentLanguage`. Hidden if `AppleKeyboards` key is unavailable (nil).
- **RTL:** Text alignment and layout direction follow `I18nManager.isRTL` or the current language direction
- **Accessibility:** `accessibilityRole="alert"`, descriptive `accessibilityLabel`

### Tier 2: No Full Access — Yellow Badge Dot

- **Position:** Top-right corner of the language tab button (like a notification badge). For RTL languages, mirrors to top-left.
- **Appearance:** Small yellow/amber circle (~8px diameter), `position: absolute`
- **Tap action:** Tapping the language tab (which already switches language) also triggers a brief Alert with Full Access instructions if the dot is showing
- **Visibility:** Shown when `isAdded === true` AND `hasFullAccess !== true` for that language
- **Accessibility:** `accessibilityLabel` on the parent tab indicates "Full Access not enabled"

### State transitions

```
AppleKeyboards is nil/unavailable -> No strip, no dot (unknown state, don't nag)
isAdded=false                     -> Tier 1 strip shown, no badge dot
isAdded=true, fullAccess=null     -> Strip hidden, badge dot shown
isAdded=true, fullAccess=false    -> Strip hidden, badge dot shown
isAdded=true, fullAccess=true     -> Strip hidden, badge dot hidden
```

## Architecture

### Hook-based status management

Use a custom hook `useKeyboardSetupStatus(language)` that:
- Returns `{ isAdded: boolean | null, hasFullAccess: boolean | null }` (`null` = unknown/loading)
- Fetches status on mount, on language change, and on `AppState` becoming `active`
- Is consumed by both the `<SetupStatusStrip>` and the badge dot rendering in EditorScreen
- This avoids the anti-pattern of a child component exporting state upward

## Implementation

### 1. Swift: BaseKeyboardViewController — Write Full Access status

Add a `viewDidAppear` override to write the current `hasFullAccess` value to shared preferences.

**File:** `ios/Shared/BaseKeyboardViewController.swift`

```swift
override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    // Write full access status so the container app can read it
    let prefs = KeyboardPreferences()
    prefs.setString(self.hasFullAccess ? "true" : "false", forKey: "fullAccess_\(keyboardLanguage)")
}
```

### 2. Swift: KeyboardPreferencesModule — New method

Add `getKeyboardSetupStatus` to `KeyboardPreferencesModule.swift`.

**File:** `ios/IssieBoardNG/KeyboardPreferencesModule.swift`

```swift
@objc
func getKeyboardSetupStatus(_ language: String, resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
    let bundleIdMap: [String: String] = [
        "en": "com.issieshapiro.Issieboard.IssieBoardEn",
        "he": "com.issieshapiro.Issieboard.IssieBoardHe",
        "ar": "com.issieshapiro.Issieboard.IssieBoardAr",
    ]

    // Check if keyboard is added (AppleKeyboards is in standard UserDefaults, NOT App Group)
    let enabledKeyboards = UserDefaults.standard.object(forKey: "AppleKeyboards") as? [String]
    let targetBundleId = bundleIdMap[language] ?? ""

    var isAdded: Any = NSNull()  // null = AppleKeyboards unavailable
    if let keyboards = enabledKeyboards {
        isAdded = keyboards.contains(targetBundleId)
    }

    // Check full access status from App Group shared preferences
    let fullAccessValue = preferences.getString(forKey: "fullAccess_\(language)")
    let hasFullAccess: Any = fullAccessValue == "true" ? true : (fullAccessValue == "false" ? false : NSNull())

    resolver([
        "isAdded": isAdded,
        "hasFullAccess": hasFullAccess,
    ])
}
```

### 3. Objective-C bridge registration

**File:** `ios/IssieBoardNG/KeyboardPreferencesModule.m`

```objc
// Keyboard Setup Status
RCT_EXTERN_METHOD(getKeyboardSetupStatus:(NSString *)language
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
```

### 4. TypeScript: KeyboardPreferences.ios.ts

**File:** `src/native/KeyboardPreferences.ios.ts`

Add the `KeyboardSetupStatus` interface (exported) and `getKeyboardSetupStatus` method.

```typescript
export interface KeyboardSetupStatus {
  isAdded: boolean | null;  // null = detection unavailable
  hasFullAccess: boolean | null;  // null = keyboard never launched
}

async getKeyboardSetupStatus(language: string): Promise<KeyboardSetupStatus> {
  if (!KeyboardPreferencesModule) {
    return { isAdded: null, hasFullAccess: null };
  }
  return KeyboardPreferencesModule.getKeyboardSetupStatus(language);
}
```

### 5. TypeScript: KeyboardPreferences.ts (re-export)

**File:** `src/native/KeyboardPreferences.ts`

Add `KeyboardSetupStatus` to the type re-export line:

```typescript
export type { PreferenceInfo, SetResult, KeyboardDimensions, KeyboardSetupStatus } from './KeyboardPreferences.ios';
```

### 6. TypeScript: KeyboardPreferences.android.ts (stub)

**File:** `src/native/KeyboardPreferences.android.ts`

Add a stub that returns "always configured" so the strip never shows on Android:

```typescript
export interface KeyboardSetupStatus {
  isAdded: boolean | null;
  hasFullAccess: boolean | null;
}

async getKeyboardSetupStatus(language: string): Promise<KeyboardSetupStatus> {
  // Android setup detection is out of scope; always report as configured
  return { isAdded: true, hasFullAccess: true };
}
```

### 7. Custom hook: useKeyboardSetupStatus

**File:** `src/hooks/useKeyboardSetupStatus.ts` (new file)

```typescript
function useKeyboardSetupStatus(language: string): KeyboardSetupStatus {
  // Fetches on mount, on language change, and on AppState becoming 'active'
  // Returns { isAdded, hasFullAccess }
}
```

### 8. React Native: SetupStatusStrip component

**File:** `src/components/SetupStatusStrip.tsx` (new file)

A presentational component that:
- Takes `language` and `isAdded` (from the hook) as props
- Renders the yellow strip when `isAdded === false`
- On tap, shows an Alert with localized setup instructions
- Handles RTL text direction

### 9. React Native: EditorScreen integration

**File:** `src/screens/EditorScreen.tsx`

- Call `useKeyboardSetupStatus(currentLanguage)` in the `EditorContent` component
- Render `<SetupStatusStrip>` below the language bar
- Add yellow badge dot to language tab rendering using the hook's `hasFullAccess` for each language

### 10. Re-check timing

- On component mount
- On `AppState` change to `active` (user returns from Settings)
- On language change (hook re-runs with new language)

## Localization

**File:** `src/localization/strings.ts`

Add a new `setup` section to the `Strings` interface:

```typescript
setup: {
  keyboardNotAdded: string;        // "IssieBoard {language} keyboard is not added yet. Tap for setup instructions."
  fullAccessNotEnabled: string;    // "Full Access is not enabled"
  setupInstructionsTitle: string;  // "Setup Instructions"
  setupStep1: string;              // "Open the Settings app"
  setupStep2: string;              // "Go to General > Keyboard > Keyboards"
  setupStep3: string;              // "Tap \"Add New Keyboard...\""
  setupStep4: string;              // "Find and select \"IssieBoard {language}\""
  setupStep5: string;              // "Tap it again and enable \"Allow Full Access\""
  fullAccessTitle: string;         // "Enable Full Access"
  fullAccessStep1: string;         // "Open Settings > General > Keyboard > Keyboards"
  fullAccessStep2: string;         // "Tap \"IssieBoard {language}\""
  fullAccessStep3: string;         // "Enable \"Allow Full Access\""
};
```

All strings provided in English, Hebrew, and Arabic. Hebrew strings use feminine grammar for "keyboard" per project convention.

## Scope

- **iOS only** — Android has a stub returning "always configured"
- **EditorScreen only** — IssieVoice uses keyboard preview mode and doesn't need setup checks
- **Per-language** — Each language is checked independently based on `currentLanguage`

## Files to modify

1. `ios/Shared/BaseKeyboardViewController.swift` — Add `viewDidAppear` to write fullAccess status
2. `ios/IssieBoardNG/KeyboardPreferencesModule.swift` — Add `getKeyboardSetupStatus` method
3. `ios/IssieBoardNG/KeyboardPreferencesModule.m` — Register new method in ObjC bridge
4. `src/native/KeyboardPreferences.ios.ts` — Add `getKeyboardSetupStatus` method + `KeyboardSetupStatus` type
5. `src/native/KeyboardPreferences.ts` — Re-export `KeyboardSetupStatus` type
6. `src/native/KeyboardPreferences.android.ts` — Add stub method + type
7. `src/hooks/useKeyboardSetupStatus.ts` — New custom hook (status fetching logic)
8. `src/components/SetupStatusStrip.tsx` — New component (yellow strip + instructions)
9. `src/screens/EditorScreen.tsx` — Integrate strip + badge dot on language tabs
10. `src/localization/strings.ts` — Add `setup` section with all translations
