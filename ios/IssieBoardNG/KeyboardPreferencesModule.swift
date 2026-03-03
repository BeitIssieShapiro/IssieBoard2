import Foundation
import React

@objc(KeyboardPreferencesModule)
class KeyboardPreferencesModule: RCTEventEmitter {

    private let preferences = KeyboardPreferences()

    override init() {
        super.init()

        print("📐 [KeyboardPreferencesModule] Initializing...")

        // Listen for Darwin notification from keyboard extension
        let observer = UnsafeRawPointer(Unmanaged.passUnretained(self).toOpaque())
        CFNotificationCenterAddObserver(
            CFNotificationCenterGetDarwinNotifyCenter(),
            observer,
            { (center, observer, name, object, userInfo) in
                print("📐 [KeyboardPreferencesModule] Darwin notification callback triggered!")
                guard let observer = observer else { return }
                let mySelf = Unmanaged<KeyboardPreferencesModule>.fromOpaque(observer).takeUnretainedValue()
                mySelf.handleDarwinNotification()
            },
            "com.issieboard.dimensionsChanged" as CFString,
            nil,
            .deliverImmediately
        )
        print("📐 [KeyboardPreferencesModule] Darwin observer registered")

        // Also listen for regular notifications (in-process)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleDimensionsChanged(_:)),
            name: KeyboardPreferences.keyboardDimensionsDidChangeNotification,
            object: nil
        )
        print("📐 [KeyboardPreferencesModule] Regular notification observer registered")
    }

    deinit {
        print("📐 [KeyboardPreferencesModule] Deinitializing...")
        CFNotificationCenterRemoveEveryObserver(
            CFNotificationCenterGetDarwinNotifyCenter(),
            UnsafeRawPointer(Unmanaged.passUnretained(self).toOpaque())
        )
        NotificationCenter.default.removeObserver(self)
    }

    @objc private func handleDarwinNotification() {
        print("📐 [KeyboardPreferencesModule] handleDarwinNotification called!")
        // Darwin notifications don't carry userInfo, so fetch from preferences
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            print("📐 [KeyboardPreferencesModule] Fetching dimensions from preferences...")
            if let dimensionsJSON = self.preferences.getKeyboardDimensionsJSON() {
                print("📐 [KeyboardPreferencesModule] Got dimensions JSON: \(dimensionsJSON)")
                if let data = dimensionsJSON.data(using: .utf8),
                   let dimensions = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    print("📐 [KeyboardPreferencesModule] Sending event to React Native: \(dimensions)")
                    self.sendEvent(withName: "onKeyboardDimensionsChanged", body: dimensions)
                    print("📐 [KeyboardPreferencesModule] Event sent!")
                } else {
                    print("📐 [KeyboardPreferencesModule] Failed to parse dimensions JSON")
                }
            } else {
                print("📐 [KeyboardPreferencesModule] No dimensions JSON available")
            }
        }
    }

    @objc private func handleDimensionsChanged(_ notification: Notification) {
        print("📐 [KeyboardPreferencesModule] handleDimensionsChanged (regular notification) called!")
        if let dimensions = notification.userInfo {
            print("📐 [KeyboardPreferencesModule] Sending event to React Native (from regular notification): \(dimensions)")
            sendEvent(withName: "onKeyboardDimensionsChanged", body: dimensions)
        }
    }

    override static func requiresMainQueueSetup() -> Bool {
        return false
    }

    override func supportedEvents() -> [String]! {
        return ["onKeyboardDimensionsChanged"]
    }

    // MARK: - Profile Management
    
    @objc
    func setCurrentProfile(_ profile: String, resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
        preferences.currentProfile = profile
        resolver(["success": true, "profile": profile])
    }
    
    @objc
    func getCurrentProfile(_ resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
        if let profile = preferences.currentProfile {
            resolver(profile)
        } else {
            resolver(NSNull())
        }
    }
    
    // MARK: - Language Management
    
    @objc
    func setSelectedLanguage(_ language: String, resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
        preferences.selectedLanguage = language
        resolver(["success": true, "language": language])
    }
    
    @objc
    func getSelectedLanguage(_ resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
        if let language = preferences.selectedLanguage {
            resolver(language)
        } else {
            resolver(NSNull())
        }
    }
    
    // MARK: - Keyboard Configuration
    
    @objc
    func setKeyboardConfig(_ configJSON: String, resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
        preferences.setKeyboardConfigJSON(configJSON)
        
        print("📝 Keyboard config saved from React Native")
        print("   Length: \(configJSON.count) characters")
        print("   Preview: \(configJSON.prefix(100))...")
        
        resolver([
            "success": true,
            "timestamp": Date().timeIntervalSince1970,
            "length": configJSON.count
        ])
    }
    
    @objc
    func getKeyboardConfig(_ resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
        if let configJSON = preferences.getKeyboardConfigJSON() {
            resolver(configJSON)
        } else {
            resolver(NSNull())
        }
    }
    
    // MARK: - Profile Storage
    
    @objc
    func setProfile(_ profileJSON: String, forKey key: String, resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
        preferences.setProfileJSON(profileJSON, forKey: key)
        resolver(["success": true, "key": key])
    }
    
    @objc
    func getProfile(_ key: String, resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
        if let profileJSON = preferences.getProfileJSON(forKey: key) {
            resolver(profileJSON)
        } else {
            resolver(NSNull())
        }
    }
    
    // MARK: - Generic String Storage (no prefix)
    
    @objc
    func setString(_ value: String, forKey key: String, resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
        preferences.setString(value, forKey: key)
        print("📝 String saved from React Native: key=\(key), length=\(value.count)")
        resolver(["success": true, "key": key])
    }
    
    @objc
    func getString(_ key: String, resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
        if let value = preferences.getString(forKey: key) {
            resolver(value)
        } else {
            resolver(NSNull())
        }
    }
    
    // MARK: - Debugging
    
    @objc
    func printAllPreferences(_ resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
        preferences.printAllPreferences()
        
        let info: [String: Any] = [
            "appGroup": KeyboardPreferences.appGroupIdentifier,
            "currentProfile": preferences.currentProfile ?? NSNull(),
            "selectedLanguage": preferences.selectedLanguage ?? NSNull(),
            "lastUpdateTime": preferences.lastUpdateTime,
            "hasConfig": preferences.getKeyboardConfigJSON() != nil
        ]
        
        resolver(info)
    }
    
    @objc
    func clearAll(_ resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
        preferences.clearAll()
        resolver(["success": true])
    }
    
    // MARK: - App Group Info

    @objc
    func getAppGroupIdentifier(_ resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
        resolver(KeyboardPreferences.appGroupIdentifier)
    }

    // MARK: - Keyboard Dimensions

    @objc
    func getKeyboardDimensions(_ resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
        if let dimensionsJSON = preferences.getKeyboardDimensionsJSON() {
            resolver(dimensionsJSON)
        } else {
            resolver(NSNull())
        }
    }
}
