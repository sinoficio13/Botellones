import { useState, useEffect } from 'react';

/**
 * Generic debounce hook — delays value updates by `delay` milliseconds.
 * Extracting the debounce timeout into a named hook separates concerns
 * and avoids inline useEffect with setTimeout in components.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
