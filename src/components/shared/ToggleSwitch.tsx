import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  Animated,
} from 'react-native';

interface ToggleSwitchProps {
  value: boolean;
  onChange: (value: boolean) => void;
  labelOn?: string;
  labelOff?: string;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  value,
  onChange,
  labelOn = 'On',
  labelOff = 'Off',
  disabled = false,
  size = 'medium',
}) => {
  const dimensions = {
    small: { track: { width: 40, height: 24 }, thumb: 18, padding: 3 },
    medium: { track: { width: 52, height: 32 }, thumb: 24, padding: 4 },
    large: { track: { width: 64, height: 40 }, thumb: 32, padding: 4 },
  }[size];

  const thumbPosition = value 
    ? dimensions.track.width - dimensions.thumb - dimensions.padding 
    : dimensions.padding;

  return (
    <View style={styles.container}>
      <Text style={[
        styles.label,
        styles.labelOff,
        !value && styles.activeLabel,
        disabled && styles.disabledText,
      ]}>
        {labelOff}
      </Text>
      
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => !disabled && onChange(!value)}
        disabled={disabled}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled }}
        accessibilityLabel={`Toggle ${value ? labelOn : labelOff}`}
      >
        <View style={[
          styles.track,
          {
            width: dimensions.track.width,
            height: dimensions.track.height,
            borderRadius: dimensions.track.height / 2,
          },
          value ? styles.trackOn : styles.trackOff,
          disabled && styles.trackDisabled,
        ]}>
          <View style={[
            styles.thumb,
            {
              width: dimensions.thumb,
              height: dimensions.thumb,
              borderRadius: dimensions.thumb / 2,
              left: thumbPosition,
            },
            disabled && styles.thumbDisabled,
          ]} />
        </View>
      </TouchableOpacity>
      
      <Text style={[
        styles.label,
        styles.labelOn,
        value && styles.activeLabel,
        disabled && styles.disabledText,
      ]}>
        {labelOn}
      </Text>
    </View>
  );
};

// Visibility Toggle - specialized for showing/hiding keys
interface VisibilityToggleProps {
  visible: boolean;
  onChange: (visible: boolean) => void;
  disabled?: boolean;
}

export const VisibilityToggle: React.FC<VisibilityToggleProps> = ({
  visible,
  onChange,
  disabled = false,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.visibilityContainer,
        visible ? styles.visibilityVisible : styles.visibilityHidden,
        disabled && styles.visibilityDisabled,
      ]}
      onPress={() => !disabled && onChange(!visible)}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="switch"
      accessibilityState={{ checked: visible, disabled }}
      accessibilityLabel={visible ? 'Key is visible, tap to hide' : 'Key is hidden, tap to show'}
    >
      <View style={styles.visibilityContent}>
        <Text style={styles.visibilityIcon}>{visible ? '👁️' : '👁️‍🗨️'}</Text>
        <Text style={[
          styles.visibilityText,
          visible ? styles.visibilityTextVisible : styles.visibilityTextHidden,
        ]}>
          {visible ? 'Visible' : 'Hidden'}
        </Text>
      </View>
      
      <View style={[
        styles.visibilityIndicator,
        visible ? styles.indicatorVisible : styles.indicatorHidden,
      ]} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    fontSize: 14,
    color: '#999',
  },
  labelOn: {},
  labelOff: {},
  activeLabel: {
    color: '#333',
    fontWeight: '600',
  },
  disabledText: {
    color: '#CCC',
  },
  track: {
    justifyContent: 'center',
  },
  trackOn: {
    backgroundColor: '#4CAF50',
  },
  trackOff: {
    backgroundColor: '#DDD',
  },
  trackDisabled: {
    backgroundColor: '#EEE',
  },
  thumb: {
    position: 'absolute',
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  thumbDisabled: {
    backgroundColor: '#F5F5F5',
  },
  
  // Visibility toggle styles
  visibilityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  visibilityVisible: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  visibilityHidden: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9800',
  },
  visibilityDisabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#DDD',
  },
  visibilityContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  visibilityIcon: {
    fontSize: 24,
  },
  visibilityText: {
    fontSize: 16,
    fontWeight: '600',
  },
  visibilityTextVisible: {
    color: '#2E7D32',
  },
  visibilityTextHidden: {
    color: '#E65100',
  },
  visibilityIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  indicatorVisible: {
    backgroundColor: '#4CAF50',
  },
  indicatorHidden: {
    backgroundColor: '#FF9800',
  },
});

export default ToggleSwitch;