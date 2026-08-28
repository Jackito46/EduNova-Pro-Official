import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Lock, Sparkles, RefreshCw, ArrowRight, Server, CheckCircle2 } from 'lucide-react';
import Logo from './Logo';
import edunovaLogo from '../src/assets/images/edunova_logo2_exact_authentic_colors_1786352038404.jpg';

interface AppLoadingScreenProps {
  onSkipToLogin?: () => void;
}

const MEMOS = [
  {
    icon: ShieldCheck,
    title: "Sécurité & Confidentialité",
    text: "Vos données académiques et administratives sont protégées par un chiffrement SSL/TLS de bout en bout."
  },
  {
    icon: Lock,
    title: "Contrôle d'Accès Strict",
    text: "EduNova Pro vérifie l'authenticité de vos accréditations pour prévenir toute tentative d'intrusion."
  },
  {
    icon: Sparkles,
    title: "Gestion Intégrée",
    text: "Scolarité, finances, notes et ressources humaines centralisées dans un environnement haute performance."
  },
  {
    icon: Server,
    title: "Synchronisation Temps Réel",
    text: "Les modifications administratives sont répercutées instantanément sur l'ensemble de votre établissement."
  }
];

const STEPS = [
  { id: 1, label: "Connexion au serveur sécurisé", desc: "Établissement du tunnel de données chiffré" },
  { id: 2, label: "Vérification des accréditations", desc: "Contrôle d'intégrité de la session et des droits" },
  { id: 3, label: "Initialisation de l'espace de travail", desc: "Chargement des paramètres et modules académiques" }
];

export const AppLoadingScreen: React.FC<AppLoadingScreenProps> = ({ onSkipToLogin }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [progress, setProgress] = useState(25);
  const [memoIndex, setMemoIndex] = useState(0);
  const [showSkipButton, setShowSkipButton] = useState(false);

  useEffect(() => {
    const stepTimer1 = setTimeout(() => {
      setCurrentStep(2);
      setProgress(65);
    }, 1200);

    const stepTimer2 = setTimeout(() => {
      setCurrentStep(3);
      setProgress(90);
    }, 2500);

    const skipTimer = setTimeout(() => {
      setShowSkipButton(true);
    }, 3500);

    const memoInterval = setInterval(() => {
      setMemoIndex((prev) => (prev + 1) % MEMOS.length);
    }, 4000);

    return () => {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(skipTimer);
      clearInterval(memoInterval);
    };
  }, []);

  const ActiveMemoIcon = MEMOS[memoIndex].icon;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans select-none">
      {/* Background ambient glowing orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.15, 0.25, 0.15],
            x: [0, 50, 0],
            y: [0, -30, 0]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[15%] -left-[10%] w-[600px] h-[600px] bg-blue-600/30 rounded-full blur-[140px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.1, 0.2, 0.1],
            x: [0, -40, 0],
            y: [0, 40, 0]
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-[20%] -right-[10%] w-[600px] h-[600px] bg-indigo-600/30 rounded-full blur-[140px]"
        />
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-30" />
      </div>

      <div className="max-w-md w-full relative z-10 flex flex-col items-center">
        {/* Brand Identity & Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col items-center text-center mb-8"
        >
          <div className="relative mb-4 group">
            <div className="absolute inset-0 bg-blue-500/30 blur-2xl rounded-2xl animate-pulse" />
            <Logo
              src={edunovaLogo || "/logo.png"}
              size="xl"
              className="w-20 h-20 sm:w-24 sm:h-24 relative z-10 rounded-2xl shadow-2xl ring-1 ring-white/10"
              imgClassName="object-contain w-full h-full scale-[1.02]"
              alt="EduNova Logo"
            />
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-1">
            EduNova <span className="text-blue-400 font-medium">Pro</span>
          </h1>
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-[0.25em]">
            Système Intégré de Gestion Académique
          </p>
        </motion.div>

        {/* Loading Progress Card with Step Indicators */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6"
        >
          {/* Progress Bar & percentage */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                Chargement de votre session...
              </span>
              <span className="font-mono text-blue-400 font-bold">{progress}%</span>
            </div>

            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 rounded-full shadow-[0_0_12px_rgba(59,130,246,0.5)]"
                initial={{ width: '10%' }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* Sequential Step Indications */}
          <div className="space-y-2.5 pt-1">
            {STEPS.map((step) => {
              const isDone = currentStep > step.id;
              const isCurrent = currentStep === step.id;

              return (
                <div
                  key={step.id}
                  className={`flex items-start gap-3 p-2.5 rounded-xl transition-all duration-300 ${
                    isCurrent
                      ? 'bg-blue-950/50 border border-blue-800/60 shadow-xs'
                      : isDone
                      ? 'bg-slate-800/30 border border-transparent opacity-75'
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
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <span>💡 Mémo & Indications</span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 min-h-[72px] flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
                <ActiveMemoIcon size={16} />
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={memoIndex}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.3 }}
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

          {/* Quick Action Buttons (shown if network latency occurs) */}
          <AnimatePresence>
            {showSkipButton && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-2 flex flex-col sm:flex-row gap-2"
              >
                {onSkipToLogin && (
                  <button
                    type="button"
                    onClick={onSkipToLogin}
                    className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 cursor-pointer"
                  >
                    <span>Formulaire de connexion</span>
                    <ArrowRight size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
                >
                  <RefreshCw size={13} />
                  <span>Actualiser</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Security watermark footer */}
        <div className="mt-8 flex items-center gap-2 text-slate-500 text-[11px] font-medium">
          <ShieldCheck size={14} className="text-blue-400" />
          <span>Connexion sécurisée par protocole EduNova Guard v2.6</span>
        </div>
      </div>
    </div>
  );
};
