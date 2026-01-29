const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const INPUT_DIR = path.join(__dirname, '../dict');
const OUTPUT_DIR = path.join(__dirname, '../dict/bin');
const NODE_SIZE = 12;
const MAX_WORDS = 5000;

class TrieNode {
    constructor(char) {
        this.char = char;
        this.children = {}; 
        this.isWordEnd = false;
        
        this.score = 0;    // Frequency of this specific word
        this.maxScore = 0; // Highest frequency found in this entire subtree
        
        // Flattening properties
        this.index = -1;
        this.firstChildIndex = -1;
        this.nextSiblingIndex = -1;
    }
}

function buildTree(wordList) {
    const root = new TrieNode('');
    let count = 0;

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
        node.score = freq; // Store the raw frequency on the end node
        count++;
    }
    return { root, count };
}

// NEW: Recursive function to bubble up the "Best Score" from bottom to top
function computeMaxScores(node) {
    let best = node.score; // Start with self score
    
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

function flattenTree(root) {
    const flatNodes = [];
    const queue = [root];
    
    let currentIndex = 0;
    while (queue.length > 0) {
        const node = queue.shift();
        node.index = currentIndex++;
        flatNodes.push(node);
        
        // CRITICAL CHANGE: Sort children by maxScore (Descending)
        // This ensures 'h' (from 'the') is visited before 'a' (from 'table')
        const sortedChildren = Object.values(node.children).sort((a, b) => {
            return b.maxScore - a.maxScore; 
        });
        
        sortedChildren.forEach(child => {
            queue.push(child);
        });
    }

    // Pass 2: Resolve Pointers using the same sorted order
    for (const node of flatNodes) {
        // Sort again to ensure we link them in the exact same order we queued them
        const sortedChildren = Object.values(node.children).sort((a, b) => {
            return b.maxScore - a.maxScore;
        });
        
        if (sortedChildren.length > 0) {
            // First Child is now the most frequent one
            node.firstChildIndex = sortedChildren[0].index;
            
            // Link Siblings in descending frequency order
            for (let i = 0; i < sortedChildren.length - 1; i++) {
                const current = sortedChildren[i];
                const next = sortedChildren[i + 1];
                current.nextSiblingIndex = next.index;
            }
        }
    }
    
    return flatNodes;
}

function writeBinary(flatNodes, outputPath) {
    const bufferSize = flatNodes.length * NODE_SIZE;
    const buffer = Buffer.alloc(bufferSize);
    
    flatNodes.forEach((node) => {
        const offset = node.index * NODE_SIZE;
        
        const charCode = node.char ? node.char.charCodeAt(0) : 0;
        buffer.writeUInt16LE(charCode, offset);
        
        const flags = node.isWordEnd ? 1 : 0;
        buffer.writeUInt16LE(flags, offset + 2);
        
        buffer.writeInt32LE(node.firstChildIndex, offset + 4);
        buffer.writeInt32LE(node.nextSiblingIndex, offset + 8);
    });
    
    fs.writeFileSync(outputPath, buffer);
    return bufferSize;
}

function main() {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    if (!fs.existsSync(INPUT_DIR)) { console.error("No dict folder"); return; }

    const files = fs.readdirSync(INPUT_DIR).filter(file => file.endsWith('.txt'));

    files.forEach(file => {
        const inputPath = path.join(INPUT_DIR, file);
        const fileNameNoExt = path.parse(file).name;
        const outputPath = path.join(OUTPUT_DIR, `${fileNameNoExt}.bin`);

        try {
            console.log(`Processing ${file}...`);
            const content = fs.readFileSync(inputPath, 'utf8');
            const lines = content.split(/\r?\n/);
            
            const wordList = [];
            
            for (const line of lines) {
                if (wordList.length >= MAX_WORDS) break;
                
                // Parse "the 22761659"
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 2) {
                    const word = parts[0];
                    const freq = parseInt(parts[1], 10); // Capture frequency
                    
                    if (word && !isNaN(freq)) {
                         wordList.push({ word, freq });
                    }
                }
            }
            
            const { root, count } = buildTree(wordList);
            
            // NEW STEP: Calculate weights
            computeMaxScores(root);
            
            const flatList = flattenTree(root);
            writeBinary(flatList, outputPath);
            
            console.log(`  - Saved ${count} words (Sorted by Freq) to ${fileNameNoExt}.bin`);
            
        } catch (err) {
            console.error(`Error:`, err.message);
        }
    });
}

main();