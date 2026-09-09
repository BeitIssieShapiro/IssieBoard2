import { nikkudMergeBackspaceCount } from '../../apps/issievoice/src/utils/nikkudMerge';

// Hebrew marks used in these tests
const HIRIQ = 'ִ';
const KAMATZ = 'ָ';
const SHEVA = 'ְ';
const DAGESH = 'ּ';
const SHIN_DOT = 'ׁ';
const TSERE = 'ֵ';

/**
 * Applies the merge the same way MainScreen's text_changed handler does, including
 * its end-of-text gate: appending past the end of the text always inserts a new
 * letter rather than vocalizing the one before it.
 */
const applyInsert = (before: string, inserted: string, after = ''): string => {
  const atEndOfText = after.length === 0;
  const merge = atEndOfText ? 0 : nikkudMergeBackspaceCount(before, inserted);
  const newBefore = merge > 0 ? before.slice(0, before.length - merge) : before;
  return newBefore + inserted + after;
};

describe('nikkudMergeBackspaceCount', () => {
  describe('merges onto an identical bare letter', () => {
    it('vocalizes the existing letter instead of duplicating it', () => {
      expect(nikkudMergeBackspaceCount('ש', 'ש' + HIRIQ)).toBe(1);
      expect(applyInsert('ש', 'ש' + HIRIQ, 'ה')).toBe('ש' + HIRIQ + 'ה');
    });

    it('merges mid-word, leaving the rest of the word untouched', () => {
      // caret after "שמ|חה" — inserting מְ merges onto the bare מ
      expect(applyInsert('שמ', 'מ' + SHEVA, 'חה')).toBe('ש' + 'מ' + SHEVA + 'חה');
    });

    it('merges a letter carrying several marks', () => {
      expect(applyInsert('ש', 'ש' + SHIN_DOT + KAMATZ, 'ה')).toBe(
        'ש' + SHIN_DOT + KAMATZ + 'ה',
      );
    });

    it('merges a multi-sign cluster (dagesh + hiriq) onto a bare letter', () => {
      const inserted = 'ש' + DAGESH + HIRIQ;
      expect(nikkudMergeBackspaceCount('ש', inserted)).toBe(1);
      expect(applyInsert('ש', inserted, 'ה')).toBe(inserted + 'ה');
    });

    it('merges onto the last letter of a longer run', () => {
      expect(applyInsert('שלומ', 'מ' + KAMATZ, 'ה')).toBe('שלו' + 'מ' + KAMATZ + 'ה');
    });
  });

  describe('never merges when appending at the end of the text', () => {
    it('inserts a new letter instead of vocalizing the last one', () => {
      // "א" then picking "א" with tsere must give two letters, not one
      expect(applyInsert('א', 'א' + TSERE)).toBe('א' + 'א' + TSERE);
    });

    it('appends after a longer word', () => {
      expect(applyInsert('שלומ', 'מ' + KAMATZ)).toBe('שלומ' + 'מ' + KAMATZ);
    });
  });

  describe('never overwrites marks an existing letter already carries', () => {
    it('leaves an already-vocalized letter alone and inserts separately', () => {
      const before = 'ש' + HIRIQ;
      expect(nikkudMergeBackspaceCount(before, 'ש' + KAMATZ)).toBe(0);
      expect(applyInsert(before, 'ש' + KAMATZ)).toBe('ש' + HIRIQ + 'ש' + KAMATZ);
    });

    it('does not merge onto a letter carrying only a dagesh', () => {
      const before = 'ש' + DAGESH;
      expect(nikkudMergeBackspaceCount(before, 'ש' + HIRIQ)).toBe(0);
      expect(applyInsert(before, 'ש' + HIRIQ)).toBe('ש' + DAGESH + 'ש' + HIRIQ);
    });

    it('does not merge onto a letter carrying several marks', () => {
      const before = 'ש' + DAGESH + SHIN_DOT;
      expect(nikkudMergeBackspaceCount(before, 'ש' + KAMATZ)).toBe(0);
    });

    it('inserting a multi-sign cluster still respects a vocalized letter', () => {
      const before = 'ש' + HIRIQ;
      const inserted = 'ש' + DAGESH + KAMATZ;
      expect(nikkudMergeBackspaceCount(before, inserted)).toBe(0);
      expect(applyInsert(before, inserted)).toBe(before + inserted);
    });

    it('does not merge mid-word onto a vocalized letter', () => {
      // caret after "שמְ|חה" — the מ already has a sheva, so insert separately
      expect(applyInsert('ש' + 'מ' + SHEVA, 'מ' + KAMATZ, 'חה')).toBe(
        'ש' + 'מ' + SHEVA + 'מ' + KAMATZ + 'חה',
      );
    });
  });

  describe('does not merge different letters', () => {
    it('inserts normally after a different letter', () => {
      expect(nikkudMergeBackspaceCount('מ', 'ש' + HIRIQ)).toBe(0);
      expect(applyInsert('מ', 'ש' + HIRIQ)).toBe('מ' + 'ש' + HIRIQ);
    });

    it('does not merge across a space', () => {
      expect(nikkudMergeBackspaceCount('ש ', 'ש' + HIRIQ)).toBe(0);
    });

    it('does not merge when the vocalized letter before the caret differs', () => {
      const before = 'מ' + HIRIQ;
      expect(nikkudMergeBackspaceCount(before, 'ש' + KAMATZ)).toBe(0);
      expect(applyInsert(before, 'ש' + KAMATZ)).toBe('מ' + HIRIQ + 'ש' + KAMATZ);
    });
  });

  describe('leaves ordinary input untouched', () => {
    it('does not merge a bare letter with no marks', () => {
      expect(nikkudMergeBackspaceCount('ש', 'ש')).toBe(0);
      expect(applyInsert('ש', 'ש')).toBe('שש');
    });

    it('does not merge a bare combining mark (top-row nikkud path)', () => {
      // The locked top-row sends the mark alone; KeyboardEngine handles that natively.
      expect(nikkudMergeBackspaceCount('ש', HIRIQ)).toBe(0);
    });

    it('handles an empty preceding context', () => {
      expect(nikkudMergeBackspaceCount('', 'ש' + HIRIQ)).toBe(0);
      expect(applyInsert('', 'ש' + HIRIQ)).toBe('ש' + HIRIQ);
    });

    it('does not merge multi-character insertions such as words', () => {
      expect(nikkudMergeBackspaceCount('ש', 'שלום')).toBe(0);
    });

    it('leaves Latin text alone', () => {
      expect(nikkudMergeBackspaceCount('a', 'a')).toBe(0);
      expect(applyInsert('hello', ' ')).toBe('hello ');
    });
  });
});
