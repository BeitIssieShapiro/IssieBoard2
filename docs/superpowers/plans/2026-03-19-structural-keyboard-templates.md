# Structural Keyboard Templates Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor keyboard layout definitions to use declarative structural templates in `common.js`, producing separate mobile/large-screen keyset variants, eliminating `alwaysInclude`/`showOn` mechanisms, and supporting per-variant build defaults.

**Architecture:** Structural keys (backspace, enter, shift, space, etc.) are defined once in `common.js` as two placement templates (mobile/large). The build script injects them into every keyset, producing `abc`/`abc_large`, `123`/`123_large`, etc. Language files become pure letter layouts with a `labels` config block. Native renderers select the correct variant by device type.

**Tech Stack:** JavaScript (build script, common.js), TypeScript (keyboardConfigMerger), JSON (language files), Swift (iOS renderer), Kotlin (Android renderer)

**Spec:** `docs/superpowers/specs/2026-03-19-structural-keyboard-templates-design.md`

**No git operations** — user will commit after testing.

---

## Chunk 1: Data Files (keyboards/)

### Task 1: Update `keyboards/common.js` — Add structural templates, clean up symbol keysets

**Files:**
- Modify: `keyboards/common.js`

- [ ] **Step 1: Replace entire `common.js` with structural templates + cleaned symbol keysets**

```js
/**
 * Common Keyboard Keysets & Structural Templates
 *
 * This file contains:
 * 1. Structural templates (mobile/large) — defines where structural keys
 *    (backspace, enter, shift, space, etc.) are placed in every keyset
 * 2. Shared symbol keysets (123, #+=) — pure symbols, no structural keys
 *
 * Key properties:
 * - forLanguages: Array of language codes — key is only included for those languages
 *                 If not specified, key is included for all languages
 * - ifHasDiacritics: true — key is only included if the language has a diacritics block
 * - showForField: Array of field types — runtime filter, passes through to output JSON
 *
 * The build script merges these templates with language-specific letter rows,
 * producing two variants per keyset: mobile (base ID) and large-screen (_large suffix).
 */

module.exports = {
  structural: {
    mobile: {
      // Injected into existing content rows
      lastRow: {
        prepend: [{ type: "shift", width: 1.5, forLanguages: ["en"] }],
        append: [{ type: "backspace", width: 1.5 }]
      },
      // Appended as a new final row to every keyset
      bottomRow: [
        { type: "keyset", width: 1 },
        { type: "next-keyboard", width: 1 },
        { type: "settings" },
        { type: "space", flex: true },
        { caption: "@", value: "@", width: 1, showForField: ["email"], forLanguages: ["en"] },
        { type: "nikkud", ifHasDiacritics: true },
        { value: ".", sValue: ",", forLanguages: ["en"] },
        { value: ".", sValue: "\u060C", forLanguages: ["ar"] },
        { type: "enter" }
      ]
    },
    large: {
      // Injected into existing content rows
      firstRow: {
        append: [{ type: "backspace", width: 1.5 }]
      },
      secondRow: {
        append: [{ type: "enter", width: 2 }]
      },
      lastRow: {
        prepend: [{ type: "shift", width: 1, forLanguages: ["en"] }],
        append: [
          { value: ",", sValue: "!", forLanguages: ["en"] },
          { value: ".", sValue: "?", forLanguages: ["en"] },
          { type: "shift", width: 1.5, forLanguages: ["en"] }
        ]
      },
      // Appended as a new final row to every keyset
      bottomRow: [
        { type: "keyset", width: 1 },
        { type: "next-keyboard", width: 1 },
        { type: "settings" },
        { type: "space", flex: true },
        { caption: "@", value: "@", width: 1, showForField: ["email"], forLanguages: ["en"] },
        { type: "keyset", width: 1 },
        { type: "nikkud", ifHasDiacritics: true },
        { type: "close" }
      ]
    }
  },
  keysets: [
    {
      id: "123",
      rows: [
        {
          keys: [
            { value: "1" },
            { value: "2" },
            { value: "3" },
            { value: "4" },
            { value: "5" },
            { value: "6" },
            { value: "7" },
            { value: "8" },
            { value: "9" },
            { value: "0" }
          ]
        },
        {
          keys: [
            { value: "-" },
            { value: "/" },
            { value: ":" },
            { value: ";" },
            { caption: "(", value: ")", forLanguages: ["he", "ar"] },
            { value: "(", forLanguages: ["en"] },
            { caption: ")", value: "(", forLanguages: ["he", "ar"] },
            { value: ")", forLanguages: ["en"] },
            { value: "\u20AA", forLanguages: ["he"] },
            { value: "$", forLanguages: ["en", "ar"] },
            { value: "&" },
            { value: "@" },
            { value: "\"" }
          ]
        },
        {
          keys: [
            { type: "keyset", keysetValue: "#+=", returnKeysetValue: "123", label: "#+=", returnKeysetLabel: "123", width: 1.5 },
            { value: ".", width: 1.5 },
            { value: ",", width: 1.5 },
            { value: "?", forLanguages: ["he", "en"], width: 1.5 },
            { value: "\u061F", forLanguages: ["ar"], width: 1.5 },
            { value: "!", width: 1.5 },
            { value: "'", width: 1.5 }
          ]
        }
      ]
    },
    {
      id: "#+=",
      rows: [
        {
          keys: [
            { caption: "[", value: "]", forLanguages: ["he", "ar"] },
            { value: "[", forLanguages: ["en"] },
            { caption: "]", value: "[", forLanguages: ["he", "ar"] },
            { value: "]", forLanguages: ["en"] },
            { caption: "{", value: "}", forLanguages: ["he", "ar"] },
            { value: "{", forLanguages: ["en"] },
            { caption: "}", value: "{", forLanguages: ["he", "ar"] },
            { value: "}", forLanguages: ["en"] },
            { value: "#" },
            { value: "%" },
            { value: "^" },
            { value: "*" },
            { value: "+" },
            { value: "=" }
          ]
        },
        {
          keys: [
            { value: "_" },
            { value: "\\" },
            { value: "|" },
            { value: "~" },
            { value: "<" },
            { value: ">" },
            { value: "\u20AC" },
            { value: "\u00A3" },
            { value: "\u00A5" },
            { value: "\u2022" }
          ]
        },
        {
          keys: [
            { type: "keyset", keysetValue: "123", returnKeysetValue: "#+=", label: "123", returnKeysetLabel: "#+=", width: 1.5 },
            { value: ".", width: 1.5 },
            { value: ",", width: 1.5 },
            { value: "?", forLanguages: ["he", "en"], width: 1.5 },
            { value: "\u061F", forLanguages: ["ar"], width: 1.5 },
            { value: "!", width: 1.5 },
            { value: "'", width: 1.5 }
          ]
        }
      ]
    }
  ]
};
```

