// IssieCalc: the calculator's keypad (the embedded native keyboard), basic arithmetic, editing keys,
// the scientific keypad (parentheses, powers, π, angle mode, memory) and the settings screen.
// Run with a calc.* configuration (see .detoxrc.js).
import { by, element, waitFor } from 'detox';
import { exists, expectLabel, launch, shot, sleep, tapId, tapKey } from './helpers';

const calc = (what: string, check: (s: Record<string, string>) => boolean, timeout?: number) =>
  expectLabel('calc-state', what, check, timeout);
const press = async (...keys: string[]) => { for (const k of keys) await tapKey(k); };
const num = (s: Record<string, string>) => Number(s.result);

describe('IssieCalc', () => {
  beforeAll(async () => {
    await launch();
    await calc('the calculator', () => true, 20000);
  });

  beforeEach(async () => {
    await tapKey('AC');
    await calc('cleared', s => s.expression === '' && s.result === '');
  });

  it('starts, and shows the basic keypad', async () => {
    if (await exists('calc-mode-basic', 2000)) await tapId('calc-mode-basic'); // (the last one used is kept)
    await calc('basic', s => s.keyset === 'basic');
    await shot('calc-start');
  });

  it('adds', async () => {
    await press('2', '+', '3');
    await calc('the expression', s => s.expression === '2+3');
    await press('=');
    await calc('5', s => s.result === '5' && s.resultMode === '1');
  });

  it('multiplies, then goes on from the result', async () => {
    await press('7', '×', '8', '=');
    await calc('56', s => num(s) === 56);
    await press('÷', '4', '=');
    await calc('14', s => num(s) === 14);
  });

  it('subtracts into a negative number', async () => {
    await press('3', '−', '9', '=');
    await calc('-6', s => num(s) === -6);
  });

  it('deletes a digit, and clears', async () => {
    await press('1', '2', '⌫');
    await calc('"1"', s => s.expression === '1');
    await press('AC');
    await calc('cleared', s => s.expression === '');
  });

  it('decimals, the sign and percent', async () => {
    await press('1', '.', '5', '+', '1', '=');
    await calc('2.5', s => num(s) === 2.5);
    await press('AC', '4', '+/-', '=');
    await calc('-4', s => num(s) === -4);
    await press('AC', '5', '0', '%', '=');
    await calc('0.5', s => num(s) === 0.5);
  });

  it('the scientific keypad: parentheses, a power, π and the angle mode', async () => {
    if (!(await exists('calc-mode-scientific', 2000))) {
      console.log('no basic/scientific selector on this screen: skipped');
      return;
    }
    await tapId('calc-mode-scientific');
    await calc('scientific', s => s.keyset.startsWith('scientific'));
    await press('(', '2', '+', '3', ')', '×', '4', '=');
    await calc('20', s => num(s) === 20);
    await press('AC', '9', 'x²', '=');
    await calc('81', s => num(s) === 81);
    await press('AC', 'π', '=');
    await calc('π', s => Math.abs(num(s) - Math.PI) < 0.001);
    const angle = (await calc('an angle mode', () => true)).angle;
    await press(angle === 'rad' ? 'Rad' : 'Deg');
    await calc('the other angle mode', s => s.angle !== angle);
    await shot('calc-scientific');
  });

  it('stores and recalls memory', async () => {
    if (!(await exists('calc-mode-scientific', 2000))) return;
    await tapId('calc-mode-scientific');
    await press('7', 'ms', 'AC', 'mr');
    await calc('7 recalled', s => s.expression === '7' || num(s) === 7);
    await tapId('calc-mode-basic');
    await calc('basic', s => s.keyset === 'basic');
  });

  it('opens the settings, its tabs, and comes back', async () => {
    const back = by.id(/^(settings|editor)-back-btn$/);
    await tapId('calc-settings-btn');
    await waitFor(element(back).atIndex(0)).toExist().withTimeout(8000);
    for (const tab of ['keys-groups', 'voice', 'general']) {
      if (await exists(`settings-tab-${tab}`, 1000)) {
        await element(by.id(`settings-tab-${tab}`)).atIndex(0).tap();
        await sleep(600);
      }
    }
    await shot('calc-settings');
    await element(back).atIndex(0).tap();
    await calc('the calculator', () => true);
  });
});
