import Foundation

/**
 * WordPredictionEngine - Loads and queries word prediction data
 * 
 * Uses binary format with direct memory access for efficiency.
 * Supports hybrid format: dictionary indices + full words for out-of-dict predictions.
 * 
 * Binary Format:
 * - Header: magic number + entry count
 * - Index section: sorted word indices with offsets (for binary search)
 * - Data section: prediction data with type flags (0=index, 1=full_word)
 */
class WordPredictionEngine {
    
    // MARK: - Properties
    
    /// Raw binary data from the predictions.bin file
    private let data: Data
    
    /// Direct pointer to memory for maximum speed
    private var basePointer: UnsafeRawPointer!
    
    /// Reference to the TrieEngine for word-index conversions
    private weak var trieEngine: TrieEngine?
    
    /// Constants
    private let headerSize = 8
    private let indexEntrySize = 6  // uint16 + uint32
    private let magicNumber: UInt32 = 0x50524544  // "PRED"
    
    // MARK: - Prediction Result
    
    struct Prediction {
        let word: String
        let probability: Float  // 0.0 to 1.0
    }
    
    // MARK: - Initialization
    
    /// Initialize with a specific language prediction file
    /// - Parameters:
    ///   - filename: Base filename (e.g., "he", "en", "ar")
    ///   - trieEngine: Associated TrieEngine for word lookups
    init?(filename: String, trieEngine: TrieEngine?) {
        // Try to load the prediction file
        guard let fileData = WordPredictionEngine.loadPredictionData(filename: filename) else {
            print("❌ WordPredictionEngine: Prediction file '\(filename)_predictions.bin' not found.")
            return nil
        }
        
        self.data = fileData
        self.trieEngine = trieEngine
        
        // Get a raw pointer to the bytes
        self.data.withUnsafeBytes { (rawBuffer: UnsafeRawBufferPointer) in
            self.basePointer = rawBuffer.baseAddress
        }
        
        // Verify magic number
        let magic = getUInt32(at: 0)
        guard magic == magicNumber else {
            print("❌ WordPredictionEngine: Invalid magic number: 0x\(String(magic, radix: 16))")
            return nil
        }
        
        let entryCount = getUInt32(at: 4)
        print("✅ WordPredictionEngine: Loaded '\(filename)_predictions' with \(entryCount) source words.")
    }
    
    /// Try to load prediction data from various locations
    private static func loadPredictionData(filename: String) -> Data? {
        let filenames = ["\(filename)_predictions"]
        
        let bundles: [Bundle] = [
            Bundle.main,
            Bundle(for: WordPredictionEngine.self)
        ]
        
        for bundle in bundles {
            for name in filenames {
                // Try direct resource lookup
                if let path = bundle.path(forResource: name, ofType: "bin"),
                   let data = try? Data(contentsOf: URL(fileURLWithPath: path)) {
                    print("📚 WordPredictionEngine: Found '\(name).bin' at \(path)")
                    return data
                }
                
                // Try dict/bin subdirectory
                if let path = bundle.path(forResource: name, ofType: "bin", inDirectory: "dict/bin"),
                   let data = try? Data(contentsOf: URL(fileURLWithPath: path)) {
                    print("📚 WordPredictionEngine: Found '\(name).bin' in dict/bin at \(path)")
                    return data
                }
                
                // Try bundle resources directory
                let bundleDir = bundle.bundlePath
                let directPath = "\(bundleDir)/\(name).bin"
                if FileManager.default.fileExists(atPath: directPath),
                   let data = try? Data(contentsOf: URL(fileURLWithPath: directPath)) {
                    print("📚 WordPredictionEngine: Found '\(name).bin' in bundle at \(directPath)")
                    return data
                }
            }
        }
        
        // Try app group container
        for name in filenames {
            if let groupContainerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.issie.IssieBoardNG") {
                let predPath = groupContainerURL.appendingPathComponent("\(name).bin")
                if FileManager.default.fileExists(atPath: predPath.path),
                   let data = try? Data(contentsOf: predPath) {
                    print("📚 WordPredictionEngine: Found '\(name).bin' in app group at \(predPath.path)")
                    return data
                }
            }
        }
        
