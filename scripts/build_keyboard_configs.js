#!/usr/bin/env node

/**
 * Build Keyboard Configs for iOS AND Android
 *
 * This script generates the default_config.json files for each keyboard extension
 * from the source keyboard definitions in keyboards/*.json
 *
 * The script uses structural templates from common.js to inject structural keys
 * (backspace, enter, shift, space, etc.) into each keyset, producing two variants
 * per keyset: mobile (base ID) and large-screen (_large suffix).
 *
 * Source files: keyboards/he.json, keyboards/en.json, keyboards/ar.json, keyboards/common.js
 *
 * iOS Output: ios/IssieBoardHe/default_config.json, etc.
 * Android Output: android/app/src/main/assets/he_config.json, etc.
 *
 * Usage: node scripts/build_keyboard_configs.js
 *
 * NOTE: The keyboard merging logic in this file is duplicated in:
 *   src/utils/keyboardConfigMerger.ts
 */

const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURATION CONSTANTS
// ============================================

// Per-variant build defaults
const DEFAULTS = {
  mobile: { heightPreset: 'normal', keyGap: 2, fontWeight: 'regular', fontSize: null },
  large:  { heightPreset: 'x-tall', keyGap: 4, fontWeight: 'heavy', fontSize: "large" }
};
// Default height preset: "compact", "normal", "tall", "x-tall"
// fontSize: sx,small,normal,large, xk
// ============================================

// Configuration
const KEYBOARDS_DIR = path.join(__dirname, '..', 'keyboards');
const IOS_DIR = path.join(__dirname, '..', 'ios');
const ANDROID_ASSETS_DIR = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'assets');

// Keyboard configurations
const KEYBOARD_CONFIGS = [
  {
    sourceFile: 'he.json',
    iosTargetDir: 'IssieBoardHe',
    androidConfigName: 'he_config.json',
    language: 'he',
    systemRowAtTop: false,
  },
  {
    sourceFile: 'en.json',
    iosTargetDir: 'IssieBoardEn',
    androidConfigName: 'en_config.json',
    language: 'en',
    systemRowAtTop: false,
  },
  {
    sourceFile: 'ar.json',
    iosTargetDir: 'IssieBoardAr',
    androidConfigName: 'ar_config.json',
    language: 'ar',
    systemRowAtTop: false,
  },
  {
    sourceFile: 'calc.json',
    iosTargetDir: 'IssieCalc',
    androidConfigName: 'calc_config.json',
    language: 'calc',
    systemRowAtTop: false,
    noStructural: true,  // skip structural key injection (no backspace/space/enter)
  },
];

// ============================================
// LOADING
// ============================================

/**
 * Load common structural templates and keysets from common.js
 * Returns { structural, keysets }
 */
function loadCommon() {
  const commonPath = path.join(KEYBOARDS_DIR, 'common.js');
  if (!fs.existsSync(commonPath)) {
    console.log('   Warning: common.js not found, returning empty structural/keysets');
    return { structural: { mobile: {}, large: {} }, keysets: [] };
  }

  delete require.cache[require.resolve(commonPath)];
  const common = require(commonPath);
  return {
    structural: common.structural || { mobile: {}, large: {} },
    keysets: common.keysets || []
  };
}

// ============================================
// FILTERING
// ============================================

/**
 * Filter keys by language
 */
function filterKeysByLanguage(keys, language) {
  return keys.filter(key => {
    if (!key.forLanguages) {
      return true;
    }
    return key.forLanguages.includes(language);
  }).map(key => {
    const { forLanguages, ...keyWithoutForLanguages } = key;
    return keyWithoutForLanguages;
  });
}

/**
 * Filter rows by language (filter keys within each row)
 */
function filterRowsByLanguage(rows, language) {
  return rows.map(row => {
    return {
      ...row,
      keys: filterKeysByLanguage(row.keys, language)
    };
  });
}

/**
 * Filter structural keys by language, diacritics availability, and keyset.
 * Strips forLanguages, ifHasDiacritics, and forKeysets from output.
 */
