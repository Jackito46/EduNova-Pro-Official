-- Mettre à jour admin_update_subscription pour ajouter des jours à la date d'expiration existante
DROP FUNCTION IF EXISTS public.admin_update_subscription(UUID, VARCHAR, INTEGER) CASCADE;
CREATE OR REPLACE FUNCTION public.admin_update_subscription(
    p_school_id UUID,
    p_plan VARCHAR,
    p_duration_days INTEGER
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_end_date TIMESTAMP WITH TIME ZONE;
    v_end_date TIMESTAMP WITH TIME ZONE;
BEGIN
    IF NOT public.is_super_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Accès refusé.');
    END IF;

    IF EXISTS (SELECT 1 FROM public.schools WHERE id = p_school_id AND is_protected = TRUE) THEN
        RETURN jsonb_build_object('success', false, 'error', 'L''école principale ne peut pas être modifiée.');
    END IF;

    SELECT subscription_end_date INTO v_current_end_date FROM public.schools WHERE id = p_school_id;

    IF p_plan = 'unlimited' THEN
        v_end_date := NULL;
    ELSE
        -- Si l'abonnement est encore valide, on ajoute les jours à la date d'expiration actuelle
        IF v_current_end_date IS NOT NULL AND v_current_end_date > NOW() THEN
            v_end_date := v_current_end_date + (p_duration_days || ' days')::INTERVAL;
        ELSE
            -- Sinon, on commence à partir d'aujourd'hui
            v_end_date := NOW() + (p_duration_days || ' days')::INTERVAL;
        END IF;
    END IF;

    UPDATE public.schools
    SET subscription_plan = p_plan,
        subscription_start_date = COALESCE(subscription_start_date, NOW()),
        subscription_end_date = v_end_date,
        status = 'ACTIVE'
    WHERE id = p_school_id;

    RETURN jsonb_build_object('success', true, 'message', 'Abonnement mis à jour avec succès.');
END;
$$;

NOTIFY pgrst, 'reload schema';
