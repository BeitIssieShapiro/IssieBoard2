/**
 * Language display names + search matching for the voice picker.
 *
 * Kept free of React/native imports so it can be unit-tested directly.
 */

const NAMES: Record<string, Record<string, string>> = {
  en: {
    af: 'Afrikaans', ar: 'Arabic', bg: 'Bulgarian', ca: 'Catalan',
    cs: 'Czech', da: 'Danish', de: 'German', el: 'Greek',
    en: 'English', es: 'Spanish', fi: 'Finnish', fr: 'French',
    he: 'Hebrew', hi: 'Hindi', hr: 'Croatian', hu: 'Hungarian',
    id: 'Indonesian', it: 'Italian', ja: 'Japanese', ko: 'Korean',
    ms: 'Malay', nl: 'Dutch', no: 'Norwegian', pl: 'Polish',
    pt: 'Portuguese', ro: 'Romanian', ru: 'Russian', sk: 'Slovak',
    sv: 'Swedish', th: 'Thai', tr: 'Turkish', uk: 'Ukrainian',
    vi: 'Vietnamese', zh: 'Chinese',
  },
  he: {
    af: 'אפריקאנס', ar: 'ערבית', bg: 'בולגרית', ca: 'קטלאנית',
    cs: 'צ׳כית', da: 'דנית', de: 'גרמנית', el: 'יוונית',
    en: 'אנגלית', es: 'ספרדית', fi: 'פינית', fr: 'צרפתית',
    he: 'עברית', hi: 'הינדי', hr: 'קרואטית', hu: 'הונגרית',
    id: 'אינדונזית', it: 'איטלקית', ja: 'יפנית', ko: 'קוראנית',
    ms: 'מלאית', nl: 'הולנדית', no: 'נורווגית', pl: 'פולנית',
    pt: 'פורטוגזית', ro: 'רומנית', ru: 'רוסית', sk: 'סלובקית',
    sv: 'שוודית', th: 'תאית', tr: 'טורקית', uk: 'אוקראינית',
    vi: 'וייטנאמית', zh: 'סינית',
  },
  ar: {
    af: 'الأفريكانية', ar: 'العربية', bg: 'البلغارية', ca: 'الكتالانية',
    cs: 'التشيكية', da: 'الدنماركية', de: 'الألمانية', el: 'اليونانية',
    en: 'الإنجليزية', es: 'الإسبانية', fi: 'الفنلندية', fr: 'الفرنسية',
    he: 'العبرية', hi: 'الهندية', hr: 'الكرواتية', hu: 'الهنغارية',
    id: 'الإندونيسية', it: 'الإيطالية', ja: 'اليابانية', ko: 'الكورية',
    ms: 'الملايوية', nl: 'الهولندية', no: 'النرويجية', pl: 'البولندية',
    pt: 'البرتغالية', ro: 'الرومانية', ru: 'الروسية', sk: 'السلوفاكية',
    sv: 'السويدية', th: 'التايلاندية', tr: 'التركية', uk: 'الأوكرانية',
    vi: 'الفيتنامية', zh: 'الصينية',
  },
};

export function getLanguageDisplayName(langCode: string, uiLang: string): string {
  // langCode can be full locale (he-IL) or just prefix (he)
  const prefix = langCode.split('-')[0].toLowerCase();
  const region = langCode.split('-')[1]?.toUpperCase();

  const uiPrefix = uiLang.split('-')[0].toLowerCase();
  const map = NAMES[uiPrefix] ?? NAMES.en;
  const langName = map[prefix] ?? prefix;
  return region ? `${langName} (${region})` : langName;
}

/**
 * Does a language code match a free-text search query?
 * Matches against the language name in every supported UI language (so a Hebrew
 * UI user can still type "hebrew" or "he"), plus the raw code/locale itself.
 * An empty/whitespace query matches everything.
 */
export function languageMatchesQuery(langCode: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const candidates = [
    langCode.toLowerCase(),
    langCode.split('-')[0].toLowerCase(),
    getLanguageDisplayName(langCode, 'en'),
    getLanguageDisplayName(langCode, 'he'),
    getLanguageDisplayName(langCode, 'ar'),
  ];

  return candidates.some(c => c.toLowerCase().includes(q));
}
