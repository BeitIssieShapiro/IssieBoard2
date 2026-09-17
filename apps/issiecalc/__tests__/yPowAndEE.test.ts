/**
 * yˣ and EE, added to match Apple's scientific keypad.
 *
 * yˣ is the mirror of xʸ: the number already typed is the exponent, and the
 * one typed next is the base. EE enters scientific notation (5 EE 3 = 5000).
 */
import { dispatch, CalcState, finalizeTemplate } from '../src/services/calcDispatch';
import { evaluate } from '../src/services/Calculator';

// speakExpression reaches CalcTTSContext → react-native-tts, which needs a
// native module the test environment has no stand-in for.
jest.mock('../../issievoice/src/services/TextToSpeech', () => ({
  __esModule: true,
  default: {
    initialize: () => Promise.resolve(),
    speak: () => Promise.resolve(),
    setLanguage: () => Promise.resolve(),
    setVoice: () => Promise.resolve(),
    setRate: () => {},
    setPitch: () => {},
  },
}));

const baseState: CalcState = {
  expression: '', result: '', resultMode: false,
  angleMode: 'deg', keyset: 'scientific', memory: '', templateMode: false,
};

const play = (keys: string[]) => keys.reduce((s, k) => dispatch(s, k), baseState);

describe('yˣ', () => {
  it('builds a template with the typed number as the exponent', () => {
    const s = play(['3', 'y^(']);
    expect(s.expression).toBe('ypow(3,\x00)');
    expect(s.templateMode).toBe(true);
  });

  it('2 yˣ 3 is 3² = 9, the mirror of xʸ', () => {
    const s = play(['2', 'y^(', '3']);
    const final = finalizeTemplate(s.expression);
    expect(final).toBe('ypow(2,3)');
    // y to the x: base 3, exponent 2.
    expect(evaluate(final, 'deg', 'scientific')).toBe('9');
    // xʸ with the same keys is the other way round: 2³ = 8.
    expect(evaluate('xpow(2,3)', 'deg', 'scientific')).toBe('8');
  });

  it('needs an operand, like the other template keys', () => {
    expect(play(['y^(']).expression).toBe('ypow(,\x00)');
  });
});

describe('EE', () => {
  it('5 EE 3 is 5000', () => {
    const s = play(['5', 'EE', '3']);
    expect(s.expression).toBe('5E+3');
    expect(evaluate(s.expression, 'deg', 'scientific')).toBe('5000');
  });

  it('works mid-expression', () => {
    const s = play(['1', '+', '2', 'EE', '2']);
    expect(s.expression).toBe('1+2E+2');
    expect(evaluate(s.expression, 'deg', 'scientific')).toBe('201');
  });

  it('is ignored without a mantissa', () => {
    expect(play(['EE']).expression).toBe('');
    expect(play(['+', 'EE']).expression).toBe('+');
  });

  it('allows only one E per number', () => {
    const s = play(['5', 'EE', '3', 'EE']);
    expect(s.expression).toBe('5E+3');
  });
});

describe('speaking yˣ and EE', () => {
  const { speakExpression } = require('../src/services/speakExpression');

  it.each([
    // Read in written order: base, then exponent.
    ['ypow(2,3)', 'en', '3 to the power of 2'],
    ['ypow(2,3)', 'he', '3 בחזקת 2'],
    ['xpow(2,3)', 'en', '2 to the power of 3'],
  ])('%s in %s reads "%s"', (expr, lang, expected) => {
    expect(speakExpression(expr, lang)).toBe(expected);
  });
});
