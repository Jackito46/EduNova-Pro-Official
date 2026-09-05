import { SchoolType, DocumentStatus, StudentDocumentItem } from '../types';

export interface DocumentDefinition {
  id: string;
  name: string;
  description: string;
  required: boolean;
  category?: string;
}

export const CLASSIC_SCHOOL_DOCUMENTS: DocumentDefinition[] = [
  {
    id: 'birthCert',
    name: "Acte de Naissance / Extrait d'Archives",
    description: "Document officiel légalisé de l'état civil ou extrait des archives nationales.",
    required: true,
  },
  {
    id: 'photos',
    name: "Photos d'Identité Récentes (2x)",
    description: "Photos d'identité couleur format passeport pour le badge et le livret scolaire.",
    required: true,
  },
  {
    id: 'previousReports',
    name: "Bulletins / Carnet de Notes Antérieurs",
    description: "Dernier bulletin ou carnet de notes officiel de la classe précédente.",
    required: true,
  },
  {
    id: 'medical',
    name: "Certificat Médical / Carnet de Santé",
    description: "Certificat médical d'aptitude physique et carnet de vaccination à jour.",
    required: true,
  }
];

export const UNIVERSITY_DOCUMENTS: DocumentDefinition[] = [
  {
    id: 'identityDoc',
    name: "Pièce d'Identité Officielle (CIN / NIF / Passeport)",
    description: "Carte d'Identification Nationale (CIN), Passeport valide ou Matricule NIF officiel.",
    required: true,
  },
  {
    id: 'previousDiploma',
    name: "Certificat / Relevé du Baccalauréat",
    description: "Diplôme officiel de fin d'études secondaires (Bac II / Secondaire 4) ou relevé MENFP.",
    required: true,
  },
  {
    id: 'previousReports',
    name: "Relevés de Notes / Transcripts Universitaires",
    description: "Relevés officiels d'examens ou dossier de transfert académique.",
    required: true,
  },
  {
    id: 'medical',
    name: "Fiche d'Admission & Certificat Médical",
    description: "Bilan médical d'aptitude et formulaire d'engagement universitaire dûment signé.",
    required: true,
  }
];

export const PROFESSIONAL_DOCUMENTS: DocumentDefinition[] = [
  {
    id: 'identityDoc',
    name: "Pièce d'Identité & Contact Pro (CIN / NIF / Passeport)",
    description: "Pièce d'identité officielle avec photo pour l'immatriculation professionnelle.",
    required: true,
  },
  {
    id: 'previousDiploma',
    name: "Dernier Diplôme / Attestation d'Études",
    description: "Justificatif des prérequis techniques (BNS, Certificat de niveau, Baccalauréat).",
    required: true,
  },
  {
    id: 'resumeOrPrereq',
    name: "CV / Test de Niveau ou Entretien",
    description: "Évaluation des compétences initiales ou curriculum vitae pour la filière choisie.",
    required: true,
  },
  {
    id: 'contract',
    name: "Contrat de Formation Professionnelle Signé",
    description: "Convention d'apprentissage, engagement aux ateliers et stages pratiques.",
    required: true,
  }
];

export const KINDERGARTEN_DOCUMENTS: DocumentDefinition[] = [
  {
    id: 'birthCert',
    name: "Acte de Naissance / Extrait d'Archives",
    description: "Document officiel légalisé de l'état civil certifiant la filiation de l'enfant.",
    required: true,
  },
  {
    id: 'vaccines',
    name: "Carnet de Santé & Vaccinations Pédiatriques",
    description: "Carnet de vaccination pédiatrique à jour (BCG, Polio, Pentavalent, Rougeole/Rubéole).",
    required: true,
  },
  {
    id: 'photos',
    name: "Photos d'Identité Récentes de l'Enfant (2x)",
    description: "Photos d'identité couleur format passeport pour le carnet de liaison et le badge.",
    required: true,
  },
  {
    id: 'emergencyContact',
    name: "Fiche d'Urgence & Personnes Autorisées",
    description: "Contacts d'urgence et liste officielle des personnes autorisées à récupérer l'enfant.",
    required: true,
  }
];

export interface DocumentSuggestion {
  name: string;
  description: string;
  required: boolean;
}

