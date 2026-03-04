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

    // Keyboard engine - handles all keyboard logic
    private var keyboardEngine: KeyboardEngine!

    // Parsed config
    private var parsedConfig: KeyboardConfig?
    
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
        
        // Enable system dictation key
        // On iPad, this shows the microphone in the Shortcut Bar (grey bar above keyboard)
        // On iPhone, this may show in the keyboard if space allows
        // Note: We cannot programmatically trigger system dictation from our custom button
        // but this enables users to access dictation through iOS's built-in mechanism
        self.hasDictationKey = false
        
        setupKeyboard()
        setupKeyboardEngine()
        loadPreferences()
        startObservingPreferences()
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        let assistant = self.inputAssistantItem
        assistant.leadingBarButtonGroups = []
        assistant.trailingBarButtonGroups = []

        loadPreferences()
        keyboardEngine.updateSuggestions()

        // Apply auto-shift if at beginning of sentence
        keyboardEngine.autoShiftAfterPunctuation()
    }
    
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        updateGlobeButtonVisibility()
        if parsedConfig != nil {
            keyboardEngine.renderer.rerenderIfNeeded()
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

        // Skip suggestion detection if in cursor movement mode
        if !keyboardEngine.renderer.isInCursorMoveMode() {
            keyboardEngine.handleTextChanged()
        }

        // Check if we should auto-shift after text change (e.g., after paste, autocorrect, external keyboard)
        // But skip if text is empty and shift is already active (avoid loops)
        let beforeText = textDocumentProxy.documentContextBeforeInput ?? ""
        if beforeText.isEmpty && keyboardEngine.renderer.isShiftActive() {
            debugLog("📝 textDidChange: Text empty and shift already active, skipping auto-shift check")
            return
        }

        debugLog("📝 textDidChange called, checking auto-shift")
        keyboardEngine.autoShiftAfterPunctuation()
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

        // Determine if suggestions should be shown based on config and input type
        let shouldDisable = shouldDisableSuggestionsForKeyboardType()
        let suggestionsEnabled = config.isWordSuggestionsEnabled && !shouldDisable

        let requiredHeight = keyboardEngine.renderer.calculateKeyboardHeight(for: config, keysetId: keyboardEngine.renderer.currentKeysetId, suggestionsEnabled: suggestionsEnabled)
        keyboardHeightConstraint?.constant = requiredHeight
        view.setNeedsLayout()
    }
    
    private func setupKeyboardEngine() {
        // Create keyboard engine with system text proxy
        let systemProxy = SystemTextDocumentProxy(proxy: textDocumentProxy)
        keyboardEngine = KeyboardEngine(textProxy: systemProxy, language: keyboardLanguage)

        // Set up engine callbacks
        keyboardEngine.onNextKeyboard = { [weak self] in
            self?.advanceToNextInputMode()
        }

        keyboardEngine.onShowKeyboardList = { [weak self] button, gesture in
            self?.showKeyboardList(from: button, with: gesture)
        }

        keyboardEngine.onDismissKeyboard = { [weak self] in
            self?.dismissKeyboard()
        }

        keyboardEngine.onOpenSettings = { [weak self] in
            self?.openSettings()
        }

        keyboardEngine.onKeysetChanged = { [weak self] keysetId in
            self?.saveCurrentKeyset(keysetId)
        }

        keyboardEngine.onGetTextDirection = { [weak self] in
            return self?.getTextDirectionAtCursor() ?? false
        }

        keyboardEngine.getCurrentText = { [weak self] in
            return self?.textDocumentProxy.documentContextBeforeInput ?? ""
        }

        keyboardEngine.onRenderKeyboard = { [weak self] in
            self?.renderKeyboard()
        }

        // Configure renderer
        keyboardEngine.renderer.setShowGlobeButton(self.needsInputModeSwitchKey)
    }
    
    
    /// Detect the actual text direction at the cursor position
    /// Returns true if RTL (Hebrew/Arabic), false if LTR (English/numbers)
    /// This analyzes the actual text rather than just keyboard language
    private func getTextDirectionAtCursor() -> Bool {
        // Get text before cursor
        guard let beforeText = textDocumentProxy.documentContextBeforeInput,
              !beforeText.isEmpty else {
            // No text - fall back to keyboard language
            return keyboardLanguage == "he" || keyboardLanguage == "ar"
        }
        
        // Check the last character before cursor
        if let lastChar = beforeText.last {
            // Hebrew Unicode range: U+0590 to U+05FF
            // Arabic Unicode range: U+0600 to U+06FF
            let unicodeValue = lastChar.unicodeScalars.first?.value ?? 0
            
            if (unicodeValue >= 0x0590 && unicodeValue <= 0x05FF) || // Hebrew
               (unicodeValue >= 0x0600 && unicodeValue <= 0x06FF) {  // Arabic
                return true  // RTL
            } else if lastChar.isLetter || lastChar.isNumber {
                return false // LTR
            }
        }
        
        // Fall back to keyboard language
        return keyboardLanguage == "he" || keyboardLanguage == "ar"
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
            print("⚙️ [ConfigLoad] Successfully decoded config")
            print("⚙️ [ConfigLoad] fontSize: \(parsedConfig?.fontSize ?? nil)")
            print("⚙️ [ConfigLoad] fontName: \(parsedConfig?.fontName ?? "nil")")
            print("⚙️ [ConfigLoad] fontWeight: \(parsedConfig?.fontWeight ?? "nil")")
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

        keyboardEngine.suggestionController.setEnabled(suggestionsEnabled)
        keyboardEngine.suggestionController.setAutoCorrectEnabled(config.isAutoCorrectEnabled)
        keyboardEngine.renderer.setWordSuggestionsEnabled(suggestionsEnabled)

        let editorContext = analyzeEditorContext()

        var initialKeyset: String
        if !keyboardEngine.renderer.currentKeysetId.isEmpty && keyboardEngine.renderer.currentKeysetId != "abc" {
            initialKeyset = keyboardEngine.renderer.currentKeysetId
        } else if let savedKeyset = loadSavedKeyset() {
            initialKeyset = savedKeyset
        } else {
            initialKeyset = config.defaultKeyset ?? "abc"
        }

        keyboardEngine.renderer.renderKeyboard(
            in: keyboardView,
            config: config,
            currentKeysetId: initialKeyset,
            editorContext: editorContext
        )

        updateKeyboardHeight()

        // Show default suggestions only if enabled for this field type
        if suggestionsEnabled && keyboardEngine.suggestionController.currentWord.isEmpty {
            keyboardEngine.suggestionController.showDefaults()
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
    
    private func analyzeEditorContext() -> (enterVisible: Bool, enterLabel: String, enterAction: Int, fieldType: String) {
        let returnKeyType = textDocumentProxy.returnKeyType ?? .default
        let keyboardType = textDocumentProxy.keyboardType ?? .default
        
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
        
        // Determine field type for key filtering
        let fieldType: String
        if #available(iOS 10.0, *) {
            if let contentType = textDocumentProxy.textContentType?.rawValue {
                switch contentType {
                case "emailAddress":
                    fieldType = "email"
                case "URL":
                    fieldType = "url"
                case "username":
                    fieldType = "username"
                default:
                    fieldType = getFieldTypeFromKeyboardType(keyboardType)
                }
            } else {
                fieldType = getFieldTypeFromKeyboardType(keyboardType)
            }
        } else {
            fieldType = getFieldTypeFromKeyboardType(keyboardType)
        }
        
        return (true, enterLabel, returnKeyType.rawValue, fieldType)
    }
    
    private func getFieldTypeFromKeyboardType(_ keyboardType: UIKeyboardType) -> String {
        switch keyboardType {
        case .emailAddress:
            return "email"
        case .URL:
            return "url"
        case .phonePad:
            return "phone"
        case .numberPad, .decimalPad, .numbersAndPunctuation:
            return "number"
        case .webSearch:
            return "search"
        default:
            return "default"
        }
    }
    
    private func shouldDisableSuggestionsForKeyboardType() -> Bool {
        let keyboardType = textDocumentProxy.keyboardType ?? .default
        let returnKeyType = textDocumentProxy.returnKeyType ?? .default
        
        debugLog("🔍 Keyboard type detected: \(keyboardType.rawValue)")
        debugLog("🔍 Return key type detected: \(returnKeyType.rawValue)")
        
        // Check textContentType for more reliable detection
        if #available(iOS 10.0, *) {
            let contentType = textDocumentProxy.textContentType?.rawValue ?? "none"
            debugLog("🔍 Text content type: \(contentType)")
            
            // Disable for URL-related content types
            if contentType == "URL" || contentType == "username" || contentType == "emailAddress" {
                debugLog("🔍 Should disable suggestions: true (content type)")
                return true
            }
        }
        
        // Check return key type - search fields typically use .search or .google
        if returnKeyType == .search || returnKeyType == .google {
            debugLog("🔍 Should disable suggestions: true (search field)")
            return true
        }
        
        switch keyboardType {
        case .URL, .emailAddress, .webSearch, .numberPad, .phonePad, .decimalPad, 
             .numbersAndPunctuation, .asciiCapableNumberPad:
            debugLog("🔍 Should disable suggestions: true (keyboard type)")
            return true
        default:
            debugLog("🔍 Should disable suggestions: false")
            return false
        }
    }
    
    // MARK: - Auto Behaviors

    /// Auto-return from special characters keyboard (123/#+=) to main keyboard (abc) after space
    /// Behavior 2: If user is on 123 or #+= keyboard, return to abc after typing special char + space
    private func autoReturnFromSpecialChars() {
        guard let config = parsedConfig else { return }
        keyboardEngine.autoReturnFromSpecialChars(config: config)
    }
    
    // MARK: - Globe Button
    
    private var lastNeedsInputModeSwitchKey: Bool?
    
    private func updateGlobeButtonVisibility() {
        let shouldShowGlobe = self.needsInputModeSwitchKey

        if lastNeedsInputModeSwitchKey != shouldShowGlobe {
            lastNeedsInputModeSwitchKey = shouldShowGlobe
            keyboardEngine.renderer.setShowGlobeButton(shouldShowGlobe)
        }
    }

    /// Show the system keyboard picker list
    /// Called when the globe button is long-pressed
    private func showKeyboardList(from button: UIView, with gesture: UILongPressGestureRecognizer) {
        // iOS doesn't provide a direct public API to show the keyboard picker programmatically
        // As a workaround, we advance to the next keyboard (same as a tap)
        // In the future, we could implement a custom keyboard picker UI
        self.advanceToNextInputMode()

        // Alternative: You could implement a custom keyboard picker here
        // showing all available keyboards from UserDefaults "AppleKeyboards"
    }

    // MARK: - Settings

    private func openSettings() {
        guard self.hasFullAccess else {
            // Show a banner message explaining Full Access is required
            showFullAccessRequiredBanner()
            return
        }

        preferences.setString(keyboardLanguage, forKey: "launch_keyboard")

        guard let url = URL(string: "issieboard://settings?keyboard=\(keyboardLanguage)") else {
            return
        }

        openURL(url)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
            self?.dismissKeyboard()
        }
    }

    private func showFullAccessRequiredBanner() {
        // Create a semi-transparent banner overlay
        let bannerView = UIView()
        bannerView.backgroundColor = UIColor.black.withAlphaComponent(0.9)
        bannerView.layer.cornerRadius = 8
        view.addSubview(bannerView)

        bannerView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            bannerView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            bannerView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            bannerView.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 20),
            bannerView.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -20),
            bannerView.widthAnchor.constraint(lessThanOrEqualToConstant: 400)
        ])

        // Create message label
        let messageLabel = UILabel()
        messageLabel.text = "Full Access Required\n\nTo open settings, enable Full Access in:\nSettings → General → Keyboard → Keyboards → IssieBoard"
        messageLabel.textColor = .white
        messageLabel.font = UIFont.systemFont(ofSize: 16, weight: .medium)
        messageLabel.numberOfLines = 0
        messageLabel.textAlignment = .center
        bannerView.addSubview(messageLabel)

        messageLabel.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            messageLabel.topAnchor.constraint(equalTo: bannerView.topAnchor, constant: 20),
            messageLabel.leadingAnchor.constraint(equalTo: bannerView.leadingAnchor, constant: 20),
            messageLabel.trailingAnchor.constraint(equalTo: bannerView.trailingAnchor, constant: -20),
            messageLabel.bottomAnchor.constraint(equalTo: bannerView.bottomAnchor, constant: -20)
        ])

        // Animate in
        bannerView.alpha = 0
        bannerView.transform = CGAffineTransform(scaleX: 0.8, y: 0.8)

        UIView.animate(withDuration: 0.3, animations: {
            bannerView.alpha = 1
            bannerView.transform = .identity
        }) { _ in
            // Auto-dismiss after 4 seconds
            DispatchQueue.main.asyncAfter(deadline: .now() + 4.0) {
                UIView.animate(withDuration: 0.3, animations: {
                    bannerView.alpha = 0
                    bannerView.transform = CGAffineTransform(scaleX: 0.8, y: 0.8)
                }) { _ in
                    bannerView.removeFromSuperview()
                }
            }
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
