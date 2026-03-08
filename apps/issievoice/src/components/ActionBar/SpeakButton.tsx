import React from 'react';
import { TouchableOpacity, Text, StyleSheet, DimensionValue, ViewStyle } from 'react-native';
import { colors, sizes } from '../../constants';
import { useLocalization } from '../../context/LocalizationContext';

interface IVButtonProps {
  onPress: () => void;
  caption: string;
  icon?: string;
  height?: DimensionValue | undefined
  width?: DimensionValue | undefined;
  style?: ViewStyle
}

export const IVButton: React.FC<IVButtonProps> = ({
  onPress,
  caption,
  icon,
  height = "100%",
  width = 120,
  style
}) => {

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { height, width },
        style
      ]}
      onPress={onPress}
      disabled={false}
      activeOpacity={0.7}>
      {icon && (
        <Text style={styles.iconText}>{icon}</Text>
      )}
      <Text style={[styles.speakButtonText, icon && { fontSize: 24 }]}>
        {caption}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: sizes.borderRadius.medium,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    paddingBottom: 4,
    marginHorizontal: 8,
  },
  iconText: {
    fontSize: 70,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  speakButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 55,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
});

