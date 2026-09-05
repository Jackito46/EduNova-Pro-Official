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
    return name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const handleLogoutClick = () => {
    setIsProcessing(true);
    onConfirm();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[2500] flex items-center justify-center p-4 overflow-y-auto">
        {/* Clean Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
          onClick={!isProcessing ? onClose : undefined}
        />

        {/* Modal Box */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden z-10 select-none my-auto"
          role="dialog"
          aria-modal="true"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>

          <div className="p-6 text-center space-y-4">
            {/* Top Icon */}
            <div className="mx-auto w-12 h-12 rounded-full bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shadow-xs">
              <LogOut size={20} className="-translate-x-0.5" />
            </div>

            {/* Title & Short Question */}
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">
                Se déconnecter ?
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Êtes-vous sûr de vouloir fermer votre session active ?
              </p>
            </div>

            {/* Compact User Tag */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex items-center gap-3 text-left">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.full_name}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  getInitials(user.full_name)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900 truncate">
                  {user.full_name}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {user.email || roleLabel}
                </p>
              </div>
            </div>

            {/* Clean Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={handleLogoutClick}
                disabled={isProcessing}
                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-80"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Déconnexion...</span>
                  </>
                ) : (
                  <span>Se déconnecter</span>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
