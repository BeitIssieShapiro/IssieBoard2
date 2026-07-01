package org.issieshapiro.issieboard.shared

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Manages the word suggestions bar UI at the top of the keyboard.
 *
 * Port of ios/Shared/SuggestionsBarView.swift
 *
 * Features:
 * - Displays suggestions as pill-shaped buttons with ellipsis truncation
 * - Horizontally scrollable when suggestions overflow
 * - Supports RTL layout for Hebrew/Arabic
 * - Highlights fuzzy match suggestions
 * - Font size, weight, and custom font follow keyboard global settings
 * - Handles suggestion tap callbacks
 *
 * This class is designed to be used by KeyboardRenderer and maps 1:1 from Swift.
 */
class SuggestionsBarView(private val context: Context) {

    // MARK: - Callbacks

    /** Called when a suggestion is tapped with the suggestion text */
    var onSuggestionSelected: ((String) -> Unit)? = null

    // MARK: - UI Constants

    val barHeight: Int = dpToPx(40)  // Fallback only; actual height set by renderer proportional to row height
    private val barPaddingV: Int = dpToPx(3)    // Vertical padding at bar edges
    private val pillSpacing: Int = dpToPx(6)    // Gap between pills
    private val barPaddingH: Int = dpToPx(6)    // Horizontal padding at bar edges

    // MARK: - State

    /** Currently displayed suggestions */
    var currentSuggestions: List<String> = emptyList()
        private set

    /** Index of suggestion to highlight (for fuzzy matches) */
    var highlightIndex: Int? = null
        private set

    /** Current keyboard ID for RTL detection */
    var currentKeyboardId: String? = null

    /** Whether suggestion type is selected (for editor blue border) */
    var isSelected: Boolean = false

    /** Custom background color from keyboard config (null = use default white) */
    var customBackgroundColor: Int? = null

    /** Custom text color from keyboard config (null = use default black) */
    var customTextColor: Int? = null

    /** Custom font from keyboard config (null = system font) */
    var customFont: Typeface? = null

    /** Font weight from keyboard config */
    var customFontWeight: Int = Typeface.NORMAL

    /** Font size override from keyboard config (null = auto-calculated from bar height) */
    var customFontSize: Float? = null

    // MARK: - UI Reference

    /** The suggestions bar view (contains the scroll view) */
    private var barView: ViewGroup? = null

    /** The scroll view inside the bar */
    private var scrollView: HorizontalScrollView? = null

    // MARK: - Initialization

    init {
        debugLog("📝 SuggestionsBarView initialized")
    }

    // MARK: - Public Methods

    /**
     * Create the suggestions bar view
     * @param width Width of the container
     * @param height Optional custom height (defaults to barHeight)
     * @return The configured ViewGroup
     */
    fun createBar(width: Int, height: Int? = null): ViewGroup {
        val actualHeight = height ?: barHeight
        val bar = FrameLayout(context).apply {
            setBackgroundColor(Color.TRANSPARENT)
            layoutParams = FrameLayout.LayoutParams(width, actualHeight).apply {
                gravity = Gravity.TOP
            }
            tag = 888  // Tag to identify suggestions bar
            clipChildren = false
        }

        val scroll = HorizontalScrollView(context).apply {
            isHorizontalScrollBarEnabled = false
            isVerticalScrollBarEnabled = false
            clipChildren = false
            overScrollMode = View.OVER_SCROLL_ALWAYS
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        // HorizontalScrollView child: LinearLayout for horizontal pill layout
        val scrollContent = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            clipChildren = false
        }
        scroll.addView(scrollContent)
        bar.addView(scroll)

        barView = bar
        scrollView = scroll
        return bar
    }

    /**
     * Update suggestions to display
     * @param suggestions Array of suggested words
     * @param highlightIndex Optional index of suggestion to highlight
     */
    fun updateSuggestions(suggestions: List<String>, highlightIndex: Int? = null) {
        debugLog("📝 SuggestionsBarView updateSuggestions: $suggestions, highlight: ${highlightIndex?.toString() ?: "none"}, isSelected=$isSelected")
        currentSuggestions = suggestions
        this.highlightIndex = highlightIndex
        renderSuggestions()
    }

    /** Clear all suggestions */
    fun clearSuggestions() {
        currentSuggestions = emptyList()
        highlightIndex = null
        renderSuggestions()
    }

