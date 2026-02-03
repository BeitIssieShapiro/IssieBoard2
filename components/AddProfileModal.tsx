import { useState, useEffect } from "react";
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalization } from "../src/localization";

type LanguageId = 'he' | 'en' | 'ar';

interface LanguageDefinition {
  id: LanguageId;
  name: string;
  nativeName: string;
  keyboards: { id: string; name: string }[];
}

const LANGUAGES: LanguageDefinition[] = [
  {
    id: 'he',
    name: 'Hebrew',
    nativeName: 'עברית',
    keyboards: [
      { id: 'he', name: 'Standard' },
      { id: 'he_ordered', name: 'Ordered (א-ב)' },
    ],
  },
  {
    id: 'en',
    name: 'English',
    nativeName: 'English',
    keyboards: [
      { id: 'en', name: 'QWERTY' },
    ],
  },
  {
    id: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    keyboards: [
      { id: 'ar', name: 'Standard' },
    ],
  },
];

interface AddProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, language: string, keyboardId: string) => void;
  initialLanguage?: LanguageId;
}

const AddProfileModal = ({ visible, onClose, onCreate, initialLanguage = 'he' }: AddProfileModalProps) => {
  const { strings } = useLocalization();
  const [profileName, setProfileName] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageId>(initialLanguage);
  const [selectedKeyboard, setSelectedKeyboard] = useState<string>('');

  // Get current language definition
  const currentLangDef = LANGUAGES.find(l => l.id === selectedLanguage) || LANGUAGES[0];

  // Update keyboard when language changes
  useEffect(() => {
    const langDef = LANGUAGES.find(l => l.id === selectedLanguage);
    if (langDef && langDef.keyboards.length > 0) {
      setSelectedKeyboard(langDef.keyboards[0].id);
    }
  }, [selectedLanguage]);

  // Reset state when modal opens with initial language
  useEffect(() => {
    if (visible) {
      setSelectedLanguage(initialLanguage);
      const langDef = LANGUAGES.find(l => l.id === initialLanguage);
      if (langDef && langDef.keyboards.length > 0) {
        setSelectedKeyboard(langDef.keyboards[0].id);
      }
    }
  }, [visible, initialLanguage]);

  const handleCreate = () => {
    if (!profileName.trim()) {
      return;
    }
    if (!selectedKeyboard) {
      return;
    }
    onCreate(profileName.trim(), selectedLanguage, selectedKeyboard);
    // Reset state
    setProfileName('');
  };

  const handleClose = () => {
    // Reset state
    setProfileName('');
    onClose();
  };

  if (!visible) return null;

  const isCreateDisabled = !profileName.trim() || !selectedKeyboard;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.dialog}>
            <Text style={styles.title}>{strings.addProfile || 'Add New Profile'}</Text>

            <Text style={styles.label}>{strings.profileNameLabel || 'Profile Name'}</Text>
            <TextInput
              style={styles.input}
              value={profileName}
              onChangeText={setProfileName}
              placeholder={strings.profileNamePlaceholder || 'My Custom Keyboard'}
              autoFocus
              returnKeyType="done"
            />

            <Text style={styles.label}>Language</Text>
            <View style={styles.languageContainer}>
              {LANGUAGES.map(lang => (
                <TouchableOpacity
                  key={lang.id}
                  style={[
                    styles.languageOption,
                    selectedLanguage === lang.id && styles.languageOptionSelected,
                  ]}
                  onPress={() => setSelectedLanguage(lang.id)}
                >
                  <Text style={[
                    styles.languageOptionText,
                    selectedLanguage === lang.id && styles.languageOptionTextSelected,
                  ]}>
                    {lang.nativeName}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {currentLangDef.keyboards.length > 1 && (
              <>
                <Text style={styles.label}>Keyboard Layout</Text>
                <View style={styles.keyboardContainer}>
                  {currentLangDef.keyboards.map(kb => (
                    <TouchableOpacity
                      key={kb.id}
                      style={[
                        styles.keyboardOption,
                        selectedKeyboard === kb.id && styles.keyboardOptionSelected,
                      ]}
                      onPress={() => setSelectedKeyboard(kb.id)}
                    >
                      <View style={[
                        styles.radioCircle,
                        selectedKeyboard === kb.id && styles.radioCircleSelected,
                      ]}>
                        {selectedKeyboard === kb.id && <View style={styles.radioInner} />}
                      </View>
                      <Text style={[
                        styles.keyboardOptionText,
                        selectedKeyboard === kb.id && styles.keyboardOptionTextSelected,
                      ]}>
                        {kb.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <View style={styles.divider} />

            <View style={styles.buttons}>
              <TouchableOpacity style={styles.button} onPress={handleClose}>
                <Text style={styles.buttonText}>{strings.cancel}</Text>
              </TouchableOpacity>
              <View style={styles.buttonDivider} />
              <TouchableOpacity
                style={[styles.button, isCreateDisabled && styles.buttonDisabled]}
                onPress={handleCreate}
                disabled={isCreateDisabled}
              >
                <Text style={[
                  styles.buttonText,
                  styles.createText,
                  isCreateDisabled && styles.buttonTextDisabled,
                ]}>
                  {strings.create || 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
  
};

export default AddProfileModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  dialog: {
    backgroundColor: 'white',
    borderRadius: 14,
    width: 320,
    overflow: 'hidden',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    paddingHorizontal: 16,
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    fontSize: 15,
  },
  languageContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  languageOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
    alignItems: 'center',
  },
  languageOptionSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#E3F2FD',
  },
  languageOptionText: {
    fontSize: 14,
    color: '#666',
  },
  languageOptionTextSelected: {
    color: '#2196F3',
    fontWeight: '600',
  },
  keyboardContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  keyboardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
  },
  keyboardOptionSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#E3F2FD',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ccc',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    borderColor: '#2196F3',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2196F3',
  },
  keyboardOptionText: {
    fontSize: 15,
    color: '#333',
  },
  keyboardOptionTextSelected: {
    color: '#2196F3',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#ccc',
    marginTop: 8,
  },
  buttons: {
    flexDirection: 'row',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonDivider: {
    width: 1,
    backgroundColor: '#ccc',
  },
  buttonText: {
    fontSize: 17,
    color: '#007AFF',
  },
  buttonTextDisabled: {
    color: '#999',
  },
  createText: {
    fontWeight: '600',
  },
});