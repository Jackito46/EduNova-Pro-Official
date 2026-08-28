
-- ==========================================================
-- STRUCTURE FINANCIÈRE PRO (FIX TYPE) - EduNova v4.1
-- ==========================================================

-- 1. NETTOYAGE DES ANCIENNES STRUCTURES MAL TYPÉES
DROP TABLE IF EXISTS public.fee_plans CASCADE;
DROP TABLE IF EXISTS public.academic_years CASCADE;

-- 2. TABLE DES ANNÉES ACADÉMIQUES (school_id en TEXT)
CREATE TABLE public.academic_years (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    school_id TEXT NOT NULL DEFAULT 'school-2025-premium',
    label TEXT NOT NULL, -- Ex: "2025-2026"
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(school_id, label)
);

-- 3. TABLE DES PLANS TARIFAIRES (school_id en TEXT)
CREATE TABLE public.fee_plans (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    school_id TEXT NOT NULL DEFAULT 'school-2025-premium',
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    inscription_fee NUMERIC DEFAULT 0,
    tuition_fee NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(academic_year_id, class_id)
);

-- 4. ACTIVATION RLS
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_plans ENABLE ROW LEVEL SECURITY;

-- Politiques simplifiées
DROP POLICY IF EXISTS "AY View" ON public.academic_years;
CREATE POLICY "AY View" ON public.academic_years FOR SELECT USING (true);
DROP POLICY IF EXISTS "AY Manage" ON public.academic_years;
CREATE POLICY "AY Manage" ON public.academic_years FOR ALL USING (true);

DROP POLICY IF EXISTS "FP View" ON public.fee_plans;
CREATE POLICY "FP View" ON public.fee_plans FOR SELECT USING (true);
DROP POLICY IF EXISTS "FP Manage" ON public.fee_plans;
CREATE POLICY "FP Manage" ON public.fee_plans FOR ALL USING (true);

-- 5. FONCTIONS DE GESTION
CREATE OR REPLACE FUNCTION public.activate_academic_year(p_school_id TEXT, p_year_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    -- 1. Passer l'ancienne session ACTIVE en CLOTUREE pour cette école
    UPDATE public.academic_years
    SET is_active = false,
        status = 'CLOTUREE'
    WHERE school_id = p_school_id AND status = 'ACTIVE';

    -- 2. Activer la session spécifiée
    UPDATE public.academic_years
    SET is_active = true,
        status = 'ACTIVE'
    WHERE id = p_year_id AND school_id = p_school_id;
END;
$$;

-- 6. INJECTION INITIALE : ANNÉE 2025-2026
INSERT INTO public.academic_years (school_id, label, is_active)
VALUES ('school-2025-premium', '2025-2026', true)
ON CONFLICT (school_id, label) DO NOTHING;

-- 6. INJECTION DE LA GRILLE STANDARD
-- On récupère l'ID de l'année qu'on vient de créer
INSERT INTO public.fee_plans (school_id, academic_year_id, class_id, inscription_fee, tuition_fee)
SELECT 
    c.school_id,
    ay.id as academic_year_id,
    c.id as class_id,
    CASE 
        WHEN c.level = 'MATERNELLE' THEN 5000
        WHEN c.level = 'FONDAMENTALE' THEN 7500
        WHEN c.level = 'SECONDAIRE' THEN 10000
        ELSE 5000
    END as inscription,
    CASE 
        WHEN c.level = 'MATERNELLE' THEN 25000
        WHEN c.level = 'FONDAMENTALE' THEN 35000
        WHEN c.level = 'SECONDAIRE' THEN 50000
        ELSE 20000
    END as tuition
FROM public.classes c
JOIN public.academic_years ay ON ay.label = '2025-2026' AND ay.school_id = c.school_id
WHERE c.school_id = 'school-2025-premium'
ON CONFLICT (academic_year_id, class_id) DO NOTHING;
