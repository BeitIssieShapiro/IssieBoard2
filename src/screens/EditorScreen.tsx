import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
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
import { MyIcon } from '@beitissieshapiro/issie-shared/dist/icons';
import { useLocalization } from '../localization';
import { useKeyboardSetupStatus } from '../hooks/useKeyboardSetupStatus';
import { SetupStatusStrip } from '../components/SetupStatusStrip';
import { AboutScreen } from '../components/AboutScreen';
import Share from 'react-native-share';
import { exportProfile, exportAll } from '../import-export';
import { ISSIEBOARD_ABOUT, ISSIEVOICE_ABOUT } from '../components/about-content';

// Import keyboard files
import enKeyboard from '../../keyboards/en.json';
import heKeyboard from '../../keyboards/he.json';
import heOrderedKeyboard from '../../keyboards/he_ordered.json';
import arKeyboard from '../../keyboards/ar.json';
import enOrderedKeyboard from '../../keyboards/en_ordered.json';
import arOrderedKeyboard from '../../keyboards/ar_ordered.json';

// Import keyboard config merger utilities
import { buildKeyboardConfig, SourceKeyboard, mergeCommonKeysets, getCommonKeysets } from '../utils/keyboardConfigMerger';

// Import predefined rules for preset member resolution on keyboard variant switch
import enRules from '../../assets/predefined-rules/en.json';
import heRules from '../../assets/predefined-rules/he.json';
import arRules from '../../assets/predefined-rules/ar.json';

const PREDEFINED_RULES: Record<string, any> = { en: enRules, he: heRules, ar: arRules };

/** Resolve preset members for a given presetId, language, and keyboardId */
function resolvePresetMembers(presetId: string, language: string, keyboardId: string): string[] | null {
  const rules = PREDEFINED_RULES[language]?.rules;
  if (!rules) return null;
  const rule = rules.find((r: any) => r.id === presetId);
  if (!rule) return null;
  return (keyboardId.endsWith('_ordered') && rule.orderedMembers) ? rule.orderedMembers : rule.members;
}

// Import built-in profile templates
import {
  BUILT_IN_PROFILES,
  getBuiltInProfileTemplate,
  extractTemplateId,
  isBuiltInProfileId,
  getLocalizedProfileName
} from '../data/builtInProfiles';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cardShadow } from '../styles/shadows';

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
type LanguageId = 'he' | 'en' | 'ar' | 'calc';

interface LanguageDefinition {
  id: LanguageId;
  name: string;
  nativeName: string;
  keyboards: { id: string; name: string }[];
}

const getLanguages = (strings: { editor: { languages: { hebrew: string; english: string; arabic: string }; keyboardVariants: { standard: string; orderedHe: string; qwerty: string; orderedEn: string; orderedAr: string } } }): LanguageDefinition[] => [
  {
    id: 'he',
    name: strings.editor.languages.hebrew,
    nativeName: 'עברית',
    keyboards: [
      { id: 'he', name: strings.editor.keyboardVariants.standard },
      { id: 'he_ordered', name: strings.editor.keyboardVariants.orderedHe },
    ],
  },
  {
    id: 'en',
    name: strings.editor.languages.english,
    nativeName: 'English',
    keyboards: [
      { id: 'en', name: strings.editor.keyboardVariants.qwerty },
      { id: 'en_ordered', name: strings.editor.keyboardVariants.orderedEn },
    ],
  },
  {
    id: 'ar',
    name: strings.editor.languages.arabic,
    nativeName: 'العربية',
    keyboards: [
      { id: 'ar', name: strings.editor.keyboardVariants.standard },
      { id: 'ar_ordered', name: strings.editor.keyboardVariants.orderedAr },
    ],
  },
];

// Static language definitions for utility code that doesn't need localized display names
const LANGUAGES_STATIC: { id: LanguageId; keyboards: { id: string }[] }[] = [
  { id: 'he', keyboards: [{ id: 'he' }, { id: 'he_ordered' }] },
  { id: 'en', keyboards: [{ id: 'en' }, { id: 'en_ordered' }] },
  { id: 'ar', keyboards: [{ id: 'ar' }, { id: 'ar_ordered' }] },
];

