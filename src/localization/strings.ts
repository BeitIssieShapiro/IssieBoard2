export type Language = 'en' | 'he' | 'ar';

export interface Strings {
  common: {
    cancel: string;
    save: string;
    saveChanges: string;
    delete: string;
    rename: string;
    edit: string;
    create: string;
    apply: string;
    reset: string;
    error: string;
    success: string;
    loading: string;
    default: string;
    done: string;
    back: string;
    on: string;
    off: string;
    visible: string;
    hidden: string;
    showOnly: string;
    none: string;
    bgLabel: string;
    textLabel: string;
  };
  editor: {
    keyboardConfiguration: string;
    myKeyboards: string;
    builtIn: string;
    settings: string;
    backToNewsettings: string;
    classicView: string;
    newProfile: string;
    duplicateProfile: string;
    newProfilePlaceholder: string;
    select: string;
    saveAs: string;
    saveCustomConfiguration: string;
    editing: string;
    languages: {
      hebrew: string;
      english: string;
      arabic: string;
    };
    keyboardVariants: {
      standard: string;
      orderedHe: string;
      qwerty: string;
      orderedEn: string;
      orderedAr: string;
    };
  };
  alerts: {
    resetToFactory: string;
    unsavedChanges: string;
    unsavedChangesMessage: string;
    discard: string;
    saveFirst: string;
    discardChanges: string;
    discardChangesMessage: string;
    clearAllSettings: string;
    clearAll: string;
    cannotDelete: string;
    cannotDeleteDefault: string;
    cannotDeleteActive: string;
    deleteProfile: string;
    deleteConfirm: string;
    renameProfile: string;
    renamePrompt: string;
    enterProfileName: string;
    failedToLoadProfile: string;
    failedToLoadForEditing: string;
    profileChangedTo: string;
    closeAndReopenKeyboard: string;
    failedToSwitchProfile: string;
    syntaxError: string;
    checkJsonFormatting: string;
    savingConfiguration: string;
    profileSaved: string;
    failedToSaveProfile: string;
    profileUpdated: string;
    savedChangesTo: string;
    editCancelled: string;
    deleted: string;
    failedToDeleteProfile: string;
    whatWouldYouLikeToDo: string;
    loadingProfile: string;
    profileLoaded: string;
    profileNotFound: string;
  };
  classic: {
    mainSettings: string;
    mainColors: string;
    actionKeys: string;
    colorDivision: string;
    specialKeys: string;
    visibleKeys: string;
    nikkud: string;
    nikkudSettings: string;
    backgroundColor: string;
    keysColor: string;
    textColor: string;
    spaceKeyColor: string;
    deleteKeyColor: string;
    enterKeyColor: string;
    otherKeysColor: string;
    highlightedCharacters: string;
    highlightKeysColor: string;
    highlightTextColor: string;
    keyOrder: string;
    language: string;
    byRows: string;
    bySections: string;
    topRow: string;
    middleRow: string;
    bottomRow: string;
    rightThird: string;
    middleThird: string;
    leftThird: string;
    typeCharacters: string;
    showAll: string;
    tapKeysToShow: string;
  };
  toolbox: {
    generalAppearance: string;
    keysGroups: string;
    nikkud: string;
    presets: string;
    new: string;
    createNew: string;
    presetsModalTitle: string;
    keysLabel: string;
  };
  globalSettings: {
    colors: string;
    background: string;
    keysBackground: string;
    keysText: string;
    font: string;
    keyGap: string;
    keyGapRegular: string;
    keyGapMedium: string;
    keyGapLarge: string;
    keyboardLayout: string;
    features: string;
    wordSuggestions: string;
    wordSuggestionsDesc: string;
    autoCorrect: string;
    autoCorrectDesc: string;
    settingsButton: string;
    settingsButtonDesc: string;
    speakButtonInKeyboard: string;
    speakButtonInKeyboardDesc: string;
    symbolsInSuggestions: string;
    symbolsInSuggestionsDesc: string;
    advancedSettings: string;
    keyboardHeight: string;
    fontSize: string;
    fontWeight: string;
    heightCompact: string;
    heightNormal: string;
    heightTall: string;
    heightXTall: string;
    weightLight: string;
    weightRegular: string;
    weightMedium: string;
    weightSemibold: string;
    weightBold: string;
    weightHeavy: string;
    sizeXS: string;
    sizeS: string;
    sizeM: string;
    sizeL: string;
    sizeXL: string;
  };
  keyEditor: {
    groupName: string;
    groupNamePlaceholder: string;
    doneEditing: string;
    deselectAll: string;
    inGroups: string;
    visibility: string;
    visibilityHint: string;
    keyBgColor: string;
    textColor: string;
    customLabel: string;
    customLabelHint: string;
    customLabelPlaceholder: string;
    keyInfo: string;
    position: string;
    output: string;
    shiftOutput: string;
    type: string;
    width: string;
  };
  styleRules: {
    deleteGroup: string;
    deleteGroupConfirm: string;
    noStyles: string;
    noGroupsYet: string;
    noGroupsHint: string;
    styleGroups: string;
    editing: string;
    inactive: string;
    tips: string;
  };
  diacritics: {
    enableNikkud: string;
    basic: string;
    full: string;
    custom: string;
    diacriticsSection: string;
    modifiers: string;
    noDiacritics: string;
  };
  styleRuleModal: {
    newKeysGroup: string;
    groupNamePrefix: string;
    nameLabel: string;
    namePlaceholder: string;
    presetKeysLocked: string;
    tapKeysToSelect: string;
    visibility: string;
    visibilityDefault: string;
    visibilityHide: string;
    visibilityShowOnly: string;
    showOnlyHint: string;
    hiddenHint: string;
    bgColor: string;
    textColor: string;
    keysLocked: string;
  };
  colorPicker: {
    modalTitle: string;
    selectedColor: string;
  };
  canvas: {
    preview: string;
  };
  addProfileModal: {
    title: string;
    nameLabel: string;
    placeholder: string;
    enterName: string;
    nameInUse: string;
    selectLanguages: string;
    atLeastOneLanguage: string;
  };
  saveAsModal: {
    title: string;
    message: string;
    nameLabel: string;
    placeholder: string;
    saveAs: string;
    enterName: string;
    nameInUse: string;
  };
  profiles: {
    saveProfile: string;
    enterProfileNamePrompt: string;
    profileNamePlaceholder: string;
    builtInProfiles: string;
    savedProfiles: string;
    longPressForOptions: string;
    current: string;
    custom: string;
    keyboardsInProfile: string;
    customConfiguration: string;
    keyboardPreview: string;
    previewHelpText: string;
    generatedConfiguration: string;
    editingHelpText: string;
    editorHelpText: string;
    aboutProfiles: string;
    helpText: string;
    builtInNames: {
      default: string;
      classic: string;
      highContrast: string;
    };
  };
  status: {
    initializing: string;
    loadedProfile: string;
    nativeModuleNotConnected: string;
    errorLoadingConfiguration: string;
    switchingProfile: string;
    switchedTo: string;
    errorSwitchingProfile: string;
  };
  toggleSwitch: {
    visible: string;
    hidden: string;
    a11yVisible: string;
    a11yHidden: string;
  };
  setup: {
    keyboardNotAdded: string;
    tapForInstructions: string;
    setupInstructionsTitle: string;
    setupStep1: string;
    setupStep2: string;
    setupStep3: string;
    setupStep4: string;
    setupStep5: string;
    setupStep6: string;
    androidSetupStep1: string;
    androidSetupStep2: string;
    androidSetupStep3: string;
    androidSetupStep4: string;
    fullAccessTitle: string;
    fullAccessStep1: string;
    fullAccessStep2: string;
    fullAccessStep3: string;
  };
  importExport: {
    exportProfile: string;
    backupAll: string;
    importSuccessTitle: string;
    importedProfiles: string;
    skippedProfiles: string;
    skippedNote: string;
    importFailed: string;
    invalidFile: string;
    ok: string;
    noProfilesToExport: string;
  };
}

