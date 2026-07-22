import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  Animated,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useEditor } from '../../context/EditorContext';
import { useLocalization } from '../../localization';
import { StyleGroup, KeyStyleOverride, KeyboardConfig, VisibilityMode } from '../../../types';
import { CompactColorPicker } from '../shared/CompactColorPicker';
import { ButtonGroupRow } from '../shared/ButtonGroupRow';
import { KeyboardPreview, KeyPressEvent } from '../KeyboardPreview';
import { transformConfigForPreview } from '../../utils/keyboardConfigMerger';
import { MyIcon } from '@beitissieshapiro/issie-shared/dist/icons';

interface AddStyleRuleModalProps {
  visible: boolean;
  editingGroup: StyleGroup | null;
  initialSelectedKeys?: string[]; // Pre-selected key values when creating new rule
  initialName?: string; // Pre-filled name when creating from preset
  initialBgColor?: string; // Pre-filled background color when creating from preset
  initialTextColor?: string; // Pre-filled text color when creating from preset
  initialVisibilityMode?: VisibilityMode; // Pre-filled visibility mode when creating from preset
  isPreset?: boolean; // If true, keys are locked (only colors can be edited)
  presetId?: string; // The predefined rule ID (e.g., "top-row") — stored on the group for auto-update on variant switch
  profileName?: string; // Current profile name for breadcrumb
  hideGlobeButton?: boolean; // Hide globe button in keyboard preview
  hideCloseKey?: boolean; // Hide close button in keyboard preview
  selectedLanguages?: string[]; // Selected languages for IssieVoice language key
  speakButtonInKeyboard?: boolean; // Show speak button in keyboard preview
  appContext?: 'issievoice' | 'issieboard' | 'issiecalc';
  onClose: () => void;
}

