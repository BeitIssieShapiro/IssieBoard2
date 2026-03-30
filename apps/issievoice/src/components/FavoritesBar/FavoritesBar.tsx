import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { measureText } from 'react-native-text-measure';

const DEFAULT_ITEM_WIDTH = 120;
const ITEM_HEIGHT_DESKTOP = 69;
const ITEM_HEIGHT_MOBILE = 46;
const GAP = sizes.spacing.sm;
const NAV_BUTTON_WIDTH = 50;
// container margin (8 right) + innerContainer paddingHorizontal (16*2)
const HORIZONTAL_PADDING = 8 + sizes.spacing.md * 2;
// padding inside each favorite button
const BUTTON_H_PADDING = sizes.spacing.sm * 2; // paddingHorizontal on each side
const ICON_WIDTH = 36; // approximate width for emoji icon + gap
const MIN_ITEM_WIDTH = 80;
const MAX_ITEM_WIDTH = 200;

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
  const [itemWidths, setItemWidths] = useState<Record<string, number>>({});
  const { strings, isRTL: isDeviceRTL } = useLocalization();

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

  const getFirstWord = (text: string): string => {
    return text.trim().split(/\s+/)[0] || text.substring(0, 15);
  };

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

    // Measure all favorite text widths
    measureFavoriteWidths(matched);
  };

  const measureFavoriteWidths = async (items: { favorite: Favorite; sentence: SavedSentence }[]) => {
    const widths: Record<string, number> = {};
    const textStyle = { fontSize: 16, fontWeight: '600' as const };

    await Promise.all(items.map(async (item) => {
      const caption = item.sentence.caption || getFirstWord(item.sentence.text);
      try {
        const result = await measureText(caption, textStyle);
        const hasIcon = !!item.sentence.icon;
        const contentWidth = result.width + BUTTON_H_PADDING + (hasIcon ? ICON_WIDTH : 0) + 8; // +8 for font weight rendering margin
        const finalWidth = Math.min(MAX_ITEM_WIDTH, Math.max(MIN_ITEM_WIDTH, Math.ceil(contentWidth)));
        console.log(`⭐ [measure] "${caption}" textW=${result.width.toFixed(1)} hasIcon=${hasIcon} → ${finalWidth}px`);
        widths[item.favorite.id] = finalWidth;
      } catch (e) {
        console.warn(`⭐ [measure] FAILED for "${caption}":`, e);
        widths[item.favorite.id] = DEFAULT_ITEM_WIDTH;
      }
    }));

    console.log(`⭐ [measure] All widths:`, widths);
    setItemWidths(widths);
  };

  const getItemWidth = useCallback((item: { favorite: Favorite }) => {
    return itemWidths[item.favorite.id] || DEFAULT_ITEM_WIDTH;
  }, [itemWidths]);

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

  const rowCount = useMemo(() => {
    const bonus = symbolsInSuggestions ? 0 : 1;
    if (isLandscape) {
      return 1 + bonus;
    }
    return 3 + bonus;
  }, [isLandscape, symbolsInSuggestions]);

  const itemHeight = isMobile ? ITEM_HEIGHT_MOBILE : ITEM_HEIGHT_DESKTOP;
  const computedHeight = rowCount * itemHeight + (rowCount - 1) * GAP + sizes.spacing.sm * 2;
  const availableRowWidth = screenWidth - HORIZONTAL_PADDING;

  type GridItem = { type: 'favorite'; data: typeof favorites[0] } | { type: 'prev' } | { type: 'next' } | { type: 'add' };

  // Greedy row packing based on measured widths
  const packIntoRows = useCallback((
    items: typeof favorites,
    maxRows: number,
    extraStart: GridItem | null,
    extraEnd: GridItem | null,
  ): { rows: GridItem[][]; itemCount: number } | null => {
    const rows: GridItem[][] = [];
    let currentRow: GridItem[] = [];
    let currentRowWidth = 0;

    if (extraStart) {
      currentRow.push(extraStart);
      currentRowWidth = NAV_BUTTON_WIDTH + GAP;
    }

    let placed = 0;
    for (const item of items) {
      const w = getItemWidth(item) + GAP;
      if (currentRowWidth + w > availableRowWidth && currentRow.length > 0) {
        rows.push(currentRow);
        if (rows.length >= maxRows) {
          currentRow = []; // reset so it doesn't get pushed again
          break;
        }
        currentRow = [];
        currentRowWidth = 0;
      }
      currentRow.push({ type: 'favorite', data: item });
      currentRowWidth += w;
      placed++;
    }

    // Try to fit extraEnd on current row or a new row
    if (extraEnd) {
      const endW = NAV_BUTTON_WIDTH + GAP;
      if (currentRow.length === 0) {
        // All rows used up, need to back up from last pushed row
        if (rows.length > 0) {
          const lastRow = rows[rows.length - 1];
          if (lastRow.length > 0 && lastRow[lastRow.length - 1].type === 'favorite') {
            lastRow.pop();
            placed--;
          }
          lastRow.push(extraEnd);
        }
        return { rows, itemCount: placed };
      } else if (currentRowWidth + endW > availableRowWidth) {
        rows.push(currentRow);
        if (rows.length >= maxRows) {
          // No room for a new row - back up one item from last row
          const lastRow = rows[rows.length - 1];
          if (lastRow.length > 0 && lastRow[lastRow.length - 1].type === 'favorite') {
            lastRow.pop();
            placed--;
          }
          lastRow.push(extraEnd);
          return { rows, itemCount: placed };
        }
        currentRow = [extraEnd];
      } else {
        currentRow.push(extraEnd);
      }
    }

    if (currentRow.length > 0) rows.push(currentRow);
    if (rows.length > maxRows) {
      return null;
    }

    return { rows, itemCount: placed };
  }, [getItemWidth, availableRowWidth]);

  const { currentRows, usedRowCount } = useMemo(() => {
    if (favorites.length === 0) {
      const rows: GridItem[][] = [[{ type: 'add' }]];
      return { currentRows: rows, usedRowCount: 1 };
    }

    // Try single page: all favorites + add button
    const singlePage = packIntoRows(favorites, rowCount, null, { type: 'add' });
    if (singlePage && singlePage.itemCount === favorites.length) {
      return { currentRows: singlePage.rows, usedRowCount: singlePage.rows.length };
    }

    // Need pagination - no add button
    const isFirstPage = currentPage === 0;
    const prevItem: GridItem | null = isFirstPage ? null : { type: 'prev' };

    // Compute start index by replaying previous pages
    let startIdx = 0;
    for (let p = 0; p < currentPage; p++) {
      const pPrev: GridItem | null = p === 0 ? null : { type: 'prev' };
      const slice = favorites.slice(startIdx);
      // Try fitting without next first
      const withoutNext = packIntoRows(slice, rowCount, pPrev, null);
      if (withoutNext && startIdx + withoutNext.itemCount >= favorites.length) {
        // Everything fits - this shouldn't happen since we need paging
        startIdx += withoutNext.itemCount;
        break;
      }
      // Fit with next button
      const withNext = packIntoRows(slice, rowCount, pPrev, { type: 'next' });
      startIdx += withNext ? withNext.itemCount : 1;
    }

    const remaining = favorites.slice(startIdx);

    // Try fitting all remaining without next (last page)
    const withoutNext = packIntoRows(remaining, rowCount, prevItem, null);
    if (withoutNext && withoutNext.itemCount === remaining.length) {
      return { currentRows: withoutNext.rows, usedRowCount: withoutNext.rows.length };
    }

    // Need next button
    const withNext = packIntoRows(remaining, rowCount, prevItem, { type: 'next' });
    if (withNext) {
      return { currentRows: withNext.rows, usedRowCount: withNext.rows.length };
    }

    // Fallback - force at least 1 item
    const row: GridItem[] = [];
    if (prevItem) row.push(prevItem);
    if (remaining.length > 0) row.push({ type: 'favorite', data: remaining[0] });
    row.push({ type: 'next' });
    return { currentRows: [row], usedRowCount: 1 };
  }, [favorites, currentPage, rowCount, packIntoRows, itemWidths]);

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
          <MyIcon info={{ name: isDeviceRTL ? 'navigate-next' : 'navigate-before', type: 'MI', color: '#FFFFFF', size: 32 }} />
        </TouchableOpacity>
      );
    }
    if (gridItem.type === 'next') {
      return (
        <TouchableOpacity
          key="next"
          style={[styles.navButton, { height: itemH, width: NAV_BUTTON_WIDTH }, isDeviceRTL ? { marginRight: 'auto' } : { marginLeft: 'auto' }]}
          onPress={() => setCurrentPage(p => p + 1)}
          activeOpacity={0.7}>
          <MyIcon info={{ name: isDeviceRTL ? 'navigate-before' : 'navigate-next', type: 'MI', color: '#FFFFFF', size: 32 }} />
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
    const width = getItemWidth(item);

    return (
      <TouchableOpacity
        key={item.favorite.id}
        style={[
          styles.favoriteButton,
          { height: itemH, width },
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
            <View key={rowIndex} style={[styles.favoritesRow, isDeviceRTL && { flexDirection: 'row-reverse' }]}>
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
    height: 69,
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
    height: 69,
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
