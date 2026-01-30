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

// Import keyboard files
import enKeyboard from '../../keyboards/en.json';
import heKeyboard from '../../keyboards/he.json';
import heOrderedKeyboard from '../../keyboards/he_ordered.json';
import arKeyboard from '../../keyboards/ar.json';

// Note: Profile files removed - profiles are now created dynamically by users

// Language definitions
type LanguageId = 'he' | 'en' | 'ar';

interface LanguageDefinition {
  id: LanguageId;
  name: string;
  nativeName: string;
  keyboards: { id: string; name: string }[];
}

const LANGUAGES: LanguageDefinition[] = [
  {
    id: 'he',
    name: 'Hebrew',
    nativeName: 'עברית',
    keyboards: [
      { id: 'he', name: 'Standard' },
      { id: 'he_ordered', name: 'Ordered (א-ב)' },
    ],
  },
  {
    id: 'en',
    name: 'English',
    nativeName: 'English',
    keyboards: [
      { id: 'en', name: 'QWERTY' },
    ],
  },
  {
    id: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    keyboards: [
      { id: 'ar', name: 'Standard' },
    ],
  },
];

// Available keyboards by ID
const KEYBOARDS: Record<string, KeyboardDefinition> = {
  'en': enKeyboard,
  'he': heKeyboard,
  'he_ordered': heOrderedKeyboard,
  'ar': arKeyboard,
};

/**
 * Normalized profile definition - stored in preferences
 * Now tied to a single language and keyboard
 */
interface SavedProfileDefinition {
  id: string;
  name: string;
  version: string;
  language: LanguageId;  // Single language (he/en/ar)
  keyboardId: string;    // Single keyboard ID (he, he_ordered, en, ar)
  backgroundColor?: string;
  systemRow?: {
    enabled: boolean;
    keys: any[];
  };
  groups?: any[];
  diacritics?: Record<string, any>;
}

/**
 * Extract normalized profile definition from a full config
 */
const extractProfileDefinition = (
  config: KeyboardConfig,
  profileId: string,
  profileName: string,
  language: LanguageId,
  keyboardId: string
): SavedProfileDefinition => {
  return {
    id: profileId,
    name: profileName,
    version: '1.0.0',
    language,
    keyboardId,
    backgroundColor: config.backgroundColor,
    systemRow: extractSystemRow(config),
    groups: config.groups,
    diacritics: config.diacriticsSettings,
  };
};

/**
 * Extract system row configuration from config
 */
const extractSystemRow = (config: KeyboardConfig): { enabled: boolean; keys: any[] } | undefined => {
  if (config.keysets.length === 0) return undefined;
  
  const firstKeyset = config.keysets[0];
  if (firstKeyset.rows.length === 0) return undefined;
  
  const firstRow = firstKeyset.rows[0];
  const systemTypes = ['settings', 'backspace', 'enter', 'close', 'language', 'next-keyboard', 'nikkud'];
  
  const systemKeyCount = firstRow.keys.filter(k => systemTypes.includes(k.type?.toLowerCase() || '')).length;
  
  if (systemKeyCount >= firstRow.keys.length / 2) {
    return {
      enabled: true,
      keys: firstRow.keys,
    };
  }
  
  return undefined;
};

/**
 * Build configuration from profile definition (single keyboard)
 */
const buildConfiguration = (profile: SavedProfileDefinition): KeyboardConfig => {
  const keyboard = KEYBOARDS[profile.keyboardId];
  if (!keyboard) {
    throw new Error(`Keyboard "${profile.keyboardId}" not found`);
  }

  const config: KeyboardConfig = {
    backgroundColor: profile.backgroundColor || '#E0E0E0',
    defaultKeyset: 'abc',
    keysets: [],
    groups: profile.groups || [],
    keyboards: [profile.keyboardId],
    defaultKeyboard: profile.keyboardId,
    diacritics: undefined,
    allDiacritics: {},
    diacriticsSettings: profile.diacritics || {},
  };

  // Build keysets from the single keyboard
  const keysets = keyboard.keysets.map((keyset: any) => {
    const rows = [...keyset.rows];
    if (profile.systemRow?.enabled) {
      rows.unshift({ keys: profile.systemRow.keys });
    }
    return { ...keyset, rows };
  });

  if (keysets.length > 0) {
    config.defaultKeyset = keysets[0].id;
  }

  config.keysets = keysets;
  
  // Load diacritics from keyboard
  if ((keyboard as any).diacritics) {
    config.allDiacritics![profile.keyboardId] = (keyboard as any).diacritics;
    config.diacritics = (keyboard as any).diacritics;
  }

  return config;
};

