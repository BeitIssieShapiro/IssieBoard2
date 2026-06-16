import UIKit

/**
 * KeyboardEngine - Core Keyboard Logic
 *
 * Extracted shared logic from BaseKeyboardViewController that can be used by:
 * - BaseKeyboardViewController (real keyboard extension with UITextDocumentProxy)
 * - KeyboardPreviewView (preview with CustomTextDocumentProxy for React Native)
 *
 * This class handles:
 * - Key press logic and routing
 * - Suggestion management
 * - Auto-correction and auto-capitalization
 * - Text manipulation (backspace, delete word, etc.)
 *
 * It's completely decoupled from UIInputViewController, using TextDocumentProxyProtocol
 * for text operations, making it reusable across different contexts.
 */
class KeyboardEngine {

    // MARK: - Properties

    /// Text document proxy for text operations (either iOS system or custom)
    private let textProxy: TextDocumentProxyProtocol

    /// Keyboard renderer - handles all UI rendering
    let renderer: KeyboardRenderer

    /// Word suggestion controller - handles completions and predictions
    let suggestionController: WordSuggestionController

    /// Keyboard language (e.g., "en", "he", "ar")
    var language: String

    /// Double-space shortcut (". " instead of "  ")
    private var lastSpaceTime: Date?
    private let doubleSpaceThreshold: TimeInterval = 2.0

    /// Track if backspace is currently being pressed (to avoid re-render during touch)
    var isBackspaceActive: Bool = false

    // MARK: - Callbacks

    /// Called when globe button touch events should be forwarded to handleInputModeList
    var onHandleInputModeList: ((UIView, UIEvent) -> Void)?

    /// Called when dismiss keyboard button is pressed
    var onDismissKeyboard: (() -> Void)?

    /// Called when settings button is pressed
    var onOpenSettings: (() -> Void)?

    /// Called when language switch button is pressed
    var onLanguageSwitch: (() -> Void)?

    /// Called when keyset changes (for state persistence)
    var onKeysetChanged: ((String) -> Void)?

    /// Called to get text direction at cursor (for RTL detection)
    var onGetTextDirection: (() -> Bool)?

    /// Called to get current text for auto-shift detection
    var getCurrentText: (() -> String)?

    /// Called to trigger keyboard re-render after shift state changes
    var onRenderKeyboard: (() -> Void)?

    // MARK: - Initialization

    init(textProxy: TextDocumentProxyProtocol, language: String) {
        self.textProxy = textProxy
        self.language = language

        // Initialize renderer
        self.renderer = KeyboardRenderer()

        // Initialize suggestion controller
        self.suggestionController = WordSuggestionController(renderer: renderer)
        self.suggestionController.setLanguage(language)

        setupCallbacks()
    }

    // MARK: - Setup

    private func setupCallbacks() {
        renderer.onKeysetChanged = { [weak self] keysetId in
            self?.onKeysetChanged?(keysetId)
        }

        renderer.onKeyPress = { [weak self] key in
            self?.handleKeyPress(key)
        }

        renderer.onDeleteCharacter = { [weak self] in
            self?.handleBackspace()
        }

        renderer.onDeleteWord = { [weak self] in
            self?.handleDeleteWord()
        }

        renderer.onNikkudSelected = { [weak self] value in
            self?.insertNikkudMark(value)
            _ = self?.suggestionController.handleSpace()
        }

        renderer.onSuggestionSelected = { [weak self] suggestion in
            self?.handleSuggestionSelected(suggestion)
        }

        renderer.onHandleInputModeList = { [weak self] button, event in
            self?.onHandleInputModeList?(button, event)
        }

        renderer.onDismissKeyboard = { [weak self] in
            self?.onDismissKeyboard?()
        }

        renderer.onOpenSettings = { [weak self] in
            self?.onOpenSettings?()
        }

        renderer.onLanguageSwitch = { [weak self] in
            self?.onLanguageSwitch?()
        }

        renderer.onBackspaceTouchBegan = { [weak self] in
            self?.isBackspaceActive = true
        }

        renderer.onBackspaceTouchEnded = { [weak self] in
            self?.isBackspaceActive = false
            self?.autoShiftAfterPunctuation()
        }

        renderer.onCursorMove = { [weak self] offset in
            self?.handleCursorMove(offset)
        }

        renderer.onGetTextDirection = { [weak self] in
            return self?.onGetTextDirection?() ?? false
        }

        renderer.onGetCharBeforeCursor = { [weak self] in
            guard let before = self?.textProxy.documentContextBeforeInput, !before.isEmpty else { return nil }
            let lastCluster = String(before.suffix(1))
            return lastCluster.unicodeScalars.first(where: {
                $0.properties.generalCategory == .otherLetter ||
                $0.properties.generalCategory == .uppercaseLetter ||
                $0.properties.generalCategory == .lowercaseLetter
            }).map { String($0) } ?? String(lastCluster.unicodeScalars.first.map { String($0) } ?? "")
        }
    }

