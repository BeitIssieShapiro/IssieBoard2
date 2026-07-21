# IssieCalc Settings Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed the IssieBoard configurator editor inside IssieCalc's SettingsScreen, customized for calc (no diacritics tab, no keyboard layout selector, calc keyboard preview with Basic/Scientific toggle, single profile, separate storage).

**Architecture:** Extend `AppContext` type to include `'issiecalc'`. Add `issiecalc` branches to storage key functions in `EditorScreen.tsx`. Pass a pre-built calc config (from `ios/IssieCalc/default_config.json`) as the source keyboard instead of a language keyboard. Add a Basic/Scientific preview toggle above the `InteractiveCanvas`. IssieCalc `SettingsScreen` mounts `EditorScreenInner` with `appContext='issiecalc'`. On close, `CalcScreen` reloads saved config from `KeyboardPreferences`.

**Tech Stack:** React Native (TypeScript), existing `EditorScreen`/`EditorContext`/`InteractiveCanvas`, `KeyboardPreferences` storage, existing `KeyboardPreview` native component.

## Global Constraints

- iOS first — no Android changes
- No git commits unless asked
- Changes to `EditorScreen.tsx`, `GlobalSettingsPanel.tsx`, `Toolbox.tsx`, `InteractiveCanvas.tsx` must be backward-compatible — IssieBoard and IssieVoice behavior unchanged
- Storage key for IssieCalc config: `keyboardConfig_issiecalc`
- Storage key for active profile: `active_profile_issiecalc_calc`
- No language switching in IssieCalc editor (calc has no language)
- Single profile, no multi-language profile rows

---

## File Map

| File | Status | Change |
|------|--------|--------|
| `src/screens/EditorScreen.tsx` | Modify | Add `'issiecalc'` to `AppContext`, storage key branches, source keyboard loading |
| `src/components/toolbox/GlobalSettingsPanel.tsx` | Modify | Hide keyboard layout selector when `appContext === 'issiecalc'` |
| `src/components/toolbox/Toolbox.tsx` | Modify | Hide nikkud tab when `appContext === 'issiecalc'` |
| `src/components/canvas/InteractiveCanvas.tsx` | Modify | Add Basic/Scientific preview toggle for `appContext === 'issiecalc'` |
| `apps/issiecalc/src/screens/SettingsScreen.tsx` | Rewrite | Mount `EditorScreenInner` with `appContext='issiecalc'` |
| `apps/issiecalc/src/screens/CalcScreen.tsx` | Modify | Reload config from `KeyboardPreferences` on settings close |
| `apps/issiecalc/App.tsx` | Modify | Wrap with `EditorProvider` |

---

### Task 1: Extend `AppContext` and storage keys in `EditorScreen.tsx`

**Files:**
- Modify: `src/screens/EditorScreen.tsx`

**Interfaces:**
- `AppContext` type becomes `'issieboard' | 'issievoice' | 'issiecalc'`
- `getKeyboardConfigKey('calc', 'issiecalc')` → `'keyboardConfig_issiecalc'`
- `getActiveProfileKey('calc', 'issiecalc')` → `'active_profile_issiecalc_calc'`
- Source keyboard for `issiecalc`: load `ios/IssieCalc/default_config.json` directly (already has keysets/groups)

- [ ] **Step 1: Extend `AppContext` type (line ~334)**

```typescript
type AppContext = 'issieboard' | 'issievoice' | 'issiecalc';
```

- [ ] **Step 2: Extend `getKeyboardConfigKey` to handle `issiecalc`**

Find `getKeyboardConfigKey` (~line 349) and add branch:
```typescript
const getKeyboardConfigKey = (language: LanguageId | 'calc', appContext: AppContext = 'issieboard'): string => {
  if (appContext === 'issieboard') return `keyboardConfig_${language}`;
  return `keyboardConfig_${appContext}_${language}`;
};
```
This makes IssieVoice → `keyboardConfig_issievoice_he`, IssieCalc → `keyboardConfig_issiecalc_calc`. Backward-compatible.

- [ ] **Step 3: Extend `saveKeyboardConfig` to handle `issiecalc`**

Find `saveKeyboardConfig` (~line 364). The `keyboardId` line:
```typescript
const keyboardId = appContext === 'issieboard' ? language : `${appContext}_${language}`;
```
This already works for `issiecalc` — `keyboardId` becomes `issiecalc_calc`. No change needed.

- [ ] **Step 4: Add `issiecalc` source keyboard loading**

