import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { KeyboardPreview, KeyPressEvent } from '../../../../src/components/KeyboardPreview';
import { useCalc } from '../context/CalcContext';
import { dispatch, CalcState, finalizeTemplate, readoutArgs } from '../services/calcDispatch';
import { useCalcTTS, getSubMap, speakableNumber, formatResult } from '../context/CalcTTSContext';
import { speakExpression as speakExpressionText } from '../services/speakExpression';
import { matchTemplateCall } from '../services/templateCall';
import { formatExpression } from '../services/formatExpression';
import TTS from '../../../issievoice/src/services/TextToSpeech';
import { countUnclosedParens } from '../services/Calculator';
import { useLocalization } from '../../../issievoice/src/context/LocalizationContext';
import KeyboardPreferences from '../../../../src/native/KeyboardPreferences';
import { transformConfigForPreview } from '../../../../src/utils/keyboardConfigMerger';
import {
  resolveCalcDisplayBackground,
  resolveCalcDisplayTextColor,
} from '../../../../src/utils/previewBackground';
import { MyIcon } from '@beitissieshapiro/issie-shared/dist/icons';
import { SPEAK_ICON_NAME, SPEAK_ICON_COLOR } from '../speakIcon';

const builtConfig = require('../../../../ios/IssieCalc/default_config.json');

const KB_BG = builtConfig.backgroundColor && builtConfig.backgroundColor !== 'default' ? builtConfig.backgroundColor : '#000000';

function isLandscape() {
  const { width, height } = Dimensions.get('window');
  return width > height;
}

