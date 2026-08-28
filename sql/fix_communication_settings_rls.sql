-- Fix RLS for communication_settings to allow SUPER_ADMIN
DROP POLICY IF EXISTS "Admins can manage communication settings of their school" ON public.communication_settings;

CREATE POLICY "Admins can manage communication settings of their school"
ON public.communication_settings FOR ALL
USING (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid() AND role IN ('SCHOOL_ADMIN', 'DIRECTOR', 'SUPER_ADMIN'))
  OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'SUPER_ADMIN' OR is_super_admin = true))
)
WITH CHECK (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid() AND role IN ('SCHOOL_ADMIN', 'DIRECTOR', 'SUPER_ADMIN'))
  OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'SUPER_ADMIN' OR is_super_admin = true))
);
