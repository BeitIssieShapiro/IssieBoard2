import { useState } from "react";
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useLocalization } from "../src/localization";

interface AddProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, selectedLanguages: string[]) => void;
}

const AVAILABLE_LANGUAGES = [
  { id: 'en', name: 'English' },
  { id: 'he', name: 'עברית (Hebrew)' },
  { id: 'ar', name: 'العربية (Arabic)' },
];

const AddProfileModal = ({ visible, onClose, onCreate }: AddProfileModalProps) => {
  const { strings } = useLocalization();
  const [profileName, setProfileName] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['en']);

  const toggleLanguage = (langId: string) => {
    setSelectedLanguages(prev => {
      if (prev.includes(langId)) {
        // Don't allow deselecting if it's the last one
        if (prev.length === 1) {
          return prev;
        }
        return prev.filter(id => id !== langId);
      } else {
        return [...prev, langId];
      }
    });
  };

  const handleCreate = () => {
    if (!profileName.trim()) {
      return;
    }
    if (selectedLanguages.length === 0) {
      return;
    }
    onCreate(profileName.trim(), selectedLanguages);
    // Reset state
    setProfileName('');
    setSelectedLanguages(['en']);
  };

  const handleClose = () => {
    // Reset state
    setProfileName('');
    setSelectedLanguages(['en']);
    onClose();
  };

  if (!visible) return null;

  const isCreateDisabled = !profileName.trim() || selectedLanguages.length === 0;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{strings.addProfile || 'Add New Profile'}</Text>
          
          {/* Profile Name Input */}
          <Text style={styles.label}>{strings.profileNameLabel || 'Profile Name'}</Text>
          <TextInput
            style={styles.input}
            value={profileName}
            onChangeText={setProfileName}
            placeholder={strings.profileNamePlaceholder || 'Profile name'}
            autoFocus
          />

          {/* Language Selection */}
          <Text style={styles.label}>{strings.selectLanguages || 'Select Languages'}</Text>
          <Text style={styles.hint}>{strings.atLeastOneLanguage || 'At least one language must be selected'}</Text>
          
          <View style={styles.languagesContainer}>
            {AVAILABLE_LANGUAGES.map(lang => {
              const isSelected = selectedLanguages.includes(lang.id);
              const isLastSelected = isSelected && selectedLanguages.length === 1;
              
              return (
                <TouchableOpacity
                  key={lang.id}
                  style={[
                    styles.languageItem,
                    isSelected && styles.languageItemSelected,
                  ]}
                  onPress={() => toggleLanguage(lang.id)}
                  activeOpacity={isLastSelected ? 1 : 0.7}
                >
                  <View style={[
                    styles.checkbox,
                    isSelected && styles.checkboxSelected,
                  ]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={[
                    styles.languageName,
                    isSelected && styles.languageNameSelected,
                  ]}>
                    {lang.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

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
      </View>
    </Modal>
  );
};

export default AddProfileModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialog: {
    backgroundColor: 'white',
    borderRadius: 14,
    width: 300,
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
    marginBottom: 4,
  },
  hint: {
    fontSize: 11,
    color: '#888',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  input: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    fontSize: 14,
  },
  languagesContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  languageItem: {
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
  languageItemSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ccc',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  checkboxSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  checkmark: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  languageName: {
    fontSize: 15,
    color: '#333',
  },
  languageNameSelected: {
    color: '#007AFF',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#ccc',
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