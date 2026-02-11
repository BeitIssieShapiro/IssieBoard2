import UIKit
import React

/**
 * iOS keyboard preview component for React Native
 * Thin wrapper around KeyboardRenderer - renderer handles all UI logic
 * Uses WordSuggestionController for word suggestions (same as actual keyboard)
 */
@objc(KeyboardPreviewView)
class KeyboardPreviewView: UIView {
    
    // MARK: - Properties
    
    private let renderer: KeyboardRenderer
    private var parsedConfig: KeyboardConfig?
    
    // Word suggestion controller - shared logic with keyboard extension
    private var suggestionController: WordSuggestionController!
    
    // Event callback for React Native
    @objc var onKeyPress: RCTBubblingEventBlock?
    
    // Event callback for suggestion selection
    @objc var onSuggestionSelect: RCTBubblingEventBlock?
    
    // Selected keys for edit mode visualization
    private var selectedKeyIds: Set<String> = []
    
    // Layout tracking to prevent infinite loops
    private var lastRenderedWidth: CGFloat = 0
    
    // Track typed text (for preview testing)
    private var typedText: String = ""
    
    // MARK: - Initialization
    
    override init(frame: CGRect) {
        self.renderer = KeyboardRenderer()
        
        super.init(frame: frame)
        
        backgroundColor = UIColor(red: 0.82, green: 0.82, blue: 0.82, alpha: 1.0)
        
        // Setup suggestion controller
        suggestionController = WordSuggestionController(renderer: renderer)
        suggestionController.setLanguage("en")
        
        // In preview mode, hide the globe (language) button - it's redundant
        renderer.setShowGlobeButton(false)
        
        // Set preview mode to disable key bubble
        renderer.setPreviewMode(true)
        
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
        
        // Set up long-press selection callback for keyset/nikkud keys
        renderer.onKeyLongPress = { [weak self] key in
            self?.handleKeyLongPress(key)
        }
        
        // Set up suggestion selection callback
        renderer.onSuggestionSelected = { [weak self] suggestion in
            self?.handleSuggestionSelected(suggestion)
        }
        
        // Set up nikkud selection callback
        renderer.onNikkudSelected = { [weak self] value in
            self?.handleNikkudSelected(value)
        }
        
        debugLog("📱 KeyboardPreviewView initialized")
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - React Native Props
    
    @objc func setConfigJson(_ configJson: String?) {
        guard let configJson = configJson, !configJson.isEmpty else {
            return
        }
        
        parseAndRender(configJson)
    }
    
    @objc func setSelectedKeys(_ selectedKeysJson: String?) {
        guard let jsonString = selectedKeysJson,
              let jsonData = jsonString.data(using: .utf8),
              let keys = try? JSONDecoder().decode([String].self, from: jsonData) else {
            selectedKeyIds = []
            renderer.setSelectedKeys([])
            renderKeyboard()
            return
        }
        
        selectedKeyIds = Set(keys)
        renderer.setSelectedKeys(selectedKeyIds)
        renderKeyboard()
    }
    
    // MARK: - Config Parsing & Rendering
    
    private func parseAndRender(_ jsonString: String) {
        guard let jsonData = jsonString.data(using: .utf8) else {
            return
        }
        
        do {
            parsedConfig = try JSONDecoder().decode(KeyboardConfig.self, from: jsonData)
            
            // Update language from config's first keyboard
            if let keyboards = parsedConfig?.keyboards, let firstKeyboard = keyboards.first {
                suggestionController.setLanguage(firstKeyboard)
            }
            
            // Check if nikkud picker is showing
            let hasNikkudPicker = subviews.contains(where: { $0.tag == 999 })
            
            if hasNikkudPicker {
                // Refresh the picker with new options
                renderer.refreshNikkudPickerIfOpen(in: self, config: parsedConfig!)
            } else {
                renderKeyboard()
            }
        } catch {
            errorLog("Failed to parse config: \(error)")
        }
    }
    
    private func renderKeyboard() {
        guard let config = parsedConfig else { return }
        
        lastRenderedWidth = bounds.width
        
        // Configure suggestion controller based on config
        suggestionController.setEnabled(config.isWordSuggestionsEnabled)
        suggestionController.setAutoCorrectEnabled(config.isAutoCorrectEnabled)
        
        renderer.setWordSuggestionsEnabled(config.isWordSuggestionsEnabled)
        
        renderer.renderKeyboard(
            in: self,
            config: config,
            currentKeysetId: renderer.currentKeysetId.isEmpty ? (config.defaultKeyset ?? "abc") : renderer.currentKeysetId,
            editorContext: nil
        )
        
        // Show initial suggestions if enabled
        if config.isWordSuggestionsEnabled && suggestionController.currentWord.isEmpty {
            DispatchQueue.main.async { [weak self] in
                self?.suggestionController.showDefaults()
            }
        }
    }
    
    // MARK: - Key Press Handling
    
    private func handleKeyPress(_ key: ParsedKey) {
        switch key.type.lowercased() {
        case "backspace":
            handleBackspace()
            return  // Don't call emitKeyPress - handleBackspace already emits
            
        case "enter", "action":
            typedText += "\n"
            suggestionController.handleEnter()
            
        case "space":
            typedText += " "
            suggestionController.handleSpace()
            
        default:
            let value = key.value
            if !value.isEmpty {
                if value == " " {
                    typedText += " "
                    suggestionController.handleSpace()
                } else {
                    typedText += value
                    suggestionController.handleCharacterTyped(value)
                }
            }
        }
        
        // Emit event to React Native
        emitKeyPress(key)
    }
    
    private func handleBackspace() {
        if !typedText.isEmpty {
            typedText.removeLast()
        }
        
        if !suggestionController.handleBackspace() {
            detectCurrentWord()
        }
        
        // Emit backspace event
        onKeyPress?([
            "type": "backspace",
            "value": "",
            "label": "⌫",
            "hasNikkud": false
        ])
    }
    
    private func handleDeleteWord() {
        let currentWord = suggestionController.currentWord
        
        // Delete from typedText
        if !currentWord.isEmpty {
            for _ in 0..<currentWord.count {
                if !typedText.isEmpty {
                    typedText.removeLast()
                }
            }
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
        
        onKeyPress?([
            "type": "backspace",
            "value": "",
            "label": "⌫",
            "hasNikkud": false
        ])
    }
    
    private func handleSuggestionSelected(_ suggestion: String) {
        let replacedWord = suggestionController.handleSuggestionSelected(suggestion)
        
        // Remove current word from typedText if any (when in typing mode)
        for _ in 0..<replacedWord.count {
            if !typedText.isEmpty {
                typedText.removeLast()
            }
        }
        
        // Add the suggestion + space
        typedText += suggestion + " "
        
        // Emit events to React Native
        onSuggestionSelect?([
            "suggestion": suggestion,
            "replacedWord": replacedWord
        ])
        
        onKeyPress?([
            "type": "suggestion",
            "value": suggestion + " "
        ])
    }
    
    private func handleNikkudSelected(_ value: String) {
        print("🎯 KeyboardPreviewView handleNikkudSelected: '\(value)'")
        
        // Add the nikkud character to typed text
        typedText += value
        
        // Notify suggestion controller
        suggestionController.handleCharacterTyped(value)
        
        // Emit event to React Native
        onKeyPress?([
            "type": "nikkud",
            "value": value,
            "label": value,
            "hasNikkud": false
        ])
    }
    
    private func detectCurrentWord() {
        suggestionController.detectCurrentWord(from: typedText)
    }
    
    private func emitKeyPress(_ key: ParsedKey) {
        onKeyPress?([
            "type": key.type,
            "value": key.value,
            "label": key.label,
            "hasNikkud": !key.nikkud.isEmpty
        ])
    }
    
    /// Handle long-press on keyset/nikkud keys for selection in edit mode
    /// This emits a special event type so React can select the key for styling
    private func handleKeyLongPress(_ key: ParsedKey) {
        print("🔑 KeyboardPreviewView handleKeyLongPress: type='\(key.type)'")
        
        // Emit a "longpress" event with the key's type as the value for selection
        // The React side will use this to add the key type to the selected keys
        onKeyPress?([
            "type": "longpress",
            "value": key.type,  // Use type (e.g., "keyset", "nikkud") as the value for group matching
            "label": key.label,
            "hasNikkud": false
        ])
    }
    
    // MARK: - Layout
    
    override func layoutSubviews() {
        super.layoutSubviews()
        
        let currentWidth = bounds.width
        
        // Don't re-render if nikkud picker is showing
        let hasNikkudPicker = subviews.contains(where: { $0.tag == 999 })
        if hasNikkudPicker { return }
        
        // Only re-render if width changed
        if parsedConfig != nil && abs(currentWidth - lastRenderedWidth) > 1 {
            renderKeyboard()
        }
    }
}