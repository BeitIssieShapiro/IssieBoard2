import React from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import * as ScreenSizer from '@bam.tech/react-native-screen-sizer';
import { Alert } from 'react-native';
import MainScreen from './src/screens/MainScreen';
import BrowseScreen from './src/screens/BrowseScreen';
import NewSettingsScreen from './src/screens/NewSettingsScreen';
import {TextProvider} from './src/context/TextContext';
import {TTSProvider} from './src/context/TTSContext';
import {LocalizationProvider} from './src/context/LocalizationContext';
import {NotificationProvider} from './src/context/NotificationContext';
import { initializeFirebase } from '../../src/firebase-config';
import {
  getStrings,
  getDeviceLanguage,
  LocalizationProvider as EditorLocalizationProvider,
} from '../../src/localization';
import { loadLanguage, LANGUAGE_SETTINGS } from '@beitissieshapiro/issie-shared';
import { useIncomingURL } from '../../src/common/linking-hook';
import { importPackage, ImportInfo, newImportInfo, hasImportResult } from '../../src/import-export';
import { ImportInfoDialog } from '../../src/common/import-info-dialog';

// Font scaling is disabled per-element via allowFontScaling={false}, not globally:
// RN's Text is a plain function component and React 19 dropped defaultProps for
// those, so a global shim here would silently do nothing.

ScreenSizer.setup();

const Stack = createStackNavigator();

const App = () => {
  React.useEffect(() => {
    initializeFirebase();
    loadLanguage(LANGUAGE_SETTINGS.default);
  }, []);

  const [importResult, setImportResult] = React.useState<ImportInfo | null>(null);
  const [importKey, setImportKey] = React.useState(0);

  const handleImportURL = React.useCallback(async (url: string) => {
    try {
      const info: ImportInfo = newImportInfo();
      await importPackage(url, info, 'issievoice');
      if (hasImportResult(info)) {
        setImportResult(info);
        // Remount the screens so settings, saved sentences and favorites show what
        // was imported (the typed text lives above the navigator and is kept)
        setImportKey(prev => prev + 1);
      }
    } catch (error) {
      console.warn('Import failed:', error);
      const { importExport } = getStrings(getDeviceLanguage());
      Alert.alert(importExport.importFailed, importExport.invalidFile);
    }
  }, []);

  useIncomingURL(handleImportURL);

  const navigator = (
    <NavigationContainer key={importKey}>
      <Stack.Navigator initialRouteName="Main" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainScreen} />
        <Stack.Screen name="Browse" component={BrowseScreen} />
        <Stack.Screen name="Settings" component={NewSettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );

  return (
    <SafeAreaProvider>
      <LocalizationProvider>
        <NotificationProvider>
          <TTSProvider>
            <TextProvider>
              {__DEV__ ? (
                <ScreenSizer.Wrapper devices={[...ScreenSizer.defaultDevices.all, 'hostDevice']}>
                  {navigator}
                </ScreenSizer.Wrapper>
              ) : navigator}
            </TextProvider>
          </TTSProvider>
        </NotificationProvider>
      </LocalizationProvider>
      {importResult && (
        // The dialog is shared with IssieBoard and uses the editor's strings
        <EditorLocalizationProvider>
          <ImportInfoDialog
            importInfo={importResult}
            appContext="issievoice"
            onClose={() => setImportResult(null)}
          />
        </EditorLocalizationProvider>
      )}
    </SafeAreaProvider>
  );
};

export default App;