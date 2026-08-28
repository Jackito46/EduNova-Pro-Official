-- Fix the unique constraint on supply_catalog to include academic_year_id
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supply_catalog_school_label_unique') THEN
        ALTER TABLE public.supply_catalog DROP CONSTRAINT supply_catalog_school_label_unique;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supply_catalog_school_year_label_unique') THEN
        ALTER TABLE public.supply_catalog ADD CONSTRAINT supply_catalog_school_year_label_unique UNIQUE (school_id, academic_year_id, label);
    END IF;
END $$;
