# Keyboard Export/Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to export keyboard profiles as zip files (single or backup-all) via share sheet, and import them by opening zip files from external apps.

**Architecture:** Export creates zip files containing JSON metadata using react-native-zip-archive and shares via react-native-share. Import uses native URL handling (AppDelegate on iOS, MainActivity on Android) to receive files, copy to temp, and forward to JS via Linking. JS layer unzips and saves profiles to KeyboardPreferences.

**Tech Stack:** react-native-share, react-native-zip-archive, react-native-fs, Swift (AppDelegate), Kotlin (MainActivity, FileCopyModule)

---

## File Structure

**New files:**
- `src/import-export.ts` — Export/import business logic
- `src/common/linking-hook.ts` — `useIncomingURL` React hook
- `src/common/import-info-dialog.tsx` — Import results modal dialog
- `android/app/src/main/java/org/issieshapiro/issieboard/shared/FileCopyModule.kt` — Native module for content:// URI handling
- `android/app/src/main/java/org/issieshapiro/issieboard/shared/FileCopyPackage.kt` — React Native package registration
- `android/app/src/main/res/xml/file_paths.xml` — FileProvider path configuration

**Modified files:**
- `package.json` — Add 3 new dependencies
- `ios/IssieBoardNG/AppDelegate.swift` — Add file URL handling + securelyCopyToTemp
- `ios/IssieBoardNG/Info.plist` — Add CFBundleDocumentTypes + LSSupportsOpeningDocumentsInPlace
- `ios/IssieVoice/IssieVoice-Info.plist` — Same document type registration
- `src/AppNavigator.tsx` — Wire useIncomingURL for IssieBoard app
- `apps/issievoice/App.tsx` — Wire useIncomingURL for IssieVoice app
- `src/screens/EditorScreen.tsx` — Add export button per profile pill + Backup All button
- `src/localization/strings.ts` — Add export/import strings
- `android/app/src/issieboard/AndroidManifest.xml` — Add intent filters for zip files
- `android/app/src/issievoice/AndroidManifest.xml` — Add intent filters for zip files
- `android/app/src/issieboard/java/org/issieshapiro/issieboard/MainActivity.kt` — Add intent handling
- `android/app/src/issievoice/java/org/issieshapiro/issieboard/MainActivity.kt` — Add intent handling
- `android/app/src/main/java/org/issieshapiro/issieboard/MainApplication.kt` — Register FileCopyPackage

---

### Task 1: Install npm dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install react-native-share, react-native-zip-archive, and react-native-fs**

```bash
npm install react-native-share react-native-zip-archive react-native-fs
```

- [ ] **Step 2: Install iOS pods**

```bash
cd ios && pod install && cd ..
```

---

### Task 2: Add localization strings for export/import

**Files:**
- Modify: `src/localization/strings.ts`

- [ ] **Step 1: Add type definitions for import/export strings**

In the `Strings` interface, add a new `importExport` section after the `setup` section (before the closing `}` of the interface at line ~313):

```typescript
  importExport: {
    exportProfile: string;
    backupAll: string;
    importSuccessTitle: string;
    importedProfiles: string;
    skippedProfiles: string;
    skippedNote: string;
    importFailed: string;
    invalidFile: string;
    ok: string;
    noProfilesToExport: string;
  };
```

- [ ] **Step 2: Add English strings**

In the `en` object, add after the `setup` section:

```typescript
  importExport: {
    exportProfile: 'Share Keyboard',
    backupAll: 'Backup All Keyboards',
    importSuccessTitle: 'Import Complete',
    importedProfiles: 'Imported Keyboards',
    skippedProfiles: 'Skipped (already exist)',
    skippedNote: 'Keyboards with existing names were skipped.',
    importFailed: 'Import Failed',
    invalidFile: 'This file is not a valid IssieBoard keyboard file.',
    ok: 'OK',
    noProfilesToExport: 'No custom keyboards to export.',
  },
```

- [ ] **Step 3: Add Hebrew strings**

In the `he` object, add after the `setup` section:

```typescript
  importExport: {
    exportProfile: 'שתף מקלדת',
    backupAll: 'גיבוי כל המקלדות',
    importSuccessTitle: 'ייבוא הושלם',
    importedProfiles: 'מקלדות שיובאו',
    skippedProfiles: 'דולגו (כבר קיימות)',
    skippedNote: 'מקלדות עם שמות קיימים דולגו.',
    importFailed: 'הייבוא נכשל',
    invalidFile: 'קובץ זה אינו קובץ מקלדת תקין של IssieBoard.',
    ok: 'אישור',
    noProfilesToExport: 'אין מקלדות מותאמות לייצוא.',
  },
```

