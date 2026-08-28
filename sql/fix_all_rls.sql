-- Script to fix RLS policies for all tables to allow access based on school_id

DO $$
DECLARE
  t_name text;
BEGIN
  -- Loop through all relevant tables
  FOR t_name IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('academic_years', 'classes', 'subjects', 'students', 'fee_plans', 'supply_catalog', 'expense_categories', 'expenses', 'payments', 'staff', 'enrollments')
  LOOP
    -- Enable RLS
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t_name);
    
    -- Drop all existing policies on the table to avoid conflicts
    EXECUTE format('
      DO $inner$ 
      DECLARE 
        pol record; 
      BEGIN 
        FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = ''public'' AND tablename = ''%I'' 
        LOOP 
          EXECUTE format(''DROP POLICY IF EXISTS %%I ON public.%I;'', pol.policyname); 
        END LOOP; 
      END $inner$;
    ', t_name, t_name);
    
    -- Create new policies based on school_id
    EXECUTE format('
      CREATE POLICY "Enable read access for users in same school" 
      ON public.%I FOR SELECT 
      USING (
        school_id::text = (SELECT school_id::text FROM profiles WHERE id = auth.uid())
        OR 
        (SELECT is_super_admin FROM profiles WHERE id = auth.uid()) = true
      );
    ', t_name);
    
    EXECUTE format('
      CREATE POLICY "Enable insert access for users in same school" 
      ON public.%I FOR INSERT 
      WITH CHECK (
        school_id::text = (SELECT school_id::text FROM profiles WHERE id = auth.uid())
        OR 
        (SELECT is_super_admin FROM profiles WHERE id = auth.uid()) = true
      );
    ', t_name);
    
    EXECUTE format('
      CREATE POLICY "Enable update access for users in same school" 
      ON public.%I FOR UPDATE 
      USING (
        school_id::text = (SELECT school_id::text FROM profiles WHERE id = auth.uid())
        OR 
        (SELECT is_super_admin FROM profiles WHERE id = auth.uid()) = true
      );
    ', t_name);
    
    EXECUTE format('
      CREATE POLICY "Enable delete access for users in same school" 
      ON public.%I FOR DELETE 
      USING (
        school_id::text = (SELECT school_id::text FROM profiles WHERE id = auth.uid())
        OR 
        (SELECT is_super_admin FROM profiles WHERE id = auth.uid()) = true
      );
    ', t_name);
    
  END LOOP;
  
  RAISE NOTICE 'RLS policies updated successfully.';
END $$;
