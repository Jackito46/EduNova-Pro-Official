-- Create payments FK cascade
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_student_id_fkey;
ALTER TABLE public.payments ADD CONSTRAINT payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students (id) ON DELETE CASCADE;
