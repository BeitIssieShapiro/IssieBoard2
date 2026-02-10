import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

export interface ActionButtonProps {
  label: string;
  onPress: () => void;
  color: 'green' | 'blue' | 'red' | 'gray';
  disabled?: boolean;
  icon?: string;
}

export const ActionButton: React.FC<ActionButtonProps> = ({ 
  label, 
  onPress, 
  color, 
  disabled,
  icon 
}) => {
  const colorStyles = {
    green: styles.actionButtonGreen,
    blue: styles.actionButtonBlue,
    red: styles.actionButtonRed,
    gray: styles.actionButtonGray,
  };

  return (
    <TouchableOpacity
      style={[styles.actionButton, colorStyles[color], disabled && styles.actionButtonDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      {icon && <Text style={styles.actionButtonIcon}>{icon}</Text>}
      <Text style={styles.actionButtonText}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
    flexDirection: 'row',
    gap: 6,
  },
  actionButtonGreen: {
    backgroundColor: '#4CAF50',
  },
  actionButtonBlue: {
    backgroundColor: '#3B82F6',
  },
  actionButtonRed: {
    backgroundColor: '#F44336',
  },
  actionButtonGray: {
    backgroundColor: '#9E9E9E',
  },
  actionButtonIcon: {
    fontSize: 14,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
});