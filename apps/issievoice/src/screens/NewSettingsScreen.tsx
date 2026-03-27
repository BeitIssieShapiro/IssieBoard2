import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants';
import { useLocalization } from '../context/LocalizationContext';
import SettingsSidebar from '../components/Settings/SettingsSidebar';
import VoiceSettingsPanel from '../components/Settings/VoiceSettingsPanel';
import { EditorScreen } from '../../../../src/screens/EditorScreen';
import { LocalizationProvider as EditorLocalizationProvider } from '../../../../src/localization';
import { MyIcon } from '@beitissieshapiro/issie-shared/dist/icons';
import KeyboardPreferences from '../../../../src/native/KeyboardPreferences';

interface NewSettingsScreenProps {
  navigation: any;
  route: any;
}

const NewSettingsScreen: React.FC<NewSettingsScreenProps> = ({ navigation, route }) => {
  const [activeTab, setActiveTab] = useState<string>('general');
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { strings } = useLocalization();

  // Voice settings state (loaded from KeyboardPreferences on mount)
  const [englishVoice, setEnglishVoice] = useState<string | undefined>(
    route.params?.englishVoice
  );
  const [hebrewVoice, setHebrewVoice] = useState<string | undefined>(
    route.params?.hebrewVoice
  );

  // Load saved voice settings on mount
  useEffect(() => {
    const loadVoiceSettings = async () => {
      const savedEnVoice = await KeyboardPreferences.getProfile('issievoice_englishVoice');
      if (savedEnVoice) setEnglishVoice(savedEnVoice);
      const savedHeVoice = await KeyboardPreferences.getProfile('issievoice_hebrewVoice');
      if (savedHeVoice) setHebrewVoice(savedHeVoice);
    };
    loadVoiceSettings();
  }, []);

  const handleVoiceChange = async (language: 'en' | 'he', voiceId: string) => {
    if (language === 'en') {
      setEnglishVoice(voiceId);
      await KeyboardPreferences.setProfile(voiceId, 'issievoice_englishVoice');
    } else {
      setHebrewVoice(voiceId);
      await KeyboardPreferences.setProfile(voiceId, 'issievoice_hebrewVoice');
    }
  };

  const renderContent = () => {
    if (activeTab === 'voice') {
      return (
        <VoiceSettingsPanel
          englishVoice={englishVoice}
          hebrewVoice={hebrewVoice}
          onVoiceChange={handleVoiceChange}
        />
      );
    }

    // For keyboard tabs, render the EditorScreen
    // The EditorScreen already handles all config loading, profile management, etc.
    return (
      <EditorLocalizationProvider>
        <EditorScreen
          appContext="issievoice"
          initialLanguage={route.params?.initialLanguage}
          onClose={() => navigation.goBack()}
        />
      </EditorLocalizationProvider>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <MyIcon info={{ name: 'arrow-back', type: 'Ionicons', color: colors.primary, size: 24 }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        {isLandscape ? (
          // Landscape: sidebar on left, content on right
          <View style={styles.landscapeLayout}>
            <SettingsSidebar
              activeTab={activeTab}
              onTabChange={setActiveTab}
              isLandscape={true}
            />
            <View style={styles.detailArea}>
              {renderContent()}
            </View>
          </View>
        ) : (
          // Portrait: tabs on top, content below
          <View style={styles.portraitLayout}>
            <SettingsSidebar
              activeTab={activeTab}
              onTabChange={setActiveTab}
              isLandscape={false}
            />
            <View style={styles.detailArea}>
              {renderContent()}
            </View>
          </View>
        )}
      </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D1D5DB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
    marginLeft: 8,
  },
  mainContent: {
    flex: 1,
  },
  landscapeLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  portraitLayout: {
    flex: 1,
  },
  detailArea: {
    flex: 1,
  },
});

export default NewSettingsScreen;
