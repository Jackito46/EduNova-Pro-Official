import React from 'react';
import { RefreshCcw, AlertCircle } from 'lucide-react';

interface RetryableErrorProps {
  message?: string;
  onRetry: () => void;
  className?: string;
}

export const RetryableError: React.FC<RetryableErrorProps> = ({ 
  message = "Une erreur de connexion est survenue.", 
  onRetry,
  className = ""
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center space-y-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 ${className}`}>
      <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center">
        <AlertCircle size={24} />
      </div>
      <div className="space-y-1">
        <p className="text-slate-900 font-bold text-sm">{message}</p>
        <p className="text-slate-500 text-[10px] font-medium">Vérifiez votre connexion internet et réessayez.</p>
      </div>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg text-[10px] uppercase tracking-tight shadow-md shadow-indigo-500/20 hover:bg-indigo-500 transition-all active:scale-95"
      >
        <RefreshCcw size={14} />
        Réessayer
      </button>
    </div>
  );
};
