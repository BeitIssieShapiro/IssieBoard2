import XCTest
import UIKit

// MARK: - Test-specific types
// Note: All main types (DiacriticItem, DiacriticsDefinition, DiacriticsSettings, ShiftState,
// GeneratedDiacriticOption, DiacriticsGenerator) are imported from KeyboardModels.swift
// via the test target membership. No duplicate definitions needed here.

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
    
    func testNumberNoDiacritics() throws {
        try runFixtureTest(named: "hebrew_number_no_diacritics")
    }
    
    // MARK: - AppliesTo Tests
    
    func testAppliesToReturnsTrueForHebrewLetter() {
        let diacritics = DiacriticsDefinition(
            appliesTo: ["א", "ב", "ג"],
            items: [],
            modifier: nil,
            modifiers: nil
        )
        XCTAssertTrue(diacritics.appliesTo(character: "א"))
        XCTAssertTrue(diacritics.appliesTo(character: "ב"))
        XCTAssertTrue(diacritics.appliesTo(character: "ג"))
    }
    
    func testAppliesToReturnsFalseForNumber() {
        let diacritics = DiacriticsDefinition(
            appliesTo: ["א", "ב", "ג"],
            items: [],
            modifier: nil,
            modifiers: nil
        )
        XCTAssertFalse(diacritics.appliesTo(character: "1"))
        XCTAssertFalse(diacritics.appliesTo(character: "2"))
        XCTAssertFalse(diacritics.appliesTo(character: "0"))
    }
    
    func testAppliesToReturnsFalseForPunctuation() {
        let diacritics = DiacriticsDefinition(
            appliesTo: ["א", "ב", "ג"],
            items: [],
            modifier: nil,
            modifiers: nil
        )
        XCTAssertFalse(diacritics.appliesTo(character: "."))
        XCTAssertFalse(diacritics.appliesTo(character: ","))
        XCTAssertFalse(diacritics.appliesTo(character: "!"))
    }
    
    func testAppliesToReturnsFalseWhenNil() {
        let diacritics = DiacriticsDefinition(
            appliesTo: nil,
            items: [],
            modifier: nil,
            modifiers: nil
        )
        XCTAssertFalse(diacritics.appliesTo(character: "א"))
        XCTAssertFalse(diacritics.appliesTo(character: "1"))
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