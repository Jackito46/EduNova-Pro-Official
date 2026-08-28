import fs from 'fs';

let content = fs.readFileSync('contexts/SchoolContext.tsx', 'utf-8');

// 1. Add AcademicYear to types import
if (!content.includes('AcademicYear')) {
  content = content.replace(/import \{ ([^}]+) \} from '\.\.\/types';/, (match, p1) => {
    return `import { ${p1}, AcademicYear } from '../types';`;
  });
}

// 2. Add activeAcademicYear to interface SchoolContextType
content = content.replace('refreshCampuses: () => Promise<void>;\n}', 
  'refreshCampuses: () => Promise<void>;\n  activeAcademicYear: AcademicYear | null;\n}');

// 3. Add state and fetch logic for activeAcademicYear
const fetchLogic = `
  const [activeAcademicYear, setActiveAcademicYear] = useState<AcademicYear | null>(null);

  const fetchActiveAcademicYear = async () => {
    if (!schoolId) return;
    try {
      const { data, error } = await supabase
        .from('academic_years')
        .select('*')
        .eq('school_id', schoolId);
        
      if (error) throw error;
      
      let allYears = data || [];
      
      // Determine session dynamically if no "ACTIVE" found or based on config
      // Usually, it's just the one with status = 'ACTIVE' or is_active = true
      let active = allYears.find(y => y.status === 'ACTIVE' || y.is_active === true) || allYears[0] || null;
      
      // Dynamic fallback for 2026 if the active one is old (e.g. 2024-2025) but we are in 2026.
      if (active) {
         // check if there's a global_settings for auto mode? Or simply if it's 2024-2025 and we are in 2026, correct it?
         // Actually, let's just make sure we pick the most appropriate one based on current date if auto mode is on
         // But the simplest is to just expose activeAcademicYear.
      }
      
      setActiveAcademicYear(active);
    } catch (e) {
      console.warn("Failed to fetch academic years", e);
    }
  };

  useEffect(() => {
    fetchActiveAcademicYear();
  }, [schoolId]);
`;

// Wait, the user specifically said:
// "S'assurer que le calcul de l'année scolaire en cours ne dépend pas d'une valeur fixe mais est dynamiquement calculé en fonction de la date actuelle si aucune session n'est explicitement définie pour 2026, tout en respectant le MultiTenant."

// Let's implement dynamic active year resolution:
const dynamicResolution = `
  const [activeAcademicYear, setActiveAcademicYear] = useState<AcademicYear | null>(null);

  const determineActiveYear = async () => {
    if (!schoolId) return;
    try {
      const { data: yearsData, error } = await supabase
        .from('academic_years')
        .select('*')
        .eq('school_id', schoolId);
        
      if (error) throw error;
      
      if (!yearsData || yearsData.length === 0) {
         setActiveAcademicYear(null);
         return;
      }

      // First check if a session is currently marked ACTIVE in DB.
      let dbActive = yearsData.find(y => y.status === 'ACTIVE' || y.is_active === true);
      
      // Fetch school global settings to check session_config
      const { data: schoolData } = await supabase.from('schools').select('global_settings').eq('id', schoolId).single();
      const settings = schoolData?.global_settings || {};
      const sessionConfig = settings.session_config || { mode: 'auto' };
      
      let resolvedYear = dbActive;
      
      if (sessionConfig.mode === 'auto') {
         const now = new Date();
         const currentYear = now.getFullYear();
         const currentMonth = now.getMonth(); // 0 = Jan, 7 = Aug
         let dynamicLabel = '';
         if (currentMonth < 7) {
             dynamicLabel = \`\${currentYear - 1}-\${currentYear}\`;
         } else {
             dynamicLabel = \`\${currentYear}-\${currentYear + 1}\`;
         }
         
         const matchingYear = yearsData.find(y => y.label === dynamicLabel);
         if (matchingYear) {
             resolvedYear = matchingYear;
         } else if (dbActive && dbActive.label === '2024-2025' && dynamicLabel === '2026-2027') {
             // If we are supposed to be in 26-27 but DB says 24-25, and 26-27 doesn't exist, we fallback to dbActive
             resolvedYear = dbActive;
         }
      } else if (sessionConfig.mode === 'manual' && sessionConfig.label) {
         const matchingYear = yearsData.find(y => y.label === sessionConfig.label);
         if (matchingYear) {
            resolvedYear = matchingYear;
         }
      }
      
      setActiveAcademicYear(resolvedYear || yearsData[0] || null);

    } catch (e) {
      console.warn("Failed to fetch academic year", e);
    }
  };

  useEffect(() => {
     determineActiveYear();
  }, [schoolId]);
`;

console.log("Script setup complete. Will run replacements next.");
