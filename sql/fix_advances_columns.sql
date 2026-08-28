-- Add missing columns to salary_advances table
ALTER TABLE public.salary_advances ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.salary_advances ADD COLUMN IF NOT EXISTS notes TEXT;

-- Ensure status check includes all current statuses
ALTER TABLE public.salary_advances DROP CONSTRAINT IF EXISTS salary_advances_status_check;
ALTER TABLE public.salary_advances ADD CONSTRAINT salary_advances_status_check CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAID', 'DEDUCTED'));
