import Foundation

/**
 * Debug logging utility for IssieBoardNG
 * 
 * Provides a centralized way to control debug logging throughout the codebase.
 * In release builds, all debug logs are compiled out for performance.
 * 
 * Usage:
 *   debugLog("Message")                    // Simple log
 *   debugLog("📐", "Layout changed")       // With emoji prefix
 *   debugLog(category: .keyboard, "msg")   // With category
 */

// MARK: - Configuration

/// Set to false to disable all debug logging
let DEBUG_LOGGING_ENABLED = true

/// Categories for filtering logs
enum LogCategory: String {
    case keyboard = "⌨️"
    case rendering = "🎨"
    case suggestions = "📝"
    case preferences = "⚙️"
    case layout = "📐"
    case trie = "📚"
    case general = "🔘"
}

// MARK: - Logging Functions

/// Simple debug log - only prints in debug builds when logging is enabled
@inline(__always)
func debugLog(_ message: String) {
    #if DEBUG
    if DEBUG_LOGGING_ENABLED {
        print(message)
    }
    #endif
}

/// Debug log with emoji prefix
@inline(__always)
func debugLog(_ emoji: String, _ message: String) {
    #if DEBUG
    if DEBUG_LOGGING_ENABLED {
        print("\(emoji) \(message)")
    }
    #endif
}

/// Debug log with category
@inline(__always)
func debugLog(category: LogCategory, _ message: String) {
    #if DEBUG
    if DEBUG_LOGGING_ENABLED {
        print("\(category.rawValue) \(message)")
    }
    #endif
}

/// Always log - for important messages that should appear in release builds too
@inline(__always)
func alwaysLog(_ message: String) {
    print(message)
}

/// Error log - always prints, with error formatting
@inline(__always)
func errorLog(_ message: String) {
    print("❌ ERROR: \(message)")
}

/// Warning log - always prints, with warning formatting  
@inline(__always)
func warnLog(_ message: String) {
    print("⚠️ WARNING: \(message)")
}