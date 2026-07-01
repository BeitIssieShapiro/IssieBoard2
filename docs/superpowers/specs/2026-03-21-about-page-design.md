# About Page with User Feedback - Design Spec

## Summary

Add an About screen to both IssieBoard (configurator app) and IssieVoice (communication app) with multilingual about text (he/en/ar), user feedback via `@beitissieshapiro/issie-shared` FeedbackDialog, and native app version display. Requires Firebase integration for feedback submission.

## Apps Affected

- **IssieBoard** -- main keyboard configurator
- **IssieVoice** -- assistive communication app

## Components

### Shared: `src/components/AboutScreen.tsx`

Reusable About screen component, modeled after IssieSays `src/about.tsx`. Props:

```typescript
interface AboutScreenProps {
  appName: string;           // 'IssieBoard' | 'IssieVoice'
  onClose: () => void;
  paragraphs: Record<string, string[]>; // { he: ["para1...", "para2..."], en: [...], ar: [...] }
}
```

UI elements (top to bottom):
1. **Title bar** with "About" title and close button (X icon via `TouchableOpacity`)
2. **Language toggle** -- 3 pill buttons: Hebrew, English, Arabic (same design as IssieSays)
3. **Feedback button** -- `TouchableOpacity` with message icon (using emoji or Text), opens `FeedbackDialog` from issie-shared
4. **Scrollable content** -- about paragraphs rendered in selected language with correct `writingDirection`
5. **Version** -- native app version at bottom (from `react-native-device-info`)
6. **FeedbackDialog** -- modal from `@beitissieshapiro/issie-shared`

Note: No `IconButton` component exists in this codebase or in issie-shared. Use a simple `TouchableOpacity` with text/icon for the feedback button, consistent with existing button patterns in EditorScreen.

### Firebase: `src/firebase-config.ts`

Firebase initialization wrapper, same pattern as IssieSays:
- Imports `firebaseInit` from `@beitissieshapiro/issie-shared`
- Debug token for App Check in dev mode (device-specific, obtained from console logs on first run)
- Called once from each app's entry point via `useEffect`

## Navigation

### IssieBoard (EditorScreen)

- Add info icon button (e.g. info circle icon) in the language bar (line ~1601 of EditorScreen.tsx), next to the language tabs and before the Classic View button
- Tapping it sets `showAbout` state to `true`
- Renders `AboutScreen` as a full-screen overlay (consistent with existing modal/overlay patterns)
- `onClose` sets `showAbout` back to `false`

### IssieBoard (ClassicEditorScreen)

- Add info icon button in the header (line ~1055), next to the "Advanced View" button
- Same overlay pattern: `showAbout` state + conditional `AboutScreen` render

### IssieVoice

- Use **overlay pattern** (not stack screen) for consistency with IssieBoard and IssieSays
- In SettingsScreen: replace the inline "About IssieVoice" section with a tappable row
- Tapping the row sets `showAbout` state to `true`, renders `AboutScreen` as full-screen overlay
- This avoids having to modify the duplicated `__DEV__` / production navigator blocks in `apps/issievoice/App.tsx`
- Remove unused localization keys (`aboutTitle`, `aboutDescription`, `version`) from `apps/issievoice/src/localization/strings.ts`

## About Content

### IssieBoard Paragraphs

**English:**
1. "IssieBoard is a customizable keyboard app designed for people with developmental or motor skill disabilities. It helps users acquire and practice typing skills at their own pace."
2. "The app offers configurable keyboard layouts for Hebrew, English, and Arabic, with adjustable key sizes, colors, and fonts to match each user's needs."
3. "IssieBoard includes word completion and prediction to help users type faster and more accurately, with fuzzy matching that accounts for typing errors."
4. "Developed by Beit Issie Shapiro Technology Center in collaboration with SAP Labs Israel."

