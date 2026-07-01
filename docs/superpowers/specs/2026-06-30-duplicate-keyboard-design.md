# Clone Keyboard Feature

**Date:** 2026-06-30

## Summary

Add a clone (duplicate) button to each profile pill in the keyboard picker list. Tapping it opens a "Clone Keyboard" modal with a pre-filled name, lets the user edit the name, then creates and switches to the new keyboard. The clone always reads from saved storage — never from in-memory dirty state.

---

## Dirty State Guard

Before opening the clone modal, if `isDirty` is true:
- Show the existing `confirmUnsavedChanges` alert (Save / Discard / Cancel)
- **Save** → save current profile, then open clone modal
- **Discard** → discard changes, then open clone modal
- **Cancel** → do nothing

This applies regardless of which profile pill was tapped (active or not) — dirty state always needs resolution first.

---

## UI: Profile Pill Button

- Icon-only button, placed between the export (share) icon and the trash (delete) icon
- Icon: `copy-outline` (Ionicons) — same size/style as trash icon (18px)
- Color: `#6B7280` (grey, same as export icon) — white when the pill is active
- Shown for **all** profiles including built-ins (cloning a built-in creates a custom copy)
- Same `hitSlop` as existing icon buttons

## Clone Modal

- Reuses the existing `showDuplicateModal` / `duplicateName` state already in `EditorScreen`
- Needs a new piece of state: `profileToClone: ProfileOption | null` — which profile was tapped
- Modal title: `strings.editor.cloneKeyboard` (new string, e.g. "Clone Keyboard" / "שכפל מקלדת")
- Subtitle: `strings.editor.cloneKeyboardSubtitle` (e.g. "Create a copy of «[name]»")
- Input pre-filled with: `"Copy of [name]"` / `"עותק של [name]"` / `"نسخة من [name]"`
  - New string key: `strings.editor.copyOf` (e.g. `"Copy of"`)
- Confirm button: `strings.common.create`

## Clone Logic: `handleCloneProfile`

New handler, distinct from existing `handleDuplicate` (which duplicates current in-memory state).

```
async handleCloneProfile():
  1. Read saved profile def from storage: `profile_def_${profileToClone.id}`
  2. Read saved style groups from storage: `${profileToClone.id}_styleGroups`
  3. Generate new id: `custom_${Date.now()}`
  4. Overwrite id and name in the profile def
  5. Write new `profile_def_${newId}` and `${newId}_styleGroups` to storage
  6. Append to `saved_list`
  7. Load the new profile via existing `loadProfile(newId)` flow
  8. Switch: setCurrentProfileId, setCurrentProfileName, onProfileChange
  9. Close modal, show toast "✓ Cloned «[name]»"
```

For built-in profiles: they have no `profile_def_` in storage. Re-load the built-in's default config fresh from the keyboard template (same data that loads when you select it from the list) — not from `state.config`, which may be dirty.

## Localization

New string keys needed in all three languages (en / he / ar):

| Key | EN | HE | AR |
|-----|----|----|-----|
| `editor.cloneKeyboard` | "Clone Keyboard" | "שכפל מקלדת" | "استنساخ لوحة المفاتيح" |
| `editor.cloneKeyboardSubtitle` | `"Create a copy of «{name}»"` | `"צור עותק של «{name}»"` | `"إنشاء نسخة من «{name}»"` |
| `editor.copyOf` | `"Copy of"` | `"עותק של"` | `"نسخة من"` |

## Files Changed

- `src/localization/strings.ts` — add 3 new string keys
- `src/screens/EditorScreen.tsx` — add `profileToClone` state, `handleCloneProfile` handler, clone button in pill JSX, clone modal JSX (reuse existing modal structure)

No new files needed.
