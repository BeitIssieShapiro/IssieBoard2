# IssieVoice Setup Guide

## Complete Folder Structure Created

This guide shows you the complete folder structure that has been set up and the next steps to get IssieVoice running.

## 📁 What Has Been Created

```
apps/issievoice/
├── src/
│   ├── components/
│   │   ├── ActionBar/
│   │   │   └── ActionBar.tsx              ✅ Complete - 4 action buttons
│   │   ├── SuggestionsBar/
│   │   │   └── SuggestionsBar.tsx         ✅ Complete - Word suggestions
│   │   ├── TextDisplayArea/
│   │   │   └── TextDisplayArea.tsx        ✅ Complete - Scrollable text
│   │   └── SavedSentences/                📁 Folder ready
│   ├── screens/
│   │   ├── MainScreen.tsx                 ✅ Complete - Main typing screen
│   │   ├── BrowseScreen.tsx               ✅ Complete - Browse saved sentences
│   │   └── SettingsScreen.tsx             ✅ Complete - TTS settings
│   ├── context/
│   │   ├── TextContext.tsx                ✅ Complete - Text state management
│   │   └── TTSContext.tsx                 ✅ Complete - TTS state management
│   ├── services/
│   │   ├── TextToSpeech.ts                ✅ Complete - TTS service
│   │   └── SavedSentencesManager.ts       ✅ Complete - Storage service
│   ├── constants/
│   │   ├── colors.ts                      ✅ Complete - Color palette
│   │   ├── sizes.ts                       ✅ Complete - Touch targets
│   │   └── index.ts                       ✅ Complete - Exports
│   ├── navigation/                        📁 Folder ready
│   └── hooks/                             📁 Folder ready
├── ios/                                   📁 Folder ready (needs Xcode setup)
├── assets/                                📁 Folder ready (for icons, fonts)
├── App.tsx                                ✅ Complete - Root component
├── index.js                               ✅ Complete - Entry point
├── package.json                           ✅ Complete - Dependencies
├── app.json                               ✅ Complete - App metadata
├── tsconfig.json                          ✅ Complete - TypeScript config
├── babel.config.js                        ✅ Complete - Babel config
├── metro.config.js                        ✅ Complete - Metro bundler
├── .eslintrc.js                           ✅ Complete - Linting
├── .gitignore                             ✅ Complete - Git ignore
└── README.md                              ✅ Complete - Documentation
```

## 🎯 Core Features Implemented

### 1. **Main Screen** (`MainScreen.tsx`)
- Text display area (120px height, scrollable)
- Action bar with 4 large buttons (80px height each)
- Suggestions bar (70px height)
- Keyboard placeholder area

### 2. **Action Bar** (`ActionBar.tsx`)
- 🗣️ **Speak Button** (Green) - Reads text aloud
- 🗑️ **Clear Button** (Red) - Clears text
- 💾 **Save Button** (Amber) - Saves sentence
- 📚 **Browse Button** (Purple) - Opens saved sentences

### 3. **Browse Screen** (`BrowseScreen.tsx`)
- Search bar for filtering sentences
- List of saved sentences
- Quick actions: Speak or Delete each sentence
- Tap sentence to load it

### 4. **Settings Screen** (`SettingsScreen.tsx`)
- Speech speed: Slow/Normal/Fast
- Voice pitch: Low/Normal/High
- About section

### 5. **Text-to-Speech Integration**
- iOS native TTS via `react-native-tts`
- Configurable rate and pitch
- Speaking state management

### 6. **State Management**
- **TextContext**: Manages typing, append, clear
- **TTSContext**: Manages TTS operations and settings

## 🚀 Next Steps to Run the App

### Step 1: Install Dependencies

```bash
cd apps/issievoice
npm install
```

### Step 2: Initialize iOS Project

You need to create the iOS project using React Native CLI:

```bash
# From apps/issievoice directory
npx react-native init IssieVoice --directory ios --skip-install
```

Or manually create the Xcode project and configure it.

### Step 3: Install iOS Dependencies

```bash
cd ios
pod install
cd ..
```

### Step 4: Run the App

