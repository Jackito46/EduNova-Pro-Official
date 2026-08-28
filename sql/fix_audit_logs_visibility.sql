-- 1. Supprimer l'ancienne règle de lecture
DROP POLICY IF EXISTS "Admins can view audit logs for their school" ON public.audit_logs;

-- 2. Créer une nouvelle règle plus permissive pour les administrateurs et la direction
CREATE POLICY "Admins can view audit logs for their school"
    ON public.audit_logs
    FOR SELECT
    USING (
        -- Soit l'utilisateur est un SUPER_ADMIN
        (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
        OR
        -- Soit l'utilisateur appartient à la même école ET a un rôle de direction/administration
        (
            school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
            AND 
            (SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('SCHOOL_ADMIN', 'DIRECTOR', 'SECRETARY', 'ACCOUNTANT')
        )
    );
