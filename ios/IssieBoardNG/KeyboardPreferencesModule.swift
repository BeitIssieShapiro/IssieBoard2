import Foundation
import React

@objc(KeyboardPreferencesModule)
class KeyboardPreferencesModule: NSObject {
    
    private let preferences = KeyboardPreferences()
    
    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
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
}
