import { useState, useEffect } from "react";
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalization } from "../src/localization";

type LanguageId = 'he' | 'en' | 'ar';

interface AddProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, language: string, keyboardId: string) => Promise<boolean>;
  initialLanguage?: LanguageId;
  initialKeyboardId?: string;
  existingNames: string[];
}

const AddProfileModal = ({ visible, onClose, onCreate, initialLanguage = 'he', initialKeyboardId = 'he', existingNames }: AddProfileModalProps) => {
  const { strings } = useLocalization();
  const [profileName, setProfileName] = useState('');
  const [error, setError] = useState('');

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setProfileName('');
      setError('');
    }
  }, [visible]);

  const handleCreate = async () => {
    const trimmedName = profileName.trim();
    
    if (!trimmedName) {
      setError('Please enter a name');
      return;
    }
    
    // Check for duplicate names (case-insensitive)
    if (existingNames.some(name => name.toLowerCase() === trimmedName.toLowerCase())) {
      setError('This name is already in use');
      return;
    }
    
    // Use the current language and keyboard from settings
    const success = await onCreate(trimmedName, initialLanguage, initialKeyboardId);
    if (success) {
      setProfileName('');
      setError('');
    }
  };

  const handleClose = () => {
    setProfileName('');
    onClose();
  };

  if (!visible) return null;

  const isCreateDisabled = !profileName.trim();

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
        <View style={styles.centeredView}>
          <View style={styles.dialog}>
            <Text style={styles.title}>Add New IssieBoard</Text>

            <Text style={styles.label}>IssieBoard Name</Text>
            <TextInput
              style={[styles.input, error ? styles.inputError : null]}
              value={profileName}
              onChangeText={(text) => {
                setProfileName(text);
                setError(''); // Clear error when typing
              }}
              placeholder="My Custom Keyboard"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

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
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    fontSize: 15,
  },
  inputError: {
    borderColor: '#F44336',
  },
  errorText: {
    color: '#F44336',
    fontSize: 12,
    marginHorizontal: 16,
    marginBottom: 12,
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
