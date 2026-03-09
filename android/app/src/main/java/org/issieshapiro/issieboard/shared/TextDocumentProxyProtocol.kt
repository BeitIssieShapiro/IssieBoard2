package org.issieshapiro.issieboard.shared

/**
 * Port of ios/Shared/TextDocumentProxyProtocol.swift
 *
 * TextDocumentProxyProtocol - Abstraction over Android InputConnection
 *
 * This interface allows KeyboardEngine to work with different text input sources:
 * - Real keyboard services use InputConnection (Android system)
 * - Preview uses CustomTextDocumentProxy (React Native bridge)
 *
 * Mirrors the essential parts of InputConnection interface.
 */
interface TextDocumentProxyProtocol {
    /**
     * Text before the cursor/insertion point
     */
    val documentContextBeforeInput: String?

    /**
     * Text after the cursor/insertion point
     */
    val documentContextAfterInput: String?

    /**
     * Whether there is text in the document or a text selection
     */
    val hasText: Boolean

    /**
     * Insert text at cursor position
     */
    fun insertText(text: String)

    /**
     * Delete one character backward
     */
    fun deleteBackward()

    /**
     * Adjust cursor position by character offset
     */
    fun adjustTextPosition(offset: Int)

    /**
     * Keyboard type hint (for field type detection)
     * Maps to Android InputType
     */
    val keyboardType: Int?

    /**
     * Return key type (Go, Search, Done, etc.)
     * Maps to Android ImeOptions
     */
    val returnKeyType: Int?

    /**
     * Text content type (email, URL, etc.)
     * Maps to Android autofillHints
     */
    val textContentType: String?
}
