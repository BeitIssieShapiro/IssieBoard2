import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { KeyboardPreview, KeyPressEvent } from '../../../../src/components/KeyboardPreview';
import { useCalc } from '../context/CalcContext';
import { dispatch, CalcState } from '../services/calcDispatch';
import { useCalcTTS } from '../context/CalcTTSContext';
import { evaluate } from '../services/Calculator';
import { useLocalization } from '../../../issievoice/src/context/LocalizationContext';
import KeyboardPreferences from '../../../../src/native/KeyboardPreferences';
import { transformConfigForPreview } from '../../../../src/utils/keyboardConfigMerger';

const builtConfig = require('../../../../ios/IssieCalc/default_config.json');

const KB_BG = builtConfig.backgroundColor && builtConfig.backgroundColor !== 'default' ? builtConfig.backgroundColor : '#000000';

const SUPERSCRIPT: Record<string, string> = {
  '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹',
  '-':'⁻','.':'·','+':'⁺',
};
function toSuperscript(s: string): string {
  return s.split('').map(c => SUPERSCRIPT[c] ?? c).join('');
}

function formatExpression(expr: string): string {
  return expr
    .replace(/factorial\(([^)]*)\)/g, '$1!')
    .replace(/x\^2/g, '²')
    .replace(/x\^3/g, '³')
    .replace(/x\^\(([^)]*)\)/g, (_, exp) => exp ? `^${exp}` : '^(')
    .replace(/e\^\(([^)]*)\)/g, (_, exp) => exp ? `e${toSuperscript(exp)}` : 'e^(')
    .replace(/10\^\(([^)]*)\)/g, (_, exp) => exp ? `10${toSuperscript(exp)}` : '10^(')
    .replace(/2\^\(([^)]*)\)/g, (_, exp) => exp ? `2${toSuperscript(exp)}` : '2^(')
    .replace(/1\/\(([^)]*)\)/g, (_, x) => x ? `(1/${x})` : '1/(')
    .replace(/\*/g, '×')
    .replace(/\//g, '÷');
}

