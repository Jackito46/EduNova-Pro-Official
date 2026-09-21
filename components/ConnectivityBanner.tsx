import React, { useState } from 'react';
import { WifiOff, ZapOff, ArrowRight, RotateCw, Minimize2, Maximize2, ShieldCheck, Activity } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { Link } from 'react-router-dom';

const ConnectivityBanner: React.FC = () => {
  const { isOnline, isSlow, latency, lastChecked, isChecking, refreshStatus } = useOnlineStatus();
  const [isMinimized, setIsMinimized] = useState(false);

  // If online and normal speed, render nothing
  if (isOnline && !isSlow) {
    return null;
  }

  const isOffline = !isOnline;

  // Format last checked time
  const formattedTime = lastChecked 
    ? lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  return (
    <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-[9999] pointer-events-auto print:hidden w-[calc(100vw-1.5rem)] sm:w-auto sm:max-w-md font-sans transition-all duration-300">
      {isMinimized ? (
        /* Minimized Compact Floating Pill */
        <div 
          onClick={() => setIsMinimized(false)}
          className={`group flex items-center justify-between sm:justify-start gap-2.5 px-3 py-1.5 rounded-full cursor-pointer transition-all duration-200 shadow-xl backdrop-blur-xl border ${
            isOffline 
              ? 'bg-slate-900/95 border-rose-500/50 text-rose-100 shadow-rose-950/30 hover:border-rose-400' 
              : 'bg-slate-900/95 border-amber-500/50 text-amber-100 shadow-amber-950/30 hover:border-amber-400'
          }`}
          title="Cliquer pour afficher les détails de connectivité"
        >
          {/* Animated Status Pulse */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5 items-center justify-center">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isOffline ? 'bg-rose-400' : 'bg-amber-400'
              }`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                isOffline ? 'bg-rose-500' : 'bg-amber-500'
              }`} />
            </span>

            <div className="flex items-center gap-1.5 text-xs font-semibold tracking-tight">
              {isOffline ? (
                <>
                  <WifiOff size={13} className="text-rose-400" />
                  <span>Mode Hors-ligne</span>
                </>
              ) : (
                <>
                  <ZapOff size={13} className="text-amber-400" />
                  <span>Connexion Faible</span>
                  {latency && <span className="text-[10px] text-amber-300/80 font-mono">({latency}ms)</span>}
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pl-1 border-l border-white/10">
            <Maximize2 size={11} className="group-hover:text-white transition-colors" />
          </div>
        </div>
      ) : (
        /* Full Modern Fluid & Compact Card */
        <div className={`relative overflow-hidden rounded-xl bg-slate-900/95 backdrop-blur-xl border text-slate-100 shadow-[0_12px_36px_rgba(0,0,0,0.45)] transition-all duration-200 animate-in fade-in slide-in-from-bottom-3 ${
          isOffline ? 'border-rose-500/35 shadow-rose-950/20' : 'border-amber-500/35 shadow-amber-950/20'
        }`}>
          {/* Ultra-sleek Micro Gradient Line */}
          <div className={`h-0.5 w-full bg-gradient-to-r ${
            isOffline 
              ? 'from-rose-500 via-red-500 to-pink-500' 
              : 'from-amber-400 via-orange-500 to-yellow-400'
          }`} />

          <div className="p-3 sm:p-3.5 space-y-2">
            {/* Header row: Icon + Title + Status Badge + Minimize */}
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Glowing Icon Box - compact */}
                <div className={`relative w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                  isOffline 
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-400' 
                    : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                }`}>
                  <span className="relative flex h-1.5 w-1.5 absolute -top-0.5 -right-0.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      isOffline ? 'bg-rose-400' : 'bg-amber-400'
                    }`} />
                    <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                      isOffline ? 'bg-rose-500' : 'bg-amber-500'
                    }`} />
                  </span>

                  {isOffline ? <WifiOff size={16} /> : <ZapOff size={16} />}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
                      {isOffline ? 'Mode Local (Hors-ligne)' : 'Connexion Faible'}
                    </h4>
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border tracking-wide uppercase shrink-0 ${
                      isOffline 
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}>
                      {isOffline ? 'HORS-LIGNE' : 'INSTABLE'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-normal truncate mt-0.5">
                    {isOffline 
                      ? 'Synchronisation suspendue • Données en cache local' 
                      : 'Latence réseau élevée • Le chargement peut être ralenti'}
                  </p>
                </div>
              </div>

              {/* Minimize button */}
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="text-slate-400 hover:text-white p-1 hover:bg-white/10 rounded-md transition-colors shrink-0"
                title="Réduire l'indicateur"
              >
                <Minimize2 size={14} />
              </button>
            </div>

            {/* Bottom Status bar & Actions */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium font-mono">
                <Activity size={11} className={isOffline ? "text-rose-400/80" : "text-amber-400/80"} />
                <span>{formattedTime ? `Contrôle : ${formattedTime}` : 'Test en cours'}</span>
                {latency && isSlow && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-amber-400 font-mono">({latency}ms)</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Refresh connection check button */}
                <button
                  type="button"
                  onClick={refreshStatus}
                  disabled={isChecking}
                  className="h-7 px-2.5 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 text-slate-300 hover:text-white transition-all border border-slate-700/80 disabled:opacity-50 flex items-center gap-1 text-[11px] font-medium"
                  title="Vérifier l'état de la connexion réseau"
                >
                  <RotateCw size={12} className={isChecking ? 'animate-spin text-indigo-400' : ''} />
                  <span>{isChecking ? 'Test...' : 'Tester'}</span>
                </button>

                {/* Offline Data Link Button */}
                {isOffline && (
                  <Link
                    to="/offline"
                    className="h-7 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-[11px] shadow-sm shadow-rose-950/40 transition-all flex items-center gap-1 border border-rose-400/30 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <ShieldCheck size={13} />
                    <span>Données Locales</span>
                    <ArrowRight size={11} />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectivityBanner;
