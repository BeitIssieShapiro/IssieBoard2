/**
 * Keyboard Config Merger
 * 
 * Shared utilities for merging keyboard configurations.
 * Used by:
 * - Build script (scripts/build_ios_keyboard_configs.js) to generate default configs
 * - Settings app to build configs when editing profiles
 * 
 * This module handles:
 * - Loading and merging common keysets with language-specific keysets
 * - Filtering keys by language (using forLanguages property)
 * - Applying alwaysInclude keys and rows
 */

// Import common keysets - this works in both Node.js and React Native
import commonKeysets from '../../keyboards/common';

// Types
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
  alwaysInclude?: boolean;
}

export interface KeyboardRow {
  keys: KeyboardKey[];
  alwaysInclude?: boolean;
}

export interface Keyset {
  id: string;
  rows: KeyboardRow[];
}

export interface DiacriticsItem {
  id: string;
  mark: string;
  name: string;
  onlyFor?: string[];
  excludeFor?: string[];
  isReplacement?: boolean;
}

export interface DiacriticsModifier {
  id: string;
  mark?: string;
  name: string;
  appliesTo?: string[];
  excludeFor?: string[];
  options?: Array<{ id: string; mark: string; name: string }>;
}

export interface Diacritics {
  appliesTo: string[];
  items: DiacriticsItem[];
  modifiers?: DiacriticsModifier[];
  modifier?: DiacriticsModifier;
}

export interface SourceKeyboard {
  id: string;
  name: string;
  includeKeysets?: string[];
  diacritics?: Diacritics;
  keysets: Keyset[];
  defaultKeyset?: string;
}

export interface KeyboardConfig {
  backgroundColor?: string;
  defaultKeyset: string;
  wordSuggestionsEnabled: boolean;
  keyboards: string[];
  defaultKeyboard: string;
  keyboardLanguage: string;
  diacritics?: Diacritics;
  keysets: Keyset[];
  groups: any[];
}

/**
 * Get common keysets from the common.js module
 */
export function getCommonKeysets(): Keyset[] {
  return commonKeysets.keysets || [];
}

/**
 * Filter keys by language
 * Keys with forLanguages array are only included if the language matches
 * Keys without forLanguages are included for all languages
 */
export function filterKeysByLanguage(keys: KeyboardKey[], language: string): KeyboardKey[] {
  return keys
    .filter(key => {
      if (!key.forLanguages) {
        return true; // No language restriction
      }
      return key.forLanguages.includes(language);
    })
    .map(key => {
      // Remove forLanguages from the output (it's build-time only)
      const { forLanguages, ...keyWithoutForLanguages } = key;
      return keyWithoutForLanguages;
    });
}

/**
 * Filter out settings button if disabled
 * When disabled, the settings button's width is added to the space key
 */
export function filterSettingsButton(keys: KeyboardKey[], settingsButtonEnabled: boolean = true): KeyboardKey[] {
  if (settingsButtonEnabled) {
    return keys;
  }
  
  // Find the settings button and space key
  const settingsKey = keys.find(key => key.type === 'settings');
  const settingsWidth = settingsKey?.width || 1;
  
  // Filter out settings button and adjust space width
  return keys.map(key => {
    // Remove settings button
    if (key.type === 'settings') {
      return null;
    }
    
    // Add settings button width to space key
    if (key.value === ' ' || key.caption === 'space' || key.caption === 'רווח' || key.caption === 'مسافة') {
      return {
        ...key,
        width: (key.width || 1) + settingsWidth,
      };
    }
    
    return key;
  }).filter((key): key is KeyboardKey => key !== null);
}

/**
 * Filter rows by language (filter keys within each row)
 */
export function filterRowsByLanguage(rows: KeyboardRow[], language: string): KeyboardRow[] {
  return rows.map(row => ({
    ...row,
    keys: filterKeysByLanguage(row.keys, language),
  }));
}

