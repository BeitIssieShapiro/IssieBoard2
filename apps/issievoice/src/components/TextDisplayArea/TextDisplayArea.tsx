import React, {useRef, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import {colors, sizes} from '../../constants';

interface TextDisplayAreaProps {
  text: string;
}

const TextDisplayArea: React.FC<TextDisplayAreaProps> = ({text}) => {
  const scrollViewRef = useRef<ScrollView>(null);

  // Log whenever text prop changes
  useEffect(() => {
    console.log('📺 TextDisplayArea received text:', text, 'length:', text.length);
  }, [text]);

  // Auto-scroll to bottom when text changes
  useEffect(() => {
    if (scrollViewRef.current && text.length > 0) {
      scrollViewRef.current.scrollToEnd({animated: true});
    }
  }, [text]);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        bounces={true}>
        {text.length > 0 ? (
          <Text style={styles.text}>{text}</Text>
        ) : (
          <Text style={styles.placeholder}>
            Start typing to compose your message...
          </Text>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: sizes.textDisplay,
    backgroundColor: colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: sizes.spacing.md,
    minHeight: sizes.textDisplay,
    justifyContent: 'center',
  },
  text: {
    fontSize: sizes.fontSize.large,
    color: colors.text,
    lineHeight: sizes.fontSize.large * 1.5,
  },
  placeholder: {
    fontSize: sizes.fontSize.medium,
    color: colors.textLight,
    fontStyle: 'italic',
  },
});

export default TextDisplayArea;