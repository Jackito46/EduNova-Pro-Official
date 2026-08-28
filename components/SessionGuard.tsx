import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { UserProfile, UserRole } from '../types';
import { Loader2, CalendarPlus, AlertTriangle, ChevronRight, ShieldAlert, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from './Logo';

interface SessionGuardProps {
  user: UserProfile;
  children: React.ReactNode;
}

export const SessionGuard: React.FC<SessionGuardProps> = ({ user, children }) => {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newSessionLabel, setNewSessionLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user.role === UserRole.SUPER_ADMIN) {
      setHasSession(true);
      setLoading(false);
      return;
    }

    const checkSession = async () => {
      try {
        const queryPromise = supabase
          .from('academic_years')
          .select('id')
          .eq('school_id', user.school_id)
          .limit(1);
        
        let timeoutId: NodeJS.Timeout;
        const timeoutPromise = new Promise<any>((_, reject) => 
          timeoutId = setTimeout(() => reject(new Error("Timeout")), 45000)
        );

        const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
        clearTimeout(timeoutId!);

        if (error) throw error;
        setHasSession(data && data.length > 0);
      } catch (err) {
        setHasSession(true); 
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, [user]);

  const handleCreateInitialSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionLabel.trim()) return;

    const sessionRegex = /^\d{4}-\d{4}$/;
    if (!sessionRegex.test(newSessionLabel.trim())) {
      setError("Format invalide. Utilisez YYYY-YYYY");
      return;
    }

    const parts = newSessionLabel.trim().split('-');
    const startYear = parseInt(parts[0]);
    const endYear = parseInt(parts[1]);
    
    if (endYear !== startYear + 1) {
      setError("L'année de fin doit suivre l'année de début");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('academic_years')
        .insert([{
          school_id: user.school_id,
          label: newSessionLabel,
          is_active: true,
          status: 'ACTIVE'
        }]);

      if (error) throw error;
      window.location.reload();
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'envoi.");
      setIsCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          animate={{ scale: [0.95, 1.05, 0.95], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="mb-8"
        >
          <Logo src="/logo.png" size="xl" className="grayscale opacity-50" />
        </motion.div>
        <Loader2 size={32} className="animate-spin text-indigo-600 mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Initialisation du système...</p>
      </div>
    );
  }

  if (hasSession === false) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden font-sans">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-[10%] -left-[5%] w-[60%] h-[60%] bg-indigo-500/5 rounded-full blur-[100px]" />
          <div className="absolute -bottom-[10%] -right-[5%] w-[60%] h-[60%] bg-blue-500/5 rounded-full blur-[100px]" />
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full relative z-10"
        >
          <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-indigo-100/30 overflow-hidden border border-white">
            <div className="p-8 md:p-12">
              <div className="flex justify-center mb-10">
                <Logo src="/logo.png" size="lg" />
              </div>

              {user.role !== UserRole.SCHOOL_ADMIN && user.role !== UserRole.DIRECTOR ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <ShieldAlert size={32} />
                  </div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tighter mb-4">Configuration Requise</h1>
                  <p className="text-slate-500 text-sm leading-relaxed mb-10">
                    L'administrateur doit initialiser une année académique avant que vous ne puissiez accéder à l'application.
                  </p>
                  <button 
                    onClick={() => supabase.auth.signOut()}
                    className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2 group"
                  >
                    <LogOut size={18} className="group-hover:translate-x-1 transition-transform" /> Se déconnecter
                  </button>
                </div>
              ) : (
                <>
                  <div className="text-center mb-10">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tighter mb-2">Bienvenue sur EduNova</h1>
                    <p className="text-slate-500 text-sm leading-relaxed">
                      Initialisez votre première année académique pour commencer votre gestion.
                    </p>
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8 p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center"
                      >
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form onSubmit={handleCreateInitialSession} className="space-y-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Session Académique</label>
                      <div className="relative group">
                        <CalendarPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                        <input
                          type="text"
                          required
                          placeholder="Ex: 2024-2025"
                          value={newSessionLabel}
                          onChange={(e) => setNewSessionLabel(e.target.value)}
                          className="w-full pl-12 pr-5 py-5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-slate-900 font-bold transition-all placeholder:text-slate-300 shadow-inner shadow-slate-100"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isCreating || !newSessionLabel.trim()}
                      className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 hover:shadow-2xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                    >
                      {isCreating ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <>Démarrer <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>
            
            <div className="px-10 py-6 bg-slate-50/50 border-t border-white text-center">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] m-0">Initialisation de l'espace de travail</p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
};
