-- Fonction pour activer une session académique et migrer les élèves
CREATE OR REPLACE FUNCTION activate_academic_session(target_year_id UUID)
RETURNS VOID AS $$
DECLARE
    school_id_val UUID;
BEGIN
    -- 1. Récupérer le school_id de l'année cible
    SELECT school_id INTO school_id_val FROM academic_years WHERE id = target_year_id;

    -- 2. Archiver toutes les autres sessions de cette école
    UPDATE academic_years 
    SET status = 'PAST', is_active = false 
    WHERE school_id = school_id_val AND id <> target_year_id;

    -- 3. Activer la session cible
    UPDATE academic_years 
    SET status = 'ACTIVE', is_active = true 
    WHERE id = target_year_id;

    -- 4. Synchroniser la classe actuelle des élèves avec celle de la nouvelle session active
    -- Cela permet aux listes d'élèves par défaut de refléter la nouvelle réalité
    UPDATE students s
    SET class_id = e.class_id
    FROM enrollments e
    WHERE e.student_id = s.id
    AND e.academic_year_id = target_year_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
