# Diacritics System Specification

## Overview

This document specifies the data model for handling diacritics (Hebrew nikkud, Arabic tashkeel) in IssieBoardNG. The design allows:

1. **Keyboard-level definition** of all available diacritics
2. **Profile-level customization** of which diacritics to show/hide
3. **Runtime generation** of letter+diacritic combinations
4. **Support for exceptions** (letter-specific diacritics)

---

## Data Model

### Keyboard Definition

Each keyboard JSON file contains a `diacritics` object:

```json
{
  "id": "he",
  "name": "Hebrew",
  "diacritics": {
    "items": [...],
    "modifier": {...}
  },
  "keysets": [...]
}
```

#### Diacritic Item

Each item in the `items` array represents a diacritic mark:

```typescript
interface DiacriticItem {
  id: string;           // Unique identifier (e.g., "kamatz", "patach")
  mark: string;         // Unicode combining mark or replacement character
  name: string;         // Display name in the keyboard's language
  onlyFor?: string[];   // If present, only show for these letters
  excludeFor?: string[]; // If present, don't show for these letters
  isReplacement?: boolean; // If true, replaces the letter entirely
}
```

| Property | Required | Description |
|----------|----------|-------------|
| `id` | Yes | Unique identifier, used in profile's `hidden` array |
| `mark` | Yes | The diacritic mark (Unicode combining character) |
| `name` | Yes | Localized display name |
| `onlyFor` | No | Array of letters this diacritic applies to exclusively |
| `excludeFor` | No | Array of letters this diacritic should NOT appear for |
| `isReplacement` | No | If true, the mark replaces the base letter entirely |

#### Modifiers

The optional `modifiers` array contains marks that can combine with diacritics. Each modifier can be either:
1. **Simple toggle** (no options) - On/Off, like dagesh
2. **Multi-option** (with options array) - None + N options, like shin/sin dot

```typescript
interface DiacriticModifier {
  id: string;           // Unique identifier (e.g., "dagesh", "shinSin")
  mark?: string;        // Unicode combining mark (for simple toggle)
  name: string;         // Display name
  appliesTo?: string[]; // If present, only applies to these letters
  excludeFor?: string[]; // If present, doesn't apply to these letters
  options?: DiacriticModifierOption[]; // If present, this is a multi-option modifier
}

interface DiacriticModifierOption {
  id: string;           // Unique identifier (e.g., "shin", "sin")
  mark: string;         // Unicode combining mark
  name: string;         // Display name
}
```

**Simple toggle modifier (dagesh):**
- Shows as single toggle button
- When ON: adds the mark to all generated options

**Multi-option modifier (shin/sin):**
- Shows N+1 buttons: "None" + one for each option
- Only one can be active at a time
- When an option is selected: adds that option's mark to all generated options

---

### Profile Definition

Profiles can customize diacritics per keyboard:

```json
{
  "id": "profile-name",
  "name": "Profile Display Name",
  "keyboards": ["he", "ar"],
  "diacritics": {
    "he": {
      "modifierEnabled": true,
      "hidden": ["shva", "kubutz"]
    },
    "ar": {
      "modifierEnabled": false,
      "hidden": ["sukun", "tanwinFath", "tanwinKasr", "tanwinDamm"]
    }
  }
}
```

#### Diacritic Settings

```typescript
interface DiacriticSettings {
  modifierEnabled?: boolean;  // Whether to show modifier combinations (default: true)
  hidden?: string[];          // Array of diacritic IDs to hide
}
```

---

## Hebrew Keyboard Example

```json
{
  "id": "he",
  "name": "Hebrew",
  "diacritics": {
    "items": [
      { "id": "plain", "mark": "", "name": "ללא" },
      { "id": "kamatz", "mark": "\u05B8", "name": "קָמָץ" },
      { "id": "patach", "mark": "\u05B7", "name": "פַּתָח" },
      { "id": "segol", "mark": "\u05B6", "name": "סֶגוֹל" },
      { "id": "tzere", "mark": "\u05B5", "name": "צֵירֵי" },
      { "id": "chirik", "mark": "\u05B4", "name": "חִירִיק" },
      { "id": "cholam", "mark": "\u05B9", "name": "חוֹלָם" },
      { "id": "kubutz", "mark": "\u05BB", "name": "קֻבּוּץ" },
      { "id": "shva", "mark": "\u05B0", "name": "שְׁוָא" },
      { "id": "cholamVav", "mark": "וֹ", "name": "חוֹלָם מָלֵא", "onlyFor": ["ו"], "isReplacement": true },
      { "id": "shuruk", "mark": "וּ", "name": "שׁוּרוּק", "onlyFor": ["ו"], "isReplacement": true },
      { "id": "shinDot", "mark": "\u05C1", "name": "שִׁין", "onlyFor": ["ש"] },
      { "id": "sinDot", "mark": "\u05C2", "name": "שׂין", "onlyFor": ["ש"] }
    ],
    "modifier": {
      "id": "dagesh",
      "mark": "\u05BC",
      "name": "דָּגֵשׁ",
      "appliesTo": ["ב", "ג", "ד", "ו", "ז", "כ", "ך", "ל", "מ", "נ", "ס", "פ", "ף", "צ", "ק", "ש", "ת"]
    }
  },
  "keysets": [...]
}
```

