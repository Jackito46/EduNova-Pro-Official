ALTER TABLE public.salary_advances ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.salary_advances DROP CONSTRAINT IF EXISTS salary_advances_status_check;
ALTER TABLE public.salary_advances ADD CONSTRAINT salary_advances_status_check CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAID', 'DEDUCTED'));
