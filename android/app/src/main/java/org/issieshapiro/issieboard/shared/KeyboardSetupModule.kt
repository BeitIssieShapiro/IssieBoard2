package org.issieshapiro.issieboard.shared

import android.content.Context
import android.util.Log
import android.view.inputmethod.InputMethodManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.Arguments

/**
 * Native module to check if IssieBoard keyboard services are enabled
 * in Android system settings.
 *
 * Port of ios/IssieBoardNG/KeyboardPreferencesModule.swift getKeyboardSetupStatus
 */
class KeyboardSetupModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "KeyboardSetupModule"

    // Map language codes to IME service component suffixes
    private val languageServiceMap = mapOf(
        "en" to ".keyboards.IssieBoardEnService",
        "he" to ".keyboards.IssieBoardHeService",
        "ar" to ".keyboards.IssieBoardArService"
    )

    @ReactMethod
    fun getKeyboardSetupStatus(language: String, promise: Promise) {
        Log.d("KeyboardSetup", "getKeyboardSetupStatus called for language: $language")
        try {
            val serviceSuffix = languageServiceMap[language]
            if (serviceSuffix == null) {
                val result = Arguments.createMap()
                result.putNull("isAdded")
                result.putNull("hasFullAccess")
                promise.resolve(result)
                return
            }

            val imm = reactContext.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
            val enabledMethods = imm.enabledInputMethodList
            val isEnabled = enabledMethods.any { it.id.endsWith(serviceSuffix) }
            Log.d("KeyboardSetup", "Enabled IMEs: ${enabledMethods.map { it.id }}, looking for suffix: $serviceSuffix, found: $isEnabled")

            val result = Arguments.createMap()
            result.putBoolean("isAdded", isEnabled)
            result.putBoolean("hasFullAccess", true)
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e("KeyboardSetup", "Exception: ${e.javaClass.simpleName}: ${e.message}", e)
            val result = Arguments.createMap()
            result.putNull("isAdded")
            result.putNull("hasFullAccess")
            promise.resolve(result)
        }
    }
}
