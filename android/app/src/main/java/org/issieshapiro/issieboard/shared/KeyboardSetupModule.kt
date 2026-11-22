package org.issieshapiro.issieboard.shared

import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.Voice
import android.util.Log
import android.view.inputmethod.InputMethodManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.Arguments
import java.util.Locale

/**
 * Native module to check if IssieBoard keyboard services are enabled
 * in Android system settings.
 *
 * Port of ios/IssieBoardNG/KeyboardPreferencesModule.swift getKeyboardSetupStatus
 * and getDefaultTTSVoice
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

    // MARK: - Text-to-speech

    /// The voice the TTS engine itself uses for `languageTag` (e.g. "he-IL"), i.e.
    /// what it picks on setLanguage — the Android counterpart of iOS's
    /// AVSpeechSynthesisVoice(language:). react-native-tts can apply this by
    /// language but never reports which voice it is, so the app can't show or save it.
    /// Resolves {id, name, language}, or null when no voice speaks that language.
    @ReactMethod
    fun getDefaultTTSVoice(languageTag: String, promise: Promise) {
        var tts: TextToSpeech? = null
        tts = TextToSpeech(reactContext) { status ->
            val engine = tts
            try {
                if (status != TextToSpeech.SUCCESS || engine == null) {
                    promise.resolve(null)
                    return@TextToSpeech
                }
                val voice = resolveDefaultVoice(engine, languageTag)
                if (voice == null) {
                    promise.resolve(null)
                } else {
                    val result = Arguments.createMap()
                    // Voice.name is the id react-native-tts lists and accepts in setDefaultVoice
                    result.putString("id", voice.name)
                    result.putString("name", voice.name)
                    result.putString("language", voice.locale.toLanguageTag())
                    promise.resolve(result)
                }
            } catch (e: Exception) {
                Log.e("KeyboardSetup", "getDefaultTTSVoice failed: ${e.message}", e)
                promise.resolve(null)
            } finally {
                engine?.shutdown()
            }
        }
    }

    private fun resolveDefaultVoice(tts: TextToSpeech, languageTag: String): Voice? {
        val prefix = normalizedLanguage(languageTag.split('-', '_').first())
        fun speaksLanguage(voice: Voice?): Voice? {
            if (voice == null || normalizedLanguage(voice.locale.language) != prefix) return null
            return voice
        }
        // The engine's pick for a locale, or null when it has no voice for it.
        fun voiceForLanguage(tag: String): Voice? {
            val result = tts.setLanguage(Locale.forLanguageTag(tag))
            if (result < TextToSpeech.LANG_AVAILABLE) return null
            return speaksLanguage(tts.voice)
        }
        // A locale like "en-IL" has no voices of its own, so fall back to the
        // language's main region, then to any voice of that language.
        val mainRegion = mapOf("en" to "en-US", "he" to "he-IL", "ar" to "ar-001")[prefix]
        val anyVoice = tts.voices.orEmpty().firstOrNull {
            normalizedLanguage(it.locale.language) == prefix &&
                !it.features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)
        }
        return voiceForLanguage(languageTag)
            ?: mainRegion?.let { voiceForLanguage(it) }
            ?: anyVoice?.let { voiceForLanguage(it.locale.toLanguageTag()) }
            ?: anyVoice
    }

    // Java's Locale still reports Hebrew as the legacy "iw" on many Android versions.
    private fun normalizedLanguage(code: String): String {
        val lower = code.lowercase()
        return if (lower == "iw") "he" else lower
    }
}
