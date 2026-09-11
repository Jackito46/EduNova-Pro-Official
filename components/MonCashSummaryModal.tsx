import React from 'react';
import { 
  Smartphone, 
  X, 
  ArrowRight, 
  GraduationCap, 
  Receipt, 
  Building2,
  Phone
} from 'lucide-react';
import { formatStudentName } from '../utils/formatters';
import { useSchool } from '../contexts/SchoolContext';
import { getTerminology, Terminology } from '../lib/terminology';

export interface MonCashSummaryStudent {
  id?: string;
  first_name: string;
  last_name: string;
  code?: string;
  reference_number?: string;
  class_name?: string;
  photo_url?: string;
  parent_name?: string;
  parent_phone?: string;
}

export interface MonCashSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
  student: MonCashSummaryStudent;
  feeLabel: string;
  feeCategory?: string;
  amount: number;
  currency: 'HTG' | 'USD' | string;
  amountHTG?: number;
  payerPhone?: string;
  schoolName?: string;
  academicYear?: string;
  campusName?: string;
  terminology?: Terminology;
}

export const MonCashSummaryModal: React.FC<MonCashSummaryModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
  student,
  feeLabel,
  feeCategory,
  amount,
  currency,
  amountHTG,
  payerPhone,
  schoolName: propSchoolName,
  academicYear: propAcademicYear,
  campusName,
  terminology: propTerminology
}) => {
  // Récupération sécurisée du contexte d'École Connectée et de la terminologie
  let contextSchool: any = null;
  let contextTerminology: Terminology | null = null;
  try {
    const schoolCtx = useSchool();
    contextSchool = schoolCtx?.school;
    contextTerminology = schoolCtx?.terminology;
  } catch {
    // Si rendu en dehors du SchoolProvider, repli gracieux
  }

  const terminology = propTerminology || contextTerminology || getTerminology();
  const effectiveSchoolName = propSchoolName || contextSchool?.name || 'École Connectée';

  if (!isOpen || !student) return null;

  const formattedName = formatStudentName(student.last_name, student.first_name);
  const studentInitials = `${student.first_name?.[0] || ''}${student.last_name?.[0] || ''}`.toUpperCase() || 'EL';
  const matricule = student.code || student.reference_number || 'N/A';

  // Calcul du montant HTG final affiché
  const effectiveHTG = currency === 'HTG' 
    ? amount 
    : (amountHTG !== undefined ? amountHTG : amount);

  // Nettoyage du numéro de téléphone MonCash
  const cleanPhone = (payerPhone || '').replace(/\D/g, '');
  const displayPhone = cleanPhone.startsWith('509') ? cleanPhone.slice(3) : cleanPhone;
  const formattedPhone = displayPhone.length >= 8 
    ? `+509 ${displayPhone.slice(0, 4)} ${displayPhone.slice(4)}` 
    : (displayPhone ? `+509 ${displayPhone}` : 'Non spécifié');

  return (
    <div 
      id="moncash-summary-backdrop"
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
    >
      <div 
        id="moncash-summary-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="moncash-summary-title"
        className="relative w-full max-w-md sm:max-w-lg md:max-w-2xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden my-auto max-h-[94vh] flex flex-col animate-in zoom-in-95 duration-150"
      >
        {/* En-tête Compact MonCash / École Connectée */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-3.5 py-2.5 sm:px-5 sm:py-3 text-white shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/15 backdrop-blur-sm border border-white/25 flex items-center justify-center text-white shadow-inner shrink-0">
                <Smartphone size={17} className="text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] sm:text-[10px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded-md bg-white text-red-700 shadow-2xs leading-none">
                    École Connectée
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-red-100 uppercase tracking-wide leading-none">
                    MonCash • Étape 1/2
                  </span>
                </div>
                <h2 id="moncash-summary-title" className="text-sm sm:text-base font-black tracking-tight text-white leading-snug mt-0.5 truncate">
                  Vérification Pré-Paiement
                </h2>
              </div>
            </div>

            <button
              id="moncash-summary-close-btn"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              aria-label="Fermer et annuler"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Corps du récapitulatif dense et optimisé */}
        <div className="p-3 sm:p-4 md:p-5 overflow-y-auto space-y-2.5 sm:space-y-3">
          {/* Grille responsive : 1 colonne sur mobile, 2 colonnes sur tablette/desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
            {/* 1. Carte Identité & Dossier Scolaire */}
            <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-3 sm:p-3.5 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between border-b border-slate-200/70 pb-1.5">
                <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500 flex items-center gap-1.5">
                  <GraduationCap size={13} className="text-indigo-600" />
                  Dossier {terminology.student}
                </span>
                <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                  {matricule}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                {student.photo_url ? (
                  <img
                    src={student.photo_url}
                    alt={formattedName.fullName}
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover border border-white shadow-xs ring-1 ring-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-sm sm:text-base flex items-center justify-center shadow-xs shrink-0">
                    {studentInitials}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-snug truncate">
                    {formattedName.fullName}
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] font-semibold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {terminology.class} : <strong className="text-slate-900">{student.class_name || 'Non assignée'}</strong>
                    </span>
                    {campusName && (
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Building2 size={10} />
                        {campusName}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Contexte Parent & Établissement Connecté */}
              <div className="pt-2 border-t border-slate-200/60 space-y-1 text-[11px]">
                {student.parent_name && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-500">Tuteur :</span>
                    <span className="font-semibold text-slate-800 truncate max-w-[170px]">
                      {student.parent_name} {student.parent_phone ? `(${student.parent_phone})` : ''}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-slate-500">
                  <span>Établissement :</span>
                  <span className="font-medium text-slate-700 truncate max-w-[170px]">
                    {effectiveSchoolName} {propAcademicYear ? `• ${propAcademicYear}` : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Carte Motif, Montant & Débit MonCash */}
            <div className="bg-gradient-to-br from-red-50/90 to-rose-50/60 border border-red-200/80 rounded-xl p-3 sm:p-3.5 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between border-b border-red-200/70 pb-1.5">
                <span className="text-[10px] font-bold tracking-wider uppercase text-red-700 flex items-center gap-1.5">
                  <Receipt size={13} className="text-red-600" />
                  Motif & Imputation
                </span>
                {feeCategory && (
                  <span className="text-[10px] font-bold text-red-700 bg-white/80 px-1.5 py-0.5 rounded border border-red-200">
                    {feeCategory}
                  </span>
                )}
              </div>

              {/* Libellé du frais compact */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-600 font-medium shrink-0">Libellé :</span>
                <span className="font-bold text-slate-900 text-right truncate">
                  {feeLabel}
                </span>
              </div>

              {/* Montant Net à Débiter */}
              <div className="bg-white/80 border border-red-200/80 rounded-xl p-2 sm:p-2.5 text-center sm:text-right">
                <span className="text-[10px] font-bold tracking-wider uppercase text-red-700 block leading-none">
                  Montant Net à Débiter
                </span>
                <div className="flex items-baseline justify-center sm:justify-end gap-1.5 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-red-600 font-mono tracking-tight leading-none">
                    {Math.round(effectiveHTG).toLocaleString()} HTG
                  </span>
                </div>
                {currency === 'USD' && (
                  <span className="text-[10px] font-semibold text-slate-500 block mt-0.5">
                    (Équivalent calculé de {amount.toLocaleString()} USD)
                  </span>
                )}
              </div>

              {/* Numéro MonCash payeur */}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-red-200/50">
                <span className="text-slate-600 flex items-center gap-1 font-medium text-[11px]">
                  <Phone size={12} className="text-red-600" />
                  Tél. Payeur :
                </span>
                <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-red-200 text-[11px]">
                  {formattedPhone}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Boutons d'Action Dockés et ergonomiques */}
        <div className="p-3 sm:p-3.5 md:p-4 bg-slate-50 border-t border-slate-200/80 flex flex-col-reverse sm:flex-row items-center gap-2 shrink-0">
          <button
            id="moncash-summary-cancel-btn"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto sm:px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-white active:bg-slate-100 text-slate-700 font-bold text-xs shadow-2xs transition-all cursor-pointer disabled:opacity-50 min-h-[42px]"
          >
            Modifier / Annuler
          </button>

          <button
            id="moncash-summary-confirm-btn"
            type="button"
            onClick={() => {
              if (!isSubmitting) {
                onConfirm();
              }
            }}
            disabled={isSubmitting}
            className="w-full sm:flex-1 py-2.5 px-4 rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99] min-h-[42px] bg-red-600 hover:bg-red-700 text-white shadow-red-600/20 ring-1 ring-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span>Lancement du paiement MonCash...</span>
            ) : (
              <>
                <Smartphone size={15} />
                <span>Confirmer et Payer {Math.round(effectiveHTG).toLocaleString()} HTG</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MonCashSummaryModal;