**Hebrew:**
1. "IssieBoard היא אפליקציית מקלדת מותאמת אישית, שתוכננה עבור אנשים עם מוגבלויות התפתחותיות או מוטוריות. האפליקציה מסייעת למשתמשים לרכוש ולתרגל מיומנויות הקלדה בקצב שלהם."
2. "האפליקציה מציעה פריסות מקלדת הניתנות להתאמה עבור עברית, אנגלית וערבית, עם אפשרות לשנות גודל מקשים, צבעים וגופנים בהתאם לצרכי כל משתמש."
3. "IssieBoard כוללת השלמת מילים וחיזוי טקסט כדי לעזור למשתמשים להקליד מהר יותר ובדיוק רב יותר, עם התאמה חכמה שמתחשבת בשגיאות הקלדה."
4. "פותחה על ידי מרכז הטכנולוגיה של בית איזי שפירא בשיתוף פעולה עם SAP Labs Israel."

**Arabic:**
1. "IssieBoard هو تطبيق لوحة مفاتيح قابل للتخصيص مصمم للأشخاص ذوي الإعاقات التطورية أو الحركية. يساعد التطبيق المستخدمين على اكتساب وممارسة مهارات الكتابة بالسرعة التي تناسبهم."
2. "يوفر التطبيق تخطيطات لوحة مفاتيح قابلة للتعديل للعبرية والإنجليزية والعربية، مع إمكانية تغيير أحجام المفاتيح والألوان والخطوط لتتناسب مع احتياجات كل مستخدم."
3. "يتضمن IssieBoard إكمال الكلمات والتنبؤ بالنص لمساعدة المستخدمين على الكتابة بشكل أسرع وأكثر دقة، مع مطابقة ذكية تأخذ في الاعتبار أخطاء الكتابة."
4. "تم تطويره بواسطة مركز التكنولوجيا في بيت إيزي شابيرو بالتعاون مع SAP Labs Israel."

### IssieVoice Paragraphs

**English:**
1. "IssieVoice is an assistive communication app for people who need help speaking. It turns typed text into speech, giving users a voice of their own."
2. "The app features automatic language detection for Hebrew and English, with separate voice selection for each language, so text is always spoken naturally."
3. "IssieVoice includes a built-in customizable keyboard powered by IssieBoard, with word suggestions and prediction to help users communicate quickly."
4. "Developed by Beit Issie Shapiro Technology Center in collaboration with SAP Labs Israel."

**Hebrew:**
1. "IssieVoice היא אפליקציית תקשורת תומכת עבור אנשים שזקוקים לעזרה בדיבור. האפליקציה הופכת טקסט מוקלד לדיבור, ומעניקה למשתמשים קול משלהם."
2. "האפליקציה כוללת זיהוי שפה אוטומטי לעברית ואנגלית, עם בחירת קול נפרדת לכל שפה, כך שהטקסט תמיד נשמע טבעי."
3. "IssieVoice כוללת מקלדת מותאמת אישית מובנית המופעלת על ידי IssieBoard, עם הצעות מילים וחיזוי טקסט כדי לעזור למשתמשים לתקשר במהירות."
4. "פותחה על ידי מרכז הטכנולוגיה של בית איזי שפירא בשיתוף פעולה עם SAP Labs Israel."

**Arabic:**
1. "IssieVoice هو تطبيق تواصل مساعد للأشخاص الذين يحتاجون إلى مساعدة في التحدث. يحول التطبيق النص المكتوب إلى كلام، مما يمنح المستخدمين صوتهم الخاص."
2. "يتميز التطبيق بالكشف التلقائي عن اللغة للعبرية والإنجليزية، مع اختيار صوت منفصل لكل لغة، بحيث يُنطق النص دائماً بشكل طبيعي."
3. "يتضمن IssieVoice لوحة مفاتيح مدمجة قابلة للتخصيص مدعومة من IssieBoard، مع اقتراحات الكلمات والتنبؤ بالنص لمساعدة المستخدمين على التواصل بسرعة."
4. "تم تطويره بواسطة مركز التكنولوجيا في بيت إيزي شابيرو بالتعاون مع SAP Labs Israel."

## Dependencies

### To Add

```
@react-native-firebase/app@^23.7.0
@react-native-firebase/app-check@^23.7.0
@react-native-firebase/functions@^23.7.0
@react-native-firebase/analytics@^23.7.0
react-native-device-info
```

Version `^23.7.0` matches what `issie-shared@1.0.3` uses for its Firebase dependencies.

### Already Installed

- `@beitissieshapiro/issie-shared@^1.0.3`

## Firebase Console Setup (Manual Steps -- User-Guided)

