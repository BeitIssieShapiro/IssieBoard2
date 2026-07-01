# Clone Keyboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a clone button to each profile pill in the keyboard picker that copies a keyboard from its saved state, prompts for a new name, then switches to the clone.

**Architecture:** Three changes to `EditorScreen.tsx`: (1) new state `profileToClone`, (2) new handler `handleCloneProfile` that reads from storage (never dirty state), (3) clone button in the profile pill JSX + clone modal JSX. Dirty-state guard reuses the existing `handleLoadProfile` alert pattern. Localization adds 3 new string keys in all 3 languages.

**Tech Stack:** React Native, TypeScript, `KeyboardPreferences` storage bridge, existing `loadProfileInternal` for switching after clone.

---

### Task 1: Add localization strings

**Files:**
- Modify: `src/localization/strings.ts`

- [ ] **Step 1: Add 3 new keys to the `editor` interface (type block)**

In `src/localization/strings.ts`, the `editor` interface starts around line 29. Add after `duplicateProfile: string;`:

```typescript
cloneKeyboard: string;
cloneKeyboardSubtitle: string;
copyOf: string;
```

- [ ] **Step 2: Add English values** (around line 372, in the `en` block)

After `duplicateProfile: 'Duplicate Keyboard',`:

```typescript
cloneKeyboard: 'Clone Keyboard',
cloneKeyboardSubtitle: 'Create a copy of',
copyOf: 'Copy of',
```

- [ ] **Step 3: Add Hebrew values** (around line 708, in the `he` block)

After `duplicateProfile: 'שכפל מקלדת',`:

```typescript
cloneKeyboard: 'שכפל מקלדת',
cloneKeyboardSubtitle: 'צור עותק של',
copyOf: 'עותק של',
```

- [ ] **Step 4: Add Arabic values** (around line 1044, in the `ar` block)

After `duplicateProfile: 'تكرار لوحة المفاتيح',`:

```typescript
cloneKeyboard: 'استنساخ لوحة المفاتيح',
cloneKeyboardSubtitle: 'إنشاء نسخة من',
copyOf: 'نسخة من',
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd /Users/i022021/dev/Issie/IssieBoardNG && npx tsc --noEmit 2>&1 | head -20`

Expected: no errors related to `strings.ts`

---

### Task 2: Add `profileToClone` state and `handleCloneProfile` handler

**Files:**
- Modify: `src/screens/EditorScreen.tsx`

- [ ] **Step 1: Add `profileToClone` state**

Find the block with `const [showDuplicateModal, setShowDuplicateModal] = useState(false);` (around line 508). Add directly after it:

```typescript
const [showCloneModal, setShowCloneModal] = useState(false);
const [profileToClone, setProfileToClone] = useState<ProfileOption | null>(null);
const [cloneName, setCloneName] = useState('');
```

- [ ] **Step 2: Add `handleOpenCloneModal` — dirty guard + open modal**

Add after `handleDeleteProfile` callback (around line 1375). This handler checks dirty state first, then opens the clone modal for the chosen profile:

```typescript
const handleOpenCloneModal = useCallback((profile: ProfileOption) => {
  const openModal = () => {
    setProfileToClone(profile);
    setCloneName(`${strings.editor.copyOf} ${profile.name}`);
    setShowCloneModal(true);
  };

  if (state.isDirty) {
    Alert.alert(
      strings.alerts.unsavedChanges,
      strings.alerts.unsavedChangesMessage,
      [
        { text: strings.common.cancel, style: 'cancel' },
        {
          text: strings.alerts.discard,
          style: 'destructive',
          onPress: () => {
            dispatch({ type: 'MARK_SAVED' });
            openModal();
          },
        },
        {
          text: strings.alerts.saveFirst,
          onPress: async () => {
            await handleSave();
            openModal();
          },
        },
      ]
    );
    return;
  }

  openModal();
}, [state.isDirty, strings, handleSave, dispatch]);
```

- [ ] **Step 3: Add `handleCloneProfile` — reads from storage, creates clone, switches to it**

Add immediately after `handleOpenCloneModal`:

