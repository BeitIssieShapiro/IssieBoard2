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
    val keysets: Map<String, ParsedKeyset>
)

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