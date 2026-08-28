
-- 1. Réparation de la structure de la table payments
DO $$ 
BEGIN 
    -- Si la colonne 'nature' existe, on la rend optionnelle pour ne plus bloquer les inserts
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='nature') THEN
        ALTER TABLE public.payments ALTER COLUMN nature DROP NOT NULL;
    END IF;

    -- On s'assure que 'type' existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='type') THEN
        ALTER TABLE public.payments ADD COLUMN type TEXT DEFAULT 'Scolarité';
    END IF;
END $$;

-- 2. Nettoyage des politiques RLS pour éviter tout conflit de cache
DROP POLICY IF EXISTS "Payments isolation" ON public.payments;
CREATE POLICY "Payments isolation" ON public.payments
    FOR ALL USING (school_id = public.get_my_school_id());

-- 3. Notification CRITIQUE de rafraîchissement
NOTIFY pgrst, 'reload schema';

COMMENT ON TABLE public.payments IS 'Table de paiements v5.0 - Compatibilité type/nature restaurée';
