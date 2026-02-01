#!/usr/bin/env node

/**
 * Build iOS Keyboard Configs
 * 
 * This script generates the default_config.json files for each iOS keyboard extension
 * from the source keyboard definitions in keyboards/*.json
 * 
 * The script merges common keysets (from common.js) with language-specific keysets,
 * filtering keys by language and appending the "alwaysInclude" bottom row.
 * 
 * Source files: keyboards/he.json, keyboards/en.json, keyboards/ar.json, keyboards/common.js
 * Output files: ios/IssieBoardHe/default_config.json, ios/IssieBoardEn/default_config.json, ios/IssieBoardAr/default_config.json
 * 
 * Usage: node scripts/build_ios_keyboard_configs.js
 * 
 * NOTE: The keyboard merging logic in this file is duplicated in:
 *   src/utils/keyboardConfigMerger.ts
 * 
 * The TypeScript module is used by the React Native settings app for runtime config building.
 * If you modify the merging logic here, please update the TypeScript version as well.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const KEYBOARDS_DIR = path.join(__dirname, '..', 'keyboards');
const IOS_DIR = path.join(__dirname, '..', 'ios');

// Keyboard configurations
const KEYBOARD_CONFIGS = [
  {
    sourceFile: 'he.json',
    targetDir: 'IssieBoardHe',
    language: 'he',
    systemRowAtTop: false,
  },
  {
    sourceFile: 'en.json',
    targetDir: 'IssieBoardEn',
    language: 'en',
    systemRowAtTop: false,
  },
  {
    sourceFile: 'ar.json',
    targetDir: 'IssieBoardAr',
    language: 'ar',
    systemRowAtTop: false,
  },
];

// Default iOS keyboard config template
const DEFAULT_CONFIG_TEMPLATE = {
  backgroundColor: 'default',  // Uses system light/dark theme colors
  defaultKeyset: 'abc',
  wordSuggestionsEnabled: true,
  groups: []
};

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
  
  // Clear require cache to ensure fresh load
  delete require.cache[require.resolve(commonPath)];
  const common = require(commonPath);
  return common.keysets || [];
}

/**
 * Filter keys by language
 * Keys with forLanguages array are only included if the language matches
 * Keys without forLanguages are included for all languages
 */
