import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useEditor, stringToKeyId } from '../../context/EditorContext';
import { StyleGroup } from '../../../types';

export const GroupsPanel: React.FC = () => {
  const { 
    state, 
    setActiveGroup, 
    deleteGroup,
    selectKeys,
    clearSelection,
    toggleGroupActive,
  } = useEditor();

  const handleEditGroup = (group: StyleGroup) => {
    // Select all keys in the group and make it active
    selectKeys(group.members);
    setActiveGroup(group.id);
  };

  // Get caption for a key by its ID
  const getKeyCaption = useCallback((keyId: string): string => {
    try {
      const { keysetId, rowIndex, keyIndex } = stringToKeyId(keyId);
      const keyset = state.config.keysets.find(ks => ks.id === keysetId);
      if (!keyset) return '?';
      const row = keyset.rows[rowIndex];
      if (!row) return '?';
      const key = row.keys[keyIndex];
      if (!key) return '?';
      return key.label || key.caption || key.value || key.type || '?';
    } catch {
      return '?';
    }
  }, [state.config.keysets]);

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
      'Delete Group',
      `Delete "${group.name}"? This will remove all styling from ${group.members.length} key(s).`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            deleteGroup(group.id);
            clearSelection();
          }
        },
      ]
    );
  };

  const getStylePreview = (group: StyleGroup): React.ReactNode => {
    const indicators: React.ReactNode[] = [];
    
    // Always show visibility status
    if (group.style.hidden) {
      indicators.push(
        <View key="hidden" style={[styles.indicator, styles.indicatorHidden]}>
          <Text allowFontScaling={false} style={styles.indicatorTextHidden}>🚫 Hidden</Text>
        </View>
      );
    } else {
      indicators.push(
        <View key="visible" style={[styles.indicator, styles.indicatorVisible]}>
          <Text allowFontScaling={false} style={styles.indicatorTextVisible}>✓ Visible</Text>
        </View>
      );
    }
    
    if (group.style.bgColor) {
      indicators.push(
        <View 
          key="bg" 
          style={[styles.colorSwatch, { backgroundColor: group.style.bgColor }]} 
        />
      );
    }
    
    if (group.style.color) {
      indicators.push(
        <View 
          key="color" 
          style={[
            styles.colorSwatch, 
            styles.textColorSwatch,
            { backgroundColor: group.style.color }
          ]} 
        />
      );
    }
    
    if (group.style.label) {
      indicators.push(
        <View key="label" style={[styles.indicator, styles.indicatorLabel]}>
          <Text allowFontScaling={false} style={styles.indicatorText}>Aa</Text>
        </View>
      );
    }
    
    return indicators;
  };

  if (state.styleGroups.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text allowFontScaling={false} style={styles.emptyIcon}>📦</Text>
        <Text allowFontScaling={false} style={styles.emptyTitle}>No Style Groups Yet</Text>
        <Text allowFontScaling={false} style={styles.emptyText}>
          Select keys and apply styles (like hiding or coloring) to create groups.
          Groups make it easy to manage and restore changes.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text allowFontScaling={false} style={styles.headerTitle}>Style Groups</Text>
        <Text allowFontScaling={false} style={styles.headerSubtitle}>
          {state.styleGroups.length} group{state.styleGroups.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {state.styleGroups.map((group) => {
        const isGroupActive = group.active !== false;
        
        return (
          <View
            key={group.id}
            style={[
              styles.groupCard,
              state.activeGroupId === group.id && styles.groupCardActive,
              !isGroupActive && styles.groupCardInactive,
            ]}
          >
            <View style={styles.groupHeader}>
              <View style={styles.groupTitleRow}>
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
                    {isGroupActive && <Text allowFontScaling={false} style={styles.checkboxCheckmark}>✓</Text>}
                  </View>
                </TouchableOpacity>
                <Text allowFontScaling={false} style={[styles.groupName, !isGroupActive && styles.groupNameInactive]}>
                  {group.name}
                </Text>
              </View>
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleEditGroup(group)}
                  hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                >
                  <Text allowFontScaling={false} style={styles.actionButtonText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleDeleteGroup(group)}
                  hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                >
                  <Text allowFontScaling={false} style={styles.actionButtonText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Active status indicator */}
            {!isGroupActive && (
              <View style={styles.inactiveNotice}>
                <Text allowFontScaling={false} style={styles.inactiveNoticeText}>⏸ Inactive - not applied to preview</Text>
              </View>
            )}
            
            {/* Members display */}
            <View style={styles.membersContainer}>
              <Text allowFontScaling={false} style={[styles.membersText, !isGroupActive && styles.membersTextInactive]} numberOfLines={2}>
                {getMemberDisplay(group.members)}
              </Text>
            </View>
            
            {/* Style indicators */}
            <View style={styles.stylePreview}>
              {getStylePreview(group)}
            </View>
            
            {state.activeGroupId === group.id && (
              <View style={styles.activeIndicator}>
                <Text allowFontScaling={false} style={styles.activeIndicatorText}>✓ Editing</Text>
              </View>
            )}
          </View>
        );
      })}

      <View style={styles.helpSection}>
        <Text allowFontScaling={false} style={styles.helpTitle}>💡 Tips</Text>
        <Text allowFontScaling={false} style={styles.helpText}>
          • Tap a group to select its keys{'\n'}
          • Long-press or tap 🗑️ to delete{'\n'}
          • Deleting restores keys to default
        </Text>
      </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  groupCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  groupCardActive: {
    borderColor: '#2196F3',
    backgroundColor: '#E3F2FD',
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 4,
  },
  actionButtonText: {
    fontSize: 16,
  },
  membersContainer: {
    marginBottom: 10,
  },
  membersText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  stylePreview: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  textColorSwatch: {
    borderRadius: 12,
  },
  indicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  indicatorHidden: {
    backgroundColor: '#FFEBEE',
  },
  indicatorVisible: {
    backgroundColor: '#E8F5E9',
  },
  indicatorTextHidden: {
    fontSize: 11,
    color: '#C62828',
    fontWeight: '500',
  },
  indicatorTextVisible: {
    fontSize: 11,
    color: '#2E7D32',
    fontWeight: '500',
  },
  indicatorLabel: {
    backgroundColor: '#E8F5E9',
  },
  indicatorText: {
    fontSize: 12,
    color: '#666',
  },
  noStyleText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  activeIndicator: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(33, 150, 243, 0.3)',
  },
  activeIndicatorText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
  },
  helpSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F57F17',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 12,
    color: '#5D4037',
    lineHeight: 18,
  },
  groupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  activeCheckbox: {
    marginRight: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
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
    fontSize: 14,
    fontWeight: 'bold',
  },
  groupCardInactive: {
    opacity: 0.7,
    backgroundColor: '#EEEEEE',
  },
  groupNameInactive: {
    color: '#999',
    textDecorationLine: 'line-through',
  },
  membersTextInactive: {
    color: '#AAA',
  },
  inactiveNotice: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  inactiveNoticeText: {
    fontSize: 11,
    color: '#E65100',
    fontWeight: '500',
  },
});

export default GroupsPanel;