import KeyboardPreferences from '../../../../src/native/KeyboardPreferences';
import type { SavedSentence } from './SavedSentencesManager';
import type { Favorite } from './FavoritesManager';

// Same storage keys as SavedSentencesManager / FavoritesManager
const SENTENCES_KEY = 'issievoice_saved_sentences';
const FAVORITES_KEY = 'issievoice_favorites';

export const VOICE_DATA_FILE_PREFIX = 'voicedata__';

export interface VoiceBackupData {
  version: string;
  type: 'issievoice-data';
  sentences: SavedSentence[];
  // Sentence ids in favorites-bar order
  favorites: string[];
}

async function readJson<T>(key: string): Promise<T[]> {
  try {
    const json = await KeyboardPreferences.getProfile(key);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

// Same duplicate rule as SavedSentencesManager.saveSentence
const normalize = (text: string) => text.trim().toLowerCase();

/** IssieVoice's saved sentences and favorites, or null when there are none. */
export async function exportVoiceData(): Promise<VoiceBackupData | null> {
  const sentences = await readJson<SavedSentence>(SENTENCES_KEY);
  const favorites = await readJson<Favorite>(FAVORITES_KEY);
  if (sentences.length === 0) return null;
  return {
    version: '1.0',
    type: 'issievoice-data',
    sentences,
    favorites: [...favorites].sort((a, b) => a.order - b.order).map(f => f.id),
  };
}

/**
 * Merges backed-up sentences and favorites into the existing ones. Idempotent:
 * a sentence whose text already exists is not added again, and a favorite that
 * is already a favorite is left as is. Returns the number of sentences added.
 */
export async function importVoiceData(data: VoiceBackupData): Promise<number> {
  if (data?.type !== 'issievoice-data' || !Array.isArray(data.sentences)) return 0;

  const sentences = await readJson<SavedSentence>(SENTENCES_KEY);
  const favorites = await readJson<Favorite>(FAVORITES_KEY);

  const idByText = new Map(sentences.map(s => [normalize(s.text), s.id]));
  const usedIds = new Set(sentences.map(s => s.id));
  // Backup sentence id -> the id of the same sentence on this device
  const localId = new Map<string, string>();
  let added = 0;

  for (const sentence of data.sentences) {
    if (!sentence?.text) continue;
    const existing = idByText.get(normalize(sentence.text));
    if (existing) {
      localId.set(sentence.id, existing);
      continue;
    }
    let id = sentence.id;
    while (!id || usedIds.has(id)) {
      id = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }
    usedIds.add(id);
    idByText.set(normalize(sentence.text), id);
    localId.set(sentence.id, id);
    sentences.push({ ...sentence, id });
    added++;
  }

  let order = favorites.length > 0 ? Math.max(...favorites.map(f => f.order)) + 1 : 0;
  for (const backupId of data.favorites ?? []) {
    const id = localId.get(backupId);
    if (id && !favorites.some(f => f.id === id)) {
      favorites.push({ id, order: order++ });
    }
  }

  await KeyboardPreferences.setProfile(JSON.stringify(sentences), SENTENCES_KEY);
  await KeyboardPreferences.setProfile(JSON.stringify(favorites), FAVORITES_KEY);
  return added;
}
