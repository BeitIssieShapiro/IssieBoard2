# Testing Plan - March 2026 (Last 2 Weeks)

**Period**: March 2-9, 2026
**Total Commits**: 22
**Focus Areas**: IssieVoice app improvements, Android porting, UI/UX enhancements, built-in profiles

---

## 1. IssieVoice App Testing (March 8)

### 1.1 Favorites Bar Feature (commits: da74856, 33c22bb, 0c82b51, 9132a4a)
**Priority**: HIGH

**Test on iOS:**
- [ ] Favorites bar displays correctly in portrait mode
- [ ] Favorites bar displays correctly in landscape mode
- [ ] Can add sentence to favorites from main screen
- [ ] Can add sentence with emoji icon (emoji picker works)
- [ ] Favorites persist after app restart
- [ ] Tapping favorite inserts it into text area
- [ ] Can delete favorite from favorites bar
- [ ] Favorites bar scrolls horizontally when many favorites exist
- [ ] Emoji keywords work for Hebrew (emoji-keywords-he.json)
- [ ] Emoji keywords work for Arabic (emoji-keywords-ar.json)
- [ ] Favorites toolbar reordering works correctly

**Test on Android:**
- [ ] All above tests on Android
- [ ] Performance is acceptable when scrolling favorites

**Files Changed:**
- `apps/issievoice/src/components/FavoritesBar/FavoritesBar.tsx`
- `apps/issievoice/src/services/FavoritesManager.ts`
- `apps/issievoice/src/assets/emoji-keywords-*.json`

---

### 1.2 UI/UX Improvements (commits: cd6290e, 293c6af)
**Priority**: HIGH

**Test on iOS & Android:**
- [ ] SpeakButton renders correctly and is touchable
- [ ] TextDisplayArea has proper layout in portrait
- [ ] TextDisplayArea has proper layout in landscape
- [ ] SuggestionsBar displays correctly
- [ ] Action buttons (Speak, Clear, Save, Browse) are large enough for accessibility
- [ ] Touch targets are at least 44pt (iOS) / 48dp (Android)
- [ ] Settings modal opens from main screen
- [ ] Browse screen navigation works
- [ ] Saved sentences can be loaded and spoken

**Files Changed:**
- `apps/issievoice/src/components/ActionBar/`
- `apps/issievoice/src/components/TextDisplayArea/TextDisplayArea.tsx`
- `apps/issievoice/src/screens/MainScreen.tsx`

---

### 1.3 IssieBoard Integration (commit: 27f4444)
**Priority**: HIGH

**Test on iOS:**
- [ ] IssieVoice uses IssieBoard keyboard settings correctly
- [ ] Opening settings from IssieVoice navigates to correct keyboard/language
- [ ] Deep linking with `://settings?language=he` works
- [ ] Deep linking with `://settings?language=en` works
- [ ] Keyboard preview shows in IssieVoice with correct colors
- [ ] Text direction detection works (Hebrew RTL, English LTR)
- [ ] Switching languages in IssieVoice updates keyboard

**Test on Android:**
- [ ] All above tests on Android
- [ ] Settings button in keyboard preview emits events correctly (commit: 6caea79)

**Files Changed:**
- `apps/issievoice/App.tsx`
- `apps/issievoice/src/screens/MainScreen.tsx`
- `src/native/KeyboardPreferences.ios.ts`
- `ios/IssieBoardNG/KeyboardPreviewView.swift`
- `android/.../KeyboardPreviewView.kt`

---

### 1.4 Screen Size & Layout (commit: 099f138)
**Priority**: MEDIUM

**Test on multiple devices:**
- [ ] iPhone SE (small screen): layout works
- [ ] iPhone 14 Pro (standard): layout works
- [ ] iPhone 14 Pro Max (large): layout works
- [ ] iPad (tablet): layout appropriate
- [ ] Android phone (small): layout works
- [ ] Android phone (large): layout works
- [ ] Android tablet: layout works
- [ ] Portrait orientation: all elements visible
- [ ] Landscape orientation: all elements visible
- [ ] Browse screen adapts to screen size

**Files Changed:**
- `apps/issievoice/App.tsx`
- `apps/issievoice/src/screens/BrowseScreen.tsx`

---

### 1.5 New App Icons (commit: 0c82b51)
**Priority**: LOW

**Test on iOS:**
- [ ] App icon displays correctly on home screen
- [ ] App icon displays correctly in App Switcher
- [ ] App icon displays correctly in Spotlight
- [ ] All icon sizes render correctly (100, 114, 120, 128, 144, 152, 167, 180, 1024)

**Test on Android:**
- [ ] App icon displays correctly on launcher
- [ ] App icon displays correctly in recent apps

---

## 2. IssieBoard Built-In Profiles (March 3)

