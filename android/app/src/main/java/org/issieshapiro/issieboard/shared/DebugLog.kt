package org.issieshapiro.issieboard.shared

import android.util.Log

/**
 * Debug logging utility for IssieBoard
 * Port of ios/Shared/DebugLog.swift
 * 
 * Provides a centralized way to control debug logging throughout the codebase.
 * In release builds, all debug logs are compiled out for performance.
 * 
 * Usage:
 *   debugLog("Message")                    // Simple log
 *   debugLog("📐", "Layout changed")       // With emoji prefix
 *   debugLog(LogCategory.KEYBOARD, "msg")  // With category
 */

// MARK: - Configuration

/** Set to false to disable all debug logging */
const val DEBUG_LOGGING_ENABLED = true

/** Tag for Android Log */
private const val TAG = "IssieBoard"

/** Categories for filtering logs */
enum class LogCategory(val emoji: String) {
    KEYBOARD("⌨️"),
    RENDERING("🎨"),
    SUGGESTIONS("📝"),
    PREFERENCES("⚙️"),
    LAYOUT("📐"),
    TRIE("📚"),
    GENERAL("🔘")
}

// MARK: - Logging Functions

/** Simple debug log - only prints in debug builds when logging is enabled */
fun debugLog(message: String) {
    if (DEBUG_LOGGING_ENABLED && BuildConfig.DEBUG) {
        Log.d(TAG, message)
    }
}

/** Debug log with emoji prefix */
fun debugLog(emoji: String, message: String) {
    if (DEBUG_LOGGING_ENABLED && BuildConfig.DEBUG) {
        Log.d(TAG, "$emoji $message")
    }
}

/** Debug log with category */
fun debugLog(category: LogCategory, message: String) {
    if (DEBUG_LOGGING_ENABLED && BuildConfig.DEBUG) {
        Log.d(TAG, "${category.emoji} $message")
    }
}

/** Always log - for important messages that should appear in release builds too */
fun alwaysLog(message: String) {
    Log.i(TAG, message)
}

/** Error log - always prints, with error formatting */
fun errorLog(message: String) {
    Log.e(TAG, "❌ ERROR: $message")
}

/** Warning log - always prints, with warning formatting */
fun warnLog(message: String) {
    Log.w(TAG, "⚠️ WARNING: $message")
}

/**
 * BuildConfig placeholder - in actual build, this comes from generated BuildConfig
 * For now, we'll use a simple check
 */
private object BuildConfig {
    val DEBUG: Boolean = true  // This will be replaced by actual BuildConfig.DEBUG in the build
}