export const DOCUMENT_SUGGESTIONS_BY_TYPE: Record<string, DocumentSuggestion[]> = {
  UNIVERSITY: [
    { name: "Relevé de Notes du Baccalauréat", description: "Relevé officiel délivré par le MENFP (Bac II ou Secondaire 4).", required: true },
    { name: "Pièce d'Identité (CIN / NIF / Passeport)", description: "Copie certifiée d'une pièce d'identité légale en cours de validité.", required: true },
    { name: "Relevés de Notes / Transcripts Universitaires", description: "Relevés semestriels ou dossier officiel de transfert inter-universitaire.", required: false },
    { name: "Fiche Médicale & Bilan d'Aptitude", description: "Certificat médical d'aptitude délivré par un médecin agréé.", required: true },
    { name: "Diplôme de Licence ou Attestation de Réussite", description: "Pour les admissions en Master ou programmes de spécialisation.", required: false },
    { name: "Lettre de Recommandation Académique", description: "Lettre de recommandation d'un professeur ou tuteur académique.", required: false }
  ],
  PROFESSIONAL: [
    { name: "Pièce d'Identité Officielle (CIN / NIF)", description: "Pièce d'identité légale avec photo pour immatriculation au registre pro.", required: true },
    { name: "Dernier Diplôme ou Attestation d'Études", description: "Justificatif du niveau prérequis (BNS, Certificat de niveau, Bac).", required: true },
    { name: "Contrat de Formation Professionnelle Signé", description: "Convention d'apprentissage et engagement aux ateliers et stages pratiques.", required: true },
    { name: "Curriculum Vitae (CV) & Entretien de Sélection", description: "Parcours initial et profil pour l'orientation en filière technique.", required: false },
    { name: "Certificat Médical d'Aptitude aux Ateliers", description: "Certificat d'aptitude aux travaux pratiques, machines et sécurité en atelier.", required: true }
  ],
  CLASSIC: [
    { name: "Acte de Naissance / Extrait d'Archives", description: "Document officiel légalisé de l'état civil ou extrait des archives nationales.", required: true },
    { name: "Photos d'Identité Récentes (2x)", description: "Photos couleur format passeport pour le badge et le livret scolaire.", required: true },
    { name: "Bulletins / Carnet de Notes Antérieurs", description: "Dernier bulletin ou carnet de notes officiel de la classe précédente.", required: true },
    { name: "Certificat Médical / Carnet de Santé", description: "Certificat médical d'aptitude physique et carnet de vaccination à jour.", required: true },
    { name: "Certificat de Sortie / Fiche de Transfert", description: "Attestation de transfert délivrée par la direction de l'école de provenance.", required: false },
    { name: "Fiche d'Engagement Parental Signée", description: "Règlement intérieur et charte éducative signés par les tuteurs légaux.", required: false }
  ]
};

export interface DocumentPreset {
  id: string;
  label: string;
  badge: string;
  description: string;
  docs: DocumentDefinition[];
}

export const DOCUMENT_PRESETS: DocumentPreset[] = [
  {
    id: 'classic',
    label: 'Standard Scolaire (Fondamental & Secondaire)',
    badge: 'École K-12',
    description: "Standard officiel MENFP pour écoles fondamentales, collèges et lycées.",
    docs: CLASSIC_SCHOOL_DOCUMENTS
  },
  {
    id: 'university',
    label: 'Standard Universitaire (Enseignement Supérieur)',
    badge: 'Université',
    description: "Standard académique pour Facultés, Licences, Masters et Instituts Supérieurs.",
    docs: UNIVERSITY_DOCUMENTS
  },
  {
    id: 'professional',
    label: 'Standard Formation Professionnelle & Technique',
    badge: 'Centre Pro',
    description: "Standard technique pour Centres de Métiers, Ateliers et Écoles Professionnelles.",
    docs: PROFESSIONAL_DOCUMENTS
  },
  {
    id: 'kindergarten',
    label: 'Standard Préscolaire & Maternelle',
    badge: 'Maternelle',
    description: "Standard adapté aux tout-petits : carnet pédiatrique, fiche d'urgence et extrait de naissance.",
    docs: KINDERGARTEN_DOCUMENTS
  }
];