- [ ] **Step 4: Add Arabic strings**

In the `ar` object, add after the `setup` section:

```typescript
  importExport: {
    exportProfile: 'مشاركة لوحة مفاتيح',
    backupAll: 'نسخ احتياطي لجميع لوحات المفاتيح',
    importSuccessTitle: 'اكتمل الاستيراد',
    importedProfiles: 'لوحات المفاتيح المستوردة',
    skippedProfiles: 'تم تخطيها (موجودة بالفعل)',
    skippedNote: 'تم تخطي لوحات المفاتيح ذات الأسماء الموجودة.',
    importFailed: 'فشل الاستيراد',
    invalidFile: 'هذا الملف ليس ملف لوحة مفاتيح IssieBoard صالحًا.',
    ok: 'موافق',
    noProfilesToExport: 'لا توجد لوحات مفاتيح مخصصة للتصدير.',
  },
```

---

### Task 3: Create import-export.ts (export/import business logic)

**Files:**
- Create: `src/import-export.ts`

- [ ] **Step 1: Create the import-export module**

```typescript
import * as RNFS from 'react-native-fs';
import { zip, unzip } from 'react-native-zip-archive';
import KeyboardPreferences from './native/KeyboardPreferences';
import { Platform } from 'react-native';

export interface ImportInfo {
  importedProfiles: string[];
  skippedExistingProfiles: string[];
}

interface ExportMetadata {
  version: string;
  type: string;
  app: string;
  name: string;
  language: string;
  keyboardId: string;
  profileDefinition: any;
  styleGroups: any[];
}

function tempPath(filename: string): string {
  return `${RNFS.TemporaryDirectoryPath}/${filename}`;
}

async function unlinkSafe(path: string): Promise<void> {
  try { await RNFS.unlink(path); } catch {}
}

/**
 * Export a single profile as a zip file.
 * Returns the path to the created zip file.
 */
export async function exportProfile(profileId: string, profileName: string): Promise<string> {
  // Read profile definition
  const profileDefJson = await KeyboardPreferences.getProfile(`profile_def_${profileId}`);
  if (!profileDefJson) {
    throw new Error(`Profile not found: ${profileId}`);
  }
  const profileDef = JSON.parse(profileDefJson);

  // Read style groups
  let styleGroups: any[] = [];
  try {
    const styleGroupsJson = await KeyboardPreferences.getProfile(`${profileId}_styleGroups`);
    if (styleGroupsJson) {
      styleGroups = JSON.parse(styleGroupsJson);
    }
  } catch {}

  // Create metadata
  const metadata: ExportMetadata = {
    version: '1.0',
    type: 'profile',
    app: 'issieboard',
    name: profileName,
    language: profileDef.language || '',
    keyboardId: profileDef.keyboardId || '',
    profileDefinition: profileDef,
    styleGroups,
  };

  // Write metadata to temp file
  const sanitizedName = profileName.replace(/[^a-zA-Z0-9\u0590-\u05FF\u0600-\u06FF_-]/g, '_');
  const metadataFilePath = tempPath(`metadata__${sanitizedName}.json`);
  await unlinkSafe(metadataFilePath);
  await RNFS.writeFile(metadataFilePath, JSON.stringify(metadata, null, 2), 'utf8');

  // Zip the metadata file
  const zipFilePath = tempPath(`profile__${sanitizedName}.zip`);
  await unlinkSafe(zipFilePath);
  await zip([metadataFilePath], zipFilePath);

  return zipFilePath;
}

/**
 * Export all custom profiles as a zip-of-zips.
 * Returns the path to the created zip file.
 */
export async function exportAll(): Promise<string> {
  // Read saved_list to get all custom profiles
  const savedListJson = await KeyboardPreferences.getProfile('saved_list');
  if (!savedListJson) {
    throw new Error('No profiles to export');
  }

  const savedList: { name: string; key: string; language: string; keyboardId: string }[] = JSON.parse(savedListJson);
  if (savedList.length === 0) {
    throw new Error('No profiles to export');
  }

  // Export each profile
  const zipFiles: string[] = [];
  for (const profile of savedList) {
    try {
      const zipPath = await exportProfile(profile.key, profile.name);
      zipFiles.push(zipPath);
    } catch (e) {
      console.warn(`Failed to export profile ${profile.name}:`, e);
    }
  }

  if (zipFiles.length === 0) {
    throw new Error('No profiles exported successfully');
  }

  // Zip all profile zips together
  const date = new Date();
  const timestamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}`;
  const backupZipPath = tempPath(`IssieBoard Backup-${timestamp}.zip`);
  await unlinkSafe(backupZipPath);
  await zip(zipFiles, backupZipPath);

  return backupZipPath;
}

