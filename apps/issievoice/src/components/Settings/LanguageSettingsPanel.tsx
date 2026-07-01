import React from 'react';
import {View, Text, StyleSheet, Switch} from 'react-native';
import {colors} from '../../constants';
import {useLocalization} from '../../context/LocalizationContext';

export type KbLanguage = 'he' | 'en' | 'ar';

/** Fixed cycle order for language switching */
export const LANGUAGE_CYCLE_ORDER: KbLanguage[] = ['he', 'en', 'ar'];

interface LanguageSettingsPanelProps {
  selectedLanguages: KbLanguage[];
  onSelectedLanguagesChange: (languages: KbLanguage[]) => void;
}

interface LanguageRowProps {
  label: string;
  enabled: boolean;
  isOnly: boolean;
  onToggle: (value: boolean) => void;
  isRTL: boolean;
}

const LanguageRow: React.FC<LanguageRowProps> = ({label, enabled, isOnly, onToggle, isRTL}) => (
  <View style={[styles.row, isRTL && {flexDirection: 'row-reverse'}]}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Switch
      value={enabled}
      onValueChange={onToggle}
      disabled={enabled && isOnly}
      trackColor={{false: '#D1D5DB', true: colors.primary + '80'}}
      thumbColor={enabled ? colors.primary : '#F3F4F6'}
      ios_backgroundColor="#D1D5DB"
    />
  </View>
);

const LanguageSettingsPanel: React.FC<LanguageSettingsPanelProps> = ({
  selectedLanguages,
  onSelectedLanguagesChange,
}) => {
  const {strings, isRTL} = useLocalization();
  const ls = strings.languageSettings;

  const isOnly = selectedLanguages.length === 1;

  const toggle = (lang: KbLanguage, value: boolean) => {
    if (value) {
      // Add language, maintain cycle order
      const newLangs = LANGUAGE_CYCLE_ORDER.filter(
        l => selectedLanguages.includes(l) || l === lang,
      );
      onSelectedLanguagesChange(newLangs);
    } else {
      if (isOnly) return;
      onSelectedLanguagesChange(selectedLanguages.filter(l => l !== lang));
    }
  };

  const languages: {key: KbLanguage; label: string}[] = [
    {key: 'he', label: ls.hebrew},
    {key: 'en', label: ls.english},
    {key: 'ar', label: ls.arabic},
  ];

  return (
    <View style={styles.container}>
      {languages.map(({key, label}) => (
        <LanguageRow
          key={key}
          label={label}
          enabled={selectedLanguages.includes(key)}
          isOnly={selectedLanguages.includes(key) && isOnly}
          onToggle={(value) => toggle(key, value)}
          isRTL={isRTL}
        />
      ))}
      {isOnly && (
        <Text style={[styles.hint, isRTL && {textAlign: 'right'}]}>
          {ls.atLeastOne}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  rowLabel: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1F2937',
  },
  hint: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 12,
    paddingHorizontal: 8,
  },
});

export default LanguageSettingsPanel;
