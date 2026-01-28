import XCTest
import UIKit

// MARK: - Standalone Model Definitions for Tests
// These are copied from KeyboardModels.swift to avoid React Native dependency

/// Individual diacritic mark definition
struct DiacriticItem: Codable {
    let id: String
    let mark: String
    let name: String
    let onlyFor: [String]?
    let excludeFor: [String]?
    let isReplacement: Bool?
    
    enum CodingKeys: String, CodingKey {
        case id, mark, name, onlyFor, excludeFor, isReplacement
    }
}

/// Option for a multi-option modifier
struct DiacriticModifierOption: Codable {
    let id: String
    let mark: String
    let name: String
}

/// Modifier that can combine with other diacritics
struct DiacriticModifier: Codable {
    let id: String
    let mark: String?
    let name: String
    let appliesTo: [String]?
    let excludeFor: [String]?
    let options: [DiacriticModifierOption]?
    
    var isMultiOption: Bool {
        return options != nil && !(options?.isEmpty ?? true)
    }
}

/// Diacritics definition for a keyboard
struct DiacriticsDefinition: Codable {
    let items: [DiacriticItem]
    let modifier: DiacriticModifier?
    let modifiers: [DiacriticModifier]?
    
    func getModifiers() -> [DiacriticModifier] {
        if let mods = modifiers, !mods.isEmpty {
            return mods
        }
        if let mod = modifier {
            return [mod]
        }
        return []
    }
    
    func getModifiers(for letter: String) -> [DiacriticModifier] {
        return getModifiers().filter { modifier in
            if let appliesTo = modifier.appliesTo {
                return appliesTo.contains(letter)
            }
            if let excludeFor = modifier.excludeFor {
                return !excludeFor.contains(letter)
            }
            return true
        }
    }
}

/// Per-keyboard diacritics settings
struct DiacriticsSettings: Codable {
    let hidden: [String]?
    let disabledModifiers: [String]?
    
    func isModifierEnabled(_ modifierId: String) -> Bool {
        guard let disabled = disabledModifiers else { return true }
        return !disabled.contains(modifierId)
    }
}

/// Generated diacritic option for display
struct GeneratedDiacriticOption {
    let id: String
    let value: String
    let name: String
}

/// Shift state enum
enum ShiftState {
    case inactive
    case active
    case locked
    
    func toggle() -> ShiftState {
        switch self {
        case .inactive: return .active
        case .active: return .inactive
        case .locked: return .inactive
        }
    }
    
    func lock() -> ShiftState {
        return .locked
    }
    
    func isActive() -> Bool {
        return self != .inactive
    }
}

/// UIColor extension for hex strings
extension UIColor {
    convenience init?(hexString: String) {
        var hex = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
        
        if hex.hasPrefix("#") {
            hex.remove(at: hex.startIndex)
        }
        
        guard hex.count == 6 || hex.count == 8 else {
            return nil
        }
        
        var rgbValue: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&rgbValue)
        
        let r, g, b, a: CGFloat
        if hex.count == 8 {
            r = CGFloat((rgbValue & 0xFF000000) >> 24) / 255.0
            g = CGFloat((rgbValue & 0x00FF0000) >> 16) / 255.0
            b = CGFloat((rgbValue & 0x0000FF00) >> 8) / 255.0
            a = CGFloat(rgbValue & 0x000000FF) / 255.0
        } else {
            r = CGFloat((rgbValue & 0xFF0000) >> 16) / 255.0
            g = CGFloat((rgbValue & 0x00FF00) >> 8) / 255.0
            b = CGFloat(rgbValue & 0x0000FF) / 255.0
            a = 1.0
        }
        
        self.init(red: r, green: g, blue: b, alpha: a)
    }
}

// MARK: - Diacritics Generator (Test Implementation)

/// Generates diacritic options for a letter at runtime
class DiacriticsGenerator {
    
