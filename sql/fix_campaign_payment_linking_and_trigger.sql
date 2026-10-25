-- ==============================================================================
-- FIX CAMPAIGN PAYMENT LINKING & FEE VALIDATION TRIGGER
-- ==============================================================================
-- Ce script résout l'attribution erronée des règlements de frais de campagne :
-- 1. Corrige le trigger check_payment_order() pour ne pas confondre les règlements de campagne
--    avec les frais divers obligatoires.
-- 2. Met à jour get_student_real_balance() pour prioriser les campagnes ad-hoc sur les frais divers,
--    garantissant que le paiement est imputé à la campagne (ex: ASSURANCE SCOLAIRE 2,500 HTG).
-- 3. Rectifie les enregistrements de paiements existants (ex: Augustin Djenny) en scellant fee_type = 'AD_HOC'.
-- ==============================================================================

-- 1. Rectification des paiements de campagne mal étiquetés en 'DIVERS'
UPDATE public.payments
SET fee_type = 'AD_HOC'
WHERE (ad_hoc_campaign_id IS NOT NULL OR nature ILIKE '%campagne%' OR type ILIKE '%campagne%')
  AND fee_type = 'DIVERS';

-- Liaison spécifique pour Augustin Djenny si le paiement n'avait pas l'ID de campagne
UPDATE public.payments
SET ad_hoc_campaign_id = 'f8079082-d45e-467f-afe8-4f68756c9958',
    fee_type = 'AD_HOC'
WHERE student_id = 'c3b12a55-d5d1-460b-8a7d-c8eed32a727c'
  AND (nature ILIKE '%ASSURANCE SCOLAIRE%' OR description ILIKE '%ASSURANCE SCOLAIRE%')
  AND (ad_hoc_campaign_id IS NULL OR fee_type = 'DIVERS');

-- 2. Trigger check_payment_order() renforcé
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
    -- Ignorer les paiements sans année académique
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
    WHERE student_id = NEW.student_id 
      AND academic_year_id = NEW.academic_year_id 
      AND fee_type = 'INSCRIPTION'
      AND (status IS NULL OR status NOT IN ('ANNULE', 'ANNULÉ'));

    -- Calculer ce qui a déjà été payé en Frais Divers (en excluant strictement les campagnes ad-hoc)
    SELECT COALESCE(SUM(amount_htg_equivalent), 0) INTO v_misc_paid
    FROM public.payments
    WHERE student_id = NEW.student_id 
      AND academic_year_id = NEW.academic_year_id 
      AND fee_type = 'DIVERS'
      AND ad_hoc_campaign_id IS NULL
      AND (nature IS NULL OR (nature NOT ILIKE '%campagne%' AND nature NOT ILIKE '%adhoc%'))
      AND (status IS NULL OR status NOT IN ('ANNULE', 'ANNULÉ'));

    -- RÈGLE 1 : L'inscription doit être réglée avant tout
    IF NEW.fee_type IN ('DIVERS', 'SCOLARITE', 'FOURNITURE') AND NEW.ad_hoc_campaign_id IS NULL THEN
        IF v_inscription_paid < v_inscription_required THEN
            RAISE EXCEPTION 'Règle stricte : Les frais d''inscription (% HTG) doivent être réglés avant tout autre versement.', v_inscription_required;
        END IF;
    END IF;

    -- RÈGLE 2 : Les frais divers obligatoires avant la scolarité
    IF NEW.fee_type IN ('SCOLARITE', 'FOURNITURE') AND v_is_misc_mandatory = true THEN
        IF v_misc_paid < v_misc_required_htg THEN
            RAISE EXCEPTION 'Règle stricte : Les frais divers obligatoires doivent être réglés avant l''écolage ou les fournitures.';
        END IF;
    END IF;

    -- RÈGLE 3 : Préservation du taux historique multi-devises
    v_active_rate := public.get_current_exchange_rate(NEW.school_id);
    IF NEW.currency = 'USD' THEN
        IF NEW.exchange_rate_applied IS NULL OR NEW.exchange_rate_applied <= 1 THEN
            NEW.exchange_rate_applied := v_active_rate;
        END IF;
        NEW.amount_htg_equivalent := ROUND((NEW.amount * NEW.exchange_rate_applied)::numeric, 2);
    ELSE
        IF NEW.exchange_rate_applied IS NULL OR NEW.exchange_rate_applied <= 1 THEN
            NEW.exchange_rate_applied := v_active_rate;
        END IF;
        NEW.amount_htg_equivalent := NEW.amount;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- S'assurer que le trigger est attaché
