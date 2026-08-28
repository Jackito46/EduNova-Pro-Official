import React, { useState } from 'react';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, ShieldCheck, KeyRound, X, AlertCircle } from 'lucide-react';
import { supabase } from '../supabase';
import { UserProfile } from '../types';
import { AuditLogger } from '../utils/auditLogger';
import { toast } from 'sonner';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose, user }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Criteria validation
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);

  const isValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    if (!isValid) {
      setError("Le mot de passe ne respecte pas tous les critères de sécurité.");
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        throw new Error("Session expirée. Veuillez vous reconnecter.");
      }

      const { error: authError } = await supabase.auth.updateUser({ 
        password: newPassword 
      });

      if (authError) {
        const rawMsg = (authError.message || '').toLowerCase();
        if (rawMsg.includes('same as') || rawMsg.includes('different')) {
          throw new Error("Le nouveau mot de passe doit être différent de l'ancien mot de passe.");
        }
        throw new Error(authError.message || "Impossible de mettre à jour le mot de passe.");
      }

      await supabase
        .from('profiles')
        .update({ 
          last_password_changed_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (user.school_id) {
        try {
          await AuditLogger.log({
            school_id: user.school_id,
            user_id: user.id,
            action: 'UPDATE',
            entity_type: 'user',
            entity_id: user.id,
            details: { type: 'voluntary_password_change' }
          });
        } catch (e) {}
      }

      toast.success("Votre mot de passe a été mis à jour avec succès !");
      setNewPassword('');
      setConfirmPassword('');
      onClose();
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue lors de la modification du mot de passe.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600/30 border border-indigo-400/30 text-indigo-300 rounded-xl flex items-center justify-center shrink-0">
              <KeyRound size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">Changer mon mot de passe</h3>
              <p className="text-xs text-slate-400">Compte : {user.full_name}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
              <p className="font-medium leading-relaxed">{error}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Nouveau mot de passe</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Ex: @EduNova2026!"
                required
                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Confirmer le mot de passe</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Répétez le mot de passe"
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 transition-all"
            />
          </div>

          {/* Password Security Check list */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
            <p className="text-[11px] font-bold text-slate-700">Exigences de sécurité :</p>
            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              <span className={`flex items-center gap-1 font-medium ${hasMinLength ? 'text-emerald-600' : 'text-slate-400'}`}>
                <CheckCircle2 size={12} /> Au moins 8 caractères
              </span>
              <span className={`flex items-center gap-1 font-medium ${hasUpper ? 'text-emerald-600' : 'text-slate-400'}`}>
                <CheckCircle2 size={12} /> 1 lettre majuscule
              </span>
              <span className={`flex items-center gap-1 font-medium ${hasLower ? 'text-emerald-600' : 'text-slate-400'}`}>
                <CheckCircle2 size={12} /> 1 lettre minuscule
              </span>
              <span className={`flex items-center gap-1 font-medium ${hasNumber ? 'text-emerald-600' : 'text-slate-400'}`}>
                <CheckCircle2 size={12} /> 1 chiffre (0-9)
              </span>
              <span className={`flex items-center gap-1 font-medium col-span-2 ${hasSpecial ? 'text-emerald-600' : 'text-slate-400'}`}>
                <CheckCircle2 size={12} /> 1 caractère spécial (@, #, $, !, %, etc.)
              </span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !isValid}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-200 flex items-center gap-2 transition-all active:scale-95"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
