import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {useTTS} from '../context/TTSContext';
import {useLocalization} from '../context/LocalizationContext';
import {colors, sizes} from '../constants';
import { AboutScreen } from '../../../../src/components/AboutScreen';
import { ISSIEVOICE_ABOUT } from '../../../../src/components/about-content';

interface SettingsScreenProps {
  navigation: any;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({navigation}) => {
  const {settings, updateSettings} = useTTS();
  const {strings} = useLocalization();
  const [showAbout, setShowAbout] = useState(false);

  const handleRateChange = async (rate: number) => {
    await updateSettings({rate});
  };

  const handlePitchChange = async (pitch: number) => {
    await updateSettings({pitch});
  };

  const rateOptions = [
    {label: strings.settings.slow, value: 0.3},
    {label: strings.settings.normal, value: 0.5},
    {label: strings.settings.fast, value: 0.7},
  ];

  const pitchOptions = [
    {label: strings.settings.low, value: 0.8},
    {label: strings.settings.normal, value: 1.0},
    {label: strings.settings.high, value: 1.2},
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <Text style={styles.backButtonText}>{strings.common.back}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{strings.settings.title}</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Speech Rate */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{strings.settings.speechSpeed}</Text>
          <View style={styles.optionsRow}>
            {rateOptions.map(option => (
              <TouchableOpacity
                key={option.label}
                style={[
                  styles.optionButton,
                  settings.rate === option.value && styles.optionButtonActive,
                ]}
                onPress={() => handleRateChange(option.value)}
                activeOpacity={0.7}>
                <Text
                  style={[
                    styles.optionText,
                    settings.rate === option.value &&
                      styles.optionTextActive,
                  ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Pitch */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{strings.settings.voicePitch}</Text>
          <View style={styles.optionsRow}>
            {pitchOptions.map(option => (
              <TouchableOpacity
                key={option.label}
                style={[
                  styles.optionButton,
                  settings.pitch === option.value && styles.optionButtonActive,
                ]}
                onPress={() => handlePitchChange(option.value)}
                activeOpacity={0.7}>
                <Text
                  style={[
                    styles.optionText,
                    settings.pitch === option.value &&
                      styles.optionTextActive,
                  ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* About row */}
        <TouchableOpacity
          style={styles.aboutRow}
          onPress={() => setShowAbout(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.aboutRowText}>{strings.settings.aboutTitle}</Text>
          <Text style={styles.aboutRowArrow}>›</Text>
        </TouchableOpacity>
      </ScrollView>
      <AboutScreen
        visible={showAbout}
        appName="IssieVoice"
        onClose={() => setShowAbout(false)}
        paragraphs={ISSIEVOICE_ABOUT}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sizes.spacing.md,
    paddingVertical: sizes.spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    paddingRight: sizes.spacing.md,
  },
  backButtonText: {
    fontSize: sizes.fontSize.large,
    color: colors.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: sizes.fontSize.xlarge,
    fontWeight: 'bold',
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: sizes.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  sectionTitle: {
    fontSize: sizes.fontSize.large,
    fontWeight: '600',
    color: colors.text,
    marginBottom: sizes.spacing.md,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: sizes.spacing.sm,
  },
  optionButton: {
    flex: 1,
    height: sizes.touchTarget.large,
    backgroundColor: colors.surface,
    borderRadius: sizes.borderRadius.medium,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  optionButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  optionText: {
    fontSize: sizes.fontSize.medium,
    color: colors.text,
    fontWeight: '500',
  },
  optionTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: sizes.spacing.lg,
    marginTop: sizes.spacing.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderLight,
  },
  aboutRowText: {
    fontSize: sizes.fontSize.large,
    fontWeight: '600',
    color: colors.primary,
  },
  aboutRowArrow: {
    fontSize: 24,
    color: colors.textSecondary,
  },
});

export default SettingsScreen;