# Multi-Keyboard Setup for iOS

This document explains how to set up the three separate keyboard extensions (Arabic, English, Hebrew) in Xcode.

## Overview

Instead of a single keyboard with multiple languages, we now have 3 separate keyboard extensions:
- **IssieBoardHe** - Hebrew keyboard (RTL)
- **IssieBoardEn** - English keyboard (LTR)
- **IssieBoardAr** - Arabic keyboard (RTL)

Each keyboard is a separate target that users can enable independently in iOS Settings.

## Single Source of Truth

The keyboard layouts are defined once in `keyboards/*.json` files:
- `keyboards/he.json` - Hebrew keyboard definition
- `keyboards/en.json` - English keyboard definition
- `keyboards/ar.json` - Arabic keyboard definition

A build script generates the iOS-specific `default_config.json` files for each keyboard extension.

### Automatic Build Integration

The keyboard configs are automatically built when you run:
```bash
npm run ios    # Builds configs then runs react-native run-ios
```

You can also build configs manually:
```bash
npm run build:ios-keyboards   # Just build keyboard configs
npm run build:all            # Build dictionaries + iOS configs
```

### Xcode Build Phase (Optional)

To also run the build when building directly from Xcode:

1. Select the main `IssieBoardNG` target
2. Go to **Build Phases**
3. Click `+` → **New Run Script Phase**
4. Name it "Build Keyboard Configs"
5. Move it to be **first** in the list (before "Compile Sources")
6. Set the shell script:
```bash
"$SRCROOT/build_keyboard_configs.sh"
```
7. Uncheck "Based on dependency analysis"

This ensures configs are regenerated whenever you build from Xcode.

**Important:** Don't manually edit the `ios/IssieBoard*/default_config.json` files - they are auto-generated. Edit the source files in `keyboards/` instead.

## Directory Structure

```
ios/
├── IssieBoardHe/           # Hebrew keyboard extension
│   ├── Info.plist
│   ├── IssieBoardHe.entitlements
│   ├── KeyboardViewController.swift
│   ├── default_config.json
│   └── he_50k.bin
├── IssieBoardEn/           # English keyboard extension
│   ├── Info.plist
│   ├── IssieBoardEn.entitlements
│   ├── KeyboardViewController.swift
│   ├── default_config.json
│   └── en_50k.bin
├── IssieBoardAr/           # Arabic keyboard extension
│   ├── Info.plist
│   ├── IssieBoardAr.entitlements
│   ├── KeyboardViewController.swift
│   ├── default_config.json
│   └── ar_50k.bin
└── Shared/                 # Shared code between all keyboards
    ├── BaseKeyboardViewController.swift
    ├── KeyboardRenderer.swift
    ├── KeyboardModels.swift
    ├── KeyboardPreferences.swift
    ├── TrieEngine.swift
    └── WordCompletionManager.swift
```

## Setting Up in Xcode

### Step 1: Add New Targets

For each keyboard (Hebrew, English, Arabic), you need to add a new App Extension target:

1. Open `IssieBoardNG.xcworkspace` in Xcode
2. Select the project in the navigator
3. Click `+` at the bottom of the targets list
4. Choose **App Extension** > **Custom Keyboard Extension**
5. Name it appropriately:
   - `IssieBoardHe` for Hebrew
   - `IssieBoardEn` for English
   - `IssieBoardAr` for Arabic
6. Set the language to Swift
7. Click Finish

### Step 2: Configure Each Target

For each new target:

#### A. Update Build Settings

1. Select the target
2. Go to **Build Settings**
3. Set these values:
   - **Product Bundle Identifier**: 
     - `org.issieshapiro.test.Playground.IssieBoardHe`
     - `org.issieshapiro.test.Playground.IssieBoardEn`
     - `org.issieshapiro.test.Playground.IssieBoardAr`
   - **Development Team**: `SKNJT9TD9G`
   - **Code Signing Entitlements**: Point to the respective `.entitlements` file
   - **Info.plist File**: Point to the respective `Info.plist`

