import KeyboardPreferences from '../../../../src/native/KeyboardPreferences';

const STORAGE_KEY = 'issievoice_favorites';

export interface Favorite {
  id: string; // ID of the saved sentence
  order: number;
  caption?: string; // Custom caption (optional, defaults to first word)
  icon?: string; // Custom icon/emoji (optional)
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

  async addFavorite(sentenceId: string, caption?: string, icon?: string): Promise<void> {
    try {
      const favorites = await this.getFavorites();
      const maxOrder = favorites.length > 0 ? Math.max(...favorites.map(f => f.order)) : -1;

      const newFavorite: Favorite = {
        id: sentenceId,
        order: maxOrder + 1,
        caption,
        icon,
      };

      favorites.push(newFavorite);
      await KeyboardPreferences.setProfile(JSON.stringify(favorites), STORAGE_KEY);
    } catch (error) {
      console.error('Failed to add favorite:', error);
      throw error;
    }
  }

  async updateFavorite(sentenceId: string, caption?: string, icon?: string): Promise<void> {
    try {
      const favorites = await this.getFavorites();
      const index = favorites.findIndex(f => f.id === sentenceId);

      if (index !== -1) {
        favorites[index] = {
          ...favorites[index],
          caption,
          icon,
        };
        await KeyboardPreferences.setProfile(JSON.stringify(favorites), STORAGE_KEY);
      }
    } catch (error) {
      console.error('Failed to update favorite:', error);
      throw error;
    }
  }

  async getFavorite(sentenceId: string): Promise<Favorite | null> {
    try {
      const favorites = await this.getFavorites();
      return favorites.find(f => f.id === sentenceId) || null;
    } catch (error) {
      console.error('Failed to get favorite:', error);
      return null;
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
