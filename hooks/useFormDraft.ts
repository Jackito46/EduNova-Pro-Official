import { useState, useEffect } from 'react';

/**
 * Hook to automatically save form state to localStorage as a draft.
 * @param key Unique key for localStorage
 * @param initialData Initial form data
 */
export function useFormDraft<T>(key: string, initialData: T) {
  const [formData, setFormData] = useState<T>(() => {
    try {
      const draft = window.localStorage.getItem(key);
      if (draft) {
        return JSON.parse(draft) as T;
      }
    } catch (e) {
      console.warn("Could not load form draft from localStorage");
    }
    return initialData;
  });

  const [hasDraft, setHasDraft] = useState(() => {
    try {
        return window.localStorage.getItem(key) !== null;
    } catch {
        return false;
    }
  });

  useEffect(() => {
    try {
      if (formData !== initialData) {
        window.localStorage.setItem(key, JSON.stringify(formData));
        setHasDraft(true);
      }
    } catch (e) {
      console.warn("Could not save form draft to localStorage");
    }
  }, [formData, key, initialData]);

  const clearDraft = () => {
    try {
      window.localStorage.removeItem(key);
      setHasDraft(false);
    } catch (e) {
      // Ignored
    }
  };

  return { formData, setFormData, hasDraft, clearDraft };
}