#### B. Replace Generated Files

1. Delete the auto-generated `KeyboardViewController.swift` and `Info.plist`
2. Add references to the files in the respective folder (e.g., `ios/IssieBoardHe/`)

#### C. Add Shared Code

For each keyboard target, add the Shared files to its **Compile Sources**:

1. Select the target
2. Go to **Build Phases** > **Compile Sources**
3. Add these files from the `Shared` folder:
   - `BaseKeyboardViewController.swift`
   - `KeyboardRenderer.swift`
   - `KeyboardModels.swift`
   - `KeyboardPreferences.swift`
   - `TrieEngine.swift`
   - `WordCompletionManager.swift`

4. Also add the target's own `KeyboardViewController.swift`

#### D. Add Resources

For each keyboard target, add resources to **Copy Bundle Resources**:

1. Select the target
2. Go to **Build Phases** > **Copy Bundle Resources**
3. Add:
   - `default_config.json` (from the target's folder)
   - The appropriate dictionary file (`he_50k.bin`, `en_50k.bin`, or `ar_50k.bin`)

### Step 3: Configure App Groups

Each keyboard extension needs the same App Group to share preferences with the main app:

1. Select each keyboard target
2. Go to **Signing & Capabilities**
3. Click `+ Capability`
4. Add **App Groups**
5. Select `group.org.issieshapiro.test`

### Step 4: Add to Main App

Add each keyboard extension to the main app:

1. Select the main `IssieBoardNG` target
2. Go to **Build Phases** > **Embed App Extensions**
3. Click `+` and add all three keyboard extensions

### Step 5: Update Scheme

Make sure each keyboard can be debugged:

1. Go to **Product** > **Scheme** > **Manage Schemes**
2. Ensure schemes exist for each keyboard target
3. Set the main app scheme to build all keyboard dependencies

## Info.plist Configuration

Each keyboard has specific Info.plist settings:

### Hebrew (IssieBoardHe)
```xml
<key>PrimaryLanguage</key>
<string>he</string>
<key>PrefersRightToLeft</key>
<true/>
<key>IsASCIICapable</key>
<false/>
```

### English (IssieBoardEn)
```xml
<key>PrimaryLanguage</key>
<string>en-US</string>
<key>PrefersRightToLeft</key>
<false/>
<key>IsASCIICapable</key>
<true/>
```

### Arabic (IssieBoardAr)
```xml
<key>PrimaryLanguage</key>
<string>ar</string>
<key>PrefersRightToLeft</key>
<true/>
<key>IsASCIICapable</key>
<false/>
```

## User Experience

After installation, users will see three separate keyboards in:
**Settings > General > Keyboard > Keyboards > Add New Keyboard**

They can enable any combination:
- IssieBoard Hebrew
- IssieBoard English
- IssieBoard Arabic

Each keyboard:
- Appears as a separate option in the keyboard switcher
- Has its own dedicated layout and dictionary
- Can be customized independently via the main app

## Removing the Old Keyboard

After setting up the new keyboards, you can remove or keep the old `IssieBoard` target:

1. If removing: Delete the target from Xcode and remove the `IssieBoard` folder
2. If keeping: Update it to be a default/fallback keyboard

## Testing

1. Build and run on a device or simulator
2. Go to Settings > General > Keyboard > Keyboards
3. Add each IssieBoard keyboard
4. Test in any text input field

## Troubleshooting

### Keyboard doesn't appear in Settings
- Verify the bundle identifier is correct
- Ensure the extension is embedded in the main app
- Check that signing is properly configured

### Keyboard shows but doesn't load
- Check that `default_config.json` is included in bundle resources
- Verify the App Group is configured correctly
- Look at Console logs for errors

### Word suggestions not working
- Ensure the dictionary `.bin` file is in bundle resources
- Check that `WordCompletionManager` is receiving the correct language code