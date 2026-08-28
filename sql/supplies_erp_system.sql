
-- ==========================================================
-- ARCHITECTURE ERP FOURNITURES - EduNova Pro v6.0
-- ==========================================================

-- 1. Table Catalogue (Le référentiel dynamique)
CREATE TABLE IF NOT EXISTS public.supply_catalog (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    school_id TEXT NOT NULL,
    label TEXT NOT NULL,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    category TEXT DEFAULT 'Manuel', -- Manuel, Uniforme, Fourniture
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Mise à jour de la table des dossiers (Liaison au catalogue)
ALTER TABLE public.school_supplies ADD COLUMN IF NOT EXISTS catalog_item_id UUID REFERENCES public.supply_catalog(id);

-- 3. Activation RLS pour le Catalogue
ALTER TABLE public.supply_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Catalog access" ON public.supply_catalog;
CREATE POLICY "Catalog access" ON public.supply_catalog 
    FOR ALL USING (school_id = public.get_my_school_id());

-- 4. Injection de fournitures standards pour le test de production
INSERT INTO public.supply_catalog (school_id, label, unit_price, category) VALUES 
('school-2025-premium', 'Kit Uniforme Complet (3 pièces)', 4500, 'Uniforme'),
('school-2025-premium', 'Pack Livres Fondamentale 1-6', 12500, 'Manuel'),
('school-2025-premium', 'Carnet de Correspondance Officiel', 750, 'Fourniture')
ON CONFLICT DO NOTHING;

-- 5. Notification de recharge pour synchronisation immédiate
NOTIFY pgrst, 'reload schema';
