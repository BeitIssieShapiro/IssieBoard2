# IssieVoice - Assistive Communication App

An iOS application that helps people who cannot speak to type text and have it read aloud using text-to-speech.

## Project Status

**Structure Created**: ✅  
**Implementation Status**: 🚧 In Progress

### ✅ Completed
- Monorepo structure with npm workspaces
- App folder structure
- Constants (colors, sizes)
- Services (TTS, SavedSentences)
- Context providers (Text, TTS)
- Package configuration
- Documentation

### 🚧 To Be Implemented
- Screen components (MainScreen, BrowseScreen, SettingsScreen)
- UI components (ActionBar, TextDisplay, SuggestionsBar)
- Large-key keyboard component
- iOS project configuration
- Navigation setup
- Testing

## Quick Start

### Prerequisites
- Node.js >=20
- iOS development environment (Xcode)
- CocoaPods

### Setup
```bash
# From repo root
cd IssieBoardNG
npm install

# Install iOS dependencies
cd apps/issievoice/ios
pod install

# Run the app
cd ..
npm run ios
```

## Architecture

### State Management
- **TextContext**: Manages current text, append/clear operations
- **TTSContext**: Manages text-to-speech state and settings

### Services
- **TextToSpeech**: TTS engine wrapper
- **SavedSentencesManager**: Persistent storage for saved phrases

### Key Features
1. **Large touch targets** (60px minimum) for accessibility
2. **High contrast colors** for visibility
3. **Simple navigation** - no deep menus
4. **One-tap actions** for common operations

## Design Principles

1. **Accessibility First**: Large buttons, high contrast, clear hierarchy
2. **Speed**: Minimal taps for common actions
3. **Simplicity**: All functions visible on main screen
4. **Clarity**: Color-coded buttons by function

## Color Scheme

- **Speak**: Green (#10B981) - Primary positive action
- **Clear**: Red (#EF4444) - Destructive action
- **Save**: Amber (#F59E0B) - Save action
- **Browse**: Purple (#8B5CF6) - Navigation action

## File Structure

```
apps/issievoice/
├── src/
│   ├── components/          # UI components
│   ├── screens/             # Screen components
│   ├── context/             # React Context providers
│   ├── services/            # Business logic
│   ├── constants/           # Colors, sizes, etc.
│   └── navigation/          # Navigation setup
├── ios/                     # iOS-specific files
├── assets/                  # Images, fonts
├── App.tsx                  # Root component
└── package.json
```

## Next Steps

See `ISSIEVOICE_STRUCTURE.md` in the repo root for the complete development plan and implementation roadmap.

## Related Projects

- **IssieBoard**: Custom keyboard app (sibling project in monorepo)
- Shares utilities, components, and keyboard logic

---

**Created**: February 11, 2026  
**Target Platform**: iOS 14+  
**Languages**: English, Hebrew, Arabic