```typescript
const handleCloneProfile = useCallback(async () => {
  if (!cloneName.trim() || !profileToClone) {
    Alert.alert(strings.common.error, strings.alerts.enterProfileName);
    return;
  }

  setShowCloneModal(false);
  const newName = cloneName.trim();
  const newProfileId = `custom_${Date.now()}`;

  try {
    let profileDef: any;
    let styleGroups: any[] = [];

    const saved = await loadProfileById(profileToClone.id);
    if (saved) {
      // Custom profile: clone from saved storage
      profileDef = { ...saved.profileDef, id: newProfileId, name: newName };
      styleGroups = saved.styleGroups;
    } else if (profileToClone.isBuiltIn) {
      // Built-in: reconstruct from template
      const templateId = extractTemplateId(profileToClone.id);
      const template = templateId ? getBuiltInProfileTemplate(templateId) : undefined;
      if (template) {
        profileDef = {
          id: newProfileId,
          name: newName,
          version: '1.0.0',
          language: profileToClone.language,
          keyboardId: profileToClone.keyboardId,
          ...template.config,
          groups: [],
        };
        const createdAt = new Date().toISOString();
        styleGroups = template.styleGroups.map((sg: any, index: number) => ({
          ...sg,
          id: `builtin_${templateId}_${index}`,
          createdAt,
        }));
      } else {
        profileDef = createFactoryDefaultProfile(
          newProfileId,
          newName,
          profileToClone.language,
          profileToClone.keyboardId
        );
      }
    } else {
      showToast('✗ ' + strings.alerts.failedToSaveProfile);
      return;
    }

    // Save cloned profile to storage
    await KeyboardPreferences.setProfile(JSON.stringify(profileDef), `profile_def_${newProfileId}`);
    await KeyboardPreferences.setProfile(JSON.stringify(styleGroups), `${newProfileId}_styleGroups`);

    // Append to saved list
    let savedList: { name: string; key: string; language: string; keyboardId: string }[] = [];
    try {
      const savedListJson = await KeyboardPreferences.getProfile('saved_list');
      if (savedListJson) savedList = JSON.parse(savedListJson);
    } catch { /* ignore */ }
    savedList.push({
      name: newName,
      key: newProfileId,
      language: profileToClone.language,
      keyboardId: profileToClone.keyboardId,
    });
    await KeyboardPreferences.setProfile(JSON.stringify(savedList), 'saved_list');

    // Switch to the cloned profile
    await loadProfilesList();
    await loadProfileInternal({
      id: newProfileId,
      name: newName,
      language: profileToClone.language,
      keyboardId: profileToClone.keyboardId,
      isBuiltIn: false,
    });

    dispatch({ type: 'MARK_SAVED' });
    setShowProfilePicker(false);
    setCloneName('');
    setProfileToClone(null);
    showToast(`✓ ${strings.alerts.profileSaved.replace('!', '')} "${newName}"`);
  } catch {
    showToast('✗ ' + strings.alerts.failedToSaveProfile);
  }
}, [cloneName, profileToClone, strings, showToast, loadProfilesList, loadProfileInternal, dispatch]);
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/i022021/dev/Issie/IssieBoardNG && npx tsc --noEmit 2>&1 | head -20`

Expected: no errors

---

### Task 3: Add clone button to the profile pill

**Files:**
- Modify: `src/screens/EditorScreen.tsx`

- [ ] **Step 1: Add clone icon button between export and delete**

Find the export button block (around line 1711):

```tsx
{!item.isBuiltIn && (
  <TouchableOpacity
    style={styles.profilePillExport}
    onPress={() => { handleExportProfile(item.id, item.name); }}
    ...
```

Add the clone button **after** the export block and **before** the delete block:

```tsx
<TouchableOpacity
  style={styles.profilePillClone}
  onPress={() => { handleOpenCloneModal(item); }}
  activeOpacity={0.7}
  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
>
  <MyIcon info={{ name: 'copy-outline', type: 'Ionicons', color: item.id === currentProfileId ? '#FFFFFF' : '#6B7280', size: 18 }} />
</TouchableOpacity>
```

Note: this button is outside the `{!item.isBuiltIn && (...)}` guard — cloning built-ins is allowed.

- [ ] **Step 2: Add `profilePillClone` style**

Find `profilePillDelete` in the `StyleSheet.create` block (around line 3134):

```typescript
profilePillDelete: {
  padding: 4,
},
```

Add before it:

```typescript
profilePillClone: {
  padding: 4,
},
```

---

### Task 4: Add clone modal JSX

**Files:**
- Modify: `src/screens/EditorScreen.tsx`

- [ ] **Step 1: Add clone modal**

Find the existing Duplicate Profile Modal (around line 1801):

```tsx
{/* Duplicate Profile Modal */}
<Modal
  visible={showDuplicateModal}
  ...
```

Add a new clone modal **before** it:

```tsx
{/* Clone Keyboard Modal */}
<Modal
  visible={showCloneModal}
  transparent
  animationType="fade"
  supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
  onRequestClose={() => { setShowCloneModal(false); setCloneName(''); setProfileToClone(null); }}
>
  <KeyboardAvoidingView
    style={styles.modalOverlay}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  >
    <View style={styles.duplicateModalContainer}>
      <Text allowFontScaling={false} style={styles.duplicateModalTitle}>{strings.editor.cloneKeyboard}</Text>
      <Text allowFontScaling={false} style={styles.duplicateModalSubtitle}>
        {strings.editor.cloneKeyboardSubtitle}: "{profileToClone?.name}"
      </Text>
      <TextInput
        style={styles.duplicateInput}
        placeholder={strings.editor.newProfilePlaceholder}
        value={cloneName}
        onChangeText={setCloneName}
        autoFocus
      />
      <View style={styles.duplicateModalButtons}>
        <TouchableOpacity
          style={styles.duplicateCancelButton}
          onPress={() => { setShowCloneModal(false); setCloneName(''); setProfileToClone(null); }}
        >
          <Text allowFontScaling={false} style={styles.duplicateCancelText}>{strings.common.cancel}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.duplicateConfirmButton}
          onPress={handleCloneProfile}
        >
          <Text allowFontScaling={false} style={styles.duplicateConfirmText}>{strings.common.create}</Text>
        </TouchableOpacity>
      </View>
    </View>
  </KeyboardAvoidingView>
</Modal>
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

Run: `cd /Users/i022021/dev/Issie/IssieBoardNG && npx tsc --noEmit 2>&1 | head -20`

Expected: no errors

---

### Task 5: Manual smoke test

- [ ] Open profile picker in IssieBoard or IssieVoice keyboard settings
- [ ] Tap the clone (copy) icon on any custom keyboard — modal appears titled "Clone Keyboard" with "Copy of [name]" pre-filled
- [ ] Edit the name, tap Create — switches to the new clone
- [ ] Confirm the clone appears in the profile list
- [ ] Tap clone on a built-in keyboard — same flow, clone appears as a custom keyboard
- [ ] With unsaved changes active, tap clone on any pill — dirty-state alert appears (Save / Discard / Cancel)
  - Save → saves current, then opens clone modal
  - Discard → discards, opens clone modal
  - Cancel → nothing happens
