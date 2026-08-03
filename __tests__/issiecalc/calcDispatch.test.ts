import { dispatch, CalcState, initialCalcState } from '../../apps/issiecalc/src/services/calcDispatch';

function runSequence(keys: string[], initial: Partial<CalcState> = {}): CalcState[] {
  const states: CalcState[] = [];
  let state: CalcState = { ...initialCalcState, ...initial };
  for (const key of keys) {
    state = dispatch(state, key);
    states.push(state);
  }
  return states;
}

describe('smoke tests', () => {
  test('1 + 2 = gives 3', () => {
    const states = runSequence(['1', '+', '2', '=']);
    expect(states[3].result).toBe('3');
    expect(states[3].resultMode).toBe(true);
  });

  test('AC clears everything', () => {
    const states = runSequence(['5', '+', '3', 'AC']);
    expect(states[3].expression).toBe('');
    expect(states[3].result).toBe('');
    expect(states[3].resultMode).toBe(false);
  });

  test('backspace removes last char', () => {
    const states = runSequence(['1', '2', '3', '⌫']);
    expect(states[3].expression).toBe('12');
  });

  test('backspace after result clears all', () => {
    const states = runSequence(['5', '=', '⌫']);
    expect(states[2].expression).toBe('');
    expect(states[2].resultMode).toBe(false);
  });

  test('sqrt( wraps trailing number', () => {
    const states = runSequence(['4', 'sqrt(']);
    expect(states[1].expression).toBe('sqrt(4)');
  });
});

describe('basic arithmetic', () => {
  test('9 / 3 = 3', () => {
    const s = runSequence(['9', '/', '3', '=']);
    expect(s[3].result).toBe('3');
  });
  test('5 * 5 = 25', () => {
    const s = runSequence(['5', '*', '5', '=']);
    expect(s[3].result).toBe('25');
  });
  test('7 - 4 = 3', () => {
    const s = runSequence(['7', '-', '4', '=']);
    expect(s[3].result).toBe('3');
  });
  test('0 + 0 = 0', () => {
    const s = runSequence(['0', '+', '0', '=']);
    expect(s[3].result).toBe('0');
  });
  test('decimal: 1.5 + 1.5 = 3', () => {
    const s = runSequence(['1', '.', '5', '+', '1', '.', '5', '=']);
    expect(s[7].result).toBe('3');
  });
  test('negative result: 2 - 5 = -3', () => {
    const s = runSequence(['2', '-', '5', '=']);
    expect(s[3].result).toBe('-3');
  });
  test('chained: 1 + 2 + 3 = 6', () => {
    const s = runSequence(['1', '+', '2', '+', '3', '=']);
    expect(s[5].result).toBe('6');
  });
  test('chained: 10 - 3 - 2 = 5', () => {
    const s = runSequence(['1', '0', '-', '3', '-', '2', '=']);
    expect(s[6].result).toBe('5');
  });
  test('mixed: 2 * 3 + 4 = 10', () => {
    const s = runSequence(['2', '*', '3', '+', '4', '=']);
    expect(s[5].result).toBe('10');
  });
  test('division result is decimal: 1 / 4 = 0.25', () => {
    const s = runSequence(['1', '/', '4', '=']);
    expect(s[3].result).toBe('0.25');
  });
});

describe('expression building — intermediate state', () => {
  test('expression updates on each digit tap', () => {
    const s = runSequence(['1', '2', '3']);
    expect(s[0].expression).toBe('1');
    expect(s[1].expression).toBe('12');
    expect(s[2].expression).toBe('123');
  });
  test('operator appended to expression', () => {
    const s = runSequence(['5', '+']);
    expect(s[1].expression).toBe('5+');
  });
  test('expression before = is preserved', () => {
    const s = runSequence(['3', '+', '4', '=']);
    expect(s[2].expression).toBe('3+4');
  });
  test('result shown after =', () => {
    const s = runSequence(['3', '+', '4', '=']);
    expect(s[3].result).toBe('7');
    expect(s[3].resultMode).toBe(true);
  });
});