    /**
     * Set the bar view reference (for updates after initial creation)
     */
    fun setBarView(bar: ViewGroup) {
        barView = bar
        // Find or create scroll view
        val existingScroll = findScrollView(bar)
        if (existingScroll != null) {
            scrollView = existingScroll
        } else {
            val scroll = HorizontalScrollView(context).apply {
                isHorizontalScrollBarEnabled = false
                isVerticalScrollBarEnabled = false
                overScrollMode = View.OVER_SCROLL_ALWAYS
                layoutParams = FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                )
            }
            val scrollContent = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                layoutParams = FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.WRAP_CONTENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                )
            }
            scroll.addView(scrollContent)
            bar.addView(scroll)
            scrollView = scroll
        }
    }

    /** Find a HorizontalScrollView in the view hierarchy */
    private fun findScrollView(parent: ViewGroup): HorizontalScrollView? {
        for (i in 0 until parent.childCount) {
            val child = parent.getChildAt(i)
            if (child is HorizontalScrollView) return child
        }
        return null
    }

    // MARK: - Private Rendering

    /** Render suggestions in the bar as pill-shaped buttons */
    private fun renderSuggestions() {
        val bar = barView
        val scroll = scrollView
        if (bar == null || scroll == null) {
            debugLog("📝 SuggestionsBarView: No bar/scroll view, skipping render")
            return
        }

        // Get the scroll content container (first child of scroll view)
        val scrollContent = scroll.getChildAt(0) as? ViewGroup
        if (scrollContent == null) {
            debugLog("📝 SuggestionsBarView: No scroll content, skipping render")
            return
        }

        // Clear existing pill subviews from scroll content
        scrollContent.removeAllViews()

        // If no suggestions, show nothing
        if (currentSuggestions.isEmpty()) {
            debugLog("📝 SuggestionsBarView: No suggestions to display")
            return
        }

        debugLog("📝 SuggestionsBarView: Displaying ${currentSuggestions.size} suggestions")

        val barViewHeight = if (bar.height > 0) bar.height else barHeight
        var barWidth = bar.width
        if (barWidth <= 0) {
            val parent = bar.parent as? View
            barWidth = parent?.width ?: 0
        }
        if (barWidth <= 0) {
            barWidth = context.resources.displayMetrics.widthPixels
            debugLog("📝 SuggestionsBarView: Bar width was 0, using screen width: $barWidth")
        }

        // Pill dimensions derived from bar height
        val pillHeight = barViewHeight - barPaddingV * 2
        val pillRadius = pillHeight / 2f  // Fully rounded capsule
        val pillPadH = maxOf(pillHeight / 2, dpToPx(10))  // Horizontal padding >= half height
        // No extra glyph padding — use clipChildren=false on parent to handle overflow
        val glyphPad = 0

        // Calculate font
        val font = resolveFont(barViewHeight.toFloat())
        val fontSize = resolveFontSize(barViewHeight.toFloat())

        // Check if we should use RTL layout
        val isRTL = isCurrentKeyboardRTL()
        debugLog("📝 SuggestionsBarView: isRTL=$isRTL, keyboard=${currentKeyboardId ?: "nil"}")

        // Build pills and measure their widths
        data class PillInfo(val view: View, val width: Int, val insertValue: String)
        val pills = mutableListOf<PillInfo>()

        for ((index, suggestion) in currentSuggestions.withIndex()) {
            val isHighlighted = highlightIndex == index

            // Create button container (FrameLayout to hold pill bg + label)
            val button = FrameLayout(context).apply {
                clipChildren = false
            }

            // Add rounded pill background
            val pillBgView = View(context).apply {
                val bgDrawable = GradientDrawable().apply {
                    cornerRadius = pillRadius
                    if (isSelected) {
                        // Selection mode: white bg + blue border, matching regular key selection
                        setColor(Color.WHITE)
                        setStroke(dpToPx(3), Color.parseColor("#2196F3"))
                    } else if (isHighlighted) {
                        setColor(Color.argb(38, 33, 150, 243))  // systemBlue with 15% alpha
                    } else {
                        setColor(customBackgroundColor ?: Color.WHITE)
                    }
                }
                background = bgDrawable
                // Force the view to draw even at 0x0 initial size
                setWillNotDraw(false)
                tag = 999
            }
            button.addView(pillBgView)

            // Selection overlay border — separate view on top for guaranteed visibility
            if (isSelected) {
                val borderView = View(context).apply {
                    val borderDrawable = GradientDrawable().apply {
                        cornerRadius = pillRadius
                        setColor(Color.TRANSPARENT)
                        setStroke(dpToPx(3), Color.parseColor("#2196F3"))
                    }
                    background = borderDrawable
                    tag = 997
                }
                button.addView(borderView)
            }

            // Add label on top of pill bg
            val label = TextView(context).apply {
                text = suggestion
                gravity = Gravity.CENTER
                textAlignment = View.TEXT_ALIGNMENT_CENTER
                maxLines = 1
                ellipsize = TextUtils.TruncateAt.END
                includeFontPadding = false

                // Font
                val pillFont: Typeface
                val pillWeight: Int
                if (isHighlighted) {
                    pillFont = font ?: Typeface.DEFAULT
                    pillWeight = Typeface.BOLD  // medium weight equivalent
                } else {
                    pillFont = font ?: Typeface.DEFAULT
                    pillWeight = customFontWeight
                }
                setTypeface(pillFont, pillWeight)
                setTextSize(TypedValue.COMPLEX_UNIT_PX, fontSize)

                // Colors
                if (isSelected) {
                    setTextColor(Color.BLACK)  // Black text on white bg when selected
                } else if (isHighlighted) {
                    setTextColor(Color.parseColor("#2196F3"))  // systemBlue
                } else {
                    setTextColor(customTextColor ?: Color.BLACK)
                }
                tag = 998
            }
            button.addView(label, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            ))

            // Store suggestion for retrieval on tap
            val insertValue = if (suggestion.startsWith("\"") && suggestion.endsWith("\"")) {
                suggestion.drop(1).dropLast(1).toString()
            } else {
                suggestion
            }

            button.setOnClickListener {
                suggestionTapped(insertValue)
            }

            // Measure natural width (text + padding), cap at 40% of bar width
            val textWidth = measureTextWidth(suggestion, label)
            val naturalWidth = textWidth + (pillPadH + glyphPad) * 2
            val maxPillWidth = (barWidth * 0.4f).toInt()
            val pillWidth = minOf(naturalWidth, maxPillWidth)

            pills.add(PillInfo(button, pillWidth, insertValue))
        }

        // If RTL, reverse order so first suggestion is rightmost
        val orderedPills = if (isRTL) pills.reversed() else pills

        // Layout pills - spread evenly if they fit, otherwise scroll
        val totalPillsWidth = orderedPills.sumOf { it.width }
        val totalWithSpacing = totalPillsWidth + pillSpacing * maxOf(0, orderedPills.size - 1)

        val evenlySpaced = totalWithSpacing <= barWidth

        if (evenlySpaced && orderedPills.size > 1) {
            // Distribute evenly across full width using weighted LinearLayout
            val totalGap = barWidth - totalPillsWidth
            val spacerWidth = totalGap / (orderedPills.size + 1)

            for (pill in orderedPills) {
                // Add spacer before each pill
                val spacer = View(context)
                spacer.layoutParams = LinearLayout.LayoutParams(spacerWidth, pillHeight)
                scrollContent.addView(spacer)

                // Pill bg fills the FrameLayout minus glyph padding
                val bgView = pill.view.findViewWithTag<View>(999)
                val bgWidth = pill.width - glyphPad * 2
                bgView?.layoutParams = FrameLayout.LayoutParams(
                    bgWidth,
                    pillHeight
                ).apply { leftMargin = glyphPad }
                (bgView?.background as? GradientDrawable)?.cornerRadius = pillHeight / 2f

                // Border overlay (selection mode)
                val borderView = pill.view.findViewWithTag<View>(997)
                borderView?.layoutParams = FrameLayout.LayoutParams(
                    bgWidth,
                    pillHeight
                ).apply { leftMargin = glyphPad }
                (borderView?.background as? GradientDrawable)?.cornerRadius = pillHeight / 2f

                // Label centered vertically in FrameLayout
                val labelView = pill.view.findViewWithTag<View>(998)
                labelView?.layoutParams = FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                )

                pill.view.layoutParams = LinearLayout.LayoutParams(pill.width, pillHeight)
                debugLog("📝 Pill '${pill.insertValue}': width=${pill.width}, height=$pillHeight, bgWidth=$bgWidth, isSelected=$isSelected, fontSize=$fontSize")
                scrollContent.addView(pill.view)
            }
            // Trailing spacer
            val trailingSpacer = View(context)
            trailingSpacer.layoutParams = LinearLayout.LayoutParams(spacerWidth, pillHeight)
            scrollContent.addView(trailingSpacer)

        } else if (evenlySpaced && orderedPills.size == 1) {
            // Center single pill
            val pill = orderedPills[0]
            val sideSpace = (barWidth - pill.width) / 2

            val leadingSpacer = View(context)
            leadingSpacer.layoutParams = LinearLayout.LayoutParams(sideSpace, pillHeight)
            scrollContent.addView(leadingSpacer)

            val bgView = pill.view.findViewWithTag<View>(999)
            val bgWidth1 = pill.width - glyphPad * 2
            bgView?.layoutParams = FrameLayout.LayoutParams(
                bgWidth1,
                pillHeight
            ).apply { leftMargin = glyphPad }
            (bgView?.background as? GradientDrawable)?.cornerRadius = pillHeight / 2f

            val borderView1 = pill.view.findViewWithTag<View>(997)
            borderView1?.layoutParams = FrameLayout.LayoutParams(
                bgWidth1,
                pillHeight
            ).apply { leftMargin = glyphPad }
            (borderView1?.background as? GradientDrawable)?.cornerRadius = pillHeight / 2f

            val labelView = pill.view.findViewWithTag<View>(998)
            labelView?.layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )

            pill.view.layoutParams = LinearLayout.LayoutParams(pill.width, pillHeight)
            scrollContent.addView(pill.view)

        } else {
            // Overflow — pack with fixed spacing, will scroll
            // Leading padding
            val leadingPad = View(context)
            leadingPad.layoutParams = LinearLayout.LayoutParams(barPaddingH, pillHeight)
            scrollContent.addView(leadingPad)

            for ((i, pill) in orderedPills.withIndex()) {
                val bgView = pill.view.findViewWithTag<View>(999)
                val bgWidth2 = pill.width - glyphPad * 2
                bgView?.layoutParams = FrameLayout.LayoutParams(
                    bgWidth2,
                    pillHeight
                ).apply { leftMargin = glyphPad }
                (bgView?.background as? GradientDrawable)?.cornerRadius = pillHeight / 2f

                val borderView2 = pill.view.findViewWithTag<View>(997)
                borderView2?.layoutParams = FrameLayout.LayoutParams(
                    bgWidth2,
                    pillHeight
                ).apply { leftMargin = glyphPad }
                (borderView2?.background as? GradientDrawable)?.cornerRadius = pillHeight / 2f

                val labelView = pill.view.findViewWithTag<View>(998)
                labelView?.layoutParams = FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.WRAP_CONTENT,
                    Gravity.CENTER_VERTICAL
                )

                val params = LinearLayout.LayoutParams(pill.width, pillHeight)
                if (i > 0) params.leftMargin = pillSpacing
                pill.view.layoutParams = params
                scrollContent.addView(pill.view)
            }

            // Trailing padding
            val trailingPad = View(context)
            trailingPad.layoutParams = LinearLayout.LayoutParams(barPaddingH, pillHeight)
            scrollContent.addView(trailingPad)
        }

        // For RTL, scroll to the right end
        val contentWidth = if (evenlySpaced) barWidth else {
            totalPillsWidth + pillSpacing * maxOf(0, orderedPills.size - 1) + barPaddingH * 2
        }
        if (isRTL && contentWidth > barWidth) {
            scroll.post { scroll.scrollTo(contentWidth - barWidth, 0) }
        } else {
            scroll.scrollTo(0, 0)
        }
    }

    /** Resolve the font typeface to use based on config settings */
    private fun resolveFont(barHeight: Float): Typeface? {
        return customFont  // null means system default
    }

    /** Resolve the font size to use based on config settings and bar height */
    private fun resolveFontSize(barHeight: Float): Float {
        // Font size: use custom if set, otherwise derive from bar height (~65% of bar height)
        // Slightly larger than iOS (0.55) to compensate for Android text rendering differences
        return customFontSize ?: (barHeight * 0.65f)
    }

    /** Measure text width for a given string using the label's paint */
    private fun measureTextWidth(text: String, label: TextView): Int {
        return label.paint.measureText(text).toInt()
    }

    /** Check if the current keyboard is RTL (Hebrew or Arabic) */
    private fun isCurrentKeyboardRTL(): Boolean {
        val keyboardId = currentKeyboardId ?: return false
        return keyboardId.startsWith("he") || keyboardId.startsWith("ar")
    }

    // MARK: - Actions

    private fun suggestionTapped(suggestion: String) {
        debugLog("📝 SuggestionsBarView: Suggestion tapped: '$suggestion'")
        onSuggestionSelected?.invoke(suggestion)
    }

    // MARK: - Utility

    private fun dpToPx(dp: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            dp.toFloat(),
            context.resources.displayMetrics
        ).toInt()
    }
}