### 2.1 Profile System (commits: 4ba2b3c, baf73b0)
**Priority**: HIGH

**Test on iOS:**
- [ ] **he-default** profile loads correctly for Hebrew
- [ ] **he-classic** profile loads correctly (yellow keys, blue text, cyan special keys)
- [ ] **he-high-contrast** profile loads correctly (yellow keys on black background)
- [ ] **en-default** profile loads correctly for English
- [ ] **en-classic** profile loads correctly
- [ ] **en-high-contrast** profile loads correctly
- [ ] Built-in profiles are read-only (cannot be edited directly)
- [ ] Can create custom profile from built-in profile ("Save As")
- [ ] Custom colors palette works (CompactColorPicker)
- [ ] Custom colors persist across sessions
- [ ] Style groups work with built-in profiles
- [ ] Switching between built-in profiles preserves settings

**Test on Android:**
- [ ] All above tests on Android
- [ ] **CRITICAL**: Verify keysBgColor and textColor are applied (parser fix from today)
- [ ] Regular letter keys get correct background color from profile
- [ ] Special keys (backspace, space, etc.) get correct group colors
- [ ] Preview shows colors correctly

**Files Changed:**
- `src/data/builtInProfiles.ts`
- `src/screens/EditorScreen.tsx`
- `components/SaveAsModal.tsx`
- `src/utils/customColorsManager.ts`
- `android/.../KeyboardConfigParser.kt` (today's fix)

---

## 3. Keyboard Configuration & Styling (March 3-4)

### 3.1 Advanced Settings (commits: 1f3b99c, dfbd6fc, 039200f)
**Priority**: HIGH

**Test on iOS & Android:**
- [ ] **Key Height**: Adjust key height slider, verify preview updates
- [ ] **Key Height**: Save config, verify keyboard uses new height
- [ ] **Key Gap**: Adjust gap slider, verify preview shows gaps
- [ ] **Key Gap**: Save config, verify keyboard uses new gaps
- [ ] **Font Size**: Adjust global font size, verify all keys update
- [ ] **Font Size**: Default font size is appropriate (48pt for default, 56pt for high-contrast)
- [ ] **Font Weight**: Select different weights (light, regular, heavy, black)
- [ ] **Font Weight**: Verify weight applies to keyboard keys
- [ ] **Font Name**: Custom font (DanaYad) works for Hebrew ordered layout
- [ ] Preview scales correctly when keyboard is too tall for container
- [ ] Keyboard height in preview matches actual keyboard height
- [ ] Settings persist when switching between keyboards

**Files Changed:**
- `src/components/toolbox/GlobalSettingsPanel.tsx`
- `src/context/EditorContext.tsx`
- `ios/Shared/KeyboardRenderer.swift`
- `android/.../KeyboardRenderer.kt`

---

### 3.2 Style Groups & Visibility (commits: fa402b6, a528b62)
**Priority**: MEDIUM

**Test on iOS & Android:**
- [ ] Can create style group with custom colors
- [ ] Can set group visibility mode: default, hide, showOnly
- [ ] Can set key opacity (semi-transparent keys)
- [ ] Opacity slider works (0.0 = fully transparent, 1.0 = opaque)
- [ ] Preview shows semi-opaque keys correctly
- [ ] Can select multiple keys for a group
- [ ] Group colors apply to selected keys
- [ ] Improved settings UI is easy to use
- [ ] CompactColorPicker shows color swatches
- [ ] Can add custom colors to palette

**Files Changed:**
- `src/components/toolbox/AddStyleRuleModal.tsx`
- `src/components/shared/CompactColorPicker.tsx`
- `ios/Shared/KeyboardModels.swift`
- `ios/Shared/KeyboardRenderer.swift`

---

### 3.3 UI Fixes (commit: f170136)
**Priority**: MEDIUM

**Test on iOS & Android:**
- [ ] **FIXED**: Key gaps now work correctly
- [ ] **FIXED**: In landscape mode, language badge (e.g., "English") is visible
- [ ] **FIXED**: Settings button has correct font size
- [ ] **FIXED**: Font weight "light" applies correctly
- [ ] **FIXED**: When all text is selected, backspace deletes it
- [ ] New app icon displays correctly
- [ ] Keyboard height is stable (doesn't jump)

**Files Changed:**
- `ios/Shared/BaseKeyboardViewController.swift`
- `ios/Shared/KeyboardRenderer.swift`
- Various icon assets

---

## 4. Android Porting (March 4)

### 4.1 Feature Parity (commits: 94c0a84, 6caea79)
**Priority**: HIGH

**Test on Android:**
- [ ] Settings button in preview works (emits events)
- [ ] KeyboardEngine has parity with iOS
- [ ] KeyboardModels data classes match iOS structs
- [ ] KeyboardRenderer renders identically to iOS
- [ ] Opacity rendering works correctly
- [ ] Group visibility modes work
- [ ] All keyboard features from iOS work on Android

**Files Changed:**
- `android/.../KeyboardEngine.kt`
- `android/.../KeyboardModels.kt`
- `android/.../KeyboardRenderer.kt`
- `android/.../KeyboardPreviewView.kt`

**Reference Documents:**
- `ANDROID_PORTING_SUMMARY.md`
- `ANDROID_PORTING_TODO.md`

---

## 5. Navigation & Deep Linking (March 4)

### 5.1 URL Scheme & Settings Navigation (commits: 085ed71, 27f4444)
**Priority**: HIGH

**Test on iOS:**
- [ ] Opening `issieboard://settings` from IssieVoice navigates to settings
- [ ] Opening `issieboard://settings?language=he` opens Hebrew keyboard settings
- [ ] Opening `issieboard://settings?language=en` opens English keyboard settings
- [ ] Opening `issieboard://settings?language=ar` opens Arabic keyboard settings
- [ ] App delegate handles URL scheme correctly
- [ ] Listener for launch keyboard language works
- [ ] Save As modal works correctly (no bugs when saving)
- [ ] Profile switching works correctly

**Test on Android:**
- [ ] URL scheme deep linking works (if implemented)
- [ ] Navigation between screens works correctly

**Files Changed:**
- `ios/IssieBoardNG/AppDelegate.swift`
- `ios/IssieBoardNG/KeyboardPreferencesModule.swift`
- `ios/Shared/BaseKeyboardViewController.swift`
- `src/screens/EditorScreen.tsx`

---

## 6. Minor Fixes & Polish

### 6.1 Space Key Label (commit: 72f5dec)
**Priority**: LOW

**Test on iOS & Android:**
- [ ] Space key no longer shows "space" text label
- [ ] Space key is still functional
- [ ] Works on Hebrew keyboard
- [ ] Works on English keyboard

**Files Changed:**
- `keyboards/he.json`
- `keyboards/en.json`

---

### 6.2 Keyboard Height Stability (commit: 14f3d91)
**Priority**: MEDIUM

**Test on iOS & Android:**
- [ ] Keyboard height doesn't change unexpectedly
- [ ] Preview height is stable
- [ ] No jumping when switching keysets (abc → 123 → #+=)
- [ ] Height calculation is simplified and consistent

---

## 7. Critical Integration Tests

### 7.1 End-to-End IssieBoard Testing
**Priority**: CRITICAL

**Test Complete User Flow on iOS:**
1. [ ] Open IssieBoard app
2. [ ] Select Hebrew language
3. [ ] Load "he-classic" profile
4. [ ] Verify preview shows yellow keys with blue text
5. [ ] Save configuration
6. [ ] Open any app (Notes, Messages, etc.)
7. [ ] Switch to IssieBoard keyboard
8. [ ] Verify keyboard appearance matches preview
9. [ ] Type Hebrew text
10. [ ] Test word suggestions work
11. [ ] Test nikkud (diacritics) work
12. [ ] Test special keys (backspace, space, enter)
13. [ ] Switch to numbers (123) and symbols (#+=)
14. [ ] Switch to English keyboard
15. [ ] Type English text
16. [ ] Return to Hebrew

**Test Complete User Flow on Android:**
- [ ] Repeat all above tests on Android
- [ ] Verify colors work correctly (keysBgColor, textColor)
- [ ] Verify performance is acceptable

---

### 7.2 End-to-End IssieVoice Testing
**Priority**: CRITICAL

**Test Complete User Flow on iOS:**
1. [ ] Open IssieVoice app
2. [ ] Type text using embedded keyboard
3. [ ] Tap "Speak" button, verify TTS works
4. [ ] Add sentence to favorites
5. [ ] Select emoji icon for favorite
6. [ ] Tap favorite to insert it
7. [ ] Save sentence to browse list
8. [ ] Open Browse screen
9. [ ] Load saved sentence
10. [ ] Speak loaded sentence
11. [ ] Delete saved sentence
12. [ ] Open Settings from main screen
13. [ ] Verify navigates to correct keyboard settings
14. [ ] Change keyboard appearance
15. [ ] Return to IssieVoice, verify keyboard updated

**Test Complete User Flow on Android:**
- [ ] Repeat all above tests on Android

---

## 8. Regression Testing

### 8.1 Core Features (must still work)
**Priority**: CRITICAL

**Test on iOS & Android:**
- [ ] Word suggestions still work correctly
- [ ] Word prediction (next-word) still works
- [ ] Auto-correct on space still works
- [ ] Nikkud (diacritics) picker still works
- [ ] Long-press backspace (delete word) still works
- [ ] Smart backspace (delete diacritic first) still works
- [ ] Language switching button still works
- [ ] Settings button opens settings
- [ ] Keyboard layouts are correct (QWERTY for English, Hebrew layout for Hebrew)
- [ ] All three keysets work (abc, ABC/123, #+=)
- [ ] Config save/load works correctly
- [ ] Profile switching doesn't lose data

---

## 9. Performance & Resource Testing

### 9.1 Performance Metrics
**Priority**: MEDIUM

**Test on iOS:**
- [ ] App launches in < 2 seconds
- [ ] Keyboard extension loads in < 1 second
- [ ] Preview renders in < 500ms
- [ ] Config changes update preview smoothly
- [ ] No memory leaks after extended use
- [ ] Memory usage stays under 50MB limit (iOS extension constraint)

**Test on Android:**
- [ ] App launches in < 3 seconds
- [ ] Keyboard service loads in < 1.5 seconds
- [ ] Preview renders in < 1 second
- [ ] Memory usage is reasonable

---

## 10. Device & OS Coverage

### 10.1 iOS Devices
**Priority**: HIGH

Test on:
- [ ] iPhone SE (small screen, iOS 16+)
- [ ] iPhone 14 Pro (standard, iOS 17+)
- [ ] iPhone 14 Pro Max (large, iOS 17+)
- [ ] iPad (9th gen, iOS 16+)
- [ ] iPad Pro 12.9" (large tablet, iOS 17+)

### 10.2 Android Devices
**Priority**: HIGH

Test on:
- [ ] Android phone (API 24 / Android 7.0)
- [ ] Android phone (API 33 / Android 13)
- [ ] Android phone (API 36 / Android 15)
- [ ] Android tablet (API 33+)

---

## 11. Documentation & Assets

### 11.1 Documentation Created
- [ ] Review KEYBOARD_DIMENSIONS_EVENTS.md
- [ ] Review KEYBOARD_DIMENSIONS_USAGE.md
- [ ] Review PREVIEW_SCALING.md
- [ ] Review ANDROID_PORTING_SUMMARY.md
- [ ] Review ANDROID_PORTING_TODO.md

### 11.2 Asset Updates
- [ ] Verify new IssieBoard app icon displays correctly
- [ ] Verify new IssieVoice app icon displays correctly
- [ ] Verify emoji keyword JSON files are valid
- [ ] Verify all icon sizes are present

---

## 12. Known Issues to Verify

### 12.1 From Commits
- [ ] Verify fix: gaps now work (was broken before)
- [ ] Verify fix: landscape language badge visible (was hidden)
- [ ] Verify fix: settings button fontSize correct
- [ ] Verify fix: font-weight "light" works
- [ ] Verify fix: backspace deletes all selected text
- [ ] Verify fix: save-as bugs fixed
- [ ] Verify fix: stable keyboard height (no jumping)

### 12.2 Android Specific (from today's fix)
- [ ] Verify fix: keysBgColor is parsed and applied
- [ ] Verify fix: textColor is parsed and applied
- [ ] Verify fix: fontSize, fontWeight, fontName are parsed
- [ ] Verify fix: keyHeight and keyGap are parsed

---

## Test Execution Checklist

### Pre-Testing Setup
- [ ] Build latest iOS app: `npm run ios`
- [ ] Build latest Android app: `npm run android`
- [ ] Build keyboard configs: `npm run build:keyboards`
- [ ] Build dictionaries: `npm run build:dictionaries`
- [ ] Install on all test devices
- [ ] Clear app data on devices (fresh install test)

### Testing Order
1. ✅ **Day 1**: Built-in profiles (Section 2)
2. ✅ **Day 2**: Advanced settings (Section 3.1)
3. [ ] **Day 3**: IssieVoice features (Section 1)
4. [ ] **Day 4**: Android feature parity (Section 4)
5. [ ] **Day 5**: End-to-end integration (Section 7)
6. [ ] **Day 6**: Regression testing (Section 8)
7. [ ] **Day 7**: Performance & device coverage (Sections 9-10)

### Bug Reporting Template
```
**Title**: [Component] Brief description
**Priority**: Critical/High/Medium/Low
**Platform**: iOS/Android/Both
**Device**: Device model and OS version
**Steps to Reproduce**:
1.
2.
3.
**Expected**:
**Actual**:
**Screenshots**: (if applicable)
**Commit**: (git hash where bug found)
```

---

## Summary Statistics

- **Total Commits**: 22
- **Total Files Changed**: ~80+ files
- **Major Features**: 5 (Built-in profiles, Favorites, Advanced settings, Android porting, Navigation)
- **Bug Fixes**: 6+
- **Documentation**: 5 new docs
- **Estimated Testing Time**: 20-30 hours (across 2 platforms, multiple devices)

---

**Last Updated**: March 9, 2026
**Next Review**: After testing completion
