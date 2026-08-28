-- SCRIPT DE MIGRATION CRITIQUE : STANDARDISATION DES SCHOOL_ID VERS UUID (CORRIGÉ V6)
-- Ce script va :
-- 1. Identifier toutes les tables avec une colonne school_id
-- 2. Convertir les anciens ID (ex: 'school-2025-premium') vers le UUID du Super Admin
-- 3. Générer des UUID valides pour les autres écoles (ex: 'school-sainte-marie')
-- 4. Convertir toutes les colonnes school_id et schools.id en type UUID
-- 5. Recréer proprement toutes les clés étrangères

-- 0. Supprimer les vues qui dépendent des tables à modifier (elles empêchent le changement de type)
DROP VIEW IF EXISTS public.v_active_fee_plans CASCADE;

DO $$
DECLARE
    r RECORD;
    fk RECORD;
    school_rec RECORD;
    v_main_school_id UUID := 'a0ed9087-0554-40ae-ac26-86599a183b16';
    v_old_school_id TEXT := 'school-2025-premium';
    v_new_uuid UUID;
    pol RECORD;
    v_sql TEXT;
BEGIN
    -- 1. Sauvegarder toutes les politiques RLS dans une table temporaire
    CREATE TEMP TABLE temp_policies AS
    SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public';

    -- 2. Supprimer toutes les politiques RLS pour permettre la modification des colonnes
    FOR pol IN SELECT schemaname, tablename, policyname FROM temp_policies
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;

    -- 3. Désactiver temporairement les triggers et contraintes pour la migration
    SET session_replication_role = 'replica';

    -- 4. Trouver et supprimer toutes les clés étrangères qui pointent vers schools(id)
    FOR fk IN
        SELECT
            tc.table_schema, 
            tc.table_name, 
            tc.constraint_name
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'schools' AND ccu.column_name = 'id'
    LOOP
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I', fk.table_schema, fk.table_name, fk.constraint_name);
    END LOOP;

    -- Supprimer aussi les clés étrangères nommées explicitement (uniquement sur les tables de base)
    FOR r IN 
        SELECT c.table_name 
        FROM information_schema.columns c
        JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
        WHERE c.column_name = 'school_id' AND c.table_schema = 'public' AND c.table_name != 'schools' AND t.table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I_school_id_fkey', r.table_name, r.table_name);
    END LOOP;

    -- 5. S'assurer que l'école principale existe avec le bon UUID
    EXECUTE format('
        INSERT INTO public.schools (id, name, status, subscription_plan, is_protected)
        VALUES (%L, ''École Principale (Super Admin)'', ''ACTIVE'', ''unlimited'', TRUE)
        ON CONFLICT (id) DO UPDATE 
        SET is_protected = TRUE, subscription_plan = ''unlimited'', status = ''ACTIVE''
    ', v_main_school_id::text);

    -- 6. Traiter chaque école existante
    FOR school_rec IN SELECT id::text AS id FROM public.schools WHERE id::text != v_main_school_id::text
    LOOP
        -- Si l'ID est l'ancien ID du Super Admin
        IF school_rec.id = v_old_school_id THEN
            v_new_uuid := v_main_school_id;
        -- Si l'ID n'est pas un UUID valide (ex: 'school-sainte-marie')
        ELSIF school_rec.id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            v_new_uuid := extensions.uuid_generate_v4();
        ELSE
            -- C'est déjà un UUID valide, on passe au suivant
            CONTINUE;
        END IF;

        -- Mettre à jour toutes les tables enfants (uniquement les tables de base)
        FOR r IN 
            SELECT c.table_schema, c.table_name, c.column_name, c.data_type
            FROM information_schema.columns c
            JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
            WHERE c.column_name = 'school_id' AND c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
        LOOP
            IF r.data_type IN ('text', 'character varying', 'varchar') THEN
                BEGIN
                    EXECUTE format('UPDATE %I.%I SET %I = %L WHERE %I = %L', 
                        r.table_schema, r.table_name, r.column_name, v_new_uuid::text, r.column_name, school_rec.id);
                EXCEPTION WHEN unique_violation THEN
                    -- Si conflit, on supprime l'ancien enregistrement en double
                    EXECUTE format('DELETE FROM %I.%I WHERE %I = %L', 
                        r.table_schema, r.table_name, r.column_name, school_rec.id);
                END;
            END IF;
        END LOOP;

        -- Mettre à jour la table schools ou supprimer l'ancien doublon
        IF school_rec.id = v_old_school_id THEN
            EXECUTE format('DELETE FROM public.schools WHERE id::text = %L', v_old_school_id);
        ELSE
            EXECUTE format('UPDATE public.schools SET id = %L WHERE id::text = %L', v_new_uuid::text, school_rec.id);
        END IF;
    END LOOP;

    -- 7. Convertir la colonne id de la table schools en UUID
    ALTER TABLE public.schools ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE public.schools ALTER COLUMN id TYPE UUID USING id::UUID;

    -- 8. Convertir toutes les colonnes school_id en UUID et recréer les clés étrangères
    FOR r IN 
        SELECT c.table_schema, c.table_name, c.column_name, c.data_type
        FROM information_schema.columns c
        JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
        WHERE c.column_name = 'school_id' AND c.table_schema = 'public' AND c.table_name != 'schools' AND t.table_type = 'BASE TABLE'
    LOOP
        -- A. Supprimer la valeur par défaut en texte (ex: 'school-2025-premium') qui bloque la conversion
        EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I DROP DEFAULT', 
            r.table_schema, r.table_name, r.column_name);

        -- B. NETTOYAGE EXTRÊME : Gérer les orphelins restants
        IF r.data_type IN ('text', 'character varying', 'varchar') THEN
            BEGIN
                EXECUTE format('UPDATE %I.%I SET %I = %L WHERE %I !~ ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''', 
                    r.table_schema, r.table_name, r.column_name, v_main_school_id::text, r.column_name);
            EXCEPTION WHEN unique_violation THEN
                -- S'il y a un conflit (ex: catégories de dépenses en double), on supprime les orphelins
                EXECUTE format('DELETE FROM %I.%I WHERE %I !~ ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''', 
                    r.table_schema, r.table_name, r.column_name);
            END;
        END IF;

        -- C. Convertir la colonne en UUID
        EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I TYPE UUID USING %I::UUID', 
            r.table_schema, r.table_name, r.column_name, r.column_name);
            
        -- D. Remettre une valeur par défaut valide (le UUID du Super Admin)
        EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT %L::UUID', 
            r.table_schema, r.table_name, r.column_name, v_main_school_id::text);

        -- E. Recréer la clé étrangère vers schools(id)
        EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I_school_id_fkey FOREIGN KEY (%I) REFERENCES public.schools(id) ON DELETE CASCADE', 
            r.table_schema, r.table_name, r.table_name, r.column_name);
    END LOOP;

    -- 9. Mettre à jour la fonction get_my_school_id()
    -- IMPORTANT: Il faut DROP la fonction d'abord car on change son type de retour (TEXT -> UUID)
    EXECUTE '
    DROP FUNCTION IF EXISTS public.get_my_school_id() CASCADE;
    CREATE OR REPLACE FUNCTION public.get_my_school_id()
    RETURNS UUID
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $func$
    BEGIN
      RETURN (
        SELECT school_id 
        FROM public.profiles 
        WHERE id = auth.uid() 
        LIMIT 1
      );
    END;
    $func$;
    ';

    -- 10. Recréer toutes les politiques RLS
    FOR pol IN SELECT * FROM temp_policies
    LOOP
        v_sql := format('CREATE POLICY %I ON %I.%I FOR %s ', pol.policyname, pol.schemaname, pol.tablename, pol.cmd);
        
        IF pol.roles IS NOT NULL AND array_length(pol.roles, 1) > 0 AND pol.roles[1] != 'public' THEN
            v_sql := v_sql || format('TO %s ', array_to_string(pol.roles, ', '));
        END IF;
        
        IF pol.qual IS NOT NULL THEN
            v_sql := v_sql || format('USING (%s) ', pol.qual);
        END IF;
        
        IF pol.with_check IS NOT NULL THEN
            v_sql := v_sql || format('WITH CHECK (%s)', pol.with_check);
        END IF;
        
        BEGIN
            EXECUTE v_sql;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Erreur lors de la recréation de la politique % sur %.% : %', pol.policyname, pol.schemaname, pol.tablename, SQLERRM;
        END;
    END LOOP;

    DROP TABLE temp_policies;

    -- 11. Réactiver les triggers
    SET session_replication_role = 'origin';

    -- 11.5. Ajouter is_super_admin si manquant
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

