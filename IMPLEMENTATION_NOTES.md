# Implementation Notes - Keyboard Enhancements

## Overview

IssieBoardNG now supports a fully configurable keyboard with special keys, custom layouts, and styling options. The keyboard is configured via YAML in the React Native settings UI and rendered natively on Android.

## Key Features Implemented

### 1. Special Key Types

Keys can now have a `type` property that defines their behavior without needing explicit values:

#### Available Special Types:
- **`backspace`**: Deletes the character before the cursor
  - Default label: ⌫
  - Action: `deleteSurroundingText(1, 0)`
  
- **`enter`**: Performs the editor action (submit/new line)
  - Default label: ↵
  - Action: `performEditorAction(EditorInfo.IME_ACTION_DONE)`
  
- **`shift`**: Toggle case (placeholder for future implementation)
  - Default label: ⇧
  - Action: Currently logs to debug (TODO: implement case switching)
  
- **`settings`**: Opens the React Native configuration UI
  - Default label: ⚙️
  - Action: Launches MainActivity with Intent
  
- **`close`**: Hides the keyboard
  - Default label: ✕
  - Action: `requestHideSelf(0)`

### 2. Key Properties

Each key in the configuration supports the following properties:

#### Required for Regular Keys:
- **`label`**: The text displayed on the key (optional if type is specified)
- **`value`**: The text to insert when pressed (not needed for special types)

#### Optional Properties:
- **`type`**: Special key type (backspace, enter, shift, settings, close)
- **`width`**: Button width in relative units (default: 1.0)
  - Examples: 0.5, 1.0, 1.5, 2.0, 5.0
  - All keys in a row share proportional space based on their width values
  
- **`offset`**: Left spacing before the key (same units as width, default: 0.0)
  - Creates empty space to the left of the key
  - Useful for centering rows or creating custom layouts
  
- **`hidden`**: Boolean to hide the key while maintaining its space (default: false)
  - The key's width is still accounted for in the layout
  - Useful for alignment and spacing
  
- **`color`**: Text color in hex format (e.g., "#FF0000")
  - Applied to the button's text
  
- **`bgColor`**: Background color in hex format (e.g., "#00FF00")
  - Applied to the button's background

### 3. Configuration Examples

#### Basic Special Key:
```yaml
- { type: "backspace" }
```

#### Custom Width:
```yaml
- { type: "backspace", width: 1.5 }
```

#### Custom Styling:
```yaml
- { label: "A", value: "a", color: "#FFFFFF", bgColor: "#007AFF" }
```

#### Hidden Spacer:
```yaml
- { hidden: true, width: 0.5 }
```

#### With Offset:
```yaml
- { label: "A", value: "a", offset: 0.5 }
```

#### Override Default Label:
```yaml
- { type: "backspace", label: "DEL", width: 2 }
```

### 4. Complete Layout Example

```yaml
backgroundColor: "#E0E0E0"
rows:
  # System row
  - keys:
      - { type: "settings" }
      - { type: "backspace", width: 1.5 }
      - { type: "enter" }
      - { type: "close" }
  
  # Letter row with custom width space bar
  - keys:
      - { label: "Q", value: "q" }
      - { label: "W", value: "w" }
      - { label: "SPACE", value: " ", width: 3 }
      - { label: "P", value: "p" }
  
  # Row with offset (indented)
  - keys:
      - { hidden: true, width: 0.5 }
      - { label: "A", value: "a" }
      - { label: "S", value: "s" }
  
  # Row with custom colors
  - keys:
      - { label: "1", value: "1", bgColor: "#FF6B6B", color: "#FFFFFF" }
      - { label: "2", value: "2", bgColor: "#4ECDC4", color: "#FFFFFF" }
```

## Technical Implementation

### Files Modified:
1. **`android/app/src/main/java/com/issieboardng/SimpleKeyboardService.kt`**
   - Added `getKeyBehavior()` method to handle special key types
   - Enhanced key rendering to support width, offset, hidden, and color properties
   - Removed hardcoded system row (now configured via YAML)

2. **`App.tsx`**
   - Updated default YAML template with comprehensive examples
   - Added documentation comments for all features

### Key Rendering Logic:
1. Parse key properties from JSON config
2. Add offset spacer if needed
3. Determine label and action based on type (or use explicit label/value)
4. Render button with custom width and colors, or invisible spacer if hidden
5. Attach appropriate click handler

### Special Key Behavior:
- Special keys automatically get default labels if none specified
- The `value` property is ignored for special key types
- Custom labels can override defaults (e.g., "DEL" instead of "⌫")

## Testing

To test the implementation:
1. Build and install the app on Android device/emulator
2. Enable IssieBoardNG in Android settings
3. Open the app and edit the YAML configuration
4. Try various combinations:
   - Different widths (0.5, 1, 1.5, 2, etc.)
   - Hidden keys for spacing
   - Offset for row indentation
   - Custom colors (color and bgColor)
   - All special key types
5. Save and test in a text field

## Future Enhancements

### Planned:
- Implement shift key functionality (uppercase/lowercase toggling)
- Long-press actions (e.g., hold backspace to delete words)
- Multiple keyboard layouts (letters, numbers, symbols)
- Key press feedback (haptic, sound)
- Swipe gestures
- Dynamic key sizing based on content

### Potential:
- Themes (predefined color schemes)
- Key borders and shadows
- Font size customization
- Row height configuration
- Rounded corners for keys
- Icons instead of text labels
