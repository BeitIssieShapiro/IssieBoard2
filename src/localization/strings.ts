export type Language = 'en' | 'he' | 'ar';

export interface Strings {
  // Header
  keyboardConfiguration: string;

  // Profile Section
  builtInProfiles: string;
  savedProfiles: string;
  longPressForOptions: string;
  current: string;
  custom: string;

  // Keyboards Section
  keyboardsInProfile: string;
  customConfiguration: string;

  // Editor Section
  editing: string;
  generatedConfiguration: string;
  editingHelpText: string;
  editorHelpText: string;

  // Buttons
  cancel: string;
  save: string;
  saveChanges: string;
  saveCustomConfiguration: string;
  edit: string;
  delete: string;

  // Save Modal
  saveProfile: string;
  enterProfileNamePrompt: string;
  profileNamePlaceholder: string;

  // Help Section
  aboutProfiles: string;
  helpText: string;

  // Alerts
  success: string;
  error: string;
  syntaxError: string;
  deleteProfile: string;
  profileChangedTo: string;
  closeAndReopenKeyboard: string;
  failedToSwitchProfile: string;
  checkJsonFormatting: string;
  enterProfileName: string;
  savingConfiguration: string;
  profileSaved: string;
  failedToSaveProfile: string;
  loadingProfile: string;
  profileLoaded: string;
  profileNotFound: string;
  failedToLoadProfile: string;
  whatWouldYouLikeToDo: string;
  failedToLoadForEditing: string;
  savedChangesTo: string;
  profileUpdated: string;
  editCancelled: string;
  confirmDelete: string;
  deleted: string;
  failedToDeleteProfile: string;

  // Status Messages
  initializing: string;
  loadedProfile: string;
  nativeModuleNotConnected: string;
  errorLoadingConfiguration: string;
  switchingProfile: string;
  switchedTo: string;
  errorSwitchingProfile: string;
}

const en: Strings = {
  // Header
  keyboardConfiguration: 'Keyboard Configuration',

  // Profile Section
  builtInProfiles: 'Built-in Profiles:',
  savedProfiles: 'Saved Profiles:',
  longPressForOptions: 'Long-press for options',
  current: 'Current:',
  custom: 'Custom',

  // Keyboards Section
  keyboardsInProfile: 'Keyboards in This Profile:',
  customConfiguration: 'Custom configuration',

  // Editor Section
  editing: 'Editing:',
  generatedConfiguration: 'Generated Configuration (Advanced):',
  editingHelpText: 'Make your changes below and tap "Save Changes" when done.',
  editorHelpText: 'You can manually edit the JSON below if needed. Changes will override the profile.',

  // Buttons
  cancel: 'Cancel',
  save: 'Save',
  saveChanges: 'Save Changes',
  saveCustomConfiguration: 'Save Custom Configuration',
  edit: 'Edit',
  delete: 'Delete',

  // Save Modal
  saveProfile: 'Save Profile',
  enterProfileNamePrompt: 'Enter a name for this profile',
  profileNamePlaceholder: 'Profile name',

  // Help Section
  aboutProfiles: 'About Profiles',
  helpText: '• Profiles combine keyboards with styling\n• Switch profiles to change keyboards and themes\n• Edit keyboards/ folder to add new languages\n• Edit profiles/ folder to create custom themes\n• See keyboards/README.md for details',

  // Alerts
  success: 'Success',
  error: 'Error',
  syntaxError: 'Syntax Error',
  deleteProfile: 'Delete Profile',
  profileChangedTo: 'Profile changed to',
  closeAndReopenKeyboard: 'Close and reopen the keyboard to see changes.',
  failedToSwitchProfile: 'Failed to switch profile',
  checkJsonFormatting: 'Please check your JSON formatting.',
  enterProfileName: 'Please enter a profile name',
  savingConfiguration: 'Saving custom configuration...',
  profileSaved: 'Profile saved!',
  failedToSaveProfile: 'Failed to save profile',
  loadingProfile: 'Loading saved profile...',
  profileLoaded: 'Profile loaded.',
  profileNotFound: 'Profile not found',
  failedToLoadProfile: 'Failed to load profile',
  whatWouldYouLikeToDo: 'What would you like to do?',
  failedToLoadForEditing: 'Failed to load profile for editing',
  savedChangesTo: 'Saved changes to:',
  profileUpdated: 'Profile updated.',
  editCancelled: 'Edit cancelled',
  confirmDelete: 'Are you sure you want to delete',
  deleted: 'Deleted:',
  failedToDeleteProfile: 'Failed to delete profile',

  // Status Messages
  initializing: 'Initializing...',
  loadedProfile: 'Loaded profile:',
  nativeModuleNotConnected: 'Native module not connected',
  errorLoadingConfiguration: 'Error loading configuration',
  switchingProfile: 'Switching profile...',
  switchedTo: 'Switched to:',
  errorSwitchingProfile: 'Error switching profile',
};