DROP TRIGGER IF EXISTS enforce_payment_order_trigger ON public.payments;
CREATE TRIGGER enforce_payment_order_trigger
BEFORE INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.check_payment_order();

-- 3. Mise à jour de get_student_real_balance pour prioriser les campagnes
CREATE OR REPLACE FUNCTION public.get_student_real_balance(
    p_student_id UUID,
    p_academic_year_id UUID DEFAULT NULL::UUID,
    p_school_id UUID DEFAULT NULL::UUID
)
RETURNS JSONB AS $$
DECLARE
    v_school_id UUID := p_school_id;
    v_academic_year_id UUID := p_academic_year_id;
    v_current_rate NUMERIC;
    v_class_id UUID;
    v_fee_plan RECORD;
    v_enrollment RECORD;
    
    -- Exigences prévues
    v_adm_due_htg NUMERIC := 0;
    v_adm_due_usd NUMERIC := 0;
    v_misc_due_htg NUMERIC := 0;
    v_misc_due_usd NUMERIC := 0;
    v_scol_due_htg NUMERIC := 0;
    v_scol_due_usd NUMERIC := 0;
    v_adhoc_due_htg NUMERIC := 0;
    
    -- Montants effectivement versés
    v_adm_paid_htg NUMERIC := 0;
    v_adm_paid_usd NUMERIC := 0;
    v_misc_paid_htg NUMERIC := 0;
    v_misc_paid_usd NUMERIC := 0;
    v_scol_paid_htg NUMERIC := 0;
    v_scol_paid_usd NUMERIC := 0;
    v_adhoc_paid_htg NUMERIC := 0;
    
    -- Soldes restants réels
    v_adm_rem_htg NUMERIC := 0;
    v_adm_rem_usd NUMERIC := 0;
    v_misc_rem_htg NUMERIC := 0;
    v_misc_rem_usd NUMERIC := 0;
    v_scol_rem_htg NUMERIC := 0;
    v_scol_rem_usd NUMERIC := 0;
    v_adhoc_rem_htg NUMERIC := 0;
    
    v_adm_is_paid BOOLEAN := false;
    v_misc_is_paid BOOLEAN := false;
    v_scol_is_paid BOOLEAN := false;
    
    v_total_debt_htg NUMERIC := 0;
    v_total_paid_htg NUMERIC := 0;
    r_pay RECORD;
    p_htg_val NUMERIC;
    p_usd_val NUMERIC;
