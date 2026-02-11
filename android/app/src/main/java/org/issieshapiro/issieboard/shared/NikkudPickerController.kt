package org.issieshapiro.issieboard.shared

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.PopupWindow
import kotlin.math.max
import kotlin.math.min

/**
 * Manages the nikkud (diacritics) picker popup UI and logic.
 * 
 * Port of ios/Shared/NikkudPickerController.swift
 * Uses Android PopupWindow for reliable popup display.
 * 
 * Features:
 * - Shows diacritics options for a letter
 * - Supports modifier toggles (dagesh, shin/sin dots)
 * - Handles multi-option modifiers
 * - Language-aware (Hebrew/Arabic)
 *
 * This class is designed to be used by KeyboardRenderer and maps 1:1 from Swift.
 */
class NikkudPickerController(private val context: Context) {
    
    // MARK: - Callbacks
    
    /** Called when a nikkud option is selected */
    var onNikkudSelected: ((String) -> Unit)? = null
    
    /** Called when the picker is dismissed (to trigger keyboard re-render) */
    var onDismiss: (() -> Unit)? = null
    
    // MARK: - UI Constants
    
    private val buttonSize: Int = dpToPx(50)
    private val spacing: Int = dpToPx(10)
    private val padding: Int = dpToPx(16)
    
    // MARK: - State
    
    /** Current letter being edited in nikkud picker */
    private var currentLetter: String = ""
    
    /** Modifier toggle states - Key: modifier ID, Value: selected option ID (null = off) */
    private var modifierStates: MutableMap<String, String?> = mutableMapOf()
    
    /** Reference to the container view */
    private var container: ViewGroup? = null
    
    /** Current keyboard configuration */
    private var config: KeyboardConfig? = null
    
    /** Current keyboard ID */
    private var currentKeyboardId: String? = null
    
    /** Current popup window */
    private var currentPopupWindow: PopupWindow? = null
    
    /** Current anchor view for popup refresh */
    private var currentPopupAnchor: View? = null
    
    /** Flag to prevent dismiss callback during internal refresh */
    private var isInternalRefresh: Boolean = false
    
    /** Reference to the main popup content layout for in-place updates */
    private var popupContentLayout: LinearLayout? = null
    
    /** Reference to the nikkud options container for in-place updates */
    private var nikkudOptionsContainer: LinearLayout? = null
    
    /** Reference to the modifier row for in-place updates */
    private var modifierRowContainer: LinearLayout? = null
    
    // MARK: - Initialization
    
    init {
        debugLog("🎨 NikkudPickerController initialized")
    }
    
    // MARK: - Configuration
    
    /** Set the configuration for diacritics lookup */
    fun configure(config: KeyboardConfig?, keyboardId: String?, container: ViewGroup?) {
        this.config = config
        this.currentKeyboardId = keyboardId
        this.container = container
    }
    
    /** Get the current letter being edited */
    val currentNikkudLetter: String
        get() = currentLetter
    
    // MARK: - Public Methods
    
    /** Show nikkud picker for a key */
    fun showPicker(key: ParsedKey, anchorView: View) {
        debugLog("📋 showPicker called for key: '${key.value}'")
        
        // Dismiss any existing popup
        currentPopupWindow?.dismiss()
        currentPopupWindow = null
        
        // Get the letter from the key
        if (key.value.isNotEmpty()) {
            currentLetter = key.value.first().toString()
            debugLog("   Current letter set to: '$currentLetter'")
        }
        
        currentPopupAnchor = anchorView
        
        // Check if we should use diacritics system (with modifier toggle)
        val diacritics = config?.getDiacritics(currentKeyboardId)
        if (diacritics != null && currentLetter.isNotEmpty()) {
            debugLog("   Using diacritics system with modifier toggle")
            showPickerInternal(forLetter = currentLetter, anchorView = anchorView)
        } else if (key.nikkud.isNotEmpty()) {
            // Fallback to explicit options (backward compatibility)
            debugLog("   Using explicit nikkud options (backward compatibility)")
            showPickerWithOptions(key.nikkud, anchorView)
        }
    }
    
    /** Refresh the picker if open (used when diacritics settings change) */
    fun refreshIfOpen(anchorView: View) {
        if (currentLetter.isEmpty() || currentPopupWindow == null) {
            debugLog("📱 refreshIfOpen: No current letter or popup")
            return
        }
        
        debugLog("📱 refreshIfOpen: Refreshing picker for letter '$currentLetter'")
        showPickerInternal(forLetter = currentLetter, anchorView = anchorView)
    }
    
