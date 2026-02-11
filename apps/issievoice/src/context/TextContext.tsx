import React, {createContext, useContext, useState, ReactNode} from 'react';

interface TextContextType {
  currentText: string;
  setText: (text: string) => void;
  appendText: (text: string) => void;
  clearText: () => void;
  deleteLastWord: () => void;
}

const TextContext = createContext<TextContextType | undefined>(undefined);

export const TextProvider = ({children}: {children: ReactNode}) => {
  const [currentText, setCurrentText] = useState('');

  const setText = (text: string) => {
    console.log('💾 TextContext.setText called with:', text);
    setCurrentText(text);
    console.log('✅ TextContext.setCurrentText done');
  };

  const appendText = (text: string) => {
    setCurrentText(prev => {
      // Add space if there's existing text and it doesn't end with space
      if (prev && !prev.endsWith(' ') && !text.startsWith(' ')) {
        return prev + ' ' + text;
      }
      return prev + text;
    });
  };

  const clearText = () => {
    setCurrentText('');
  };

  const deleteLastWord = () => {
    setCurrentText(prev => {
      const trimmed = prev.trimEnd();
      const lastSpaceIndex = trimmed.lastIndexOf(' ');
      
      if (lastSpaceIndex === -1) {
        // No space found, clear everything
        return '';
      }
      
      // Keep everything up to the last space
      return trimmed.substring(0, lastSpaceIndex + 1);
    });
  };

  return (
    <TextContext.Provider
      value={{
        currentText,
        setText,
        appendText,
        clearText,
        deleteLastWord,
      }}>
      {children}
    </TextContext.Provider>
  );
};

export const useText = () => {
  const context = useContext(TextContext);
  if (!context) {
    throw new Error('useText must be used within TextProvider');
  }
  return context;
};