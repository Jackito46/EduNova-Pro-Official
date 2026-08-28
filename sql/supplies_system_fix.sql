
-- ==========================================================
-- RECONSTRUCTION MODULE FOURNITURES - EduNova Pro v5.2
-- Résolution de l'erreur RLS (Insertion non autorisée)
-- ==========================================================

-- 1. Table des Packs Fournitures
CREATE TABLE IF NOT EXISTS public.school_supplies (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    school_id TEXT NOT NULL,
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, academic_year_id)
);

-- 2. Table des Versements Fournitures
CREATE TABLE IF NOT EXISTS public.supply_payments (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    supply_id UUID NOT NULL REFERENCES public.school_supplies(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    payment_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Activation de la sécurité RLS
ALTER TABLE public.school_supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_payments ENABLE ROW LEVEL SECURITY;

-- 4. Politiques pour school_supplies
DROP POLICY IF EXISTS "Supplies isolation read" ON public.school_supplies;
CREATE POLICY "Supplies isolation read" ON public.school_supplies 
    FOR SELECT USING (school_id = public.get_my_school_id());

DROP POLICY IF EXISTS "Supplies isolation insert" ON public.school_supplies;
CREATE POLICY "Supplies isolation insert" ON public.school_supplies 
    FOR INSERT WITH CHECK (school_id = public.get_my_school_id());

DROP POLICY IF EXISTS "Supplies isolation manage" ON public.school_supplies;
CREATE POLICY "Supplies isolation manage" ON public.school_supplies 
    FOR ALL USING (school_id = public.get_my_school_id());

-- 5. Politiques pour supply_payments (Jointure avec la table parente)
DROP POLICY IF EXISTS "Payments isolation read" ON public.supply_payments;
CREATE POLICY "Payments isolation read" ON public.supply_payments 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.school_supplies 
            WHERE public.school_supplies.id = public.supply_payments.supply_id 
            AND public.school_supplies.school_id = public.get_my_school_id()
        )
    );

DROP POLICY IF EXISTS "Payments isolation insert" ON public.supply_payments;
CREATE POLICY "Payments isolation insert" ON public.supply_payments 
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.school_supplies 
            WHERE public.school_supplies.id = supply_id 
            AND public.school_supplies.school_id = public.get_my_school_id()
        )
    );

-- 6. Indexation
CREATE INDEX IF NOT EXISTS idx_supplies_student ON public.school_supplies(student_id);
CREATE INDEX IF NOT EXISTS idx_supplies_payments ON public.supply_payments(supply_id);

-- 7. Rafraîchissement PostgREST
NOTIFY pgrst, 'reload schema';

COMMENT ON TABLE public.school_supplies IS 'Gestion des packs de fournitures avec isolation RLS stricte.';