```bash
npm run ios
```

## 📋 iOS Project Configuration Checklist

When setting up the iOS project, you need to:

1. **Create Xcode Project**
   - Bundle Identifier: `org.issieshapiro.issievoice`
   - Display Name: IssieVoice
   - Deployment Target: iOS 14.0+

2. **Configure Info.plist**
   - Add NSMicrophoneUsageDescription (if needed for future features)
   - Add NSSpeechRecognitionUsageDescription (if needed)
   - Configure app permissions

3. **Link Native Modules**
   - react-native-tts
   - react-native-safe-area-context
   - react-native-reanimated
   - react-native-gesture-handler
   - react-native-screens
   - @react-native-async-storage/async-storage

4. **Configure App Icons**
   - Add app icon to Assets.xcassets
   - Configure launch screen

## 🎨 Design Specifications

### Color Palette
- **Primary**: Blue (#2563EB)
- **Speak**: Green (#10B981)
- **Clear**: Red (#EF4444)
- **Save**: Amber (#F59E0B)
- **Browse**: Purple (#8B5CF6)

### Touch Targets
- **Action Buttons**: 80px height
- **Suggestion Buttons**: 70px height
- **Keyboard Keys**: 60px minimum
- **All interactive elements**: 60px+ for accessibility

### Typography
- **Large**: 24px (main text)
- **Extra Large**: 32px (headers)
- **XXL**: 48px (very important text)

## 🔧 Still To Implement

### High Priority
1. **Large-Key Keyboard Component**
   - Custom keyboard with 60px+ keys
   - Support for Hebrew, English, Arabic
   - Integration with word prediction

2. **Save Sentence Dialog**
   - Modal for saving with optional category
   - Quick save without category

3. **Settings Button**
   - Add settings button to main screen or action bar

### Medium Priority
4. **Word Prediction Integration**
   - Connect to IssieBoard's prediction engine
   - Use shared dictionary files

5. **Keyboard Language Switcher**
   - Button to switch between keyboards

6. **Enhanced Saved Sentences**
   - Categories/folders
   - Reordering
   - Favorites

### Nice to Have
7. **Visual Feedback**
   - Animation when speaking
   - Haptic feedback on button press

8. **Accessibility**
   - VoiceOver support
   - Dynamic type support
   - High contrast mode

## 🧪 Testing

Once the iOS project is set up, you can test:

```bash
# Run on simulator
npm run ios

# Run tests
npm test
```

## 📦 Dependencies Already Configured

All necessary packages are in `package.json`:
- ✅ React Navigation (stack navigator)
- ✅ React Native TTS (text-to-speech)
- ✅ AsyncStorage (data persistence)
- ✅ Safe Area Context (iPhone notch support)
- ✅ Reanimated (animations)
- ✅ Gesture Handler (touch handling)

## 🔄 Relationship with IssieBoard

### What's Shared
- Root `package.json` (monorepo config)
- `scripts/` directory (build tools)
- Future: `packages/` for shared code

### What's Separate
- Completely independent app
- Own package.json and dependencies
- Own iOS project
- Own navigation and screens
- Published separately to App Store

### Current IssieBoard
- **Stays exactly as is** at root level
- No changes to existing files
- Continues to work independently
- Run from root: `npm run ios`

## 💡 Pro Tips

1. **Start Simple**: Test with the current mock suggestions first
2. **Iterate**: Build and test on device early
3. **Accessibility**: Test with real users who need assistive tech
4. **Performance**: Keep UI responsive with large touch targets
5. **Error Handling**: Graceful fallbacks for TTS failures

## 🆘 Troubleshooting

### If Dependencies Don't Install
```bash
# Clean and reinstall from root
cd ../..
npm run clean
npm install
```

### If iOS Build Fails
```bash
cd ios
pod deintegrate
pod install
cd ..
```

### If Metro Bundler Issues
```bash
# Reset cache
npm start -- --reset-cache
```

---

**Last Updated**: February 11, 2026  
**Status**: Structure complete, ready for iOS project setup and implementation  
**Next Action**: Initialize iOS project and run first build