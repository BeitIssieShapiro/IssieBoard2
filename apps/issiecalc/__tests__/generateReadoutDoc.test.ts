/**
 * Not a test: a generator, run by jest because it needs the same module graph
 * the tests do (the RN preset, the mocked TTS module, the real provider).
 *
 * Replays every readout case through the real dispatch + readout + speak
 * button and writes docs/readout-cases.html — a manual test sheet whose
 * expected column is what the code actually produces, so it cannot drift from
 * the suite the way a hand-written table would.
 *
 * Regenerate with:
 *   npx jest apps/issiecalc/__tests__/generateReadoutDoc.test.ts
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { dispatch, CalcState, readoutArgs, finalizeTemplate } from '../src/services/calcDispatch';
import { speakExpression } from '../src/services/speakExpression';
import { formatExpression } from '../src/services/formatExpression';
import { matchTemplateCall } from '../src/services/templateCall';

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

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵',
  '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '.': '·', '+': '⁺',
};
const SUBSCRIPT: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅',
  '6': '₆', '7': '₇', '8': '₈', '9': '₉',
};
const toSuper = (s: string) => s.split('').map(c => SUPERSCRIPT[c] ?? c).join('');
const toSub = (s: string) => s.split('').map(c => SUBSCRIPT[c] ?? c).join('');

/**
 * What the calculator's display actually shows for an expression.
 *
 * formatExpression covers the one-argument keys (√, ∛, log₂, x!, ×, ÷), but the
 * four two-argument templates are drawn by CalcScreen's renderTemplateExpression
 * as real React nodes — a base with a raised exponent — which a string cannot
 * hold. They are approximated here with Unicode super/subscripts, using the same
 * matchTemplateCall helper the screen uses so the arguments are split
 * identically. Close enough to compare against the device at a glance, which is
 * what this sheet is for.
 */
function displayForm(expr: string): string {
  if (!expr) return '';
  let e = expr;

  // xpow(2,3) → 2³. ypow is the yˣ key, whose arguments are drawn in the
  // opposite order (the number typed first is the exponent).
  for (let guard = 0; guard < 8; guard++) {
    const xp = matchTemplateCall(e, 'xpow(');
    if (xp) { e = `${xp[0]}${displayForm(xp[1])}${toSuper(displayForm(xp[2]))}${xp[3]}`; continue; }
    const yp = matchTemplateCall(e, 'ypow(');
    if (yp) { e = `${yp[0]}${displayForm(yp[2])}${toSuper(displayForm(yp[1]))}${yp[3]}`; continue; }
    // yroot(5,3) → ³√(5): the index is a superscript before the radical.
    const yr = matchTemplateCall(e, 'yroot(');
    if (yr) { e = `${yr[0]}${toSuper(displayForm(yr[2]))}√(${displayForm(yr[1])})${yr[3]}`; continue; }
    // logy(8,2) → log₂(8): the base is a subscript.
    const lg = matchTemplateCall(e, 'logy(');
    if (lg) { e = `${lg[0]}log${toSub(displayForm(lg[2]))}(${displayForm(lg[1])})${lg[3]}`; continue; }
    break;
  }
  return formatExpression(e);
}

interface Row {
  keys: string[];
  language: string;
  mode: string;
  mathLevel: string;
  angleMode: 'deg' | 'rad';
  expression: string;
  display: string;
  typing: string[];
  button: string;
  note?: string;
  bug?: string;
}

/** Replays a sequence through both flows exactly as the tests do. */
function run(
  keys: string[],
  opts: {
    language?: string; mode?: string; mathLevel?: string;
    angleMode?: 'deg' | 'rad'; note?: string; bug?: string;
  } = {}
): Row {
  const language = opts.language ?? 'en-US';
  const mode = opts.mode ?? 'every-number';
  const mathLevel = opts.mathLevel ?? 'standard';
  const angleMode = opts.angleMode ?? 'deg';

  const ctx = mountTTS();
  spoken.length = 0;
  act(() => { ctx.loadFromConfig({ readoutMode: mode, language, mathLevel }); });

  let s: CalcState = { ...baseState, angleMode };
  for (const key of keys) {
    const next = dispatch(s, key);
    const { expression, result } = readoutArgs(key, s, next);
    act(() => { ctx.readout(key, expression, result, next.angleMode); });
    // "=" defers half its readout on a timer; flush after each key, as real
    // time would.
    act(() => { jest.runAllTimers(); });
    s = next;
  }

  const expression = finalizeTemplate(s.expression);
  return {
    keys, language, mode, mathLevel, angleMode, expression,
    display: displayForm(expression),
    typing: [...spoken],
    button: speakExpression(expression, language, mathLevel as any),
    note: opts.note,
    bug: opts.bug,
  };
}

