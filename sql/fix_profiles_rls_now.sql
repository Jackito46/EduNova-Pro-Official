-- Fix RLS for profiles so users can read their own profile
DROP POLICY IF EXISTS "Profiles read own" ON public.profiles;
CREATE POLICY "Profiles read own" ON public.profiles
FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles update own" ON public.profiles;
CREATE POLICY "Profiles update own" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

-- Also ensure they can read their school
DROP POLICY IF EXISTS "Schools read own" ON public.schools;
CREATE POLICY "Schools read own" ON public.schools
FOR SELECT USING (
    id IN (
        SELECT school_id FROM public.profiles WHERE id = auth.uid()
    )
);