    /** Dismiss the picker */
    fun dismiss() {
        debugLog("🎯 Dismissing nikkud picker")
        
        currentPopupWindow?.dismiss()
        currentPopupWindow = null
        currentPopupAnchor = null
        
        // Reset all modifier toggle states
        modifierStates.clear()
        currentLetter = ""
        
        // Notify for keyboard re-render
        onDismiss?.invoke()
    }
    
    // MARK: - Diacritics Logic
    
    /** Check if diacritics popup should be shown for this key */
    fun shouldShowDiacriticsPopup(key: ParsedKey): Boolean {
        // If the key has explicit nikkud options, always show popup
        if (key.nikkud.isNotEmpty()) {
            debugLog("   → shouldShowDiacriticsPopup: YES (explicit nikkud)")
            return true
        }
        
        // Check if the character is in the appliesTo list
        val config = config
        val diacritics = config?.getDiacritics(currentKeyboardId)
        if (config == null || diacritics == null) {
            debugLog("   → shouldShowDiacriticsPopup: NO (no diacritics definition)")
            return false
        }
        
        val applies = diacritics.appliesTo(key.value)
        debugLog("   → shouldShowDiacriticsPopup: ${if (applies) "YES" else "NO"} (character '${key.value}' ${if (applies) "is" else "is NOT"} in appliesTo)")
        return applies
    }
    
    /** Get diacritics for a key */
    fun getDiacriticsForKey(key: ParsedKey): List<NikkudOption> {
        debugLog("🔍 getDiacriticsForKey: value='${key.value}', explicit nikkud=${key.nikkud.size}")
        
        // If the key has explicit nikkud options, use them
        if (key.nikkud.isNotEmpty()) {
            debugLog("   → Using explicit nikkud (${key.nikkud.size} options)")
            return key.nikkud
        }
        
        val config = config
        if (config == null) {
            debugLog("   → No config available!")
            return emptyList()
        }
        
        val diacritics = config.getDiacritics(currentKeyboardId)
        debugLog("   → Config available, diacritics for '${currentKeyboardId ?: "nil"}': ${if (diacritics != null) "YES" else "NO"}")
        
        if (diacritics == null) {
            debugLog("   → No diacritics definition for this keyboard")
            return emptyList()
        }
        
        debugLog("   → Diacritics definition found with ${diacritics.items.size} items")
        
        val settings = config.diacriticsSettings?.get(currentKeyboardId ?: "")
        
        val generated = DiacriticsGenerator.getDiacritics(key, diacritics, settings)
        debugLog("   → Generated ${generated.size} diacritics options")
        return generated
    }
    
    // MARK: - Private UI Methods
    
