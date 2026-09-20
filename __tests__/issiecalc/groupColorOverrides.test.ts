import { analyzeGroupOverrides, GroupLike, KeysetLike } from '../../src/utils/groupColorOverrides';

const keyset = (...values: string[]): KeysetLike => ({
  id: 'basic',
  rows: [{ keys: values.map(v => ({ value: v })) }],
});

describe('analyzeGroupOverrides', () => {
  test('no groups: nothing is masked', () => {
    const r = analyzeGroupOverrides([], keyset('1', '2', '3'), 'keysBgColor');
    expect(r.maskedCount).toBe(0);
    expect(r.totalCount).toBe(3);
    expect(r.allMasked).toBe(false);
    expect(r.groupNames).toEqual([]);
  });

  test('counts only the keys a group actually covers', () => {
    const groups: GroupLike[] = [
      { name: 'digits', members: ['1', '2'], style: { bgColor: '#333' } },
    ];
    const r = analyzeGroupOverrides(groups, keyset('1', '2', '3', '4'), 'keysBgColor');
    expect(r.maskedCount).toBe(2);
    expect(r.totalCount).toBe(4);
    expect(r.allMasked).toBe(false);
    expect(r.groupNames).toEqual(['digits']);
  });

  test('allMasked when every key is covered', () => {
    const groups: GroupLike[] = [
      { name: 'all', members: ['1', '2'], style: { bgColor: '#333' } },
    ];
    const r = analyzeGroupOverrides(groups, keyset('1', '2'), 'keysBgColor');
    expect(r.allMasked).toBe(true);
    expect(r.maskedCount).toBe(2);
  });

  // The key precedence subtlety: colors resolve independently.
  test('a group setting only bgColor does not mask text color', () => {
    const groups: GroupLike[] = [
      { name: 'bg only', members: ['1', '2'], style: { bgColor: '#333' } },
    ];
    expect(analyzeGroupOverrides(groups, keyset('1', '2'), 'keysBgColor').maskedCount).toBe(2);
    expect(analyzeGroupOverrides(groups, keyset('1', '2'), 'textColor').maskedCount).toBe(0);
  });

  test('empty-string colors fall through and do not mask', () => {
    const groups: GroupLike[] = [
      { name: 'blank', members: ['1'], style: { bgColor: '', color: '  ' } },
    ];
    expect(analyzeGroupOverrides(groups, keyset('1'), 'keysBgColor').maskedCount).toBe(0);
    expect(analyzeGroupOverrides(groups, keyset('1'), 'textColor').maskedCount).toBe(0);
  });

  test('inactive groups are ignored', () => {
    const groups: GroupLike[] = [
      { name: 'off', members: ['1', '2'], style: { bgColor: '#333' }, active: false },
    ];
    expect(analyzeGroupOverrides(groups, keyset('1', '2'), 'keysBgColor').maskedCount).toBe(0);
  });

  test('last group wins for the same key (mirrors buildGroupsMap)', () => {
    const groups: GroupLike[] = [
      { name: 'first', members: ['1'], style: { bgColor: '#111' } },
      { name: 'second', members: ['1'], style: {} }, // wins, sets no bg -> falls through
    ];
    const r = analyzeGroupOverrides(groups, keyset('1'), 'keysBgColor');
    expect(r.maskedCount).toBe(0);
    expect(r.groupNames).toEqual([]);
  });

  test('matches by key type when value does not match', () => {
    const ks: KeysetLike = { rows: [{ keys: [{ type: 'backspace' }] }] };
    const groups: GroupLike[] = [
      { name: 'utility', members: ['backspace'], style: { bgColor: '#636366' } },
    ];
    expect(analyzeGroupOverrides(groups, ks, 'keysBgColor').maskedCount).toBe(1);
  });

  test('supports the config shape (items/template) as well as styleGroups (members/style)', () => {
    const groups: GroupLike[] = [
      { name: 'cfg', items: ['1'], template: { bgColor: '#333' } },
    ];
    expect(analyzeGroupOverrides(groups, keyset('1'), 'keysBgColor').maskedCount).toBe(1);
  });

  test('group names are de-duplicated and kept in order', () => {
    const groups: GroupLike[] = [
      { name: 'a', members: ['1', '2'], style: { bgColor: '#111' } },
      { name: 'b', members: ['3'], style: { bgColor: '#222' } },
    ];
    expect(analyzeGroupOverrides(groups, keyset('1', '2', '3'), 'keysBgColor').groupNames)
      .toEqual(['a', 'b']);
  });

  test('colorless showOnly groups are reordered first, so color groups still win', () => {
    const groups: GroupLike[] = [
      { name: 'colors', members: ['1'], style: { bgColor: '#111' } },
      { name: 'showOnly', members: ['1'], style: { visibilityMode: 'showOnly' } as any },
    ];
    // Raw last-wins would let 'showOnly' (no color) unmask the key; the canvas
    // reorders it first, so 'colors' wins and the key stays masked.
    const r = analyzeGroupOverrides(groups, keyset('1'), 'keysBgColor');
    expect(r.maskedCount).toBe(1);
    expect(r.groupNames).toEqual(['colors']);
  });

  // Drives the per-button badges: the two controls must be able to disagree.
  describe('mixed case: one color masked, the other free', () => {
    test('bgColor-only group masks Keys Background but not Keys Text', () => {
      const groups: GroupLike[] = [
        { name: 'bg only', members: ['1', '2'], style: { bgColor: '#333' } },
      ];
      const bg = analyzeGroupOverrides(groups, keyset('1', '2'), 'keysBgColor');
      const text = analyzeGroupOverrides(groups, keyset('1', '2'), 'textColor');
      expect(bg.maskedCount).toBe(2);
      expect(bg.allMasked).toBe(true);
      expect(text.maskedCount).toBe(0); // -> no badge, no warning line
    });

    test('color-only group masks Keys Text but not Keys Background', () => {
      const groups: GroupLike[] = [
        { name: 'text only', members: ['1', '2'], style: { color: '#FFF' } },
      ];
      expect(analyzeGroupOverrides(groups, keyset('1', '2'), 'keysBgColor').maskedCount).toBe(0);
      expect(analyzeGroupOverrides(groups, keyset('1', '2'), 'textColor').maskedCount).toBe(2);
    });

    test('different counts per property produce different messages', () => {
      const groups: GroupLike[] = [
        { name: 'both', members: ['1'], style: { bgColor: '#333', color: '#FFF' } },
        { name: 'bg extra', members: ['2'], style: { bgColor: '#444' } },
      ];
      const bg = analyzeGroupOverrides(groups, keyset('1', '2', '3'), 'keysBgColor');
      const text = analyzeGroupOverrides(groups, keyset('1', '2', '3'), 'textColor');
      expect(bg.maskedCount).toBe(2);
      expect(text.maskedCount).toBe(1);
      expect(bg.maskedCount).not.toBe(text.maskedCount);
    });
  });

  test('handles missing keyset/groups without throwing', () => {
    expect(analyzeGroupOverrides(undefined, undefined, 'keysBgColor').maskedCount).toBe(0);
    expect(analyzeGroupOverrides([], undefined, 'textColor').totalCount).toBe(0);
  });
});

