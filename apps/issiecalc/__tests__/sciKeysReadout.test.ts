/**
 * Every scientific key the keypad can produce, read aloud.
 *
 * The other suites grew case by case around reported bugs, which left whole
 * families untouched: the hyperbolics, the inverse trig, ln, the constants and
 * the percent key had no test at all. This walks the keysets in
 * ios/IssieCalc/default_config.json so a key cannot be added without somewhere
 * to say what it should sound like.
 *
 * No TTS is triggered: the module is mocked and the strings it would have
 * spoken are compared against the expected phrasing.
 */
import React from 'react';
import { create, act } from 'react-test-renderer';
import { dispatch, CalcState, readoutArgs, finalizeTemplate } from '../src/services/calcDispatch';
import { speakExpression } from '../src/services/speakExpression';

const spoken: string[] = [];
jest.mock('../../issievoice/src/services/TextToSpeech', () => ({
  __esModule: true,
  default: {
    initialize: () => Promise.resolve(),
    speak: (t: string) => { spoken.push(t); return Promise.resolve(); },
    setLanguage: () => Promise.resolve(),
    setVoice: () => Promise.resolve(),
    setRate: () => {},
    setPitch: () => {},
  },
}));

const { CalcTTSProvider, useCalcTTS } = require('../src/context/CalcTTSContext');

const baseState: CalcState = {
  expression: '', result: '', resultMode: false,
  angleMode: 'deg', keyset: 'scientific', memory: '', templateMode: false,
};

function mountTTS(): any {
  let ctx: any;
  const Probe = () => { ctx = useCalcTTS(); return null; };
  act(() => { create(React.createElement(CalcTTSProvider, null, React.createElement(Probe))); });
  return ctx;
}

interface Flows { expression: string; result: string; typing: string[]; button: string }

