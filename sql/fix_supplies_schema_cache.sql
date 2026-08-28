-- Ensure currency column exists and reload schema cache
ALTER TABLE public.school_supplies ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'HTG';
ALTER TABLE public.school_supplies ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
ALTER TABLE public.school_supplies ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PAID';

NOTIFY pgrst, 'reload schema';
