package org.issieshapiro.issieboard.shared

import android.view.inputmethod.InputConnection
import android.view.inputmethod.EditorInfo

/**
 * Port of ios/Shared/SystemTextDocumentProxy.swift
 *
 * SystemTextDocumentProxy - Android System Text Bridge
 *
 * Wraps Android InputConnection to conform to TextDocumentProxyProtocol.
 * This allows KeyboardEngine to work with the real Android keyboard service input connection.
 */
class SystemTextDocumentProxy(
    private val inputConnection: InputConnection,
    private val editorInfo: EditorInfo
) : TextDocumentProxyProtocol {

    // MARK: - TextDocumentProxyProtocol

    override val documentContextBeforeInput: String?
        get() {
            // Request text before cursor (up to 1000 characters)
            val textBefore = inputConnection.getTextBeforeCursor(1000, 0)
            return textBefore?.toString()
        }

    override val documentContextAfterInput: String?
        get() {
            // Request text after cursor (up to 1000 characters)
            val textAfter = inputConnection.getTextAfterCursor(1000, 0)
            return textAfter?.toString()
        }

    override fun insertText(text: String) {
        inputConnection.commitText(text, 1)
    }

    override fun deleteBackward() {
        inputConnection.deleteSurroundingText(1, 0)
    }

    override fun adjustTextPosition(offset: Int) {
        // Move cursor by offset
        if (offset != 0) {
            inputConnection.setSelection(
                (documentContextBeforeInput?.length ?: 0) + offset,
                (documentContextBeforeInput?.length ?: 0) + offset
            )
        }
    }

    // MARK: - Field Type Hints

    override val keyboardType: Int?
        get() = editorInfo.inputType

    override val returnKeyType: Int?
        get() = editorInfo.imeOptions

    override val textContentType: String?
        get() {
            // Android uses autofillHints instead of textContentType
            return editorInfo.hintText?.toString()
        }
}