// Guards the exact scenario that prompted this feature.
describe('real IssieCalc default config', () => {
  const calc = require('../../ios/IssieCalc/default_config.json');
  const basic = (calc.keysets || []).find((k: any) => k.id === 'basic');

  // The 5 "extra" keys in this keyset are hidden layout spacers, so every key the
  // user can actually see is masked. Reporting "20 of 25" was misleading.
  test('every VISIBLE key is masked; hidden spacers are not counted', () => {
    const bg = analyzeGroupOverrides(calc.groups, basic, 'keysBgColor');
    expect(bg.totalCount).toBe(20);
    expect(bg.maskedCount).toBe(20);
    expect(bg.allMasked).toBe(true);
    expect(bg.groupNames).toEqual(['operator', 'utility', 'digit', 'backspace']);
  });

  test('text color is masked for the same keys', () => {
    const text = analyzeGroupOverrides(calc.groups, basic, 'textColor');
    expect(text.maskedCount).toBe(20);
    expect(text.allMasked).toBe(true);
  });

  test('hidden spacers and large-screen variants are excluded from the total', () => {
    const raw: any[] = [];
    (basic.rows || []).forEach((r: any) => (r.keys || []).forEach((k: any) => raw.push(k)));
    // 20 visible + 5 spacers + 5 large-screen operator variants. The operator
    // column is declared twice per row (see keyboards/calc.json): narrow with a
    // spacer beside it on tablets, full width on phones.
    expect(raw.length).toBe(30);
    expect(raw.filter(k => k.hidden).length).toBe(5);
    expect(raw.filter(k => k.showOn?.includes('large-screen') && !k.hidden).length).toBe(5);
  });
});

