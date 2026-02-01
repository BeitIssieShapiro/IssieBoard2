import UIKit
import React

/**
 * iOS keyboard preview component for React Native
 * Thin wrapper around KeyboardRenderer - renderer handles all UI logic
 * In testing mode, also tracks typed text and shows word suggestions
 */
@objc(KeyboardPreviewView)
class KeyboardPreviewView: UIView {
    
    // MARK: - Properties
    
    private let renderer: KeyboardRenderer
    private var parsedConfig: KeyboardConfig?
    
    // Event callback for React Native
    @objc var onKeyPress: RCTBubblingEventBlock?
    
    // Event callback for suggestion selection
    @objc var onSuggestionSelect: RCTBubblingEventBlock?
    
    // Selected keys for edit mode visualization
    private var selectedKeyIds: Set<String> = []
    
    // Layout tracking to prevent infinite loops
    private var lastRenderedWidth: CGFloat = 0
    
    // Testing mode: track typed text for suggestions
    private var typedText: String = ""
    private var currentWord: String = ""
    private var currentLanguage: String = "en"
    
    // MARK: - Initialization
    
    override init(frame: CGRect) {
        // Create renderer - it manages all keyboard logic
        self.renderer = KeyboardRenderer()
        
        super.init(frame: frame)
        
        backgroundColor = UIColor(red: 0.82, green: 0.82, blue: 0.82, alpha: 1.0)
        
        // In preview mode, hide the globe (language) button - it's redundant
        renderer.setShowGlobeButton(false)
        
        // Set up renderer callbacks - only for FINAL key output
        renderer.onKeyPress = { [weak self] key in
            self?.handleKeyPress(key)
        }
        
        // Set up backspace long-press callbacks
        renderer.onDeleteCharacter = { [weak self] in
            self?.handleBackspace()
        }
        
        renderer.onDeleteWord = { [weak self] in
            self?.handleDeleteWord()
        }
        
        // Set up suggestion selection callback
        renderer.onSuggestionSelected = { [weak self] suggestion in
            self?.handleSuggestionSelected(suggestion)
        }
        
        // Initialize word completion manager
        WordCompletionManager.shared.setLanguage(currentLanguage)
        
        print("📱 KeyboardPreviewView initialized with frame: \(frame)")
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - React Native Props
    
    @objc func setConfigJson(_ configJson: String?) {
        print("📱 setConfigJson called with \(configJson?.count ?? 0) chars")
        
        guard let configJson = configJson, !configJson.isEmpty else {
            print("⚠️ No config provided")
            return
        }
        
        // Log if diacriticsSettings is present
        if configJson.contains("diacriticsSettings") {
            print("   ✅ Config contains diacriticsSettings")
        } else {
            print("   ⚠️ Config does NOT contain diacriticsSettings")
        }
        
        parseAndRender(configJson)
    }
    
    /// Set selected key IDs for visual highlighting in edit mode
    /// Format: JSON array of strings like ["abc:0:3", "abc:1:2"]
    @objc func setSelectedKeys(_ selectedKeysJson: String?) {
        guard let jsonString = selectedKeysJson,
              let jsonData = jsonString.data(using: .utf8),
              let keys = try? JSONDecoder().decode([String].self, from: jsonData) else {
            selectedKeyIds = []
            renderer.setSelectedKeys([])
            renderKeyboard()
            return
        }
        
        print("📱 setSelectedKeys: \(keys.count) keys selected")
        selectedKeyIds = Set(keys)
        renderer.setSelectedKeys(selectedKeyIds)
        renderKeyboard()
    }
    
    // MARK: - Config Parsing & Rendering
    
    private func parseAndRender(_ jsonString: String) {
        guard let jsonData = jsonString.data(using: .utf8) else {
            print("❌ Failed to convert config to data")
            return
        }
        
        do {
            let decoder = JSONDecoder()
            parsedConfig = try decoder.decode(KeyboardConfig.self, from: jsonData)
            
            print("✅ Config parsed: keysets=\(parsedConfig?.keysets.map { $0.id }.joined(separator: ", ") ?? "none")")
            
            // Update language from config's first keyboard
            if let keyboards = parsedConfig?.keyboards, let firstKeyboard = keyboards.first {
                currentLanguage = firstKeyboard
                WordCompletionManager.shared.setLanguage(currentLanguage)
                print("📱 Preview language set to: \(currentLanguage)")
            }
            
            // Check if nikkud picker is showing
            let hasNikkudPicker = subviews.contains(where: { $0.tag == 999 })
            
            if hasNikkudPicker {
                // Don't dismiss - instead, tell renderer to refresh the picker with new options
                print("📱 Nikkud picker is open, refreshing with updated settings")
                renderer.refreshNikkudPickerIfOpen(in: self, config: parsedConfig!)
            } else {
                // No picker open, just re-render keyboard normally
                renderKeyboard()
            }
        } catch {
            print("❌ Failed to parse config: \(error)")
        }
    }
    
    private func renderKeyboard() {
        guard let config = parsedConfig else {
            print("❌ No config to render")
            return
        }
        
        let currentWidth = bounds.width
        print("🎨 Preview: Rendering keyboard, width = \(currentWidth), lastRenderedWidth = \(lastRenderedWidth)")
        print("🎨 Preview: wordSuggestionsEnabled = \(config.isWordSuggestionsEnabled)")
        
        // Update last rendered width
        lastRenderedWidth = currentWidth
        
        // Renderer handles everything - just pass config and container
        // Don't pass currentKeysetId - renderer maintains its own internal state
        renderer.renderKeyboard(
            in: self,
            config: config,
            currentKeysetId: renderer.currentKeysetId.isEmpty ? (config.defaultKeyset ?? "abc") : renderer.currentKeysetId,
            editorContext: nil  // No editor context in preview
        )
        
        // Show initial suggestions if word completion is enabled and no text typed yet
        if config.isWordSuggestionsEnabled && currentWord.isEmpty {
            // Use a slight delay to ensure renderer has finished setting up the suggestions bar
            DispatchQueue.main.async { [weak self] in
                self?.showDefaultSuggestions()
            }
        } else if config.isWordSuggestionsEnabled && !currentWord.isEmpty {
            // If there's text already, show suggestions for it
            DispatchQueue.main.async { [weak self] in
                self?.updateWordSuggestions()
            }
        }
    }
    
    // MARK: - Key Press Handling
    
    /// Handle key press in preview - track text for suggestions and emit to React Native
    private func handleKeyPress(_ key: ParsedKey) {
        print("🔘 Preview handleKeyPress: type=\(key.type), value=\(key.value)")
        
        switch key.type.lowercased() {
        case "backspace":
            handleBackspace()
            
        case "enter", "action":
            // Clear current word on enter
            typedText += "\n"
            currentWord = ""
            showDefaultSuggestions()
            
        case "space":
            typedText += " "
            currentWord = ""
            showDefaultSuggestions()
            
        default:
            // Regular character key
            let value = key.value
            if !value.isEmpty {
                if value == " " {
                    typedText += " "
                    currentWord = ""
                    showDefaultSuggestions()
                } else {
                    typedText += value
                    currentWord += value
                    updateWordSuggestions()
                }
            }
        }
        
        // Emit event to React Native
        emitKeyPress(key)
    }
    
    /// Handle backspace - delete from typed text and update suggestions
    private func handleBackspace() {
        print("⌫ Preview handleBackspace: currentWord='\(currentWord)', typedText='\(typedText)'")
        
        // Delete from typedText
        if !typedText.isEmpty {
            typedText.removeLast()
        }
        
        // Update current word
        if !currentWord.isEmpty {
            currentWord.removeLast()
            updateWordSuggestions()
        } else {
            // Detect current word from typedText
            detectCurrentWord()
        }
        
        // Emit backspace event to React Native directly
        if let onKeyPress = onKeyPress {
            onKeyPress([
                "type": "backspace",
                "value": "",
                "label": "⌫",
                "hasNikkud": false
            ])
        }
    }
    
    /// Handle delete word (long-press backspace)
    private func handleDeleteWord() {
        print("⌫ Preview handleDeleteWord: currentWord='\(currentWord)', typedText='\(typedText)'")
        
        // Delete entire current word from typedText
        if !currentWord.isEmpty {
            // Remove current word
            for _ in 0..<currentWord.count {
                if !typedText.isEmpty {
                    typedText.removeLast()
                }
            }
            currentWord = ""
        } else if !typedText.isEmpty {
            // Delete backwards to previous word boundary
            while !typedText.isEmpty {
                let lastChar = typedText.removeLast()
                if lastChar == " " || lastChar == "\n" {
                    break
                }
            }
        }
        
        detectCurrentWord()
        
        // Emit backspace event to React Native directly
        if let onKeyPress = onKeyPress {
            onKeyPress([
                "type": "backspace",
                "value": "",
                "label": "⌫",
                "hasNikkud": false
            ])
        }
    }
    
    /// Handle suggestion selection - replace current word with suggestion
    private func handleSuggestionSelected(_ suggestion: String) {
        print("📝 Preview suggestion selected: '\(suggestion)', currentWord='\(currentWord)'")
        
        // Remove current word from typedText
        for _ in 0..<currentWord.count {
            if !typedText.isEmpty {
                typedText.removeLast()
            }
        }
        
        // Add the suggestion + space
        typedText += suggestion + " "
        currentWord = ""
        
        // Show default suggestions for next word
        showDefaultSuggestions()
        
        // Emit suggestion selection to React Native
        if let onSuggestionSelect = onSuggestionSelect {
            onSuggestionSelect([
                "suggestion": suggestion,
                "replacedWord": currentWord
            ])
        }
        
        // Also emit as a special key press so React can update the text field
        if let onKeyPress = onKeyPress {
            onKeyPress([
                "type": "suggestion",
                "value": suggestion + " "
            ])
        }
    }
    
    // MARK: - Word Suggestions
    
    /// Update word suggestions based on current word
    private func updateWordSuggestions() {
        guard parsedConfig?.isWordSuggestionsEnabled == true else {
            return
        }
        
        guard !currentWord.isEmpty else {
            showDefaultSuggestions()
            return
        }
        
        print("📝 Preview updateWordSuggestions: '\(currentWord)'")
        let result = WordCompletionManager.shared.getSuggestionsStructured(for: currentWord, language: currentLanguage)
        
        // Build display suggestions based on fuzzy state
        var displaySuggestions: [String] = []
        
        if result.hasFuzzyOnly && !result.suggestions.isEmpty {
            // Only fuzzy matches - show quoted literal first, then best fuzzy highlighted
            let quotedLiteral = "\"\(currentWord)\""
            displaySuggestions.append(quotedLiteral)
            displaySuggestions.append(contentsOf: result.suggestions)
            print("📝 Preview fuzzy only mode: literal='\(quotedLiteral)', fuzzy=\(result.suggestions)")
        } else {
            // Has exact matches - show them normally
            displaySuggestions = result.suggestions
        }
        
        // Update renderer with suggestions and fuzzy state
        renderer.updateSuggestions(displaySuggestions, highlightIndex: result.hasFuzzyOnly ? 1 : nil)
    }
    
    /// Show default suggestions (when no text is being typed)
    private func showDefaultSuggestions() {
        guard parsedConfig?.isWordSuggestionsEnabled == true else {
            return
        }
        
        let suggestions = WordCompletionManager.shared.getSuggestions(for: "")
        print("📝 Preview showing default suggestions: \(suggestions)")
        renderer.updateSuggestions(suggestions)
    }
    
    /// Detect current word from typed text
    private func detectCurrentWord() {
        guard !typedText.isEmpty else {
            currentWord = ""
            showDefaultSuggestions()
            return
        }
        
        // Check if cursor is right after whitespace
        if let lastChar = typedText.last, lastChar == " " || lastChar == "\n" || lastChar == "\t" {
            currentWord = ""
            showDefaultSuggestions()
            return
        }
        
        // Find word before cursor
        var wordStart = typedText.endIndex
        for i in typedText.indices.reversed() {
            let char = typedText[i]
            if char == " " || char == "\n" || char == "\t" {
                wordStart = typedText.index(after: i)
                break
            }
            if i == typedText.startIndex {
                wordStart = i
            }
        }
        
        currentWord = String(typedText[wordStart...])
        print("📝 Preview detected current word: '\(currentWord)'")
        updateWordSuggestions()
    }
    
    // MARK: - Key Press Output to React Native
    
    private func emitKeyPress(_ key: ParsedKey) {
        print("🔘 Preview key output: type=\(key.type), value=\(key.value)")
        
        // Emit event to React Native
        if let onKeyPress = onKeyPress {
            let event: [String: Any] = [
                "type": key.type,
                "value": key.value,
                "label": key.label,
                "hasNikkud": !key.nikkud.isEmpty
            ]
            onKeyPress(event)
        }
    }
    
    // MARK: - Layout
    
    override func layoutSubviews() {
        super.layoutSubviews()
        
        let currentWidth = bounds.width
        print("📐 PreviewView layoutSubviews: bounds = \(bounds), lastRenderedWidth = \(lastRenderedWidth)")
        
        // Don't re-render if nikkud picker is showing (tag 999)
        let hasNikkudPicker = subviews.contains(where: { $0.tag == 999 })
        if hasNikkudPicker {
            print("📱 layoutSubviews: Skipping re-render (nikkud picker is showing)")
            return
        }
        
        // Only re-render if width has actually changed (prevents infinite loop)
        if parsedConfig != nil && abs(currentWidth - lastRenderedWidth) > 1 {
            print("📐 PreviewView width changed from \(lastRenderedWidth) to \(currentWidth), re-rendering")
            renderKeyboard()
        }
    }
    
    override var bounds: CGRect {
        didSet {
            if oldValue != bounds {
                print("📐 PreviewView bounds changed: old = \(oldValue), new = \(bounds)")
            }
        }
    }
    
    override var frame: CGRect {
        didSet {
            if oldValue != frame {
                print("📐 PreviewView frame changed: old = \(oldValue), new = \(frame)")
            }
        }
    }
}