function filterKeysByLanguage(keys, language) {
  return keys.filter(key => {
    if (!key.forLanguages) {
      return true;  // No language restriction
    }
    return key.forLanguages.includes(language);
  }).map(key => {
    // Remove forLanguages from the output (it's build-time only)
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
function transformKeysetButtonForTarget(key, targetKeysetId) {
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
 * Find alwaysInclude keys from non-alwaysInclude rows in the abc keyset
 * Returns an object with:
 * - prependKeys: array of keys to prepend to the LAST content row
 * - appendKeys: array of keys to append to the LAST content row
 * 
 * For simplicity, all alwaysInclude keys are applied to the LAST content row
 * of the target keyset, regardless of which row they came from in the source.
 * This is because the "last content row" typically has utility keys like backspace,
 * keyset switchers, etc.
 */
function findAlwaysIncludeKeys(sourceKeyboard) {
  const abcKeyset = sourceKeyboard.keysets?.find(ks => ks.id === 'abc');
  if (!abcKeyset) return { prependKeys: [], appendKeys: [] };
  
  const prependKeys = [];
  const appendKeys = [];
  
  (abcKeyset.rows || []).forEach((row) => {
    // Skip rows that are themselves alwaysInclude (those are handled separately)
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
        // Keys in the middle are ignored (per spec: "only works if the key is first or last in a row")
      }
    });
  });
  
  return { prependKeys, appendKeys };
}

/**
 * Apply alwaysInclude keys to a common keyset's rows
 * - prependKeys: prepend to the beginning of the LAST row
 * - appendKeys: append to the end of the LAST row
 */
function applyAlwaysIncludeKeys(rows, prependKeys, appendKeys) {
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
    
    // Filter keys by language
    let filteredRows = filterRowsByLanguage(commonKeyset.rows, language);
    
    // Apply alwaysInclude keys (prepend/append) to rows
    filteredRows = applyAlwaysIncludeKeys(filteredRows, prependKeys, appendKeys);
    
    // Create merged keyset
    const mergedKeyset = {
      id: commonKeyset.id,
      rows: [...filteredRows]
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
 * Process a keyset to add system row and convert language keys
 */
function processKeyset(keyset, addSystemRow) {
  const processedKeyset = { ...keyset };
  
  // Process all rows - remove alwaysInclude property from output
  processedKeyset.rows = keyset.rows.map(row => {
    const { alwaysInclude, ...rowWithoutAlwaysInclude } = row;
    return {
      ...rowWithoutAlwaysInclude,
      keys: row.keys,
    };
  });
  
  // Add system row at the top if requested
  if (addSystemRow) {
    processedKeyset.rows = [SYSTEM_ROW, ...processedKeyset.rows];
  }
  
  return processedKeyset;
}

/**
 * Get letter items for groups based on language
 */
function getLetterItems(language) {
  switch (language) {
    case 'he':
      return ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'כ', 'ך', 'ל', 'מ', 'ם', 'נ', 'ן', 'ס', 'ע', 'פ', 'ף', 'צ', 'ץ', 'ק', 'ר', 'ש', 'ת'];
    case 'ar':
      return ['ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي', 'ء', 'ؤ', 'ئ', 'ة', 'ى'];
    case 'en':
    default:
      return ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
  }
}

/**
 * Get number items for groups based on language
 */
function getNumberItems(language) {
  // All languages now use Western numerals (modern)
  return ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
}

/**
 * Build iOS config from source keyboard definition
 */
function buildIOSConfig(sourceKeyboard, config, commonKeysets) {
  const iosConfig = { ...DEFAULT_CONFIG_TEMPLATE };
  
  // Set language-specific properties
  iosConfig.keyboards = [config.language];
  iosConfig.defaultKeyboard = config.language;
  iosConfig.keyboardLanguage = config.language;
  
  // Copy diacritics if present
  if (sourceKeyboard.diacritics) {
    iosConfig.diacritics = sourceKeyboard.diacritics;
  }
  
  // Start with language-specific keysets
  let allKeysets = [];
  
  // Process language-specific keysets (abc, etc.)
  if (sourceKeyboard.keysets && Array.isArray(sourceKeyboard.keysets)) {
    allKeysets = sourceKeyboard.keysets.map(keyset => 
      processKeyset(keyset, config.systemRowAtTop)
    );
  }
  
  // Merge common keysets if includeKeysets is specified
  if (sourceKeyboard.includeKeysets && sourceKeyboard.includeKeysets.length > 0) {
    const mergedCommonKeysets = mergeCommonKeysets(commonKeysets, sourceKeyboard, config.language);
    
    // Process merged keysets (add system row if needed)
    const processedMergedKeysets = mergedCommonKeysets.map(keyset =>
      processKeyset(keyset, config.systemRowAtTop)
    );
    
    // Add merged keysets to the config
    allKeysets = [...allKeysets, ...processedMergedKeysets];
  }
  
  iosConfig.keysets = allKeysets;
  
  // Set default keyset from source or use 'abc'
  iosConfig.defaultKeyset = sourceKeyboard.defaultKeyset || 'abc';
  
  // Set up groups (empty by default)
  iosConfig.groups = [];
  
  return iosConfig;
}

/**
 * Main build function
 */
function buildKeyboardConfigs() {
  console.log('🔨 Building iOS keyboard configs...\n');
  
  // Load common keysets
  console.log('📦 Loading common keysets...');
  const commonKeysets = loadCommonKeysets();
  console.log(`   Found ${commonKeysets.length} common keysets: ${commonKeysets.map(k => k.id).join(', ')}\n`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const config of KEYBOARD_CONFIGS) {
    const sourcePath = path.join(KEYBOARDS_DIR, config.sourceFile);
    const targetPath = path.join(IOS_DIR, config.targetDir, 'default_config.json');
    
    console.log(`📄 Processing ${config.sourceFile} → ${config.targetDir}/default_config.json`);
    
    try {
      // Check if source file exists
      if (!fs.existsSync(sourcePath)) {
        console.log(`   ⚠️  Source file not found: ${sourcePath}`);
        errorCount++;
        continue;
      }
      
      // Check if target directory exists
      const targetDir = path.join(IOS_DIR, config.targetDir);
      if (!fs.existsSync(targetDir)) {
        console.log(`   📁 Creating directory: ${targetDir}`);
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      // Read source keyboard definition
      const sourceContent = fs.readFileSync(sourcePath, 'utf8');
      const sourceKeyboard = JSON.parse(sourceContent);
      
      // Build iOS config
      const iosConfig = buildIOSConfig(sourceKeyboard, config, commonKeysets);
      
      // Write output
      const outputContent = JSON.stringify(iosConfig, null, 2);
      fs.writeFileSync(targetPath, outputContent, 'utf8');
      
      // Count keysets
      const langKeysets = sourceKeyboard.keysets?.length || 0;
      const includedKeysets = sourceKeyboard.includeKeysets?.length || 0;
      console.log(`   ✅ Generated config with ${iosConfig.keysets?.length || 0} keysets (${langKeysets} language + ${includedKeysets} common)`);
      successCount++;
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log(`\n📊 Build complete: ${successCount} succeeded, ${errorCount} failed`);
  
  if (errorCount > 0) {
    process.exit(1);
  }
}

/**
 * Copy dictionary files to iOS main app for preview functionality
 * The keyboard preview in the main app also needs the dictionary files
 * to show word suggestions.
 */
function copyDictionaryFilesToMainApp() {
  console.log('\n📚 Copying dictionary files to main app...');
  
  const dictSourceDir = path.join(__dirname, '..', 'dict', 'bin');
  const mainAppDir = path.join(IOS_DIR, 'IssieBoardNG');
  
  const dictFiles = ['he_50k.bin', 'en_50k.bin', 'ar_50k.bin'];
  
  for (const filename of dictFiles) {
    const sourcePath = path.join(dictSourceDir, filename);
    const targetPath = path.join(mainAppDir, filename);
    
    if (!fs.existsSync(sourcePath)) {
      console.log(`   ⚠️  Source dict not found: ${sourcePath}`);
      continue;
    }
    
    try {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`   ✅ Copied ${filename} to main app`);
    } catch (error) {
      console.log(`   ❌ Failed to copy ${filename}: ${error.message}`);
    }
  }
}

// Run the build
buildKeyboardConfigs();

// Also copy dictionary files to main app
copyDictionaryFilesToMainApp();
