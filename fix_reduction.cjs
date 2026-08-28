const fs = require('fs');
let code = fs.readFileSync('components/ReductionReportView.tsx', 'utf8');

code = code.replace(`  const { terminology } = useSchool();`, `  const { terminology, currentCampusId } = useSchool();`);

code = code.replace(`        // Fetch classes for filtering
        const { data: classesData } = await supabase
          .from('classes')
          .select('*')
          .eq('school_id', user.school_id)
          .order('name');
        if (classesData) setClasses(classesData);

        // Fetch students with discounts
        const { data } = await supabase
          .from('students')
          .select('*, class:classes(name)')
          .eq('school_id', user.school_id)
          .gt('discount_amount', 0)
          .order('discount_amount', { ascending: false });`, `        // Fetch classes for filtering
        let classesQuery = supabase
          .from('classes')
          .select('*')
          .eq('school_id', user.school_id)
          .order('name');
          
        if (currentCampusId) {
          classesQuery = classesQuery.eq('campus_id', currentCampusId);
        }
        
        const { data: classesData } = await classesQuery;
        if (classesData) setClasses(classesData);

        // Fetch students with discounts
        let studentsQuery = supabase
          .from('students')
          .select('*, class:classes!inner(name, campus_id)')
          .eq('school_id', user.school_id)
          .gt('discount_amount', 0);
          
        if (currentCampusId) {
          studentsQuery = studentsQuery.eq('class.campus_id', currentCampusId);
        }
        
        const { data } = await studentsQuery.order('discount_amount', { ascending: false });`);
        
code = code.replace(`  }, [user?.school_id]);`, `  }, [user?.school_id, currentCampusId]);`);

fs.writeFileSync('components/ReductionReportView.tsx', code);
