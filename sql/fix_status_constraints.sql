
-- Update students status check constraint to include 'En attente'
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_status_check;
ALTER TABLE public.students ADD CONSTRAINT students_status_check CHECK (status IN ('Actif', 'Inactif', 'Suspendu', 'En attente'));

-- Add check constraint to enrollments status
ALTER TABLE public.enrollments DROP CONSTRAINT IF EXISTS enrollments_status_check;
ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_status_check CHECK (status IN ('PENDING_VALIDATION', 'WAITING_PAYMENT', 'ACTIVE', 'REJECTED'));

NOTIFY pgrst, 'reload schema';
