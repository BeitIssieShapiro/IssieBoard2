import { AppRegistry } from 'react-native';

// Register IssieBoardNG (
//  app)
import AppNavigator from './src/AppNavigator'
AppRegistry.registerComponent('IssieBoardNG', () => AppNavigator);

// Register IssieVoice (assistive communication app)
import IssieVoice from './apps/issievoice/App';
AppRegistry.registerComponent('IssieVoice', () => IssieVoice);