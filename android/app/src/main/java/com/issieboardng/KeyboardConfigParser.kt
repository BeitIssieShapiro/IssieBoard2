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
        
        // Parse keyboards array
        val keyboards = mutableListOf<String>()
        val keyboardsArray = configJson.optJSONArray("keyboards")
        if (keyboardsArray != null) {
            for (i in 0 until keyboardsArray.length()) {
                val kb = keyboardsArray.optString(i, "")
                if (kb.isNotEmpty()) keyboards.add(kb)
            }
        }
        Log.d(TAG, "Parsed keyboards: ${keyboards.joinToString()}")
        
        // Parse allDiacritics (per-keyboard diacritics definitions)
        val allDiacritics = mutableMapOf<String, DiacriticsDefinition>()
        val allDiacriticsObj = configJson.optJSONObject("allDiacritics")
        if (allDiacriticsObj != null) {
            val keys = allDiacriticsObj.keys()
            while (keys.hasNext()) {
                val keyboardId = keys.next()
                val diacriticsObj = allDiacriticsObj.optJSONObject(keyboardId)
                if (diacriticsObj != null) {
                    val diacriticsDef = parseDiacriticsDefinition(diacriticsObj)
                    if (diacriticsDef != null) {
                        allDiacritics[keyboardId] = diacriticsDef
                    }
                }
            }
        }
        Log.d(TAG, "Parsed allDiacritics for keyboards: ${allDiacritics.keys.joinToString()}")
        
        // Parse diacriticsSettings (per-keyboard profile settings)
        val diacriticsSettings = mutableMapOf<String, DiacriticsSettings>()
        val settingsObj = configJson.optJSONObject("diacriticsSettings")
        if (settingsObj != null) {
            val keys = settingsObj.keys()
            while (keys.hasNext()) {
                val keyboardId = keys.next()
                val settingObj = settingsObj.optJSONObject(keyboardId)
                if (settingObj != null) {
                    val settings = parseDiacriticsSettings(settingObj)
                    diacriticsSettings[keyboardId] = settings
                }
            }
        }
        Log.d(TAG, "Parsed diacriticsSettings for keyboards: ${diacriticsSettings.keys.joinToString()}")
        
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
        
        return ParsedConfig(
            backgroundColor = backgroundColor,
            defaultKeysetId = defaultKeysetId,
            keysets = keysets,
            keyboards = keyboards,
            allDiacritics = allDiacritics,
            diacriticsSettings = diacriticsSettings
        )
    }
    
    /**
     * Parse diacritics definition from JSON
     */
    private fun parseDiacriticsDefinition(obj: JSONObject): DiacriticsDefinition? {
        val itemsArray = obj.optJSONArray("items") ?: return null
        
        // Parse appliesTo - list of characters that should trigger diacritics popup
        val appliesTo = parseStringArray(obj.optJSONArray("appliesTo"))
        
        val items = mutableListOf<DiacriticItem>()
        for (i in 0 until itemsArray.length()) {
            val itemObj = itemsArray.optJSONObject(i) ?: continue
            val item = parseDiacriticItem(itemObj)
            if (item != null) items.add(item)
        }
        
        // Parse legacy single modifier
        val modifier = obj.optJSONObject("modifier")?.let { parseDiacriticModifier(it) }
        
        // Parse new multiple modifiers array
        val modifiers = mutableListOf<DiacriticModifier>()
        val modifiersArray = obj.optJSONArray("modifiers")
        if (modifiersArray != null) {
            for (i in 0 until modifiersArray.length()) {
                val modObj = modifiersArray.optJSONObject(i) ?: continue
                val mod = parseDiacriticModifier(modObj)
                if (mod != null) modifiers.add(mod)
            }
        }
        
        return DiacriticsDefinition(
            appliesTo = if (appliesTo.isEmpty()) null else appliesTo,
            items = items,
            modifier = modifier,
            modifiers = if (modifiers.isEmpty()) null else modifiers
        )
    }
    
    /**
     * Parse a single diacritic item
     */
    private fun parseDiacriticItem(obj: JSONObject): DiacriticItem? {
        val id = obj.optString("id", "")
        if (id.isEmpty()) return null
        
        val onlyFor = parseStringArray(obj.optJSONArray("onlyFor"))
        val excludeFor = parseStringArray(obj.optJSONArray("excludeFor"))
        
        return DiacriticItem(
            id = id,
            mark = obj.optString("mark", ""),
            name = obj.optString("name", id),
            onlyFor = if (onlyFor.isEmpty()) null else onlyFor,
            excludeFor = if (excludeFor.isEmpty()) null else excludeFor,
            isReplacement = obj.optBoolean("isReplacement", false)
        )
    }
    
    /**
     * Parse a diacritic modifier
     */
    private fun parseDiacriticModifier(obj: JSONObject): DiacriticModifier? {
        val id = obj.optString("id", "")
        if (id.isEmpty()) return null
        
        val appliesTo = parseStringArray(obj.optJSONArray("appliesTo"))
        val excludeFor = parseStringArray(obj.optJSONArray("excludeFor"))
        
        // Parse options for multi-option modifiers
        val options = mutableListOf<DiacriticModifierOption>()
        val optionsArray = obj.optJSONArray("options")
        if (optionsArray != null) {
            for (i in 0 until optionsArray.length()) {
                val optObj = optionsArray.optJSONObject(i) ?: continue
                val optId = optObj.optString("id", "")
                if (optId.isNotEmpty()) {
                    options.add(DiacriticModifierOption(
                        id = optId,
                        mark = optObj.optString("mark", ""),
                        name = optObj.optString("name", optId)
                    ))
                }
            }
        }
        
        return DiacriticModifier(
            id = id,
            mark = obj.optString("mark", "").takeIf { it.isNotEmpty() },
            name = obj.optString("name", id),
            appliesTo = if (appliesTo.isEmpty()) null else appliesTo,
            excludeFor = if (excludeFor.isEmpty()) null else excludeFor,
            options = if (options.isEmpty()) null else options
        )
    }
    
    /**
     * Parse diacritics settings from JSON
     */
    private fun parseDiacriticsSettings(obj: JSONObject): DiacriticsSettings {
        val hidden = parseStringArray(obj.optJSONArray("hidden"))
        val disabledModifiers = parseStringArray(obj.optJSONArray("disabledModifiers"))
        
        return DiacriticsSettings(
            hidden = hidden,
            disabledModifiers = disabledModifiers
        )
    }
    
    /**
     * Parse a JSON array of strings
     */
    private fun parseStringArray(array: org.json.JSONArray?): List<String> {
        if (array == null) return emptyList()
        
        val result = mutableListOf<String>()
        for (i in 0 until array.length()) {
            val str = array.optString(i, "")
            if (str.isNotEmpty()) result.add(str)
        }
        return result
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