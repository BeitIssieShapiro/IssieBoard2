import UIKit
import React

/**
 * iOS keyboard preview component for React Native
 * Renders the keyboard layout using shared KeyboardRenderer
 */
@objc(KeyboardPreviewView)
class KeyboardPreviewView: UIView, KeyboardRendererDelegate {
    
    // MARK: - Properties
    
    private let renderer: KeyboardRenderer
    private let preferences = KeyboardPreferences()
    private var parsedConfig: KeyboardConfig?
    private var currentKeysetId: String = "abc"
    
    // Event callback
    @objc var onKeyPress: RCTDirectEventBlock?
    
    // MARK: - Initialization
    
    override init(frame: CGRect) {
        // Create renderer first
        self.renderer = KeyboardRenderer(isPreview: true)
        
        super.init(frame: frame)
        
        // Set self as delegate after super.init
        renderer.keyPressDelegate = self
        
        backgroundColor = UIColor(red: 0.82, green: 0.82, blue: 0.82, alpha: 1.0)
        
        print("📱 KeyboardPreviewView initialized")
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - React Native Props
    
    @objc func setConfigJson(_ configJson: String?) {
        print("📱 setConfigJson called with \(configJson?.count ?? 0) chars")
        
        guard let configJson = configJson, !configJson.isEmpty else {
            print("⚠️ No config provided")
            return
        }
        
        parseAndRender(configJson)
    }
    
    // MARK: - Config Parsing & Rendering
    
    private func parseAndRender(_ jsonString: String) {
        guard let jsonData = jsonString.data(using: .utf8) else {
            print("❌ Failed to convert config to data")
            return
        }
        
        do {
            let decoder = JSONDecoder()
            parsedConfig = try decoder.decode(KeyboardConfig.self, from: jsonData)
            
            if let defaultKeyset = parsedConfig?.defaultKeyset {
                currentKeysetId = defaultKeyset
            }
            
            print("✅ Config parsed: keysets=\(parsedConfig?.keysets.map { $0.id }.joined(separator: ", ") ?? "none")")
            
            // Render on main thread
            DispatchQueue.main.async { [weak self] in
                self?.renderKeyboard()
            }
        } catch {
            print("❌ Failed to parse config: \(error)")
        }
    }
    
    private func renderKeyboard() {
        guard let config = parsedConfig else {
            print("❌ No config to render")
            return
        }
        
        print("🎨 Rendering preview keyboard")
        
        // Use shared renderer (no editor context in preview)
        renderer.renderKeyboard(
            in: self,
            config: config,
            currentKeysetId: currentKeysetId,
            editorContext: nil
        )
    }
    
    // MARK: - KeyboardRendererDelegate
    
    func keyboardRenderer(_ renderer: KeyboardRenderer, didPressKey key: ParsedKey) {
        handleKeyPress(key)
    }
    
    // MARK: - Key Press Handling
    
    private func handleKeyPress(_ key: ParsedKey) {
        print("🔘 Preview key pressed: type=\(key.type), value=\(key.value)")
        
        // Emit event to React Native
        if let onKeyPress = onKeyPress {
            let event: [String: Any] = [
                "type": key.type,
                "value": renderer.shiftState.isActive() ? key.sValue : key.value,
                "label": key.label,
                "hasNikkud": !key.nikkud.isEmpty
            ]
            onKeyPress(event)
        }
        
        // Handle state-changing keys
        switch key.type.lowercased() {
        case "shift":
            renderer.shiftState = renderer.shiftState.toggle()
            renderKeyboard()
            
        case "nikkud":
            renderer.nikkudActive = !renderer.nikkudActive
            renderKeyboard()
            
        case "keyset":
            if !key.keysetValue.isEmpty {
                switchKeyset(key.keysetValue)
            }
            
        default:
            break
        }
    }
    
    private func switchKeyset(_ keysetId: String) {
        guard let config = parsedConfig,
              config.keysets.contains(where: { $0.id == keysetId }) else {
            return
        }
        
        currentKeysetId = keysetId
        renderer.shiftState = .inactive
        renderKeyboard()
    }
    
    // MARK: - Layout
    
    override func layoutSubviews() {
        super.layoutSubviews()
        
        // Re-render when layout changes (e.g., screen rotation)
        if parsedConfig != nil {
            renderKeyboard()
        }
    }
}
