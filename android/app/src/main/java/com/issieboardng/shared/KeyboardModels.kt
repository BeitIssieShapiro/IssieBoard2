package com.issieboardng.shared

import android.graphics.Color

/**
 * Keyboard Configuration Models
 * Port of ios/Shared/KeyboardModels.swift
 */

// MARK: - Keyboard Configuration Models

data class KeyboardConfig(
    val backgroundColor: String? = null,
    val keysBgColor: String? = null,  // Default background color for keys
    val textColor: String? = null,    // Default text color for keys
    val defaultKeyset: String? = null,
    val keysets: List<Keyset> = emptyList(),
    val groups: List<Group>? = null,
    val keyboards: List<String>? = null,
    val defaultKeyboard: String? = null,
    val diacritics: DiacriticsDefinition? = null,  // Backward compatibility
    val allDiacritics: Map<String, DiacriticsDefinition>? = null,  // Per-keyboard diacritics definitions
    val diacriticsSettings: Map<String, DiacriticsSettings>? = null,  // Per-keyboard settings from profile
    val wordSuggestionsEnabled: Boolean? = null,  // Enable/disable word suggestions (default: true)
    val autoCorrectEnabled: Boolean? = null,  // Enable/disable auto-correct on space (default: false)
    val fontName: String? = null  // Custom font name to use for character keys (e.g., 'DanaYadAlefAlefAlef-Normal.otf')
) {
    /** Check if word suggestions are enabled (defaults to true if not specified) */
    val isWordSuggestionsEnabled: Boolean
        get() = wordSuggestionsEnabled ?: true
    
    /** Check if auto-correct is enabled (defaults to false if not specified) */
    val isAutoCorrectEnabled: Boolean
        get() = autoCorrectEnabled ?: false
    
    /** Get diacritics for a specific keyboard ID */
    fun getDiacritics(keyboardId: String?): DiacriticsDefinition? {
        if (keyboardId == null) {
            return diacritics  // Fallback to legacy field
        }
        return allDiacritics?.get(keyboardId) ?: diacritics
    }
}

data class Keyset(
    val id: String,
    val rows: List<KeyRow>
)

data class KeyRow(
    val keys: List<Key>
)

data class Key(
    val value: String? = null,
    val sValue: String? = null,
    val caption: String? = null,
    val sCaption: String? = null,
    val type: String? = null,
    val width: Double? = null,
    val offset: Double? = null,
    val hidden: Boolean? = null,
    val color: String? = null,
    val bgColor: String? = null,
    val fontSize: Double? = null,  // Custom font size for this key (overrides default)
    val label: String? = null,
    val keysetValue: String? = null,
    val returnKeysetValue: String? = null,
    val returnKeysetLabel: String? = null,
    val nikkud: List<NikkudOption>? = null,
    val showOn: List<String>? = null,  // Filter key visibility by screen size ("mobile" or "largeScreen")
    val flex: Boolean? = null,  // If true, this key absorbs extra width from hidden keys in the same row
    val showForField: List<String>? = null  // Filter key visibility by input field type (e.g., "email", "url")
) {
    /**
     * Check if this key should be shown based on screen size
     * @param isLargeScreen True if device has large screen (tablet)
     * @return True if key should be visible on this screen size
     */
    fun shouldShow(isLargeScreen: Boolean): Boolean {
        val filter = showOn
        if (filter.isNullOrEmpty()) {
            return true  // No filter = show everywhere
        }
        
        return if (isLargeScreen) {
            filter.contains("large-screen")  // Use kebab-case to match JSON
        } else {
            filter.contains("mobile")
        }
    }
    
    /**
     * Check if this key should be shown for the current field type
     * @param fieldType The input field type (e.g., "email", "url", "default")
     * @return True if key should be visible for this field type
     */
    fun shouldShow(fieldType: String?): Boolean {
        val filter = showForField
        if (filter.isNullOrEmpty()) {
            return true  // No filter = show for all field types
        }
        
        if (fieldType == null) {
            return false  // Has filter but no field type = don't show
        }
        
        return filter.contains(fieldType)
    }
}

data class NikkudOption(
    val value: String,
    val caption: String? = null,
    val sValue: String? = null,
    val sCaption: String? = null
)

// MARK: - Diacritics System (New)

