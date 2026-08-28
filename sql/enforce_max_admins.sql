-- Enforce maximum of 2 SCHOOL_ADMIN per school

CREATE OR REPLACE FUNCTION public.check_max_admins()
RETURNS TRIGGER AS $$
DECLARE
    admin_count INTEGER;
BEGIN
    -- Only check if the role is being set to SCHOOL_ADMIN
    IF NEW.role = 'SCHOOL_ADMIN' THEN
        SELECT COUNT(*) INTO admin_count
        FROM public.profiles
        WHERE school_id = NEW.school_id AND role = 'SCHOOL_ADMIN' AND id != NEW.id;

        IF admin_count >= 2 THEN
            RAISE EXCEPTION 'La limite de 2 administrateurs par école est atteinte.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_max_admins_trigger ON public.profiles;
CREATE TRIGGER enforce_max_admins_trigger
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.check_max_admins();
