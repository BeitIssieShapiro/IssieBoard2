# Structural Keyboard Templates Design

**Date**: 2026-03-19
**Status**: Draft

## Problem

Keyboard layout definitions have inconsistent structural key placement across languages and keysets:

- Enter is missing from 123/#+= keysets on large-screen
- Arabic enter has no mobile/large-screen differentiation (bug)
- English has duplicate alwaysInclude backspace keys (one per variant)
- `showOn` filters are sprinkled inconsistently across language files
- Structural keys (backspace, enter, shift, space, settings, close, next-keyboard, nikkud) are duplicated in every language file
- Adding a new language requires copying structural keys correctly, which is error-prone
- Build defaults (heightPreset, keyGap, fontWeight, fontSize) are single values that cannot differ between mobile and large-screen

## Solution

Combine two approaches:

1. **Common bottom row** (Option A): Move the bottom row to `common.js` so it's defined once
2. **Structural key injection** (Option C): Define structural keys as templates that the build script injects into every keyset

Additionally:
- Produce **two explicit variants** per keyset (mobile and large-screen) instead of using per-key `showOn` filtering
- Support **per-variant build defaults** for heightPreset, keyGap, fontWeight, fontSize

## Design

### Language File Structure

Language files become pure letter layouts with a config block. No structural keys, no `showOn`, no `alwaysInclude`.

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
  "diacritics": {},
  "keysets": [
    {
      "id": "abc",
      "rows": [
        { "keys": [{ "value": "ק" }, { "value": "ר" }, "...letter keys only..."] },
        { "keys": ["...letter keys only..."] },
        { "keys": ["...letter keys only..."] }
      ]
    }
  ]
}
```

Key properties:
- `labels.abcLabel`: Label for the keyset-toggle button returning to abc (e.g., "אבג", "ABC", "أبج")
- `labels.symbolsLabel`: Label for the keyset-toggle button going to 123 (typically "123")
- `labels.spaceCaption`: Caption shown on space bar (e.g., "" for empty, "مسافة" for Arabic)
- `includeKeysets`: Explicit list of common keysets to include (remains explicit, not automatic)
- Letter rows contain only letter/character keys - no backspace, enter, shift, space, or other structural keys
- Hidden spacer keys for letter alignment may remain in letter rows if needed

#### Variant-Specific Content Rows

Some languages have content keys (not structural) that differ between mobile and large-screen. For example, Hebrew has comma/period keys only on large-screen row 1, and different hidden spacer widths per variant.

Language files can define variant-specific content rows using a `mobileRows`/`largeRows` override alongside `rows`:

```json
{
  "id": "abc",
  "rows": [
    { "keys": ["...default/shared letter keys..."] }
  ],
  "mobileRows": {
    "0": { "keys": ["...mobile-specific row 0..."] }
  },
  "largeRows": {
    "0": { "keys": ["...large-specific row 0 with comma/period..."] }
  }
}
```

If `mobileRows`/`largeRows` provide an override for a row index, that override is used for that variant. Otherwise the row from `rows` is used. This replaces per-key `showOn` for content differences.

### Structural Templates in `common.js`

Two declarative placement templates define where structural keys go:

```js
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
        { value: ".", sValue: "،", forLanguages: ["ar"] },
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

  // Symbol keysets - pure symbols, no structural keys
  keysets: [
    {
      id: "123",
      rows: [
        { keys: ["...number keys..."] },
        { keys: ["...symbol keys with forLanguages for RTL variants..."] },
        { keys: [
          { type: "keyset", keysetValue: "#+=", returnKeysetValue: "123",
            label: "#+=", returnKeysetLabel: "123", width: 1.5 },
          { value: "." }, { value: "," },
          { value: "?", forLanguages: ["he", "en"] },
          { value: "؟", forLanguages: ["ar"] },
          { value: "!" }, { value: "'" }
        ]}
      ]
    },
    {
      id: "#+=",
      rows: ["...same pattern as 123..."]
    }
  ]
}
```

#### Key template features:

- **`ifHasDiacritics: true`**: Build script checks if the language file has a `diacritics` block. If yes, the nikkud key is included. More extensible than hardcoded `forLanguages` — adding a new language with diacritics automatically gets the nikkud key.
- **`forLanguages`**: Used for language-specific content keys in templates (shift for English, comma/period for English/Arabic, @).
- **`showForField`**: Preserved for field-type-conditional keys (@ for email fields). This is a runtime filter, not a build-time filter — it passes through to the output JSON and the native renderer handles it.

#### Layout simplification

The current language files contain hidden spacer keys in bottom rows for visual alignment on large-screen (e.g., `{ hidden: true, width: 0.5 }` in Hebrew/English bottom rows). These spacers are **intentionally dropped** in the new templates. With two explicit variants, each layout can be tuned directly without alignment hacks. If specific spacing is needed, it can be added to the structural template.

### Per-Variant Build Defaults

The build script configuration constants become per-variant:

```js
const DEFAULTS = {
  mobile: {
    heightPreset: 'tall',       // compact, normal, tall, x-tall
    keyGap: 3,                  // points between keys
    fontWeight: 'heavy',
    fontSize: null,             // null = native default (48pt)
  },
  large: {
    heightPreset: 'normal',
    keyGap: 4,
    fontWeight: 'heavy',
    fontSize: null,
  }
};
```

The build script emits these defaults into the output config per variant. The native renderer reads defaults from the active variant's config. This allows:
- Shorter keys on tablets (where there's more screen space)
- Wider gaps on tablets (keys are larger, more room)
- Different font sizes per form factor

The output JSON includes these at the top level, alongside variant keysets:

```json
{
  "heightPreset": "tall",
  "heightPreset_large": "normal",
  "keyGap": 3,
  "keyGap_large": 4,
  "fontWeight": "heavy",
  "fontWeight_large": "heavy",
  "keysets": [...]
}
```

The native renderer picks the `_large` suffixed value when on a large-screen device, falling back to the base value if the suffixed key doesn't exist.

### Placement Rule Semantics

Row references are resolved relative to the keyset's **content rows** (before bottomRow is added):

| Reference | Resolves to |
|-----------|-------------|
| `firstRow` | Row index 0 |
| `secondRow` | Row index 1 |
| `lastRow` | Last row (index = rows.length - 1) |

Operations:
- `prepend`: Keys added to the **start** of the resolved row
- `append`: Keys added to the **end** of the resolved row

Rules:
- `forLanguages` filtering applies to injected keys, same as existing symbol key filtering
- If a row reference exceeds the keyset's row count, that injection rule is skipped
- Row injections apply to **all** keysets (abc, 123, #+=). For example, on large-screen, the 123 keyset gets backspace appended to its first row (numbers) and enter appended to its second row (symbols).
- If `firstRow` and `lastRow` resolve to the same row (e.g., a 1-row keyset), both prepend and append rules apply to that single row

### Build Script Pipeline

For each language, for each keyset (abc from language + included common keysets), the build script runs:

```
1. Start with content rows
   - abc: letter rows from language file
   - 123/#+=: symbol rows from common.js
