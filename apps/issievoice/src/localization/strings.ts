export type Language = 'en' | 'he' | 'ar';

export interface Strings {
  common: {
    cancel: string;
    delete: string;
    save: string;
    yes: string;
    no: string;
    error: string;
    back: string;
  };
  app: {
    title: string;
  };
  actionBar: {
    speak: string;
    speaking: string;
    clear: string;
    save: string;
    browse: string;
    switchToHebrew: string;
    switchToEnglish: string;
  };
  textDisplay: {
    placeholder: string;
  };
  browse: {
    savedSentences: string;
    clearAll: string;
    search: string;
    noSaved: string;
    noSavedSubtext: string;
    noMatchingSearch: string;
    tryDifferentSearch: string;
    deleteText: string;
    deleteConfirm: string;
    clearAllConfirm: string;
    deleted: string;
    allDeleted: string;
  };
  favorites: {
    moveLeft: string;
    moveRight: string;
    selectFavorite: string;
    customize: string;
    caption: string;
    captionPlaceholder: string;
    captionHint: string;
    icon: string;
    iconHint: string;
    addedToFavorites: string;
    favoriteUpdated: string;
  };
  settings: {
    title: string;
    speechSpeed: string;
    slow: string;
    normal: string;
    fast: string;
    voicePitch: string;
    low: string;
    high: string;
    aboutTitle: string;
    aboutDescription: string;
    version: string;
  };
  settingsModal: {
    title: string;
    languageMode: string;
    englishOnly: string;
    englishOnlyDesc: string;
    hebrewOnly: string;
    hebrewOnlyDesc: string;
    autoDetect: string;
    autoDetectDesc: string;
    hebrewVoice: string;
    englishVoice: string;
    current: string;
    none: string;
  };
  notifications: {
    saved: string;
    savedSuccess: string;
    failedToSave: string;
    alreadyExists: string;
  };
}

const en: Strings = {
  common: {
    cancel: 'Cancel',
    delete: 'Delete',
    save: 'Save',
    yes: 'Yes',
    no: 'No',
    error: 'Error',
    back: '← Back',
  },
  app: {
    title: 'IssieVoice',
  },
  actionBar: {
    speak: ' Speak',
    speaking: '🔊 Speaking...',
    clear: '🗑️ Clear',
    save: '💾 Save',
    browse: '📚 Browse',
    switchToHebrew: '🔄 עברית',
    switchToEnglish: '🔄 English',
  },
  textDisplay: {
    placeholder: 'Type a message to speak...',
  },
  browse: {
    savedSentences: 'Saved Sentences',
    clearAll: 'Clear All',
    search: 'Search sentences...',
    noSaved: 'No saved sentences yet',
    noSavedSubtext: 'Save sentences from the main screen to see them here',
    noMatchingSearch: 'No sentences match your search',
    tryDifferentSearch: 'Try a different search term',
    deleteText: 'Delete Sentence',
    deleteConfirm: 'Are you sure you want to delete',
    clearAllConfirm: 'Delete all saved texts?',
    deleted: 'Deleted successfully',
    allDeleted: 'All texts deleted',
  },
  favorites: {
    moveLeft: '← Move Left',
    moveRight: 'Move Right →',
    selectFavorite: 'Select Favorite',
    customize: 'Customize Favorite',
    caption: 'Caption',
    captionPlaceholder: 'Enter caption...',
    captionHint: 'Short label shown under the button',
    icon: 'Icon',
    iconHint: 'Emoji or symbol for this favorite',
    addedToFavorites: 'Added to favorites',
    favoriteUpdated: 'Favorite updated',
  },
  settings: {
    title: 'Settings',
    speechSpeed: 'Speech Speed',
    slow: 'Slow',
    normal: 'Normal',
    fast: 'Fast',
    voicePitch: 'Voice Pitch',
    low: 'Low',
    high: 'High',
    aboutTitle: 'About IssieVoice',
    aboutDescription: 'IssieVoice is an assistive communication app for people who need help speaking.',
    version: 'Version',
  },
  settingsModal: {
    title: 'Settings',
    languageMode: 'Language Mode',
    englishOnly: 'English Only',
    englishOnlyDesc: 'Only use English voices',
    hebrewOnly: 'Hebrew Only',
    hebrewOnlyDesc: 'Only use Hebrew voices',
    autoDetect: 'Auto-Detect',
    autoDetectDesc: 'Automatically detect language',
    hebrewVoice: 'Hebrew Voice',
    englishVoice: 'English Voice',
    current: 'Current:',
    none: 'None',
  },
  notifications: {
    saved: 'Saved!',
    savedSuccess: 'Your text has been saved successfully.',
    failedToSave: 'Failed to save text. Please try again.',
    alreadyExists: 'This sentence is already saved.',
  },
};

