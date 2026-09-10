import React, {createContext, useContext, useEffect, useState, ReactNode} from 'react';
import TTS, {TTSSettings, TtsProgressEvent} from '../services/TextToSpeech';

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
  setLanguage: (lang: string) => Promise<void>;
  getAvailableVoices: () => Promise<any[]>;
  setVoice: (voiceId: string) => Promise<void>;
}

const TTSContext = createContext<TTSContextType | undefined>(undefined);

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
    // Initialize TTS
    const initTTS = async () => {
      try {
        await TTS.initialize();
        // Set initial language explicitly
        await TTS.setLanguage(settings.language);
        console.log('🗣️ TTS initialized with language:', settings.language);
      } catch (error) {
        console.error('TTS initialization error:', error);
      }
    };

    initTTS();

    // Set up listeners
    TTS.onTtsStart(() => setIsSpeaking(true));
    TTS.onTtsFinish(() => {
      setIsSpeaking(false);
      setSpokenRange(null);
      setSpokenText(null);
    });
    TTS.onTtsProgress((event) => {
      setSpokenRange(toCharacterRange(event));
    });

    return () => {
      TTS.removeAllListeners();
    };
  }, []);

  const speak = async (text: string, languageMode: 'en-only' | 'he-only' | 'detect' = 'detect', englishVoice?: string, hebrewVoice?: string, arabicVoice?: string) => {
    if (!text.trim()) return;

    try {
      let languageToUse: string;
      let voiceToUse: string | undefined;

      if (languageMode === 'en-only') {
        languageToUse = 'en-US';
        voiceToUse = englishVoice;
        console.log(`🗣️ Language mode: English only, voice: ${voiceToUse || 'default'}`);
      } else if (languageMode === 'he-only') {
        languageToUse = 'he-IL';
        voiceToUse = hebrewVoice;
        console.log(`🗣️ Language mode: Hebrew only, voice: ${voiceToUse || 'default'}`);
      } else {
        // Auto-detect language based on text content
        const textHasHebrew = hasHebrewCharacters(text);
        const textHasArabic = hasArabicCharacters(text);

        if (textHasHebrew) {
          languageToUse = 'he-IL';
          voiceToUse = hebrewVoice;
        } else if (textHasArabic) {
          languageToUse = 'ar-SA';
          voiceToUse = arabicVoice;
        } else {
          languageToUse = 'en-US';
          voiceToUse = englishVoice;
        }

        console.log(`🗣️ Auto-detecting TTS language: hasHebrew=${textHasHebrew}, hasArabic=${textHasArabic}, using=${languageToUse}`);
      }

      // Set the language before speaking if it's different
      if (settings.language !== languageToUse) {
        await TTS.setLanguage(languageToUse);
        setSettings(prev => ({...prev, language: languageToUse}));
      }

      // Set the voice if specified
      if (voiceToUse && settings.voice !== voiceToUse) {
        await TTS.setVoice(voiceToUse);
        setSettings(prev => ({...prev, voice: voiceToUse}));
      }

      await TTS.speak(text);
      setSpokenText(text);
    } catch (error) {
      console.error('Failed to speak:', error);
      setIsSpeaking(false);
    }
  };

  const stop = async () => {
    try {
      await TTS.stop();
      setIsSpeaking(false);
      setSpokenRange(null);
      setSpokenText(null);
    } catch (error) {
      console.error('Failed to stop:', error);
    }
  };

  const updateSettings = async (newSettings: Partial<TTSSettings>) => {
    try {
      if (newSettings.rate !== undefined) {
        await TTS.setRate(newSettings.rate);
      }
      if (newSettings.pitch !== undefined) {
        await TTS.setPitch(newSettings.pitch);
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
  };

  const getAvailableVoices = async () => {
    return await TTS.getAvailableVoices();
  };

  const setVoice = async (voiceId: string) => {
    console.log(`🗣️ Setting TTS voice: ${voiceId}`);
    await updateSettings({ voice: voiceId });
  };

  // Helper function to set language (maps language codes to TTS language codes)
  const setLanguage = async (lang: string): Promise<void> => {
    const languageMap: Record<string, string> = {
      'en': 'en-US',
      'he': 'he-IL',
      'ar': 'ar-SA',
    };

    const ttsLang = languageMap[lang] || 'en-US';

    console.log(`🗣️ setLanguage called: ${lang} -> ${ttsLang} (current: ${settings.language})`);

    // Skip update if it's the same language after mapping
    if (settings.language === ttsLang) {
      console.log(`🗣️ Skipping - already set to ${ttsLang}`);
      return; // Don't update if it's effectively the same language
    }

    console.log(`🗣️ Actually updating TTS language to: ${ttsLang}`);
    await updateSettings({ language: ttsLang });
  };

  return (
    <TTSContext.Provider value={{speak, stop, isSpeaking, spokenText, spokenRange, settings, updateSettings, setLanguage, getAvailableVoices, setVoice}}>
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