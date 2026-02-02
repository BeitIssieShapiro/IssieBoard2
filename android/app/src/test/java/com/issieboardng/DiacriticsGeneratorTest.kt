package com.issieboardng

import com.issieboardng.shared.*
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.File

/**
 * Tests for DiacriticsGenerator using shared JSON fixtures.
 * These tests verify that the Android implementation produces the same results
 * as expected by the cross-platform test fixtures.
 */
class DiacriticsGeneratorTest {

    companion object {
        /**
         * Get the path to test fixtures directory.
         * When running from Android Studio or Gradle, we navigate relative to the project.
         */
        private fun getFixturesPath(): String {
            // Try to find fixtures relative to current working directory
            val possiblePaths = listOf(
                // From android/app directory (Gradle test execution)
                "../../__tests__/fixtures/diacritics",
                // From android directory
                "../__tests__/fixtures/diacritics",
                // From project root
                "__tests__/fixtures/diacritics",
                // Absolute path fallback (set via environment)
                System.getenv("TEST_FIXTURES_PATH") ?: ""
            )
            
            for (path in possiblePaths) {
                if (path.isNotEmpty()) {
                    val dir = File(path)
                    if (dir.exists() && dir.isDirectory) {
                        return dir.absolutePath
                    }
                }
            }
            
            throw IllegalStateException(
                "Could not find test fixtures directory. " +
                "Tried paths: $possiblePaths. " +
                "Current working directory: ${System.getProperty("user.dir")}"
            )
        }
        
        private fun loadAllFixtures(): List<TestFixture> {
            val fixturesPath = getFixturesPath()
            val dir = File(fixturesPath)
            
            return dir.listFiles { file -> file.extension == "json" }
                ?.map { file -> parseFixture(file.readText()) }
                ?: emptyList()
        }
        
        private fun loadFixture(name: String): TestFixture {
            val fixturesPath = getFixturesPath()
            val file = File(fixturesPath, "$name.json")
            require(file.exists()) { "Fixture not found: ${file.absolutePath}" }
            return parseFixture(file.readText())
        }
        
        private fun parseFixture(json: String): TestFixture {
            val obj = JSONObject(json)
            return TestFixture(
                name = obj.getString("name"),
                description = obj.getString("description"),
                input = parseInput(obj.getJSONObject("input")),
                expected = parseExpected(obj.getJSONArray("expected"))
            )
        }
        
        private fun parseInput(obj: JSONObject): TestInput {
            val diacriticsObj = obj.getJSONObject("diacritics")
            val settingsObj = obj.optJSONObject("settings")
            
            return TestInput(
                letter = obj.getString("letter"),
                diacritics = parseDiacriticsDefinition(diacriticsObj),
                settings = settingsObj?.let { parseDiacriticsSettings(it) }
            )
        }
        
        private fun parseDiacriticsDefinition(obj: JSONObject): DiacriticsDefinition {
            // Parse appliesTo array at definition level
            val appliesTo = parseStringArray(obj.optJSONArray("appliesTo"))
            
            val itemsArray = obj.getJSONArray("items")
            val items = mutableListOf<DiacriticItem>()
            
            for (i in 0 until itemsArray.length()) {
                val itemObj = itemsArray.getJSONObject(i)
                items.add(DiacriticItem(
                    id = itemObj.getString("id"),
                    mark = itemObj.getString("mark"),
                    name = itemObj.getString("name"),
                    onlyFor = parseStringArray(itemObj.optJSONArray("onlyFor")),
                    excludeFor = parseStringArray(itemObj.optJSONArray("excludeFor")),
                    isReplacement = itemObj.optBoolean("isReplacement", false)
                ))
            }
            
            // Parse modifiers array
            val modifiersArray = obj.optJSONArray("modifiers")
            val modifiers = mutableListOf<DiacriticModifier>()
            
            if (modifiersArray != null) {
                for (i in 0 until modifiersArray.length()) {
                    val modObj = modifiersArray.getJSONObject(i)
                    modifiers.add(parseDiacriticModifier(modObj))
                }
            }
            
            // Parse legacy single modifier
            val legacyModifier = obj.optJSONObject("modifier")?.let { parseDiacriticModifier(it) }
            
            return DiacriticsDefinition(
                appliesTo = appliesTo,
                items = items,
                modifier = legacyModifier,
                modifiers = if (modifiers.isEmpty()) null else modifiers
            )
        }
        
        private fun parseDiacriticModifier(obj: JSONObject): DiacriticModifier {
            val optionsArray = obj.optJSONArray("options")
            val options = if (optionsArray != null) {
                val list = mutableListOf<DiacriticModifierOption>()
                for (i in 0 until optionsArray.length()) {
                    val optObj = optionsArray.getJSONObject(i)
                    list.add(DiacriticModifierOption(
                        id = optObj.getString("id"),
                        mark = optObj.getString("mark"),
                        name = optObj.getString("name")
                    ))
                }
                list
            } else null
            
            return DiacriticModifier(
                id = obj.getString("id"),
                mark = obj.optString("mark", "").takeIf { it.isNotEmpty() },
                name = obj.getString("name"),
                appliesTo = parseStringArray(obj.optJSONArray("appliesTo")),
                excludeFor = parseStringArray(obj.optJSONArray("excludeFor")),
                options = options
            )
        }
        
        private fun parseDiacriticsSettings(obj: JSONObject): DiacriticsSettings {
            return DiacriticsSettings(
                hidden = parseStringArray(obj.optJSONArray("hidden")) ?: emptyList(),
                disabledModifiers = parseStringArray(obj.optJSONArray("disabledModifiers")) ?: emptyList()
            )
        }
        
        private fun parseStringArray(array: JSONArray?): List<String>? {
            if (array == null) return null
            val result = mutableListOf<String>()
            for (i in 0 until array.length()) {
                result.add(array.getString(i))
            }
            return if (result.isEmpty()) null else result
        }
        
        private fun parseExpected(array: JSONArray): List<ExpectedOption> {
            val result = mutableListOf<ExpectedOption>()
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                result.add(ExpectedOption(
                    id = obj.getString("id"),
                    value = obj.getString("value"),
                    name = obj.getString("name")
                ))
            }
            return result
        }
    }
    
    // MARK: - Test Fixture Data Classes
    
    data class TestFixture(
        val name: String,
        val description: String,
        val input: TestInput,
        val expected: List<ExpectedOption>
    )
    
    data class TestInput(
        val letter: String,
        val diacritics: DiacriticsDefinition,
        val settings: DiacriticsSettings?
    )
    
    data class ExpectedOption(
        val id: String,
        val value: String,
        val name: String
    )
    
    // MARK: - Individual Test Methods
    
    @Test
    fun testHebrewBetWithDagesh() {
        runFixtureTest("hebrew_bet_dagesh")
    }
    
    @Test
    fun testHebrewAlefNoDagesh() {
        runFixtureTest("hebrew_alef_no_dagesh")
    }
    
    @Test
    fun testHebrewShinMultiOption() {
        runFixtureTest("hebrew_shin_multi_option")
    }
    
    @Test
    fun testHebrewVavReplacement() {
        runFixtureTest("hebrew_vav_replacement")
    }
    
    @Test
    fun testHebrewHiddenSettings() {
        runFixtureTest("hebrew_hidden_settings")
    }
    
    @Test
    fun testNumberNoDiacritics() {
        runFixtureTest("hebrew_number_no_diacritics")
    }
    
    // MARK: - AppliesTo Tests
    
    @Test
    fun testAppliesToReturnsTrueForHebrewLetter() {
        val diacritics = DiacriticsDefinition(
            appliesTo = listOf("א", "ב", "ג"),
            items = emptyList(),
            modifier = null,
            modifiers = null
        )
        assertTrue(diacritics.appliesTo("א"))
        assertTrue(diacritics.appliesTo("ב"))
        assertTrue(diacritics.appliesTo("ג"))
    }
    
    @Test
    fun testAppliesToReturnsFalseForNumber() {
        val diacritics = DiacriticsDefinition(
            appliesTo = listOf("א", "ב", "ג"),
            items = emptyList(),
            modifier = null,
            modifiers = null
        )
        assertFalse(diacritics.appliesTo("1"))
        assertFalse(diacritics.appliesTo("2"))
        assertFalse(diacritics.appliesTo("0"))
    }
    
    @Test
    fun testAppliesToReturnsFalseForPunctuation() {
        val diacritics = DiacriticsDefinition(
            appliesTo = listOf("א", "ב", "ג"),
            items = emptyList(),
            modifier = null,
            modifiers = null
        )
        assertFalse(diacritics.appliesTo("."))
        assertFalse(diacritics.appliesTo(","))
        assertFalse(diacritics.appliesTo("!"))
    }
    
    @Test
    fun testAppliesToReturnsFalseWhenNil() {
        val diacritics = DiacriticsDefinition(
            appliesTo = null,
            items = emptyList(),
            modifier = null,
            modifiers = null
        )
        assertFalse(diacritics.appliesTo("א"))
        assertFalse(diacritics.appliesTo("1"))
    }
    
    @Test
    fun testAllFixtures() {
        val fixtures = loadAllFixtures()
        assertTrue("Should have at least one fixture", fixtures.isNotEmpty())
        
        for (fixture in fixtures) {
            println("Testing: ${fixture.name}")
            verifyFixture(fixture)
        }
    }
    
    // MARK: - Helper Methods
    
    private fun runFixtureTest(fixtureName: String) {
        val fixture = loadFixture(fixtureName)
        verifyFixture(fixture)
    }
    
    private fun verifyFixture(fixture: TestFixture) {
        val input = fixture.input
        
        // Call the actual DiacriticsGenerator code from shared package
        val actualResults = DiacriticsGenerator.generateOptions(
            letter = input.letter,
            diacritics = input.diacritics,
            settings = input.settings
        )
        
        // Verify count matches
        assertEquals(
            "[${fixture.name}] Expected ${fixture.expected.size} options but got ${actualResults.size}. " +
            "Expected IDs: ${fixture.expected.map { it.id }}, Actual IDs: ${actualResults.map { it.id }}",
            fixture.expected.size,
            actualResults.size
        )
        
        // Verify each expected item
        fixture.expected.forEachIndexed { index, expected ->
            assertTrue(
                "[${fixture.name}] Missing result at index $index",
                index < actualResults.size
            )
            
            val actual = actualResults[index]
            
            assertEquals(
                "[${fixture.name}] ID mismatch at index $index: expected '${expected.id}' but got '${actual.id}'",
                expected.id,
                actual.id
            )
            
            assertEquals(
                "[${fixture.name}] Value mismatch for '${expected.id}': expected '${expected.value}' but got '${actual.value}'",
                expected.value,
                actual.value
            )
            
            assertEquals(
                "[${fixture.name}] Name mismatch for '${expected.id}': expected '${expected.name}' but got '${actual.name}'",
                expected.name,
                actual.name
            )
        }
    }
}

