import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { UserProfile } from '../types';
import { AlertTriangle, LogOut, X } from 'lucide-react';

interface SubscriptionGuardProps {
  user: UserProfile;
  children: React.ReactNode;
  onLogout: () => void;
}

export const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({ user, children, onLogout }) => {
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    endDate: string | null;
    isExpired: boolean;
    daysLeft: number | null;
    isGracePeriod: boolean;
  }>({ endDate: null, isExpired: false, daysLeft: null, isGracePeriod: false });

  const [isReadOnlyMode, setIsReadOnlyMode] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      return window.sessionStorage.getItem(`dismiss_sub_banner_${user.school_id}`) === 'true';
    } catch {
      return false;
    }
  });

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      window.sessionStorage.setItem(`dismiss_sub_banner_${user.school_id}`, 'true');
    } catch {}
  };

  useEffect(() => {
    let isMounted = true;
    let timeoutId: any = null;

    const checkSubscription = async () => {
      // Super admins are never blocked
      if (user?.is_super_admin || user?.role === 'SUPER_ADMIN') {
        if (isMounted) {
          setIsActive(true);
          setLoading(false);
        }
        return;
      }

      if (!user?.school_id) {
        if (isMounted) {
          setIsActive(false);
          setLoading(false);
        }
        return;
      }

      // 1. Check local cache first for instant UI response and resilience against network latency
      let cachedSchool: any = null;
      try {
        const cacheKey = `edunova_cached_school_${user.school_id}`;
        const rawCached = localStorage.getItem(cacheKey) || sessionStorage.getItem(cacheKey);
        if (rawCached) {
          cachedSchool = JSON.parse(rawCached);
        }
      } catch (e) {
        // ignore cache parsing error
      }

      const evaluateSchoolSubscription = (school: any) => {
        let active = true;

        if (school?.subscription_plan === 'unlimited') {
          active = true;
        } else if (school?.subscription_end_date) {
          const endDate = new Date(school.subscription_end_date);
          const now = new Date();
          const isExpired = endDate < now;
          const diffTime = endDate.getTime() - now.getTime();
          const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          const graceEndDate = new Date(endDate);
          graceEndDate.setDate(graceEndDate.getDate() + (school.grace_period_days || 0));
          const isGracePeriod = isExpired && now < graceEndDate;

          active = !isExpired || isGracePeriod;

          if (isMounted) {
            setSubscriptionInfo({
              endDate: school.subscription_end_date,
              isExpired,
              daysLeft,
              isGracePeriod
            });
          }
        }

        return active;
      };

      // If cached data is available, apply it immediately to unlock UI without waiting
      if (cachedSchool) {
        const cachedActive = evaluateSchoolSubscription(cachedSchool);
        if (isMounted) {
          setIsActive(cachedActive);
          setLoading(false);
        }
      }

      try {
        const queryPromise = supabase
          .from('schools')
          .select('*')
          .eq('id', user.school_id)
          .single();

        // 8-second timeout that gracefully resolves instead of rejecting with an unhandled exception
        const timeoutPromise = new Promise<{ data: any; error: any; isTimeout?: boolean }>((resolve) => {
          timeoutId = setTimeout(() => {
            resolve({ data: cachedSchool || null, error: null, isTimeout: true });
          }, 8000);
        });

        const raceResult = await Promise.race([queryPromise, timeoutPromise]) as any;
        if (timeoutId) clearTimeout(timeoutId);

        if (raceResult?.isTimeout) {
          console.warn("Vérification de l'abonnement: Délai dépassé, maintien de l'accès actif / données en cache.");
          if (isMounted && isActive === null) {
            setIsActive(cachedSchool ? evaluateSchoolSubscription(cachedSchool) : true);
          }
          return;
        }

        const { data: school, error: schoolError } = raceResult;
        if (schoolError) throw schoolError;

        if (school) {
          // Update cache for subsequent visits
          try {
            localStorage.setItem(`edunova_cached_school_${user.school_id}`, JSON.stringify(school));
          } catch (e) {}

          const active = evaluateSchoolSubscription(school);
          if (isMounted) {
            setIsActive(active);
          }
        } else if (cachedSchool) {
          const active = evaluateSchoolSubscription(cachedSchool);
          if (isMounted) setIsActive(active);
        } else {
          if (isMounted) setIsActive(true);
        }
      } catch (err: any) {
        const isNetworkOrTimeout = 
          err?.code === 'NETWORK_ERROR' || 
          err?.message?.includes('Erreur réseau') || 
          err?.message?.includes('Failed to fetch') ||
          err?.message?.includes('Timeout') ||
          err?.message?.includes('timeout') ||
          err?.name === 'AbortError' ||
          err?.message === 'Failed to fetch';

        if (isNetworkOrTimeout) {
          console.warn("Vérification de l'abonnement: Avertissement réseau ou délai (fallback actif):", err?.message || err);
        } else {
          console.warn("Vérification de l'abonnement: Accès maintenu lors du contrôle:", err?.message || err);
        }
        // Default to active on error so we don't lock out users just because of a network error or latency
        if (isMounted) {
          setIsActive(cachedSchool ? evaluateSchoolSubscription(cachedSchool) : true);
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkSubscription();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user?.id, user?.school_id, user?.role, user?.is_super_admin]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Hard block (past grace period)
  if (!isActive && !isReadOnlyMode) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle size={40} />
          </div>
          
          <div>
            <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Abonnement Expiré</h1>
            <p className="text-slate-500 mt-2 font-medium">
              L'abonnement de votre établissement a expiré (période de grâce terminée). Vous ne pouvez plus effectuer de nouvelles opérations.
            </p>
          </div>

          <div className="space-y-3">
            <button 
              onClick={() => setIsReadOnlyMode(true)}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              Continuer en mode lecture seule
            </button>
            <button 
              onClick={onLogout}
              className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <LogOut size={18} />
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    );
  }

  const showReadOnlyBanner = !isActive && isReadOnlyMode;
  const showGraceBanner = isActive && subscriptionInfo.isGracePeriod;
  const showWarningBanner = isActive && !subscriptionInfo.isExpired && subscriptionInfo.daysLeft !== null && subscriptionInfo.daysLeft <= 7;

  return (
    <div className="relative min-h-screen">
      {/* Banners */}
      {showReadOnlyBanner && (
        <div className="sticky top-0 z-[100] bg-rose-600 text-white py-2 px-4 text-center text-sm font-bold shadow-lg flex items-center justify-center gap-3 animate-in slide-in-from-top duration-500">
          <AlertTriangle size={16} />
          <span>MODE LECTURE SEULE : Abonnement expiré. Toute modification est bloquée.</span>
          <button onClick={onLogout} className="ml-4 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-xs">Se déconnecter</button>
        </div>
      )}

      {showGraceBanner && !isDismissed && (
        <div className="sticky top-0 z-[100] bg-amber-500 text-white py-2 px-4 text-center text-sm font-bold shadow-lg flex items-center justify-between gap-3 animate-in slide-in-from-top duration-500">
          <div className="flex items-center justify-center gap-2 mx-auto">
            <AlertTriangle size={16} />
            <span>ATTENTION : Votre abonnement a expiré. Vous êtes en période de grâce. Renouvelez vite !</span>
          </div>
          <button 
            onClick={handleDismiss} 
            className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer text-white shrink-0 flex items-center gap-1"
            title="Masquer l'avertissement"
          >
            <span className="hidden sm:inline text-xs font-normal opacity-90">Fermer</span>
            <X size={16} />
          </button>
        </div>
      )}

      {showWarningBanner && !isDismissed && (
        <div className="sticky top-0 z-[100] bg-indigo-600 text-white py-2.5 px-4 text-center text-sm font-bold shadow-lg flex items-center justify-between gap-3 animate-in slide-in-from-top duration-500">
          <div className="flex items-center justify-center gap-2 mx-auto">
            <AlertTriangle size={16} className="text-amber-300 shrink-0" />
            <span>RAPPEL : Votre abonnement expire dans <strong className="underline underline-offset-2">{subscriptionInfo.daysLeft} jour(s)</strong>.</span>
          </div>
          <button 
            onClick={handleDismiss} 
            className="p-1.5 hover:bg-white/20 rounded-xl transition-colors cursor-pointer text-white shrink-0 flex items-center gap-1 bg-white/10 border border-white/20 shadow-sm"
            title="Masquer / Ignorer ce rappel"
          >
            <span className="hidden sm:inline text-xs font-semibold px-1">Ignorer</span>
            <X size={16} />
          </button>
        </div>
      )}

      <div className={showReadOnlyBanner ? "pointer-events-none opacity-90 grayscale-[0.5]" : ""}>
        {children}
      </div>

      {showReadOnlyBanner && (
        <div className="fixed bottom-6 right-6 z-[100]">
          <div className="bg-white p-4 rounded-2xl shadow-2xl border-2 border-rose-500 max-w-xs animate-in slide-in-from-right duration-500">
            <p className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-2">
              <AlertTriangle size={14} className="text-rose-500" />
              Accès Restreint
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Votre abonnement est arrivé à terme. Vous pouvez consulter vos données mais l'ajout ou la modification est désactivé.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
