/**
 * Systematic coverage of the readout, as opposed to the per-bug regressions in
 * the other suites. Sweeps the three languages, both math levels and all four
 * readout modes so a change to a substitution map cannot pass unnoticed.
 *
 * No TTS is triggered: the module is mocked and the strings it would have
 * spoken are compared against the expected phrasing.
 */
import React from 'react';
import { create, act } from 'react-test-renderer';
import { dispatch, CalcState, readoutArgs } from '../src/services/calcDispatch';
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

const {
  CalcTTSProvider, useCalcTTS, formatResult, speakableNumber,
} = require('../src/context/CalcTTSContext');

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

/**
 * Types a key sequence through the real dispatch and readout, returning every
 * string that would have gone to TTS, in order.
 *
 * "=" speaks through speakWithPause, whose second half is on a timer, so the
 * timers are run out before collecting — otherwise the result is missing.
 */
function speakKeys(ctx: any, keys: string[], settings: Record<string, any>): string[] {
  spoken.length = 0;
  act(() => { ctx.loadFromConfig(settings); });
  let s = baseState;
  for (const key of keys) {
    const next = dispatch(s, key);
    const { expression, result } = readoutArgs(key, s, next);
    act(() => { ctx.readout(key, expression, result, next.angleMode); });
    s = next;
  }
  act(() => { jest.runAllTimers(); });
  return [...spoken];
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('readout modes', () => {
  // The four modes differ in *what* they announce, not in the maths: digits
  // speak each keypress, numbers speak whole operands, both does each, and off
  // must stay completely silent.
  const cases: Array<[string, string[]]> = [
    ['every-digit', ['5', 'plus', '3', 'equals', '8']],
    ['every-number', ['5 plus', '3', 'equals', '8']],
    ['both', ['5', 'plus', '5 plus', '3', '3', 'equals', '8']],
    ['off', []],
  ];

  it.each(cases)('%s reads 5 + 3 = as expected', (mode, expected) => {
    const ctx = mountTTS();
    expect(speakKeys(ctx, ['5', '+', '3', '='], {
      readoutMode: mode, language: 'en-US',
    })).toEqual(expected);
  });

  it('off stays silent for function keys too, not just digits', () => {
    const ctx = mountTTS();
    expect(speakKeys(ctx, ['9', '2root(', 'x^2', '='], {
      readoutMode: 'off', language: 'en-US',
    })).toEqual([]);
  });
});

describe('languages', () => {
  // Each language gets the same arithmetic so the words are the only variable.
  const ctxFor = () => mountTTS();

  it.each([
    ['en-US', ['5 plus', '3', 'equals', '8']],
    ['he-IL', ['5 פלוס', '3', 'שָׁוֶה', '8']],
    ['ar-SA', ['5 زائد', '3', 'يساوي', '8']],
  ])('%s reads addition in its own words', (language, expected) => {
    expect(speakKeys(ctxFor(), ['5', '+', '3', '='], {
      readoutMode: 'every-number', language,
    })).toEqual(expected);
  });

  it.each([
    ['en-US', ['5 times', '3', 'equals', '15']],
    ['he-IL', ['5 כפול', '3', 'שָׁוֶה', '15']],
    ['ar-SA', ['5 مضروب', '3', 'يساوي', '15']],
  ])('%s reads multiplication in its own words', (language, expected) => {
    expect(speakKeys(ctxFor(), ['5', '*', '3', '='], {
      readoutMode: 'every-number', language,
    })).toEqual(expected);
  });

  // The keypad's √ key emits 2root(, whose Hebrew name is the full "שורש
  // ריבועי" — the plain "שורש" belongs to sqrt(, which has no key.
  it.each([
    ['en-US', 'square root of 9'],
    ['he-IL', 'שורש ריבועי של 9'],
    ['ar-SA', 'جذر تربيعي من 9'],
  ])('%s names the square root and its own "of" connector', (language, expected) => {
    expect(speakKeys(ctxFor(), ['9', '2root('], {
      readoutMode: 'every-number', language,
    })).toEqual([expected]);
  });

  it('an unknown language falls back to English rather than going silent', () => {
    expect(speakKeys(ctxFor(), ['5', '+', '3', '='], {
      readoutMode: 'every-number', language: 'fr-FR',
    })).toEqual(['5 plus', '3', 'equals', '8']);
  });

  it('a null language falls back to English', () => {
    expect(speakKeys(ctxFor(), ['5', '+', '3', '='], {
      readoutMode: 'every-number', language: null,
    })).toEqual(['5 plus', '3', 'equals', '8']);
  });

  it('a bare language code works without a region', () => {
    expect(speakKeys(ctxFor(), ['5', '+', '3', '='], {
      readoutMode: 'every-number', language: 'he',
    })).toEqual(['5 פלוס', '3', 'שָׁוֶה', '8']);
  });
});

describe('math level', () => {
  // Only Hebrew defines young overrides; the others must be unaffected by the
  // setting rather than silently falling back to something else.
  it('young Hebrew uses the childrens words for + and ×', () => {
    const ctx = mountTTS();
    expect(speakKeys(ctx, ['5', '+', '3', '='], {
      readoutMode: 'every-number', language: 'he-IL', mathLevel: 'young',
    })).toEqual(['5 ועוד', '3', 'שָׁוֶה', '8']);
    expect(speakKeys(ctx, ['5', '*', '3', '='], {
      readoutMode: 'every-number', language: 'he-IL', mathLevel: 'young',
    })).toEqual(['5 פְּעָמִים', '3', 'שָׁוֶה', '15']);
  });

  it('standard Hebrew keeps the formal words', () => {
    const ctx = mountTTS();
    expect(speakKeys(ctx, ['5', '+', '3', '='], {
      readoutMode: 'every-number', language: 'he-IL', mathLevel: 'standard',
    })).toEqual(['5 פלוס', '3', 'שָׁוֶה', '8']);
  });

  it('young changes nothing in English, which has no overrides', () => {
    const ctx = mountTTS();
    const young = speakKeys(ctx, ['5', '*', '3', '='], {
      readoutMode: 'every-number', language: 'en-US', mathLevel: 'young',
    });
    const standard = speakKeys(ctx, ['5', '*', '3', '='], {
      readoutMode: 'every-number', language: 'en-US', mathLevel: 'standard',
    });
    expect(young).toEqual(standard);
  });

  it('the speak button honours the math level too', () => {
    expect(speakExpression('5*3', 'he-IL', 'young')).toBe('5 פְּעָמִים 3');
    expect(speakExpression('5*3', 'he-IL', 'standard')).toBe('5 כפול 3');
  });
});

describe('silent keys', () => {
  // These keys change state but have nothing to say; announcing them would
  // interrupt whatever the user is doing.
  it.each(['AC', '⌫', '+/-', '[2ND]', 'ms', 'rand'])('%s says nothing', (key) => {
    const ctx = mountTTS();
    expect(speakKeys(ctx, ['5', key], {
      readoutMode: 'every-number', language: 'en-US',
    })).toEqual([]);
  });

  it('a silent key does not suppress the keys after it', () => {
    const ctx = mountTTS();
    expect(speakKeys(ctx, ['5', 'AC', '7', '+', '2', '='], {
      readoutMode: 'every-number', language: 'en-US',
    })).toEqual(['7 plus', '2', 'equals', '9']);
  });
});

describe('angle units', () => {
  // The unit matters to the answer, so it is spoken with the angle.
  it.each([
    ['deg', 'sine of 30 degrees'],
    ['rad', 'sine of 30 radians'],
  ])('%s names the unit in English', (angleMode, expected) => {
    const ctx = mountTTS();
    spoken.length = 0;
    act(() => { ctx.loadFromConfig({ readoutMode: 'every-number', language: 'en-US' }); });
    act(() => { ctx.readout('sin(', 'sin(30)', '', angleMode as 'deg' | 'rad'); });
    expect(spoken).toEqual([expected]);
  });

  it.each([
    ['he-IL', 'סינוס של 30 מעלות'],
    ['ar-SA', 'جيب من 30 درجات'],
  ])('%s names the unit in its own words', (language, expected) => {
    const ctx = mountTTS();
    spoken.length = 0;
    act(() => { ctx.loadFromConfig({ readoutMode: 'every-number', language }); });
    act(() => { ctx.readout('sin(', 'sin(30)', '', 'deg'); });
    expect(spoken).toEqual([expected]);
  });
});

describe('results', () => {
  it('an error is read as a word, not as the raw "Error"', () => {
    const ctx = mountTTS();
    expect(speakKeys(ctx, ['5', '/', '0', '='], {
      readoutMode: 'every-number', language: 'en-US',
    })).toEqual(['5 divided by', '0', 'equals', 'error']);
  });

  it('a negative result is read with the minus as a word', () => {
    const ctx = mountTTS();
    expect(speakKeys(ctx, ['3', '-', '8', '='], {
      readoutMode: 'every-number', language: 'en-US',
    })).toEqual(['3 minus', '8', 'equals', 'minus 5']);
  });

  it('a long decimal is truncated and the remainder counted', () => {
    const ctx = mountTTS();
    expect(speakKeys(ctx, ['1', '/', '3', '='], {
      readoutMode: 'every-number', language: 'en-US', decimalDigits: 2,
    })).toEqual(['1 divided by', '3', 'equals', '0.33 and 7 more digits']);
  });
});

describe('formatResult', () => {
  // Driven directly: reaching every branch through the calculator would need
  // results with an exact number of decimals, which the arithmetic decides.
  it('leaves a whole number alone', () => {
    expect(formatResult('8', 2, 'en-US')).toBe('8');
  });

  it('leaves a short decimal alone', () => {
    expect(formatResult('0.5', 2, 'en-US')).toBe('0.5');
  });

  it('leaves a decimal of exactly the allowed length alone', () => {
    expect(formatResult('0.33', 2, 'en-US')).toBe('0.33');
  });

  it('truncates rather than rounds, so 0.999 is not read as 1', () => {
    expect(formatResult('0.9999', 2, 'en-US')).toBe('0.99 and 2 more digits');
  });

  it('says "digit" in the singular for a single remaining digit', () => {
    expect(formatResult('0.333', 2, 'en-US')).toBe('0.33 and 1 more digit');
  });

  it('reads every digit when the setting is "all"', () => {
    expect(formatResult('0.3333333', -1, 'en-US')).toBe('0.3333333');
  });

  it('counts the remaining digits in Hebrew and Arabic', () => {
    expect(formatResult('0.3333333', 2, 'he-IL')).toBe('0.33 ועוד 5 סְפָרוֹת');
    expect(formatResult('0.3333333', 2, 'ar-SA')).toBe('0.33 و 5 أرقام إضافية');
  });

  it('can drop the decimals entirely', () => {
    expect(formatResult('0.3333333', 0, 'en-US')).toBe('0. and 7 more digits');
  });
});

describe('speakableNumber', () => {
  // A leading "-" is read as a word; voices otherwise say nothing at all for it.
  it.each([
    ['en-US', 'minus 5'],
    ['he-IL', 'מינוס 5'],
    ['ar-SA', 'ناقص 5'],
  ])('%s reads a negative with its own minus word', (language, expected) => {
    expect(speakableNumber('-5', language)).toBe(expected);
  });

  it('leaves a positive number untouched', () => {
    expect(speakableNumber('5', 'en-US')).toBe('5');
  });

  it('does not mistake an internal minus for a leading one', () => {
    expect(speakableNumber('5-3', 'en-US')).toBe('5-3');
  });
});
