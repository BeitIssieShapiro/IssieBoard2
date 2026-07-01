# Android Build, Deploy & Publish Guide

Project: `IssieBoardNG` — two apps built from one codebase via Gradle product flavors.

| Flavor | App ID | Component |
|--------|--------|-----------|
| `issieboard` | `org.issieshapiro.issieboard` | `IssieBoardNG` |
| `issievoice` | `org.issieshapiro.issievoice` | `IssieVoice` |

All `./gradlew` commands run from `IssieBoardNG/android/`.
All `adb` commands assume one device/emulator connected (`~/Library/Android/sdk/platform-tools/adb`).

---

## 1. Environment Setup

```bash
# Verify tools
~/Library/Android/sdk/platform-tools/adb version
~/Library/Android/sdk/emulator/emulator -list-avds
cd IssieBoardNG/android && ./gradlew --version
```

Available AVDs: `Pixel_3a`, `Pixel_Tablet`

---

## 2. Start an Emulator

```bash
# Launch (pick one)
~/Library/Android/sdk/emulator/emulator -avd Pixel_Tablet -no-snapshot-load &

# Wait for full boot
ADB=~/Library/Android/sdk/platform-tools/adb
$ADB wait-for-device
until [ "$($ADB shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; do sleep 2; done
echo "booted"
```

---

## 3. Metro Bundler (JS changes)

Metro serves the JS bundle to the app at runtime. Must be running for JS changes to work. The user prefers to run it himself.

```bash
# From IssieBoardNG/
npm start
```

After Metro is up, expose its port to the emulator:

```bash
~/Library/Android/sdk/platform-tools/adb reverse tcp:8081 tcp:8081
```

**Re-run `adb reverse` every time the emulator restarts.**

If Metro fails with `EADDRINUSE :::8081`:

```bash
lsof -ti :8081 | xargs kill -9
```

---

## 4. Build

```bash
cd IssieBoardNG/android

# Debug builds
./gradlew assembleIssieboardDebug --no-daemon
./gradlew assembleIssievoiceDebug --no-daemon

# Release builds (requires signing config)
./gradlew assembleIssieboardRelease --no-daemon
./gradlew assembleIssievoiceRelease --no-daemon
```

APK output paths:
- `app/build/outputs/apk/issieboard/debug/app-issieboard-debug.apk`
- `app/build/outputs/apk/issievoice/debug/app-issievoice-debug.apk`

> **Do not build both flavors in the same Gradle invocation** — the daemon runs out of memory. Build sequentially.

---

## 5. Install & Launch

```bash
ADB=~/Library/Android/sdk/platform-tools/adb

# Install
$ADB install -r app/build/outputs/apk/issieboard/debug/app-issieboard-debug.apk
$ADB install -r app/build/outputs/apk/issievoice/debug/app-issievoice-debug.apk

# Launch IssieBoard
$ADB shell am start -n org.issieshapiro.issieboard/.MainActivity

# Launch IssieVoice (Java package stays issieboard, app ID changes)
$ADB shell am start -n org.issieshapiro.issievoice/org.issieshapiro.issieboard.MainActivity
```

To verify the correct launcher activity for any installed package:

```bash
$ADB shell cmd package resolve-activity --brief \
  -a android.intent.action.MAIN -c android.intent.category.LAUNCHER \
  org.issieshapiro.issievoice
```

---

## 6. Native Code Changes (Kotlin/XML)

When you change native Android code (anything under `android/`), **JS hot-reload is not enough** — you must rebuild and reinstall the APK.

Full cycle for a native change:

```bash
cd IssieBoardNG/android

# 1. Build
./gradlew assembleIssieboardDebug --no-daemon   # or issievoice

# 2. Install
~/Library/Android/sdk/platform-tools/adb install -r \
  app/build/outputs/apk/issieboard/debug/app-issieboard-debug.apk

# 3. Re-expose Metro port (emulator keeps running, port survives)
~/Library/Android/sdk/platform-tools/adb reverse tcp:8081 tcp:8081

# 4. Launch
~/Library/Android/sdk/platform-tools/adb shell am start \
  -n org.issieshapiro.issieboard/.MainActivity
```

> Gradle's incremental build means only changed modules recompile. Subsequent builds after the first are fast.

---

## 7. Logcat

```bash
ADB=~/Library/Android/sdk/platform-tools/adb

# All logs from IssieBoard
$ADB logcat --pid=$($ADB shell pidof org.issieshapiro.issieboard) 2>/dev/null

# All logs from IssieVoice
$ADB logcat --pid=$($ADB shell pidof org.issieshapiro.issievoice) 2>/dev/null

# Filter by tag
$ADB logcat -s ReactNative:V ReactNativeJS:V

# Save to file
$ADB logcat -d > /tmp/issie_logcat.txt

# Clear logcat buffer
$ADB logcat -c
```

Useful combined filter (React Native errors + your tag):

```bash
$ADB logcat ReactNative:E ReactNativeJS:E IssieBoard:V *:S
```

---

## 8. Clean Build

Use when you hit weird Gradle cache issues:

```bash
cd IssieBoardNG/android
./gradlew clean --no-daemon
# Or use the repo-level script:
~/dev/Issie/clean-builds.sh
```

---

## 9. Publish (Play Store)

Deploy scripts are in `IssieBoardNG/scripts/deploy-android.sh`, called via:

```bash
cd IssieBoardNG
npm run deploy:android:issieboard
npm run deploy:android:issievoice
```

These build a release APK/AAB, sign it (keys in `issie-shared/android/keys/`), and upload via the shared deploy script at `../issie-shared/android/deploy.sh`.

Version codes are in `IssieBoardNG/android/version.properties`:

```properties
issieboard.versionCode=6
issieboard.versionName=1.0
issievoice.versionCode=2
issievoice.versionName=1.0
```

Bump `versionCode` by 1 before every Play Store upload.

---

## 10. Icon Assets

Icons are split per flavor — **never use Image Asset tool with `main` selected**:

| Source | Location |
|--------|----------|
| IssieBoard foreground | `app/src/issieboard/res/drawable/ic_launcher_foreground.xml` |
| IssieVoice foreground | `app/src/issievoice/res/drawable/ic_launcher_foreground.xml` |
| IssieBoard rasters | `app/src/issieboard/res/mipmap-*/` |
| IssieVoice rasters | `app/src/issievoice/res/mipmap-*/` |
| Adaptive icon XML (shared) | `app/src/main/res/mipmap-anydpi-v26/` |
| Background color (shared) | `app/src/main/res/values/ic_launcher_background.xml` → `#00BCF5` |

To regenerate rasters in Android Studio:
1. Switch Build Variant to `issieboardDebug` or `issievoiceDebug` (bottom-left panel)
2. Right-click the **flavor's** `res/` folder → New → Image Asset
3. Move any files AS drops into `main/res/mipmap-*/` to the correct flavor folder
