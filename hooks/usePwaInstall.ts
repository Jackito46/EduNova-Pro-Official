import { useState, useEffect, useCallback } from 'react';

export type PwaPlatform = 'ios' | 'android' | 'mac' | 'windows' | 'linux' | 'chromebook' | 'other';
export type PwaBrowser = 'safari' | 'chrome' | 'edge' | 'firefox' | 'samsung' | 'opera' | 'brave' | 'other';

export interface PwaDetectionInfo {
  isStandalone: boolean;
  isInstalled: boolean;
  isInstallable: boolean;
  canPromptDirectly: boolean;
  platform: PwaPlatform;
  platformName: string;
  browser: PwaBrowser;
  browserName: string;
  isMobile: boolean;
  isDesktop: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isMac: boolean;
  isWindows: boolean;
  isLinux: boolean;
  isChromebook: boolean;
  isSafari: boolean;
  isChrome: boolean;
  isEdge: boolean;
  isFirefox: boolean;
}

export type PwaDeviceInfo = Omit<PwaDetectionInfo, 'isStandalone' | 'isInstalled' | 'isInstallable' | 'canPromptDirectly'>;

// Global state variables to capture events across lifecycle
let globalDeferredPrompt: any = null;
let globalIsInstallable = false;

// Helper to detect current platform and browser
export function detectPlatformAndBrowser(): PwaDeviceInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      platform: 'other',
      platformName: 'Inconnu',
      browser: 'other',
      browserName: 'Inconnu',
      isMobile: false,
      isDesktop: true,
      isIOS: false,
      isAndroid: false,
      isMac: false,
      isWindows: false,
      isLinux: false,
      isChromebook: false,
      isSafari: false,
      isChrome: false,
      isEdge: false,
      isFirefox: false,
    };
  }

  const ua = navigator.userAgent || '';
  const uaLower = ua.toLowerCase();
  const platformStr = (navigator.platform || '').toLowerCase();

  // OS Detection
  const isIOS = /iphone|ipad|ipod/.test(uaLower) || (platformStr.includes('mac') && navigator.maxTouchPoints > 1);
  const isAndroid = /android/.test(uaLower);
  const isChromebook = /cros/.test(uaLower);
  const isMac = !isIOS && !isChromebook && (/macintosh|mac os x/.test(uaLower) || platformStr.includes('mac'));
  const isWindows = !isChromebook && (/windows|win32|win64/.test(uaLower) || platformStr.includes('win'));
  const isLinux = !isAndroid && !isChromebook && (/linux/.test(uaLower) || platformStr.includes('linux'));

  let platform: PwaPlatform = 'other';
  let platformName = 'Appareil';
  if (isIOS) {
    platform = 'ios';
    platformName = /ipad/.test(uaLower) || (platformStr.includes('mac') && navigator.maxTouchPoints > 1) ? 'iPad (iPadOS)' : 'iPhone (iOS)';
  } else if (isAndroid) {
    platform = 'android';
    platformName = 'Téléphone / Tablette Android';
  } else if (isChromebook) {
    platform = 'chromebook';
    platformName = 'Chromebook (ChromeOS)';
  } else if (isMac) {
    platform = 'mac';
    platformName = 'Mac (macOS)';
  } else if (isWindows) {
    platform = 'windows';
    platformName = 'PC Windows';
  } else if (isLinux) {
    platform = 'linux';
    platformName = 'Ordinateur Linux';
  }

  // Browser Detection
  const isBrave = !!(navigator as any).brave || /brave/.test(uaLower);
  const isEdge = /edg\//.test(uaLower);
  const isOpera = /opr\/|opera/.test(uaLower);
  const isSamsung = /samsungbrowser/.test(uaLower);
  const isFirefox = /firefox|fxios/.test(uaLower);
  const isChrome = !isEdge && !isOpera && !isSamsung && !isBrave && /chrome|crios/.test(uaLower);
  const isSafari = !isChrome && !isEdge && !isOpera && !isSamsung && !isFirefox && !isBrave && /safari/.test(uaLower);

  let browser: PwaBrowser = 'other';
  let browserName = 'Navigateur Web';
  if (isBrave) {
    browser = 'brave';
    browserName = 'Brave Browser';
  } else if (isEdge) {
    browser = 'edge';
    browserName = 'Microsoft Edge';
  } else if (isOpera) {
    browser = 'opera';
    browserName = 'Opera';
  } else if (isSamsung) {
    browser = 'samsung';
    browserName = 'Samsung Internet';
  } else if (isFirefox) {
    browser = 'firefox';
    browserName = 'Mozilla Firefox';
  } else if (isChrome) {
    browser = 'chrome';
    browserName = 'Google Chrome';
  } else if (isSafari) {
    browser = 'safari';
    browserName = 'Apple Safari';
  }

  const isMobile = isIOS || isAndroid || /mobile|tablet|phone/.test(uaLower);
  const isDesktop = !isMobile;

  return {
    platform,
    platformName,
    browser,
    browserName,
    isMobile,
    isDesktop,
    isIOS,
    isAndroid,
    isMac,
    isWindows,
    isLinux,
    isChromebook,
    isSafari,
    isChrome,
    isEdge,
    isFirefox,
  };
}

