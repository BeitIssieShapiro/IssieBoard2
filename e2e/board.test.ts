// IssieBoard (the keyboard's settings app): the editor's preview keyboard in Hebrew, English and Arabic,
// its tabs, and changing a setting (word suggestions): the preview follows, Cancel discards it, Save keeps
// it after a restart. Run with a board.* configuration (see .detoxrc.js). On Android, board-ime.test.ts
// also types with IssieBoard as the system keyboard.
import { by, device, element, expect, waitFor } from 'detox';
import { exists, launch, shot, sleep, tapDialogButton, tapIdWhenFree, tapLastId } from './helpers';

// a name of its own each run (the app can keep a deleted keyboard's name as taken)
const KEYBOARD = `E2E Keyboard ${Date.now() % 100000}`;
const letter = (l: string) => element(by.text(new RegExp(`^${l}$`, 'i'))).atIndex(0);
// a word suggestion the preview shows above the keys with no text typed (right after a language switch
// Android can still show the other language's)
const suggestion = () => element(by.text(/^(the|I'm|לא|אני)$/)).atIndex(0);

async function pickLanguage(lang: 'he' | 'en' | 'ar') {
  await element(by.id(`editor-lang-${lang}`)).atIndex(0).tap();
  await sleep(800);
}

async function featuresTab() {
  await pickLanguage('en'); // (the suggestion looked for is English)
  await waitFor(letter('q')).toExist().withTimeout(8000);
  await tapIdWhenFree('settings-tab-features');
  await waitFor(element(by.id('feature-word-suggestions'))).toExist().withTimeout(5000);
  await sleep(500);
}

// With word suggestions off the app keeps a native timer running and is never idle, and Detox would wait
// for it (even to turn its waiting back on): its waiting is off for this suite, which waits for each
// result itself.
async function start() {
  await launch();
  await device.disableSynchronization();
  await waitFor(element(by.id('editor-lang-en')).atIndex(0)).toExist().withTimeout(20000);
  // On RN 0.88.1 iPad, a UIDimmingView (PopoverDismissRegion) may appear one or more times
  // during startup (Dev Menu or status-bar popovers). Wait up to 8 s for the first one (the
  // whole startup window); after each tap wait 500 ms then loop with a 2 s timeout until
  // no more appear. The whole block is a no-op when there is no popover.
  try {
    await waitFor(element(by.id('PopoverDismissRegion')).atIndex(0)).toExist().withTimeout(8000);
    await element(by.id('PopoverDismissRegion')).atIndex(0).tap();
    await sleep(500);
    for (let i = 0; i < 10; i++) {
      try {
        await waitFor(element(by.id('PopoverDismissRegion')).atIndex(0)).toExist().withTimeout(2000);
        await element(by.id('PopoverDismissRegion')).atIndex(0).tap();
        await sleep(500);
      } catch { break; }
    }
  } catch {}
  await sleep(500);
}

// the default keyboard, current; the test's keyboards (any a run left) deleted
async function resetKeyboards() {
  await tapIdWhenFree('editor-profile-btn');
  await waitFor(element(by.id('profile-Default')).atIndex(0)).toExist().withTimeout(5000);
  for (let i = 0; i < 5 && await exists(/^profile-delete-E2E Keyboard/, 1000); i++) {
    await tapLastId(/^profile-delete-E2E Keyboard/);
    await tapDialogButton(/^(Delete|מחק|حذف)$/i);
    await sleep(1500);
  }
  if (await exists('profile-Default', 1000)) await tapLastId('profile-Default');
  await sleep(1000);
}

describe('IssieBoard', () => {
  beforeAll(async () => {
    await start();
    await pickLanguage('en');
    await resetKeyboards();
  });

  it('shows the editor with the preview keyboard', async () => {
    await pickLanguage('en');
    await waitFor(letter('q')).toExist().withTimeout(8000);
    await shot('board-start');
  });

  it('the preview follows the language: Hebrew, Arabic, English', async () => {
    for (const [lang, l] of [['he', 'ש'], ['ar', 'ض'], ['en', 'q']] as const) {
      await pickLanguage(lang);
      await waitFor(letter(l)).toExist().withTimeout(8000);
    }
  });

  it('opens each tab', async () => {
    for (const tab of ['keys-groups', 'features', 'advanced', 'general']) {
      await element(by.id(`settings-tab-${tab}`)).atIndex(0).tap();
      await sleep(600);
    }
    await pickLanguage('he');
    await element(by.id('settings-tab-nikkud')).atIndex(0).tap(); // (Hebrew and Arabic only)
    await sleep(600);
    await shot('board-nikkud');
    await element(by.id('settings-tab-general')).atIndex(0).tap();
    await pickLanguage('en');
  });

  it('turns word suggestions off: the preview drops them, and Cancel brings them back', async () => {
    await featuresTab();
    await waitFor(suggestion()).toExist().withTimeout(8000);
    await tapIdWhenFree('feature-word-suggestions');
    await waitFor(suggestion()).not.toExist().withTimeout(8000);
    await tapIdWhenFree('editor-discard-btn');
    // "Discard all changes?"
    await tapDialogButton(/^(Discard|בטל שינויים|ביטול שינויים|تجاهل)$/i);
    await waitFor(suggestion()).toExist().withTimeout(8000);
  });

  it('saves the change as a new keyboard, kept after a restart; then deletes it', async () => {
    await featuresTab();
    await tapIdWhenFree('feature-word-suggestions');
    await waitFor(suggestion()).not.toExist().withTimeout(8000);
    // the built-in keyboard is saved as a copy, with a name
    await tapIdWhenFree('editor-save-btn');
    await waitFor(element(by.id('save-as-name'))).toExist().withTimeout(5000);
    await element(by.id('save-as-name')).replaceText(KEYBOARD);
    await element(by.id('save-as-name')).tapReturnKey(); // (saves; the button misses taps while the keyboard is up)
    // the dialog can stay open after saving (and then say the name is in use): closed; the save is checked
    // below, in the keyboards list and after a restart
    try {
      await waitFor(element(by.id('save-as-name'))).not.toExist().withTimeout(5000);
    } catch {
      console.log('the Save As dialog stayed open after saving');
      await tapDialogButton(/^(Cancel|ביטול|إلغاء)$/i);
    }
    await sleep(1500);

    await start();
    await pickLanguage('en');
    await waitFor(letter('q')).toExist().withTimeout(8000);
    await expect(suggestion()).not.toExist();
    // the keyboard is listed (a phone's header can be too narrow for its name)
    await tapIdWhenFree('editor-profile-btn');
    await waitFor(element(by.id(`profile-${KEYBOARD}`)).atIndex(0)).toExist().withTimeout(5000);
    await tapLastId(`profile-${KEYBOARD}`); // (closes the list)
    await sleep(1000);
    await shot('board-saved-keyboard');

    // back to the default keyboard, and the new one deleted
    await resetKeyboards();
    await expect(element(by.id(`profile-${KEYBOARD}`))).not.toExist();
    await waitFor(suggestion()).toExist().withTimeout(8000);
  });

  it('opens About', async () => {
    if (!(await exists('settings-about-btn', 2000))) return;
    await element(by.id('settings-about-btn')).atIndex(0).tap();
    await sleep(1500);
    await shot('board-about');
    await device.pressBack?.().catch(() => {});
  });
});
