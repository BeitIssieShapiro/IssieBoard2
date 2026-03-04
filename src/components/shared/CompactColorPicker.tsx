import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import WheelColorPicker from 'react-native-wheel-color-picker';
import { customColorsManager } from '../../utils/customColorsManager';

// Special value for system default
export const SYSTEM_DEFAULT_COLOR = '';
const colorCircleSize = 50;
// Basic vibrant colors (no pastels)
const DEFAULT_PRESETS = [
  '#FFFFFF', // White
  '#000000', // Black
  '#808080', // Gray
  '#C0C0C0', // Light Gray
  '#404040', // Dark Gray
  '#FF0000', // Red
  '#00FF00', // Green
  '#0000FF', // Blue
  '#FFFF00', // Yellow
  '#FF00FF', // Magenta
  '#00FFFF', // Cyan
  '#FF8000', // Orange
  '#8000FF', // Purple
  '#0080FF', // Sky Blue
  '#FF0080', // Hot Pink
];

interface CompactColorPickerProps {
  title: string;
  value: string;
  onChange: (color: string) => void;
  presets?: string[];
  showSystemDefault?: boolean;
  systemDefaultLabel?: string;
}

export const CompactColorPicker: React.FC<CompactColorPickerProps> = ({
  title,
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  showSystemDefault = false,
  systemDefaultLabel = 'Default',
}) => {
  const [showPopup, setShowPopup] = useState(false);
  const [showColorWheel, setShowColorWheel] = useState(false);
  const [customColor, setCustomColor] = useState(value || '#FF5733');
  const [customColors, setCustomColors] = useState<string[]>([]);
  const [buttonLayout, setButtonLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const buttonRef = useRef<View>(null);

  // Get screen dimensions
  const screenHeight = Dimensions.get('window').height;

  // Load custom colors on mount
  useEffect(() => {
    loadCustomColors();
  }, []);

  const loadCustomColors = async () => {
    const colors = await customColorsManager.getCustomColors();
    setCustomColors(colors);
  };

  const handleButtonPress = () => {
    // Measure button position
    buttonRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
      setButtonLayout({ x: pageX, y: pageY, width, height });
      setShowPopup(true);
    });
  };

  const handleColorSelect = (color: string) => {
    onChange(color);
    setShowPopup(false);
  };

  const handleSystemDefault = () => {
    onChange(SYSTEM_DEFAULT_COLOR);
    setShowPopup(false);
  };

  const handleCustomColorAdd = async () => {
    // Validate hex color
    const isValidHex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(customColor);

    if (isValidHex) {
      const normalizedColor = customColor.toUpperCase();
      onChange(normalizedColor);

      // Add to custom colors
      await customColorsManager.addCustomColor(normalizedColor);
      await loadCustomColors(); // Reload to show new color

      setShowColorWheel(false);
      setShowPopup(false);
    }
  };

  const isSelected = (color: string) =>
    value.toUpperCase() === color.toUpperCase();

  const isSystemDefaultSelected = value === SYSTEM_DEFAULT_COLOR || value === '';

  // Get current color display
  const currentColorDisplay = isSystemDefaultSelected
    ? systemDefaultLabel
    : value || systemDefaultLabel;

  return (
    <View style={[styles.container, !title && styles.containerNoTitle]}>
      {title ? <Text allowFontScaling={false} style={styles.title}>{title}</Text> : null}

      {/* Single Current Color Display - Clickable to open popup */}
      <TouchableOpacity
        ref={buttonRef}
        style={styles.colorDisplay}
        onPress={handleButtonPress}
      >
        {isSystemDefaultSelected ? (
          // Show dashed circle for default (empty, no letter)
          <View style={styles.defaultCircle} />
        ) : (
          // Show current color circle (1.5x larger = 48px)
          <View style={[styles.currentColorLarge, { backgroundColor: value }]}>
            {(value === '#FFFFFF' || value.toUpperCase() === '#FFFFFF') && (
              <View style={styles.whiteBorderLarge} />
            )}
          </View>
        )}
      </TouchableOpacity>

      {/* Floating Color Popup */}
      {showPopup && buttonLayout && (() => {
        const popupHeight = showColorWheel ? 700 : 280;
        const desiredTop = Math.max(20, buttonLayout.y - 220);
        const maxTop = screenHeight - popupHeight - 20; // 20px margin from bottom
        const finalTop = Math.min(desiredTop, maxTop);

        return (
          <Modal
            transparent
            visible={showPopup}
            onRequestClose={() => setShowPopup(false)}
            animationType="fade"
            supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
          >
            <Pressable
              style={styles.overlay}
              onPress={() => setShowPopup(false)}
            >
              <Pressable
                style={[
                  styles.popup,
                  {
                    top: finalTop,
                    left: '10%',
                    width: '80%',
                    maxHeight: popupHeight,
                  },
                ]}
                onPress={(e) => e.stopPropagation()}
              >
              {/* Close Button */}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowColorWheel(false);
                  setShowPopup(false);
                }}
              >
                <Text allowFontScaling={false} style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>

              {/* Color Grid - Always visible */}
              <View style={styles.colorsContainer}>
                <View style={styles.colorGrid}>
                  {/* System Default - First item in grid with label */}
                  {showSystemDefault && (
                    <View style={styles.colorItemWithLabel}>
                      <TouchableOpacity
                        style={[
                          styles.defaultCircleButton,
                          isSystemDefaultSelected && styles.selectedCircle,
                        ]}
                        onPress={handleSystemDefault}
                      >
                        {isSystemDefaultSelected && (
                          <Text allowFontScaling={false} style={styles.checkmarkText}>✓</Text>
                        )}
                      </TouchableOpacity>
                      <Text allowFontScaling={false} style={styles.colorLabel}>{systemDefaultLabel}</Text>
                    </View>
                  )}
                  {presets.map((color) => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: color },
                        isSelected(color) && styles.selectedCircle,
                        color === '#FFFFFF' && styles.whiteCircleBorder,
                      ]}
                      onPress={() => handleColorSelect(color)}
                    >
                      {isSelected(color) && (
                        <Text allowFontScaling={false} style={[
                          styles.checkmarkText,
                          { color: color === '#FFFFFF' || color === '#FFFF00' ? '#000' : '#FFF' }
                        ]}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}

                  {/* Custom Colors */}
                  {customColors.map((color) => (
                    <TouchableOpacity
                      key={`custom-${color}`}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: color },
                        isSelected(color) && styles.selectedCircle,
                      ]}
                      onPress={() => handleColorSelect(color)}
                    >
                      {isSelected(color) && (
                        <Text allowFontScaling={false} style={[
                          styles.checkmarkText,
                          { color: color === '#FFFFFF' ? '#000' : '#FFF' }
                        ]}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}

                  {/* Add Custom Color Button */}
                  <View onStartShouldSetResponder={() => true}>
                    <TouchableOpacity
                      style={styles.addColorCircle}
                      onPress={() => {
                        setCustomColor(value || '#FF5733');
                        setShowColorWheel(true);
                      }}
                    >
                      <Text allowFontScaling={false} style={styles.addColorText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Color Wheel - Shows below grid when + is pressed */}
              {showColorWheel && (
                <>
                  <View style={styles.wheelDivider} />

                  <View style={styles.colorWheelContainer}>
                    <WheelColorPicker
                      color={customColor}
                      onColorChange={(color: string) => setCustomColor(color)}
                      onColorChangeComplete={(color: string) => setCustomColor(color)}
                      thumbSize={30}
                      sliderSize={30}
                      noSnap={true}
                      row={false}
                      swatchesLast={false}
                      swatches={false}
                      discrete={false}
                    />
                  </View>

                  <View style={styles.previewRow}>
                    <Text allowFontScaling={false} style={styles.previewLabel}>Selected Color:</Text>
                    <Pressable style={[styles.previewSwatch, { backgroundColor: customColor }]}
                      onPress={handleCustomColorAdd} />
                    <Text allowFontScaling={false} style={styles.hexText}>{customColor.toUpperCase()}</Text>
                  </View>


                </>
              )}
            </Pressable>
          </Pressable>
        </Modal>
        );
      })()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 8,
  },
  containerNoTitle: {
    justifyContent: 'center',
    marginBottom: 0,
    paddingVertical: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  colorsContainer: {
    marginTop: 40,
    margin: 20,
  },
  colorDisplay: {
    // Container for the single color display
  },
  currentColorLarge: {
    width: 48,  // 1.5x larger (was 32)
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#DDD',
  },
  whiteBorderLarge: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  defaultCircle: {
    width: colorCircleSize,
    height: colorCircleSize,
    borderRadius: colorCircleSize / 2,
    borderWidth: 2,
    borderColor: '#2196F3',
    borderStyle: 'dashed',
    backgroundColor: '#E3F2FD',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  popup: {
    position: 'absolute',
    backgroundColor: '#FFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  popupScroll: {
    maxHeight: 280,
  },
  popupContent: {
    padding: 16,
    paddingTop: 36, // Space for close button
  },
  colorItemWithLabel: {
    alignItems: 'center',
  },
  defaultCircleButton: {
    width: colorCircleSize,
    height: colorCircleSize,
    borderRadius: colorCircleSize / 2,
    borderWidth: 2,
    borderColor: '#2196F3',
    borderStyle: 'dashed',
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  colorLabel: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  colorCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCircle: {
    borderColor: '#2196F3',
    borderWidth: 3,
  },
  whiteCircleBorder: {
    borderColor: '#DDD',
    borderWidth: 1,
  },
  checkmarkText: {
    fontSize: 20,
    fontWeight: 'bold',
    position: 'absolute',
  },
  addColorCircle: {
    width: colorCircleSize,
    height: colorCircleSize,
    borderRadius: colorCircleSize / 2,
    borderWidth: 2,
    borderColor: '#2196F3',
    borderStyle: 'dashed',
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addColorText: {
    fontSize: 24,
    color: '#2196F3',
    fontWeight: '600',
    lineHeight: 26,
  },
  // Color Wheel Inline Styles
  wheelDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 16,
  },
  wheelModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  colorWheelContainer: {
    width: 240,
    height: 240,
    marginBottom: 16,
    alignSelf: 'center',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  previewSwatch: {
    width: colorCircleSize,
    height: colorCircleSize,
    borderRadius: colorCircleSize / 2,
    borderWidth: 2,
    borderColor: '#DDD',
  },
  hexText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'Courier',
  },
  wheelModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  wheelModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  applyButton: {
    backgroundColor: '#4CAF50',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
