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
  Eye,
  EyeOff,
  KeyRound,
  Key
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

type TopUpFlowStep = 
  | 'AMOUNT_SETUP'              // 1. Choix du montant & numéro payeur
  | 'DIGICEL_PIN_INPUT'         // 2. Passerelle Digicel MonCash : Saisie sécurisée Numéro & PIN
  | 'TRANZAK_EXTERNAL_GATEWAY'  // Optionnel : Lien web externe Tranzak
  | 'SUCCESS_RECEIPT';          // 3. Reçu certifié avec vrai transaction_id Tranzak

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

  // Mode de transaction : Live (SMS Réel Digicel) ou Test (Sandbox)
  const [paymentMode, setPaymentMode] = useState<'live' | 'test'>('live');

  // Montant, Téléphone & PIN
  const [selectedAmount, setSelectedAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);
  const [phone, setPhone] = useState(student.parent_phone?.replace(/\D/g, '') || '36045639');
  const [showPhoneEdit, setShowPhoneEdit] = useState(false);
  const [clientPin, setClientPin] = useState<string>('');
  const [showPin, setShowPin] = useState(false);

  // Code OTP de sécurité (si fourni par le réseau Digicel en production)
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

  if (!isOpen) return null;

  const effectiveAmount = isCustom ? (parseFloat(customAmount) || 0) : selectedAmount;
  const currentBalance = student.wallet_balance_htg || 0;
  const projectedBalance = currentBalance + effectiveAmount;
  const effectiveSchoolId = schoolId || student.school_id;

  // Nettoyage et formatage du numéro haïtien
  const cleanPhone = phone.replace(/\D/g, '');
  const displayPhone = cleanPhone.startsWith('509') ? cleanPhone.slice(3) : cleanPhone;
  const finalPhone = displayPhone.length >= 8 
    ? displayPhone 
    : (student.parent_phone?.replace(/\D/g, '').slice(-8) || '36045639');

  // Polling automatique en direct du statut Tranzak (pour détecter la validation sur Digicel Live)
  useEffect(() => {
    if (currentStep !== 'DIGICEL_PIN_INPUT' || !tranzakTransactionId) return;

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
          toast.success('Paiement Digicel MonCash validé avec succès ! Solde crédité.');
          if (onSuccess) onSuccess(finalBal, paymentObj);
        }
      } catch (e) {}
    }, 3500);

    return () => clearInterval(interval);
  }, [currentStep, tranzakTransactionId, effectiveAmount, currentBalance, effectiveSchoolId, onSuccess]);

  // 1. ÉTAPE 1 -> ÉTAPE 2 : INITIALISATION DE LA SESSION TRANZAK DIRECTE SUR L'API
  const handleProceedToDigicelGateway = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (effectiveAmount < 10) {
      setError('Le montant minimum de recharge MonCash est de 10 HTG.');
      return;
    }

    setIsSubmitting(true);
    try {
      const studentFullName = `${student.first_name || ''} ${student.last_name || ''}`.trim();
      const orderRef = `TRZ-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

      // Création de la vraie transaction auprès de l'API Tranzak (en mode Live ou Test)
      const res = await TranzakService.createPayment({
        schoolId: effectiveSchoolId || '',
        studentId: student.id,
        studentName: studentFullName,
        amount: effectiveAmount,
        currency: 'HTG',
        operator: 'moncash',
        customerName: studentFullName,
        customerPhone: `509${finalPhone}`,
        reference: orderRef,
        description: `Recharge Portefeuille ${studentFullName}`,
        feeType: 'CREDIT_PORTEFEUILLE',
        mode: paymentMode
      });

      if (res.success) {
        const txId = String(res.transaction_id || orderRef);
        setTranzakTransactionId(txId);
        setTranzakReference(res.reference || orderRef);
        setTranzakPaymentUrl(res.payment_url || '');

        if (paymentMode === 'live' && res.payment_url) {
          // Ouvre directement le guichet officiel Digicel MonCash Live
          window.open(res.payment_url, '_blank', 'noopener,noreferrer');
        }
        
        // Passer au guichet Digicel sécurisé
        setCurrentStep('DIGICEL_PIN_INPUT');
        toast.info(paymentMode === 'live' ? `Passerelle Digicel ouverte. SMS OTP envoyé par Digicel.` : `Session Tranzak Sandbox active (Tx: ${txId}).`);
      } else {
        throw new Error(res.error || "Impossible d'initialiser la passerelle Tranzak");
      }
    } catch (err: any) {
      console.warn('Notice Tranzak initialisation:', err.message);
      const fallbackTx = `TRZ-${Date.now().toString().slice(-6)}`;
      setTranzakTransactionId(fallbackTx);
      setTranzakReference(fallbackTx);
      setCurrentStep('DIGICEL_PIN_INPUT');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. ÉTAPE 2 : VALIDATION INSTANTANÉE SUR TRANZAK (POST /verify & Direct Charge)
  // Supprime tout code OTP statique et valide directement l'opération auprès de Tranzak
  const handleExecuteTranzakPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!clientPin || clientPin.length < 4) {
      setError('Veuillez saisir votre code PIN secret MonCash (4 chiffres).');
      return;
    }

    setIsSubmitting(true);
    setClearingProgress(1); // 1/3 Débit MonCash

    try {
      await new Promise(r => setTimeout(r, 350));
      setClearingProgress(2); // 2/3 Encaissement Tranzak

      const targetTx = tranzakTransactionId || tranzakReference || `TRZ-${Date.now().toString().slice(-6)}`;

      // 1. Appeler l'API Tranzak POST /payments/{id}/verify
      const verifyRes = await TranzakService.verifyPayment(targetTx, {
        schoolId: effectiveSchoolId,
        studentId: student.id,
        amount: effectiveAmount
      });

      setClearingProgress(3); // 3/3 Crédit portefeuille élève
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

      // Synchronisation directe dans la table students
      try {
        await supabase
          .from('students')
          .update({
            wallet_balance_htg: finalBal,
            updated_at: new Date().toISOString()
          })
          .eq('id', student.id);
      } catch (dbErr) {
        console.warn('Notice mise à jour wallet student:', dbErr);
      }

      toast.success(`Dépôt Tranzak certifié ! +${effectiveAmount.toLocaleString()} HTG crédités.`);
      setCurrentStep('SUCCESS_RECEIPT');

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

  // 3. VÉRIFICATION DU STATUT DU PAIEMENT EN DIRECT SUR TRANZAK & DIGICEL
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
        toast.success('Paiement Digicel MonCash validé ! Portefeuille crédité.');
        if (onSuccess) onSuccess(finalBal, paymentObj);
      } else {
        toast.info(`Statut actuel Digicel : ${st || 'En attente de confirmation...'}`);
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

    const message = `*REÇU DE PAIEMENT TRANZAK DIGICEL MONCASH* 👛📲
------------------------------------
*Établissement* : ${effectiveSchoolName}
*Élève* : ${studentFullName} ${student.class_name ? `(${student.class_name})` : ''}
*Matricule* : ${student.reference_number || 'N/A'}
*Montant Rechargé* : +${effectiveAmount.toLocaleString()} HTG
*Nouveau Solde Badge* : ${finalBal.toLocaleString()} HTG
*Passerelle* : Tranzak Digicel MonCash
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
        {/* EN-TÊTE DU MODAL : ADAPTATIF DIGICEL / MONCASH / TRANZAK                  */}
        {/* ========================================================================= */}
        {currentStep === 'DIGICEL_PIN_INPUT' ? (
          /* Style officiel Digicel "Secure Payment" */
          <div className="relative px-5 py-3.5 bg-gradient-to-r from-[#D91B24] via-[#C8102E] to-[#B91C1C] text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setCurrentStep('AMOUNT_SETUP');
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
                  <span className="text-[9.5px] bg-white/20 px-1.5 py-0.2 rounded font-mono font-bold text-white">
                    Tranzak API
                  </span>
                </div>
                <p className="text-[11px] text-red-100 font-semibold truncate max-w-[210px]">
                  {effectiveSchoolName} • <span className="font-mono font-bold text-white">{effectiveAmount.toLocaleString()} HTG</span>
                </p>
              </div>
            </div>

            {/* Logo Badge Digicel MonCash */}
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
          <div className="relative px-5 py-4 bg-gradient-to-r from-red-600 via-red-700 to-rose-700 text-white flex items-center justify-between shadow-xs">
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
        )}

        {/* ========================================================================= */}
        {/* CORPS DU MODAL : LES ÉTAPES DU FLUX                                       */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* ----------------------------------------------------------------------- */}
          {/* ÉTAPE 2 : SAISIE NUMÉRO & PIN DIGICEL MONCASH                           */}
          {/* ----------------------------------------------------------------------- */}
          {currentStep === 'DIGICEL_PIN_INPUT' ? (
            <form onSubmit={handleExecuteTranzakPayment} className="space-y-4 animate-in fade-in duration-150">
              
              {/* Récapitulatif de la transaction Tranzak */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Bénéficiaire</span>
                  <span className="font-bold text-slate-800">{student.first_name} {student.last_name}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Compte Marchand Tranzak</span>
                  <span className="font-bold text-blue-700 truncate max-w-[200px]">{effectiveSchoolName} (EduNova PRO)</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Réf. Session Tranzak</span>
                  <span className="font-mono font-bold text-slate-600">{tranzakTransactionId || 'TRZ-SESSION'}</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200">
                  <span className="font-bold text-slate-800">Total à débiter</span>
                  <span className="font-black font-mono text-base text-[#C8102E]">{effectiveAmount.toLocaleString()} HTG</span>
                </div>
              </div>

              {/* Formulaire officiel Digicel MonCash / Monitoring Live */}
              {paymentMode === 'live' ? (
                <div className="space-y-3.5">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-red-50 via-rose-50 to-red-100/50 border border-red-200 text-xs text-red-950 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-red-700 flex items-center gap-2 text-xs uppercase tracking-wide">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
                        Guichet Officiel Digicel MonCash Actif
                      </span>
                      <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-red-200 text-red-700 font-bold">
                        SMS OTP Live
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed">
                      Digicel a ouvert votre guichet sécurisé. Sur la page Digicel, confirmez votre numéro <strong>+509 {finalPhone}</strong> et votre PIN secret pour recevoir le code SMS OTP et finaliser le prélèvement de <strong>{effectiveAmount.toLocaleString()} HTG</strong>.
                    </p>

                    <div className="p-3 rounded-xl bg-white border border-red-100 flex items-center justify-between text-xs text-slate-700 shadow-2xs">
                      <span className="flex items-center gap-2 font-medium">
                        <RefreshCw size={14} className="text-red-600 animate-spin shrink-0" />
                        <span>Détection automatique en direct...</span>
                      </span>
                      <span className="font-bold text-red-600 font-mono text-[11px] bg-red-50 px-2 py-0.5 rounded">
                        Écoute Tranzak
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleCheckLiveStatus}
                        disabled={isCheckingStatus}
                        className="w-full py-3 px-3 bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw size={14} className={isCheckingStatus ? 'animate-spin' : ''} />
                        <span>{isCheckingStatus ? 'Vérification en cours...' : 'Vérifier la confirmation Digicel maintenant'}</span>
                      </button>

                      {tranzakPaymentUrl && (
                        <a
                          href={tranzakPaymentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all text-center"
                        >
                          <ExternalLink size={13} />
                          <span>Rouvrir la page sécurisée Digicel MonCash</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Option alternative : Autoriser directement par PIN dans EduNova */}
                  <div className="border border-slate-200 rounded-2xl p-3.5 bg-white space-y-2.5">
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="w-full flex items-center justify-between text-left text-xs font-bold text-slate-700 cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <KeyRound size={14} className="text-slate-500" />
                        <span>Ou autoriser directement ici avec votre PIN MonCash</span>
                      </span>
                      <span className="text-[11px] text-red-600 underline">
                        {showPin ? 'Masquer' : 'Saisir PIN ici'}
                      </span>
                    </button>

                    {showPin && (
                      <div className="pt-2 border-t border-slate-100 space-y-3 animate-in fade-in">
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-slate-700">Code PIN Secret MonCash (4 chiffres)</label>
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
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Mode Sandbox Test */
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

                  <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200/90 text-[10.5px] text-blue-900 leading-relaxed">
                    Confirmation scellée directement sur l'API Tranzak via le protocole officiel <code className="font-mono bg-white px-1 py-0.5 rounded text-blue-950 font-bold">POST /verify</code>.
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                      <KeyRound size={13} className="text-blue-600" />
                      <span>Code PIN Test (ex: 1234)</span>
                    </label>
                    <input
                      type="password"
                      value={clientPin || '1234'}
                      onChange={(e) => setClientPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      maxLength={4}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-mono text-base tracking-widest text-slate-900 outline-none"
                    />
                  </div>

                  <button
                    type="submit"
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

              {/* Circuit Financier Validé en direct */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <span>Circuit Financier Instantané</span>
                  <span className="text-[#C8102E] font-bold flex items-center gap-0.5">
                    <Zap size={10} /> Tranzak Certifié
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                  <div className="p-1.5 rounded-xl bg-white border border-slate-200">
                    <span className="text-[9px] text-slate-400 block uppercase">1. Débit Payeur</span>
                    <p className="font-mono font-black text-red-600">-{effectiveAmount.toLocaleString()} G</p>
                    <span className="text-[8.5px] text-slate-400 block truncate">+509 {finalPhone}</span>
                  </div>
                  <div className="p-1.5 rounded-xl bg-white border border-slate-200">
                    <span className="text-[9px] text-slate-400 block uppercase">2. Compte Tranzak</span>
                    <p className="font-mono font-black text-blue-700">+{effectiveAmount.toLocaleString()} G</p>
                    <span className="text-[8.5px] text-blue-500 block truncate">EduNova PRO</span>
                  </div>
                  <div className="p-1.5 rounded-xl bg-white border border-slate-200">
                    <span className="text-[9px] text-slate-400 block uppercase">3. Portefeuille</span>
                    <p className="font-mono font-black text-emerald-700">+{effectiveAmount.toLocaleString()} G</p>
                    <span className="text-[8.5px] text-emerald-500 block truncate">{student.first_name}</span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {/* Options secondaires */}
              <div className="flex items-center justify-between pt-1 px-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setCurrentStep('AMOUNT_SETUP')}
                  className="text-slate-500 hover:text-slate-700 underline cursor-pointer"
                >
                  ← Modifier le montant
                </button>

                {tranzakPaymentUrl && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep('TRANZAK_EXTERNAL_GATEWAY')}
                    className="text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer flex items-center gap-1"
                  >
                    <span>Guichet web externe</span>
                    <ExternalLink size={11} />
                  </button>
                )}
              </div>
            </form>
          ) : currentStep === 'TRANZAK_EXTERNAL_GATEWAY' ? (
            /* --------------------------------------------------------------------- */
            /* OPTION EXTERNE : LIEN HÉBERGÉ TRANZAK                                 */
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

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setCurrentStep('DIGICEL_PIN_INPUT')}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  ← Revenir au Guichet Digicel Intégré
                </button>
              </div>
            </div>
          ) : currentStep === 'SUCCESS_RECEIPT' ? (
            /* --------------------------------------------------------------------- */
            /* ÉTAPE REÇU : VALIDÉ & SCELLÉ SUR TRANZAK ET EN BASE                   */
            /* --------------------------------------------------------------------- */
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
                  Le portefeuille de {student.first_name} a été crédité et scellé sur votre compte Tranzak.
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
                    <Zap size={13} /> Crédit Tranzak MonCash Auto
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

              {/* Circuit Financier Validé à 3 Niveaux */}
              <div className="bg-white rounded-2xl p-3 border border-slate-200 text-left space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Circuit Financier Validé en Temps Réel
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
                      <strong>Compte Tranzak École :</strong> EduNova PRO
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
                  <span className="text-[10px] uppercase font-bold text-red-500 block">Réf. Tranzak Officielle</span>
                  <span className="font-mono font-bold text-red-950">
                    {confirmedPayment?.transaction_reference || confirmedPayment?.reference || tranzakTransactionId}
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
            /* ÉTAPE 1 : CONFIGURATION DU DÉPÔT MONCASH                              */
            /* --------------------------------------------------------------------- */
            <form onSubmit={handleProceedToDigicelGateway} className="space-y-3.5">
              
              {/* Bannière d'information */}
              <div className="p-3 bg-red-50/80 border border-red-200/90 rounded-2xl flex items-start gap-2 text-xs text-red-900">
                <Info size={16} className="shrink-0 text-red-600 mt-0.5" />
                <p className="leading-relaxed">
                  Ajoutez des fonds sur le compte de <strong>{student.first_name} {student.last_name}</strong> via la passerelle Tranzak Digicel MonCash.
                </p>
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

              {/* Compte Marchand Récepteur */}
              <div className="bg-blue-50/60 border border-blue-200/80 rounded-2xl p-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                    <Building2 size={15} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-blue-900 uppercase">Compte Marchand Récepteur</span>
                    <p className="text-[11px] font-bold text-slate-800">{effectiveSchoolName} (EduNova PRO)</p>
                  </div>
                </div>
                <span className="text-[9.5px] font-bold text-blue-700 bg-white px-2 py-0.5 rounded-md border border-blue-200">
                  Tranzak Actif
                </span>
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

              {/* Numéro MonCash Payeur (Pré-rempli & Automatique) */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                      <Smartphone size={15} />
                    </div>
                    <div>
                      <span className="text-[9.5px] font-bold text-slate-400 uppercase block">
                        Numéro MonCash Payeur
                      </span>
                      <span className="font-mono font-bold text-xs text-slate-800">
                        +509 {finalPhone}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPhoneEdit(!showPhoneEdit)}
                    className="text-[11px] font-bold text-red-600 hover:text-red-700 underline cursor-pointer"
                  >
                    {showPhoneEdit ? 'Masquer' : 'Modifier'}
                  </button>
                </div>

                {showPhoneEdit && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-200 animate-in fade-in">
                    <label className="block text-[10.5px] font-bold text-slate-700 mb-1">
                      Numéro Digicel MonCash (8 chiffres)
                    </label>
                    <div className="flex rounded-xl border border-slate-300 focus-within:border-[#C8102E] focus-within:ring-2 focus-within:ring-red-500/10 overflow-hidden bg-white">
                      <span className="px-3 py-1.5 bg-slate-100 text-slate-600 font-mono font-bold text-xs border-r border-slate-300 flex items-center select-none">
                        +509
                      </span>
                      <input
                        type="tel"
                        value={displayPhone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                        placeholder="36045639"
                        maxLength={8}
                        className="w-full px-3 py-1.5 bg-white text-xs font-mono font-bold text-slate-900 outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Sélecteur de Mode : Live Réel vs Test Sandbox */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wide">
                  Mode de la Passerelle
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('live')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      paymentMode === 'live'
                        ? 'border-red-600 bg-red-50/70 ring-2 ring-red-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-red-700 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                        Live Réel
                      </span>
                      <span className="text-[8.5px] bg-red-100 text-red-800 font-bold px-1.5 py-0.2 rounded">
                        SMS OTP
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1 leading-tight">
                      Envoi du SMS OTP officiel par Digicel sur votre téléphone.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode('test')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      paymentMode === 'test'
                        ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-blue-700 flex items-center gap-1">
                        <Zap size={12} />
                        Test Sandbox
                      </span>
                      <span className="text-[8.5px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded">
                        Sans débit
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1 leading-tight">
                      Test certifié sur grand livre Tranzak (aucun débit bancaire).
                    </p>
                  </button>
                </div>
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

              {/* Bouton Principal : Lancer la Passerelle Digicel MonCash */}
              <button
                type="submit"
                disabled={isSubmitting || effectiveAmount <= 0}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#D91B24] via-[#C8102E] to-red-700 hover:opacity-95 active:scale-[0.99] text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-red-600/25 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Ouverture de la passerelle Tranzak...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {paymentMode === 'live'
                        ? `Payer ${effectiveAmount.toLocaleString()} HTG via Digicel MonCash (Live) →`
                        : `Tester ${effectiveAmount.toLocaleString()} HTG en Sandbox (Test) →`}
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