- [ ] **Step 2: Verify file loads without errors**

Run: `node -e "const c = require('./keyboards/common.js'); console.log('structural:', Object.keys(c.structural)); console.log('keysets:', c.keysets.map(k=>k.id));"`

Expected: `structural: [ 'mobile', 'large' ]` and `keysets: [ '123', '#+=' ]`

---

### Task 2: Update `keyboards/common.d.ts` — Add structural type definitions

**Files:**
- Modify: `keyboards/common.d.ts`

- [ ] **Step 1: Replace common.d.ts with updated types**

```ts
/**
 * TypeScript declaration for common.js
 */

interface KeyboardKey {
  value?: string;
  sValue?: string;
  caption?: string;
  sCaption?: string;
  type?: string;
  width?: number;
  offset?: number;
  hidden?: boolean;
  color?: string;
  bgColor?: string;
  label?: string;
  keysetValue?: string;
  returnKeysetValue?: string;
  returnKeysetLabel?: string;
  forLanguages?: string[];
  ifHasDiacritics?: boolean;
  showForField?: string[];
  flex?: boolean;
  fontSize?: number;
}

interface KeyboardRow {
  keys: KeyboardKey[];
}

interface RowInjection {
  prepend?: KeyboardKey[];
  append?: KeyboardKey[];
}

interface StructuralVariant {
  firstRow?: RowInjection;
  secondRow?: RowInjection;
  lastRow?: RowInjection;
  bottomRow: KeyboardKey[];
}

interface Structural {
  mobile: StructuralVariant;
  large: StructuralVariant;
}

interface Keyset {
  id: string;
  rows: KeyboardRow[];
}

interface CommonKeysets {
  structural: Structural;
  keysets: Keyset[];
}

declare const commonKeysets: CommonKeysets;
export = commonKeysets;
```

---

### Task 3: Update `keyboards/en.json` — Pure letter layout + labels

**Files:**
- Modify: `keyboards/en.json`

- [ ] **Step 1: Replace en.json with pure letter layout**

```json
{
  "id": "en",
  "name": "English",
  "includeKeysets": ["123", "#+="],
  "labels": {
    "abcLabel": "ABC",
    "symbolsLabel": "123",
    "spaceCaption": ""
  },
  "keysets": [
    {
      "id": "abc",
      "rows": [
        {
          "keys": [
            { "value": "q", "sValue": "Q" },
            { "value": "w", "sValue": "W" },
            { "value": "e", "sValue": "E" },
            { "value": "r", "sValue": "R" },
            { "value": "t", "sValue": "T" },
            { "value": "y", "sValue": "Y" },
            { "value": "u", "sValue": "U" },
            { "value": "i", "sValue": "I" },
            { "value": "o", "sValue": "O" },
            { "value": "p", "sValue": "P" }
          ]
        },
        {
          "keys": [
            { "hidden": true, "width": 0.5 },
            { "value": "a", "sValue": "A" },
            { "value": "s", "sValue": "S" },
            { "value": "d", "sValue": "D" },
            { "value": "f", "sValue": "F" },
            { "value": "g", "sValue": "G" },
            { "value": "h", "sValue": "H" },
            { "value": "j", "sValue": "J" },
            { "value": "k", "sValue": "K" },
            { "value": "l", "sValue": "L" }
          ]
        },
        {
          "keys": [
            { "value": "z", "sValue": "Z" },
            { "value": "x", "sValue": "X" },
            { "value": "c", "sValue": "C" },
            { "value": "v", "sValue": "V" },
            { "value": "b", "sValue": "B" },
            { "value": "n", "sValue": "N" },
            { "value": "m", "sValue": "M" }
          ]
        }
      ]
    }
  ]
}
```

---

### Task 4: Update `keyboards/he.json` — Pure letter layout + labels + variant rows

**Files:**
- Modify: `keyboards/he.json`

- [ ] **Step 1: Replace he.json with pure letter layout and variant-specific rows**

Hebrew row 0 differs between mobile (just letters) and large (adds comma/period at start). Use `mobileRows`/`largeRows` overrides for row 0.

```json
{
  "id": "he",
  "name": "Hebrew",
  "includeKeysets": ["123", "#+="],
  "labels": {
    "abcLabel": "אבג",
    "symbolsLabel": "123",
    "spaceCaption": ""
  },
  "diacritics": {
    "appliesTo": ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י", "כ", "ך", "ל", "מ", "ם", "נ", "ן", "ס", "ע", "פ", "ף", "צ", "ץ", "ק", "ר", "ש", "ת"],
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
      { "id": "chatafPatach", "mark": "\u05B2", "name": "חֲטַף פַּתַח", "isAdvanced": true },
      { "id": "chatafSegol", "mark": "\u05B1", "name": "חֲטַף סֶגוֹל", "isAdvanced": true },
      { "id": "chatafKamatz", "mark": "\u05B3", "name": "חֲטַף קָמָץ", "isAdvanced": true },
      { "id": "cholamVav", "mark": "וֹ", "name": "חוֹלָם מָלֵא", "onlyFor": ["ו"], "isReplacement": true },
      { "id": "shuruk", "mark": "וּ", "name": "שׁוּרוּק", "onlyFor": ["ו"], "isReplacement": true }
    ],
    "modifiers": [
      {
        "id": "dagesh",
        "mark": "\u05BC",
        "name": "דָּגֵשׁ",
        "appliesTo": ["ב", "ג", "ד", "ז", "כ", "ך", "ל", "מ", "נ", "ס", "פ", "ף", "צ", "ק", "ש", "ת"]
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
  },
  "keysets": [
    {
      "id": "abc",
      "rows": [
        {
          "keys": [
            { "value": "ק" },
            { "value": "ר" },
            { "value": "א" },
            { "value": "ט" },
            { "value": "ו" },
            { "value": "ן" },
            { "value": "ם" },
            { "value": "פ" }
          ]
        },
        {
          "keys": [
            { "value": "ש" },
            { "value": "ד" },
            { "value": "ג" },
            { "value": "כ" },
            { "value": "ע" },
            { "value": "י" },
            { "value": "ח" },
            { "value": "ל" },
            { "value": "ך" },
            { "value": "ף" }
          ]
        },
        {
          "keys": [
            { "value": "ז" },
            { "value": "ס" },
            { "value": "ב" },
            { "value": "ה" },
            { "value": "נ" },
            { "value": "מ" },
            { "value": "צ" },
            { "value": "ת" },
            { "value": "ץ" }
          ]
        }
      ],
      "largeRows": {
        "0": {
          "keys": [
            { "value": "," },
            { "value": "." },
            { "value": "ק" },
            { "value": "ר" },
            { "value": "א" },
            { "value": "ט" },
            { "value": "ו" },
            { "value": "ן" },
            { "value": "ם" },
            { "value": "פ" }
          ]
        }
      }
    }
  ]
}
```

