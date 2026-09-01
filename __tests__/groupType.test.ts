import {
  getGroupType,
  showsColors,
  showsVisibility,
  stylesColors,
  stylesVisibility,
} from '../src/utils/groupType';

const g = (style: any, groupType?: any) => ({ style, groupType });

describe('stylesColors / stylesVisibility', () => {
  test('empty strings do not count as set', () => {
    expect(stylesColors({ bgColor: '', color: '' })).toBe(false);
    expect(stylesColors({ bgColor: '#333' })).toBe(true);
    expect(stylesColors({ color: '#FFF' })).toBe(true);
  });

  test("visibilityMode 'default' is not a visibility setting", () => {
    expect(stylesVisibility({ visibilityMode: 'default' })).toBe(false);
    expect(stylesVisibility({ visibilityMode: 'hide' })).toBe(true);
    expect(stylesVisibility({ visibilityMode: 'showOnly' })).toBe(true);
  });

  test('the legacy hidden boolean counts as visibility', () => {
    expect(stylesVisibility({ hidden: true })).toBe(true);
    expect(stylesVisibility({ hidden: false })).toBe(false);
  });

  test('undefined style is neither', () => {
    expect(stylesColors(undefined)).toBe(false);
    expect(stylesVisibility(undefined)).toBe(false);
  });
});

describe('getGroupType', () => {
  test('a stored groupType always wins over inference', () => {
    // Even when the style says otherwise — the user chose this type.
    expect(getGroupType(g({ bgColor: '#333' }, 'visibility'))).toBe('visibility');
    expect(getGroupType(g({ visibilityMode: 'hide' }, 'colors'))).toBe('colors');
    expect(getGroupType(g({}, 'both'))).toBe('both');
  });

  test('legacy groups are inferred from what they set', () => {
    expect(getGroupType(g({ bgColor: '#333' }))).toBe('colors');
    expect(getGroupType(g({ color: '#FFF' }))).toBe('colors');
    expect(getGroupType(g({ visibilityMode: 'hide' }))).toBe('visibility');
    expect(getGroupType(g({ hidden: true }))).toBe('visibility');
  });

  test('a legacy group setting both stays both, so nothing is lost', () => {
    expect(getGroupType(g({ bgColor: '#333', visibilityMode: 'hide' }))).toBe('both');
    expect(getGroupType(g({ color: '#FFF', hidden: true }))).toBe('both');
  });

  test('a group that sets nothing defaults to colors', () => {
    expect(getGroupType(g({}))).toBe('colors');
    expect(getGroupType(g({ bgColor: '', visibilityMode: 'default' }))).toBe('colors');
  });
});

describe('showsColors / showsVisibility', () => {
  test('each type exposes exactly its own sections', () => {
    expect([showsColors('colors'), showsVisibility('colors')]).toEqual([true, false]);
    expect([showsColors('visibility'), showsVisibility('visibility')]).toEqual([false, true]);
    expect([showsColors('both'), showsVisibility('both')]).toEqual([true, true]);
  });
});
