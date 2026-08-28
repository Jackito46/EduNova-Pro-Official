import React, { useState, useEffect } from 'react';
import { 
  Download, 
  X, 
  Share, 
  PlusSquare, 
  Smartphone, 
  Monitor, 
  CheckCircle2, 
  Sparkles, 
  WifiOff, 
  Zap, 
  Bell, 
  Laptop, 
  Apple, 
  Globe, 
  Copy, 
  Check, 
  ExternalLink,
  Info,
  ShieldCheck,
  ChevronRight,
  Tablet
} from 'lucide-react';
import { usePwaInstall, PwaPlatform } from '../hooks/usePwaInstall';
import Logo from './Logo';

export const PwaInstallModal: React.FC = () => {
  const { 
    isInstalled, 
    canPromptDirectly, 
    platform, 
    platformName, 
    browserName, 
    isMobile, 
    isIOS, 
    isAndroid, 
    isMac, 
    isWindows, 
    isChromebook,
    isLinux,
    isInIframe,
    openStandaloneTab,
    installPwa,
    closeInstallModal
  } = usePwaInstall();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<'ios' | 'android' | 'windows' | 'mac' | 'linux'>('windows');
  const [copied, setCopied] = useState(false);

  // Determine the default device tab based on detected platform
  useEffect(() => {
    if (isIOS) {
      setSelectedDevice('ios');
    } else if (isAndroid) {
      setSelectedDevice('android');
    } else if (isMac) {
      setSelectedDevice('mac');
    } else if (isChromebook || isLinux) {
      setSelectedDevice('linux');
    } else {
      setSelectedDevice('windows');
    }
  }, [isIOS, isAndroid, isMac, isChromebook, isLinux, isWindows]);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    const handleClose = () => setIsOpen(false);

    window.addEventListener('open-pwa-install-modal', handleOpen);
    window.addEventListener('close-pwa-install-modal', handleClose);

    return () => {
      window.removeEventListener('open-pwa-install-modal', handleOpen);
      window.removeEventListener('close-pwa-install-modal', handleClose);
    };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    closeInstallModal();
    try {
      localStorage.setItem('edunova_pwa_dismissed_time', Date.now().toString());
    } catch (e) {}
  };

  const handleCopyLink = () => {
    try {
      const url = window.location.origin || window.location.href;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleInstallClick = async () => {
    if (canPromptDirectly) {
      await installPwa();
      handleClose();
    } else {
      handleClose();
    }
  };

  if (!isOpen) return null;

  const getDetectedKey = (): 'ios' | 'android' | 'windows' | 'mac' | 'linux' => {
    if (isIOS) return 'ios';
    if (isAndroid) return 'android';
    if (isMac) return 'mac';
    if (isChromebook || isLinux) return 'linux';
    return 'windows';
  };

  const detectedKey = getDetectedKey();

  return (
    <div 
      className="fixed inset-0 z-[99999] bg-slate-950/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-modal-title"
    >
      <div 
        className="bg-white dark:bg-slate-900 w-full sm:max-w-2xl max-h-[92vh] flex flex-col rounded-t-[28px] sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in slide-in-from-bottom-6 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between relative bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 p-0.5 shadow-md shadow-blue-500/20 shrink-0 flex items-center justify-center overflow-hidden">
              <Logo size="sm" className="w-full h-full rounded-[14px]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="pwa-modal-title" className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Installer EduNova Pro
                </h2>
                {isInstalled ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200">
                    <CheckCircle2 size={12} /> Installé
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200">
                    <Sparkles size={12} /> Mode Application
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 font-medium flex-wrap">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Votre matériel : <strong className="text-slate-800 dark:text-slate-200">{platformName}</strong> ({browserName})</span>
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer shrink-0 ml-2"
            aria-label="Fermer la fenêtre d'installation"
          >
            <X size={20} />
          </button>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          
          {/* Iframe Notice & 1-Click Open */}
          {isInIframe && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-xs">
                <Info size={16} className="text-amber-600 shrink-0" />
                <span>Mode Aperçu détecté (Cadre intégré)</span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
                Les navigateurs sécurisés (Google Chrome, Edge) bloquent l'installation native PWA à l'intérieur d'un cadre intégré. Pour installer l'application directement sur votre Bureau ou Barre des tâches :
              </p>
              <button
                type="button"
                onClick={openStandaloneTab}
                className="w-full py-2.5 px-3.5 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <ExternalLink size={14} className="stroke-[2.5]" />
                Ouvrir dans un nouvel onglet pour installer
              </button>
            </div>
          )}

          {/* Direct 1-Click Install Banner (Chrome/Edge with native support) */}
          {!isInstalled && canPromptDirectly && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white shadow-lg shadow-blue-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-amber-300" />
                  <span className="font-bold text-sm">Installation Instantanée (1 Clic)</span>
                </div>
                <span className="text-[11px] bg-white/20 px-2.5 py-0.5 rounded-full font-bold">Recommandé</span>
              </div>
              <p className="text-xs text-blue-100 font-medium">
                Votre navigateur supporte l'installation directe d'un simple clic pour profiter d'EduNova Pro en mode natif.
              </p>
              <button
                type="button"
                onClick={handleInstallClick}
                className="w-full py-3 px-4 bg-white text-blue-700 hover:bg-blue-50 active:scale-98 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download size={16} className="stroke-[2.5]" />
                Installer EduNova Pro Maintenant
              </button>
            </div>
          )}

          {/* Already installed banner */}
          {isInstalled && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 flex items-start gap-3">
              <CheckCircle2 size={22} className="text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-sm text-emerald-800 dark:text-emerald-300">
                  EduNova Pro est déjà installée sur cet appareil !
                </p>
                <p className="text-emerald-700/90 dark:text-emerald-400 font-medium">
                  Vous bénéficiez du fonctionnement 100% autonome, des performances maximales et de la persistance des données hors-ligne.
                </p>
              </div>
            </div>
          )}

          {/* HARDWARE / DEVICE SELECTOR TABS */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Laptop size={14} className="text-blue-600" />
                Guides d'installation par matériel
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Sélectionnez un appareil ci-dessous
              </span>
            </div>

            {/* Responsive grid for 5 hardware families */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
              
              {/* iOS (iPhone / iPad) */}
              <button
                type="button"
                onClick={() => setSelectedDevice('ios')}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 relative cursor-pointer ${
                  selectedDevice === 'ios'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-600'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50'
                }`}
              >
                {detectedKey === 'ios' && (
                  <span className="absolute -top-1.5 bg-emerald-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black shadow-2xs">
                    Votre appareil
                  </span>
                )}
                <Apple size={16} />
                <span className="truncate">iPhone / iPad</span>
              </button>

              {/* Android */}
              <button
                type="button"
                onClick={() => setSelectedDevice('android')}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 relative cursor-pointer ${
                  selectedDevice === 'android'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-600'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50'
                }`}
              >
                {detectedKey === 'android' && (
                  <span className="absolute -top-1.5 bg-emerald-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black shadow-2xs">
                    Votre appareil
                  </span>
                )}
                <Smartphone size={16} />
                <span className="truncate">Android</span>
              </button>

              {/* Windows PC */}
              <button
                type="button"
                onClick={() => setSelectedDevice('windows')}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 relative cursor-pointer ${
                  selectedDevice === 'windows'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-600'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50'
                }`}
              >
                {detectedKey === 'windows' && (
                  <span className="absolute -top-1.5 bg-emerald-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black shadow-2xs">
                    Votre appareil
                  </span>
                )}
                <Monitor size={16} />
                <span className="truncate">PC Windows</span>
              </button>

              {/* Mac */}
              <button
                type="button"
                onClick={() => setSelectedDevice('mac')}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 relative cursor-pointer ${
                  selectedDevice === 'mac'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-600'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50'
                }`}
              >
                {detectedKey === 'mac' && (
                  <span className="absolute -top-1.5 bg-emerald-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black shadow-2xs">
                    Votre appareil
                  </span>
                )}
                <Laptop size={16} />
                <span className="truncate">Mac (macOS)</span>
              </button>

              {/* Chromebook & Linux */}
              <button
                type="button"
                onClick={() => setSelectedDevice('linux')}
                className={`col-span-2 sm:col-span-1 py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 relative cursor-pointer ${
                  selectedDevice === 'linux'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-600'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50'
                }`}
              >
                {detectedKey === 'linux' && (
                  <span className="absolute -top-1.5 bg-emerald-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black shadow-2xs">
                    Votre appareil
                  </span>
                )}
                <Globe size={16} />
                <span className="truncate">Linux / ChromeOS</span>
              </button>
            </div>
          </div>

          {/* INSTRUCTIONS CONTENT CARD BASED ON SELECTED HARDWARE */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-700/60 space-y-4">
            
            {/* 1. iOS (iPhone & iPad) */}
            {selectedDevice === 'ios' && (
              <div className="space-y-3.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 dark:border-slate-700">
                  <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Apple size={17} className="text-slate-900 dark:text-white" />
                    Installation sur iPhone &amp; iPad (Apple iOS / iPadOS)
                  </div>
                  <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                    Navigateur Safari
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-start gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-700 shadow-2xs">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center shrink-0 text-xs mt-0.5">
                      1
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        Ouvrez Safari et touchez le bouton <strong className="text-blue-600">Partager</strong>
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                        L'icône <Share size={13} className="text-blue-500 inline mx-1 align-text-bottom" /> se trouve en bas au centre de votre écran (iPhone) ou en haut à droite (iPad).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-700 shadow-2xs">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center shrink-0 text-xs mt-0.5">
                      2
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        Faites défiler et sélectionnez <strong className="text-indigo-600 dark:text-indigo-400">« Sur l'écran d'accueil »</strong>
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                        Repéré par le carré avec un plus <PlusSquare size={13} className="text-slate-700 dark:text-slate-300 inline mx-1 align-text-bottom" /> « Sur l'écran d'accueil ».
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-700 shadow-2xs">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center shrink-0 text-xs mt-0.5">
                      3
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        Touchez <strong className="text-emerald-600 dark:text-emerald-400">« Ajouter »</strong> en haut à droite
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                        L'icône EduNova Pro s'installe sur votre écran d'accueil comme une véritable application native (sans barres d'adresse).
                      </p>
                    </div>
                  </div>
                </div>

                {/* In-app browser warning for iOS */}
                <div className="p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Astuce si ouvert depuis WhatsApp ou Messenger :</strong> Touchez l'icône de partage ou la boussole pour choisir <strong>« Ouvrir dans Safari »</strong> afin d'activer l'installation sur l'écran d'accueil.
                  </div>
                </div>
              </div>
            )}

            {/* 2. Android (Smartphones & Tablettes) */}
            {selectedDevice === 'android' && (
              <div className="space-y-3.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 dark:border-slate-700">
                  <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Smartphone size={17} className="text-emerald-600" />
                    Installation sur Android (Chrome, Samsung Internet, Edge, Opera)
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                    Mobile &amp; Tablette
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-start gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-700 shadow-2xs">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 font-bold flex items-center justify-center shrink-0 text-xs mt-0.5">
                      1
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        Ouvrez le menu du navigateur <strong className="text-emerald-600">(trois points ⋮)</strong>
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                        Sur Google Chrome / Edge : en haut à droite. Sur Samsung Internet : menu en bas à droite <strong>(☰)</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-700 shadow-2xs">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 font-bold flex items-center justify-center shrink-0 text-xs mt-0.5">
                      2
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        Appuyez sur <strong className="text-indigo-600 dark:text-indigo-400">« Installer l'application »</strong> ou <strong className="text-indigo-600 dark:text-indigo-400">« Ajouter à l'écran d'accueil »</strong>
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                        Une boîte de dialogue officielle Android s'affiche avec le nom et le logo d'EduNova Pro.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-700 shadow-2xs">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 font-bold flex items-center justify-center shrink-0 text-xs mt-0.5">
                      3
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        Confirmez l'installation
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                        L'application est ajoutée à votre tiroir d'applications et votre écran d'accueil avec support hors-ligne immédiat.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. PC Windows */}
            {selectedDevice === 'windows' && (
              <div className="space-y-3.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 dark:border-slate-700">
                  <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Monitor size={17} className="text-blue-600" />
                    Installation sur Ordinateur Windows (10 / 11)
                  </div>
                  <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                    Chrome &amp; Edge
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-start gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-700 shadow-2xs">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center shrink-0 text-xs mt-0.5">
                      1
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        Via le menu Chrome : <strong className="text-blue-600">Menu ⋮ ➔ « Cast, save, and share » ➔ « Installer EduNova... »</strong>
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                        Sur la version actuelle de Google Chrome, cliquez sur les 3 points <strong>⋮</strong> en haut à droite, survolez <strong>« Cast, save, and share »</strong> (ou <em>« Enregistrer et partager »</em>), puis cliquez sur <strong>« Installer EduNova Pro... »</strong> (ou <em>« Créer un raccourci »</em> en cochant <em>« Ouvrir dans une fenêtre »</em>).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-700 shadow-2xs">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center shrink-0 text-xs mt-0.5">
                      2
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        Sur Microsoft Edge : <strong className="text-blue-600">Menu ... ➔ « Applications » ➔ « Installer EduNova »</strong>
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                        Sur Edge, ouvrez le menu <strong>...</strong> puis allez dans <strong>« Applications »</strong> et validez <strong>« Installer ce site en tant qu'application »</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-700 shadow-2xs">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center shrink-0 text-xs mt-0.5">
                      3
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        Confirmez et profitez de l'application dédiée
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                        L'icône EduNova Pro sera automatiquement épinglée à votre Barre des tâches et sur votre Bureau Windows avec une fenêtre autonome ultra-rapide.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Mac (macOS) */}
            {selectedDevice === 'mac' && (
              <div className="space-y-3.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 dark:border-slate-700">
                  <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Apple size={17} className="text-slate-900 dark:text-white" />
                    Installation sur Mac (macOS Safari, Chrome &amp; Edge)
                  </div>
                  <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                    Dock &amp; Launchpad
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-start gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-700 shadow-2xs">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 font-bold flex items-center justify-center shrink-0 text-xs mt-0.5">
                      1
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        Sur Safari macOS : Menu <strong className="text-indigo-600">Fichier ➔ « Ajouter au Dock... »</strong>
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                        Sur macOS Sonoma (14+) et supérieur, Safari transforme instantanément EduNova Pro en application autonome Mac.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-700 shadow-2xs">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 font-bold flex items-center justify-center shrink-0 text-xs mt-0.5">
                      2
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        Sur Chrome / Edge Mac : Icône <strong className="text-blue-600">Installer ⊕</strong> dans la barre d'adresse
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                        Ou cliquez sur <strong>Menu ⋮ ➔ « Installer EduNova Pro... »</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-700 shadow-2xs">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 font-bold flex items-center justify-center shrink-0 text-xs mt-0.5">
                      3
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        Accès rapide depuis le Dock et Spotlight
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                        L'application se lance en plein écran avec gestion des fenêtres macOS et notifications du Centre de contrôle.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 5. Chromebook & Linux */}
            {selectedDevice === 'linux' && (
              <div className="space-y-3.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 dark:border-slate-700">
                  <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Globe size={17} className="text-slate-700 dark:text-slate-300" />
                    Installation sur Chromebook (ChromeOS) &amp; Linux
                  </div>
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                    Étagère &amp; Lanceur
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-start gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-700 shadow-2xs">
                    <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-white font-bold flex items-center justify-center shrink-0 text-xs mt-0.5">
                      1
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        Sur Chromebook : Cliquez sur <strong className="text-blue-600">Installer ⊕</strong> dans l'Omnibox
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                        L'icône d'installation apparaît directement dans la barre d'adresse de ChromeOS.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-700 shadow-2xs">
                    <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-white font-bold flex items-center justify-center shrink-0 text-xs mt-0.5">
                      2
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        Sur Linux (Ubuntu, Debian, Fedora, Mint)
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                        Sur Chrome / Chromium / Brave / Edge sous Linux : <strong>Menu ⋮ ➔ « Installer EduNova Pro... »</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-700 shadow-2xs">
                    <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-white font-bold flex items-center justify-center shrink-0 text-xs mt-0.5">
                      3
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        Intégration au lanceur d'applications Linux / Étagère ChromeOS
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                        L'application dispose d'un lanceur `.desktop` standard et s'ouvre dans sa fenêtre dédiée fluide.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* COPY LINK TOOLBAR (VERY USEFUL WHEN OPENING ON OTHER DEVICES OR BROWSER) */}
          <div className="p-3.5 bg-slate-100/90 dark:bg-slate-800/80 rounded-2xl flex items-center justify-between gap-3 border border-slate-200/70 dark:border-slate-700">
            <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 min-w-0">
              <Globe size={16} className="text-blue-600 shrink-0" />
              <div className="truncate">
                <span className="font-bold block text-[11px] text-slate-900 dark:text-white">Adresse de l'application :</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate block">
                  {typeof window !== 'undefined' ? window.location.origin : 'https://edunova.app'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyLink}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs ${
                copied 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white hover:bg-slate-50 border border-slate-200 dark:border-slate-600'
              }`}
            >
              {copied ? (
                <>
                  <Check size={13} className="stroke-[3]" />
                  <span>Copié !</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copier le lien</span>
                </>
              )}
            </button>
          </div>

          {/* 4 KEY BENEFITS CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800 text-center space-y-1">
              <Zap size={18} className="text-amber-500 mx-auto" />
              <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Ultra-Rapide</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Lancement direct</div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800 text-center space-y-1">
              <WifiOff size={18} className="text-blue-500 mx-auto" />
              <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">100% Hors-Ligne</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Accès garanti</div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800 text-center space-y-1">
              <Bell size={18} className="text-emerald-500 mx-auto" />
              <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Notifications</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Alertes directes</div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800 text-center space-y-1">
              <Monitor size={18} className="text-indigo-500 mx-auto" />
              <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Plein Écran</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Sans onglets</div>
            </div>
          </div>
        </div>

        {/* MODAL FOOTER - ALWAYS FULLY VISIBLE */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/90 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Fermer
          </button>

          <div className="flex items-center gap-2">
            {!isInstalled && canPromptDirectly ? (
              <button
                type="button"
                onClick={handleInstallClick}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer active:scale-98"
              >
                <Download size={15} />
                Lancer l'installation
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer active:scale-98"
              >
                <Check size={15} className="stroke-[3]" />
                J'ai compris
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
