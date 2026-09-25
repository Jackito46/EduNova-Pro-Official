
import { createClient } from '@supabase/supabase-js';
import { supabaseLatencyTracker } from './services/supabaseLatencyTracker';

const envUrl = import.meta.env.VITE_SUPABASE_URL;
let originalSupabaseUrl = envUrl || 'https://iymzthjkucvhyjnxpslg.supabase.co';

// Ensure protocol is present
if (originalSupabaseUrl && !originalSupabaseUrl.startsWith('http')) {
  // If it's a local IP or localhost, default to http, otherwise https
  const isLocal = originalSupabaseUrl.includes('localhost') || 
                  originalSupabaseUrl.includes('127.0.0.1') || 
                  originalSupabaseUrl.match(/^192\.168\./) || 
                  originalSupabaseUrl.match(/^10\./);
  originalSupabaseUrl = `${isLocal ? 'http' : 'https'}://${originalSupabaseUrl}`;
}

if (originalSupabaseUrl.endsWith('/')) {
  originalSupabaseUrl = originalSupabaseUrl.slice(0, -1);
}

export const supabaseUrl = originalSupabaseUrl;

export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

// Safe storage wrapper to prevent crashes in iframes when third-party cookies are blocked
// and to provide an in-memory fallback for session stability.
const inMemoryStorage: Record<string, string> = {};

// Helper to check if a string is a valid UUID
export const isValidUuid = (id: any): boolean => {
  if (typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

const safeStorage = {
  getItem: (key: string) => {
    try {
      const value = window.localStorage.getItem(key);
      if (value !== null) return value;
      return inMemoryStorage[key] || null;
    } catch (e) {
      console.warn('localStorage is not available, using in-memory fallback:', e);
      return inMemoryStorage[key] || null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      console.warn('localStorage is not available, using in-memory fallback:', e);
    }
    inMemoryStorage[key] = value;
  },
  removeItem: (key: string) => {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      console.warn('localStorage is not available, using in-memory fallback:', e);
    }
    delete inMemoryStorage[key];
  }
};

// Helper to check if any valid stored auth token exists
export const hasStoredAuthToken = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const isLoggedOut = window.localStorage.getItem('edunova_logged_out') === 'true';
    if (isLoggedOut) return false;

    // Check EduNova specific auth token
    const tokenStr = window.localStorage.getItem('edunova-auth-token') || window.localStorage.getItem('supabase.auth.token');
    if (tokenStr) {
      try {
        const parsed = JSON.parse(tokenStr);
        // Supabase stores either { access_token, expires_at } or { currentSession: { access_token } }
        const session = parsed?.currentSession || parsed;
        if (session?.access_token) {
          // If token has an expiration and is expired by more than 2 hours without refresh, ignore it
          if (session.expires_at && typeof session.expires_at === 'number') {
            const expiresAtMs = session.expires_at > 1e11 ? session.expires_at : session.expires_at * 1000;
            if (expiresAtMs < Date.now() - 7200000) {
              return false;
            }
          }
          return true;
        }
      } catch (e) {}
    }

    // Check other Supabase project tokens
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
        const val = window.localStorage.getItem(key);
        if (val && val.includes('access_token')) {
          try {
            const parsed = JSON.parse(val);
            const session = parsed?.currentSession || parsed;
            if (session?.access_token) {
              return true;
            }
          } catch (e) {}
        }
      }
    }
  } catch (e) {}
  return false;
};

