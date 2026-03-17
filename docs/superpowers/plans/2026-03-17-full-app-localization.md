# Full App Localization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up localization across all ~230 hardcoded English strings in both the Configurator and IssieVoice React Native apps.

**Architecture:** Expand existing hand-rolled localization system with nested string groups, Context provider, debug mode, and 3-language support (en/he/ar). No new dependencies.

**Tech Stack:** React Native, TypeScript, React Context API

**Spec:** `docs/superpowers/specs/2026-03-17-full-app-localization-design.md`

---

## Chunk 1: Configurator Localization Infrastructure

### Task 1: Rewrite Configurator strings.ts with nested structure

**Files:**
- Rewrite: `src/localization/strings.ts`

This is the largest single file change. Replace the flat `Strings` interface with the nested structure from the spec. Migrate all existing en/he/ar translations to their new nested locations using the migration table in the spec. Add all ~150 new string keys with translations in all 3 languages.

- [ ] **Step 1: Rewrite `src/localization/strings.ts`**

Replace the entire file with the new nested `Strings` interface and all three language objects (en, he, ar). Key points:
- The interface must match the spec exactly (sections: common, editor, alerts, classic, toolbox, globalSettings, keyEditor, styleRules, diacritics, styleRuleModal, colorPicker, canvas, addProfileModal, saveAsModal, profiles, status, toggleSwitch)
- **Note:** The spec has a duplicate `failedToLoadProfile` key in the `alerts` section. Use only one -- the second should be `failedToLoadForEditing` (which is already defined separately).
- Migrate existing he/ar translations to their new nested keys per the migration table in the spec
- Add new strings for all keys that don't exist yet (toolbox labels, editor alerts, classic settings, etc.)
- All new Hebrew and Arabic translations must be provided
- Use `{{name}}` and `{{count}}` for interpolation placeholders
- Export `Language`, `Strings`, `translations`, and `getStrings`

Reference the migration table in the spec (section "Migration Table: Old Flat Keys to New Nested Keys") to preserve existing translations. For new strings, translate from English.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No errors (all three language objects must satisfy the Strings interface)

- [ ] **Step 3: Commit**

```bash
git add src/localization/strings.ts
git commit -m "feat(l10n): rewrite configurator strings with nested structure

Migrate flat Strings interface to nested groups (common, editor, alerts,
classic, toolbox, globalSettings, etc.). Preserve all existing he/ar
translations. Add ~150 new translated strings for all 3 languages."
```

---

### Task 2: Rewrite Configurator localization index with Context provider and debug mode

**Files:**
- Rewrite: `src/localization/index.ts`

Replace the standalone hook with a React Context provider pattern (matching IssieVoice). Fix the hardcoded `return 'he'` bug. Add debug mode.

- [ ] **Step 1: Rewrite `src/localization/index.ts`**

