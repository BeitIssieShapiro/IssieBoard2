# IssieVoice Multi-Language Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Arabic keyboard support to IssieVoice with a Language settings tab for selecting 1-3 languages (he/en/ar) and cycling between them via the language key.

**Architecture:** Extend MainScreen's binary en/he toggle to a cycle through user-selected languages (fixed order: he→en→ar). Add a new LanguageSettingsPanel component rendered from a new "language" tab in the settings sidebar. Extend TTS auto-detection to support Arabic.

**Tech Stack:** React Native, TypeScript, KeyboardPreferences (AsyncStorage bridge)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/issievoice/src/localization/strings.ts` | Modify | Add `language` tab label + language name strings |
| `apps/issievoice/src/components/Settings/SettingsSidebar.tsx` | Modify | Add Language tab definition + rendering |
| `apps/issievoice/src/components/Settings/LanguageSettingsPanel.tsx` | Create | Language toggle UI (3 checkboxes) |
| `apps/issievoice/src/screens/NewSettingsScreen.tsx` | Modify | Route `language` tab to LanguageSettingsPanel, load/save selected languages |
| `apps/issievoice/src/screens/MainScreen.tsx` | Modify | Multi-language cycling, Arabic keyboard loading, persistence |
| `apps/issievoice/src/context/TTSContext.tsx` | Modify | Arabic voice param in `speak()`, Arabic char detection |

---

### Task 1: Add localization strings for Language tab

**Files:**
- Modify: `apps/issievoice/src/localization/strings.ts`

- [ ] **Step 1: Add `language` tab string to the `Strings` interface**

In the `settings.tabs` type (line 72-80), add a `language` field:

```ts
    tabs: {
      keyboard: string;
      general: string;
      keysGroups: string;
      nikkud: string;
      features: string;
      advanced: string;
      voice: string;
      language: string;
    };
```

Also add a new `languageSettings` section to the `Strings` interface, after the `settingsModal` block (after line 96):

```ts
  languageSettings: {
    hebrew: string;
    english: string;
    arabic: string;
    atLeastOne: string;
  };
```

- [ ] **Step 2: Add English strings**

In the `en` object, add to `settings.tabs` (around line 183):
```ts
      voice: 'Voice',
      language: 'Language',
```

Add after `notifications` block (around line 205):
```ts
  languageSettings: {
    hebrew: 'Hebrew',
    english: 'English',
    arabic: 'Arabic',
    atLeastOne: 'At least one language must be selected',
  },
```

- [ ] **Step 3: Add Hebrew strings**

In the `he` object, add to `settings.tabs` (around line 286):
```ts
      voice: 'קול',
      language: 'שפה',
```

Add after `notifications` block:
```ts
  languageSettings: {
    hebrew: 'עברית',
    english: 'אנגלית',
    arabic: 'ערבית',
    atLeastOne: 'יש לבחור לפחות שפה אחת',
  },
```

- [ ] **Step 4: Add Arabic strings**

In the `ar` object, add to `settings.tabs` (around line 389):
```ts
      voice: 'صوت',
      language: 'لغة',
```

Add after `notifications` block:
```ts
  languageSettings: {
    hebrew: 'العبرية',
    english: 'الإنجليزية',
    arabic: 'العربية',
    atLeastOne: 'يجب اختيار لغة واحدة على الأقل',
  },
```

---

### Task 2: Create LanguageSettingsPanel component

**Files:**
- Create: `apps/issievoice/src/components/Settings/LanguageSettingsPanel.tsx`

- [ ] **Step 1: Create the component**

```tsx
import React from 'react';
import {View, Text, StyleSheet, Switch, Platform} from 'react-native';
import {colors} from '../../constants';
import {useLocalization} from '../../context/LocalizationContext';

export type KbLanguage = 'he' | 'en' | 'ar';

/** Fixed cycle order for language switching */
export const LANGUAGE_CYCLE_ORDER: KbLanguage[] = ['he', 'en', 'ar'];

interface LanguageSettingsPanelProps {
  selectedLanguages: KbLanguage[];
  onSelectedLanguagesChange: (languages: KbLanguage[]) => void;
}

interface LanguageRowProps {
  label: string;
  enabled: boolean;
  isOnly: boolean;
  onToggle: (value: boolean) => void;
  isRTL: boolean;
}