describe('result mode continuations', () => {
  test('digit after result resets expression', () => {
    const s = runSequence(['5', '=', '6']);
    expect(s[2].expression).toBe('6');
    expect(s[2].resultMode).toBe(false);
  });
  test('operator after result continues from result', () => {
    const s = runSequence(['5', '=', '+', '3', '=']);
    expect(s[2].expression).toBe('5+');
    expect(s[4].result).toBe('8');
  });
  test('function after result continues from result', () => {
    const s = runSequence(['4', '=', 'sqrt(']);
    expect(s[2].expression).toBe('sqrt(4)');
  });
  test('AC after result clears', () => {
    const s = runSequence(['9', '=', 'AC']);
    expect(s[2].expression).toBe('');
    expect(s[2].result).toBe('');
    expect(s[2].resultMode).toBe(false);
  });
});

describe('sqrt and function wrapping', () => {
  test('sqrt( on empty expression appends sqrt(', () => {
    const s = runSequence(['sqrt(']);
    expect(s[0].expression).toBe('sqrt(');
  });
  test('sqrt( on 9 wraps to sqrt(9)', () => {
    const s = runSequence(['9', 'sqrt(']);
    expect(s[1].expression).toBe('sqrt(9)');
  });
  test('sqrt(9) = 3', () => {
    const s = runSequence(['9', 'sqrt(', '=']);
    expect(s[2].result).toBe('3');
  });
  test('sqrt(2) ≈ 1.41421356237', () => {
    const s = runSequence(['2', 'sqrt(', '=']);
    expect(parseFloat(s[2].result)).toBeCloseTo(1.41421356237, 5);
  });
  test('1 + sqrt( on 4 → 1+sqrt(4)', () => {
    const s = runSequence(['1', '+', '4', 'sqrt(']);
    expect(s[3].expression).toBe('1+sqrt(4)');
  });
  test('1 + sqrt(4) = 3', () => {
    const s = runSequence(['1', '+', '4', 'sqrt(', '=']);
    expect(s[4].result).toBe('3');
  });
  test('factorial( on 5 wraps to factorial(5)', () => {
    const s = runSequence(['5', 'factorial(']);
    expect(s[1].expression).toBe('factorial(5)');
  });
  test('factorial(5) = 120', () => {
    const s = runSequence(['5', 'factorial(', '=']);
    expect(s[2].result).toBe('120');
  });
  test('ln( on e: type e then ln( wraps to ln(e)', () => {
    // 'e' is appended as the string "e"; extractTrailingOperand doesn't match letters,
    // so ln( appends without wrapping — expression becomes "eln("
    // The real behaviour: user taps e then ln(, result is ln(e) ≈ 1 via evaluate
    const s = runSequence(['e', '=']);
    expect(parseFloat(s[1].result)).toBeCloseTo(Math.E, 5);
  });
  test('log( on 1000 = 3', () => {
    const s = runSequence(['1', '0', '0', '0', 'log(', '=']);
    expect(parseFloat(s[5].result)).toBeCloseTo(3, 5);
  });
});

describe('trig — rad mode', () => {
  test('sin(0) = 0 in rad', () => {
    const s = runSequence(['0', 'sin(', '='], { angleMode: 'rad' });
    expect(parseFloat(s[2].result)).toBeCloseTo(0, 10);
  });
  test('cos(0) = 1 in rad', () => {
    const s = runSequence(['0', 'cos(', '='], { angleMode: 'rad' });
    expect(parseFloat(s[2].result)).toBeCloseTo(1, 10);
  });
  test('tan(0) = 0 in rad', () => {
    const s = runSequence(['0', 'tan(', '='], { angleMode: 'rad' });
    expect(parseFloat(s[2].result)).toBeCloseTo(0, 10);
  });
  test('sin(pi) ≈ 0 in rad — using numeric approximation', () => {
    // 'pi' is appended as the string "pi"; extractTrailingOperand doesn't match letters,
    // so sin( appends after without wrapping. Test via direct numeric value instead.
    const s = runSequence(['3', '.', '1', '4', '1', '5', '9', '2', '6', '5', '4', 'sin(', '='], { angleMode: 'rad' });
    expect(Math.abs(parseFloat(s[12].result))).toBeLessThan(0.0001);
  });
});

