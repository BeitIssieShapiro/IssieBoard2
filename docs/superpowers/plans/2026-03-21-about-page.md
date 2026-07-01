# About Page with User Feedback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an About screen with user feedback (via Firebase) to both IssieBoard and IssieVoice apps.

**Architecture:** Shared `AboutScreen` component rendered as full-screen overlay in both apps. Firebase initialized via `issie-shared`'s `firebaseInit`. `FeedbackDialog` from `issie-shared` handles feedback submission to Firestore via existing `addUserFeedback2` cloud function.

**Tech Stack:** React Native 0.83, TypeScript, `@beitissieshapiro/issie-shared` (FeedbackDialog, firebaseInit), `@react-native-firebase/*`, `react-native-device-info`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/components/AboutScreen.tsx` | Create | Shared About screen component |
| `src/firebase-config.ts` | Create | Firebase initialization wrapper |
| `src/common/debug-token.ts` | Create | App Check debug token placeholder |
| `src/screens/EditorScreen.tsx` | Modify (~line 1601) | Add info button + about overlay |
| `src/screens/ClassicEditorScreen.tsx` | Modify (~line 1055) | Add info button + about overlay |
| `apps/issievoice/src/screens/SettingsScreen.tsx` | Modify (lines 108-115) | Replace inline about with tappable row opening overlay |
| `src/AppNavigator.tsx` | Modify (line 12) | Import and call `initializeFirebase` |
| `apps/issievoice/App.tsx` | Modify (line 20) | Import and call `initializeFirebase` |
| `android/build.gradle` | Modify (line 16) | Add google-services classpath |
| `android/app/build.gradle` | Modify (bottom) | Apply google-services plugin |

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

This task installs all required npm packages. The `issie-shared` package has `@react-native-firebase/analytics`, `app-check`, and `functions` as direct deps, but:
- `@react-native-firebase/app` (core) is missing and required
- `react-native-localize` is a dep of issie-shared but needs native linking in host app
- Vector icon packages from issie-shared need native linking too
- `react-native-device-info` for version display

- [ ] **Step 1: Install Firebase and supporting packages**

```bash
npm install @react-native-firebase/app@^23.7.0 @react-native-firebase/app-check@^23.7.0 @react-native-firebase/functions@^23.7.0 @react-native-firebase/analytics@^23.7.0 react-native-device-info react-native-localize@^3.6.1 @react-native-vector-icons/ant-design@^12.4.0 @react-native-vector-icons/ionicons@^12.3.0 @react-native-vector-icons/material-design-icons@^12.4.0 @react-native-vector-icons/material-icons@^12.4.0
```

- [ ] **Step 2: Install iOS pods**

```bash
cd ios && pod install && cd ..
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json ios/Podfile.lock
git commit -m "$(cat <<'EOF'
Add Firebase, device-info, and issie-shared peer deps
EOF
)"
```

---

### Task 2: Firebase Console Setup (Manual — User-Guided)

This task is interactive — guide the user through Firebase Console steps. No code changes.

- [ ] **Step 2.1: Register IssieBoard iOS in Firebase Console**

Tell user:
> Go to Firebase Console (https://console.firebase.google.com/) → project `myissiesign`
> Click "Add app" → iOS
> Bundle ID: `com.issieshapiro.Issieboard`
> Download `GoogleService-Info.plist`
> In Xcode: right-click `ios/IssieBoardNG/` → "Add Files to IssieBoardNG" → select the plist → ensure "Copy items if needed" checked and target `IssieBoard` selected

- [ ] **Step 2.2: Register IssieVoice iOS in Firebase Console**

Tell user:
> In Firebase Console → "Add app" → iOS
> Bundle ID: `org.issieshapiro.IssieVoice`
> Download `GoogleService-Info.plist`
> In Xcode: right-click `ios/IssieVoice/` → "Add Files" → select plist → target `IssieVoice`

- [ ] **Step 2.3: Register IssieBoard Android in Firebase Console**

Tell user:
> In Firebase Console → "Add app" → Android
> Package name: `org.issieshapiro.issieboard`
> Download `google-services.json` → place in `android/app/`

- [ ] **Step 2.4: Register IssieVoice Android in Firebase Console**

Tell user:
> In Firebase Console → "Add app" → Android
> Package name: `org.issieshapiro.issievoice`
> The `google-services.json` in `android/app/` will be updated to include both apps

- [ ] **Step 2.5: Enable App Check**

Tell user:
> Firebase Console → App Check
> For each iOS app: Register with "App Attest" provider
> For each Android app: Register with "Play Integrity" provider
> Debug tokens will be added later after first app run

- [ ] **Step 2.6: Add App Attest capability in Xcode**

Tell user:
> In Xcode → select IssieBoardNG project
> Select `IssieBoard` target → Signing & Capabilities → + Capability → App Attest
> Select `IssieVoice` target → Signing & Capabilities → + Capability → App Attest

---

### Task 3: Android Gradle Configuration

**Files:**
- Modify: `android/build.gradle:16`
- Modify: `android/app/build.gradle` (bottom)

- [ ] **Step 1: Add google-services classpath to project-level build.gradle**

In `android/build.gradle`, add to the `dependencies` block inside `buildscript`:

```gradle
classpath("com.google.gms:google-services:4.4.2")
```

The dependencies block should become:
```gradle
    dependencies {
        classpath("com.android.tools.build:gradle")
        classpath("com.facebook.react:react-native-gradle-plugin")
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin")
        classpath("com.google.gms:google-services:4.4.2")
    }
