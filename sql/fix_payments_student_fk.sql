
BEGIN;
-- Remove orphaned or dangling payments pointing to a non-existent student
DELETE FROM public.payments p WHERE p.student_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.students s WHERE s.id = p.student_id);

-- Add the FK with ON DELETE CASCADE
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_student_id_fkey;
ALTER TABLE public.payments ADD CONSTRAINT payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students (id) ON DELETE CASCADE;
COMMIT;