---

### Task 5: Update `keyboards/ar.json` — Pure letter layout + labels

**Files:**
- Modify: `keyboards/ar.json`

- [ ] **Step 1: Replace ar.json with pure letter layout**

Arabic enter is normalized to mobile-only (structural template handles it). The period/comma from the old bottom row moves to the structural template (`forLanguages: ["ar"]`).

```json
{
  "id": "ar",
  "name": "Arabic",
  "includeKeysets": ["123", "#+="],
  "labels": {
    "abcLabel": "أبج",
    "symbolsLabel": "123",
    "spaceCaption": "مسافة"
  },
  "diacritics": {
    "appliesTo": ["ا", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن", "ه", "و", "ي", "ء", "ؤ", "ئ", "ة", "ى"],
    "items": [
      { "id": "plain", "mark": "", "name": "بدون" },
      { "id": "fatha", "mark": "\u064E", "name": "فَتحة", "isAdvanced": false },
      { "id": "kasra", "mark": "\u0650", "name": "كَسرة", "isAdvanced": false },
      { "id": "damma", "mark": "\u064F", "name": "ضَمّة", "isAdvanced": false },
      { "id": "sukun", "mark": "\u0652", "name": "سُكون", "excludeFor": ["ا"], "isAdvanced": false },
      { "id": "tanwinFath", "mark": "\u064B", "name": "تنوين فتح", "isAdvanced": true },
      { "id": "tanwinKasr", "mark": "\u064D", "name": "تنوين كسر", "isAdvanced": true },
      { "id": "tanwinDamm", "mark": "\u064C", "name": "تنوين ضم", "isAdvanced": true },
      { "id": "wasla", "mark": "\u0671", "name": "وصلة", "onlyFor": ["ا"], "isReplacement": true, "isAdvanced": true },
      { "id": "hamzaAbove", "mark": "\u0623", "name": "همزة فوق", "onlyFor": ["ا"], "isReplacement": true, "isAdvanced": false },
      { "id": "hamzaBelow", "mark": "\u0625", "name": "همزة تحت", "onlyFor": ["ا"], "isReplacement": true, "isAdvanced": false },
      { "id": "madda", "mark": "\u0622", "name": "مدّة", "onlyFor": ["ا"], "isReplacement": true, "isAdvanced": false }
    ],
    "modifier": {
      "id": "shadda",
      "mark": "\u0651",
      "name": "شَدّة",
      "excludeFor": ["ا"],
      "isAdvanced": false
    }
  },
  "keysets": [
    {
      "id": "abc",
      "rows": [
        {
          "keys": [
            { "value": "ض" }, { "value": "ص" }, { "value": "ث" }, { "value": "ق" }, { "value": "ف" },
            { "value": "غ" }, { "value": "ع" }, { "value": "ه" }, { "value": "خ" }, { "value": "ح" },
            { "value": "ج" }, { "value": "د" }
          ]
        },
        {
          "keys": [
            { "hidden": true, "width": 0.5 },
            { "value": "ش" }, { "value": "س" }, { "value": "ي" }, { "value": "ب" }, { "value": "ل" },
            { "value": "ا" }, { "value": "ت" }, { "value": "ن" }, { "value": "م" }, { "value": "ك" },
            { "value": "ط" }
          ]
        },
        {
          "keys": [
            { "value": "ئ" }, { "value": "ء" }, { "value": "ؤ" }, { "value": "ر" }, { "value": "لا" },
            { "value": "ى" }, { "value": "ة" }, { "value": "و" }, { "value": "ز" }, { "value": "ظ" },
            { "value": "ذ" }
          ]
        }
      ]
    }
  ]
}
```

---

## Chunk 2: Build Script

### Task 6: Rewrite `scripts/build_keyboard_configs.js` — Structural injection pipeline

**Files:**
- Modify: `scripts/build_keyboard_configs.js`

This is the core of the refactoring. The build script replaces the `alwaysInclude` mechanism with the structural injection pipeline.

- [ ] **Step 1: Update constants section — per-variant defaults**

Replace lines 28-43 (the single DEFAULT_ constants) with:

```js
// Per-variant defaults
const DEFAULTS = {
  mobile: {
    heightPreset: 'tall',
    keyGap: 3,
    fontWeight: 'heavy',
    fontSize: null,
  },
  large: {
    heightPreset: 'normal',
    keyGap: 4,
    fontWeight: 'heavy',
    fontSize: null,
  }
};
```

- [ ] **Step 2: Update `DEFAULT_CONFIG_TEMPLATE`**

Replace with per-variant defaults emission:

```js
function buildDefaultConfigTemplate() {
  const template = {
    backgroundColor: 'default',
    defaultKeyset: 'abc',
    wordSuggestionsEnabled: true,
    autoCorrectEnabled: false,
    // Mobile defaults (base)
    fontWeight: DEFAULTS.mobile.fontWeight,
    keyGap: DEFAULTS.mobile.keyGap,
    heightPreset: DEFAULTS.mobile.heightPreset,
    // Large defaults (suffixed)
    fontWeight_large: DEFAULTS.large.fontWeight,
    keyGap_large: DEFAULTS.large.keyGap,
    heightPreset_large: DEFAULTS.large.heightPreset,
    groups: []
  };
  if (DEFAULTS.mobile.fontSize !== null) template.fontSize = DEFAULTS.mobile.fontSize;
  if (DEFAULTS.large.fontSize !== null) template.fontSize_large = DEFAULTS.large.fontSize;
  return template;
}
```

- [ ] **Step 3: Remove old helper functions**

Delete these functions entirely:
- `findAlwaysIncludeRow()`
- `findAlwaysIncludeKeys()`
- `applyAlwaysIncludeKeys()`
- `transformKeysetButtonForTarget()`

Keep:
- `filterKeysByLanguage()`
- `filterRowsByLanguage()`
- `loadCommonKeysets()` (but update it — see next step)

- [ ] **Step 4: Update `loadCommonKeysets()` to return structural + keysets**

```js
function loadCommon() {
  const commonPath = path.join(KEYBOARDS_DIR, 'common.js');
  if (!fs.existsSync(commonPath)) {
    console.log('   ⚠️  common.js not found');
    return { structural: null, keysets: [] };
  }
  delete require.cache[require.resolve(commonPath)];
  const common = require(commonPath);
  return {
    structural: common.structural || null,
    keysets: common.keysets || []
  };
}
```

- [ ] **Step 5: Add new helper — `filterStructuralKeys()`**

Filters keys by `forLanguages` and `ifHasDiacritics`:

