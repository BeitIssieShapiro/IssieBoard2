import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Switch,
} from 'react-native';
import { useEditor, getKeyValueFromPositionId } from '../../context/EditorContext';
import { StyleGroup, KeyStyleOverride, KeyboardConfig } from '../../../types';
import { ColorPicker } from '../shared/ColorPicker';
import { KeyboardPreview, KeyPressEvent } from '../KeyboardPreview';

interface AddStyleRuleModalProps {
  visible: boolean;
  editingGroup: StyleGroup | null;
  initialSelectedKeys?: string[]; // Pre-selected key values when creating new rule
  onClose: () => void;
}

export const AddStyleRuleModal: React.FC<AddStyleRuleModalProps> = ({
  visible,
  editingGroup,
  initialSelectedKeys,
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
  const [isHidden, setIsHidden] = useState(false);
  const [isActive, setIsActive] = useState(true);

  // Generate a unique name for new rules
  const generateRuleName = useCallback((): string => {
    let counter = 1;
    const existingNames = new Set(state.styleGroups.map(g => g.name));
    while (existingNames.has(`rule-${counter}`)) {
      counter++;
    }
    return `rule-${counter}`;
  }, [state.styleGroups]);

  // Initialize state when modal opens
  useEffect(() => {
    if (visible) {
      if (editingGroup) {
        // Editing existing rule
        setRuleName(editingGroup.name);
        setSelectedKeyValues([...editingGroup.members]);
        setBgColor(editingGroup.style.bgColor || '');
        setTextColor(editingGroup.style.color || '');
        setIsHidden(editingGroup.style.hidden || false);
        setIsActive(editingGroup.active !== false);
      } else {
        // New rule - use initial selected keys if provided
        setRuleName(generateRuleName());
        setSelectedKeyValues(initialSelectedKeys || []);
        setBgColor('');
        setTextColor('');
        setIsHidden(false);
        setIsActive(true);
      }
    }
  }, [visible, editingGroup, generateRuleName]);

  // Handle key tap - toggle selection
  const handleKeyPress = useCallback((event: KeyPressEvent) => {
    const { type, value } = event.nativeEvent;
    
    // Skip special keys that aren't selectable
    if (type === 'keyset-changed' || type === 'next-keyboard' || type === 'language') {
      return;
    }
    
    const keyValue = value || type;
    if (!keyValue) return;
    
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
    if (isHidden) style.hidden = true;

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
  // 1. All existing style groups (except the one being edited)
  // 2. Current rule's style applied to selected keys
  const previewConfig = useMemo((): KeyboardConfig => {
    // Start with existing groups, excluding the one being edited
    const otherGroups = state.styleGroups
      .filter(g => !editingGroup || g.id !== editingGroup.id)
      .map(group => ({
        name: group.name,
        items: group.members,
        template: {
          color: group.style.color || '',
          bgColor: group.style.bgColor || '',
          hidden: group.style.hidden,
        },
      }));

    // Add current rule's style for selected keys
    if (selectedKeyValues.length > 0) {
      otherGroups.push({
        name: '_current_rule_',
        items: selectedKeyValues,
        template: {
          color: textColor || '',
          bgColor: bgColor || '',
          hidden: isHidden,
        },
      });
    }

    return {
      ...state.config,
      groups: otherGroups,
    };
  }, [state.config, state.styleGroups, editingGroup, selectedKeyValues, bgColor, textColor, isHidden]);

  const previewConfigJson = useMemo(() => JSON.stringify(previewConfig), [previewConfig]);

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
          const keyValue = key.value || key.caption || key.label || key.type;
          if (keyValue && selectedKeyValues.includes(keyValue)) {
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
    };
    return specialKeys[keyValue] || keyValue;
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header with action buttons */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleCancel} style={styles.cancelHeaderButton}>
              <Text style={styles.cancelHeaderText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {editingGroup ? 'Edit Rule' : 'New Rule'}
            </Text>
            <TouchableOpacity 
              style={[
                styles.saveHeaderButton,
                selectedKeyValues.length === 0 && styles.saveHeaderButtonDisabled
              ]} 
              onPress={handleOk}
              disabled={selectedKeyValues.length === 0}
            >
              <Text style={[
                styles.saveHeaderText,
                selectedKeyValues.length === 0 && styles.saveHeaderTextDisabled
              ]}>
                {editingGroup ? 'Save' : 'Create'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Embedded Keyboard Preview */}
          <View style={styles.previewSection}>
            <Text style={styles.previewLabel}>
              Tap keys to select ({selectedKeyValues.length} selected)
            </Text>
            <KeyboardPreview
              style={styles.keyboardPreview}
              configJson={previewConfigJson}
              selectedKeys={selectedKeysJson}
              onKeyPress={handleKeyPress}
            />
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
            {/* Rule Name */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Rule Name</Text>
              <TextInput
                style={styles.nameInput}
                value={ruleName}
                onChangeText={setRuleName}
                placeholder="Enter rule name..."
              />
            </View>

            {/* Selected Keys Display */}
            {selectedKeyValues.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Selected Keys</Text>
                <View style={styles.selectedKeysList}>
                  {selectedKeyValues.slice(0, 20).map((keyValue, index) => (
                    <View key={index} style={styles.keyBadge}>
                      <Text style={styles.keyBadgeText}>{getKeyDisplay(keyValue)}</Text>
                    </View>
                  ))}
                  {selectedKeyValues.length > 20 && (
                    <Text style={styles.moreKeysText}>+{selectedKeyValues.length - 20} more</Text>
                  )}
                </View>
              </View>
            )}

            {/* Style Options */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Style Options</Text>
              
              {/* Hidden Toggle */}
              <View style={styles.optionRow}>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionLabel}>Hidden</Text>
                  <Text style={styles.optionDescription}>Hide these keys</Text>
                </View>
                <Switch
                  value={isHidden}
                  onValueChange={setIsHidden}
                  trackColor={{ false: '#ccc', true: '#FFAB91' }}
                  thumbColor={isHidden ? '#FF5722' : '#f4f3f4'}
                />
              </View>

              {/* Background Color */}
              <View style={styles.colorSection}>
                <Text style={styles.colorLabel}>Background Color</Text>
                <ColorPicker
                  value={bgColor}
                  onChange={setBgColor}
                  showSystemDefault
                  systemDefaultLabel="Default"
                />
              </View>

              {/* Text Color */}
              <View style={styles.colorSection}>
                <Text style={styles.colorLabel}>Text Color</Text>
                <ColorPicker
                  value={textColor}
                  onChange={setTextColor}
                  presets={[
                    '#000000', '#FFFFFF', '#F44336', '#2196F3', 
                    '#4CAF50', '#FF9800', '#9C27B0', '#607D8B',
                  ]}
                  showSystemDefault
                  systemDefaultLabel="Default"
                />
              </View>

              {/* Active Toggle - at the end */}
              <View style={styles.optionRow}>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionLabel}>Active</Text>
                  <Text style={styles.optionDescription}>Apply this rule to the keyboard</Text>
                </View>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: '#ccc', true: '#81C784' }}
                  thumbColor={isActive ? '#4CAF50' : '#f4f3f4'}
                />
              </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
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
  },
  previewLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  keyboardPreview: {
    height: 220,
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
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
  },
  selectedKeysList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
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
  colorSection: {
    marginBottom: 12,
  },
  colorLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#555',
    marginBottom: 6,
  },
});

export default AddStyleRuleModal;