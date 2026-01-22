# iOS Keyboard Extension Setup Guide

This guide explains how to add the IssieKeyboard extension to the iOS project.

## Files Created

The following files have been created for the keyboard extension:

1. `ios/IssieBoard/KeyboardViewController.swift` - Main keyboard view controller
2. `ios/IssieBoard/Info.plist` - Keyboard extension configuration
3. `ios/Shared/KeyboardPreferences.swift` - Shared preference manager
4. `ios/IssieBoardNG/KeyboardPreferencesModule.swift` - React Native bridge (Swift)
5. `ios/IssieBoardNG/KeyboardPreferencesModule.m` - React Native bridge (Objective-C)

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
   - Product Name: `IssieBoard`
   - Team: Select your development team
   - Organization Identifier: Use the same as your main app
   - Bundle Identifier: Should be `org.reactjs.native.example.IssieBoardNG.IssieBoard`
   - Language: Swift
6. Click "Finish"
7. When asked to activate the scheme, click "Activate"

### Step 3: Replace Generated Files

Xcode will generate some template files. Replace them with our custom files:

1. Delete the generated `KeyboardViewController.swift` and `Info.plist` from the IssieBoard group in Xcode
2. Right-click the IssieBoard group and select "Add Files to IssieBoardNG"
3. Navigate to and select:
   - `ios/IssieBoard/KeyboardViewController.swift`
   - `ios/IssieBoard/Info.plist`
4. Make sure "Copy items if needed" is **unchecked** (we want to reference the existing files)
5. Make sure the IssieBoard target is selected
6. Click "Add"

### Alternative: Manual Target Configuration

If you prefer to manually configure the target instead of using Xcode's wizard:

1. Click "+" to add a new target
2. Select "Custom Keyboard Extension" template
3. After creation, configure the following in Build Settings:
   - Product Bundle Identifier: `org.reactjs.native.example.IssieBoardNG.IssieBoard`
   - Deployment Target: iOS 15.1 or higher
   - Swift Version: 5.0
4. Add the Swift files to the target's "Compile Sources" build phase
5. Add the Info.plist to the target

## Step 4: Enable App Groups for Preference Sharing

To share preferences between the main app and keyboard extension, you need to enable App Groups:

### For Main App (IssieBoardNG):
1. Select the IssieBoardNG target in Xcode
2. Go to "Signing & Capabilities" tab
3. Click "+ Capability"
4. Add "App Groups"
5. Click "+" under App Groups
6. Enter: `group.org.reactjs.native.example.IssieBoardNG`
7. Make sure the checkbox is checked

### For Keyboard Extension (IssieBoard):
1. Select the IssieBoard target in Xcode
2. Go to "Signing & Capabilities" tab
3. Click "+ Capability"
4. Add "App Groups"
5. Select the same App Group: `group.org.reactjs.native.example.IssieBoardNG`
6. Make sure the checkbox is checked

**IMPORTANT:** The App Group identifier must match exactly in both targets and in the code:
- Swift code: `KeyboardPreferences.appGroupIdentifier` in `Shared/KeyboardPreferences.swift`
- Format: `group.<your-bundle-identifier>`

### Add Shared Files to Both Targets

The `Shared/KeyboardPreferences.swift` file needs to be included in both targets:

1. In Xcode, select `Shared/KeyboardPreferences.swift` in the project navigator
2. In the File Inspector (right panel), under "Target Membership":
   - Check ✓ IssieBoardNG
   - Check ✓ IssieBoard
3. Do the same for any other shared Swift files

## Step 5: Configure the Main App

The main app needs to include the keyboard extension. This should already be configured when you create the extension target through Xcode.

Verify in the main app target's "General" tab that:
- The IssieBoard extension appears in "Frameworks, Libraries, and Embedded Content"

## Step 6: Build and Run

1. Select the main app scheme (IssieBoardNG)
2. Select a simulator or device
3. Build and run (Cmd+R)

## Step 7: Enable the Keyboard

On the device/simulator:

1. Open the Settings app
2. Go to General > Keyboard > Keyboards
3. Tap "Add New Keyboard"
4. Find and select "IssieBoard"
5. The keyboard should now appear in the list

## Step 8: Test the Keyboard

1. Open any app that uses the keyboard (Notes, Messages, etc.)
2. Tap on a text field
3. Tap the globe/keyboard switcher button (🌐)
4. Select "IssieBoard"
5. You should see a simple QWERTY keyboard with:
   - Three rows of letters (QWERTY layout)
   - Space bar
   - Delete button (⌫)
   - Keyboard switcher (🌐) with timestamp below
   - Timestamp showing last preference update

## Current Keyboard Features

The keyboard implementation now includes:

### UI Features:
- Basic QWERTY layout (Q-P, A-L, Z-M)
- Space bar
- Delete/backspace functionality
- Keyboard switcher to toggle between keyboards
- Simple white buttons on gray background
- Basic text input functionality

### Preference Sharing:
- Shared preferences using App Groups
- Real-time change detection (polls every 0.5 seconds)
- Profile management
- Language selection
- Keyboard configuration storage (JSON)
- React Native bridge for easy JavaScript integration

### Technical Details:
- `KeyboardPreferences` class for managing shared data
- `KeyboardPreferenceObserver` for monitoring changes
- Automatic reload when preferences change
- Debug logging for preference updates

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
