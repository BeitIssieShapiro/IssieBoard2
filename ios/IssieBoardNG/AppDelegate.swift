import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import RNFBAppCheck
import FirebaseCore

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
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

    // The window is created by SceneDelegate, which also starts React Native —
    // required by the iOS 27 SDK's scene-based life cycle.
    return true
  }

  // Routes every scene to SceneDelegate. Its presence is also one of the two
  // signals iOS uses to decide whether an app has adopted the scene life cycle.
  func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    let configuration = UISceneConfiguration(
      name: "Default Configuration",
      sessionRole: connectingSceneSession.role
    )
    configuration.delegateClass = SceneDelegate.self
    return configuration
  }

  /**
   * Copies a security-scoped inbox file into the temp directory so React Native
   * can read it. Used by SceneDelegate for both cold- and warm-start imports.
   */
  func securelyCopyToTemp(url: URL) -> URL? {
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