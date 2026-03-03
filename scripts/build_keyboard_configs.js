#!/usr/bin/env node

/**
 * Build Keyboard Configs for iOS AND Android
 * 
 * This script generates the default_config.json files for each keyboard extension
 * from the source keyboard definitions in keyboards/*.json
 * 
 * The script merges common keysets (from common.js) with language-specific keysets,
 * filtering keys by language and appending the "alwaysInclude" bottom row.
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

// Default key height in points (set to null to use device defaults: 54pt iPhone, 74pt iPad)
// Try values like: 60, 65, 70, 80, etc.
const DEFAULT_KEY_HEIGHT = 90;  // Change this to test different heights (e.g., 70)

// Default key gap in points (space between keys)
const DEFAULT_KEY_GAP = 3;

// Default font weight for all keyboards
const DEFAULT_FONT_WEIGHT = 'heavy';

// Default font size in points (set to null to use native default of 48)
const DEFAULT_FONT_SIZE = null;  // null means use native default (48pt)

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
];

// Default keyboard config template
// wordSuggestionsEnabled: true (ON by default)
// autoCorrectEnabled: false (OFF by default)
const DEFAULT_CONFIG_TEMPLATE = {
  backgroundColor: 'default',
  defaultKeyset: 'abc',
  wordSuggestionsEnabled: true,
  autoCorrectEnabled: false,
  fontWeight: DEFAULT_FONT_WEIGHT,
  keyGap: DEFAULT_KEY_GAP,
  groups: []
};

// Add keyHeight if specified (only include if not null)
if (DEFAULT_KEY_HEIGHT !== null) {
  DEFAULT_CONFIG_TEMPLATE.keyHeight = DEFAULT_KEY_HEIGHT;
}

// Add fontSize if specified (only include if not null)
if (DEFAULT_FONT_SIZE !== null) {
  DEFAULT_CONFIG_TEMPLATE.fontSize = DEFAULT_FONT_SIZE;
}

// System row that gets added at the top of each keyset (if enabled)
const SYSTEM_ROW = {
  keys: [
    { type: 'settings' },
    { type: 'backspace', width: 1.5 },
    { type: 'enter' },
    { type: 'close' }
  ]
};

/**
 * Load common keysets from common.js
 */
function loadCommonKeysets() {
  const commonPath = path.join(KEYBOARDS_DIR, 'common.js');
  if (!fs.existsSync(commonPath)) {
    console.log('   ⚠️  common.js not found, skipping common keysets');
    return [];
  }
  
  delete require.cache[require.resolve(commonPath)];
  const common = require(commonPath);
  return common.keysets || [];
}

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
 * Find the alwaysInclude row from the abc keyset
 */
function findAlwaysIncludeRow(sourceKeyboard) {
  const abcKeyset = sourceKeyboard.keysets?.find(ks => ks.id === 'abc');
  if (!abcKeyset) return null;
  
  return abcKeyset.rows?.find(row => row.alwaysInclude === true);
}

/**
 * Transform a keyset button key for a different target keyset
 */
function transformKeysetButtonForTarget(key, targetKeysetId) {
  if (key.type !== 'keyset') {
    return key;
  }
  
  if (targetKeysetId === 'abc') {
    return key;
  }
  
  return {
    ...key,
    keysetValue: key.returnKeysetValue || 'abc',
    label: key.returnKeysetLabel || key.returnKeysetValue || 'abc',
    returnKeysetValue: targetKeysetId,
    returnKeysetLabel: key.label || targetKeysetId,
  };
}

/**
 * Find alwaysInclude keys from non-alwaysInclude rows in the abc keyset
 */
