/**
 * Reproduces the reported bug: typing 8 then 3root( must read
 * "cube root of 8", not "cube root of 3root 8".
 *
 * Drives the real dispatch + readout, so the strings under test are whatever
 * the app actually produces rather than a hand-written guess.
 */
import React from 'react';
import { create, act } from 'react-test-renderer';
import { dispatch, CalcState } from '../src/services/calcDispatch';

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

// Imported after the mock so the provider picks it up.
const { CalcTTSProvider, useCalcTTS } = require('../src/context/CalcTTSContext');

const baseState: CalcState = {
  expression: '', result: '', resultMode: false,
  angleMode: 'deg', keyset: 'scientific', memory: '', templateMode: false,
};

/** Renders the provider and hands back its context value. */
function mountTTS(): any {
  let ctx: any;
  const Probe = () => { ctx = useCalcTTS(); return null; };
  act(() => { create(React.createElement(CalcTTSProvider, null, React.createElement(Probe))); });
  return ctx;
}

describe('per-key readout of a wrapping function', () => {
  beforeEach(() => { spoken.length = 0; });

  it('dispatch wraps the existing operand', () => {
    const afterDigit = dispatch(baseState, '8');
    expect(afterDigit.expression).toBe('8');
    expect(dispatch(afterDigit, '3root(').expression).toBe('3root(8)');
  });

  it.each([
    ['3root(', '8', 'cube root of 8'],
    ['2root(', '9', 'square root of 9'],
    ['log2(', '8', 'log base 2 of 8'],
    ['sin(', '30', 'sine of 30 degrees'],
  ])('%s after %s reads "%s"', (key, digits, expected) => {
    const ctx = mountTTS();
    act(() => { ctx.loadFromConfig({ readoutMode: 'every-number', language: 'en' }); });

    let state = baseState;
    for (const d of digits) state = dispatch(state, d);
    const after = dispatch(state, key);

    act(() => { ctx.readout(key, after.expression, after.result, after.angleMode); });
    expect(spoken).toEqual([expected]);
  });
});
