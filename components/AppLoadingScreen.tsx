import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, 
  Lock, 
  Sparkles, 
  RefreshCw, 
  ArrowRight, 
  Server, 
  CheckCircle2, 
  Wifi, 
  WifiOff, 
  UserCheck, 
  Zap,
  Clock
} from 'lucide-react';
import Logo from './Logo';

export interface AppLoadingScreenProps {
  onSkipToLogin?: () => void;
  onContinueOffline?: () => void;
  currentStage?: 1 | 2 | 3;
  cachedUserName?: string;
  cachedUserRole?: string;
  isOffline?: boolean;
}

const MEMOS = [
  {
    icon: ShieldCheck,
    title: "Sécurité & Confidentialité Certifiées",
    text: "Vos données académiques et administratives sont chiffrées de bout en bout selon les normes de protection les plus rigoureuses."
  },
  {
    icon: Lock,
    title: "Contrôle d'Accès Multi-Niveaux",
    text: "EduNova Pro vérifie l'intégrité de vos jetons de session pour garantir la stricte confidentialité de votre établissement."
  },
  {
    icon: Sparkles,
    title: "Gestion Scolaire & Financière Intégrée",
    text: "Inscriptions, paiements, bulletins, ressources humaines et bibliothèque synchronisés en temps réel."
  },
  {
    icon: Server,
    title: "Synchronisation Haute Disponibilité",
    text: "Les modifications administratives et pédagogiques sont sauvegardées avec réplication instantanée."
  },
  {
    icon: Zap,
    title: "Architecture Optimisée & Mode Hors-ligne",
    text: "Vos consultations régulières sont accélérées par le cache intelligent pour une réactivité instantanée."
  }
];

const STEPS = [
  { id: 1, label: "Établissement du tunnel sécurisé", desc: "Chiffrement SSL/TLS et liaison réseau" },
  { id: 2, label: "Contrôle de session & accréditations", desc: "Vérification des droits et intégrité du compte" },
  { id: 3, label: "Initialisation de l'espace académique", desc: "Chargement des modules et configurations scolaires" }
];

