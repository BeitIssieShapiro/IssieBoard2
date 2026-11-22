import React from 'react';
import { Alert } from 'react-native';
import * as ScreenSizer from '@bam.tech/react-native-screen-sizer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { CalcProvider } from './src/context/CalcContext';
import { CalcTTSProvider } from './src/context/CalcTTSContext';
import { LocalizationProvider, getStrings, getDeviceLanguage } from '../../src/localization';
import { LocalizationProvider as VoiceLocalizationProvider } from '../issievoice/src/context/LocalizationContext';
import CalcScreen from './src/screens/CalcScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { initializeFirebase } from '../../src/firebase-config';
import { loadLanguage, LANGUAGE_SETTINGS } from '@beitissieshapiro/issie-shared';
import { useIncomingURL } from '../../src/common/linking-hook';
import { importPackage, ImportInfo, newImportInfo, hasImportResult } from '../../src/import-export';
import { ImportInfoDialog } from '../../src/common/import-info-dialog';

// Font scaling is disabled per-element (see the Text wrapper in CalcScreen), not
// globally: RN's Text is a plain function component and React 19 dropped
// defaultProps for those, so a global shim here would silently do nothing.

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
      await importPackage(url, info, 'issiecalc');
      if (hasImportResult(info)) {
        setImportResult(info);
        // Remount the screens so the settings' calculator list includes the import
        setImportKey(prev => prev + 1);
      }
    } catch (error) {
      console.warn('Import failed:', error);
      const { importExport } = getStrings(getDeviceLanguage());
      Alert.alert(importExport.importFailed, importExport.invalidFile);
    }
  }, []);

  useIncomingURL(handleImportURL);

  return (
    <SafeAreaProvider>
      <ScreenSizer.Wrapper devices={[...ScreenSizer.defaultDevices.all, 'hostDevice']}>
        <LocalizationProvider>
          <VoiceLocalizationProvider>
            <CalcProvider>
              <CalcTTSProvider>
                <NavigationContainer key={importKey}>
                  <Stack.Navigator screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="Calc" component={CalcScreen} />
                    <Stack.Screen name="Settings" component={SettingsScreen} />
                  </Stack.Navigator>
                </NavigationContainer>
              </CalcTTSProvider>
            </CalcProvider>
          </VoiceLocalizationProvider>
          {importResult && (
            <ImportInfoDialog
              importInfo={importResult}
              appContext="issiecalc"
              onClose={() => setImportResult(null)}
            />
          )}
        </LocalizationProvider>
      </ScreenSizer.Wrapper>
    </SafeAreaProvider>
  );
};

export default App;
