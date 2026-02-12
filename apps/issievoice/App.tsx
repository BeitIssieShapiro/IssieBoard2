import React from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import MainScreen from './src/screens/MainScreen';
import BrowseScreen from './src/screens/BrowseScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import {TextProvider} from './src/context/TextContext';
import {TTSProvider} from './src/context/TTSContext';
import {LocalizationProvider} from './src/context/LocalizationContext';
import {NotificationProvider} from './src/context/NotificationContext';

const Stack = createStackNavigator();

const App = () => {
  return (
    <SafeAreaProvider>
      <LocalizationProvider>
        <NotificationProvider>
          <TTSProvider>
            <TextProvider>
              <NavigationContainer>
                <Stack.Navigator
                  initialRouteName="Main"
                  screenOptions={{
                    headerShown: false,
                  }}>
                  <Stack.Screen name="Main" component={MainScreen} />
                  <Stack.Screen name="Browse" component={BrowseScreen} />
                  <Stack.Screen name="Settings" component={SettingsScreen} />
                </Stack.Navigator>
              </NavigationContainer>
            </TextProvider>
          </TTSProvider>
        </NotificationProvider>
      </LocalizationProvider>
    </SafeAreaProvider>
  );
};

export default App;