// IssieBoard / IssieVoice use the same GlobalSettingsPanel, but their groups come
// from styleGroups (often seeded from assets/predefined-rules/<lang>.json) and
// their keysets come from keyboards/<lang>.json.
describe('IssieBoard / IssieVoice (language keyboards + predefined rules)', () => {
  const heKeyboard = require('../../keyboards/he.json');
  const heRules = require('../../assets/predefined-rules/he.json');
  const abc = (heKeyboard.keysets || []).find((k: any) => k.id === 'abc');

  const asStyleGroup = (rule: any) => ({
    name: rule.name ?? rule.id,
    members: rule.members,
    style: rule.style,
  });

  test('a single row rule masks only its keys present on this keyset', () => {
    const topRow = heRules.rules.find((r: any) => r.id === 'top-row');
    const r = analyzeGroupOverrides([asStyleGroup(topRow)], abc, 'keysBgColor');
    expect(r.totalCount).toBe(27);
    // 10 members, but "." and "," live on the symbols keyset, not abc.
    expect(r.maskedCount).toBe(8);
    expect(r.allMasked).toBe(false);
    expect(r.groupNames).toEqual([topRow.name ?? 'top-row']);
  });

  test('row rules combined mask most letters but never report allMasked here', () => {
    const rules = ['top-row', 'mid-row', 'bottom-row']
      .map(id => asStyleGroup(heRules.rules.find((r: any) => r.id === id)));
    const r = analyzeGroupOverrides(rules, abc, 'keysBgColor');
    expect(r.maskedCount).toBeGreaterThan(20);
    expect(r.maskedCount).toBeLessThanOrEqual(r.totalCount);
    expect(r.groupNames.length).toBe(3);
  });

  test('rules that set both colors mask both properties', () => {
    const vowels = asStyleGroup(heRules.rules.find((r: any) => r.id === 'vowels'));
    expect(analyzeGroupOverrides([vowels], abc, 'keysBgColor').maskedCount).toBeGreaterThan(0);
    expect(analyzeGroupOverrides([vowels], abc, 'textColor').maskedCount).toBeGreaterThan(0);
  });

  // The panel reads state.config.keysets, which is the MERGED config: space,
  // backspace and enter are added by buildKeyboardConfig and are absent from the
  // raw keyboards/<lang>.json. Simulate a merged keyset so type matching is covered.
  test('type-based rules match on the merged keyset the panel actually sees', () => {
    const mergedAbc = {
      id: 'abc',
      rows: [
        ...(abc.rows || []),
        { keys: [{ type: 'backspace' }, { value: ' ', type: 'space' }, { type: 'enter' }] },
      ],
    };
    const spaceRule = asStyleGroup(heRules.rules.find((r: any) => r.id === 'space-key'));
    const deleteRule = asStyleGroup(heRules.rules.find((r: any) => r.id === 'delete-key'));

    expect(analyzeGroupOverrides([spaceRule], mergedAbc, 'keysBgColor').maskedCount).toBe(1);
    expect(analyzeGroupOverrides([deleteRule], mergedAbc, 'keysBgColor').maskedCount).toBe(1);
    expect(analyzeGroupOverrides([spaceRule], mergedAbc, 'keysBgColor').totalCount).toBe(30);
  });

  test('no style groups: no warning for a plain language keyboard', () => {
    const r = analyzeGroupOverrides([], abc, 'keysBgColor');
    expect(r.maskedCount).toBe(0);
    expect(r.totalCount).toBe(27);
  });
});
