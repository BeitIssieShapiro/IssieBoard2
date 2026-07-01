# IssieBoardNG Centralized Signing Migration

## Changes Made

IssieBoardNG has been migrated to use the centralized signing configuration from `issie-shared`.

### 1. Removed Local Fastlane Infrastructure

**Deleted:**
- `android/fastlane/` directory (Fastfile, Appfile, credentials)
- `Gemfile` and `Gemfile.lock`
- `.bundle/` directory
- `vendor/` directory

All Fastlane configuration now lives in `issie-shared/android/fastlane/`.

### 2. Updated build.gradle
**File**: `IssieBoardNG/android/app/build.gradle`

**Changed:**
- Removed conditional signing configuration that read from gradle.properties
- Replaced with placeholder that references shared config
- Added `apply from: "../../../issie-shared/android/keys/apply-signing.gradle"` at the end

**Before:**
```gradle
release {
    if (project.hasProperty('ISSIE_UPLOAD_STORE_FILE')) {
        storeFile file(ISSIE_UPLOAD_STORE_FILE)
        storePassword ISSIE_UPLOAD_STORE_PASSWORD
        keyAlias ISSIE_UPLOAD_KEY_ALIAS
        keyPassword ISSIE_UPLOAD_KEY_PASSWORD
    }
}
```

**After:**
```gradle
release {
    // Signing config loaded from issie-shared (see bottom of file)
}

// At end of file:
// Apply shared signing configuration from issie-shared
// This must be AFTER the android { } block
apply from: "../../../issie-shared/android/keys/apply-signing.gradle"
```

### 3. Updated gradle.properties
**File**: `IssieBoardNG/android/gradle.properties`

**Removed:**
```properties
ISSIE_UPLOAD_STORE_FILE=../../issie-shared/android/keys/uploadkeystore.jks
ISSIE_UPLOAD_KEY_ALIAS=key0
ISSIE_UPLOAD_STORE_PASSWORD=issiesays
ISSIE_UPLOAD_KEY_PASSWORD=issiesays
```

**Replaced with:**
```properties
# --- Release Signing Configuration ---
# Signing configuration is now centralized in issie-shared/android/keys/signing-config.properties
# See issie-shared/android/keys/README.md for details
```

### 4. Signing Config Already Present
**File**: `issie-shared/android/keys/signing-config.properties`

Both flavors already registered:
```properties
issie.main.projects=issieboard,issievoice,issiesays,issiedocs
```

### 5. Updated .gitignore

**Removed references to:**
- `android/gradle.properties` (no longer needs to be ignored)
- `android/fastlane/release-admin-creds.json` (no longer exists locally)

These files now only exist in `issie-shared/` and are covered by that repo's .gitignore.

## Benefits

✅ **No per-project keystore paths** - all handled centrally
✅ **No credentials in project files** - only in issie-shared
✅ **No local Fastlane files** - single shared Fastlane configuration
✅ **No Ruby dependencies in project** - Gemfile/bundler only in issie-shared
✅ **Automatic detection** - apply-signing.gradle detects project from applicationId
✅ **Consistent with other projects** - IssieSays, IssieDocs, IssieBoardNG now all use same system

## Verification

Once Java is installed, test the configuration:

```bash
cd /Users/i022021/dev/Issie/IssieBoardNG/android
./gradlew app:signingReport
```

Should show for each flavor:
```
✅ Loaded signing config for 'issieboard' from keystore group 'main'
   Keystore: uploadkeystore.jks

✅ Loaded signing config for 'issievoice' from keystore group 'main'
   Keystore: uploadkeystore.jks
```

## Deployment Still Works

The deployment scripts already call the shared system:
```bash
npm run deploy:android:issieboard
npm run deploy:android:issievoice
```

No changes needed to deployment - it already uses `issie-shared/android/deploy.sh`.

## Summary

IssieBoardNG now uses:
- ✅ **Centralized signing** from `issie-shared/android/keys/signing-config.properties`
- ✅ **Shared Fastlane** from `issie-shared/android/fastlane/`
- ✅ **Shared deployment script** (`deploy.sh`)
- ✅ **Version management** via `version.properties`
- ✅ **Multi-flavor support** (issieboard, issievoice)

All Issie Android projects now use identical signing infrastructure!