/** Types a sequence and returns what each flow would say. */
function press(
  keys: string[],
  opts: { language?: string; mathLevel?: string; angleMode?: 'deg' | 'rad'; mode?: string } = {}
): Flows {
  const language = opts.language ?? 'en-US';
  const mathLevel = opts.mathLevel ?? 'standard';
  const ctx = mountTTS();
  spoken.length = 0;
  act(() => {
    ctx.loadFromConfig({ readoutMode: opts.mode ?? 'every-number', language, mathLevel });
  });
  let s: CalcState = { ...baseState, angleMode: opts.angleMode ?? 'deg' };
  for (const key of keys) {
    const next = dispatch(s, key);
    const { expression, result } = readoutArgs(key, s, next);
    act(() => { ctx.readout(key, expression, result, next.angleMode); });
    // "=" defers half its readout on a timer; flush per key, as real time would.
    act(() => { jest.runAllTimers(); });
    s = next;
  }
  const expression = finalizeTemplate(s.expression);
  return {
    expression,
    result: s.result,
    typing: [...spoken],
    button: speakExpression(expression, language, mathLevel as any),
  };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('every scientific key has a readout', () => {
  // Guards the suite itself: if a key is added to the keypad, this fails until
  // somebody decides what it should say. Keys that are deliberately silent or
  // handled elsewhere are listed with the reason.
  const HANDLED_ELSEWHERE: Record<string, string> = {
    '[2ND]': 'keyset switch, silent by design (SILENT_KEYS)',
    '[2ND_OFF]': 'keyset switch, silent by design (SILENT_KEYS)',
    '[ANGLE_TOGGLE]': 'deg/rad switch, silent by design (SILENT_KEYS)',
    'ms': 'memory store, silent by design (SILENT_KEYS)',
    'mr': 'memory recall, silent by design (SILENT_KEYS)',
    'rand': 'non-deterministic, covered as a silent key',
    '⌫': 'silent by design (SILENT_KEYS)',
    'AC': 'silent by design (SILENT_KEYS)',
    '+/-': 'silent by design (SILENT_KEYS)',
  };

  it('covers every key in the shipped keysets', () => {
    const config = require('../../../ios/IssieCalc/default_config.json');
    const keys = new Set<string>();
    JSON.stringify(config.keysets, (k, v) => {
      if (k === 'value' && typeof v === 'string') keys.add(v);
      return v;
    });

    const fs = require('fs');
    const path = require('path');
    const dir = __dirname;
    const sources = fs.readdirSync(dir)
      .filter((f: string) => f.endsWith('.test.ts') || f.endsWith('.test.tsx'))
      .map((f: string) => fs.readFileSync(path.join(dir, f), 'utf8'))
      .join('\n');

    const isDigit = (k: string) => /^[0-9.]$/.test(k);
    const missing = [...keys].filter(k => {
      if (isDigit(k) || HANDLED_ELSEWHERE[k]) return false;
      // Pressed somewhere as a quoted literal.
      return !sources.includes(`'${k}'`);
    });

    expect(missing).toEqual([]);
  });
});

describe('logarithms', () => {
  it('ln names itself and its operand', () => {
    const { typing, button } = press(['2', '0', 'ln(']);
    expect(typing).toEqual(['ln of 20']);
    expect(button).toBe('ln of 20');
  });

  it('ln reads its result on "="', () => {
    const { result, typing } = press(['2', '0', 'ln(', '=']);
    expect(result).toBe('2.99573227');
    expect(typing).toEqual(['ln of 20', 'equals', '2.99 and 6 more digits']);
  });

  it('log is base ten and says so by name', () => {
    const { result, typing, button } = press(['1', '0', '0', 'log(', '=']);
    expect(result).toBe('2');
    expect(typing).toEqual(['log of 100', 'equals', '2']);
    expect(button).toBe('log of 100');
  });

  it('log base 2 names its base', () => {
    const { typing, button } = press(['8', 'log2(']);
    expect(typing).toEqual(['log base 2 of 8']);
    expect(button).toBe('log base 2 of 8');
  });
});

describe('exponentials', () => {
  it('eˣ completes the power on the keypress', () => {
    const { expression, typing, button } = press(['2', 'e^(']);
    // Rewritten to the same xpow( form the other power keys use.
    expect(expression).toBe('xpow(e,2)');
    expect(typing).toEqual(['e to the power of 2']);
    expect(button).toBe('e to the power of 2');
  });

  it('eˣ reads its result without repeating the exponent', () => {
    const { result, typing } = press(['2', 'e^(', '=']);
    expect(result).toBe('7.3890561');
    expect(typing).toEqual(['e to the power of 2', 'equals', '7.38 and 5 more digits']);
  });
});

describe('forward trigonometry', () => {
  // The argument is an angle, so the unit is spoken with it.
  it.each([
    [['3', '0', 'sin('], 'sine of 30 degrees'],
    [['6', '0', 'cos('], 'cosine of 60 degrees'],
    [['4', '5', 'tan('], 'tangent of 45 degrees'],
  ])('%j names the function and the angle unit', (keys, expected) => {
    expect(press(keys as string[]).typing).toEqual([expected]);
  });

  it.each([
    [['3', '0', 'sin('], 'sine of 30 radians'],
    [['6', '0', 'cos('], 'cosine of 60 radians'],
    [['4', '5', 'tan('], 'tangent of 45 radians'],
  ])('%j follows the radian setting', (keys, expected) => {
    expect(press(keys as string[], { angleMode: 'rad' }).typing).toEqual([expected]);
  });

  it('reads the result of a trig call', () => {
    const { result, typing } = press(['6', '0', 'cos(', '=']);
    expect(result).toBe('0.5');
    expect(typing).toEqual(['cosine of 60 degrees', 'equals', '0.5']);
  });
});

describe('hyperbolic functions', () => {
  // Not angles: sinh takes a plain number, so no unit is spoken.
  it.each([
    [['1', 'sinh('], 'hyperbolic sine of 1'],
    [['1', 'cosh('], 'hyperbolic cosine of 1'],
    [['1', 'tanh('], 'hyperbolic tangent of 1'],
  ])('%j names the function without an angle unit', (keys, expected) => {
    const { typing, button } = press(keys as string[]);
    expect(typing).toEqual([expected]);
    expect(button).toBe(expected);
  });

  it('stays unitless in radian mode, having no angle to qualify', () => {
    expect(press(['1', 'sinh('], { angleMode: 'rad' }).typing)
      .toEqual(['hyperbolic sine of 1']);
  });

  it('reads a hyperbolic result', () => {
    const { result, typing } = press(['1', 'sinh(', '=']);
    expect(result).toBe('1.17520119');
    expect(typing).toEqual(['hyperbolic sine of 1', 'equals', '1.17 and 6 more digits']);
  });
});

describe('inverse hyperbolic functions', () => {
  it.each([
    [['1', 'asinh('], 'inverse hyperbolic sine of 1'],
    [['1', 'acosh('], 'inverse hyperbolic cosine of 1'],
    [['0', '.', '5', 'atanh('], 'inverse hyperbolic tangent of 0.5'],
  ])('%j names the function in full', (keys, expected) => {
    const { typing, button } = press(keys as string[]);
    expect(typing).toEqual([expected]);
    expect(button).toBe(expected);
  });
});

describe('inverse trigonometry', () => {
  it.each([
    [['1', 'asin('], 'arc sine'],
    [['1', 'acos('], 'arc cosine'],
    [['1', 'atan('], 'arc tangent'],
  ])('%j names the function', (keys, expectedName) => {
    // The name is asserted on its own; the unit that follows it is wrong today
    // and is pinned separately below.
    expect(press(keys as string[]).typing[0]).toContain(expectedName);
  });

  it('computes the angle it is named for', () => {
    const { result } = press(['1', 'asin(', '=']);
    expect(result).toBe('90');
  });

  it('the speak button leaves the argument unqualified, which is right', () => {
    expect(press(['1', 'asin(']).button).toBe('arc sine of 1');
  });

  it.failing('should not call the argument an angle', () => {
    // asin takes a ratio and *returns* an angle, so "arc sine of 1 degrees"
    // qualifies the wrong number — the unit belongs to the result. The cause is
    // ANGLE_FUNCTIONS, which lumps asin/acos/atan in with sin/cos/tan; the
    // forward three do take an angle and are correct.
    expect(press(['1', 'asin(']).typing).toEqual(['arc sine of 1']);
  });

  it('records what it says today', () => {
    // Companion to the failing test above: fixing one must update the other.
    expect(press(['1', 'asin(']).typing).toEqual(['arc sine of 1 degrees']);
    expect(press(['1', 'asin('], { angleMode: 'rad' }).typing)
      .toEqual(['arc sine of 1 radians']);
  });
});

describe('constants', () => {
  it('reads pi when it is part of a sum', () => {
    const { result, typing, button } = press(['2', '*', 'pi', '=']);
    expect(result).toBe('6.28318531');
    expect(typing).toEqual(['2 times', 'pi', 'equals', '6.28 and 6 more digits']);
    expect(button).toBe('2 times pi');
  });

  it('reads pi and e on "="', () => {
    expect(press(['pi', '=']).typing).toEqual(['pi', 'equals', '3.14 and 6 more digits']);
    expect(press(['e', '=']).typing).toEqual(['e', 'equals', '2.71 and 6 more digits']);
  });

  it('the speak button names both constants', () => {
    expect(press(['pi']).button).toBe('pi');
    expect(press(['e']).button).toBe('e');
  });

  it.failing('should announce a constant as it is typed', () => {
    // Every other value-producing key says something when pressed. pi and e
    // have names in all three maps but reach neither OPERATOR_KEYS nor
    // WRAPPING_FUNCTIONS, so every-number mode passes over them in silence.
    expect(press(['pi']).typing).toEqual(['pi']);
  });

  it('records the silence today', () => {
    expect(press(['pi']).typing).toEqual([]);
    expect(press(['e']).typing).toEqual([]);
  });

  it('announces constants in every-digit mode, where keys speak directly', () => {
    expect(press(['pi'], { mode: 'every-digit' }).typing).toEqual(['pi']);
  });
});

describe('percent', () => {
  it('names the percent key with its operand', () => {
    const { typing, button } = press(['5', '0', '%']);
    expect(typing).toEqual(['50 percent']);
    expect(button).toBe('50 percent');
  });

  it('computes a percentage of a product', () => {
    const { result, button } = press(['2', '0', '0', '*', '1', '0', '%', '=']);
    expect(result).toBe('20');
    expect(button).toBe('200 times 10 percent');
  });

  it.failing('should not push an empty utterance on "="', () => {
    // "=" speaks the last operand before the result, but a trailing "%" leaves
    // nothing to extract, so an empty string is handed to TTS. Harmless to
    // hear, but it is a wasted utterance the other keys do not produce.
    expect(press(['5', '0', '%', '=']).typing).toEqual(['50 percent', 'equals', '0.5']);
  });

  it('records the empty utterance today', () => {
    expect(press(['5', '0', '%', '=']).typing).toEqual(['50 percent', '', 'equals', '0.5']);
  });
});

describe('parentheses', () => {
  it('the speak button names both brackets', () => {
    const { result, button } = press(['(', '2', '+', '3', ')', '=']);
    expect(result).toBe('5');
    expect(button).toBe('open parenthesis 2 plus 3 close parenthesis');
  });

  it('reads a bracketed group inside a larger sum', () => {
    const { result, button } = press(['2', '*', '(', '3', '+', '4', ')', '=']);
    expect(result).toBe('14');
    expect(button).toBe('2 times open parenthesis 3 plus 4 close parenthesis');
  });

  it.failing('should not read a bare bracket while typing', () => {
    // The operator branch takes the text before the "+" verbatim, so a leading
    // "(" is spoken as the character itself. The button says "open
    // parenthesis"; typing says "(2 plus".
    expect(press(['(', '2', '+', '3', ')', '=']).typing[0]).toBe('open parenthesis 2 plus');
  });

  it('records the raw bracket today', () => {
    expect(press(['(', '2', '+', '3', ')', '=']).typing[0]).toBe('(2 plus');
  });
});

describe('memory keys', () => {
  it('recalls a stored value silently, then reads it on "="', () => {
    const { expression, typing } = press(['5', 'ms', 'AC', 'mr', '=']);
    expect(expression).toBe('5');
    // ms/mr/AC are all silent; only "=" speaks.
    expect(typing).toEqual(['5', 'equals', '5']);
  });

  it('the toggles say nothing at all', () => {
    expect(press(['[ANGLE_TOGGLE]']).typing).toEqual([]);
    expect(press(['[2ND]']).typing).toEqual([]);
    expect(press(['[2ND_OFF]']).typing).toEqual([]);
  });
});

describe('every function key in Hebrew', () => {
  // Both flows agree for all of these, so one expectation covers each.
  it.each([
    [['2', '0', 'ln('], 'ln של 20'],
    [['1', '0', '0', 'log('], 'לוג של 100'],
    [['8', 'log2('], 'לוג בסיס 2 של 8'],
    [['9', '2root('], 'שורש ריבועי של 9'],
    [['8', '3root('], 'שורש שלישי של 8'],
    [['5', 'factorial('], '5 עצרת'],
    [['7', '1/('], '1 חלקי 7'],
    [['4', 'x^2'], '4 בָּרִיבּוּעַ'],
    [['4', 'x^3'], '4 בָּשְׁלִישִׁית'],
    [['2', 'e^('], 'e בחזקת 2'],
    [['3', '10^('], '10 בחזקת 3'],
    [['3', '2^('], '2 בחזקת 3'],
    [['1', 'sinh('], 'סינוס היפרבולי של 1'],
    [['1', 'cosh('], 'קוסינוס היפרבולי של 1'],
    [['1', 'tanh('], 'טנגנס היפרבולי של 1'],
    [['1', 'asinh('], 'ארקסינוס היפרבולי של 1'],
    [['1', 'acosh('], 'ארקקוסינוס היפרבולי של 1'],
    [['0', '.', '5', 'atanh('], 'ארקטנגנס היפרבולי של 0.5'],
    [['5', '0', '%'], '50 אחוז'],
  ])('%j reads the same both ways in Hebrew', (keys, expected) => {
    const { typing, button } = press(keys as string[], { language: 'he-IL' });
    expect(typing).toEqual([expected]);
    expect(button).toBe(expected);
  });

  it.each([
    [['3', '0', 'sin('], 'סינוס של 30 מעלות'],
    [['6', '0', 'cos('], 'קוסינוס של 60 מעלות'],
    [['4', '5', 'tan('], 'טנגנס של 45 מעלות'],
  ])('%j names the angle unit in Hebrew', (keys, expected) => {
    expect(press(keys as string[], { language: 'he-IL' }).typing).toEqual([expected]);
  });

  it('names radians in Hebrew', () => {
    expect(press(['3', '0', 'sin('], { language: 'he-IL', angleMode: 'rad' }).typing)
      .toEqual(['סינוס של 30 רדיאנים']);
  });

  it.each([
    [['2', 'x^(', '3'], '2 בחזקת', '2 בחזקת 3'],
    [['5', 'yroot(', '3'], 'שורש של 5', 'שורש שלישי של 5'],
    [['8', 'logy(', '2'], 'לוג בסיס y של 8', 'לוג בסיס 2 של 8'],
  ])('%j diverges the same way in Hebrew as in English', (keys, typed, spokenWhole) => {
    const { typing, button } = press(keys as string[], { language: 'he-IL' });
    expect(typing).toEqual([typed]);
    expect(button).toBe(spokenWhole);
  });

  it('reads a negative result and a truncated decimal in Hebrew', () => {
    expect(press(['3', '-', '8', '='], { language: 'he-IL' }).typing)
      .toEqual(['3 פחות', '8', 'שָׁוֶה', 'מינוס 5']);
    expect(press(['1', '/', '3', '='], { language: 'he-IL' }).typing)
      .toEqual(['1 חֵלְקֵי', '3', 'שָׁוֶה', '0.33 ועוד 7 סְפָרוֹת']);
  });

  it('names both brackets in Hebrew', () => {
    expect(press(['(', '2', '+', '3', ')', '='], { language: 'he-IL' }).button)
      .toBe('סוגר פתוח 2 פלוס 3 סוגר סגור');
  });
});

describe('every function key in Arabic', () => {
  it.each([
    [['2', '0', 'ln('], 'لوغاريتم طبيعي من 20'],
    [['1', '0', '0', 'log('], 'لوغاريتم من 100'],
    [['8', 'log2('], 'لوغاريتم أساس 2 من 8'],
    [['9', '2root('], 'جذر تربيعي من 9'],
    [['8', '3root('], 'جذر تكعيبي من 8'],
    [['5', 'factorial('], '5 مضروب'],
    [['7', '1/('], '1 على 7'],
    [['4', 'x^2'], '4 تربيع'],
    [['4', 'x^3'], '4 تكعيب'],
    [['2', 'e^('], 'e أس 2'],
    [['3', '10^('], '10 أس 3'],
    [['3', '2^('], '2 أس 3'],
    [['1', 'sinh('], 'جيب زائدي من 1'],
    [['1', 'cosh('], 'جيب تمام زائدي من 1'],
    [['1', 'tanh('], 'ظل زائدي من 1'],
    [['1', 'asinh('], 'جيب زائدي معكوس من 1'],
    [['1', 'acosh('], 'جيب تمام زائدي معكوس من 1'],
    [['0', '.', '5', 'atanh('], 'ظل زائدي معكوس من 0.5'],
    [['5', '0', '%'], '50 بالمئة'],
  ])('%j reads the same both ways in Arabic', (keys, expected) => {
    const { typing, button } = press(keys as string[], { language: 'ar-SA' });
    expect(typing).toEqual([expected]);
    expect(button).toBe(expected);
  });

  it.each([
    [['3', '0', 'sin('], 'جيب من 30 درجات'],
    [['6', '0', 'cos('], 'جيب التمام من 60 درجات'],
    [['4', '5', 'tan('], 'ظل من 45 درجات'],
  ])('%j names the angle unit in Arabic', (keys, expected) => {
    expect(press(keys as string[], { language: 'ar-SA' }).typing).toEqual([expected]);
  });

  it('names radians in Arabic', () => {
    expect(press(['3', '0', 'sin('], { language: 'ar-SA', angleMode: 'rad' }).typing)
      .toEqual(['جيب من 30 راديان']);
  });

  it.each([
    [['2', 'x^(', '3'], '2 أس', '2 أس 3'],
    [['5', 'yroot(', '3'], 'جذر من 5', 'جذر تكعيبي من 5'],
    [['8', 'logy(', '2'], 'لوغاريتم أساس y من 8', 'لوغاريتم أساس 2 من 8'],
  ])('%j diverges the same way in Arabic as in English', (keys, typed, spokenWhole) => {
    const { typing, button } = press(keys as string[], { language: 'ar-SA' });
    expect(typing).toEqual([typed]);
    expect(button).toBe(spokenWhole);
  });

  it('reads a negative result and a truncated decimal in Arabic', () => {
    expect(press(['3', '-', '8', '='], { language: 'ar-SA' }).typing)
      .toEqual(['3 ناقص', '8', 'يساوي', 'ناقص 5']);
    expect(press(['1', '/', '3', '='], { language: 'ar-SA' }).typing)
      .toEqual(['1 مقسوم على', '3', 'يساوي', '0.33 و 7 أرقام إضافية']);
  });

  it('names both brackets in Arabic', () => {
    expect(press(['(', '2', '+', '3', ')', '='], { language: 'ar-SA' }).button)
      .toBe('قوس مفتوح 2 زائد 3 قوس مغلق');
  });

  it('ignores the young register, which only Hebrew defines', () => {
    const young = press(['6', '*', '7', '='], { language: 'ar-SA', mathLevel: 'young' });
    const standard = press(['6', '*', '7', '='], { language: 'ar-SA' });
    expect(young.typing).toEqual(standard.typing);
  });
});

describe('the constants are left untranslated on "="', () => {
  it.each([
    ['he-IL', 'פאי'],
    ['ar-SA', 'باي'],
  ])('%s names pi for the speak button', (language, expected) => {
    expect(press(['pi'], { language }).button).toBe(expected);
  });

  it.failing('should translate pi when "=" reads the operand', () => {
    // "=" speaks the last operand via extractLastOperand + speakableNumber,
    // neither of which consults the substitution map — so the literal "pi" is
    // handed to an Arabic voice. The speak button, which does go through the
    // map, says باي correctly for the same expression.
    expect(press(['2', '*', 'pi', '='], { language: 'ar-SA' }).typing[1]).toBe('باي');
  });

  it('records the untranslated constant today', () => {
    expect(press(['2', '*', 'pi', '='], { language: 'ar-SA' }).typing[1]).toBe('pi');
    expect(press(['2', '*', 'pi', '='], { language: 'he-IL' }).typing[1]).toBe('pi');
  });
});