    // MARK: - Public Methods

    /// Handle text change and update suggestions appropriately
    /// This is the SINGLE method that decides what suggestions to show based on text state
    func handleTextChanged() {
        guard let fullText = getCurrentText?() else {
            suggestionController.resetCurrentWord()
            suggestionController.showDefaults()
            return
        }

        print("🔮 KeyboardEngine.handleTextChanged - text: '\(fullText.suffix(30))'")

        let lastChar = fullText.last

        // Check if text ends with sentence-ending punctuation (with or without space after)
        let endsWithSentenceEnd = lastChar == "." || lastChar == "?" || lastChar == "!"
        let endsWithSpace = lastChar?.isWhitespace == true

        if endsWithSentenceEnd {
            // Sentence ended (e.g., "Get.") → defaults
            print("🔮 Sentence ended → defaults")
            suggestionController.resetCurrentWord()
            suggestionController.showDefaults()
        } else if endsWithSpace || fullText.hasSuffix("\n") {
            // Text ends with space - check what came before
            let trimmed = fullText.trimmingCharacters(in: .whitespacesAndNewlines)
            let beforeSpaceChar = trimmed.last
            let isNewSentence = beforeSpaceChar == "." || beforeSpaceChar == "?" || beforeSpaceChar == "!" || trimmed.isEmpty

            if isNewSentence {
                // New sentence (e.g., "Get. ") → defaults
                print("🔮 New sentence → defaults")
                suggestionController.resetCurrentWord()
                suggestionController.showDefaults()
            } else {
                // Word done (e.g., "hello ") → predictions
                let words = trimmed.components(separatedBy: .whitespacesAndNewlines)
                if let lastWord = words.last, !lastWord.isEmpty {
                    let cleanWord = lastWord.trimmingCharacters(in: CharacterSet.punctuationCharacters)

                    if !cleanWord.isEmpty {
                        print("🔮 Word done '\(cleanWord)' → predictions")
                        suggestionController.setCurrentWordSilently(cleanWord)
                        _ = suggestionController.handleSpace()
                    } else {
                        suggestionController.resetCurrentWord()
                        suggestionController.showDefaults()
                    }
                } else {
                    suggestionController.resetCurrentWord()
                    suggestionController.showDefaults()
                }
            }
        } else {
            // Typing word (e.g., "Get") → completions
            print("🔮 Typing word → completions")
            suggestionController.detectCurrentWord(from: fullText)
        }
    }

    /// Update suggestions based on current text context (legacy method)
    func updateSuggestions() {
        handleTextChanged()
    }

    // MARK: - Key Press Handling

