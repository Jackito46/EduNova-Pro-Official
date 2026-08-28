
-- Ajout des catégories de charges manquantes pour une gestion scolaire complète
INSERT INTO public.expense_categories (school_id, label, icon) VALUES 
('school-2025-premium', 'Salaires & Honoraires', 'Users'),
('school-2025-premium', 'Alimentation & Cantine', 'Coffee'),
('school-2025-premium', 'Événements & Cérémonies', 'PartyPopper'),
('school-2025-premium', 'Taxes & Impôts', 'FileText'),
('school-2025-premium', 'Équipements & Mobilier', 'Armchair'),
('school-2025-premium', 'Assurances & Sécurité', 'Shield'),
('school-2025-premium', 'Divers & Imprévus', 'Tag')
ON CONFLICT (school_id, label) DO NOTHING;

-- Mise à jour des icônes pour plus de clarté si nécessaire
UPDATE public.expense_categories SET icon = 'Zap' WHERE label = 'Utilitaires (EDH, DINEPA)';
UPDATE public.expense_categories SET icon = 'BookOpen' WHERE label = 'Matériel Pédagogique';
UPDATE public.expense_categories SET icon = 'Tool' WHERE label = 'Maintenance & Réparations';
UPDATE public.expense_categories SET icon = 'Paperclip' WHERE label = 'Fournitures de Bureau';
UPDATE public.expense_categories SET icon = 'Megaphone' WHERE label = 'Marketing & Communication';
UPDATE public.expense_categories SET icon = 'Home' WHERE label = 'Loyer & Infrastructures';
UPDATE public.expense_categories SET icon = 'HeartPulse' WHERE label = 'Santé & Hygiène';
UPDATE public.expense_categories SET icon = 'Truck' WHERE label = 'Transport & Logistique';
