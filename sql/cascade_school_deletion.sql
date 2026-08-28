-- ==========================================================
-- CASCADE DELETION FOR SCHOOLS
-- This script ensures that deleting a school removes all associated data.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.handle_school_deletion()
RETURNS TRIGGER AS $$
DECLARE
    user_record RECORD;
BEGIN
    -- 1. Identify and delete associated users from auth.users
    -- This will effectively remove their access and trigger profile deletion if cascaded
    FOR user_record IN (SELECT id FROM public.profiles WHERE school_id = OLD.id) LOOP
        DELETE FROM auth.users WHERE id = user_record.id;
    END LOOP;

    -- 2. Delete profiles (in case some weren't linked to auth or cascade failed)
    DELETE FROM public.profiles WHERE school_id = OLD.id;
    
    -- 3. Delete staff
    DELETE FROM public.staff WHERE school_id = OLD.id;
    
    -- 4. Delete students
    DELETE FROM public.students WHERE school_id::text = OLD.id::text;
    
    -- 5. Delete classes
    DELETE FROM public.classes WHERE school_id::text = OLD.id::text;
    
    -- 6. Delete subjects
    DELETE FROM public.subjects WHERE school_id::text = OLD.id::text;
    
    -- 7. Delete payments
    DELETE FROM public.payments WHERE school_id::text = OLD.id::text;
    
    -- 8. Delete audit logs
    DELETE FROM public.audit_logs WHERE school_id = OLD.id;

    -- 9. Delete staff roles
    DELETE FROM public.staff_roles WHERE school_id = OLD.id;

    -- 10. Delete academic years (fee_plans will cascade)
    DELETE FROM public.academic_years WHERE school_id::text = OLD.id::text;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Create trigger
DROP TRIGGER IF EXISTS on_school_deleted ON public.schools;
CREATE TRIGGER on_school_deleted
    BEFORE DELETE ON public.schools
    FOR EACH ROW EXECUTE FUNCTION public.handle_school_deletion();

-- Add foreign key constraints with ON DELETE CASCADE where possible
-- Note: This might fail if types are inconsistent (UUID vs TEXT), 
-- which is why the trigger above is more robust for this specific schema.

COMMENT ON FUNCTION public.handle_school_deletion() IS 'Trigger function to clean up all school-related data on deletion.';