    /** Show picker with explicit options (backward compatibility) */
    private fun showPickerWithOptions(nikkudOptions: List<NikkudOption>, anchorView: View) {
        debugLog("🎯 Showing nikkud picker with ${nikkudOptions.size} explicit options")
        
        // Calculate layout
        val itemsPerRow = min(6, max(3, nikkudOptions.size))
        
        // Create main container
        val mainLayout = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(padding, padding, padding, padding)
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                setColor(Color.parseColor("#F2F2F7"))
                cornerRadius = dpToPx(16).toFloat()
                setStroke(dpToPx(1), Color.parseColor("#AAAAAA"))
            }
            elevation = dpToPx(8).toFloat()
        }
        
        // Build rows dynamically
        val rows = nikkudOptions.chunked(itemsPerRow)
        rows.forEachIndexed { rowIndex, rowOptions ->
            val rowLayout = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    if (rowIndex > 0) topMargin = spacing
                }
            }
            
            rowOptions.forEachIndexed { colIndex, option ->
                val button = createNikkudButton(option.caption ?: option.value, option.value)
                val params = LinearLayout.LayoutParams(buttonSize, buttonSize)
                if (colIndex > 0) params.marginStart = spacing
                rowLayout.addView(button, params)
            }
            mainLayout.addView(rowLayout)
        }
        
        // Create and show popup
        showPopup(mainLayout, anchorView)
        
        debugLog("✅ Nikkud picker displayed with ${nikkudOptions.size} explicit options")
    }
    
    /** Internal method to show nikkud picker with modifier support */
    private fun showPickerInternal(forLetter: String, anchorView: View) {
        debugLog("🎯 Showing nikkud picker for letter '$forLetter', modifiers: $modifierStates")
        
        // Check if modifier is available
        val hasModifier = checkIfModifierApplies(forLetter)
        
        // Generate options
        val anyModifierActive = modifierStates.isNotEmpty() && modifierStates.values.any { it != null }
        val nikkudOptions = generateNikkudOptions(forLetter = forLetter, withModifier = anyModifierActive && hasModifier)
        
        debugLog("   Has modifier: $hasModifier")
        debugLog("   Options count: ${nikkudOptions.size}")
        
        if (nikkudOptions.isEmpty()) {
            debugLog("   No options to show!")
            return
        }
        
        // Calculate layout
        val itemsPerRow = min(6, max(3, nikkudOptions.size))
        
        // Create main container
        val mainLayout = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(padding, padding, padding, padding)
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                setColor(Color.parseColor("#F2F2F7"))
                cornerRadius = dpToPx(16).toFloat()
                setStroke(dpToPx(1), Color.parseColor("#AAAAAA"))
            }
            elevation = dpToPx(8).toFloat()
        }
        
        // Create options container (separate from modifier row for in-place updates)
        val optionsContainer = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
        }
        
        // Build rows dynamically
        val rows = nikkudOptions.chunked(itemsPerRow)
        rows.forEachIndexed { rowIndex, rowOptions ->
            val rowLayout = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    if (rowIndex > 0) topMargin = spacing
                }
            }
            
            rowOptions.forEachIndexed { colIndex, option ->
                val button = createNikkudButton(option.caption ?: option.value, option.value)
                val params = LinearLayout.LayoutParams(buttonSize, buttonSize)
                if (colIndex > 0) params.marginStart = spacing
                rowLayout.addView(button, params)
            }
            optionsContainer.addView(rowLayout)
        }
        mainLayout.addView(optionsContainer)
        
        // Add modifier row if applicable
        var modifierRow: LinearLayout? = null
        if (hasModifier) {
            modifierRow = createModifierRow(forLetter) as LinearLayout
            mainLayout.addView(modifierRow, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = dpToPx(12)
            })
        }
        
        // Store references for in-place updates
        popupContentLayout = mainLayout
        nikkudOptionsContainer = optionsContainer
        modifierRowContainer = modifierRow
        
        // Create and show popup
        showPopup(mainLayout, anchorView)
        
        debugLog("✅ Nikkud picker displayed with ${nikkudOptions.size} options, modifier toggle: $hasModifier")
    }
    
    /** Create and show PopupWindow - always centered relative to container */
    private fun showPopup(content: View, anchorView: View, isRefresh: Boolean = false) {
        // For refresh (modifier toggle), we need to dismiss and recreate silently
        val wasPopupVisible = currentPopupWindow != null
        
        // Dismiss existing popup without triggering full dismiss logic
        currentPopupWindow?.setOnDismissListener(null)  // Disable listener temporarily
        currentPopupWindow?.dismiss()
        
        // Create PopupWindow
        val popupWindow = PopupWindow(
            content,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            true
        ).apply {
            isOutsideTouchable = true
            isFocusable = true
            isClippingEnabled = true  // Allow clipping to screen bounds
            setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
            elevation = dpToPx(24).toFloat()
            inputMethodMode = PopupWindow.INPUT_METHOD_NOT_NEEDED
            
            setOnDismissListener {
                debugLog("🎯 PopupWindow dismissed, isInternalRefresh=$isInternalRefresh")
                // Don't clear state or call onDismiss if this is an internal refresh
                if (!isInternalRefresh && currentPopupWindow == this) {
                    modifierStates.clear()
                    currentLetter = ""
                    currentPopupWindow = null
                    currentPopupAnchor = null
                    onDismiss?.invoke()
                }
            }
        }
        
        currentPopupWindow = popupWindow
        
        // Measure content to calculate popup size
        content.measure(
            View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED),
            View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED)
        )
        val popupWidth = content.measuredWidth
        val popupHeight = content.measuredHeight
        
        // Use container for positioning (the keyboard view)
        val containerView = container ?: anchorView.rootView
        
        // Get container's location on screen and dimensions
        val containerLocation = IntArray(2)
        containerView.getLocationOnScreen(containerLocation)
        val containerWidth = containerView.width
        val containerHeight = containerView.height
        
        // Calculate center position within the container
        val centerX = containerLocation[0] + (containerWidth - popupWidth) / 2
        val centerY = containerLocation[1] + (containerHeight - popupHeight) / 2
        
        debugLog("📋 Container: ${containerWidth}x${containerHeight} at (${containerLocation[0]}, ${containerLocation[1]})")
        debugLog("📋 Popup: ${popupWidth}x${popupHeight}, placing at ($centerX, $centerY)")
        
        // Show popup at calculated center position
        try {
            popupWindow.showAtLocation(containerView, Gravity.NO_GRAVITY, centerX, centerY)
            debugLog("📋 Popup shown centered at: x=$centerX, y=$centerY")
        } catch (e: Exception) {
            errorLog("Failed to show popup: ${e.message}")
        }
    }
    
    private fun createNikkudButton(caption: String, value: String): Button {
        return Button(context).apply {
            text = caption
            textSize = 24f
            gravity = Gravity.CENTER
            isAllCaps = false
            
            val bgDrawable = GradientDrawable().apply {
                setColor(Color.WHITE)
                cornerRadius = dpToPx(8).toFloat()
                setStroke(dpToPx(1), Color.parseColor("#C7C7CC"))
            }
            background = bgDrawable
            setTextColor(Color.BLACK)
            
            tag = value
            setOnClickListener { v ->
                nikkudOptionTapped(v)
            }
        }
    }
    
    private fun createModifierRow(letter: String): ViewGroup {
        val modifierRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }
        
        val applicableModifiers = getModifiersForLetter(letter)
        val modifierButtonSize = (buttonSize * 0.85).toInt()
        
        for ((index, modifier) in applicableModifiers.withIndex()) {
            val currentState = modifierStates[modifier.id]
            
            if (modifier.isMultiOption && modifier.options != null) {
                // Multi-option modifier (e.g., shin/sin dots)
                val groupContainer = LinearLayout(context).apply {
                    orientation = LinearLayout.HORIZONTAL
                    val bgDrawable = GradientDrawable().apply {
                        setColor(Color.parseColor("#80F2F2F7"))
                        cornerRadius = dpToPx(10).toFloat()
                        setStroke(dpToPx(2), Color.parseColor("#C7C7CC"))
                    }
                    background = bgDrawable
                    setPadding(dpToPx(8), dpToPx(8), dpToPx(8), dpToPx(8))
                }
                
                // "None" button
                val noneButton = createModifierKeyButton(letter, currentState == null, modifierButtonSize)
                noneButton.tag = "${modifier.id}:none"
                noneButton.setOnClickListener { v -> multiOptionModifierTapped(v) }
                groupContainer.addView(noneButton, LinearLayout.LayoutParams(modifierButtonSize, modifierButtonSize))
                
                // Option buttons
                for (option in modifier.options) {
                    val displayText = letter + option.mark
                    val optionButton = createModifierKeyButton(displayText, currentState == option.id, modifierButtonSize)
                    optionButton.tag = "${modifier.id}:${option.id}"
                    optionButton.setOnClickListener { v -> multiOptionModifierTapped(v) }
                    groupContainer.addView(optionButton, LinearLayout.LayoutParams(modifierButtonSize, modifierButtonSize).apply {
                        marginStart = dpToPx(6)
                    })
                }
                
                modifierRow.addView(groupContainer, LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    if (index > 0) marginStart = dpToPx(6)
                })
                
            } else if (modifier.mark != null) {
                // Simple toggle modifier (e.g., dagesh)
                val isActive = currentState != null
                val displayText = letter + modifier.mark
                
                val toggleButton = createModifierKeyButton(displayText, isActive, modifierButtonSize)
                toggleButton.tag = modifier.id
                toggleButton.setOnClickListener { v -> modifierToggleTapped(v) }
                
                modifierRow.addView(toggleButton, LinearLayout.LayoutParams(modifierButtonSize, modifierButtonSize).apply {
                    if (index > 0) marginStart = dpToPx(6)
                })
            }
        }
        
        return modifierRow
    }
    
    /** Create a raised key-style button for modifiers */
    private fun createModifierKeyButton(title: String, isSelected: Boolean, size: Int): Button {
        return Button(context).apply {
            text = title
            textSize = 20f
            setTypeface(typeface, Typeface.BOLD)
            gravity = Gravity.CENTER
            isAllCaps = false
            
            val bgDrawable = GradientDrawable().apply {
                if (isSelected) {
                    setColor(Color.parseColor("#4D2196F3"))  // systemBlue with 30% alpha
                    setStroke(dpToPx(2), Color.parseColor("#2196F3"))
                } else {
                    setColor(Color.WHITE)
                    setStroke(dpToPx(1), Color.parseColor("#C7C7CC"))
                }
                cornerRadius = dpToPx(5).toFloat()
            }
            background = bgDrawable
            
            if (isSelected) {
                setTextColor(Color.parseColor("#2196F3"))
            } else {
                setTextColor(Color.BLACK)
            }
            
            elevation = if (isSelected) dpToPx(1).toFloat() else dpToPx(2).toFloat()
        }
    }
    
    // MARK: - Modifier Logic
    
    /** Get modifiers that apply to the given letter */
    private fun getModifiersForLetter(letter: String): List<DiacriticModifier> {
        val diacritics = config?.getDiacritics(currentKeyboardId) ?: return emptyList()
        
        val settings = config?.diacriticsSettings?.get(currentKeyboardId ?: "")
        val allModifiers = diacritics.getModifiersForLetter(letter)
        
        return allModifiers.filter { modifier ->
            settings?.isModifierEnabled(modifier.id) ?: true
        }
    }
    
    /** Check if any modifier applies to the given letter */
    private fun checkIfModifierApplies(letter: String): Boolean {
        return getModifiersForLetter(letter).isNotEmpty()
    }
    
    /** Generate nikkud options for a letter */
    private fun generateNikkudOptions(forLetter: String, withModifier: Boolean): List<NikkudOption> {
        val config = config
        val diacritics = config?.getDiacritics(currentKeyboardId)
        
        if (config == null || diacritics == null) {
            debugLog("🔍 generateNikkudOptions: No config or diacritics!")
            return emptyList()
        }
        
        val keyboardId = currentKeyboardId ?: ""
        val settings = config.diacriticsSettings?.get(keyboardId)
        val hidden = settings?.hidden ?: emptyList()
        val applicableModifiers = getModifiersForLetter(forLetter)
        
        debugLog("🔍 generateNikkudOptions for '$forLetter':")
        debugLog("   keyboardId: '$keyboardId'")
        debugLog("   hidden items: $hidden")
        
        val result = mutableListOf<NikkudOption>()
        
        for (item in diacritics.items) {
            // Skip if hidden
            if (hidden.contains(item.id)) continue
            
            // Skip if not applicable
            if (item.onlyFor != null && !item.onlyFor.contains(forLetter)) continue
            if (item.excludeFor != null && item.excludeFor.contains(forLetter)) continue
            
            val isReplacement = item.isReplacement ?: false
            var value: String = if (isReplacement) item.mark else forLetter
            
            // Apply active modifiers
            if (!isReplacement) {
                for (modifier in applicableModifiers) {
                    val activeState = modifierStates[modifier.id]
                    if (activeState == null) continue
                    
                    if (modifier.isMultiOption) {
                        val selectedOptionId = activeState
                        val selectedOption = modifier.options?.find { it.id == selectedOptionId }
                        if (selectedOption != null) {
                            value += selectedOption.mark
                        }
                    } else if (modifier.mark != null) {
                        value += modifier.mark
                    }
                }
                
                // Add the diacritic mark
                value += item.mark
            }
            
            result.add(NikkudOption(value = value, caption = value, sValue = null, sCaption = null))
        }
        
        return result
    }
    
    // MARK: - Actions
    
    private fun nikkudOptionTapped(view: View) {
        val value = view.tag as? String
        debugLog("🎯 Nikkud option tapped: $value")
        
        // Dismiss popup first (before calling callback to prevent blink)
        // Remove listener before dismissing to prevent onDismiss callback
        currentPopupWindow?.setOnDismissListener(null)
        currentPopupWindow?.dismiss()
        
        // Clean up state manually (since we removed the listener)
        modifierStates.clear()
        currentLetter = ""
        currentPopupWindow = null
        currentPopupAnchor = null
        
        // Now call the callback (after popup is already dismissed)
        if (value != null) {
            debugLog("🎯 Calling onNikkudSelected callback with value: '$value'")
            onNikkudSelected?.invoke(value)
        } else {
            debugLog("🎯 ⚠️ No value found in tag!")
        }
        
        // Don't call onDismiss here - it causes keyboard blink
        // The keyboard will rerender when the text is inserted anyway
    }
    
    private fun modifierToggleTapped(view: View) {
        val modifierId = view.tag as? String ?: "dagesh"
        val currentState = modifierStates[modifierId]
        
        debugLog("🔄 Modifier toggle tapped: '$modifierId', was: $currentState")
        
        if (currentState != null) {
            modifierStates[modifierId] = null
        } else {
            modifierStates[modifierId] = ""
        }
        
        // Update popup content in-place without recreating popup
        updatePopupContentInPlace()
    }
    
    private fun multiOptionModifierTapped(view: View) {
        val hint = view.tag as? String ?: return
        
        val parts = hint.split(":")
        if (parts.size != 2) return
        
        val modifierId = parts[0]
        val optionId = parts[1]
        
        debugLog("🔄 Multi-option modifier tapped: '$modifierId' option: '$optionId'")
        
        if (optionId == "none") {
            modifierStates[modifierId] = null
        } else {
            modifierStates[modifierId] = optionId
        }
        
        // Update popup content in-place without recreating popup
        updatePopupContentInPlace()
    }
    
    /** Update the popup content in-place without recreating the popup */
    private fun updatePopupContentInPlace() {
        val contentLayout = popupContentLayout ?: return
        val optionsContainer = nikkudOptionsContainer ?: return
        
        debugLog("🔄 Updating popup content in-place")
        
        // Generate new nikkud options with current modifier state
        val anyModifierActive = modifierStates.isNotEmpty() && modifierStates.values.any { it != null }
        val hasModifier = checkIfModifierApplies(currentLetter)
        val nikkudOptions = generateNikkudOptions(forLetter = currentLetter, withModifier = anyModifierActive && hasModifier)
        
        // Update nikkud option buttons in the options container
        var optionIndex = 0
        for (rowIndex in 0 until optionsContainer.childCount) {
            val rowView = optionsContainer.getChildAt(rowIndex) as? LinearLayout ?: continue
            for (buttonIndex in 0 until rowView.childCount) {
                val button = rowView.getChildAt(buttonIndex) as? Button ?: continue
                if (optionIndex < nikkudOptions.size) {
                    val option = nikkudOptions[optionIndex]
                    button.text = option.caption ?: option.value
                    button.tag = option.value
                    optionIndex++
                }
            }
        }
        
        // Update modifier buttons visual state
        val modifierRow = modifierRowContainer ?: return
        updateModifierRowVisuals(modifierRow)
        
        debugLog("🔄 Popup content updated in-place")
    }
    
    /** Update modifier row button visuals based on current state */
    private fun updateModifierRowVisuals(modifierRow: LinearLayout) {
        for (i in 0 until modifierRow.childCount) {
            val child = modifierRow.getChildAt(i)
            
            if (child is Button) {
                // Simple toggle modifier
                val modifierId = child.tag as? String ?: continue
                val isSelected = modifierStates[modifierId] != null
                updateModifierButtonVisual(child, isSelected)
            } else if (child is LinearLayout) {
                // Multi-option modifier group
                for (j in 0 until child.childCount) {
                    val button = child.getChildAt(j) as? Button ?: continue
                    val tag = button.tag as? String ?: continue
                    
                    val parts = tag.split(":")
                    if (parts.size != 2) continue
                    
                    val modifierId = parts[0]
                    val optionId = parts[1]
                    
                    val currentState = modifierStates[modifierId]
                    val isSelected = if (optionId == "none") currentState == null else currentState == optionId
                    updateModifierButtonVisual(button, isSelected)
                }
            }
        }
    }
    
    /** Update a single modifier button's visual state */
    private fun updateModifierButtonVisual(button: Button, isSelected: Boolean) {
        val bgDrawable = button.background as? GradientDrawable
        if (bgDrawable != null) {
            if (isSelected) {
                bgDrawable.setColor(Color.parseColor("#4D2196F3"))
                bgDrawable.setStroke(dpToPx(2), Color.parseColor("#2196F3"))
            } else {
                bgDrawable.setColor(Color.WHITE)
                bgDrawable.setStroke(dpToPx(1), Color.parseColor("#C7C7CC"))
            }
        }
        
        if (isSelected) {
            button.setTextColor(Color.parseColor("#2196F3"))
        } else {
            button.setTextColor(Color.BLACK)
        }
        
        button.elevation = if (isSelected) dpToPx(1).toFloat() else dpToPx(2).toFloat()
        button.invalidate()
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