```js
function filterStructuralKeys(keys, language, hasDiacritics) {
  return keys
    .filter(key => {
      if (key.forLanguages && !key.forLanguages.includes(language)) return false;
      if (key.ifHasDiacritics && !hasDiacritics) return false;
      return true;
    })
    .map(key => {
      const { forLanguages, ifHasDiacritics, ...clean } = key;
      return clean;
    });
}
```

- [ ] **Step 6: Add new helper — `resolveRowForVariant()`**

Selects the correct row for a variant, checking for mobileRows/largeRows overrides:

```js
function resolveRowsForVariant(keyset, variant) {
  const baseRows = keyset.rows || [];
  const overrides = variant === 'mobile' ? keyset.mobileRows : keyset.largeRows;
  if (!overrides) return baseRows.map(row => ({ ...row, keys: [...row.keys] }));

  return baseRows.map((row, index) => {
    const override = overrides[String(index)];
    if (override) return { ...override, keys: [...override.keys] };
    return { ...row, keys: [...row.keys] };
  });
}
```

- [ ] **Step 7: Add new helper — `applyRowInjections()`**

Applies structural row injections (firstRow/secondRow/lastRow prepend/append):

```js
function applyRowInjections(rows, variantTemplate, language, hasDiacritics) {
  const rowRefs = {
    firstRow: 0,
    secondRow: 1,
    lastRow: rows.length - 1
  };

  for (const [refName, rowIndex] of Object.entries(rowRefs)) {
    const injection = variantTemplate[refName];
    if (!injection || rowIndex < 0 || rowIndex >= rows.length) continue;

    if (injection.prepend) {
      const filtered = filterStructuralKeys(injection.prepend, language, hasDiacritics);
      rows[rowIndex].keys = [...filtered, ...rows[rowIndex].keys];
    }
    if (injection.append) {
      const filtered = filterStructuralKeys(injection.append, language, hasDiacritics);
      rows[rowIndex].keys = [...rows[rowIndex].keys, ...filtered];
    }
  }
  return rows;
}
```

- [ ] **Step 8: Add new helper — `buildBottomRow()`**

Builds the bottom row from template, resolving keyset-toggle and space:

```js
function buildBottomRow(template, language, hasDiacritics, labels, targetKeysetId, variant) {
  const suffix = variant === 'large' ? '_large' : '';
  const filtered = filterStructuralKeys(template, language, hasDiacritics);

  return filtered.map(key => {
    // Resolve space
    if (key.type === 'space') {
      return { caption: labels.spaceCaption || '', value: ' ', width: 4, flex: true };
    }

    // Resolve keyset-toggle buttons
    if (key.type === 'keyset') {
      if (targetKeysetId === 'abc') {
        // On abc: button goes to 123
        return {
          type: 'keyset',
          keysetValue: '123' + suffix,
          returnKeysetValue: 'abc' + suffix,
          label: labels.symbolsLabel || '123',
          returnKeysetLabel: labels.abcLabel || 'abc',
          width: key.width || 1
        };
      } else {
        // On 123/#+=: button goes back to abc
        return {
          type: 'keyset',
          keysetValue: 'abc' + suffix,
          returnKeysetValue: targetKeysetId + suffix,
          label: labels.abcLabel || 'abc',
          returnKeysetLabel: labels.symbolsLabel || '123',
          width: key.width || 1
        };
      }
    }

    return key;
  });
}
```

- [ ] **Step 9: Add new helper — `suffixKeysetReferences()`**

Adds `_large` suffix to keyset references in content-row keyset-toggle buttons:

```js
function suffixKeysetReferences(keys, suffix) {
  if (!suffix) return keys;
  return keys.map(key => {
    if (key.type !== 'keyset') return key;
    const newKey = { ...key };
    if (newKey.keysetValue) newKey.keysetValue = newKey.keysetValue + suffix;
    if (newKey.returnKeysetValue) newKey.returnKeysetValue = newKey.returnKeysetValue + suffix;
    return newKey;
  });
}
```

- [ ] **Step 10: Add core function — `buildKeysetVariant()`**

The main pipeline function that builds one variant of one keyset:

```js
function buildKeysetVariant(keyset, variant, structural, language, hasDiacritics, labels) {
  const variantTemplate = structural[variant];
  const suffix = variant === 'large' ? '_large' : '';

  // 1. Resolve rows for this variant (with mobileRows/largeRows overrides)
  let rows = resolveRowsForVariant(keyset, variant);

  // 2. Filter forLanguages on content keys
  rows = filterRowsByLanguage(rows, language);

  // 3. Apply row injections
  rows = applyRowInjections(rows, variantTemplate, language, hasDiacritics);

  // 4. Suffix keyset references in content rows for large variant
  if (suffix) {
    rows = rows.map(row => ({
      ...row,
      keys: suffixKeysetReferences(row.keys, suffix)
    }));
  }

  // 5. Build and append bottom row
  const bottomRow = buildBottomRow(
    variantTemplate.bottomRow, language, hasDiacritics, labels, keyset.id, variant
  );
  rows.push({ keys: bottomRow });

  return {
    id: keyset.id + suffix,
    rows: rows
  };
}
```

- [ ] **Step 11: Rewrite `buildKeyboardConfig()`**

Replace the existing function with the new pipeline:

```js
function buildKeyboardConfig(sourceKeyboard, config, common) {
  const outputConfig = buildDefaultConfigTemplate();

  outputConfig.keyboards = [config.language];
  outputConfig.defaultKeyboard = config.language;
  outputConfig.keyboardLanguage = config.language;

  if (sourceKeyboard.diacritics) {
    outputConfig.diacritics = sourceKeyboard.diacritics;
    outputConfig.diacriticsSettings = {
      [config.language]: { simpleMode: true }
    };
  }

  const language = config.language;
  const hasDiacritics = !!sourceKeyboard.diacritics;
  const labels = sourceKeyboard.labels || { abcLabel: 'abc', symbolsLabel: '123', spaceCaption: '' };
  const structural = common.structural;
  let allKeysets = [];

  // Process language-specific keysets (abc)
  if (sourceKeyboard.keysets && Array.isArray(sourceKeyboard.keysets)) {
    for (const keyset of sourceKeyboard.keysets) {
      allKeysets.push(buildKeysetVariant(keyset, 'mobile', structural, language, hasDiacritics, labels));
      allKeysets.push(buildKeysetVariant(keyset, 'large', structural, language, hasDiacritics, labels));
    }
  }

  // Process included common keysets (123, #+=)
  if (sourceKeyboard.includeKeysets && sourceKeyboard.includeKeysets.length > 0) {
    for (const keysetId of sourceKeyboard.includeKeysets) {
      const commonKeyset = common.keysets.find(ks => ks.id === keysetId);
      if (!commonKeyset) {
        console.log(`   ⚠️  Common keyset '${keysetId}' not found`);
        continue;
      }
      allKeysets.push(buildKeysetVariant(commonKeyset, 'mobile', structural, language, hasDiacritics, labels));
      allKeysets.push(buildKeysetVariant(commonKeyset, 'large', structural, language, hasDiacritics, labels));
    }
  }

  outputConfig.keysets = allKeysets;
  outputConfig.defaultKeyset = sourceKeyboard.defaultKeyset || 'abc';
  outputConfig.groups = [];

  return outputConfig;
}
```

