import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import DefaultPreference from 'react-native-default-preference';
import yaml from 'js-yaml';

// --- 1. THE DEFAULT CONFIGURATION ---
const DEFAULT_YAML = `
backgroundColor: "#E0E0E0"
debugMode: false
defaultKeyset: "abc"

keysets:
  # Letters keyset (abc)
  - id: "abc"
    rows:
      # System row
      - keys:
          - { type: "settings" }
          - { type: "backspace", width: 1.5 }
          - { type: "enter" }
          - { type: "close" }
      
      # First letter row
      - keys: 
          - { value: "q", sValue: "Q" }
          - { value: "w", sValue: "W" }
          - { value: "e", sValue: "E" }
          - { value: "r", sValue: "R" }
          - { value: "t", sValue: "T" }
          - { value: "y", sValue: "Y" }
          - { value: "u", sValue: "U" }
          - { value: "i", sValue: "I" }
          - { value: "o", sValue: "O" }
          - { value: "p", sValue: "P" }
      
      # Second letter row with offset
      - keys:
          - { hidden: true, width: 0.5 }
          - { value: "a", sValue: "A" }
          - { value: "s", sValue: "S" }
          - { value: "d", sValue: "D" }
          - { value: "f", sValue: "F" }
          - { value: "g", sValue: "G" }
          - { value: "h", sValue: "H" }
          - { value: "j", sValue: "J" }
          - { value: "k", sValue: "K" }
          - { value: "l", sValue: "L" }
      
      # Third letter row with shift
      - keys:
          - { type: "shift", width: 1.5, caption: "⇧" }
          - { value: "z", sValue: "Z" }
          - { value: "x", sValue: "X" }
          - { value: "c", sValue: "C" }
          - { value: "v", sValue: "V" }
          - { value: "b", sValue: "B" }
          - { value: "n", sValue: "N" }
          - { value: "m", sValue: "M" }
          - { type: "backspace", label: "⌫", width: 1.5 }
      
      # Space row with keyset switcher
      - keys:
          - { type: "keyset", keysetValue: "123", label: "123", width: 1.5 }
          - { caption: "SPACE", value: " ", width: 5 }
          - { value: ".", sValue: "," }
          - { type: "enter", width: 1.5 }
  
  # Numbers keyset (123)
  - id: "123"
    rows:
      # System row
      - keys:
          - { type: "settings" }
          - { type: "backspace", width: 1.5 }
          - { type: "enter" }
          - { type: "close" }
      
      # First number row
      - keys:
          - { label: "1", value: "1" }
          - { label: "2", value: "2" }
          - { label: "3", value: "3" }
          - { label: "4", value: "4" }
          - { label: "5", value: "5" }
          - { label: "6", value: "6" }
          - { label: "7", value: "7" }
          - { label: "8", value: "8" }
          - { label: "9", value: "9" }
          - { label: "0", value: "0" }
      
      # Second row with common symbols
      - keys:
          - { label: "-", value: "-" }
          - { label: "/", value: "/" }
          - { label: ":", value: ":" }
          - { label: ";", value: ";" }
          - { label: "(", value: "(" }
          - { label: ")", value: ")" }
          - { label: "$", value: "$" }
          - { label: "&", value: "&" }
          - { label: "@", value: "@" }
          - { label: '"', value: '"' }
      
      # Third row with more symbols
      - keys:
          - { type: "keyset", keysetValue: "#+=", label: "#+=", width: 1.5 }
          - { label: ".", value: "." }
          - { label: ",", value: "," }
          - { label: "?", value: "?" }
          - { label: "!", value: "!" }
          - { label: "'", value: "'" }
          - { type: "backspace", label: "⌫", width: 2.5 }
      
      # Space row with keyset switcher
      - keys:
          - { type: "keyset", keysetValue: "abc", label: "ABC", width: 1.5 }
          - { label: "SPACE", value: " ", width: 5 }
          - { label: ".", value: "." }
          - { type: "enter", width: 1.5 }
  
  # Symbols keyset (#+=)
  - id: "#+="
    rows:
      # System row
      - keys:
          - { type: "settings" }
          - { type: "backspace", width: 1.5 }
          - { type: "enter" }
          - { type: "close" }
      
      # First symbol row
      - keys:
          - { label: "[", value: "[" }
          - { label: "]", value: "]" }
          - { label: "{", value: "{" }
          - { label: "}", value: "}" }
          - { label: "#", value: "#" }
          - { label: "%", value: "%" }
          - { label: "^", value: "^" }
          - { label: "*", value: "*" }
          - { label: "+", value: "+" }
          - { label: "=", value: "=" }
      
      # Second symbol row
      - keys:
          - { label: "_", value: "_" }
          - { label: "\\\\", value: "\\\\" }
          - { label: "|", value: "|" }
          - { label: "~", value: "~" }
          - { label: "<", value: "<" }
          - { label: ">", value: ">" }
          - { label: "€", value: "€" }
          - { label: "£", value: "£" }
          - { label: "¥", value: "¥" }
          - { label: "•", value: "•" }
      
      # Third symbol row
      - keys:
          - { type: "keyset", keysetValue: "123", label: "123", width: 1.5 }
          - { label: ".", value: "." }
          - { label: ",", value: "," }
          - { label: "?", value: "?" }
          - { label: "!", value: "!" }
          - { label: "'", value: "'" }
          - { type: "backspace", label: "⌫", width: 2.5 }
      
      # Space row with keyset switcher
      - keys:
          - { type: "keyset", keysetValue: "abc", label: "ABC", width: 1.5 }
          - { label: "SPACE", value: " ", width: 5 }
          - { label: ".", value: "." }
          - { type: "enter", width: 1.5 }

# Keyset Configuration:
# - keysets: Array of keyboard layouts
# - id: Unique identifier for the keyset
# - defaultKeyset: Which keyset to show initially
# - type: "keyset" - Special key to switch between keysets
# - keysetValue: Target keyset id to switch to
#
# Special key types:
# - keyset: Switch to different keyset (requires keysetValue)
# - shift: Toggle shift mode (uppercase/lowercase)
# - backspace, enter, action, settings, close
# - enter/action: Dynamic based on text field context
#
# Key properties (NEW SYSTEM):
# - value: Text to insert (required for regular keys)
# - caption: Text displayed on key (optional, defaults to value)
# - sValue: Text to insert when shift is active (optional, defaults to value)
# - sCaption: Text displayed when shift is active (optional, defaults to caption)
# - label: Legacy property, still supported (caption takes priority)
#
# Other properties:
# - width: Button width in units (default 1)
# - offset: Left spacing before key
# - hidden: Occupies space but invisible
# - color: Text color (hex format)
# - bgColor: Background color (hex format)
#
# Example: { value: "a", sValue: "A" }
#   - Shows "a" normally, "A" when shifted
#   - Outputs "a" normally, "A" when shifted
`;

