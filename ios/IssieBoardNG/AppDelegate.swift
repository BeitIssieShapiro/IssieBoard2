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
    
    // Handle the issieboard:// URL scheme
    if url.scheme == "issieboard" {
      // The app is now open - keyboard extension successfully triggered this
      // You can handle specific paths here if needed, e.g., issieboard://settings
      if url.host == "settings" {
        // Navigate to settings screen if needed
        print("📱 Opening settings from keyboard extension")
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