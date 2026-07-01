import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { measureText } from 'react-native-text-measure';

export interface ButtonOption {
  id: string;
  label: string;
  customStyle?: any; // For font family, etc.
  disabled?: boolean; // If true, button is grayed out and not tappable
}

interface ButtonGroupRowProps {
  title: string;
  options: ButtonOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  isRTL?: boolean;
}

/**
 * Single-line row with title on left and button group on right
 * Button group has fixed ~200px width, aligned to right
 * On small screens (< 700px), stacks vertically
 */
export const ButtonGroupRow: React.FC<ButtonGroupRowProps> = ({
  title,
  options,
  selectedId,
  onSelect,
  isRTL,
}) => {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 700;
  const [maxWidth, setMaxWidth] = useState(0);

  useEffect(() => {
    const measure = async () => {
      const textStyle = { fontSize: 13, fontWeight: '700' as const };
      let widest = 0;
      for (const option of options) {
        try {
          const result = await measureText(option.label, textStyle);
          widest = Math.max(widest, Math.ceil(result.width));
        } catch {
          // fall back to 0, minWidth: 60 in style handles it
        }
      }
      if (widest > 0) {
        // Add horizontal padding (12 * 2 = 24)
        setMaxWidth(widest + 24);
      }
    };
    measure();
  }, [options]);

  return (
    <View style={[styles.container, isSmallScreen && styles.containerSmall, isRTL && { direction: 'rtl' }]}>
      <Text allowFontScaling={false} style={styles.title}>{title}</Text>
      <View style={styles.buttonGroup}>
        {options.map(option => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.button,
              maxWidth > 0 && { minWidth: maxWidth },
              selectedId === option.id && styles.buttonActive,
              option.disabled && styles.buttonDisabled,
            ]}
            onPress={() => !option.disabled && onSelect(option.id)}
            activeOpacity={option.disabled ? 1 : 0.2}
          >
            <Text
              allowFontScaling={false}
              style={[
                styles.buttonText,
                option.customStyle,
                selectedId === option.id && styles.buttonTextActive,
                option.disabled && styles.buttonTextDisabled,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:"space-between",
    gap: 12,
    marginVertical: 10,
  },
  containerSmall: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  buttonGroup: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 4,
    gap: 4,
    flexWrap: 'wrap',
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  buttonActive: {
    backgroundColor: '#3B82F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  buttonDisabled: {},
  buttonText: {
    fontSize: 13,
    fontWeight: 'semibold',
    color: '#6B7280',
  },
  buttonTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  buttonTextDisabled: {
    color: '#D1D5DB',
  },
});

export default ButtonGroupRow;
