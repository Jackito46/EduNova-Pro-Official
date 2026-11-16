import React from 'react';
import { RefreshCcw, WifiOff, ShieldCheck } from 'lucide-react';

interface ConnectionRetryFallbackProps {
  message?: string;
  onRetry: () => void;
  className?: string;
}

export const ConnectionRetryFallback: React.FC<ConnectionRetryFallbackProps> = ({
  message = "Une erreur de connexion est survenue.",
  onRetry,
  className = ""
}) => {
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  const isAlreadyOfflineRoute = typeof window !== 'undefined' && window.location.hash.includes('/offline');

  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center space-y-4 bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isOffline ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
        <WifiOff size={24} />
      </div>
      <div className="space-y-1.5">
        <p className="text-slate-900 font-bold text-base">{message}</p>
        <p className="text-slate-500 text-xs font-medium max-w-sm mx-auto leading-relaxed">
          {isOffline
            ? 'Votre appareil est hors-ligne. Réessayez dès que le réseau revient ou utilisez le Coffre Hors-ligne.'
            : 'La connexion réseau est instable ou lente. Vous pouvez relancer la requête ou passer en mode hors-ligne.'}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white font-semibold rounded-xl text-xs hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <RefreshCcw size={14} />
          Réessayer
        </button>
        {!isAlreadyOfflineRoute && (
          <button
            type="button"
            onClick={() => { window.location.hash = '#/offline'; }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-50 text-rose-700 border border-rose-200 font-semibold rounded-xl text-xs hover:bg-rose-100 transition-colors cursor-pointer"
          >
            <ShieldCheck size={14} />
            Coffre Hors-ligne
          </button>
        )}
      </div>
    </div>
  );
};

export const RetryableError = ConnectionRetryFallback;
export default ConnectionRetryFallback;
