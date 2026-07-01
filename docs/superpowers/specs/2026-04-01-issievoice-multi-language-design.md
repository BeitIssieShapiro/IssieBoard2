# IssieVoice Multi-Language Support

## Overview

Add Arabic keyboard support to IssieVoice, with a new Language settings tab allowing users to select 1-3 languages (Hebrew, English, Arabic). The keyboard language key cycles through selected languages in a fixed order.

## Language Settings Tab

New top-level tab in `NewSettingsScreen` alongside Keyboard and Voice.

**Tab label:** "Language" / "שפה" / "لغة"

**Content:** Three toggleable language rows:
- עברית (Hebrew)
- English
- العربية (Arabic)

**Constraints:**
- At least 1 language must remain selected
- Deselecting the last language is prevented (toggle disabled when only 1 remains)
- Default selection: Hebrew + English

## Persistence

Two new IssieVoice-scoped `KeyboardPreferences` keys:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `issievoice_selectedLanguages` | JSON string array | `["he", "en"]` | Enabled languages |
| `issievoice_lastLanguage` | string | device language if selected, else first selected | Last active keyboard language |

## Language Cycling

Fixed cycle order: **he -> en -> ar -> he...**

Only enabled languages participate in the cycle. Examples:
- All 3: he -> en -> ar -> he...
- he + en: he -> en -> he...
- he + ar: he -> ar -> he...
- en + ar: en -> ar -> en...
- Single language: language key is hidden

## Language Key

### Labels

The key shows the **next** language in the cycle:

| Current KB | Next (all 3) | Label |
|-----------|-------------|-------|
| Hebrew | English | En |
| English | Arabic | عر |
| Arabic | Hebrew | עב |

Labels adapt based on which languages are enabled (e.g., if only he+ar, Hebrew KB shows "عر").

### Injection

The language key is injected into the bottom row of every keyset in `MainScreen.loadKeyboardConfig()`, same position as today (after the first key in the bottom row). Extended from 2-language to N-language support.

When only 1 language is selected, the language key is not injected.

### Styling in Editor

The language key is a real key in the keyboard config, so it appears in the keys-groups key picker. It shows the WYSIWYG next-language label for the currently edited keyboard language. Since styling is per-language, each language's keyboard can show the appropriate label.

## Keyboard Loading

### MainScreen Changes

- `currentLanguage` type: `'en' | 'he' | 'ar'` (was `'en' | 'he'`)
- `loadKeyboardConfig()` extended with `ar` path loading `keyboards/ar.json`
- `toggleLanguage()` replaced with cycle logic using selected languages and fixed order
- Device language mapping for Arabic: no longer maps `'ar'` to `'he'`

### Startup Behavior

1. Load `issievoice_selectedLanguages` from preferences (default: `["he", "en"]`)
2. Load `issievoice_lastLanguage` from preferences
3. If last language is in selected set, use it
4. Else if device language is in selected set, use device language
5. Else use first language in selected set (per fixed order)

## TTS Integration

### Auto-Detection

`TTSContext.speak()` extended with Arabic support:
- Detect Arabic characters (Unicode range `\u0600-\u06FF`)
- Priority: Hebrew chars -> Hebrew voice, Arabic chars -> Arabic voice, else -> English voice
- `speak()` signature extended to accept `arabicVoice` parameter

### Voice Mapping

The existing `setLanguage()` already maps `'ar'` to `'ar-SA'`. No change needed there.

## Localization Strings

New strings needed in `apps/issievoice/src/localization/strings.ts`:

| Key | EN | HE | AR |
|-----|-----|-----|-----|
| `languageTab` | Language | שפה | لغة |
| `hebrew` | Hebrew | עברית | العبرية |
| `english` | English | אנגלית | الإنجليزية |
| `arabic` | Arabic | ערבית | العربية |

## Files to Modify

### React Native (IssieVoice)
- `apps/issievoice/src/screens/MainScreen.tsx` — language cycling, Arabic keyboard loading, startup logic
- `apps/issievoice/src/screens/NewSettingsScreen.tsx` — add Language tab
- `apps/issievoice/src/components/Settings/SettingsSidebar.tsx` — add Language tab entry
- `apps/issievoice/src/components/Settings/LanguageSettingsPanel.tsx` — new component
- `apps/issievoice/src/context/TTSContext.tsx` — Arabic auto-detection, Arabic voice parameter
- `apps/issievoice/src/localization/strings.ts` — new strings

### No iOS/Android Native Changes
The language key is already handled by the native keyboard renderer (type: "language"). The cycling logic lives entirely in React Native (MainScreen). No native code changes needed.
