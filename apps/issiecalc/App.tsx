import React from 'react';
import * as ScreenSizer from '@bam.tech/react-native-screen-sizer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { CalcProvider } from './src/context/CalcContext';
import { CalcTTSProvider } from './src/context/CalcTTSContext';
import { LocalizationProvider } from '../../src/localization';
import { LocalizationProvider as VoiceLocalizationProvider } from '../issievoice/src/context/LocalizationContext';
import CalcScreen from './src/screens/CalcScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { initializeFirebase } from '../../src/firebase-config';

// Font scaling is disabled per-element (see the Text wrapper in CalcScreen), not
// globally: RN's Text is a plain function component and React 19 dropped
// defaultProps for those, so a global shim here would silently do nothing.

ScreenSizer.setup();

const Stack = createStackNavigator();

const App = () => {
  React.useEffect(() => {
    initializeFirebase();
  }, []);

  return (
    <SafeAreaProvider>
      <ScreenSizer.Wrapper devices={[...ScreenSizer.defaultDevices.all, 'hostDevice']}>
        <LocalizationProvider>
          <VoiceLocalizationProvider>
            <CalcProvider>
              <CalcTTSProvider>
                <NavigationContainer>
                  <Stack.Navigator screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="Calc" component={CalcScreen} />
                    <Stack.Screen name="Settings" component={SettingsScreen} />
                  </Stack.Navigator>
                </NavigationContainer>
              </CalcTTSProvider>
            </CalcProvider>
          </VoiceLocalizationProvider>
        </LocalizationProvider>
      </ScreenSizer.Wrapper>
    </SafeAreaProvider>
  );
};

export default App;
