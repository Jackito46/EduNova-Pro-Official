-- Ajout du support multi-devises complet pour tous les types de frais
ALTER TABLE public.fee_plans
ADD COLUMN IF NOT EXISTS inscription_fee_usd NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS reenrollment_fee_usd NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tuition_fee_usd NUMERIC DEFAULT 0;

-- Mise à jour de la fonction de validation pour prendre en compte les nouveaux champs USD
-- (Optionnel si on gère tout côté client, mais plus sûr côté serveur)
