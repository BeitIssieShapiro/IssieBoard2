import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { ColorPicker } from './ColorPicker';

interface ColorPickerRowProps {
  title: string;
  value: string;
  onChange: (color: string) => void;
  presets?: string[];
  allowCustom?: boolean;
  showSystemDefault?: boolean;
  systemDefaultLabel?: string;
}

/**
 * Responsive color picker with title
 * Two layouts:
 * 1. If colors fit on same row as title: "Title [color] [color] [color]..."
 * 2. If not enough room: "Title" on one line, colors on next line(s)
 */
export const ColorPickerRow: React.FC<ColorPickerRowProps> = ({
  title,
  value,
  onChange,
  presets,
  allowCustom = true,
  showSystemDefault = false,
  systemDefaultLabel = 'Default',
}) => {
  return (
    <View style={styles.container}>
      <Text allowFontScaling={false} style={styles.title}>{title}</Text>
      <ColorPicker
        value={value}
        onChange={onChange}
        presets={presets}
        allowCustom={allowCustom}
        showSystemDefault={showSystemDefault}
        systemDefaultLabel={systemDefaultLabel}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
});

export default ColorPickerRow;