const he: Strings = {
  // Header
  keyboardConfiguration: 'הגדרות מקלדת',

  // Profile Section
  builtInProfiles: 'פרופילים מובנים:',
  savedProfiles: 'פרופילים שמורים:',
  longPressForOptions: 'לחיצה ארוכה לאפשרויות',
  current: 'נוכחי:',
  custom: 'מותאם אישית',

  // Keyboards Section
  keyboardsInProfile: 'מקלדות בפרופיל זה:',
  customConfiguration: 'הגדרה מותאמת אישית',

  // Editor Section
  editing: 'עריכה:',
  generatedConfiguration: 'הגדרות מתקדמות:',
  editingHelpText: 'ערוך את השינויים למטה ולחץ "שמור שינויים" בסיום.',
  editorHelpText: 'ניתן לערוך את ה-JSON למטה במידת הצורך. השינויים ידרסו את הפרופיל.',

  // Buttons
  cancel: 'ביטול',
  save: 'שמור',
  saveChanges: 'שמור שינויים',
  saveCustomConfiguration: 'שמור הגדרה מותאמת',
  edit: 'עריכה',
  delete: 'מחיקה',

  // Save Modal
  saveProfile: 'שמירת פרופיל',
  enterProfileNamePrompt: 'הזן שם לפרופיל זה',
  profileNamePlaceholder: 'שם הפרופיל',

  // Help Section
  aboutProfiles: 'אודות פרופילים',
  helpText: '• פרופילים משלבים מקלדות עם עיצוב\n• החלף פרופילים לשינוי מקלדות וערכות נושא\n• ערוך תיקיית keyboards/ להוספת שפות\n• ערוך תיקיית profiles/ ליצירת ערכות נושא\n• ראה keyboards/README.md לפרטים',

  // Alerts
  success: 'הצלחה',
  error: 'שגיאה',
  syntaxError: 'שגיאת תחביר',
  deleteProfile: 'מחיקת פרופיל',
  profileChangedTo: 'הפרופיל שונה ל',
  closeAndReopenKeyboard: 'סגור ופתח מחדש את המקלדת לצפייה בשינויים.',
  failedToSwitchProfile: 'החלפת פרופיל נכשלה',
  checkJsonFormatting: 'אנא בדוק את פורמט ה-JSON.',
  enterProfileName: 'אנא הזן שם לפרופיל',
  savingConfiguration: 'שומר הגדרה מותאמת...',
  profileSaved: 'הפרופיל נשמר!',
  failedToSaveProfile: 'שמירת הפרופיל נכשלה',
  loadingProfile: 'טוען פרופיל שמור...',
  profileLoaded: 'הפרופיל נטען.',
  profileNotFound: 'הפרופיל לא נמצא',
  failedToLoadProfile: 'טעינת הפרופיל נכשלה',
  whatWouldYouLikeToDo: 'מה תרצה לעשות?',
  failedToLoadForEditing: 'טעינת הפרופיל לעריכה נכשלה',
  savedChangesTo: 'השינויים נשמרו ב:',
  profileUpdated: 'הפרופיל עודכן.',
  editCancelled: 'העריכה בוטלה',
  confirmDelete: 'האם אתה בטוח שברצונך למחוק את',
  deleted: 'נמחק:',
  failedToDeleteProfile: 'מחיקת הפרופיל נכשלה',

  // Status Messages
  initializing: 'מאתחל...',
  loadedProfile: 'פרופיל נטען:',
  nativeModuleNotConnected: 'המודול לא מחובר',
  errorLoadingConfiguration: 'שגיאה בטעינת ההגדרות',
  switchingProfile: 'מחליף פרופיל...',
  switchedTo: 'הוחלף ל:',
  errorSwitchingProfile: 'שגיאה בהחלפת פרופיל',
};

