
-- 1. Table des catégories de dépenses
CREATE TABLE IF NOT EXISTS public.expense_categories (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    school_id TEXT NOT NULL DEFAULT 'school-2025-premium',
    label TEXT NOT NULL,
    icon TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(school_id, label)
);

-- 2. Injection des catégories standards
INSERT INTO public.expense_categories (school_id, label, icon) VALUES 
('school-2025-premium', 'Utilitaires (EDH, DINEPA)', 'Zap'),
('school-2025-premium', 'Matériel Pédagogique', 'BookOpen'),
('school-2025-premium', 'Maintenance & Réparations', 'Tool'),
('school-2025-premium', 'Fournitures de Bureau', 'Paperclip'),
('school-2025-premium', 'Marketing & Communication', 'Megaphone'),
('school-2025-premium', 'Loyer & Infrastructures', 'Home'),
('school-2025-premium', 'Santé & Hygiène', 'HeartPulse'),
('school-2025-premium', 'Transport & Logistique', 'Truck')
ON CONFLICT DO NOTHING;

-- 3. Mise à jour de la table des dépenses
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    school_id TEXT NOT NULL DEFAULT 'school-2025-premium',
    category_id UUID REFERENCES public.expense_categories(id),
    label TEXT NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    description TEXT,
    expense_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Sécurité RLS
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "EC isolation" ON public.expense_categories;
CREATE POLICY "EC isolation" ON public.expense_categories FOR ALL USING (school_id = public.get_my_school_id());

DROP POLICY IF EXISTS "EX isolation" ON public.expenses;
CREATE POLICY "EX isolation" ON public.expenses FOR ALL USING (school_id = public.get_my_school_id());

NOTIFY pgrst, 'reload schema';
