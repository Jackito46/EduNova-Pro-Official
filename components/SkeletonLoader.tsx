import React from 'react';
import { motion } from 'framer-motion';
import { clearNetworkFailureWindow, isEffectivelyOffline } from '../supabase';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div
    className={`animate-pulse bg-gradient-to-r from-slate-100 via-slate-200/70 to-slate-100 rounded-xl bg-[length:200%_100%] ${className}`}
  />
);

export const SkeletonTable: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="w-full space-y-3 p-3 md:p-5 overflow-hidden">
    <div className="hidden sm:flex items-center justify-between pb-3 border-b border-slate-100">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-20" />
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center justify-between py-2.5 space-x-3 md:space-x-4 border-b border-slate-50">
        <div className="flex items-center space-x-3 w-3/4 sm:w-1/3 shrink-0">
          <Skeleton className="h-8 w-8 sm:h-9 sm:w-9 rounded-full shrink-0" />
          <div className="space-y-1.5 w-full">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-3.5 w-1/4 hidden sm:block" />
        <Skeleton className="h-3.5 w-1/6 hidden md:block" />
        <Skeleton className="h-7 w-16 sm:h-8 sm:w-20 rounded-lg shrink-0" />
      </div>
    ))}
  </div>
);

export const SkeletonCard: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-100 shadow-xs space-y-3">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-6 w-3/4 mt-2" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    ))}
  </div>
);

const useSlowOrOfflineState = (slowThresholdSeconds = 3) => {
  const [isOffline, setIsOffline] = React.useState<boolean>(() => isEffectivelyOffline());
  const [elapsedSeconds, setElapsedSeconds] = React.useState<number>(0);

  React.useEffect(() => {
    const syncOffline = () => setIsOffline(isEffectivelyOffline());
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    const handleNetworkEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ online?: boolean }>)?.detail;
      if (detail && typeof detail.online === 'boolean') {
        setIsOffline(!detail.online);
      } else {
        syncOffline();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('edunova_network_status', handleNetworkEvent);

    const ticker = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(ticker);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('edunova_network_status', handleNetworkEvent);
    };
  }, []);

  return {
    isOffline,
    elapsedSeconds,
    isSlowWait: isOffline || elapsedSeconds >= slowThresholdSeconds,
  };
};

const triggerViewRetry = (onRetry?: () => void) => {
  clearNetworkFailureWindow();
  if (onRetry) {
    onRetry();
  } else if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('edunova_retry_active_view', { cancelable: true }));
  }
};

