package com.issieboardng.shared

import org.json.JSONArray
import org.json.JSONObject

/**
 * JSON Parser for KeyboardConfig
 * Port of JSON parsing functionality from iOS
 * 
 * Parses keyboard configuration JSON into Kotlin data classes
 */
object KeyboardConfigParser {
    
    /**
     * Parse JSON string into KeyboardConfig
     * @param jsonString The JSON configuration string
     * @return Parsed KeyboardConfig object
     * @throws Exception if parsing fails
     */
    fun parse(jsonString: String): KeyboardConfig {
        val json = JSONObject(jsonString)
        
        return KeyboardConfig(
            backgroundColor = json.optString("backgroundColor", null),
            defaultKeyset = json.optString("defaultKeyset", null),
            keysets = parseKeysets(json.optJSONArray("keysets")),
            groups = parseGroups(json.optJSONArray("groups")),
            keyboards = parseStringList(json.optJSONArray("keyboards")),
            defaultKeyboard = json.optString("defaultKeyboard", null),
            diacritics = parseDiacriticsDefinition(json.optJSONObject("diacritics")),
            allDiacritics = parseAllDiacritics(json.optJSONObject("allDiacritics")),
            diacriticsSettings = parseDiacriticsSettingsMap(json.optJSONObject("diacriticsSettings")),
            wordSuggestionsEnabled = if (json.has("wordSuggestionsEnabled")) json.optBoolean("wordSuggestionsEnabled") else null,
            autoCorrectEnabled = if (json.has("autoCorrectEnabled")) json.optBoolean("autoCorrectEnabled") else null
        )
    }
    
    // MARK: - Keyset Parsing
    
    private fun parseKeysets(array: JSONArray?): List<Keyset> {
        if (array == null) return emptyList()
        
        return (0 until array.length()).map { i ->
            parseKeyset(array.getJSONObject(i))
        }
    }
    
    private fun parseKeyset(json: JSONObject): Keyset {
        return Keyset(
            id = json.getString("id"),
            rows = parseKeyRows(json.optJSONArray("rows"))
        )
    }
    
    private fun parseKeyRows(array: JSONArray?): List<KeyRow> {
        if (array == null) return emptyList()
        
        return (0 until array.length()).map { i ->
            parseKeyRow(array.getJSONObject(i))
        }
    }
    
    private fun parseKeyRow(json: JSONObject): KeyRow {
        return KeyRow(
            keys = parseKeys(json.optJSONArray("keys"))
        )
    }
    
    private fun parseKeys(array: JSONArray?): List<Key> {
        if (array == null) return emptyList()
        
        return (0 until array.length()).map { i ->
            parseKey(array.getJSONObject(i))
        }
    }
    
    private fun parseKey(json: JSONObject): Key {
        return Key(
            value = json.optString("value", null),
            sValue = json.optString("sValue", null),
            caption = json.optString("caption", null),
            sCaption = json.optString("sCaption", null),
            type = json.optString("type", null),
            width = if (json.has("width")) json.optDouble("width") else null,
            offset = if (json.has("offset")) json.optDouble("offset") else null,
            hidden = if (json.has("hidden")) json.optBoolean("hidden") else null,
            color = json.optString("color", null),
            bgColor = json.optString("bgColor", null),
            label = json.optString("label", null),
            keysetValue = json.optString("keysetValue", null),
            returnKeysetValue = json.optString("returnKeysetValue", null),
            returnKeysetLabel = json.optString("returnKeysetLabel", null),
            nikkud = parseNikkudOptions(json.optJSONArray("nikkud")),
            showOn = parseStringList(json.optJSONArray("showOn")),
            flex = if (json.has("flex")) json.optBoolean("flex") else null,
            showForField = parseStringList(json.optJSONArray("showForField"))
        )
    }
    
    private fun parseNikkudOptions(array: JSONArray?): List<NikkudOption>? {
        if (array == null) return null
        if (array.length() == 0) return emptyList()
        
        return (0 until array.length()).map { i ->
            parseNikkudOption(array.getJSONObject(i))
        }
    }
    
    private fun parseNikkudOption(json: JSONObject): NikkudOption {
        return NikkudOption(
            value = json.getString("value"),
            caption = json.optString("caption", null),
            sValue = json.optString("sValue", null),
            sCaption = json.optString("sCaption", null)
        )
    }
    
    // MARK: - Groups Parsing
    
    private fun parseGroups(array: JSONArray?): List<Group>? {
        if (array == null) return null
        if (array.length() == 0) return emptyList()
        
        return (0 until array.length()).map { i ->
            parseGroup(array.getJSONObject(i))
        }
    }
    
