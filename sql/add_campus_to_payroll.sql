-- Add campus_id to payroll_periods and fix the unique constraints for multi-annexe / multi-campus compatibility.

-- 1. Add campus_id column if not exists
ALTER TABLE public.payroll_periods 
ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES public.school_campuses(id) ON DELETE CASCADE;

-- 2. Drop the old unique constraint that restricted periods to school_id, month, year
ALTER TABLE public.payroll_periods 
DROP CONSTRAINT IF EXISTS payroll_periods_school_id_month_year_key;

-- 3. Create a unique index for campus-specific periods
CREATE UNIQUE INDEX IF NOT EXISTS payroll_periods_school_campus_month_year_idx 
ON public.payroll_periods (school_id, campus_id, month, year) 
WHERE campus_id IS NOT NULL;

-- 4. Create a unique index for centralized periods (no campus specified)
CREATE UNIQUE INDEX IF NOT EXISTS payroll_periods_school_month_year_centralized_idx 
ON public.payroll_periods (school_id, month, year) 
WHERE campus_id IS NULL;

-- 5. Add campus_id column to payroll_slips for direct querying and isolation (if desired, though optional, let's add it for consistency)
ALTER TABLE public.payroll_slips 
ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES public.school_campuses(id) ON DELETE CASCADE;
