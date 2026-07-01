# Suggestion Symbols — ARASAAC Pictograms in IssieVoice Suggestions

**Date**: 2026-03-25
**Status**: Approved

## Overview

Add ARASAAC pictogram symbols alongside word suggestions/predictions in IssieVoice. Each suggestion button shows a symbol image above the word text, helping users with developmental or motor skill disabilities associate words with visual symbols (AAC — Augmentative and Alternative Communication).

## API

**Endpoint**: `GET https://api.arasaac.org/api/pictograms/{locale}/bestsearch/{keyword}`

- `{locale}`: 2-char language code (`en`, `he`, `ar`) — detected per-word by script analysis, independent of the keyboard language prop (which is only `'en' | 'he'`)
- `{keyword}`: the suggestion word (lowercased, trimmed)
- Returns a JSON array of best-match pictogram objects, sorted by relevance. We take `data[0]._id`.

**Response schema** (verified):
```json
[
  {
    "_id": 2517,
    "keywords": [{ "keyword": "dog", "type": 2, "plural": "dogs", ... }],
    "violence": false,
    "sex": false,
    "aac": true,
    "categories": ["pet", "domestic animal", ...],
    ...
  }
]
```

**Image URL**: `https://api.arasaac.org/api/pictograms/{id}?download=false`

- Returns a PNG pictogram image
- React Native `<Image>` handles HTTP caching of the actual image data

## Architecture

Purely additive React Native layer. No native code changes (no changes to KeyboardEngine, KeyboardRenderer, WordSuggestionController, or the RN bridge).

### New Files

1. **`apps/issievoice/src/services/SymbolService.ts`** — Singleton service for symbol lookup and caching
2. **`apps/issievoice/src/utils/languageDetection.ts`** — Per-word script detection utility

### Modified Files

3. **`apps/issievoice/src/screens/MainScreen.tsx`** — New `symbolUrls` state, calls SymbolService when suggestions change
4. **`apps/issievoice/src/components/SuggestionsBar/SuggestionsBar.tsx`** — Taller bar with image+text layout

## Component Design

### SymbolService (`apps/issievoice/src/services/SymbolService.ts`)

Singleton class with two-tier caching:

- **In-memory cache**: `Map<string, string | null>` keyed by `{word}_{locale}` (e.g. `dog_en`, `כלב_he`)
- **Persistent cache**: Uses `KeyboardPreferences` (the existing native storage bridge used by SavedSentencesManager, FavoritesManager, etc.) — no new dependencies. Stores a JSON object mapping cache keys to URLs or `null`.
- **Negative caching**: Words with no ARASAAC result (404/empty) are cached as `null` persistently. Network errors are cached as `null` in-memory only (so they retry after app restart).
- **Cache eviction**: Max 2000 entries in persistent cache. FIFO eviction — oldest entries removed when limit exceeded.
- **In-flight deduplication**: `Map<string, Promise<string | null>>` tracks pending requests. A second lookup for the same word awaits the existing promise instead of making a duplicate API call.

**Public API**:
```typescript
class SymbolService {
  // Batch lookup: checks cache first, fetches missing in parallel
  async getSymbolUrls(words: string[]): Promise<Map<string, string | null>>

  // Load persistent cache from KeyboardPreferences (call on app mount)
  async loadCache(): Promise<void>
}
```

**Fetch logic per word**:
1. Normalize: `word.toLowerCase().trim()`
2. Detect language from script (Hebrew/Arabic/Latin chars) — this is independent of the keyboard language prop
3. Check in-memory cache → return if hit
4. Check in-flight map → await if already fetching
5. Call `bestsearch` API → skip results where `violence: true` or `sex: true` → take first remaining `_id` → construct image URL
6. Store URL in both caches; store `null` in persistent cache for 404/empty, in-memory only for network errors
7. Remove from in-flight map

### languageDetection (`apps/issievoice/src/utils/languageDetection.ts`)

```typescript
// Returns 'he', 'ar', or 'en' based on majority script in the word
function detectWordLanguage(word: string): 'en' | 'he' | 'ar'
```

- Hebrew: Unicode range `\u0590-\u05FF`
- Arabic: Unicode range `\u0600-\u06FF`
- Latin: `a-zA-Z`
- Fallback: `'en'` for numbers, punctuation, etc.

### MainScreen Integration

In `MainScreen.tsx`:

1. New state: `const [symbolUrls, setSymbolUrls] = useState<Map<string, string | null>>(new Map())`
2. On mount: call `SymbolService.loadCache()`
3. In `handleSuggestionsChange`: after setting `kbSuggestions`, call `SymbolService.getSymbolUrls(suggestions)` with a **300ms debounce** to avoid excessive API calls during rapid typing. Only update `symbolUrls` if the suggestions haven't changed since the call was made (stale results ignored).
4. Pass `symbolUrls` as new prop to `SuggestionsBar`

### SuggestionsBar UI Changes

**New prop**: `symbolUrls?: Map<string, string | null>`

**Layout per suggestion button** (vertical stack):
```
+-------------------+
|    [Image 60%]    |   ← ARASAAC pictogram, square aspect ratio
|                   |
|    "word" 40%     |   ← Text label
+-------------------+
```

**Sizing**:
- Bar height: increase MainScreen proportions to `availableHeight * 0.18` (portrait) / `availableHeight * 0.22` (landscape), with a minimum of 120px. On very small screens where 120px would be too large (>40% of available height), fall back to text-only (no symbols).
- Image: sized relative to button height (~60% for image, ~40% for text)
- Button min-width: increased to ~80-90px to accommodate image

**No-symbol fallback**: When `symbolUrls.get(word)` is `null` or undefined, render text-only (same as current behavior). No placeholder image.

**Accessibility**: Each `<Image>` gets `accessibilityLabel={word}` and `accessibilityRole="image"`.

**RTL**: Existing RTL logic (reverse suggestion order for Hebrew) remains unchanged.

## Data Flow

```
Native keyboard engine
  → onSuggestionsChange (string[])
  → MainScreen.handleSuggestionsChange()
      → setKbSuggestions(suggestions)           // immediate, text appears
      → SymbolService.getSymbolUrls(suggestions) // async
          → cache hit? → instant
          → cache miss? → ARASAAC bestsearch API (parallel per word)
      → setSymbolUrls(urls)                     // symbols appear
  → SuggestionsBar renders image+text per suggestion
```

## Error Handling

- **API failure (network error)**: Return `null` for that word. Cache `null` in-memory only (retries on next app session). Text-only fallback.
- **404 / no results**: Cache as `null` persistently (these words genuinely have no pictogram).
- **Content safety filter**: Skip results where `violence: true` or `sex: true`, take next safe result or `null`.
- **Rapid typing**: 300ms debounce on symbol lookups. In-flight deduplication prevents duplicate requests for the same word. Stale results (from a previous suggestion set) are discarded.

## Applies To

- All three suggestion modes: completion (mid-word), prediction (after space), defaults (common words)
- All supported languages (English, Hebrew, Arabic)

## Not In Scope

- Downloading images to local filesystem (rely on RN `<Image>` HTTP cache)
- User-selectable symbols (always use best match)
- Symbols in the native keyboard extension (only IssieVoice)
- Preloading the entire dictionary
