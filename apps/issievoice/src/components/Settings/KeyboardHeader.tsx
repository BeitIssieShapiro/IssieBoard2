import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MyIcon } from '@beitissieshapiro/issie-shared/dist/icons';
import { colors } from '../../constants';

export interface KeyboardHeaderProps {
  currentLanguage: 'en' | 'he';
  onLanguageChange: (language: 'en' | 'he') => void;
  profileName: string;
  onProfilePress: () => void;
  onSave: () => void;
  isDirty: boolean;
}

const LANGUAGES: { id: 'en' | 'he'; label: string }[] = [
  { id: 'he', label: 'עברית' },
  { id: 'en', label: 'English' },
];

const KeyboardHeader: React.FC<KeyboardHeaderProps> = ({
  currentLanguage,
  onLanguageChange,
  profileName,
  onProfilePress,
  onSave,
  isDirty,
}) => {
  return (
    <View style={styles.container}>
      {/* Left side: Language toggle buttons */}
      <View style={styles.languageTabs}>
        {LANGUAGES.map(lang => {
          const isActive = currentLanguage === lang.id;
          return (
            <TouchableOpacity
              key={lang.id}
              style={[styles.languageTab, isActive && styles.languageTabActive]}
              onPress={() => onLanguageChange(lang.id)}
              accessibilityLabel={lang.label}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text
                allowFontScaling={false}
                style={[
                  styles.languageTabText,
                  isActive && styles.languageTabTextActive,
                ]}
              >
                {lang.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Right side: Profile name + Save button */}
      <View style={styles.rightSection}>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={onProfilePress}
          accessibilityLabel={`Profile: ${profileName}`}
          accessibilityRole="button"
        >
          <Text style={styles.profileLabel}>Profile: </Text>
          <Text style={styles.profileName} numberOfLines={1} ellipsizeMode="tail">
            {profileName}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, !isDirty && styles.saveButtonDisabled]}
          onPress={onSave}
          disabled={!isDirty}
          accessibilityLabel="Save"
          accessibilityRole="button"
          accessibilityState={{ disabled: !isDirty }}
        >
          <MyIcon
            info={{
              name: 'save-outline',
              type: 'Ionicons',
              color: isDirty ? colors.primary : colors.textLight,
              size: 22,
            }}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 50,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  languageTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.borderLight,
    borderRadius: 20,
    padding: 3,
  },
  languageTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 17,
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
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  languageTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    maxWidth: 200,
  },
  profileLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  profileName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    flexShrink: 1,
  },
  saveButton: {
    padding: 6,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
});

export default KeyboardHeader;
