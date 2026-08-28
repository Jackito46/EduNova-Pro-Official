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
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[9999] pointer-events-auto print:hidden max-w-[calc(100vw-2rem)] font-sans transition-all duration-300">
      {isMinimized ? (
        /* Minimized Compact Floating Pill */
        <div 
          onClick={() => setIsMinimized(false)}
          className={`group flex items-center gap-3 px-4 py-2.5 rounded-full cursor-pointer transition-all duration-300 shadow-2xl backdrop-blur-xl border ${
            isOffline 
              ? 'bg-slate-900/95 border-rose-500/60 text-rose-100 shadow-rose-950/40 hover:border-rose-400' 
              : 'bg-slate-900/95 border-amber-500/60 text-amber-100 shadow-amber-950/40 hover:border-amber-400'
          }`}
          title="Cliquer pour agrandir l'indicateur de connexion"
        >
          {/* Animated Status Pulse */}
          <span className="relative flex h-3 w-3 items-center justify-center">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isOffline ? 'bg-rose-400' : 'bg-amber-400'
            }`} />
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
              isOffline ? 'bg-rose-500' : 'bg-amber-500'
            }`} />
          </span>

          <div className="flex items-center gap-2 text-xs font-bold tracking-tight">
            {isOffline ? (
              <>
                <WifiOff size={14} className="text-rose-400" />
                <span>Mode Local (Hors-ligne)</span>
              </>
            ) : (
              <>
                <ZapOff size={14} className="text-amber-400" />
                <span>Connexion Faible</span>
                {latency && <span className="text-[10px] opacity-75 font-mono">({latency}ms)</span>}
              </>
            )}
          </div>

          <button 
            type="button"
            className="ml-1 p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white/80"
          >
            <Maximize2 size={12} />
          </button>
        </div>
      ) : (
        /* Full Modern Glassmorphism Banner */
        <div className={`relative overflow-hidden rounded-2xl bg-slate-900/95 backdrop-blur-2xl border text-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 ${
          isOffline ? 'border-rose-500/40 shadow-rose-950/20' : 'border-amber-500/40 shadow-amber-950/20'
        }`}>
          {/* Top Edge Gradient Glow Line */}
          <div className={`h-1 w-full bg-gradient-to-r ${
            isOffline 
              ? 'from-rose-500 via-red-500 to-pink-600' 
              : 'from-amber-400 via-orange-500 to-yellow-500'
          }`} />

          <div className="p-4 sm:p-4.5 space-y-3">
            {/* Header row */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Glowing Icon Badge */}
                <div className={`relative p-2.5 rounded-xl border flex items-center justify-center shrink-0 ${
                  isOffline 
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-400' 
                    : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                }`}>
                  <span className="relative flex h-2 w-2 absolute -top-0.5 -right-0.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      isOffline ? 'bg-rose-400' : 'bg-amber-400'
                    }`} />
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${
                      isOffline ? 'bg-rose-500' : 'bg-amber-500'
                    }`} />
                  </span>

                  {isOffline ? <WifiOff size={20} /> : <ZapOff size={20} />}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-white tracking-tight leading-snug">
                      {isOffline ? 'Mode Local (Hors-ligne)' : 'Connexion Faible'}
                    </h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border tracking-wide uppercase ${
                      isOffline 
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}>
                      {isOffline ? 'Hors-Ligne' : 'Instable'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mt-0.5 font-medium leading-normal">
                    {isOffline 
                      ? 'Synchronisation suspendue. Données enregistrées en cache local.' 
                      : 'Latence élevée détectée. Le chargement peut être ralenti.'}
                  </p>
                </div>
              </div>

              {/* Minimize button */}
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                title="Réduire l'indicateur"
              >
                <Minimize2 size={16} />
              </button>
            </div>

            {/* Bottom Status bar & Actions */}
            <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                <span className="inline-flex items-center gap-1">
                  <Activity size={12} className="text-slate-400" />
                  {formattedTime ? `Contrôle : ${formattedTime}` : 'Test en cours'}
                </span>
                {latency && isSlow && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-amber-400">{latency} ms</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Refresh connection check button */}
                <button
                  type="button"
                  onClick={refreshStatus}
                  disabled={isChecking}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-slate-700 disabled:opacity-50 flex items-center gap-1 text-[11px] font-medium"
                  title="Vérifier l'état de la connexion réseau"
                >
                  <RotateCw size={13} className={isChecking ? 'animate-spin text-indigo-400' : ''} />
                  <span className="hidden sm:inline">{isChecking ? 'Vérification...' : 'Tester'}</span>
                </button>

                {/* Offline Data Link Button */}
                {isOffline && (
                  <Link
                    to="/offline"
                    className="bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-semibold text-xs px-3 py-1.5 rounded-xl shadow-lg shadow-rose-950/50 hover:shadow-rose-900/60 transition-all flex items-center gap-1.5 border border-rose-400/30 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <ShieldCheck size={14} />
                    <span>Données Locales</span>
                    <ArrowRight size={13} />
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
