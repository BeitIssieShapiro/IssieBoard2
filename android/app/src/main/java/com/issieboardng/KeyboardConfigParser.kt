package com.issieboardng

import android.content.Context
import android.graphics.Color
import android.util.Log
import org.json.JSONObject

/**
 * Shared config parsing logic
 * Used by both SimpleKeyboardService and KeyboardPreviewView
 */
class KeyboardConfigParser(private val context: Context) {
    
    companion object {
        private const val TAG = "KeyboardConfigParser"
        private const val PREFS_FILE = "keyboard_data"
        private const val CONFIG_KEY = "config_json"
        private const val DEFAULT_KEYSET_ID = "abc"
        private const val DEFAULT_BG_COLOR = "#CCCCCC"
    }
    
    private val colorCache = mutableMapOf<String, Int>()
    
    /**
     * Load config from SharedPreferences and parse it
     */
    fun loadAndParseConfig(): ParsedConfig? {
        return try {
            val prefs = context.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE)
            val configString = prefs.getString(CONFIG_KEY, null) ?: "{}"
            val configJson = JSONObject(configString)
            parseConfig(configJson)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load config", e)
            null
        }
    }
    
    /**
     * Parse JSON config into ParsedConfig structure
     */
    fun parseConfig(configJson: JSONObject): ParsedConfig {
        val bgColorString = configJson.optString("backgroundColor", DEFAULT_BG_COLOR)
        val backgroundColor = parseColor(bgColorString, Color.parseColor(DEFAULT_BG_COLOR))
        val defaultKeysetId = configJson.optString("defaultKeyset", DEFAULT_KEYSET_ID)
        
        // Parse groups from the top-level config (they apply to all keysets)
        val globalGroups = parseGroupsFromArray(configJson.optJSONArray("groups"))
        Log.d(TAG, "Parsed ${globalGroups.size} global groups: ${globalGroups.keys.joinToString()}")
        
        val keysets = mutableMapOf<String, ParsedKeyset>()
        val keysetsArray = configJson.optJSONArray("keysets")
        
        if (keysetsArray != null) {
            for (i in 0 until keysetsArray.length()) {
                val keysetObj = keysetsArray.optJSONObject(i) ?: continue
                val keysetId = keysetObj.optString("id", "")
                if (keysetId.isEmpty()) continue
                
                // Merge keyset-level groups with global groups (keyset groups override global)
                val keysetGroups = parseGroupsFromArray(keysetObj.optJSONArray("groups"))
                val mergedGroups = globalGroups.toMutableMap()
                mergedGroups.putAll(keysetGroups)
                
                val rows = mutableListOf<List<KeyConfig>>()
                val rowsArray = keysetObj.optJSONArray("rows")
                
                if (rowsArray != null) {
                    for (j in 0 until rowsArray.length()) {
                        val rowObj = rowsArray.optJSONObject(j) ?: continue
                        val keysArray = rowObj.optJSONArray("keys") ?: continue
                        
                        val rowKeys = mutableListOf<KeyConfig>()
                        for (k in 0 until keysArray.length()) {
                            val keyObj = keysArray.optJSONObject(k) ?: continue
                            val keyConfig = parseKeyConfig(keyObj, mergedGroups)
                            rowKeys.add(keyConfig)
                        }
                        rows.add(rowKeys)
                    }
                }
                
                keysets[keysetId] = ParsedKeyset(keysetId, rows, mergedGroups)
            }
        }
        
        return ParsedConfig(backgroundColor, defaultKeysetId, keysets)
    }
    
    /**
     * Parse groups from a JSONArray into a map of value -> GroupTemplate
     */
    private fun parseGroupsFromArray(groupsArray: org.json.JSONArray?): Map<String, GroupTemplate> {
        val groups = mutableMapOf<String, GroupTemplate>()
        if (groupsArray == null) return groups
        
        for (i in 0 until groupsArray.length()) {
            val groupObj = groupsArray.optJSONObject(i) ?: continue
            val itemsArray = groupObj.optJSONArray("items") ?: continue
            val templateObj = groupObj.optJSONObject("template") ?: continue
            
            val template = GroupTemplate(
                width = if (templateObj.has("width")) templateObj.optDouble("width", 1.0).toFloat() else null,
                offset = if (templateObj.has("offset")) templateObj.optDouble("offset", 0.0).toFloat() else null,
                hidden = if (templateObj.has("hidden")) templateObj.optBoolean("hidden", false) else null,
                color = templateObj.optString("color", ""),
                bgColor = templateObj.optString("bgColor", "")
            )
            
            for (j in 0 until itemsArray.length()) {
                val item = itemsArray.optString(j, "")
                if (item.isNotEmpty()) {
                    groups[item] = template
                }
            }
        }
        
        return groups
    }
    
    private fun parseKeyConfig(
        keyObj: JSONObject,
        groups: Map<String, GroupTemplate>
    ): KeyConfig {
        val value = keyObj.optString("value", "")
        val groupTemplate = groups[value]
        
        val caption = keyObj.optString("caption", value)
        val sValue = keyObj.optString("sValue", value)
        val sCaption = keyObj.optString("sCaption", "").ifEmpty { 
            keyObj.optString("sValue", caption)
        }
        
        val textColorString = keyObj.optString("color", "").ifEmpty { groupTemplate?.color ?: "" }
        val bgColorString = keyObj.optString("bgColor", "").ifEmpty { groupTemplate?.bgColor ?: "" }
        
        val textColor = parseColor(textColorString, Color.BLACK)
        val backgroundColor = parseColor(bgColorString, Color.LTGRAY)
        
        val nikkudList = mutableListOf<NikkudOption>()
        val nikkudArray = keyObj.optJSONArray("nikkud")
        if (nikkudArray != null) {
            for (i in 0 until nikkudArray.length()) {
                val nikkudObj = nikkudArray.optJSONObject(i) ?: continue
                val nikkudValue = nikkudObj.optString("value", "")
                val nikkudCaption = nikkudObj.optString("caption", "").ifEmpty { nikkudValue }
                nikkudList.add(NikkudOption(nikkudValue, nikkudCaption))
            }
        }
        
        return KeyConfig(
            value = value,
            caption = caption,
            sValue = sValue,
            sCaption = sCaption,
            type = keyObj.optString("type", ""),
            width = if (keyObj.has("width")) {
                keyObj.optDouble("width", 1.0).toFloat()
            } else {
                groupTemplate?.width ?: 1.0f
            },
            offset = if (keyObj.has("offset")) {
                keyObj.optDouble("offset", 0.0).toFloat()
            } else {
                groupTemplate?.offset ?: 0.0f
            },
            hidden = if (keyObj.has("hidden")) {
                keyObj.optBoolean("hidden", false)
            } else {
                groupTemplate?.hidden ?: false
            },
            textColor = textColor,
            backgroundColor = backgroundColor,
            label = keyObj.optString("label", ""),
            keysetValue = keyObj.optString("keysetValue", ""),
            nikkud = nikkudList
        )
    }
    
    private fun parseColor(colorString: String, default: Int): Int {
        if (colorString.isEmpty()) return default
        
        return colorCache.getOrPut(colorString) {
            try {
                Color.parseColor(colorString)
            } catch (e: Exception) {
                default
            }
        }
    }
}