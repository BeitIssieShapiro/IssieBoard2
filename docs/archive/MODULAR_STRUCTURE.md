# Modular Keyboard Configuration System

## Overview

The keyboard configuration has been restructured into a modular system that separates:
- **Keyboards** (language-specific layouts)
- **Profiles** (styling and keyboard combinations)

## File Structure

```
keyboards/
├── README.md           # Documentation
├── en.json            # English keyboard
├── he.json            # Hebrew keyboard
└── ar.json            # Arabic keyboard

profiles/
├── default.json       # Default profile (English only)
└── multilingual.json  # Multi-language profile (EN/HE/AR)

App.tsx                # Updated to load modular configs
```

## Key Benefits

### 1. Separation of Concerns
- **Keyboards** contain ONLY key layouts (no styling, no global props)
- **Profiles** contain styling, global properties, and groups
- Clean separation makes maintenance easier

### 2. Reusability
- Same keyboard can be used in multiple profiles with different styling
- Example: English keyboard in both "default" and "multilingual" profiles

### 3. Easy Language Addition
- Create one JSON file in `keyboards/`
- Add keyboard ID to profile's `keyboards` array
- Automatically inherits profile's styling

### 4. Profile Flexibility
- Create profiles for different use cases:
  - Single language (default)
  - Multiple languages (multilingual)
  - Themed versions (dark, light, colorful)
  - Special purposes (coding, emoji, etc.)

### 5. No Duplication
- Global properties defined once in profile
- Groups apply styling across all keyboards
- System row defined once, applied to all

## How It Works

### 1. Keyboard Files (`keyboards/*.json`)

Pure layout definition, no styling:

```json
{
  "id": "en",
  "name": "English",
  "keysets": [
    {
      "id": "abc",
      "rows": [
        {
          "keys": [
            { "value": "q", "sValue": "Q" },
            { "value": "w", "sValue": "W" }
          ]
        }
      ]
    }
  ]
}
```

### 2. Profile Files (`profiles/*.json`)

Global configuration + styling:

```json
{
  "id": "default",
  "name": "Default Profile",
  "keyboards": ["en"],
  "defaultKeyboard": "en",
  "defaultKeyset": "abc",
  "backgroundColor": "#E0E0E0",
  "systemRow": {
    "enabled": true,
    "keys": [
      { "type": "settings" },
      { "type": "backspace", "width": 1.5 },
      { "type": "enter" },
      { "type": "close" }
    ]
  },
  "groups": [
    {
      "name": "letters",
      "items": ["a", "b", "c", ...],
      "template": {
        "color": "#000000",
        "bgColor": "#FFFFFF"
      }
    }
  ]
}
```

### 3. Configuration Merging

App.tsx merges profile + keyboards:

```typescript
const buildConfiguration = (profile) => {
  const config = {
    backgroundColor: profile.backgroundColor,
    defaultKeyset: profile.defaultKeyset,
    keysets: [],
    groups: profile.groups,
  };

  // Load each keyboard
  for (const keyboardId of profile.keyboards) {
    const keyboard = KEYBOARDS[keyboardId];
    
    // Add system row to each keyset
    const keysets = keyboard.keysets.map(keyset => ({
      ...keyset,
      rows: [
        { keys: profile.systemRow.keys }, // System row
        ...keyset.rows,                    // Keyboard rows
      ],
    }));
    
    config.keysets.push(...keysets);
  }

  return config;
};
```

### 4. Result

Final configuration sent to Android:

```json
{
  "backgroundColor": "#E0E0E0",
  "defaultKeyset": "abc",
  "keysets": [
    {
      "id": "abc",
      "rows": [
        {
          "keys": [
            { "type": "settings" },
            { "type": "backspace", "width": 1.5 },
            { "type": "enter" },
            { "type": "close" }
          ]
        },
        {
          "keys": [
            { "value": "q", "sValue": "Q" },
            ...
          ]
        }
      ]
    }
  ],
  "groups": [...]
}
```

## Usage in App

### Profile Selection
Users can switch between profiles in the app:
- **Default**: English only
- **Multilingual**: English, Hebrew, Arabic

### Advanced Editing
Users can still manually edit the generated JSON for custom configurations.

## Adding New Content

### Add a New Language

1. Create `keyboards/fr.json`:
```json
{
  "id": "fr",
  "name": "French",
  "keysets": [...]
}
```

2. Add to `App.tsx`:
```typescript
import frKeyboard from './keyboards/fr.json';

const KEYBOARDS = {
  'en': enKeyboard,
  'he': heKeyboard,
  'ar': arKeyboard,
  'fr': frKeyboard,  // Add here
};
```

3. Add to a profile:
```json
{
  "keyboards": ["en", "fr"]
}
```

### Add a New Profile

1. Create `profiles/custom.json`:
```json
{
  "id": "custom",
  "name": "Custom Profile",
  "keyboards": ["en", "he"],
  "groups": [...]
}
```

2. Import in `App.tsx`:
```typescript
import customProfile from './profiles/custom.json';

const PROFILES = {
  'default': defaultProfile,
  'multilingual': multilingualProfile,
  'custom': customProfile,  // Add here
};
```

## Migration from Old System

### Old System
- Single large YAML/JSON file
- Everything mixed together
- Hard to maintain
- Lots of duplication

### New System
- Separate files for keyboards and profiles
- Clean separation of concerns
- Easy to maintain
- No duplication

### Migration Steps
1. Extract keyboard layouts to `keyboards/`
2. Extract global props/groups to `profiles/`
3. Update imports in `App.tsx`
4. Test with both profiles

## Future Enhancements

1. **Dynamic Loading**: Load keyboards/profiles from external URLs
2. **User-Created Profiles**: Allow users to create profiles in the app
3. **Theme Store**: Share and download community profiles
4. **Keyboard Variants**: QWERTY, DVORAK, AZERTY layouts
5. **Smart Groups**: Auto-detect character types for grouping
