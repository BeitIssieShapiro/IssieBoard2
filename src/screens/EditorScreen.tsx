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
  Dimensions,
  useWindowDimensions,
  AppState,
} from 'react-native';
import { EditorProvider, useEditor } from '../context/EditorContext';
import { InteractiveCanvas } from '../components/canvas/InteractiveCanvas';
import { Toolbox } from '../components/toolbox/Toolbox';
import KeyboardPreferences from '../native/KeyboardPreferences';
import { KeyboardConfig, ProfileDefinition, KeyboardDefinition, VisibilityMode } from '../../types';
import AddProfileModal from '../../components/AddProfileModal';
import SaveAsModal from '../../components/SaveAsModal';
import { ActionButton } from '../components/shared/ActionButton';

// Import keyboard files
import enKeyboard from '../../keyboards/en.json';
import heKeyboard from '../../keyboards/he.json';
import heOrderedKeyboard from '../../keyboards/he_ordered.json';
import arKeyboard from '../../keyboards/ar.json';

// Import keyboard config merger utilities
import { buildKeyboardConfig, SourceKeyboard, mergeCommonKeysets, getCommonKeysets } from '../utils/keyboardConfigMerger';

// Import built-in profile templates
import {
  BUILT_IN_PROFILES,
  getBuiltInProfileTemplate,
  extractTemplateId,
  isBuiltInProfileId
} from '../data/builtInProfiles';

// ============================================
// FACTORY DEFAULT CONFIGURATION
// ============================================
// Default key height for factory-default profiles (set to null to use device defaults: 54pt iPhone, 74pt iPad)
// This value is used when creating new profiles or loading factory defaults
const FACTORY_DEFAULT_KEY_HEIGHT: number | null = 90;  // Change this to test different heights
// Default font size for factory-default profiles (set to null to use system default)
const FACTORY_DEFAULT_FONT_SIZE: number | null = 48;  // Change this to test different font sizes
// ============================================

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
 * Get the default profile ID for a language
 */
const getDefaultProfileId = (language: LanguageId): string => `${language}-default`;

/**
 * Create a factory-default profile definition
 */
const createFactoryDefaultProfile = (
  profileId: string,
  profileName: string,
  language: LanguageId,
  keyboardId: string
): SavedProfileDefinition => {
  const profile: SavedProfileDefinition = {
    id: profileId,
    name: profileName,
    version: '1.0.0',
    language,
    keyboardId,
    backgroundColor: 'default',
    groups: [],
  };

  // Add keyHeight if configured
  if (FACTORY_DEFAULT_KEY_HEIGHT !== null) {
    profile.keyHeight = FACTORY_DEFAULT_KEY_HEIGHT;
  }

  // Add fontSize if configured
  if (FACTORY_DEFAULT_FONT_SIZE !== null) {
    profile.fontSize = FACTORY_DEFAULT_FONT_SIZE;
  }

  return profile;
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
  keysBgColor?: string;  // Default background color for keys
  textColor?: string;    // Default text color for keys
  groups?: any[];
  diacritics?: Record<string, any>;
  wordSuggestionsEnabled?: boolean;
  autoCorrectEnabled?: boolean;
  fontName?: string;
  fontSize?: number;
  fontWeight?: 'ultraLight' | 'thin' | 'light' | 'regular' | 'medium' | 'semibold' | 'bold' | 'heavy' | 'black';
  keyGap?: number;
  keyHeight?: number;
  settingsButtonEnabled?: boolean;
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
    keysBgColor: (config as any).keysBgColor,
    textColor: (config as any).textColor,
    groups: config.groups,
    diacritics: config.diacriticsSettings,
    wordSuggestionsEnabled: config.wordSuggestionsEnabled,
    autoCorrectEnabled: config.autoCorrectEnabled,
    fontName: config.fontName,
    fontSize: config.fontSize,
    fontWeight: config.fontWeight,
    keyGap: config.keyGap,
    keyHeight: config.keyHeight,
    settingsButtonEnabled: config.settingsButtonEnabled,
  };
};

/**
 * Build configuration from profile definition (single keyboard)
 * Uses the shared keyboardConfigMerger to include common keysets (123, #+=)
 */
const buildConfiguration = (profile: SavedProfileDefinition): KeyboardConfig => {
  const keyboard = KEYBOARDS[profile.keyboardId];
  if (!keyboard) {
    throw new Error(`Keyboard "${profile.keyboardId}" not found`);
  }

  // Use 'default' for empty/undefined background color to trigger transparent/liquid glass effect
  const bgColor = profile.backgroundColor !== undefined ? profile.backgroundColor : 'default';

  // Use the shared config builder to merge common keysets
  const baseConfig = buildKeyboardConfig(keyboard as SourceKeyboard, profile.language);

  // Apply default simpleMode: true for all keyboards with diacritics
  const diacriticsSettings: Record<string, any> = {};
  if (profile.diacritics) {
    // Use existing settings from profile
    for (const [keyboardId, settings] of Object.entries(profile.diacritics)) {
      diacriticsSettings[keyboardId] = {
        ...settings,
        simpleMode: settings.simpleMode ?? true, // Default to simple mode
      };
    }
  }
  // If no settings exist yet but keyboard has diacritics, create default with simpleMode: true
  if ((keyboard as any).diacritics && !diacriticsSettings[profile.keyboardId]) {
    diacriticsSettings[profile.keyboardId] = {
      simpleMode: true,
    };
  }

  const config: KeyboardConfig = {
    ...baseConfig,
    backgroundColor: bgColor || 'default',
    groups: profile.groups || [],
    keyboards: [profile.keyboardId],
    defaultKeyboard: profile.keyboardId,
    allDiacritics: {},
    diacriticsSettings,
    wordSuggestionsEnabled: profile.wordSuggestionsEnabled,
    autoCorrectEnabled: profile.autoCorrectEnabled,
    fontName: profile.fontName,
    fontSize: profile.fontSize,
    fontWeight: profile.fontWeight,
    keyGap: profile.keyGap,
    keyHeight: profile.keyHeight && profile.keyHeight > 0 ? profile.keyHeight : undefined, // Ensure valid keyHeight or undefined for auto
    settingsButtonEnabled: profile.settingsButtonEnabled,
  } as KeyboardConfig;

  // Apply keysBgColor and textColor if they exist in the profile
  if (profile.keysBgColor !== undefined) {
    (config as any).keysBgColor = profile.keysBgColor;
  }
  if (profile.textColor !== undefined) {
    (config as any).textColor = profile.textColor;
  }

  // Load diacritics from keyboard
  if ((keyboard as any).diacritics) {
    config.allDiacritics![profile.keyboardId] = (keyboard as any).diacritics;
    config.diacritics = (keyboard as any).diacritics;
  }

  return config;
};

/**
 * Try to load a profile by ID
 * Returns the profile definition and style groups if found, null otherwise
 */
const loadProfileById = async (profileId: string): Promise<{
  profileDef: SavedProfileDefinition;
  styleGroups: any[];
} | null> => {
  try {
    const profileDefJson = await KeyboardPreferences.getProfile(`profile_def_${profileId}`);
    if (!profileDefJson) return null;

    const profileDef = JSON.parse(profileDefJson) as SavedProfileDefinition;

    // Load style groups
    let styleGroups: any[] = [];
    try {
      const styleGroupsJson = await KeyboardPreferences.getProfile(`${profileId}_styleGroups`);
      if (styleGroupsJson) {
        styleGroups = JSON.parse(styleGroupsJson);
      }
    } catch { /* ignore */ }

    return { profileDef, styleGroups };
  } catch {
    return null;
  }
};

type AppContext = 'issieboard' | 'issievoice';

/**
 * Get the active profile key for a given language and app context
 * Separate current profiles for each app: active_profile_issieboard_<lang> and active_profile_issievoice_<lang>
 */
const getActiveProfileKey = (language: LanguageId, appContext: AppContext = 'issieboard'): string => {
  return `active_profile_${appContext}_${language}`;
};

/**
 * Get the keyboard config key for a given language and app context
 * IssieBoard saves to keyboardConfig_<lang> (used by native keyboard extensions)
 * IssieVoice saves to keyboardConfig_issievoice_<lang> (used by in-app KeyboardPreview)
 */
const getKeyboardConfigKey = (language: LanguageId, appContext: AppContext = 'issieboard'): string => {
  if (appContext === 'issieboard') {
    // IssieBoard uses language-only keys that native keyboards read
    return `keyboardConfig_${language}`;
  } else {
    // IssieVoice uses app-specific keys for in-app preview
    return `keyboardConfig_issievoice_${language}`;
  }
};

/**
 * Save keyboard config for the app context
 * For IssieBoard: saves to keyboardConfig_<lang> (for native keyboards)
 * For IssieVoice: saves to keyboardConfig_issievoice_<lang> (for KeyboardPreview)
 */
