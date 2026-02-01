import Foundation

class TrieEngine {
    // MARK: - Properties
    
    /// Raw binary data from the .bin file
    private let data: Data
    
    /// Size of one node in bytes (Must match the JS build script: 12 bytes)
    private let nodeSize = 12
    
    /// Direct pointer to memory for maximum speed (avoids object allocation)
    private var basePointer: UnsafeRawPointer!

    // MARK: - Initialization
    
    /// Initializes the engine with a specific language file (e.g., "en", "he", "ar")
    /// Searches for the file in multiple locations:
    /// 1. Main bundle (for keyboard extension with files added as resources)
    /// 2. App bundle (for main app with files as references)
    init?(filename: String) {
        // Try to find the file
        guard let fileData = TrieEngine.loadDictionaryData(filename: filename) else {
            print("❌ TrieEngine: Dictionary file '\(filename).bin' not found in any bundle.")
            return nil
        }
        
        self.data = fileData
        
        // Get a raw pointer to the bytes
        // We hold 'data' strongly so this pointer remains valid
        self.data.withUnsafeBytes { (rawBuffer: UnsafeRawBufferPointer) in
            self.basePointer = rawBuffer.baseAddress
        }
        
        let nodeCount = data.count / nodeSize
        print("✅ TrieEngine: Loaded '\(filename)' with \(nodeCount) nodes.")
    }
    
    /// Try to load dictionary data from various locations
    private static func loadDictionaryData(filename: String) -> Data? {
        // List of possible filenames to try (with and without _50k suffix)
        let filenames = [filename, "\(filename)_50k"]
        
        // List of bundles to search
        let bundles: [Bundle] = [
            Bundle.main,
            Bundle(for: TrieEngine.self)
        ]
        
        for bundle in bundles {
            for name in filenames {
                // Try direct resource lookup
                if let path = bundle.path(forResource: name, ofType: "bin"),
                   let data = try? Data(contentsOf: URL(fileURLWithPath: path)) {
                    print("📚 TrieEngine: Found '\(name).bin' in bundle at \(path)")
                    return data
                }
                
                // Try looking in a 'dict' subdirectory
                if let path = bundle.path(forResource: name, ofType: "bin", inDirectory: "dict"),
                   let data = try? Data(contentsOf: URL(fileURLWithPath: path)) {
                    print("📚 TrieEngine: Found '\(name).bin' in dict directory at \(path)")
                    return data
                }
                
                // Try looking in a 'dict/bin' subdirectory
                if let path = bundle.path(forResource: name, ofType: "bin", inDirectory: "dict/bin"),
                   let data = try? Data(contentsOf: URL(fileURLWithPath: path)) {
                    print("📚 TrieEngine: Found '\(name).bin' in dict/bin directory at \(path)")
                    return data
                }
            }
        }
        
        // Log what was searched for debugging
        print("📚 TrieEngine: Searched for '\(filename).bin' in:")
        for bundle in bundles {
            print("   - Bundle: \(bundle.bundlePath)")
        }
        
        return nil
    }

    // MARK: - Public API

    /// Returns a list of word completions for the given prefix.
    /// - Parameters:
    ///   - prefix: The letters typed so far (e.g., "app")
    ///   - limit: Maximum number of suggestions to return (default: 3)
    func getSuggestions(for prefix: String, limit: Int = 3) -> [String] {
        guard !prefix.isEmpty else { return [] }
        
        var results: [String] = []
        
        // 1. Find the node representing the last character of the prefix
        // Start searching from Root (Index 0)
        guard let startNodeIndex = findNodeForPrefix(rootIndex: 0, prefix: prefix) else {
            return [] // Prefix not found in dictionary
        }
        
        // 2. Collect words starting from this node (DFS)
        collectWords(from: startNodeIndex, currentString: prefix, results: &results, limit: limit)
        
        return results
    }
    
    // MARK: - Fuzzy Search
    
    /// Result structure for fuzzy search containing word and error count
    private struct FuzzyResult: Comparable {
        let word: String
        let errors: Double
        
        static func < (lhs: FuzzyResult, rhs: FuzzyResult) -> Bool {
            if lhs.errors != rhs.errors {
                return lhs.errors < rhs.errors
            }
            return lhs.word.count < rhs.word.count
        }
    }
    
