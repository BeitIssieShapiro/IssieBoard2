# Keyboard Setup Status Indicator — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-language setup status indicators in the Editor screen to guide users through iOS keyboard setup.

**Architecture:** A native Swift method checks whether each keyboard extension is enabled (via `AppleKeyboards` UserDefaults key) and whether Full Access is granted (via shared App Group storage written by the keyboard extension). A React Native custom hook wraps the native call and re-checks on app foreground. A yellow strip component and badge dot render the two tiers of warnings.

**Tech Stack:** Swift (iOS native module), Objective-C bridge, React Native (TypeScript), React hooks

---

## Chunk 1: Native Layer (Swift + ObjC Bridge)

### Task 1: Write Full Access status from keyboard extension

**Files:**
- Modify: `ios/Shared/BaseKeyboardViewController.swift:60-74` (viewWillAppear area)

- [ ] **Step 1: Add viewDidAppear override to BaseKeyboardViewController**

Add after the `viewWillAppear` override (after line 74) in `ios/Shared/BaseKeyboardViewController.swift`:

```swift
override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    // Write full access status so the container app can read it
    preferences.setString(self.hasFullAccess ? "true" : "false", forKey: "fullAccess_\(keyboardLanguage)")
}
```

Note: `preferences` is already a property on the class (line 14: `private let preferences = KeyboardPreferences()`). `keyboardLanguage` is already a computed property (line 24-29). `hasFullAccess` is inherited from `UIInputViewController`.

- [ ] **Step 2: Verify build compiles**

Run: `cd ios && xcodebuild -workspace IssieBoardNG.xcworkspace -scheme IssieBoardNG -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 16' build 2>&1 | tail -5`
Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 3: Commit**

```bash
git add ios/Shared/BaseKeyboardViewController.swift
git commit -m "feat(ios): write fullAccess status to shared prefs on keyboard appear"
```

### Task 2: Add getKeyboardSetupStatus to native module

**Files:**
- Modify: `ios/IssieBoardNG/KeyboardPreferencesModule.swift:239-256` (after getAppGroupIdentifier section)
- Modify: `ios/IssieBoardNG/KeyboardPreferencesModule.m:56-64` (before @end)

- [ ] **Step 1: Add Swift method to KeyboardPreferencesModule**

Add after the `getKeyboardDimensions` method (after line 255) in `ios/IssieBoardNG/KeyboardPreferencesModule.swift`:

```swift
// MARK: - Keyboard Setup Status

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

    var isAdded: Any = NSNull()  // null = AppleKeyboards key unavailable
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

- [ ] **Step 2: Register method in ObjC bridge**

Add before `@end` in `ios/IssieBoardNG/KeyboardPreferencesModule.m`:

```objc
// Keyboard Setup Status
RCT_EXTERN_METHOD(getKeyboardSetupStatus:(NSString *)language
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
```

- [ ] **Step 3: Verify build compiles**

Run: `cd ios && xcodebuild -workspace IssieBoardNG.xcworkspace -scheme IssieBoardNG -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 16' build 2>&1 | tail -5`
Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 4: Commit**

```bash
git add ios/IssieBoardNG/KeyboardPreferencesModule.swift ios/IssieBoardNG/KeyboardPreferencesModule.m
git commit -m "feat(ios): add getKeyboardSetupStatus native method"
```

## Chunk 2: TypeScript Bridge Layer

### Task 3: Add TypeScript interface and method to KeyboardPreferences

**Files:**
- Modify: `src/native/KeyboardPreferences.ios.ts:19-25` (interface area) and after line 315 (method area)
- Modify: `src/native/KeyboardPreferences.ts:5` (re-export line)
- Modify: `src/native/KeyboardPreferences.android.ts` (add stub)

- [ ] **Step 1: Add KeyboardSetupStatus interface and method to iOS file**

In `src/native/KeyboardPreferences.ios.ts`, add the interface after the existing `KeyboardDimensions` interface (after line 33):

```typescript
export interface KeyboardSetupStatus {
  isAdded: boolean | null;      // null = detection unavailable
  hasFullAccess: boolean | null; // null = keyboard never launched
}
```

Add the method inside the `KeyboardPreferences` class, before the closing `}` (before line 339):

```typescript
  /**
   * Get the keyboard setup status for a specific language
   * Returns whether the keyboard is added in Settings and whether Full Access is enabled
   */
  async getKeyboardSetupStatus(language: string): Promise<KeyboardSetupStatus> {
    if (!KeyboardPreferencesModule) {
      return { isAdded: null, hasFullAccess: null };
    }
    return KeyboardPreferencesModule.getKeyboardSetupStatus(language);
  }
```

- [ ] **Step 2: Update re-export in KeyboardPreferences.ts**

In `src/native/KeyboardPreferences.ts`, update the type export line (line 5):

```typescript
export type { PreferenceInfo, SetResult, KeyboardDimensions, KeyboardSetupStatus } from './KeyboardPreferences.ios';
```

- [ ] **Step 3: Add stub to Android file**

In `src/native/KeyboardPreferences.android.ts`, add the interface after the existing `SetResult` interface (after line 14):

```typescript
export interface KeyboardSetupStatus {
  isAdded: boolean | null;
  hasFullAccess: boolean | null;
}
```

Add the method inside the `KeyboardPreferences` class, before the closing `}` (before line 269):

```typescript
  /**
   * Get the keyboard setup status for a specific language
   * Android stub - always reports as configured since Android setup is different
   */
  async getKeyboardSetupStatus(language: string): Promise<KeyboardSetupStatus> {
    return { isAdded: true, hasFullAccess: true };
  }
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to KeyboardSetupStatus or getKeyboardSetupStatus

- [ ] **Step 5: Commit**

```bash
git add src/native/KeyboardPreferences.ios.ts src/native/KeyboardPreferences.ts src/native/KeyboardPreferences.android.ts
git commit -m "feat(ts): add getKeyboardSetupStatus to KeyboardPreferences bridge"
```

## Chunk 3: Localization Strings

### Task 4: Add setup strings to all three languages

**Files:**
- Modify: `src/localization/strings.ts`

- [ ] **Step 1: Add setup section to Strings interface**

In `src/localization/strings.ts`, add after the `toggleSwitch` section in the `Strings` interface (after line 282, before the closing `}`):

```typescript
  setup: {
    keyboardNotAdded: string;
    tapForInstructions: string;
    setupInstructionsTitle: string;
    setupStep1: string;
    setupStep2: string;
    setupStep3: string;
    setupStep4: string;
    setupStep5: string;
    fullAccessTitle: string;
    fullAccessStep1: string;
    fullAccessStep2: string;
    fullAccessStep3: string;
  };
