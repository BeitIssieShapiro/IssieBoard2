# Android Release Build & Deployment Guide

This guide explains how to build a signed Android App Bundle (.aab) and deploy it to Google Play Store.

## Prerequisites

1. **Java Development Kit (JDK)** - Required for keytool and Gradle
2. **Android SDK** - Already installed if you can run the app
3. **Node.js** - For npm dependencies

## One-Time Setup

### Step 1: Set Up Release Keystore

**Option 1: Use Shared Keystore from IssieDice (Recommended)**

If you already have the IssieDice/IssieSays keystore:

```bash
# Copy the shared keystore
cp ../IssieDice/uploadkeystore.jks android/app/uploadkeystore.jks
```

Then use the same credentials you use for IssieDice in `gradle.properties`:
- Store file: `uploadkeystore.jks`
- Alias: `upload`
- Use your existing IssieDice passwords

**Benefits:**
- ✅ One keystore for all your apps
- ✅ Simplified key management
- ✅ Same developer signature

**Option 2: Generate a New Keystore**

If you don't have IssieDice keystore or want a separate one:

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore android/app/issieboardng-release.keystore \
  -alias issieboardng \
  -keyalg RSA -keysize 2048 -validity 10000
```

You'll be prompted for:
- Keystore password (remember this!)
- Key password (can be same as keystore password)
- Your name, organization, etc.

**IMPORTANT**: 
- Store the keystore file safely - you cannot publish updates without it
- Store the passwords securely (use a password manager)
- Never commit the keystore or passwords to git

### Step 2: Configure Gradle Properties

1. Copy the example file:
```bash
cp android/gradle.properties.example android/gradle.properties
```

2. Edit `android/gradle.properties` and update the signing credentials:
```properties
ISSIE_UPLOAD_STORE_FILE=issieboardng-release.keystore
ISSIE_UPLOAD_KEY_ALIAS=issieboardng
ISSIE_UPLOAD_STORE_PASSWORD=your_actual_keystore_password
ISSIE_UPLOAD_KEY_PASSWORD=your_actual_key_password
```

**Note**: `gradle.properties` is already in `.gitignore` to prevent accidental commits.

## Building a Release

### Automated Build (Recommended)

Use the automated build script:

```bash
./scripts/build-android-release.sh
```

This script will:
1. ✅ Check for required files (gradle.properties, keystore)
2. ✅ Install npm dependencies
3. ✅ Clean previous builds
4. ✅ Build signed Android App Bundle (.aab)
5. ✅ Copy to `releases/` directory with version number

### Manual Build

If you prefer to build manually:

```bash
# 1. Install dependencies
npm install

# 2. Clean previous builds
cd android
./gradlew clean

# 3. Build release bundle
./gradlew bundleRelease

# 4. Find output
# The .aab file will be at:
# android/app/build/outputs/bundle/release/app-release.aab
```

## Version Management

Before building, update the version in `android/app/build.gradle`:

```gradle
defaultConfig {
    applicationId "org.issieshapiro.issieboard"
    minSdkVersion rootProject.ext.minSdkVersion
    targetSdkVersion rootProject.ext.targetSdkVersion
    versionCode 2        // ← Increment this for each release
    versionName "1.1"    // ← Update version name
}
```

**Version Rules:**
- `versionCode`: Must be an integer that increases with each release (e.g., 1, 2, 3...)
- `versionName`: String version for users (e.g., "1.0", "1.1", "2.0")

## Testing the Bundle Locally

Before uploading to Play Store, test the bundle:

```bash
# Install bundletool if you don't have it
brew install bundletool

# Generate a universal APK for testing
bundletool build-apks \
  --bundle=releases/IssieBoard-v1.0-1.aab \
  --output=app.apks \
  --mode=universal

# Extract and install
unzip app.apks -d apks
adb install apks/universal.apk
```

## Deploying to Google Play

### First-Time Setup

1. Go to [Google Play Console](https://play.google.com/console)
2. Create a new app
3. Fill in app details:
   - App name: IssieBoardNG
   - Default language
   - App type: App
   - Category: Tools
4. Complete the store listing
5. Set content rating
6. Add privacy policy URL
7. Complete app content questionnaire

### Upload Release

1. Navigate to **Production** → **Create new release**
2. Upload the `.aab` file from `releases/` directory
3. Add release notes describing changes
4. Review and roll out

### Play Store Assets Required

You'll need to provide:
- **App icon**: 512x512 PNG
- **Feature graphic**: 1024x500 PNG
- **Screenshots**: At least 2 phone screenshots
- **App description**: Short and full descriptions
- **Privacy policy**: URL to your privacy policy

## Troubleshooting

### "Keystore file not found"

Make sure the keystore path in `gradle.properties` is correct:
```properties
ISSIE_UPLOAD_STORE_FILE=issieboardng-release.keystore
```

The file should be at: `android/app/issieboardng-release.keystore`

### "Could not read key ... from store"

Check your passwords in `gradle.properties` are correct.

### Build fails with signing errors

1. Verify keystore exists: `ls android/app/*.keystore`
2. Test keystore: `keytool -list -v -keystore android/app/issieboardng-release.keystore`
3. Ensure `gradle.properties` has correct credentials

### "Package name already exists"

If testing on a device that already has the app:
```bash
adb uninstall org.issieshapiro.issieboard
```

## Security Best Practices

1. ✅ Never commit `gradle.properties` (already in `.gitignore`)
2. ✅ Never commit keystore file (should be in `.gitignore`)
3. ✅ Store keystore backup in secure location (encrypted cloud storage)
4. ✅ Use different passwords for keystore and key
5. ✅ Consider using Play App Signing for additional security

## Automated Deployment (Future)

For automated deployment via CI/CD, you can use:

1. **GitHub Actions** with encrypted secrets
2. **Fastlane** with `supply` plugin
3. **Google Play Console API**

Example Fastlane setup:
```ruby
lane :deploy do
  gradle(
    task: "bundle",
    build_type: "Release"
  )
  
  upload_to_play_store(
    track: "internal",  # or "alpha", "beta", "production"
    aab: "android/app/build/outputs/bundle/release/app-release.aab"
  )
end
```

## File Structure

```
android/
├── app/
│   ├── build.gradle                    # Version config & signing
│   ├── issieboardng-release.keystore   # Release keystore (DO NOT COMMIT)
│   └── debug.keystore                  # Debug keystore (committed)
├── gradle.properties                   # Signing credentials (DO NOT COMMIT)
└── gradle.properties.example           # Template file (committed)

releases/
└── IssieBoardNG-v1.0-1.aab            # Built release bundles

scripts/
└── build-android-release.sh           # Automated build script
```

## Quick Reference

```bash
# Build release
./scripts/build-android-release.sh

# Test locally
bundletool build-apks --bundle=releases/IssieBoardNG-v1.0-1.aab --output=app.apks --mode=universal

# Check keystore
keytool -list -v -keystore android/app/issieboardng-release.keystore

# Update version then rebuild
# Edit android/app/build.gradle: versionCode and versionName
```

## Resources

- [React Native Signed APK Android](https://reactnative.dev/docs/signed-apk-android)
- [Google Play Console](https://play.google.com/console)
- [Android App Bundle](https://developer.android.com/guide/app-bundle)
- [Bundletool](https://developer.android.com/studio/command-line/bundletool)

---

*Last Updated: 2026-02-11*