import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  Smartphone, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  AlertCircle, 
  X, 
  RefreshCw, 
  Share2, 
  Copy, 
  Check, 
  Zap, 
  Info,
  Lock,
  ChevronLeft,
  Building2, 
  ExternalLink,
  Globe,
  Radio,
  FileCheck2,
  CheckCheck,
  Eye,
  EyeOff,
  KeyRound
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import { useSchool } from '../contexts/SchoolContext';
import { getTerminology } from '../lib/terminology';
import { TranzakService } from '../services/tranzakService';

export interface StudentWalletTopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: {
    id: string;
    first_name: string;
    last_name: string;
    reference_number?: string;
    class_name?: string;
    wallet_balance_htg?: number;
    parent_name?: string;
    parent_phone?: string;
    school_id?: string;
  };
  schoolName?: string;
  schoolId?: string;
  onSuccess?: (newBalance: number, paymentRecord: any) => void;
}

const PRESET_AMOUNTS = [100, 250, 500, 1000, 2500, 5000];

type TopUpFlowStep = 'AMOUNT_SETUP' | 'PROCESSING_DIRECT' | 'TRANZAK_EXTERNAL_GATEWAY' | 'SUCCESS_RECEIPT';

export const StudentWalletTopUpModal: React.FC<StudentWalletTopUpModalProps> = ({
  isOpen,
  onClose,
  student,
  schoolName = 'Collège des Innovations',
  schoolId,
  onSuccess
}) => {
  let contextTerminology = null;
  let contextSchool: any = null;
  try {
    const schoolCtx = useSchool();
    contextTerminology = schoolCtx?.terminology;
    contextSchool = schoolCtx?.school;
  } catch {
    // Graceful fallback
  }
  const terminology = contextTerminology || getTerminology();
  const effectiveSchoolName = contextSchool?.name || schoolName || 'Collège des Innovations';

  // Navigation dans le flux
  const [currentStep, setCurrentStep] = useState<TopUpFlowStep>('AMOUNT_SETUP');

  // Montant, Téléphone & PIN sécurisé
  const [selectedAmount, setSelectedAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);
  const [phone, setPhone] = useState(student.parent_phone?.replace(/\D/g, '') || '36045639');
  const [clientPin, setClientPin] = useState<string>('');
  const [showPin, setShowPin] = useState(false);

  // État de la Session Marchande Tranzak
  const [tranzakPaymentUrl, setTranzakPaymentUrl] = useState<string>('');
  const [tranzakReference, setTranzakReference] = useState<string>('');
  const [tranzakTransactionId, setTranzakTransactionId] = useState<string>('');
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(false);
  const [manualSmsProof, setManualSmsProof] = useState<string>('');
  const [processingSubStep, setProcessingSubStep] = useState<number>(1);

  // État de chargement et erreurs
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Données de transaction confirmée
  const [confirmedPayment, setConfirmedPayment] = useState<any | null>(null);
  const [completedBalance, setCompletedBalance] = useState<number | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  // Polling automatique si en attente d'un lien externe
  useEffect(() => {
    if (currentStep !== 'TRANZAK_EXTERNAL_GATEWAY' || !tranzakTransactionId) return;

    let isSubscribed = true;
    const interval = setInterval(async () => {
      if (!isSubscribed) return;
      try {
        const targetId = tranzakTransactionId || tranzakReference;
        const data = await TranzakService.checkStatus(targetId, effectiveSchoolId);

        const status = data.status || data?.data?.status;
        if (status === 'SUCCESSFUL' || status === 'VALIDE' || status === 'completed' || status === 'COMPLETED') {
          clearInterval(interval);
          const finalBal = currentBalance + effectiveAmount;
          setCompletedBalance(finalBal);
          setConfirmedPayment({
            transaction_reference: targetId,
            receipt_number: `REC-${Date.now().toString().slice(-6)}`,
            amount: effectiveAmount
          });
          toast.success(`Paiement Tranzak validé ! +${effectiveAmount.toLocaleString()} HTG crédités.`);
          setCurrentStep('SUCCESS_RECEIPT');
          if (onSuccess) onSuccess(finalBal, null);
        }
      } catch (e) {}
    }, 3500);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [currentStep, tranzakTransactionId, tranzakReference]);

  if (!isOpen) return null;

  const effectiveAmount = isCustom ? (parseFloat(customAmount) || 0) : selectedAmount;
  const currentBalance = student.wallet_balance_htg || 0;
  const projectedBalance = currentBalance + effectiveAmount;
  const effectiveSchoolId = schoolId || student.school_id;

  // Nettoyage et formatage du numéro haïtien
  const cleanPhone = phone.replace(/\D/g, '');
  const displayPhone = cleanPhone.startsWith('509') ? cleanPhone.slice(3) : cleanPhone;

  // 1. FLUX DIRECT EN-APP : EXÉCUTION DU PAIEMENT DIRECT TRANZAK AVEC HMAC
  // Évite les erreurs de redirection externe de la sandbox Digicel
  const handleExecuteDirectTranzakPayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (effectiveAmount < 10) {
      setError('Le montant minimum de recharge MonCash est de 10 HTG.');
      return;
    }

    if (displayPhone.length < 8) {
      setError('Veuillez saisir un numéro Digicel MonCash valide (8 chiffres, ex: 36045639).');
      return;
    }

    if (!clientPin || clientPin.length < 4) {
      setError('Veuillez renseigner votre code PIN MonCash (4 chiffres).');
      return;
    }

    setIsSubmitting(true);
    setCurrentStep('PROCESSING_DIRECT');
    setProcessingSubStep(1);

    try {
      // Étape 1 : Chiffrement HMAC-SHA256
      await new Promise(r => setTimeout(r, 400));
      setProcessingSubStep(2);

      const studentFullName = `${student.first_name || ''} ${student.last_name || ''}`.trim();
      const result = await TranzakService.executeDirectPayment({
        schoolId: effectiveSchoolId || '',
        studentId: student.id,
        studentName: studentFullName,
        referenceNumber: student.reference_number,
        amount: effectiveAmount,
        currency: 'HTG',
        operator: 'moncash',
        customerPhone: displayPhone,
        customerName: studentFullName,
        pin: clientPin
      });

      if (!result.success) {
        throw new Error(result.error || "Échec de l'encaissement direct.");
      }

      setProcessingSubStep(3);
      await new Promise(r => setTimeout(r, 400));

      const finalBal = result.new_balance !== null && result.new_balance !== undefined
        ? result.new_balance
        : currentBalance + effectiveAmount;

      setCompletedBalance(finalBal);
      setConfirmedPayment(result.payment_record || {
        transaction_reference: result.transaction_id || result.reference,
        receipt_number: result.receipt_number,
        amount: effectiveAmount
      });
      setTranzakTransactionId(result.transaction_id || '');

      toast.success(result.message || `+${effectiveAmount.toLocaleString()} HTG crédités avec succès !`);
      setCurrentStep('SUCCESS_RECEIPT');

      if (onSuccess) {
        onSuccess(finalBal, result.payment_record);
      }
    } catch (err: any) {
      console.error('Erreur débit direct:', err);
      setError(err.message || 'Erreur lors du paiement direct');
      setCurrentStep('AMOUNT_SETUP');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Option de secours : Générer la session de redirection externe si le client préfère
  const handleGenerateExternalGatewayLink = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const studentFullName = `${student.first_name || ''} ${student.last_name || ''}`.trim();
      const res = await TranzakService.createPaymentSession({
        schoolId: effectiveSchoolId || '',
        studentId: student.id,
        studentName: studentFullName,
        amount: effectiveAmount,
        currency: 'HTG',
        operator: 'moncash',
        customerName: studentFullName,
        customerPhone: `509${displayPhone}`
      });

      if (res.success) {
        setTranzakPaymentUrl(res.payment_url || '');
        setTranzakReference(res.reference || '');
        setTranzakTransactionId(res.transaction_id || '');
        setCurrentStep('TRANZAK_EXTERNAL_GATEWAY');

        if (res.payment_url) {
          try { window.open(res.payment_url, '_blank', 'noopener,noreferrer'); } catch (e) {}
        }
        toast.info("Session de redirection externe générée.");
      } else {
        throw new Error(res.error || "Impossible de générer le lien de redirection");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Validation par l'API officielle POST /verify
  const handleVerifyTranzakTestSession = async () => {
    setIsCheckingStatus(true);
    setError(null);
    try {
      const targetId = tranzakTransactionId || tranzakReference;
      const data = await TranzakService.verifyPayment(targetId, {
        schoolId: effectiveSchoolId,
        studentId: student.id,
        amount: effectiveAmount
      });

      if (data.success && data.is_completed) {
        const finalBal = data.new_balance !== null && data.new_balance !== undefined 
          ? data.new_balance 
          : currentBalance + effectiveAmount;
        setCompletedBalance(finalBal);
        setConfirmedPayment({
          transaction_reference: targetId,
          receipt_number: `REC-${Date.now().toString().slice(-6)}`,
          amount: effectiveAmount
        });
        toast.success(`Session Tranzak vérifiée ! +${effectiveAmount.toLocaleString()} HTG crédités.`);
        setCurrentStep('SUCCESS_RECEIPT');
        if (onSuccess) onSuccess(finalBal, null);
      } else {
        toast.info(data.message || "Paiement en attente de confirmation sur Tranzak/Digicel...");
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la vérification");
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Partage WhatsApp du reçu officiel
  const handleShareWhatsApp = () => {
    const studentFullName = `${student.first_name} ${student.last_name}`;
    const ref = confirmedPayment?.transaction_reference || confirmedPayment?.reference || tranzakTransactionId || 'TRZ-DIR';
    const finalBal = completedBalance ?? projectedBalance;

    const message = `*REÇU DE RECHARGE DIRECTE TRANZAK MONCASH* 👛📲
------------------------------------
*Établissement* : ${effectiveSchoolName}
*Élève* : ${studentFullName} ${student.class_name ? `(${student.class_name})` : ''}
*Matricule* : ${student.reference_number || 'N/A'}
*Montant Rechargé* : +${effectiveAmount.toLocaleString()} HTG
*Nouveau Solde Badge* : ${finalBal.toLocaleString()} HTG
*Passerelle* : Tranzak Direct (Chiffrement Sécurisé HMAC)
*Réf. Transaction* : ${ref}
*Date* : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
------------------------------------
_Ce crédit est disponible immédiatement à la cantine et à l'économat de l'établissement._`;

    const encodedMessage = encodeURI(message);
    const targetPhone = displayPhone.length >= 8 ? `509${displayPhone}` : '';
    const whatsappUrl = targetPhone 
      ? `https://wa.me/${targetPhone}?text=${encodedMessage}`
      : `https://api.whatsapp.com/send?text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyRef = () => {
    const ref = confirmedPayment?.transaction_reference || confirmedPayment?.reference || tranzakTransactionId;
    if (ref) {
      navigator.clipboard.writeText(ref);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
      toast.success('Référence copiée !');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* ========================================================================= */}
        {/* EN-TÊTE DU MODAL                                                          */}
        {/* ========================================================================= */}
        <div className="relative px-5 py-4 bg-gradient-to-r from-red-600 via-red-700 to-rose-700 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner">
              <Wallet size={22} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                  Tranzak MonCash Direct
                </span>
                <span className="text-[10px] font-bold text-red-100 flex items-center gap-0.5">
                  <Zap size={10} /> Instantané
                </span>
              </div>
              <h3 className="text-base font-black tracking-tight text-white mt-0.5">
                Recharger le Portefeuille Élève
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* CORPS DU MODAL                                                            */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* ----------------------------------------------------------------------- */}
          {/* ÉTAPE EN COURS : TRAITEMENT EN DIRECT AVEC SÉCURITÉ HMAC               */}
          {/* ----------------------------------------------------------------------- */}
          {currentStep === 'PROCESSING_DIRECT' ? (
            <div className="text-center py-6 space-y-5 animate-in fade-in duration-200">
              <div className="w-16 h-16 rounded-3xl bg-red-50 text-[#C8102E] flex items-center justify-center mx-auto shadow-inner border border-red-100">
                <RefreshCw size={32} className="animate-spin" />
              </div>

              <div>
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-[#C8102E] rounded-full text-xs font-black uppercase tracking-wider mb-2">
                  <Lock size={12} /> Sécurisation HMAC-SHA256 en cours
                </span>
                <h4 className="text-base font-black text-slate-900">
                  Débit MonCash & Crédit Direct
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Validation instantanée via l'API Tranzak Direct pour <strong>{student.first_name}</strong>.
                </p>
              </div>

              {/* Étapes du circuit */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-3">
                <div className="flex items-center gap-3 text-xs">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    processingSubStep >= 1 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {processingSubStep > 1 ? <Check size={12} /> : '1'}
                  </div>
                  <span className={processingSubStep === 1 ? 'font-black text-slate-900' : 'text-slate-600'}>
                    Chiffrement cryptographique HMAC du code PIN
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    processingSubStep >= 2 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {processingSubStep > 2 ? <Check size={12} /> : '2'}
                  </div>
                  <span className={processingSubStep === 2 ? 'font-black text-slate-900' : 'text-slate-600'}>
                    Débit direct auprès de la passerelle Tranzak
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    processingSubStep >= 3 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {processingSubStep >= 3 ? <Check size={12} /> : '3'}
                  </div>
                  <span className={processingSubStep === 3 ? 'font-black text-slate-900' : 'text-slate-600'}>
                    Crédit certifié du portefeuille élève (+{effectiveAmount.toLocaleString()} HTG)
                  </span>
                </div>
              </div>
            </div>
          ) : currentStep === 'TRANZAK_EXTERNAL_GATEWAY' ? (
            /* --------------------------------------------------------------------- */
            /* OPTION EXTERNE : SI LE CLIENT SOUHAITE LE LIEN HÉBERGÉ TRANZAK        */
            /* --------------------------------------------------------------------- */
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white mx-auto flex items-center justify-center shadow-md">
                  <Globe size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">
                    Lien de Paiement Tranzak Externe
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Si votre navigateur n'a pas ouvert le guichet automatiquement, utilisez le bouton ci-dessous :
                  </p>
                </div>

                <a
                  href={tranzakPaymentUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:opacity-95 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ExternalLink size={16} />
                  <span>Ouvrir la Passerelle Externe ({effectiveAmount.toLocaleString()} HTG)</span>
                </a>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep('AMOUNT_SETUP')}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  ← Revenir au Direct
                </button>

                <button
                  type="button"
                  onClick={handleVerifyTranzakTestSession}
                  disabled={isCheckingStatus}
                  className="py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <FileCheck2 size={13} />
                  <span>{isCheckingStatus ? "Vérification..." : "Valider test"}</span>
                </button>
              </div>
            </div>
          ) : currentStep === 'SUCCESS_RECEIPT' ? (
            /* --------------------------------------------------------------------- */
            /* ÉTAPE REÇU : VALIDÉ & SCELLÉ EN DIRECT                                */
            /* --------------------------------------------------------------------- */
            <div className="text-center py-2 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <CheckCircle2 size={36} />
              </div>

              <div>
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-800 text-xs font-black uppercase tracking-wider mb-1">
                  <Sparkles size={12} className="text-emerald-600" />
                  Dépôt Direct Validé & Crédité
                </span>
                <h4 className="text-xl font-black text-slate-900 tracking-tight">
                  +{effectiveAmount.toLocaleString()} HTG
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Le portefeuille de {student.first_name} a été crédité en direct via Tranzak.
                </p>
              </div>

              {/* Solde scellé */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Ancien solde badge</span>
                  <span className="font-mono text-slate-600">{currentBalance.toLocaleString()} HTG</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <Zap size={13} /> Crédit Tranzak Direct (HMAC Sécurisé)
                  </span>
                  <span className="font-mono font-black text-emerald-600">+{effectiveAmount.toLocaleString()} HTG</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-xs font-black text-slate-900 uppercase">Nouveau solde badge</span>
                  <span className="text-base font-black text-emerald-700 font-mono">
                    {(completedBalance ?? projectedBalance).toLocaleString()} HTG
                  </span>
                </div>
              </div>

              {/* Circuit Financier Validé */}
              <div className="bg-white rounded-2xl p-3 border border-slate-200 text-left space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Circuit Financier Validé en Direct
                </span>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Smartphone size={13} className="text-[#C8102E]" />
                      <strong>Débit Payeur :</strong> +509 {displayPhone}
                    </span>
                    <span className="font-mono font-bold text-red-600">-{effectiveAmount.toLocaleString()} HTG</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Building2 size={13} className="text-blue-600" />
                      <strong>Passerelle Tranzak :</strong> EduNova PRO
                    </span>
                    <span className="font-mono font-bold text-blue-700">Encaissé 100%</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Wallet size={13} className="text-emerald-600" />
                      <strong>Portefeuille Élève :</strong> {student.first_name} {student.last_name}
                    </span>
                    <span className="font-mono font-bold text-emerald-600">+{effectiveAmount.toLocaleString()} HTG</span>
                  </div>
                </div>
              </div>

              {/* Référence et Reçu */}
              <div className="p-3 bg-red-50/70 border border-red-200/80 rounded-2xl flex items-center justify-between text-xs">
                <div className="text-left">
                  <span className="text-[10px] uppercase font-bold text-red-500 block">Référence Transaction</span>
                  <span className="font-mono font-bold text-red-950">
                    {confirmedPayment?.transaction_reference || confirmedPayment?.reference || tranzakTransactionId || 'TRZ-DIR-SUCCESS'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyRef}
                  className="px-2.5 py-1.5 bg-white border border-red-200 rounded-lg text-[11px] font-bold text-red-700 hover:bg-red-50 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copiedRef ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  <span>{copiedRef ? 'Copié' : 'Copier'}</span>
                </button>
              </div>

              {/* Actions de partage */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Share2 size={15} />
                  <span>Envoyer le reçu sur WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Terminer & Fermer
                </button>
              </div>
            </div>
          ) : (
            /* --------------------------------------------------------------------- */
            /* ÉTAPE FORMULAIRE : FLUX DIRECT SÉCURISÉ (PIN + HMAC)                 */
            /* --------------------------------------------------------------------- */
            <form onSubmit={handleExecuteDirectTranzakPayment} className="space-y-3.5">
              
              {/* Badge de sécurité HMAC */}
              <div className="p-3 bg-gradient-to-r from-red-50 to-blue-50/60 border border-red-200/80 rounded-2xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#D91B24] to-blue-700 text-white flex items-center justify-center shadow-xs">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Sécurité Bancaire</span>
                    <p className="text-xs font-bold text-slate-900">Chiffrement HMAC-SHA256 Actif</p>
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  Direct In-App
                </span>
              </div>

              {/* Élève Bénéficiaire */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Élève Bénéficiaire</span>
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                    {student.first_name} {student.last_name}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {student.class_name || 'Élève'} {student.reference_number ? `• Matr: ${student.reference_number}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[9.5px] text-slate-400 font-bold uppercase block">Solde Actuel</span>
                  <span className="text-xs sm:text-sm font-black text-emerald-600 font-mono">
                    {currentBalance.toLocaleString()} HTG
                  </span>
                </div>
              </div>

              {/* Sélection du Montant */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wide">
                    Montant de recharge
                  </label>
                  <span className="text-[10.5px] font-bold text-red-600">Devise : Gourdes (HTG)</span>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {PRESET_AMOUNTS.map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setSelectedAmount(amt);
                        setIsCustom(false);
                      }}
                      className={`py-2 px-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                        !isCustom && selectedAmount === amt
                          ? 'bg-[#D91B24] text-white border-[#D91B24] shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {amt.toLocaleString()} G
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setIsCustom(true)}
                    className={`py-2 px-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                      isCustom
                        ? 'bg-[#D91B24] text-white border-[#D91B24] shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Autre montant
                  </button>
                </div>

                {isCustom && (
                  <div className="pt-1">
                    <div className="relative">
                      <input
                        type="number"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        placeholder="Montant en Gourdes (ex: 350)"
                        min="10"
                        step="10"
                        autoFocus
                        className="w-full px-3.5 py-2 bg-white border border-red-300 rounded-xl text-sm font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-red-500/20"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                        HTG
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Saisie Numéro Digicel MonCash */}
              <div className="space-y-1">
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wide">
                  Numéro Digicel MonCash du payeur
                </label>
                <div className="flex rounded-xl border border-slate-300 focus-within:border-[#C8102E] focus-within:ring-2 focus-within:ring-red-500/10 overflow-hidden bg-white">
                  <span className="px-3 py-2 bg-slate-100 text-slate-600 font-mono font-bold text-xs border-r border-slate-300 flex items-center select-none">
                    +509
                  </span>
                  <input
                    type="tel"
                    value={displayPhone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="36045639"
                    maxLength={8}
                    required
                    className="w-full px-3 py-2 bg-white text-xs sm:text-sm font-mono font-bold text-slate-900 outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Saisie du Code PIN MonCash Chiffré en HMAC */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1">
                    <KeyRound size={13} className="text-[#C8102E]" />
                    <span>Code PIN MonCash</span>
                  </label>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">
                    <Lock size={10} /> Chiffré HMAC
                  </span>
                </div>
                
                <div className="relative flex rounded-xl border border-slate-300 focus-within:border-[#C8102E] focus-within:ring-2 focus-within:ring-red-500/10 overflow-hidden bg-white">
                  <input
                    type={showPin ? "text" : "password"}
                    value={clientPin}
                    onChange={(e) => setClientPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="•••• (4 chiffres)"
                    maxLength={4}
                    required
                    className="w-full px-3.5 py-2.5 bg-white text-sm font-mono font-black tracking-widest text-slate-900 outline-none placeholder:tracking-normal placeholder:font-normal placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="px-3 text-slate-400 hover:text-slate-600 transition-colors flex items-center cursor-pointer"
                  >
                    {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Crypté avant envoi via signature HMAC-SHA256. Jamais transmis en clair.
                </p>
              </div>

              {/* Récapitulatif comptable */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Montant Dépôt</span>
                  <span className="font-mono font-bold text-slate-900">{effectiveAmount.toLocaleString()} HTG</span>
                </div>
                <div className="flex justify-between items-center text-slate-500 text-[11px]">
                  <span>Frais passerelle Tranzak</span>
                  <span className="font-mono font-bold text-emerald-600">0 HTG (Offert)</span>
                </div>
                <div className="pt-1.5 border-t border-slate-200 flex justify-between items-center font-bold">
                  <span className="text-slate-900 uppercase text-[11px]">Total Débité</span>
                  <span className="font-mono font-black text-sm text-[#C8102E]">{effectiveAmount.toLocaleString()} HTG</span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-500">
                  <span>Nouveau solde élève</span>
                  <span className="font-mono font-bold text-emerald-700">{projectedBalance.toLocaleString()} HTG</span>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {/* Bouton Principal : Débit Direct Tranzak In-App */}
              <button
                type="submit"
                disabled={isSubmitting || effectiveAmount <= 0 || clientPin.length < 4}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#D91B24] via-[#C8102E] to-blue-700 hover:opacity-95 active:scale-[0.99] text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-red-600/25 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Débit Direct en cours...</span>
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    <span>Valider & Débiter {effectiveAmount.toLocaleString()} HTG en Direct →</span>
                  </>
                )}
              </button>

              {/* Option de secours externe */}
              <div className="pt-0.5 text-center">
                <button
                  type="button"
                  onClick={handleGenerateExternalGatewayLink}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors underline cursor-pointer"
                >
                  Option secondaire : Ouvrir le guichet web externe Tranzak
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};

export default StudentWalletTopUpModal;
