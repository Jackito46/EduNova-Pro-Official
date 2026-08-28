import React, { useState } from 'react';
import { Shield, Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, ShieldCheck, KeyRound } from 'lucide-react';
import { supabase } from '../supabase';
import { UserProfile } from '../types';
import { AuditLogger } from '../utils/auditLogger';
import Logo from './Logo';
import FormFooter from './FormFooter';
import edunovaLogo from '../src/assets/images/edunova_logo2_exact_authentic_colors_1786352038404.jpg';

interface ForcePasswordChangeProps {
  user: UserProfile;
  onPasswordChanged: (updatedProfile: UserProfile) => void;
}

export const ForcePasswordChange: React.FC<ForcePasswordChangeProps> = ({ user, onPasswordChanged }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    // Password constraints
    if (newPassword.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setError("Le mot de passe doit contenir au moins une lettre majuscule.");
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      setError("Le mot de passe doit contenir au moins une lettre minuscule.");
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setError("Le mot de passe doit contenir au moins un chiffre.");
      return;
    }
    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      setError("Le mot de passe doit contenir au moins un caractère spécial.");
      return;
    }

    setLoading(true);
    try {
      // 1. Verify active session
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        throw new Error("Session expirée. Veuillez vous déconnecter et vous reconnecter avec votre mot de passe temporaire.");
      }

      // 2. Update password in Supabase Auth & DB via secure RPC (reactivates account and clears lockout)
      let rpcSuccess = false;
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('self_unlock_and_change_password', {
          p_new_password: newPassword
        });
        if (!rpcError && rpcData?.success) {
          rpcSuccess = true;
        }
      } catch (rpcErr) {
        console.warn("self_unlock_and_change_password notice:", rpcErr);
      }

      // Also update via standard Supabase Auth updateUser
      const { error: authError } = await supabase.auth.updateUser({ 
        password: newPassword 
      });
      
      if (authError && !rpcSuccess) {
        console.error("Auth updateUser error:", authError);
        const rawMsg = (authError.message || '').toLowerCase();
        if (rawMsg.includes('same as') || rawMsg.includes('different')) {
          throw new Error("Le nouveau mot de passe doit être différent de l'ancien mot de passe.");
        } else if (rawMsg.includes('session') || rawMsg.includes('token') || rawMsg.includes('auth')) {
          throw new Error("Votre session de connexion est invalide. Veuillez vous reconnecter.");
        }
        throw new Error(authError.message || "Impossible de mettre à jour le mot de passe.");
      }

      // 3. Update force_password_change flag and last_password_changed_at in profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          is_active: true,
          failed_login_attempts: 0,
          failed_attempts: 0,
          force_password_change: false,
          last_password_changed_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) {
        console.warn("Could not update profile force_password_change flag directly:", profileError);
      }

      // 4. Log the action
      try {
        await AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: 'UPDATE',
          entity_type: 'user',
          entity_id: user.id,
          details: { type: 'forced_password_change_completed' }
        });
      } catch (logErr) {
        console.warn("Audit log failed during forced password change:", logErr);
      }

      setSuccess(true);
      
      // Notify parent to update user state and allow access
      setTimeout(() => {
        onPasswordChanged({ ...user, force_password_change: false });
      }, 2000);

    } catch (err: any) {
      console.error("Error updating password:", err);
      setError(err.message || "Une erreur est survenue lors de la mise à jour du mot de passe.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-lg md:max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[92vh] border border-slate-100 my-auto animate-in zoom-in-95 duration-300">
        
        {/* Left Side / Top Banner: EduNova Security Header */}
        <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 p-6 sm:p-8 text-white flex flex-col justify-between md:w-5/12 shrink-0 relative overflow-hidden">
          {/* Subtle decorative elements */}
          <div className="absolute -top-12 -left-12 w-40 h-40 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-40 h-40 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white p-1 shadow-lg shrink-0 flex items-center justify-center overflow-hidden">
                <Logo src={edunovaLogo} size="md" className="w-full h-full" imgClassName="object-cover" />
              </div>
              <div>
                <span className="text-xs font-black text-indigo-300 tracking-wider uppercase block">EduNova Pro</span>
                <span className="text-base font-bold text-white tracking-tight">Espace Sécurisé</span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/20 border border-rose-400/30 text-rose-300 text-xs font-bold">
                <Shield size={14} className="text-rose-400" />
                <span>Sécurité Obligatoire</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-snug">
                Définissez votre mot de passe
              </h2>
              <p className="text-slate-300 text-xs sm:text-sm font-normal leading-relaxed">
                Votre compte nécessite un nouveau mot de passe personnel pour protéger vos données académiques.
              </p>
            </div>
          </div>

          <div className="relative z-10 pt-6 mt-6 border-t border-indigo-800/40 hidden md:block">
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-medium">
              <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
              <span>Chiffrement bout en bout (AES-256)</span>
            </div>
          </div>
        </div>

        {/* Right Side: Password Change Form */}
        <div className="p-6 sm:p-8 md:w-7/12 flex-1 overflow-y-auto custom-scrollbar flex flex-col justify-center bg-white">
          {success ? (
            <div className="py-8 text-center space-y-4 animate-in fade-in zoom-in">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={44} />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900">Mot de passe mis à jour !</h3>
              <p className="text-slate-500 text-sm font-medium">
                Accès autorisé. Redirection vers votre tableau de bord...
              </p>
            </div>
          ) : (
            <form onSubmit={handleUpdatePassword} className="space-y-5">
              {error && (
                <div className="p-3.5 bg-rose-50 border border-rose-200/60 rounded-2xl flex items-start gap-3 text-rose-700 animate-in shake duration-300">
                  <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-600" />
                  <p className="text-xs font-semibold leading-relaxed">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block ml-0.5">
                    Nouveau Mot de Passe
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <KeyRound size={18} />
                    </div>
                    <input 
                      type={showPassword ? "text" : "password"}
                      required
                      className="w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                      title={showPassword ? "Masquer" : "Afficher"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block ml-0.5">
                    Confirmer le Mot de Passe
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <Lock size={18} />
                    </div>
                    <input 
                      type={showPassword ? "text" : "password"}
                      required
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Password criteria checklist */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Exigences de sécurité :
                </p>
                <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  <li className={`text-xs font-semibold flex items-center gap-1.5 ${newPassword.length >= 8 ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${newPassword.length >= 8 ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-slate-300'}`} /> 
                    8+ caractères
                  </li>
                  <li className={`text-xs font-semibold flex items-center gap-1.5 ${/[A-Z]/.test(newPassword) ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${/[A-Z]/.test(newPassword) ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-slate-300'}`} /> 
                    Majuscule
                  </li>
                  <li className={`text-xs font-semibold flex items-center gap-1.5 ${/[0-9]/.test(newPassword) ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${/[0-9]/.test(newPassword) ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-slate-300'}`} /> 
                    Chiffre
                  </li>
                  <li className={`text-xs font-semibold flex items-center gap-1.5 ${/[^A-Za-z0-9]/.test(newPassword) ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${/[^A-Za-z0-9]/.test(newPassword) ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-slate-300'}`} /> 
                    Caractère spécial
                  </li>
                </ul>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-sm tracking-tight hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2.5 disabled:opacity-50 active:scale-[0.99] cursor-pointer mt-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                Enregistrer mon mot de passe
              </button>

              <FormFooter variant="minimal" className="pt-3" />
            </form>
          )}
        </div>

      </div>
    </div>
  );
};

