
-- 1. Fonction pour désactiver les autres années lors de l'activation d'une nouvelle
CREATE OR REPLACE FUNCTION public.set_active_academic_year()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active = true THEN
        UPDATE public.academic_years 
        SET is_active = false 
        WHERE school_id = NEW.school_id AND id <> NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger d'automatisation
DROP TRIGGER IF EXISTS tr_set_active_year ON public.academic_years;
CREATE TRIGGER tr_set_active_year
    BEFORE INSERT OR UPDATE OF is_active ON public.academic_years
    FOR EACH ROW EXECUTE FUNCTION public.set_active_academic_year();

-- 3. Vue simplifiée pour le frontend
CREATE OR REPLACE VIEW public.v_active_fee_plans AS
SELECT 
    fp.*,
    ay.label as year_label,
    c.name as class_name,
    c.level as class_level
FROM public.fee_plans fp
JOIN public.academic_years ay ON fp.academic_year_id = ay.id
JOIN public.classes c ON fp.class_id = c.id
WHERE ay.is_active = true;

NOTIFY pgrst, 'reload schema';
