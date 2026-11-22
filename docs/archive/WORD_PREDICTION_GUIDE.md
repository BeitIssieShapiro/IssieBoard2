# Word Prediction System Guide

This guide explains how to use the word prediction system that extends the keyboard's word completion with next-word predictions based on bigram probabilities from a sentence corpus.

## Overview

The word prediction system provides **next-word suggestions** after the user completes a word, complementing the existing **word completion** system that suggests how to complete the current word being typed.

### Key Features

- **Bigram-based predictions**: Predicts the next word based on the last completed word
- **Hybrid storage format**: Uses dictionary indices for known words and inline storage for out-of-vocabulary predictions
- **Efficient binary format**: Direct memory access without parsing overhead
- **Automatic mode switching**: Seamlessly switches between completion and prediction modes

## Architecture

### Components

1. **Data Extraction** (`scripts/extract_word_predictions.js`)
   - Processes sentence corpus to extract word-to-word transitions
   - Calculates bigram probabilities
   - Outputs JSON with predictions per source word

2. **Binary Builder** (`scripts/build_prediction_binary.js`)
   - Converts JSON predictions to efficient binary format
   - Supports hybrid storage (indices + full words)
   - Creates sorted index for O(log n) lookups

3. **WordPredictionEngine** (`ios/Shared/WordPredictionEngine.swift`)
   - Loads and queries binary prediction files
   - Uses direct memory access for efficiency
   - Converts indices back to words via TrieEngine

4. **WordCompletionManager** (extended)
   - Manages both completion and prediction engines
   - Provides unified API for suggestions and predictions

5. **WordSuggestionController** (extended)
   - Tracks completion vs prediction mode
   - Automatically switches modes based on user input

## Usage

### Step 1: Extract Predictions from Corpus

source for corpus is: `https://wortschatz.uni-leipzig.de/en/download/`

```bash
node scripts/extract_word_predictions.js dict/he_50k.txt /path/to/corpus.txt
```

This will:
- Load the dictionary (5,000 words)
- Process the sentence corpus
- Count word-to-word transitions
- Generate `dict/he_predictions.json`

**Example output:**
```
=== Word Prediction Extraction ===
Language: he
Dictionary: dict/he_50k.txt
Corpus: heb_news_2020_100K-sentences.txt

Loading dictionary from dict/he_50k.txt...
  Loaded 5000 words from dictionary

Processing corpus: heb_news_2020_100K-sentences.txt
  Processed 10000 sentences...
  Processed 20000 sentences...
  Completed: 98765 sentences processed

Generating predictions...
  Generated predictions for 3456 source words
  Total predictions: 18234
  In-dictionary predictions: 14587 (80%)
  Out-of-dictionary predictions: 3647 (20%)

✅ Extraction complete!
```

### Step 2: Build Binary File

```bash
node scripts/build_prediction_binary.js he
```

This will:
- Load `dict/he_predictions.json`
- Sort entries by word index
- Build binary format with hybrid encoding
- Create `dict/bin/he_predictions.bin`

**Example output:**
```
=== Prediction Binary Builder ===
Language: he
Input: dict/he_predictions.json
Output: dict/bin/he_predictions.bin

Building binary file...
  Total size: 152341 bytes (148 KB)
    Header: 8 bytes
    Index: 20736 bytes
    Data: 131597 bytes

✅ Binary build complete!
```

### Step 3: Add Binary Files to iOS Project

1. Copy `dict/bin/he_predictions.bin` to the iOS project
2. Add to all keyboard extension targets (IssieBoardHe, IssieBoardEn, IssieBoardAr)
3. Ensure "Copy Bundle Resources" build phase includes the file

### Step 4: Test Predictions

The prediction system will automatically activate when:
1. User types a word
2. User presses space
3. Suggestion bar shows next-word predictions

**Example flow:**
```
User types: "אני"
Suggestions: [אני, אנחנו, אנשים]  ← completion mode

User presses space: "אני "
Suggestions: [רוצה, חושב, יכול]  ← prediction mode

User types: "אני ר"
Suggestions: [רוצה, רואה, רץ]  ← back to completion mode
```

## Binary Format Specification

### File Structure

```
[Header - 8 bytes]
├─ magic_number: uint32 (0x50524544 = "PRED")
└─ entry_count: uint32

[Index Section - entry_count × 6 bytes]
├─ For each source word (sorted by index):
│   ├─ word_index: uint16
│   └─ offset: uint32 (to prediction data)

[Prediction Data Section - variable]
├─ For each source word:
│   ├─ prediction_count: uint8
│   └─ predictions: (repeated)
│       ├─ type: uint8 (0=index, 1=full_word)
│       ├─ probability: uint8 (0-255 scale)
│       └─ data:
│           ├─ IF type==0: word_index: uint16
│           └─ IF type==1: length: uint8, utf8_bytes
```

### Example Entry

