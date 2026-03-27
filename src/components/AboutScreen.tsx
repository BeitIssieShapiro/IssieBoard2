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
import { cardShadow, subtleShadow } from '../styles/shadows';

const ACCENT = '#2563EB';

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
      {/* Title row: title + feedback button + close button */}
      <View style={styles.titleRow}>
        <Text allowFontScaling={false} style={styles.title}>
          {lang === 'he' ? 'אודות' : lang === 'ar' ? 'حول' : 'About'} {appName}
        </Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={styles.feedbackButton}
          onPress={() => setShowFeedbackDialog(true)}
          activeOpacity={0.7}>
          <Text allowFontScaling={false} style={styles.feedbackButtonText}>
            {lang === 'he' ? 'משוב' : lang === 'ar' ? 'ملاحظات' : 'Feedback'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text allowFontScaling={false} style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Language tabs */}
      <View style={styles.langRow}>
        {languages.map(l => {
          const isActive = lang === l.code;
          return (
            <TouchableOpacity
              key={l.code}
              style={[styles.langTab, isActive && styles.langTabActive]}
              onPress={() => setLang(l.code)}
              activeOpacity={0.7}>
              <Text
                allowFontScaling={false}
                style={[styles.langTabText, isActive && styles.langTabTextActive]}>
                {l.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 40 }}>
        {(paragraphs[lang] || paragraphs['en'] || []).map((text, index) => (
          <Text
            key={index}
            style={[
              styles.paragraph,
              { writingDirection: currentLang.dir },
            ]}>
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

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#EFF6FF',
    zIndex: 1000,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: ACCENT,
  },
  feedbackButton: {
    backgroundColor: ACCENT,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  feedbackButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    ...subtleShadow,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: 'bold',
  },
  langRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  langTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    minWidth: 90,
    justifyContent: 'center',
    ...subtleShadow,
  },
  langTabActive: {
    backgroundColor: ACCENT,
    ...cardShadow,
  },
  langTabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  langTabTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 12,
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
