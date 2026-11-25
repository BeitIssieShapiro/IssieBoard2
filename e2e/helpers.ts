// Shared helpers for the e2e tests of IssieBoard, IssieVoice and IssieCalc.
import { by, device, element, waitFor } from 'detox';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export type State = Record<string, string>;

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
export const isAndroid = () => device.getPlatform() === 'android';

const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR;

export async function shot(name: string) {
  const file = await device.takeScreenshot(name);
  if (SCREENSHOT_DIR) fs.copyFileSync(file, path.join(SCREENSHOT_DIR, `${device.getPlatform()}-${name}.png`));
}

export async function launch(extra: Record<string, unknown> = {}) {
  await device.launchApp({
    newInstance: true,
    // (iOS: hides the dev warnings banner, which covers the bottom of the keyboard)
    launchArgs: { e2e: '1' },
    permissions: { microphone: 'YES' },
    ...extra,
  });
}

// the hidden state views (dev builds only) have labels like "text:Hi%20there speaking:0 lang:en"
export async function readLabel(id: string): Promise<State> {
  const attrs: any = await element(by.id(id)).getAttributes();
  const label: string = attrs.label ?? attrs.elements?.[0]?.label ?? '';
  return Object.fromEntries(label.split(' ').filter(Boolean).map(kv => {
    const i = kv.indexOf(':');
    return [kv.substring(0, i), decodeURIComponent(kv.substring(i + 1))];
  }));
}

// waits until the state passes the check
export async function expectLabel(id: string, what: string, check: (s: State) => boolean, timeout = 10000) {
  await waitFor(element(by.id(id))).toExist().withTimeout(timeout);
  const until = Date.now() + timeout;
  let s = await readLabel(id);
  while (!check(s) && Date.now() < until) {
    await sleep(300);
    s = await readLabel(id);
  }
  if (!check(s)) throw new Error(`${id}: expected ${what}, got ${JSON.stringify(s)}`);
  return s;
}

export async function tapId(id: string, timeout = 8000) {
  await waitFor(element(by.id(id))).toExist().withTimeout(timeout);
  await sleep(300); // screens and panels slide in
  await element(by.id(id)).tap();
}

// a tap retried while something (a notification, a sliding panel) covers the element
export async function tapIdWhenFree(id: string, timeout = 8000) {
  await waitFor(element(by.id(id)).atIndex(0)).toExist().withTimeout(timeout);
  const until = Date.now() + timeout;
  for (;;) {
    try {
      await element(by.id(id)).atIndex(0).tap();
      return;
    } catch (e) {
      if (Date.now() > until) throw e;
      await sleep(500);
    }
  }
}

export async function exists(id: string | RegExp, timeout = 1500) {
  try {
    await waitFor(element(by.id(id)).atIndex(0)).toExist().withTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

// the last element with the id (when stacked views, such as two pickers, both have it: the top one)
export async function tapLastId(id: string | RegExp, timeout = 5000) {
  await waitFor(element(by.id(id)).atIndex(0)).toExist().withTimeout(timeout);
  await sleep(300);
  const a: any = await element(by.id(id)).getAttributes();
  const count = a.elements ? a.elements.length : 1;
  await element(by.id(id)).atIndex(count - 1).tap();
}

// a dialog button by its text: the last match (a dialog's title can have the same text)
export async function tapDialogButton(text: RegExp, timeout = 5000) {
  await waitFor(element(by.text(text)).atIndex(0)).toExist().withTimeout(timeout);
  const a: any = await element(by.text(text)).getAttributes();
  const count = a.elements ? a.elements.length : 1;
  await element(by.text(text)).atIndex(count - 1).tap();
}

const esc = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A key of the native keyboard, by its label (either case: shift changes it). Word suggestions above the
// keys can show the same text, so the lowest match on screen is the key.
export async function tapKey(label: string) {
  if (isAndroid() && await tapAndroidKey(label)) return;
  const m = by.text(new RegExp('^' + esc(label) + '$', 'i'));
  await waitFor(element(m).atIndex(0)).toExist().withTimeout(5000);
  const a: any = await element(m).getAttributes();
  const els: any[] = a.elements ?? [a];
  let lowest = 0;
  els.forEach((e, i) => { if (frameOf(e).y > frameOf(els[lowest]).y) lowest = i; });
  await element(m).atIndex(lowest).tap();
}

// Android: a key's view has its details as its tag (JSON, e.g. {"type":"","value":"h",...}), which by.id
// matches (the whole tag: hence .* around). getAttributes and atIndex do not list matches in the same
// order there, so the lowest-label way above can tap a suggestion.
const ANDROID_KEY_TYPES: Record<string, string> = { '⌫': 'backspace', 'עב': 'language', 'En': 'language' };
// keys whose value is not their label (the calculator's)
const ANDROID_KEY_VALUES: Record<string, string> = { 'Rad': '[ANGLE_TOGGLE]', 'Deg': '[ANGLE_TOGGLE]', 'π': 'pi' };
async function tapAndroidKey(label: string) {
  const json = (k: string, v: string) => new RegExp(`.*[{,]"${k}":"${esc(v).replace(/\//g, '\\\\/')}".*`, 's');
  const tries = ANDROID_KEY_TYPES[label] ? [json('type', ANDROID_KEY_TYPES[label])] :
    ANDROID_KEY_VALUES[label] ? [json('value', ANDROID_KEY_VALUES[label])] :
    [json('value', label), json('value', label.toLowerCase()), json('label', label)];
  for (const m of tries) {
    try {
      await waitFor(element(by.id(m)).atIndex(0)).toExist().withTimeout(1000);
      await element(by.id(m)).atIndex(0).tap();
      await sleep(250); // (taps right after each other can be missed)
      return true;
    } catch { }
  }
  return false;
}

export const adb = (args: string) => execSync(`adb -s ${device.id} ${args}`).toString();

const frameOf = (e: any) => e.frame ?? e.elementFrame ?? { x: 0, y: e.visibleBounds?.y ?? 0 };

// types a word on the native keyboard, a key per character (' ' is the space key)
export async function typeKeys(text: string, spaceLabel = ' ') {
  for (const ch of text) await tapKey(ch === ' ' ? spaceLabel : ch);
}