Source word "אני" (index 142) predicts:
```
prediction_count: 3

Prediction 1 (in dictionary):
  type: 0
  probability: 180 (0.71)
  word_index: 523 → "רוצה"

Prediction 2 (out of dictionary):
  type: 1
  probability: 120 (0.47)
  length: 6
  bytes: "מתכוון"

Prediction 3 (in dictionary):
  type: 0
  probability: 95 (0.37)
  word_index: 891 → "חושב"
```

## Configuration

### Extraction Parameters

In `scripts/extract_word_predictions.js`:

```javascript
const MIN_OCCURRENCE = 3;           // Min times a pair must occur
const MAX_PREDICTIONS_PER_WORD = 6; // Top N predictions to keep
```

### Runtime Behavior

The system automatically:
- Switches to prediction mode after space
- Returns to completion mode when typing starts
- Falls back to defaults if no predictions available

## Size Estimates

For 5,000-word dictionary with 100K sentence corpus:

| Metric | Typical Value |
|--------|---------------|
| Source words with predictions | 2,500-3,500 |
| Avg predictions per word | 5-6 |
| In-dictionary predictions | 70-85% |
| Out-of-dictionary predictions | 15-30% |
| **Total file size** | **120-180 KB** |

## Troubleshooting

### "Prediction engine not available"

This is normal if:
- Prediction file hasn't been generated yet
- The binary file isn't included in the app bundle
- The language doesn't have prediction data

The keyboard will still work with word completion only.

### No predictions appearing

Check:
1. Prediction file exists: `dict/bin/he_predictions.bin`
2. File is added to keyboard extension target
3. Console logs show "Loaded prediction engine"
4. The completed word exists in dictionary

### Low-quality predictions

Improve by:
1. Using a larger/better corpus
2. Increasing `MIN_OCCURRENCE` threshold
3. Filtering corpus for quality (remove noisy data)
4. Using domain-specific corpus for your use case

## Performance

- **Binary search**: O(log n) lookup by word index
- **Memory**: Only raw binary data (no parsed objects)
- **File size**: ~120-180 KB per language
- **Load time**: < 50ms on modern devices

## Future Enhancements

### 1. Prediction-Boosted Fuzzy Matching (High Priority)

**Problem**: When typing with typos, the fuzzy matcher may not prioritize the contextually correct word.

**Example scenario:**
```
User types: "Why sre"
Current behavior:
  - Fuzzy matches by edit distance: [sure, sire, store, ...]
  - "are" might not appear in top suggestions
  
Desired behavior:
  - Check predictions after "Why": [are, is, do, would]
  - Boost "are" because it's predicted after "Why"
  - Result: [are, sure, sire] - "are" appears first!
```

**Implementation approach:**

1. **In WordCompletionManager.getSuggestionsStructured():**
   - When doing fuzzy search, check if we have a `lastCompletedWord`
   - Get predictions for that word
   - For each fuzzy match, check if it appears in predictions
   - Apply boost factor (e.g., reduce error score by 0.5 or multiply by priority)
   - Re-sort results with boosted scores

2. **Benefits:**
   - Context-aware typo correction
   - Better accuracy with minimal additional computation
   - Leverages existing prediction data

3. **Pseudocode:**
```swift
func getSuggestions(for prefix: String, lastWord: String?) -> [String] {
    let fuzzyMatches = getFuzzyMatches(prefix)
    
    if let lastWord = lastWord, let predictions = getPredictions(afterWord: lastWord) {
        // Boost scores for predicted words
        for match in fuzzyMatches {
            if predictions.contains(match.word) {
                match.score *= 0.5  // Reduce error (boost priority)
            }
        }
        fuzzyMatches.sort(by: \.score)
    }
    
    return fuzzyMatches.map(\.word)
}
```

### 2. Trigram Support

Possible improvements:
- **Trigram support**: Predict based on last 2 words for better context
- **Context awareness**: Different predictions for different contexts  
- **Learning**: Adapt predictions based on user behavior
- **Compression**: Further reduce file size with dictionary encoding

## API Reference

### WordCompletionManager

```swift
// Get next-word predictions
func getWordPredictions(afterWord word: String, limit: Int = 4) -> [String]

// Check if predictions available
func isPredictionAvailable() -> Bool
```

### WordSuggestionController

```swift
// Properties
var isPredictionMode: Bool { get }
var lastCompletedWord: String { get }

// Automatically handles mode switching
func handleSpace()           // → switches to prediction mode
func handleCharacterTyped()  // → switches to completion mode
```

### WordPredictionEngine

```swift
// Initialize with language
init?(filename: String, trieEngine: TrieEngine?)

// Get predictions
func getPredictions(afterWord word: String, limit: Int = 6) -> [Prediction]
```

## Credits

This word prediction system uses:
- Bigram language model from sentence corpus
- Hybrid binary format for space efficiency
- Direct memory access for performance
- Integration with existing TrieEngine dictionary

## License

Same as IssieBoardNG project.