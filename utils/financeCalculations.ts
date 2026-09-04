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
  remainingHTG: number;
  remainingUSD: number;
  isPaid: boolean;
}

/**
 * Calcule avec exactitude comptable la balance d'un type de frais (Admission, Scolarité, Divers, Campagne)
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

  for (const p of payments) {
    if (!p) continue;
    const isUSD = p.currency === 'USD';
    const amount = Number(p.amount || 0);
    
    // Détection du taux de change de la transaction
    let pRate = rate;
    if (p.exchange_rate_applied && Number(p.exchange_rate_applied) > 1) {
      pRate = Number(p.exchange_rate_applied);
    } else if (isUSD && p.amount_htg_equivalent && amount > 0) {
      pRate = Number(p.amount_htg_equivalent) / amount;
    }

    if (isUSD) {
      totalPaidUSD += amount;
      totalPaidHTG += Number(p.amount_htg_equivalent) || (amount * pRate);
    } else {
      const htgAmount = Number(p.amount_htg_equivalent) || amount;
      totalPaidHTG += htgAmount;
      totalPaidUSD += (pRate > 0 ? htgAmount / pRate : htgAmount / rate);
    }
  }

  // 1. Frais planifié à 100% en USD
  if (plannedUSD > 0 && plannedHTG === 0) {
    const discountUSD = discountHTG > 0 ? discountHTG / rate : 0;
    const effectiveUSD = Math.max(0, plannedUSD - discountUSD);
    const diffUSD = effectiveUSD - totalPaidUSD;
    
    // Marge de tolérance de 5 centimes (ou équivalent HTG) pour les arrondis de division
    // La dette n'est considérée acquittée (Réglée) que si le versement couvre effectivement la totalité due
    const isPaid = diffUSD <= 0.05 || (effectiveUSD > 0 && totalPaidUSD >= effectiveUSD - 0.05) || (effectiveUSD > 0 && totalPaidHTG >= (effectiveUSD * rate - 1.0));
    const remainingUSD = isPaid ? 0 : Math.max(0, diffUSD);
    const remainingHTG = isPaid ? 0 : Math.round(remainingUSD * rate);
    const effectiveDueHTG = isPaid ? totalPaidHTG : (totalPaidHTG + remainingHTG);

    return {
      plannedHTG: 0,
      plannedUSD,
      discountHTG,
      effectiveDueHTG,
      effectiveDueUSD: effectiveUSD,
      paidHTGEquiv: totalPaidHTG,
      paidUSDVal: isPaid ? effectiveUSD : Math.round(totalPaidUSD * 100) / 100,
      remainingHTG,
      remainingUSD: Math.round(remainingUSD * 100) / 100,
      isPaid
    };
  }

  // 2. Frais planifié à 100% en HTG (Gourdes)
  if (plannedHTG > 0 && plannedUSD === 0) {
    const effectiveHTG = Math.max(0, plannedHTG - discountHTG);
    const diffHTG = effectiveHTG - totalPaidHTG;
    const isPaid = diffHTG <= 1.0 || (effectiveHTG > 0 && totalPaidHTG >= effectiveHTG - 1.0);
    const remainingHTG = isPaid ? 0 : Math.max(0, diffHTG);
    const remainingUSD = isPaid ? 0 : (remainingHTG / rate);
    const effectiveDueHTG = isPaid ? totalPaidHTG : effectiveHTG;

    return {
      plannedHTG,
      plannedUSD: 0,
      discountHTG,
      effectiveDueHTG,
      effectiveDueUSD: 0,
      paidHTGEquiv: totalPaidHTG,
      paidUSDVal: totalPaidUSD,
      remainingHTG,
      remainingUSD,
      isPaid
    };
  }

  // 3. Frais Hybride (HTG + USD) ou zéro
  const rawTotalHTG = plannedHTG + (plannedUSD * rate);
  const effectiveHTG = Math.max(0, rawTotalHTG - discountHTG);
  const diffHTG = effectiveHTG - totalPaidHTG;
  const isPaid = diffHTG <= 1.0 || (effectiveHTG > 0 && totalPaidHTG >= effectiveHTG - 1.0);
  const remainingHTG = isPaid ? 0 : Math.max(0, diffHTG);
  const remainingUSD = isPaid ? 0 : (remainingHTG / rate);
  const effectiveDueHTG = isPaid ? totalPaidHTG : effectiveHTG;

  return {
    plannedHTG,
    plannedUSD,
    discountHTG,
    effectiveDueHTG,
    effectiveDueUSD: plannedUSD,
    paidHTGEquiv: totalPaidHTG,
    paidUSDVal: totalPaidUSD,
    remainingHTG,
    remainingUSD,
    isPaid
  };
}

/**
 * Formate les détails visuels d'une ligne de frais pour les vues de suivi et portefeuilles
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
    plannedEquiv = ''; // Pas de conversion USD pour les frais planifiés en Gourdes
  }

  const paidNative = `+${Math.round(breakdown.paidHTGEquiv).toLocaleString()} G`;
  const paidEquiv = (plannedUSD > 0 && breakdown.paidHTGEquiv > 0) 
    ? `(≈ $${breakdown.paidUSDVal.toFixed(2)} USD)` 
    : '';

  let remainingNative = '';
  let remainingEquiv = '';

  if (breakdown.isPaid) {
    remainingNative = 'Réglé';
    remainingEquiv = '';
  } else if (plannedUSD > 0 && plannedHTG === 0) {
    const formattedUSD = breakdown.remainingUSD % 1 === 0 
      ? `$${breakdown.remainingUSD.toLocaleString()} USD` 
      : `$${breakdown.remainingUSD.toFixed(2)} USD`;
    remainingNative = formattedUSD;
    remainingEquiv = `≈ ${Math.round(breakdown.remainingHTG).toLocaleString()} HTG`;
  } else {
    remainingNative = `${Math.round(breakdown.remainingHTG).toLocaleString()} HTG`;
    remainingEquiv = plannedUSD > 0 ? `≈ $${breakdown.remainingUSD.toFixed(2)} USD` : '';
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
