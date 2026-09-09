/**
 * Merging a nikkud-bearing letter onto the identical bare letter before the caret.
 *
 * The nikkud picker emits a whole cluster (base letter + its marks), e.g. "שִ", and
 * a cluster may carry several marks at once (dagesh + vowel, shin dot + vowel...).
 * Inserting that directly after an existing "ש" would produce "ששִ" — the user
 * almost always meant to vocalize the letter that is already there.
 *
 * Merge only when the preceding letter is bare (carries no marks of its own), so
 * an already-vocalized letter is never silently overwritten.
 */

/** Hebrew combining marks: nikkud/vowels, dagesh, shin/sin dots, meteg, and cantillation. */
const isHebrewCombiningMark = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return code >= 0x0591 && code <= 0x05c7;
};

/** Arabic combining marks (harakat) — the picker works the same way for Arabic. */
const isArabicCombiningMark = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return (
    (code >= 0x064b && code <= 0x065f) || // harakat
    code === 0x0670 || // superscript alef
    (code >= 0x06d6 && code <= 0x06ed) // Quranic annotation marks
  );
};

export const isCombiningMark = (char: string): boolean =>
  isHebrewCombiningMark(char) || isArabicCombiningMark(char);

/**
 * Splits a cluster into its base character and its combining marks.
 * Returns null when `text` is not a single base character followed by marks.
 */
const splitCluster = (text: string): {base: string; marks: string} | null => {
  const chars = [...text];
  if (chars.length < 2) {
    return null;
  }
  const [base, ...rest] = chars;
  if (isCombiningMark(base) || !rest.every(isCombiningMark)) {
    return null;
  }
  return {base, marks: rest.join('')};
};

/**
 * Given the text before the caret and the text about to be inserted, returns how
 * many characters to drop from the end of `before` so the insertion merges onto
 * the existing letter.
 *
 * Merges only onto a *bare* occurrence of the same letter. A letter that already
 * carries marks is left untouched and the new cluster is inserted after it, so
 * existing nikkud is never silently discarded.
 *
 * Returns 0 when no merge applies, in which case the caller inserts normally.
 *
 * @param before   text preceding the caret
 * @param inserted text the keyboard produced (expected: base letter + marks)
 */
export const nikkudMergeBackspaceCount = (
  before: string,
  inserted: string,
): number => {
  const cluster = splitCluster(inserted);
  if (!cluster) {
    return 0;
  }

  const beforeChars = [...before];
  const prev = beforeChars[beforeChars.length - 1];
  if (prev === undefined) {
    return 0;
  }

  // A combining mark here means the preceding letter is already vocalized — leave
  // it alone. Otherwise merge only when it is the same base letter.
  if (isCombiningMark(prev) || prev !== cluster.base) {
    return 0;
  }

  return 1;
};
