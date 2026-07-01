# Separate Caption/Icon from Favorites — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple caption/icon (sentence metadata) from favorites (quick-access list) so users can set caption/icon on any sentence independently, and add/remove favorites with a simple toggle.

**Architecture:** Move `caption` and `icon` fields from `Favorite` to `SavedSentence`. Favorites become a simple list of sentence IDs + order. BrowseScreen gets a dedicated edit button for caption/icon on every sentence, and the star button becomes a toggle. When adding to favorites without caption/icon, prompt the user.

**Tech Stack:** React Native, TypeScript, rn-emoji-keyboard

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/issievoice/src/services/SavedSentencesManager.ts` | Modify | Add `caption?` and `icon?` to `SavedSentence` interface |
| `apps/issievoice/src/services/FavoritesManager.ts` | Modify | Remove `caption`/`icon` from `Favorite`, simplify API |
| `apps/issievoice/src/localization/strings.ts` | Modify | Add/update localization strings for all 3 languages |
| `apps/issievoice/src/screens/BrowseScreen.tsx` | Modify | Remove select mode, add edit button, star toggle, prompt logic |
| `apps/issievoice/src/components/FavoritesBar/FavoritesBar.tsx` | Modify | Read caption/icon from sentence, navigate to browse (not select) |

---

### Task 1: Update SavedSentence interface

**Files:**
- Modify: `apps/issievoice/src/services/SavedSentencesManager.ts:3-8`

- [ ] **Step 1: Add caption and icon fields to SavedSentence**

```ts
export interface SavedSentence {
  id: string;
  text: string;
  createdAt: number;
  category?: string;
  caption?: string;
  icon?: string;
}
```

No other changes needed — `updateSentence` already supports `Partial<SavedSentence>` so it will handle caption/icon updates automatically.

- [ ] **Step 2: Commit**

```bash
git add apps/issievoice/src/services/SavedSentencesManager.ts
git commit -m "feat(issievoice): add caption and icon fields to SavedSentence"
```

---

### Task 2: Simplify FavoritesManager

**Files:**
- Modify: `apps/issievoice/src/services/FavoritesManager.ts`

- [ ] **Step 1: Remove caption/icon from Favorite interface and simplify methods**

Replace the entire file content with:

```ts
import KeyboardPreferences from '../../../../src/native/KeyboardPreferences';

const STORAGE_KEY = 'issievoice_favorites';

export interface Favorite {
  id: string; // ID of the saved sentence
  order: number;
}

