# Keyboard Studio UI Implementation Design

> A comprehensive redesign of the IssieBoardNG configuration app, transforming it from a JSON-based editor into an intuitive visual "Workbench" for teachers and caregivers of special needs users.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Design Philosophy](#design-philosophy)
3. [Current State Analysis](#current-state-analysis)
4. [Target Architecture](#target-architecture)
5. [Implementation Phases](#implementation-phases)
6. [Screen Specifications](#screen-specifications)
7. [Component Library](#component-library)
8. [Data Model Extensions](#data-model-extensions)
9. [Technical Considerations](#technical-considerations)

---

## Executive Summary

### The Problem
The current IssieBoardNG app requires teachers to edit JSON configuration files to customize keyboards. This is:
- Error-prone (syntax errors break the keyboard)
- Non-intuitive (requires understanding nested data structures)
- Slow (finding the right key in JSON is tedious)

### The Solution
**Keyboard Studio** - A visual editor where teachers:
1. See a live preview of the keyboard (The Canvas)
2. Tap keys to select and configure them
3. Use a context-aware control panel (The Toolbox)
4. Save and manage profiles with visual thumbnails

---

## Design Philosophy

### Core Metaphor: "The Workbench"

```
┌─────────────────────────────────────────────────────────┐
│                    HEADER BAR                           │
│  [Profile Name]              [Edit] ←→ [Test] Toggle    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                     THE CANVAS                          │
│              (60% of screen height)                     │
│                                                         │
│   ┌─────────────────────────────────────────────────┐   │
│   │  Live Interactive Keyboard Preview              │   │
│   │  • Tap to select keys                           │   │
│   │  • Visual feedback for selection                │   │
│   │  • Ghost view for hidden keys                   │   │
│   └─────────────────────────────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                     THE TOOLBOX                         │
│              (40% of screen height)                     │
│                                                         │
│   Context-aware panel that changes based on selection:  │
│   • Nothing selected → Global Settings                  │
│   • Single key selected → Key Properties                │
│   • Multiple keys selected → Batch Actions              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Design Principles

1. **WYSIWYG** - What You See Is What You Get
2. **Progressive Disclosure** - Show only relevant options
3. **Error Prevention** - Impossible to create invalid configurations
4. **Immediate Feedback** - Every change reflects instantly
5. **Forgiving** - Undo/redo for confident experimentation

---

## Current State Analysis

### What Exists

| Feature | File | Status |
|---------|------|--------|
| Native keyboard preview | `KeyboardPreview.tsx` | ✅ Works |
| Profile loading/saving | `KeyboardPreferences.ts` | ✅ Works |
| Key visibility property | `types.ts` → `KeyConfig.hidden` | ✅ Exists |
| Key color properties | `types.ts` → `KeyConfig.color, bgColor` | ✅ Exists |
| Custom labels | `types.ts` → `KeyConfig.label, caption` | ✅ Exists |
| Background color | `types.ts` → `KeyboardConfig.backgroundColor` | ✅ Exists |
| Key groups | `types.ts` → `GroupConfig` | ✅ Exists |
| JSON editor | `App.tsx` | ⚠️ Replace |
| Profile thumbnails | - | ❌ Missing |
| Key selection | - | ❌ Missing |
| Multi-select | - | ❌ Missing |
| Undo/redo | - | ❌ Missing |

### Code to Preserve

- Native modules: `KeyboardPreviewView` (iOS/Android)
- Shared renderers: `KeyboardRenderer.swift`, `KeyboardRenderer.kt`
- Type definitions: `types.ts`
- Preference storage: `KeyboardPreferences.ts`
- Keyboard definitions: `keyboards/*.json`
- Profile definitions: `profiles/*.json`

---

## Target Architecture

### File Structure

```
src/
├── screens/
│   ├── ProfileGalleryScreen.tsx      # Home screen with profile cards
│   ├── EditorScreen.tsx              # Main workbench
│   └── SettingsScreen.tsx            # App settings (optional)
│
├── components/
│   ├── canvas/
│   │   ├── InteractiveCanvas.tsx     # Wrapper for native preview + touch
│   │   ├── KeyHighlight.tsx          # Selection overlay
│   │   └── GhostKeyOverlay.tsx       # Shows hidden keys in edit mode
│   │
│   ├── toolbox/
│   │   ├── Toolbox.tsx               # Main container with state logic
│   │   ├── GlobalSettingsPanel.tsx   # Background, layout, themes
│   │   ├── KeyEditorPanel.tsx        # Single key properties
│   │   ├── BatchEditorPanel.tsx      # Multi-select actions
│   │   └── tabs/
│   │       ├── LayoutTab.tsx         # Keyboard layout options
│   │       ├── StyleTab.tsx          # Colors, fonts, themes
│   │       └── FeedbackTab.tsx       # Sounds, haptics
│   │
│   ├── gallery/
│   │   ├── ProfileCard.tsx           # Thumbnail card for gallery
│   │   ├── CreateProfileModal.tsx    # New profile wizard
│   │   └── ProfileActionSheet.tsx    # Edit/Delete/Duplicate options
│   │
│   └── shared/
│       ├── ColorPicker.tsx           # Reusable color selector
│       ├── ToggleSwitch.tsx          # Styled toggle
│       ├── SectionHeader.tsx         # Panel section headers
│       └── ActionButton.tsx          # Styled buttons
│
├── hooks/
│   ├── useEditorState.ts             # Main state management
│   ├── useUndoRedo.ts                # History stack
│   ├── useKeySelection.ts            # Selection logic
│   └── useProfileManager.ts          # CRUD operations
│
├── context/
│   └── EditorContext.tsx             # Global editor state
│
├── utils/
│   ├── keyGroups.ts                  # Smart selection helpers
│   ├── configBuilder.ts              # Profile → Config builder
│   └── thumbnailGenerator.ts         # Generate profile previews
│
└── constants/
    ├── themes.ts                     # Preset themes
    └── colors.ts                     # Color palette
```

### State Management

```typescript
interface EditorState {
  // Profile data
  profile: ProfileDefinition;
  config: KeyboardConfig;
  isDirty: boolean;
  
  // UI state
  mode: 'edit' | 'test';
  selectedKeys: string[];  // Array of key identifiers
  activeKeyset: string;
  
  // History
  history: KeyboardConfig[];
  historyIndex: number;
}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
> Goal: Replace JSON editor with basic visual editing

#### Tasks
- [ ] Create `EditorContext` with core state management
- [ ] Build `InteractiveCanvas` component with key tap detection
- [ ] Implement single key selection with visual highlight
- [ ] Create `KeyEditorPanel` with basic properties (visibility, colors)
- [ ] Wire up real-time preview updates
- [ ] Add `useUndoRedo` hook with 10-step history

#### Deliverable
Teachers can tap a key and toggle visibility or change its color.

---

### Phase 2: Global Settings (Week 3)
> Goal: Add keyboard-wide customization

#### Tasks
- [ ] Create `GlobalSettingsPanel` component
- [ ] Implement background color picker
- [ ] Add layout/language selector dropdown
- [ ] Create theme presets (High Contrast, Pastel, Dark Mode)
- [ ] Build `StyleTab` with corner radius slider
- [ ] Implement system row configuration

#### Deliverable
Teachers can change the entire keyboard appearance with presets.

---

### Phase 3: Multi-Select & Batch Actions (Week 4)
> Goal: Enable efficient bulk editing

#### Tasks
- [ ] Implement long-press to enter multi-select mode
- [ ] Create `BatchEditorPanel` with group actions
- [ ] Add "Smart Select" with preset groups (vowels, numbers, punctuation)
- [ ] Extend `groups` in profile schema for custom groups
- [ ] Build visual selection counter and clear button
- [ ] Add batch color application

#### Deliverable
Teachers can color all vowels red in 3 taps.

---

### Phase 4: Profile Gallery (Week 5)
> Goal: Visual profile management

#### Tasks
- [ ] Create `ProfileGalleryScreen` with card grid
- [ ] Implement thumbnail generation from config
- [ ] Build `CreateProfileModal` with template selection
- [ ] Add profile duplication feature
- [ ] Implement profile deletion with confirmation
- [ ] Create `ProfileActionSheet` for long-press menu

#### Deliverable
Home screen shows visual profile cards instead of a list.

---

### Phase 5: Advanced Key Editing (Week 6)
> Goal: Full key customization

#### Tasks
- [ ] Add custom label/caption editing in `KeyEditorPanel`
- [ ] Implement key width adjustment (0.5x - 2x)
- [ ] Add key type override (convert letter to action key)
- [ ] Create key reset to default option
- [ ] Implement "Ghost View" for hidden keys in edit mode
- [ ] Add key search/jump feature

#### Deliverable
Full control over individual key properties.

---

### Phase 6: Polish & Safety (Week 7)
> Goal: Production-ready experience

#### Tasks
- [ ] Implement "Lock Profile" safety feature
- [ ] Add save confirmation dialog with change summary
- [ ] Create onboarding tutorial (first-time users)
- [ ] Add haptic feedback for interactions
- [ ] Implement Export/Share profile feature
- [ ] Add accessibility preview modes (color blindness simulation)
- [ ] Performance optimization and testing

#### Deliverable
App ready for teacher deployment.

---

## Screen Specifications

### Screen 1: Profile Gallery

```
┌─────────────────────────────────────────────────────────┐
│ Keyboard Studio                            [Settings ⚙️] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│   │ 🖼️       │  │ 🖼️       │  │ 🖼️       │             │
│   │ Keyboard │  │ Keyboard │  │ Keyboard │             │
│   │ Preview  │  │ Preview  │  │ Preview  │             │
│   ├──────────┤  ├──────────┤  ├──────────┤             │
│   │ Yuval's  │  │ Math     │  │ Simple   │             │
│   │ Class    │  │ Mode     │  │ ABC      │             │
│   │ 🔒       │  │          │  │          │             │
│   └──────────┘  └──────────┘  └──────────┘             │
│                                                         │
│   ┌──────────┐  ┌──────────┐                           │
│   │ 🖼️       │  │          │                           │
│   │ Keyboard │  │    ➕    │                           │
│   │ Preview  │  │   New    │                           │
│   ├──────────┤  │  Profile │                           │
│   │ Hebrew   │  │          │                           │
│   │ Only     │  │          │                           │
│   └──────────┘  └──────────┘                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Interactions:**
- Tap card → Open editor
- Long-press card → Show action menu (Edit, Duplicate, Delete, Lock)
- Tap ➕ → Create new profile modal

---

### Screen 2: Editor (State A - Nothing Selected)

```
┌─────────────────────────────────────────────────────────┐
│ ← Back    "Yuval's Class"  ✏️     [Edit ●│○ Test]       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌─────────────────────────────────────────────────┐   │
│   │ ⚙️ │  ⌫  │  ⏎  │  ✕  │                          │   │
│   ├─────────────────────────────────────────────────┤   │
│   │ Q │ W │ E │ R │ T │ Y │ U │ I │ O │ P │         │   │
│   │ A │ S │ D │ F │ G │ H │ J │ K │ L │             │   │
│   │ ⇧ │ Z │ X │ C │ V │ B │ N │ M │ ⌫ │             │   │
│   │ 123 │ 🌐 │     SPACE     │ . │ ⏎ │               │   │
│   └─────────────────────────────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  [Layout]    [Style]    [Feedback]                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Background Color                                       │
│  ○ ○ ○ ○ ○ ○ ○ ○  [Custom...]                          │
│                                                         │
│  Language / Layout                                      │
│  [▼ English (QWERTY)               ]                   │
│                                                         │
│  Theme Presets                                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │Standard │ │Hi-Contra│ │ Pastel  │ │  Dark   │       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Screen 2: Editor (State B - Key Selected)

```
┌─────────────────────────────────────────────────────────┐
│ ← Back    "Yuval's Class"  ✏️     [Edit ●│○ Test]       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌─────────────────────────────────────────────────┐   │
│   │ ⚙️ │  ⌫  │  ⏎  │  ✕  │                          │   │
│   ├─────────────────────────────────────────────────┤   │
│   │ Q │ W │ E │ R │ T │ Y │ U │ I │ O │ P │         │   │
│   │ A │ S │ D │ F │ G │ H │ J │ K │ L │             │   │
│   │ ⇧ │ Z │ X │ C │ V │ B │ N │ M │ ⌫ │             │   │
│   │ 123 │ 🌐 │     SPACE     │ . │ ⏎ │               │   │
│   └─────────────────────────────────────────────────┘   │
│               ▲                                         │
│              ╔══╗ ← Blue selection border               │
│              ║ Q║                                       │
│              ╚══╝                                       │
├─────────────────────────────────────────────────────────┤
│  Editing Key: Q                           [× Deselect]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Visibility                                             │
│  [👁️ Visible ●━━━━━━━━━○ Hidden]                        │
│                                                         │
│  Key Color                                              │
│  ○ ○ ○ ○ ○ ○ ○ ○  [Custom...]                          │
│  ↳ Currently: Default (White)                          │
│                                                         │
│  Custom Label                                           │
│  [Q                    ] ← Change display text          │
│                                                         │
│  Key Width                                              │
│  [0.5x ───●────── 2x]   Current: 1x                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Screen 2: Editor (State C - Multi-Select)

```
┌─────────────────────────────────────────────────────────┐
│ ← Back    "Yuval's Class"  ✏️     [Edit ●│○ Test]       │
├─────────────────────────────────────────────────────────┤
│  ╔═══════════════════════════════════════════════════╗  │
│  ║ Multi-Select Mode    5 keys selected  [Clear All] ║  │
│  ╚═══════════════════════════════════════════════════╝  │
│   ┌─────────────────────────────────────────────────┐   │
│   │ ⚙️ │  ⌫  │  ⏎  │  ✕  │                          │   │
│   ├─────────────────────────────────────────────────┤   │
│   │ Q │ W │[E]│ R │ T │ Y │[U]│[I]│[O]│ P │         │   │
│   │[A]│ S │ D │ F │ G │ H │ J │ K │ L │             │   │
│   │ ⇧ │ Z │ X │ C │ V │ B │ N │ M │ ⌫ │             │   │
│   │ 123 │ 🌐 │     SPACE     │ . │ ⏎ │               │   │
│   └─────────────────────────────────────────────────┘   │
│   [E], [A], [I], [O], [U] have selection borders       │
├─────────────────────────────────────────────────────────┤
│  Batch Actions                            [× Done]      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Smart Select                                           │
│  [All Vowels] [All Numbers] [Punctuation] [All Letters]│
│                                                         │
│  Apply to Selected (5 keys)                            │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [👁️ Hide All]  [🎨 Color All...]  [↩️ Reset All] │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Color All Selected                                    │
│  ○ ○ ○ ○ ○ ○ ○ ○  [Custom...]                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Screen 2: Editor (Test Mode)

```
┌─────────────────────────────────────────────────────────┐
│ ← Back    "Yuval's Class"  ✏️     [Edit ○│● Test]       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │                                                  │   │
│  │  Hello world! Testing the keyboard...█          │   │
│  │                                                  │   │
│  └─────────────────────────────────────────────────┘   │
│             ↑ Test text input area                     │
│                                                         │
│   ┌─────────────────────────────────────────────────┐   │
│   │ ⚙️ │  ⌫  │  ⏎  │  ✕  │                          │   │
│   ├─────────────────────────────────────────────────┤   │
│   │ Q │ W │ E │ R │ T │ Y │ U │ I │ O │ P │         │   │
│   │ A │ S │ D │ F │ G │ H │ J │ K │ L │             │   │
│   │ ⇧ │ Z │ X │ C │ V │ B │ N │ M │ ⌫ │             │   │
│   │ 123 │ 🌐 │     SPACE     │ . │ ⏎ │               │   │
│   └─────────────────────────────────────────────────┘   │
│   (Hidden keys are NOT shown in Test Mode)             │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Test Mode Active                                       │
│  Tap keys to type. Hidden keys are invisible.          │
│                                                         │
│  [Clear Text]                     [✓ Feels Good!]      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Component Library

### ColorPicker

```typescript
interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  presets?: string[];
  allowCustom?: boolean;
}

// Presets: Common accessibility-friendly colors
const DEFAULT_PRESETS = [
  '#FFFFFF', '#F44336', '#E91E63', '#9C27B0',
  '#3F51B5', '#2196F3', '#4CAF50', '#FFEB3B',
  '#FF9800', '#795548', '#607D8B', '#000000',
];
```

### ToggleSwitch

```typescript
interface ToggleSwitchProps {
  value: boolean;
  onChange: (value: boolean) => void;
  labelOn?: string;
  labelOff?: string;
  icon?: 'eye' | 'lock' | 'sound';
}
```

### ActionButton

```typescript
interface ActionButtonProps {
  title: string;
  onPress: () => void;
  variant: 'primary' | 'secondary' | 'danger';
  icon?: string;
  disabled?: boolean;
}
```

---

## Data Model Extensions

### Groups-First Architecture

Instead of applying styles directly to individual keys, all styling is done through **Style Groups**. This provides:

1. **Recoverability** - Hidden keys are visible in a "Hidden Keys" group
2. **Reusability** - Save "Red Vowels" group for other profiles
3. **Bulk operations** - Multi-select is just creating/editing a group
4. **Undo semantics** - Delete group = restore all keys to default

### StyleGroup (Core Concept)

```typescript
interface StyleGroup {
  id: string;                      // Unique ID: "group_1706270400000"
  name: string;                    // Display name: "Vowels", "Hidden Keys"
  members: string[];               // Key identifiers: ["abc:0:4", "abc:1:0"]
  style: KeyStyleOverride;         // What to apply
  createdAt: string;               // ISO timestamp
  isBuiltIn?: boolean;             // System groups can't be deleted
}

interface KeyStyleOverride {
  hidden?: boolean;
  bgColor?: string;
  color?: string;
  label?: string;
  fontSize?: number;
  borderColor?: string;
}
```

### How Styling Works

```
Base Key (from keyboard JSON)
    ↓
Apply Group 1 styles (if key is member)
    ↓
Apply Group 2 styles (if key is member, overrides Group 1)
    ↓
Apply Group N styles (last wins)
    ↓
Final Rendered Key
```

### Conflict Resolution

Groups have an implicit priority based on their position in the array:
- Later groups override earlier groups
- Non-conflicting properties merge (e.g., `bgColor` from Group 1 + `hidden` from Group 2)

### Extended KeyConfig

```typescript
interface KeyConfig {
  // Existing
  value?: string;
  sValue?: string;
  label?: string;
  caption?: string;
  type?: string;
  keysetValue?: string;
  width?: number;
  hidden?: boolean;
  color?: string;
  bgColor?: string;
  
  // New additions
  customWidth?: number;      // Override width (0.5 - 2.0)
  fontSize?: number;         // Custom font size
  borderColor?: string;      // Key border color
  isLocked?: boolean;        // Prevent editing
}
```

### Extended ProfileDefinition

```typescript
interface ProfileDefinition {
  // Existing fields...
  
  // New additions
  styleGroups: StyleGroup[];  // Groups-based styling (REPLACES direct key edits)
  isLocked?: boolean;         // Profile lock
  thumbnail?: string;         // Base64 encoded preview
  createdAt?: string;         // ISO timestamp
  updatedAt?: string;         // ISO timestamp
  theme?: ThemePreset;        // Applied theme name
}

type ThemePreset = 'standard' | 'highContrast' | 'pastel' | 'dark' | 'custom';
```

### Key Identifier System

```typescript
// Each key needs a unique identifier for selection
// Format: keysetId:rowIndex:keyIndex
// Example: "abc:1:3" = keyset "abc", row 1, key 3

interface KeyIdentifier {
  keysetId: string;
  rowIndex: number;
  keyIndex: number;
}

const keyIdToString = (id: KeyIdentifier): string => 
  `${id.keysetId}:${id.rowIndex}:${id.keyIndex}`;

const stringToKeyId = (str: string): KeyIdentifier => {
  const [keysetId, rowIndex, keyIndex] = str.split(':');
  return { keysetId, rowIndex: parseInt(rowIndex), keyIndex: parseInt(keyIndex) };
};
```

### UX Flow for Groups

```
1. User taps key(s) → Selection created
2. User makes change (hide, color, etc.)
3. System auto-creates or updates a group:
   - If no group exists for this style → Create "Untitled Group"
   - If "Hidden Keys" group exists and user hides → Add to existing group
4. Groups panel shows all groups:
   - Name, member count, preview
   - Edit (rename, change style)
   - Delete (removes all styling from members)
5. Tap group → Select all members in canvas
```

---

## Technical Considerations

### Native Bridge Updates

The native `KeyboardPreviewView` needs to support:

1. **Key tap events with coordinates**
   ```typescript
   onKeyPress: (event: {
     type: string;
     value: string;
     keysetId: string;
     rowIndex: number;
     keyIndex: number;  // NEW
     x: number;         // NEW
     y: number;         // NEW
   }) => void;
   ```

2. **Selection overlay rendering**
   - Option A: Render selection in native layer (better performance)
   - Option B: Overlay React Native view on top (easier to implement)

3. **Ghost key rendering**
   - When in edit mode, hidden keys show as semi-transparent

### Performance Optimization

1. **Debounce config updates** - Don't re-render preview on every keystroke
2. **Memoize key components** - Prevent unnecessary re-renders
3. **Lazy load modals** - Don't mount until needed
4. **Thumbnail caching** - Store generated thumbnails

### Accessibility

1. **VoiceOver/TalkBack support** for all interactive elements
2. **Minimum touch target size** of 44x44 points
3. **Color contrast** meeting WCAG AA standards
4. **Screen reader announcements** for mode changes

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Time to hide a key | ~60s (find in JSON, edit, save) | <5s |
| Time to color vowels | ~5min (edit each key) | <10s |
| Error rate (invalid config) | ~15% of saves | 0% |
| Teacher satisfaction | Unknown | >4.5/5 |

---

## Next Steps

1. **Review this document** with stakeholders
2. **Prototype Phase 1** with basic key selection
3. **User testing** with 2-3 teachers
4. **Iterate** based on feedback
5. **Continue to Phase 2+**

---

*Document created: January 26, 2026*
*Last updated: January 26, 2026*
*Version: 1.0*