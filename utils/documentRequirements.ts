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

export interface DocumentPreset {
  id: string;
  label: string;
  badge: string;
  description: string;
  docs: DocumentDefinition[];
}

export interface DocumentSuggestion {
  name: string;
  description: string;
  required: boolean;
}

export const DOCUMENT_PRESETS: DocumentPreset[] = [
  {
    id: 'menfp_standard',
    label: 'Standard Scolaire MENFP (Haïti)',
    badge: 'Fondamental & Secondaire',
    description: "Dossier réglementaire standard exigé par le Ministère de l'Éducation Nationale (Fondamental et Secondaire).",
    docs: [
      ...CLASSIC_SCHOOL_DOCUMENTS,
      {
        id: 'transferCert',
        name: "Certificat de Transfert / Quitus Scolaire",
        description: "Certificat officiel de changement d'établissement ou quitus administratif.",
        required: false,
      }
    ]
  },
  {
    id: 'university_standard',
    label: 'Standard Universitaire & Supérieur',
    badge: 'Facultés & Instituts',
    description: "Dossier académique complet pour l'enseignement supérieur (Bac, relevés de notes, CIN/NIF).",
    docs: UNIVERSITY_DOCUMENTS
  },
  {
    id: 'professional_standard',
    label: 'Standard Formation Professionnelle',
    badge: 'Centres Métiers & INFP',
    description: "Dossier pour filières professionnelles, ateliers et centres d'apprentissage technique.",
    docs: PROFESSIONAL_DOCUMENTS
  },
  {
    id: 'international_standard',
    label: 'Standard International & Bilingue',
    badge: 'Mobilité & Bilingue',
    description: "Dossier renforcé avec passeport valide, bilans médicaux complets et équivalences de diplômes.",
    docs: [
      {
        id: 'passport',
        name: "Passeport Valide ou Pièce Consulaire",
        description: "Document de voyage officiel valide ou pièce d'identité légalisée.",
        required: true,
      },
      {
        id: 'equivalency',
        name: "Équivalence de Diplôme & Transcripts",
        description: "Attestation officielle d'équivalence de niveau d'études délivrée par l'autorité compétente.",
        required: true,
      },
      {
        id: 'healthFull',
        name: "Bilan Sanitaire Complet & Vaccinations",
        description: "Bilan médical général, sérologie et carnet de vaccination international.",
        required: true,
      },
      {
        id: 'financialProof',
        name: "Prise en Charge / Caution Financière",
        description: "Garantie financière ou engagement légalisé du tuteur légal.",
        required: false,
      }
    ]
  }
];

export const DOCUMENT_SUGGESTIONS_BY_TYPE: Record<string, DocumentSuggestion[]> = {
  CLASSIC: [
    {
      name: "Certificat de Transfert / Quitus Scolaire",
      description: "Certificat officiel de changement d'établissement ou quitus administratif.",
      required: false
    },
    {
      name: "Certificat de Baptême / Dédicace",
      description: "Attestation religieuse ou certificat de dédicace pour établissement confessionnel.",
      required: false
    },
    {
      name: "Fiche d'Urgence Médicale & Groupe Sanguin",
      description: "Fiche détaillée avec contacts d'urgence, allergies et groupe sanguin officiel.",
      required: true
    },
    {
      name: "Attestation de Bonne Conduite / Vie et Mœurs",
      description: "Attestation de bonne conduite délivrée par la direction précédente.",
      required: false
    },
    {
      name: "Justificatif de Domicile des Parents",
      description: "Facture de service public (électricité, eau) ou attestation de résidence.",
      required: false
    }
  ],
  UNIVERSITY: [
    {
      name: "Extrait de Casier Judiciaire Récent",
      description: "Certificat de casier judiciaire vierge datant de moins de 3 mois.",
      required: false
    },
    {
      name: "Lettre de Motivation & Projet Académique",
      description: "Exposé des motifs de candidature et orientation professionnelle visée.",
      required: true
    },
    {
      name: "Lettres de Recommandation Académiques (2x)",
      description: "Recommandations signées par des professeurs ou encadrants certifiés.",
      required: false
    },
    {
      name: "Attestation d'Assurance Responsabilité Civile",
      description: "Police d'assurance couvrant les stages et la scolarité universitaire.",
      required: false
    },
    {
      name: "Matricule Fiscale NIF / Attestation DGI",
      description: "Numéro d'Immatriculation Fiscale officiel de l'étudiant.",
      required: false
    }
  ],
  PROFESSIONAL: [
    {
      name: "Certificat d'Aptitude Médicale aux Ateliers",
      description: "Certificat médical d'aptitude au port d'équipements de protection et travaux pratiques.",
      required: true
    },
    {
      name: "Convention de Stage / Entreprise Partenaire",
      description: "Engagement formel de stage ou de contrat d'alternance professionnelle.",
      required: false
    },
    {
      name: "Attestations de Compétences / Certifications Antérieures",
      description: "Certificats de formation continue ou attestations de pratique professionnelle.",
      required: false
    },
    {
      name: "Permis de Conduire / CACES",
      description: "Permis de conduire valide pour les filières transport ou logistique.",
      required: false
    }
  ]
};

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