// Helper to check if Supabase is reachable
export const checkSupabaseConnection = async (): Promise<boolean> => {
  // If the browser explicitly says we are offline, don't even try to fetch
  if (typeof window !== 'undefined' && !window.navigator.onLine) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout for high-latency mobile networks
    
    // Auth health endpoint with apikey parameter to get a clean 200 OK without 401 unauthorized
    const healthUrl = `${supabaseUrl}/auth/v1/health?apikey=${encodeURIComponent(supabaseAnonKey)}`;
    const response = await fetch(healthUrl, { 
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok || (response.status >= 200 && response.status < 500);
  } catch (err: any) {
    // Fallback: try querying a lightweight rest endpoint with standard headers
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(`${supabaseUrl}/rest/v1/global_settings?select=key&limit=1`, {
        method: 'GET',
        headers: { 
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json'
        },
        cache: 'no-store',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok || (response.status >= 200 && response.status < 500);
    } catch (e) {
      // If browser indicates online, give user the benefit of the doubt
      return typeof window !== 'undefined' && window.navigator.onLine ? true : false;
    }
  }
};

/**
 * Détermine si une clé de stockage correspond à une préférence d'interface utilisateur (UI)
 * ou à un message système non sensible devant être conservé lors de la déconnexion.
 */
export const isUiPreferenceStorageKey = (key: string): boolean => {
  if (!key) return false;

  // Clés critiques absolues de préférences UI devant être conservées
  const preservedExactKeys = [
    'edunova_login_error',               // Notification/erreur de session affichée sur l'écran de login
    'edunova_pwa_banner_dismissed',       // Acquittement de la bannière PWA
    'edunova_pwa_installed',              // Statut d'installation PWA
    'edunova_address_bar_hint_dismissed', // Acquittement du hint de barre d'adresse
    'edunova_hide_security_banner',       // Acquittement de la bannière de sécurité
    'push_banner_dismissed',              // Acquittement du bandeau de notifications push
    'push_denied_dismissed',              // Acquittement du refus de notification push
    'theme',                              // Thème visuel global (dark/light)
    'edunova_theme',                      // Thème spécifique EduNova
    'theme_mode',                         // Mode d'affichage visuel
    'color-scheme',                       // Schéma de couleur
    'sidebar_collapsed',                  // Repli de la barre latérale
    'edunova_sidebar_collapsed',          // Préférence sidebar EduNova
    'edunova_current_campus_id',          // Annexe sélectionnée par défaut
    'locale',                             // Langue / Internationalisation
    'language',
    'edunova_language',
    'fontSize',                           // Taille de police / Accessibilité
    'edunova_font_size'
  ];

  if (preservedExactKeys.includes(key)) {
    return true;
  }

  // Clés préfixées spécifiques pour l'interface (ex: bannières d'abonnement acquittées par école)
  if (key.startsWith('dismiss_sub_banner_')) {
    return true;
  }

  // Règle de sécurité absolue : Ne JAMAIS conserver une clé qui contient un identifiant sensible
  const sensitiveTokens = [
    'token',
    'session_id',
    'session_active',
    'session_synced',
    'user_profile',
    'auth',
    'password',
    'secret',
    'jwt',
    'credential',
    'stats',
    'cache',
    'draft',
    'subscription'
  ];

  const lowerKey = key.toLowerCase();
  for (const token of sensitiveTokens) {
    if (lowerKey.includes(token)) {
      return false;
    }
  }

  // Motifs de préférences d'affichage UI courantes
  const uiSuffixes = [
    '_dismissed',
    '_hint',
    '_banner',
    '_collapsed',
    '_expanded',
    '_theme',
    '_mode',
    '_view_mode',
    '_display_mode',
    '_preference',
    '_pref',
    '_prefs'
  ];

  return uiSuffixes.some(suffix => lowerKey.endsWith(suffix));
};

/**
 * Nettoie sélectivement le sessionStorage :
 * - Supprime tous les jetons d'accès, jetons de rafraîchissement Supabase (sb-*),
 *   identifiants de session utilisateur, profils locaux, et caches de données sensibles.
 * - Préserve intactes toutes les préférences UI de l'utilisateur (thème, bannières rejetées,
 *   état de la barre latérale, et message de redirection d'erreur de connexion).
 */
export const purgeSelectiveSessionStorage = (preserveLoginError: boolean = true) => {
  if (typeof window === 'undefined' || !window.sessionStorage) return;

  try {
    const savedPreferences: Record<string, string> = {};
    const keysToRemove: string[] = [];

    // 1. Sauvegarde préventive des préférences UI
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (!key) continue;

      if (isUiPreferenceStorageKey(key)) {
        if (key === 'edunova_login_error' && !preserveLoginError) {
          keysToRemove.push(key);
        } else {
          const val = window.sessionStorage.getItem(key);
          if (val !== null) {
            savedPreferences[key] = val;
          }
        }
      } else {
        // Toute clé non identifiée comme préférence UI est candidate à la suppression
        keysToRemove.push(key);
      }
    }

    // 2. Suppression systématique des clés sensibles ou non-UI
    keysToRemove.forEach(key => {
      try {
        window.sessionStorage.removeItem(key);
      } catch (e) {}
    });

    // 3. Réapplication garantie des préférences UI sauvegardées
    Object.entries(savedPreferences).forEach(([key, value]) => {
      try {
        window.sessionStorage.setItem(key, value);
      } catch (e) {}
    });
  } catch (err) {
    console.error("Erreur lors de la purge sélective du sessionStorage :", err);
  }
};

export interface ClearAuthStorageOptions {
  preserveUiPreferences?: boolean;
}

// Helper to clear all auth-related storage
export const clearAuthStorage = (options: ClearAuthStorageOptions = { preserveUiPreferences: true }) => {
  console.warn("Clearing all auth-related storage and purging caches...");
  if (typeof window === 'undefined') return;

  try {
    // Clear in-memory storage
    Object.keys(inMemoryStorage).forEach(key => delete inMemoryStorage[key]);
    
    const storageKeys = [
      'edunova-auth-token',
      'edunova_user_profile',
      'edunova_session_id',
      'supabase.auth.token'
    ];

    // Clear specific keys
    storageKeys.forEach(key => {
      try { window.localStorage.removeItem(key); } catch (e) {}
    });
    
    // Clear all keys starting with 'sb-' or 'edunova' from localStorage (sauf préférences préservées)
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.startsWith('edunova'))) {
          if (options.preserveUiPreferences && isUiPreferenceStorageKey(key)) {
            continue;
          }
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => window.localStorage.removeItem(key));
    } catch (e) {
      console.error("Error clearing localStorage by prefix:", e);
    }

    // Nettoyage sélectif du sessionStorage
    if (options.preserveUiPreferences !== false) {
      purgeSelectiveSessionStorage(true);
    } else {
      try {
        window.sessionStorage.clear();
      } catch (e) {}
    }

    // Set explicit flag indicating user logged out
    try { window.localStorage.setItem('edunova_logged_out', 'true'); } catch (e) {}

    // Send purge message to Service Worker
    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
      try {
        navigator.serviceWorker.controller.postMessage({ type: 'PURGE_SESSION_CACHE' });
      } catch (e) {}
    }

    // Purge window CacheStorage directly
    if ('caches' in window) {
      try {
        caches.keys().then(cacheNames => {
          Promise.all(
            cacheNames
              .filter(name => name.includes('supabase') || name.includes('session') || name.includes('user'))
              .map(name => caches.delete(name))
          );
        });
      } catch (e) {}
    }

  } catch (e) {
    console.error("Error in clearAuthStorage:", e);
  }
};