/**
 * Import profiles from a zip file.
 * Handles both single profile zips and backup (zip-of-zips).
 */
export async function importPackage(packagePath: string, importInfo: ImportInfo, subFolder: string = ''): Promise<void> {
  // Strip file:// prefix if present
  if (packagePath.startsWith('file://')) {
    packagePath = packagePath.substring(7);
  }

  // Unzip to temp folder
  const unzipTarget = tempPath(`imported${subFolder ? '/' + subFolder : ''}`);
  await unlinkSafe(unzipTarget);
  const unzipFolderPath = await unzip(packagePath, unzipTarget);

  // Look for metadata file
  const items = await RNFS.readDir(unzipFolderPath);
  const metadataItem = items.find(f => f.name.startsWith('metadata__'));

  if (metadataItem) {
    // Single profile import
    const metadataStr = await RNFS.readFile(metadataItem.path, 'utf8');
    const metadata: ExportMetadata = JSON.parse(metadataStr);

    if (metadata.app !== 'issieboard' || metadata.type !== 'profile') {
      throw new Error('Invalid IssieBoard profile file');
    }

    // Check if profile name already exists in saved_list
    const savedListJson = await KeyboardPreferences.getProfile('saved_list');
    const savedList: { name: string; key: string; language: string; keyboardId: string }[] = 
      savedListJson ? JSON.parse(savedListJson) : [];

    const exists = savedList.some(p => p.name === metadata.name);
    if (exists) {
      importInfo.skippedExistingProfiles.push(metadata.name);
      return;
    }

    // Generate a new unique ID for the imported profile
    const newId = `imported_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const profileDef = { ...metadata.profileDefinition, id: newId };

    // Save profile definition and style groups
    await KeyboardPreferences.setProfile(JSON.stringify(profileDef), `profile_def_${newId}`);
    await KeyboardPreferences.setProfile(JSON.stringify(metadata.styleGroups || []), `${newId}_styleGroups`);

    // Add to saved_list
    savedList.push({
      name: metadata.name,
      key: newId,
      language: metadata.language,
      keyboardId: metadata.keyboardId,
    });
    await KeyboardPreferences.setProfile(JSON.stringify(savedList), 'saved_list');

    importInfo.importedProfiles.push(metadata.name);
  } else {
    // Zip-of-zips (backup) — recursively import each inner zip
    let i = 0;
    for (const item of items) {
      if (item.name.endsWith('.zip')) {
        await importPackage(item.path, importInfo, String(i++));
      }
    }
  }
}
```

---

### Task 4: Create linking-hook.ts (incoming URL hook)

**Files:**
- Create: `src/common/linking-hook.ts`

- [ ] **Step 1: Create the useIncomingURL hook**

```typescript
import { Linking } from 'react-native';
import { useEffect, useRef } from 'react';

/**
 * Hook that listens for incoming file URLs (from "Open With" / share).
 * Handles both cold start (app launched by file) and warm start (app already running).
 */
export function useIncomingURL(onLinkReceived: (url: string) => void) {
  const handled = useRef<string | null>(null);

  useEffect(() => {
    const handleUrl = ({ url }: { url: string | null }) => {
      if (url && url !== handled.current) {
        // Only handle file:// URLs (not issieboard:// deep links)
        if (url.startsWith('file://') || url.includes('.zip')) {
          handled.current = url;
          onLinkReceived(url);
        }
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);

    // Check for cold start URL
    (async () => {
      const url = await Linking.getInitialURL();
      if (url) {
        setTimeout(() => handleUrl({ url }));
      }
    })();

    return () => {
      subscription.remove();
    };
  }, []);
}
```

---

### Task 5: Create import-info-dialog.tsx (import results modal)

**Files:**
- Create: `src/common/import-info-dialog.tsx`

- [ ] **Step 1: Create the ImportInfoDialog component**

```typescript
import React from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, I18nManager } from 'react-native';
import { ImportInfo } from '../import-export';
import { useLocalization } from '../localization';

interface Props {
  importInfo: ImportInfo;
  onClose: () => void;
}

export const ImportInfoDialog: React.FC<Props> = ({ importInfo, onClose }) => {
  const { strings } = useLocalization();
  const isRTL = I18nManager.isRTL;
  const s = strings.importExport;

  const renderSection = (title: string, data: string[]) => (
    <View style={styles.section}>
      <Text allowFontScaling={false} style={styles.sectionTitle}>{title} ({data.length})</Text>
      {data.map((item, index) => (
        <Text allowFontScaling={false} key={index} style={styles.item}>
          {isRTL ? `${item} •` : `• ${item}`}
        </Text>
      ))}
    </View>
  );

  return (
    <Modal
      visible={true}
      animationType="fade"
      transparent={true}
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text allowFontScaling={false} style={styles.title}>{s.importSuccessTitle}</Text>
          <View style={styles.separator} />
          <ScrollView style={{ maxHeight: 400 }}>
            {renderSection(s.importedProfiles, importInfo.importedProfiles)}
            {importInfo.skippedExistingProfiles.length > 0 &&
              renderSection(s.skippedProfiles, importInfo.skippedExistingProfiles)}
          </ScrollView>
          {importInfo.skippedExistingProfiles.length > 0 && (
            <Text allowFontScaling={false} style={styles.note}>{s.skippedNote}</Text>
          )}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.okButton} onPress={onClose} activeOpacity={0.7}>
              <Text allowFontScaling={false} style={styles.okButtonText}>{s.ok}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: 400,
    maxWidth: '90%',
    maxHeight: '80%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 10,
  },
  section: {
    marginVertical: 10,
  },
  sectionTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  item: {
    fontSize: 16,
    marginHorizontal: 8,
    marginVertical: 2,
  },
  note: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    marginHorizontal: 8,
  },
  buttonRow: {
    alignItems: 'center',
    marginTop: 16,
  },
  okButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 8,
  },
  okButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

---

### Task 6: Add export buttons to EditorScreen profile picker

**Files:**
- Modify: `src/screens/EditorScreen.tsx`

- [ ] **Step 1: Add imports**

At the top of EditorScreen.tsx, add:

```typescript
import Share from 'react-native-share';
import { exportProfile, exportAll } from '../import-export';
```

- [ ] **Step 2: Add export handler functions**

Inside the `EditorScreenContent` component (after the existing handler functions like `handleLoadProfile`), add:

```typescript
const handleExportProfile = async (profileId: string, profileName: string) => {
  try {
    const zipPath = await exportProfile(profileId, profileName);
    await Share.open({
      url: Platform.OS === 'android' ? `file://${zipPath}` : zipPath,
      type: 'application/zip',
    });
  } catch (error: any) {
    if (error?.message !== 'User did not share') {
      console.warn('Export failed:', error);
      Alert.alert(strings.common.error, strings.importExport.importFailed);
    }
  }
};

const handleBackupAll = async () => {
  try {
    const zipPath = await exportAll();
    await Share.open({
      url: Platform.OS === 'android' ? `file://${zipPath}` : zipPath,
      type: 'application/zip',
    });
  } catch (error: any) {
    if (error?.message !== 'User did not share') {
      console.warn('Backup all failed:', error);
      if ((error as Error)?.message?.includes('No profiles')) {
        Alert.alert(strings.common.error, strings.importExport.noProfilesToExport);
      } else {
        Alert.alert(strings.common.error, strings.importExport.importFailed);
      }
    }
  }
};
```

- [ ] **Step 3: Add share icon button to each profile pill**

In the profile picker modal's FlatList `renderItem`, modify the profile pill TouchableOpacity to include a share icon. Find the existing `renderItem` (around line 1579) and add a share button after the profile name text, but only for non-built-in profiles:

Inside the `<TouchableOpacity style={[styles.profilePill, ...]}` for each profile item, after the existing content (profile name Text and built-in badge), add:

```tsx
{!item.isBuiltIn && (
  <TouchableOpacity
    style={styles.profilePillExport}
    onPress={(e) => {
      e.stopPropagation();
      handleExportProfile(item.id, item.name);
    }}
    activeOpacity={0.7}
    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
  >
    <MyIcon info={{ name: 'share-outline', type: 'Ionicons', color: item.id === currentProfileId ? '#FFFFFF' : '#6B7280', size: 18 }} />
  </TouchableOpacity>
)}
```

- [ ] **Step 4: Add "Backup All" button below the FlatList in the profile picker**

After the FlatList (and the no-profiles text), but still inside `profilePickerContainer`, add:

```tsx
<TouchableOpacity
  style={styles.backupAllButton}
  onPress={handleBackupAll}
  activeOpacity={0.7}
>
  <MyIcon info={{ name: 'cloud-download-outline', type: 'Ionicons', color: '#3B82F6', size: 20 }} />
  <Text allowFontScaling={false} style={styles.backupAllText}>{strings.importExport.backupAll}</Text>
</TouchableOpacity>
```

- [ ] **Step 5: Add styles**

Add these styles to the StyleSheet:

```typescript
profilePillExport: {
  marginLeft: 'auto',
  padding: 4,
},
backupAllButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 12,
  marginTop: 8,
  borderTopWidth: 1,
  borderTopColor: '#E2E8F0',
  gap: 8,
},
backupAllText: {
  color: '#3B82F6',
  fontSize: 15,
  fontWeight: '600',
},
```

---

### Task 7: Wire import handling in AppNavigator.tsx (IssieBoard app)

**Files:**
- Modify: `src/AppNavigator.tsx`

- [ ] **Step 1: Add imports and state**

Add imports at the top:

```typescript
import { useIncomingURL } from './common/linking-hook';
import { importPackage, ImportInfo } from './import-export';
import { ImportInfoDialog } from './common/import-info-dialog';
```

- [ ] **Step 2: Add import state and handler inside AppNavigator component**

Inside the `AppNavigator` component, after the existing state declarations, add:

```typescript
const [importResult, setImportResult] = useState<ImportInfo | null>(null);

const handleImportURL = useCallback(async (url: string) => {
  try {
    const info: ImportInfo = { importedProfiles: [], skippedExistingProfiles: [] };
    await importPackage(url, info);
    if (info.importedProfiles.length > 0 || info.skippedExistingProfiles.length > 0) {
      setImportResult(info);
      // Force remount to reload profile lists
      setEditorKey(prev => prev + 1);
    }
  } catch (error) {
    console.warn('Import failed:', error);
    const { Alert } = require('react-native');
    Alert.alert('Import Failed', 'This file is not a valid IssieBoard keyboard file.');
  }
}, []);

useIncomingURL(handleImportURL);
```

- [ ] **Step 3: Add ImportInfoDialog to the render**

In both the `classic` and `editor` screen render branches, add the import dialog just before the closing `</LocalizationProvider>`:

```tsx
{importResult && (
  <ImportInfoDialog
    importInfo={importResult}
    onClose={() => setImportResult(null)}
  />
)}
```

---

### Task 8: Wire import handling in IssieVoice App.tsx

**Files:**
- Modify: `apps/issievoice/App.tsx`

- [ ] **Step 1: Add imports and state**

Add these imports:

```typescript
import { Alert } from 'react-native';
import { useIncomingURL } from '../../src/common/linking-hook';
import { importPackage, ImportInfo } from '../../src/import-export';
import { ImportInfoDialog } from '../../src/common/import-info-dialog';
```

- [ ] **Step 2: Add import state and handler**

Inside the `App` component, after the existing `useEffect`, add:

```typescript
const [importResult, setImportResult] = React.useState<ImportInfo | null>(null);

const handleImportURL = React.useCallback(async (url: string) => {
  try {
    const info: ImportInfo = { importedProfiles: [], skippedExistingProfiles: [] };
    await importPackage(url, info);
    if (info.importedProfiles.length > 0 || info.skippedExistingProfiles.length > 0) {
      setImportResult(info);
    }
  } catch (error) {
    console.warn('Import failed:', error);
    Alert.alert('Import Failed', 'This file is not a valid IssieBoard keyboard file.');
  }
}, []);

useIncomingURL(handleImportURL);
```

- [ ] **Step 3: Add ImportInfoDialog to the render**

Inside the `return`, just before the closing `</SafeAreaProvider>`, add:

```tsx
{importResult && (
  <ImportInfoDialog
    importInfo={importResult}
    onClose={() => setImportResult(null)}
  />
)}
```

---

### Task 9: iOS AppDelegate — add file URL handling

**Files:**
- Modify: `ios/IssieBoardNG/AppDelegate.swift`

- [ ] **Step 1: Add securelyCopyToTemp function**

Add this private function to the `AppDelegate` class, before the closing `}`:

```swift
private func securelyCopyToTemp(url: URL) -> URL? {
  let hasAccess = url.startAccessingSecurityScopedResource()
  defer {
    if hasAccess {
      url.stopAccessingSecurityScopedResource()
    }
  }

  do {
    let fileName = url.lastPathComponent.removingPercentEncoding ?? url.lastPathComponent
    let sanitizedFileName = fileName.replacingOccurrences(of: "/", with: "-")
    let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(sanitizedFileName)

    if FileManager.default.fileExists(atPath: tempURL.path) {
      try FileManager.default.removeItem(at: tempURL)
    }

    try FileManager.default.copyItem(at: url, to: tempURL)
    print("File copied to temp: \(tempURL.path)")
    return tempURL
  } catch {
    print("Error copying file to temp: \(error)")
    return nil
  }
}
```

- [ ] **Step 2: Modify application(_:open:options:) to handle file URLs**

Replace the existing `application(_:open:options:)` method with one that handles both the `issieboard://` scheme AND file URLs:

