-- Script pour configurer la suppression en cascade des écoles

BEGIN;

-- 0. Mettre à jour la clé étrangère de profiles vers auth.users pour ajouter ON DELETE CASCADE
DO $$
DECLARE
  fk RECORD;
  q TEXT;
BEGIN
  FOR fk IN
    SELECT
      tc.table_schema,
      tc.table_name,
      tc.constraint_name,
      kcu.column_name,
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'profiles' AND ccu.table_name = 'users' AND ccu.table_schema = 'auth'
  LOOP
    q := format('ALTER TABLE %I.%I DROP CONSTRAINT %I, ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I.%I(%I) ON DELETE CASCADE;',
                fk.table_schema, fk.table_name, fk.constraint_name, fk.constraint_name, fk.column_name, fk.foreign_table_schema, fk.foreign_table_name, fk.foreign_column_name);
    EXECUTE q;
    RAISE NOTICE 'Updated FK to CASCADE for profiles -> auth.users';
  END LOOP;
END;
$$;

-- 1. Mettre à jour toutes les clés étrangères pointant vers 'schools' pour ajouter ON DELETE CASCADE
DO $$
DECLARE
  fk RECORD;
  q TEXT;
BEGIN
  FOR fk IN
    SELECT
      tc.table_schema,
      tc.table_name,
      tc.constraint_name,
      kcu.column_name,
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'schools'
  LOOP
    q := format('ALTER TABLE %I.%I DROP CONSTRAINT %I, ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I.%I(%I) ON DELETE CASCADE;',
                fk.table_schema, fk.table_name, fk.constraint_name, fk.constraint_name, fk.column_name, fk.foreign_table_schema, fk.foreign_table_name, fk.foreign_column_name);
    EXECUTE q;
    RAISE NOTICE 'Updated FK to CASCADE for table: %', fk.table_name;
  END LOOP;
END;
$$;

-- 2. Créer un trigger pour supprimer les utilisateurs de auth.users quand une école est supprimée
-- Cela supprimera également les profils si la clé étrangère de profiles vers auth.users est en CASCADE
CREATE OR REPLACE FUNCTION public.delete_school_users()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- 2.1. Supprimer manuellement les données enfants pour éviter les erreurs de clés étrangères
  -- On utilise des blocs BEGIN...EXCEPTION pour chaque table afin d'ignorer les erreurs si elles n'existent pas
  
  -- Enfants des étudiants
  BEGIN
    DELETE FROM public.grades WHERE student_id IN (SELECT id FROM public.students WHERE school_id = OLD.id);
    DELETE FROM public.payments WHERE student_id IN (SELECT id FROM public.students WHERE school_id = OLD.id);
    DELETE FROM public.enrollments WHERE student_id IN (SELECT id FROM public.students WHERE school_id = OLD.id);
  EXCEPTION WHEN undefined_table THEN NULL; END;
  
  -- Enfants des classes
  BEGIN
    DELETE FROM public.class_schedules WHERE class_id IN (SELECT id FROM public.classes WHERE school_id = OLD.id);
    DELETE FROM public.class_subjects WHERE class_id IN (SELECT id FROM public.classes WHERE school_id = OLD.id);
  EXCEPTION WHEN undefined_table THEN NULL; END;
  
  -- Enfants du personnel
  BEGIN
    DELETE FROM public.staff_attendances WHERE staff_id IN (SELECT id FROM public.staff WHERE school_id = OLD.id);
    DELETE FROM public.staff_assignments WHERE staff_id IN (SELECT id FROM public.staff WHERE school_id = OLD.id);
    DELETE FROM public.salary_advances WHERE staff_id IN (SELECT id FROM public.staff WHERE school_id = OLD.id);
    DELETE FROM public.payroll_slips WHERE staff_id IN (SELECT id FROM public.staff WHERE school_id = OLD.id);
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- 2.2. Boucler sur tous les profils de cette école pour supprimer les comptes d'authentification
  FOR v_user_id IN SELECT id FROM public.profiles WHERE school_id = OLD.id LOOP
    -- Supprimer l'utilisateur de auth.users (ce qui devrait cascader vers profiles)
    DELETE FROM auth.users WHERE id = v_user_id;
  END LOOP;
  
  -- Au cas où, on supprime explicitement les profils restants
  DELETE FROM public.profiles WHERE school_id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS before_school_delete ON public.schools;
CREATE TRIGGER before_school_delete
BEFORE DELETE ON public.schools
FOR EACH ROW EXECUTE FUNCTION public.delete_school_users();

COMMIT;

NOTIFY pgrst, 'reload schema';