/**
 * Find the alwaysInclude row from the abc keyset
 */
export function findAlwaysIncludeRow(sourceKeyboard: SourceKeyboard): KeyboardRow | null {
  const abcKeyset = sourceKeyboard.keysets?.find(ks => ks.id === 'abc');
  if (!abcKeyset) return null;

  return abcKeyset.rows?.find(row => row.alwaysInclude === true) || null;
}

/**
 * Find alwaysInclude keys from non-alwaysInclude rows in the abc keyset
 * Returns keys that should be prepended/appended to the last content row
 */
export function findAlwaysIncludeKeys(sourceKeyboard: SourceKeyboard): {
  prependKeys: KeyboardKey[];
  appendKeys: KeyboardKey[];
} {
  const abcKeyset = sourceKeyboard.keysets?.find(ks => ks.id === 'abc');
  if (!abcKeyset) return { prependKeys: [], appendKeys: [] };

  const prependKeys: KeyboardKey[] = [];
  const appendKeys: KeyboardKey[] = [];

  (abcKeyset.rows || []).forEach(row => {
    // Skip rows that are themselves alwaysInclude
    if (row.alwaysInclude) return;

    const keys = row.keys || [];
    keys.forEach((key, keyIndex) => {
      if (key.alwaysInclude) {
        // Clone the key without the alwaysInclude property
        const { alwaysInclude, ...keyWithoutFlag } = key;

        if (keyIndex === 0) {
          // Key is first in the row - prepend to last content row
          prependKeys.push(keyWithoutFlag);
        } else if (keyIndex === keys.length - 1) {
          // Key is last in the row - append to last content row
          appendKeys.push(keyWithoutFlag);
        }
        // Keys in the middle are ignored
      }
    });
  });

  return { prependKeys, appendKeys };
}

/**
 * Apply alwaysInclude keys to a keyset's rows
 * - prependKeys: prepend to the beginning of the LAST row
 * - appendKeys: append to the end of the LAST row
 */
export function applyAlwaysIncludeKeys(
  rows: KeyboardRow[],
  prependKeys: KeyboardKey[],
  appendKeys: KeyboardKey[]
): KeyboardRow[] {
  if (rows.length === 0) return rows;

  return rows.map((row, index) => {
    // Only apply to the last row
    if (index !== rows.length - 1) {
      return row;
    }

    let newKeys = [...row.keys];

    // Prepend keys to the start
    for (const key of prependKeys) {
      newKeys = [key, ...newKeys];
    }

    // Append keys to the end
    for (const key of appendKeys) {
      newKeys = [...newKeys, key];
    }

    return {
      ...row,
      keys: newKeys,
    };
  });
}

/**
 * Clean alwaysInclude flags from keys in a row
 */
function cleanAlwaysIncludeFlags(keys: KeyboardKey[]): KeyboardKey[] {
  return keys.map(key => {
    const { alwaysInclude, ...keyWithoutFlag } = key;
    return keyWithoutFlag;
  });
}

/**
 * Transform a keyset button key for a different target keyset
 * When the alwaysInclude row's keyset button is used on a non-abc keyset (like "123" or "#+="),
 * we need to update it to point BACK to the abc keyset with the return label.
 * 
 * The original button on abc keyset has: keysetValue="123", label="123", returnKeysetValue="abc", returnKeysetLabel="אבג"
 * 
 * When copied to ANY non-abc keyset, we want:
 * - keysetValue="abc" (always return to abc)
 * - label=returnKeysetLabel (e.g., "אבג")
 * - returnKeysetValue=targetKeysetId (so pressing again can go back)
 * - returnKeysetLabel=original label
 */
