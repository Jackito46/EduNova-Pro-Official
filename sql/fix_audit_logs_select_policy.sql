-- Fix Audit Logs Select Policy
-- Drop the existing select policy
DROP POLICY IF EXISTS "Admins can view audit logs for their school" ON public.audit_logs;

-- Recreate with broader roles (DIRECTOR, SECRETARY, ACCOUNTANT, etc.)
CREATE POLICY "Admins can view audit logs for their school"
    ON public.audit_logs
    FOR SELECT
    USING (
        (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
        OR
        (
            school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
            AND (SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('SCHOOL_ADMIN', 'DIRECTOR', 'SECRETARY', 'ACCOUNTANT')
        )
    );
