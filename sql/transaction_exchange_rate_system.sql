-- ==============================================================================
-- SYSTÈME DE JOURNALISATION DES TAUX DE CHANGE PAR TRANSACTION & CALCULS HISTORIQUES
-- Objectif :
-- 1. Journaliser les taux de change appliqués pour CHAQUE transaction (paiement).
-- 2. Sceller définitivement la parité financière (HTG <-> USD) au moment du règlement.
-- 3. Garantir que le solde dû d'un élève soit calculé sur la base historique réelle
--    du versement et non sur un taux flottant futur (élimination totale des dettes fantômes).
-- ==============================================================================

-- 1. TABLE DU JOURNAL HISTORIQUE DES TAUX PAR TRANSACTION
CREATE TABLE IF NOT EXISTS public.transaction_exchange_rate_journal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    school_id UUID NOT NULL,
    student_id UUID NOT NULL,
    academic_year_id UUID,
    fee_type TEXT,
    currency TEXT NOT NULL CHECK (currency IN ('HTG', 'USD')),
    amount_paid NUMERIC NOT NULL,
    exchange_rate_applied NUMERIC NOT NULL CHECK (exchange_rate_applied > 0),
    amount_htg_equivalent NUMERIC NOT NULL,
    amount_usd_equivalent NUMERIC NOT NULL,
    rate_source TEXT NOT NULL DEFAULT 'SEALED_TRANSACTION',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_rate_journal_payment UNIQUE (payment_id)
);

-- Index d'optimisation
CREATE INDEX IF NOT EXISTS idx_rate_journal_payment_id ON public.transaction_exchange_rate_journal(payment_id);
CREATE INDEX IF NOT EXISTS idx_rate_journal_student_year ON public.transaction_exchange_rate_journal(student_id, academic_year_id);
CREATE INDEX IF NOT EXISTS idx_rate_journal_school_id ON public.transaction_exchange_rate_journal(school_id);
CREATE INDEX IF NOT EXISTS idx_rate_journal_created_at ON public.transaction_exchange_rate_journal(created_at DESC);

-- Isolation RLS Multi-Tenant
ALTER TABLE public.transaction_exchange_rate_journal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Rate journal tenant isolation" ON public.transaction_exchange_rate_journal;

CREATE POLICY "Rate journal tenant isolation" ON public.transaction_exchange_rate_journal
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

