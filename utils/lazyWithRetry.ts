import React from 'react';

// Robust dynamic import wrapper: fails fast when offline, retries transient drops briefly online, never reloads while offline
export const lazyWithRetry = <T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T } | any>
) =>
  React.lazy(async () => {
    try {
      return await factory();
    } catch (error: any) {
      // Do not sleep/retry when the browser is explicitly offline
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw error;
      }

      console.warn('Erreur de chargement dynamique du module, nouvelle tentative...', error);
      try {
        await new Promise(resolve => setTimeout(resolve, 250));
        return await factory();
      } catch (retryError: any) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          throw retryError;
        }
        console.warn('Deuxième tentative de chargement dynamique...', retryError);
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          return await factory();
        } catch (finalError: any) {
          console.error('Échec définitif du chargement dynamique:', finalError);
          const errorMsg = String(finalError?.message || finalError || '').toLowerCase();
          const isStaleChunkError =
            errorMsg.includes('failed to fetch dynamically imported module') ||
            errorMsg.includes('importing a module script failed') ||
            errorMsg.includes('error loading dynamically imported module');

          if (isStaleChunkError && typeof window !== 'undefined' && navigator.onLine) {
            const reloadKey = 'vite_chunk_auto_reload';
            const lastReload = sessionStorage.getItem(reloadKey);
            const now = Date.now();
            if (!lastReload || now - Number(lastReload) > 30000) {
              sessionStorage.setItem(reloadKey, String(now));
              window.location.reload();
            }
          }
          throw finalError;
        }
      }
    }
  });
