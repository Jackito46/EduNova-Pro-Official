import { useState, useEffect, useCallback, useRef } from 'react';
import { checkSupabaseConnection, isBrowserStrictlyOffline, isLocalDeploymentMode } from '../supabase';

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(
    isLocalDeploymentMode() ? true : (typeof navigator !== 'undefined' ? navigator.onLine : true)
  );
  const [isSlow, setIsSlow] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const inFlightRef = useRef(false);

  const checkActualConnection = useCallback(async () => {
    if (inFlightRef.current) return;
    // En mode Cloud uniquement, un navigateur hors-ligne signifie aucune connexion.
    // En mode Local / LAN, on ping toujours réellement le serveur Docker local (/local-supabase).
    if (isBrowserStrictlyOffline()) {
      setIsOnline(false);
      setIsSlow(false);
      setLatency(null);
      setLastChecked(new Date());
      return;
    }

    inFlightRef.current = true;
    setIsChecking(true);
    try {
      const start = Date.now();
      const connected = await checkSupabaseConnection();
      const duration = Date.now() - start;
      const now = new Date();

      setIsOnline(connected);
      setLastChecked(now);

      if (connected) {
        setLatency(duration);
        // If ping takes more than 2.5 seconds, consider it a slow/unstable connection
        setIsSlow(duration > 2500);
        setLatencyHistory(prev => {
          const updated = [...prev, duration];
          if (updated.length > 20) updated.shift();
          return updated;
        });
      } else {
        setLatency(null);
        setIsSlow(false);
      }
    } finally {
      inFlightRef.current = false;
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void checkActualConnection();
    };
    const handleOffline = () => {
      // En Mode Serveur Local / LAN, couper le Wi-Fi / Internet ne coupe pas localhost ni le LAN :
      // on vérifie réellement la joignabilité du serveur local au lieu de basculer en alerte Hors-ligne.
      if (isLocalDeploymentMode()) {
        void checkActualConnection();
        return;
      }
      setIsOnline(false);
      setIsSlow(false);
      setLatency(null);
      setLastChecked(new Date());
    };
    const handleLiveNetworkEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ online: boolean; latencyMs?: number }>)?.detail;
      if (!detail) return;
      setLastChecked(new Date());
      if (detail.online) {
        setIsOnline(true);
        if (typeof detail.latencyMs === 'number') {
          setLatency(detail.latencyMs);
          setIsSlow(detail.latencyMs > 3000);
        }
      } else {
        setIsOnline(false);
        setIsSlow(true);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('edunova_network_status', handleLiveNetworkEvent);

    // Initial check
    void checkActualConnection();

    // Periodic check every 45 seconds when tab is visible
    const interval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void checkActualConnection();
      }
    }, 45000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('edunova_network_status', handleLiveNetworkEvent);
      clearInterval(interval);
    };
  }, [checkActualConnection]);

  return { isOnline, isSlow, latency, latencyHistory, lastChecked, isChecking, refreshStatus: checkActualConnection };
};
