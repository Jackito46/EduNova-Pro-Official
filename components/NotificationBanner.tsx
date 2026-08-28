import React, { useState, useEffect } from 'react';
import { subscribeToPush } from '../utils/pushHelper';
import { Bell, X, AlertTriangle, Download, Smartphone, Sparkles, CheckCircle2, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { usePwaInstall, isRunningInIframe } from '../hooks/usePwaInstall';

interface NotificationBannerProps {
  userId: string;
  schoolId: string;
  showPwaInstall?: boolean;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({ 
  userId, 
  schoolId,
  showPwaInstall = true 
}) => {
  const [show, setShow] = useState(false);
  const [denied, setDenied] = useState(false);
  const [notSupported, setNotSupported] = useState(false);
  const [hasCapturedPrompt, setHasCapturedPrompt] = useState<boolean>(() => {
    return typeof window !== 'undefined' && !!(window as any).__edunova_deferred_prompt;
  });
  const [pwaDismissed, setPwaDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem('edunova_pwa_banner_dismissed') === 'true';
  });

  const { isInstalled, installPwa, platformName, canPromptDirectly, isInIframe } = usePwaInstall();

  // Debug & Log window.__edunova_deferred_prompt state
  useEffect(() => {
    const logPromptState = (eventSource: string) => {
      const promptObj = (window as any).__edunova_deferred_prompt;
      const inIframe = isRunningInIframe();
      console.log(
        `%c[PWA Debug - ${eventSource}]%c window.__edunova_deferred_prompt =`,
        'background: #2563eb; color: #fff; font-weight: bold; padding: 2px 6px; border-radius: 4px;',
        'font-weight: bold;',
        promptObj
      );
      console.table({
        'Deferred Prompt Exists': !!promptObj,
        'Is In Iframe': inIframe,
        'Display Mode Standalone': window.matchMedia('(display-mode: standalone)').matches,
        'Platform': platformName,
        'User Agent': navigator.userAgent
      });

      if (inIframe) {
        console.warn('[PWA Debug] Note: Chromium/Safari bloquent systématiquement le déclenchement de "beforeinstallprompt" dans les balises <iframe> pour des raisons de sécurité.');
      }
    };

    // Initial check
    logPromptState('Initial Mount');

    const handlePromptCaptured = () => {
      setHasCapturedPrompt(true);
      logPromptState('pwa-prompt-captured event');
      toast.success("🎉 Événement 'beforeinstallprompt' capturé ! L'installation native 1-clic est prête.", {
        id: 'pwa-captured-toast',
        duration: 5000
      });
    };

    const handleBeforeInstall = (e: Event) => {
      setHasCapturedPrompt(true);
      logPromptState('Native beforeinstallprompt event');
    };

    const handleAppInstalled = () => {
      setHasCapturedPrompt(false);
      logPromptState('appinstalled event');
      toast.success("✅ Application EduNova Pro installée avec succès !");
    };

    window.addEventListener('pwa-prompt-captured', handlePromptCaptured);
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('pwa-prompt-captured', handlePromptCaptured);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [platformName]);

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setNotSupported(true);
      return;
    }

    if (Notification.permission === 'granted') {
      subscribeToPush(userId, schoolId).catch(console.error);
      return;
    }

    if (Notification.permission === 'denied') {
      const dismissedDenied = window.sessionStorage.getItem('push_denied_dismissed');
      if (!dismissedDenied) {
        setDenied(true);
      }
      return;
    }

    if (Notification.permission === 'default') {
      const dismissed = window.sessionStorage.getItem('push_banner_dismissed');
      if (!dismissed) {
        setShow(true);
      }
    }
  }, [userId, schoolId]);

  const handleSubscribe = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const result = await subscribeToPush(userId, schoolId);
        if (result.success) {
          toast.success('Notifications activées avec succès !');
          setShow(false);
          setDenied(false);
        } else {
          toast.error(`Erreur d'abonnement: ${result.error}`);
        }
      } else {
        toast.error('Permission refusée. Vérifiez les paramètres de votre navigateur.');
        setDenied(true);
        setShow(false);
      }
    } catch (e: any) {
      toast.error(`Erreur: ${e.message}`);
    }
  };

  const handleDismiss = () => {
    window.sessionStorage.setItem('push_banner_dismissed', 'true');
    setShow(false);
  };

  const handleDismissPwa = () => {
    setPwaDismissed(true);
    try {
      window.sessionStorage.setItem('edunova_pwa_banner_dismissed', 'true');
    } catch (e) {}
  };

  const handleManualPromptTest = async () => {
    const promptEvent = (window as any).__edunova_deferred_prompt;
    console.log('[PWA Debug - Manual Click] State before trigger:', {
      promptEvent,
      type: typeof promptEvent,
      isInIframe: isRunningInIframe()
    });

    try {
      if (!promptEvent) {
        console.warn("[PWA Info] Pas de prompt natif direct capturé par le navigateur. Ouverture du guide interactif...");
        installPwa();
        return;
      }

      toast.loading("Ouverture de l'invite d'installation...", { id: 'pwa-test-prompt' });
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      toast.dismiss('pwa-test-prompt');
      console.log('[PWA Info] Choix utilisateur:', choice);

      if (choice?.outcome === 'accepted') {
        toast.success("✅ Application EduNova Pro installée avec succès !");
        (window as any).__edunova_deferred_prompt = null;
        setHasCapturedPrompt(false);
        setPwaDismissed(true);
      } else {
        toast.info("Installation différée.");
      }
    } catch (err: any) {
      console.error('[PWA Error] Erreur lors du prompt():', err);
      toast.dismiss('pwa-test-prompt');
      installPwa();
    }
  };

  useEffect(() => {
    // Listen for service worker messages
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'PUSH_RECEIVED') {
        const payload = event.data.payload;
        if (payload?.title) {
          toast.info(
            <div>
              <p className="font-bold">{payload.title}</p>
              {payload.options?.body && <p className="text-sm">{payload.options.body}</p>}
            </div>,
            { duration: 8000 }
          );
        }
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
      navigator.serviceWorker.ready.then(reg => {
        if (reg.active) {
          reg.active.postMessage({ type: 'CLAIM_CLIENTS' });
        }
      });
    }
    
    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      }
    };
  }, []);

  return (
    <>
      {/* Dynamic PWA installation warning & action banner if app is not installed on device */}
      {showPwaInstall && !isInstalled && !pwaDismissed && (
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white p-3.5 sm:p-4 rounded-2xl shadow-lg mb-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-3 relative z-40 border border-blue-400/30">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="p-2.5 bg-white/15 backdrop-blur-md rounded-xl shrink-0 shadow-inner">
              <Smartphone size={22} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-sm tracking-tight text-white">Application non installée sur cet appareil</h4>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white shrink-0 flex items-center gap-1">
                  <Sparkles size={10} /> EduNova App
                </span>
              </div>
              <p className="text-blue-100 text-xs mt-0.5 leading-relaxed">
                Installez EduNova Pro sur votre terminal ({platformName}) via l'icône dédiée dans votre barre d'adresse pour bénéficier de l'accès 100% hors-ligne, des alertes et d'une fluidité maximale.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap sm:flex-nowrap">
            <button 
              onClick={handleManualPromptTest}
              type="button"
              className="px-4 py-2 bg-white text-blue-700 hover:bg-blue-50 text-xs font-extrabold rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 whitespace-nowrap"
              title="Tester le déclenchement direct du prompt PWA natif (window.__edunova_deferred_prompt)"
            >
              <Download size={14} className="stroke-[2.5] text-blue-600" />
              <span>Installer l'application</span>
            </button>
            <button 
              onClick={handleDismissPwa}
              type="button"
              className="px-2.5 py-2 text-xs font-semibold text-blue-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title="Ignorer pour cette session"
            >
              Plus tard
            </button>
            <button 
              onClick={handleDismissPwa}
              type="button"
              className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {show && (
        <div className="bg-indigo-600 text-white p-3 sm:p-4 rounded-xl shadow-lg mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 relative z-40">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/50 rounded-lg">
              <Bell size={20} className="text-indigo-50" />
            </div>
            <div>
              <h4 className="font-bold text-sm">Recevoir des notifications</h4>
              <p className="text-indigo-100 text-xs mt-0.5">Soyez alerté en temps réel (retards, paiements, annonces).</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleSubscribe}
              className="px-4 py-2 bg-white text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-50 transition-colors shadow-sm"
            >
              Activer
            </button>
            <button 
              onClick={handleDismiss}
              className="p-2 text-indigo-200 hover:text-white hover:bg-indigo-500/50 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
      {denied && !show && (
        <div className="bg-amber-100 text-amber-900 p-3 rounded-xl mb-6 flex items-center justify-between text-xs font-medium border border-amber-200 relative z-40">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            Les notifications sont bloquées dans votre navigateur. Autorisez-les dans la barre d'adresse pour tester.
          </div>
          <button onClick={() => { setDenied(false); window.sessionStorage.setItem('push_denied_dismissed', 'true'); }} className="p-1 hover:bg-amber-200 rounded-lg">
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
};

export default NotificationBanner;

