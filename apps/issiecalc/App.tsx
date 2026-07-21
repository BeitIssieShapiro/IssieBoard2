import React from 'react';
import { Text, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CalcProvider } from './src/context/CalcContext';
import CalcScreen from './src/screens/CalcScreen';

(Text as any).defaultProps = { ...((Text as any).defaultProps || {}), allowFontScaling: false };
(TextInput as any).defaultProps = { ...((TextInput as any).defaultProps || {}), allowFontScaling: false };

const App = () => (
  <SafeAreaProvider>
    <CalcProvider>
      <CalcScreen />
    </CalcProvider>
  </SafeAreaProvider>
);

export default App;