The new file must:
1. Import `React, createContext, useContext, useState, useEffect` from react
2. Import `Language, Strings, getStrings as getRawStrings, translations` from `./strings`
3. Re-export `Language` and `Strings` types
4. Add `const DEBUG_LOCALIZATION = false;` flag at the top
5. Add `prefixStrings` utility function (recursive, prefixes all string values with `"."`)
6. Add `getStrings` wrapper that applies `prefixStrings` when debug mode is on
7. Fix `getDeviceLanguage()` -- remove the hardcoded `return 'he'` on the current line 21
8. Create `LocalizationContext` with `createContext`
9. Create `LocalizationProvider` component (same pattern as IssieVoice's)
10. Create `useLocalization()` hook that reads from context, returns `{ language, strings, changeLanguage, isRTL }`
11. Export `LocalizationProvider`, `useLocalization`, and `getStrings`

The `useLocalization` hook must throw if used outside provider (same as IssieVoice).

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/localization/index.ts
git commit -m "feat(l10n): add Context provider and debug mode to configurator

Replace standalone hook with LocalizationProvider + useLocalization().
Fix hardcoded 'return he' language detection bug. Add DEBUG_LOCALIZATION
flag that prefixes all strings with '.' for testing coverage."
```

---

### Task 3: Wrap Configurator app root with LocalizationProvider

**Files:**
- Modify: `src/AppNavigator.tsx`

- [ ] **Step 1: Add LocalizationProvider wrapper**

In `src/AppNavigator.tsx`:
1. Add import: `import { LocalizationProvider } from './localization';`
2. In the `AppNavigator` component's return, wrap the outermost `<View>` with `<LocalizationProvider>...</LocalizationProvider>`

- [ ] **Step 2: Verify the app still compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/AppNavigator.tsx
git commit -m "feat(l10n): wrap configurator root with LocalizationProvider"
```

---

## Chunk 2: Wire Up Configurator Screens

### Task 4: Wire up EditorScreen.tsx

**Files:**
- Modify: `src/screens/EditorScreen.tsx`

This is the largest component (~65 hardcoded strings). Replace all hardcoded strings with `strings.*` references.

- [ ] **Step 1: Add localization hook**

At the top of the `EditorScreenContent` component (or whichever inner component renders the UI), add:
```typescript
const { strings } = useLocalization();
```
Add import: `import { useLocalization } from '../localization';`

- [ ] **Step 2: Replace all hardcoded strings**

Work through the file replacing every hardcoded string. Key areas:
- `LANGUAGES` array: `name` fields use `strings.editor.languages.*`, `keyboards[].name` uses `strings.editor.keyboardVariants.*`
- Alert dialogs: titles, messages, button labels all use `strings.alerts.*` and `strings.common.*`
- Toast messages (strings starting with check/cross marks)
- Profile picker: `'Built-in'`, `'+ New'`, `'Delete'`, `'Select'`, `'Active'`
- Header: `'Settings'`, `'IssieBoard Settings'`, `'Classic View'`
- Duplicate modal: title, placeholder, buttons
- All `'Default'` profile name fallbacks
- Interpolated strings use `strings.X.replace('{{name}}', value)` pattern

Note: The `LANGUAGES` array is defined outside the component. Move it inside (or into a function that takes `strings`) so it can use localized values.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/screens/EditorScreen.tsx
git commit -m "feat(l10n): wire up EditorScreen with localized strings

Replace ~65 hardcoded English strings with strings.* references.
Covers alerts, toasts, profile picker, header, and duplicate modal."
```

---

### Task 5: Wire up ClassicEditorScreen.tsx

**Files:**
- Modify: `src/screens/ClassicEditorScreen.tsx`

- [ ] **Step 1: Add localization hook and replace strings**

Add `const { strings } = useLocalization();` and import.
Replace all hardcoded strings (~30):
- The `titles` Record mapping setting IDs to display names -- use `strings.classic.*`
- Alert dialogs for reset/clear
- Header title and "Advanced View" button
- Key order labels ("Standard", "Ordered")
- Nikkud labels ("Basic", "Full")
- Special keys / visible keys labels and placeholders
- `'Default'` profile name fallback

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add src/screens/ClassicEditorScreen.tsx
git commit -m "feat(l10n): wire up ClassicEditorScreen with localized strings"
```

---

### Task 6: Wire up ClassicSectionsList.tsx and ClassicDetailView.tsx

**Files:**
- Modify: `src/screens/classic/ClassicSectionsList.tsx`
- Modify: `src/screens/classic/ClassicDetailView.tsx`

- [ ] **Step 1: Wire up ClassicSectionsList**

Add `const { strings } = useLocalization();` and import.
Replace all hardcoded strings (~30):
- Language names: `'Hebrew'`, `'English'`, `'Arabic'` -> `strings.editor.languages.*`
- Section headers: `'Main Settings'`, `'Main Colors'`, `'Action Keys'`, etc. -> `strings.classic.*`
- Setting row titles: `'Background Color'`, `'Keys Color'`, etc. -> `strings.classic.*`
- Division toggle: `'By Rows'`, `'By Sections'` -> `strings.classic.*`
- Group labels: `'Top Row'`, `'Middle Row'`, etc. -> `strings.classic.*`
- `'My IssieBoards'` button -> `strings.editor.myKeyboards`

- [ ] **Step 2: Wire up ClassicDetailView**

Add hook and import. Replace `'< Back'` with `strings.common.back`.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 4: Commit**

```bash
git add src/screens/classic/
git commit -m "feat(l10n): wire up Classic editor screens with localized strings"
```

---

## Chunk 3: Wire Up Configurator Toolbox Components

### Task 7: Wire up GlobalSettingsPanel.tsx

**Files:**
- Modify: `src/components/toolbox/GlobalSettingsPanel.tsx`

- [ ] **Step 1: Add localization hook and replace strings**

Add `const { strings } = useLocalization();` and import from `../../localization`.
Replace all hardcoded strings (~25):
- Section titles: `'Colors'`, `'Font'`, `'Gap Between Keys'`, `'Features'`, `'Advanced Settings'`, `'Keyboard Layout'`
- Color column headers: `'Background'`, `'Keys Background'`, `'Keys Text'`
- `'Default'` labels passed to color pickers -> `strings.common.default`
- Feature toggle labels and descriptions
- Height presets: `'Compact'`, `'Normal'`, `'Tall'`, `'X-Tall'`
- Font size labels: `'XS'`, `'S'`, `'M'`, `'L'`, `'XL'`
- Font weight labels: `'Light'` through `'Heavy'`
- Key gap options: `'Regular'`, `'Medium'`, `'Large'`

- [ ] **Step 2: Verify TypeScript compiles**

- [ ] **Step 3: Commit**

```bash
git add src/components/toolbox/GlobalSettingsPanel.tsx
git commit -m "feat(l10n): wire up GlobalSettingsPanel with localized strings"
```

---

### Task 8: Wire up KeyEditorPanel.tsx

**Files:**
- Modify: `src/components/toolbox/KeyEditorPanel.tsx`

- [ ] **Step 1: Add localization hook and replace strings**

Replace all hardcoded strings (~15):
- Labels: `'Group Name:'`, `'In Groups:'`, `'Visibility'`, `'Key Info'`
- Section titles: `'Key Background Color'`, `'Text Color'`, `'Custom Label'`
- Placeholders: `'Enter group name'`, `'Enter custom label'`
- Hints: visibility explanation text, custom label override text
- Info fields: `'Position:'`, `'Output:'`, `'Shift Output:'`, `'Type:'`, `'Width:'`
- Accessibility labels: `'Done editing'`, `'Deselect all'`
- `'Default'` passed to color pickers

- [ ] **Step 2: Verify TypeScript compiles**

- [ ] **Step 3: Commit**

```bash
git add src/components/toolbox/KeyEditorPanel.tsx
git commit -m "feat(l10n): wire up KeyEditorPanel with localized strings"
```

---

### Task 9: Wire up AddStyleRuleModal.tsx, GroupsPanel.tsx, StyleRulesPanel.tsx

**Files:**
- Modify: `src/components/toolbox/AddStyleRuleModal.tsx`
- Modify: `src/components/toolbox/GroupsPanel.tsx`
- Modify: `src/components/toolbox/StyleRulesPanel.tsx`

- [ ] **Step 1: Wire up AddStyleRuleModal**

Add hook and import. Replace (~18 strings):
- Modal title: `'New Keys Group'`
- Labels: `'Name:'`, `'Visibility'`
- Visibility options: `'Default'`, `'Hide'`, `'Show Only'`
- Hints: show-only and hidden hints
- Color picker titles: `'Background Color'`, `'Text Color'`
- `'Default'` systemDefaultLabel
- Button labels: `'Cancel'`, `'Save'`/`'Apply'`/`'Create'`
- Toast: `'Keys locked...'`
- Interpolated strings: preset keys locked, tap keys to select

- [ ] **Step 2: Wire up GroupsPanel**

Add hook and import. Replace (~12 strings):
- Empty state: `'No Style Groups Yet'`, description text
- Header: `'Style Groups'`
- Indicators: `'Hidden'`, `'Visible'`, `'Editing'`, `'Inactive...'`
- Tips section title and content
- Delete alert: title, interpolated message, `'Cancel'`, `'Delete'`

- [ ] **Step 3: Wire up StyleRulesPanel**

Add hook and import. Replace (~8 strings):
- Delete alert: title, interpolated message
- Indicators: `'Hidden'`, `'Show Only'`
- Labels: `'BG:'`, `'Text:'`
- Empty states: `'No styles applied'`, `'No keys groups yet...'`
- Buttons: `'Edit'`, `'Delete'`

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 5: Commit**

```bash
git add src/components/toolbox/AddStyleRuleModal.tsx src/components/toolbox/GroupsPanel.tsx src/components/toolbox/StyleRulesPanel.tsx
git commit -m "feat(l10n): wire up style rule components with localized strings"
```

---

### Task 10: Wire up DiacriticsPanel.tsx and Toolbox.tsx

**Files:**
- Modify: `src/components/toolbox/DiacriticsPanel.tsx`
- Modify: `src/components/toolbox/Toolbox.tsx`

- [ ] **Step 1: Wire up DiacriticsPanel**

Add hook and import. Replace (~7 strings):
- `'Enable Nikkud (Diacritics)'` title
- Mode labels: `'Basic'`, `'Full'`, `'Custom'`, `'None'`
- Section titles: `'Diacritics'`, `'Modifiers'`
- Empty state: `'No diacritics available...'`

- [ ] **Step 2: Wire up Toolbox**

Add hook and import. Replace (~6 strings):
- Accordion titles: `'General Appearance'`, `'Keys Groups'`, `'Nikkud (Diacritics)'`
- Button labels: `'Presets'`, `'New'`
- Modal title: `'Keys Group Presets'`
- `'keys:'` label

Note: Keep emojis/icons as-is in front of the localized text (they're visual, not translatable).

- [ ] **Step 3: Verify TypeScript compiles**

- [ ] **Step 4: Commit**

```bash
git add src/components/toolbox/DiacriticsPanel.tsx src/components/toolbox/Toolbox.tsx
git commit -m "feat(l10n): wire up DiacriticsPanel and Toolbox with localized strings"
```

---

## Chunk 4: Wire Up Configurator Shared & Top-Level Components

### Task 11: Wire up shared components (ColorPicker, ToggleSwitch, InteractiveCanvas)

**Files:**
- Modify: `src/components/shared/ColorPicker.tsx`
- Modify: `src/components/shared/CompactColorPicker.tsx`
- Modify: `src/components/shared/ColorPickerRow.tsx`
- Modify: `src/components/shared/ToggleSwitch.tsx`
- Modify: `src/components/canvas/InteractiveCanvas.tsx`

- [ ] **Step 1: Wire up ColorPicker.tsx**

Add hook and import. Replace:
- `'Pick a Color'` modal title -> `strings.colorPicker.modalTitle`
- `'Selected Color:'` -> `strings.colorPicker.selectedColor`
- `'Cancel'` -> `strings.common.cancel`
- `'Apply'` -> `strings.common.apply`
- Change default prop `systemDefaultLabel` from `'Default'` to use localized value, or accept it via prop from parent (parent must pass `strings.common.default`)

- [ ] **Step 2: Wire up CompactColorPicker.tsx and ColorPickerRow.tsx**

Same pattern -- update `'Selected Color:'` and `'Default'` systemDefaultLabel default prop.

- [ ] **Step 3: Wire up ToggleSwitch.tsx**

Add hook and import. Replace:
- Default props `labelOn='On'` / `labelOff='Off'` -> use `strings.common.on` / `strings.common.off`
- Accessibility labels -> `strings.toggleSwitch.a11yVisible` / `strings.toggleSwitch.a11yHidden`
- `'Visible'` / `'Hidden'` text -> `strings.toggleSwitch.visible` / `strings.toggleSwitch.hidden`

- [ ] **Step 4: Wire up InteractiveCanvas.tsx**

Add hook and import. Replace `'Preview'` with `strings.canvas.preview`.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 6: Commit**

```bash
git add src/components/shared/ src/components/canvas/InteractiveCanvas.tsx
git commit -m "feat(l10n): wire up shared components with localized strings"
```

---

### Task 12: Wire up top-level modal components

**Files:**
- Modify: `components/AddProfileModal.tsx`
- Modify: `components/SaveAsModal.tsx`
- Modify: `components/SaveProfileModal.tsx`

- [ ] **Step 1: Wire up AddProfileModal**

This file already imports `useLocalization` but uses the old flat keys and has hardcoded fallbacks. Update:
- Change all `strings.cancel` -> `strings.common.cancel`, `strings.create` -> `strings.common.create`, etc.
- Replace hardcoded `'Please enter a name'` -> `strings.addProfileModal.enterName`
- Replace `'This name is already in use'` -> `strings.addProfileModal.nameInUse`
- Replace `'Add New IssieBoard'` -> `strings.addProfileModal.title`
- Replace `'IssieBoard Name'` -> `strings.addProfileModal.nameLabel`
- Replace `'My Custom Keyboard'` placeholder -> `strings.addProfileModal.placeholder`

- [ ] **Step 2: Wire up SaveAsModal**

Same pattern. Update flat key references to nested. Replace hardcoded strings:
- `'Save As New IssieBoard'` -> `strings.saveAsModal.title`
- Interpolated message -> `strings.saveAsModal.message.replace('{{name}}', originalName)`
- Error strings, labels, placeholder

- [ ] **Step 3: Wire up SaveProfileModal**

Update flat key references to nested. Remove English fallbacks (e.g., `strings.saveProfile || 'Save Profile'` becomes just `strings.profiles.saveProfile`).

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 5: Commit**

```bash
git add components/AddProfileModal.tsx components/SaveAsModal.tsx components/SaveProfileModal.tsx
git commit -m "feat(l10n): update modal components to use nested localized strings"
```

---

## Chunk 5: IssieVoice Localization Infrastructure

### Task 13: Rewrite IssieVoice strings.ts with nested structure and Arabic

**Files:**
- Rewrite: `apps/issievoice/src/localization/strings.ts`

- [ ] **Step 1: Rewrite with nested structure**

Replace the flat interface with nested groups (common, app, actionBar, textDisplay, browse, favorites, settings, settingsModal, notifications). Add Arabic translations. Migrate existing en/he translations to nested keys. Add all new keys for settings, favorites, and notifications.

Key points:
- Export `Language` type as `'en' | 'he' | 'ar'`
- Export `Strings` interface, `en`, `he`, `ar` objects, `translations` record, and `getStrings`
- Same pattern as configurator's strings.ts
- All ~70 strings translated into all 3 languages

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add apps/issievoice/src/localization/strings.ts
git commit -m "feat(l10n): rewrite IssieVoice strings with nested structure and Arabic"
```

---

### Task 14: Update IssieVoice LocalizationContext with Arabic and debug mode

**Files:**
- Modify: `apps/issievoice/src/context/LocalizationContext.tsx`

- [ ] **Step 1: Update LocalizationContext**

1. Update import to: `import { Language, Strings, translations, getStrings as getRawStrings } from '../localization/strings';` (import `Language` and `getStrings` from strings.ts instead of defining locally)
2. **Remove** the local `type Language = 'en' | 'he';` definition (now imported from strings.ts)
3. **Remove** the local `getStrings` function (now imported from strings.ts)
4. Add `const DEBUG_LOCALIZATION = false;` flag
5. Add `prefixStrings` utility (same as configurator)
6. Create a local `getLocalizedStrings` wrapper that calls `getRawStrings` and applies `prefixStrings` when debug mode is on
7. Update `getDeviceLanguage()`: add Arabic detection (`langCode === 'ar'`) -- change the fallback logic from `return langCode === 'he' ? 'he' : 'en'` to include `if (langCode === 'ar') return 'ar';`
8. Update `isRTL` from `language === 'he'` to `language === 'he' || language === 'ar'`
9. Update `LocalizationContextType` interface: rename `setLanguage` to `changeLanguage` for consistency with configurator (update provider value accordingly)
10. Update the `useState` and `useEffect` calls to use `getLocalizedStrings` instead of the old local `getStrings`

**Important:** The rename from `setLanguage` to `changeLanguage` will break any IssieVoice component that destructures `{ setLanguage }` from `useLocalization()`. These must be updated in Tasks 15/16 when wiring those components.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add apps/issievoice/src/context/LocalizationContext.tsx
git commit -m "feat(l10n): add Arabic support and debug mode to IssieVoice localization"
```

---

## Chunk 6: Wire Up IssieVoice Components

### Task 15: Wire up IssieVoice screens (SettingsScreen, BrowseScreen, MainScreen)

**Files:**
- Modify: `apps/issievoice/src/screens/SettingsScreen.tsx`
- Modify: `apps/issievoice/src/screens/BrowseScreen.tsx`
- Modify: `apps/issievoice/src/screens/MainScreen.tsx`

- [ ] **Step 1: Wire up SettingsScreen**

Add `const { strings } = useLocalization();` with import: `import { useLocalization } from '../context/LocalizationContext';`

**IssieVoice import path note:** All IssieVoice components import from `'../context/LocalizationContext'` (or `'../../context/LocalizationContext'` for deeper nesting), NOT from `'../localization'` as in the configurator.

Replace all hardcoded strings (~13):
- `'Settings'` header -> `strings.settings.title`
- `'← Back'` -> `strings.common.back`
- `'Speech Speed'`, `'Voice Pitch'` section titles
- Rate labels: `'Slow'`, `'Normal'`, `'Fast'`
- Pitch labels: `'Low'`, `'Normal'`, `'High'`
- About section: title, description, version

Note: The `rateOptions` and `pitchOptions` arrays with hardcoded labels are already inside the component function body -- just replace the label strings with `strings.settings.*` references.

- [ ] **Step 2: Wire up BrowseScreen**

This file already uses `strings.*` for most things. Add missing strings (~20):
- Favorites edit modal: `'Select Favorite'` -> `strings.favorites.selectFavorite`
- `'Customize Favorite'` -> `strings.favorites.customize`
- Labels: `'Caption'`, `'Icon'` -> `strings.favorites.caption`, `strings.favorites.icon`
- Placeholders and hints
- Modal buttons: `'Cancel'`, `'Save'`
- Notifications: `'Added to favorites'`, `'Favorite updated'`
- Update all existing `strings.cancel` -> `strings.common.cancel`, `strings.delete` -> `strings.common.delete`, etc.
- Also update `setLanguage` destructuring to `changeLanguage` (if used in this component, due to Task 14 rename)

**IssieVoice flat-to-nested key migration reference:**
`appTitle` -> `app.title`, `speak` -> `actionBar.speak`, `speaking` -> `actionBar.speaking`, `clear` -> `actionBar.clear`, `save` (actionBar) -> `actionBar.save`, `browse` -> `actionBar.browse`, `switchToHebrew` -> `actionBar.switchToHebrew`, `switchToEnglish` -> `actionBar.switchToEnglish`, `textPlaceholder` -> `textDisplay.placeholder`, `savedSentences` -> `browse.savedSentences`, `back` -> `common.back`, `clearAll` -> `browse.clearAll`, `searchSentences` -> `browse.search`, `noSavedSentences` -> `browse.noSaved`, `noSavedSentencesSubtext` -> `browse.noSavedSubtext`, `noMatchingSearch` -> `browse.noMatchingSearch`, `tryDifferentSearch` -> `browse.tryDifferentSearch`, `deleteText` -> `browse.deleteText`, `deleteConfirm` -> `browse.deleteConfirm`, `cancel` -> `common.cancel`, `delete` -> `common.delete`, `clearAllConfirm` -> `browse.clearAllConfirm`, `saved` -> `notifications.saved`, `savedSuccessMessage` -> `notifications.savedSuccess`, `error` -> `common.error`, `failedToSave` -> `notifications.failedToSave`, `alreadyExists` -> `notifications.alreadyExists`, `deleted` -> `browse.deleted`, `allDeleted` -> `browse.allDeleted`, `yes` -> `common.yes`, `no` -> `common.no`, `moveLeft` -> `favorites.moveLeft`, `moveRight` -> `favorites.moveRight`

- [ ] **Step 3: Wire up MainScreen**

Remove hardcoded fallback strings. Change:
- `strings.alreadyExists || 'This sentence is already saved'` -> `strings.notifications.alreadyExists`
- `strings.savedSuccessMessage || 'Saved successfully'` -> `strings.notifications.savedSuccess`
- `strings.failedToSave || 'Failed to save'` -> `strings.notifications.failedToSave`

Update all other flat key references to nested (e.g., `strings.save` -> `strings.actionBar.save`).

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 5: Commit**

```bash
git add apps/issievoice/src/screens/
git commit -m "feat(l10n): wire up IssieVoice screens with localized strings"
```

---

### Task 16: Wire up IssieVoice components (SettingsModal, FavoritesBar, TextDisplayArea)

**Files:**
- Modify: `apps/issievoice/src/components/SettingsModal/SettingsModal.tsx`
- Modify: `apps/issievoice/src/components/FavoritesBar/FavoritesBar.tsx`
- Modify: `apps/issievoice/src/components/TextDisplayArea/TextDisplayArea.tsx`

Note: `SpeakButton.tsx` receives all strings via props from its parent (`MainScreen.tsx`) and needs no changes.

- [ ] **Step 1: Wire up SettingsModal**

Add hook and import. Replace all hardcoded strings (~12):
- `'Settings'` title -> `strings.settingsModal.title`
- `'Language Mode'` section -> `strings.settingsModal.languageMode`
- Language mode options and descriptions
- `'Hebrew Voice'`, `'English Voice'` sections
- `'Current: '` and `'None'` labels

- [ ] **Step 2: Update FavoritesBar and TextDisplayArea**

These already use `strings.*` but with flat keys. Update to nested:
- `strings.moveLeft` -> `strings.favorites.moveLeft`
- `strings.moveRight` -> `strings.favorites.moveRight`
- `strings.delete` -> `strings.common.delete`
- `strings.textPlaceholder` -> `strings.textDisplay.placeholder`
Also update any `setLanguage` destructuring to `changeLanguage` if present.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 4: Commit**

```bash
git add apps/issievoice/src/components/
git commit -m "feat(l10n): wire up IssieVoice components with localized strings"
```

---

## Chunk 7: Verification

### Task 17: Full TypeScript check and lint

**Files:** None (verification only)

- [ ] **Step 1: Run full TypeScript type check**

Run: `npx tsc --noEmit 2>&1 | head -50`
Expected: No errors. If there are errors, fix them before proceeding.

- [ ] **Step 2: Run lint**

Run: `npm run lint 2>&1 | head -50`
Expected: No new lint errors from localization changes.

- [ ] **Step 3: Enable debug mode and visually verify**

Temporarily set `DEBUG_LOCALIZATION = true` in both:
- `src/localization/index.ts`
- `apps/issievoice/src/context/LocalizationContext.tsx`

Run the app and check that all visible UI text starts with `"."`. Any text without a dot is a missed hardcoded string.

- [ ] **Step 4: Disable debug mode**

Set `DEBUG_LOCALIZATION = false` in both files.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "fix(l10n): fix any remaining type/lint issues from localization wiring"
```
