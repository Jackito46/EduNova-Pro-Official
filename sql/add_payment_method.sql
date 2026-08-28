-- 1. Ajouter la colonne payment_method à la table payments
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Cash' 
CHECK (payment_method IN ('Cash', 'Virement', 'MonCash', 'Chèque', 'Carte'));

-- 2. Mettre à jour les anciens paiements
UPDATE public.payments SET payment_method = 'Cash' WHERE payment_method IS NULL;

-- 3. S'assurer que school_id est bien de type UUID
DO $$ 
DECLARE
    v_col_type TEXT;
BEGIN
    SELECT data_type INTO v_col_type FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'school_id' AND table_schema = 'public';
    IF v_col_type = 'text' THEN
        ALTER TABLE public.payments ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
    END IF;
END $$;

-- 4. Réparer les politiques RLS pour les paiements
DROP POLICY IF EXISTS "Payments manage" ON public.payments;
DROP POLICY IF EXISTS "Payments isolation" ON public.payments;
DROP POLICY IF EXISTS "Payments read" ON public.payments;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.payments;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.payments;

CREATE POLICY "Payments read" ON public.payments FOR SELECT USING (
  school_id = public.get_my_school_id() OR public.is_super_admin()
);

CREATE POLICY "Payments insert" ON public.payments FOR INSERT WITH CHECK (
  school_id = public.get_my_school_id() OR public.is_super_admin()
);

CREATE POLICY "Payments update" ON public.payments FOR UPDATE USING (
  school_id = public.get_my_school_id() OR public.is_super_admin()
);

CREATE POLICY "Payments delete" ON public.payments FOR DELETE USING (
  school_id = public.get_my_school_id() OR public.is_super_admin()
);

-- 5. Notifier Supabase de recharger le schéma
NOTIFY pgrst, 'reload schema';
