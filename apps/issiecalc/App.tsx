import React from 'react';
import { Text, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { CalcProvider } from './src/context/CalcContext';
import { LocalizationProvider } from '../../src/localization';
import { LocalizationProvider as VoiceLocalizationProvider } from '../issievoice/src/context/LocalizationContext';
import CalcScreen from './src/screens/CalcScreen';
import SettingsScreen from './src/screens/SettingsScreen';

(Text as any).defaultProps = { ...((Text as any).defaultProps || {}), allowFontScaling: false };
(TextInput as any).defaultProps = { ...((TextInput as any).defaultProps || {}), allowFontScaling: false };

const Stack = createStackNavigator();

const App = () => (
  <SafeAreaProvider>
    <LocalizationProvider>
      <VoiceLocalizationProvider>
        <CalcProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Calc" component={CalcScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </Stack.Navigator>
        </NavigationContainer>
        </CalcProvider>
      </VoiceLocalizationProvider>
    </LocalizationProvider>
  </SafeAreaProvider>
);

export default App;