```swift
func application(
  _ app: UIApplication,
  open url: URL,
  options: [UIApplication.OpenURLOptionsKey: Any] = [:]
) -> Bool {
  print("App opened via URL: \(url)")

  // Handle issieboard:// URL scheme (existing keyboard extension logic)
  if url.scheme == "issieboard" {
    // Only handle in IssieBoard app, not IssieVoice
    let bundleId = Bundle.main.bundleIdentifier ?? ""
    guard !bundleId.contains("IssieVoice") else {
      return false
    }

    if url.host == "settings" {
      if let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
         let queryItems = components.queryItems,
         let keyboardParam = queryItems.first(where: { $0.name == "keyboard" })?.value {
        let preferences = KeyboardPreferences()
        preferences.setString(keyboardParam, forKey: "launch_keyboard")
        CFNotificationCenterPostNotification(
          CFNotificationCenterGetDarwinNotifyCenter(),
          CFNotificationName("com.issieboard.launchKeyboard" as CFString),
          nil, nil, true
        )
      }
    }
    return true
  }

  // Handle file URLs (import from share/open-with)
  if url.isFileURL {
    guard let tempURL = securelyCopyToTemp(url: url) else { return false }
    return RCTLinkingManager.application(app, open: tempURL, options: options)
  }

  return false
}
```

