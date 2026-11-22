# IssieVoice App - Implementation Guide

## Overview

IssieVoice is an assistive communication app built with React Native (iOS) that helps people who cannot speak to type text and have it read aloud using text-to-speech. It uses the IssieBoard keyboard engine for typing.

**Status**: ✅ **Fully Implemented and Functional**

## Technology Stack

- **React Native 0.76+**: Cross-platform framework (iOS implementation)
- **React Navigation**: Stack navigation
- **react-native-tts**: Text-to-speech engine
- **KeyboardPreferences**: Shared storage (UserDefaults)
- **TypeScript**: Type safety
- **IssieBoard Keyboard Engine**: Swift-based keyboard rendering

## Project Structure

```
apps/issievoice/
├── src/
│   ├── components/
│   │   ├── ActionBar/
│   │   │   └── ActionBar.tsx              # Speak, Clear, Save, Browse buttons
│   │   ├── TextDisplayArea/
│   │   │   └── TextDisplayArea.tsx        # Large text display with scroll
│   │   ├── SuggestionsBar/
│   │   │   └── SuggestionsBar.tsx         # Word completion suggestions
│   │   └── SettingsModal/
│   │       └── SettingsModal.tsx          # Voice & language settings
│   ├── screens/
│   │   ├── MainScreen.tsx                 # Primary typing & speaking UI
│   │   └── BrowseScreen.tsx               # Browse saved sentences
│   ├── context/
│   │   ├── TextContext.tsx                # Current text state
│   │   ├── TTSContext.tsx                 # TTS state & settings
│   │   ├── LocalizationContext.tsx        # UI language (en/he)
│   │   └── NotificationContext.tsx        # Toast notifications
│   ├── services/
│   │   ├── TextToSpeech.ts                # TTS wrapper
│   │   └── SavedSentencesManager.ts       # Saved sentences CRUD
│   ├── constants/
│   │   ├── colors.ts                      # Color palette
│   │   ├── sizes.ts                       # Accessibility touch targets
│   │   └── index.ts
│   ├── localization/
│   │   └── strings.ts                     # UI strings (en/he)
│   └── navigation/
│       └── AppNavigator.tsx               # Stack navigator
├── App.tsx                                 # App entry point
├── index.js
└── package.json
```

## Implemented Features

### 1. Main Screen UI ✅

**Components:**
- **Title Bar**: App title with settings button (⚙️)
- **Text Display Area**: Scrollable text input (adjustable height)
- **Suggestions Bar**: Word completion suggestions with test buttons
- **Action Bar**: 4 large buttons (120px height)
  - 🗣️ **Speak** (Green, 2x width): Text-to-speech
  - 🗑️ **Clear** (Red): Clear all text
  - 💾 **Save** (Amber): Save current sentence
  - 📚 **Browse** (Purple): Open saved sentences
- **Keyboard Preview**: Embedded IssieBoard keyboard with language switch

**Layout:**
- RTL/LTR support (reverses button order for English)
- High contrast colors
- Large touch targets (minimum 60px)

### 2. Text-to-Speech System ✅

**Features:**
- Multi-language support (English/Hebrew)
- **Language Mode** settings:
  - **English Only**: Always use English TTS
  - **Hebrew Only**: Always use Hebrew TTS
  - **Auto-Detect**: Detect based on text content
    - If device language is English AND text has no Hebrew characters → English
    - Otherwise → Hebrew
- **Per-language voice selection**:
  - Separate voice picker for English voices
  - Separate voice picker for Hebrew voices
  - Test button (🔊) for each voice ("Hello" / "שלום")
- **Settings persistence** via KeyboardPreferences

**Implementation:**
- `TTSContext.tsx`: Manages TTS state, voice selection, language detection
- `TextToSpeech.ts`: Wrapper around react-native-tts
- Auto-detects Hebrew characters: `/[\u0590-\u05FF]/`

### 3. Settings Modal ✅

**Sections:**
1. **Language Mode**: 3 radio options (always expanded)
2. **Hebrew Voice**: Collapsible accordion with voice list
3. **English Voice**: Collapsible accordion with voice list

