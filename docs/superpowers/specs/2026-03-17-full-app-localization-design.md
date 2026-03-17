# Full App Localization Design

**Date:** 2026-03-17
**Status:** Draft
**Scope:** Wire up localization across both the Configurator and IssieVoice apps

## Overview

The localization infrastructure exists (`src/localization/` and `apps/issievoice/src/localization/`) but ~230 hardcoded English strings across the codebase bypass it. This design covers expanding the string definitions, organizing them into nested groups, wiring every component to use the localization hook, and adding a debug mode for verification.

## Languages

- **Configurator:** English, Hebrew, Arabic (already defined in type, strings need expansion)
- **IssieVoice:** English, Hebrew, Arabic (Arabic is new — currently only en/he)

## Design Decisions

### 1. Nested String Structure

The flat `Strings` interface is replaced with a nested structure organized by UI area. Both apps use the same pattern for consistency.

**Configurator `Strings` interface:**

```typescript
interface Strings {
  common: {
    cancel: string;
    save: string;
    delete: string;
    edit: string;
    create: string;
    apply: string;
    reset: string;
    error: string;
    success: string;
    loading: string;
    default: string;
    done: string;
    back: string;
    on: string;
    off: string;
    visible: string;
    hidden: string;
    none: string;
  };
  editor: {
    myKeyboards: string;
    builtIn: string;
    settings: string;
    classicView: string;
    newProfile: string;
    duplicateProfile: string;
    newProfilePlaceholder: string;
    select: string;
    saveAs: string;
    languages: {
      hebrew: string;
      english: string;
      arabic: string;
    };
    keyboardVariants: {
      standard: string;
      orderedHe: string;
      qwerty: string;
      orderedEn: string;
      orderedAr: string;
    };
  };
  alerts: {
    resetToFactory: string;
    unsavedChanges: string;
    unsavedChangesMessage: string;
    discard: string;
    saveFirst: string;
    discardChanges: string;
    discardChangesMessage: string;
    clearAllSettings: string;
    clearAll: string;
    cannotDelete: string;
    cannotDeleteDefault: string;
    cannotDeleteActive: string;
    deleteProfile: string;
    deleteConfirm: string;
    enterProfileName: string;
    failedToLoadProfile: string;
    profileChangedTo: string;
    closeAndReopenKeyboard: string;
    failedToSwitchProfile: string;
    syntaxError: string;
    checkJsonFormatting: string;
    savingConfiguration: string;
    profileSaved: string;
    failedToSaveProfile: string;
    profileUpdated: string;
    deleted: string;
    failedToDeleteProfile: string;
  };
  classic: {
    mainSettings: string;
    mainColors: string;
    actionKeys: string;
    colorDivision: string;
    specialKeys: string;
    visibleKeys: string;
    nikkud: string;
    nikkudSettings: string;
    backgroundColor: string;
    keysColor: string;
    textColor: string;
    spaceKeyColor: string;
    deleteKeyColor: string;
    enterKeyColor: string;
    otherKeysColor: string;
    highlightedCharacters: string;
    keyOrder: string;
    byRows: string;
    bySections: string;
    topRow: string;
    middleRow: string;
    bottomRow: string;
    rightThird: string;
    middleThird: string;
    leftThird: string;
    typeCharacters: string;
  };
  toolbox: {
    generalAppearance: string;
    keysGroups: string;
    nikkud: string;
    presets: string;
    new: string;
    presetsModalTitle: string;
    keysLabel: string;
  };
  globalSettings: {
    colors: string;
    background: string;
    keysBackground: string;
    keysText: string;
    font: string;
    keyGap: string;
    keyGapRegular: string;
    keyGapMedium: string;
    keyGapLarge: string;
    keyboardLayout: string;
    features: string;
    wordSuggestions: string;
    wordSuggestionsDesc: string;
    autoCorrect: string;
    autoCorrectDesc: string;
    settingsButton: string;
    settingsButtonDesc: string;
    advancedSettings: string;
    keyboardHeight: string;
    fontSize: string;
    fontWeight: string;
    heightCompact: string;
    heightNormal: string;
    heightTall: string;
    heightXTall: string;
    weightLight: string;
    weightRegular: string;
    weightMedium: string;
    weightSemibold: string;
    weightBold: string;
    weightHeavy: string;
    sizeXS: string;
    sizeS: string;
    sizeM: string;
    sizeL: string;
    sizeXL: string;
  };
  keyEditor: {
    groupName: string;
    groupNamePlaceholder: string;
    doneEditing: string;
    deselectAll: string;
    inGroups: string;
    visibility: string;
    visibilityHint: string;
    keyBgColor: string;
    textColor: string;
    customLabel: string;
    customLabelHint: string;
    customLabelPlaceholder: string;
    keyInfo: string;
    position: string;
    output: string;
    shiftOutput: string;
    type: string;
    width: string;
  };
  styleRules: {
    deleteGroup: string;
    deleteGroupConfirm: string;
    noStyles: string;
    noGroupsYet: string;
    noGroupsHint: string;
    styleGroups: string;
    editing: string;
    inactive: string;
    tips: string;
  };
  diacritics: {
    enableNikkud: string;
    basic: string;
    full: string;
    custom: string;
    diacriticsSection: string;
    modifiers: string;
    noDiacritics: string;
  };
  styleRuleModal: {
    newKeysGroup: string;
    nameLabel: string;
    namePlaceholder: string;
    presetKeysLocked: string;
    tapKeysToSelect: string;
    visibility: string;
    visibilityDefault: string;
    visibilityHide: string;
    visibilityShowOnly: string;
    showOnlyHint: string;
    hiddenHint: string;
    bgColor: string;
    textColor: string;
    keysLocked: string;
  };
  colorPicker: {
    modalTitle: string;
    selectedColor: string;
  };
  canvas: {
    preview: string;
  };
  addProfileModal: {
    title: string;
    nameLabel: string;
    placeholder: string;
    enterName: string;
    nameInUse: string;
  };
  saveAsModal: {
    title: string;
    message: string;
    nameLabel: string;
    placeholder: string;
    saveAs: string;
    enterName: string;
    nameInUse: string;
  };
  profiles: {
    saveProfile: string;
    enterProfileNamePrompt: string;
    profileNamePlaceholder: string;
    builtInProfiles: string;
    savedProfiles: string;
    longPressForOptions: string;
    current: string;
    custom: string;
    keyboardsInProfile: string;
    customConfiguration: string;
    keyboardPreview: string;
    previewHelpText: string;
    generatedConfiguration: string;
    editingHelpText: string;
    editorHelpText: string;
    aboutProfiles: string;
    helpText: string;
  };
  status: {
    initializing: string;
    loadedProfile: string;
    nativeModuleNotConnected: string;
    errorLoadingConfiguration: string;
    switchingProfile: string;
    switchedTo: string;
    errorSwitchingProfile: string;
  };
  toggleSwitch: {
    visible: string;
    hidden: string;
    a11yVisible: string;
    a11yHidden: string;
  };
}
```

