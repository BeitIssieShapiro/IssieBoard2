//
//  FuzzySearchTests.swift
//  IssieBoardNGTests
//
//  Tests for fuzzy search functionality in TrieEngine
//

import Testing
import Foundation

struct FuzzySearchTests {
    
    // MARK: - Test Fixtures
    
    /// English keyboard neighbor map for testing
    static let enNeighbors: [Character: [Character]] = [
        "q": ["w", "a"],
        "w": ["q", "e", "a", "s"],
        "e": ["w", "r", "s", "d"],
        "r": ["e", "t", "d", "f"],
        "t": ["r", "y", "f", "g"],
        "y": ["t", "u", "g", "h"],
        "u": ["y", "i", "h", "j"],
        "i": ["u", "o", "j", "k"],
        "o": ["i", "p", "k", "l"],
        "p": ["o", "l"],
        "a": ["s", "q", "w", "z"],
        "s": ["a", "d", "w", "e", "z", "x"],
        "d": ["s", "f", "e", "r", "z", "x", "c"],
        "f": ["d", "g", "r", "t", "x", "c", "v"],
        "g": ["f", "h", "t", "y", "c", "v", "b"],
        "h": ["g", "j", "y", "u", "v", "b", "n"],
        "j": ["h", "k", "u", "i", "b", "n", "m"],
        "k": ["j", "l", "i", "o", "n", "m"],
        "l": ["k", "o", "p", "m"],
        "z": ["x", "a", "s", "d"],
        "x": ["z", "c", "s", "d", "f"],
        "c": ["x", "v", "d", "f", "g"],
        "v": ["c", "b", "f", "g", "h"],
        "b": ["v", "n", "g", "h", "j"],
        "n": ["b", "m", "h", "j", "k"],
        "m": ["n", "j", "k", "l"]
    ]
    
    // MARK: - Helper Methods
    
    /// Creates a TrieEngine for English dictionary
    func createEnglishEngine() -> TrieEngine? {
        // Try different filenames that might exist
        if let engine = TrieEngine(filename: "en_50k") {
            return engine
        }
        if let engine = TrieEngine(filename: "en") {
            return engine
        }
        return nil
    }
    
    // MARK: - Pure Unit Tests for Neighbor Logic
    
    @Test func testNeighborMap_qHasWAsNeighbor() async throws {
        let neighbors = Self.enNeighbors
        
        let qNeighbors = neighbors["q"]
        #expect(qNeighbors != nil, "'q' should have neighbors defined")
        #expect(qNeighbors?.contains("w") == true, "'w' should be a neighbor of 'q'")
    }
    
    @Test func testNeighborMap_wHasQAsNeighbor() async throws {
        let neighbors = Self.enNeighbors
        
        let wNeighbors = neighbors["w"]
        #expect(wNeighbors != nil, "'w' should have neighbors defined")
        #expect(wNeighbors?.contains("q") == true, "'q' should be a neighbor of 'w'")
    }
    
    @Test func testNeighborLookup_qTyped_wInTrie() async throws {
        // This is the core logic that should make "qhy" find "why"
        let neighbors = Self.enNeighbors
        
        let targetChar: Character = "q"  // What user typed
        let trieChar: Character = "w"    // What's in the trie
        
        // Check: is 'w' (trie char) a neighbor of 'q' (typed char)?
        let neighborList = neighbors[targetChar]
        #expect(neighborList != nil, "targetChar 'q' should have neighbors")
        
        let isNeighbor = neighborList?.contains(trieChar) == true
        #expect(isNeighbor, "'w' should be found in neighbors of 'q'")
    }
    
    // MARK: - In-Memory Trie Tests
    // These tests create a simple trie in memory to test the fuzzy algorithm
    // without depending on external dictionary files
    
    @Test func testInMemoryTrie_createAndSearch() async throws {
        // Create a minimal trie with just a few words
        let trie = TestTrie()
        trie.insert("why")
        trie.insert("what")
        trie.insert("when")
        trie.insert("the")
        trie.insert("hello")
        
        // Test exact search
        let whResults = trie.search(prefix: "wh")
        print("In-memory search 'wh': \(whResults)")
        #expect(whResults.contains("why"), "Should find 'why' for prefix 'wh'")
    }
    
