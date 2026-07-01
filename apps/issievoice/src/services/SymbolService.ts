import KeyboardPreferences from '../../../../src/native/KeyboardPreferences';
import { detectWordLanguage } from '../utils/languageDetection';

const ARASAAC_BASE = 'https://api.arasaac.org/api';
const STORAGE_KEY = 'issievoice_symbol_cache';
const MAX_CACHE_SIZE = 2000;

interface ArasaacResult {
  _id: number;
  violence: boolean;
  sex: boolean;
}

class SymbolServiceClass {
  private cache: Map<string, string | null> = new Map();
  private inflight: Map<string, Promise<string | null>> = new Map();
  private persistentDirty = false;

  async loadCache(): Promise<void> {
    try {
      const json = await KeyboardPreferences.getProfile(STORAGE_KEY);
      if (json) {
        const data = JSON.parse(json) as Record<string, string | null>;
        for (const [key, value] of Object.entries(data)) {
          this.cache.set(key, value);
        }
      }
    } catch (error) {
      console.error('[SymbolService] Failed to load cache:', error);
    }
  }

  async getSymbolUrls(words: string[]): Promise<Map<string, string | null>> {
    const result = new Map<string, string | null>();
    const toFetch: string[] = [];

    for (const word of words) {
      // Skip quoted words (literal completions from keyboard)
      if (word.startsWith('"') && word.endsWith('"')) {
        result.set(word, null);
        continue;
      }

      const normalized = word.toLowerCase().trim();
      if (!normalized) continue;

      const locale = detectWordLanguage(normalized);
      const cacheKey = `${normalized}_${locale}`;

      if (this.cache.has(cacheKey)) {
        result.set(word, this.cache.get(cacheKey)!);
      } else if (this.inflight.has(cacheKey)) {
        const url = await this.inflight.get(cacheKey)!;
        result.set(word, url);
      } else {
        toFetch.push(word);
      }
    }

    if (toFetch.length > 0) {
      const promises = toFetch.map(word => this.fetchSymbol(word));
      const urls = await Promise.all(promises);

      toFetch.forEach((word, i) => {
        result.set(word, urls[i]);
      });

      if (this.persistentDirty) {
        await this.persistCache();
        this.persistentDirty = false;
      }
    }

    return result;
  }

  private async fetchSymbol(word: string): Promise<string | null> {
    const normalized = word.toLowerCase().trim();
    const locale = detectWordLanguage(normalized);
    const cacheKey = `${normalized}_${locale}`;

    const promise = this.doFetch(normalized, locale, cacheKey);
    this.inflight.set(cacheKey, promise);

    try {
      return await promise;
    } finally {
      this.inflight.delete(cacheKey);
    }
  }

  private async doFetch(
    keyword: string,
    locale: string,
    cacheKey: string,
  ): Promise<string | null> {
    try {
      const response = await fetch(
        `${ARASAAC_BASE}/pictograms/${locale}/bestsearch/${encodeURIComponent(keyword)}`,
      );

      if (!response.ok) {
        // 404 = no results, cache persistently
        this.cache.set(cacheKey, null);
        this.persistentDirty = true;
        return null;
      }

      const data: ArasaacResult[] = await response.json();
      const safe = data.filter(item => !item.violence && !item.sex);

      if (safe.length === 0) {
        this.cache.set(cacheKey, null);
        this.persistentDirty = true;
        return null;
      }

      const url = `${ARASAAC_BASE}/pictograms/${safe[0]._id}?download=false`;
      this.cache.set(cacheKey, url);
      this.persistentDirty = true;
      return url;
    } catch (error) {
      // Network error: do NOT cache (avoids leaking into persistent cache
      // during batch persist). Will retry on next request.
      return null;
    }
  }

  private async persistCache(): Promise<void> {
    try {
      const persistable: Record<string, string | null> = {};
      const entries = Array.from(this.cache.entries());

      // FIFO eviction: keep only the last MAX_CACHE_SIZE entries
      const toKeep = entries.slice(-MAX_CACHE_SIZE);
      for (const [key, value] of toKeep) {
        persistable[key] = value;
      }

      await KeyboardPreferences.setProfile(
        JSON.stringify(persistable),
        STORAGE_KEY,
      );
    } catch (error) {
      console.error('[SymbolService] Failed to persist cache:', error);
    }
  }

  clearCache(): void {
    this.cache.clear();
    this.inflight.clear();
    this.persistentDirty = false;
  }
}

export const symbolService = new SymbolServiceClass();
