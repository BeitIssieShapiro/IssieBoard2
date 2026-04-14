import UIKit

/**
 * Manages the word suggestions bar UI at the top of the keyboard.
 *
 * Features:
 * - Displays suggestions as pill-shaped buttons with ellipsis truncation
 * - Horizontally scrollable when suggestions overflow
 * - Supports RTL layout for Hebrew/Arabic
 * - Highlights fuzzy match suggestions
 * - Font size, weight, and custom font follow keyboard global settings
 * - Handles suggestion tap callbacks
 *
 * This class is designed to be used by KeyboardRenderer and maps 1:1 to Kotlin.
 */
class SuggestionsBarView {

    // MARK: - Callbacks

    /// Called when a suggestion is tapped with the suggestion text
    var onSuggestionSelected: ((String) -> Void)?

    // MARK: - UI Constants

    let barHeight: CGFloat = 40  // Fallback only; actual height set by renderer proportional to row height
    private let barPaddingV: CGFloat = 3    // Vertical padding at bar edges
    private let pillSpacing: CGFloat = 6    // Gap between pills
    private let barPaddingH: CGFloat = 6    // Horizontal padding at bar edges

    // MARK: - State

    /// Currently displayed suggestions
    private(set) var currentSuggestions: [String] = []

    /// Index of suggestion to highlight (for fuzzy matches)
    private(set) var highlightIndex: Int?

    /// Current keyboard ID for RTL detection
    var currentKeyboardId: String?

    /// Whether suggestion type is selected (for editor blue border)
    var isSelected: Bool = false

    /// Custom background color from keyboard config
    var customBackgroundColor: UIColor?

    /// Custom text color from keyboard config
    var customTextColor: UIColor?

    /// Custom font from keyboard config (nil = system font)
    var customFont: UIFont?

    /// Font weight from keyboard config
    var customFontWeight: UIFont.Weight = .regular

    /// Font size override from keyboard config (nil = auto-calculated from bar height)
    var customFontSize: CGFloat?

    // MARK: - UI Reference

    /// The suggestions bar view (contains the scroll view)
    private weak var barView: UIView?

    /// The scroll view inside the bar
    private weak var scrollView: UIScrollView?

    // MARK: - Initialization

    init() {
        debugLog("📝 SuggestionsBarView initialized")
    }

    // MARK: - Public Methods

    /// Create the suggestions bar view
    /// - Parameters:
    ///   - width: Width of the container
    ///   - height: Optional custom height (defaults to barHeight)
    /// - Returns: The configured UIView
    func createBar(width: CGFloat, height: CGFloat? = nil) -> UIView {
        let bar = UIView()
        bar.backgroundColor = .clear
        let actualHeight = height ?? barHeight
        bar.frame = CGRect(x: 0, y: 0, width: width, height: actualHeight)
        bar.tag = 888  // Tag to identify suggestions bar
        bar.clipsToBounds = false

        let scroll = UIScrollView()
        scroll.showsHorizontalScrollIndicator = false
        scroll.showsVerticalScrollIndicator = false
        scroll.clipsToBounds = false
        scroll.alwaysBounceHorizontal = true
        scroll.frame = bar.bounds
        scroll.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        bar.addSubview(scroll)

        barView = bar
        scrollView = scroll
        return bar
    }

