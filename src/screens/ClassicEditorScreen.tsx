import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import KeyboardPreferences from '../native/KeyboardPreferences';
import { KeyboardConfig, StyleGroup } from '../../types';
import { extractClassicState, ClassicState } from './classic/classicProfileBridge';
import ClassicSectionsList, { SettingId } from './classic/ClassicSectionsList';
import ClassicDetailView from './classic/ClassicDetailView';
import ClassicColorPicker from './classic/ClassicColorPicker';

// Import keyboard files
import enKeyboard from '../../keyboards/en.json';
import heKeyboard from '../../keyboards/he.json';
import heOrderedKeyboard from '../../keyboards/he_ordered.json';
import arKeyboard from '../../keyboards/ar.json';

import { buildKeyboardConfig, SourceKeyboard } from '../utils/keyboardConfigMerger';

// Import predefined rules for preset member lookup
import enRules from '../../assets/predefined-rules/en.json';
import heRules from '../../assets/predefined-rules/he.json';
import arRules from '../../assets/predefined-rules/ar.json';
import { BUILT_IN_PROFILES, isBuiltInProfileId, extractTemplateId, getBuiltInProfileTemplate } from '../data/builtInProfiles';
import { SafeAreaView } from 'react-native-safe-area-context';

const PREDEFINED_RULES: Record<string, any> = {
  'en': enRules,
  'he': heRules,
  'ar': arRules,
};

/** Look up a preset's members and name from predefined rules for the given language */
const getPresetInfo = (presetId: string, language: LanguageId): { name: string; members: string[] } | null => {
  const rules = PREDEFINED_RULES[language]?.rules;
  if (!rules) return null;
  const rule = rules.find((r: any) => r.id === presetId);
  if (!rule) return null;
  return { name: rule.name, members: rule.members };
};

type LanguageId = 'he' | 'en' | 'ar';

const KEYBOARDS: Record<string, any> = {
  'en': enKeyboard,
  'he': heKeyboard,
  'he_ordered': heOrderedKeyboard,
  'ar': arKeyboard,
};

interface SavedProfileDefinition {
  id: string;
  name: string;
  version: string;
  language: LanguageId;
  keyboardId: string;
  backgroundColor?: string;
  keysBgColor?: string;
  textColor?: string;
  groups?: any[];
  diacritics?: Record<string, any>;
  wordSuggestionsEnabled?: boolean;
  autoCorrectEnabled?: boolean;
  fontName?: string;
  fontSize?: number;
  fontWeight?: string;
  keyGap?: number;
  keyHeight?: number;
  settingsButtonEnabled?: boolean;
}

// Convert StyleGroups to group config format for keyboard config
// showOnly groups are placed first so that later styling groups can override their template
const convertStyleGroupsToGroupConfig = (
  styleGroups: StyleGroup[]
) => {
  const active = styleGroups.filter(group => group.active !== false);
  // Sort: showOnly groups first, everything else after (preserving original order within each bucket)
  const showOnlyGroups = active.filter(g => g.style.visibilityMode === 'showOnly');
  const otherGroups = active.filter(g => g.style.visibilityMode !== 'showOnly');
  const sorted = [...showOnlyGroups, ...otherGroups];
  return sorted.map(group => ({
    name: group.name,
    items: group.members,
    template: {
      color: group.style.color || '',
      bgColor: group.style.bgColor || '',
      hidden: group.style.hidden || group.style.visibilityMode === 'hide',
      visibilityMode: group.style.visibilityMode,
    },
  }));
};

const getActiveProfileKey = (language: LanguageId): string => {
  return `active_profile_issieboard_${language}`;
};

const getDefaultProfileId = (language: LanguageId): string => `${language}-default`;

