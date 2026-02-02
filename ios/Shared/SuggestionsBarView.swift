import UIKit

/**
 * Manages the word suggestions bar UI at the top of the keyboard.
 * 
 * Features:
 * - Displays up to 4 word suggestions
 * - Supports RTL layout for Hebrew/Arabic
 * - Highlights fuzzy match suggestions
 * - Handles suggestion tap callbacks
 *
 * This class is designed to be used by KeyboardRenderer and maps 1:1 to Kotlin.
 */
class SuggestionsBarView {
    
    // MARK: - Callbacks
    
    /// Called when a suggestion is tapped with the suggestion text
    var onSuggestionSelected: ((String) -> Void)?
    
    // MARK: - UI Constants
    
    let barHeight: CGFloat = 40
    let fontSize: CGFloat = 26  // Larger than key font for better readability
    
    // MARK: - State
    
    /// Currently displayed suggestions
    private(set) var currentSuggestions: [String] = []
    
    /// Index of suggestion to highlight (for fuzzy matches)
    private(set) var highlightIndex: Int?
    
    /// Current keyboard ID for RTL detection
    var currentKeyboardId: String?
    
    // MARK: - UI Reference
    
    /// The suggestions bar view
    private weak var barView: UIView?
    
    // MARK: - Initialization
    
    init() {
        debugLog("📝 SuggestionsBarView initialized")
    }
    
    // MARK: - Public Methods
    
    /// Create the suggestions bar view
    /// - Parameter width: Width of the container
    /// - Returns: The configured UIView
    func createBar(width: CGFloat) -> UIView {
        let bar = UIView()
        bar.backgroundColor = UIColor.systemGray5
        bar.frame = CGRect(x: 0, y: 0, width: width, height: barHeight)
        bar.tag = 888  // Tag to identify suggestions bar
        barView = bar
        return bar
    }
    
    /// Update suggestions to display
    /// - Parameters:
    ///   - suggestions: Array of suggested words (max 4)
    ///   - highlightIndex: Optional index of suggestion to highlight
    func updateSuggestions(_ suggestions: [String], highlightIndex: Int? = nil) {
        debugLog("📝 SuggestionsBarView updateSuggestions: \(suggestions), highlight: \(highlightIndex?.description ?? "none")")
        currentSuggestions = suggestions
        self.highlightIndex = highlightIndex
        renderSuggestions()
    }
    
    /// Clear all suggestions
    func clearSuggestions() {
        currentSuggestions = []
        highlightIndex = nil
        renderSuggestions()
    }
    
    /// Set the bar view reference (for updates after initial creation)
    func setBarView(_ bar: UIView) {
        barView = bar
    }
    
    // MARK: - Private Rendering
    
    /// Render suggestions in the bar
    private func renderSuggestions() {
        guard let bar = barView else {
            debugLog("📝 SuggestionsBarView: No bar view, skipping render")
            return
        }
        
        // Clear existing subviews
        bar.subviews.forEach { $0.removeFromSuperview() }
        
        // If no suggestions, show nothing
        guard !currentSuggestions.isEmpty else {
            debugLog("📝 SuggestionsBarView: No suggestions to display")
            return
        }
        
        debugLog("📝 SuggestionsBarView: Displaying \(currentSuggestions.count) suggestions")
        
        let suggestionCount = min(currentSuggestions.count, 4)
        let barWidth = bar.bounds.width > 0 ? bar.bounds.width : 320  // Default fallback
        let barViewHeight = bar.bounds.height > 0 ? bar.bounds.height : barHeight
        
        guard barWidth > 0, barViewHeight > 0 else {
            debugLog("📝 SuggestionsBarView: Bar dimensions are 0, skipping")
            return
        }
        
        let cellWidth = barWidth / CGFloat(suggestionCount)
        let dividerWidth: CGFloat = 1.0
        
        // Check if we should use RTL layout
        let isRTL = isCurrentKeyboardRTL()
        debugLog("📝 SuggestionsBarView: isRTL=\(isRTL), keyboard=\(currentKeyboardId ?? "nil")")
        
        for (index, suggestion) in currentSuggestions.prefix(4).enumerated() {
            // Check if this suggestion should be highlighted
            let isHighlighted = highlightIndex == index
            
            // Create tappable button
            let button = UIButton(type: .system)
            button.setTitle(suggestion, for: .normal)
            let fontWeight: UIFont.Weight = isHighlighted ? .bold : .medium
            button.titleLabel?.font = UIFont.systemFont(ofSize: fontSize, weight: fontWeight)
            button.titleLabel?.adjustsFontSizeToFitWidth = true
            button.titleLabel?.minimumScaleFactor = 0.6
            button.titleLabel?.textAlignment = .center
            
            // Highlighted suggestion styling
            if isHighlighted {
                button.backgroundColor = UIColor.systemBlue.withAlphaComponent(0.15)
                button.setTitleColor(.systemBlue, for: .normal)
                button.layer.cornerRadius = 6
            } else {
                button.backgroundColor = .clear
                button.setTitleColor(.label, for: .normal)
            }
            button.setTitleColor(.secondaryLabel, for: .highlighted)
            
            // Store suggestion for retrieval on tap
            // Strip quotes from literal suggestions
            let insertValue = suggestion.hasPrefix("\"") && suggestion.hasSuffix("\"")
                ? String(suggestion.dropFirst().dropLast())
                : suggestion
            button.accessibilityIdentifier = insertValue
            button.addTarget(self, action: #selector(suggestionTapped(_:)), for: .touchUpInside)
            
            // Position based on RTL
            let x: CGFloat
            if isRTL {
                // RTL: first suggestion at rightmost position
                x = barWidth - CGFloat(index + 1) * cellWidth
            } else {
                // LTR: first suggestion at leftmost position
                x = CGFloat(index) * cellWidth
            }
            
            button.frame = CGRect(x: x, y: 0, width: cellWidth, height: barViewHeight)
            bar.addSubview(button)
            
            // Add divider after each cell except the last
            if index < suggestionCount - 1 {
                let divider = UIView()
                divider.backgroundColor = UIColor.systemGray3
                
                let dividerX: CGFloat
                if isRTL {
                    dividerX = x - (dividerWidth / 2)
                } else {
                    dividerX = x + cellWidth - (dividerWidth / 2)
                }
                
                divider.frame = CGRect(
                    x: dividerX,
                    y: barViewHeight * 0.2,
                    width: dividerWidth,
                    height: barViewHeight * 0.6
                )
                bar.addSubview(divider)
            }
        }
    }
    
    /// Check if the current keyboard is RTL (Hebrew or Arabic)
    private func isCurrentKeyboardRTL() -> Bool {
        guard let keyboardId = currentKeyboardId else { return false }
        return keyboardId == "he" || keyboardId == "ar"
    }
    
    // MARK: - Actions
    
    @objc private func suggestionTapped(_ sender: UIButton) {
        guard let suggestion = sender.accessibilityIdentifier else { return }
        debugLog("📝 SuggestionsBarView: Suggestion tapped: '\(suggestion)'")
        onSuggestionSelected?(suggestion)
    }
}