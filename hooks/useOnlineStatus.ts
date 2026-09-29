
import { useState, useEffect, useCallback } from 'react';
import { checkSupabaseConnection } from '../supabase';

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSlow, setIsSlow] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkActualConnection = useCallback(async () => {
    setIsChecking(true);
    const start = Date.now();
    const connected = await checkSupabaseConnection();
    const duration = Date.now() - start;
    const now = new Date();

    setIsOnline(connected);
    setLastChecked(now);

    if (connected) {
      setLatency(duration);
      // If ping takes more than 3 seconds, consider it a slow connection
      setIsSlow(duration > 3000);
      setLatencyHistory(prev => {
        const updated = [...prev, duration];
        if (updated.length > 20) {
          updated.shift(); // Keep only the last 20 measurements
        }
        return updated;
      });
    } else {
      setLatency(null);
      setIsSlow(false);
    }
    setIsChecking(false);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const handleOnline = () => {
      setIsOnline(true);
      checkActualConnection();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setIsSlow(false);
      setLatency(null);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    checkActualConnection();

    // Periodic check every 60 seconds
    interval = setInterval(checkActualConnection, 60000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [checkActualConnection]);

  return { isOnline, isSlow, latency, latencyHistory, lastChecked, isChecking, refreshStatus: checkActualConnection };
};

