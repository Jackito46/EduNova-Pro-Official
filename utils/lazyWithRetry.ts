import React from 'react';

const RETRY_DELAYS_MS = [300, 800, 1500, 2500];

const isDynamicImportFetchError = (error: any): boolean => {
  const errorMsg = String(error?.message || error || '').toLowerCase();
  return (
    errorMsg.includes('failed to fetch dynamically imported module') ||
    errorMsg.includes('importing a module script failed') ||
    errorMsg.includes('error loading dynamically imported module') ||
    errorMsg.includes('loading chunk') ||
    errorMsg.includes('loading css chunk')
  );
};

/**
 * Exécute un import dynamique avec tentatives progressives lorsque le navigateur est en ligne
 * (absorbe les micro-coupures réseau ou redémarrages brefs du serveur de dev).
 */
export const importWithRetry = async <T>(factory: () => Promise<T>): Promise<T> => {
  try {
    return await factory();
  } catch (firstError: any) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw firstError;
    }

    let lastError = firstError;
    for (let i = 0; i < RETRY_DELAYS_MS.length; i++) {
      console.warn(
        `Erreur de chargement dynamique du module (tentative ${i + 1}/${RETRY_DELAYS_MS.length})...`,
        lastError?.message || lastError
      );
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS_MS[i]));
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw lastError;
      }
      try {
        return await factory();
      } catch (retryError: any) {
        lastError = retryError;
      }
    }

    throw lastError;
  }
};

/**
 * Précharge un module en arrière-plan sans jamais provoquer de rejet non géré.
 */
export const safePreloadModule = (factory: () => Promise<any>): Promise<void> => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return Promise.resolve();
  }
  return importWithRetry(factory)
    .then(() => undefined)
    .catch((err) => {
      console.warn('Préchargement du module différé:', err?.message || err);
    });
};

// Robust dynamic import wrapper: fails fast when offline, retries transient drops briefly online, never reloads while offline
export const lazyWithRetry = <T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T } | any>
) =>
  React.lazy(async () => {
    try {
      return await importWithRetry(factory);
    } catch (finalError: any) {
      console.warn('Échec définitif du chargement dynamique:', finalError?.message || finalError);
      if (isDynamicImportFetchError(finalError) && typeof window !== 'undefined' && navigator.onLine) {
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
  });
