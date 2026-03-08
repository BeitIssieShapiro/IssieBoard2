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
