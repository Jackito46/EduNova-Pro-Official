ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS termination_details JSONB;
COMMENT ON COLUMN public.staff.termination_details IS 'Détails du licenciement (motif, préavis, date, etc.)';
