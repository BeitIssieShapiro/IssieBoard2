import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {useText} from '../../context/TextContext';
import {colors, sizes} from '../../constants';

interface SuggestionsBarProps {
  currentText: string;
  kbSuggestions?: string[];
  language?: 'en' | 'he';
  onSuggestionPress?: (suggestion: string) => void;
  height?: number; // Optional responsive height
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
  height = 70, // Default height
}) => {
  // Determine text direction based on language
  const isRTL = language === 'he';
  const {setText} = useText();

  // Calculate responsive button height and font size
  const buttonHeight = Math.max(30, height - 10); // Leave 10px for padding
  const fontSize = Math.max(20, buttonHeight * 0.5); // Font size ~50% of button height (increased from 35%)

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
    // Instead of returning null, return an empty bar with the same height
    return <View style={[styles.container, {height}]} />;
  }

  // For RTL, reverse the suggestions order so first suggestion appears on the right
  const displaySuggestions = isRTL ? [...kbSuggestions].reverse() : kbSuggestions;

  return (
    <View style={[styles.container, {height}, isRTL && styles.containerRTL]}>
      <ScrollView
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          isRTL && styles.rtlScrollContent
        ]}>
        {displaySuggestions.map((suggestion, index) => (
          <TouchableOpacity
            key={`${suggestion}-${index}`}
            style={[styles.suggestionButton, {height: buttonHeight}]}
            onPress={() => handleSuggestionPress(suggestion)}
            activeOpacity={0.7}>
            <Text style={[styles.suggestionText, {fontSize}]} numberOfLines={1}>
              {suggestion}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceDark,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  containerRTL: {
    // Align scroll view to the right for RTL
    alignItems: 'flex-end',
  },
  scrollContent: {
    paddingHorizontal: sizes.spacing.md,
    paddingVertical: sizes.spacing.sm,
    gap: sizes.spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
  },
  rtlScrollContent: {
    // Keep row direction but justify content to end for RTL
    justifyContent: 'flex-end',
  },
  suggestionButton: {
    minWidth: 100,
    paddingHorizontal: sizes.spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: sizes.borderRadius.large,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  suggestionText: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default SuggestionsBar;