export function getDocumentDefinitionsForSchoolType(
  schoolType?: string | null,
  customConfig?: { required_documents?: DocumentDefinition[] } | any
): DocumentDefinition[] {
  // If school has configured custom documents in its settings, use them dynamically
  if (customConfig?.required_documents && Array.isArray(customConfig.required_documents) && customConfig.required_documents.length > 0) {
    return customConfig.required_documents;
  }
  if (customConfig?.global_settings?.required_documents && Array.isArray(customConfig.global_settings.required_documents) && customConfig.global_settings.required_documents.length > 0) {
    return customConfig.global_settings.required_documents;
  }

  if (schoolType === SchoolType.UNIVERSITY || schoolType === 'UNIVERSITY') {
    return UNIVERSITY_DOCUMENTS;
  }
  if (schoolType === SchoolType.PROFESSIONAL || schoolType === 'PROFESSIONAL') {
    return PROFESSIONAL_DOCUMENTS;
  }
  return CLASSIC_SCHOOL_DOCUMENTS;
}

export function normalizeStudentDocuments(
  rawSubmittedDocs: any,
  schoolType?: string | null,
  customConfig?: any
): Record<string, { name: string; status: DocumentStatus; notes?: string; updated_at?: string; updated_by?: string }> {
  const defs = getDocumentDefinitionsForSchoolType(schoolType, customConfig);
  const result: Record<string, { name: string; status: DocumentStatus; notes?: string; updated_at?: string; updated_by?: string }> = {};

  defs.forEach(def => {
    let status: DocumentStatus = 'EN_ATTENTE';
    let notes = '';
    let updated_at = undefined;
    let updated_by = undefined;

    if (rawSubmittedDocs && typeof rawSubmittedDocs === 'object') {
      const entry = rawSubmittedDocs[def.id];
      if (entry !== undefined && entry !== null) {
        if (typeof entry === 'boolean') {
          status = entry ? 'VALIDE' : 'EN_ATTENTE';
        } else if (typeof entry === 'string') {
          if (entry === 'VALIDE' || entry === 'Validé' || entry === 'Valide') status = 'VALIDE';
          else if (entry === 'REJETE' || entry === 'Rejeté' || entry === 'Rejete') status = 'REJETE';
          else status = 'EN_ATTENTE';
        } else if (typeof entry === 'object') {
          const s = entry.status;
          if (s === 'VALIDE' || s === 'Validé' || s === 'Valide' || s === true) status = 'VALIDE';
          else if (s === 'REJETE' || s === 'Rejeté' || s === 'Rejete') status = 'REJETE';
          else status = 'EN_ATTENTE';
          notes = entry.notes || '';
          updated_at = entry.updated_at;
          updated_by = entry.updated_by;
        }
      }
    }

    result[def.id] = {
      name: def.name,
      status,
      notes,
      updated_at,
      updated_by
    };
  });

  return result;
}

export function calculateDocumentsCompleteness(
  docs: Record<string, { status: DocumentStatus } | boolean | string | any>,
  schoolType?: string | null,
  customConfig?: any
): {
  total: number;
  validatedCount: number;
  pendingCount: number;
  rejectedCount: number;
  isComplete: boolean;
  hasRejection: boolean;
} {
  const defs = getDocumentDefinitionsForSchoolType(schoolType, customConfig);
  const total = defs.length;
  let validatedCount = 0;
  let pendingCount = 0;
  let rejectedCount = 0;

  defs.forEach(def => {
    const item = docs?.[def.id];
    let st: DocumentStatus = 'EN_ATTENTE';
    if (typeof item === 'boolean') {
      st = item ? 'VALIDE' : 'EN_ATTENTE';
    } else if (typeof item === 'string') {
      if (item === 'VALIDE' || item === 'Validé' || item === 'Valide') st = 'VALIDE';
      else if (item === 'REJETE' || item === 'Rejeté' || item === 'Rejete') st = 'REJETE';
      else st = 'EN_ATTENTE';
    } else if (item && typeof item === 'object') {
      if (item.status === 'VALIDE' || item.status === 'Validé' || item.status === true) st = 'VALIDE';
      else if (item.status === 'REJETE' || item.status === 'Rejeté') st = 'REJETE';
      else st = 'EN_ATTENTE';
    }

    if (st === 'VALIDE') validatedCount++;
    else if (st === 'REJETE') rejectedCount++;
    else pendingCount++;
  });

  return {
    total,
    validatedCount,
    pendingCount,
    rejectedCount,
    isComplete: validatedCount === total,
    hasRejection: rejectedCount > 0
  };
}
