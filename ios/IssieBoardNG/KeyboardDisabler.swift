import Foundation
import UIKit
import React

/// Suppresses the iOS system keyboard strip and dictation mic
/// for a React Native TextInput.
@objc(KeyboardDisabler)
class KeyboardDisabler: NSObject {

  @objc static func moduleName() -> String! {
    return "KeyboardDisabler"
  }

  @objc static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc func disableSystemKeyboard(_ reactTag: NSNumber) {
    DispatchQueue.main.async {
      guard let window = UIApplication.shared.connectedScenes
              .compactMap({ $0 as? UIWindowScene })
              .flatMap({ $0.windows })
              .first(where: { $0.isKeyWindow }),
            let textView = self.findFirstTextView(in: window) else {
        NSLog("🔴 KeyboardDisabler: no UITextView found")
        return
      }

      NSLog("🟡 KeyboardDisabler: found UITextView, applying settings")

      // Suppress system keyboard
      textView.inputView = UIView(frame: .zero)
      textView.inputAccessoryView = UIView(frame: .zero)

      // Disable the input assistant item (shortcut bar + dictation button on iPad)
      textView.inputAssistantItem.leadingBarButtonGroups = []
      textView.inputAssistantItem.trailingBarButtonGroups = []

      // Disable autocorrection and smart features
      textView.autocorrectionType = .no
      textView.spellCheckingType = .no
      textView.smartQuotesType = .no
      textView.smartDashesType = .no
      textView.smartInsertDeleteType = .no
      if #available(iOS 17.0, *) {
        textView.inlinePredictionType = .no
      }

      textView.reloadInputViews()
      NSLog("🟡 KeyboardDisabler: done")
    }
  }

  private func findFirstTextView(in view: UIView) -> UITextView? {
    if let textView = view as? UITextView {
      return textView
    }
    for subview in view.subviews {
      if let found = findFirstTextView(in: subview) {
        return found
      }
    }
    return nil
  }
}
