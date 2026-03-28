import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useEditor } from '../../context/EditorContext';
import { useLocalization } from '../../localization';
import { StyleGroup } from '../../../types';
import { MyIcon } from '@beitissieshapiro/issie-shared/dist/icons';

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
  const { strings } = useLocalization();

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
      strings.styleRules.deleteGroup,
      strings.styleRules.deleteGroupConfirm
        .replace('{{name}}', group.name)
        .replace('{{count}}', String(group.members.length)),
      [
        { text: strings.common.cancel, style: 'cancel' },
        {
          text: strings.common.delete,
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
          <Text allowFontScaling={false} style={styles.indicatorTextHidden}>{strings.common.hidden}</Text>
        </View>
      );
    } else if (visMode === 'showOnly') {
      indicators.push(
        <View key="showOnly" style={[styles.indicator, styles.indicatorShowOnly]}>
          <Text allowFontScaling={false} style={styles.indicatorTextShowOnly}>{strings.common.showOnly}</Text>
        </View>
      );
    }
    
    // Background color swatch
    if (group.style.bgColor) {
      indicators.push(
        <View key="bg" style={styles.colorSwatchContainer}>
          <Text allowFontScaling={false} style={styles.colorLabel}>{strings.common.bgLabel}:</Text>
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
          <Text allowFontScaling={false} style={styles.colorLabel}>{strings.common.textLabel}:</Text>
          <View 
            style={[styles.colorSwatch, { backgroundColor: group.style.color }]} 
          />
        </View>
      );
    }
    
    if (indicators.length === 0) {
      indicators.push(
        <Text key="none" style={styles.noStyleText}>{strings.styleRules.noStyles}</Text>
      );
    }
    
    return indicators;
  };

  return (
    <View style={[styles.container]}>
      {state.styleGroups.length === 0 ? (
        <View style={[styles.emptyContainer]}>
          <Text allowFontScaling={false} style={[styles.emptyText]}>
            {strings.styleRules.noGroupsHint}
          </Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {state.styleGroups.map((group) => {
            const isGroupActive = group.active !== false;
            
            return (
              <View
                key={group.id}
                style={[styles.groupRow]}
              >
                {/* Enable/Disable Switch */}
                <Switch
                  value={isGroupActive}
                  onValueChange={() => toggleGroupActive(group.id)}
                  trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                  thumbColor={isGroupActive ? '#3B82F6' : '#F3F4F6'}
                  ios_backgroundColor="#D1D5DB"
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
                
                {/* Group Name */}
                <Text allowFontScaling={false} style={[styles.groupName, !isGroupActive && styles.groupNameInactive]} numberOfLines={1}>
                  {group.name}
                </Text>
                
                {/* Member Count */}
                <Text allowFontScaling={false} style={styles.memberCount}>({group.members.length})</Text>
                
                {/* Style Indicators - inline */}
                <View style={styles.inlineStyleIndicators}>
                  {getStylePreview(group)}
                </View>
                
                {/* Action Buttons */}
                <View style={styles.groupActions}>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => onEditPressed(group)}
                    activeOpacity={0.7}>
                    <MyIcon info={{ name: 'edit', type: 'MI', color: '#3B82F6', size: 16 }} />
                    <Text allowFontScaling={false} style={styles.iconButtonTextBlue}>{strings.common.edit}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => handleDeleteGroup(group)}
                    activeOpacity={0.7}>
                    <MyIcon info={{ name: 'delete-outline', type: 'MDI', color: '#EF4444', size: 16 }} />
                    <Text allowFontScaling={false} style={styles.iconButtonTextRed}>{strings.common.delete}</Text>
                  </TouchableOpacity>
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
    padding: 12,
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
    textAlign: 'left'
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
  groupName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'left'
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
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  iconButtonTextBlue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
  iconButtonTextRed: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
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