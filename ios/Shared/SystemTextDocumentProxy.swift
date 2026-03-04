import UIKit

/**
 * SystemTextDocumentProxy - iOS System Text Bridge
 *
 * Wraps iOS UITextDocumentProxy to conform to TextDocumentProxyProtocol.
 * This allows KeyboardEngine to work with the real iOS keyboard extension text proxy.
 */
class SystemTextDocumentProxy: TextDocumentProxyProtocol {

    // MARK: - Properties

    /// The underlying iOS system text document proxy
    private let proxy: UITextDocumentProxy

    // MARK: - Initialization

    init(proxy: UITextDocumentProxy) {
        self.proxy = proxy
    }

    // MARK: - TextDocumentProxyProtocol

    var documentContextBeforeInput: String? {
        return proxy.documentContextBeforeInput
    }

    var documentContextAfterInput: String? {
        return proxy.documentContextAfterInput
    }

    var hasText: Bool {
        return proxy.hasText
    }

    func insertText(_ text: String) {
        proxy.insertText(text)
    }

    func deleteBackward() {
        proxy.deleteBackward()
    }

    func adjustTextPosition(byCharacterOffset offset: Int) {
        proxy.adjustTextPosition(byCharacterOffset: offset)
    }

    // MARK: - Field Type Hints

    var keyboardType: UIKeyboardType? {
        return proxy.keyboardType
    }

    var returnKeyType: UIReturnKeyType? {
        return proxy.returnKeyType
    }

    @available(iOS 10.0, *)
    var textContentType: UITextContentType? {
        return proxy.textContentType
    }
}
