-- Fix activate_academic_year function signature to support UUID school_id
CREATE OR REPLACE FUNCTION public.activate_academic_year(p_school_id UUID, p_year_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    -- 1. Passer l'ancienne session ACTIVE en CLOTUREE (PAST) pour cette école
    UPDATE public.academic_years
    SET is_active = false,
        status = 'PAST'
    WHERE school_id = p_school_id AND status = 'ACTIVE';

    -- 2. Activer la session spécifiée
    UPDATE public.academic_years
    SET is_active = true,
        status = 'ACTIVE'
    WHERE id = p_year_id AND school_id = p_school_id;
END;
$$;
