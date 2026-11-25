import { AppRegistry, LogBox, Platform, Settings } from 'react-native';

// e2e tests (Detox passes launch arguments as user defaults on iOS): no warning banner over the UI
if (__DEV__ && Platform.OS === 'ios' && Settings.get('e2e')) {
  LogBox.ignoreAllLogs();
}

// Register IssieBoardNG (
//  app)
import AppNavigator from './src/AppNavigator'
AppRegistry.registerComponent('IssieBoardNG', () => AppNavigator);

// Register IssieVoice (assistive communication app)
import IssieVoice from './apps/issievoice/App';
AppRegistry.registerComponent('IssieVoice', () => IssieVoice);

// Register IssieCalc (calculator app)
import IssieCalc from './apps/issiecalc/App';
AppRegistry.registerComponent('IssieCalc', () => IssieCalc);