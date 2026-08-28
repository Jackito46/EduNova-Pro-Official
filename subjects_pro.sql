CREATE OR REPLACE FUNCTION public.seed_subjects_pro(target_school_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_school_type TEXT;
BEGIN
    SELECT COALESCE(school_type, 'CLASSIC') INTO v_school_type FROM public.schools WHERE id = target_school_id::uuid;

    IF v_school_type = 'UNIVERSITY' THEN
        INSERT INTO public.subjects (school_id, name, code, category, description)
        VALUES 
            (target_school_id::uuid, 'Communication Française', 'COM-FR', 'LANGUAGES', 'Communication écrite et orale'),
            (target_school_id::uuid, 'Anglais Académique', 'ANG-ACAD', 'LANGUAGES', 'Anglais de niveau universitaire'),
            (target_school_id::uuid, 'Mathématiques Générales', 'MATH-GEN', 'SCIENCE', 'Algèbre et calcul fondamental'),
            (target_school_id::uuid, 'Méthodologie de Recherche', 'METHOD-RECH', 'GENERAL', 'Initiation à la rédaction scientifique'),
            (target_school_id::uuid, 'Introduction à l''Économie', 'INTRO-ECO', 'GENERAL', 'Principes de base d''économie'),
            (target_school_id::uuid, 'Sociologie d''Haïti', 'SOCIO-HT', 'GENERAL', 'Histoire sociale et culturelle'),
            -- Sciences_Informatiques
            (target_school_id::uuid, 'Algorithmique et Programmation', 'ALGO101', 'TECH', 'Logique de programmation'),
            (target_school_id::uuid, 'Mathématiques Discrètes', 'MATH-DISC', 'SCIENCE', 'Logique, graphes et ensembles'),
            (target_school_id::uuid, 'Architecture des Ordinateurs', 'ARCHI-ORD', 'TECH', 'Systèmes numériques et logique combinatoire'),
            (target_school_id::uuid, 'Introduction aux Technologies de l''Info', 'INTRO-INFO', 'TECH', 'Bases de l''informatique'),
            (target_school_id::uuid, 'Programmation Orientée Objet', 'PROG-OOP', 'TECH', 'Java, C++ et concepts objets'),
            (target_school_id::uuid, 'Bases de Données', 'DBD201', 'TECH', 'Modélisation SQL et relationnelle'),
            (target_school_id::uuid, 'Réseaux Informatiques I', 'RESEAUX1', 'TECH', 'Réseaux physiques, protocoles et OSI'),
            (target_school_id::uuid, 'Structures de Données', 'STRUC-DAT', 'TECH', 'Tableaux, listes, arbres et piles'),
            (target_school_id::uuid, 'Développement Web Full-Stack', 'PROG-WEB', 'TECH', 'HTML, CSS, JS et Frameworks'),
            (target_school_id::uuid, 'Ingénierie Logicielle', 'ING-LOG', 'TECH', 'Design patterns et cycle de vie logiciel'),
            (target_school_id::uuid, 'Sécurité Informatique', 'SEC-INF', 'TECH', 'Sécurité et cryptographie'),
            (target_school_id::uuid, 'Systèmes d''Exploitation', 'SYS-EXPLOIT', 'TECH', 'Linux, administration système'),
            (target_school_id::uuid, 'Introduction à l''IA', 'IA-INTRO', 'TECH', 'Machine learning et réseaux de neurones'),
            (target_school_id::uuid, 'Architecture Cloud', 'CLOUD-ARCH', 'TECH', 'AWS, Azure et virtualisation'),
            (target_school_id::uuid, 'Projet de Fin d''Études (Informatique)', 'PROJ-GRAD-INF', 'GENERAL', 'Mémoire informatique'),
            (target_school_id::uuid, 'Entrepreneuriat Numérique', 'ENTREP-NUM', 'GENERAL', 'Créer sa startup tech'),
            -- Sciences_Administratives
            (target_school_id::uuid, 'Comptabilité Générale I', 'COMP-GEN', 'GENERAL', 'Principes et écritures comptables'),
            (target_school_id::uuid, 'Principes de Management', 'MNG101', 'GENERAL', 'Principes fondamentaux de management'),
            (target_school_id::uuid, 'Mathématiques Financières I', 'MATH-FIN1', 'SCIENCE', 'Intérêts simples et composés, annuités'),
            (target_school_id::uuid, 'Comptabilité Intermédiaire', 'COMP-INTER', 'GENERAL', 'Actifs, passifs et états financiers'),
            (target_school_id::uuid, 'Microéconomie', 'MICRO-ECO', 'GENERAL', 'Théorie de l''offre, de la demande et des marchés'),
            (target_school_id::uuid, 'Macroéconomie', 'MACRO-ECO', 'GENERAL', 'Indicateurs, politiques et PIB'),
            (target_school_id::uuid, 'Gestion des Ressources Humaines', 'MNG-RH', 'GENERAL', 'Recrutement et carrière'),
            (target_school_id::uuid, 'Finance d''Entreprise', 'FIN-CORP', 'GENERAL', 'Analyse financière et décisions d''investissement'),
            (target_school_id::uuid, 'Principes de Marketing', 'MARKETING', 'GENERAL', 'Étude de marché et mix marketing'),
            (target_school_id::uuid, 'Droit des Affaires', 'DROIT-AFFAIR', 'LANGUAGES', 'Législation commerciale'),
            (target_school_id::uuid, 'Statistiques Appliquées', 'STAT-APPL', 'SCIENCE', 'Probabilités et échantillonnage'),
            (target_school_id::uuid, 'Stratégie des Organisations', 'STRAT-ORG', 'GENERAL', 'Planification stratégique'),
            (target_school_id::uuid, 'Comptabilité Publique', 'COMP-PUBLIC', 'GENERAL', 'Règles budgétaires de l''État'),
            (target_school_id::uuid, 'Commerce International', 'COMM-INTERN', 'GENERAL', 'Théorie de l''échange et mondialisation'),
            (target_school_id::uuid, 'Projet de Fin d''Études (Administration)', 'PROJ-GRAD-ADM', 'GENERAL', 'Mémoire administration'),
            -- Sciences_Juridiques
            (target_school_id::uuid, 'Introduction au Droit', 'INTRO-DROIT', 'LANGUAGES', 'Bases de la science juridique'),
            (target_school_id::uuid, 'Droit Constitutionnel I', 'DROIT-CONST', 'LANGUAGES', 'Théorie générale de l''État'),
            (target_school_id::uuid, 'Histoire du Droit', 'HIST-DROIT', 'GENERAL', 'Évolution historique des règles'),
            (target_school_id::uuid, 'Droit des Personnes', 'DROIT-PERS', 'LANGUAGES', 'État civil et droit de la famille'),
            (target_school_id::uuid, 'Droit des Obligations', 'DROIT-OBLIG', 'LANGUAGES', 'Responsabilité civile et contrats'),
            (target_school_id::uuid, 'Droit Constitutionnel II', 'DROIT-CONST2', 'LANGUAGES', 'Régime politique haïtien'),
            (target_school_id::uuid, 'Droit Pénal Général', 'DROIT-PENAL', 'LANGUAGES', 'Infractions et sanctions'),
            (target_school_id::uuid, 'Droit Administratif I', 'DROIT-ADMIN', 'LANGUAGES', 'Actes et services publics'),
            (target_school_id::uuid, 'Droit du Travail', 'DROIT-TRAV', 'LANGUAGES', 'Contrat d''emploi et syndicats'),
            (target_school_id::uuid, 'Droit International Public', 'DROIT-INT-PUB', 'LANGUAGES', 'Souveraineté et traités'),
            (target_school_id::uuid, 'Droit Réel (Régime Foncier)', 'DROIT-REEL', 'LANGUAGES', 'Droit de propriété'),
            (target_school_id::uuid, 'Procédure Civile Générale', 'PROC-CIV', 'LANGUAGES', 'Organisation judiciaire'),
            (target_school_id::uuid, 'Droit International Privé', 'DROIT-INT-PRIV', 'LANGUAGES', 'Conflits de lois'),
            (target_school_id::uuid, 'Procédure Pénale', 'PROC-PENAL', 'LANGUAGES', 'Instruction et poursuites'),
            (target_school_id::uuid, 'Mémoire Juridique', 'MEMOIRE-JUR', 'GENERAL', 'Séminaire et rédaction de mémoire'),
            -- Sciences_Infirmieres
            (target_school_id::uuid, 'Anatomie et Physiologie I', 'ANATOMIE1', 'SCIENCE', 'Structure du corps humain'),
            (target_school_id::uuid, 'Anatomie et Physiologie II', 'ANATOMIE2', 'SCIENCE', 'Fonctionnement des systèmes'),
            (target_school_id::uuid, 'Nutrition et Diététique', 'NUTRITION', 'SCIENCE', 'Régimes alimentaires'),
            (target_school_id::uuid, 'Fondements des Soins Infirmiers', 'SOINS-FOND', 'SCIENCE', 'Théories et gestes fondamentaux'),
            (target_school_id::uuid, 'Microbiologie et Parasitologie', 'MICRO-PARASIT', 'SCIENCE', 'Étude des agents pathogènes'),
            (target_school_id::uuid, 'Pathologie Médicale I', 'PATHOLOGIE1', 'SCIENCE', 'Processus morbides des organes'),
            (target_school_id::uuid, 'Soins Infirmiers à l''Adulte', 'SOINS-ADULTE', 'SCIENCE', 'Prise en charge clinique de l''adulte'),
            (target_school_id::uuid, 'Pharmacologie Clinique', 'PHARMACO1', 'SCIENCE', 'Médicaments et posologie'),
            (target_school_id::uuid, 'Soins Infirmiers en Pédiatrie', 'SOINS-PEDIAT', 'SCIENCE', 'Soins de l''enfant et du nouveau-né'),
            (target_school_id::uuid, 'Soins Maternels et Obstétriques', 'SOINS-MATERN', 'SCIENCE', 'Gynécologie et accouchement'),
            (target_school_id::uuid, 'Éthique et Déontologie', 'ETHIQUE-DEONT', 'GENERAL', 'Code de conduite infirmière'),
            (target_school_id::uuid, 'Santé Communautaire', 'SANTE-COMM', 'SCIENCE', 'Épidémiologie de terrain'),
            (target_school_id::uuid, 'Soins de Santé Mentale', 'SOINS-PSYCH', 'SCIENCE', 'Psychiatrie clinique'),
            (target_school_id::uuid, 'Gestion des Services de Soins', 'GEST-SOINS', 'GENERAL', 'Administration d''un service de soins'),
            (target_school_id::uuid, 'Méthodologie de Recherche (Soins)', 'RECH-INF', 'SCIENCE', 'Recherche clinique'),
            (target_school_id::uuid, 'Stage d''Intégration Professionnelle', 'STAGE-INTEG', 'SCIENCE', 'Pratique hospitalière avancée'),
            -- Genie_Civil
            (target_school_id::uuid, 'Physique Mécanique', 'PHY-MECAN', 'SCIENCE', 'Vecteurs, cinématique et dynamique'),
            (target_school_id::uuid, 'Dessin Industriel et DAO', 'DESSIN-INDA', 'TECH', 'AutoCAD et lecture de plans'),
            (target_school_id::uuid, 'Chimie de l''Ingénieur', 'CHIMIE-GEN', 'SCIENCE', 'Structures atomiques et réactions'),
            (target_school_id::uuid, 'Analyse Mathématique II', 'CALCULU2', 'SCIENCE', 'Calcul différentiel et intégral'),
            (target_school_id::uuid, 'Mécanique Rationnelle / Statique', 'STATIQUE', 'SCIENCE', 'Force, moment et équilibre'),
            (target_school_id::uuid, 'Algèbre Linéaire', 'ALGEBRE-LIN', 'SCIENCE', 'Matrices, déterminants et espaces vectoriels'),
            (target_school_id::uuid, 'Topographie Générale', 'TOPOGRAPH', 'SCIENCE', 'Mesure terrain et théodolite'),
            (target_school_id::uuid, 'Résistance des Matériaux I', 'RDM1', 'SCIENCE', 'Contraintes et déformations'),
            (target_school_id::uuid, 'Hydraulique Générale', 'HYDRAU1', 'SCIENCE', 'Écoulement des fluides'),
            (target_school_id::uuid, 'Géotechnique', 'GEOTECH1', 'SCIENCE', 'Mécanique des sols et fondations'),
            (target_school_id::uuid, 'Matériaux de Construction', 'MATER-CONSTR', 'TECH', 'Béton, acier et bois de construction'),
            (target_school_id::uuid, 'Béton Armé I', 'BETON-ARME1', 'TECH', 'Dimensionnement des poutres et dalles'),
            (target_school_id::uuid, 'Charpentes Métalliques', 'CHARP-MET', 'TECH', 'Assemblages métalliques et portiques'),
            (target_school_id::uuid, 'Dynamique des Structures', 'DYN-STRUCT', 'TECH', 'Génie parasismique'),
            (target_school_id::uuid, 'Gestion de Chantiers', 'GEST-CHANT', 'GENERAL', 'Planification et sécurité de chantiers'),
            (target_school_id::uuid, 'Béton Armé II', 'BETON-ARME2', 'TECH', 'Poteaux, semelles et voiles'),
            (target_school_id::uuid, 'Ouvrages d''Art', 'OVRG-ART', 'TECH', 'Piles, culées et tabliers de ponts'),
            (target_school_id::uuid, 'Infrastructures Routières', 'ROUTE-VRD', 'TECH', 'Tracé routier et terrassements'),
            (target_school_id::uuid, 'Projet de Fin d''Études (Génie Civil)', 'PROJ-GRAD-GC', 'GENERAL', 'Mémoire en génie civil'),
            -- Comptabilite_Informatisee
            (target_school_id::uuid, 'Comptabilité Générale I (T)', 'COMP-NIV1', 'GENERAL', 'Techniques comptables de base'),
            (target_school_id::uuid, 'Principes de Marketing (T)', 'MARK-COMP', 'GENERAL', 'Bases de marketing d''entreprise'),
            (target_school_id::uuid, 'Mathématiques Financières (T)', 'MATH-FIN', 'SCIENCE', 'Calculs d''intérêt standard'),
            (target_school_id::uuid, 'Bureautique et Tableurs (T)', 'BURO-INF', 'TECH', 'Maîtrise d''Excel et Word'),
            (target_school_id::uuid, 'Logiciels de Comptabilité', 'COMP-SAGE', 'TECH', 'Sage, QuickBooks et PeachTree'),
            (target_school_id::uuid, 'Fiscalité Haïtienne', 'FISC-HT', 'GENERAL', 'Législation fiscale et impôts d''Haïti'),
            (target_school_id::uuid, 'Audit Interne et Contrôle', 'AUDIT-INTERN', 'GENERAL', 'Vérification et sécurité comptable'),
            (target_school_id::uuid, 'Rapport de Stage', 'PROJ-STAGE-COMP', 'GENERAL', 'Soutenance de stage pratique'),
            -- Technologie Medicale
            (target_school_id::uuid, 'Hématologie Clinique I', 'HEMATO1', 'SCIENCE', 'Analyse des cellules sanguines'),
            (target_school_id::uuid, 'Parasitologie Clinique', 'PARASITO', 'SCIENCE', 'Identification des parasites de l''homme'),
            (target_school_id::uuid, 'Microbiologie Médicale I', 'MICROBIO1', 'SCIENCE', 'Bactériologie et culture'),
            (target_school_id::uuid, 'Chimie Clinique I', 'CHEM-CLIN1', 'SCIENCE', 'Dosages biochimiques sanguins et urinaires'),
            (target_school_id::uuid, 'Hématologie Clinique II', 'HEMATO2', 'SCIENCE', 'Hémostase et coagulation'),
            (target_school_id::uuid, 'Immunologie/Sérologie', 'IMMUNO', 'SCIENCE', 'Diagnostic par réactions immunitaires'),
            (target_school_id::uuid, 'Microbiologie Médicale II', 'MICROBIO2', 'SCIENCE', 'Virologie, Mycologie'),
            (target_school_id::uuid, 'Immuno-hématologie / Banque de sang', 'SANG-TRANS', 'SCIENCE', 'Groupages sanguins et compatibilité transfusionnelle'),
            (target_school_id::uuid, 'Chimie Clinique II', 'CHEM-CLIN2', 'SCIENCE', 'Biochimie spécialisée et hormonologie'),
            (target_school_id::uuid, 'Biosécurité et Gestion des Déchets', 'LAB-BIOSEC', 'SCIENCE', 'Normes de sécurité en laboratoire'),
            (target_school_id::uuid, 'Assurance Qualité au Laboratoire', 'LAB-QUALITY', 'SCIENCE', 'Régulation, calibration, accréditation'),
            (target_school_id::uuid, 'Biologie Moléculaire et Diagnostic', 'GENETIQUE', 'SCIENCE', 'Méthodes PCR, hybridation et extraction'),
            (target_school_id::uuid, 'Stage Pratique de Laboratoire', 'LAB-STAGE', 'SCIENCE', 'Immersion hospitalière active'),
            (target_school_id::uuid, 'Projet d''Intégration d''Expertise', 'LAB-MEMOIRE', 'GENERAL', 'Mémoire professionnel et revue scientifique'),
            -- Médecine Dentaire
            (target_school_id::uuid, 'Anatomie Dentaire', 'ANAT-DENT', 'SCIENCE', 'Morphologie et physiologie dentaires'),
            (target_school_id::uuid, 'Histologie & Embryologie Bucco-dentaire', 'HISTO-EMBRYO', 'SCIENCE', 'Structure microscopique et développement'),
            (target_school_id::uuid, 'Biochimie Médicale', 'BIOCH-MED', 'SCIENCE', 'Réactions et métabolismes moléculaires'),
            (target_school_id::uuid, 'Physiologie Générale', 'PHYSIO-GEN', 'SCIENCE', 'Fonctions des systèmes biologiques'),
            (target_school_id::uuid, 'Odontologie Conservatrice I', 'ODONT-CONS1', 'SCIENCE', 'Traitements et restaurations de base'),
            (target_school_id::uuid, 'Prothèse Dentaire I', 'PROTH-DENT1', 'SCIENCE', 'Bases prothétiques fixes et amovibles'),
            (target_school_id::uuid, 'Parodontologie I', 'PARO1', 'SCIENCE', 'Étude du parodonte et maladies associées'),
            (target_school_id::uuid, 'Radiologie Buccale', 'RADIO-BUCCAL', 'SCIENCE', 'Diagnostic d''imagerie des maxillaires'),
            (target_school_id::uuid, 'Pathologie Médicale & Chirurgicale', 'PATH-MED-CHIR', 'SCIENCE', 'Pathologies générales systémiques'),
            (target_school_id::uuid, 'Odontologie Conservatrice II', 'ODONT-CONS2', 'SCIENCE', 'Traitements de canal complexes'),
            (target_school_id::uuid, 'Prothèse Dentaire II', 'PROTH-DENT2', 'SCIENCE', 'Réhabilitation prothétique complexe'),
            (target_school_id::uuid, 'Pharmacologie Dentaire', 'PHARMACO-DENT', 'SCIENCE', 'Molécules thérapeutiques en odontologie'),
            (target_school_id::uuid, 'Chirurgie Buccale & Maxillo-Faciale', 'CHIR-BUCC', 'SCIENCE', 'Chirurgie d''extraction et reconstructrice'),
            (target_school_id::uuid, 'Orthopédie Dento-Faciale', 'ODF', 'SCIENCE', 'Alignement dentaire et orthodontie'),
            (target_school_id::uuid, 'Thérapeutique Endodontique', 'THERAP-ENDO', 'SCIENCE', 'Endodontie avancée'),
            (target_school_id::uuid, 'Dentisterie Pédiatrique', 'DENT-PEDIAT', 'SCIENCE', 'Soins bucco-dentaires de l''enfant'),
            (target_school_id::uuid, 'Clinique Odontologique Intégrée', 'CLIN-ODONT', 'SCIENCE', 'Pratique clinique globale sous supervision'),
            (target_school_id::uuid, 'Urgences Bucco-dentaires', 'URG-DENT', 'SCIENCE', 'Prise en charge des traumatismes et douleurs'),
            (target_school_id::uuid, 'Stage Hospitalier Dentaire', 'STAGE-HOSP-DENT', 'SCIENCE', 'Pratique active en milieu hospitalier'),
            (target_school_id::uuid, 'Projet de Fin d''Études (Dentaire)', 'PROJ-GRAD-DENT', 'GENERAL', 'Rédaction et soutenance de mémoire'),
            -- Médecine Vétérinaire
            (target_school_id::uuid, 'Anatomie des Animaux Domestiques I', 'ANAT-VET1', 'SCIENCE', 'Squelette, muscles et viscères'),
            (target_school_id::uuid, 'Histologie & Embryologie Vétérinaire', 'HISTO-EMBRYO-VET', 'SCIENCE', 'Origine et microstructure des tissus animaux'),
            (target_school_id::uuid, 'Biochimie Vétérinaire', 'BIOCH-VET', 'SCIENCE', 'Biochimie métabolique animale'),
            (target_school_id::uuid, 'Physiologie Vétérinaire I', 'PHYSIO-VET1', 'SCIENCE', 'Systèmes nerveux et endocrinien animaux'),
            (target_school_id::uuid, 'Microbiologie Vétérinaire', 'MICRO-VET', 'SCIENCE', 'Bactériologie et mycologie vétérinaires'),
            (target_school_id::uuid, 'Parasitologie Vétérinaire I', 'PARASITO-VET1', 'SCIENCE', 'Protozoaires et Helminthes d''intérêt vétérinaire'),
            (target_school_id::uuid, 'Pharmacologie & Toxicologie I', 'PHARMACO-TOX1', 'SCIENCE', 'Classes thérapeutiques et poisons'),
            (target_school_id::uuid, 'Nutrition Animale', 'NUT-ANIMAL', 'SCIENCE', 'Rations alimentaires et besoins physiques'),
            (target_school_id::uuid, 'Pathologie Médicale des Grands Animaux', 'PATH-MED-ANIMAL', 'SCIENCE', 'Médecine bovine, équine et porcine'),
            (target_school_id::uuid, 'Chirurgie Vétérinaire Générale', 'CHIR-VET-GEN', 'SCIENCE', 'Anesthésiologie et techniques chirurgicales de base'),
            (target_school_id::uuid, 'Imagerie Médicale Vétérinaire', 'IMAGE-MED-VET', 'SCIENCE', 'Radiographie et échographie vétérinaires'),
            (target_school_id::uuid, 'Épidémiologie Vétérinaire', 'EPIDEMIO-VET', 'SCIENCE', 'Santé des populations animales'),
            (target_school_id::uuid, 'Pathologie des Animaux de Compagnie', 'PATH-COMPAGNY', 'SCIENCE', 'Médecine canine et féline'),
            (target_school_id::uuid, 'Médecine & Chirurgie Équine', 'MED-CHIR-EQUIN', 'SCIENCE', 'Soins cliniques et locomotion du cheval'),
            (target_school_id::uuid, 'Reproduction & Obstétrique Animale', 'REPROD-VET', 'SCIENCE', 'Suivi de reproduction et mise bas'),
            (target_school_id::uuid, 'Inspection des Denrées (Hygiène)', 'INSPECTION-HYG', 'SCIENCE', 'Contrôle sanitaire des abattoirs et aliments'),
            (target_school_id::uuid, 'Clinique Ambulatoire Vétérinaire', 'CLIN-AMB-VET', 'SCIENCE', 'Interventions d''urgence en ferme'),
            (target_school_id::uuid, 'Santé Publique Vétérinaire', 'PUBLIC-HEALTH-VET', 'SCIENCE', 'Zoonoses et protection environnementale'),
            (target_school_id::uuid, 'Stage Professionnel Vétérinaire', 'STAGE-CLIN-VET', 'SCIENCE', 'Pratique clinique active sous tutelle'),
            (target_school_id::uuid, 'Rapport d''Expertise Vétérinaire', 'RAPPORT-VET', 'GENERAL', 'Thèse de soutenance en médecine vétérinaire'),
            -- Pharmacologie
            (target_school_id::uuid, 'Chimie Organique Générale', 'CHEM-ORG', 'SCIENCE', 'Carbones, isométries et réactifs'),
            (target_school_id::uuid, 'Biologie Cellulaire & Physiologie', 'BIOL-CELL', 'SCIENCE', 'Organites cellulaires et transport membranaire'),
            (target_school_id::uuid, 'Pharmacie Galénique I', 'GALENIQUE1', 'SCIENCE', 'Formes pharmaceutiques simples'),
            (target_school_id::uuid, 'Mathématiques & Statistiques Appliquées', 'PHARM-STATS', 'SCIENCE', 'Probabilités et biostatistiques'),
            (target_school_id::uuid, 'Pharmacie Galénique II', 'GALENIQUE2', 'SCIENCE', 'Formes à libération contrôlée'),
            (target_school_id::uuid, 'Chimie Thérapeutique I', 'CHEM-THERAP1', 'SCIENCE', 'Rapports structure-activité des molécules'),
            (target_school_id::uuid, 'Biochimie Clinique', 'BIOCHIMIE-PHARM', 'SCIENCE', 'Physiopathologies biochimiques'),
            (target_school_id::uuid, 'Pharmacognosie (Phytothérapie)', 'PHARMACOGNOSIE', 'SCIENCE', 'Substances actives naturelles'),
            (target_school_id::uuid, 'Pharmacocinétique', 'PHARM-KINETICS', 'SCIENCE', 'ADME: Absorption, Distribution, Métabolisme, Élimination'),
            (target_school_id::uuid, 'Chimie Thérapeutique II', 'CHEM-THERAP2', 'SCIENCE', 'Médicaments cardio-vasculaires et antibiotiques'),
            (target_school_id::uuid, 'Pharmacologie Spéciale & Clinique I', 'PHARMACO-SPECIAL1', 'SCIENCE', 'Mécanismes d''action par récepteurs'),
            (target_school_id::uuid, 'Toxicologie Générale', 'TOX-GEN', 'SCIENCE', 'Mécanismes de toxicité moléculaire'),
            (target_school_id::uuid, 'Pharmacie Clinique & Dispensation', 'PHARM-CLINIC', 'SCIENCE', 'Conseils et détection des interactions'),
            (target_school_id::uuid, 'Législation & Déontologie Pharmaceutique', 'PHARM-LAW', 'GENERAL', 'Législation des stupéfiants et officines en Haïti'),
            (target_school_id::uuid, 'Stage Pratique en Officine', 'STAGE-OFFICINE', 'SCIENCE', 'Stage en pharmacie communautaire'),
            (target_school_id::uuid, 'Projet de Recherche Pharmaceutique', 'PROJ-GRAD-PHARM', 'GENERAL', 'Mémoire de recherche de pharmacologue')
        ON CONFLICT (school_id, code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

        -- Also seed professional subjects for UNIVERSITY type
        INSERT INTO public.subjects (school_id, name, code, category, description)
        VALUES 
            -- Cuisine, Bar & Restauration
            (target_school_id::uuid, 'Art Culinaire & Gastronomie', 'CUIS-101', 'GENERAL', 'Cuisine et préparation culinaire de niveau professionnel'),
            (target_school_id::uuid, 'Service de Bar & Restauration', 'BAR-REST', 'GENERAL', 'Service à la clientèle, mixologie et gestion des bars'),
            (target_school_id::uuid, 'Techniques de Pâtisserie & Boulangerie', 'PATISS-101', 'GENERAL', 'Farines, pâtes, gâteaux et desserts professionnels'),
            (target_school_id::uuid, 'Hygiène et Sécurité Alimentaire', 'HYG-ALIM', 'GENERAL', 'Normes sanitaires, conservation et chaîne du froid'),
            (target_school_id::uuid, 'Oenologie & Sommellerie', 'OENO-101', 'GENERAL', 'Connaissance des vins et spiritueux'),
            -- Beauté & Esthétique
            (target_school_id::uuid, 'Esthétique Professionnelle & Soins', 'ESTH101', 'GENERAL', 'Soins de la peau, traitements corporels'),
            (target_school_id::uuid, 'Techniques de Coiffure & Coupe', 'CHEF-COIF', 'GENERAL', 'Coupe de cheveux, brushing, coloration et coiffure'),
            (target_school_id::uuid, 'Art du Maquillage', 'MAQ-PEAU', 'GENERAL', 'Théorie des couleurs et maquillage professionnel'),
            (target_school_id::uuid, 'Manucure, Pédicure & Onglerie', 'ONGLE', 'GENERAL', 'Soins des mains et pieds, pose de faux ongles'),
            -- Informatique & Secrétariat
            (target_school_id::uuid, 'Maintenance Matériel Informatique', 'MAINT101', 'TECH', 'Dépannage, montage et entretien des PC'),
            (target_school_id::uuid, 'Fondamentaux Réseaux & Câblage', 'RES101', 'TECH', 'Concepts réseaux, adresses IP et câblage RJ45'),
            (target_school_id::uuid, 'Bureautique & Secrétariat', 'BURO-SEC', 'TECH', 'Gestion administrative, accueil et Word'),
            (target_school_id::uuid, 'Tableaux Financiers & Excel', 'EXCEL-PRO', 'TECH', 'Traitement de données sous MS Excel'),
            (target_school_id::uuid, 'Initiation Web & Réseaux Sociaux', 'WEB-INIT', 'TECH', 'Création de sites simples et marketing digital'),
            -- Technique générale & Construction
            (target_school_id::uuid, 'Électricité Bâtiment', 'ELEC-BAT', 'TECH', 'Montages simples, va-et-vient, installations résidentielles'),
            (target_school_id::uuid, 'Électricité Industrielle', 'ELEC-IND', 'TECH', 'Moteurs thermiques, triphasé et armoires de contrôle'),
            (target_school_id::uuid, 'Pratique Plomberie & Sanitaire', 'PLOM101', 'TECH', 'Canalisations, sanitaires, étanchéité et raccordements'),
            (target_school_id::uuid, 'Climatisation & Réfrigération', 'CLIM-REF', 'TECH', 'Systèmes de conditionnement d''air et congélateurs'),
            -- Mécanique
            (target_school_id::uuid, 'Moteurs à Combustion Interne', 'MEC101', 'TECH', 'Fonctionnement des moteurs essence et diesel'),
            (target_school_id::uuid, 'Électricité & Diagnostic Automobile', 'AUTO-DIAG', 'TECH', 'Électronique embarquée et scanneur OBD'),
            (target_school_id::uuid, 'Organes de Transmission & Freinage', 'AUTO-MECA', 'TECH', 'Systèmes de freinage, boîtes et suspension'),
            -- Coupe et Couture
            (target_school_id::uuid, 'Coupe & Couture de Base', 'COUT-101', 'GENERAL', 'Patronage de base, points de couture et machines'),
            (target_school_id::uuid, 'Modélisme & Stylisme de Mode', 'STYL-101', 'GENERAL', 'Création de vêtements sur mesure, étude des tissus'),
            -- Gestion entrepreneuriale
            (target_school_id::uuid, 'Comptabilité Simplifiée & Facturation', 'COMP-SIMPL', 'GENERAL', 'Gestion de caisse et facturation d''atelier'),
            (target_school_id::uuid, 'Création de Micro-Entreprise', 'ENTREP-PRO', 'GENERAL', 'Esprit d''entreprise, plans d''affaires simples et marketing de proximité')
        ON CONFLICT (school_id, code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category;
    ELSIF v_school_type = 'PROFESSIONAL' THEN
        INSERT INTO public.subjects (school_id, name, code, category, description)
        VALUES 
            -- Cuisine, Bar & Restauration
            (target_school_id::uuid, 'Art Culinaire & Gastronomie', 'CUIS-101', 'GENERAL', 'Cuisine et préparation culinaire de niveau professionnel'),
            (target_school_id::uuid, 'Service de Bar & Restauration', 'BAR-REST', 'GENERAL', 'Service à la clientèle, mixologie et gestion des bars'),
            (target_school_id::uuid, 'Techniques de Pâtisserie & Boulangerie', 'PATISS-101', 'GENERAL', 'Farines, pâtes, gâteaux et desserts professionnels'),
            (target_school_id::uuid, 'Hygiène et Sécurité Alimentaire', 'HYG-ALIM', 'GENERAL', 'Normes sanitaires, conservation et chaîne du froid'),
            (target_school_id::uuid, 'Oenologie & Sommellerie', 'OENO-101', 'GENERAL', 'Connaissance des vins et spiritueux'),
            -- Beauté & Esthétique
            (target_school_id::uuid, 'Esthétique Professionnelle & Soins', 'ESTH101', 'GENERAL', 'Soins de la peau, traitements corporels'),
            (target_school_id::uuid, 'Techniques de Coiffure & Coupe', 'CHEF-COIF', 'GENERAL', 'Coupe de cheveux, brushing, coloration et coiffure'),
            (target_school_id::uuid, 'Art du Maquillage', 'MAQ-PEAU', 'GENERAL', 'Théorie des couleurs et maquillage professionnel'),
            (target_school_id::uuid, 'Manucure, Pédicure & Onglerie', 'ONGLE', 'GENERAL', 'Soins des mains et pieds, pose de faux ongles'),
            -- Informatique & Secrétariat
            (target_school_id::uuid, 'Maintenance Matériel Informatique', 'MAINT101', 'TECH', 'Dépannage, montage et entretien des PC'),
            (target_school_id::uuid, 'Fondamentaux Réseaux & Câblage', 'RES101', 'TECH', 'Concepts réseaux, adresses IP et câblage RJ45'),
            (target_school_id::uuid, 'Bureautique & Secrétariat', 'BURO-SEC', 'TECH', 'Gestion administrative, accueil et Word'),
            (target_school_id::uuid, 'Tableaux Financiers & Excel', 'EXCEL-PRO', 'TECH', 'Traitement de données sous MS Excel'),
            (target_school_id::uuid, 'Initiation Web & Réseaux Sociaux', 'WEB-INIT', 'TECH', 'Création de sites simples et marketing digital'),
            -- Technique générale & Construction
            (target_school_id::uuid, 'Électricité Bâtiment', 'ELEC-BAT', 'TECH', 'Montages simples, va-et-vient, installations résidentielles'),
            (target_school_id::uuid, 'Électricité Industrielle', 'ELEC-IND', 'TECH', 'Moteurs thermiques, triphasé et armoires de contrôle'),
            (target_school_id::uuid, 'Pratique Plomberie & Sanitaire', 'PLOM101', 'TECH', 'Canalisations, sanitaires, étanchéité et raccordements'),
            (target_school_id::uuid, 'Climatisation & Réfrigération', 'CLIM-REF', 'TECH', 'Systèmes de conditionnement d''air et congélateurs'),
            -- Mécanique
            (target_school_id::uuid, 'Moteurs à Combustion Interne', 'MEC101', 'TECH', 'Fonctionnement des moteurs essence et diesel'),
            (target_school_id::uuid, 'Électricité & Diagnostic Automobile', 'AUTO-DIAG', 'TECH', 'Électronique embarquée et scanneur OBD'),
            (target_school_id::uuid, 'Organes de Transmission & Freinage', 'AUTO-MECA', 'TECH', 'Systèmes de freinage, boîtes et suspension'),
            -- Coupe et Couture
            (target_school_id::uuid, 'Coupe & Couture de Base', 'COUT-101', 'GENERAL', 'Patronage de base, points de couture et machines'),
            (target_school_id::uuid, 'Modélisme & Stylisme de Mode', 'STYL-101', 'GENERAL', 'Création de vêtements sur mesure, étude des tissus'),
            -- Gestion entrepreneuriale
            (target_school_id::uuid, 'Comptabilité Simplifiée & Facturation', 'COMP-SIMPL', 'GENERAL', 'Gestion de caisse et facturation d''atelier'),
            (target_school_id::uuid, 'Création de Micro-Entreprise', 'ENTREP-PRO', 'GENERAL', 'Esprit d''entreprise, plans d''affaires simples et marketing de proximité')
        ON CONFLICT (school_id, code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category;
    ELSE
        INSERT INTO public.subjects (school_id, name, code, description) VALUES 
        (target_school_id::uuid, 'Initiation Mathématiques', 'INIT-MATH', 'Maternelle'),
        (target_school_id::uuid, 'Langage et Communication', 'LANG-COMM', 'Maternelle'),
        (target_school_id::uuid, 'Psychomotricité', 'PSYCHOMOT', 'Maternelle'),
        (target_school_id::uuid, 'Arts et Dessin', 'ARTS-DESS', 'Maternelle'),
        (target_school_id::uuid, 'Mathématiques Fondamentales', 'MATH-FOND', 'Fondamentale'),
        (target_school_id::uuid, 'Communication Française', 'FRAN-FOND', 'Fondamentale'),
        (target_school_id::uuid, 'Communication Créole', 'CREO-FOND', 'Fondamentale'),
        (target_school_id::uuid, 'Sciences Expérimentales', 'SCI-EXP', 'Fondamentale'),
        (target_school_id::uuid, 'Sciences Sociales', 'SCI-SOC', 'Fondamentale'),
        (target_school_id::uuid, 'Anglais', 'ANGL-GEN', 'Fondamentale'),
        (target_school_id::uuid, 'Informatique', 'INFO-TECH', 'Fondamentale'),
        (target_school_id::uuid, 'Éducation Physique', 'EPS-SPORT', 'Fondamentale'),
        (target_school_id::uuid, 'Physique-Chimie NS', 'PHY-CHI-NS', 'Secondaire'),
        (target_school_id::uuid, 'SVT / Biologie NS', 'SVT-NS', 'Secondaire'),
        (target_school_id::uuid, 'Philosophie', 'PHILO', 'Secondaire'),
        (target_school_id::uuid, 'Économie et Société', 'ECONO', 'Secondaire'),
        (target_school_id::uuid, 'Littérature Universelle', 'LITT-UNIV', 'Secondaire')
        ON CONFLICT (school_id, code) DO UPDATE SET name = EXCLUDED.name;
    END IF;
END; 
$function$

