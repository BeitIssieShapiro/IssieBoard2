# IssieVoice Settings Redesign — Design Spec

## Goal

Replace the scattered IssieVoice settings (SettingsModal, SettingsScreen, KeyboardSettings) with a single unified full-page settings screen that uses a sidebar in landscape and two-level top tabs in portrait.

## Architecture

A new `SettingsScreen` is pushed onto the React Navigation stack from MainScreen's hamburger menu. It contains a sidebar/tabs navigation on the left (landscape) or top (portrait), and a detail area on the right/bottom. The keyboard panels from the existing `EditorScreen` are reused as-is by wrapping them in the same `EditorContext`.

## Tab Structure

```
Sidebar (landscape) / Top tabs (portrait)
├── Keyboard (group header — not tappable, shows language selector + kb name/picker)
│   ├── General (GlobalSettingsPanel, reused as-is)
│   ├── Keys Groups (StyleRulesPanel, reused as-is)
│   └── Nikkud (DiacriticsPanel, reused as-is)
└── Voice (new VoiceSettingsPanel)
```

- **Language tab removed** — always auto-detect
- **Language mode settings removed** from voice/settings

## Layout

### Landscape

```
┌──────────────────────────────────────────────────┐
│ ← Settings                                        │
├────────────┬─────────────────────────────────────┤
│            │                                      │
│ Keyboard   │  [Language: he/en] [Keyboard: name]  │
│   General ●│  ┌──────────────────────────────┐   │
│   Keys Grp │  │                              │   │
│   Nikkud   │  │   Detail content + Save      │   │
│            │  │                              │   │
│ Voice      │  │   ─────────────────────────  │   │
│            │  │   Keyboard Preview (bottom)  │   │
│            │  └──────────────────────────────┘   │
└────────────┴─────────────────────────────────────┘
```

- Left sidebar with icon + label items
- "Keyboard" is a non-tappable group header; its children (General, Keys Groups, Nikkud) are indented and always visible
- "Voice" is a top-level tappable item
- Active item highlighted

### Portrait

```
┌──────────────────────────┐
│ ← Settings               │
├──────────────────────────┤
│  Keyboard  |  Voice      │  ← level 1 top tabs
├──────────────────────────┤
│ General|Keys Grp|Nikkud  │  ← level 2 sub-tabs (only when Keyboard selected)
├──────────────────────────┤
│ [Language: he/en] [KB]   │  ← keyboard header (only for keyboard sub-tabs)
├──────────────────────────┤
│                          │
│   Detail content + Save  │
│                          │
│   ──────────────────     │
│   Keyboard Preview       │
└──────────────────────────┘
```

- Level 1 tabs: Keyboard, Voice
- When "Keyboard" is selected, level 2 sub-tabs appear: General, Keys Groups, Nikkud
- Keyboard header (language selector + profile picker) shows above detail content for keyboard sub-tabs only

## Navigation

- `SettingsScreen` is a new route in the React Navigation stack
- MainScreen hamburger menu calls `navigation.navigate('Settings')` instead of `setSettingsModalVisible(true)`
- Standard slide-in animation (iOS push)
- Back arrow in header bar to return to MainScreen

## Components

### New Files

| File | Purpose |
|------|---------|
| `apps/issievoice/src/screens/SettingsScreen.tsx` | Full-page settings container, owns state: selected tab, language, config |
| `apps/issievoice/src/components/Settings/SettingsSidebar.tsx` | Sidebar (landscape) / top tabs (portrait) navigation |
| `apps/issievoice/src/components/Settings/SettingsDetail.tsx` | Right/bottom content area, renders active panel |
| `apps/issievoice/src/components/Settings/KeyboardHeader.tsx` | Language selector + profile picker, shown for keyboard sub-tabs |
| `apps/issievoice/src/components/Settings/VoiceSettingsPanel.tsx` | Voice selection, speed, pitch, test button |

### Reused Components (no modification)

| Component | Used For |
|-----------|----------|
| `GlobalSettingsPanel` | General keyboard settings (colors, font, features, advanced) |
| `StyleRulesPanel` | Keys groups / style rules |
| `DiacriticsPanel` | Nikkud settings |
| `KeyboardPreview` | Live keyboard preview at bottom of keyboard detail screens |

### Removed

| Component | Reason |
|-----------|--------|
| `SettingsModal` | Replaced by SettingsScreen |
| Old `SettingsScreen` (speed/pitch) | Merged into VoiceSettingsPanel |
| `settingsModalVisible` state in MainScreen | No longer needed |
| `KeyboardSettings` route in App.tsx | Replaced by Settings route |
| Language mode settings (en-only/he-only/detect) | Removed — always auto-detect |

## Data Flow

### Keyboard Settings

- `SettingsScreen` sets up `EditorContext` with the loaded keyboard config (same initialization that `EditorScreen` does today)
- All three keyboard panels read/write through `EditorContext` — no changes needed to the panels
- Changing language in `KeyboardHeader` reloads the config for that language (same as `loadKeyboardConfig` in current `EditorScreen`)
- Save button in each keyboard detail screen persists config back to `KeyboardPreferences`
- Keyboard preview at the bottom reflects live changes through `EditorContext`

### Voice Settings

- `VoiceSettingsPanel` manages its own state
- Voice selection, speed, and pitch save immediately on change to `KeyboardPreferences` (same as current behavior)
- Test button speaks a sample sentence using current TTS settings (language auto-detected, uses selected voice + speed + pitch)

## Keyboard Detail Screens

Each keyboard sub-tab (General, Keys Groups, Nikkud) renders:

1. **Keyboard header** — language selector (he/en) + profile picker with current keyboard name
2. **Panel content** — the reused panel (scrollable)
3. **Save button** — persists changes
4. **Keyboard preview** — at the bottom, shows live keyboard state

When language changes, all three sub-tabs update to reflect the new language's keyboard config.

## Voice Settings Panel

Contents (in order):

1. **Test Voice button** — speaks a sample sentence with current settings
2. **Hebrew Voice** — expandable list of available Hebrew TTS voices with per-voice test buttons
3. **English Voice** — expandable list of available English TTS voices with per-voice test buttons
4. **Speech Speed** — Slow / Normal / Fast segmented control
5. **Voice Pitch** — Low / Normal / High segmented control

All changes save immediately.
