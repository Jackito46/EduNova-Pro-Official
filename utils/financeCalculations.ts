/**
 * Module de Calculs Financiers Multi-Devises & Résolution des Taux de Change Historiques
 * 
 * Règle d'or comptable :
 * Lorsqu'un frais planifié en devises (ex: 200 USD de Frais Divers) est acquitté par l'élève 
 * (soit en USD, soit en Gourdes au taux de change du jour de transaction, ex: 27 000 G @ 135),
 * l'obligation est intégralement soldée (100%).
 * Une augmentation ultérieure du taux de change ne doit JAMAIS faire réapparaître de reliquat fictif 
 * (phantom debt) sur une obligation déjà payée dans le passé.
 */

export interface FeeCategoryBreakdown {
  plannedHTG: number;
  plannedUSD: number;
  discountHTG: number;
  effectiveDueHTG: number;
  effectiveDueUSD: number;
  paidHTGEquiv: number;
  paidUSDVal: number;
  paidHTGDirect: number;
  paidUSDDirect: number;
  remainingHTG: number;
  remainingUSD: number;
  remainingHTGEquiv: number;
  isPaid: boolean;
}

/**
 * Calcule avec exactitude comptable la balance d'un type de frais (Admission, Scolarité, Divers, Campagne)
 * Sépare rigoureusement les dettes par devise (HTG vs USD) pour éliminer toute confusion lors de paiements mixtes.
 */