```

- [ ] **Step 2: Add English setup strings**

In the `en` object, add after the `toggleSwitch` section (after line 564, before the closing `};`):

```typescript
  setup: {
    keyboardNotAdded: 'IssieBoard keyboard is not added yet. Tap for setup instructions.',
    tapForInstructions: 'Tap for instructions',
    setupInstructionsTitle: 'Setup Instructions',
    setupStep1: '1. Open the Settings app',
    setupStep2: '2. Go to General > Keyboard > Keyboards',
    setupStep3: '3. Tap "Add New Keyboard..."',
    setupStep4: '4. Find and select "IssieBoard"',
    setupStep5: '5. Enable "Allow Full Access" for full functionality',
    fullAccessTitle: 'Enable Full Access',
    fullAccessStep1: '1. Open Settings > General > Keyboard > Keyboards',
    fullAccessStep2: '2. Tap "IssieBoard"',
    fullAccessStep3: '3. Enable "Allow Full Access"',
  },
```

- [ ] **Step 3: Add Hebrew setup strings**

In the `he` object, add after the `toggleSwitch` section (after line 846, before the closing `};`):

```typescript
  setup: {
    keyboardNotAdded: 'מקלדת IssieBoard עדיין לא הוגדרה. לחצו להוראות הגדרה.',
    tapForInstructions: 'לחצו להוראות',
    setupInstructionsTitle: 'הוראות הגדרה',
    setupStep1: '1. פתחו את אפליקציית ההגדרות',
    setupStep2: '2. עברו אל כללי > מקלדת > מקלדות',
    setupStep3: '3. לחצו על "הוסף מקלדת חדשה..."',
    setupStep4: '4. מצאו ובחרו "IssieBoard"',
    setupStep5: '5. הפעילו "גישה מלאה" לפונקציונליות מלאה',
    fullAccessTitle: 'הפעלת גישה מלאה',
    fullAccessStep1: '1. פתחו הגדרות > כללי > מקלדת > מקלדות',
    fullAccessStep2: '2. לחצו על "IssieBoard"',
    fullAccessStep3: '3. הפעילו "גישה מלאה"',
  },
