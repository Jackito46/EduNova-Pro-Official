import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, X, Loader2 } from 'lucide-react';
import { UserProfile, UserRole } from '../types';

interface LogoutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  user: UserProfile;
}

const ROLE_LABELS: Record<string, string> = {
  [UserRole.SUPER_ADMIN]: 'Super Admin',
  [UserRole.SCHOOL_ADMIN]: 'Administrateur',
  [UserRole.DIRECTOR]: 'Direction',
  [UserRole.SECRETARY]: 'Secrétariat',
  [UserRole.ACCOUNTANT]: 'Comptabilité',
  [UserRole.TEACHER]: 'Enseignant',
  [UserRole.SUPERVISOR]: 'Surveillance',
  [UserRole.LIBRARIAN]: 'Bibliothécaire',
  [UserRole.STUDENT]: 'Élève / Étudiant',
  [UserRole.PARENT]: 'Parent',
};

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  user
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isProcessing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen) return null;

  const roleLabel = ROLE_LABELS[user.role] || user.role || 'Utilisateur';

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    // Clean out parentheses, brackets and punctuation to avoid "J(" from "Jackito (Master)"
    const cleaned = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const handleLogoutClick = () => {
    setIsProcessing(true);
    onConfirm();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[2500] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Modern Blur Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm"
          onClick={!isProcessing ? onClose : undefined}
        />

        {/* Compact, Modern Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-[360px] bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden z-10 select-none my-auto p-4 sm:p-4.5 space-y-3.5"
          role="dialog"
          aria-modal="true"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="absolute top-3.5 right-3.5 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
            aria-label="Fermer"
          >
            <X size={15} />
          </button>

          {/* Compact Modern Header (Horizontal Icon + Title) */}
          <div className="flex items-start gap-3 pr-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-50 to-rose-100 border border-rose-200/80 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
              <LogOut size={18} className="-translate-x-0.2" />
            </div>

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-none">
                  Se déconnecter ?
                </h3>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200/80">
                  Session
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium leading-snug mt-1">
                Êtes-vous sûr de vouloir fermer votre session active ?
              </p>
            </div>
          </div>

          {/* Dense User Session Card */}
          <div className="bg-slate-50/90 hover:bg-slate-100/70 border border-slate-200/90 rounded-xl p-2.5 flex items-center gap-2.5 transition-colors">
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.full_name}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  getInitials(user.full_name)
                )}
              </div>
              <span 
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white ring-1 ring-emerald-500/30" 
                title="Session en ligne" 
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {user.full_name}
                </p>
                <span className="px-1.5 py-0.2 rounded text-[9.5px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200/80 shrink-0">
                  {roleLabel}
                </span>
              </div>
              <p className="text-[10.5px] text-slate-500 font-mono truncate mt-0.5">
                {user.email || 'Compte actif'}
              </p>
            </div>
          </div>

          {/* Fluid & Responsive Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="w-full py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              Annuler
            </button>

            <button
              type="button"
              onClick={handleLogoutClick}
              disabled={isProcessing}
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 active:scale-[0.98] text-white font-bold text-xs shadow-sm shadow-rose-600/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-80"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Déconnexion...</span>
                </>
              ) : (
                <>
                  <LogOut size={13} className="stroke-[2.5]" />
                  <span>Se déconnecter</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
