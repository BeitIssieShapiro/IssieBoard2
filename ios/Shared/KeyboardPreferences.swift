import Foundation

/// Shared preferences manager for keyboard configuration
/// Uses App Groups to share data between main app and keyboard extension
class KeyboardPreferences {
    
    // IMPORTANT: This must match the App Group ID configured in Xcode
    // Format: group.<bundle-identifier>
    static let appGroupIdentifier = //"group.com.issieshapiro.issieboard"
    "group.org.issieshapiro.test"
    
    // Keys for storing preferences
    struct Keys {
        static let currentProfile = "currentProfile"
        static let keyboardConfig = "keyboardConfig"
        static let lastUpdateTime = "lastUpdateTime"
        static let selectedLanguage = "selectedLanguage"
    }
    
    // Notification names for observing changes
    static let preferencesDidChangeNotification = NSNotification.Name("KeyboardPreferencesDidChange")
    
    private let userDefaults: UserDefaults?
    
    init() {
        // Use App Group UserDefaults for sharing between app and extension
        self.userDefaults = UserDefaults(suiteName: KeyboardPreferences.appGroupIdentifier)
        
        if userDefaults == nil {
            print("⚠️ Failed to initialize App Group UserDefaults. Make sure App Groups capability is enabled.")
        }
    }
    
    // MARK: - Profile Management
    
    var currentProfile: String? {
        get {
            return userDefaults?.string(forKey: Keys.currentProfile)
        }
        set {
            userDefaults?.set(newValue, forKey: Keys.currentProfile)
            userDefaults?.set(Date().timeIntervalSince1970, forKey: Keys.lastUpdateTime)
            userDefaults?.synchronize()
            notifyPreferencesChanged()
        }
    }
    
    // MARK: - Keyboard Configuration
    
    var keyboardConfig: [String: Any]? {
        get {
            return userDefaults?.dictionary(forKey: Keys.keyboardConfig)
        }
        set {
            userDefaults?.set(newValue, forKey: Keys.keyboardConfig)
            userDefaults?.set(Date().timeIntervalSince1970, forKey: Keys.lastUpdateTime)
            userDefaults?.synchronize()
            notifyPreferencesChanged()
        }
    }
    
    // MARK: - Language Selection
    
    var selectedLanguage: String? {
        get {
            return userDefaults?.string(forKey: Keys.selectedLanguage)
        }
        set {
            userDefaults?.set(newValue, forKey: Keys.selectedLanguage)
            userDefaults?.set(Date().timeIntervalSince1970, forKey: Keys.lastUpdateTime)
            userDefaults?.synchronize()
            notifyPreferencesChanged()
        }
    }
    
    // MARK: - Last Update Time
    
    var lastUpdateTime: TimeInterval {
        return userDefaults?.double(forKey: Keys.lastUpdateTime) ?? 0
    }
    
    // MARK: - JSON Configuration Storage
    
    /// Store keyboard configuration as JSON string
    func setKeyboardConfigJSON(_ jsonString: String) {
        userDefaults?.set(jsonString, forKey: Keys.keyboardConfig)
        userDefaults?.set(Date().timeIntervalSince1970, forKey: Keys.lastUpdateTime)
        userDefaults?.synchronize()
        notifyPreferencesChanged()
    }
    
    /// Retrieve keyboard configuration as JSON string
    func getKeyboardConfigJSON() -> String? {
        return userDefaults?.string(forKey: Keys.keyboardConfig)
    }
    
    /// Store keyboard configuration from Data
    func setKeyboardConfigData(_ data: Data) {
        if let jsonString = String(data: data, encoding: .utf8) {
            setKeyboardConfigJSON(jsonString)
        }
    }
    
    /// Retrieve keyboard configuration as Data
    func getKeyboardConfigData() -> Data? {
        guard let jsonString = getKeyboardConfigJSON() else { return nil }
        return jsonString.data(using: .utf8)
    }
    
    // MARK: - Profile Storage
    
    /// Store profile configuration as JSON string
    func setProfileJSON(_ jsonString: String, forKey key: String) {
        userDefaults?.set(jsonString, forKey: "profile_\(key)")
        userDefaults?.synchronize()
    }
    
    /// Retrieve profile configuration as JSON string
    func getProfileJSON(forKey key: String) -> String? {
        return userDefaults?.string(forKey: "profile_\(key)")
    }
    
    // MARK: - Notification
    
    private func notifyPreferencesChanged() {
        // Post notification on main thread
        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: KeyboardPreferences.preferencesDidChangeNotification,
                object: nil,
                userInfo: [
                    "timestamp": Date().timeIntervalSince1970,
                    "profile": self.currentProfile ?? "",
                    "language": self.selectedLanguage ?? ""
                ]
            )
        }
    }
    
    // MARK: - Debugging
    
    func printAllPreferences() {
        print("📱 Keyboard Preferences:")
        print("  App Group: \(KeyboardPreferences.appGroupIdentifier)")
        print("  Current Profile: \(currentProfile ?? "none")")
        print("  Selected Language: \(selectedLanguage ?? "none")")
        print("  Last Update: \(Date(timeIntervalSince1970: lastUpdateTime))")
        
        if let config = keyboardConfig {
            print("  Config Keys: \(config.keys)")
        }
    }
    
    // MARK: - Clear Preferences
    
    func clearAll() {
        // Remove all keys from the App Group UserDefaults
        guard let defaults = userDefaults else { return }
        
        // Get all keys and remove them
        let dictionary = defaults.dictionaryRepresentation()
        for key in dictionary.keys {
            defaults.removeObject(forKey: key)
        }
        
        defaults.synchronize()
        notifyPreferencesChanged()
        
        print("🗑️ Cleared all \(dictionary.keys.count) preference keys")
    }
}

// MARK: - Preference Observer

/// Observer class for monitoring preference changes in keyboard extension
class KeyboardPreferenceObserver {
    
    private var lastKnownUpdateTime: TimeInterval = 0
    private var checkTimer: Timer?
    private let preferences: KeyboardPreferences
    private let onChange: () -> Void
    
    init(preferences: KeyboardPreferences, onChange: @escaping () -> Void) {
        self.preferences = preferences
        self.onChange = onChange
        self.lastKnownUpdateTime = preferences.lastUpdateTime
    }
    
    /// Start polling for changes (keyboard extensions can't use Darwin notifications)
    func startObserving(interval: TimeInterval = 0.5) {
        stopObserving()
        
        checkTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            self?.checkForChanges()
        }
    }
    
    /// Stop polling for changes
    func stopObserving() {
        checkTimer?.invalidate()
        checkTimer = nil
    }
    
    private func checkForChanges() {
        let currentUpdateTime = preferences.lastUpdateTime
        
        if currentUpdateTime > lastKnownUpdateTime {
            lastKnownUpdateTime = currentUpdateTime
            
            print("🔄 Keyboard preferences changed at \(Date(timeIntervalSince1970: currentUpdateTime))")
            preferences.printAllPreferences()
            
            onChange()
        }
    }
    
    deinit {
        stopObserving()
    }
}
