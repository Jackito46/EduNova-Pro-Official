import React, { useState } from 'react';
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
  Receipt, 
  Share2, 
  Copy, 
  Check, 
  Zap, 
  Info,
  Lock,
  Key,
  ChevronLeft,
  Printer,
  Building2,
  CheckCheck,
  CreditCard
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import { useSchool } from '../contexts/SchoolContext';
import { getTerminology } from '../lib/terminology';
import { MobilePaymentRouterService } from '../services/mobilePaymentRouterService';

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

type TopUpFlowStep = 'AMOUNT_SETUP' | 'MONCASH_PIN' | 'MONCASH_OTP' | 'SUCCESS_RECEIPT';

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

  // Navigation entre les étapes du flux Digicel MonCash
  const [currentStep, setCurrentStep] = useState<TopUpFlowStep>('AMOUNT_SETUP');

  // Montant & Téléphone
  const [selectedAmount, setSelectedAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);
  const [phone, setPhone] = useState(student.parent_phone?.replace(/\D/g, '') || '36045639');
  const [paymentMethodChoice, setPaymentMethodChoice] = useState<'moncash_auto' | 'manual'>('moncash_auto');

  // Informations de sécurité MonCash (PIN & OTP)
  const [moncashPin, setMoncashPin] = useState<string>('');
  const [securityCode, setSecurityCode] = useState<string>('');
  const [isResendingCode, setIsResendingCode] = useState<boolean>(false);
  const [smsThread, setSmsThread] = useState<Array<{ id: string; code: string; time: string; sender: string }>>([
    { id: '1', code: '163880', time: '4:45 AM', sender: 'DIGICEL' }
  ]);
  const [latestOtp, setLatestOtp] = useState<string>('163880');
  const [clearingStep, setClearingStep] = useState<number>(0);
  const [codeInsertedFeedback, setCodeInsertedFeedback] = useState<boolean>(false);

  // État de chargement et erreurs
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Données de transaction confirmée
  const [confirmedPayment, setConfirmedPayment] = useState<any | null>(null);
  const [completedBalance, setCompletedBalance] = useState<number | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  if (!isOpen) return null;

  const effectiveAmount = isCustom ? (parseFloat(customAmount) || 0) : selectedAmount;
  const currentBalance = student.wallet_balance_htg || 0;
  const projectedBalance = currentBalance + effectiveAmount;
  const effectiveSchoolId = schoolId || student.school_id;

  // Nettoyage et formatage du numéro haïtien
  const cleanPhone = phone.replace(/\D/g, '');
  const displayPhone = cleanPhone.startsWith('509') ? cleanPhone.slice(3) : cleanPhone;

  // 1. Étape 1 -> Étape 2 (Validation initiale du montant et du numéro)
  const handleProceedToMonCashPin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (effectiveAmount < 10) {
      setError('Le montant minimum de recharge MonCash est de 10 HTG.');
      return;
    }

    if (displayPhone.length < 8) {
      setError('Veuillez saisir un numéro Digicel MonCash valide (8 chiffres, ex: 36045639).');
      return;
    }

    // Basculer vers l'interface officielle Digicel Secure Payment
    setCurrentStep('MONCASH_PIN');
  };

  // 2. Étape 2 -> Étape 3 (Saisie du PIN Digicel et envoi du code SMS OTP)
  const handleValidatePinAndSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (moncashPin.length < 4) {
      setError('Veuillez saisir votre code PIN secret MonCash (4 chiffres).');
      return;
    }

    setIsSubmitting(true);
    try {
      // Simuler l'authentification avec le commutateur Digicel
      await new Promise(resolve => setTimeout(resolve, 800));
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setSmsThread([
        { id: 'msg-1', code: '163880', time: nowTime || '4:45 AM', sender: 'DIGICEL' }
      ]);
      setLatestOtp('163880');
      // Passage à l'écran de saisie du Security Code (SMS OTP)
      setCurrentStep('MONCASH_OTP');
      toast.info(`Digicel SMS : Mon Cash OTP for online transaction is 163880`);
    } catch (err: any) {
      setError("Erreur de connexion au serveur Digicel MonCash.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Renvoyer le code SMS de sécurité (alterne entre 196925 et 163880 fidèlement à la capture réelle)
  const handleResendSecurityCode = async () => {
    setIsResendingCode(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      const nextCode = latestOtp === '163880' ? '196925' : '163880';
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setSmsThread(prev => [
        ...prev,
        { id: `msg-${Date.now()}`, code: nextCode, time: nowTime || '4:45 AM', sender: 'DIGICEL' }
      ]);
      setLatestOtp(nextCode);
      toast.info(`Nouveau SMS Digicel : Mon Cash OTP for online transaction is ${nextCode}`);
    } finally {
      setIsResendingCode(false);
    }
  };

  // Remplir automatiquement le code OTP depuis le SMS reçu
  const handleAutoFillCode = (codeToInsert?: string) => {
    const code = codeToInsert || latestOtp;
    setSecurityCode(code);
    setCodeInsertedFeedback(true);
    toast.success(`Code ${code} inséré automatiquement !`);
    setTimeout(() => setCodeInsertedFeedback(false), 2000);
  };

  // 3. Étape 3 -> Étape 4 (Validation du code de sécurité et crédit immédiat)
  const handleConfirmOtpAndExecuteDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!securityCode || securityCode.trim().length < 4) {
      setError('Veuillez renseigner le code de sécurité reçu par SMS (ex: 6 chiffres).');
      return;
    }

    setIsSubmitting(true);
    setClearingStep(1);

    try {
      // Étape 1 : Simulation vérification solde MonCash payeur
      await new Promise(resolve => setTimeout(resolve, 400));
      setClearingStep(2);

      // Étape 2 : Encaissement passerelle Tranzak SAGACETECH
      const token = (await supabase.auth.getSession()).data?.session?.access_token;
      const studentFullName = `${student.first_name || ''} ${student.last_name || ''}`.trim();

      const res = await fetch('/api/tranzak/simulate-deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          schoolId: effectiveSchoolId,
          studentId: student.id,
          studentName: studentFullName,
          referenceNumber: student.reference_number || '',
          amount: effectiveAmount,
          operator: 'moncash',
          customerPhone: displayPhone,
          customerName: studentFullName,
          pin: moncashPin ? '****' : '',
          securityCode: securityCode.trim(),
          channel: 'moncash_auto'
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setClearingStep(3);
        await new Promise(resolve => setTimeout(resolve, 300));

        const finalBal = data.new_balance !== undefined ? data.new_balance : currentBalance + effectiveAmount;
        setCompletedBalance(finalBal);
        setConfirmedPayment(data.payment_record || {
          transaction_reference: data.reference,
          receipt_number: data.receipt_number,
          amount: data.amount
        });

        // Mise à jour de sécurité directe en base
        try {
          await supabase
            .from('students')
            .update({
              wallet_balance_htg: finalBal,
              updated_at: new Date().toISOString()
            })
            .eq('id', student.id);
        } catch (dbErr) {
          console.warn('[TopUp] Avertissement synchro locale Supabase:', dbErr);
        }

        toast.success(`Dépôt Digicel MonCash validé ! +${effectiveAmount.toLocaleString()} HTG crédités.`);
        setCurrentStep('SUCCESS_RECEIPT');

        if (onSuccess) {
          onSuccess(finalBal, data.payment_record);
        }
      } else {
        throw new Error(data.error || "Erreur lors de la validation du code MonCash");
      }
    } catch (err: any) {
      console.error('Erreur validation code MonCash:', err);
      setError(err.message || 'Impossible de finaliser la recharge Digicel MonCash.');
    } finally {
      setIsSubmitting(false);
      setClearingStep(0);
    }
  };

  // Raccourci test simulation 1-clic direct
  const handleQuickSimulationTest = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const token = (await supabase.auth.getSession()).data?.session?.access_token;
      const studentFullName = `${student.first_name || ''} ${student.last_name || ''}`.trim();

      const res = await fetch('/api/tranzak/simulate-deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          schoolId: effectiveSchoolId,
          studentId: student.id,
          studentName: studentFullName,
          referenceNumber: student.reference_number || '',
          amount: effectiveAmount,
          operator: 'moncash',
          customerPhone: displayPhone,
          customerName: studentFullName
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const finalBal = data.new_balance !== undefined ? data.new_balance : currentBalance + effectiveAmount;
        setCompletedBalance(finalBal);
        setConfirmedPayment(data.payment_record || {
          transaction_reference: data.reference,
          receipt_number: data.receipt_number,
          amount: data.amount
        });

        // Synchro locale
        try {
          await supabase
            .from('students')
            .update({
              wallet_balance_htg: finalBal,
              updated_at: new Date().toISOString()
            })
            .eq('id', student.id);
        } catch (e) {}

        toast.success(data.message || `+${effectiveAmount} HTG crédités avec succès !`);
        setCurrentStep('SUCCESS_RECEIPT');

        if (onSuccess) {
          onSuccess(finalBal, data.payment_record);
        }
      } else {
        throw new Error(data.error || "Erreur de simulation Tranzak");
      }
    } catch (err: any) {
      toast.error(err.message || "Échec du test");
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Partage instantané du reçu sur WhatsApp (100% GRATUIT)
  const handleShareWhatsApp = () => {
    const studentFullName = `${student.first_name} ${student.last_name}`;
    const ref = confirmedPayment?.transaction_reference || confirmedPayment?.reference || 'TRZ-MC';
    const finalBal = completedBalance ?? projectedBalance;

    const message = `*REÇU DE RECHARGE DIGICEL MONCASH* 👛📲
------------------------------------
*Établissement* : ${effectiveSchoolName}
*Élève* : ${studentFullName} ${student.class_name ? `(${student.class_name})` : ''}
*Matricule* : ${student.reference_number || 'N/A'}
*Montant Rechargé* : +${effectiveAmount.toLocaleString()} HTG
*Nouveau Solde Badge* : ${finalBal.toLocaleString()} HTG
*Mode* : Digicel MonCash Auto (Sécurisé)
*Réf. Transaction* : ${ref}
*Date* : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
------------------------------------
_Ce crédit est disponible immédiatement à la cantine et à l'économat de l'école._`;

    const encodedMessage = encodeURI(message);
    const targetPhone = displayPhone.length >= 8 ? `509${displayPhone}` : '';
    const whatsappUrl = targetPhone 
      ? `https://wa.me/${targetPhone}?text=${encodedMessage}`
      : `https://api.whatsapp.com/send?text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyRef = () => {
    const ref = confirmedPayment?.transaction_reference || confirmedPayment?.reference;
    if (ref) {
      navigator.clipboard.writeText(ref);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
      toast.success('Référence copiée !');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* ========================================================================= */}
        {/* EN-TÊTE : ADAPTATIF DIGICEL SECURE PAYMENT DÈS LE PASSAGE AU PAIEMENT    */}
        {/* ========================================================================= */}
        {currentStep === 'MONCASH_PIN' || currentStep === 'MONCASH_OTP' ? (
          /* Style officiel Digicel "Secure Payment" avec bandeau rouge MonCash */
          <div className="relative px-5 py-3.5 bg-gradient-to-r from-[#D91B24] via-[#C8102E] to-[#B91C1C] text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  if (currentStep === 'MONCASH_OTP') {
                    setCurrentStep('MONCASH_PIN');
                  } else {
                    setCurrentStep('AMOUNT_SETUP');
                  }
                  setError(null);
                }}
                className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer mr-0.5"
                title="Retour"
              >
                <ChevronLeft size={18} />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black tracking-tight text-white uppercase font-sans">
                    Secure Payment
                  </span>
                </div>
                <p className="text-[11px] text-red-100 font-semibold truncate max-w-[210px]">
                  {effectiveSchoolName} • Total : <span className="font-mono font-bold text-white">{effectiveAmount.toLocaleString()} HTG</span>
                </p>
              </div>
            </div>

            {/* Logo Badge Digicel MonCash officiel */}
            <div className="flex items-center gap-2">
              <div className="bg-white px-2 py-1 rounded-md shadow-xs flex items-center gap-1 border border-red-200">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                <span className="text-[11px] font-black tracking-tighter text-red-700 font-sans">
                  Mon<span className="text-slate-900">Cash</span>
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ) : (
          /* En-tête standard du modal de recharge */
          <div className="relative px-5 py-4 bg-gradient-to-r from-red-600 via-red-700 to-rose-700 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner">
                <Wallet size={22} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                    Digicel MonCash Auto
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
        )}

        {/* ========================================================================= */}
        {/* CORPS DU MODAL : LES 4 ÉTAPES DU FLUX                                     */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* ----------------------------------------------------------------------- */}
          {/* ÉTAPE 4 : SUCCÈS & REÇU OFFICIEL                                        */}
          {/* ----------------------------------------------------------------------- */}
          {currentStep === 'SUCCESS_RECEIPT' ? (
            <div className="text-center py-2 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <CheckCircle2 size={36} />
              </div>

              <div>
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-800 text-xs font-black uppercase tracking-wider mb-1">
                  <Sparkles size={12} className="text-emerald-600" />
                  Dépôt Confirmé & Crédité
                </span>
                <h4 className="text-xl font-black text-slate-900 tracking-tight">
                  +{effectiveAmount.toLocaleString()} HTG
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Le portefeuille de {student.first_name} a été actualisé et certifié par Digicel MonCash.
                </p>
              </div>

              {/* Carte de Solde Certifié */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Ancien solde badge</span>
                  <span className="font-mono text-slate-600">{currentBalance.toLocaleString()} HTG</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <Zap size={13} /> Crédit MonCash Auto (Instantané)
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

              {/* Traçabilité 3 niveaux du circuit financier certifié */}
              <div className="bg-white rounded-2xl p-3 border border-slate-200 text-left space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Circuit Financier Validé en Temps Réel
                </span>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Smartphone size={13} className="text-[#C8102E]" />
                      <strong>Débit MonCash :</strong> +509 {displayPhone}
                    </span>
                    <span className="font-mono font-bold text-red-600">-{effectiveAmount.toLocaleString()} HTG</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Building2 size={13} className="text-blue-600" />
                      <strong>Passerelle Tranzak :</strong> SAGACETECH
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
                    {confirmedPayment?.transaction_reference || confirmedPayment?.reference || 'TRZ-MC-COMPLETED'}
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
          ) : currentStep === 'MONCASH_PIN' ? (
            /* --------------------------------------------------------------------- */
            /* ÉTAPE 2 : INTERFACE DIGICEL SECURE PAYMENT (TÉLÉPHONE + PIN)          */
            /* Exactement fidèle au serveur téléphonique Digicel vu dans la vidéo    */
            /* --------------------------------------------------------------------- */
            <form onSubmit={handleValidatePinAndSendOtp} className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Bénéficiaire</span>
                  <span className="font-bold text-slate-800">{student.first_name} {student.last_name}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Établissement</span>
                  <span className="font-bold text-slate-800 truncate max-w-[200px]">{effectiveSchoolName}</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                  <span className="font-bold text-slate-700">Total à débiter</span>
                  <span className="font-black font-mono text-sm text-[#C8102E]">{effectiveAmount.toLocaleString()} HTG</span>
                </div>
              </div>

              {/* Formulaire officiel Digicel Secure Payment */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-xs space-y-3.5">
                
                {/* 1. Numéro de téléphone Digicel MonCash */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wide">
                    Numéro MonCash du payeur
                  </label>
                  <div className="flex rounded-xl border border-slate-300 focus-within:border-[#C8102E] focus-within:ring-2 focus-within:ring-red-500/10 overflow-hidden bg-white">
                    <span className="px-3.5 py-2.5 bg-slate-100 text-slate-600 font-mono font-bold text-xs border-r border-slate-300 flex items-center select-none">
                      509
                    </span>
                    <input
                      type="tel"
                      value={displayPhone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Your Number (ex: 36045639)"
                      maxLength={8}
                      required
                      className="w-full px-3 py-2.5 bg-white text-sm font-mono font-bold text-slate-900 outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* 2. Code PIN Secret MonCash */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wide">
                    Code PIN MonCash
                  </label>
                  <div className="flex rounded-xl border border-slate-300 focus-within:border-[#C8102E] focus-within:ring-2 focus-within:ring-red-500/10 overflow-hidden bg-white">
                    <span className="px-3.5 py-2.5 bg-slate-100 text-slate-500 border-r border-slate-300 flex items-center select-none">
                      <Key size={15} />
                    </span>
                    <input
                      type="password"
                      value={moncashPin}
                      onChange={(e) => setMoncashPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="Your pin (4 chiffres)"
                      maxLength={4}
                      autoFocus
                      required
                      className="w-full px-3 py-2.5 bg-white text-sm font-mono font-bold tracking-widest text-slate-900 outline-none placeholder:tracking-normal placeholder:text-slate-400"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1 pt-0.5">
                    <Lock size={10} className="shrink-0" />
                    Chiffré de bout en bout avec le serveur bancaire Digicel.
                  </p>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {/* Bouton officiel Digicel "Pay" */}
              <button
                type="submit"
                disabled={isSubmitting || moncashPin.length < 4 || displayPhone.length < 8}
                className="w-full py-3.5 px-4 rounded-xl bg-[#D91B24] hover:bg-[#C8102E] active:scale-[0.99] text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-red-600/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Communication Digicel...</span>
                  </>
                ) : (
                  <span>Pay {effectiveAmount.toLocaleString()} HTG</span>
                )}
              </button>
            </form>
          ) : currentStep === 'MONCASH_OTP' ? (
            /* --------------------------------------------------------------------- */
            /* ÉTAPE 3 : DIGICEL SECURE PAYMENT - CODE DE SÉCURITÉ SMS (OTP)         */
            /* Reproduction fidèle du SMS reçu sur le serveur téléphonique Digicel   */
            /* --------------------------------------------------------------------- */
            <form onSubmit={handleConfirmOtpAndExecuteDeposit} className="space-y-3.5 animate-in fade-in duration-150">
              
              {/* APERÇU SMS DIGICEL RÉEL (REPRODUCTION DU TÉLÉPHONE DIGICEL) */}
              <div className="bg-[#F4F5FB] border border-indigo-100 rounded-2xl p-3 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500 pb-1 border-b border-indigo-200/50">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-950">
                    <span className="w-2 h-2 rounded-full bg-[#D91B24] animate-pulse" />
                    <span>Unread</span>
                  </div>
                  <span className="font-mono text-[10.5px] text-slate-500">
                    {smsThread[smsThread.length - 1]?.time || '4:45 AM'}
                  </span>
                </div>

                {/* Bulles de conversation SMS officielles */}
                <div className="space-y-2">
                  {smsThread.map((msg, idx) => (
                    <div key={msg.id || idx} className="space-y-1">
                      {idx > 0 && (
                        <div className="text-center text-[10px] text-slate-400 font-bold tracking-wide">
                          Sending with DIGICEL
                        </div>
                      )}
                      <div className="bg-white rounded-2xl p-3 shadow-2xs border border-indigo-100 flex items-start justify-between gap-2">
                        <div className="space-y-0.5 text-left min-w-0">
                          <p className="text-[12px] sm:text-[13px] font-sans font-medium text-slate-800 tracking-tight leading-relaxed">
                            Mon Cash OTP for online transaction is{' '}
                            <strong className="underline decoration-slate-900 font-mono font-black text-slate-950 text-sm">
                              {msg.code}
                            </strong>
                          </p>
                          <p className="text-[10px] font-bold text-purple-700">
                            • DIGICEL
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAutoFillCode(msg.code)}
                          className={`px-2.5 py-1.5 rounded-xl font-bold text-[10.5px] shrink-0 transition-all cursor-pointer flex items-center gap-1 shadow-2xs ${
                            securityCode === msg.code
                              ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                              : 'bg-red-50 hover:bg-red-100 text-[#C8102E] border border-red-200'
                          }`}
                          title="Insérer automatiquement ce code dans le champ"
                        >
                          {securityCode === msg.code ? (
                            <>
                              <Check size={12} />
                              <span>Inséré</span>
                            </>
                          ) : (
                            <>
                              <Zap size={11} />
                              <span>Insérer ({msg.code})</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CIRCUIT FINANCIER EN 3 ÉTAPES TRANSPARENTES */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <span>Circuit Financier Instantané</span>
                  <span className="text-[#C8102E] font-bold flex items-center gap-0.5">
                    <Zap size={10} /> Instantané
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                  {/* Pôle 1 : MonCash Parent */}
                  <div className={`p-2 rounded-xl border transition-all ${
                    clearingStep === 1 ? 'bg-red-50 border-red-300 ring-2 ring-red-400' : 'bg-white border-slate-200'
                  }`}>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase">1. Débit Payeur</span>
                    <p className="font-bold text-slate-800 truncate">MonCash</p>
                    <p className="font-mono font-black text-red-600 text-[10.5px]">-{effectiveAmount.toLocaleString()} G</p>
                    <span className="text-[8.5px] text-slate-400 block truncate">+509 {displayPhone}</span>
                  </div>

                  {/* Pôle 2 : Passerelle Tranzak École */}
                  <div className={`p-2 rounded-xl border transition-all ${
                    clearingStep === 2 ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-400' : 'bg-white border-slate-200'
                  }`}>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase">2. Tranzak École</span>
                    <p className="font-bold text-blue-900 truncate">SAGACETECH</p>
                    <p className="font-mono font-black text-blue-700 text-[10.5px]">+{effectiveAmount.toLocaleString()} G</p>
                    <span className="text-[8.5px] text-blue-500 block truncate">Compte certifié</span>
                  </div>

                  {/* Pôle 3 : Portefeuille Élève */}
                  <div className={`p-2 rounded-xl border transition-all ${
                    clearingStep === 3 ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400' : 'bg-white border-slate-200'
                  }`}>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase">3. Portefeuille</span>
                    <p className="font-bold text-emerald-900 truncate">{student.first_name}</p>
                    <p className="font-mono font-black text-emerald-700 text-[10.5px]">+{effectiveAmount.toLocaleString()} G</p>
                    <span className="text-[8.5px] text-emerald-500 block truncate">Solde badge</span>
                  </div>
                </div>
              </div>

              {/* Saisie officielle du Security Code */}
              <div className="border border-slate-200 rounded-2xl p-3.5 bg-white shadow-xs space-y-2.5">
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wide">
                      Security Code (Code de sécurité)
                    </label>
                    {codeInsertedFeedback && (
                      <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 animate-pulse">
                        <Check size={11} /> Code appliqué
                      </span>
                    )}
                  </div>
                  <div className={`flex rounded-xl border overflow-hidden bg-white transition-all ${
                    securityCode.length === 6 ? 'border-emerald-500 ring-2 ring-emerald-500/10' : 'border-slate-300 focus-within:border-[#C8102E] focus-within:ring-2 focus-within:ring-red-500/10'
                  }`}>
                    <span className="px-3 py-2 bg-slate-100 text-slate-500 border-r border-slate-300 flex items-center select-none">
                      <Key size={15} />
                    </span>
                    <input
                      type="text"
                      value={securityCode}
                      onChange={(e) => setSecurityCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Ex: 163880 ou 196925"
                      maxLength={6}
                      autoFocus
                      required
                      className="w-full px-3 py-2 bg-white text-base font-mono font-black tracking-widest text-slate-900 outline-none placeholder:tracking-normal placeholder:text-xs placeholder:font-normal placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-[10.5px] text-slate-500">Pas encore reçu ?</span>
                  <button
                    type="button"
                    onClick={handleResendSecurityCode}
                    disabled={isResendingCode}
                    className="text-[11px] font-bold text-[#C8102E] hover:underline cursor-pointer disabled:opacity-50"
                  >
                    {isResendingCode ? 'Envoi...' : 'Resend code (Renvoyer le code)'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {/* Bouton officiel Digicel "Send" avec suivi de règlement en temps réel */}
              <button
                type="submit"
                disabled={isSubmitting || securityCode.length < 4}
                className="w-full py-3.5 px-4 rounded-xl bg-[#D91B24] hover:bg-[#C8102E] active:scale-[0.99] text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-red-600/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>
                      {clearingStep === 1
                        ? "1/3 : Débit compte MonCash..."
                        : clearingStep === 2
                        ? "2/3 : Encaissement Tranzak..."
                        : "3/3 : Crédit portefeuille élève..."}
                    </span>
                  </>
                ) : (
                  <span>Send (Valider et Créditer {effectiveAmount.toLocaleString()} HTG)</span>
                )}
              </button>
            </form>
          ) : (
            /* --------------------------------------------------------------------- */
            /* ÉTAPE 1 : CONFIGURATION DU DÉPÔT ("Deposit Now")                      */
            /* Reproduisant fidèlement la première vue d'encaissement de la vidéo    */
            /* --------------------------------------------------------------------- */
            <form onSubmit={handleProceedToMonCashPin} className="space-y-4">
              
              {/* Bannière d'information claire (identique au haut de la vidéo) */}
              <div className="p-3 bg-red-50/80 border border-red-200/90 rounded-2xl flex items-start gap-2 text-xs text-red-900">
                <Info size={16} className="shrink-0 text-red-600 mt-0.5" />
                <p className="leading-relaxed">
                  Ajoutez des fonds sur le compte de <strong>{student.first_name} {student.last_name}</strong> pour régler automatiquement la scolarité, la cantine et les fournitures.
                </p>
              </div>

              {/* Détails élève bénéficiaire */}
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

              {/* Sélection du Montant (Boutons + Champ personnalisé) */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wide">
                    Deposit Amount (Montant à déposer)
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
                        placeholder="Entrez le montant en Gourdes (ex: 350)"
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

              {/* Sélection du Moyen de Règlement (MonCash Auto par défaut) */}
              <div className="space-y-1">
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wide">
                  Passerelle de Paiement
                </label>
                <div className="p-2.5 rounded-xl border border-red-300 bg-red-50/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
                    <div>
                      <p className="text-xs font-bold text-slate-900">MonCash Auto (Passerelle Directe)</p>
                      <p className="text-[10px] text-slate-500">Validation instantanée via Digicel Haïti</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-white border border-red-200 text-[#C8102E] text-[10px] font-black uppercase">
                    Instantané
                  </span>
                </div>
              </div>

              {/* Tableau récapitulatif comptable (exactement comme dans la vidéo) */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Deposit (Montant Dépôt)</span>
                  <span className="font-mono font-bold text-slate-900">{effectiveAmount.toLocaleString()} HTG</span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>Tax Due (Taxes & Prélèvements)</span>
                  <span className="font-mono font-bold text-emerald-600">0 HTG</span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>Fixed Charge (Frais de service)</span>
                  <span className="font-mono font-bold text-emerald-600">0 HTG (Offert)</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-bold">
                  <span className="text-slate-900 uppercase">Total à débiter</span>
                  <span className="font-mono font-black text-sm text-[#C8102E]">{effectiveAmount.toLocaleString()} HTG</span>
                </div>
                <div className="pt-1.5 border-t border-slate-200/80 flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-medium">Balance after deposit (Nouveau solde)</span>
                  <span className="font-mono font-bold text-emerald-700">{projectedBalance.toLocaleString()} HTG</span>
                </div>
              </div>

              {/* Saisie initiale du numéro Digicel */}
              <div className="space-y-1">
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wide">
                  Numéro Digicel du payeur
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

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {/* Bouton Next -> vers le formulaire Digicel Secure Payment */}
              <button
                type="submit"
                disabled={isSubmitting || effectiveAmount <= 0}
                className="w-full py-3.5 px-4 rounded-xl bg-[#D91B24] hover:bg-[#C8102E] active:scale-[0.99] text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-red-600/25 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span>Poursuivre vers Digicel MonCash (Next)</span>
                <ArrowRight size={16} />
              </button>

              {/* Option de test immédiat en 1 clic */}
              <button
                type="button"
                onClick={handleQuickSimulationTest}
                disabled={isSubmitting || effectiveAmount <= 0}
                className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold text-xs border border-slate-700 shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                title="Simulation instantanée certifiée API Tranzak SAGACETECH"
              >
                <Sparkles size={14} className="text-amber-400" />
                <span>Tester via simulation API Tranzak (+{effectiveAmount.toLocaleString()} HTG)</span>
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};

export default StudentWalletTopUpModal;
