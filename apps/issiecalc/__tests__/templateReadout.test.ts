/**
 * Reported: pressing 8, x^y, 4 reads nothing, then = says "equals ERR".
 * Replays that exact sequence through the real dispatch + readout.
 */
import React from 'react';
import { create, act } from 'react-test-renderer';
import { dispatch, CalcState, finalizeTemplate, readoutArgs } from '../src/services/calcDispatch';
import { evaluate } from '../src/services/Calculator';

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

describe('x^y template: 8 x^y 4 =', () => {
  it('builds the template expression and computes it', () => {
    let s = dispatch(baseState, '8');
    expect(s.expression).toBe('8');
    s = dispatch(s, 'x^(');
    // \x00 marks the slot awaiting the exponent.
    expect(s.expression).toBe('xpow(8,\x00)');
    s = dispatch(s, '4');
    expect(s.expression).toBe('xpow(8,4\x00)');
    // The marker is why reading the raw expression said "error": only the
    // finalized form is parseable.
    expect(evaluate(s.expression, 'deg', 'scientific')).toBe('Error');
    expect(evaluate(finalizeTemplate(s.expression), 'deg', 'scientific')).toBe('4096');
  });

  it('announces the power key and reads the right result on =', () => {
    jest.useFakeTimers();
    const ctx = mountTTS();
    act(() => { ctx.loadFromConfig({ readoutMode: 'every-number', language: 'en' }); });

    const heard: Record<string, string[]> = {};
    let s = baseState;
    for (const key of ['8', 'x^(', '4', '=']) {
      const next = dispatch(s, key);
      spoken.length = 0;
      // The real screen logic, so reverting the fix fails this test.
      const { expression: readoutExpr, result: readoutRes } = readoutArgs(key, s, next);
      act(() => { ctx.readout(key, readoutExpr, readoutRes, next.angleMode); });
      // readout defers the second phrase via setTimeout — flush it.
      act(() => { jest.advanceTimersByTime(2000); });
      heard[key] = [...spoken];
      s = next;
    }

    // The power key announces itself instead of staying silent...
    expect(heard['x^(']).toEqual(['8 to the power']);
    // ...and "=" reads the exponent (typed after that announcement, so not yet
    // spoken) followed by the computed value, not "error".
    expect(heard['=']).toEqual(['4', 'equals', '4096']);
  });

  it.each([
    ['yroot(', 'y root of 8'],
    ['logy(', 'log base y of 8'],
  ])('%s also announces itself', (key, expected) => {
    jest.useFakeTimers();
    const ctx = mountTTS();
    act(() => { ctx.loadFromConfig({ readoutMode: 'every-number', language: 'en' }); });

    const afterDigit = dispatch(baseState, '8');
    const next = dispatch(afterDigit, key);
    spoken.length = 0;
    act(() => { ctx.readout(key, finalizeTemplate(next.expression), next.result, next.angleMode); });
    act(() => { jest.advanceTimersByTime(2000); });
    expect(spoken).toEqual([expected]);
  });
});
