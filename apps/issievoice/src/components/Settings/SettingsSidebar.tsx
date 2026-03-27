import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {colors} from '../../constants';
import {MyIcon, IconType} from '@beitissieshapiro/issie-shared/dist/icons';
import {cardShadow, subtleShadow} from '../../../../../src/styles/shadows';

export interface SettingsSidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  isLandscape: boolean;
  disabledTabs?: string[];
  /** 'voice' = IssieVoice (Keyboard group + Voice tab), 'keyboard' = IssieBoard (keyboard tabs only) */
  mode?: 'voice' | 'keyboard';
}

type TabId = 'general' | 'keys-groups' | 'nikkud' | 'features' | 'advanced' | 'voice';

interface TabDef {
  id: TabId;
  label: string;
  iconName?: string;
  iconType?: IconType;
  iconText?: string; // Unicode text icon (e.g. nikkud)
  iconColor: string; // accent color for inactive state
}

const KEYBOARD_CHILDREN: TabDef[] = [
  {id: 'general', label: 'General', iconName: 'settings-outline', iconType: 'Ionicons', iconColor: colors.primary},
  {id: 'keys-groups', label: 'Keys Groups', iconName: 'color-palette-outline', iconType: 'Ionicons', iconColor: '#7C3AED'},
  {id: 'nikkud', label: 'Nikkud', iconText: '\u25CC\u05B8', iconColor: '#059669'},
  {id: 'features', label: 'Features', iconName: 'toggle-outline', iconType: 'Ionicons', iconColor: '#0891B2'},
  {id: 'advanced', label: 'Advanced', iconName: 'cog-outline', iconType: 'Ionicons', iconColor: '#6B7280'},
];

const VOICE_TAB: TabDef = {
  id: 'voice',
  label: 'Voice',
  iconName: 'volume-high-outline',
  iconType: 'Ionicons',
  iconColor: '#D97706',
};

const KEYBOARD_CHILD_IDS: string[] = KEYBOARD_CHILDREN.map(t => t.id);

const isKeyboardTab = (tabId: string): boolean =>
  KEYBOARD_CHILD_IDS.includes(tabId);

/** Renders a sidebar/tab item with icon circle + label, matching the card design */
const TabItem: React.FC<{
  tab: TabDef;
  isActive: boolean;
  onPress: () => void;
  indented?: boolean;
  disabled?: boolean;
}> = ({tab, isActive, onPress, indented, disabled}) => (
  <TouchableOpacity
    style={[
      styles.sidebarCard,
      indented && styles.sidebarCardIndented,
      isActive && styles.sidebarCardActive,
      disabled && { opacity: 0.35 },
    ]}
    onPress={onPress}
    activeOpacity={0.7}
    disabled={disabled}>
    <View
      style={[
        styles.iconCircle,
        {backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : tab.iconColor + '18'},
      ]}>
      {tab.iconText ? (
        <Text style={{fontSize: 18, color: isActive ? '#FFFFFF' : tab.iconColor, fontWeight: '700'}}>
          {tab.iconText}
        </Text>
      ) : (
        <MyIcon
          info={{
            name: tab.iconName!,
            type: tab.iconType!,
            color: isActive ? '#FFFFFF' : tab.iconColor,
            size: 20,
          }}
        />
      )}
    </View>
    <Text
      style={[
        styles.sidebarCardText,
        isActive && styles.sidebarCardTextActive,
      ]}>
      {tab.label}
    </Text>
  </TouchableOpacity>
);