Find where `EditorScreenInner` builds the initial config (~line 475-530). Add branch so when `appContext === 'issiecalc'`, it loads the built calc config instead of a language keyboard:

```typescript
// Near the existing keyboard loading logic:
if (appContext === 'issiecalc') {
  const calcConfig = require('../../ios/IssieCalc/default_config.json');
  // Use it directly as the base config (already has keysets + groups)
  setConfig(calcConfig);
  return;
}
```

- [ ] **Step 5: Add `'calc'` to `LanguageId` union or use a separate type**

`EditorScreenInner` uses `language: LanguageId`. For IssieCalc, pass `language='calc'` (treated as a no-op for keyboard building). Add `'calc'` as allowed value where needed, guarded by `appContext === 'issiecalc'` checks so it never reaches language-specific paths.

---

### Task 2: Hide diacritics tab in `Toolbox.tsx`

**Files:**
- Modify: `src/components/toolbox/Toolbox.tsx`

**Interfaces:**
- Consumes: `appContext?: 'issievoice' | 'issieboard' | 'issiecalc'` (already in props, line 67)
- Change: nikkud tab hidden when `appContext === 'issiecalc'`

- [ ] **Step 1: Find the nikkud tab render (~line 234) and add guard**

```typescript
case 'nikkud':
  if (appContext === 'issiecalc') return null;
  return state.config.diacritics ? <DiacriticsPanel /> : null;
```

- [ ] **Step 2: Hide nikkud tab button**

Find where tab buttons are rendered (look for `'nikkud'` tab button). Add:
```typescript
{appContext !== 'issiecalc' && <TabButton id="nikkud" ... />}
```

---

### Task 3: Hide keyboard layout selector in `GlobalSettingsPanel.tsx`

**Files:**
- Modify: `src/components/toolbox/GlobalSettingsPanel.tsx`

**Interfaces:**
- Add `appContext?: AppContext` to `GlobalSettingsPanelProps` (line 27)
- Keyboard layout section (line 410): hidden when `appContext === 'issiecalc'`

- [ ] **Step 1: Add `appContext` to `GlobalSettingsPanelProps`**

```typescript
export interface GlobalSettingsPanelProps {
  // ... existing props
  appContext?: 'issieboard' | 'issievoice' | 'issiecalc';
}
```

- [ ] **Step 2: Guard the keyboard layout section (~line 410)**

```typescript
{appContext !== 'issiecalc' && keyboardVariants && keyboardVariants.length > 1 && (
  // existing keyboard layout ButtonGroupRow
)}
```

- [ ] **Step 3: Pass `appContext` from `Toolbox.tsx` to `GlobalSettingsPanel`**

Find where `GlobalSettingsPanel` is rendered in `Toolbox.tsx` (~line 221) and pass `appContext={appContext}`.

---

### Task 4: Add Basic/Scientific preview toggle in `InteractiveCanvas.tsx`

**Files:**
- Modify: `src/components/canvas/InteractiveCanvas.tsx`

**Interfaces:**
- When `appContext === 'issiecalc'`: render a segmented control (Basic / Scientific) above the keyboard preview
- Toggle switches `previewCalcKeyset` local state between `'basic'` and `'scientific'`
- The `configJson` passed to `KeyboardPreview` sets `defaultKeyset` to match the toggle

- [ ] **Step 1: Add local state for calc preview keyset**

```typescript
const [calcPreviewKeyset, setCalcPreviewKeyset] = useState<'basic' | 'scientific'>('basic');
```

- [ ] **Step 2: Override `defaultKeyset` in `configJson` when `appContext === 'issiecalc'`**

```typescript
const configJson = useMemo(() => {
  const base = transformConfigForPreview(configWithGroups);
  if (appContext === 'issiecalc') {
    return JSON.stringify({ ...base, defaultKeyset: calcPreviewKeyset });
  }
  return JSON.stringify(base);
}, [configWithGroups, appContext, calcPreviewKeyset]);
```

- [ ] **Step 3: Render toggle above `KeyboardPreview` when `appContext === 'issiecalc'`**

```tsx
{appContext === 'issiecalc' && (
  <View style={styles.calcToggle}>
    <TouchableOpacity
      style={[styles.calcToggleBtn, calcPreviewKeyset === 'basic' && styles.calcToggleBtnActive]}
      onPress={() => setCalcPreviewKeyset('basic')}>
      <Text style={styles.calcToggleText}>Basic</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.calcToggleBtn, calcPreviewKeyset === 'scientific' && styles.calcToggleBtnActive]}
      onPress={() => setCalcPreviewKeyset('scientific')}>
      <Text style={styles.calcToggleText}>Scientific</Text>
    </TouchableOpacity>
  </View>
)}
<KeyboardPreview ... />
```

