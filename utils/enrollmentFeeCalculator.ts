/**
 * Utilitaires experts pour le calcul et la distinction entre Frais d'Inscription (nouveaux élèves)
 * et Frais de Réinscription (élèves existants).
 * 
 * Assure la conformité financière :
 * - Détection automatique du statut élève (nouvel entrant vs ancien élève déjà scolarisé).
 * - Calcul automatique de l'écart / avantage tarifaire pour les anciens élèves.
 * - Prise en charge stricte de la valeur 0 HTG / 0 USD lorsque l'administration décide
 *   que la réinscription ou l'inscription est offerte (gratuite / exonérée).
 */

export interface FeePlanLike {
  id?: string;
  class_id?: string;
  academic_year_id?: string;
  inscription_fee?: number | string | null;
  inscription_fee_usd?: number | string | null;
  reenrollment_fee?: number | string | null;
  reenrollment_fee_usd?: number | string | null;
  tuition_fee?: number | string | null;
  tuition_fee_usd?: number | string | null;
  foreign_tuition_fee?: number | string | null;
  misc_fee_htg?: number | string | null;
  misc_fee_usd?: number | string | null;
  is_misc_mandatory?: boolean | null;
}

export interface StudentEnrollmentHistoryItem {
  id?: string;
  academic_year_id?: string;
  academic_year?: {
    id?: string;
    label?: string;
    status?: string;
  };
  class_id?: string;
  status?: string;
}

export interface StudentAdmissionStatusInput {
  isExplicitReenroll?: boolean;
  studentId?: string | null;
  targetYearId?: string | null;
  priorEnrollments?: StudentEnrollmentHistoryItem[] | null;
  allEnrollments?: StudentEnrollmentHistoryItem[] | null;
  studentHasPreviousEnrollmentFlag?: boolean;
}

export interface FeeDifferenceDetail {
  amountHTG: number;
  amountUSD: number;
  savingsHTG: number;
  savingsUSD: number;
  hasAdvantage: boolean;
  isFreeReenrollment: boolean;
  discountPercentage: number;
  badgeLabel: string;
  summaryText: string;
}

export interface EnrollmentPricingResult {
  exists: boolean;
  isReturningStudent: boolean;
  enrollmentType: 'REINSCRIPTION' | 'INSCRIPTION';
  feeLabel: string; // "Frais de Réinscription" | "Frais d'Inscription"
  shortBadge: string; // "Ancien Élève" | "Nouveau"
  
  // Frais d'entrée effectivement applicables
  applicableAdmissionFee: {
    amount: number;
    currency: 'HTG' | 'USD';
    isZero: boolean;
    isWaived: boolean;
    displayString: string;
  };

  // Frais d'inscription initiale standard (pour nouveaux élèves)
  standardInscriptionFee: {
    amount: number;
    currency: 'HTG' | 'USD';
    isZero: boolean;
    displayString: string;
  };

  // Frais de réinscription (pour anciens élèves)
  standardReenrollmentFee: {
    amount: number;
    currency: 'HTG' | 'USD';
    isZero: boolean;
    displayString: string;
  };

  // Analyse d'écart tarifaire et économie ancien élève
  difference: FeeDifferenceDetail;

  // Scolarité
  tuition: {
    amount: number;
    currency: 'HTG' | 'USD';
    displayString: string;
  };

  // Frais accessoires / divers
  miscFee: {
    amount: number;
    currency: 'HTG' | 'USD';
    displayString: string;
    isMandatory: boolean;
  };

  // Bilan consolidé annuel
  totalAnnualExpected: {
    totalHTG: number;
    totalUSD: number;
  };

  // Propriété de rétrocompatibilité avec les formulaires existants
  isMiscMandatory: boolean;
  inscription: {
    amount: number;
    currency: 'HTG' | 'USD';
    isZero: boolean;
    displayString: string;
  };
}

