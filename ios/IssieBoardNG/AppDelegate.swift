import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    // Determine which app mode based on bundle identifier
    let bundleId = Bundle.main.bundleIdentifier ?? ""
    print("🔍 Bundle ID: \(bundleId)")
    
    let moduleName = bundleId.contains("IssieVoice") ? "IssieVoice" : "IssieBoardNG"
    print("🎯 Loading module: \(moduleName)")
    
    factory.startReactNative(
      withModuleName: moduleName,
      in: window,
      launchOptions: launchOptions
    )

    return true
  }
  
  // Handle URL scheme for opening app from keyboard extension
  func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    print("📱 App opened via URL scheme: \(url)")

    // Verify this is IssieBoard, not IssieVoice
    let bundleId = Bundle.main.bundleIdentifier ?? ""
    guard !bundleId.contains("IssieVoice") else {
      print("⚠️ IssieVoice ignoring issieboard:// URL - wrong app")
      return false
    }

    // Handle the issieboard:// URL scheme
    if url.scheme == "issieboard" {
      // The app is now open - keyboard extension successfully triggered this
      // You can handle specific paths here if needed, e.g., issieboard://settings
      if url.host == "settings" {
        // Navigate to settings screen if needed
        print("📱 Opening settings from keyboard extension")

        // Extract the keyboard language parameter
        if let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
           let queryItems = components.queryItems,
           let keyboardParam = queryItems.first(where: { $0.name == "keyboard" })?.value {
          print("📱 Keyboard language parameter: \(keyboardParam)")

          // Save it to preferences so React Native can read it
          let preferences = KeyboardPreferences()
          preferences.setString(keyboardParam, forKey: "launch_keyboard")
          print("📱 Saved launch_keyboard preference: \(keyboardParam)")

          // Verify it was saved correctly
          if let readBack = preferences.getString(forKey: "launch_keyboard") {
            print("📱 ✅ Verified launch_keyboard was saved: \(readBack)")
          } else {
            print("📱 ❌ ERROR: launch_keyboard is nil after saving!")
          }

          // Post a Darwin notification to wake up React Native
          CFNotificationCenterPostNotification(
            CFNotificationCenterGetDarwinNotifyCenter(),
            CFNotificationName("com.issieboard.launchKeyboard" as CFString),
            nil,
            nil,
            true
          )
          print("📱 Posted Darwin notification for language switch")
        } else {
          print("📱 ⚠️ No keyboard parameter found in URL")
        }
      }
      return true
    }

    return false
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}