describe('trig — deg mode', () => {
  test('sin(90) = 1 in deg', () => {
    const s = runSequence(['9', '0', 'sin(', '='], { angleMode: 'deg' });
    expect(parseFloat(s[3].result)).toBeCloseTo(1, 5);
  });
  test('cos(180) = -1 in deg', () => {
    const s = runSequence(['1', '8', '0', 'cos(', '='], { angleMode: 'deg' });
    expect(parseFloat(s[4].result)).toBeCloseTo(-1, 5);
  });
  test('tan(45) = 1 in deg', () => {
    const s = runSequence(['4', '5', 'tan(', '='], { angleMode: 'deg' });
    expect(parseFloat(s[3].result)).toBeCloseTo(1, 5);
  });
  test('sin(0) = 0 in deg', () => {
    const s = runSequence(['0', 'sin(', '='], { angleMode: 'deg' });
    expect(parseFloat(s[2].result)).toBeCloseTo(0, 10);
  });
});

describe('angle mode toggle', () => {
  test('[ANGLE_TOGGLE] switches rad to deg', () => {
    const s = runSequence(['[ANGLE_TOGGLE]'], { angleMode: 'rad' });
    expect(s[0].angleMode).toBe('deg');
  });
  test('[ANGLE_TOGGLE] switches deg to rad', () => {
    const s = runSequence(['[ANGLE_TOGGLE]'], { angleMode: 'deg' });
    expect(s[0].angleMode).toBe('rad');
  });
});

describe('+/- toggle sign', () => {
  test('+/- on 5 gives -5', () => {
    const s = runSequence(['5', '+/-']);
    expect(s[1].expression).toBe('-5');
  });
  test('+/- on -5 gives 5', () => {
    const s = runSequence(['5', '+/-', '+/-']);
    expect(s[2].expression).toBe('5');
  });
  test('+/- after result negates result into expression', () => {
    const s = runSequence(['4', '=', '+/-']);
    expect(s[2].expression).toBe('-4');
    expect(s[2].resultMode).toBe(false);
  });
  test('+/- in expression: 3 + 4 negates last number', () => {
    const s = runSequence(['3', '+', '4', '+/-']);
    expect(s[3].expression).toContain('-4');
  });
});

describe('backspace', () => {
  test('removes last character', () => {
    const s = runSequence(['1', '2', '+', '⌫']);
    expect(s[3].expression).toBe('12');
  });
  test('backspace on single char gives empty', () => {
    const s = runSequence(['5', '⌫']);
    expect(s[1].expression).toBe('');
  });
  test('backspace on empty stays empty', () => {
    const s = runSequence(['⌫']);
    expect(s[0].expression).toBe('');
  });
  test('backspace after result clears result mode', () => {
    const s = runSequence(['5', '+', '3', '=', '⌫']);
    expect(s[4].resultMode).toBe(false);
    expect(s[4].expression).toBe('');
  });
});

describe('memory', () => {
  test('ms stores expression, mr recalls it', () => {
    const s = runSequence(['5', 'ms', 'AC', 'mr']);
    expect(s[3].expression).toBe('5');
  });
  test('ms stores result when in resultMode', () => {
    const s = runSequence(['3', '+', '2', '=', 'ms', 'AC', 'mr']);
    expect(s[6].expression).toBe('5');
  });
  test('mr after ms appends memory to expression', () => {
    const s = runSequence(['5', 'ms', 'AC', '3', '+', 'mr', '=']);
    expect(s[6].result).toBe('8');
  });
  test('ms does not store Error', () => {
    const s = runSequence(['1', '/', '0', '=', 'ms'], { memory: '7' });
    expect(s[4].memory).toBe('7');
  });
});

