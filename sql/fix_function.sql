-- Fix get_my_school_id function to return UUID
DROP FUNCTION IF EXISTS public.get_my_school_id();

CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT school_id::uuid FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;