2. Filter forLanguages on content keys (existing logic)
3. For EACH variant (mobile, large):
   a. Select content rows for this variant:
      - Check for mobileRows/largeRows overrides in keyset definition
      - For each row index, use the override if present, otherwise use the base row
   b. Clone selected content rows
   c. Apply row injections (firstRow/secondRow/lastRow prepend/append)
      - Filter forLanguages on injected structural keys
      - Filter ifHasDiacritics (check language's diacritics block)
      - Skip injection rules that reference rows beyond the keyset's row count
   d. Build bottomRow from template
      - Filter forLanguages
      - Filter ifHasDiacritics
      - Resolve keyset-toggle buttons (see Keyset Toggle Resolution below)
      - Resolve space: set caption from labels.spaceCaption
   e. Append bottomRow as final row
   f. Emit keyset with ID: base ID for mobile, base ID + "_large" for large
4. Emit per-variant defaults (heightPreset, keyGap, etc.) into output config
```

### Keyset Toggle Resolution

The `{ type: "keyset" }` entries in templates are placeholders. The build script resolves them based on context:

#### In bottomRow of abc keyset:

| Variant | Position | keysetValue | label | returnKeysetValue | returnKeysetLabel |
|---------|----------|-------------|-------|-------------------|-------------------|
| mobile | first keyset button | `123` | `labels.symbolsLabel` | `abc` | `labels.abcLabel` |
| large | first keyset button | `123_large` | `labels.symbolsLabel` | `abc_large` | `labels.abcLabel` |
| large | second keyset button | `123_large` | `labels.symbolsLabel` | `abc_large` | `labels.abcLabel` |

#### In bottomRow of 123 keyset:

| Variant | Position | keysetValue | label | returnKeysetValue | returnKeysetLabel |
|---------|----------|-------------|-------|-------------------|-------------------|
| mobile | first keyset button | `abc` | `labels.abcLabel` | `123` | `labels.symbolsLabel` |
| large | first keyset button | `abc_large` | `labels.abcLabel` | `123_large` | `labels.symbolsLabel` |
| large | second keyset button | `abc_large` | `labels.abcLabel` | `123_large` | `labels.symbolsLabel` |

#### In bottomRow of #+= keyset:

Same as 123, but returnKeysetValue/returnKeysetLabel reference #+= instead of 123.

#### Keyset toggle buttons in content rows (e.g., 123's row 3 pointing to #+=):

These are defined in `common.js` symbol keysets with explicit `keysetValue`/`returnKeysetValue`. The build script suffixes these with `_large` when emitting the large variant:
- Mobile: `keysetValue: "#+=", returnKeysetValue: "123"` (unchanged)
- Large: `keysetValue: "#+=_large", returnKeysetValue: "123_large"` (suffixed)

### Output Format

Each source keyset produces two output keysets:

```json
{
  "heightPreset": "tall",
  "heightPreset_large": "normal",
  "keyGap": 3,
  "keyGap_large": 4,
  "fontWeight": "heavy",
  "keysets": [
    { "id": "abc", "rows": ["...mobile variant..."] },
    { "id": "abc_large", "rows": ["...large-screen variant..."] },
    { "id": "123", "rows": ["...mobile variant..."] },
    { "id": "123_large", "rows": ["...large-screen variant..."] },
    { "id": "#+=", "rows": ["...mobile variant..."] },
    { "id": "#+=_large", "rows": ["...large-screen variant..."] }
  ]
}
```

No `showOn` property in any output key. No `alwaysInclude` property. All variant differences are captured by having separate keysets.

#### Combined Android Config

The combined `default_config.json` for Android merges all languages. With variants, keyset IDs become doubly-prefixed:

```
he_abc, he_abc_large, he_123, he_123_large, he_#+=, he_#+=_large,
en_abc, en_abc_large, en_123, en_123_large, en_#+=, en_#+=_large,
ar_abc, ar_abc_large, ar_123, ar_123_large, ar_#+=, ar_#+=_large
```

The `prefixKeysetReferences()` function is updated to also handle `_large` suffixed references: if a keysetValue ends with `_large`, the language prefix is inserted before the base ID (e.g., `123_large` -> `he_123_large`).

Per-variant defaults are emitted once in the combined config (not per-language).

### Native Renderer Changes

Both `KeyboardRenderer.swift` (iOS) and `KeyboardRenderer.kt` (Android) need updates:

1. On startup, detect if device is phone or tablet/large-screen
2. When looking up a keyset by ID, append `_large` suffix if large-screen device
3. Fallback to base ID if `_large` variant doesn't exist (backward compatibility)
4. When reading config defaults (heightPreset, keyGap, etc.), check for `_large` suffixed key first if large-screen, fall back to base key

No changes to `KeyboardConfigParser` on either platform - keysets remain arrays of rows with keys.

The `showOn` property remains in the parser/model code for backward compatibility with user-saved configs that may still contain it. Newly generated configs will not include `showOn`.

### React Native Configurator

`src/utils/keyboardConfigMerger.ts` must be updated to match the new build logic. This file duplicates the build script's merging logic for runtime use in the configurator preview.

## Files Changed

| File | Change |
|------|--------|
| `keyboards/common.js` | Add `structural` templates, clean up symbol keyset rows |
| `keyboards/common.d.ts` | Add `structural` type definitions, add `ifHasDiacritics` to key type |
| `keyboards/en.json` | Remove bottom row, showOn, alwaysInclude; add labels block; letter rows only |
| `keyboards/he.json` | Same + add mobileRows/largeRows for variant-specific content (comma/period, spacers) |
| `keyboards/ar.json` | Same as en.json; fix: enter normalized to mobile-only (matching he/en behavior) |
| `scripts/build_keyboard_configs.js` | Replace alwaysInclude logic with structural injection pipeline; emit two variants per keyset; per-variant defaults; update combined Android config |
| `src/utils/keyboardConfigMerger.ts` | Update to match new build logic |
| `ios/Shared/KeyboardRenderer.swift` | Detect device type, select keyset variant by suffix, read per-variant defaults |
| `android/.../shared/KeyboardRenderer.kt` | Same variant selection logic (ported from iOS) |

## What Gets Removed

- `alwaysInclude` property on rows and keys
- `showOn` property on keys (from generated configs; parser code retained for backward compat)
- `findAlwaysIncludeRow()`, `findAlwaysIncludeKeys()`, `applyAlwaysIncludeKeys()` in build script
- `transformKeysetButtonForTarget()` in build script
- Duplicated structural keys across language files
- Hidden spacer keys in bottom rows (intentional layout simplification)

## What Gets Added

- `structural` template in `common.js` with mobile/large variants
- `ifHasDiacritics` condition for nikkud key inclusion
- `labels` block in each language file
- `mobileRows`/`largeRows` override mechanism for variant-specific content
- Per-variant build defaults (heightPreset, keyGap, fontWeight, fontSize)
- Variant-aware keyset ID resolution in build script
- Device type detection + variant suffix in native renderers

## Backward Compatibility

- Output JSON schema is unchanged - just more keysets with `_large` suffix and `_large` suffixed defaults
- Native parsers don't need schema changes; `showOn` remains in model for old configs
- If a config without `_large` variants is loaded (old config), renderer falls back to base keyset ID and base defaults
- No crash path for old configs

## Out of Scope

### Ordered keyboard variants (`*_ordered.json`)

The `he_ordered.json`, `en_ordered.json`, and `ar_ordered.json` files are fully self-contained keyboards -- they define their own 123/#+= keysets inline with no `includeKeysets`. These files are **out of scope** for this refactoring.

The build script retains the existing code path for self-contained keyboards (those without `includeKeysets` or with inline keysets). The `_ordered` files will continue to work as-is. They can be migrated to the template system in a follow-up if desired.

### Other exclusions

- Diacritics system changes
- Word suggestion/prediction changes
- New keys or features
- This is a pure refactoring of layout structure (plus per-variant defaults)

## Risk Areas

- **keyboardConfigMerger.ts**: Must stay in sync with build script logic, otherwise configurator preview diverges from native keyboards
- **Keyset toggle navigation**: Build script must emit correct variant-aware keysetValue per variant (see resolution tables above)
- **Arabic enter normalization**: Current Arabic behavior shows enter on both mobile and large-screen. This refactoring normalizes it to mobile-only (enter) + large-screen (close), matching Hebrew and English. Verify this is acceptable.
