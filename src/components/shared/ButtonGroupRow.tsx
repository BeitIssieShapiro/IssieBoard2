import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';

export interface ButtonOption {
  id: string;
  label: string;
  customStyle?: any; // For font family, etc.
}

interface ButtonGroupRowProps {
  title: string;
  options: ButtonOption[];
  selectedId: string;
  onSelect: (id: string) => void;
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
}) => {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 700;

  return (
    <View style={[styles.container, isSmallScreen && styles.containerSmall]}>
      <Text allowFontScaling={false} style={styles.title}>{title}</Text>
      <View style={styles.buttonGroup}>
        {options.map(option => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.button,
              selectedId === option.id && styles.buttonActive,
            ]}
            onPress={() => onSelect(option.id)}
          >
            <Text
              allowFontScaling={false}
              style={[
                styles.buttonText,
                option.customStyle,
                selectedId === option.id && styles.buttonTextActive,
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
    justifyContent: 'space-between',
    marginBottom: 20,
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
    flex: 1,
  },
  buttonGroup: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 4,
    gap: 4,
    alignSelf: 'flex-start',
    flexWrap: 'wrap', // Allow buttons to wrap to next line if needed
  },
  button: {
    paddingHorizontal: 12,  // Reduced from 16
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,  // Reduced from 80 to fit more buttons
  },
  buttonActive: {
    backgroundColor: '#3B82F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  buttonTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
});

export default ButtonGroupRow;