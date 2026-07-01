import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  Alert,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants';
import { useLocalization } from '../context/LocalizationContext';
import SettingsSidebar from '../components/Settings/SettingsSidebar';
import KeyboardHeader from '../components/Settings/KeyboardHeader';
import VoiceSettingsPanel from '../components/Settings/VoiceSettingsPanel';
import LanguageSettingsPanel, { KbLanguage } from '../components/Settings/LanguageSettingsPanel';
import { EditorScreen } from '../../../../src/screens/EditorScreen';
import { LocalizationProvider as EditorLocalizationProvider, useLocalization as useEditorLocalization } from '../../../../src/localization';
import { getStrings as getEditorStrings } from '../../../../src/localization/strings';
import KeyboardPreferences from '../../../../src/native/KeyboardPreferences';
import { AboutScreen } from '../../../../src/components/AboutScreen';
import { SetupStatusStrip } from '../../../../src/components/SetupStatusStrip';
import { ISSIEBOARD_ABOUT, ISSIEVOICE_ABOUT } from '../../../../src/components/about-content';
import { cardShadow } from '../../../../src/styles/shadows';
import { useKeyboardSetupStatus } from '../../../../src/hooks/useKeyboardSetupStatus';

const KEYBOARD_TABS = ['general', 'keys-groups', 'nikkud', 'features', 'advanced'];

/** Syncs the editor's LocalizationProvider language with the keyboard language */
const EditorLanguageSync: React.FC<{ language: 'en' | 'he' | 'ar'; children: React.ReactNode }> = ({ language, children }) => {
  const { changeLanguage } = useEditorLocalization();
  useEffect(() => {
    changeLanguage(language);
  }, [language, changeLanguage]);
  return <>{children}</>;
};

interface NewSettingsScreenProps {
  navigation?: any;
  route?: any;
  /** 'issievoice' (default) = Voice + Keyboard tabs; 'issieboard' = Keyboard tabs only */
  appContext?: 'issievoice' | 'issieboard';
  /** Initial language (alternative to route.params.initialLanguage) */
  initialLanguage?: 'en' | 'he' | 'ar';
  /** Called when classic/legacy view toggle is requested */
  onSwitchToClassic?: () => void;
  /** Whether to show the classic view button visibly (v1 users only) */
  showClassicButton?: boolean;
  /** Called when secret tap reveals the classic button */
  onRevealClassicButton?: () => void;
}

