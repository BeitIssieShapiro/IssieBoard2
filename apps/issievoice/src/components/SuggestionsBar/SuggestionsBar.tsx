import React from 'react';
import {
  View,
  Text,
  ImageBackground,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useText } from '../../context/TextContext';
import { colors, sizes } from '../../constants';
import { MyIcon } from '@beitissieshapiro/issie-shared/dist/icons';

interface SuggestionsBarProps {
  currentText: string;
  kbSuggestions?: string[];
  language?: 'en' | 'he';
  onSuggestionPress?: (suggestion: string) => void;
  onBrowse?: () => void;
  symbolUrls?: Map<string, string | null>;
  height?: number; // Optional responsive height
  screenWidth?: number; // Optional screen width for responsive scaling
}

// Helper function to find the last word boundary, handling Hebrew and other scripts
const findLastWordBoundary = (text: string): number => {
  // Regex to match word boundaries - handles Hebrew, Arabic, and Latin scripts
  // Look for whitespace characters (space, newline, etc.)
  const trimmed = text.trimEnd();

  // Search backwards for a whitespace character
  for (let i = trimmed.length - 1; i >= 0; i--) {
    const char = trimmed[i];
    // Check if character is whitespace
    if (/\s/.test(char)) {
      return i;
    }
  }

  // No whitespace found
  return -1;
};

const SuggestionsBar: React.FC<SuggestionsBarProps> = ({
  currentText,
  kbSuggestions = [],
  language = 'en',
  onSuggestionPress,
  onBrowse,
  symbolUrls = new Map(),
  height = 70, // Default height
  screenWidth = 1000, // Default screen width
}) => {
  // Determine text direction based on language
  const isRTL = language === 'he';
  const { setText } = useText();

  const isMobile = screenWidth < 600;

  // Calculate responsive button height and font size
  const buttonHeight = Math.max(30, height - 10); // Leave 10px for padding

  // Scale font size based on both height and screen width
  // At 1000px width: use full height-based sizing
  // At smaller widths: reduce font size proportionally
  const baseHeightFontSize = buttonHeight * 0.5; // Base size from height
  const widthScaleFactor = Math.min(1, screenWidth / 1000); // Scale down on smaller screens
  const baseFontSize = Math.max(16, baseHeightFontSize * widthScaleFactor * 0.9); // Minimum 16px

  const showSymbols = height >= 120;
  const imageSize = showSymbols ? Math.floor(buttonHeight * 0.55) : 0;
  const fontSize = showSymbols ? Math.max(12, baseFontSize * 0.55) : baseFontSize;

  const handleSuggestionPress = (suggestion: string) => {
    // Strip quotes if the suggestion is wrapped in quotes (literal word)
    let cleanSuggestion = suggestion;
    if (suggestion.startsWith('"') && suggestion.endsWith('"')) {
      cleanSuggestion = suggestion.slice(1, -1);
    }

    // If a callback is provided, let the parent handle it (to notify keyboard)
    if (onSuggestionPress) {
      onSuggestionPress(cleanSuggestion);
      return;
    }

    // Fallback: Replace the partial word with the full suggestion + space
    // Find the last word boundary in currentText
    const trimmed = currentText.trimEnd();
    const lastSpaceIndex = findLastWordBoundary(trimmed);

    let newText: string;
    if (lastSpaceIndex === -1) {
      // No whitespace found, replace entire text with suggestion
      newText = cleanSuggestion + ' ';
    } else {
      // Keep everything up to and including the last whitespace, then add suggestion
      newText = trimmed.substring(0, lastSpaceIndex + 1) + cleanSuggestion + ' ';
    }

    setText(newText);
  };

  if (kbSuggestions.length === 0) {
    return (
      <View style={[styles.container, isRTL && styles.containerRTL]}>
        {onBrowse && (
          <TouchableOpacity
            style={[styles.browseButton, isRTL ? styles.browseButtonLeft : styles.browseButtonRight]}
            onPress={onBrowse}
            activeOpacity={0.7}>
            <MyIcon info={{ name: 'folder-open-outline', type: 'Ionicons', color: colors.primary, size: 27 }} />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // For RTL, reverse the suggestions order so first suggestion appears on the right
  const displaySuggestions = isRTL ? [...kbSuggestions].reverse() : kbSuggestions;

  return (
    <View style={[styles.container, isRTL && styles.containerRTL]}>
      {onBrowse && (
        <TouchableOpacity
          style={[styles.browseButton, isRTL ? styles.browseButtonLeft : styles.browseButtonRight]}
          onPress={onBrowse}
          activeOpacity={0.7}>
          <MyIcon info={{ name: 'folder-open-outline', type: 'Ionicons', color: colors.primary, size: 26 }} />
        </TouchableOpacity>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={[
          styles.scrollContent,
          isRTL && styles.rtlScrollContent,
        ]}>
        {displaySuggestions.map((suggestion, index) => {
          const symbolUrl = symbolUrls.get(suggestion);
          return (
            <TouchableOpacity
              key={`${suggestion}-${index}`}
              style={[
                styles.suggestionButton,
                showSymbols && { minWidth: 85 },
              ]}
              activeOpacity={0.7}
              onPress={() => handleSuggestionPress(suggestion)}
              >
              {showSymbols && symbolUrl && (
                <ImageBackground
                  source={{ uri: symbolUrl }}
                  style={{
                    width: imageSize,
                    height: imageSize,
                    borderRadius: 4,
                    marginBottom: 2,
                    overflow: 'hidden',
                  }}
                  resizeMode="contain"
                />
              )}
              <Text
                style={[
                  styles.suggestionText,
                  { fontSize },
                  isMobile && { fontSize: fontSize * 0.8, lineHeight: 12 },
                ]}
                numberOfLines={1}>
                {suggestion}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  containerRTL: {
    alignItems: 'flex-end',
  },
  browseButton: {
    position: 'absolute',
    top: 4,
    zIndex: 10,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  browseButtonRight: {
    right: 8,
  },
  browseButtonLeft: {
    left: 8,
  },
  scrollContent: {
    paddingHorizontal: sizes.spacing.sm,
    gap: sizes.spacing.sm,
    alignItems: 'flex-end',
    flexDirection: 'row',
  },
  rtlScrollContent: {
    justifyContent: 'flex-end',
  },
  suggestionButton: {
    minWidth: 60,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  suggestionText: {
    color: colors.primary,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default SuggestionsBar;
