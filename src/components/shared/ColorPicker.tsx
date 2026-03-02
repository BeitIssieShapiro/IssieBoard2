import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  Modal,
  TextInput,
  Pressable,
} from 'react-native';

// Special value for system default
export const SYSTEM_DEFAULT_COLOR = '';

// Accessibility-friendly color presets
const DEFAULT_PRESETS = [
  '#FFFFFF', // White
  '#F44336', // Red
  '#E91E63', // Pink
  '#9C27B0', // Purple
  '#3F51B5', // Indigo
  '#2196F3', // Blue
  '#4CAF50', // Green
  '#FFEB3B', // Yellow
  '#FF9800', // Orange
  '#795548', // Brown
  '#607D8B', // Blue Grey
  '#000000', // Black
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

  const handlePresetSelect = (color: string) => {
    onChange(color);
  };

  const handleSystemDefault = () => {
    onChange(SYSTEM_DEFAULT_COLOR);
  };

  const handleCustomSubmit = () => {
    // Validate hex color
    const isValidHex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(customColor);
    if (isValidHex) {
      onChange(customColor.toUpperCase());
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
        
        {allowCustom && (
          <TouchableOpacity
            style={[styles.colorCircle, styles.customButton]}
            onPress={() => {
              setCustomColor(value);
              setShowCustomModal(true);
            }}
            accessibilityLabel="Select custom color"
            accessibilityRole="button"
          >
            <Text allowFontScaling={false} style={styles.customButtonText}>...</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Custom Color Modal */}
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
            <Text allowFontScaling={false} style={styles.modalTitle}>Custom Color</Text>
            
            <View style={styles.customInputRow}>
              <TextInput
                style={styles.customInput}
                value={customColor}
                onChangeText={setCustomColor}
                placeholder="#RRGGBB"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={7}
              />
              <View style={[styles.previewSwatch, { backgroundColor: customColor }]} />
            </View>
            
            <Text allowFontScaling={false} style={styles.hint}>Enter a hex color code (e.g., #FF5733)</Text>
            
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
    fontSize: 16,
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
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: 'monospace',
  },
  previewSwatch: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    marginBottom: 16,
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