export function computeFeeCategoryBalance(
  plannedHTG: number,
  plannedUSD: number,
  payments: any[],
  currentExchangeRate: number,
  discountHTG: number = 0
): FeeCategoryBreakdown {
  const rate = currentExchangeRate && currentExchangeRate > 0 ? currentExchangeRate : 135;
  
  let totalPaidHTG = 0;
  let totalPaidUSD = 0;
  let paidHTGDirect = 0;
  let paidUSDDirect = 0;

  for (const p of payments) {
    if (!p) continue;
    const isUSD = p.currency === 'USD';
    const amount = Number(p.amount || 0);
    
    // Détection du taux de change scellé historique de la transaction
    let pRate = rate;
    if (p.exchange_rate_applied && Number(p.exchange_rate_applied) > 1) {
      pRate = Number(p.exchange_rate_applied);
    } else if (isUSD && p.amount_htg_equivalent && amount > 0) {
      pRate = Number(p.amount_htg_equivalent) / amount;
    } else if (!isUSD && plannedUSD > 0 && amount > 0) {
      // Détection rétrospective pour les anciens versements en HTG d'un frais planifié en USD
      const impliedRate = amount / plannedUSD;
      if (impliedRate >= 50 && impliedRate <= 300) {
        pRate = impliedRate;
      }
    }

    if (isUSD) {
      paidUSDDirect += amount;
      totalPaidUSD += amount;
      totalPaidHTG += Number(p.amount_htg_equivalent) || (amount * pRate);
    } else {
      const htgAmount = Number(p.amount_htg_equivalent) || amount;
      paidHTGDirect += amount;
      totalPaidHTG += htgAmount;
      totalPaidUSD += (pRate > 0 ? htgAmount / pRate : htgAmount / rate);
    }
  }

  // 1. Frais planifié à 100% en USD
  if (plannedUSD > 0 && plannedHTG === 0) {
    const discountUSD = discountHTG > 0 ? discountHTG / rate : 0;
    const effectiveUSD = Math.max(0, plannedUSD - discountUSD);
    const diffUSD = effectiveUSD - totalPaidUSD;
    const diffHTG = Math.round(diffUSD * rate);
    
    // RÈGLE MÉTIER DE STABILISATION MULTI-DEVISES & ABSORPTION DES ÉCARTS DE CHANGE :
    // Lorsqu'un frais planifié en USD a été réglé en devises mixtes (USD et/ou HTG),
    // les variations de taux de change ou les coupures de monnaie locale
    // créent fréquemment un micro-reliquat résiduel (ex: <= $3.00 USD ou <= 450 HTG, ou >= 96% réglé).
    // Ce résidu est AUTOMATIQUEMENT ABSORBÉ comme écart de change acceptable.
    const isPaid = diffUSD <= 0.10 || 
      diffUSD <= 3.00 || 
      diffHTG <= 450.0 || 
      (effectiveUSD > 0 && (totalPaidUSD / effectiveUSD) >= 0.96) ||
      (effectiveUSD > 0 && totalPaidUSD >= effectiveUSD - 3.00) || 
      (effectiveUSD > 0 && totalPaidHTG >= (effectiveUSD * rate - 450.0));
      
    const remainingUSD = isPaid ? 0 : Math.max(0, diffUSD);
    const remainingHTGEquiv = isPaid ? 0 : Math.round(remainingUSD * rate);
    // Alignement comptable : si le frais est acquitté, le montant exigé en HTG s'aligne sur le total versé
    const effectiveDueHTG = isPaid ? totalPaidHTG : (totalPaidHTG + remainingHTGEquiv);

    return {
      plannedHTG: 0,
      plannedUSD,
      discountHTG,
      effectiveDueHTG,
      effectiveDueUSD: effectiveUSD,
      paidHTGEquiv: totalPaidHTG,
      paidUSDVal: isPaid ? effectiveUSD : Math.round(totalPaidUSD * 100) / 100,
      paidHTGDirect,
      paidUSDDirect,
      remainingHTG: 0, // Dette séparée : un frais en USD a 0 dette native en HTG
      remainingUSD: Math.round(remainingUSD * 100) / 100, // Dette native en USD
      remainingHTGEquiv,
      isPaid
    };
  }

  // 2. Frais planifié à 100% en HTG (Gourdes)
  if (plannedHTG > 0 && plannedUSD === 0) {
    const effectiveHTG = Math.max(0, plannedHTG - discountHTG);
    const diffHTG = effectiveHTG - totalPaidHTG;
    // Tolérance d'arrondi de 50 Gourdes
    const isPaid = diffHTG <= 50.0 || (effectiveHTG > 0 && (totalPaidHTG >= effectiveHTG - 50.0 || (totalPaidHTG / effectiveHTG) >= 0.98));
    const remainingHTG = isPaid ? 0 : Math.max(0, diffHTG);
    const effectiveDueHTG = isPaid ? totalPaidHTG : effectiveHTG;

    return {
      plannedHTG,
      plannedUSD: 0,
      discountHTG,
      effectiveDueHTG,
      effectiveDueUSD: 0,
      paidHTGEquiv: totalPaidHTG,
      paidUSDVal: totalPaidUSD,
      paidHTGDirect,
      paidUSDDirect,
      remainingHTG: Math.round(remainingHTG), // Dette native en HTG
      remainingUSD: 0, // Dette séparée : un frais en HTG a 0 dette native en USD
      remainingHTGEquiv: Math.round(remainingHTG),
      isPaid
    };
  }

  // 3. Frais Hybride (HTG + USD) ou zéro
  if (plannedHTG === 0 && plannedUSD === 0) {
    return {
      plannedHTG: 0,
      plannedUSD: 0,
      discountHTG: 0,
      effectiveDueHTG: totalPaidHTG,
      effectiveDueUSD: 0,
      paidHTGEquiv: totalPaidHTG,
      paidUSDVal: totalPaidUSD,
      paidHTGDirect,
      paidUSDDirect,
      remainingHTG: 0,
      remainingUSD: 0,
      remainingHTGEquiv: 0,
      isPaid: true
    };
  }

  const effectiveUSD = plannedUSD;
  const effectiveHTG = Math.max(0, plannedHTG - discountHTG);
  
  // Amortissement direct par devise
  const usdPaidForUSD = Math.min(effectiveUSD, totalPaidUSD);
  const excessUSD = Math.max(0, totalPaidUSD - effectiveUSD);
  
  const htgPaidForHTG = Math.min(effectiveHTG, totalPaidHTG);
  const excessHTG = Math.max(0, totalPaidHTG - effectiveHTG);

  // Amortissement croisé des reliquats avec les excédents
  const excessUSDinHTG = excessUSD * rate;
  let rawRemainingHTG = Math.max(0, effectiveHTG - htgPaidForHTG - excessUSDinHTG);

  const excessHTGinUSD = excessHTG > 0 ? excessHTG / rate : 0;
  let rawRemainingUSD = Math.max(0, effectiveUSD - usdPaidForUSD - excessHTGinUSD);

  // Application des tolérances
  if (rawRemainingUSD <= 3.00 || (effectiveUSD > 0 && rawRemainingUSD / effectiveUSD <= 0.04)) {
    rawRemainingUSD = 0;
  }
  if (rawRemainingHTG <= 50.0 || (effectiveHTG > 0 && rawRemainingHTG / effectiveHTG <= 0.02)) {
    rawRemainingHTG = 0;
  }

  const isPaid = rawRemainingHTG <= 0 && rawRemainingUSD <= 0;
  const remainingHTG = isPaid ? 0 : Math.round(rawRemainingHTG);
  const remainingUSD = isPaid ? 0 : Math.round(rawRemainingUSD * 100) / 100;
  const remainingHTGEquiv = isPaid ? 0 : Math.round(remainingHTG + (remainingUSD * rate));
  const effectiveDueHTG = isPaid ? totalPaidHTG : (effectiveHTG + Math.round(effectiveUSD * rate));

  return {
    plannedHTG,
    plannedUSD,
    discountHTG,
    effectiveDueHTG,
    effectiveDueUSD: effectiveUSD,
    paidHTGEquiv: totalPaidHTG,
    paidUSDVal: totalPaidUSD,
    paidHTGDirect,
    paidUSDDirect,
    remainingHTG,
    remainingUSD,
    remainingHTGEquiv,
    isPaid
  };
}