/** Individual diacritic mark definition */
data class DiacriticItem(
    val id: String,           // Unique identifier (e.g., "kamatz", "patach")
    val mark: String,         // Unicode combining mark or replacement character
    val name: String,         // Display name in the keyboard's language
    val onlyFor: List<String>? = null,   // If present, only show for these letters
    val excludeFor: List<String>? = null, // If present, don't show for these letters
    val isReplacement: Boolean? = null // If true, replaces the letter entirely
)

/** Option for a multi-option modifier (like shin/sin) */
data class DiacriticModifierOption(
    val id: String,           // Unique identifier (e.g., "shin", "sin")
    val mark: String,         // Unicode combining mark
    val name: String          // Display name
)

/** Modifier that can combine with other diacritics (like dagesh or shadda) */
data class DiacriticModifier(
    val id: String,            // Unique identifier (e.g., "dagesh", "shinSin")
    val mark: String? = null,  // Unicode combining mark (for simple toggle, nil for multi-option)
    val name: String,          // Display name
    val appliesTo: List<String>? = null,  // If present, only applies to these letters
    val excludeFor: List<String>? = null, // If present, doesn't apply to these letters
    val options: List<DiacriticModifierOption>? = null  // If present, this is a multi-option modifier
) {
    /** Check if this modifier has options (multi-option) vs simple toggle */
    val isMultiOption: Boolean
        get() = options != null && options.isNotEmpty()
}

/** Diacritics definition for a keyboard */
data class DiacriticsDefinition(
    val appliesTo: List<String>? = null,             // Characters that should trigger diacritics popup
    val items: List<DiacriticItem> = emptyList(),
    val modifier: DiacriticModifier? = null,     // Backward compatibility - single modifier
    @get:JvmName("getModifiersList")
    val modifiers: List<DiacriticModifier>? = null  // New - array of modifiers
) {
    /** Check if diacritics apply to a given character */
    fun appliesTo(character: String): Boolean {
        val validChars = appliesTo ?: return false  // If appliesTo is not defined, diacritics don't apply to any character
        return validChars.contains(character)
    }
    
    /** Get all applicable modifiers (prefers modifiers array, falls back to single modifier) */
    fun getAllModifiers(): List<DiacriticModifier> {
        if (modifiers != null && modifiers.isNotEmpty()) {
            return modifiers
        }
        if (modifier != null) {
            return listOf(modifier)
        }
        return emptyList()
    }
    
    /** Get modifiers that apply to a specific letter */
    fun getModifiersForLetter(letter: String): List<DiacriticModifier> {
        return getAllModifiers().filter { modifier ->
            if (modifier.appliesTo != null) {
                modifier.appliesTo.contains(letter)
            } else if (modifier.excludeFor != null) {
                !modifier.excludeFor.contains(letter)
            } else {
                true
            }
        }
    }
}

/** Per-keyboard diacritics settings in profile */
data class DiacriticsSettings(
    val hidden: List<String>? = null,             // Array of diacritic IDs to hide
    val disabledModifiers: List<String>? = null,  // Array of modifier IDs to disable
    val disabled: Boolean? = null                 // If true, completely disable nikkud for this keyboard (hide nikkud key)
) {
    /** Check if a specific modifier is enabled */
    fun isModifierEnabled(modifierId: String): Boolean {
        val disabled = disabledModifiers ?: return true
        return !disabled.contains(modifierId)
    }
    
    /** Check if diacritics are completely disabled for this keyboard */
    val isDisabled: Boolean
        get() = disabled ?: false
}

/** Generated diacritic option for display */
data class GeneratedDiacriticOption(
    val id: String,
    val value: String,
    val name: String
)

// MARK: - Visibility Mode

/** Tri-state visibility control for group templates */
enum class VisibilityMode(val value: String) {
    DEFAULT("default"),      // No effect on visibility
    HIDE("hide"),           // Hide the selected keys
    SHOW_ONLY("showOnly");  // Show only the selected keys (hide all others)
    
    companion object {
        fun from(value: String?): VisibilityMode {
            if (value == null) return DEFAULT
            return values().find { it.value == value } ?: DEFAULT
        }
    }
}

data class Group(
    val items: List<String>,
    val template: GroupTemplate
)

