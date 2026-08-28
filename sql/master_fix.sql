-- 1. FIX FUNCTION
DROP FUNCTION IF EXISTS public.get_my_school_id() CASCADE;

CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT school_id::uuid FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 2. FIX PROFILES AND SCHOOLS RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE 
  pol record; 
BEGIN 
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' 
  LOOP 
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles;', pol.policyname); 
  END LOOP; 
END $$;

CREATE POLICY "Users can view their own profile" 
ON profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON profiles FOR UPDATE 
USING (auth.uid() = id);

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE 
  pol record; 
BEGIN 
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schools' 
  LOOP 
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.schools;', pol.policyname); 
  END LOOP; 
END $$;

CREATE POLICY "Anyone can view schools" 
ON schools FOR SELECT 
USING (true);

-- Ensure the user is linked to the school
UPDATE profiles 
SET school_id = 'a0ed9087-0554-40ae-ac26-86599a183b16' 
WHERE email = 'jackito46@gmail.com';

-- 3. FIX DATA SYNC (Migrate old school_id to new UUID)
DO $$
DECLARE
  v_user_email TEXT := 'jackito46@gmail.com';
  v_main_school_id UUID := 'a0ed9087-0554-40ae-ac26-86599a183b16';
  v_old_school_id TEXT := 'school-2025-premium';
BEGIN
  -- S'assurer que l'école principale existe
  INSERT INTO public.schools (id, name, status, subscription_plan)
  VALUES (v_main_school_id, 'École Principale', 'ACTIVE', 'premium')
  ON CONFLICT (id) DO NOTHING;

  -- Lier l'utilisateur à l'école principale
  UPDATE public.profiles 
  SET school_id = v_main_school_id,
      role = 'DIRECTOR',
      is_super_admin = TRUE
  WHERE email = v_user_email;
  
  -- Migrer les données de l'ancienne école (school-2025-premium) vers la nouvelle
  BEGIN UPDATE public.academic_years SET school_id = v_main_school_id::text WHERE school_id = v_old_school_id; EXCEPTION WHEN OTHERS THEN END;
  BEGIN UPDATE public.classes SET school_id = v_main_school_id::text WHERE school_id = v_old_school_id; EXCEPTION WHEN OTHERS THEN END;
  BEGIN UPDATE public.subjects SET school_id = v_main_school_id::text WHERE school_id = v_old_school_id; EXCEPTION WHEN OTHERS THEN END;
  BEGIN UPDATE public.students SET school_id = v_main_school_id::text WHERE school_id = v_old_school_id; EXCEPTION WHEN OTHERS THEN END;
  BEGIN UPDATE public.fee_plans SET school_id = v_main_school_id::text WHERE school_id = v_old_school_id; EXCEPTION WHEN OTHERS THEN END;
  BEGIN UPDATE public.supply_catalog SET school_id = v_main_school_id::text WHERE school_id = v_old_school_id; EXCEPTION WHEN OTHERS THEN END;
  BEGIN UPDATE public.enrollments SET school_id = v_main_school_id::text WHERE school_id = v_old_school_id; EXCEPTION WHEN OTHERS THEN END;
  BEGIN UPDATE public.expense_categories SET school_id = v_main_school_id::text WHERE school_id = v_old_school_id; EXCEPTION WHEN OTHERS THEN END;
  BEGIN UPDATE public.expenses SET school_id = v_main_school_id::text WHERE school_id = v_old_school_id; EXCEPTION WHEN OTHERS THEN END;
  BEGIN UPDATE public.payments SET school_id = v_main_school_id::text WHERE school_id = v_old_school_id; EXCEPTION WHEN OTHERS THEN END;
  BEGIN UPDATE public.staff SET school_id = v_main_school_id::text WHERE school_id = v_old_school_id; EXCEPTION WHEN OTHERS THEN END;

  -- Convertir les colonnes school_id en UUID pour correspondre à get_my_school_id()
  BEGIN ALTER TABLE public.academic_years ALTER COLUMN school_id TYPE UUID USING school_id::uuid; EXCEPTION WHEN OTHERS THEN END;
  BEGIN ALTER TABLE public.classes ALTER COLUMN school_id TYPE UUID USING school_id::uuid; EXCEPTION WHEN OTHERS THEN END;
  BEGIN ALTER TABLE public.subjects ALTER COLUMN school_id TYPE UUID USING school_id::uuid; EXCEPTION WHEN OTHERS THEN END;
  BEGIN ALTER TABLE public.students ALTER COLUMN school_id TYPE UUID USING school_id::uuid; EXCEPTION WHEN OTHERS THEN END;
  BEGIN ALTER TABLE public.fee_plans ALTER COLUMN school_id TYPE UUID USING school_id::uuid; EXCEPTION WHEN OTHERS THEN END;
  BEGIN ALTER TABLE public.supply_catalog ALTER COLUMN school_id TYPE UUID USING school_id::uuid; EXCEPTION WHEN OTHERS THEN END;
  BEGIN ALTER TABLE public.expense_categories ALTER COLUMN school_id TYPE UUID USING school_id::uuid; EXCEPTION WHEN OTHERS THEN END;
  BEGIN ALTER TABLE public.expenses ALTER COLUMN school_id TYPE UUID USING school_id::uuid; EXCEPTION WHEN OTHERS THEN END;
  BEGIN ALTER TABLE public.payments ALTER COLUMN school_id TYPE UUID USING school_id::uuid; EXCEPTION WHEN OTHERS THEN END;
  BEGIN ALTER TABLE public.staff ALTER COLUMN school_id TYPE UUID USING school_id::uuid; EXCEPTION WHEN OTHERS THEN END;
END $$;

-- 4. FIX ALL OTHER RLS POLICIES
DO $$
DECLARE
  t_name text;
BEGIN
  FOR t_name IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('academic_years', 'classes', 'subjects', 'students', 'fee_plans', 'supply_catalog', 'expense_categories', 'expenses', 'payments', 'staff', 'enrollments')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t_name);
    
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
END $$;
