import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Image, ImageSourcePropType } from 'react-native';
import { colors } from '../../constants';
import { MyIcon, IconType } from '@beitissieshapiro/issie-shared/dist/icons';
import { cardShadow, subtleShadow } from '../../../../../src/styles/shadows';
import { useLocalization } from '../../context/LocalizationContext';

export interface SettingsSidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  isLandscape: boolean;
  disabledTabs?: string[];
  /** Tabs to completely hide (not shown at all) */
  hiddenTabs?: string[];
  /** 'voice' = IssieVoice (Keyboard group + Voice tab), 'keyboard' = IssieBoard (keyboard tabs only) */
  mode?: 'voice' | 'keyboard';
  /** Current keyboard language — used to pick the correct nikkud icon */
  kbLanguage?: 'en' | 'he' | 'ar';
  /** Called when the About (i) button is pressed */
  onAbout?: () => void;
}

type TabId = 'general' | 'keys-groups' | 'nikkud' | 'features' | 'advanced' | 'voice' | 'language';

interface TabDef {
  id: TabId;
  label: string;
  iconName?: string;
  iconType?: IconType;
  iconText?: string; // Unicode text icon (e.g. nikkud)
  iconImage?: ImageSourcePropType; // PNG asset icon
  iconColor: string; // accent color for inactive state
}

const NIKKUD_IMAGE_HE = require('../../../../../src/icons/nikkud_hataf_kamatz.png');
const NIKKUD_IMAGE_AR = require('../../../../../src/icons/nikkud_tashkeel.png');

const getKeyboardChildren = (tabLabels: { general: string; keysGroups: string; nikkud: string; features: string; advanced: string }, kbLanguage: 'en' | 'he' | 'ar'): TabDef[] => [
  { id: 'general', label: tabLabels.general, iconName: 'settings-outline', iconType: 'Ionicons', iconColor: colors.primary },
  { id: 'keys-groups', label: tabLabels.keysGroups, iconName: 'color-palette-outline', iconType: 'Ionicons', iconColor: '#7C3AED' },
  { id: 'nikkud', label: tabLabels.nikkud, iconImage: kbLanguage === 'ar' ? NIKKUD_IMAGE_AR : NIKKUD_IMAGE_HE, iconColor: '#059669' },
  { id: 'features', label: tabLabels.features, iconName: 'toggle-outline', iconType: 'Ionicons', iconColor: '#0891B2' },
  { id: 'advanced', label: tabLabels.advanced, iconName: 'cog-outline', iconType: 'Ionicons', iconColor: '#6B7280' },
];

const getVoiceTab = (label: string): TabDef => ({
  id: 'voice',
  label,
  iconName: 'volume-high-outline',
  iconType: 'Ionicons',
  iconColor: '#D97706',
});

const getLanguageTab = (label: string): TabDef => ({
  id: 'language' as TabId,
  label,
  iconName: 'globe-outline',
  iconType: 'Ionicons',
  iconColor: '#2563EB',
});

const KEYBOARD_CHILD_IDS: string[] = ['general', 'keys-groups', 'nikkud', 'features', 'advanced'];

const isKeyboardTab = (tabId: string): boolean =>
  KEYBOARD_CHILD_IDS.includes(tabId);