The Firebase project `myissiesign` (project number `821810142864`) is shared across all Issie apps. The cloud function `addUserFeedback2` already exists in `europe-west1`.

### Step 1: Register Apps in Firebase Console

#### IssieBoard iOS
1. Go to Firebase Console -> project `myissiesign`
2. Click "Add app" -> iOS
3. Bundle ID: check `ios/IssieBoardNG.xcodeproj` for the main app bundle ID (e.g. `com.issieboardng` or `org.issieshapiro.issieboardng`)
4. Download `GoogleService-Info.plist`
5. In Xcode: right-click `ios/IssieBoardNG/` folder -> "Add Files to IssieBoardNG" -> select the plist -> ensure "Copy items if needed" is checked and target `IssieBoardNG` is selected
6. Note: Keyboard extensions do NOT need their own Firebase config -- only the main app target needs it

#### IssieBoard Android
1. In Firebase Console, click "Add app" -> Android
2. Package name: check `android/app/build.gradle` for `applicationId` under the issieboard flavor
3. Download `google-services.json` -> place in `android/app/`
4. Note: Android uses a single `google-services.json` for all flavors; it can contain multiple client entries

#### IssieVoice iOS
1. In Firebase Console, click "Add app" -> iOS
2. Bundle ID: check `ios/IssieVoice/IssieVoice-Info.plist` for the bundle ID
3. Download updated `GoogleService-Info.plist` (or add the IssieVoice client to the existing one)
4. Add to `ios/IssieVoice/` folder in Xcode, targeting `IssieVoice`

#### IssieVoice Android
1. In Firebase Console, click "Add app" -> Android
2. Package name: check `android/app/build.gradle` for `applicationId` under the issievoice flavor
3. The `google-services.json` in `android/app/` will be updated to include both apps

### Step 2: App Check Configuration
1. In Firebase Console -> App Check
2. For each registered app:
   - iOS: Register with App Attest provider
   - Android: Register with Play Integrity provider
3. Development: debug tokens will be obtained from console logs on first run, then added to Firebase Console -> App Check -> Manage debug tokens

### Step 3: Gradle Configuration

`android/build.gradle` -- add to buildscript dependencies:
```gradle
classpath 'com.google.gms:google-services:4.4.2'
```

`android/app/build.gradle` -- add at bottom:
```gradle
apply plugin: 'com.google.gms.google-services'
```

### Step 4: Xcode Configuration
1. In Xcode, select IssieBoardNG project
2. Select main app target -> Signing & Capabilities -> + Capability -> App Attest
3. Repeat for IssieVoice target if it's a separate target
4. Run `cd ios && pod install` after npm install

## Version Display

Use `react-native-device-info` to get native version:
```typescript
import { getVersion, getBuildNumber } from 'react-native-device-info';
// Display: "Version 1.2.3 (10)"
```

This reads from `CFBundleShortVersionString`/`CURRENT_PROJECT_VERSION` on iOS and `versionName`/`versionCode` on Android.

## Files to Create/Modify

### New Files
- `src/components/AboutScreen.tsx` -- shared About component
- `src/firebase-config.ts` -- Firebase initialization wrapper
- `src/common/debug-token.ts` -- App Check debug token (placeholder, device-specific)

### Modified Files
- `src/screens/EditorScreen.tsx` -- add info icon in language bar + about overlay
- `src/screens/ClassicEditorScreen.tsx` -- add info icon in header + about overlay
- `apps/issievoice/src/screens/SettingsScreen.tsx` -- replace inline about section with tappable row that opens About overlay
- `apps/issievoice/src/localization/strings.ts` -- remove unused `aboutTitle`, `aboutDescription`, `version` keys
- `src/AppNavigator.tsx` -- init Firebase in useEffect
- `apps/issievoice/App.tsx` -- init Firebase in useEffect
- `android/build.gradle` -- google-services classpath
- `android/app/build.gradle` -- apply google-services plugin

## Testing

1. Run app in debug mode
2. Check console for App Check debug token
3. Add debug token to Firebase Console (for both iOS and Android)
4. Open About screen -> tap feedback -> fill form -> submit
5. Verify entry appears in Firestore `userFeedback` collection with `appName` = 'IssieBoard' or 'IssieVoice'
