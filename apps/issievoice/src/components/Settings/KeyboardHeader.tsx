import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MyIcon } from '@beitissieshapiro/issie-shared/dist/icons';
import { colors } from '../../constants';
import { cardShadow } from '../../../../../src/styles/shadows';

export interface KeyboardHeaderProps {
  currentLanguage: 'en' | 'he' | 'ar';
  onLanguageChange: (language: 'en' | 'he' | 'ar') => void;
  profileName: string;
  onProfilePress: () => void;
  onSave: () => void;
  onSaveAs?: () => void;
  isDirty: boolean;
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
}) => {
  return (
    <View style={styles.container}>
      {/* Language toggle pills */}
      <View style={styles.languageTabs}>
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
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Profile name + select */}
      <TouchableOpacity
        style={styles.profileButton}
        onPress={onProfilePress}
        activeOpacity={0.7}>
        <MyIcon info={{ name: 'keyboard-settings-outline', type: 'MDI', color: colors.primary, size: 18 }} />
        <Text style={styles.profileName} numberOfLines={1} ellipsizeMode="tail">
          {profileName}
        </Text>
        <MyIcon info={{ name: 'chevron-down', type: 'Ionicons', color: colors.textLight, size: 16 }} />
      </TouchableOpacity>

      {/* Save / Save As */}
      <View style={styles.actions}>
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
          <Text style={[styles.saveText, !isDirty && styles.saveTextDisabled]}>Save</Text>
        </TouchableOpacity>

        {onSaveAs && (
          <TouchableOpacity
            style={styles.saveAsButton}
            onPress={onSaveAs}
            activeOpacity={0.7}>
            <Text style={styles.saveAsText}>Save As</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    ...cardShadow,
    gap: 10,
  },
  languageTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    padding: 3,
  },
  languageTab: {
    paddingHorizontal: 12,
    paddingVertical: 5,
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
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  languageTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  profileName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  saveButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  saveText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saveTextDisabled: {
    color: colors.textLight,
  },
  saveAsButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  saveAsText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});

export default KeyboardHeader;