/**
 * Every case in all three languages, grouped so the translations sit directly
 * under the English row and a missing or mistranslated name is obvious at a
 * glance. The note is written once and carried by the English row; repeating it
 * under each translation would just be noise.
 */
const DOC_LANGUAGES = ['en-US', 'he-IL', 'ar-SA'];

function pairs(cases: Array<[string[], string?]>): Row[] {
  const rows: Row[] = [];
  for (const [keys, note] of cases) {
    for (const language of DOC_LANGUAGES) {
      rows.push(run(keys, language === 'en-US' ? { note } : { language }));
    }
  }
  return rows;
}

interface Section { title: string; blurb: string; rows: Row[] }

function buildSections(): Section[] {
  return [
    {
      title: 'Readout modes',
      blurb: 'The same sum in each of the four modes. "Every digit" narrates each keypress, '
        + '"every number" speaks whole operands, "both" does each, and "off" must stay silent.',
      rows: [
        run(['5', '+', '3', '='], { mode: 'every-digit' }),
        run(['5', '+', '3', '='], { mode: 'every-number' }),
        run(['5', '+', '3', '='], { mode: 'both' }),
        run(['5', '+', '3', '='], { mode: 'off' }),
        run(['9', '2root(', 'x^2', '='], { mode: 'off', note: 'Functions are silent too, not just digits.' }),
      ],
    },
    {
      title: 'Basic arithmetic',
      blurb: 'Whole typing sessions. Each operator announces the operand before it, so every '
        + 'number is spoken exactly once.',
      rows: pairs([
        [['5', '+', '3', '=']],
        [['3', '-', '8', '='], 'Negative result: the minus is a word, not a symbol.'],
        [['5', '*', '3', '=']],
        [['5', '/', '0', '='], 'Division by zero reads as "error", not the raw "Error".'],
        [['5', '+', '3', '*', '2', '='], 'Operator chain — no term dropped.'],
        [['1', '2', '3', '+', '4', '5', '='], 'Multi-digit numbers read whole.'],
        [['1', '.', '5', '+', '2', '='], 'Decimals read as one number.'],
        [['1', '/', '3', '='], 'Long decimal truncated, remainder counted (default 2 digits).'],
      ]),
    },
    {
      title: 'Roots, reciprocal and factorial',
      blurb: 'Keys that wrap an operand already on screen. These complete on the keypress, so '
        + 'both flows have the same information and must agree.',
      rows: pairs([
        [['9', '2root(', '=']],
        [['8', '3root(']],
        [['5', 'factorial(']],
        [['7', '1/(']],
        [['2', '+', '9', '2root(', '='], 'A function inside a longer expression.'],
      ]),
    },
    {
      title: 'Powers',
      blurb: 'x², x³ and the constant-base powers complete on the keypress. The xʸ family waits '
        + 'for a second operand, which is why typing and the button differ there.',
      rows: pairs([
        [['4', 'x^2', '=']],
        [['4', 'x^3']],
        [['3', '10^(', '='], 'The key completes the power — "=" must not repeat the exponent.'],
        [['3', '2^(']],
        [['2', 'e^(', '='], 'eˣ becomes the same xpow( form as the other powers.'],
      ]),
    },
    {
      title: 'Logarithms',
      blurb: 'ln, log (base ten) and log₂ name their base; logᵧ takes the base as a second operand.',
      rows: pairs([
        [['2', '0', 'ln(', '=']],
        [['1', '0', '0', 'log(', '=']],
        [['8', 'log2(', '='], 'Says its operand twice on "=" — see Known bugs.'],
      ]),
    },
    {
      title: 'Templates (two-operand keys)',
      blurb: 'The key is pressed before the second operand exists. Typing announces what it has; '
        + 'the speak button reads the finished form. The two differing here is by design.',
      rows: pairs([
        [['2', 'x^(', '3', '=']],
        [['5', 'yroot(', '3'], 'Typing has no index yet; the button names the root.'],
        [['8', 'logy(', '2'], 'Typing says the placeholder base "y"; the button the real one.'],
        [['2', 'y^(', '3'], 'yˣ: the typed number is the exponent.'],
      ]),
    },
    {
      title: 'Hyperbolic functions',
      blurb: 'These take a plain number, not an angle, so no unit is spoken — in either angle mode.',
      rows: pairs([
        [['1', 'sinh(', '=']],
        [['1', 'cosh(']],
        [['1', 'tanh(']],
        [['1', 'asinh(']],
        [['1', 'acosh(']],
        [['0', '.', '5', 'atanh(']],
      ]),
    },
    {
      title: 'Inverse trigonometry',
      blurb: 'asin/acos/atan take a ratio and return an angle. They currently announce the '
        + 'argument with an angle unit, which is the wrong way round — see Known bugs.',
      rows: pairs([
        [['1', 'asin(', '=']],
        [['1', 'acos(']],
        [['1', 'atan(']],
      ]),
    },
    {
      title: 'Constants',
      blurb: 'π and e have names in every language but are silent when pressed — see Known bugs.',
      rows: pairs([
        [['pi', '=']],
        [['e', '=']],
        [['2', '*', 'pi', '='], 'Spoken correctly once it is part of a sum.'],
      ]),
    },
    {
      title: 'Percent and parentheses',
      blurb: 'The percent key reads with its operand. Brackets are named by the speak button, '
        + 'but typing reads a leading one as a bare character — see Known bugs.',
      rows: pairs([
        [['5', '0', '%', '=']],
        [['2', '0', '0', '*', '1', '0', '%', '=']],
        [['(', '2', '+', '3', ')', '=']],
        [['2', '*', '(', '3', '+', '4', ')', '=']],
      ]),
    },
    {
      title: 'Forward trigonometry and angle units',
      blurb: 'These take an angle, so the unit is spoken with it. Only the typing flow says it — '
        + 'the expression does not record which mode was active.',
      rows: [
        ...pairs([
          [['3', '0', 'sin(', '=']],
          [['6', '0', 'cos(']],
          [['4', '5', 'tan(']],
        ]),
        run(['3', '0', 'sin('], { angleMode: 'rad', note: 'Radian mode names the other unit.' }),
        run(['3', '0', 'sin('], { angleMode: 'rad', language: 'he-IL' }),
        run(['3', '0', 'sin('], { angleMode: 'rad', language: 'ar-SA' }),
      ],
    },
    {
      title: 'Math level',
      blurb: 'Hebrew is the only language with a young register, and it changes only + and ×. '
        + 'English and Arabic ignore the setting, which these rows confirm.',
      rows: [
        run(['5', '+', '3', '='], { language: 'he-IL', note: 'Standard: פלוס.' }),
        run(['5', '+', '3', '='], { language: 'he-IL', mathLevel: 'young', note: 'Young: ועוד.' }),
        run(['6', '*', '7', '='], { language: 'he-IL', note: 'Standard: כפול.' }),
        run(['6', '*', '7', '='], { language: 'he-IL', mathLevel: 'young', note: 'Young: פְּעָמִים.' }),
        run(['6', '*', '7', '='], { mathLevel: 'young', note: 'English is unchanged by the setting.' }),
        run(['6', '*', '7', '='], { language: 'ar-SA', mathLevel: 'young', note: 'Arabic is unchanged by the setting.' }),
      ],
    },
    {
      title: 'Corrections mid-session',
      blurb: 'Nothing from before a clear or backspace should be spoken again.',
      rows: [
        ...pairs([
          [['9', '+', '9', 'AC', '2', '+', '2', '=']],
          [['1', '2', '⌫', '+', '3', '=']],
          [['5', '+', '3', '=', '+', '2', '='], 'Continuing from a result.'],
        ]),
        run(['5', 'AC'], { note: 'AC is silent.' }),
        run(['5', 'AC', '7', '+', '2', '='], { note: 'A silent key does not mute the keys after it.' }),
        run(['5', 'ms', 'AC', 'mr', '='], { note: 'Memory store and recall are both silent.' }),
      ],
    },
    {
      title: 'Language fallback',
      blurb: 'An unsupported or missing language must fall back to English rather than going silent.',
      rows: [
        run(['5', '+', '3', '='], { language: 'fr-FR', note: 'Unsupported → English.' }),
        run(['5', '+', '3', '='], { language: 'he', note: 'Bare code, no region.' }),
      ],
    },
    {
      title: 'Known bugs',
      blurb: 'These rows show what the app does today, which is wrong. Each is pinned with '
        + 'it.failing in readoutParity.test.ts or sciKeysReadout.test.ts, alongside a passing '
        + 'test recording the current behaviour, so a fix has to update both.',
      rows: [
        run(['5', 'EE', '3'], {
          bug: 'Typing says nothing. EE has a translation ("times ten to the") in all three languages '
            + 'but is in neither OPERATOR_KEYS nor WRAPPING_FUNCTIONS, so the every-number branch '
            + 'never reaches it. Expected: "5 times ten to the". The speak button also misreads the '
            + 'result as "5E plus 3" — it has no case for scientific notation.',
        }),
        run(['5', 'EE', '3'], {
          mode: 'every-digit',
          note: 'The same key IS announced in every-digit and both — which is what makes the silence above look like an omission.',
        }),
        run(['1', 'asin('], {
          bug: 'Says "arc sine of 1 degrees". asin takes a ratio and RETURNS an angle, so the unit '
            + 'is attached to the wrong number. Cause: ANGLE_FUNCTIONS lumps asin/acos/atan in with '
            + 'sin/cos/tan, where the unit is correct. Expected: "arc sine of 1".',
        }),
        run(['1', 'asin('], { language: 'he-IL', bug: 'The same fault in Hebrew: "ארקסינוס של 1 מעלות".' }),
        run(['1', 'asin('], { language: 'ar-SA', bug: 'And in Arabic: "جيب معكوس من 1 درجات".' }),
        run(['pi'], {
          bug: 'Silent when pressed, though π has a name in every language. Like EE it reaches '
            + 'neither OPERATOR_KEYS nor WRAPPING_FUNCTIONS. Expected: "pi". Same for e.',
        }),
        run(['8', 'log2(', '='], {
          bug: 'Says its operand twice: "log base 2 of 8", then "8" again before "equals". The "=" '
            + 'branch treats the call as an ordinary operand because log2( ends in a digit before '
            + 'its paren, so endsWithFunction does not match it.',
        }),
        run(['5', '0', '%', '='], {
          bug: 'Pushes an empty utterance between the operand and "equals": a trailing "%" leaves '
            + 'nothing for "=" to extract. Harmless to hear, but no other key does it.',
        }),
        run(['(', '2', '+', '3', ')', '='], {
          bug: 'Typing reads the bracket as a bare character — "(2 plus" — where the speak button '
            + 'correctly says "open parenthesis 2 plus 3 close parenthesis".',
        }),
      ],
    },
  ];
}

