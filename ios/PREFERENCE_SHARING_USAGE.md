# iOS Keyboard Preference Sharing - Usage Guide

This guide shows how to use the keyboard preference sharing system between the React Native app and iOS keyboard extension.

## Overview

The preference sharing system uses iOS App Groups to share data between the main app and keyboard extension. Changes made in the app are automatically detected by the keyboard (polling every 0.5 seconds).

## Architecture

```
React Native App (JavaScript)
         ↓
KeyboardPreferences.ios.ts (TypeScript wrapper)
         ↓
KeyboardPreferencesModule.swift (Native bridge)
         ↓
KeyboardPreferences.swift (Shared manager)
         ↓
App Group UserDefaults
         ↓
KeyboardViewController.swift (Reads preferences)
```

## Basic Usage in React Native

### Import the Module

```typescript
import KeyboardPreferences from './src/native/KeyboardPreferences';
```

### Set Current Profile

```typescript
// Set the active profile
const result = await KeyboardPreferences.setCurrentProfile('multilingual');
console.log('Profile set:', result);
// Output: { success: true, profile: 'multilingual' }
```

### Set Keyboard Configuration

```typescript
// Load your keyboard configuration
const keyboardConfig = {
  layouts: {
    english: { /* ... */ },
    hebrew: { /* ... */ },
    arabic: { /* ... */ }
  },
  currentLayout: 'english'
};

// Save to shared preferences
await KeyboardPreferences.setKeyboardConfigObject(keyboardConfig);
```

### Set Selected Language

```typescript
await KeyboardPreferences.setSelectedLanguage('he');
```

### Read Current Settings

```typescript
const profile = await KeyboardPreferences.getCurrentProfile();
const language = await KeyboardPreferences.getSelectedLanguage();
const config = await KeyboardPreferences.getKeyboardConfigObject();

console.log('Current settings:', { profile, language, config });
```

### Debug Information

```typescript
const info = await KeyboardPreferences.printAllPreferences();
console.log('Preference info:', info);
// Output: {
//   appGroup: 'group.org.reactjs.native.example.IssieBoardNG',
//   currentProfile: 'multilingual',
//   selectedLanguage: 'he',
//   lastUpdateTime: 1705920123.456,
//   hasConfig: true
// }
```

## Complete Example: Keyboard Settings Screen

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, Button, ActivityIndicator } from 'react-native';
import KeyboardPreferences from './src/native/KeyboardPreferences';

export default function KeyboardSettings() {
  const [loading, setLoading] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<string | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const profile = await KeyboardPreferences.getCurrentProfile();
      const language = await KeyboardPreferences.getSelectedLanguage();
      
      setCurrentProfile(profile);
      setCurrentLanguage(language);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectProfile = async (profileName: string) => {
    setLoading(true);
    try {
      // Load the profile configuration
      const profileData = require(`./profiles/${profileName}.json`);
      
      // Save profile name
      await KeyboardPreferences.setCurrentProfile(profileName);
      
      // Save profile configuration
      await KeyboardPreferences.setProfileObject(profileData, profileName);
      
      // Update UI
      setCurrentProfile(profileName);
      
      console.log(`✅ Profile '${profileName}' activated`);
    } catch (error) {
      console.error('Failed to set profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectLanguage = async (languageCode: string) => {
    setLoading(true);
    try {
      // Load the keyboard configuration for this language
      const keyboardData = require(`./keyboards/${languageCode}.json`);
      
      // Save language
      await KeyboardPreferences.setSelectedLanguage(languageCode);
      
      // Save keyboard configuration
      await KeyboardPreferences.setKeyboardConfigObject(keyboardData);
      
      // Update UI
      setCurrentLanguage(languageCode);
      
      console.log(`✅ Language '${languageCode}' selected`);
    } catch (error) {
      console.error('Failed to set language:', error);
    } finally {
      setLoading(false);
    }
  };

  const testPreferences = async () => {
    const info = await KeyboardPreferences.printAllPreferences();
    console.log('Current preferences:', info);
    alert(JSON.stringify(info, null, 2));
  };

  if (loading) {
    return <ActivityIndicator size="large" />;
  }

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 18, marginBottom: 10 }}>
        Current Profile: {currentProfile || 'None'}
      </Text>
      <Text style={{ fontSize: 18, marginBottom: 20 }}>
        Current Language: {currentLanguage || 'None'}
      </Text>

      <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>
        Select Profile:
      </Text>
      <Button title="Default Profile" onPress={() => selectProfile('default')} />
      <Button title="Multilingual Profile" onPress={() => selectProfile('multilingual')} />

      <Text style={{ fontSize: 16, fontWeight: 'bold', marginTop: 20, marginBottom: 10 }}>
        Select Language:
      </Text>
      <Button title="English" onPress={() => selectLanguage('en')} />
      <Button title="Hebrew" onPress={() => selectLanguage('he')} />
      <Button title="Arabic" onPress={() => selectLanguage('ar')} />

      <View style={{ marginTop: 30 }}>
        <Button title="Debug: Show All Preferences" onPress={testPreferences} />
      </View>
    </View>
  );
}
```

## How the Keyboard Extension Receives Updates

The keyboard extension automatically monitors for changes:

```swift
// In KeyboardViewController.swift