const saveKeyboardConfig = async (config: any, language: LanguageId, appContext: AppContext = 'issieboard'): Promise<void> => {
  const configJSON = JSON.stringify(config);

  console.log(`📱 saveKeyboardConfig: language=${language}, appContext=${appContext}`);
  console.log(`📱 Config properties:`, {
    fontSize: config.fontSize,
    fontWeight: config.fontWeight,
    backgroundColor: config.backgroundColor,
    keysBgColor: config.keysBgColor,
    textColor: config.textColor,
    hasGroups: !!config.groups,
    groupCount: config.groups?.length || 0,
    groups: config.groups,
  });

  // Debug: log first group if exists
  if (config.groups && config.groups.length > 0) {
    console.log(`📱 First group sample:`, {
      items: config.groups[0].items?.slice(0, 5),
      template: config.groups[0].template
    });
  }

  // Determine the correct key for storage
  // IssieBoard: keyboardConfig_<lang> (e.g., keyboardConfig_he)
  // IssieVoice: keyboardConfig_issievoice_<lang> (e.g., keyboardConfig_issievoice_he)
  const keyboardId = appContext === 'issieboard' ? language : `${appContext}_${language}`;

  // Use platform-agnostic KeyboardPreferences API
  const result = await KeyboardPreferences.setKeyboardConfigForLanguage(configJSON, keyboardId);

  if (result.success) {
    console.log(`✅ Saved keyboard config to keyboardConfig_${keyboardId}, length: ${configJSON.length}`);
  } else {
    console.error(`❌ Failed to save keyboard config`, result.error);
  }
};

interface EditorScreenInnerProps {
  profileName: string;
  profileId: string;
  language: LanguageId;
  keyboardId: string;
  appContext?: AppContext;  // Which app is using the settings
  onClose?: () => void;      // Close callback for IssieVoice
  isActiveProfile: boolean;
  onSave: (config: KeyboardConfig, styleGroups: any[]) => Promise<void>;
  onSetActive: () => Promise<void>;
  onDuplicate: (newName: string) => Promise<{ newProfileId: string; newConfig: KeyboardConfig; styleGroups: any[] }>;
  onDelete: (profileId: string, profileName: string) => Promise<void>;
  onSetActiveForProfile: (profileId: string) => Promise<void>;
  activeKeyboardProfileId: string;
  onProfileChange: (profileId: string, profileName: string, language: LanguageId, keyboardId: string) => void;
  onLanguageChange: (language: LanguageId) => void;
  onKeyboardChange: (keyboardId: string) => void;
  onCreateNew: (name: string, language: LanguageId, keyboardId: string) => Promise<void>;
}

// Convert StyleGroups to GroupConfig format
// StyleGroup.members now stores key values directly (e.g., ["א", "ב"]) not position IDs
// Only include active groups in the output config
const convertStyleGroupsToGroupConfig = (
  styleGroups: { name: string; members: string[]; style: { hidden?: boolean; visibilityMode?: VisibilityMode; bgColor?: string; color?: string; label?: string }; active?: boolean }[]
): { name: string; items: string[]; template: { color: string; bgColor: string; hidden?: boolean; visibilityMode?: VisibilityMode } }[] => {
  return styleGroups
    .filter(group => group.active !== false) // Only include active groups
    .map(group => ({
      name: group.name,
      items: group.members, // Already key values, no conversion needed
      template: {
        color: group.style.color || '',
        bgColor: group.style.bgColor || '',
        // Support both legacy hidden boolean and new visibilityMode
        hidden: group.style.hidden || group.style.visibilityMode === 'hide',
        visibilityMode: group.style.visibilityMode,
      },
    }));
};

interface ProfileOption {
  id: string;
  name: string;
  language: LanguageId;
  keyboardId: string;
  isBuiltIn: boolean; // Built-in profiles are read-only and require "Save As"
  isSystemActive?: boolean; // Whether this profile is active in the keyboard system
}

