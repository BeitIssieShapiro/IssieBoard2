import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Alert,
} from 'react-native';
import {useText} from '../context/TextContext';
import {useTTS} from '../context/TTSContext';
import SavedSentencesManager, {
  SavedSentence,
} from '../services/SavedSentencesManager';
import {colors, sizes} from '../constants';

interface BrowseScreenProps {
  navigation: any;
}

const BrowseScreen: React.FC<BrowseScreenProps> = ({navigation}) => {
  const [sentences, setSentences] = useState<SavedSentence[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSentences, setFilteredSentences] = useState<SavedSentence[]>(
    [],
  );
  const {setText, currentText} = useText();
  const {speak} = useTTS();

  useEffect(() => {
    loadSentences();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = sentences.filter(
        s =>
          s.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.category &&
            s.category.toLowerCase().includes(searchQuery.toLowerCase())),
      );
      setFilteredSentences(filtered);
    } else {
      setFilteredSentences(sentences);
    }
  }, [searchQuery, sentences]);

  const loadSentences = async () => {
    const saved = await SavedSentencesManager.getSavedSentences();
    setSentences(saved);
    setFilteredSentences(saved);
  };

  const handleReplaceText = (sentence: SavedSentence) => {
    setText(sentence.text);
    navigation.goBack();
  };

  const handleInsertText = (sentence: SavedSentence) => {
    // Insert at the end of current text
    const newText = currentText + (currentText && !currentText.endsWith(' ') ? ' ' : '') + sentence.text;
    setText(newText);
    navigation.goBack();
  };

  const handleSpeakPress = async (sentence: SavedSentence) => {
    await speak(sentence.text);
  };

  const handleDeletePress = (sentence: SavedSentence) => {
    Alert.alert(
      'Delete Sentence',
      `Are you sure you want to delete "${sentence.text.substring(0, 30)}..."?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await SavedSentencesManager.deleteSentence(sentence.id);
            await loadSentences();
          },
        },
      ],
    );
  };

  const renderSentenceItem = ({item}: {item: SavedSentence}) => (
    <View style={styles.sentenceItem}>
      <TouchableOpacity
        style={styles.sentenceTextContainer}
        onPress={() => handleReplaceText(item)}
        activeOpacity={0.7}>
        <Text style={styles.sentenceText} numberOfLines={2}>
          {item.text}
        </Text>
        {item.category && (
          <Text style={styles.categoryText}>{item.category}</Text>
        )}
      </TouchableOpacity>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.insertButton]}
          onPress={() => handleInsertText(item)}
          activeOpacity={0.7}>
          <Text style={styles.actionButtonText}>➕</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.speakButton]}
          onPress={() => handleSpeakPress(item)}
          activeOpacity={0.7}>
          <Text style={styles.actionButtonText}>🗣️</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeletePress(item)}
          activeOpacity={0.7}>
          <Text style={styles.actionButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Sentences</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search sentences..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Sentences List */}
      {filteredSentences.length > 0 ? (
        <FlatList
          data={filteredSentences}
          renderItem={renderSentenceItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={true}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {searchQuery
              ? 'No sentences match your search'
              : 'No saved sentences yet'}
          </Text>
          <Text style={styles.emptySubtext}>
            {searchQuery
              ? 'Try a different search term'
              : 'Save sentences from the main screen to see them here'}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sizes.spacing.md,
    paddingVertical: sizes.spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    paddingRight: sizes.spacing.md,
  },
  backButtonText: {
    fontSize: sizes.fontSize.large,
    color: colors.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: sizes.fontSize.xlarge,
    fontWeight: 'bold',
    color: colors.text,
  },
  searchContainer: {
    paddingHorizontal: sizes.spacing.md,
    paddingVertical: sizes.spacing.sm,
    backgroundColor: colors.surface,
  },
  searchInput: {
    height: sizes.touchTarget.medium,
    backgroundColor: colors.background,
    borderRadius: sizes.borderRadius.medium,
    paddingHorizontal: sizes.spacing.md,
    fontSize: sizes.fontSize.medium,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listContent: {
    padding: sizes.spacing.md,
  },
  sentenceItem: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: sizes.borderRadius.medium,
    marginBottom: sizes.spacing.md,
    padding: sizes.spacing.md,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sentenceTextContainer: {
    flex: 1,
    marginRight: sizes.spacing.sm,
  },
  sentenceText: {
    fontSize: sizes.fontSize.medium,
    color: colors.text,
    marginBottom: sizes.spacing.xs,
  },
  categoryText: {
    fontSize: sizes.fontSize.small,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: sizes.spacing.xs,
  },
  actionButton: {
    width: sizes.touchTarget.small,
    height: sizes.touchTarget.small,
    borderRadius: sizes.borderRadius.small,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insertButton: {
    backgroundColor: '#9C27B0', // Purple for insert
  },
  speakButton: {
    backgroundColor: colors.speak,
  },
  deleteButton: {
    backgroundColor: colors.clear,
  },
  actionButtonText: {
    fontSize: sizes.fontSize.large,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: sizes.spacing.xl,
  },
  emptyText: {
    fontSize: sizes.fontSize.large,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: sizes.spacing.sm,
  },
  emptySubtext: {
    fontSize: sizes.fontSize.medium,
    color: colors.textLight,
    textAlign: 'center',
  },
});

export default BrowseScreen;