function transformKeysetButtonForTarget(key: KeyboardKey, targetKeysetId: string): KeyboardKey {
  // Only transform keyset type buttons
  if (key.type !== 'keyset') {
    return key;
  }

  // If target is 'abc', no transformation needed (button is correct as-is)
  if (targetKeysetId === 'abc') {
    return key;
  }

  // For any non-abc keyset, transform the button to point back to abc
  // This handles both "123" and "#+=" keysets
  return {
    ...key,
    keysetValue: key.returnKeysetValue || 'abc',  // Always point back to abc
    label: key.returnKeysetLabel || key.returnKeysetValue || 'abc',  // Show return label (e.g., "אבג")
    // Set up for reverse navigation (if user presses again on abc)
    returnKeysetValue: targetKeysetId,  // Point to the current keyset
    returnKeysetLabel: key.label || targetKeysetId,  // Show the current keyset's label
  };
}

/**
 * Merge common keysets with language-specific configuration
 */
export function mergeCommonKeysets(
  sourceKeyboard: SourceKeyboard,
  language: string,
  commonKeysetsParam?: Keyset[]
): Keyset[] {
  const includeKeysets = sourceKeyboard.includeKeysets || [];
  const alwaysIncludeRow = findAlwaysIncludeRow(sourceKeyboard);
  const { prependKeys, appendKeys } = findAlwaysIncludeKeys(sourceKeyboard);
  const keysets = commonKeysetsParam || getCommonKeysets();

  const mergedKeysets: Keyset[] = [];

  for (const keysetId of includeKeysets) {
    const commonKeyset = keysets.find(ks => ks.id === keysetId);
    if (!commonKeyset) {
      console.warn(`Common keyset '${keysetId}' not found`);
      continue;
    }

    // Filter keys by language
    let filteredRows = filterRowsByLanguage(commonKeyset.rows, language);

    // Apply alwaysInclude keys (prepend/append) to rows
    filteredRows = applyAlwaysIncludeKeys(filteredRows, prependKeys, appendKeys);

    // Create merged keyset
    const mergedKeyset: Keyset = {
      id: commonKeyset.id,
      rows: [...filteredRows],
    };

    // Append alwaysInclude row if found
    if (alwaysIncludeRow) {
      // Clone the row without the alwaysInclude property
      const { alwaysInclude, ...bottomRowProps } = alwaysIncludeRow;
      
      // Transform keys for the target keyset:
      // 1. Remove alwaysInclude flags
      // 2. Transform keyset buttons to point back to the original keyset
      const transformedKeys = bottomRowProps.keys.map(key => {
        const { alwaysInclude: keyFlag, ...keyWithoutFlag } = key;
        // Transform keyset buttons to show return label and point back to abc
        return transformKeysetButtonForTarget(keyWithoutFlag, keysetId);
      });
      
      mergedKeyset.rows.push({ ...bottomRowProps, keys: transformedKeys });
    }

    mergedKeysets.push(mergedKeyset);
  }

  return mergedKeysets;
}

/**
 * Process a keyset to remove alwaysInclude properties from output
 */
export function processKeyset(keyset: Keyset): Keyset {
  return {
    ...keyset,
    rows: keyset.rows.map(row => {
      const { alwaysInclude, ...rowWithoutAlwaysInclude } = row;
      return {
        ...rowWithoutAlwaysInclude,
        keys: cleanAlwaysIncludeFlags(row.keys),
      };
    }),
  };
}

/**
 * Build a complete keyboard config from source keyboard definition
 */
