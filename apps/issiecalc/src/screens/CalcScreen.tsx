import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { KeyboardPreview, KeyPressEvent } from '../../../../src/components/KeyboardPreview';
import { useCalc } from '../context/CalcContext';
import { useCalcTTS } from '../context/CalcTTSContext';
import { evaluate } from '../services/Calculator';
import KeyboardPreferences from '../../../../src/native/KeyboardPreferences';

const builtConfig = require('../../../../ios/IssieCalc/default_config.json');

const KB_BG = '#000000';

function formatExpression(expr: string): string {
  return expr.replace(/\*/g, '×').replace(/\//g, '÷');
}

function isLandscape() {
  const { width, height } = Dimensions.get('window');
  return width > height;
}

const FUNCTION_KEYS = new Set([
  'sin(', 'cos(', 'tan(', 'asin(', 'acos(', 'atan(',
  'sinh(', 'cosh(', 'tanh(', 'asinh(', 'acosh(', 'atanh(',
  'ln(', 'log(', 'log2(', 'logy(', '2root(', '3root(', 'yroot(',
  'factorial(', 'sqrt(',
]);

const OPERATORS_RE = /^[+\-*/^%]$/;
const FUNCTIONS_RE = /^(sin\(|cos\(|tan\(|asin\(|acos\(|atan\(|sinh\(|cosh\(|tanh\(|asinh\(|acosh\(|atanh\(|sqrt\(|ln\(|log\(|log2\(|logy\(|2root\(|3root\(|yroot\(|factorial\(|x\^2|x\^3|x\^\(|\^\(|2\^\(|1\/\(|\(|\)|pi|e)$/;

function isOpOrFn(val: string): boolean {
  return OPERATORS_RE.test(val) || FUNCTIONS_RE.test(val);
}

// Extract trailing operand: last balanced (...) group or last number/constant.
// Returns [before, operand] or null if nothing to wrap.
function extractTrailingOperand(expr: string): [string, string] | null {
  if (!expr) return null;
  // Try trailing balanced paren group: ...(...) at end
  if (expr.endsWith(')')) {
    let depth = 0;
    for (let i = expr.length - 1; i >= 0; i--) {
      if (expr[i] === ')') depth++;
      else if (expr[i] === '(') {
        depth--;
        if (depth === 0) {
          return [expr.slice(0, i), expr.slice(i)];
        }
      }
    }
    return null;
  }
  // Try trailing number (digits, dot, E notation, leading minus only if whole expr is negative)
  const numMatch = expr.match(/(-?\d+\.?\d*(?:[eE][+-]?\d+)?)$/);
  if (numMatch) {
    const num = numMatch[1];
    const before = expr.slice(0, expr.length - num.length);
    // Only allow leading minus if it's truly a negative number (before is empty or ends with operator)
    if (num.startsWith('-') && before.length > 0 && !/[+\-*/(^]$/.test(before)) {
      // The minus belongs to the operator, not the number
      return [expr.slice(0, expr.length - num.length + 1), num.slice(1)];
    }
    return [before, num];
  }
  return null;
}

function patchAngleToggleCaption(config: any, caption: string): any {
  return {
    ...config,
    keysets: config.keysets.map((ks: any) => ({
      ...ks,
      rows: ks.rows.map((row: any) => ({
        ...row,
        keys: row.keys.map((key: any) =>
          key.value === '[ANGLE_TOGGLE]' ? { ...key, caption } : key
        ),
      })),
    })),
  };
}

interface CalcScreenProps {
  navigation?: any;
}

const CalcScreen: React.FC<CalcScreenProps> = ({ navigation }) => {
  const {
    expression, result, resultMode,
    appendToExpression, clearAll, backspace, computeResult, toggleSign,
    keyset, setKeyset,
    angleMode, toggleAngleMode,
    memoryStore, memoryRecall,
    replaceExpression,
  } = useCalc();
  const { readout } = useCalcTTS();
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(500);
  const [screenHeight, setScreenHeight] = useState(Dimensions.get('window').height);
  const [landscape, setLandscape] = useState(isLandscape());
  const [liveConfig, setLiveConfig] = useState<any>(builtConfig);

  useFocusEffect(useCallback(() => {
    KeyboardPreferences.getString('keyboardConfig_issiecalc_calc').then(saved => {
      if (saved) {
        try { setLiveConfig(JSON.parse(saved)); } catch {}
      } else {
        setLiveConfig(builtConfig);
      }
    });
  }, []));

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setLandscape(window.width > window.height);
      setScreenHeight(window.height);
    });
    return () => sub?.remove();
  }, []);

  const isScientific = keyset === 'scientific' || keyset === 'scientific_2nd' || keyset === 'scientific_landscape_2nd';
  const effectiveKbHeight = landscape
    ? keyboardHeight
    : screenHeight * (isScientific ? 0.75 : 0.50);

  const configJson = useMemo(() => {
    let defaultKeyset: string;
    if (keyset === 'scientific_landscape_2nd') {
      defaultKeyset = 'scientific_landscape_2nd';
    } else if (keyset === 'scientific_2nd') {
      defaultKeyset = 'scientific_2nd';
    } else if (keyset === 'scientific') {
      defaultKeyset = landscape ? 'scientific_landscape' : 'scientific';
    } else {
      defaultKeyset = landscape ? 'basic_landscape' : 'basic';
    }

    const angleCaption = angleMode === 'rad' ? 'Rad' : 'Deg';
    const patched = patchAngleToggleCaption(liveConfig, angleCaption);
    return JSON.stringify({ ...patched, defaultKeyset, heightPreset: 'x-tall', heightPreset_large: 'x-tall' });
  }, [keyset, landscape, liveConfig, angleMode]);

  const handleKeyPress = (event: KeyPressEvent) => {
    const { value } = event.nativeEvent;
    if (value === '⌫') { backspace(); readout(value, expression, result); return; }
    if (value === 'AC') { clearAll(); readout(value, expression, result); return; }
    if (value === '=') {
      computeResult();
      const res = evaluate(expression, angleMode);
      const finalRes = res === '' ? 'Error' : res;
      readout('=', expression, finalRes);
      return;
    }
    if (value === '+/-') { toggleSign(); readout(value, expression, result); return; }
    if (value === '[2ND]') { setKeyset(landscape ? 'scientific_landscape_2nd' : 'scientific_2nd'); readout(value, expression, result); return; }
    if (value === '[2ND_OFF]') { setKeyset('scientific'); readout(value, expression, result); return; }
    if (value === '[ANGLE_TOGGLE]') { toggleAngleMode(); readout(value, expression, result); return; }
    if (value === 'ms') { memoryStore(); readout(value, expression, result); return; }
    if (value === 'mr') { memoryRecall(); readout(value, expression, result); return; }
    if (value === 'rand') { appendToExpression(String(parseFloat(Math.random().toFixed(9)))); readout(value, expression, result); return; }
    if (value && FUNCTION_KEYS.has(value)) {
      const parts = extractTrailingOperand(expression);
      let newExpr: string;
      if (parts) {
        const [before, operand] = parts;
        newExpr = `${before}${value}${operand})`;
        replaceExpression(newExpr);
      } else {
        newExpr = expression + value;
        appendToExpression(value);
      }
      readout(value, newExpr, result);
      return;
    }
    if (value) {
      const newExpr = resultMode ? (isOpOrFn(value) ? result + value : value) : expression + value;
      appendToExpression(value);
      readout(value, newExpr, result);
    }
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
            style={[styles.segment, (keyset === 'scientific' || keyset === 'scientific_landscape_2nd' || keyset === 'scientific_2nd') && styles.segmentActive]}
            onPress={() => setKeyset('scientific')}>
            <Text style={[styles.segmentText, (keyset === 'scientific' || keyset === 'scientific_landscape_2nd' || keyset === 'scientific_2nd') && styles.segmentTextActive]}>Scientific</Text>
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
            <View style={styles.expressionRow}>
              {(keyset === 'scientific' || keyset === 'scientific_landscape_2nd' || keyset === 'scientific_2nd') && (
                <Text style={styles.angleIndicator}>{angleMode === 'rad' ? 'Rad' : 'Deg'}</Text>
              )}
              <Text style={styles.expression} numberOfLines={1} adjustsFontSizeToFit>
                {formatExpression(expression)}
              </Text>
            </View>
            <Text style={styles.result} numberOfLines={1} adjustsFontSizeToFit>
              {result}
            </Text>
          </>
        ) : (
          <View style={styles.expressionRow}>
            {(keyset === 'scientific' || keyset === 'scientific_landscape_2nd') && (
              <Text style={styles.angleIndicator}>{angleMode === 'rad' ? 'Rad' : 'Deg'}</Text>
            )}
            <Text style={styles.result} numberOfLines={1} adjustsFontSizeToFit>
              {formatExpression(expression) || '0'}
            </Text>
          </View>
        )}
      </View>

      {/* Keyboard */}
      <View style={styles.keyboardContainer}>
        <KeyboardPreview
          style={{ height: effectiveKbHeight, backgroundColor: KB_BG }}
          configJson={configJson}
          hideGlobeButton
          targetHeight={landscape ? undefined : effectiveKbHeight}
          onKeyPress={handleKeyPress}
          onHeightChange={e => setKeyboardHeight(e.nativeEvent.height)}
        />
        <View style={{ height: insets.bottom, backgroundColor: KB_BG }} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },
  segmented: {
    flex: 1, flexDirection: 'row',
    backgroundColor: '#1C1C1E', borderRadius: 8, padding: 2,
  },
  segment: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 6 },
  segmentActive: { backgroundColor: '#636366' },
  segmentText: { color: '#8E8E93', fontSize: 14, fontWeight: '500' },
  segmentTextActive: { color: '#FFFFFF' },
  gearButton: { marginLeft: 12, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  gearIcon: { fontSize: 22, color: '#8E8E93' },
  display: {
    flex: 1, justifyContent: 'flex-end', alignItems: 'flex-end',
    paddingHorizontal: 24, paddingBottom: 16,
  },
  expression: { fontSize: 28, color: '#8E8E93', marginBottom: 8, textAlign: 'left', alignSelf: 'stretch' },
  result: { fontSize: 64, fontWeight: '300', color: '#FFFFFF', flex: 1, textAlign: 'right' },
  expressionRow: { flexDirection: 'row', alignItems: 'flex-end', alignSelf: 'stretch' },
  angleIndicator: { fontSize: 16, color: '#8E8E93', marginRight: 8, paddingBottom: 4 },
  keyboardContainer: { backgroundColor: KB_BG },
});

export default CalcScreen;