    static func generateOptions(
        for letter: String,
        diacritics: DiacriticsDefinition?,
        settings: DiacriticsSettings?
    ) -> [GeneratedDiacriticOption] {
        guard let diacritics = diacritics else {
            return []
        }
        
        let hidden = settings?.hidden ?? []
        
        var result: [GeneratedDiacriticOption] = []
        
        for item in diacritics.items {
            // Skip if hidden in profile
            if hidden.contains(item.id) {
                continue
            }
            
            // Skip if not applicable to this letter (onlyFor check)
            if let onlyFor = item.onlyFor, !onlyFor.contains(letter) {
                continue
            }
            
            // Skip if excluded for this letter
            if let excludeFor = item.excludeFor, excludeFor.contains(letter) {
                continue
            }
            
            // Determine the output value
            let isReplacement = item.isReplacement ?? false
            let value = isReplacement ? item.mark : (letter + item.mark)
            
            result.append(GeneratedDiacriticOption(
                id: item.id,
                value: value,
                name: item.name
            ))
            
            // Add modifier variants if applicable
            for modifier in diacritics.getModifiers() {
                // Skip if this modifier is disabled in settings
                guard settings?.isModifierEnabled(modifier.id) ?? true else { continue }
                
                // Skip for replacements or plain items
                guard !isReplacement, item.id != "plain" else { continue }
                
                // Check if modifier applies to this letter
                let modifierApplies: Bool
                if let appliesTo = modifier.appliesTo {
                    modifierApplies = appliesTo.contains(letter)
                } else if let excludeFor = modifier.excludeFor {
                    modifierApplies = !excludeFor.contains(letter)
                } else {
                    modifierApplies = true
                }
                
                guard modifierApplies else { continue }
                
                if let modifierMark = modifier.mark {
                    // Simple toggle modifier: add mark
                    let modifiedValue = letter + modifierMark + item.mark
                    result.append(GeneratedDiacriticOption(
                        id: "\(item.id)+\(modifier.id)",
                        value: modifiedValue,
                        name: "\(item.name) + \(modifier.name)"
                    ))
                }
            }
        }
        
        return result
    }
}

// MARK: - Test Fixture Structures

struct DiacriticsTestFixture: Codable {
    let name: String
    let description: String
    let input: DiacriticsTestInput
    let expected: [DiacriticsTestExpected]
}

struct DiacriticsTestInput: Codable {
    let letter: String
    let diacritics: DiacriticsDefinition
    let settings: DiacriticsSettings?
}

struct DiacriticsTestExpected: Codable {
    let id: String
    let value: String
    let name: String
}

// MARK: - Test Classes

class DiacriticsGeneratorTests: XCTestCase {
    
    // MARK: - Test Loading Fixtures
    
    func testLoadFixturesDirectory() throws {
        let fm = FileManager.default
        let fixturePath = getFixturesPath()
        
        XCTAssertTrue(fm.fileExists(atPath: fixturePath), "Fixtures directory should exist at: \(fixturePath)")
        
        let files = try fm.contentsOfDirectory(atPath: fixturePath)
        let jsonFiles = files.filter { $0.hasSuffix(".json") }
        
        XCTAssertGreaterThan(jsonFiles.count, 0, "Should have at least one test fixture")
        print("Found \(jsonFiles.count) test fixtures: \(jsonFiles)")
    }
    
    // MARK: - Diacritics Generation Tests
    
    func testHebrewBetWithDagesh() throws {
        try runFixtureTest(named: "hebrew_bet_dagesh")
    }
    
    func testHebrewAlefNoDagesh() throws {
        try runFixtureTest(named: "hebrew_alef_no_dagesh")
    }
    
    func testHebrewShinMultiOption() throws {
        try runFixtureTest(named: "hebrew_shin_multi_option")
    }
    
    func testHebrewVavReplacement() throws {
        try runFixtureTest(named: "hebrew_vav_replacement")
    }
    
    func testHebrewHiddenSettings() throws {
        try runFixtureTest(named: "hebrew_hidden_settings")
    }
    
    // MARK: - All Fixtures Test
    
    func testAllFixtures() throws {
        let fixtures = try loadAllFixtures()
        
        for fixture in fixtures {
            print("Testing: \(fixture.name)")
            try verifyFixture(fixture)
        }
    }
    
    // MARK: - Helper Methods
    
    private func getFixturesPath() -> String {
        // Use environment variable if set, otherwise use relative path
        if let envPath = ProcessInfo.processInfo.environment["TEST_FIXTURES_PATH"] {
            return envPath
        }
        
        // Try to find fixtures relative to source file
        let sourceFile = #file
        let sourceDir = (sourceFile as NSString).deletingLastPathComponent
        let iosDir = (sourceDir as NSString).deletingLastPathComponent
        let projectRoot = (iosDir as NSString).deletingLastPathComponent
        return (projectRoot as NSString).appendingPathComponent("__tests__/fixtures/diacritics")
    }
    
    private func runFixtureTest(named fixtureName: String) throws {
        let fixture = try loadFixture(named: fixtureName)
        try verifyFixture(fixture)
    }
    
    private func loadFixture(named name: String) throws -> DiacriticsTestFixture {
        let fixturePath = getFixturesPath()
        let filePath = (fixturePath as NSString).appendingPathComponent("\(name).json")
        
        guard FileManager.default.fileExists(atPath: filePath) else {
            throw TestError.fixtureNotFound("Fixture not found at: \(filePath)")
        }
        
        let data = try Data(contentsOf: URL(fileURLWithPath: filePath))
        let decoder = JSONDecoder()
        return try decoder.decode(DiacriticsTestFixture.self, from: data)
    }
    
