import React, { createContext, useContext, useState, useCallback } from 'react';
import { evaluate, negateLastNumber } from '../services/Calculator';

type Keyset = 'basic' | 'scientific';

interface CalcContextValue {
  expression: string;
  result: string;
  keyset: Keyset;
  appendToExpression: (val: string) => void;
  clearAll: () => void;
  computeResult: () => void;
  toggleSign: () => void;
  setKeyset: (k: Keyset) => void;
}

const CalcContext = createContext<CalcContextValue | null>(null);

export const CalcProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState('0');
  const [keyset, setKeyset] = useState<Keyset>('basic');

  const appendToExpression = useCallback((val: string) => {
    setExpression(prev => {
      const next = prev + val;
      const res = evaluate(next);
      if (res !== '') setResult(res);  // only update result when expression is complete
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setExpression('');
    setResult('0');
  }, []);

  const computeResult = useCallback(() => {
    setExpression(prev => {
      const res = evaluate(prev);
      setResult(res);
      return res === 'Error' ? prev : res;
    });
  }, []);

  const toggleSign = useCallback(() => {
    setExpression(prev => {
      const next = negateLastNumber(prev);
      const res = evaluate(next);
      if (res !== '') setResult(res);
      return next;
    });
  }, []);

  return (
    <CalcContext.Provider value={{ expression, result, keyset, appendToExpression, clearAll, computeResult, toggleSign, setKeyset }}>
      {children}
    </CalcContext.Provider>
  );
};

export function useCalc(): CalcContextValue {
  const ctx = useContext(CalcContext);
  if (!ctx) throw new Error('useCalc must be used inside CalcProvider');
  return ctx;
}