    private fun parseGroup(json: JSONObject): Group {
        return Group(
            items = parseStringList(json.optJSONArray("items")) ?: emptyList(),
            template = parseGroupTemplate(json.getJSONObject("template"))
        )
    }
    
    private fun parseGroupTemplate(json: JSONObject): GroupTemplate {
        return GroupTemplate(
            width = if (json.has("width")) json.optDouble("width") else null,
            offset = if (json.has("offset")) json.optDouble("offset") else null,
            hidden = if (json.has("hidden")) json.optBoolean("hidden") else null,
            visibilityMode = json.optString("visibilityMode", null),
            color = json.optString("color", null),
            bgColor = json.optString("bgColor", null)
        )
    }
    
    // MARK: - Diacritics Parsing
    
    private fun parseDiacriticsDefinition(json: JSONObject?): DiacriticsDefinition? {
        if (json == null) return null
        
        return DiacriticsDefinition(
            appliesTo = parseStringList(json.optJSONArray("appliesTo")),
            items = parseDiacriticItems(json.optJSONArray("items")),
            modifier = parseDiacriticModifier(json.optJSONObject("modifier")),
            modifiers = parseDiacriticModifiers(json.optJSONArray("modifiers"))
        )
    }
    
    private fun parseDiacriticItems(array: JSONArray?): List<DiacriticItem> {
        if (array == null) return emptyList()
        
        return (0 until array.length()).map { i ->
            parseDiacriticItem(array.getJSONObject(i))
        }
    }
    
    private fun parseDiacriticItem(json: JSONObject): DiacriticItem {
        return DiacriticItem(
            id = json.getString("id"),
            mark = json.getString("mark"),
            name = json.getString("name"),
            onlyFor = parseStringList(json.optJSONArray("onlyFor")),
            excludeFor = parseStringList(json.optJSONArray("excludeFor")),
            isReplacement = if (json.has("isReplacement")) json.optBoolean("isReplacement") else null
        )
    }
    
    private fun parseDiacriticModifier(json: JSONObject?): DiacriticModifier? {
        if (json == null) return null
        
        return DiacriticModifier(
            id = json.getString("id"),
            mark = json.optString("mark", null),
            name = json.getString("name"),
            appliesTo = parseStringList(json.optJSONArray("appliesTo")),
            excludeFor = parseStringList(json.optJSONArray("excludeFor")),
            options = parseDiacriticModifierOptions(json.optJSONArray("options"))
        )
    }
    
    private fun parseDiacriticModifiers(array: JSONArray?): List<DiacriticModifier>? {
        if (array == null) return null
        if (array.length() == 0) return emptyList()
        
        return (0 until array.length()).map { i ->
            parseDiacriticModifier(array.getJSONObject(i))!!
        }
    }
    
    private fun parseDiacriticModifierOptions(array: JSONArray?): List<DiacriticModifierOption>? {
        if (array == null) return null
        if (array.length() == 0) return emptyList()
        
        return (0 until array.length()).map { i ->
            parseDiacriticModifierOption(array.getJSONObject(i))
        }
    }
    
    private fun parseDiacriticModifierOption(json: JSONObject): DiacriticModifierOption {
        return DiacriticModifierOption(
            id = json.getString("id"),
            mark = json.getString("mark"),
            name = json.getString("name")
        )
    }
    
    private fun parseAllDiacritics(json: JSONObject?): Map<String, DiacriticsDefinition>? {
        if (json == null) return null
        
        val result = mutableMapOf<String, DiacriticsDefinition>()
        val keys = json.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            val def = parseDiacriticsDefinition(json.getJSONObject(key))
            if (def != null) {
                result[key] = def
            }
        }
        return result
    }
    
    private fun parseDiacriticsSettingsMap(json: JSONObject?): Map<String, DiacriticsSettings>? {
        if (json == null) return null
        
        val result = mutableMapOf<String, DiacriticsSettings>()
        val keys = json.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            result[key] = parseDiacriticsSettings(json.getJSONObject(key))
        }
        return result
    }
    
    private fun parseDiacriticsSettings(json: JSONObject): DiacriticsSettings {
        return DiacriticsSettings(
            hidden = parseStringList(json.optJSONArray("hidden")),
            disabledModifiers = parseStringList(json.optJSONArray("disabledModifiers")),
            disabled = if (json.has("disabled")) json.optBoolean("disabled") else null
        )
    }
    
    // MARK: - Utility
    
    private fun parseStringList(array: JSONArray?): List<String>? {
        if (array == null) return null
        if (array.length() == 0) return emptyList()
        
        return (0 until array.length()).map { i ->
            array.getString(i)
        }
    }
}