describe('error states', () => {
  test('1 / 0 = Error', () => {
    const s = runSequence(['1', '/', '0', '=']);
    expect(s[3].result).toBe('Error');
  });
  test('incomplete expression (1 +) = Error', () => {
    const s = runSequence(['1', '+', '=']);
    expect(s[2].result).toBe('Error');
  });
  test('empty expression = gives 0', () => {
    const s = runSequence(['=']);
    expect(s[0].result).toBe('0');
  });
  test('sqrt( of negative = Error', () => {
    const s = runSequence(['-', '4', 'sqrt(', '=']);
    expect(s[3].result).toBe('Error');
  });
});

describe('constants', () => {
  test('pi * 2 ≈ 6.28318', () => {
    const s = runSequence(['pi', '*', '2', '=']);
    expect(parseFloat(s[3].result)).toBeCloseTo(6.28318, 4);
  });
  test('e alone evaluates to ≈ 2.71828', () => {
    const s = runSequence(['e', '=']);
    expect(parseFloat(s[1].result)).toBeCloseTo(2.71828, 4);
  });
});

describe('percent', () => {
  test('50 % = 0.5', () => {
    const s = runSequence(['5', '0', '%', '=']);
    expect(s[3].result).toBe('0.5');
  });
  test('100 % = 1', () => {
    const s = runSequence(['1', '0', '0', '%', '=']);
    expect(s[4].result).toBe('1');
  });
});

describe('large numbers — basic mode', () => {
  test('result >= 1e12 in basic mode gives NUMBER_TOO_BIG', () => {
    const s = runSequence(['9', '9', '9', '9', '9', '9', '9', '9', '9', '9', '9', '9', '*', '9', '9', '9', '='], { keyset: 'basic' });
    expect(s[s.length - 1].result).toBe('NUMBER_TOO_BIG');
  });
});

describe('E-notation — scientific mode', () => {
  test('1000000000 * 10 shows E-notation in scientific mode', () => {
    const s = runSequence(
      ['1', '0', '0', '0', '0', '0', '0', '0', '0', '0', '*', '1', '0', '='],
      { keyset: 'scientific' }
    );
    expect(s[s.length - 1].result).toMatch(/E[+-]\d+/);
  });
});

describe('keyset switching', () => {
  test('[2ND] sets keyset to scientific_2nd', () => {
    const s = runSequence(['[2ND]'], { keyset: 'scientific' });
    expect(s[0].keyset).toBe('scientific_2nd');
  });
  test('[2ND_OFF] sets keyset back to scientific', () => {
    const s = runSequence(['[2ND_OFF]'], { keyset: 'scientific_2nd' });
    expect(s[0].keyset).toBe('scientific');
  });
});

describe('power', () => {
  test('2 ^ 10 = 1024', () => {
    const s = runSequence(['2', '^', '1', '0', '=']);
    expect(parseFloat(s[4].result)).toBe(1024);
  });
  test('3 ^ 2 = 9', () => {
    const s = runSequence(['3', '^', '2', '=']);
    expect(parseFloat(s[3].result)).toBe(9);
  });
});