interface EditorScreenInnerProps {
  profileName: string;
  profileId: string;
  language: LanguageId;
  keyboardId: string;
  isActiveProfile: boolean;
  isCustomProfile: boolean;
  onBack: () => void;
  onSave: (config: KeyboardConfig, styleGroups: any[]) => Promise<void>;
  onSetActive: () => Promise<void>;
  onDuplicate: (newName: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onProfileChange: (profileId: string, profileName: string, language: LanguageId, keyboardId: string) => void;
  onLanguageChange: (language: LanguageId) => void;
  onKeyboardChange: (keyboardId: string) => void;
  onCreateNew: (name: string, language: LanguageId, keyboardId: string) => Promise<void>;
}

// Helper: Get key value from keyId
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

// Convert StyleGroups to GroupConfig format
const convertStyleGroupsToGroupConfig = (
  styleGroups: { name: string; members: string[]; style: { hidden?: boolean; bgColor?: string; color?: string; label?: string } }[],
  config: KeyboardConfig
): { name: string; items: string[]; template: { color: string; bgColor: string; hidden?: boolean } }[] => {
  return styleGroups.map(group => {
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
  language: LanguageId;
  keyboardId: string;
  isBuiltIn: boolean;
}

const EditorScreenInner: React.FC<EditorScreenInnerProps> = ({ 
  profileName, 
  profileId,
  language,
  keyboardId,
  isActiveProfile,
  isCustomProfile,
  onBack,
  onSave,
  onSetActive,
  onDuplicate,
  onDelete,
  onProfileChange,
  onLanguageChange,
  onKeyboardChange,
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
  const [currentLanguage, setCurrentLanguage] = useState<LanguageId>(language);
  const [currentKeyboardId, setCurrentKeyboardId] = useState(keyboardId);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Get current language definition
  const currentLanguageDef = LANGUAGES.find(l => l.id === currentLanguage) || LANGUAGES[0];

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

  // Load available profiles for current language
  const loadProfilesList = useCallback(async () => {
    const profileList: ProfileOption[] = [];
    
    // Load saved custom profiles for this language
    try {
      const savedListJson = await KeyboardPreferences.getProfile('saved_list');
      if (savedListJson) {
        const savedList = JSON.parse(savedListJson);
        for (const saved of savedList) {
          // Only show profiles for current language
          if (saved.language === currentLanguage) {
            profileList.push({ 
              id: saved.key, 
              name: saved.name, 
              language: saved.language,
              keyboardId: saved.keyboardId,
              isBuiltIn: false 
            });
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load saved profiles:', e);
    }
    
    setProfiles(profileList);
  }, [currentLanguage]);

  // Load profiles when language changes
  useEffect(() => {
    loadProfilesList();
  }, [loadProfilesList, currentLanguage]);

  // Handle language change
  const handleLanguageChange = useCallback((newLanguage: LanguageId) => {
    setCurrentLanguage(newLanguage);
    onLanguageChange(newLanguage);
    
    // Switch to first keyboard of new language
    const langDef = LANGUAGES.find(l => l.id === newLanguage);
    if (langDef && langDef.keyboards.length > 0) {
      const firstKeyboard = langDef.keyboards[0].id;
      setCurrentKeyboardId(firstKeyboard);
      onKeyboardChange(firstKeyboard);
    }
  }, [onLanguageChange, onKeyboardChange]);

  // Handle keyboard change within same language
  const handleKeyboardChange = useCallback((newKeyboardId: string) => {
    setCurrentKeyboardId(newKeyboardId);
    onKeyboardChange(newKeyboardId);
  }, [onKeyboardChange]);

  const handleLoadProfile = useCallback(async (profile: ProfileOption) => {
    setShowProfilePicker(false);
    
    try {
      // Load normalized profile definition
      const profileDefJson = await KeyboardPreferences.getProfile(`profile_def_${profile.id}`);
      
      if (profileDefJson) {
        const profileDef = JSON.parse(profileDefJson) as SavedProfileDefinition;
        const config = buildConfiguration(profileDef);
        
        // Load style groups
        let loadedStyleGroups: any[] = [];
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
        setCurrentLanguage(profile.language);
        setCurrentKeyboardId(profile.keyboardId);
        onProfileChange(profile.id, profile.name, profile.language, profile.keyboardId);
        
        console.log(`✅ Switched to profile "${profile.name}"`);
      } else {
        throw new Error('Profile not found');
      }
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

  const handleClearConfig = useCallback(async () => {
    Alert.alert(
      'Clear All Settings',
      'This will clear all keyboard settings and profiles. The keyboard will use its bundled default config.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await KeyboardPreferences.clearAll();
              if (result.success) {
                showToast('✓ All settings cleared');
              } else {
                showToast('✗ Failed to clear settings');
              }
            } catch (error) {
              showToast('✗ Failed to clear settings');
            }
          }
        },
      ]
    );
  }, [showToast]);

  const handleDelete = useCallback(async () => {
    if (!isCustomProfile) {
      Alert.alert('Cannot Delete', 'Built-in profiles cannot be deleted.');
      return;
    }
    
    if (isActiveProfile) {
      Alert.alert('Cannot Delete', 'Cannot delete the active profile.');
      return;
    }
    
    Alert.alert(
      'Delete Profile',
      `Are you sure you want to delete "${currentProfileName}"?`,
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
      setCurrentProfileName(duplicateName.trim());
      showToast(`✓ Created "${duplicateName.trim()}"`);
      await loadProfilesList();
      setDuplicateName('');
    } catch (error) {
      showToast('✗ Failed to duplicate profile');
    }
  }, [duplicateName, onDuplicate, showToast, loadProfilesList]);

  const handleCreateNewProfile = useCallback(async (name: string, lang: LanguageId, kbId: string) => {
    setShowAddProfileModal(false);
    setShowProfilePicker(false);
    
    try {
      await onCreateNew(name, lang, kbId);
      showToast(`✓ Created "${name}"`);
      await loadProfilesList();
    } catch (error) {
      showToast('✗ Failed to create profile');
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
      const groupConfigs = convertStyleGroupsToGroupConfig(state.styleGroups, state.config);
      
      const configToSave: KeyboardConfig = {
        ...state.config,
        groups: groupConfigs,
      };
      
      await onSave(configToSave, state.styleGroups);
      showToast('✓ Saved successfully');
    } catch (error) {
      showToast('✗ Failed to save configuration');
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
        onCreate={(name, lang, kbId) => handleCreateNewProfile(name, lang as LanguageId, kbId)}
        initialLanguage={currentLanguage}
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
            <Text style={styles.profilePickerTitle}>
              {currentLanguageDef.nativeName} Profiles
            </Text>
            
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
            
            {profiles.length === 0 ? (
              <Text style={styles.noProfilesText}>
                No saved profiles for {currentLanguageDef.name}.
                {'\n'}Create one to customize your keyboard.
              </Text>
            ) : (
              <FlatList
                data={profiles}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.profileOption,
                      item.id === currentProfileId && styles.profileOptionActive,
                    ]}
                    onPress={() => handleLoadProfile(item)}
                  >
                    <Text style={styles.profileOptionText}>
                      💾 {item.name}
                    </Text>
                    {item.id === currentProfileId && (
                      <Text style={styles.profileOptionCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Language Selector */}
      <View style={styles.languageBar}>
        {LANGUAGES.map(lang => (
          <TouchableOpacity
            key={lang.id}
            style={[
              styles.languageTab,
              currentLanguage === lang.id && styles.languageTabActive,
            ]}
            onPress={() => handleLanguageChange(lang.id)}
          >
            <Text style={[
              styles.languageTabText,
              currentLanguage === lang.id && styles.languageTabTextActive,
            ]}>
              {lang.nativeName}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Keyboard Selector (within selected language) */}
      {currentLanguageDef.keyboards.length > 1 && (
        <View style={styles.keyboardBar}>
          {currentLanguageDef.keyboards.map(kb => (
            <TouchableOpacity
              key={kb.id}
              style={[
                styles.keyboardTab,
                currentKeyboardId === kb.id && styles.keyboardTabActive,
              ]}
              onPress={() => handleKeyboardChange(kb.id)}
            >
              <Text style={[
                styles.keyboardTabText,
                currentKeyboardId === kb.id && styles.keyboardTabTextActive,
              ]}>
                {kb.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Header Row: Profile & Mode Toggle */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.headerCenter}
          onPress={() => setShowProfilePicker(true)}
        >
          <Text style={styles.profileName} numberOfLines={1}>
            {currentProfileName || 'Default'}
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

      {/* Action Bar */}
      <View style={styles.actionBar}>
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

        <TouchableOpacity
          style={[styles.actionButton, styles.duplicateButton]}
          onPress={() => {
            setDuplicateName(`${currentProfileName} Copy`);
            setShowDuplicateModal(true);
          }}
        >
          <Text style={styles.actionButtonText}>📋 Copy</Text>
        </TouchableOpacity>

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

        <TouchableOpacity
          style={[styles.actionButton, styles.clearConfigButton]}
          onPress={handleClearConfig}
        >
          <Text style={styles.actionButtonText}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <KeyboardAvoidingView 
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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

        {!(keyboardVisible && state.selectedKeys.length > 0) && (
          <View style={styles.canvasContainer}>
            <InteractiveCanvas onTestInput={handleTestInput} />
          </View>
        )}

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
  const [profileName, setProfileName] = useState('Default');
  const [currentProfileId, setCurrentProfileId] = useState<string>('');
  const [currentLanguage, setCurrentLanguage] = useState<LanguageId>('he');
  const [currentKeyboardId, setCurrentKeyboardId] = useState<string>('he');
  const [activeKeyboardProfileId, setActiveKeyboardProfileId] = useState<string>('');

  useEffect(() => {
    const loadInitial = async () => {
      try {
        // Get current language from preferences
        let savedLanguage: LanguageId = 'he';
        try {
          const langPref = await KeyboardPreferences.getProfile('current_language');
          if (langPref && ['he', 'en', 'ar'].includes(langPref)) {
            savedLanguage = langPref as LanguageId;
          }
        } catch { /* use default */ }
        
        setCurrentLanguage(savedLanguage);
        
        // Get the first keyboard for this language
        const langDef = LANGUAGES.find(l => l.id === savedLanguage) || LANGUAGES[0];
        const defaultKeyboardId = langDef.keyboards[0].id;
        setCurrentKeyboardId(defaultKeyboardId);
        
        // Get active profile
        const activeProfile = await KeyboardPreferences.getCurrentProfile();
        setActiveKeyboardProfileId(activeProfile || '');
        
        // Build default config from the keyboard
        const defaultProfileDef: SavedProfileDefinition = {
          id: '',
          name: 'Default',
          version: '1.0.0',
          language: savedLanguage,
          keyboardId: defaultKeyboardId,
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
          groups: [],
        };
        
        const config = buildConfiguration(defaultProfileDef);
        setInitialConfig(config);
        setProfileName('Default');
        
      } catch (error) {
        console.error('Failed to load initial state:', error);
        // Fallback
        const fallbackDef: SavedProfileDefinition = {
          id: '',
          name: 'Default',
          version: '1.0.0',
          language: 'he',
          keyboardId: 'he',
          backgroundColor: '#E0E0E0',
        };
        setInitialConfig(buildConfiguration(fallbackDef));
      } finally {
        setLoading(false);
      }
    };

    loadInitial();
  }, [propProfileId]);

  const handleSave = useCallback(async (config: KeyboardConfig, styleGroups: any[]) => {
    if (!currentProfileId) {
      // No profile selected - prompt to create one
      Alert.alert(
        'Save Profile',
        'Create a new profile to save your customizations.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    const profileDef = extractProfileDefinition(
      config, currentProfileId, profileName, currentLanguage, currentKeyboardId
    );
    
    await KeyboardPreferences.setProfile(
      JSON.stringify(profileDef),
      `profile_def_${currentProfileId}`
    );
    
    await KeyboardPreferences.setProfile(
      JSON.stringify(styleGroups),
      `${currentProfileId}_styleGroups`
    );
    
    if (currentProfileId === activeKeyboardProfileId) {
      await KeyboardPreferences.setKeyboardConfigObject(config);
    }
    
    console.log(`✅ Saved profile "${profileName}"`);
  }, [currentProfileId, activeKeyboardProfileId, profileName, currentLanguage, currentKeyboardId]);

  const handleSetActive = useCallback(async () => {
    if (currentProfileId) {
      const profileDefJson = await KeyboardPreferences.getProfile(`profile_def_${currentProfileId}`);
      if (profileDefJson) {
        const profileDef = JSON.parse(profileDefJson) as SavedProfileDefinition;
        const config = buildConfiguration(profileDef);
        await KeyboardPreferences.setKeyboardConfigObject(config);
      }
      await KeyboardPreferences.setCurrentProfile(currentProfileId);
      setActiveKeyboardProfileId(currentProfileId);
    }
  }, [currentProfileId]);

  const handleDuplicate = useCallback(async (newName: string) => {
    const newProfileId = `custom_${Date.now()}`;
    
    const profileDef: SavedProfileDefinition = {
      id: newProfileId,
      name: newName,
      version: '1.0.0',
      language: currentLanguage,
      keyboardId: currentKeyboardId,
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
      groups: [],
    };
    
    await KeyboardPreferences.setProfile(
      JSON.stringify(profileDef),
      `profile_def_${newProfileId}`
    );
    
    // Copy style groups if current profile exists
    if (currentProfileId) {
      try {
        const styleGroupsJson = await KeyboardPreferences.getProfile(`${currentProfileId}_styleGroups`);
        if (styleGroupsJson) {
          await KeyboardPreferences.setProfile(styleGroupsJson, `${newProfileId}_styleGroups`);
        }
      } catch { /* ignore */ }
    }
    
    // Add to saved list
    let savedList: { name: string; key: string; language: string; keyboardId: string }[] = [];
    try {
      const savedListJson = await KeyboardPreferences.getProfile('saved_list');
      if (savedListJson) {
        savedList = JSON.parse(savedListJson);
      }
    } catch { /* ignore */ }
    
    savedList.push({ 
      name: newName, 
      key: newProfileId, 
      language: currentLanguage, 
      keyboardId: currentKeyboardId 
    });
    await KeyboardPreferences.setProfile(JSON.stringify(savedList), 'saved_list');
    
    setCurrentProfileId(newProfileId);
    setProfileName(newName);
    
    const config = buildConfiguration(profileDef);
    setInitialConfig(config);
  }, [currentProfileId, currentLanguage, currentKeyboardId]);

  const handleDelete = useCallback(async () => {
    if (!currentProfileId) return;
    
    let savedList: { name: string; key: string; language: string; keyboardId: string }[] = [];
    try {
      const savedListJson = await KeyboardPreferences.getProfile('saved_list');
      if (savedListJson) {
        savedList = JSON.parse(savedListJson);
      }
    } catch { /* ignore */ }
    
    savedList = savedList.filter(p => p.key !== currentProfileId);
    await KeyboardPreferences.setProfile(JSON.stringify(savedList), 'saved_list');
    
    // Reset to default
    setCurrentProfileId('');
    setProfileName('Default');
    
    const defaultProfileDef: SavedProfileDefinition = {
      id: '',
      name: 'Default',
      version: '1.0.0',
      language: currentLanguage,
      keyboardId: currentKeyboardId,
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
      groups: [],
    };
    setInitialConfig(buildConfiguration(defaultProfileDef));
    setInitialStyleGroups([]);
  }, [currentProfileId, currentLanguage, currentKeyboardId]);

  const handleProfileChange = useCallback((newProfileId: string, newProfileName: string, newLanguage: LanguageId, newKeyboardId: string) => {
    setCurrentProfileId(newProfileId);
    setProfileName(newProfileName);
    setCurrentLanguage(newLanguage);
    setCurrentKeyboardId(newKeyboardId);
  }, []);

  const handleLanguageChange = useCallback(async (newLanguage: LanguageId) => {
    setCurrentLanguage(newLanguage);
    await KeyboardPreferences.setProfile(newLanguage, 'current_language');
    
    // Get first keyboard for this language
    const langDef = LANGUAGES.find(l => l.id === newLanguage) || LANGUAGES[0];
    const newKeyboardId = langDef.keyboards[0].id;
    setCurrentKeyboardId(newKeyboardId);
    
    // Reset to default for this language/keyboard
    setCurrentProfileId('');
    setProfileName('Default');
    
    const profileDef: SavedProfileDefinition = {
      id: '',
      name: 'Default',
      version: '1.0.0',
      language: newLanguage,
      keyboardId: newKeyboardId,
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
      groups: [],
    };
    setInitialConfig(buildConfiguration(profileDef));
    setInitialStyleGroups([]);
  }, []);

  const handleKeyboardChange = useCallback((newKeyboardId: string) => {
    setCurrentKeyboardId(newKeyboardId);
    
    // Reset to default with new keyboard
    setCurrentProfileId('');
    setProfileName('Default');
    
    const profileDef: SavedProfileDefinition = {
      id: '',
      name: 'Default',
      version: '1.0.0',
      language: currentLanguage,
      keyboardId: newKeyboardId,
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
      groups: [],
    };
    setInitialConfig(buildConfiguration(profileDef));
    setInitialStyleGroups([]);
  }, [currentLanguage]);

  const handleCreateNew = useCallback(async (name: string, language: LanguageId, keyboardId: string) => {
    const newProfileId = `custom_${Date.now()}`;
    
    const profileDef: SavedProfileDefinition = {
      id: newProfileId,
      name: name,
      version: '1.0.0',
      language,
      keyboardId,
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
      groups: [],
    };

    await KeyboardPreferences.setProfile(
      JSON.stringify(profileDef),
      `profile_def_${newProfileId}`
    );

    let savedList: { name: string; key: string; language: string; keyboardId: string }[] = [];
    try {
      const savedListJson = await KeyboardPreferences.getProfile('saved_list');
      if (savedListJson) {
        savedList = JSON.parse(savedListJson);
      }
    } catch { /* ignore */ }

    savedList.push({ name, key: newProfileId, language, keyboardId });
    await KeyboardPreferences.setProfile(JSON.stringify(savedList), 'saved_list');

    const config = buildConfiguration(profileDef);
    
    setCurrentProfileId(newProfileId);
    setProfileName(name);
    setCurrentLanguage(language);
    setCurrentKeyboardId(keyboardId);
    setInitialConfig(config);
    setInitialStyleGroups([]);
  }, []);

  const isCustomProfile = currentProfileId !== '';

  if (loading || !initialConfig) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <EditorProvider initialConfig={initialConfig} initialStyleGroups={initialStyleGroups}>
      <EditorScreenInner 
        profileName={profileName}
        profileId={currentProfileId}
        language={currentLanguage}
        keyboardId={currentKeyboardId}
        isActiveProfile={currentProfileId === activeKeyboardProfileId && currentProfileId !== ''}
        isCustomProfile={isCustomProfile}
        onBack={onBack}
        onSave={handleSave}
        onSetActive={handleSetActive}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onProfileChange={handleProfileChange}
        onLanguageChange={handleLanguageChange}
        onKeyboardChange={handleKeyboardChange}
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
  // Language bar
  languageBar: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
  },
  languageTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  languageTabActive: {
    backgroundColor: '#1976D2',
    borderBottomWidth: 3,
    borderBottomColor: '#FFF',
  },
  languageTabText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  languageTabTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  // Keyboard bar (secondary selector)
  keyboardBar: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
  },
  keyboardTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 16,
  },
  keyboardTabActive: {
    backgroundColor: '#2196F3',
  },
  keyboardTabText: {
    fontSize: 14,
    color: '#1976D2',
  },
  keyboardTabTextActive: {
    color: '#FFF',
    fontWeight: '600',
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
  canvasContainer: {},
  toolboxContainer: {
    flex: 1,
    minHeight: 200,
  },
  toolboxExpanded: {
    flex: 1,
    minHeight: 300,
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
  noProfilesText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingVertical: 20,
    lineHeight: 20,
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
  clearConfigButton: {
    backgroundColor: '#9E9E9E',
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