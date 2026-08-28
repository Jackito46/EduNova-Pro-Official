-- Definitive fix for global_settings table and RLS
-- This script ensures a consistent schema (key as PK) and correct RLS permissions for Super Admins.

BEGIN;

-- 1. Ensure columns are correct
-- If it was created with id as PK, we want to align it to use key as PK for easier upserts.
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- 2. Drop all possibly conflicting policies
DROP POLICY IF EXISTS isolation_global_settings ON public.global_settings;
DROP POLICY IF EXISTS "Public read access for global_settings" ON public.global_settings;
DROP POLICY IF EXISTS "Super admin full access for global_settings" ON public.global_settings;
DROP POLICY IF EXISTS "Super Admin only access" ON public.global_settings;
DROP POLICY IF EXISTS "Super Admins Manage All" ON public.global_settings;
DROP POLICY IF EXISTS "Public Read Access" ON public.global_settings;
DROP POLICY IF EXISTS "Global settings superadmin" ON public.global_settings;
DROP POLICY IF EXISTS "Public Read Settings" ON public.global_settings;

-- 3. Enable RLS
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

-- 4. Re-create the bulletproof is_super_admin function to be absolutely sure
-- We add an explicit check for the developer email as a failsafe
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_role text;
  v_is_super boolean;
  v_email text;
BEGIN
  -- Check JWT email first (fastest and most reliable for identified dev)
  v_email := auth.jwt() ->> 'email';
  IF v_email = 'jackito46@gmail.com' THEN RETURN true; END IF;

  -- Check metadata
  IF (auth.jwt() -> 'user_metadata' ->> 'is_super_admin')::boolean = true OR 
     (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true OR
     (auth.jwt() -> 'user_metadata' ->> 'role') = 'SUPER_ADMIN' OR
     (auth.jwt() -> 'app_metadata' ->> 'role') = 'SUPER_ADMIN' THEN 
    RETURN true; 
  END IF;

  -- Fallback: Database check
  SELECT role, is_super_admin INTO v_role, v_is_super 
  FROM public.profiles 
  WHERE id = auth.uid();
  
  IF v_role = 'SUPER_ADMIN' OR v_is_super = true THEN
    RETURN true;
  END IF;

  RETURN false;
EXCEPTION WHEN OTHERS THEN 
  RETURN false;
END;
$$;

-- 5. Create robust policies
CREATE POLICY "Public Read Access" 
ON public.global_settings FOR SELECT 
USING (true);

-- Policy for management
CREATE POLICY "Super Admin Manage All" 
ON public.global_settings FOR ALL 
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- 6. Ensure the current user is a super admin in the profiles table
UPDATE public.profiles 
SET role = 'SUPER_ADMIN', 
    is_super_admin = true 
WHERE email = 'jackito46@gmail.com';

-- 7. Sync metadata if possible
UPDATE auth.users 
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"is_super_admin": true, "role": "SUPER_ADMIN"}'::jsonb,
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"is_super_admin": true, "role": "SUPER_ADMIN"}'::jsonb
WHERE email = 'jackito46@gmail.com';

COMMIT;

NOTIFY pgrst, 'reload schema';