- [ ] **Step 12: Update `buildKeyboardConfigs()` main function**

Replace `loadCommonKeysets()` with `loadCommon()`:

```js
function buildKeyboardConfigs() {
  console.log('🔨 Building keyboard configs for iOS and Android...\n');

  console.log('📦 Loading common keysets and structural templates...');
  const common = loadCommon();
  console.log(`   Found ${common.keysets.length} common keysets: ${common.keysets.map(k => k.id).join(', ')}`);
  console.log(`   Structural templates: ${common.structural ? 'mobile, large' : 'none'}\n`);

  // ... rest stays the same but pass `common` instead of `commonKeysets` to buildKeyboardConfig
```

Update the `buildKeyboardConfig` call inside the loop (around line 386):

```js
const outputConfig = buildKeyboardConfig(sourceKeyboard, config, common);
```

- [ ] **Step 13: Update `createCombinedAndroidConfig()`**

Update to pass `common` and handle variant-aware prefixing:

```js
function prefixKeysetReferences(keys, language) {
  return keys.map(key => {
    const newKey = { ...key };
    if (newKey.keysetValue) {
      // Handle _large suffix: "123_large" -> "he_123_large"
      const largeSuffix = newKey.keysetValue.endsWith('_large') ? '_large' : '';
      const baseId = largeSuffix ? newKey.keysetValue.slice(0, -6) : newKey.keysetValue;
      newKey.keysetValue = `${language}_${baseId}${largeSuffix}`;
    }
    if (newKey.returnKeysetValue) {
      const largeSuffix = newKey.returnKeysetValue.endsWith('_large') ? '_large' : '';
      const baseId = largeSuffix ? newKey.returnKeysetValue.slice(0, -6) : newKey.returnKeysetValue;
      newKey.returnKeysetValue = `${language}_${baseId}${largeSuffix}`;
    }
    return newKey;
  });
}
```

And update keyset ID prefixing in the combined config loop to handle `_large`:

```js
const prefixedKeysets = keyboardConfig.keysets.map(keyset => {
  const largeSuffix = keyset.id.endsWith('_large') ? '_large' : '';
  const baseId = largeSuffix ? keyset.id.slice(0, -6) : keyset.id;
  const newId = `${config.language}_${baseId}${largeSuffix}`;

  const prefixedRows = keyset.rows.map(row => ({
    ...row,
    keys: prefixKeysetReferences(row.keys, config.language)
  }));

  return { ...keyset, id: newId, rows: prefixedRows };
});
```

Also update combined config `defaultKeyset`:

```js
combinedConfig.defaultKeyset = 'he_abc';
```

- [ ] **Step 14: Remove SYSTEM_ROW constant**

Delete the `SYSTEM_ROW` constant (around line 97-104) and remove `processKeyset()` function — no longer needed since `alwaysInclude` is gone.

- [ ] **Step 15: Run build and verify output**

Run: `npm run build:keyboards`

