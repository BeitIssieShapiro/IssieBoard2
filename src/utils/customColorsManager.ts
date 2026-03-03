import KeyboardPreferences from '../native/KeyboardPreferences';

const CUSTOM_COLORS_KEY = 'custom_colors';
const MAX_CUSTOM_COLORS = 4;

/**
 * Custom Colors Manager
 * Manages a FIFO list of up to 4 user-defined custom colors
 * Colors are stored persistently and appear in all color pickers
 */

export const customColorsManager = {
  /**
   * Get the list of custom colors
   * @returns Array of hex color strings (e.g., ['#FF5733', '#33FF57'])
   */
  async getCustomColors(): Promise<string[]> {
    try {
      const json = await KeyboardPreferences.getProfile(CUSTOM_COLORS_KEY);
      if (json) {
        const colors = JSON.parse(json);
        return Array.isArray(colors) ? colors : [];
      }
    } catch (error) {
      console.error('[CustomColorsManager] Failed to load custom colors:', error);
    }
    return [];
  },

  /**
   * Add a new custom color
   * If the list has 4 colors, removes the oldest (FIFO)
   * If the color already exists, moves it to the end (most recent)
   * @param color Hex color string (e.g., '#FF5733')
   */
  async addCustomColor(color: string): Promise<string[]> {
    try {
      const colors = await this.getCustomColors();

      // Normalize color to uppercase
      const normalizedColor = color.toUpperCase();

      // Remove if already exists (to avoid duplicates and move to end)
      const filtered = colors.filter(c => c.toUpperCase() !== normalizedColor);

      // Add to end (most recent)
      filtered.push(normalizedColor);

      // Keep only last 4 (FIFO)
      const updated = filtered.slice(-MAX_CUSTOM_COLORS);

      // Save
      await KeyboardPreferences.setProfile(JSON.stringify(updated), CUSTOM_COLORS_KEY);

      return updated;
    } catch (error) {
      console.error('[CustomColorsManager] Failed to add custom color:', error);
      return [];
    }
  },

  /**
   * Clear all custom colors
   */
  async clearCustomColors(): Promise<void> {
    try {
      await KeyboardPreferences.setProfile(JSON.stringify([]), CUSTOM_COLORS_KEY);
    } catch (error) {
      console.error('[CustomColorsManager] Failed to clear custom colors:', error);
    }
  },
};