const he: Strings = {
  common: {
    cancel: 'ביטול',
    delete: 'מחק',
    save: 'שמור',
    yes: 'כן',
    no: 'לא',
    error: 'שגיאה',
    back: '→ חזור',
  },
  app: {
    title: 'IssieVoice',
  },
  actionBar: {
    speak: 'הקראה',
    speaking: '🔊 מקריא...',
    clear: '🗑️ נקה',
    save: '💾 שמור',
    browse: '📚 טקסט שמור',
    switchToHebrew: '🔄 עברית',
    switchToEnglish: '🔄 English',
  },
  textDisplay: {
    placeholder: 'הקלד הודעה להקראה...',
  },
  browse: {
    savedSentences: 'משפטים שמורים',
    clearAll: 'נקה הכל',
    search: 'חפש משפטים...',
    noSaved: 'אין עדיין משפטים שמורים',
    noSavedSubtext: 'שמור משפטים מהמסך הראשי כדי לראות אותם כאן',
    noMatchingSearch: 'אין משפטים התואמים לחיפוש',
    tryDifferentSearch: 'נסה מונח חיפוש אחר',
    deleteText: 'מחק משפט',
    deleteConfirm: 'האם אתה בטוח שברצונך למחוק',
    clearAllConfirm: 'למחוק את כל הטקסטים השמורים?',
    deleted: 'נמחק בהצלחה',
    allDeleted: 'כל הטקסטים נמחקו',
  },
  favorites: {
    moveLeft: 'הזז שמאלה ←',
    moveRight: '→ הזז ימינה',
    selectFavorite: 'בחר מועדף',
    customize: 'התאם מועדף',
    caption: 'כיתוב',
    captionPlaceholder: 'הזן כיתוב...',
    captionHint: 'תווית קצרה מתחת לכפתור',
    icon: 'סמל',
    iconHint: 'אימוג\'י או סמל למועדף זה',
    addedToFavorites: 'נוסף למועדפים',
    favoriteUpdated: 'המועדף עודכן',
  },
  settings: {
    title: 'הגדרות',
    speechSpeed: 'מהירות דיבור',
    slow: 'איטי',
    normal: 'רגיל',
    fast: 'מהיר',
    voicePitch: 'גובה קול',
    low: 'נמוך',
    high: 'גבוה',
    aboutTitle: 'אודות IssieVoice',
    aboutDescription: 'IssieVoice הוא אפליקציית תקשורת תומכת עבור אנשים שזקוקים לעזרה בדיבור.',
    version: 'גרסה',
  },
  settingsModal: {
    title: 'הגדרות',
    languageMode: 'מצב שפה',
    englishOnly: 'אנגלית בלבד',
    englishOnlyDesc: 'שימוש בקולות אנגלית בלבד',
    hebrewOnly: 'עברית בלבד',
    hebrewOnlyDesc: 'שימוש בקולות עברית בלבד',
    autoDetect: 'זיהוי אוטומטי',
    autoDetectDesc: 'זיהוי שפה אוטומטי',
    hebrewVoice: 'קול עברית',
    englishVoice: 'קול אנגלית',
    current: 'נוכחי:',
    none: 'ללא',
  },
  notifications: {
    saved: 'נשמר!',
    savedSuccess: 'הטקסט שלך נשמר בהצלחה.',
    failedToSave: 'שמירת הטקסט נכשלה. אנא נסה שוב.',
    alreadyExists: 'המשפט הזה כבר שמור.',
  },
};

