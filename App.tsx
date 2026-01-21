import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import DefaultPreference from 'react-native-default-preference';
import yaml from 'js-yaml';

// --- 1. THE DEFAULT CONFIGURATION ---
const DEFAULT_YAML = `
backgroundColor: "#E0E0E0"
debugMode: false
rows:
  - keys: 
      - { label: "Q", value: "q" }
      - { label: "W", value: "w" }
      - { label: "E", value: "e" }
      - { label: "R", value: "r" }
      - { label: "T", value: "t" }
      - { label: "Y", value: "y" }
  - keys: 
      - { label: "A", value: "a" }
      - { label: "S", value: "s" }
      - { label: "D", value: "d" }
      - { label: "F", value: "f" }
      - { label: "G", value: "g" }
  - keys: 
      - { label: "Z", value: "z" }
      - { label: "X", value: "x" }
      - { label: "C", value: "c" }
      - { label: "V", value: "v" }
      - { label: "SPACE", value: " " } 
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

      setStatus("Saved successfully!");
      Alert.alert("Success", "Configuration saved.");
    } catch (e) {
      setStatus("Error: Invalid YAML syntax");
      Alert.alert("Syntax Error", "Please check your YAML formatting.");
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