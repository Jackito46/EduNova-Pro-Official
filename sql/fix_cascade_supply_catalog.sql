-- Fix the missing ON DELETE CASCADE constraint on supply_catalog table
-- This allows the deletion of a school to correctly cascade down to academic_years and their supply_catalogs.

DO $$ 
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'supply_catalog_academic_year_id_fkey' AND table_name = 'supply_catalog') THEN
    ALTER TABLE supply_catalog DROP CONSTRAINT supply_catalog_academic_year_id_fkey;
  END IF;

  -- Add new constraint with ON DELETE CASCADE
  ALTER TABLE supply_catalog
  ADD CONSTRAINT supply_catalog_academic_year_id_fkey
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE;

  RAISE NOTICE 'Constraint supply_catalog_academic_year_id_fkey updated with ON DELETE CASCADE.';
END $$;
