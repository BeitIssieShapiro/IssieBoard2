# Nikkud (ניקוד) Implementation Plan

## Overview
Adding support for Hebrew nikkud (vowel marks) and Arabic tashkeel (diacritics) with popup selection.

## Implementation Steps

### 1. Data Structure (✅ DONE)
- Added `NikkudOption` data class
- Added `nikkud: List<NikkudOption>` to `KeyConfig`
- Added `nikkudActive: Boolean` state variable

### 2. Parsing Nikkud Data (TODO)
Update `parseKeyConfigWithColors()` to parse nikkud array from JSON:

```kotlin
// Parse nikkud options if present
val nikkudList = mutableListOf<NikkudOption>()
val nikkudArray = keyObj.optJSONArray("nikkud")
if (nikkudArray != null) {
    for (i in 0 until nikkudArray.length()) {
        val nikkudObj = nikkudArray.optJSONObject(i) ?: continue
        nikkudList.add(NikkudOption(
            value = nikkudObj.optString("value", ""),
            caption = nikkudObj.optString("caption", "")
        ))
    }
}
```

### 3. Nikkud Toggle Key (TODO)
Add to `getKeyBehavior()`:

```kotlin
"nikkud" -> createNikkudKey(label)
```

Implement `createNikkudKey()`:

```kotlin
private fun createNikkudKey(label: String): Pair<String, () -> Unit> {
    val displayLabel = if (label.isNotEmpty()) {
        label
    } else {
        if (nikkudActive) "◌ָ" else "◌"  // With/without nikkud indicator
    }
    
    val action: () -> Unit = {
        nikkudActive = !nikkudActive
        renderKeyboard()  // Re-render to show active state
    }
    return Pair(displayLabel, action)
}
```

### 4. Nikkud Background Color (TODO)
Update `getKeyBackgroundColor()`:

```kotlin
// Special handling for nikkud button when active
if (key.type.lowercase() == "nikkud" && nikkudActive) {
    return parseColor("#FFD700", Color.parseColor("#FFD700"))  // Gold when active
}
```

### 5. Regular Key with Nikkud (TODO)
Update `createRegularKey()` to handle nikkud mode:

```kotlin
private fun createRegularKey(caption: String, label: String, value: String, nikkudOptions: List<NikkudOption>): Pair<String, () -> Unit> {
    val displayLabel = when {
        caption.isNotEmpty() -> caption
        label.isNotEmpty() -> label
        value.isNotEmpty() -> value
        else -> "?"
    }
    
    val action: () -> Unit = { 
        if (nikkudActive && nikkudOptions.isNotEmpty()) {
            // Show popup with nikkud options
            showNikkudPopup(nikkudOptions)
        } else if (value.isNotEmpty()) {
            currentInputConnection?.commitText(value, 1)
            // Auto-reset shift after typing
            if (shiftState is ShiftState.Active) {
                shiftState = ShiftState.Inactive
                renderKeyboard()
            }
        }
    }
    return Pair(displayLabel, action)
}
```

### 6. Nikkud Popup (TODO)
Implement popup menu:

```kotlin
private fun showNikkudPopup(options: List<NikkudOption>) {
    val popupMenu = android.widget.PopupMenu(this, mainLayout)
    
    options.forEachIndexed { index, option ->
        popupMenu.menu.add(0, index, index, option.caption)
    }
    
    popupMenu.setOnMenuItemClickListener { menuItem ->
        val selectedOption = options[menuItem.itemId]
        currentInputConnection?.commitText(selectedOption.value, 1)
        
        // Auto-deactivate nikkud after selection
        nikkudActive = false
        renderKeyboard()
        true
    }
    
    popupMenu.show()
}
```

### 7. Update getKeyBehavior() (TODO)
Pass nikkud options to createRegularKey:

```kotlin
else -> createRegularKey(caption, label, value, key.nikkud)
```

### 8. Profile System Row (TODO)
Add nikkud key to Hebrew and Arabic keyboards:

```json
{
  "systemRow": {
    "enabled": true,
    "keys": [
      { "type": "nikkud" },
      { "type": "language" },
      { "type": "settings" },
      { "type": "backspace", "width": 1.5 },
      { "type": "enter" },
      { "type": "close" }
    ]
  }
}
```

## JSON Format for Nikkud

### Example Hebrew Key:
```json
{
  "value": "ב",
  "nikkud": [
    { "value": "בָ", "caption": "בָ" },
    { "value": "בַ", "caption": "בַ" },
    { "value": "בֶ", "caption": "בֶ" },
    { "value": "בֵ", "caption": "בֵ" },
    { "value": "בִ", "caption": "בִ" },
    { "value": "בֹ", "caption": "בֹ" },
    { "value": "בּ", "caption": "בּ" },
    { "value": "בוּ", "caption": "בוּ" }
  ]
}
```

### Example Arabic Key:
```json
{
  "value": "ب",
  "nikkud": [
    { "value": "بَ", "caption": "بَ" },
    { "value": "بِ", "caption": "بِ" },
    { "value": "بُ", "caption": "بُ" },
    { "value": "بّ", "caption": "بّ" },
    { "value": "بْ", "caption": "بْ" }
  ]
}
```

## User Experience

1. **Default Mode**: Type letters normally
2. **Tap Nikkud Button** (◌): Activates nikkud mode (button turns gold)
3. **Tap Any Letter**: Shows popup with nikkud options
4. **Select Option**: Inserts letter with nikkud, deactivates nikkud mode
5. **Tap Nikkud Again**: Deactivates without selection

## Benefits

- ✅ Non-intrusive: Only shows when needed
- ✅ Context-aware: Only for keys with nikkud defined
- ✅ Auto-deactivate: Returns to normal after selection
- ✅ Visual feedback: Button color shows active state
- ✅ Flexible: Works with any RTL language
