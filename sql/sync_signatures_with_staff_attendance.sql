-- Migration: Synchronisation automatique entre les présences des employés (staff_attendances) et les émargements de cours (course_signatures)

-- 1. Mettre à jour immédiatement les émargements existants dont la présence de l'employé est déjà validée ('Présent' ou 'Retard')
UPDATE public.course_signatures cs
SET signature_status = 'VALIDATED', updated_at = NOW()
FROM public.staff_attendances sa
WHERE cs.school_id = sa.school_id
  AND cs.staff_id = sa.staff_id
  AND cs.date = sa.date
  AND sa.status IN ('Présent', 'Retard')
  AND cs.signature_status = 'SIGNED';

-- 2. Fonction trigger pour valider automatiquement les émargements lors du pointage d'un employé dans staff_attendances
CREATE OR REPLACE FUNCTION public.trg_auto_validate_course_signatures_on_attendance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('Présent', 'Retard') THEN
        UPDATE public.course_signatures
        SET signature_status = 'VALIDATED',
            updated_at = NOW()
        WHERE school_id = NEW.school_id
          AND staff_id = NEW.staff_id
          AND date = NEW.date
          AND signature_status = 'SIGNED';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supprimer le trigger s'il existe déjà et le recréer
DROP TRIGGER IF EXISTS trg_staff_attendance_sync_signatures ON public.staff_attendances;
CREATE TRIGGER trg_staff_attendance_sync_signatures
AFTER INSERT OR UPDATE ON public.staff_attendances
FOR EACH ROW
EXECUTE FUNCTION public.trg_auto_validate_course_signatures_on_attendance();

-- 3. Fonction trigger pour valider automatiquement un émargement inséré s'il y a déjà une présence approuvée
CREATE OR REPLACE FUNCTION public.trg_check_existing_attendance_on_course_signature()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.signature_status = 'SIGNED' THEN
        IF EXISTS (
            SELECT 1 FROM public.staff_attendances
            WHERE school_id = NEW.school_id
              AND staff_id = NEW.staff_id
              AND date = NEW.date
              AND status IN ('Présent', 'Retard')
        ) THEN
            NEW.signature_status := 'VALIDATED';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_course_signature_auto_validate ON public.course_signatures;
CREATE TRIGGER trg_course_signature_auto_validate
BEFORE INSERT OR UPDATE ON public.course_signatures
FOR EACH ROW
EXECUTE FUNCTION public.trg_check_existing_attendance_on_course_signature();
