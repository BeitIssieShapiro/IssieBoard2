/**
 * Reported: 10^x and 2^x don't use the template feature and read as a mess.
 * Unlike x^( these are prefix functions — the exponent is typed after them —
 * so they produce 10^(5) rather than a two-argument template call.
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

describe('10^x / 2^x (prefix powers)', () => {
  beforeEach(() => { spoken.length = 0; });

  /** Types the key then the digits, returning what was spoken per keypress. */
  function play(keys: string[]): Record<string, string[]> {
    jest.useFakeTimers();
    const ctx = mountTTS();
    act(() => { ctx.loadFromConfig({ readoutMode: 'every-number', language: 'en' }); });

    const heard: Record<string, string[]> = {};
    let s = baseState;
    for (const key of keys) {
      const next = dispatch(s, key);
      spoken.length = 0;
      const args = readoutArgs(key, s, next);
      act(() => { ctx.readout(key, args.expression, args.result, next.angleMode); });
      act(() => { jest.advanceTimersByTime(3000); });
      heard[key] = [...spoken];
      s = next;
    }
    return heard;
  }

  // The number already typed becomes the exponent (3 then 10ˣ → 10³), so the
  // key announces the finished power and "=" only adds the result.
  it.each([
    ['10^(', '10 to the power of 3', '1000'],
    ['2^(', '2 to the power of 3', '8'],
    // Truncated to the default 2 decimal digits by the readout settings.
    ['e^(', 'e to the power of 3', '20.08 and 5 more digits'],
  ])('%s announces the whole power', (key, announced, expected) => {
    const heard = play(['3', key, '=']);
    expect(heard[key]).toEqual([announced]);
    expect(heard['=']).toEqual(['equals', expected]);
  });

  it.each([
    ['xpow(10,5)', '10 to the power of 5'],
    ['xpow(2,5)', '2 to the power of 5'],
    ['xpow(e,5)', 'e to the power of 5'],
    ['3*xpow(10,5)', '3 times 10 to the power of 5'],
  ])('speak button reads %s', (expr, expected) => {
    expect(speakExpression(expr, 'en')).toBe(expected);
  });
});
