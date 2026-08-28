-- Script to check policies on classes and academic_years
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename IN ('classes', 'academic_years', 'students', 'fee_plans', 'subjects');