**Features:**
- Modal supports all orientations
- Accordion headers show current selection
- Test button for each voice
- Filtered to English/Hebrew voices only
- Settings saved to KeyboardPreferences:
  - `issievoice_languageMode`
  - `issievoice_englishVoice`
  - `issievoice_hebrewVoice`

### 4. Keyboard Integration ✅

**KeyboardPreview Component:**
- Embedded keyboard using `KeyboardEngine.swift`
- Full word completion/prediction support
- Suggestions synced with SuggestionsBar
- Custom language switch key (blue button after "123")

**Language Switch Key:**
- Type: `"language"`
- Label: "עב" (English keyboard) or "En" (Hebrew keyboard)
- Color: Blue (`#2196F3`)
- Position: After first key (123 button) on bottom row
- Emits event to toggle language without inserting text

**Key Event Handling:**
- `text_changed` events update React state
- `language` events trigger `toggleLanguage()`
- Preview mode shows all keys and emits custom events

### 5. Saved Sentences ✅

**Storage:**
- Uses `KeyboardPreferences` (not AsyncStorage)
- Storage key: `issievoice_saved_sentences`
- JSON array format with id, text, createdAt, category

**BrowseScreen Features:**
- Search functionality
- Delete individual sentences
- Clear all button
- One-tap to load sentence into main screen
- Swipe-to-delete on iOS

**Manager API:**
```typescript
SavedSentencesManager.getSavedSentences()
SavedSentencesManager.saveSentence(text, category?)
SavedSentencesManager.deleteSentence(id)
SavedSentencesManager.updateSentence(id, updates)
SavedSentencesManager.searchSentences(query)
SavedSentencesManager.clearAll()
```

### 6. Word Suggestions ✅

**SuggestionsBar Component:**
- Displays keyboard-generated suggestions
- Height: 70px, Button height: 60px, Min width: 100px
- RTL support (reverses suggestion order for Hebrew)
- Handles both completion and prediction modes:
  - **Completion**: Replaces partial word
  - **Prediction**: Appends predicted word + space

**Integration:**
- Receives suggestions from KeyboardEngine via `onSuggestionsChange`
- Tapping suggestion updates text and notifies keyboard
- Maintains consistent 70px height even when empty

### 7. Accessibility ✅

**Touch Target Sizes:**
```typescript
touchTarget: {
  small: 60,
  medium: 80,
  large: 100,
  xlarge: 120,
}
```

**Font Sizes:**
```typescript
fontSize: {
  small: 18,
  medium: 24,
  large: 28,
  xlarge: 36,
  xxlarge: 52,
}
```

**Action Buttons:**
- Height: 120px (1.5x standard)
- Speak button: 2x width with enhanced shadow
- High contrast colors for each function

## Architecture Details

### Keyboard Configuration

Language switch key injection (MainScreen.tsx):

```typescript
const languageKey = {
  type: 'language',
  label: language === 'en' ? 'עב' : 'En',
  caption: language === 'en' ? 'עב' : 'En',
  value: '',
  width: 1,
  bgColor: '#2196F3',
};

// Insert after first key (123 button)
const modifiedBottomRow = {
  ...bottomRow,
  keys: bottomRow.keys
    .filter((key: any) => key.type !== 'next-keyboard')
    .reduce((acc: any[], key: any, index: number) => {
      acc.push(key);
      if (index === 0) acc.push(languageKey);
      return acc;
    }, []),
};
```

### TTS Language Detection

```typescript
// Auto-detect mode logic
const hasHebrewCharacters = (text: string): boolean => {
  return /[\u0590-\u05FF]/.test(text);
};

const isDeviceEnglish = deviceLang.startsWith('en');
const textHasHebrew = hasHebrewCharacters(text);

// If device is English AND no Hebrew chars → English
// Otherwise → Hebrew
const languageToUse = (isDeviceEnglish && !textHasHebrew)
  ? 'en-US'
  : 'he-IL';
```

### Preview Mode Behavior

In preview mode (`isPreviewMode = true`):
- All keys from config are shown (no filtering by system keyboard count)
- Custom key types emit events to React Native
- Language key shows regardless of iOS keyboard settings
- Generic system for adding more custom keys in future