```

- [ ] **Step 2: Apply google-services plugin in app-level build.gradle**

Add at the very bottom of `android/app/build.gradle`:

```gradle
apply plugin: 'com.google.gms.google-services'
```

- [ ] **Step 3: Commit**

```bash
git add android/build.gradle android/app/build.gradle
git commit -m "$(cat <<'EOF'
Configure Android Gradle for Google Services
EOF
)"
```

---

### Task 4: Create Firebase Initialization Files

**Files:**
- Create: `src/common/debug-token.ts`
- Create: `src/firebase-config.ts`

- [ ] **Step 1: Create debug token file**

Create `src/common/debug-token.ts`:

```typescript
// Debug token for Firebase App Check (development only)
// To get your debug token:
// 1. Run the app in debug mode (iOS simulator or Android emulator)
// 2. Check the console logs for: "Firebase App Check debug token: XXXXXX-..."
// 3. Copy that token and paste it below
// 4. Add the same token to Firebase Console → App Check → Manage debug tokens
// 5. Debug tokens are per-device/simulator
export const debugToken = __DEV__ ? 'PASTE_YOUR_DEBUG_TOKEN_HERE' : '';
```

- [ ] **Step 2: Create Firebase config file**

Create `src/firebase-config.ts`:

```typescript
import { firebaseInit } from '@beitissieshapiro/issie-shared';
import { debugToken } from './common/debug-token';

export function initializeFirebase() {
  if (__DEV__) {
    (globalThis as any).RNFBDebug = true;
  }
  firebaseInit(debugToken);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/common/debug-token.ts src/firebase-config.ts
git commit -m "$(cat <<'EOF'
Add Firebase initialization config
EOF
)"
```

---

### Task 5: Initialize Firebase in App Entry Points

**Files:**
- Modify: `src/AppNavigator.tsx:12`
- Modify: `apps/issievoice/App.tsx:1`

- [ ] **Step 1: Add Firebase init to IssieBoard AppNavigator**

In `src/AppNavigator.tsx`, add import after line 18:

```typescript
import { initializeFirebase } from './firebase-config';
```

Add a `useEffect` inside the `AppNavigator` component, right after the existing state declarations (after line 44):

```typescript
  // Initialize Firebase
  useEffect(() => {
    initializeFirebase();
  }, []);
```

- [ ] **Step 2: Add Firebase init to IssieVoice App**

In `apps/issievoice/App.tsx`, add import after line 14:

```typescript
import { initializeFirebase } from '../../src/firebase-config';
```

Add `useEffect` import to the React import (line 1), and add inside the `App` component (after line 20, before the return):

```typescript
  React.useEffect(() => {
    initializeFirebase();
  }, []);
```

- [ ] **Step 3: Commit**

```bash
git add src/AppNavigator.tsx apps/issievoice/App.tsx
git commit -m "$(cat <<'EOF'
Initialize Firebase in both app entry points
EOF
)"
```

---

### Task 6: Create Shared AboutScreen Component

**Files:**
- Create: `src/components/AboutScreen.tsx`

This is the main reusable component, modeled after `IssieSays/src/about.tsx`. It takes `appName`, `onClose`, and `paragraphs` props. Uses `FeedbackDialog` from issie-shared and `react-native-device-info` for version.

- [ ] **Step 1: Create AboutScreen component**

Create `src/components/AboutScreen.tsx`:

```typescript
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeedbackDialog } from '@beitissieshapiro/issie-shared';
import { getVersion, getBuildNumber } from 'react-native-device-info';

