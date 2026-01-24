import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, Text, StyleSheet, Alert, ActivityIndicator, ScrollView, Platform, TouchableOpacity } from 'react-native';
import SaveProfileModal from './components/SaveProfileModal';
import KeyboardPreferences from './src/native/KeyboardPreferences';
import { useLocalization } from './src/localization';
import { KeyboardPreview } from './src/components/KeyboardPreview';

// Import keyboard and profile files
import enKeyboard from './keyboards/en.json';
import heKeyboard from './keyboards/he.json';
import arKeyboard from './keyboards/ar.json';
import defaultProfile from './profiles/default.json';
import multilingualProfile from './profiles/multilingual.json';

interface SavedProfile {
  name: string;
  key: string;
}

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
    keyboards: profile.keyboards || [],
    defaultKeyboard: profile.defaultKeyboard || (profile.keyboards && profile.keyboards[0]) || 'en',
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
  const { strings } = useLocalization();
  const [selectedProfile, setSelectedProfile] = useState('default');
  const [configJson, setConfigJson] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<SavedProfile | null>(null);
  const [jsonValidationError, setJsonValidationError] = useState<string | null>(null);
  const [lastValidConfig, setLastValidConfig] = useState<string>('');

  // Load configuration on startup
  useEffect(() => {
    const initSettings = async () => {
      try {
        // Load saved custom profiles list
        let savedList: SavedProfile[] = [];
        const savedListJson = await KeyboardPreferences.getProfile('saved_list');
        if (savedListJson) {
          try {
            savedList = JSON.parse(savedListJson);
            setSavedProfiles(savedList);
          } catch (e) {
            console.warn('Failed to parse saved profiles list:', e);
          }
        }

        // Get saved profile (platform-specific implementation)
        const savedProfileId = (await KeyboardPreferences.getCurrentProfile()) || 'default';
        setSelectedProfile(savedProfileId);

        // Load configuration - check built-in profiles first, then saved custom profiles
        let config;
        let profileName: string;
        const builtInProfile = PROFILES[savedProfileId as keyof typeof PROFILES];

        if (builtInProfile) {
          // Built-in profile: build configuration from profile definition
          config = buildConfiguration(builtInProfile);
          profileName = builtInProfile.name;
        } else {
          // Custom profile: load from storage
          config = await KeyboardPreferences.getProfileObject(savedProfileId);

          // Find the profile name from savedList (already parsed above)
          const savedProfileInfo = savedList.find(p => p.key === savedProfileId);
          profileName = savedProfileInfo?.name || strings.custom;

          if (config) {
            // Check if config needs to be built (has keyboards array but no keysets)
            if (config.keyboards && (!config.keysets || config.keysets.length === 0)) {
              console.log(`Building configuration for saved profile "${profileName}"`);
              config = buildConfiguration(config);
            }
          } else {
            // Fallback to default if custom profile not found
            console.warn(`Saved profile "${savedProfileId}" not found, falling back to default`);
            const fallbackProfile = PROFILES['default'];
            config = buildConfiguration(fallbackProfile);
            profileName = fallbackProfile.name;
            setSelectedProfile('default');
          }
        }

        // Convert to JSON string for display
        setConfigJson(JSON.stringify(config, null, 2));

        // Save to keyboard (platform-specific implementation)
        const setProfileResult = await KeyboardPreferences.setCurrentProfile(savedProfileId);
        const setConfigResult = await KeyboardPreferences.setKeyboardConfigObject(config);

        console.log(`✅ ${Platform.OS}: Configuration loaded and saved`);
        console.log('  Set profile result:', setProfileResult);
        console.log('  Set config result:', setConfigResult);

        // Check if native module is working
        if (Platform.OS === 'ios' && !setProfileResult.success) {
          console.warn('⚠️ iOS native module not available. See console for setup instructions.');
          setStatus(`${strings.loadedProfile} ${profileName} - ${strings.nativeModuleNotConnected}`);
        } else {
          setStatus(`${strings.loadedProfile} ${profileName}`);
        }
      } catch (e) {
        console.error('Initialization error', e);
        setStatus(strings.errorLoadingConfiguration);
      } finally {
        setLoading(false);
      }
    };

    initSettings();
  }, []);

  /**
   * Shared logic to apply a configuration and update the UI
   */
  const applyConfiguration = async (config: any, profileName: string, profileId: string) => {
    // Update display
    setConfigJson(JSON.stringify(config, null, 2));

    // Save to keyboard (platform-specific implementation)
    await KeyboardPreferences.setCurrentProfile(profileId);
    setSelectedProfile(profileId);
    await KeyboardPreferences.setKeyboardConfigObject(config);

    console.log(`✅ ${Platform.OS}: Applied configuration "${profileName}"`);
  };

  const switchProfile = async (profileId: string) => {
    try {
      setStatus(strings.switchingProfile);

      // Build configuration from selected profile
      const profile = PROFILES[profileId as keyof typeof PROFILES];
      const config = buildConfiguration(profile);

      await applyConfiguration(config, profile.name, profileId);

      setStatus(`${strings.switchedTo} ${profile.name}`);
      Alert.alert(strings.success, `${strings.profileChangedTo} "${profile.name}". ${strings.closeAndReopenKeyboard}`);
    } catch (e) {
      console.error('Profile switch error:', e);
      setStatus(strings.errorSwitchingProfile);
      Alert.alert(strings.error, strings.failedToSwitchProfile);
    }
  };

  const handleJsonChange = (newValue: string) => {
    setConfigJson(newValue);

    // Validate JSON
    try {
      JSON.parse(newValue);
      setJsonValidationError(null);
      setLastValidConfig(newValue);
    } catch (e: any) {
      setJsonValidationError(e.message || 'Invalid JSON');
    }
  };

  const saveCustomConfig = () => {
    // Validate JSON before showing modal
    try {
      JSON.parse(configJson);
      setShowSaveModal(true);
    } catch (e) {
      Alert.alert(strings.syntaxError, strings.checkJsonFormatting);
    }
  };

  const handleSaveWithName = async (profileName: string) => {
    const name = profileName.trim();
    if (!name) {
      Alert.alert(strings.error, strings.enterProfileName);
      return;
    }

    try {
      setStatus(strings.savingConfiguration);
      const parsedConfig = JSON.parse(configJson);
      const key = `custom_${Date.now()}`;

      // Save the config with unique key
      await KeyboardPreferences.setProfileObject(parsedConfig, key);

      // Update saved profiles list
      const newList = [...savedProfiles, { name, key }];
      await KeyboardPreferences.setProfile(JSON.stringify(newList), 'saved_list');
      setSavedProfiles(newList);

      // Apply as current config
      await KeyboardPreferences.setKeyboardConfigObject(parsedConfig);
      console.log(`✅ ${Platform.OS}: Custom config "${name}" saved`);

      setShowSaveModal(false);
      setStatus(`${strings.profileSaved} ${name}`);
      Alert.alert(strings.success, `"${name}" ${strings.profileSaved} ${strings.closeAndReopenKeyboard}`);
    } catch (e) {
      console.error('Save error:', e);
      Alert.alert(strings.error, strings.failedToSaveProfile);
    }
  };

  const loadSavedProfile = async (profile: SavedProfile) => {
    try {
      setStatus(strings.loadingProfile);
      let config = await KeyboardPreferences.getProfileObject(profile.key);

      if (config) {
        // Check if config needs to be built (has keyboards array but no keysets)
        // This handles profiles that were saved as partial profiles
        if (config?.keyboards && (!config.keysets || config.keysets.length === 0)) {
          console.log(`Building configuration for saved profile "${profile.name}"`);
          config = buildConfiguration(config);
        }

        await applyConfiguration(config, profile.name, profile.key);

        setStatus(`${strings.loadedProfile} ${profile.name}`);
        Alert.alert(strings.success, `"${profile.name}" ${strings.profileLoaded} ${strings.closeAndReopenKeyboard}`);
      } else {
        Alert.alert(strings.error, strings.profileNotFound);
      }
    } catch (e) {
      console.error('Load error:', e);
      Alert.alert(strings.error, strings.failedToLoadProfile);
    }
  };

  const showProfileMenu = (profile: SavedProfile) => {
    Alert.alert(
      profile.name,
      strings.whatWouldYouLikeToDo,
      [
        { text: strings.cancel, style: 'cancel' },
        {
          text: strings.edit,
          onPress: () => startEditingProfile(profile),
        },
        {
          text: strings.delete,
          style: 'destructive',
          onPress: () => confirmDeleteProfile(profile),
        },
      ]
    );
  };

  const startEditingProfile = async (profile: SavedProfile) => {
    try {
      const config = await KeyboardPreferences.getProfileObject(profile.key);
      if (config) {
        setConfigJson(JSON.stringify(config, null, 2));
        setEditingProfile(profile);
        setStatus(`${strings.editing} ${profile.name}`);
      } else {
        Alert.alert(strings.error, strings.profileNotFound);
      }
    } catch (e) {
      console.error('Edit error:', e);
      Alert.alert(strings.error, strings.failedToLoadForEditing);
    }
  };

  const saveEditedProfile = async () => {
    if (!editingProfile) return;

    try {
      const parsedConfig = JSON.parse(configJson);

      // Save the updated config
      await KeyboardPreferences.setProfileObject(parsedConfig, editingProfile.key);
      await KeyboardPreferences.setKeyboardConfigObject(parsedConfig);

      setStatus(`${strings.savedChangesTo} ${editingProfile.name}`);
      Alert.alert(strings.success, `"${editingProfile.name}" ${strings.profileUpdated} ${strings.closeAndReopenKeyboard}`);
      setEditingProfile(null);
    } catch (e) {
      Alert.alert(strings.syntaxError, strings.checkJsonFormatting);
      console.error('Save edit error:', e);
    }
  };

  const cancelEditing = () => {
    setEditingProfile(null);
    // Reload the current profile to reset the JSON editor
    const profile = PROFILES[selectedProfile as keyof typeof PROFILES];
    if (profile) {
      const config = buildConfiguration(profile);
      setConfigJson(JSON.stringify(config, null, 2));
    }
    setStatus(strings.editCancelled);
  };

  const confirmDeleteProfile = (profile: SavedProfile) => {
    Alert.alert(
      strings.deleteProfile,
      `${strings.confirmDelete} "${profile.name}"?`,
      [
        { text: strings.cancel, style: 'cancel' },
        {
          text: strings.delete,
          style: 'destructive',
          onPress: () => deleteSavedProfile(profile),
        },
      ]
    );
  };

  const deleteSavedProfile = async (profile: SavedProfile) => {
    try {
      // Remove from saved profiles list
      const newList = savedProfiles.filter(p => p.key !== profile.key);
      await KeyboardPreferences.setProfile(JSON.stringify(newList), 'saved_list');
      setSavedProfiles(newList);

      setStatus(`${strings.deleted} ${profile.name}`);
      console.log(`✅ ${Platform.OS}: Deleted profile "${profile.name}"`);
    } catch (e) {
      console.error('Delete error:', e);
      Alert.alert(strings.error, strings.failedToDeleteProfile);
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
    <>
      {/* Save Profile Modal */}
      <SaveProfileModal
        showSaveModal={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveWithName}
        key={showSaveModal.toString()}
      />

      <ScrollView style={styles.container}>
        <Text style={styles.header}>{strings.keyboardConfiguration}</Text>

        {/* Profile Selector */}
        <View style={styles.profileSection}>
          <Text style={styles.sectionTitle}>{strings.builtInProfiles}</Text>
          <View style={styles.profileButtons}>
            {Object.entries(PROFILES).map(([id, profile]) => (
              <Button
                key={`${id}-${selectedProfile}`}
                title={profile.name}
                onPress={() => switchProfile(id)}
                color={selectedProfile === id ? '#4CAF50' : '#2196F3'}
              />
            ))}
          </View>

          {/* Saved Custom Profiles */}
          {savedProfiles.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 15 }]}>{strings.savedProfiles}</Text>
              <Text style={styles.hintText}>{strings.longPressForOptions}</Text>
              <View style={styles.profileButtons}>
                {savedProfiles.map((profile) => (
                  <TouchableOpacity
                    key={profile.key}
                    style={[
                      styles.savedProfileButton,
                      { backgroundColor: selectedProfile === profile.key ? '#4CAF50' : '#2196F3' }
                    ]}
                    onPress={() => loadSavedProfile(profile)}
                    onLongPress={() => showProfileMenu(profile)}
                    delayLongPress={500}
                  >
                    <Text style={styles.savedProfileButtonText}>{profile.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Text style={styles.profileInfo}>
            {strings.current} {PROFILES[selectedProfile as keyof typeof PROFILES]?.name || savedProfiles.find(p => p.key === selectedProfile)?.name || strings.custom}
          </Text>
        </View>

        {/* Keyboards in Current Profile */}
        <View style={styles.keyboardsSection}>
          <Text style={styles.sectionTitle}>{strings.keyboardsInProfile}</Text>
          <Text style={styles.keyboardsList}>
            {PROFILES[selectedProfile as keyof typeof PROFILES]?.keyboards
              ?.map((kbId: string) => KEYBOARDS[kbId as keyof typeof KEYBOARDS]?.name || kbId)
              .join(', ') || strings.customConfiguration}
          </Text>
        </View>

        {/* Live Keyboard Preview */}
        <View style={styles.previewSection}>
          <Text style={styles.sectionTitle}>🎹 {strings.keyboardPreview}</Text>
          <Text style={styles.helpText}>
            {strings.previewHelpText}
          </Text>
          <View style={styles.previewContainer}>
            <KeyboardPreview
              key={`${selectedProfile}-${configJson.length}`} // Force re-render on profile/config change
              style={styles.preview}
              configJson={configJson}
              onKeyPress={(event) => {
                const { type, value } = event.nativeEvent;
              }}
            />
          </View>
        </View>

        {/* JSON Editor */}
        <View style={styles.editorSection}>
          <Text style={styles.sectionTitle}>
            {editingProfile
              ? `${strings.editing} ${editingProfile.name}`
              : strings.generatedConfiguration}
          </Text>
          <Text style={styles.helpText}>
            {editingProfile
              ? strings.editingHelpText
              : strings.editorHelpText}
          </Text>

          <TextInput
            style={[
              styles.input,
              jsonValidationError ? styles.inputError : null
            ]}
            multiline
            value={configJson}
            onChangeText={handleJsonChange}
            autoCapitalize="none"
            autoCorrect={false}
            textAlignVertical="top"
          />
          {jsonValidationError && (
            <View style={styles.validationError}>
              <Text style={styles.validationErrorText}>
                ⚠️ Invalid JSON: {jsonValidationError}
              </Text>
              <Text style={styles.validationErrorSubtext}>
                Previous valid configuration is still active. Fix the JSON to apply changes.
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.footer}>
          <Text style={styles.status}>{status}</Text>
          {editingProfile ? (
            <View style={styles.editButtons}>
              <View style={styles.editButtonWrapper}>
                <Button title={strings.cancel} onPress={cancelEditing} color="#666" />
              </View>
              <View style={styles.editButtonWrapper}>
                <Button title={strings.saveChanges} onPress={saveEditedProfile} color="#4CAF50" />
              </View>
            </View>
          ) : (
            <Button title={strings.saveCustomConfiguration} onPress={saveCustomConfig} />
          )}
        </View>

        {/* Help Text */}
        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>📚 {strings.aboutProfiles}</Text>
          <Text style={styles.helpText}>{strings.helpText}</Text>
        </View>
      </ScrollView>
    </>
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
  hintText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  savedProfileButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  savedProfileButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
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
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  editButtonWrapper: {
    flex: 1,
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
  previewSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  previewContainer: {
    marginTop: 10,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  preview: {
    height: 250,
  },
  validationError: {
    backgroundColor: '#FFF3CD',
    borderColor: '#FFC107',
    borderWidth: 1,
    borderRadius: 4,
    padding: 10,
    marginTop: 10,
  },
  validationErrorText: {
    color: '#856404',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  validationErrorSubtext: {
    color: '#856404',
    fontSize: 11,
    fontStyle: 'italic',
  },
  inputError: {
    borderColor: '#dc3545',
    borderWidth: 2,
  },
});

export default App;
