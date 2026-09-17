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

  it('does not repeat the operand on "=" for a name ending in a digit', () => {
    // log2( has a digit before its paren, which the "ends with a function"
    // check used to miss — so "=" read the operand again ("log base 2 of 8",
    // then "8").
    expect(press(['8', 'log2(', '=']).typing)
      .toEqual(['log base 2 of 8', 'equals', '3']);
  });

  it.each([
    [['9', '2root(', '='], 'square root of 9', '3'],
    [['8', '3root(', '='], 'cube root of 8', '2'],
  ])('%j does not repeat the operand for a name starting with a digit', (keys, named, answer) => {
    expect(press(keys as string[]).typing).toEqual([named, 'equals', answer]);
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
  // These take a ratio and return an angle, so — unlike sin/cos/tan — the unit
  // belongs to the answer, not to the argument.
  it.each([
    [['1', 'asin('], 'arc sine of 1'],
    [['1', 'acos('], 'arc cosine of 1'],
    [['1', 'atan('], 'arc tangent of 1'],
  ])('%j names the function without qualifying its argument', (keys, expected) => {
    const { typing, button } = press(keys as string[]);
    expect(typing).toEqual([expected]);
    expect(button).toBe(expected);
  });

  it('leaves the argument unqualified in radian mode too', () => {
    expect(press(['1', 'asin('], { angleMode: 'rad' }).typing).toEqual(['arc sine of 1']);
  });

  it('names the unit on the result, which is the angle', () => {
    const { result, typing } = press(['1', 'asin(', '=']);
    expect(result).toBe('90');
    expect(typing).toEqual(['arc sine of 1', 'equals', '90 degrees']);
  });

  it('follows the radian setting when naming the result', () => {
    expect(press(['1', 'atan(', '='], { angleMode: 'rad' }).typing)
      .toEqual(['arc tangent of 1', 'equals', '0.78 and 7 more digits radians']);
  });

  it('names the result unit in every-digit mode as well', () => {
    expect(press(['1', 'asin(', '='], { mode: 'every-digit' }).typing)
      .toEqual(['1', 'arc sine', 'equals', '90 degrees']);
  });

  it.each([
    ['he-IL', 'ארקסינוס של 1', '90 מעלות'],
    ['ar-SA', 'جيب معكوس من 1', '90 درجات'],
  ])('%s puts the unit on the result too', (language, named, answered) => {
    expect(press(['1', 'asin(', '='], { language }).typing)
      .toEqual([named, expect.anything(), answered]);
  });

  it('leaves a forward trig result unqualified, its argument carrying the unit', () => {
    // The mirror of the above: sin takes the angle, so the answer is a ratio
    // and must not be given a unit.
    expect(press(['3', '0', 'sin(', '=']).typing)
      .toEqual(['sine of 30 degrees', 'equals', '0.5']);
  });
});

describe('constants', () => {
  // π and e put a value on the display the way a digit does, so they announce
  // themselves by name when pressed.
  it('announces a constant as it is typed', () => {
    expect(press(['pi']).typing).toEqual(['pi']);
    expect(press(['e']).typing).toEqual(['e']);
  });

  it('reads pi when it is part of a sum', () => {
    const { result, typing, button } = press(['2', '*', 'pi', '=']);
    expect(result).toBe('6.28318531');
    expect(typing).toEqual(['2 times', 'pi', 'equals', '6.28 and 6 more digits']);
    expect(button).toBe('2 times pi');
  });

  it('does not say the constant twice when "=" follows it', () => {
    // The key has already named it, so "=" goes straight to the answer rather
    // than reading the trailing operand again.
    expect(press(['pi', '=']).typing).toEqual(['pi', 'equals', '3.14 and 6 more digits']);
    expect(press(['e', '=']).typing).toEqual(['e', 'equals', '2.71 and 6 more digits']);
  });

  it('still reads a digit operand on "=", which nothing else has spoken', () => {
    // The guard above must not suppress the ordinary case: digits are silent
    // in every-number mode, so "=" saying the number is its first airing.
    expect(press(['4', '2', '=']).typing).toEqual(['42', 'equals', '42']);
  });

  it('the speak button names both constants', () => {
    expect(press(['pi']).button).toBe('pi');
    expect(press(['e']).button).toBe('e');
  });

  it('announces constants in every-digit mode too', () => {
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

  it('does not push an empty utterance on "="', () => {
    // A trailing "%" leaves nothing for "=" to extract as an operand, so it
    // goes straight to the answer rather than handing TTS an empty string.
    expect(press(['5', '0', '%', '=']).typing).toEqual(['50 percent', 'equals', '0.5']);
  });

  it('reads a percentage of a product without a gap', () => {
    expect(press(['2', '0', '0', '*', '1', '0', '%', '=']).typing)
      .toEqual(['200 times', '10 percent', 'equals', '20']);
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

  it('does not read a bare bracket while typing', () => {
    // An unclosed group is stripped before the operand is spoken, so the
    // character itself is never voiced ("(2 plus").
    expect(press(['(', '2', '+', '3', ')', '=']).typing[0]).toBe('2 plus');
  });

  it('reads the whole bracketed session in order', () => {
    expect(press(['(', '2', '+', '3', ')', '=']).typing)
      .toEqual(['2 plus', '3', 'equals', '5']);
  });

  it('keeps the bracket out of a nested group too', () => {
    expect(press(['2', '*', '(', '3', '+', '4', ')', '=']).typing)
      .toEqual(['2 times', '3 plus', '4', 'equals', '14']);
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

describe('the constants are translated wherever they are read', () => {
  it.each([
    ['he-IL', 'פאי'],
    ['ar-SA', 'باي'],
  ])('%s names pi for the speak button', (language, expected) => {
    expect(press(['pi'], { language }).button).toBe(expected);
  });

  it.each([
    ['he-IL', 'פאי'],
    ['ar-SA', 'باي'],
  ])('%s names pi when it is pressed', (language, expected) => {
    expect(press(['pi'], { language }).typing).toEqual([expected]);
  });

  it.each([
    ['he-IL', 'פאי'],
    ['ar-SA', 'باي'],
  ])('%s translates pi when "=" reads it as an operand', (language, expected) => {
    // The operand path goes through the substitution map, so a Hebrew or
    // Arabic voice is never handed the English letters "pi".
    expect(press(['2', '*', 'pi', '='], { language }).typing[1]).toBe(expected);
  });

  it.each([
    ['he-IL', 'e'],
    ['ar-SA', 'e'],
  ])('%s keeps e as the letter, which is how it is written and said', (language, expected) => {
    expect(press(['2', '*', 'e', '='], { language }).typing[1]).toBe(expected);
  });
});