class FavoritesManager {
  async getFavorites(): Promise<Favorite[]> {
    try {
      const jsonValue = await KeyboardPreferences.getProfile(STORAGE_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (error) {
      console.error('Failed to load favorites:', error);
      return [];
    }
  }

  async addFavorite(sentenceId: string): Promise<void> {
    try {
      const favorites = await this.getFavorites();

      // Don't add duplicates
      if (favorites.some(f => f.id === sentenceId)) return;

      const maxOrder = favorites.length > 0 ? Math.max(...favorites.map(f => f.order)) : -1;

      const newFavorite: Favorite = {
        id: sentenceId,
        order: maxOrder + 1,
      };

      favorites.push(newFavorite);
      await KeyboardPreferences.setProfile(JSON.stringify(favorites), STORAGE_KEY);
    } catch (error) {
      console.error('Failed to add favorite:', error);
      throw error;
    }
  }

  async removeFavorite(sentenceId: string): Promise<void> {
    try {
      const favorites = await this.getFavorites();
      const filtered = favorites.filter(f => f.id !== sentenceId);
      await KeyboardPreferences.setProfile(JSON.stringify(filtered), STORAGE_KEY);
    } catch (error) {
      console.error('Failed to remove favorite:', error);
      throw error;
    }
  }

  async toggleFavorite(sentenceId: string): Promise<boolean> {
    const isFav = await this.isFavorite(sentenceId);
    if (isFav) {
      await this.removeFavorite(sentenceId);
      return false;
    } else {
      await this.addFavorite(sentenceId);
      return true;
    }
  }

  async reorderFavorites(orderedIds: string[]): Promise<void> {
    try {
      const favorites = orderedIds.map((id, index) => ({
        id,
        order: index,
      }));
      await KeyboardPreferences.setProfile(JSON.stringify(favorites), STORAGE_KEY);
    } catch (error) {
      console.error('Failed to reorder favorites:', error);
      throw error;
    }
  }

  async isFavorite(sentenceId: string): Promise<boolean> {
    try {
      const favorites = await this.getFavorites();
      return favorites.some(f => f.id === sentenceId);
    } catch (error) {
      console.error('Failed to check favorite:', error);
      return false;
    }
  }
}

export default new FavoritesManager();
```

Key changes:
- Removed `caption` and `icon` from `Favorite` interface
- Removed `updateFavorite` and `getFavorite` methods (no longer needed)
- Simplified `addFavorite` — no caption/icon params, added duplicate guard
- Added `toggleFavorite` convenience method

- [ ] **Step 2: Commit**

```bash
git add apps/issievoice/src/services/FavoritesManager.ts
git commit -m "feat(issievoice): simplify FavoritesManager - remove caption/icon"
```

---

### Task 3: Update localization strings

**Files:**
- Modify: `apps/issievoice/src/localization/strings.ts`

- [ ] **Step 1: Update Strings interface**

In the `favorites` section of the `Strings` interface (lines 42-54), replace with:

```ts
  favorites: {
    moveLeft: string;
    moveRight: string;
    editCaptionIcon: string;
    caption: string;
    captionPlaceholder: string;
    captionHint: string;
    icon: string;
    iconHint: string;
    addedToFavorites: string;
    removedFromFavorites: string;
    captionIconPromptTitle: string;
    captionIconPromptMessage: string;
  };
```

- [ ] **Step 2: Update English strings**

Replace the `favorites` section in `en` (lines 129-141):

```ts
  favorites: {
    moveLeft: '← Move Left',
    moveRight: 'Move Right →',
    editCaptionIcon: 'Caption & Icon',
    caption: 'Caption',
    captionPlaceholder: 'Enter caption...',
    captionHint: 'Short label shown on the button',
    icon: 'Icon',
    iconHint: 'Emoji or symbol for this sentence',
    addedToFavorites: 'Added to favorites',
    removedFromFavorites: 'Removed from favorites',
    captionIconPromptTitle: 'Set Caption & Icon?',
    captionIconPromptMessage: 'Would you like to set a caption and icon for this favorite?',
  },
```

- [ ] **Step 3: Update Hebrew strings**

Replace the `favorites` section in `he` (lines 216-228):

```ts
  favorites: {
    moveLeft: 'הזז שמאלה ←',
    moveRight: '→ הזז ימינה',
    editCaptionIcon: 'כיתוב וסמל',
    caption: 'כיתוב',
    captionPlaceholder: 'הזן כיתוב...',
    captionHint: 'תווית קצרה על הכפתור',
    icon: 'סמל',
    iconHint: 'אימוג\'י או סמל למשפט זה',
    addedToFavorites: 'נוסף למועדפים',
    removedFromFavorites: 'הוסר מהמועדפים',
    captionIconPromptTitle: 'להגדיר כיתוב וסמל?',
    captionIconPromptMessage: 'האם ברצונך להגדיר כיתוב וסמל למועדף זה?',
  },
```

- [ ] **Step 4: Update Arabic strings**

Replace the `favorites` section in `ar` (lines 303-315):

```ts
  favorites: {
    moveLeft: '← تحريك لليسار',
    moveRight: 'تحريك لليمين →',
    editCaptionIcon: 'التسمية والأيقونة',
    caption: 'التسمية',
    captionPlaceholder: 'أدخل التسمية...',
    captionHint: 'تسمية قصيرة على الزر',
    icon: 'الأيقونة',
    iconHint: 'رمز تعبيري أو رمز لهذه الجملة',
    addedToFavorites: 'تمت الإضافة إلى المفضلة',
    removedFromFavorites: 'تمت الإزالة من المفضلة',
    captionIconPromptTitle: 'تعيين التسمية والأيقونة؟',
    captionIconPromptMessage: 'هل تريد تعيين تسمية وأيقونة لهذه المفضلة؟',
  },
```

- [ ] **Step 5: Commit**

```bash
git add apps/issievoice/src/localization/strings.ts
git commit -m "feat(issievoice): update localization strings for caption/icon separation"
```

---

### Task 4: Rewrite BrowseScreen

**Files:**
- Modify: `apps/issievoice/src/screens/BrowseScreen.tsx`

This is the largest change. The screen removes the `select` mode entirely, and in `browse` mode each sentence gets: ✏️ (edit caption/icon), ➕ (insert), 🗣️ (speak), ⭐/☆ (toggle favorite), 🗑️ (delete).

- [ ] **Step 1: Update state and remove select mode**

Replace lines 27-48 (props interface and state declarations):

```tsx
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
  const {strings, language} = useLocalization();
  const {showNotification} = useNotification();
```

Remove the `Favorite` import from line 22 (no longer needed in this file). Change to:
```ts
import FavoritesManager from '../services/FavoritesManager';
```

- [ ] **Step 2: Replace handler functions**

Replace lines 86-156 (loadSentences through handleCancelEdit) with:

```tsx
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
      // If sentence has no caption/icon, prompt user to set them
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
```

- [ ] **Step 3: Replace renderSentenceItem**

Replace the entire `renderSentenceItem` function (lines 199-290) with:

```tsx
  const renderSentenceItem = ({item}: {item: SavedSentence}) => {
    const isFavorite = favoriteIds.has(item.id);
    const hasCustomDisplay = item.icon || item.caption;

    return (
      <View style={[styles.sentenceItem, isLandscape && styles.sentenceItemLandscape]}>
        <TouchableOpacity
          style={styles.sentenceTextContainer}
          onPress={() => handleReplaceText(item)}
          activeOpacity={0.7}>

          {/* Show icon/caption prominently if set */}
          {hasCustomDisplay && (
            <View style={styles.favoriteHeaderContainer}>
              {item.icon && (
                <Text style={styles.favoriteHeaderIcon}>{item.icon}</Text>
              )}
              <Text style={styles.favoriteHeaderText}>
                {item.caption || getFirstWord(item.text)}
              </Text>
            </View>
          )}

          {/* Full sentence text */}
          <Text style={[
            styles.sentenceText,
            hasCustomDisplay && styles.sentenceTextSecondary
          ]} numberOfLines={2}>
            {item.text}
          </Text>
          {item.category && (
            <Text style={styles.categoryText}>{item.category}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => handleEditCaptionIcon(item)}
            activeOpacity={0.7}>
            <Text style={styles.actionButtonText}>✏️</Text>
          </TouchableOpacity>

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
            style={[styles.actionButton, styles.addFavoriteButton, isFavorite && styles.addFavoriteButtonActive]}
            onPress={() => handleToggleFavorite(item)}
            activeOpacity={0.7}>
            <Text style={styles.actionButtonText}>
              {isFavorite ? '⭐' : '☆'}
            </Text>
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
  };
```

- [ ] **Step 4: Update header — remove select mode title logic**

In the header section (around line 323-324), replace the title:

```tsx
        <Text style={styles.headerTitle}>
          {strings.browse.savedSentences}
        </Text>
```

Remove the conditional that checks `mode === 'select'`.

Remove the conditional around clearAll button that checks `mode === 'browse'` — it's always browse now.

- [ ] **Step 5: Update edit modal — change from favorite to sentence**

Replace the edit modal overlay (the section starting around `{editingFavorite !== null &&`) — change all references from `editingFavorite` to `editingSentence`, `favoriteCaption` to `editCaption`, `favoriteIcon` to `editIcon`, and `handleSaveFavorite` to `handleSaveCaptionIcon`. Update the title:

```tsx
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
                        <Text style={styles.editModalButtonText}>{strings.common.cancel}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.editModalButton, styles.saveButton]}
                        onPress={handleSaveCaptionIcon}
                        activeOpacity={0.7}>
                        <Text style={styles.editModalButtonText}>{strings.common.save}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </View>
      )}
```

- [ ] **Step 6: Update emoji picker handler**

Replace `handleEmojiPick` to use `setEditIcon`:

```tsx
  const handleEmojiPick = (emoji: any) => {
    setEditIcon(emoji.emoji);
    setIsEmojiPickerOpen(false);
  };
```

- [ ] **Step 7: Update styles — add editButton, rename addFavoriteButtonActive**

Add to the StyleSheet:

```ts
  editButton: {
    backgroundColor: '#9C27B0', // Purple for edit
  },
  addFavoriteButtonActive: {
    backgroundColor: colors.success,
  },
```

Remove unused styles: `addFavoriteButtonDisabled`, `editFavoriteButton`, `selectButton`, `selectButtonDisabled`, `sentenceTextDisabled`.

- [ ] **Step 8: Commit**

```bash
git add apps/issievoice/src/screens/BrowseScreen.tsx
git commit -m "feat(issievoice): separate caption/icon editing from favorites in BrowseScreen"
```

---

### Task 5: Update FavoritesBar

**Files:**
- Modify: `apps/issievoice/src/components/FavoritesBar/FavoritesBar.tsx`

- [ ] **Step 1: Read caption/icon from sentence instead of favorite**

In `FavoritesBar.tsx`, the `getFirstWord` helper and the rendering already access `item.favorite.caption` and `item.favorite.icon`. Change these to read from `item.sentence` instead.

In the `favorites.map` rendering block (around line 169-196), change:

```tsx
const caption = item.sentence.caption || getFirstWord(item.sentence.text);
const icon = item.sentence.icon;
```

(Previously: `item.favorite.caption` and `item.favorite.icon`)

- [ ] **Step 2: Change + button to navigate to Browse (no select mode)**

In `handleAddPress` (line 65-73), change from:

```tsx
navigation.navigate('Browse', { mode: 'select' });
```

To:

```tsx
navigation.navigate('Browse');
```

- [ ] **Step 3: Commit**

```bash
git add apps/issievoice/src/components/FavoritesBar/FavoritesBar.tsx
git commit -m "feat(issievoice): FavoritesBar reads caption/icon from sentence"
```

---

### Task 6: Smoke test and final commit

- [ ] **Step 1: Run the app and verify**

Run: `npm start` and test on iOS simulator.

Verify:
1. Browse screen shows all sentences with ✏️, ➕, 🗣️, ⭐/☆, 🗑️ buttons
2. ✏️ opens caption/icon editor modal, saves to sentence
3. ⭐ toggles favorite on/off
4. Adding to favorites when no caption/icon shows prompt
5. Answering "Yes" opens the caption/icon editor
6. Answering "No" adds as favorite without caption/icon
7. FavoritesBar shows caption/icon from sentence data
8. FavoritesBar + button navigates to Browse (no select mode)
9. Long-press on favorite still enables reorder/delete toolbar

- [ ] **Step 2: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(issievoice): polish caption/icon separation"
```
