-- Fix Audit Logs Policies
-- Run this script in your Supabase SQL Editor

-- 1. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admins can view audit logs for their school" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can insert audit logs for their school" ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "No one can update audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "No one can delete audit logs" ON public.audit_logs;

-- 2. Recreate the SELECT policy with the correct type casting
CREATE POLICY "Admins can view audit logs for their school"
    ON public.audit_logs
    FOR SELECT
    USING (
        school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
        AND (
            (SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('SCHOOL_ADMIN', 'SUPER_ADMIN')
        )
    );

-- 3. Recreate the INSERT policy
CREATE POLICY "Authenticated users can insert audit logs"
    ON public.audit_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 4. Recreate UPDATE and DELETE policies (immutable)
CREATE POLICY "No one can update audit logs"
    ON public.audit_logs
    FOR UPDATE
    USING (false);

CREATE POLICY "No one can delete audit logs"
    ON public.audit_logs
    FOR DELETE
    USING (false);

-- 5. Make sure RLS is enabled
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