### Hebrew Diacritics Reference

| ID | Mark | Unicode | Name | Notes |
|----|------|---------|------|-------|
| plain | (empty) | - | ללא | No diacritic |
| kamatz | ָ | U+05B8 | קָמָץ | |
| patach | ַ | U+05B7 | פַּתָח | |
| segol | ֶ | U+05B6 | סֶגוֹל | |
| tzere | ֵ | U+05B5 | צֵירֵי | |
| chirik | ִ | U+05B4 | חִירִיק | |
| cholam | ֹ | U+05B9 | חוֹלָם | |
| kubutz | ֻ | U+05BB | קֻבּוּץ | |
| shva | ְ | U+05B0 | שְׁוָא | |
| cholamVav | וֹ | - | חוֹלָם מָלֵא | Vav only, replaces letter |
| shuruk | וּ | - | שׁוּרוּק | Vav only, replaces letter |
| shinDot | ׁ | U+05C1 | שִׁין | Shin only |
| sinDot | ׂ | U+05C2 | שׂין | Shin only |
| dagesh | ּ | U+05BC | דָּגֵשׁ | Modifier, combines with vowels |

---

## Arabic Keyboard Example

```json
{
  "id": "ar",
  "name": "Arabic",
  "diacritics": {
    "items": [
      { "id": "plain", "mark": "", "name": "بدون" },
      { "id": "fatha", "mark": "\u064E", "name": "فَتحة" },
      { "id": "kasra", "mark": "\u0650", "name": "كَسرة" },
      { "id": "damma", "mark": "\u064F", "name": "ضَمّة" },
      { "id": "sukun", "mark": "\u0652", "name": "سُكون", "excludeFor": ["ا", "ء"] },
      { "id": "tanwinFath", "mark": "\u064B", "name": "تنوين فتح" },
      { "id": "tanwinKasr", "mark": "\u064D", "name": "تنوين كسر", "excludeFor": ["ة", "ى"] },
      { "id": "tanwinDamm", "mark": "\u064C", "name": "تنوين ضم", "excludeFor": ["ة", "ى"] },
      { "id": "hamzaAbove", "mark": "أ", "name": "همزة فوق", "onlyFor": ["ا"], "isReplacement": true },
      { "id": "hamzaBelow", "mark": "إ", "name": "همزة تحت", "onlyFor": ["ا"], "isReplacement": true },
      { "id": "madda", "mark": "آ", "name": "مدّة", "onlyFor": ["ا"], "isReplacement": true },
      { "id": "wasla", "mark": "ٱ", "name": "وصلة", "onlyFor": ["ا"], "isReplacement": true }
    ],
    "modifier": {
      "id": "shadda",
      "mark": "\u0651",
      "name": "شَدّة",
      "excludeFor": ["ا", "ء", "ؤ", "ة", "ى"]
    }
  },
  "keysets": [...]
}
```

### Arabic Diacritics Reference

| ID | Mark | Unicode | Name | Notes |
|----|------|---------|------|-------|
| plain | (empty) | - | بدون | No diacritic |
| fatha | َ | U+064E | فَتحة | |
| kasra | ِ | U+0650 | كَسرة | |
| damma | ُ | U+064F | ضَمّة | |
| sukun | ْ | U+0652 | سُكون | Not for alef, hamza |
| tanwinFath | ً | U+064B | تنوين فتح | |
| tanwinKasr | ٍ | U+064D | تنوين كسر | Not for ta marbuta, alef maqsura |
| tanwinDamm | ٌ | U+064C | تنوين ضم | Not for ta marbuta, alef maqsura |
| hamzaAbove | أ | - | همزة فوق | Alef only, replaces letter |
| hamzaBelow | إ | - | همزة تحت | Alef only, replaces letter |
| madda | آ | - | مدّة | Alef only, replaces letter |
| wasla | ٱ | - | وصلة | Alef only, replaces letter |
| shadda | ّ | U+0651 | شَدّة | Modifier, not for some letters |

---

## Runtime Generation Algorithm

```typescript
function getDiacriticsForKey(
  letter: string,
  keyboard: KeyboardDefinition,
  profileSettings: DiacriticSettings
): DiacriticOption[] {
  const diacritics = keyboard.diacritics;
  if (!diacritics) return [];
  
  const hidden = profileSettings?.hidden ?? [];
  const modifierEnabled = profileSettings?.modifierEnabled ?? true;
  
  const result: DiacriticOption[] = [];
  
  for (const item of diacritics.items) {
    // Skip if hidden in profile
    if (hidden.includes(item.id)) continue;
    
    // Skip if not applicable to this letter
    if (item.onlyFor && !item.onlyFor.includes(letter)) continue;
    if (item.excludeFor?.includes(letter)) continue;
    
    // Determine the output value
    const value = item.isReplacement ? item.mark : (letter + item.mark);
    
    result.push({
      id: item.id,
      value: value,
      name: item.name
    });
    
    // Add modifier variant if applicable
    if (modifierEnabled && diacritics.modifier && !item.isReplacement && item.id !== 'plain') {
      const mod = diacritics.modifier;
      
      // Check if modifier applies to this letter
      const modifierApplies = mod.appliesTo 
        ? mod.appliesTo.includes(letter)
        : !mod.excludeFor?.includes(letter);
      
      if (modifierApplies) {
        result.push({
          id: `${item.id}+${mod.id}`,
          value: letter + mod.mark + item.mark,
          name: `${item.name} + ${mod.name}`
        });
      }
    }
  }
  
  return result;
}
```

