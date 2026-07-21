import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardPreview, KeyPressEvent } from '../../../../src/components/KeyboardPreview';
import { useCalc } from '../context/CalcContext';

const builtConfig = require('../../../../ios/IssieCalc/default_config.json');

const KB_BG = '#000000';

function formatExpression(expr: string): string {
  return expr.replace(/\*/g, '×').replace(/\//g, '÷');
}

function isLandscape() {
  const { width, height } = Dimensions.get('window');
  return width > height;
}

interface CalcScreenProps {
  navigation?: any;
}

const CalcScreen: React.FC<CalcScreenProps> = ({ navigation }) => {
  const { expression, result, resultMode, appendToExpression, clearAll, backspace, computeResult, toggleSign, keyset, setKeyset } = useCalc();
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(500);
  const [landscape, setLandscape] = useState(isLandscape());

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', () => {
      setLandscape(isLandscape());
    });
    return () => sub?.remove();
  }, []);

  const configJson = useMemo(() => {
    let defaultKeyset: string;
    if (keyset === 'scientific') {
      defaultKeyset = landscape ? 'scientific_landscape' : 'scientific';
    } else {
      defaultKeyset = landscape ? 'basic_landscape' : 'basic';
    }
    return JSON.stringify({ ...builtConfig, defaultKeyset });
  }, [keyset, landscape]);

  const handleKeyPress = (event: KeyPressEvent) => {
    const { value } = event.nativeEvent;
    if (value === '⌫') { backspace(); return; }
    if (value === 'AC') { clearAll(); return; }
    if (value === '=') { computeResult(); return; }
    if (value === '+/-') { toggleSign(); return; }
    if (value) appendToExpression(value);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.segmented}>
          <TouchableOpacity
            style={[styles.segment, keyset === 'basic' && styles.segmentActive]}
            onPress={() => setKeyset('basic')}>
            <Text style={[styles.segmentText, keyset === 'basic' && styles.segmentTextActive]}>Basic</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, keyset === 'scientific' && styles.segmentActive]}
            onPress={() => setKeyset('scientific')}>
            <Text style={[styles.segmentText, keyset === 'scientific' && styles.segmentTextActive]}>Scientific</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.gearButton} onPress={() => navigation?.navigate('Settings')}>
          <Text style={styles.gearIcon}>⚙</Text>
        </TouchableOpacity>
      </View>

      {/* Display */}
      <View style={styles.display}>
        {resultMode ? (
          <>
            <Text style={styles.expression} numberOfLines={1} adjustsFontSizeToFit>
              {formatExpression(expression)}
            </Text>
            <Text style={styles.result} numberOfLines={1} adjustsFontSizeToFit>
              {result}
            </Text>
          </>
        ) : (
          <Text style={styles.result} numberOfLines={1} adjustsFontSizeToFit>
            {formatExpression(expression) || '0'}
          </Text>
        )}
      </View>

      {/* Keyboard */}
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
    backgroundColor: '#000000',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  segmented: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentActive: {
    backgroundColor: '#636366',
  },
  segmentText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '500',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  gearButton: {
    marginLeft: 12,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearIcon: {
    fontSize: 22,
    color: '#8E8E93',
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