const HAS_TEMPLATE_FN = /yroot\(|logy\(|xpow\(|ypow\(/;

// Template keys that need an operand already on screen, and warn without one.
// 10ˣ/2ˣ/eˣ are included because the operand becomes their exponent — with
// nothing typed there is no exponent to raise the key's base to.
const TEMPLATE_KEYS_NEEDING_X = new Set(['yroot(', 'logy(', 'x^(', 'y^(', '10^(', '2^(', 'e^(']);

/**
 * The config's font weight as a React Native weight, so the expression/result
 * text follows the general-tab setting the same way its font size does.
 * The names match the native renderer's mapping (KeyboardRenderer.swift), which
 * applies the same setting to the keys — including weights the settings panel
 * does not offer but built-in profiles use (e.g. 'black').
 */
type RNFontWeight = '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';

function resolveDisplayFontWeight(weight: string | null | undefined): RNFontWeight {
  switch ((weight ?? '').toLowerCase()) {
    case 'ultralight': return '100';
    case 'thin': return '200';
    case 'light': return '300';
    case 'normal':
    case 'regular': return '400';
    case 'medium': return '500';
    case 'semibold': return '600';
    case 'bold': return '700';
    case 'heavy': return '800';
    case 'black': return '900';
    // The display has always rendered light; keep that when nothing is set.
    default: return '300';
  }
}

type TemplateConfig = {
  activeRe: RegExp;
  /** Function name as it appears in the expression, e.g. "xpow(". */
  fn: string;
  render: (x: string, y: string, cursor: React.ReactNode, fontSize: number, color: string, fontWeight: RNFontWeight) => React.ReactNode;
};

const TEMPLATE_CONFIGS: TemplateConfig[] = [
  {
    activeRe: /^(.*)yroot\(([^,]+),([^\x00]*)\x00\)(.*)$/,
    fn: 'yroot(',
    render: (x, y, cursor, fontSize, color, fontWeight) => {
      const sf = Math.floor(fontSize * 0.6);
      return (
        <>
          <Text style={{ fontSize: sf, lineHeight: sf * 1.1, color, fontWeight, textAlignVertical: 'top' }}>{y}</Text>
          {cursor}
          <Text style={{ fontSize, color, fontWeight, textAlignVertical: 'bottom' }}>{'√'}{formatExpression(x)}</Text>
        </>
      );
    },
  },
  {
    activeRe: /^(.*)logy\(([^,]+),([^\x00]*)\x00\)(.*)$/,
    fn: 'logy(',
    render: (x, y, cursor, fontSize, color, fontWeight) => {
      const sf = Math.floor(fontSize * 0.6);
      // A logarithm's base is a subscript. The row aligns its children to the
      // top (for the raised indices the other templates need), so the base is
      // pushed back down — otherwise log₇ renders as log⁷, which reads as a
      // power instead. Past the baseline (fontSize - sf) by a further quarter
      // of its own size, so it clearly hangs below the "log" rather than
      // sitting level with it.
      const dropToBaseline = fontSize - sf + Math.round(sf * 0.25);
      return (
        <>
          <Text style={{ fontSize, color, fontWeight, textAlignVertical: 'bottom' }}>{'log'}</Text>
          {/* Base and its cursor drop together, so the caret tracks the digits
              being typed rather than floating where a superscript would sit. */}
          <View style={{ flexDirection: 'row', marginTop: dropToBaseline }}>
            <Text style={{ fontSize: sf, lineHeight: sf * 1.1, color, fontWeight }}>{y}</Text>
            {cursor}
          </View>
          <Text style={{ fontSize, color, fontWeight, textAlignVertical: 'bottom' }}>{'('}{formatExpression(x)}{')'}</Text>
        </>
      );
    },
  },
  {
    activeRe: /^(.*)xpow\(([^,]+),([^\x00]*)\x00\)(.*)$/,
    fn: 'xpow(',
    render: (x, y, cursor, fontSize, color, fontWeight) => {
      const sf = Math.floor(fontSize * 0.6);
      return (
        <>
          <Text style={{ fontSize, color, fontWeight, textAlignVertical: 'bottom' }}>{formatExpression(x)}</Text>
          <Text style={{ fontSize: sf, lineHeight: sf * 1.1, color, fontWeight, textAlignVertical: 'top' }}>{y}</Text>
          {cursor}
        </>
      );
    },
  },
  {
    activeRe: /^(.*)ypow\(([^,]+),([^\x00]*)\x00\)(.*)$/,
    fn: 'ypow(',
    // yˣ: the number typed first is the exponent, the one typed next is the
    // base, so the arguments render in the opposite order to xpow(.
    render: (x, y, cursor, fontSize, color, fontWeight) => {
      const sf = Math.floor(fontSize * 0.6);
      return (
        <>
          <Text style={{ fontSize, color, fontWeight, textAlignVertical: 'bottom' }}>{formatExpression(y)}</Text>
          <Text style={{ fontSize: sf, lineHeight: sf * 1.1, color, fontWeight, textAlignVertical: 'top' }}>{formatExpression(x)}</Text>
          {cursor}
        </>
      );
    },
  },
];

function renderTemplateExpression(
  expression: string,
  displayTextColor: string,
  dimColor: string,
  showCursor: boolean = true,
  fontSize: number = 48,
  fontWeight: RNFontWeight = '300'
): React.ReactNode {
  for (const cfg of TEMPLATE_CONFIGS) {
    // While the slot is being filled the marker bounds it, so a regex is safe;
    // a finished call needs paren counting (see matchTemplateCall).
    const m = showCursor
      ? expression.match(cfg.activeRe)?.slice(1)
      : matchTemplateCall(expression, cfg.fn);
    if (m) {
      const [before, x, y, after] = m;
      const yOpenParens = y.split('').reduce((d, c) => c === '(' ? d+1 : c === ')' ? d-1 : d, 0);
      const yHasParens = y.includes('(');
      // Hide cursor only when Y has parens and they are all closed
      const cursor = showCursor && !(yHasParens && yOpenParens === 0)
        ? <Text style={{ fontSize: Math.floor(fontSize * 0.6), color: dimColor, fontWeight, textAlignVertical: 'top' }}>_</Text>
        : null;
      return (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', alignSelf: 'flex-end' }}>
          {before ? <Text style={{ color: displayTextColor, fontSize, fontWeight, textAlignVertical: 'bottom' }}>{formatExpression(before)}</Text> : null}
          {cfg.render(x, y, cursor, fontSize, displayTextColor, fontWeight)}
          {after ? <Text style={{ color: displayTextColor, fontSize, fontWeight, textAlignVertical: 'bottom' }}>{formatExpression(after)}</Text> : null}
        </View>
      );
    }
    // Also try finalized form when showCursor=true (expression row after =)
    if (!showCursor) continue;
    const mf = matchTemplateCall(expression, cfg.fn);
    if (mf) {
      const [before, x, y, after] = mf;
      return (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', alignSelf: 'flex-end' }}>
          {before ? <Text style={{ color: displayTextColor, fontSize, fontWeight, textAlignVertical: 'bottom' }}>{formatExpression(before)}</Text> : null}
          {cfg.render(x, y, null, fontSize, displayTextColor, fontWeight)}
          {after ? <Text style={{ color: displayTextColor, fontSize, fontWeight, textAlignVertical: 'bottom' }}>{formatExpression(after)}</Text> : null}
        </View>
      );
    }
  }
  return <Text style={{ color: displayTextColor, fontSize, fontWeight }}>{formatExpression(expression) || '0'}</Text>;
}

function patchAngleToggleCaption(config: any, caption: string): any {
  if (!config?.keysets) return config;
  return {
    ...config,
    keysets: config.keysets.map((ks: any) => ({
      ...ks,
      rows: ks.rows.map((row: any) => ({
        ...row,
        keys: row.keys.map((key: any) => {
          if (key.value === '[ANGLE_TOGGLE]') return { ...key, caption };
          if (key.value === '[2ND_OFF]') return { ...key, caption: '1st' };
          return key;
        }),
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
    templateMode,
  } = useCalc();
  const currentState: CalcState = {
    expression, result, resultMode, angleMode, keyset, memory, templateMode,
  };

  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastOpacity.setValue(1);
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastOpacity, { toValue: 0, duration: 600, useNativeDriver: true }).start();
    }, 1800);
  }, [toastOpacity]);

  const [toastMessage, setToastMessage] = useState('');
  const showToastMsg = useCallback((msg: string) => {
    setToastMessage(msg);
    showToast(msg);
  }, [showToast]);
  const { readout, readoutMode, language, decimalDigits, mathLevel, loadFromConfig } = useCalcTTS();
  const speakExpression = useCallback(
    (expr: string): string => speakExpressionText(expr, language, mathLevel ?? 'standard'),
    [language, mathLevel]
  );

  const speakDirect = useCallback((text: string) => { TTS.speak(text).catch(() => {}); }, []);
  const { strings } = useLocalization();
  const insets = useSafeAreaInsets();
  const [screenHeight, setScreenHeight] = useState(Dimensions.get('window').height);
  const [landscape, setLandscape] = useState(isLandscape());
  const [liveConfig, setLiveConfig] = useState<any>(builtConfig);

  useFocusEffect(useCallback(() => {
    KeyboardPreferences.getString('keyboardConfig_issiecalc_calc').then(saved => {
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const merged = { ...builtConfig, ...parsed, keysets: builtConfig.keysets };
          setLiveConfig(merged);
          loadFromConfig(parsed.voiceSettings);
          // Enforce calcMode — always overrides persisted keyset pref
          const mode = parsed.calcMode || (parsed.showScientific !== false ? 'both' : 'basic');
          if (mode === 'basic') setKeyset('basic');
          else if (mode === 'scientific') setKeyset('scientific');
          // mode === 'both': keep persisted keyset (already loaded by CalcContext)
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

  const calcMode: 'basic' | 'scientific' | 'both' = (() => {
    const v = liveConfig?.calcMode;
    if (v === 'basic' || v === 'scientific' || v === 'both') return v;
    return liveConfig?.showScientific !== false ? 'both' : 'basic';
  })();
  const showScientific = calcMode !== 'basic';
  const isScientific = keyset === 'scientific' || keyset === 'scientific_2nd' || keyset === 'scientific_landscape_2nd';

  // Scale display font sizes with fontSizePreset: xs=base, xl=1.8x
  const displayFontScale = (() => {
    const preset = liveConfig?.fontSizePreset ?? 'normal';
    const scales: Record<string, number> = { xs: 1.0, small: 1.2, normal: 1.35, large: 1.55, xl: 1.8 };
    return scales[preset] ?? 1.35;
  })();
  // The expression row uses the same size as the result.
  const resultFontSize = Math.round(48 * displayFontScale);
  // ...and the same weight, which follows the general-tab font weight setting
  // just as the size follows fontSizePreset.
  const displayFontWeight = resolveDisplayFontWeight(liveConfig?.fontWeight);

  // In result mode the expression and result share one row when they fit, and
  // fall back to two rows when they don't. We can't predict the width — template
  // expressions (√, logᵧ, xʸ) render as nested Views — so we lay the combined row
  // out invisibly, measure it, then commit to one layout or the other.
  const [displayWidth, setDisplayWidth] = useState(0);
  const [combinedFits, setCombinedFits] = useState<boolean | null>(null);
  // Re-measure whenever anything that changes the row's width changes.
  const measureKey = `${expression} ${result} ${resultFontSize} ${displayWidth}`;
  const measuredKey = useRef<string | null>(null);
  if (measuredKey.current !== measureKey) {
    measuredKey.current = measureKey;
    if (combinedFits !== null) setCombinedFits(null);
  }

  // Fixed, not a user setting: unlike a keyboard that opens over other content,
  // the calculator's keypad *is* the screen, so its height is a layout decision
  // rather than a preference (the settings panel hides the control for this
  // app). What is left over holds the top bar (~66pt), the speak button
  // (~68pt), and the expression and result rows — 48pt each scaled by
  // fontSizePreset. 0.76 is the old 'tall' value.
  // Basic gets a little more than it needs for its 5 rows: the operator column
  // is 0.75 units wide against the digits' 1.0, so at a shorter keyboard those
  // keys come out wider than they are tall. The extra height squares them up
  // into circles, which reads better.
  const heightRatio = isScientific ? 0.76 : 0.64;

  // The keypad is a sibling of the top bar and display inside the SafeAreaView,
  // so a share of the *whole* screen overflows: the chrome above and the bottom
  // inset still have to fit. In landscape that space is scarce (screenHeight is
  // the short side), so measure what is actually left and take a share of that
  // instead — TOP_CHROME covers the top bar, and insets.bottom the home
  // indicator.
  const TOP_CHROME = 66;
  const landscapeAvailable = Math.max(
    0,
    screenHeight - TOP_CHROME - insets.top - insets.bottom
  );
  const effectiveKbHeight = landscape
    ? landscapeAvailable * 0.78
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

    // Template keys require an X operand — show toast if none present
    if (TEMPLATE_KEYS_NEEDING_X.has(value) && !currentState.resultMode) {
      const expr = currentState.expression;
      if (!expr || /[+\-*/^%,(]$/.test(expr)) {
        showToastMsg(strings.settings.calcNeedsXFirst);
        return;
      }
    }

    // [2ND] in landscape maps to landscape_2nd variant — override keyset after dispatch
    const newState = dispatch(currentState, value);

    // Apply expression/result state
    if (value === '=') {
      // If in template mode, finalize the expression before computing
      if (currentState.templateMode) {
        replaceExpression(newState.expression);
      }
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
      replaceExpression(newState.expression);
      readout(value, newState.expression, newState.result);
      return;
    }
    if (newState.memory !== currentState.memory) {
      memoryStore();
    }

    // Readout (see readoutArgs: strips the \x00 template marker so "=" doesn't
    // say "error" for an expression the display has already computed).
    const { expression: readoutExpr, result: readoutRes } = readoutArgs(value, currentState, newState);
    readout(value, readoutExpr, readoutRes, newState.angleMode);
  };

  const screenBg = (liveConfig?.backgroundColor && liveConfig.backgroundColor !== 'default')
    ? liveConfig.backgroundColor
    : KB_BG;

  // Background for everything above the keyboard (top bar + display). Falls back
  // to the keyboard background so calculators without the setting look unchanged.
  const displayBg = resolveCalcDisplayBackground(liveConfig?.calcDisplayBgColor, screenBg);

  // Derive display text color: calcDisplayColor > luminance-based contrast
  // against the display background (not the keyboard's — they can differ).
  const displayTextColor = resolveCalcDisplayTextColor(liveConfig?.calcDisplayColor, displayBg);
  const dimTextColor = displayTextColor === '#000000' ? '#555555' : '#8E8E93';
  const fadedTextStyle = { color: displayTextColor, opacity: 0.6 } as const;

  const showAngleIndicator = keyset === 'scientific' || keyset === 'scientific_landscape_2nd' || keyset === 'scientific_2nd';
  const angleIndicator = showAngleIndicator
    ? <Text style={[styles.angleIndicator, fadedTextStyle]}>{angleMode === 'rad' ? 'Rad' : 'Deg'}</Text>
    : null;

  // Shared by the one-row and two-row layouts so they can't drift apart.
  const resultText = result === 'NUMBER_TOO_BIG' ? strings.settings.numberTooBig : result;
  const expressionNode = renderTemplateExpression(
    finalizeTemplate(expression),
    displayTextColor,
    dimTextColor,
    false,
    resultFontSize,
    displayFontWeight
  );
  const displayTextStyle = { color: displayTextColor, fontSize: resultFontSize, fontWeight: displayFontWeight };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: displayBg }]} edges={['top', 'left', 'right']}>
      {/* Top bar */}
      <View style={[styles.topBar, { backgroundColor: displayBg }]}>
        {calcMode === 'both' && (
          <View style={styles.segmented}>
            <TouchableOpacity
              style={[styles.segment, keyset === 'basic' && styles.segmentActive]}
              onPress={() => setKeyset('basic')}>
              <Text style={[styles.segmentText, keyset === 'basic' && styles.segmentTextActive, { color: dimTextColor }, keyset === 'basic' && { color: displayTextColor }]}>{'÷≡  '}{strings.settings.calcBasic}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segment, (keyset === 'scientific' || keyset === 'scientific_landscape_2nd' || keyset === 'scientific_2nd') && styles.segmentActive]}
              onPress={() => setKeyset('scientific')}>
              <Text style={[styles.segmentText, (keyset === 'scientific' || keyset === 'scientific_landscape_2nd' || keyset === 'scientific_2nd') && styles.segmentTextActive, { color: dimTextColor }, (keyset === 'scientific' || keyset === 'scientific_landscape_2nd' || keyset === 'scientific_2nd') && { color: displayTextColor }]}>{'f(x)  '}{strings.settings.calcScientific}</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity style={styles.gearButton} onPress={() => navigation?.navigate('Settings')}>
          <Text style={[styles.gearIcon, { color: dimTextColor }]}>⚙</Text>
        </TouchableOpacity>
      </View>

      {/* Display */}
      <View style={[styles.display, { backgroundColor: displayBg }]}>
        {readoutMode !== 'off' && (
          <TouchableOpacity
            style={[styles.speakButton, calcMode !== 'both' && styles.speakButtonRaised]}
            onPress={() => {
              const lang = language;
              const ml = mathLevel ?? 'standard';
              const eq = getSubMap(lang, ml)['='] ?? 'equals';
              if (resultMode && expression) {
                const res = result === 'NUMBER_TOO_BIG' ? strings.settings.numberTooBig : result;
                const spokenResult = speakableNumber(formatResult(res, decimalDigits, lang), lang);
                speakDirect(`${speakExpression(expression)} ${eq} ${spokenResult}`);
              } else {
                const display = expression || '0';
                speakDirect(speakExpression(display) || speakableNumber(formatExpression(display) || '0', lang));
              }
            }}
            activeOpacity={0.6}>
            {/* Reads as a button: the voice tab's green becomes the tile, with
                the same glyph in white on top. */}
            <View style={styles.speakButtonTile}>
              <MyIcon info={{ name: SPEAK_ICON_NAME, type: 'Ionicons', color: '#FFFFFF', size: 41 }} />
            </View>
          </TouchableOpacity>
        )}
        <View
          style={[styles.displayInner, readoutMode !== 'off' && calcMode === 'both' && styles.displayInnerWithSpeak]}
          onLayout={e => setDisplayWidth(e.nativeEvent.layout.width)}>
          {/* Measuring pass: lay the combined row out at its natural width,
              invisibly, so we can compare it against the display width. */}
          {resultMode && combinedFits === null && displayWidth > 0 && (
            <View style={styles.measureRow} pointerEvents="none">
              <View
                style={styles.measureContent}
                onLayout={e => setCombinedFits(e.nativeEvent.layout.width <= displayWidth)}>
                {expressionNode}
                <Text style={[styles.expression, displayTextStyle, styles.inlineText]}>{' = '}{resultText}</Text>
              </View>
            </View>
          )}
          {resultMode && combinedFits === true ? (
            /* One row: expression, "=" and result together. */
            <View style={styles.expressionRow}>
              {angleIndicator}
              {expressionNode}
              <Text style={[styles.expression, displayTextStyle, styles.inlineText]} numberOfLines={1}>{' = '}{resultText}</Text>
            </View>
          ) : (
            /* Two rows: expression + "=" above, result below. Outside result
               mode this row is invisible but keeps its height, so the result
               line doesn't jump when a result appears. */
            <View style={[styles.expressionRow, (!resultMode || combinedFits === null) && { opacity: 0 }]}>
              {angleIndicator}
              <Text style={[styles.expression, displayTextStyle, { flexShrink: 1 }]} numberOfLines={1} adjustsFontSizeToFit>
                {expressionNode}
              </Text>
              <Text style={[styles.expression, displayTextStyle, { alignSelf: 'center' }]}> =</Text>
            </View>
          )}
          {templateMode && !resultMode
            ? (
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-start', alignSelf: 'stretch' }}>
                {renderTemplateExpression(expression, displayTextColor, dimTextColor, true, resultFontSize, displayFontWeight) as any}
              </View>
            ) : HAS_TEMPLATE_FN.test(expression) && !resultMode
            ? (
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-start', alignSelf: 'stretch' }}>
                {renderTemplateExpression(expression, displayTextColor, dimTextColor, false, resultFontSize, displayFontWeight) as any}
              </View>
            ) : resultMode && combinedFits !== false ? null : (
          <Text style={[styles.result, displayTextStyle]} numberOfLines={1}>
            {resultMode
              ? resultText
              : (() => {
                    const formatted = formatExpression(expression) || '0';
                    const ghostCount = countUnclosedParens(expression);
                    if (ghostCount === 0) return formatted;
                    return (
                      <>
                        {formatted}
                        <Text style={{ opacity: 0.3 }}>{')'.repeat(ghostCount)}</Text>
                      </>
                    );
                  })()}
          </Text>
            )}
        </View>
      </View>
      <View style={[styles.keyboardContainer, { backgroundColor: screenBg }]}>
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]} pointerEvents="none">
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
        <KeyboardPreview
          style={{ height: effectiveKbHeight, backgroundColor: screenBg }}
          configJson={configJson}
          hideGlobeButton
          targetHeight={effectiveKbHeight}
          onKeyPress={handleKeyPress}
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
    flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-end',
    paddingHorizontal: 24, paddingBottom: 16,
  },
  displayInner: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  // Pinned to the display's top-left, just under the basic/scientific selector,
  // so it stays clear of the expression/result rows, which grow from the bottom.
  // left: -8 cancels 8pt of the display's 24pt horizontal padding, lining the
  // button up with the selector above it (topBar's paddingHorizontal: 16).
  speakButton: {
    position: 'absolute',
    top: 0,
    left: 16  ,
    zIndex: 1,
  },
  // With no basic/scientific selector the top bar row is empty, so the button
  // moves up into it (its own height) instead of leaving a gap above the
  // display. -60 keeps it within the bar, whose height the 54pt gear sets.
  speakButtonRaised: { top: -60 },
  // Keeps the expression/result clear of the speak button's 60pt tile when the
  // display is short (landscape, compact heights).
  displayInnerWithSpeak: { paddingTop: 68 },
  // A rounded-square tile, so the control reads as a button rather than a glyph.
  speakButtonTile: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: SPEAK_ICON_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Matches `result` (same weight/alignment); size and colour come from props.
  expression: { fontSize: 48, fontWeight: '300', color: '#FFFFFF', marginBottom: 8, textAlign: 'right', alignSelf: 'stretch' },
  result: { fontSize: 48, fontWeight: '300', color: '#FFFFFF', textAlign: 'right', alignSelf: 'stretch' },
  // justifyContent pushes the expression + "=" to the right edge, so the row
  // lines up with the right-aligned result below it.
  expressionRow: { flexDirection: 'row', alignItems: 'flex-end', alignSelf: 'stretch', justifyContent: 'flex-end' },
  // The measuring pass must not take up space or be seen: absolute keeps it out
  // of the column flow, and the content child lays out at its natural width so
  // we learn how wide the combined row actually wants to be.
  measureRow: { position: 'absolute', opacity: 0, left: 0, top: 0, flexDirection: 'row' },
  measureContent: { flexDirection: 'row', alignItems: 'flex-end', flexShrink: 0 },
  // The " = result" text sits inline after the expression node, which may be a
  // View (templates), so it must not stretch across the row.
  inlineText: { alignSelf: 'flex-end', marginBottom: 0, textAlign: 'left' },
  // marginRight: 'auto' keeps the Rad/Deg indicator at the left edge now that
  // the row pushes its contents right.
  angleIndicator: { fontSize: 16, color: '#8E8E93', marginRight: 'auto', paddingBottom: 4 },
  keyboardContainer: { backgroundColor: KB_BG },
  toast: {
    position: 'absolute', top: 8, alignSelf: 'center',
    backgroundColor: 'rgba(60,60,67,0.9)', borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 12, zIndex: 99,
  },
  toastText: { color: '#FFFFFF', fontSize: 22, fontWeight: '500' },
});

export default CalcScreen;
