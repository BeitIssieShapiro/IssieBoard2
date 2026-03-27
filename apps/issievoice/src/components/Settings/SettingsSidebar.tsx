import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {colors} from '../../constants';
import {MyIcon} from '@beitissieshapiro/issie-shared/dist/icons';

export interface SettingsSidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  isLandscape: boolean;
}

type TabId = 'general' | 'keys-groups' | 'nikkud' | 'voice';

interface TabDef {
  id: TabId;
  label: string;
  iconName: string;
  iconType: string;
}

const KEYBOARD_CHILDREN: TabDef[] = [
  {id: 'general', label: 'General', iconName: 'settings-outline', iconType: 'Ionicons'},
  {id: 'keys-groups', label: 'Keys Groups', iconName: 'color-palette-outline', iconType: 'Ionicons'},
  {id: 'nikkud', label: 'Nikkud', iconName: 'text-outline', iconType: 'Ionicons'},
];

const VOICE_TAB: TabDef = {
  id: 'voice',
  label: 'Voice',
  iconName: 'volume-high-outline',
  iconType: 'Ionicons',
};

const KEYBOARD_CHILD_IDS: string[] = KEYBOARD_CHILDREN.map(t => t.id);

const isKeyboardTab = (tabId: string): boolean =>
  KEYBOARD_CHILD_IDS.includes(tabId);

const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  activeTab,
  onTabChange,
  isLandscape,
}) => {
  if (isLandscape) {
    return (
      <View style={styles.sidebar}>
        {/* Keyboard group header */}
        <View style={styles.groupHeader}>
          <MyIcon
            info={{
              name: 'keyboard-outline',
              type: 'Ionicons',
              color: colors.text,
              size: 20,
            }}
          />
          <Text style={styles.groupHeaderText}>Keyboard</Text>
        </View>

        {/* Keyboard children */}
        {KEYBOARD_CHILDREN.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.sidebarItem, styles.sidebarChildItem, isActive && styles.sidebarItemActive]}
              onPress={() => onTabChange(tab.id)}
              activeOpacity={0.7}>
              <MyIcon
                info={{
                  name: tab.iconName,
                  type: tab.iconType,
                  color: isActive ? '#FFFFFF' : colors.text,
                  size: 18,
                }}
              />
              <Text
                style={[
                  styles.sidebarItemText,
                  isActive && styles.sidebarItemTextActive,
                ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Voice tab */}
        {(() => {
          const isActive = activeTab === VOICE_TAB.id;
          return (
            <TouchableOpacity
              style={[styles.sidebarItem, isActive && styles.sidebarItemActive]}
              onPress={() => onTabChange(VOICE_TAB.id)}
              activeOpacity={0.7}>
              <MyIcon
                info={{
                  name: VOICE_TAB.iconName,
                  type: VOICE_TAB.iconType,
                  color: isActive ? '#FFFFFF' : colors.text,
                  size: 20,
                }}
              />
              <Text
                style={[
                  styles.sidebarItemText,
                  isActive && styles.sidebarItemTextActive,
                ]}>
                {VOICE_TAB.label}
              </Text>
            </TouchableOpacity>
          );
        })()}
      </View>
    );
  }

  // Portrait mode: two-level top tabs
  const keyboardActive = isKeyboardTab(activeTab);

  return (
    <View style={styles.tabsContainer}>
      {/* Level 1: Keyboard | Voice */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, keyboardActive && styles.tabActive]}
          onPress={() => {
            if (!keyboardActive) {
              onTabChange('general');
            }
          }}
          activeOpacity={0.7}>
          <MyIcon
            info={{
              name: 'keyboard-outline',
              type: 'Ionicons',
              color: keyboardActive ? '#FFFFFF' : colors.text,
              size: 18,
            }}
          />
          <Text style={[styles.tabText, keyboardActive && styles.tabTextActive]}>
            Keyboard
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'voice' && styles.tabActive]}
          onPress={() => onTabChange('voice')}
          activeOpacity={0.7}>
          <MyIcon
            info={{
              name: VOICE_TAB.iconName,
              type: VOICE_TAB.iconType,
              color: activeTab === 'voice' ? '#FFFFFF' : colors.text,
              size: 18,
            }}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'voice' && styles.tabTextActive,
            ]}>
            Voice
          </Text>
        </TouchableOpacity>
      </View>

      {/* Level 2: sub-tabs (only when Keyboard is active) */}
      {keyboardActive && (
        <View style={styles.subTabRow}>
          {KEYBOARD_CHILDREN.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.subTab, isActive && styles.subTabActive]}
                onPress={() => onTabChange(tab.id)}
                activeOpacity={0.7}>
                <MyIcon
                  info={{
                    name: tab.iconName,
                    type: tab.iconType,
                    color: isActive ? '#FFFFFF' : colors.text,
                    size: 16,
                  }}
                />
                <Text
                  style={[
                    styles.subTabText,
                    isActive && styles.subTabTextActive,
                  ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Landscape sidebar styles
  sidebar: {
    width: 180,
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: colors.borderLight,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  groupHeaderText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  sidebarChildItem: {
    marginLeft: 16,
  },
  sidebarItemActive: {
    backgroundColor: colors.primary,
  },
  sidebarItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  sidebarItemTextActive: {
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 8,
    marginHorizontal: 12,
  },

  // Portrait tabs styles
  tabsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  subTabRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 8,
    paddingTop: 4,
    gap: 6,
  },
  subTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  subTabActive: {
    backgroundColor: colors.primary,
  },
  subTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  subTabTextActive: {
    color: '#FFFFFF',
  },
});

export default SettingsSidebar;
