-- Create staff_roles table if it doesn't exist and populate with standard roles

CREATE TABLE IF NOT EXISTS public.staff_roles (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    school_id UUID,
    label TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;

-- Use ::text on both sides to prevent uuid=text operator errors
DROP POLICY IF EXISTS "Staff roles read" ON public.staff_roles;
CREATE POLICY "Staff roles read" ON public.staff_roles 
    FOR SELECT USING (
        school_id::text = (SELECT school_id::text FROM profiles WHERE id = auth.uid())
        OR school_id IS NULL
    );

DROP POLICY IF EXISTS "Staff roles manage" ON public.staff_roles;
CREATE POLICY "Staff roles manage" ON public.staff_roles 
    FOR ALL USING (
        school_id::text = (SELECT school_id::text FROM profiles WHERE id = auth.uid())
    );

-- Insert standard roles safely (school_id IS NULL means global/default roles)
DO $$
DECLARE
    role_record RECORD;
BEGIN
    FOR role_record IN VALUES 
        -- CLASSIC / SHARED ROLES
        ('Directeur Général', 'Direction générale de l''établissement'),
        ('Directeur des Études', 'Direction académique et pédagogique'),
        ('Censeur', 'Discipline et organisation des études'),
        ('Secrétaire Général(e)', 'Administration générale'),
        ('Secrétaire', 'Secrétariat et accueil'),
        ('Comptable', 'Gestion financière et comptabilité'),
        ('Économe', 'Gestion matérielle et financière'),
        ('Caissier / Caissière', 'Encaissement et décaissement'),
        ('Enseignant Titulaire', 'Professeur permanent'),
        ('Enseignant Vacataire', 'Professeur à temps partiel ou contractuel'),
        ('Surveillant Général', 'Coordination de la surveillance et discipline'),
        ('Surveillant(e)', 'Surveillance des élèves'),
        ('Bibliothécaire', 'Gestion de la bibliothèque et documentation'),
        ('Informaticien / Responsable IT', 'Gestion du parc informatique et réseau'),
        ('Psychologue Scolaire', 'Accompagnement psychologique des élèves'),
        ('Infirmier / Infirmière', 'Soins de santé et premiers secours'),
        ('Agent d''entretien', 'Nettoyage et entretien des locaux'),
        ('Chauffeur', 'Transport scolaire et courses'),
        ('Gardien / Agent de sécurité', 'Sécurité des locaux et contrôle d''accès'),
        ('Cuisinier / Cuisinière', 'Préparation des repas (cantine)'),
        ('Responsable des Activités Parascolaires', 'Coordination des clubs et sports'),
        ('Conseiller d''Orientation', 'Accompagnement dans les choix d''études'),

        -- UNIVERSITY / HIGHER EDUCATION ROLES (UMDH & Universities)
        ('Recteur / Président', 'Direction exécutive supérieure de l''université'),
        ('Vice-Recteur', 'Assistance à la direction exécutive universitaire'),
        ('Régisseur / Registraire', 'Gestion des dossiers scolaires, inscriptions et admissions'),
        ('Doyen de Faculté', 'Direction d''une entité académique/faculté'),
        ('Directeur de Département', 'Supervision des disciplines d''un département académique'),
        ('Secrétaire Académique', 'Support administratif de la direction académique'),
        ('Professeur Titulaire', 'Enseignant-chercheur de rang magistral'),
        ('Professeur Assistant', 'Enseignement et encadrement académique'),
        ('Chargé de Cours', 'Dispense d''enseignements spécifiques et séminaires'),
        ('Assistant de Laboratoire', 'Technicien et support des travaux pratiques et recherche'),
        ('Coordonnateur de Programme', 'Gestion de la logistique d''un programme universitaire'),
        ('Bibliothécaire Universitaire', 'Gestion des ressources documentaires et universitaires'),

        -- PROFESSIONAL / VOCATIONAL ROLES (Centres Professionnels)
        ('Directeur de Centre', 'Direction exécutive du centre de formation professionnelle'),
        ('Responsable Pédagogique', 'Supervision de la qualité et progression des formations'),
        ('Formateur Référent', 'Conception et animation des parcours de formation'),
        ('Formateur', 'Animation d''ateliers pratiques et de modules'),
        ('Coordinateur de Stage / Alternance', 'Liaison avec les entreprises partenaires et suivi des alternants'),
        ('Assistant Administratif', 'Support de gestion des inscriptions et du secrétariat'),
        ('Conseiller en Insertion Professionnelle', 'Accompagnement des apprenants vers l''emploi'),
        ('Chef d’Atelier / Plateau Technique', 'Responsable de la sécurité et du matériel technique d''atelier'),
        ('Intervenant Professionnel', 'Expert métier assurant des modules spécialisés')
    LOOP
        IF NOT EXISTS (SELECT 1 FROM public.staff_roles WHERE label = role_record.column1 AND school_id IS NULL) THEN
            INSERT INTO public.staff_roles (school_id, label, description) 
            VALUES (NULL, role_record.column1, role_record.column2);
        END IF;
    END LOOP;
END
$$;
