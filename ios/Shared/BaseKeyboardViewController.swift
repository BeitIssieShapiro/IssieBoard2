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
    
    // Word suggestion controller - handles all word completion logic
    private var suggestionController: WordSuggestionController!
    
    // Double-space shortcut (". " instead of "  ")
    private var lastSpaceTime: Date?
    private let doubleSpaceThreshold: TimeInterval = 2.0
    
    /// Override this in subclasses to specify the keyboard language
    var keyboardLanguage: String {
        if let language = Bundle.main.object(forInfoDictionaryKey: "KeyboardLanguage") as? String {
            return language
        }
        return "en"
    }
    
    /// Override this in subclasses to specify the config file name
    var defaultConfigFileName: String {
        return "default_config"
    }
    
    // MARK: - Lifecycle
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        debugLog("🚀 BaseKeyboardViewController viewDidLoad - Language: \(keyboardLanguage)")
        
        setupKeyboard()
        setupRenderer()
        setupSuggestionController()
        loadPreferences()
        startObservingPreferences()
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        loadPreferences()
        suggestionController.detectCurrentWord(from: textDocumentProxy.documentContextBeforeInput)
    }
    
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        updateGlobeButtonVisibility()
        if parsedConfig != nil {
            renderer.rerenderIfNeeded()
        }
    }
    
    override func viewWillTransition(to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator) {
        super.viewWillTransition(to: size, with: coordinator)
        coordinator.animate(alongsideTransition: nil, completion: nil)
    }
    
    override func textWillChange(_ textInput: UITextInput?) {
        super.textWillChange(textInput)
    }
    
    override func textDidChange(_ textInput: UITextInput?) {
        super.textDidChange(textInput)
        suggestionController.detectCurrentWord(from: textDocumentProxy.documentContextBeforeInput)
    }
    
    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        stopObservingPreferences()
    }
    
    deinit {
        stopObservingPreferences()
    }
    
    // MARK: - Setup
    
    private var keyboardHeightConstraint: NSLayoutConstraint?
    
    private func setupKeyboard() {
        keyboardView = UIView()
        keyboardView.backgroundColor = .clear
        view.addSubview(keyboardView)
        
        keyboardView.translatesAutoresizingMaskIntoConstraints = false
        
        let heightConstraint = keyboardView.heightAnchor.constraint(equalToConstant: 216)
        keyboardHeightConstraint = heightConstraint
        
        NSLayoutConstraint.activate([
            keyboardView.leftAnchor.constraint(equalTo: view.leftAnchor),
            keyboardView.rightAnchor.constraint(equalTo: view.rightAnchor),
            keyboardView.topAnchor.constraint(equalTo: view.topAnchor),
            keyboardView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            heightConstraint
        ])
    }
    
    private func updateKeyboardHeight() {
        guard let config = parsedConfig else { return }
        let requiredHeight = renderer.calculateKeyboardHeight(for: config, keysetId: renderer.currentKeysetId)
        keyboardHeightConstraint?.constant = requiredHeight
        view.setNeedsLayout()
    }
    
    private func setupRenderer() {
        renderer = KeyboardRenderer()
        
        renderer.onKeysetChanged = { [weak self] keysetId in
            self?.saveCurrentKeyset(keysetId)
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
            self?.textDocumentProxy.insertText(value)
            self?.suggestionController.handleSpace()
        }
        
        renderer.onSuggestionSelected = { [weak self] suggestion in
            self?.handleSuggestionSelected(suggestion)
        }
        
        renderer.onNextKeyboard = { [weak self] in
            self?.advanceToNextInputMode()
        }
        
        renderer.onDismissKeyboard = { [weak self] in
            self?.dismissKeyboard()
        }
        
        renderer.onOpenSettings = { [weak self] in
            self?.openSettings()
        }
    }
    
    private func setupSuggestionController() {
        suggestionController = WordSuggestionController(renderer: renderer)
        suggestionController.setLanguage(keyboardLanguage)
    }
    
    // MARK: - Preferences
    
    private func loadPreferences() {
        preferences.printAllPreferences()
        
        let configKey = "keyboardConfig_\(keyboardLanguage)"
        if let configJSON = preferences.getString(forKey: configKey), !configJSON.isEmpty {
            parseKeyboardConfig(configJSON)
        } else if let configJSON = preferences.getKeyboardConfigJSON(), !configJSON.isEmpty {
            parseKeyboardConfig(configJSON)
        } else {
            loadBundledDefaultConfig()
        }
    }
    
    private func loadBundledDefaultConfig() {
        if let configPath = Bundle.main.path(forResource: defaultConfigFileName, ofType: "json"),
           let configJSON = try? String(contentsOfFile: configPath, encoding: .utf8) {
            parseKeyboardConfig(configJSON)
            return
        }
        renderFallbackKeyboard()
    }
    
    private func parseKeyboardConfig(_ jsonString: String) {
        guard let jsonData = jsonString.data(using: .utf8) else {
            renderFallbackKeyboard()
            return
        }
        
        do {
            parsedConfig = try JSONDecoder().decode(KeyboardConfig.self, from: jsonData)
            renderKeyboard()
        } catch {
            errorLog("Failed to parse config: \(error)")
            renderFallbackKeyboard()
        }
    }
    
    private func startObservingPreferences() {
        preferenceObserver = KeyboardPreferenceObserver(preferences: preferences) { [weak self] in
            self?.loadPreferences()
        }
        preferenceObserver?.startObserving(interval: 0.5)
    }
    
    private func stopObservingPreferences() {
        preferenceObserver?.stopObserving()
        preferenceObserver = nil
    }
    
    private func saveCurrentKeyset(_ keysetId: String) {
        preferences.selectedLanguage = keysetId
    }
    
    private func loadSavedKeyset() -> String? {
        guard let savedKeyset = preferences.selectedLanguage, !savedKeyset.isEmpty else {
            return nil
        }
        guard let config = parsedConfig,
              config.keysets.contains(where: { $0.id == savedKeyset }) else {
            return nil
        }
        return savedKeyset
    }
    
    // MARK: - Rendering
    
    private func renderKeyboard() {
        guard let config = parsedConfig else {
            renderFallbackKeyboard()
            return
        }
        
        // Configure suggestion controller based on config and input type
        let shouldDisable = shouldDisableSuggestionsForKeyboardType()
        let suggestionsEnabled = config.isWordSuggestionsEnabled && !shouldDisable
        
        suggestionController.setEnabled(suggestionsEnabled)
        suggestionController.setAutoCorrectEnabled(config.isAutoCorrectEnabled)
        suggestionController.setLanguage(keyboardLanguage)
        
        renderer.setWordSuggestionsEnabled(suggestionsEnabled)
        
        let editorContext = analyzeEditorContext()
        
        var initialKeyset: String
        if !renderer.currentKeysetId.isEmpty && renderer.currentKeysetId != "abc" {
            initialKeyset = renderer.currentKeysetId
        } else if let savedKeyset = loadSavedKeyset() {
            initialKeyset = savedKeyset
        } else {
            initialKeyset = config.defaultKeyset ?? "abc"
        }
        
        renderer.renderKeyboard(
            in: keyboardView,
            config: config,
            currentKeysetId: initialKeyset,
            editorContext: editorContext
        )
        
        updateKeyboardHeight()
        
        if suggestionsEnabled && suggestionController.currentWord.isEmpty {
            suggestionController.showDefaults()
        }
    }
    
    private func renderFallbackKeyboard() {
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
    
    // MARK: - Editor Context
    
    private func analyzeEditorContext() -> (enterVisible: Bool, enterLabel: String, enterAction: Int) {
        let returnKeyType = textDocumentProxy.returnKeyType ?? .default
        
        let enterLabel: String
        switch returnKeyType {
        case .search: enterLabel = "Search"
        case .go: enterLabel = "Go"
        case .send: enterLabel = "Send"
        case .next: enterLabel = "Next"
        case .done: enterLabel = "Done"
        case .continue: enterLabel = "Continue"
        case .join: enterLabel = "Join"
        case .route: enterLabel = "Route"
        case .emergencyCall: enterLabel = "Call"
        case .google: enterLabel = "Google"
        case .yahoo: enterLabel = "Yahoo"
        default: enterLabel = "↵"
        }
        
        return (true, enterLabel, returnKeyType.rawValue)
    }
    
    private func shouldDisableSuggestionsForKeyboardType() -> Bool {
        let keyboardType = textDocumentProxy.keyboardType ?? .default
        
        switch keyboardType {
        case .URL, .emailAddress, .numberPad, .phonePad, .decimalPad, 
             .numbersAndPunctuation, .asciiCapableNumberPad:
            return true
        default:
            return false
        }
    }
    
    // MARK: - Key Press Handling
    
    private func handleKeyPress(_ key: ParsedKey) {
        switch key.type.lowercased() {
        case "backspace":
            handleBackspace()
            
        case "enter", "action":
            textDocumentProxy.insertText("\n")
            suggestionController.handleEnter()
            
        case "space":
            handleSpaceKey()
        
        case "keyset":
            break
            
        case "next-keyboard":
            advanceToNextInputMode()
            
        default:
            let value = key.value
            if !value.isEmpty {
                if value == " " {
                    handleSpaceKey()
                } else {
                    textDocumentProxy.insertText(value)
                    suggestionController.handleCharacterTyped(value)
                }
            }
        }
    }
    
    private func handleBackspace() {
        textDocumentProxy.deleteBackward()
        if !suggestionController.handleBackspace() {
            suggestionController.detectCurrentWord(from: textDocumentProxy.documentContextBeforeInput)
        }
    }
    
    private func handleDeleteWord() {
        guard let beforeText = textDocumentProxy.documentContextBeforeInput, !beforeText.isEmpty else {
            textDocumentProxy.deleteBackward()
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
                textDocumentProxy.deleteBackward()
            }
        } else {
            textDocumentProxy.deleteBackward()
        }
        
        suggestionController.detectCurrentWord(from: textDocumentProxy.documentContextBeforeInput)
    }
    
    private func handleSuggestionSelected(_ suggestion: String) {
        let currentWord = suggestionController.currentWord
        
        // Delete the current word
        for _ in 0..<currentWord.count {
            textDocumentProxy.deleteBackward()
        }
        
        // Insert suggestion with space
        textDocumentProxy.insertText(suggestion + " ")
        
        _ = suggestionController.handleSuggestionSelected()
    }
    
    private func handleSpaceKey() {
        let now = Date()
        
        // Check for fuzzy auto-replace
        if let replacement = suggestionController.getFuzzyAutoReplacement() {
            let currentWord = suggestionController.currentWord
            
            for _ in 0..<currentWord.count {
                textDocumentProxy.deleteBackward()
            }
            
            textDocumentProxy.insertText(replacement + " ")
            suggestionController.handleSpace()
            lastSpaceTime = now
            return
        }
        
        // Double-space shortcut for period
        if let lastTime = lastSpaceTime,
           now.timeIntervalSince(lastTime) < doubleSpaceThreshold {
            if let beforeText = textDocumentProxy.documentContextBeforeInput,
               beforeText.hasSuffix(" ") {
                let textBeforeSpace = String(beforeText.dropLast())
                let charBeforeSpace = textBeforeSpace.last
                
                if charBeforeSpace != " " && charBeforeSpace != "." {
                    textDocumentProxy.deleteBackward()
                    textDocumentProxy.insertText(". ")
                    lastSpaceTime = nil
                    suggestionController.handleSpace()
                    return
                }
            }
        }
        
        textDocumentProxy.insertText(" ")
        lastSpaceTime = now
        suggestionController.handleSpace()
    }
    
    // MARK: - Globe Button
    
    private var lastNeedsInputModeSwitchKey: Bool?
    
    private func updateGlobeButtonVisibility() {
        let shouldShowGlobe = self.needsInputModeSwitchKey
        
        if lastNeedsInputModeSwitchKey != shouldShowGlobe {
            lastNeedsInputModeSwitchKey = shouldShowGlobe
            renderer.setShowGlobeButton(shouldShowGlobe)
        }
    }
    
    // MARK: - Settings
    
    private func openSettings() {
        guard self.hasFullAccess else { return }
        
        preferences.setString(keyboardLanguage, forKey: "launch_keyboard")
        
        guard let url = URL(string: "issieboard://settings?keyboard=\(keyboardLanguage)") else {
            return
        }
        
        openURL(url)
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
            self?.dismissKeyboard()
        }
    }
    
    private func openURL(_ url: URL) {
        var responder: UIResponder? = self
        while responder != nil {
            if let application = responder as? UIApplication {
                application.open(url, options: [:], completionHandler: nil)
                return
            }
            responder = responder?.next
        }
        
        let openURLSelector = NSSelectorFromString("openURL:")
        var target: UIResponder? = self
        while let currentTarget = target {
            if currentTarget.responds(to: openURLSelector) {
                _ = currentTarget.perform(openURLSelector, with: url)
                return
            }
            target = currentTarget.next
        }
        
        if let hostApp = hostAppApplication {
            hostApp.open(url, options: [:], completionHandler: nil)
        }
    }
    
    private var hostAppApplication: UIApplication? {
        var responder: UIResponder? = self.view
        while let r = responder {
            if let app = r as? UIApplication {
                return app
            }
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