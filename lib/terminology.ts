import { SchoolType } from '../types';

export interface Terminology {
  student: string;
  students: string;
  class: string;
  classes: string;
  teacher: string;
  teachers: string;
  academicYear: string;
  academicYears: string;
  enrollment: string;
  enrollments: string;
  cycle: string;
  cycles: string;
  subject: string;
  subjects: string;
  tuition: string;
  option: string;
  options: string;
  accountant: string;
  director: string;
  secretary: string;
  supervisor: string;
  register: string;
  // Report Card specific terminology
  reportCardTitle: string;
  reportCardDocName: string;
  creditsOrCoef: string;
  totalRow: string;
  periodAverage: string;
  annualAverage: string;
  classAverage: string;
  decisionLabel: string;
  admittedText: string;
  resitText: string;
  failedText: string;
  directionSignature: string;
  sealLabel: string;
}

const classicTerms: Terminology = {
  student: 'Élève',
  students: 'Élèves',
  class: 'Classe',
  classes: 'Classes',
  teacher: 'Enseignant',
  teachers: 'Enseignants',
  academicYear: 'Année Scolaire',
  academicYears: 'Années Scolaires',
  enrollment: 'Inscription',
  enrollments: 'Inscriptions',
  cycle: 'Cycle scolaire',
  cycles: 'Cycles scolaires',
  subject: 'Matière',
  subjects: 'Matières',
  tuition: 'Scolarité',
  option: 'Classe',
  options: 'Classes',
  accountant: 'Comptable',
  director: 'Directeur',
  secretary: 'Secrétaire',
  supervisor: 'Surveillant',
  register: 'registre scolaire',
  reportCardTitle: 'Bulletin de Notes & Évaluation',
  reportCardDocName: 'Bulletin Académique Officiel',
  creditsOrCoef: 'Coef.',
  totalRow: 'TOTAL GÉNÉRAL',
  periodAverage: 'Moyenne de la Période',
  annualAverage: 'Moyenne Annuelle',
  classAverage: 'Moyenne de la Classe',
  decisionLabel: "Décision du Conseil d'Orientation",
  admittedText: 'ADMIS(E) EN CLASSE SUPÉRIEURE',
  resitText: 'DÉCISION DU CONSEIL / SOUS RÉSERVE',
  failedText: 'REDOUBLEMENT SUGGÉRÉ',
  directionSignature: 'La Direction Pédagogique',
  sealLabel: "Signature & Sceau Officiel de l'Établissement"
};

const universityTerms: Terminology = {
  student: 'Étudiant',
  students: 'Étudiants',
  class: 'Discipline',
  classes: 'Disciplines',
  teacher: 'Professeur',
  teachers: 'Professeurs',
  academicYear: 'Session Académique',
  academicYears: 'Sessions Académiques',
  enrollment: 'Admission',
  enrollments: 'Admissions',
  cycle: 'Faculté',
  cycles: 'Facultés',
  subject: 'Unité d\'Enseignement',
  subjects: 'Unités d\'Enseignement (UE)',
  tuition: 'Frais Académiques',
  option: 'Filière / Spécialité',
  options: 'Filières / Spécialités',
  accountant: 'Économat / Comptable',
  director: 'Rectorat / Doyen',
  secretary: 'Secrétariat Académique',
  supervisor: 'Censeur / Surveillant',
  register: 'registre universitaire',
  reportCardTitle: 'Relevé de Notes & Crédits Académiques',
  reportCardDocName: 'Relevé de Notes Officiel',
  creditsOrCoef: 'Crédits',
  totalRow: 'TOTAL CRÉDITS & POINTS',
  periodAverage: 'Moyenne Semestrielle (GPA)',
  annualAverage: 'Moyenne Cumulative (CGPA)',
  classAverage: 'Moyenne de la Promotion',
  decisionLabel: 'Décision du Jury Académique',
  admittedText: 'SEMESTRE / NIVEAU VALIDÉ (ADMIS)',
  resitText: 'SESSION DE RATTRAPAGE REQUISE',
  failedText: 'NON VALIDÉ / AJOURNÉ(E)',
  directionSignature: 'Le Doyen / Le Rectorat',
  sealLabel: 'Signature & Sceau Académique'
};

const professionalTerms: Terminology = {
  student: 'Apprenant',
  students: 'Apprenants',
  class: 'Formation',
  classes: 'Formations',
  teacher: 'Formateur',
  teachers: 'Formateurs',
  academicYear: 'Session',
  academicYears: 'Sessions',
  enrollment: 'Inscription',
  enrollments: 'Inscriptions',
  cycle: 'Filière',
  cycles: 'Filières',
  subject: 'Module',
  subjects: 'Modules Professionnels & Pratiques',
  tuition: 'Frais de Formation',
  option: 'Spécialité',
  options: 'Spécialités',
  accountant: 'Gestionnaire financier',
  director: 'Directeur de Centre',
  secretary: 'Assistant administratif',
  supervisor: 'Responsable Pédagogique',
  register: 'registre professionnel',
  reportCardTitle: 'Bilan Pédagogique & Évaluation des Compétences',
  reportCardDocName: 'Relevé de Compétences Professionnelles',
  creditsOrCoef: 'Pondér.',
  totalRow: 'BILAN TOTAL DES MODULES',
  periodAverage: 'Moyenne de la Session',
  annualAverage: 'Moyenne Finale de Certification',
  classAverage: 'Moyenne du Groupe',
  decisionLabel: 'Décision de la Commission Pédagogique',
  admittedText: 'COMPÉTENCES VALIDÉES (ADMIS)',
  resitText: 'RATTRAPAGE MODULAIRE REQUIS',
  failedText: 'MODULES NON VALIDÉS',
  directionSignature: 'La Direction du Centre de Formation',
  sealLabel: 'Signature & Sceau du Centre'
};

export const getTerminology = (type: SchoolType = SchoolType.CLASSIC): Terminology => {
  switch (type) {
    case SchoolType.UNIVERSITY:
      return universityTerms;
    case SchoolType.PROFESSIONAL:
      return professionalTerms;
    default:
      return classicTerms;
  }
};
