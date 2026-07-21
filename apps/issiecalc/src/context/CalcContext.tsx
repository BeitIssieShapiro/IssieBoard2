import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { evaluate, negateLastNumber } from '../services/Calculator';

type Keyset = 'basic' | 'scientific';

interface CalcContextValue {
  expression: string;
  result: string;
  resultMode: boolean;
  keyset: Keyset;
  appendToExpression: (val: string) => void;
  clearAll: () => void;
  backspace: () => void;
  computeResult: () => void;
  toggleSign: () => void;
  setKeyset: (k: Keyset) => void;
}

const CalcContext = createContext<CalcContextValue | null>(null);

const OPERATORS = /^[\+\-\*\/\%]$/;
const FUNCTIONS = /^(sin\(|cos\(|tan\(|sqrt\(|log\(|x\^2|\(|\)|pi)$/;

function isOperatorOrFunction(val: string): boolean {
  return OPERATORS.test(val) || FUNCTIONS.test(val);
}

export const CalcProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState('');
  const [resultMode, setResultMode] = useState(false);
  const [keyset, setKeyset] = useState<Keyset>('basic');
  const expressionRef = useRef('');
  const resultRef = useRef('');
  const resultModeRef = useRef(false);

  const appendToExpression = useCallback((val: string) => {
    if (resultModeRef.current) {
      if (isOperatorOrFunction(val)) {
        // seed new expression from result, append operator
        expressionRef.current = resultRef.current + val;
      } else {
        // digit/dot: start fresh
        expressionRef.current = val;
      }
      resultModeRef.current = false;
      setResultMode(false);
      setResult('');
      resultRef.current = '';
    } else {
      expressionRef.current = expressionRef.current + val;
    }
    setExpression(expressionRef.current);
  }, []);

  const clearAll = useCallback(() => {
    expressionRef.current = '';
    resultRef.current = '';
    resultModeRef.current = false;
    setExpression('');
    setResult('');
    setResultMode(false);
  }, []);

  const backspace = useCallback(() => {
    if (resultModeRef.current) {
      // backspace in result mode clears everything
      expressionRef.current = '';
      resultRef.current = '';
      resultModeRef.current = false;
      setExpression('');
      setResult('');
      setResultMode(false);
      return;
    }
    expressionRef.current = expressionRef.current.slice(0, -1);
    setExpression(expressionRef.current);
  }, []);

  const computeResult = useCallback(() => {
    const res = evaluate(expressionRef.current);
    const finalRes = res === '' ? 'Error' : res;
    resultRef.current = finalRes;
    resultModeRef.current = true;
    setResult(finalRes);
    setResultMode(true);
  }, []);

  const toggleSign = useCallback(() => {
    if (resultModeRef.current) {
      const negated = negateLastNumber(resultRef.current);
      expressionRef.current = negated;
      resultRef.current = '';
      resultModeRef.current = false;
      setExpression(negated);
      setResult('');
      setResultMode(false);
      return;
    }
    expressionRef.current = negateLastNumber(expressionRef.current);
    setExpression(expressionRef.current);
  }, []);

  return (
    <CalcContext.Provider value={{ expression, result, resultMode, keyset, appendToExpression, clearAll, backspace, computeResult, toggleSign, setKeyset }}>
      {children}
    </CalcContext.Provider>
  );
};

export function useCalc(): CalcContextValue {
  const ctx = useContext(CalcContext);
  if (!ctx) throw new Error('useCalc must be used inside CalcProvider');
  return ctx;
}

