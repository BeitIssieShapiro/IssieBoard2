import UIKit

/**
 * TextDocumentProxyProtocol - Abstraction over UITextDocumentProxy
 *
 * This protocol allows KeyboardEngine to work with different text input sources:
 * - Real keyboard extensions use UITextDocumentProxy (iOS system)
 * - Preview uses CustomTextDocumentProxy (React Native bridge)
 *
 * Mirrors the essential parts of UITextDocumentProxy interface.
 */
protocol TextDocumentProxyProtocol: AnyObject {
    /// Text before the cursor/insertion point
    var documentContextBeforeInput: String? { get }

    /// Text after the cursor/insertion point
    var documentContextAfterInput: String? { get }

    /// Whether there is text in the document or a text selection
    var hasText: Bool { get }

    /// Insert text at cursor position
    func insertText(_ text: String)

    /// Delete one user-visible character backward (a whole grapheme cluster,
    /// e.g. a Hebrew letter together with its nikkud)
    func deleteBackward()

    /// Delete one Unicode scalar backward — used to strip a single combining mark
    /// (e.g. replacing one nikkud vowel with another) without removing its base letter.
    func deleteScalarBackward()

    /// Adjust cursor position by character offset
    func adjustTextPosition(byCharacterOffset offset: Int)

    /// Keyboard type hint (for field type detection)
    var keyboardType: UIKeyboardType? { get }

    /// Return key type (Go, Search, Done, etc.)
    var returnKeyType: UIReturnKeyType? { get }

    /// Text content type (email, URL, etc.)
    @available(iOS 10.0, *)
    var textContentType: UITextContentType? { get }
}

extension TextDocumentProxyProtocol {
    /// Default: UIKit's deleteBackward already removes a single scalar when the
    /// preceding character is a combining mark, so the system proxy needs no override.
    /// Only CustomTextDocumentProxy, which edits a Swift String, must distinguish them.
    func deleteScalarBackward() {
        deleteBackward()
    }
}