const NewSettingsScreen: React.FC<NewSettingsScreenProps> = ({ navigation, route, appContext, initialLanguage: initialLangProp, onSwitchToClassic, showClassicButton, onRevealClassicButton }) => {
  const resolvedContext = appContext || route?.params?.appContext || 'issievoice';
  const isKeyboardOnly = resolvedContext === 'issieboard';
  const canGoBack = !!navigation?.goBack;
  const [activeTab, setActiveTab] = useState<string>('general');
  const [showAbout, setShowAbout] = useState(false);
  const { strings: voiceStrings, isRTL: isSettingsRTL, language: uiLanguage } = useLocalization();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  // Keyboard config state
  const [kbLanguage, setKbLanguage] = useState<'en' | 'he' | 'ar'>(
    initialLangProp || route?.params?.initialLanguage || 'he'
  );
  const [profileName, setProfileName] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const showProfilePickerRef = useRef<(() => void) | null>(null);
  const changeLanguageRef = useRef<((lang: 'en' | 'he' | 'ar') => void) | null>(null);
  const saveRef = useRef<(() => void) | null>(null);
  const autoSaveRef = useRef<(() => void) | null>(null);
  const discardRef = useRef<(() => void) | null>(null);

  // Auto-save when app goes to background or is closed
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        autoSaveRef.current?.();
      }
    });
    return () => sub.remove();
  }, []);

  // Keyboard setup status (for Full Access badge — IssieBoard only)
  const setupStatus = useKeyboardSetupStatus(kbLanguage);
  const showFullAccessBadge = isKeyboardOnly && setupStatus.isAdded === true && setupStatus.hasFullAccess !== true;

  const handleFullAccessBadgePress = useCallback(() => {
    const s = getEditorStrings(kbLanguage);
    const message = [
      s.setup.fullAccessStep1,
      s.setup.fullAccessStep2,
      s.setup.fullAccessStep3,
    ].join('\n');
    Alert.alert(s.setup.fullAccessTitle, message);
  }, [kbLanguage]);

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

  // Voice settings state (only for issievoice mode)
  const [englishVoice, setEnglishVoice] = useState<string | undefined>(undefined);
  const [hebrewVoice, setHebrewVoice] = useState<string | undefined>(undefined);
  const [arabicVoice, setArabicVoice] = useState<string | undefined>(undefined);
  const [selectedLanguages, setSelectedLanguages] = useState<KbLanguage[]>(['he', 'en']);

  // Load saved voice settings on mount (only for issievoice)
  useEffect(() => {
    if (isKeyboardOnly) return;
    const loadVoiceSettings = async () => {
      const savedEnVoice = await KeyboardPreferences.getProfile('issievoice_englishVoice');
      if (savedEnVoice) setEnglishVoice(savedEnVoice);
      const savedHeVoice = await KeyboardPreferences.getProfile('issievoice_hebrewVoice');
      if (savedHeVoice) setHebrewVoice(savedHeVoice);
      const savedArVoice = await KeyboardPreferences.getProfile('issievoice_arabicVoice');
      if (savedArVoice) setArabicVoice(savedArVoice);
      const savedLangs = await KeyboardPreferences.getString('issievoice_selectedLanguages');
      if (savedLangs) {
        try {
          const parsed = JSON.parse(savedLangs) as KbLanguage[];
          if (parsed.length > 0) setSelectedLanguages(parsed);
        } catch {}
      }
    };
    loadVoiceSettings();
  }, []);

  const handleVoiceChange = async (language: 'en' | 'he' | 'ar', voiceId: string) => {
    if (language === 'en') {
      setEnglishVoice(voiceId);
      await KeyboardPreferences.setProfile(voiceId, 'issievoice_englishVoice');
    } else if (language === 'he') {
      setHebrewVoice(voiceId);
      await KeyboardPreferences.setProfile(voiceId, 'issievoice_hebrewVoice');
    } else {
      setArabicVoice(voiceId);
      await KeyboardPreferences.setProfile(voiceId, 'issievoice_arabicVoice');
    }
  };

  const handleSelectedLanguagesChange = async (languages: KbLanguage[]) => {
    setSelectedLanguages(languages);
    await KeyboardPreferences.setString('issievoice_selectedLanguages', JSON.stringify(languages));
  };

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
    if (!canGoBack) return;
    if (isDirty) {
      confirmUnsavedChanges(() => navigation.goBack());
    } else {
      navigation.goBack();
    }
  }, [isDirty, confirmUnsavedChanges, navigation, canGoBack]);

  const renderContent = () => {
    if (!isKeyboardOnly && activeTab === 'voice') {
      return (
        <View style={styles.voicePanel}>
          <VoiceSettingsPanel
            englishVoice={englishVoice}
            hebrewVoice={hebrewVoice}
            arabicVoice={arabicVoice}
            onVoiceChange={handleVoiceChange}
          />
        </View>
      );
    }

    if (!isKeyboardOnly && activeTab === 'language') {
      return (
        <View style={styles.voicePanel}>
          <LanguageSettingsPanel
            selectedLanguages={selectedLanguages}
            onSelectedLanguagesChange={handleSelectedLanguagesChange}
          />
        </View>
      );
    }

    // For keyboard tabs, render KeyboardHeader strip + EditorScreen
    const tabDescriptions = voiceStrings.settings.tabs.tabDescriptions;
    const TAB_DESCRIPTIONS: Record<string, string> = {
      'general':     tabDescriptions.general,
      'keys-groups': tabDescriptions.keysGroups,
      'nikkud':      tabDescriptions.nikkud,
      'features':    tabDescriptions.features,
      'advanced':    tabDescriptions.advanced,
    };
    const description = TAB_DESCRIPTIONS[activeTab];

    return (
      <View style={!isKeyboardOnly ? styles.voicePanel : { flex: 1 }}>
        {!isKeyboardOnly && (
          <KeyboardHeader
            currentLanguage={kbLanguage}
            onLanguageChange={(lang) => changeLanguageRef.current?.(lang)}
            profileName={profileName}
            onProfilePress={() => showProfilePickerRef.current?.()}
            onSave={() => saveRef.current?.()}
            onDiscard={() => discardRef.current?.()}
            isDirty={isDirty}
          />
        )}
        <EditorLocalizationProvider>
          <EditorLanguageSync language={uiLanguage}>
            <EditorScreen
              appContext={resolvedContext}
              initialLanguage={kbLanguage}
              onClose={canGoBack ? () => navigation.goBack() : undefined}
              onStateChange={handleEditorStateChange}
              showProfilePickerRef={showProfilePickerRef}
              changeLanguageRef={changeLanguageRef}
              headless
              activeTab={activeTab}
              tabDescription={description}
              saveRef={saveRef}
              autoSaveRef={autoSaveRef}
              discardRef={discardRef}
              selectedLanguages={isKeyboardOnly ? undefined : selectedLanguages}
            />
          </EditorLanguageSync>
        </EditorLocalizationProvider>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Keyboard Header — IssieBoard only: always shown at top level */}
      {isKeyboardOnly && <KeyboardHeader
        currentLanguage={kbLanguage}
        onLanguageChange={(lang) => changeLanguageRef.current?.(lang)}
        profileName={profileName}
        onProfilePress={() => showProfilePickerRef.current?.()}
        onSave={() => saveRef.current?.()}
        onDiscard={() => discardRef.current?.()}
        isDirty={isDirty}
        showFullAccessBadge={showFullAccessBadge}
        onFullAccessBadgePress={handleFullAccessBadgePress}
        onSwitchToClassic={onSwitchToClassic ? () => {
          if (isDirty) {
            confirmUnsavedChanges(onSwitchToClassic!);
          } else {
            onSwitchToClassic!();
          }
        } : undefined}
        showClassicButton={showClassicButton}
        onRevealClassicButton={onRevealClassicButton}
        onAbout={() => setShowAbout(true)}
        canGoBack={canGoBack}
        onGoBack={handleGoBack}
      />}

      {/* Setup status warning — shown right below header when keyboard not added */}
      {isKeyboardOnly && (
        <SetupStatusStrip
          isAdded={setupStatus.isAdded}
          languageName={getEditorStrings(kbLanguage).editor.languages[kbLanguage === 'he' ? 'hebrew' : kbLanguage === 'ar' ? 'arabic' : 'english']}
        />
      )}

      {/* Main Content */}
      <View style={styles.mainContent}>
        {isLandscape ? (
          <View style={[styles.landscapeLayout, isSettingsRTL && { flexDirection: 'row-reverse' }]}>
            <SettingsSidebar
              activeTab={activeTab}
              onTabChange={handleTabChange}
              isLandscape={true}
              disabledTabs={disabledTabs}
              mode={isKeyboardOnly ? 'keyboard' : 'voice'}
              kbLanguage={kbLanguage}
              onAbout={() => setShowAbout(true)}
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
              mode={isKeyboardOnly ? 'keyboard' : 'voice'}
              kbLanguage={kbLanguage}
              onAbout={() => setShowAbout(true)}
            />
            <View style={styles.detailArea}>
              {renderContent()}
            </View>
          </View>
        )}
      </View>
      <AboutScreen
        visible={showAbout}
        appName={isKeyboardOnly ? 'IssieBoard' : 'IssieVoice'}
        onClose={() => setShowAbout(false)}
        paragraphs={isKeyboardOnly ? ISSIEBOARD_ABOUT : ISSIEVOICE_ABOUT}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  voicePanel: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 12,
    ...cardShadow,
    overflow: 'hidden',
  },
});

export default NewSettingsScreen;
