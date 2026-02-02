import UIKit

/**
 * Base iOS Keyboard Extension Controller
 * Shared keyboard controller that handles system keyboard integration.
 * Each language-specific keyboard extension inherits from this class.
 * Routes key presses to the system text input proxy.
 */
class BaseKeyboardViewController: UIInputViewController {
    
    // MARK: - Properties
    
    private var keyboardView: UIView!
    private let preferences = KeyboardPreferences()
    private var preferenceObserver: KeyboardPreferenceObserver?
    
    // Keyboard renderer - handles all UI rendering and keyboard state
    private var renderer: KeyboardRenderer!
    private var parsedConfig: KeyboardConfig?
    
    // Word completion
    private var wordCompletionEnabled: Bool = false  // Start as false so first render initializes it
    private var currentWord: String = ""
    private var currentLanguage: String = "en"
    
    // Fuzzy suggestion state - for smart auto-replace on space
    private var currentSuggestionResult: WordCompletionManager.SuggestionResult?
    
    // Auto-correct enabled state (from config)
    private var autoCorrectEnabled: Bool = true
    
    // Double-space shortcut (". " instead of "  ")
    private var lastSpaceTime: Date?
    private let doubleSpaceThreshold: TimeInterval = 2.0  // 2 seconds
    
    /// Override this in subclasses to specify the keyboard language
    var keyboardLanguage: String {
        // Try to read from Info.plist first
        if let language = Bundle.main.object(forInfoDictionaryKey: "KeyboardLanguage") as? String {
            return language
        }
        // Default to English
        return "en"
    }
    
    /// Override this in subclasses to specify the config file name
    var defaultConfigFileName: String {
        return "default_config"
    }
    
    // MARK: - Lifecycle
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        print("🚀 BaseKeyboardViewController viewDidLoad - Language: \(keyboardLanguage)")
        print("📐 viewDidLoad: view.bounds = \(view.bounds)")
        
        // Set the current language based on keyboard type
        currentLanguage = keyboardLanguage
        
        setupKeyboard()
        setupRenderer()
        loadPreferences()
        startObservingPreferences()
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        print("📐 viewWillAppear: view.bounds = \(view.bounds)")
        loadPreferences()
        
