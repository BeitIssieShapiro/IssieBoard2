import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, Text, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import DefaultPreference from 'react-native-default-preference';

// Import keyboard and profile files
import enKeyboard from './keyboards/en.json';
import heKeyboard from './keyboards/he.json';
import arKeyboard from './keyboards/ar.json';
import defaultProfile from './profiles/default.json';
import multilingualProfile from './profiles/multilingual.json';

// Available keyboards and profiles
const KEYBOARDS = {
  'en': enKeyboard,
  'he': heKeyboard,
  'ar': arKeyboard,
};

const PROFILES = {
  'default': defaultProfile,
  'multilingual': multilingualProfile,
};

/**
 * Merge profile with keyboards to create the final configuration
 */
const buildConfiguration = (profile: any): any => {
  const config: any = {
    backgroundColor: profile.backgroundColor || '#E0E0E0',
    defaultKeyset: profile.defaultKeyset || 'abc',
    keysets: [],
    groups: profile.groups || [],
  };

  // Load all keyboards specified in the profile
  let isFirstKeyboard = true;
  for (const keyboardId of profile.keyboards) {
    const keyboard = KEYBOARDS[keyboardId as keyof typeof KEYBOARDS];
    if (!keyboard) {
      console.warn(`Keyboard "${keyboardId}" not found`);
      continue;
    }

    // Add system row to each keyset if enabled in profile
    // Give each keyset a unique ID by prefixing with keyboard ID
    const keysets = keyboard.keysets.map((keyset: any) => {
      const rows = [...keyset.rows];
      
      // Prepend system row if enabled
      if (profile.systemRow?.enabled) {
        rows.unshift({ keys: profile.systemRow.keys });
      }

      // Create unique keyset ID: keyboardId_keysetId
      // For first keyboard, keep original ID for backwards compatibility
      const uniqueKeysetId = isFirstKeyboard ? keyset.id : `${keyboardId}_${keyset.id}`;

      return {
        ...keyset,
        id: uniqueKeysetId,
        rows,
      };
    });

    // Update defaultKeyset if this is the first keyboard
    if (isFirstKeyboard && keysets.length > 0) {
      config.defaultKeyset = keysets[0].id;
      isFirstKeyboard = false;
    }

    // Add all keysets from this keyboard to the config
    config.keysets.push(...keysets);
  }

  return config;
};

