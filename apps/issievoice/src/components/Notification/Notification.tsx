import React, {useEffect, useState} from 'react';
import {View, Text, StyleSheet, Animated, Dimensions} from 'react-native';
import {colors, sizes} from '../../constants';

export interface NotificationProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onHide?: () => void;
}

const Notification: React.FC<NotificationProps> = ({
  message,
  type = 'success',
  duration = 3000,
  onHide,
}) => {
  const [slideAnim] = useState(new Animated.Value(100));

  useEffect(() => {
    // Slide up animation
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();

    // Auto-hide after duration
    const timer = setTimeout(() => {
      // Slide down animation
      Animated.timing(slideAnim, {
        toValue: 100,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        if (onHide) {
          onHide();
        }
      });
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onHide, slideAnim]);

  const backgroundColor =
    type === 'success'
      ? '#4CAF50'
      : type === 'error'
      ? colors.error
      : colors.primary;

  return (
    <Animated.View
      style={[
        styles.container,
        {backgroundColor, transform: [{translateY: slideAnim}]},
      ]}>
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: sizes.spacing.md,
    paddingBottom: sizes.spacing.lg,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -2},
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 9999,
  },
  message: {
    color: '#FFFFFF',
    fontSize: sizes.fontSize.medium,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default Notification;