const languages = [
  { code: 'he', label: 'עברית', dir: 'rtl' as const },
  { code: 'en', label: 'English', dir: 'ltr' as const },
  { code: 'ar', label: 'العربية', dir: 'rtl' as const },
];

interface AboutScreenProps {
  appName: string;
  onClose: () => void;
  paragraphs: Record<string, string[]>;
}

export function AboutScreen({ appName, onClose, paragraphs }: AboutScreenProps) {
  const [lang, setLang] = useState('he');
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const currentLang = languages.find(l => l.code === lang) || languages[1];
  const insets = useSafeAreaInsets();

  const version = getVersion();
  const buildNumber = getBuildNumber();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Title bar */}
      <View style={styles.titleBar}>
        <Text allowFontScaling={false} style={styles.title}>
          {lang === 'he' ? 'אודות' : lang === 'ar' ? 'حول' : 'About'} {appName}
        </Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text allowFontScaling={false} style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Language toggle */}
      <View style={styles.toggleRow}>
        {languages.map(l => (
          <TouchableOpacity
            key={l.code}
            style={[
              styles.toggleButton,
              lang === l.code && styles.toggleButtonActive,
            ]}
            onPress={() => setLang(l.code)}
          >
            <Text
              allowFontScaling={false}
              style={[
                styles.toggleText,
                lang === l.code && styles.toggleTextActive,
              ]}
            >
              {l.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Feedback button */}
      <View style={styles.feedbackContainer}>
        <TouchableOpacity
          style={styles.feedbackButton}
          onPress={() => setShowFeedbackDialog(true)}
          activeOpacity={0.7}
        >
          <Text allowFontScaling={false} style={styles.feedbackButtonText}>
            {lang === 'he' ? '💬 משוב משתמש' : lang === 'ar' ? '💬 ملاحظات المستخدم' : '💬 User Feedback'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {(paragraphs[lang] || paragraphs['en'] || []).map((text, index) => (
          <Text
            key={index}
            style={[
              styles.paragraph,
              { writingDirection: currentLang.dir },
            ]}
          >
            {text}
          </Text>
        ))}

        {/* Version */}
        <Text style={[styles.versionText, { writingDirection: currentLang.dir }]}>
          {lang === 'he' ? 'גרסה' : lang === 'ar' ? 'الإصدار' : 'Version'} {version} ({buildNumber})
        </Text>
      </ScrollView>

      <FeedbackDialog
        appName={appName}
        visible={showFeedbackDialog}
        onClose={() => setShowFeedbackDialog(false)}
      />
    </View>
  );
}

const ACCENT_COLOR = '#2196F3';

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F5F5F5',
    zIndex: 1000,
  },
  titleBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: ACCENT_COLOR,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
    fontWeight: 'bold',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'white',
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ACCENT_COLOR,
  },
  toggleButtonActive: {
    backgroundColor: ACCENT_COLOR,
  },
  toggleText: {
    fontSize: 18,
    color: ACCENT_COLOR,
  },
  toggleTextActive: {
    color: 'white',
  },
  feedbackContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: 'white',
  },
  feedbackButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 25,
    backgroundColor: ACCENT_COLOR,
  },
  feedbackButtonText: {
    fontSize: 18,
    color: 'white',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 20,
  },
  paragraph: {
    fontSize: 20,
    lineHeight: 32,
    marginBottom: 16,
    color: '#333',
  },
  versionText: {
    fontSize: 14,
    color: '#999',
    marginTop: 20,
    textAlign: 'center',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AboutScreen.tsx
git commit -m "$(cat <<'EOF'
Add shared AboutScreen component with feedback and version display
EOF
)"
```

---

### Task 7: Add About to EditorScreen (IssieBoard Advanced View)

**Files:**
- Modify: `src/screens/EditorScreen.tsx`

Add an info button in the language bar (around line 1601) and render AboutScreen as overlay.

- [ ] **Step 1: Add import for AboutScreen**

At the top of `src/screens/EditorScreen.tsx`, add import alongside existing imports:

```typescript
import { AboutScreen } from '../components/AboutScreen';
```

- [ ] **Step 2: Add about paragraphs data and state**

Inside the `EditorScreen` component, add the `showAbout` state near the other `useState` declarations:

```typescript
const [showAbout, setShowAbout] = useState(false);
```

Add the paragraphs constant outside the component (near the top of the file, after imports):

```typescript
const ISSIEBOARD_ABOUT: Record<string, string[]> = {
  en: [
    'IssieBoard is a customizable keyboard app designed for people with developmental or motor skill disabilities. It helps users acquire and practice typing skills at their own pace.',
    'The app offers configurable keyboard layouts for Hebrew, English, and Arabic, with adjustable key sizes, colors, and fonts to match each user\'s needs.',
    'IssieBoard includes word completion and prediction to help users type faster and more accurately, with fuzzy matching that accounts for typing errors.',
    'Developed by Beit Issie Shapiro Technology Center in collaboration with SAP Labs Israel.',
  ],
  he: [
    'IssieBoard היא אפליקציית מקלדת מותאמת אישית, שתוכננה עבור אנשים עם מוגבלויות התפתחותיות או מוטוריות. האפליקציה מסייעת למשתמשים לרכוש ולתרגל מיומנויות הקלדה בקצב שלהם.',
    'האפליקציה מציעה פריסות מקלדת הניתנות להתאמה עבור עברית, אנגלית וערבית, עם אפשרות לשנות גודל מקשים, צבעים וגופנים בהתאם לצרכי כל משתמש.',
    'IssieBoard כוללת השלמת מילים וחיזוי טקסט כדי לעזור למשתמשים להקליד מהר יותר ובדיוק רב יותר, עם התאמה חכמה שמתחשבת בשגיאות הקלדה.',
    'פותחה על ידי מרכז הטכנולוגיה של בית איזי שפירא בשיתוף פעולה עם SAP Labs Israel.',
  ],
  ar: [
    'IssieBoard هو تطبيق لوحة مفاتيح قابل للتخصيص مصمم للأشخاص ذوي الإعاقات التطورية أو الحركية. يساعد التطبيق المستخدمين على اكتساب وممارسة مهارات الكتابة بالسرعة التي تناسبهم.',
    'يوفر التطبيق تخطيطات لوحة مفاتيح قابلة للتعديل للعبرية والإنجليزية والعربية، مع إمكانية تغيير أحجام المفاتيح والألوان والخطوط لتتناسب مع احتياجات كل مستخدم.',
    'يتضمن IssieBoard إكمال الكلمات والتنبؤ بالنص لمساعدة المستخدمين على الكتابة بشكل أسرع وأكثر دقة، مع مطابقة ذكية تأخذ في الاعتبار أخطاء الكتابة.',
    'تم تطويره بواسطة مركز التكنولوجيا في بيت إيزي شابيرو بالتعاون مع SAP Labs Israel.',
  ],
};
```

- [ ] **Step 3: Add info button in language bar**

In the language bar section (around line 1601-1638), after the `languageTabs` View closing tag (after line 1638) and before the Classic View button conditional (line 1639), add:

```tsx
        {/* About button */}
        <TouchableOpacity
          style={styles.aboutButton}
          onPress={() => setShowAbout(true)}
          accessibilityLabel="About"
        >
          <Text allowFontScaling={false} style={styles.aboutButtonText}>ℹ️</Text>
        </TouchableOpacity>
