import React, {createContext, useContext, useState, useRef, ReactNode} from 'react';

interface TextContextType {
  currentText: string;
  setText: (text: string) => void;
  appendText: (text: string) => void;
  clearText: () => void;
  deleteLastWord: () => void;
  cursorPosition: number;
  setCursorPosition: (pos: number) => void;
  pendingSelection: number | null;
  clearPendingSelection: () => void;
}

const TextContext = createContext<TextContextType | undefined>(undefined);

export const TextProvider = ({children}: {children: ReactNode}) => {
  const [currentText, setCurrentText] = useState('');
  const cursorRef = useRef(0);
  const [cursorPosition, setCursorPositionState] = useState(0);
  const [pendingSelection, setPendingSelection] = useState<number | null>(null);

  const clearPendingSelection = () => setPendingSelection(null);

  const setCursorPosition = (pos: number) => {
    cursorRef.current = pos;
    setCursorPositionState(pos);
    setPendingSelection(pos);
  };

  const setText = (text: string) => {
    setCurrentText(text);
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
        cursorPosition,
        setCursorPosition,
        pendingSelection,
        clearPendingSelection,
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