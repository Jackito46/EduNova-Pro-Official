import React, { createContext, useContext, useState, useEffect } from 'react';
import { School, SchoolType, SchoolCampus, UserProfile, AcademicYear } from '../types';
import { supabase } from '../supabase';
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
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export const SchoolProvider: React.FC<{ user: UserProfile | null, schoolId: string | null, children: React.ReactNode }> = ({ user, schoolId, children }) => {
  const [school, setSchool] = useState<School | null>(null);
  const [campuses, setCampuses] = useState<SchoolCampus[]>([]);
  const [activeAcademicYear, setActiveAcademicYear] = useState<AcademicYear | null>(null);
  const [currentCampusId, setCurrentCampusIdState] = useState<string | null>(() => {
    try {
      if (user && user.campus_id) {
         return user.campus_id; 
      }
      const saved = localStorage.getItem('edunova_current_campus_id');
      if (saved === 'GLOBAL') return null;
      return saved || null;
    } catch (e) {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // Strictly enforce user's campus when user changes
  useEffect(() => {
    if (user && user.campus_id) {
      setCurrentCampusIdState(user.campus_id);
    }
  }, [user?.campus_id]);

  const isValidUuid = (id: any): boolean => {
    if (typeof id !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  };

  const fetchSchool = async () => {
    if (!schoolId || !isValidUuid(schoolId)) {
      setLoading(false);
      return;
    }

    // Attempt to load from localStorage cache first for low-bandwidth/offline support
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

    // Guard: Only fetch from Supabase if we have an active authenticated session
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }
    } catch (e) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .eq('id', schoolId)
        .single();

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

    // Guard: Only fetch from Supabase if we have an active authenticated session
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
    } catch (e) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('school_campuses')
        .select('*')
        .eq('school_id', schoolId)
        .order('name', { ascending: true });

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

        const isVilWilson = user?.email?.toLowerCase() === 'vilinfo2014@gmail.com';

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
          // Global admin! On first login/session (no currentCampusId and no valid saved preference), 
          // default them to their first available exact campus/annexe instead of "Vue Globale" (null).
          // This positions the principal admin in their exact first campus.
          if (!currentCampusId && !isValidSaved) {
            handleSetCampusId(targetDefaultId);
          } else if (currentCampusId) {
            // Validate existing campus selection
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
    if (user?.campus_id) {
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
    try {
      const { data: yearsData, error } = await supabase
        .from('academic_years')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      if (!yearsData || yearsData.length === 0) {
        setActiveAcademicYear(null);
        return;
      }

      // Priority 1: Check if a session is explicitly marked ACTIVE or is_active in DB for this school
      let dbActive = yearsData.find(y => y.status === 'ACTIVE' || y.is_active === true);

      // Priority 2: Fallback to latest non-closed session if none is marked active
      if (!dbActive) {
        dbActive = yearsData.find(y => y.status !== 'CLOTUREE' && y.status !== 'ARCHIVED') || yearsData[0];
      }
      
      setActiveAcademicYear(dbActive || null);

    } catch (e) {
      console.warn("Failed to fetch active academic year", e);
    }
  };

  useEffect(() => {
    fetchSchool();
    fetchCampuses();
    fetchActiveAcademicYear();

    // Robustly recover from initial session loading race conditions by listening to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        console.log(`SchoolContext: Auth event [${event}] triggered data refresh.`);
        fetchSchool();
        fetchCampuses();
        fetchActiveAcademicYear();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [schoolId, user?.id, user?.campus_id]);

  const terminology = getTerminology((school?.school_type as SchoolType) || SchoolType.CLASSIC);

  return (
    <SchoolContext.Provider 
      value={{ 
        school, 
        terminology, 
        loading, 
        refreshSchool: fetchSchool,
        campuses,
        currentCampusId,
        setCurrentCampusId: handleSetCampusId,
        refreshCampuses: fetchCampuses,
        activeAcademicYear,
        refreshActiveYear: fetchActiveAcademicYear
      }}
    >
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