- [ ] **Step 3: Add cold start URL handling in didFinishLaunchingWithOptions**

Modify `application(_:didFinishLaunchingWithOptions:)` to pass initial URL as props. Replace the current `factory.startReactNative(...)` block:

```swift
// Extract and prepare initial URL if exists
var initialProps: [AnyHashable: Any] = [:]
if let url = launchOptions?[.url] as? URL,
   url.isFileURL,
   let tempURL = securelyCopyToTemp(url: url) {
  initialProps["url"] = tempURL.absoluteString
}

factory.startReactNative(
  withModuleName: moduleName,
  in: window,
  initialProperties: initialProps.isEmpty ? nil : initialProps,
  launchOptions: launchOptions
)
```

- [ ] **Step 4: Add RCTLinkingManager import**

At the top of AppDelegate.swift, add:

```swift
import React_RCTLinking
```

If this doesn't work (module name varies), the alternative is to add a bridging header or use `@objc` declaration. The `RCTLinkingManager` class should be available from `React-RCTLinking` pod. Check if it compiles — if `React_RCTLinking` doesn't resolve, try using the ObjC bridge directly by adding to the existing bridge header or creating one.

---

### Task 10: iOS Info.plist — register document types

**Files:**
- Modify: `ios/IssieBoardNG/Info.plist`
- Modify: `ios/IssieVoice/IssieVoice-Info.plist`