/**
 * Détecte si un élève est un ancien élève (déjà inscrit dans une session antérieure)
 * ou un nouvel entrant.
 */
export function detectReturningStudentStatus(input: StudentAdmissionStatusInput): boolean {
  if (input.isExplicitReenroll) return true;
  if (input.studentHasPreviousEnrollmentFlag) return true;

  const targetYearId = input.targetYearId;
  const enrollments = input.allEnrollments || input.priorEnrollments || [];

  if (enrollments && enrollments.length > 0) {
    if (!targetYearId) return true;

    // Si l'élève a une inscription sur une autre session académique que l'année cible
    const hasOtherSession = enrollments.some(e => e.academic_year_id && e.academic_year_id !== targetYearId);
    if (hasOtherSession) return true;

    // Si plusieurs inscriptions sont déjà enregistrées
    if (enrollments.length > 1) return true;
  }

  return false;
}

/**
 * Calcule l'écart et l'économie entre les frais d'inscription et les frais de réinscription.
 */
export function computeFeeDifference(
  standardInscriptionHTG: number,
  standardInscriptionUSD: number,
  reenrollmentHTG: number,
  reenrollmentUSD: number,
  exchangeRate: number = 135
): FeeDifferenceDetail {
  const diffHTG = standardInscriptionHTG - reenrollmentHTG;
  const diffUSD = standardInscriptionUSD - reenrollmentUSD;

  const savingsHTG = Math.max(0, diffHTG);
  const savingsUSD = Math.max(0, diffUSD);

  const hasAdvantage = savingsHTG > 0 || savingsUSD > 0;
  const isFreeReenrollment = reenrollmentHTG === 0 && reenrollmentUSD === 0 && (standardInscriptionHTG > 0 || standardInscriptionUSD > 0);

  let discountPercentage = 0;
  const totalStandardHTGEquiv = standardInscriptionHTG + (standardInscriptionUSD * exchangeRate);
  const totalReenrollHTGEquiv = reenrollmentHTG + (reenrollmentUSD * exchangeRate);

  if (totalStandardHTGEquiv > 0) {
    discountPercentage = Math.round(Math.max(0, (totalStandardHTGEquiv - totalReenrollHTGEquiv) / totalStandardHTGEquiv) * 100);
  }

  let summaryText = '';
  let badgeLabel = 'Tarif Standard';

  if (isFreeReenrollment) {
    badgeLabel = 'Réinscription Offerte (100%)';
    summaryText = `Frais d'entrée entièrement offerts aux anciens élèves (Économie : ${totalStandardHTGEquiv.toLocaleString()} HTG)`;
  } else if (hasAdvantage) {
    badgeLabel = `Économie : -${discountPercentage}%`;
    summaryText = `Avantage ancien élève : économie de ${savingsHTG > 0 ? `${savingsHTG.toLocaleString()} HTG` : ''}${savingsUSD > 0 ? ` $${savingsUSD.toLocaleString()} USD` : ''} (${discountPercentage}% de réduction par rapport à une nouvelle admission)`;
  } else if (reenrollmentHTG === 0 && reenrollmentUSD === 0 && standardInscriptionHTG === 0 && standardInscriptionUSD === 0) {
    badgeLabel = 'Frais d\'entrée : 0 HTG';
    summaryText = 'Frais d\'inscription et réinscription fixés à 0 HTG par l\'administration.';
  } else {
    badgeLabel = 'Tarif Réinscription';
    summaryText = 'Frais appliqués selon la grille tarifaire officielle de réinscription.';
  }

  return {
    amountHTG: diffHTG,
    amountUSD: diffUSD,
    savingsHTG,
    savingsUSD,
    hasAdvantage,
    isFreeReenrollment,
    discountPercentage,
    badgeLabel,
    summaryText
  };
}

/**
 * Calcul analytique complet des tarifs et frais d'admission pour un élève et une classe donnée.
 */
