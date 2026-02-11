const fs = require('fs');
const path = require('path');
const readline = require('readline');

// --- CONFIGURATION ---
const DICT_DIR = path.join(__dirname, '../dict');
const OUTPUT_DIR = path.join(__dirname, '../dict');
const MIN_OCCURRENCE = 3; // Minimum times a word pair must occur to be included
const MAX_PREDICTIONS_PER_WORD = 4;

/**
 * Extract word prediction data from a sentence corpus
 * Generates bigram probabilities: word1 → [word2_candidates]
 */

class PredictionExtractor {
    constructor(dictPath) {
        this.dictPath = dictPath;
        this.wordToIndex = new Map(); // word → index in dictionary
        this.indexToWord = new Map(); // index → word
        this.transitions = new Map(); // word1_index → Map(word2 → count)
        this.dictWords = new Set(); // Set of all dictionary words
    }

    /**
     * Load the dictionary file and build word↔index mappings
     * IMPORTANT: Must use the trie DFS traversal order (from he_trie_order.txt)
     */
    loadDictionary() {
        console.log(`Loading dictionary from ${this.dictPath}...`);
        
        if (!fs.existsSync(this.dictPath)) {
            throw new Error(`Dictionary file not found: ${this.dictPath}`);
        }

        // Determine language from path
        const filename = path.basename(this.dictPath);
        const langMatch = filename.match(/^([a-z]{2})_/);
        const lang = langMatch ? langMatch[1] : 'he';
        
        // Load the trie DFS order file
        const trieOrderPath = path.join(path.dirname(this.dictPath), 'bin', `${lang}_trie_order.txt`);
        
        if (!fs.existsSync(trieOrderPath)) {
            throw new Error(`Trie order file not found: ${trieOrderPath}\nPlease run: node scripts/extract_trie_order.js ${lang}`);
        }
        
        console.log(`  Loading trie DFS order from ${trieOrderPath}...`);
        const trieOrderContent = fs.readFileSync(trieOrderPath, 'utf8');
        const trieWords = trieOrderContent.split(/\r?\n/).filter(w => w.trim());
        
        console.log(`  Loaded ${trieWords.length} words in trie DFS order`);
        
        // Build index mappings using trie DFS order
        let index = 0;
        for (const word of trieWords) {
            const lowerWord = word.toLowerCase();
            this.wordToIndex.set(lowerWord, index);
            this.indexToWord.set(index, lowerWord);
            this.dictWords.add(lowerWord);
            index++;
        }
        
        console.log(`  Built word→index map with ${this.wordToIndex.size} words (trie DFS order)`);
    }

