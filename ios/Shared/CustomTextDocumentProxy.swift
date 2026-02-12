import UIKit

/**
 * CustomTextDocumentProxy - React Native Text Bridge
 *
 * Bridges KeyboardEngine to React Native text state.
 * Implements TextDocumentProxyProtocol to provide text context and operations.
 *
 * IMPORTANT: React Native is the SINGLE SOURCE OF TRUTH for text.
 * This proxy does NOT store text internally. It queries React Native for current text
 * and notifies React Native of changes. This prevents desynchronization.
 */
class CustomTextDocumentProxy: TextDocumentProxyProtocol {

    // MARK: - Properties

    /// Callback to get current text from React Native
    var getCurrentText: (() -> String)?

    /// Callback to notify React Native to insert text
    var onInsertText: ((String) -> Void)?

    /// Callback to notify React Native to delete backward
    var onDeleteBackward: (() -> Void)?

    /// Cursor position (index in string) - always at end for now
    private var cursorPosition: Int {
        return getCurrentText?().count ?? 0
    }

    // MARK: - Initialization

    init() {
        // No internal state - pure bridge
    }

    // MARK: - TextDocumentProxyProtocol

    var documentContextBeforeInput: String? {
        guard let text = getCurrentText?() else { return nil }
        // For now, cursor is always at end, so return full text
        return text.isEmpty ? nil : text
    }

    var documentContextAfterInput: String? {
        // Cursor always at end, so nothing after
        return nil
    }

    func insertText(_ textToInsert: String) {
        print("📝 CustomTextDocumentProxy.insertText: '\(textToInsert)'")
        onInsertText?(textToInsert)
    }

    func deleteBackward() {
        print("📝 CustomTextDocumentProxy.deleteBackward")
        onDeleteBackward?()
    }

    func adjustTextPosition(byCharacterOffset offset: Int) {
        // Not implemented for simple use case (cursor always at end)
        print("📝 CustomTextDocumentProxy.adjustTextPosition: \(offset) (not implemented)")
    }

    // MARK: - Field Type Hints (not applicable for preview, return defaults)

    var keyboardType: UIKeyboardType? {
        return .default
    }

    var returnKeyType: UIReturnKeyType? {
        return .default
    }

    @available(iOS 10.0, *)
    var textContentType: UITextContentType? {
        return nil
    }
}
