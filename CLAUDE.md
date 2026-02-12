# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IssieBoard is a configurable extension keyboard application for iOS and Android that helps users with developmental or motor skill disabilities to acquire typing skills. The project uses a **Hybrid Architecture** that decouples the React Native configurator from the native keyboard engines.

### Key Architecture

- **Configurator**: React Native app for keyboard configuration and theme management
- **Data Bridge**: Platform-specific shared storage (SharedPreferences on Android, UserDefaults on iOS)
- **Native Engines**: Pure native code keyboards (Kotlin for Android, Swift for iOS)
- **Dynamic Rendering**: Runtime keyboard UI generation from JSON configuration
- **Live Synchronization**: Hot-reload configuration changes without restart

## Build & Run Commands

### Installation

```bash
npm install
cd ios && pod install && cd ..
```

### Development

```bash
# Start React Native metro bundler
npm start

# Run on Android (requires Android Studio/emulator)
npm run android

# Run on iOS (requires Xcode/simulator)
npm run ios

# Open Android emulator
npm run open:android-sim
```

### Build Scripts

```bash
# Build keyboard configuration files from keyboards/*.json
npm run build:keyboards

# Build dictionary binary files from dict/*.txt
npm run build:dictionaries

# Build keyboard neighbor maps for fuzzy matching
npm run build:keyboard-neighbors

# Build word prediction binaries (optional, for next-word suggestions)
node scripts/build_prediction_binary.js <language>

# Build all data files
npm run build:all
```

**IMPORTANT**: Run `npm run build:keyboards` before running iOS. Keyboard configs must be generated before building the native keyboard extensions.

### Testing

```bash
# Run React Native tests
npm test

# Run Android unit tests
npm run test:android

# Run iOS tests
npm run test:ios
```

### Linting

```bash
npm run lint
```

## Code Structure

### IssieVoice - Assistive Communication App (`apps/issievoice/`)

IssieVoice is a companion app for people who cannot speak, providing text-to-speech communication using the IssieBoard keyboard engine.

