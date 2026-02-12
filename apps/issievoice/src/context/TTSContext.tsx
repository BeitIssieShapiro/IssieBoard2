import React, {createContext, useContext, useEffect, useState, ReactNode} from 'react';
import TTS, {TTSSettings} from '../services/TextToSpeech';
import {NativeModules, Platform} from 'react-native';

interface TTSContextType {
  speak: (text: string, languageMode?: 'en-only' | 'he-only' | 'detect', englishVoice?: string, hebrewVoice?: string) => Promise<void>;
  stop: () => Promise<void>;
  isSpeaking: boolean;
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

// Get device language
const getDeviceLanguage = (): string => {
  if (Platform.OS === 'ios') {
    return NativeModules.SettingsManager?.settings?.AppleLocale ||
           NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ||
           'en';
  } else {
    return NativeModules.I18nManager?.localeIdentifier || 'en';
  }
};

export const TTSProvider = ({children}: {children: ReactNode}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
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
    TTS.onTtsFinish(() => setIsSpeaking(false));

    return () => {
      TTS.removeAllListeners();
    };
  }, []);

  const speak = async (text: string, languageMode: 'en-only' | 'he-only' | 'detect' = 'detect', englishVoice?: string, hebrewVoice?: string) => {
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
        const deviceLang = getDeviceLanguage();
        const isDeviceEnglish = deviceLang.startsWith('en');
        const textHasHebrew = hasHebrewCharacters(text);

        // If device is English AND text has no Hebrew chars, use English. Otherwise use Hebrew.
        if (isDeviceEnglish && !textHasHebrew) {
          languageToUse = 'en-US';
          voiceToUse = englishVoice;
        } else {
          languageToUse = 'he-IL';
          voiceToUse = hebrewVoice;
        }

        console.log(`🗣️ Auto-detecting TTS language: device=${deviceLang}, hasHebrew=${textHasHebrew}, using=${languageToUse}, voice=${voiceToUse || 'default'}`);
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
    } catch (error) {
      console.error('Failed to speak:', error);
      setIsSpeaking(false);
    }
  };

  const stop = async () => {
    try {
      await TTS.stop();
      setIsSpeaking(false);
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
    <TTSContext.Provider value={{speak, stop, isSpeaking, settings, updateSettings, setLanguage, getAvailableVoices, setVoice}}>
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