function findAlwaysIncludeKeys(sourceKeyboard) {
  const abcKeyset = sourceKeyboard.keysets?.find(ks => ks.id === 'abc');
  if (!abcKeyset) return { prependKeys: [], appendKeys: [] };
  
  const prependKeys = [];
  const appendKeys = [];
  
  (abcKeyset.rows || []).forEach((row) => {
    if (row.alwaysInclude) return;
    
    const keys = row.keys || [];
    keys.forEach((key, keyIndex) => {
      if (key.alwaysInclude) {
        const { alwaysInclude, ...keyWithoutFlag } = key;
        
        if (keyIndex === 0) {
          prependKeys.push(keyWithoutFlag);
        } else if (keyIndex === keys.length - 1) {
          appendKeys.push(keyWithoutFlag);
        }
      }
    });
  });
  
  return { prependKeys, appendKeys };
}

/**
 * Apply alwaysInclude keys to a common keyset's rows
 */
function applyAlwaysIncludeKeys(rows, prependKeys, appendKeys) {
  if (rows.length === 0) return rows;
  
  return rows.map((row, index) => {
    if (index !== rows.length - 1) {
      return row;
    }
    
    let newKeys = [...row.keys];
    
    for (const key of prependKeys) {
      newKeys = [key, ...newKeys];
    }
    
    for (const key of appendKeys) {
      newKeys = [...newKeys, key];
    }
    
    return {
      ...row,
      keys: newKeys
    };
  });
}

/**
 * Merge common keysets with language-specific configuration
 */
function mergeCommonKeysets(commonKeysets, sourceKeyboard, language) {
  const includeKeysets = sourceKeyboard.includeKeysets || [];
  const alwaysIncludeRow = findAlwaysIncludeRow(sourceKeyboard);
  const { prependKeys, appendKeys } = findAlwaysIncludeKeys(sourceKeyboard);
  
  const mergedKeysets = [];
  
  for (const keysetId of includeKeysets) {
    const commonKeyset = commonKeysets.find(ks => ks.id === keysetId);
    if (!commonKeyset) {
      console.log(`   ⚠️  Common keyset '${keysetId}' not found`);
      continue;
    }
    
    let filteredRows = filterRowsByLanguage(commonKeyset.rows, language);
    filteredRows = applyAlwaysIncludeKeys(filteredRows, prependKeys, appendKeys);
    
    const mergedKeyset = {
      id: commonKeyset.id,
      rows: [...filteredRows]
    };
    
    if (alwaysIncludeRow) {
      const { alwaysInclude, ...bottomRowProps } = alwaysIncludeRow;
      
      const transformedKeys = bottomRowProps.keys.map(key => {
        const { alwaysInclude: keyFlag, ...keyWithoutFlag } = key;
        return transformKeysetButtonForTarget(keyWithoutFlag, keysetId);
      });
      
      mergedKeyset.rows.push({ ...bottomRowProps, keys: transformedKeys });
    }
    
    mergedKeysets.push(mergedKeyset);
  }
  
  return mergedKeysets;
}

/**
 * Process a keyset to add system row and convert language keys
 */
function processKeyset(keyset, addSystemRow) {
  const processedKeyset = { ...keyset };
  
  processedKeyset.rows = keyset.rows.map(row => {
    const { alwaysInclude, ...rowWithoutAlwaysInclude } = row;
    return {
      ...rowWithoutAlwaysInclude,
      keys: row.keys,
    };
  });
  
  if (addSystemRow) {
    processedKeyset.rows = [SYSTEM_ROW, ...processedKeyset.rows];
  }
  
  return processedKeyset;
}

/**
 * Build keyboard config from source keyboard definition
 */