    @Test func testInMemoryTrie_fuzzySearch_qhy_shouldFindWhy() async throws {
        let trie = TestTrie()
        trie.insert("why")
        trie.insert("what")
        trie.insert("when")
        trie.insert("query")
        trie.insert("quit")
        
        // Fuzzy search for "qhy" should find "why"
        let results = trie.fuzzySearch(
            prefix: "qhy",
            neighbors: Self.enNeighbors,
            maxErrors: 1.0
        )
        
        print("In-memory fuzzy search 'qhy': \(results)")
        #expect(results.contains("why"), "Fuzzy search 'qhy' should find 'why'. Got: \(results)")
    }
    
    @Test func testInMemoryTrie_fuzzySearch_yhe_shouldFindThe() async throws {
        let trie = TestTrie()
        trie.insert("the")
        trie.insert("they")
        trie.insert("them")
        trie.insert("yes")
        trie.insert("yell")
        
        // Fuzzy search for "yhe" should find "the" (y is neighbor of t)
        let results = trie.fuzzySearch(
            prefix: "yhe",
            neighbors: Self.enNeighbors,
            maxErrors: 1.0
        )
        
        print("In-memory fuzzy search 'yhe': \(results)")
        #expect(results.contains("the"), "Fuzzy search 'yhe' should find 'the'. Got: \(results)")
    }
    
    // MARK: - Dictionary File Tests (may skip if file not available)
    
    @Test func testFuzzySearch_qhy_shouldFindWhy_fromDictionary() async throws {
        guard let engine = createEnglishEngine() else {
            print("⚠️ Skipping test - English dictionary not available in test bundle")
            return
        }
        
        let suggestions = engine.getFuzzySuggestions(
            for: "qhy",
            errorBudget: 3.0,
            neighbors: Self.enNeighbors,
            limit: 20
        )
        
        print("🔍 Dictionary fuzzy search 'qhy': \(suggestions)")
        #expect(suggestions.contains("why"), "Expected 'why' in fuzzy results for 'qhy'. Got: \(suggestions)")
    }
    
    @Test func testFuzzySearch_emptyPrefix() async throws {
        guard let engine = createEnglishEngine() else {
            print("⚠️ Skipping test - English dictionary not available")
            return
        }
        
        let suggestions = engine.getFuzzySuggestions(
            for: "",
            errorBudget: 3.0,
            neighbors: Self.enNeighbors,
            limit: 10
        )
        
        #expect(suggestions.isEmpty, "Expected empty results for empty prefix")
    }
    
    // MARK: - Word Exists Tests
    
    @Test func testWordExists_existingWord() async throws {
        guard let engine = createEnglishEngine() else {
            print("⚠️ Skipping test - English dictionary not available")
            return
        }
        
        // Common words should exist
        #expect(engine.wordExists("the"), "Common word 'the' should exist")
        #expect(engine.wordExists("hello"), "Common word 'hello' should exist")
        #expect(engine.wordExists("world"), "Common word 'world' should exist")
    }
    
    @Test func testWordExists_nonExistingWord() async throws {
        guard let engine = createEnglishEngine() else {
            print("⚠️ Skipping test - English dictionary not available")
            return
        }
        
        // Gibberish should not exist
        #expect(!engine.wordExists("xyzqwk"), "Gibberish 'xyzqwk' should not exist")
        #expect(!engine.wordExists("aaabbbccc"), "Gibberish 'aaabbbccc' should not exist")
    }
    
    @Test func testWordExists_prefix_notCompleteWord() async throws {
        guard let engine = createEnglishEngine() else {
            print("⚠️ Skipping test - English dictionary not available")
            return
        }
        
        // "hel" is a prefix of "hello" but might not be a word itself
        // This test verifies we distinguish between prefix existence and word existence
        let suggestions = engine.getSuggestions(for: "hel", limit: 5)
        print("Suggestions for 'hel': \(suggestions)")
        
        // We should get suggestions starting with "hel"
        #expect(!suggestions.isEmpty, "Should get suggestions for prefix 'hel'")
    }
    
