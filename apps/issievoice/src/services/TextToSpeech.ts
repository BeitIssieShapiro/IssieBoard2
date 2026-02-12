import Tts from 'react-native-tts';

export interface TTSSettings {
  rate: number; // 0.01 to 0.99
  pitch: number; // 0.5 to 2.0
  language: string;
  voice?: string; // Optional voice ID
}

class TextToSpeechService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Just check if TTS is available - don't set defaults
      await Tts.getInitStatus();
      this.initialized = true;
    } catch (error) {
      console.error('TTS not available:', error);
      this.initialized = true;
    }
  }

  async speak(text: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await Tts.speak(text);
    } catch (error) {
      console.error('Failed to speak:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      await Tts.stop();
    } catch (error) {
      console.error('Failed to stop TTS:', error);
    }
  }

  async setRate(rate: number): Promise<void> {
    try {
      await Tts.setDefaultRate(rate);
    } catch (error) {
      console.error('Failed to set rate:', error);
    }
  }

  async setPitch(pitch: number): Promise<void> {
    try {
      await Tts.setDefaultPitch(pitch);
    } catch (error) {
      console.error('Failed to set pitch:', error);
    }
  }

  async setLanguage(language: string): Promise<void> {
    try {
      await Tts.setDefaultLanguage(language);
    } catch (error) {
      console.error('Failed to set language:', error);
    }
  }

  async setVoice(voiceId: string): Promise<void> {
    try {
      await Tts.setDefaultVoice(voiceId);
    } catch (error) {
      console.error('Failed to set voice:', error);
    }
  }

  async getAvailableVoices(): Promise<any[]> {
    try {
      const voices = await Tts.voices();
      return voices;
    } catch (error) {
      console.error('Failed to get voices:', error);
      return [];
    }
  }

  onTtsFinish(callback: () => void): void {
    Tts.addEventListener('tts-finish', callback);
  }

  onTtsStart(callback: () => void): void {
    Tts.addEventListener('tts-start', callback);
  }

  removeAllListeners(): void {
    Tts.removeAllListeners('tts-finish');
    Tts.removeAllListeners('tts-start');
  }
}

export default new TextToSpeechService();