function buildKeyboardConfig(sourceKeyboard, config, commonKeysets) {
  const outputConfig = { ...DEFAULT_CONFIG_TEMPLATE };
  
  outputConfig.keyboards = [config.language];
  outputConfig.defaultKeyboard = config.language;
  outputConfig.keyboardLanguage = config.language;
  
  if (sourceKeyboard.diacritics) {
    outputConfig.diacritics = sourceKeyboard.diacritics;
    
    // Set default diacriticsSettings with simpleMode: true
    outputConfig.diacriticsSettings = {
      [config.language]: {
        simpleMode: true
      }
    };
  }
  
  let allKeysets = [];
  
  if (sourceKeyboard.keysets && Array.isArray(sourceKeyboard.keysets)) {
    allKeysets = sourceKeyboard.keysets.map(keyset => 
      processKeyset(keyset, config.systemRowAtTop)
    );
  }
  
  if (sourceKeyboard.includeKeysets && sourceKeyboard.includeKeysets.length > 0) {
    const mergedCommonKeysets = mergeCommonKeysets(commonKeysets, sourceKeyboard, config.language);
    
    const processedMergedKeysets = mergedCommonKeysets.map(keyset =>
      processKeyset(keyset, config.systemRowAtTop)
    );
    
    allKeysets = [...allKeysets, ...processedMergedKeysets];
  }
  
  outputConfig.keysets = allKeysets;
  outputConfig.defaultKeyset = sourceKeyboard.defaultKeyset || 'abc';
  outputConfig.groups = [];
  
  return outputConfig;
}

/**
 * Main build function
 */
function buildKeyboardConfigs() {
  console.log('🔨 Building keyboard configs for iOS and Android...\n');
  
  console.log('📦 Loading common keysets...');
  const commonKeysets = loadCommonKeysets();
  console.log(`   Found ${commonKeysets.length} common keysets: ${commonKeysets.map(k => k.id).join(', ')}\n`);
  
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
    
    console.log(`📄 Processing ${config.sourceFile}...`);
    
    try {
      if (!fs.existsSync(sourcePath)) {
        console.log(`   ⚠️  Source file not found: ${sourcePath}`);
        errorCount++;
        continue;
      }
      
      const iosTargetDir = path.join(IOS_DIR, config.iosTargetDir);
      if (!fs.existsSync(iosTargetDir)) {
        fs.mkdirSync(iosTargetDir, { recursive: true });
      }
      
      const sourceContent = fs.readFileSync(sourcePath, 'utf8');
      const sourceKeyboard = JSON.parse(sourceContent);
      
      const outputConfig = buildKeyboardConfig(sourceKeyboard, config, commonKeysets);
      
      const outputContent = JSON.stringify(outputConfig, null, 2);
      
      // Write to iOS
      fs.writeFileSync(iosTargetPath, outputContent, 'utf8');
      console.log(`   ✅ iOS: ${config.iosTargetDir}/default_config.json`);
      
      // Write to Android
      fs.writeFileSync(androidTargetPath, outputContent, 'utf8');
      console.log(`   ✅ Android: assets/${config.androidConfigName}`);
      
      const keysetCount = outputConfig.keysets?.length || 0;
      console.log(`   📊 Generated ${keysetCount} keysets`);
      successCount++;
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      errorCount++;
    }
  }
  
  // Also create a combined default_config.json for Android with all keyboards
  createCombinedAndroidConfig(commonKeysets);
  
  console.log(`\n📊 Build complete: ${successCount} succeeded, ${errorCount} failed`);
  
  if (errorCount > 0) {
    process.exit(1);
  }
}

/**
 * Prefix keyset references in keys (e.g., keysetValue: "123" -> "he_123")
 */
function prefixKeysetReferences(keys, language) {
  return keys.map(key => {
    const newKey = { ...key };
    
    if (newKey.keysetValue) {
      newKey.keysetValue = `${language}_${newKey.keysetValue}`;
    }
    if (newKey.returnKeysetValue) {
      newKey.returnKeysetValue = `${language}_${newKey.returnKeysetValue}`;
    }
    
    return newKey;
  });
}

/**
 * Create a combined default_config.json for Android with all keyboards merged
 */
