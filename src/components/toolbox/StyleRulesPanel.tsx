import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useEditor } from '../../context/EditorContext';
import { StyleGroup } from '../../../types';
import { ActionButton } from '../shared/ActionButton';

export interface StyleRulesPanelProps {
  onEditPressed: (group: StyleGroup) => void;
  onCreatePressed: () => void;
}

export const StyleRulesPanel: React.FC<StyleRulesPanelProps> = ({ 
  onEditPressed,
  onCreatePressed,
}) => {
  const { 
    state, 
    deleteGroup,
    toggleGroupActive,
  } = useEditor();

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
      'Delete Keys Group',
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
      {state.styleGroups.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No keys groups yet. Tap "New" to create one.
          </Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {state.styleGroups.map((group) => {
            const isGroupActive = group.active !== false;
            
            return (
              <View
                key={group.id}
                style={styles.groupRow}
              >
                {/* Checkbox */}
                <TouchableOpacity
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
                
                {/* Group Name */}
                <Text style={[styles.groupName, !isGroupActive && styles.groupNameInactive]} numberOfLines={1}>
                  {group.name}
                </Text>
                
                {/* Member Count */}
                <Text style={styles.memberCount}>({group.members.length})</Text>
                
                {/* Style Indicators - inline */}
                <View style={styles.inlineStyleIndicators}>
                  {getStylePreview(group)}
                </View>
                
                {/* Action Buttons */}
                <View style={styles.groupActions}>
                  <ActionButton
                    label="Edit"
                    color="blue"
                    onPress={() => onEditPressed(group)}
                  />
                  <ActionButton
                    label="Delete"
                    color="red"
                    onPress={() => handleDeleteGroup(group)}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
  listContainer: {
  },
  emptyContainer: {
    padding: 12,
  },
  emptyText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  // Thin row layout - everything on one line
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
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
    fontSize: 10,
    fontWeight: 'bold',
  },
  groupName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  groupNameInactive: {
    color: '#999',
    textDecorationLine: 'line-through',
  },
  memberCount: {
    fontSize: 12,
    color: '#888',
  },
  inlineStyleIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupActions: {
    flexDirection: 'row',
    gap: 6,
  },
  colorSwatchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  colorLabel: {
    fontSize: 10,
    color: '#888',
  },
  colorSwatch: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  indicator: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  indicatorHidden: {
    backgroundColor: '#FFEBEE',
  },
  indicatorTextHidden: {
    fontSize: 10,
    color: '#C62828',
    fontWeight: '500',
  },
  indicatorShowOnly: {
    backgroundColor: '#E3F2FD',
  },
  indicatorTextShowOnly: {
    fontSize: 10,
    color: '#1565C0',
    fontWeight: '500',
  },
  noStyleText: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
});

export default StyleRulesPanel;