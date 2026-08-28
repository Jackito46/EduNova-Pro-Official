
-- ==========================================================
-- SCRIPT DE MIGRATION FINAL (V2) - EduNova Pro
-- Correction : Contrainte NOT NULL sur la colonne email
-- À exécuter dans le SQL Editor de Supabase
-- ==========================================================

DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    -- 1. SUPPRESSION DES CLÉS ÉTRANGÈRES LIÉES À school_id
    FOR r IN (
        SELECT tc.constraint_name, tc.table_name 
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu 
          ON tc.constraint_name = kcu.constraint_name 
          AND tc.table_schema = kcu.table_schema
        WHERE kcu.column_name = 'school_id'
          AND tc.table_schema = 'public'
          AND tc.constraint_type = 'FOREIGN KEY'
    ) LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', r.table_name, r.constraint_name);
    END LOOP;

    -- 2. SUPPRESSION DE TOUTES LES POLITIQUES (POLICIES)
    FOR r IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('profiles', 'staff', 'students', 'classes', 'subjects', 'payments', 'expenses')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;

    -- 3. DÉSACTIVATION TEMPORAIRE DU RLS
    ALTER TABLE IF EXISTS public.profiles DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.staff DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.students DISABLE ROW LEVEL SECURITY;
END $$;



-- 5. RE-CRÉATION DES FONCTIONS DE SÉCURITÉ (SUPPORT TEXT)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR')
  );
END; $$;

CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN (SELECT school_id FROM public.profiles WHERE id = auth.uid() LIMIT 1);
END; $$;

-- 6. RÉINSTALLATION DES POLITIQUES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles access" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Profiles update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read" ON public.staff FOR SELECT USING (school_id = public.get_my_school_id());
CREATE POLICY "Staff manage" ON public.staff FOR ALL USING (public.is_admin());

-- 7. PROMOTION FORCEE DE L'ADMIN (UID : a0ed9087-0554-40ae-ac26-86599a183b16)
-- Ajout de l'email pour satisfaire toute contrainte résiduelle lors de l'INSERT
INSERT INTO public.profiles (id, full_name, email, role, school_id, is_super_admin)
VALUES (
    'a0ed9087-0554-40ae-ac26-86599a183b16'::uuid, 
    'Super Administrateur', 
    'admin@edunova.pro',
    'SCHOOL_ADMIN', 
    'a0ed9087-0554-40ae-ac26-86599a183b16'::uuid,
    TRUE
)
ON CONFLICT (id) DO UPDATE 
SET role = 'SCHOOL_ADMIN', 
    school_id = 'a0ed9087-0554-40ae-ac26-86599a183b16'::uuid,
    is_super_admin = TRUE,
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;

-- 8. VÉRIFICATION
SELECT id, role, school_id, email FROM public.profiles WHERE id = 'a0ed9087-0554-40ae-ac26-86599a183b16'::uuid;
