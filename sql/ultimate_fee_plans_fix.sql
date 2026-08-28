-- SCRIPT DE CORRECTION DÉFINITIVE POUR LES PLANS TARIFAIRES ET PAIEMENTS
-- Ce script remplace les anciens identifiants texte par votre véritable identifiant d'école (UUID)

DO $$ 
DECLARE
    v_real_school_id UUID;
    v_col_type TEXT;
BEGIN
    -- 1. Récupérer votre véritable identifiant d'école
    SELECT id INTO v_real_school_id FROM public.schools LIMIT 1;
    
    IF v_real_school_id IS NULL THEN
        RAISE NOTICE 'Aucune école trouvée dans la base de données !';
        RETURN;
    END IF;

    RAISE NOTICE 'Utilisation de l''identifiant école : %', v_real_school_id;

    -- 2. Corriger la table fee_plans (Plans Tarifaires)
    SELECT data_type INTO v_col_type FROM information_schema.columns WHERE table_name = 'fee_plans' AND column_name = 'school_id' AND table_schema = 'public';
    
    IF v_col_type = 'text' THEN
        RAISE NOTICE 'Correction de fee_plans (TEXT -> UUID)...';
        -- Remplacer les textes invalides (ex: 'school-2025-premium') par le vrai UUID
        UPDATE public.fee_plans SET school_id = v_real_school_id::text WHERE school_id NOT LIKE '%-%-%-%-%';
        -- Convertir la colonne en UUID
        ALTER TABLE public.fee_plans ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
    ELSE
        RAISE NOTICE 'fee_plans est déjà en UUID. Alignement des données...';
        UPDATE public.fee_plans SET school_id = v_real_school_id WHERE school_id != v_real_school_id;
    END IF;

    -- 3. Corriger la table payments (Paiements)
    SELECT data_type INTO v_col_type FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'school_id' AND table_schema = 'public';
    
    IF v_col_type = 'text' THEN
        RAISE NOTICE 'Correction de payments (TEXT -> UUID)...';
        UPDATE public.payments SET school_id = v_real_school_id::text WHERE school_id NOT LIKE '%-%-%-%-%';
        ALTER TABLE public.payments ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
    ELSE
        RAISE NOTICE 'payments est déjà en UUID. Alignement des données...';
        UPDATE public.payments SET school_id = v_real_school_id WHERE school_id != v_real_school_id;
    END IF;

    -- 4. Corriger la table academic_years (Années Académiques)
    SELECT data_type INTO v_col_type FROM information_schema.columns WHERE table_name = 'academic_years' AND column_name = 'school_id' AND table_schema = 'public';
    
    IF v_col_type = 'text' THEN
        UPDATE public.academic_years SET school_id = v_real_school_id::text WHERE school_id NOT LIKE '%-%-%-%-%';
        ALTER TABLE public.academic_years ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
    ELSE
        UPDATE public.academic_years SET school_id = v_real_school_id WHERE school_id != v_real_school_id;
    END IF;

    -- 5. Corriger la table classes
    SELECT data_type INTO v_col_type FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'school_id' AND table_schema = 'public';
    
    IF v_col_type = 'text' THEN
        UPDATE public.classes SET school_id = v_real_school_id::text WHERE school_id NOT LIKE '%-%-%-%-%';
        ALTER TABLE public.classes ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
    ELSE
        UPDATE public.classes SET school_id = v_real_school_id WHERE school_id != v_real_school_id;
    END IF;

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Erreur lors de la correction : %', SQLERRM;
END $$;

-- 6. Recréer les politiques de sécurité avec le bon format
DROP POLICY IF EXISTS "FP View" ON public.fee_plans;
DROP POLICY IF EXISTS "FP Manage" ON public.fee_plans;

CREATE POLICY "FP View" ON public.fee_plans FOR SELECT USING (
  school_id = public.get_my_school_id() OR public.is_super_admin()
);
CREATE POLICY "FP Manage" ON public.fee_plans FOR ALL USING (
  school_id = public.get_my_school_id() OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Payments read" ON public.payments;
DROP POLICY IF EXISTS "Payments manage" ON public.payments;

CREATE POLICY "Payments read" ON public.payments FOR SELECT USING (
  school_id = public.get_my_school_id() OR public.is_super_admin()
);
CREATE POLICY "Payments manage" ON public.payments FOR ALL USING (
  school_id = public.get_my_school_id() OR public.is_super_admin()
);