## Splash Screens

- **IssieBoard**: Uses `LaunchScreen.storyboard` (shows "IssieBoard")
- **IssieVoice**: Uses `IssieVoiceSplash.storyboard` (shows "IssieVoice")
- Separate launch screens per app target

## Color Palette

```typescript
colors = {
  primary: '#3F51B5',      // Indigo
  background: '#F5F5F5',   // Light gray
  surface: '#FFFFFF',      // White
  surfaceDark: '#E8E8E8',  // Gray
  text: '#212121',         // Dark gray
  textLight: '#757575',    // Medium gray
  border: '#BDBDBD',       // Light border
  borderLight: '#E0E0E0',  // Very light border

  // Action colors
  speak: '#4CAF50',        // Green
  clear: '#F44336',        // Red
  save: '#FFC107',         // Amber
  browse: '#9C27B0',       // Purple
}
```

## Storage Keys

All settings use KeyboardPreferences:
- `issievoice_saved_sentences`: Saved sentences JSON array
- `issievoice_languageMode`: TTS language mode (en-only/he-only/detect)
- `issievoice_englishVoice`: Selected English voice ID
- `issievoice_hebrewVoice`: Selected Hebrew voice ID

## iOS-Specific Notes

### Native Bridge
- **KeyboardPreview**: UIView wrapper around KeyboardEngine
- **KeyboardPreferences**: UserDefaults bridge
- **TextToSpeech**: react-native-tts bridge

### Xcode Setup
- App target: IssieVoice
- Launch screen: IssieVoiceSplash.storyboard
- App Group: Shared with keyboard extensions for preferences
- Info.plist keys for TTS permissions

## Development Workflow

### Running the App
```bash
cd apps/issievoice
npm install
npm run ios
```

### Building Keyboards
```bash
# From project root
npm run build:keyboards
```

### Testing TTS
1. Open Settings modal (⚙️ icon)
2. Select language mode
3. Test voices with 🔊 button
4. Select preferred voice for each language
5. Return to main screen and type text
6. Press Speak button

## Design Decisions

### Why Not AsyncStorage?
- KeyboardPreferences uses UserDefaults (iOS native)
- Shared with keyboard extensions via App Groups
- Consistent with SavedSentencesManager pattern
- Better performance than AsyncStorage

### Why Embedded Keyboard vs Custom?
- Reuses proven IssieBoard keyboard engine
- Gets word prediction/completion for free
- Consistent keyboard behavior across apps
- Less code to maintain

### Why Language Key Instead of Settings Button?
- Faster switching (no modal)
- Visible language indicator
- Familiar pattern (like iOS globe key)
- Works in preview mode

### Why Per-Language Voice Selection?
- Users may want different voices for each language
- Hebrew voices work better with Hebrew text
- English voices work better with English text
- More flexible than single voice setting

## Performance Considerations

- Text updates batched via React state
- Suggestions computed asynchronously by KeyboardEngine
- Settings loaded once on mount
- Voice list filtered to en/he only
- Accordions collapse long lists

## Future Enhancements

### Possible Additions
- Categories for saved sentences
- Quick phrase shortcuts
- TTS rate/pitch controls visible in UI
- Multiple language support beyond en/he
- Export/import saved sentences
- Voice profiles (different voices per category)
- Android support

### Not Planned
- Complex sentence editing (focus is on simple communication)
- Rich text formatting (accessibility focus)
- Cloud sync (privacy concerns)
- In-app purchases (free and open)

## Related Documentation

- **ISSIEVOICE_XCODE_SETUP.md**: Xcode project setup
- **CLAUDE.md**: Full project architecture
- **WORD_PREDICTION_GUIDE.md**: Keyboard prediction system
- **KeyboardRenderer.swift**: Keyboard rendering logic
- **KeyboardEngine.swift**: Keyboard event handling

---

**Created**: February 11, 2026
**Last Updated**: February 12, 2026
**Status**: ✅ Production Ready
**iOS Version**: iOS 14+
**Languages**: Hebrew, English (Arabic keyboard available but TTS not configured)
