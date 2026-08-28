import React, { createContext, useContext, useEffect, useState } from 'react';

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

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [securityData, setSecurityData] = useState<SecurityContextType>({
    ipAddress: null,
    country: null,
    isInOfficeHours: true,
    isAllowedLocation: true,
  });

  useEffect(() => {
    const fetchSecurityData = async () => {
      try {
        const fetchGeo = async () => {
          try {
            // Primary: GeoJS (reliable and open)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch('https://get.geojs.io/v1/ip/geo.json', { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error('Primary API failed');
            return await response.json();
          } catch (e) {
            console.warn("Primary geo-location service unavailable, trying secondary...");
            try {
              // Secondary: ipapi.co (reliable backup)
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 5000);
              const response = await fetch('https://ipapi.co/json/', { signal: controller.signal });
              clearTimeout(timeoutId);
              if (!response.ok) throw new Error('Secondary API failed');
              const data = await response.json();
              // Normalize data to match GeoJS shape used below
              return {
                ip: data.ip,
                country: data.country_name,
                country_code: data.country_code
              };
            } catch (e2) {
              throw new Error('All geo-location services failed');
            }
          }
        };

        const data = await fetchGeo();
        
        const currentHour = new Date().getHours();
        const isInOfficeHours = currentHour >= 6 && currentHour < 19; // 6 AM to 7 PM
        // If no country returned, assume allowed (fail open to avoid lockout on API failure)
        const countryCode = data.country_code || 'HT';
        const isAllowedLocation = countryCode === 'HT';

        setSecurityData({
          ipAddress: data.ip || 'Unknown',
          country: data.country || 'Unknown',
          isInOfficeHours,
          isAllowedLocation,
        });
      } catch (error) {
        // Log as info/warning instead of error to avoid alarming users in environments with restricted external access
        console.info('Geo-location restricted or unavailable (failing open):', error instanceof Error ? error.message : 'Unknown');
        // Fallback to allow if API fails
        setSecurityData(prev => ({ 
          ...prev, 
          ipAddress: 'Unknown',
          country: 'Unknown',
          isInOfficeHours: true, 
          isAllowedLocation: true 
        }));
      }
    };

    fetchSecurityData();
  }, []);

  return (
    <SecurityContext.Provider value={securityData}>
      {children}
    </SecurityContext.Provider>
  );
}
