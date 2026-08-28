const fs = require('fs');
let code = fs.readFileSync('components/DisciplinaryView.tsx', 'utf8');

if (code.includes('const { terminology } = useSchool();')) {
  code = code.replace('const { terminology } = useSchool();', 'const { terminology, currentCampusId } = useSchool();');
}

code = code.replace(
  /const \{ data: fetchedClasses, error: classesError \} = await supabase\n\s*\.from\('classes'\)\n\s*\.select\('id, name'\)\n\s*\.eq\('school_id', user\.school_id\)\n\s*\.in\('id', registeredClassIds\)\n\s*\.order\('name'\);/g,
  `let q = supabase.from('classes').select('id, name, campus_id').eq('school_id', user.school_id).in('id', registeredClassIds).order('name');
        if (currentCampusId) {
          q = q.eq('campus_id', currentCampusId);
        }
        const { data: fetchedClasses, error: classesError } = await q;`
);

code = code.replace(
  /const mappedStudents = \(enrollData as any\[\]\)\n\s*\?\.filter\(e => e\.student && e\.student\.status === 'Actif'\)\n\s*\.map\(e =>/g,
  `const mappedStudents = (enrollData as any[])
        ?.filter(e => e.student && e.student.status === 'Actif' && classMap.has(e.class_id))
        .map(e =>`
);

code = code.replace(
  /}, \[selectedYearId, user\.school_id\]\);/g,
  `}, [selectedYearId, user.school_id, currentCampusId]);`
);

// Second step
code = code.replace(
  /const matchesClass = classFilter === 'ALL' \|\| classes\.find\(c => c\.id === r\.student\?\.class_id\)\?\.name === classFilter;/g,
  `const classMatchObj = classes.find(c => c.id === r.student?.class_id);
      const matchesClass = classFilter === 'ALL' || classMatchObj?.name === classFilter;
      
      if (currentCampusId && classMatchObj?.campus_id !== currentCampusId) {
         return false;
      }`
);

code = code.replace(
  /}, \[records, searchTerm, typeFilter, statusFilter, classFilter\]\);/g,
  `}, [records, searchTerm, typeFilter, statusFilter, classFilter, currentCampusId, classes]);`
);

fs.writeFileSync('components/DisciplinaryView.tsx', code);
