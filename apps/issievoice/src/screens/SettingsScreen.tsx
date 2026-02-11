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
import {colors, sizes} from '../constants';

interface SettingsScreenProps {
  navigation: any;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({navigation}) => {
  const {settings, updateSettings} = useTTS();

  const handleRateChange = async (rate: number) => {
    await updateSettings({rate});
  };

  const handlePitchChange = async (pitch: number) => {
    await updateSettings({pitch});
  };

  const rateOptions = [
    {label: 'Slow', value: 0.3},
    {label: 'Normal', value: 0.5},
    {label: 'Fast', value: 0.7},
  ];

  const pitchOptions = [
    {label: 'Low', value: 0.8},
    {label: 'Normal', value: 1.0},
    {label: 'High', value: 1.2},
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Speech Rate */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Speech Speed</Text>
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
          <Text style={styles.sectionTitle}>Voice Pitch</Text>
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

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>About IssieVoice</Text>
          <Text style={styles.infoText}>
            IssieVoice helps people who cannot speak to communicate by typing
            text and having it read aloud.
          </Text>
          <Text style={styles.infoText}>Version 1.0.0</Text>
        </View>
      </ScrollView>
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
  infoSection: {
    padding: sizes.spacing.lg,
    marginTop: sizes.spacing.xl,
  },
  infoTitle: {
    fontSize: sizes.fontSize.large,
    fontWeight: '600',
    color: colors.text,
    marginBottom: sizes.spacing.md,
  },
  infoText: {
    fontSize: sizes.fontSize.medium,
    color: colors.textSecondary,
    lineHeight: sizes.fontSize.medium * 1.5,
    marginBottom: sizes.spacing.sm,
  },
});

export default SettingsScreen;