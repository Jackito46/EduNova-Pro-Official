-- ==========================================================
-- SCRIPT DE RÉPARATION DE LA SUPPRESSION EN CASCADE
-- ==========================================================

BEGIN;

-- 1. Créer la table class_schedules si elle n'existe pas
-- Cela évitera l'erreur "relation does not exist"
CREATE TABLE IF NOT EXISTS public.class_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Lundi, 7=Dimanche
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

-- Enable RLS
ALTER TABLE public.class_schedules ENABLE ROW LEVEL SECURITY;

-- 2. Mettre à jour la fonction de suppression pour être plus robuste
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

  -- 2.2. Supprimer les comptes d'authentification
  FOR v_user_id IN SELECT id FROM public.profiles WHERE school_id = OLD.id LOOP
    DELETE FROM auth.users WHERE id = v_user_id;
  END LOOP;
  
  -- On supprime explicitement les profils restants
  DELETE FROM public.profiles WHERE school_id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

NOTIFY pgrst, 'reload schema';
