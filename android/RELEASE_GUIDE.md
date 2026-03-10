# Android Release Build & Deployment Guide

This guide explains how to build signed Android App Bundles (.aab) and deploy them to Google Play Store for both **IssieBoard** and **IssieVoice**.

## Overview

This project uses **product flavors** to build two separate apps from the same codebase:
- **IssieBoard** (`org.issieshapiro.issieboard`) - Keyboard extension app
- **IssieVoice** (`org.issieshapiro.issievoice`) - AAC communication app

Both apps share the same signing keystore and have independent version management.

## Prerequisites

1. **Java Development Kit (JDK)** - Required for keytool and Gradle
2. **Android SDK** - Already installed if you can run the app
3. **Node.js** - For npm dependencies
4. **Ruby & Bundler** - For fastlane (automated deployment)

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

### Step 3: Install Fastlane

Fastlane automates the build and deployment process:

```bash
# Install Ruby dependencies
bundle install
```

This will install fastlane and its dependencies.

### Step 4: Set Up Google Play API Access

To enable automated uploads to Google Play, follow the comprehensive guide:

📖 **See [GOOGLE_PLAY_SETUP.md](./GOOGLE_PLAY_SETUP.md) for detailed instructions**

Summary:
1. Create a service account in Google Cloud Console
2. Grant it access to Google Play Console
3. Download the JSON key file
4. Place it at: `android/fastlane/release-admin-creds.json`
5. Complete at least one manual upload for each app (required by Google)

## Version Management

Versions are now managed in `android/version.properties`:

```properties
# IssieBoard versions
issieboard.versionCode=1
issieboard.versionName=1.0.0

# IssieVoice versions
issievoice.versionCode=1
issievoice.versionName=1.0.0
```

**Version Rules:**
- `versionCode`: Integer that must increase with each release (1, 2, 3...)
- `versionName`: User-facing version string (e.g., "1.0.0", "1.1.0", "2.0.0")
- Each app has independent version codes/names
- **Automated deployment automatically increments versionCode**

**Manual version updates** (if needed):
- Edit `android/version.properties`
- Update the appropriate `versionCode` and/or `versionName`
- Commit the change

## Deploying to Google Play (Automated)

### Deploy IssieBoard

```bash
npm run deploy:android:issieboard
```

This will:
1. ✅ Verify credentials exist
2. ✅ Auto-increment versionCode in `version.properties`
3. ✅ Build signed AAB (`app-issieboard-release.aab`)
4. ✅ Upload to Google Play internal track
5. ✅ Commit version bump to git

### Deploy IssieVoice

```bash
npm run deploy:android:issievoice
```

Same process as above for the IssieVoice app.

### What Happens During Deployment

1. **Pre-flight checks:**
   - Ensures `release-admin-creds.json` exists
   - Ensures `gradle.properties` exists with signing config
   - Ensures git working directory is clean

2. **Version increment:**
   - Reads current versionCode from `version.properties`
   - Increments it by 1
   - Writes back to file

3. **Build:**
   - Runs `./gradlew bundleIssieboardRelease` (or `bundleIssievoiceRelease`)
   - Output: `android/app/build/outputs/bundle/[flavor]Release/app-[flavor]-release.aab`

4. **Upload:**
   - Uses Google Play API to upload AAB
   - Targets internal testing track
   - Skips metadata/screenshots upload (manage these in Play Console UI)

5. **Commit:**
   - Commits updated `version.properties` with message: "Bump [flavor] version for release"

## Building Without Deploying (Manual)

If you want to build AABs locally without uploading:

### IssieBoard

```bash
cd android
./gradlew bundleIssieboardRelease
# Output: android/app/build/outputs/bundle/issieboardRelease/app-issieboard-release.aab
```

### IssieVoice

```bash
cd android
./gradlew bundleIssievoiceRelease
# Output: android/app/build/outputs/bundle/issievoiceRelease/app-issievoice-release.aab
```

## Testing the Bundle Locally

Before uploading to Play Store, test the AAB locally:

```bash
# Install bundletool if you don't have it
brew install bundletool

# Generate a universal APK for testing (IssieBoard example)
bundletool build-apks \
  --bundle=android/app/build/outputs/bundle/issieboardRelease/app-issieboard-release.aab \
  --output=issieboard-test.apks \
  --mode=universal

# Extract and install
unzip issieboard-test.apks -d apks
adb install apks/universal.apk
```

