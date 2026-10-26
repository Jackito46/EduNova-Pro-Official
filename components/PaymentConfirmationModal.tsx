import React, { useState } from 'react';
import { 
  ShieldCheck, 
  X, 
  Check, 
  ArrowRight, 
  GraduationCap, 
  Receipt, 
  Building2, 
  Smartphone, 
  Banknote, 
  CreditCard, 
  FileText, 
  Wallet, 
  Lock, 
  AlertTriangle,
  Loader2,
  Phone,
  CheckCircle2,
  Calendar,
  Layers
} from 'lucide-react';
import { formatStudentName } from '../utils/formatters';
import { Terminology, getTerminology } from '../lib/terminology';

export interface PaymentConfirmationStudent {
  id?: string;
  first_name: string;
  last_name: string;
  fullName?: string;
  code?: string;
  reference_number?: string;
  class_name?: string;
  classe?: string;
  photo_url?: string;
  parent_name?: string;
  parent_phone?: string;
  phone?: string;
}

export interface PaymentConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
  student: PaymentConfirmationStudent;
  feeLabel: string;
  feeCategory?: string;
  amount: number;
  currency: 'HTG' | 'USD' | string;
  amountHTG?: number;
  amountUSD?: number;
  exchangeRate?: number;
  paymentMethod: string;
  activeGateway?: string;
  referenceNumber?: string;
  bankName?: string;
  depositDate?: string;
  payerPhone?: string;
  onPayerPhoneChange?: (phone: string) => void;
  schoolName?: string;
  academicYearLabel?: string;
  campusName?: string;
  terminology?: Terminology;
}