/**
 * Formate les détails visuels d'une ligne de frais pour les vues de suivi et portefeuilles
 * Met en évidence les devises natives payées et restant dues.
 */
export function getFormattedFeeRowDetails(
  plannedHTG: number,
  plannedUSD: number,
  payments: any[],
  currentExchangeRate: number,
  discountHTG: number = 0
) {
  const breakdown = computeFeeCategoryBalance(
    plannedHTG,
    plannedUSD,
    payments,
    currentExchangeRate,
    discountHTG
  );

  const rate = currentExchangeRate || 135;
  const rawTotalHTGEquiv = plannedHTG + (plannedUSD * rate);

  let plannedNative = '';
  let plannedEquiv = '';

  if (discountHTG > 0) {
    plannedNative = `${Math.round(breakdown.effectiveDueHTG).toLocaleString()} G`;
    plannedEquiv = `(Base: ${Math.round(rawTotalHTGEquiv).toLocaleString()} G - Remise: ${discountHTG.toLocaleString()} G)`;
  } else if (plannedUSD > 0 && plannedHTG > 0) {
    plannedNative = `${plannedHTG.toLocaleString()} G + $${plannedUSD.toLocaleString()} USD`;
    plannedEquiv = `≈ ${Math.round(rawTotalHTGEquiv).toLocaleString()} HTG`;
  } else if (plannedUSD > 0) {
    plannedNative = `$${plannedUSD.toLocaleString()} USD`;
    plannedEquiv = `≈ ${Math.round(plannedUSD * rate).toLocaleString()} HTG`;
  } else {
    plannedNative = `${plannedHTG.toLocaleString()} G`;
    plannedEquiv = '';
  }

  // Formatage des montants versés avec décomposition si paiement mixte
  let paidNative = `+${Math.round(breakdown.paidHTGEquiv).toLocaleString()} G`;
  let paidEquiv = '';

  if (breakdown.paidUSDDirect > 0 && breakdown.paidHTGDirect > 0) {
    paidNative = `+$${breakdown.paidUSDDirect.toFixed(2)} USD + ${Math.round(breakdown.paidHTGDirect).toLocaleString()} G`;
    paidEquiv = `(≈ +${Math.round(breakdown.paidHTGEquiv).toLocaleString()} HTG)`;
  } else if (breakdown.paidUSDDirect > 0) {
    paidNative = `+$${breakdown.paidUSDDirect.toFixed(2)} USD`;
    paidEquiv = `(≈ +${Math.round(breakdown.paidHTGEquiv).toLocaleString()} HTG)`;
  } else if (plannedUSD > 0 && breakdown.paidHTGEquiv > 0) {
    paidNative = `+${Math.round(breakdown.paidHTGEquiv).toLocaleString()} G`;
    paidEquiv = `(≈ $${breakdown.paidUSDVal.toFixed(2)} USD au taux historique)`;
  }

  let remainingNative = '';
  let remainingEquiv = '';

  if (breakdown.isPaid) {
    remainingNative = 'Réglé';
    remainingEquiv = '';
  } else if (breakdown.remainingUSD > 0 && breakdown.remainingHTG > 0) {
    remainingNative = `${Math.round(breakdown.remainingHTG).toLocaleString()} G + $${breakdown.remainingUSD.toFixed(2)} USD`;
    remainingEquiv = `≈ ${Math.round(breakdown.remainingHTGEquiv).toLocaleString()} HTG`;
  } else if (breakdown.remainingUSD > 0) {
    const formattedUSD = breakdown.remainingUSD % 1 === 0 
      ? `$${breakdown.remainingUSD.toLocaleString()} USD` 
      : `$${breakdown.remainingUSD.toFixed(2)} USD`;
    remainingNative = formattedUSD;
    remainingEquiv = `≈ ${Math.round(breakdown.remainingHTGEquiv).toLocaleString()} HTG`;
  } else {
    remainingNative = `${Math.round(breakdown.remainingHTG).toLocaleString()} HTG`;
    remainingEquiv = '';
  }

  return {
    ...breakdown,
    plannedNative,
    plannedEquiv,
    paidNative,
    paidEquiv,
    remainingNative,
    remainingEquiv
  };
}