function createCombinedAndroidConfig(commonKeysets) {
  console.log('\n📦 Creating combined Android config...');

  const combinedConfig = {
    backgroundColor: 'default',
    defaultKeyset: 'abc',
    wordSuggestionsEnabled: true,
    autoCorrectEnabled: false,
    fontWeight: DEFAULT_FONT_WEIGHT,
    keyGap: DEFAULT_KEY_GAP,
    keyboards: ['he', 'en', 'ar'],
    defaultKeyboard: 'he',
    keysets: [],
    groups: [],
    allDiacritics: {},
    diacriticsSettings: {}
  };

  // Add keyHeight if specified
  if (DEFAULT_KEY_HEIGHT !== null) {
    combinedConfig.keyHeight = DEFAULT_KEY_HEIGHT;
  }

  // Add fontSize if specified
  if (DEFAULT_FONT_SIZE !== null) {
    combinedConfig.fontSize = DEFAULT_FONT_SIZE;
  }

  for (const config of KEYBOARD_CONFIGS) {
    const sourcePath = path.join(KEYBOARDS_DIR, config.sourceFile);
    
    try {
      if (!fs.existsSync(sourcePath)) continue;
      
      const sourceContent = fs.readFileSync(sourcePath, 'utf8');
      const sourceKeyboard = JSON.parse(sourceContent);
      
      const keyboardConfig = buildKeyboardConfig(sourceKeyboard, config, commonKeysets);
      
      // Prefix keyset IDs AND keyset references with language code
      const prefixedKeysets = keyboardConfig.keysets.map(keyset => {
        const newId = keyset.id === 'abc' ? `${config.language}_abc` : 
            keyset.id === '123' ? `${config.language}_123` :
            keyset.id === '#+=' ? `${config.language}_#+=` :
            `${config.language}_${keyset.id}`;
        
        // Also prefix keyset references in row keys
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
        
        // Set default diacriticsSettings with simpleMode: true for keyboards with diacritics
        combinedConfig.diacriticsSettings[config.language] = {
          simpleMode: true
        };
      }
      
    } catch (error) {
      console.log(`   ⚠️  Error processing ${config.sourceFile}: ${error.message}`);
    }
  }
  
  // Set default keyset to Hebrew abc
  combinedConfig.defaultKeyset = 'he_abc';
  
  const outputPath = path.join(ANDROID_ASSETS_DIR, 'default_config.json');
  fs.writeFileSync(outputPath, JSON.stringify(combinedConfig, null, 2), 'utf8');
  console.log(`   ✅ Created combined config: assets/default_config.json`);
  console.log(`   📊 Total keysets: ${combinedConfig.keysets.length}`);
}

/**
 * Copy dictionary files
 */
function copyDictionaryFiles() {
  console.log('\n📚 Copying dictionary files...');
  
  const dictSourceDir = path.join(__dirname, '..', 'dict', 'bin');
  const iosMainAppDir = path.join(IOS_DIR, 'IssieBoardNG');
  
  const dictFiles = ['he_50k.bin', 'en_50k.bin', 'ar_50k.bin'];
  
  // Copy to iOS main app
  for (const filename of dictFiles) {
    const sourcePath = path.join(dictSourceDir, filename);
    const targetPath = path.join(iosMainAppDir, filename);
    
    if (!fs.existsSync(sourcePath)) {
      console.log(`   ⚠️  Source dict not found: ${sourcePath}`);
      continue;
    }
    
    try {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`   ✅ iOS: ${filename}`);
    } catch (error) {
      console.log(`   ❌ Failed to copy ${filename}: ${error.message}`);
    }
  }
  
  // Copy to Android assets
  for (const filename of dictFiles) {
    const sourcePath = path.join(dictSourceDir, filename);
    const targetPath = path.join(ANDROID_ASSETS_DIR, filename);
    
    if (!fs.existsSync(sourcePath)) continue;
    
    try {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`   ✅ Android: ${filename}`);
    } catch (error) {
      console.log(`   ❌ Failed to copy ${filename}: ${error.message}`);
    }
  }
}

// Run the build
buildKeyboardConfigs();
copyDictionaryFiles();