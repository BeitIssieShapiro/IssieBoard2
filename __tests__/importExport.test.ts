/**
 * Import / export of keyboards, calculators and IssieVoice data.
 *
 * Storage, the file system and zip are in-memory fakes: a "zip" is a folder
 * listing, so a backup is a zip whose entries are other zips plus the voice data.
 */

const store: Record<string, string> = {};
const files: Record<string, string> = {};
// zip path -> the paths it contains
const zips: Record<string, string[]> = {};

jest.mock('../src/native/KeyboardPreferences', () => ({
  __esModule: true,
  default: {
    getProfile: async (key: string) => store[key] ?? null,
    setProfile: async (value: string, key: string) => { store[key] = value; },
  },
}));

jest.mock('react-native-fs', () => ({
  TemporaryDirectoryPath: '/tmp',
  // Like RNFS.unlink, removes a folder with everything in it
  unlink: async (path: string) => {
    for (const p of Object.keys(files)) {
      if (p === path || p.startsWith(path + '/')) delete files[p];
    }
  },
  writeFile: async (path: string, content: string) => { files[path] = content; },
  readFile: async (path: string) => {
    if (!(path in files)) throw new Error(`ENOENT ${path}`);
    return files[path];
  },
  readDir: async (folder: string) =>
    Object.keys(files)
      .filter(p => p.startsWith(folder + '/') && !p.slice(folder.length + 1).includes('/'))
      .map(p => ({ name: p.slice(folder.length + 1), path: p })),
}));

jest.mock('react-native-zip-archive', () => ({
  zip: async (sources: string[], target: string) => {
    zips[target] = sources;
    files[target] = 'zip';
    return target;
  },
  unzip: async (source: string, target: string) => {
    if (!(source in zips)) throw new Error(`no such zip ${source}`);
    for (const src of zips[source]) {
      files[`${target}/${src.split('/').pop()}`] = files[src];
      if (src in zips) zips[`${target}/${src.split('/').pop()}`] = zips[src];
    }
    return target;
  },
}));

import { exportAll, exportProfile, importPackage, newImportInfo, AppContext } from '../src/import-export';

const reset = () => {
  for (const o of [store, files, zips]) for (const k of Object.keys(o)) delete (o as any)[k];
};

const addProfile = (id: string, name: string, appContext?: AppContext) => {
  store[`profile_def_${id}`] = JSON.stringify({ id, name, language: 'he', keyboardId: 'he' });
  const list = JSON.parse(store.saved_list ?? '[]');
  list.push({ name, key: id, language: 'he', keyboardId: 'he', ...(appContext ? { appContext } : {}) });
  store.saved_list = JSON.stringify(list);
};

const savedNames = (appContext: AppContext) =>
  JSON.parse(store.saved_list ?? '[]')
    .filter((p: any) => (p.appContext || 'issieboard') === appContext)
    .map((p: any) => p.name);

// What the OS hands to JS: a percent-encoded file URL
const asFileURL = (path: string) => 'file://' + encodeURI(path);

beforeEach(reset);

test('imports a file whose name has spaces or Hebrew (percent-encoded URL)', async () => {
  addProfile('p1', 'מקלדת שלי', 'issieboard');
  const zipPath = await exportProfile('p1', 'מקלדת שלי', 'issieboard');
  store.saved_list = '[]';

  const info = newImportInfo();
  await importPackage(asFileURL(zipPath), info, 'issieboard');
  expect(info.importedProfiles.map(p => p.name)).toEqual(['מקלדת שלי']);

  const backup = await exportAll('issieboard');
  expect(backup).toContain(' '); // "IssieBoard Backup-<date> <time>.zip"
  store.saved_list = '[]';
  const info2 = newImportInfo();
  await importPackage(asFileURL(backup), info2, 'issieboard');
  expect(info2.importedProfiles.map(p => p.name)).toEqual(['מקלדת שלי']);
});

test('keyboards and calculators are only imported into their own kind of app', async () => {
  addProfile('k', 'Keyboard', 'issieboard');
  addProfile('c', 'Calculator', 'issiecalc');
  const kbZip = await exportProfile('k', 'Keyboard', 'issieboard');
  const calcZip = await exportProfile('c', 'Calculator', 'issiecalc');
  store.saved_list = '[]';

  const intoCalc = newImportInfo();
  await importPackage(asFileURL(kbZip), intoCalc, 'issiecalc');
  await importPackage(asFileURL(calcZip), intoCalc, 'issiecalc');
  expect(intoCalc.importedProfiles.map(p => p.name)).toEqual(['Calculator']);
  expect(intoCalc.skippedIncompatibleProfiles.map(p => p.name)).toEqual(['Keyboard']);

  const intoVoice = newImportInfo();
  await importPackage(asFileURL(kbZip), intoVoice, 'issievoice');
  await importPackage(asFileURL(calcZip), intoVoice, 'issievoice');
  expect(intoVoice.importedProfiles.map(p => p.name)).toEqual(['Keyboard']);
  expect(intoVoice.skippedIncompatibleProfiles.map(p => p.name)).toEqual(['Calculator']);
});

