import UIKit

class KeyboardViewController: UIInputViewController {
    
    var keyboardView: UIView!
    private let preferences = KeyboardPreferences()
    private var preferenceObserver: KeyboardPreferenceObserver?
    private var timestampLabel: UILabel?
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Load initial preferences
        loadPreferences()
        
        // Setup keyboard UI
        setupKeyboard()
        
        // Start observing preference changes
        startObservingPreferences()
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        // Refresh preferences when keyboard appears
        loadPreferences()
    }
    
    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        // Stop observing when keyboard is dismissed
        stopObservingPreferences()
    }
    
    // MARK: - Preferences Management
    
    func loadPreferences() {
        print("🔄 Loading keyboard preferences...")
        preferences.printAllPreferences()
        
        // Update timestamp display immediately
        updateTimestamp()
        
        // Load current configuration
        if let profile = preferences.currentProfile {
            print("📋 Current profile: \(profile)")
        }
        
        if let language = preferences.selectedLanguage {
            print("🌐 Selected language: \(language)")
        }
        
        if let configJSON = preferences.getKeyboardConfigJSON() {
            print("⚙️ Keyboard config loaded: \(configJSON.prefix(100))...")
            // TODO: Parse and apply keyboard configuration
        }
    }
    
    func startObservingPreferences() {
        preferenceObserver = KeyboardPreferenceObserver(preferences: preferences) { [weak self] in
            // This closure is called when preferences change
            print("🔔 Preferences changed! Reloading keyboard...")
            self?.loadPreferences()
            self?.updateKeyboardLayout()
        }
        
        // Start polling for changes every 0.5 seconds
        preferenceObserver?.startObserving(interval: 0.5)
        print("👁️ Started observing preference changes")
    }
    
    func stopObservingPreferences() {
        preferenceObserver?.stopObserving()
        preferenceObserver = nil
        print("🛑 Stopped observing preference changes")
    }
    
    func updateKeyboardLayout() {
        // TODO: Rebuild keyboard layout based on new preferences
        print("🔄 Updating keyboard layout...")
        
        // Update timestamp display
        updateTimestamp()
        
        // Show visual feedback that preferences changed
        showChangeNotification()
        
        // For now, just log that we would update
        // In future, this will:
        // 1. Parse the JSON configuration
        // 2. Rebuild the key buttons
        // 3. Update language-specific layouts
    }
    
    func formatTimestamp(_ timeInterval: TimeInterval) -> String {
        if timeInterval == 0 {
            return "No sync"
        }
        let date = Date(timeIntervalSince1970: timeInterval)
        let formatter = DateFormatter()
        formatter.timeStyle = .medium
        formatter.dateStyle = .none
        return formatter.string(from: date)
    }
    
    func updateTimestamp() {
        let timestamp = preferences.lastUpdateTime
        timestampLabel?.text = formatTimestamp(timestamp)
        
        // Briefly highlight the timestamp
        timestampLabel?.textColor = .systemGreen
        UIView.animate(withDuration: 0.5, delay: 1.0, options: [], animations: {
            self.timestampLabel?.textColor = .systemGray
        })
    }
    
    func showChangeNotification() {
        // Create a temporary label to show preferences changed
        let notification = UILabel(frame: CGRect(x: 0, y: 0, width: 200, height: 30))
        notification.center = CGPoint(x: keyboardView.bounds.width / 2, y: 30)
        notification.text = "⚙️ Preferences Updated"
        notification.textAlignment = .center
        notification.backgroundColor = UIColor.systemGreen.withAlphaComponent(0.9)
        notification.textColor = .white
        notification.font = UIFont.boldSystemFont(ofSize: 14)
        notification.layer.cornerRadius = 15
        notification.clipsToBounds = true
        notification.alpha = 0
        
        keyboardView.addSubview(notification)
        
        // Animate in, hold, then fade out
        UIView.animate(withDuration: 0.3, animations: {
            notification.alpha = 1.0
        }) { _ in
            UIView.animate(withDuration: 0.3, delay: 1.5, options: [], animations: {
                notification.alpha = 0
            }) { _ in
                notification.removeFromSuperview()
            }
        }
    }
    
    // MARK: - Keyboard Setup
    
    func setupKeyboard() {
        // Create the keyboard view
        keyboardView = UIView(frame: CGRect(x: 0, y: 0, width: 0, height: 300))
        keyboardView.backgroundColor = .systemGray5
        
        // Create a simple button grid
        createSimpleKeyboard()
        
        view.addSubview(keyboardView)
        
        // Setup constraints
        keyboardView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            keyboardView.leftAnchor.constraint(equalTo: view.leftAnchor),
            keyboardView.rightAnchor.constraint(equalTo: view.rightAnchor),
            keyboardView.topAnchor.constraint(equalTo: view.topAnchor),
            keyboardView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            keyboardView.heightAnchor.constraint(equalToConstant: 300)
        ])
    }
    
    func createSimpleKeyboard() {
        let rows = [
            ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
            ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
            ["Z", "X", "C", "V", "B", "N", "M"]
        ]
        
        let buttonHeight: CGFloat = 45
        let buttonSpacing: CGFloat = 6
        let sideMargin: CGFloat = 3
        let topMargin: CGFloat = 10
        
        for (rowIndex, row) in rows.enumerated() {
            let rowView = UIView()
            keyboardView.addSubview(rowView)
            
            rowView.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([
                rowView.topAnchor.constraint(equalTo: keyboardView.topAnchor, constant: topMargin + CGFloat(rowIndex) * (buttonHeight + buttonSpacing)),
                rowView.centerXAnchor.constraint(equalTo: keyboardView.centerXAnchor),
                rowView.heightAnchor.constraint(equalToConstant: buttonHeight)
            ])
            
            let rowWidth = CGFloat(row.count) * (buttonHeight + buttonSpacing) - buttonSpacing
            rowView.widthAnchor.constraint(equalToConstant: rowWidth).isActive = true
            
            for (buttonIndex, letter) in row.enumerated() {
                let button = createKeyButton(letter: letter)
                rowView.addSubview(button)
                
                button.translatesAutoresizingMaskIntoConstraints = false
                NSLayoutConstraint.activate([
                    button.leftAnchor.constraint(equalTo: rowView.leftAnchor, constant: CGFloat(buttonIndex) * (buttonHeight + buttonSpacing)),
                    button.topAnchor.constraint(equalTo: rowView.topAnchor),
                    button.widthAnchor.constraint(equalToConstant: buttonHeight),
                    button.heightAnchor.constraint(equalToConstant: buttonHeight)
                ])
            }
        }
        
        // Add space bar
        let spaceBar = createKeyButton(letter: "space")
        spaceBar.setTitle("space", for: .normal)
        keyboardView.addSubview(spaceBar)
        
        spaceBar.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            spaceBar.centerXAnchor.constraint(equalTo: keyboardView.centerXAnchor),
            spaceBar.topAnchor.constraint(equalTo: keyboardView.topAnchor, constant: topMargin + 3 * (buttonHeight + buttonSpacing)),
            spaceBar.widthAnchor.constraint(equalToConstant: 200),
            spaceBar.heightAnchor.constraint(equalToConstant: buttonHeight)
        ])
        
        // Add delete button
        let deleteButton = createKeyButton(letter: "⌫")
        keyboardView.addSubview(deleteButton)
        
        deleteButton.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            deleteButton.rightAnchor.constraint(equalTo: keyboardView.rightAnchor, constant: -sideMargin),
            deleteButton.topAnchor.constraint(equalTo: keyboardView.topAnchor, constant: topMargin + 2 * (buttonHeight + buttonSpacing)),
            deleteButton.widthAnchor.constraint(equalToConstant: 60),
            deleteButton.heightAnchor.constraint(equalToConstant: buttonHeight)
        ])
        
        // Add keyboard switch button with timestamp
        let nextKeyboardButton = createKeyButton(letter: "🌐")
        keyboardView.addSubview(nextKeyboardButton)
        
        nextKeyboardButton.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            nextKeyboardButton.leftAnchor.constraint(equalTo: keyboardView.leftAnchor, constant: sideMargin),
            nextKeyboardButton.topAnchor.constraint(equalTo: keyboardView.topAnchor, constant: topMargin + 3 * (buttonHeight + buttonSpacing)),
            nextKeyboardButton.widthAnchor.constraint(equalToConstant: 50),
            nextKeyboardButton.heightAnchor.constraint(equalToConstant: buttonHeight)
        ])
        
        // Add timestamp label
        timestampLabel = UILabel()
        timestampLabel?.font = UIFont.systemFont(ofSize: 8)
        timestampLabel?.textColor = .systemGray
        timestampLabel?.textAlignment = .center
        timestampLabel?.text = formatTimestamp(preferences.lastUpdateTime)
        keyboardView.addSubview(timestampLabel!)
        
        timestampLabel?.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            timestampLabel!.centerXAnchor.constraint(equalTo: nextKeyboardButton.centerXAnchor),
            timestampLabel!.topAnchor.constraint(equalTo: nextKeyboardButton.bottomAnchor, constant: 2),
            timestampLabel!.widthAnchor.constraint(equalToConstant: 50)
        ])
    }
    
    func createKeyButton(letter: String) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(letter, for: .normal)
        button.backgroundColor = .white
        button.setTitleColor(.black, for: .normal)
        button.layer.cornerRadius = 5
        button.layer.shadowColor = UIColor.black.cgColor
        button.layer.shadowOffset = CGSize(width: 0, height: 1)
        button.layer.shadowOpacity = 0.3
        button.layer.shadowRadius = 0
        button.titleLabel?.font = UIFont.systemFont(ofSize: 20, weight: .regular)
        button.addTarget(self, action: #selector(keyPressed(_:)), for: .touchUpInside)
        return button
    }
    
    @objc func keyPressed(_ sender: UIButton) {
        guard let key = sender.title(for: .normal) else { return }
        
        switch key {
        case "⌫":
            textDocumentProxy.deleteBackward()
        case "space":
            textDocumentProxy.insertText(" ")
        case "🌐":
            advanceToNextInputMode()
        default:
            textDocumentProxy.insertText(key.lowercased())
        }
    }
    
    override func textWillChange(_ textInput: UITextInput?) {
        // Called when the text is about to change
    }
    
    override func textDidChange(_ textInput: UITextInput?) {
        // Called when the text has changed
    }
    
    deinit {
        stopObservingPreferences()
    }
}