// Available keyboards by ID
const KEYBOARDS: Record<string, KeyboardDefinition> = {
  'en': enKeyboard,
  'en_ordered': enOrderedKeyboard,
  'he': heKeyboard,
  'he_ordered': heOrderedKeyboard,
  'ar': arKeyboard,
  'ar_ordered': arOrderedKeyboard,
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
    fontSizePreset: config.fontSizePreset,
    fontWeight: config.fontWeight,
    keyGap: config.keyGap,
    heightPreset: config.heightPreset,
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
    fontSizePreset: profile.fontSizePreset,
    fontWeight: profile.fontWeight,
    keyGap: profile.keyGap,
    heightPreset: profile.heightPreset,
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

type AppContext = 'issieboard' | 'issievoice' | 'issiecalc';

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
    // IssieVoice/IssieCalc use app-specific keys for in-app preview
    return `keyboardConfig_${appContext}_${language}`;
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
    fontSizePreset: config.fontSizePreset,
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
  onSwitchToClassic?: () => void;
  showProfilePickerRef?: React.MutableRefObject<(() => void) | null>;
  /** Headless mode: only render toolbox panels + modals, no header/canvas/profile row */
  headless?: boolean;
  /** Active tab ID for headless per-tab rendering */
  activeTab?: string;
  /** Description text shown at the top of the headless panel for the active tab */
  tabDescription?: string;
  /** Ref to expose save function to parent */
  saveRef?: React.MutableRefObject<(() => void) | null>;
  /** Ref to expose silent auto-save (background/quit) — handles built-in by saving as a copy */
  autoSaveRef?: React.MutableRefObject<(() => void) | null>;
  /** Ref to expose discard (restore to last saved state) to parent */
  discardRef?: React.MutableRefObject<(() => void) | null>;
  /** Ref to expose language change to parent */
  changeLanguageRef?: React.MutableRefObject<((lang: LanguageId) => void) | null>;
  /** Callback to report state changes (language, profile, dirty) to parent */
  onStateChange?: (state: { language: LanguageId; profileName: string; isDirty: boolean }) => void;
  /** Selected languages for IssieVoice language key injection */
  selectedLanguages?: string[];
}
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
  onSwitchToClassic,
  showProfilePickerRef,
  headless,
  activeTab,
  tabDescription,
  saveRef,
  autoSaveRef,
  discardRef,
  changeLanguageRef,
  onStateChange,
  selectedLanguages,
}) => {
  const { strings, isRTL, language: uiLanguage } = useLocalization();
  const LANGUAGES = useMemo(() => getLanguages(strings), [strings]);
  const { state, setMode, setConfig, markDirty, dispatch } = useEditor();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [testText, setTestText] = useState('');
  const [saving, setSaving] = useState(false);
  const [settingActive, setSettingActive] = useState(false);
  const [showProfilePicker, setShowProfilePicker] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [profileToClone, setProfileToClone] = useState<ProfileOption | null>(null);
  const [cloneName, setCloneName] = useState('');

  // Speak button in keyboard setting (IssieVoice only)
  const [speakButtonInKeyboard, setSpeakButtonInKeyboard] = useState(false);
  useEffect(() => {
    if (appContext !== 'issievoice') return;
    const load = async () => {
      const value = await KeyboardPreferences.getString('issievoice_speakButtonInKeyboard');
      setSpeakButtonInKeyboard(value === 'true');
    };
    load();
  }, [appContext]);

  // Expose profile picker trigger to parent
  useEffect(() => {
    if (showProfilePickerRef) {
      showProfilePickerRef.current = () => setShowProfilePicker(true);
    }
    return () => {
      if (showProfilePickerRef) {
        showProfilePickerRef.current = null;
      }
    };
  }, [showProfilePickerRef]);
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [duplicateName, setDuplicateName] = useState('');
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [showAddProfileModal, setShowAddProfileModal] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [currentProfileName, setCurrentProfileName] = useState(profileName);
  const [currentProfileId, setCurrentProfileId] = useState(profileId);
  const [currentLanguage, setCurrentLanguage] = useState<LanguageId>(language);
  const [currentKeyboardId, setCurrentKeyboardId] = useState(keyboardId);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const setupStatus = useKeyboardSetupStatus(currentLanguage);

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
  const afterSaveAsRef = useRef<(() => void) | null>(null);

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
        name: getLocalizedProfileName(template.id, uiLanguage),
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
  }, [currentLanguage, activeKeyboardProfileId, LANGUAGES]);

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
          strings.alerts.resetToFactory,
          strings.alerts.clearAllSettings,
          [
            {
              text: strings.common.cancel,
              style: 'cancel',
            },
            {
              text: strings.common.reset,
              style: 'destructive',
              onPress: async () => {
                try {
                  const result = await KeyboardPreferences.clearAll();
                  if (result.success) {
                    showToast('✓ ' + strings.alerts.resetToFactory);
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
                    showToast('✗ ' + strings.common.error);
                  }
                } catch (e) {
                  console.error('Reset error:', e);
                  showToast('✗ ' + strings.common.error);
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
  }, [tapTimeout, currentLanguageDef, currentProfileId, currentProfileName, currentLanguage, setConfig, showToast, loadProfilesList, strings.alerts.clearAllSettings, strings.alerts.resetToFactory, strings.common.cancel, strings.common.error, strings.common.reset]);

  // Handle language change - try to load the ACTIVE profile for that language
  const handleLanguageChange = useCallback(async (newLanguage: LanguageId) => {
    console.log(`📱 handleLanguageChange: switching to ${newLanguage} (appContext: ${appContext})`);
    setCurrentLanguage(newLanguage);

    // IssieCalc: load calc config directly, bypass language/profile system
    if (appContext === 'issiecalc') {
      const savedJson = await KeyboardPreferences.getString('keyboardConfig_issiecalc_calc');
      if (savedJson) {
        try {
          const savedConfig = JSON.parse(savedJson);
          setConfig(savedConfig, []);
          return;
        } catch {}
      }
      // Fallback to built-in calc config
      const calcConfig = require('../../ios/IssieCalc/default_config.json');
      setConfig(calcConfig, []);
      return;
    }

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
      // For built-in profiles, use localized name instead of saved name
      const loadedTemplateId = extractTemplateId(effectiveActiveProfile);
      const displayName = loadedTemplateId ? getLocalizedProfileName(loadedTemplateId, uiLanguage) : loaded.profileDef.name;
      setCurrentProfileName(displayName);
      setCurrentProfileId(effectiveActiveProfile);
      setCurrentKeyboardId(loaded.profileDef.keyboardId);
      onProfileChange(effectiveActiveProfile, displayName, newLanguage, loaded.profileDef.keyboardId);
    } else {
      // Check if this is a built-in profile that hasn't been saved yet
      const templateId = extractTemplateId(effectiveActiveProfile);
      if (templateId) {
        console.log(`📱 Built-in profile ${effectiveActiveProfile} not saved yet, loading from template: ${templateId}`);
        const template = getBuiltInProfileTemplate(templateId);
        if (template) {
          const profileDef: SavedProfileDefinition = {
            id: effectiveActiveProfile,
            name: getLocalizedProfileName(templateId, uiLanguage),
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
          setCurrentProfileName(getLocalizedProfileName(templateId, uiLanguage));
          setCurrentProfileId(effectiveActiveProfile);
          setCurrentKeyboardId(firstKeyboardId);
          onProfileChange(effectiveActiveProfile, getLocalizedProfileName(templateId, uiLanguage), newLanguage, firstKeyboardId);
        } else {
          // Template not found - fallback to factory defaults
          console.log(`📱 Template ${templateId} not found, using factory defaults`);
          const profileDef = createFactoryDefaultProfile(
            defaultProfileId,
            strings.common.default,
            newLanguage,
            firstKeyboardId
          );
          const newConfig = buildConfiguration(profileDef);
          setConfig(newConfig, []);
          setCurrentProfileName(strings.common.default);
          setCurrentProfileId(defaultProfileId);
          setCurrentKeyboardId(firstKeyboardId);
          onProfileChange(defaultProfileId, strings.common.default, newLanguage, firstKeyboardId);
        }
      } else {
        console.log(`📱 No ${effectiveActiveProfile} profile found, using factory defaults`);
        // No saved profile - use factory defaults
        const profileDef = createFactoryDefaultProfile(
          defaultProfileId,
          strings.common.default,
          newLanguage,
          firstKeyboardId
        );
        const newConfig = buildConfiguration(profileDef);
        setConfig(newConfig, []);
        setCurrentProfileName(strings.common.default);
        setCurrentProfileId(defaultProfileId);
        setCurrentKeyboardId(firstKeyboardId);
        onProfileChange(defaultProfileId, strings.common.default, newLanguage, firstKeyboardId);
      }
    }

    onLanguageChange(newLanguage);
  }, [setConfig, onLanguageChange, onProfileChange, appContext, LANGUAGES, strings.common.default]);

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

  // Wrapper for language tab press — shows Full Access alert if tapping active tab with badge
  const handleLanguageTabPress = useCallback((langId: LanguageId) => {
    if (langId === currentLanguage && setupStatus.isAdded === true && setupStatus.hasFullAccess !== true) {
      const message = [
        strings.setup.fullAccessStep1,
        strings.setup.fullAccessStep2,
        strings.setup.fullAccessStep3,
      ].join('\n');
      Alert.alert(strings.setup.fullAccessTitle, message);
      return;
    }
    handleLanguageChange(langId);
  }, [currentLanguage, setupStatus, handleLanguageChange, strings.setup]);

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
      showToast('✓ ' + strings.alerts.profileSaved);
      // Mark as saved (not dirty) since we just saved
      dispatch({ type: 'MARK_SAVED' });
    } catch (error) {
      console.error('Save failed:', error);
      showToast('✗ ' + strings.alerts.failedToSaveProfile);
    } finally {
      setSaving(false);
    }
  }, [state.config, state.styleGroups, onSave, showToast, currentProfileId, profiles, dispatch, strings.alerts.profileSaved, strings.alerts.failedToSaveProfile]);

  // Expose save function to parent via ref
  useEffect(() => {
    if (saveRef) {
      saveRef.current = handleSave;
    }
    return () => {
      if (saveRef) {
        saveRef.current = null;
      }
    };
  }, [saveRef, handleSave]);

  // Silent auto-save for background/quit: saves directly without opening any modal
  const handleAutoSave = useCallback(async () => {
    if (!state.isDirty) return;
    const currentProfile = profiles.find(p => p.id === currentProfileId);
    if (currentProfile?.isBuiltIn) {
      const copyName = `${currentProfileName} Copy`;
      await handleSaveAs(copyName);
    } else {
      await handleSave();
    }
  }, [state.isDirty, profiles, currentProfileId, currentProfileName, handleSaveAs, handleSave]);

  useEffect(() => {
    if (autoSaveRef) {
      autoSaveRef.current = handleAutoSave;
    }
    return () => {
      if (autoSaveRef) {
        autoSaveRef.current = null;
      }
    };
  }, [autoSaveRef, handleAutoSave]);

  useEffect(() => {
    if (discardRef) {
      discardRef.current = handleDiscard;
    }
    return () => {
      if (discardRef) {
        discardRef.current = null;
      }
    };
  }, [discardRef, handleDiscard]);

  // Expose language change to parent via ref (inner handleLanguageChange loads profiles)
  useEffect(() => {
    if (changeLanguageRef) {
      changeLanguageRef.current = handleLanguageChange;
    }
    return () => {
      if (changeLanguageRef) {
        changeLanguageRef.current = null;
      }
    };
  }, [changeLanguageRef, handleLanguageChange]);

  // Report state changes to parent (language, profile name, dirty status)
  useEffect(() => {
    if (onStateChange) {
      onStateChange({ language: currentLanguage, profileName: currentProfileName, isDirty: state.isDirty });
    }
  }, [currentLanguage, currentProfileName, state.isDirty, onStateChange]);

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
      showToast(`✓ ${strings.alerts.savedChangesTo} "${newName}"`);

      // Run pending action after Save As (e.g., switch to classic view)
      if (afterSaveAsRef.current) {
        const pendingAction = afterSaveAsRef.current;
        afterSaveAsRef.current = null;
        pendingAction();
      }

      // For IssieVoice, close the settings screen after saving
      if (appContext === 'issievoice' && onClose) {
        setTimeout(() => {
          onClose();
        }, 1000); // Give user time to see the success message
      }

      return true;
    } catch (error) {
      showToast('✗ ' + strings.alerts.failedToSaveProfile);
      return false;
    }
  }, [state.config, state.styleGroups, currentLanguage, currentKeyboardId, setConfig, onProfileChange, dispatch, loadProfilesList, showToast, appContext, onClose, strings.alerts.failedToSaveProfile, strings.alerts.savedChangesTo]);

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
      fontSizePreset: state.config.fontSizePreset,
      fontWeight: state.config.fontWeight,
      keyGap: state.config.keyGap,
      heightPreset: state.config.heightPreset,
      keysBgColor: (state.config as any).keysBgColor,
      textColor: (state.config as any).textColor,
      settingsButtonEnabled: state.config.settingsButtonEnabled,
    };
    const newConfig = buildConfiguration(profileDef);

    // Update preset group members to match the new keyboard variant
    const updatedGroups = state.styleGroups.map(group => {
      if (!group.presetId) return group;
      const newMembers = resolvePresetMembers(group.presetId, currentLanguage, newKeyboardId);
      if (!newMembers) return group;
      return { ...group, members: newMembers };
    });

    setConfig(newConfig, updatedGroups);

    // Mark as dirty after setConfig (since setConfig resets dirty flag)
    // We need to use setTimeout to ensure the markDirty runs after setConfig's state update
    setTimeout(() => markDirty(), 0);

    onKeyboardChange(newKeyboardId);
  }, [currentLanguage, currentProfileId, currentProfileName, state.config, state.styleGroups, setConfig, markDirty, onKeyboardChange]);

  const handleLoadProfile = useCallback(async (profile: ProfileOption) => {
    // Check if there are unsaved changes
    if (state.isDirty) {
      Alert.alert(
        strings.alerts.unsavedChanges,
        strings.alerts.unsavedChangesMessage,
        [
          { text: strings.common.cancel, style: 'cancel' },
          {
            text: strings.alerts.discard,
            style: 'destructive',
            onPress: () => {
              setShowProfilePicker(false);
              loadProfileInternal(profile);
            }
          },
          {
            text: strings.alerts.saveFirst,
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
  }, [state.isDirty, handleSave, strings.alerts.discard, strings.alerts.saveFirst, strings.alerts.unsavedChanges, strings.alerts.unsavedChangesMessage, strings.common.cancel]);

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
          name: getLocalizedProfileName(templateId!, uiLanguage),
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
      Alert.alert(strings.common.error, strings.alerts.failedToLoadProfile);
    }
  }, [setConfig, onProfileChange, strings.common.error, strings.alerts.failedToLoadProfile]);

  // Update handleLoadProfile's dependency now that loadProfileInternal exists

  const handleSetActive = useCallback(async () => {
    setSettingActive(true);
    try {
      await onSetActive();
      showToast('✓ ' + strings.alerts.profileUpdated);
    } catch (error) {
      showToast('✗ ' + strings.alerts.failedToSwitchProfile);
    } finally {
      setSettingActive(false);
    }
  }, [onSetActive, showToast, strings.alerts.profileUpdated, strings.alerts.failedToSwitchProfile]);

  const handleDiscard = useCallback(async () => {
    Alert.alert(
      strings.alerts.discardChanges,
      strings.alerts.discardChangesMessage,
      [
        { text: strings.common.cancel, style: 'cancel' },
        {
          text: strings.alerts.discard,
          style: 'destructive',
          onPress: async () => {
            // Reload the current profile from saved state
            const loaded = await loadProfileById(currentProfileId);
            if (loaded) {
              const config = buildConfiguration(loaded.profileDef);
              setConfig(config, loaded.styleGroups);
              setCurrentKeyboardId(loaded.profileDef.keyboardId);
              showToast('✓ ' + strings.alerts.editCancelled);
            } else {
              // Built-in profile not saved yet — reload from template
              const templateId = extractTemplateId(currentProfileId);
              const template = templateId ? getBuiltInProfileTemplate(templateId) : null;
              if (template) {
                const langDef = LANGUAGES.find(l => l.id === currentLanguage);
                const firstKeyboardId = langDef?.keyboards[0]?.id || currentLanguage;
                const profileDef: SavedProfileDefinition = {
                  id: currentProfileId,
                  name: getLocalizedProfileName(templateId!, uiLanguage),
                  version: '1.0.0',
                  language: currentLanguage,
                  keyboardId: firstKeyboardId,
                  ...template.config,
                  groups: [],
                };
                const styleGroups = template.styleGroups.map((sg: any, index: number) => ({
                  ...sg,
                  id: `builtin_${templateId}_${index}`,
                }));
                const config = buildConfiguration(profileDef);
                setConfig(config, styleGroups);
                setCurrentKeyboardId(firstKeyboardId);
              } else {
                // Truly unsaved custom profile — factory defaults
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
                setCurrentKeyboardId(defaultKeyboardId);
              }
              showToast('✓ ' + strings.alerts.editCancelled);
            }
          }
        },
      ]
    );
  }, [currentProfileId, currentLanguage, currentProfileName, setConfig, setCurrentKeyboardId, showToast, LANGUAGES, uiLanguage, strings.alerts.discard, strings.alerts.discardChanges, strings.alerts.discardChangesMessage, strings.alerts.editCancelled, strings.common.cancel]);

  const handleClearConfig = useCallback(async () => {
    Alert.alert(
      strings.alerts.clearAll,
      strings.alerts.clearAllSettings,
      [
        { text: strings.common.cancel, style: 'cancel' },
        {
          text: strings.alerts.clearAll,
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await KeyboardPreferences.clearAll();
              if (result.success) {
                showToast('✓ ' + strings.alerts.clearAll);
              } else {
                showToast('✗ ' + strings.common.error);
              }
            } catch (error) {
              showToast('✗ ' + strings.common.error);
            }
          }
        },
      ]
    );
  }, [showToast, strings.alerts.clearAll, strings.alerts.clearAllSettings, strings.common.cancel, strings.common.error]);

  const handleDeleteProfile = useCallback(async (profileToDelete: ProfileOption) => {
    // Don't allow deleting the default profile
    if (profileToDelete.isBuiltIn) {
      Alert.alert(strings.alerts.cannotDelete, strings.alerts.cannotDeleteDefault);
      return;
    }

    // Different warning message if this is the active keyboard
    const message = profileToDelete.isSystemActive
      ? `${strings.alerts.deleteConfirm.replace('{{name}}', profileToDelete.name)}\n\n${strings.alerts.cannotDeleteActive}`
      : strings.alerts.deleteConfirm.replace('{{name}}', profileToDelete.name);

    Alert.alert(
      strings.alerts.deleteProfile,
      message,
      [
        { text: strings.common.cancel, style: 'cancel' },
        {
          text: strings.common.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              // If deleting the active profile, switch to default first
              if (profileToDelete.isSystemActive || profileToDelete.id === currentProfileId) {
                const defaultProfileId = getDefaultProfileId(currentLanguage);
                // Persist the default as the active profile
                try {
                  await onSetActiveForProfile(defaultProfileId);
                } catch (e) {
                  // Fallback: persist active profile key directly
                  const activeProfileKey = getActiveProfileKey(currentLanguage, appContext);
                  await KeyboardPreferences.setProfile(defaultProfileId, activeProfileKey);
                }
                const loaded = await loadProfileById(defaultProfileId);
                if (loaded) {
                  const config = buildConfiguration(loaded.profileDef);
                  setConfig(config, loaded.styleGroups);
                  const delTemplateId = extractTemplateId(defaultProfileId);
                  const delDisplayName = delTemplateId ? getLocalizedProfileName(delTemplateId, uiLanguage) : loaded.profileDef.name;
                  setCurrentProfileName(delDisplayName);
                  setCurrentProfileId(defaultProfileId);
                  setCurrentKeyboardId(loaded.profileDef.keyboardId);
                  onProfileChange(defaultProfileId, delDisplayName, currentLanguage, loaded.profileDef.keyboardId);
                } else {
                  // Built-in profile not yet saved — just persist the active key
                  const activeProfileKey = getActiveProfileKey(currentLanguage, appContext);
                  await KeyboardPreferences.setProfile(defaultProfileId, activeProfileKey);
                  const delTemplateId = extractTemplateId(defaultProfileId);
                  const delDisplayName = delTemplateId ? getLocalizedProfileName(delTemplateId, uiLanguage) : strings.common.default;
                  setCurrentProfileName(delDisplayName);
                  setCurrentProfileId(defaultProfileId);
                  onProfileChange(defaultProfileId, delDisplayName, currentLanguage, currentKeyboardId);
                }
              }

              await onDelete(profileToDelete.id, profileToDelete.name);
              showToast(`✓ ${strings.alerts.deleted} "${profileToDelete.name}"`);
              await loadProfilesList();
            } catch (error) {
              showToast('✗ ' + strings.alerts.failedToDeleteProfile);
            }
          }
        },
      ]
    );
  }, [currentProfileId, currentLanguage, currentKeyboardId, appContext, onDelete, onSetActiveForProfile, showToast, loadProfilesList, setConfig, onProfileChange, strings]);

  const handleOpenCloneModal = useCallback((profile: ProfileOption) => {
    const openModal = () => {
      setProfileToClone(profile);
      setCloneName(`${strings.editor.copyOf} ${profile.name}`);
      setShowProfilePicker(false);
      setShowCloneModal(true);
    };

    if (state.isDirty) {
      Alert.alert(
        strings.alerts.unsavedChanges,
        strings.alerts.unsavedChangesMessage,
        [
          { text: strings.common.cancel, style: 'cancel' },
          {
            text: strings.alerts.discard,
            style: 'destructive',
            onPress: async () => {
              const current = profiles.find(p => p.id === currentProfileId);
              if (current) await loadProfileInternal(current);
              openModal();
            },
          },
          {
            text: strings.alerts.saveFirst,
            onPress: async () => {
              await handleSave();
              openModal();
            },
          },
        ]
      );
      return;
    }

    openModal();
  }, [state.isDirty, strings, handleSave, profiles, currentProfileId, loadProfileInternal]);

  const handleCloneProfile = useCallback(async () => {
    if (!cloneName.trim() || !profileToClone) {
      Alert.alert(strings.common.error, strings.alerts.enterProfileName);
      return;
    }

    setShowCloneModal(false);
    const newName = cloneName.trim();
    const newProfileId = `custom_${Date.now()}`;

    try {
      let profileDef: any;
      let styleGroups: any[] = [];

      const saved = await loadProfileById(profileToClone.id);
      if (saved) {
        profileDef = { ...saved.profileDef, id: newProfileId, name: newName };
        styleGroups = saved.styleGroups;
      } else if (profileToClone.isBuiltIn) {
        const templateId = extractTemplateId(profileToClone.id);
        const template = templateId ? getBuiltInProfileTemplate(templateId) : undefined;
        if (template) {
          profileDef = {
            id: newProfileId,
            name: newName,
            version: '1.0.0',
            language: profileToClone.language,
            keyboardId: profileToClone.keyboardId,
            ...template.config,
            groups: [],
          };
          const createdAt = new Date().toISOString();
          styleGroups = template.styleGroups.map((sg: any, index: number) => ({
            ...sg,
            id: `builtin_${templateId}_${index}`,
            createdAt,
          }));
        } else {
          profileDef = createFactoryDefaultProfile(
            newProfileId,
            newName,
            profileToClone.language,
            profileToClone.keyboardId
          );
        }
      } else {
        showToast('✗ ' + strings.alerts.failedToSaveProfile);
        return;
      }

      await KeyboardPreferences.setProfile(JSON.stringify(profileDef), `profile_def_${newProfileId}`);
      await KeyboardPreferences.setProfile(JSON.stringify(styleGroups), `${newProfileId}_styleGroups`);

      let savedList: { name: string; key: string; language: string; keyboardId: string }[] = [];
      try {
        const savedListJson = await KeyboardPreferences.getProfile('saved_list');
        if (savedListJson) savedList = JSON.parse(savedListJson);
      } catch { /* ignore */ }
      savedList.push({
        name: newName,
        key: newProfileId,
        language: profileToClone.language,
        keyboardId: profileToClone.keyboardId,
      });
      await KeyboardPreferences.setProfile(JSON.stringify(savedList), 'saved_list');

      await loadProfilesList();
      await loadProfileInternal({
        id: newProfileId,
        name: newName,
        language: profileToClone.language,
        keyboardId: profileToClone.keyboardId,
        isBuiltIn: false,
      });

      dispatch({ type: 'MARK_SAVED' });
      setShowProfilePicker(false);
      setCloneName('');
      setProfileToClone(null);
      showToast(`✓ ${strings.alerts.profileSaved.replace('!', '')} "${newName}"`);
    } catch {
      showToast('✗ ' + strings.alerts.failedToSaveProfile);
    }
  }, [cloneName, profileToClone, strings, showToast, loadProfilesList, loadProfileInternal, dispatch]);

  const handleRenameProfile = useCallback((profileToRename: ProfileOption) => {
    if (profileToRename.isBuiltIn) return;

    Alert.prompt(
      strings.alerts.renameProfile,
      strings.alerts.renamePrompt.replace('{{name}}', profileToRename.name),
      async (newName: string) => {
        const trimmed = newName.trim();
        if (!trimmed) return;

        try {
          // Update saved_list
          let savedList: { name: string; key: string; language: string; keyboardId: string }[] = [];
          try {
            const savedListJson = await KeyboardPreferences.getProfile('saved_list');
            if (savedListJson) {
              savedList = JSON.parse(savedListJson);
            }
          } catch { /* ignore */ }

          const idx = savedList.findIndex(p => p.key === profileToRename.id);
          if (idx >= 0) {
            savedList[idx].name = trimmed;
            await KeyboardPreferences.setProfile(JSON.stringify(savedList), 'saved_list');
          }

          // Update profile_def
          try {
            const defJson = await KeyboardPreferences.getProfile(`profile_def_${profileToRename.id}`);
            if (defJson) {
              const def = JSON.parse(defJson);
              def.name = trimmed;
              await KeyboardPreferences.setProfile(JSON.stringify(def), `profile_def_${profileToRename.id}`);
            }
          } catch { /* ignore */ }

          // If renaming the currently loaded profile, update local state
          if (profileToRename.id === currentProfileId) {
            setCurrentProfileName(trimmed);
            onProfileChange(currentProfileId, trimmed, currentLanguage, currentKeyboardId);
          }

          await loadProfilesList();
          showToast(`✓ "${trimmed}"`);
        } catch {
          showToast('✗ ' + strings.common.error);
        }
      },
      'plain-text',
      profileToRename.name,
    );
  }, [currentProfileId, currentLanguage, currentKeyboardId, onProfileChange, showToast, loadProfilesList, strings]);

  const handleDuplicate = useCallback(async () => {
    if (!duplicateName.trim()) {
      Alert.alert(strings.common.error, strings.alerts.enterProfileName);
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

      showToast(`✓ ${strings.alerts.profileSaved} "${newName}"`);
      await loadProfilesList();
      setDuplicateName('');
    } catch (error) {
      showToast('✗ ' + strings.alerts.failedToSaveProfile);
    }
  }, [duplicateName, state.config, state.styleGroups, currentLanguage, currentKeyboardId, setConfig, onProfileChange, dispatch, showToast, loadProfilesList, strings.alerts.enterProfileName, strings.alerts.failedToSaveProfile, strings.alerts.profileSaved, strings.common.error]);

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
      showToast(`✓ ${strings.alerts.profileSaved} "${name}"`);
      await loadProfilesList();
      return true;
    } catch (error) {
      showToast('✗ ' + strings.alerts.failedToSaveProfile);
      return false;
    }
  }, [onCreateNew, showToast, loadProfilesList, strings.alerts.failedToSaveProfile, strings.alerts.profileSaved]);

  const handleSetActiveForProfile = useCallback(async (profile: ProfileOption) => {
    try {
      await onSetActiveForProfile(profile.id);
      showToast(`✓ ${strings.status.switchedTo} "${profile.name}"`);
      await loadProfilesList();
    } catch (error) {
      console.error('Failed to set active profile:', error);
      showToast('✗ ' + strings.alerts.failedToSwitchProfile);
    }
  }, [onSetActiveForProfile, showToast, loadProfilesList, strings.alerts.failedToSwitchProfile, strings.status.switchedTo]);

  const handleExportProfile = async (profileId: string, profileName: string) => {
    try {
      const zipPath = await exportProfile(profileId, profileName);
      await Share.open({
        url: Platform.OS === 'android' ? `file://${zipPath}` : zipPath,
        type: 'application/zip',
      });
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        console.warn('Export failed:', error);
        Alert.alert(strings.common.error, strings.importExport.importFailed);
      }
    }
  };

  const handleBackupAll = async () => {
    try {
      const zipPath = await exportAll();
      await Share.open({
        url: Platform.OS === 'android' ? `file://${zipPath}` : zipPath,
        type: 'application/zip',
      });
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        console.warn('Backup all failed:', error);
        if ((error as Error)?.message?.includes('No profiles')) {
          Alert.alert(strings.common.error, strings.importExport.noProfilesToExport);
        } else {
          Alert.alert(strings.common.error, strings.importExport.importFailed);
        }
      }
    }
  };

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

  // Headless mode: only render toolbox + modals, no header/canvas/profile row
  if (headless) {
    return (
      <View style={{ flex: 1, direction: isRTL ? "rtl" : "ltr" }}>
        {/* Toast Notification */}
        {toastMessage && (
          <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
            <Text allowFontScaling={false} style={styles.toastText}>{toastMessage}</Text>
          </Animated.View>
        )}

        {/* Keyboard Setup Status — IssieBoard only, not in headless (parent renders it) */}
        {appContext !== 'issievoice' && !headless && (
          <SetupStatusStrip isAdded={setupStatus.isAdded} languageName={currentLanguageDef.name} />
        )}

        {/* Settings panel in rounded raised container */}
        <View style={styles.headlessPanel}>
          {tabDescription && activeTab !== 'keys-groups' ? (
            <View style={styles.tabDescriptionBanner}>
              <Text allowFontScaling={false} style={styles.tabDescriptionText}>{tabDescription}</Text>
            </View>
          ) : null}
          <Toolbox
            keyboardVariants={currentLanguageDef.keyboards}
            currentKeyboardId={currentKeyboardId}
            onKeyboardVariantChange={handleKeyboardChange}
            profileName={currentProfileName}
            section={activeTab}
            appContext={appContext}
            onSpeakButtonInKeyboardChange={appContext === 'issievoice' ? setSpeakButtonInKeyboard : undefined}
            selectedLanguages={selectedLanguages}
            speakButtonInKeyboard={speakButtonInKeyboard}
            tabDescription={activeTab === 'keys-groups' ? tabDescription : undefined}
          />
        </View>

        {/* Keyboard preview in rounded raised container */}
        {(() => {
          const isPhoneLandscape = windowWidth > windowHeight && windowWidth < 900;
          const previewH = windowWidth > windowHeight
            ? (isPhoneLandscape ? windowHeight * 0.25 : windowHeight / 3)
            : windowHeight / 4;
          return (
            <View style={[styles.headlessPreview, { backgroundColor: (state.config.backgroundColor && state.config.backgroundColor !== 'default') ? state.config.backgroundColor : '#CBCFD8' }]}>
              <View style={styles.headlessPreviewInner}>
                <InteractiveCanvas onTestInput={handleTestInput} height={previewH} hideHeader hideSettingsKey={appContext === 'issievoice'} hideCloseKey={appContext === 'issievoice' || appContext === 'issiecalc'} hideGlobeButton={appContext === 'issievoice' || appContext === 'issiecalc'} activeTab={activeTab} speakButtonInKeyboard={speakButtonInKeyboard} selectedLanguages={selectedLanguages} appContext={appContext} />
              </View>
            </View>
          );
        })()}

        {/* Profile Picker Modal */}
        <Modal
          visible={showProfilePicker}
          transparent
          animationType="fade"
          supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
          onRequestClose={() => setShowProfilePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setShowProfilePicker(false)}
            />
            <View style={[styles.profilePickerContainer, windowWidth < 700 && styles.profilePickerContainerSmall]}>
              <View style={styles.profilePickerHeader}>
                <TouchableOpacity onPress={handleTitleTap} activeOpacity={1}>
                  <Text allowFontScaling={false} style={styles.profilePickerTitle}>
                    {`${strings.editor.myKeyboards} - ${currentLanguageDef.name}`}
                  </Text>
                </TouchableOpacity>
                <View style={styles.profilePickerHeaderActions}>
                  <TouchableOpacity
                    style={styles.profilePickerNewButton}
                    onPress={() => {
                      setShowProfilePicker(false);
                      setShowAddProfileModal(true);
                    }}
                    activeOpacity={0.7}>
                    <MyIcon info={{ name: 'add', type: 'Ionicons', color: '#3B82F6', size: 24 }} />
                    <Text allowFontScaling={false} style={styles.profilePickerNewButtonText}>{strings.editor.newProfile}</Text>
                  </TouchableOpacity>
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
                  {strings.alerts.profileNotFound} - {currentLanguageDef.name}
                </Text>
              ) : (
                <FlatList
                  data={profiles}
                  keyExtractor={item => item.id}
                  style={{ flexShrink: 1 }}
                  contentContainerStyle={styles.profilePillList}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.profilePill,
                        item.id === currentProfileId && styles.profilePillActive,
                      ]}
                      onPress={() => {
                        handleSetActiveForProfile(item);
                        handleLoadProfile(item);
                      }}
                      activeOpacity={0.7}
                    >
                      {item.isBuiltIn && (
                        <MyIcon info={{ name: 'keyboard-outline', type: 'MDI', color: item.id === currentProfileId ? '#FFFFFF' : '#6B7280', size: 24 }} />
                      )}
                      <Text allowFontScaling={false} style={[
                        styles.profilePillText,
                        item.id === currentProfileId && styles.profilePillTextActive,
                      ]}>
                        {item.name}
                      </Text>
                      {item.isBuiltIn && (
                        <View style={[styles.profilePillBadge, item.id === currentProfileId && styles.profilePillBadgeActive]}>
                          <Text allowFontScaling={false} style={[styles.profilePillBadgeText, item.id === currentProfileId && styles.profilePillBadgeTextActive]}>{strings.editor.builtIn}</Text>
                        </View>
                      )}
                      {!item.isBuiltIn && (
                        <TouchableOpacity
                          style={styles.profilePillExport}
                          onPress={() => {
                            handleExportProfile(item.id, item.name);
                          }}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <MyIcon info={{ name: 'share-outline', type: 'Ionicons', color: item.id === currentProfileId ? '#FFFFFF' : '#6B7280', size: 18 }} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.profilePillClone}
                        onPress={() => { handleOpenCloneModal(item); }}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <MyIcon info={{ name: 'copy-outline', type: 'Ionicons', color: item.id === currentProfileId ? '#FFFFFF' : '#6B7280', size: 18 }} />
                      </TouchableOpacity>
                      {!item.isBuiltIn && (
                        <TouchableOpacity
                          style={styles.profilePillDelete}
                          onPress={() => {
                            handleDeleteProfile(item);
                          }}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <MyIcon info={{ name: 'trash-outline', type: 'Ionicons', color: item.id === currentProfileId ? '#FFFFFF' : '#EF4444', size: 18 }} />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  )}
                />
              )}
              <TouchableOpacity
                style={styles.backupAllButton}
                onPress={handleBackupAll}
                activeOpacity={0.7}
              >
                <MyIcon info={{ name: 'cloud-download-outline', type: 'Ionicons', color: '#3B82F6', size: 20 }} />
                <Text allowFontScaling={false} style={styles.backupAllText}>{strings.importExport.backupAll}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Add Profile Modal */}
        <AddProfileModal
          visible={showAddProfileModal}
          onClose={() => setShowAddProfileModal(false)}
          onCreate={(name, lang, kbId) => handleCreateNewProfile(name, lang as LanguageId, kbId)}
          initialLanguage={currentLanguage}
          initialKeyboardId={currentKeyboardId}
          existingNames={profiles.map(p => p.name)}
        />

        {/* Save As Modal */}
        <SaveAsModal
          visible={showSaveAsModal}
          onClose={() => { afterSaveAsRef.current = null; setShowSaveAsModal(false); }}
          onSaveAs={handleSaveAs}
          originalName={currentProfileName}
          existingNames={profiles.map(p => p.name)}
        />

        {/* Clone Keyboard Modal — shared between headless and full mode */}
        <Modal
          visible={showCloneModal}
          transparent
          animationType="fade"
          supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
          onRequestClose={() => { setShowCloneModal(false); setCloneName(''); setProfileToClone(null); }}
        >
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.duplicateModalContainer}>
              <Text allowFontScaling={false} style={styles.duplicateModalTitle}>{strings.editor.cloneKeyboard}</Text>
              <Text allowFontScaling={false} style={styles.duplicateModalSubtitle}>
                {strings.editor.cloneKeyboardSubtitle}: "{profileToClone?.name}"
              </Text>
              <TextInput
                style={styles.duplicateInput}
                placeholder={strings.editor.newProfilePlaceholder}
                value={cloneName}
                onChangeText={setCloneName}
                autoFocus
              />
              <View style={styles.duplicateModalButtons}>
                <TouchableOpacity
                  style={styles.duplicateCancelButton}
                  onPress={() => { setShowCloneModal(false); setCloneName(''); setProfileToClone(null); }}
                >
                  <Text allowFontScaling={false} style={styles.duplicateCancelText}>{strings.common.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.duplicateConfirmButton}
                  onPress={handleCloneProfile}
                >
                  <Text allowFontScaling={false} style={styles.duplicateConfirmText}>{strings.common.create}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { direction: isRTL ? "rtl" : "ltr" }]}>
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
        onClose={() => { afterSaveAsRef.current = null; setShowSaveAsModal(false); }}
        onSaveAs={handleSaveAs}
        originalName={currentProfileName}
        existingNames={profiles.map(p => p.name)}
      />

      {/* Clone Keyboard Modal */}
      <Modal
        visible={showCloneModal}
        transparent
        animationType="fade"
        supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
        onRequestClose={() => { setShowCloneModal(false); setCloneName(''); setProfileToClone(null); }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.duplicateModalContainer}>
            <Text allowFontScaling={false} style={styles.duplicateModalTitle}>{strings.editor.cloneKeyboard}</Text>
            <Text allowFontScaling={false} style={styles.duplicateModalSubtitle}>
              {strings.editor.cloneKeyboardSubtitle}: "{profileToClone?.name}"
            </Text>
            <TextInput
              style={styles.duplicateInput}
              placeholder={strings.editor.newProfilePlaceholder}
              value={cloneName}
              onChangeText={setCloneName}
              autoFocus
            />
            <View style={styles.duplicateModalButtons}>
              <TouchableOpacity
                style={styles.duplicateCancelButton}
                onPress={() => { setShowCloneModal(false); setCloneName(''); setProfileToClone(null); }}
              >
                <Text allowFontScaling={false} style={styles.duplicateCancelText}>{strings.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.duplicateConfirmButton}
                onPress={handleCloneProfile}
              >
                <Text allowFontScaling={false} style={styles.duplicateConfirmText}>{strings.common.create}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
            <Text allowFontScaling={false} style={styles.duplicateModalTitle}>{strings.editor.duplicateProfile}</Text>
            <Text allowFontScaling={false} style={styles.duplicateModalSubtitle}>
              {strings.editor.duplicateProfile}: "{currentProfileName}"
            </Text>
            <TextInput
              style={styles.duplicateInput}
              placeholder={strings.editor.newProfilePlaceholder}
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
                <Text allowFontScaling={false} style={styles.duplicateCancelText}>{strings.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.duplicateConfirmButton}
                onPress={handleDuplicate}
              >
                <Text allowFontScaling={false} style={styles.duplicateConfirmText}>{strings.common.create}</Text>
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
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowProfilePicker(false)}
          />
          <View style={[styles.profilePickerContainer, windowWidth < 700 && styles.profilePickerContainerSmall]}>
            <View style={styles.profilePickerHeader}>
              <Text allowFontScaling={false} style={styles.profilePickerTitle}>
                {appContext === 'issievoice'
                  ? `${strings.editor.myKeyboards} - ${currentLanguageDef.name}`
                  : `${strings.editor.myKeyboards} - ${currentLanguageDef.name}`}
              </Text>
              <View style={styles.profilePickerHeaderActions}>
                <TouchableOpacity
                  style={styles.profilePickerNewButton}
                  onPress={() => {
                    setShowProfilePicker(false);
                    setShowAddProfileModal(true);
                  }}
                  activeOpacity={0.7}>
                  <MyIcon info={{ name: 'add', type: 'Ionicons', color: '#3B82F6', size: 18 }} />
                  <Text allowFontScaling={false} style={styles.profilePickerNewButtonText}>{strings.editor.newProfile}</Text>
                </TouchableOpacity>
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
                {strings.alerts.profileNotFound} - {currentLanguageDef.name}
              </Text>
            ) : (
              <FlatList
                data={profiles}
                keyExtractor={item => item.id}
                style={{ flexShrink: 1 }}
                contentContainerStyle={styles.profilePillList}
                renderItem={({ item }) => (
                  <View
                    style={[
                      styles.profilePill,
                      item.id === currentProfileId && styles.profilePillActive,
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.profilePillMain}
                      onPress={() => {
                        handleSetActiveForProfile(item);
                        handleLoadProfile(item);
                      }}
                      activeOpacity={0.7}
                    >
                      {item.isBuiltIn && (
                        <MyIcon info={{ name: 'keyboard-outline', type: 'MDI', color: item.id === currentProfileId ? '#FFFFFF' : '#6B7280', size: 16 }} />
                      )}
                      <Text allowFontScaling={false} style={[
                        styles.profilePillText,
                        item.id === currentProfileId && styles.profilePillTextActive,
                      ]}>
                        {item.name}
                      </Text>
                      {item.isBuiltIn && (
                        <View style={[styles.profilePillBadge, item.id === currentProfileId && styles.profilePillBadgeActive]}>
                          <Text allowFontScaling={false} style={[styles.profilePillBadgeText, item.id === currentProfileId && styles.profilePillBadgeTextActive]}>{strings.editor.builtIn}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    {!item.isBuiltIn && (
                      <View style={styles.profilePillActions}>
                        <ActionButton
                          label={strings.common.rename}
                          color="gray"
                          onPress={() => handleRenameProfile(item)}
                        />
                        <ActionButton
                          label={strings.common.delete}
                          color="red"
                          onPress={() => handleDeleteProfile(item)}
                        />
                      </View>
                    )}
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Language Selector - Matching mockup design */}
      <View style={[styles.languageBar, windowWidth < 700 && styles.languageBarSmall]}>
        <View style={[styles.languageBarTitle, windowWidth < 700 && styles.languageBarTitleSmall]}>
          <Text style={styles.languageBarIcon}>⌨️</Text>
          <Text allowFontScaling={false} style={styles.languageBarTitleText}>
            {windowWidth < 700
              ? strings.editor.settings
              : appContext === 'issievoice'
                ? `IssieVoice ${strings.editor.settings}`
                : `IssieBoard ${strings.editor.settings}`}
          </Text>
        </View>
        <View style={styles.languageTabs}>
          {appContext !== 'issiecalc' && LANGUAGES.map(lang => (
            <TouchableOpacity
              key={lang.id}
              style={[
                styles.languageTab,
                currentLanguage === lang.id && styles.languageTabActive,
              ]}
              onPress={() => handleLanguageTabPress(lang.id)}
              accessibilityLabel={
                setupStatus.isAdded === true && setupStatus.hasFullAccess !== true && currentLanguage === lang.id
                  ? `${lang.nativeName} - ${strings.setup.fullAccessTitle}`
                  : lang.nativeName
              }
            >
              <Text allowFontScaling={false} style={[
                styles.languageTabText,
                currentLanguage === lang.id && styles.languageTabTextActive,
              ]}>
                {lang.nativeName}
              </Text>
              {setupStatus.isAdded === true && setupStatus.hasFullAccess !== true && currentLanguage === lang.id && (
                <View style={styles.setupBadgeDot} />
              )}
            </TouchableOpacity>
          ))}
        </View>
        {/* About button */}
        <TouchableOpacity
          style={styles.aboutButton}
          onPress={() => setShowAbout(true)}
          accessibilityLabel="About"
        >
          <Text allowFontScaling={false} style={styles.aboutButtonText}>ℹ️</Text>
        </TouchableOpacity>
        {/* Classic View button - shown when onSwitchToClassic is provided */}
        {onSwitchToClassic && (
          <TouchableOpacity
            style={styles.classicViewButton}
            onPress={() => {
              if (state.isDirty) {
                Alert.alert(
                  strings.alerts.unsavedChanges,
                  strings.alerts.unsavedChangesMessage,
                  [
                    { text: strings.common.cancel, style: 'cancel' },
                    { text: strings.alerts.discard, style: 'destructive', onPress: onSwitchToClassic },
                    {
                      text: strings.common.save, onPress: async () => {
                        const currentProfile = profiles.find(p => p.id === currentProfileId);
                        if (currentProfile?.isBuiltIn) {
                          afterSaveAsRef.current = onSwitchToClassic;
                        }
                        await handleSave();
                        if (!currentProfile?.isBuiltIn) {
                          onSwitchToClassic();
                        }
                      }
                    },
                  ]
                );
              } else {
                onSwitchToClassic();
              }
            }}
          >
            <Text allowFontScaling={false} style={styles.classicViewButtonText}>{strings.editor.classicView}</Text>
          </TouchableOpacity>
        )}
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

      {/* Keyboard Setup Status */}
      {appContext !== 'issievoice' && (
        <SetupStatusStrip isAdded={setupStatus.isAdded} languageName={currentLanguageDef.name} />
      )}

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
                {strings.profiles.current}
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
                {strings.editor.myKeyboards}
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
                      {profiles.find(p => p.id === currentProfileId)?.isBuiltIn ? `${strings.editor.saveAs}...` : strings.common.save}
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
        <View style={[styles.canvasContainer]}>
          <InteractiveCanvas onTestInput={handleTestInput} height={windowHeight * .28} />
        </View>

        <View style={styles.toolboxContainer}>
          <Toolbox
            keyboardVariants={currentLanguageDef.keyboards}
            currentKeyboardId={currentKeyboardId}
            onKeyboardVariantChange={handleKeyboardChange}
            profileName={currentProfileName}
            selectedLanguages={selectedLanguages}
            speakButtonInKeyboard={speakButtonInKeyboard}
          />
        </View>
      </KeyboardAvoidingView>
      <AboutScreen
        visible={showAbout}
        appName={appContext === 'issievoice' ? 'IssieVoice' : 'IssieBoard'}
        onClose={() => setShowAbout(false)}
        paragraphs={appContext === 'issievoice' ? ISSIEVOICE_ABOUT : ISSIEBOARD_ABOUT}
      />
    </SafeAreaView>
  );
};

interface EditorScreenProps {
  profileId?: string;
  initialLanguage?: LanguageId;
  appContext?: AppContext;  // Which app is using the settings
  onBack?: () => void;       // Made optional for IssieVoice
  onClose?: () => void;      // Close callback for IssieVoice
  onSwitchToClassic?: () => void;  // Switch to classic editor view
  onStateChange?: (state: { language: LanguageId; profileName: string; isDirty: boolean }) => void;
  showProfilePickerRef?: React.MutableRefObject<(() => void) | null>;
  changeLanguageRef?: React.MutableRefObject<((lang: LanguageId) => void) | null>;
  headless?: boolean;
  activeTab?: string;
  saveRef?: React.MutableRefObject<(() => void) | null>;
  /** Ref to expose silent auto-save (background/quit) — handles built-in by saving as a copy */
  autoSaveRef?: React.MutableRefObject<(() => void) | null>;
  /** Ref to expose discard (restore to last saved state) to parent */
  discardRef?: React.MutableRefObject<(() => void) | null>;
  /** Description text shown at the top of the headless panel for the active tab */
  tabDescription?: string;
  /** Selected languages for IssieVoice language key injection */
  selectedLanguages?: string[];
}

export const EditorScreen: React.FC<EditorScreenProps> = ({
  profileId: propProfileId,
  initialLanguage: propInitialLanguage,
  appContext = 'issieboard',
  onBack,
  onClose,
  onSwitchToClassic,
  onStateChange,
  showProfilePickerRef,
  changeLanguageRef,
  headless,
  activeTab,
  tabDescription,
  saveRef,
  autoSaveRef,
  discardRef,
  selectedLanguages,
}) => {
  const { strings, isRTL, language: uiLanguage } = useLocalization();
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
        // IssieCalc: bypass language/profile system entirely
        if (appContext === 'issiecalc') {
          setCurrentLanguage('calc');
          setCurrentKeyboardId('calc');
          setCurrentProfileId('issiecalc-default');
          setProfileName('Calculator');
          const calcConfig = require('../../ios/IssieCalc/default_config.json');
          const savedJson = await KeyboardPreferences.getString('keyboardConfig_issiecalc_calc');
          if (savedJson) {
            try {
              const savedConfig = JSON.parse(savedJson);
              // Restore styleGroups from config.groups so GroupsPanel shows saved groups
              const restoredStyleGroups = (savedConfig.groups || [])
                .filter((g: any) => g.name && !g.name.startsWith('_'))
                .map((g: any, i: number) => ({
                  id: `calc_group_${i}_${g.name}`,
                  name: g.name,
                  members: g.items || [],
                  style: {
                    color: g.template?.color || '',
                    bgColor: g.template?.bgColor || '',
                    hidden: g.template?.hidden,
                    visibilityMode: g.template?.visibilityMode,
                  },
                  active: true,
                  createdAt: new Date().toISOString(),
                }));
              setInitialConfig(savedConfig);
              setInitialStyleGroups(restoredStyleGroups);
              setLoading(false);
              return;
            } catch {}
          }
          setInitialConfig(calcConfig);
          setInitialStyleGroups([]);
          setLoading(false);
          return;
        }
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
        const langDef = LANGUAGES_STATIC.find(l => l.id === savedLanguage) || LANGUAGES_STATIC[0];
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
          const initTemplateId = extractTemplateId(effectiveActiveProfile);
          setProfileName(initTemplateId ? getLocalizedProfileName(initTemplateId, uiLanguage) : loaded.profileDef.name);
          setCurrentKeyboardId(loaded.profileDef.keyboardId);
        } else {
          console.log(`📱 No active profile ${effectiveActiveProfile} found, using base keyboard`);
          // Create the profile definition (won't save until user saves)
          const profileDef = createFactoryDefaultProfile(
            defaultProfileId,
            strings.common.default,
            savedLanguage,
            defaultKeyboardId
          );

          const config = buildConfiguration(profileDef);
          setInitialConfig(config);
          setInitialStyleGroups([]);
          setCurrentProfileId(defaultProfileId);
          setProfileName(getLocalizedProfileName('default', uiLanguage));
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
        setProfileName(getLocalizedProfileName('default', uiLanguage));
        setCurrentLanguage(lang);
        setCurrentKeyboardId(lang);
      } finally {
        setLoading(false);
      }
    };

    loadInitial();
  }, [propProfileId, propInitialLanguage, appContext, strings.common.default]);

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

    // For issiecalc, groups live in config.groups (not styleGroups) — preserve them
    const resolvedGroups = groupConfigs.length > 0 ? groupConfigs : (config.groups || []);

    const configWithGroups: KeyboardConfig = {
      ...config,
      groups: resolvedGroups,
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
        fontWeight: 'regular',
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
        const langDef = LANGUAGES_STATIC.find(l => l.id === currentLanguage);
        const firstKeyboardId = langDef?.keyboards[0]?.id || currentLanguage;

        const template = getBuiltInProfileTemplate(templateId);
        if (template) {
          const profileDef: SavedProfileDefinition = {
            id: profileIdToActivate,
            name: getLocalizedProfileName(templateId, uiLanguage),
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
            strings.common.default,
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
  }, [currentLanguage, appContext, strings.common.default]);

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
        <Text allowFontScaling={false} style={styles.loadingText}>{strings.common.loading}</Text>
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
        onSwitchToClassic={onSwitchToClassic}
        showProfilePickerRef={showProfilePickerRef}
        headless={headless}
        activeTab={activeTab}
        tabDescription={tabDescription}
        saveRef={saveRef}
        autoSaveRef={autoSaveRef}
        discardRef={discardRef}
        changeLanguageRef={changeLanguageRef}
        onStateChange={onStateChange}
        selectedLanguages={selectedLanguages}
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
  headlessPanel: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    ...cardShadow,
    overflow: 'hidden',
  },
  tabDescriptionBanner: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  tabDescriptionText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  headlessPreview: {
    borderRadius: 16,
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 12,
    ...cardShadow,
  },
  headlessPreviewInner: {
    margin: 4,
    borderRadius: 12,
    overflow: 'hidden',
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
  languageBarSmall: {
    flexWrap: 'wrap',
    gap: 8,
  },
  languageBarTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  languageBarTitleSmall: {
    width: '100%',
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
  setupBadgeDot: {
    position: 'absolute' as const,
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F59E0B',
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
    maxHeight: '70%',
    padding: 16,
    flexShrink: 1,
  },
  profilePickerContainerSmall: {
    width: '95%',
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
  profilePillList: {
    padding: 8,
    gap: 6,
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    gap: 8,
  },
  profilePillActive: {
    backgroundColor: '#3B82F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  profilePillMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profilePillText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
    flex: 1,
    textAlign: 'left'
  },
  profilePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  profilePillBadge: {
    backgroundColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  profilePillBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  profilePillBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  profilePillBadgeTextActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  profilePillActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profilePillExport: {
    marginLeft: 'auto',
    padding: 4,
  },
  profilePillClone: {
    padding: 4,
  },
  profilePillDelete: {
    padding: 4,
  },
  backupAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 8,
  },
  backupAllText: {
    color: '#3B82F6',
    fontSize: 15,
    fontWeight: '600',
  },
  toast: {
    position: 'absolute',
    top: 60,
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
    gap: 8,
  },
  profilePickerNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  profilePickerNewButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
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
    flexWrap: 'wrap',
    gap: 6,
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
    minWidth: 80,
    gap: 6,
  },
  classicViewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#78909C',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  aboutButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aboutButtonText: {
    fontSize: 22,
  },
  classicViewButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
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