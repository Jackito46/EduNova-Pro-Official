import React, { Component, ErrorInfo, ReactNode } from 'react';
import { isRefreshTokenError, clearAuthStorage } from '../supabase';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export const isChunkLoadError = (error: any): boolean => {
  if (!error) return false;
  const msg = String(error?.message || error?.toString() || '').toLowerCase();
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('loading chunk') ||
    msg.includes('loading css chunk')
  );
};

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (isRefreshTokenError(error)) {
      console.warn('Refresh token error detected in ErrorBoundary, clearing auth storage...');
      clearAuthStorage();
      if (typeof window !== 'undefined' && navigator.onLine) {
        setTimeout(() => {
          window.location.hash = '#/';
          window.location.reload();
        }, 1000);
      }
      return;
    }

    if (isChunkLoadError(error)) {
      console.warn('Erreur de chargement de module dynamique détectée par ErrorBoundary:', error);
      // NEVER reload automatically while offline (wipes app state and fails offline!)
      if (typeof window !== 'undefined' && navigator.onLine) {
        const chunkReloadKey = 'chunk_reload_attempt';
        const lastAttempt = sessionStorage.getItem(chunkReloadKey);
        const now = Date.now();
        if (!lastAttempt || now - Number(lastAttempt) > 30000) {
          sessionStorage.setItem(chunkReloadKey, String(now));
          setTimeout(() => {
            if (navigator.onLine) window.location.reload();
          }, 300);
          return;
        }
      }
      return;
    }

    console.error('Uncaught error in ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      const isAuthError = isRefreshTokenError(this.state.error);
      const isChunkError = isChunkLoadError(this.state.error);
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

      return (
        <div className="h-full min-h-[380px] bg-slate-50 flex flex-col items-center justify-center p-6 rounded-2xl border border-slate-200">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200/80 max-w-xl w-full text-center">
            <div className={`w-14 h-14 ${isAuthError ? 'bg-indigo-100 text-indigo-600' : isChunkError ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-600'} rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-bold`}>
              {isAuthError ? '🔒' : isChunkError ? '📶' : '⚠️'}
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight mb-2">
              {isAuthError
                ? 'Session expirée'
                : isChunkError
                  ? (isOffline ? 'Module non disponible hors-ligne' : 'Chargement interrompu')
                  : 'Oups ! Une erreur est survenue'}
            </h1>
            <p className="text-slate-600 text-sm mb-6 leading-relaxed">
              {isAuthError
                ? 'Votre session de sécurité a expiré. Veuillez vous reconnecter pour continuer.'
                : isChunkError
                  ? (isOffline
                      ? 'Votre connexion Internet est coupée et cette page n’était pas encore en cache. Vous pouvez ouvrir le Coffre Hors-ligne ou revenir au Tableau de Bord.'
                      : 'Le téléchargement de ce module a été interrompu par une connexion instable. Cliquez sur Réessayer.')
                  : 'Un problème inattendu s’est produit sur cette page. Vous pouvez réessayer sans perdre votre navigation.'}
            </p>

            {(!isAuthError && !isChunkError && import.meta.env.DEV) && (
              <div className="text-left mb-6">
                <p className="text-xs font-bold text-slate-400 tracking-wider mb-2">Détails techniques</p>
                <pre className="bg-slate-900 p-4 rounded-xl overflow-auto text-xs text-indigo-400 whitespace-pre-wrap max-h-48 custom-scrollbar">
                  {this.state.error?.toString()}
                </pre>
              </div>
            )}

            <div className="flex flex-wrap gap-2.5 justify-center">
              {!isAuthError && (
                <button
                  type="button"
                  onClick={() => this.setState({ hasError: false, error: null })}
                  className="px-5 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Réessayer
                </button>
              )}
              {isChunkError && (
                <button
                  type="button"
                  onClick={() => {
                    window.location.hash = '#/offline';
                    this.setState({ hasError: false, error: null });
                  }}
                  className="px-5 py-2.5 bg-rose-600 text-white rounded-xl hover:bg-rose-700 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Coffre Hors-ligne
                </button>
              )}
              {!isAuthError && (
                <button
                  type="button"
                  onClick={() => {
                    window.location.hash = '#/';
                    this.setState({ hasError: false, error: null });
                  }}
                  className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Tableau de Bord
                </button>
              )}
              {(isAuthError || (!isOffline && !isChunkError)) && (
                <button
                  type="button"
                  onClick={() => {
                    if (isAuthError) clearAuthStorage();
                    window.location.reload();
                  }}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-sm font-semibold transition-colors cursor-pointer"
                >
                  {isAuthError ? 'Se reconnecter' : 'Recharger l’application'}
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
