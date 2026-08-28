
-- Script de réparation des catégories de dépenses
-- Ce script s'assure que les catégories sont présentes pour l'école active

-- 1. Récupération de l'ID de l'école (à adapter si nécessaire, mais school-2025-premium est l'ID standard ici)
DO $$
DECLARE
    target_school_id UUID := 'school-2025-premium';
BEGIN
    -- Insertion des catégories manquantes
    INSERT INTO public.expense_categories (school_id, label, icon) VALUES 
    (target_school_id, 'Salaires & Honoraires', 'Users'),
    (target_school_id, 'Alimentation & Cantine', 'Coffee'),
    (target_school_id, 'Événements & Cérémonies', 'PartyPopper'),
    (target_school_id, 'Taxes & Impôts', 'FileText'),
    (target_school_id, 'Équipements & Mobilier', 'Armchair'),
    (target_school_id, 'Assurances & Sécurité', 'Shield'),
    (target_school_id, 'Divers & Imprévus', 'Tag'),
    (target_school_id, 'Utilitaires (EDH, DINEPA)', 'Zap'),
    (target_school_id, 'Matériel Pédagogique', 'BookOpen'),
    (target_school_id, 'Maintenance & Réparations', 'Tool'),
    (target_school_id, 'Fournitures de Bureau', 'Paperclip'),
    (target_school_id, 'Marketing & Communication', 'Megaphone'),
    (target_school_id, 'Loyer & Infrastructures', 'Home'),
    (target_school_id, 'Santé & Hygiène', 'HeartPulse'),
    (target_school_id, 'Transport & Logistique', 'Truck')
    ON CONFLICT (school_id, label) DO NOTHING;

    -- Mise à jour des icônes pour la cohérence
    UPDATE public.expense_categories SET icon = 'Zap' WHERE label = 'Utilitaires (EDH, DINEPA)' AND school_id = target_school_id;
    UPDATE public.expense_categories SET icon = 'BookOpen' WHERE label = 'Matériel Pédagogique' AND school_id = target_school_id;
    UPDATE public.expense_categories SET icon = 'Tool' WHERE label = 'Maintenance & Réparations' AND school_id = target_school_id;
END $$;
