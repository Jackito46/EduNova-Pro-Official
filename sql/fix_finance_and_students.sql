-- 1. Réparation de la table students (Colonnes manquantes)
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS discount_label TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent_relation TEXT;

-- 2. Réparation de la table expense_categories
CREATE TABLE IF NOT EXISTS public.expense_categories (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    school_id TEXT NOT NULL,
    label TEXT NOT NULL,
    icon TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activation RLS pour les catégories de dépenses
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "EC isolation" ON public.expense_categories;
CREATE POLICY "EC isolation" ON public.expense_categories 
    FOR ALL USING (school_id = public.get_my_school_id());

-- Injection des catégories par défaut pour l'école actuelle
INSERT INTO public.expense_categories (school_id, label, icon)
SELECT 'a0ed9087-0554-40ae-ac26-86599a183b16', label, icon
FROM (VALUES 
    ('Salaires & Primes', 'Users'),
    ('Loyer & Infrastructures', 'Home'),
    ('Électricité & Eau', 'Zap'),
    ('Fournitures Bureau', 'Paperclip'),
    ('Maintenance & Réparations', 'Wrench'),
    ('Marketing & Communication', 'Megaphone'),
    ('Impôts & Taxes', 'FileText'),
    ('Divers & Imprévus', 'MoreHorizontal')
) AS default_cats(label, icon)
ON CONFLICT DO NOTHING;

-- 3. Rafraîchissement du cache PostgREST
NOTIFY pgrst, 'reload schema';
