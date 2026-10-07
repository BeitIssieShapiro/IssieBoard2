import * as RNFS from 'react-native-fs';
import { zip, unzip } from 'react-native-zip-archive';
import KeyboardPreferences from './native/KeyboardPreferences';

export type AppContext = 'issieboard' | 'issievoice' | 'issiecalc';

const KNOWN_APPS: readonly AppContext[] = ['issieboard', 'issievoice', 'issiecalc'];

export interface ImportedProfileInfo {
  name: string;
  language: string;
}

export interface ImportInfo {
  importedProfiles: ImportedProfileInfo[];
  skippedExistingProfiles: ImportedProfileInfo[];
}

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

  return zipFilePath;
}

/**
 * Export all custom profiles for the given app as a zip-of-zips.
 * Returns the path to the created zip file.
 */
export async function exportAll(appContext: AppContext = 'issieboard'): Promise<string> {
  const savedListJson = await KeyboardPreferences.getProfile('saved_list');
  if (!savedListJson) {
    throw new Error('No profiles to export');
  }

  const savedList: SavedListEntry[] = JSON.parse(savedListJson);
  const appProfiles = savedList.filter(p => !p.appContext || p.appContext === appContext);
  if (appProfiles.length === 0) {
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

  if (zipFiles.length === 0) {
    throw new Error('No profiles exported successfully');
  }

  const date = new Date();
  const timestamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}`;
  const backupZipPath = tempPath(`IssieBoard Backup-${timestamp}.zip`);
  await unlinkSafe(backupZipPath);
  await zip(zipFiles, backupZipPath);

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
    packagePath = packagePath.substring(7);
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
    for (const item of items) {
      if (item.name.endsWith('.zip')) {
        await importInternal(item.path, importInfo, appContext, String(i++));
      }
    }
  }
}
