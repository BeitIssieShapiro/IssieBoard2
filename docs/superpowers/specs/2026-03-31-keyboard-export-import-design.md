# Keyboard Export/Import Design

## Overview

Add export/import functionality to IssieBoard so users can share keyboard profiles via any medium (email, messaging, AirDrop, etc.) and import them by opening shared files.

## Data Format

### Single Profile Export

A `.zip` file containing one JSON metadata file:

```
profile__<profileName>.zip
└── metadata__<profileName>.json
```

The metadata JSON structure:

```json
{
  "version": "1.0",
  "type": "profile",
  "app": "issieboard",
  "name": "My Keyboard",
  "language": "he",
  "keyboardId": "he",
  "profileDefinition": { "...SavedProfileDefinition..." },
  "styleGroups": [ "...StyleGroup[]..." ]
}
```

- `version`: Format version for future compatibility
- `type`: Always `"profile"` for single exports
- `app`: Always `"issieboard"` (used by both IssieBoard and IssieVoice)
- `profileDefinition`: The full `SavedProfileDefinition` object
- `styleGroups`: The full `StyleGroup[]` array

### Backup All Export

A zip-of-zips containing all custom profiles across all languages:

```
IssieBoardBackup-<timestamp>.zip
├── profile__keyboard1.zip
│   └── metadata__keyboard1.json
├── profile__keyboard2.zip
│   └── metadata__keyboard2.json
└── ...
```

## Export Flow

### UI

- **Single profile export**: Share icon button on each profile pill in the profile picker modal (EditorScreen.tsx)
- **Backup All**: "Backup All Keyboards" button at the bottom of the profile picker modal, below the FlatList

### Logic

1. Read profile data (`SavedProfileDefinition` + `StyleGroup[]`) from `KeyboardPreferences`
2. Create metadata JSON object
3. Write metadata to temp file (`metadata__<name>.json`)
4. Zip using `react-native-zip-archive`
5. For Backup All: zip all individual profile zips into one file
6. Open share sheet via `react-native-share` (`Share.open({ url: filePath })`) on both iOS and Android
7. Clean up temp files after sharing

## Import Flow

### Entry Point

Import only via "Open With" from external apps (Files, email, Messages, AirDrop, etc.). No in-app import button or file picker.

### iOS Native Layer (AppDelegate.swift)

Extend the existing URL handler:

- **Warm start**: `application(_:open:options:)` — use `securelyCopyToTemp` pattern (security-scoped resource handling), forward to `RCTLinkingManager`
- **Cold start**: Check `launchOptions[.url]`, copy to temp, pass as `initialProperties["url"]`

The `securelyCopyToTemp` function:
1. Call `url.startAccessingSecurityScopedResource()`
2. Copy file to app's temp directory with sanitized filename
3. Call `url.stopAccessingSecurityScopedResource()` in defer block
4. Return temp URL

### Android Native Layer

- **MainActivity.kt**: Handle both cold start (`onCreate`) and warm start (`onNewIntent`) with `modifyIntentForSharing` that normalizes `ACTION_SEND`/`ACTION_VIEW` intents and copies `content://` URIs to temp files
- **FileCopyModule.kt**: Native module with `copyContentUriToTemp(contentUri)` method for handling `content://` URIs from the JS layer

### JS Import Logic

`importPackage(url)` function:
1. Strip `file://` prefix if present
2. Unzip to temp folder using `react-native-zip-archive`
3. Look for files starting with `metadata__` in unzipped contents
4. If found:
   - Parse JSON, validate `app === "issieboard"` and check `version`
   - Check if profile name already exists in `saved_list` — **skip duplicates**
   - Save new profiles via `KeyboardPreferences.setProfile()` for both profile definition and style groups
   - Update `saved_list` with new entries
5. If no metadata files found: treat each file as a nested zip (backup case) and recurse
6. Show results dialog with imported count and skipped (duplicate) count

### Duplicate Handling

Profiles with a name that already exists in `saved_list` are silently skipped. The import results dialog shows which profiles were imported and which were skipped.

## Platform Configuration Changes

### New npm Dependencies

- `react-native-share` — share sheet
- `react-native-zip-archive` — zip/unzip
- `react-native-fs` — file system access (temp files, reading/writing)

### iOS Info.plist (Main App)

Add document type registration so iOS offers IssieBoard as a handler for zip files:

```xml
<key>CFBundleDocumentTypes</key>
<array>
  <dict>
    <key>CFBundleTypeName</key>
    <string>IssieBoard Package</string>
    <key>CFBundleTypeRole</key>
    <string>Viewer</string>
    <key>LSHandlerRank</key>
    <string>Default</string>
    <key>LSItemContentTypes</key>
    <array>
      <string>public.zip-archive</string>
    </array>
  </dict>
</array>

<key>LSSupportsOpeningDocumentsInPlace</key>
<true/>
```

### IssieVoice Info.plist

Same `CFBundleDocumentTypes` and `LSSupportsOpeningDocumentsInPlace` entries.

### Android AndroidManifest.xml

Add intent filters on `MainActivity`:

```xml
<!-- Open zip files from file managers -->
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <data android:scheme="content" android:mimeType="application/zip" />
  <data android:scheme="file" android:mimeType="application/zip" />
</intent-filter>

<!-- Receive shared zip files -->
<intent-filter>
  <action android:name="android.intent.action.SEND" />
  <category android:name="android.intent.category.DEFAULT" />
  <data android:mimeType="application/zip" />
  <data android:mimeType="application/octet-stream" />
</intent-filter>
```

Add FileProvider configuration for sharing files.

### Android Native Modules

- `FileCopyModule.kt` — handles `content://` URI to temp file copying
- `MyCustomPackage.kt` — registers FileCopyModule as a React Native native module
- `MainApplication.kt` — add MyCustomPackage to the package list

## New Files

| File | Purpose |
|------|---------|
| `src/import-export.ts` | Export/import business logic (zip, unzip, metadata, share) |
| `src/common/linking-hook.ts` | `useIncomingURL` hook for receiving shared files |
| `src/common/import-info-dialog.tsx` | Modal dialog showing import results |
| `android/.../FileCopyModule.kt` | Native module for content URI handling |
| `android/.../MyCustomPackage.kt` | React Native package registration |
| `android/.../file_paths.xml` | FileProvider path configuration |

## Modified Files

| File | Change |
|------|--------|
| `src/screens/EditorScreen.tsx` | Add share button per profile pill, add "Backup All" button in picker modal |
| `src/AppNavigator.tsx` | Wire up `useIncomingURL` hook |
| `apps/issievoice/src/screens/NewSettingsScreen.tsx` or its navigator | Wire up `useIncomingURL` hook |
| `ios/IssieBoardNG/AppDelegate.swift` | Add file URL handling for import |
| `ios/IssieBoardNG/Info.plist` | Add document types |
| IssieVoice `Info.plist` | Add document types |
| `android/.../MainActivity.kt` | Add intent handling for shared files |
| `android/.../MainApplication.kt` | Register custom native module package |
| `android/app/src/main/AndroidManifest.xml` | Add intent filters |
| `package.json` | Add new dependencies |

## Shared Between Apps

Both IssieBoard and IssieVoice share the same `KeyboardPreferences` storage and `saved_list`. The import/export logic (`src/import-export.ts`) and hooks (`src/common/linking-hook.ts`) are shared JS code. Both apps need their own native-level registration (Info.plist document types, AppDelegate URL handling) but the JS logic is identical. The `app` field in metadata is always `"issieboard"` regardless of which app performs the export/import.
