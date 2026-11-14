import React, { createContext, useContext, useEffect, useState } from 'react';
import { hasStoredAuthToken } from '../supabase';

interface SecurityContextType {
  ipAddress: string | null;
  country: string | null;
  isInOfficeHours: boolean;
  isAllowedLocation: boolean;
}

const SecurityContext = createContext<SecurityContextType>({
  ipAddress: null,
  country: null,
  isInOfficeHours: true,
  isAllowedLocation: true,
});

export const useSecurity = () => useContext(SecurityContext);

const GEO_CACHE_KEY = 'edunova_geo_guard_cache';
const GEO_CACHE_TTL_MS = 30 * 60 * 1000;

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [securityData, setSecurityData] = useState<SecurityContextType>({
    ipAddress: null,
    country: null,
    isInOfficeHours: true,
    isAllowedLocation: true,
  });

  useEffect(() => {
    const isPreviewOrDev = typeof window !== 'undefined' && (
      window.location.hostname.includes('run.app') ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      Boolean(import.meta.env.DEV)
    );

    // Ne pas déclencher d'appels IP externes bloquants sur le site public / login ou en dev/preview
    if (isPreviewOrDev || !hasStoredAuthToken()) {
      return;
    }

    // Vérifier le cache session (30 min) avant tout appel réseau externe
    try {
      const rawCache = window.sessionStorage.getItem(GEO_CACHE_KEY);
      if (rawCache) {
        const parsed = JSON.parse(rawCache);
        if (parsed && typeof parsed.expiresAt === 'number' && Date.now() < parsed.expiresAt && parsed.value) {
          setSecurityData(parsed.value);
          return;
        }
      }
    } catch {}

    const fetchSecurityData = async () => {
      try {
        const fetchGeo = async () => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);
            const response = await fetch('https://get.geojs.io/v1/ip/geo.json', { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error('Primary API failed');
            return await response.json();
          } catch {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);
            const response = await fetch('https://ipapi.co/json/', { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error('Secondary API failed');
            const data = await response.json();
            return {
              ip: data.ip,
              country: data.country_name,
              country_code: data.country_code
            };
          }
        };

        const data = await fetchGeo();
        const currentHour = new Date().getHours();
        const isInOfficeHours = currentHour >= 6 && currentHour < 22;
        const countryCode = data.country_code || 'HT';
        const isAllowedLocation = countryCode === 'HT' || !countryCode;

        const nextData: SecurityContextType = {
          ipAddress: data.ip || 'Unknown',
          country: data.country || 'Unknown',
          isInOfficeHours,
          isAllowedLocation,
        };
        setSecurityData(nextData);
        try {
          window.sessionStorage.setItem(GEO_CACHE_KEY, JSON.stringify({
            expiresAt: Date.now() + GEO_CACHE_TTL_MS,
            value: nextData
          }));
        } catch {}
      } catch (error) {
        console.info('Geo-location restricted or unavailable (failing open):', error instanceof Error ? error.message : 'Unknown');
        setSecurityData(prev => ({
          ...prev,
          ipAddress: 'Unknown',
          country: 'Unknown',
          isInOfficeHours: true,
          isAllowedLocation: true
        }));
      }
    };

    const timer = window.setTimeout(fetchSecurityData, 400);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <SecurityContext.Provider value={securityData}>
      {children}
    </SecurityContext.Provider>
  );
}