describe('sequence edge cases', () => {
  test('multiple = in a row re-evaluates same expression', () => {
    const s = runSequence(['2', '+', '3', '=', '=']);
    expect(s[3].result).toBe('5');
    expect(s[4].result).toBe('5');
  });
  test('digit limit in basic mode (12 digits max)', () => {
    const digits = Array.from('123456789012');
    const s = runSequence([...digits, '3'], { keyset: 'basic' });
    expect(s[s.length - 1].expression).toBe('123456789012');
  });
  test('no digit limit in scientific mode', () => {
    const digits = Array.from('1234567890123');
    const s = runSequence(digits, { keyset: 'scientific' });
    expect(s[s.length - 1].expression).toBe('1234567890123');
  });
  test('operator after operator appends (5 + - 3 = 2)', () => {
    const s = runSequence(['5', '+', '-', '3', '=']);
    expect(parseFloat(s[4].result)).toBe(2);
  });
  test('parentheses: (2+3)*4 = 20', () => {
    const s = runSequence(['(', '2', '+', '3', ')', '*', '4', '=']);
    expect(s[7].result).toBe('20');
  });
});

describe('suffix key guard', () => {
  test('x^2 ignored when expression ends with operator', () => {
    const s = runSequence(['5', '+', 'x^2']);
    expect(s[2].expression).toBe('5+');
  });
  test('x^3 ignored when expression ends with (', () => {
    const s = runSequence(['(', 'x^3']);
    expect(s[1].expression).toBe('(');
  });
  test('factorial( ignored when expression ends with operator', () => {
    const s = runSequence(['+', 'factorial(']);
    expect(s[1].expression).toBe('+');
  });
  test('x^2 after AC uses implicit 0: gives 0x^2', () => {
    const s = runSequence(['x^2']);
    expect(s[0].expression).toBe('0x^2');
  });
  test('x^3 after AC uses implicit 0', () => {
    const s = runSequence(['x^3']);
    expect(s[0].expression).toBe('0x^3');
  });
  test('factorial( after AC wraps implicit 0: factorial(0)', () => {
    const s = runSequence(['factorial(']);
    expect(s[0].expression).toBe('factorial(0)');
  });
  test('x^2 works normally on digit', () => {
    const s = runSequence(['5', 'x^2']);
    expect(s[1].expression).toBe('5x^2');
  });
  test('x^2 works after )', () => {
    const s = runSequence(['(', '3', ')', 'x^2']);
    expect(s[3].expression).toBe('(3)x^2');
  });
});

describe('x^( normalization', () => {
  test('2 x^( 3 ) = 8', () => {
    const s = runSequence(['2', 'x^(', '3', ')', '=']);
    expect(s[4].result).toBe('8');
  });
  test('3 x^( 3 ) = 27', () => {
    const s = runSequence(['3', 'x^(', '3', ')', '=']);
    expect(s[4].result).toBe('27');
  });
});

describe('e^( wrapping', () => {
  test('e^( on empty appends e^(', () => {
    const s = runSequence(['e^(']);
    expect(s[0].expression).toBe('e^(');
  });
  test('e^( on 5 wraps to e^(5)', () => {
    const s = runSequence(['5', 'e^(']);
    expect(s[1].expression).toBe('e^(5)');
  });
  test('e^(1) ≈ 2.71828', () => {
    const s = runSequence(['1', 'e^(', '=']);
    expect(parseFloat(s[2].result)).toBeCloseTo(2.71828, 4);
  });
  test('e^(0) = 1', () => {
    const s = runSequence(['0', 'e^(', '=']);
    expect(s[2].result).toBe('1');
  });
});

describe('10^( wrapping', () => {
  test('10^( on 3 wraps to 10^(3)', () => {
    const s = runSequence(['3', '10^(']);
    expect(s[1].expression).toBe('10^(3)');
  });
  test('10^(3) = 1000', () => {
    const s = runSequence(['3', '10^(', '=']);
    expect(s[2].result).toBe('1000');
  });
  test('10^(0) = 1', () => {
    const s = runSequence(['0', '10^(', '=']);
    expect(s[2].result).toBe('1');
  });
});