data class GroupTemplate(
    val width: Double? = null,
    val offset: Double? = null,
    val hidden: Boolean? = null,  // Backward compatibility
    val visibilityMode: String? = null,  // New tri-state visibility ("default", "hide", "showOnly")
    val color: String? = null,
    val bgColor: String? = null
) {
    /** Get effective visibility mode (handles backward compatibility with hidden boolean) */
    val effectiveVisibilityMode: VisibilityMode
        get() {
            // New visibilityMode takes precedence
            if (visibilityMode != null) {
                return VisibilityMode.from(visibilityMode)
            }
            // Fall back to hidden boolean (backward compatibility)
            if (hidden == true) {
                return VisibilityMode.HIDE
            }
            return VisibilityMode.DEFAULT
        }
}

// MARK: - Shift State

enum class ShiftState {
    INACTIVE,
    ACTIVE,
    LOCKED;
    
    fun toggle(): ShiftState {
        return when (this) {
            INACTIVE -> ACTIVE
            ACTIVE -> INACTIVE
            LOCKED -> INACTIVE
        }
    }
    
    fun lock(): ShiftState {
        return LOCKED
    }
    
    fun isActive(): Boolean {
        return this != INACTIVE
    }
}

// MARK: - Parsed Key Configuration (with resolved colors and groups)

data class ParsedKey(
    val value: String,
    val sValue: String,
    val caption: String,
    val sCaption: String,
    val type: String,
    val width: Double,
    val offset: Double,
    val hidden: Boolean,
    val textColor: Int,
    val backgroundColor: Int,
    val fontSize: Double?,  // Custom font size (null = use default)
    val label: String,
    val keysetValue: String,
    val returnKeysetValue: String,
    val returnKeysetLabel: String,
    val nikkud: List<NikkudOption>
) {
    companion object {
        fun from(
            key: Key,
            groups: Map<String, GroupTemplate>,
            defaultTextColor: Int,
            defaultBgColor: Int
        ): ParsedKey {
            val value = key.value ?: ""
            val keyType = key.type ?: ""
            val sValue = key.sValue ?: value
            val caption = key.caption ?: value
            val sCaption = key.sCaption ?: (key.sValue ?: (key.caption ?: value))
            val label = key.label ?: ""
            val keysetValue = key.keysetValue ?: ""
            val returnKeysetValue = key.returnKeysetValue ?: ""
            val returnKeysetLabel = key.returnKeysetLabel ?: ""
            val nikkud = key.nikkud ?: emptyList()
            
            // Get group template if exists - check by value first, then by type for special keys
            val groupTemplate = groups[value] ?: if (value.isEmpty()) groups[keyType] else null
            
            // Resolve width
            val width = key.width ?: groupTemplate?.width ?: 1.0
            
            // Resolve offset
            val offset = key.offset ?: groupTemplate?.offset ?: 0.0
            
            // Resolve hidden
            val hidden = key.hidden ?: groupTemplate?.hidden ?: false
            
            // Resolve colors
            val textColorString = key.color ?: groupTemplate?.color
            val textColor = if (!textColorString.isNullOrEmpty()) {
                parseColor(textColorString) ?: defaultTextColor
            } else {
                defaultTextColor
            }
            
            val bgColorString = key.bgColor ?: groupTemplate?.bgColor
            val backgroundColor = if (!bgColorString.isNullOrEmpty()) {
                parseColor(bgColorString) ?: defaultBgColor
            } else {
                defaultBgColor
            }
            
            return ParsedKey(
                value = value,
                sValue = sValue,
                caption = caption,
                sCaption = sCaption,
                type = keyType,
                width = width,
                offset = offset,
                hidden = hidden,
                textColor = textColor,
                backgroundColor = backgroundColor,
                fontSize = key.fontSize,  // Pass through custom font size
                label = label,
                keysetValue = keysetValue,
                returnKeysetValue = returnKeysetValue,
                returnKeysetLabel = returnKeysetLabel,
                nikkud = nikkud
            )
        }
    }
}

// MARK: - Color Parsing Extension

/** Parse hex color string to Android Color int */
fun parseColor(hexString: String): Int? {
    var hex = hexString.trim()
    
    if (hex.startsWith("#")) {
        hex = hex.substring(1)
    }
    
    if (hex.length != 6 && hex.length != 8) {
        return null
    }
    
    return try {
        if (hex.length == 8) {
            // RRGGBBAA format - convert to AARRGGBB for Android
            val r = hex.substring(0, 2).toInt(16)
            val g = hex.substring(2, 4).toInt(16)
            val b = hex.substring(4, 6).toInt(16)
            val a = hex.substring(6, 8).toInt(16)
            Color.argb(a, r, g, b)
        } else {
            // RRGGBB format
            Color.parseColor("#$hex")
        }
    } catch (e: Exception) {
        null
    }
}