-- 2. FONCTION DE RÉCUPÉRATION DU TAUX DU JOUR FIABLE AVEC FALLBACK
CREATE OR REPLACE FUNCTION public.get_current_exchange_rate(p_school_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_rate NUMERIC;
BEGIN
    IF p_school_id IS NOT NULL THEN
        SELECT rate_usd_to_htg INTO v_rate
        FROM public.exchange_rates
        WHERE school_id = p_school_id
        ORDER BY effective_date DESC, created_at DESC
        LIMIT 1;
    END IF;
    
    -- Taux standard de référence si non configuré
    RETURN COALESCE(v_rate, 140.00);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. TRIGGER BEFORE SUR LES PAIEMENTS : SCELLER LE TAUX HISTORIQUE RÉEL
CREATE OR REPLACE FUNCTION public.seal_payment_exchange_rate_before()
RETURNS TRIGGER AS $$
DECLARE
    v_active_rate NUMERIC;
BEGIN
    -- Obtenir le taux de change de référence de l'établissement
    v_active_rate := public.get_current_exchange_rate(NEW.school_id);

    -- Cas 1 : Paiement en USD
    IF NEW.currency = 'USD' THEN
        -- Si aucun taux valide fourni, utiliser le taux du jour
        IF NEW.exchange_rate_applied IS NULL OR NEW.exchange_rate_applied <= 1 THEN
            NEW.exchange_rate_applied := v_active_rate;
        END IF;
        
        -- Sceller l'équivalent en Gourdes au taux réel historique
        NEW.amount_htg_equivalent := ROUND((NEW.amount * NEW.exchange_rate_applied)::numeric, 2);

    -- Cas 2 : Paiement en HTG
    ELSE
        -- Pour un paiement en Gourdes, l'équivalent HTG est le montant lui-même
        NEW.amount_htg_equivalent := NEW.amount;

        -- CRUCIAL : On ne force JAMAIS le taux à 1 !
        -- Si un taux a été spécifié par le client (ex: taux de conversion de la scolarité USD), on le préserve.
        -- Sinon, on horodate le taux actif de l'école pour savoir quelle quote-part USD a été amortie.
        IF NEW.exchange_rate_applied IS NULL OR NEW.exchange_rate_applied <= 1 THEN
            NEW.exchange_rate_applied := v_active_rate;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_seal_payment_rate_before ON public.payments;
CREATE TRIGGER trg_seal_payment_rate_before
BEFORE INSERT OR UPDATE OF amount, currency, exchange_rate_applied, school_id ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.seal_payment_exchange_rate_before();

-- 4. TRIGGER AFTER SUR LES PAIEMENTS : JOURNALISER AUTOMATIQUEMENT LA TRANSACTION
CREATE OR REPLACE FUNCTION public.log_payment_exchange_rate_after()
RETURNS TRIGGER AS $$
DECLARE
    v_usd_equiv NUMERIC;
    v_rate NUMERIC;
BEGIN
    v_rate := COALESCE(NEW.exchange_rate_applied, public.get_current_exchange_rate(NEW.school_id), 140.00);
    IF v_rate <= 0 THEN
        v_rate := 140.00;
    END IF;

    -- Calcul de la contre-valeur USD scellée à l'instant de la transaction
    IF NEW.currency = 'USD' THEN
        v_usd_equiv := NEW.amount;
    ELSE
        v_usd_equiv := ROUND((NEW.amount / v_rate)::numeric, 4);
    END IF;

    -- Insertion ou mise à jour idempotente dans le journal d'audit
    INSERT INTO public.transaction_exchange_rate_journal (
        payment_id,
        school_id,
        student_id,
        academic_year_id,
        fee_type,
        currency,
        amount_paid,
        exchange_rate_applied,
        amount_htg_equivalent,
        amount_usd_equivalent,
        rate_source,
        notes,
        created_at
    ) VALUES (
        NEW.id,
        NEW.school_id,
        NEW.student_id,
        NEW.academic_year_id,
        NEW.fee_type,
        NEW.currency,
        NEW.amount,
        v_rate,
        COALESCE(NEW.amount_htg_equivalent, NEW.amount),
        v_usd_equiv,
        CASE 
            WHEN NEW.currency = 'USD' THEN 'TRANSACTION_USD_SEALED'
            ELSE 'TRANSACTION_HTG_RATE_SEALED'
        END,
        'Taux scellé lors de la transaction sans dette résiduelle',
        COALESCE(NEW.created_at, NOW())
    )
    ON CONFLICT (payment_id) DO UPDATE SET
        school_id = EXCLUDED.school_id,
        student_id = EXCLUDED.student_id,
        academic_year_id = EXCLUDED.academic_year_id,
        fee_type = EXCLUDED.fee_type,
        currency = EXCLUDED.currency,
        amount_paid = EXCLUDED.amount_paid,
        exchange_rate_applied = EXCLUDED.exchange_rate_applied,
        amount_htg_equivalent = EXCLUDED.amount_htg_equivalent,
        amount_usd_equivalent = EXCLUDED.amount_usd_equivalent,
        created_at = EXCLUDED.created_at;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_payment_rate_after ON public.payments;
CREATE TRIGGER trg_log_payment_rate_after
AFTER INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.log_payment_exchange_rate_after();

-- 5. MISE À JOUR DE check_payment_order() POUR PRÉSERVER LE TAUX MULTI-DEVISES
CREATE OR REPLACE FUNCTION public.check_payment_order()
RETURNS TRIGGER AS $$
DECLARE
    v_inscription_paid NUMERIC;
    v_inscription_required NUMERIC;
    v_misc_paid NUMERIC;
    v_misc_required_htg NUMERIC;
    v_is_misc_mandatory BOOLEAN;
    v_active_rate NUMERIC;
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

    -- Calculer ce qui a déjà été payé en Inscription (en tenant compte de la base HTG réelle)
    SELECT COALESCE(SUM(amount_htg_equivalent), 0) INTO v_inscription_paid
    FROM public.payments
    WHERE student_id = NEW.student_id 
      AND academic_year_id = NEW.academic_year_id 
      AND fee_type = 'INSCRIPTION'
      AND (status IS NULL OR status NOT IN ('ANNULE', 'ANNULÉ'));

    -- Calculer ce qui a déjà été payé en Divers
    SELECT COALESCE(SUM(amount_htg_equivalent), 0) INTO v_misc_paid
    FROM public.payments
    WHERE student_id = NEW.student_id 
      AND academic_year_id = NEW.academic_year_id 
      AND fee_type = 'DIVERS'
      AND (status IS NULL OR status NOT IN ('ANNULE', 'ANNULÉ'));

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

    -- RÈGLE 3 : Préservation et scellage du taux historique
    v_active_rate := public.get_current_exchange_rate(NEW.school_id);
    IF NEW.currency = 'USD' THEN
        IF NEW.exchange_rate_applied IS NULL OR NEW.exchange_rate_applied <= 1 THEN
            NEW.exchange_rate_applied := v_active_rate;
        END IF;
        NEW.amount_htg_equivalent := ROUND((NEW.amount * NEW.exchange_rate_applied)::numeric, 2);
    ELSE
        -- Ne plus écraser à 1 !
        IF NEW.exchange_rate_applied IS NULL OR NEW.exchange_rate_applied <= 1 THEN
            NEW.exchange_rate_applied := v_active_rate;
        END IF;
        NEW.amount_htg_equivalent := NEW.amount;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. FONCTION DE CALCUL DES SOLDES RÉELS BASÉE SUR L'HISTORIQUE SCELLÉ
-- Calcule le solde et la dette réelle sans distorsion par le taux flottant
CREATE OR REPLACE FUNCTION public.get_student_real_balance(
    p_student_id UUID,
    p_academic_year_id UUID DEFAULT NULL::UUID,
    p_school_id UUID DEFAULT NULL::UUID
)
RETURNS JSONB AS $$
DECLARE
    v_current_rate NUMERIC;
    v_academic_year_id UUID := p_academic_year_id;
    v_school_id UUID := p_school_id;
    
    -- Variables Plan
    v_class_id UUID;
    v_tuition_htg NUMERIC := 0;
    v_tuition_usd NUMERIC := 0;
    v_misc_htg NUMERIC := 0;
    v_misc_usd NUMERIC := 0;
    v_is_misc_mandatory BOOLEAN := false;
    v_inscription_htg NUMERIC := 0;
    v_inscription_usd NUMERIC := 0;
    v_reenrollment_htg NUMERIC := 0;
    v_reenrollment_usd NUMERIC := 0;
    
    -- Variables Remises
    v_tuition_discount NUMERIC := 0;
    v_tuition_addition NUMERIC := 0;
    v_student_discount NUMERIC := 0;
    v_has_previous_enrollment BOOLEAN := false;
    
    -- Variables Catégories (Due, Paid USD, Paid HTG, Remaining)
    v_adm_due_usd NUMERIC := 0;
    v_adm_due_htg NUMERIC := 0;
    v_adm_paid_usd NUMERIC := 0;
    v_adm_paid_htg NUMERIC := 0;
    v_adm_rem_usd NUMERIC := 0;
    v_adm_rem_htg NUMERIC := 0;
    v_adm_is_paid BOOLEAN := false;

    v_misc_due_usd NUMERIC := 0;
    v_misc_due_htg NUMERIC := 0;
    v_misc_paid_usd NUMERIC := 0;
    v_misc_paid_htg NUMERIC := 0;
    v_misc_rem_usd NUMERIC := 0;
    v_misc_rem_htg NUMERIC := 0;
    v_misc_is_paid BOOLEAN := false;

    v_scol_due_usd NUMERIC := 0;
    v_scol_due_htg NUMERIC := 0;
    v_scol_paid_usd NUMERIC := 0;
    v_scol_paid_htg NUMERIC := 0;
    v_scol_rem_usd NUMERIC := 0;
    v_scol_rem_htg NUMERIC := 0;
    v_scol_is_paid BOOLEAN := false;

    v_adhoc_due_htg NUMERIC := 0;
    v_adhoc_paid_htg NUMERIC := 0;
    v_adhoc_rem_htg NUMERIC := 0;

    v_total_debt_htg NUMERIC := 0;
    v_total_paid_htg NUMERIC := 0;

    -- Variables de boucle paiements
    r_pay RECORD;
    p_rate NUMERIC;
    p_amount NUMERIC;
    p_usd_val NUMERIC;
    p_htg_val NUMERIC;
BEGIN
    -- 1. Résoudre le school_id si non fourni
    IF v_school_id IS NULL THEN
        SELECT school_id INTO v_school_id FROM public.students WHERE id = p_student_id;
    END IF;

    -- 2. Résoudre le taux de change actuel de l'école
    v_current_rate := public.get_current_exchange_rate(v_school_id);

    -- 3. Résoudre l'année académique active si non fournie
    IF v_academic_year_id IS NULL THEN
        SELECT e.academic_year_id INTO v_academic_year_id
        FROM public.enrollments e
        JOIN public.academic_years ay ON e.academic_year_id = ay.id
        WHERE e.student_id = p_student_id AND ay.status = 'ACTIVE'
        ORDER BY ay.start_date DESC LIMIT 1;

        IF v_academic_year_id IS NULL THEN
            SELECT e.academic_year_id INTO v_academic_year_id
            FROM public.enrollments e
            WHERE e.student_id = p_student_id
            ORDER BY e.created_at DESC LIMIT 1;
        END IF;
    END IF;

    -- 4. Vérifier s'il a des inscriptions antérieures (distinction Inscription vs Réinscription)
    SELECT EXISTS (
        SELECT 1 FROM public.enrollments 
        WHERE student_id = p_student_id 
          AND academic_year_id IS DISTINCT FROM v_academic_year_id
    ) INTO v_has_previous_enrollment;

    -- 5. Charger l'inscription et le plan tarifaire
    IF v_academic_year_id IS NOT NULL THEN
        SELECT 
            e.class_id, 
            COALESCE(e.tuition_discount, 0), 
            COALESCE(e.tuition_addition, 0),
            COALESCE(s.discount_amount, 0),
            COALESCE(fp.tuition_fee, 0),
            COALESCE(fp.tuition_fee_usd, 0),
            COALESCE(fp.misc_fee_htg, 0),
            COALESCE(fp.misc_fee_usd, 0),
            COALESCE(fp.is_misc_mandatory, false),
            COALESCE(fp.inscription_fee, 0),
            COALESCE(fp.inscription_fee_usd, 0),
            COALESCE(fp.reenrollment_fee, 0),
            COALESCE(fp.reenrollment_fee_usd, 0)
        INTO 
            v_class_id, 
            v_tuition_discount, 
            v_tuition_addition,
            v_student_discount,
            v_tuition_htg,
            v_tuition_usd,
            v_misc_htg,
            v_misc_usd,
            v_is_misc_mandatory,
            v_inscription_htg,
            v_inscription_usd,
            v_reenrollment_htg,
            v_reenrollment_usd
        FROM public.enrollments e
        JOIN public.students s ON e.student_id = s.id
        LEFT JOIN public.fee_plans fp ON e.class_id = fp.class_id AND e.academic_year_id = fp.academic_year_id
        WHERE e.student_id = p_student_id AND e.academic_year_id = v_academic_year_id;
    END IF;

    -- Configurer les exigences Inscription / Réinscription
    IF v_has_previous_enrollment THEN
        v_adm_due_htg := v_reenrollment_htg;
        v_adm_due_usd := v_reenrollment_usd;
    ELSE
        v_adm_due_htg := v_inscription_htg;
        v_adm_due_usd := v_inscription_usd;
    END IF;

    -- Configurer les exigences Frais Divers
    IF v_is_misc_mandatory THEN
        v_misc_due_htg := v_misc_htg;
        v_misc_due_usd := v_misc_usd;
    END IF;

    -- Configurer les exigences Scolarité (avec bourses et majorations)
    v_scol_due_htg := GREATEST(0, (v_tuition_htg + v_tuition_addition) - (v_tuition_discount + v_student_discount));
    v_scol_due_usd := v_tuition_usd;

    -- 6. Parcourir les paiements validés avec leur taux historique scellé
    FOR r_pay IN 
        SELECT 
            p.id,
            p.fee_type,
            p.type,
            p.nature,
            p.currency,
            p.amount,
            COALESCE(j.exchange_rate_applied, p.exchange_rate_applied, v_current_rate) AS rate,
            COALESCE(j.amount_htg_equivalent, p.amount_htg_equivalent, 
                CASE WHEN p.currency = 'USD' THEN p.amount * COALESCE(p.exchange_rate_applied, v_current_rate) ELSE p.amount END
            ) AS htg_val,
            p.ad_hoc_campaign_id
        FROM public.payments p
        LEFT JOIN public.transaction_exchange_rate_journal j ON p.id = j.payment_id
        WHERE p.student_id = p_student_id
          AND (v_academic_year_id IS NULL OR p.academic_year_id = v_academic_year_id)
          AND (p.status IS NULL OR p.status NOT IN ('ANNULE', 'ANNULÉ'))
          AND (p.payment_method IS NULL OR (p.payment_method NOT ILIKE '%EN ATTENTE%' AND p.payment_method NOT ILIKE '%REJETÉ%'))
    LOOP
        p_amount := COALESCE(r_pay.amount, 0);
        p_rate := CASE WHEN r_pay.rate > 1 THEN r_pay.rate ELSE v_current_rate END;
        p_htg_val := COALESCE(r_pay.htg_val, p_amount);
        
        -- Contre-valeur USD scellée à la transaction
        IF r_pay.currency = 'USD' THEN
            p_usd_val := p_amount;
        ELSE
            p_usd_val := p_amount / p_rate;
        END IF;

        -- A. Frais d'admission
        IF r_pay.fee_type = 'INSCRIPTION' 
           OR r_pay.nature ILIKE '%inscription%' 
           OR r_pay.nature ILIKE '%admission%' 
           OR r_pay.nature ILIKE '%réinscription%' THEN
            v_adm_paid_usd := v_adm_paid_usd + p_usd_val;
            v_adm_paid_htg := v_adm_paid_htg + p_htg_val;

        -- B. Frais Divers
        ELSIF r_pay.fee_type = 'DIVERS' 
              OR r_pay.nature ILIKE '%divers%' THEN
            v_misc_paid_usd := v_misc_paid_usd + p_usd_val;
            v_misc_paid_htg := v_misc_paid_htg + p_htg_val;

        -- C. Campagnes Ad Hoc
        ELSIF r_pay.ad_hoc_campaign_id IS NOT NULL 
              OR r_pay.fee_type = 'AD_HOC' 
              OR r_pay.nature ILIKE '%adhoc%' THEN
            v_adhoc_paid_htg := v_adhoc_paid_htg + p_htg_val;

        -- D. Scolarité (par défaut)
        ELSE
            v_scol_paid_usd := v_scol_paid_usd + p_usd_val;
            v_scol_paid_htg := v_scol_paid_htg + p_htg_val;
        END IF;

        v_total_paid_htg := v_total_paid_htg + p_htg_val;
    END LOOP;

    -- 7. Calcul d'extinction des obligations sans distorsion de taux de change
    
    -- A. Inscription
    IF v_adm_due_usd > 0 THEN
        IF (v_adm_due_usd - v_adm_paid_usd) <= 0.10 
           OR v_adm_paid_usd >= (v_adm_due_usd - 3.00) 
           OR (v_adm_due_usd > 0 AND (v_adm_paid_usd / v_adm_due_usd) >= 0.96) THEN
            v_adm_is_paid := true;
            v_adm_rem_usd := 0;
            v_adm_rem_htg := 0;
        ELSE
            v_adm_rem_usd := GREATEST(0, v_adm_due_usd - v_adm_paid_usd);
            v_adm_rem_htg := ROUND((v_adm_rem_usd * v_current_rate)::numeric, 0);
        END IF;
    ELSE
        IF (v_adm_due_htg - v_adm_paid_htg) <= 50.0 
           OR (v_adm_due_htg > 0 AND v_adm_paid_htg >= (v_adm_due_htg - 50.0)) THEN
            v_adm_is_paid := true;
            v_adm_rem_htg := 0;
            v_adm_rem_usd := 0;
        ELSE
            v_adm_rem_htg := GREATEST(0, v_adm_due_htg - v_adm_paid_htg);
            v_adm_rem_usd := ROUND((v_adm_rem_htg / v_current_rate)::numeric, 2);
        END IF;
    END IF;

    -- B. Frais Divers
    IF v_misc_due_usd > 0 THEN
        IF (v_misc_due_usd - v_misc_paid_usd) <= 0.10 
           OR v_misc_paid_usd >= (v_misc_due_usd - 3.00) 
           OR (v_misc_due_usd > 0 AND (v_misc_paid_usd / v_misc_due_usd) >= 0.96) THEN
            v_misc_is_paid := true;
            v_misc_rem_usd := 0;
            v_misc_rem_htg := 0;
        ELSE
            v_misc_rem_usd := GREATEST(0, v_misc_due_usd - v_misc_paid_usd);
            v_misc_rem_htg := ROUND((v_misc_rem_usd * v_current_rate)::numeric, 0);
        END IF;
    ELSE
        IF (v_misc_due_htg - v_misc_paid_htg) <= 50.0 
           OR (v_misc_due_htg > 0 AND v_misc_paid_htg >= (v_misc_due_htg - 50.0)) THEN
            v_misc_is_paid := true;
            v_misc_rem_htg := 0;
            v_misc_rem_usd := 0;
        ELSE
            v_misc_rem_htg := GREATEST(0, v_misc_due_htg - v_misc_paid_htg);
            v_misc_rem_usd := ROUND((v_misc_rem_htg / v_current_rate)::numeric, 2);
        END IF;
    END IF;

    -- C. Scolarité
    IF v_scol_due_usd > 0 THEN
        IF (v_scol_due_usd - v_scol_paid_usd) <= 0.10 
           OR v_scol_paid_usd >= (v_scol_due_usd - 3.00) 
           OR (v_scol_due_usd > 0 AND (v_scol_paid_usd / v_scol_due_usd) >= 0.96) THEN
            v_scol_is_paid := true;
            v_scol_rem_usd := 0;
            v_scol_rem_htg := 0;
        ELSE
            v_scol_rem_usd := GREATEST(0, v_scol_due_usd - v_scol_paid_usd);
            v_scol_rem_htg := ROUND((v_scol_rem_usd * v_current_rate)::numeric, 0);
        END IF;
    ELSE
        IF (v_scol_due_htg - v_scol_paid_htg) <= 100.0 
           OR (v_scol_due_htg > 0 AND v_scol_paid_htg >= (v_scol_due_htg - 100.0)) THEN
            v_scol_is_paid := true;
            v_scol_rem_htg := 0;
            v_scol_rem_usd := 0;
        ELSE
            v_scol_rem_htg := GREATEST(0, v_scol_due_htg - v_scol_paid_htg);
            v_scol_rem_usd := ROUND((v_scol_rem_htg / v_current_rate)::numeric, 2);
        END IF;
    END IF;

    -- D. Dettes de campagnes ad hoc
    IF v_academic_year_id IS NOT NULL THEN
        SELECT COALESCE(SUM(
            CASE 
                WHEN c.currency = 'USD' THEN c.amount * v_current_rate 
                ELSE c.amount 
            END
        ), 0) INTO v_adhoc_due_htg
        FROM public.student_ad_hoc_fees s
        JOIN public.ad_hoc_campaigns c ON s.campaign_id = c.id
        WHERE s.student_id = p_student_id
          AND c.academic_year_id = v_academic_year_id;
          
        v_adhoc_rem_htg := GREATEST(0, v_adhoc_due_htg - v_adhoc_paid_htg);
    END IF;

    -- Total dette réelle en Gourdes
    v_total_debt_htg := v_adm_rem_htg + v_misc_rem_htg + v_scol_rem_htg + v_adhoc_rem_htg;

    RETURN jsonb_build_object(
        'student_id', p_student_id,
        'academic_year_id', v_academic_year_id,
        'active_exchange_rate', v_current_rate,
        'total_debt_htg', v_total_debt_htg,
        'total_paid_htg', v_total_paid_htg,
        'categories', jsonb_build_object(
            'admission', jsonb_build_object(
                'due_htg', v_adm_due_htg,
                'due_usd', v_adm_due_usd,
                'paid_htg', v_adm_paid_htg,
                'paid_usd', ROUND(v_adm_paid_usd::numeric, 2),
                'remaining_htg', v_adm_rem_htg,
                'remaining_usd', ROUND(v_adm_rem_usd::numeric, 2),
                'is_paid', v_adm_is_paid
            ),
            'misc', jsonb_build_object(
                'due_htg', v_misc_due_htg,
                'due_usd', v_misc_due_usd,
                'paid_htg', v_misc_paid_htg,
                'paid_usd', ROUND(v_misc_paid_usd::numeric, 2),
                'remaining_htg', v_misc_rem_htg,
                'remaining_usd', ROUND(v_misc_rem_usd::numeric, 2),
                'is_paid', v_misc_is_paid
            ),
            'tuition', jsonb_build_object(
                'due_htg', v_scol_due_htg,
                'due_usd', v_scol_due_usd,
                'paid_htg', v_scol_paid_htg,
                'paid_usd', ROUND(v_scol_paid_usd::numeric, 2),
                'remaining_htg', v_scol_rem_htg,
                'remaining_usd', ROUND(v_scol_rem_usd::numeric, 2),
                'is_paid', v_scol_is_paid
            ),
            'adhoc', jsonb_build_object(
                'due_htg', v_adhoc_due_htg,
                'paid_htg', v_adhoc_paid_htg,
                'remaining_htg', v_adhoc_rem_htg,
                'is_paid', (v_adhoc_rem_htg = 0)
            )
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. MISE À JOUR DE get_student_global_debt POUR UTILISER LES TAUX HISTORIQUES SCELLÉS
CREATE OR REPLACE FUNCTION public.get_student_global_debt(
    p_student_id UUID, 
    p_exclude_year_id UUID DEFAULT NULL::UUID,
    p_school_id UUID DEFAULT NULL::UUID
)
RETURNS NUMERIC AS $$
DECLARE
    v_year_record RECORD;
    v_balance_json JSONB;
    v_total_debt NUMERIC := 0;
    v_school_id UUID := p_school_id;
BEGIN
    IF v_school_id IS NULL THEN
        SELECT school_id INTO v_school_id FROM public.students WHERE id = p_student_id;
    END IF;

    -- Parcourir chaque année académique où l'élève est inscrit
    FOR v_year_record IN
        SELECT DISTINCT e.academic_year_id
        FROM public.enrollments e
        JOIN public.academic_years ay ON e.academic_year_id = ay.id
        WHERE e.student_id = p_student_id
          AND (v_school_id IS NULL OR e.school_id = v_school_id)
          AND (p_exclude_year_id IS NULL OR e.academic_year_id IS DISTINCT FROM p_exclude_year_id)
          AND ay.status IN ('PAST', 'ACTIVE')
    LOOP
        v_balance_json := public.get_student_real_balance(p_student_id, v_year_record.academic_year_id, v_school_id);
        v_total_debt := v_total_debt + COALESCE((v_balance_json->>'total_debt_htg')::numeric, 0);
    END LOOP;

    RETURN GREATEST(0, v_total_debt);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. FONCTION DE MIGRATION / RÉTRO-JOURNALISATION DES ANCIENS PAIEMENTS
CREATE OR REPLACE FUNCTION public.backfill_payment_exchange_rate_journal()
RETURNS JSONB AS $$
DECLARE
    r_payment RECORD;
    v_school_rate NUMERIC;
    v_applied_rate NUMERIC;
    v_usd_equiv NUMERIC;
    v_count INT := 0;
BEGIN
    FOR r_payment IN 
        SELECT 
            p.id, 
            p.school_id, 
            p.student_id, 
            p.academic_year_id, 
            p.fee_type, 
            p.currency, 
            p.amount, 
            p.exchange_rate_applied, 
            p.amount_htg_equivalent,
            p.created_at
        FROM public.payments p
    LOOP
        v_school_rate := public.get_current_exchange_rate(r_payment.school_id);
        
        -- Déterminer le meilleur taux historique
        IF r_payment.exchange_rate_applied IS NOT NULL AND r_payment.exchange_rate_applied > 1 THEN
            v_applied_rate := r_payment.exchange_rate_applied;
        ELSE
            v_applied_rate := v_school_rate;
        END IF;

        IF r_payment.currency = 'USD' THEN
            v_usd_equiv := r_payment.amount;
        ELSE
            v_usd_equiv := ROUND((r_payment.amount / v_applied_rate)::numeric, 4);
        END IF;

        -- Mettre à jour payments si exchange_rate_applied n'était pas renseigné
        IF r_payment.exchange_rate_applied IS NULL OR r_payment.exchange_rate_applied <= 1 THEN
            UPDATE public.payments
            SET exchange_rate_applied = v_applied_rate
            WHERE id = r_payment.id;
        END IF;

        -- Insérer dans le journal
        INSERT INTO public.transaction_exchange_rate_journal (
            payment_id,
            school_id,
            student_id,
            academic_year_id,
            fee_type,
            currency,
            amount_paid,
            exchange_rate_applied,
            amount_htg_equivalent,
            amount_usd_equivalent,
            rate_source,
            notes,
            created_at
        ) VALUES (
            r_payment.id,
            r_payment.school_id,
            r_payment.student_id,
            r_payment.academic_year_id,
            r_payment.fee_type,
            r_payment.currency,
            r_payment.amount,
            v_applied_rate,
            COALESCE(r_payment.amount_htg_equivalent, r_payment.amount),
            v_usd_equiv,
            'HISTORICAL_BACKFILL',
            'Rétro-journalisation automatique du taux historique',
            COALESCE(r_payment.created_at, NOW())
        )
        ON CONFLICT (payment_id) DO UPDATE SET
            exchange_rate_applied = EXCLUDED.exchange_rate_applied,
            amount_usd_equivalent = EXCLUDED.amount_usd_equivalent;

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object('status', 'success', 'journalized_count', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissions pour les rôles applicatifs
GRANT EXECUTE ON FUNCTION public.get_current_exchange_rate(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_student_real_balance(UUID, UUID, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_student_global_debt(UUID, UUID, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.backfill_payment_exchange_rate_journal() TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_exchange_rate_journal TO authenticated, service_role;
GRANT SELECT ON public.transaction_exchange_rate_journal TO anon;

-- Rafraîchir le schéma PostgREST
NOTIFY pgrst, 'reload schema';
