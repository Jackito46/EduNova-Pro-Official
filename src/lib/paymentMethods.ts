export interface PaymentMethodConfig {
  id: string;
  code: string;
  name: string;
  description: string;
  enabled: boolean;
  requires_bank: boolean;
  requires_reference: boolean;
  requires_deposit_date?: boolean;
  supported_currencies: ('HTG' | 'USD')[];
  account_info?: string;
  instructions?: string;
  icon_name: 'banknote' | 'landmark' | 'smartphone' | 'receipt' | 'credit-card' | 'wallet' | 'dollar-sign';
  is_custom?: boolean;
}

export const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  {
    id: 'CASH',
    code: 'Cash',
    name: 'Cash / Espèces',
    description: 'Paiement direct en espèces (Gourdes ou Dollars) à la caisse de l’établissement.',
    enabled: true,
    requires_bank: false,
    requires_reference: false,
    requires_deposit_date: false,
    supported_currencies: ['HTG', 'USD'],
    instructions: 'Vérifier l’authenticité des billets et délivrer immédiatement le reçu de caisse.',
    icon_name: 'banknote'
  },
  {
    id: 'DEPOT_BANCAIRE',
    code: 'Dépôt Bancaire',
    name: 'Dépôt Bancaire / Virement',
    description: 'Versement direct ou virement sur l’un des comptes bancaires officiels de l’école.',
    enabled: true,
    requires_bank: true,
    requires_reference: true,
    requires_deposit_date: true,
    supported_currencies: ['HTG', 'USD'],
    instructions: 'Exiger la présentation du bordereau bancaire original et vérifier le numéro de transaction.',
    icon_name: 'landmark'
  },
  {
    id: 'MONCASH',
    code: 'MonCash',
    name: 'MonCash (Digicel)',
    description: 'Paiement électronique via portefeuille MonCash.',
    enabled: false, // Disabled by default until administration configures and activates it
    requires_bank: false,
    requires_reference: true,
    requires_deposit_date: false,
    supported_currencies: ['HTG'],
    account_info: '',
    instructions: 'Exiger le SMS de confirmation officiel Digicel et saisir la référence de transaction.',
    icon_name: 'smartphone'
  },
  {
    id: 'NATCASH',
    code: 'Natcash',
    name: 'Natcash (Natcom)',
    description: 'Paiement électronique via portefeuille Natcash.',
    enabled: false, // Disabled by default until administration configures and activates it
    requires_bank: false,
    requires_reference: true,
    requires_deposit_date: false,
    supported_currencies: ['HTG'],
    account_info: '',
    instructions: 'Exiger la confirmation de transfert Natcash et enregistrer le code de transaction.',
    icon_name: 'smartphone'
  },
  {
    id: 'CHEQUE',
    code: 'Chèque',
    name: 'Chèque Bancaire / Certifié',
    description: 'Paiement par chèque de direction ou chèque certifié.',
    enabled: true,
    requires_bank: true,
    requires_reference: true,
    requires_deposit_date: false,
    supported_currencies: ['HTG', 'USD'],
    instructions: 'Chèque libellé à l’ordre exact de l’établissement avec endossement au verso.',
    icon_name: 'receipt'
  },
  {
    id: 'PORTEFEUILLE',
    code: 'Portefeuille',
    name: 'Portefeuille / Avoir élève',
    description: 'Imputation sur le solde créditeur ou l’avoir disponible de l’élève / étudiant.',
    enabled: true,
    requires_bank: false,
    requires_reference: false,
    requires_deposit_date: false,
    supported_currencies: ['HTG', 'USD'],
    instructions: 'Déduction automatique sur le solde du portefeuille après confirmation.',
    icon_name: 'wallet'
  },
  {
    id: 'CARTE',
    code: 'Carte',
    name: 'Carte Bancaire / TPE',
    description: 'Paiement par carte bancaire sur le terminal de paiement électronique (TPE) de l’école.',
    enabled: false, // Disabled by default until configured
    requires_bank: false,
    requires_reference: true,
    requires_deposit_date: false,
    supported_currencies: ['HTG', 'USD'],
    instructions: 'Conserver le ticket TPE signé avec le numéro d’autorisation.',
    icon_name: 'credit-card'
  }
];

/**
 * Recupere la liste complète des méthodes de paiement configurées pour l'école,
 * en fusionnant avec les valeurs par défaut.
 */
export function getSchoolPaymentMethods(school: any): PaymentMethodConfig[] {
  const configured: PaymentMethodConfig[] = school?.global_settings?.payment_methods;
  if (!Array.isArray(configured) || configured.length === 0) {
    return DEFAULT_PAYMENT_METHODS;
  }

  // Fusionner les méthodes par défaut avec les personnalisations de l'école
  const merged: PaymentMethodConfig[] = DEFAULT_PAYMENT_METHODS.map(defaultMethod => {
    const existing = configured.find(c => c.id === defaultMethod.id || c.code.toLowerCase() === defaultMethod.code.toLowerCase());
    if (existing) {
      return {
        ...defaultMethod,
        ...existing,
        code: defaultMethod.code // preserve canonical code
      };
    }
    return defaultMethod;
  });

  // Ajouter les méthodes personnalisées créées par l'école
  const customMethods = configured.filter(c => c.is_custom && !DEFAULT_PAYMENT_METHODS.some(d => d.id === c.id));
  return [...merged, ...customMethods];
}

/**
 * Recupere uniquement les méthodes de paiement ACTIVÉES par l'administration.
 */
export function getActiveSchoolPaymentMethods(school: any): PaymentMethodConfig[] {
  const allMethods = getSchoolPaymentMethods(school);
  const active = allMethods.filter(m => m.enabled);
  // Securite : si aucune méthode n'est active, retourner au moins Cash & Dépôt Bancaire
  if (active.length === 0) {
    return DEFAULT_PAYMENT_METHODS.filter(m => m.code === 'Cash' || m.code === 'Dépôt Bancaire');
  }
  // Priorité absolue : s'assurer que Cash / Espèces est toujours en première position par défaut s'il est actif
  const cashIndex = active.findIndex(m => m.code === 'Cash' || m.id === 'CASH');
  if (cashIndex > 0) {
    const [cashItem] = active.splice(cashIndex, 1);
    active.unshift(cashItem);
  }
  return active;
}

/**
 * Trouve la configuration d'une méthode de paiement par son code ou ID.
 */
export function getPaymentMethodConfig(codeOrId: string, school: any): PaymentMethodConfig | undefined {
  const methods = getSchoolPaymentMethods(school);
  return methods.find(m => m.code === codeOrId || m.id === codeOrId || m.name === codeOrId);
}