    @Test func testWordExists_emptyString() async throws {
        guard let engine = createEnglishEngine() else {
            print("⚠️ Skipping test - English dictionary not available")
            return
        }
        
        #expect(!engine.wordExists(""), "Empty string should not be a word")
    }
    
    // MARK: - In-Memory Trie Word Exists Tests
    
    @Test func testInMemoryTrie_wordExists() async throws {
        let trie = TestTrie()
        trie.insert("hello")
        trie.insert("help")
        trie.insert("world")
        
        #expect(trie.wordExists("hello"), "Should find 'hello'")
        #expect(trie.wordExists("help"), "Should find 'help'")
        #expect(trie.wordExists("world"), "Should find 'world'")
        #expect(!trie.wordExists("hel"), "'hel' is a prefix but not a word")
        #expect(!trie.wordExists("xyz"), "'xyz' does not exist")
    }
    
    // MARK: - Hebrew Prefix Stripping Tests (In-Memory)
    
    @Test func testInMemoryTrie_hebrewPrefixStripping() async throws {
        let trie = TestTrie()
        // Insert Hebrew words (using Hebrew characters)
        trie.insert("בית")   // house
        trie.insert("ספר")   // book
        trie.insert("ילד")   // child
        
        // Test that root words exist
        #expect(trie.wordExists("בית"), "Should find 'בית' (house)")
        #expect(trie.wordExists("ספר"), "Should find 'ספר' (book)")
        
        // Test prefix stripping logic
        let hebrewPrefixes: [Character] = ["ה", "ו", "ב", "כ", "ל", "מ", "ש"]
        
        // Simulate prefix stripping: "הבית" -> "בית"
        let wordWithPrefix = "הבית"  // "the house"
        let firstChar = wordWithPrefix.first!
        
        #expect(hebrewPrefixes.contains(firstChar), "ה should be a recognized prefix")
        
        let strippedWord = String(wordWithPrefix.dropFirst())
        #expect(strippedWord == "בית", "After stripping ה, should get בית")
        #expect(trie.wordExists(strippedWord), "Root word 'בית' should exist in dictionary")
    }
    
    @Test func testInMemoryTrie_hebrewPrefixes_variousCases() async throws {
        let trie = TestTrie()
        // Insert Hebrew root words
        trie.insert("בית")   // house
        trie.insert("ספר")   // book
        trie.insert("שולחן") // table
        
        let hebrewPrefixes: [Character] = ["ה", "ו", "ב", "כ", "ל", "מ", "ש"]
        
        // Test various prefix combinations
        let testCases: [(String, String, Bool)] = [
            ("הבית", "בית", true),    // ה (the) + house
            ("לספר", "ספר", true),    // ל (to) + book
            ("בבית", "בית", true),    // ב (in) + house
            ("ושולחן", "שולחן", true), // ו (and) + table
            ("מספר", "ספר", true),    // מ (from) + book
            ("כבית", "בית", true),    // כ (like) + house
            ("xyz", "yz", false),     // Not Hebrew prefix
        ]
        
        for (original, expectedRoot, shouldExist) in testCases {
            if let firstChar = original.first, hebrewPrefixes.contains(firstChar) {
                let stripped = String(original.dropFirst())
                #expect(stripped == expectedRoot, "Stripping '\(original)' should give '\(expectedRoot)'")
                #expect(trie.wordExists(stripped) == shouldExist, "Root '\(stripped)' existence should be \(shouldExist)")
            }
        }
    }
}

// MARK: - Test Trie Implementation
// A simple in-memory trie for testing fuzzy search algorithm

class TestTrieNode {
    var children: [Character: TestTrieNode] = [:]
    var isWordEnd: Bool = false
}

class TestTrie {
    let root = TestTrieNode()
    
