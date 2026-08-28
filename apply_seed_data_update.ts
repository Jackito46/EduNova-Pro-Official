import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';
const supabase = createClient(supabaseUrl, supabaseKey);

const sql = `
CREATE OR REPLACE FUNCTION public.seed_school_data(p_school_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
    v_ay_id UUID;
    v_school_type TEXT;
BEGIN
    SELECT COALESCE(school_type, 'CLASSIC') INTO v_school_type FROM public.schools WHERE id = p_school_id;

    INSERT INTO public.academic_years (school_id, label, is_active, status, start_date, end_date)
    VALUES (p_school_id, '2026-2027', true, 'ACTIVE', '2026-09-01', '2027-06-30')
    ON CONFLICT (school_id, label) DO NOTHING
    RETURNING id INTO v_ay_id;

    IF v_ay_id IS NULL THEN
        SELECT id INTO v_ay_id FROM public.academic_years 
        WHERE school_id = p_school_id AND label = '2026-2027' LIMIT 1;
    END IF;

    UPDATE public.schools
    SET global_settings = jsonb_build_object(
        'currency', 'HTG',
        'school_name', name,
        'academic_year_id', v_ay_id
    )
    WHERE id = p_school_id;

    -- Seed data based on school type
    IF v_school_type = 'UNIVERSITY' THEN
        INSERT INTO public.classes (school_id, name, level)
        VALUES 
            (p_school_id, 'Licence 1 - Informatique', 'LICENCE'),
            (p_school_id, 'Licence 2 - Informatique', 'LICENCE'),
            (p_school_id, 'Licence 3 - Informatique', 'LICENCE'),
            (p_school_id, 'Licence 1 - Sciences Comptables', 'LICENCE'),
            (p_school_id, 'Licence 2 - Sciences Comptables', 'LICENCE'),
            (p_school_id, 'Licence 3 - Sciences Comptables', 'LICENCE'),
            (p_school_id, 'Licence 1 - Gestion des Affaires', 'LICENCE'),
            (p_school_id, 'Licence 2 - Gestion des Affaires', 'LICENCE'),
            (p_school_id, 'Licence 3 - Gestion des Affaires', 'LICENCE'),
            (p_school_id, 'Master 1 - Informatique', 'MASTER'),
            (p_school_id, 'Master 2 - Informatique', 'MASTER')
        ON CONFLICT (school_id, name) DO NOTHING;

        INSERT INTO public.subjects (school_id, name, code, category)
        VALUES 
            (p_school_id, 'Algorithmique et Programmation', 'ALGO101', 'TECH'),
            (p_school_id, 'Bases de Données', 'DBD201', 'TECH'),
            (p_school_id, 'Analyse Mathématique', 'MAT101', 'SCIENCE'),
            (p_school_id, 'Comptabilité Générale', 'COMP101', 'GENERAL'),
            (p_school_id, 'Économie', 'ECO101', 'GENERAL'),
            (p_school_id, 'Management', 'MNG101', 'GENERAL'),
            (p_school_id, 'Anglais Technique', 'ANG101', 'LANGUAGES'),
            (p_school_id, 'Communication', 'COM101', 'LANGUAGES')
        ON CONFLICT (school_id, code) DO NOTHING;

    ELSIF v_school_type = 'PROFESSIONAL' THEN
        INSERT INTO public.classes (school_id, name, level)
        VALUES 
            (p_school_id, 'Cuisine et Pâtisserie', 'CERTIFICAT'),
            (p_school_id, 'Service de Bar & Restauration', 'CERTIFICAT'),
            (p_school_id, 'Coiffure & Esthétique', 'CERTIFICAT'),
            (p_school_id, 'Coupe et Couture', 'CERTIFICAT'),
            (p_school_id, 'Dépannage Informatique', 'CERTIFICAT'),
            (p_school_id, 'Réseaux Informatiques', 'CERTIFICAT'),
            (p_school_id, 'Plomberie & Hydraulique', 'CERTIFICAT'),
            (p_school_id, 'Électricité Bâtiment', 'CERTIFICAT'),
            (p_school_id, 'Mécanique Auto', 'CERTIFICAT')
        ON CONFLICT (school_id, name) DO NOTHING;

        INSERT INTO public.subjects (school_id, name, code, category, description)
        VALUES 
            -- Cuisine, Bar & Restauration
            (p_school_id, 'Art Culinaire & Gastronomie', 'CUIS-101', 'GENERAL', 'Cuisine et préparation culinaire de niveau professionnel'),
            (p_school_id, 'Service de Bar & Restauration', 'BAR-REST', 'GENERAL', 'Service à la clientèle, mixologie et gestion des bars'),
            (p_school_id, 'Techniques de Pâtisserie & Boulangerie', 'PATISS-101', 'GENERAL', 'Farines, pâtes, gâteaux et desserts professionnels'),
            (p_school_id, 'Hygiène et Sécurité Alimentaire', 'HYG-ALIM', 'GENERAL', 'Normes sanitaires, conservation et chaîne du froid'),
            (p_school_id, 'Oenologie & Sommellerie', 'OENO-101', 'GENERAL', 'Connaissance des vins et spiritueux'),
            -- Beauté & Esthétique
            (p_school_id, 'Esthétique Professionnelle & Soins', 'ESTH101', 'GENERAL', 'Soins de la peau, traitements corporels'),
            (p_school_id, 'Techniques de Coiffure & Coupe', 'CHEF-COIF', 'GENERAL', 'Coupe de cheveux, brushing, coloration et coiffure'),
            (p_school_id, 'Art du Maquillage', 'MAQ-PEAU', 'GENERAL', 'Théorie des couleurs et maquillage professionnel'),
            (p_school_id, 'Manucure, Pédicure & Onglerie', 'ONGLE', 'GENERAL', 'Soins des mains et pieds, pose de faux ongles'),
            -- Informatique & Secrétariat
            (p_school_id, 'Maintenance Matériel Informatique', 'MAINT101', 'TECH', 'Dépannage, montage et entretien des PC'),
            (p_school_id, 'Fondamentaux Réseaux & Câblage', 'RES101', 'TECH', 'Concepts réseaux, adresses IP et câblage RJ45'),
            (p_school_id, 'Bureautique & Secrétariat', 'BURO-SEC', 'TECH', 'Gestion administrative, accueil et Word'),
            (p_school_id, 'Tableaux Financiers & Excel', 'EXCEL-PRO', 'TECH', 'Traitement de données sous MS Excel'),
            (p_school_id, 'Initiation Web & Réseaux Sociaux', 'WEB-INIT', 'TECH', 'Création de sites simples et marketing digital'),
            -- Technique générale & Construction
            (p_school_id, 'Électricité Bâtiment', 'ELEC-BAT', 'TECH', 'Montages simples, va-et-vient, installations résidentielles'),
            (p_school_id, 'Électricité Industrielle', 'ELEC-IND', 'TECH', 'Moteurs thermiques, triphasé et armoires de contrôle'),
            (p_school_id, 'Pratique Plomberie & Sanitaire', 'PLOM101', 'TECH', 'Canalisations, sanitaires, étanchéité et raccordements'),
            (p_school_id, 'Climatisation & Réfrigération', 'CLIM-REF', 'TECH', 'Systèmes de conditionnement d''air et congélateurs'),
            -- Mécanique
            (p_school_id, 'Moteurs à Combustion Interne', 'MEC101', 'TECH', 'Fonctionnement des moteurs essence et diesel'),
            (p_school_id, 'Électricité & Diagnostic Automobile', 'AUTO-DIAG', 'TECH', 'Électronique embarquée et scanneur OBD'),
            (p_school_id, 'Organes de Transmission & Freinage', 'AUTO-MECA', 'TECH', 'Systèmes de freinage, boîtes et suspension'),
            -- Coupe et Couture
            (p_school_id, 'Coupe & Couture de Base', 'COUT-101', 'GENERAL', 'Patronage de base, points de couture et machines'),
            (p_school_id, 'Modélisme & Stylisme de Mode', 'STYL-101', 'GENERAL', 'Création de vêtements sur mesure, étude des tissus'),
            -- Gestion entrepreneuriale
            (p_school_id, 'Comptabilité Simplifiée & Facturation', 'COMP-SIMPL', 'GENERAL', 'Gestion de caisse et facturation d''atelier'),
            (p_school_id, 'Création de Micro-Entreprise', 'ENTREP-PRO', 'GENERAL', 'Esprit d''entreprise, plans d''affaires simples et marketing de proximité')
        ON CONFLICT (school_id, code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category;

    ELSE
        -- Default to 'CLASSIC' mapping
        INSERT INTO public.classes (school_id, name, level)
        VALUES 
            (p_school_id, 'Petite Section', 'MATERNELLE'),
            (p_school_id, 'Moyenne Section', 'MATERNELLE'),
            (p_school_id, 'Grande Section', 'MATERNELLE'),
            (p_school_id, '1ère AF', 'FONDAMENTALE'),
            (p_school_id, '2ème AF', 'FONDAMENTALE'),
            (p_school_id, '3ème AF', 'FONDAMENTALE'),
            (p_school_id, '4ème AF', 'FONDAMENTALE'),
            (p_school_id, '5ème AF', 'FONDAMENTALE'),
            (p_school_id, '6ème AF', 'FONDAMENTALE'),
            (p_school_id, '7ème AF', 'FONDAMENTALE'),
            (p_school_id, '8ème AF', 'FONDAMENTALE'),
            (p_school_id, '9ème AF', 'FONDAMENTALE'),
            (p_school_id, 'NS1', 'SECONDAIRE'),
            (p_school_id, 'NS2', 'SECONDAIRE'),
            (p_school_id, 'NS3', 'SECONDAIRE'),
            (p_school_id, 'NS4', 'SECONDAIRE')
        ON CONFLICT (school_id, name) DO NOTHING;

        INSERT INTO public.subjects (school_id, name, code, category)
        VALUES 
            (p_school_id, 'Français', 'FRA', 'LANGUAGES'),
            (p_school_id, 'Mathématiques', 'MAT', 'SCIENCE'),
            (p_school_id, 'Créole', 'CRE', 'LANGUAGES'),
            (p_school_id, 'Anglais', 'ANG', 'LANGUAGES'),
            (p_school_id, 'Sciences Sociales', 'SS', 'GENERAL'),
            (p_school_id, 'Sciences Physiques', 'SP', 'SCIENCE'),
            (p_school_id, 'Biologie', 'BIO', 'SCIENCE'),
            (p_school_id, 'Chimie', 'CHI', 'SCIENCE'),
            (p_school_id, 'Informatique', 'INF', 'TECH')
        ON CONFLICT (school_id, code) DO NOTHING;

        -- Seed standard fee plans for classic classes
        INSERT INTO public.fee_plans (school_id, academic_year_id, class_id, inscription_fee, tuition_fee)
        SELECT 
            c.school_id,
            v_ay_id as academic_year_id,
            c.id as class_id,
            CASE 
                WHEN c.level = 'MATERNELLE' THEN 5000
                WHEN c.level = 'FONDAMENTALE' THEN 7500
                WHEN c.level = 'SECONDAIRE' THEN 10000
                ELSE 5000
            END as inscription_fee,
            CASE 
                WHEN c.level = 'MATERNELLE' THEN 25000
                WHEN c.level = 'FONDAMENTALE' THEN 35000
                WHEN c.level = 'SECONDAIRE' THEN 50000
                ELSE 20000
            END as tuition_fee
        FROM public.classes c
        WHERE c.school_id = p_school_id::text
        ON CONFLICT (academic_year_id, class_id) DO NOTHING;

        -- Seed supply catalog for classic
        INSERT INTO public.supply_catalog (school_id, label, unit_price, category)
        VALUES 
            (p_school_id::text, 'Kit Uniforme Complet (3 pièces)', 4500, 'Uniforme'),
            (p_school_id::text, 'Polo de l''école', 1500, 'Uniforme'),
            (p_school_id::text, 'Pack Livres Fondamentale 1-6', 12500, 'Manuel'),
            (p_school_id::text, 'Pack Livres Secondaire', 15000, 'Manuel'),
            (p_school_id::text, 'Carnet de Correspondance Officiel', 750, 'Fourniture'),
            (p_school_id::text, 'Ecusson de l''école', 250, 'Fourniture')
        ON CONFLICT DO NOTHING;

    END IF;

END; $function$;
`;

async function apply() {
    console.log("Applying script...");
    const { error } = await supabase.rpc('apply_ddl', { v_sql: sql });
    console.log("Error:", error);
}
apply();