        // Detect existing text before cursor when keyboard appears
        detectCurrentWordFromContext()
    }
    
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        print("📐 viewDidLayoutSubviews: view.bounds = \(view.bounds)")
        
        // Update globe button visibility based on needsInputModeSwitchKey
        updateGlobeButtonVisibility()
        
        // Renderer handles its own width change detection
        if parsedConfig != nil {
            renderer.rerenderIfNeeded()
        }
    }
    
    override func viewWillTransition(to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator) {
        super.viewWillTransition(to: size, with: coordinator)
        print("📐 viewWillTransition: new size = \(size)")
        
        coordinator.animate(alongsideTransition: { _ in
            print("📐 viewWillTransition animate: view.bounds = \(self.view.bounds)")
        }, completion: { _ in
            print("📐 viewWillTransition completion: view.bounds = \(self.view.bounds)")
            // Renderer will handle re-render via viewDidLayoutSubviews
        })
    }
    
    override func textWillChange(_ textInput: UITextInput?) {
        super.textWillChange(textInput)
        // Note: Only re-render for field switching, not for every keystroke
        // Re-rendering on every keystroke was causing suggestions to be cleared
        // because renderKeyboard() creates a fresh suggestions bar
        print("📝 textWillChange called - NOT re-rendering to preserve suggestions")
    }
    
    override func textDidChange(_ textInput: UITextInput?) {
        super.textDidChange(textInput)
        // Detect existing text when switching between text fields
        // This is called when cursor moves or text field changes
        print("📝 textDidChange called - detecting current word from context")
        detectCurrentWordFromContext()
    }
    
    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        stopObservingPreferences()
    }
    
    deinit {
        stopObservingPreferences()
    }
    
    // MARK: - Setup
    
    /// Height constraint for dynamic keyboard height
    private var keyboardHeightConstraint: NSLayoutConstraint?
    
    private func setupKeyboard() {
        keyboardView = UIView()
        keyboardView.backgroundColor = .clear  // Transparent for liquid glass effect
        view.addSubview(keyboardView)
        
        keyboardView.translatesAutoresizingMaskIntoConstraints = false
        
        // Create height constraint that we can update dynamically
        let heightConstraint = keyboardView.heightAnchor.constraint(equalToConstant: 216)  // Default iOS keyboard height
        keyboardHeightConstraint = heightConstraint
        
        NSLayoutConstraint.activate([
            keyboardView.leftAnchor.constraint(equalTo: view.leftAnchor),
            keyboardView.rightAnchor.constraint(equalTo: view.rightAnchor),
            keyboardView.topAnchor.constraint(equalTo: view.topAnchor),
            keyboardView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            heightConstraint
        ])
    }
    
    /// Update keyboard height based on number of rows in current keyset
    private func updateKeyboardHeight() {
        guard let config = parsedConfig else { return }
        
        let requiredHeight = renderer.calculateKeyboardHeight(for: config, keysetId: renderer.currentKeysetId)
        print("📐 Calculated keyboard height: \(requiredHeight)")
        
        keyboardHeightConstraint?.constant = requiredHeight
        view.setNeedsLayout()
    }
    
    private func setupRenderer() {
        // Create renderer - handles all UI rendering
        renderer = KeyboardRenderer()
        
        // Set up callback to save keyset changes to preferences
        renderer.onKeysetChanged = { [weak self] keysetId in
            self?.saveCurrentKeyset(keysetId)
        }
        
        // Set up callbacks for key presses - route to system
        renderer.onKeyPress = { [weak self] key in
            self?.handleKeyPress(key)
        }
        
        // Set up backspace long-press callbacks
        renderer.onDeleteCharacter = { [weak self] in
            self?.deleteCharacter()
        }
        
        renderer.onDeleteWord = { [weak self] in
            self?.deleteWord()
        }
        
        renderer.onNikkudSelected = { [weak self] value in
            self?.textDocumentProxy.insertText(value)
            // Clear current word after nikkud selection
            self?.currentWord = ""
            self?.renderer.clearSuggestions()
        }
        
        // Handle word suggestion selection
        renderer.onSuggestionSelected = { [weak self] suggestion in
            self?.handleSuggestionSelected(suggestion)
        }
        
        // System keyboard callbacks
        renderer.onNextKeyboard = { [weak self] in
            self?.advanceToNextInputMode()
        }
        
        renderer.onDismissKeyboard = { [weak self] in
            self?.dismissKeyboard()
        }
        
        renderer.onOpenSettings = { [weak self] in
            self?.openSettings()
        }
        
        // Word completion will be initialized after config is loaded
    }
    
    // MARK: - Preferences Management
    
    private func loadPreferences() {
        print("🔄 Loading keyboard preferences for language: \(keyboardLanguage)...")
        preferences.printAllPreferences()
        
        // First try to load language-specific config from preferences
        let configKey = "keyboardConfig_\(keyboardLanguage)"
        if let configJSON = preferences.getString(forKey: configKey), !configJSON.isEmpty {
            print("⚙️ Parsing keyboard config for \(keyboardLanguage)...")
            print("   Config length: \(configJSON.count) chars")
            parseKeyboardConfig(configJSON)
        } else if let configJSON = preferences.getKeyboardConfigJSON(), !configJSON.isEmpty {
            // Fall back to global config
            print("⚙️ Parsing global keyboard config...")
            print("   Config length: \(configJSON.count) chars")
            parseKeyboardConfig(configJSON)
        } else {
            print("⚠️ No keyboard config found (or empty) - loading bundled default")
            loadBundledDefaultConfig()
        }
    }
    
    /// Load the bundled default keyboard configuration
    /// This allows the keyboard to work immediately after installation
    /// without requiring the user to open the main app first
    private func loadBundledDefaultConfig() {
        print("📱 Loading bundled default config for \(keyboardLanguage)...")
        
        // Load pre-built default config from bundle
        if let configPath = Bundle.main.path(forResource: defaultConfigFileName, ofType: "json"),
           let configJSON = try? String(contentsOfFile: configPath, encoding: .utf8) {
            print("✅ Loaded \(defaultConfigFileName).json from bundle")
            parseKeyboardConfig(configJSON)
            return
        }
        
        print("⚠️ Could not load \(defaultConfigFileName).json - showing fallback")
        renderFallbackKeyboard()
    }
    
    private func parseKeyboardConfig(_ jsonString: String) {
        guard let jsonData = jsonString.data(using: .utf8) else {
            print("❌ Failed to convert config string to data")
            renderFallbackKeyboard()
            return
        }
        
        do {
            let decoder = JSONDecoder()
            parsedConfig = try decoder.decode(KeyboardConfig.self, from: jsonData)
            
            print("✅ Config parsed successfully")
            print("   Keysets: \(parsedConfig?.keysets.map { $0.id }.joined(separator: ", ") ?? "none")")
            print("   Default keyset: \(parsedConfig?.defaultKeyset ?? "none")")
            
            renderKeyboard()
        } catch {
            print("❌ Failed to parse config: \(error)")
            renderFallbackKeyboard()
        }
    }
    
    private func startObservingPreferences() {
        preferenceObserver = KeyboardPreferenceObserver(preferences: preferences) { [weak self] in
            print("🔔 Preferences changed! Reloading keyboard...")
            self?.loadPreferences()
        }
        
        preferenceObserver?.startObserving(interval: 0.5)
        print("👁️ Started observing preference changes")
    }
    
    private func stopObservingPreferences() {
        preferenceObserver?.stopObserving()
        preferenceObserver = nil
    }
    
    // MARK: - Keyset Persistence
    
    /// Save the current keyset ID to preferences (for persistence across keyboard restarts)
    private func saveCurrentKeyset(_ keysetId: String) {
        print("💾 Saving current keyset to preferences: '\(keysetId)'")
        preferences.selectedLanguage = keysetId
    }
    
    /// Load the saved keyset ID from preferences
    /// Returns the saved keyset ID if it exists in the current config, nil otherwise
    private func loadSavedKeyset() -> String? {
        guard let savedKeyset = preferences.selectedLanguage, !savedKeyset.isEmpty else {
            print("📱 No saved keyset found in preferences")
            return nil
        }
        
        // Verify the saved keyset exists in current config
        guard let config = parsedConfig,
              config.keysets.contains(where: { $0.id == savedKeyset }) else {
            print("⚠️ Saved keyset '\(savedKeyset)' not found in current config")
            return nil
        }
        
        print("📱 Loaded saved keyset from preferences: '\(savedKeyset)'")
        return savedKeyset
    }
    
    // MARK: - Rendering
    
    private func renderKeyboard() {
        guard let config = parsedConfig else {
            print("❌ No config to render")
            renderFallbackKeyboard()
            return
        }
        
        print("🎨 Rendering keyboard via KeyboardRenderer - Language: \(keyboardLanguage)")
        
        // Check if suggestions should be disabled for this input type
        let shouldDisableForInputType = shouldDisableSuggestionsForKeyboardType()
        
        // Update word completion enabled state from config AND input type
        let wasEnabled = wordCompletionEnabled
        // Word completion is enabled only if config allows it AND input type supports it
        wordCompletionEnabled = config.isWordSuggestionsEnabled && !shouldDisableForInputType
        print("📝 Word completion enabled: \(wordCompletionEnabled) (config: \(config.isWordSuggestionsEnabled), inputType disable: \(shouldDisableForInputType))")
        
        // Update auto-correct enabled state from config
        autoCorrectEnabled = config.isAutoCorrectEnabled
        print("📝 Auto-correct enabled: \(autoCorrectEnabled) (config: \(config.isAutoCorrectEnabled))")
        
        // Tell the renderer whether word suggestions are enabled
        // This overrides the config setting when input type requires disabling
        renderer.setWordSuggestionsEnabled(wordCompletionEnabled)
        
        // Initialize word completion only if enabled and wasn't enabled before
        if wordCompletionEnabled && !wasEnabled {
            WordCompletionManager.shared.setLanguage(currentLanguage)
        }
        
        // Clear word completion state if disabled
        if !wordCompletionEnabled {
            currentWord = ""
        }
        
        // Get editor context for dynamic enter key
        let editorContext = analyzeEditorContext()
        
        // Determine initial keyset - prioritize: saved > renderer current > config default
        var initialKeyset: String
        if !renderer.currentKeysetId.isEmpty && renderer.currentKeysetId != "abc" {
            // Renderer already has a keyset (not the default "abc" placeholder)
            initialKeyset = renderer.currentKeysetId
        } else if let savedKeyset = loadSavedKeyset() {
            // Use saved keyset from preferences
            initialKeyset = savedKeyset
        } else {
            // Fall back to config default
            initialKeyset = config.defaultKeyset ?? "abc"
        }
        
        print("📱 Using keyset: '\(initialKeyset)'")
        
        // Use renderer - it handles all UI rendering
        renderer.renderKeyboard(
            in: keyboardView,
            config: config,
            currentKeysetId: initialKeyset,
            editorContext: editorContext
        )
        
        // Update keyboard height dynamically based on number of rows
        updateKeyboardHeight()
        
        // Show default suggestions initially (if word completion is enabled and no current word)
        if wordCompletionEnabled && currentWord.isEmpty {
            showDefaultSuggestions()
        }
    }
    
    private func renderFallbackKeyboard() {
        print("📱 Rendering fallback keyboard")
        
        keyboardView.subviews.forEach { $0.removeFromSuperview() }
        
        let label = UILabel()
        label.text = "Loading keyboard...\nSwitch profiles in app"
        label.numberOfLines = 0
        label.textAlignment = .center
        label.textColor = .darkGray
        keyboardView.addSubview(label)
        
        label.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: keyboardView.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: keyboardView.centerYAnchor)
        ])
    }
    
    // MARK: - Editor Context Analysis
    
    private func analyzeEditorContext() -> (enterVisible: Bool, enterLabel: String, enterAction: Int) {
        guard let textDocumentProxy = textDocumentProxy as UITextDocumentProxy? else {
            return (true, "↵", UIReturnKeyType.default.rawValue)
        }
        
        // Get return key type
        let returnKeyType = textDocumentProxy.returnKeyType ?? .default
        
        // Determine enter label based on return key type
        let enterLabel: String
        switch returnKeyType {
        case .search:
            enterLabel = "Search"
        case .go:
            enterLabel = "Go"
        case .send:
            enterLabel = "Send"
        case .next:
            enterLabel = "Next"
        case .done:
            enterLabel = "Done"
        case .continue:
            enterLabel = "Continue"
        case .join:
            enterLabel = "Join"
        case .route:
            enterLabel = "Route"
        case .emergencyCall:
            enterLabel = "Call"
        case .google:
            enterLabel = "Google"
        case .yahoo:
            enterLabel = "Yahoo"
        default:
            enterLabel = "↵"
        }
        
        return (true, enterLabel, returnKeyType.rawValue)
    }
    
    /// Check if word suggestions should be disabled based on keyboard type
    /// Returns true if suggestions should be disabled for the current input field
    private func shouldDisableSuggestionsForKeyboardType() -> Bool {
        // Get keyboard type from the text input
        let keyboardType = textDocumentProxy.keyboardType ?? .default
        
        // Log the keyboard type for debugging
        print("📝 Current keyboard type: \(keyboardType.rawValue) (\(keyboardTypeDescription(keyboardType)))")
        
        // Disable suggestions for these keyboard types:
        switch keyboardType {
        case .URL:
            // URL input (Safari address bar, etc.)
            print("📝 Keyboard type: URL - disabling suggestions")
            return true
        case .emailAddress:
            // Email address input
            print("📝 Keyboard type: Email - disabling suggestions")
            return true
        case .numberPad, .phonePad, .decimalPad, .numbersAndPunctuation:
            // Number-only inputs
            print("📝 Keyboard type: Numbers - disabling suggestions")
            return true
        case .asciiCapableNumberPad:
            // ASCII number pad
            print("📝 Keyboard type: ASCII Numbers - disabling suggestions")
            return true
        case .webSearch:
            // Web search - could go either way, but URL-like content might be typed
            // Keep suggestions for now as search queries are typically words
            print("📝 Keyboard type: Web Search - keeping suggestions")
            return false
        case .twitter, .namePhonePad:
            // Social/names - suggestions are useful
            print("📝 Keyboard type: Twitter/NamePhone - keeping suggestions")
            return false
        default:
            // Default and other types - keep suggestions
            print("📝 Keyboard type: Default/Other - keeping suggestions")
            return false
        }
    }
    
    /// Helper to get a human-readable description of keyboard type
    private func keyboardTypeDescription(_ type: UIKeyboardType) -> String {
        switch type {
        case .default: return "default"
        case .asciiCapable: return "asciiCapable"
        case .numbersAndPunctuation: return "numbersAndPunctuation"
        case .URL: return "URL"
        case .numberPad: return "numberPad"
        case .phonePad: return "phonePad"
        case .namePhonePad: return "namePhonePad"
        case .emailAddress: return "emailAddress"
        case .decimalPad: return "decimalPad"
        case .twitter: return "twitter"
        case .webSearch: return "webSearch"
        case .asciiCapableNumberPad: return "asciiCapableNumberPad"
        @unknown default: return "unknown(\(type.rawValue))"
        }
    }
    
    // MARK: - Backspace Actions
    
    /// Delete a single character (for backspace long-press)
    private func deleteCharacter() {
        textDocumentProxy.deleteBackward()
        // Update current word after backspace
        if !currentWord.isEmpty {
            currentWord.removeLast()
            updateWordSuggestions()
        } else {
            detectCurrentWord()
        }
    }
    
    /// Delete an entire word (for backspace long-press after 6 seconds)
    private func deleteWord() {
        // Get text before cursor to find word boundary
        guard let beforeText = textDocumentProxy.documentContextBeforeInput, !beforeText.isEmpty else {
            // No text before cursor, just delete one character
            textDocumentProxy.deleteBackward()
            return
        }
        
        // Find the start of the current word (going backwards from cursor)
        var charsToDelete = 0
        var foundNonSpace = false
        
        for char in beforeText.reversed() {
            if char == " " || char == "\n" || char == "\t" {
                if foundNonSpace {
                    // We've found a word boundary
                    break
                }
                // Still in trailing spaces, continue
                charsToDelete += 1
            } else {
                foundNonSpace = true
                charsToDelete += 1
            }
        }
        
        // Delete the word
        if charsToDelete > 0 {
            print("⌫ Deleting \(charsToDelete) characters (word delete)")
            for _ in 0..<charsToDelete {
                textDocumentProxy.deleteBackward()
            }
        } else {
            // Fallback: delete one character
            textDocumentProxy.deleteBackward()
        }
        
        // Update word state
        currentWord = ""
        detectCurrentWord()
    }
    
    // MARK: - Key Press Handling
    
    private func handleKeyPress(_ key: ParsedKey) {
        print("🔘 Key press received: type=\(key.type), value=\(key.value)")
        
        switch key.type.lowercased() {
        case "backspace":
            textDocumentProxy.deleteBackward()
            // Update current word after backspace
            if !currentWord.isEmpty {
                currentWord.removeLast()
                updateWordSuggestions()
            } else {
                // Try to detect current word from context
                detectCurrentWord()
            }
            
        case "enter", "action":
            textDocumentProxy.insertText("\n")
            // Clear current word on enter, show default suggestions
            currentWord = ""
            showDefaultSuggestions()
            
        case "space":
            handleSpaceKey()
        
        case "keyset":
            // Keyset change - no language change for single-language keyboard
            break
            
        case "next-keyboard":
            // Language switch - advance to next system keyboard
            advanceToNextInputMode()
            
        default:
            // Regular character key
            let value = key.value
            if !value.isEmpty {
                // Check if this is a space key (by value, not type)
                if value == " " {
                    handleSpaceKey()
                } else {
                    textDocumentProxy.insertText(value)
                    // Add to current word and update suggestions
                    currentWord += value
                    updateWordSuggestions()
                }
            }
        }
    }
    
    // MARK: - Word Completion
    
    /// Update word suggestions based on current word
    private func updateWordSuggestions() {
        // Skip if word completion is disabled
        guard wordCompletionEnabled else {
            currentSuggestionResult = nil
            return
        }
        
        // Skip suggestions for URL, email, number fields, etc.
        if shouldDisableSuggestionsForKeyboardType() {
            currentSuggestionResult = nil
            renderer.clearSuggestions()
            return
        }
        
        guard !currentWord.isEmpty else {
            currentSuggestionResult = nil
            renderer.clearSuggestions()
            return
        }
        
        print("📝 Getting structured suggestions for: '\(currentWord)'")
        let result = WordCompletionManager.shared.getSuggestionsStructured(for: currentWord, language: currentLanguage)
        currentSuggestionResult = result
        
        // Build display suggestions based on fuzzy state
        var displaySuggestions: [String] = []
        
        if result.hasFuzzyOnly && !result.suggestions.isEmpty {
            // Only fuzzy matches - show quoted literal first, then best fuzzy highlighted
            let quotedLiteral = "\"\(currentWord)\""
            displaySuggestions.append(quotedLiteral)
            
            // Add fuzzy suggestions
            displaySuggestions.append(contentsOf: result.suggestions)
            
            print("📝 Fuzzy only mode: literal='\(quotedLiteral)', fuzzy=\(result.suggestions)")
        } else {
            // Has exact matches - show them normally
            displaySuggestions = result.suggestions
        }
        
        // Update renderer with suggestions and fuzzy state
        // Only highlight the best fuzzy match if auto-correct is enabled
        let highlightIndex: Int? = (result.hasFuzzyOnly && autoCorrectEnabled) ? 1 : nil
        renderer.updateSuggestions(displaySuggestions, highlightIndex: highlightIndex)
    }
    
    /// Handle suggestion selection - replace current word with suggestion
    private func handleSuggestionSelected(_ suggestion: String) {
        print("📝 Suggestion selected: '\(suggestion)', current word: '\(currentWord)'")
        
        // Delete the current word
        for _ in 0..<currentWord.count {
            textDocumentProxy.deleteBackward()
        }
        
        // Insert the suggestion followed by a space
        textDocumentProxy.insertText(suggestion + " ")
        
        // Clear current word and show default suggestions for next word
        currentWord = ""
        showDefaultSuggestions()
    }
    
    /// Show default suggestions (when no text is being typed)
    private func showDefaultSuggestions() {
        guard wordCompletionEnabled else { return }
        
        // Skip suggestions for URL, email, number fields, etc.
        if shouldDisableSuggestionsForKeyboardType() {
            renderer.clearSuggestions()
            return
        }
        
        // Get default suggestions for current language (empty prefix)
        let suggestions = WordCompletionManager.shared.getSuggestions(for: "")
        print("📝 Showing default suggestions: \(suggestions)")
        renderer.updateSuggestions(suggestions)
    }
    
    // MARK: - Space Key Handling
    
    /// Handle space key with double-space shortcut and smart fuzzy auto-replace
    /// 1. If fuzzy-only mode with smart replace enabled: replace word with best fuzzy match
    /// 2. Double-space within 2 seconds: replace " " with ". "
    private func handleSpaceKey() {
        let now = Date()
        
        // Check for smart fuzzy auto-replace first (only if auto-correct is enabled)
        if autoCorrectEnabled,
           let result = currentSuggestionResult,
           result.hasFuzzyOnly,
           WordCompletionManager.shared.smartAutoReplaceEnabled,
           let bestMatch = result.bestFuzzyMatch,
           !currentWord.isEmpty {
            print("⌨️ Smart fuzzy replace: '\(currentWord)' → '\(bestMatch)'")
            
            // Delete the current word
            for _ in 0..<currentWord.count {
                textDocumentProxy.deleteBackward()
            }
            
            // Insert the best fuzzy match followed by space
            textDocumentProxy.insertText(bestMatch + " ")
            
            // Clear state and show default suggestions
            currentWord = ""
            currentSuggestionResult = nil
            lastSpaceTime = now
            showDefaultSuggestions()
            return
        }
        
        // Check if this is a double-space (within threshold)
        if let lastTime = lastSpaceTime,
           now.timeIntervalSince(lastTime) < doubleSpaceThreshold {
            // Double-space detected!
            // Check if the last character was a space (we can replace it)
            // But only if it's a single space (not after ". " or "  ")
            if let beforeText = textDocumentProxy.documentContextBeforeInput,
               beforeText.hasSuffix(" ") {
                // Check if the character before the space is NOT a space or period
                // This prevents ".  " from becoming ".. "
                let textBeforeSpace = String(beforeText.dropLast())
                let charBeforeSpace = textBeforeSpace.last
                
                if charBeforeSpace != " " && charBeforeSpace != "." {
                    print("⌨️ Double-space shortcut: replacing ' ' with '. '")
                    // Delete the previous space
                    textDocumentProxy.deleteBackward()
                    // Insert period and space
                    textDocumentProxy.insertText(". ")
                    // Reset the timer so triple-space doesn't trigger again
                    lastSpaceTime = nil
                } else {
                    // Already have space or period before, just insert space normally
                    textDocumentProxy.insertText(" ")
                    lastSpaceTime = now
                }
            } else {
                // No space before cursor, just insert space normally
                textDocumentProxy.insertText(" ")
                lastSpaceTime = now
            }
        } else {
            // Single space - insert normally
            textDocumentProxy.insertText(" ")
            lastSpaceTime = now
        }
        
        // Clear current word on space (word completed), show default suggestions
        currentWord = ""
        currentSuggestionResult = nil
        showDefaultSuggestions()
    }
    
    /// Detect current word from text document proxy context
    private func detectCurrentWord() {
        guard let beforeInput = textDocumentProxy.documentContextBeforeInput else {
            currentWord = ""
            renderer.clearSuggestions()
            return
        }
        
        // Find the last word (characters after the last space/newline)
        let trimmed = beforeInput.trimmingCharacters(in: .whitespaces)
        if let lastSpaceIndex = trimmed.lastIndex(where: { $0 == " " || $0 == "\n" }) {
            currentWord = String(trimmed[trimmed.index(after: lastSpaceIndex)...])
        } else {
            currentWord = trimmed
        }
        
        print("📝 Detected current word: '\(currentWord)'")
        updateWordSuggestions()
    }
    
    /// Detect current word from existing text when keyboard appears or text field changes
    /// This allows suggestions to be shown based on text that was already typed before keyboard appeared
    private func detectCurrentWordFromContext() {
        // Skip if word completion is disabled or renderer not ready
        guard wordCompletionEnabled, renderer != nil else {
            print("📝 detectCurrentWordFromContext: Word completion disabled or renderer not ready")
            return
        }
        
        // Skip suggestions for URL, email, number fields, etc.
        if shouldDisableSuggestionsForKeyboardType() {
            currentWord = ""
            currentSuggestionResult = nil
            renderer.clearSuggestions()
            return
        }
        
        guard let beforeInput = textDocumentProxy.documentContextBeforeInput, !beforeInput.isEmpty else {
            // No text before cursor - show default suggestions
            print("📝 detectCurrentWordFromContext: No text before cursor")
            currentWord = ""
            currentSuggestionResult = nil
            showDefaultSuggestions()
            return
        }
        
        // Check if cursor is right after whitespace (no word in progress)
        if beforeInput.last == " " || beforeInput.last == "\n" || beforeInput.last == "\t" {
            print("📝 detectCurrentWordFromContext: Cursor after whitespace, showing defaults")
            currentWord = ""
            currentSuggestionResult = nil
            showDefaultSuggestions()
            return
        }
        
        // Find the word before cursor (characters after the last space/newline)
        // Don't trim - we want to see exactly where the cursor is
        var wordStart = beforeInput.endIndex
        for i in beforeInput.indices.reversed() {
            let char = beforeInput[i]
            if char == " " || char == "\n" || char == "\t" {
                wordStart = beforeInput.index(after: i)
                break
            }
            if i == beforeInput.startIndex {
                wordStart = i
            }
        }
        
        let detectedWord = String(beforeInput[wordStart...])
        
        // Only update if it's different from what we're tracking
        if detectedWord != currentWord {
            print("📝 detectCurrentWordFromContext: Detected existing word '\(detectedWord)' (was '\(currentWord)')")
            currentWord = detectedWord
            updateWordSuggestions()
        } else {
            print("📝 detectCurrentWordFromContext: Same word '\(currentWord)', skipping update")
        }
    }
    
    // MARK: - Globe Button Visibility
    
    /// Track the last known needsInputModeSwitchKey state to avoid unnecessary re-renders
    private var lastNeedsInputModeSwitchKey: Bool?
    
    /// Update globe button visibility based on needsInputModeSwitchKey
    /// This is called from viewDidLayoutSubviews to handle iPad keyboard state changes
    private func updateGlobeButtonVisibility() {
        // Check if system needs us to show the globe button
        let shouldShowGlobe = self.needsInputModeSwitchKey
        
        // Only update if the state changed
        if lastNeedsInputModeSwitchKey != shouldShowGlobe {
            print("🌐 Globe button visibility changed: \(shouldShowGlobe ? "SHOW" : "HIDE")")
            lastNeedsInputModeSwitchKey = shouldShowGlobe
            
            // Update renderer's globe visibility setting
            renderer.setShowGlobeButton(shouldShowGlobe)
        }
    }
    
    // MARK: - System Keyboard Actions
    
    private func openSettings() {
        print("⚙️ Settings button tapped - attempting to open main app")
        
        // Check if we have full access (required to open URLs from keyboard extension)
        let hasFullAccess = self.hasFullAccess
        print("🔐 Full Access enabled: \(hasFullAccess)")
        
        if !hasFullAccess {
            print("⚠️ Full Access is not enabled - cannot open app from keyboard")
            print("   User needs to enable: Settings > IssieBoardNG > Keyboards > Allow Full Access")
            return
        }
        
        // Save the current keyboard language to preferences so the app opens with the right tab
        preferences.setString(keyboardLanguage, forKey: "launch_keyboard")
        print("📱 Saved launch_keyboard=\(keyboardLanguage) to preferences")
        
        // Try to open the main app using a URL scheme with keyboard parameter
        // The URL scheme "issieboard" is registered in the main app's Info.plist
        guard let url = URL(string: "issieboard://settings?keyboard=\(keyboardLanguage)") else {
            print("❌ Failed to create URL")
            return
        }
        
        print("🔗 Attempting to open URL: \(url)")
        
        // Keyboard extensions cannot use extensionContext.open() reliably
        // Use the UIApplication workaround through the responder chain
        openURL(url)
        
        // Dismiss the keyboard after opening the app
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
            self?.dismissKeyboard()
        }
    }
    
    /// Opens a URL from within a keyboard extension
    /// Uses the responder chain to access UIApplication.shared
    private func openURL(_ url: URL) {
        // Method 1: Try using the responder chain to find UIApplication
        var responder: UIResponder? = self
        while responder != nil {
            if let application = responder as? UIApplication {
                print("📱 Found UIApplication via responder chain")
                application.open(url, options: [:]) { success in
                    print(success ? "✅ Successfully opened URL" : "❌ Failed to open URL")
                }
                return
            }
            responder = responder?.next
        }
        
        // Method 2: Use selector-based approach through responder chain
        // Look for any responder that can handle openURL:
        let openURLSelector = NSSelectorFromString("openURL:")
        var target: UIResponder? = self
        while let currentTarget = target {
            if currentTarget.responds(to: openURLSelector) {
                print("📱 Found responder that handles openURL:")
                _ = currentTarget.perform(openURLSelector, with: url)
                print("✅ URL open request sent via openURL:")
                return
            }
            target = currentTarget.next
        }
        
        // Method 3: Access UIApplication.shared via UIResponder extension trick
        // The keyboard's view hierarchy ultimately connects to the host app's UIApplication
        if let hostApp = self.hostAppApplication {
            print("📱 Found host application via parent")
            hostApp.open(url, options: [:]) { success in
                print(success ? "✅ Successfully opened URL via host app" : "❌ Failed to open URL via host app")
            }
            return
        }
        
        print("❌ Could not find a way to open URL from keyboard extension")
        print("   All methods failed - this may be an iOS restriction")
    }
    
    /// Attempts to get UIApplication from the host app through private API
    private var hostAppApplication: UIApplication? {
        // Try to find UIApplication through the view hierarchy
        var responder: UIResponder? = self.view
        while let r = responder {
            if let app = r as? UIApplication {
                return app
            }
            // Check if this responder has an application property
            if r.responds(to: NSSelectorFromString("application")) {
                if let app = r.value(forKey: "application") as? UIApplication {
                    return app
                }
            }
            responder = r.next
        }
        return nil
    }
}