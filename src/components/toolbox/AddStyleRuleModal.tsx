import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  Switch,
  useWindowDimensions,
} from 'react-native';
import { useEditor, getKeyValueFromPositionId } from '../../context/EditorContext';
import { StyleGroup, KeyStyleOverride, KeyboardConfig, VisibilityMode, PredefinedStyleRule } from '../../../types';
import { ColorPickerRow } from '../shared/ColorPickerRow';
import { ButtonGroupRow } from '../shared/ButtonGroupRow';
import { KeyboardPreview, KeyPressEvent } from '../KeyboardPreview';
import { getPredefinedRules, getAvailableLanguages } from '../../utils/predefinedRules';
import { ActionButton } from '../shared/ActionButton';
import KeyboardPreferences, { KeyboardDimensions } from '../../native/KeyboardPreferences';

interface AddStyleRuleModalProps {
  visible: boolean;
  editingGroup: StyleGroup | null;
  initialSelectedKeys?: string[]; // Pre-selected key values when creating new rule
  initialName?: string; // Pre-filled name when creating from template
  initialBgColor?: string; // Pre-filled background color when creating from template
  initialTextColor?: string; // Pre-filled text color when creating from template
  initialVisibilityMode?: VisibilityMode; // Pre-filled visibility mode when creating from template
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
  const [isActive, setIsActive] = useState(true);

  // Predefined rules browsing state
  const [showPredefinedRules, setShowPredefinedRules] = useState(false);

  // Get current keyboard language
  const currentLanguage = useMemo(() => {
    return state.config.defaultKeyboard || state.config.keyboards[0] || 'en';
  }, [state.config]);

  // Get current language's predefined rules
  const currentPredefinedRules = useMemo(() => {
    return getPredefinedRules(currentLanguage);
  }, [currentLanguage]);

  // Handle applying a predefined rule
  const handleApplyPredefinedRule = useCallback((rule: PredefinedStyleRule) => {
    setRuleName(rule.name);
    setSelectedKeyValues([...rule.members]);
    setBgColor(rule.style.bgColor || '');
    setTextColor(rule.style.color || '');
    setVisibilityMode(rule.style.visibilityMode || 'default');
    setShowPredefinedRules(false);
  }, []);

