-- Audit Logs System for Multi-Tenant Traceability

-- 1. Create the audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL, -- e.g., 'LOGIN', 'CREATE', 'UPDATE', 'DELETE'
    entity_type VARCHAR(255) NOT NULL, -- e.g., 'auth', 'student', 'payment', 'expense', 'class'
    entity_id UUID, -- ID of the affected record (optional)
    details JSONB DEFAULT '{}'::jsonb, -- Additional context (IP, user agent, old/new values)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_school_id ON public.audit_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON public.audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Admins and Super Admins can view logs for their school
CREATE POLICY "Admins can view audit logs for their school"
    ON public.audit_logs
    FOR SELECT
    USING (
        school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
        AND (
            (SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('SCHOOL_ADMIN', 'SUPER_ADMIN')
        )
    );

-- Users can insert logs for their school
CREATE POLICY "Users can insert audit logs for their school"
    ON public.audit_logs
    FOR INSERT
    WITH CHECK (
        school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    );

-- Allow insertion during login (when auth.uid() might not be fully established in the session yet, but we have the user's school_id)
-- Actually, if they are logged in, auth.uid() is set. But just in case, we allow authenticated users to insert.
CREATE POLICY "Authenticated users can insert audit logs"
    ON public.audit_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- No one can update or delete audit logs (immutable)
CREATE POLICY "No one can update audit logs"
    ON public.audit_logs
    FOR UPDATE
    USING (false);

CREATE POLICY "No one can delete audit logs"
    ON public.audit_logs
    FOR DELETE
    USING (false);

-- 5. Helper function to create an audit log from SQL (optional, useful for triggers)
CREATE OR REPLACE FUNCTION public.log_audit_event(
    p_school_id UUID,
    p_user_id UUID,
    p_action VARCHAR,
    p_entity_type VARCHAR,
    p_entity_id UUID DEFAULT NULL,
    p_details JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.audit_logs (school_id, user_id, action, entity_type, entity_id, details)
    VALUES (p_school_id, p_user_id, p_action, p_entity_type, p_entity_id, p_details)
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
