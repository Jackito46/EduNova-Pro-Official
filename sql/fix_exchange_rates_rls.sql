-- Fix exchange_rates RLS
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE 
  pol record; 
BEGIN 
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'exchange_rates' 
  LOOP 
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.exchange_rates;', pol.policyname); 
  END LOOP; 
END $$;

CREATE POLICY "Enable read access for users in same school" 
ON public.exchange_rates FOR SELECT 
USING (
  school_id::text = (SELECT school_id::text FROM profiles WHERE id = auth.uid())
  OR 
  (SELECT is_super_admin FROM profiles WHERE id = auth.uid()) = true
);

CREATE POLICY "Enable insert access for users in same school" 
ON public.exchange_rates FOR INSERT 
WITH CHECK (
  school_id::text = (SELECT school_id::text FROM profiles WHERE id = auth.uid())
  OR 
  (SELECT is_super_admin FROM profiles WHERE id = auth.uid()) = true
);

CREATE POLICY "Enable update access for users in same school" 
ON public.exchange_rates FOR UPDATE 
USING (
  school_id::text = (SELECT school_id::text FROM profiles WHERE id = auth.uid())
  OR 
  (SELECT is_super_admin FROM profiles WHERE id = auth.uid()) = true
);

CREATE POLICY "Enable delete access for users in same school" 
ON public.exchange_rates FOR DELETE 
USING (
  school_id::text = (SELECT school_id::text FROM profiles WHERE id = auth.uid())
  OR 
  (SELECT is_super_admin FROM profiles WHERE id = auth.uid()) = true
);