override func viewDidLoad() {
    super.viewDidLoad()
    
    // Start observing preferences
    startObservingPreferences()
}

func startObservingPreferences() {
    preferenceObserver = KeyboardPreferenceObserver(preferences: preferences) { [weak self] in
        // This is called automatically when preferences change
        print("🔔 Preferences changed!")
        self?.loadPreferences()
        self?.updateKeyboardLayout()
    }
    
    // Poll for changes every 0.5 seconds
    preferenceObserver?.startObserving(interval: 0.5)
}
```

## Testing the Integration

1. **Open Xcode Console**: Keep Xcode open and monitor the console for debug messages

2. **In the React Native app**, change a preference:
   ```typescript
   await KeyboardPreferences.setCurrentProfile('multilingual');
   ```

3. **Switch to the keyboard** in any app (Notes, Messages, etc.)

4. **Watch the Xcode console** - you should see:
   ```
   🔄 Preferences changed at 2024-01-22 09:45:23
   📱 Keyboard Preferences:
     App Group: group.org.reactjs.native.example.IssieBoardNG
     Current Profile: multilingual
     Selected Language: he
     Last Update: 2024-01-22 09:45:23
   ```

5. **The keyboard updates** - Within 0.5 seconds, the keyboard will reload with new settings

## Performance Considerations

- **Polling Interval**: Currently set to 0.5 seconds. Adjust in `startObservingPreferences()` if needed
- **JSON Size**: Keep keyboard configurations reasonably sized (< 100KB recommended)
- **Battery Impact**: Minimal - polling only happens when keyboard is visible

## Debugging Tips

### Check if App Groups is Enabled

```typescript
const appGroup = await KeyboardPreferences.getAppGroupIdentifier();
console.log('App Group:', appGroup);
// Should output: group.org.reactjs.native.example.IssieBoardNG
```

### Verify Preferences are Saved

```typescript
const info = await KeyboardPreferences.printAllPreferences();
console.log('Has config:', info.hasConfig);
console.log('Last update:', new Date(info.lastUpdateTime * 1000));
```

### Clear All Preferences (for testing)

```typescript
await KeyboardPreferences.clearAll();
console.log('All preferences cleared');
```

## Common Issues

### Preferences Not Updating in Keyboard

1. Check that App Groups is enabled in both targets
2. Verify the App Group identifier matches in code and Xcode capabilities
3. Check Xcode console for error messages
4. Try cleaning and rebuilding (Cmd+Shift+K)

### Module Not Found in React Native

1. Make sure you imported from the correct path:
   ```typescript
   import KeyboardPreferences from './src/native/KeyboardPreferences';
   ```
2. The `.ios.ts` extension is automatically selected on iOS
3. Rebuild the iOS app after adding native modules

### Keyboard Doesn't Reload Automatically

1. Check that `startObservingPreferences()` is called in `viewDidLoad()`
2. Verify the polling interval isn't too long
3. Check Xcode console for observer messages
4. Make sure the keyboard extension has the shared file in its target

## Next Steps

- Implement full JSON keyboard configuration parsing in Swift
- Add more granular change notifications (specific setting changed)
- Create a settings UI in React Native
- Add visual feedback in keyboard when preferences update
- Implement caching to reduce JSON parsing overhead
