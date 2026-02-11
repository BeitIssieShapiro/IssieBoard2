const fs = require('fs');
const path = require('path');

/**
 * Extract the DFS traversal order of words from a trie
 * This gives us the same index that TrieEngine.getWordIndex() will return
 */

const INPUT_DIR = path.join(__dirname, '../dict');
const OUTPUT_DIR = path.join(__dirname, '../dict/bin');
const MAX_WORDS = 5000;

class TrieNode {
    constructor(char) {
        this.char = char;
        this.children = {};
        this.isWordEnd = false;
        this.score = 0;
        this.maxScore = 0;
    }
}

function buildTree(wordList) {
    const root = new TrieNode('');
    
    for (const item of wordList) {
        const { word, freq } = item;
        let node = root;
        
        for (let i = 0; i < word.length; i++) {
            const char = word[i];
            if (!node.children[char]) {
                node.children[char] = new TrieNode(char);
            }
            node = node.children[char];
        }
        node.isWordEnd = true;
        node.score = freq;
    }
    
    return root;
}

function computeMaxScores(node) {
    let best = node.score;
    for (const key in node.children) {
        const child = node.children[key];
        const childMax = computeMaxScores(child);
        if (childMax > best) {
            best = childMax;
        }
    }
    node.maxScore = best;
    return best;
}

function extractDFSOrder(node, path = '', words = []) {
    // If this is a word end, add it
    if (node.isWordEnd && path !== '') {
        words.push(path);
    }
    
    // Sort children by maxScore (descending) - SAME as trie flattening
    const sortedChildren = Object.entries(node.children)
        .sort((a, b) => b[1].maxScore - a[1].maxScore);
    
    // Visit children in sorted order
    for (const [char, child] of sortedChildren) {
        extractDFSOrder(child, path + char, words);
    }
    
    return words;
}

function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 1) {
        console.error('Usage: node extract_trie_order.js <language>');
        console.error('Example: node extract_trie_order.js he');
        process.exit(1);
    }
    
    const lang = args[0];
    const dictPath = path.join(INPUT_DIR, `${lang}_50k.txt`);
    const outputPath = path.join(OUTPUT_DIR, `${lang}_trie_order.txt`);
    
    console.log('=== Extracting Trie DFS Order ===');
    console.log(`Language: ${lang}`);
    console.log(`Dictionary: ${dictPath}`);
    console.log(`Output: ${outputPath}`);
    console.log('');
    
    // Load dictionary
    const content = fs.readFileSync(dictPath, 'utf8');
    const lines = content.split(/\r?\n/);
    
    const wordList = [];
    for (let i = 0; i < Math.min(lines.length, MAX_WORDS); i++) {
        const parts = lines[i].trim().split(/\s+/);
        if (parts.length >= 2) {
            const word = parts[0];
            const freq = parseInt(parts[1], 10);
            if (word && !isNaN(freq)) {
                wordList.push({ word, freq });
            }
        }
    }
    
    console.log(`Loaded ${wordList.length} words`);
    
    // Build trie
    const root = buildTree(wordList);
    computeMaxScores(root);
    
    // Extract DFS order
    const dfsOrder = extractDFSOrder(root);
    
    console.log(`Extracted ${dfsOrder.length} words in DFS order`);
    
    // Write to file (one word per line)
    fs.writeFileSync(outputPath, dfsOrder.join('\n') + '\n');
    
    // Check position of מה
    const targetIndex = dfsOrder.findIndex(w => w === 'מה');
    console.log(`\n'מה' is at DFS index: ${targetIndex}`);
    
    console.log(`\n✅ Trie order extracted!`);
    console.log(`Use this file with extract_word_predictions.js to ensure matching indices`);
}

main();