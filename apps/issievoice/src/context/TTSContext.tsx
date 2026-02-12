import React, {createContext, useContext, useEffect, useState, ReactNode} from 'react';
import TTS, {TTSSettings} from '../services/TextToSpeech';

interface TTSContextType {
  speak: (text: string) => Promise<void>;
  stop: () => Promise<void>;
  isSpeaking: boolean;
  settings: TTSSettings;
  updateSettings: (settings: Partial<TTSSettings>) => Promise<void>;
  setLanguage: (lang: string) => Promise<void>;
}

const TTSContext = createContext<TTSContextType | undefined>(undefined);

export const TTSProvider = ({children}: {children: ReactNode}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [settings, setSettings] = useState<TTSSettings>({
    rate: 0.5,
    pitch: 1.0,
    language: 'en-US',
  });

  useEffect(() => {
    // Initialize TTS
    TTS.initialize().catch(console.error);

    // Set up listeners
    TTS.onTtsStart(() => setIsSpeaking(true));
    TTS.onTtsFinish(() => setIsSpeaking(false));

    return () => {
      TTS.removeAllListeners();
    };
  }, []);

  const speak = async (text: string) => {
    if (!text.trim()) return;
    
    try {
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
      
      setSettings(prev => ({...prev, ...newSettings}));
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  };

  // Helper function to set language (maps language codes to TTS language codes)
  const setLanguage = async (lang: string): Promise<void> => {
    const languageMap: Record<string, string> = {
      'en': 'en-US',
      'he': 'he-IL',
      'ar': 'ar-SA',
    };
    
    const ttsLang = languageMap[lang] || 'en-US';
    
    // Skip update if it's the same language after mapping
    if (settings.language === ttsLang) {
      return; // Don't update if it's effectively the same language
    }
    
    console.log(`🗣️ Setting TTS language: ${lang} -> ${ttsLang}`);
    await updateSettings({ language: ttsLang });
  };

  return (
    <TTSContext.Provider value={{speak, stop, isSpeaking, settings, updateSettings, setLanguage}}>
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