    /// Returns fuzzy word completions for the given prefix, allowing for typos.
    /// Uses recursive DFS approach matching the proven TestTrie algorithm.
    func getFuzzySuggestions(
        for prefix: String,
        errorBudget: Double = 3.0,
        neighbors: [Character: [Character]]? = nil,
        limit: Int = 3
    ) -> [String] {
        guard !prefix.isEmpty else { return [] }
        
        var results: [(String, Double)] = []
        let prefixChars = Array(prefix.lowercased())
        
        // Get root's first child
        let firstChildIndex = getInt32(at: 0, offset: 4)
        if firstChildIndex == -1 {
            return []
        }
        
        // Iterate through ALL siblings at root level (all starting letters)
        var siblingIndex = Int(firstChildIndex)
        while siblingIndex != -1 {
            // Get this node's character
            let nodeChar = getUInt16(at: siblingIndex, offset: 0)
            if let scalar = UnicodeScalar(nodeChar) {
                let nodeCharacter = Character(scalar)
                
                fuzzySearchRecursive(
                    nodeIndex: siblingIndex,
                    nodeChar: nodeCharacter,
                    prefixChars: prefixChars,
                    prefixIndex: 0,
                    currentPath: "",
                    currentErrors: 0.0,
                    maxErrors: errorBudget,
                    neighbors: neighbors,
                    results: &results
                )
            }
            
            let nextSibling = getInt32(at: siblingIndex, offset: 8)
            siblingIndex = Int(nextSibling)
        }
        
        // Sort by:
        // 1. Primary: errors (lower is better)
        // 2. Secondary: prefer words closer to input length (exact match is best, then +1, +2, etc.)
        // 3. Tertiary: shorter words first (if same distance from input)
        let inputLength = prefix.count
        let sorted = results.sorted { (a, b) in
            // First compare errors
            if a.1 != b.1 {
                return a.1 < b.1
            }
            // Then compare length distance from input
            let aDist = abs(a.0.count - inputLength)
            let bDist = abs(b.0.count - inputLength)
            if aDist != bDist {
                return aDist < bDist  // Prefer words closer to input length
            }
            // Finally, prefer shorter words
            return a.0.count < b.0.count
        }
        
        var seen = Set<String>()
        var uniqueResults: [String] = []
        for (word, _) in sorted {
            if !seen.contains(word) {
                seen.insert(word)
                uniqueResults.append(word)
                if uniqueResults.count >= limit {
                    break
                }
            }
        }
        
        return uniqueResults
    }
    
    /// Recursive fuzzy search - matches the working TestTrie algorithm
    private func fuzzySearchRecursive(
        nodeIndex: Int,
        nodeChar: Character,
        prefixChars: [Character],
        prefixIndex: Int,
        currentPath: String,
        currentErrors: Double,
        maxErrors: Double,
        neighbors: [Character: [Character]]?,
        results: inout [(String, Double)]
    ) {
        // Prune if over budget
        if currentErrors > maxErrors {
            return
        }
        
        let newPath = currentPath + String(nodeChar)
        
        // If we still have input to match
        if prefixIndex < prefixChars.count {
            let targetChar = prefixChars[prefixIndex]
            
            // Calculate error for this character
            var errorForChar: Double
            if nodeChar == targetChar {
                errorForChar = 0.0
            } else if neighbors?[targetChar]?.contains(nodeChar) == true {
                errorForChar = 0.5  // Keyboard neighbor
            } else {
                errorForChar = 1.0  // Non-neighbor substitution
            }
            
            let newErrors = currentErrors + errorForChar
            
            if newErrors <= maxErrors {
                // Get children and recurse
                let firstChild = getInt32(at: nodeIndex, offset: 4)
                if firstChild != -1 {
                    var childIdx = Int(firstChild)
                    while childIdx != -1 {
                        let childChar = getUInt16(at: childIdx, offset: 0)
                        if let scalar = UnicodeScalar(childChar) {
                            fuzzySearchRecursive(
                                nodeIndex: childIdx,
                                nodeChar: Character(scalar),
                                prefixChars: prefixChars,
                                prefixIndex: prefixIndex + 1,
                                currentPath: newPath,
                                currentErrors: newErrors,
                                maxErrors: maxErrors,
                                neighbors: neighbors,
                                results: &results
                            )
                        }
                        let nextSib = getInt32(at: childIdx, offset: 8)
                        childIdx = Int(nextSib)
                    }
                }
                
                // If consumed all input, collect results
                if prefixIndex + 1 >= prefixChars.count {
                    let flags = getUInt16(at: nodeIndex, offset: 2)
                    let isWordEnd = (flags & 0x01) != 0
                    if isWordEnd {
                        results.append((newPath, newErrors))
                    }
                    // Collect completions from this node
                    collectFuzzyCompletions(
                        nodeIndex: nodeIndex,
                        path: newPath,
                        errors: newErrors,
                        results: &results
                    )
                }
            }
        } else {
            // All input consumed - add word if valid and collect completions
            let flags = getUInt16(at: nodeIndex, offset: 2)
            let isWordEnd = (flags & 0x01) != 0
            if isWordEnd {
                results.append((newPath, currentErrors))
            }
            collectFuzzyCompletions(
                nodeIndex: nodeIndex,
                path: newPath,
                errors: currentErrors,
                results: &results
            )
        }
    }
    
