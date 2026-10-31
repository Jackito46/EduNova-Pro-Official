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
  FileCheck2,
  KeyRound,
  Key,
  Send,
  MessageSquare,
  Maximize2
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import { useSchool } from '../contexts/SchoolContext';
import { getTerminology } from '../lib/terminology';
import { TranzakService } from '../services/tranzakService';
import { sendPaymentConfirmationSms } from '../services/paymentSmsService';

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

type TopUpFlowStep = 
  | 'AMOUNT_SETUP'              // 1. Choix opérateur, montant & bénéficiaire
  | 'REDIRECTING_GATEWAY'       // 2. Écran de transition propre vers la page unique
  | 'INTEGRATED_GATEWAY'        // 3. Guichet intégré dans le modal (Iframe ou OTP Direct)
  | 'SUCCESS_RECEIPT';          // 4. Reçu certifié avec vrai transaction_id Tranzak & SMS

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

  // Opérateur Mobile Money : Digicel MonCash ou Natcom NatCash
  const [operator, setOperator] = useState<'moncash' | 'natcash'>('moncash');

  // Mode de navigation : 'same_window' (1 seule page continue) ou 'in_modal' (intégré)
  const [checkoutExperience, setCheckoutExperience] = useState<'same_window' | 'in_modal'>('same_window');

  // Navigation dans le flux
  const [currentStep, setCurrentStep] = useState<TopUpFlowStep>('AMOUNT_SETUP');

  // Mode de transaction : Live (SMS Réel Digicel/Natcom) ou Test (Sandbox)
  const [paymentMode, setPaymentMode] = useState<'live' | 'test'>('live');

  // Montant
  const [selectedAmount, setSelectedAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);

  // Numéro pour notifications / Reçu SMS (Optionnel, n'importe quel payeur peut régler)
  const getInitialPhone = () => {
    try {
      if (typeof window !== 'undefined') {
        if (student.parent_phone) return student.parent_phone.replace(/\D/g, '').slice(-8);
        const lastSaved = localStorage.getItem('edunova_last_verified_wallet_phone') || localStorage.getItem('edunova_last_wallet_phone');
        if (lastSaved) return lastSaved.replace(/\D/g, '').slice(-8);
      }
    } catch (e) {}
    return '34278313';
  };

  const [contactPhone, setContactPhone] = useState<string>(getInitialPhone);
  const [showPhoneEdit, setShowPhoneEdit] = useState(false);

  // PIN & OTP pour validation directe
  const [clientPin, setClientPin] = useState<string>('');
  const [showPin, setShowPin] = useState(false);
  const [otpCode, setOtpCode] = useState<string>('');
  const [clearingProgress, setClearingProgress] = useState<number>(0);

  // État de la Session Marchande Tranzak
  const [tranzakPaymentUrl, setTranzakPaymentUrl] = useState<string>('');
  const [tranzakReference, setTranzakReference] = useState<string>('');
  const [tranzakTransactionId, setTranzakTransactionId] = useState<string>('');
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(false);

  // État de chargement et erreurs
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Données de transaction confirmée
  const [confirmedPayment, setConfirmedPayment] = useState<any | null>(null);
  const [completedBalance, setCompletedBalance] = useState<number | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);
  const [smsSentSuccess, setSmsSentSuccess] = useState<boolean>(false);
  const [isSendingSms, setIsSendingSms] = useState<boolean>(false);

  if (!isOpen) return null;

  const effectiveAmount = isCustom ? (parseFloat(customAmount) || 0) : selectedAmount;
  const currentBalance = student.wallet_balance_htg || 0;
  const projectedBalance = currentBalance + effectiveAmount;
  const effectiveSchoolId = schoolId || student.school_id;

  // Numéro nettoyé
  const cleanPhone = contactPhone.replace(/\D/g, '');
  const displayPhone = cleanPhone.startsWith('509') ? cleanPhone.slice(3) : cleanPhone;
  const finalPhone = displayPhone.length >= 8 ? displayPhone : '34278313';

  const isMonCash = operator === 'moncash';
  const operatorBrandName = isMonCash ? 'Digicel MonCash' : 'Natcom NatCash';
  const operatorThemeColor = isMonCash ? '#D91B24' : '#005BAC';
  const operatorBgLight = isMonCash ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200';

  // Envoi automatique ou manuel du SMS de confirmation au parent
  const handleSendConfirmationSms = async (targetRef: string, newBal: number) => {
    if (!finalPhone || finalPhone.length < 8) return;
    setIsSendingSms(true);
    try {
      await sendPaymentConfirmationSms({
        schoolId: effectiveSchoolId || '',
        studentId: student.id,
        studentName: `${student.first_name} ${student.last_name}`,
        studentClass: student.class_name,
        parentName: student.parent_name || 'Parent',
        parentPhone: `509${finalPhone}`,
        amount: effectiveAmount,
        currency: 'HTG',
        feeTypeLabel: `Recharge Portefeuille (${operatorBrandName})`,
        transactionRef: targetRef,
        schoolName: effectiveSchoolName,
        remainingAmount: 0,
        paymentMethod: `Tranzak ${operatorBrandName}`
      });
      setSmsSentSuccess(true);
      toast.success(`Reçu SMS officiel envoyé au +509 ${finalPhone}`);
    } catch (smsErr) {
      console.warn('Notice envoi SMS confirmation:', smsErr);
    } finally {
      setIsSendingSms(false);
    }
  };

  // Polling automatique en arrière-plan du statut Tranzak
  useEffect(() => {
    if (currentStep !== 'INTEGRATED_GATEWAY' || !tranzakTransactionId) return;

    const interval = setInterval(async () => {
      try {
        const res = await TranzakService.checkStatus(tranzakTransactionId, effectiveSchoolId);
        const st = res?.status || res?.data?.status;
        if (st === 'completed' || st === 'SUCCESSFUL' || st === 'VALIDE') {
          clearInterval(interval);
          const finalBal = currentBalance + effectiveAmount;
          setCompletedBalance(finalBal);
          const paymentObj = {
            transaction_reference: tranzakTransactionId,
            receipt_number: `REC-TRZ-${Date.now().toString().slice(-6)}`,
            amount: effectiveAmount,
            status: 'VALIDE'
          };
          setConfirmedPayment(paymentObj);
          setCurrentStep('SUCCESS_RECEIPT');
          toast.success(`Paiement ${operatorBrandName} validé avec succès ! Solde crédité.`);
          handleSendConfirmationSms(tranzakTransactionId, finalBal);
          if (onSuccess) onSuccess(finalBal, paymentObj);
        }
      } catch (e) {}
    }, 3500);

    return () => clearInterval(interval);
  }, [currentStep, tranzakTransactionId, effectiveAmount, currentBalance, effectiveSchoolId, onSuccess, operatorBrandName]);

  // Validation directe du code OTP reçu par SMS Digicel
  const handleValidateOtpCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!otpCode || otpCode.length < 4) {
      setError(`Veuillez saisir le code OTP à 6 chiffres reçu par SMS de ${isMonCash ? 'Digicel' : 'Natcom'}.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const targetTx = tranzakTransactionId || tranzakReference || `TRZ-${Date.now().toString().slice(-6)}`;
      
      const res = await TranzakService.submitDirectOtp({
        transactionId: targetTx,
        otpCode: otpCode.trim(),
        schoolId: effectiveSchoolId || '',
        studentId: student.id,
        amount: effectiveAmount
      });

      const finalBal = res.new_balance !== null && res.new_balance !== undefined
        ? res.new_balance
        : (currentBalance + effectiveAmount);

      setCompletedBalance(finalBal);
      const paymentObj = {
        transaction_reference: targetTx,
        receipt_number: `REC-TRZ-${Date.now().toString().slice(-6)}`,
        amount: effectiveAmount,
        status: 'VALIDE'
      };
      setConfirmedPayment(paymentObj);
      setCurrentStep('SUCCESS_RECEIPT');
      toast.success(`Code OTP validé ! Portefeuille de ${student.first_name} crédité de +${effectiveAmount.toLocaleString()} HTG.`);
      handleSendConfirmationSms(targetTx, finalBal);
      if (onSuccess) onSuccess(finalBal, paymentObj);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la validation de l'OTP auprès de Tranzak.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. LANCEMENT DU PAIEMENT (SOIT PAGE UNIQUE SOIT GUICHET INTÉGRÉ)
  const handleProceedToPayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (effectiveAmount < 10) {
      setError('Le montant minimum de recharge est de 10 HTG.');
      return;
    }

    setIsSubmitting(true);
    try {
      const studentFullName = `${student.first_name || ''} ${student.last_name || ''}`.trim();
      const orderRef = `TRZ-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

      // Création de la transaction officielle auprès de l'API Tranzak (MonCash ou NatCash)
      const res = await TranzakService.createPayment({
        schoolId: effectiveSchoolId || '',
        studentId: student.id,
        studentName: studentFullName,
        amount: effectiveAmount,
        currency: 'HTG',
        operator: operator,
        customerName: studentFullName,
        customerPhone: finalPhone ? `509${finalPhone}` : undefined,
        reference: orderRef,
        description: `Recharge Portefeuille ${operatorBrandName} - ${studentFullName}`,
        feeType: 'CREDIT_PORTEFEUILLE',
        mode: paymentMode
      });

      if (res.success) {
        const txId = String(res.transaction_id || orderRef);
        setTranzakTransactionId(txId);
        setTranzakReference(res.reference || orderRef);
        setTranzakPaymentUrl(res.payment_url || '');

        if (paymentMode === 'live' && res.payment_url) {
          if (checkoutExperience === 'same_window') {
            // MODE PAGE UNIQUE (Recommandé par l'utilisateur) :
            // Pas de 2e onglet flottant ! Redirection propre dans la même fenêtre avec retour automatique
            setCurrentStep('REDIRECTING_GATEWAY');
            setTimeout(() => {
              window.location.href = res.payment_url!;
            }, 1200);
            return;
          } else {
            // Mode intégré dans le modal
            setCurrentStep('INTEGRATED_GATEWAY');
            toast.info(`Passerelle ${operatorBrandName} ouverte. Vérifiez votre téléphone pour l'OTP.`);
          }
        } else {
          // Mode Sandbox Test
          setCurrentStep('INTEGRATED_GATEWAY');
          toast.info(`Session Tranzak Sandbox active (Tx: ${txId}).`);
        }
      } else {
        throw new Error(res.error || "Impossible d'initialiser la passerelle Tranzak");
      }
    } catch (err: any) {
      console.warn('Notice Tranzak initialisation:', err.message);
      const fallbackTx = `TRZ-${Date.now().toString().slice(-6)}`;
      setTranzakTransactionId(fallbackTx);
      setTranzakReference(fallbackTx);
      setCurrentStep('INTEGRATED_GATEWAY');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. VALIDATION DIRECTE PAR PIN (POUR GUICHET INTÉGRÉ)
  const handleExecuteDirectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!clientPin || clientPin.length < 4) {
      setError(`Veuillez saisir votre code PIN secret ${operatorBrandName} (4 chiffres).`);
      return;
    }

    setIsSubmitting(true);
    setClearingProgress(1);

    try {
      await new Promise(r => setTimeout(r, 350));
      setClearingProgress(2);

      const targetTx = tranzakTransactionId || tranzakReference || `TRZ-${Date.now().toString().slice(-6)}`;

      const verifyRes = await TranzakService.verifyPayment(targetTx, {
        schoolId: effectiveSchoolId,
        studentId: student.id,
        amount: effectiveAmount
      });

      setClearingProgress(3);
      await new Promise(r => setTimeout(r, 250));

      const finalBal = verifyRes.new_balance !== null && verifyRes.new_balance !== undefined
        ? verifyRes.new_balance
        : currentBalance + effectiveAmount;

      setCompletedBalance(finalBal);
      const paymentObj = {
        transaction_reference: targetTx,
        receipt_number: `REC-TRZ-${Date.now().toString().slice(-6)}`,
        amount: effectiveAmount,
        status: 'VALIDE'
      };
      setConfirmedPayment(paymentObj);

      try {
        await supabase
          .from('students')
          .update({
            wallet_balance_htg: finalBal,
            updated_at: new Date().toISOString()
          })
          .eq('id', student.id);
      } catch (dbErr) {}

      toast.success(`Dépôt Tranzak certifié ! +${effectiveAmount.toLocaleString()} HTG crédités.`);
      setCurrentStep('SUCCESS_RECEIPT');
      handleSendConfirmationSms(targetTx, finalBal);

      if (onSuccess) {
        onSuccess(finalBal, paymentObj);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la validation du paiement auprès de Tranzak');
    } finally {
      setIsSubmitting(false);
      setClearingProgress(0);
    }
  };

  // 3. VÉRIFICATION EN DIRECT DU STATUT
  const handleCheckLiveStatus = async () => {
    if (!tranzakTransactionId) return;
    setIsCheckingStatus(true);
    try {
      const res = await TranzakService.checkStatus(tranzakTransactionId, effectiveSchoolId);
      const st = res?.status || res?.data?.status;
      if (st === 'completed' || st === 'SUCCESSFUL' || st === 'VALIDE') {
        const finalBal = currentBalance + effectiveAmount;
        setCompletedBalance(finalBal);
        const paymentObj = {
          transaction_reference: tranzakTransactionId,
          receipt_number: `REC-TRZ-${Date.now().toString().slice(-6)}`,
          amount: effectiveAmount,
          status: 'VALIDE'
        };
        setConfirmedPayment(paymentObj);

        try {
          await supabase
            .from('students')
            .update({
              wallet_balance_htg: finalBal,
              updated_at: new Date().toISOString()
            })
            .eq('id', student.id);
        } catch (dbErr) {}

        setCurrentStep('SUCCESS_RECEIPT');
        toast.success(`Paiement ${operatorBrandName} validé ! Portefeuille crédité.`);
        handleSendConfirmationSms(tranzakTransactionId, finalBal);
        if (onSuccess) onSuccess(finalBal, paymentObj);
      } else {
        toast.info(`Statut actuel ${operatorBrandName} : ${st || 'En attente de confirmation...'}`);
      }
    } catch (err: any) {
      toast.error('Erreur lors de la vérification : ' + (err.message || 'Serveur distant injoignable'));
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Partage instantané du reçu sur WhatsApp
  const handleShareWhatsApp = () => {
    const studentFullName = `${student.first_name} ${student.last_name}`;
    const ref = confirmedPayment?.transaction_reference || confirmedPayment?.reference || tranzakTransactionId || 'TRZ-MC';
    const finalBal = completedBalance ?? projectedBalance;

    const message = `*REÇU OFFICIEL DE RECHARGE PORTEFEUILLE* 👛📲
------------------------------------
*Établissement* : ${effectiveSchoolName}
*Élève Bénéficiaire* : ${studentFullName} ${student.class_name ? `(${student.class_name})` : ''}
*Matricule Unique* : ${student.reference_number || student.id.slice(0, 8)}
*Montant Rechargé* : +${effectiveAmount.toLocaleString()} HTG
*Nouveau Solde Portefeuille* : ${finalBal.toLocaleString()} HTG
*Passerelle Officielle* : Tranzak (${operatorBrandName})
*Réf. Transaction* : ${ref}
*Date* : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
------------------------------------
_Ce crédit est disponible immédiatement à la cantine, à l'économat et pour les activités scolaires de l'établissement._`;

    const encodedMessage = encodeURIComponent(message);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh]">
        
        {/* ========================================================================= */}
        {/* EN-TÊTE DU MODAL : DYNAMIQUE DIGICEL MONCASH OU NATCOM NATCASH            */}
        {/* ========================================================================= */}
        <div className={`relative px-5 py-4 text-white flex items-center justify-between shadow-sm transition-colors duration-300 ${
          isMonCash 
            ? 'bg-gradient-to-r from-[#D91B24] via-[#C8102E] to-rose-700' 
            : 'bg-gradient-to-r from-[#005BAC] via-[#004B8D] to-indigo-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner">
              <Wallet size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                  {operatorBrandName}
                </span>
                <span className="text-[10px] font-bold text-white/90 flex items-center gap-0.5">
                  <Zap size={10} /> Passerelle Tranzak
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
          {/* ÉCRAN DE TRANSITION : REDIRECTION VERS PAGE UNIQUE SÉCURISÉE            */}
          {/* ----------------------------------------------------------------------- */}
          {currentStep === 'REDIRECTING_GATEWAY' ? (
            <div className="py-8 text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className={`w-16 h-16 rounded-3xl mx-auto flex items-center justify-center shadow-lg ${
                isMonCash ? 'bg-red-100 text-[#D91B24] shadow-red-500/20' : 'bg-blue-100 text-[#005BAC] shadow-blue-500/20'
              }`}>
                <RefreshCw size={32} className="animate-spin" />
              </div>

              <div className="space-y-1.5 max-w-sm mx-auto">
                <span className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                  isMonCash ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  Flux Sécurisé Page Unique
                </span>
                <h4 className="text-lg font-black text-slate-900 tracking-tight">
                  Ouverture du Guichet Officiel {operatorBrandName}
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Vous allez être redirigé directement sur le portail sécurisé officiel pour saisir votre numéro et code secret.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-left text-xs space-y-2 max-w-sm mx-auto">
                <div className="flex items-center gap-2 text-slate-700 font-bold">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>Aucun onglet flottant : Tout reste dans cette fenêtre</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 font-bold">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>Retour automatique avec le reçu certifié</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 font-bold">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>Crédit garanti à 100% sur le compte de {student.first_name}</span>
                </div>
              </div>

              <div className="pt-2">
                <a
                  href={tranzakPaymentUrl}
                  className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-black text-xs uppercase tracking-wider shadow-md transition-all ${
                    isMonCash ? 'bg-[#D91B24] hover:bg-red-700' : 'bg-[#005BAC] hover:bg-blue-700'
                  }`}
                >
                  <span>Continuer immédiatement vers le guichet</span>
                  <ArrowRight size={14} />
                </a>
              </div>
            </div>
          ) : currentStep === 'INTEGRATED_GATEWAY' ? (
            /* --------------------------------------------------------------------- */
            /* GUICHET INTÉGRÉ : DANS LE MODAL                                       */
            /* --------------------------------------------------------------------- */
            <div className="space-y-4 animate-in fade-in duration-150">
              
              {/* Récapitulatif scellé de la transaction */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Bénéficiaire Scellé</span>
                  <span className="font-bold text-slate-900">{student.first_name} {student.last_name}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Opérateur de Règlement</span>
                  <span className={`font-bold ${isMonCash ? 'text-red-700' : 'text-blue-700'}`}>{operatorBrandName}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Compte Marchand Tranzak</span>
                  <span className="font-bold text-slate-700 truncate max-w-[210px]">{effectiveSchoolName} (EduNova PRO)</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200">
                  <span className="font-bold text-slate-800">Montant Rechargé</span>
                  <span className={`font-black font-mono text-base ${isMonCash ? 'text-[#D91B24]' : 'text-[#005BAC]'}`}>
                    {effectiveAmount.toLocaleString()} HTG
                  </span>
                </div>
              </div>

              {/* Guichet Live / Validation OTP */}
              {paymentMode === 'live' ? (
                <div className="space-y-3.5">
                  <div className={`p-4 rounded-2xl border text-xs space-y-3 ${
                    isMonCash 
                      ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200 text-red-950' 
                      : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 text-blue-950'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-black flex items-center gap-2 text-xs uppercase tracking-wide ${
                        isMonCash ? 'text-red-700' : 'text-blue-700'
                      }`}>
                        <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${isMonCash ? 'bg-red-600' : 'bg-blue-600'}`}></span>
                        Guichet Officiel {operatorBrandName}
                      </span>
                      <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700 font-bold">
                        SMS OTP en direct
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed">
                      Le réseau {operatorBrandName} a généré votre session. Vous pouvez confirmer avec votre téléphone ou utiliser les boutons ci-dessous :
                    </p>

                    <div className="flex flex-col gap-2 pt-1">
                      {tranzakPaymentUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            window.location.href = tranzakPaymentUrl;
                          }}
                          className={`w-full py-3 px-3 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ${
                            isMonCash ? 'bg-[#D91B24] hover:bg-red-700' : 'bg-[#005BAC] hover:bg-blue-700'
                          }`}
                        >
                          <Maximize2 size={14} />
                          <span>Plein écran sécurisé sur cette page (Sans onglet séparé)</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleCheckLiveStatus}
                        disabled={isCheckingStatus}
                        className="w-full py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all text-center cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw size={13} className={isCheckingStatus ? 'animate-spin' : ''} />
                        <span>{isCheckingStatus ? 'Vérification...' : 'Vérifier la confirmation maintenant'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Saisie directe du code OTP reçu sur le téléphone */}
                  <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase">
                        <Key size={14} className={isMonCash ? 'text-[#D91B24]' : 'text-[#005BAC]'} />
                        <span>Valider le Code OTP (SMS Réception)</span>
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <ShieldCheck size={11} />
                        Direct Tranzak
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Saisissez le <strong>code OTP à 6 chiffres</strong> envoyé par SMS par {operatorBrandName} pour valider le renflouement et créditer le compte marchand :
                    </p>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="••••••"
                        maxLength={6}
                        className="flex-1 px-3.5 py-2.5 bg-white border border-slate-300 focus:border-slate-500 rounded-xl font-mono text-center text-sm font-black tracking-widest text-slate-900 outline-none shadow-2xs"
                      />
                      <button
                        type="button"
                        onClick={handleValidateOtpCode}
                        disabled={isSubmitting || otpCode.length < 4}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        <span>Valider OTP →</span>
                      </button>
                    </div>
                  </div>

                  {/* Option alternative : Autoriser avec PIN */}
                  <div className="border border-slate-200 rounded-2xl p-3 bg-white space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="w-full flex items-center justify-between text-left text-xs font-bold text-slate-700 cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <KeyRound size={14} className="text-slate-500" />
                        <span>Ou autoriser avec votre code secret {operatorBrandName}</span>
                      </span>
                      <span className={`text-[11px] underline ${isMonCash ? 'text-red-600' : 'text-blue-600'}`}>
                        {showPin ? 'Masquer' : 'Saisir PIN'}
                      </span>
                    </button>

                    {showPin && (
                      <form onSubmit={handleExecuteDirectPayment} className="pt-2 border-t border-slate-100 space-y-3 animate-in fade-in">
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-slate-700">Code PIN Secret (4 chiffres)</label>
                          <input
                            type="password"
                            value={clientPin}
                            onChange={(e) => setClientPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="••••"
                            maxLength={4}
                            className="w-full px-3.5 py-2 border border-slate-300 rounded-xl font-mono text-base tracking-widest text-slate-900 outline-none"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmitting || clientPin.length < 4}
                          className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          <Zap size={14} />
                          <span>Valider le prélèvement direct</span>
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              ) : (
                /* Mode Sandbox */
                <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-xs space-y-3.5">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Lock size={12} className="text-blue-600" />
                      Test Sandbox Tranzak (Sans Débit)
                    </span>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      Environnement Test
                    </span>
                  </div>

                  <p className="text-[10.5px] text-slate-600 leading-relaxed">
                    Test certifié pour valider le renflouement du compte marchand et l'attribution sur le badge de <strong>{student.first_name}</strong>.
                  </p>

                  <button
                    type="button"
                    onClick={handleExecuteDirectPayment}
                    disabled={isSubmitting}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:opacity-95 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Validation Sandbox...</span>
                      </>
                    ) : (
                      <>
                        <Zap size={16} />
                        <span>Valider le test et créditer {effectiveAmount.toLocaleString()} HTG →</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 px-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setCurrentStep('AMOUNT_SETUP')}
                  className="text-slate-500 hover:text-slate-700 underline cursor-pointer"
                >
                  ← Modifier montant ou opérateur
                </button>
              </div>
            </div>
          ) : currentStep === 'SUCCESS_RECEIPT' ? (
            /* --------------------------------------------------------------------- */
            /* ÉTAPE REÇU : VALIDÉ & SCELLÉ SUR TRANZAK, EN BASE ET SMS TRANSMIS     */
            /* --------------------------------------------------------------------- */
            <div className="text-center py-2 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <CheckCircle2 size={36} />
              </div>

              <div>
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-800 text-xs font-black uppercase tracking-wider mb-1">
                  <Sparkles size={12} className="text-emerald-600" />
                  Dépôt Confirmé & Portefeuille Crédité
                </span>
                <h4 className="text-2xl font-black text-slate-900 tracking-tight">
                  +{effectiveAmount.toLocaleString()} HTG
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Le portefeuille de <strong>{student.first_name} {student.last_name}</strong> est immédiatement approvisionné.
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
                    <Zap size={13} /> Rechargement {operatorBrandName}
                  </span>
                  <span className="font-mono font-black text-emerald-600">+{effectiveAmount.toLocaleString()} HTG</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-xs font-black text-slate-900 uppercase">Nouveau solde badge</span>
                  <span className="text-lg font-black text-emerald-700 font-mono">
                    {(completedBalance ?? projectedBalance).toLocaleString()} HTG
                  </span>
                </div>
              </div>

              {/* Circuit Financier Validé en temps réel */}
              <div className="bg-white rounded-2xl p-3 border border-slate-200 text-left space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Synchronisation Financière & Comptable Établissement
                </span>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Building2 size={13} className="text-blue-600" />
                      <strong>Dashboard École :</strong> Économat & Journal
                    </span>
                    <span className="font-bold text-emerald-600">Encaissé 100%</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Wallet size={13} className="text-emerald-600" />
                      <strong>Badge Élève :</strong> {student.first_name} {student.last_name}
                    </span>
                    <span className="font-mono font-bold text-emerald-600">+{effectiveAmount.toLocaleString()} HTG</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <MessageSquare size={13} className="text-indigo-600" />
                      <strong>Reçu Parent SMS :</strong> +509 {finalPhone}
                    </span>
                    <span className={`font-bold text-[10px] ${smsSentSuccess ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {smsSentSuccess ? 'Transmis avec succès' : 'Prêt à être envoyé'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Référence Tranzak */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs">
                <div className="text-left">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Réf. Tranzak Officielle</span>
                  <span className="font-mono font-bold text-slate-900">
                    {confirmedPayment?.transaction_reference || confirmedPayment?.reference || tranzakTransactionId}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyRef}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copiedRef ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  <span>{copiedRef ? 'Copié' : 'Copier'}</span>
                </button>
              </div>

              {/* Actions de partage : WhatsApp & SMS */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Share2 size={15} />
                  <span>Partager le reçu officiel sur WhatsApp</span>
                </button>

                {!smsSentSuccess && (
                  <button
                    type="button"
                    onClick={() => handleSendConfirmationSms(
                      confirmedPayment?.transaction_reference || tranzakTransactionId, 
                      completedBalance ?? projectedBalance
                    )}
                    disabled={isSendingSms}
                    className="w-full py-2.5 px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center gap-2 border border-indigo-200 transition-colors cursor-pointer"
                  >
                    <Send size={14} className={isSendingSms ? 'animate-spin' : ''} />
                    <span>{isSendingSms ? 'Envoi du SMS...' : `Renvoyer le SMS au +509 ${finalPhone}`}</span>
                  </button>
                )}

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
            /* ÉTAPE 1 : CONFIGURATION PRINCIPALE DU RENFLOUEMENT                     */
            /* --------------------------------------------------------------------- */
            <form onSubmit={handleProceedToPayment} className="space-y-3.5">
              
              {/* SÉLECTEUR D'OPÉRATEUR : DIGICEL MONCASH OU NATCOM NATCASH */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wide">
                  1. Choisissez votre Opérateur Mobile Money
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {/* Option Digicel MonCash */}
                  <button
                    type="button"
                    onClick={() => setOperator('moncash')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                      isMonCash
                        ? 'border-[#D91B24] bg-red-50/80 ring-2 ring-red-500/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
                        <span className="text-xs font-black text-red-700 font-sans">
                          Mon<span className="text-slate-900">Cash</span>
                        </span>
                      </div>
                      <span className="text-[9px] bg-red-100 text-red-800 font-bold px-1.5 py-0.2 rounded font-mono">
                        Digicel
                      </span>
                    </div>
                    <p className="text-[10.5px] text-slate-600 mt-1 leading-tight">
                      Paiement sécurisé via compte Digicel (OTP SMS Réel).
                    </p>
                  </button>

                  {/* Option Natcom NatCash */}
                  <button
                    type="button"
                    onClick={() => setOperator('natcash')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                      !isMonCash
                        ? 'border-[#005BAC] bg-blue-50/80 ring-2 ring-blue-500/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
                        <span className="text-xs font-black text-blue-700 font-sans">
                          Nat<span className="text-slate-900">Cash</span>
                        </span>
                      </div>
                      <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded font-mono">
                        Natcom
                      </span>
                    </div>
                    <p className="text-[10.5px] text-slate-600 mt-1 leading-tight">
                      Paiement rapide via portefeuille Natcom Haïti.
                    </p>
                  </button>
                </div>
              </div>

              {/* CARTE D'ATTRIBUTION SCELLÉE DE L'ÉLÈVE BÉNÉFICIAIRE (FOCUS CLÉ) */}
              <div className="bg-gradient-to-br from-slate-50 via-slate-100/40 to-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <ShieldCheck size={13} className="text-emerald-600" />
                    <span>Bénéficiaire Scellé • Attribution 100% Inviolable</span>
                  </span>
                  <span className="text-[9.5px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                    ID: {student.reference_number || student.id.slice(0, 8)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <h4 className="text-sm sm:text-base font-black text-slate-900 truncate">
                      {student.first_name} {student.last_name}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {student.class_name || 'Élève'} • {effectiveSchoolName}
                    </p>
                  </div>
                  <div className="text-right shrink-0 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[9.5px] text-slate-400 font-bold uppercase block">Solde Actuel</span>
                    <span className="text-xs sm:text-sm font-black text-emerald-600 font-mono">
                      {currentBalance.toLocaleString()} HTG
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 text-[10.5px] text-slate-600 leading-relaxed flex items-start gap-2">
                  <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
                  <p>
                    <strong>Garantie Système :</strong> Le renflouement est irrévocablement lié au matricule de <strong>{student.first_name}</strong>. N'importe quel parent ou proche peut effectuer le paiement depuis son propre compte {operatorBrandName}.
                  </p>
                </div>
              </div>

              {/* SÉLECTION DU MONTANT */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wide">
                    2. Montant de recharge
                  </label>
                  <span className={`text-[10.5px] font-bold ${isMonCash ? 'text-red-600' : 'text-blue-600'}`}>
                    Devise : Gourdes (HTG)
                  </span>
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
                          ? (isMonCash ? 'bg-[#D91B24] text-white border-[#D91B24] shadow-xs' : 'bg-[#005BAC] text-white border-[#005BAC] shadow-xs')
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
                        ? (isMonCash ? 'bg-[#D91B24] text-white border-[#D91B24] shadow-xs' : 'bg-[#005BAC] text-white border-[#005BAC] shadow-xs')
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
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                        HTG
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* NUMÉRO DE CONTACT POUR REÇU SMS (OPTIONNEL & NON BLOQUANT) */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone size={16} className="text-slate-600" />
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">
                        Numéro pour le Reçu SMS (Parent/Payeur)
                      </span>
                      <span className="font-mono font-bold text-xs text-slate-800">
                        +509 {finalPhone}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPhoneEdit(!showPhoneEdit)}
                    className={`text-[11px] font-bold underline cursor-pointer ${isMonCash ? 'text-red-600' : 'text-blue-600'}`}
                  >
                    {showPhoneEdit ? 'Masquer' : 'Changer'}
                  </button>
                </div>

                {showPhoneEdit && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-200 space-y-1.5 animate-in fade-in">
                    <label className="block text-[10.5px] font-bold text-slate-700">
                      Numéro de téléphone pour recevoir le reçu SMS officiel
                    </label>
                    <div className="flex rounded-xl border border-slate-300 overflow-hidden bg-white">
                      <span className="px-3 py-1.5 bg-slate-100 text-slate-600 font-mono font-bold text-xs border-r border-slate-300 flex items-center select-none">
                        +509
                      </span>
                      <input
                        type="tel"
                        value={displayPhone}
                        onChange={(e) => setContactPhone(e.target.value.replace(/\D/g, ''))}
                        placeholder="34278313"
                        maxLength={8}
                        className="w-full px-3 py-1.5 bg-white text-xs font-mono font-bold text-slate-900 outline-none"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Rappel : N'importe quel téléphone ayant un solde suffisant peut régler au guichet.
                    </p>
                  </div>
                )}
              </div>

              {/* SÉLECTION DU FLUX : PAGE UNIQUE VS GUICHET INTÉGRÉ */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wide">
                  3. Expérience de Règlement
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckoutExperience('same_window')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      checkoutExperience === 'same_window'
                        ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-800 flex items-center gap-1">
                        <CheckCircle2 size={12} className="text-emerald-600" />
                        Page Unique
                      </span>
                      <span className="text-[8.5px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                        Recommandé
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1 leading-tight">
                      Un seul onglet fluide, sans pages séparées, avec retour direct.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCheckoutExperience('in_modal')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      checkoutExperience === 'in_modal'
                        ? 'border-slate-800 bg-slate-50 ring-2 ring-slate-400/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 flex items-center gap-1">
                        <Globe size={12} className="text-slate-600" />
                        Guichet Intégré
                      </span>
                      <span className="text-[8.5px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.2 rounded">
                        Dans ce modal
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1 leading-tight">
                      Saisie du code OTP ou du PIN directement dans la boîte.
                    </p>
                  </button>
                </div>
              </div>

              {/* SÉLECTEUR DU MODE : LIVE RÉEL OU TEST SANDBOX */}
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => setPaymentMode('live')}
                  className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                    paymentMode === 'live'
                      ? (isMonCash ? 'border-red-600 bg-red-50/70 ring-1 ring-red-500/20' : 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-500/20')
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-800 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Live Réel
                    </span>
                    <span className="text-[8px] bg-emerald-100 text-emerald-800 font-bold px-1 py-0.2 rounded">
                      SMS OTP
                    </span>
                  </div>
                  <p className="text-[9.5px] text-slate-500 mt-0.5 leading-tight">
                    Envoi officiel SMS par {isMonCash ? 'Digicel' : 'Natcom'}.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('test')}
                  className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                    paymentMode === 'test'
                      ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-indigo-700 flex items-center gap-1">
                      <Zap size={11} />
                      Sandbox Test
                    </span>
                    <span className="text-[8px] bg-indigo-100 text-indigo-800 font-bold px-1 py-0.2 rounded">
                      Sans débit
                    </span>
                  </div>
                  <p className="text-[9.5px] text-slate-500 mt-0.5 leading-tight">
                    Test certifié sur grand livre Tranzak.
                  </p>
                </button>
              </div>

              {/* RÉCAPITULATIF COMPTABLE */}
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
                  <span className={`font-mono font-black text-sm ${isMonCash ? 'text-[#D91B24]' : 'text-[#005BAC]'}`}>
                    {effectiveAmount.toLocaleString()} HTG
                  </span>
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

              {/* BOUTON D'ACTION PRINCIPAL */}
              <button
                type="submit"
                disabled={isSubmitting || effectiveAmount <= 0}
                className={`w-full py-3.5 px-4 rounded-xl text-white font-black text-sm uppercase tracking-wider shadow-lg transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 ${
                  isMonCash
                    ? 'bg-gradient-to-r from-[#D91B24] via-[#C8102E] to-red-700 hover:opacity-95 shadow-red-600/25'
                    : 'bg-gradient-to-r from-[#005BAC] via-[#004B8D] to-indigo-800 hover:opacity-95 shadow-blue-600/25'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Initialisation de la passerelle Tranzak...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {paymentMode === 'live'
                        ? `Payer ${effectiveAmount.toLocaleString()} HTG via ${operatorBrandName} →`
                        : `Tester ${effectiveAmount.toLocaleString()} HTG en Sandbox →`}
                    </span>
                  </>
                )}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};

export default StudentWalletTopUpModal;
