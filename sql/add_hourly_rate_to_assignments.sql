-- Ajouter la colonne hourly_rate à la table staff_assignments
ALTER TABLE public.staff_assignments ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC DEFAULT 0;

-- Mettre à jour les assignations existantes avec le taux horaire de base du professeur (s'il est vacationnaire)
UPDATE public.staff_assignments sa
SET hourly_rate = s.amount
FROM public.staff s
WHERE sa.staff_id = s.id AND s.pay_type = 'Horaire' AND sa.hourly_rate = 0;
