package com.issieboardng

import android.inputmethodservice.InputMethodService
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.graphics.Color
import android.view.ViewGroup.LayoutParams
import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import android.os.Build // Needed for API version check
import android.view.WindowInsets // Needed for Insets
import org.json.JSONObject

class SimpleKeyboardService : InputMethodService(), SharedPreferences.OnSharedPreferenceChangeListener {

    private var mainLayout: LinearLayout? = null
    private val PREFS_FILE = "keyboard_data"

    override fun onCreate() {
        super.onCreate()
        val prefs = getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE)
        prefs.registerOnSharedPreferenceChangeListener(this)
    }

    override fun onDestroy() {
        super.onDestroy()
        val prefs = getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE)
        prefs.unregisterOnSharedPreferenceChangeListener(this)
    }

    override fun onCreateInputView(): View {
        mainLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            // Explicitly match parent width, but allow height to wrap content + padding
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
        }

        // --- FIX FOR NAVIGATION BAR OVERLAP ---
        // This listener fires when the view is attached and learns about the system bars
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) { // Android 11+
            mainLayout?.setOnApplyWindowInsetsListener { view, insets ->
                val navInsets = insets.getInsets(WindowInsets.Type.navigationBars())
                // Apply bottom padding equal to the Nav Bar height
                view.setPadding(0, 0, 0, navInsets.bottom)
                insets
            }
        } else {
            // Fallback for older Androids (API < 30)
            // usually InputMethodService handles this better on old OS, 
            // but we can enforce fitsSystemWindows if needed.
            mainLayout?.fitsSystemWindows = true
        }

        renderKeyboard()
        return mainLayout!!
    }

    override fun onSharedPreferenceChanged(sharedPreferences: SharedPreferences?, key: String?) {
        if (key == "config_json") {
            mainLayout?.post { renderKeyboard() }
        }
    }

    private fun renderKeyboard() {
        val layout = mainLayout ?: return
        layout.removeAllViews()

        // --- 1. PARSE CONFIG ---
        var bgColor = Color.LTGRAY
        var rowsArray: org.json.JSONArray? = null
        
        try {
            val prefs = getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE)
            val configString = prefs.getString("config_json", "{}")
            val json = JSONObject(configString)
            
            val colorString = json.optString("backgroundColor", "#CCCCCC")
            bgColor = Color.parseColor(colorString)
            rowsArray = json.optJSONArray("rows")
            
        } catch (e: Exception) {
            bgColor = Color.RED 
        }

        layout.setBackgroundColor(bgColor)

        // --- 2. RENDER ROWS ---
        if (rowsArray != null) {
            for (i in 0 until rowsArray.length()) {
                val rowObj = rowsArray.getJSONObject(i)
                val keysArray = rowObj.optJSONArray("keys") ?: continue

                // Row Container
                val rowLayout = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        150 // Fixed height per row (approx 50-60dp)
                    )
                }

                // --- 3. RENDER KEYS ---
                for (j in 0 until keysArray.length()) {
                    val keyObj = keysArray.getJSONObject(j)
                    val label = keyObj.optString("label", "?")
                    val value = keyObj.optString("value", "")

                    val keyButton = Button(this).apply {
                        text = label
                        layoutParams = LinearLayout.LayoutParams(
                            0, LinearLayout.LayoutParams.MATCH_PARENT, 1f
                        )
                        setOnClickListener {
                            if (value == "DEL") {
                                currentInputConnection?.deleteSurroundingText(1, 0)
                            } else {
                                currentInputConnection?.commitText(value, 1)
                            }
                        }
                    }
                    rowLayout.addView(keyButton)
                }
                layout.addView(rowLayout)
            }
        } else {
            val errorText = TextView(this).apply { 
                text = "No config loaded" 
                textSize = 20f
            }
            layout.addView(errorText)
        }
    }
    
    override fun onEvaluateInputViewShown(): Boolean {
        super.onEvaluateInputViewShown()
        return true
    }
}