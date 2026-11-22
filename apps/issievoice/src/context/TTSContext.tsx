import React, {createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode} from 'react';
import TTS, {TTSSettings, TtsProgressEvent} from '../services/TextToSpeech';
import KeyboardPreferences from '../../../../src/native/KeyboardPreferences';

interface SpokenRange {
  location: number;
  length: number;
}

/**
 * Normalise a platform tts-progress payload to `{location, length}`.
 *
 * iOS sends `{location, length}`; Android's UtteranceProgressListener.onRangeStart
 * sends `{start, end, frame}` with no `location`/`length` keys at all. Reading
 * `location` off an Android event yields undefined, which makes the highlight
 * slicing produce `substring(0, undefined)` — the whole string — followed by
 * `substring(NaN)`, also the whole string, rendering the text twice.
 *
 * Returns null for a payload carrying neither shape, so a malformed event clears
 * the highlight rather than moving it somewhere arbitrary.
 */
function toCharacterRange(event: TtsProgressEvent): SpokenRange | null {
  // iOS. Checked first so its length — which may legitimately be 0 for an
  // empty range — is preserved exactly as reported.
  if (Number.isFinite(event.location)) {
    const location = event.location as number;
    const length = Number.isFinite(event.length) ? (event.length as number) : 1;
    return {location, length};
  }

  // Android. `end` is exclusive, so the span is end - start; guard against a
  // malformed event where end <= start by falling back to a 1-char range.
  if (Number.isFinite(event.start)) {
    const location = event.start as number;
    const end = Number.isFinite(event.end) ? (event.end as number) : location + 1;
    return {location, length: Math.max(end - location, 1)};
  }

  return null;
}

interface TTSContextType {
  speak: (text: string, languageMode?: 'en-only' | 'he-only' | 'detect', englishVoice?: string, hebrewVoice?: string, arabicVoice?: string) => Promise<void>;
  stop: () => Promise<void>;
  isSpeaking: boolean;
  spokenText: string | null;
  spokenRange: SpokenRange | null;
  settings: TTSSettings;
  updateSettings: (settings: Partial<TTSSettings>) => Promise<void>;
  getAvailableVoices: () => Promise<any[]>;
}

const TTSContext = createContext<TTSContextType | undefined>(undefined);

const RATE_KEY = 'issievoice_rate';
const PITCH_KEY = 'issievoice_pitch';

// Helper function to detect if text contains Hebrew characters
const hasHebrewCharacters = (text: string): boolean => {
  // Hebrew Unicode range: \u0590-\u05FF
  return /[\u0590-\u05FF]/.test(text);
};

// Helper function to detect if text contains Arabic characters
const hasArabicCharacters = (text: string): boolean => /[\u0600-\u06FF]/.test(text);

export const TTSProvider = ({children}: {children: ReactNode}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [spokenText, setSpokenText] = useState<string | null>(null);
  const [spokenRange, setSpokenRange] = useState<SpokenRange | null>(null);
  const [settings, setSettings] = useState<TTSSettings>({
    rate: 0.5,
    pitch: 1.0,
    language: 'en-US',
  });

  useEffect(() => {
    const clearSpeaking = () => {
      setIsSpeaking(false);
      setSpokenRange(null);
      setSpokenText(null);
    };

    const initTTS = async () => {
      try {
        await TTS.initialize();
        // Restore the saved rate and pitch, so a user who needs slow speech
        // doesn't get "normal" back on every launch.
        const savedRate = parseFloat((await KeyboardPreferences.getString(RATE_KEY)) ?? '');
        const savedPitch = parseFloat((await KeyboardPreferences.getString(PITCH_KEY)) ?? '');
        if (Number.isFinite(savedRate)) await TTS.setRate(savedRate);
        if (Number.isFinite(savedPitch)) await TTS.setPitch(savedPitch);
        setSettings(prev => ({
          ...prev,
          ...(Number.isFinite(savedRate) ? {rate: savedRate} : {}),
          ...(Number.isFinite(savedPitch) ? {pitch: savedPitch} : {}),
        }));
      } catch (error) {
        console.error('TTS initialization error:', error);
      }
    };

    initTTS();

    // Set up listeners
    TTS.onTtsStart(() => setIsSpeaking(true));
    TTS.onTtsFinish(clearSpeaking);
    TTS.onTtsCancel(clearSpeaking);
    TTS.onTtsProgress((event) => {
      setSpokenRange(toCharacterRange(event));
    });

    return () => {
      TTS.removeAllListeners();
    };
  }, []);

  const stop = useCallback(async () => {
    await TTS.stop();
    setIsSpeaking(false);
    setSpokenRange(null);
    setSpokenText(null);
  }, []);

  const speak = useCallback(async (text: string, languageMode: 'en-only' | 'he-only' | 'detect' = 'detect', englishVoice?: string, hebrewVoice?: string, arabicVoice?: string) => {
    if (!text.trim()) return;

    try {
      let languageToUse: string;
      let voiceToUse: string | undefined;

      if (languageMode === 'en-only') {
        languageToUse = 'en-US';
        voiceToUse = englishVoice;
      } else if (languageMode === 'he-only') {
        languageToUse = 'he-IL';
        voiceToUse = hebrewVoice;
      } else if (hasHebrewCharacters(text)) {
        languageToUse = 'he-IL';
        voiceToUse = hebrewVoice;
      } else if (hasArabicCharacters(text)) {
        languageToUse = 'ar-SA';
        voiceToUse = arabicVoice;
      } else {
        languageToUse = 'en-US';
        voiceToUse = englishVoice;
      }

      // A new utterance replaces whatever is playing instead of queueing behind it.
      await stop();

      // Always apply language then voice: the native module has a single default
      // voice that setLanguage overwrites (and the voice test in settings changes),
      // so a cached "already set" check would speak with the wrong voice.
      await TTS.setLanguage(languageToUse);
      if (voiceToUse) {
        await TTS.setVoice(voiceToUse);
      }
      setSettings(prev => ({...prev, language: languageToUse, voice: voiceToUse}));

      setSpokenText(text);
      await TTS.speak(text);
    } catch (error) {
      console.error('Failed to speak:', error);
      setIsSpeaking(false);
    }
  }, [stop]);

  const updateSettings = useCallback(async (newSettings: Partial<TTSSettings>) => {
    try {
      if (newSettings.rate !== undefined) {
        await TTS.setRate(newSettings.rate);
        await KeyboardPreferences.setString(RATE_KEY, String(newSettings.rate));
      }
      if (newSettings.pitch !== undefined) {
        await TTS.setPitch(newSettings.pitch);
        await KeyboardPreferences.setString(PITCH_KEY, String(newSettings.pitch));
      }
      if (newSettings.language !== undefined) {
        await TTS.setLanguage(newSettings.language);
      }
      if (newSettings.voice !== undefined) {
        await TTS.setVoice(newSettings.voice);
      }
      setSettings(prev => ({...prev, ...newSettings}));
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  }, []);

  const getAvailableVoices = useCallback(() => TTS.getAvailableVoices(), []);

  const value = useMemo(
    () => ({speak, stop, isSpeaking, spokenText, spokenRange, settings, updateSettings, getAvailableVoices}),
    [speak, stop, isSpeaking, spokenText, spokenRange, settings, updateSettings, getAvailableVoices],
  );

  return (
    <TTSContext.Provider value={value}>
      {children}
    </TTSContext.Provider>
  );
};

export const useTTS = () => {
  const context = useContext(TTSContext);
  if (!context) {
    throw new Error('useTTS must be used within TTSProvider');
  }
  return context;
};