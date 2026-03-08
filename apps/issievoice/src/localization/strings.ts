export interface Strings {
  // App Title
  appTitle: string;

  // Action Bar
  speak: string;
  speaking: string;
  clear: string;
  save: string;
  browse: string;
  switchToHebrew: string;
  switchToEnglish: string;

  // Text Display Area
  textPlaceholder: string;

  // Browse Screen
  savedSentences: string;
  back: string;
  clearAll: string;
  searchSentences: string;
  noSavedSentences: string;
  noSavedSentencesSubtext: string;
  noMatchingSearch: string;
  tryDifferentSearch: string;
  deleteText: string;
  deleteConfirm: string;
  cancel: string;
  delete: string;
  clearAllConfirm: string;

  // Save functionality
  saved: string;
  savedSuccessMessage: string;
  error: string;
  failedToSave: string;
  alreadyExists: string;
  deleted: string;
  allDeleted: string;

  // General
  yes: string;
  no: string;
}

export const en: Strings = {
  // App Title
  appTitle: 'IssieVoice',

  // Action Bar
  speak: '🗣️ Speak',
  speaking: '🔊 Speaking...',
  clear: '🗑️ Clear',
  save: '💾 Save',
  browse: '📚 Browse',
  switchToHebrew: '🔄 עברית',
  switchToEnglish: '🔄 English',

  // Text Display Area
  textPlaceholder: 'Start typing to compose your message...',

  // Browse Screen
  savedSentences: 'Saved Sentences',
  back: '← Back',
  clearAll: 'Clear All',
  searchSentences: 'Search sentences...',
  noSavedSentences: 'No saved sentences yet',
  noSavedSentencesSubtext: 'Save sentences from the main screen to see them here',
  noMatchingSearch: 'No sentences match your search',
  tryDifferentSearch: 'Try a different search term',
  deleteText: 'Delete Sentence',
  deleteConfirm: 'Are you sure you want to delete',
  cancel: 'Cancel',
  delete: 'Delete',
  clearAllConfirm: 'Delete all saved texts?',

  // Save functionality
  saved: 'Saved!',
  savedSuccessMessage: 'Your text has been saved successfully.',
  error: 'Error',
  failedToSave: 'Failed to save text. Please try again.',
  alreadyExists: 'This sentence is already saved.',
  deleted: 'Deleted successfully',
  allDeleted: 'All texts deleted',

  // General
  yes: 'Yes',
  no: 'No',
};

export const he: Strings = {
  // App Title
  appTitle: 'IssieVoice',

  // Action Bar
  speak: '🗣️ הקראה',
  speaking: '🔊 מקריא...',
  clear: '🗑️ נקה',
  save: '💾 שמור',
  browse: '📚 טקסט שמור',
  switchToHebrew: '🔄 עברית',
  switchToEnglish: '🔄 English',

  // Text Display Area
  textPlaceholder: 'התחל להקליד כדי לכתוב את ההודעה שלך...',

  // Browse Screen
  savedSentences: 'משפטים שמורים',
  back: '→ חזור',
  clearAll: 'נקה הכל',
  searchSentences: 'חפש משפטים...',
  noSavedSentences: 'אין עדיין משפטים שמורים',
  noSavedSentencesSubtext: 'שמור משפטים מהמסך הראשי כדי לראות אותם כאן',
  noMatchingSearch: 'אין משפטים התואמים לחיפוש',
  tryDifferentSearch: 'נסה מונח חיפוש אחר',
  deleteText: 'מחק משפט',
  deleteConfirm: 'האם אתה בטוח שברצונך למחוק',
  cancel: 'ביטול',
  delete: 'מחק',
  clearAllConfirm: 'למחוק את כל הטקסטים השמורים?',

  // Save functionality
  saved: 'נשמר!',
  savedSuccessMessage: 'הטקסט שלך נשמר בהצלחה.',
  error: 'שגיאה',
  failedToSave: 'שמירת הטקסט נכשלה. אנא נסה שוב.',
  alreadyExists: 'המשפט הזה כבר שמור.',
  deleted: 'נמחק בהצלחה',
  allDeleted: 'כל הטקסטים נמחקו',

  // General
  yes: 'כן',
  no: 'לא',
};
