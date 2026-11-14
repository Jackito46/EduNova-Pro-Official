import { useState, useEffect, useCallback } from 'react';
import { useOnlineStatus } from './useOnlineStatus';

export type BandwidthProfile = 'offline' | 'ultra-light' | 'standard';

interface NetworkInformationLike extends EventTarget {
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  saveData?: boolean;
  downlink?: number;
  rtt?: number;
}

export interface AdaptiveLightModeState {
  profile: BandwidthProfile;
  isLightMode: boolean;
  manualPref: 'auto' | 'on' | 'off';
  disableImages: boolean;
  disableCharts: boolean;
  pageSize: number;
  pollIntervalMs: number;
  setManualMode: (mode: 'auto' | 'on' | 'off') => void;
}

const LIGHT_MODE_PREF_KEY = 'edunova_light_mode_override';
const LIGHT_MODE_EVENT = 'edunova:lightmode:changed';

export function useAdaptiveLightMode(): AdaptiveLightModeState {
  const { isOnline, isSlow, latency } = useOnlineStatus();

  const [manualPref, setManualPref] = useState<'auto' | 'on' | 'off'>(() => {
    try {
      const saved = localStorage.getItem(LIGHT_MODE_PREF_KEY);
      if (saved === 'on' || saved === 'off') return saved;
    } catch {}
    return 'auto';
  });

  const [netInfo, setNetInfo] = useState<{
    effectiveType?: string;
    saveData?: boolean;
    rtt?: number;
  }>({});

  useEffect(() => {
    const conn = (navigator as unknown as { connection?: NetworkInformationLike }).connection;
    if (!conn) return;

    const sync = () => {
      setNetInfo({
        effectiveType: conn.effectiveType,
        saveData: Boolean(conn.saveData),
        rtt: conn.rtt,
      });
    };

    sync();
    conn.addEventListener?.('change', sync);
    return () => conn.removeEventListener?.('change', sync);
  }, []);

  useEffect(() => {
    const handleSyncPref = () => {
      try {
        const saved = localStorage.getItem(LIGHT_MODE_PREF_KEY);
        setManualPref(saved === 'on' || saved === 'off' ? saved : 'auto');
      } catch {}
    };
    window.addEventListener(LIGHT_MODE_EVENT, handleSyncPref);
    return () => window.removeEventListener(LIGHT_MODE_EVENT, handleSyncPref);
  }, []);

  const setManualMode = useCallback((mode: 'auto' | 'on' | 'off') => {
    setManualPref(mode);
    try {
      if (mode === 'auto') localStorage.removeItem(LIGHT_MODE_PREF_KEY);
      else localStorage.setItem(LIGHT_MODE_PREF_KEY, mode);
      window.dispatchEvent(new Event(LIGHT_MODE_EVENT));
    } catch {}
  }, []);

  const autoTriggered =
    Boolean(netInfo.saveData) ||
    netInfo.effectiveType === 'slow-2g' ||
    netInfo.effectiveType === '2g' ||
    (netInfo.effectiveType === '3g' && (netInfo.rtt ?? 0) > 600) ||
    isSlow ||
    (latency !== null && latency > 2000);

  const isLightMode =
    manualPref === 'on' ? true : manualPref === 'off' ? false : !isOnline || autoTriggered;

  const profile: BandwidthProfile = !isOnline
    ? 'offline'
    : isLightMode
      ? 'ultra-light'
      : 'standard';

  useEffect(() => {
    document.documentElement.dataset.edunovaMode = profile;
  }, [profile]);

  return {
    profile,
    isLightMode,
    manualPref,
    disableImages: isLightMode,
    disableCharts: isLightMode,
    pageSize: isLightMode ? 20 : 50,
    pollIntervalMs: isLightMode ? 300_000 : 60_000,
    setManualMode,
  };
}