export const AppLoadingScreen: React.FC<AppLoadingScreenProps> = ({ 
  onSkipToLogin,
  onContinueOffline,
  currentStage,
  cachedUserName,
  cachedUserRole,
  isOffline = !navigator.onLine
}) => {
  const [internalStep, setInternalStep] = useState(1);
  const [progress, setProgress] = useState(25);
  const [memoIndex, setMemoIndex] = useState(0);
  const [showRecoveryActions, setShowRecoveryActions] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const activeStep = currentStage || internalStep;

  // Animation séquentielle par défaut
  useEffect(() => {
    const stepTimer1 = setTimeout(() => {
      setInternalStep(2);
      setProgress((prev) => Math.max(prev, 65));
    }, 900);

    const stepTimer2 = setTimeout(() => {
      setInternalStep(3);
      setProgress((prev) => Math.max(prev, 92));
    }, 2000);

    const recoveryTimer = setTimeout(() => {
      setShowRecoveryActions(true);
    }, 2800);

    const memoInterval = setInterval(() => {
      setMemoIndex((prev) => (prev + 1) % MEMOS.length);
    }, 4500);

    const ticker = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(recoveryTimer);
      clearInterval(memoInterval);
      clearInterval(ticker);
    };
  }, []);

  // Synchronisation avec la progression transmise par le composant racine
  useEffect(() => {
    if (currentStage === 1) setProgress((prev) => Math.max(prev, 35));
    else if (currentStage === 2) setProgress((prev) => Math.max(prev, 70));
    else if (currentStage === 3) setProgress((prev) => Math.max(prev, 98));
  }, [currentStage]);

  const ActiveMemoIcon = MEMOS[memoIndex].icon;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans select-none">
      {/* Background ambient glowing lighting effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.25, 1],
            opacity: [0.18, 0.28, 0.18],
            x: [0, 40, 0],
            y: [0, -30, 0]
          }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[15%] -left-[10%] w-[620px] h-[620px] bg-blue-600/30 rounded-full blur-[140px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.12, 0.22, 0.12],
            x: [0, -35, 0],
            y: [0, 35, 0]
          }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-[20%] -right-[10%] w-[620px] h-[620px] bg-indigo-600/30 rounded-full blur-[140px]"
        />
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-35" />
      </div>

      <div className="max-w-md w-full relative z-10 flex flex-col items-center">
        {/* Brand Identity & Official Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="flex flex-col items-center text-center mb-7"
        >
          <div className="relative mb-3.5 group">
            <div className="absolute inset-0 bg-blue-500/35 blur-2xl rounded-3xl animate-pulse" />
            <Logo
              src="/logo.png"
              size="xl"
              className="w-20 h-20 sm:w-22 sm:h-22 relative z-10 rounded-2xl shadow-2xl ring-1 ring-white/15"
              imgClassName="object-contain w-full h-full scale-[1.02]"
              alt="EduNova Pro Logo"
            />
          </div>

          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              EduNova <span className="text-blue-400 font-medium">Pro</span>
            </h1>
          </div>
          <p className="text-slate-400 text-[11px] font-bold uppercase tracking-[0.25em]">
            Système Intégré de Gestion Académique
          </p>
        </motion.div>

        {/* Loading Progress Card with Real-time Step Indicators */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="w-full bg-slate-900/85 backdrop-blur-2xl border border-slate-800/90 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5"
        >
          {/* User Session Teaser if cached session exists */}
          {cachedUserName && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-between p-3 rounded-2xl bg-blue-950/40 border border-blue-800/40 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center justify-center shrink-0">
                  <UserCheck size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-slate-200 font-bold truncate">{cachedUserName}</p>
                  <p className="text-[10px] text-blue-400/90 font-medium uppercase tracking-wider">
                    {cachedUserRole || 'Session Enregistrée'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-400/30 shrink-0">
                Restauration
              </span>
            </motion.div>
          )}

          {/* Progress Bar & percentage */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                {activeStep === 1 
                  ? "Connexion au serveur sécurisé..." 
                  : activeStep === 2 
                  ? "Vérification des accréditations..." 
                  : "Préparation de l'espace académique..."}
              </span>
              <span className="font-mono text-blue-400 font-bold">{progress}%</span>
            </div>

            <div className="w-full h-2.5 bg-slate-800/90 rounded-full overflow-hidden p-0.5 border border-slate-700/60 shadow-inner">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 rounded-full shadow-[0_0_14px_rgba(59,130,246,0.6)]"
                initial={{ width: '15%' }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* Sequential Step Indications */}
          <div className="space-y-2 pt-1">
            {STEPS.map((step) => {
              const isDone = activeStep > step.id;
              const isCurrent = activeStep === step.id;

              return (
                <div
                  key={step.id}
                  className={`flex items-start gap-3 p-2.5 rounded-xl transition-all duration-300 ${
                    isCurrent
                      ? 'bg-blue-950/60 border border-blue-800/70 shadow-xs'
                      : isDone
                      ? 'bg-slate-800/40 border border-transparent opacity-80'
                      : 'opacity-40'
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {isDone ? (
                      <CheckCircle2 size={16} className="text-emerald-400" />
                    ) : isCurrent ? (
                      <div className="w-4 h-4 rounded-full border-2 border-transparent border-t-blue-400 border-r-indigo-400 animate-spin" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center text-[9px] text-slate-500">
                        {step.id}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-bold leading-tight ${isCurrent ? 'text-white' : isDone ? 'text-slate-300' : 'text-slate-500'}`}>
                      {step.label}
                    </p>
                    <p className="text-[11px] text-slate-400 font-normal mt-0.5 leading-snug">
                      {step.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dynamic Informative Memo Card */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span>💡 Information Système</span>
              </span>
              <span className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                {isOffline ? (
                  <span className="flex items-center gap-1 text-amber-400 font-medium">
                    <WifiOff size={11} /> Hors-ligne
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-400 font-medium">
                    <Wifi size={11} /> En ligne ({elapsedSeconds}s)
                  </span>
                )}
              </span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-3.5 min-h-[72px] flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/25 flex items-center justify-center shrink-0">
                <ActiveMemoIcon size={16} />
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={memoIndex}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25 }}
                  className="flex-1 min-w-0"
                >
                  <p className="text-xs font-bold text-slate-200">
                    {MEMOS[memoIndex].title}
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium leading-relaxed mt-0.5">
                    {MEMOS[memoIndex].text}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Quick Action Recovery Controls (shown if network latency or long start occurs) */}
          <AnimatePresence>
            {showRecoveryActions && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-2 flex flex-col sm:flex-row gap-2"
              >
                {cachedUserName && onContinueOffline && (
                  <button
                    type="button"
                    onClick={onContinueOffline}
                    className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-900/30 cursor-pointer"
                  >
                    <Zap size={14} />
                    <span>Mode Hors-ligne</span>
                  </button>
                )}

                {onSkipToLogin && (
                  <button
                    type="button"
                    onClick={onSkipToLogin}
                    className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-blue-900/30 cursor-pointer"
                  >
                    <span>Page de Connexion</span>
                    <ArrowRight size={14} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
                  title="Recharger l'application"
                >
                  <RefreshCw size={13} />
                  <span>Actualiser</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Security watermark footer */}
        <div className="mt-7 flex items-center gap-2 text-slate-500 text-[11px] font-medium">
          <ShieldCheck size={14} className="text-blue-400" />
          <span>Session Sécurisée • Protocole EduNova Guard v2.6</span>
        </div>
      </div>
    </div>
  );
};