const loadProfileById = async (profileId: string): Promise<{
  profileDef: SavedProfileDefinition;
  styleGroups: StyleGroup[];
} | null> => {
  try {
    const profileDefJson = await KeyboardPreferences.getProfile(`profile_def_${profileId}`);
    if (!profileDefJson) return null;
    const profileDef = JSON.parse(profileDefJson) as SavedProfileDefinition;
    let styleGroups: StyleGroup[] = [];
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

const buildConfiguration = (profile: SavedProfileDefinition): KeyboardConfig => {
  const keyboard = KEYBOARDS[profile.keyboardId];
  if (!keyboard) {
    throw new Error(`Keyboard "${profile.keyboardId}" not found`);
  }
  const bgColor = profile.backgroundColor !== undefined ? profile.backgroundColor : 'default';
  const baseConfig = buildKeyboardConfig(keyboard as SourceKeyboard, profile.language);

  const diacriticsSettings: Record<string, any> = {};
  if (profile.diacritics) {
    for (const [keyboardId, settings] of Object.entries(profile.diacritics)) {
      diacriticsSettings[keyboardId] = {
        ...settings,
        simpleMode: settings.simpleMode ?? true,
      };
    }
  }
  if ((keyboard as any).diacritics && !diacriticsSettings[profile.keyboardId]) {
    diacriticsSettings[profile.keyboardId] = { simpleMode: true };
  }

  const config: any = {
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
    fontWeight: profile.fontWeight,
    keyGap: profile.keyGap,
    settingsButtonEnabled: profile.settingsButtonEnabled,
  };

  if (profile.keysBgColor !== undefined) config.keysBgColor = profile.keysBgColor;
  if (profile.textColor !== undefined) config.textColor = profile.textColor;
  if ((keyboard as any).diacritics) {
    config.allDiacritics[profile.keyboardId] = (keyboard as any).diacritics;
    config.diacritics = (keyboard as any).diacritics;
  }

  return config as KeyboardConfig;
};

const saveKeyboardConfig = async (config: any, language: LanguageId): Promise<void> => {
  const configJSON = JSON.stringify(config);
  const result = await KeyboardPreferences.setKeyboardConfigForLanguage(configJSON, language);
  if (!result.success) {
    console.error('Failed to save keyboard config', result.error);
  }
};

interface ClassicEditorScreenProps {
  initialLanguage?: LanguageId;
  onSwitchToAdvanced: () => void;
}

export const ClassicEditorScreen: React.FC<ClassicEditorScreenProps> = ({
  initialLanguage,
  onSwitchToAdvanced,
}) => {
  const [loading, setLoading] = useState(true);
  const [currentLanguage, setCurrentLanguage] = useState<LanguageId>(initialLanguage || 'he');
  const [currentProfileId, setCurrentProfileId] = useState<string>('');
  const [currentKeyboardId, setCurrentKeyboardId] = useState<string>('he');
  const [profileDef, setProfileDef] = useState<SavedProfileDefinition | null>(null);
  const [styleGroups, setStyleGroups] = useState<StyleGroup[]>([]);
  const [classicState, setClassicState] = useState<ClassicState | null>(null);
  const [configJson, setConfigJson] = useState<string>('');

  // Navigation state: null = sections list, SettingId = detail view for that setting
  const [activeSetting, setActiveSetting] = useState<SettingId | null>(null);

  // Saved profiles for the profile picker
  const [savedProfiles, setSavedProfiles] = useState<{ id: string; name: string; isBuiltIn: boolean; isActive: boolean }[]>([]);

  // Load saved profiles list
  const loadSavedProfiles = useCallback(async () => {
    const profiles: { id: string; name: string; isBuiltIn: boolean; isActive: boolean }[] = [];
    const activeProfileKey = getActiveProfileKey(currentLanguage);
    const activeId = await KeyboardPreferences.getProfile(activeProfileKey) || getDefaultProfileId(currentLanguage);

    // Built-in profiles
    for (const template of BUILT_IN_PROFILES) {
      const profileId = `${currentLanguage}-${template.id}`;
      profiles.push({
        id: profileId,
        name: template.name,
        isBuiltIn: true,
        isActive: profileId === activeId,
      });
    }

    // Custom saved profiles
    try {
      const savedListJson = await KeyboardPreferences.getProfile('saved_list');
      if (savedListJson) {
        const savedList = JSON.parse(savedListJson);
        for (const saved of savedList) {
          if (saved.language === currentLanguage && !isBuiltInProfileId(saved.key)) {
            profiles.push({
              id: saved.key,
              name: saved.name,
              isBuiltIn: false,
              isActive: saved.key === activeId,
            });
          }
        }
      }
    } catch { /* ignore */ }

    setSavedProfiles(profiles);
  }, [currentLanguage]);

  // Handle profile selection from the picker
  const handleProfileSelect = useCallback(async (profileId: string) => {
    let newProfileDef: SavedProfileDefinition | null = null;
    let newStyleGroups: StyleGroup[] = [];

    // Try loading from saved data first
    const loaded = await loadProfileById(profileId);
    if (loaded) {
      newProfileDef = loaded.profileDef;
      newStyleGroups = loaded.styleGroups;
    } else {
      // Check if it's a built-in profile template
      const templateId = extractTemplateId(profileId);
      const template = templateId ? getBuiltInProfileTemplate(templateId) : undefined;
      if (template) {
        const keyboardId = currentLanguage === 'he' ? 'he' : currentLanguage;
        newProfileDef = {
          id: profileId,
          name: template.name,
          version: '1.0.0',
          language: currentLanguage,
          keyboardId,
          ...template.config,
        };
        const createdAt = new Date().toISOString();
        newStyleGroups = template.styleGroups.map((sg, index) => ({
          ...sg,
          id: `builtin_${templateId}_${index}`,
          createdAt,
        }));
      }
    }

    if (newProfileDef) {
      setProfileDef(newProfileDef);
      setStyleGroups(newStyleGroups);
      setCurrentProfileId(profileId);
      setCurrentKeyboardId(newProfileDef.keyboardId);
      setClassicState(extractClassicState(newStyleGroups, currentLanguage));

      const config = buildConfiguration(newProfileDef);
      const groupConfigs = convertStyleGroupsToGroupConfig(newStyleGroups);
      const configWithGroups = { ...config, groups: groupConfigs };
      setConfigJson(JSON.stringify(configWithGroups));

      // Save the profile so it persists
      await KeyboardPreferences.setProfile(
        JSON.stringify(newProfileDef),
        `profile_def_${profileId}`
      );
      await KeyboardPreferences.setProfile(
        JSON.stringify(newStyleGroups),
        `${profileId}_styleGroups`
      );

      // Set as active and push config to keyboard
      const activeProfileKey = getActiveProfileKey(currentLanguage);
      await KeyboardPreferences.setProfile(profileId, activeProfileKey);
      await saveKeyboardConfig(configWithGroups, currentLanguage);

      // Refresh profile list to update active indicator
      await loadSavedProfiles();
    }
    setActiveSetting(null);
  }, [currentLanguage, loadSavedProfiles]);

  // Load profile for a language
  const loadProfile = useCallback(async (language: LanguageId) => {
    setLoading(true);
    try {
      const activeProfileKey = getActiveProfileKey(language);
      const activeProfileId = await KeyboardPreferences.getProfile(activeProfileKey);
      const effectiveProfileId = activeProfileId || getDefaultProfileId(language);

      const loaded = await loadProfileById(effectiveProfileId);
      if (loaded) {
        setProfileDef(loaded.profileDef);
        setStyleGroups(loaded.styleGroups);
        setCurrentProfileId(effectiveProfileId);
        setCurrentKeyboardId(loaded.profileDef.keyboardId);
        setClassicState(extractClassicState(loaded.styleGroups, language));

        // Build config JSON for preview
        const config = buildConfiguration(loaded.profileDef);
        const groupConfigs = convertStyleGroupsToGroupConfig(loaded.styleGroups);
        const configWithGroups = { ...config, groups: groupConfigs };
        setConfigJson(JSON.stringify(configWithGroups));
      } else {
        // No profile found - use defaults
        const defaultKeyboardId = language === 'he' ? 'he' : language;
        const defaultDef: SavedProfileDefinition = {
          id: getDefaultProfileId(language),
          name: 'Default',
          version: '1.0.0',
          language,
          keyboardId: defaultKeyboardId,
        };
        setProfileDef(defaultDef);
        setStyleGroups([]);
        setCurrentProfileId(defaultDef.id);
        setCurrentKeyboardId(defaultKeyboardId);
        setClassicState(extractClassicState([], language));

        const config = buildConfiguration(defaultDef);
        setConfigJson(JSON.stringify(config));
      }
    } catch (error) {
      console.error('ClassicEditor: Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile(currentLanguage);
  }, [currentLanguage, loadProfile]);

  // Update classic state and config JSON when style groups change
  const refreshState = useCallback((newStyleGroups: StyleGroup[], newProfileDef: SavedProfileDefinition) => {
    setClassicState(extractClassicState(newStyleGroups, currentLanguage));
    const config = buildConfiguration(newProfileDef);
    const groupConfigs = convertStyleGroupsToGroupConfig(newStyleGroups);
    const configWithGroups = { ...config, groups: groupConfigs };
    setConfigJson(JSON.stringify(configWithGroups));
  }, [currentLanguage]);

  // Save the current profile and push config to keyboard
  const saveProfile = useCallback(async (
    updatedDef: SavedProfileDefinition,
    updatedStyleGroups: StyleGroup[]
  ) => {
    try {
      // Save profile definition
      await KeyboardPreferences.setProfile(
        JSON.stringify(updatedDef),
        `profile_def_${updatedDef.id}`
      );
      // Save style groups
      await KeyboardPreferences.setProfile(
        JSON.stringify(updatedStyleGroups),
        `${updatedDef.id}_styleGroups`
      );

      // Push config to keyboard
      const config = buildConfiguration(updatedDef);
      const groupConfigs = convertStyleGroupsToGroupConfig(updatedStyleGroups);
      const configWithGroups = { ...config, groups: groupConfigs };
      await saveKeyboardConfig(configWithGroups, currentLanguage);

      // Set as active
      const activeProfileKey = getActiveProfileKey(currentLanguage);
      await KeyboardPreferences.setProfile(updatedDef.id, activeProfileKey);
    } catch (error) {
      console.error('ClassicEditor: Failed to save profile:', error);
    }
  }, [currentLanguage]);

  // Helper: update a specific style group's property and save.
  // If the group doesn't exist yet, create it using the provided presetId and members.
  const updateStyleGroupColor = useCallback(async (
    groupFinder: (groups: StyleGroup[]) => StyleGroup | null | undefined,
    property: 'bgColor' | 'color',
    newColor: string,
    createInfo?: { presetId: string; name: string; members: string[] }
  ) => {
    if (!profileDef) return;
    let group = groupFinder(styleGroups);
    let currentGroups = styleGroups;

    // If group doesn't exist and we have info to create it, create on-the-fly
    if (!group && createInfo) {
      const newGroup: StyleGroup = {
        id: `v1_classic_${createInfo.presetId}_${Date.now()}`,
        name: createInfo.name,
        members: createInfo.members,
        style: { bgColor: '#4DD0E1', color: '#000000' },
        createdAt: new Date().toISOString(),
        active: true,
        isBuiltIn: false,
      };
      currentGroups = [...styleGroups, newGroup];
      group = newGroup;
    }

    if (!group) return;

    const updatedGroups = currentGroups.map(g => {
      if (g.id === group!.id) {
        return { ...g, style: { ...g.style, [property]: newColor } };
      }
      return g;
    });

    setStyleGroups(updatedGroups);
    refreshState(updatedGroups, profileDef);
    await saveProfile(profileDef, updatedGroups);
  }, [styleGroups, profileDef, refreshState, saveProfile]);

  // Handle master color changes (updates all charset groups too)
  const updateMasterColor = useCallback(async (property: 'keysBgColor' | 'textColor', color: string) => {
    if (!profileDef) return;
    const updatedDef = { ...profileDef, [property]: color };
    setProfileDef(updatedDef);

    // Also update all charset groups if changing master key/text color
    const styleProp = property === 'keysBgColor' ? 'bgColor' : 'color';
    const charsetPresets = ['top-row', 'mid-row', 'bottom-row', 'left-third', 'mid-third', 'right-third', 'left-half', 'right-half'];
    const updatedGroups = styleGroups.map(g => {
      if (charsetPresets.some(p => g.id.includes(p))) {
        return { ...g, style: { ...g.style, [styleProp]: color } };
      }
      return g;
    });

    setStyleGroups(updatedGroups);
    refreshState(updatedGroups, updatedDef);
    await saveProfile(updatedDef, updatedGroups);
  }, [profileDef, styleGroups, refreshState, saveProfile]);

  // Handle background color change
  const updateBackgroundColor = useCallback(async (color: string) => {
    if (!profileDef) return;
    const updatedDef = { ...profileDef, backgroundColor: color };
    setProfileDef(updatedDef);
    refreshState(styleGroups, updatedDef);
    await saveProfile(updatedDef, styleGroups);
  }, [profileDef, styleGroups, refreshState, saveProfile]);

  // Handle language change
  const handleLanguageChange = useCallback((lang: string) => {
    if (lang !== currentLanguage) {
      setActiveSetting(null);
      setCurrentLanguage(lang as LanguageId);
    }
  }, [currentLanguage]);

  // Handle key order change (Hebrew: standard vs ABC)
  const handleKeyOrderChange = useCallback(async (ordered: boolean) => {
    if (!profileDef) return;
    const newKeyboardId = ordered ? 'he_ordered' : 'he';
    const updatedDef = { ...profileDef, keyboardId: newKeyboardId };
    setProfileDef(updatedDef);
    setCurrentKeyboardId(newKeyboardId);
    refreshState(styleGroups, updatedDef);
    await saveProfile(updatedDef, styleGroups);
  }, [profileDef, styleGroups, refreshState, saveProfile]);

  // Handle division mode change (rows vs sections)
  // Deactivates current charset groups, activates the other set, preserves colors.
  const handleDivisionModeChange = useCallback(async (mode: 'rows' | 'sections') => {
    if (!profileDef || !classicState || classicState.divisionMode === mode) return;

    const rowPresets = ['top-row', 'mid-row', 'bottom-row'];
    const thirdPresets = currentLanguage === 'en'
      ? ['left-third', 'mid-third', 'right-third']
      : ['right-third', 'mid-third', 'left-third'];

    // Deactivate current charset groups, activate the other set
    const fromPresets = mode === 'sections' ? rowPresets : thirdPresets;
    // When switching to sections, default to thirds (with middle active)
    const toPresets = mode === 'sections' ? thirdPresets : rowPresets;

    // Read current colors from active charset groups
    const colors = classicState.charsetGroups.map(g => ({
      bgColor: g?.style.bgColor || '#CCCCCC',
      color: g?.style.color || '#000000',
    }));

    let updatedGroups = [...styleGroups];

    // Deactivate the "from" groups (and also halves when switching to rows)
    updatedGroups = updatedGroups.map(g => {
      if (fromPresets.some(p => g.id.includes(p))) {
        return { ...g, active: false };
      }
      // When switching to rows, also deactivate halves (in case we're in 2-group sections mode)
      if (mode === 'rows' && (g.id.includes('left-half') || g.id.includes('right-half'))) {
        return { ...g, active: false };
      }
      return g;
    });

    // Activate or create the "to" groups with preserved colors
    for (let i = 0; i < toPresets.length; i++) {
      const presetId = toPresets[i];
      const existing = updatedGroups.find(g => g.id.includes(presetId));
      if (existing) {
        updatedGroups = updatedGroups.map(g => {
          if (g.id === existing.id) {
            return { ...g, active: true, style: { ...g.style, bgColor: colors[i].bgColor, color: colors[i].color } };
          }
          return g;
        });
      } else {
        const info = getPresetInfo(presetId, currentLanguage);
        if (info) {
          updatedGroups.push({
            id: `v1_classic_${presetId}_${Date.now()}_${i}`,
            name: info.name,
            members: info.members,
            style: { bgColor: colors[i].bgColor, color: colors[i].color },
            createdAt: new Date().toISOString(),
            active: true,
            isBuiltIn: false,
          });
        }
      }
    }

    setStyleGroups(updatedGroups);
    refreshState(updatedGroups, profileDef);
    await saveProfile(profileDef, updatedGroups);
  }, [profileDef, classicState, styleGroups, currentLanguage, refreshState, saveProfile]);

  // Handle middle toggle in sections mode — switch between thirds (3-group) and halves (2-group)
  const handleMiddleToggle = useCallback(async (enabled: boolean) => {
    if (!profileDef || !classicState || classicState.divisionMode !== 'sections') return;

    let updatedGroups = [...styleGroups];

    if (enabled) {
      // Switching from 2-group (halves) to 3-group (thirds)
      // Read colors from charsetGroups (mapped from halves by bridge)
      const group1Colors = { bgColor: classicState.charsetGroups[0]?.style.bgColor || '#CCCCCC', color: classicState.charsetGroups[0]?.style.color || '#000000' };
      const group3Colors = { bgColor: classicState.charsetGroups[2]?.style.bgColor || '#CCCCCC', color: classicState.charsetGroups[2]?.style.color || '#000000' };

      // Deactivate halves
      updatedGroups = updatedGroups.map(g => {
        if (g.id.includes('left-half') || g.id.includes('right-half')) {
          return { ...g, active: false };
        }
        return g;
      });

      // Activate or create thirds with colors from halves
      const thirdPresets = currentLanguage === 'en'
        ? ['left-third', 'mid-third', 'right-third']
        : ['right-third', 'mid-third', 'left-third'];
      const thirdColors = [group1Colors, { bgColor: '#CCCCCC', color: '#000000' }, group3Colors];

      for (let i = 0; i < thirdPresets.length; i++) {
        const presetId = thirdPresets[i];
        const existing = updatedGroups.find(g => g.id.includes(presetId));
        if (existing) {
          updatedGroups = updatedGroups.map(g => {
            if (g.id === existing.id) {
              return { ...g, active: true, style: { ...g.style, bgColor: thirdColors[i].bgColor, color: thirdColors[i].color } };
            }
            return g;
          });
        } else {
          const info = getPresetInfo(presetId, currentLanguage);
          if (info) {
            updatedGroups.push({
              id: `v1_classic_${presetId}_${Date.now()}_${i}`,
              name: info.name,
              members: info.members,
              style: { bgColor: thirdColors[i].bgColor, color: thirdColors[i].color },
              createdAt: new Date().toISOString(),
              active: true,
              isBuiltIn: false,
            });
          }
        }
      }
    } else {
      // Switching from 3-group (thirds) to 2-group (halves)
      // Read colors from thirds: group1 (index 0) and group3 (index 2)
      const group1Colors = { bgColor: classicState.charsetGroups[0]?.style.bgColor || '#CCCCCC', color: classicState.charsetGroups[0]?.style.color || '#000000' };
      const group3Colors = { bgColor: classicState.charsetGroups[2]?.style.bgColor || '#CCCCCC', color: classicState.charsetGroups[2]?.style.color || '#000000' };

      // Deactivate thirds
      updatedGroups = updatedGroups.map(g => {
        if (g.id.includes('left-third') || g.id.includes('mid-third') || g.id.includes('right-third')) {
          return { ...g, active: false };
        }
        return g;
      });

      // Activate or create halves with colors from group1 and group3
      // Fixed mapping: right-half = group1, left-half = group3
      const halfPresets = [
        { id: 'left-half', colors: group3Colors },
        { id: 'right-half', colors: group1Colors },
      ];

      for (const { id: presetId, colors } of halfPresets) {
        const existing = updatedGroups.find(g => g.id.includes(presetId));
        if (existing) {
          updatedGroups = updatedGroups.map(g => {
            if (g.id === existing.id) {
              return { ...g, active: true, style: { ...g.style, bgColor: colors.bgColor, color: colors.color } };
            }
            return g;
          });
        } else {
          const info = getPresetInfo(presetId, currentLanguage);
          if (info) {
            updatedGroups.push({
              id: `v1_classic_${presetId}_${Date.now()}`,
              name: info.name,
              members: info.members,
              style: { bgColor: colors.bgColor, color: colors.color },
              createdAt: new Date().toISOString(),
              active: true,
              isBuiltIn: false,
            });
          }
        }
      }
    }

    setStyleGroups(updatedGroups);
    refreshState(updatedGroups, profileDef);
    await saveProfile(profileDef, updatedGroups);
  }, [profileDef, classicState, styleGroups, currentLanguage, refreshState, saveProfile]);

  // Handle nikkud mode change
  const handleNikkudChange = useCallback(async (simpleMode: boolean) => {
    if (!profileDef) return;
    const updatedDef = {
      ...profileDef,
      diacritics: {
        ...profileDef.diacritics,
        [currentKeyboardId]: {
          ...(profileDef.diacritics?.[currentKeyboardId] || {}),
          simpleMode,
        },
      },
    };
    setProfileDef(updatedDef);
    refreshState(styleGroups, updatedDef);
    await saveProfile(updatedDef, styleGroups);
  }, [profileDef, styleGroups, currentKeyboardId, refreshState, saveProfile]);

  // Handle special keys text change
  const handleSpecialKeysTextChange = useCallback(async (text: string) => {
    if (!profileDef) return;
    const members = text.split('').filter(c => c.trim());
    const existingGroup = styleGroups.find(g =>
      g.active !== false &&
      g.style.bgColor &&
      !['top-row', 'mid-row', 'bottom-row', 'left-third', 'mid-third', 'right-third', 'left-half', 'right-half',
        'space-key', 'delete-key', 'enter-key', 'other-keys'].some(p => g.id.includes(p)) &&
      g.style.visibilityMode !== 'showOnly'
    );

    let updatedGroups: StyleGroup[];
    if (existingGroup) {
      if (members.length === 0) {
        // Remove the group if empty
        updatedGroups = styleGroups.filter(g => g.id !== existingGroup.id);
      } else {
        updatedGroups = styleGroups.map(g =>
          g.id === existingGroup.id ? { ...g, members } : g
        );
      }
    } else if (members.length > 0) {
      // Create new special keys group
      const newGroup: StyleGroup = {
        id: `special_keys_${Date.now()}`,
        name: 'Special Keys',
        members,
        style: { bgColor: '#FFFF00', color: '#000000', visibilityMode: 'default' },
        createdAt: new Date().toISOString(),
        active: true,
        isBuiltIn: false,
      };
      updatedGroups = [...styleGroups, newGroup];
    } else {
      return;
    }

    setStyleGroups(updatedGroups);
    refreshState(updatedGroups, profileDef);
    await saveProfile(profileDef, updatedGroups);
  }, [profileDef, styleGroups, refreshState, saveProfile]);

  // Handle visible keys text change
  const handleVisibleKeysTextChange = useCallback(async (text: string) => {
    if (!profileDef) return;
    const members = text.split('').filter(c => c.trim());
    const existingGroup = styleGroups.find(g => g.style.visibilityMode === 'showOnly');

    let updatedGroups: StyleGroup[];
    if (existingGroup) {
      if (members.length === 0) {
        updatedGroups = styleGroups.filter(g => g.id !== existingGroup.id);
      } else {
        updatedGroups = styleGroups.map(g =>
          g.id === existingGroup.id ? { ...g, members } : g
        );
      }
    } else if (members.length > 0) {
      const newGroup: StyleGroup = {
        id: `visible_keys_${Date.now()}`,
        name: 'Visible Keys',
        members,
        style: { visibilityMode: 'showOnly' },
        createdAt: new Date().toISOString(),
        active: true,
        isBuiltIn: false,
      };
      updatedGroups = [...styleGroups, newGroup];
    } else {
      return;
    }

    setStyleGroups(updatedGroups);
    refreshState(updatedGroups, profileDef);
    await saveProfile(profileDef, updatedGroups);
  }, [profileDef, styleGroups, refreshState, saveProfile]);

  // Handle reset
  const handleReset = useCallback(async () => {
    if (!profileDef) return;

    const templateId = extractTemplateId(profileDef.id);
    const template = templateId ? getBuiltInProfileTemplate(templateId) : undefined;
    const message = template
      ? `Reset to "${template.name}" defaults? This cannot be undone.`
      : 'Clear all customizations? This cannot be undone.';

    Alert.alert(
      'Reset',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const keyboardId = currentLanguage === 'he' ? 'he' : currentLanguage;
            let resetDef: SavedProfileDefinition;
            let resetGroups: StyleGroup[];

            if (template) {
              resetDef = {
                id: profileDef.id,
                name: template.name,
                version: '1.0.0',
                language: currentLanguage,
                keyboardId,
                ...template.config,
              };
              const createdAt = new Date().toISOString();
              resetGroups = template.styleGroups.map((sg, index) => ({
                ...sg,
                id: `builtin_${templateId}_${index}`,
                createdAt,
              }));
            } else {
              resetDef = {
                id: profileDef.id,
                name: profileDef.name,
                version: '1.0.0',
                language: currentLanguage,
                keyboardId,
              };
              resetGroups = [];
            }

            setProfileDef(resetDef);
            setStyleGroups(resetGroups);
            setCurrentKeyboardId(keyboardId);
            refreshState(resetGroups, resetDef);
            await saveProfile(resetDef, resetGroups);
            setActiveSetting(null);
          },
        },
      ]
    );
  }, [profileDef, currentLanguage, refreshState, saveProfile]);

  // Route setting selection to appropriate handler or detail view
  const handleSelectSetting = useCallback((settingId: SettingId) => {
    switch (settingId) {
      case 'reset':
        handleReset();
        break;
      case 'my-issieboards':
        loadSavedProfiles();
        setActiveSetting(settingId);
        break;
      default:
        setActiveSetting(settingId);
        break;
    }
  }, [handleReset]);

  // Get the current color for a setting
  const getColorForSetting = useCallback((settingId: SettingId): string => {
    if (!classicState || !profileDef) return '#000000';
    switch (settingId) {
      case 'bg-color': return profileDef.backgroundColor || '#FFFFFF';
      case 'keys-color': return profileDef.keysBgColor || '#CCCCCC';
      case 'text-color': return profileDef.textColor || '#000000';
      case 'space-color': return classicState.actionGroups.space?.style.bgColor || '#4DD0E1';
      case 'delete-color': return classicState.actionGroups.delete?.style.bgColor || '#4DD0E1';
      case 'enter-color': return classicState.actionGroups.enter?.style.bgColor || '#4DD0E1';
      case 'other-color': return classicState.actionGroups.other?.style.bgColor || '#4DD0E1';
      case 'group1-keys-color': return classicState.charsetGroups[0]?.style.bgColor || '#CCCCCC';
      case 'group1-text-color': return classicState.charsetGroups[0]?.style.color || '#000000';
      case 'group2-keys-color': return classicState.charsetGroups[1]?.style.bgColor || '#CCCCCC';
      case 'group2-text-color': return classicState.charsetGroups[1]?.style.color || '#000000';
      case 'group3-keys-color': return classicState.charsetGroups[2]?.style.bgColor || '#CCCCCC';
      case 'group3-text-color': return classicState.charsetGroups[2]?.style.color || '#000000';
      case 'special-keys-color': return classicState.specialKeysGroup?.style.bgColor || '#FFFF00';
      case 'special-keys-text-color': return classicState.specialKeysGroup?.style.color || '#000000';
      default: return '#000000';
    }
  }, [classicState, profileDef]);

  // Handle color selection for a setting
  const handleColorSelected = useCallback(async (settingId: SettingId, color: string) => {
    if (!profileDef) return;

    // Helper to build createInfo from a preset ID
    const create = (presetId: string) => {
      const info = getPresetInfo(presetId, currentLanguage);
      return info ? { presetId, name: info.name, members: info.members } : undefined;
    };

    switch (settingId) {
      case 'bg-color':
        await updateBackgroundColor(color);
        break;
      case 'keys-color':
        await updateMasterColor('keysBgColor', color);
        break;
      case 'text-color':
        await updateMasterColor('textColor', color);
        break;
      case 'space-color':
        await updateStyleGroupColor(
          groups => groups.find(g => g.id.includes('space-key')),
          'bgColor', color, create('space-key')
        );
        break;
      case 'delete-color':
        await updateStyleGroupColor(
          groups => groups.find(g => g.id.includes('delete-key')),
          'bgColor', color, create('delete-key')
        );
        break;
      case 'enter-color':
        await updateStyleGroupColor(
          groups => groups.find(g => g.id.includes('enter-key')),
          'bgColor', color, create('enter-key')
        );
        break;
      case 'other-color':
        await updateStyleGroupColor(
          groups => groups.find(g => g.id.includes('other-keys')),
          'bgColor', color, create('other-keys')
        );
        break;
      case 'group1-keys-color': {
        const preset = classicState?.divisionMode === 'rows' ? 'top-row' :
          classicState?.threeColorMode === false ? 'right-half' :
          (currentLanguage === 'en' ? 'left-third' : 'right-third');
        await updateStyleGroupColor(
          groups => groups.find(g => g.id.includes(preset)),
          'bgColor', color, create(preset)
        );
        break;
      }
      case 'group1-text-color': {
        const preset = classicState?.divisionMode === 'rows' ? 'top-row' :
          classicState?.threeColorMode === false ? 'right-half' :
          (currentLanguage === 'en' ? 'left-third' : 'right-third');
        await updateStyleGroupColor(
          groups => groups.find(g => g.id.includes(preset)),
          'color', color, create(preset)
        );
        break;
      }
      case 'group2-keys-color': {
        const preset = classicState?.divisionMode === 'rows' ? 'mid-row' : 'mid-third';
        await updateStyleGroupColor(
          groups => groups.find(g => g.id.includes(preset)),
          'bgColor', color, create(preset)
        );
        break;
      }
      case 'group2-text-color': {
        const preset = classicState?.divisionMode === 'rows' ? 'mid-row' : 'mid-third';
        await updateStyleGroupColor(
          groups => groups.find(g => g.id.includes(preset)),
          'color', color, create(preset)
        );
        break;
      }
      case 'group3-keys-color': {
        const preset = classicState?.divisionMode === 'rows' ? 'bottom-row' :
          classicState?.threeColorMode === false ? 'left-half' :
          (currentLanguage === 'en' ? 'right-third' : 'left-third');
        await updateStyleGroupColor(
          groups => groups.find(g => g.id.includes(preset)),
          'bgColor', color, create(preset)
        );
        break;
      }
      case 'group3-text-color': {
        const preset = classicState?.divisionMode === 'rows' ? 'bottom-row' :
          classicState?.threeColorMode === false ? 'left-half' :
          (currentLanguage === 'en' ? 'right-third' : 'left-third');
        await updateStyleGroupColor(
          groups => groups.find(g => g.id.includes(preset)),
          'color', color, create(preset)
        );
        break;
      }
      case 'special-keys-color':
        await updateStyleGroupColor(
          groups => groups.find(g =>
            g.active !== false && g.style.bgColor &&
            !['top-row', 'mid-row', 'bottom-row', 'left-third', 'mid-third', 'right-third',
              'space-key', 'delete-key', 'enter-key', 'other-keys'].some(p => g.id.includes(p)) &&
            g.style.visibilityMode !== 'showOnly'
          ),
          'bgColor', color
        );
        break;
      case 'special-keys-text-color':
        await updateStyleGroupColor(
          groups => groups.find(g =>
            g.active !== false && g.style.bgColor &&
            !['top-row', 'mid-row', 'bottom-row', 'left-third', 'mid-third', 'right-third',
              'space-key', 'delete-key', 'enter-key', 'other-keys'].some(p => g.id.includes(p)) &&
            g.style.visibilityMode !== 'showOnly'
          ),
          'color', color
        );
        break;
    }
  }, [profileDef, classicState, currentLanguage, updateBackgroundColor, updateMasterColor, updateStyleGroupColor]);

  // Get title for a setting detail view
  const getSettingTitle = (settingId: SettingId): string => {
    const titles: Record<string, string> = {
      'bg-color': 'Background Color',
      'keys-color': 'Keys Color',
      'text-color': 'Text Color',
      'space-color': 'Space Key Color',
      'delete-color': 'Delete Key Color',
      'enter-color': 'Enter Key Color',
      'other-color': 'Other Keys Color',
      'group1-keys-color': 'Group 1 Keys Color',
      'group1-text-color': 'Group 1 Text Color',
      'group2-keys-color': 'Group 2 Keys Color',
      'group2-text-color': 'Group 2 Text Color',
      'group3-keys-color': 'Group 3 Keys Color',
      'group3-text-color': 'Group 3 Text Color',
      'special-keys-text': 'Highlighted Characters',
      'special-keys-color': 'Highlight Keys Color',
      'special-keys-text-color': 'Highlight Text Color',
      'visible-keys-text': 'Visible Keys',
      'my-issieboards': 'My IssieBoards',
      'key-order': 'Key Order',
      'nikkud': 'Nikkud Settings',
      'division-mode': 'Color Division',
      'language': 'Language',
    };
    return titles[settingId] || settingId;
  };

  // Check if a setting is a color picker
  const isColorSetting = (settingId: SettingId): boolean => {
    return settingId.includes('color');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!profileDef || !classicState) {
    return (
      <SafeAreaView style={styles.container}>
        <Text allowFontScaling={false} style={styles.errorText}>Failed to load profile</Text>
      </SafeAreaView>
    );
  }

  // Main view: sections list always rendered, detail view on top when active
  return (
    <SafeAreaView style={styles.container}>
      {/* Sections list — always mounted, never unmounted or hidden */}
      <View style={styles.sectionsLayer} pointerEvents={activeSetting ? 'none' : 'auto'}>
        <View style={styles.header}>
          <Text allowFontScaling={false} style={styles.headerTitle}>Classic View</Text>
          <TouchableOpacity style={styles.advancedButton} onPress={onSwitchToAdvanced}>
            <Text allowFontScaling={false} style={styles.advancedButtonText}>Advanced View</Text>
          </TouchableOpacity>
        </View>
        <ClassicSectionsList
          classicState={classicState}
          backgroundColor={profileDef.backgroundColor || '#FFFFFF'}
          keysBgColor={profileDef.keysBgColor || '#CCCCCC'}
          textColor={profileDef.textColor || '#000000'}
          currentLanguage={currentLanguage}
          onSelectSetting={handleSelectSetting}
          onLanguageChange={handleLanguageChange}
          onDivisionModeChange={handleDivisionModeChange}
          onMiddleToggle={handleMiddleToggle}
        />
      </View>

      {/* Detail view — rendered on top when a setting is active */}
      {activeSetting && (
        <View style={styles.detailLayer}>
          <ClassicDetailView
            title={getSettingTitle(activeSetting)}
            onBack={() => setActiveSetting(null)}
            configJson={activeSetting !== 'nikkud' && activeSetting !== 'my-issieboards' ? configJson : undefined}
            language={currentLanguage}
          >
          {isColorSetting(activeSetting) ? (
            <ClassicColorPicker
              currentColor={getColorForSetting(activeSetting)}
              onColorSelected={(color) => handleColorSelected(activeSetting, color)}
            />
          ) : activeSetting === 'key-order' ? (
            <View style={styles.pickerContainer}>
              <TouchableOpacity
                style={[styles.pickerOption, currentKeyboardId === 'he' && styles.pickerOptionActive]}
                onPress={() => handleKeyOrderChange(false)}
              >
                <Text allowFontScaling={false} style={[styles.pickerOptionText, currentKeyboardId === 'he' && styles.pickerOptionTextActive]}>
                  Standard
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pickerOption, currentKeyboardId === 'he_ordered' && styles.pickerOptionActive]}
                onPress={() => handleKeyOrderChange(true)}
              >
                <Text allowFontScaling={false} style={[styles.pickerOptionText, currentKeyboardId === 'he_ordered' && styles.pickerOptionTextActive]}>
                  Ordered (ABC)
                </Text>
              </TouchableOpacity>
            </View>
          ) : activeSetting === 'nikkud' ? (
            <View style={styles.pickerContainer}>
              <TouchableOpacity
                style={[styles.pickerOption, profileDef.diacritics?.[currentKeyboardId]?.simpleMode !== false && styles.pickerOptionActive]}
                onPress={() => handleNikkudChange(true)}
              >
                <Text allowFontScaling={false} style={[styles.pickerOptionText, profileDef.diacritics?.[currentKeyboardId]?.simpleMode !== false && styles.pickerOptionTextActive]}>
                  Basic
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pickerOption, profileDef.diacritics?.[currentKeyboardId]?.simpleMode === false && styles.pickerOptionActive]}
                onPress={() => handleNikkudChange(false)}
              >
                <Text allowFontScaling={false} style={[styles.pickerOptionText, profileDef.diacritics?.[currentKeyboardId]?.simpleMode === false && styles.pickerOptionTextActive]}>
                  Full
                </Text>
              </TouchableOpacity>
            </View>
          ) : activeSetting === 'special-keys-text' ? (
            <View style={styles.textInputContainer}>
              <Text allowFontScaling={false} style={styles.textInputLabel}>
                Enter characters to highlight:
              </Text>
              <TextInput
                style={styles.textInput}
                value={classicState.specialKeysGroup?.members.join('') || ''}
                onChangeText={handleSpecialKeysTextChange}
                placeholder="Type characters..."
                autoCorrect={false}
              />
            </View>
          ) : activeSetting === 'visible-keys-text' ? (
            <View style={styles.textInputContainer}>
              <Text allowFontScaling={false} style={styles.textInputLabel}>
                Enter visible keys (leave empty to show all):
              </Text>
              <TextInput
                style={styles.textInput}
                value={classicState.visibleKeysGroup?.members.join('') || ''}
                onChangeText={handleVisibleKeysTextChange}
                placeholder="Type characters..."
                autoCorrect={false}
              />
            </View>
          ) : activeSetting === 'my-issieboards' ? (
            <ScrollView style={styles.profileList}>
              {savedProfiles.map(profile => (
                <TouchableOpacity
                  key={profile.id}
                  style={[styles.profileRow, profile.isActive && styles.profileRowActive]}
                  onPress={() => handleProfileSelect(profile.id)}
                >
                  <Text allowFontScaling={false} style={styles.profileName}>{profile.name}</Text>
                  {profile.isActive && <Text allowFontScaling={false} style={styles.profileCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text allowFontScaling={false} style={styles.errorText}>Unknown setting</Text>
          )}
        </ClassicDetailView>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  sectionsLayer: {
    flex: 1,
  },
  detailLayer: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  advancedButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  advancedButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 40,
  },
  pickerContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  pickerOption: {
    flex: 1,
    padding: 16,
    borderRadius: 10,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
  },
  pickerOptionActive: {
    backgroundColor: '#007AFF',
  },
  pickerOptionText: {
    fontSize: 17,
    color: '#333',
    fontWeight: '500',
  },
  pickerOptionTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  textInputContainer: {
    padding: 16,
  },
  textInputLabel: {
    fontSize: 15,
    color: '#666',
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#C6C6C8',
    borderRadius: 10,
    padding: 14,
    fontSize: 20,
    minHeight: 50,
  },
  profileList: {
    flex: 1,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  profileRowActive: {
    backgroundColor: '#F0F7FF',
  },
  profileName: {
    flex: 1,
    fontSize: 17,
  },
  profileCheck: {
    fontSize: 20,
    color: '#007AFF',
    marginLeft: 8,
  },
});

export default ClassicEditorScreen;
