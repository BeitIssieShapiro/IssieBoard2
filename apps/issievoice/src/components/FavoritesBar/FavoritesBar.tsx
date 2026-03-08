import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { colors, sizes } from '../../constants';
import FavoritesManager, { Favorite } from '../../services/FavoritesManager';
import SavedSentencesManager, { SavedSentence } from '../../services/SavedSentencesManager';

interface FavoritesBarProps {
  onFavoritePress: (text: string) => void;
  height: number;
  navigation: any;
  onEditModeChange?: (isEditMode: boolean) => void;
  reloadTrigger?: number; // Change this to trigger reload
}

const FavoritesBar: React.FC<FavoritesBarProps> = ({ onFavoritePress, height, navigation, onEditModeChange, reloadTrigger }) => {
  const [favorites, setFavorites] = useState<{ favorite: Favorite; sentence: SavedSentence }[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);

  // Animation values for each favorite
  const [wiggleAnims] = useState<{ [key: string]: Animated.Value }>({});

  // Notify parent of edit mode changes
  useEffect(() => {
    onEditModeChange?.(isEditMode);
  }, [isEditMode, onEditModeChange]);

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

    // Initialize animations
    matched.forEach(item => {
      if (!wiggleAnims[item.favorite.id]) {
        wiggleAnims[item.favorite.id] = new Animated.Value(0);
      }
    });
  };

  const handleAddPress = async () => {
    // Exit edit mode if currently in it
    if (isEditMode) {
      setIsEditMode(false);
      // Stop wiggling
      favorites.forEach(item => {
        const anim = wiggleAnims[item.favorite.id];
        if (anim) {
          anim.stopAnimation();
          anim.setValue(0);
        }
      });
    }

    // Navigate to BrowseScreen in select mode
    navigation.navigate('Browse', { mode: 'select' });
  };

  const handleRemoveFavorite = async (sentenceId: string) => {
    await FavoritesManager.removeFavorite(sentenceId);
    await loadFavorites();
  };

  const handleReorder = async (data: { favorite: Favorite; sentence: SavedSentence }[]) => {
    console.log('🔄 Reordering favorites');

    // Update state immediately for responsive UI
    setFavorites(data);

    // Save the new order
    const orderedIds = data.map(item => item.favorite.id);
    await FavoritesManager.reorderFavorites(orderedIds);
  };

  const handleLongPress = () => {
    if (favorites.length === 0) return;

    const newEditMode = !isEditMode;
    setIsEditMode(newEditMode);

    if (newEditMode) {
      // Start wiggling animation for all favorites
      console.log('🎭 Starting wiggle animations for', favorites.length, 'favorites');
      favorites.forEach(item => {
        // Ensure animation exists
        if (!wiggleAnims[item.favorite.id]) {
          console.log('⚠️ Creating missing animation for', item.favorite.id);
          wiggleAnims[item.favorite.id] = new Animated.Value(0);
        }

        const anim = wiggleAnims[item.favorite.id];
        console.log('▶️ Starting animation for', item.favorite.id);
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: 100,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: -1,
              duration: 100,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 100,
              useNativeDriver: true,
            }),
          ])
        ).start();
      });
    } else {
      // Stop wiggling
      console.log('⏸️ Stopping wiggle animations');
      favorites.forEach(item => {
        const anim = wiggleAnims[item.favorite.id];
        if (anim) {
          anim.stopAnimation();
          anim.setValue(0);
        }
      });
    }
  };

  const getFirstWord = (text: string): string => {
    return text.trim().split(/\s+/)[0] || text.substring(0, 15);
  };

  const wiggleInterpolate = (animValue: Animated.Value) => {
    return animValue.interpolate({
      inputRange: [-1, 1],
      outputRange: ['-2deg', '2deg'],
    });
  };

  // Render individual favorite item
  const renderFavoriteItem = ({ item, drag, isActive }: RenderItemParams<{ favorite: Favorite; sentence: SavedSentence }>) => {
    const anim = wiggleAnims[item.favorite.id];

    if (!anim) {
      console.warn('⚠️ No animation for', item.favorite.id, 'in renderFavoriteItem');
    }

    const rotation = anim ? wiggleInterpolate(anim) : '0deg';

    // Combine transforms: wiggle + drag scale
    const transforms: any[] = [];
    if (isEditMode && !isActive) {
      transforms.push({ rotate: rotation });
    }
    if (isActive) {
      transforms.push({ scale: 1.05 });
    }

    return (
      <ScaleDecorator>
        <Animated.View
          style={[
            styles.favoriteWrapper,
            transforms.length > 0 && { transform: transforms },
            isActive && { opacity: 0.7 },
          ]}>
          <TouchableOpacity
            style={[styles.favoriteButton, {height: height/2}]}
            onPress={() => !isEditMode && onFavoritePress(item.sentence.text)}
            onLongPress={() => {
              if (isEditMode) {
                drag();
              } else {
                handleLongPress();
              }
            }}
            activeOpacity={0.7}
            delayLongPress={isEditMode ? 0 : 500}>
            <Text style={styles.favoriteText} numberOfLines={1}>
              {getFirstWord(item.sentence.text)}
            </Text>
          </TouchableOpacity>

          {isEditMode && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleRemoveFavorite(item.favorite.id)}
              activeOpacity={0.7}>
              <Text style={styles.deleteButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </ScaleDecorator>
    );
  };

  return (
    <>
      {/* Overlay to exit edit mode when clicking outside */}
      {isEditMode && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => {
            console.log('👆 Clicked outside - exiting edit mode');
            setIsEditMode(false);
            // Stop wiggling
            favorites.forEach(item => {
              const anim = wiggleAnims[item.favorite.id];
              if (anim) {
                anim.stopAnimation();
                anim.setValue(0);
              }
            });
          }}
        />
      )}

      <View style={[styles.container, { height }]}>
        <View style={styles.innerContainer}>
          {/* Draggable Favorites List */}
          <DraggableFlatList
            style={{ width: "100%", height: "100%" }}
            data={favorites}
            horizontal
            onDragEnd={({ data }) => handleReorder(data)}
            keyExtractor={(item) => item.favorite.id}
            renderItem={renderFavoriteItem}
            contentContainerStyle={styles.listContent}
            showsHorizontalScrollIndicator={false}
            activationDistance={isEditMode ? 10 : 1000} // Easy drag in edit mode, disabled otherwise
          />
          {/* Add button */}

          <TouchableOpacity
            style={[styles.addButton, {height: height/2, margin: styles.listContent.paddingVertical}]}
            onPress={handleAddPress}
            activeOpacity={0.7}>
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
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
    width: "100%",
    zIndex: 1000,
  },
  innerContainer: {
    flexDirection: 'row',
    paddingHorizontal: sizes.spacing.md,
    //paddingVertical: sizes.spacing.md,
  },
  listContent: {
    //alignItems: 'center',
    // justifyContent: "flex-start",
    //paddingRight: sizes.spacing.md,
    // /width: "100%"
    paddingVertical: 8
  },
  addButton: {
    width: 60,
    height: 60,
    borderRadius: sizes.borderRadius.large,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
  },
  favoriteWrapper: {
    position: 'relative',
    marginRight: sizes.spacing.sm,
  },
  favoriteButton: {
    minWidth: 80,
    maxWidth: 150,
    height: 60,
    paddingHorizontal: sizes.spacing.sm,
    borderRadius: sizes.borderRadius.large,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
  },
  favoriteText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  deleteButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default FavoritesBar;
