-- Fix RLS for profiles
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

-- Fix RLS for schools
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
