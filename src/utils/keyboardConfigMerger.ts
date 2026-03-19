/**
 * Keyboard Config Merger
 *
 * Shared utilities for merging keyboard configurations.
 * Used by:
 * - Build script (scripts/build_keyboard_configs.js) to generate default configs
 * - Settings app to build configs when editing profiles
 *
 * This module handles:
 * - Loading and merging common keysets with language-specific keysets
 * - Filtering keys by language (using forLanguages property)
 * - Structural template injection (backspace, enter, shift, space, etc.)
 * - Producing two variants per keyset: mobile (base ID) and large-screen (_large suffix)
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
  ifHasDiacritics?: boolean;
  showForField?: string[];
  flex?: boolean;
  fontSize?: number;
}

export interface KeyboardRow {
  keys: KeyboardKey[];
}

export interface Keyset {
  id: string;
  rows: KeyboardRow[];
  mobileRows?: Record<string, KeyboardRow>;
  largeRows?: Record<string, KeyboardRow>;
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

export interface KeyboardLabels {
  abcLabel?: string;
  symbolsLabel?: string;
  spaceCaption?: string;
}

export interface SourceKeyboard {
  id: string;
  name: string;
  includeKeysets?: string[];
  diacritics?: Diacritics;
  labels?: KeyboardLabels;
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

// ============================================
// COMMON KEYSETS ACCESS
// ============================================

/**
 * Get common keysets from the common.js module
 */
export function getCommonKeysets(): Keyset[] {
  return commonKeysets.keysets || [];
}