const EditorScreenInner: React.FC<EditorScreenInnerProps> = ({
  profileName,
  profileId,
  language,
  keyboardId,
  appContext = 'issieboard',  // Default to IssieBoard if not specified
  onClose,
  isActiveProfile,
  onSave,
  onSetActive,
  onDuplicate,
  onDelete,
  onSetActiveForProfile,
  activeKeyboardProfileId,
  onProfileChange,
  onLanguageChange,
  onKeyboardChange,
  onCreateNew,
}) => {
  const { state, setMode, setConfig, markDirty, dispatch } = useEditor();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [testText, setTestText] = useState('');
  const [saving, setSaving] = useState(false);
  const [settingActive, setSettingActive] = useState(false);
  const [showProfilePicker, setShowProfilePicker] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [duplicateName, setDuplicateName] = useState('');
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [showAddProfileModal, setShowAddProfileModal] = useState(false);
  const [currentProfileName, setCurrentProfileName] = useState(profileName);
  const [currentProfileId, setCurrentProfileId] = useState(profileId);
  const [currentLanguage, setCurrentLanguage] = useState<LanguageId>(language);
  const [currentKeyboardId, setCurrentKeyboardId] = useState(keyboardId);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Secret 5-tap reset feature
  const [tapCount, setTapCount] = useState(0);
  const [tapTimeout, setTapTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Sync current profile ID with prop (for when parent creates new profile)
  useEffect(() => {
    if (profileId !== currentProfileId) {
      setCurrentProfileId(profileId);
    }
  }, [profileId]);

  // Sync current profile name with prop
  useEffect(() => {
    if (profileName !== currentProfileName) {
      setCurrentProfileName(profileName);
    }
  }, [profileName]);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const saveButtonOpacity = useRef(new Animated.Value(1)).current;

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

  // Cleanup tap timeout on unmount
  useEffect(() => {
    return () => {
      if (tapTimeout) {
        clearTimeout(tapTimeout);
      }
    };
  }, [tapTimeout]);

  const showToast = useCallback((message: string, duration: number = 3000) => {
    setToastMessage(message);

    // Animate from bottom
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 300,
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

  // Blink save button when dirty
  useEffect(() => {
    if (state.isDirty) {
      const blink = Animated.loop(
        Animated.sequence([
          Animated.timing(saveButtonOpacity, {
            toValue: 0.4,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(saveButtonOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      blink.start();
      return () => blink.stop();
    } else {
      saveButtonOpacity.setValue(1);
    }
  }, [state.isDirty, saveButtonOpacity]);

  // Load available profiles for current language
  const loadProfilesList = useCallback(async () => {
    const profileList: ProfileOption[] = [];

    // Get which profile is actually active in the keyboard system for this language
    const systemActiveProfileId = activeKeyboardProfileId;
    const langDef = LANGUAGES.find(l => l.id === currentLanguage);
    const firstKeyboardId = langDef?.keyboards[0]?.id || currentLanguage;

    // Add all built-in profiles (Default, Classic, High Contrast)
    // Loop over templates instead of hardcoding each one
    for (const template of BUILT_IN_PROFILES) {
      const profileId = `${currentLanguage}-${template.id}`;
      profileList.push({
        id: profileId,
        name: template.name,
        language: currentLanguage,
        keyboardId: firstKeyboardId,
        isBuiltIn: true,
        isSystemActive: profileId === systemActiveProfileId,
      });
    }

    // Load saved custom profiles for this language
    try {
      const savedListJson = await KeyboardPreferences.getProfile('saved_list');
      if (savedListJson) {
        const savedList = JSON.parse(savedListJson);
        for (const saved of savedList) {
          // Only show profiles for current language, and skip built-in profiles
          if (saved.language === currentLanguage && !isBuiltInProfileId(saved.key)) {
            profileList.push({
              id: saved.key,
              name: saved.name,
              language: saved.language,
              keyboardId: saved.keyboardId,
              isBuiltIn: false,
              isSystemActive: saved.key === systemActiveProfileId,
            });
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load saved profiles:', e);
    }

    setProfiles(profileList);
  }, [currentLanguage, activeKeyboardProfileId]);

  // Load profiles when language changes
  useEffect(() => {
    loadProfilesList();
  }, [loadProfilesList, currentLanguage]);

  // Secret feature: tap 5 times on title to reset to factory defaults
  const handleTitleTap = useCallback(() => {
    // Clear existing timeout
    if (tapTimeout) {
      clearTimeout(tapTimeout);
    }

    // Use functional update to get current tap count
    setTapCount((prevCount) => {
      const newTapCount = prevCount + 1;

      if (newTapCount >= 5) {
        // Reset tap count
        setTapCount(0);

        // Show confirmation dialog
        Alert.alert(
          'Reset to Factory Defaults',
          'This will clear all keyboard settings and profiles. Are you sure?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Reset',
              style: 'destructive',
              onPress: async () => {
                try {
                  const result = await KeyboardPreferences.clearAll();
                  if (result.success) {
                    showToast('✓ Reset to factory defaults');
                    // Reload to factory defaults
                    const defaultKeyboardId = currentLanguageDef.keyboards[0].id;
                    const profileDef = createFactoryDefaultProfile(
                      currentProfileId,
                      currentProfileName,
                      currentLanguage,
                      defaultKeyboardId
                    );
                    const config = buildConfiguration(profileDef);
                    setConfig(config, []);
                    // Reload profiles list
                    await loadProfilesList();
                  } else {
                    showToast('✗ Failed to reset');
                  }
                } catch (e) {
                  console.error('Reset error:', e);
                  showToast('✗ Failed to reset');
                }
              },
            },
          ]
        );

        return 0; // Return 0 to reset count
      } else {
        // Set timeout to reset tap count after 2 seconds
        const timeout = setTimeout(() => {
          setTapCount(0);
        }, 2000);
        setTapTimeout(timeout);

        return newTapCount; // Return incremented count
      }
    });
  }, [tapTimeout, currentLanguageDef, currentProfileId, currentProfileName, currentLanguage, setConfig, showToast, loadProfilesList]);

  // Handle language change - try to load the ACTIVE profile for that language
  const handleLanguageChange = useCallback(async (newLanguage: LanguageId) => {
    console.log(`📱 handleLanguageChange: switching to ${newLanguage} (appContext: ${appContext})`);
    setCurrentLanguage(newLanguage);

    // Get first keyboard for this language
    const langDef = LANGUAGES.find(l => l.id === newLanguage);
    const firstKeyboardId = langDef?.keyboards[0]?.id || newLanguage;
    const defaultProfileId = getDefaultProfileId(newLanguage);

    // Check what's the active profile for this language and app context
    const activeProfileKey = getActiveProfileKey(newLanguage, appContext);
    const activeProfileId = await KeyboardPreferences.getProfile(activeProfileKey);
    const effectiveActiveProfile = activeProfileId || defaultProfileId;
    console.log(`📱 Active profile for ${newLanguage} (${appContext}): ${effectiveActiveProfile}`);

    // Try to load the active profile
    const loaded = await loadProfileById(effectiveActiveProfile);

    if (loaded) {
      console.log(`📱 Loaded active profile ${effectiveActiveProfile}`);
      const config = buildConfiguration(loaded.profileDef);
      setConfig(config, loaded.styleGroups);
      setCurrentProfileName(loaded.profileDef.name);
      setCurrentProfileId(effectiveActiveProfile);
      setCurrentKeyboardId(loaded.profileDef.keyboardId);
      onProfileChange(effectiveActiveProfile, loaded.profileDef.name, newLanguage, loaded.profileDef.keyboardId);
    } else {
      // Check if this is a built-in profile that hasn't been saved yet
      const templateId = extractTemplateId(effectiveActiveProfile);
      if (templateId) {
        console.log(`📱 Built-in profile ${effectiveActiveProfile} not saved yet, loading from template: ${templateId}`);
        const template = getBuiltInProfileTemplate(templateId);
        if (template) {
          const profileDef: SavedProfileDefinition = {
            id: effectiveActiveProfile,
            name: template.name,
            version: '1.0.0',
            language: newLanguage,
            keyboardId: firstKeyboardId,
            ...template.config,
            groups: [],
          };
          const createdAt = new Date().toISOString();
          const styleGroups = template.styleGroups.map((sg, index) => ({
            ...sg,
            id: `builtin_${templateId}_${index}`,
            createdAt,
          }));

          const config = buildConfiguration(profileDef);
          setConfig(config, styleGroups);
          setCurrentProfileName(template.name);
          setCurrentProfileId(effectiveActiveProfile);
          setCurrentKeyboardId(firstKeyboardId);
          onProfileChange(effectiveActiveProfile, template.name, newLanguage, firstKeyboardId);
        } else {
          // Template not found - fallback to factory defaults
          console.log(`📱 Template ${templateId} not found, using factory defaults`);
          const profileDef = createFactoryDefaultProfile(
            defaultProfileId,
            'Default',
            newLanguage,
            firstKeyboardId
          );
          const newConfig = buildConfiguration(profileDef);
          setConfig(newConfig, []);
          setCurrentProfileName('Default');
          setCurrentProfileId(defaultProfileId);
          setCurrentKeyboardId(firstKeyboardId);
          onProfileChange(defaultProfileId, 'Default', newLanguage, firstKeyboardId);
        }
      } else {
        console.log(`📱 No ${effectiveActiveProfile} profile found, using factory defaults`);
        // No saved profile - use factory defaults
        const profileDef = createFactoryDefaultProfile(
          defaultProfileId,
          'Default',
          newLanguage,
          firstKeyboardId
        );
        const newConfig = buildConfiguration(profileDef);
        setConfig(newConfig, []);
        setCurrentProfileName('Default');
        setCurrentProfileId(defaultProfileId);
        setCurrentKeyboardId(firstKeyboardId);
        onProfileChange(defaultProfileId, 'Default', newLanguage, firstKeyboardId);
      }
    }

    onLanguageChange(newLanguage);
  }, [setConfig, onLanguageChange, onProfileChange, appContext]);

  // Listen for launch keyboard events from native (Darwin notification)
  useEffect(() => {
    console.log('📱 [EditorScreenInner] Setting up launch keyboard listener');
    const subscription = KeyboardPreferences.addLaunchKeyboardListener(async (language) => {
      console.log(`📱 [EditorScreenInner] Received launch keyboard event: ${language}`);
      if (['he', 'en', 'ar'].includes(language)) {
        console.log(`📱 [EditorScreenInner] ✅ Switching to language: ${language}`);
        // Clear the preference
        await KeyboardPreferences.setProfile('', 'launch_keyboard');
        // Switch to that language
        await handleLanguageChange(language as LanguageId);
      } else {
        console.log(`📱 [EditorScreenInner] ❌ Invalid language: ${language}`);
      }
    });

    console.log('📱 [EditorScreenInner] Launch keyboard listener registered');

    return () => {
      console.log('📱 [EditorScreenInner] Removing launch keyboard listener');
      subscription.remove();
    };
  }, [handleLanguageChange]);

  // Handle keyboard variant change (within same language) - update current profile's keyboard
  const handleSave = useCallback(async () => {
    // Check if this is a built-in (read-only) profile
    const currentProfile = profiles.find(p => p.id === currentProfileId);
    const isBuiltInProfile = currentProfile?.isBuiltIn || false;

    if (isBuiltInProfile) {
      // For built-in profiles, open Save As modal instead
      setShowSaveAsModal(true);
      return;
    }

    // For custom profiles, save directly
    setSaving(true);
    try {
      await onSave(state.config, state.styleGroups);
      showToast('✓ Saved successfully');
      // Mark as saved (not dirty) since we just saved
      dispatch({ type: 'MARK_SAVED' });
    } catch (error) {
      console.error('Save failed:', error);
      showToast('✗ Save failed');
    } finally {
      setSaving(false);
    }
  }, [state.config, state.styleGroups, onSave, showToast, currentProfileId, profiles, dispatch]);

  const handleSaveAs = useCallback(async (newName: string): Promise<boolean> => {
    try {
      const newProfileId = `custom_${Date.now()}`;

      console.log('💾 handleSaveAs - state.styleGroups:', state.styleGroups);
      console.log('💾 handleSaveAs - styleGroups count:', state.styleGroups.length);

      // Extract current editor config and convert to profile definition
      // This captures ALL the user's changes including colors, fonts, layout
      const groupConfigs = convertStyleGroupsToGroupConfig(state.styleGroups);
      console.log('💾 handleSaveAs - groupConfigs after conversion:', groupConfigs);
      console.log('💾 handleSaveAs - groupConfigs count:', groupConfigs.length);

      const configToSave: KeyboardConfig = {
        ...state.config,
        groups: groupConfigs,
      };

      // Extract profile definition from current config (preserving all properties)
      const profileDef = extractProfileDefinition(
        configToSave,
        newProfileId,
        newName,
        currentLanguage,
        currentKeyboardId
      );

      // Save the new profile with all current settings
      await KeyboardPreferences.setProfile(
        JSON.stringify(profileDef),
        `profile_def_${newProfileId}`
      );

      // Save style groups
      await KeyboardPreferences.setProfile(
        JSON.stringify(state.styleGroups),
        `${newProfileId}_styleGroups`
      );

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

      // Switch to the new profile
      setConfig(configToSave, state.styleGroups);
      setCurrentProfileName(newName);
      setCurrentProfileId(newProfileId);
      onProfileChange(newProfileId, newName, currentLanguage, currentKeyboardId);

      // Save as the active profile for this language and app context
      // Use app-specific keyboard config key
      await saveKeyboardConfig(configToSave, currentLanguage, appContext);

      const activeProfileKey = getActiveProfileKey(currentLanguage, appContext);
      await KeyboardPreferences.setProfile(newProfileId, activeProfileKey);
      console.log(`✅ Set "${newName}" as active profile for ${currentLanguage} (${appContext})`);

      // Mark as saved (not dirty) since we just saved
      dispatch({ type: 'MARK_SAVED' });

      // Reload profile list to show the new profile
      await loadProfilesList();

      // Close modal
      setShowSaveAsModal(false);

      // Show success message
      showToast(`✓ Saved as "${newName}" and set as active`);

      // For IssieVoice, close the settings screen after saving
      if (appContext === 'issievoice' && onClose) {
        setTimeout(() => {
          onClose();
        }, 1000); // Give user time to see the success message
      }

      return true;
    } catch (error) {
      showToast('✗ Failed to save profile');
      return false;
    }
  }, [state.config, state.styleGroups, currentLanguage, currentKeyboardId, setConfig, onProfileChange, dispatch, loadProfilesList, showToast]);

  const handleKeyboardChange = useCallback((newKeyboardId: string) => {
    console.log(`📱 handleKeyboardChange: switching to ${newKeyboardId}, keeping profile ${currentProfileId}`);
    setCurrentKeyboardId(newKeyboardId);

    // Build new config with the new keyboard, keeping current profile ID
    // IMPORTANT: Preserve ALL config properties including unsaved runtime changes
    const profileDef: SavedProfileDefinition = {
      id: currentProfileId,
      name: currentProfileName,
      version: '1.0.0',
      language: currentLanguage,
      keyboardId: newKeyboardId,
      backgroundColor: state.config.backgroundColor,
      groups: state.config.groups, // Keep groups - they use key values which work across layouts
      diacritics: state.config.diacriticsSettings,
      wordSuggestionsEnabled: state.config.wordSuggestionsEnabled,
      autoCorrectEnabled: state.config.autoCorrectEnabled,
      fontName: state.config.fontName,
      fontSize: state.config.fontSize,
      fontWeight: state.config.fontWeight,
      keyGap: state.config.keyGap,
      keyHeight: state.config.keyHeight,
      keysBgColor: (state.config as any).keysBgColor,
      textColor: (state.config as any).textColor,
      settingsButtonEnabled: state.config.settingsButtonEnabled,
    };
    const newConfig = buildConfiguration(profileDef);
    // Keep style groups when switching keyboard variant
    // Style groups now store key values (e.g., "א") not position IDs,
    // so they work correctly across different keyboard layouts
    setConfig(newConfig, state.styleGroups);

    // Mark as dirty after setConfig (since setConfig resets dirty flag)
    // We need to use setTimeout to ensure the markDirty runs after setConfig's state update
    setTimeout(() => markDirty(), 0);

    onKeyboardChange(newKeyboardId);
  }, [currentLanguage, currentProfileId, currentProfileName, state.config, state.styleGroups, setConfig, markDirty, onKeyboardChange]);

  const handleLoadProfile = useCallback(async (profile: ProfileOption) => {
    // Check if there are unsaved changes
    if (state.isDirty) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. What would you like to do?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              setShowProfilePicker(false);
              loadProfileInternal(profile);
            }
          },
          {
            text: 'Save First',
            onPress: async () => {
              await handleSave();
              setShowProfilePicker(false);
              loadProfileInternal(profile);
            }
          },
        ]
      );
      return;
    }

    setShowProfilePicker(false);
    loadProfileInternal(profile);
  }, [state.isDirty, handleSave]);

  const loadProfileInternal = useCallback(async (profile: ProfileOption) => {
    const loaded = await loadProfileById(profile.id);
    if (loaded) {
      // Profile was found in preferences (previously saved)
      const config = buildConfiguration(loaded.profileDef);
      setConfig(config, loaded.styleGroups);
      setCurrentProfileName(profile.name);
      setCurrentProfileId(profile.id);
      setCurrentLanguage(profile.language);
      setCurrentKeyboardId(loaded.profileDef.keyboardId);
      onProfileChange(profile.id, profile.name, profile.language, loaded.profileDef.keyboardId);
      console.log(`✅ Switched to profile "${profile.name}"`);
    } else if (profile.isBuiltIn) {
      // Built-in profile not found in preferences - load from template
      const templateId = extractTemplateId(profile.id);
      console.log(`📱 Loading built-in profile from template: ${templateId || 'default'}`);

      let profileDef: SavedProfileDefinition;
      let styleGroups: any[] = [];

      // Fetch template once and reuse it
      const template = templateId ? getBuiltInProfileTemplate(templateId) : undefined;

      if (template) {
        // Build profile directly from the template (avoid refetching inside createProfileFromTemplate)
        profileDef = {
          id: profile.id,
          name: template.name,
          version: '1.0.0',
          language: profile.language,
          keyboardId: profile.keyboardId,
          ...template.config,
          groups: [],
        };

        // Convert template style groups to runtime style groups with IDs
        const createdAt = new Date().toISOString();
        styleGroups = template.styleGroups.map((sg, index) => ({
          ...sg,
          id: `builtin_${templateId}_${index}`,
          createdAt,
        }));
      } else {
        // Default profile or template not found - use factory defaults
        profileDef = createFactoryDefaultProfile(
          profile.id,
          profile.name,
          profile.language,
          profile.keyboardId
        );
      }

      const config = buildConfiguration(profileDef);
      setConfig(config, styleGroups);
      setCurrentProfileName(profile.name);
      setCurrentProfileId(profile.id);
      setCurrentLanguage(profile.language);
      setCurrentKeyboardId(profile.keyboardId);
      onProfileChange(profile.id, profile.name, profile.language, profile.keyboardId);
    } else {
      Alert.alert('Error', 'Failed to load profile');
    }
  }, [setConfig, onProfileChange]);

  // Update handleLoadProfile's dependency now that loadProfileInternal exists

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

  const handleDiscard = useCallback(async () => {
    Alert.alert(
      'Discard Changes',
      'Are you sure you want to discard all unsaved changes?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            // Reload the current profile from saved state
            const loaded = await loadProfileById(currentProfileId);
            if (loaded) {
              const config = buildConfiguration(loaded.profileDef);
              setConfig(config, loaded.styleGroups);
              showToast('✓ Changes discarded');
            } else {
              // Profile not saved yet - load factory defaults
              const langDef = LANGUAGES.find(l => l.id === currentLanguage);
              const defaultKeyboardId = langDef?.keyboards[0]?.id || currentLanguage;
              const profileDef = createFactoryDefaultProfile(
                currentProfileId,
                currentProfileName,
                currentLanguage,
                defaultKeyboardId
              );
              const config = buildConfiguration(profileDef);
              setConfig(config, []);
              showToast('✓ Changes discarded');
            }
          }
        },
      ]
    );
  }, [currentProfileId, currentLanguage, currentProfileName, setConfig, showToast]);

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

  const handleDeleteProfile = useCallback(async (profileToDelete: ProfileOption) => {
    // Don't allow deleting the default profile
    if (profileToDelete.isBuiltIn) {
      Alert.alert('Cannot Delete', 'The default profile cannot be deleted.');
      return;
    }

    // Don't allow deleting the active profile
    if (profileToDelete.isSystemActive) {
      Alert.alert('Cannot Delete', 'Cannot delete the active keyboard profile. Please activate a different profile first.');
      return;
    }

    Alert.alert(
      'Delete an IssieBoard',
      `Are you sure you want to delete "${profileToDelete.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await onDelete(profileToDelete.id, profileToDelete.name);
              showToast(`✓ Deleted "${profileToDelete.name}"`);
              await loadProfilesList();

              // If we deleted the currently selected profile, switch to default
              if (profileToDelete.id === currentProfileId) {
                const defaultProfileId = getDefaultProfileId(currentLanguage);
                const loaded = await loadProfileById(defaultProfileId);
                if (loaded) {
                  const config = buildConfiguration(loaded.profileDef);
                  setConfig(config, loaded.styleGroups);
                  setCurrentProfileName(loaded.profileDef.name);
                  setCurrentProfileId(defaultProfileId);
                  setCurrentKeyboardId(loaded.profileDef.keyboardId);
                  onProfileChange(defaultProfileId, loaded.profileDef.name, currentLanguage, loaded.profileDef.keyboardId);
                }
              }
            } catch (error) {
              showToast('✗ Failed to delete profile');
            }
          }
        },
      ]
    );
  }, [currentProfileId, currentLanguage, onDelete, showToast, loadProfilesList, setConfig, onProfileChange]);

  const handleDuplicate = useCallback(async () => {
    if (!duplicateName.trim()) {
      Alert.alert('Error', 'Please enter a name for the new profile');
      return;
    }

    setShowDuplicateModal(false);
    try {
      const newName = duplicateName.trim();
      const newProfileId = `custom_${Date.now()}`;

      // Extract current editor config with all changes
      const groupConfigs = convertStyleGroupsToGroupConfig(state.styleGroups);
      const configToSave: KeyboardConfig = {
        ...state.config,
        groups: groupConfigs,
      };

      // Extract profile definition from current config (preserving all properties)
      const profileDef = extractProfileDefinition(
        configToSave,
        newProfileId,
        newName,
        currentLanguage,
        currentKeyboardId
      );

      // Save the new profile with all current settings
      await KeyboardPreferences.setProfile(
        JSON.stringify(profileDef),
        `profile_def_${newProfileId}`
      );

      // Save style groups
      await KeyboardPreferences.setProfile(
        JSON.stringify(state.styleGroups),
        `${newProfileId}_styleGroups`
      );

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

      // Switch to the new profile
      setConfig(configToSave, state.styleGroups);
      setCurrentProfileName(newName);
      setCurrentProfileId(newProfileId);
      onProfileChange(newProfileId, newName, currentLanguage, currentKeyboardId);

      // Mark as saved since we just saved
      dispatch({ type: 'MARK_SAVED' });

      showToast(`✓ Created "${newName}"`);
      await loadProfilesList();
      setDuplicateName('');
    } catch (error) {
      showToast('✗ Failed to duplicate profile');
    }
  }, [duplicateName, state.config, state.styleGroups, currentLanguage, currentKeyboardId, setConfig, onProfileChange, dispatch, showToast, loadProfilesList]);

  const handleCreateNewProfile = useCallback(async (name: string, lang: LanguageId, kbId: string): Promise<boolean> => {
    setShowAddProfileModal(false);
    setShowProfilePicker(false);

    try {
      await onCreateNew(name, lang, kbId);
      // The onCreateNew already sets the new profile as current in the parent
      // Just update local state to match
      setCurrentProfileName(name);
      setCurrentLanguage(lang);
      setCurrentKeyboardId(kbId);
      showToast(`✓ Created "${name}"`);
      await loadProfilesList();
      return true;
    } catch (error) {
      showToast('✗ Failed to create profile');
      return false;
    }
  }, [onCreateNew, showToast, loadProfilesList]);

  const handleSetActiveForProfile = useCallback(async (profile: ProfileOption) => {
    try {
      await onSetActiveForProfile(profile.id);
      showToast(`✓ "${profile.name}" is now active`);
      await loadProfilesList();
    } catch (error) {
      console.error('Failed to set active profile:', error);
      showToast('✗ Failed to set active');
    }
  }, [onSetActiveForProfile, showToast, loadProfilesList]);

  const handleTestInput = useCallback((char: string) => {
    if (char === '\b' || char === 'backspace') {
      setTestText(prev => prev.slice(0, -1));
    } else if (char === '\n' || char === 'enter') {
      setTestText(prev => prev + '\n');
    } else {
      setTestText(prev => prev + char);
    }
  }, []);


  // Check if current profile is a default profile (not deletable but can be edited)
  const isDefaultProfile = currentProfileId === getDefaultProfileId(currentLanguage);

  return (
    <SafeAreaView style={styles.container}>
      {/* Toast Notification */}
      {toastMessage && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Text allowFontScaling={false} style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}

      {/* Add New Profile Modal */}
      <AddProfileModal
        visible={showAddProfileModal}
        onClose={() => setShowAddProfileModal(false)}
        onCreate={(name, lang, kbId) => handleCreateNewProfile(name, lang as LanguageId, kbId)}
        initialLanguage={currentLanguage}
        initialKeyboardId={currentKeyboardId}
        existingNames={profiles.map(p => p.name)}
      />

      {/* Save As Modal - for read-only profiles */}
      <SaveAsModal
        visible={showSaveAsModal}
        onClose={() => setShowSaveAsModal(false)}
        onSaveAs={handleSaveAs}
        originalName={currentProfileName}
        existingNames={profiles.map(p => p.name)}
      />

      {/* Duplicate Profile Modal */}
      <Modal
        visible={showDuplicateModal}
        transparent
        animationType="fade"
        supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
        onRequestClose={() => setShowDuplicateModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.duplicateModalContainer}>
            <Text allowFontScaling={false} style={styles.duplicateModalTitle}>Duplicate Profile</Text>
            <Text allowFontScaling={false} style={styles.duplicateModalSubtitle}>
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
                <Text allowFontScaling={false} style={styles.duplicateCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.duplicateConfirmButton}
                onPress={handleDuplicate}
              >
                <Text allowFontScaling={false} style={styles.duplicateConfirmText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Profile Picker Modal */}

      <Modal
        visible={showProfilePicker}
        transparent
        animationType="fade"
        supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
        onRequestClose={() => setShowProfilePicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowProfilePicker(false)}
        >
          <View style={styles.profilePickerContainer}>
            <View style={styles.profilePickerHeader}>
              <Text allowFontScaling={false} style={styles.profilePickerTitle}>
                {appContext === 'issievoice'
                  ? `My ${currentLanguageDef.name} Keyboards`
                  : `My ${currentLanguageDef.name} IssieBoards`}
              </Text>
              <View style={styles.profilePickerHeaderActions}>
                {/* Add New Profile Button */}
                <ActionButton
                  label="+ New"
                  color="green"
                  onPress={() => {
                    setShowProfilePicker(false);
                    setShowAddProfileModal(true);
                  }}
                />
                {/* Close button */}
                <TouchableOpacity
                  style={styles.profilePickerCloseButton}
                  onPress={() => setShowProfilePicker(false)}
                >
                  <Text allowFontScaling={false} style={styles.profilePickerCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {profiles.length === 0 ? (
              <Text allowFontScaling={false} style={styles.noProfilesText}>
                No saved profiles for {currentLanguageDef.name}.
                {'\n'}Create one to customize your keyboard.
              </Text>
            ) : (
              <FlatList
                data={profiles}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <View
                    style={[
                      styles.profileOption,
                      item.id === currentProfileId && styles.profileOptionActive,
                    ]}
                  >
                    <View style={styles.profileOptionInfo}>
                      <View style={styles.profileNameRow}>
                        {/* Built-in icon */}
                        {item.isBuiltIn && (
                          <Text allowFontScaling={false} style={styles.builtInIcon}>🎨</Text>
                        )}
                        <Text allowFontScaling={false} style={styles.profileOptionText}>
                          {item.name}
                        </Text>
                      </View>
                      <View style={styles.profileBadgesRow}>
                        {/* Built-in badge */}
                        {item.isBuiltIn && (
                          <View style={styles.readOnlyBadge}>
                            <Text allowFontScaling={false} style={styles.readOnlyBadgeText}>Built-in</Text>
                          </View>
                        )}
                        {/* Active badge */}
                        {item.isSystemActive && (
                          <View style={styles.systemActiveBadge}>
                            <Text allowFontScaling={false} style={styles.systemActiveBadgeText}>⚡ Active</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Action buttons: Delete (if not built-in) then Select */}
                    <View style={styles.profileOptionActions}>
                      {/* Delete button - only for custom profiles */}
                      {!item.isBuiltIn && (
                        <ActionButton
                          label="Delete"
                          color="red"
                          onPress={() => handleDeleteProfile(item)}
                        />
                      )}
                      {/* Select button - always show, makes it active and loads for editing */}
                      <ActionButton
                        label="Select"
                        color="blue"
                        onPress={() => {
                          // First make it active
                          handleSetActiveForProfile(item);
                          // Then load for editing
                          handleLoadProfile(item);
                        }}
                      />
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Language Selector - Matching mockup design */}
      <View style={styles.languageBar}>
        <View style={styles.languageBarTitle}>
          <Text style={styles.languageBarIcon}>⌨️</Text>
          <Text allowFontScaling={false} style={styles.languageBarTitleText}>
            {windowWidth < 700
              ? 'Settings'
              : appContext === 'issievoice'
                ? 'IssieVoice Keyboard Settings'
                : 'IssieBoard Settings'}
          </Text>
        </View>
        <View style={styles.languageTabs}>
          {LANGUAGES.map(lang => (
            <TouchableOpacity
              key={lang.id}
              style={[
                styles.languageTab,
                currentLanguage === lang.id && styles.languageTabActive,
              ]}
              onPress={() => handleLanguageChange(lang.id)}
            >
              <Text allowFontScaling={false} style={[
                styles.languageTabText,
                currentLanguage === lang.id && styles.languageTabTextActive,
              ]}>
                {lang.nativeName}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Close button for IssieVoice */}
        {appContext === 'issievoice' && onClose && (
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Profile Selection Row */}
      <View style={styles.profileRow}>
        <View style={[
          styles.profileContainer,
          windowWidth < 700 && styles.profileContainerSmall
        ]}>
          {/* Icon and Label - always on its own row */}
          <View style={styles.profileIconSection}>
            <Text allowFontScaling={false} style={styles.profileIcon}>⌨️</Text>
            <View style={{ flexDirection: "row" }}>
              <Text allowFontScaling={false} style={styles.profileSectionLabel}>
                {appContext === 'issievoice' ? 'Active Keyboard:' : 'Active IssieBoard:'}
              </Text>
              <TouchableOpacity onPress={handleTitleTap} activeOpacity={1}>
                <Text allowFontScaling={false} style={styles.profileName}>{currentProfileName}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Buttons row - wraps to new line on small screens */}
          <View style={styles.profileButtonsContainer}>
            {/* Explore Button */}
            <TouchableOpacity
              style={styles.exploreButton}
              onPress={() => setShowProfilePicker(true)}
            >
              <Text allowFontScaling={false} style={styles.exploreButtonIcon}>📋</Text>
              <Text allowFontScaling={false} style={styles.exploreButtonText}>
                {appContext === 'issievoice' ? 'My Keyboards' : 'My IssieBoards'}
              </Text>
            </TouchableOpacity>

            {/* Save Button */}
            <Animated.View style={{ opacity: state.isDirty ? saveButtonOpacity : 0.5 }}>
              <TouchableOpacity
                style={[styles.profileSaveButton, !state.isDirty && styles.headerButtonDisabled]}
                onPress={handleSave}
                disabled={saving || !state.isDirty}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Text allowFontScaling={false} style={styles.profileSaveButtonIcon}>💾</Text>
                    <Text allowFontScaling={false} style={styles.profileSaveButtonText}>
                      {profiles.find(p => p.id === currentProfileId)?.isBuiltIn ? 'Save As...' : 'Save'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Reset Button - Hidden but not deleted */}
          <TouchableOpacity
            style={[styles.headerResetButton, { display: 'none' }]}
            onPress={handleClearConfig}
          >
            <Text allowFontScaling={false} style={styles.headerResetButtonText}>🔄</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.canvasContainer, { height: windowHeight * .38 }]}>
          <InteractiveCanvas onTestInput={handleTestInput} height={windowHeight * .28 } />
        </View>

        <View style={styles.toolboxContainer}>
          <Toolbox
            keyboardVariants={currentLanguageDef.keyboards}
            currentKeyboardId={currentKeyboardId}
            onKeyboardVariantChange={handleKeyboardChange}
            profileName={currentProfileName}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

interface EditorScreenProps {
  profileId?: string;
  initialLanguage?: LanguageId;
  appContext?: AppContext;  // Which app is using the settings
  onBack?: () => void;       // Made optional for IssieVoice
  onClose?: () => void;      // Close callback for IssieVoice
}

export const EditorScreen: React.FC<EditorScreenProps> = ({
  profileId: propProfileId,
  initialLanguage: propInitialLanguage,
  appContext = 'issieboard',
  onBack,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [initialConfig, setInitialConfig] = useState<KeyboardConfig | null>(null);
  const [initialStyleGroups, setInitialStyleGroups] = useState<any[]>([]);
  const [profileName, setProfileName] = useState('');
  const [currentProfileId, setCurrentProfileId] = useState<string>('');
  const [currentLanguage, setCurrentLanguage] = useState<LanguageId>('he');
  const [currentKeyboardId, setCurrentKeyboardId] = useState<string>('he');
  const [activeKeyboardProfileId, setActiveKeyboardProfileId] = useState<string>('');

  useEffect(() => {
    const loadInitial = async () => {
      try {
        // Priority for language:
        // 1. propInitialLanguage (from keyboard launch via deep link or launch_keyboard pref)
        // 2. Saved preference
        // 3. Default 'he'
        let savedLanguage: LanguageId = 'he';

        // propInitialLanguage takes highest priority (set when opening from keyboard)
        if (propInitialLanguage) {
          savedLanguage = propInitialLanguage;
          console.log(`📱 Using propInitialLanguage: ${propInitialLanguage}`);
        } else {
          // Check if launched from keyboard extension (launch_keyboard is set by AppDelegate)
          try {
            const launchKeyboard = await KeyboardPreferences.getProfile('launch_keyboard');
            console.log(`📱 Checking launch_keyboard preference: "${launchKeyboard}" (type: ${typeof launchKeyboard})`);

            // Handle various falsy values including the string "null"
            if (launchKeyboard && launchKeyboard !== 'null' && launchKeyboard !== '' && ['he', 'en', 'ar'].includes(launchKeyboard)) {
              savedLanguage = launchKeyboard as LanguageId;
              console.log(`📱 ✅ Launched from ${launchKeyboard} keyboard, switching to that language`);
              // Clear the launch preference after reading it (one-time use)
              await KeyboardPreferences.setProfile('', 'launch_keyboard');
              console.log(`📱 Cleared launch_keyboard preference`);
            } else {
              console.log(`📱 launch_keyboard not set or invalid (value: "${launchKeyboard}"), checking current_language...`);
              // Try to load from saved preference
              const langPref = await KeyboardPreferences.getProfile('current_language');
              if (langPref && ['he', 'en', 'ar'].includes(langPref)) {
                savedLanguage = langPref as LanguageId;
                console.log(`📱 Using saved current_language: ${savedLanguage}`);
              } else {
                console.log(`📱 No saved language, using default: ${savedLanguage}`);
              }
            }
          } catch (error) {
            console.log(`📱 Error loading saved language:`, error);
            console.log(`📱 Using default: ${savedLanguage}`);
          }
        }

        console.log(`📱 EditorScreen loadInitial: language=${savedLanguage}`);
        setCurrentLanguage(savedLanguage);

        // Get the first keyboard for this language
        const langDef = LANGUAGES.find(l => l.id === savedLanguage) || LANGUAGES[0];
        const defaultKeyboardId = langDef.keyboards[0].id;

        // Get active profile for this language and app context
        const activeProfileKey = getActiveProfileKey(savedLanguage, appContext);
        console.log(`📱 ========== LOADING PROFILE ==========`);
        console.log(`📱 Looking for active profile with key: ${activeProfileKey}`);
        const activeProfile = await KeyboardPreferences.getProfile(activeProfileKey);
        console.log(`📱 Active profile value: ${activeProfile || 'NULL'}`);

        // If no active profile is set, the default profile is considered active
        const defaultProfileId = getDefaultProfileId(savedLanguage);
        const effectiveActiveProfile = activeProfile || defaultProfileId;
        console.log(`📱 Default profile ID: ${defaultProfileId}`);
        console.log(`📱 Effective active profile: ${effectiveActiveProfile}`);
        setActiveKeyboardProfileId(effectiveActiveProfile);

        // Try to load the ACTIVE profile first (not just default)
        console.log(`📱 Attempting to load profile: ${effectiveActiveProfile}`);
        const loaded = await loadProfileById(effectiveActiveProfile);
        console.log(`📱 Profile loaded: ${loaded ? 'YES' : 'NO'}`);

        if (loaded) {
          console.log(`📱 Loaded active profile ${effectiveActiveProfile}`);
          const config = buildConfiguration(loaded.profileDef);
          setInitialConfig(config);
          setInitialStyleGroups(loaded.styleGroups);
          setCurrentProfileId(effectiveActiveProfile);
          setProfileName(loaded.profileDef.name);
          setCurrentKeyboardId(loaded.profileDef.keyboardId);
        } else {
          console.log(`📱 No active profile ${effectiveActiveProfile} found, using base keyboard`);
          // Create the profile definition (won't save until user saves)
          const profileDef = createFactoryDefaultProfile(
            defaultProfileId,
            'Default',
            savedLanguage,
            defaultKeyboardId
          );

          const config = buildConfiguration(profileDef);
          setInitialConfig(config);
          setInitialStyleGroups([]);
          setCurrentProfileId(defaultProfileId);
          setProfileName('Default');
          setCurrentKeyboardId(defaultKeyboardId);
        }

      } catch (error) {
        console.error('Failed to load initial state:', error);
        // Fallback
        const lang = propInitialLanguage || 'he';
        const defaultProfileId = getDefaultProfileId(lang);
        const fallbackDef = createFactoryDefaultProfile(
          defaultProfileId,
          defaultProfileId,
          lang,
          lang
        );
        setInitialConfig(buildConfiguration(fallbackDef));
        setCurrentProfileId(defaultProfileId);
        setProfileName(defaultProfileId);
        setCurrentLanguage(lang);
        setCurrentKeyboardId(lang);
      } finally {
        setLoading(false);
      }
    };

    loadInitial();
  }, [propProfileId, propInitialLanguage, appContext]);

  const handleSave = useCallback(async (config: KeyboardConfig, styleGroups: any[]) => {
    // Always use the current profile ID (which should always be set)
    const saveProfileId = currentProfileId;
    const saveProfileName = profileName;

    console.log(`📱 ========== handleSave START ==========`);
    console.log(`📱 Saving profile: ${saveProfileId} (${saveProfileName})`);
    console.log(`📱 Language: ${currentLanguage}, Keyboard: ${currentKeyboardId}`);
    console.log(`📱 AppContext: ${appContext}`);
    console.log(`📱 styleGroups count: ${styleGroups.length}`);

    // Convert styleGroups to group configs and merge into config
    const groupConfigs = convertStyleGroupsToGroupConfig(styleGroups);
    console.log(`📱 groupConfigs count after conversion: ${groupConfigs.length}`);

    const configWithGroups: KeyboardConfig = {
      ...config,
      groups: groupConfigs,
    };

    const profileDef = extractProfileDefinition(
      configWithGroups, saveProfileId, saveProfileName, currentLanguage, currentKeyboardId
    );

    console.log(`📱 Profile definition created:`, {
      id: profileDef.id,
      name: profileDef.name,
      language: profileDef.language,
      keyboardId: profileDef.keyboardId,
    });

    // Save profile definition
    await KeyboardPreferences.setProfile(
      JSON.stringify(profileDef),
      `profile_def_${saveProfileId}`
    );
    console.log(`📱 ✅ Saved profile_def_${saveProfileId}`);

    // Save style groups
    await KeyboardPreferences.setProfile(
      JSON.stringify(styleGroups),
      `${saveProfileId}_styleGroups`
    );
    console.log(`📱 ✅ Saved ${saveProfileId}_styleGroups`);

    // Add to saved list if not already there
    let savedList: { name: string; key: string; language: string; keyboardId: string }[] = [];
    try {
      const savedListJson = await KeyboardPreferences.getProfile('saved_list');
      if (savedListJson) {
        savedList = JSON.parse(savedListJson);
      }
    } catch { /* ignore */ }

    const existingIndex = savedList.findIndex(p => p.key === saveProfileId);
    if (existingIndex === -1) {
      savedList.push({
        name: saveProfileName,
        key: saveProfileId,
        language: currentLanguage,
        keyboardId: currentKeyboardId
      });
      await KeyboardPreferences.setProfile(JSON.stringify(savedList), 'saved_list');
    } else {
      // Update existing entry
      savedList[existingIndex] = {
        name: saveProfileName,
        key: saveProfileId,
        language: currentLanguage,
        keyboardId: currentKeyboardId,
      };
      await KeyboardPreferences.setProfile(JSON.stringify(savedList), 'saved_list');
    }

    // When saving a profile, automatically make it active
    // Save the keyboard config and mark this profile as active
    console.log(`📱 Saving keyboard config with ${groupConfigs.length} groups...`);
    await saveKeyboardConfig(configWithGroups, currentLanguage, appContext);
    console.log(`📱 ✅ Saved keyboard config for ${currentLanguage} (${appContext})`);

    const activeProfileKey = getActiveProfileKey(currentLanguage, appContext);
    console.log(`📱 Setting active profile with key: ${activeProfileKey}`);
    await KeyboardPreferences.setProfile(saveProfileId, activeProfileKey);
    console.log(`📱 ✅ Set ${saveProfileId} as active profile`);

    console.log(`📱 ========== handleSave END - Success ==========`);
    console.log(`✅ Saved profile "${saveProfileName}"`);
  }, [currentProfileId, profileName, currentLanguage, currentKeyboardId, appContext]);

  const handleSetActive = useCallback(async () => {
    console.log(`📱 handleSetActive: setting ${currentProfileId} as active for language ${currentLanguage}, keyboard ${currentKeyboardId}, appContext ${appContext}`);

    // Get the current config and save it to the KEYBOARD-SPECIFIC key
    let config: KeyboardConfig | null = null;

    // Try to load saved profile first
    const profileDefJson = await KeyboardPreferences.getProfile(`profile_def_${currentProfileId}`);
    if (profileDefJson) {
      const profileDef = JSON.parse(profileDefJson) as SavedProfileDefinition;
      config = buildConfiguration(profileDef);
      console.log(`📱 Loaded saved profile ${currentProfileId}`);
    } else {
      // Profile not saved yet - build from factory defaults (or current editor state if it's default)
      const isDefaultProfile = currentProfileId === getDefaultProfileId(currentLanguage);
      if (isDefaultProfile) {
        // For default profile not saved yet, use factory defaults
        console.log(`📱 Building factory default config for ${currentProfileId}`);
        const profileDef = createFactoryDefaultProfile(
          currentProfileId,
          currentProfileId,
          currentLanguage,
          currentKeyboardId
        );
        config = buildConfiguration(profileDef);
      } else {
        console.error(`❌ Cannot set active: profile ${currentProfileId} not saved`);
        return;
      }
    }

    if (config) {
      // Save to app-specific key (keyboardConfig_he or keyboardConfig_issievoice_he)
      await saveKeyboardConfig(config, currentLanguage, appContext);
    }

    // Also save which profile is active for this language and app context
    const activeProfileKey = getActiveProfileKey(currentLanguage, appContext);
    await KeyboardPreferences.setProfile(currentProfileId, activeProfileKey);
    setActiveKeyboardProfileId(currentProfileId);
    console.log(`✅ Set ${currentProfileId} as active profile with key ${activeProfileKey}`);
  }, [currentProfileId, currentLanguage, currentKeyboardId, appContext]);

  const handleDuplicate = useCallback(async (newName: string): Promise<{ newProfileId: string; newConfig: KeyboardConfig; styleGroups: any[] }> => {
    const newProfileId = `custom_${Date.now()}`;

    // Get the current editor state (from saved profile)
    // We need to extract this from the current config that's being edited
    const currentConfigJson = await KeyboardPreferences.getProfile(`profile_def_${currentProfileId}`);
    let baseProfileDef: SavedProfileDefinition;

    if (currentConfigJson) {
      // Profile exists in storage - use it as base
      baseProfileDef = JSON.parse(currentConfigJson);
    } else {
      // Built-in profile that hasn't been saved yet - create from current editor state
      // This extracts the actual current configuration from the editor
      baseProfileDef = {
        id: currentProfileId,
        name: profileName,
        version: '1.0.0',
        language: currentLanguage,
        keyboardId: currentKeyboardId,
        backgroundColor: 'default',
        groups: [],
        fontWeight: 'heavy',
      };
    }

    // Create new profile based on current config (preserve all properties)
    const profileDef: SavedProfileDefinition = {
      ...baseProfileDef,
      id: newProfileId,
      name: newName,
    };

    // Save the new profile
    await KeyboardPreferences.setProfile(
      JSON.stringify(profileDef),
      `profile_def_${newProfileId}`
    );

    // Copy style groups from current profile
    let styleGroups: any[] = [];
    try {
      const styleGroupsJson = await KeyboardPreferences.getProfile(`${currentProfileId}_styleGroups`);
      if (styleGroupsJson) {
        styleGroups = JSON.parse(styleGroupsJson);
        await KeyboardPreferences.setProfile(styleGroupsJson, `${newProfileId}_styleGroups`);
      }
    } catch { /* ignore */ }

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

    // Switch to the new profile
    setCurrentProfileId(newProfileId);
    setProfileName(newName);

    const config = buildConfiguration(profileDef);
    setInitialConfig(config);

    return { newProfileId, newConfig: config, styleGroups };
  }, [currentProfileId, profileName, currentLanguage, currentKeyboardId]);

  const handleDelete = useCallback(async (profileIdToDelete: string, profileNameToDelete: string) => {
    if (!profileIdToDelete) return;

    // Remove from saved list
    let savedList: { name: string; key: string; language: string; keyboardId: string }[] = [];
    try {
      const savedListJson = await KeyboardPreferences.getProfile('saved_list');
      if (savedListJson) {
        savedList = JSON.parse(savedListJson);
      }
    } catch { /* ignore */ }

    savedList = savedList.filter(p => p.key !== profileIdToDelete);
    await KeyboardPreferences.setProfile(JSON.stringify(savedList), 'saved_list');

    // Note: The inner component handles switching to default profile if needed
    console.log(`✅ Deleted profile "${profileNameToDelete}"`);
  }, []);

  const handleProfileChange = useCallback((newProfileId: string, newProfileName: string, newLanguage: LanguageId, newKeyboardId: string) => {
    setCurrentProfileId(newProfileId);
    setProfileName(newProfileName);
    setCurrentLanguage(newLanguage);
    setCurrentKeyboardId(newKeyboardId);
  }, []);

  const handleLanguageChange = useCallback(async (newLanguage: LanguageId) => {
    setCurrentLanguage(newLanguage);
    await KeyboardPreferences.setProfile(newLanguage, 'current_language');
  }, []);

  const handleKeyboardChange = useCallback((newKeyboardId: string) => {
    setCurrentKeyboardId(newKeyboardId);
  }, []);

  const handleSetActiveForProfile = useCallback(async (profileIdToActivate: string) => {
    console.log(`📱 handleSetActiveForProfile: setting ${profileIdToActivate} as active for language ${currentLanguage}`);

    // Load the profile
    const loaded = await loadProfileById(profileIdToActivate);

    let config: KeyboardConfig;

    if (!loaded) {
      // Check if this is a built-in profile that hasn't been saved yet
      const templateId = extractTemplateId(profileIdToActivate);
      if (templateId) {
        console.log(`📱 Built-in profile ${profileIdToActivate} not saved yet, loading from template: ${templateId}`);
        // Get the first keyboard for this language
        const langDef = LANGUAGES.find(l => l.id === currentLanguage);
        const firstKeyboardId = langDef?.keyboards[0]?.id || currentLanguage;

        const template = getBuiltInProfileTemplate(templateId);
        if (template) {
          const profileDef: SavedProfileDefinition = {
            id: profileIdToActivate,
            name: template.name,
            version: '1.0.0',
            language: currentLanguage,
            keyboardId: firstKeyboardId,
            ...template.config,
            groups: [],
          };

          // Build style groups from template
          const createdAt = new Date().toISOString();
          const styleGroups = template.styleGroups.map((sg, index) => ({
            ...sg,
            id: `builtin_${templateId}_${index}`,
            createdAt,
          }));

          // Merge style groups into profileDef.groups
          // Convert from React Native format (members/style) to native format (items/template)
          profileDef.groups = styleGroups.map(sg => ({
            items: sg.members,  // Native expects 'items', not 'members'
            template: {
              color: sg.style?.color,
              bgColor: sg.style?.bgColor,
              fontSize: sg.style?.fontSize,
              visibilityMode: sg.style?.visibilityMode,
            },
          }));

          // Save the profile definition so it persists
          console.log(`📱 Saving built-in profile definition: profile_def_${profileIdToActivate}`);
          await KeyboardPreferences.setProfile(
            JSON.stringify(profileDef),
            `profile_def_${profileIdToActivate}`
          );

          // Save style groups
          await KeyboardPreferences.setProfile(
            JSON.stringify(styleGroups),
            `${profileIdToActivate}_styleGroups`
          );
          console.log(`📱 ✅ Saved profile definition and style groups`);

          config = buildConfiguration(profileDef);
        } else {
          // Template not found - fallback to factory defaults
          const profileDef = createFactoryDefaultProfile(
            profileIdToActivate,
            'Default',
            currentLanguage,
            firstKeyboardId
          );
          config = buildConfiguration(profileDef);
        }
      } else {
        console.error(`❌ Cannot set active: profile ${profileIdToActivate} not found`);
        throw new Error(`Profile ${profileIdToActivate} not found`);
      }
    } else {
      config = buildConfiguration(loaded.profileDef);
    }

    // Save to app-specific key (keyboardConfig_he or keyboardConfig_issievoice_he)
    await saveKeyboardConfig(config, currentLanguage, appContext);

    // Save which profile is active for this language and app context
    const activeProfileKey = getActiveProfileKey(currentLanguage, appContext);
    await KeyboardPreferences.setProfile(profileIdToActivate, activeProfileKey);
    setActiveKeyboardProfileId(profileIdToActivate);
    console.log(`✅ Set ${profileIdToActivate} as active profile for ${currentLanguage} (${appContext})`);
  }, [currentLanguage, appContext]);

  const handleCreateNew = useCallback(async (name: string, language: LanguageId, keyboardId: string) => {
    const newProfileId = `custom_${Date.now()}`;

    const profileDef = createFactoryDefaultProfile(
      newProfileId,
      name,
      language,
      keyboardId
    );

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

    // Set as active profile for this language and app context
    await saveKeyboardConfig(config, language, appContext);

    const activeProfileKey = getActiveProfileKey(language, appContext);
    await KeyboardPreferences.setProfile(newProfileId, activeProfileKey);
    console.log(`✅ Set ${newProfileId} as active profile for ${language} (${appContext})`);

    setCurrentProfileId(newProfileId);
    setProfileName(name);
    setCurrentLanguage(language);
    setCurrentKeyboardId(keyboardId);
    setInitialConfig(config);
    setInitialStyleGroups([]);
    setActiveKeyboardProfileId(newProfileId);
  }, [appContext]);

  if (loading || !initialConfig) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text allowFontScaling={false} style={styles.loadingText}>Loading...</Text>
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
        appContext={appContext}
        onClose={onClose}
        isActiveProfile={currentProfileId === activeKeyboardProfileId}
        onSave={handleSave}
        onSetActive={handleSetActive}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onSetActiveForProfile={handleSetActiveForProfile}
        activeKeyboardProfileId={activeKeyboardProfileId}
        onProfileChange={handleProfileChange}
        onLanguageChange={handleLanguageChange}
        onKeyboardChange={handleKeyboardChange}
        onCreateNew={handleCreateNew}
      />
    </EditorProvider>
  );
};

// Detect if device is iPad based on screen size
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isTablet = Math.min(screenWidth, screenHeight) >= 600;

// Responsive sizes for iPad
const buttonHeight = isTablet ? 56 : 44;
const buttonWidth = isTablet ? 140 : 100;
const iconButtonSize = isTablet ? 56 : 44;
const fontSize = isTablet ? 18 : 16;
const smallFontSize = isTablet ? 16 : 14;

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
  // Language bar - new design matching mockup
  languageBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  languageBarTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  languageBarIcon: {
    fontSize: 20,
  },
  languageBarTitleText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  languageTabs: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  languageTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  languageTabActive: {
    backgroundColor: '#3B82F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  languageTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  languageTabTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  closeButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 18,
    marginLeft: 12,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#6B7280',
    fontWeight: '600',
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
  combinedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isTablet ? 16 : 8,
    paddingVertical: isTablet ? 14 : 10,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    minHeight: isTablet ? 72 : 56,
  },
  headerSaveButton: {
    minWidth: buttonWidth,
    height: buttonHeight,
    borderRadius: buttonHeight / 2,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    flexDirection: 'row',
    paddingHorizontal: isTablet ? 20 : 12,
  },
  headerSaveButtonText: {
    fontSize: fontSize,
    fontWeight: '600',
    color: '#FFF',
  },
  headerButtonDisabled: {
    backgroundColor: '#CCC',
  },
  headerProfilePicker: {
    flex: 0.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  headerResetButton: {
    width: iconButtonSize,
    height: iconButtonSize,
    borderRadius: iconButtonSize / 2,
    backgroundColor: '#9E9E9E',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerResetButtonText: {
    fontSize: isTablet ? 24 : 20,
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  testInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
  },
  canvasContainer: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
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
  profilePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  profilePickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  profileOptionActive: {
    backgroundColor: '#E3F2FD',
  },
  profileOptionMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileOptionInfo: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    flex: 1,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  builtInIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  profileOptionText: {
    fontSize: 16,
    color: '#333',
  },
  profileBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  readOnlyBadge: {
    backgroundColor: '#9E9E9E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 4,
  },
  readOnlyBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#FFF',
  },
  profileOptionCheck: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: 'bold',
    marginRight: 8,
  },
  profileOptionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  profileActionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  profileDeleteButton: {
    backgroundColor: '#F44336',
  },
  selectButton: {
    backgroundColor: '#3B82F6',
  },
  profileActionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  selectButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  duplicateIconText: {
    fontSize: 20,
  },
  profileBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  systemActiveBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 4,
  },
  systemActiveBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFF',
  },
  editingBadge: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 4,
  },
  editingBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFF',
  },
  activateButton: {
    backgroundColor: '#FF9800',
  },
  duplicateActionButton: {
    backgroundColor: '#2196F3',
  },
  toast: {
    position: 'absolute',
    bottom: '10%',
    left: 20,
    right: 20,
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    zIndex: 1000,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  toastText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
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
  profilePickerHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addNewProfileButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginRight: 8,
  },
  addNewProfileButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  profilePickerCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePickerCloseText: {
    fontSize: 16,
    color: '#666',
    fontWeight: 'bold',
  },
  headerDiscardButton: {
    height: buttonHeight,
    borderRadius: buttonHeight / 2,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    paddingHorizontal: isTablet ? 20 : 12,
  },
  headerDiscardButtonText: {
    fontSize: smallFontSize,
    fontWeight: '600',
    color: '#FFF',
  },
  // New Profile Row Styles
  profileRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileContainerSmall: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
  },
  profileIconSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  profileIcon: {
    fontSize: 28,
  },
  profileSectionLabel: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  profileName: {
    marginHorizontal: 10,
    fontSize: 18,
    color: '#333',
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 12,
    gap: 6,
  },
  exploreButtonIcon: {
    fontSize: 16,
  },
  exploreButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  profileSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 12,
    minWidth: 80,
    gap: 6,
  },
  profileSaveButtonIcon: {
    fontSize: 16,
  },
  profileSaveButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Reusable Action Button Styles
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 5,
    minWidth: 80,
  },
  actionButtonGreen: {
    backgroundColor: '#4CAF50',
  },
  actionButtonBlue: {
    backgroundColor: '#3B82F6',
  },
  actionButtonRed: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
});

export default EditorScreen;