const App = () => {
  const [selectedProfile, setSelectedProfile] = useState('default');
  const [configJson, setConfigJson] = useState('');
  const [status, setStatus] = useState('Initializing...');
  const [loading, setLoading] = useState(true);

  // Load configuration on startup
  useEffect(() => {
    const initSettings = async () => {
      try {
        await DefaultPreference.setName('keyboard_data');
        
        // Check if user has a saved profile selection
        const savedProfile = await DefaultPreference.get('selected_profile');
        const profileToLoad = savedProfile || 'default';
        
        setSelectedProfile(profileToLoad);
        
        // Build configuration from profile
        const profile = PROFILES[profileToLoad as keyof typeof PROFILES];
        const config = buildConfiguration(profile);
        
        // Convert to JSON string for display
        setConfigJson(JSON.stringify(config, null, 2));
        
        // Save to Android keyboard
        await DefaultPreference.set('config_json', JSON.stringify(config));
        
        setStatus(`Loaded profile: ${profile.name}`);
      } catch (e) {
        console.error('Initialization error', e);
        setStatus('Error loading configuration');
      } finally {
        setLoading(false);
      }
    };
    
    initSettings();
  }, []);

  const switchProfile = async (profileId: string) => {
    try {
      setStatus('Switching profile...');
      setSelectedProfile(profileId);
      
      // Build configuration from selected profile
      const profile = PROFILES[profileId as keyof typeof PROFILES];
      const config = buildConfiguration(profile);
      
      // Update display
      setConfigJson(JSON.stringify(config, null, 2));
      
      // Save to Android keyboard
      await DefaultPreference.setName('keyboard_data');
      await DefaultPreference.set('config_json', JSON.stringify(config));
      await DefaultPreference.set('selected_profile', profileId);
      
      setStatus(`Switched to: ${profile.name}`);
      Alert.alert('Success', `Profile changed to "${profile.name}". Close and reopen the keyboard to see changes.`);
    } catch (e) {
      console.error('Profile switch error:', e);
      setStatus('Error switching profile');
      Alert.alert('Error', 'Failed to switch profile');
    }
  };

  const saveCustomConfig = async () => {
    try {
      setStatus('Saving custom configuration...');
      
      // Parse and validate JSON
      const parsedConfig = JSON.parse(configJson);
      
      await DefaultPreference.setName('keyboard_data');
      await DefaultPreference.set('config_json', JSON.stringify(parsedConfig));
      
      setStatus('Custom configuration saved successfully!');
      Alert.alert('Success', 'Configuration saved. Close and reopen the keyboard to see changes.');
    } catch (e) {
      setStatus('Error: Invalid JSON');
      Alert.alert('Syntax Error', 'Please check your JSON formatting.');
      console.error('JSON parse error:', e);
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
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Keyboard Configuration</Text>
      
      {/* Profile Selector */}
      <View style={styles.profileSection}>
        <Text style={styles.sectionTitle}>Select Profile:</Text>
        <View style={styles.profileButtons}>
          {Object.entries(PROFILES).map(([id, profile]) => (
            <Button
              key={id}
              title={profile.name}
              onPress={() => switchProfile(id)}
              color={selectedProfile === id ? '#4CAF50' : '#2196F3'}
            />
          ))}
        </View>
        <Text style={styles.profileInfo}>
          Current: {PROFILES[selectedProfile as keyof typeof PROFILES].name}
        </Text>
      </View>

      {/* Keyboards in Current Profile */}
      <View style={styles.keyboardsSection}>
        <Text style={styles.sectionTitle}>Keyboards in This Profile:</Text>
        <Text style={styles.keyboardsList}>
          {PROFILES[selectedProfile as keyof typeof PROFILES].keyboards
            .map((kbId: string) => KEYBOARDS[kbId as keyof typeof KEYBOARDS]?.name || kbId)
            .join(', ')}
        </Text>
      </View>

      {/* JSON Editor */}
      <View style={styles.editorSection}>
        <Text style={styles.sectionTitle}>Generated Configuration (Advanced):</Text>
        <Text style={styles.helpText}>
          You can manually edit the JSON below if needed. Changes will override the profile.
        </Text>
        <TextInput
          style={styles.input}
          multiline
          value={configJson}
          onChangeText={setConfigJson}
          autoCapitalize="none"
          autoCorrect={false}
          textAlignVertical="top"
        />
      </View>

      {/* Action Buttons */}
      <View style={styles.footer}>
        <Text style={styles.status}>{status}</Text>
        <Button title="Save Custom Configuration" onPress={saveCustomConfig} />
      </View>

      {/* Help Text */}
      <View style={styles.helpSection}>
        <Text style={styles.helpTitle}>📚 About Profiles</Text>
        <Text style={styles.helpText}>
          • Profiles combine keyboards with styling{'\n'}
          • Switch profiles to change keyboards and themes{'\n'}
          • Edit keyboards/ folder to add new languages{'\n'}
          • Edit profiles/ folder to create custom themes{'\n'}
          • See keyboards/README.md for details
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20, 
    paddingTop: 50, 
    backgroundColor: '#f5f5f5' 
  },
  centered: { 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  header: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 20, 
    color: '#333',
    textAlign: 'center'
  },
  profileSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  profileButtons: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 10,
    flexWrap: 'wrap',
  },
  profileInfo: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  keyboardsSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  keyboardsList: {
    fontSize: 14,
    color: '#333',
    marginTop: 5,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  editorSection: {
    marginBottom: 20,
  },
  input: { 
    height: 300,
    borderColor: '#999', 
    borderWidth: 1, 
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 20, 
    padding: 15, 
    backgroundColor: '#fff',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  footer: { 
    marginBottom: 20 
  },
  status: { 
    textAlign: 'center', 
    marginBottom: 10, 
    color: '#666', 
    fontSize: 12 
  },
  helpSection: {
    marginBottom: 30,
    padding: 15,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 10,
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
});

export default App;