```

- [ ] **Step 4: Add AboutScreen overlay render**

At the very end of the component's return JSX, just before the final closing `</View>` or `</>`, add:

```tsx
      {showAbout && (
        <AboutScreen
          appName="IssieBoard"
          onClose={() => setShowAbout(false)}
          paragraphs={ISSIEBOARD_ABOUT}
        />
      )}
```

- [ ] **Step 5: Add aboutButton styles**

In the `StyleSheet.create` at the bottom of the file, add:

```typescript
  aboutButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aboutButtonText: {
    fontSize: 22,
  },
```

- [ ] **Step 6: Verify the app renders and the info button opens the About screen**

```bash
npm run ios:issieboard
```

- [ ] **Step 7: Commit**

```bash
git add src/screens/EditorScreen.tsx
git commit -m "$(cat <<'EOF'
Add About button and overlay to EditorScreen
EOF
)"
```

---

### Task 8: Add About to ClassicEditorScreen

**Files:**
- Modify: `src/screens/ClassicEditorScreen.tsx`

Add info button in the header next to the "Advanced View" button (around line 1055-1059).

- [ ] **Step 1: Add imports**

At the top of `src/screens/ClassicEditorScreen.tsx`, add:

```typescript
import { AboutScreen } from '../components/AboutScreen';
```

- [ ] **Step 2: Add state and reuse the same ISSIEBOARD_ABOUT data**

Import the paragraphs constant. Since it's in EditorScreen, we should extract it to a shared location. Add the same `ISSIEBOARD_ABOUT` constant at the top of ClassicEditorScreen (after imports), and add state:

```typescript
const [showAbout, setShowAbout] = useState(false);
```

Note: `useState` should already be imported. If not, add it to the React import.

The `ISSIEBOARD_ABOUT` constant is the same as in Task 7 Step 2. To avoid duplication, create a small shared file `src/components/about-content.ts` with the exported constants for both apps, and import from there in both EditorScreen and ClassicEditorScreen. Refactor Task 7's constant to use the same import.

- [ ] **Step 3: Add info button in header**

In the header section (around line 1055-1059), add the info button after the "Advanced View" button:

```tsx
        <View style={styles.header}>
          <Text allowFontScaling={false} style={styles.headerTitle}>{strings.editor.classicView}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={styles.aboutButton}
              onPress={() => setShowAbout(true)}
              accessibilityLabel="About"
            >
              <Text allowFontScaling={false} style={styles.aboutButtonText}>ℹ️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.advancedButton} onPress={onSwitchToAdvanced}>
              <Text allowFontScaling={false} style={styles.advancedButtonText}>{strings.editor.backToNewsettings}</Text>
            </TouchableOpacity>
          </View>
        </View>
