import React, { useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet, Alert } from 'react-native';
import DefaultPreference from 'react-native-default-preference';
import yaml from 'js-yaml';

// Initial YAML template
const DEFAULT_YAML = `
backgroundColor: "#ffcccc"
layout: "qwerty"
`;

const App = () => {
  const [yamlText, setYamlText] = useState(DEFAULT_YAML);

  const saveConfig = async () => {
    try {
      // 1. Parse YAML to JS Object
      const parsedObj = yaml.load(yamlText);
      
      // 2. Convert to JSON String
      const jsonString = JSON.stringify(parsedObj);

      // 3. Save to Shared Preferences (Must match the name used in Kotlin)
      await DefaultPreference.setName('keyboard_data'); 
      await DefaultPreference.set('config_json', jsonString);

      Alert.alert("Success", "Keyboard updated! Close and re-open the keyboard to see changes.");
    } catch (e) {
      Alert.alert("Error", "Invalid YAML format");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Keyboard Config (YAML)</Text>
      <TextInput
        style={styles.input}
        multiline
        value={yamlText}
        onChangeText={setYamlText}
        autoCapitalize="none"
      />
      <Button title="Save & Apply" onPress={saveConfig} />
      <Text style={styles.hint}>
        After saving, go to System Settings and enable "YamlKeyboard"
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50, backgroundColor: '#fff' },
  header: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  input: { 
    flex: 1, 
    borderColor: '#333', 
    borderWidth: 1, 
    marginBottom: 20, 
    padding: 10, 
    fontFamily: 'monospace' 
  },
  hint: { marginTop: 20, color: '#666', fontStyle: 'italic' }
});

export default App;