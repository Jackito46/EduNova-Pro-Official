import { useEffect } from 'react';

/**
 * Hook to warn the user before they leave a page with unsaved changes.
 * @param hasUnsavedChanges boolean indicating if there are unsaved changes
 */
export const useUnsavedChanges = (hasUnsavedChanges: boolean) => {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        // Cancel the event
        e.preventDefault();
        // Chrome requires returnValue to be set
        e.returnValue = ''; 
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);
};