```

- [ ] **Step 4: Add AboutScreen overlay**

At the end of the component's return, before the final closing `</SafeAreaView>`:

```tsx
      {showAbout && (
        <AboutScreen
          appName="IssieBoard"
          onClose={() => setShowAbout(false)}
          paragraphs={ISSIEBOARD_ABOUT}
        />
      )}
```

- [ ] **Step 5: Add styles**

In the StyleSheet:

```typescript
  aboutButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aboutButtonText: {
    fontSize: 22,
  },
```

- [ ] **Step 6: Commit**

```bash
git add src/components/about-content.ts src/screens/ClassicEditorScreen.tsx src/screens/EditorScreen.tsx
git commit -m "$(cat <<'EOF'
Add About button and overlay to ClassicEditorScreen, extract shared content
EOF
)"
```

---

### Task 9: Add About to IssieVoice SettingsScreen

**Files:**
- Modify: `apps/issievoice/src/screens/SettingsScreen.tsx`

Replace the inline "About IssieVoice" section (lines 108-115) with a tappable row that opens AboutScreen as overlay.

- [ ] **Step 1: Add imports**

At the top of `apps/issievoice/src/screens/SettingsScreen.tsx`, add:

```typescript
import { AboutScreen } from '../../../../src/components/AboutScreen';
```

- [ ] **Step 2: Add state and content**

Inside the `SettingsScreen` component (after line 20), add:

```typescript
  const [showAbout, setShowAbout] = useState(false);
