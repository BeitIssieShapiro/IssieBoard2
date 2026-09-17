/**
 * The ʸ√x key: y is the index, x the radicand. 5 ʸ√ 3 is the cube root of 5.
 *
 * It used to speak the literal placeholder letter — "y root of 5" on the
 * keypress and "3 y root of 5" from the speak button, the latter also reading
 * as though 3 were a multiplier.
 */
import React from 'react';
import { create, act } from 'react-test-renderer';
import { dispatch, CalcState, finalizeTemplate, readoutArgs } from '../src/services/calcDispatch';
import { speakExpression } from '../src/services/speakExpression';
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

describe('5 ʸ√ 3 (cube root of 5)', () => {
  beforeEach(() => { spoken.length = 0; });

  it('puts the radicand first and the index second', () => {
    let s = dispatch(baseState, '5');
    s = dispatch(s, 'yroot(');
    s = dispatch(s, '3');
    const final = finalizeTemplate(s.expression);
    expect(final).toBe('yroot(5,3)');
    // 5^(1/3), not 3^(1/5) — the key is ʸ√x, so y is the index.
    expect(evaluate(final, 'deg', 'scientific')).toBe('1.70997595');
  });

  it('never speaks the placeholder letter "y"', () => {
    jest.useFakeTimers();
    const ctx = mountTTS();
    act(() => { ctx.loadFromConfig({ readoutMode: 'every-number', language: 'en' }); });

    let s = dispatch(baseState, '5');
    const heard: Record<string, string[]> = {};
    for (const key of ['yroot(', '3', '=']) {
      const next = dispatch(s, key);
      spoken.length = 0;
      const args = readoutArgs(key, s, next);
      act(() => { ctx.readout(key, args.expression, args.result, next.angleMode); });
      act(() => { jest.advanceTimersByTime(3000); });
      heard[key] = [...spoken];
      s = next;
    }
    // The index is not known yet when the key is pressed.
    expect(heard['yroot(']).toEqual(['root of 5']);
    // "=" names the root now that the index is known, rather than saying "3".
    expect(heard['=']).toEqual(['cube root of 5', 'equals', '1.70 and 6 more digits']);
    expect(heard['yroot('].join(' ')).not.toMatch(/\by\b/);
  });

  it.each([
    // Index 2 and 3 have their own words; 4+ use an ordinal.
    ['yroot(5,3)', 'en', 'cube root of 5'],
    ['yroot(5,2)', 'en', 'square root of 5'],
    ['yroot(5,4)', 'en', 'fourth root of 5'],
    ['yroot(5,3)', 'he', 'שורש שלישי של 5'],
    ['yroot(5,2)', 'he', 'שורש ריבועי של 5'],
    ['yroot(5,3)', 'ar', 'جذر تكعيبي من 5'],
    // No ordinal word that high — fall back to the plain number.
    ['yroot(5,12)', 'en', 'root 12 of 5'],
    ['yroot(5,12)', 'he', 'שורש 12 של 5'],
    // logᵧ shares the placeholder problem: log base 2 of 8, not "log base y".
    ['logy(8,2)', 'en', 'log base 2 of 8'],
  ])('speak button reads %s in %s', (expr, language, expected) => {
    expect(speakExpression(expr, language)).toBe(expected);
  });

  it('matches the dedicated ³√x key for the same root', () => {
    // 5 ʸ√ 3 and 3root(5) are the same operation, so they must read alike.
    expect(speakExpression('yroot(5,3)', 'en')).toBe(speakExpression('3root(5)', 'en'));
    expect(speakExpression('yroot(5,3)', 'he')).toBe(speakExpression('3root(5)', 'he'));
  });
});