BEGIN
    IF v_school_id IS NULL THEN
        SELECT school_id INTO v_school_id FROM public.students WHERE id = p_student_id;
    END IF;

    IF v_academic_year_id IS NULL THEN
        SELECT id INTO v_academic_year_id 
        FROM public.academic_years 
        WHERE (school_id = v_school_id OR school_id IS NULL)
          AND (status = 'ACTIVE' OR is_active = true)
        ORDER BY created_at DESC LIMIT 1;
    END IF;

    v_current_rate := public.get_current_exchange_rate(v_school_id);
    IF v_current_rate IS NULL OR v_current_rate <= 0 THEN
        v_current_rate := 135.0;
    END IF;

    SELECT * INTO v_enrollment 
    FROM public.enrollments 
    WHERE student_id = p_student_id 
      AND academic_year_id = v_academic_year_id 
    LIMIT 1;

    IF v_enrollment.id IS NOT NULL THEN
        v_class_id := v_enrollment.class_id;
    ELSE
        SELECT class_id INTO v_class_id FROM public.students WHERE id = p_student_id;
    END IF;

    IF v_class_id IS NOT NULL AND v_academic_year_id IS NOT NULL THEN
        SELECT * INTO v_fee_plan 
        FROM public.fee_plans 
        WHERE class_id = v_class_id 
          AND academic_year_id = v_academic_year_id 
        LIMIT 1;

        IF v_fee_plan.id IS NULL THEN
            SELECT * INTO v_fee_plan 
            FROM public.fee_plans 
            WHERE class_id = v_class_id 
            LIMIT 1;
        END IF;

        IF v_fee_plan.id IS NOT NULL THEN
            v_adm_due_htg := COALESCE(v_fee_plan.inscription_fee, 0);
            v_adm_due_usd := COALESCE(v_fee_plan.inscription_fee_usd, 0);
            
            IF v_fee_plan.is_misc_mandatory = true THEN
                v_misc_due_htg := COALESCE(v_fee_plan.misc_fee_htg, 0);
                v_misc_due_usd := COALESCE(v_fee_plan.misc_fee_usd, 0);
            END IF;

            v_scol_due_htg := COALESCE(v_fee_plan.tuition_fee, 0);
            v_scol_due_usd := COALESCE(v_fee_plan.tuition_fee_usd, 0);

            IF v_enrollment.id IS NOT NULL THEN
                v_scol_due_htg := GREATEST(0, v_scol_due_htg - COALESCE(v_enrollment.tuition_discount, 0) + COALESCE(v_enrollment.tuition_addition, 0));
            END IF;
        END IF;
    END IF;

    -- Parcourir tous les paiements réels scellés
    FOR r_pay IN 
        SELECT 
            p.id,
            p.fee_type,
            p.nature,
            p.type,
            p.description,
            p.ad_hoc_campaign_id,
            p.currency,
            p.amount,
            p.exchange_rate_applied,
            p.amount_htg_equivalent
        FROM public.payments p
        WHERE p.student_id = p_student_id
          AND (v_academic_year_id IS NULL OR p.academic_year_id = v_academic_year_id OR p.academic_year_id IS NULL)
          AND (p.status IS NULL OR p.status NOT IN ('ANNULE', 'ANNULÉ'))
    LOOP
        p_htg_val := COALESCE(r_pay.amount_htg_equivalent, r_pay.amount);
        IF r_pay.currency = 'USD' THEN
            p_usd_val := r_pay.amount;
        ELSE
            IF r_pay.exchange_rate_applied IS NOT NULL AND r_pay.exchange_rate_applied > 1 THEN
                p_usd_val := r_pay.amount / r_pay.exchange_rate_applied;
            ELSE
                p_usd_val := r_pay.amount / v_current_rate;
            END IF;
        END IF;

        -- A. Frais d'admission
        IF r_pay.fee_type = 'INSCRIPTION' 
           OR r_pay.nature ILIKE '%inscription%' 
           OR r_pay.nature ILIKE '%admission%' 
           OR r_pay.nature ILIKE '%réinscription%' THEN
            v_adm_paid_usd := v_adm_paid_usd + p_usd_val;
            v_adm_paid_htg := v_adm_paid_htg + p_htg_val;

        -- B. Campagnes Ad Hoc (Priorité sur 'DIVERS' pour lier tout versement de campagne)
        ELSIF r_pay.ad_hoc_campaign_id IS NOT NULL 
              OR r_pay.fee_type IN ('AD_HOC', 'CAMPAGNE', 'CAMPAIGN') 
              OR r_pay.nature ILIKE '%campagne%' 
              OR r_pay.nature ILIKE '%adhoc%' 
              OR r_pay.type ILIKE '%campagne%' 
              OR r_pay.description ILIKE '%campagne%' THEN
            v_adhoc_paid_htg := v_adhoc_paid_htg + p_htg_val;

        -- C. Frais Divers Obligatoires
        ELSIF (r_pay.fee_type = 'DIVERS' OR r_pay.nature ILIKE '%divers%') 
              AND r_pay.ad_hoc_campaign_id IS NULL 
              AND (r_pay.nature IS NULL OR r_pay.nature NOT ILIKE '%campagne%') THEN
            v_misc_paid_usd := v_misc_paid_usd + p_usd_val;
            v_misc_paid_htg := v_misc_paid_htg + p_htg_val;

        -- D. Scolarité (par défaut)
        ELSE
            v_scol_paid_usd := v_scol_paid_usd + p_usd_val;
            v_scol_paid_htg := v_scol_paid_htg + p_htg_val;
        END IF;

        v_total_paid_htg := v_total_paid_htg + p_htg_val;
    END LOOP;

    -- Extinction obligations admission
    IF v_adm_due_usd > 0 THEN
        IF (v_adm_due_usd - v_adm_paid_usd) <= 0.10 OR v_adm_paid_usd >= (v_adm_due_usd - 3.00) THEN
            v_adm_is_paid := true;
            v_adm_rem_usd := 0;
            v_adm_rem_htg := 0;
        ELSE
            v_adm_rem_usd := GREATEST(0, v_adm_due_usd - v_adm_paid_usd);
            v_adm_rem_htg := ROUND((v_adm_rem_usd * v_current_rate)::numeric, 0);
        END IF;
    ELSE
        IF (v_adm_due_htg - v_adm_paid_htg) <= 50.0 OR (v_adm_due_htg > 0 AND v_adm_paid_htg >= (v_adm_due_htg - 50.0)) THEN
            v_adm_is_paid := true;
            v_adm_rem_htg := 0;
            v_adm_rem_usd := 0;
        ELSE
            v_adm_rem_htg := GREATEST(0, v_adm_due_htg - v_adm_paid_htg);
            v_adm_rem_usd := ROUND((v_adm_rem_htg / v_current_rate)::numeric, 2);
        END IF;
    END IF;

    -- Extinction obligations divers
    IF v_misc_due_usd > 0 THEN
        IF (v_misc_due_usd - v_misc_paid_usd) <= 0.10 OR v_misc_paid_usd >= (v_misc_due_usd - 3.00) THEN
            v_misc_is_paid := true;
            v_misc_rem_usd := 0;
            v_misc_rem_htg := 0;
        ELSE
            v_misc_rem_usd := GREATEST(0, v_misc_due_usd - v_misc_paid_usd);
            v_misc_rem_htg := ROUND((v_misc_rem_usd * v_current_rate)::numeric, 0);
        END IF;
    ELSE
        IF (v_misc_due_htg - v_misc_paid_htg) <= 50.0 OR (v_misc_due_htg > 0 AND v_misc_paid_htg >= (v_misc_due_htg - 50.0)) THEN
            v_misc_is_paid := true;
            v_misc_rem_htg := 0;
            v_misc_rem_usd := 0;
        ELSE
            v_misc_rem_htg := GREATEST(0, v_misc_due_htg - v_misc_paid_htg);
            v_misc_rem_usd := ROUND((v_misc_rem_htg / v_current_rate)::numeric, 2);
        END IF;
    END IF;

    -- Extinction obligations scolarité
    IF v_scol_due_usd > 0 THEN
        IF (v_scol_due_usd - v_scol_paid_usd) <= 0.10 OR v_scol_paid_usd >= (v_scol_due_usd - 3.00) THEN
            v_scol_is_paid := true;
            v_scol_rem_usd := 0;
            v_scol_rem_htg := 0;
        ELSE
            v_scol_rem_usd := GREATEST(0, v_scol_due_usd - v_scol_paid_usd);
            v_scol_rem_htg := ROUND((v_scol_rem_usd * v_current_rate)::numeric, 0);
        END IF;
    ELSE
        IF (v_scol_due_htg - v_scol_paid_htg) <= 100.0 OR (v_scol_due_htg > 0 AND v_scol_paid_htg >= (v_scol_due_htg - 100.0)) THEN
            v_scol_is_paid := true;
            v_scol_rem_htg := 0;
            v_scol_rem_usd := 0;
        ELSE
            v_scol_rem_htg := GREATEST(0, v_scol_due_htg - v_scol_paid_htg);
            v_scol_rem_usd := ROUND((v_scol_rem_htg / v_current_rate)::numeric, 2);
        END IF;
    END IF;

    -- Dettes de campagnes ad-hoc
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
                'paid_htg', v_adm_paid_htg,
                'remaining_htg', v_adm_rem_htg,
                'is_paid', v_adm_is_paid
            ),
            'misc', jsonb_build_object(
                'due_htg', v_misc_due_htg,
                'paid_htg', v_misc_paid_htg,
                'remaining_htg', v_misc_rem_htg,
                'is_paid', v_misc_is_paid
            ),
            'tuition', jsonb_build_object(
                'due_htg', v_scol_due_htg,
                'paid_htg', v_scol_paid_htg,
                'remaining_htg', v_scol_rem_htg,
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

NOTIFY pgrst, 'reload schema';
