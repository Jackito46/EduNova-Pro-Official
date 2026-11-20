import React, { useState, useEffect, useCallback, useRef, startTransition } from 'react';
import { HashRouter } from 'react-router-dom';
import { ShieldAlert, RefreshCw, Clock } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { UserProfile, UserRole } from './types';
import { supabase, clearAuthStorage, isRefreshTokenError, hasStoredAuthToken, purgeSelectiveSessionStorage, isUiPreferenceStorageKey, isLocalDeploymentMode } from './supabase';
import { AuditLogger } from './utils/auditLogger';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useSecurity } from './components/SecurityGuard';
import Logo from './components/Logo';
import { AppLoadingScreen } from './components/AppLoadingScreen';
import { lazyWithRetry, safePreloadModule } from './utils/lazyWithRetry';
import { ensureOfflineVaultUnlocked, lockOfflineVault } from './services/offlineEncryptedStore';
import { initOfflineSyncAutoFlush, prefetchSchoolReferenceCache } from './services/offlineSyncEngine';

const loadPublicLandingPage = () => import('./components/PublicLandingPage');
const loadLogin = () => import('./components/Login');
const loadPublicReceiptVerificationView = () =>
  import('./components/PublicReceiptVerificationView').then(m => ({ default: m.PublicReceiptVerificationView }));
const loadAuthenticatedShell = () => import('./components/AuthenticatedShell');

const PublicLandingPage = lazyWithRetry(loadPublicLandingPage);
const Login = lazyWithRetry(loadLogin);
const PublicReceiptVerificationView = lazyWithRetry(loadPublicReceiptVerificationView);
const AuthenticatedShell = lazyWithRetry(loadAuthenticatedShell);

type PublicView = 'landing' | 'login';

const parsePublicViewFromHash = (hash?: string): PublicView => {
  // En Mode Serveur Local / LAN, ignorer la page vitrine marketing et ouvrir directement la connexion
  if (isLocalDeploymentMode()) {
    return 'login';
  }
  const h = typeof hash === 'string'
    ? hash
    : (typeof window !== 'undefined' ? window.location.hash || '' : '');
  if (h.startsWith('#/login') || h.startsWith('#/auth') || h.startsWith('#/reset-password')) {
    return 'login';
  }
  return 'landing';
};

const PublicRouteFallback: React.FC<{ target: 'landing' | 'login' | 'verify' | 'app' }> = ({ target }) => {
  const label =
    target === 'login'
      ? 'Ouverture de la page de connexion...'
      : target === 'verify'
      ? 'Chargement de la vérification...'
      : target === 'app'
      ? 'Préparation de votre espace...'
      : 'Chargement de la page d’accueil...';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4 max-w-xs w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center p-2.5">
          <Logo src="/logo.webp" size="lg" className="w-full h-full object-contain" alt="EduNova Pro" />
        </div>
        <div className="space-y-1">
          <div className="text-xl font-extrabold tracking-tight text-slate-900">
            EduNova <span className="text-blue-600">Pro</span>
          </div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
        </div>
        <div className="w-36 h-1 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full w-1/2 bg-blue-600 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
};

// Intercept toast.error globally to prevent scary technical auth errors from showing to the user
const originalToastError = toast.error;
(toast as any).error = function(message: any, options?: any) {
  const msgStr = typeof message === 'string' ? message.toLowerCase() : String(message).toLowerCase();
  if (msgStr.includes('refresh token')) {
    return originalToastError("Session expirée. Veuillez vous reconnecter.", options);
  }
  return originalToastError(message, options);
};

// Globally suppress console.error for expected refresh token errors to avoid AI Studio alert noise
if (typeof window !== 'undefined') {
  if (import.meta.env.DEV) {
    console.log('--- DIAGNOSTIC SCRIPT: DEPLOYMENT INFO ---');
    console.log('Build Timestamp:', typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : 'N/A');
    console.log('Deployment Git Commit:', typeof __RENDER_GIT_COMMIT__ !== 'undefined' ? __RENDER_GIT_COMMIT__ : 'N/A');
    console.log('Node Env:', typeof __NODE_ENV__ !== 'undefined' ? __NODE_ENV__ : 'N/A');
    console.log('Environment variables loaded:', {
      VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? '✓ Configured' : 'Missing',
    });
    console.log('-------------------------------------------');
  }

  const originalConsoleError = console.error;
  console.error = function(...args: any[]) {
    try {
      const errorStr = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ').toLowerCase();
      if (
        errorStr.includes('refresh token') || 
        errorStr.includes('refresh_token_not_found') || 
        errorStr.includes('session not found') ||
        errorStr.includes('compte désactivé') ||
        errorStr.includes('déconnexion forcée') ||
        errorStr.includes('pgrst116')
      ) {
        // Just log as warn to avoid triggering AI Studio's error overlay
        return console.warn('[Suppressed Auth State Notice]', ...args);
      }
    } catch(e) {}
    return originalConsoleError.apply(console, args);
  };
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}





