
-- 1. Nettoyage de la table expenses
DO $$ 
BEGIN 
    -- On rend l'ancienne colonne optionnelle si elle existe encore
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='category') THEN
        ALTER TABLE public.expenses ALTER COLUMN category DROP NOT NULL;
        
        -- On la renomme pour éviter le conflit avec l'alias de jointure API 'category'
        ALTER TABLE public.expenses RENAME COLUMN category TO category_legacy;
    END IF;
END $$;

-- 2. On s'assure que category_id est bien présent et lié
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='category_id') THEN
        ALTER TABLE public.expenses ADD COLUMN category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. RAFFRAICHISSEMENT BRUTAL DU CACHE API
NOTIFY pgrst, 'reload schema';

COMMENT ON COLUMN public.expenses.category_id IS 'Identifiant technique de la catégorie (Référentiel)';
COMMENT ON COLUMN public.expenses.category_legacy IS 'Ancienne étiquette texte (Archive)';
