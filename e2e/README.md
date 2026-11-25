# End-to-end tests (Detox)

Smoke tests, and a bit more, of the three apps on iPad, iPhone, an Android phone and an Android tablet.

| File | App | Covers |
| --- | --- | --- |
| `voice.test.ts` | IssieVoice | typing on the embedded keyboard (English, Hebrew with the language key), delete; speaking; saving a sentence, the saved list (favorite, insert, delete); favorites on the main screen; the settings tabs and the keyboard editor's preview in each language |
| `calc.test.ts` | IssieCalc | the keypad: add, multiply and go on from a result, a negative result, delete and clear, decimals, sign, percent; the scientific keypad: parentheses, a power, π, the angle mode, memory; the settings and their tabs |
| `board.test.ts` | IssieBoard | the editor's preview keyboard in Hebrew, Arabic and English; the tabs (with Nikkud); turning word suggestions off (the preview follows; Cancel brings them back); saving the change as a new keyboard, kept after a restart, then deleting it; About |
| `board-ime.test.ts` | IssieBoard | Android only: IssieBoard as the system keyboard in English, Hebrew and Arabic, typing and deleting in a text field |

## Run

Start Metro first (`npm start`): the tests use debug builds.

Build each app once per platform (and again after native changes):

```
npm run e2e:build:ios:voice        # :board, :calc  (builds for iPad and iPhone simulators)
npm run e2e:build:android:voice    # :board, :calc
```

Then run all three apps on one kind of device (or one app, e.g. `bash scripts/e2e.sh iphone calc`):

| Device | Command | Default device (override) |
| --- | --- | --- |
| iPad simulator | `npm run e2e:ipad` | `iPad (A16)` (`DETOX_IPAD`) |
| iPhone simulator | `npm run e2e:iphone` | `iPhone 17` (`DETOX_IPHONE`) |
| Android phone emulator | `npm run e2e:android:phone` | AVD `IssieTest` (`DETOX_AVD_PHONE`) |
| Android tablet emulator | `npm run e2e:android:tablet` | AVD `IssieTablet` (`DETOX_AVD_TABLET`) |
| Android device or running emulator | `npm run e2e:android:device` | any (`DETOX_ADB_NAME`) |

A single file: `npx detox test -c voice.ipad e2e/voice.test.ts` (configurations are `<app>.<device>`, see
`.detoxrc.js`). `E2E_SCREENSHOT_DIR=/some/dir` copies the tests' screenshots there. Detox's own
screenshots and logs go to `artifacts/` (git-ignored).

## How it works

- **State:** dev builds have hidden views whose label the tests read: `voice-state`
  (`text:… speaking:0 spoken:1 lang:he`), `browse-state`, `calc-state` (`expression:… result:5 keyset:basic …`).
- **Keys of the native keyboard:** iOS: by their label; a word suggestion can show the same text, so the
  lowest match is the key. Android: by the key view's tag (its details as JSON, `"value":"h"`), since the
  order of matches differs there. Special keys: `⌫` (backspace), `עב`/`En` (language).
- **The Android system keyboard:** its window is not the app's, so Detox cannot see it: its keys come from a
  UI dump (`uiautomator dump --windows`) and are tapped with `adb`. The test switches the system keyboard with
  `adb shell ime set` after launching (launching force-stops the app, which resets the keyboard), shows the
  on-screen keyboard with a hardware keyboard too, and puts the device's keyboard back at the end.
- **Waiting:** in IssieBoard, with word suggestions off, the app keeps a native timer running and is never idle,
  so that suite turns Detox's waiting off and waits for each result itself.
- On iOS the apps are launched with `e2e=1`, which hides the dev warnings banner (it covers the keyboard).

## Not covered

Spoken audio itself (only that speaking started and ended), voices and language settings in depth, the Keys
Groups / Nikkud / Advanced panels' options, colors, importing and sharing keyboards, the calculator's 2nd
functions, and the iOS system keyboard (keyboard extensions must be enabled in Settings by hand).