const App: React.FC = () => {
  const { isInOfficeHours, isAllowedLocation } = useSecurity();
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const isLoggedOut = window.localStorage.getItem('edunova_logged_out') === 'true';
      if (isLoggedOut) return null;
      // If there is no stored auth token, do not restore cached profile
      if (!hasStoredAuthToken()) {
        try { window.localStorage.removeItem('edunova_user_profile'); } catch (e) {}
        return null;
      }
      const cached = window.localStorage.getItem('edunova_user_profile');
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (e) {
      try { window.localStorage.removeItem('edunova_user_profile'); } catch (err) {}
      return null;
    }
  });
  
  const [loading, setLoading] = useState(() => {
    try {
      const isLoggedOut = window.localStorage.getItem('edunova_logged_out') === 'true';
      if (isLoggedOut) return false;
      const cached = window.localStorage.getItem('edunova_user_profile');
      if (cached) return false; // Immediate render if cached profile exists!
      // CRITICAL: If no cached profile exists, never block the login screen with a loading overlay.
      // The Login screen must be accessible immediately.
      return false;
    } catch (e) {
      return false;
    }
  });
  const [loadingStage, setLoadingStage] = useState<1 | 2 | 3>(1);
  const [isExiting, setIsExiting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(() => {
    try {
      const cached = window.localStorage.getItem('edunova_session_timeout');
      if (cached) {
        const val = parseInt(cached, 10);
        if (!isNaN(val) && val > 0) return val;
      }
    } catch(e) {}
    return 30;
  });

  useEffect(() => {
    try { window.localStorage.setItem('edunova_session_timeout', sessionTimeoutMinutes.toString()); } catch(e){}
  }, [sessionTimeoutMinutes]);

  const isLocalMode = isLocalDeploymentMode();

  // Explicit state management between public landing page and member login screen
  const [publicView, setPublicView] = useState<PublicView>(() => {
    if (isLocalMode) return 'login';
    try {
      const forced = typeof window !== 'undefined' ? (window as any).__edunovaForcedPublicView : null;
      if (forced === 'login' || forced === 'landing') return forced;
      return parsePublicViewFromHash();
    } catch (e) {
      return 'landing';
    }
  });
  const [pendingPublicView, setPendingPublicView] = useState<PublicView | null>(null);
  const suppressHashSyncRef = useRef(false);

  const switchPublicView = useCallback((target: PublicView, options?: { skipScrollReset?: boolean }) => {
    const effectiveTarget: PublicView = isLocalDeploymentMode() ? 'login' : target;
    if (effectiveTarget === 'login') {
      void safePreloadModule(loadLogin);
    } else {
      void safePreloadModule(loadPublicLandingPage);
    }

    const targetHash = effectiveTarget === 'login' ? '#/login' : '#/';
    if (typeof window !== 'undefined') {
      if (window.location.hash !== targetHash) {
        suppressHashSyncRef.current = true;
        window.location.hash = targetHash;
        setTimeout(() => {
          suppressHashSyncRef.current = false;
        }, 0);
      }
      if (!options?.skipScrollReset && window.scrollY > 0) {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    }

    setPendingPublicView(effectiveTarget);
    startTransition(() => {
      setPublicView(effectiveTarget);
    });
  }, []);

  useEffect(() => {
    if (pendingPublicView !== null && publicView === pendingPublicView) {
      setPendingPublicView(null);
    }
  }, [pendingPublicView, publicView]);

  useEffect(() => {
    const syncHashToView = () => {
      if (suppressHashSyncRef.current) return;
      try {
        if (isLocalDeploymentMode()) {
          if (!user) {
            void safePreloadModule(loadLogin);
            startTransition(() => {
              setPublicView('login');
            });
          }
          return;
        }
        const h = window.location.hash || '';
        const parsed = parsePublicViewFromHash(h);
        if (parsed === 'login') {
          void safePreloadModule(loadLogin);
          startTransition(() => {
            setPublicView('login');
          });
        } else if (
          h === '#/' ||
          h === '' ||
          h.startsWith('#/presentation') ||
          h.startsWith('#/vitrine') ||
          h.startsWith('#/demo')
        ) {
          if (!user) {
            void safePreloadModule(loadPublicLandingPage);
            startTransition(() => {
              setPublicView('landing');
            });
          }
        }
      } catch (e) {}
    };
    const handleForcedPublicView = (e: Event) => {
      const view = (e as CustomEvent)?.detail?.view as PublicView | undefined;
      setLoading(false);
      setUser(null);
      if (view === 'login' || view === 'landing') {
        switchPublicView(view, { skipScrollReset: true });
      }
    };
    window.addEventListener('hashchange', syncHashToView);
    window.addEventListener('edunova_force_public_view', handleForcedPublicView);
    return () => {
      window.removeEventListener('hashchange', syncHashToView);
      window.removeEventListener('edunova_force_public_view', handleForcedPublicView);
    };
  }, [user, switchPublicView]);
  
  // Inactivity Warning States
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const isWarningShowing = useRef(false);

  // Format countdown into minutes:secondes (MM:SS)
  const formatCountdown = useCallback((totalSeconds: number) => {
    const mins = Math.floor(Math.max(0, totalSeconds) / 60);
    const secs = Math.max(0, totalSeconds) % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const syncProfile = useCallback(async (userId: string, isRecovery: boolean = false) => {
    console.log("App.tsx: Starting syncProfile for user", userId, { isRecovery });
    
    if (!navigator.onLine) {
      console.warn("App.tsx: Browser is offline, skipping syncProfile and using cache.");
      setLoading(false);
      return;
    }
    
    try {
      // Wrap the query in a Promise.race with a 15-second timeout for server cold-start tolerance
      const queryPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      let timeoutId: NodeJS.Timeout;
      const timeoutPromise = new Promise<{data: any, error: any}>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("syncProfile timeout")), 15000);
      });
      
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
      clearTimeout(timeoutId!);

      
      if (error) {
        if (error.code === 'PGRST116') {
          console.warn("Profil introuvable ou filtré par RLS. Vérification du cache local...");
          
          const cachedStr = window.localStorage.getItem('edunova_user_profile');
          if (cachedStr) {
            try {
              const cached = JSON.parse(cachedStr);
              if (cached && cached.id === userId) {
                console.log("App.tsx: Utilisation du profil en cache suite à PGRST116 pour", cached.email);
                if (isRecovery) cached.force_password_change = true;
                setUser(cached);
                return;
              }
            } catch (e) {}
          }
          
          console.warn("Profil introuvable et aucun cache valide. Réinitialisation de l'état.");
          setUser(null);
          return;
        }
        throw error;
      }
      
      if (data) {
        console.log("App.tsx: Profile synced successfully");
        const profile = data as UserProfile;
        if (isRecovery) {
          profile.force_password_change = true;
        } else if (profile.expires_at && new Date(profile.expires_at).getTime() <= Date.now() && profile.role !== 'SUPER_ADMIN' && !profile.is_super_admin) {
          console.warn("Compte expiré. Déconnexion automatique.");
          try {
            await supabase.from('profiles').update({ is_active: false }).eq('id', profile.id);
          } catch (e) {}
          try { await supabase.auth.signOut(); } catch (e) {}
          try { window.localStorage.removeItem('edunova_user_profile'); } catch (err) {}
          setUser(null);
          try { 
            window.sessionStorage.setItem('edunova_login_error', "La durée de validité de votre compte a expiré. Votre accès a été suspendu automatiquement. Veuillez contacter un Administrateur pour le réactiver."); 
          } catch (e) {}
          return;
        } else if (profile.is_active === false && profile.role !== 'SUPER_ADMIN' && !profile.is_super_admin) {
          console.warn("Compte désactivé. Déconnexion forcée.");
          try { await supabase.auth.signOut(); } catch (e) {}
          try { window.localStorage.removeItem('edunova_user_profile'); } catch (err) {}
          setUser(null);
          try { window.sessionStorage.setItem('edunova_login_error', "Votre compte a été désactivé par l'administration."); } catch (e) {}
          return;
        }

        // Check school status if not super admin
        if (profile.school_id && profile.role !== 'SUPER_ADMIN' && !profile.is_super_admin) {
          try {
            const { data: schoolData, error: schoolErr } = await supabase
              .from('schools')
              .select('status')
              .eq('id', profile.school_id)
              .single();
            
            if (!schoolErr && schoolData && schoolData.status !== 'ACTIVE') {
              console.warn("Établissement inactif ou suspendu. Déconnexion forcée.");
              try { await supabase.auth.signOut(); } catch (e) {}
              try { window.localStorage.removeItem('edunova_user_profile'); } catch (err) {}
              setUser(null);
              try { window.sessionStorage.setItem('edunova_login_error', "Votre établissement est actuellement désactivé ou suspendu. Veuillez contacter l'administration principale."); } catch (e) {}
              return;
            }
          } catch (schoolCatchErr) {
            console.warn("Error checking school status inside syncProfile:", schoolCatchErr);
          }
        }

        setUser(prev => {
          const finalProfile = isRecovery ? { ...profile, force_password_change: true } : profile;
          if (prev && JSON.stringify(prev) === JSON.stringify(finalProfile)) {
            return prev;
          }
          return finalProfile;
        });
        if (profile.current_session_id) {
          try {
            const existingLocalSessionId = (window.localStorage.getItem('edunova_session_id') || '').trim();
            const isLocalSessionSynced = window.localStorage.getItem('edunova_session_synced') === 'true';
            if (!existingLocalSessionId || isLocalSessionSynced || existingLocalSessionId === String(profile.current_session_id).trim()) {
              window.localStorage.setItem('edunova_session_id', String(profile.current_session_id).trim());
              window.localStorage.setItem('edunova_session_synced', 'true');
            }
          } catch (err) {}
        }
        try { window.localStorage.setItem('edunova_user_profile', JSON.stringify(profile)); } catch (err) {}
      }
    } catch (err: any) {
      console.warn("Sync error:", err.message || err);
      // On continue avec le cache local si disponible
    } finally {
      console.log("App.tsx: syncProfile finished, setting loading to false");
      setLoading(false);
    }
  }, []);

  const purgeSystemState = useCallback(async (options?: { reason?: string; preserveUiPreferences?: boolean } | unknown) => {
    // Si options est un MouseEvent ou événement DOM, l'ignorer proprement
    const isDomEvent = options && typeof options === 'object' && ('nativeEvent' in options || 'target' in options);
    const opts = isDomEvent ? undefined : (options as { reason?: string; preserveUiPreferences?: boolean } | undefined);
    const preservePreferences = opts?.preserveUiPreferences !== false;

    // 0. Si un message de raison est spécifié, l'enregistrer dans sessionStorage pour affichage sur l'écran de login
    if (opts?.reason && typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem('edunova_login_error', opts.reason);
      } catch (e) {}
    }

    // 1. Sauvegarde préventive des préférences UI existantes dans sessionStorage
    const savedUiPreferences: Record<string, string> = {};
    if (preservePreferences && typeof window !== 'undefined' && window.sessionStorage) {
      try {
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          if (key && isUiPreferenceStorageKey(key)) {
            const val = window.sessionStorage.getItem(key);
            if (val !== null) {
              savedUiPreferences[key] = val;
            }
          }
        }
      } catch (e) {}
    }

    // 2. Nettoyage sélectif du sessionStorage : suppression immédiate des tokens Supabase,
    // identifiants de session, profils locaux, et caches de données sensibles
    clearAuthStorage({ preserveUiPreferences: preservePreferences });
    purgeSelectiveSessionStorage(true);

    // 3. Réapplication garantie des préférences UI préservées (thème, bannières rejetées, sidebar, etc.)
    if (preservePreferences && typeof window !== 'undefined' && window.sessionStorage) {
      try {
        Object.entries(savedUiPreferences).forEach(([key, val]) => {
          window.sessionStorage.setItem(key, val);
        });
      } catch (e) {}
    }

    // 4. Verrouillage immédiat du coffre hors-ligne en RAM & déconnexion locale instantanée
    lockOfflineVault();
    try { window.localStorage.setItem('edunova_logged_out', 'true'); } catch (e) {}
    isWarningShowing.current = false;
    setShowInactivityWarning(false);
    setCountdown(60);
    setUser(null);
    setLoading(false);
    setIsExiting(false);
    switchPublicView('login');

    // 5. Nettoyage asynchrone en arrière-plan sans bloquer l'UI
    (async () => {
      try {
        const getUserPromise = supabase.auth.getUser();
        const getUserTimeout = new Promise<{ data: { user: null } }>(res => setTimeout(() => res({ data: { user: null } }), 600));
        const { data: { user: currentUser } } = await Promise.race([getUserPromise, getUserTimeout]) as any;

        if (currentUser) {
          try {
            const { data } = await supabase
              .from('profiles')
              .select('school_id')
              .eq('id', currentUser.id)
              .single();
              
            if (currentUser.user_metadata?.school_id || data?.school_id) {
              await AuditLogger.log({
                school_id: data?.school_id || currentUser.user_metadata?.school_id,
                user_id: currentUser.id,
                action: 'LOGOUT',
                entity_type: 'auth',
                details: { }
              });
            }

            // Clear session ID in DB & invalidate tokens with quick race timeout
            await Promise.race([
              supabase.from('profiles').update({ current_session_id: null }).eq('id', currentUser.id),
              new Promise(res => setTimeout(res, 600))
            ]);

            await Promise.race([
              supabase.rpc('invalidate_user_sessions', { p_user_id: currentUser.id }),
              new Promise(res => setTimeout(res, 600))
            ]);
          } catch (dbErr) {
            console.warn("DB session cleanup notice:", dbErr);
          }
        }

        // Fast signOut attempt
        await Promise.race([
          supabase.auth.signOut(),
          new Promise(res => setTimeout(res, 600))
        ]);
      } catch (e) {
        console.warn("Background signout notice:", e);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    void ensureOfflineVaultUnlocked(user.id, user.school_id || 'global').then((unlocked) => {
      if (unlocked && user.school_id && typeof navigator !== 'undefined' && navigator.onLine) {
        void prefetchSchoolReferenceCache(user.school_id, user.id);
      }
    });
    const stopAutoFlush = initOfflineSyncAutoFlush(user.school_id || undefined);
    return () => stopAutoFlush();
  }, [user?.id, user?.school_id]);

  useEffect(() => {
    // Retrait immédiat et garanti du splashscreen dès que le composant React racine est actif
    if (typeof window !== 'undefined') {
      (window as any).__edunovaAppReady = true;
      if (typeof (window as any).__dismissEduNovaSplash === 'function') {
        (window as any).__dismissEduNovaSplash();
      }
      const splash = document.getElementById('edunova-pwa-splash');
      if (splash) {
        splash.style.transition = 'opacity 0.2s ease-out';
        splash.style.opacity = '0';
        setTimeout(() => {
          if (splash.parentNode) splash.parentNode.removeChild(splash);
        }, 200);
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Failsafe timeout to prevent infinite loading - 1.2s max
    const loadingTimeout = setTimeout(() => {
      if (mounted) {
        console.warn("App.tsx: Loading timeout reached (1.2s), forcing loading to false");
        setLoading(false);
      }
    }, 1200);

    const initializeAuth = async (retryCount = 0) => {
      setLoadingStage(1);
      const isLoggedOut = window.localStorage.getItem('edunova_logged_out') === 'true';
      const hasToken = hasStoredAuthToken();

      if (isLoggedOut || !hasToken) {
        console.log("App.tsx: Unauthenticated user or explicit logout, rendering Login screen immediately.");
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      const cachedUserStr = window.localStorage.getItem('edunova_user_profile');
      if (cachedUserStr && mounted) {
        try {
          setUser(JSON.parse(cachedUserStr));
          setLoading(false);
        } catch (e) {}
      }

      if (!navigator.onLine) {
        console.warn("App.tsx: Browser is offline, using cached session.");
        if (mounted) setLoading(false);
        return;
      }

      console.log(`App.tsx: Starting initializeAuth (Attempt ${retryCount + 1})`);
      setLoadingStage(2);
      let sessionTimeoutId: NodeJS.Timeout;
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{data: {session: null}, error: Error}>((_, reject) => {
          sessionTimeoutId = setTimeout(() => reject(new Error("getSession timeout")), 2500);
        });
        
        const result = await Promise.race([sessionPromise, timeoutPromise]) as any;
        clearTimeout(sessionTimeoutId!);
        
        const error = result?.error;
        const session = result?.data?.session;

        if (error || isRefreshTokenError(error)) {
          const actualError = error || (result as any);
          if (isRefreshTokenError(actualError)) {
            console.warn("App.tsx: Refresh token error in getSession, clearing session...");
            try { await supabase.auth.signOut(); } catch (e) {}
            clearAuthStorage();
            if (mounted) {
              setUser(null);
              setLoading(false);
            }
            return;
          }

          if (mounted) setLoading(false);
          return;
        }

        if (session?.user && mounted) {
          setLoadingStage(3);
          window.sessionStorage.setItem('edunova_session_active', 'true');
          const isRecoveryFlow = window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery');
          if (isRecoveryFlow) {
            toast.info("Réinitialisation du mot de passe", {
              description: "Veuillez définir votre nouveau mot de passe de sécurité.",
              duration: 8000,
            });
          }
          
          // Non-blocking background sync of profile
          syncProfile(session.user.id, isRecoveryFlow).catch(() => {});
          if (mounted) setLoading(false);
        } else if (mounted) {
          console.log("App.tsx: No user in session, setting user to null");
          setUser(null);
          try { window.localStorage.removeItem('edunova_user_profile'); } catch (err) {}
          setLoading(false);
        }
      } catch (err: any) {
        clearTimeout(sessionTimeoutId!);
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    // Listen for custom auth errors from supabase.ts
    const handleCustomAuthError = (e: any) => {
      console.warn("App.tsx: Received edunova_auth_error event, logging out...");
      if (mounted) {
         const hasCachedProfile = !!window.localStorage.getItem('edunova_user_profile');
         setUser(null);
         setLoading(false);
         if (hasCachedProfile) {
           toast.error("Session expirée", {
             description: "Votre session de sécurité a expiré. Veuillez vous reconnecter.",
             duration: 5000,
           });
           switchPublicView('login');
         }
         try { window.localStorage.removeItem('edunova_user_profile'); } catch (err) {}
      }
    };
    window.addEventListener('edunova_auth_error', handleCustomAuthError);

    // Listen for outgoing API security violations intercepted by outgoingSecurityMiddleware
    const handleSecurityAlert = (e: any) => {
      const detail = e?.detail;
      const message = detail?.message || "Requête sortante anormale ou suspecte interceptée par le bouclier de sécurité.";
      console.warn("App.tsx: Outgoing API security alert triggered:", detail);
      setApiError(message);
      toast.error("Alerte de Sécurité Système", {
        description: message,
        duration: 8000,
      });

      // Auto-clear banner after 10 seconds
      setTimeout(() => {
        if (mounted) setApiError(null);
      }, 10000);
    };
    window.addEventListener('edunova_security_alert', handleSecurityAlert);

    // Fetch maintenance mode
    const fetchGlobalSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('global_settings')
          .select('key, value')
          .in('key', ['system_status', 'security_policy']);
        
        if (error) {
          const isNetworkError = 
            error.message === 'Failed to fetch' || 
            error.message?.includes('Erreur réseau') || 
            error.code === 'NETWORK_ERROR' ||
            (error as any).status === 503;
          
          if (isNetworkError) {
            console.warn("Avertissement réseau : Impossible de se connecter à Supabase pour vérifier les paramètres globaux.");
          } else {
            console.warn("Avertissement lors de la récupération des paramètres globaux:", error?.message || error);
          }
          setMaintenanceMode(false);
          return;
        }

        if (data) {
          const status = data.find(item => item.key === 'system_status');
          if (status && status.value) setMaintenanceMode(status.value.maintenance_mode);
          
          const security = data.find(item => item.key === 'security_policy');
          if (security && security.value && security.value.session_timeout_minutes) {
             setSessionTimeoutMinutes(security.value.session_timeout_minutes);
          }
        }
      } catch (err: any) {
        const isNetworkError = 
          err.message === 'Failed to fetch' || 
          err.message?.includes('Erreur réseau') || 
          err.code === 'NETWORK_ERROR' ||
          err.status === 503;

        if (isNetworkError) {
          console.warn("Exception réseau lors de la récupération des paramètres globaux:", err.message);
          setApiError("Erreur de connexion au serveur. Certaines fonctionnalités peuvent être limitées.");
        } else {
          console.warn("Exception lors de la récupération des paramètres globaux:", err?.message || err);
        }
        setMaintenanceMode(false);
      }
    };

    if (hasStoredAuthToken() && window.localStorage.getItem('edunova_logged_out') !== 'true') {
      fetchGlobalSettings();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("App.tsx: Auth state change event:", event);
      
      if (event === 'SIGNED_IN' && session?.user && mounted) {
        const isLoginInProgress = window.sessionStorage.getItem('edunova_login_in_progress') === 'true';
        if (!isLoginInProgress) {
          syncProfile(session.user.id).catch(err => {
            if (!isRefreshTokenError(err)) {
              console.error("Error syncing profile on auth state change:", err);
            }
          });
        }
        fetchGlobalSettings();
      } else if (event === 'SIGNED_OUT' && mounted) {
        console.log("App.tsx: User signed out");
        try {
          window.localStorage.removeItem('edunova_user_profile');
          window.localStorage.removeItem('edunova-auth-token');
        } catch (e) {}
        setUser(null);
        setLoading(false);
      } else if (event === 'PASSWORD_RECOVERY' && session?.user && mounted) {
        console.log("App.tsx: Password recovery event detected");
        await syncProfile(session.user.id, true);
        toast.info("Réinitialisation du mot de passe", {
          description: "Veuillez définir votre nouveau mot de passe de sécurité.",
          duration: 8000,
        });
      } else if (event === 'TOKEN_REFRESHED') {
        // Token refreshed successfully
      } else if (event === 'USER_UPDATED') {
        // User updated
      }
    });

    // Real-time listener for global_settings
    const channel = supabase
      .channel('global_settings_changes')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'global_settings',
      }, (payload) => {
        if (payload.new && payload.new.key === 'system_status' && payload.new.value) {
          setMaintenanceMode(payload.new.value.maintenance_mode);
        } else if (payload.new && payload.new.key === 'security_policy' && payload.new.value) {
          if (payload.new.value.session_timeout_minutes) {
            setSessionTimeoutMinutes(payload.new.value.session_timeout_minutes);
          }
        }
      })
      .subscribe();

    return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
      supabase.removeChannel(channel);
      window.removeEventListener('edunova_auth_error', handleCustomAuthError);
      window.removeEventListener('edunova_security_alert', handleSecurityAlert);
    };
  }, [syncProfile]);

  // Register active session flag in sessionStorage when a user is successfully logged in.
  // When they close the browser tab or browser, sessionStorage is automatically deleted.
  // On subsequent reopenings, if this flag is missing, the security check detects it and logs them out.
  useEffect(() => {
    if (user) {
      try {
        window.sessionStorage.setItem('edunova_session_active', 'true');
      } catch (e) {}
    }
  }, [user]);

  // Read school-specific timeout from custom school settings when authenticated
  useEffect(() => {
    if (!user?.school_id) return;

    let active = true;
    const fetchSchoolTimeout = async () => {
      try {
        const { data, error } = await supabase
          .from('schools')
          .select('global_settings')
          .eq('id', user.school_id)
          .single();

        if (error) {
          console.warn("App.tsx: school settings fetch error (falling back to global policy):", error.message);
          return;
        }

        if (data && data.global_settings && active) {
          let settings: any = {};
          if (typeof data.global_settings === 'string') {
            try { settings = JSON.parse(data.global_settings); } catch (e) {}
          } else {
            settings = data.global_settings;
          }

          if (settings && settings.session_timeout_minutes) {
            const timeoutVal = Number(settings.session_timeout_minutes);
            if (!isNaN(timeoutVal) && timeoutVal > 0) {
              console.log("App.tsx: Applying school-specific timeout limit:", timeoutVal, "minutes");
              setSessionTimeoutMinutes(timeoutVal);
            }
          }
        }
      } catch (err) {
        console.error("App.tsx: Error fetching custom school timeout:", err);
      }
    };

    fetchSchoolTimeout();

    // Listen to real-time updates for school settings too!
    const schoolChannel = supabase
      .channel(`school_settings_changes_${user.school_id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'schools',
        filter: `id=eq.${user.school_id}`
      }, (payload) => {
        if (payload.new && payload.new.global_settings && active) {
          let settings: any = {};
          if (typeof payload.new.global_settings === 'string') {
            try { settings = JSON.parse(payload.new.global_settings); } catch (e) {}
          } else {
            settings = payload.new.global_settings;
          }
          if (settings && settings.session_timeout_minutes) {
            const timeoutVal = Number(settings.session_timeout_minutes);
            if (!isNaN(timeoutVal) && timeoutVal > 0) {
              console.log("App.tsx: Real-time update of school timeout limit:", timeoutVal, "minutes");
              setSessionTimeoutMinutes(timeoutVal);
            }
          }
        }
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(schoolChannel);
    };
  }, [user?.school_id]);

  // Heartbeat & Pre-warm Mechanism: Keep server & database active and responsive
  useEffect(() => {
    // Function to ping the server health endpoint and a lightweight database record
    const pingHeartbeat = async () => {
      try {
        await fetch('/api/health', { method: 'HEAD' }).catch(() => {});
        await supabase.from('global_settings').select('id').limit(1).maybeSingle();
      } catch (err) {
        // Silently ignore heartbeat errors
      }
    };

    // Instant pre-warm on application load
    pingHeartbeat();

    // Periodic keep-alive ping every 3 minutes (180000ms)
    const intervalId = setInterval(pingHeartbeat, 180000);
    
    return () => clearInterval(intervalId);
  }, [user?.id]);

  // Auto-logout & Concurrent Session Check
  const userId = user?.id;
  const userRole = user?.role;
  useEffect(() => {
    if (!userId) return;
    // Bypass auto-logout and session purging during maintenance mode to let users read the maintenance message
    if (maintenanceMode && userRole !== 'SUPER_ADMIN') return;

    const timeoutMins = Math.max(1, Number(sessionTimeoutMinutes) || 15);
    const INACTIVITY_LIMIT = timeoutMins * 60 * 1000; // e.g. 15 minutes in ms
    const GRACE_PERIOD_SECONDS = 60; // 60 seconds warning modal countdown (1 minute grace period)
    const GRACE_PERIOD = GRACE_PERIOD_SECONDS * 1000;
    const TOTAL_ALLOWED_INACTIVITY = INACTIVITY_LIMIT + GRACE_PERIOD;

    // Retrieve last activity from localStorage or set current time
    let lastActivityTimestamp = Date.now();
    const storedLastActivity = window.localStorage.getItem('edunova_last_activity');
    if (storedLastActivity) {
      const parsed = parseInt(storedLastActivity, 10);
      if (!isNaN(parsed) && parsed > 0) {
        lastActivityTimestamp = parsed;
      }
    } else {
      window.localStorage.setItem('edunova_last_activity', lastActivityTimestamp.toString());
    }

    let lastDbUpdateTimestamp = Date.now();
    const isExcludedFromInactivity = false;

    const performInactivityLogout = () => {
      console.warn("Déconnexion forcée pour inactivité prolongée.");
      isWarningShowing.current = false;
      setShowInactivityWarning(false);
      setCountdown(60);
      try {
        window.sessionStorage.setItem('edunova_login_notice', "Votre session a été fermée automatiquement pour des raisons de sécurité suite à une période d'inactivité prolongée.");
      } catch (e) {}
      purgeSystemState();
    };

    const evaluateInactivityState = () => {
      if (isExcludedFromInactivity) return;
      const now = Date.now();
      const elapsed = now - lastActivityTimestamp;

      if (elapsed >= TOTAL_ALLOWED_INACTIVITY) {
        performInactivityLogout();
        return;
      }

      if (elapsed >= INACTIVITY_LIMIT) {
        const remainingSeconds = Math.max(1, Math.ceil((TOTAL_ALLOWED_INACTIVITY - elapsed) / 1000));
        setCountdown(remainingSeconds);
        if (!isWarningShowing.current) {
          isWarningShowing.current = true;
          setShowInactivityWarning(true);
        }
      } else {
        if (isWarningShowing.current) {
          isWarningShowing.current = false;
          setShowInactivityWarning(false);
          setCountdown(60);
        }
      }
    };

    const resetInactivityTimer = () => {
      if (isWarningShowing.current) return;
      if (isExcludedFromInactivity) return;
      
      const now = Date.now();
      // Throttle localStorage updates to once every 3 seconds
      if (now - lastActivityTimestamp > 3000) {
        window.localStorage.setItem('edunova_last_activity', now.toString());
      }
      lastActivityTimestamp = now;
      evaluateInactivityState();
    };

    let isCheckInFlight = false;
    let lastSessionCheckAt = 0;

    const checkSessionState = async (force: boolean = false) => {
      if (maintenanceMode && userRole !== 'SUPER_ADMIN') return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      const isLoginInProgress = window.sessionStorage.getItem('edunova_login_in_progress') === 'true';
      if (isLoginInProgress) return;
      const nowCheck = Date.now();
      if (isCheckInFlight || (!force && nowCheck - lastSessionCheckAt < 5000)) return;
      isCheckInFlight = true;
      lastSessionCheckAt = nowCheck;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('current_session_id, role, is_super_admin, is_active, school_id, expires_at')
          .eq('id', userId)
          .single();
          
        if (error) {
          console.warn("App.tsx info: concurrent session check failed:", error.message);
          return;
        }

        if (data) {
          // Check expiration during active session
          if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now() && data.role !== 'SUPER_ADMIN' && !data.is_super_admin) {
            console.warn("Compte expiré pendant la session active. Déconnexion immédiate.");
            try { await supabase.from('profiles').update({ is_active: false }).eq('id', userId); } catch (e) {}
            try { 
              window.sessionStorage.setItem('edunova_login_error', "La durée de validité de votre accès a expiré. Votre session a été verrouillée automatiquement."); 
            } catch(e){}
            purgeSystemState();
            return;
          }

          if (data.is_active === false && data.role !== 'SUPER_ADMIN' && !data.is_super_admin) {
            console.warn("Compte désactivé détecté.");
            try { window.sessionStorage.setItem('edunova_login_error', "Votre compte a été désactivé par l'administration."); } catch(e){}
            purgeSystemState();
            return;
          }

          const isSuper = data.role === UserRole.SUPER_ADMIN || data.is_super_admin === true;
          if (data.school_id && !isSuper) {
            const { data: schoolData } = await supabase
              .from('schools')
              .select('status')
              .eq('id', data.school_id)
              .single();
              
            if (schoolData && schoolData.status !== 'ACTIVE') {
              console.warn("Établissement désactivé ou suspendu.");
              try { window.sessionStorage.setItem('edunova_login_error', "Votre établissement a été désactivé ou suspendu."); } catch(e){}
              purgeSystemState();
              return;
            }
          }

          const isExemptFromConcurrent = isSuper;
          const localSessionId = (window.localStorage.getItem('edunova_session_id') || '').trim();
          const remoteSessionId = (data.current_session_id || '').trim();
          const isSessionSynced = window.localStorage.getItem('edunova_session_synced') === 'true';

          if (!localSessionId) {
            if (remoteSessionId) {
              try {
                window.localStorage.setItem('edunova_session_id', remoteSessionId);
                window.localStorage.setItem('edunova_session_synced', 'true');
              } catch (e) {}
            }
          } else if (localSessionId === remoteSessionId) {
            if (!isSessionSynced) {
              try { window.localStorage.setItem('edunova_session_synced', 'true'); } catch (e) {}
            }
          } else if (!isExemptFromConcurrent) {
            if (remoteSessionId && isSessionSynced) {
              // Align localStorage with the already-confirmed remote session ID instead of overwriting DB repeatedly
              try {
                window.localStorage.setItem('edunova_session_id', remoteSessionId);
              } catch (e) {}
            } else if (!isSessionSynced || !remoteSessionId) {
              // Pending initial login sync or missing DB session ID: push localSessionId to DB once
              try {
                const { error: syncErr } = await supabase
                  .from('profiles')
                  .update({ current_session_id: localSessionId })
                  .eq('id', userId);
                if (!syncErr) {
                  try { window.localStorage.setItem('edunova_session_synced', 'true'); } catch (e) {}
                }
              } catch (syncCatchErr) {
                console.warn("App.tsx: Session auto-heal sync notice:", syncCatchErr);
              }
            }
          }
        }

        if (!isExcludedFromInactivity && lastActivityTimestamp > lastDbUpdateTimestamp) {
          try {
            await supabase
              .from('profiles')
              .update({ last_activity_at: new Date().toISOString() })
              .eq('id', userId);
            lastDbUpdateTimestamp = Date.now();
          } catch (updateErr) {
            console.error("Error updating activity:", updateErr);
          }
        }
      } catch (err) {
        console.error("Erreur check session:", err);
      } finally {
        isCheckInFlight = false;
      }
    };

    const handleVisibilityOrFocus = () => {
      // Re-read stored activity timestamp on wake or focus
      const stored = window.localStorage.getItem('edunova_last_activity');
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed > 0) {
          lastActivityTimestamp = parsed;
        }
      }

      evaluateInactivityState();
      if (document.visibilityState === 'visible') {
        checkSessionState();
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'edunova_last_activity' && e.newValue) {
        const parsed = parseInt(e.newValue, 10);
        if (!isNaN(parsed) && parsed > 0) {
          lastActivityTimestamp = parsed;
          if (isWarningShowing.current) {
            isWarningShowing.current = false;
            setShowInactivityWarning(false);
          }
        }
      }
    };

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    if (!isExcludedFromInactivity) {
      activityEvents.forEach(event => document.addEventListener(event, resetInactivityTimer, { passive: true }));
    }
    
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('storage', handleStorageChange);

    // Initial evaluation on mount
    evaluateInactivityState();

    // Ticker running every 3 seconds to guarantee strict inactivity monitoring
    const inactivityCheckTicker = setInterval(evaluateInactivityState, 3000);
    const updateActivityInterval = setInterval(() => checkSessionState(true), 60000);

    // Initial session check
    checkSessionState(true);

    return () => {
      clearInterval(inactivityCheckTicker);
      clearInterval(updateActivityInterval);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('storage', handleStorageChange);
      if (!isExcludedFromInactivity) {
        activityEvents.forEach(event => document.removeEventListener(event, resetInactivityTimer));
      }
    };
  }, [userId, userRole, purgeSystemState, sessionTimeoutMinutes, maintenanceMode]);

  useEffect(() => {
    if (!showInactivityWarning) {
      return;
    }

    if (countdown <= 0) {
      setCountdown(60);
      return;
    }

    const timer = setTimeout(() => {
      if (countdown <= 1) {
        purgeSystemState();
      } else {
        setCountdown(countdown - 1);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [showInactivityWarning, countdown, purgeSystemState]);

  if (isExiting) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-indigo-600 border-r-transparent mx-auto"></div>
          <p className="text-slate-600 font-medium text-sm">Fermeture sécurisée...</p>
        </div>
      </div>
    );
  }

  // Vérification de reçu public (accessible via scan QR code sans authentification préalable)
  const isPublicReceiptVerification = typeof window !== 'undefined' && (
    window.location.hash.includes('verifier-recu') ||
    window.location.search.includes('verify_receipt') ||
    window.location.hash.includes('verify_receipt')
  );

  if (isPublicReceiptVerification) {
    return (
      <>
        <Toaster position="top-center" richColors closeButton expand={false} />
        <React.Suspense fallback={<PublicRouteFallback target="verify" />}>
          <PublicReceiptVerificationView
            onBackToApp={() => {
              window.location.hash = '#/';
              window.location.reload();
            }}
          />
        </React.Suspense>
      </>
    );
  }

  if (!user) {
    const effectivePublicView: PublicView = isLocalMode ? 'login' : publicView;
    return (
      <ErrorBoundary>
        <Toaster position="top-center" richColors closeButton expand={false} />
        <React.Suspense fallback={<PublicRouteFallback target={effectivePublicView} />}>
          {!isLocalMode && effectivePublicView === 'landing' ? (
            <div key="public-landing" className="edunova-fade-in">
              <PublicLandingPage
                onOpenLogin={() => switchPublicView('login')}
                onPreloadLogin={() => { void safePreloadModule(loadLogin); }}
                isOpeningLogin={pendingPublicView === 'login'}
              />
            </div>
          ) : (
            <div key="public-login" className="edunova-fade-in">
              <HashRouter>
                <Login
                  onLogin={(u) => {
                    try { window.sessionStorage.removeItem('edunova_login_in_progress'); } catch(e){}
                    void safePreloadModule(loadAuthenticatedShell);
                    if (window.location.hash !== '#/') {
                      suppressHashSyncRef.current = true;
                      window.location.hash = '#/';
                      setTimeout(() => {
                        suppressHashSyncRef.current = false;
                      }, 0);
                    }
                    window.scrollTo({ top: 0, behavior: 'auto' });
                    startTransition(() => {
                      setUser(u);
                      setLoading(false);
                    });
                  }}
                  onReset={purgeSystemState}
                  onBackToLanding={isLocalMode ? undefined : () => switchPublicView('landing')}
                  onPreloadLanding={isLocalMode ? undefined : () => { void safePreloadModule(loadPublicLandingPage); }}
                  onLoginStart={() => { void safePreloadModule(loadAuthenticatedShell); }}
                  isReturningToLanding={!isLocalMode && pendingPublicView === 'landing'}
                />
              </HashRouter>
            </div>
          )}
        </React.Suspense>
      </ErrorBoundary>
    );
  }

  if (loading) {
    const cachedProfile = (() => {
      try {
        const raw = window.localStorage.getItem('edunova_user_profile');
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    })();

    return (
      <AppLoadingScreen
        currentStage={loadingStage}
        cachedUserName={cachedProfile?.full_name || cachedProfile?.email}
        cachedUserRole={cachedProfile?.role}
        isOffline={!navigator.onLine}
        onContinueOffline={() => {
          if (cachedProfile) {
            setUser(cachedProfile);
            setLoading(false);
          }
        }}
        onSkipToHome={() => {
          setLoading(false);
          setUser(null);
          switchPublicView('landing');
        }}
        onSkipToLogin={() => {
          setLoading(false);
          setUser(null);
          switchPublicView('login');
        }}
      />
    );
  }

  console.log("App.tsx: Rendering AnimatedRoutes for user", user.id);
  
  const isDirection = [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR].includes(user.role);
  if (!isDirection && (!isInOfficeHours || !isAllowedLocation)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert size={40} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Accès Restreint</h1>
          <p className="text-slate-600 mb-8 leading-relaxed">
            Pour des raisons de sécurité, l'accès au système n'est autorisé que depuis le territoire national et pendant les heures régulières de bureau (06h00 - 19h00).
          </p>
          <button 
            onClick={() => purgeSystemState()}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-4 rounded-xl transition-colors"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <HashRouter>
        <Toaster position="top-center" richColors closeButton expand={false} mobile-bottom-center />
        {apiError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-4 z-[9999] bg-rose-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 w-[90%] md:w-auto">
          <ShieldAlert size={20} className="shrink-0" />
          <p className="font-bold text-sm tracking-tight">{apiError}</p>
        </div>
      )}
      {showInactivityWarning && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center animate-in fade-in zoom-in duration-200 border border-slate-100">
            {/* Warning Icon with Pulse Ring */}
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className={`absolute inset-0 rounded-full animate-ping opacity-25 ${countdown <= 15 ? 'bg-red-400' : 'bg-amber-400'}`}></div>
              <div className="relative w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-3xl shadow-inner ring-4 ring-amber-50">
                ⏳
              </div>
            </div>

            <h2 className="text-xl font-bold text-slate-900 mb-1.5">Expiration imminente de la session</h2>
            <p className="text-xs sm:text-sm text-slate-500 mb-4 leading-relaxed">
              Pour des raisons de sécurité, votre session sera automatiquement fermée suite à une inactivité prolongée.
            </p>

            {/* Indicateur visuel de temps restant (minutes:secondes) */}
            <div className="bg-gradient-to-b from-slate-50 to-slate-100/90 border border-slate-200/90 rounded-2xl p-4 mb-5 shadow-inner">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-center gap-1.5">
                <Clock size={14} className="text-amber-600 animate-pulse shrink-0" />
                <span>Temps restant avant déconnexion</span>
              </div>

              {/* Minuteur Digital en minutes:secondes */}
              <div className="flex items-center justify-center gap-2 py-1">
                <div className={`font-mono text-4xl sm:text-5xl font-black tracking-tight px-5 py-2 rounded-xl border transition-colors ${
                  countdown <= 15
                    ? 'bg-red-50 text-red-600 border-red-200 animate-pulse ring-2 ring-red-200'
                    : countdown <= 30
                    ? 'bg-amber-50 text-amber-600 border-amber-200 ring-2 ring-amber-100'
                    : 'bg-white text-slate-800 border-slate-200 shadow-2xs'
                }`}>
                  {formatCountdown(countdown)}
                </div>
              </div>
              <div className="text-[11px] font-semibold text-slate-500 mt-1">
                Indicateur décompte : <span className="font-mono text-slate-700 font-bold">(minutes:secondes)</span>
              </div>

              {/* Jauge / Barre de progression visuelle */}
              <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden mt-3 shadow-inner">
                <div 
                  className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                    countdown <= 15
                      ? 'bg-red-500'
                      : countdown <= 30
                      ? 'bg-amber-500'
                      : 'bg-indigo-600'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, (countdown / 60) * 100))}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono font-medium mt-1.5 px-0.5">
                <span>00:00 (Fermeture)</span>
                <span className="font-sans font-semibold text-slate-500">
                  {countdown > 0 ? `${countdown}s restante${countdown > 1 ? 's' : ''}` : 'Fermeture en cours...'}
                </span>
                <span>01:00 (Alerte)</span>
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => purgeSystemState()}
                className="flex-1 px-4 py-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 active:bg-slate-200 rounded-xl font-semibold transition-colors text-sm border border-slate-200"
              >
                Me déconnecter
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = Date.now();
                  try {
                    window.localStorage.setItem('edunova_last_activity', now.toString());
                  } catch (e) {}
                  setShowInactivityWarning(false);
                  isWarningShowing.current = false;
                  setCountdown(60);
                }}
                className="flex-1 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-bold transition-all shadow-md shadow-indigo-200 text-sm flex items-center justify-center gap-2"
              >
                <RefreshCw size={15} className="shrink-0" />
                <span>Rester connecté</span>
              </button>
            </div>
          </div>
        </div>
      )}
      <React.Suspense fallback={<PublicRouteFallback target="app" />}>
        <AuthenticatedShell
          user={user}
          purgeSystemState={purgeSystemState}
          maintenanceMode={maintenanceMode}
        />
      </React.Suspense>
    </HashRouter>
    </ErrorBoundary>
  );
};

export default App;