        return nil
    }
    
    // MARK: - Public API
    
    /// Get word predictions after a given word
    /// - Parameters:
    ///   - word: The word that was just typed
    ///   - limit: Maximum number of predictions to return
    /// - Returns: Array of predictions sorted by probability
    func getPredictions(afterWord word: String, limit: Int = 6) -> [Prediction] {
        guard let trieEngine = trieEngine else {
            print("⚠️ WordPredictionEngine: No TrieEngine available")
            return []
        }
        
        // Get the word's index from the trie
        guard let wordIndex = trieEngine.getWordIndex(word.lowercased()) else {
            // Word not in dictionary - no predictions available
            return []
        }
        
        return getPredictions(forWordIndex: wordIndex, limit: limit)
    }
    
    /// Get predictions for a specific word index
    /// - Parameters:
    ///   - wordIndex: The index of the source word
    ///   - limit: Maximum number of predictions to return
    /// - Returns: Array of predictions
    func getPredictions(forWordIndex wordIndex: UInt16, limit: Int = 6) -> [Prediction] {
        // Binary search for the word index in the index section
        guard let dataOffset = findDataOffset(for: wordIndex) else {
            // No predictions for this word
            return []
        }
        
        // Parse predictions at the data offset
        return parsePredictions(at: dataOffset, limit: limit)
    }
    
    // MARK: - Binary Search
    
    /// Find the data offset for a given word index using binary search
    private func findDataOffset(for wordIndex: UInt16) -> Int? {
        let entryCount = Int(getUInt32(at: 4))
        var left = 0
        var right = entryCount - 1
        
        while left <= right {
            let mid = (left + right) / 2
            let entryOffset = headerSize + mid * indexEntrySize
            let midIndex = getUInt16(at: entryOffset)
            
            if midIndex == wordIndex {
                // Found it - return the data offset
                return Int(getUInt32(at: entryOffset + 2))
            } else if midIndex < wordIndex {
                left = mid + 1
            } else {
                right = mid - 1
            }
        }
        
        return nil
    }
    
    // MARK: - Prediction Parsing
    
    /// Parse prediction data at a specific offset
    private func parsePredictions(at offset: Int, limit: Int) -> [Prediction] {
        var predictions: [Prediction] = []
        var currentOffset = offset
        
        // Read prediction count
        let count = getUInt8(at: currentOffset)
        currentOffset += 1
        
        let actualCount = min(Int(count), limit)
        
        // Parse each prediction
        for _ in 0..<actualCount {
            let type = getUInt8(at: currentOffset)
            let probability = Float(getUInt8(at: currentOffset + 1)) / 255.0
            currentOffset += 2
            
            let word: String?
            
            if type == 0 {
                // Type 0: Dictionary index reference
                let dictWordIndex = getUInt16(at: currentOffset)
                currentOffset += 2
                
                // Convert index to word using TrieEngine
                word = trieEngine?.getWord(atIndex: dictWordIndex)
                
            } else {
                // Type 1: Full word stored inline
                let length = Int(getUInt8(at: currentOffset))
                currentOffset += 1
                
                // Read UTF-8 bytes
                let bytes = data.subdata(in: currentOffset..<(currentOffset + length))
                word = String(data: bytes, encoding: .utf8)
                currentOffset += length
            }
            
            if let word = word {
                predictions.append(Prediction(word: word, probability: probability))
            }
        }
        
        return predictions
    }
    
    // MARK: - Low-Level Memory Access
    
    private func getUInt8(at offset: Int) -> UInt8 {
        return basePointer.advanced(by: offset).load(as: UInt8.self)
    }
    
    private func getUInt16(at offset: Int) -> UInt16 {
        // Use loadUnaligned to handle potentially unaligned access
        return basePointer.advanced(by: offset).loadUnaligned(as: UInt16.self)
    }
    
    private func getUInt32(at offset: Int) -> UInt32 {
        // Use loadUnaligned to handle potentially unaligned access
        return basePointer.advanced(by: offset).loadUnaligned(as: UInt32.self)
    }
}