```

- [ ] **Step 4: Add Arabic setup strings**

In the `ar` object, add after the `toggleSwitch` section (after line 1128, before the closing `};`):

```typescript
  setup: {
    keyboardNotAdded: 'لم تتم إضافة لوحة مفاتيح IssieBoard بعد. اضغط لتعليمات الإعداد.',
    tapForInstructions: 'اضغط للتعليمات',
    setupInstructionsTitle: 'تعليمات الإعداد',
    setupStep1: '1. افتح تطبيق الإعدادات',
    setupStep2: '2. انتقل إلى عام > لوحة المفاتيح > لوحات المفاتيح',
    setupStep3: '3. اضغط على "إضافة لوحة مفاتيح جديدة..."',
    setupStep4: '4. ابحث عن "IssieBoard" واختره',
    setupStep5: '5. فعّل "السماح بالوصول الكامل" للوظائف الكاملة',
    fullAccessTitle: 'تفعيل الوصول الكامل',
    fullAccessStep1: '1. افتح الإعدادات > عام > لوحة المفاتيح > لوحات المفاتيح',
    fullAccessStep2: '2. اضغط على "IssieBoard"',
    fullAccessStep3: '3. فعّل "السماح بالوصول الكامل"',
  },
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/localization/strings.ts
git commit -m "feat(l10n): add keyboard setup instruction strings in en/he/ar"
```

## Chunk 4: React Native Hook and Components

### Task 5: Create useKeyboardSetupStatus hook

**Files:**
- Create: `src/hooks/useKeyboardSetupStatus.ts`

- [ ] **Step 1: Create the hook file**

Create `src/hooks/useKeyboardSetupStatus.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { AppState, Platform } from 'react-native';
import KeyboardPreferences from '../native/KeyboardPreferences';
import type { KeyboardSetupStatus } from '../native/KeyboardPreferences';

export type { KeyboardSetupStatus };

/**
 * Hook that checks whether a keyboard extension is added in iOS Settings
 * and whether Full Access is enabled.
 *
 * Re-checks on mount, language change, and when app returns to foreground.
 * Returns null values while loading or on Android (where setup is always "done").
 */
export function useKeyboardSetupStatus(language: string): KeyboardSetupStatus {
  const [status, setStatus] = useState<KeyboardSetupStatus>({
    isAdded: null,
    hasFullAccess: null,
  });

  const checkStatus = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      setStatus({ isAdded: true, hasFullAccess: true });
      return;
    }
    try {
      const result = await KeyboardPreferences.getKeyboardSetupStatus(language);
      setStatus(result);
    } catch {
      setStatus({ isAdded: null, hasFullAccess: null });
    }
  }, [language]);

  // Check on mount and language change
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Re-check when app returns to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkStatus();
      }
    });
    return () => subscription.remove();
  }, [checkStatus]);

  return status;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useKeyboardSetupStatus.ts
git commit -m "feat: add useKeyboardSetupStatus hook"
```

### Task 6: Create SetupStatusStrip component

**Files:**
- Create: `src/components/SetupStatusStrip.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/SetupStatusStrip.tsx`:

```typescript
import React from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useLocalization } from '../localization';

interface SetupStatusStripProps {
  isAdded: boolean | null;
}

