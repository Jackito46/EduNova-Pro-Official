const fs = require('fs');
let code = fs.readFileSync('components/ReportsView.tsx', 'utf8');
code = code.replace(`      let clsQuery = supabase.from("classes").select("*").eq("school_id", user.school_id).order("name"); if (currentCampusId) clsQuery = clsQuery.eq("campus_id", currentCampusId); const { data } = await clsQuery;
        .from('classes')
        .select('*')
        .eq('school_id', user.school_id)
        .order('name');`, `      let clsQuery = supabase.from('classes').select('*').eq('school_id', user.school_id).order('name');
      if (currentCampusId) clsQuery = clsQuery.eq('campus_id', currentCampusId);
      const { data } = await clsQuery;`);
fs.writeFileSync('components/ReportsView.tsx', code);