export const AddStyleRuleModal: React.FC<AddStyleRuleModalProps> = ({
  visible,
  editingGroup,
  initialSelectedKeys,
  initialName,
  initialBgColor,
  initialTextColor,
  initialVisibilityMode,
  isPreset = false,
  presetId,
  profileName,
  hideGlobeButton,
  hideCloseKey,
  selectedLanguages,
  speakButtonInKeyboard,
  appContext,
  onClose,
}) => {
  const [calcKeyset, setCalcKeyset] = useState<'basic' | 'scientific'>('basic');
  const {
    state,
    createGroupFromValues,
    updateGroup,
  } = useEditor();
  const { strings, isRTL } = useLocalization();

  // Local state for the rule being created/edited
  const [ruleName, setRuleName] = useState('');
  const [selectedKeyValues, setSelectedKeyValues] = useState<string[]>([]);
  const [bgColor, setBgColor] = useState('');
  const [textColor, setTextColor] = useState('');
  const [visibilityMode, setVisibilityMode] = useState<VisibilityMode>('default');

  // Local toast display for this modal
  const [localToastMessage, setLocalToastMessage] = useState<string | null>(null);
  const localToastOpacity = useRef(new Animated.Value(0)).current;

  // Generate a unique name for new rules
  const generateRuleName = useCallback((): string => {
    const prefix = strings.styleRuleModal.groupNamePrefix;
    let counter = 1;
    const existingNames = new Set(state.styleGroups.map(g => g.name));
    while (existingNames.has(`${prefix}-${counter}`)) {
      counter++;
    }
    return `${prefix}-${counter}`;
  }, [state.styleGroups, strings.styleRuleModal.groupNamePrefix]);

  // Show local toast within the modal
  const showLocalToast = useCallback((message: string, duration: number = 2000) => {
    setLocalToastMessage(message);

    Animated.sequence([
      Animated.timing(localToastOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(duration),
      Animated.timing(localToastOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setLocalToastMessage(null);
    });
  }, [localToastOpacity]);

  // Initialize state when modal opens (only on initial open, not on every editingGroup change)
  useEffect(() => {
    if (visible) {
      if (editingGroup) {
        // Editing existing rule
        setRuleName(editingGroup.name);
        setSelectedKeyValues([...editingGroup.members]);
        setBgColor(editingGroup.style.bgColor || '');
        setTextColor(editingGroup.style.color || '');
        // Convert legacy hidden boolean to visibilityMode
        if (editingGroup.style.visibilityMode) {
          setVisibilityMode(editingGroup.style.visibilityMode);
        } else if (editingGroup.style.hidden) {
          setVisibilityMode('hide');
        } else {
          setVisibilityMode('default');
        }
      } else {
        // New rule - use initial values if provided (from template)
        setRuleName(initialName || generateRuleName());
        setSelectedKeyValues(initialSelectedKeys || []);
        setBgColor(initialBgColor || '');
        setTextColor(initialTextColor || '');
        setVisibilityMode(initialVisibilityMode || 'default');
      }
    }
    // Only run when modal visibility changes, not when editingGroup changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Handle key tap - toggle selection
  const handleKeyPress = useCallback((event: KeyPressEvent) => {
    // If in preset mode, keys are locked - show toast in modal
    if (isPreset) {
      showLocalToast(`🔒 ${strings.styleRuleModal.keysLocked}`, 2000);
      return;
    }

    const { type, value } = event.nativeEvent;

    // Skip navigation/system keys that aren't selectable via tap
    if (type === 'keyset-changed') {
      return;
    }

    // Handle long-press on keyset/nikkud keys - the value contains the key type
    // This allows selecting keyset/nikkud keys for styling while they still function on tap
    if (type === 'longpress') {
      const keyType = value; // value is the key type (e.g., "keyset", "nikkud")
      if (!keyType) return;

      setSelectedKeyValues(prev => {
        if (prev.includes(keyType)) {
          return prev.filter(k => k !== keyType);
        } else {
          return [...prev, keyType];
        }
      });
      return;
    }

    // Skip keyset keys on regular tap - they should only be selectable via long-press
    if (type === 'keyset') {
      return;
    }

    // For special keys (enter, shift, backspace, space, nikkud), use the type as the value for storage
    // This ensures they can be selected and styled consistently
    const specialKeyTypes = ['enter', 'shift', 'backspace', 'space', 'settings', 'close', 'nikkud', 'next-keyboard', 'language', 'suggestion'];
    const keyValue = specialKeyTypes.includes(type) ? type : (value || type);

    if (!keyValue) return;

    setSelectedKeyValues(prev => {
      if (prev.includes(keyValue)) {
        return prev.filter(k => k !== keyValue);
      } else {
        return [...prev, keyValue];
      }
    });
  }, [isPreset, editingGroup, showLocalToast]);

  const handleCancel = () => {
    onClose();
  };

  const handleOk = () => {
    if (selectedKeyValues.length === 0) {
      handleCancel();
      return;
    }

    const style: KeyStyleOverride = {};
    if (bgColor) style.bgColor = bgColor;
    if (textColor) style.color = textColor;
    // Set visibility mode (only if not default)
    if (visibilityMode !== 'default') {
      style.visibilityMode = visibilityMode;
      // For "hide" mode: apply opacity 0.3 to selected keys (they will be hidden)
      // For "showOnly" mode: don't set opacity on selected keys (they will be shown)
      // The opacity will be applied to non-selected keys by the renderer
      if (visibilityMode === 'hide') {
        style.opacity = 0.3;
      }
    }

    if (editingGroup) {
      updateGroup(editingGroup.id, {
        name: ruleName.trim() || editingGroup.name,
        members: selectedKeyValues,
        style,
      });
    } else {
      const name = ruleName.trim() || generateRuleName();
      createGroupFromValues(name, selectedKeyValues, style, true, presetId);
    }

    onClose();
  };

  // Build config with:
  // ONLY the current rule being edited/created
  // DO NOT include other style groups - only show general settings + current group
  // IMPORTANT: In the modal preview, we show opacity effect (0.3) to preview semi-hidden keys,
  // but we don't fully hide keys (visibility modes) because we need all keys visible for selection.
  const previewConfig = useMemo((): KeyboardConfig => {
    const groups: any[] = [];

    if (selectedKeyValues.length > 0) {
      if (visibilityMode === 'hide') {
        // For "hide" mode: apply opacity to selected keys (they will be hidden)
        groups.push({
          name: '_current_rule_',
          items: selectedKeyValues,
          template: {
            color: '',
            bgColor: '',
            opacity: 0.3,
            hidden: false,
            visibilityMode: 'default' as VisibilityMode,
          },
        });
      } else if (visibilityMode === 'showOnly') {
        // For "showOnly" mode: apply opacity to NON-selected keys (they will be hidden)
        // Essential keys (functional keys) should never be dimmed
        const essentialTypes = new Set(['space', 'backspace', 'enter', 'next-keyboard', 'settings', 'shift', 'keyset', 'nikkud', 'close', 'language']);
        const essentialValues = new Set([' ', ',', '.']);

        // Collect all non-essential key values from the keyboard
        const allKeyValues = new Set<string>();
        for (const keyset of state.config.keysets) {
          for (const row of keyset.rows) {
            for (const key of row.keys) {
              const keyType = (key.type || '').toLowerCase();
              // Skip essential keys - they should never be dimmed
              if (essentialTypes.has(keyType)) continue;
              const keyValue = key.value || key.caption || key.label || key.type;
              if (keyValue && !essentialValues.has(keyValue)) allKeyValues.add(keyValue);
            }
          }
        }
        // Find keys that are NOT selected (essential keys already excluded above)
        const nonSelectedKeys = Array.from(allKeyValues).filter(k => !selectedKeyValues.includes(k));

        // Add group for selected keys with colors (they will be shown)
        groups.push({
          name: '_current_rule_selected_',
          items: selectedKeyValues,
          template: {
            color: textColor || '',
            bgColor: bgColor || '',
            opacity: 1.0,
            hidden: false,
            visibilityMode: 'default' as VisibilityMode,
          },
        });

        // Add group for non-selected keys with opacity (they will be hidden)
        if (nonSelectedKeys.length > 0) {
          groups.push({
            name: '_current_rule_others_',
            items: nonSelectedKeys,
            template: {
              color: '',
              bgColor: '',
              opacity: 0.3,
              hidden: false,
              visibilityMode: 'default' as VisibilityMode,
            },
          });
        }
      } else {
        // Default mode: just apply colors to selected keys
        groups.push({
          name: '_current_rule_',
          items: selectedKeyValues,
          template: {
            color: textColor || '',
            bgColor: bgColor || '',
            opacity: 1.0,
            hidden: false,
            visibilityMode: 'default' as VisibilityMode,
          },
        });
      }
    }

    // Filter close/settings/globe keys for IssieVoice context
    const hideKeys = new Set<string>();
    if (hideCloseKey) hideKeys.add('close');
    if (hideGlobeButton) { hideKeys.add('settings'); hideKeys.add('next-keyboard'); }

    const filteredConfig = hideKeys.size > 0 ? {
      ...state.config,
      keysets: state.config.keysets.map((keyset: any) => ({
        ...keyset,
        rows: keyset.rows.map((row: any) => ({
          ...row,
          keys: row.keys.filter((key: any) => !hideKeys.has(key.type)),
        })),
      })),
    } : state.config;

    // Inject language key for IssieVoice when multiple languages are selected
    const LANG_CYCLE: string[] = ['he', 'en', 'ar'];
    const LANG_LABELS: Record<string, string> = { he: 'עב', en: 'En', ar: 'عر' };
    const activeLangs = selectedLanguages && selectedLanguages.length > 1
      ? LANG_CYCLE.filter(l => selectedLanguages.includes(l))
      : [];
    const kbLang = state.config.language || state.config.keyboards?.[0]?.split('_')[0] || 'he';
    const langLabel = activeLangs.length > 1
      ? LANG_LABELS[activeLangs[(activeLangs.indexOf(kbLang) + 1) % activeLangs.length]] || ''
      : '';

    // Don't hardcode bgColor — let the group being edited control the color
    const langKeyHasGroup = selectedKeyValues.includes('language') || state.styleGroups.some(g => g.active !== false && g.members.includes('language'));
    const langKeyBgColor = langKeyHasGroup ? undefined : '#2563EB';

    const baseConfig = langLabel ? {
      ...filteredConfig,
      keysets: filteredConfig.keysets.map((keyset: any) => ({
        ...keyset,
        rows: keyset.rows.map((row: any) => {
          const hasSpaceKey = row.keys.some((k: any) => k.type === 'space' || k.value === ' ');
          const isBottomRow = row.alwaysInclude || hasSpaceKey;
          if (!isBottomRow) return row;
          const hasLanguageKey = row.keys.some((k: any) => k.type === 'language');
          if (hasLanguageKey) {
            return { ...row, keys: row.keys.map((k: any) =>
              k.type === 'language' ? { ...k, label: langLabel, caption: langLabel } : k
            )};
          }
          const newKeys = row.keys.reduce((acc: any[], key: any, idx: number) => {
            acc.push(key);
            if (idx === 0) {
              acc.push({ type: 'language', label: langLabel, caption: langLabel, value: '', width: 1, ...(langKeyBgColor && { bgColor: langKeyBgColor }) });
            }
            return acc;
          }, []);
          return { ...row, keys: newKeys };
        }),
      })),
    } : filteredConfig;

    // Inject speak key into abc keyset if speak-in-keyboard is enabled
    const hasSpeakGroup = selectedKeyValues.includes('speak') || state.styleGroups.some(g => g.active !== false && g.members.includes('speak'));
    const speakKeyBgColor = hasSpeakGroup ? undefined : '#2196F3';
    const speakKeyTextColor = hasSpeakGroup ? undefined : '#FFFFFF';
    const finalConfig = speakButtonInKeyboard
      ? {
          ...baseConfig,
          keysets: baseConfig.keysets.map((keyset: any) => {
            if (keyset.id !== 'abc' && keyset.id !== 'abc_large') return keyset;
            return {
              ...keyset,
              rows: keyset.rows.map((row: any) => {
                const hasSpaceKey = row.keys.some((k: any) => k.type === 'space' || k.value === ' ');
                const hasControlKeys = row.keys.some((k: any) =>
                  k.type === 'keyset' || k.type === 'next-keyboard' || k.type === 'close'
                );
                const isBottomRow = row.alwaysInclude || hasSpaceKey || hasControlKeys;
                if (!isBottomRow) return row;

                const lastKeysetIndex = row.keys.reduce((lastIdx: number, key: any, idx: number) =>
                  key.type === 'keyset' ? idx : lastIdx, -1);
                if (lastKeysetIndex === -1) return row;

                const newKeys = [...row.keys];
                newKeys[lastKeysetIndex] = {
                  type: 'event',
                  value: 'speak',
                  label: '🔊 Speak',
                  caption: '🔊 Speak',
                  width: 2,
                  ...(speakKeyBgColor && { bgColor: speakKeyBgColor }),
                  ...(speakKeyTextColor && { textColor: speakKeyTextColor }),
                } as any;
                return { ...row, keys: newKeys };
              }),
            };
          }),
        }
      : baseConfig;

    return {
      ...finalConfig,
      groups, // Only the current group being edited, not other groups
      wordSuggestionsEnabled: state.config.wordSuggestionsEnabled ?? true,
    };
  }, [state.config, state.styleGroups, selectedKeyValues, bgColor, textColor, visibilityMode, hideCloseKey, hideGlobeButton, selectedLanguages, speakButtonInKeyboard]);

  const previewConfigJson = useMemo(() => {
    const base = transformConfigForPreview(previewConfig);
    if (appContext === 'issiecalc') {
      return JSON.stringify({ ...base, defaultKeyset: calcKeyset });
    }
    return JSON.stringify(base);
  }, [previewConfig, appContext, calcKeyset]);

  // Get window dimensions to detect orientation
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isPortrait = windowHeight > windowWidth;

  // Modal preview height - 1.5x taller in portrait for better visibility
  const modalPreviewHeight = isPortrait ? 280 : 200;

  // Build selected keys JSON for highlighting in the preview
  const selectedKeysJson = useMemo(() => {
    if (selectedKeyValues.length === 0) return undefined;

    // Convert key values to position IDs for highlighting
    // Use previewConfig.keysets (not state.config.keysets) so injected keys like language are included
    const positionIds: string[] = [];
    for (const keyset of previewConfig.keysets) {
      for (let rowIndex = 0; rowIndex < keyset.rows.length; rowIndex++) {
        const row = keyset.rows[rowIndex];
        for (let keyIndex = 0; keyIndex < row.keys.length; keyIndex++) {
          const key = row.keys[keyIndex];
          // Check both the key value and the key type for special keys like keyset/nikkud
          const keyValue = key.value || key.caption || key.label || key.type;
          const keyType = key.type;
          // Match by value OR by type (for special keys stored by type)
          const isSelected = (keyValue && selectedKeyValues.includes(keyValue)) ||
                            (keyType && selectedKeyValues.includes(keyType));
          if (isSelected) {
            positionIds.push(`${keyset.id}:${rowIndex}:${keyIndex}`);
          }
        }
      }
    }
    return JSON.stringify(positionIds);
  }, [selectedKeyValues, previewConfig.keysets]);

  // Also pass "suggestion" as a selected key if it's in the selection
  // The native renderer checks for this directly to highlight suggestion pills
  const finalSelectedKeysJson = useMemo(() => {
    if (!selectedKeysJson && !selectedKeyValues.includes('suggestion')) return undefined;
    const ids: string[] = selectedKeysJson ? JSON.parse(selectedKeysJson) : [];
    if (selectedKeyValues.includes('suggestion')) {
      ids.push('suggestion');
    }
    return JSON.stringify(ids);
  }, [selectedKeysJson, selectedKeyValues]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={handleCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header with title and action buttons */}
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              {profileName && (
                <>
                <Text allowFontScaling={false} style={styles.breadcrumb}>
                  {profileName}
                </Text>
                <Text allowFontScaling={false} style={styles.breadcrumb}>
                 {isRTL? ' <- ':' -> '}
                 </Text>
                 </>
              )}
              <Text allowFontScaling={false} style={styles.headerTitle}>
                {editingGroup ? editingGroup.name : (ruleName || (isPreset ? initialName : strings.styleRuleModal.newKeysGroup))}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={handleCancel}
                activeOpacity={0.7}>
                <MyIcon info={{ name: 'close', type: 'Ionicons', color: '#6B7280', size: 16 }} />
                <Text allowFontScaling={false} style={styles.headerButtonTextGray}>{strings.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerButton, selectedKeyValues.length === 0 && styles.headerButtonDisabled]}
                onPress={handleOk}
                activeOpacity={0.7}
                disabled={selectedKeyValues.length === 0}>
                <MyIcon info={{ name: 'checkmark', type: 'Ionicons', color: selectedKeyValues.length === 0 ? '#9CA3AF' : '#3B82F6', size: 16 }} />
                <Text allowFontScaling={false} style={[styles.headerButtonTextBlue, selectedKeyValues.length === 0 && styles.headerButtonTextDisabled]}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Name input row - hidden for presets */}
          {!isPreset && (
            <View style={styles.nameRow}>
              <Text allowFontScaling={false} style={styles.nameLabel}>{strings.styleRuleModal.nameLabel}:</Text>
              <TextInput
                style={[styles.nameInput, isRTL && {direction:"rtl", textAlign:"right"}]}
                value={ruleName}
                onChangeText={setRuleName}
                placeholder={strings.styleRuleModal.namePlaceholder}
              />
            </View>
          )}

          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
            {/* Keyboard Preview */}
            <View style={styles.section}>
              <Text allowFontScaling={false} style={styles.sectionTitle}>
                {isPreset
                  ? strings.styleRuleModal.presetKeysLocked
                  : strings.styleRuleModal.tapKeysToSelect}
              </Text>
              {appContext === 'issiecalc' && (
                <View style={styles.calcToggle}>
                  <TouchableOpacity
                    style={[styles.calcToggleBtn, calcKeyset === 'basic' && styles.calcToggleBtnActive]}
                    onPress={() => setCalcKeyset('basic')}>
                    <Text allowFontScaling={false} style={[styles.calcToggleText, calcKeyset === 'basic' && styles.calcToggleTextActive]}>Basic</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.calcToggleBtn, calcKeyset === 'scientific' && styles.calcToggleBtnActive]}
                    onPress={() => setCalcKeyset('scientific')}>
                    <Text allowFontScaling={false} style={[styles.calcToggleText, calcKeyset === 'scientific' && styles.calcToggleTextActive]}>Scientific</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.previewContainer}>
                <KeyboardPreview
                  key="modal-preview"
                  style={{ height: modalPreviewHeight }}
                  configJson={previewConfigJson}
                  selectedKeys={finalSelectedKeysJson}
                  maxHeight={modalPreviewHeight}
                  hideGlobeButton={hideGlobeButton}
                  onKeyPress={handleKeyPress}
                />
              </View>
            </View>

            {/* Visibility Mode */}
            <View>
              <ButtonGroupRow
                isRTL={isRTL}
                title={strings.styleRuleModal.visibility}
                options={[
                  { id: 'default', label: strings.styleRuleModal.visibilityDefault },
                  { id: 'hide', label: strings.styleRuleModal.visibilityHide },
                  { id: 'showOnly', label: strings.styleRuleModal.visibilityShowOnly },
                ]}
                selectedId={visibilityMode}
                onSelect={(id) => setVisibilityMode(id as VisibilityMode)}
              />
              {visibilityMode === 'showOnly' && (
                <Text allowFontScaling={false} style={styles.visibilityHint}>
                  {strings.styleRuleModal.showOnlyHint}
                </Text>
              )}
              {visibilityMode === 'hide' && (
                <Text allowFontScaling={false} style={styles.visibilityHint}>
                  {strings.styleRuleModal.hiddenHint}
                </Text>
              )}
            </View>

            {/* Background Color - only show if not in "hide" mode */}
            {visibilityMode !== 'hide' && (
              <CompactColorPicker
                title={strings.styleRuleModal.bgColor}
                value={bgColor}
                onChange={setBgColor}
                showSystemDefault
                systemDefaultLabel={strings.common.default}
              />
            )}

            {/* Text Color - only show if not in "hide" mode */}
            {visibilityMode !== 'hide' && (
              <CompactColorPicker
                title={strings.styleRuleModal.textColor}
                value={textColor}
                onChange={setTextColor}
                showSystemDefault
                systemDefaultLabel={strings.common.default}
              />
            )}
          </ScrollView>
        </View>

        {/* Toast notification for locked keys (displayed inside modal) */}
        {localToastMessage && (
          <Animated.View style={[styles.toast, { opacity: localToastOpacity }]}>
            <Text allowFontScaling={false} style={styles.toastText}>{localToastMessage}</Text>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 700,
    height: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  breadcrumb: {
    fontSize: 15,
    fontWeight: '500',
    color: '#999',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333',
    flexShrink: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
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
  headerButtonDisabled: {
    opacity: 0.5,
  },
  headerButtonTextGray: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  headerButtonTextBlue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  headerButtonTextDisabled: {
    color: '#9CA3AF',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    gap: 12,
  },
  nameLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  cancelHeaderButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  cancelHeaderText: {
    fontSize: 16,
    color: '#666',
  },
  saveHeaderButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  saveHeaderButtonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  saveHeaderText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  saveHeaderTextDisabled: {
    color: '#EEE',
  },
  previewSection: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 8,
    overflow: 'hidden',  // Prevent keyboard from overflowing
  },
  previewLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  keyboardPreview: {
    // Height set dynamically via inline style
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    textAlign:"left",
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#DDD',
  },
  nameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
  },
  selectedKeysHeader: {
    marginBottom: 12,
  },
  calcToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    marginBottom: 6,
  },
  calcToggleBtn: {
    paddingHorizontal: 20,
    paddingVertical: 5,
    borderRadius: 7,
  },
  calcToggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  calcToggleText: {
    fontSize: 13,
    color: '#666',
  },
  calcToggleTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  previewContainer: {
    backgroundColor: '#CBCFD8',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedKeysList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  moreKeysText: {
    fontSize: 11,
    color: '#666',
    alignSelf: 'center',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  optionInfo: {
    flex: 1,
    marginRight: 12,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  optionDescription: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  visibilityHint: {
    fontSize: 11,
    color: '#FF9800',
    marginTop: -12,
    marginBottom: 20,
    marginLeft: 0,
    fontStyle: 'italic',
  },
  // Predefined rules styles
  browsePredefinedButton: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#81C784',
  },
  browsePredefinedButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#388E3C',
  },
  predefinedRulesContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  languageSelectorContainer: {
    marginBottom: 12,
  },
  languageSelectorLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#555',
    marginBottom: 6,
  },
  languageButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  languageButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  languageButtonSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  languageButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  languageButtonTextSelected: {
    color: '#FFF',
    fontWeight: '600',
  },
  rulesList: {
    gap: 8,
  },
  ruleItem: {
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  ruleItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  ruleItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  ruleItemColors: {
    flexDirection: 'row',
    gap: 4,
  },
  colorPreview: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  ruleItemDescription: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  ruleItemKeys: {
    fontSize: 11,
    color: '#999',
    fontFamily: 'monospace',
  },
  toast: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default AddStyleRuleModal;