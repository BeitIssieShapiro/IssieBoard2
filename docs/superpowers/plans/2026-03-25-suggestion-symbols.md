# Suggestion Symbols Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ARASAAC pictogram symbols above word suggestions in IssieVoice's SuggestionsBar.

**Architecture:** Purely additive React Native layer. A new `SymbolService` singleton fetches pictogram URLs from ARASAAC's `bestsearch` API with two-tier caching (in-memory + KeyboardPreferences). MainScreen debounces lookups and passes symbol URLs to SuggestionsBar, which renders images above text. No native code changes.

**Tech Stack:** React Native, TypeScript, ARASAAC REST API, KeyboardPreferences (native storage bridge)

**Spec:** `docs/superpowers/specs/2026-03-25-suggestion-symbols-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `apps/issievoice/src/utils/languageDetection.ts` | Per-word script detection (Hebrew/Arabic/Latin) |
| Create | `apps/issievoice/src/services/SymbolService.ts` | ARASAAC API client, two-tier cache, in-flight dedup |
| Create | `__tests__/issievoice/languageDetection.test.ts` | Unit tests for language detection |
| Create | `__tests__/issievoice/SymbolService.test.ts` | Unit tests for SymbolService |
| Modify | `apps/issievoice/src/components/SuggestionsBar/SuggestionsBar.tsx` | Add symbol images above text, taller bar |
| Modify | `apps/issievoice/src/screens/MainScreen.tsx` | Wire up SymbolService, debounce, pass symbolUrls prop |

---

### Task 1: Language Detection Utility

**Files:**
- Create: `apps/issievoice/src/utils/languageDetection.ts`
- Create: `__tests__/issievoice/languageDetection.test.ts`
- Reference: `apps/issievoice/src/utils/textDirection.ts` (reuse `isHebrewChar`/`isArabicChar` pattern)

- [ ] **Step 1: Write the test file**

```typescript
// __tests__/issievoice/languageDetection.test.ts
import { detectWordLanguage } from '../../apps/issievoice/src/utils/languageDetection';