Add to stylesheet:
```typescript
calcToggle: { flexDirection: 'row', justifyContent: 'center', marginBottom: 8, gap: 8 },
calcToggleBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8, backgroundColor: '#E0E0E0' },
calcToggleBtnActive: { backgroundColor: '#2962FF' },
calcToggleText: { fontSize: 13, color: '#333' },
```

---

### Task 5: Rewrite `SettingsScreen.tsx` to mount the editor

**Files:**
- Rewrite: `apps/issiecalc/src/screens/SettingsScreen.tsx`

**Interfaces:**
- Consumes: `EditorScreenInner` from `../../../../src/screens/EditorScreen` — props: `appContext='issiecalc'`, `language='calc'`, `profileId`, `profileName`, `keyboardId='calc'`, `onClose`, `onSave`, `saveRef`, `autoSaveRef`, `discardRef`

- [ ] **Step 1: Rewrite `SettingsScreen.tsx`**

```tsx
import React, { useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EditorScreenInner } from '../../../../src/screens/EditorScreen';

const CALC_PROFILE_ID = 'issiecalc-default';
const CALC_PROFILE_NAME = 'Calculator';

const SettingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const saveRef = useRef<(() => void) | null>(null);
  const autoSaveRef = useRef<(() => void) | null>(null);
  const discardRef = useRef<(() => void) | null>(null);

  const handleClose = () => {
    autoSaveRef.current?.();
    navigation.goBack();
  };

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <EditorScreenInner
          appContext="issiecalc"
          language="calc"
          profileId={CALC_PROFILE_ID}
          profileName={CALC_PROFILE_NAME}
          keyboardId="calc"
          onClose={handleClose}
          onSave={() => {}}
          onProfileChange={() => {}}
          onLanguageChange={() => {}}
          onCreateNew={async () => {}}
          saveRef={saveRef}
          autoSaveRef={autoSaveRef}
          discardRef={discardRef}
        />
      </View>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
});

export default SettingsScreen;
```

---

### Task 6: Reload config in `CalcScreen` on settings close

**Files:**
- Modify: `apps/issiecalc/src/screens/CalcScreen.tsx`

**Interfaces:**
- On `useFocusEffect` (screen regains focus after settings close): read `keyboardConfig_issiecalc_calc` from `KeyboardPreferences`, parse, set as `configJson`
- Falls back to `builtConfig` if nothing saved

- [ ] **Step 1: Add `useFocusEffect` config reload**

```typescript
import { useFocusEffect } from '@react-navigation/native';
import KeyboardPreferences from '../../../../src/native/KeyboardPreferences';

// Inside CalcScreen:
const [liveConfig, setLiveConfig] = useState<any>(builtConfig);

useFocusEffect(
  React.useCallback(() => {
    KeyboardPreferences.getString('keyboardConfig_issiecalc_calc').then(saved => {
      if (saved) {
        try {
          setLiveConfig(JSON.parse(saved));
        } catch {}
      }
    });
  }, [])
);
```

- [ ] **Step 2: Use `liveConfig` in `configJson` memo**

```typescript
const configJson = useMemo(() => {
  let defaultKeyset: string;
  if (keyset === 'scientific') {
    defaultKeyset = landscape ? 'scientific_landscape' : 'scientific';
  } else {
    defaultKeyset = landscape ? 'basic_landscape' : 'basic';
  }
  return JSON.stringify({ ...liveConfig, defaultKeyset });
}, [keyset, landscape, liveConfig]);
```

---

### Task 7: Wrap `App.tsx` with `EditorProvider`

**Files:**
- Modify: `apps/issiecalc/App.tsx`

The `EditorScreenInner` uses `useEditor()` which requires `EditorProvider` in the tree.

- [ ] **Step 1: Add `EditorProvider` to `App.tsx`**

```tsx
import { EditorProvider } from '../../src/context/EditorContext';

const App = () => (
  <SafeAreaProvider>
    <EditorProvider>
      <CalcProvider>
        <NavigationContainer>
          ...
        </NavigationContainer>
      </CalcProvider>
    </EditorProvider>
  </SafeAreaProvider>
);
```