    /**
     * Process corpus file line by line to extract word transitions
     */
    async processCorpus(corpusPath) {
        console.log(`\nProcessing corpus: ${corpusPath}`);
        
        if (!fs.existsSync(corpusPath)) {
            throw new Error(`Corpus file not found: ${corpusPath}`);
        }

        const fileStream = fs.createReadStream(corpusPath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let lineCount = 0;
        let processedLines = 0;
        
        for await (const line of rl) {
            lineCount++;
            
            // Skip empty lines and the line number prefix
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            // Remove line number prefix (e.g., "123\t")
            const tabIndex = trimmed.indexOf('\t');
            const sentence = tabIndex >= 0 ? trimmed.substring(tabIndex + 1) : trimmed;
            
            if (!sentence || sentence.startsWith('"') === false) continue;
            
            // Remove quotes
            const cleanSentence = sentence.replace(/^"(.*)"$/, '$1').trim();
            if (!cleanSentence) continue;
            
            this.processSentence(cleanSentence);
            processedLines++;
            
            if (processedLines % 10000 === 0) {
                console.log(`  Processed ${processedLines} sentences (${lineCount} lines total)...`);
            }
        }
        
        console.log(`  Completed: ${processedLines} sentences processed from ${lineCount} lines`);
    }

    /**
     * Extract word pairs from a single sentence
     */
    processSentence(sentence) {
        // Tokenize: split by whitespace and punctuation
        const tokens = sentence
            .toLowerCase()
            .split(/[\s,;:.!?()[\]{}""''«»—–-]+/)
            .filter(token => token.length > 0);
        
        // Extract word pairs (bigrams)
        for (let i = 0; i < tokens.length - 1; i++) {
            const word1 = tokens[i];
            const word2 = tokens[i + 1];
            
            // Only track if word1 is in dictionary (we predict from known words)
            if (!this.wordToIndex.has(word1)) continue;
            if (!word2 || word2.length === 0) continue;
            
            const word1Index = this.wordToIndex.get(word1);
            
            if (!this.transitions.has(word1Index)) {
                this.transitions.set(word1Index, new Map());
            }
            
            const word2Counts = this.transitions.get(word1Index);
            word2Counts.set(word2, (word2Counts.get(word2) || 0) + 1);
        }
    }

    /**
     * Calculate probabilities and generate prediction data
     */
    generatePredictions() {
        console.log(`\nGenerating predictions...`);
        
        const predictions = {};
        let totalSourceWords = 0;
        let totalPredictions = 0;
        let inDictCount = 0;
        let outDictCount = 0;
        
        for (const [word1Index, word2Counts] of this.transitions.entries()) {
            // Filter out low-frequency pairs
            const filteredCounts = Array.from(word2Counts.entries())
                .filter(([_, count]) => count >= MIN_OCCURRENCE);
            
            if (filteredCounts.length === 0) continue;
            
            // Calculate total occurrences for this source word
            const total = filteredCounts.reduce((sum, [_, count]) => sum + count, 0);
            
            // Sort by count (descending) and take top N
            const topPredictions = filteredCounts
                .sort((a, b) => b[1] - a[1])
                .slice(0, MAX_PREDICTIONS_PER_WORD)
                .map(([word2, count]) => {
                    const probability = count / total;
                    
                    // Check if word2 is in dictionary
                    if (this.dictWords.has(word2)) {
                        inDictCount++;
                        return {
                            type: 'index',
                            word_index: this.wordToIndex.get(word2),
                            prob: Math.round(probability * 255) // Scale to 0-255
                        };
                    } else {
                        outDictCount++;
                        return {
                            type: 'full',
                            word: word2,
                            prob: Math.round(probability * 255)
                        };
                    }
                });
            
            predictions[word1Index] = topPredictions;
            totalSourceWords++;
            totalPredictions += topPredictions.length;
        }
        
        console.log(`  Generated predictions for ${totalSourceWords} source words`);
        console.log(`  Total predictions: ${totalPredictions}`);
        console.log(`  In-dictionary predictions: ${inDictCount} (${Math.round(inDictCount/totalPredictions*100)}%)`);
        console.log(`  Out-of-dictionary predictions: ${outDictCount} (${Math.round(outDictCount/totalPredictions*100)}%)`);
        
        return predictions;
    }

    /**
     * Save predictions to JSON file
     */
    savePredictions(predictions, outputPath) {
        console.log(`\nSaving predictions to ${outputPath}...`);
        
        const json = JSON.stringify(predictions, null, 2);
        fs.writeFileSync(outputPath, json, 'utf8');
        
        const sizeKB = Math.round(json.length / 1024);
        console.log(`  Saved ${sizeKB} KB`);
    }
}

/**
 * Main execution
 */
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.error('Usage: node extract_word_predictions.js <dict_file> <corpus_file>');
        console.error('Example: node extract_word_predictions.js dict/he_50k.txt dict/heb_news_2020_100K-sentences.txt');
        process.exit(1);
    }
    
    const dictPath = path.resolve(args[0]);
    const corpusPath = path.resolve(args[1]);
    
    // Determine language from dictionary filename
    const dictFilename = path.basename(dictPath);
    const langMatch = dictFilename.match(/^([a-z]{2})_/);
    const lang = langMatch ? langMatch[1] : 'he';
    
    const outputPath = path.join(OUTPUT_DIR, `${lang}_predictions.json`);
    
    console.log('=== Word Prediction Extraction ===');
    console.log(`Language: ${lang}`);
    console.log(`Dictionary: ${dictPath}`);
    console.log(`Corpus: ${corpusPath}`);
    console.log(`Output: ${outputPath}`);
    console.log('');
    
    try {
        const extractor = new PredictionExtractor(dictPath);
        
        // Step 1: Load dictionary
        extractor.loadDictionary();
        
        // Step 2: Process corpus
        await extractor.processCorpus(corpusPath);
        
        // Step 3: Generate predictions
        const predictions = extractor.generatePredictions();
        
        // Step 4: Save to JSON
        extractor.savePredictions(predictions, outputPath);
        
        console.log('\n✅ Extraction complete!');
        console.log(`Next step: Run build_prediction_binary.js to convert JSON to binary format`);
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

main();