describe('detectWordLanguage', () => {
  test('detects English words', () => {
    expect(detectWordLanguage('hello')).toBe('en');
    expect(detectWordLanguage('Dog')).toBe('en');
    expect(detectWordLanguage("I'm")).toBe('en');
  });

  test('detects Hebrew words', () => {
    expect(detectWordLanguage('שלום')).toBe('he');
    expect(detectWordLanguage('כלב')).toBe('he');
    expect(detectWordLanguage('אני')).toBe('he');
  });

  test('detects Arabic words', () => {
    expect(detectWordLanguage('مرحبا')).toBe('ar');
    expect(detectWordLanguage('كلب')).toBe('ar');
  });

  test('falls back to en for numbers and punctuation', () => {
    expect(detectWordLanguage('123')).toBe('en');
    expect(detectWordLanguage('...')).toBe('en');
    expect(detectWordLanguage('')).toBe('en');
  });

  test('handles mixed script (majority wins)', () => {
    // Hebrew with nikkud still Hebrew
    expect(detectWordLanguage('שָׁלוֹם')).toBe('he');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/issievoice/languageDetection.test.ts --no-cache`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `apps/issievoice/src/utils/languageDetection.ts`:

```typescript
const isHebrewChar = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return (code >= 0x0590 && code <= 0x05FF) ||
         (code >= 0xFB1D && code <= 0xFB4F);
};

const isArabicChar = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return (code >= 0x0600 && code <= 0x06FF) ||
         (code >= 0x0750 && code <= 0x077F) ||
         (code >= 0x08A0 && code <= 0x08FF) ||
         (code >= 0xFB50 && code <= 0xFDFF) ||
         (code >= 0xFE70 && code <= 0xFEFF);
};

const isLatinChar = (char: string): boolean => /[a-zA-Z]/.test(char);

export const detectWordLanguage = (word: string): 'en' | 'he' | 'ar' => {
  let hebrew = 0;
  let arabic = 0;
  let latin = 0;

  for (const char of word) {
    if (isHebrewChar(char)) hebrew++;
    else if (isArabicChar(char)) arabic++;
    else if (isLatinChar(char)) latin++;
  }

  if (hebrew >= arabic && hebrew >= latin && hebrew > 0) return 'he';
  if (arabic >= hebrew && arabic >= latin && arabic > 0) return 'ar';
  return 'en';
};
```

Note: The char detection functions mirror the patterns in `apps/issievoice/src/utils/textDirection.ts` (lines 8-24). We duplicate rather than import because `textDirection.ts` does not export them.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/issievoice/languageDetection.test.ts --no-cache`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/issievoice/src/utils/languageDetection.ts __tests__/issievoice/languageDetection.test.ts
git commit -m "feat(issievoice): add per-word language detection utility"
```

---

### Task 2: SymbolService — Core Service with Caching

**Files:**
- Create: `apps/issievoice/src/services/SymbolService.ts`
- Create: `__tests__/issievoice/SymbolService.test.ts`
- Reference: `apps/issievoice/src/services/SavedSentencesManager.ts` (KeyboardPreferences pattern)
- Reference: `apps/issievoice/src/utils/languageDetection.ts` (from Task 1)

- [ ] **Step 1: Write the test file**

```typescript
// __tests__/issievoice/SymbolService.test.ts

// Mock KeyboardPreferences (default export — needs __esModule)
jest.mock('../../src/native/KeyboardPreferences', () => ({
  __esModule: true,
  default: {
    getProfile: jest.fn(),
    setProfile: jest.fn(),
  },
}));

// Mock fetch
global.fetch = jest.fn();

import { symbolService } from '../../apps/issievoice/src/services/SymbolService';
import KeyboardPreferences from '../../src/native/KeyboardPreferences';

const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
const mockGetProfile = KeyboardPreferences.getProfile as jest.MockedFunction<typeof KeyboardPreferences.getProfile>;
const mockSetProfile = KeyboardPreferences.setProfile as jest.MockedFunction<typeof KeyboardPreferences.setProfile>;

beforeEach(() => {
  jest.clearAllMocks();
  symbolService.clearCache();
});

const makeApiResponse = (id: number, violence = false, sex = false) => [
  { _id: id, violence, sex, keywords: [{ keyword: 'test' }] },
];

describe('SymbolService', () => {
  describe('getSymbolUrls', () => {
    test('fetches symbol URL from ARASAAC bestsearch API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makeApiResponse(2517)),
      } as Response);

      const result = await symbolService.getSymbolUrls(['dog']);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.arasaac.org/api/pictograms/en/bestsearch/dog'
      );
      expect(result.get('dog')).toBe(
        'https://api.arasaac.org/api/pictograms/2517?download=false'
      );
    });

    test('returns cached result on second call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makeApiResponse(2517)),
      } as Response);

      await symbolService.getSymbolUrls(['dog']);
      const result = await symbolService.getSymbolUrls(['dog']);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.get('dog')).toBe(
        'https://api.arasaac.org/api/pictograms/2517?download=false'
      );
    });

    test('filters out violence=true results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { _id: 100, violence: true, sex: false },
          { _id: 200, violence: false, sex: false },
        ]),
      } as Response);

      const result = await symbolService.getSymbolUrls(['fight']);
      expect(result.get('fight')).toBe(
        'https://api.arasaac.org/api/pictograms/200?download=false'
      );
    });

    test('filters out sex=true results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { _id: 100, violence: false, sex: true },
          { _id: 200, violence: false, sex: false },
        ]),
      } as Response);

      const result = await symbolService.getSymbolUrls(['body']);
      expect(result.get('body')).toBe(
        'https://api.arasaac.org/api/pictograms/200?download=false'
      );
    });

    test('returns null when all results are unsafe', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { _id: 100, violence: true, sex: false },
        ]),
      } as Response);

      const result = await symbolService.getSymbolUrls(['bad']);
      expect(result.get('bad')).toBeNull();
    });

    test('returns null on 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await symbolService.getSymbolUrls(['xyzzy']);
      expect(result.get('xyzzy')).toBeNull();
    });

    test('returns null on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await symbolService.getSymbolUrls(['hello']);
      expect(result.get('hello')).toBeNull();
    });

    test('detects Hebrew and uses he locale', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makeApiResponse(3000)),
      } as Response);

      await symbolService.getSymbolUrls(['שלום']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/he/bestsearch/')
      );
    });

    test('deduplicates concurrent requests for same word', async () => {
      let resolvePromise: (value: Response) => void;
      const pendingPromise = new Promise<Response>(resolve => {
        resolvePromise = resolve;
      });
      mockFetch.mockReturnValueOnce(pendingPromise);

      const promise1 = symbolService.getSymbolUrls(['dog']);
      const promise2 = symbolService.getSymbolUrls(['dog']);

      resolvePromise!({
        ok: true,
        json: () => Promise.resolve(makeApiResponse(2517)),
      } as Response);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result1.get('dog')).toBe(result2.get('dog'));
    });
  });

  describe('loadCache', () => {
    test('loads persistent cache from KeyboardPreferences', async () => {
      mockGetProfile.mockResolvedValueOnce(
        JSON.stringify({ dog_en: 'https://api.arasaac.org/api/pictograms/2517?download=false' })
      );

      await symbolService.loadCache();
      const result = await symbolService.getSymbolUrls(['dog']);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.get('dog')).toBe(
        'https://api.arasaac.org/api/pictograms/2517?download=false'
      );
    });
  });

  describe('persistCache', () => {
    test('persists cache after new fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makeApiResponse(2517)),
      } as Response);

      await symbolService.getSymbolUrls(['dog']);

      expect(mockSetProfile).toHaveBeenCalledWith(
        expect.stringContaining('"dog_en"'),
        'issievoice_symbol_cache'
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/issievoice/SymbolService.test.ts --no-cache`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `apps/issievoice/src/services/SymbolService.ts`:

```typescript
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
      const normalized = word.toLowerCase().trim();
      if (!normalized) continue;

      const locale = detectWordLanguage(normalized);
      const cacheKey = `${normalized}_${locale}`;

      if (this.cache.has(cacheKey)) {
        result.set(word, this.cache.get(cacheKey)!);
      } else if (this.inflight.has(cacheKey)) {
        // Await existing in-flight request
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/issievoice/SymbolService.test.ts --no-cache`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/issievoice/src/services/SymbolService.ts __tests__/issievoice/SymbolService.test.ts
git commit -m "feat(issievoice): add SymbolService with ARASAAC API and two-tier caching"
```

---

### Task 3: SuggestionsBar — Add Symbol Images

**Files:**
- Modify: `apps/issievoice/src/components/SuggestionsBar/SuggestionsBar.tsx`

- [ ] **Step 1: Add Image import and symbolUrls prop**

In `apps/issievoice/src/components/SuggestionsBar/SuggestionsBar.tsx`, add `Image` to the React Native imports (line 4) and add `symbolUrls` to the props interface (after line 14):

```typescript
// Line 4: add Image to imports
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';

// In SuggestionsBarProps interface, add:
  symbolUrls?: Map<string, string | null>;
```

- [ ] **Step 2: Update the component to render symbols**

Destructure the new prop (add `symbolUrls = new Map()` to the destructured props around line 47).

Compute whether symbols should be shown based on available height (the small-screen fallback per spec):

```typescript
const showSymbols = height >= 120;
const imageSize = showSymbols ? Math.floor(buttonHeight * 0.55) : 0;
```

Replace the suggestion button rendering (lines 108-118) with a vertically stacked layout:

```tsx
{displaySuggestions.map((suggestion, index) => {
  const symbolUrl = symbolUrls.get(suggestion);
  return (
    <TouchableOpacity
      key={`${suggestion}-${index}`}
      style={[styles.suggestionButton, showSymbols && { minWidth: 85 }]}
      onPress={() => handleSuggestionPress(suggestion)}
      activeOpacity={0.7}>
      {showSymbols && symbolUrl && (
        <Image
          source={{ uri: symbolUrl }}
          style={{
            width: imageSize,
            height: imageSize,
            borderRadius: 4,
            marginBottom: 2,
          }}
          resizeMode="contain"
          accessibilityLabel={suggestion}
          accessibilityRole="image"
        />
      )}
      <Text
        style={[
          styles.suggestionText,
          { fontSize },
          isMobile && { fontSize: fontSize * 0.8, lineHeight: 12 },
        ]}
        numberOfLines={1}>
        {suggestion}
      </Text>
    </TouchableOpacity>
  );
})}
```

- [ ] **Step 3: Verify the component renders without errors**

This is a UI component — verify by running the app later in Task 5. For now, ensure no TypeScript errors:

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No errors related to SuggestionsBar

- [ ] **Step 4: Commit**

```bash
git add apps/issievoice/src/components/SuggestionsBar/SuggestionsBar.tsx
git commit -m "feat(issievoice): add ARASAAC symbol images to SuggestionsBar"
```

---

### Task 4: MainScreen — Wire Up SymbolService

**Files:**
- Modify: `apps/issievoice/src/screens/MainScreen.tsx`

- [ ] **Step 1: Add imports and state**

At the top of `apps/issievoice/src/screens/MainScreen.tsx`, add import (after line 21):

```typescript
import { symbolService } from '../services/SymbolService';
```

Inside the `MainScreen` component (after line 55 — the `kbSuggestions` state):

```typescript
const [symbolUrls, setSymbolUrls] = useState<Map<string, string | null>>(new Map());
const symbolDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const suggestionsRef = useRef<string[]>([]);
```

- [ ] **Step 2: Add cache loading on mount**

Find the existing `useEffect` that runs on mount (or add a new one after the state declarations). Add:

```typescript
useEffect(() => {
  symbolService.loadCache();
  return () => {
    // Clean up debounce timeout on unmount
    if (symbolDebounceRef.current) {
      clearTimeout(symbolDebounceRef.current);
    }
  };
}, []);
```

- [ ] **Step 3: Add debounced symbol lookup in handleSuggestionsChange**

Modify `handleSuggestionsChange` (line 520) to trigger symbol lookups:

```typescript
const handleSuggestionsChange = (event: any) => {
  const suggestions = event.nativeEvent.suggestions || [];
  console.log('🔮 KB Suggestions received:', suggestions);
  setKbSuggestions(suggestions);
  suggestionsRef.current = suggestions;

  // Debounce symbol lookups
  if (symbolDebounceRef.current) {
    clearTimeout(symbolDebounceRef.current);
  }
  symbolDebounceRef.current = setTimeout(async () => {
    if (suggestions.length === 0) {
      setSymbolUrls(new Map());
      return;
    }
    const urls = await symbolService.getSymbolUrls(suggestions);
    // Only update if suggestions haven't changed
    if (suggestionsRef.current === suggestions) {
      setSymbolUrls(urls);
    }
  }, 300);
};
```

- [ ] **Step 4: Update SuggestionsBar props and height**

Find the `<SuggestionsBar>` JSX (line 677) and update:

```tsx
{/* Calculate height: use 120px min unless it would exceed 40% of available space */}
const suggestionsHeight = isLandscape ? availableHeight * 0.22 : availableHeight * 0.18;
const minSymbolHeight = availableHeight * 0.4 >= 120 ? 120 : suggestionsHeight;

<SuggestionsBar
  currentText={currentText}
  kbSuggestions={kbSuggestions}
  symbolUrls={symbolUrls}
  language={currentLanguage}
  onSuggestionPress={handleSuggestionFromBar}
  height={Math.max(minSymbolHeight, suggestionsHeight)}
  screenWidth={frame.width}
/>
```

Note: When `availableHeight * 0.4 < 120` (very small screen), we skip the 120px floor entirely — the proportional height is used, and `SuggestionsBar`'s internal `showSymbols = height >= 120` will disable symbols, falling back to text-only. This matches the spec's graceful degradation requirement.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add apps/issievoice/src/screens/MainScreen.tsx
git commit -m "feat(issievoice): wire up SymbolService with debounced lookups in MainScreen"
```

---

### Task 5: Manual Testing & Polish

**Files:**
- Possibly adjust: all files from Tasks 1-4

- [ ] **Step 1: Run all unit tests**

Run: `npx jest --no-cache`
Expected: All tests pass

- [ ] **Step 2: Build and run on iOS simulator**

Run: `npm run ios` (or open in Xcode and run IssieVoice scheme)

Test the following scenarios:
1. **Completion mode**: Type "hel" — suggestions should show pictograms above "hello", "help", etc.
2. **Prediction mode**: Type "I " (with space) — next-word predictions should show pictograms
3. **Default mode**: Clear text — default suggestions ("I", "the") should show pictograms
4. **Hebrew**: Switch to Hebrew keyboard — Hebrew suggestions should show Hebrew pictograms
5. **No symbol**: Type unusual words — should gracefully show text-only
6. **Rapid typing**: Type quickly — no lag, debounce working
7. **Cache**: Kill and reopen app — previously seen words should show symbols instantly

- [ ] **Step 3: Adjust visual sizing if needed**

Fine-tune these values based on how the UI looks:
- `imageSize` calculation in SuggestionsBar
- Button `minWidth` value
- Bar height proportions in MainScreen
- Font size scaling when symbols are present

- [ ] **Step 4: Run all tests again**

Run: `npx jest --no-cache`
Expected: All tests pass

- [ ] **Step 5: Final commit if any polish changes were made**

```bash
git add -A
git commit -m "fix(issievoice): polish suggestion symbol sizing and layout"
```
