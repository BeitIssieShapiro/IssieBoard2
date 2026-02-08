package com.issieboardng.shared

import android.content.Context
import android.content.SharedPreferences
import android.os.Handler
import android.os.Looper

/**
 * Shared preferences manager for keyboard configuration
 * Port of ios/Shared/KeyboardPreferences.swift
 * 
 * Uses SharedPreferences with MODE_MULTI_PROCESS to share data between main app and keyboard service
 */
class KeyboardPreferences(context: Context) {
    
    companion object {
        // SharedPreferences name for sharing between app and keyboard
        const val PREFS_NAME = "issieboard_keyboard_prefs"
        
        // Keys for storing preferences
        object Keys {
            const val CURRENT_PROFILE = "currentProfile"
            const val KEYBOARD_CONFIG = "keyboardConfig"
            const val LAST_UPDATE_TIME = "lastUpdateTime"
            const val SELECTED_LANGUAGE = "selectedLanguage"
        }
    }
    
    @Suppress("DEPRECATION")
    private val sharedPrefs: SharedPreferences = context.getSharedPreferences(
        PREFS_NAME, 
        Context.MODE_MULTI_PROCESS  // Allow sharing between processes
    )
    
    // MARK: - Profile Management
    
    var currentProfile: String?
        get() = sharedPrefs.getString(Keys.CURRENT_PROFILE, null)
        set(value) {
            sharedPrefs.edit()
                .putString(Keys.CURRENT_PROFILE, value)
                .putLong(Keys.LAST_UPDATE_TIME, System.currentTimeMillis())
                .apply()
        }
    
    // MARK: - Language Selection
    
    var selectedLanguage: String?
        get() = sharedPrefs.getString(Keys.SELECTED_LANGUAGE, null)
        set(value) {
            sharedPrefs.edit()
                .putString(Keys.SELECTED_LANGUAGE, value)
                .putLong(Keys.LAST_UPDATE_TIME, System.currentTimeMillis())
                .apply()
        }
    
    // MARK: - Last Update Time
    
    val lastUpdateTime: Long
        get() {
            // Handle both String and Long formats (JS saves as String, native saves as Long)
            return try {
                sharedPrefs.getLong(Keys.LAST_UPDATE_TIME, 0)
            } catch (e: ClassCastException) {
                // If it's stored as String (from JS), parse it
                try {
                    sharedPrefs.getString(Keys.LAST_UPDATE_TIME, "0")?.toLongOrNull() ?: 0
                } catch (e2: Exception) {
                    0
                }
            } catch (e: Exception) {
                0
            }
        }
    
    // MARK: - JSON Configuration Storage
    
    /** Store keyboard configuration as JSON string */
    fun setKeyboardConfigJSON(jsonString: String) {
        sharedPrefs.edit()
            .putString(Keys.KEYBOARD_CONFIG, jsonString)
            .putLong(Keys.LAST_UPDATE_TIME, System.currentTimeMillis())
            .apply()
    }
    
    /** Retrieve keyboard configuration as JSON string */
    fun getKeyboardConfigJSON(): String? {
        return sharedPrefs.getString(Keys.KEYBOARD_CONFIG, null)
    }
    
    // MARK: - Profile Storage
    
    /** Store profile configuration as JSON string */
    fun setProfileJSON(jsonString: String, key: String) {
        sharedPrefs.edit()
            .putString("profile_$key", jsonString)
            .apply()
    }
    
    /** Retrieve profile configuration as JSON string */
    fun getProfileJSON(key: String): String? {
        return sharedPrefs.getString("profile_$key", null)
    }
    
    // MARK: - Generic String Storage
    
    /** Store a string value for a given key */
    fun setString(value: String, key: String) {
        sharedPrefs.edit()
            .putString(key, value)
            .apply()
    }
    
    /** Retrieve a string value for a given key */
    fun getString(key: String): String? {
        return sharedPrefs.getString(key, null)
    }
    
    // MARK: - Debugging
    
    fun printAllPreferences() {
        alwaysLog("📱 Keyboard Preferences:")
        alwaysLog("  Prefs Name: $PREFS_NAME")
        alwaysLog("  Current Profile: ${currentProfile ?: "none"}")
        alwaysLog("  Selected Language: ${selectedLanguage ?: "none"}")
        alwaysLog("  Last Update: ${java.util.Date(lastUpdateTime)}")
        alwaysLog("  Has Config: ${getKeyboardConfigJSON() != null}")
    }
    
    // MARK: - Clear Preferences
    
    fun clearAll() {
        val keyCount = sharedPrefs.all.size
        sharedPrefs.edit().clear().apply()
        alwaysLog("🗑️ Cleared all $keyCount preference keys")
    }
}

/**
 * Observer class for monitoring preference changes in keyboard service
 * Port of iOS KeyboardPreferenceObserver
 */
class KeyboardPreferenceObserver(
    private val preferences: KeyboardPreferences,
    private val onChange: () -> Unit
) {
    
    private var lastKnownUpdateTime: Long = 0
    private var handler: Handler? = null
    private var checkRunnable: Runnable? = null
    
    init {
        lastKnownUpdateTime = preferences.lastUpdateTime
    }
    
    /** Start polling for changes (keyboard services can't easily use ContentObserver across processes) */
    fun startObserving(intervalMs: Long = 500) {
        stopObserving()
        
        handler = Handler(Looper.getMainLooper())
        checkRunnable = object : Runnable {
            override fun run() {
                checkForChanges()
                handler?.postDelayed(this, intervalMs)
            }
        }
        handler?.postDelayed(checkRunnable!!, intervalMs)
    }
    
    /** Stop polling for changes */
    fun stopObserving() {
        checkRunnable?.let { handler?.removeCallbacks(it) }
        checkRunnable = null
        handler = null
    }
    
    private fun checkForChanges() {
        val currentUpdateTime = preferences.lastUpdateTime
        
        if (currentUpdateTime > lastKnownUpdateTime) {
            lastKnownUpdateTime = currentUpdateTime
            
            alwaysLog("🔄 Keyboard preferences changed at ${java.util.Date(currentUpdateTime)}")
            preferences.printAllPreferences()
            
            onChange()
        }
    }
}