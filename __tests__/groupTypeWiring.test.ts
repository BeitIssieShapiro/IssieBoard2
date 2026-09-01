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

  test('the chosen type reaches the modal', () => {
    expect(TOOLBOX).toContain('initialGroupType={newGroupType}');
  });
});

describe('the group list shows the type', () => {
  test('the panel renders a type badge', () => {
    expect(PANEL).toContain('getGroupType(group)');
    expect(PANEL).toContain('indicatorType');
  });

  test('the "no styles" fallback accounts for the always-present badge', () => {
    // The badge is pushed unconditionally, so a length check against 0 would
    // never fire and the hint would be lost.
    expect(PANEL).not.toMatch(/indicators\.length === 0/);
    expect(PANEL).toMatch(/indicators\.length === 1/);
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
    // Special keys are stored by type, everything else by value — same as handleKeyPress.
    expect(body).toContain('specialKeyTypes.includes(type)');
    expect(body).toContain('key.value || key.caption || key.label || key.type');
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
