-- Final fix for global_settings RLS
-- This script ensures that global_settings is accessible only by super admins for writes,
-- while allowing public read if necessary, or restricting it to super admins only.

BEGIN;

-- 1. Ensure the table is correctly structured (based on the original global_settings.sql)
-- We don't drop the table to preserve data, just check if it's there.

-- 2. Drop ALL existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public read access for global_settings" ON public.global_settings;
DROP POLICY IF EXISTS "Super admin full access for global_settings" ON public.global_settings;
DROP POLICY IF EXISTS "Super Admin only access" ON public.global_settings;
DROP POLICY IF EXISTS "isolation_global_settings" ON public.global_settings;

-- 3. Enable RLS
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

-- 4. Create clean policies
-- Policy for Super Admins (Full Control)
-- Uses BOTH USING and WITH CHECK to satisfy all operations (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Super Admins Manage All" 
ON public.global_settings 
FOR ALL 
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Policy for others (Read Only - needed if components like Login or SessionGuard read these settings)
-- If we want strict control, we could restrict this too, but usually some settings are public.
CREATE POLICY "Public Read Settings" 
ON public.global_settings 
FOR SELECT 
USING (true);

-- 5. Ensure the current user jackito46@gmail.com is indeed a Super Admin in the DB
-- (We use subquery to find the ID based on email)
UPDATE public.profiles 
SET role = 'SUPER_ADMIN', 
    is_super_admin = true 
WHERE email = 'jackito46@gmail.com';

COMMIT;

NOTIFY pgrst, 'reload schema';
