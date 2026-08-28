SELECT cc.constraint_name, cc.check_clause
FROM information_schema.check_constraints cc
JOIN information_schema.table_constraints tc ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'ad_hoc_campaigns';
