import React from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, I18nManager } from 'react-native';
import { ImportInfo, ImportedProfileInfo } from '../import-export';
import { useLocalization } from '../localization';

interface Props {
  importInfo: ImportInfo;
  onClose: () => void;
}

const languageKeyMap: Record<string, 'hebrew' | 'english' | 'arabic'> = {
  he: 'hebrew',
  en: 'english',
  ar: 'arabic',
};

export const ImportInfoDialog: React.FC<Props> = ({ importInfo, onClose }) => {
  const { strings } = useLocalization();
  const isRTL = I18nManager.isRTL;
  const s = strings.importExport;

  const formatItem = (item: ImportedProfileInfo): string => {
    const langKey = languageKeyMap[item.language];
    const langName = langKey ? strings.editor.languages[langKey] : item.language;
    return langName ? `${item.name} (${langName})` : item.name;
  };

  const renderSection = (title: string, data: ImportedProfileInfo[]) => (
    <View style={styles.section}>
      <Text allowFontScaling={false} style={styles.sectionTitle}>{title} ({data.length})</Text>
      {data.map((item, index) => (
        <Text allowFontScaling={false} key={index} style={styles.item}>
          {isRTL ? `${formatItem(item)} •` : `• ${formatItem(item)}`}
        </Text>
      ))}
    </View>
  );

  return (
    <Modal
      visible={true}
      animationType="fade"
      transparent={true}
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text allowFontScaling={false} style={styles.title}>{s.importSuccessTitle}</Text>
          <View style={styles.separator} />
          <ScrollView style={{ maxHeight: 400 }}>
            {renderSection(s.importedProfiles, importInfo.importedProfiles)}
            {importInfo.skippedExistingProfiles.length > 0 &&
              renderSection(s.skippedProfiles, importInfo.skippedExistingProfiles)}
          </ScrollView>
          {importInfo.skippedExistingProfiles.length > 0 && (
            <Text allowFontScaling={false} style={styles.note}>{s.skippedNote}</Text>
          )}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.okButton} onPress={onClose} activeOpacity={0.7}>
              <Text allowFontScaling={false} style={styles.okButtonText}>{s.ok}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: 400,
    maxWidth: '90%',
    maxHeight: '80%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 10,
  },
  section: {
    marginVertical: 10,
  },
  sectionTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  item: {
    fontSize: 16,
    marginHorizontal: 8,
    marginVertical: 2,
  },
  note: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    marginHorizontal: 8,
  },
  buttonRow: {
    alignItems: 'center',
    marginTop: 16,
  },
  okButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 8,
  },
  okButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
