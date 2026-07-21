import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardPreview, KeyPressEvent } from '../../../../src/components/KeyboardPreview';
import { useCalc } from '../context/CalcContext';

const builtConfig = require('../../../../ios/IssieCalc/default_config.json');

const KB_BG = '#000000';

const CalcScreen: React.FC = () => {
  const { expression, result, appendToExpression, clearAll, computeResult, toggleSign } = useCalc();
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(500);

  // Config is pre-built by scripts/build_keyboard_configs.js
  // Force defaultKeyset to 'basic' in case Metro cached an older version of the JSON
  const configJson = useMemo(() => JSON.stringify({ ...builtConfig, defaultKeyset: 'basic' }), []);

  const handleKeyPress = (event: KeyPressEvent) => {
    const { value, type } = event.nativeEvent;

    // keyset-type keys are handled natively; RN gets the event but value is empty
    if (type === 'keyset') return;

    if (value === 'C') {
      clearAll();
      return;
    }
    if (value === '=') {
      computeResult();
      return;
    }
    if (value === '+/-') {
      toggleSign();
      return;
    }
    if (value) {
      appendToExpression(value);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.display}>
        <Text style={styles.expression} numberOfLines={2} adjustsFontSizeToFit>
          {expression || '0'}
        </Text>
        <Text style={styles.result} numberOfLines={1} adjustsFontSizeToFit>
          {result}
        </Text>
      </View>
      <View style={styles.keyboardContainer}>
        <KeyboardPreview
          style={{ height: keyboardHeight, backgroundColor: KB_BG }}
          configJson={configJson}
          hideGlobeButton
          onKeyPress={handleKeyPress}
          onHeightChange={e => setKeyboardHeight(e.nativeEvent.height)}
        />
        <View style={{ height: insets.bottom, backgroundColor: KB_BG }} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  display: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  expression: {
    fontSize: 28,
    color: '#8E8E93',
    marginBottom: 8,
    textAlign: 'left',
    alignSelf: 'stretch',
  },
  result: {
    fontSize: 64,
    fontWeight: '300',
    color: '#FFFFFF',
  },
  keyboardContainer: {
    backgroundColor: KB_BG,
  },
});

export default CalcScreen;
