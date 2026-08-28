-- 1. Mise à jour de la table academic_years
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'academic_years' AND column_name = 'status') THEN
        ALTER TABLE public.academic_years ADD COLUMN status TEXT DEFAULT 'PAST';
    END IF;
END $$;

-- Mise à jour des statuts existants basés sur is_active
UPDATE public.academic_years SET status = 'ACTIVE' WHERE is_active = true;
UPDATE public.academic_years SET status = 'PAST' WHERE is_active = false AND status = 'PAST';

-- 2. Création de la table enrollments (Historique de scolarité)
CREATE TABLE IF NOT EXISTS public.enrollments (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    school_id TEXT NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, academic_year_id)
);

-- Activation RLS pour enrollments
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enrollments isolation" ON public.enrollments;
CREATE POLICY "Enrollments isolation" ON public.enrollments
    FOR ALL USING (school_id = public.get_my_school_id());

-- 3. Migration des données actuelles vers enrollments
-- On inscrit tous les élèves actifs dans l'année active actuelle
INSERT INTO public.enrollments (school_id, student_id, academic_year_id, class_id)
SELECT s.school_id, s.id, ay.id, s.class_id
FROM public.students s
JOIN public.academic_years ay ON ay.school_id = s.school_id
WHERE ay.is_active = true
ON CONFLICT (student_id, academic_year_id) DO NOTHING;

-- 4. Fonction de calcul de la dette globale d'un élève
CREATE OR REPLACE FUNCTION public.get_student_global_debt(p_student_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_total_due NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_discount NUMERIC := 0;
BEGIN
    -- 1. Calculer tout ce que l'élève aurait dû payer (Frais d'inscription + Scolarité + Frais divers obligatoires) pour chaque année où il était inscrit
    SELECT COALESCE(SUM(
        fp.tuition_fee + 
        fp.inscription_fee + 
        CASE WHEN fp.is_misc_mandatory THEN COALESCE(fp.misc_fee_htg, 0) ELSE 0 END
    ), 0)
    INTO v_total_due
    FROM public.enrollments e
    JOIN public.fee_plans fp ON e.class_id = fp.class_id AND e.academic_year_id = fp.academic_year_id
    WHERE e.student_id = p_student_id;

    -- 2. Soustraire les réductions accordées (actuellement stockées sur la table student, mais on pourrait les historiser plus tard)
    -- Pour l'instant on considère que la réduction s'applique sur l'année en cours
    SELECT COALESCE(discount_amount, 0) INTO v_discount FROM public.students WHERE id = p_student_id;

    -- 3. Calculer le total des paiements effectués (en utilisant l'équivalent HTG ou le montant brut si ancien)
    SELECT COALESCE(SUM(COALESCE(amount_htg_equivalent, amount)), 0)
    INTO v_total_paid
    FROM public.payments
    WHERE student_id = p_student_id;

    RETURN GREATEST(v_total_due - v_discount - v_total_paid, 0);
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger pour mettre à jour automatiquement le statut 'Reliquat' ou 'Actif' (Optionnel mais utile)
-- On va plutôt gérer cela via la fonction dans le frontend pour plus de flexibilité.

NOTIFY pgrst, 'reload schema';