### Generation Example

For Hebrew letter ב (bet) with default settings:

1. **Input**: letter = "ב", modifierEnabled = true, hidden = []
2. **Output**:
   - `{ id: "plain", value: "ב", name: "ללא" }`
   - `{ id: "kamatz", value: "בָ", name: "קָמָץ" }`
   - `{ id: "kamatz+dagesh", value: "בָּ", name: "קָמָץ + דָּגֵשׁ" }`
   - `{ id: "patach", value: "בַ", name: "פַּתָח" }`
   - `{ id: "patach+dagesh", value: "בַּ", name: "פַּתָח + דָּגֵשׁ" }`
   - ... (and so on for all vowels)

For Hebrew letter ו (vav):
- Includes all standard vowels
- Also includes: `{ id: "cholamVav", value: "וֹ", name: "חוֹלָם מָלֵא" }`
- Also includes: `{ id: "shuruk", value: "וּ", name: "שׁוּרוּק" }`

---

## Key Simplification

With this model, keys in the keyboard JSON no longer need explicit `nikkud` arrays:

**Before (current):**
```json
{
  "value": "ק",
  "nikkud": [
    { "value": "ק" },
    { "value": "קָ" },
    { "value": "קַ" },
    ...
  ]
}
```

**After (new):**
```json
{
  "value": "ק"
}
```

The diacritics are generated at runtime based on the keyboard's `diacritics` definition and the profile's settings.

---

## Migration Notes

### Backward Compatibility

During the transition, the renderer should:
1. Check if the key has an explicit `nikkud` array → use it directly
2. Otherwise, generate diacritics from the keyboard's `diacritics` definition

### Migration Steps

1. Add `diacritics` definition to keyboard JSON
2. Update profile schema to support `diacritics` settings
3. Update native renderers (iOS, Android) to generate diacritics at runtime
4. Gradually remove explicit `nikkud` arrays from keys
5. Remove backward compatibility code once migration is complete

---

## Implementation Checklist

- [x] Update `types.ts` with TypeScript interfaces
- [x] Update `keyboards/he.json` with diacritics definition
- [x] Update `keyboards/ar.json` with diacritics definition
- [x] Update `src/screens/EditorScreen.tsx` - propagate diacritics in buildConfiguration
- [x] Update `src/screens/LegacyConfigScreen.tsx` - propagate diacritics in buildConfiguration
- [ ] Update `profiles/*.json` schema
- [x] Update iOS `KeyboardModels.swift`
- [x] Update iOS `KeyboardRenderer.swift` (with modifier toggle)
- [ ] Update Android `KeyboardModels.kt`
- [ ] Update Android `KeyboardConfigParser.kt`
- [ ] Update Android `SimpleKeyboardService.kt`
- [ ] Add UI for profile diacritics settings

---

## TODO / Future Improvements

### Shin/Sin as Second Modifier

Currently, `shinDot` (שׁ) and `sinDot` (שׂ) are implemented as items with `onlyFor: ["ש"]`. However, linguistically they behave more like a **second modifier** specific to the letter Shin - similar to how dagesh is a modifier that combines with vowels.

**Current implementation:**
```json
{ "id": "shinDot", "mark": "\u05C1", "name": "שִׁין", "onlyFor": ["ש"] },
{ "id": "sinDot", "mark": "\u05C2", "name": "שׂין", "onlyFor": ["ש"] }
```

**Proposed improvement:**
The data model should support letter-specific modifiers. For Shin, the user should be able to:
1. Choose shin (שׁ) vs sin (שׂ) - mutually exclusive
2. Then choose vowel (kamatz, patach, etc.)
3. Then optionally add dagesh

This would require:
- Extending the data model to support multiple modifiers
- Letter-specific modifier definitions (e.g., `modifiers` array instead of single `modifier`)
- UI changes to show multiple toggle buttons or a segmented control for Shin

**Example new structure:**
```json
"modifiers": [
  {
    "id": "dagesh",
    "mark": "\u05BC",
    "name": "דָּגֵשׁ",
    "appliesTo": ["ב", "ג", "ד", "ו", "ז", "כ", "ך", "ל", "מ", "נ", "ס", "פ", "ף", "צ", "ק", "ש", "ת"]
  },
  {
    "id": "shinSin",
    "name": "שין/שׂין",
    "appliesTo": ["ש"],
    "options": [
      { "id": "shin", "mark": "\u05C1", "name": "שִׁין" },
      { "id": "sin", "mark": "\u05C2", "name": "שׂין" }
    ]
  }
]
```

This would allow for proper handling of complex letter variants while keeping the UI simple.