const MODE_LABEL: Record<string, string> = {
  'off': 'Off',
  'every-digit': 'Every digit',
  'every-number': 'Every number',
  'both': 'Both',
};

const LANG_LABEL: Record<string, string> = {
  'en-US': 'English', 'he-IL': 'Hebrew', 'he': 'Hebrew', 'ar-SA': 'Arabic', 'fr-FR': 'French',
};

const RTL = new Set(['he-IL', 'he', 'ar-SA']);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The calculator's label for a key value, so the sheet reads like the keypad. */
const KEY_LABEL: Record<string, string> = {
  'sqrt(': '√', '2root(': '√', '3root(': '∛', 'yroot(': 'ʸ√',
  'factorial(': 'x!', '1/(': '1/x', 'x^2': 'x²', 'x^3': 'x³',
  'x^(': 'xʸ', 'y^(': 'yˣ', '10^(': '10ˣ', '2^(': '2ˣ', 'e^(': 'eˣ',
  'logy(': 'logᵧ', 'log2(': 'log₂', 'log(': 'log', 'ln(': 'ln',
  'sin(': 'sin', 'cos(': 'cos', 'tan(': 'tan',
  'asin(': 'sin⁻¹', 'acos(': 'cos⁻¹', 'atan(': 'tan⁻¹',
  'sinh(': 'sinh', 'cosh(': 'cosh', 'tanh(': 'tanh',
  'asinh(': 'sinh⁻¹', 'acosh(': 'cosh⁻¹', 'atanh(': 'tanh⁻¹',
  'pi': 'π', '*': '×', '/': '÷', '⌫': '⌫',
  '[ANGLE_TOGGLE]': 'Deg/Rad', '[2ND]': '2nd', '[2ND_OFF]': '2nd',
};
const keyLabel = (k: string) => KEY_LABEL[k] ?? k;

