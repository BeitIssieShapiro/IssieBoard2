# iOS Keyboard Extension Setup Guide

This guide explains how to add the IssieKeyboard extension to the iOS project.

## Files Created

The following files have been created for the keyboard extension:

1. `ios/IssieKeyboard/KeyboardViewController.swift` - Main keyboard view controller
2. `ios/IssieKeyboard/Info.plist` - Keyboard extension configuration

## Adding the Keyboard Extension to Xcode

Since the Xcode project file (`project.pbxproj`) is complex and binary-like, it's best to add the keyboard extension through Xcode itself:

### Step 1: Open the Project in Xcode

```bash
cd ios
open IssieBoardNG.xcworkspace
# or if workspace doesn't exist yet:
open IssieBoardNG.xcodeproj
```

### Step 2: Add a New Keyboard Extension Target

1. In Xcode, select the project in the navigator (top-level "IssieBoardNG")
2. Click the "+" button at the bottom of the targets list
3. Search for "Custom Keyboard Extension"
4. Click "Next"
5. Configure the extension:
   - Product Name: `IssieKeyboard`
   - Team: Select your development team
   - Organization Identifier: Use the same as your main app
   - Bundle Identifier: Should be `org.reactjs.native.example.IssieBoardNG.IssieKeyboard`
   - Language: Swift
6. Click "Finish"
7. When asked to activate the scheme, click "Activate"

### Step 3: Replace Generated Files

Xcode will generate some template files. Replace them with our custom files:

1. Delete the generated `KeyboardViewController.swift` and `Info.plist` from the IssieKeyboard group in Xcode
2. Right-click the IssieKeyboard group and select "Add Files to IssieBoardNG"
3. Navigate to and select:
   - `ios/IssieKeyboard/KeyboardViewController.swift`
   - `ios/IssieKeyboard/Info.plist`
4. Make sure "Copy items if needed" is **unchecked** (we want to reference the existing files)
5. Make sure the IssieKeyboard target is selected
6. Click "Add"

### Alternative: Manual Target Configuration

If you prefer to manually configure the target instead of using Xcode's wizard:

1. Click "+" to add a new target
2. Select "Custom Keyboard Extension" template
3. After creation, configure the following in Build Settings:
   - Product Bundle Identifier: `org.reactjs.native.example.IssieBoardNG.IssieKeyboard`
   - Deployment Target: iOS 15.1 or higher
   - Swift Version: 5.0
4. Add the Swift files to the target's "Compile Sources" build phase
5. Add the Info.plist to the target

## Step 4: Configure the Main App

The main app needs to include the keyboard extension. This should already be configured when you create the extension target through Xcode.

Verify in the main app target's "General" tab that:
- The IssieKeyboard extension appears in "Frameworks, Libraries, and Embedded Content"

## Step 5: Build and Run

1. Select the main app scheme (IssieBoardNG)
2. Select a simulator or device
3. Build and run (Cmd+R)

## Step 6: Enable the Keyboard

On the device/simulator:

1. Open the Settings app
2. Go to General > Keyboard > Keyboards
3. Tap "Add New Keyboard"
4. Find and select "IssieKeyboard"
5. The keyboard should now appear in the list

## Step 7: Test the Keyboard

1. Open any app that uses the keyboard (Notes, Messages, etc.)
2. Tap on a text field
3. Tap the globe/keyboard switcher button (🌐)
4. Select "IssieKeyboard"
5. You should see a simple QWERTY keyboard with:
   - Three rows of letters (QWERTY layout)
   - Space bar
   - Delete button (⌫)
   - Keyboard switcher (🌐)

## Current Keyboard Features

The minimal keyboard implementation includes:

- Basic QWERTY layout (Q-P, A-L, Z-M)
- Space bar
- Delete/backspace functionality
- Keyboard switcher to toggle between keyboards
- Simple white buttons on gray background
- Basic text input functionality

## Next Steps

Once the basic keyboard is working, you can:

1. Add more keyboard layouts (numbers, symbols, Hebrew, Arabic)
2. Integrate with the JSON keyboard configuration files
3. Add key press animations and haptic feedback
4. Implement long-press functionality for alternate characters
5. Add autocorrect and suggestions
6. Customize colors and styling to match the Android keyboard
7. Add support for RequestsOpenAccess for advanced features

## Troubleshooting

### Keyboard doesn't appear in Settings
- Make sure the extension target built successfully
- Check that the Info.plist has the correct NSExtension configuration
- Try cleaning the build folder (Cmd+Shift+K) and rebuilding

### Keyboard crashes when opened
- Check the console logs in Xcode
- Verify the KeyboardViewController class name matches the Info.plist
- Make sure Swift files are added to the correct target

### Can't switch to keyboard
- Ensure you've enabled "Full Access" in keyboard settings if needed
- Try restarting the device/simulator
- Check that RequestsOpenAccess is set correctly in Info.plist

## Important Notes

- Custom keyboards on iOS require an App Extension target
- The keyboard runs in a separate process from the main app
- By default, keyboards have limited permissions (no network, no Full Access)
- The keyboard can be customized extensively once the basic setup works
