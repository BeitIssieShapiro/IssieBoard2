import fs from 'fs';
import path from 'path';

/**
 * Groups carry a persisted `groupType`. The editor must offer only the settings
 * that belong to that type, persist the choice, and not write settings from the
 * other type into the style.
 */

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

const MODAL = read('src/components/toolbox/AddStyleRuleModal.tsx');
const TOOLBOX = read('src/components/toolbox/Toolbox.tsx');
const CONTEXT = read('src/context/EditorContext.tsx');
const PANEL = read('src/components/toolbox/StyleRulesPanel.tsx');
const TYPES = read('types.ts');
const CANVAS = read('src/components/canvas/InteractiveCanvas.tsx');

describe('the group type is part of the persisted model', () => {
  test('StyleGroup declares an optional groupType', () => {
    expect(TYPES).toMatch(/export type StyleGroupType\s*=/);
    // Optional, so groups saved before types existed still parse.
    expect(TYPES).toMatch(/groupType\?:\s*StyleGroupType/);
  });

  test('the reducer stores groupType on newly created groups', () => {
    const start = CONTEXT.indexOf("case 'CREATE_GROUP_FROM_VALUES'");
    const body = CONTEXT.slice(start, CONTEXT.indexOf('case ', start + 10));
    expect(body).toContain('groupType');
  });

  test('createGroupFromValues accepts and forwards groupType', () => {
    const sig = CONTEXT.match(/const createGroupFromValues = useCallback\([^)]*\)/s);
    expect(sig).toBeTruthy();
    expect(sig![0]).toContain('groupType');
  });
});

describe('the modal offers only the sections for the type', () => {
  test('visibility and colour sections are gated', () => {
    expect(MODAL).toContain('showsVisibility(groupType)');
    expect(MODAL).toContain('showsColors(groupType)');
  });

  test('the type is derived from the group when editing', () => {
    expect(MODAL).toContain('setGroupType(getGroupType(editingGroup))');
  });

  test('saving writes only the settings belonging to the type', () => {
    const start = MODAL.indexOf('const handleOk');
    const body = MODAL.slice(start, MODAL.indexOf('createGroupFromValues', start) + 200);
    // Colours guarded by showsColors, visibility by showsVisibility.
    expect(body).toMatch(/if \(showsColors\(groupType\)\)/);
    expect(body).toMatch(/if \(showsVisibility\(groupType\) && visibilityMode !== 'default'\)/);
    // And the chosen type is persisted on both paths.
    expect(body).toMatch(/groupType,/);
  });

  test('presets keep both sections so they lose nothing', () => {
    // The type is computed into newGroupType first (IssieCalc needs it to pin
    // the visibility mode), then stored — so assert on the derivation.
    expect(MODAL).toMatch(/newGroupType = isPreset \? 'both'/);
    expect(MODAL).toContain('setGroupType(newGroupType)');
  });
});

describe('IssieCalc visibility groups are always "show only"', () => {
  test('the mode selector is hidden there', () => {
    // One behaviour only, so the three-way selector would be a dead choice.
    expect(MODAL).toContain("const isCalcVisibilityOnly = appContext === 'issiecalc'");
    expect(MODAL).toContain('{!isCalcVisibilityOnly && (');
  });

  test('the mode is pinned on both the new and editing paths', () => {
    const start = MODAL.indexOf('if (visible) {');
    const body = MODAL.slice(start, MODAL.indexOf('}, [visible]', start));
    // Editing an existing group must not read a stale 'hide'/'default' back.
    expect(body).toMatch(/isCalcVisibilityOnly && showsVisibility\(getGroupType\(editingGroup\)\)[\s\S]*?setVisibilityMode\('showOnly'\)/);
    // New groups start pinned too, since there is no selector to change it.
    expect(body).toMatch(/isCalcVisibilityOnly && showsVisibility\(newGroupType\)[\s\S]*?'showOnly'/);
  });

  test('the instruction tells the user to pick the keys to show', () => {
    // The generic "tap keys to select them" does not say what selecting does
    // when the only outcome is visibility.
    expect(MODAL).toContain('strings.styleRuleModal.tapKeysToShowOnly');
    const STRINGS = read('src/localization/strings.ts');
    // Declared in the interface and translated in all three languages.
    expect(STRINGS.split('tapKeysToShowOnly').length - 1).toBe(5);
  });
});

