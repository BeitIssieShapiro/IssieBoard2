# Android Build & Deploy Setup

This document provides instructions for building and deploying the IssieBoard Android app.

## Prerequisites

### Java Runtime

The Android build requires Java to be installed and configured. Multiple OpenJDK versions are available via Homebrew:

```bash
ls -d /opt/homebrew/opt/openjdk*
# Shows: openjdk, openjdk@20, openjdk@21, openjdk@22, openjdk@23, openjdk@25
```

**Recommended: OpenJDK 21** (best compatibility with current Android Gradle setup)

### Required Environment Variables

Before running any Gradle commands, set:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
export PATH="$JAVA_HOME/bin:$PATH"
```

Verify Java is available:
```bash
java -version
# Should show: openjdk version "..." (Homebrew build)
```

### Android SDK

Android SDK is installed at:
```
/Users/i022021/Library/Android/sdk
```

Platform tools (adb) are available at:
```
/Users/i022021/Library/Android/sdk/platform-tools/adb
```

## Build Commands

### Quick Build & Deploy

```bash
# Set Java environment
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
export PATH="$JAVA_HOME/bin:$PATH"

# Build and install to connected device/emulator
cd android && ./gradlew installDebug
```

### Using React Native CLI

```bash
# Start metro bundler in background (if not already running)
npm start &

# Build and deploy (will start emulator if needed)
npm run android
```

### Manual Emulator Management

```bash
# List available emulators
~/Library/Android/sdk/emulator/emulator -list-avds

# Start a specific emulator
~/Library/Android/sdk/emulator/emulator @Pixel_3a &

# Check connected devices
~/Library/Android/sdk/platform-tools/adb devices
```

## Build Output

- **APK**: `android/app/build/outputs/apk/debug/app-debug.apk`
- **Build logs**: `android/build/reports/`
- **Gradle daemon**: Runs in background, use `./gradlew --stop` to kill

## Common Build Issues

### "Unable to locate a Java Runtime"

**Problem**: Gradle cannot find Java.

**Solution**: Set `JAVA_HOME` environment variable before building:
```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
export PATH="$JAVA_HOME/bin:$PATH"
```

### ADB "Operation not permitted"

**Problem**: ADB daemon has permission issues.

**Solution**:
```bash
# Kill existing ADB server
killall adb

# Restart with proper permissions
~/Library/Android/sdk/platform-tools/adb start-server
```

### Emulator fails to start

**Problem**: `react-native run-android` cannot start emulator.

**Solution**: Start emulator manually first:
```bash
~/Library/Android/sdk/emulator/emulator @Pixel_3a &
# Wait for boot, then run npm run android
```

## Build Configuration

- **Min SDK**: 24 (Android 7.0)
- **Target SDK**: 36 (Android 15)
- **Kotlin**: 2.2.0
- **Gradle**: 9.0.0
- **Build time**: ~1-2 minutes (incremental builds much faster)

## Keyboard Configuration Generation

The build automatically runs the `generateKeyboardConfigs` task, which:
1. Builds keyboard configs from `keyboards/*.json`
2. Copies dictionary binaries from `dict/bin/`
3. Outputs to `android/app/src/main/assets/`

To manually rebuild keyboard configs:
```bash
npm run build:keyboards
```

## Testing

```bash
# Run Android unit tests
npm run test:android

# Run specific test class
cd android && ./gradlew test --tests "*.KeyboardRendererTest"
```

## Debugging

### View Logs

```bash
# All logs
~/Library/Android/sdk/platform-tools/adb logcat

# Filter by app
~/Library/Android/sdk/platform-tools/adb logcat | grep IssieBoardNG

# Filter by tag
~/Library/Android/sdk/platform-tools/adb logcat -s KeyboardRenderer
```

### Debug Mode

Build in debug mode (default for `installDebug`):
- Includes debug symbols
- Allows Chrome DevTools debugging
- React Native dev menu available (shake device or `adb shell input keyevent 82`)

### Release Build

```bash
cd android && ./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```

## Clean Build

If builds are failing or behaving unexpectedly:

```bash
cd android

# Clean all build artifacts
./gradlew clean

# Clear Gradle cache
./gradlew cleanBuildCache

# Nuclear option: delete all build directories
rm -rf app/build build .gradle
```

## Performance Tips

### Enable Configuration Cache

Add to `~/.gradle/gradle.properties`:
```properties
org.gradle.configuration-cache=true
```

### Use Gradle Daemon

The daemon stays running between builds for faster startup:
```bash
# Check daemon status
./gradlew --status

# Stop daemon (rarely needed)
./gradlew --stop
```

### Parallel Builds

Already enabled in `gradle.properties`:
```properties
org.gradle.parallel=true
```

## Troubleshooting Checklist

When builds fail:

1. ✅ **Is Java configured?**
   ```bash
   echo $JAVA_HOME
   java -version
   ```

2. ✅ **Is the emulator running?**
   ```bash
   adb devices
   ```

3. ✅ **Are keyboard configs built?**
   ```bash
   ls android/app/src/main/assets/*_config.json
   ```

4. ✅ **Is metro bundler running?**
   ```bash
   npm start
   ```

5. ✅ **Try clean build?**
   ```bash
   cd android && ./gradlew clean && ./gradlew installDebug
   ```
