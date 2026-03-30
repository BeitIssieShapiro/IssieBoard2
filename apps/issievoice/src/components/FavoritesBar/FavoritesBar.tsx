import React, { useState, useEffect, useMemo } from 'react';
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
import { MyIcon } from '@beitissieshapiro/issie-shared/dist/icons';

const ITEM_WIDTH = 120;
const ITEM_HEIGHT_DESKTOP = 69;
const ITEM_HEIGHT_MOBILE = 46;
const GAP = sizes.spacing.sm;
const NAV_BUTTON_WIDTH = 50;
// container margin (8 right) + innerContainer paddingHorizontal (16*2)
const HORIZONTAL_PADDING = 8 + sizes.spacing.md * 2;

interface FavoritesBarProps {
  onFavoritePress: (text: string) => void;
  height: number;
  navigation: any;
  onEditModeChange?: (isEditMode: boolean) => void;
  reloadTrigger?: number;
  screenWidth?: number;
  isRTL?: boolean;
  isLandscape?: boolean;
  isTablet?: boolean;
  symbolsInSuggestions?: boolean;
  onUnusedHeight?: (unusedHeight: number) => void;
}

const FavoritesBar: React.FC<FavoritesBarProps> = ({ onFavoritePress, height, navigation, onEditModeChange, reloadTrigger, screenWidth = 1000, isRTL = false, isLandscape = false, isTablet = false, symbolsInSuggestions = false, onUnusedHeight }) => {
  const [favorites, setFavorites] = useState<{ favorite: Favorite; sentence: SavedSentence }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const { strings } = useLocalization();

  const isMobile = screenWidth < 600;

  useEffect(() => {
    onEditModeChange?.(selectedId !== null);
  }, [selectedId, onEditModeChange]);

  useEffect(() => {
    loadFavorites();
  }, []);

  useEffect(() => {
    if (reloadTrigger !== undefined) {
      loadFavorites();
    }
  }, [reloadTrigger]);

  const loadFavorites = async () => {
    const favs = await FavoritesManager.getFavorites();
    const sentences = await SavedSentencesManager.getSavedSentences();

    const matched = favs
      .map(fav => {
        const sentence = sentences.find(s => s.id === fav.id);
        return sentence ? { favorite: fav, sentence } : null;
      })
      .filter(Boolean) as { favorite: Favorite; sentence: SavedSentence }[];

    matched.sort((a, b) => a.favorite.order - b.favorite.order);
    setFavorites(matched);
    setCurrentPage(0);
  };

  const handleAddPress = async () => {
    if (selectedId) setSelectedId(null);
    navigation.navigate('Browse');
  };

  const handleFavoritePress = (item: { favorite: Favorite; sentence: SavedSentence }) => {
    if (selectedId === item.favorite.id) {
      setSelectedId(null);
    } else if (selectedId) {
      setSelectedId(item.favorite.id);
    } else {
      onFavoritePress(item.sentence.text);
    }
  };

  const handleFavoriteLongPress = (item: { favorite: Favorite; sentence: SavedSentence }) => {
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
    if (currentIndex <= 0) return;
    const newOrder = [...favorites];
    [newOrder[currentIndex - 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex - 1]];
    await FavoritesManager.reorderFavorites(newOrder.map(f => f.favorite.id));
    await loadFavorites();
  };

  const handleMoveRight = async () => {
    if (!selectedId) return;
    const currentIndex = favorites.findIndex(f => f.favorite.id === selectedId);
    if (currentIndex === -1 || currentIndex >= favorites.length - 1) return;
    const newOrder = [...favorites];
    [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]];
    await FavoritesManager.reorderFavorites(newOrder.map(f => f.favorite.id));
    await loadFavorites();
  };

  const getFirstWord = (text: string): string => {
    return text.trim().split(/\s+/)[0] || text.substring(0, 15);
  };

  const rowCount = useMemo(() => {
    const bonus = symbolsInSuggestions ? 0 : 1;
    if (isLandscape) {
      return 1 + bonus; // iPad landscape: 1 row (+1 if symbols off)
    }
    return 3 + bonus; // portrait: 3 rows (+1 if symbols off)
  }, [isLandscape, symbolsInSuggestions]);

  const itemHeight = isMobile ? ITEM_HEIGHT_MOBILE : ITEM_HEIGHT_DESKTOP;
  const computedHeight = rowCount * itemHeight + (rowCount - 1) * GAP + sizes.spacing.sm * 2;

  const availableRowWidth = screenWidth - HORIZONTAL_PADDING;
  const itemWidthWithGap = ITEM_WIDTH + GAP;
  const navWidthWithGap = NAV_BUTTON_WIDTH + GAP;
  const itemsPerRow = Math.max(1, Math.floor(availableRowWidth / itemWidthWithGap));
  const totalSlots = itemsPerRow * rowCount;

  console.log(`⭐ [FavoritesBar] screenWidth=${screenWidth} availableRowWidth=${availableRowWidth} itemsPerRow=${itemsPerRow} rowCount=${rowCount} totalSlots=${totalSlots} favorites=${favorites.length} isLandscape=${isLandscape} symbolsInSuggestions=${symbolsInSuggestions} usedRowCount=${usedRowCount} unusedHeight=${unusedHeight}`);

  type GridItem = { type: 'favorite'; data: typeof favorites[0] } | { type: 'prev' } | { type: 'next' } | { type: 'add' };

  const { currentRows, needsPaging, usedRowCount } = useMemo(() => {
    if (favorites.length === 0) {
      const rows: GridItem[][] = [[{ type: 'add' }]];
      while (rows.length < rowCount) rows.push([]);
      return { currentRows: rows, needsPaging: false, usedRowCount: 1 };
    }

    // Check if all favorites + add button fit
    const allFitCount = totalSlots - 1; // -1 for add button
    if (favorites.length <= allFitCount) {
      // Single page with add button
      const items: GridItem[] = favorites.map(f => ({ type: 'favorite' as const, data: f }));
      items.push({ type: 'add' });
      const rows: GridItem[][] = [];
      for (let i = 0; i < items.length; i += itemsPerRow) {
        rows.push(items.slice(i, i + itemsPerRow));
      }
      const used = rows.length;
      while (rows.length < rowCount) rows.push([]);
      return { currentRows: rows, needsPaging: false, usedRowCount: used };
    }

    // Need pagination - no add button
    const isFirstPage = currentPage === 0;

    // Compute start index cumulatively
    let startIdx = 0;
    for (let p = 0; p < currentPage; p++) {
      let pageSlots = totalSlots;
      if (p > 0) pageSlots -= 1; // prev
      const remainingFromHere = favorites.length - startIdx;
      if (remainingFromHere > pageSlots) {
        pageSlots -= 1; // next
      }
      startIdx += pageSlots;
    }

    // Now figure out this page
    let availableSlots = totalSlots;
    if (!isFirstPage) availableSlots -= 1; // prev

    const remainingItems = favorites.length - startIdx;
    const needsNext = remainingItems > availableSlots;
    if (needsNext) availableSlots -= 1; // next

    const pageItems = favorites.slice(startIdx, startIdx + availableSlots);

    // Build rows manually - place prev at start, next at end of last content row
    const allFavItems: GridItem[] = [];
    if (!isFirstPage) allFavItems.push({ type: 'prev' });
    for (const f of pageItems) allFavItems.push({ type: 'favorite', data: f });

    const rows: GridItem[][] = [];
    for (let i = 0; i < allFavItems.length; i += itemsPerRow) {
      rows.push(allFavItems.slice(i, i + itemsPerRow));
    }

    // Append next button to the last row that has content
    if (needsNext && rows.length > 0) {
      const lastRow = rows[rows.length - 1];
      if (lastRow.length < itemsPerRow) {
        // There's room - push a spacer approach: we'll use flex style to push it to end
        lastRow.push({ type: 'next' });
      } else {
        // Row is full - start new row with just next
        rows.push([{ type: 'next' }]);
      }
    }

    const used = rows.length;
    while (rows.length < rowCount) rows.push([]);

    return { currentRows: rows, needsPaging: true, usedRowCount: used };
  }, [favorites, currentPage, totalSlots, itemsPerRow, rowCount]);

  // Report unused height to parent
  const unusedRows = rowCount - usedRowCount;
  const unusedHeight = unusedRows > 0 ? unusedRows * (itemHeight + GAP) : 0;
  useEffect(() => {
    onUnusedHeight?.(unusedHeight);
  }, [unusedHeight, onUnusedHeight]);

  const renderGridItem = (gridItem: GridItem, itemH: number) => {
    if (gridItem.type === 'prev') {
      return (
        <TouchableOpacity
          key="prev"
          style={[styles.navButton, { height: itemH, width: NAV_BUTTON_WIDTH }]}
          onPress={() => setCurrentPage(p => Math.max(0, p - 1))}
          activeOpacity={0.7}>
          <MyIcon info={{ name: isRTL ? 'navigate-next' : 'navigate-before', type: 'MI', color: '#FFFFFF', size: 32 }} />
        </TouchableOpacity>
      );
    }
    if (gridItem.type === 'next') {
      return (
        <TouchableOpacity
          key="next"
          style={[styles.navButton, { height: itemH, width: NAV_BUTTON_WIDTH }, isRTL ? { marginRight: 'auto' } : { marginLeft: 'auto' }]}
          onPress={() => setCurrentPage(p => p + 1)}
          activeOpacity={0.7}>
          <MyIcon info={{ name: isRTL ? 'navigate-before' : 'navigate-next', type: 'MI', color: '#FFFFFF', size: 32 }} />
        </TouchableOpacity>
      );
    }
    if (gridItem.type === 'add') {
      return (
        <TouchableOpacity
          key="add"
          style={[styles.addButton, { height: itemH, width: NAV_BUTTON_WIDTH }]}
          onPress={handleAddPress}
          activeOpacity={0.7}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      );
    }

    const item = gridItem.data;
    const caption = item.sentence.caption || getFirstWord(item.sentence.text);
    const icon = item.sentence.icon;
    const isSelected = selectedId === item.favorite.id;

    return (
      <TouchableOpacity
        key={item.favorite.id}
        style={[
          styles.favoriteButton,
          { height: itemH, width: ITEM_WIDTH },
          isMobile && styles.favoriteButtonMobile,
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
    );
  };

  return (
    <>
      {selectedId && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setSelectedId(null)}
        />
      )}

      <View style={[styles.container, { height: computedHeight - unusedHeight }]}>
        {selectedId && (
          <View style={styles.toolbar}>
            <TouchableOpacity style={styles.toolbarButton} onPress={handleMoveLeft}>
              <Text style={styles.toolbarButtonText}>{strings.favorites.moveLeft}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolbarButton} onPress={handleDelete}>
              <Text style={[styles.toolbarButtonText, styles.deleteText]}>{strings.favorites.remove}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolbarButton} onPress={handleMoveRight}>
              <Text style={styles.toolbarButtonText}>{strings.favorites.moveRight}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedId(null)}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.innerContainer}>
          {currentRows.map((row, rowIndex) => (
            <View key={rowIndex} style={[styles.favoritesRow, isRTL && { flexDirection: 'row-reverse' }]}>
              {row.map((gridItem) => renderGridItem(gridItem, itemHeight))}
            </View>
          ))}
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
    zIndex: 10,
  },
  innerContainer: {
    flex: 1,
    paddingHorizontal: sizes.spacing.md,
    paddingVertical: sizes.spacing.sm,
  },
  favoritesRow: {
    flexDirection: 'row',
    gap: GAP,
    marginBottom: GAP,
  },
  favoriteButton: {
    height: 60,
    paddingHorizontal: sizes.spacing.sm,
    paddingVertical: sizes.spacing.xs,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  favoriteButtonMobile: {
    flexDirection: 'row',
    gap: sizes.spacing.xs,
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
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  favoriteText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    width: 50,
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
    fontSize: 28,
    fontWeight: 'bold',
    lineHeight: 28,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  navButton: {
    width: 50,
    borderRadius: sizes.borderRadius.large,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
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
