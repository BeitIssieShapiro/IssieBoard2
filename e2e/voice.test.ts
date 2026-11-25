// IssieVoice: typing on the embedded native keyboard (English and Hebrew), speaking, saving sentences,
// the saved sentences list (insert, favorite, delete), favorites on the main screen, and the settings
// screen with its keyboard editor. Run with a voice.* configuration (see .detoxrc.js).
import { by, element, waitFor } from 'detox';
import { expectLabel, launch, readLabel, tapDialogButton, shot, sleep, tapId, tapIdWhenFree, tapKey, typeKeys } from './helpers';

const voice = (what: string, check: (s: Record<string, string>) => boolean, timeout?: number) =>
  expectLabel('voice-state', what, check, timeout);
const browse = (what: string, check: (s: Record<string, string>) => boolean, timeout?: number) =>
  expectLabel('browse-state', what, check, timeout);

async function backToMain() {
  await tapIdWhenFree('browse-back-btn'); // (a notification can cover it)
  await waitFor(element(by.id('voice-state'))).toExist().withTimeout(5000);
}

describe('IssieVoice', () => {
  beforeAll(async () => {
    await launch();
    await voice('the main screen', () => true, 20000);
  });

  it('starts empty, with the keyboard', async () => {
    await voice('no text', s => s.text === '' && s.speaking === '0');
    await waitFor(element(by.text(/^q$/i)).atIndex(0)).toExist().withTimeout(5000);
    await shot('voice-start');
  });

  it('types in English, and deletes a letter', async () => {
    await voice('English', s => s.lang === 'en');
    await typeKeys('hi');
    // (iOS capitalizes the first letter)
    await voice('"hi"', s => s.text.toLowerCase() === 'hi');
    await tapKey('⌫');
    await voice('"h"', s => s.text.toLowerCase() === 'h');
    await tapId('voice-clear-btn');
    await voice('no text', s => s.text === '');
  });

  it('switches to Hebrew with the language key, and types', async () => {
    await tapKey('עב');
    await voice('Hebrew', s => s.lang === 'he');
    await typeKeys('של');
    await voice('"של"', s => s.text === 'של');
  });

  it('speaks the text', async () => {
    const before = Number((await readLabel('voice-state')).spoken);
    await tapId('voice-speak-btn');
    // (Detox waits for the app to be idle after the tap: a short text has been spoken by then)
    await voice('spoken once, and done', s => Number(s.spoken) === before + 1 && s.speaking === '0', 15000);
  });

  it('saves the text, and lists it in the saved sentences', async () => {
    await tapId('voice-save-btn');
    await tapId('voice-browse-btn');
    await browse('one saved sentence', s => s.saved === '1' && s.shown === '1');
    await waitFor(element(by.text('של'))).toExist().withTimeout(3000);
    await shot('voice-browse');
  });

  it('makes it a favorite, which shows on the main screen and speaks', async () => {
    await tapId('sentence-favorite-0');
    // "Set caption and icon?": not now
    await tapDialogButton(/^(No|לא)$/i);
    await browse('a favorite', s => s.favorites === '1');
    await backToMain();
    const before = Number((await readLabel('voice-state')).spoken);
    await tapId('favorite-של');
    await voice('the favorite spoken', s => Number(s.spoken) === before + 1 && s.speaking === '0', 15000);
  });

  it('inserts a saved sentence into the text', async () => {
    await tapId('voice-clear-btn');
    await voice('no text', s => s.text === '');
    await tapId('voice-browse-btn');
    await tapId('sentence-insert-0');
    await voice('the sentence inserted', s => s.text.trim() === 'של');
  });

  it('deletes a saved sentence', async () => {
    await tapId('voice-browse-btn');
    await tapId('sentence-delete-0');
    await tapDialogButton(/^(Delete|מחק)$/i);
    await browse('no saved sentences', s => s.saved === '0');
    await backToMain();
  });

  it('opens the settings: the tabs, and the keyboard editor in each language', async () => {
    await tapId('voice-menu-btn');
    await waitFor(element(by.id('settings-back-btn')).atIndex(0)).toExist().withTimeout(8000);
    for (const tab of ['keys-groups', 'features', 'advanced', 'general']) {
      await element(by.id(`settings-tab-${tab}`)).atIndex(0).tap();
      await sleep(500);
    }
    // the editor's preview keyboard follows the language picked
    for (const [lang, letter] of [['he', 'ש'], ['ar', 'ض'], ['en', 'q']] as const) {
      await element(by.id(`editor-lang-${lang}`)).atIndex(0).tap();
      await waitFor(element(by.text(new RegExp(`^${letter}$`, 'i'))).atIndex(0)).toExist().withTimeout(8000);
    }
    await shot('voice-settings');
    for (const tab of ['voice', 'language']) {
      await element(by.id(`settings-tab-${tab}`)).atIndex(0).tap();
      await sleep(800);
    }
    await element(by.id('settings-back-btn')).atIndex(0).tap();
    await voice('the main screen', () => true);
  });
});