// MARK: - ShiftState Tests

class ShiftStateTest {
    
    @Test
    fun testInitialState() {
        val state: ShiftState = ShiftState.INACTIVE
        assertFalse(state.isActive())
    }
    
    @Test
    fun testToggleFromInactive() {
        val state: ShiftState = ShiftState.INACTIVE
        val newState = state.toggle()
        assertTrue(newState.isActive())
    }
    
    @Test
    fun testToggleFromActive() {
        val state: ShiftState = ShiftState.ACTIVE
        val newState = state.toggle()
        assertFalse(newState.isActive())
    }
    
    @Test
    fun testToggleFromLocked() {
        val state: ShiftState = ShiftState.LOCKED
        val newState = state.toggle()
        assertFalse(newState.isActive())
    }
    
    @Test
    fun testLock() {
        val state: ShiftState = ShiftState.ACTIVE
        val newState = state.lock()
        assertTrue(newState.isActive())
        assertEquals(ShiftState.LOCKED, newState)
    }
}

// MARK: - Color Parsing Tests

class ColorParsingTest {
    
    @Test
    fun testHex6Digit() {
        val color = parseColor("#FF0000")
        assertNotNull(color)
        // Red channel should be 255
        val red = (color!! shr 16) and 0xFF
        assertEquals(255, red)
    }
    
