
-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. NETTOYAGE
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. TABLE SCHOOLS
CREATE TABLE IF NOT EXISTS public.schools (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    name TEXT NOT NULL,
    status TEXT DEFAULT 'ACTIVE',
    subscription_plan VARCHAR(50) DEFAULT 'trial',
    subscription_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    subscription_end_date TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    is_protected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABLE PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    email TEXT,
    full_name TEXT,
    role TEXT DEFAULT 'SCHOOL_ADMIN',
    school_id UUID,
    is_super_admin BOOLEAN DEFAULT FALSE,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activation RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. FONCTIONS
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND is_super_admin = TRUE
  );
END; $$;

-- 4. POLITIQUES
DROP POLICY IF EXISTS "Allow individual read" ON public.profiles;
CREATE POLICY "Allow individual read" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow individual update" ON public.profiles;
CREATE POLICY "Allow individual update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 5. TRIGGER DE SYNCHRONISATION
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth
AS $$
DECLARE
  v_school_id UUID;
  v_is_super_admin BOOLEAN := FALSE;
BEGIN
  IF new.raw_user_meta_data->>'school_id' IS NOT NULL THEN
    v_school_id := (new.raw_user_meta_data->>'school_id')::uuid;
  ELSE
    SELECT id INTO v_school_id FROM public.schools ORDER BY created_at ASC LIMIT 1;
  END IF;

  IF new.raw_user_meta_data->>'is_super_admin' = 'true' THEN
    v_is_super_admin := TRUE;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, school_id, is_super_admin)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Utilisateur ' || substring(new.id::text, 1, 5)), 
    COALESCE(new.raw_user_meta_data->>'role', 'SCHOOL_ADMIN'),
    v_school_id,
    v_is_super_admin
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
