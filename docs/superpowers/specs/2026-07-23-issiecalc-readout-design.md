# IssieCalc Readout (TTS) — Design Spec

## Overview

Add text-to-speech readout to IssieCalc. Two modes: read each digit/operator as typed, or read only when an input element is complete. Configured via a new "Voice" tab in Settings.

## Architecture

### New: `CalcTTSContext`

**File:** `apps/issiecalc/src/context/CalcTTSContext.tsx`

Standalone context wrapping the shared `TextToSpeech` service (`apps/issievoice/src/services/TextToSpeech.ts`). No dependency on IssieVoice's `TTSContext` — that context carries multi-language auto-detection logic irrelevant to a calculator. All settings persisted via `KeyboardPreferences`.

### Persistence Keys

| Key | Type | Values |
|-----|------|--------|
| `issiecalc_readout_mode` | string | `'off'` \| `'every-digit'` \| `'every-number'` |
| `issiecalc_tts_rate` | number | `0.3` (slow) / `0.5` (normal) / `0.7` (fast) |
| `issiecalc_tts_pitch` | number | `0.8` (low) / `1.0` (normal) / `1.2` (high) |
| `issiecalc_tts_voice_id` | string | Voice ID from device TTS engine |
| `issiecalc_tts_language` | string | TTS language code, e.g. `'en-US'`, `'he-IL'` |

Voice ID and language are stored together — selecting a voice in the picker saves both.

### `CalcTTSContext` API

```ts
interface CalcTTSContextValue {
  readoutMode: 'off' | 'every-digit' | 'every-number';
  rate: number;
  pitch: number;
  voiceId: string | null;
  language: string | null;
  setReadoutMode: (mode: ReadoutMode) => void;
  setRate: (rate: number) => void;
  setPitch: (pitch: number) => void;
  setVoice: (voiceId: string, language: string) => void;
  readout: (keyValue: string, expression: string, result: string) => void;
}
```

`readout` is fire-and-forget. `expression` and `result` are passed so the context can construct the "every-number" phrase without needing to read CalcContext internals.

## Readout Logic

### `every-digit` mode

Called after every `appendToExpression`. Speaks the key with human-readable substitutions:

| Key value | Spoken |
|-----------|--------|
| `*` | "times" |
| `/` | "divided by" |
| `+` | "plus" |
| `-` | "minus" |
| `^` | "to the power of" |
| `%` | "percent" |
| `sqrt(` | "square root" |
| `ln(` | "ln" |
| `log(` | "log" |
| `(` | "open parenthesis" |
| `)` | "close parenthesis" |
| `pi` | "pi" |
| `e` | "e" |
| all others | spoken as-is |

No readout for: `⌫`, `AC`, `+/-`, `[2ND]`, `[2ND_OFF]`, `[ANGLE_TOGGLE]`, `ms`, `mr`, `rand`.

### `every-number` mode

- **Operator pressed** (`+`, `-`, `*`, `/`, `^`, `%`): extract the number segment typed before the operator from the current expression, speak "[number] [operator name]". E.g. expression becomes `145+` → speaks "145 plus".
- **`=` pressed** (`computeResult`): speak "[last operand] equals [result]". E.g. pending operand is "100", result is "245" → speaks "100 equals 245". If result is "Error", speak "error".
- No readout for any other key in this mode.

"Last operand" is extracted from the expression: the number segment after the last operator (or the whole expression if no operator).

### Language

Before every speak call, set TTS language to the stored `issiecalc_tts_language`. No auto-detection — user explicitly chose a voice/language in settings.

## Files Changed

### New files

| File | Purpose |
|------|---------|
| `apps/issiecalc/src/context/CalcTTSContext.tsx` | Context, provider, readout logic, persistence |
| `apps/issiecalc/src/components/CalcVoiceSettingsPanel.tsx` | Settings UI for voice tab |

### Modified files

| File | Change |
|------|--------|
| `apps/issiecalc/App.tsx` | Wrap with `CalcTTSProvider` inside `CalcProvider` |
| `apps/issiecalc/src/screens/CalcScreen.tsx` | Call `readout(value, expression, result)` in `handleKeyPress` after each dispatch |
| `apps/issiecalc/src/screens/SettingsScreen.tsx` | Pass `extraTabs` to `SettingsSidebar`; render `CalcVoiceSettingsPanel` when `activeTab === 'voice'` |
| `apps/issievoice/src/components/Settings/SettingsSidebar.tsx` | Add optional `extraTabs` prop — tabs shown after keyboard children with a divider, in both portrait and landscape |

## `SettingsSidebar` — `extraTabs` prop

```ts
extraTabs?: Array<{
  id: string;
  label: string;
  iconName: string;
  iconType: IconType;
  iconColor: string;
}>;
```

Rendered after the keyboard children list, preceded by a `<View style={styles.divider} />`. Works in both portrait (keyboard-only tab row) and landscape sidebar. IssieVoice passes no `extraTabs` — no change to its behavior.

## `CalcVoiceSettingsPanel` UI

All controls use `ButtonGroupRow` (same component as IssieVoice settings) for consistency.

1. **Readout** — 3-button group: `Off` / `Every digit` / `Every number`
2. *(sections 3–5 hidden when mode is `off`)*
3. **Speed** — `Slow` / `Normal` / `Fast`
4. **Pitch** — `Low` / `Normal` / `High`
5. **Voice** — flat list of all device voices, grouped visually by language prefix. Each row shows voice name + language code + Test button. Selecting a voice saves both `voiceId` and `language`.

## Wiring in `CalcScreen`

```ts
const { readout } = useCalcTTS();

const handleKeyPress = (event: KeyPressEvent) => {
  const { value } = event.nativeEvent;
  // ... existing dispatch logic ...

  // after dispatch, fire readout
  readout(value, expressionRef.current, resultRef.current);
};
```

`readout` reads `readoutMode` internally — no conditional logic in `CalcScreen`.

Note: `expression` and `result` refs are passed directly from `CalcScreen` (which already holds `expressionRef` and `resultRef`). For `computeResult`, the result isn't available synchronously — `readout` for `=` uses the result from `CalcContext` after the state update, so it's called after `computeResult()` returns (which sets `resultRef.current` synchronously).

## Out of Scope

- No readout for memory operations (ms, mr)
- No readout for `rand` key
- No readout triggered by AC or backspace
- No per-language multi-voice selection (single voice covers all calc output)
