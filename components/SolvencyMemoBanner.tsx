import React from 'react';
import { AlertTriangle, CheckCircle2, FileText, ShieldAlert } from 'lucide-react';

export interface SolvencyMemoVisibilityInput {
  hasSelectedStudent: boolean;
  isLoading: boolean;
  globalDebt: number;
  currentSessionDebt: number;
  isNotEnrolledInTargetYear?: boolean;
}

export interface SolvencyMemoVisibilityState {
  hasHistoricalArrears: boolean;
  hasActiveSessionBalance: boolean;
  isDebtFinalized: boolean;
  showCompactMemo: boolean;
  showDetailedMemo: boolean;
}

/**
 * Détermine la visibilité des mémos de solvabilité et d'audit historique.
 * Masque automatiquement les mémos "Solvabilité Certifiée" / "Audit Historique"
 * dès que le reliquat est à zéro et que la dette est finalisée.
 */
export function computeSolvencyMemoVisibility(
  input: SolvencyMemoVisibilityInput
): SolvencyMemoVisibilityState {
  const {
    hasSelectedStudent,
    isLoading,
    globalDebt,
    currentSessionDebt,
    isNotEnrolledInTargetYear = false
  } = input;

  if (!hasSelectedStudent || isLoading) {
    return {
      hasHistoricalArrears: false,
      hasActiveSessionBalance: false,
      isDebtFinalized: false,
      showCompactMemo: false,
      showDetailedMemo: false
    };
  }

  const hasHistoricalArrears = Number(globalDebt || 0) > 0;
  const hasActiveSessionBalance = Number(currentSessionDebt || 0) > 0;
  const isDebtFinalized = !hasHistoricalArrears && !hasActiveSessionBalance;

  return {
    hasHistoricalArrears,
    hasActiveSessionBalance,
    isDebtFinalized,
    showCompactMemo: !isDebtFinalized && (hasHistoricalArrears || hasActiveSessionBalance),
    showDetailedMemo: hasHistoricalArrears || hasActiveSessionBalance || Boolean(isNotEnrolledInTargetYear)
  };
}

export interface SolvencyMemoBannerProps {
  /** Contrôle conditionnel de l'affichage du mémo selon l'état de solvabilité */
  visible: boolean;
  variant: 'compact' | 'detailed';
  globalDebt: number;
  currentSessionDebt: number;
  sessionLabel?: string;
  studentTerm: string;
  isNotEnrolledInTargetYear?: boolean;
  isReenrollment?: boolean;
  inscriptionDue?: number;
  pastArrearsSessionLabels?: string[];
  firstArrearsSession?: { academicYearId: string; academicYearLabel: string } | null;
  futureEnrollmentLabel?: string | null;
  onSelectTargetYear?: (yearId: string) => void;
  onOpenDossierAudit: () => void;
}

export const SolvencyMemoBanner: React.FC<SolvencyMemoBannerProps> = ({
  visible,
  variant,
  globalDebt,
  currentSessionDebt,
  sessionLabel = 'Session',
  studentTerm,
  isNotEnrolledInTargetYear = false,
  isReenrollment = false,
  inscriptionDue = 0,
  pastArrearsSessionLabels = [],
  firstArrearsSession = null,
  futureEnrollmentLabel = null,
  onSelectTargetYear,
  onOpenDossierAudit
}) => {
  // Masquage strict lorsque la prop visible est false ou lorsque la dette est soldée
  if (!visible) {
    return null;
  }

  const hasHistoricalArrears = globalDebt > 0;
  const hasActiveSessionBalance = currentSessionDebt > 0;

  if (variant === 'compact') {
    if (hasHistoricalArrears) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <ShieldAlert size={13} className="text-rose-600" />
          <span>Audit Historique : </span>
          <strong className="text-rose-700 font-bold">
            {`${globalDebt.toLocaleString()} HTG d'arriérés`}
          </strong>
        </div>
      );
    }

    if (hasActiveSessionBalance) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <AlertTriangle size={13} className="text-amber-600" />
          <span>Reliquat à solder ({sessionLabel}) : </span>
          <strong className="text-amber-700 font-bold">
            {`${currentSessionDebt.toLocaleString()} HTG`}
          </strong>
        </div>
      );
    }

    return null;
  }

  // Variante détaillée (au-dessus du bouton d'encaissement dans le formulaire)
  if (hasHistoricalArrears) {
    return (
      <div className="bg-rose-50/80 p-3.5 rounded-2xl border border-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="text-rose-600 mt-0.5 shrink-0" size={16} />
          <div>
            <p className="text-[11px] sm:text-xs text-rose-900 font-semibold leading-relaxed">
              <strong className="font-bold">Arriérés Confirmés :</strong> L'{studentTerm.toLowerCase()} a une dette réelle de {globalDebt.toLocaleString()} HTG sur son historique ({pastArrearsSessionLabels.join(', ') || 'session(s) précédente(s)'}).
            </p>
            <p className="text-[10.5px] text-rose-700 mt-0.5">
              Assurez-vous d'imputer le paiement à la bonne session ou de régulariser ces arriérés.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {firstArrearsSession?.academicYearId && onSelectTargetYear && (
            <button
              type="button"
              onClick={() => onSelectTargetYear(firstArrearsSession.academicYearId)}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shrink-0 transition-all cursor-pointer shadow-xs whitespace-nowrap"
            >
              Régler {firstArrearsSession.academicYearLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onOpenDossierAudit}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shrink-0 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
          >
            <FileText size={13} /> Examiner le dossier
          </button>
        </div>
      </div>
    );
  }

  if (isNotEnrolledInTargetYear) {
    return (
      <div className="bg-blue-50/80 p-3.5 rounded-2xl border border-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="text-blue-600 mt-0.5 shrink-0" size={16} />
          <div>
            <p className="text-[11px] sm:text-xs text-blue-900 font-semibold leading-relaxed">
              <strong className="font-bold">Régularisation d'Inscription :</strong> Le montant saisi sera imputé directement {isReenrollment ? 'aux frais de réinscription' : "aux frais d'inscription"} de la session ciblée ({sessionLabel}).
            </p>
            <p className="text-[10.5px] text-blue-700 mt-0.5">
              {isReenrollment ? 'Frais de réinscription de la session : ' : "Frais d'inscription de la session : "}
              {inscriptionDue === 0 ? 'Exonéré / 0 HTG (Offert)' : `${inscriptionDue.toLocaleString()} HTG`}.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenDossierAudit}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shrink-0 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs self-end sm:self-center"
        >
          <FileText size={13} /> Réviser le dossier
        </button>
      </div>
    );
  }

  if (hasActiveSessionBalance) {
    return (
      <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="text-amber-600 mt-0.5 shrink-0" size={16} />
          <div>
            <p className="text-[11px] sm:text-xs text-amber-950 font-medium leading-relaxed">
              <strong className="font-bold">Reliquat à finaliser :</strong> L'{studentTerm.toLowerCase()} a encore un solde de <strong className="font-bold font-mono">{currentSessionDebt.toLocaleString()} HTG</strong> à acquitter pour solder la session {sessionLabel}.
            </p>
            {futureEnrollmentLabel && (
              <p className="text-[10.5px] text-amber-800 mt-0.5">
                Pré-inscrit(e) pour la future session ({futureEnrollmentLabel}) — ce reliquat reste dû avant clôture complète.
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenDossierAudit}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shrink-0 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs self-end sm:self-center whitespace-nowrap"
        >
          <FileText size={13} /> Examiner le dossier
        </button>
      </div>
    );
  }

  return null;
};
