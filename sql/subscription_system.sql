-- 1. Ajout des colonnes d'abonnement à la table schools
ALTER TABLE public.schools
ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
ADD COLUMN IF NOT EXISTS is_protected BOOLEAN DEFAULT FALSE;

-- 2. Protection de l'école principale (Super Admin)
UPDATE public.schools
SET subscription_plan = 'unlimited',
    subscription_end_date = NULL,
    is_protected = TRUE,
    status = 'ACTIVE'
WHERE id = 'school-2025-premium'; -- L'ID de l'école principale est 'school-2025-premium' d'après les logs précédents

-- 3. Fonction pour vérifier si une école est active (Abonnement valide)
CREATE OR REPLACE FUNCTION public.is_school_active(p_school_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status TEXT;
    v_end_date TIMESTAMP WITH TIME ZONE;
    v_is_protected BOOLEAN;
BEGIN
    SELECT status, subscription_end_date, is_protected 
    INTO v_status, v_end_date, v_is_protected
    FROM public.schools 
    WHERE id = p_school_id;

    -- L'école protégée est toujours active
    IF v_is_protected THEN
        RETURN TRUE;
    END IF;

    -- Vérifier le statut manuel et la date d'expiration
    IF v_status = 'ACTIVE' AND (v_end_date IS NULL OR v_end_date > NOW()) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;

-- 4. Trigger pour empêcher la suspension de l'école protégée
CREATE OR REPLACE FUNCTION public.protect_main_school()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.is_protected AND NEW.status = 'SUSPENDED' THEN
        RAISE EXCEPTION 'L''école principale ne peut pas être suspendue.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_main_school ON public.schools;
CREATE TRIGGER trg_protect_main_school
BEFORE UPDATE OF status ON public.schools
FOR EACH ROW
EXECUTE FUNCTION public.protect_main_school();

-- 5. Fonction RPC pour mettre à jour un abonnement (Utilisée par le Super Admin)
CREATE OR REPLACE FUNCTION public.admin_update_subscription(
    p_school_id TEXT,
    p_plan VARCHAR,
    p_duration_days INTEGER
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_end_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Vérifier si l'utilisateur est Super Admin
    IF NOT public.is_super_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Accès refusé.');
    END IF;

    -- L'école protégée ne peut pas être modifiée
    IF EXISTS (SELECT 1 FROM public.schools WHERE id = p_school_id AND is_protected = TRUE) THEN
        RETURN jsonb_build_object('success', false, 'error', 'L''école principale ne peut pas être modifiée.');
    END IF;

    -- Calculer la nouvelle date de fin
    IF p_plan = 'unlimited' THEN
        v_end_date := NULL;
    ELSE
        v_end_date := NOW() + (p_duration_days || ' days')::INTERVAL;
    END IF;

    -- Mettre à jour l'école
    UPDATE public.schools
    SET subscription_plan = p_plan,
        subscription_start_date = NOW(),
        subscription_end_date = v_end_date,
        status = 'ACTIVE' -- Réactiver automatiquement si suspendue
    WHERE id = p_school_id;

    RETURN jsonb_build_object('success', true, 'message', 'Abonnement mis à jour avec succès.');
END;
$$;
