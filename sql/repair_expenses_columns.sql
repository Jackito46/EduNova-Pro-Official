
-- 1. Réparation de la table expenses (Ajout des colonnes manquantes)
DO $$ 
BEGIN 
    -- Ajout de la date de dépense si absente
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='expense_date') THEN
        ALTER TABLE public.expenses ADD COLUMN expense_date DATE DEFAULT CURRENT_DATE;
    END IF;

    -- Ajout de la catégorie si absente
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='category_id') THEN
        ALTER TABLE public.expenses ADD COLUMN category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL;
    END IF;

    -- S'assurer que amount est bien un numérique
    ALTER TABLE public.expenses ALTER COLUMN amount TYPE NUMERIC;
END $$;

-- 2. Indexation pour la performance des rapports
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_school ON public.expenses(school_id);

-- 3. Mise à jour des données existantes (si des dates sont nulles)
UPDATE public.expenses SET expense_date = CURRENT_DATE WHERE expense_date IS NULL;

-- 4. RECHARGEMENT FORCE DU CACHE API
NOTIFY pgrst, 'reload schema';

COMMENT ON COLUMN public.expenses.expense_date IS 'Date effective du décaissement - Colonne pivot pour la comptabilité';
