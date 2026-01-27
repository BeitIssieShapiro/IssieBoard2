import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  Animated,
  Keyboard,
} from 'react-native';
import { EditorProvider, useEditor } from '../context/EditorContext';
import { InteractiveCanvas } from '../components/canvas/InteractiveCanvas';
import { Toolbox } from '../components/toolbox/Toolbox';
import KeyboardPreferences from '../native/KeyboardPreferences';
import { KeyboardConfig, ProfileDefinition, KeyboardDefinition } from '../../types';
import AddProfileModal from '../../components/AddProfileModal';

// Import keyboard and profile files
import enKeyboard from '../../keyboards/en.json';
import heKeyboard from '../../keyboards/he.json';
import arKeyboard from '../../keyboards/ar.json';
import defaultProfile from '../../profiles/default.json';
import multilingualProfile from '../../profiles/multilingual.json';

// Available keyboards and profiles
const KEYBOARDS: Record<string, KeyboardDefinition> = {
  'en': enKeyboard,
  'he': heKeyboard,
  'ar': arKeyboard,
};

const PROFILES: Record<string, ProfileDefinition> = {
  'default': defaultProfile,
  'multilingual': multilingualProfile,
};

/**
 * Build configuration from profile definition
 */
const buildConfiguration = (profile: ProfileDefinition): KeyboardConfig => {
  const config: KeyboardConfig = {
    backgroundColor: profile.backgroundColor || '#E0E0E0',
    defaultKeyset: profile.defaultKeyset || 'abc',
    keysets: [],
    groups: profile.groups || [],
    keyboards: profile.keyboards || [],
    defaultKeyboard: profile.defaultKeyboard || (profile.keyboards && profile.keyboards[0]) || 'en',
  };

  let isFirstKeyboard = true;
  for (const keyboardId of profile.keyboards) {
    const keyboard = KEYBOARDS[keyboardId];
    if (!keyboard) {
      console.warn(`Keyboard "${keyboardId}" not found`);
      continue;
    }

    const keysets = keyboard.keysets.map((keyset: any) => {
      const rows = [...keyset.rows];
      if (profile.systemRow?.enabled) {
        rows.unshift({ keys: profile.systemRow.keys });
      }
      const uniqueKeysetId = isFirstKeyboard ? keyset.id : `${keyboardId}_${keyset.id}`;
      return { ...keyset, id: uniqueKeysetId, rows };
    });

    if (isFirstKeyboard && keysets.length > 0) {
      config.defaultKeyset = keysets[0].id;
      isFirstKeyboard = false;
    }

    config.keysets.push(...keysets);
  }

  return config;
};

