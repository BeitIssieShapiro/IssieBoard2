import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import RNFBAppCheck
import FirebaseCore

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

    V1Migration().migrateIfNeeded()

    RNFBAppCheckModule.sharedInstance()
    FirebaseApp.configure()

    window = UIWindow(frame: UIScreen.main.bounds)

    // Determine which app mode based on bundle identifier
    let bundleId = Bundle.main.bundleIdentifier ?? ""
    print("🔍 Bundle ID: \(bundleId)")
    
    let moduleName = bundleId.contains("IssieVoice") ? "IssieVoice" : "IssieBoardNG"
    print("🎯 Loading module: \(moduleName)")
    
    // Extract and prepare initial URL if app was opened via file
    var initialProps: [AnyHashable: Any] = [:]
    if let url = launchOptions?[.url] as? URL,
       url.isFileURL,
       let tempURL = securelyCopyToTemp(url: url) {
      initialProps["url"] = tempURL.absoluteString
    }

    factory.startReactNative(
      withModuleName: moduleName,
      in: window,
      initialProperties: initialProps.isEmpty ? nil : initialProps,
      launchOptions: launchOptions
    )

    return true
  }
  
  // Handle URL scheme for opening app from keyboard extension or file import
  func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    print("App opened via URL: \(url)")

    // Handle issieboard:// URL scheme (existing keyboard extension logic)
    if url.scheme == "issieboard" {
      let bundleId = Bundle.main.bundleIdentifier ?? ""
      guard !bundleId.contains("IssieVoice") else {
        return false
      }

      if url.host == "settings" {
        if let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
           let queryItems = components.queryItems,
           let keyboardParam = queryItems.first(where: { $0.name == "keyboard" })?.value {
          let preferences = KeyboardPreferences()
          preferences.setString(keyboardParam, forKey: "launch_keyboard")
          CFNotificationCenterPostNotification(
            CFNotificationCenterGetDarwinNotifyCenter(),
            CFNotificationName("com.issieboard.launchKeyboard" as CFString),
            nil, nil, true
          )
        }
      }
      return true
    }

    // Handle file URLs (import from share/open-with)
    if url.isFileURL {
      guard let tempURL = securelyCopyToTemp(url: url) else { return false }
      return RCTLinkingManager.application(app, open: tempURL, options: options)
    }

    return false
  }

  private func securelyCopyToTemp(url: URL) -> URL? {
    let hasAccess = url.startAccessingSecurityScopedResource()
    defer {
      if hasAccess {
        url.stopAccessingSecurityScopedResource()
      }
    }

    do {
      let fileName = url.lastPathComponent.removingPercentEncoding ?? url.lastPathComponent
      let sanitizedFileName = fileName.replacingOccurrences(of: "/", with: "-")
      let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(sanitizedFileName)

      if FileManager.default.fileExists(atPath: tempURL.path) {
        try FileManager.default.removeItem(at: tempURL)
      }

      try FileManager.default.copyItem(at: url, to: tempURL)
      print("File copied to temp: \(tempURL.path)")
      return tempURL
    } catch {
      print("Error copying file to temp: \(error)")
      return nil
    }
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