function renderRow(r: Row, idx: string): string {
  const dir = RTL.has(r.language) ? ' dir="rtl"' : '';
  const keys = r.keys.map(k => `<kbd>${esc(keyLabel(k))}</kbd>`).join('<span class="arr">›</span>');
  const typing = r.typing.length
    ? `<ol class="say"${dir}>` + r.typing.map(t => `<li>${esc(t)}</li>`).join('') + '</ol>'
    : '<span class="silent">— silent —</span>';
  const button = r.button
    ? `<span class="btn-say"${dir}>${esc(r.button)}</span>`
    : '<span class="silent">— nothing —</span>';
  const note = r.bug
    ? `<p class="note bug"><strong>Bug:</strong> ${esc(r.bug)}</p>`
    : r.note ? `<p class="note">${esc(r.note)}</p>` : '';
  const tags = [
    `<span class="tag">${esc(MODE_LABEL[r.mode] ?? r.mode)}</span>`,
    `<span class="tag">${esc(LANG_LABEL[r.language] ?? r.language)}</span>`,
    r.mathLevel === 'young' ? '<span class="tag young">Young</span>' : '',
    // Only the six trig keys are affected by the angle mode; the hyperbolics
    // take a plain number, so tagging them Deg/Rad would imply otherwise.
    r.keys.some(k => ['sin(', 'cos(', 'tan(', 'asin(', 'acos(', 'atan('].includes(k))
      ? `<span class="tag">${r.angleMode === 'deg' ? 'Deg' : 'Rad'}</span>` : '',
  ].filter(Boolean).join('');

  // What to compare against the device, and — in its own column — the internal
  // string, which is what the readout code actually receives and what the test
  // assertions are written against.
  const display = r.display
    ? `<span class="shown">${esc(r.display)}</span>`
    : '<span class="silent">empty</span>';
  const raw = r.expression
    ? `<code class="raw">${esc(r.expression)}</code>`
    : '<span class="silent">—</span>';

  return `
  <tr class="${r.bug ? 'is-bug' : ''}">
    <td class="c-check"><input type="checkbox" id="chk-${idx}" aria-label="Mark verified"></td>
    <td class="c-keys">${keys}<div class="tags">${tags}</div></td>
    <td class="c-expr">${display}</td>
    <td class="c-raw">${raw}</td>
    <td class="c-typing">${typing}${note}</td>
    <td class="c-button">${button}</td>
  </tr>`;
}

