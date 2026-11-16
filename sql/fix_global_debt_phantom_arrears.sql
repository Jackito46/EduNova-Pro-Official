-- ==============================================================================
-- FIX GLOBAL DEBT & RE-ENROLLMENT PHANTOM ARREARS (MULTI-TENANT / ALL SCHOOLS)
-- ==============================================================================
-- Élimine définitivement les arriérés fantômes (ex: 2 500 G lors de la réinscription
-- alors que le dossier est soldé à 100%) dans `get_student_real_balance` et
-- `get_student_global_debt` pour l'ensemble des établissements :
--   0. Sécurise toutes les colonnes optionnelles (students.is_foreign,
--      fee_plans.foreign_tuition_fee, etc.) pour éviter tout échec SQL/PostgREST.
--   1. Rattache automatiquement les anciens versements de campagnes mal étiquetés
--      (`fee_type = 'DIVERS'`) à leur campagne ad-hoc sur toutes les écoles.
--   2. Distingue chronologiquement Inscription (1ère session) vs Réinscription (suivantes)
--      par extraction d'année sur 4 chiffres, sans être faussé par une session FUTURE.
--   3. Dédoublonne les inscriptions et assignations de campagnes par session/campagne.
--   4. Exclut les recharges de portefeuille, achats de fournitures, et tous les
--      paiements annulés, rejetés, échoués ou en attente.
--   5. Attribue les paiements non tagués (`academic_year_id IS NULL`) à la dernière
--      session auditable et applique la réconciliation comptable globale (<= 50 HTG).
-- ==============================================================================

-- 0. Garantir l'existence de TOUTES les colonnes optionnelles sur l'ensemble des bases
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS is_foreign BOOLEAN DEFAULT false;

ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS tuition_discount NUMERIC DEFAULT 0;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS tuition_addition NUMERIC DEFAULT 0;

ALTER TABLE public.fee_plans ADD COLUMN IF NOT EXISTS inscription_fee_usd NUMERIC DEFAULT 0;
ALTER TABLE public.fee_plans ADD COLUMN IF NOT EXISTS reenrollment_fee NUMERIC DEFAULT 0;
ALTER TABLE public.fee_plans ADD COLUMN IF NOT EXISTS reenrollment_fee_usd NUMERIC DEFAULT 0;
ALTER TABLE public.fee_plans ADD COLUMN IF NOT EXISTS is_misc_mandatory BOOLEAN DEFAULT false;
ALTER TABLE public.fee_plans ADD COLUMN IF NOT EXISTS misc_fee_htg NUMERIC DEFAULT 0;
ALTER TABLE public.fee_plans ADD COLUMN IF NOT EXISTS misc_fee_usd NUMERIC DEFAULT 0;
ALTER TABLE public.fee_plans ADD COLUMN IF NOT EXISTS tuition_fee_usd NUMERIC DEFAULT 0;
ALTER TABLE public.fee_plans ADD COLUMN IF NOT EXISTS foreign_tuition_fee NUMERIC DEFAULT 0;

ALTER TABLE public.ad_hoc_campaigns ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'HTG';
ALTER TABLE public.student_ad_hoc_fees ADD COLUMN IF NOT EXISTS custom_amount NUMERIC;

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS nature TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'Scolarité';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS fee_type TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS ad_hoc_campaign_id UUID;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'HTG';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS exchange_rate_applied NUMERIC;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount_htg_equivalent NUMERIC;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'VALIDE';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS moncash_status TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS notes TEXT;

-- 0b. Réconciliation rétroactive des versements de campagnes mal étiquetés en 'DIVERS' (toutes écoles)
UPDATE public.payments
SET fee_type = 'AD_HOC'
WHERE (
    ad_hoc_campaign_id IS NOT NULL
    OR COALESCE(nature, '') ILIKE '%campagne%'
    OR COALESCE(type, '') ILIKE '%campagne%'
    OR COALESCE(description, '') ILIKE '%campagne%'
    OR COALESCE(nature, '') ILIKE '%adhoc%'
    OR COALESCE(nature, '') ILIKE '%ad-hoc%'
)
  AND COALESCE(UPPER(fee_type), '') IN ('DIVERS', 'MISC', '');

