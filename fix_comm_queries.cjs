const fs = require('fs');

function fixQuery(file) {
  if (!fs.existsSync(file)) return;
  let code = fs.readFileSync(file, 'utf8');

  // Fix staff query
  code = code.replace(
    /result = await supabase\.from\('staff'\)\s*\.select\('([^']+)'\)\s*\.eq\('school_id', user\.school_id\)\s*\.in\('status', \['Actif', 'Congé'\]\);/g,
    `let query = supabase.from('staff').select('$1').eq('school_id', user.school_id).in('status', ['Actif', 'Congé']);
          if (currentCampusId) query = query.eq('campus_id', currentCampusId);
          result = await query;`
  );

  // Fix students query
  code = code.replace(
    /result = await supabase\.from\('students'\)\s*\.select\('([^']+)'\)\s*\.eq\('school_id', user\.school_id\)\s*\.eq\('status', 'Actif'\);/g,
    `let sq = supabase.from('students').select('$1, class:classes!inner(campus_id)').eq('school_id', user.school_id).eq('status', 'Actif');
          if (currentCampusId) sq = sq.eq('class.campus_id', currentCampusId);
          result = await sq;`
  );

  // add currentCampusId to the dependency array
  code = code.replace(/}, \[recipientType, user\.school_id\]\);/g, `}, [recipientType, user.school_id, currentCampusId]);`);

  fs.writeFileSync(file, code);
}

fixQuery('components/EmailModule.tsx');
fixQuery('components/SmsModule.tsx');
fixQuery('components/PushModule.tsx');