// MARK: - Diacritics Generator

/** Generates diacritic options for a letter at runtime based on keyboard definition and profile settings */
object DiacriticsGenerator {
    
    /**
     * Generate diacritic options for a specific letter
     * @param letter The base letter to generate diacritics for
     * @param diacritics The keyboard's diacritics definition
     * @param settings Optional profile settings to filter diacritics
     * @return Array of generated diacritic options
     */
    fun generateOptions(
        letter: String,
        diacritics: DiacriticsDefinition?,
        settings: DiacriticsSettings?
    ): List<GeneratedDiacriticOption> {
        if (diacritics == null) {
            return emptyList()
        }
        
        // Check if diacritics apply to this letter at all
        if (!diacritics.appliesTo(letter)) {
            return emptyList()
        }
        
        val hidden = settings?.hidden ?: emptyList()
        
        val result = mutableListOf<GeneratedDiacriticOption>()
        
        for (item in diacritics.items) {
            // Skip if hidden in profile
            if (hidden.contains(item.id)) {
                continue
            }
            
            // Skip if not applicable to this letter (onlyFor check)
            if (item.onlyFor != null && !item.onlyFor.contains(letter)) {
                continue
            }
            
            // Skip if excluded for this letter
            if (item.excludeFor != null && item.excludeFor.contains(letter)) {
                continue
            }
            
            // Determine the output value
            val isReplacement = item.isReplacement ?: false
            val value = if (isReplacement) item.mark else (letter + item.mark)
            
            result.add(GeneratedDiacriticOption(
                id = item.id,
                value = value,
                name = item.name
            ))
            
            // Add modifier variant if applicable (e.g., dagesh, shadda)
            // Check each modifier independently
            for (modifier in diacritics.getAllModifiers()) {
                // Skip if this modifier is disabled in settings
                if (settings?.isModifierEnabled(modifier.id) != true && settings != null) {
                    continue
                }
                
                // Skip for replacements or plain items
                if (isReplacement || item.id == "plain") {
                    continue
                }
                
                // Check if modifier applies to this letter
                val modifierApplies = when {
                    modifier.appliesTo != null -> modifier.appliesTo.contains(letter)
                    modifier.excludeFor != null -> !modifier.excludeFor.contains(letter)
                    else -> true
                }
                
                if (!modifierApplies) {
                    continue
                }
                
                if (modifier.mark != null) {
                    // Simple toggle modifier: add mark
                    val modifiedValue = letter + modifier.mark + item.mark
                    result.add(GeneratedDiacriticOption(
                        id = "${item.id}+${modifier.id}",
                        value = modifiedValue,
                        name = "${item.name} + ${modifier.name}"
                    ))
                }
            }
        }
        
        return result
    }
    
    /** Convert generated options to NikkudOption array for compatibility with existing code */
    fun toNikkudOptions(options: List<GeneratedDiacriticOption>): List<NikkudOption> {
        return options.map { option ->
            NikkudOption(
                value = option.value,
                caption = option.value,  // Use value as caption for display
                sValue = null,
                sCaption = null
            )
        }
    }
    
    /**
     * Check if a letter has diacritics available (either explicit or generated)
     */
    fun hasDiacritics(
        letter: String,
        explicitNikkud: List<NikkudOption>,
        diacritics: DiacriticsDefinition?,
        settings: DiacriticsSettings?
    ): Boolean {
        // If explicit nikkud array exists and is not empty, use that
        if (explicitNikkud.isNotEmpty()) {
            return true
        }
        
        // Otherwise, check if we can generate diacritics
        val generated = generateOptions(letter, diacritics, settings)
        return generated.isNotEmpty()
    }
    
    /**
     * Get diacritics for a key (prefer explicit, fall back to generated)
     */
    fun getDiacritics(
        key: ParsedKey,
        diacritics: DiacriticsDefinition?,
        settings: DiacriticsSettings?
    ): List<NikkudOption> {
        // If explicit nikkud array exists, use it (backward compatibility)
        if (key.nikkud.isNotEmpty()) {
            return key.nikkud
        }
        
        // Otherwise, generate from diacritics definition
        val generated = generateOptions(key.value, diacritics, settings)
        return toNikkudOptions(generated)
    }
}