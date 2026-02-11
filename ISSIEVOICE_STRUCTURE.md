# IssieVoice App Structure

## Overview

IssieVoice is an assistive communication app built with React Native (iOS-only) that helps people who cannot speak to type text and have it read aloud using text-to-speech.

## Monorepo Structure

```
IssieBoardNG/                          # Root monorepo
├── packages/                          # Shared packages
│   ├── shared-utils/                  # Utilities (storage, localization, types)
│   │   ├── src/
│   │   │   ├── storage/
│   │   │   ├── localization/
│   │   │   ├── types/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── shared-components/             # Reusable React Native components
│   │   ├── src/
│   │   │   ├── buttons/
│   │   │   ├── inputs/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── shared-keyboard-engine/        # Word prediction & keyboard logic
│       ├── src/
│       │   ├── prediction/
│       │   └── index.ts
│       └── package.json
│
├── apps/                              # Individual applications
│   ├── issieboard/                    # Original IssieBoard app
│   │   ├── (existing structure)
│   │
│   └── issievoice/                    # NEW IssieVoice app
│       ├── src/
│       │   ├── components/            # IssieVoice-specific components
│       │   │   ├── TextDisplayArea/
│       │   │   │   └── TextDisplayArea.tsx
│       │   │   ├── ActionBar/
│       │   │   │   ├── ActionBar.tsx
│       │   │   │   ├── SpeakButton.tsx
│       │   │   │   ├── ClearButton.tsx
│       │   │   │   ├── SaveButton.tsx
│       │   │   │   └── BrowseButton.tsx
│       │   │   ├── SuggestionsBar/
│       │   │   │   └── SuggestionsBar.tsx
│       │   │   └── SavedSentences/
│       │   │       └── SavedSentencesList.tsx
│       │   ├── screens/               # Main screens
│       │   │   ├── MainScreen.tsx     # Primary typing & speaking
│       │   │   ├── BrowseScreen.tsx   # Browse saved sentences
│       │   │   └── SettingsScreen.tsx # TTS settings
│       │   ├── context/               # State management
│       │   │   ├── TextContext.tsx    # Text state
│       │   │   └── TTSContext.tsx     # TTS state
│       │   ├── services/              # Business logic
│       │   │   ├── TextToSpeech.ts    # TTS service
│       │   │   └── SavedSentencesManager.ts
│       │   ├── navigation/
│       │   │   └── AppNavigator.tsx
│       │   ├── constants/
│       │   │   ├── colors.ts          # Color palette
│       │   │   ├── sizes.ts           # Touch target sizes
│       │   │   └── index.ts
│       │   └── hooks/
│       ├── ios/                       # iOS-specific code
│       ├── assets/                    # App-specific assets
│       ├── App.tsx                    # App entry point
│       ├── index.js
│       ├── package.json
│       └── README.md
│
├── scripts/                           # Build scripts (shared)
├── package.json                       # Root package.json
└── README.md
```

## Key Features

### 1. **Text Display Area**
- Large, scrollable text display
- Shows currently typed text
- Auto-scrolls for long sentences

### 2. **Action Bar** (4 large buttons)
- **Speak Button** (Green): Reads text aloud using TTS
- **Clear Button** (Red): Clears all text
- **Save Button** (Amber): Saves current text as a saved sentence
- **Browse Button** (Purple): Opens saved sentences browser

### 3. **Suggestions Bar**
- Shows word suggestions based on typing
- Large tap targets for easy selection
- Updates dynamically as user types

### 4. **Large-Key Keyboard**
- Embedded keyboard with generously sized keys (min 60px)
- High contrast for visibility
- Supports multiple languages (Hebrew, English, Arabic)

### 5. **Saved Sentences**
- Store frequently-used phrases
- Quick search and browse
- One-tap to load and speak

## Technology Stack

- **React Native 0.83.1**: Cross-platform framework (iOS-only for now)
- **React Navigation**: Stack navigation
- **React Native TTS**: Text-to-speech engine
- **AsyncStorage**: Local data persistence
- **TypeScript**: Type safety
- **Monorepo**: npm workspaces

## Accessibility Features

### Large Touch Targets
All interactive elements meet minimum accessibility standards:
- Small: 60px
- Medium: 80px
- Large: 100px
- Extra Large: 120px

### High Contrast Colors
Color palette designed for visibility:
- Clear visual hierarchy
- Distinct button colors by function
- High contrast text

### Simple Navigation
- No deep menus
- All core functions accessible from main screen
- Large, clear buttons with icons

## Setup Instructions

### Prerequisites
- Node.js >=20
- iOS development environment (Xcode)
- CocoaPods

### Installation

1. **Install dependencies**:
```bash
cd IssieBoardNG
npm install
```

2. **Install iOS pods**:
```bash
cd apps/issievoice/ios
pod install
```

3. **Run the app**:
```bash
cd apps/issievoice
npm run ios
```

## File Structure Rationale

### Why Monorepo?
- **Code Reuse**: Share utilities, components, and keyboard logic
- **Independent Deployment**: Each app has its own package.json and build
- **Clear Separation**: IssieBoard and IssieVoice are distinct apps
- **Easy Maintenance**: Shared code updates benefit both apps

### Component Organization
Components are organized by feature:
- **TextDisplayArea**: Text display and scroll logic
- **ActionBar**: All action buttons (Speak, Clear, Save, Browse)
- **SuggestionsBar**: Word suggestion UI
- **SavedSentences**: Saved sentence management UI

### State Management
Two contexts provide clean separation:
- **TextContext**: Manages current text, append, clear operations
- **TTSContext**: Manages TTS state, settings, speak/stop operations

## Development Workflow

### Adding a New Component
1. Create component in appropriate folder under `src/components/`
2. Export from component's `index.ts`
3. Use in screens as needed

### Adding a New Screen
1. Create screen in `src/screens/`
2. Register in `App.tsx` navigation
3. Add navigation logic

### Modifying Shared Code
1. Make changes in `packages/`
2. Changes automatically available to both apps (workspace linking)

## Next Steps

The following components still need to be implemented:
1. Main Screen UI
2. Browse Screen UI
3. Settings Screen UI
4. Action Bar components
5. Text Display component
6. Suggestions Bar component
7. Large-key keyboard component
8. iOS-specific TTS configuration
9. Word prediction integration
10. Comprehensive testing

## Design Principles

1. **Accessibility First**: Large touch targets, high contrast, simple navigation
2. **Speed**: Minimize taps needed for common actions
3. **Clarity**: Clear visual hierarchy, distinct button colors
4. **Simplicity**: No hidden menus, all functions visible
5. **Reliability**: Robust error handling, graceful degradation

## Architecture Decisions

### iOS-Only (for now)
- Simpler development and testing
- Better TTS quality on iOS
- Can expand to Android later

### React Native
- Fast development
- Code reuse with IssieBoard
- Native performance
- Access to native TTS APIs

### Context API (not Redux)
- Simpler for this app's scope
- Less boilerplate
- Easier to understand
- Sufficient for state management needs

## Performance Considerations

- Text updates are debounced
- Suggestions computed asynchronously
- Lazy loading for saved sentences list
- Optimized re-renders with React.memo where appropriate

---

**Created**: February 11, 2026  
**Status**: Structure complete, implementation in progress  
**iOS Target**: iOS 14+  
**Languages**: Hebrew, English, Arabic