```

Add IssieVoice paragraphs constant outside the component (after imports):

```typescript
const ISSIEVOICE_ABOUT: Record<string, string[]> = {
  en: [
    'IssieVoice is an assistive communication app for people who need help speaking. It turns typed text into speech, giving users a voice of their own.',
    'The app features automatic language detection for Hebrew and English, with separate voice selection for each language, so text is always spoken naturally.',
    'IssieVoice includes a built-in customizable keyboard powered by IssieBoard, with word suggestions and prediction to help users communicate quickly.',
    'Developed by Beit Issie Shapiro Technology Center in collaboration with SAP Labs Israel.',
  ],
  he: [
    'IssieVoice היא אפליקציית תקשורת תומכת עבור אנשים שזקוקים לעזרה בדיבור. האפליקציה הופכת טקסט מוקלד לדיבור, ומעניקה למשתמשים קול משלהם.',
    'האפליקציה כוללת זיהוי שפה אוטומטי לעברית ואנגלית, עם בחירת קול נפרדת לכל שפה, כך שהטקסט תמיד נשמע טבעי.',
    'IssieVoice כוללת מקלדת מותאמת אישית מובנית המופעלת על ידי IssieBoard, עם הצעות מילים וחיזוי טקסט כדי לעזור למשתמשים לתקשר במהירות.',
    'פותחה על ידי מרכז הטכנולוגיה של בית איזי שפירא בשיתוף פעולה עם SAP Labs Israel.',
  ],
  ar: [
    'IssieVoice هو تطبيق تواصل مساعد للأشخاص الذين يحتاجون إلى مساعدة في التحدث. يحول التطبيق النص المكتوب إلى كلام، مما يمنح المستخدمين صوتهم الخاص.',
    'يتميز التطبيق بالكشف التلقائي عن اللغة للعبرية والإنجليزية، مع اختيار صوت منفصل لكل لغة، بحيث يُنطق النص دائماً بشكل طبيعي.',
    'يتضمن IssieVoice لوحة مفاتيح مدمجة قابلة للتخصيص مدعومة من IssieBoard، مع اقتراحات الكلمات والتنبؤ بالنص لمساعدة المستخدمين على التواصل بسرعة.',
    'تم تطويره بواسطة مركز التكنولوجيا في بيت إيزي شابيرو بالتعاون مع SAP Labs Israel.',
  ],
};
```

- [ ] **Step 3: Replace inline about section with tappable row**

Replace the Info Section (lines 108-115):

```tsx
        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>{strings.settings.aboutTitle}</Text>
          <Text style={styles.infoText}>
            {strings.settings.aboutDescription}
          </Text>
          <Text style={styles.infoText}>{strings.settings.version} 1.0.0</Text>
        </View>
```

With:

```tsx
        {/* About row */}
        <TouchableOpacity
          style={styles.aboutRow}
          onPress={() => setShowAbout(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.aboutRowText}>{strings.settings.aboutTitle}</Text>
          <Text style={styles.aboutRowArrow}>›</Text>
        </TouchableOpacity>
```

- [ ] **Step 4: Add AboutScreen overlay**

After the `</ScrollView>` closing tag (before `</SafeAreaView>`), add:

```tsx
      {showAbout && (
        <AboutScreen
          appName="IssieVoice"
          onClose={() => setShowAbout(false)}
          paragraphs={ISSIEVOICE_ABOUT}
        />
      )}
```

- [ ] **Step 5: Update styles**

Replace the `infoSection`, `infoTitle`, `infoText` styles with:

```typescript
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: sizes.spacing.lg,
    marginTop: sizes.spacing.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderLight,
  },
  aboutRowText: {
    fontSize: sizes.fontSize.large,
    fontWeight: '600',
    color: colors.primary,
  },
  aboutRowArrow: {
    fontSize: 24,
    color: colors.textSecondary,
  },
