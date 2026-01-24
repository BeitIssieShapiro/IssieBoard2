import Foundation
import UIKit
import React

@objc(KeyboardPreviewViewManager)
class KeyboardPreviewViewManager: RCTViewManager {
    
    override func view() -> UIView! {
        return KeyboardPreviewView()
    }
    
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
}
