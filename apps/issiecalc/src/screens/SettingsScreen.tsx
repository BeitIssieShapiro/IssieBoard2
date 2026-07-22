import React, { useState, useRef, useCallback } from 'react';
import { View, useWindowDimensions, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EditorScreen } from '../../../../src/screens/EditorScreen';
import SettingsSidebar from '../../../issievoice/src/components/Settings/SettingsSidebar';
import KeyboardHeader from '../../../issievoice/src/components/Settings/KeyboardHeader';

const CALC_TABS = ['general', 'keys-groups', 'features', 'advanced'];

const SettingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [profileName, setProfileName] = useState('Calculator');
  const [isDirty, setIsDirty] = useState(false);
  const saveRef = useRef<(() => void) | null>(null);
  const autoSaveRef = useRef<(() => void) | null>(null);
  const discardRef = useRef<(() => void) | null>(null);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const handleClose = useCallback(async () => {
    if (autoSaveRef.current) {
      await autoSaveRef.current();
    }
    navigation.goBack();
  }, [navigation]);

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
  }, []);

  const renderContent = () => (
    <EditorScreen
      appContext="issiecalc"
      initialLanguage="calc"
      onClose={handleClose}
      onStateChange={({ profileName: name, isDirty: dirty }) => {
        setProfileName(name);
        setIsDirty(dirty);
      }}
      headless
      activeTab={activeTab}
      saveRef={saveRef}
      autoSaveRef={autoSaveRef}
      discardRef={discardRef}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardHeader
        currentLanguage="he"
        onLanguageChange={() => {}}
        profileName={profileName}
        onProfilePress={() => {}}
        onSave={() => saveRef.current?.()}
        onDiscard={() => discardRef.current?.()}
        isDirty={isDirty}
        activeTab={activeTab}
        canGoBack
        onGoBack={handleClose}
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
            />
            <View style={styles.detailArea}>{renderContent()}</View>
          </View>
        )}
      </View>
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