// Validation de l'URL Supabase
if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
  console.error("CRITICAL: VITE_SUPABASE_URL est invalide ou manquante. L'application ne pourra pas se connecter à la base de données.");
}

// Safe global fetch wrapper that catches network errors, retries transient failures, and returns structured 503 responses
const safeFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const maxRetries = 2;
  const startTime = performance.now();
  const method = (init?.method || 'GET').toUpperCase();
  const urlStr = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input as Request)?.url || '');

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let reqInit = init;
    let timeoutId: any = null;
    if (!init?.signal) {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 25000); // 25s request timeout guard
      reqInit = { ...init, signal: controller.signal };
    }
    try {
      const response = await fetch(input, reqInit);
      if (timeoutId) clearTimeout(timeoutId);

      const durationMs = Math.round(performance.now() - startTime);
      try {
        const parsed = supabaseLatencyTracker.parseUrlDetails(urlStr, method);
        const cl = response.headers.get('content-length');
        const bytes = cl ? parseInt(cl, 10) : undefined;
        supabaseLatencyTracker.logRequest({
          timestamp: Date.now(),
          method,
          url: urlStr,
          displayEndpoint: parsed.displayEndpoint,
          table: parsed.table,
          status: response.status,
          statusText: response.statusText,
          durationMs,
          bytesReceived: bytes,
          isError: !response.ok && response.status >= 400,
          errorMessage: !response.ok ? `HTTP ${response.status} ${response.statusText}` : undefined,
          queryType: parsed.queryType,
          isIdentityQuery: parsed.isIdentityQuery
        });
      } catch (logErr) {
        // Tracker logging should never break the request flow
      }

      return response;
    } catch (err: any) {
      if (timeoutId) clearTimeout(timeoutId);
      const isNetworkError = 
        err.name === 'AbortError' ||
        err.message === 'Failed to fetch' || 
        err.name === 'TypeError' || 
        (err.message && err.message.toLowerCase().includes('fetch'));
        
      if (isNetworkError && attempt < maxRetries) {
        // Wait briefly before retrying transient network glitches with exponential backoff
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
        continue;
      }

      const durationMs = Math.round(performance.now() - startTime);
      try {
        const parsed = supabaseLatencyTracker.parseUrlDetails(urlStr, method);
        supabaseLatencyTracker.logRequest({
          timestamp: Date.now(),
          method,
          url: urlStr,
          displayEndpoint: parsed.displayEndpoint,
          table: parsed.table,
          status: isNetworkError ? 503 : 500,
          statusText: err.name || 'NetworkError',
          durationMs,
          isError: true,
          errorMessage: err.message || 'Impossible de contacter le serveur Supabase',
          queryType: parsed.queryType,
          isIdentityQuery: parsed.isIdentityQuery
        });
      } catch (logErr) {}

      if (isNetworkError) {
        return new Response(JSON.stringify({
          message: "Erreur réseau: Impossible de contacter le serveur de base de données. Vérifiez votre connexion internet.",
          code: "NETWORK_ERROR"
        }), {
          status: 503,
          statusText: "Service Unavailable",
          headers: { 'Content-Type': 'application/json' }
        });
      }
      throw err;
    }
  }

  const durationMs = Math.round(performance.now() - startTime);
  try {
    const parsed = supabaseLatencyTracker.parseUrlDetails(urlStr, method);
    supabaseLatencyTracker.logRequest({
      timestamp: Date.now(),
      method,
      url: urlStr,
      displayEndpoint: parsed.displayEndpoint,
      table: parsed.table,
      status: 503,
      statusText: 'Service Unavailable',
      durationMs,
      isError: true,
      errorMessage: "Erreur réseau: Serveur indisponible après tentatives.",
      queryType: parsed.queryType,
      isIdentityQuery: parsed.isIdentityQuery
    });
  } catch (e) {}

  return new Response(JSON.stringify({
    message: "Erreur réseau: Serveur indisponible.",
    code: "NETWORK_ERROR"
  }), {
    status: 503,
    statusText: "Service Unavailable",
    headers: { 'Content-Type': 'application/json' }
  });
};

