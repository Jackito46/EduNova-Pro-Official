
-- ==========================================================
-- CATALOGUE PRO FOURNITURES - EduNova Pro v8.0
-- CONFIGURATION DU RÉFÉRENTIEL STANDARD UNIVERSEL
-- ==========================================================

-- 1. Nettoyage préventif et vérification de la contrainte
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supply_catalog_school_label_unique') THEN
        ALTER TABLE public.supply_catalog DROP CONSTRAINT supply_catalog_school_label_unique;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supply_catalog_school_year_label_unique') THEN
        ALTER TABLE public.supply_catalog ADD CONSTRAINT supply_catalog_school_year_label_unique UNIQUE (school_id, academic_year_id, label);
    END IF;
END $$;

-- 2. Injection de la Matrice Standard (UPSERT)
-- Prix estimés en HTG pour un établissement premium
DO $$
DECLARE
    active_year_id UUID;
BEGIN
    SELECT id INTO active_year_id FROM academic_years WHERE is_active = true LIMIT 1;

    IF active_year_id IS NOT NULL THEN
        INSERT INTO public.supply_catalog (school_id, academic_year_id, label, unit_price, category) VALUES 

        -- CATEGORIE : UNIFORMES
        ('school-2025-premium', active_year_id, 'Uniforme Complet (Maternelle)', 3500, 'Uniforme'),
        ('school-2025-premium', active_year_id, 'Uniforme Complet (Fondamentale)', 4500, 'Uniforme'),
        ('school-2025-premium', active_year_id, 'Uniforme Complet (Secondaire)', 5500, 'Uniforme'),
        ('school-2025-premium', active_year_id, 'Veste Officielle (Graduation/Cérémonie)', 7500, 'Uniforme'),
        ('school-2025-premium', active_year_id, 'Tenue de Sport (EPS complet)', 2500, 'Uniforme'),

        -- CATEGORIE : MANUELS & PACKS
        ('school-2025-premium', active_year_id, 'Pack Livres : Cycle Maternelle', 8500, 'Manuel'),
        ('school-2025-premium', active_year_id, 'Pack Livres : 1e - 6e AF', 13500, 'Manuel'),
        ('school-2025-premium', active_year_id, 'Pack Livres : 7e - 9e AF', 16000, 'Manuel'),
        ('school-2025-premium', active_year_id, 'Pack Livres : Secondaire (NS1-NS4)', 22500, 'Manuel'),
        ('school-2025-premium', active_year_id, 'Livret de Préparation Examens d''État', 1500, 'Manuel'),

        -- CATEGORIE : SERVICES & FRAIS TECHNIQUES
        ('school-2025-premium', active_year_id, 'Assurance Scolaire Annuelle', 1250, 'Service'),
        ('school-2025-premium', active_year_id, 'Badge d''Identification Magnétique', 1000, 'Service'),
        ('school-2025-premium', active_year_id, 'Accès Laboratoire Informatique (Frais)', 2500, 'Service'),
        ('school-2025-premium', active_year_id, 'Frais de Laboratoire Sciences (Chimie/Bio)', 3000, 'Service'),
        ('school-2025-premium', active_year_id, 'Abonnement Bibliothèque Numérique', 1500, 'Service'),

        -- CATEGORIE : FOURNITURES
        ('school-2025-premium', active_year_id, 'Carnet de Liaison & Règlement Intérieur', 750, 'Fourniture'),
        ('school-2025-premium', active_year_id, 'Kit Géométrie Professionnel', 1250, 'Fourniture'),
        ('school-2025-premium', active_year_id, 'Blouse de Laboratoire Logotée', 2000, 'Fourniture')

        ON CONFLICT (school_id, academic_year_id, label) 
        DO UPDATE SET 
            category = EXCLUDED.category;
    END IF;
END $$;

-- 3. Rafraîchissement PostgREST pour mise à jour immédiate de l'interface
NOTIFY pgrst, 'reload schema';