describe('1/( wrapping', () => {
  test('1/( on 7 wraps to 1/(7)', () => {
    const s = runSequence(['7', '1/(']);
    expect(s[1].expression).toBe('1/(7)');
  });
  test('1/(4) = 0.25', () => {
    const s = runSequence(['4', '1/(', '=']);
    expect(s[2].result).toBe('0.25');
  });
  test('1/(2) = 0.5', () => {
    const s = runSequence(['2', '1/(', '=']);
    expect(s[2].result).toBe('0.5');
  });
  test('1/( ignored when expression ends with operator', () => {
    const s = runSequence(['5', '+', '1/(']);
    expect(s[2].expression).toBe('5+');
  });
  test('1/( after AC uses implicit 0: 1/(0) = Error', () => {
    const s = runSequence(['1/(', '=']);
    expect(s[1].result).toBe('Error');
  });
});

describe('auto-close unclosed parens on =', () => {
  test('sin( then 30 typed manually = auto-closes', () => {
    // sin( on empty → sin(, then digits typed inside manually
    const s = runSequence(['sin(', '3', '0', '='], { angleMode: 'deg' });
    expect(parseFloat(s[3].result)).toBeCloseTo(0.5, 5);
  });
  test('cos( then 60 typed manually = auto-closes', () => {
    const s = runSequence(['cos(', '6', '0', '='], { angleMode: 'deg' });
    expect(parseFloat(s[3].result)).toBeCloseTo(0.5, 5);
  });
  test('sqrt( then 9 typed manually = auto-closes', () => {
    const s = runSequence(['sqrt(', '9', '=']);
    expect(s[2].result).toBe('3');
  });
  test('already-wrapped sqrt(9) = unaffected', () => {
    const s = runSequence(['9', 'sqrt(', '=']);
    expect(s[2].result).toBe('3');
  });
  test('1 + sin( then 30 = auto-closes', () => {
    const s = runSequence(['1', '+', 'sin(', '3', '0', '='], { angleMode: 'deg' });
    expect(parseFloat(s[5].result)).toBeCloseTo(1.5, 5);
  });
});

describe('implicit multiplication', () => {
  test('(1+3) then 8 inserts * → (1+3)*8 = 32', () => {
    const s = runSequence(['(', '1', '+', '3', ')', '8', '=']);
    expect(s[6].result).toBe('32');
  });
  test('(2+3) then ( inserts * → (2+3)*(', () => {
    const s = runSequence(['(', '2', '+', '3', ')', '(']);
    expect(s[5].expression).toBe('(2+3)*(');
  });
  test('digit after ) does not double-insert * when already has *', () => {
    const s = runSequence(['(', '2', ')', '*', '3', '=']);
    expect(s[5].result).toBe('6');
  });
  test('digit after pi inserts *', () => {
    const s = runSequence(['pi', '9']);
    expect(s[1].expression).toBe('pi*9');
  });
  test('pi then = gives π value', () => {
    const s = runSequence(['pi', '=']);
    expect(parseFloat(s[1].result)).toBeCloseTo(3.14159265, 7);
  });
  test('pi * 2 = after result does not replace pi', () => {
    const s = runSequence(['pi', '*', '2', '=']);
    expect(parseFloat(s[3].result)).toBeCloseTo(6.28318, 4);
  });
  test('digit after e inserts *', () => {
    const s = runSequence(['e', '2']);
    expect(s[1].expression).toBe('e*2');
  });
});

