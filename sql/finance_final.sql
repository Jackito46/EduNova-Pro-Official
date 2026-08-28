-- 1. Ajout des colonnes de réévaluation sur la table students
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS discount_label TEXT;

-- 2. Création de la table de paiements si non existante (ou mise à jour)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    school_id TEXT NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    type TEXT DEFAULT 'Scolarité',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Activation RLS pour les paiements
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Payments isolation" ON public.payments;
CREATE POLICY "Payments isolation" ON public.payments
    FOR ALL USING (school_id = public.get_my_school_id());

-- 4. Index pour accélérer le suivi élève
CREATE INDEX IF NOT EXISTS idx_payments_student_year ON public.payments(student_id, academic_year_id);

-- 5. Notification de recharge du schéma
NOTIFY pgrst, 'reload schema';