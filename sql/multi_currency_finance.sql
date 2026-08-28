-- ==========================================================
-- ARCHITECTURE FINANCIÈRE MULTI-DEVISES & RÈGLES MÉTIER
-- ==========================================================

-- 1. TABLE DES TAUX DE CHANGE (Audit & Historique)
DROP TABLE IF EXISTS public.exchange_rates CASCADE;
CREATE TABLE IF NOT EXISTS public.exchange_rates (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    school_id UUID NOT NULL,
    rate_usd_to_htg NUMERIC NOT NULL CHECK (rate_usd_to_htg > 0),
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(school_id, effective_date)
);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Exchange rates isolation" ON public.exchange_rates;
CREATE POLICY "Exchange rates isolation" ON public.exchange_rates
    FOR ALL USING (
        school_id::text = (SELECT school_id::text FROM profiles WHERE id = auth.uid())
        OR 
        (SELECT is_super_admin FROM profiles WHERE id = auth.uid()) = true
    )
    WITH CHECK (
        school_id::text = (SELECT school_id::text FROM profiles WHERE id = auth.uid())
        OR 
        (SELECT is_super_admin FROM profiles WHERE id = auth.uid()) = true
    );

-- 2. ÉVOLUTION DES PLANS TARIFAIRES (Frais Divers & Devises)
ALTER TABLE public.fee_plans
ADD COLUMN IF NOT EXISTS misc_fee_usd NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS misc_fee_htg NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_misc_mandatory BOOLEAN DEFAULT false;

-- 3. ÉVOLUTION DES INSCRIPTIONS (Réévaluation de l'écolage par étudiant)
ALTER TABLE public.enrollments
ADD COLUMN IF NOT EXISTS tuition_discount NUMERIC DEFAULT 0, -- Réduction (Bourse)
ADD COLUMN IF NOT EXISTS tuition_addition NUMERIC DEFAULT 0; -- Majoration (Pénalité/Retard)

-- 4. ÉVOLUTION DES PAIEMENTS (Multi-devises & Traçabilité)
-- On renomme l'ancienne colonne 'amount' pour la migration si nécessaire, 
-- mais on va plutôt ajouter les nouvelles colonnes et migrer les données.
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS fee_type TEXT CHECK (fee_type IN ('INSCRIPTION', 'DIVERS', 'SCOLARITE', 'FOURNITURE')),
ADD COLUMN IF NOT EXISTS currency TEXT CHECK (currency IN ('HTG', 'USD')) DEFAULT 'HTG',
ADD COLUMN IF NOT EXISTS exchange_rate_applied NUMERIC,
ADD COLUMN IF NOT EXISTS amount_htg_equivalent NUMERIC;

-- Migration des anciennes données de paiement
UPDATE public.payments 
SET 
    fee_type = CASE WHEN type = 'Scolarité' THEN 'SCOLARITE' ELSE 'SCOLARITE' END,
    currency = 'HTG',
    amount_htg_equivalent = amount,
    exchange_rate_applied = 1
WHERE fee_type IS NULL;

-- 5. FONCTION : OBTENIR LE TAUX DU JOUR
DROP FUNCTION IF EXISTS public.get_current_exchange_rate(TEXT);
CREATE OR REPLACE FUNCTION public.get_current_exchange_rate(p_school_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_rate NUMERIC;
BEGIN
    SELECT rate_usd_to_htg INTO v_rate
    FROM public.exchange_rates
    WHERE school_id = p_school_id
    ORDER BY effective_date DESC, created_at DESC
    LIMIT 1;
    
    -- Taux par défaut si non configuré (sécurité)
    RETURN COALESCE(v_rate, 132.50); 
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. TRIGGER : VALIDATION DE L'ORDRE DE PAIEMENT
CREATE OR REPLACE FUNCTION public.check_payment_order()
RETURNS TRIGGER AS $$
DECLARE
    v_inscription_paid NUMERIC;
    v_inscription_required NUMERIC;
    v_misc_paid NUMERIC;
    v_misc_required_htg NUMERIC;
    v_is_misc_mandatory BOOLEAN;
BEGIN
    -- On ne vérifie que pour les paiements liés à une année académique (Scolarité, Divers, Inscription)
    IF NEW.academic_year_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Récupérer les exigences du plan tarifaire de l'élève
    SELECT fp.inscription_fee, fp.misc_fee_htg, fp.is_misc_mandatory
    INTO v_inscription_required, v_misc_required_htg, v_is_misc_mandatory
    FROM public.enrollments e
    JOIN public.fee_plans fp ON fp.academic_year_id = e.academic_year_id AND fp.class_id = e.class_id
    WHERE e.student_id = NEW.student_id AND e.academic_year_id = NEW.academic_year_id;

    -- Calculer ce qui a déjà été payé en Inscription
    SELECT COALESCE(SUM(amount_htg_equivalent), 0) INTO v_inscription_paid
    FROM public.payments
    WHERE student_id = NEW.student_id AND academic_year_id = NEW.academic_year_id AND fee_type = 'INSCRIPTION';

    -- Calculer ce qui a déjà été payé en Divers
    SELECT COALESCE(SUM(amount_htg_equivalent), 0) INTO v_misc_paid
    FROM public.payments
    WHERE student_id = NEW.student_id AND academic_year_id = NEW.academic_year_id AND fee_type = 'DIVERS';

    -- RÈGLE 1 : L'inscription doit être payée en premier
    IF NEW.fee_type IN ('DIVERS', 'SCOLARITE', 'FOURNITURE') THEN
        IF v_inscription_paid < v_inscription_required THEN
            RAISE EXCEPTION 'Règle stricte : Les frais d''inscription (% HTG) doivent être réglés avant tout autre paiement.', v_inscription_required;
        END IF;
    END IF;

    -- RÈGLE 2 : Les frais divers (si obligatoires) doivent être payés avant la scolarité et les fournitures
    IF NEW.fee_type IN ('SCOLARITE', 'FOURNITURE') AND v_is_misc_mandatory = true THEN
        IF v_misc_paid < v_misc_required_htg THEN
            RAISE EXCEPTION 'Règle stricte : Les frais divers obligatoires doivent être réglés avant l''écolage ou les fournitures.';
        END IF;
    END IF;

    -- RÈGLE 3 : Calcul automatique de l'équivalent HTG si paiement en USD
    IF NEW.currency = 'USD' THEN
        IF NEW.exchange_rate_applied IS NULL THEN
            NEW.exchange_rate_applied := public.get_current_exchange_rate(NEW.school_id);
        END IF;
        NEW.amount_htg_equivalent := NEW.amount * NEW.exchange_rate_applied;
    ELSE
        NEW.exchange_rate_applied := 1;
        NEW.amount_htg_equivalent := NEW.amount;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_payment_order_trigger ON public.payments;
CREATE TRIGGER enforce_payment_order_trigger
BEFORE INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.check_payment_order();

-- 7. Rafraîchissement du cache
NOTIFY pgrst, 'reload schema';
