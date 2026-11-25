// IssieBoard as the Android system keyboard (an input method), in English, Hebrew and Arabic: typing in a
// text field of the app, and deleting. Android only (iOS keyboard extensions can only be turned on in
// Settings). Run with a board.android.* configuration (see .detoxrc.js).
//
// The keyboard's window is not part of the app, so Detox cannot see it: its keys are found in a UI dump
// (uiautomator, the TYPE_INPUT_METHOD window) and tapped with adb.
import { by, device, element, waitFor } from 'detox';
import { adb, isAndroid, launch, shot, sleep, tapDialogButton, tapIdWhenFree } from './helpers';

// (each UI dump takes seconds, and a word takes several)
jest.setTimeout(400000);

const PKG = 'org.issieshapiro.issieboard';
const SERVICES = { en: 'IssieBoardEnService', he: 'IssieBoardHeService', ar: 'IssieBoardArService' };
const WORDS = { en: 'hi', he: 'של', ar: 'بيت' };

type Key = { text: string; x: number; y: number };

// the keys shown in the system keyboard's window, from a UI dump
function imeKeys(): Key[] {
  const xml = adb('exec-out uiautomator dump --windows /dev/tty');
  const window = xml.split('<window ').find(w => w.includes('type="TYPE_INPUT_METHOD"')) ?? '';
  const keys: Key[] = [];
  for (const m of window.matchAll(/text="([^"]+)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)) {
    keys.push({ text: m[1], x: (Number(m[2]) + Number(m[4])) / 2, y: (Number(m[3]) + Number(m[5])) / 2 });
  }
  return keys;
}

// the keys, once the label shows among them (a dump while the keyboard appears or redraws can miss it)
async function imeKeysWith(label: string): Promise<Key[]> {
  let keys: Key[] = [];
  for (let i = 0; i < 8; i++) {
    keys = imeKeys();
    if (keys.some(k => k.text.toLowerCase() === label.toLowerCase())) return keys;
    await sleep(1000);
  }
  return keys;
}

// taps a key of the system keyboard by its label (the lowest match: suggestions show above the keys)
function tapImeKey(keys: Key[], label: string) {
  const matches = keys.filter(k => k.text.toLowerCase() === label.toLowerCase());
  if (!matches.length) throw new Error(`no "${label}" key in the system keyboard (keys: ${keys.map(k => k.text).join(' ')})`);
  const key = matches.reduce((a, b) => (b.y > a.y ? b : a));
  adb(`shell input tap ${Math.round(key.x)} ${Math.round(key.y)}`);
}

async function fieldText() {
  const a: any = await element(by.id('save-as-name')).getAttributes();
  return String(a.text ?? '');
}

async function expectField(what: string, check: (t: string) => boolean, timeout = 6000) {
  const until = Date.now() + timeout;
  let t = await fieldText();
  while (!check(t) && Date.now() < until) {
    await sleep(300);
    t = await fieldText();
  }
  if (!check(t)) throw new Error(`the text field: expected ${what}, got "${t}"`);
}

// shows the system keyboard (IssieBoard in the language) for the field
async function useKeyboard(lang: keyof typeof SERVICES) {
  const ime = `${PKG}/.keyboards.${SERVICES[lang]}`;
  adb(`shell ime enable ${ime}`);
  adb(`shell ime set ${ime}`);
  await element(by.id('save-as-name')).tap();
  for (let i = 0; i < 20 && !imeKeys().length; i++) await sleep(500);
  await sleep(1500); // (it slides in: a tap before it settles is lost)
}

describe('IssieBoard as the system keyboard (Android)', () => {
  beforeAll(async () => {
    if (!isAndroid()) return;
    await launch();
    await device.disableSynchronization(); // (see board.test.ts)
    // (an emulator has a hardware keyboard: show the on-screen one anyway)
    adb('shell settings put secure show_ime_with_hard_keyboard 1');
    await waitFor(element(by.id('editor-lang-en')).atIndex(0)).toExist().withTimeout(20000);
    await sleep(1500);
    // a text field: the keyboard's name, when saving a change of the built-in keyboard
    await element(by.id('editor-lang-en')).atIndex(0).tap();
    await tapIdWhenFree('settings-tab-features');
    await tapIdWhenFree('feature-auto-correct');
    await tapIdWhenFree('editor-save-btn');
    await waitFor(element(by.id('save-as-name'))).toExist().withTimeout(5000);
  });

  afterAll(async () => {
    if (!isAndroid()) return;
    try {
      await tapDialogButton(/^(Cancel|ביטול|إلغاء)$/i); // the save dialog
      await tapIdWhenFree('editor-discard-btn');
      await tapDialogButton(/^(Discard|בטל שינויים|ביטול שינויים|تجاهل)$/i);
    } catch { }
    adb('shell ime reset'); // back to the device's keyboard
  });

  for (const lang of ['en', 'he', 'ar'] as const) {
    it(`types in ${lang}, and deletes`, async () => {
      if (!isAndroid()) {
        console.log('Android only: skipped');
        return;
      }
      // (the keyboard first goes down: with it up, the field is partly covered and cannot be cleared)
      if (imeKeys().length) {
        adb('shell input keyevent KEYCODE_BACK');
        await sleep(1000);
      }
      await element(by.id('save-as-name')).replaceText('');
      await useKeyboard(lang);
      // (the keys are read again before each letter: after the first one the keyboard redraws, shift off)
      for (const ch of WORDS[lang]) {
        tapImeKey(await imeKeysWith(ch), ch);
        await sleep(700);
      }
      const keys = await imeKeysWith('⌫');
      await expectField(`"${WORDS[lang]}"`, t => t.toLowerCase() === WORDS[lang]);
      await shot(`ime-${lang}`);
      if (keys.some(k => k.text === '⌫')) {
        tapImeKey(keys, '⌫');
        await expectField('a letter deleted', t => t.toLowerCase() === WORDS[lang].slice(0, -1));
      }
    });
  }
});
