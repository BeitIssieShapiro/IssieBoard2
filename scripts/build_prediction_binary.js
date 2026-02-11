const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const INPUT_DIR = path.join(__dirname, '../dict');
const OUTPUT_DIR = path.join(__dirname, '../dict/bin');

/**
 * Build binary prediction file from JSON predictions
 * 
 * Binary Format:
 * [Header - 8 bytes]
 *   magic_number: uint32 (0x50524544 = "PRED")
 *   entry_count: uint32
 * 
 * [Index Section - entry_count × 6 bytes]
 *   For each entry (sorted by word_index):
 *     word_index: uint16
 *     offset: uint32 (byte offset to prediction data)
 * 
 * [Prediction Data Section - variable size]
 *   For each source word:
 *     prediction_count: uint8
 *     predictions: (repeated prediction_count times)
 *       type: uint8 (0=dict_index, 1=full_word)
 *       probability: uint8 (0-255)
 *       data:
 *         IF type==0: word_index: uint16
 *         IF type==1: word_length: uint8, utf8_bytes
 */

class PredictionBinaryBuilder {
    constructor(jsonPath) {
        this.jsonPath = jsonPath;
        this.predictions = null;
        this.MAGIC_NUMBER = 0x50524544; // "PRED" in ASCII
    }

    /**
     * Load predictions from JSON file
     */
    loadPredictions() {
        console.log(`Loading predictions from ${this.jsonPath}...`);
        
        if (!fs.existsSync(this.jsonPath)) {
            throw new Error(`JSON file not found: ${this.jsonPath}`);
        }

        const content = fs.readFileSync(this.jsonPath, 'utf8');
        this.predictions = JSON.parse(content);
        
        const entryCount = Object.keys(this.predictions).length;
        console.log(`  Loaded predictions for ${entryCount} source words`);
    }

    /**
     * Build binary file
     */
    buildBinary(outputPath) {
        console.log(`\nBuilding binary file...`);
        
        // Sort entries by word index (for binary search)
        const sortedEntries = Object.entries(this.predictions)
            .map(([indexStr, predictions]) => ({
                wordIndex: parseInt(indexStr),
                predictions: predictions
            }))
            .sort((a, b) => a.wordIndex - b.wordIndex);
        
        console.log(`  Sorted ${sortedEntries.length} entries by word index`);
        
        // Calculate offsets and build prediction data
        const predictionDataBuffers = [];
        const indexEntries = [];
        let currentOffset = 8 + (sortedEntries.length * 6); // Header + Index section
        
        for (const entry of sortedEntries) {
            // Build prediction data for this word
            const dataBuffer = this.buildPredictionData(entry.predictions);
            predictionDataBuffers.push(dataBuffer);
            
            // Store index entry
            indexEntries.push({
                wordIndex: entry.wordIndex,
                offset: currentOffset
            });
            
            currentOffset += dataBuffer.length;
        }
        
        console.log(`  Built prediction data sections`);
        
        // Calculate total size
        const headerSize = 8;
        const indexSize = sortedEntries.length * 6;
        const dataSize = predictionDataBuffers.reduce((sum, buf) => sum + buf.length, 0);
        const totalSize = headerSize + indexSize + dataSize;
        
        console.log(`  Total size: ${totalSize} bytes (${Math.round(totalSize/1024)} KB)`);
        console.log(`    Header: ${headerSize} bytes`);
        console.log(`    Index: ${indexSize} bytes`);
        console.log(`    Data: ${dataSize} bytes`);
        
        // Allocate buffer
        const buffer = Buffer.alloc(totalSize);
        let offset = 0;
        
        // Write header
        buffer.writeUInt32LE(this.MAGIC_NUMBER, offset);
        offset += 4;
        buffer.writeUInt32LE(sortedEntries.length, offset);
        offset += 4;
        
        // Write index section
        for (const indexEntry of indexEntries) {
            buffer.writeUInt16LE(indexEntry.wordIndex, offset);
            offset += 2;
            buffer.writeUInt32LE(indexEntry.offset, offset);
            offset += 4;
        }
        
        // Write prediction data section
        for (const dataBuffer of predictionDataBuffers) {
            dataBuffer.copy(buffer, offset);
            offset += dataBuffer.length;
        }
        
        // Write to file
        fs.writeFileSync(outputPath, buffer);
        console.log(`  Written to ${outputPath}`);
        
        return {
            totalSize,
            entryCount: sortedEntries.length,
            avgPredictions: dataSize / sortedEntries.length
        };
    }