const en: Strings = {
  common: {
    cancel: 'Cancel',
    save: 'Save',
    saveChanges: 'Save Changes',
    delete: 'Delete',
    rename: 'Rename',
    edit: 'Edit',
    create: 'Create',
    apply: 'Apply',
    reset: 'Reset',
    error: 'Error',
    success: 'Success',
    loading: 'Loading...',
    default: 'Default',
    done: 'Done',
    back: 'Back',
    on: 'On',
    off: 'Off',
    visible: 'Visible',
    hidden: 'Hidden',
    showOnly: 'Show Only',
    none: 'None',
    bgLabel: 'Background',
    textLabel: 'Text',
  },
  editor: {
    keyboardConfiguration: 'Keyboard Configuration',
    myKeyboards: 'My Keyboards',
    builtIn: 'Built-in',
    settings: 'Settings',
    backToNewsettings: 'New View',
    classicView: 'Classic View',
    newProfile: 'New Keyboard',
    duplicateProfile: 'Duplicate Keyboard',
    newProfilePlaceholder: 'Enter keyboard name',
    select: 'Select',
    saveAs: 'Save As',
    saveCustomConfiguration: 'Save Custom Configuration',
    editing: 'Editing:',
    languages: {
      hebrew: 'Hebrew',
      english: 'English',
      arabic: 'Arabic',
    },
    keyboardVariants: {
      standard: 'Standard',
      orderedHe: 'Ordered (Alef-Bet)',
      qwerty: 'QWERTY',
      orderedEn: 'Ordered (A-Z)',
      orderedAr: 'Ordered (Alif-Ba)',
    },
  },
  alerts: {
    resetToFactory: 'Reset to factory defaults?',
    unsavedChanges: 'Unsaved Changes',
    unsavedChangesMessage: 'You have unsaved changes. What would you like to do?',
    discard: 'Discard',
    saveFirst: 'Save First',
    discardChanges: 'Discard Changes',
    discardChangesMessage: 'Are you sure you want to discard all changes?',
    clearAllSettings: 'Clear all settings and reset to defaults?',
    clearAll: 'Clear All',
    cannotDelete: 'Cannot Delete',
    cannotDeleteDefault: 'Built-in keyboards cannot be deleted.',
    cannotDeleteActive: 'This is the active keyboard. Deleting it will switch to the default keyboard.',
    deleteProfile: 'Delete an IssieBoard',
    deleteConfirm: 'Are you sure you want to delete "{{name}}"?',
    renameProfile: 'Rename Keyboard',
    renamePrompt: 'Enter a new name for "{{name}}"',
    enterProfileName: 'Please enter a keyboard name',
    failedToLoadProfile: 'Failed to load keyboard',
    failedToLoadForEditing: 'Failed to load keyboard for editing',
    profileChangedTo: 'Keyboard changed to',
    closeAndReopenKeyboard: 'Close and reopen the keyboard to see changes.',
    failedToSwitchProfile: 'Failed to switch keyboard',
    syntaxError: 'Syntax Error',
    checkJsonFormatting: 'Please check your JSON formatting.',
    savingConfiguration: 'Saving custom configuration...',
    profileSaved: 'Keyboard saved!',
    failedToSaveProfile: 'Failed to save keyboard',
    profileUpdated: 'Keyboard updated.',
    savedChangesTo: 'Saved changes to:',
    editCancelled: 'Edit cancelled',
    deleted: 'Deleted:',
    failedToDeleteProfile: 'Failed to delete keyboard',
    whatWouldYouLikeToDo: 'What would you like to do?',
    loadingProfile: 'Loading saved keyboard...',
    profileLoaded: 'Keyboard loaded.',
    profileNotFound: 'Keyboard not found',
  },
  classic: {
    mainSettings: 'Main Settings',
    mainColors: 'Main Colors',
    actionKeys: 'Action Keys',
    colorDivision: 'Color Division',
    specialKeys: 'Special Keys',
    visibleKeys: 'Visible Keys',
    nikkud: 'Nikkud',
    nikkudSettings: 'Nikkud Settings',
    backgroundColor: 'Background Color',
    keysColor: 'Keys Color',
    textColor: 'Text Color',
    spaceKeyColor: 'Space Key Color',
    deleteKeyColor: 'Delete Key Color',
    enterKeyColor: 'Enter Key Color',
    otherKeysColor: 'Other Keys Color',
    highlightedCharacters: 'Highlighted Characters',
    highlightKeysColor: 'Highlight Keys Color',
    highlightTextColor: 'Highlight Text Color',
    keyOrder: 'Key Order',
    language: 'Language',
    byRows: 'By Rows',
    bySections: 'By Sections',
    topRow: 'Top Row',
    middleRow: 'Middle Row',
    bottomRow: 'Bottom Row',
    rightThird: 'Right Third',
    middleThird: 'Middle Third',
    leftThird: 'Left Third',
    typeCharacters: 'Type characters to highlight',
    showAll: 'Show All',
    tapKeysToShow: 'Tap keys you wish to be visible',
  },
  toolbox: {
    generalAppearance: 'General Appearance',
    keysGroups: 'Keys Groups',
    nikkud: 'Nikkud',
    presets: 'Presets',
    new: 'New',
    createNew: 'Create New',
    presetsModalTitle: 'Choose a Preset',
    keysLabel: 'Keys',
  },
  globalSettings: {
    colors: 'Colors',
    background: 'Background',
    keysBackground: 'Keys Background',
    keysText: 'Keys Text',
    font: 'Font',
    keyGap: 'Key Gap',
    keyGapRegular: 'Regular',
    keyGapMedium: 'Medium',
    keyGapLarge: 'Large',
    keyboardLayout: 'Keyboard Layout',
    features: 'Features',
    wordSuggestions: 'Word Suggestions',
    wordSuggestionsDesc: 'Show word suggestions above the keyboard',
    autoCorrect: 'Auto-Correct',
    autoCorrectDesc: 'Automatically correct common typos',
    settingsButton: 'Settings Button',
    settingsButtonDesc: 'Show settings gear icon on keyboard',
    speakButtonInKeyboard: 'Speak Button in Keyboard',
    speakButtonInKeyboardDesc: 'Show the speak button as part of the keyboard instead of above it',
    symbolsInSuggestions: 'Symbols in Suggestions',
    symbolsInSuggestionsDesc: 'Show picture symbols above word suggestions',
    advancedSettings: 'Advanced Settings',
    keyboardHeight: 'Keyboard Height',
    fontSize: 'Font Size',
    fontWeight: 'Font Weight',
    heightCompact: 'Compact',
    heightNormal: 'Normal',
    heightTall: 'Tall',
    heightXTall: 'Extra Tall',
    weightLight: 'Light',
    weightRegular: 'Regular',
    weightMedium: 'Medium',
    weightSemibold: 'Semibold',
    weightBold: 'Bold',
    weightHeavy: 'Heavy',
    sizeXS: 'XS',
    sizeS: 'S',
    sizeM: 'M',
    sizeL: 'L',
    sizeXL: 'XL',
  },
  keyEditor: {
    groupName: 'Group Name',
    groupNamePlaceholder: 'Enter group name',
    doneEditing: 'Done Editing',
    deselectAll: 'Deselect All',
    inGroups: 'In Groups',
    visibility: 'Visibility',
    visibilityHint: 'Control whether selected keys are visible on the keyboard',
    keyBgColor: 'Key Background Color',
    textColor: 'Text Color',
    customLabel: 'Custom Label',
    customLabelHint: 'Override the displayed label on the key',
    customLabelPlaceholder: 'Enter custom label',
    keyInfo: 'Key Info',
    position: 'Position',
    output: 'Output',
    shiftOutput: 'Shift Output',
    type: 'Type',
    width: 'Width',
  },
  styleRules: {
    deleteGroup: 'Delete Group',
    deleteGroupConfirm: 'Delete "{{name}}"? This will remove styling from {{count}} key(s).',
    noStyles: 'No custom styles applied.',
    noGroupsYet: 'No keys groups defined yet',
    noGroupsHint: 'Select a preset group or tap "Create New" to add a group and customize key colors and visibility.',
    styleGroups: 'Style Groups',
    editing: 'Editing',
    inactive: 'Inactive',
    tips: 'Tips',
  },
  diacritics: {
    enableNikkud: 'Enable Nikkud',
    basic: 'Basic',
    full: 'Full',
    custom: 'Custom',
    diacriticsSection: 'Diacritics',
    modifiers: 'Modifiers',
    noDiacritics: 'No diacritics available for this language.',
  },
  styleRuleModal: {
    newKeysGroup: 'New Keys Group',
    groupNamePrefix: 'Group',
    nameLabel: 'Name',
    namePlaceholder: 'Enter group name',
    presetKeysLocked: 'Preset keys are locked and cannot be changed.',
    tapKeysToSelect: 'Tap keys on the keyboard preview to select them.',
    visibility: 'Visibility',
    visibilityDefault: 'Default (Visible)',
    visibilityHide: 'Hide',
    visibilityShowOnly: 'Show Only',
    showOnlyHint: 'Only selected keys will be visible. All others will be hidden.',
    hiddenHint: 'Selected keys will be hidden from the keyboard.',
    bgColor: 'Background Color',
    textColor: 'Text Color',
    keysLocked: 'Keys are locked for this preset group.',
  },
  colorPicker: {
    modalTitle: 'Choose Color',
    selectedColor: 'Selected Color',
  },
  canvas: {
    preview: 'Preview',
  },
  addProfileModal: {
    title: 'Add New Keyboard',
    nameLabel: 'Keyboard Name',
    placeholder: 'Keyboard name',
    enterName: 'Please enter a keyboard name',
    nameInUse: 'This name is already in use.',
    selectLanguages: 'Select Languages',
    atLeastOneLanguage: 'At least one language must be selected',
  },
  saveAsModal: {
    title: 'Save As',
    message: 'Save a copy of this keyboard with a new name.',
    nameLabel: 'Keyboard Name',
    placeholder: 'New keyboard name',
    saveAs: 'Save As',
    enterName: 'Please enter a name',
    nameInUse: 'This name is already in use.',
  },
  profiles: {
    saveProfile: 'Save Keyboard',
    enterProfileNamePrompt: 'Enter a name for this keyboard',
    profileNamePlaceholder: 'Keyboard name',
    builtInProfiles: 'Built-in Keyboards:',
    savedProfiles: 'Saved Keyboards:',
    longPressForOptions: 'Long-press for options',
    current: 'Current:',
    custom: 'Custom',
    keyboardsInProfile: 'Keyboards in This Configuration:',
    customConfiguration: 'Custom configuration',
    keyboardPreview: 'Keyboard Preview',
    previewHelpText: 'Live preview of your keyboard. Tap keys to test!',
    generatedConfiguration: 'Generated Configuration (Advanced):',
    editingHelpText: 'Make your changes below and tap "Save Changes" when done.',
    editorHelpText: 'You can manually edit the JSON below if needed. Changes will override the configuration.',
    aboutProfiles: 'About Keyboards',
    helpText: '• Keyboards combine key layouts with styling\n• Switch keyboards to change layouts and themes\n• Edit keyboards/ folder to add new languages\n• Edit profiles/ folder to create custom themes\n• See keyboards/README.md for details',
    builtInNames: {
      default: 'Default',
      classic: 'IssieBoard Classic',
      highContrast: 'High Contrast',
    },
  },
  status: {
    initializing: 'Initializing...',
    loadedProfile: 'Loaded keyboard:',
    nativeModuleNotConnected: 'Native module not connected',
    errorLoadingConfiguration: 'Error loading configuration',
    switchingProfile: 'Switching keyboard...',
    switchedTo: 'Switched to:',
    errorSwitchingProfile: 'Error switching keyboard',
  },
  toggleSwitch: {
    visible: 'Visible',
    hidden: 'Hidden',
    a11yVisible: 'Toggle visibility: currently visible',
    a11yHidden: 'Toggle visibility: currently hidden',
  },
  setup: {
    keyboardNotAdded: 'IssieBoard keyboard for {{language}} is not added yet. Tap for setup instructions.',
    tapForInstructions: 'Tap for instructions',
    setupInstructionsTitle: 'Setup Instructions',
    setupStep1: '1. Open the Settings app',
    setupStep2: '2. Go to General > Keyboard > Keyboards',
    setupStep3: '3. Tap "Add New Keyboard..."',
    setupStep4: '4. Find and select "IssieBoard"',
    setupStep5: '5. Toggle on the language you want (e.g. "IssieBoard - English")',
    setupStep6: '6. Tap the > arrow and enable "Allow Full Access"',
    androidSetupStep1: '1. Open Settings > System > Languages & input > On-screen keyboard',
    androidSetupStep2: '2. Enable "IssieBoard"',
    androidSetupStep3: '3. Tap OK on the confirmation dialog',
    androidSetupStep4: '4. Return to your app and switch to IssieBoard when typing',
    fullAccessTitle: 'Enable Full Access',
    fullAccessStep1: '1. Open Settings > General > Keyboard > Keyboards',
    fullAccessStep2: '2. Tap "IssieBoard"',
    fullAccessStep3: '3. Enable "Allow Full Access"',
  },
  importExport: {
    exportProfile: 'Share Keyboard',
    backupAll: 'Backup All Keyboards',
    importSuccessTitle: 'Import Complete',
    importedProfiles: 'Imported Keyboards',
    skippedProfiles: 'Skipped (already exist)',
    skippedNote: 'Keyboards with existing names were skipped.',
    importFailed: 'Import Failed',
    invalidFile: 'This file is not a valid IssieBoard keyboard file.',
    ok: 'OK',
    noProfilesToExport: 'No custom keyboards to export.',
  },
};

