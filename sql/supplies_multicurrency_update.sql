-- 1. Update supply_catalog
ALTER TABLE public.supply_catalog ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'HTG';
ALTER TABLE public.supply_catalog ADD COLUMN IF NOT EXISTS planned_exchange_rate NUMERIC DEFAULT 1;

-- 2. Update school_supplies (Purchases)
-- Drop the unique constraint that prevents multiple purchases
ALTER TABLE public.school_supplies DROP CONSTRAINT IF EXISTS school_supplies_student_id_academic_year_id_key;

ALTER TABLE public.school_supplies ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
ALTER TABLE public.school_supplies ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'HTG';
ALTER TABLE public.school_supplies ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PAID';

-- 3. Update supply_payments
ALTER TABLE public.supply_payments ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'HTG';
ALTER TABLE public.supply_payments ADD COLUMN IF NOT EXISTS exchange_rate_applied NUMERIC DEFAULT 1;
ALTER TABLE public.supply_payments ADD COLUMN IF NOT EXISTS amount_htg_equivalent NUMERIC;

-- 4. Update get_student_global_debt to EXCLUDE inscription_fee
CREATE OR REPLACE FUNCTION public.get_student_global_debt(p_student_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_total_due NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_discount NUMERIC := 0;
BEGIN
    -- Calculer tout ce que l'élève aurait dû payer (Scolarité + Frais divers obligatoires)
    -- On EXCLUT les frais d'inscription car ils sont payés à l'admission
    SELECT COALESCE(SUM(
        fp.tuition_fee + 
        CASE WHEN fp.is_misc_mandatory THEN COALESCE(fp.misc_fee_htg, 0) ELSE 0 END
    ), 0)
    INTO v_total_due
    FROM public.enrollments e
    JOIN public.fee_plans fp ON e.class_id = fp.class_id AND e.academic_year_id = fp.academic_year_id
    WHERE e.student_id = p_student_id;

    SELECT COALESCE(discount_amount, 0) INTO v_discount FROM public.students WHERE id = p_student_id;

    -- On ne compte que les paiements de scolarité et divers pour la dette principale
    SELECT COALESCE(SUM(COALESCE(amount_htg_equivalent, amount)), 0)
    INTO v_total_paid
    FROM public.payments
    WHERE student_id = p_student_id AND fee_type IN ('SCOLARITE', 'DIVERS');

    RETURN GREATEST(v_total_due - v_discount - v_total_paid, 0);
END;
$$ LANGUAGE plpgsql;

-- 5. Update check_payment_order trigger to remove inscription rule
CREATE OR REPLACE FUNCTION public.check_payment_order()
RETURNS TRIGGER AS $$
DECLARE
    v_misc_paid NUMERIC;
    v_misc_required_htg NUMERIC;
    v_is_misc_mandatory BOOLEAN;
BEGIN
    IF NEW.academic_year_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT fp.misc_fee_htg, fp.is_misc_mandatory
    INTO v_misc_required_htg, v_is_misc_mandatory
    FROM public.enrollments e
    JOIN public.fee_plans fp ON fp.academic_year_id = e.academic_year_id AND fp.class_id = e.class_id
    WHERE e.student_id = NEW.student_id AND e.academic_year_id = NEW.academic_year_id;

    SELECT COALESCE(SUM(amount_htg_equivalent), 0) INTO v_misc_paid
    FROM public.payments
    WHERE student_id = NEW.student_id AND academic_year_id = NEW.academic_year_id AND fee_type = 'DIVERS';

    -- RÈGLE : Les frais divers (si obligatoires) doivent être payés avant la scolarité
    IF NEW.fee_type = 'SCOLARITE' AND v_is_misc_mandatory = true THEN
        IF v_misc_paid < v_misc_required_htg THEN
            RAISE EXCEPTION 'Règle stricte : Les frais divers obligatoires doivent être réglés avant l''écolage.';
        END IF;
    END IF;

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

NOTIFY pgrst, 'reload schema';
