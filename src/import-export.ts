import * as RNFS from 'react-native-fs';
import { zip, unzip } from 'react-native-zip-archive';
import Share from 'react-native-share';
import { checkPackage, showPackageCheckAlert, stampPackage, type IssieAppId } from '@beitissieshapiro/issie-shared';
import KeyboardPreferences from './native/KeyboardPreferences';
import {
  exportVoiceData,
  importVoiceData,
  VOICE_DATA_FILE_PREFIX,
} from '../apps/issievoice/src/services/voiceBackup';

export type AppContext = 'issieboard' | 'issievoice' | 'issiecalc';

const KNOWN_APPS: readonly AppContext[] = ['issieboard', 'issievoice', 'issiecalc'];

export interface ImportedProfileInfo {
  name: string;
  language: string;
}

export interface ImportInfo {
  importedProfiles: ImportedProfileInfo[];
  skippedExistingProfiles: ImportedProfileInfo[];
  // Made for another kind of app: a calculator offered to a keyboard app or vice versa
  skippedIncompatibleProfiles: ImportedProfileInfo[];
  // IssieVoice saved sentences added from a backup
  importedSentences: number;
}

export function newImportInfo(): ImportInfo {
  return { importedProfiles: [], skippedExistingProfiles: [], skippedIncompatibleProfiles: [], importedSentences: 0 };
}

/** True when an import produced anything worth reporting to the user. */
export function hasImportResult(info: ImportInfo): boolean {
  return info.importedProfiles.length > 0
    || info.skippedExistingProfiles.length > 0
    || info.skippedIncompatibleProfiles.length > 0
    || info.importedSentences > 0;
}

// IssieBoard and IssieVoice share keyboards; IssieCalc profiles are calculators.
const isCalc = (app: AppContext) => app === 'issiecalc';

export type SavedListEntry = { name: string; key: string; language: string; keyboardId: string; appContext?: AppContext };

interface ExportMetadata {
  version: string;
  type: string;
  app: AppContext;
  name: string;
  language: string;
  keyboardId: string;
  profileDefinition: any;
  styleGroups: any[];
}

function tempPath(filename: string): string {
  return `${RNFS.TemporaryDirectoryPath}/${filename}`;
}

// Marks a zip as made by this app, so other Issie apps can tell (issie-shared package
// manifest). The export works without it.
async function stampAs(zipPath: string, appContext: AppContext, kind: string) {
  await stampPackage(RNFS, zipPath, { app: appContext as IssieAppId, kind })
    .catch(e => console.warn('stamp package failed:', e));
}

/**
 * Whether an incoming file may be imported. Another Issie app's file (IssieDocs, IssieSays, ...)
 * is rejected with a message naming it, offering to get or open that app. Files of the
 * IssieBoard family pass: importPackage() reports profiles of a sibling app as incompatible.
 */
export async function checkIncomingPackage(url: string, appContext: AppContext): Promise<boolean> {
  const path = url.startsWith('file://') ? decodeURI(url.substring(7)) : url;
  const check = await checkPackage(RNFS, path, appContext as IssieAppId, { acceptedApps: [...KNOWN_APPS] });
  if (check.ok) return true;
  showPackageCheckAlert(check, path, appContext as IssieAppId,
    p => Share.open({ url: 'file://' + p, type: 'application/zip', failOnCancel: false }));
  return false;
}

async function unlinkSafe(path: string): Promise<void> {
  try { await RNFS.unlink(path); } catch {}
}

/**
 * Export a single profile as a zip file.
 * Returns the path to the created zip file.
 */
export async function exportProfile(profileId: string, profileName: string, appContext: AppContext = 'issieboard'): Promise<string> {
  const profileDefJson = await KeyboardPreferences.getProfile(`profile_def_${profileId}`);
  if (!profileDefJson) {
    throw new Error(`Profile not found: ${profileId}`);
  }
  const profileDef = JSON.parse(profileDefJson);

  let styleGroups: any[] = [];
  try {
    const styleGroupsJson = await KeyboardPreferences.getProfile(`${profileId}_styleGroups`);
    if (styleGroupsJson) {
      styleGroups = JSON.parse(styleGroupsJson);
    }
  } catch {}

  const metadata: ExportMetadata = {
    version: '1.0',
    type: 'profile',
    app: appContext,
    name: profileName,
    language: profileDef.language || '',
    keyboardId: profileDef.keyboardId || '',
    profileDefinition: profileDef,
    styleGroups,
  };

  const sanitizedName = profileName.replace(/[^a-zA-Z0-9֐-׿؀-ۿ_-]/g, '_');
  const metadataFilePath = tempPath(`metadata__${sanitizedName}.json`);
  await unlinkSafe(metadataFilePath);
  await RNFS.writeFile(metadataFilePath, JSON.stringify(metadata, null, 2), 'utf8');

  const zipFilePath = tempPath(`keyboard__${sanitizedName}.zip`);
  await unlinkSafe(zipFilePath);
  await zip([metadataFilePath], zipFilePath);
  await stampAs(zipFilePath, appContext, 'profile');

  return zipFilePath;
}

/**
 * Export all custom profiles for the given app as a zip-of-zips.
 * Returns the path to the created zip file.
 */