function filterStructuralKeys(keys, language, hasDiacritics, keysetId) {
  return keys.filter(key => {
    if (key.forLanguages && !key.forLanguages.includes(language)) {
      return false;
    }
    if (key.ifHasDiacritics && !hasDiacritics) {
      return false;
    }
    if (key.forKeysets && keysetId && !key.forKeysets.includes(keysetId)) {
      return false;
    }
    return true;
  }).map(key => {
    const { forLanguages, ifHasDiacritics, forKeysets, ...clean } = key;
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
function resolveRowsForVariant(keyset, variant) {
  const baseRows = keyset.rows || [];

  if (variant === 'large' && keyset.largeRows) {
    // largeRows is an object keyed by row index with replacement row objects
    const result = baseRows.map((row, index) => {
      const override = keyset.largeRows[String(index)];
      if (override) {
        return JSON.parse(JSON.stringify(override));
      }
      return JSON.parse(JSON.stringify(row));
    });
    return result;
  }

  if (variant === 'mobile' && keyset.mobileRows) {
    const result = baseRows.map((row, index) => {
      const override = keyset.mobileRows[String(index)];
      if (override) {
        return JSON.parse(JSON.stringify(override));
      }
      return JSON.parse(JSON.stringify(row));
    });
    return result;
  }

  // No overrides, deep copy base rows
  return JSON.parse(JSON.stringify(baseRows));
}

// ============================================
// ROW INJECTIONS
// ============================================

/**
 * Apply row injections from the structural variant template.
 * If keysetOverrides has an entry for the given keysetId, those row injections
 * REPLACE the default injections entirely.
 * Resolves firstRow/secondRow/lastRow references and applies prepend/append.
 */
function applyRowInjections(rows, variantTemplate, language, hasDiacritics, keysetId) {
  if (!rows || rows.length === 0) return rows;

  // Resolve which row injections to use: per-keyset override or defaults
  const injections = (variantTemplate.keysetOverrides && variantTemplate.keysetOverrides[keysetId])
    || variantTemplate;

  const result = rows.map(row => ({ ...row, keys: [...row.keys] }));

  const injectionMap = {
    firstRow: 0,
    secondRow: 1,
    lastRow: result.length - 1
  };

  for (const [rowRef, rowIndex] of Object.entries(injectionMap)) {
    const injection = injections[rowRef];
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
 * Add _large suffix to keysetValue/returnKeysetValue on keyset-type keys.
 * Used for large variant content rows.
 */
function suffixKeysetReferences(keys, suffix) {
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
// BOTTOM ROW BUILDING
// ============================================

/**
 * Build the bottom row from the structural template.
 * Resolves special key types:
 * - { type: "space" } -> space key with labels
 * - { type: "keyset" } -> keyset toggle button with variant-aware IDs
 * - Other keys pass through after filtering
 */
function buildBottomRow(template, language, hasDiacritics, labels, targetKeysetId, variant) {
  const suffix = variant === 'large' ? '_large' : '';
  const filtered = filterStructuralKeys(template, language, hasDiacritics, targetKeysetId);

  const keys = filtered.map(key => {
    // Resolve space type
    if (key.type === 'space') {
      const { type, ...rest } = key;
      return {
        caption: labels.spaceCaption || '',
        value: ' ',
        width: 1,
        flex: true,
        ...rest
      };
    }

    // Resolve keyset type
    if (key.type === 'keyset') {
      const { type, ...rest } = key;
      const resolved = resolveKeysetToggle(targetKeysetId, labels, suffix);
      return {
        type: 'keyset',
        ...rest,
        ...resolved
      };
    }

    // Other keys pass through
    return key;
  });

  return { keys };
}

/**
 * Resolve keyset toggle button properties based on the target keyset and variant.
 */
function resolveKeysetToggle(targetKeysetId, labels, suffix) {
  // For abc keyset: primary toggle goes to 123, secondary (if present) also goes to 123
  // For 123 keyset: primary toggle goes to abc, secondary also goes to abc
  // For #+= keyset: same as 123 but returnKeysetValue references #+=

  if (targetKeysetId === 'abc') {
    return {
      keysetValue: '123' + suffix,
      label: labels.symbolsLabel,
      returnKeysetValue: 'abc' + suffix,
      returnKeysetLabel: labels.abcLabel
    };
  }

  if (targetKeysetId === '123') {
    return {
      keysetValue: 'abc' + suffix,
      label: labels.abcLabel,
      returnKeysetValue: '123' + suffix,
      returnKeysetLabel: labels.symbolsLabel
    };
  }

  if (targetKeysetId === '#+=') {
    return {
      keysetValue: 'abc' + suffix,
      label: labels.abcLabel,
      returnKeysetValue: '#+=' + suffix,
      returnKeysetLabel: '#+='
    };
  }

  // Fallback for unknown keyset IDs
  return {
    keysetValue: 'abc' + suffix,
    label: labels.abcLabel,
    returnKeysetValue: targetKeysetId + suffix,
    returnKeysetLabel: targetKeysetId
  };
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
function buildKeysetVariant(keyset, variant, structural, language, hasDiacritics, labels, noStructural) {
  const suffix = variant === 'large' ? '_large' : '';
  const variantTemplate = structural[variant] || {};

  // 1. Resolve rows for variant (handles mobileRows/largeRows overrides)
  let rows = resolveRowsForVariant(keyset, variant);

  // 2. Filter by language
  rows = filterRowsByLanguage(rows, language);

  if (!noStructural) {
    // 3. Apply row injections (prepend/append structural keys)
    rows = applyRowInjections(rows, variantTemplate, language, hasDiacritics, keyset.id);
  }

  // 4. If large variant: suffix keyset references in content rows
  if (variant === 'large') {
    rows = rows.map(row => ({
      ...row,
      keys: suffixKeysetReferences(row.keys, suffix)
    }));
  }

  if (!noStructural) {
    // 5. Build bottom row and append
    const bottomRowTemplate = variantTemplate.bottomRow || [];
    const bottomRow = buildBottomRow(bottomRowTemplate, language, hasDiacritics, labels, keyset.id, variant);
    rows.push(bottomRow);
  }

  // 6. Return variant keyset
  return {
    id: keyset.id + suffix,
    rows
  };
}

// ============================================
// DEFAULT CONFIG TEMPLATE
// ============================================

/**
 * Build the default config template with per-variant defaults.
 * Properties without a variant suffix apply to mobile.
 * Properties with _large suffix apply to large-screen variant.
 */
function buildDefaultConfigTemplate() {
  const template = {
    backgroundColor: 'default',
    defaultKeyset: 'abc',
    wordSuggestionsEnabled: true,
    autoCorrectEnabled: false,
    groups: []
  };

  // Mobile defaults
  template.heightPreset = DEFAULTS.mobile.heightPreset;
  template.keyGap = DEFAULTS.mobile.keyGap;
  template.fontWeight = DEFAULTS.mobile.fontWeight;
  if (DEFAULTS.mobile.fontSize !== null) {
    template.fontSize = DEFAULTS.mobile.fontSize;
  }

  // Large defaults (with _large suffix)
  template.heightPreset_large = DEFAULTS.large.heightPreset;
  template.keyGap_large = DEFAULTS.large.keyGap;
  template.fontWeight_large = DEFAULTS.large.fontWeight;
  if (DEFAULTS.large.fontSize !== null) {
    template.fontSize_large = DEFAULTS.large.fontSize;
  }

  return template;
}

// ============================================
// KEYBOARD CONFIG BUILDING
// ============================================

/**
 * Build keyboard config from source keyboard definition.
 * For each keyset (language abc + common 123/#+=), calls buildKeysetVariant
 * twice (mobile + large), producing 6 keysets per language.
 */
function buildKeyboardConfig(sourceKeyboard, config, common) {
  const outputConfig = buildDefaultConfigTemplate();

  outputConfig.keyboards = [config.language];
  outputConfig.defaultKeyboard = config.language;
  outputConfig.keyboardLanguage = config.language;

  if (sourceKeyboard.diacritics) {
    outputConfig.diacritics = sourceKeyboard.diacritics;
    outputConfig.diacriticsSettings = {
      [config.language]: {
        simpleMode: true
      }
    };
  }

  const hasDiacritics = !!sourceKeyboard.diacritics;
  const labels = sourceKeyboard.labels || { abcLabel: 'ABC', symbolsLabel: '123', spaceCaption: '' };
  const structural = common.structural;

  const allKeysets = [];

  // Process language-specific keysets (e.g., abc)
  if (sourceKeyboard.keysets && Array.isArray(sourceKeyboard.keysets)) {
    for (const keyset of sourceKeyboard.keysets) {
      // Mobile variant
      allKeysets.push(buildKeysetVariant(keyset, 'mobile', structural, config.language, hasDiacritics, labels, config.noStructural));
      // Large variant
      allKeysets.push(buildKeysetVariant(keyset, 'large', structural, config.language, hasDiacritics, labels, config.noStructural));
    }
  }

  // Process included common keysets (e.g., 123, #+=)
  if (sourceKeyboard.includeKeysets && sourceKeyboard.includeKeysets.length > 0) {
    for (const keysetId of sourceKeyboard.includeKeysets) {
      const commonKeyset = common.keysets.find(ks => ks.id === keysetId);
      if (!commonKeyset) {
        console.log(`   Warning: Common keyset '${keysetId}' not found`);
        continue;
      }
      // Mobile variant
      allKeysets.push(buildKeysetVariant(commonKeyset, 'mobile', structural, config.language, hasDiacritics, labels, config.noStructural));
      // Large variant
      allKeysets.push(buildKeysetVariant(commonKeyset, 'large', structural, config.language, hasDiacritics, labels, config.noStructural));
    }
  }

  outputConfig.keysets = allKeysets;
  outputConfig.defaultKeyset = sourceKeyboard.defaultKeyset || (config.noStructural ? allKeysets[0]?.id : 'abc');
  if (config.noStructural) {
    outputConfig.wordSuggestionsEnabled = false;
  }
  outputConfig.groups = [];

  return outputConfig;
}

// ============================================
// ANDROID COMBINED CONFIG
// ============================================

/**
 * Prefix keyset references in keys with language code.
 * Handles _large suffix: "123_large" -> "he_123_large"
 */
function prefixKeysetReferences(keys, language) {
  return keys.map(key => {
    const newKey = { ...key };
    if (newKey.keysetValue) {
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

/**
 * Create a combined default_config.json for Android with all keyboards merged.
 * Keyset IDs are prefixed with language code, handling _large suffix.
 */
function createCombinedAndroidConfig(common) {
  console.log('\n   Creating combined Android config...');

  const combinedConfig = buildDefaultConfigTemplate();
  combinedConfig.keyboards = ['he', 'en', 'ar'];
  combinedConfig.defaultKeyboard = 'he';
  combinedConfig.keysets = [];
  combinedConfig.allDiacritics = {};
  combinedConfig.diacriticsSettings = {};

  for (const config of KEYBOARD_CONFIGS) {
    const sourcePath = path.join(KEYBOARDS_DIR, config.sourceFile);

    try {
      if (!fs.existsSync(sourcePath)) continue;

      const sourceContent = fs.readFileSync(sourcePath, 'utf8');
      const sourceKeyboard = JSON.parse(sourceContent);

      const keyboardConfig = buildKeyboardConfig(sourceKeyboard, config, common);

      // Prefix keyset IDs and keyset references with language code
      const prefixedKeysets = keyboardConfig.keysets.map(keyset => {
        const largeSuffix = keyset.id.endsWith('_large') ? '_large' : '';
        const baseId = largeSuffix ? keyset.id.slice(0, -6) : keyset.id;
        const newId = `${config.language}_${baseId}${largeSuffix}`;

        // Prefix keyset references in row keys
        const prefixedRows = keyset.rows.map(row => ({
          ...row,
          keys: prefixKeysetReferences(row.keys, config.language)
        }));

        return {
          ...keyset,
          id: newId,
          rows: prefixedRows
        };
      });

      combinedConfig.keysets.push(...prefixedKeysets);

      // Add diacritics if present
      if (sourceKeyboard.diacritics) {
        combinedConfig.allDiacritics[config.language] = sourceKeyboard.diacritics;
        combinedConfig.diacriticsSettings[config.language] = {
          simpleMode: true
        };
      }

    } catch (error) {
      console.log(`   Warning: Error processing ${config.sourceFile}: ${error.message}`);
    }
  }

  // Set default keyset to Hebrew abc
  combinedConfig.defaultKeyset = 'he_abc';

  const outputPath = path.join(ANDROID_ASSETS_DIR, 'default_config.json');
  fs.writeFileSync(outputPath, JSON.stringify(combinedConfig, null, 2), 'utf8');
  console.log(`   Done: Created combined config: assets/default_config.json`);
  console.log(`   Total keysets: ${combinedConfig.keysets.length}`);
}

// ============================================
// COPY DICTIONARY FILES
// ============================================

/**
 * Copy dictionary files
 */
function copyDictionaryFiles() {
  console.log('\nCopying dictionary files...');

  const dictSourceDir = path.join(__dirname, '..', 'dict', 'bin');
  const iosMainAppDir = path.join(IOS_DIR, 'IssieBoardNG');

  const dictFiles = ['he_50k.bin', 'en_50k.bin', 'ar_50k.bin'];

  // Copy to iOS main app
  for (const filename of dictFiles) {
    const sourcePath = path.join(dictSourceDir, filename);
    const targetPath = path.join(iosMainAppDir, filename);

    if (!fs.existsSync(sourcePath)) {
      console.log(`   Warning: Source dict not found: ${sourcePath}`);
      continue;
    }

    try {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`   iOS: ${filename}`);
    } catch (error) {
      console.log(`   Failed to copy ${filename}: ${error.message}`);
    }
  }

  // Copy to Android assets
  for (const filename of dictFiles) {
    const sourcePath = path.join(dictSourceDir, filename);
    const targetPath = path.join(ANDROID_ASSETS_DIR, filename);

    if (!fs.existsSync(sourcePath)) continue;

    try {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`   Android: ${filename}`);
    } catch (error) {
      console.log(`   Failed to copy ${filename}: ${error.message}`);
    }
  }
}

// ============================================
// MAIN BUILD FUNCTION
// ============================================

/**
 * Main build function
 */
function buildKeyboardConfigs() {
  console.log('Building keyboard configs for iOS and Android...\n');

  console.log('Loading common structural templates and keysets...');
  const common = loadCommon();
  console.log(`   Found ${common.keysets.length} common keysets: ${common.keysets.map(k => k.id).join(', ')}`);
  console.log(`   Structural variants: mobile, large\n`);

  // Ensure Android assets directory exists
  if (!fs.existsSync(ANDROID_ASSETS_DIR)) {
    fs.mkdirSync(ANDROID_ASSETS_DIR, { recursive: true });
  }

  let successCount = 0;
  let errorCount = 0;

  for (const config of KEYBOARD_CONFIGS) {
    const sourcePath = path.join(KEYBOARDS_DIR, config.sourceFile);
    const iosTargetPath = path.join(IOS_DIR, config.iosTargetDir, 'default_config.json');
    const androidTargetPath = path.join(ANDROID_ASSETS_DIR, config.androidConfigName);

    console.log(`Processing ${config.sourceFile}...`);

    try {
      if (!fs.existsSync(sourcePath)) {
        console.log(`   Warning: Source file not found: ${sourcePath}`);
        errorCount++;
        continue;
      }

      const iosTargetDir = path.join(IOS_DIR, config.iosTargetDir);
      if (!fs.existsSync(iosTargetDir)) {
        fs.mkdirSync(iosTargetDir, { recursive: true });
      }

      const sourceContent = fs.readFileSync(sourcePath, 'utf8');
      const sourceKeyboard = JSON.parse(sourceContent);

      const outputConfig = buildKeyboardConfig(sourceKeyboard, config, common);

      const outputContent = JSON.stringify(outputConfig, null, 2);

      // Write to iOS
      fs.writeFileSync(iosTargetPath, outputContent, 'utf8');
      console.log(`   iOS: ${config.iosTargetDir}/default_config.json`);

      // Write to Android
      fs.writeFileSync(androidTargetPath, outputContent, 'utf8');
      console.log(`   Android: assets/${config.androidConfigName}`);

      const keysetCount = outputConfig.keysets?.length || 0;
      console.log(`   Generated ${keysetCount} keysets`);
      successCount++;

    } catch (error) {
      console.log(`   Error: ${error.message}`);
      errorCount++;
    }
  }

  // Also create a combined default_config.json for Android with all keyboards
  createCombinedAndroidConfig(common);

  console.log(`\nBuild complete: ${successCount} succeeded, ${errorCount} failed`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

// Run the build
buildKeyboardConfigs();
copyDictionaryFiles();