// --- 2. HELPER: DEEP MERGE (Arrays Replace, Objects Merge) ---
// We don't want to mix "QWERTY" keys with "DVORAK" keys index-by-index.
// If the user defines 'rows', we use theirs entirely.
const deepMerge = (target: any, source: any): any => {
  if (typeof target !== 'object' || target === null) {
    return source !== undefined ? source : target;
  }
  
  if (Array.isArray(target)) {
    // CRITICAL: If it's an array (like rows/keys), use the USER'S version (source)
    // if it exists, otherwise keep default (target). Do not merge arrays.
    return Array.isArray(source) ? source : target;
  }

  const result = { ...target };
  
  // Merge source keys into target
  if (source && typeof source === 'object') {
    Object.keys(source).forEach(key => {
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        // Recursive merge for nested objects
        result[key] = deepMerge(result[key], source[key]);
      } else {
        // Simple override for primitives or arrays
        result[key] = source[key];
      }
    });
  }
  
  return result;
};

const App = () => {
  const [yamlText, setYamlText] = useState("");
  const [status, setStatus] = useState("Initializing...");
  const [loading, setLoading] = useState(true);

  // --- 3. LOAD & MERGE ON STARTUP ---
  useEffect(() => {
    const initSettings = async () => {
      try {
        await DefaultPreference.setName('keyboard_data');
        
        // A. Load Defaults
        const defaultObj = yaml.load(DEFAULT_YAML);
        
        // B. Load Saved User Data (The raw YAML string)
        const savedString = await DefaultPreference.get('config_yaml');
        
        let finalObj = defaultObj;

        if (savedString) {
          try {
            const savedObj = yaml.load(savedString);
            // C. MERGE: Default + Saved = Final
            finalObj = deepMerge(defaultObj, savedObj);
            setStatus("Merged existing settings with defaults");
          } catch (parseError) {
            console.warn("Saved YAML was corrupt, using default", parseError);
            setStatus("Saved config corrupt, reset to default");
          }
        } else {
          setStatus("Loaded default template");
        }

        // D. Convert back to YAML string for the editor
        // yaml.dump creates a clean, formatted string
        setYamlText(yaml.dump(finalObj));
        
      } catch (e) {
        console.error("Storage error", e);
        setYamlText(DEFAULT_YAML);
      } finally {
        setLoading(false);
      }
    };
    
    initSettings();
  }, []);

  const saveConfig = async () => {
    try {
      setStatus("Saving...");
      
      // Parse editor text
      const parsedObj = yaml.load(yamlText);
      const jsonString = JSON.stringify(parsedObj);

      await DefaultPreference.setName('keyboard_data'); 
      
      // Save JSON for Android
      await DefaultPreference.set('config_json', jsonString);
      
      // Save YAML for this Editor
      await DefaultPreference.set('config_yaml', yamlText);

      setStatus("Saved successfully! Close and reopen keyboard to see changes.");
      Alert.alert("Success", "Configuration saved. Close and reopen the keyboard to see changes.");
    } catch (e) {
      setStatus("Error: Invalid YAML syntax");
      Alert.alert("Syntax Error", "Please check your YAML formatting.");
      console.error("YAML parse error:", e);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Keyboard Config</Text>
      
      <TextInput
        style={styles.input}
        multiline
        value={yamlText}
        onChangeText={setYamlText}
        autoCapitalize="none"
        autoCorrect={false}
        textAlignVertical="top"
      />
      
      <View style={styles.footer}>
        <Text style={styles.status}>{status}</Text>
        <Button title="Save & Sync" onPress={saveConfig} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50, backgroundColor: '#f5f5f5' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 15, color: '#333' },
  input: { 
    flex: 1, 
    borderColor: '#999', 
    borderWidth: 1, 
    borderRadius: 8,
    marginBottom: 20, 
    padding: 15, 
    backgroundColor: '#fff',
    fontFamily: 'monospace',
    fontSize: 14,
  },
  footer: { marginBottom: 10 },
  status: { textAlign: 'center', marginBottom: 10, color: '#666', fontSize: 12 }
});

export default App;