export const PaymentConfirmationModal: React.FC<PaymentConfirmationModalProps> = ({
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
  amountUSD,
  exchangeRate = 132.50,
  paymentMethod,
  activeGateway = 'tranzak',
  referenceNumber,
  bankName,
  depositDate,
  payerPhone,
  onPayerPhoneChange,
  schoolName = 'Établissement Scolaire',
  academicYearLabel,
  campusName,
  terminology = getTerminology()
}) => {
  const [phoneOverride, setPhoneOverride] = useState<string>(payerPhone || student.parent_phone || student.phone || '');
  const [isEditingPhone, setIsEditingPhone] = useState<boolean>(false);

  if (!isOpen || !student) return null;

  const formattedName = formatStudentName(student.last_name, student.first_name);
  const studentInitials = `${student.first_name?.[0] || ''}${student.last_name?.[0] || ''}`.toUpperCase() || 'EL';
  const matricule = student.code || student.reference_number || (student.id ? student.id.slice(0, 8) : 'N/A');

  const isMonCash = paymentMethod === 'MonCash';
  const isCash = paymentMethod === 'Cash' || paymentMethod === 'Espèces';
  const isCheque = paymentMethod === 'Chèque';
  const isDeposit = paymentMethod === 'Dépôt Bancaire';
  const isWallet = paymentMethod === 'Portefeuille';

  // Calculs monétaires récapitulatifs
  const isUSD = currency === 'USD';
  const displayHTG = isUSD 
    ? (amountHTG !== undefined ? amountHTG : Math.round(amount * exchangeRate))
    : amount;
  const displayUSD = isUSD
    ? amount
    : (amountUSD !== undefined ? amountUSD : (exchangeRate > 0 ? Math.round((amount / exchangeRate) * 100) / 100 : 0));

  const handlePhoneChange = (newVal: string) => {
    setPhoneOverride(newVal);
    if (onPayerPhoneChange) {
      onPayerPhoneChange(newVal);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        
        {/* EN-TÊTE : COULEUR ADAPTATIVE SELON LE MODE */}
        <div className={`p-4 sm:p-5 text-white flex items-center justify-between gap-3 shrink-0 ${
          isMonCash 
            ? 'bg-gradient-to-r from-red-700 via-rose-700 to-red-800' 
            : 'bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-white shrink-0 shadow-inner">
              {isMonCash ? <Smartphone size={20} /> : isCash ? <Banknote size={20} /> : isCheque ? <FileText size={20} /> : isDeposit ? <Building2 size={20} /> : <ShieldCheck size={20} />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/25">
                  Vérification Anti-Erreur
                </span>
                {academicYearLabel && (
                  <span className="text-[10px] font-semibold text-white/80">
                    Session {academicYearLabel}
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white mt-0.5 truncate">
                Confirmer l'Encaissement Officiel
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-colors cursor-pointer disabled:opacity-50 shrink-0"
            title="Annuler et retourner au formulaire"
          >
            <X size={18} />
          </button>
        </div>

        {/* CORPS DU RÉCAPITULATIF */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
          
          {/* BANDEAU ÉLÈVE CIBLÉ */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {student.photo_url ? (
                <img
                  src={student.photo_url}
                  alt={formattedName.fullName}
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-xl object-cover border border-white shadow-xs ring-1 ring-slate-200 shrink-0"
                />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white font-black text-sm flex items-center justify-center shadow-xs shrink-0">
                  {studentInitials}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-sm font-black text-slate-900 truncate">
                    {formattedName.fullName}
                  </h3>
                  <span className="text-[9.5px] font-mono font-bold bg-white px-1.5 py-0.2 rounded border border-slate-200 text-slate-600">
                    Matricule: {matricule}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600 mt-0.5 flex-wrap">
                  <span className="font-semibold text-slate-800">
                    {terminology.class} : {student.class_name || student.classe || 'Non assignée'}
                  </span>
                  {campusName && (
                    <>
                      <span>•</span>
                      <span className="text-indigo-600 font-medium">📍 {campusName}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0 hidden sm:block">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Établissement
              </span>
              <span className="text-xs font-bold text-slate-700 truncate max-w-[150px] block">
                {schoolName}
              </span>
            </div>
          </div>

          {/* CARTE MONTANT & IMPUTATION (MISE EN AVANT MAXIMALE) */}
          <div className="bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/50 border border-indigo-200/80 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                <Receipt size={14} className="text-indigo-600" />
                <span>Imputation Comptable</span>
              </span>
              <span className="text-xs font-bold bg-indigo-100/80 text-indigo-800 px-2.5 py-0.5 rounded-full border border-indigo-200">
                {feeLabel}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <span className="text-xs font-bold text-slate-600">
                Montant total perçu :
              </span>
              <div className="text-left sm:text-right">
                <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight leading-none">
                  {amount.toLocaleString()} <span className="text-indigo-600 text-xl sm:text-2xl">{currency}</span>
                </div>
                {isUSD ? (
                  <span className="text-[11px] font-bold text-slate-500 block mt-1">
                    Équivalent : <strong className="text-slate-800 font-mono">{displayHTG.toLocaleString()} HTG</strong> (taux : {exchangeRate} HTG/$)
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-slate-500 block mt-1">
                    Équivalent : <strong className="text-slate-800 font-mono">${displayUSD.toLocaleString()} USD</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* DÉTAILS DU MODE DE RÈGLEMENT */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <CreditCard size={13} className="text-slate-500" />
                <span>Mode de règlement sélectionné</span>
              </span>
              <span className={`px-2.5 py-0.5 rounded-full font-black text-xs border ${
                isMonCash 
                  ? 'bg-rose-100 text-rose-800 border-rose-200' 
                  : isCash 
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                    : isCheque 
                      ? 'bg-amber-100 text-amber-800 border-amber-200' 
                      : 'bg-indigo-100 text-indigo-800 border-indigo-200'
              }`}>
                {paymentMethod} {isMonCash && activeGateway === 'tranzak' ? '(Tranzak Direct)' : ''}
              </span>
            </div>

            {/* SI PAIEMENT MONCASH / TRANZAK / NATCASH */}
            {isMonCash && (
              <div className="bg-white border border-rose-200/90 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">N° Transaction / Référence MonCash :</span>
                  <span className="font-mono text-xs font-black text-rose-800 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                    {referenceNumber || 'Non renseigné'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                  <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                  <span>Règlement certifié par SMS. Reçu officiel avec QR code d'authenticité généré immédiatement dès validation.</span>
                </div>
              </div>
            )}

            {/* SI PAIEMENT CHÈQUE */}
            {isCheque && (
              <div className="bg-white border border-amber-200 rounded-xl p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">N° Chèque :</span>
                  <span className="font-mono font-bold text-slate-900">{referenceNumber || 'Non renseigné'}</span>
                </div>
                {bankName && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Banque émettrice :</span>
                    <span className="font-bold text-slate-800">{bankName}</span>
                  </div>
                )}
                <p className="text-[10.5px] text-amber-700 italic pt-1 border-t border-amber-100">
                  Ce paiement sera enregistré avec le statut « En attente » jusqu'à compensation bancaire.
                </p>
              </div>
            )}

            {/* SI DÉPÔT BANCAIRE */}
            {isDeposit && (
              <div className="bg-white border border-slate-200 rounded-xl p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">N° Bordereau / Réf :</span>
                  <span className="font-mono font-bold text-slate-900">{referenceNumber || 'Non renseigné'}</span>
                </div>
                {bankName && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Banque de dépôt :</span>
                    <span className="font-bold text-slate-800">{bankName}</span>
                  </div>
                )}
                {depositDate && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Date du versement :</span>
                    <span className="font-bold text-slate-800">{depositDate}</span>
                  </div>
                )}
              </div>
            )}

            {/* SI CASH / ESPÈCES */}
            {isCash && (
              <div className="bg-white border border-emerald-200 rounded-xl p-3 text-xs flex items-center justify-between">
                <span className="text-slate-600 font-medium">Encaissement physique en caisse :</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Immédiat & Définitif
                </span>
              </div>
            )}

          </div>

          {/* AVERTISSEMENT DE NON-RÉPUDIATION */}
          <div className="p-2.5 bg-slate-100/90 rounded-xl border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <p className="leading-snug">
              En confirmant, vous certifiez l'exactitude des informations. Un <strong>reçu officiel scellé par QR Code</strong> sera généré et le solde de l'élève sera instantanément actualisé.
            </p>
          </div>

        </div>

        {/* PIED DE MODALE : ACTIONS */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 sm:px-5 sm:py-3.5 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-colors cursor-pointer disabled:opacity-50"
          >
            Modifier / Retour
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`px-5 py-2.5 text-white font-black text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 ${
              isMonCash 
                ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 shadow-rose-600/25' 
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/25'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Enregistrement en cours...</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>Confirmer et Encaisser</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