interface EditorScreenInnerProps {
  profileName: string;
  profileId: string;
  isActiveProfile: boolean;
  isCustomProfile: boolean;
  onBack: () => void;
  onSave: (config: KeyboardConfig, styleGroups: any[]) => Promise<void>;
  onSetActive: () => Promise<void>;
  onDuplicate: (newName: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onProfileChange: (profileId: string, profileName: string) => void;
  onCreateNew: (name: string, languages: string[]) => Promise<void>;
}

// Helper: Get key value from keyId (keysetId:rowIndex:keyIndex)
const getKeyValueFromId = (
  keyId: string,
  config: KeyboardConfig
): string | null => {
  const parts = keyId.split(':');
  if (parts.length !== 3) return null;
  
  const [keysetId, rowIndexStr, keyIndexStr] = parts;
  const rowIndex = parseInt(rowIndexStr, 10);
  const keyIndex = parseInt(keyIndexStr, 10);
  
  const keyset = config.keysets.find(ks => ks.id === keysetId);
  if (!keyset) return null;
  
  const row = keyset.rows[rowIndex];
  if (!row) return null;
  
  const key = row.keys[keyIndex];
  if (!key) return null;
  
  return key.value || key.caption || key.label || key.type || null;
};

// Convert StyleGroups to GroupConfig format for saving
// Note: template includes hidden for native renderer to apply
const convertStyleGroupsToGroupConfig = (
  styleGroups: { name: string; members: string[]; style: { hidden?: boolean; bgColor?: string; color?: string; label?: string } }[],
  config: KeyboardConfig
): { name: string; items: string[]; template: { color: string; bgColor: string; hidden?: boolean } }[] => {
  return styleGroups.map(group => {
    // Convert member key IDs to key values
    const items: string[] = [];
    for (const memberId of group.members) {
      const keyValue = getKeyValueFromId(memberId, config);
      if (keyValue && !items.includes(keyValue)) {
        items.push(keyValue);
      }
    }
    
    return {
      name: group.name,
      items,
      template: {
        color: group.style.color || '',
        bgColor: group.style.bgColor || '',
        hidden: group.style.hidden,
      },
    };
  });
};

interface ProfileOption {
  id: string;
  name: string;
  isBuiltIn: boolean;
}

const EditorScreenInner: React.FC<EditorScreenInnerProps> = ({ 
  profileName, 
  profileId,
  isActiveProfile,
  isCustomProfile,
  onBack,
  onSave,
  onSetActive,
  onDuplicate,
  onDelete,
  onProfileChange,
  onCreateNew,
}) => {
  const { state, setMode, setConfig } = useEditor();
  const [testText, setTestText] = useState('');
  const [saving, setSaving] = useState(false);
  const [settingActive, setSettingActive] = useState(false);
  const [showProfilePicker, setShowProfilePicker] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateName, setDuplicateName] = useState('');
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [showAddProfileModal, setShowAddProfileModal] = useState(false);
  const [currentProfileName, setCurrentProfileName] = useState(profileName);
  const [currentProfileId, setCurrentProfileId] = useState(profileId);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Track keyboard visibility
  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const showToast = useCallback((message: string, duration: number = 3000) => {
    setToastMessage(message);
    toastOpacity.setValue(0);
    
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(duration),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToastMessage(null);
    });
  }, [toastOpacity]);

  // Load available profiles - extracted as a reusable function
  const loadProfilesList = useCallback(async () => {
    const profileList: ProfileOption[] = [];
    
    // Add built-in profiles
    for (const [id, profile] of Object.entries(PROFILES)) {
      profileList.push({ id, name: profile.name, isBuiltIn: true });
    }
    
    // Load saved custom profiles
    try {
      const savedListJson = await KeyboardPreferences.getProfile('saved_list');
      if (savedListJson) {
        const savedList = JSON.parse(savedListJson);
        for (const saved of savedList) {
          profileList.push({ id: saved.key, name: saved.name, isBuiltIn: false });
        }
      }
    } catch (e) {
      console.warn('Failed to load saved profiles:', e);
    }
    
    setProfiles(profileList);
  }, []);

  // Load available profiles on mount
  useEffect(() => {
    loadProfilesList();
  }, [loadProfilesList]);

  const handleLoadProfile = useCallback(async (profile: ProfileOption) => {
    setShowProfilePicker(false);
    
    try {
      let config: KeyboardConfig;
      let loadedStyleGroups: any[] = [];
      
      if (profile.isBuiltIn) {
        const builtInProfile = PROFILES[profile.id];
        if (builtInProfile) {
          config = buildConfiguration(builtInProfile);
        } else {
          throw new Error('Profile not found');
        }
      } else {
        const storedConfig = await KeyboardPreferences.getProfileObject(profile.id);
        if (storedConfig) {
          config = storedConfig as KeyboardConfig;
        } else {
          throw new Error('Custom profile not found');
        }
      }
      
      // Load style groups for this profile
      try {
        const styleGroupsJson = await KeyboardPreferences.getProfile(`${profile.id}_styleGroups`);
        if (styleGroupsJson) {
          loadedStyleGroups = JSON.parse(styleGroupsJson);
        }
      } catch { /* ignore */ }
      
      // Update editor state
      setConfig(config, loadedStyleGroups);
      setCurrentProfileName(profile.name);
      setCurrentProfileId(profile.id);
      onProfileChange(profile.id, profile.name);
      
      console.log(`✅ Switched to profile "${profile.name}"`);
    } catch (error) {
      console.error('Failed to load profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    }
  }, [setConfig, onProfileChange]);

  const handleSetActive = useCallback(async () => {
    setSettingActive(true);
    try {
      await onSetActive();
      showToast('✓ Set as active keyboard');
    } catch (error) {
      showToast('✗ Failed to set active');
    } finally {
      setSettingActive(false);
    }
  }, [onSetActive, showToast]);

  const handleDelete = useCallback(async () => {
    if (!isCustomProfile) {
      Alert.alert('Cannot Delete', 'Built-in profiles cannot be deleted.');
      return;
    }
    
    if (isActiveProfile) {
      Alert.alert('Cannot Delete', 'Cannot delete the active profile. Please switch to another profile first.');
      return;
    }
    
    Alert.alert(
      'Delete Profile',
      `Are you sure you want to delete "${currentProfileName}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await onDelete();
              showToast(`✓ Deleted "${currentProfileName}"`);
            } catch (error) {
              showToast('✗ Failed to delete profile');
            }
          }
        },
      ]
    );
  }, [isCustomProfile, isActiveProfile, currentProfileName, onDelete, showToast]);

  const handleDuplicate = useCallback(async () => {
    if (!duplicateName.trim()) {
      Alert.alert('Error', 'Please enter a name for the new profile');
      return;
    }
    
    setShowDuplicateModal(false);
    try {
      await onDuplicate(duplicateName.trim());
      // Update current profile name to the new one
      const newName = duplicateName.trim();
      setCurrentProfileName(newName);
      // Note: currentProfileId will be updated via onProfileChange callback from parent
      
      showToast(`✓ Created "${newName}"`);
      
      // Reload profiles list to include the new one
      await loadProfilesList();
      setDuplicateName('');
    } catch (error) {
      showToast('✗ Failed to duplicate profile');
    }
  }, [duplicateName, onDuplicate, showToast]);

  const handleCreateNewProfile = useCallback(async (name: string, languages: string[]) => {
    setShowAddProfileModal(false);
    setShowProfilePicker(false);
    
    try {
      await onCreateNew(name, languages);
      showToast(`✓ Created "${name}"`);
      
      // Reload profiles list
      await loadProfilesList();
    } catch (error) {
      showToast('✗ Failed to create profile');
      console.error('Create profile error:', error);
    }
  }, [onCreateNew, showToast, loadProfilesList]);

  const handleTestInput = useCallback((char: string) => {
    if (char === '\b' || char === 'backspace') {
      setTestText(prev => prev.slice(0, -1));
    } else if (char === '\n' || char === 'enter') {
      setTestText(prev => prev + '\n');
    } else {
      setTestText(prev => prev + char);
    }
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // Convert StyleGroups to GroupConfig format for the native renderer
      // The native renderer will apply styles from groups - keys stay clean
      const groupConfigs = convertStyleGroupsToGroupConfig(state.styleGroups, state.config);
      
      // Replace groups entirely with current StyleGroups (don't accumulate)
      // This ensures deleted groups are actually removed
      const configToSave: KeyboardConfig = {
        ...state.config,
        groups: groupConfigs,
      };
      
      // Save style groups (for editor to reload) and config (for native keyboard)
      await onSave(configToSave, state.styleGroups);
      showToast('✓ Saved successfully');
    } catch (error) {
      showToast('✗ Failed to save configuration');
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  }, [state.config, state.styleGroups, onSave, showToast]);

  const handleBack = useCallback(() => {
    if (state.isDirty) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Do you want to save before leaving?',
        [
          { text: 'Discard', style: 'destructive', onPress: onBack },
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save', onPress: async () => {
            await handleSave();
            onBack();
          }},
        ]
      );
    } else {
      onBack();
    }
  }, [state.isDirty, onBack, handleSave]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Toast Notification */}
      {toastMessage && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}

      {/* Add New Profile Modal */}
      <AddProfileModal
        visible={showAddProfileModal}
        onClose={() => setShowAddProfileModal(false)}
        onCreate={handleCreateNewProfile}
      />

      {/* Duplicate Profile Modal */}
      <Modal
        visible={showDuplicateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDuplicateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.duplicateModalContainer}>
            <Text style={styles.duplicateModalTitle}>Duplicate Profile</Text>
            <Text style={styles.duplicateModalSubtitle}>
              Create a copy of "{currentProfileName}"
            </Text>
            <TextInput
              style={styles.duplicateInput}
              placeholder="New profile name..."
              value={duplicateName}
              onChangeText={setDuplicateName}
              autoFocus
            />
            <View style={styles.duplicateModalButtons}>
              <TouchableOpacity
                style={styles.duplicateCancelButton}
                onPress={() => {
                  setShowDuplicateModal(false);
                  setDuplicateName('');
                }}
              >
                <Text style={styles.duplicateCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.duplicateConfirmButton}
                onPress={handleDuplicate}
              >
                <Text style={styles.duplicateConfirmText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Profile Picker Modal */}
      <Modal
        visible={showProfilePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowProfilePicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowProfilePicker(false)}
        >
          <View style={styles.profilePickerContainer}>
            <Text style={styles.profilePickerTitle}>Load Profile</Text>
            
            {/* Add New Profile Button */}
            <TouchableOpacity
              style={styles.addNewProfileButton}
              onPress={() => {
                setShowProfilePicker(false);
                setShowAddProfileModal(true);
              }}
            >
              <Text style={styles.addNewProfileButtonText}>+ Add New Profile</Text>
            </TouchableOpacity>
            
            <FlatList
              data={profiles}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.profileOption,
                    item.name === currentProfileName && styles.profileOptionActive,
                  ]}
                  onPress={() => handleLoadProfile(item)}
                >
                  <Text style={styles.profileOptionText}>
                    {item.isBuiltIn ? '📦 ' : '💾 '}{item.name}
                  </Text>
                  {item.name === currentProfileName && (
                    <Text style={styles.profileOptionCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Header Row 1: Profile Name & Mode Toggle */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.headerCenter}
          onPress={() => setShowProfilePicker(true)}
        >
          <Text style={styles.profileName} numberOfLines={1}>
            {currentProfileName}
          </Text>
          <Text style={styles.profileDropdownIcon}>▼</Text>
          {isActiveProfile && (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          )}
        </TouchableOpacity>
        
        {/* Mode Toggle */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              state.mode === 'edit' && styles.modeButtonActive,
            ]}
            onPress={() => setMode('edit')}
          >
            <Text style={[
              styles.modeButtonText,
              state.mode === 'edit' && styles.modeButtonTextActive,
            ]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeButton,
              state.mode === 'test' && styles.modeButtonActive,
            ]}
            onPress={() => setMode('test')}
          >
            <Text style={[
              styles.modeButtonText,
              state.mode === 'test' && styles.modeButtonTextActive,
            ]}>Test</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Header Row 2: Action Buttons */}
      <View style={styles.actionBar}>
        {/* Save Button */}
        <TouchableOpacity
          style={[styles.actionButton, styles.saveButton, saving && styles.actionButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.actionButtonText}>
              💾 Save{state.isDirty ? ' •' : ''}
            </Text>
          )}
        </TouchableOpacity>

        {/* Set Active Button */}
        <TouchableOpacity
          style={[
            styles.actionButton, 
            styles.setActiveButton,
            isActiveProfile && styles.actionButtonDisabled,
          ]}
          onPress={handleSetActive}
          disabled={isActiveProfile || settingActive}
        >
          {settingActive ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.actionButtonText}>
              {isActiveProfile ? '✓ Active' : '⚡ Use'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Duplicate Button */}
        <TouchableOpacity
          style={[styles.actionButton, styles.duplicateButton]}
          onPress={() => {
            setDuplicateName(`${currentProfileName} Copy`);
            setShowDuplicateModal(true);
          }}
        >
          <Text style={styles.actionButtonText}>📋 Copy</Text>
        </TouchableOpacity>

        {/* Delete Button - only for custom profiles */}
        {isCustomProfile && (
          <TouchableOpacity
            style={[
              styles.actionButton, 
              styles.deleteButton,
              isActiveProfile && styles.actionButtonDisabled,
            ]}
            onPress={handleDelete}
            disabled={isActiveProfile}
          >
            <Text style={styles.actionButtonText}>🗑️</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Main Content */}
      <KeyboardAvoidingView 
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Test Mode Text Area */}
        {state.mode === 'test' && (
          <View style={styles.testArea}>
            <TextInput
              style={styles.testInput}
              value={testText}
              onChangeText={setTestText}
              placeholder="Tap keys below to test..."
              multiline
              editable={false}
            />
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={() => setTestText('')}
            >
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Canvas - Interactive Keyboard Preview - hide when keyboard is open in edit mode */}
        {!(keyboardVisible && state.selectedKeys.length > 0) && (
          <View style={styles.canvasContainer}>
            <InteractiveCanvas onTestInput={handleTestInput} />
          </View>
        )}

        {/* Toolbox - Context-aware control panel - expands when keyboard is open */}
        <View style={[
          styles.toolboxContainer,
          keyboardVisible && state.selectedKeys.length > 0 && styles.toolboxExpanded
        ]}>
          <Toolbox />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

interface EditorScreenProps {
  profileId?: string;
  onBack: () => void;
}

export const EditorScreen: React.FC<EditorScreenProps> = ({ 
  profileId: propProfileId,
  onBack,
}) => {
  const [loading, setLoading] = useState(true);
  const [initialConfig, setInitialConfig] = useState<KeyboardConfig | null>(null);
  const [initialStyleGroups, setInitialStyleGroups] = useState<any[]>([]);
  const [profileName, setProfileName] = useState('Profile');
  const [currentProfileId, setCurrentProfileId] = useState<string>('default');
  const [activeKeyboardProfileId, setActiveKeyboardProfileId] = useState<string>('default');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        // Get the active keyboard profile
        const activeProfile = await KeyboardPreferences.getCurrentProfile();
        setActiveKeyboardProfileId(activeProfile || 'default');
        
        // Get the current profile from preferences (what the keyboard is using)
        let profileId = propProfileId;
        if (!profileId) {
          profileId = activeProfile || 'default';
        }
        setCurrentProfileId(profileId);
        
        let config: KeyboardConfig;
        let name: string;
        
        // First, try to load from storage (might have user modifications)
        const storedConfig = await KeyboardPreferences.getProfileObject(profileId);
        
        // Check if it's a built-in profile
        const builtInProfile = PROFILES[profileId];
        if (storedConfig) {
          // Use stored config (might be modified built-in or custom)
          config = storedConfig as KeyboardConfig;
          name = builtInProfile?.name || 'Custom Profile';
          // Try to get custom profile name from saved list
          if (!builtInProfile) {
            try {
              const savedListJson = await KeyboardPreferences.getProfile('saved_list');
              if (savedListJson) {
                const savedList = JSON.parse(savedListJson);
                const found = savedList.find((p: any) => p.key === profileId);
                if (found?.name) name = found.name;
              }
            } catch { /* ignore */ }
          }
        } else if (builtInProfile) {
          // No stored config, build from built-in profile
          config = buildConfiguration(builtInProfile);
          name = builtInProfile.name;
        } else {
          // Fallback to default
          config = buildConfiguration(PROFILES['default']);
          name = 'Default Profile';
          profileId = 'default';
          setCurrentProfileId('default');
        }
        
        setInitialConfig(config);
        setProfileName(name);
        
        // Load saved style groups for this profile
        try {
          const styleGroupsJson = await KeyboardPreferences.getProfile(`${profileId}_styleGroups`);
          if (styleGroupsJson) {
            const loadedGroups = JSON.parse(styleGroupsJson);
            setInitialStyleGroups(loadedGroups);
            console.log(`✅ Loaded ${loadedGroups.length} style groups for profile "${name}"`);
          }
        } catch (e) {
          console.warn('Failed to load style groups:', e);
        }
        
        // Also save to preferences so keyboard extension can read it
        await KeyboardPreferences.setKeyboardConfigObject(config);
        await KeyboardPreferences.setCurrentProfile(profileId);
        console.log(`✅ Loaded and saved profile "${name}" to preferences`);
        
      } catch (error) {
        console.error('Failed to load profile:', error);
        const config = buildConfiguration(PROFILES['default']);
        setInitialConfig(config);
        setProfileName('Default Profile');
        
        // Try to save default config
        try {
          await KeyboardPreferences.setKeyboardConfigObject(config);
          await KeyboardPreferences.setCurrentProfile('default');
        } catch (saveError) {
          console.error('Failed to save default config:', saveError);
        }
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [propProfileId]);

  const handleSave = useCallback(async (config: KeyboardConfig, styleGroups: any[]) => {
    // Save the config to storage so it persists across app restarts
    await KeyboardPreferences.setProfileObject(config, currentProfileId);
    
    // Save style groups separately for the editor to reload
    await KeyboardPreferences.setProfile(
      JSON.stringify(styleGroups),
      `${currentProfileId}_styleGroups`
    );
    
    // If this is the active profile, also update the keyboard extension
    if (currentProfileId === activeKeyboardProfileId) {
      await KeyboardPreferences.setKeyboardConfigObject(config);
    }
    
    console.log(`✅ Saved config and ${styleGroups.length} style groups for profile "${currentProfileId}"`);
  }, [currentProfileId, activeKeyboardProfileId]);

  const handleSetActive = useCallback(async () => {
    // Set this profile as the active one for the keyboard
    const config = await KeyboardPreferences.getProfileObject(currentProfileId);
    if (config) {
      await KeyboardPreferences.setKeyboardConfigObject(config as KeyboardConfig);
    }
    await KeyboardPreferences.setCurrentProfile(currentProfileId);
    setActiveKeyboardProfileId(currentProfileId);
    console.log(`✅ Set "${currentProfileId}" as active keyboard profile`);
  }, [currentProfileId]);

  const handleDuplicate = useCallback(async (newName: string) => {
    // Generate a unique ID for the new profile
    const newProfileId = `custom_${Date.now()}`;
    
    // Get current config
    let config: KeyboardConfig;
    const storedConfig = await KeyboardPreferences.getProfileObject(currentProfileId);
    if (storedConfig) {
      config = storedConfig as KeyboardConfig;
    } else {
      const builtInProfile = PROFILES[currentProfileId];
      if (builtInProfile) {
        config = buildConfiguration(builtInProfile);
      } else {
        config = buildConfiguration(PROFILES['default']);
      }
    }
    
    // Save the duplicated config
    await KeyboardPreferences.setProfileObject(config, newProfileId);
    
    // Copy style groups too
    try {
      const styleGroupsJson = await KeyboardPreferences.getProfile(`${currentProfileId}_styleGroups`);
      if (styleGroupsJson) {
        await KeyboardPreferences.setProfile(styleGroupsJson, `${newProfileId}_styleGroups`);
      }
    } catch { /* ignore */ }
    
    // Add to saved profiles list
    let savedList: { name: string; key: string }[] = [];
    try {
      const savedListJson = await KeyboardPreferences.getProfile('saved_list');
      if (savedListJson) {
        savedList = JSON.parse(savedListJson);
      }
    } catch { /* ignore */ }
    
    savedList.push({ name: newName, key: newProfileId });
    await KeyboardPreferences.setProfile(JSON.stringify(savedList), 'saved_list');
    
    // Switch to the new profile
    setCurrentProfileId(newProfileId);
    setProfileName(newName);
    
    console.log(`✅ Duplicated profile as "${newName}" (${newProfileId})`);
  }, [currentProfileId]);

  const handleDelete = useCallback(async () => {
    // Check if it's a built-in profile
    if (PROFILES[currentProfileId]) {
      throw new Error('Cannot delete built-in profile');
    }
    
    // Remove from saved profiles list
    let savedList: { name: string; key: string }[] = [];
    try {
      const savedListJson = await KeyboardPreferences.getProfile('saved_list');
      if (savedListJson) {
        savedList = JSON.parse(savedListJson);
      }
    } catch { /* ignore */ }
    
    savedList = savedList.filter(p => p.key !== currentProfileId);
    await KeyboardPreferences.setProfile(JSON.stringify(savedList), 'saved_list');
    
    // Note: We don't delete the actual config storage as it might be orphaned
    // The saved_list is the source of truth for what profiles exist
    
    console.log(`✅ Deleted profile "${currentProfileId}"`);
    
    // Switch to default profile
    const defaultConfig = buildConfiguration(PROFILES['default']);
    setCurrentProfileId('default');
    setProfileName('Default Profile');
    setInitialConfig(defaultConfig);
    setInitialStyleGroups([]);
  }, [currentProfileId]);

  const handleProfileChange = useCallback((newProfileId: string, newProfileName: string) => {
    setCurrentProfileId(newProfileId);
    setProfileName(newProfileName);
  }, []);

  const handleCreateNew = useCallback(async (name: string, languages: string[]) => {
    // Create a new profile definition
    const newProfileId = `custom_${Date.now()}`;
    
    const newProfile: ProfileDefinition = {
      id: newProfileId,
      name: name,
      version: '1.0.0',
      keyboards: languages,
      defaultKeyboard: languages[0],
      defaultKeyset: 'abc',
      backgroundColor: '#E0E0E0',
      systemRow: {
        enabled: true,
        keys: [
          { type: 'settings' },
          { type: 'backspace', width: 1.5 },
          { type: 'enter' },
          { type: 'close' },
        ],
      },
      groups: [
        {
          name: 'letters',
          items: [],
          template: {
            color: '#000000',
            bgColor: '#FFFFFF',
          },
        },
        {
          name: 'numbers',
          items: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
          template: {
            color: '#000000',
            bgColor: '#E8E8E8',
          },
        },
        {
          name: 'symbols',
          items: ['.', ',', '?', '!', "'", '"', '-', '/', ':', ';', '(', ')', '$', '&', '@'],
          template: {
            color: '#000000',
            bgColor: '#D0D0D0',
          },
        },
      ],
    };

    // Build the configuration from the profile
    const config = buildConfiguration(newProfile);

    // Save the profile definition
    await KeyboardPreferences.setProfileObject(config, newProfileId);

    // Add to saved profiles list
    let savedList: { name: string; key: string }[] = [];
    try {
      const savedListJson = await KeyboardPreferences.getProfile('saved_list');
      if (savedListJson) {
        savedList = JSON.parse(savedListJson);
      }
    } catch { /* ignore */ }

    savedList.push({ name, key: newProfileId });
    await KeyboardPreferences.setProfile(JSON.stringify(savedList), 'saved_list');

    // Switch to the new profile
    setCurrentProfileId(newProfileId);
    setProfileName(name);
    setInitialConfig(config);
    setInitialStyleGroups([]);

    console.log(`✅ Created new profile "${name}" with languages: ${languages.join(', ')}`);
  }, []);

  // Check if current profile is a custom (non-built-in) profile
  const isCustomProfile = !PROFILES[currentProfileId];

  if (loading || !initialConfig) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <EditorProvider initialConfig={initialConfig} initialStyleGroups={initialStyleGroups}>
      <EditorScreenInner 
        profileName={profileName}
        profileId={currentProfileId}
        isActiveProfile={currentProfileId === activeKeyboardProfileId}
        isCustomProfile={isCustomProfile}
        onBack={onBack}
        onSave={handleSave}
        onSetActive={handleSetActive}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onProfileChange={handleProfileChange}
        onCreateNew={handleCreateNew}
      />
    </EditorProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  saveButtonHeader: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 70,
    alignItems: 'center',
  },
  saveButtonHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    padding: 2,
  },
  modeButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 18,
  },
  modeButtonActive: {
    backgroundColor: '#2196F3',
  },
  modeButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  modeButtonTextActive: {
    color: '#FFF',
  },
  content: {
    flex: 1,
  },
  testArea: {
    backgroundColor: '#FFF',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  testInput: {
    height: 80,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
    textAlignVertical: 'top',
  },
  clearButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  clearButtonText: {
    fontSize: 14,
    color: '#2196F3',
  },
  canvasContainer: {
    // Canvas takes its natural height
  },
  toolboxContainer: {
    flex: 1,
    minHeight: 200,
  },
  toolboxExpanded: {
    flex: 1,
    minHeight: 300,
  },
  saveButtonDisabled: {
    backgroundColor: '#A5D6A7',
  },
  profileDropdownIcon: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePickerContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    width: '80%',
    maxHeight: '60%',
    padding: 16,
  },
  profilePickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  profileOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  profileOptionActive: {
    backgroundColor: '#E3F2FD',
  },
  profileOptionText: {
    fontSize: 16,
    color: '#333',
  },
  profileOptionCheck: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  toast: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: '#323232',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    zIndex: 1000,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  toastText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  // Action bar styles
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  actionButton: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  setActiveButton: {
    backgroundColor: '#FF9800',
  },
  duplicateButton: {
    backgroundColor: '#2196F3',
  },
  deleteButton: {
    backgroundColor: '#F44336',
    flex: 0,
    minWidth: 50,
  },
  activeBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFF',
  },
  // Duplicate modal styles
  duplicateModalContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    width: '80%',
    padding: 20,
  },
  duplicateModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  duplicateModalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  duplicateInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  duplicateModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  duplicateCancelButton: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  duplicateCancelText: {
    fontSize: 16,
    color: '#666',
  },
  duplicateConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  duplicateConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  // Add new profile button styles
  addNewProfileButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  addNewProfileButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EditorScreen;