const he: Strings = {
  common: {
    cancel: 'ביטול',
    save: 'שמור',
    saveChanges: 'שמור שינויים',
    delete: 'מחיקה',
    rename: 'שינוי שם',
    edit: 'עריכה',
    create: 'צור',
    apply: 'החל',
    reset: 'איפוס',
    error: 'שגיאה',
    success: 'הצלחה',
    loading: 'טוען...',
    default: 'ברירת מחדל',
    done: 'סיום',
    back: 'חזרה',
    on: 'פעיל',
    off: 'כבוי',
    visible: 'גלוי',
    hidden: 'מוסתר',
    showOnly: 'הצג בלבד',
    none: 'ללא',
    bgLabel: 'רקע',
    textLabel: 'טקסט',
  },
  editor: {
    keyboardConfiguration: 'הגדרות מקלדת',
    myKeyboards: 'המקלדות שלי',
    builtIn: 'מובנה',
    settings: 'הגדרות',
    backToNewsettings: 'תצוגה חדשה',
    classicView: 'תצוגה קלאסית',
    newProfile: 'מקלדת חדשה',
    duplicateProfile: 'שכפל מקלדת',
    newProfilePlaceholder: 'הזן שם מקלדת',
    select: 'בחר',
    saveAs: 'שמור בשם',
    saveCustomConfiguration: 'שמור הגדרה מותאמת',
    editing: 'עריכה:',
    languages: {
      hebrew: 'עברית',
      english: 'אנגלית',
      arabic: 'ערבית',
    },
    keyboardVariants: {
      standard: 'רגיל',
      orderedHe: 'לפי סדר (אלף-בית)',
      qwerty: 'QWERTY',
      orderedEn: 'לפי סדר (A-Z)',
      orderedAr: 'לפי סדר (אליף-בא)',
    },
  },
  alerts: {
    resetToFactory: 'לאפס להגדרות ברירת מחדל?',
    unsavedChanges: 'שינויים שלא נשמרו',
    unsavedChangesMessage: 'יש לך שינויים שלא נשמרו. מה תרצה לעשות?',
    discard: 'בטל',
    saveFirst: 'שמור קודם',
    discardChanges: 'בטל שינויים',
    discardChangesMessage: 'האם אתה בטוח שברצונך לבטל את כל השינויים?',
    clearAllSettings: 'לנקות את כל ההגדרות ולאפס לברירת מחדל?',
    clearAll: 'נקה הכל',
    cannotDelete: 'לא ניתן למחוק',
    cannotDeleteDefault: 'לא ניתן למחוק מקלדות מובנות.',
    cannotDeleteActive: 'זוהי המקלדת הפעילה. מחיקתה תחזיר למקלדת ברירת המחדל.',
    deleteProfile: 'מחיקת מקלדת',
    deleteConfirm: 'האם אתה בטוח שברצונך למחוק את "{{name}}"?',
    renameProfile: 'שינוי שם מקלדת',
    renamePrompt: 'הזן שם חדש עבור "{{name}}"',
    enterProfileName: 'אנא הזן שם למקלדת',
    failedToLoadProfile: 'טעינת המקלדת נכשלה',
    failedToLoadForEditing: 'טעינת המקלדת לעריכה נכשלה',
    profileChangedTo: 'המקלדת שונתה ל',
    closeAndReopenKeyboard: 'סגור ופתח מחדש את המקלדת לצפייה בשינויים.',
    failedToSwitchProfile: 'החלפת מקלדת נכשלה',
    syntaxError: 'שגיאת תחביר',
    checkJsonFormatting: 'אנא בדוק את פורמט ה-JSON.',
    savingConfiguration: 'שומר הגדרה מותאמת...',
    profileSaved: 'המקלדת נשמרה!',
    failedToSaveProfile: 'שמירת המקלדת נכשלה',
    profileUpdated: 'המקלדת עודכנה.',
    savedChangesTo: 'השינויים נשמרו ב:',
    editCancelled: 'העריכה בוטלה',
    deleted: 'נמחק:',
    failedToDeleteProfile: 'מחיקת המקלדת נכשלה',
    whatWouldYouLikeToDo: 'מה תרצה לעשות?',
    loadingProfile: 'טוען מקלדת שמורה...',
    profileLoaded: 'המקלדת נטענה.',
    profileNotFound: 'המקלדת לא נמצאה',
  },
  classic: {
    mainSettings: 'הגדרות ראשיות',
    mainColors: 'צבעים ראשיים',
    actionKeys: 'מקשי פעולה',
    colorDivision: 'חלוקת צבעים',
    specialKeys: 'מקשים מיוחדים',
    visibleKeys: 'מקשים גלויים',
    nikkud: 'ניקוד',
    nikkudSettings: 'הגדרות ניקוד',
    backgroundColor: 'צבע רקע',
    keysColor: 'צבע מקשים',
    textColor: 'צבע טקסט',
    spaceKeyColor: 'צבע מקש רווח',
    deleteKeyColor: 'צבע מקש מחיקה',
    enterKeyColor: 'צבע מקש אנטר',
    otherKeysColor: 'צבע מקשים אחרים',
    highlightedCharacters: 'תווים מודגשים',
    highlightKeysColor: 'צבע מקשים מודגשים',
    highlightTextColor: 'צבע טקסט מודגש',
    keyOrder: 'סדר מקשים',
    language: 'שפה',
    byRows: 'לפי שורות',
    bySections: 'לפי חלקים',
    topRow: 'שורה עליונה',
    middleRow: 'שורה אמצעית',
    bottomRow: 'שורה תחתונה',
    rightThird: 'שליש ימני',
    middleThird: 'שליש אמצעי',
    leftThird: 'שליש שמאלי',
    typeCharacters: 'הקלד תווים להדגשה',
    showAll: 'הצג הכל',
    tapKeysToShow: 'לחץ על המקשים שברצונך להציג',
  },
  toolbox: {
    generalAppearance: 'מראה כללי',
    keysGroups: 'קבוצות מקשים',
    nikkud: 'ניקוד',
    presets: 'תבניות',
    new: 'חדש',
    createNew: 'צור חדש',
    presetsModalTitle: 'בחר תבנית',
    keysLabel: 'מקשים',
  },
  globalSettings: {
    colors: 'צבעים',
    background: 'רקע',
    keysBackground: 'רקע מקשים',
    keysText: 'טקסט מקשים',
    font: 'גופן',
    keyGap: 'רווח בין מקשים',
    keyGapRegular: 'רגיל',
    keyGapMedium: 'בינוני',
    keyGapLarge: 'גדול',
    keyboardLayout: 'פריסת מקלדת',
    features: 'תכונות',
    wordSuggestions: 'הצעות מילים',
    wordSuggestionsDesc: 'הצג הצעות מילים מעל המקלדת',
    autoCorrect: 'תיקון אוטומטי',
    autoCorrectDesc: 'תקן שגיאות הקלדה נפוצות באופן אוטומטי',
    settingsButton: 'כפתור הגדרות',
    settingsButtonDesc: 'הצג סמל הגדרות על המקלדת',
    speakButtonInKeyboard: 'כפתור הקראה במקלדת',
    speakButtonInKeyboardDesc: 'הצג את כפתור ההקראה כחלק מהמקלדת במקום מעליה',
    symbolsInSuggestions: 'סמלים בהצעות',
    symbolsInSuggestionsDesc: 'הצג סמלי תמונה מעל הצעות מילים',
    advancedSettings: 'הגדרות מתקדמות',
    keyboardHeight: 'גובה מקלדת',
    fontSize: 'גודל גופן',
    fontWeight: 'עובי גופן',
    heightCompact: 'קומפקטי',
    heightNormal: 'רגיל',
    heightTall: 'גבוה',
    heightXTall: 'גבוה מאוד',
    weightLight: 'דק',
    weightRegular: 'רגיל',
    weightMedium: 'בינוני',
    weightSemibold: 'מעט מודגש',
    weightBold: 'מודגש',
    weightHeavy: 'כבד',
    sizeXS: 'XS',
    sizeS: 'S',
    sizeM: 'M',
    sizeL: 'L',
    sizeXL: 'XL',
  },
  keyEditor: {
    groupName: 'שם קבוצה',
    groupNamePlaceholder: 'הזן שם קבוצה',
    doneEditing: 'סיום עריכה',
    deselectAll: 'בטל בחירה',
    inGroups: 'בקבוצות',
    visibility: 'נראות',
    visibilityHint: 'שלוט האם המקשים הנבחרים גלויים על המקלדת',
    keyBgColor: 'צבע רקע מקש',
    textColor: 'צבע טקסט',
    customLabel: 'תווית מותאמת',
    customLabelHint: 'דרוס את התווית המוצגת על המקש',
    customLabelPlaceholder: 'הזן תווית מותאמת',
    keyInfo: 'מידע על מקש',
    position: 'מיקום',
    output: 'פלט',
    shiftOutput: 'פלט שיפט',
    type: 'סוג',
    width: 'רוחב',
  },
  styleRules: {
    deleteGroup: 'מחק קבוצה',
    deleteGroupConfirm: 'למחוק את "{{name}}"? פעולה זו תסיר עיצוב מ-{{count}} מקש(ים).',
    noStyles: 'לא הוחלו עיצובים מותאמים.',
    noGroupsYet: 'אין קבוצות מקשים עדיין',
    noGroupsHint: 'בחר קבוצה מוכנה מראש או לחץ "צור חדש" כדי להוסיף קבוצה ולהתאים צבעים וראות.',
    styleGroups: 'קבוצות עיצוב',
    editing: 'עריכה',
    inactive: 'לא פעיל',
    tips: 'טיפים',
  },
  diacritics: {
    enableNikkud: 'הפעל ניקוד',
    basic: 'בסיסי',
    full: 'מלא',
    custom: 'מותאם אישית',
    diacriticsSection: 'סימני ניקוד',
    modifiers: 'מתאמים',
    noDiacritics: 'אין סימני ניקוד זמינים לשפה זו.',
  },
  styleRuleModal: {
    newKeysGroup: 'קבוצת מקשים חדשה',
    groupNamePrefix: 'קבוצה',
    nameLabel: 'שם',
    namePlaceholder: 'הזן שם קבוצה',
    presetKeysLocked: 'מקשי תבנית נעולים ולא ניתנים לשינוי.',
    tapKeysToSelect: 'לחץ על מקשים בתצוגה המקדימה כדי לבחור אותם.',
    visibility: 'נראות',
    visibilityDefault: 'ברירת מחדל (גלוי)',
    visibilityHide: 'הסתר',
    visibilityShowOnly: 'הצג בלבד',
    showOnlyHint: 'רק המקשים הנבחרים יהיו גלויים. כל השאר יוסתרו.',
    hiddenHint: 'המקשים הנבחרים יוסתרו מהמקלדת.',
    bgColor: 'צבע רקע',
    textColor: 'צבע טקסט',
    keysLocked: 'המקשים נעולים עבור קבוצת תבנית זו.',
  },
  colorPicker: {
    modalTitle: 'בחר צבע',
    selectedColor: 'צבע נבחר',
  },
  canvas: {
    preview: 'תצוגה מקדימה',
  },
  addProfileModal: {
    title: 'הוסף מקלדת חדשה',
    nameLabel: 'שם המקלדת',
    placeholder: 'שם המקלדת',
    enterName: 'אנא הזן שם למקלדת',
    nameInUse: 'שם זה כבר בשימוש.',
    selectLanguages: 'בחר שפות',
    atLeastOneLanguage: 'יש לבחור לפחות שפה אחת',
  },
  saveAsModal: {
    title: 'שמור בשם',
    message: 'שמור עותק של מקלדת זו בשם חדש.',
    nameLabel: 'שם המקלדת',
    placeholder: 'שם מקלדת חדשה',
    saveAs: 'שמור בשם',
    enterName: 'אנא הזן שם',
    nameInUse: 'שם זה כבר בשימוש.',
  },
  profiles: {
    saveProfile: 'שמירת מקלדת',
    enterProfileNamePrompt: 'הזן שם למקלדת זו',
    profileNamePlaceholder: 'שם המקלדת',
    builtInProfiles: 'מקלדות מובנות:',
    savedProfiles: 'מקלדות שמורות:',
    longPressForOptions: 'לחיצה ארוכה לאפשרויות',
    current: 'נוכחי:',
    custom: 'מותאם אישית',
    keyboardsInProfile: 'מקלדות בהגדרה זו:',
    customConfiguration: 'הגדרה מותאמת אישית',
    keyboardPreview: 'תצוגה מקדימה של המקלדת',
    previewHelpText: 'תצוגה מקדימה של המקלדת. לחץ על כפתורים כדי לבדוק!',
    generatedConfiguration: 'הגדרות מתקדמות:',
    editingHelpText: 'ערוך את השינויים למטה ולחץ "שמור שינויים" בסיום.',
    editorHelpText: 'ניתן לערוך את ה-JSON למטה במידת הצורך. השינויים ידרסו את ההגדרות.',
    aboutProfiles: 'אודות מקלדות',
    helpText: '• מקלדות משלבות פריסת מקשים עם עיצוב\n• החלף מקלדות לשינוי פריסה וערכות נושא\n• ערוך תיקיית keyboards/ להוספת שפות\n• ערוך תיקיית profiles/ ליצירת ערכות נושא\n• ראה keyboards/README.md לפרטים',
    builtInNames: {
      default: 'ברירת מחדל',
      classic: 'IssieBoard קלאסי',
      highContrast: 'ניגודיות גבוהה',
    },
  },
  status: {
    initializing: 'מאתחל...',
    loadedProfile: 'מקלדת נטענה:',
    nativeModuleNotConnected: 'המודול לא מחובר',
    errorLoadingConfiguration: 'שגיאה בטעינת ההגדרות',
    switchingProfile: 'מחליף מקלדת...',
    switchedTo: 'הוחלף ל:',
    errorSwitchingProfile: 'שגיאה בהחלפת מקלדת',
  },
  toggleSwitch: {
    visible: 'גלוי',
    hidden: 'מוסתר',
    a11yVisible: 'החלף נראות: גלוי כעת',
    a11yHidden: 'החלף נראות: מוסתר כעת',
  },
  setup: {
    keyboardNotAdded: 'מקלדת IssieBoard ל{{language}} עדיין לא הוגדרה. לחצו להוראות הגדרה.',
    tapForInstructions: 'לחצו להוראות',
    setupInstructionsTitle: 'הוראות הגדרה',
    setupStep1: '1. פתחו את אפליקציית ההגדרות',
    setupStep2: '2. עברו אל כללי > מקלדת > מקלדות',
    setupStep3: '3. לחצו על "הוסף מקלדת חדשה..."',
    setupStep4: '4. מצאו ובחרו "IssieBoard"',
    setupStep5: '5. הפעילו את השפה הרצויה (למשל "IssieBoard - עברית")',
    setupStep6: '6. לחצו על החץ > והפעילו "גישה מלאה"',
    androidSetupStep1: '1. פתחו הגדרות > מערכת > שפות וקלט > מקלדת על המסך',
    androidSetupStep2: '2. הפעילו את "IssieBoard"',
    androidSetupStep3: '3. לחצו אישור בחלון האישור',
    androidSetupStep4: '4. חזרו לאפליקציה והחליפו ל-IssieBoard בזמן הקלדה',
    fullAccessTitle: 'הפעלת גישה מלאה',
    fullAccessStep1: '1. פתחו הגדרות > כללי > מקלדת > מקלדות',
    fullAccessStep2: '2. לחצו על "IssieBoard"',
    fullAccessStep3: '3. הפעילו "גישה מלאה"',
  },
  importExport: {
    exportProfile: 'שתף מקלדת',
    backupAll: 'גיבוי כל המקלדות',
    importSuccessTitle: 'ייבוא הושלם',
    importedProfiles: 'מקלדות שיובאו',
    skippedProfiles: 'דולגו (כבר קיימות)',
    skippedNote: 'מקלדות עם שמות קיימים דולגו.',
    importFailed: 'הייבוא נכשל',
    invalidFile: 'קובץ זה אינו קובץ מקלדת תקין של IssieBoard.',
    ok: 'אישור',
    noProfilesToExport: 'אין מקלדות מותאמות לייצוא.',
  },
};