    /// Update suggestions to display
    /// - Parameters:
    ///   - suggestions: Array of suggested words
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
        // Find or create scroll view
        if let existing = bar.subviews.first(where: { $0 is UIScrollView }) as? UIScrollView {
            scrollView = existing
        } else {
            let scroll = UIScrollView()
            scroll.showsHorizontalScrollIndicator = false
            scroll.showsVerticalScrollIndicator = false
            scroll.alwaysBounceHorizontal = true
            scroll.frame = bar.bounds
            scroll.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            bar.addSubview(scroll)
            scrollView = scroll
        }
    }

    // MARK: - Private Rendering

    /// Render suggestions in the bar as pill-shaped buttons
    private func renderSuggestions() {
        guard let bar = barView, let scroll = scrollView else {
            debugLog("📝 SuggestionsBarView: No bar/scroll view, skipping render")
            return
        }

        // Clear existing pill subviews from scroll view
        scroll.subviews.forEach { $0.removeFromSuperview() }

        // If no suggestions, show nothing
        guard !currentSuggestions.isEmpty else {
            debugLog("📝 SuggestionsBarView: No suggestions to display")
            scroll.contentSize = .zero
            return
        }

        debugLog("📝 SuggestionsBarView: Displaying \(currentSuggestions.count) suggestions")

        let barViewHeight = bar.bounds.height > 0 ? bar.bounds.height : barHeight
        let barWidth = bar.bounds.width > 0 ? bar.bounds.width : 320

        // Pill dimensions derived from bar height
        let pillHeight = barViewHeight - barPaddingV * 2
        let pillRadius = pillHeight / 2  // Fully rounded capsule
        let pillPadH = max(pillHeight / 2, 10)  // Horizontal padding >= half height
        // Extra space for custom fonts whose glyphs extend beyond text bounds
        let glyphPad: CGFloat = customFont != nil ? pillHeight * 0.5 : 0

        // Calculate font
        let font = resolveFont(forBarHeight: barViewHeight)

        // Check if we should use RTL layout
        let isRTL = isCurrentKeyboardRTL()
        debugLog("📝 SuggestionsBarView: isRTL=\(isRTL), keyboard=\(currentKeyboardId ?? "nil")")

        // Build pills and measure their widths
        var pills: [(button: UIButton, width: CGFloat, insertValue: String)] = []

        for (index, suggestion) in currentSuggestions.enumerated() {
            let isHighlighted = highlightIndex == index

            let button = UIButton(type: .custom)
            button.clipsToBounds = false
            button.backgroundColor = .clear

            // Add rounded pill background
            let pillBgView = UIView()
            pillBgView.isUserInteractionEnabled = false
            pillBgView.layer.cornerRadius = pillRadius
            pillBgView.clipsToBounds = true
            button.addSubview(pillBgView)
            pillBgView.tag = 999

            // Add label on top of pill bg — not constrained by pill, allows glyph overflow
            let label = UILabel()
            label.text = suggestion
            label.textAlignment = .center
            label.clipsToBounds = false
            label.lineBreakMode = .byTruncatingTail
            label.adjustsFontForContentSizeCategory = false
            button.addSubview(label)
            label.tag = 998

            // Font
            let pillFont: UIFont
            if isHighlighted {
                pillFont = font.withWeight(.medium)
            } else {
                pillFont = font
            }
            label.font = pillFont

            // Colors — same as default key colors
            if isHighlighted {
                pillBgView.backgroundColor = UIColor.systemBlue.withAlphaComponent(0.15)
                label.textColor = .systemBlue
            } else {
                pillBgView.backgroundColor = customBackgroundColor ?? .white
                label.textColor = customTextColor ?? .label
            }

            // Selection border (editor mode)
            if isSelected {
                pillBgView.layer.borderWidth = 3.0
                pillBgView.layer.borderColor = UIColor.systemBlue.cgColor
            }

            // Store suggestion for retrieval on tap
            let insertValue = suggestion.hasPrefix("\"") && suggestion.hasSuffix("\"")
                ? String(suggestion.dropFirst().dropLast())
                : suggestion
            button.accessibilityIdentifier = insertValue
            button.addTarget(self, action: #selector(suggestionTapped(_:)), for: .touchUpInside)

            // Measure natural width (text + padding), cap at 40% of bar width
            let textSize = (suggestion as NSString).size(withAttributes: [.font: pillFont])
            let naturalWidth = textSize.width + (pillPadH + glyphPad) * 2
            let maxPillWidth = barWidth * 0.4
            let pillWidth = min(naturalWidth, maxPillWidth)

            pills.append((button: button, width: pillWidth, insertValue: insertValue))
        }

        // If RTL, reverse order so first suggestion is rightmost
        let orderedPills = isRTL ? pills.reversed() : pills

        // Layout pills — spread evenly if they fit, otherwise scroll
        let totalPillsWidth = orderedPills.reduce(CGFloat(0)) { $0 + $1.width }
        let totalWithSpacing = totalPillsWidth + pillSpacing * CGFloat(max(0, orderedPills.count - 1))

        let evenlySpaced = totalWithSpacing <= barWidth
        let spacing: CGFloat
        var xOffset: CGFloat

        if evenlySpaced && orderedPills.count > 1 {
            // Distribute evenly across full width
            let totalGap = barWidth - totalPillsWidth
            spacing = totalGap / CGFloat(orderedPills.count + 1)
            xOffset = spacing
        } else if evenlySpaced && orderedPills.count == 1 {
            // Center single pill
            spacing = 0
            xOffset = (barWidth - orderedPills[0].width) / 2
        } else {
            // Overflow — pack with fixed spacing, will scroll
            spacing = pillSpacing
            xOffset = barPaddingH
        }

        for pill in orderedPills {
            let y = (barViewHeight - pillHeight) / 2
            pill.button.frame = CGRect(x: xOffset, y: y, width: pill.width, height: pillHeight)
            // Pill bg inset for glyph overflow area
            if let bgView = pill.button.viewWithTag(999) {
                bgView.frame = pill.button.bounds.insetBy(dx: glyphPad, dy: 0)
                bgView.layer.cornerRadius = bgView.bounds.height / 2
            }
            // Label centered, allowed to overflow pill bg
            if let label = pill.button.viewWithTag(998) as? UILabel {
                label.frame = pill.button.bounds
            }
            scroll.addSubview(pill.button)
            xOffset += pill.width + spacing
        }

        // Set content size
        let totalContentWidth = evenlySpaced ? barWidth : xOffset - spacing + barPaddingH
        scroll.contentSize = CGSize(width: totalContentWidth, height: barViewHeight)

        // For RTL, scroll to the right end
        if isRTL && totalContentWidth > barWidth {
            scroll.contentOffset = CGPoint(x: totalContentWidth - barWidth, y: 0)
        } else {
            scroll.contentOffset = .zero
        }
    }

    /// Resolve the font to use based on config settings and bar height
    private func resolveFont(forBarHeight height: CGFloat) -> UIFont {
        // Font size: use custom if set, otherwise derive from bar height (~50% of bar height)
        let fontSize = customFontSize ?? (height * 0.55)

        if let custom = customFont {
            // Custom font name was set — use it at the calculated size
            if let sized = UIFont(name: custom.fontName, size: fontSize) {
                return sized
            }
        }

        return UIFont.systemFont(ofSize: fontSize, weight: customFontWeight)
    }

    /// Check if the current keyboard is RTL (Hebrew or Arabic)
    private func isCurrentKeyboardRTL() -> Bool {
        guard let keyboardId = currentKeyboardId else { return false }
        return keyboardId.hasPrefix("he") || keyboardId.hasPrefix("ar")
    }

    // MARK: - Actions

    @objc private func suggestionTapped(_ sender: UIButton) {
        guard let suggestion = sender.accessibilityIdentifier else { return }
        debugLog("📝 SuggestionsBarView: Suggestion tapped: '\(suggestion)'")
        onSuggestionSelected?(suggestion)
    }
}

// MARK: - UIFont Extension

private extension UIFont {
    /// Return a font with the specified weight, preserving font name if possible
    func withWeight(_ weight: UIFont.Weight) -> UIFont {
        return UIFont.systemFont(ofSize: pointSize, weight: weight)
    }
}

