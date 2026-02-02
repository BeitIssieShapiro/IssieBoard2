package com.issieboardng.shared

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout

/**
 * Manages the word suggestions bar UI at the top of the keyboard.
 * 
 * Port of ios/Shared/SuggestionsBarView.swift
 * 
 * Features:
 * - Displays up to 4 word suggestions
 * - Supports RTL layout for Hebrew/Arabic
 * - Highlights fuzzy match suggestions
 * - Handles suggestion tap callbacks
 *
 * This class is designed to be used by KeyboardRenderer and maps 1:1 from Swift.
 */
class SuggestionsBarView(private val context: Context) {
    
    // MARK: - Callbacks
    
    /** Called when a suggestion is tapped with the suggestion text */
    var onSuggestionSelected: ((String) -> Unit)? = null
    
    // MARK: - UI Constants
    
    val barHeight: Int = dpToPx(40)
    val fontSize: Float = 22f  // Larger than key font for better readability
    
    // MARK: - State
    
    /** Currently displayed suggestions */
    var currentSuggestions: List<String> = emptyList()
        private set
    
    /** Index of suggestion to highlight (for fuzzy matches) */
    var highlightIndex: Int? = null
        private set
    
    /** Current keyboard ID for RTL detection */
    var currentKeyboardId: String? = null
    
    // MARK: - UI Reference
    
    /** The suggestions bar view */
    private var barView: ViewGroup? = null
    
    // MARK: - Initialization
    
    init {
        debugLog("📝 SuggestionsBarView initialized")
    }
    
    // MARK: - Public Methods
    
    /**
     * Create the suggestions bar view
     * @param width Width of the container
     * @return The configured ViewGroup
     */
    fun createBar(width: Int): ViewGroup {
        val bar = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            setBackgroundColor(Color.parseColor("#E8E8E8"))  // systemGray5 equivalent
            // Use FrameLayout.LayoutParams since we're being added to a FrameLayout
            layoutParams = FrameLayout.LayoutParams(width, barHeight).apply {
                gravity = Gravity.TOP
            }
            tag = 888  // Tag to identify suggestions bar
        }
        barView = bar
        return bar
    }
    
    /**
     * Update suggestions to display
     * @param suggestions Array of suggested words (max 4)
     * @param highlightIndex Optional index of suggestion to highlight
     */
    fun updateSuggestions(suggestions: List<String>, highlightIndex: Int? = null) {
        debugLog("📝 SuggestionsBarView updateSuggestions: $suggestions, highlight: ${highlightIndex?.toString() ?: "none"}")
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
    }
    
    // MARK: - Private Rendering
    
    /** Render suggestions in the bar */
    private fun renderSuggestions() {
        val bar = barView
        if (bar == null) {
            debugLog("📝 SuggestionsBarView: No bar view, skipping render")
            return
        }
        
        // Clear existing views
        bar.removeAllViews()
        
        // If no suggestions, show nothing
        if (currentSuggestions.isEmpty()) {
            debugLog("📝 SuggestionsBarView: No suggestions to display")
            return
        }
        
        debugLog("📝 SuggestionsBarView: Displaying ${currentSuggestions.size} suggestions")
        
        val suggestionCount = minOf(currentSuggestions.size, 4)
        
        // Use parent width if bar width is 0, or wait for layout
        var barWidth = bar.width
        if (barWidth <= 0) {
            // Try to get width from parent
            val parent = bar.parent as? android.view.View
            barWidth = parent?.width ?: 0
        }
        if (barWidth <= 0) {
            // Post to render after layout
            debugLog("📝 SuggestionsBarView: Bar width is 0, posting to render later")
            bar.post { renderSuggestions() }
            return
        }
        
        val barViewHeight = if (bar.height > 0) bar.height else barHeight
        
        val cellWidth = barWidth / suggestionCount
        val dividerWidth = dpToPx(1)
        
        // Check if we should use RTL layout
        val isRTL = isCurrentKeyboardRTL()
        debugLog("📝 SuggestionsBarView: isRTL=$isRTL, keyboard=${currentKeyboardId ?: "nil"}")
        
        // Get suggestions in the order to display (reverse for RTL)
        val orderedSuggestions = if (isRTL) {
            currentSuggestions.take(4).reversed()
        } else {
            currentSuggestions.take(4)
        }
        
        // Calculate highlight index for ordered list
        val orderedHighlightIndex = if (isRTL && highlightIndex != null) {
            val maxIndex = minOf(currentSuggestions.size, 4) - 1
            maxIndex - (highlightIndex ?: 0)
        } else {
            highlightIndex
        }
        
        for ((displayIndex, suggestion) in orderedSuggestions.withIndex()) {
            // Check if this suggestion should be highlighted
            val isHighlighted = orderedHighlightIndex == displayIndex
            
            // Create tappable button
            val button = Button(context).apply {
                text = suggestion
                textSize = fontSize
                setTypeface(typeface, if (isHighlighted) Typeface.BOLD else Typeface.NORMAL)
                gravity = Gravity.CENTER
                isAllCaps = false
                
                // Remove default button styling and padding
                stateListAnimator = null
                elevation = 0f
                setPadding(0, 0, 0, 0)
                minimumHeight = 0
                minHeight = 0
                
                // Highlighted suggestion styling
                if (isHighlighted) {
                    setBackgroundColor(Color.parseColor("#262196F3"))  // systemBlue with 15% alpha
                    setTextColor(Color.parseColor("#2196F3"))  // systemBlue
                } else {
                    setBackgroundColor(Color.TRANSPARENT)
                    setTextColor(Color.BLACK)
                }
                
                // Store suggestion for retrieval on tap
                // Strip quotes from literal suggestions
                val insertValue = if (suggestion.startsWith("\"") && suggestion.endsWith("\"")) {
                    suggestion.drop(1).dropLast(1)
                } else {
                    suggestion
                }
                tag = insertValue
                
                setOnClickListener { v ->
                    suggestionTapped(v)
                }
            }
            
            // Add button with layout params - use MATCH_PARENT for height to fill the bar
            val params = LinearLayout.LayoutParams(cellWidth, LinearLayout.LayoutParams.MATCH_PARENT)
            bar.addView(button, params)
            
            // Add divider after each cell except the last
            if (displayIndex < suggestionCount - 1) {
                val divider = View(context).apply {
                    setBackgroundColor(Color.parseColor("#C7C7CC"))  // systemGray3 equivalent
                }
                val dividerParams = LinearLayout.LayoutParams(dividerWidth, (barViewHeight * 0.6).toInt())
                dividerParams.topMargin = (barViewHeight * 0.2).toInt()
                bar.addView(divider, dividerParams)
            }
        }
    }
    
    /** Check if the current keyboard is RTL (Hebrew or Arabic) */
    private fun isCurrentKeyboardRTL(): Boolean {
        val keyboardId = currentKeyboardId ?: return false
        return keyboardId == "he" || keyboardId == "ar"
    }
    
    // MARK: - Actions
    
    private fun suggestionTapped(view: View) {
        val suggestion = view.tag as? String ?: return
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