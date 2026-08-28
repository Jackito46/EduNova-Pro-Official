-- Mise à jour du catalogue pour supporter la planification par session
ALTER TABLE public.supply_catalog ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES public.academic_years(id);

-- Assigner les items existants à la session active (si possible)
DO $$
DECLARE
    active_year_id UUID;
BEGIN
    SELECT id INTO active_year_id FROM academic_years WHERE is_active = true LIMIT 1;
    IF active_year_id IS NOT NULL THEN
        UPDATE supply_catalog SET academic_year_id = active_year_id WHERE academic_year_id IS NULL;
    END IF;
END $$;
