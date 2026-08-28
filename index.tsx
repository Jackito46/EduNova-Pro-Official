
import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { SecurityProvider } from './components/SecurityGuard';
import './index.css';
import { isRefreshTokenError, clearAuthStorage } from './supabase';

import { registerSW } from 'virtual:pwa-register';

if ('serviceWorker' in navigator) {
  let isRefreshing = false;

  // Forcer le rechargement automatique dès que le nouveau Service Worker prend le contrôle
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!isRefreshing) {
      isRefreshing = true;
      console.log("⚡ [EduNova SW] Nouveau Service Worker activé, rechargement automatique de l'interface...");
      window.location.reload();
    }
  });

  try {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log("⚡ [EduNova SW] Nouvelle version détectée, application immédiate de la mise à jour...");
        updateSW(true);
      },
      onOfflineReady() {
        console.log("⚡ [EduNova SW] Prêt pour le fonctionnement hors-ligne.");
      },
      onRegistered(registration) {
        console.log('⚡ [EduNova SW] Enregistré avec succès :', registration);
        if (registration) {
          registration.update().catch(() => {});

          const checkForUpdates = () => {
            registration.update().catch(err => console.debug('SW update check error:', err));
          };

          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              checkForUpdates();
            }
          });

          window.addEventListener('focus', checkForUpdates);
          setInterval(checkForUpdates, 10 * 60 * 1000);
        }
      },
      onRegisterError(error) {
        console.warn('SW registerSW fallback to direct /sw.js:', error);
        navigator.serviceWorker.register('/sw.js').catch(err => {
          console.debug('Fallback SW registration error:', err);
        });
      }
    });
  } catch (err) {
    console.warn('Vite PWA registerSW failed, fallback to native /sw.js registration:', err);
    navigator.serviceWorker.register('/sw.js').catch(() => {});
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