describe('the toolbox offers the two typed create buttons', () => {
  test('both buttons exist and pass their type', () => {
    expect(TOOLBOX).toContain("handleCreatePressed('colors')");
    expect(TOOLBOX).toContain("handleCreatePressed('visibility')");
    expect(TOOLBOX).toContain('customizeColors');
    expect(TOOLBOX).toContain('customizeVisibility');
  });

  test('both buttons carry a "+" so they read as adding a group', () => {
    for (const label of ['customizeColors', 'customizeVisibility']) {
      const idx = TOOLBOX.indexOf(`strings.toolbox.${label}`);
      expect(idx).toBeGreaterThan(-1);
      // The add icon precedes the type icon on the same button.
      const button = TOOLBOX.slice(Math.max(0, idx - 400), idx);
      expect(button).toMatch(/name: 'add'/);
    }
  });

  test('the chosen type reaches the modal', () => {
    expect(TOOLBOX).toContain('initialGroupType={newGroupType}');
  });
});

describe('the group list shows the type', () => {
  test('each row renders an icon for its type', () => {
    expect(PANEL).toContain('getGroupType(group)');
    expect(PANEL).toContain('typeIcons');
  });

  test('the icons match the buttons that create the groups', () => {
    // Palette for colours, eye-off for visibility — same names the Toolbox uses,
    // so the list and the create buttons read as the same vocabulary.
    const start = PANEL.indexOf('const type = getGroupType(group)');
    const body = PANEL.slice(start, start + 700);
    expect(body).toMatch(/showsColors\(type\)[\s\S]*?'color-palette'/);
    expect(body).toMatch(/showsVisibility\(type\)[\s\S]*?'eye-off'/);

    expect(TOOLBOX).toContain("'color-palette'");
    expect(TOOLBOX).toContain("'eye-off'");
  });

  test('the icons are rendered in the row that is actually displayed', () => {
    // getStylePreview is dead code in this panel — the row markup is what
    // renders, so the icons must live there.
    const rowStart = PANEL.indexOf('state.styleGroups.map');
    expect(rowStart).toBeGreaterThan(-1);
    expect(PANEL.indexOf('typeIcons')).toBeGreaterThan(rowStart);
  });
});

