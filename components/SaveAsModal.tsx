import { useState, useEffect } from "react";
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalization } from "../src/localization";

interface SaveAsModalProps {
  visible: boolean;
  onClose: () => void;
  onSaveAs: (newName: string) => Promise<boolean>;
  originalName: string;
  existingNames: string[];
}

const SaveAsModal = ({ visible, onClose, onSaveAs, originalName, existingNames }: SaveAsModalProps) => {
  const { strings } = useLocalization();
  const [profileName, setProfileName] = useState('');
  const [error, setError] = useState('');

  // Set default name when modal opens
  useEffect(() => {
    if (visible) {
      // Generate default name: "My {Original Name}"
      const defaultName = `My ${originalName}`;
      setProfileName(defaultName);
      setError('');
    } else {
      setProfileName('');
      setError('');
    }
  }, [visible, originalName]);

  const handleSaveAs = async () => {
    const trimmedName = profileName.trim();

    if (!trimmedName) {
      setError('Please enter a name');
      return;
    }

    // Check for duplicate names (case-insensitive)
    // Note: existingNames already includes built-in profile names
    if (existingNames.some(name => name.toLowerCase() === trimmedName.toLowerCase())) {
      setError('This name is already in use');
      return;
    }

    const success = await onSaveAs(trimmedName);
    if (success) {
      setProfileName('');
      setError('');
    }
  };

  const handleClose = () => {
    setProfileName('');
    setError('');
    onClose();
  };

  if (!visible) return null;

  const isSaveDisabled = !profileName.trim();

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
            <Text style={styles.title}>Save As New IssieBoard</Text>

            <Text style={styles.message}>
              Create a copy of "{originalName}" that you can customize.
            </Text>

            <Text style={styles.label}>New IssieBoard Name</Text>
            <TextInput
              style={[styles.input, error ? styles.inputError : null]}
              value={profileName}
              onChangeText={(text) => {
                setProfileName(text);
                setError(''); // Clear error when typing
              }}
              placeholder="My Custom Keyboard"
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={handleSaveAs}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.divider} />

            <View style={styles.buttons}>
              <TouchableOpacity style={styles.button} onPress={handleClose}>
                <Text style={styles.buttonText}>{strings.cancel}</Text>
              </TouchableOpacity>
              <View style={styles.buttonDivider} />
              <TouchableOpacity
                style={[styles.button, isSaveDisabled && styles.buttonDisabled]}
                onPress={handleSaveAs}
                disabled={isSaveDisabled}
              >
                <Text style={[
                  styles.buttonText,
                  styles.saveText,
                  isSaveDisabled && styles.buttonTextDisabled,
                ]}>
                  Save As
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default SaveAsModal;

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
    paddingBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    lineHeight: 20,
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
    marginTop: 16,
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
  saveText: {
    fontWeight: '600',
  },
});