const LanguageRow: React.FC<LanguageRowProps> = ({label, enabled, isOnly, onToggle, isRTL}) => (
  <View style={[styles.row, isRTL && {flexDirection: 'row-reverse'}]}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Switch
      value={enabled}
      onValueChange={onToggle}
      disabled={enabled && isOnly}
      trackColor={{false: '#D1D5DB', true: colors.primary + '80'}}
      thumbColor={enabled ? colors.primary : '#F3F4F6'}
      ios_backgroundColor="#D1D5DB"
    />
  </View>
);

const LanguageSettingsPanel: React.FC<LanguageSettingsPanelProps> = ({
  selectedLanguages,
  onSelectedLanguagesChange,
}) => {
  const {strings, isRTL} = useLocalization();
  const ls = strings.languageSettings;

  const isOnly = selectedLanguages.length === 1;

  const toggle = (lang: KbLanguage, value: boolean) => {
    if (value) {
      // Add language, maintain cycle order
      const newLangs = LANGUAGE_CYCLE_ORDER.filter(
        l => selectedLanguages.includes(l) || l === lang,
      );
      onSelectedLanguagesChange(newLangs);
    } else {
      if (isOnly) return;
      onSelectedLanguagesChange(selectedLanguages.filter(l => l !== lang));
    }
  };

  const languages: {key: KbLanguage; label: string}[] = [
    {key: 'he', label: ls.hebrew},
    {key: 'en', label: ls.english},
    {key: 'ar', label: ls.arabic},
  ];

  return (
    <View style={styles.container}>
      {languages.map(({key, label}) => (
        <LanguageRow
          key={key}
          label={label}
          enabled={selectedLanguages.includes(key)}
          isOnly={selectedLanguages.includes(key) && isOnly}
          onToggle={(value) => toggle(key, value)}
          isRTL={isRTL}
        />
      ))}
      {isOnly && (
        <Text style={[styles.hint, isRTL && {textAlign: 'right'}]}>
          {ls.atLeastOne}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  rowLabel: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1F2937',
  },
  hint: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 12,
    paddingHorizontal: 8,
  },
});

export default LanguageSettingsPanel;
```

---

### Task 3: Add Language tab to SettingsSidebar

**Files:**
- Modify: `apps/issievoice/src/components/Settings/SettingsSidebar.tsx`

- [ ] **Step 1: Add Language tab definition**

After the `getVoiceTab` function (line 41), add:

```ts
const getLanguageTab = (label: string): TabDef => ({
  id: 'language' as TabId,
  label,
  iconName: 'globe-outline',
  iconType: 'Ionicons',
  iconColor: '#2563EB',
});
```

Update the `TabId` type (line 16) to include `'language'`:

```ts
type TabId = 'general' | 'keys-groups' | 'nikkud' | 'features' | 'advanced' | 'voice' | 'language';
```

- [ ] **Step 2: Add Language tab to landscape sidebar**

In the `SettingsSidebar` component body (around line 125-126), create the language tab:

```ts
  const LANGUAGE_TAB = getLanguageTab(tabLabels.language);
```

In the landscape `return` block (lines 128-181), add the Language tab after the Voice tab, inside the `{!keyboardOnly && (...)}` block. After the Voice TabItem (around line 177), add:

```tsx
            <View style={styles.divider} />
            <TabItem
              tab={LANGUAGE_TAB}
              isActive={activeTab === LANGUAGE_TAB.id}
              onPress={() => onTabChange(LANGUAGE_TAB.id)}
              compact={isPhone}
              extraCompact={isPhoneVoice}
              isRTL={isRTL}
            />
```

- [ ] **Step 3: Add Language tab to portrait voice mode**

In the portrait voice mode Level 1 tabs (lines 240-298), add a third tab after Voice. After the Voice `TouchableOpacity` (ending around line 298), add:

```tsx
        <TouchableOpacity
          style={[styles.tab, activeTab === 'language' && styles.tabActive, isRTL && { flexDirection: 'row-reverse' }]}
          onPress={() => onTabChange('language')}
          activeOpacity={0.7}>
          <View
            style={[
              styles.iconCircleSmall,
              {backgroundColor: activeTab === 'language' ? 'rgba(255,255,255,0.25)' : LANGUAGE_TAB.iconColor + '18'},
            ]}>
            <MyIcon
              info={{
                name: LANGUAGE_TAB.iconName!,
                type: LANGUAGE_TAB.iconType!,
                color: activeTab === 'language' ? '#FFFFFF' : LANGUAGE_TAB.iconColor,
                size: 16,
              }}
            />
          </View>
          <Text
            style={[
              styles.tabText,
              activeTab === 'language' && styles.tabTextActive,
            ]}>
            {tabLabels.language}
          </Text>
        </TouchableOpacity>
