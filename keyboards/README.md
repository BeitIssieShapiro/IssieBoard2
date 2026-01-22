# Keyboard Configuration Structure

This directory contains the new modular keyboard configuration system.

## Directory Structure

```
keyboards/          # Individual keyboard definitions (language-specific)
  en.json          # English keyboard
  he.json          # Hebrew keyboard
  ar.json          # Arabic keyboard
  
profiles/          # Profile configurations (combine keyboards + styling)
  default.json     # Default profile (English only)
  multilingual.json # Multi-language profile (EN/HE/AR)
```

## Keyboard Files (`keyboards/*.json`)

Each keyboard file contains ONLY the key layouts for a specific language, without any global properties or styling groups.

### Structure:
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
            ...
          ]
        }
      ]
    }
  ]
}
```

### Key Properties:
- `value`: Text to insert (required)
- `caption`: Text displayed on key (optional, defaults to value)
- `sValue`: Text to insert when shift is active (optional)
- `sCaption`: Text displayed when shift is active (optional)
- `type`: Special key types (shift, backspace, enter, keyset, settings, close, language)
- `width`: Button width in units (default 1)
- `offset`: Left spacing before key
- `hidden`: Occupies space but invisible
- `label`: Legacy property (caption takes priority)
- `keysetValue`: For keyset type, which keyset to switch to
- `color`: Text color (can be overridden by profile groups)
- `bgColor`: Background color (can be overridden by profile groups)

### Special Key Types:
- `shift`: Toggle uppercase/lowercase
- `backspace`: Delete character
- `enter`: Submit/newline (adapts to input context)
- `keyset`: Switch between keysets (abc, 123, #+=)
- `settings`: Open keyboard settings
- `close`: Hide keyboard
- `language`: Switch between keyboards/languages (cycles through all keyboards in profile)

## Profile Files (`profiles/*.json`)

Profiles combine one or more keyboards with global properties and styling groups.

### Structure:
```json
{
  "id": "default",
  "name": "Default Profile",
  "version": "1.0.0",
  "keyboards": ["en"],
  "defaultKeyboard": "en",
  "defaultKeyset": "abc",
  "backgroundColor": "#E0E0E0",
  "systemRow": {
    "enabled": true,
    "keys": [...]
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

### Profile Properties:
- `id`: Unique identifier for the profile
- `name`: Display name
- `version`: Version string
- `keyboards`: Array of keyboard IDs to include
- `defaultKeyboard`: Which keyboard to show initially
- `defaultKeyset`: Which keyset to show initially
- `backgroundColor`: Background color for the keyboard
- `systemRow`: System keys (settings, backspace, enter, close)
- `groups`: Styling groups that apply to matching keys

## Groups

Groups allow you to apply consistent styling to sets of keys across all keyboards in the profile.

### Example:
```json
{
  "name": "vowels",
  "items": ["a", "e", "i", "o", "u"],
  "template": {
    "color": "#000000",
    "bgColor": "#B3E5FC",
    "width": 1.0
  }
}
```

Keys that match the group's items will inherit the template properties. Individual keys can override group properties.

## Benefits of This Structure

1. **Separation of Concerns**: Keyboards contain only layouts, profiles contain styling
2. **Reusability**: Same keyboard can be used in multiple profiles with different styling
3. **Easy to Add Languages**: Just create a new keyboard file
4. **Profile Flexibility**: Create profiles for different use cases (default, multilingual, themed, etc.)
5. **No Duplication**: Global properties and groups defined once in profile
6. **Maintainability**: Each file is focused and easy to understand

## Adding a New Keyboard

1. Create a new file in `keyboards/` (e.g., `fr.json` for French)
2. Define the keyboard structure with keysets and rows
3. Add the keyboard ID to a profile's `keyboards` array
4. Keys will automatically inherit styling from the profile's groups

## Adding a New Profile

1. Create a new file in `profiles/` (e.g., `dark-theme.json`)
2. Specify which keyboards to include
3. Define global properties (backgroundColor, etc.)
4. Define groups for consistent key styling
5. Optionally customize the system row
