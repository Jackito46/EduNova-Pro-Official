
ALTER TABLE public.enrollments RENAME COLUMN status TO status_temp;
ALTER TABLE public.enrollments RENAME COLUMN status_temp TO status;
NOTIFY pgrst, 'reload schema';
