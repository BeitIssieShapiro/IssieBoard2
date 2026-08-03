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

const builtConfig = require('../../../../ios/IssieCalc/default_config.json');

const SettingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [profileName, setProfileName] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [configBg, setConfigBg] = useState<string | undefined>(undefined);
  const saveRef = useRef<(() => void) | null>(null);
  const discardRef = useRef<(() => void) | null>(null);
  const showProfilePickerRef = useRef<(() => void) | null>(null);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { strings } = useLocalization();

  const VOICE_EXTRA_TAB = {
    id: 'voice',
    label: strings.settings.tabs.voice,
    iconName: 'volume-high-outline',
    iconType: 'Ionicons' as const,
    iconColor: '#D97706',
  };

  const navigateBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleClose = useCallback(() => {
    if (!isDirty) {
      navigateBack();
      return;
    }
    Alert.alert(
      strings.common.unsavedChanges,
      strings.common.unsavedChangesMessage,
      [
        { text: strings.common.cancel, style: 'cancel' },
        {
          text: strings.common.discard,
          style: 'destructive',
          onPress: () => {
            if (discardRef.current) discardRef.current();
            navigateBack();
          },
        },
        {
          text: strings.common.save,
          onPress: () => {
            if (saveRef.current) saveRef.current();
          },
        },
      ]
    );
  }, [isDirty, navigateBack, strings]);

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
  }, []);

  const renderContent = () => {
    if (activeTab === 'voice') {
      return <CalcVoiceSettingsPanel />;
    }
    return (
      <EditorScreen
        appContext="issiecalc"
        initialLanguage="calc"
        onClose={navigateBack}
        onStateChange={({ profileName: name, isDirty: dirty, backgroundColor }) => {
          setProfileName(name);
          setIsDirty(dirty);
          setConfigBg(backgroundColor);
        }}
        headless
        activeTab={activeTab}
        saveRef={saveRef}
        discardRef={discardRef}
        showProfilePickerRef={showProfilePickerRef}
      />
    );
  };


  return (
    <SafeAreaView style={styles.container}>
      <KeyboardHeader
        currentLanguage="he"
        onLanguageChange={() => {}}
        profileName={profileName}
        onProfilePress={() => showProfilePickerRef.current?.()}
        onSave={() => saveRef.current?.()}
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
});

export default SettingsScreen;
