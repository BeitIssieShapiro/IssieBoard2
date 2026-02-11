import KeyboardPreferences from '../../../../src/native/KeyboardPreferences';

export interface SavedSentence {
  id: string;
  text: string;
  createdAt: number;
  category?: string;
}

const STORAGE_KEY = 'issievoice_saved_sentences';

class SavedSentencesManager {
  async getSavedSentences(): Promise<SavedSentence[]> {
    try {
      const jsonValue = await KeyboardPreferences.getProfile(STORAGE_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (error) {
      console.error('Failed to load saved sentences:', error);
      return [];
    }
  }

  async saveSentence(text: string, category?: string): Promise<SavedSentence> {
    try {
      const sentences = await this.getSavedSentences();
      const newSentence: SavedSentence = {
        id: Date.now().toString(),
        text,
        createdAt: Date.now(),
        category,
      };
      
      sentences.unshift(newSentence); // Add to beginning
      await KeyboardPreferences.setProfile(JSON.stringify(sentences), STORAGE_KEY);
      
      return newSentence;
    } catch (error) {
      console.error('Failed to save sentence:', error);
      throw error;
    }
  }

  async deleteSentence(id: string): Promise<void> {
    try {
      const sentences = await this.getSavedSentences();
      const filtered = sentences.filter(s => s.id !== id);
      await KeyboardPreferences.setProfile(JSON.stringify(filtered), STORAGE_KEY);
    } catch (error) {
      console.error('Failed to delete sentence:', error);
      throw error;
    }
  }

  async updateSentence(id: string, updates: Partial<SavedSentence>): Promise<void> {
    try {
      const sentences = await this.getSavedSentences();
      const index = sentences.findIndex(s => s.id === id);
      
      if (index !== -1) {
        sentences[index] = { ...sentences[index], ...updates };
        await KeyboardPreferences.setProfile(JSON.stringify(sentences), STORAGE_KEY);
      }
    } catch (error) {
      console.error('Failed to update sentence:', error);
      throw error;
    }
  }

  async searchSentences(query: string): Promise<SavedSentence[]> {
    try {
      const sentences = await this.getSavedSentences();
      const lowerQuery = query.toLowerCase();
      
      return sentences.filter(s =>
        s.text.toLowerCase().includes(lowerQuery) ||
        (s.category && s.category.toLowerCase().includes(lowerQuery))
      );
    } catch (error) {
      console.error('Failed to search sentences:', error);
      return [];
    }
  }

  async clearAll(): Promise<void> {
    try {
      await KeyboardPreferences.setProfile('[]', STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear sentences:', error);
      throw error;
    }
  }
}

export default new SavedSentencesManager();