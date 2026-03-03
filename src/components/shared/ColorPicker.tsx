import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import WheelColorPicker from 'react-native-wheel-color-picker';
import { customColorsManager } from '../../utils/customColorsManager';

// Special value for system default
export const SYSTEM_DEFAULT_COLOR = '';

// Basic vibrant colors (no pastels)
const DEFAULT_PRESETS = [
  '#FFFFFF', // White
  '#000000', // Black
  '#808080', // Gray
  '#C0C0C0', // Light Gray
  '#404040', // Dark Gray
  '#FF0000', // Red (pure)
  '#00FF00', // Green (pure)
  '#0000FF', // Blue (pure)
  '#FFFF00', // Yellow (pure)
  '#FF00FF', // Magenta (pure)
  '#00FFFF', // Cyan (pure)
  '#FF8000', // Orange
  '#8000FF', // Purple
  '#0080FF', // Sky Blue
  '#FF0080', // Hot Pink
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  presets?: string[];
  allowCustom?: boolean;
  label?: string;
  showSystemDefault?: boolean;
  systemDefaultLabel?: string;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  allowCustom = true,
  label,
  showSystemDefault = false,
  systemDefaultLabel = 'Default',
}) => {
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customColor, setCustomColor] = useState(value);
  const [customColors, setCustomColors] = useState<string[]>([]);

  // Load custom colors on mount
  useEffect(() => {
    loadCustomColors();
  }, []);

  const loadCustomColors = async () => {
    const colors = await customColorsManager.getCustomColors();
    setCustomColors(colors);
  };

  const handlePresetSelect = (color: string) => {
    onChange(color);
  };

  const handleSystemDefault = () => {
    onChange(SYSTEM_DEFAULT_COLOR);
  };

  const handleCustomSubmit = async () => {
    // Validate hex color
    const isValidHex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(customColor);
    if (isValidHex) {
      const normalizedColor = customColor.toUpperCase();
      onChange(normalizedColor);

      // Add to custom colors
      await customColorsManager.addCustomColor(normalizedColor);
      await loadCustomColors(); // Reload to show new color

      setShowCustomModal(false);
    }
  };

  const isSelected = (color: string) => 
    value.toUpperCase() === color.toUpperCase();

  const isSystemDefaultSelected = value === SYSTEM_DEFAULT_COLOR || value === '';

  return (
    <View style={styles.container}>
      {label && <Text allowFontScaling={false} style={styles.label}>{label}</Text>}

      <View style={styles.presetsRow}>
        {/* System Default Button */}
        {showSystemDefault && (
          <TouchableOpacity
            style={[
              styles.systemDefaultButton,
              isSystemDefaultSelected && styles.selectedCircle,
            ]}
            onPress={handleSystemDefault}
            accessibilityLabel={`Select ${systemDefaultLabel}`}
            accessibilityRole="button"
          >
            <Text allowFontScaling={false} style={[
              styles.systemDefaultText,
              isSystemDefaultSelected && styles.systemDefaultTextSelected,
            ]}>
              {systemDefaultLabel}
            </Text>
          </TouchableOpacity>
        )}

        {/* Preset Colors */}
        {presets.map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorCircle,
              { backgroundColor: color },
              isSelected(color) && styles.selectedCircle,
              color === '#FFFFFF' && styles.whiteBorder,
            ]}
            onPress={() => handlePresetSelect(color)}
            accessibilityLabel={`Select color ${color}`}
            accessibilityRole="button"
          >
            {isSelected(color) && (
              <View style={[
                styles.checkmark,
                { borderColor: color === '#FFFFFF' || color === '#FFEB3B' ? '#000' : '#FFF' }
              ]} />
            )}
          </TouchableOpacity>
        ))}

        {/* Custom Colors (FIFO - most recent shown) - appear after presets */}
        {customColors.map((color) => (
          <TouchableOpacity
            key={`custom-${color}`}
            style={[
              styles.colorCircle,
              { backgroundColor: color },
              isSelected(color) && styles.selectedCircle,
              color === '#FFFFFF' && styles.whiteBorder,
            ]}
            onPress={() => handlePresetSelect(color)}
            accessibilityLabel={`Select custom color ${color}`}
            accessibilityRole="button"
          >
            {isSelected(color) && (
              <View style={[
                styles.checkmark,
                { borderColor: color === '#FFFFFF' || color === '#FFEB3B' ? '#000' : '#FFF' }
              ]} />
            )}
          </TouchableOpacity>
        ))}

        {allowCustom && (
          <TouchableOpacity
            style={[styles.colorCircle, styles.customButton]}
            onPress={() => {
              setCustomColor(value || '#FF5733');
              setShowCustomModal(true);
            }}
            accessibilityLabel="Select custom color with color wheel"
            accessibilityRole="button"
          >
            <Text allowFontScaling={false} style={styles.customButtonText}>+</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Color Wheel Modal */}
      <Modal
        visible={showCustomModal}
        transparent
        animationType="fade"
        supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
        onRequestClose={() => setShowCustomModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowCustomModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <Text allowFontScaling={false} style={styles.modalTitle}>Pick a Color</Text>

            <ScrollView contentContainerStyle={styles.scrollContent}>
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
                <View style={[styles.previewSwatch, { backgroundColor: customColor }]} />
                <Text allowFontScaling={false} style={styles.hexText}>{customColor.toUpperCase()}</Text>
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowCustomModal(false)}
              >
                <Text allowFontScaling={false} style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.applyButton]}
                onPress={handleCustomSubmit}
              >
                <Text allowFontScaling={false} style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCircle: {
    borderWidth: 3,
    borderColor: '#2196F3',
  },
  whiteBorder: {
    borderWidth: 1,
    borderColor: '#DDD',
  },
  checkmark: {
    width: 12,
    height: 6,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '-45deg' }],
  },
  customButton: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#DDD',
    borderStyle: 'dashed',
  },
  customButtonText: {
    fontSize: 20,
    color: '#666',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  scrollContent: {
    alignItems: 'center',
  },
  colorWheelContainer: {
    width: '100%',
    aspectRatio: 1,
    maxWidth: 300,
    marginBottom: 20,
  },
  colorWheel: {
    width: '100%',
    height: '100%',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  previewSwatch: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  hexText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#666',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  applyButton: {
    backgroundColor: '#2196F3',
  },
  applyButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  systemDefaultButton: {
    minWidth: 60,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#CCC',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  systemDefaultText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  systemDefaultTextSelected: {
    color: '#2196F3',
  },
});

export default ColorPicker;