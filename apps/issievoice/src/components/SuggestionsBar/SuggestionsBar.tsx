import React, {useState, useEffect} from 'react';
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
}

const SuggestionsBar: React.FC<SuggestionsBarProps> = ({currentText}) => {
  const {appendText} = useText();
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    // Get word suggestions based on current text
    // For now, using mock suggestions - will integrate with prediction engine later
    const words = currentText.split(' ');
    const lastWord = words[words.length - 1]?.toLowerCase() || '';

    if (lastWord.length === 0) {
      // Suggest common next words
      setSuggestions(['I', 'you', 'please', 'thank', 'can']);
    } else {
      // Mock completion suggestions
      const mockSuggestions = [
        'hello',
        'help',
        'thank you',
        'please',
        'yes',
        'no',
        'water',
        'food',
        'bathroom',
      ].filter(word => word.toLowerCase().startsWith(lastWord));

      setSuggestions(mockSuggestions.slice(0, 5));
    }
  }, [currentText]);

  const handleSuggestionPress = (suggestion: string) => {
    const words = currentText.split(' ');
    const lastWord = words[words.length - 1];

    if (lastWord && lastWord.length > 0) {
      // Replace the last word being typed
      words[words.length - 1] = suggestion;
      const newText = words.join(' ');
      // Use setText from context to replace, then add space
      appendText(suggestion.substring(lastWord.length) + ' ');
    } else {
      // Just append the suggestion
      appendText(suggestion + ' ');
    }
  };

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {suggestions.map((suggestion, index) => (
          <TouchableOpacity
            key={`${suggestion}-${index}`}
            style={styles.suggestionButton}
            onPress={() => handleSuggestionPress(suggestion)}
            activeOpacity={0.7}>
            <Text style={styles.suggestionText}>{suggestion}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: sizes.suggestionButton,
    backgroundColor: colors.surfaceDark,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scrollContent: {
    paddingHorizontal: sizes.spacing.md,
    alignItems: 'center',
    gap: sizes.spacing.sm,
  },
  suggestionButton: {
    height: sizes.touchTarget.small,
    paddingHorizontal: sizes.spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: sizes.borderRadius.medium,
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
    fontSize: sizes.fontSize.medium,
    fontWeight: '500',
  },
});

export default SuggestionsBar;