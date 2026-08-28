
-- 1. Table des détails institutionnels
CREATE TABLE IF NOT EXISTS public.school_details (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    school_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    director_name TEXT,
    license_number TEXT,
    logo_url TEXT,
    stamp_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Activation RLS
ALTER TABLE public.school_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School details isolation" ON public.school_details
    FOR ALL USING (school_id = public.get_my_school_id());

-- 3. Injection du Profil par défaut si inexistant
INSERT INTO public.school_details (school_id, name, director_name)
VALUES ('school-2025-premium', 'Collège Pratique Moderne', 'Jean-Claude Pierre')
ON CONFLICT (school_id) DO NOTHING;

-- 4. INJECTION MASSIVE DE TARIFS RÉELS (2025-2026)
-- On vide d'abord pour éviter les doublons lors du script de démo
DELETE FROM public.fee_plans WHERE school_id = 'school-2025-premium';

WITH active_session AS (
    SELECT id FROM public.academic_years 
    WHERE school_id = 'school-2025-premium' AND label = '2025-2026' LIMIT 1
)
INSERT INTO public.fee_plans (school_id, academic_year_id, class_id, inscription_fee, tuition_fee)
SELECT 
    c.school_id,
    (SELECT id FROM active_session),
    c.id,
    -- Frais d'inscription (HTG)
    CASE 
        WHEN c.level = 'MATERNELLE' THEN 5000
        WHEN c.level = 'FONDAMENTALE' AND c.name IN ('1ère AF','2ème AF','3ème AF','4ème AF','5ème AF','6ème AF') THEN 7500
        WHEN c.level = 'FONDAMENTALE' THEN 10000 -- 7e, 8e, 9e
        WHEN c.level = 'SECONDAIRE' THEN 12500
        ELSE 5000
    END,
    -- Frais de Scolarité (HTG)
    CASE 
        WHEN c.level = 'MATERNELLE' THEN 25000
        WHEN c.level = 'FONDAMENTALE' AND c.name IN ('1ère AF','2ème AF','3ème AF','4ème AF','5ème AF','6ème AF') THEN 35000
        WHEN c.level = 'FONDAMENTALE' THEN 45000 -- 7e, 8e, 9e
        WHEN c.level = 'SECONDAIRE' THEN 60000
        ELSE 20000
    END
FROM public.classes c
WHERE c.school_id = 'school-2025-premium'
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
