import UIKit
import React
import React_RCTAppDelegate

/**
 * Owns the app's window under the UIKit scene-based life cycle, which the iOS 27
 * SDK requires — apps that only implement the legacy UIApplicationDelegate launch
 * path are terminated at startup ("UIScene life cycle is required for apps built
 * with this SDK").
 *
 * The React Native factory itself is life-cycle agnostic: it only needs a window
 * to mount into, so window creation and `startReactNative` moved here from
 * AppDelegate while the factory is still built there.
 *
 * URL handling also moves here. Under the scene life cycle UIKit no longer calls
 * `application(_:open:options:)`, so the `issieboard://` scheme and file imports
 * are handled by the scene callbacks below and forwarded to RCTLinkingManager —
 * that is what keeps `Linking.getInitialURL()` and `Linking.addEventListener`
 * working in JS.
 */
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else { return }

    let window = UIWindow(windowScene: windowScene)
    self.window = window

    // Determine which app mode based on bundle identifier
    let bundleId = Bundle.main.bundleIdentifier ?? ""
    print("🔍 Bundle ID: \(bundleId)")

    let moduleName: String
    if bundleId.contains("IssieVoice") {
      moduleName = "IssieVoice"
    } else if bundleId.contains("IssieCalc") {
      moduleName = "IssieCalc"
    } else {
      moduleName = "IssieBoardNG"
    }
    print("🎯 Loading module: \(moduleName)")

    // A launch URL arrives in the connection options rather than in
    // launchOptions, so cold-start file imports are prepared here.
    var initialProps: [AnyHashable: Any] = [:]
    var launchURL: URL?
    if let urlContext = connectionOptions.urlContexts.first {
      let url = urlContext.url
      if url.isFileURL, let tempURL = appDelegate.securelyCopyToTemp(url: url) {
        initialProps["url"] = tempURL.absoluteString
        launchURL = tempURL
      } else {
        launchURL = url
      }
    }

    factory.startReactNative(
      withModuleName: moduleName,
      in: window,
      initialProperties: initialProps.isEmpty ? nil : initialProps,
      launchOptions: nil
    )

    // Seed RCTLinkingManager so `Linking.getInitialURL()` resolves on cold start.
    if let launchURL {
      handle(url: launchURL, options: [:])
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for context in URLContexts {
      handle(url: context.url, options: [:])
    }
  }

  func scene(
    _ scene: UIScene,
    continue userActivity: NSUserActivity
  ) {
    RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in }
    )
  }

  /**
   * Shared by the cold-start and warm-start paths. Mirrors the routing that
   * `application(_:open:options:)` performed before the scene migration.
   */
  @discardableResult
  private func handle(url: URL, options: [UIApplication.OpenURLOptionsKey: Any]) -> Bool {
    print("App opened via URL: \(url)")

    // Handle issieboard:// URL scheme (keyboard extension logic)
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
      guard let appDelegate = UIApplication.shared.delegate as? AppDelegate,
            let tempURL = appDelegate.securelyCopyToTemp(url: url) else { return false }
      return RCTLinkingManager.application(UIApplication.shared, open: tempURL, options: options)
    }

    return RCTLinkingManager.application(UIApplication.shared, open: url, options: options)
  }
}