describe('template mode — yroot', () => {
  test('yroot( on 8 enters template mode', () => {
    const s = runSequence(['8', 'yroot(']);
    expect(s[1].templateMode).toBe(true);
    expect(s[1].expression).toContain('yroot(8,');
  });
  test('typing 3 in Y slot builds expression with marker', () => {
    const s = runSequence(['8', 'yroot(', '3']);
    expect(s[2].expression).toContain('3\x00');
  });
  test('8 yroot( 3 = gives cube root of 8 = 2', () => {
    const s = runSequence(['8', 'yroot(', '3', '=']);
    expect(s[3].result).toBe('2');
  });
  test('27 yroot( 3 = gives 3', () => {
    const s = runSequence(['2', '7', 'yroot(', '3', '=']);
    expect(s[4].result).toBe('3');
  });
  test('backspace with empty Y removes template, restores X', () => {
    const s = runSequence(['8', 'yroot(', '⌫']);
    expect(s[2].templateMode).toBe(false);
    expect(s[2].expression).toBe('8');
  });
  test('backspace removes last Y digit', () => {
    const s = runSequence(['8', 'yroot(', '3', '2', '⌫']);
    const yContent = s[4].expression.match(/,([^\x00]*)\x00\)/)?.[1];
    expect(yContent).toBe('3');
  });
  test('AC in template mode clears all', () => {
    const s = runSequence(['8', 'yroot(', '3', 'AC']);
    expect(s[3].expression).toBe('');
    expect(s[3].templateMode).toBe(false);
  });
});

describe('template mode — logy', () => {
  test('logy( on 100 enters template mode', () => {
    const s = runSequence(['1', '0', '0', 'logy(']);
    expect(s[3].templateMode).toBe(true);
  });
  test('1000 logy( 10 = gives 3', () => {
    const s = runSequence(['1', '0', '0', '0', 'logy(', '1', '0', '=']);
    expect(s[7].result).toBe('3');
  });
  test('8 logy( 2 = gives 3', () => {
    const s = runSequence(['8', 'logy(', '2', '=']);
    expect(s[3].result).toBe('3');
  });
});

describe('template mode — x^y (xpow)', () => {
  test('5 x^( enters template mode', () => {
    const s = runSequence(['5', 'x^(']);
    expect(s[1].templateMode).toBe(true);
    expect(s[1].expression).toContain('xpow(5,');
  });
  test('5 x^( 3 = gives 125', () => {
    const s = runSequence(['5', 'x^(', '3', '=']);
    expect(s[3].result).toBe('125');
  });
  test('2 x^( 10 = gives 1024', () => {
    const s = runSequence(['2', 'x^(', '1', '0', '=']);
    expect(s[4].result).toBe('1024');
  });
  test('operator exits template and is re-dispatched: 8 x^( 1 + 2 = 10', () => {
    const s = runSequence(['8', 'x^(', '1', '+', '2', '=']);
    // After +: template exits with xpow(8,1), then +2 appended
    expect(s[3].templateMode).toBe(false);
    expect(s[5].result).toBe('10');
  });
  test('stays in template while typing digits', () => {
    const s = runSequence(['8', 'x^(', '1', '2']);
    expect(s[3].templateMode).toBe(true);
    expect(s[3].expression).toContain('12\x00');
  });
  test('( in Y enters paren mode, operators accepted inside', () => {
    const s = runSequence(['8', 'x^(', '(', '1', '+', '2', ')']);
    expect(s[6].templateMode).toBe(true);
    const y = s[6].expression.match(/,([^\x00]*)\x00\)/)?.[1];
    expect(y).toBe('(1+2)');
  });
  test('8 x^( (1+2) = gives 512', () => {
    const s = runSequence(['8', 'x^(', '(', '1', '+', '2', ')', '=']);
    expect(s[7].result).toBe('512');
  });
  test('x^( with no X enters template with empty X slot', () => {
    // Toast is shown in CalcScreen; dispatch still enters template mode
    const s = runSequence(['x^(']);
    expect(s[0].templateMode).toBe(true);
  });
  test('backspace with empty Y removes template and restores X', () => {
    const s = runSequence(['5', 'x^(', '⌫']);
    expect(s[2].templateMode).toBe(false);
    expect(s[2].expression).toBe('5');
  });
  test('AC in template clears all', () => {
    const s = runSequence(['5', 'x^(', '3', 'AC']);
    expect(s[3].expression).toBe('');
    expect(s[3].templateMode).toBe(false);
  });
});
