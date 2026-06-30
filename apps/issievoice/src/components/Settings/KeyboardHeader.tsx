import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { MyIcon } from '@beitissieshapiro/issie-shared/dist/icons';
import { colors } from '../../constants';
import { getStrings } from '../../../../../src/localization/strings';
import { useLocalization } from '../../context/LocalizationContext';

export interface KeyboardHeaderProps {
  currentLanguage: 'en' | 'he' | 'ar';
  onLanguageChange: (language: 'en' | 'he' | 'ar') => void;
  profileName: string;
  onProfilePress: () => void;
  onSave: () => void;
  onSaveAs?: () => void;
  isDirty: boolean;
  showFullAccessBadge?: boolean;
  onFullAccessBadgePress?: () => void;
  onSwitchToClassic?: () => void;
  onAbout?: () => void;
  onDiscard?: () => void;
  canGoBack?: boolean;
  onGoBack?: () => void;
}

const LANGUAGES: { id: 'en' | 'he' | 'ar'; label: string }[] = [
  { id: 'he', label: 'עברית' },
  { id: 'en', label: 'English' },
  { id: 'ar', label: 'العربية' },
];

const KeyboardHeader: React.FC<KeyboardHeaderProps> = ({
  currentLanguage,
  onLanguageChange,
  profileName,
  onProfilePress,
  onSave,
  onSaveAs,
  isDirty,
  showFullAccessBadge,
  onFullAccessBadgePress,
  onSwitchToClassic,
  onAbout,
  onDiscard,
  canGoBack,
  onGoBack,
}) => {
  const {width, height} = useWindowDimensions();
  const shortSide = Math.min(width, height);
  const isPhone = shortSide < 500;
  const isPortrait = height > width;
  const twoRows = isPhone && isPortrait;
  const { language: uiLanguage, isRTL } = useLocalization();
  const strings = getStrings(uiLanguage);

  const saveOpacity = useRef(new Animated.Value(1)).current;
  const blinkAnim = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isDirty) {
      blinkAnim.current = Animated.loop(
        Animated.sequence([
          Animated.timing(saveOpacity, { toValue: 0.25, duration: 500, useNativeDriver: true }),
          Animated.timing(saveOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
      );
      blinkAnim.current.start();
    } else {
      blinkAnim.current?.stop();
      saveOpacity.setValue(1);
    }
  }, [isDirty, saveOpacity]);

  return (
    <View style={[styles.container, twoRows && styles.containerTwoRows, isRTL && { direction: 'rtl' }]}>
      {/* Back button */}
      {canGoBack && (
        <TouchableOpacity style={styles.backButton} onPress={onGoBack} activeOpacity={0.7}>
          <MyIcon info={{ name: isRTL ? 'arrow-forward' : 'arrow-back', type: 'Ionicons', color: '#FFFFFF', size: 20 }} />
        </TouchableOpacity>
      )}

      {/* Row 1 (or inline): Language toggle pills */}
      <View style={[styles.languageTabs, twoRows && styles.languageTabsCentered]}>
        {LANGUAGES.map(lang => {
          const isActive = currentLanguage === lang.id;
          return (
            <TouchableOpacity
              key={lang.id}
              style={[styles.languageTab, isActive && styles.languageTabActive]}
              onPress={() => onLanguageChange(lang.id)}
              activeOpacity={0.7}>
              <Text
                allowFontScaling={false}
                style={[
                  styles.languageTabText,
                  isActive && styles.languageTabTextActive,
                ]}>
                {lang.label}
              </Text>
              {isActive && showFullAccessBadge && (
                <TouchableOpacity
                  style={styles.fullAccessBadge}
                  onPress={onFullAccessBadgePress}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <View style={styles.fullAccessBadgeCircle}>
                    <MyIcon info={{ name: 'warning-outline', type: 'Ionicons', color: '#D97706', size: 12 }} />
                  </View>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Row 2 (or inline): Profile + Save */}
      <View style={[styles.row2, twoRows && styles.row2TwoRows]}>
        <Text allowFontScaling={false} style={styles.profileLabel}>{strings.profiles.currentKeyboard}</Text>
        <TouchableOpacity
          style={[styles.profileButton]}
          onPress={onProfilePress}
          activeOpacity={0.7}>
          <MyIcon info={{ name: 'keyboard-settings-outline', type: 'MDI', color: colors.primary, size: 22 }} />
          <Text allowFontScaling={false} style={[styles.profileName]} numberOfLines={1} ellipsizeMode="tail">
            {profileName}
          </Text>
          <MyIcon info={{ name: 'chevron-down', type: 'Ionicons', color: colors.textLight, size: 20 }} />
        </TouchableOpacity>

        <View style={styles.actions}>
          {onDiscard && (
            <TouchableOpacity
              style={[styles.cancelButton, !isDirty && styles.cancelButtonDisabled]}
              onPress={onDiscard}
              disabled={!isDirty}
              activeOpacity={0.7}>
              <MyIcon
                info={{
                  name: 'close-circle-outline',
                  type: 'Ionicons',
                  color: isDirty ? '#EF4444' : colors.textLight,
                  size: 18,
                }}
              />
              <Text style={[styles.cancelText, !isDirty && styles.cancelTextDisabled]}>{strings.common.cancel}</Text>
            </TouchableOpacity>
          )}
          <Animated.View style={{ opacity: saveOpacity }}>
            <TouchableOpacity
              style={[styles.saveButton, !isDirty && styles.saveButtonDisabled]}
              onPress={onSave}
              disabled={!isDirty}
              activeOpacity={0.7}>
              <MyIcon
                info={{
                  name: 'save-outline',
                  type: 'Ionicons',
                  color: isDirty ? '#FFFFFF' : colors.textLight,
                  size: 18,
                }}
              />
              <Text style={[styles.saveText, !isDirty && styles.saveTextDisabled]}>{strings.common.save}</Text>
            </TouchableOpacity>
          </Animated.View>

          {onSaveAs && (
            <TouchableOpacity
              style={styles.saveAsButton}
              onPress={onSaveAs}
              activeOpacity={0.7}>
              <Text style={styles.saveAsText}>{strings.editor.saveAs}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Classic View button */}
      {onSwitchToClassic && (
        <TouchableOpacity style={styles.classicButton} onPress={onSwitchToClassic} activeOpacity={0.7}>
          <Text style={styles.classicButtonText}>{strings.editor.classicView}</Text>
        </TouchableOpacity>
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  containerTwoRows: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  },
  languageTabs: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    height: 44,
  },
  languageTabsCentered: {
    alignSelf: 'center',
  },
  languageTab: {
    paddingHorizontal: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  languageTabActive: {
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  languageTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  languageTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  fullAccessBadge: {
    position: 'absolute',
    top: -8,
    right: 0,
  },
  fullAccessBadgeCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  row2: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  row2TwoRows: {
    flex: 0,
  },
  profileLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary + '55',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    textAlign: 'left'
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
  },
  cancelButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EF4444',
  },
  cancelTextDisabled: {
    color: colors.textLight,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
  },
  saveButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  saveText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saveTextDisabled: {
    color: colors.textLight,
  },
  saveAsButton: {
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    justifyContent: 'center',
  },
  saveAsText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  classicButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    marginInlineStart: 25, 
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  classicButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default KeyboardHeader;
