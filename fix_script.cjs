const fs = require('fs');
let code = fs.readFileSync('components/DiscountManagementView.tsx', 'utf8');

code = code.replace(`        if (activeClassIds.length > 0) { let clsQuery = supabase
          .from('classes')
          .select('*')
          .eq('school_id', user.school_id)
          .in('id', activeClassIds)
          .order('name');
          
        if (currentCampusId) {
          clsQuery = clsQuery.eq('campus_id', currentCampusId);
        }
        
        const { data: cls } = await clsQuery;
        setClasses(cls || []);
        } else {
          setClasses([]);
        }
      } else {
        if (activeClassIds.length > 0) { let clsQuery = supabase.from('classes').select('*').eq('school_id', user.school_id).order('name');
        if (currentCampusId) {
          clsQuery = clsQuery.eq('campus_id', currentCampusId);
        }
        const { data: cls } = await clsQuery;
        setClasses(cls || []);
      }`, `        if (activeClassIds.length > 0) {
          let clsQuery = supabase
            .from('classes')
            .select('*')
            .eq('school_id', user.school_id)
            .in('id', activeClassIds)
            .order('name');
          
          if (currentCampusId) {
            clsQuery = clsQuery.eq('campus_id', currentCampusId);
          }
          
          const { data: cls } = await clsQuery;
          setClasses(cls || []);
        } else {
          setClasses([]);
        }
      } else {
        let clsQuery = supabase.from('classes').select('*').eq('school_id', user.school_id).order('name');
        if (currentCampusId) {
          clsQuery = clsQuery.eq('campus_id', currentCampusId);
        }
        const { data: cls } = await clsQuery;
        setClasses(cls || []);
      }`);

fs.writeFileSync('components/DiscountManagementView.tsx', code);
