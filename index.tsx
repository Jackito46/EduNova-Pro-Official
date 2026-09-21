
import { initConsoleSanitizer } from './utils/consoleSanitizer';

// Initialisation précoce de l'interception et du nettoyage des logs de la console
initConsoleSanitizer();

import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { SecurityProvider } from './components/SecurityGuard';
import './index.css';
import { isRefreshTokenError, clearAuthStorage } from './supabase';

import { registerSW } from 'virtual:pwa-register';

// Détection d'environnement : Cloud Run / AI Studio preview ou développement local
const isPreviewOrDevHost = 
  typeof window !== 'undefined' && (
    window.location.hostname.includes('run.app') || 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1'
  );

if ('serviceWorker' in navigator) {
  if (isPreviewOrDevHost) {
    // Dans l'environnement Cloud Run / AI Studio preview, purger tout Service Worker
    // pour éviter les caches obsolètes, 404 sur les chunks et les blocages au splashscreen.
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister().catch(() => {});
      }
    });
    if ('caches' in window) {
      caches.keys().then((keys) => {
        keys.forEach((k) => caches.delete(k));
      });
    }
  } else if (import.meta.env.PROD) {
    // Uniquement sur les domaines de production dédiés (ex: edunova.pro, onrender.com)
    let isRefreshing = false;

    // Protection anti-boucle : rechargement au plus une fois par minute
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const lastReload = sessionStorage.getItem('edunova_sw_last_reload');
          const now = Date.now();
          if (!lastReload || now - parseInt(lastReload, 10) > 60000) {
            sessionStorage.setItem('edunova_sw_last_reload', String(now));
            console.log("⚡ [EduNova SW] Nouveau Service Worker activé, rechargement contrôlé...");
            window.location.reload();
          }
        } catch (e) {
          window.location.reload();
        }
      }
    });

    try {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          console.log("⚡ [EduNova SW] Nouvelle version détectée, mise à jour...");
          updateSW(true);
        },
        onOfflineReady() {
          console.log("⚡ [EduNova SW] Prêt pour le fonctionnement hors-ligne.");
        },
        onRegistered(registration) {
          if (registration) {
            registration.update().catch(() => {});

            const checkForUpdates = () => {
              registration.update().catch(err => console.debug('SW update check notice:', err));
            };

            document.addEventListener('visibilitychange', () => {
              if (document.visibilityState === 'visible') {
                checkForUpdates();
              }
            });

            window.addEventListener('focus', checkForUpdates);
            setInterval(checkForUpdates, 15 * 60 * 1000);
          }
        },
        onRegisterError(error) {
          console.debug('SW registration notice:', error);
        }
      });
    } catch (err) {
      console.debug('SW registration skipped:', err);
    }
  }
}

console.log("index.tsx: Script loaded");

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    if (isRefreshTokenError(error)) {
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    if (isRefreshTokenError(error)) {
      console.warn("Refresh token error detected in ErrorBoundary, clearing storage...");
      clearAuthStorage();
      window.dispatchEvent(new CustomEvent('edunova_auth_error', { detail: { type: 'refresh_token' } }));
    }
  }

  componentDidMount() {
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const error = event.reason || event;
    if (isRefreshTokenError(error)) {
      console.warn("Caught unhandled refresh token rejection, preventing crash...");
      event.preventDefault(); // Prevents the error from crashing the app/showing overlay
      clearAuthStorage();
      window.dispatchEvent(new CustomEvent('edunova_auth_error', { detail: { type: 'refresh_token' } }));
    }
  };

  render() {
    if (this.state.hasError) {
      const isAuthError = isRefreshTokenError(this.state.error);

      return (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          minHeight: '100vh', 
          backgroundColor: '#f8fafc', 
          color: '#0f172a',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '20px',
          textAlign: 'center'
        }}>
          <div style={{
            background: '#ffffff',
            padding: '40px',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>
              {isAuthError ? '🔒' : '⚠️'}
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', color: isAuthError ? '#38bdf8' : '#f87171' }}>
              {isAuthError ? 'Session expirée' : 'Une erreur est survenue'}
            </h1>
            <p style={{ color: '#94a3b8', marginBottom: '24px', lineHeight: '1.5' }}>
              {isAuthError 
                ? 'Votre session de sécurité a expiré. Veuillez vous reconnecter pour continuer à utiliser EduNova.' 
                : 'Un problème technique inattendu s\'est produit. Nous nous excusons pour la gêne occasionnée.'}
            </p>
            
            {!isAuthError && import.meta.env.DEV && (
              <pre style={{ 
                whiteSpace: 'pre-wrap', 
                background: '#020617', 
                padding: '16px', 
                borderRadius: '8px',
                fontSize: '12px',
                color: '#f87171',
                textAlign: 'left',
                overflowX: 'auto',
                marginBottom: '24px'
              }}>
                {this.state.error?.toString()}
              </pre>
            )}

            <button 
              onClick={() => {
                clearAuthStorage();
                window.location.reload();
              }} 
              style={{ 
                padding: '12px 24px', 
                backgroundColor: isAuthError ? '#0284c7' : '#dc2626', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                fontSize: '16px', 
                fontWeight: 'bold', 
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = isAuthError ? '#0369a1' : '#b91c1c'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = isAuthError ? '#0284c7' : '#dc2626'}
            >
              {isAuthError ? 'Se reconnecter' : 'Recharger l\'application'}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Notification au document que React prend la main
if (typeof window !== 'undefined') {
  (window as any).__edunovaAppReady = true;
  if (typeof (window as any).__dismissEduNovaSplash === 'function') {
    (window as any).__dismissEduNovaSplash();
  }
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <SecurityProvider>
        <App />
      </SecurityProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// Nettoyage de secours garanti après montage
if (typeof window !== 'undefined') {
  requestAnimationFrame(() => {
    const splash = document.getElementById('edunova-pwa-splash');
    if (splash) {
      splash.style.transition = 'opacity 0.25s ease-out';
      splash.style.opacity = '0';
      setTimeout(() => splash.remove(), 250);
    }
  });
}
