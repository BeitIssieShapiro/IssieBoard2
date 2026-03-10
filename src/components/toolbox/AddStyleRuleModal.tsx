import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useEditor } from '../../context/EditorContext';
import { StyleGroup, KeyStyleOverride, KeyboardConfig, VisibilityMode } from '../../../types';
import { CompactColorPicker } from '../shared/CompactColorPicker';
import { ButtonGroupRow } from '../shared/ButtonGroupRow';
import { KeyboardPreview, KeyPressEvent } from '../KeyboardPreview';
import { ActionButton } from '../shared/ActionButton';

interface AddStyleRuleModalProps {
  visible: boolean;
  editingGroup: StyleGroup | null;
  initialSelectedKeys?: string[]; // Pre-selected key values when creating new rule
  initialName?: string; // Pre-filled name when creating from preset
  initialBgColor?: string; // Pre-filled background color when creating from preset
  initialTextColor?: string; // Pre-filled text color when creating from preset
  initialVisibilityMode?: VisibilityMode; // Pre-filled visibility mode when creating from preset
  isPreset?: boolean; // If true, keys are locked (only colors can be edited)
  profileName?: string; // Current profile name for breadcrumb
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
  profileName,
  onClose,
}) => {
  const { 
    state, 
    createGroupFromValues,
    updateGroup,
  } = useEditor();

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
    let counter = 1;
    const existingNames = new Set(state.styleGroups.map(g => g.name));
    while (existingNames.has(`rule-${counter}`)) {
      counter++;
    }
    return `rule-${counter}`;
  }, [state.styleGroups]);

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
    if (isPreset && !editingGroup) {
      showLocalToast('🔒 Keys locked. Only colors can be changed.', 2000);
      return;
    }

    const { type, value } = event.nativeEvent;

    // Skip navigation/system keys that aren't selectable via tap
    if (type === 'keyset-changed' || type === 'next-keyboard' || type === 'language') {
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

    // Skip keyset and nikkud keys on regular tap - they should only be selectable via long-press
    if (type === 'keyset' || type === 'nikkud') {
      return;
    }

    // For special keys (enter, shift, backspace, space), use the type as the value for storage
    // This ensures they can be selected and styled consistently
    const specialKeyTypes = ['enter', 'shift', 'backspace', 'space', 'settings', 'close'];
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
      createGroupFromValues(name, selectedKeyValues, style);
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
        // First, collect all key values from the keyboard
        const allKeyValues = new Set<string>();
        for (const keyset of state.config.keysets) {
          for (const row of keyset.rows) {
            for (const key of row.keys) {
              const keyValue = key.value || key.caption || key.label || key.type;
              if (keyValue) allKeyValues.add(keyValue);
            }
          }
        }
        // Find keys that are NOT selected
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

    return {
      ...state.config,
      groups, // Only the current group being edited, not other groups
      wordSuggestionsEnabled: false, // Disable word suggestions in modal preview
    };
  }, [state.config, selectedKeyValues, bgColor, textColor, visibilityMode]);

  const previewConfigJson = useMemo(() => JSON.stringify(previewConfig), [previewConfig]);

  // Get window dimensions to detect orientation
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isPortrait = windowHeight > windowWidth;

  // Modal preview height - 1.5x taller in portrait for better visibility
  const modalPreviewHeight = isPortrait ? 280 : 200;

  // Build selected keys JSON for highlighting in the preview
  const selectedKeysJson = useMemo(() => {
    if (selectedKeyValues.length === 0) return undefined;
    
    // Convert key values to position IDs for highlighting
    const positionIds: string[] = [];
    for (const keyset of state.config.keysets) {
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
  }, [selectedKeyValues, state.config.keysets]);

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
                <Text allowFontScaling={false} style={styles.breadcrumb}>
                  {profileName} →{' '}
                </Text>
              )}
              <Text allowFontScaling={false} style={styles.headerTitle}>
                {editingGroup ? editingGroup.name : (ruleName || (isPreset ? initialName : 'New Keys Group'))}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <ActionButton
                label="Cancel"
                color="gray"
                onPress={handleCancel}
              />
              <ActionButton
                label={editingGroup ? 'Save' : (isPreset ? 'Apply' : 'Create')}
                color="green"
                onPress={handleOk}
                disabled={selectedKeyValues.length === 0}
              />
            </View>
          </View>

          {/* Name input row - hidden for presets */}
          {!isPreset && (
            <View style={styles.nameRow}>
              <Text allowFontScaling={false} style={styles.nameLabel}>Name:</Text>
              <TextInput
                style={styles.nameInput}
                value={ruleName}
                onChangeText={setRuleName}
                placeholder="Enter group name..."
              />
            </View>
          )}

          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
            {/* Keyboard Preview */}
            <View style={styles.section}>
              <Text allowFontScaling={false} style={styles.sectionTitle}>
                {isPreset && !editingGroup
                  ? `Preset keys (${selectedKeyValues.length} keys locked)`
                  : `Tap keys to select/deselect (${selectedKeyValues.length} selected)`}
              </Text>
              <View style={styles.previewContainer}>
                <KeyboardPreview
                  key="modal-preview"
                  style={{ height: modalPreviewHeight }}
                  configJson={previewConfigJson}
                  selectedKeys={selectedKeysJson}
                  maxHeight={modalPreviewHeight}
                  onKeyPress={handleKeyPress}
                />
              </View>
            </View>

            {/* Visibility Mode */}
            <View>
              <ButtonGroupRow
                title="Visibility"
                options={[
                  { id: 'default', label: 'Default' },
                  { id: 'hide', label: 'Hide' },
                  { id: 'showOnly', label: 'Show Only' },
                ]}
                selectedId={visibilityMode}
                onSelect={(id) => setVisibilityMode(id as VisibilityMode)}
              />
              {visibilityMode === 'showOnly' && (
                <Text allowFontScaling={false} style={styles.visibilityHint}>
                  ⓘ Other keys shown semi-transparent in preview mode
                </Text>
              )}
              {visibilityMode === 'hide' && (
                <Text allowFontScaling={false} style={styles.visibilityHint}>
                  ⓘ Hidden keys shown semi-transparent in preview mode
                </Text>
              )}
            </View>

            {/* Background Color - only show if not in "hide" mode */}
            {visibilityMode !== 'hide' && (
              <CompactColorPicker
                title="Background Color"
                value={bgColor}
                onChange={setBgColor}
                showSystemDefault
                systemDefaultLabel="Default"
              />
            )}

            {/* Text Color - only show if not in "hide" mode */}
            {visibilityMode !== 'hide' && (
              <CompactColorPicker
                title="Text Color"
                value={textColor}
                onChange={setTextColor}
                showSystemDefault
                systemDefaultLabel="Default"
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