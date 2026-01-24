import { useState } from "react";
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native"
import { useLocalization } from "../src/localization";

interface SaveProfileModalProps {
    showSaveModal: boolean;
    onClose: () => void;
    onSave: (name: string) => void;
}

const SaveProfileModal = ({showSaveModal, onClose, onSave} : SaveProfileModalProps) => {
  const { strings } = useLocalization();
  const [newProfileName, setNewProfileName] = useState('');

  if (!showSaveModal) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{strings.saveProfile || 'Save Profile'}</Text>
          <Text style={styles.message}>{strings.enterProfileNamePrompt || 'Enter a name for this profile'}</Text>
          <TextInput
            style={styles.input}
            value={newProfileName}
            onChangeText={setNewProfileName}
            placeholder={strings.profileNamePlaceholder || 'Profile name'}
            autoFocus
          />
          <View style={styles.divider} />
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.button} onPress={onClose}>
              <Text style={styles.buttonText}>{strings.cancel}</Text>
            </TouchableOpacity>
            <View style={styles.buttonDivider} />
            <TouchableOpacity style={styles.button} onPress={() => onSave(newProfileName)}>
              <Text style={[styles.buttonText, styles.saveText]}>{strings.save || 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default SaveProfileModal;

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
    width: 270,
    overflow: 'hidden',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  message: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    paddingTop: 4,
    paddingHorizontal: 16,
    paddingBottom: 16,
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
  buttonDivider: {
    width: 1,
    backgroundColor: '#ccc',
  },
  buttonText: {
    fontSize: 17,
    color: '#007AFF',
  },
  saveText: {
    fontWeight: '600',
  },
});
