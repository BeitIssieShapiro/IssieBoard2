package com.issieboardng.shared

import android.os.Handler
import android.os.Looper
import java.util.Date

/**
 * Handles long-press backspace behavior with progressive deletion speed.
 * 
 * Port of ios/Shared/BackspaceHandler.swift
 * 
 * Behavior:
 * - Single tap: Delete one character immediately
 * - Hold 0.5s+: Start continuous character deletion
 * - Hold 3s+: Switch to word deletion
 * - Speed increases the longer you hold
 *
 * This class is designed to be used by KeyboardRenderer and maps 1:1 from Swift.
 */
class BackspaceHandler {
    
    // MARK: - Callbacks
    
    /** Called to delete a single character */
    var onDeleteCharacter: (() -> Unit)? = null
    
    /** Called to delete an entire word */
    var onDeleteWord: (() -> Unit)? = null
    
    // MARK: - Timer State
    
    private val handler = Handler(Looper.getMainLooper())
    private var timerRunnable: Runnable? = null
    private var backspacePressStartTime: Long? = null
    private var backspaceDeleteCount: Int = 0
    private var lastBackspaceDeleteTime: Long? = null
    private var backspaceStartedContinuousDelete: Boolean = false
    
    // MARK: - Timing Constants
    
    /** Delay before continuous deletion starts (milliseconds) */
    private val charDeleteStartDelay: Long = 500L  // 0.5 seconds
    
    /** Delay before switching to word deletion (milliseconds) */
    private val wordDeleteStartDelay: Long = 3000L  // 3.0 seconds
    
    /** Initial interval between deletes (milliseconds) */
    private val initialDeleteInterval: Long = 200L  // 0.2 seconds
    
    /** Minimum interval between deletes (milliseconds) - fastest speed */
    private val minDeleteInterval: Long = 50L  // 0.05 seconds
    
    /** Speed multiplier applied after each delete (< 1 = faster) */
    private val deleteSpeedupFactor: Double = 0.9
    
    /** Current delete interval (decreases as user holds longer) */
    private var currentDeleteInterval: Long = 200L
    
    // MARK: - Initialization
    
    init {
        debugLog("⌫ BackspaceHandler initialized")
    }
    
    // MARK: - Public Touch Handlers
    
    /** Called when backspace button is touched down */
    fun handleTouchDown() {
        debugLog("⌫ Backspace touch DOWN")
        
        // Record the start time
        val startTime = System.currentTimeMillis()
        
        // Reset counters
        backspaceDeleteCount = 0
        currentDeleteInterval = initialDeleteInterval
        lastBackspaceDeleteTime = null
        backspaceStartedContinuousDelete = false
        
        // Perform initial delete immediately
        performCharacterDelete()
        
        // Set the start time AFTER initial delete
        backspacePressStartTime = startTime
        debugLog("⌫ Start time set to: $startTime")
        
        // Start the timer for long-press detection
        startTimer()
    }
    
    /** Called when backspace button is released */
    fun handleTouchUp() {
        debugLog("⌫ Backspace touch UP - stopping timer")
        stopTimer()
    }
    
    /** Called when backspace touch is cancelled */
    fun handleTouchCancelled() {
        debugLog("⌫ Backspace touch CANCELLED - stopping timer")
        stopTimer()
    }
    
    // MARK: - Timer Management
    
    /** Start the backspace long-press timer */
    private fun startTimer() {
        // Cancel any existing timer
        stopTimer()
        
        // Create timer runnable that fires every 50ms
        timerRunnable = object : Runnable {
            override fun run() {
                handleTimerTick()
                // Schedule next tick
                timerRunnable?.let { handler.postDelayed(it, 50L) }
            }
        }
        
        // Start the timer
        timerRunnable?.let { handler.postDelayed(it, 50L) }
        
        debugLog("⌫ Timer started")
    }
    
    /** Stop the backspace timer and clear all state */
    private fun stopTimer() {
        timerRunnable?.let { handler.removeCallbacks(it) }
        timerRunnable = null
        backspacePressStartTime = null
        lastBackspaceDeleteTime = null
        backspaceDeleteCount = 0
        currentDeleteInterval = initialDeleteInterval
    }
    
    /** Handle each tick of the backspace timer */
    private fun handleTimerTick() {
        val startTime = backspacePressStartTime
        if (startTime == null) {
            debugLog("⌫ Timer tick: No start time, stopping")
            stopTimer()
            return
        }
        
        val now = System.currentTimeMillis()
        val elapsed = now - startTime
        
        // Only start deleting after the initial delay
        if (elapsed < charDeleteStartDelay) {
            return
        }
        
        // Check if enough time has passed since the last delete
        val timeSinceLastDelete: Long = lastBackspaceDeleteTime?.let { lastDelete ->
            now - lastDelete
        } ?: currentDeleteInterval  // First delete after delay - force immediate
        
        // If we've waited long enough, perform a delete
        if (timeSinceLastDelete >= currentDeleteInterval) {
            lastBackspaceDeleteTime = now
            performDeleteAction(elapsed)
        }
    }
    
    /** Perform the appropriate delete action based on elapsed time */
    private fun performDeleteAction(elapsed: Long) {
        if (elapsed >= wordDeleteStartDelay) {
            // After 3 seconds: delete whole words
            debugLog("⌫ Deleting WORD (elapsed: ${String.format("%.1f", elapsed / 1000.0)}s)")
            performWordDelete()
        } else {
            // Between 0.5-3 seconds: delete characters at increasing speed
            debugLog("⌫ Deleting CHAR (elapsed: ${String.format("%.1f", elapsed / 1000.0)}s, interval: ${String.format("%.3f", currentDeleteInterval / 1000.0)}s)")
            performCharacterDelete()
        }
        
        // Increase speed (decrease interval) after each delete
        backspaceDeleteCount += 1
        currentDeleteInterval = maxOf(minDeleteInterval, (currentDeleteInterval * deleteSpeedupFactor).toLong())
    }
    
    /** Delete a single character */
    private fun performCharacterDelete() {
        onDeleteCharacter?.invoke()
    }
    
    /** Delete an entire word */
    private fun performWordDelete() {
        val wordDelete = onDeleteWord
        if (wordDelete != null) {
            wordDelete()
        } else {
            // Fall back to character delete if word delete not implemented
            performCharacterDelete()
        }
    }
}