/** Renders a sidebar/tab item with icon circle + label, matching the card design */
const TabItem: React.FC<{
  tab: TabDef;
  isActive: boolean;
  onPress: () => void;
  indented?: boolean;
  disabled?: boolean;
  compact?: boolean;
  extraCompact?: boolean;
  hideLabel?: boolean;
  isRTL?: boolean;
}> = ({ tab, isActive, onPress, indented, disabled, compact, extraCompact, hideLabel, isRTL }) => (
  <TouchableOpacity
    style={[
      styles.sidebarCard,
      compact && styles.sidebarCardCompact,
      extraCompact && styles.sidebarCardExtraCompact,
      indented && (extraCompact ? styles.sidebarCardIndentedExtraCompact : compact ? styles.sidebarCardIndentedCompact : styles.sidebarCardIndented),
      isRTL && indented && (extraCompact ? styles.sidebarCardIndentedExtraCompactRTL : compact ? styles.sidebarCardIndentedCompactRTL : styles.sidebarCardIndentedRTL),
      isRTL && { flexDirection: 'row-reverse' },
      isActive && styles.sidebarCardActive,
      disabled && { opacity: 0.35 },
    ]}
    onPress={onPress}
    activeOpacity={0.7}
    disabled={disabled}>
    <View
      style={[
        extraCompact ? styles.iconCircleExtraCompact : compact ? styles.iconCircleCompact : styles.iconCircle,
        { backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : tab.iconColor + '18' },
      ]}>
      {tab.iconText ? (
        <Text allowFontScaling={false} style={{ fontSize: extraCompact ? 15 : compact ? 17 : 20, color: isActive ? '#FFFFFF' : tab.iconColor, fontWeight: '700' }}>
          {tab.iconText}
        </Text>
      ) : tab.iconImage ? (
        <Image
          source={tab.iconImage}
          style={{ width: extraCompact ? 20 : compact ? 24 : 28, height: extraCompact ? 20 : compact ? 24 : 28, tintColor: isActive ? '#FFFFFF' : tab.iconColor }}
          resizeMode="contain"
        />
      ) : (
        <MyIcon
          info={{
            name: tab.iconName!,
            type: tab.iconType!,
            color: isActive ? '#FFFFFF' : tab.iconColor,
            size: extraCompact ? 16 : compact ? 19 : 22,
          }}
        />
      )}
    </View>
    {!hideLabel && (
      <Text
        allowFontScaling={false}
        style={[
          extraCompact ? styles.sidebarCardTextExtraCompact : compact ? styles.sidebarCardTextCompact : styles.sidebarCardText,
          isActive && styles.sidebarCardTextActive,
        ]}>
        {tab.label}
      </Text>
    )}
  </TouchableOpacity>
);