UPDATE public.payments p
SET ad_hoc_campaign_id = matched.campaign_id,
    fee_type = 'AD_HOC'
FROM (
    SELECT DISTINCT ON (p2.id)
        p2.id AS payment_id,
        ac.id AS campaign_id
    FROM public.payments p2
    JOIN public.student_ad_hoc_fees saf ON saf.student_id = p2.student_id
    JOIN public.ad_hoc_campaigns ac ON ac.id = saf.campaign_id
    WHERE p2.ad_hoc_campaign_id IS NULL
      AND COALESCE(UPPER(p2.fee_type), '') IN ('DIVERS', 'MISC', 'AD_HOC', 'CAMPAGNE', 'CAMPAIGN', '')
      AND (p2.academic_year_id IS NULL OR ac.academic_year_id IS NULL OR p2.academic_year_id = ac.academic_year_id)
      AND (
          COALESCE(p2.nature, '') ILIKE '%' || ac.name || '%'
          OR COALESCE(p2.description, '') ILIKE '%' || ac.name || '%'
          OR COALESCE(p2.notes, '') ILIKE '%' || ac.name || '%'
          OR (ac.name ILIKE '%assurance%' AND (
              COALESCE(p2.nature, '') ILIKE '%assurance%'
              OR COALESCE(p2.description, '') ILIKE '%assurance%'
              OR COALESCE(p2.notes, '') ILIKE '%assurance%'
          ))
      )
    ORDER BY p2.id, ac.created_at DESC NULLS LAST
) matched
WHERE p.id = matched.payment_id;

