import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { KeyboardPreview, KeyPressEvent, HeightChangeEvent } from '../../components/KeyboardPreview';
import { useLocalization } from '../../localization';

interface ClassicDetailViewProps {
    title: string;
    onBack: () => void;
    configJson?: string;
    language?: string;
    selectedKeys?: string;
    onKeyPress?: (event: KeyPressEvent) => void;
    children: React.ReactNode;
}

const ClassicDetailView: React.FC<ClassicDetailViewProps> = ({
    title,
    onBack,
    configJson,
    language,
    selectedKeys,
    onKeyPress,
    children,
}) => {
    const { strings } = useLocalization();
    const [kbHeight, setKbHeight] = useState(250);

    const handleHeightChange = useCallback((event: HeightChangeEvent) => {
        const { height } = event.nativeEvent;
        if (height > 0) setKbHeight(height);
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            {/* Header with back button and title */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={onBack}>
                    <Text allowFontScaling={false} style={styles.backText}>{'<'} {strings.common.back}</Text>
                </TouchableOpacity>
                <Text allowFontScaling={false} style={styles.title}>{title}</Text>
                <View style={styles.spacer} />
            </View>

            {/* Control content */}
            <View style={styles.content}>
                {children}
            </View>

            {/* Keyboard preview - pinned to bottom */}
            {configJson && (
                <View style={styles.previewContainer}>
                    <KeyboardPreview
                        style={[styles.preview, { height: kbHeight }]}
                        configJson={configJson}
                        language={language}
                        selectedKeys={selectedKeys}
                        onKeyPress={onKeyPress}
                        onHeightChange={handleHeightChange}
                    />
                </View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#C6C6C8',
    },
    backButton: {
        paddingRight: 12,
    },
    backText: {
        color: '#007AFF',
        fontSize: 17,
    },
    title: {
        flex: 1,
        fontSize: 17,
        fontWeight: '600',
        textAlign: 'center',
    },
    spacer: {
        width: 60,
    },
    previewContainer: {
        paddingHorizontal: 8,
        paddingBottom: 8,
    },
    preview: {
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#C6C6C8',
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#CBCFD8',
    },
    content: {
        flex: 1,
    },
});

export default ClassicDetailView;