const client = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: safeStorage,
    storageKey: 'edunova-auth-token',
    // Disable navigator.locks to prevent timeout in iframe environments
    lock: (name, acquireTimeout, fn) => fn(),
  },
  global: {
    fetch: safeFetch
  }
});

// Helper to detect refresh token errors
export const isRefreshTokenError = (error: any): boolean => {
  if (!error) return false;
  
  // Handle Supabase error objects and strings robustly
  const msg = [
    error?.message,
    error?.error_description,
    error?.error,
    error?.msg,
    error?.reason,
    typeof error === 'string' ? error : '',
    error?.toString?.()
  ].filter(Boolean).join(' ').toLowerCase();
  
  const code = (error?.code || error?.status || error?.statusCode || '').toString().toLowerCase();

  // If this is a password validation error, user validation error, or standard 400 Bad Request, it is NOT a refresh token error.
  if (msg.includes('password') || msg.includes('mot de passe')) {
    return false;
  }

  // Do NOT match generic "session" strings or temporary JWT expirations that Supabase auto-refreshes.
  // Only match explicit, unrecoverable refresh token errors from Supabase Auth.
  const result = (
    msg.includes('refresh token not found') || 
    msg.includes('invalid refresh token') || 
    msg.includes('refresh_token_not_found') ||
    msg.includes('invalid_refresh_token') ||
    (msg.includes('refresh token') && (msg.includes('not found') || msg.includes('invalid') || msg.includes('expired') || msg.includes('already been used'))) ||
    msg.includes('invalid grant') ||
    msg.includes('invalid_grant') ||
    msg.includes('refresh token is invalid') ||
    msg.includes('refresh token is expired') ||
    msg.includes('refresh token not valid') ||
    msg.includes('refresh token has already been used') ||
    code === 'refresh_token_not_found' ||
    code === 'invalid_grant' ||
    error?.message === 'Invalid Refresh Token: Refresh Token Not Found' ||
    error?.message?.includes('Refresh Token Not Found') ||
    error?.description?.includes('Refresh Token Not Found')
  );

  return result;
};