export const FluidLoadingState: React.FC<{
  message?: string;
  subtext?: string;
  onRetry?: () => void;
  onUseOfflineCache?: () => void;
  slowThresholdSeconds?: number;
}> = ({
  message = "Chargement...",
  subtext,
  onRetry,
  onUseOfflineCache,
  slowThresholdSeconds = 3,
}) => {
  const { isOffline, elapsedSeconds, isSlowWait } = useSlowOrOfflineState(slowThresholdSeconds);
  const isAlreadyOfflineRoute = typeof window !== 'undefined' && window.location.hash.includes('/offline');

  return (
    <div className="flex flex-col items-center justify-center py-8 md:py-10 px-4 text-center w-full max-w-lg mx-auto">
      <div className="relative flex items-center justify-center mb-3.5">
        <div
          className={`w-11 h-11 rounded-full border-3 border-slate-100 animate-spin ${
            isOffline
              ? 'border-t-amber-500 border-r-rose-500'
              : isSlowWait
                ? 'border-t-amber-500 border-r-indigo-600'
                : 'border-t-blue-600 border-r-indigo-600'
          }`}
        />
        <div
          className={`absolute w-6 h-6 rounded-full flex items-center justify-center shadow-sm ${
            isOffline
              ? 'bg-gradient-to-tr from-amber-500 to-rose-500'
              : 'bg-gradient-to-tr from-blue-600 to-indigo-600'
          }`}
        >
          <div className="w-2 h-2 bg-white rounded-full" />
        </div>
      </div>
      <motion.h4
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-snug"
      >
        {message}
      </motion.h4>
      {subtext && (
        <p className="text-xs text-slate-500 font-medium mt-1 max-w-xs leading-relaxed">
          {subtext}
        </p>
      )}

      {isSlowWait && (
        <div
          className={`mt-4 w-full rounded-2xl border px-4 py-3 text-xs space-y-2.5 transition-all ${
            isOffline
              ? 'bg-rose-50/70 border-rose-200/80 text-rose-900'
              : 'bg-amber-50/70 border-amber-200/80 text-amber-900'
          }`}
        >
          <p className="font-semibold leading-relaxed">
            {isOffline
              ? 'Connexion réseau indisponible — bascule possible vers vos données locales.'
              : `Connexion lente détectée (${elapsedSeconds}s) — chargement toujours actif, vous pouvez patienter ou agir :`}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {onUseOfflineCache && (
              <button
                type="button"
                onClick={onUseOfflineCache}
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-colors cursor-pointer whitespace-nowrap shadow-2xs"
              >
                Charger le cache local
              </button>
            )}
            <button
              type="button"
              onClick={() => triggerViewRetry(onRetry)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-colors cursor-pointer whitespace-nowrap shadow-2xs"
            >
              Réessayer
            </button>
            {!isAlreadyOfflineRoute && (
              <button
                type="button"
                onClick={() => {
                  window.location.hash = '#/offline';
                }}
                className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold transition-colors cursor-pointer whitespace-nowrap shadow-2xs"
              >
                Coffre Hors-ligne
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const SlowNetworkEscapeBar: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => {
  const { isOffline, elapsedSeconds, isSlowWait } = useSlowOrOfflineState(3);

  if (!isSlowWait) return null;
  const isAlreadyOfflineRoute = typeof window !== 'undefined' && window.location.hash.includes('/offline');

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-center gap-2.5 text-xs">
      <span className="text-slate-600 font-medium">
        {isOffline ? 'Réseau indisponible.' : `Connexion lente détectée (${elapsedSeconds}s).`}
      </span>
      <button
        type="button"
        onClick={() => triggerViewRetry(onRetry)}
        className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
      >
        Réessayer
      </button>
      {!isAlreadyOfflineRoute && (
        <button
          type="button"
          onClick={() => {
            window.location.hash = '#/offline';
          }}
          className="px-3.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap"
        >
          Coffre Hors-ligne
        </button>
      )}
    </div>
  );
};

export const StudentDossierSkeleton: React.FC<{
  title?: string;
  onRetry?: () => void;
}> = ({
  title = "Ouverture de la fiche élève...",
  onRetry
}) => {
  const { isOffline, elapsedSeconds, isSlowWait } = useSlowOrOfflineState(3);

  return (
    <div className="max-w-7xl mx-auto space-y-5 animate-in fade-in duration-200 px-2 sm:px-4 lg:px-6 pb-12">
      {/* Status bar explicite et épurée (1 ligne, au plus 1 bouton si lent) */}
      <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{title}</p>
            {isSlowWait && (
              <p className="text-xs text-slate-500 truncate">
                {isOffline ? 'Hors-ligne — cache local requis' : `Connexion lente (${elapsedSeconds}s), chargement des données...`}
              </p>
            )}
          </div>
        </div>
        {isSlowWait && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => triggerViewRetry(onRetry)}
              className="px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              Réessayer
            </button>
            {isOffline && (
              <button
                type="button"
                onClick={() => {
                  window.location.hash = '#/offline';
                }}
                className="px-3.5 py-2 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold hover:bg-rose-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                Coffre hors-ligne
              </button>
            )}
          </div>
        )}
      </div>

      {/* En-tête fiche élève skeleton */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl shrink-0" />
          <div className="space-y-2 flex-1 max-w-sm">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3.5 w-1/2" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 space-y-2.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* Sections identité & solvabilité skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <Skeleton className="h-4 w-44" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {[1, 2, 3, 4].map((k) => (
              <div key={k} className="space-y-1.5">
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="h-4 w-36" />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
};

export const ModernRegistrySkeleton: React.FC<{ 
  title?: string;
  subtitle?: string;
  rows?: number;
  type?: 'table' | 'cards';
  onRetry?: () => void;
}> = ({ 
  title = "Chargement du registre...", 
  subtitle,
  rows = 6,
  type = 'table',
  onRetry
}) => {
  const { isOffline, elapsedSeconds, isSlowWait } = useSlowOrOfflineState(3);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* Banner Skeleton */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/20 flex items-center justify-center shrink-0">
            <div className="w-4 h-4 rounded-full border-2 border-indigo-300 border-t-transparent animate-spin" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{title}</p>
            <p className="text-xs text-slate-400 truncate mt-0.5">
              {isOffline
                ? 'Hors-ligne — bascule vers le cache local ou Coffre Hors-ligne'
                : isSlowWait
                  ? `Connexion lente (${elapsedSeconds}s) — vous pouvez patienter ou réessayer`
                  : subtitle || 'Récupération des données en cours...'}
            </p>
          </div>
        </div>
        {(onRetry || isSlowWait) && (
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => triggerViewRetry(onRetry)}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              Réessayer
            </button>
            {isOffline && (
              <button
                type="button"
                onClick={() => {
                  window.location.hash = '#/offline';
                }}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
              >
                Coffre Hors-ligne
              </button>
            )}
          </div>
        )}
      </div>

    {/* Filter bar Skeleton */}
    <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
      <Skeleton className="h-11 w-full md:w-80 rounded-2xl" />
      <div className="flex items-center gap-3 w-full md:w-auto justify-end">
        <Skeleton className="h-10 w-28 rounded-2xl" />
        <Skeleton className="h-10 w-28 rounded-2xl" />
        <Skeleton className="h-10 w-10 rounded-2xl shrink-0" />
      </div>
    </div>

    {/* Content Skeleton */}
    {type === 'table' ? (
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-slate-50 gap-4">
            <div className="flex items-center space-x-3.5 w-2/5">
              <Skeleton className="h-11 w-11 rounded-2xl shrink-0" />
              <div className="space-y-2 w-full">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-4 w-1/5" />
            <Skeleton className="h-8 w-24 rounded-xl shrink-0" />
          </div>
        ))}
      </div>
    ) : (
      <SkeletonCard count={rows} />
    )}
  </div>
  );
};

export const ModernDashboardSkeleton: React.FC<{
  title?: string;
  subtitle?: string;
  onRetry?: () => void;
}> = ({
  title = "Initialisation du Tableau de Bord...",
  subtitle = "Chargement sécurisé des indicateurs clés, finances et données académiques en temps réel...",
  onRetry
}) => (
  <div className="space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto w-full p-4 md:p-8">
    {/* Light White Card Header with Fluid Loading State */}
    <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col items-center justify-center text-center">
      <FluidLoadingState message={title} subtext={subtitle} />
      <SlowNetworkEscapeBar onRetry={onRetry} />
    </div>

    {/* 4 Bento KPI Cards Skeletons */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-11 w-11 bg-indigo-50/80 rounded-2xl shrink-0" />
          </div>
          <div className="space-y-2 pt-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>

    {/* Charts & Details Skeletons */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-8 w-24 rounded-xl" />
        </div>
        <div className="h-64 flex items-end justify-between gap-3 pt-6 border-t border-slate-100">
          {[40, 65, 30, 85, 50, 70, 90, 60, 75, 45, 80, 55].map((h, idx) => (
            <div key={idx} className="flex-1 bg-gradient-to-t from-indigo-100/60 to-slate-100 rounded-t-xl animate-pulse" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-5">
        <Skeleton className="h-5 w-36" />
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((j) => (
            <div key={j} className="w-full h-12 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center px-4 justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-xl shrink-0" />
                <Skeleton className="h-3.5 w-28" />
              </div>
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export const SubmittingButtonContent: React.FC<{ label: string; icon?: React.ReactNode }> = ({ label, icon }) => (
  <span className="flex items-center justify-center gap-2">
    <span className="relative flex items-center justify-center w-4 h-4">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
    </span>
    <span className="font-bold">{label}</span>
  </span>
);
