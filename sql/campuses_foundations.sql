-- ==========================================
-- PHASE A: FONDATIONS DES CAMPUS / ANNEXES
-- Edunova Pro - Système de Gestion Scolaire
-- ==========================================

-- 1. Table des campus / annexes
CREATE TABLE IF NOT EXISTS public.school_campuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_school_campus_name UNIQUE (school_id, name)
);

-- 2. Activation de RLS sur school_campuses
ALTER TABLE public.school_campuses ENABLE ROW LEVEL SECURITY;

-- 3. Ajout de la politique Standard Isolation pour school_campuses
DROP POLICY IF EXISTS "Standard Isolation" ON public.school_campuses;
CREATE POLICY "Standard Isolation" ON public.school_campuses
FOR ALL
USING (public.is_super_admin() OR school_id::text = public.get_my_school_id_safe());

-- 4. Ajout de la colonne campus_id aux tables clés
-- profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES public.school_campuses(id) ON DELETE SET NULL;

-- students
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES public.school_campuses(id) ON DELETE SET NULL;

-- classes
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES public.school_campuses(id) ON DELETE SET NULL;

-- staff
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES public.school_campuses(id) ON DELETE SET NULL;

-- payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES public.school_campuses(id) ON DELETE SET NULL;

-- expenses
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES public.school_campuses(id) ON DELETE SET NULL;

-- 5. Seeding automatique des campus / annexes spécifiques à UMDH
-- ID de l'Université Moderne d'Haïti (UMDH) : 3dd425c2-2e23-4e3c-a02a-c67ed85ca490
INSERT INTO public.school_campuses (school_id, name, address, phone, email)
VALUES
    ('3dd425c2-2e23-4e3c-a02a-c67ed85ca490', 'Siège Social', 'Thomassin 35 # 7, Pétion-Ville', '4802-2672', 'contact@umdh.edu.ht'),
    ('3dd425c2-2e23-4e3c-a02a-c67ed85ca490', 'Mirebalais', 'Mirebalais, Centre', '4802-2673', 'mirebalais@umdh.edu.ht'),
    ('3dd425c2-2e23-4e3c-a02a-c67ed85ca490', 'Jacmel', 'Jacmel, Sud-Est', '4802-2674', 'jacmel@umdh.edu.ht'),
    ('3dd425c2-2e23-4e3c-a02a-c67ed85ca490', 'Carrefour', 'Carrefour, Ouest', '4802-2675', 'carrefour@umdh.edu.ht'),
    ('3dd425c2-2e23-4e3c-a02a-c67ed85ca490', 'Fonds-Des-Nègres', 'Fonds-Des-Nègres, Nippes', '4802-2676', 'fondsdesnegres@umdh.edu.ht')
ON CONFLICT (school_id, name) DO NOTHING;