export function buildKeyboardConfig(
  sourceKeyboard: SourceKeyboard,
  language: string
): KeyboardConfig {
  // Start with language-specific keysets
  let allKeysets: Keyset[] = [];

  // Process language-specific keysets (abc, etc.)
  if (sourceKeyboard.keysets && Array.isArray(sourceKeyboard.keysets)) {
    allKeysets = sourceKeyboard.keysets.map(keyset => processKeyset(keyset));
  }

  // Merge common keysets if includeKeysets is specified
  if (sourceKeyboard.includeKeysets && sourceKeyboard.includeKeysets.length > 0) {
    const mergedCommonKeysets = mergeCommonKeysets(sourceKeyboard, language);
    const processedMergedKeysets = mergedCommonKeysets.map(keyset => processKeyset(keyset));
    allKeysets = [...allKeysets, ...processedMergedKeysets];
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

  // Copy diacritics if present
  if (sourceKeyboard.diacritics) {
    config.diacritics = sourceKeyboard.diacritics;
  }

  return config;
}

/**
 * Transform a keyboard config for main preview display.
 * In the main preview, hidden keys (via visibilityMode or hidden groups) should be
 * fully invisible, not semi-transparent. The native renderer shows hidden keys at 0.3
 * alpha in preview mode, which is only desirable in the keys group modal.
 *
 * This function:
 * 1. Converts placeholder keys (hidden: true with no value/type) to opacity: 0
 *    so they are invisible instead of semi-transparent.
 * 2. Converts 'hide' groups to use opacity: 0 instead of visibilityMode/hidden.
 * 3. Converts 'showOnly' groups: removes visibilityMode and adds an inverse group
 *    with opacity: 0 for all non-selected keys.
 */
export function transformConfigForPreview(config: {
  keysets: { id: string; rows: { keys: any[] }[] }[];
  groups?: { name: string; items: string[]; template: any }[];
  [key: string]: any;
}): typeof config {
  // 1. Fix placeholder keys in keysets
  const transformedKeysets = config.keysets.map(keyset => ({
    ...keyset,
    rows: keyset.rows.map(row => ({
      ...row,
      keys: row.keys.map(key => {
        // Placeholder: hidden with no value and no meaningful type
        const isPlaceholder = key.hidden === true &&
          !key.value && !key.type;
        if (isPlaceholder) {
          const { hidden: _h, ...rest } = key;
          return { ...rest, opacity: 0 };
        }
        return key;
      }),
    })),
  }));

  if (!config.groups) {
    return { ...config, keysets: transformedKeysets };
  }

  // Collect all key values from keysets (needed for showOnly inverse)
  const allKeyValues = new Set<string>();
  for (const keyset of config.keysets) {
    for (const row of keyset.rows) {
      for (const key of row.keys) {
        const v = key.value || key.type;
        if (v) allKeyValues.add(v);
      }
    }
  }

  // 2+3. Transform groups
  const transformedGroups: typeof config.groups = [];
  for (const group of config.groups!) {
    const visMode = group.template.visibilityMode;

    if (visMode === 'hide') {
      // Replace with opacity: 0 group (no visibilityMode, no hidden)
      const { visibilityMode: _v, hidden: _h, ...restTemplate } = group.template;
      transformedGroups.push({
        ...group,
        template: { ...restTemplate, opacity: 0 },
      });
    } else if (visMode === 'showOnly') {
      // Keep the showOnly group but strip visibilityMode (keys get their colors normally)
      const { visibilityMode: _v, hidden: _h, ...restTemplate } = group.template;
      transformedGroups.push({
        ...group,
        template: { ...restTemplate },
      });

      // Add inverse group: all keys NOT in the showOnly set get opacity: 0
      const showOnlySet = new Set(group.items);
      const inverseKeys = Array.from(allKeyValues).filter(k => !showOnlySet.has(k));
      if (inverseKeys.length > 0) {
        transformedGroups.push({
          name: `_${group.name}_inverse_`,
          items: inverseKeys,
          template: { color: '', bgColor: '', opacity: 0 },
        });
      }
    } else {
      // Default mode — pass through, but strip hidden/visibilityMode if present
      const { visibilityMode: _v, hidden: _h, ...restTemplate } = group.template;
      transformedGroups.push({
        ...group,
        template: { ...restTemplate },
      });
    }
  }

  return { ...config, keysets: transformedKeysets, groups: transformedGroups };
}

// Export the common keysets directly for convenience
export { commonKeysets };