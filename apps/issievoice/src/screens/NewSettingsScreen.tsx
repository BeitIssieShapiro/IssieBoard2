import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants';
import { useLocalization } from '../context/LocalizationContext';
import SettingsSidebar from '../components/Settings/SettingsSidebar';
import KeyboardHeader from '../components/Settings/KeyboardHeader';
import VoiceSettingsPanel from '../components/Settings/VoiceSettingsPanel';
import { EditorScreen } from '../../../../src/screens/EditorScreen';
import { LocalizationProvider as EditorLocalizationProvider } from '../../../../src/localization';
import { MyIcon } from '@beitissieshapiro/issie-shared/dist/icons';
import KeyboardPreferences from '../../../../src/native/KeyboardPreferences';

const KEYBOARD_TABS = ['general', 'keys-groups', 'nikkud', 'features', 'advanced'];

interface NewSettingsScreenProps {
  navigation: any;
  route: any;
}

const NewSettingsScreen: React.FC<NewSettingsScreenProps> = ({ navigation, route }) => {
  const [activeTab, setActiveTab] = useState<string>('general');
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { strings } = useLocalization();

  // Keyboard config state
  const [kbLanguage, setKbLanguage] = useState<'en' | 'he' | 'ar'>(
    route.params?.initialLanguage || 'he'
  );
  const [profileName, setProfileName] = useState<string>('Default');
  const [isDirty, setIsDirty] = useState(false);
  const showProfilePickerRef = useRef<(() => void) | null>(null);
  const changeLanguageRef = useRef<((lang: 'en' | 'he' | 'ar') => void) | null>(null);
  const saveRef = useRef<(() => void) | null>(null);

  const handleEditorStateChange = useCallback((state: { language: string; profileName: string; isDirty: boolean }) => {
    setKbLanguage(state.language as 'en' | 'he' | 'ar');
    setProfileName(state.profileName);
    setIsDirty(state.isDirty);
  }, []);

  // English has no diacritics — disable nikkud tab
  const disabledTabs = useMemo(
    () => (kbLanguage === 'en' ? ['nikkud'] : []),
    [kbLanguage],
  );

  // Auto-switch away from nikkud when it becomes disabled
  useEffect(() => {
    if (activeTab === 'nikkud' && kbLanguage === 'en') {
      setActiveTab('general');
    }
  }, [kbLanguage, activeTab]);

  // Voice settings state (loaded from KeyboardPreferences on mount)
  const [englishVoice, setEnglishVoice] = useState<string | undefined>(undefined);
  const [hebrewVoice, setHebrewVoice] = useState<string | undefined>(undefined);

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

  const isKeyboardTab = KEYBOARD_TABS.includes(activeTab);

  const confirmUnsavedChanges = useCallback((onDiscard: () => void) => {
    Alert.alert(
      'Unsaved Changes',
      'You have unsaved keyboard changes. What would you like to do?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onDiscard },
        { text: 'Save', onPress: () => { saveRef.current?.(); onDiscard(); } },
      ]
    );
  }, []);

  const handleTabChange = useCallback((tabId: string) => {
    const leavingKeyboard = KEYBOARD_TABS.includes(activeTab) && !KEYBOARD_TABS.includes(tabId);
    if (leavingKeyboard && isDirty) {
      confirmUnsavedChanges(() => setActiveTab(tabId));
    } else {
      setActiveTab(tabId);
    }
  }, [activeTab, isDirty, confirmUnsavedChanges]);

  const handleGoBack = useCallback(() => {
    if (isDirty) {
      confirmUnsavedChanges(() => navigation.goBack());
    } else {
      navigation.goBack();
    }
  }, [isDirty, confirmUnsavedChanges, navigation]);

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

    // For keyboard tabs, render KeyboardHeader strip + EditorScreen
    return (
      <View style={{ flex: 1 }}>
        <KeyboardHeader
          currentLanguage={kbLanguage}
          onLanguageChange={(lang) => changeLanguageRef.current?.(lang)}
          profileName={profileName}
          onProfilePress={() => showProfilePickerRef.current?.()}
          onSave={() => saveRef.current?.()}
          isDirty={isDirty}
        />
        <EditorLocalizationProvider>
          <EditorScreen
            appContext="issievoice"
            initialLanguage={kbLanguage}
            onClose={() => navigation.goBack()}
            onStateChange={handleEditorStateChange}
            showProfilePickerRef={showProfilePickerRef}
            changeLanguageRef={changeLanguageRef}
            headless
            activeTab={activeTab}
            saveRef={saveRef}
          />
        </EditorLocalizationProvider>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleGoBack}
          activeOpacity={0.7}>
          <MyIcon info={{ name: 'arrow-back', type: 'Ionicons', color: '#FFFFFF', size: 20 }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Issie Voice Settings</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={styles.infoButton}
          onPress={() => {/* TODO: show about */}}
          activeOpacity={0.7}>
          <MyIcon info={{ name: 'information-circle-outline', type: 'Ionicons', color: colors.primary, size: 24 }} />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        {isLandscape ? (
          <View style={styles.landscapeLayout}>
            <SettingsSidebar
              activeTab={activeTab}
              onTabChange={handleTabChange}
              isLandscape={true}
              disabledTabs={disabledTabs}
            />
            <View style={styles.detailArea}>
              {renderContent()}
            </View>
          </View>
        ) : (
          <View style={styles.portraitLayout}>
            <SettingsSidebar
              activeTab={activeTab}
              onTabChange={handleTabChange}
              isLandscape={false}
              disabledTabs={disabledTabs}
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
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
    marginLeft: 8,
  },
  infoButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
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
