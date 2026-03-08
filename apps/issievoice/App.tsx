import React from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import * as ScreenSizer from '@bam.tech/react-native-screen-sizer';
import MainScreen from './src/screens/MainScreen';
import BrowseScreen from './src/screens/BrowseScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import {EditorScreen} from '../../src/screens/EditorScreen';
import {TextProvider} from './src/context/TextContext';
import {TTSProvider} from './src/context/TTSContext';
import {LocalizationProvider} from './src/context/LocalizationContext';
import {NotificationProvider} from './src/context/NotificationContext';

ScreenSizer.setup();

const Stack = createStackNavigator();

const App = () => {
  return (
    <SafeAreaProvider>
      <LocalizationProvider>
        <NotificationProvider>
          <TTSProvider>
            <TextProvider>
              {__DEV__ ? (
                <ScreenSizer.Wrapper
                  devices={[
                    ...ScreenSizer.defaultDevices.all,
                    'hostDevice',
                  ]}
                >
                  <NavigationContainer>
                    <Stack.Navigator
                      initialRouteName="Main"
                      screenOptions={{
                        headerShown: false,
                      }}>
                      <Stack.Screen name="Main" component={MainScreen} />
                      <Stack.Screen name="Browse" component={BrowseScreen} />
                      <Stack.Screen name="Settings" component={SettingsScreen} />
                      <Stack.Screen name="KeyboardSettings">
                        {(props: any) => (
                          <EditorScreen
                            {...props}
                            appContext="issievoice"
                            initialLanguage={props.route.params?.initialLanguage}
                            onClose={() => props.navigation.goBack()}
                          />
                        )}
                      </Stack.Screen>
                    </Stack.Navigator>
                  </NavigationContainer>
                </ScreenSizer.Wrapper>
              ) : (
                <NavigationContainer>
                  <Stack.Navigator
                    initialRouteName="Main"
                    screenOptions={{
                      headerShown: false,
                    }}>
                    <Stack.Screen name="Main" component={MainScreen} />
                    <Stack.Screen name="Browse" component={BrowseScreen} />
                    <Stack.Screen name="Settings" component={SettingsScreen} />
                    <Stack.Screen name="KeyboardSettings">
                      {(props) => (
                        <EditorScreen
                          {...props}
                          appContext="issievoice"
                          initialLanguage={props.route.params?.initialLanguage}
                          onClose={() => props.navigation.goBack()}
                        />
                      )}
                    </Stack.Screen>
                  </Stack.Navigator>
                </NavigationContainer>
              )}
            </TextProvider>
          </TTSProvider>
        </NotificationProvider>
      </LocalizationProvider>
    </SafeAreaProvider>
  );
};

export default App;