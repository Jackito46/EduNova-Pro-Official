
-- 1. Sécurisation de la table des paiements
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    school_id TEXT NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    type TEXT DEFAULT 'Scolarité',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Forcer l'existence de la colonne 'type' si la table existait déjà sans elle
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='type') THEN
        ALTER TABLE public.payments ADD COLUMN type TEXT DEFAULT 'Scolarité';
    END IF;
END $$;

-- 3. Rafraîchissement brutal du cache PostgREST
NOTIFY pgrst, 'reload schema';

-- 4. Politique de sécurité renforcée
DROP POLICY IF EXISTS "Payments isolation" ON public.payments;
CREATE POLICY "Payments isolation" ON public.payments
    FOR ALL USING (school_id = public.get_my_school_id());
