import React, {createContext, useContext, useState, useRef, ReactNode} from 'react';

interface TextContextType {
  currentText: string;
  setText: (text: string) => void;
  appendText: (text: string) => void;
  clearText: () => void;
  deleteLastWord: () => void;
  cursorPosition: number;
  /**
   * Records the caret position. By default this also asks the TextInput to move
   * its caret there (`pushToInput`), which is what keyboard-driven moves need.
   * Pass `pushToInput: false` when merely *reporting* where the user already put
   * the caret — otherwise the TextInput gets a collapsed selection pushed back at
   * it and any range the user drag-selected is destroyed.
   */
  setCursorPosition: (pos: number, pushToInput?: boolean) => void;
  /**
   * Move the caret by `offset`, clamped to `maxLength`, relative to the latest
   * position. Reads a ref rather than the `cursorPosition` state so a rapid burst
   * of moves (space-key swipe) accumulates correctly instead of every event in the
   * burst computing from the same not-yet-committed state value.
   */
  moveCursorBy: (offset: number, maxLength: number) => void;
  /**
   * A pending request to move the TextInput caret. Carries a monotonic `nonce` so
   * two successive moves to the *same* index still register as distinct requests —
   * a plain number would be deduped by setState and the second move would be lost.
   */
  pendingSelection: {pos: number; nonce: number} | null;
  clearPendingSelection: () => void;
}

const TextContext = createContext<TextContextType | undefined>(undefined);

export const TextProvider = ({children}: {children: ReactNode}) => {
  const [currentText, setCurrentText] = useState('');
  const cursorRef = useRef(0);
  const [cursorPosition, setCursorPositionState] = useState(0);
  const [pendingSelection, setPendingSelection] = useState<{pos: number; nonce: number} | null>(null);
  const nonceRef = useRef(0);

  const clearPendingSelection = () => setPendingSelection(null);

  const setCursorPosition = (pos: number, pushToInput: boolean = true) => {
    cursorRef.current = pos;
    setCursorPositionState(pos);
    if (pushToInput) {
      nonceRef.current += 1;
      setPendingSelection({pos, nonce: nonceRef.current});
    }
  };

  const moveCursorBy = (offset: number, maxLength: number) => {
    const next = Math.max(0, Math.min(maxLength, cursorRef.current + offset));
    setCursorPosition(next);
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
        moveCursorBy,
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