-- ==========================================================
-- SCRIPT DE RÉINITIALISATION DE LA PAIE - EduNova Pro
-- ==========================================================

-- Ce script vide toutes les données de paie (périodes et fiches)
-- pour vous permettre de recommencer les tests à zéro.

-- 1. Supprimer toutes les fiches de paie
DELETE FROM public.payroll_slips;

-- 2. Supprimer toutes les périodes de paie
DELETE FROM public.payroll_periods;

-- Note : La suppression des périodes entraîne généralement 
-- la suppression des fiches de paie associées grâce au CASCADE,
-- mais nous supprimons les deux explicitement par sécurité.