  // Generate a unique name for new rules
  const generateRuleName = useCallback((): string => {
    let counter = 1;
    const existingNames = new Set(state.styleGroups.map(g => g.name));
    while (existingNames.has(`rule-${counter}`)) {
      counter++;
    }
    return `rule-${counter}`;
  }, [state.styleGroups]);

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
        setIsActive(editingGroup.active !== false);
      } else {
        // New rule - use initial values if provided (from template)
        setRuleName(initialName || generateRuleName());
        setSelectedKeyValues(initialSelectedKeys || []);
        setBgColor(initialBgColor || '');
        setTextColor(initialTextColor || '');
        setVisibilityMode(initialVisibilityMode || 'default');
        setIsActive(true);
      }
      // Reset predefined rules browser state when opening
      setShowPredefinedRules(false);
    } else {
      // Reset predefined rules browser state when closing
      setShowPredefinedRules(false);
    }
    // Only run when modal visibility changes, not when editingGroup changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Handle key tap - toggle selection
  const handleKeyPress = useCallback((event: KeyPressEvent) => {
    const { type, value } = event.nativeEvent;
    
    console.log(`[AddStyleRuleModal] handleKeyPress: type='${type}', value='${value}'`);
    
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
    
    console.log(`[AddStyleRuleModal] Toggling key selection: '${keyValue}'`);
    
    setSelectedKeyValues(prev => {
      if (prev.includes(keyValue)) {
        return prev.filter(k => k !== keyValue);
      } else {
        return [...prev, keyValue];
      }
    });
  }, []);

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
    }

    if (editingGroup) {
      updateGroup(editingGroup.id, {
        name: ruleName.trim() || editingGroup.name,
        members: selectedKeyValues,
        style,
        active: isActive,
      });
    } else {
      const name = ruleName.trim() || generateRuleName();
      createGroupFromValues(name, selectedKeyValues, style, isActive);
    }

    onClose();
  };

  // Build config with:
  // ONLY the current rule being edited/created
  // DO NOT include other style groups - only show general settings + current group
  // IMPORTANT: In the modal preview, we DON'T apply visibility modes (hide/showOnly)
  // because we need all keys visible for selection/deselection.
  // Also respect the local isActive state (not applied to main editor until save)
  const previewConfig = useMemo((): KeyboardConfig => {
    const groups: any[] = [];

    // Only add current rule's style for selected keys if isActive is true
    // This shows the preview effect of toggling active without affecting the main editor
    if (selectedKeyValues.length > 0 && isActive) {
      groups.push({
        name: '_current_rule_',
        items: selectedKeyValues,
        template: {
          // Only apply colors if not in "hide" mode (hidden keys don't need colors)
          color: visibilityMode !== 'hide' ? (textColor || '') : '',
          bgColor: visibilityMode !== 'hide' ? (bgColor || '') : '',
          // Don't apply visibility in modal preview - keep all keys visible for selection
          hidden: false,
          visibilityMode: 'default' as VisibilityMode,
        },
      });
    }

    return {
      ...state.config,
      groups, // Only the current group being edited, not other groups
      wordSuggestionsEnabled: false, // Disable word suggestions in modal preview
    };
  }, [state.config, selectedKeyValues, bgColor, textColor, visibilityMode, isActive]);

  const previewConfigJson = useMemo(() => JSON.stringify(previewConfig), [previewConfig]);

  // Calculate dynamic height for modal preview based on number of rows
  const modalPreviewHeight = useMemo(() => {
    const activeKeyset = state.config.keysets.find(ks => ks.id === state.activeKeyset);
    const numRows = activeKeyset?.rows?.length || 4;

    // Height calculation (no suggestions bar in preview):
    // - Each row: ~50px
    // - Row spacing: ~10px between rows
    const rowHeight = 50;
    const rowSpacing = 10;

    return (numRows * rowHeight) + ((numRows - 1) * rowSpacing);
  }, [state.config.keysets, state.activeKeyset]);

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

  // Get display for a key value
  const getKeyDisplay = (keyValue: string): string => {
    const specialKeys: Record<string, string> = {
      'backspace': '⌫',
      'enter': '⏎',
      'shift': '⇧',
      'space': '␣',
      'settings': '⚙️',
      'close': '✕',
      'keyset': '123',
      'nikkud': 'ניקוד',
    };
    return specialKeys[keyValue] || keyValue;
  };

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
            <Text allowFontScaling={false} style={styles.headerTitle}>
              {editingGroup ? 'Edit Keys Group' : 'New Keys Group'}
            </Text>
            <View style={styles.headerActions}>
              <ActionButton
                label="Cancel"
                color="gray"
                onPress={handleCancel}
              />
              <ActionButton
                label={editingGroup ? 'Save' : 'Create'}
                color="green"
                onPress={handleOk}
                disabled={selectedKeyValues.length === 0}
              />
            </View>
          </View>

          {/* Name input row */}
          <View style={styles.nameRow}>
            <Text allowFontScaling={false} style={styles.nameLabel}>Name:</Text>
            <TextInput
              style={styles.nameInput}
              value={ruleName}
              onChangeText={setRuleName}
              placeholder="Enter group name..."
            />
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
            {/* Keys with inline badges and Preview */}
            <View style={styles.section}>
              <View style={styles.keysRow}>
                <Text allowFontScaling={false} style={styles.sectionTitle}>Keys:</Text>
                <View style={styles.inlineKeysList}>
                  {selectedKeyValues.slice(0, 7).map((keyValue, index) => (
                    <View key={index} style={styles.keyBadge}>
                      <Text allowFontScaling={false} style={styles.keyBadgeText}>{getKeyDisplay(keyValue)}</Text>
                    </View>
                  ))}
                  {selectedKeyValues.length > 7 && (
                    <Text allowFontScaling={false} style={styles.ellipsisText}>...</Text>
                  )}
                </View>
              </View>
              {/* Keyboard Preview */}
              <View style={styles.previewContainer}>
                <KeyboardPreview
                  key="modal-preview"
                  style={[styles.keyboardPreview, { height: modalPreviewHeight }]}
                  configJson={previewConfigJson}
                  selectedKeys={selectedKeysJson}
                  disableDimensionStorage={true}
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
                  ⓘ All keys except these will be hidden
                </Text>
              )}
              {visibilityMode === 'hide' && (
                <Text allowFontScaling={false} style={styles.visibilityHint}>
                  ⓘ Colors are not applicable for hidden keys
                </Text>
              )}
            </View>

            {/* Background Color - only show if not in "hide" mode */}
            {visibilityMode !== 'hide' && (
              <ColorPickerRow
                title="Background Color"
                value={bgColor}
                onChange={setBgColor}
                showSystemDefault
                systemDefaultLabel="Default"
              />
            )}

            {/* Text Color - only show if not in "hide" mode */}
            {visibilityMode !== 'hide' && (
              <ColorPickerRow
                title="Text Color"
                value={textColor}
                onChange={setTextColor}
                presets={[
                  '#000000', '#FFFFFF', '#F44336', '#2196F3', 
                  '#4CAF50', '#FF9800', '#9C27B0', '#607D8B',
                ]}
                showSystemDefault
                systemDefaultLabel="Default"
              />
            )}

            {/* Active Toggle - at the end */}
            <View style={styles.optionRow}>
              <View style={styles.optionInfo}>
                <Text allowFontScaling={false} style={styles.optionLabel}>Active</Text>
                <Text allowFontScaling={false} style={styles.optionDescription}>Apply this rule to the keyboard</Text>
              </View>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{ false: '#ccc', true: '#81C784' }}
                thumbColor={isActive ? '#4CAF50' : '#f4f3f4'}
              />
            </View>
          </ScrollView>
        </View>
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
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333',
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
  keysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  inlineKeysList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  ellipsisText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  previewContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
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
  keyBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  keyBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1976D2',
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
});

export default AddStyleRuleModal;