function renderHTML(sections: Section[]): string {
  const total = sections.reduce((n, s) => n + s.rows.length, 0);
  let i = 0;
  const body = sections.map(s => {
    const rows = s.rows.map(r => renderRow(r, String(i++))).join('');
    return `
  <section>
    <h2>${esc(s.title)} <span class="count">${s.rows.length}</span></h2>
    <p class="blurb">${esc(s.blurb)}</p>
    <table>
      <thead>
        <tr>
          <th class="c-check"><span class="sr">Verified</span></th>
          <th class="c-keys">Press these keys</th>
          <th class="c-expr">You should see</th>
          <th class="c-raw">Internal expression</th>
          <th class="c-typing">Should say while typing</th>
          <th class="c-button">Speak button should say</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
  }).join('');

  const toc = sections.map(s => `<a href="#">${esc(s.title)}</a>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>IssieCalc — readout test sheet</title>
<style>
  :root {
    --bg: #ffffff; --fg: #1a1a1a; --muted: #6b7280; --line: #e5e7eb;
    --accent: #0b6bcb; --accent-soft: #eff6ff; --bug: #b42318; --bug-soft: #fef3f2;
    --say-bg: #f6f8fa; --ok: #067647;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #16181d; --fg: #e6e8eb; --muted: #9aa4b2; --line: #2b2f36;
      --accent: #6aa9f0; --accent-soft: #17293d; --bug: #ff8a7a; --bug-soft: #2d1a18;
      --say-bg: #1d2026; --ok: #4ec38a;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 2rem 1.25rem 5rem; background: var(--bg); color: var(--fg);
    font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .wrap { max-width: 1180px; margin: 0 auto; }
  h1 { font-size: 1.7rem; margin: 0 0 .35rem; letter-spacing: -.01em; }
  .lede { color: var(--muted); margin: 0 0 1.25rem; max-width: 70ch; }
  .lede code { font-size: .9em; }
  .bar {
    position: sticky; top: 0; z-index: 5; background: var(--bg);
    border-bottom: 1px solid var(--line); padding: .6rem 0 .7rem; margin-bottom: 1.5rem;
    display: flex; gap: .75rem; align-items: center; flex-wrap: wrap;
  }
  .bar input[type=search] {
    flex: 1 1 260px; min-width: 200px; padding: .45rem .7rem; font: inherit;
    border: 1px solid var(--line); border-radius: 7px; background: var(--bg); color: var(--fg);
  }
  .progress { font-variant-numeric: tabular-nums; color: var(--muted); font-size: .9rem; }
  .progress strong { color: var(--ok); }
  button.reset {
    font: inherit; padding: .4rem .7rem; border: 1px solid var(--line);
    border-radius: 7px; background: transparent; color: var(--muted); cursor: pointer;
  }
  button.reset:hover { color: var(--fg); border-color: var(--muted); }
  section { margin: 0 0 2.5rem; }
  h2 { font-size: 1.12rem; margin: 0 0 .3rem; display: flex; align-items: baseline; gap: .5rem; }
  .count {
    font-size: .72rem; font-weight: 600; color: var(--accent);
    background: var(--accent-soft); padding: .1rem .45rem; border-radius: 99px;
  }
  .blurb { color: var(--muted); margin: 0 0 .8rem; max-width: 78ch; font-size: .92rem; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; vertical-align: top; padding: .6rem .7rem; border-top: 1px solid var(--line); }
  thead th {
    font-size: .74rem; text-transform: uppercase; letter-spacing: .04em;
    color: var(--muted); font-weight: 600; border-top: none; padding-bottom: .4rem;
  }
  tbody tr:hover { background: var(--say-bg); }
  tr.is-bug { background: var(--bug-soft); }
  tr.done { opacity: .5; }
  tr.done .c-keys kbd { opacity: .7; }
  .c-check { width: 34px; }
  .c-check input { width: 17px; height: 17px; cursor: pointer; accent-color: var(--ok); }
  .c-keys { width: 20%; }
  .c-expr { width: 13%; }
  .c-raw { width: 14%; }
  .c-typing { width: 27%; }
  .c-button { width: 22%; }
  /* The calculator's own display: large, light, right-aligned on a dark slab,
     so a glance at the device and a glance at this column compare directly. */
  .shown {
    display: block; text-align: right; font-weight: 300; font-size: 1.45rem;
    line-height: 1.25; letter-spacing: .01em; color: #f2f4f7; background: #202227;
    border-radius: 7px; padding: .3rem .5rem; word-break: break-word;
  }
  .c-raw code.raw {
    display: block; font-size: 12px; color: var(--muted);
    background: var(--say-bg); border: 1px solid var(--line);
    border-radius: 5px; padding: .28rem .42rem;
  }
  kbd {
    display: inline-block; font: 600 13px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    background: var(--say-bg); border: 1px solid var(--line); border-bottom-width: 2px;
    border-radius: 5px; padding: .3em .45em; margin: .12em 0;
  }
  .arr { color: var(--muted); margin: 0 .2em; font-size: .8em; }
  .tags { margin-top: .4rem; display: flex; gap: .3rem; flex-wrap: wrap; }
  .tag {
    font-size: .68rem; color: var(--muted); border: 1px solid var(--line);
    border-radius: 99px; padding: .08rem .42rem; white-space: nowrap;
  }
  .tag.young { color: var(--accent); border-color: var(--accent); }
  code { font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all; }
  ol.say { margin: 0; padding: 0; list-style: none; counter-reset: s; }
  ol.say li {
    counter-increment: s; position: relative; padding: .16rem 0 .16rem 1.5rem;
  }
  ol.say li::before {
    content: counter(s); position: absolute; left: 0; top: .28rem;
    font-size: .64rem; color: var(--muted); background: var(--say-bg);
    border: 1px solid var(--line); border-radius: 99px;
    width: 1.15rem; height: 1.15rem; display: grid; place-items: center;
  }
  ol.say[dir=rtl] li { padding: .16rem 1.5rem .16rem 0; text-align: right; }
  ol.say[dir=rtl] li::before { left: auto; right: 0; }
  .btn-say { display: inline-block; }
  .btn-say[dir=rtl] { display: block; text-align: right; }
  .silent { color: var(--muted); font-style: italic; font-size: .88rem; }
  .note { margin: .45rem 0 0; font-size: .82rem; color: var(--muted); }
  .note.bug { color: var(--bug); }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  footer { color: var(--muted); font-size: .85rem; border-top: 1px solid var(--line); padding-top: 1rem; }
  @media print {
    .bar { position: static; } tr.done { opacity: 1; }
    body { padding: 0; } section { break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="wrap">
  <h1>IssieCalc — readout test sheet</h1>
  <p class="lede">
    Every case the automated readout suite covers, as a manual checklist. Each row is
    <strong>generated by replaying the keys through the real code</strong>, not written by hand,
    so it is what the app actually does today. Tick a row once the device matches; anything
    different is a regression — or a case worth adding.
  </p>
  <p class="lede">
    <strong>You should see</strong> is what appears on the calculator's display — powers as raised
    exponents, roots as radicals. <strong>Internal expression</strong> is the string the app holds
    behind that and hands to the readout, which is what the test assertions are written against;
    the superscripts in the first column are a text approximation of React views, so expect the
    device to render them more elegantly.
  </p>

  <div class="bar">
    <input type="search" id="filter" placeholder="Filter rows — try “Hebrew”, “root”, “EE”…" aria-label="Filter rows">
    <span class="progress" id="progress"></span>
    <button class="reset" id="reset">Clear ticks</button>
  </div>
${body}
  <footer>
    ${total} cases · generated from <code>apps/issiecalc/__tests__/</code> ·
    regenerate with <code>npx jest apps/issiecalc/__tests__/generateReadoutDoc.test.ts</code>
  </footer>
</div>
<script>
  // Ticks persist per browser so a review can be done over more than one sitting.
  var KEY = 'issiecalc-readout-ticks';
  var boxes = Array.prototype.slice.call(document.querySelectorAll('.c-check input'));
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}

  function paint(b) { b.closest('tr').classList.toggle('done', b.checked); }
  function progress() {
    var n = boxes.filter(function (b) { return b.checked; }).length;
    document.getElementById('progress').innerHTML =
      '<strong>' + n + '</strong> / ' + boxes.length + ' verified';
  }
  boxes.forEach(function (b) {
    if (saved[b.id]) { b.checked = true; }
    paint(b);
    b.addEventListener('change', function () {
      saved[b.id] = b.checked;
      try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) {}
      paint(b); progress();
    });
  });
  progress();

  document.getElementById('reset').addEventListener('click', function () {
    boxes.forEach(function (b) { b.checked = false; paint(b); });
    saved = {};
    try { localStorage.removeItem(KEY); } catch (e) {}
    progress();
  });

  document.getElementById('filter').addEventListener('input', function (e) {
    var q = e.target.value.toLowerCase();
    document.querySelectorAll('section').forEach(function (sec) {
      var any = false;
      sec.querySelectorAll('tbody tr').forEach(function (tr) {
        var hit = (sec.querySelector('h2').textContent + ' ' + tr.textContent).toLowerCase().indexOf(q) !== -1;
        tr.style.display = hit ? '' : 'none';
        if (hit) { any = true; }
      });
      sec.style.display = any ? '' : 'none';
    });
  });
</script>
</body>
</html>
`;
}

describe('readout documentation', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('writes docs/readout-cases.html from the real modules', () => {
    const sections = buildSections();
    const out = path.resolve(__dirname, '../../../docs/readout-cases.html');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, renderHTML(sections), 'utf8');

    const total = sections.reduce((n, s) => n + s.rows.length, 0);
    expect(total).toBeGreaterThan(40);
    // Sanity: the generator must have captured real speech, not empty rows.
    expect(sections.some(s => s.rows.some(r => r.typing.length > 0))).toBe(true);
  });
});