// ============================================
// LANGUAGE FILTERING
// ============================================

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
      const result = { ...key };
      delete result.forLanguages;
      return result;
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
    if (key.value === ' ' || key.caption === 'space' || key.caption === '\u05E8\u05D5\u05D5\u05D7' || key.caption === '\u0645\u0633\u0627\u0641\u0629') {
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

// ============================================
// STRUCTURAL FILTERING
// ============================================

/**
 * Filter structural keys by language and diacritics availability.
 * Strips forLanguages and ifHasDiacritics from output.
 */
export function filterStructuralKeys(
  keys: KeyboardKey[],
  language: string,
  hasDiacritics: boolean
): KeyboardKey[] {
  return keys.filter(key => {
    if (key.forLanguages && !key.forLanguages.includes(language)) {
      return false;
    }
    if (key.ifHasDiacritics && !hasDiacritics) {
      return false;
    }
    return true;
  }).map(key => {
    const clean = { ...key };
    delete clean.forLanguages;
    delete clean.ifHasDiacritics;
    return clean;
  });
}

// ============================================
// VARIANT ROW RESOLUTION
// ============================================

/**
 * Resolve the correct rows for a given variant.
 * Checks for mobileRows/largeRows overrides on the keyset.
 * Returns deep-copied rows array.
 */
export function resolveRowsForVariant(
  keyset: Keyset,
  variant: 'mobile' | 'large'
): KeyboardRow[] {
  const baseRows = keyset.rows || [];

  if (variant === 'large' && keyset.largeRows) {
    return baseRows.map((row, index) => {
      const override = keyset.largeRows![String(index)];
      if (override) {
        return JSON.parse(JSON.stringify(override));
      }
      return JSON.parse(JSON.stringify(row));
    });
  }

  if (variant === 'mobile' && keyset.mobileRows) {
    return baseRows.map((row, index) => {
      const override = keyset.mobileRows![String(index)];
      if (override) {
        return JSON.parse(JSON.stringify(override));
      }
      return JSON.parse(JSON.stringify(row));
    });
  }

  // No overrides, deep copy base rows
  return JSON.parse(JSON.stringify(baseRows));
}

// ============================================
// ROW INJECTIONS
// ============================================

interface RowInjection {
  prepend?: KeyboardKey[];
  append?: KeyboardKey[];
}

interface KeysetOverride {
  firstRow?: RowInjection;
  secondRow?: RowInjection;
  lastRow?: RowInjection;
}

interface StructuralVariant {
  firstRow?: RowInjection;
  secondRow?: RowInjection;
  lastRow?: RowInjection;
  keysetOverrides?: Record<string, KeysetOverride>;
  bottomRow?: KeyboardKey[];
}

/**
 * Apply row injections from the structural variant template.
 * If keysetOverrides has an entry for the given keysetId, those row injections
 * REPLACE the default injections entirely.
 * Resolves firstRow/secondRow/lastRow references and applies prepend/append.
 */
export function applyRowInjections(
  rows: KeyboardRow[],
  variantTemplate: StructuralVariant,
  language: string,
  hasDiacritics: boolean,
  keysetId?: string
): KeyboardRow[] {
  if (!rows || rows.length === 0) return rows;

  // Resolve which row injections to use: per-keyset override or defaults
  const injections: Pick<StructuralVariant, 'firstRow' | 'secondRow' | 'lastRow'> =
    (keysetId && variantTemplate.keysetOverrides && variantTemplate.keysetOverrides[keysetId])
      || variantTemplate;

  const result = rows.map(row => ({ ...row, keys: [...row.keys] }));

  const injectionMap: Record<string, number> = {
    firstRow: 0,
    secondRow: 1,
    lastRow: result.length - 1,
  };

  for (const [rowRef, rowIndex] of Object.entries(injectionMap)) {
    const injection = injections[rowRef as keyof typeof injections] as RowInjection | undefined;
    if (!injection || rowIndex < 0 || rowIndex >= result.length) continue;

    if (injection.prepend) {
      const filtered = filterStructuralKeys(injection.prepend, language, hasDiacritics);
      result[rowIndex].keys = [...filtered, ...result[rowIndex].keys];
    }
    if (injection.append) {
      const filtered = filterStructuralKeys(injection.append, language, hasDiacritics);
      result[rowIndex].keys = [...result[rowIndex].keys, ...filtered];
    }
  }

  return result;
}

// ============================================
// KEYSET REFERENCE SUFFIXING
// ============================================

/**
 * Add suffix (e.g., _large) to keysetValue/returnKeysetValue on keyset-type keys.
 * Used for large variant content rows.
 */
export function suffixKeysetReferences(keys: KeyboardKey[], suffix: string): KeyboardKey[] {
  return keys.map(key => {
    const newKey = { ...key };
    if (newKey.keysetValue) {
      newKey.keysetValue = newKey.keysetValue + suffix;
    }
    if (newKey.returnKeysetValue) {
      newKey.returnKeysetValue = newKey.returnKeysetValue + suffix;
    }
    return newKey;
  });
}

// ============================================
// KEYSET TOGGLE RESOLUTION
// ============================================

/**
 * Resolve keyset toggle button properties based on the target keyset and variant.
 */
function resolveKeysetToggle(
  targetKeysetId: string,
  labels: KeyboardLabels,
  suffix: string
): Partial<KeyboardKey> {
  if (targetKeysetId === 'abc') {
    return {
      keysetValue: '123' + suffix,
      label: labels.symbolsLabel,
      returnKeysetValue: 'abc' + suffix,
      returnKeysetLabel: labels.abcLabel,
    };
  }

  if (targetKeysetId === '123') {
    return {
      keysetValue: 'abc' + suffix,
      label: labels.abcLabel,
      returnKeysetValue: '123' + suffix,
      returnKeysetLabel: labels.symbolsLabel,
    };
  }

  if (targetKeysetId === '#+=') {
    return {
      keysetValue: 'abc' + suffix,
      label: labels.abcLabel,
      returnKeysetValue: '#+=' + suffix,
      returnKeysetLabel: '#+=',
    };
  }

  // Fallback for unknown keyset IDs
  return {
    keysetValue: 'abc' + suffix,
    label: labels.abcLabel,
    returnKeysetValue: targetKeysetId + suffix,
    returnKeysetLabel: targetKeysetId,
  };
}

// ============================================
// BOTTOM ROW BUILDING
// ============================================

/**
 * Build the bottom row from the structural template.
 * Resolves special key types:
 * - { type: "space" } -> space key with labels
 * - { type: "keyset" } -> keyset toggle button with variant-aware IDs
 * - Other keys pass through after filtering
 */
export function buildBottomRow(
  template: KeyboardKey[],
  language: string,
  hasDiacritics: boolean,
  labels: KeyboardLabels,
  targetKeysetId: string,
  variant: 'mobile' | 'large'
): KeyboardRow {
  const suffix = variant === 'large' ? '_large' : '';
  const filtered = filterStructuralKeys(template, language, hasDiacritics);

  const keys = filtered.map(key => {
    // Resolve space type
    if (key.type === 'space') {
      const rest = { ...key };
      delete rest.type;
      return {
        caption: labels.spaceCaption || '',
        value: ' ',
        width: 1,
        flex: true,
        ...rest,
      };
    }

    // Resolve keyset type
    if (key.type === 'keyset') {
      const rest = { ...key };
      delete rest.type;
      const resolved = resolveKeysetToggle(targetKeysetId, labels, suffix);
      return {
        type: 'keyset' as const,
        ...rest,
        ...resolved,
      };
    }

    // Other keys pass through
    return key;
  });

  return { keys };
}

// ============================================
// KEYSET VARIANT BUILDING
// ============================================

/**
 * Build a single keyset variant (mobile or large).
 * This is the main pipeline:
 * 1. resolveRowsForVariant
 * 2. filterRowsByLanguage
 * 3. applyRowInjections
 * 4. If large: suffixKeysetReferences on content rows
 * 5. buildBottomRow and append
 * 6. Return { id, rows }
 */
export function buildKeysetVariant(
  keyset: Keyset,
  variant: 'mobile' | 'large',
  structural: { mobile: StructuralVariant; large: StructuralVariant },
  language: string,
  hasDiacritics: boolean,
  labels: KeyboardLabels
): Keyset {
  const suffix = variant === 'large' ? '_large' : '';
  const variantTemplate = structural[variant] || {};

  // 1. Resolve rows for variant (handles mobileRows/largeRows overrides)
  let rows = resolveRowsForVariant(keyset, variant);

  // 2. Filter by language
  rows = filterRowsByLanguage(rows, language);

  // 3. Apply row injections (prepend/append structural keys)
  rows = applyRowInjections(rows, variantTemplate, language, hasDiacritics, keyset.id);

  // 4. If large variant: suffix keyset references in content rows
  if (variant === 'large') {
    rows = rows.map(row => ({
      ...row,
      keys: suffixKeysetReferences(row.keys, suffix),
    }));
  }

  // 5. Build bottom row and append
  const bottomRowTemplate = variantTemplate.bottomRow || [];
  const bottomRow = buildBottomRow(bottomRowTemplate, language, hasDiacritics, labels, keyset.id, variant);
  rows.push(bottomRow);

  // 6. Return variant keyset
  return {
    id: keyset.id + suffix,
    rows,
  };
}

// ============================================
// MERGE COMMON KEYSETS
// ============================================

/**
 * Merge common keysets with language-specific configuration.
 * Produces two variants per common keyset (mobile + large).
 */
export function mergeCommonKeysets(
  sourceKeyboard: SourceKeyboard,
  language: string,
  commonKeysetsParam?: Keyset[]
): Keyset[] {
  const includeKeysets = sourceKeyboard.includeKeysets || [];
  const keysets = commonKeysetsParam || getCommonKeysets();
  const hasDiacritics = !!sourceKeyboard.diacritics;
  const labels: KeyboardLabels = sourceKeyboard.labels || {
    abcLabel: 'ABC',
    symbolsLabel: '123',
    spaceCaption: '',
  };
  const structural = commonKeysets.structural;

  const mergedKeysets: Keyset[] = [];

  for (const keysetId of includeKeysets) {
    const commonKeyset = keysets.find(ks => ks.id === keysetId);
    if (!commonKeyset) {
      console.warn(`Common keyset '${keysetId}' not found`);
      continue;
    }

    // Mobile variant
    mergedKeysets.push(
      buildKeysetVariant(commonKeyset, 'mobile', structural, language, hasDiacritics, labels)
    );
    // Large variant
    mergedKeysets.push(
      buildKeysetVariant(commonKeyset, 'large', structural, language, hasDiacritics, labels)
    );
  }

  return mergedKeysets;
}

// ============================================
// BUILD KEYBOARD CONFIG
// ============================================

/**
 * Build a complete keyboard config from source keyboard definition.
 * For each keyset (language abc + common 123/#+=), calls buildKeysetVariant
 * twice (mobile + large), producing two variants per keyset.
 */
export function buildKeyboardConfig(
  sourceKeyboard: SourceKeyboard,
  language: string
): KeyboardConfig {
  const hasDiacritics = !!sourceKeyboard.diacritics;
  const labels: KeyboardLabels = sourceKeyboard.labels || {
    abcLabel: 'ABC',
    symbolsLabel: '123',
    spaceCaption: '',
  };
  const structural = commonKeysets.structural;

  const allKeysets: Keyset[] = [];

  // Process language-specific keysets (e.g., abc)
  if (sourceKeyboard.keysets && Array.isArray(sourceKeyboard.keysets)) {
    for (const keyset of sourceKeyboard.keysets) {
      // Mobile variant
      allKeysets.push(
        buildKeysetVariant(keyset, 'mobile', structural, language, hasDiacritics, labels)
      );
      // Large variant
      allKeysets.push(
        buildKeysetVariant(keyset, 'large', structural, language, hasDiacritics, labels)
      );
    }
  }

  // Merge common keysets if includeKeysets is specified
  if (sourceKeyboard.includeKeysets && sourceKeyboard.includeKeysets.length > 0) {
    const mergedCommonKeysets = mergeCommonKeysets(sourceKeyboard, language);
    allKeysets.push(...mergedCommonKeysets);
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

// ============================================
// PREVIEW TRANSFORM (RUNTIME FEATURE)
// ============================================

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
  // Inverse groups (for showOnly) must be placed LAST so they aren't overridden by later styling groups
  const transformedGroups: typeof config.groups = [];
  const inverseGroups: typeof config.groups = [];
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

      // Collect inverse group to append at the end
      // Exclude special/essential keys — they should always remain visible (matching native renderer logic)
      const essentialKeys = new Set([' ', 'backspace', 'enter', 'next-keyboard', 'settings',
        'shift', 'keyset', 'nikkud', 'close', 'language']);
      const showOnlySet = new Set(group.items);
      const inverseKeys = Array.from(allKeyValues).filter(k => !showOnlySet.has(k) && !essentialKeys.has(k));
      if (inverseKeys.length > 0) {
        inverseGroups.push({
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
  // Append inverse groups last so opacity:0 isn't overridden by styling groups
  transformedGroups.push(...inverseGroups);

  return { ...config, keysets: transformedKeysets, groups: transformedGroups };
}

// Export the common keysets directly for convenience
export { commonKeysets };