describe('the modal preview reflects preceding groups', () => {
  test('preceding visibility rules are resolved', () => {
    // Preceding groups used to be stripped of all visibility effect, so a new
    // group showed the whole keyboard and appeared to ignore an earlier
    // "show only" rule.
    expect(MODAL).toContain('resolveHiddenKeys(precedingGroupsList, allSelectableKeyValues)');
  });

  test('hidden keys keep their slot in the row', () => {
    // Removing them from the rows re-flows the row and the remaining keys lose
    // their positions. The native renderer keeps hidden keys in the layout
    // ("hidden keys still take up space and preserve the layout"), so the
    // preview hides them with opacity 0 instead of deleting them.
    expect(MODAL).toContain("name: '_hidden_by_preceding_'");
    const start = MODAL.indexOf("name: '_hidden_by_preceding_'");
    expect(MODAL.slice(start, start + 300)).toMatch(/opacity: 0\b/);
    // The row filter must no longer consider preceding-hidden keys — only the
    // IssieVoice close/globe keys, which genuinely should not exist at all.
    const filterStart = MODAL.indexOf('const filteredConfig');
    const filterBody = MODAL.slice(filterStart, filterStart + 400);
    expect(filterBody).not.toContain('dropKey');
    expect(filterBody).not.toContain('hiddenByPrecedingValues');
  });

  test('hidden keys are still unselectable', () => {
    // They are present in the preview now, so absence no longer protects them:
    // tapping and "select all" must both reject them explicitly.
    const tapStart = MODAL.indexOf('const handleKeyPress');
    const tapBody = MODAL.slice(tapStart, MODAL.indexOf('const handleCancel'));
    expect(tapBody).toMatch(/hiddenByPrecedingValues\.has\(/);
    const viewStart = MODAL.indexOf('const selectableKeysInView');
    const viewBody = MODAL.slice(viewStart, viewStart + 900);
    expect(viewBody).toMatch(/!hiddenByPrecedingValues\.has\(keyValue\)/);
  });

  test('hiddenByPrecedingValues is declared before handleKeyPress uses it', () => {
    // It is a const in the component body: referencing it in handleKeyPress's
    // dependency array before its declaration throws at render (TDZ).
    expect(MODAL.indexOf('const hiddenByPrecedingValues'))
      .toBeLessThan(MODAL.indexOf('const handleKeyPress'));
  });

  test('a selected key that becomes hidden is dropped from the selection', () => {
    // Otherwise it stays in the group with no way to untap it.
    expect(MODAL).toMatch(/hiddenByPrecedingValues\.has\(k\)/);
  });

  test('the essential-key list is defined once', () => {
    // It was duplicated between the preceding-group and showOnly paths.
    const occurrences = MODAL.split('const essentialTypes').length - 1;
    expect(occurrences).toBe(1);
  });

  test("the modal's essential values match the merger's", () => {
    // transformConfigForPreview is what the real app renders. The modal used to
    // also treat '.' and ',' as essential, so a "show only" group hid them in
    // the app but left them visible in the preview.
    expect(MODAL).toContain("const essentialValues = new Set([' ']);");
    expect(MODAL).not.toMatch(/essentialValues = new Set\(\[' ', ',', '\.'\]\)/);
  });
});

describe('the modal preview follows the device orientation', () => {
  test('the calc keyset gets the _landscape suffix, as the main preview does', () => {
    // The modal used to render the bare keyset id, so editing a group in
    // landscape always showed the portrait layout.
    expect(CANVAS).toMatch(/`\$\{calcPreviewKeyset\}_landscape`/);
    expect(MODAL).toMatch(/`\$\{calcKeyset\}_landscape`/);
    // The rendered config uses the orientation-aware id, not the raw toggle value.
    const start = MODAL.indexOf('const previewConfigJson');
    const body = MODAL.slice(start, start + 300);
    expect(body).toContain('defaultKeyset: calcKeysetId');
  });

  test('key selection targets the keyset actually on screen', () => {
    // visibleKeysetId drives "select all" and tap resolution. If it kept the
    // portrait id while landscape rendered, select-all would act on the wrong
    // keyset — the two layouts have different keys per row.
    const start = MODAL.indexOf('const visibleKeysetId');
    const body = MODAL.slice(start, start + 300);
    expect(body).toContain('calcKeysetId');
  });

  test('orientation is read before the keyset id is derived', () => {
    // calcKeysetId is a const derived from isPortrait; using it earlier throws (TDZ).
    expect(MODAL.indexOf('useWindowDimensions()'))
      .toBeLessThan(MODAL.indexOf('const calcKeysetId'));
    expect(MODAL.indexOf('const calcKeysetId'))
      .toBeLessThan(MODAL.indexOf('const previewConfigJson'));
  });

  test('the landscape keysets the suffix points at exist', () => {
    // `${calcKeyset}_landscape` must resolve for both toggle values, or the
    // preview renders nothing in landscape.
    const calc = JSON.parse(read('keyboards/calc.json'));
    const ids = new Set(calc.keysets.map((k: any) => k.id));
    expect(ids.has('basic_landscape')).toBe(true);
    expect(ids.has('scientific_landscape')).toBe(true);
  });

  test('the scientific height bump applies only in portrait', () => {
    // Portrait scientific is 11 rows and needs the extra height; the landscape
    // variant is 5 rows, so the bump would oversize it.
    const start = MODAL.indexOf('const modalPreviewHeight');
    const body = MODAL.slice(start, start + 200);
    expect(body).toContain('isPortrait');
  });
});

describe('select all', () => {
  test('it targets the visible keyset only', () => {
    expect(MODAL).toContain('selectableKeysInView');
    expect(MODAL).toContain('visibleKeysetId');
    // Calc swaps keysets via calcKeyset; others use the config default.
    expect(MODAL).toMatch(/appContext === 'issiecalc'\) return calcKeyset/);
  });

  test('it skips keyset keys, which are long-press only', () => {
    const start = MODAL.indexOf('const selectableKeysInView');
    const body = MODAL.slice(start, MODAL.indexOf('}, [previewConfig.keysets', start));
    expect(body).toMatch(/if \(type === 'keyset'\) continue/);
  });

  test('it uses the same value convention as tapping a key', () => {
    const start = MODAL.indexOf('const selectableKeysInView');
    const body = MODAL.slice(start, MODAL.indexOf('}, [previewConfig.keysets', start));
    // Special keys are stored by type, everything else by value — same as
    // handleKeyPress, which now shares the one SPECIAL_KEY_TYPES constant.
    expect(body).toContain('SPECIAL_KEY_TYPES.includes(type)');
    expect(body).toContain('key.value || key.caption || key.label || key.type');
    expect(MODAL.split('const SPECIAL_KEY_TYPES').length - 1).toBe(1);
  });

  test('deselecting leaves keys from other keysets alone', () => {
    const start = MODAL.indexOf('const handleSelectAllToggle');
    const body = MODAL.slice(start, MODAL.indexOf('}, [isPreset', start));
    expect(body).toMatch(/prev\.filter\(k => !selectableKeysInView\.includes\(k\)\)/);
  });

  test('presets cannot select all, matching their locked keys', () => {
    const start = MODAL.indexOf('const handleSelectAllToggle');
    const body = MODAL.slice(start, MODAL.indexOf('}, [isPreset', start));
    expect(body).toMatch(/if \(isPreset\)/);
  });
});