```

---

### Task 4: Wire Language tab into NewSettingsScreen

**Files:**
- Modify: `apps/issievoice/src/screens/NewSettingsScreen.tsx`

- [ ] **Step 1: Add imports and state for selected languages**

Add import at the top:
```ts
import LanguageSettingsPanel, { KbLanguage } from '../components/Settings/LanguageSettingsPanel';
```

Add state after the voice state declarations (after line 104):
```ts
  const [selectedLanguages, setSelectedLanguages] = useState<KbLanguage[]>(['he', 'en']);
```

- [ ] **Step 2: Load/save selected languages from preferences**

In the `useEffect` that loads voice settings (lines 107-118), add after loading Arabic voice:

```ts
      const savedLangs = await KeyboardPreferences.getString('issievoice_selectedLanguages');
      if (savedLangs) {
        try {
          const parsed = JSON.parse(savedLangs) as KbLanguage[];
          if (parsed.length > 0) setSelectedLanguages(parsed);
        } catch {}
      }
```

Add a handler after `handleVoiceChange` (after line 131):

```ts
  const handleSelectedLanguagesChange = async (languages: KbLanguage[]) => {
    setSelectedLanguages(languages);
    await KeyboardPreferences.setString('issievoice_selectedLanguages', JSON.stringify(languages));
  };
```

- [ ] **Step 3: Render LanguageSettingsPanel in renderContent**

In `renderContent()` (lines 163-207), add a case for the `language` tab before the keyboard tab rendering. After the voice tab check (after line 175):

```ts
    if (!isKeyboardOnly && activeTab === 'language') {
      return (
        <View style={styles.voicePanel}>
          <LanguageSettingsPanel
            selectedLanguages={selectedLanguages}
            onSelectedLanguagesChange={handleSelectedLanguagesChange}
          />
        </View>
      );
    }
```

(Reusing `styles.voicePanel` for the same card styling.)

---

### Task 5: Update MainScreen — multi-language cycling and Arabic keyboard loading

**Files:**
- Modify: `apps/issievoice/src/screens/MainScreen.tsx`

This is the largest task. It changes the binary en/he toggle to a multi-language cycle with persistence.

- [ ] **Step 1: Add imports and update type**

Import `LANGUAGE_CYCLE_ORDER` and `KbLanguage` at the top:
```ts
import { LANGUAGE_CYCLE_ORDER, KbLanguage } from '../components/Settings/LanguageSettingsPanel';
```

- [ ] **Step 2: Add state for selectedLanguages and update currentLanguage type**

Change line 43 from:
```ts
const [currentLanguage, setCurrentLanguage] = useState<'en' | 'he'>(deviceLanguage === 'ar' ? 'he' : deviceLanguage);
```
to:
```ts
const [selectedLanguages, setSelectedLanguages] = useState<KbLanguage[]>(['he', 'en']);
const [currentLanguage, setCurrentLanguage] = useState<KbLanguage>('he');
const [languagesLoaded, setLanguagesLoaded] = useState(false);
```

Also add Arabic voice state after `hebrewVoice` (line 45):
```ts
const [arabicVoice, setArabicVoice] = useState<string | undefined>(undefined);
```

- [ ] **Step 3: Load selected languages and last language on mount**

Add a new `useEffect` after the symbol cache cleanup effect (after line 62):

```ts
  // Load selected languages and last language from preferences
  useEffect(() => {
    const loadLanguagePrefs = async () => {
      let langs: KbLanguage[] = ['he', 'en'];
      try {
        const savedLangs = await KeyboardPreferences.getString('issievoice_selectedLanguages');
        if (savedLangs) {
          const parsed = JSON.parse(savedLangs) as KbLanguage[];
          if (parsed.length > 0) langs = parsed;
        }
      } catch {}

      setSelectedLanguages(langs);

      // Determine initial language
      let initial: KbLanguage = langs[0];
      try {
        const lastLang = await KeyboardPreferences.getString('issievoice_lastLanguage');
        if (lastLang && langs.includes(lastLang as KbLanguage)) {
          initial = lastLang as KbLanguage;
        } else if (langs.includes(deviceLanguage as KbLanguage)) {
          initial = deviceLanguage as KbLanguage;
        }
      } catch {}

      setCurrentLanguage(initial);
      setLanguagesLoaded(true);
    };
    loadLanguagePrefs();
  }, []);
