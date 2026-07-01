import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { extractClassicState, ClassicState, matchesPreset } from './classic/classicProfileBridge';
import ClassicSectionsList, { SettingId } from './classic/ClassicSectionsList';
import ClassicDetailView from './classic/ClassicDetailView';
import ClassicColorPicker from './classic/ClassicColorPicker';
import { KeyPressEvent } from '../components/KeyboardPreview';
import SaveAsModal from '../../components/SaveAsModal';

// Import keyboard files
import enKeyboard from '../../keyboards/en.json';
import heKeyboard from '../../keyboards/he.json';
import heOrderedKeyboard from '../../keyboards/he_ordered.json';
import arKeyboard from '../../keyboards/ar.json';
import enOrderedKeyboard from '../../keyboards/en_ordered.json';
import arOrderedKeyboard from '../../keyboards/ar_ordered.json';

import { buildKeyboardConfig, SourceKeyboard, transformConfigForPreview } from '../utils/keyboardConfigMerger';

// Import predefined rules for preset member lookup
import enRules from '../../assets/predefined-rules/en.json';
import heRules from '../../assets/predefined-rules/he.json';
import arRules from '../../assets/predefined-rules/ar.json';
import { BUILT_IN_PROFILES, isBuiltInProfileId, extractTemplateId, getBuiltInProfileTemplate, getLocalizedProfileName } from '../data/builtInProfiles';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalization } from '../localization';
import { AboutScreen } from '../components/AboutScreen';
import { ISSIEBOARD_ABOUT } from '../components/about-content';
import { MyIcon } from '@beitissieshapiro/issie-shared/dist/icons';

const PREDEFINED_RULES: Record<string, any> = {
  'en': enRules,
  'he': heRules,
  'ar': arRules,
};

/** Look up a preset's members and name from predefined rules for the given language */
const getPresetInfo = (presetId: string, language: LanguageId, keyboardId?: string): { name: string; members: string[] } | null => {
  const rules = PREDEFINED_RULES[language]?.rules;
  if (!rules) return null;
  const rule = rules.find((r: any) => r.id === presetId);
  if (!rule) return null;
  const members = (keyboardId?.endsWith('_ordered') && rule.orderedMembers) ? rule.orderedMembers : rule.members;
  return { name: rule.name, members };
};

type LanguageId = 'he' | 'en' | 'ar';

