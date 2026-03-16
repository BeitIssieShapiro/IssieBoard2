import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';

// v1's color palette (30 colors matching the old ColorUtility grid)
const V1_COLORS = [
    '#800080', '#4B0082', '#8B00FF', '#DDA0DD', '#FF00FF', '#7B68EE',
    '#0000FF', '#000080', '#0066FF', '#00FFFF', '#87CEEB', '#98FFE0',
    '#006400', '#00FF00', '#00FF00', '#FFFF00', '#F0E68C', '#FFA500',
    '#FF8C00', '#FF0000', '#8B0000', '#808000', '#D2B48C', '#FFDAB9',
    '#FFB6C1', '#FFFFFF', '#C0C0C0', '#808080', '#696969', '#000000',
];

interface ClassicColorPickerProps {
    currentColor: string;
    onColorSelected: (color: string) => void;
}

const ClassicColorPicker: React.FC<ClassicColorPickerProps> = ({
    currentColor,
    onColorSelected,
}) => {
    return (
        <View style={styles.container}>
            {/* Current color strip */}
            <View style={[styles.currentColorStrip, { backgroundColor: currentColor }]} />

            {/* Color grid */}
            <View style={styles.grid}>
                {V1_COLORS.map((color, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[
                            styles.colorCircle,
                            { backgroundColor: color },
                            color.toUpperCase() === currentColor?.toUpperCase() && styles.selectedCircle,
                            color === '#FFFFFF' && styles.whiteCircle,
                        ]}
                        onPress={() => onColorSelected(color)}
                    />
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
    },
    currentColorStrip: {
        height: 44,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#000',
        marginBottom: 16,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 12,
    },
    colorCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    selectedCircle: {
        borderWidth: 3,
        borderColor: '#007AFF',
    },
    whiteCircle: {
        borderWidth: 1,
        borderColor: '#CCC',
    },
});

export default ClassicColorPicker;
