import { PayrollSlip } from '../types';

export type SensitivitySeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface SensitivityEvaluation {
  isSensitive: boolean;
  severity: SensitivitySeverity;
  reasons: string[];
  summary: string;
  diff: {
    base_salary: number;
    bonuses: number;
    deductions: number;
    net_salary: number;
  };
}

export interface EvaluateSlipParams {
  existingSlip?: PayrollSlip | null;
  newValues?: {
    base_salary: number;
    bonuses: number;
    deductions: number;
    net_salary: number;
  };
  isDeletion?: boolean;
  deletedSlip?: PayrollSlip | null;
  staffName?: string;
}

/**
 * Évalue si une modification sur une fiche de paie est sensible
 * Règles de sensibilité :
 * 1. Suppression d'une fiche de paie
 * 2. Modification d'une fiche déjà payée (status === 'PAID')
 * 3. Modification du salaire de base contractuel
 * 4. Écart de salaire net >= 5 000 HTG ou >= 20%
 * 5. Écart critique >= 15 000 HTG ou >= 40%
 * 6. Prime exceptionnelle >= 5 000 HTG ou >= 30% du salaire de base
 * 7. Déduction anormale >= 5 000 HTG
 */
export function evaluatePayrollSensitivity(params: EvaluateSlipParams): SensitivityEvaluation {
  const reasons: string[] = [];
  let severity: SensitivitySeverity = 'INFO';
  let isSensitive = false;

  // 1. CAS DE LA SUPPRESSION
  if (params.isDeletion) {
    const slip = params.deletedSlip || params.existingSlip;
    const net = slip?.net_salary || 0;
    const wasPaid = slip?.status === 'PAID';

    isSensitive = true;
    severity = wasPaid ? 'CRITICAL' : 'WARNING';
    reasons.push(
      wasPaid
        ? `Suppression critique d'une fiche de paie déjà COMPTABILISÉE/PAYÉE (${net.toLocaleString()} HTG)`
        : `Suppression d'une fiche de paie établie (${net.toLocaleString()} HTG)`
    );

    return {
      isSensitive: true,
      severity,
      reasons,
      summary: `Suppression de fiche de paie (${net.toLocaleString()} HTG)`,
      diff: {
        base_salary: -(slip?.base_salary || 0),
        bonuses: -(slip?.bonuses || 0),
        deductions: -(slip?.deductions || 0),
        net_salary: -net
      }
    };
  }

  // 2. CAS DE LA CRÉATION OU MODIFICATION
  const existing = params.existingSlip;
  const next = params.newValues || {
    base_salary: 0,
    bonuses: 0,
    deductions: 0,
    net_salary: 0
  };

  const oldBase = existing?.base_salary ?? 0;
  const oldBonuses = existing?.bonuses ?? 0;
  const oldDeductions = existing?.deductions ?? 0;
  const oldNet = existing?.net_salary ?? 0;

  const diffBase = next.base_salary - oldBase;
  const diffBonuses = next.bonuses - oldBonuses;
  const diffDeductions = next.deductions - oldDeductions;
  const diffNet = next.net_salary - oldNet;

  const diff = {
    base_salary: diffBase,
    bonuses: diffBonuses,
    deductions: diffDeductions,
    net_salary: diffNet
  };

  // Si c'est une création initiale sans antécédent
  if (!existing) {
    // Une création normale n'est pas forcément sensible sauf si montant hors normes
    if (next.net_salary >= 75000) {
      isSensitive = true;
      severity = 'INFO';
      reasons.push(`Création de fiche à rémunération élevée (${next.net_salary.toLocaleString()} HTG)`);
    }
    return {
      isSensitive,
      severity,
      reasons,
      summary: isSensitive 
        ? `Création de fiche sensible (${next.net_salary.toLocaleString()} HTG)` 
        : `Création de fiche (${next.net_salary.toLocaleString()} HTG)`,
      diff
    };
  }

  // A. Modification d'une fiche déjà payée
  if (existing.status === 'PAID') {
    isSensitive = true;
    severity = 'CRITICAL';
    reasons.push(`Modification d'une fiche de paie ayant déjà le statut PAYÉE`);
  }

  // B. Modification du salaire de base
  if (diffBase !== 0) {
    isSensitive = true;
    if (Math.abs(diffBase) >= 10000) {
      severity = 'CRITICAL';
    } else if (severity !== 'CRITICAL') {
      severity = 'WARNING';
    }
    const sign = diffBase > 0 ? '+' : '';
    reasons.push(
      `Ajustement du salaire de base : ${oldBase.toLocaleString()} ➔ ${next.base_salary.toLocaleString()} HTG (${sign}${diffBase.toLocaleString()} HTG)`
    );
  }

  // C. Écart de salaire net
  const absNetDiff = Math.abs(diffNet);
  const percentNetDiff = oldNet > 0 ? (absNetDiff / oldNet) * 100 : 0;

  if (absNetDiff >= 15000 || (percentNetDiff >= 40 && absNetDiff >= 5000)) {
    isSensitive = true;
    severity = 'CRITICAL';
    const sign = diffNet > 0 ? '+' : '';
    reasons.push(
      `Variation critique du salaire net : ${sign}${diffNet.toLocaleString()} HTG (${sign}${percentNetDiff.toFixed(1)}%)`
    );
  } else if (absNetDiff >= 5000 || (percentNetDiff >= 20 && absNetDiff >= 2000)) {
    isSensitive = true;
    if (severity !== 'CRITICAL') severity = 'WARNING';
    const sign = diffNet > 0 ? '+' : '';
    reasons.push(
      `Variation notable du salaire net : ${sign}${diffNet.toLocaleString()} HTG (${sign}${percentNetDiff.toFixed(1)}%)`
    );
  }

  // D. Primes et bonus exceptionnels
  if (diffBonuses >= 5000 || (next.bonuses >= 0.3 * next.base_salary && next.bonuses >= 3000)) {
    isSensitive = true;
    if (severity !== 'CRITICAL') severity = 'WARNING';
    reasons.push(
      `Prime exceptionnelle : +${diffBonuses.toLocaleString()} HTG (Total primes: ${next.bonuses.toLocaleString()} HTG)`
    );
  }

  // E. Retenues anormales ou élevées
  if (diffDeductions >= 5000) {
    isSensitive = true;
    if (severity !== 'CRITICAL') severity = 'WARNING';
    reasons.push(
      `Augmentation importante des retenues : +${diffDeductions.toLocaleString()} HTG (Total retenues: ${next.deductions.toLocaleString()} HTG)`
    );
  }

  const summary = reasons.length > 0
    ? reasons[0]
    : `Modification de fiche de paie (Net: ${next.net_salary.toLocaleString()} HTG)`;

  return {
    isSensitive,
    severity,
    reasons,
    summary,
    diff
  };
}
