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
import FavoritesManager from '../services/FavoritesManager';
import {colors, sizes} from '../constants';
import {MyIcon} from '@beitissieshapiro/issie-shared/dist/icons';
import EmojiPicker, { en, he } from 'rn-emoji-keyboard';
import { SafeAreaView, useSafeAreaFrame } from 'react-native-safe-area-context';

interface BrowseScreenProps {
  navigation: any;
}

const BrowseScreen: React.FC<BrowseScreenProps> = ({navigation}) => {
  const [sentences, setSentences] = useState<SavedSentence[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSentences, setFilteredSentences] = useState<SavedSentence[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [editingSentence, setEditingSentence] = useState<SavedSentence | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const {setText, currentText} = useText();
  const {speak} = useTTS();
  const {strings, language, isRTL} = useLocalization();
  const {showNotification} = useNotification();

  // Get window dimensions using useSafeAreaFrame (works with ScreenSizer)
  const frame = useSafeAreaFrame();

  // Determine if landscape (2 columns) or portrait (1 column)
  const isLandscape = frame.width > frame.height;
  const numColumns = isLandscape ? 2 : 1;

  useEffect(() => {
    loadSentences();
    loadFavorites();
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
  };

  const handleToggleFavorite = async (sentence: SavedSentence) => {
    const isNowFavorite = await FavoritesManager.toggleFavorite(sentence.id);
    await loadFavorites();

    if (isNowFavorite) {
      if (!sentence.caption && !sentence.icon) {
        Alert.alert(
          strings.favorites.captionIconPromptTitle,
          strings.favorites.captionIconPromptMessage,
          [
            {text: strings.common.no, style: 'cancel'},
            {
              text: strings.common.yes,
              onPress: () => handleEditCaptionIcon(sentence),
            },
          ],
        );
      }
      showNotification(strings.favorites.addedToFavorites, 'success');
    } else {
      showNotification(strings.favorites.removedFromFavorites, 'success');
    }
  };

  const handleEditCaptionIcon = (sentence: SavedSentence) => {
    setEditingSentence(sentence);
    setEditCaption(sentence.caption || '');
    setEditIcon(sentence.icon || '');
  };

  const handleSaveCaptionIcon = async () => {
    if (!editingSentence) return;

    await SavedSentencesManager.updateSentence(editingSentence.id, {
      caption: editCaption.trim() || undefined,
      icon: editIcon.trim() || undefined,
    });

    setEditingSentence(null);
    setEditCaption('');
    setEditIcon('');
    await loadSentences();
  };

  const handleCancelEdit = () => {
    setEditingSentence(null);
    setEditCaption('');
    setEditIcon('');
  };

  const handleEmojiPick = (emoji: any) => {
    setEditIcon(emoji.emoji);
    setIsEmojiPickerOpen(false);
  };

  const handleReplaceText = (sentence: SavedSentence) => {
    setText(sentence.text);
    navigation.goBack();
  };

  const handleInsertText = (sentence: SavedSentence) => {
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
      strings.browse.deleteText,
      `${strings.browse.deleteConfirm} "${sentence.text.substring(0, 30)}..."?`,
      [
        {text: strings.common.cancel, style: 'cancel'},
        {
          text: strings.common.delete,
          style: 'destructive',
          onPress: async () => {
            await SavedSentencesManager.deleteSentence(sentence.id);
            await loadSentences();
            showNotification(strings.browse.deleted, 'success');
          },
        },
      ],
    );
  };

  const getFirstWord = (text: string): string => {
    return text.trim().split(/\s+/)[0] || text.substring(0, 15);
  };

  const renderSentenceItem = ({item}: {item: SavedSentence}) => {
    const isFavorite = favoriteIds.has(item.id);
    const hasCustomDisplay = item.icon || item.caption;

    return (
      <View style={[styles.sentenceCard, isLandscape && styles.sentenceCardLandscape]}>
        <TouchableOpacity
          style={styles.sentenceTextContainer}
          onPress={() => handleReplaceText(item)}
          activeOpacity={0.7}>

          {hasCustomDisplay ? (
            <View style={styles.favoriteHeaderContainer}>
              {item.icon && (
                <Text style={styles.favoriteHeaderIcon}>{item.icon}</Text>
              )}
              <Text style={styles.favoriteHeaderText} numberOfLines={1}>
                {item.caption || getFirstWord(item.text)}
              </Text>
              <Text style={styles.sentenceTextInline} numberOfLines={1}>
                {item.text}
              </Text>
            </View>
          ) : (
            <Text style={styles.sentenceText} numberOfLines={2}>
              {item.text}
            </Text>
          )}
          {item.category && (
            <Text style={styles.categoryText}>{item.category}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleEditCaptionIcon(item)}
            activeOpacity={0.7}>
            <MyIcon info={{ name: 'create-outline', type: 'Ionicons', color: colors.primary, size: 18 }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleInsertText(item)}
            activeOpacity={0.7}>
            <MyIcon info={{ name: 'add-circle-outline', type: 'Ionicons', color: colors.primary, size: 18 }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSpeak]}
            onPress={() => handleSpeakPress(item)}
            activeOpacity={0.7}>
            <MyIcon info={{ name: 'volume-high-outline', type: 'Ionicons', color: '#FFFFFF', size: 18 }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, isFavorite ? styles.actionBtnFavoriteActive : styles.actionBtnFavorite]}
            onPress={() => handleToggleFavorite(item)}
            activeOpacity={0.7}>
            <MyIcon info={{ name: isFavorite ? 'star' : 'star-outline', type: 'Ionicons', color: isFavorite ? '#FFFFFF' : '#F59E0B', size: 18 }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnDelete]}
            onPress={() => handleDeletePress(item)}
            activeOpacity={0.7}>
            <MyIcon info={{ name: 'trash-outline', type: 'Ionicons', color: colors.error, size: 18 }} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const handleClearAll = () => {
    if (sentences.length === 0) return;

    Alert.alert(
      strings.browse.clearAll,
      `${strings.browse.clearAllConfirm} (${sentences.length})`,
      [
        {text: strings.common.cancel, style: 'cancel'},
        {
          text: strings.common.delete,
          style: 'destructive',
          onPress: async () => {
            await SavedSentencesManager.clearAll();
            await loadSentences();
            showNotification(strings.browse.allDeleted, 'success');
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.container, isRTL && { direction: 'rtl' }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <MyIcon info={{ name: isRTL ? 'arrow-forward' : 'arrow-back', type: 'Ionicons', color: '#FFFFFF', size: 20 }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {strings.browse.savedSentences}
        </Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={[styles.headerButton, sentences.length === 0 && styles.headerButtonDisabled]}
          onPress={handleClearAll}
          disabled={sentences.length === 0}
          activeOpacity={0.7}>
          <MyIcon info={{ name: 'trash-outline', type: 'Ionicons', color: sentences.length === 0 ? colors.textLight : colors.error, size: 16 }} />
          <Text
            style={[
              styles.headerButtonText,
              { color: sentences.length === 0 ? colors.textLight : colors.error },
            ]}>
            {strings.browse.clearAll}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchInputWrapper, isRTL && { direction: 'rtl' }]}>
          <MyIcon info={{ name: 'search', type: 'Ionicons', color: colors.textLight, size: 18 }} />
          <TextInput
            style={[styles.searchInput, isRTL && { textAlign: 'right', writingDirection: 'rtl' }]}
            placeholder={strings.browse.search}
            placeholderTextColor={colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      {/* Sentences List */}
      {filteredSentences.length > 0 ? (
        <FlatList
          key={numColumns}
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
          <MyIcon info={{ name: 'document-text-outline', type: 'Ionicons', color: colors.textLight, size: 48 }} />
          <Text style={styles.emptyText}>
            {searchQuery
              ? strings.browse.noMatchingSearch
              : strings.browse.noSaved}
          </Text>
          <Text style={styles.emptySubtext}>
            {searchQuery
              ? strings.browse.tryDifferentSearch
              : strings.browse.noSavedSubtext}
          </Text>
        </View>
      )}

      {/* Edit Caption/Icon Overlay */}
      {editingSentence !== null && (
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
                      {strings.favorites.editCaptionIcon}
                    </Text>

                    {/* Caption Input */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>{strings.favorites.caption}</Text>
                      <TextInput
                        style={styles.textInputField}
                        value={editCaption}
                        onChangeText={setEditCaption}
                        placeholder={strings.favorites.captionPlaceholder}
                        placeholderTextColor={colors.textLight}
                        maxLength={20}
                      />
                      <Text style={styles.inputHint}>
                        {strings.favorites.captionHint}
                      </Text>
                    </View>

                    {/* Icon Input */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>{strings.favorites.icon}</Text>
                      <TouchableOpacity
                        style={styles.iconPreviewButton}
                        onPress={() => setIsEmojiPickerOpen(true)}
                        activeOpacity={0.7}>
                        <Text style={styles.iconPreviewText}>
                          {editIcon || '+'}
                        </Text>
                      </TouchableOpacity>
                      <Text style={styles.inputHint}>
                        {strings.favorites.iconHint}
                      </Text>
                    </View>

                    {/* Buttons */}
                    <View style={styles.editModalButtons}>
                      <TouchableOpacity
                        style={[styles.editModalButton, styles.cancelButton]}
                        onPress={handleCancelEdit}
                        activeOpacity={0.7}>
                        <Text style={styles.cancelButtonText}>{strings.common.cancel}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.editModalButton, styles.saveButton]}
                        onPress={handleSaveCaptionIcon}
                        activeOpacity={0.7}>
                        <MyIcon info={{ name: 'checkmark', type: 'Ionicons', color: '#FFFFFF', size: 18 }} />
                        <Text style={styles.saveButtonText}>{strings.common.save}</Text>
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
        onClose={() => setIsEmojiPickerOpen(false)}
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
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
    textAlign: 'left',
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  headerButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Search
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    marginHorizontal: 12,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: colors.text,
    textAlign: 'left',
  },
  // List
  listContent: {
    padding: 12,
  },
  columnWrapper: {
    gap: 12,
  },
  // Sentence Card
  sentenceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  sentenceCardLandscape: {
    flex: 1,
    maxWidth: '48%',
  },
  favoriteHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  favoriteHeaderIcon: {
    fontSize: 20,
  },
  favoriteHeaderText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primary,
    flexShrink: 0,
    textAlign: 'left',
  },
  sentenceTextInline: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'left',
  },
  sentenceTextContainer: {
    marginBottom: 12,
  },
  sentenceText: {
    fontSize: 17,
    color: colors.text,
    lineHeight: 24,
    textAlign: 'left',
  },
  categoryText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
    textAlign: 'left',
  },
  // Action Buttons Row
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnSpeak: {
    backgroundColor: colors.speak,
  },
  actionBtnFavorite: {
    backgroundColor: '#FEF3C7',
  },
  actionBtnFavoriteActive: {
    backgroundColor: '#F59E0B',
  },
  actionBtnDelete: {
    backgroundColor: '#FEE2E2',
  },
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: sizes.spacing.xl,
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 15,
    color: colors.textLight,
    textAlign: 'center',
  },
  // Edit Modal
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
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: sizes.spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
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
    borderRadius: 12,
    padding: sizes.spacing.md,
    fontSize: sizes.fontSize.medium,
    color: colors.text,
  },
  iconPreviewButton: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 16,
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
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    padding: sizes.spacing.md,
    borderRadius: 14,
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: sizes.fontSize.medium,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: sizes.fontSize.medium,
    fontWeight: '600',
  },
});

export default BrowseScreen;
