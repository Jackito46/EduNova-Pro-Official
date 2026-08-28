-- 1. Add school_id column
ALTER TABLE public.staff_salary_history ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- 2. Populate school_id based on staff member
UPDATE public.staff_salary_history ssh
SET school_id = s.school_id
FROM public.staff s
WHERE ssh.staff_id = s.id AND ssh.school_id IS NULL;

-- 3. Drop existing flawed policies
DROP POLICY IF EXISTS "Staff Salary History Insert Policy" ON public.staff_salary_history;
DROP POLICY IF EXISTS "Staff Salary History Read Policy" ON public.staff_salary_history;
DROP POLICY IF EXISTS "isolation_staff_salary_history_v1" ON public.staff_salary_history;

-- 4. Enable RLS (just in case)
ALTER TABLE public.staff_salary_history ENABLE ROW LEVEL SECURITY;

-- 5. Create new strict multi-tenant policies
CREATE POLICY "isolation_staff_salary_history_v1" 
ON public.staff_salary_history
FOR ALL
USING (school_id = public.get_my_school_id() OR public.is_super_admin())
WITH CHECK (school_id = public.get_my_school_id() OR public.is_super_admin());