```

- [ ] **Step 4: Reload selected languages when screen comes into focus**

In the existing `useFocusEffect` (lines 342-349), add loading of selectedLanguages:

```ts
  useFocusEffect(
    React.useCallback(() => {
      console.log('MainScreen focused - reloading keyboard config and favorites');
      const reloadPrefs = async () => {
        try {
          const savedLangs = await KeyboardPreferences.getString('issievoice_selectedLanguages');
          if (savedLangs) {
            const parsed = JSON.parse(savedLangs) as KbLanguage[];
            if (parsed.length > 0) setSelectedLanguages(parsed);
          }
        } catch {}
      };
      reloadPrefs();
      loadKeyboardConfig(currentLanguage);
      setFavoritesReloadTrigger(prev => prev + 1);
    }, [currentLanguage])
  );
```

- [ ] **Step 5: Persist last language when it changes**

Add a new `useEffect` that saves `currentLanguage` to preferences. Place after the TTS language effect (after line 339):

```ts
  // Persist last language
  useEffect(() => {
    if (languagesLoaded) {
      KeyboardPreferences.setString('issievoice_lastLanguage', currentLanguage);
    }
  }, [currentLanguage, languagesLoaded]);
```

- [ ] **Step 6: Replace toggleLanguage with cycleLanguage**

Replace the `toggleLanguage` function (lines 556-563) with:

```ts
  const cycleLanguage = () => {
    // Get next language in cycle order from selected languages
    const activeLangs = LANGUAGE_CYCLE_ORDER.filter(l => selectedLanguages.includes(l));
    if (activeLangs.length <= 1) return;
    const currentIndex = activeLangs.indexOf(currentLanguage);
    const nextIndex = (currentIndex + 1) % activeLangs.length;
    const newLanguage = activeLangs[nextIndex];
    console.log(`Switching language from ${currentLanguage} to ${newLanguage}`);
    setCurrentLanguage(newLanguage);
    setKbSuggestions([]);
  };
```

Update the call site in `onKeyPress` (line 428) from `toggleLanguage()` to `cycleLanguage()`.

- [ ] **Step 7: Update language key label computation**

Create a helper function that computes the next-language label. Add above `loadKeyboardConfig`:

```ts
  // Compute the label for the language key (shows the NEXT language in cycle)
  const getLanguageKeyLabel = (language: string): string => {
    const activeLangs = LANGUAGE_CYCLE_ORDER.filter(l => selectedLanguages.includes(l));
    if (activeLangs.length <= 1) return '';
    const currentIndex = activeLangs.indexOf(language as KbLanguage);
    const nextIndex = (currentIndex + 1) % activeLangs.length;
    const nextLang = activeLangs[nextIndex];
    switch (nextLang) {
      case 'he': return 'עב';
      case 'en': return 'En';
      case 'ar': return 'عر';
    }
  };
```

- [ ] **Step 8: Update loadKeyboardConfig — language key and Arabic loading**

In `loadKeyboardConfig`, replace both language key creation blocks.

For the **saved config** path (lines 132-139), change to:
```ts
            const langLabel = getLanguageKeyLabel(language);
            const showLanguageKey = langLabel !== '';
            const languageKey = showLanguageKey ? {
              type: 'language',
              label: langLabel,
              caption: langLabel,
              value: '',
              width: 1,
              bgColor: colors.primary,
            } : null;
```

Update the keyset mapping (lines 144-170) to conditionally inject the language key:
```ts
            savedConfig.keysets = savedConfig.keysets.map((keyset: any) => ({
              ...keyset,
              rows: keyset.rows.map((row: any) => {
                const filteredKeys = row.keys.filter((key: any) =>
                  key.type !== 'next-keyboard' && key.type !== 'close' && key.type !== 'settings'
                );

                const hasSpaceKey = row.keys.some((k: any) => k.type === 'space' || k.value === ' ');
                const isBottomRow = row.alwaysInclude || hasSpaceKey;

                if (isBottomRow && showLanguageKey) {
                  const hasLanguageKey = row.keys.some((k: any) => k.type === 'language');
                  if (!hasLanguageKey) {
                    const newKeys = filteredKeys.reduce((acc: any[], key: any, index: number) => {
                      acc.push(key);
                      if (index === 0) {
                        acc.push(languageKey);
                      }
                      return acc;
                    }, []);
                    return { ...row, keys: newKeys };
                  }
                  // Update existing language key label
                  return { ...row, keys: filteredKeys.map((k: any) =>
                    k.type === 'language' ? { ...k, label: langLabel, caption: langLabel } : k
                  )};
                }
                return { ...row, keys: filteredKeys };
              }),
            }));
