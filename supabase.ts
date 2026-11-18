
import { createClient } from '@supabase/supabase-js';

export type DeploymentMode = 'cloud' | 'lan' | 'standalone';

interface EduNovaRuntimeConfig {
  deploymentMode?: DeploymentMode;
  lanProxyEnabled?: boolean;
  lanServerLabel?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

const RUNTIME_CONFIG: EduNovaRuntimeConfig =
  typeof window !== 'undefined' && (window as any).__EDUNOVA_RUNTIME__
    ? (window as any).__EDUNOVA_RUNTIME__
    : {};

export const WORKSPACE_MODE_STORAGE_KEY = 'edunova_workspace_mode';
export const LAN_OVERRIDE_URL_STORAGE_KEY = 'edunova_lan_override_url';
export const LAN_OVERRIDE_ANON_KEY_STORAGE_KEY = 'edunova_lan_override_anon_key';

const DEFAULT_CLOUD_FALLBACK_URL = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const DEFAULT_CLOUD_FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

export function normalizeSupabaseEndpointUrl(rawUrl: string): string {
  let normalized = (rawUrl || '').trim();
  if (!normalized) return '';

  if (normalized.startsWith('/')) {
    if (typeof window !== 'undefined' && window.location?.origin) {
      normalized = `${window.location.origin}${normalized}`;
    }
  } else if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    const isLocal =
      normalized.includes('localhost') ||
      normalized.includes('127.0.0.1') ||
      normalized.includes('.local') ||
      /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(normalized);
    normalized = `${isLocal ? 'http' : 'https'}://${normalized}`;
  }

  return normalized.replace(/\/+$/, '');
}

function readStoredLanOverride(): { enabled: boolean; url: string; anonKey: string } {
  if (typeof window === 'undefined') return { enabled: false, url: '', anonKey: '' };
  try {
    const mode = window.localStorage.getItem(WORKSPACE_MODE_STORAGE_KEY);
    const url = window.localStorage.getItem(LAN_OVERRIDE_URL_STORAGE_KEY) || '';
    const anonKey = window.localStorage.getItem(LAN_OVERRIDE_ANON_KEY_STORAGE_KEY) || '';
    return {
      enabled: mode === 'lan' && Boolean(url.trim()),
      url: normalizeSupabaseEndpointUrl(url),
      anonKey: anonKey.trim(),
    };
  } catch {
    return { enabled: false, url: '', anonKey: '' };
  }
}

const storedLanOverride = readStoredLanOverride();

const runtimeDefaultUrl = RUNTIME_CONFIG.lanProxyEnabled
  ? normalizeSupabaseEndpointUrl(RUNTIME_CONFIG.supabaseUrl || '/local-supabase')
  : normalizeSupabaseEndpointUrl(
      RUNTIME_CONFIG.supabaseUrl || import.meta.env.VITE_SUPABASE_URL || DEFAULT_CLOUD_FALLBACK_URL
    );

export const supabaseUrl = storedLanOverride.enabled
  ? storedLanOverride.url
  : runtimeDefaultUrl || DEFAULT_CLOUD_FALLBACK_URL;

export const supabaseAnonKey =
  (storedLanOverride.enabled && storedLanOverride.anonKey) ||
  (RUNTIME_CONFIG.supabaseAnonKey || '').trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  DEFAULT_CLOUD_FALLBACK_ANON_KEY;

export interface DeploymentRuntimeInfo {
  mode: DeploymentMode;
  lanProxyActive: boolean;
  lanServerLabel: string;
  activeSupabaseUrl: string;
  defaultSupabaseUrl: string;
  hasCustomOverride: boolean;
  customServerUrl: string;
  customAnonKeyConfigured: boolean;
}

export function getDeploymentRuntimeInfo(): DeploymentRuntimeInfo {
  const override = readStoredLanOverride();
  const baseMode: DeploymentMode = RUNTIME_CONFIG.deploymentMode || (RUNTIME_CONFIG.lanProxyEnabled ? 'lan' : 'cloud');
  return {
    mode: override.enabled ? 'lan' : baseMode,
    lanProxyActive: Boolean(RUNTIME_CONFIG.lanProxyEnabled),
    lanServerLabel: RUNTIME_CONFIG.lanServerLabel || (baseMode === 'cloud' ? 'EduNova Cloud' : 'Serveur Local Établissement'),
    activeSupabaseUrl: supabaseUrl,
    defaultSupabaseUrl: runtimeDefaultUrl || DEFAULT_CLOUD_FALLBACK_URL,
    hasCustomOverride: override.enabled,
    customServerUrl: override.url,
    customAnonKeyConfigured: Boolean(override.anonKey),
  };
}

