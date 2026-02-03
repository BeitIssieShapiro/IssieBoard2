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
import { StyleGroup, KeyStyleOverride, KeyboardConfig, VisibilityMode } from '../../../types';
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
  const [visibilityMode, setVisibilityMode] = useState<VisibilityMode>('default');
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
        // New rule - use initial selected keys if provided
        setRuleName(generateRuleName());
        setSelectedKeyValues(initialSelectedKeys || []);
        setBgColor('');
        setTextColor('');
        setVisibilityMode('default');
        setIsActive(true);
      }
    }
  }, [visible, editingGroup, generateRuleName]);

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
  // 1. All existing style groups (except the one being edited)
  // 2. Current rule's style applied to selected keys
  // IMPORTANT: In the modal preview, we DON'T apply visibility modes (hide/showOnly)
  // because we need all keys visible for selection/deselection.
  // Visibility only applies in the main editor preview.
  const previewConfig = useMemo((): KeyboardConfig => {
    // Start with existing groups, excluding the one being edited
    // DON'T apply visibility modes from other groups in modal preview
    const otherGroups = state.styleGroups
      .filter(g => !editingGroup || g.id !== editingGroup.id)
      .map(group => ({
        name: group.name,
        items: group.members,
        template: {
          color: group.style.color || '',
          bgColor: group.style.bgColor || '',
          // Don't hide keys in the modal preview - we need them visible for selection
          hidden: false,
          visibilityMode: 'default' as VisibilityMode,
        },
      }));

    // Add current rule's style for selected keys
    // Only apply colors (not visibility) in the modal preview
    if (selectedKeyValues.length > 0) {
      otherGroups.push({
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
      groups: otherGroups,
    };
  }, [state.config, state.styleGroups, editingGroup, selectedKeyValues, bgColor, textColor, visibilityMode]);

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
              
              {/* Visibility Mode Segmented Control */}
              <View style={styles.visibilitySection}>
                <Text style={styles.visibilityLabel}>Visibility</Text>
                <View style={styles.segmentedControl}>
                  <TouchableOpacity
                    style={[
                      styles.segment,
                      styles.segmentFirst,
                      visibilityMode === 'default' && styles.segmentSelected,
                    ]}
                    onPress={() => setVisibilityMode('default')}
                  >
                    <Text style={[
                      styles.segmentText,
                      visibilityMode === 'default' && styles.segmentTextSelected,
                    ]}>
                      Default
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.segment,
                      visibilityMode === 'hide' && styles.segmentSelected,
                    ]}
                    onPress={() => setVisibilityMode('hide')}
                  >
                    <Text style={[
                      styles.segmentText,
                      visibilityMode === 'hide' && styles.segmentTextSelected,
                    ]}>
                      Hide Selected
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.segment,
                      styles.segmentLast,
                      visibilityMode === 'showOnly' && styles.segmentSelected,
                    ]}
                    onPress={() => setVisibilityMode('showOnly')}
                  >
                    <Text style={[
                      styles.segmentText,
                      visibilityMode === 'showOnly' && styles.segmentTextSelected,
                    ]}>
                      Show Only
                    </Text>
                  </TouchableOpacity>
                </View>
                {visibilityMode === 'showOnly' && (
                  <Text style={styles.visibilityHint}>
                    ⓘ All keys except these will be hidden
                  </Text>
                )}
                {visibilityMode === 'hide' && (
                  <Text style={styles.visibilityHint}>
                    ⓘ Colors are not applicable for hidden keys
                  </Text>
                )}
              </View>

              {/* Background Color - only show if not in "hide" mode */}
              {visibilityMode !== 'hide' && (
                <View style={styles.colorSection}>
                  <Text style={styles.colorLabel}>Background Color</Text>
                  <ColorPicker
                    value={bgColor}
                    onChange={setBgColor}
                    showSystemDefault
                    systemDefaultLabel="Default"
                  />
                </View>
              )}

              {/* Text Color - only show if not in "hide" mode */}
              {visibilityMode !== 'hide' && (
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
              )}

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
    overflow: 'hidden',  // Prevent keyboard from overflowing
  },
  previewLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  keyboardPreview: {
    height: 260,  // Increased to accommodate keyboard with suggestions bar
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
  // Visibility segmented control styles
  visibilitySection: {
    marginBottom: 16,
  },
  visibilityLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#555',
    marginBottom: 8,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  segmentFirst: {
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  segmentLast: {
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  segmentSelected: {
    backgroundColor: '#FFF',
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    textAlign: 'center',
  },
  segmentTextSelected: {
    color: '#333',
    fontWeight: '600',
  },
  visibilityHint: {
    fontSize: 11,
    color: '#FF9800',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

export default AddStyleRuleModal;