DROP FUNCTION IF EXISTS public.get_student_global_debt(uuid);
DROP FUNCTION IF EXISTS public.get_student_global_debt(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_student_global_debt(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_student_real_balance(
    p_student_id UUID,
    p_academic_year_id UUID DEFAULT NULL::UUID,
    p_school_id UUID DEFAULT NULL::UUID
)
RETURNS JSONB AS $$
DECLARE
    v_school_id UUID := p_school_id;
    v_academic_year_id UUID := p_academic_year_id;
    v_current_rate NUMERIC := 135.0;
    v_class_id UUID;
    v_student_discount NUMERIC := 0;
    v_is_foreign BOOLEAN := false;
    v_fee_plan RECORD;
    v_enrollment RECORD;
    v_has_previous_enrollment BOOLEAN := false;
    v_is_latest_auditable_year BOOLEAN := false;

    v_adm_due_htg NUMERIC := 0;
    v_adm_due_usd NUMERIC := 0;
    v_misc_due_htg NUMERIC := 0;
    v_misc_due_usd NUMERIC := 0;
    v_scol_due_htg NUMERIC := 0;
    v_scol_due_usd NUMERIC := 0;
    v_adhoc_due_htg NUMERIC := 0;

    v_adm_paid_htg NUMERIC := 0;
    v_adm_paid_usd NUMERIC := 0;
    v_misc_paid_htg NUMERIC := 0;
    v_misc_paid_usd NUMERIC := 0;
    v_scol_paid_htg NUMERIC := 0;
    v_scol_paid_usd NUMERIC := 0;
    v_adhoc_paid_htg NUMERIC := 0;

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

    v_total_due_htg NUMERIC := 0;
    v_total_paid_htg NUMERIC := 0;
    v_raw_cat_debt_htg NUMERIC := 0;
    v_total_debt_htg NUMERIC := 0;

    r_pay RECORD;
    p_amount NUMERIC;
    p_rate NUMERIC;
    p_htg_val NUMERIC;
    p_usd_val NUMERIC;
    v_is_camp_match BOOLEAN;
    v_year_created_at TIMESTAMPTZ;
    v_year_label TEXT;
    v_year_start_num INTEGER := 0;
    v_latest_auditable_year_id UUID;
BEGIN
    SELECT school_id, COALESCE(discount_amount, 0), COALESCE(is_foreign, false), class_id
    INTO v_school_id, v_student_discount, v_is_foreign, v_class_id
    FROM public.students
    WHERE id = p_student_id
      AND (p_school_id IS NULL OR school_id = p_school_id);

    IF v_school_id IS NULL THEN
        RETURN jsonb_build_object('student_id', p_student_id, 'total_debt_htg', 0, 'total_paid_htg', 0);
    END IF;

    IF v_academic_year_id IS NULL THEN
        SELECT id, label, created_at INTO v_academic_year_id, v_year_label, v_year_created_at
        FROM public.academic_years
        WHERE school_id = v_school_id
          AND (status = 'ACTIVE' OR is_active = true)
        ORDER BY created_at DESC LIMIT 1;
    ELSE
        SELECT label, created_at INTO v_year_label, v_year_created_at
        FROM public.academic_years
        WHERE id = v_academic_year_id AND school_id = v_school_id;
    END IF;

    IF v_year_label IS NOT NULL THEN
        v_year_start_num := COALESCE((regexp_match(v_year_label, '(\d{4})'))[1]::integer, 0);
    END IF;

    BEGIN
        v_current_rate := COALESCE(public.get_current_exchange_rate(v_school_id), 135.0);
    EXCEPTION WHEN OTHERS THEN
        SELECT COALESCE(rate_usd_to_htg, 135.0) INTO v_current_rate
        FROM public.exchange_rates
        WHERE school_id = v_school_id
        ORDER BY effective_date DESC LIMIT 1;
    END;
    IF v_current_rate IS NULL OR v_current_rate <= 0 THEN
        v_current_rate := 135.0;
    END IF;

    -- Dédoublonner l'inscription pour cette année en prenant la plus récente non annulée
    SELECT * INTO v_enrollment
    FROM public.enrollments
    WHERE student_id = p_student_id
      AND school_id = v_school_id
      AND academic_year_id = v_academic_year_id
      AND COALESCE(UPPER(status), '') NOT IN ('ANNULE', 'ANNULÉ', 'CANCELLED')
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1;

    IF v_enrollment.id IS NOT NULL THEN
        v_class_id := v_enrollment.class_id;
    END IF;

    -- Rang chronologique réel : vérifier uniquement les inscriptions STRICTEMENT antérieures (PAST ou ACTIVE)
    SELECT EXISTS (
        SELECT 1
        FROM public.enrollments e
        JOIN public.academic_years ay ON ay.id = e.academic_year_id
        WHERE e.student_id = p_student_id
          AND e.school_id = v_school_id
          AND e.academic_year_id IS DISTINCT FROM v_academic_year_id
          AND COALESCE(UPPER(e.status), '') NOT IN ('ANNULE', 'ANNULÉ', 'CANCELLED')
          AND (ay.status IN ('PAST', 'ACTIVE') OR ay.is_active = true)
          AND (
            (v_year_start_num > 0 AND COALESCE((regexp_match(ay.label, '(\d{4})'))[1]::integer, 0) > 0
             AND COALESCE((regexp_match(ay.label, '(\d{4})'))[1]::integer, 0) < v_year_start_num)
            OR ((v_year_start_num = 0 OR COALESCE((regexp_match(ay.label, '(\d{4})'))[1]::integer, 0) = 0)
                AND e.created_at < COALESCE(v_enrollment.created_at, NOW()))
          )
    ) INTO v_has_previous_enrollment;

    -- Identifier la session PAST/ACTIVE la plus récente pour y rattacher les paiements sans academic_year_id
    SELECT e.academic_year_id INTO v_latest_auditable_year_id
    FROM public.enrollments e
    JOIN public.academic_years ay ON ay.id = e.academic_year_id
    WHERE e.student_id = p_student_id
      AND e.school_id = v_school_id
      AND COALESCE(UPPER(e.status), '') NOT IN ('ANNULE', 'ANNULÉ', 'CANCELLED')
      AND (ay.status IN ('PAST', 'ACTIVE') OR ay.is_active = true)
    ORDER BY COALESCE((regexp_match(ay.label, '(\d{4})'))[1]::integer, 0) DESC, e.created_at DESC NULLS LAST
    LIMIT 1;

    v_is_latest_auditable_year := (v_academic_year_id IS NOT NULL AND v_academic_year_id = v_latest_auditable_year_id);

    IF v_class_id IS NOT NULL AND v_academic_year_id IS NOT NULL THEN
        SELECT * INTO v_fee_plan
        FROM public.fee_plans
        WHERE school_id = v_school_id
          AND class_id = v_class_id
          AND academic_year_id = v_academic_year_id
        LIMIT 1;

        IF v_fee_plan.id IS NULL THEN
            SELECT * INTO v_fee_plan
            FROM public.fee_plans
            WHERE school_id = v_school_id
              AND class_id = v_class_id
            LIMIT 1;
        END IF;

        IF v_fee_plan.id IS NOT NULL THEN
            IF v_has_previous_enrollment THEN
                v_adm_due_htg := COALESCE(v_fee_plan.reenrollment_fee, 0);
                v_adm_due_usd := COALESCE(v_fee_plan.reenrollment_fee_usd, 0);
            ELSE
                v_adm_due_htg := COALESCE(v_fee_plan.inscription_fee, 0);
                v_adm_due_usd := COALESCE(v_fee_plan.inscription_fee_usd, 0);
            END IF;

            IF COALESCE(v_fee_plan.is_misc_mandatory, false) = true THEN
                v_misc_due_htg := COALESCE(v_fee_plan.misc_fee_htg, 0);
                v_misc_due_usd := COALESCE(v_fee_plan.misc_fee_usd, 0);
            END IF;

            v_scol_due_htg := CASE
                WHEN v_is_foreign AND COALESCE(v_fee_plan.foreign_tuition_fee, 0) > 0
                    THEN v_fee_plan.foreign_tuition_fee
                ELSE COALESCE(v_fee_plan.tuition_fee, 0)
            END;
            v_scol_due_usd := COALESCE(v_fee_plan.tuition_fee_usd, 0);

            v_scol_due_htg := GREATEST(0,
                (v_scol_due_htg + COALESCE(v_enrollment.tuition_addition, 0))
                - (COALESCE(v_enrollment.tuition_discount, 0) + COALESCE(v_student_discount, 0))
            );
        END IF;
    END IF;

    -- Exigences de campagnes ad-hoc dédoublonnées par campagne (respectant custom_amount et devise USD/HTG)
    IF v_academic_year_id IS NOT NULL THEN
        SELECT COALESCE(SUM(camp_due_htg), 0) INTO v_adhoc_due_htg
        FROM (
            SELECT DISTINCT ON (s.campaign_id)
                CASE
                    WHEN UPPER(COALESCE(c.currency, 'HTG')) = 'USD'
                        THEN COALESCE(s.custom_amount, c.amount, 0) * v_current_rate
                    ELSE COALESCE(s.custom_amount, c.amount, 0)
                END AS camp_due_htg
            FROM public.student_ad_hoc_fees s
            JOIN public.ad_hoc_campaigns c ON s.campaign_id = c.id
            WHERE s.student_id = p_student_id
              AND (s.school_id = v_school_id OR s.school_id IS NULL)
              AND (c.school_id = v_school_id OR c.school_id IS NULL)
              AND (
                  c.academic_year_id = v_academic_year_id
                  OR (c.academic_year_id IS NULL AND v_is_latest_auditable_year)
              )
            ORDER BY s.campaign_id, s.created_at DESC NULLS LAST
        ) dedup_campaigns;
    END IF;

    -- Parcourir les paiements validés réels (en excluant recharges portefeuille, fournitures, annulés, rejetés et en attente)
    FOR r_pay IN
        SELECT
            p.id,
            p.fee_type,
            p.type,
            p.nature,
            p.description,
            p.notes,
            p.ad_hoc_campaign_id,
            p.currency,
            p.amount,
            p.exchange_rate_applied,
            p.amount_htg_equivalent
        FROM public.payments p
        WHERE p.student_id = p_student_id
          AND (p.school_id = v_school_id OR p.school_id IS NULL)
          AND (
            v_academic_year_id IS NULL
            OR p.academic_year_id = v_academic_year_id
            OR (
                v_is_latest_auditable_year
                AND (
                    p.academic_year_id IS NULL
                    OR NOT EXISTS (
                        SELECT 1 FROM public.enrollments e_chk
                        WHERE e_chk.student_id = p_student_id
                          AND e_chk.academic_year_id = p.academic_year_id
                          AND COALESCE(UPPER(e_chk.status), '') NOT IN ('ANNULE', 'ANNULÉ', 'CANCELLED')
                    )
                )
            )
          )
          AND (p.status IS NULL OR UPPER(TRIM(p.status)) NOT IN (
              'ANNULE', 'ANNULÉ', 'REJETE', 'REJETÉ', 'CANCELLED', 'CANCELED',
              'EN_ATTENTE', 'EN ATTENTE', 'PENDING', 'ECHOUE', 'ÉCHOUÉ', 'FAILED', 'ECHEC', 'ÉCHEC', 'REFUSED'
          ))
          AND (p.moncash_status IS NULL OR UPPER(TRIM(p.moncash_status)) NOT IN (
              'PENDING', 'CANCELLED', 'CANCELED', 'FAILED', 'REJECTED', 'REJETE'
          ))
          AND (p.payment_method IS NULL OR (
              p.payment_method NOT ILIKE '%EN ATTENTE%'
              AND p.payment_method NOT ILIKE '%REJET%'
              AND p.payment_method NOT ILIKE '%ANNUL%'
          ))
          AND COALESCE(UPPER(p.fee_type), '') NOT IN (
              'CREDIT_PORTEFEUILLE', 'RECHARGE_PORTEFEUILLE', 'PORTEFEUILLE', 'WALLET_TOPUP',
              'FOURNITURE', 'SUPPLIES'
          )
          AND COALESCE(UPPER(p.fee_type), '') NOT LIKE '%PORTEFEUILLE%'
          AND COALESCE(p.nature, '') NOT ILIKE '%portefeuille%'
          AND COALESCE(p.nature, '') NOT ILIKE '%recharge%'
          AND COALESCE(p.description, '') NOT ILIKE '%recharge portefeuille%'
          AND COALESCE(p.description, '') NOT ILIKE '%alimentation portefeuille%'
    LOOP
        p_amount := COALESCE(r_pay.amount, 0);
        p_rate := CASE WHEN COALESCE(r_pay.exchange_rate_applied, 0) > 1 THEN r_pay.exchange_rate_applied ELSE v_current_rate END;
        p_htg_val := COALESCE(
            NULLIF(r_pay.amount_htg_equivalent, 0),
            CASE WHEN r_pay.currency = 'USD' AND p_amount <= 2000 THEN ROUND((p_amount * p_rate)::numeric, 2) ELSE p_amount END
        );

        IF r_pay.currency = 'USD' THEN
            p_usd_val := CASE WHEN p_amount > 2000 THEN p_amount / p_rate ELSE p_amount END;
        ELSE
            p_usd_val := p_htg_val / p_rate;
        END IF;

        -- Vérifier la correspondance directe par nom ou type de campagne assignée
        SELECT EXISTS (
            SELECT 1
            FROM public.student_ad_hoc_fees saf
            JOIN public.ad_hoc_campaigns ac ON saf.campaign_id = ac.id
            WHERE saf.student_id = p_student_id
              AND (saf.school_id = v_school_id OR saf.school_id IS NULL)
              AND (ac.school_id = v_school_id OR ac.school_id IS NULL)
              AND (v_academic_year_id IS NULL OR ac.academic_year_id IS NULL OR ac.academic_year_id = v_academic_year_id)
              AND (
                COALESCE(r_pay.nature, '') ILIKE '%' || ac.name || '%'
                OR COALESCE(r_pay.description, '') ILIKE '%' || ac.name || '%'
                OR COALESCE(r_pay.notes, '') ILIKE '%' || ac.name || '%'
                OR (ac.name ILIKE '%assurance%' AND (
                    COALESCE(r_pay.nature, '') ILIKE '%assurance%'
                    OR COALESCE(r_pay.description, '') ILIKE '%assurance%'
                    OR COALESCE(r_pay.notes, '') ILIKE '%assurance%'
                ))
              )
        ) INTO v_is_camp_match;

        -- A. Campagnes Ad Hoc (prioritaire pour éviter le classement en DIVERS ou SCOLARITE)
        IF r_pay.ad_hoc_campaign_id IS NOT NULL
           OR UPPER(COALESCE(r_pay.fee_type, '')) IN ('AD_HOC', 'CAMPAGNE', 'CAMPAIGN')
           OR COALESCE(r_pay.nature, '') ILIKE '%campagne%'
           OR COALESCE(r_pay.nature, '') ILIKE '%adhoc%'
           OR COALESCE(r_pay.nature, '') ILIKE '%ad-hoc%'
           OR COALESCE(r_pay.type, '') ILIKE '%campagne%'
           OR COALESCE(r_pay.description, '') ILIKE '%campagne%'
           OR COALESCE(r_pay.notes, '') ILIKE '%campagne%'
           OR v_is_camp_match THEN
            v_adhoc_paid_htg := v_adhoc_paid_htg + p_htg_val;

        -- B. Frais d'admission / inscription / réinscription
        ELSIF UPPER(COALESCE(r_pay.fee_type, '')) IN ('INSCRIPTION', 'REINSCRIPTION', 'RÉINSCRIPTION', 'ADMISSION', 'INSCRIPTION_REINSCRIPTION')
           OR COALESCE(r_pay.nature, '') ILIKE '%inscri%'
           OR COALESCE(r_pay.nature, '') ILIKE '%admiss%'
           OR COALESCE(r_pay.nature, '') ILIKE '%entree%'
           OR COALESCE(r_pay.nature, '') ILIKE '%entrée%'
           OR COALESCE(r_pay.type, '') ILIKE '%inscri%'
           OR COALESCE(r_pay.description, '') ILIKE '%inscri%' THEN
            v_adm_paid_usd := v_adm_paid_usd + p_usd_val;
            v_adm_paid_htg := v_adm_paid_htg + p_htg_val;

        -- C. Frais Divers Obligatoires
        ELSIF UPPER(COALESCE(r_pay.fee_type, '')) IN ('DIVERS', 'MISC')
           OR COALESCE(r_pay.nature, '') ILIKE '%divers%'
           OR COALESCE(r_pay.type, '') ILIKE '%divers%'
           OR COALESCE(r_pay.description, '') ILIKE '%divers%' THEN
            v_misc_paid_usd := v_misc_paid_usd + p_usd_val;
            v_misc_paid_htg := v_misc_paid_htg + p_htg_val;

        -- D. Scolarité (par défaut)
        ELSE
            v_scol_paid_usd := v_scol_paid_usd + p_usd_val;
            v_scol_paid_htg := v_scol_paid_htg + p_htg_val;
        END IF;

        v_total_paid_htg := v_total_paid_htg + p_htg_val;
    END LOOP;

    -- Extinction Admission
    IF v_adm_due_usd > 0 THEN
        IF (v_adm_due_usd - v_adm_paid_usd) <= 3.00 OR (v_adm_paid_usd / v_adm_due_usd) >= 0.96 THEN
            v_adm_is_paid := true; v_adm_rem_usd := 0; v_adm_rem_htg := 0;
        ELSE
            v_adm_rem_usd := GREATEST(0, v_adm_due_usd - v_adm_paid_usd);
            v_adm_rem_htg := ROUND((v_adm_rem_usd * v_current_rate)::numeric, 0);
        END IF;
    ELSE
        IF (v_adm_due_htg - v_adm_paid_htg) <= 50.0 OR (v_adm_due_htg > 0 AND (v_adm_paid_htg / v_adm_due_htg) >= 0.98) THEN
            v_adm_is_paid := true; v_adm_rem_htg := 0; v_adm_rem_usd := 0;
        ELSE
            v_adm_rem_htg := GREATEST(0, v_adm_due_htg - v_adm_paid_htg);
            v_adm_rem_usd := ROUND((v_adm_rem_htg / v_current_rate)::numeric, 2);
        END IF;
    END IF;

    -- Extinction Frais Divers
    IF v_misc_due_usd > 0 THEN
        IF (v_misc_due_usd - v_misc_paid_usd) <= 3.00 OR (v_misc_paid_usd / v_misc_due_usd) >= 0.96 THEN
            v_misc_is_paid := true; v_misc_rem_usd := 0; v_misc_rem_htg := 0;
        ELSE
            v_misc_rem_usd := GREATEST(0, v_misc_due_usd - v_misc_paid_usd);
            v_misc_rem_htg := ROUND((v_misc_rem_usd * v_current_rate)::numeric, 0);
        END IF;
    ELSE
        IF (v_misc_due_htg - v_misc_paid_htg) <= 50.0 OR (v_misc_due_htg > 0 AND (v_misc_paid_htg / v_misc_due_htg) >= 0.98) THEN
            v_misc_is_paid := true; v_misc_rem_htg := 0; v_misc_rem_usd := 0;
        ELSE
            v_misc_rem_htg := GREATEST(0, v_misc_due_htg - v_misc_paid_htg);
            v_misc_rem_usd := ROUND((v_misc_rem_htg / v_current_rate)::numeric, 2);
        END IF;
    END IF;

    -- Extinction Scolarité
    IF v_scol_due_usd > 0 THEN
        IF (v_scol_due_usd - v_scol_paid_usd) <= 3.00 OR (v_scol_paid_usd / v_scol_due_usd) >= 0.96 THEN
            v_scol_is_paid := true; v_scol_rem_usd := 0; v_scol_rem_htg := 0;
        ELSE
            v_scol_rem_usd := GREATEST(0, v_scol_due_usd - v_scol_paid_usd);
            v_scol_rem_htg := ROUND((v_scol_rem_usd * v_current_rate)::numeric, 0);
        END IF;
    ELSE
        IF (v_scol_due_htg - v_scol_paid_htg) <= 50.0 OR (v_scol_due_htg > 0 AND (v_scol_paid_htg / v_scol_due_htg) >= 0.98) THEN
            v_scol_is_paid := true; v_scol_rem_htg := 0; v_scol_rem_usd := 0;
        ELSE
            v_scol_rem_htg := GREATEST(0, v_scol_due_htg - v_scol_paid_htg);
            v_scol_rem_usd := ROUND((v_scol_rem_htg / v_current_rate)::numeric, 2);
        END IF;
    END IF;

    -- Extinction Campagnes Ad-Hoc
    IF (v_adhoc_due_htg - v_adhoc_paid_htg) <= 50.0 THEN
        v_adhoc_rem_htg := 0;
    ELSE
        v_adhoc_rem_htg := GREATEST(0, v_adhoc_due_htg - v_adhoc_paid_htg);
    END IF;

    v_raw_cat_debt_htg := v_adm_rem_htg + v_misc_rem_htg + v_scol_rem_htg + v_adhoc_rem_htg;
    v_total_due_htg :=
        CASE WHEN v_adm_is_paid THEN v_adm_paid_htg ELSE v_adm_due_htg + ROUND((v_adm_due_usd * v_current_rate)::numeric, 0) END +
        CASE WHEN v_misc_is_paid THEN v_misc_paid_htg ELSE v_misc_due_htg + ROUND((v_misc_due_usd * v_current_rate)::numeric, 0) END +
        CASE WHEN v_scol_is_paid THEN v_scol_paid_htg ELSE v_scol_due_htg + ROUND((v_scol_due_usd * v_current_rate)::numeric, 0) END +
        v_adhoc_due_htg;

    -- Réconciliation globale anti-arriérés fantômes
    IF (v_total_due_htg - v_total_paid_htg) <= 50.0 OR v_raw_cat_debt_htg <= 50.0 THEN
        v_total_debt_htg := 0;
    ELSE
        v_total_debt_htg := LEAST(v_raw_cat_debt_htg, GREATEST(0, ROUND((v_total_due_htg - v_total_paid_htg)::numeric, 0)));
    END IF;

    RETURN jsonb_build_object(
        'student_id', p_student_id,
        'academic_year_id', v_academic_year_id,
        'active_exchange_rate', v_current_rate,
        'total_debt_htg', v_total_debt_htg,
        'total_paid_htg', v_total_paid_htg,
        'categories', jsonb_build_object(
            'admission', jsonb_build_object('due_htg', v_adm_due_htg, 'due_usd', v_adm_due_usd, 'paid_htg', v_adm_paid_htg, 'remaining_htg', v_adm_rem_htg, 'is_paid', v_adm_is_paid),
            'misc', jsonb_build_object('due_htg', v_misc_due_htg, 'due_usd', v_misc_due_usd, 'paid_htg', v_misc_paid_htg, 'remaining_htg', v_misc_rem_htg, 'is_paid', v_misc_is_paid),
            'tuition', jsonb_build_object('due_htg', v_scol_due_htg, 'due_usd', v_scol_due_usd, 'paid_htg', v_scol_paid_htg, 'remaining_htg', v_scol_rem_htg, 'is_paid', v_scol_is_paid),
            'adhoc', jsonb_build_object('due_htg', v_adhoc_due_htg, 'paid_htg', v_adhoc_paid_htg, 'remaining_htg', v_adhoc_rem_htg, 'is_paid', (v_adhoc_rem_htg = 0))
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
    v_excluded_label TEXT := NULL;
    v_excluded_start_year INTEGER := 0;
BEGIN
    IF v_school_id IS NULL THEN
        SELECT school_id INTO v_school_id FROM public.students WHERE id = p_student_id;
    END IF;

    IF p_exclude_year_id IS NOT NULL THEN
        SELECT label INTO v_excluded_label FROM public.academic_years WHERE id = p_exclude_year_id;
        IF v_excluded_label IS NOT NULL THEN
            v_excluded_start_year := COALESCE((regexp_match(v_excluded_label, '(\d{4})'))[1]::integer, 0);
        END IF;
    END IF;

    FOR v_year_record IN
        SELECT DISTINCT e.academic_year_id
        FROM public.enrollments e
        JOIN public.academic_years ay ON e.academic_year_id = ay.id
        WHERE e.student_id = p_student_id
          AND (v_school_id IS NULL OR e.school_id = v_school_id)
          AND COALESCE(UPPER(e.status), '') NOT IN ('ANNULE', 'ANNULÉ', 'CANCELLED')
          AND (p_exclude_year_id IS NULL OR e.academic_year_id IS DISTINCT FROM p_exclude_year_id)
          AND (ay.status IN ('PAST', 'ACTIVE') OR ay.is_active = true)
          AND COALESCE(UPPER(ay.status), '') NOT IN ('FUTURE', 'PLANIFIEE', 'PLANIFIÉE', 'PREPARATION', 'PRÉPARATION')
          AND (
              v_excluded_start_year = 0
              OR COALESCE((regexp_match(ay.label, '(\d{4})'))[1]::integer, 0) = 0
              OR COALESCE((regexp_match(ay.label, '(\d{4})'))[1]::integer, 0) < v_excluded_start_year
          )
    LOOP
        v_balance_json := public.get_student_real_balance(p_student_id, v_year_record.academic_year_id, v_school_id);
        v_total_debt := v_total_debt + COALESCE((v_balance_json->>'total_debt_htg')::numeric, 0);
    END LOOP;

    RETURN GREATEST(0, ROUND(v_total_debt));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_student_real_balance(UUID, UUID, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_student_global_debt(UUID, UUID, UUID) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
