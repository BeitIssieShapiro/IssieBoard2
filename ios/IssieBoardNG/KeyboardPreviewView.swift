import UIKit
import React

/**
 * iOS keyboard preview component for React Native
 * Thin wrapper around KeyboardRenderer - renderer handles all UI logic
 */
@objc(KeyboardPreviewView)
class KeyboardPreviewView: UIView {
    
    // MARK: - Properties
    
    private let renderer: KeyboardRenderer
    private var parsedConfig: KeyboardConfig?
    
    // Event callback for React Native
    @objc var onKeyPress: RCTBubblingEventBlock?
    
    // Selected keys for edit mode visualization
    private var selectedKeyIds: Set<String> = []
    
    // Layout tracking to prevent infinite loops
    private var lastRenderedWidth: CGFloat = 0
    
    // MARK: - Initialization
    
    override init(frame: CGRect) {
        // Create renderer - it manages all keyboard logic
        self.renderer = KeyboardRenderer()
        
        super.init(frame: frame)
        
        backgroundColor = UIColor(red: 0.82, green: 0.82, blue: 0.82, alpha: 1.0)
        
        // Set up renderer callbacks - only for FINAL key output
        renderer.onKeyPress = { [weak self] key in
            self?.emitKeyPress(key)
        }
        
        print("📱 KeyboardPreviewView initialized with frame: \(frame)")
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
    
    /// Set selected key IDs for visual highlighting in edit mode
    /// Format: JSON array of strings like ["abc:0:3", "abc:1:2"]
    @objc func setSelectedKeys(_ selectedKeysJson: String?) {
        guard let jsonString = selectedKeysJson,
              let jsonData = jsonString.data(using: .utf8),
              let keys = try? JSONDecoder().decode([String].self, from: jsonData) else {
            selectedKeyIds = []
            renderer.setSelectedKeys([])
            renderKeyboard()
            return
        }
        
        print("📱 setSelectedKeys: \(keys.count) keys selected")
        selectedKeyIds = Set(keys)
        renderer.setSelectedKeys(selectedKeyIds)
        renderKeyboard()
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
            
            print("✅ Config parsed: keysets=\(parsedConfig?.keysets.map { $0.id }.joined(separator: ", ") ?? "none")")
            
            // Render immediately
            renderKeyboard()
        } catch {
            print("❌ Failed to parse config: \(error)")
        }
    }
    
    private func renderKeyboard() {
        guard let config = parsedConfig else {
            print("❌ No config to render")
            return
        }
        
        let currentWidth = bounds.width
        print("🎨 Preview: Rendering keyboard, width = \(currentWidth), lastRenderedWidth = \(lastRenderedWidth)")
        
        // Update last rendered width
        lastRenderedWidth = currentWidth
        
        // Renderer handles everything - just pass config and container
        // Don't pass currentKeysetId - renderer maintains its own internal state
        renderer.renderKeyboard(
            in: self,
            config: config,
            currentKeysetId: renderer.currentKeysetId.isEmpty ? (config.defaultKeyset ?? "abc") : renderer.currentKeysetId,
            editorContext: nil  // No editor context in preview
        )
    }
    
    // MARK: - Key Press Output to React Native
    
    private func emitKeyPress(_ key: ParsedKey) {
        print("🔘 Preview key output: type=\(key.type), value=\(key.value)")
        
        // Emit event to React Native
        if let onKeyPress = onKeyPress {
            let event: [String: Any] = [
                "type": key.type,
                "value": key.value,
                "label": key.label,
                "hasNikkud": !key.nikkud.isEmpty
            ]
            onKeyPress(event)
        }
    }
    
    // MARK: - Layout
    
    override func layoutSubviews() {
        super.layoutSubviews()
        
        let currentWidth = bounds.width
        print("📐 PreviewView layoutSubviews: bounds = \(bounds), lastRenderedWidth = \(lastRenderedWidth)")
        
        // Don't re-render if nikkud picker is showing (tag 999)
        let hasNikkudPicker = subviews.contains(where: { $0.tag == 999 })
        if hasNikkudPicker {
            print("📱 layoutSubviews: Skipping re-render (nikkud picker is showing)")
            return
        }
        
        // Only re-render if width has actually changed (prevents infinite loop)
        if parsedConfig != nil && abs(currentWidth - lastRenderedWidth) > 1 {
            print("📐 PreviewView width changed from \(lastRenderedWidth) to \(currentWidth), re-rendering")
            renderKeyboard()
        }
    }
    
    override var bounds: CGRect {
        didSet {
            if oldValue != bounds {
                print("📐 PreviewView bounds changed: old = \(oldValue), new = \(bounds)")
            }
        }
    }
    
    override var frame: CGRect {
        didSet {
            if oldValue != frame {
                print("📐 PreviewView frame changed: old = \(oldValue), new = \(frame)")
            }
        }
    }
}