**Key Files:**
- **apps/issievoice/src/screens/MainScreen.tsx**: Main typing and speaking interface
- **apps/issievoice/src/screens/BrowseScreen.tsx**: Browse saved sentences
- **apps/issievoice/src/components/ActionBar/**: Speak, Clear, Save, Browse buttons
- **apps/issievoice/src/components/TextDisplayArea/**: Large text display area
- **apps/issievoice/src/components/SuggestionsBar/**: Word suggestions UI
- **apps/issievoice/src/components/SettingsModal/**: TTS settings (voice, language mode)
- **apps/issievoice/src/context/TTSContext.tsx**: Text-to-speech state management
- **apps/issievoice/src/context/TextContext.tsx**: Text state management
- **apps/issievoice/src/services/TextToSpeech.ts**: TTS wrapper service
- **apps/issievoice/src/services/SavedSentencesManager.ts**: Saved sentences storage

**Key Features:**
- Text-to-speech with language auto-detection (Hebrew/English)
- Separate voice selection per language
- Language mode settings (English Only, Hebrew Only, Auto-Detect)
- Embedded KeyboardPreview component for typing
- Language switch button on keyboard (blue button after "123")
- Saved sentences with KeyboardPreferences storage
- Settings modal with collapsible voice lists
- Large touch targets for accessibility (120px action buttons)

**Custom Key Types:**
- **language** key type: Emits events to switch keyboard language without inserting text
- Preview mode shows all keys from config and allows custom keys to emit events

### React Native Configurator (`src/`, `components/`, `App.tsx`)

- **App.tsx**: Main entry point, loads keyboard configurations from `keyboards/*.json`
- **src/screens/EditorScreen.tsx**: Main editor UI
- **src/components/canvas/InteractiveCanvas.tsx**: Visual keyboard preview
- **src/components/toolbox/**: Configuration panels (styling, groups, diacritics)
- **src/context/EditorContext.tsx**: Global state management
- **src/native/KeyboardPreferences.ts**: Platform-specific storage bridge
- **src/utils/keyboardConfigMerger.ts**: Merges keyboard layouts with profile styling

### Keyboard Definitions (`keyboards/`)

Language-specific keyboard layouts (pure layout, no styling):

- **keyboards/en.json**: English QWERTY layout
- **keyboards/he.json**: Hebrew layout with nikkud support
- **keyboards/ar.json**: Arabic layout
- **keyboards/common.js**: Shared utilities for keyboard generation

Each keyboard defines keysets (abc, ABC, symbols) with rows of keys.

### Native Keyboard Engines

#### iOS (`ios/`)

- **ios/Shared/**: Code shared across all keyboard extensions
  - **BaseKeyboardViewController.swift**: Base class for all keyboard extensions
  - **KeyboardRenderer.swift**: Dynamic UI rendering from JSON config
  - **KeyboardConfigParser.swift**: Parses JSON configuration
  - **WordSuggestionController.swift**: Manages word completion/prediction UI
  - **WordCompletionManager.swift**: Orchestrates trie and prediction engines
  - **TrieEngine.swift**: Dictionary trie for word completion
  - **WordPredictionEngine.swift**: Bigram-based next-word prediction
  - **NikkudPickerController.swift**: Hebrew diacritics popup
  - **BackspaceHandler.swift**: Smart backspace with long-press delete
  - **KeyboardNeighbors.swift**: Neighbor map for fuzzy matching
- **ios/IssieBoardEn/**: English keyboard extension
- **ios/IssieBoardHe/**: Hebrew keyboard extension
- **ios/IssieBoardAr/**: Arabic keyboard extension

Each extension inherits from `BaseKeyboardViewController` and specifies its language.

#### Android (`android/`)

- **android/app/src/main/java/com/issieboardng/shared/**: Code shared across all keyboard services
  - **BaseKeyboardService.kt**: Base class for all keyboard services (Android port of BaseKeyboardViewController.swift)
  - **KeyboardRenderer.kt**: Dynamic UI rendering from JSON config
  - **KeyboardConfigParser.kt**: Parses JSON configuration
  - **WordSuggestionController.kt**: Manages word completion/prediction UI
  - **WordCompletionManager.kt**: Orchestrates trie and prediction engines
  - **TrieEngine.kt**: Dictionary trie for word completion
  - **WordPredictionEngine.kt**: Bigram-based next-word prediction
  - **NikkudPickerController.kt**: Hebrew diacritics popup
  - **BackspaceHandler.kt**: Smart backspace with long-press delete
  - **KeyboardNeighbors.kt**: Neighbor map for fuzzy matching
- **android/app/src/main/java/com/issieboardng/keyboards/**:
  - **IssieBoardEnService.kt**: English keyboard service
  - **IssieBoardHeService.kt**: Hebrew keyboard service
  - **IssieBoardArService.kt**: Arabic keyboard service

Each service inherits from `BaseKeyboardService` and specifies its language.

### Dictionaries & Data (`dict/`)

- **dict/<lang>_50k.txt**: Word frequency lists for word completion
- **dict/bin/<lang>_dict.bin**: Binary trie dictionaries (generated)
- **dict/bin/<lang>_neighbors.bin**: Keyboard neighbor maps (generated)
- **dict/bin/<lang>_predictions.bin**: Word prediction data (optional, generated from corpus)

### Scripts (`scripts/`)

- **build_keyboard_configs.js**: Generates native keyboard JSON from `keyboards/*.json`
- **build_dictionaries.js**: Builds binary trie dictionaries from word lists
- **build_keyboard_neighbors.js**: Generates neighbor maps for fuzzy matching
- **extract_word_predictions.js**: Extracts bigram predictions from sentence corpus
- **build_prediction_binary.js**: Builds binary prediction files
- **extract_trie_order.js**: Extracts word index mappings for prediction system

## Critical Architecture Patterns

### 1. iOS-First Development (CRITICAL)

**iOS is the leading platform. Android is a port.**

- **All new features and changes MUST be implemented in iOS first**
- Only when the iOS implementation is complete and approved should it be ported to Android
- **Never write Android logic from scratch** - always port from the iOS implementation
- See `android/PORTING_INSTRUCTIONS.md` for detailed porting guidelines
- File names, class names, method names, and logic must maintain 1:1 mapping between platforms

**Development Flow:**
1. Implement feature in iOS (`ios/Shared/*.swift`)
2. Test and refine until satisfied
3. When explicitly instructed, port to Android following PORTING_INSTRUCTIONS.md
4. Keep both implementations synchronized

### 2. Modular Keyboard System

Keyboards are separated from profiles for reusability:

- **Keyboards** (`keyboards/*.json`): Pure key layouts, no styling
- **Profiles**: Styling, global properties, and keyboard combinations
- **Merging**: `App.tsx` merges keyboards with profile styling at runtime

### 3. Native Engine Independence

The keyboard engines are **completely decoupled** from React Native:

- No React Native Bridge access in keyboard code
- Configuration is JSON-only, written to shared storage
- Native engines read JSON on startup and hot-reload on changes
- This ensures <50ms startup and stays within iOS 50MB memory limit

### 4. Shared Code Pattern (Parallel Ports)

iOS and Android implementations are **parallel ports**, not shared code:

- **ios/Shared/** and **android/.../shared/** contain matching implementations
- Class names and APIs are intentionally identical (e.g., `BaseKeyboardService.kt` ↔ `BaseKeyboardViewController.swift`)
- Each file includes a comment: `/** Port of ios/Shared/FileName.swift */`
- Each platform uses native idioms (UIKit vs Android Views, Swift vs Kotlin)
- Changes flow iOS → Android, never the reverse

### 5. Word Completion System

Multi-layered suggestion system:

1. **Exact prefix matches** from trie dictionary
2. **Fuzzy matching** using keyboard neighbor maps (for typos)
3. **Word completion** mode (typing a word)
4. **Word prediction** mode (next-word suggestions after space)

### 6. Dynamic Key Rendering

Keys are styled at runtime using group templates:

- **Groups**: Define style templates (colors, fonts, sizes)
- **Items**: List of characters/values to apply template to
- **Merging**: Renderer applies group styles to keys during rendering

## Common Development Workflows

### Adding a New Keyboard Language

1. Create `keyboards/<lang>.json` with keyboard layout
2. Add to `KEYBOARDS` object in `App.tsx`
3. Create iOS extension: `ios/IssieBoard<Lang>/KeyboardViewController.swift`
4. Create Android service: `android/.../IssiBoard<Lang>Service.kt`
5. Add dictionary: `dict/<lang>_50k.txt`
6. Run `npm run build:dictionaries` and `npm run build:keyboards`
7. Add generated binaries to iOS/Android projects

### Modifying Keyboard Behavior

**IMPORTANT: iOS-First Development Rule**

When changing keyboard logic (e.g., backspace, word completion):

1. Identify the component (e.g., `BackspaceHandler`, `WordCompletionManager`)
2. **Implement changes in iOS first** (`ios/Shared/<Component>.swift`)
3. Test and refine the iOS implementation
4. **Only when approved**, port changes to Android following `android/PORTING_INSTRUCTIONS.md`
5. Maintain 1:1 mapping of logic, file names, class names, and method names

### Updating Keyboard Configuration Format

When changing the JSON config structure:

1. Update `types.ts` with new config types
2. Update `KeyboardConfigParser` in both iOS and Android
3. Update `KeyboardRenderer` in both platforms if UI changes
4. Update `build_keyboard_configs.js` if generation logic changes
5. Run `npm run build:keyboards` to regenerate configs

### Adding Word Predictions

1. Obtain sentence corpus for language (e.g., from Leipzig Corpora)
2. Run `node scripts/extract_word_predictions.js dict/<lang>_50k.txt <corpus.txt>`
3. Run `node scripts/build_prediction_binary.js <lang>`
4. Add `dict/bin/<lang>_predictions.bin` to iOS/Android projects
5. System automatically uses predictions when available

## Android-Specific Notes

- Keyboard services are registered in `AndroidManifest.xml`
- Build configuration in `android/build.gradle` (minSdkVersion: 24, targetSdkVersion: 36)
- Kotlin version: 2.2.0
- Uses SharedPreferences for config storage
- Input method services extend `InputMethodService`

## iOS-Specific Notes

- Keyboard extensions are separate targets in Xcode project
- Uses App Groups for shared UserDefaults between app and extensions
- Extension memory limit is 50MB (strict)
- Uses UIInputViewController as base class
- CocoaPods for dependency management (`cd ios && pod install`)

## Important Files to Review

- **README.md**: Project overview and architecture explanation
- **ISSIEVOICE_STRUCTURE.md**: IssieVoice app structure and implementation details
- **ISSIEVOICE_XCODE_SETUP.md**: IssieVoice Xcode setup instructions
- **android/PORTING_INSTRUCTIONS.md**: Complete guide for porting iOS features to Android (CRITICAL)
- **MODULAR_STRUCTURE.md**: Details on keyboard/profile separation
- **WORD_PREDICTION_GUIDE.md**: Complete guide to word prediction system
- **DIACRITICS_SPEC.md**: Hebrew nikkud implementation details
- **TESTING_STRATEGY.md**: Testing approach and guidelines

## Git Workflow

- Main branch: `main`
- Recent focus: word prediction, mobile UI adjustments, keyboard fine-tuning
- Follow instructions in `git-commit-instructions.md` when committing