- [ ] **Step 1: Add document types to IssieBoard Info.plist**

Add the following entries inside the top-level `<dict>`, after the `CFBundleURLTypes` section (after line 37):

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

- [ ] **Step 2: Add document types to IssieVoice Info.plist**

Add the same entries to `ios/IssieVoice/IssieVoice-Info.plist`, inside the top-level `<dict>`:

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

---

### Task 11: Android — Create FileCopyModule and register it

**Files:**
- Create: `android/app/src/main/java/org/issieshapiro/issieboard/shared/FileCopyModule.kt`
- Create: `android/app/src/main/java/org/issieshapiro/issieboard/shared/FileCopyPackage.kt`
- Modify: `android/app/src/main/java/org/issieshapiro/issieboard/MainApplication.kt`

- [ ] **Step 1: Create FileCopyModule.kt**

```kotlin
package org.issieshapiro.issieboard.shared

import android.content.ContentResolver
import android.net.Uri
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.io.OutputStream
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class FileCopyModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "FileCopyModule"

    @ReactMethod
    fun copyContentUriToTemp(contentUri: String, promise: Promise) {
        try {
            val uri = Uri.parse(contentUri)
            val contentResolver: ContentResolver = reactContext.contentResolver
            val inputStream: InputStream? = contentResolver.openInputStream(uri)
            if (inputStream == null) {
                promise.reject("E_NO_INPUT_STREAM", "Could not open input stream from URI")
                return
            }

            val fileName = "shared_${System.currentTimeMillis()}.zip"
            val tempFile = File(reactContext.cacheDir, fileName)
            val outputStream: OutputStream = FileOutputStream(tempFile)

            val buffer = ByteArray(1024)
            var length: Int
            while (inputStream.read(buffer).also { length = it } > 0) {
                outputStream.write(buffer, 0, length)
            }

            outputStream.flush()
            outputStream.close()
            inputStream.close()

            promise.resolve(tempFile.absolutePath)
        } catch (e: Exception) {
            promise.reject("E_COPY_FAILED", "Failed to copy content URI to temp file", e)
        }
    }
}
```