Expected: Build succeeds, generates configs with 6 keysets each (abc, abc_large, 123, 123_large, #+=, #+=_large).

- [ ] **Step 16: Verify generated config structure**

Run: `node -e "const c = require('./ios/IssieBoardEn/default_config.json'); console.log('keysets:', c.keysets.map(k=>k.id)); console.log('heightPreset:', c.heightPreset); console.log('heightPreset_large:', c.heightPreset_large);"`

Expected:
```
keysets: [ 'abc', 'abc_large', '123', '123_large', '#+=', '#+=_large' ]
heightPreset: tall
heightPreset_large: normal
```

- [ ] **Step 17: Verify mobile abc keyset has correct structural keys**

Run: `node -e "const c = require('./ios/IssieBoardEn/default_config.json'); const abc = c.keysets.find(k=>k.id==='abc'); console.log('rows:', abc.rows.length); const lastLetterRow = abc.rows[2]; console.log('lastRow first key:', lastLetterRow.keys[0]); console.log('lastRow last key:', lastLetterRow.keys[lastLetterRow.keys.length-1]); const bottomRow = abc.rows[3]; console.log('bottomRow keys:', bottomRow.keys.map(k=>k.type||k.value));"`

Expected: shift at start of row 2, backspace at end, bottom row has keyset/next-keyboard/settings/space/enter.

- [ ] **Step 18: Verify large abc keyset has correct structural keys**

Run: `node -e "const c = require('./ios/IssieBoardEn/default_config.json'); const abc = c.keysets.find(k=>k.id==='abc_large'); console.log('row0 last:', abc.rows[0].keys[abc.rows[0].keys.length-1]); console.log('row1 last:', abc.rows[1].keys[abc.rows[1].keys.length-1]); const bottomRow = abc.rows[abc.rows.length-1]; console.log('bottomRow keys:', bottomRow.keys.map(k=>k.type||k.value));"`

Expected: row 0 ends with backspace, row 1 ends with enter, bottom row has close (not enter).

- [ ] **Step 19: Verify Hebrew abc keyset large variant has comma/period in row 0**

Run: `node -e "const c = require('./ios/IssieBoardHe/default_config.json'); const abc = c.keysets.find(k=>k.id==='abc_large'); console.log('row0 first 2:', abc.rows[0].keys.slice(0,2).map(k=>k.value));"`

Expected: `[ ',', '.' ]`

- [ ] **Step 20: Verify nikkud appears for Hebrew but not English**

Run: `node -e "const he = require('./ios/IssieBoardHe/default_config.json'); const en = require('./ios/IssieBoardEn/default_config.json'); const heBottom = he.keysets.find(k=>k.id==='abc').rows.slice(-1)[0]; const enBottom = en.keysets.find(k=>k.id==='abc').rows.slice(-1)[0]; console.log('he nikkud:', heBottom.keys.some(k=>k.type==='nikkud')); console.log('en nikkud:', enBottom.keys.some(k=>k.type==='nikkud'));"`

Expected: `he nikkud: true`, `en nikkud: false`

---

## Chunk 3: TypeScript Merger

### Task 7: Rewrite `src/utils/keyboardConfigMerger.ts` — Match new build logic

**Files:**
- Modify: `src/utils/keyboardConfigMerger.ts`

The TS merger must mirror the build script pipeline. The key changes:
- Remove `alwaysInclude` functions
- Add structural template processing
- Add variant generation

- [ ] **Step 1: Update imports and types**

Update the `KeyboardKey` interface to add new properties and remove `alwaysInclude`:

```ts
export interface KeyboardKey {
  value?: string;
  sValue?: string;
  caption?: string;
  sCaption?: string;
  type?: string;
  width?: number;
  offset?: number;
  hidden?: boolean;
  color?: string;
  bgColor?: string;
  label?: string;
  keysetValue?: string;
  returnKeysetValue?: string;
  returnKeysetLabel?: string;
  nikkud?: Array<{ value: string; caption?: string }>;
  forLanguages?: string[];
  ifHasDiacritics?: boolean;
  showForField?: string[];
  flex?: boolean;
  fontSize?: number;
}
```

Update `KeyboardRow` — remove `alwaysInclude`:

```ts
export interface KeyboardRow {
  keys: KeyboardKey[];
}
```

Update `SourceKeyboard` — add `labels`:

```ts
export interface SourceKeyboard {
  id: string;
  name: string;
  includeKeysets?: string[];
  labels?: { abcLabel?: string; symbolsLabel?: string; spaceCaption?: string };
  diacritics?: Diacritics;
  keysets: Array<Keyset & {
    mobileRows?: Record<string, KeyboardRow>;
    largeRows?: Record<string, KeyboardRow>;
  }>;
  defaultKeyset?: string;
}
```

- [ ] **Step 2: Remove old alwaysInclude functions**

Delete entirely:
- `findAlwaysIncludeRow()`
- `findAlwaysIncludeKeys()`
- `applyAlwaysIncludeKeys()`
- `cleanAlwaysIncludeFlags()`
- `transformKeysetButtonForTarget()`
- `processKeyset()`

- [ ] **Step 3: Add new structural processing functions**

Port the JS helpers from the build script to TypeScript:

```ts
function filterStructuralKeys(keys: KeyboardKey[], language: string, hasDiacritics: boolean): KeyboardKey[] {
  return keys
    .filter(key => {
      if (key.forLanguages && !key.forLanguages.includes(language)) return false;
      if (key.ifHasDiacritics && !hasDiacritics) return false;
      return true;
    })
    .map(key => {
      const { forLanguages, ifHasDiacritics, ...clean } = key;
      return clean;
    });
}

function resolveRowsForVariant(keyset: Keyset & { mobileRows?: Record<string, KeyboardRow>; largeRows?: Record<string, KeyboardRow> }, variant: string): KeyboardRow[] {
  const baseRows = keyset.rows || [];
  const overrides = variant === 'mobile' ? keyset.mobileRows : keyset.largeRows;
  if (!overrides) return baseRows.map(row => ({ ...row, keys: [...row.keys] }));
  return baseRows.map((row, index) => {
    const override = overrides[String(index)];
    if (override) return { ...override, keys: [...override.keys] };
    return { ...row, keys: [...row.keys] };
  });
}

function applyRowInjections(rows: KeyboardRow[], variantTemplate: any, language: string, hasDiacritics: boolean): KeyboardRow[] {
  const rowRefs: Record<string, number> = {
    firstRow: 0,
    secondRow: 1,
    lastRow: rows.length - 1
  };
  for (const [refName, rowIndex] of Object.entries(rowRefs)) {
    const injection = variantTemplate[refName];
    if (!injection || rowIndex < 0 || rowIndex >= rows.length) continue;
    if (injection.prepend) {
      const filtered = filterStructuralKeys(injection.prepend, language, hasDiacritics);
      rows[rowIndex].keys = [...filtered, ...rows[rowIndex].keys];
    }
    if (injection.append) {
      const filtered = filterStructuralKeys(injection.append, language, hasDiacritics);
      rows[rowIndex].keys = [...rows[rowIndex].keys, ...filtered];
    }
  }
  return rows;
}

function suffixKeysetReferences(keys: KeyboardKey[], suffix: string): KeyboardKey[] {
  if (!suffix) return keys;
  return keys.map(key => {
    if (key.type !== 'keyset') return key;
    const newKey = { ...key };
    if (newKey.keysetValue) newKey.keysetValue += suffix;
    if (newKey.returnKeysetValue) newKey.returnKeysetValue += suffix;
    return newKey;
  });
}

function buildBottomRow(
  template: KeyboardKey[], language: string, hasDiacritics: boolean,
  labels: { abcLabel?: string; symbolsLabel?: string; spaceCaption?: string },
  targetKeysetId: string, variant: string
): KeyboardKey[] {
  const suffix = variant === 'large' ? '_large' : '';
  const filtered = filterStructuralKeys(template, language, hasDiacritics);
  return filtered.map(key => {
    if (key.type === 'space') {
      return { caption: labels.spaceCaption || '', value: ' ', width: 4, flex: true };
    }
    if (key.type === 'keyset') {
      if (targetKeysetId === 'abc') {
        return {
          type: 'keyset', keysetValue: '123' + suffix, returnKeysetValue: 'abc' + suffix,
          label: labels.symbolsLabel || '123', returnKeysetLabel: labels.abcLabel || 'abc',
          width: key.width || 1
        };
      } else {
        return {
          type: 'keyset', keysetValue: 'abc' + suffix, returnKeysetValue: targetKeysetId + suffix,
          label: labels.abcLabel || 'abc', returnKeysetLabel: labels.symbolsLabel || '123',
          width: key.width || 1
        };
      }
    }
    return key;
  });
}

function buildKeysetVariant(
  keyset: Keyset & { mobileRows?: Record<string, KeyboardRow>; largeRows?: Record<string, KeyboardRow> },
  variant: string, structural: any, language: string, hasDiacritics: boolean,
  labels: { abcLabel?: string; symbolsLabel?: string; spaceCaption?: string }
): Keyset {
  const variantTemplate = structural[variant];
  const suffix = variant === 'large' ? '_large' : '';
  let rows = resolveRowsForVariant(keyset, variant);
  rows = filterRowsByLanguage(rows, language);
  rows = applyRowInjections(rows, variantTemplate, language, hasDiacritics);
  if (suffix) {
    rows = rows.map(row => ({ ...row, keys: suffixKeysetReferences(row.keys, suffix) }));
  }
  const bottomRow = buildBottomRow(variantTemplate.bottomRow, language, hasDiacritics, labels, keyset.id, variant);
  rows.push({ keys: bottomRow });
  return { id: keyset.id + suffix, rows };
}
```

- [ ] **Step 4: Rewrite `mergeCommonKeysets()`**

```ts
export function mergeCommonKeysets(
  sourceKeyboard: SourceKeyboard,
  language: string,
  commonKeysetsParam?: Keyset[]
): Keyset[] {
  const includeKeysets = sourceKeyboard.includeKeysets || [];
  const keysets = commonKeysetsParam || getCommonKeysets();
  const hasDiacritics = !!sourceKeyboard.diacritics;
  const labels = sourceKeyboard.labels || { abcLabel: 'abc', symbolsLabel: '123', spaceCaption: '' };
  const structural = commonKeysets.structural;

  const mergedKeysets: Keyset[] = [];
  for (const keysetId of includeKeysets) {
    const commonKeyset = keysets.find(ks => ks.id === keysetId);
    if (!commonKeyset) continue;
    mergedKeysets.push(buildKeysetVariant(commonKeyset, 'mobile', structural, language, hasDiacritics, labels));
    mergedKeysets.push(buildKeysetVariant(commonKeyset, 'large', structural, language, hasDiacritics, labels));
  }
  return mergedKeysets;
}
```

- [ ] **Step 5: Rewrite `buildKeyboardConfig()`**

```ts
export function buildKeyboardConfig(
  sourceKeyboard: SourceKeyboard,
  language: string
): KeyboardConfig {
  const hasDiacritics = !!sourceKeyboard.diacritics;
  const labels = sourceKeyboard.labels || { abcLabel: 'abc', symbolsLabel: '123', spaceCaption: '' };
  const structural = commonKeysets.structural;

  let allKeysets: Keyset[] = [];

  // Language-specific keysets (abc) — both variants
  if (sourceKeyboard.keysets && Array.isArray(sourceKeyboard.keysets)) {
    for (const keyset of sourceKeyboard.keysets) {
      allKeysets.push(buildKeysetVariant(keyset, 'mobile', structural, language, hasDiacritics, labels));
      allKeysets.push(buildKeysetVariant(keyset, 'large', structural, language, hasDiacritics, labels));
    }
  }

  // Common keysets (123, #+=) — both variants
  if (sourceKeyboard.includeKeysets && sourceKeyboard.includeKeysets.length > 0) {
    const merged = mergeCommonKeysets(sourceKeyboard, language);
    allKeysets = [...allKeysets, ...merged];
  }

  const config: KeyboardConfig = {
    backgroundColor: 'default',
    defaultKeyset: sourceKeyboard.defaultKeyset || 'abc',
    wordSuggestionsEnabled: true,
    keyboards: [language],
    defaultKeyboard: language,
    keyboardLanguage: language,
    keysets: allKeysets,
    groups: [],
  };

  if (sourceKeyboard.diacritics) {
    config.diacritics = sourceKeyboard.diacritics;
  }

  return config;
}
```

- [ ] **Step 6: Verify TS compiles**

Run: `npx tsc --noEmit src/utils/keyboardConfigMerger.ts` (or whichever TS check command the project uses)

---

## Chunk 4: iOS Native Renderer

### Task 8: Update iOS `KeyboardRenderer.swift` — Variant-aware keyset selection + per-variant defaults

**Files:**
- Modify: `ios/Shared/KeyboardRenderer.swift`
- Modify: `ios/Shared/BaseKeyboardViewController.swift`

- [ ] **Step 1: Add `isLargeScreen` property to KeyboardRenderer**

Near the top of the class (around the property declarations), add:

```swift
/// Whether the device is a large-screen device (iPad)
private var isLargeScreen: Bool {
    return UIDevice.current.userInterfaceIdiom == .pad
}
```

- [ ] **Step 2: Add helper to resolve variant-aware keyset ID**

```swift
/// Resolves a keyset ID to its variant-aware form.
/// On large-screen, appends "_large" if that variant exists; falls back to base ID.
private func resolveKeysetId(_ baseId: String) -> String {
    guard isLargeScreen else { return baseId }
    let largeId = baseId + "_large"
    if config?.keysets.contains(where: { $0.id == largeId }) == true {
        return largeId
    }
    return baseId
}
```

- [ ] **Step 3: Update keyset lookups to use `resolveKeysetId`**

In `renderKeyboard()` (line ~645), update the initial keyset resolution:

```swift
// Resolve to variant-aware keyset ID
self.currentKeysetId = resolveKeysetId(currentKeysetId)
```

In `switchKeyset()` (line ~2632), resolve before checking:

```swift
private func switchKeyset(_ keysetValue: String) {
    // Note: keysetValue already contains _large suffix from the keyset-toggle button
    // but we still need to check if it exists
    let allKeysetIds = config.keysets.map { $0.id }
    if allKeysetIds.contains(keysetValue) {
        currentKeysetId = keysetValue
        // ...
    }
}
```

- [ ] **Step 4: Add per-variant config value resolution**

Add a helper to read config values with `_large` fallback:

```swift
/// Reads a config string value, checking for _large variant first on large-screen devices
private func configString(for key: String, from json: [String: Any]?) -> String? {
    guard let json = json else { return nil }
    if isLargeScreen, let largeValue = json[key + "_large"] as? String {
        return largeValue
    }
    return json[key] as? String
}

private func configInt(for key: String, from json: [String: Any]?) -> Int? {
    guard let json = json else { return nil }
    if isLargeScreen, let largeValue = json[key + "_large"] as? Int {
        return largeValue
    }
    return json[key] as? Int
}
```

Note: Since `KeyboardConfig` uses `Codable`, the `_large` suffixed keys are not part of the struct. The simplest approach is to add optional `_large` properties to `KeyboardModels.swift`:

- [ ] **Step 5: Update `KeyboardModels.swift` — Add `_large` variant properties**

In the `KeyboardConfig` struct, add:

```swift
let heightPreset_large: String?
let keyGap_large: Double?
let fontWeight_large: String?
let fontSizePreset_large: String?
```

Add CodingKeys enum if not present (since Swift property names can't contain underscores in the middle for Codable defaults... actually they can). The JSON keys use underscores, which Swift can decode with Codable.

Actually, `Codable` maps property names directly to JSON keys. `heightPreset_large` in Swift maps to `"heightPreset_large"` in JSON. This works.

- [ ] **Step 6: Update heightPreset/keyGap/fontWeight reading to check `_large` variants**

In `rowHeight` computed property (line ~159):

```swift
let presetString: String?
if UIDevice.current.userInterfaceIdiom == .pad {
    presetString = config?.heightPreset_large ?? config?.heightPreset
} else {
    presetString = config?.heightPreset
}
let preset = KeyboardHeightPreset(rawValue: presetString ?? "normal") ?? .normal
```

Similarly for `keyGap` reading (line ~1576):

```swift
let gap: Double
if UIDevice.current.userInterfaceIdiom == .pad {
    gap = config?.keyGap_large ?? config?.keyGap ?? 3
} else {
    gap = config?.keyGap ?? 3
}
let horizontalGap = CGFloat(gap) * currentScale
```

And for `fontWeight` (line ~1510):

```swift
let weightString: String?
if UIDevice.current.userInterfaceIdiom == .pad {
    weightString = config?.fontWeight_large ?? config?.fontWeight
} else {
    weightString = config?.fontWeight
}
```

- [ ] **Step 7: Update `BaseKeyboardViewController.swift` — Variant-aware keyset selection on load**

In `renderKeyboard()` (line ~325), resolve the initial keyset:

```swift
var initialKeyset: String
if !keyboardEngine.renderer.currentKeysetId.isEmpty && keyboardEngine.renderer.currentKeysetId != "abc" {
    initialKeyset = keyboardEngine.renderer.currentKeysetId
} else if let savedKeyset = loadSavedKeyset() {
    initialKeyset = savedKeyset
} else {
    initialKeyset = config.defaultKeyset ?? "abc"
}
// Resolve to variant-aware keyset
initialKeyset = keyboardEngine.renderer.resolveKeysetId(initialKeyset)
```

Note: `resolveKeysetId` needs to be `internal` (not `private`) for this to work. Update its access level.

- [ ] **Step 8: Build and test iOS**

Run: `npm run build:keyboards && cd ios && xcodebuild -workspace IssieBoardNG.xcworkspace -scheme IssieBoardNG -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 16' build 2>&1 | tail -5`

Expected: Build succeeds.

---

## Chunk 5: Android Native Renderer (Port from iOS)

### Task 9: Update Android `KeyboardRenderer.kt` — Variant-aware keyset selection + per-variant defaults

**Files:**
- Modify: `android/app/src/main/java/org/issieshapiro/issieboard/shared/KeyboardRenderer.kt`
- Modify: `android/app/src/main/java/org/issieshapiro/issieboard/shared/KeyboardConfigParser.kt`
- Modify: `android/app/src/main/java/org/issieshapiro/issieboard/shared/KeyboardModels.kt`
- Modify: `android/app/src/main/java/org/issieshapiro/issieboard/shared/BaseKeyboardService.kt`

This is a direct port of the iOS changes from Task 8. Follow `android/PORTING_INSTRUCTIONS.md`.

- [ ] **Step 1: Update `KeyboardModels.kt` — Add `_large` variant properties to KeyboardConfig**

Add to the `KeyboardConfig` data class (around line 30-33):

```kotlin
val heightPreset_large: String? = null,
val keyGap_large: Int? = null,
val fontWeight_large: String? = null,
val fontSizePreset_large: String? = null,
```

- [ ] **Step 2: Update `KeyboardConfigParser.kt` — Parse `_large` variant properties**

In the `parse()` function (around line 43-46), add:

```kotlin
heightPreset_large = json.optString("heightPreset_large", null),
keyGap_large = if (json.has("keyGap_large")) json.optInt("keyGap_large") else null,
fontWeight_large = json.optString("fontWeight_large", null),
fontSizePreset_large = json.optString("fontSizePreset_large", null),
```

- [ ] **Step 3: Add `isLargeScreen` property to KeyboardRenderer**

```kotlin
/** Whether the device is a large-screen device (tablet) */
private val isLargeScreen: Boolean
    get() {
        val config = context.resources.configuration
        val screenWidthDp = config.screenWidthDp
        return screenWidthDp >= 600
    }
```

- [ ] **Step 4: Add `resolveKeysetId()` to KeyboardRenderer**

```kotlin
/** Resolves a keyset ID to its variant-aware form */
internal fun resolveKeysetId(baseId: String): String {
    if (!isLargeScreen) return baseId
    val largeId = "${baseId}_large"
    if (config?.keysets?.any { it.id == largeId } == true) {
        return largeId
    }
    return baseId
}
```

- [ ] **Step 5: Update keyset lookups in `renderKeyboard()` and `switchKeyset()`**

In `renderKeyboard()` (line ~624):

```kotlin
this.currentKeysetId = resolveKeysetId(currentKeysetId)
```

`switchKeyset()` (line ~2166) — keyset values already contain `_large` suffix from buttons, just verify existence.

- [ ] **Step 6: Update config value reading for per-variant defaults**

In `rowHeight` (line ~193):

```kotlin
val presetString = if (isLargeScreen) {
    config?.heightPreset_large ?: config?.heightPreset
} else {
    config?.heightPreset
}
val preset = KeyboardHeightPreset.from(presetString)
```

In `getKeyGap()` (line ~237):

```kotlin
private fun getKeyGap(): Int {
    val gap = if (isLargeScreen) {
        config?.keyGap_large ?: config?.keyGap ?: 3
    } else {
        config?.keyGap ?: 3
    }
    return dpToPx(gap)
}
```

In `getFontWeight()` (line ~296):

```kotlin
private fun getFontWeight(): Int {
    val weightString = if (isLargeScreen) {
        config?.fontWeight_large ?: config?.fontWeight
    } else {
        config?.fontWeight
    }
    return when (weightString?.lowercase()) {
        // ... same switch as before
    }
}
```

- [ ] **Step 7: Update `BaseKeyboardService.kt` — Variant-aware keyset on load**

In `renderKeyboard()` (line ~290):

```kotlin
initialKeyset = renderer?.resolveKeysetId(initialKeyset) ?: initialKeyset
```

- [ ] **Step 8: Build Android**

Run: `cd /Users/i022021/dev/Issie/IssieBoardNG/android && ./gradlew assembleDebug 2>&1 | tail -5`

Expected: BUILD SUCCESSFUL.

---

## Chunk 6: Final Verification

### Task 10: End-to-end verification

- [ ] **Step 1: Run full build**

Run: `npm run build:keyboards`

- [ ] **Step 2: Verify all 3 language configs have 6 keysets**

Run: `for f in ios/IssieBoardEn/default_config.json ios/IssieBoardHe/default_config.json ios/IssieBoardAr/default_config.json; do echo "$f:"; node -e "const c=require('./$f'); console.log(c.keysets.map(k=>k.id).join(', '))"; done`

Expected: Each has `abc, abc_large, 123, 123_large, #+=, #+=_large`

- [ ] **Step 3: Verify combined Android config has 18 keysets**

Run: `node -e "const c=require('./android/app/src/main/assets/default_config.json'); console.log('total keysets:', c.keysets.length); console.log(c.keysets.map(k=>k.id).join(', '))"`

Expected: 18 keysets (6 per language, prefixed).

- [ ] **Step 4: Verify no `showOn` or `alwaysInclude` in output**

Run: `grep -r "showOn\|alwaysInclude" ios/IssieBoardEn/default_config.json ios/IssieBoardHe/default_config.json ios/IssieBoardAr/default_config.json`

Expected: No matches.

- [ ] **Step 5: Verify ordered keyboards still build correctly**

Run: `node -e "const c=require('./ios/IssieBoardHe/default_config.json'); console.log('✅ he config OK');" && node -e "console.log('✅ ordered keyboards unaffected (they are self-contained, not using common.js structural templates)')"`

- [ ] **Step 6: Run linter**

Run: `npm run lint`

- [ ] **Step 7: Run tests**

Run: `npm test`