```

- [ ] **Step 6: Commit**

```bash
git add apps/issievoice/src/screens/SettingsScreen.tsx
git commit -m "$(cat <<'EOF'
Replace inline about section with About screen overlay in IssieVoice
EOF
)"
```

---

### Task 10: Extract Shared About Content (DRY Cleanup)

**Files:**
- Create: `src/components/about-content.ts`
- Modify: `src/screens/EditorScreen.tsx`
- Modify: `src/screens/ClassicEditorScreen.tsx`

Move the `ISSIEBOARD_ABOUT` constant to a shared file to avoid duplication between EditorScreen and ClassicEditorScreen.

- [ ] **Step 1: Create shared content file**

Create `src/components/about-content.ts`:

```typescript
export const ISSIEBOARD_ABOUT: Record<string, string[]> = {
  en: [
    'IssieBoard is a customizable keyboard app designed for people with developmental or motor skill disabilities. It helps users acquire and practice typing skills at their own pace.',
    'The app offers configurable keyboard layouts for Hebrew, English, and Arabic, with adjustable key sizes, colors, and fonts to match each user\'s needs.',
    'IssieBoard includes word completion and prediction to help users type faster and more accurately, with fuzzy matching that accounts for typing errors.',
    'Developed by Beit Issie Shapiro Technology Center in collaboration with SAP Labs Israel.',
  ],
  he: [
    'IssieBoard היא אפליקציית מקלדת מותאמת אישית, שתוכננה עבור אנשים עם מוגבלויות התפתחותיות או מוטוריות. האפליקציה מסייעת למשתמשים לרכוש ולתרגל מיומנויות הקלדה בקצב שלהם.',
    'האפליקציה מציעה פריסות מקלדת הניתנות להתאמה עבור עברית, אנגלית וערבית, עם אפשרות לשנות גודל מקשים, צבעים וגופנים בהתאם לצרכי כל משתמש.',
    'IssieBoard כוללת השלמת מילים וחיזוי טקסט כדי לעזור למשתמשים להקליד מהר יותר ובדיוק רב יותר, עם התאמה חכמה שמתחשבת בשגיאות הקלדה.',
    'פותחה על ידי מרכז הטכנולוגיה של בית איזי שפירא בשיתוף פעולה עם SAP Labs Israel.',
  ],
  ar: [
    'IssieBoard هو تطبيق لوحة مفاتيح قابل للتخصيص مصمم للأشخاص ذوي الإعاقات التطورية أو الحركية. يساعد التطبيق المستخدمين على اكتساب وممارسة مهارات الكتابة بالسرعة التي تناسبهم.',
    'يوفر التطبيق تخطيطات لوحة مفاتيح قابلة للتعديل للعبرية والإنجليزية والعربية، مع إمكانية تغيير أحجام المفاتيح والألوان والخطوط لتتناسب مع احتياجات كل مستخدم.',
    'يتضمن IssieBoard إكمال الكلمات والتنبؤ بالنص لمساعدة المستخدمين على الكتابة بشكل أسرع وأكثر دقة، مع مطابقة ذكية تأخذ في الاعتبار أخطاء الكتابة.',
    'تم تطويره بواسطة مركز التكنولوجيا في بيت إيزي شابيرو بالتعاون مع SAP Labs Israel.',
  ],
};

export const ISSIEVOICE_ABOUT: Record<string, string[]> = {
  en: [
    'IssieVoice is an assistive communication app for people who need help speaking. It turns typed text into speech, giving users a voice of their own.',
    'The app features automatic language detection for Hebrew and English, with separate voice selection for each language, so text is always spoken naturally.',
    'IssieVoice includes a built-in customizable keyboard powered by IssieBoard, with word suggestions and prediction to help users communicate quickly.',
    'Developed by Beit Issie Shapiro Technology Center in collaboration with SAP Labs Israel.',
  ],
  he: [
    'IssieVoice היא אפליקציית תקשורת תומכת עבור אנשים שזקוקים לעזרה בדיבור. האפליקציה הופכת טקסט מוקלד לדיבור, ומעניקה למשתמשים קול משלהם.',
    'האפליקציה כוללת זיהוי שפה אוטומטי לעברית ואנגלית, עם בחירת קול נפרדת לכל שפה, כך שהטקסט תמיד נשמע טבעי.',
    'IssieVoice כוללת מקלדת מותאמת אישית מובנית המופעלת על ידי IssieBoard, עם הצעות מילים וחיזוי טקסט כדי לעזור למשתמשים לתקשר במהירות.',
    'פותחה על ידי מרכז הטכנולוגיה של בית איזי שפירא בשיתוף פעולה עם SAP Labs Israel.',
  ],
  ar: [
    'IssieVoice هو تطبيق تواصل مساعد للأشخاص الذين يحتاجون إلى مساعدة في التحدث. يحول التطبيق النص المكتوب إلى كلام، مما يمنح المستخدمين صوتهم الخاص.',
    'يتميز التطبيق بالكشف التلقائي عن اللغة للعبرية والإنجليزية، مع اختيار صوت منفصل لكل لغة، بحيث يُنطق النص دائماً بشكل طبيعي.',
    'يتضمن IssieVoice لوحة مفاتيح مدمجة قابلة للتخصيص مدعومة من IssieBoard، مع اقتراحات الكلمات والتنبؤ بالنص لمساعدة المستخدمين على التواصل بسرعة.',
    'تم تطويره بواسطة مركز التكنولوجيا في بيت إيزي شابيرو بالتعاون مع SAP Labs Israel.',
  ],
};
```

- [ ] **Step 2: Update EditorScreen to import from shared file**

Replace the inline `ISSIEBOARD_ABOUT` constant in `src/screens/EditorScreen.tsx` with:

```typescript
import { ISSIEBOARD_ABOUT } from '../components/about-content';
```

- [ ] **Step 3: Update ClassicEditorScreen to import from shared file**

Replace the inline `ISSIEBOARD_ABOUT` constant in `src/screens/ClassicEditorScreen.tsx` with:

```typescript
import { ISSIEBOARD_ABOUT } from '../components/about-content';
```

- [ ] **Step 4: Update IssieVoice SettingsScreen to import from shared file**

Replace the inline `ISSIEVOICE_ABOUT` constant in `apps/issievoice/src/screens/SettingsScreen.tsx` with:

```typescript
import { ISSIEVOICE_ABOUT } from '../../../../src/components/about-content';
```

- [ ] **Step 5: Commit**

```bash
git add src/components/about-content.ts src/screens/EditorScreen.tsx src/screens/ClassicEditorScreen.tsx apps/issievoice/src/screens/SettingsScreen.tsx
git commit -m "$(cat <<'EOF'
Extract about content to shared file
EOF
)"
```

---

### Task 11: Initialize issie-shared Language System

**Files:**
- Modify: `src/AppNavigator.tsx`
- Modify: `apps/issievoice/App.tsx`

The `FeedbackDialog` from issie-shared uses `translate()` which relies on `gCurrentLang` being set. We need to call `loadLanguage` or set `gCurrentLang` so the feedback dialog renders in the correct language. The simplest approach: import `gCurrentLang` from issie-shared and set it based on device locale at startup.

- [ ] **Step 1: Initialize issie-shared lang in AppNavigator**

In `src/AppNavigator.tsx`, add to the existing Firebase `useEffect` or the `loadInitialSettings` function:

```typescript
import { loadLanguage, LANGUAGE_SETTINGS } from '@beitissieshapiro/issie-shared';
```

Inside the `loadInitialSettings` function, after the language is determined, add:

```typescript
// Initialize issie-shared language for FeedbackDialog
const langMap: Record<string, number> = {
  he: LANGUAGE_SETTINGS.hebrew,
  en: LANGUAGE_SETTINGS.english,
  ar: LANGUAGE_SETTINGS.arabic,
};
loadLanguage(langMap[initialLanguage || 'he'] || LANGUAGE_SETTINGS.hebrew);
```

- [ ] **Step 2: Initialize issie-shared lang in IssieVoice**

In `apps/issievoice/App.tsx`, add a similar initialization. Since IssieVoice already has its own localization context, add in the App component:

```typescript
import { loadLanguage, LANGUAGE_SETTINGS } from '@beitissieshapiro/issie-shared';

