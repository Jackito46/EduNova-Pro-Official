
import { createClient } from '@supabase/supabase-js';

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

// Helper to check if any stored auth token exists
export const hasStoredAuthToken = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const isLoggedOut = window.localStorage.getItem('edunova_logged_out') === 'true';
    if (isLoggedOut) return false;

    const keys = ['edunova-auth-token', 'supabase.auth.token'];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.startsWith('edunova'))) {
        keys.push(key);
      }
    }
    for (const k of keys) {
      const item = window.localStorage.getItem(k);
      if (item && (item.includes('access_token') || item.includes('current_session_id'))) {
        return true;
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
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout
    
    // Use the auth health endpoint with no-cors. This is extremely fast,
    // does not require any custom headers, and completely bypasses CORS preflight (OPTIONS)
    // which eliminates a whole round-trip of latency and prevents false "slow connection" triggers.
    const response = await fetch(`${supabaseUrl}/auth/v1/health`, { 
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return true; // If fetch didn't throw, the server is reachable and we are online!
  } catch (err: any) {
    // Fallback: try the REST endpoint if auth/v1/health failed (some local setups might proxy differently)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'GET',
        headers: { 
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json'
        },
        mode: 'cors',
        cache: 'no-store',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok || (response.status >= 400 && response.status < 500);
    } catch (e) {
      return false;
    }
  }
};

// Helper to clear all auth-related storage
export const clearAuthStorage = () => {
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
      try { window.sessionStorage.removeItem(key); } catch (e) {}
    });
    
    // Clear all keys starting with 'sb-' or 'edunova' from both storages
    const clearByPrefix = (storage: Storage) => {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key && (key.startsWith('sb-') || key.startsWith('edunova'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => storage.removeItem(key));
      } catch (e) {
        console.error("Error clearing storage by prefix:", e);
      }
    };

    clearByPrefix(window.localStorage);
    clearByPrefix(window.sessionStorage);

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