export const SetupStatusStrip: React.FC<SetupStatusStripProps> = ({ isAdded }) => {
  const { strings } = useLocalization();

  // Only show when keyboard is definitively NOT added
  if (isAdded !== false) {
    return null;
  }

  const showInstructions = () => {
    const message = [
      strings.setup.setupStep1,
      strings.setup.setupStep2,
      strings.setup.setupStep3,
      strings.setup.setupStep4,
      strings.setup.setupStep5,
    ].join('\n');

    Alert.alert(strings.setup.setupInstructionsTitle, message);
  };

  return (
    <TouchableOpacity
      style={styles.strip}
      onPress={showInstructions}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={strings.setup.keyboardNotAdded}
      accessibilityHint={strings.setup.tapForInstructions}
    >
      <Text allowFontScaling={false} style={styles.icon}>⚠️</Text>
      <Text allowFontScaling={false} style={styles.text}>
        {strings.setup.keyboardNotAdded}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    borderBottomWidth: 1,
    borderBottomColor: '#FFEEBA',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  icon: {
    fontSize: 16,
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#856404',
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/SetupStatusStrip.tsx
git commit -m "feat: add SetupStatusStrip component"
```

## Chunk 5: EditorScreen Integration

### Task 7: Integrate hook, strip, and badge dot into EditorScreen

**Files:**
- Modify: `src/screens/EditorScreen.tsx`

- [ ] **Step 1: Add imports**

In `src/screens/EditorScreen.tsx`, add after the existing imports (after the `useLocalization` import on line 29):

```typescript
import { useKeyboardSetupStatus } from '../hooks/useKeyboardSetupStatus';
import { SetupStatusStrip } from '../components/SetupStatusStrip';
```

- [ ] **Step 2: Add hook call in EditorScreenInner component**

In the `EditorScreenInner` component (starting at line 444), add the hook call after the existing state declarations (after line 480, after `currentKeyboardId` state):

```typescript
  const setupStatus = useKeyboardSetupStatus(currentLanguage);
```

Note: The hook must go in `EditorScreenInner` (not the outer `EditorScreen`) because this is where `currentLanguage` state lives (line 479) and where the language tabs and content are rendered.

- [ ] **Step 3: Add SetupStatusStrip below the language bar**

In the JSX of `EditorScreenInner`, add the strip right after the closing `</View>` of the language bar (after line 1594, before the `{/* Profile Selection Row */}` comment):

```tsx
      {/* Keyboard Setup Status */}
      {appContext !== 'issievoice' && (
        <SetupStatusStrip isAdded={setupStatus.isAdded} />
      )}
```

- [ ] **Step 4: Add yellow badge dot to language tabs**

Modify the language tab rendering in `EditorScreenInner` (lines 1534-1550). Replace the `TouchableOpacity` and its children with a version that includes the badge dot:

```tsx
          {LANGUAGES.map(lang => (
            <TouchableOpacity
              key={lang.id}
              style={[
                styles.languageTab,
                currentLanguage === lang.id && styles.languageTabActive,
              ]}
              onPress={() => {
                handleLanguageChange(lang.id);
              }}
              accessibilityLabel={
                setupStatus.isAdded === true && setupStatus.hasFullAccess !== true && currentLanguage === lang.id
                  ? `${lang.nativeName} - ${strings.setup.fullAccessTitle}`
                  : lang.nativeName
              }
            >
              <Text allowFontScaling={false} style={[
                styles.languageTabText,
                currentLanguage === lang.id && styles.languageTabTextActive,
              ]}>
                {lang.nativeName}
              </Text>
              {setupStatus.isAdded === true && setupStatus.hasFullAccess !== true && currentLanguage === lang.id && (
                <View style={styles.setupBadgeDot} />
              )}
            </TouchableOpacity>
          ))}
```

Note: The badge dot only shows on the currently active language tab since the hook tracks `currentLanguage`. This keeps the implementation simple — the user sees the dot for whichever language they're editing.

- [ ] **Step 5: Show Full Access alert when tapping a tab with badge**

Add a helper function in `EditorScreenInner`, after the `setupStatus` hook call and near the existing `handleLanguageChange` (line 703):

```typescript
  const handleLanguageTabPress = useCallback((langId: LanguageId) => {
    // If already on this language and full access dot is showing, show instructions
    if (langId === currentLanguage && setupStatus.isAdded === true && setupStatus.hasFullAccess !== true) {
      const message = [
        strings.setup.fullAccessStep1,
        strings.setup.fullAccessStep2,
        strings.setup.fullAccessStep3,
      ].join('\n');
      Alert.alert(strings.setup.fullAccessTitle, message);
      return;
    }
    handleLanguageChange(langId);
  }, [currentLanguage, setupStatus, handleLanguageChange, strings.setup]);
```

Note: `handleLanguageChange` here refers to the one at line 703 in `EditorScreenInner`, NOT the outer `EditorScreen` one at line 2061.
```

Then update the `onPress` in the language tab to use `handleLanguageTabPress`:

```tsx
onPress={() => handleLanguageTabPress(lang.id)}
```

- [ ] **Step 6: Add badge dot style**

Add the `setupBadgeDot` style to the `StyleSheet.create` in EditorScreen (inside the existing `styles` object):

```typescript
  setupBadgeDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
  },
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 8: Verify the app runs**

Run: `npm start` (metro bundler) and build the app to verify no runtime crashes.

- [ ] **Step 9: Commit**

```bash
git add src/screens/EditorScreen.tsx
git commit -m "feat: integrate keyboard setup status strip and badge dot in EditorScreen"
```

### Task 8: Manual Testing Checklist

- [ ] **Test 1: Keyboard NOT added**
  - Remove the IssieBoard keyboard from Settings > General > Keyboard > Keyboards
  - Open the IssieBoard app, go to the Editor screen
  - Verify yellow strip appears below the language tabs
  - Tap the strip — verify Alert with setup instructions appears

- [ ] **Test 2: Keyboard added, no Full Access**
  - Add IssieBoard keyboard in Settings but disable Full Access
  - Return to the app
  - Verify strip disappears
  - Verify small yellow dot appears on the active language tab
  - Tap the active language tab — verify Full Access alert appears

- [ ] **Test 3: Keyboard added with Full Access**
  - Enable Full Access for IssieBoard in Settings
  - Open the keyboard at least once (to trigger the write)
  - Return to the app
  - Verify no strip and no badge dot

- [ ] **Test 4: AppState re-check**
  - Start with keyboard not added (strip visible)
  - Background the app
  - Add the keyboard in Settings
  - Return to the app
  - Verify strip disappears (after AppState 'active' re-check)

- [ ] **Test 5: IssieVoice context**
  - Open the Editor from IssieVoice context (`appContext === 'issievoice'`)
  - Verify no strip or badge dot appears regardless of setup state