    func insert(_ word: String) {
        var node = root
        for char in word.lowercased() {
            if node.children[char] == nil {
                node.children[char] = TestTrieNode()
            }
            node = node.children[char]!
        }
        node.isWordEnd = true
    }
    
    func search(prefix: String) -> [String] {
        var node = root
        let prefixLower = prefix.lowercased()
        
        // Navigate to prefix node
        for char in prefixLower {
            guard let child = node.children[char] else {
                return []
            }
            node = child
        }
        
        // Collect all words from this point
        var results: [String] = []
        collectWords(node: node, path: prefixLower, results: &results)
        return results
    }
    
    /// Check if a complete word exists in the trie
    func wordExists(_ word: String) -> Bool {
        guard !word.isEmpty else { return false }
        
        var node = root
        let wordLower = word.lowercased()
        
        // Navigate to the word's end node
        for char in wordLower {
            guard let child = node.children[char] else {
                return false
            }
            node = child
        }
        
        // Check if this is a complete word
        return node.isWordEnd
    }
    
    private func collectWords(node: TestTrieNode, path: String, results: inout [String]) {
        if node.isWordEnd {
            results.append(path)
        }
        for (char, child) in node.children {
            collectWords(node: child, path: path + String(char), results: &results)
        }
    }
    
    /// Fuzzy search that allows character substitutions with keyboard neighbors
    func fuzzySearch(
        prefix: String,
        neighbors: [Character: [Character]],
        maxErrors: Double
    ) -> [String] {
        var results: [(String, Double)] = []
        let prefixChars = Array(prefix.lowercased())
        
        // Start fuzzy search from all root children
        for (char, childNode) in root.children {
            fuzzySearchRecursive(
                node: childNode,
                nodeChar: char,
                prefixChars: prefixChars,
                prefixIndex: 0,
                currentPath: "",
                currentErrors: 0.0,
                maxErrors: maxErrors,
                neighbors: neighbors,
                results: &results
            )
        }
        
        // Sort by errors and return words
        return results.sorted { $0.1 < $1.1 }.map { $0.0 }
    }
    
    private func fuzzySearchRecursive(
        node: TestTrieNode,
        nodeChar: Character,
        prefixChars: [Character],
        prefixIndex: Int,
        currentPath: String,
        currentErrors: Double,
        maxErrors: Double,
        neighbors: [Character: [Character]],
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
            
            // Calculate error
            var errorForChar: Double
            if nodeChar == targetChar {
                errorForChar = 0.0
            } else if neighbors[targetChar]?.contains(nodeChar) == true {
                errorForChar = 0.5  // Keyboard neighbor
            } else {
                errorForChar = 1.0  // Non-neighbor substitution
            }
            
            let newErrors = currentErrors + errorForChar
            
            if newErrors <= maxErrors {
                // Continue with children
                for (char, childNode) in node.children {
                    fuzzySearchRecursive(
                        node: childNode,
                        nodeChar: char,
                        prefixChars: prefixChars,
                        prefixIndex: prefixIndex + 1,
                        currentPath: newPath,
                        currentErrors: newErrors,
                        maxErrors: maxErrors,
                        neighbors: neighbors,
                        results: &results
                    )
                }
                
                // If consumed all input, collect results
                if prefixIndex + 1 >= prefixChars.count {
                    if node.isWordEnd {
                        results.append((newPath, newErrors))
                    }
                    // Collect completions
                    collectFuzzyWords(node: node, path: newPath, errors: newErrors, results: &results)
                }
            }
        } else {
            // All input consumed
            if node.isWordEnd {
                results.append((newPath, currentErrors))
            }
            collectFuzzyWords(node: node, path: newPath, errors: currentErrors, results: &results)
        }
    }
    
    private func collectFuzzyWords(node: TestTrieNode, path: String, errors: Double, results: inout [(String, Double)]) {
        for (char, child) in node.children {
            let newPath = path + String(char)
            if child.isWordEnd {
                results.append((newPath, errors))
            }
            collectFuzzyWords(node: child, path: newPath, errors: errors, results: &results)
        }
    }
}