- [ ] **Step 2: Create FileCopyPackage.kt**

```kotlin
package org.issieshapiro.issieboard.shared

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import java.util.Collections

class FileCopyPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(FileCopyModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return Collections.emptyList()
    }
}
```

- [ ] **Step 3: Register in MainApplication.kt**

Add `FileCopyPackage` to the package list. Modify the `packages` section:

```kotlin
import org.issieshapiro.issieboard.shared.FileCopyPackage

// In the packageList apply block:
add(KeyboardPreviewPackage())
add(FileCopyPackage())
```

---

### Task 12: Android — Add intent filters and MainActivity handling

**Files:**
- Modify: `android/app/src/issieboard/AndroidManifest.xml`
- Modify: `android/app/src/issievoice/AndroidManifest.xml`
- Modify: `android/app/src/issieboard/java/org/issieshapiro/issieboard/MainActivity.kt`
- Modify: `android/app/src/issievoice/java/org/issieshapiro/issieboard/MainActivity.kt`
- Create: `android/app/src/main/res/xml/file_paths.xml`

- [ ] **Step 1: Add intent filters to IssieBoard AndroidManifest.xml**

Inside the `<activity>` tag for MainActivity, after the existing deep link intent-filter (after line 33), add:

```xml
<!-- Open zip files from file managers -->
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:scheme="content" android:mimeType="application/zip" />
    <data android:scheme="file" android:mimeType="application/zip" />
    <data android:scheme="content" android:mimeType="application/octet-stream" />
</intent-filter>
<!-- Receive shared zip files -->
<intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="application/zip" />
    <data android:mimeType="application/octet-stream" />
</intent-filter>
```

Also add a FileProvider inside the `<application>` tag, after the keyboard services:

```xml
<provider
    android:name="androidx.core.content.FileProvider"
    android:authorities="${applicationId}.provider"
    android:exported="false"
    android:grantUriPermissions="true">
    <meta-data
        android:name="android.support.FILE_PROVIDER_PATHS"
        android:resource="@xml/file_paths" />
</provider>
```

- [ ] **Step 2: Add intent filters to IssieVoice AndroidManifest.xml**

Inside the `<activity>` tag for MainActivity, after the existing MAIN/LAUNCHER intent-filter (after line 27), add the same intent filters:

```xml
<!-- Open zip files from file managers -->
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:scheme="content" android:mimeType="application/zip" />
    <data android:scheme="file" android:mimeType="application/zip" />
    <data android:scheme="content" android:mimeType="application/octet-stream" />
</intent-filter>
<!-- Receive shared zip files -->
<intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="application/zip" />
    <data android:mimeType="application/octet-stream" />
</intent-filter>
```

Also add the FileProvider inside `<application>`:

```xml
<provider
    android:name="androidx.core.content.FileProvider"
    android:authorities="${applicationId}.provider"
    android:exported="false"
    android:grantUriPermissions="true">
    <meta-data
        android:name="android.support.FILE_PROVIDER_PATHS"
        android:resource="@xml/file_paths" />
</provider>
```

- [ ] **Step 3: Create file_paths.xml**

```xml
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <external-path name="external_files" path="." />
    <files-path name="internal_files" path="." />
    <cache-path name="cache_files" path="." />
</paths>
```

- [ ] **Step 4: Modify IssieBoard MainActivity.kt for intent handling**