**IssieVoice `Strings` interface:**

```typescript
interface Strings {
  common: {
    cancel: string;
    delete: string;
    save: string;
    yes: string;
    no: string;
    error: string;
    back: string;
  };
  app: {
    title: string;
  };
  actionBar: {
    speak: string;
    speaking: string;
    clear: string;
    save: string;
    browse: string;
    switchToHebrew: string;
    switchToEnglish: string;
  };
  textDisplay: {
    placeholder: string;
  };
  browse: {
    savedSentences: string;
    clearAll: string;
    search: string;
    noSaved: string;
    noSavedSubtext: string;
    noMatchingSearch: string;
    tryDifferentSearch: string;
    deleteText: string;
    deleteConfirm: string;
    clearAllConfirm: string;
    deleted: string;
    allDeleted: string;
  };
  favorites: {
    moveLeft: string;
    moveRight: string;
    selectFavorite: string;
    customize: string;
    caption: string;
    captionPlaceholder: string;
    captionHint: string;
    icon: string;
    iconHint: string;
    addedToFavorites: string;
    favoriteUpdated: string;
  };
  settings: {
    title: string;
    speechSpeed: string;
    slow: string;
    normal: string;
    fast: string;
    voicePitch: string;
    low: string;
    high: string;
    aboutTitle: string;
    aboutDescription: string;
    version: string;
  };
  settingsModal: {
    title: string;
    languageMode: string;
    englishOnly: string;
    englishOnlyDesc: string;
    hebrewOnly: string;
    hebrewOnlyDesc: string;
    autoDetect: string;
    autoDetectDesc: string;
    hebrewVoice: string;
    englishVoice: string;
    current: string;
    none: string;
  };
  notifications: {
    saved: string;
    savedSuccess: string;
    failedToSave: string;
    alreadyExists: string;
  };
}
```

### 2. Debug Mode

A compile-time flag at the top of each localization index file:

```typescript
// src/localization/index.ts
const DEBUG_LOCALIZATION = false; // Set to true to prefix all strings with "."
```

When enabled, all string values returned by `getStrings()` are prefixed with `"."`. Any UI text without a leading dot is a hardcoded string that bypasses localization.

Implementation:

```typescript
function prefixStrings<T>(obj: T): T {
  if (typeof obj === 'string') return ('.' + obj) as T;
  if (typeof obj === 'object' && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, prefixStrings(v)])
    ) as T;
  }
  return obj;
}

export const getStrings = (language: Language): Strings => {
  const strings = translations[language] || translations.en;
  return DEBUG_LOCALIZATION ? prefixStrings(strings) : strings;
};
```

Both apps use the same pattern.

### 3. Fix Device Language Detection

Remove the hardcoded `return 'he'` on line 21 of `src/localization/index.ts` so the existing detection logic runs properly.

### 4. Component Wiring Strategy

Every component with hardcoded strings will:

1. Import `useLocalization` from the appropriate localization module
2. Destructure `const { strings } = useLocalization();`
3. Replace hardcoded strings with `strings.group.key`

No changes to component APIs — strings come from the hook, not props.

### 5. Consistency Between Apps

Both localization systems follow the same patterns:
- Same file structure: `localization/index.ts` + `localization/strings.ts`
- Same `DEBUG_LOCALIZATION` flag
- Same `useLocalization()` hook API returning `{ language, strings, changeLanguage, isRTL }`
- Same `prefixStrings` utility
- Shared concepts use the same key names (e.g. `common.cancel` in both)

## Files to Modify

### Configurator App

**Localization files (expand):**
- `src/localization/strings.ts` — new nested `Strings` interface, expand en/he/ar translations
- `src/localization/index.ts` — fix hardcoded `return 'he'`, add debug mode, update for nested types

**Screens (wire up):**
- `src/screens/EditorScreen.tsx` (~65 strings)
- `src/screens/ClassicEditorScreen.tsx` (~30 strings)
- `src/screens/classic/ClassicSectionsList.tsx` (~30 strings)
- `src/screens/classic/ClassicDetailView.tsx` (1 string)

**Toolbox components (wire up):**
- `src/components/toolbox/GlobalSettingsPanel.tsx` (~25 strings)
- `src/components/toolbox/KeyEditorPanel.tsx` (~15 strings)
- `src/components/toolbox/AddStyleRuleModal.tsx` (~18 strings)
- `src/components/toolbox/GroupsPanel.tsx` (~12 strings)
- `src/components/toolbox/StyleRulesPanel.tsx` (~8 strings)
- `src/components/toolbox/DiacriticsPanel.tsx` (~7 strings)
- `src/components/toolbox/Toolbox.tsx` (~6 strings)

**Shared components (wire up):**
- `src/components/shared/ColorPicker.tsx` (~4 strings)
- `src/components/shared/CompactColorPicker.tsx` (1 string)
- `src/components/shared/ColorPickerRow.tsx` (1 string)
- `src/components/shared/ToggleSwitch.tsx` (~4 strings)
- `src/components/canvas/InteractiveCanvas.tsx` (1 string)

**Top-level components (wire up):**
- `components/AddProfileModal.tsx` (~5 strings)
- `components/SaveAsModal.tsx` (~7 strings)
- `components/SaveProfileModal.tsx` (update fallbacks)

### IssieVoice App

**Localization files (expand):**
- `apps/issievoice/src/localization/strings.ts` — new nested interface, add Arabic, expand strings
- `apps/issievoice/src/context/LocalizationContext.tsx` — add Arabic support, add debug mode

**Screens (wire up):**
- `apps/issievoice/src/screens/SettingsScreen.tsx` (~13 strings)
- `apps/issievoice/src/screens/BrowseScreen.tsx` (~12 strings)
- `apps/issievoice/src/screens/MainScreen.tsx` (3 fallback strings)

**Components (wire up):**
- `apps/issievoice/src/components/SettingsModal/SettingsModal.tsx` (~12 strings)

## Translation Notes

All ~230 strings need full translations in Hebrew and Arabic. Strings that already exist in the current flat `Strings` interface will be migrated to their new nested locations. The existing Hebrew and Arabic translations for the ~80 profile-management strings are preserved and moved to their new nested keys.

For interpolated strings (e.g. `` `Create a copy of "${name}"` ``), the pattern will be a function or template stored as a string with a placeholder, and a helper to fill it:

```typescript
// In strings.ts
saveAsMessage: 'Create a copy of "%s" that you can customize.';

// In component
strings.saveAsModal.message.replace('%s', originalName)
```

## Out of Scope

- Native keyboard engine strings (iOS Swift / Android Kotlin) — these are system-level and don't have user-facing text beyond key labels
- Keyboard layout labels (the actual key characters) — these are language-specific by design
- Adding a runtime language picker UI — detection is automatic from device locale
