CREATE TABLE IF NOT EXISTS public.ad_hoc_campaigns (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    campus_id UUID REFERENCES public.school_campuses(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    type TEXT DEFAULT 'AUTRE',
    name TEXT NOT NULL,
    description TEXT,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'HTG' CHECK (currency IN ('HTG', 'USD')),
    duration_days INTEGER,
    start_date DATE,
    end_date DATE,
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Backward compatibility for already existing tables in tenant databases without these columns
DO $$ 
BEGIN
    BEGIN ALTER TABLE public.ad_hoc_campaigns ADD COLUMN campus_id UUID REFERENCES public.school_campuses(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.ad_hoc_campaigns ADD COLUMN class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.ad_hoc_campaigns ADD COLUMN type TEXT DEFAULT 'AUTRE'; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.ad_hoc_campaigns ADD COLUMN duration_days INTEGER; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.ad_hoc_campaigns ADD COLUMN start_date DATE; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.ad_hoc_campaigns ADD COLUMN end_date DATE; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.payments ADD COLUMN ad_hoc_campaign_id UUID REFERENCES public.ad_hoc_campaigns(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_column THEN END;
END $$;


ALTER TABLE public.ad_hoc_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ad_hoc_campaigns_isolation" ON public.ad_hoc_campaigns;
CREATE POLICY "ad_hoc_campaigns_isolation" ON public.ad_hoc_campaigns FOR ALL USING (school_id = public.get_my_school_id());

CREATE TABLE IF NOT EXISTS public.student_ad_hoc_fees (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES public.ad_hoc_campaigns(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(campaign_id, student_id)
);

ALTER TABLE public.student_ad_hoc_fees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "student_ad_hoc_fees_isolation" ON public.student_ad_hoc_fees;
CREATE POLICY "student_ad_hoc_fees_isolation" ON public.student_ad_hoc_fees FOR ALL USING (school_id = public.get_my_school_id());

CREATE OR REPLACE FUNCTION public.get_student_global_debt(p_student_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_total_due NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_discount NUMERIC := 0;
    v_ad_hoc_due NUMERIC := 0;
BEGIN
    SELECT COALESCE(SUM(
        fp.tuition_fee + 
        fp.inscription_fee + 
        CASE WHEN fp.is_misc_mandatory THEN COALESCE(fp.misc_fee_htg, 0) ELSE 0 END
    ), 0)
    INTO v_total_due
    FROM public.enrollments e
    JOIN public.fee_plans fp ON e.class_id = fp.class_id AND e.academic_year_id = fp.academic_year_id
    WHERE e.student_id = p_student_id;

    -- Add ad_hoc_fees total
    SELECT COALESCE(SUM(c.amount), 0)
    INTO v_ad_hoc_due
    FROM public.student_ad_hoc_fees s
    JOIN public.ad_hoc_campaigns c ON s.campaign_id = c.id
    WHERE s.student_id = p_student_id;

    v_total_due := v_total_due + v_ad_hoc_due;

    SELECT COALESCE(discount_amount, 0) INTO v_discount FROM public.students WHERE id = p_student_id;

    SELECT COALESCE(SUM(COALESCE(amount_htg_equivalent, amount)), 0)
    INTO v_total_paid
    FROM public.payments
    WHERE student_id = p_student_id;

    RETURN GREATEST(v_total_due - v_discount - v_total_paid, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_student_global_debt(p_student_id uuid, p_exclude_year_id uuid DEFAULT NULL::uuid)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_total_due NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_ad_hoc_due NUMERIC := 0;
BEGIN
    SELECT COALESCE(SUM(
        fp.tuition_fee + 
        CASE WHEN fp.is_misc_mandatory THEN COALESCE(fp.misc_fee_htg, 0) ELSE 0 END
    ), 0)
    INTO v_total_due
    FROM public.enrollments e
    JOIN public.fee_plans fp ON e.class_id = fp.class_id AND e.academic_year_id = fp.academic_year_id
    WHERE e.student_id = p_student_id
    AND (p_exclude_year_id IS NULL OR e.academic_year_id IS DISTINCT FROM p_exclude_year_id);

    SELECT COALESCE(SUM(c.amount), 0)
    INTO v_ad_hoc_due
    FROM public.student_ad_hoc_fees s
    JOIN public.ad_hoc_campaigns c ON s.campaign_id = c.id
    WHERE s.student_id = p_student_id
    AND (p_exclude_year_id IS NULL OR c.academic_year_id IS DISTINCT FROM p_exclude_year_id);

    v_total_due := v_total_due + v_ad_hoc_due;

    SELECT COALESCE(SUM(COALESCE(amount_htg_equivalent, amount)), 0)
    INTO v_total_paid
    FROM public.payments
    WHERE student_id = p_student_id 
    AND fee_type IN ('SCOLARITE', 'DIVERS', 'AD_HOC')
    AND (p_exclude_year_id IS NULL OR academic_year_id IS DISTINCT FROM p_exclude_year_id);

    RETURN GREATEST(v_total_due - v_total_paid, 0);
END;
$function$;

NOTIFY pgrst, 'reload schema';
