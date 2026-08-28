-- SQL Script to ensure ON DELETE CASCADE for school deletion
-- Run this in your Supabase SQL Editor

-- 1. Drop existing foreign key constraints if they don't have CASCADE
-- (You may need to adjust the constraint names based on your actual schema)

-- 2. Re-create foreign key constraints with ON DELETE CASCADE

ALTER TABLE public.academic_years
  DROP CONSTRAINT IF EXISTS academic_years_school_id_fkey,
  ADD CONSTRAINT academic_years_school_id_fkey
  FOREIGN KEY (school_id)
  REFERENCES public.schools(id)
  ON DELETE CASCADE;

ALTER TABLE public.classes
  DROP CONSTRAINT IF EXISTS classes_school_id_fkey,
  ADD CONSTRAINT classes_school_id_fkey
  FOREIGN KEY (school_id)
  REFERENCES public.schools(id)
  ON DELETE CASCADE;

ALTER TABLE public.subjects
  DROP CONSTRAINT IF EXISTS subjects_school_id_fkey,
  ADD CONSTRAINT subjects_school_id_fkey
  FOREIGN KEY (school_id)
  REFERENCES public.schools(id)
  ON DELETE CASCADE;

ALTER TABLE public.staff
  DROP CONSTRAINT IF EXISTS staff_school_id_fkey,
  ADD CONSTRAINT staff_school_id_fkey
  FOREIGN KEY (school_id)
  REFERENCES public.schools(id)
  ON DELETE CASCADE;

ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_school_id_fkey,
  ADD CONSTRAINT students_school_id_fkey
  FOREIGN KEY (school_id)
  REFERENCES public.schools(id)
  ON DELETE CASCADE;

ALTER TABLE public.fee_plans
  DROP CONSTRAINT IF EXISTS fee_plans_school_id_fkey,
  ADD CONSTRAINT fee_plans_school_id_fkey
  FOREIGN KEY (school_id)
  REFERENCES public.schools(id)
  ON DELETE CASCADE;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_school_id_fkey,
  ADD CONSTRAINT payments_school_id_fkey
  FOREIGN KEY (school_id)
  REFERENCES public.schools(id)
  ON DELETE CASCADE;

ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_school_id_fkey,
  ADD CONSTRAINT expenses_school_id_fkey
  FOREIGN KEY (school_id)
  REFERENCES public.schools(id)
  ON DELETE CASCADE;

ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_school_id_fkey,
  ADD CONSTRAINT audit_logs_school_id_fkey
  FOREIGN KEY (school_id)
  REFERENCES public.schools(id)
  ON DELETE CASCADE;

-- Add others as needed (e.g., enrollments, grades, attendance, etc.)
