import { useState, useEffect, useRef } from 'react';

/**
 * Press-and-hold guard (same behaviour as the CountdownButton in IssieDice /
 * IssieSays): the action fires only after the button is held for `seconds`,
 * releasing earlier cancels it. `countdown` is the seconds left while held, or
 * null when not held, so the caller can show "Open in N seconds".
 * In dev builds the guard is skipped and a plain tap fires immediately.
 */
export function useHoldCountdown(onComplete: () => void, seconds = 3) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      onCompleteRef.current();
      return;
    }
    const timer = setTimeout(() => setCountdown(prev => (prev !== null ? prev - 1 : null)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const pressProps = __DEV__
    ? { onPress: () => onCompleteRef.current() }
    : {
        onPressIn: () => setCountdown(seconds),
        onPressOut: () => setCountdown(null),
      };

  return { countdown, pressProps };
}
