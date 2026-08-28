-- Fix missing foreign key with ON DELETE CASCADE for payments.student_id

BEGIN;

-- 1. Remove dangling payments 
DELETE FROM public.payments p 
WHERE p.student_id IS NOT NULL 
AND NOT EXISTS (
    SELECT 1 FROM public.students s WHERE s.id = p.student_id
);

-- 2. Drop constraint if it exists (highly unlikely, but safe)
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_student_id_fkey;

-- 3. Add constraint with CASCADE
ALTER TABLE public.payments ADD CONSTRAINT payments_student_id_fkey 
FOREIGN KEY (student_id) REFERENCES public.students (id) ON DELETE CASCADE;

COMMIT;