export function setLocalBackendOverride(options: { enabled: boolean; url?: string; anonKey?: string }): void {
  if (typeof window === 'undefined') return;
  try {
    if (!options.enabled) {
      window.localStorage.removeItem(WORKSPACE_MODE_STORAGE_KEY);
      window.localStorage.removeItem(LAN_OVERRIDE_URL_STORAGE_KEY);
      window.localStorage.removeItem(LAN_OVERRIDE_ANON_KEY_STORAGE_KEY);
      return;
    }
    const cleanUrl = normalizeSupabaseEndpointUrl(options.url || '');
    if (!cleanUrl) {
      throw new Error('Adresse du serveur local invalide.');
    }
    window.localStorage.setItem(WORKSPACE_MODE_STORAGE_KEY, 'lan');
    window.localStorage.setItem(LAN_OVERRIDE_URL_STORAGE_KEY, cleanUrl);
    if (options.anonKey && options.anonKey.trim()) {
      window.localStorage.setItem(LAN_OVERRIDE_ANON_KEY_STORAGE_KEY, options.anonKey.trim());
    } else {
      window.localStorage.removeItem(LAN_OVERRIDE_ANON_KEY_STORAGE_KEY);
    }
  } catch (err) {
    throw err;
  }
}

export async function testBackendEndpointConnection(
  rawUrl: string,
  anonKey?: string
): Promise<{ ok: boolean; resolvedUrl: string; latencyMs: number; error?: string }> {
  let candidate = normalizeSupabaseEndpointUrl(rawUrl);
  if (!candidate) {
    return { ok: false, resolvedUrl: '', latencyMs: 0, error: 'Adresse serveur vide.' };
  }

  const startedAt = Date.now();
  // Si l'utilisateur saisit l'URL racine du serveur EduNova LAN (ex: http://192.168.1.100:3000),
  // détecte automatiquement /api/lan/status et résout vers /local-supabase
  if (!candidate.endsWith('/local-supabase')) {
    try {
      const lanStatusRes = await fetch(`${candidate}/api/lan/status`, {
        method: 'GET',
        cache: 'no-store',
        signal: AbortSignal.timeout(2500),
      });
      if (lanStatusRes.ok) {
        const statusJson = await lanStatusRes.json().catch(() => null);
        if (statusJson?.lanProxyActive) {
          candidate = `${candidate}/local-supabase`;
        }
      }
    } catch {
      // Peut être une URL directe Kong (:8000) ou Supabase Cloud : on poursuit le test direct
    }
  }

  try {
    const keyToUse = (anonKey || '').trim() || supabaseAnonKey;
    const res = await fetch(`${candidate}/rest/v1/`, {
      method: 'GET',
      headers: {
        apikey: keyToUse,
        Authorization: `Bearer ${keyToUse}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    const latencyMs = Date.now() - startedAt;
    if (res.ok || (res.status >= 400 && res.status < 500)) {
      return { ok: true, resolvedUrl: candidate, latencyMs };
    }
    return {
      ok: false,
      resolvedUrl: candidate,
      latencyMs,
      error: `Réponse HTTP ${res.status} du serveur cible.`,
    };
  } catch (err: any) {
    return {
      ok: false,
      resolvedUrl: candidate,
      latencyMs: Date.now() - startedAt,
      error: err?.message || 'Serveur injoignable sur le réseau local (vérifiez IP et port 3000).',
    };
  }
}

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
  if (typeof window !== 'undefined' && window.navigator.onLine === false) {
    emitNetworkStatus({ online: false, reason: 'navigator-offline' });
    return false;
  }

  const startedAt = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout
    
    // Use the auth health endpoint with no-cors. This is extremely fast,
    // does not require any custom headers, and completely bypasses CORS preflight (OPTIONS)
    // which eliminates a whole round-trip of latency and prevents false "slow connection" triggers.
    await fetch(`${supabaseUrl}/auth/v1/health`, { 
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    emitNetworkStatus({ online: true, latencyMs: Date.now() - startedAt });
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
      const ok = response.ok || (response.status >= 400 && response.status < 500);
      emitNetworkStatus({ online: ok, latencyMs: Date.now() - startedAt, reason: ok ? undefined : 'health-check-failed' });
      return ok;
    } catch (e) {
      emitNetworkStatus({ online: false, latencyMs: Date.now() - startedAt, reason: 'health-check-failed' });
      return false;
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
    'edunova_font_size',
    'edunova_workspace_mode',             // Mode Serveur Local LAN / Cloud
    'edunova_lan_override_url',           // Adresse IP/URL du serveur local d'établissement
    'edunova_lan_override_anon_key'       // Clé anonyme locale configurée pour le poste
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

let lastNetworkFailureAt = 0;
let lastSuccessEmitAt = 0;

export const isEffectivelyOffline = (): boolean => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }
  return lastNetworkFailureAt > 0 && (Date.now() - lastNetworkFailureAt) < 15000;
};

export const clearNetworkFailureWindow = (): void => {
  lastNetworkFailureAt = 0;
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    lastNetworkFailureAt = 0;
  });
}

export const emitNetworkStatus = (detail: { online: boolean; latencyMs?: number; reason?: string }) => {
  if (typeof window === 'undefined') return;
  try {
    if (!detail.online) {
      lastNetworkFailureAt = Date.now();
    } else {
      const now = Date.now();
      // Throttle healthy status events unless recovering from a recent failure
      if (lastNetworkFailureAt === 0 && now - lastSuccessEmitAt < 5000) {
        return;
      }
      if (lastNetworkFailureAt > 0) {
        lastNetworkFailureAt = 0;
      }
      lastSuccessEmitAt = now;
    }
    window.dispatchEvent(new CustomEvent('edunova_network_status', { detail }));
  } catch {}
};

export const isNetworkOrTimeoutError = (err: any): boolean => {
  if (!err) return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const code = String(err?.code || '').toUpperCase();
  const status = Number(err?.status || err?.statusCode || 0);
  const name = String(err?.name || '');
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    code === 'NETWORK_ERROR' ||
    status === 503 ||
    name === 'AbortError' ||
    msg.includes('failed to fetch') ||
    msg.includes('erreur réseau') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('abort') ||
    msg.includes('load failed') ||
    msg.includes('service unavailable')
  );
};

export const withTimeout = async <T>(
  promise: PromiseLike<T>,
  ms: number = 8000,
  label: string = 'Timeout'
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const err: any = new Error(`Timeout (${ms}ms): ${label}`);
      err.code = 'NETWORK_ERROR';
      err.name = 'AbortError';
      reject(err);
    }, ms);
  });
  try {
    return await Promise.race([Promise.resolve(promise), timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
};

// Safe global fetch wrapper: fails fast when offline, prevents 75s+ timeout cascades, emits live network health events
const safeFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    emitNetworkStatus({ online: false, reason: 'navigator-offline' });
    return new Response(JSON.stringify({
      message: "Erreur réseau: Mode hors-ligne actif.",
      code: "NETWORK_ERROR"
    }), {
      status: 503,
      statusText: "Service Unavailable",
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const method = (init?.method || 'GET').toUpperCase();
  const isIdempotent = method === 'GET' || method === 'HEAD';
  const isHeavyEndpoint = urlStr.includes('/storage/v1/') || urlStr.includes('/functions/v1/') || urlStr.includes('/rpc/');
  const recentlyUnstable = lastNetworkFailureAt > 0 && (Date.now() - lastNetworkFailureAt) < 15000;
  const timeoutMs = isHeavyEndpoint ? 12000 : (recentlyUnstable ? 3500 : 7000);
  const maxRetries = isIdempotent && !recentlyUnstable ? 1 : 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (init?.signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }

    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let onCallerAbort: (() => void) | undefined;

    if (init?.signal) {
      onCallerAbort = () => controller.abort();
      init.signal.addEventListener('abort', onCallerAbort, { once: true });
    }
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const startedAt = Date.now();
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      if (onCallerAbort && init?.signal) init.signal.removeEventListener('abort', onCallerAbort);

      const latencyMs = Date.now() - startedAt;
      if (response.status !== 503) {
        emitNetworkStatus({ online: true, latencyMs });
      }
      return response;
    } catch (err: any) {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      if (onCallerAbort && init?.signal) init.signal.removeEventListener('abort', onCallerAbort);

      // If caller aborted explicitly, rethrow without masking
      if (init?.signal?.aborted) {
        throw err;
      }

      const elapsed = Date.now() - startedAt;
      const isNetworkError =
        err?.name === 'AbortError' ||
        err?.message === 'Failed to fetch' ||
        err?.name === 'TypeError' ||
        Boolean(err?.message && err.message.toLowerCase().includes('fetch'));

      // Retry ONLY once on fast idempotent glitches (< 2.2s); never chain two full timeouts together
      if (isNetworkError && attempt < maxRetries && elapsed < 2200 && (typeof navigator === 'undefined' || navigator.onLine)) {
        await new Promise(r => setTimeout(r, 300));
        continue;
      }

      if (isNetworkError) {
        emitNetworkStatus({ online: false, latencyMs: elapsed, reason: err?.name === 'AbortError' ? 'timeout' : 'fetch-error' });
        return new Response(JSON.stringify({
          message: err?.name === 'AbortError'
            ? "Erreur réseau: Délai d'attente dépassé (connexion instable)."
            : "Erreur réseau: Impossible de contacter le serveur de base de données.",
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
