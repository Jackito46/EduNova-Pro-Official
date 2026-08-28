-- Fix profiles and schools RLS
BEGIN;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles read" ON public.profiles;
DROP POLICY IF EXISTS "Profiles manage" ON public.profiles;
DROP POLICY IF EXISTS "Profiles self access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles super admin" ON public.profiles;
DROP POLICY IF EXISTS "Profiles school admin" ON public.profiles;

CREATE POLICY "Profiles self access" ON public.profiles FOR SELECT USING (
  id = auth.uid()
);

CREATE POLICY "Profiles super admin" ON public.profiles FOR ALL USING (
  public.is_super_admin()
);

CREATE POLICY "Profiles school admin" ON public.profiles FOR SELECT USING (
  school_id = public.get_my_school_id()
);

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Schools read" ON public.schools;
DROP POLICY IF EXISTS "Schools manage" ON public.schools;
DROP POLICY IF EXISTS "Schools super admin" ON public.schools;

CREATE POLICY "Schools read" ON public.schools FOR SELECT USING (
  id = public.get_my_school_id() OR public.is_super_admin()
);

CREATE POLICY "Schools super admin" ON public.schools FOR ALL USING (
  public.is_super_admin()
);

NOTIFY pgrst, 'reload schema';

COMMIT;