const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  activeTab,
  onTabChange,
  isLandscape,
  disabledTabs,
  hiddenTabs,
  mode = 'voice',
  kbLanguage = 'he',
  onAbout,
}) => {
  const keyboardOnly = mode === 'keyboard';
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const shortSide = Math.min(screenWidth, screenHeight);
  const isPhone = shortSide < 600;
  const isPhoneVoice = isPhone && !keyboardOnly;

  const { strings, isRTL } = useLocalization();
  const tabLabels = strings.settings.tabs;
  const ALL_KEYBOARD_CHILDREN = getKeyboardChildren(tabLabels, kbLanguage);
  const KEYBOARD_CHILDREN = hiddenTabs ? ALL_KEYBOARD_CHILDREN.filter(t => !hiddenTabs.includes(t.id)) : ALL_KEYBOARD_CHILDREN;
  const VOICE_TAB = getVoiceTab(tabLabels.voice);
  const LANGUAGE_TAB = getLanguageTab(tabLabels.language);

  if (isLandscape) {
    return (
      <View style={[styles.sidebar, isPhoneVoice ? styles.sidebarExtraCompact : isPhone && styles.sidebarCompact, isRTL && { alignItems: 'stretch' }, isRTL && { marginLeft: 0, marginRight: 12 }]}>
        {/* Keyboard group header — only in voice mode */}
        {!keyboardOnly && (
          <TouchableOpacity
            style={[styles.groupHeader, isPhoneVoice ? styles.groupHeaderExtraCompact : isPhone && styles.groupHeaderCompact, isRTL && { flexDirection: 'row-reverse' }]}
            onPress={() => onTabChange('general')}
            activeOpacity={0.7}>
            <View style={[isPhoneVoice ? styles.iconCircleExtraCompact : isPhone ? styles.iconCircleCompact : styles.iconCircle, { backgroundColor: colors.primary + '18' }]}>
              <MyIcon
                info={{
                  name: 'keyboard-settings-outline',
                  type: 'MDI',
                  color: colors.primary,
                  size: isPhoneVoice ? 14 : isPhone ? 17 : 20,
                }}
              />
            </View>
            <Text allowFontScaling={false} style={[styles.groupHeaderText, isPhoneVoice ? styles.groupHeaderTextExtraCompact : isPhone && styles.groupHeaderTextCompact]}>{tabLabels.keyboard}</Text>
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
            compact={isPhone}
            extraCompact={isPhoneVoice}
            isRTL={isRTL}
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
              compact={isPhone}
              extraCompact={isPhoneVoice}
              isRTL={isRTL}
            />
            <View style={styles.divider} />
            <TabItem
              tab={LANGUAGE_TAB}
              isActive={activeTab === LANGUAGE_TAB.id}
              onPress={() => onTabChange(LANGUAGE_TAB.id)}
              compact={isPhone}
              extraCompact={isPhoneVoice}
              isRTL={isRTL}
            />
          </>
        )}

        {/* About button — pushed to bottom - landscape*/}
        {onAbout && (

          <View style={[styles.subTabAboutVContainer, isRTL && {flexDirection:"row-reverse"}]}>
            <TouchableOpacity
              style={[styles.sidebarCard, isPhone && styles.sidebarCardCompact, isPhoneVoice && styles.sidebarCardExtraCompact, { justifyContent: "flex-end" }]}
              onPress={onAbout}
              activeOpacity={0.7}>
              <View style={[isPhoneVoice ? styles.iconCircleExtraCompact : isPhone ? styles.iconCircleCompact : styles.iconCircle, { backgroundColor: colors.primary + '18' }]}>
                <MyIcon info={{ name: 'information-circle-outline', type: 'Ionicons', color: colors.primary, size: isPhoneVoice ? 16 : isPhone ? 19 : 22 }} />
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // Portrait mode
  if (keyboardOnly) {
    // Keyboard-only: single row of tabs (no two-level nesting)
    return (
      <View style={styles.tabsContainer}>
        <View style={[styles.subTabRow, isRTL && { flexDirection: 'row-reverse' }]}>
          {KEYBOARD_CHILDREN.map(tab => {
            const isActive = activeTab === tab.id;
            const isDisabled = disabledTabs?.includes(tab.id);
            return (
              <TouchableOpacity
                key={tab.id}
                style={[isPhone ? styles.subTabIconOnly : styles.subTab, isActive && styles.subTabActive]}
                onPress={() => onTabChange(tab.id)}
                activeOpacity={0.7}
                disabled={isDisabled}>
                <View
                  style={[
                    styles.iconCircleTiny,
                    { backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : tab.iconColor + '18' },
                    isDisabled && { opacity: 0.35 },
                  ]}>
                  {tab.iconText ? (
                    <Text allowFontScaling={false} style={{ fontSize: 15, color: isActive ? '#FFFFFF' : tab.iconColor, fontWeight: '700' }}>
                      {tab.iconText}
                    </Text>
                  ) : tab.iconImage ? (
                    <Image
                      source={tab.iconImage}
                      style={{ width: 20, height: 20, tintColor: isActive ? '#FFFFFF' : tab.iconColor }}
                      resizeMode="contain"
                    />
                  ) : (
                    <MyIcon
                      info={{
                        name: tab.iconName!,
                        type: tab.iconType!,
                        color: isActive ? '#FFFFFF' : tab.iconColor,
                        size: 16,
                      }}
                    />
                  )}
                </View>
                {!isPhone && (
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.subTabText,
                      isActive && styles.subTabTextActive,
                      isDisabled && { opacity: 0.35 },
                    ]}>
                    {tab.label}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}

          {/* About button — icon only, pushed to far end */}
          {onAbout && (
            <View style={[styles.subTabAboutHContainer, isRTL && { flexDirection: "row-reverse" }]}>
              <TouchableOpacity
                style={[styles.subTabIconOnly]}
                onPress={onAbout}
                activeOpacity={0.7}>
                <View style={[styles.iconCircleTiny, { backgroundColor: colors.primary + '18' }]}>
                  <MyIcon info={{ name: 'information-circle-outline', type: 'Ionicons', color: colors.primary, size: 16 }} />
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  }

  // Voice mode portrait: two-level top tabs
  const keyboardActive = isKeyboardTab(activeTab);

  return (
    <View style={styles.tabsContainer}>
      {/* Level 1: Keyboard | Voice */}
      <View style={[styles.tabRow, isRTL && { flexDirection: 'row-reverse' }]}>
        <TouchableOpacity
          style={[styles.tab, keyboardActive && styles.tabActive, isRTL && { flexDirection: 'row-reverse' }]}
          onPress={() => {
            if (!keyboardActive) {
              onTabChange('general');
            }
          }}
          activeOpacity={0.7}>
          <View
            style={[
              styles.iconCircleSmall,
              { backgroundColor: keyboardActive ? 'rgba(255,255,255,0.25)' : colors.primary + '18' },
            ]}>
            <MyIcon
              info={{
                name: 'keyboard-settings-outline',
                type: 'MDI',
                color: keyboardActive ? '#FFFFFF' : colors.primary,
                size: 18,
              }}
            />
          </View>
          <Text allowFontScaling={false} style={[styles.tabText, keyboardActive && styles.tabTextActive]}>
            {tabLabels.keyboard}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'voice' && styles.tabActive, isRTL && { flexDirection: 'row-reverse' }]}
          onPress={() => onTabChange('voice')}
          activeOpacity={0.7}>
          <View
            style={[
              styles.iconCircleSmall,
              { backgroundColor: activeTab === 'voice' ? 'rgba(255,255,255,0.25)' : VOICE_TAB.iconColor + '18' },
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
            allowFontScaling={false}
            style={[
              styles.tabText,
              activeTab === 'voice' && styles.tabTextActive,
            ]}>
            {tabLabels.voice}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'language' && styles.tabActive, isRTL && { flexDirection: 'row-reverse' }]}
          onPress={() => onTabChange('language')}
          activeOpacity={0.7}>
          <View
            style={[
              styles.iconCircleSmall,
              { backgroundColor: activeTab === 'language' ? 'rgba(255,255,255,0.25)' : LANGUAGE_TAB.iconColor + '18' },
            ]}>
            <MyIcon
              info={{
                name: LANGUAGE_TAB.iconName!,
                type: LANGUAGE_TAB.iconType!,
                color: activeTab === 'language' ? '#FFFFFF' : LANGUAGE_TAB.iconColor,
                size: 16,
              }}
            />
          </View>
          <Text
            allowFontScaling={false}
            style={[
              styles.tabText,
              activeTab === 'language' && styles.tabTextActive,
            ]}>
            {tabLabels.language}
          </Text>
        </TouchableOpacity>

        {/* About button */}
        {onAbout && (
          <View style={[styles.subTabAboutContainer]}>
            <TouchableOpacity
              style={[styles.tab, isRTL ? { marginRight: 'auto' } : { marginLeft: 'auto' }, isRTL && { flexDirection: 'row-reverse' }]}
              onPress={onAbout}
              activeOpacity={0.7}>
              <View style={[styles.iconCircleSmall, { backgroundColor: colors.primary + '18' }]}>
                <MyIcon info={{ name: 'information-circle-outline', type: 'Ionicons', color: colors.primary, size: 18 }} />
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Level 2: sub-tabs (only when Keyboard is active) */}
      {keyboardActive && (
        <View style={[styles.subTabRow, isRTL && { flexDirection: 'row-reverse' }]}>
          {KEYBOARD_CHILDREN.map(tab => {
            const isActive = activeTab === tab.id;
            const isDisabled = disabledTabs?.includes(tab.id);
            return (
              <TouchableOpacity
                key={tab.id}
                style={[isPhone ? styles.subTabIconOnly : styles.subTab, isActive && styles.subTabActive]}
                onPress={() => onTabChange(tab.id)}
                activeOpacity={0.7}
                disabled={isDisabled}>
                <View
                  style={[
                    styles.iconCircleTiny,
                    { backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : tab.iconColor + '18' },
                    isDisabled && { opacity: 0.35 },
                  ]}>
                  {tab.iconText ? (
                    <Text allowFontScaling={false} style={{ fontSize: 15, color: isActive ? '#FFFFFF' : tab.iconColor, fontWeight: '700' }}>
                      {tab.iconText}
                    </Text>
                  ) : tab.iconImage ? (
                    <Image
                      source={tab.iconImage}
                      style={{ width: 20, height: 20, tintColor: isActive ? '#FFFFFF' : tab.iconColor }}
                      resizeMode="contain"
                    />
                  ) : (
                    <MyIcon
                      info={{
                        name: tab.iconName!,
                        type: tab.iconType!,
                        color: isActive ? '#FFFFFF' : tab.iconColor,
                        size: 16,
                      }}
                    />
                  )}
                </View>
                {!isPhone && (
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.subTabText,
                      isActive && styles.subTabTextActive,
                      isDisabled && { opacity: 0.35 },
                    ]}>
                    {tab.label}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Landscape sidebar styles — default (iPad)
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
  sidebarCompact: {
    width: 170,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 16,
    gap: 2,
  },
  sidebarExtraCompact: {
    width: 150,
    paddingVertical: 6,
    paddingHorizontal: 5,
    borderRadius: 14,
    gap: 2,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  groupHeaderCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  groupHeaderExtraCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
  },
  groupHeaderText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  groupHeaderTextCompact: {
    fontSize: 13,
  },
  groupHeaderTextExtraCompact: {
    fontSize: 12,
  },
  // Card-style sidebar items — default (iPad)
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
  sidebarCardCompact: {
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 8,
  },
  sidebarCardExtraCompact: {
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
  },
  sidebarCardIndented: {
    marginLeft: 28,
  },
  sidebarCardIndentedRTL: {
    marginLeft: 0,
    marginRight: 28,
  },
  sidebarCardIndentedCompact: {
    marginLeft: 20,
  },
  sidebarCardIndentedCompactRTL: {
    marginLeft: 0,
    marginRight: 20,
  },
  sidebarCardIndentedExtraCompact: {
    marginLeft: 12,
  },
  sidebarCardIndentedExtraCompactRTL: {
    marginLeft: 0,
    marginRight: 12,
  },
  sidebarCardActive: {
    backgroundColor: colors.primary,
    ...cardShadow,
  },
  sidebarCardText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  sidebarCardTextCompact: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  sidebarCardTextExtraCompact: {
    fontSize: 13,
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
  iconCircleCompact: {
    width: 30,
    height: 30,
    borderRadius: 10,
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
  iconCircleExtraCompact: {
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
    justifyContent: 'flex-start',
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
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  subTabRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    paddingBottom: 8,
    paddingTop: 4,
    gap: 6,
  },
  // Sub-tab with icon + label (iPad / tablet)
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
  // Sub-tab icon only (phone)
  subTabIconOnly: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    ...subtleShadow,
  },
  subTabAboutHContainer: {
    justifyContent: 'flex-end',
    flexDirection: "row",
    flex: 1,
  },
  subTabAboutVContainer: {
    alignItems: 'flex-end',
    flexDirection: "row",
    flex: 1,
  },
  subTabActive: {
    backgroundColor: colors.primary,
  },
  subTabText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  subTabTextActive: {
    color: '#FFFFFF',
  },
});

export default SettingsSidebar;
