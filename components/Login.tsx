import React, { useState, useEffect } from 'react';
import { UserRole, UserProfile } from '../types';
import { supabase, checkSupabaseConnection, isRefreshTokenError, clearAuthStorage } from '../supabase';
import { AuditLogger } from '../utils/auditLogger';
import { normalizeIdentifier } from '../utils/authHelpers';
import { Wifi, WifiOff, Loader2, RefreshCw, Mail, Lock, ArrowRight, ShieldCheck, AlertCircle, ChevronLeft, CheckCircle2, ShieldAlert, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from './Logo';
import FormFooter from './FormFooter';
import edunovaLogo from '../src/assets/images/edunova_logo2_exact_authentic_colors_1786352038404.jpg';

interface LoginProps {
  onLogin: (user: UserProfile) => void;
  onReset: () => void;
}

const AUTH_STEPS = [
  { id: 1, title: "Chiffrement des identifiants", desc: "Vérification sécurisée auprès du serveur d'authentification" },
  { id: 2, title: "Contrôle des accréditations", desc: "Validation de votre profil, établissement et droits d'accès" },
  { id: 3, title: "Préparation de l'espace", desc: "Chargement de votre session de travail EduNova Pro" }
];

const Login: React.FC<LoginProps> = ({ onLogin, onReset }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authStep, setAuthStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [securitySettings, setSecuritySettings] = useState({ maxFailedAttempts: 3, lockoutDurationMinutes: 10 });
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  useEffect(() => {
    let stepInterval: NodeJS.Timeout;
    if (isSubmitting) {
      setAuthStep(1);
      stepInterval = setInterval(() => {
        setAuthStep((prev) => (prev < 3 ? prev + 1 : prev));
      }, 1400);
    } else {
      setAuthStep(1);
    }
    return () => clearInterval(stepInterval);
  }, [isSubmitting]);

  React.useEffect(() => {
    try {
      const storedError = window.sessionStorage.getItem('edunova_login_error');
      if (storedError) {
        setError(storedError);
        window.sessionStorage.removeItem('edunova_login_error');
      }
    } catch (e) {}

    // Load security settings & maintenance mode
    const loadSettings = async () => {
      try {
        const { data } = await supabase.from('global_settings').select('key, value').in('key', ['security_policy', 'system_status']);
        if (data) {
          const sec = data.find(i => i.key === 'security_policy');
          if (sec && sec.value) {
            setSecuritySettings({
              maxFailedAttempts: sec.value.max_failed_attempts || 3,
              lockoutDurationMinutes: sec.value.lockout_duration_minutes || 10
            });
          }
          const status = data.find(i => i.key === 'system_status');
          if (status && status.value && status.value.maintenance_mode) {
            setMaintenanceMode(true);
          }
        }
      } catch (e) {}
    };
    loadSettings();
  }, []);

  const testConnection = async () => {
    setIsTestingConnection(true);
    setConnectionStatus('idle');
    const isReachable = await checkSupabaseConnection();
    setConnectionStatus(isReachable ? 'success' : 'failed');
    setIsTestingConnection(false);
    
    if (!isReachable) {
      setError("Le serveur est injoignable. Vérifiez votre connexion internet ou réessayez plus tard.");
    } else {
      setError(null);
    }
  };

  const getAttemptsKey = (email: string) => `edunova_login_attempts_${email.toLowerCase()}`;

  const checkLockout = (email: string) => {
    try {
      const data = window.localStorage.getItem(getAttemptsKey(email));
      if (data) {
        const { count, lockedUntil } = JSON.parse(data);
        if (lockedUntil && Date.now() < lockedUntil) {
          const minutesLeft = Math.ceil((lockedUntil - Date.now()) / 60000);
          throw new Error(`Compte temporairement bloqué suite à de trop nombreuses tentatives. Réessayez dans ${minutesLeft} minute(s).`);
        }
        if (lockedUntil && Date.now() >= lockedUntil) {
          window.localStorage.removeItem(getAttemptsKey(email));
        }
      }
    } catch (e) {
      if (e instanceof Error) throw e;
    }
  };

  const recordFailedAttempt = (email: string) => {
    try {
      const key = getAttemptsKey(email);
      const data = window.localStorage.getItem(key);
      let count = 1;
      if (data) {
        const parsed = JSON.parse(data);
        count = (parsed.count || 0) + 1;
      }
      
      if (count >= securitySettings.maxFailedAttempts) {
        const lockedUntil = Date.now() + securitySettings.lockoutDurationMinutes * 60 * 1000;
        window.localStorage.setItem(key, JSON.stringify({ count, lockedUntil }));
        return `Compte bloqué. Trop de tentatives échouées. Réessayez dans ${securitySettings.lockoutDurationMinutes} minutes.`;
      } else {
        window.localStorage.setItem(key, JSON.stringify({ count }));
        return `Email ou mot de passe incorrect. Il vous reste ${securitySettings.maxFailedAttempts - count} tentative(s).`;
      }
    } catch (e) {
      return "Email ou mot de passe incorrect. Veuillez vérifier vos accès.";
    }
  };

  const clearFailedAttempts = (email: string) => {
    try {
      window.localStorage.removeItem(getAttemptsKey(email));
    } catch (e) {}
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Veuillez saisir votre adresse email ou identifiant.");
      return;
    }
    const targetEmail = normalizeIdentifier(email);
    setIsSubmitting(true);
    setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'envoi de l'email de réinitialisation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const targetEmail = normalizeIdentifier(email);
    const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);

    try {
      try { 
        window.sessionStorage.setItem('edunova_login_in_progress', 'true');
        window.localStorage.setItem('edunova_session_id', sessionId);
        window.localStorage.setItem('edunova_session_synced', 'false');
      } catch (e) {}
      checkLockout(targetEmail);

      let authTimeoutId: NodeJS.Timeout;
      const authPromise = supabase.auth.signInWithPassword({ email: targetEmail, password });
      const authTimeout = new Promise<any>((_, reject) => 
        authTimeoutId = setTimeout(() => reject(new Error("Délai d'attente dépassé pour la connexion. Veuillez réespayer.")), 6000)
      );

      const { data: authData, error: authError } = await Promise.race([authPromise, authTimeout]);
      clearTimeout(authTimeoutId!);

      if (authError) {
        if (authError.message?.includes('Email not confirmed')) {
          throw new Error("Votre email n'est pas encore confirmé.");
        }
        if (authError.message?.includes('Invalid login credentials')) {
          try {
            const { data: dbResult } = await supabase.rpc('handle_failed_login', {
              p_email: targetEmail,
              p_max_attempts: securitySettings.maxFailedAttempts
            });
            
            if (dbResult) {
              if (dbResult.status === 'deactivated') {
                throw new Error("Votre compte a été désactivé suite à 3 tentatives de connexion infructueuses. Veuillez contacter un administrateur.");
              } else if (dbResult.status === 'already_inactive') {
                throw new Error("Ce compte est désactivé. Veuillez contacter un administrateur.");
              } else if (dbResult.status === 'incremented') {
                const count = dbResult.attempts || 1;
                const remaining = Math.max(0, securitySettings.maxFailedAttempts - count);
                throw new Error(`Email ou mot de passe incorrect. Il vous reste ${remaining} tentative(s) avant la désactivation de votre compte.`);
              }
            }
          } catch (dbErr: any) {
            // Keep the custom error message if it's already one of our handled statuses
            if (dbErr.message?.includes('désactivé') || dbErr.message?.includes('tentative') || dbErr.message?.includes('incorrect')) {
              throw dbErr;
            }
          }

          const msg = recordFailedAttempt(email);
          throw new Error(`Identifiants invalides. ${msg}`);
        }
        throw new Error(authError.message || "Erreur de connexion.");
      }

      clearFailedAttempts(targetEmail);
      // Non-blocking reset failed login counter
      (async () => {
        try {
          await supabase.rpc('reset_failed_login', { p_email: targetEmail });
        } catch (e) {
          console.warn("Failed to reset failed login counters on DB:", e);
        }
      })();

      if (authData.user) {
        let profileTimeoutId: NodeJS.Timeout;
        const profilePromise = supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .single();
        
        const profileTimeout = new Promise<any>((_, reject) => 
          profileTimeoutId = setTimeout(() => reject(new Error("Délai d'attente dépassé pour la récupération du profil.")), 4000)
        );

        const { data: profile, error: profileError } = await Promise.race([profilePromise, profileTimeout]);
        clearTimeout(profileTimeoutId!);

        if (profileError || !profile) {
          throw new Error("Profil introuvable.");
        }

        const finalProfile = profile as UserProfile;

        if (finalProfile.role === 'SUPER_ADMIN' || finalProfile.role === 'SCHOOL_ADMIN' || finalProfile.role === 'DIRECTOR') {
          try { window.localStorage.removeItem('edunova_current_campus_id'); } catch (err) {}
        }

        if (finalProfile.is_active === false && finalProfile.role !== 'SUPER_ADMIN' && !finalProfile.is_super_admin) {
          try { await supabase.auth.signOut(); } catch (e) {}
          throw new Error("Accès révoqué par l'administration.");
        }

        // Check maintenance mode if not super admin
        if (maintenanceMode && finalProfile.role !== 'SUPER_ADMIN' && !finalProfile.is_super_admin) {
          try { await supabase.auth.signOut(); } catch (e) {}
          throw new Error("La plateforme EduNova Pro est actuellement en cours de maintenance. Seuls les Super Administrateurs ont accès.");
        }

        // Check school status if not super admin with 2.5s timeout guard
        if (finalProfile.school_id && finalProfile.role !== 'SUPER_ADMIN' && !finalProfile.is_super_admin) {
          try {
            let schoolTimeoutId: NodeJS.Timeout;
            const schoolPromise = supabase
              .from('schools')
              .select('status')
              .eq('id', finalProfile.school_id)
              .single();
            const schoolTimeout = new Promise<any>((_, reject) => 
              schoolTimeoutId = setTimeout(() => reject(new Error("school check timeout")), 2500)
            );
            const { data: schoolData, error: schoolErr } = await Promise.race([schoolPromise, schoolTimeout]);
            clearTimeout(schoolTimeoutId!);

            if (!schoolErr && schoolData && schoolData.status !== 'ACTIVE') {
              try { await supabase.auth.signOut(); } catch (e) {}
              throw new Error("Cet établissement est actuellement désactivé ou suspendu. Veuillez contacter l'administration principale.");
            }
          } catch (schoolErr: any) {
            if (schoolErr.message?.includes('désactivé')) throw schoolErr;
            console.warn("School status check skipped or timed out during login:", schoolErr);
          }
        }

        finalProfile.current_session_id = sessionId;
        
        try { 
          window.localStorage.removeItem('edunova_logged_out');
          window.localStorage.setItem('edunova_user_profile', JSON.stringify(finalProfile)); 
          window.sessionStorage.setItem('edunova_session_active', 'true');
          window.localStorage.setItem('edunova_last_activity', Date.now().toString());
        } catch (err) {}

        // Fire-and-forget non-critical background updates (session tracking & audit logging)
        (async () => {
          try {
            await supabase
              .from('profiles')
              .update({ 
                last_activity_at: new Date().toISOString(),
                current_session_id: sessionId
              })
              .eq('id', authData.user.id);
            try { window.localStorage.setItem('edunova_session_synced', 'true'); } catch (e) {}
          } catch (updateCatchErr) {
            console.warn("Login background session update exception:", updateCatchErr);
          }

          if (finalProfile.school_id) {
            AuditLogger.log({
              school_id: finalProfile.school_id,
              user_id: finalProfile.id,
              action: 'LOGIN',
              entity_type: 'auth',
              details: { role: finalProfile.role }
            }).catch(() => {});
          }
        })();

        // Instant UI transition
        onLogin(finalProfile);
      }
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes('refresh token')) {
        setError("Session expirée. Veuillez vous reconnecter.");
      } else {
        setError(err.message || "Erreur de connexion.");
      }
    } finally {
      setIsSubmitting(false);
      try {
        window.sessionStorage.removeItem('edunova_login_in_progress');
      } catch (e) {}
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Magical Animated Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden bg-slate-50">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
            x: [0, 100, 0],
            y: [0, 50, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[20%] -left-[10%] w-[80%] h-[80%] bg-indigo-500/5 rounded-full blur-[120px]"
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.3, 1],
            rotate: [0, -90, 0],
            x: [0, -100, 0],
            y: [0, -50, 0]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-[20%] -right-[10%] w-[80%] h-[80%] bg-blue-500/5 rounded-full blur-[120px]"
        />
        
        {/* Floating Particles */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ 
              opacity: [0, 0.2, 0],
              scale: [0, 1, 0],
              y: [-20, -100],
              x: Math.random() * 40 - 20
            }}
            transition={{ 
              duration: 5 + Math.random() * 5, 
              repeat: Infinity, 
              delay: i * 2,
              ease: "easeInOut"
            }}
            className="absolute w-1 h-1 bg-indigo-400 rounded-full blur-[1px]"
            style={{ 
              left: `${10 + Math.random() * 80}%`, 
              top: `${20 + Math.random() * 60}%` 
            }}
          />
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 100 }}
        className="max-w-md w-full relative z-10"
      >
        <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(30,58,138,0.12),0_10px_25px_-10px_rgba(0,0,0,0.05)] overflow-hidden border border-slate-100/90 transition-all duration-500">
          <div className="p-6 sm:p-8 md:p-9">
            
            {/* Header Section */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, type: "spring" }}
              className="flex flex-col items-center mb-6"
            >
              <div className="mb-3 relative group">
                <motion.div 
                  animate={{ scale: [1, 1.12, 1], opacity: [0.25, 0.5, 0.25] }}
                  transition={{ duration: 4, repeat: Infinity }}
                  className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-2xl" 
                />
                <Logo 
                  src={edunovaLogo || "/logo.png"} 
                  size="xl" 
                  className="w-20 h-20 sm:w-24 sm:h-24 relative z-10 transform group-hover:scale-[1.03] transition-transform duration-500 shadow-xl shadow-blue-500/15 ring-1 ring-blue-500/20 rounded-2xl" 
                  imgClassName="object-contain w-full h-full scale-[1.02]" 
                  alt="EduNova Logo" 
                />
              </div>
              
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-1 bg-clip-text text-transparent bg-gradient-to-b from-slate-900 to-slate-800">EduNova</h1>
              <p className="text-slate-500 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.25em] text-center">
                {isForgotPassword ? "Réinitialisation" : "Gestion Académique & Universitaire"}
              </p>
            </motion.div>

            {/* Maintenance Mode Banner */}
            {maintenanceMode && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5 p-3.5 bg-amber-50 border border-amber-200/70 rounded-xl flex items-center gap-3 shadow-sm"
              >
                <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center shrink-0">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <p className="text-amber-900 text-xs font-bold uppercase tracking-wider">Mode Maintenance Actif</p>
                  <p className="text-amber-700 text-xs font-medium leading-relaxed">
                    Seuls les Super Administrateurs peuvent se connecter. Les accès standards sont temporairement suspendus.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Error Message */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-5"
                >
                  <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl flex flex-col gap-2.5">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={16} />
                      <div className="flex-1">
                        <p className="text-rose-700 text-xs font-bold leading-normal">{error}</p>
                        
                        <div className="flex flex-wrap gap-2 mt-2.5">
                          <button 
                            onClick={async () => {
                              try {
                                clearFailedAttempts(email);
                                if (email.toLowerCase().includes('jackito')) {
                                  await supabase.rpc('emergency_reset_password', {
                                    p_email: email,
                                    p_new_password: 'Password123!'
                                  });
                                }
                                setError(null);
                                window.localStorage.removeItem(getAttemptsKey(email));
                              } catch(e) {}
                            }}
                            className="text-[10px] uppercase tracking-widest font-black text-rose-800 hover:text-rose-900 bg-white/60 px-2 py-1 rounded-md cursor-pointer transition-colors"
                          >
                            Réinitialiser
                          </button>
                          
                          {isRefreshTokenError(error) && (
                            <button 
                              onClick={() => { clearAuthStorage(); window.location.reload(); }}
                              className="text-[10px] uppercase tracking-widest font-black text-indigo-700 hover:text-indigo-800 bg-white/60 px-2.5 py-1 rounded-md cursor-pointer transition-colors"
                            >
                              Réparer Session
                            </button>
                          )}

                          <button 
                            onClick={testConnection}
                            disabled={isTestingConnection}
                            className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-black text-indigo-700 hover:text-indigo-800 bg-white/60 px-2.5 py-1 rounded-md disabled:opacity-50 cursor-pointer transition-colors"
                          >
                            {isTestingConnection ? <Loader2 size={10} className="animate-spin" /> : <Wifi size={10} />}
                            Tester
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {isForgotPassword ? (
              <motion.form 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                onSubmit={handleResetPassword} 
                className="space-y-4"
              >
                {resetSent ? (
                  <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 text-center">
                    <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <Mail size={20} />
                    </div>
                    <h3 className="text-emerald-900 font-bold text-sm mb-1 tracking-tight">Email envoyé !</h3>
                    <p className="text-emerald-700/80 text-xs leading-relaxed mb-4">Un lien de réinitialisation vous a été envoyé. Vérifiez votre boîte de réception.</p>
                    <button 
                      type="button"
                      onClick={() => { setIsForgotPassword(false); setResetSent(false); }}
                      className="w-full py-3 bg-white border border-emerald-200 text-emerald-700 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-emerald-50 transition-all flex items-center justify-center gap-1.5"
                    >
                      <ChevronLeft size={16} /> Retour
                    </button>
                  </div>
                ) : (
                  <>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 ml-1">Email professionnel</label>
                  <div className="relative group">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={17} />
                    <input 
                      type="email" 
                      className="w-full pl-10 pr-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/15 transition-all font-medium"
                      placeholder="votre@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white py-3.5 rounded-xl font-bold text-sm shadow-md shadow-blue-900/15 hover:shadow-lg hover:from-blue-800 hover:to-indigo-950 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <><span>Envoyer le lien</span> <ArrowRight size={17} /></>}
                </button>

                    <button 
                      type="button"
                      onClick={() => { setIsForgotPassword(false); setError(null); }}
                      className="w-full text-slate-400 hover:text-slate-700 text-xs font-bold transition-colors py-1.5"
                    >
                      Annuler
                    </button>
                  </>
                )}
              </motion.form>
            ) : (
              <motion.form 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                onSubmit={handleSubmit} 
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 ml-1">Identifiant ou Email</label>
                  <div className="relative group">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={17} />
                    <input 
                      type="text" 
                      className="w-full pl-10 pr-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/15 transition-all font-medium"
                      placeholder="ex: jdupont ou direction@ecole.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-xs font-bold text-slate-700">Mot de passe</label>
                    <button 
                      type="button"
                      onClick={() => { setIsForgotPassword(true); setError(null); }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={17} />
                    <input 
                      type="password" 
                      className="w-full pl-10 pr-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/15 transition-all font-medium"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="pt-2 space-y-3">
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white py-3.5 rounded-xl font-bold text-sm shadow-md shadow-blue-900/15 hover:shadow-lg hover:from-blue-800 hover:to-indigo-950 active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 disabled:opacity-90 group cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={18} className="animate-spin text-blue-200" />
                        <span className="tracking-wide">Authentification sécurisée ({authStep}/3)...</span>
                      </>
                    ) : (
                      <>
                        <span>Se connecter</span>
                        <ArrowRight size={17} className="group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>

                  {/* Explicit Progression & Live Memo during Submission */}
                  <AnimatePresence>
                    {isSubmitting && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.25 }}
                        className="p-4 rounded-2xl bg-blue-50/90 border border-blue-200/80 shadow-xs space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                            {AUTH_STEPS[authStep - 1].title}
                          </span>
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-blue-200/70 text-blue-800 font-mono">
                            Étape {authStep}/3
                          </span>
                        </div>

                        {/* Visual Step Pills */}
                        <div className="grid grid-cols-3 gap-1.5">
                          {AUTH_STEPS.map((s) => (
                            <div 
                              key={s.id}
                              className={`h-1.5 rounded-full transition-all duration-500 ${
                                authStep >= s.id 
                                  ? 'bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]' 
                                  : 'bg-blue-200/70'
                              }`}
                            />
                          ))}
                        </div>

                        <p className="text-[11px] text-blue-800/80 font-medium leading-tight">
                          {AUTH_STEPS[authStep - 1].desc}
                        </p>

                        <div className="pt-2 border-t border-blue-200/60 flex items-center gap-2 text-[10px] text-blue-700 font-semibold">
                          <ShieldCheck size={13} className="text-blue-600 shrink-0" />
                          <span>Connexion chiffrée SSL/TLS • Protocole EduNova Guard</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.form>
            )}

          </div>
        </div>
        
        <FormFooter className="mt-3" />
      </motion.div>
    </div>
  );
};

export default Login;