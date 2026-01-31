import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useEditor, stringToKeyId } from '../../context/EditorContext';
import { ColorPicker } from '../shared/ColorPicker';
import { VisibilityToggle } from '../shared/ToggleSwitch';
import { KeyConfig, StyleGroup, KeyStyleOverride } from '../../../types';

export const KeyEditorPanel: React.FC = () => {
  const { 
    state, 
    clearSelection,
    applyStyleToSelection,
    getComputedKeyStyle,
    getKeyGroups,
    updateGroupStyle,
    updateGroup,
    deleteGroup,
  } = useEditor();

  // State for editing group name
  const [editingGroupName, setEditingGroupName] = useState('');

  // Get the first selected key for display
  const selectedKeyId = state.selectedKeys.length > 0 
    ? stringToKeyId(state.selectedKeys[0]) 
    : null;

  // Get base key from config
  const baseKey = useMemo((): KeyConfig | null => {
    if (!selectedKeyId) return null;
    const keyset = state.config.keysets.find(ks => ks.id === selectedKeyId.keysetId);
    if (!keyset || !keyset.rows[selectedKeyId.rowIndex]) return null;
    return keyset.rows[selectedKeyId.rowIndex].keys[selectedKeyId.keyIndex] || null;
  }, [state.config.keysets, selectedKeyId]);

  // Get computed style (from all groups)
  const computedStyle = useMemo((): KeyStyleOverride => {
    if (state.selectedKeys.length === 0) return {};
    return getComputedKeyStyle(state.selectedKeys[0]);
  }, [state.selectedKeys, getComputedKeyStyle]);

  // Get groups that contain this key
  const keyGroups = useMemo((): StyleGroup[] => {
    if (state.selectedKeys.length === 0) return [];
    return getKeyGroups(state.selectedKeys[0]);
  }, [state.selectedKeys, getKeyGroups]);

  // Get the active group if editing one
  const activeGroup = useMemo((): StyleGroup | null => {
    if (!state.activeGroupId) return null;
    return state.styleGroups.find(g => g.id === state.activeGroupId) || null;
  }, [state.activeGroupId, state.styleGroups]);

  // Sync group name when active group changes
  useEffect(() => {
    if (activeGroup?.name) {
      setEditingGroupName(activeGroup.name);
    } else {
      setEditingGroupName('');
    }
  }, [activeGroup?.id, activeGroup?.name]);

  // Generate a provisional group name for new groups
  const generateProvisionalName = (): string => {
    let counter = 1;
    const existingNames = new Set(state.styleGroups.map(g => g.name));
    while (existingNames.has(`new-group${counter}`)) {
      counter++;
    }
    return `new-group${counter}`;
  };

  // Get the display name - use activeGroup name if editing, otherwise generate a provisional name
  const displayGroupName = activeGroup 
    ? (editingGroupName || activeGroup.name || '')
    : (editingGroupName || generateProvisionalName());

  if (!baseKey || !selectedKeyId) {
    return null;
  }

  // Get display label for the key (short version)
  const getKeyShortLabel = (key: KeyConfig): string => {
    if (key.value) return key.value;
    if (key.caption) return key.caption;
    if (key.label) return key.label;
    if (key.type) {
      switch (key.type) {
        case 'shift': return '⇧';
        case 'backspace': return '⌫';
        case 'enter': return '⏎';
        case 'keyset': return '🔄';
        case 'next-keyboard': return '🌐';
        case 'settings': return '⚙️';
        case 'close': return '✕';
        default: return key.type.charAt(0).toUpperCase();
      }
    }
    return '?';
  };

  // Get all selected key labels
  const selectedKeyLabels = useMemo((): string[] => {
    return state.selectedKeys.map(keyIdStr => {
      const keyId = stringToKeyId(keyIdStr);
      const keyset = state.config.keysets.find(ks => ks.id === keyId.keysetId);
      if (!keyset || !keyset.rows[keyId.rowIndex]) return '?';
      const key = keyset.rows[keyId.rowIndex].keys[keyId.keyIndex];
      if (!key) return '?';
      return getKeyShortLabel(key);
    });
  }, [state.selectedKeys, state.config.keysets]);

  // Handle group name change
  const handleGroupNameChange = (name: string) => {
    setEditingGroupName(name);
  };

  // Save group name on blur or submit
  const handleGroupNameSave = () => {
    if (activeGroup && editingGroupName.trim()) {
      updateGroup(activeGroup.id, { name: editingGroupName.trim() });
    }
  };

  // Apply visibility change
  const handleVisibilityChange = (visible: boolean) => {
    if (activeGroup) {
      // Update existing group
      updateGroupStyle(activeGroup.id, { hidden: !visible });
    } else {
      // Create new group with this style
      applyStyleToSelection({ hidden: !visible });
    }
  };

  // Apply background color change
  const handleColorChange = (color: string) => {
    if (activeGroup) {
      updateGroupStyle(activeGroup.id, { bgColor: color });
    } else {
      applyStyleToSelection({ bgColor: color });
    }
  };

  // Apply text color change
  const handleTextColorChange = (color: string) => {
    if (activeGroup) {
      updateGroupStyle(activeGroup.id, { color });
    } else {
      applyStyleToSelection({ color });
    }
  };

  // Apply label change
  const handleLabelChange = (label: string) => {
    if (activeGroup) {
      updateGroupStyle(activeGroup.id, { label: label || undefined });
    } else if (label) {
      applyStyleToSelection({ label });
    }
  };

  const isVisible = !computedStyle.hidden;
  const isSpecialKey = !!baseKey.type;
  const selectionCount = state.selectedKeys.length;
  // Always show group editor header when keys are selected
  const isEditingGroup = true;

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets={true}
    >
      {/* Header - Group Title when editing a group */}
      {isEditingGroup ? (
        <View style={styles.groupHeader}>
          <Text style={styles.groupHeaderLabel}>Group Name:</Text>
          <TextInput
            style={styles.groupNameInput}
            value={displayGroupName}
            onChangeText={handleGroupNameChange}
            onBlur={handleGroupNameSave}
            onSubmitEditing={handleGroupNameSave}
            placeholder="Enter group name"
            selectTextOnFocus
          />
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={clearSelection}
            accessibilityLabel="Done editing"
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.selectionLabel}>
              {selectionCount} key{selectionCount > 1 ? 's' : ''}:
            </Text>
            <View style={styles.selectedChars}>
              {selectedKeyLabels.slice(0, 12).map((label, i) => (
                <View key={i} style={styles.charBadge}>
                  <Text style={styles.charBadgeText}>{label}</Text>
                </View>
              ))}
              {selectedKeyLabels.length > 12 && (
                <Text style={styles.moreText}>+{selectedKeyLabels.length - 12}</Text>
              )}
            </View>
          </View>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={clearSelection}
            accessibilityLabel="Deselect all"
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Selected Keys Summary (only when editing group) */}
      {isEditingGroup && (
        <View style={styles.keysSummary}>
          <Text style={styles.keysSummaryLabel}>
            {selectionCount} key{selectionCount > 1 ? 's' : ''}:
          </Text>
          <View style={styles.selectedChars}>
            {selectedKeyLabels.slice(0, 12).map((label, i) => (
              <View key={i} style={styles.charBadge}>
                <Text style={styles.charBadgeText}>{label}</Text>
              </View>
            ))}
            {selectedKeyLabels.length > 12 && (
              <Text style={styles.moreText}>+{selectedKeyLabels.length - 12}</Text>
            )}
          </View>
        </View>
      )}

      {/* Active Group Indicator - only show when NOT editing a group */}
      {!isEditingGroup && keyGroups.length > 0 && (
        <View style={styles.groupsIndicator}>
          <Text style={styles.groupsLabel}>In Groups:</Text>
          <View style={styles.groupTags}>
            {keyGroups.map(group => (
              <View 
                key={group.id} 
                style={[
                  styles.groupTag,
                  state.activeGroupId === group.id && styles.groupTagActive
                ]}
              >
                <Text style={styles.groupTagText}>{group.name}</Text>
                <TouchableOpacity
                  style={styles.groupTagDelete}
                  onPress={() => deleteGroup(group.id)}
                >
                  <Text style={styles.groupTagDeleteText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Visibility Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Visibility</Text>
        <VisibilityToggle
          visible={isVisible}
          onChange={handleVisibilityChange}
        />
        {!isVisible && (
          <Text style={styles.hint}>
            Hidden keys appear ghosted in Edit mode but are invisible to users.
            {keyGroups.length > 0 && ' Delete the group to restore visibility.'}
          </Text>
        )}
      </View>

      {/* Background Color Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Key Background Color</Text>
        <ColorPicker
          value={computedStyle.bgColor || ''}
          onChange={handleColorChange}
          showSystemDefault
          systemDefaultLabel="Default"
        />
      </View>

      {/* Text Color Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Text Color</Text>
        <ColorPicker
          value={computedStyle.color || ''}
          onChange={handleTextColorChange}
          presets={[
            '#000000', '#FFFFFF', '#F44336', '#2196F3', 
            '#4CAF50', '#FF9800', '#9C27B0', '#607D8B',
          ]}
          showSystemDefault
          systemDefaultLabel="Default"
        />
      </View>

      {/* Custom Label Section (only for single key selection, non-special keys, not when editing group) */}
      {!isEditingGroup && !isSpecialKey && selectionCount === 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Custom Label</Text>
          <Text style={styles.hint}>
            Override the display text (original: {baseKey.value || 'N/A'})
          </Text>
          <TextInput
            style={styles.labelInput}
            value={computedStyle.label || ''}
            onChangeText={handleLabelChange}
            placeholder={baseKey.value || 'Enter custom label'}
            maxLength={10}
          />
        </View>
      )}

      {/* Key Info - only show when not editing a group (activeGroupId is null) */}
      {!isEditingGroup && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Info</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Position:</Text>
            <Text style={styles.infoValue}>
              Row {selectedKeyId.rowIndex + 1}, Key {selectedKeyId.keyIndex + 1}
            </Text>
          </View>
          {baseKey.value && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Output:</Text>
              <Text style={styles.infoValue}>"{baseKey.value}"</Text>
            </View>
          )}
          {baseKey.sValue && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Shift Output:</Text>
              <Text style={styles.infoValue}>"{baseKey.sValue}"</Text>
            </View>
          )}
          {baseKey.type && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Type:</Text>
              <Text style={styles.infoValue}>{baseKey.type}</Text>
            </View>
          )}
          {baseKey.width && baseKey.width !== 1 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Width:</Text>
              <Text style={styles.infoValue}>{baseKey.width}x</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    marginBottom: 12,
    gap: 8,
  },
  groupHeaderLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  groupNameInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  keysSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 16,
    backgroundColor: '#F5F5F5',
    padding: 10,
    borderRadius: 8,
  },
  keysSummaryLabel: {
    fontSize: 12,
    color: '#666',
  },
  selectionLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  selectedChars: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    alignItems: 'center',
  },
  charBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  charBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
  },
  moreText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
  },
  groupsIndicator: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  groupsLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  groupTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  groupTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingVertical: 4,
    paddingLeft: 10,
    paddingRight: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  groupTagActive: {
    backgroundColor: '#BBDEFB',
    borderColor: '#2196F3',
  },
  groupTagText: {
    fontSize: 12,
    color: '#1976D2',
    marginRight: 4,
  },
  groupTagDelete: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupTagDeleteText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
  labelInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
});

export default KeyEditorPanel;