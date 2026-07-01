import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ColorPicker } from '../../components/shared/ColorPicker';

interface ClassicColorPickerProps {
    currentColor: string;
    onColorSelected: (color: string) => void;
    showSystemDefault?: boolean;
}

const ClassicColorPicker: React.FC<ClassicColorPickerProps> = ({
    currentColor,
    onColorSelected,
    showSystemDefault = false,
}) => {
    return (
        <View style={styles.container}>
            <ColorPicker
                value={currentColor}
                onChange={onColorSelected}
                showSystemDefault={showSystemDefault}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
    },
});

export default ClassicColorPicker;