// Check if running in standalone PWA mode or already installed on device
export function isPwaInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  
  const isStandalone = (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );

  return isStandalone;
}

// Alias for backwards compatibility
export const checkIsStandalone = isPwaInstalled;

export function isRunningInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    globalDeferredPrompt = e;
    globalIsInstallable = true;
    window.dispatchEvent(new Event('pwa-install-ready'));
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
    globalIsInstallable = false;
    try {
      localStorage.setItem('edunova_pwa_installed', 'true');
    } catch (e) {}
    window.dispatchEvent(new Event('pwa-installed'));
  });
}

export const usePwaInstall = () => {
  const getInitialPrompt = () => {
    if (globalDeferredPrompt) return globalDeferredPrompt;
    if (typeof window !== 'undefined' && (window as any).__edunova_deferred_prompt) {
      return (window as any).__edunova_deferred_prompt;
    }
    return null;
  };

  const initialPrompt = getInitialPrompt();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(initialPrompt);
  const [isInstallable, setIsInstallable] = useState(!!initialPrompt || globalIsInstallable);
  const [isInstalled, setIsInstalled] = useState(checkIsStandalone());
  const [detection, setDetection] = useState(detectPlatformAndBrowser());

  useEffect(() => {
    const isStandalone = checkIsStandalone();
    setIsInstalled(isStandalone);
    setDetection(detectPlatformAndBrowser());

    // Synchronize prompt if already captured on window
    const currentPrompt = getInitialPrompt();
    if (currentPrompt) {
      setDeferredPrompt(currentPrompt);
      setIsInstallable(true);
    }

    // Check modern navigator.getInstalledRelatedApps API if supported
    if (typeof navigator !== 'undefined' && 'getInstalledRelatedApps' in navigator) {
      try {
        (navigator as any).getInstalledRelatedApps().then((relatedApps: any[]) => {
          if (Array.isArray(relatedApps) && relatedApps.length > 0) {
            setIsInstalled(true);
            try {
              localStorage.setItem('edunova_pwa_installed', 'true');
            } catch (e) {}
          }
        }).catch(() => {});
      } catch (e) {}
    }

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        try {
          localStorage.setItem('edunova_pwa_installed', 'true');
        } catch (err) {}
      }
    };
    mediaQuery.addEventListener('change', handleChange);

    const handleReady = () => {
      const p = getInitialPrompt();
      setDeferredPrompt(p);
      setIsInstallable(true);
    };

    const handleInstalled = () => {
      setIsInstallable(false);
      setIsInstalled(true);
      setDeferredPrompt(null);
      globalDeferredPrompt = null;
      if (typeof window !== 'undefined') {
        (window as any).__edunova_deferred_prompt = null;
      }
      try {
        localStorage.setItem('edunova_pwa_installed', 'true');
      } catch (err) {}
    };

    window.addEventListener('pwa-install-ready', handleReady);
    window.addEventListener('pwa-prompt-captured', handleReady);
    window.addEventListener('pwa-installed', handleInstalled);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      window.removeEventListener('pwa-install-ready', handleReady);
      window.removeEventListener('pwa-prompt-captured', handleReady);
      window.removeEventListener('pwa-installed', handleInstalled);
    };
  }, []);

  const openInstallModal = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-pwa-install-modal'));
    }
  }, []);

  const closeInstallModal = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('close-pwa-install-modal'));
    }
  }, []);

  const installPwa = useCallback(async () => {
    const promptEvent = deferredPrompt || globalDeferredPrompt || (typeof window !== 'undefined' ? (window as any).__edunova_deferred_prompt : null);

    // If native prompt is available (Chrome, Edge, Samsung Internet)
    if (promptEvent) {
      try {
        promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice && choice.outcome === 'accepted') {
          globalDeferredPrompt = null;
          globalIsInstallable = false;
          if (typeof window !== 'undefined') {
            (window as any).__edunova_deferred_prompt = null;
          }
          setDeferredPrompt(null);
          setIsInstallable(false);
          setIsInstalled(true);
          try {
            localStorage.setItem('edunova_pwa_installed', 'true');
          } catch (e) {}
        }
      } catch (err) {
        console.error('Error during PWA installation prompt:', err);
        openInstallModal();
      }
    } else {
      // If native prompt is not yet available, show the modal guide
      openInstallModal();
    }
  }, [deferredPrompt, openInstallModal]);

  const openStandaloneTab = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank');
    }
  }, []);

  return {
    isInstallable: isInstallable || !isInstalled,
    isInstalled,
    isStandalone: isInstalled,
    isInIframe: isRunningInIframe(),
    canPromptDirectly: !!deferredPrompt,
    installPwa,
    openStandaloneTab,
    openInstallModal,
    closeInstallModal,
    ...detection,
  };
};
