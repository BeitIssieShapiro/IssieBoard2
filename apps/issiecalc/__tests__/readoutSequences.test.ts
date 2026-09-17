/**
 * Whole typing sessions, asserted as the complete ordered list of spoken
 * strings. The other suites check one keypress at a time, which cannot catch a
 * key that says the right thing at the wrong moment, repeats an operand, or
 * drops one in the middle of a longer expression.
 *
 * No TTS is triggered: the module is mocked and its input compared to the
 * expected phrasing.
 */
import React from 'react';
import { create, act } from 'react-test-renderer';
import { dispatch, CalcState, readoutArgs } from '../src/services/calcDispatch';

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
 * Types a sequence and returns both the resulting state and everything said.
 *
 * "=" defers the second half of its readout ("equals", then the result) on a
 * timer, so the timers are flushed after every key rather than once at the end:
 * a user typing on after "=" leaves real time in between, and draining the
 * queue only at the end would interleave that pause into the next keypress.
 */
function session(ctx: any, keys: string[], settings: Record<string, any> = {}) {
  spoken.length = 0;
  act(() => {
    ctx.loadFromConfig({ readoutMode: 'every-number', language: 'en-US', ...settings });
  });
  let s = baseState;
  for (const key of keys) {
    const next = dispatch(s, key);
    const { expression, result } = readoutArgs(key, s, next);
    act(() => { ctx.readout(key, expression, result, next.angleMode); });
    act(() => { jest.runAllTimers(); });
    s = next;
  }
  return { state: s, said: [...spoken] };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('arithmetic sessions', () => {
  it('reads 5 + 3 = from start to finish', () => {
    const { state, said } = session(mountTTS(), ['5', '+', '3', '=']);
    expect(state.expression).toBe('5+3');
    expect(said).toEqual(['5 plus', '3', 'equals', '8']);
  });

  it('reads a chain of operators without dropping a term', () => {
    const { state, said } = session(mountTTS(), ['5', '+', '3', '*', '2', '=']);
    expect(state.expression).toBe('5+3*2');
    // Each operator announces the operand that precedes it, so every number is
    // spoken exactly once.
    expect(said).toEqual(['5 plus', '3 times', '2', 'equals', '11']);
  });

  it('speaks a multi-digit number as a whole, not digit by digit', () => {
    const { state, said } = session(mountTTS(), ['1', '2', '3', '+', '4', '5', '=']);
    expect(state.expression).toBe('123+45');
    expect(said).toEqual(['123 plus', '45', 'equals', '168']);
  });

  it('reads a decimal as one number', () => {
    const { state, said } = session(mountTTS(), ['1', '.', '5', '+', '2', '=']);
    expect(state.expression).toBe('1.5+2');
    expect(said).toEqual(['1.5 plus', '2', 'equals', '3.5']);
  });

  it('every-digit mode narrates each keypress of the same session', () => {
    const { said } = session(mountTTS(), ['1', '2', '+', '3', '='], {
      readoutMode: 'every-digit',
    });
    expect(said).toEqual(['1', '2', 'plus', '3', 'equals', '15']);
  });
});

describe('sessions with functions', () => {
  it('reads a function applied to a typed operand, then the result', () => {
    // The keypad's √ key emits 2root( — there is no sqrt( key.
    const { state, said } = session(mountTTS(), ['9', '2root(', '=']);
    expect(state.expression).toBe('2root(9)');
    // The function call already named its operand, so "=" does not repeat it.
    expect(said).toEqual(['square root of 9', 'equals', '3']);
  });

  it('reads a function inside a longer expression', () => {
    const { state, said } = session(mountTTS(), ['2', '+', '9', '2root(', '=']);
    expect(state.expression).toBe('2+2root(9)');
    expect(said).toEqual(['2 plus', 'square root of 9', 'equals', '5']);
  });

  it('reads the squared key as a postfix', () => {
    const { state, said } = session(mountTTS(), ['4', 'x^2', '=']);
    expect(state.expression).toBe('4x^2');
    expect(said).toEqual(['4 squared', 'equals', '16']);
  });

  it('reads a power template including the exponent typed after it', () => {
    const { state, said } = session(mountTTS(), ['2', 'x^(', '3', '=']);
    expect(state.expression).toBe('xpow(2,3)');
    // The key says the base, "=" supplies the exponent that nothing else spoke.
    expect(said).toEqual(['2 to the power of', '3', 'equals', '8']);
  });

  it('reads a constant-base power once, not twice', () => {
    const { state, said } = session(mountTTS(), ['3', '10^(', '=']);
    expect(state.expression).toBe('xpow(10,3)');
    // The key completes the power, so "=" must not repeat the exponent.
    expect(said).toEqual(['10 to the power of 3', 'equals', '1000']);
  });
});

describe('sessions that are corrected midway', () => {
  it('clearing resets the readout as well as the display', () => {
    const { state, said } = session(mountTTS(), ['9', '+', '9', 'AC', '2', '+', '2', '=']);
    expect(state.expression).toBe('2+2');
    // Nothing from before the clear is spoken again.
    expect(said).toEqual(['9 plus', '2 plus', '2', 'equals', '4']);
  });

  it('backspacing a digit does not re-announce the shortened number', () => {
    const { state, said } = session(mountTTS(), ['1', '2', '⌫', '+', '3', '=']);
    expect(state.expression).toBe('1+3');
    expect(said).toEqual(['1 plus', '3', 'equals', '4']);
  });

  it('continuing from a result reads the new operand', () => {
    const { state, said } = session(mountTTS(), ['5', '+', '3', '=', '+', '2', '=']);
    expect(state.expression).toBe('8+2');
    expect(said).toEqual(['5 plus', '3', 'equals', '8', '8 plus', '2', 'equals', '10']);
  });
});

describe('a session in Hebrew', () => {
  it('reads the whole sequence in Hebrew, including the result', () => {
    const { said } = session(mountTTS(), ['6', '*', '7', '='], { language: 'he-IL' });
    expect(said).toEqual(['6 כפול', '7', 'שָׁוֶה', '42']);
  });

  it('reads the same sequence in the young register', () => {
    const { said } = session(mountTTS(), ['6', '*', '7', '='], {
      language: 'he-IL', mathLevel: 'young',
    });
    expect(said).toEqual(['6 פְּעָמִים', '7', 'שָׁוֶה', '42']);
  });
});
