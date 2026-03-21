import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeedbackDialog } from '@beitissieshapiro/issie-shared';
import { getVersion, getBuildNumber } from 'react-native-device-info';

const languages = [
  { code: 'he', label: 'עברית', dir: 'rtl' as const },
  { code: 'en', label: 'English', dir: 'ltr' as const },
  { code: 'ar', label: 'العربية', dir: 'rtl' as const },
];

interface AboutScreenProps {
  appName: string;
  onClose: () => void;
  paragraphs: Record<string, string[]>;
}

export function AboutScreen({ appName, onClose, paragraphs }: AboutScreenProps) {
  const [lang, setLang] = useState('he');
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const currentLang = languages.find(l => l.code === lang) || languages[1];
  const insets = useSafeAreaInsets();

  const version = getVersion();
  const buildNumber = getBuildNumber();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Title bar */}
      <View style={styles.titleBar}>
        <Text allowFontScaling={false} style={styles.title}>
          {lang === 'he' ? 'אודות' : lang === 'ar' ? 'حول' : 'About'} {appName}
        </Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text allowFontScaling={false} style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Language toggle */}
      <View style={styles.toggleRow}>
        {languages.map(l => (
          <TouchableOpacity
            key={l.code}
            style={[
              styles.toggleButton,
              lang === l.code && styles.toggleButtonActive,
            ]}
            onPress={() => setLang(l.code)}
          >
            <Text
              allowFontScaling={false}
              style={[
                styles.toggleText,
                lang === l.code && styles.toggleTextActive,
              ]}
            >
              {l.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Feedback button */}
      <View style={styles.feedbackContainer}>
        <TouchableOpacity
          style={styles.feedbackButton}
          onPress={() => setShowFeedbackDialog(true)}
          activeOpacity={0.7}
        >
          <Text allowFontScaling={false} style={styles.feedbackButtonText}>
            {lang === 'he' ? '💬 משוב משתמש' : lang === 'ar' ? '💬 ملاحظات المستخدم' : '💬 User Feedback'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {(paragraphs[lang] || paragraphs['en'] || []).map((text, index) => (
          <Text
            key={index}
            style={[
              styles.paragraph,
              { writingDirection: currentLang.dir },
            ]}
          >
            {text}
          </Text>
        ))}

        {/* Version */}
        <Text style={[styles.versionText, { writingDirection: currentLang.dir }]}>
          {lang === 'he' ? 'גרסה' : lang === 'ar' ? 'الإصدار' : 'Version'} {version} ({buildNumber})
        </Text>
      </ScrollView>

      <FeedbackDialog
        appName={appName}
        visible={showFeedbackDialog}
        onClose={() => setShowFeedbackDialog(false)}
      />
    </View>
  );
}

const ACCENT_COLOR = '#2196F3';

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F5F5F5',
    zIndex: 1000,
  },
  titleBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: ACCENT_COLOR,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
    fontWeight: 'bold',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'white',
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ACCENT_COLOR,
  },
  toggleButtonActive: {
    backgroundColor: ACCENT_COLOR,
  },
  toggleText: {
    fontSize: 18,
    color: ACCENT_COLOR,
  },
  toggleTextActive: {
    color: 'white',
  },
  feedbackContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: 'white',
  },
  feedbackButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 25,
    backgroundColor: ACCENT_COLOR,
  },
  feedbackButtonText: {
    fontSize: 18,
    color: 'white',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 20,
  },
  paragraph: {
    fontSize: 20,
    lineHeight: 32,
    marginBottom: 16,
    color: '#333',
  },
  versionText: {
    fontSize: 14,
    color: '#999',
    marginTop: 20,
    textAlign: 'center',
  },
});
