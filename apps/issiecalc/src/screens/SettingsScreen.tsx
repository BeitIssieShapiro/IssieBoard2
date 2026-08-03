import React, { useState, useRef, useCallback } from 'react';
import { Alert, View, useWindowDimensions, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EditorScreen } from '../../../../src/screens/EditorScreen';
import SettingsSidebar from '../../../issievoice/src/components/Settings/SettingsSidebar';
import KeyboardHeader from '../../../issievoice/src/components/Settings/KeyboardHeader';
import CalcVoiceSettingsPanel from '../components/CalcVoiceSettingsPanel';
import { useLocalization } from '../../../issievoice/src/context/LocalizationContext';
import { AboutScreen } from '../../../../src/components/AboutScreen';
import { ISSIECCALC_ABOUT } from '../../../../src/components/about-content';
import { useCalcTTS } from '../context/CalcTTSContext';
import KeyboardPreferences from '../../../../src/native/KeyboardPreferences';

const SettingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('general');
  const activeTabRef = useRef('general');
  const setActiveTabAndRef = useCallback((tab: string) => {
    activeTabRef.current = tab;
    setActiveTab(tab);
  }, []);
  const [profileName, setProfileName] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [configBg, setConfigBg] = useState<string | undefined>(undefined);
  const saveRef = useRef<(() => void) | null>(null);
  const discardRef = useRef<(() => void) | null>(null);
  const showProfilePickerRef = useRef<(() => void) | null>(null);
  const configPatchRef = useRef<((config: any) => any) | null>(null);
  const profileActivatedRef = useRef<((profileId: string) => void) | null>(null);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { strings } = useLocalization();
  const { getVoiceSettings, loadFromConfig } = useCalcTTS();

  // Keep configPatchRef current so EditorScreen always injects latest voiceSettings on save
  configPatchRef.current = (config: any) => ({ ...config, voiceSettings: getVoiceSettings() });
  profileActivatedRef.current = (profileId: string) => {
    setIsDirty(false);
    KeyboardPreferences.getProfile(`profile_def_${profileId}`).then(defJson => {
      if (defJson) {
        try { loadFromConfig(JSON.parse(defJson).voiceSettings); } catch {}
      } else {
        loadFromConfig(undefined);
      }
    });
  };

  const VOICE_EXTRA_TAB = {
    id: 'voice',
    label: strings.settings.tabs.voice,
    iconName: 'volume-high-outline',
    iconType: 'Ionicons' as const,
    iconColor: '#D97706',
  };

  const navigateBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleClose = useCallback(() => {
    if (!isDirty) { navigateBack(); return; }
    Alert.alert(
      strings.common.unsavedChanges,
      strings.common.unsavedChangesMessage,
      [
        { text: strings.common.cancel, style: 'cancel' },
        {
          text: strings.common.discard,
          style: 'destructive',
          onPress: () => { discardRef.current?.(); navigateBack(); },
        },
        {
          text: strings.common.save,
          onPress: () => saveRef.current?.(),
        },
      ]
    );
  }, [isDirty, navigateBack, strings]);

  const handleTabChange = useCallback((tabId: string) => setActiveTabAndRef(tabId), [setActiveTabAndRef]);

  const handleVoiceSettingsChange = useCallback(() => setIsDirty(true), []);

  // When profile switches, reload voice settings from the new saved config and leave voice tab
  const handleProfileChange = useCallback((profileId: string, _profileName: string, _language: any, _keyboardId: string) => {
    setIsDirty(false);
    KeyboardPreferences.getProfile(`profile_def_${profileId}`).then(defJson => {
      console.log('🔄 handleProfileChange profileId:', profileId, 'defJson:', defJson ? defJson.slice(0, 200) : 'null');
      if (defJson) {
        try {
          const parsed = JSON.parse(defJson);
          console.log('🔄 voiceSettings from def:', JSON.stringify(parsed.voiceSettings));
          loadFromConfig(parsed.voiceSettings);
        } catch {}
      } else {
        loadFromConfig(undefined);
      }
      // Switch tab after loading voice settings so panel re-renders with fresh state
      setActiveTabAndRef('general');
    });
  }, [loadFromConfig, setActiveTabAndRef]);

  const handleSave = useCallback(async (config: any, _styleGroups: any[]) => {
    const voiceSettings = getVoiceSettings();
    const configWithVoice = { ...config, voiceSettings };
    await KeyboardPreferences.setKeyboardConfigForLanguage(JSON.stringify(configWithVoice), 'issiecalc_calc');
    setIsDirty(false);
  }, [getVoiceSettings]);

  const handleHeaderSave = useCallback(() => {
    saveRef.current?.();
  }, []);

  const renderContent = () => (
    <>
      <View style={activeTab === 'voice' ? styles.hidden : { flex: 1 }} pointerEvents={activeTab === 'voice' ? 'none' : 'auto'}>
        <EditorScreen
          appContext="issiecalc"
          initialLanguage="calc"
          onClose={navigateBack}
          onStateChange={({ profileName: name, isDirty: dirty, backgroundColor }) => {
            setProfileName(name);
            if (activeTabRef.current !== 'voice') setIsDirty(dirty);
            setConfigBg(backgroundColor);
          }}
          onProfileChange={handleProfileChange}
          onSave={handleSave}
          headless
          activeTab={activeTab === 'voice' ? 'general' : activeTab}
          saveRef={saveRef}
          discardRef={discardRef}
          configPatchRef={configPatchRef}
          profileActivatedRef={profileActivatedRef}
          showProfilePickerRef={showProfilePickerRef}
        />
      </View>
      {activeTab === 'voice' && <CalcVoiceSettingsPanel onSettingsChange={handleVoiceSettingsChange} />}
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardHeader
        currentLanguage="he"
        onLanguageChange={() => {}}
        profileName={profileName}
        onProfilePress={() => showProfilePickerRef.current?.()}
        onSave={handleHeaderSave}
        onDiscard={() => discardRef.current?.()}
        isDirty={isDirty}
        activeTab={activeTab}
        canGoBack
        onGoBack={handleClose}
        hideLanguageTabs
      />
      <View style={styles.mainContent}>
        {isLandscape ? (
          <View style={styles.landscapeLayout}>
            <SettingsSidebar
              activeTab={activeTab}
              onTabChange={handleTabChange}
              isLandscape
              hiddenTabs={['nikkud', 'features']}
              mode="keyboard"
              kbLanguage="en"
              extraTabs={[VOICE_EXTRA_TAB]}
              onAbout={() => setShowAbout(true)}
            />
            <View style={styles.detailArea}>{renderContent()}</View>
          </View>
        ) : (
          <View style={styles.portraitLayout}>
            <SettingsSidebar
              activeTab={activeTab}
              onTabChange={handleTabChange}
              isLandscape={false}
              hiddenTabs={['nikkud', 'features']}
              mode="keyboard"
              kbLanguage="en"
              extraTabs={[VOICE_EXTRA_TAB]}
              onAbout={() => setShowAbout(true)}
            />
            <View style={styles.detailArea}>{renderContent()}</View>
          </View>
        )}
      </View>
      <AboutScreen
        appName="IssieCalc"
        visible={showAbout}
        onClose={() => setShowAbout(false)}
        paragraphs={ISSIECCALC_ABOUT}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#D4E4F7' },
  mainContent: { flex: 1 },
  landscapeLayout: { flex: 1, flexDirection: 'row' },
  portraitLayout: { flex: 1 },
  detailArea: { flex: 1 },
  hidden: { position: 'absolute', opacity: 0, width: '100%' as any, height: '100%' as any },
});

export default SettingsScreen;
