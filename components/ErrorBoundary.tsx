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
      if (typeof window !== 'undefined') {
         setTimeout(() => {
             window.location.hash = '#/';
             window.location.reload();
         }, 1000);
      }
      return;
    }

    if (isChunkLoadError(error)) {
      console.warn('Erreur de chargement de module dynamique détectée par ErrorBoundary:', error);
      if (typeof window !== 'undefined') {
        const chunkReloadKey = 'chunk_reload_attempt';
        const lastAttempt = sessionStorage.getItem(chunkReloadKey);
        const now = Date.now();
        // Si aucun rechargement dans les 20 dernières secondes, auto-reload transparent
        if (!lastAttempt || now - Number(lastAttempt) > 20000) {
          sessionStorage.setItem(chunkReloadKey, String(now));
          setTimeout(() => {
            window.location.reload();
          }, 300);
          return;
        }
      }
    }

    console.error('Uncaught error in ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      const isAuthError = isRefreshTokenError(this.state.error);
      const isChunkError = isChunkLoadError(this.state.error);

      return (
        <div className="h-full min-h-[400px] bg-slate-50 flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-slate-200">
          <div className="bg-white p-8 rounded-2xl shadow-sm max-w-2xl w-full text-center">
            <div className={`w-16 h-16 ${isAuthError ? 'bg-indigo-100 text-indigo-600' : isChunkError ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'} rounded-full flex items-center justify-center mx-auto mb-4 text-3xl`}>
              {isAuthError ? '🔒' : isChunkError ? '🔄' : '⚠️'}
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight mb-2 ">
              {isAuthError ? 'Session expirée' : isChunkError ? 'Mise à jour disponible' : 'Oups ! Une erreur est survenue'}
            </h1>
            <p className="text-slate-500 mb-6">
              {isAuthError 
                ? 'Votre session de sécurité a expiré. Veuillez vous reconnecter pour continuer.' 
                : isChunkError
                ? 'Une mise à jour des composants système a été installée ou la connexion réseau a été renouvelée. Veuillez actualiser pour afficher la version à jour.'
                : 'Un problème inattendu s\'est produit sur cette page. Vous pouvez essayer de recharger ou naviguer vers une autre section.'}
            </p>
            
            {(!isAuthError && !isChunkError && import.meta.env.DEV) && (
              <div className="text-left mb-6">
                <p className="text-xs font-bold text-slate-400 tracking-wider mb-2">Détails techniques</p>
                <pre className="bg-slate-900 p-4 rounded-xl overflow-auto text-xs text-indigo-400 whitespace-pre-wrap max-h-48 custom-scrollbar">
                  {this.state.error?.toString()}
                </pre>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {!isAuthError && !isChunkError && (
                <button 
                  onClick={() => window.history.back()}
                  className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 font-bold transition-colors cursor-pointer"
                >
                  Retour en arrière
                </button>
              )}
              <button 
                onClick={() => {
                  if (isAuthError) clearAuthStorage();
                  window.location.reload();
                }}
                className={`px-6 py-3 ${isAuthError ? 'bg-indigo-600' : isChunkError ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[#1e3a8a]'} text-white rounded-xl hover:opacity-90 font-bold transition-colors shadow-lg shadow-blue-900/20 cursor-pointer`}
              >
                {isAuthError ? 'Se reconnecter' : isChunkError ? 'Actualiser l\'application' : 'Recharger la page'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