// Global listeners to catch unhandled refresh token errors from Supabase internal timers
if (typeof window !== 'undefined') {
  const handleGlobalAuthError = (event: any) => {
    const error = event.reason || event.error || event;
    
    if (isRefreshTokenError(error)) {
      // Prevent the error from hitting ErrorBoundary or console
      if (typeof event.preventDefault === 'function') {
        event.preventDefault();
      }

      // Prevent multiple simultaneous reloads
      if ((window as any)._isClearingAuth) return;
      (window as any)._isClearingAuth = true;
      
      console.warn("Global Auth Handler: Detected refresh token error, clearing storage (suppressed trace)");
      clearAuthStorage();
      
      // Use a small delay to avoid multiple reloads if multiple errors occur
      setTimeout(() => {
        (window as any)._isClearingAuth = false;
        window.dispatchEvent(new CustomEvent('edunova_auth_error', { detail: { type: 'refresh_token' } }));
      }, 200);
    }
  };

  window.addEventListener('unhandledrejection', handleGlobalAuthError);
  window.addEventListener('error', handleGlobalAuthError);
}

// Proxy to intercept auth errors globally across Supabase auth calls
export const supabase = new Proxy(client, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    
    if (prop === 'auth') {
      return new Proxy(value, {
        get(authTarget, authProp, authReceiver) {
          const authValue = Reflect.get(authTarget, authProp, authReceiver);
          
          if (typeof authValue === 'function') {
            return (...args: any[]) => {
              // Intercept onAuthStateChange to wrap the callback
              if (authProp === 'onAuthStateChange' && typeof args[0] === 'function') {
                const originalCallback = args[0];
                args[0] = async (event: any, session: any) => {
                  try {
                    return await originalCallback(event, session);
                  } catch (error: any) {
                    if (isRefreshTokenError(error)) {
                      handleDetectedAuthError(error);
                    }
                    throw error;
                  }
                };
              }

              try {
                const result = authValue.apply(authTarget, args);
                
                if (result instanceof Promise) {
                  return result.then((res: any) => {
                    if (res && res.error) {
                      if (isRefreshTokenError(res.error)) {
                        handleDetectedAuthError(res.error);
                        res.error.message = "Session expirée. Veuillez vous reconnecter.";
                        return { data: { session: null, user: null }, error: res.error };
                      } else if (res.error.message === 'Failed to fetch') {
                        res.error.message = "Erreur réseau: Impossible de contacter le serveur. Vérifiez votre connexion internet.";
                      }
                    }
                    return res;
                  }).catch((error: any) => {
                    if (isRefreshTokenError(error)) {
                      handleDetectedAuthError(error);
                      if (error) error.message = "Session expirée. Veuillez vous reconnecter.";
                      return { data: { session: null, user: null }, error: error };
                    } else if (error && error.message === 'Failed to fetch') {
                      error.message = "Erreur réseau: Impossible de contacter le serveur. Vérifiez votre connexion internet.";
                    }
                    throw error;
                  });
                }
                
                if (result && result.error) {
                  if (isRefreshTokenError(result.error)) {
                    handleDetectedAuthError(result.error);
                    result.error.message = "Session expirée. Veuillez vous reconnecter.";
                  } else if (result.error.message === 'Failed to fetch') {
                    result.error.message = "Erreur réseau: Impossible de contacter le serveur. Vérifiez votre connexion internet.";
                  }
                }
                
                return result;
              } catch (error: any) {
                if (isRefreshTokenError(error)) {
                  handleDetectedAuthError(error);
                  if (error) error.message = "Session expirée. Veuillez vous reconnecter.";
                  return { data: { session: null, user: null }, error: error };
                } else if (error && error.message === 'Failed to fetch') {
                  error.message = "Erreur réseau: Impossible de contacter le serveur. Vérifiez votre connexion internet.";
                }
                throw error;
              }
            };
          }
          return authValue;
        }
      });
    }
    
    return value;
  }
});

// Helper to handle detected auth errors consistently
function handleDetectedAuthError(error: any) {
  if (typeof window === 'undefined') return;
  if ((window as any)._isClearingAuth) return;
  (window as any)._isClearingAuth = true;
  
  console.warn("Supabase Proxy: Detected refresh token error, clearing storage (suppressed trace)");
  
  // Clear all storage immediately
  clearAuthStorage();
  
  // Also try to sign out just in case the SDK can still do it
  try { client.auth.signOut(); } catch (e) {}
  
  try {
    const reloadCount = parseInt(window.sessionStorage.getItem('auth_reload_count') || '0');
    if (reloadCount > 3) {
      console.error("Too many auth reloads. Stopping to prevent loop.");
      return;
    }
    window.sessionStorage.setItem('auth_reload_count', (reloadCount + 1).toString());
  } catch (e) {}
  
  setTimeout(() => {
    (window as any)._isClearingAuth = false;
    window.dispatchEvent(new CustomEvent('edunova_auth_error', { detail: { type: 'refresh_token' } }));
  }, 300);
}
