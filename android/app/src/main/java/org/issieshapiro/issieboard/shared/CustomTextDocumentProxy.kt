package org.issieshapiro.issieboard.shared

import android.util.Log
import android.view.inputmethod.EditorInfo

/**
 * Port of ios/Shared/CustomTextDocumentProxy.swift
 *
 * CustomTextDocumentProxy - React Native Text Bridge
 *
 * Bridges KeyboardEngine to React Native text state.
 * Implements TextDocumentProxyProtocol to provide text context and operations.
 *
 * IMPORTANT: React Native is the SINGLE SOURCE OF TRUTH for text.
 * This proxy does NOT store text internally. It queries React Native for current text
 * and notifies React Native of changes. This prevents desynchronization.
 */
class CustomTextDocumentProxy : TextDocumentProxyProtocol {

    // MARK: - Properties

    /** Callback to get current text from React Native */
    var getCurrentText: (() -> String)? = null

    /** Callback to notify React Native to insert text */
    var onInsertText: ((String) -> Unit)? = null

    /** Callback to notify React Native to delete backward */
    var onDeleteBackward: (() -> Unit)? = null

    /** Cursor position (index in string) - always at end for now */
    private val cursorPosition: Int
        get() = getCurrentText?.invoke()?.length ?: 0

    // MARK: - Initialization

    // No internal state - pure bridge

    // MARK: - TextDocumentProxyProtocol

    override val documentContextBeforeInput: String?
        get() {
            val text = getCurrentText?.invoke()
            // For now, cursor is always at end, so return full text
            return if (text.isNullOrEmpty()) null else text
        }

    override val documentContextAfterInput: String?
        get() {
            // Cursor always at end, so nothing after
            return null
        }

    override fun insertText(text: String) {
        Log.d(TAG, "insertText: '$text'")
        onInsertText?.invoke(text)
    }

    override fun deleteBackward() {
        Log.d(TAG, "deleteBackward")
        onDeleteBackward?.invoke()
    }

    override fun adjustTextPosition(offset: Int) {
        // Not implemented for simple use case (cursor always at end)
        Log.d(TAG, "adjustTextPosition: $offset (not implemented)")
    }

    // MARK: - Field Type Hints (not applicable for preview, return defaults)

    override val keyboardType: Int?
        get() = EditorInfo.TYPE_CLASS_TEXT

    override val returnKeyType: Int?
        get() = EditorInfo.IME_ACTION_DONE

    override val textContentType: String?
        get() = null

    companion object {
        private const val TAG = "CustomTextDocumentProxy"
    }
}
