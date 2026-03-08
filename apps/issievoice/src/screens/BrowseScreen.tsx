import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';

import {useText} from '../context/TextContext';
import {useTTS} from '../context/TTSContext';
import {useLocalization} from '../context/LocalizationContext';
import {useNotification} from '../context/NotificationContext';
import SavedSentencesManager, {
  SavedSentence,
} from '../services/SavedSentencesManager';
import FavoritesManager, {Favorite} from '../services/FavoritesManager';
import {colors, sizes} from '../constants';
import EmojiPicker, { en, he } from 'rn-emoji-keyboard';
import { SafeAreaView, useSafeAreaFrame } from 'react-native-safe-area-context';

interface BrowseScreenProps {
  navigation: any;
  route?: {
    params?: {
      mode?: 'browse' | 'select';
    };
  };
}

const BrowseScreen: React.FC<BrowseScreenProps> = ({navigation, route}) => {
  const mode = route?.params?.mode || 'browse';
  const [sentences, setSentences] = useState<SavedSentence[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSentences, setFilteredSentences] = useState<SavedSentence[]>(
    [],
  );
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoritesMap, setFavoritesMap] = useState<Map<string, Favorite>>(new Map());
  const [editingFavorite, setEditingFavorite] = useState<SavedSentence | null>(null);
  const [favoriteCaption, setFavoriteCaption] = useState('');
  const [favoriteIcon, setFavoriteIcon] = useState('');
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const {setText, currentText} = useText();
  const {speak} = useTTS();
  const {strings, language} = useLocalization();
  const {showNotification} = useNotification();

  // Get window dimensions using useSafeAreaFrame (works with ScreenSizer)
  const frame = useSafeAreaFrame();

  // Determine if landscape (2 columns) or portrait (1 column)
  // Landscape if width > height
  const isLandscape = frame.width > frame.height;
  const numColumns = isLandscape ? 2 : 1;

  // Debug: log dimension changes
  useEffect(() => {
    console.log(`📐 Layout update: ${frame.width}x${frame.height}, isLandscape: ${isLandscape}, columns: ${numColumns}`);
  }, [frame.width, frame.height, isLandscape, numColumns]);

  useEffect(() => {
    loadSentences();
    loadFavorites(); // Load favorites in both modes
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

  const loadFavorites = async () => {
    const favs = await FavoritesManager.getFavorites();
    setFavoriteIds(new Set(favs.map(f => f.id)));
    // Create a map for quick lookup of favorite details
    const map = new Map<string, Favorite>();
    favs.forEach(f => map.set(f.id, f));
    setFavoritesMap(map);
  };

  const handleSelectForFavorite = async (sentence: SavedSentence) => {
    await FavoritesManager.addFavorite(sentence.id);
    await loadFavorites();
    showNotification('Added to favorites', 'success');
    navigation.goBack();
  };

  const handleEditFavorite = async (sentence: SavedSentence) => {
    const favorite = await FavoritesManager.getFavorite(sentence.id);
    setEditingFavorite(sentence);
    setFavoriteCaption(favorite?.caption || '');
    setFavoriteIcon(favorite?.icon || '');
  };

  const handleSaveFavorite = async () => {
    if (!editingFavorite) return;

    const isAlreadyFavorite = favoriteIds.has(editingFavorite.id);

    if (isAlreadyFavorite) {
      await FavoritesManager.updateFavorite(
        editingFavorite.id,
        favoriteCaption.trim() || undefined,
        favoriteIcon.trim() || undefined
      );
      showNotification('Favorite updated', 'success');
    } else {
      await FavoritesManager.addFavorite(
        editingFavorite.id,
        favoriteCaption.trim() || undefined,
        favoriteIcon.trim() || undefined
      );
      await loadFavorites();
      showNotification('Added to favorites', 'success');
    }

    setEditingFavorite(null);
    setFavoriteCaption('');
    setFavoriteIcon('');

    // Go back to main screen after saving
    navigation.goBack();
  };

  const handleCancelEdit = () => {
    setEditingFavorite(null);
    setFavoriteCaption('');
    setFavoriteIcon('');
  };

  const handleEmojiPick = (emoji: any) => {
    console.log('🎯 Emoji picked:', emoji.emoji);
    setFavoriteIcon(emoji.emoji);
    setIsEmojiPickerOpen(false);
    // Don't need to do anything else - edit modal will reappear
  };

  const handleReplaceText = (sentence: SavedSentence) => {
    setText(sentence.text);
    navigation.goBack();
  };

  const handleInsertText = (sentence: SavedSentence) => {
    // Insert at the end of current text with space before and after
    const spaceBefore = currentText && !currentText.endsWith(' ') ? ' ' : '';
    const spaceAfter = ' ';
    const newText = currentText + spaceBefore + sentence.text + spaceAfter;
    setText(newText);
    navigation.goBack();
  };

  const handleSpeakPress = async (sentence: SavedSentence) => {
    await speak(sentence.text);
  };

  const handleDeletePress = (sentence: SavedSentence) => {
    Alert.alert(
      strings.deleteText,
      `${strings.deleteConfirm} "${sentence.text.substring(0, 30)}..."?`,
      [
        {text: strings.cancel, style: 'cancel'},
        {
          text: strings.delete,
          style: 'destructive',
          onPress: async () => {
            await SavedSentencesManager.deleteSentence(sentence.id);
            await loadSentences();
            showNotification(strings.deleted, 'success');
          },
        },
      ],
    );
  };

  const getFirstWord = (text: string): string => {
    return text.trim().split(/\s+/)[0] || text.substring(0, 15);
  };

  const renderSentenceItem = ({item}: {item: SavedSentence}) => {
    const isAlreadyFavorite = favoriteIds.has(item.id);
    const favoriteData = favoritesMap.get(item.id);
    const hasCustomFavorite = favoriteData && (favoriteData.icon || favoriteData.caption);

    return (
      <View style={[styles.sentenceItem, isLandscape && styles.sentenceItemLandscape]}>
        <TouchableOpacity
          style={styles.sentenceTextContainer}
          onPress={() => mode === 'select' ? handleEditFavorite(item) : handleReplaceText(item)}
          activeOpacity={0.7}>

          {/* Show favorite icon/caption prominently if it exists */}
          {hasCustomFavorite && (
            <View style={styles.favoriteHeaderContainer}>
              {favoriteData.icon && (
                <Text style={styles.favoriteHeaderIcon}>{favoriteData.icon}</Text>
              )}
              <Text style={styles.favoriteHeaderText}>
                {favoriteData.caption || getFirstWord(item.text)}
              </Text>
            </View>
          )}

          {/* Full sentence text */}
          <Text style={[
            styles.sentenceText,
            hasCustomFavorite && styles.sentenceTextSecondary
          ]} numberOfLines={2}>
            {item.text}
          </Text>
          {item.category && (
            <Text style={styles.categoryText}>{item.category}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.actionButtons}>
          {mode === 'select' ? (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.addFavoriteButton, isAlreadyFavorite && styles.addFavoriteButtonDisabled]}
                onPress={() => handleSelectForFavorite(item)}
                activeOpacity={0.7}
                disabled={isAlreadyFavorite}>
                <Text style={styles.actionButtonText}>
                  {isAlreadyFavorite ? '✓' : '⭐'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.editFavoriteButton]}
                onPress={() => handleEditFavorite(item)}
                activeOpacity={0.7}>
                <Text style={styles.actionButtonText}>✏️⭐</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
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
                style={[styles.actionButton, styles.addFavoriteButton, isAlreadyFavorite && styles.addFavoriteButtonDisabled]}
                onPress={() => handleEditFavorite(item)}
                activeOpacity={0.7}>
                <Text style={styles.actionButtonText}>
                  {isAlreadyFavorite ? '⭐' : '⭐'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => handleDeletePress(item)}
                activeOpacity={0.7}>
                <Text style={styles.actionButtonText}>🗑️</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  const handleClearAll = () => {
    if (sentences.length === 0) return;

    Alert.alert(
      strings.clearAll,
      `${strings.clearAllConfirm} (${sentences.length})`,
      [
        {text: strings.cancel, style: 'cancel'},
        {
          text: strings.delete,
          style: 'destructive',
          onPress: async () => {
            await SavedSentencesManager.clearAll();
            await loadSentences();
            showNotification(strings.allDeleted, 'success');
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <Text style={styles.backButtonText}>{strings.back}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {mode === 'select' ? 'Select Favorite' : strings.savedSentences}
        </Text>
        {mode === 'browse' && (
          <TouchableOpacity
            style={styles.clearAllButton}
            onPress={handleClearAll}
            disabled={sentences.length === 0}
            activeOpacity={0.7}>
            <Text
              style={[
                styles.clearAllButtonText,
                sentences.length === 0 && styles.clearAllButtonTextDisabled,
              ]}>
              {strings.clearAll}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={strings.searchSentences}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Sentences List */}
      {filteredSentences.length > 0 ? (
        <FlatList
          key={numColumns} // Force re-render when numColumns changes
          data={filteredSentences}
          renderItem={renderSentenceItem}
          keyExtractor={item => item.id}
          numColumns={numColumns}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={isLandscape ? styles.columnWrapper : undefined}
          showsVerticalScrollIndicator={true}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {searchQuery
              ? strings.noMatchingSearch
              : strings.noSavedSentences}
          </Text>
          <Text style={styles.emptySubtext}>
            {searchQuery
              ? strings.tryDifferentSearch
              : strings.noSavedSentencesSubtext}
          </Text>
        </View>
      )}

      {/* Edit Favorite Overlay (not a real modal) */}
      {editingFavorite !== null && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalOverlayTouchable}
            activeOpacity={1}
            onPress={handleCancelEdit}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalKeyboardView}>
              <ScrollView
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                bounces={false}>
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={(e) => e.stopPropagation()}>
                  <View style={styles.editModalContent}>
                    <Text style={styles.editModalTitle}>
                      Customize Favorite
                    </Text>

                    {/* Caption Input */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Caption</Text>
                      <TextInput
                        style={styles.textInputField}
                        value={favoriteCaption}
                        onChangeText={setFavoriteCaption}
                        placeholder="Leave empty for first word"
                        placeholderTextColor={colors.textLight}
                        maxLength={20}
                      />
                      <Text style={styles.inputHint}>
                        Short text shown on button
                      </Text>
                    </View>

                    {/* Icon Input */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Icon</Text>
                      <TouchableOpacity
                        style={styles.iconPreviewButton}
                        onPress={() => {
                          console.log('🎯 Icon preview button pressed');
                          setIsEmojiPickerOpen(true);
                          console.log('🎯 Emoji picker state set to true');
                        }}
                        activeOpacity={0.7}>
                        <Text style={styles.iconPreviewText}>
                          {favoriteIcon || '+'}
                        </Text>
                      </TouchableOpacity>
                      <Text style={styles.inputHint}>
                        Tap to select emoji
                      </Text>
                    </View>

                    {/* Buttons */}
                    <View style={styles.editModalButtons}>
                      <TouchableOpacity
                        style={[styles.editModalButton, styles.cancelButton]}
                        onPress={handleCancelEdit}
                        activeOpacity={0.7}>
                        <Text style={styles.editModalButtonText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.editModalButton, styles.saveButton]}
                        onPress={handleSaveFavorite}
                        activeOpacity={0.7}>
                        <Text style={styles.editModalButtonText}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </View>
      )}

      {/* Emoji Picker */}
      <EmojiPicker
        onEmojiSelected={handleEmojiPick}
        open={isEmojiPickerOpen}
        onClose={() => {
          console.log('🎯 Emoji picker closing');
          setIsEmojiPickerOpen(false);
        }}
        allowMultipleSelections={false}
        emojiSize={48}
        defaultHeight="50%"
        enableSearchBar={true}
        enableSearchAnimation={true}
        enableRecentlyUsed
        categoryPosition="top"
        translation={language === 'he' ? he : en}
        styles={{
          category: {
            icon: { width: 50 },
            container: {
              padding: 10,
              minWidth: "50%",
              minHeight: 25,
            },
          },
        }}
      />
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
    justifyContent: 'space-between',
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
    flex: 1,
    textAlign: 'center',
  },
  clearAllButton: {
    paddingLeft: sizes.spacing.md,
  },
  clearAllButtonText: {
    fontSize: sizes.fontSize.medium,
    color: colors.error,
    fontWeight: '600',
  },
  clearAllButtonTextDisabled: {
    color: colors.textLight,
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
  columnWrapper: {
    gap: sizes.spacing.md,
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
  sentenceItemLandscape: {
    flex: 1,
    maxWidth: '48%', // Ensure item doesn't exceed half width in 2-column layout
  },
  favoriteHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: sizes.spacing.xs,
  },
  favoriteHeaderIcon: {
    fontSize: 28,
    marginRight: sizes.spacing.xs,
  },
  favoriteHeaderText: {
    fontSize: sizes.fontSize.large,
    fontWeight: '700',
    color: colors.primary,
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
  sentenceTextSecondary: {
    fontSize: sizes.fontSize.small,
    color: colors.textSecondary,
  },
  sentenceTextDisabled: {
    color: colors.textLight,
    opacity: 0.5,
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
  addFavoriteButton: {
    backgroundColor: '#FFB300', // Amber for add to favorites
    width: sizes.touchTarget.medium,
  },
  addFavoriteButtonDisabled: {
    backgroundColor: colors.success,
    opacity: 0.6,
  },
  editFavoriteButton: {
    backgroundColor: '#9C27B0', // Purple for edit
    width: sizes.touchTarget.medium,
  },
  selectButton: {
    backgroundColor: '#FFB300', // Amber for select/favorite
    width: sizes.touchTarget.medium,
  },
  selectButtonDisabled: {
    backgroundColor: colors.success,
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: sizes.fontSize.large,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  modalOverlayTouchable: {
    flex: 1,
  },
  modalKeyboardView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: sizes.spacing.xl,
    paddingHorizontal: sizes.spacing.lg,
    minHeight: '100%',
  },
  editModalContent: {
    width: '100%',
    maxWidth: 500,
    minWidth: 300,
    backgroundColor: colors.surface,
    borderRadius: sizes.borderRadius.large,
    padding: sizes.spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    alignSelf: 'center',
  },
  editModalTitle: {
    fontSize: sizes.fontSize.xlarge,
    fontWeight: 'bold',
    marginBottom: sizes.spacing.lg,
    textAlign: 'center',
    color: colors.text,
  },
  inputGroup: {
    marginBottom: sizes.spacing.lg,
  },
  inputLabel: {
    fontSize: sizes.fontSize.medium,
    fontWeight: '600',
    marginBottom: sizes.spacing.xs,
    color: colors.text,
  },
  textInputField: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: sizes.borderRadius.medium,
    padding: sizes.spacing.md,
    fontSize: sizes.fontSize.medium,
    color: colors.text,
  },
  iconPreviewButton: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: sizes.borderRadius.medium,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  iconPreviewText: {
    fontSize: 48,
    color: colors.primary,
  },
  inputHint: {
    fontSize: sizes.fontSize.small,
    color: colors.textLight,
    marginTop: sizes.spacing.xs,
    textAlign: 'center',
  },
  editModalButtons: {
    flexDirection: 'row',
    gap: sizes.spacing.md,
    marginTop: sizes.spacing.md,
  },
  editModalButton: {
    flex: 1,
    padding: sizes.spacing.md,
    borderRadius: sizes.borderRadius.medium,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.textLight,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  editModalButtonText: {
    color: '#FFFFFF',
    fontSize: sizes.fontSize.medium,
    fontWeight: '600',
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