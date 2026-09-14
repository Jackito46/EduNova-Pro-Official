import React, { useState, useEffect, useCallback } from 'react';
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
  Clock,
  AlertTriangle
} from 'lucide-react';
import Logo from './Logo';
import { checkSupabaseConnection } from '../supabase';

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

  // Pre-flight network connectivity status
  const [netStatus, setNetStatus] = useState<'checking' | 'online' | 'offline'>(
    !navigator.onLine || isOffline ? 'offline' : 'checking'
  );
  const [netLatency, setNetLatency] = useState<number | null>(null);
  const [isCheckingNet, setIsCheckingNet] = useState(false);

  const activeStep = currentStage || internalStep;

  // Active network preflight check
  const runNetworkPreflight = useCallback(async () => {
    if (typeof window !== 'undefined' && !window.navigator.onLine) {
      setNetStatus('offline');
      setShowRecoveryActions(true);
      return;
    }

    setIsCheckingNet(true);
    setNetStatus('checking');
    const start = Date.now();
    try {
      const isReachable = await Promise.race([
        checkSupabaseConnection(),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2800))
      ]);
      const duration = Date.now() - start;

      if (isReachable) {
        setNetStatus('online');
        setNetLatency(duration);
      } else {
        setNetStatus('offline');
        setShowRecoveryActions(true);
      }
    } catch {
      setNetStatus('offline');
      setShowRecoveryActions(true);
    } finally {
      setIsCheckingNet(false);
    }
  }, []);

  useEffect(() => {
    runNetworkPreflight();
  }, [runNetworkPreflight]);

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
    }, 400);

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

  const dynamicSteps = [
    { 
      id: 1, 
      label: "Contrôle réseau & Tunnel sécurisé", 
      desc: netStatus === 'checking'
        ? "Vérification de la connectivité réseau au serveur..."
        : netStatus === 'online'
        ? `Liaison réseau active • Réponse ${netLatency !== null ? netLatency + 'ms' : 'OK'}`
        : "Connexion réseau indisponible • Mode hors-ligne"
    },
    { id: 2, label: "Contrôle de session & accréditations", desc: "Vérification des droits et intégrité du compte" },
    { id: 3, label: "Initialisation de l'espace académique", desc: "Chargement des modules et configurations scolaires" }
  ];

  const ActiveMemoIcon = MEMOS[memoIndex].icon;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans select-none">
      {/* Dynamic atmospheric mesh background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.18, 0.3, 0.18],
            x: [0, 25, 0],
            y: [0, -20, 0]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[15%] -left-[10%] w-[540px] h-[540px] bg-blue-600/25 rounded-full blur-[130px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.25, 1],
            opacity: [0.12, 0.24, 0.12],
            x: [0, -25, 0],
            y: [0, 25, 0]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-[20%] -right-[10%] w-[540px] h-[540px] bg-indigo-600/25 rounded-full blur-[130px]"
        />
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:28px_28px] opacity-25" />
      </div>

      <div className="max-w-md w-full relative z-10 flex flex-col items-center">
        {/* Brand Identity & Floating Emblem */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col items-center text-center mb-6"
        >
          <div className="relative mb-3.5 group">
            {/* Ambient Back Glow */}
            <div className="absolute -inset-2 bg-gradient-to-r from-blue-500/30 to-indigo-500/30 blur-2xl rounded-3xl animate-pulse" />
            
            {/* Subtle orbital dashed halo */}
            <div className="absolute -inset-3.5 border border-sky-400/20 border-dashed rounded-[26px] animate-[spin_24s_linear_infinite]" />

            <div className="relative z-10 w-20 h-20 sm:w-22 sm:h-22 p-2 rounded-2xl bg-gradient-to-b from-slate-800/80 to-slate-900/90 backdrop-blur-xl border border-white/15 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.8),0_0_24px_rgba(56,189,248,0.25)] flex items-center justify-center">
              <Logo
                src="/logo.png"
                size="xl"
                className="w-full h-full object-contain"
                imgClassName="object-contain w-full h-full scale-[1.02]"
                alt="EduNova Pro Logo"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              EduNova <span className="text-sky-400 font-semibold">Pro</span>
            </h1>
          </div>
          <p className="text-slate-400 text-[11px] font-bold uppercase tracking-[0.25em]">
            Système Intégré de Gestion Scolaire
          </p>
        </motion.div>

        {/* Loading Progress Card with Refined Ergonomics */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="w-full bg-slate-900/80 backdrop-blur-2xl border border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] space-y-4"
        >
          {/* User Session Teaser if cached session exists */}
          {cachedUserName && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-between p-2.5 rounded-xl bg-blue-950/40 border border-blue-800/35 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center justify-center shrink-0">
                  <UserCheck size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-slate-200 font-bold truncate text-xs">{cachedUserName}</p>
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

          {/* Progress Bar & Percentage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                </span>
                {activeStep === 1 
                  ? "Connexion au serveur sécurisé..." 
                  : activeStep === 2 
                  ? "Vérification des accréditations..." 
                  : "Préparation de l'espace académique..."}
              </span>
              <span className="font-mono text-sky-400 font-bold">{progress}%</span>
            </div>

            <div className="w-full h-2 bg-slate-800/90 rounded-full overflow-hidden p-0.5 border border-slate-700/50 shadow-inner">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-sky-400 rounded-full shadow-[0_0_12px_rgba(56,189,248,0.65)]"
                initial={{ width: '15%' }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* Sequential Step Indications - Compact & Épuré */}
          <div className="space-y-1.5 pt-1">
            {dynamicSteps.map((step) => {
              const isDone = activeStep > step.id;
              const isCurrent = activeStep === step.id;

              return (
                <div
                  key={step.id}
                  className={`flex items-start gap-2.5 p-2 rounded-xl transition-all duration-300 ${
                    isCurrent
                      ? 'bg-blue-950/50 border border-blue-800/60 shadow-xs'
                      : isDone
                      ? 'bg-slate-800/30 border border-transparent opacity-80'
                      : 'opacity-35'
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {isDone ? (
                      <CheckCircle2 size={15} className="text-emerald-400" />
                    ) : isCurrent ? (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-transparent border-t-sky-400 border-r-indigo-400 animate-spin" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-slate-600 flex items-center justify-center text-[8.5px] text-slate-500 font-bold">
                        {step.id}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold leading-tight ${isCurrent ? 'text-white' : isDone ? 'text-slate-300' : 'text-slate-500'}`}>
                      {step.label}
                    </p>
                    <p className="text-[10.5px] text-slate-400 font-normal mt-0.5 leading-snug truncate">
                      {step.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Network Offline Alert Banner if pre-flight check fails */}
          {netStatus === 'offline' && (
            <motion.div 
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl flex items-start gap-2.5 text-xs text-amber-200"
            >
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                <WifiOff size={15} />
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-amber-300 text-xs">Réseau distant inaccessible</p>
                  <span className="text-[9.5px] px-1.5 py-0.5 bg-amber-500/20 rounded font-mono text-amber-300">
                    Hors-ligne
                  </span>
                </div>
                <p className="text-[10.5px] text-amber-200/85 leading-relaxed">
                  {cachedUserName 
                    ? "Aucune liaison active. Poursuivez en mode hors-ligne avec vos données locales."
                    : "Connexion nécessaire pour la première authentification."}
                </p>
              </div>
            </motion.div>
          )}

          {/* Dynamic Informative Memo Card - Épuré */}
          <div className="pt-2 border-t border-slate-800/70">
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <span>💡 Information Système</span>
              </span>
              <span className="flex items-center gap-1 text-[9.5px] text-slate-500 font-medium">
                {netStatus === 'offline' || isOffline ? (
                  <span className="flex items-center gap-1 text-amber-400 font-medium">
                    <WifiOff size={10} /> Mode Hors-ligne
                  </span>
                ) : netStatus === 'checking' ? (
                  <span className="flex items-center gap-1 text-sky-400 font-medium">
                    <div className="w-1.5 h-1.5 rounded-full border border-sky-400 border-t-transparent animate-spin" /> Connexion...
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-400 font-medium">
                    <Wifi size={10} /> En ligne
                  </span>
                )}
              </span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/70 rounded-xl p-3 min-h-[64px] flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
                <ActiveMemoIcon size={14} />
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={memoIndex}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 min-w-0"
                >
                  <p className="text-[11.5px] font-bold text-slate-200">
                    {MEMOS[memoIndex].title}
                  </p>
                  <p className="text-[10.5px] text-slate-400 font-normal leading-relaxed mt-0.5 line-clamp-2">
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
                className="pt-1.5 flex flex-col sm:flex-row gap-2"
              >
                {cachedUserName && onContinueOffline && (
                  <button
                    type="button"
                    onClick={onContinueOffline}
                    className="flex-1 py-2 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-900/30 cursor-pointer"
                  >
                    <Zap size={13} />
                    <span>Mode Hors-ligne</span>
                  </button>
                )}

                {onSkipToLogin && (
                  <button
                    type="button"
                    onClick={onSkipToLogin}
                    className="flex-1 py-2 px-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-blue-900/30 cursor-pointer"
                  >
                    <span>Page de Connexion</span>
                    <ArrowRight size={13} />
                  </button>
                )}

                {netStatus === 'offline' && (
                  <button
                    type="button"
                    onClick={runNetworkPreflight}
                    disabled={isCheckingNet}
                    className="py-2 px-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-900/30"
                    title="Vérifier la connectivité réseau"
                  >
                    <RefreshCw size={12} className={isCheckingNet ? "animate-spin" : ""} />
                    <span>{isCheckingNet ? "Test..." : "Tester"}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="py-2 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
                  title="Recharger l'application"
                >
                  <RefreshCw size={12} />
                  <span>Actualiser</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Security watermark footer */}
        <div className="mt-5 flex items-center gap-1.5 text-slate-500 text-[10.5px] font-medium">
          <ShieldCheck size={13} className="text-sky-400" />
          <span>EduNova Pro • Système Intégré de Gestion Scolaire</span>
        </div>
      </div>
    </div>
  );
};