END $$;

-- 11.6. Créer la fonction is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND is_super_admin = TRUE
  );
END; $$;

-- 12. Recréer la vue qui a été supprimée
CREATE OR REPLACE VIEW public.v_active_fee_plans AS
SELECT 
    fp.*,
    ay.label as year_label,
    c.name as class_name,
    c.level as class_level
FROM public.fee_plans fp
JOIN public.academic_years ay ON fp.academic_year_id = ay.id
JOIN public.classes c ON fp.class_id = c.id
WHERE ay.is_active = true;

-- 13. Mettre à jour la fonction RPC de création de tenant pour qu'elle utilise des UUID
CREATE OR REPLACE FUNCTION public.admin_create_tenant(
    p_school_name TEXT,
    p_admin_email TEXT,
    p_admin_password TEXT,
    p_admin_name TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_school_id UUID;
    v_user_id UUID;
    v_encrypted_pw TEXT;
BEGIN
    IF NOT public.is_super_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Accès refusé. Seul un Super Admin peut créer un établissement.');
    END IF;

    IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_admin_email) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cet email est déjà utilisé par un autre utilisateur.');
    END IF;

    v_school_id := extensions.uuid_generate_v4();

    INSERT INTO public.schools (id, name, status, subscription_plan)
    VALUES (v_school_id, p_school_name, 'ACTIVE', 'trial');

    v_user_id := extensions.uuid_generate_v4();
    v_encrypted_pw := extensions.crypt(p_admin_password, extensions.gen_salt('bf'));
    
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated', p_admin_email, v_encrypted_pw, now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', p_admin_name, 'school_id', v_school_id),
        now(), now()
    );

    INSERT INTO public.profiles (id, email, full_name, role, school_id, is_super_admin)
    VALUES (v_user_id, p_admin_email, p_admin_name, 'SCHOOL_ADMIN', v_school_id, FALSE)
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        school_id = EXCLUDED.school_id,
        is_super_admin = EXCLUDED.is_super_admin;

    RETURN jsonb_build_object('success', true, 'school_id', v_school_id, 'admin_id', v_user_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 14. Mettre à jour is_school_active pour accepter un UUID
-- IMPORTANT: Il faut DROP l'ancienne fonction car on change le type de l'argument
DROP FUNCTION IF EXISTS public.is_school_active(TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.is_school_active(p_school_id UUID)
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

    IF v_is_protected THEN
        RETURN TRUE;
    END IF;

    IF v_status = 'ACTIVE' AND (v_end_date IS NULL OR v_end_date > NOW()) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;

-- 15. Mettre à jour admin_update_subscription pour accepter un UUID
-- IMPORTANT: Il faut DROP l'ancienne fonction car on change le type de l'argument
DROP FUNCTION IF EXISTS public.admin_update_subscription(TEXT, VARCHAR, INTEGER) CASCADE;
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
    v_end_date TIMESTAMP WITH TIME ZONE;
BEGIN
    IF NOT public.is_super_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Accès refusé.');
    END IF;

    IF EXISTS (SELECT 1 FROM public.schools WHERE id = p_school_id AND is_protected = TRUE) THEN
        RETURN jsonb_build_object('success', false, 'error', 'L''école principale ne peut pas être modifiée.');
    END IF;

    IF p_plan = 'unlimited' THEN
        v_end_date := NULL;
    ELSE
        v_end_date := NOW() + (p_duration_days || ' days')::INTERVAL;
    END IF;

    UPDATE public.schools
    SET subscription_plan = p_plan,
        subscription_start_date = NOW(),
        subscription_end_date = v_end_date,
        status = 'ACTIVE'
    WHERE id = p_school_id;

    RETURN jsonb_build_object('success', true, 'message', 'Abonnement mis à jour avec succès.');
END;
$$;

-- 16. Mettre à jour le trigger handle_new_user pour gérer les UUID et is_super_admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth
AS $$
DECLARE
  v_school_id UUID;
  v_is_super_admin BOOLEAN := FALSE;
BEGIN
  IF new.raw_user_meta_data->>'school_id' IS NOT NULL THEN
    v_school_id := (new.raw_user_meta_data->>'school_id')::uuid;
  ELSE
    SELECT id INTO v_school_id FROM public.schools ORDER BY created_at ASC LIMIT 1;
  END IF;

  IF new.raw_user_meta_data->>'is_super_admin' = 'true' THEN
    v_is_super_admin := TRUE;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, school_id, is_super_admin)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Utilisateur ' || substring(new.id::text, 1, 5)), 
    COALESCE(new.raw_user_meta_data->>'role', 'SCHOOL_ADMIN'),
    v_school_id,
    v_is_super_admin
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RETURN new;
END;
$$;

-- 17. Recréer les politiques RLS critiques avec le bon type (UUID) pour être sûr à 100%
DROP POLICY IF EXISTS "Schools isolation" ON public.schools;
CREATE POLICY "Schools isolation" ON public.schools
FOR SELECT USING (
    public.is_super_admin() 
    OR id = public.get_my_school_id()
);

DROP POLICY IF EXISTS "Profiles isolation" ON public.profiles;
CREATE POLICY "Profiles isolation" ON public.profiles
FOR ALL USING (
    id = auth.uid() 
    OR public.is_super_admin() 
    OR school_id = public.get_my_school_id()
);

-- 18. Forcer le rechargement du schéma pour l'API
NOTIFY pgrst, 'reload schema';
