-- 1. Mettre à jour les employés existants pour utiliser les rôles standards (simples)
UPDATE public.staff SET role = 'Enseignant' WHERE role IN ('Enseignant Titulaire', 'Enseignant Vacationnaire');
UPDATE public.staff SET role = 'Directeur' WHERE role = 'Directeur / Directrice';
UPDATE public.staff SET role = 'Comptable' WHERE role = 'Comptable / Économe';
UPDATE public.staff SET role = 'Agent d''entretien' WHERE role = 'Personnel d''entretien';

-- 2. Supprimer les doublons exacts dans staff_roles (même label, même school_id)
DELETE FROM public.staff_roles a USING public.staff_roles b
WHERE a.id > b.id AND a.label = b.label AND COALESCE(a.school_id::text, '') = COALESCE(b.school_id::text, '');

-- 2.5 Supprimer les rôles spécifiques à l'école s'il existe déjà un rôle global identique
DELETE FROM public.staff_roles a USING public.staff_roles b
WHERE a.label = b.label AND a.school_id IS NOT NULL AND b.school_id IS NULL;

-- 3. Supprimer les rôles redondants de la liste déroulante
DELETE FROM public.staff_roles 
WHERE label IN (
    'Enseignant Titulaire', 
    'Enseignant Vacationnaire', 
    'Directeur / Directrice', 
    'Comptable / Économe',
    'Personnel d''entretien'
);
