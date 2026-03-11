# IssieBoardNG Centralized Signing Migration

## Changes Made

IssieBoardNG has been migrated to use the centralized signing configuration from `issie-shared`.

### 1. Updated build.gradle
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

### 2. Updated gradle.properties
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

### 3. Signing Config Already Present
**File**: `issie-shared/android/keys/signing-config.properties`

Both flavors already registered:
```properties
issie.main.projects=issieboard,issievoice,issiesays,issiedocs
```

## Benefits

✅ **No per-project keystore paths** - all handled centrally
✅ **No credentials in project files** - only in issie-shared
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