Replace the entire file:

```kotlin
package org.issieshapiro.issieboard

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import java.io.File
import java.io.FileOutputStream

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "IssieBoardNG"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    intent = modifyIntentForSharing(intent)
    super.onCreate(savedInstanceState)
  }

  override fun onNewIntent(intent: Intent?) {
    val modifiedIntent = modifyIntentForSharing(intent)
    super.onNewIntent(modifiedIntent)
  }

  private fun copyContentUriToTempFile(uri: Uri): Uri? {
    try {
      val inputStream = contentResolver.openInputStream(uri) ?: return null
      val fileName = "shared_${System.currentTimeMillis()}.zip"
      val tempFile = File(cacheDir, fileName)
      FileOutputStream(tempFile).use { output ->
        inputStream.use { input ->
          input.copyTo(output)
        }
      }
      return Uri.fromFile(tempFile)
    } catch (e: Exception) {
      android.util.Log.e("MainActivity", "Failed to copy content URI to temp", e)
      return null
    }
  }

  private fun modifyIntentForSharing(intent: Intent?): Intent? {
    intent ?: return null

    val sharedUri: Uri? = if (Intent.ACTION_SEND == intent.action) {
      @Suppress("DEPRECATION")
      intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
    } else {
      intent.data
    }

    sharedUri?.let { uri ->
      val resolvedUri = if (uri.scheme == "content") {
        copyContentUriToTempFile(uri) ?: uri
      } else {
        uri
      }
      intent.data = resolvedUri
      intent.action = Intent.ACTION_VIEW
    }

    return intent
  }
}
```

- [ ] **Step 5: Modify IssieVoice MainActivity.kt for intent handling**

Add the same intent handling methods. The file already has `onCreate`, so extend it:

```kotlin
package org.issieshapiro.issieboard

import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import java.io.File
import java.io.FileOutputStream

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    intent = modifyIntentForSharing(intent)
    super.onCreate(savedInstanceState)

    val screenLayout = resources.configuration.screenLayout and Configuration.SCREENLAYOUT_SIZE_MASK
    requestedOrientation = when (screenLayout) {
      Configuration.SCREENLAYOUT_SIZE_LARGE,
      Configuration.SCREENLAYOUT_SIZE_XLARGE -> ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
      else -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT
    }
  }

  override fun getMainComponentName(): String = "IssieVoice"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onNewIntent(intent: Intent?) {
    val modifiedIntent = modifyIntentForSharing(intent)
    super.onNewIntent(modifiedIntent)
  }

  private fun copyContentUriToTempFile(uri: Uri): Uri? {
    try {
      val inputStream = contentResolver.openInputStream(uri) ?: return null
      val fileName = "shared_${System.currentTimeMillis()}.zip"
      val tempFile = File(cacheDir, fileName)
      FileOutputStream(tempFile).use { output ->
        inputStream.use { input ->
          input.copyTo(output)
        }
      }
      return Uri.fromFile(tempFile)
    } catch (e: Exception) {
      android.util.Log.e("MainActivity", "Failed to copy content URI to temp", e)
      return null
    }
  }

  private fun modifyIntentForSharing(intent: Intent?): Intent? {
    intent ?: return null

    val sharedUri: Uri? = if (Intent.ACTION_SEND == intent.action) {
      @Suppress("DEPRECATION")
      intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
    } else {
      intent.data
    }

    sharedUri?.let { uri ->
      val resolvedUri = if (uri.scheme == "content") {
        copyContentUriToTempFile(uri) ?: uri
      } else {
        uri
      }
      intent.data = resolvedUri
      intent.action = Intent.ACTION_VIEW
    }

    return intent
  }
}
```

---

### Task 13: Build and verify

- [ ] **Step 1: Run pod install for iOS**

```bash
cd ios && pod install && cd ..
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Test on iOS simulator**

Build and run on iOS. Verify:
1. Open the profile picker in NewSettingsScreen
2. Share icon appears on custom profile pills
3. Tapping share opens the iOS share sheet with a zip file
4. "Backup All" button appears at bottom of picker
5. Tapping it exports all profiles

- [ ] **Step 4: Test import on iOS**

1. Save the exported zip to Files app
2. Open Files app, tap the zip
3. Select "Open with IssieBoard"
4. Verify the import dialog appears with the imported profile
5. Verify the profile appears in the picker

- [ ] **Step 5: Test on Android**

Repeat export and import testing on Android emulator/device.