export function calculateEnrollmentPricing(
  plan: FeePlanLike | null,
  options: {
    statusInput: StudentAdmissionStatusInput;
    isForeign?: boolean;
    exchangeRate?: number;
  }
): EnrollmentPricingResult {
  const isReturningStudent = detectReturningStudentStatus(options.statusInput);
  const rate = options.exchangeRate && options.exchangeRate > 0 ? options.exchangeRate : 135;

  if (!plan) {
    const emptyFee = { amount: 0, currency: 'HTG' as const, isZero: true, isWaived: true, displayString: '0 HTG' };
    return {
      exists: false,
      isReturningStudent,
      enrollmentType: isReturningStudent ? 'REINSCRIPTION' : 'INSCRIPTION',
      feeLabel: isReturningStudent ? 'Frais de Réinscription' : "Frais d'Inscription",
      shortBadge: isReturningStudent ? 'Ancien Élève' : 'Nouveau',
      applicableAdmissionFee: emptyFee,
      standardInscriptionFee: emptyFee,
      standardReenrollmentFee: emptyFee,
      difference: computeFeeDifference(0, 0, 0, 0, rate),
      tuition: { amount: 0, currency: 'HTG', displayString: '0 HTG' },
      miscFee: { amount: 0, currency: 'HTG', displayString: '0 HTG', isMandatory: false },
      totalAnnualExpected: { totalHTG: 0, totalUSD: 0 },
      isMiscMandatory: false,
      inscription: { amount: 0, currency: 'HTG', isZero: true, displayString: '0 HTG' }
    };
  }

  // 1. Tarifs bruts officiels du fee_plan
  const inscriptionHTG = Number(plan.inscription_fee ?? 0);
  const inscriptionUSD = Number(plan.inscription_fee_usd ?? 0);

  const reenrollmentHTG = Number(plan.reenrollment_fee ?? 0);
  const reenrollmentUSD = Number(plan.reenrollment_fee_usd ?? 0);

  const tuitionHTG = options.isForeign && plan.foreign_tuition_fee ? Number(plan.foreign_tuition_fee) : Number(plan.tuition_fee ?? 0);
  const tuitionUSD = Number(plan.tuition_fee_usd ?? 0);

  const miscFeeHTG = Number(plan.misc_fee_htg ?? 0);
  const miscFeeUSD = Number(plan.misc_fee_usd ?? 0);
  const isMiscMandatory = Boolean(plan.is_misc_mandatory);

  // 2. Frais d'entrée applicables selon statut réel
  const applicableHTG = isReturningStudent ? reenrollmentHTG : inscriptionHTG;
  const applicableUSD = isReturningStudent ? reenrollmentUSD : inscriptionUSD;

  const isApplicableUSD = applicableUSD > 0 && applicableHTG === 0;
  const applicableAmount = isApplicableUSD ? applicableUSD : applicableHTG;
  const applicableCurrency: 'HTG' | 'USD' = isApplicableUSD ? 'USD' : 'HTG';
  const isApplicableZero = applicableAmount === 0;

  const formatFeeDisplay = (amt: number, curr: 'HTG' | 'USD', isReenroll: boolean) => {
    if (amt === 0) {
      return isReenroll ? 'OFFERT (0 HTG)' : 'EXONÉRÉ (0 HTG)';
    }
    return curr === 'USD' ? `$${amt.toLocaleString()} USD` : `${amt.toLocaleString()} HTG`;
  };

  const applicableAdmissionFee = {
    amount: applicableAmount,
    currency: applicableCurrency,
    isZero: isApplicableZero,
    isWaived: isApplicableZero,
    displayString: formatFeeDisplay(applicableAmount, applicableCurrency, isReturningStudent)
  };

  const standardInscriptionFee = {
    amount: inscriptionUSD > 0 && inscriptionHTG === 0 ? inscriptionUSD : inscriptionHTG,
    currency: (inscriptionUSD > 0 && inscriptionHTG === 0 ? 'USD' : 'HTG') as 'HTG' | 'USD',
    isZero: inscriptionHTG === 0 && inscriptionUSD === 0,
    displayString: formatFeeDisplay(inscriptionUSD > 0 && inscriptionHTG === 0 ? inscriptionUSD : inscriptionHTG, inscriptionUSD > 0 && inscriptionHTG === 0 ? 'USD' : 'HTG', false)
  };

  const standardReenrollmentFee = {
    amount: reenrollmentUSD > 0 && reenrollmentHTG === 0 ? reenrollmentUSD : reenrollmentHTG,
    currency: (reenrollmentUSD > 0 && reenrollmentHTG === 0 ? 'USD' : 'HTG') as 'HTG' | 'USD',
    isZero: reenrollmentHTG === 0 && reenrollmentUSD === 0,
    displayString: formatFeeDisplay(reenrollmentUSD > 0 && reenrollmentHTG === 0 ? reenrollmentUSD : reenrollmentHTG, reenrollmentUSD > 0 && reenrollmentHTG === 0 ? 'USD' : 'HTG', true)
  };

  // 3. Calcul de l'écart / avantage ancien élève
  const difference = computeFeeDifference(
    inscriptionHTG,
    inscriptionUSD,
    reenrollmentHTG,
    reenrollmentUSD,
    rate
  );

  // 4. Scolarité et Frais divers
  const isTuitionUSD = tuitionUSD > 0 && tuitionHTG === 0;
  const tuitionAmount = isTuitionUSD ? tuitionUSD : tuitionHTG;
  const tuitionCurrency: 'HTG' | 'USD' = isTuitionUSD ? 'USD' : 'HTG';

  const isMiscUSD = miscFeeUSD > 0 && miscFeeHTG === 0;
  const miscFeeAmount = isMiscUSD ? miscFeeUSD : miscFeeHTG;
  const miscFeeCurrency: 'HTG' | 'USD' = isMiscUSD ? 'USD' : 'HTG';

  // 5. Total annuel prévu
  let totalHTG = 0;
  let totalUSD = 0;

  if (applicableCurrency === 'USD') totalUSD += applicableAmount;
  else totalHTG += applicableAmount;

  if (tuitionCurrency === 'USD') totalUSD += tuitionAmount;
  else totalHTG += tuitionAmount;

  if (isMiscMandatory) {
    if (miscFeeCurrency === 'USD') totalUSD += miscFeeAmount;
    else totalHTG += miscFeeAmount;
  }

  return {
    exists: true,
    isReturningStudent,
    enrollmentType: isReturningStudent ? 'REINSCRIPTION' : 'INSCRIPTION',
    feeLabel: isReturningStudent ? 'Frais de Réinscription' : "Frais d'Inscription",
    shortBadge: isReturningStudent ? 'Ancien Élève' : 'Nouveau',
    applicableAdmissionFee,
    standardInscriptionFee,
    standardReenrollmentFee,
    difference,
    tuition: {
      amount: tuitionAmount,
      currency: tuitionCurrency,
      displayString: tuitionCurrency === 'USD' ? `$${tuitionAmount.toLocaleString()} USD` : `${tuitionAmount.toLocaleString()} HTG`
    },
    miscFee: {
      amount: miscFeeAmount,
      currency: miscFeeCurrency,
      displayString: miscFeeCurrency === 'USD' ? `$${miscFeeAmount.toLocaleString()} USD` : `${miscFeeAmount.toLocaleString()} HTG`,
      isMandatory: isMiscMandatory
    },
    totalAnnualExpected: {
      totalHTG,
      totalUSD
    },
    isMiscMandatory,
    // Rétrocompatibilité
    inscription: {
      amount: applicableAmount,
      currency: applicableCurrency,
      isZero: isApplicableZero,
      displayString: applicableAdmissionFee.displayString
    }
  };
}