    /**
     * Build prediction data for a single source word
     */
    buildPredictionData(predictions) {
        const buffers = [];
        
        // Write prediction count
        const countBuffer = Buffer.alloc(1);
        countBuffer.writeUInt8(predictions.length, 0);
        buffers.push(countBuffer);
        
        // Write each prediction
        for (const pred of predictions) {
            if (pred.type === 'index') {
                // Type 0: Dictionary index reference
                const predBuffer = Buffer.alloc(4);
                predBuffer.writeUInt8(0, 0); // type
                predBuffer.writeUInt8(pred.prob, 1); // probability
                predBuffer.writeUInt16LE(pred.word_index, 2); // word index
                buffers.push(predBuffer);
                
            } else if (pred.type === 'full') {
                // Type 1: Full word stored inline
                const wordBuffer = Buffer.from(pred.word, 'utf8');
                const predBuffer = Buffer.alloc(3 + wordBuffer.length);
                predBuffer.writeUInt8(1, 0); // type
                predBuffer.writeUInt8(pred.prob, 1); // probability
                predBuffer.writeUInt8(wordBuffer.length, 2); // word length
                wordBuffer.copy(predBuffer, 3); // word bytes
                buffers.push(predBuffer);
            }
        }
        
        return Buffer.concat(buffers);
    }

    /**
     * Verify the binary file can be read correctly
     */
    verifyBinary(binaryPath) {
        console.log(`\nVerifying binary file...`);
        
        const buffer = fs.readFileSync(binaryPath);
        
        // Read header
        const magic = buffer.readUInt32LE(0);
        const entryCount = buffer.readUInt32LE(4);
        
        if (magic !== this.MAGIC_NUMBER) {
            throw new Error(`Invalid magic number: 0x${magic.toString(16)}`);
        }
        
        console.log(`  Magic number: OK (0x${magic.toString(16)})`);
        console.log(`  Entry count: ${entryCount}`);
        
        // Verify a few random entries
        const entriesToCheck = Math.min(5, entryCount);
        console.log(`  Checking ${entriesToCheck} random entries...`);
        
        for (let i = 0; i < entriesToCheck; i++) {
            const randomIdx = Math.floor(Math.random() * entryCount);
            const indexOffset = 8 + (randomIdx * 6);
            
            const wordIndex = buffer.readUInt16LE(indexOffset);
            const dataOffset = buffer.readUInt32LE(indexOffset + 2);
            const predCount = buffer.readUInt8(dataOffset);
            
            console.log(`    Entry ${randomIdx}: word_index=${wordIndex}, offset=${dataOffset}, predictions=${predCount}`);
        }
        
        console.log(`  ✅ Verification passed`);
    }
}

/**
 * Main execution
 */
function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 1) {
        console.error('Usage: node build_prediction_binary.js <language>');
        console.error('Example: node build_prediction_binary.js he');
        process.exit(1);
    }
    
    const lang = args[0];
    const jsonPath = path.join(INPUT_DIR, `${lang}_predictions.json`);
    const outputPath = path.join(OUTPUT_DIR, `${lang}_predictions.bin`);
    
    // Create output directory if needed
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    console.log('=== Prediction Binary Builder ===');
    console.log(`Language: ${lang}`);
    console.log(`Input: ${jsonPath}`);
    console.log(`Output: ${outputPath}`);
    console.log('');
    
    try {
        const builder = new PredictionBinaryBuilder(jsonPath);
        
        // Step 1: Load JSON
        builder.loadPredictions();
        
        // Step 2: Build binary
        const stats = builder.buildBinary(outputPath);
        
        // Step 3: Verify
        builder.verifyBinary(outputPath);
        
        console.log('\n✅ Binary build complete!');
        console.log(`\nStatistics:`);
        console.log(`  File size: ${Math.round(stats.totalSize / 1024)} KB`);
        console.log(`  Source words: ${stats.entryCount}`);
        console.log(`  Avg bytes per word: ${Math.round(stats.avgPredictions)}`);
        console.log(`\nNext step: Integrate WordPredictionEngine.swift in iOS`);
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main();