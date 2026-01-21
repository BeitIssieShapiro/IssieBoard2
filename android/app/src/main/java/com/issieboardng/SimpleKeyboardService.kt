package com.issieboardng // <--- KEEP YOUR PACKAGE NAME

import android.inputmethodservice.InputMethodService
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.graphics.Color
import android.view.ViewGroup.LayoutParams
import android.content.Context // Needed for SharedPreferences
import org.json.JSONObject    // Needed for parsing
import android.util.Log       // Needed for debugging

class SimpleKeyboardService : InputMethodService() {

    override fun onCreateInputView(): View {
        // 1. Initialize Default Color (Fallback)
        var bgColor = Color.LTGRAY
        var debugText = "Default Config"

        // 2. Try to Read Shared Preferences
        // We use "keyboard_data" because in RN we called DefaultPreference.setName('keyboard_data')
        try {
            val prefs = getSharedPreferences("keyboard_data", Context.MODE_PRIVATE)
            val configString = prefs.getString("config_json", null)

            if (configString != null) {
                val json = JSONObject(configString)

                // Extract color (e.g., "#FF0000")
                val colorString = json.optString("backgroundColor", "#CCCCCC")
                bgColor = Color.parseColor(colorString)
                debugText = "Loaded: $colorString"
            } else {
                debugText = "No Config Found (Run App First)"
            }
        } catch (e: Exception) {
            Log.e("ISSIEBOARD", "Error reading config", e)
            debugText = "Error: ${e.message}"
            bgColor = Color.RED // Turn RED if reading fails
        }

        // 3. Create the Layout with the Dynamic Color
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(bgColor) // <--- APPLYING THE USER'S COLOR

            // Explicit Height is still crucial for safety
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, 600)
        }

        // 4. Add Debug Label so you know what happened
        val label = TextView(this).apply {
            text = debugText
            textSize = 20f
            setTextColor(Color.BLACK)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }
        layout.addView(label)

        // 5. Add a simple key
        val button = Button(this).apply {
            text = "Type 'A'"
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                150
            )
            setOnClickListener {
                currentInputConnection?.commitText("A", 1)
            }
        }
        layout.addView(button)

        return layout
    }

    // Force visibility
    override fun onEvaluateInputViewShown(): Boolean {
        super.onEvaluateInputViewShown()
        return true
    }
}