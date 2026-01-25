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
        // Re-render keyboard when text input changes (e.g., switching fields)
        // This updates the enter key label
        if parsedConfig != nil {
            renderKeyboard()
        }
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
            keyboardView.heightAnchor.constraint(greaterThanOrEqualToConstant: 300)
        ])
    }
    
    private func setupRenderer() {
        // Create renderer - handles all UI rendering
        renderer = KeyboardRenderer()
        
        // Set up callbacks for key presses - route to system
        renderer.onKeyPress = { [weak self] key in
            self?.handleKeyPress(key)
        }
        
        renderer.onNikkudSelected = { [weak self] value in
            self?.textDocumentProxy.insertText(value)
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
    }
    
    // MARK: - Preferences Management
    
    private func loadPreferences() {
        print("🔄 Loading keyboard preferences...")
        preferences.printAllPreferences()
        
        if let configJSON = preferences.getKeyboardConfigJSON() {
            print("⚙️ Parsing keyboard config...")
            print("   Config length: \(configJSON.count) chars")
            parseKeyboardConfig(configJSON)
        } else {
            print("⚠️ No keyboard config found - using fallback")
            renderFallbackKeyboard()
        }
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
    
    // MARK: - Rendering
    
    private func renderKeyboard() {
        guard let config = parsedConfig else {
            print("❌ No config to render")
            renderFallbackKeyboard()
            return
        }
        
        print("🎨 Rendering keyboard via KeyboardRenderer")
        
        // Get editor context for dynamic enter key
        let editorContext = analyzeEditorContext()
        
        // Use renderer - it handles all UI rendering
        renderer.renderKeyboard(
            in: keyboardView,
            config: config,
            currentKeysetId: renderer.currentKeysetId.isEmpty ? (config.defaultKeyset ?? "abc") : renderer.currentKeysetId,
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
    
    // MARK: - Key Press Handling
    
    private func handleKeyPress(_ key: ParsedKey) {
        print("🔘 Key press received: type=\(key.type), value=\(key.value)")
        
        switch key.type.lowercased() {
        case "backspace":
            textDocumentProxy.deleteBackward()
            
        case "enter", "action":
            textDocumentProxy.insertText("\n")
            
        case "space":
            textDocumentProxy.insertText(" ")
            
        default:
            // Regular character key
            let value = key.value
            if !value.isEmpty {
                textDocumentProxy.insertText(value)
            }
        }
    }
    
    // MARK: - System Keyboard Actions
    
    private func openSettings() {
        print("⚙️ Settings button tapped - attempting to open main app")
        
        // Try to open the main app using a URL scheme
        if let url = URL(string: "issieboard://") {
            extensionContext?.open(url, completionHandler: { success in
                print(success ? "✅ Opened main app" : "⚠️ Could not open app - Full Access may be required")
                if !success {
                    self.dismissKeyboard()
                }
            })
        } else {
            dismissKeyboard()
        }
    }
}