    private func handleKeyPress(_ key: ParsedKey) {
        switch key.type.lowercased() {
        case "backspace":
            handleBackspace()

        case "enter", "action":
            textProxy.insertText("\n")
            suggestionController.handleEnter()

        case "space":
            handleSpaceKey()

        case "keyset":
            break

        case "language":
            onLanguageSwitch?()

        case "event":
            // Event-only key - just emit the key press, don't modify text
            // Used for custom actions like clear-all, save, load, etc.
            // The container (React Native) will handle the action
            break

        case "next-keyboard":
            // In actual keyboard, handleInputModeList handles this via .allTouchEvents
            // This case is only reached in preview mode, which the renderer handles directly
            break

        default:
            // Determine which value to use based on shift state
            let valueToInsert: String
            if renderer.isShiftActive() && !key.sValue.isEmpty {
                valueToInsert = key.sValue
            } else {
                valueToInsert = key.value
            }

            if !valueToInsert.isEmpty {
                if valueToInsert == " " {
                    handleSpaceKey()
                } else {
                    textProxy.insertText(valueToInsert)

                    // Check if we just typed sentence-ending punctuation
                    if valueToInsert == "." || valueToInsert == "?" || valueToInsert == "!" {
                        // Sentence ended → reset and show defaults
                        print("🔮 Sentence-ending punctuation typed → defaults")
                        suggestionController.resetCurrentWord()
                        suggestionController.showDefaults()
                    } else {
                        // Normal character → show completions
                        suggestionController.handleCharacterTyped(valueToInsert)
                    }
                }
            }
        }
    }

    private func handleBackspace() {
        // Check if there's any text or selection to delete
        // hasText returns true if there's text in the document OR a text selection
        if !textProxy.hasText {
            return
        }

        textProxy.deleteBackward()
        if !suggestionController.handleBackspace() {
            suggestionController.detectCurrentWord(from: textProxy.documentContextBeforeInput ?? "")
        }

        autoShiftAfterPunctuation()
    }

    private func handleDeleteWord() {
        guard let beforeText = textProxy.documentContextBeforeInput, !beforeText.isEmpty else {
            textProxy.deleteBackward()
            return
        }

        var charsToDelete = 0
        var foundNonSpace = false

        for char in beforeText.reversed() {
            if char.isWhitespace {
                if foundNonSpace { break }
                charsToDelete += 1
            } else {
                foundNonSpace = true
                charsToDelete += 1
            }
        }

        if charsToDelete > 0 {
            for _ in 0..<charsToDelete {
                textProxy.deleteBackward()
            }
        } else {
            textProxy.deleteBackward()
        }

        suggestionController.detectCurrentWord(from: textProxy.documentContextBeforeInput ?? "")
    }

    /// Handle suggestion tapped/selected (public for system shortcuts bar)
    func handleSuggestionTapped(_ suggestion: String) {
        handleSuggestionSelected(suggestion)
    }

    private func handleSuggestionSelected(_ suggestion: String) {
        let replacedWord = suggestionController.currentWord

        // Delete the current word if any (when in typing mode)
        for _ in 0..<replacedWord.count {
            textProxy.deleteBackward()
        }

        // Insert suggestion with space
        textProxy.insertText(suggestion + " ")

        // Show predictions for next word (we just completed a word)
        suggestionController.setCurrentWordSilently(suggestion)
        _ = suggestionController.handleSpace()

        // Apply auto-shift after suggestion
        autoShiftAfterPunctuation()
    }

