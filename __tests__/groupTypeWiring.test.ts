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
    expect(MODAL).toMatch(/setGroupType\(isPreset \? 'both'/);
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

  test('hidden keys are removed from the keysets, not just styled away', () => {
    // They must not be tappable or reachable via "select all", so filtering the
    // keysets is what guarantees it — a group template would leave them present.
    expect(MODAL).toContain('hiddenByPrecedingValues.has(keyValue)');
    const start = MODAL.indexOf('const filteredConfig');
    const body = MODAL.slice(start, start + 400);
    expect(body).toContain('dropKey');
    expect(body).toMatch(/hiddenByPrecedingValues\.size > 0/);
    // The old style-away group is gone.
    expect(MODAL).not.toContain('_preceding_hidden_');
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