    private func loadAllFixtures() throws -> [DiacriticsTestFixture] {
        let fixturePath = getFixturesPath()
        let fm = FileManager.default
        
        guard fm.fileExists(atPath: fixturePath) else {
            throw TestError.fixtureNotFound("Fixtures directory not found at: \(fixturePath)")
        }
        
        let files = try fm.contentsOfDirectory(atPath: fixturePath)
        let jsonFiles = files.filter { $0.hasSuffix(".json") }
        
        var fixtures: [DiacriticsTestFixture] = []
        let decoder = JSONDecoder()
        
        for file in jsonFiles {
            let filePath = (fixturePath as NSString).appendingPathComponent(file)
            let data = try Data(contentsOf: URL(fileURLWithPath: filePath))
            let fixture = try decoder.decode(DiacriticsTestFixture.self, from: data)
            fixtures.append(fixture)
        }
        
        return fixtures
    }
    
    private func verifyFixture(_ fixture: DiacriticsTestFixture) throws {
        let input = fixture.input
        
        // Call the DiacriticsGenerator
        let actualResults = DiacriticsGenerator.generateOptions(
            for: input.letter,
            diacritics: input.diacritics,
            settings: input.settings
        )
        
        // Verify count matches
        XCTAssertEqual(
            actualResults.count,
            fixture.expected.count,
            "[\(fixture.name)] Expected \(fixture.expected.count) options but got \(actualResults.count). " +
            "Expected IDs: \(fixture.expected.map { $0.id }), Actual IDs: \(actualResults.map { $0.id })"
        )
        
        // Verify each expected item
        for (index, expected) in fixture.expected.enumerated() {
            guard index < actualResults.count else {
                XCTFail("[\(fixture.name)] Missing result at index \(index)")
                continue
            }
            
            let actual = actualResults[index]
            
            XCTAssertEqual(
                actual.id,
                expected.id,
                "[\(fixture.name)] ID mismatch at index \(index): expected '\(expected.id)' but got '\(actual.id)'"
            )
            
            XCTAssertEqual(
                actual.value,
                expected.value,
                "[\(fixture.name)] Value mismatch for '\(expected.id)': expected '\(expected.value)' but got '\(actual.value)'"
            )
            
            XCTAssertEqual(
                actual.name,
                expected.name,
                "[\(fixture.name)] Name mismatch for '\(expected.id)': expected '\(expected.name)' but got '\(actual.name)'"
            )
        }
    }
    
    enum TestError: Error {
        case fixtureNotFound(String)
    }
}

// MARK: - ShiftState Tests

class ShiftStateTests: XCTestCase {
    
    func testInitialState() {
        let state: ShiftState = .inactive
        XCTAssertFalse(state.isActive())
    }
    
    func testToggleFromInactive() {
        let state: ShiftState = .inactive
        let newState = state.toggle()
        XCTAssertEqual(newState.isActive(), true)
    }
    
    func testToggleFromActive() {
        let state: ShiftState = .active
        let newState = state.toggle()
        XCTAssertFalse(newState.isActive())
    }
    
    func testToggleFromLocked() {
        let state: ShiftState = .locked
        let newState = state.toggle()
        XCTAssertFalse(newState.isActive())
    }
    
    func testLock() {
        let state: ShiftState = .active
        let newState = state.lock()
        XCTAssertTrue(newState.isActive())
        if case .locked = newState {
            // Expected
        } else {
            XCTFail("Expected locked state")
        }
    }
}

// MARK: - Color Parsing Tests

class ColorParsingTests: XCTestCase {
    
    func testHex6Digit() {
        let color = UIColor(hexString: "#FF0000")
        XCTAssertNotNil(color)
        
        var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
        color?.getRed(&red, green: &green, blue: &blue, alpha: &alpha)
        
        XCTAssertEqual(red, 1.0, accuracy: 0.01)
        XCTAssertEqual(green, 0.0, accuracy: 0.01)
        XCTAssertEqual(blue, 0.0, accuracy: 0.01)
        XCTAssertEqual(alpha, 1.0, accuracy: 0.01)
    }
    
    func testHex6DigitNoHash() {
        let color = UIColor(hexString: "00FF00")
        XCTAssertNotNil(color)
        
        var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
        color?.getRed(&red, green: &green, blue: &blue, alpha: &alpha)
        
        XCTAssertEqual(red, 0.0, accuracy: 0.01)
        XCTAssertEqual(green, 1.0, accuracy: 0.01)
        XCTAssertEqual(blue, 0.0, accuracy: 0.01)
    }
    
    func testHex8DigitWithAlpha() {
        let color = UIColor(hexString: "#FF000080")
        XCTAssertNotNil(color)
        
        var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
        color?.getRed(&red, green: &green, blue: &blue, alpha: &alpha)
        
        XCTAssertEqual(red, 1.0, accuracy: 0.01)
    }
    
    func testInvalidHex() {
        let color = UIColor(hexString: "invalid")
        XCTAssertNil(color)
    }
    
    func testEmptyString() {
        let color = UIColor(hexString: "")
        XCTAssertNil(color)
    }
}