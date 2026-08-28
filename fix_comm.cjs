const fs = require('fs');

function fixFile(file) {
  if (!fs.existsSync(file)) return;
  let code = fs.readFileSync(file, 'utf8');

  // Add currentCampusId to useSchool
  if (code.includes('const { terminology } = useSchool();')) {
    code = code.replace('const { terminology } = useSchool();', 'const { terminology, currentCampusId } = useSchool();');
  } else if (!code.includes('currentCampusId')) {
    // Add it manually if terminology is not there
    code = code.replace('const { terminology, currentCampusId } = useSchool();', 'const { terminology, currentCampusId } = useSchool();');
  }

  // Replace fetchClasses
  code = code.replace(
    /const fetchClasses = async \(\) => \{\s+const \{ data \} = await supabase\.from\('classes'\)\.select\('id, name'\)\.eq\('school_id', user\.school_id\)\.order\('name'\);\s+if \(data\) setClasses\(data\);\s+\};/g,
    `const fetchClasses = async () => {
      let q = supabase.from('classes').select('id, name').eq('school_id', user.school_id).order('name');
      if (currentCampusId) q = q.eq('campus_id', currentCampusId);
      const { data } = await q;
      if (data) setClasses(data);
    };`
  );
  
  // Also check if there's a fetchStudents or similar
  code = code.replace(
    /const \{ data: studentsData \} = await supabase\.from\('students'\)\.select\('id, first_name, last_name, parent_email'\)\.eq\('school_id', user\.school_id\)\.eq\('status', 'ACTIVE'\);/g,
    `let sq = supabase.from('students').select('id, first_name, last_name, parent_email').eq('school_id', user.school_id).eq('status', 'ACTIVE');
      if (currentCampusId) sq = sq.eq('campus_id', currentCampusId);
      const { data: studentsData } = await sq;`
  );

  code = code.replace(
    /const \{ data: studentsData \} = await supabase\.from\('students'\)\.select\('id, first_name, last_name, parent_phone'\)\.eq\('school_id', user\.school_id\)\.eq\('status', 'ACTIVE'\);/g,
    `let sq = supabase.from('students').select('id, first_name, last_name, parent_phone').eq('school_id', user.school_id).eq('status', 'ACTIVE');
      if (currentCampusId) sq = sq.eq('campus_id', currentCampusId);
      const { data: studentsData } = await sq;`
  );
  
  code = code.replace(
    /const \{ data: staffsData \} = await supabase\.from\('staff'\)\.select\('id, first_name, last_name, email'\)\.eq\('school_id', user\.school_id\)\.eq\('status', 'ACTIVE'\);/g,
    `let stq = supabase.from('staff').select('id, first_name, last_name, email').eq('school_id', user.school_id).eq('status', 'ACTIVE');
      if (currentCampusId) stq = stq.eq('campus_id', currentCampusId);
      const { data: staffsData } = await stq;`
  );
  
  code = code.replace(
    /const \{ data: staffsData \} = await supabase\.from\('staff'\)\.select\('id, first_name, last_name, phone'\)\.eq\('school_id', user\.school_id\)\.eq\('status', 'ACTIVE'\);/g,
    `let stq = supabase.from('staff').select('id, first_name, last_name, phone').eq('school_id', user.school_id).eq('status', 'ACTIVE');
      if (currentCampusId) stq = stq.eq('campus_id', currentCampusId);
      const { data: staffsData } = await stq;`
  );

  code = code.replace(
    /useEffect\(\(\) => \{\s+fetchClasses\(\);\s+\}, \[user\.school_id\]\);/g,
    `useEffect(() => {
      fetchClasses();
    }, [user.school_id, currentCampusId]);`
  );
  
  code = code.replace(
    /useEffect\(\(\) => \{\s+const fetchClasses = async \(\) => \{\s+let q = supabase\.from\('classes'\)\.select\('id, name'\)\.eq\('school_id', user\.school_id\)\.order\('name'\);\s+if \(currentCampusId\) q = q\.eq\('campus_id', currentCampusId\);\s+const \{ data \} = await q;\s+if \(data\) setClasses\(data\);\s+\};\s+fetchClasses\(\);\s+\}, \[user\.school_id\]\);/g,
    `useEffect(() => {
    const fetchClasses = async () => {
      let q = supabase.from('classes').select('id, name').eq('school_id', user.school_id).order('name');
      if (currentCampusId) q = q.eq('campus_id', currentCampusId);
      const { data } = await q;
      if (data) setClasses(data);
    };
    fetchClasses();
  }, [user.school_id, currentCampusId]);`
  );

  fs.writeFileSync(file, code);
}

fixFile('components/EmailModule.tsx');
fixFile('components/SmsModule.tsx');
fixFile('components/PushModule.tsx');
