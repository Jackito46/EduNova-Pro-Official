const fs = require('fs');
let code = fs.readFileSync('components/DisciplinaryView.tsx', 'utf8');

code = code.replace(
  /const matchesClass = classFilter === 'ALL' || classes\.find\(c => c\.id === r\.student\?\.class_id\)\?\.name === classFilter;/,
  `const classMatchObj = classes.find(c => c.id === r.student?.class_id);
      const matchesClass = classFilter === 'ALL' || classMatchObj?.name === classFilter;
      
      if (currentCampusId && classMatchObj?.campus_id !== currentCampusId) {
         return false; // Skip if it doesn't belong to current campus
      }`
);

// We need to fetch campus_id in the classesQuery too
code = code.replace(
  /let q = supabase\.from\('classes'\)\.select\('id, name, campus_id'\)\.eq\('school_id', user\.school_id\)/,
  `let q = supabase.from('classes').select('id, name, campus_id').eq('school_id', user.school_id)`
); // already there!

code = code.replace(
  /}, \[records, searchTerm, typeFilter, statusFilter, classFilter\]\);/,
  `}, [records, searchTerm, typeFilter, statusFilter, classFilter, currentCampusId, classes]);`
);

fs.writeFileSync('components/DisciplinaryView.tsx', code);