const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  activeTab,
  onTabChange,
  isLandscape,
  disabledTabs,
  mode = 'voice',
}) => {
  const keyboardOnly = mode === 'keyboard';

  if (isLandscape) {
    return (
      <View style={styles.sidebar}>
        {/* Keyboard group header — only in voice mode */}
        {!keyboardOnly && (
          <TouchableOpacity
            style={styles.groupHeader}
            onPress={() => onTabChange('general')}
            activeOpacity={0.7}>
            <View style={[styles.iconCircle, {backgroundColor: colors.primary + '18'}]}>
              <MyIcon
                info={{
                  name: 'keyboard-settings-outline',
                  type: 'MDI',
                  color: colors.primary,
                  size: 20,
                }}
              />
            </View>
            <Text style={styles.groupHeaderText}>Keyboard</Text>
          </TouchableOpacity>
        )}

        {/* Keyboard children */}
        {KEYBOARD_CHILDREN.map(tab => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={activeTab === tab.id}
            onPress={() => onTabChange(tab.id)}
            indented={!keyboardOnly}
            disabled={disabledTabs?.includes(tab.id)}
          />
        ))}

        {/* Divider + Voice tab — only in voice mode */}
        {!keyboardOnly && (
          <>
            <View style={styles.divider} />
            <TabItem
              tab={VOICE_TAB}
              isActive={activeTab === VOICE_TAB.id}
              onPress={() => onTabChange(VOICE_TAB.id)}
            />
          </>
        )}
      </View>
    );
  }

  // Portrait mode
  if (keyboardOnly) {
    // Keyboard-only: single row of tabs (no two-level nesting)
    return (
      <View style={styles.tabsContainer}>
        <View style={styles.subTabRow}>
          {KEYBOARD_CHILDREN.map(tab => {
            const isActive = activeTab === tab.id;
            const isDisabled = disabledTabs?.includes(tab.id);
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.subTab, isActive && styles.subTabActive]}
                onPress={() => onTabChange(tab.id)}
                activeOpacity={0.7}
                disabled={isDisabled}>
                <View
                  style={[
                    styles.iconCircleTiny,
                    {backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : tab.iconColor + '18'},
                    isDisabled && {opacity: 0.35},
                  ]}>
                  {tab.iconText ? (
                    <Text style={{fontSize: 13, color: isActive ? '#FFFFFF' : tab.iconColor, fontWeight: '700'}}>
                      {tab.iconText}
                    </Text>
                  ) : (
                    <MyIcon
                      info={{
                        name: tab.iconName!,
                        type: tab.iconType!,
                        color: isActive ? '#FFFFFF' : tab.iconColor,
                        size: 14,
                      }}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.subTabText,
                    isActive && styles.subTabTextActive,
                    isDisabled && {opacity: 0.35},
                  ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  // Voice mode portrait: two-level top tabs
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
          <View
            style={[
              styles.iconCircleSmall,
              {backgroundColor: keyboardActive ? 'rgba(255,255,255,0.25)' : colors.primary + '18'},
            ]}>
            <MyIcon
              info={{
                name: 'keyboard-settings-outline',
                type: 'MDI',
                color: keyboardActive ? '#FFFFFF' : colors.primary,
                size: 16,
              }}
            />
          </View>
          <Text style={[styles.tabText, keyboardActive && styles.tabTextActive]}>
            Keyboard
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'voice' && styles.tabActive]}
          onPress={() => onTabChange('voice')}
          activeOpacity={0.7}>
          <View
            style={[
              styles.iconCircleSmall,
              {backgroundColor: activeTab === 'voice' ? 'rgba(255,255,255,0.25)' : VOICE_TAB.iconColor + '18'},
            ]}>
            <MyIcon
              info={{
                name: VOICE_TAB.iconName!,
                type: VOICE_TAB.iconType!,
                color: activeTab === 'voice' ? '#FFFFFF' : VOICE_TAB.iconColor,
                size: 16,
              }}
            />
          </View>
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
            const isDisabled = disabledTabs?.includes(tab.id);
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.subTab, isActive && styles.subTabActive]}
                onPress={() => onTabChange(tab.id)}
                activeOpacity={0.7}
                disabled={isDisabled}>
                <View
                  style={[
                    styles.iconCircleTiny,
                    {backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : tab.iconColor + '18'},
                    isDisabled && {opacity: 0.35},
                  ]}>
                  {tab.iconText ? (
                    <Text style={{fontSize: 13, color: isActive ? '#FFFFFF' : tab.iconColor, fontWeight: '700'}}>
                      {tab.iconText}
                    </Text>
                  ) : (
                    <MyIcon
                      info={{
                        name: tab.iconName!,
                        type: tab.iconType!,
                        color: isActive ? '#FFFFFF' : tab.iconColor,
                        size: 14,
                      }}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.subTabText,
                    isActive && styles.subTabTextActive,
                    isDisabled && {opacity: 0.35},
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
    width: 200,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginTop: 8,
    marginLeft: 12,
    marginBottom: 12,
    borderRadius: 20,
    ...cardShadow,
    gap: 4,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  groupHeaderText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  // Card-style sidebar items
  sidebarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 10,
    backgroundColor: '#FFFFFF',
    ...subtleShadow,
  },
  sidebarCardIndented: {
    marginLeft: 20,
  },
  sidebarCardActive: {
    backgroundColor: colors.primary,
    ...cardShadow,
  },
  sidebarCardText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  sidebarCardTextActive: {
    color: '#FFFFFF',
  },
  // Icon circles
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleSmall: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleTiny: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 6,
    marginHorizontal: 12,
  },

  // Portrait tabs styles
  tabsContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 16,
    ...cardShadow,
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
    backgroundColor: '#F1F5F9',
    minWidth: 130,
    ...subtleShadow,
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
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    paddingTop: 4,
    gap: 6,
  },
  subTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
    backgroundColor: '#F1F5F9',
    ...subtleShadow,
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
