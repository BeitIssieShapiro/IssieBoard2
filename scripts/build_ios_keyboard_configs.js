#!/usr/bin/env node

/**
 * Build iOS Keyboard Configs
 * 
 * This script generates the default_config.json files for each iOS keyboard extension
 * from the source keyboard definitions in keyboards/*.json
 * 
 * Source files: keyboards/he.json, keyboards/en.json, keyboards/ar.json
 * Output files: ios/IssieBoardHe/default_config.json, ios/IssieBoardEn/default_config.json, ios/IssieBoardAr/default_config.json
 * 
 * Usage: node scripts/build_ios_keyboard_configs.js
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
    systemRowAtTop: true, // Add system row (settings, backspace, enter, close) at top
  },
  {
    sourceFile: 'en.json',
    targetDir: 'IssieBoardEn',
    language: 'en',
    systemRowAtTop: true,
  },
  {
    sourceFile: 'ar.json',
    targetDir: 'IssieBoardAr',
    language: 'ar',
    systemRowAtTop: true,
  },
];

// Default iOS keyboard config template
const DEFAULT_CONFIG_TEMPLATE = {
  backgroundColor: '#E0E0E0',
  defaultKeyset: 'abc',
  wordSuggestionsEnabled: true,
  groups: [
    {
      items: [],
      template: { color: '#000000', bgColor: '#FFFFFF' }
    },
    {
      items: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
      template: { color: '#000000', bgColor: '#E8E8E8' }
    }
  ]
};

// System row that gets added at the top of each keyset
const SYSTEM_ROW = {
  keys: [
    { type: 'settings' },
    { type: 'backspace', width: 1.5 },
    { type: 'enter' },
    { type: 'close' }
  ]
};

/**
 * Convert "language" type keys to "next-keyboard" for iOS
 * iOS uses advanceToNextInputMode() instead of internal language switching
 */
function convertLanguageToNextKeyboard(key) {
  if (key.type === 'language') {
    return { ...key, type: 'next-keyboard' };
  }
  return key;
}

/**
 * Process a keyset to add system row and convert language keys
 */
function processKeyset(keyset, addSystemRow) {
  const processedKeyset = { ...keyset };
  
  // Process all rows
  processedKeyset.rows = keyset.rows.map(row => ({
    ...row,
    keys: row.keys.map(convertLanguageToNextKeyboard)
  }));
  
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
  if (language === 'ar') {
    return ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  }
  return ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
}

/**
 * Build iOS config from source keyboard definition
 */
function buildIOSConfig(sourceKeyboard, config) {
  const iosConfig = { ...DEFAULT_CONFIG_TEMPLATE };
  
  // Set language-specific properties
  iosConfig.keyboards = [config.language];
  iosConfig.defaultKeyboard = config.language;
  iosConfig.keyboardLanguage = config.language;
  
  // Copy diacritics if present
  if (sourceKeyboard.diacritics) {
    iosConfig.diacritics = sourceKeyboard.diacritics;
  }
  
  // Process keysets
  if (sourceKeyboard.keysets && Array.isArray(sourceKeyboard.keysets)) {
    iosConfig.keysets = sourceKeyboard.keysets.map(keyset => 
      processKeyset(keyset, config.systemRowAtTop)
    );
  }
  
  // Set default keyset from source or use 'abc'
  iosConfig.defaultKeyset = sourceKeyboard.defaultKeyset || 'abc';
  
  // Set up groups with language-specific letters
  iosConfig.groups = [
    {
      items: getLetterItems(config.language),
      template: { color: '#000000', bgColor: '#FFFFFF' }
    },
    {
      items: getNumberItems(config.language),
      template: { color: '#000000', bgColor: '#E8E8E8' }
    }
  ];
  
  return iosConfig;
}

/**
 * Main build function
 */
function buildKeyboardConfigs() {
  console.log('🔨 Building iOS keyboard configs...\n');
  
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
      const iosConfig = buildIOSConfig(sourceKeyboard, config);
      
      // Write output
      const outputContent = JSON.stringify(iosConfig, null, 2);
      fs.writeFileSync(targetPath, outputContent, 'utf8');
      
      console.log(`   ✅ Generated config with ${iosConfig.keysets?.length || 0} keysets`);
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

// Run the build
buildKeyboardConfigs();