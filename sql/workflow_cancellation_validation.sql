-- ==========================================================
-- WORKFLOW DE DOUBLE VALIDATION DES ANNULATIONS DE PAIEMENTS
-- ==========================================================

-- 1. Ajout des colonnes de workflow d'annulation sur la table payments
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS cancellation_status TEXT DEFAULT 'NONE' CHECK (cancellation_status IN ('NONE', 'PENDING', 'APPROVED', 'REJECTED')),
ADD COLUMN IF NOT EXISTS cancellation_requested_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancellation_requested_by_name TEXT,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancellation_approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS cancellation_approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancellation_approved_by_name TEXT,
ADD COLUMN IF NOT EXISTS cancellation_rejected_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS cancellation_rejected_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancellation_rejection_reason TEXT;

-- 2. Évolution de la table supply_payments
ALTER TABLE public.supply_payments 
ADD COLUMN IF NOT EXISTS cancellation_status TEXT DEFAULT 'NONE' CHECK (cancellation_status IN ('NONE', 'PENDING', 'APPROVED', 'REJECTED')),
ADD COLUMN IF NOT EXISTS cancellation_requested_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancellation_requested_by_name TEXT,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancellation_approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS cancellation_approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancellation_approved_by_name TEXT,
ADD COLUMN IF NOT EXISTS cancellation_rejected_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS cancellation_rejected_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancellation_rejection_reason TEXT;

-- 3. Mise à jour des index pour accélérer la recherche des annulations en attente
CREATE INDEX IF NOT EXISTS idx_payments_cancellation_status ON public.payments(school_id, cancellation_status);
CREATE INDEX IF NOT EXISTS idx_supply_payments_cancellation_status ON public.supply_payments(cancellation_status);

-- 4. Notification rechargement schéma PostgREST
NOTIFY pgrst, 'reload schema';
