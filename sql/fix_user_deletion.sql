-- Fix foreign key constraints to allow user deletion

-- 1. Fix exchange_rates
ALTER TABLE public.exchange_rates DROP CONSTRAINT IF EXISTS exchange_rates_created_by_fkey;
ALTER TABLE public.exchange_rates ADD CONSTRAINT exchange_rates_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Fix payroll_slips
ALTER TABLE public.payroll_slips DROP CONSTRAINT IF EXISTS payroll_slips_paid_by_fkey;
ALTER TABLE public.payroll_slips ADD CONSTRAINT payroll_slips_paid_by_fkey 
    FOREIGN KEY (paid_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Fix profiles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey 
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