```

For the **default/fallback** path (lines 215-217), update the source keyboard loading:
```ts
      let sourceKeyboard;
      if (language === 'en') {
        sourceKeyboard = require('../../../../keyboards/en.json');
      } else if (language === 'ar') {
        sourceKeyboard = require('../../../../keyboards/ar.json');
      } else {
        sourceKeyboard = require('../../../../keyboards/he.json');
      }
```

And update the default path language key creation (lines 223-230) the same way:
```ts
      const langLabel = getLanguageKeyLabel(language);
      const showLanguageKey = langLabel !== '';
      const languageKey = showLanguageKey ? {
        type: 'language',
        label: langLabel,
        caption: langLabel,
        value: '',
        width: 1,
        bgColor: colors.primary,
      } : null;
```

And update the keyset mapping (lines 233-258) similarly — conditionally inject based on `showLanguageKey`, and update existing language key labels.

- [ ] **Step 9: Load Arabic voice on focus**

In the `useFocusEffect` that loads voice settings (lines 288-313), add Arabic voice loading after Hebrew voice loading:

```ts
          const savedArVoice = await KeyboardPreferences.getProfile('issievoice_arabicVoice');
          if (savedArVoice) {
            setArabicVoice(savedArVoice);
          }
```

- [ ] **Step 10: Update speak calls to pass arabicVoice**

Update `handleSpeak` (line 471):
```ts
      await speak(currentText, 'detect', englishVoice, hebrewVoice, arabicVoice);
```

Update `handleFavoritePress` (line 552):
```ts
    await speak(text, 'detect', englishVoice, hebrewVoice, arabicVoice);
```

- [ ] **Step 11: Guard config loading until languages are loaded**

In the useEffect for loading keyboard config (lines 316-325), add a guard:

```ts
  useEffect(() => {
    if (!languagesLoaded) return;
    const loadConfig = async () => {
      keyboardHeightRef.current = 350;
      setKeyboardHeight(350);
      await loadKeyboardConfig(currentLanguage);
    };
    loadConfig();
  }, [currentLanguage, speakButtonInKeyboard, languagesLoaded, selectedLanguages]);
```

Note: `selectedLanguages` is added as a dependency so that when the user returns from settings with a language selection change, the keyboard reloads with the correct language key label.

---

### Task 6: Update TTSContext — Arabic voice support in speak()

**Files:**
- Modify: `apps/issievoice/src/context/TTSContext.tsx`

- [ ] **Step 1: Add Arabic character detection helper**

After `hasHebrewCharacters` (line 28), add:

```ts
const hasArabicCharacters = (text: string): boolean => /[\u0600-\u06FF]/.test(text);
```

- [ ] **Step 2: Update speak() signature and auto-detection logic**

Change the `speak` function signature (line 80) to accept `arabicVoice`:

```ts
  const speak = async (text: string, languageMode: 'en-only' | 'he-only' | 'detect' = 'detect', englishVoice?: string, hebrewVoice?: string, arabicVoice?: string) => {
```

Update the auto-detect block (lines 96-108) to include Arabic:

```ts
      } else {
        // Auto-detect language based on text content
        const textHasHebrew = hasHebrewCharacters(text);
        const textHasArabic = hasArabicCharacters(text);

        if (textHasHebrew) {
          languageToUse = 'he-IL';
          voiceToUse = hebrewVoice;
        } else if (textHasArabic) {
          languageToUse = 'ar-SA';
          voiceToUse = arabicVoice;
        } else {
          languageToUse = 'en-US';
          voiceToUse = englishVoice;
        }

        console.log(`Auto-detecting TTS language: hasHebrew=${textHasHebrew}, hasArabic=${textHasArabic}, using=${languageToUse}`);
      }
```

---

### Task 7: Verify and test

- [ ] **Step 1: Run linter**

Run: `npm run lint`
Expected: No new errors

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: All existing tests pass

- [ ] **Step 3: Manual testing checklist**

Test the following scenarios in IssieVoice:
1. Default state: Hebrew + English selected, language key toggles between them
2. Enable Arabic in Language settings — language key cycles he→en→ar
3. Disable English — language key toggles he→ar
4. Disable Arabic — back to he→en toggle
5. Try to disable the last language — should be prevented
6. Language key label shows the NEXT language (En on Hebrew KB, عر on English KB, עב on Arabic KB)
7. Kill and reopen app — last language and selected languages are restored
8. Arabic keyboard loads and renders correctly
9. TTS speaks Arabic text with Arabic voice
10. Settings Language tab renders correctly in portrait and landscape
