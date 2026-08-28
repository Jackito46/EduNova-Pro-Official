-- hard hardening multi-tenant isolation
-- This script adds school_id to tables that were missing it and fixes RLS leaks

-- 1. Hardening class_subjects
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'class_subjects' AND column_name = 'school_id') THEN
        ALTER TABLE public.class_subjects ADD COLUMN school_id UUID REFERENCES public.schools(id);
        
        -- Backfill school_id from classes
        UPDATE public.class_subjects cs
        SET school_id = c.school_id
        FROM public.classes c
        WHERE cs.class_id = c.id;
        
        -- Fallback backfill from subjects if class backfill failed (e.g. orphaned rows)
        UPDATE public.class_subjects cs
        SET school_id = s.school_id
        FROM public.subjects s
        WHERE cs.subject_id = s.id AND cs.school_id IS NULL;
    END IF;
END $$;

DROP POLICY IF EXISTS "access_class_subjects" ON public.class_subjects;
CREATE POLICY "isolation_class_subjects" ON public.class_subjects
USING (is_super_admin() OR school_id = get_my_school_id())
WITH CHECK (is_super_admin() OR school_id = get_my_school_id());

-- 2. Hardening communication_recipients
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'communication_recipients' AND column_name = 'school_id') THEN
        ALTER TABLE public.communication_recipients ADD COLUMN school_id UUID REFERENCES public.schools(id);
        
        -- Backfill school_id from communication_logs
        UPDATE public.communication_recipients cr
        SET school_id = cl.school_id
        FROM public.communication_logs cl
        WHERE cr.log_id = cl.id;
    END IF;
END $$;

DROP POLICY IF EXISTS "access_communication_recipients" ON public.communication_recipients;
CREATE POLICY "isolation_communication_recipients" ON public.communication_recipients
USING (is_super_admin() OR school_id = get_my_school_id())
WITH CHECK (is_super_admin() OR school_id = get_my_school_id());

-- 3. Hardening active_sessions (Privacy Protection)
-- Even if we don't add school_id, we MUST restrict access
DROP POLICY IF EXISTS "access_active_sessions" ON public.active_sessions;
CREATE POLICY "isolation_active_sessions" ON public.active_sessions
USING (
    is_super_admin() OR 
    user_id = auth.uid() OR 
    EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = active_sessions.user_id 
        AND p.school_id = get_my_school_id()
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('DIRECTOR', 'ADMIN')
    )
);

-- 4. Hardening global_settings (Restrict to authenticated)
DROP POLICY IF EXISTS "gs_read" ON public.global_settings;
CREATE POLICY "gs_read_authenticated" ON public.global_settings
FOR SELECT USING (auth.role() = 'authenticated');

-- 5. Hardening session_policies
DROP POLICY IF EXISTS "access_session_policies" ON public.session_policies;
CREATE POLICY "isolation_session_policies" ON public.session_policies
FOR SELECT USING (auth.role() = 'authenticated');
