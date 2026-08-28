-- Renforcement de la sécurité des réévaluations financières
-- Seuls les administrateurs ont le droit d'ajouter ou modifier un discount_amount / discount_label

CREATE OR REPLACE FUNCTION public.trg_protect_student_discounts()
RETURNS TRIGGER AS $$
BEGIN
  -- Vérifier si les champs sensibles sont modifiés (en cas d'UPDATE)
  IF (TG_OP = 'UPDATE') THEN
    IF (NEW.discount_amount IS DISTINCT FROM OLD.discount_amount OR
        NEW.discount_label IS DISTINCT FROM OLD.discount_label) THEN
      
      -- Vérification du rôle
      IF NOT public.is_admin() AND NOT public.is_super_admin() THEN
          RAISE EXCEPTION 'Action refusée : Seuls les administrateurs peuvent modifier les réévaluations financières des étudiants.';
      END IF;
      
      -- Prévention des montants négatifs ou irréalistes
      IF NEW.discount_amount < 0 THEN
          RAISE EXCEPTION 'Erreur de sécurité : Le montant de la réévaluation ne peut pas être négatif.';
      END IF;
    END IF;
  END IF;

  -- Vérifier lors de la création d'un étudiant (INSERT)
  IF (TG_OP = 'INSERT') THEN
    IF (NEW.discount_amount > 0 OR NEW.discount_label IS NOT NULL) THEN
      IF NOT public.is_admin() AND NOT public.is_super_admin() THEN
          RAISE EXCEPTION 'Action refusée : Seuls les administrateurs peuvent attribuer une réévaluation financière initiale.';
      END IF;

      IF NEW.discount_amount < 0 THEN
          RAISE EXCEPTION 'Erreur de sécurité : Le montant de la réévaluation ne peut pas être négatif.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supprimer le trigger existant au cas où
DROP TRIGGER IF EXISTS protect_student_discounts_trg ON public.students;

-- Créer le trigger qui s'exécute avant chaque INSERT ou UPDATE
CREATE TRIGGER protect_student_discounts_trg
BEFORE INSERT OR UPDATE ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.trg_protect_student_discounts();