const ar: Strings = {
  // Header
  keyboardConfiguration: 'إعدادات لوحة المفاتيح',

  // Profile Section
  builtInProfiles: 'ملفات تعريف مدمجة:',
  savedProfiles: 'ملفات تعريف محفوظة:',
  longPressForOptions: 'اضغط مطولاً للخيارات',
  current: 'الحالي:',
  custom: 'مخصص',

  // Keyboards Section
  keyboardsInProfile: 'لوحات المفاتيح في هذا الملف:',
  customConfiguration: 'إعداد مخصص',

  // Editor Section
  editing: 'تحرير:',
  generatedConfiguration: 'الإعدادات المتقدمة:',
  editingHelpText: 'قم بإجراء التغييرات أدناه واضغط "حفظ التغييرات" عند الانتهاء.',
  editorHelpText: 'يمكنك تحرير JSON أدناه إذا لزم الأمر. ستتجاوز التغييرات الملف الشخصي.',

  // Buttons
  cancel: 'إلغاء',
  save: 'حفظ',
  saveChanges: 'حفظ التغييرات',
  saveCustomConfiguration: 'حفظ الإعداد المخصص',
  edit: 'تحرير',
  delete: 'حذف',

  // Save Modal
  saveProfile: 'حفظ الملف الشخصي',
  enterProfileNamePrompt: 'أدخل اسمًا لهذا الملف الشخصي',
  profileNamePlaceholder: 'اسم الملف الشخصي',

  // Help Section
  aboutProfiles: 'حول الملفات الشخصية',
  helpText: '• الملفات الشخصية تجمع بين لوحات المفاتيح والتصميم\n• بدّل الملفات لتغيير لوحات المفاتيح والسمات\n• حرر مجلد keyboards/ لإضافة لغات\n• حرر مجلد profiles/ لإنشاء سمات مخصصة\n• انظر keyboards/README.md للتفاصيل',

  // Alerts
  success: 'نجاح',
  error: 'خطأ',
  syntaxError: 'خطأ في الصياغة',
  deleteProfile: 'حذف الملف الشخصي',
  profileChangedTo: 'تم تغيير الملف الشخصي إلى',
  closeAndReopenKeyboard: 'أغلق وأعد فتح لوحة المفاتيح لرؤية التغييرات.',
  failedToSwitchProfile: 'فشل تبديل الملف الشخصي',
  checkJsonFormatting: 'يرجى التحقق من تنسيق JSON.',
  enterProfileName: 'يرجى إدخال اسم للملف الشخصي',
  savingConfiguration: 'جارٍ حفظ الإعداد المخصص...',
  profileSaved: 'تم حفظ الملف الشخصي!',
  failedToSaveProfile: 'فشل حفظ الملف الشخصي',
  loadingProfile: 'جارٍ تحميل الملف الشخصي...',
  profileLoaded: 'تم تحميل الملف الشخصي.',
  profileNotFound: 'الملف الشخصي غير موجود',
  failedToLoadProfile: 'فشل تحميل الملف الشخصي',
  whatWouldYouLikeToDo: 'ماذا تريد أن تفعل؟',
  failedToLoadForEditing: 'فشل تحميل الملف الشخصي للتحرير',
  savedChangesTo: 'تم حفظ التغييرات في:',
  profileUpdated: 'تم تحديث الملف الشخصي.',
  editCancelled: 'تم إلغاء التحرير',
  confirmDelete: 'هل أنت متأكد أنك تريد حذف',
  deleted: 'تم الحذف:',
  failedToDeleteProfile: 'فشل حذف الملف الشخصي',

  // Status Messages
  initializing: 'جارٍ التهيئة...',
  loadedProfile: 'تم تحميل الملف الشخصي:',
  nativeModuleNotConnected: 'الوحدة الأصلية غير متصلة',
  errorLoadingConfiguration: 'خطأ في تحميل الإعدادات',
  switchingProfile: 'جارٍ تبديل الملف الشخصي...',
  switchedTo: 'تم التبديل إلى:',
  errorSwitchingProfile: 'خطأ في تبديل الملف الشخصي',
};

export const translations: Record<Language, Strings> = {
  en,
  he,
  ar,
};

export const getStrings = (language: Language): Strings => {
  return translations[language] || translations.en;
};
