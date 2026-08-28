-- 1. Enable RLS on missing tables
ALTER TABLE public.supply_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_recipients ENABLE ROW LEVEL SECURITY;

-- 2. Add isolation policies for these tables
-- supply_payments (links to school_supplies)
CREATE POLICY isolation_supply_payments ON public.supply_payments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.school_supplies 
            WHERE school_supplies.id = supply_payments.supply_id 
            AND (school_supplies.school_id = get_my_school_id() OR is_super_admin())
        )
    );

-- session_policies
CREATE POLICY isolation_session_policies ON public.session_policies
    FOR ALL USING (school_id = get_my_school_id() OR is_super_admin());

-- active_sessions
CREATE POLICY isolation_active_sessions ON public.active_sessions
    FOR ALL USING (school_id = get_my_school_id() OR is_super_admin());

-- class_subjects (links to classes)
CREATE POLICY isolation_class_subjects ON public.class_subjects
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.classes 
            WHERE classes.id = class_subjects.class_id 
            AND (classes.school_id = get_my_school_id() OR is_super_admin())
        )
    );

-- global_settings
CREATE POLICY isolation_global_settings ON public.global_settings
    FOR ALL USING (school_id = get_my_school_id() OR is_super_admin());

-- communication_recipients (links to communication_logs)
CREATE POLICY isolation_communication_recipients ON public.communication_recipients
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.communication_logs 
            WHERE communication_logs.id = communication_recipients.log_id 
            AND (communication_logs.school_id = get_my_school_id() OR is_super_admin())
        )
    );

-- 3. Fix salary_advances leak
DROP POLICY IF EXISTS "Enable read access for all users on salary_advances" ON public.salary_advances;
DROP POLICY IF EXISTS "Enable insert for admins on salary_advances" ON public.salary_advances;
DROP POLICY IF EXISTS "Enable update for admins on salary_advances" ON public.salary_advances;

-- The existing "isolation_salary_advances" covers ALL commands with school isolation.
-- But we might want specific role checks for INSERT/UPDATE.
-- Let's refine it.

CREATE POLICY "Admins can manage salary advances" ON public.salary_advances
    FOR ALL 
    TO authenticated
    USING (
        (school_id = get_my_school_id() AND is_admin()) OR is_super_admin()
    )
    WITH CHECK (
        (school_id = get_my_school_id() AND is_admin()) OR is_super_admin()
    );

CREATE POLICY "Users can view their school's salary advances" ON public.salary_advances
    FOR SELECT
    TO authenticated
    USING (
        school_id = get_my_school_id() OR is_super_admin()
    );
