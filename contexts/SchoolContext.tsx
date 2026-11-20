import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { School, SchoolType, SchoolCampus, UserProfile, AcademicYear, UserRole } from '../types';
import { supabase, isBrowserStrictlyOffline } from '../supabase';
import { getTerminology, Terminology } from '../lib/terminology';

interface SchoolContextType {
  school: School | null;
  terminology: Terminology;
  loading: boolean;
  refreshSchool: () => Promise<void>;
  campuses: SchoolCampus[];
  currentCampusId: string | null;
  setCurrentCampusId: (id: string | null) => void;
  refreshCampuses: () => Promise<void>;
  activeAcademicYear: AcademicYear | null;
  refreshActiveYear: () => Promise<void>;
  globalModules: string[];
  isModuleEnabled: (moduleId: string) => boolean;
  refreshModules: () => Promise<void>;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export const SchoolProvider: React.FC<{ user: UserProfile | null, schoolId: string | null, children: React.ReactNode }> = ({ user, schoolId, children }) => {
  const isSuperUser = Boolean(
    user?.is_super_admin || 
    user?.role === UserRole.SUPER_ADMIN || 
    (user?.role as any) === 'SUPER_ADMIN'
  );

  const [school, setSchool] = useState<School | null>(() => {
    if (!schoolId) return null;
    try {
      const cached = localStorage.getItem(`edunova_cached_school_${schoolId}`);
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [campuses, setCampuses] = useState<SchoolCampus[]>(() => {
    if (!schoolId) return [];
    try {
      const cached = localStorage.getItem(`edunova_cached_campuses_${schoolId}`);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [activeAcademicYear, setActiveAcademicYear] = useState<AcademicYear | null>(() => {
    if (!schoolId) return null;
    try {
      const cached = localStorage.getItem(`edunova_cached_active_year_${schoolId}`);
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [globalModules, setGlobalModules] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem('edunova_cached_global_modules');
      const parsed = cached ? JSON.parse(cached) : null;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
    return ['finance', 'exams', 'attendance', 'inventory'];
  });
  const [currentCampusId, setCurrentCampusIdState] = useState<string | null>(() => {
    try {
      if (user && user.campus_id && !isSuperUser) {
         return user.campus_id; 
      }
      const saved = localStorage.getItem('edunova_current_campus_id');
      if (saved === 'GLOBAL') return null;
      return saved || (user?.campus_id || null);
    } catch (e) {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => !school);

  // Strictly enforce user's campus for non-super-user annexe admins
  useEffect(() => {
    if (user && user.campus_id && !isSuperUser) {
      setCurrentCampusIdState(user.campus_id);
    }
  }, [user?.campus_id, isSuperUser]);

  const isValidUuid = (id: any): boolean => {
    if (typeof id !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  };

  const withQuickRace = <T,>(promise: PromiseLike<T>, ms = 4500): Promise<T> => {
    let tid: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      tid = setTimeout(() => reject(new Error('SchoolContext timeout')), ms);
    });
    return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(tid));
  };

  const fetchSchool = async () => {
    if (!schoolId || !isValidUuid(schoolId)) {
      setLoading(false);
      return;
    }

    // Hydrate from localStorage cache immediately
    const cacheKey = `edunova_cached_school_${schoolId}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setSchool(JSON.parse(cached));
        setLoading(false);
      }
    } catch (e) {
      console.warn("School cache read error:", e);
    }

    if (isBrowserStrictlyOffline()) {
      setLoading(false);
      return;
    }

    // Guard: Only fetch from Supabase if we have an active authenticated session
    try {
      const { data: { session } } = await withQuickRace(supabase.auth.getSession(), 2500);
      if (!session) {
        setLoading(false);
        return;
      }
    } catch (e) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await withQuickRace(
        supabase.from('schools').select('*').eq('id', schoolId).single(),
        5000
      );

      if (error) throw error;
      if (data) {
        setSchool(data);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(data));
        } catch (e) {}
      }
    } catch (err: any) {
      const isNetworkError = 
        err?.message === 'Failed to fetch' || 
        err?.message?.includes('Erreur réseau') || 
        err?.message?.includes('timeout') ||
        err?.code === 'NETWORK_ERROR' ||
        err?.status === 503;
        
      if (isNetworkError) {
        console.warn('Error fetching school (Network warning):', err?.message);
      } else {
        console.warn('Error fetching school:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCampuses = async () => {
    if (!schoolId || !isValidUuid(schoolId)) {
      setCampuses([]);
      return;
    }

    // Attempt to load from localStorage cache first for low-bandwidth/offline support
    const cacheKey = `edunova_cached_campuses_${schoolId}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setCampuses(JSON.parse(cached));
      }
    } catch (e) {
      console.warn("Campuses cache read error:", e);
    }

    if (isBrowserStrictlyOffline()) {
      return;
    }

    // Guard: Only fetch from Supabase if we have an active authenticated session
    try {
      const { data: { session } } = await withQuickRace(supabase.auth.getSession(), 2500);
      if (!session) return;
    } catch (e) {
      return;
    }

    try {
      const { data, error } = await withQuickRace(
        supabase
          .from('school_campuses')
          .select('*')
          .eq('school_id', schoolId)
          .order('name', { ascending: true }),
        5000
      );

      if (error) throw error;
      
      let sortedCampuses = [...(data || [])];
      // Put "Siège Social" first in the list
      sortedCampuses.sort((a: SchoolCampus, b: SchoolCampus) => {
        const isASiege = a.name.toLowerCase().includes('siège social') || a.name.toLowerCase().includes('siege social') || a.id === '3dd425c2-2e23-4e3c-a02a-c67ed85ca490';
        const isBSiege = b.name.toLowerCase().includes('siège social') || b.name.toLowerCase().includes('siege social') || b.id === '3dd425c2-2e23-4e3c-a02a-c67ed85ca490';
        if (isASiege && !isBSiege) return -1;
        if (!isASiege && isBSiege) return 1;
        return a.name.localeCompare(b.name);
      });

      setCampuses(sortedCampuses);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(sortedCampuses));
      } catch (e) {}
      
      const isGlobalAdmin = (user?.role === 'SUPER_ADMIN' || user?.role === 'SCHOOL_ADMIN' || user?.role === 'DIRECTOR') && !user?.campus_id;
      
      if (sortedCampuses && sortedCampuses.length > 0) {
        const savedPreference = localStorage.getItem('edunova_current_campus_id');
        const isValidSaved = savedPreference ? (savedPreference === 'GLOBAL' || sortedCampuses.some((c: SchoolCampus) => c.id === savedPreference)) : false;
        
        const siegeSocial = sortedCampuses.find((c: SchoolCampus) => 
          c.name.toLowerCase().includes('siège social') || 
          c.name.toLowerCase().includes('siege social') ||
          c.id === '3dd425c2-2e23-4e3c-a02a-c67ed85ca490'
        );
        const targetDefaultId = siegeSocial ? siegeSocial.id : sortedCampuses[0].id;

        if (user?.campus_id) {
          if (currentCampusId !== user.campus_id) {
            handleSetCampusId(user.campus_id);
          }
        } else if (!isGlobalAdmin) {
          // Enforce the user's primary campus if they are not a global admin
          if (currentCampusId !== targetDefaultId) {
            handleSetCampusId(targetDefaultId);
          }
        } else {
          // Global admin! Position in first available campus if none selected
          if (!currentCampusId && !isValidSaved) {
            handleSetCampusId(targetDefaultId);
          } else if (currentCampusId) {
            const exists = sortedCampuses.some((c: SchoolCampus) => c.id === currentCampusId);
            if (!exists) {
              handleSetCampusId(targetDefaultId);
            }
          }
        }
      }
    } catch (err: any) {
      const isNetworkError = 
        err?.message === 'Failed to fetch' || 
        err?.message?.includes('Erreur réseau') || 
        err?.message?.includes('timeout') ||
        err?.code === 'NETWORK_ERROR' ||
        err?.status === 503;
        
      if (isNetworkError) {
        console.warn('Error fetching school campuses (Network warning):', err?.message);
      } else {
        console.warn('Error fetching school campuses:', err);
      }
    }
  };

  const handleSetCampusId = (id: string | null) => {
    if (user?.campus_id && !isSuperUser) {
      setCurrentCampusIdState(user.campus_id);
      return;
    }
    setCurrentCampusIdState(id);
    try {
      if (id) {
        localStorage.setItem('edunova_current_campus_id', id);
      } else {
        localStorage.setItem('edunova_current_campus_id', 'GLOBAL');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchActiveAcademicYear = async () => {
    if (!schoolId) return;
    const activeCacheKey = `edunova_cached_active_year_${schoolId}`;
    const yearsCacheKey = `edunova_cached_years_${schoolId}`;

    // Instant hydration from cache
    try {
      const cached = localStorage.getItem(activeCacheKey);
      if (cached) {
        setActiveAcademicYear(JSON.parse(cached));
      }
    } catch {}

    if (isBrowserStrictlyOffline()) {
      return;
    }

    try {
      const { data: yearsData, error } = await withQuickRace(
        supabase
          .from('academic_years')
          .select('*')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false }),
        5000
      );
        
      if (error) throw error;
      
      if (!yearsData || yearsData.length === 0) {
        return;
      }

      try {
        localStorage.setItem(yearsCacheKey, JSON.stringify(yearsData));
        localStorage.setItem(`edunova_has_session_${schoolId}`, 'true');
      } catch {}

      // Priority 1: Check if a session is explicitly marked ACTIVE or is_active in DB for this school
      let dbActive = yearsData.find(y => y.status === 'ACTIVE' || y.is_active === true);

      // Priority 2: Fallback to latest non-closed session if none is marked active
      if (!dbActive) {
        dbActive = yearsData.find(y => y.status !== 'CLOTUREE' && y.status !== 'ARCHIVED') || yearsData[0];
      }
      
      setActiveAcademicYear(dbActive || null);
      if (dbActive) {
        try {
          localStorage.setItem(activeCacheKey, JSON.stringify(dbActive));
        } catch {}
      }

    } catch (e) {
      console.warn("Failed to fetch active academic year (cache preserved)", e);
    }
  };

  const fetchGlobalModules = useCallback(async () => {
    if (isBrowserStrictlyOffline()) return;
    try {
      const { data, error } = await withQuickRace(
        supabase
          .from('global_settings')
          .select('key, value')
          .eq('key', 'modules_config')
          .maybeSingle(),
        4500
      );

      if (!error && data && data.value && Array.isArray((data.value as any).enabled_modules)) {
        const mods = (data.value as any).enabled_modules;
        setGlobalModules(mods);
        try {
          localStorage.setItem('edunova_cached_global_modules', JSON.stringify(mods));
        } catch {}
      }
    } catch (e) {
      console.warn("Failed to fetch global modules config (cache preserved)", e);
    }
  }, []);

  const isModuleEnabled = useCallback((moduleId: string): boolean => {
    // Standardize IDs: 'presences' -> 'attendance'
    const normalizedId = moduleId === 'presences' ? 'attendance' : moduleId;

    // 1. Global killswitch check:
    if (globalModules && Array.isArray(globalModules)) {
      if (!globalModules.includes(normalizedId)) {
        return false;
      }
    }

    // 2. School-level override check
    const schoolModules = (school as any)?.global_settings?.modules;
    if (schoolModules && typeof schoolModules === 'object') {
      if (normalizedId === 'attendance' && schoolModules.presences === false) {
        return false;
      }
      if (normalizedId === 'discipline' && schoolModules.discipline === false) {
        return false;
      }
      if (schoolModules[normalizedId] === false) {
        return false;
      }
    }

    // Specific rules for higher-ed (university/professional)
    if ((normalizedId === 'discipline' || normalizedId === 'attendance') && school) {
      const isHigherEd = school.school_type === 'UNIVERSITY' || school.school_type === 'PROFESSIONAL';
      if (isHigherEd && (!schoolModules || (schoolModules.presences === undefined && schoolModules.discipline === undefined))) {
        return false;
      }
    }

    return true;
  }, [globalModules, school]);

  useEffect(() => {
    // Failsafe guarantee: loading never stays true past 1.5s
    const safetyTimer = setTimeout(() => setLoading(false), 1500);

    fetchSchool();
    fetchCampuses();
    fetchActiveAcademicYear();
    fetchGlobalModules();

    // Listen for custom module config update events (immediate in-app update)
    const handleCustomModulesUpdate = (e: CustomEvent) => {
      if (e.detail && Array.isArray(e.detail.enabled_modules)) {
        setGlobalModules(e.detail.enabled_modules);
        try {
          localStorage.setItem('edunova_cached_global_modules', JSON.stringify(e.detail.enabled_modules));
        } catch {}
      } else {
        fetchGlobalModules();
      }
    };
    window.addEventListener('edunova_modules_config_updated' as any, handleCustomModulesUpdate);

    // Supabase Realtime for global_settings modules_config updates
    const channel = supabase
      .channel('public:global_settings_modules')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'global_settings', filter: 'key=eq.modules_config' },
        (payload: any) => {
          if (payload?.new?.value && Array.isArray(payload.new.value.enabled_modules)) {
            setGlobalModules(payload.new.value.enabled_modules);
          } else {
            fetchGlobalModules();
          }
        }
      )
      .subscribe();

    // Refresh when regaining connectivity or auth changes
    const handleReconnect = () => {
      fetchSchool();
      fetchCampuses();
      fetchActiveAcademicYear();
      fetchGlobalModules();
    };
    window.addEventListener('online', handleReconnect);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchSchool();
        fetchCampuses();
        fetchActiveAcademicYear();
        fetchGlobalModules();
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      window.removeEventListener('online', handleReconnect);
      window.removeEventListener('edunova_modules_config_updated' as any, handleCustomModulesUpdate);
      supabase.removeChannel(channel);
      subscription.unsubscribe();
    };
  }, [schoolId, user?.id, user?.campus_id, fetchGlobalModules]);

  const terminology = useMemo(() => {
    return getTerminology((school?.school_type as SchoolType) || SchoolType.CLASSIC);
  }, [school?.school_type]);

  const contextValue = useMemo(() => ({
    school, 
    terminology, 
    loading, 
    refreshSchool: fetchSchool,
    campuses,
    currentCampusId,
    setCurrentCampusId: handleSetCampusId,
    refreshCampuses: fetchCampuses,
    activeAcademicYear,
    refreshActiveYear: fetchActiveAcademicYear,
    globalModules,
    isModuleEnabled,
    refreshModules: fetchGlobalModules
  }), [
    school, 
    terminology, 
    loading, 
    campuses, 
    currentCampusId, 
    activeAcademicYear,
    globalModules,
    isModuleEnabled,
    fetchGlobalModules
  ]);

  return (
    <SchoolContext.Provider value={contextValue}>
      {children}
    </SchoolContext.Provider>
  );
};

export const useSchool = () => {
  const context = useContext(SchoolContext);
  if (context === undefined) {
    throw new Error('useSchool must be used within a SchoolProvider');
  }
  return context;
};
