import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useEditor, getKeyValueFromPositionId } from '../../context/EditorContext';
import { StyleGroup } from '../../../types';
import { AddStyleRuleModal } from './AddStyleRuleModal';

export const StyleRulesPanel: React.FC = () => {
  const { 
    state, 
    deleteGroup,
    toggleGroupActive,
    clearSelection,
  } = useEditor();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<StyleGroup | null>(null);

  // Get caption for a key by its value
  const getKeyCaption = useCallback((keyValue: string): string => {
    // For special keys, show a friendly name
    const specialKeys: Record<string, string> = {
      'backspace': '⌫',
      'enter': '⏎',
      'shift': '⇧',
      'space': '␣',
      'settings': '⚙️',
      'close': '✕',
    };
    if (specialKeys[keyValue]) return specialKeys[keyValue];
    return keyValue;
  }, []);

  // Build display string for group members
  const getMemberDisplay = useCallback((members: string[]): string => {
    const MAX_DISPLAY = 10;
    const captions = members.slice(0, MAX_DISPLAY).map(getKeyCaption);
    const display = captions.join(', ');
    if (members.length > MAX_DISPLAY) {
      return `${display}... (+${members.length - MAX_DISPLAY} more)`;
    }
    return display;
  }, [getKeyCaption]);

  const handleDeleteGroup = (group: StyleGroup) => {
    Alert.alert(
      'Delete Style Rule',
      `Delete "${group.name}"? This will remove styling from ${group.members.length} key(s).`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            deleteGroup(group.id);
          }
        },
      ]
    );
  };

  const handleEditGroup = (group: StyleGroup) => {
    setEditingGroup(group);
    setShowAddModal(true);
  };

  // Convert currently selected position IDs to key values
  const getSelectedKeyValues = useCallback((): string[] => {
    if (state.selectedKeys.length === 0) return [];
    
    const keyValues = state.selectedKeys
      .map(posId => getKeyValueFromPositionId(posId, state.config.keysets))
      .filter((v): v is string => v !== null);
    
    return [...new Set(keyValues)]; // Remove duplicates
  }, [state.selectedKeys, state.config.keysets]);

  const handleAddNew = () => {
    setEditingGroup(null);
    setShowAddModal(true);
  };

  const handleModalClose = () => {
    setShowAddModal(false);
    setEditingGroup(null);
    clearSelection(); // Clear selection when modal closes
  };

  const getStylePreview = (group: StyleGroup): React.ReactNode => {
    const indicators: React.ReactNode[] = [];
    
    // Visibility indicator - check for new visibilityMode first, then legacy hidden
    const visMode = group.style.visibilityMode || (group.style.hidden ? 'hide' : 'default');
    
    if (visMode === 'hide') {
      indicators.push(
        <View key="hidden" style={[styles.indicator, styles.indicatorHidden]}>
          <Text style={styles.indicatorTextHidden}>Hidden</Text>
        </View>
      );
    } else if (visMode === 'showOnly') {
      indicators.push(
        <View key="showOnly" style={[styles.indicator, styles.indicatorShowOnly]}>
          <Text style={styles.indicatorTextShowOnly}>Show Only</Text>
        </View>
      );
    }
    
    // Background color swatch
    if (group.style.bgColor) {
      indicators.push(
        <View key="bg" style={styles.colorSwatchContainer}>
          <Text style={styles.colorLabel}>BG:</Text>
          <View 
            style={[styles.colorSwatch, { backgroundColor: group.style.bgColor }]} 
          />
        </View>
      );
    }
    
    // Text color swatch
    if (group.style.color) {
      indicators.push(
        <View key="color" style={styles.colorSwatchContainer}>
          <Text style={styles.colorLabel}>Text:</Text>
          <View 
            style={[styles.colorSwatch, { backgroundColor: group.style.color }]} 
          />
        </View>
      );
    }
    
    if (indicators.length === 0) {
      indicators.push(
        <Text key="none" style={styles.noStyleText}>No styles applied</Text>
      );
    }
    
    return indicators;
  };

  return (
    <View style={styles.container}>
      {/* Header with Add button */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Style Rules</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={handleAddNew}
        >
          <Text style={styles.addButtonText}>+ Add Rule</Text>
        </TouchableOpacity>
      </View>

      {state.styleGroups.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>No Style Rules Yet</Text>
          <Text style={styles.emptyText}>
            Tap "+ Add Rule" to create a style rule.{'\n'}
            You can hide keys, change colors, and more.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
          {state.styleGroups.map((group) => {
            const isGroupActive = group.active !== false;
            
            return (
              <View
                key={group.id}
                style={[
                  styles.ruleCard,
                  !isGroupActive && styles.ruleCardInactive,
                ]}
              >
                <View style={styles.ruleHeader}>
                  <View style={styles.ruleTitleRow}>
                    {/* Active Checkbox */}
                    <TouchableOpacity
                      style={styles.activeCheckbox}
                      onPress={() => toggleGroupActive(group.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 5, right: 10 }}
                    >
                      <View style={[
                        styles.checkbox,
                        isGroupActive && styles.checkboxChecked,
                      ]}>
                        {isGroupActive && <Text style={styles.checkboxCheckmark}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                    <Text style={[styles.ruleName, !isGroupActive && styles.ruleNameInactive]}>
                      {group.name}
                    </Text>
                    <Text style={styles.memberCount}>
                      ({group.members.length} keys)
                    </Text>
                  </View>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleEditGroup(group)}
                      hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                    >
                      <Text style={styles.actionButtonText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleDeleteGroup(group)}
                      hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                    >
                      <Text style={styles.actionButtonText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                {/* Members display */}
                <View style={styles.membersContainer}>
                  <Text style={[styles.membersText, !isGroupActive && styles.membersTextInactive]} numberOfLines={1}>
                    {getMemberDisplay(group.members)}
                  </Text>
                </View>
                
                {/* Style indicators */}
                <View style={styles.stylePreview}>
                  {getStylePreview(group)}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Add/Edit Style Rule Modal */}
      <AddStyleRuleModal
        visible={showAddModal}
        editingGroup={editingGroup}
        initialSelectedKeys={editingGroup ? undefined : getSelectedKeyValues()}
        onClose={handleModalClose}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  ruleCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  ruleCardInactive: {
    opacity: 0.6,
    backgroundColor: '#EEEEEE',
  },
  ruleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ruleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  activeCheckbox: {
    marginRight: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#BDBDBD',
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  checkboxCheckmark: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  ruleName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  ruleNameInactive: {
    color: '#999',
    textDecorationLine: 'line-through',
  },
  memberCount: {
    fontSize: 12,
    color: '#888',
    marginLeft: 6,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    padding: 6,
  },
  actionButtonText: {
    fontSize: 16,
  },
  membersContainer: {
    marginBottom: 8,
  },
  membersText: {
    fontSize: 13,
    color: '#666',
  },
  membersTextInactive: {
    color: '#AAA',
  },
  stylePreview: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  colorSwatchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  colorLabel: {
    fontSize: 11,
    color: '#888',
  },
  colorSwatch: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  indicator: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  indicatorHidden: {
    backgroundColor: '#FFEBEE',
  },
  indicatorTextHidden: {
    fontSize: 11,
    color: '#C62828',
    fontWeight: '500',
  },
  indicatorShowOnly: {
    backgroundColor: '#E3F2FD',
  },
  indicatorTextShowOnly: {
    fontSize: 11,
    color: '#1565C0',
    fontWeight: '500',
  },
  noStyleText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
});

export default StyleRulesPanel;