test("a backup holds only the app's own profiles, not untagged IssieBoard ones", async () => {
  addProfile('legacy', 'Legacy keyboard');
  addProfile('c', 'Calculator', 'issiecalc');
  const backup = await exportAll('issiecalc');
  store.saved_list = '[]';

  const info = newImportInfo();
  await importPackage(asFileURL(backup), info, 'issiecalc');
  expect(info.importedProfiles.map(p => p.name)).toEqual(['Calculator']);
  expect(info.skippedIncompatibleProfiles).toEqual([]);
});

test('IssieVoice backup restores saved sentences and favorites, idempotently', async () => {
  addProfile('v', 'Voice keyboard', 'issievoice');
  store.issievoice_saved_sentences = JSON.stringify([
    { id: 'a', text: 'Hello', createdAt: 1 },
    { id: 'b', text: 'שלום', createdAt: 2 },
  ]);
  store.issievoice_favorites = JSON.stringify([{ id: 'b', order: 0 }]);
  const backup = await exportAll('issievoice');

  // A new device that already has one of the sentences (different id)
  store.saved_list = '[]';
  store.issievoice_saved_sentences = JSON.stringify([{ id: 'x', text: ' hello ', createdAt: 9 }]);
  store.issievoice_favorites = '[]';

  const info = newImportInfo();
  await importPackage(asFileURL(backup), info, 'issievoice');
  expect(info.importedSentences).toBe(1);
  expect(savedNames('issievoice')).toEqual(['Voice keyboard']);

  const afterFirst = {
    sentences: store.issievoice_saved_sentences,
    favorites: store.issievoice_favorites,
  };
  const sentences = JSON.parse(afterFirst.sentences);
  expect(sentences.map((s: any) => s.text)).toEqual([' hello ', 'שלום']);
  const shalomId = sentences.find((s: any) => s.text === 'שלום').id;
  expect(JSON.parse(afterFirst.favorites)).toEqual([{ id: shalomId, order: 0 }]);

  // Importing the same backup again changes nothing
  const again = newImportInfo();
  await importPackage(asFileURL(backup), again, 'issievoice');
  expect(again.importedSentences).toBe(0);
  expect(again.importedProfiles).toEqual([]);
  expect(again.skippedExistingProfiles.map(p => p.name)).toEqual(['Voice keyboard']);
  expect(store.issievoice_saved_sentences).toBe(afterFirst.sentences);
  expect(store.issievoice_favorites).toBe(afterFirst.favorites);
});

test('IssieVoice can back up sentences even with no custom keyboards', async () => {
  store.issievoice_saved_sentences = JSON.stringify([{ id: 'a', text: 'Hi', createdAt: 1 }]);
  const backup = await exportAll('issievoice');
  store.issievoice_saved_sentences = '[]';

  const info = newImportInfo();
  await importPackage(asFileURL(backup), info, 'issievoice');
  expect(info.importedSentences).toBe(1);
});

test('voice data in a backup is ignored by IssieBoard', async () => {
  addProfile('v', 'Shared keyboard', 'issievoice');
  store.issievoice_saved_sentences = JSON.stringify([{ id: 'a', text: 'Hi', createdAt: 1 }]);
  const backup = await exportAll('issievoice');
  store.saved_list = '[]';
  store.issievoice_saved_sentences = '[]';

  const info = newImportInfo();
  await importPackage(asFileURL(backup), info, 'issieboard');
  expect(info.importedProfiles.map(p => p.name)).toEqual(['Shared keyboard']);
  expect(info.importedSentences).toBe(0);
  expect(store.issievoice_saved_sentences).toBe('[]');
});

test('a zip that is not ours is reported as invalid', async () => {
  files['/tmp/other.txt'] = 'x';
  zips['/tmp/random.zip'] = ['/tmp/other.txt'];
  files['/tmp/random.zip'] = 'zip';
  await expect(importPackage(asFileURL('/tmp/random.zip'), newImportInfo(), 'issieboard'))
    .rejects.toThrow('Invalid');
});
