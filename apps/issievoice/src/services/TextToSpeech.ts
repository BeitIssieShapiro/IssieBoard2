import Tts from 'react-native-tts';
import { NativeModules } from 'react-native';

export interface TTSSettings {
  rate: number; // 0.01 to 0.99
  pitch: number; // 0.5 to 2.0
  language: string;
  voice?: string; // Optional voice ID
}

/**
 * A tts-progress event. Every field is optional because the two platforms send
 * different shapes — iOS `{location, length}`, Android `{start, end, frame}`.
 */
export interface TtsProgressEvent {
  location?: number;
  length?: number;
  start?: number;
  end?: number;
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
    } catch {
      // ignore — stop fails if nothing is playing
    }
  }

  async setRate(rate: number): Promise<void> {
    try {
      // Call native directly — the react-native-tts JS wrapper passes an extra boolean arg
      // that causes a bridge type error on iOS (BOOL* vs float mismatch).
      await NativeModules.TextToSpeech.setDefaultRate(rate);
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

  /**
   * The tts-progress payload differs by platform:
   *
   * - iOS sends AVSpeechSynthesizer's willSpeakRangeOfSpeechString as
   *   `{location, length}` — an offset and a span.
   * - Android sends UtteranceProgressListener.onRangeStart as
   *   `{start, end, frame}` — two absolute offsets, and no `location`/`length`
   *   keys at all.
   *
   * Callers must normalise before use — see toCharacterRange in TTSContext.
   */
  onTtsProgress(callback: (event: TtsProgressEvent) => void): void {
    Tts.addEventListener('tts-progress', callback);
  }

  removeAllListeners(): void {
    Tts.removeAllListeners('tts-finish');
    Tts.removeAllListeners('tts-start');
    Tts.removeAllListeners('tts-progress');
  }
}

export default new TextToSpeechService();