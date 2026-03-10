# IssieVoice Android Setup

This document explains how the Android project is structured to support both IssieBoard (keyboard configurator) and IssieVoice (assistive communication) apps from the same codebase.

## Architecture Overview

The Android app uses **Product Flavors** to build two separate apps from the same codebase:

1. **issieboard** - The keyboard configurator app (org.issieshapiro.issieboard)
2. **issievoice** - The assistive communication app (org.issieshapiro.issievoice)

This mirrors the iOS setup where both apps share the same Xcode project but use different bundle identifiers and targets.

## Directory Structure

```
android/app/src/
├── main/                          # Shared code for both apps
│   ├── java/org/issieshapiro/issieboard/
│   │   ├── MainApplication.kt     # Shared React Native application
│   │   ├── keyboards/             # Shared keyboard services
│   │   └── shared/                # Shared keyboard engine code
│   ├── res/                       # Shared resources
│   └── AndroidManifest.xml        # Base manifest (common config)
│
├── issieboard/                    # IssieBoard-specific code
│   ├── java/org/issieshapiro/issieboard/
│   │   └── MainActivity.kt        # Returns "IssieBoardNG" component
│   └── AndroidManifest.xml        # IssieBoard activity + keyboard services
│
└── issievoice/                    # IssieVoice-specific code
    ├── java/org/issieshapiro/issieboard/
    │   └── MainActivity.kt        # Returns "IssieVoice" component
    └── AndroidManifest.xml        # IssieVoice activity only (no keyboards)
```

## How It Works

### Component Name Selection

The key mechanism is in each flavor's `MainActivity.kt`:

**IssieBoard** (`src/issieboard/java/.../MainActivity.kt`):
```kotlin
override fun getMainComponentName(): String = "IssieBoardNG"
```

**IssieVoice** (`src/issievoice/java/.../MainActivity.kt`):
```kotlin
override fun getMainComponentName(): String = "IssieVoice"
```

This determines which React Native component is loaded, corresponding to the registrations in `index.js`:

```javascript
AppRegistry.registerComponent('IssieBoardNG', () => AppNavigator);
AppRegistry.registerComponent('IssieVoice', () => IssieVoice);
```

### Build Configuration

The `app/build.gradle` defines two product flavors:

```gradle
flavorDimensions = ["app"]
productFlavors {
    issieboard {
        dimension "app"
        applicationId "org.issieshapiro.issieboard"
        resValue "string", "app_name", "IssieBoard"
    }
    issievoice {
        dimension "app"
        applicationId "org.issieshapiro.issievoice"
        resValue "string", "app_name", "IssieVoice"
    }
}
```

This creates separate application IDs so both apps can be installed simultaneously on the same device.

## Building and Running

### Development (Metro Bundler)

1. Start the Metro bundler:
   ```bash
   npm start
   ```

2. Run the IssieBoard app:
   ```bash
   npm run android
   # or explicitly:
   npx react-native run-android --mode=issieboardDebug
   ```

3. Run the IssieVoice app:
   ```bash
   npx react-native run-android --mode=issievoiceDebug
   ```

### Direct Gradle Builds

Build IssieBoard:
```bash
cd android
./gradlew assembleIssieboardDebug
./gradlew installIssieboardDebug
```

Build IssieVoice:
```bash
cd android
./gradlew assembleIssievoiceDebug
./gradlew installIssievoiceDebug
```

### Release Builds

```bash
cd android
./gradlew assembleIssieboardRelease
./gradlew assembleIssievoiceRelease
```

## Gradle Tasks

The product flavors create the following build variants:

- `issieboardDebug` - IssieBoard debug build
- `issieboardRelease` - IssieBoard release build
- `issievoiceDebug` - IssieVoice debug build
- `issievoiceRelease` - IssieVoice release build

View all available tasks:
```bash
cd android && ./gradlew tasks
```

## Manifest Merging

Android merges manifests in the following order:
1. Flavor-specific manifest (`src/issieboard/AndroidManifest.xml` or `src/issievoice/AndroidManifest.xml`)
2. Main manifest (`src/main/AndroidManifest.xml`)

**IssieBoard manifest** includes:
- Main activity
- Deep link for `issieboard://` URLs
- Keyboard services (Hebrew, English, Arabic)

**IssieVoice manifest** includes:
- Main activity with adaptive screen orientation:
  - **Phones** (small/normal screens): Portrait only (`SCREEN_ORIENTATION_SENSOR_PORTRAIT`)
  - **Tablets** (large/xlarge screens): All orientations (`SCREEN_ORIENTATION_FULL_SENSOR`)
- No keyboard services (uses KeyboardPreview component instead)
- Orientation is set programmatically in `MainActivity.onCreate()` based on screen size

## Testing Both Apps

Both apps can be installed on the same device simultaneously since they have different application IDs:

```bash
# Install both
npx react-native run-android --mode=issieboardDebug
npx react-native run-android --mode=issievoiceDebug

# Both apps appear separately in the launcher
```

## React Native Component Registration

The apps load different React Native components based on the component name returned by `MainActivity`:

- **IssieBoardNG** → `src/AppNavigator.tsx` → Keyboard configurator UI
- **IssieVoice** → `apps/issievoice/App.tsx` → Text-to-speech communication UI

## Comparison with iOS

### Screen Orientation

Both platforms support adaptive screen orientation for IssieVoice:

**iOS** (via Info.plist):
- `UISupportedInterfaceOrientations`: Portrait only for iPhones
- `UISupportedInterfaceOrientations~ipad`: All orientations for iPads

**Android** (via MainActivity.onCreate()):
- Phones (SCREENLAYOUT_SIZE_SMALL/NORMAL): `SCREEN_ORIENTATION_SENSOR_PORTRAIT`
- Tablets (SCREENLAYOUT_SIZE_LARGE/XLARGE): `SCREEN_ORIENTATION_FULL_SENSOR`
- Threshold: 600dp smallest width (7" tablets and larger)

| Aspect | iOS | Android |
|--------|-----|---------|
| App Separation | Separate targets in Xcode | Product flavors in Gradle |
| Bundle ID | Set in Xcode target | Set in `productFlavors` |
| Component Name | Detected from bundle ID in AppDelegate | Returned by MainActivity override |
| Shared Code | ios/Shared/ | android/app/src/main/ |
| App-Specific Code | ios/IssieBoardNG/, ios/IssieVoice/ | src/issieboard/, src/issievoice/ |

## Troubleshooting

### Wrong app launches
- Clean build: `cd android && ./gradlew clean`
- Rebuild: `npx react-native run-android --mode=issievoiceDebug`

### Both apps use same configuration
- This is expected - they share the same SharedPreferences storage
- Both apps read from `org.issieshapiro.issieboard_preferences`

### Metro bundler not reloading
- Restart Metro: `npm start -- --reset-cache`
- Reload app: Press `r` in Metro terminal or shake device → Reload
