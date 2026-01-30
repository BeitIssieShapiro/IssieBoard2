import UIKit

/**
 * iOS Keyboard Extension Controller
 * Thin wrapper around KeyboardRenderer that handles system keyboard integration.
 * Routes key presses to the system text input proxy.
 */
class KeyboardViewController: UIInputViewController {
    
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
    
    // MARK: - Lifecycle
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        print("🚀 KeyboardViewController viewDidLoad")
        print("📐 viewDidLoad: view.bounds = \(view.bounds)")
        
        setupKeyboard()
        setupRenderer()
        loadPreferences()
        startObservingPreferences()
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        print("📐 viewWillAppear: view.bounds = \(view.bounds)")
        loadPreferences()
    }
    
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        print("📐 viewDidLayoutSubviews: view.bounds = \(view.bounds)")
        
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
    
    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        stopObservingPreferences()
    }
    
    deinit {
        stopObservingPreferences()
    }
    
    // MARK: - Setup
    
    private func setupKeyboard() {
        keyboardView = UIView()
        keyboardView.backgroundColor = UIColor(red: 0.82, green: 0.82, blue: 0.82, alpha: 1.0)
        view.addSubview(keyboardView)
        
        keyboardView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            keyboardView.leftAnchor.constraint(equalTo: view.leftAnchor),
            keyboardView.rightAnchor.constraint(equalTo: view.rightAnchor),
            keyboardView.topAnchor.constraint(equalTo: view.topAnchor),
            keyboardView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            // Increased height to accommodate all rows plus suggestions bar
            keyboardView.heightAnchor.constraint(greaterThanOrEqualToConstant: 340)
        ])
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
        print("🔄 Loading keyboard preferences...")
        preferences.printAllPreferences()
        
        if let configJSON = preferences.getKeyboardConfigJSON(), !configJSON.isEmpty {
            print("⚙️ Parsing keyboard config...")
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
        print("📱 Loading bundled default config...")
        
        // Load pre-built default config from bundle
        if let configPath = Bundle.main.path(forResource: "default_config", ofType: "json"),
           let configJSON = try? String(contentsOfFile: configPath, encoding: .utf8) {
            print("✅ Loaded default_config.json from bundle")
            parseKeyboardConfig(configJSON)
            return
        }
        
        print("⚠️ Could not load default_config.json - showing fallback")
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
        
        print("🎨 Rendering keyboard via KeyboardRenderer")
        
        // Update word completion enabled state from config
        let wasEnabled = wordCompletionEnabled
        wordCompletionEnabled = config.isWordSuggestionsEnabled
        print("📝 Word completion enabled: \(wordCompletionEnabled)")
        
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
            // Clear current word on enter
            currentWord = ""
            renderer.clearSuggestions()
            
        case "space":
            textDocumentProxy.insertText(" ")
            // Clear current word on space (word completed)
            currentWord = ""
            renderer.clearSuggestions()
            
        case "keyset":
            // Keyset change - update language for word completion
            updateLanguageFromKeyset(key.keysetValue)
            
        case "language", "next-keyboard":
            // Language switch - update language for word completion
            updateLanguageFromCurrentKeyset()
            
        default:
            // Regular character key
            let value = key.value
            if !value.isEmpty {
                textDocumentProxy.insertText(value)
                // Add to current word and update suggestions
                currentWord += value
                updateWordSuggestions()
            }
        }
    }
    
    // MARK: - Word Completion
    
    /// Update word suggestions based on current word
    private func updateWordSuggestions() {
        // Skip if word completion is disabled
        guard wordCompletionEnabled else {
            return
        }
        
        guard !currentWord.isEmpty else {
            renderer.clearSuggestions()
            return
        }
        
        print("📝 Getting suggestions for: '\(currentWord)'")
        let suggestions = WordCompletionManager.shared.getSuggestions(for: currentWord)
        renderer.updateSuggestions(suggestions)
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
        
        // Clear current word and suggestions
        currentWord = ""
        renderer.clearSuggestions()
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
    
    /// Update language based on keyset ID
    private func updateLanguageFromKeyset(_ keysetId: String) {
        let newLanguage: String
        if keysetId.hasPrefix("he") || keysetId.contains("hebrew") {
            newLanguage = "he"
        } else if keysetId.hasPrefix("ar") || keysetId.contains("arabic") {
            newLanguage = "ar"
        } else {
            newLanguage = "en"
        }
        
        if newLanguage != currentLanguage {
            currentLanguage = newLanguage
            // Only set language if word completion is enabled
            if wordCompletionEnabled {
                WordCompletionManager.shared.setLanguage(currentLanguage)
            }
            print("📝 Language changed to: \(currentLanguage)")
            // Update suggestions for new language
            updateWordSuggestions()
        }
    }
    
    /// Update language based on current keyset in renderer
    private func updateLanguageFromCurrentKeyset() {
        let keysetId = renderer.currentKeysetId
        updateLanguageFromKeyset(keysetId)
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
        
        // Try to open the main app using a URL scheme
        // The URL scheme "issieboard" is registered in the main app's Info.plist
        guard let url = URL(string: "issieboard://settings") else {
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