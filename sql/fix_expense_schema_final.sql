
-- 1. S'assurer que la table des catégories existe
CREATE TABLE IF NOT EXISTS public.expense_categories (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    school_id TEXT NOT NULL DEFAULT 'school-2025-premium',
    label TEXT NOT NULL,
    icon TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(school_id, label)
);

-- 2. Injection forcée d'une catégorie de secours
INSERT INTO public.expense_categories (school_id, label, icon) 
VALUES ('school-2025-premium', 'Divers & Imprévus', 'Tag')
ON CONFLICT DO NOTHING;

-- 3. Réparation de la table expenses
-- On ajoute category_id si elle manque
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='category_id') THEN
        ALTER TABLE public.expenses ADD COLUMN category_id UUID;
    END IF;
END $$;

-- 4. Établissement de la relation (Relationship)
-- On supprime et recrée la contrainte pour être certain qu'elle est reconnue par l'API
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_category_id_fkey;
ALTER TABLE public.expenses 
    ADD CONSTRAINT expenses_category_id_fkey 
    FOREIGN KEY (category_id) 
    REFERENCES public.expense_categories(id) 
    ON DELETE SET NULL;

-- 5. Privilèges de sécurité
GRANT ALL ON public.expense_categories TO anon, authenticated, service_role;
GRANT ALL ON public.expenses TO anon, authenticated, service_role;

-- 6. RECHARGEMENT CRITIQUE DU CACHE API
NOTIFY pgrst, 'reload schema';

COMMENT ON COLUMN public.expenses.category_id IS 'Lien vers le référentiel dynamique des catégories de charges';
