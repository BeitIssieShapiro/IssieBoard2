/**
 * @format
 */

import { AppRegistry } from 'react-native';
// Use the new AppNavigator which includes both Legacy and Visual Editor screens
import AppNavigator from './src/AppNavigator';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => AppNavigator);