    /// Insert a nikkud combining mark, handling conflicts:
    /// - Vowels (U+05B0–U+05BB, U+05C7) are mutually exclusive — replace existing vowel
    /// - Dagesh (U+05BC) toggles: if already present remove it, otherwise add it
    /// - Shin/sin dots (U+05C1/U+05C2) replace each other
    private func insertNikkudMark(_ mark: String) {
        let hebrewVowels: Set<UInt32> = [
            0x05B0, 0x05B1, 0x05B2, 0x05B3, 0x05B4,
            0x05B5, 0x05B6, 0x05B7, 0x05B8, 0x05B9,
            0x05BA, 0x05BB, 0x05C7
        ]
        let dagesh:  UInt32 = 0x05BC
        let shinDot: UInt32 = 0x05C1
        let sinDot:  UInt32 = 0x05C2

        guard let incomingScalar = mark.unicodeScalars.first else {
            textProxy.insertText(mark)
            return
        }
        let inVal = incomingScalar.value

        // Determine which conflict group this mark belongs to
        let isVowel    = hebrewVowels.contains(inVal)
        let isDagesh   = inVal == dagesh
        let isShinSin  = inVal == shinDot || inVal == sinDot

        guard isVowel || isDagesh || isShinSin else {
            textProxy.insertText(mark)
            return
        }

        guard let before = textProxy.documentContextBeforeInput, !before.isEmpty else {
            textProxy.insertText(mark)
            return
        }

        let lastCluster = String(before.suffix(1))
        let scalars = lastCluster.unicodeScalars.map { $0.value }

        // Find an existing mark in the same conflict group
        let conflictIndex: Int?
        if isVowel {
            conflictIndex = scalars.indices.last(where: { hebrewVowels.contains(scalars[$0]) })
        } else if isDagesh {
            conflictIndex = scalars.indices.last(where: { scalars[$0] == dagesh })
        } else { // shinSin
            conflictIndex = scalars.indices.last(where: { scalars[$0] == shinDot || scalars[$0] == sinDot })
        }

        guard let existingIndex = conflictIndex else {
            textProxy.insertText(mark)
            return
        }

        let scalarsAfter = scalars.count - 1 - existingIndex

        // Delete everything from the existing mark to end of cluster
        for _ in 0..<scalarsAfter { textProxy.deleteBackward() }
        textProxy.deleteBackward() // delete the existing mark

        // Re-insert tail (marks after the conflicting one)
        if scalarsAfter > 0 {
            let tail = String(String.UnicodeScalarView(scalars.suffix(scalarsAfter).compactMap { Unicode.Scalar($0) }))
            textProxy.insertText(tail)
        }

        // For dagesh: if same mark was already there, we removed it — don't re-insert (toggle off)
        let existingVal = scalars[existingIndex]
        let isSameMark = existingVal == inVal
        if isDagesh && isSameMark {
            return // toggled off
        }

        textProxy.insertText(mark)
    }

    private func handleSpaceKey() {
        let now = Date()

        defer { autoReturnFromSpecialChars() }

        // Check for auto-capitalize "i" to "I"
        if let beforeText = textProxy.documentContextBeforeInput,
           beforeText.hasSuffix("i") {
            let textBeforeI = String(beforeText.dropLast())
            if textBeforeI.isEmpty || textBeforeI.last?.isWhitespace == true {
                textProxy.deleteBackward()
                textProxy.insertText("I ")
                lastSpaceTime = now
                handleSuggestionsAfterSpace()
                autoShiftAfterPunctuation()
                return
            }
        }

        // Check for fuzzy auto-replace
        if let replacement = suggestionController.getFuzzyAutoReplacement() {
            let currentWord = suggestionController.currentWord

            for _ in 0..<currentWord.count {
                textProxy.deleteBackward()
            }

            textProxy.insertText(replacement + " ")
            lastSpaceTime = now
            handleSuggestionsAfterSpace()
            return
        }

        // Double-space shortcut for period
        if let lastTime = lastSpaceTime,
           now.timeIntervalSince(lastTime) < doubleSpaceThreshold {
            if let beforeText = textProxy.documentContextBeforeInput,
               beforeText.hasSuffix(" ") {
                let textBeforeSpace = String(beforeText.dropLast())
                let charBeforeSpace = textBeforeSpace.last

                if charBeforeSpace != " " && charBeforeSpace != "." {
                    textProxy.deleteBackward()
                    textProxy.insertText(". ")
                    lastSpaceTime = nil
                    // After ". " show defaults (new sentence)
                    suggestionController.showDefaults()
                    autoShiftAfterPunctuation()
                    return
                }
            }
        }

        // Normal space
        textProxy.insertText(" ")
        lastSpaceTime = now
        handleSuggestionsAfterSpace()
        autoShiftAfterPunctuation()
    }

