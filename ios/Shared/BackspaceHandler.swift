import UIKit

/**
 * Handles long-press backspace behavior with progressive deletion speed.
 * 
 * Behavior:
 * - Single tap: Delete one character immediately
 * - Hold 0.5s+: Start continuous character deletion
 * - Hold 3s+: Switch to word deletion
 * - Speed increases the longer you hold
 *
 * This class is designed to be used by KeyboardRenderer and maps 1:1 to Kotlin.
 */
class BackspaceHandler {
    
    // MARK: - Callbacks
    
    /// Called to delete a single character
    var onDeleteCharacter: (() -> Void)?
    
    /// Called to delete an entire word
    var onDeleteWord: (() -> Void)?
    
    // MARK: - Timer State
    
    private var backspaceTimer: Timer?
    private var backspacePressStartTime: Date?
    private var backspaceDeleteCount: Int = 0
    private var lastBackspaceDeleteTime: Date?
    private var backspaceStartedContinuousDelete: Bool = false
    
    // MARK: - Timing Constants
    
    /// Delay before continuous deletion starts (seconds)
    private let charDeleteStartDelay: TimeInterval = 0.5
    
    /// Delay before switching to word deletion (seconds)
    private let wordDeleteStartDelay: TimeInterval = 3.0
    
    /// Initial interval between deletes (seconds)
    private let initialDeleteInterval: TimeInterval = 0.2
    
    /// Minimum interval between deletes (seconds) - fastest speed
    private let minDeleteInterval: TimeInterval = 0.05
    
    /// Speed multiplier applied after each delete (< 1 = faster)
    private let deleteSpeedupFactor: Double = 0.9
    
    /// Current delete interval (decreases as user holds longer)
    private var currentDeleteInterval: TimeInterval = 0.2
    
    // MARK: - Initialization
    
    init() {
        debugLog("⌫ BackspaceHandler initialized")
        
        // Listen for keyboard render notifications to force stop timer
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleKeyboardWillRender),
            name: NSNotification.Name("KeyboardWillRender"),
            object: nil
        )
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
        stopTimer()
    }
    
    /// Called when keyboard is about to render - force stop timer to prevent issues
    @objc private func handleKeyboardWillRender() {
        if backspaceTimer != nil {
            debugLog("⌫ Keyboard will render - force stopping backspace timer")
            stopTimer()
        }
    }
    
    // MARK: - Public Touch Handlers
    
    /// Called when backspace button is touched down
    func handleTouchDown() {
        debugLog("⌫ Backspace touch DOWN")
        
        // First, ensure any previous timer is stopped
        stopTimer()
        
        // Record the start time
        let startTime = Date()
        
        // Reset counters
        backspaceDeleteCount = 0
        currentDeleteInterval = initialDeleteInterval
        lastBackspaceDeleteTime = nil
        backspaceStartedContinuousDelete = false
        
        // Perform initial delete immediately
        performCharacterDelete()
        
        // Set the start time AFTER initial delete
        backspacePressStartTime = startTime
        debugLog("⌫ Start time set to: \(startTime)")
        
        // Start the timer for long-press detection
        startTimer()
    }
    
    /// Called when backspace button is released
    func handleTouchUp() {
        debugLog("⌫ Backspace touch UP - stopping timer")
        stopTimer()
    }
    
    /// Called when backspace touch is cancelled
    func handleTouchCancelled() {
        debugLog("⌫ Backspace touch CANCELLED - stopping timer")
        stopTimer()
    }
    
    /// Force stop the timer (public method for external cleanup)
    func forceStopTimer() {
        debugLog("⌫ FORCE stopping timer")
        stopTimer()
    }
    
    // MARK: - Timer Management
    
    /// Start the backspace long-press timer
    private func startTimer() {
        // Invalidate any existing timer
        backspaceTimer?.invalidate()
        backspaceTimer = nil
        
        // Create timer and add to common run loop modes for keyboard extension compatibility
        let timer = Timer(timeInterval: 0.05, repeats: true) { [weak self] _ in
            self?.handleTimerTick()
        }
        
        // Add to common modes to ensure it fires during tracking (touch events)
        RunLoop.main.add(timer, forMode: .common)
        backspaceTimer = timer
        
        debugLog("⌫ Timer started and added to run loop")
    }
    
    /// Stop the backspace timer and clear all state
    private func stopTimer() {
        backspaceTimer?.invalidate()
        backspaceTimer = nil
        backspacePressStartTime = nil
        lastBackspaceDeleteTime = nil
        backspaceDeleteCount = 0
        currentDeleteInterval = initialDeleteInterval
    }
    
    /// Handle each tick of the backspace timer
    private func handleTimerTick() {
        guard let startTime = backspacePressStartTime else {
            debugLog("⌫ Timer tick: No start time, stopping")
            stopTimer()
            return
        }
        
        let now = Date()
        let elapsed = now.timeIntervalSince(startTime)
        
        // Only start deleting after the initial delay
        guard elapsed >= charDeleteStartDelay else {
            return
        }
        
        // Check if enough time has passed since the last delete
        let timeSinceLastDelete: TimeInterval
        if let lastDelete = lastBackspaceDeleteTime {
            timeSinceLastDelete = now.timeIntervalSince(lastDelete)
        } else {
            // First delete after delay - force immediate
            timeSinceLastDelete = currentDeleteInterval
        }
        
        // If we've waited long enough, perform a delete
        if timeSinceLastDelete >= currentDeleteInterval {
            lastBackspaceDeleteTime = now
            performDeleteAction(elapsed: elapsed)
        }
    }
    
    /// Perform the appropriate delete action based on elapsed time
    private func performDeleteAction(elapsed: TimeInterval) {
        if elapsed >= wordDeleteStartDelay {
            // After 3 seconds: delete whole words
            debugLog("⌫ Deleting WORD (elapsed: \(String(format: "%.1f", elapsed))s)")
            performWordDelete()
        } else {
            // Between 0.5-3 seconds: delete characters at increasing speed
            debugLog("⌫ Deleting CHAR (elapsed: \(String(format: "%.1f", elapsed))s, interval: \(String(format: "%.3f", currentDeleteInterval))s)")
            performCharacterDelete()
        }
        
        // Increase speed (decrease interval) after each delete
        backspaceDeleteCount += 1
        currentDeleteInterval = max(minDeleteInterval, currentDeleteInterval * deleteSpeedupFactor)
    }
    
    /// Delete a single character
    private func performCharacterDelete() {
        onDeleteCharacter?()
    }
    
    /// Delete an entire word
    private func performWordDelete() {
        if let onDeleteWord = onDeleteWord {
            onDeleteWord()
        } else {
            // Fall back to character delete if word delete not implemented
            performCharacterDelete()
        }
    }
}