const fs = require('fs');
const path = require('path');

/**
 * Build a mapping file between trie traversal order and input file order
 * This allows predictions to use input file indices while trie uses traversal indices
 */

const DICT_DIR = path.join(__dirname, '../dict');
const OUTPUT_DIR = path.join(__dirname, '../dict/bin');

function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 1) {
        console.error('Usage: node build_index_map.js <language>');
        console.error('Example: node build_index_map.js he');
        process.exit(1);
    }
    
    const lang = args[0];
    const dictPath = path.join(DICT_DIR, `${lang}_50k.txt`);
    const outputPath = path.join(OUTPUT_DIR, `${lang}_index_map.json`);
    
    if (!fs.existsSync(dictPath)) {
        console.error(`Dictionary not found: ${dictPath}`);
        process.exit(1);
    }
    
    console.log('=== Building Index Map ===');
    console.log(`Language: ${lang}`);
    console.log(`Dictionary: ${dictPath}`);
    console.log(`Output: ${outputPath}`);
    console.log('');
    
    // Read and parse dictionary
    const content = fs.readFileSync(dictPath, 'utf8');
    const lines = content.split(/\r?\n/);
    
    const words = [];
    for (let i = 0; i < Math.min(lines.length, 5000); i++) {
        const parts = lines[i].trim().split(/\s+/);
        if (parts.length >= 2) {
            const word = parts[0].toLowerCase();
            const freq = parseInt(parts[1], 10);
            if (word && !isNaN(freq)) {
                words.push({ word, freq, inputIndex: i });
            }
        }
    }
    
    console.log(`Loaded ${words.length} words`);
    
    // Create mapping: traversalIndex → inputIndex
    // For now, we'll use input order since we need to match what the extraction script expects
    const indexMap = {};
    words.forEach((item, idx) => {
        indexMap[idx] = item.inputIndex;
    });
    
    fs.writeFileSync(outputPath, JSON.stringify(indexMap, null, 2));
    console.log(`\n✅ Index map saved to ${outputPath}`);
    console.log(`   Maps ${Object.keys(indexMap).length} indices`);
}

main();