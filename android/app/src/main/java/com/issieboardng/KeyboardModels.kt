package com.issieboardng

import android.graphics.Color

/**
 * Shared data models for keyboard components
 * Used by KeyboardRenderer, KeyboardConfigParser, SimpleKeyboardService, and KeyboardPreviewView
 */

/**
 * Shift state using sealed class for type safety
 */
sealed class ShiftState {
    object Inactive : ShiftState()
    object Active : ShiftState()
    object Locked : ShiftState()
    
    fun toggle(): ShiftState = when (this) {
        Inactive -> Active
        Active -> Inactive
        Locked -> Inactive
    }
    
    fun lock(): ShiftState = Locked
    fun unlock(): ShiftState = Inactive
    fun isActive(): Boolean = this != Inactive
}

/**
 * Nikkud/Tashkeel option for a key
 */
data class NikkudOption(
    val value: String,
    val caption: String
)

/**
 * Represents a complete key configuration
 */
data class KeyConfig(
    val value: String = "",
    val caption: String = "",
    val sValue: String = "",
    val sCaption: String = "",
    val type: String = "",
    val width: Float = 1.0f,
    val offset: Float = 0.0f,
    val hidden: Boolean = false,
    val textColor: Int = Color.BLACK,
    val backgroundColor: Int = Color.LTGRAY,
    val label: String = "",
    val keysetValue: String = "",
    val nikkud: List<NikkudOption> = emptyList()
)

/**
 * Group template for styling sets of keys
 */
data class GroupTemplate(
    val width: Float?,
    val offset: Float?,
    val hidden: Boolean?,
    val color: String,
    val bgColor: String
)

/**
 * Parsed keyset configuration
 */
data class ParsedKeyset(
    val id: String,
    val rows: List<List<KeyConfig>>,
    val groups: Map<String, GroupTemplate>
)

/**
 * Parsed configuration
 */
data class ParsedConfig(
    val backgroundColor: Int,
    val defaultKeysetId: String,
    val keysets: Map<String, ParsedKeyset>,
    val keyboards: List<String> = emptyList(),
    val allDiacritics: Map<String, DiacriticsDefinition> = emptyMap(),
    val diacriticsSettings: Map<String, DiacriticsSettings> = emptyMap(),
    val wordSuggestionsEnabled: Boolean = true  // Enable/disable word suggestions
) {
    /**
     * Get diacritics definition for a specific keyboard
     */
    fun getDiacritics(keyboardId: String?): DiacriticsDefinition? {
        if (keyboardId == null) return null
        return allDiacritics[keyboardId]
    }
}

/**
 * Editor context information for dynamic key behavior
 */
data class EditorContext(
    val enterVisible: Boolean,
    val enterEnabled: Boolean,
    val enterLabel: String,
    val actionId: Int
)

/**
 * Key event types for callbacks
 */
sealed class KeyEvent {
    data class TextInput(val text: String) : KeyEvent()
    object Backspace : KeyEvent()
    data class Enter(val actionId: Int) : KeyEvent()
    object Settings : KeyEvent()
    object Close : KeyEvent()
    object NextKeyboard : KeyEvent()
    data class Custom(val key: KeyConfig) : KeyEvent()
}

// ============ Diacritics Models ============

/**
 * A single diacritic mark (vowel, tashkeel)
 */
data class DiacriticItem(
    val id: String,
    val mark: String,
    val name: String,
    val onlyFor: List<String>? = null,
    val excludeFor: List<String>? = null,
    val isReplacement: Boolean = false
)

/**
 * Option for a multi-option modifier (e.g., shin/sin dot)
 */
data class DiacriticModifierOption(
    val id: String,
    val mark: String,
    val name: String
)

/**
 * A modifier that can combine with diacritics (e.g., dagesh, shadda, shin/sin dot)
 * Can be either:
 * - Simple toggle (has mark, no options): On/Off like dagesh
 * - Multi-option (has options array): None + N exclusive options like shin/sin
 */
data class DiacriticModifier(
    val id: String,
    val mark: String? = null,  // For simple toggle modifiers
    val name: String,
    val appliesTo: List<String>? = null,
    val excludeFor: List<String>? = null,
    val options: List<DiacriticModifierOption>? = null  // For multi-option modifiers
) {
    /**
     * Check if this modifier is a multi-option modifier
     */
    val isMultiOption: Boolean
        get() = options != null && options.isNotEmpty()
    
    /**
     * Check if this modifier applies to a given letter
     */
    fun appliesTo(letter: String): Boolean {
        return when {
            appliesTo != null -> appliesTo.contains(letter)
            excludeFor != null -> !excludeFor.contains(letter)
            else -> true
        }
    }
}

/**
 * Complete diacritics definition for a keyboard
 */
data class DiacriticsDefinition(
    val appliesTo: List<String>? = null,  // Characters that should trigger diacritics popup
    val items: List<DiacriticItem>,
    val modifier: DiacriticModifier? = null,  // Legacy single modifier
    val modifiers: List<DiacriticModifier>? = null  // New multiple modifiers
) {
    /**
     * Check if diacritics apply to a given character
     */
    fun appliesTo(character: String): Boolean {
        val validChars = appliesTo ?: return false
        return validChars.contains(character)
    }
    
    /**
     * Get all modifiers (combines legacy single modifier with new modifiers array)
     */
    fun getAllModifiers(): List<DiacriticModifier> {
        val result = mutableListOf<DiacriticModifier>()
        modifiers?.let { result.addAll(it) }
        if (result.isEmpty() && modifier != null) {
            result.add(modifier)
        }
        return result
    }
    
    /**
     * Get modifiers that apply to a specific letter
     */
    fun getModifiersForLetter(letter: String): List<DiacriticModifier> {
        return getAllModifiers().filter { it.appliesTo(letter) }
    }
}

/**
 * Profile settings for diacritics (per keyboard)
 */
data class DiacriticsSettings(
    val hidden: List<String> = emptyList(),
    val disabledModifiers: List<String> = emptyList()
) {
    /**
     * Check if a diacritic item is enabled
     */
    fun isItemEnabled(itemId: String): Boolean = !hidden.contains(itemId)
    
    /**
     * Check if a modifier is enabled
     */
    fun isModifierEnabled(modifierId: String): Boolean = !disabledModifiers.contains(modifierId)
}