const ar: Strings = {
  common: {
    cancel: 'إلغاء',
    save: 'حفظ',
    saveChanges: 'حفظ التغييرات',
    delete: 'حذف',
    rename: 'إعادة تسمية',
    edit: 'تحرير',
    create: 'إنشاء',
    apply: 'تطبيق',
    reset: 'إعادة تعيين',
    error: 'خطأ',
    success: 'نجاح',
    loading: 'جارٍ التحميل...',
    default: 'افتراضي',
    done: 'تم',
    back: 'رجوع',
    on: 'مفعّل',
    off: 'معطّل',
    visible: 'مرئي',
    hidden: 'مخفي',
    showOnly: 'إظهار فقط',
    none: 'لا شيء',
    bgLabel: 'خلفية',
    textLabel: 'نص',
  },
  editor: {
    keyboardConfiguration: 'إعدادات لوحة المفاتيح',
    myKeyboards: 'لوحات المفاتيح',
    builtIn: 'مدمج',
    settings: 'إعدادات',
    backToNewsettings: 'New View',
    classicView: 'العرض الكلاسيكي',
    newProfile: 'لوحة مفاتيح جديدة',
    duplicateProfile: 'تكرار لوحة المفاتيح',
    newProfilePlaceholder: 'أدخل اسم لوحة المفاتيح',
    select: 'اختر',
    saveAs: 'حفظ باسم',
    saveCustomConfiguration: 'حفظ الإعداد المخصص',
    editing: 'تحرير:',
    languages: {
      hebrew: 'عبرية',
      english: 'إنجليزية',
      arabic: 'عربية',
    },
    keyboardVariants: {
      standard: 'قياسي',
      orderedHe: 'مرتب (ألف-بيت عبري)',
      qwerty: 'QWERTY',
      orderedEn: 'مرتب (A-Z)',
      orderedAr: 'مرتب (ألف-باء)',
    },
  },
  alerts: {
    resetToFactory: 'إعادة التعيين إلى الإعدادات الافتراضية؟',
    unsavedChanges: 'تغييرات غير محفوظة',
    unsavedChangesMessage: 'لديك تغييرات غير محفوظة. ماذا تريد أن تفعل؟',
    discard: 'تجاهل',
    saveFirst: 'حفظ أولاً',
    discardChanges: 'تجاهل التغييرات',
    discardChangesMessage: 'هل أنت متأكد أنك تريد تجاهل كل التغييرات؟',
    clearAllSettings: 'مسح جميع الإعدادات وإعادة التعيين إلى الافتراضي؟',
    clearAll: 'مسح الكل',
    cannotDelete: 'لا يمكن الحذف',
    cannotDeleteDefault: 'لا يمكن حذف لوحات المفاتيح الافتراضية.',
    cannotDeleteActive: 'هذه هي لوحة المفاتيح النشطة. سيؤدي حذفها إلى التبديل إلى لوحة المفاتيح الافتراضية.',
    deleteProfile: 'حذف لوحة المفاتيح',
    deleteConfirm: 'هل أنت متأكد أنك تريد حذف "{{name}}"؟',
    renameProfile: 'إعادة تسمية لوحة المفاتيح',
    renamePrompt: 'أدخل اسمًا جديدًا لـ "{{name}}"',
    enterProfileName: 'يرجى إدخال اسم للوحة المفاتيح',
    failedToLoadProfile: 'فشل تحميل لوحة المفاتيح',
    failedToLoadForEditing: 'فشل تحميل لوحة المفاتيح للتحرير',
    profileChangedTo: 'تم تغيير لوحة المفاتيح إلى',
    closeAndReopenKeyboard: 'أغلق وأعد فتح لوحة المفاتيح لرؤية التغييرات.',
    failedToSwitchProfile: 'فشل تبديل لوحة المفاتيح',
    syntaxError: 'خطأ في الصياغة',
    checkJsonFormatting: 'يرجى التحقق من تنسيق JSON.',
    savingConfiguration: 'جارٍ حفظ الإعداد المخصص...',
    profileSaved: 'تم حفظ لوحة المفاتيح!',
    failedToSaveProfile: 'فشل حفظ لوحة المفاتيح',
    profileUpdated: 'تم تحديث لوحة المفاتيح.',
    savedChangesTo: 'تم حفظ التغييرات في:',
    editCancelled: 'تم إلغاء التحرير',
    deleted: 'تم الحذف:',
    failedToDeleteProfile: 'فشل حذف لوحة المفاتيح',
    whatWouldYouLikeToDo: 'ماذا تريد أن تفعل؟',
    loadingProfile: 'جارٍ تحميل لوحة المفاتيح...',
    profileLoaded: 'تم تحميل لوحة المفاتيح.',
    profileNotFound: 'لوحة المفاتيح غير موجودة',
  },
  classic: {
    mainSettings: 'الإعدادات الرئيسية',
    mainColors: 'الألوان الرئيسية',
    actionKeys: 'مفاتيح الإجراءات',
    colorDivision: 'تقسيم الألوان',
    specialKeys: 'مفاتيح خاصة',
    visibleKeys: 'مفاتيح مرئية',
    nikkud: 'تشكيل',
    nikkudSettings: 'إعدادات التشكيل',
    backgroundColor: 'لون الخلفية',
    keysColor: 'لون المفاتيح',
    textColor: 'لون النص',
    spaceKeyColor: 'لون مفتاح المسافة',
    deleteKeyColor: 'لون مفتاح الحذف',
    enterKeyColor: 'لون مفتاح الإدخال',
    otherKeysColor: 'لون المفاتيح الأخرى',
    highlightedCharacters: 'أحرف مميزة',
    highlightKeysColor: 'لون المفاتيح المميزة',
    highlightTextColor: 'لون النص المميز',
    keyOrder: 'ترتيب المفاتيح',
    language: 'اللغة',
    byRows: 'حسب الصفوف',
    bySections: 'حسب الأقسام',
    topRow: 'الصف العلوي',
    middleRow: 'الصف الأوسط',
    bottomRow: 'الصف السفلي',
    rightThird: 'الثلث الأيمن',
    middleThird: 'الثلث الأوسط',
    leftThird: 'الثلث الأيسر',
    typeCharacters: 'اكتب أحرفًا لتمييزها',
    showAll: 'إظهار الكل',
    tapKeysToShow: 'اضغط على المفاتيح التي تريد إظهارها',
  },
  toolbox: {
    generalAppearance: 'المظهر العام',
    keysGroups: 'مجموعات المفاتيح',
    nikkud: 'تشكيل',
    presets: 'قوالب',
    new: 'جديد',
    createNew: 'إنشاء جديد',
    presetsModalTitle: 'اختر قالبًا',
    keysLabel: 'مفاتيح',
  },
  globalSettings: {
    colors: 'الألوان',
    background: 'الخلفية',
    keysBackground: 'خلفية المفاتيح',
    keysText: 'نص المفاتيح',
    font: 'الخط',
    keyGap: 'المسافة بين المفاتيح',
    keyGapRegular: 'عادي',
    keyGapMedium: 'متوسط',
    keyGapLarge: 'كبير',
    keyboardLayout: 'تخطيط لوحة المفاتيح',
    features: 'الميزات',
    wordSuggestions: 'اقتراحات الكلمات',
    wordSuggestionsDesc: 'إظهار اقتراحات الكلمات فوق لوحة المفاتيح',
    autoCorrect: 'التصحيح التلقائي',
    autoCorrectDesc: 'تصحيح الأخطاء الإملائية الشائعة تلقائيًا',
    settingsButton: 'زر الإعدادات',
    settingsButtonDesc: 'إظهار أيقونة الإعدادات على لوحة المفاتيح',
    speakButtonInKeyboard: 'زر التحدث في لوحة المفاتيح',
    speakButtonInKeyboardDesc: 'عرض زر التحدث كجزء من لوحة المفاتيح بدلاً من فوقها',
    symbolsInSuggestions: 'رموز في الاقتراحات',
    symbolsInSuggestionsDesc: 'عرض رموز مصورة فوق اقتراحات الكلمات',
    advancedSettings: 'إعدادات متقدمة',
    keyboardHeight: 'ارتفاع لوحة المفاتيح',
    fontSize: 'حجم الخط',
    fontWeight: 'سماكة الخط',
    heightCompact: 'مضغوط',
    heightNormal: 'عادي',
    heightTall: 'طويل',
    heightXTall: 'طويل جدًا',
    weightLight: 'خفيف',
    weightRegular: 'عادي',
    weightMedium: 'متوسط',
    weightSemibold: 'شبه عريض',
    weightBold: 'عريض',
    weightHeavy: 'ثقيل',
    sizeXS: 'XS',
    sizeS: 'S',
    sizeM: 'M',
    sizeL: 'L',
    sizeXL: 'XL',
  },
  keyEditor: {
    groupName: 'اسم المجموعة',
    groupNamePlaceholder: 'أدخل اسم المجموعة',
    doneEditing: 'إنهاء التحرير',
    deselectAll: 'إلغاء تحديد الكل',
    inGroups: 'في مجموعات',
    visibility: 'الرؤية',
    visibilityHint: 'تحكم في ظهور المفاتيح المحددة على لوحة المفاتيح',
    keyBgColor: 'لون خلفية المفتاح',
    textColor: 'لون النص',
    customLabel: 'تسمية مخصصة',
    customLabelHint: 'تغيير التسمية المعروضة على المفتاح',
    customLabelPlaceholder: 'أدخل تسمية مخصصة',
    keyInfo: 'معلومات المفتاح',
    position: 'الموضع',
    output: 'الإخراج',
    shiftOutput: 'إخراج شيفت',
    type: 'النوع',
    width: 'العرض',
  },
  styleRules: {
    deleteGroup: 'حذف المجموعة',
    deleteGroupConfirm: 'حذف "{{name}}"؟ سيؤدي ذلك إلى إزالة التنسيق من {{count}} مفتاح(مفاتيح).',
    noStyles: 'لا توجد أنماط مخصصة مطبقة.',
    noGroupsYet: 'لا توجد مجموعات مفاتيح بعد',
    noGroupsHint: 'اختر مجموعة جاهزة أو اضغط "إنشاء جديد" لإضافة مجموعة وتخصيص الألوان والرؤية.',
    styleGroups: 'مجموعات الأنماط',
    editing: 'تحرير',
    inactive: 'غير نشط',
    tips: 'نصائح',
  },
  diacritics: {
    enableNikkud: 'تفعيل التشكيل',
    basic: 'أساسي',
    full: 'كامل',
    custom: 'مخصص',
    diacriticsSection: 'علامات التشكيل',
    modifiers: 'المعدّلات',
    noDiacritics: 'لا تتوفر علامات تشكيل لهذه اللغة.',
  },
  styleRuleModal: {
    newKeysGroup: 'مجموعة مفاتيح جديدة',
    groupNamePrefix: 'مجموعة',
    nameLabel: 'الاسم',
    namePlaceholder: 'أدخل اسم المجموعة',
    presetKeysLocked: 'مفاتيح القالب مقفلة ولا يمكن تغييرها.',
    tapKeysToSelect: 'اضغط على المفاتيح في المعاينة لتحديدها.',
    visibility: 'الرؤية',
    visibilityDefault: 'افتراضي (مرئي)',
    visibilityHide: 'إخفاء',
    visibilityShowOnly: 'إظهار فقط',
    showOnlyHint: 'ستكون المفاتيح المحددة فقط مرئية. سيتم إخفاء جميع المفاتيح الأخرى.',
    hiddenHint: 'سيتم إخفاء المفاتيح المحددة من لوحة المفاتيح.',
    bgColor: 'لون الخلفية',
    textColor: 'لون النص',
    keysLocked: 'المفاتيح مقفلة لمجموعة القالب هذه.',
  },
  colorPicker: {
    modalTitle: 'اختر لونًا',
    selectedColor: 'اللون المحدد',
  },
  canvas: {
    preview: 'معاينة',
  },
  addProfileModal: {
    title: 'إضافة لوحة مفاتيح جديدة',
    nameLabel: 'اسم لوحة المفاتيح',
    placeholder: 'اسم لوحة المفاتيح',
    enterName: 'يرجى إدخال اسم للوحة المفاتيح',
    nameInUse: 'هذا الاسم مستخدم بالفعل.',
    selectLanguages: 'اختر اللغات',
    atLeastOneLanguage: 'يجب تحديد لغة واحدة على الأقل',
  },
  saveAsModal: {
    title: 'حفظ باسم',
    message: 'حفظ نسخة من لوحة المفاتيح هذه باسم جديد.',
    nameLabel: 'اسم لوحة المفاتيح',
    placeholder: 'اسم لوحة مفاتيح جديدة',
    saveAs: 'حفظ باسم',
    enterName: 'يرجى إدخال اسم',
    nameInUse: 'هذا الاسم مستخدم بالفعل.',
  },
  profiles: {
    saveProfile: 'حفظ لوحة المفاتيح',
    enterProfileNamePrompt: 'أدخل اسمًا للوحة المفاتيح هذه',
    profileNamePlaceholder: 'اسم لوحة المفاتيح',
    builtInProfiles: 'لوحات مفاتيح مدمجة:',
    savedProfiles: 'لوحات مفاتيح محفوظة:',
    longPressForOptions: 'اضغط مطولاً للخيارات',
    current: 'الحالي:',
    custom: 'مخصص',
    keyboardsInProfile: 'لوحات المفاتيح في هذا الإعداد:',
    customConfiguration: 'إعداد مخصص',
    keyboardPreview: 'عرض معاينة لوحة المفاتيح',
    previewHelpText: 'عرض معاينة لوحة المفاتيح. اضغط على المفاتيح للاختبار!',
    generatedConfiguration: 'الإعدادات المتقدمة:',
    editingHelpText: 'قم بإجراء التغييرات أدناه واضغط "حفظ التغييرات" عند الانتهاء.',
    editorHelpText: 'يمكنك تحرير JSON أدناه إذا لزم الأمر. ستتجاوز التغييرات الإعدادات.',
    aboutProfiles: 'حول لوحات المفاتيح',
    helpText: '• لوحات المفاتيح تجمع بين تخطيط المفاتيح والتصميم\n• بدّل لوحات المفاتيح لتغيير التخطيط والسمات\n• حرر مجلد keyboards/ لإضافة لغات\n• حرر مجلد profiles/ لإنشاء سمات مخصصة\n• انظر keyboards/README.md للتفاصيل',
    builtInNames: {
      default: 'افتراضي',
      classic: 'IssieBoard كلاسيكي',
      highContrast: 'تباين عالٍ',
    },
  },
  status: {
    initializing: 'جارٍ التهيئة...',
    loadedProfile: 'تم تحميل لوحة المفاتيح:',
    nativeModuleNotConnected: 'الوحدة الأصلية غير متصلة',
    errorLoadingConfiguration: 'خطأ في تحميل الإعدادات',
    switchingProfile: 'جارٍ تبديل لوحة المفاتيح...',
    switchedTo: 'تم التبديل إلى:',
    errorSwitchingProfile: 'خطأ في تبديل لوحة المفاتيح',
  },
  toggleSwitch: {
    visible: 'مرئي',
    hidden: 'مخفي',
    a11yVisible: 'تبديل الرؤية: مرئي حاليًا',
    a11yHidden: 'تبديل الرؤية: مخفي حاليًا',
  },
  setup: {
    keyboardNotAdded: 'لم تتم إضافة لوحة مفاتيح IssieBoard لـ{{language}} بعد. اضغط لتعليمات الإعداد.',
    tapForInstructions: 'اضغط للتعليمات',
    setupInstructionsTitle: 'تعليمات الإعداد',
    setupStep1: '1. افتح تطبيق الإعدادات',
    setupStep2: '2. انتقل إلى عام > لوحة المفاتيح > لوحات المفاتيح',
    setupStep3: '3. اضغط على "إضافة لوحة مفاتيح جديدة..."',
    setupStep4: '4. ابحث عن "IssieBoard" واختره',
    setupStep5: '5. فعّل اللغة المطلوبة (مثلاً "IssieBoard - العربية")',
    setupStep6: '6. اضغط على السهم > وفعّل "السماح بالوصول الكامل"',
    androidSetupStep1: '1. افتح الإعدادات > النظام > اللغات والإدخال > لوحة المفاتيح على الشاشة',
    androidSetupStep2: '2. فعّل "IssieBoard"',
    androidSetupStep3: '3. اضغط موافق في نافذة التأكيد',
    androidSetupStep4: '4. ارجع إلى التطبيق وانتقل إلى IssieBoard أثناء الكتابة',
    fullAccessTitle: 'تفعيل الوصول الكامل',
    fullAccessStep1: '1. افتح الإعدادات > عام > لوحة المفاتيح > لوحات المفاتيح',
    fullAccessStep2: '2. اضغط على "IssieBoard"',
    fullAccessStep3: '3. فعّل "السماح بالوصول الكامل"',
  },
  importExport: {
    exportProfile: 'مشاركة لوحة مفاتيح',
    backupAll: 'نسخ احتياطي لجميع لوحات المفاتيح',
    importSuccessTitle: 'اكتمل الاستيراد',
    importedProfiles: 'لوحات المفاتيح المستوردة',
    skippedProfiles: 'تم تخطيها (موجودة بالفعل)',
    skippedNote: 'تم تخطي لوحات المفاتيح ذات الأسماء الموجودة.',
    importFailed: 'فشل الاستيراد',
    invalidFile: 'هذا الملف ليس ملف لوحة مفاتيح IssieBoard صالحًا.',
    ok: 'موافق',
    noProfilesToExport: 'لا توجد لوحات مفاتيح مخصصة للتصدير.',
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
