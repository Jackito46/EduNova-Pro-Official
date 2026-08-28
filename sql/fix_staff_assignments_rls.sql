-- SCRIPT DE CORRECTION : RLS STAFF ASSIGNMENTS
-- À exécuter dans le SQL Editor de Supabase

-- 1. Supprimer l'ancienne politique qui pose problème lors de l'INSERT
DROP POLICY IF EXISTS "Assignments manage policy" ON public.staff_assignments;

-- 2. Recréer la politique avec une syntaxe optimisée pour les INSERT (WITH CHECK explicite et sans préfixe de table ambigu)
CREATE POLICY "Assignments manage policy" ON public.staff_assignments
    FOR ALL 
    USING (
        public.is_admin() AND
        EXISTS (
            SELECT 1 FROM public.staff 
            WHERE public.staff.id = staff_id 
            AND public.staff.school_id = public.get_my_school_id()
        )
    )
    WITH CHECK (
        public.is_admin() AND
        EXISTS (
            SELECT 1 FROM public.staff 
            WHERE public.staff.id = staff_id 
            AND public.staff.school_id = public.get_my_school_id()
        )
    );
