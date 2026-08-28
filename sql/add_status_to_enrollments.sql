ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';
UPDATE public.enrollments SET status = 'ACTIVE' WHERE status IS NULL;
NOTIFY pgrst, 'reload schema';