Repeat with `app-issievoice-release.aab` for IssieVoice testing.

## First-Time Google Play Console Setup

You need to create separate app entries for each product:

### Create IssieBoard App

1. Go to [Google Play Console](https://play.google.com/console)
2. Click **Create app**
3. Fill in app details:
   - App name: **IssieBoard**
   - Package name: `org.issieshapiro.issieboard`
   - Default language: English (or your preference)
   - App type: App
   - Category: Tools
   - Free or paid: Free
4. Complete the store listing
5. Set content rating
6. Add privacy policy URL
7. Complete app content questionnaire

### Create IssieVoice App

Repeat the above steps for IssieVoice:
- App name: **IssieVoice**
- Package name: `org.issieshapiro.issievoice`
- Category: Medical (or Tools)

### Initial Manual Upload (Required)

**Important:** Google Play requires at least one manual upload before API access works.

For each app:

1. Build the release AAB:
   ```bash
   cd android
   ./gradlew bundleIssieboardRelease  # or bundleIssievoiceRelease
   ```

2. In Google Play Console:
   - Go to the app
   - Navigate to **Release** → **Testing** → **Internal testing**
   - Click **Create new release**
   - Upload the AAB file
   - Fill in release notes (e.g., "Initial release")
   - Click **Save** → **Review release** → **Start rollout to Internal testing**

3. Once successful, automated deployment will work for future releases

### Play Store Assets Required

For each app, you'll need to provide:
- **App icon**: 512x512 PNG
- **Feature graphic**: 1024x500 PNG
- **Screenshots**: At least 2 phone screenshots
- **App description**: Short (80 chars) and full (4000 chars) descriptions
- **Privacy policy**: URL to your privacy policy

## Monitoring Releases

After deploying with `npm run deploy:android:[flavor]`:

1. Go to [Google Play Console](https://play.google.com/console)
2. Select the app (IssieBoard or IssieVoice)
3. Navigate to **Release** → **Testing** → **Internal testing**
4. You should see the new release with incremented version code
5. Click **Review release** → **Start rollout** to make it available to testers

To promote to production:
- Navigate to **Release** → **Production**
- Click **Promote release** and select from internal testing
- Review and start rollout

## Troubleshooting

### Deployment Issues

#### "git status is not clean"

Fastlane requires a clean git working directory:
```bash
git status
# Commit or stash any changes
git add .
git commit -m "Your changes"
```

#### "release-admin-creds.json not found"

Follow [GOOGLE_PLAY_SETUP.md](./GOOGLE_PLAY_SETUP.md) to set up Google Play API access.

#### "The current user has insufficient permissions"

- Ensure service account has **Release manager** role in Play Console
- Wait a few minutes for permissions to propagate
- Verify you granted access to the specific app (IssieBoard or IssieVoice)

#### "Version code X has already been used"

This usually happens if:
- The upload failed but the version was already incremented
- You need to manually increment the version in `version.properties`
- Or rollback the git commit and try again

### Build Issues

#### "Keystore file not found"

Make sure the keystore path in `gradle.properties` is correct:
```properties
ISSIE_UPLOAD_STORE_FILE=uploadkeystore.jks
```

The file should be at: `android/app/uploadkeystore.jks`

#### "Could not read key ... from store"

Check your passwords in `gradle.properties` are correct.

#### Build fails with signing errors

1. Verify keystore exists: `ls android/app/*.jks`
2. Test keystore: `keytool -list -v -keystore android/app/uploadkeystore.jks`
3. Ensure `gradle.properties` has correct credentials

### Version Management Issues

#### "versionCode must be greater than previous version"

Google Play requires strictly increasing version codes. Check:
1. Current version in Play Console
2. Version in `version.properties`
3. Manually increment if needed

#### Both apps showing same version

This is expected initially (both start at versionCode=1), but they increment independently with each deployment.

### Testing Issues

#### "Package name already exists"

If testing on a device that already has the app:
```bash
adb uninstall org.issieshapiro.issieboard
# or
adb uninstall org.issieshapiro.issievoice
```

## Security Best Practices

1. ✅ Never commit `gradle.properties` (already in `.gitignore`)
2. ✅ Never commit keystore files - `.jks` and `.keystore` (already in `.gitignore`)
3. ✅ Never commit `release-admin-creds.json` (already in `.gitignore`)
4. ✅ Store keystore backup in secure location (encrypted cloud storage)
5. ✅ Use different passwords for keystore and key
6. ✅ Consider using Play App Signing for additional security
7. ✅ Rotate service account keys periodically

## CI/CD Setup (GitHub Actions, GitLab CI, etc.)

For automated deployment in CI/CD pipelines:

### Store Secrets

Store the following as encrypted secrets in your CI system:
- `ISSIE_UPLOAD_STORE_PASSWORD` - Keystore password
- `ISSIE_UPLOAD_KEY_PASSWORD` - Key password
- `GOOGLE_PLAY_JSON_KEY` - Contents of release-admin-creds.json
- Keystore file as base64 (or upload as file artifact)

### Example GitHub Actions Workflow

```yaml
name: Deploy to Google Play

on:
  workflow_dispatch:
    inputs:
      flavor:
        description: 'Flavor to deploy (issieboard or issievoice)'
        required: true
        type: choice
        options:
          - issieboard
          - issievoice

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up JDK 17
        uses: actions/setup-java@v3
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Set up Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.2'
          bundler-cache: true

      - name: Install dependencies
        run: npm install

      - name: Decode keystore
        run: |
          echo "${{ secrets.KEYSTORE_BASE64 }}" | base64 -d > android/app/uploadkeystore.jks

      - name: Create gradle.properties
        run: |
          cat > android/gradle.properties << EOF
          ISSIE_UPLOAD_STORE_FILE=uploadkeystore.jks
          ISSIE_UPLOAD_KEY_ALIAS=key0
          ISSIE_UPLOAD_STORE_PASSWORD=${{ secrets.ISSIE_UPLOAD_STORE_PASSWORD }}
          ISSIE_UPLOAD_KEY_PASSWORD=${{ secrets.ISSIE_UPLOAD_KEY_PASSWORD }}
          EOF

      - name: Create Google Play key
        run: |
          echo '${{ secrets.GOOGLE_PLAY_JSON_KEY }}' > android/fastlane/release-admin-creds.json

      - name: Deploy to Google Play
        run: |
          cd android
          bundle exec fastlane deploy_${{ github.event.inputs.flavor }}
```

## Quick Reference

```bash
# Deploy IssieBoard
npm run deploy:android:issieboard

# Deploy IssieVoice
npm run deploy:android:issievoice

# Build without deploying
cd android
./gradlew bundleIssieboardRelease
./gradlew bundleIssievoiceRelease

# Test build locally
bundletool build-apks \
  --bundle=android/app/build/outputs/bundle/issieboardRelease/app-issieboard-release.aab \
  --output=test.apks \
  --mode=universal

# Check keystore
keytool -list -v -keystore android/app/uploadkeystore.jks

# View current versions
cat android/version.properties

# Manually increment version (if needed)
# Edit android/version.properties
```

## File Structure

```
android/
├── app/
│   ├── build.gradle                    # Version loaded from version.properties
│   ├── uploadkeystore.jks              # Release keystore (DO NOT COMMIT)
│   ├── debug.keystore                  # Debug keystore (committed)
│   └── src/
│       ├── main/                       # Shared code
│       ├── issieboard/                 # IssieBoard-specific code
│       └── issievoice/                 # IssieVoice-specific code
├── fastlane/
│   ├── Appfile                         # Fastlane app configuration
│   ├── Fastfile                        # Deployment lanes
│   └── release-admin-creds.json        # Google Play API key (DO NOT COMMIT)
├── gradle.properties                   # Signing credentials (DO NOT COMMIT)
├── gradle.properties.example           # Template file (committed)
├── version.properties                  # Version tracking (COMMITTED)
├── RELEASE_GUIDE.md                    # This file
└── GOOGLE_PLAY_SETUP.md                # Google Play API setup guide

scripts/
└── deploy-android.sh                   # Deployment wrapper script

Gemfile                                 # Ruby dependencies (includes fastlane)
```

## Resources

- [GOOGLE_PLAY_SETUP.md](./GOOGLE_PLAY_SETUP.md) - Complete Google Play API setup guide
- [React Native Signed APK Android](https://reactnative.dev/docs/signed-apk-android)
- [Google Play Console](https://play.google.com/console)
- [Android App Bundle](https://developer.android.com/guide/app-bundle)
- [Bundletool](https://developer.android.com/studio/command-line/bundletool)
- [Fastlane Documentation](https://docs.fastlane.tools/)
- [Fastlane Supply (Google Play)](https://docs.fastlane.tools/actions/supply/)

---

*Last Updated: 2026-03-10*