const KEYBOARDS: Record<string, any> = {
  'en': enKeyboard,
  'en_ordered': enOrderedKeyboard,
  'he': heKeyboard,
  'he_ordered': heOrderedKeyboard,
  'ar': arKeyboard,
  'ar_ordered': arOrderedKeyboard,
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
// showOnly groups are placed first; transformConfigForPreview then appends inverse groups at the end
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
  const { strings, isRTL } = useLocalization();
  const [loading, setLoading] = useState(true);
  const [currentLanguage, setCurrentLanguage] = useState<LanguageId>(initialLanguage || 'he');
  const [currentProfileId, setCurrentProfileId] = useState<string>('');
  const [currentKeyboardId, setCurrentKeyboardId] = useState<string>('he');
  const [profileDef, setProfileDef] = useState<SavedProfileDefinition | null>(null);
  const [styleGroups, setStyleGroups] = useState<StyleGroup[]>([]);
  const [classicState, setClassicState] = useState<ClassicState | null>(null);
  const [configJson, setConfigJson] = useState<string>('');
  const [showAbout, setShowAbout] = useState(false);
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);

  // Queued save: stores the def+groups to apply after user names a new profile from built-in
  const pendingSaveRef = useRef<{ def: SavedProfileDefinition; groups: StyleGroup[] } | null>(null);

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
        name: getLocalizedProfileName(template.id, currentLanguage),
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
          name: getLocalizedProfileName(templateId!, currentLanguage),
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
      setConfigJson(JSON.stringify(transformConfigForPreview(configWithGroups)));

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
        setConfigJson(JSON.stringify(transformConfigForPreview(configWithGroups)));
      } else {
        // No profile found - use defaults
        const defaultKeyboardId = language === 'he' ? 'he' : language;
        const defaultDef: SavedProfileDefinition = {
          id: getDefaultProfileId(language),
          name: strings.common.default,
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
        setConfigJson(JSON.stringify(transformConfigForPreview(config)));
      }
    } catch (error) {
      console.error('ClassicEditor: Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  }, [strings]);

  useEffect(() => {
    loadProfile(currentLanguage);
    loadSavedProfiles();
  }, [currentLanguage, loadProfile]);

  // Update classic state and config JSON when style groups change
  const refreshState = useCallback((newStyleGroups: StyleGroup[], newProfileDef: SavedProfileDefinition) => {
    setClassicState(extractClassicState(newStyleGroups, currentLanguage));
    const config = buildConfiguration(newProfileDef);
    const groupConfigs = convertStyleGroupsToGroupConfig(newStyleGroups);
    const configWithGroups = { ...config, groups: groupConfigs };
    const showOnlyOpacity = activeSetting === 'visible-keys-text' ? 0.3 : undefined;
    setConfigJson(JSON.stringify(transformConfigForPreview(configWithGroups, { showOnlyOpacity })));
  }, [currentLanguage, activeSetting]);

  // Re-transform config when entering/leaving visible-keys-text mode
  useEffect(() => {
    if (!profileDef) return;
    const config = buildConfiguration(profileDef);
    const groupConfigs = convertStyleGroupsToGroupConfig(styleGroups);
    const configWithGroups = { ...config, groups: groupConfigs };
    const showOnlyOpacity = activeSetting === 'visible-keys-text' ? 0.3 : undefined;
    setConfigJson(JSON.stringify(transformConfigForPreview(configWithGroups, { showOnlyOpacity })));
  }, [activeSetting]);

  // Save the current profile and push config to keyboard.
  // If the current profile is a built-in, queue the save and show the SaveAs modal instead.
  const saveProfile = useCallback(async (
    updatedDef: SavedProfileDefinition,
    updatedStyleGroups: StyleGroup[]
  ) => {
    if (isBuiltInProfileId(updatedDef.id)) {
      pendingSaveRef.current = { def: updatedDef, groups: updatedStyleGroups };
      setShowSaveAsModal(true);
      return;
    }
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

  // Handle "Save As" when user names the copy of a built-in profile
  const handleSaveAs = useCallback(async (newName: string): Promise<boolean> => {
    const pending = pendingSaveRef.current;
    if (!pending || !profileDef) return false;
    try {
      const newProfileId = `custom_${Date.now()}`;
      const newDef: SavedProfileDefinition = { ...pending.def, id: newProfileId, name: newName };

      // Save new profile
      await KeyboardPreferences.setProfile(JSON.stringify(newDef), `profile_def_${newProfileId}`);
      await KeyboardPreferences.setProfile(JSON.stringify(pending.groups), `${newProfileId}_styleGroups`);

      // Add to saved list
      let savedList: { name: string; key: string; language: string; keyboardId: string }[] = [];
      try {
        const savedListJson = await KeyboardPreferences.getProfile('saved_list');
        if (savedListJson) savedList = JSON.parse(savedListJson);
      } catch { /* ignore */ }
      savedList.push({ name: newName, key: newProfileId, language: currentLanguage, keyboardId: pending.def.keyboardId });
      await KeyboardPreferences.setProfile(JSON.stringify(savedList), 'saved_list');

      // Push config to keyboard and set as active
      const config = buildConfiguration(newDef);
      const groupConfigs = convertStyleGroupsToGroupConfig(pending.groups);
      const configWithGroups = { ...config, groups: groupConfigs };
      await saveKeyboardConfig(configWithGroups, currentLanguage);
      const activeProfileKey = getActiveProfileKey(currentLanguage);
      await KeyboardPreferences.setProfile(newProfileId, activeProfileKey);

      // Switch state to new profile
      setProfileDef(newDef);
      setCurrentProfileId(newProfileId);
      pendingSaveRef.current = null;
      setShowSaveAsModal(false);
      await loadSavedProfiles();
      return true;
    } catch (error) {
      console.error('ClassicEditor: Failed to save as:', error);
      return false;
    }
  }, [profileDef, currentLanguage, loadSavedProfiles]);

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

  // Handle master color changes (updates all charset groups too).
  // '' = system default → stored as undefined so native uses its own default.
  const updateMasterColor = useCallback(async (property: 'keysBgColor' | 'textColor', color: string) => {
    if (!profileDef) return;
    const updatedDef: SavedProfileDefinition = { ...profileDef };
    if (color === '') {
      delete updatedDef[property];
    } else {
      updatedDef[property] = color;
    }
    setProfileDef(updatedDef);

    // Also update all charset groups if changing master key/text color
    const styleProp = property === 'keysBgColor' ? 'bgColor' : 'color';
    const charsetPresets = ['top-row', 'mid-row', 'bottom-row', 'left-third', 'mid-third', 'right-third', 'left-half', 'right-half'];
    const updatedGroups = styleGroups.map(g => {
      if (charsetPresets.some(p => matchesPreset(g, p))) {
        return { ...g, style: { ...g.style, [styleProp]: color } };
      }
      return g;
    });

    setStyleGroups(updatedGroups);
    refreshState(updatedGroups, updatedDef);
    await saveProfile(updatedDef, updatedGroups);
  }, [profileDef, styleGroups, refreshState, saveProfile]);

  // Handle background color change.
  // '' = system default → stored as undefined so native gets transparent/liquid glass.
  const updateBackgroundColor = useCallback(async (color: string) => {
    if (!profileDef) return;
    const updatedDef: SavedProfileDefinition = { ...profileDef };
    if (color === '') {
      delete updatedDef.backgroundColor;
    } else {
      updatedDef.backgroundColor = color;
    }
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

  // Handle key order change (standard vs alphabetical/ordered)
  const handleKeyOrderChange = useCallback(async (ordered: boolean) => {
    if (!profileDef) return;
    const newKeyboardId = ordered ? `${currentLanguage}_ordered` : currentLanguage;
    const updatedDef = { ...profileDef, keyboardId: newKeyboardId };

    // Update preset group members to match the new keyboard variant
    const updatedGroups = styleGroups.map(group => {
      if (!group.presetId) return group;
      const info = getPresetInfo(group.presetId, currentLanguage, newKeyboardId);
      if (!info) return group;
      return { ...group, members: info.members };
    });

    setProfileDef(updatedDef);
    setCurrentKeyboardId(newKeyboardId);
    setStyleGroups(updatedGroups);
    refreshState(updatedGroups, updatedDef);
    await saveProfile(updatedDef, updatedGroups);
  }, [profileDef, currentLanguage, styleGroups, refreshState, saveProfile]);

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
      if (fromPresets.some(p => matchesPreset(g, p))) {
        return { ...g, active: false };
      }
      // When switching to rows, also deactivate halves (in case we're in 2-group sections mode)
      if (mode === 'rows' && (matchesPreset(g, 'left-half') || matchesPreset(g, 'right-half'))) {
        return { ...g, active: false };
      }
      return g;
    });

    // Activate or create the "to" groups with preserved colors
    for (let i = 0; i < toPresets.length; i++) {
      const presetId = toPresets[i];
      const existing = updatedGroups.find(g => matchesPreset(g, presetId));
      if (existing) {
        updatedGroups = updatedGroups.map(g => {
          if (g.id === existing.id) {
            return { ...g, active: true, style: { ...g.style, bgColor: colors[i].bgColor, color: colors[i].color } };
          }
          return g;
        });
      } else {
        const info = getPresetInfo(presetId, currentLanguage, currentKeyboardId);
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
        if (matchesPreset(g, 'left-half') || matchesPreset(g, 'right-half')) {
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
        const existing = updatedGroups.find(g => matchesPreset(g, presetId));
        if (existing) {
          updatedGroups = updatedGroups.map(g => {
            if (g.id === existing.id) {
              return { ...g, active: true, style: { ...g.style, bgColor: thirdColors[i].bgColor, color: thirdColors[i].color } };
            }
            return g;
          });
        } else {
          const info = getPresetInfo(presetId, currentLanguage, currentKeyboardId);
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
        if (matchesPreset(g, 'left-third') || matchesPreset(g, 'mid-third') || matchesPreset(g, 'right-third')) {
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
        const existing = updatedGroups.find(g => matchesPreset(g, presetId));
        if (existing) {
          updatedGroups = updatedGroups.map(g => {
            if (g.id === existing.id) {
              return { ...g, active: true, style: { ...g.style, bgColor: colors.bgColor, color: colors.color } };
            }
            return g;
          });
        } else {
          const info = getPresetInfo(presetId, currentLanguage, currentKeyboardId);
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
        'space-key', 'delete-key', 'enter-key', 'other-keys'].some(p => matchesPreset(g, p)) &&
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
        name: strings.classic.specialKeys,
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
  }, [profileDef, styleGroups, refreshState, saveProfile, strings]);

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
        name: strings.classic.visibleKeys,
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
  }, [profileDef, styleGroups, refreshState, saveProfile, strings]);

  // Handle key tap on preview keyboard for special-keys-text and visible-keys-text
  const handlePreviewKeyPress = useCallback((event: KeyPressEvent) => {
    const { type, value } = event.nativeEvent;
    // Skip non-character keys
    if (type === 'keyset-changed' || type === 'keyset' || type === 'language' || type === 'longpress' ||
        type === 'enter' || type === 'backspace' || type === 'space' || type === 'shift' ||
        type === 'next-keyboard' || type === 'settings' || type === 'close' || type === 'nikkud') {
      return;
    }
    const keyValue = value;
    if (!keyValue || !keyValue.trim()) return;

    if (activeSetting === 'special-keys-text') {
      const currentMembers = classicState.specialKeysGroup?.members || [];
      const newMembers = currentMembers.includes(keyValue)
        ? currentMembers.filter(k => k !== keyValue)
        : [...currentMembers, keyValue];
      handleSpecialKeysTextChange(newMembers.join(''));
    } else if (activeSetting === 'visible-keys-text') {
      const currentMembers = classicState.visibleKeysGroup?.members || [];
      const newMembers = currentMembers.includes(keyValue)
        ? currentMembers.filter(k => k !== keyValue)
        : [...currentMembers, keyValue];
      handleVisibleKeysTextChange(newMembers.join(''));
    }
  }, [activeSetting, classicState, handleSpecialKeysTextChange, handleVisibleKeysTextChange]);

  // Compute selectedKeysJson for highlighting on the preview keyboard
  const selectedKeysJson = useMemo(() => {
    if (activeSetting !== 'special-keys-text' && activeSetting !== 'visible-keys-text') return undefined;
    const members = activeSetting === 'special-keys-text'
      ? (classicState.specialKeysGroup?.members || [])
      : (classicState.visibleKeysGroup?.members || []);
    if (members.length === 0) return undefined;
    try {
      const config = JSON.parse(configJson);
      const positionIds: string[] = [];
      for (const keyset of (config.keysets || [])) {
        for (let rowIndex = 0; rowIndex < keyset.rows.length; rowIndex++) {
          const row = keyset.rows[rowIndex];
          for (let keyIndex = 0; keyIndex < row.keys.length; keyIndex++) {
            const key = row.keys[keyIndex];
            const kv = key.value || key.caption || key.label || key.type;
            if (kv && members.includes(kv)) {
              positionIds.push(`${keyset.id}:${rowIndex}:${keyIndex}`);
            }
          }
        }
      }
      return JSON.stringify(positionIds);
    } catch {
      return undefined;
    }
  }, [activeSetting, classicState, configJson]);

  // Handle reset
  const handleReset = useCallback(async () => {
    if (!profileDef) return;

    const templateId = extractTemplateId(profileDef.id);
    const template = templateId ? getBuiltInProfileTemplate(templateId) : undefined;
    const message = template
      ? strings.alerts.resetToFactory
      : strings.alerts.clearAllSettings;

    Alert.alert(
      strings.common.reset,
      message,
      [
        { text: strings.common.cancel, style: 'cancel' },
        {
          text: strings.common.reset,
          style: 'destructive',
          onPress: async () => {
            const keyboardId = currentLanguage === 'he' ? 'he' : currentLanguage;
            let resetDef: SavedProfileDefinition;
            let resetGroups: StyleGroup[];

            if (template) {
              resetDef = {
                id: profileDef.id,
                name: getLocalizedProfileName(templateId!, currentLanguage),
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
  }, [profileDef, currentLanguage, refreshState, saveProfile, strings]);

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

  // Get the current color for a setting.
  // Returns '' (system default) when no explicit color is set — matches new editor behavior.
  const getColorForSetting = useCallback((settingId: SettingId): string => {
    if (!classicState || !profileDef) return '';
    const globalKeysBg = profileDef.keysBgColor ?? '';
    const globalText = profileDef.textColor ?? '';
    switch (settingId) {
      case 'bg-color': return profileDef.backgroundColor ?? '';
      case 'keys-color': return globalKeysBg;
      case 'text-color': return globalText;
      case 'space-color': return classicState.actionGroups.space?.style.bgColor || globalKeysBg;
      case 'delete-color': return classicState.actionGroups.delete?.style.bgColor || globalKeysBg;
      case 'enter-color': return classicState.actionGroups.enter?.style.bgColor || globalKeysBg;
      case 'other-color': return classicState.actionGroups.other?.style.bgColor || globalKeysBg;
      case 'group1-keys-color': return classicState.charsetGroups[0]?.style.bgColor || globalKeysBg;
      case 'group1-text-color': return classicState.charsetGroups[0]?.style.color || globalText;
      case 'group2-keys-color': return classicState.charsetGroups[1]?.style.bgColor || globalKeysBg;
      case 'group2-text-color': return classicState.charsetGroups[1]?.style.color || globalText;
      case 'group3-keys-color': return classicState.charsetGroups[2]?.style.bgColor || globalKeysBg;
      case 'group3-text-color': return classicState.charsetGroups[2]?.style.color || globalText;
      case 'special-keys-color': return classicState.specialKeysGroup?.style.bgColor || '#FFFF00';
      case 'special-keys-text-color': return classicState.specialKeysGroup?.style.color || '#000000';
      default: return '';
    }
  }, [classicState, profileDef]);

  // Handle color selection for a setting
  const handleColorSelected = useCallback(async (settingId: SettingId, color: string) => {
    if (!profileDef) return;

    // Helper to build createInfo from a preset ID
    const create = (presetId: string) => {
      const info = getPresetInfo(presetId, currentLanguage, currentKeyboardId);
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
          groups => groups.find(g => matchesPreset(g, 'space-key')),
          'bgColor', color, create('space-key')
        );
        break;
      case 'delete-color':
        await updateStyleGroupColor(
          groups => groups.find(g => matchesPreset(g, 'delete-key')),
          'bgColor', color, create('delete-key')
        );
        break;
      case 'enter-color':
        await updateStyleGroupColor(
          groups => groups.find(g => matchesPreset(g, 'enter-key')),
          'bgColor', color, create('enter-key')
        );
        break;
      case 'other-color':
        await updateStyleGroupColor(
          groups => groups.find(g => matchesPreset(g, 'other-keys')),
          'bgColor', color, create('other-keys')
        );
        break;
      case 'group1-keys-color': {
        const preset = classicState?.divisionMode === 'rows' ? 'top-row' :
          classicState?.threeColorMode === false ? 'right-half' :
          (currentLanguage === 'en' ? 'left-third' : 'right-third');
        await updateStyleGroupColor(
          groups => groups.find(g => matchesPreset(g, preset)),
          'bgColor', color, create(preset)
        );
        break;
      }
      case 'group1-text-color': {
        const preset = classicState?.divisionMode === 'rows' ? 'top-row' :
          classicState?.threeColorMode === false ? 'right-half' :
          (currentLanguage === 'en' ? 'left-third' : 'right-third');
        await updateStyleGroupColor(
          groups => groups.find(g => matchesPreset(g, preset)),
          'color', color, create(preset)
        );
        break;
      }
      case 'group2-keys-color': {
        const preset = classicState?.divisionMode === 'rows' ? 'mid-row' : 'mid-third';
        await updateStyleGroupColor(
          groups => groups.find(g => matchesPreset(g, preset)),
          'bgColor', color, create(preset)
        );
        break;
      }
      case 'group2-text-color': {
        const preset = classicState?.divisionMode === 'rows' ? 'mid-row' : 'mid-third';
        await updateStyleGroupColor(
          groups => groups.find(g => matchesPreset(g, preset)),
          'color', color, create(preset)
        );
        break;
      }
      case 'group3-keys-color': {
        const preset = classicState?.divisionMode === 'rows' ? 'bottom-row' :
          classicState?.threeColorMode === false ? 'left-half' :
          (currentLanguage === 'en' ? 'right-third' : 'left-third');
        await updateStyleGroupColor(
          groups => groups.find(g => matchesPreset(g, preset)),
          'bgColor', color, create(preset)
        );
        break;
      }
      case 'group3-text-color': {
        const preset = classicState?.divisionMode === 'rows' ? 'bottom-row' :
          classicState?.threeColorMode === false ? 'left-half' :
          (currentLanguage === 'en' ? 'right-third' : 'left-third');
        await updateStyleGroupColor(
          groups => groups.find(g => matchesPreset(g, preset)),
          'color', color, create(preset)
        );
        break;
      }
      case 'special-keys-color':
        await updateStyleGroupColor(
          groups => groups.find(g =>
            g.active !== false && g.style.bgColor &&
            !['top-row', 'mid-row', 'bottom-row', 'left-third', 'mid-third', 'right-third',
              'space-key', 'delete-key', 'enter-key', 'other-keys'].some(p => matchesPreset(g, p)) &&
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
              'space-key', 'delete-key', 'enter-key', 'other-keys'].some(p => matchesPreset(g, p)) &&
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
      'bg-color': strings.classic.backgroundColor,
      'keys-color': strings.classic.keysColor,
      'text-color': strings.classic.textColor,
      'space-color': strings.classic.spaceKeyColor,
      'delete-color': strings.classic.deleteKeyColor,
      'enter-color': strings.classic.enterKeyColor,
      'other-color': strings.classic.otherKeysColor,
      'group1-keys-color': strings.classic.highlightKeysColor,
      'group1-text-color': strings.classic.highlightTextColor,
      'group2-keys-color': strings.classic.highlightKeysColor,
      'group2-text-color': strings.classic.highlightTextColor,
      'group3-keys-color': strings.classic.highlightKeysColor,
      'group3-text-color': strings.classic.highlightTextColor,
      'special-keys-text': strings.classic.highlightedCharacters,
      'special-keys-color': strings.classic.highlightKeysColor,
      'special-keys-text-color': strings.classic.highlightTextColor,
      'visible-keys-text': strings.classic.visibleKeys,
      'my-issieboards': strings.editor.myKeyboards,
      'key-order': strings.classic.keyOrder,
      'nikkud': strings.classic.nikkudSettings,
      'division-mode': strings.classic.colorDivision,
      'language': strings.classic.language,
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
        <Text allowFontScaling={false} style={styles.errorText}>{strings.alerts.failedToLoadProfile}</Text>
      </SafeAreaView>
    );
  }

  // Main view: sections list always rendered, detail view on top when active
  return (
    <SafeAreaView style={styles.container}>
      {/* Sections list — always mounted, never unmounted or hidden */}
      <View style={styles.sectionsLayer} pointerEvents={activeSetting ? 'none' : 'auto'}>
        <View style={[styles.header, isRTL && { flexDirection: 'row-reverse' }]}>
          <Text allowFontScaling={false} style={styles.headerTitle}>Issie Board ({strings.editor.classicView})</Text>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity style={styles.advancedButton} onPress={onSwitchToAdvanced}>
              <Text allowFontScaling={false} style={styles.advancedButtonText}>{strings.editor.backToNewsettings}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.aboutButton}
              onPress={() => setShowAbout(true)}
              accessibilityLabel="About"
            >
              <MyIcon info={{ name: 'information-circle-outline', type: 'Ionicons', color: '#3B82F6', size: 24 }} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={[styles.noticeBar, isRTL && { flexDirection: 'row-reverse' }]}>
          <Text allowFontScaling={false} style={styles.noticeIcon}>⚠️</Text>
          <Text allowFontScaling={false} style={[styles.noticeText, isRTL && { textAlign: 'right' }]}>{strings.editor.classicViewNotice}</Text>
        </View>
        <ClassicSectionsList
          classicState={classicState}
          backgroundColor={profileDef.backgroundColor ?? ''}
          keysBgColor={profileDef.keysBgColor ?? ''}
          textColor={profileDef.textColor ?? ''}
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
            selectedKeys={(activeSetting === 'special-keys-text' || activeSetting === 'visible-keys-text') ? selectedKeysJson : undefined}
            onKeyPress={(activeSetting === 'special-keys-text' || activeSetting === 'visible-keys-text') ? handlePreviewKeyPress : undefined}
          >
          {isColorSetting(activeSetting) ? (
            <ClassicColorPicker
              currentColor={getColorForSetting(activeSetting)}
              onColorSelected={(color) => handleColorSelected(activeSetting, color)}
              showSystemDefault={activeSetting === 'bg-color' || activeSetting === 'keys-color' || activeSetting === 'text-color'}
            />
          ) : activeSetting === 'key-order' ? (
            <View style={styles.pickerContainer}>
              <TouchableOpacity
                style={[styles.pickerOption, currentKeyboardId === currentLanguage && styles.pickerOptionActive]}
                onPress={() => handleKeyOrderChange(false)}
              >
                <Text allowFontScaling={false} style={[styles.pickerOptionText, currentKeyboardId === currentLanguage && styles.pickerOptionTextActive]}>
                  {strings.editor.keyboardVariants.standard}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pickerOption, currentKeyboardId === `${currentLanguage}_ordered` && styles.pickerOptionActive]}
                onPress={() => handleKeyOrderChange(true)}
              >
                <Text allowFontScaling={false} style={[styles.pickerOptionText, currentKeyboardId === `${currentLanguage}_ordered` && styles.pickerOptionTextActive]}>
                  {currentLanguage === 'he' ? strings.editor.keyboardVariants.orderedHe : currentLanguage === 'ar' ? strings.editor.keyboardVariants.orderedAr : strings.editor.keyboardVariants.orderedEn}
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
                  {strings.diacritics.basic}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pickerOption, profileDef.diacritics?.[currentKeyboardId]?.simpleMode === false && styles.pickerOptionActive]}
                onPress={() => handleNikkudChange(false)}
              >
                <Text allowFontScaling={false} style={[styles.pickerOptionText, profileDef.diacritics?.[currentKeyboardId]?.simpleMode === false && styles.pickerOptionTextActive]}>
                  {strings.diacritics.full}
                </Text>
              </TouchableOpacity>
            </View>
          ) : activeSetting === 'special-keys-text' ? (
            <View style={styles.textInputContainer}>
              <Text allowFontScaling={false} style={styles.textInputLabel}>
                {strings.styleRuleModal.tapKeysToSelect}
              </Text>
              <TextInput
                style={styles.textInput}
                value={classicState.specialKeysGroup?.members.join('') || ''}
                editable={false}
                placeholder={strings.classic.typeCharacters}
              />
            </View>
          ) : activeSetting === 'visible-keys-text' ? (
            <View style={styles.textInputContainer}>
              <Text allowFontScaling={false} style={styles.textInputLabel}>
                {strings.classic.tapKeysToShow}
              </Text>
              <View style={styles.visibleKeysRow}>
                <TextInput
                  style={[styles.textInput, {flex: 1}]}
                  value={classicState.visibleKeysGroup?.members.join('') || ''}
                  editable={false}
                  placeholder={strings.classic.tapKeysToShow}                />
                {classicState.visibleKeysGroup && classicState.visibleKeysGroup.members.length > 0 && (
                  <TouchableOpacity
                    style={styles.showAllButton}
                    onPress={() => handleVisibleKeysTextChange('')}
                  >
                    <Text allowFontScaling={false} style={styles.showAllButtonText}>
                      {strings.classic.showAll}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
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
            <Text allowFontScaling={false} style={styles.errorText}>{strings.common.error}</Text>
          )}
        </ClassicDetailView>
        </View>
      )}
      <AboutScreen
        visible={showAbout}
        appName="IssieBoard"
        onClose={() => setShowAbout(false)}
        paragraphs={ISSIEBOARD_ABOUT}
      />
      <SaveAsModal
        visible={showSaveAsModal}
        onClose={() => {
          setShowSaveAsModal(false);
          pendingSaveRef.current = null;
          // Revert UI to the original built-in by reloading it
          loadProfile(currentLanguage);
        }}
        onSaveAs={handleSaveAs}
        originalName={profileDef?.name ?? ''}
        existingNames={savedProfiles.map(p => p.name)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
    backgroundColor: '#F5F5F5',
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
  noticeBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFF8E1',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#FFE082',
  },
  noticeIcon: {
    fontSize: 15,
    lineHeight: 20,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: '#6D4C00',
    lineHeight: 18,
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
  aboutButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
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
  visibleKeysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  showAllButton: {
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#C6C6C8',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  showAllButtonText: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '500',
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
