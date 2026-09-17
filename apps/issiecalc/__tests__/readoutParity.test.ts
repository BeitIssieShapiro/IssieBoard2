/**
 * The two readout flows against each other.
 *
 * CalcTTSContext's closing comment states the intent: the speak button should
 * phrase a call ("cube root of 8", "5 factorial") exactly as the per-key
 * readout does. Nothing enforced that, so the two could drift apart — this
 * pins the cases where they must agree.
 *
 * They are not expected to agree everywhere. Typing is incremental and speaks
 * as each key lands, so it cannot name an operand that has not been typed yet;
 * the button reads a finished expression. Those divergences are asserted here
 * too, as the intended behaviour rather than as parity, so that a change to
 * either flow has to confront them.
 *
 * No TTS is triggered: the module is mocked and its input compared.
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

/**
 * Types `keys` and returns what each flow would say for the result: everything
 * the per-key readout spoke, and what the speak button would read for the
 * expression left on the display.
 */
function bothFlows(keys: string[], language = 'en-US', mathLevel = 'standard') {
  const ctx = mountTTS();
  spoken.length = 0;
  act(() => { ctx.loadFromConfig({ readoutMode: 'every-number', language, mathLevel }); });
  let s = baseState;
  for (const key of keys) {
    const next = dispatch(s, key);
    const { expression, result } = readoutArgs(key, s, next);
    act(() => { ctx.readout(key, expression, result, next.angleMode); });
    act(() => { jest.runAllTimers(); });
    s = next;
  }
  // The display shows the finalized expression — the button never sees the
  // template marker.
  const expression = finalizeTemplate(s.expression);
  return {
    expression,
    typing: [...spoken],
    button: speakExpression(expression, language, mathLevel as any),
  };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('the flows agree on completed calls', () => {
  // Each of these is complete the moment the key is pressed: the operand was
  // already on screen, so both flows have the same information and must
  // produce the same words.
  it.each([
    // The keypad's √ and ∛ keys emit 2root(/3root( — there is no sqrt( key.
    [['9', '2root('], 'square root of 9'],
    [['8', '3root('], 'cube root of 8'],
    [['5', 'factorial('], '5 factorial'],
    [['7', '1/('], '1 over 7'],
    [['4', 'x^2'], '4 squared'],
    [['4', 'x^3'], '4 cubed'],
    [['3', '10^('], '10 to the power of 3'],
    [['3', '2^('], '2 to the power of 3'],
  ])('%j reads the same both ways', (keys, expected) => {
    const { typing, button } = bothFlows(keys as string[]);
    expect(typing).toEqual([expected]);
    expect(button).toBe(expected);
  });

  it.each([
    ['he-IL', ['8', '3root('], 'שורש שלישי של 8'],
    ['ar-SA', ['8', '3root('], 'جذر تكعيبي من 8'],
    ['he-IL', ['7', '1/('], '1 חלקי 7'],
    ['ar-SA', ['5', 'factorial('], '5 مضروب'],
  ])('%s keeps the flows in step for %j', (language, keys, expected) => {
    const { typing, button } = bothFlows(keys as string[], language as string);
    expect(typing).toEqual([expected]);
    expect(button).toBe(expected);
  });
});

describe('the flows diverge where typing cannot know the rest', () => {
  // Not parity failures: the key is pressed before the second operand exists,
  // so typing announces what it has and the button reads the finished form.
  it('a power template: typing leaves the exponent open, the button has it', () => {
    const { expression, typing, button } = bothFlows(['2', 'x^(', '3']);
    expect(expression).toBe('xpow(2,3)');
    expect(typing).toEqual(['2 to the power of']);
    expect(button).toBe('2 to the power of 3');
  });

  it('a root template: typing has no index yet, the button names the root', () => {
    const { expression, typing, button } = bothFlows(['5', 'yroot(', '3']);
    expect(expression).toBe('yroot(5,3)');
    // "root of 5" — the index is still being typed.
    expect(typing).toEqual(['root of 5']);
    expect(button).toBe('cube root of 5');
  });

  it('a log template: typing says the placeholder base, the button the real one', () => {
    const { expression, typing, button } = bothFlows(['8', 'logy(', '2']);
    expect(expression).toBe('logy(8,2)');
    expect(typing).toEqual(['log base y of 8']);
    expect(button).toBe('log base 2 of 8');
  });

  it('an operator: typing stops at the operator, the button reads both sides', () => {
    const { typing, button } = bothFlows(['5', '+', '3']);
    expect(typing).toEqual(['5 plus']);
    expect(button).toBe('5 plus 3');
  });

  it('only the typing flow says the angle unit, which it is given and the expression does not record', () => {
    const { typing, button } = bothFlows(['3', '0', 'sin(']);
    expect(typing).toEqual(['sine of 30 degrees']);
    expect(button).toBe('sine of 30');
  });
});

describe('scientific notation is read wrong by both flows', () => {
  // Two real defects, pinned so they are not mistaken for intended behaviour.
  // Both are in this file because EE is where the flows fail *together*.
  it.failing('EE should be announced while typing', () => {
    // 'EE' has a translation in all three languages ("times ten to the"), but
    // it is in neither OPERATOR_KEYS nor WRAPPING_FUNCTIONS, so the
    // every-number branch never reaches it and the key is silent. It is spoken
    // in every-digit and both, which is what makes this look like an omission
    // rather than a decision.
    const { typing } = bothFlows(['5', 'EE', '3']);
    expect(typing).toEqual(['5 times ten to the']);
  });

  it.failing('the speak button should read 5E+3 as a power of ten', () => {
    // speakExpression has no case for the E+nn literal that EE produces, so it
    // tokenizes it as text: the "E" is passed through and the "+" becomes
    // "plus", giving "5E plus 3" for what is 5×10³.
    const { expression, button } = bothFlows(['5', 'EE', '3']);
    expect(expression).toBe('5E+3');
    expect(button).toBe('5 times ten to the power of 3');
  });

  it('records what the two flows currently do with EE', () => {
    // The companion to the two failing tests above: this is today's behaviour,
    // so a fix makes this one fail and forces both to be updated together.
    const { expression, typing, button } = bothFlows(['5', 'EE', '3']);
    expect(expression).toBe('5E+3');
    expect(typing).toEqual([]);
    expect(button).toBe('5E plus 3');
  });

  it('EE is announced in the other readout modes', () => {
    const ctx = mountTTS();
    spoken.length = 0;
    act(() => { ctx.loadFromConfig({ readoutMode: 'every-digit', language: 'en-US' }); });
    act(() => { ctx.readout('EE', '5E+', ''); });
    expect(spoken).toEqual(['times ten to the']);
  });
});

describe('the flows agree on a finished expression after "="', () => {
  // After "=" the display holds the whole expression, so pressing speak reads
  // it in full — this is the pairing the speak button was built for.
  it('reads the expression and its result', () => {
    const { expression, button } = bothFlows(['9', '2root(', '=']);
    expect(expression).toBe('2root(9)');
    expect(button).toBe('square root of 9');
  });

  it('reads a nested call without inventing words', () => {
    // Driven directly rather than typed: the parenthesised argument is what
    // matters here, and it keeps the closing paren where a bare number would
    // have dropped it.
    expect(speakExpression('2root(2+3)', 'en-US', 'standard'))
      .toBe('square root 2 plus 3 close parenthesis');
  });

  it('still names sqrt(, which has a translation but no key of its own', () => {
    // Reachable only from a config that uses it, so it is exercised directly.
    expect(speakExpression('sqrt(9)', 'en-US', 'standard')).toBe('square root of 9');
  });

  it('reads an empty expression as nothing, leaving the caller to say "0"', () => {
    expect(speakExpression('', 'en-US', 'standard')).toBe('');
  });
});