export async function exportAll(appContext: AppContext = 'issieboard'): Promise<string> {
  const savedListJson = await KeyboardPreferences.getProfile('saved_list');
  const savedList: SavedListEntry[] = savedListJson ? JSON.parse(savedListJson) : [];
  // Untagged legacy profiles belong to IssieBoard, not to every app's backup
  const appProfiles = savedList.filter(p => (p.appContext || 'issieboard') === appContext);

  const voiceData = appContext === 'issievoice' ? await exportVoiceData() : null;
  if (appProfiles.length === 0 && !voiceData) {
    throw new Error('No profiles to export');
  }

  const zipFiles: string[] = [];
  for (const profile of appProfiles) {
    try {
      // Preserve the profile's original appContext so it round-trips correctly on import.
      // Untagged legacy profiles are treated as 'issieboard'.
      const profileAppContext = profile.appContext || 'issieboard';
      const zipPath = await exportProfile(profile.key, profile.name, profileAppContext);
      zipFiles.push(zipPath);
    } catch (e) {
      console.warn(`Failed to export profile ${profile.name}:`, e);
    }
  }

  if (voiceData) {
    const voiceDataPath = tempPath(`${VOICE_DATA_FILE_PREFIX}issievoice.json`);
    await unlinkSafe(voiceDataPath);
    await RNFS.writeFile(voiceDataPath, JSON.stringify(voiceData), 'utf8');
    zipFiles.push(voiceDataPath);
  }

  if (zipFiles.length === 0) {
    throw new Error('No profiles exported successfully');
  }

  const date = new Date();
  const timestamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}`;
  const backupZipPath = tempPath(`IssieBoard Backup-${timestamp}.zip`);
  await unlinkSafe(backupZipPath);
  await zip(zipFiles, backupZipPath);
  await stampAs(backupZipPath, appContext, 'backup');

  return backupZipPath;
}

/**
 * Import profiles from a zip file into the given app context.
 * Handles both single profile zips and backup (zip-of-zips).
 */
export async function importPackage(packagePath: string, importInfo: ImportInfo, appContext: AppContext = 'issieboard'): Promise<void> {
  await importInternal(packagePath, importInfo, appContext, '');
}

async function importInternal(packagePath: string, importInfo: ImportInfo, appContext: AppContext, subFolder: string): Promise<void> {
  if (packagePath.startsWith('file://')) {
    // The URL is percent-encoded: backup names have spaces and keyboard names may be
    // Hebrew or Arabic, so the raw string is not the file's real path.
    packagePath = decodeURIComponent(packagePath.substring(7));
  }

  const unzipTarget = tempPath(`imported${subFolder ? '/' + subFolder : ''}`);
  await unlinkSafe(unzipTarget);
  const unzipFolderPath = await unzip(packagePath, unzipTarget);

  const items = await RNFS.readDir(unzipFolderPath);
  const metadataItem = items.find(f => f.name.startsWith('metadata__'));

  if (metadataItem) {
    const metadataStr = await RNFS.readFile(metadataItem.path, 'utf8');
    const metadata: ExportMetadata = JSON.parse(metadataStr);

    if (!(KNOWN_APPS as readonly string[]).includes(metadata.app) || metadata.type !== 'profile') {
      throw new Error('Invalid IssieBoard profile file');
    }

    const savedListJson = await KeyboardPreferences.getProfile('saved_list');
    const savedList: SavedListEntry[] = savedListJson ? JSON.parse(savedListJson) : [];

    // Duplicate check is scoped to the target app. Untagged legacy entries are treated
    // as 'issieboard', so they do not block imports into other apps.
    const profileApp = metadata.app;
    if (isCalc(profileApp) !== isCalc(appContext)) {
      importInfo.skippedIncompatibleProfiles.push({ name: metadata.name, language: metadata.language });
      return;
    }

    const exists = savedList.some(
      p => p.name === metadata.name && (p.appContext || 'issieboard') === appContext
    );
    if (exists) {
      importInfo.skippedExistingProfiles.push({ name: metadata.name, language: metadata.language });
      return;
    }

    const newId = `imported_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const profileDef = { ...metadata.profileDefinition, id: newId };

    await KeyboardPreferences.setProfile(JSON.stringify(profileDef), `profile_def_${newId}`);
    await KeyboardPreferences.setProfile(JSON.stringify(metadata.styleGroups || []), `${newId}_styleGroups`);

    savedList.push({
      name: metadata.name,
      key: newId,
      language: metadata.language,
      keyboardId: metadata.keyboardId,
      appContext,
    });
    await KeyboardPreferences.setProfile(JSON.stringify(savedList), 'saved_list');

    importInfo.importedProfiles.push({ name: metadata.name, language: metadata.language });
  } else {
    // Zip-of-zips (backup) — recursively import each inner zip
    let i = 0;
    let recognized = false;
    for (const item of items) {
      if (item.name.endsWith('.zip')) {
        recognized = true;
        await importInternal(item.path, importInfo, appContext, String(i++));
      } else if (item.name.startsWith(VOICE_DATA_FILE_PREFIX)) {
        recognized = true;
        if (appContext === 'issievoice') {
          const voiceData = JSON.parse(await RNFS.readFile(item.path, 'utf8'));
          importInfo.importedSentences += await importVoiceData(voiceData);
        }
      }
    }
    // Any other zip is not ours: say so instead of silently doing nothing
    if (!recognized && !subFolder) {
      throw new Error('Invalid IssieBoard profile file');
    }
  }
}
