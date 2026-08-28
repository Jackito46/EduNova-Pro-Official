-- Check data distribution by school_id
SELECT 'classes' as table_name, school_id, count(*) FROM public.classes GROUP BY school_id
UNION ALL
SELECT 'academic_years', school_id, count(*) FROM public.academic_years GROUP BY school_id
UNION ALL
SELECT 'subjects', school_id, count(*) FROM public.subjects GROUP BY school_id
UNION ALL
SELECT 'students', school_id, count(*) FROM public.students GROUP BY school_id
UNION ALL
SELECT 'fee_plans', school_id, count(*) FROM public.fee_plans GROUP BY school_id
UNION ALL
SELECT 'supply_catalog', school_id, count(*) FROM public.supply_catalog GROUP BY school_id;