    /// Determine what suggestions to show after space is inserted
    private func handleSuggestionsAfterSpace() {
        guard let fullText = getCurrentText?() else {
            suggestionController.showDefaults()
            return
        }

        print("🔮 handleSuggestionsAfterSpace - fullText: '\(fullText.suffix(30))'")

        // Text now ends with space, check what came before
        let trimmed = fullText.trimmingCharacters(in: .whitespacesAndNewlines)

        // Check for sentence-ending punctuation
        let lastChar = trimmed.last
        let isNewSentence = lastChar == "." || lastChar == "?" || lastChar == "!" || trimmed.isEmpty

        if isNewSentence {
            // New sentence → reset and show defaults
            print("🔮 New sentence (ends with '\(String(describing: lastChar))') → defaults")
            suggestionController.resetCurrentWord()
            suggestionController.showDefaults()
        } else {
            // Word is done → show predictions
            // Extract the last word (strip any trailing punctuation like commas)
            let words = trimmed.components(separatedBy: .whitespacesAndNewlines)
            if let lastWord = words.last, !lastWord.isEmpty {
                // Strip non-sentence-ending punctuation (comma, semicolon, etc.)
                let cleanWord = lastWord.trimmingCharacters(in: CharacterSet.punctuationCharacters)

                if !cleanWord.isEmpty {
                    print("🔮 Word done: '\(cleanWord)' → predictions")
                    suggestionController.setCurrentWordSilently(cleanWord)
                    _ = suggestionController.handleSpace()
                } else {
                    suggestionController.showDefaults()
                }
            } else {
                suggestionController.showDefaults()
            }
        }
    }

    private func handleCursorMove(_ offset: Int) {
        textProxy.adjustTextPosition(byCharacterOffset: offset)
        debugLog("🔄 Cursor moved by \(offset) characters")
    }

    // MARK: - Auto Behaviors

    /// Check and apply auto-shift after text changes
    func autoShiftAfterPunctuation() {
        // Only apply to English keyboard
        guard language == "en" else { return }

        guard let beforeText = getCurrentText?() else { return }

        print("🔍 KeyboardEngine.autoShiftAfterPunctuation - text: '\(beforeText.suffix(20))', isEmpty: \(beforeText.isEmpty)")

        // Check if text is empty
        if beforeText.isEmpty {
            print("  ⇧ Empty text - activating shift")
            renderer.activateShift()
            onRenderKeyboard?()
            return
        }

        // Check if ends with sentence-ending punctuation followed by space(s)
        let trimmed = beforeText.trimmingCharacters(in: .whitespaces)
        let endsWithSpace = beforeText.last?.isWhitespace == true
        let endsWithPunctuation = trimmed.last == "." || trimmed.last == "?" || trimmed.last == "!"
        let endsWithNewline = beforeText.hasSuffix("\n")

        let shouldActivateShift = (endsWithPunctuation && endsWithSpace) || endsWithNewline

        print("  endsWithSpace: \(endsWithSpace), endsWithPunctuation: \(endsWithPunctuation), shouldActivate: \(shouldActivateShift)")

        if shouldActivateShift && !renderer.isShiftActive() {
            print("  ⇧ Activating shift after punctuation")
            renderer.activateShift()
            onRenderKeyboard?()
        } else if !shouldActivateShift && renderer.isShiftActive() {
            print("  ⇩ Deactivating shift")
            renderer.deactivateShift()
            onRenderKeyboard?()
        }
    }

    /// Auto-return from special characters keyboard (123/#+=) to main keyboard (abc) after space
    func autoReturnFromSpecialChars() {
        let currentKeyset = renderer.currentKeysetId

        // Check if we're on a special characters keyset
        if currentKeyset == "123" || currentKeyset == "#+=" {
            debugLog("🔄 Auto-returning from \(currentKeyset) to abc")
            renderer.currentKeysetId = "abc"
            onRenderKeyboard?()
        }
    }
}