    @Test
    fun testHex6DigitNoHash() {
        val color = parseColor("00FF00")
        assertNotNull(color)
        // Green channel should be 255
        val green = (color!! shr 8) and 0xFF
        assertEquals(255, green)
    }
    
    @Test
    fun testHex8DigitWithAlpha() {
        val color = parseColor("#FF000080")
        assertNotNull(color)
        // Red channel should be 255
        val red = (color!! shr 16) and 0xFF
        assertEquals(255, red)
    }
    
    @Test
    fun testInvalidHex() {
        val color = parseColor("invalid")
        assertNull(color)
    }
    
    /**
     * Simple color parsing for tests (doesn't require Android framework)
     */
    private fun parseColor(colorString: String): Int? {
        var hex = colorString.trim()
        if (hex.startsWith("#")) {
            hex = hex.substring(1)
        }
        
        return try {
            when (hex.length) {
                6 -> {
                    val r = hex.substring(0, 2).toInt(16)
                    val g = hex.substring(2, 4).toInt(16)
                    val b = hex.substring(4, 6).toInt(16)
                    (0xFF shl 24) or (r shl 16) or (g shl 8) or b
                }
                8 -> {
                    val r = hex.substring(0, 2).toInt(16)
                    val g = hex.substring(2, 4).toInt(16)
                    val b = hex.substring(4, 6).toInt(16)
                    val a = hex.substring(6, 8).toInt(16)
                    (a shl 24) or (r shl 16) or (g shl 8) or b
                }
                else -> null
            }
        } catch (e: Exception) {
            null
        }
    }
}