// In the App component:
React.useEffect(() => {
  loadLanguage(LANGUAGE_SETTINGS.hebrew); // Default; will be updated when language changes
}, []);
```

- [ ] **Step 3: Commit**

```bash
git add src/AppNavigator.tsx apps/issievoice/App.tsx
git commit -m "$(cat <<'EOF'
Initialize issie-shared language system for FeedbackDialog
EOF
)"
```

---

### Task 12: Smoke Test & Debug Token Setup

This is a manual verification task.

- [ ] **Step 1: Build and run IssieBoard on iOS simulator**

```bash
npm run ios:issieboard
```

- [ ] **Step 2: Check console for Firebase App Check debug token**

Look in Xcode console for a line like:
```
Firebase App Check debug token: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
```

Copy this token.

- [ ] **Step 3: Update debug-token.ts with the actual token**

Edit `src/common/debug-token.ts` and replace `PASTE_YOUR_DEBUG_TOKEN_HERE` with the actual token.

- [ ] **Step 4: Add debug token to Firebase Console**

Go to Firebase Console → App Check → Apps → select the iOS app → Manage debug tokens → Add token

- [ ] **Step 5: Test the About screen**

1. Tap the ℹ️ button in the language bar
2. Verify About screen opens with correct content
3. Toggle between Hebrew, English, Arabic
4. Verify version number displays correctly
5. Tap feedback button
6. Fill in the form and submit
7. Check Firestore console for the new entry in `userFeedback` collection

- [ ] **Step 6: Test in IssieVoice**

```bash
npm run ios:issievoice
```

Navigate to Settings → tap About IssieVoice → verify the same flow works.

- [ ] **Step 7: Commit debug token**

```bash
git add src/common/debug-token.ts
git commit -m "$(cat <<'EOF'
Add App Check debug token
EOF
)"
```