function isLandscape() {
  const { width, height } = Dimensions.get('window');
  return width > height;
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
    memory, memoryStore, memoryRecall,
    replaceExpression,
  } = useCalc();
  const currentState: CalcState = {
    expression,
    result,
    resultMode,
    angleMode,
    keyset,
    memory,
  };

  const { readout } = useCalcTTS();
  const { strings } = useLocalization();
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(500);
  const [screenHeight, setScreenHeight] = useState(Dimensions.get('window').height);
  const [landscape, setLandscape] = useState(isLandscape());
  const [liveConfig, setLiveConfig] = useState<any>(builtConfig);

  useFocusEffect(useCallback(() => {
    KeyboardPreferences.getString('keyboardConfig_issiecalc_calc').then(saved => {
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setLiveConfig(parsed);
          // If scientific was disabled and we're on a scientific keyset, switch back to basic
          if (parsed.showScientific === false && (keyset === 'scientific' || keyset === 'scientific_2nd' || keyset === 'scientific_landscape_2nd')) {
            setKeyset('basic');
          }
        } catch {}
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

  const showScientific = liveConfig?.showScientific !== false;
  const isScientific = keyset === 'scientific' || keyset === 'scientific_2nd' || keyset === 'scientific_landscape_2nd';

  const heightRatio = (() => {
    const preset = liveConfig?.heightPreset ?? 'normal';
    if (isScientific) {
      return preset === 'compact' ? 0.65 : preset === 'normal' ? 0.80 : preset === 'tall' ? 0.80 : 0.80;
    }
    return preset === 'compact' ? 0.40 : preset === 'normal' ? 0.50 : preset === 'tall' ? 0.60 : 0.70;
  })();

  const effectiveKbHeight = landscape
    ? keyboardHeight
    : screenHeight * heightRatio;

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
    const transformed = transformConfigForPreview({ ...patched, defaultKeyset });
    return JSON.stringify(transformed);
  }, [keyset, landscape, liveConfig, angleMode]);

  const handleKeyPress = (event: KeyPressEvent) => {
    const { value } = event.nativeEvent;

    // rand is non-deterministic — handle before dispatch
    if (value === 'rand') {
      appendToExpression(String(parseFloat(Math.random().toFixed(9))));
      readout(value, expression, result);
      return;
    }

    // [2ND] in landscape maps to landscape_2nd variant — override keyset after dispatch
    const newState = dispatch(currentState, value);

    // Apply expression/result state
    if (value === '=') {
      computeResult();
    } else if (value === 'AC') {
      clearAll();
    } else if (!newState.resultMode && currentState.resultMode) {
      // Exited result mode (backspace, +/-, function key, digit, operator)
      replaceExpression(newState.expression);
    } else if (newState.expression !== currentState.expression) {
      replaceExpression(newState.expression);
    }

    // Keyset — [2ND] in landscape uses landscape variant
    if (value === '[2ND]') {
      setKeyset(landscape ? 'scientific_landscape_2nd' : 'scientific_2nd');
    } else if (newState.keyset !== currentState.keyset) {
      setKeyset(newState.keyset);
    }

    // Angle mode
    if (newState.angleMode !== currentState.angleMode) {
      toggleAngleMode();
    }

    // Memory
    if (value === 'mr') {
      memoryRecall();
      readout(value, newState.expression, newState.result);
      return;
    }
    if (newState.memory !== currentState.memory) {
      memoryStore();
    }

    // Readout
    const readoutExpr = value === '=' ? expression : newState.expression;
    const readoutRes = value === '='
      ? (evaluate(expression, angleMode, keyset === 'basic' ? 'basic' : 'scientific') || 'Error')
      : newState.result;
    readout(value, readoutExpr, readoutRes, newState.angleMode);
  };

  const screenBg = (liveConfig?.backgroundColor && liveConfig.backgroundColor !== 'default')
    ? liveConfig.backgroundColor
    : KB_BG;

  // Derive display text color: calcDisplayColor > luminance-based contrast
  const displayTextColor = (() => {
    if (liveConfig?.calcDisplayColor) return liveConfig.calcDisplayColor;
    const hex = screenBg.replace('#', '');
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      return (0.299 * r + 0.587 * g + 0.114 * b) > 0.5 ? '#000000' : '#FFFFFF';
    }
    return '#FFFFFF';
  })();
  const dimTextColor = displayTextColor === '#000000' ? '#555555' : '#8E8E93';
  const fadedTextStyle = { color: displayTextColor, opacity: 0.6 } as const;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: screenBg }]} edges={['top', 'left', 'right']}>
      {/* Top bar */}
      <View style={[styles.topBar, { backgroundColor: screenBg }]}>
        {showScientific && (
          <View style={styles.segmented}>
            <TouchableOpacity
              style={[styles.segment, keyset === 'basic' && styles.segmentActive]}
              onPress={() => setKeyset('basic')}>
              <Text style={[styles.segmentText, keyset === 'basic' && styles.segmentTextActive, { color: dimTextColor }, keyset === 'basic' && { color: displayTextColor }]}>{strings.settings.calcBasic}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segment, (keyset === 'scientific' || keyset === 'scientific_landscape_2nd' || keyset === 'scientific_2nd') && styles.segmentActive]}
              onPress={() => setKeyset('scientific')}>
              <Text style={[styles.segmentText, (keyset === 'scientific' || keyset === 'scientific_landscape_2nd' || keyset === 'scientific_2nd') && styles.segmentTextActive, { color: dimTextColor }, (keyset === 'scientific' || keyset === 'scientific_landscape_2nd' || keyset === 'scientific_2nd') && { color: displayTextColor }]}>{strings.settings.calcScientific}</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity style={styles.gearButton} onPress={() => navigation?.navigate('Settings')}>
          <Text style={[styles.gearIcon, { color: dimTextColor }]}>⚙</Text>
        </TouchableOpacity>
      </View>

      {/* Display */}
      <View style={[styles.display, { backgroundColor: screenBg }]}>
        <View style={styles.displayInner}>
          <View style={[styles.expressionRow, !resultMode && { opacity: 0 }]}>
            {(keyset === 'scientific' || keyset === 'scientific_landscape_2nd' || keyset === 'scientific_2nd') && (
              <Text style={[styles.angleIndicator, fadedTextStyle]}>{angleMode === 'rad' ? 'Rad' : 'Deg'}</Text>
            )}
            <Text style={[styles.expression, fadedTextStyle]} numberOfLines={1} adjustsFontSizeToFit>
              {formatExpression(expression)}
            </Text>
          </View>
          <Text style={[styles.result, { color: displayTextColor }]} numberOfLines={1}>
            {resultMode
              ? (result === 'NUMBER_TOO_BIG' ? strings.settings.numberTooBig : result)
              : (formatExpression(expression) || '0')}
          </Text>
        </View>
      </View>

      {/* Keyboard */}
      <View style={styles.keyboardContainer}>
        <KeyboardPreview
          style={{ height: effectiveKbHeight, backgroundColor: screenBg }}
          configJson={configJson}
          hideGlobeButton
          targetHeight={landscape ? undefined : effectiveKbHeight}
          onKeyPress={handleKeyPress}
          onHeightChange={e => setKeyboardHeight(e.nativeEvent.height)}
        />
        <View style={{ height: insets.bottom, backgroundColor: screenBg }} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: KB_BG },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
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
  gearButton: { marginLeft: 'auto' as any, width: 54, height: 54, alignItems: 'center', justifyContent: 'center' },
  gearIcon: { fontSize: 33, color: '#8E8E93' },
  display: {
    flex: 1, justifyContent: 'flex-end', alignItems: 'flex-end',
    paddingHorizontal: 24, paddingBottom: 16,
  },
  displayInner: {
    alignSelf: 'stretch',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  expression: { fontSize: 28, color: '#8E8E93', marginBottom: 8, textAlign: 'left', alignSelf: 'stretch' },
  result: { fontSize: 48, fontWeight: '300', color: '#FFFFFF', textAlign: 'right', alignSelf: 'stretch' },
  expressionRow: { flexDirection: 'row', alignItems: 'flex-end', alignSelf: 'stretch' },
  angleIndicator: { fontSize: 16, color: '#8E8E93', marginRight: 8, paddingBottom: 4 },
  keyboardContainer: { backgroundColor: KB_BG },
});

export default CalcScreen;