    /// Collect word completions from a node (for fuzzy search)
    private func collectFuzzyCompletions(
        nodeIndex: Int,
        path: String,
        errors: Double,
        results: inout [(String, Double)]
    ) {
        let firstChild = getInt32(at: nodeIndex, offset: 4)
        if firstChild == -1 {
            return
        }
        
        var childIdx = Int(firstChild)
        while childIdx != -1 {
            let childChar = getUInt16(at: childIdx, offset: 0)
            if let scalar = UnicodeScalar(childChar) {
                let newPath = path + String(scalar)
                
                let flags = getUInt16(at: childIdx, offset: 2)
                let isWordEnd = (flags & 0x01) != 0
                if isWordEnd {
                    results.append((newPath, errors))
                }
                
                // Recurse into children
                collectFuzzyCompletions(
                    nodeIndex: childIdx,
                    path: newPath,
                    errors: errors,
                    results: &results
                )
            }
            
            let nextSib = getInt32(at: childIdx, offset: 8)
            childIdx = Int(nextSib)
        }
    }

    // MARK: - Traversal Logic

    /// Traverses the Trie down to the node representing the prefix.
    private func findNodeForPrefix(rootIndex: Int, prefix: String) -> Int? {
        var currentNodeIndex = rootIndex
        let chars = Array(prefix.utf16) // Convert to UTF-16 codes
        
        // Iterate through each character in the prefix
        for charCode in chars {
            // Get the first child of the current node
            let firstChildIndex = getInt32(at: currentNodeIndex, offset: 4)
            
            if firstChildIndex == -1 {
                return nil // Dead end, prefix doesn't exist
            }
            
            // Search the sibling list of the child to find the specific character
            if let matchIndex = findSibling(startIndex: Int(firstChildIndex), targetChar: charCode) {
                currentNodeIndex = matchIndex
            } else {
                return nil // Character not found among siblings
            }
        }
        
        return currentNodeIndex
    }
    
    /// Scans a linked list of siblings to find a specific character.
    private func findSibling(startIndex: Int, targetChar: UInt16) -> Int? {
        var currentIndex = startIndex
        
        while currentIndex != -1 {
            // Read Char (Offset 0)
            let char = getUInt16(at: currentIndex, offset: 0)
            
            if char == targetChar {
                return currentIndex
            }
            
            // Move to next sibling (Offset 8)
            let nextSibling = getInt32(at: currentIndex, offset: 8)
            currentIndex = Int(nextSibling)
        }
        
        return nil
    }

    /// Recursively collects valid words starting from the given node.
    private func collectWords(from nodeIndex: Int, currentString: String, results: inout [String], limit: Int) {
        if results.count >= limit { return }
        
        // 1. Check if the current node itself ends a word
        // Read Flags (Offset 2). 0x01 means isWordEnd.
        let flags = getUInt16(at: nodeIndex, offset: 2)
        let isWordEnd = (flags & 0x01) != 0
        
        // If we are deeper than the prefix itself, and this is a word end, add it
        // (Logic note: The prefix node itself is usually a word end if the user typed a complete word, 
        // but typically we want *completions*, so you might check currentString != prefix if you want strictly longer words)
        if isWordEnd {
            results.append(currentString)
        }
        
        // 2. Visit Children
        let firstChildIndex = getInt32(at: nodeIndex, offset: 4)
        if firstChildIndex != -1 {
            collectSiblingsRecursive(startIndex: Int(firstChildIndex), parentString: currentString, results: &results, limit: limit)
        }
    }
    
    /// Iterates through all siblings at a specific level to collect words.
    private func collectSiblingsRecursive(startIndex: Int, parentString: String, results: inout [String], limit: Int) {
        var currentIndex = startIndex
        
        while currentIndex != -1 && results.count < limit {
            // Reconstruct the string for this node
            let charCode = getUInt16(at: currentIndex, offset: 0)
            
            if let scalar = UnicodeScalar(charCode) {
                let newString = parentString + String(scalar)
                
                // Recursively search this node's subtree
                collectWords(from: currentIndex, currentString: newString, results: &results, limit: limit)
            }
            
            // Move to next sibling
            let nextSibling = getInt32(at: currentIndex, offset: 8)
            currentIndex = Int(nextSibling)
        }
    }

    // MARK: - Low-Level Memory Access
    
    /// Reads a 2-byte UInt16 from the binary blob
    private func getUInt16(at nodeIndex: Int, offset: Int) -> UInt16 {
        // Calculate exact byte address: Base + (Index * 12) + Offset
        let address = basePointer.advanced(by: (nodeIndex * nodeSize) + offset)
        // Bind memory to UInt16 and read
        return address.load(as: UInt16.self)
    }
    
    /// Reads a 4-byte Int32 from the binary blob
    private func getInt32(at nodeIndex: Int, offset: Int) -> Int32 {
        let address = basePointer.advanced(by: (nodeIndex * nodeSize) + offset)
        return address.load(as: Int32.self)
    }
}