import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors, sizes } from '../../constants';
import FavoritesManager, { Favorite } from '../../services/FavoritesManager';
import SavedSentencesManager, { SavedSentence } from '../../services/SavedSentencesManager';
import { useLocalization } from '../../context/LocalizationContext';

interface FavoritesBarProps {
  onFavoritePress: (text: string) => void;
  height: number;
  navigation: any;
  onEditModeChange?: (isEditMode: boolean) => void;
  reloadTrigger?: number;
  screenWidth?: number;
}

const FavoritesBar: React.FC<FavoritesBarProps> = ({ onFavoritePress, height, navigation, onEditModeChange, reloadTrigger, screenWidth = 1000 }) => {
  const [favorites, setFavorites] = useState<{ favorite: Favorite; sentence: SavedSentence }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { strings } = useLocalization();

  // Determine if we're on mobile (portrait mode with small width)
  const isMobile = screenWidth < 600;

  // Notify parent when selection state changes
  useEffect(() => {
    onEditModeChange?.(selectedId !== null);
  }, [selectedId, onEditModeChange]);

  useEffect(() => {
    loadFavorites();
  }, []);

  // Reload when reloadTrigger changes
  useEffect(() => {
    if (reloadTrigger !== undefined) {
      console.log('🔄 Reload trigger changed - reloading favorites');
      loadFavorites();
    }
  }, [reloadTrigger]);

  const loadFavorites = async () => {
    const favs = await FavoritesManager.getFavorites();
    const sentences = await SavedSentencesManager.getSavedSentences();

    // Match favorites with their sentences
    const matched = favs
      .map(fav => {
        const sentence = sentences.find(s => s.id === fav.id);
        return sentence ? { favorite: fav, sentence } : null;
      })
      .filter(Boolean) as { favorite: Favorite; sentence: SavedSentence }[];

    // Sort by order
    matched.sort((a, b) => a.favorite.order - b.favorite.order);

    setFavorites(matched);
  };

  const handleAddPress = async () => {
    // Clear selection if active
    if (selectedId) {
      setSelectedId(null);
    }

    // Navigate to BrowseScreen in select mode
    navigation.navigate('Browse', { mode: 'select' });
  };

  const handleFavoritePress = (item: { favorite: Favorite; sentence: SavedSentence }) => {
    if (selectedId === item.favorite.id) {
      // Deselect if already selected
      setSelectedId(null);
    } else if (selectedId) {
      // Switch selection to this item
      setSelectedId(item.favorite.id);
    } else {
      // Normal press - speak the sentence
      onFavoritePress(item.sentence.text);
    }
  };

  const handleFavoriteLongPress = (item: { favorite: Favorite; sentence: SavedSentence }) => {
    // Select the item
    setSelectedId(item.favorite.id);
  };

  const handleDelete = async () => {
    if (!selectedId) return;

    await FavoritesManager.removeFavorite(selectedId);
    setSelectedId(null);
    await loadFavorites();
  };

  const handleMoveLeft = async () => {
    if (!selectedId) return;

    const currentIndex = favorites.findIndex(f => f.favorite.id === selectedId);
    if (currentIndex <= 0) return; // Already at the start

    // Swap with previous item
    const newOrder = [...favorites];
    [newOrder[currentIndex - 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex - 1]];

    const orderedIds = newOrder.map(f => f.favorite.id);
    await FavoritesManager.reorderFavorites(orderedIds);
    await loadFavorites();
  };

  const handleMoveRight = async () => {
    if (!selectedId) return;

    const currentIndex = favorites.findIndex(f => f.favorite.id === selectedId);
    if (currentIndex === -1 || currentIndex >= favorites.length - 1) return; // Already at the end

    // Swap with next item
    const newOrder = [...favorites];
    [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]];

    const orderedIds = newOrder.map(f => f.favorite.id);
    await FavoritesManager.reorderFavorites(orderedIds);
    await loadFavorites();
  };

  const getFirstWord = (text: string): string => {
    return text.trim().split(/\s+/)[0] || text.substring(0, 15);
  };

  const addButtonHeight = isMobile ? height / 4 : height / 2;

  return (
    <>
      {/* Overlay to clear selection when clicking outside */}
      {selectedId && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setSelectedId(null)}
        />
      )}

      <View style={[styles.container, { height }]}>
        {/* Toolbar when item is selected */}
        {selectedId && (
          <View style={styles.toolbar}>
            <TouchableOpacity style={styles.toolbarButton} onPress={handleMoveLeft}>
              <Text style={styles.toolbarButtonText}>{strings.moveLeft}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolbarButton} onPress={handleDelete}>
              <Text style={[styles.toolbarButtonText, styles.deleteText]}>{strings.delete}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolbarButton} onPress={handleMoveRight}>
              <Text style={styles.toolbarButtonText}>{strings.moveRight}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedId(null)}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.innerContainer}>
          <View style={styles.favoritesGrid}>
            {favorites.map((item) => {
              const caption = item.favorite.caption || getFirstWord(item.sentence.text);
              const icon = item.favorite.icon;
              const isSelected = selectedId === item.favorite.id;
              const itemHeight = isMobile ? height / 4 : height / 2; // Subtract padding for non-mobile

              return (
                <View key={item.favorite.id} style={styles.favoriteWrapper}>
                  <TouchableOpacity
                    style={[
                      styles.favoriteButton,
                      { height: itemHeight },
                      isMobile && styles.favoriteButtonMobile,
                      !isMobile && icon && styles.favoriteButtonWithIcon,
                      isSelected && styles.selectedButton,
                    ]}
                    onPress={() => handleFavoritePress(item)}
                    onLongPress={() => handleFavoriteLongPress(item)}
                    activeOpacity={0.7}
                    delayLongPress={500}>
                    {icon && <Text style={isMobile ? styles.favoriteIconMobile : styles.favoriteIcon}>{icon}</Text>}
                    <Text style={icon ? styles.favoriteCaptionWithIcon : styles.favoriteText} numberOfLines={1}>
                      {caption}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Add button */}
            <View style={styles.favoriteWrapper}>
              <TouchableOpacity
                style={[styles.addButton, { height: addButtonHeight }]}
                onPress={handleAddPress}
                activeOpacity={0.7}>
                <Text style={styles.addButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 999,
  },
  container: {
    margin: 8,
    marginLeft: 0,
    width: "100%",
    zIndex: 1000,
  },
  innerContainer: {
    flex: 1,
    paddingHorizontal: sizes.spacing.md,
    height: '100%',
  },
  favoritesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    paddingVertical: 8,
    gap: sizes.spacing.sm,
  },
  favoriteWrapper: {
    position: 'relative',
    marginRight: sizes.spacing.sm,
  },
  favoriteButton: {
    minWidth: 80,
    maxWidth: 200,
    height: 60,
    paddingHorizontal: sizes.spacing.sm,
    paddingVertical: sizes.spacing.xs,
    borderRadius: sizes.borderRadius.large,
    backgroundColor: colors.secondary,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
  },
  favoriteButtonMobile: {
    flexDirection: 'row',
    gap: sizes.spacing.xs,
  },
  favoriteButtonWithIcon: {
    paddingVertical: sizes.spacing.xs,
    paddingHorizontal: sizes.spacing.md,
  },
  selectedButton: {
    borderWidth: 4,
    borderColor: colors.primary,
  },
  favoriteIcon: {
    fontSize: 32,
    marginBottom: 2,
  },
  favoriteIconMobile: {
    fontSize: 20,
  },
  favoriteCaptionWithIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  favoriteText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  addButton: {
    width: 80,
    height: 60,
    borderRadius: sizes.borderRadius.large,
    backgroundColor: colors.background,
    borderStyle: "dashed",
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
  },
  addButtonText: {
    color: 'gray',
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 32,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  toolbar: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: colors.surfaceDark,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: sizes.spacing.md,
    height: 80,
    zIndex: 1001,
  },
  toolbarButton: {
    paddingVertical: sizes.spacing.sm,
    paddingHorizontal: sizes.spacing.md,
    backgroundColor: colors.primary,
    borderRadius: sizes.borderRadius.medium,
    minWidth: 100,
    alignItems: 'center',
  },
  toolbarButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteText: {
    color: '#FF6B6B',
  },
  closeButton: {
    position: 'absolute',
    top: sizes.spacing.sm,
    right: sizes.spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default FavoritesBar;
