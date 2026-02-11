import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'hideValuesPreference';

export function useHideValues() {
  const [hideValues, setHideValuesState] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, hideValues.toString());
    
    // Dispatch custom event to sync across components
    window.dispatchEvent(new CustomEvent('hideValuesChange', { detail: hideValues }));
  }, [hideValues]);

  useEffect(() => {
    const handleChange = (event: CustomEvent<boolean>) => {
      setHideValuesState(event.detail);
    };

    window.addEventListener('hideValuesChange', handleChange as EventListener);
    return () => window.removeEventListener('hideValuesChange', handleChange as EventListener);
  }, []);

  const toggleHideValues = useCallback(() => {
    setHideValuesState((prev) => !prev);
  }, []);

  return { hideValues, toggleHideValues, setHideValues: setHideValuesState };
}
