import React from 'react';

// Robust dynamic import wrapper with automated retry against chunk fetch failures and network drops
export const lazyWithRetry = <T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T } | any>
) =>
  React.lazy(async () => {
    try {
      return await factory();
    } catch (error: any) {
      console.warn('Erreur de chargement dynamique du module, nouvelle tentative...', error);
      try {
        await new Promise(resolve => setTimeout(resolve, 350));
        return await factory();
      } catch (retryError: any) {
        console.warn('Deuxième tentative de chargement dynamique...', retryError);
        try {
          await new Promise(resolve => setTimeout(resolve, 750));
          return await factory();
        } catch (finalError: any) {
          console.error('Échec définitif du chargement dynamique:', finalError);
          const errorMsg = String(finalError?.message || finalError || '').toLowerCase();
          if (
            errorMsg.includes('failed to fetch dynamically imported module') ||
            errorMsg.includes('importing a module script failed') ||
            errorMsg.includes('error loading dynamically imported module')
          ) {
            const reloadKey = 'vite_chunk_auto_reload';
            const lastReload = typeof window !== 'undefined' ? sessionStorage.getItem(reloadKey) : null;
            const now = Date.now();
            if (!lastReload || now - Number(lastReload) > 20000) {
              if (typeof window !== 'undefined') {
                sessionStorage.setItem(reloadKey, String(now));
                window.location.reload();
              }
            }
          }
          throw finalError;
        }
      }
    }
  });
