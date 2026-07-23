import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { evaluate, negateLastNumber } from '../services/Calculator';
import KeyboardPreferences from '../../../../src/native/KeyboardPreferences';

const ANGLE_MODE_KEY = 'issiecalc_angle_mode';
const KEYSET_KEY = 'issiecalc_keyset';

type Keyset = 'basic' | 'scientific' | 'scientific_landscape_2nd' | 'scientific_2nd';
type AngleMode = 'rad' | 'deg';

interface CalcContextValue {
  expression: string;
  result: string;
  resultMode: boolean;
  keyset: Keyset;
  angleMode: AngleMode;
  memory: string;
  appendToExpression: (val: string) => void;
  replaceExpression: (val: string) => void;
  clearAll: () => void;
  backspace: () => void;
  computeResult: () => void;
  toggleSign: () => void;
  setKeyset: (k: Keyset) => void;
  toggleAngleMode: () => void;
  memoryStore: () => void;
  memoryRecall: () => void;
}

const CalcContext = createContext<CalcContextValue | null>(null);

const OPERATORS = /^[+\-*/^%]$/;
const FUNCTIONS = /^(sin\(|cos\(|tan\(|asin\(|acos\(|atan\(|sinh\(|cosh\(|tanh\(|asinh\(|acosh\(|atanh\(|sqrt\(|ln\(|log\(|log2\(|logy\(|2root\(|3root\(|yroot\(|factorial\(|x\^2|x\^3|x\^\(|\^\(|2\^\(|1\/\(|\(|\)|pi|e)$/;

function isOperatorOrFunction(val: string): boolean {
  return OPERATORS.test(val) || FUNCTIONS.test(val);
}

export const CalcProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState('');
  const [resultMode, setResultMode] = useState(false);
  const [keyset, setKeysetState] = useState<Keyset>('basic');
  const [angleMode, setAngleMode] = useState<AngleMode>('rad');
  const [memory, setMemory] = useState('0');

  const expressionRef = useRef('');
  const resultRef = useRef('');
  const resultModeRef = useRef(false);
  const angleModeRef = useRef<AngleMode>('rad');
  const memoryRef = useRef('0');

  useEffect(() => {
    Promise.all([
      KeyboardPreferences.getString(ANGLE_MODE_KEY),
      KeyboardPreferences.getString(KEYSET_KEY),
    ]).then(([savedAngle, savedKeyset]) => {
      if (savedAngle === 'deg' || savedAngle === 'rad') {
        angleModeRef.current = savedAngle;
        setAngleMode(savedAngle);
      }
      if (savedKeyset === 'basic' || savedKeyset === 'scientific') {
        setKeysetState(savedKeyset);
      }
    });
  }, []);

  const replaceExpression = useCallback((val: string) => {
    expressionRef.current = val;
    resultRef.current = '';
    resultModeRef.current = false;
    setExpression(val);
    setResult('');
    setResultMode(false);
  }, []);

  const appendToExpression = useCallback((val: string) => {
    if (resultModeRef.current) {
      if (isOperatorOrFunction(val)) {
        expressionRef.current = resultRef.current + val;
      } else {
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
    const res = evaluate(expressionRef.current, angleModeRef.current);
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

  const setKeyset = useCallback((k: Keyset) => {
    setKeysetState(k);
    // Persist only the canonical mode (not the transient 2nd state)
    if (k === 'basic' || k === 'scientific') {
      KeyboardPreferences.setString(KEYSET_KEY, k);
    }
  }, []);

  const toggleAngleMode = useCallback(() => {
    const next: AngleMode = angleModeRef.current === 'rad' ? 'deg' : 'rad';
    angleModeRef.current = next;
    setAngleMode(next);
    KeyboardPreferences.setString(ANGLE_MODE_KEY, next);
  }, []);

  const memoryStore = useCallback(() => {
    const val = resultModeRef.current ? resultRef.current : expressionRef.current;
    if (val && val !== 'Error') {
      memoryRef.current = val;
      setMemory(val);
    }
  }, []);

  const memoryRecall = useCallback(() => {
    if (memoryRef.current !== '0' || expressionRef.current === '') {
      appendToExpression(memoryRef.current);
    }
  }, [appendToExpression]);

  return (
    <CalcContext.Provider value={{
      expression, result, resultMode, keyset, angleMode, memory,
      appendToExpression, replaceExpression, clearAll, backspace, computeResult, toggleSign,
      setKeyset, toggleAngleMode, memoryStore, memoryRecall,
    }}>
      {children}
    </CalcContext.Provider>
  );
};

export function useCalc(): CalcContextValue {
  const ctx = useContext(CalcContext);
  if (!ctx) throw new Error('useCalc must be used inside CalcProvider');
  return ctx;
}