const ar: Strings = {
  common: {
    cancel: 'إلغاء',
    delete: 'حذف',
    save: 'حفظ',
    yes: 'نعم',
    no: 'لا',
    error: 'خطأ',
    back: '← رجوع',
  },
  app: {
    title: 'IssieVoice',
  },
  actionBar: {
    speak: 'تحدث',
    speaking: '🔊 يتحدث...',
    clear: '🗑️ مسح',
    save: '💾 حفظ',
    browse: '📚 تصفح',
    switchToHebrew: '🔄 עברית',
    switchToEnglish: '🔄 English',
  },
  textDisplay: {
    placeholder: 'اكتب رسالة للنطق...',
  },
  browse: {
    savedSentences: 'الجمل المحفوظة',
    clearAll: 'مسح الكل',
    search: 'البحث في الجمل...',
    noSaved: 'لا توجد جمل محفوظة بعد',
    noSavedSubtext: 'احفظ الجمل من الشاشة الرئيسية لرؤيتها هنا',
    noMatchingSearch: 'لا توجد جمل تطابق بحثك',
    tryDifferentSearch: 'جرب مصطلح بحث مختلف',
    deleteText: 'حذف الجملة',
    deleteConfirm: 'هل أنت متأكد أنك تريد حذف',
    clearAllConfirm: 'حذف جميع النصوص المحفوظة؟',
    deleted: 'تم الحذف بنجاح',
    allDeleted: 'تم حذف جميع النصوص',
  },
  favorites: {
    moveLeft: '← تحريك لليسار',
    moveRight: 'تحريك لليمين →',
    selectFavorite: 'اختر المفضلة',
    customize: 'تخصيص المفضلة',
    caption: 'التسمية',
    captionPlaceholder: 'أدخل التسمية...',
    captionHint: 'تسمية قصيرة تظهر تحت الزر',
    icon: 'الأيقونة',
    iconHint: 'رمز تعبيري أو رمز لهذه المفضلة',
    addedToFavorites: 'تمت الإضافة إلى المفضلة',
    favoriteUpdated: 'تم تحديث المفضلة',
  },
  settings: {
    title: 'الإعدادات',
    speechSpeed: 'سرعة الكلام',
    slow: 'بطيء',
    normal: 'عادي',
    fast: 'سريع',
    voicePitch: 'درجة الصوت',
    low: 'منخفض',
    high: 'مرتفع',
    aboutTitle: 'حول IssieVoice',
    aboutDescription: 'IssieVoice هو تطبيق تواصل مساعد للأشخاص الذين يحتاجون إلى مساعدة في التحدث.',
    version: 'الإصدار',
  },
  settingsModal: {
    title: 'الإعدادات',
    languageMode: 'وضع اللغة',
    englishOnly: 'الإنجليزية فقط',
    englishOnlyDesc: 'استخدام الأصوات الإنجليزية فقط',
    hebrewOnly: 'العبرية فقط',
    hebrewOnlyDesc: 'استخدام الأصوات العبرية فقط',
    autoDetect: 'كشف تلقائي',
    autoDetectDesc: 'كشف اللغة تلقائياً',
    hebrewVoice: 'الصوت العبري',
    englishVoice: 'الصوت الإنجليزي',
    current: 'الحالي:',
    none: 'لا شيء',
  },
  notifications: {
    saved: 'تم الحفظ!',
    savedSuccess: 'تم حفظ النص بنجاح.',
    failedToSave: 'فشل حفظ النص. يرجى المحاولة مرة أخرى.',
    alreadyExists: 'هذه الجملة محفوظة بالفعل.',
  },
};

export const translations: Record<Language, Strings> = {
  en,
  he,
  ar,
};

export const getStrings = (language: Language): Strings => {
  return translations[language] || translations.en;
};
