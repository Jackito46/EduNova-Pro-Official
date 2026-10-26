import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Smartphone, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ExternalLink, 
  X, 
  Copy, 
  Check, 
  Clock, 
  ShieldCheck, 
  Radio, 
  Receipt,
  ArrowRight,
  Sparkles,
  Share2,
  Ban,
  AlertTriangle,
  Printer,
  QrCode,
  Info,
  HelpCircle
} from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import { 
  checkMonCashPaymentStatus, 
  confirmMonCashPaymentManually,
  cancelMonCashPayment,
  type CheckMonCashStatusResult 
} from '../src/utils/payment';

export interface MonCashWaitingModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentId?: string;
  orderId: string;
  transactionReference?: string;
  amount: number;
  currency?: string;
  studentName: string;
  studentCode?: string;
  studentClass?: string;
  feeTypeLabel?: string;
  redirectUrl?: string | null;
  payerPhone?: string;
  onConfirmed: (paymentRecord: any) => void;
  onFailed?: (error: string) => void;
  onCancelled?: (orderId?: string) => void;
  schoolId?: string;
  initiatedAt?: string | Date;
}

export const MonCashWaitingModal: React.FC<MonCashWaitingModalProps> = ({
  isOpen,
  onClose,
  paymentId,
  orderId,
  transactionReference,
  amount,
  currency = 'HTG',
  studentName,
  studentCode,
  studentClass,
  feeTypeLabel = 'Frais Scolaires',
  redirectUrl,
  payerPhone,
  onConfirmed,
  onFailed,
  onCancelled,
  schoolId,
  initiatedAt
}) => {
  const [status, setStatus] = useState<'PENDING' | 'COMPLETED' | 'FAILED'>('PENDING');
  const [isManualChecking, setIsManualChecking] = useState(false);
  const [checkCount, setCheckCount] = useState(0);
  const [lastCheckTime, setLastCheckTime] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedPayment, setConfirmedPayment] = useState<any | null>(null);
  const [copiedOrder, setCopiedOrder] = useState(false);
  const [copiedTx, setCopiedTx] = useState(false);

  // État de confirmation d'annulation
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Mode validation manuelle avec SMS
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualSmsReference, setManualSmsReference] = useState('');
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  // QR Code pour paiement sur smartphone du parent
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  // Génération du QR Code Digicel MonCash dès que redirectUrl est prêt
  useEffect(() => {
    if (redirectUrl) {
      QRCode.toDataURL(redirectUrl, {
        width: 240,
        margin: 2,
        color: {
          dark: '#b91c1c', // Rouge Digicel MonCash
          light: '#ffffff'
        }
      })
      .then(url => setQrCodeDataUrl(url))
      .catch(err => console.warn('[QR Code Generation Error]', err));
    } else {
      setQrCodeDataUrl(null);
    }
  }, [redirectUrl]);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingActive = useRef<boolean>(false);

  // Fonction centrale pour sonder l'état du paiement côté serveur
  const verifyStatus = useCallback(async (isManual = false) => {
    if (isManual) setIsManualChecking(true);

    try {
      const result: CheckMonCashStatusResult = await checkMonCashPaymentStatus({
        paymentId,
        orderId,
        transactionReference,
        supabaseClient: supabase,
        schoolId
      });

      setCheckCount(prev => prev + 1);
      setLastCheckTime(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      if (result.isConfirmed) {
        setStatus('COMPLETED');
        setConfirmedPayment(result.paymentRecord);
        toast.success("Paiement MonCash validé avec succès ! Reçu officiel généré.");
        
        // Stopper le polling
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        isPollingActive.current = false;
      } else if (result.isFailed) {
        setStatus('FAILED');
        setErrorMessage(result.message || 'La transaction MonCash a échoué ou a été rejetée.');
        if (onFailed) onFailed(result.message);
        
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        isPollingActive.current = false;
      }
    } catch (err: any) {
      console.warn('[MonCash Modal Polling Error]', err);
    } finally {
      if (isManual) setIsManualChecking(false);
    }
  }, [paymentId, orderId, transactionReference, schoolId, onFailed]);

  // Initialisation et gestion du Polling toutes les 5 secondes
  useEffect(() => {
    if (!isOpen) {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      isPollingActive.current = false;
      return;
    }

    // Réinitialiser les états
    setStatus('PENDING');
    setCheckCount(0);
    setErrorMessage(null);
    setConfirmedPayment(null);
    setCountdown(5);
    setShowCancelConfirm(false);
    isPollingActive.current = true;

    // Premier check immédiat
    verifyStatus();

    // Boucle de décompte visuel de 5 à 1 seconde
    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? 5 : prev - 1));
    }, 1000);

    // Boucle de polling stricte toutes les 5 secondes (5000 ms)
    pollingIntervalRef.current = setInterval(() => {
      if (isPollingActive.current) {
        verifyStatus();
        setCountdown(5);
      }
    }, 5000);

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      isPollingActive.current = false;
    };
  }, [isOpen, verifyStatus]);

  // Copie de l'identifiant dans le presse-papier
  const handleCopyText = (text: string, isOrder: boolean) => {
    if (text) {
      navigator.clipboard.writeText(text);
      if (isOrder) {
        setCopiedOrder(true);
        setTimeout(() => setCopiedOrder(false), 2000);
        toast.info("N° de commande copié");
      } else {
        setCopiedTx(true);
        setTimeout(() => setCopiedTx(false), 2000);
        toast.info("ID de transaction copié");
      }
    }
  };

  // Annulation sécurisée de la transaction non aboutie
  const handleCancelTransaction = async () => {
    setIsCancelling(true);
    try {
      // Stopper les timers immédiatement
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      isPollingActive.current = false;

      const res = await cancelMonCashPayment({
        paymentId,
        orderId,
        supabaseClient: supabase,
        cancelledBy: 'Guichetier',
        reason: 'Abandonné au guichet'
      });

      if (res.success) {
        toast.info("Transaction MonCash annulée avec succès. Aucun règlement n'a été prélevé.");
        if (onCancelled) {
          onCancelled(orderId);
        } else {
          onClose();
        }
      } else {
        toast.error(res.error || "Impossible d'annuler cette transaction.");
        setShowCancelConfirm(false);
      }
    } catch (err: any) {
      console.error("Erreur annulation MonCash:", err);
      toast.error("Erreur technique lors de l'annulation.");
      setShowCancelConfirm(false);
    } finally {
      setIsCancelling(false);
    }
  };

  // Partage instantané du reçu sur WhatsApp avec traçabilité complète
  const handleShareReceiptWhatsApp = () => {
    const officialTxId = confirmedPayment?.transaction_reference || confirmedPayment?.reference_number || transactionReference || 'CERTIFIÉ';
    const cleanPhone = (payerPhone || '').replace(/\D/g, '');
    const targetPhone = cleanPhone.startsWith('509') ? cleanPhone : (cleanPhone.length >= 8 ? `509${cleanPhone}` : '');
    const msg = `*REÇU OFFICIEL DE PAIEMENT MONCASH* 📲\n------------------------------------\n*Élève* : ${studentName}${studentClass ? ` (${studentClass})` : ''}\n*Matricule* : ${studentCode || 'N/A'}\n*Motif* : ${feeTypeLabel}\n*Montant Encaissé* : ${Math.round(amount).toLocaleString()} HTG\n*ID Transaction MonCash* : ${officialTxId}\n*Réf. Commande* : ${orderId}\n*Statut* : PAYÉ & CERTIFIÉ SERVEUR ✅\n*Date & Heure* : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}\n------------------------------------\n_Paiement scellé avec succès. Merci !_`;
    const url = targetPhone 
      ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Validation manuelle de secours si le parent montre son SMS Digicel
  const handleManualValidation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualSmsReference.trim()) {
      toast.error("Veuillez saisir le numéro de transaction Digicel présent sur le SMS du parent.");
      return;
    }

    setIsSubmittingManual(true);
    try {
      const res = await confirmMonCashPaymentManually({
        paymentId,
        orderId,
        transactionReference: manualSmsReference.trim().toUpperCase(),
        supabaseClient: supabase,
        confirmedBy: 'Guichetier'
      });

      if (res.success && res.paymentRecord) {
        toast.success("Transaction validée manuellement avec succès !");
        setStatus('COMPLETED');
        setConfirmedPayment(res.paymentRecord);
      } else {
        toast.error("Erreur de validation : " + (res.error || 'Veuillez vérifier la référence.'));
      }
    } catch (err: any) {
      toast.error("Erreur inattendue : " + err.message);
    } finally {
      setIsSubmittingManual(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      id="moncash-waiting-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150"
    >
      <div 
        id="moncash-waiting-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="moncash-modal-title"
        className="relative w-full max-w-md sm:max-w-lg md:max-w-xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden my-auto max-h-[94vh] flex flex-col animate-in zoom-in-95 duration-150"
      >
        {/* Bandeau d'accentuation MonCash Digicel */}
        <div className="h-2 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 w-full shrink-0" />

        {/* Bouton de fermeture supérieur */}
        <button
          id="moncash-modal-close-btn"
          onClick={() => {
            if (status === 'PENDING') {
              setShowCancelConfirm(true);
            } else {
              onClose();
            }
          }}
          className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 hover:text-slate-800 transition-all flex items-center justify-center z-10 cursor-pointer"
          title="Fermer la fenêtre"
          aria-label="Fermer"
        >
          <X size={16} />
        </button>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {/* ================================================================= */}
          {/* ÉTAT 1 : EN ATTENTE DE CONFIRMATION (TRANSACTION NON ENCORE ABOUTIE) */}
          {/* ================================================================= */}
          {status === 'PENDING' && (
            <div className="flex flex-col items-center text-center">
              {/* Radar de pulsation visuelle */}
              <div className="relative mb-4">
                <div className="absolute inset-0 rounded-2xl bg-amber-400/25 animate-ping" />
                <div className="relative w-16 h-16 sm:w-18 sm:h-18 bg-gradient-to-tr from-red-600 to-amber-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20">
                  <Smartphone size={32} className="animate-bounce" style={{ animationDuration: '2.5s' }} />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-xs">
                    <Radio size={14} className="text-red-600 animate-pulse" />
                  </div>
                </div>
              </div>

              {/* Badge de statut institutionnel */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-200/80 rounded-full text-red-800 text-[11px] font-bold uppercase tracking-wider mb-2">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-ping shrink-0" />
                <span>Passerelle Sécurisée Digicel MonCash • Tranzak</span>
              </div>

              <h2 id="moncash-modal-title" className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Finalisation du Paiement MonCash
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-md">
                Le parent autorise le débit de <strong className="text-slate-900 font-bold font-mono">{Math.round(amount).toLocaleString()} HTG</strong> sur la page officielle chiffrée Digicel.
              </p>

              {/* Panneau de confirmation d'annulation inline */}
              {showCancelConfirm ? (
                <div className="w-full bg-rose-50 border border-rose-200 rounded-2xl p-4 my-4 text-left animate-in fade-in duration-150">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-rose-950">
                        Confirmer l'annulation de la transaction ?
                      </h4>
                      <p className="text-[11.5px] text-rose-800 mt-1 leading-snug">
                        L'ordre de paiement de <strong className="font-bold">{Math.round(amount).toLocaleString()} HTG</strong> pour <strong className="font-bold">{studentName}</strong> sera abandonné. Aucun montant ne sera débité.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-rose-200/80">
                    <button
                      id="confirm-cancel-moncash-btn"
                      type="button"
                      onClick={handleCancelTransaction}
                      disabled={isCancelling}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[44px]"
                    >
                      {isCancelling ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <Ban size={14} />
                      )}
                      <span>{isCancelling ? 'Annulation...' : 'Oui, annuler la transaction'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCancelConfirm(false)}
                      disabled={isCancelling}
                      className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 transition-colors cursor-pointer min-h-[44px]"
                    >
                      Continuer d'attendre
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full my-4 space-y-3">
                  {/* SECTION PRINCIPALE : PASSERELLE DIGICEL (BOUTON OU QR CODE) */}
                  {redirectUrl ? (
                    <div className="bg-gradient-to-br from-red-50/80 via-white to-rose-50/50 border-2 border-red-200 rounded-2xl p-4 text-left shadow-sm space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                            MC
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-red-600 block">
                              Passerelle Officielle Digicel
                            </span>
                            <span className="text-xs sm:text-sm font-bold text-slate-900">
                              Valider le prélèvement de {Math.round(amount).toLocaleString()} HTG
                            </span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                          Session Prête
                        </span>
                      </div>

                      {/* 2 MOYENS DE VALIDATION POUR LE PARENT */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {/* Option 1: Bouton Ouvrir Page Digicel */}
                        <div className="bg-white p-3 rounded-xl border border-red-100 flex flex-col justify-between space-y-2">
                          <div>
                            <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">
                              Option 1 : Sur cet écran
                            </span>
                            <p className="text-[11.5px] text-slate-700 mt-1 leading-snug">
                              Ouvrir la page sécurisée Digicel pour que le parent saisisse son numéro et son PIN.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => window.open(redirectUrl, '_blank', 'noopener,noreferrer')}
                            className="w-full py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-black text-xs shadow-md shadow-red-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[42px]"
                          >
                            <ExternalLink size={15} />
                            <span>Ouvrir la page Digicel</span>
                          </button>
                        </div>

                        {/* Option 2: Scan QR Code avec Smartphone */}
                        <div className="bg-white p-3 rounded-xl border border-red-100 flex flex-col items-center justify-center text-center space-y-2">
                          <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">
                            Option 2 : Sur son téléphone
                          </span>
                          {qrCodeDataUrl ? (
                            <div className="relative group cursor-pointer" onClick={() => setShowQrModal(true)} title="Cliquer pour agrandir le QR Code">
                              <img 
                                src={qrCodeDataUrl} 
                                alt="QR Code MonCash Digicel" 
                                className="w-24 h-24 rounded-lg border border-red-200 shadow-2xs mx-auto"
                              />
                              <div className="text-[10px] font-bold text-red-700 mt-1 flex items-center justify-center gap-1">
                                <QrCode size={11} /> Scanner avec l'appareil photo
                              </div>
                            </div>
                          ) : (
                            <div className="w-24 h-24 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
                              Génération QR...
                            </div>
                          )}
                        </div>
                      </div>

                      {/* NOTICE PÉDAGOGIQUE HAÏTI : DÉMYSTIFICATION DE "SAGACETECH" ET DU PIN */}
                      <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3 text-left space-y-1.5">
                        <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                          <Info size={14} className="text-amber-600 shrink-0" />
                          <span>Précisions essentielles sur la page Digicel :</span>
                        </div>
                        <ul className="text-[11px] text-amber-900/90 space-y-1 pl-4 list-disc leading-relaxed">
                          <li>
                            <strong>SAGACETECH</strong> : C'est le nom officiel de l'opérateur agréé <em>Tranzak</em> en Haïti. Vous n'avez pas besoin d'un compte marchand Digicel personnel : Tranzak perçoit pour l'école et crédite votre solde.
                          </li>
                          <li>
                            <strong>Numéro & PIN demandés</strong> : Le parent saisit simplement son numéro personnel MonCash (ex: <span className="font-mono font-bold">48123456</span>) et son <strong>code PIN secret à 4 chiffres</strong>, puis clique sur <strong>Pay</strong>.
                          </li>
                          <li>
                            <strong>Protection Anti-Fraude</strong> : Digicel n'envoie pas de menu USSD automatique sans ouverture préalable de cette page chiffrée afin d'éviter tout débit non sollicité.
                          </li>
                        </ul>
                      </div>
                    </div>
                  ) : null}

                  {/* Carte Récapitulative Complète avec Traçabilité */}
                  <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 text-left space-y-3">
                    {/* Montant */}
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/60">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Montant à régler</span>
                      <div className="text-right">
                        <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                          {Math.round(amount).toLocaleString()}
                        </span>
                        <span className="text-xs font-bold text-red-600 ml-1.5 uppercase">HTG</span>
                      </div>
                    </div>

                    {/* Élève & Frais */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 block font-medium text-[11px]">Élève bénéficiaire</span>
                        <span className="font-bold text-slate-800 truncate block">{studentName}</span>
                        {studentClass && (
                          <span className="text-[11px] text-slate-500">{studentClass}</span>
                        )}
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium text-[11px]">Motif du paiement</span>
                        <span className="font-bold text-slate-800 truncate block">{feeTypeLabel}</span>
                      </div>
                    </div>

                    {/* IDENTIFIANTS DE TRAÇABILITÉ (ORDER ID VS TRANSACTION ID) */}
                    <div className="pt-2 border-t border-slate-200/60 space-y-2 text-xs">
                      {/* N° Commande d'Initiation */}
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-600 uppercase tracking-wider">
                            <span>N° Commande d'Initiation (Order ID)</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyText(orderId, true)}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                            title="Copier le N° de commande"
                          >
                            {copiedOrder ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                          </button>
                        </div>
                        <div className="font-mono text-xs sm:text-sm font-black text-slate-900 truncate">
                          {orderId}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                          * Référence d'ordre générée par l'établissement. Dès que le parent valide sur Digicel, l'ID Transaction définitif sera scellé automatiquement sur le reçu.
                        </p>
                      </div>

                      {/* Date d'initiative & Statut */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[11px] text-slate-500 pt-1">
                        {initiatedAt && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} className="text-amber-600" />
                            <span>Initié le : <strong className="font-mono text-slate-700">{new Date(initiatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong></span>
                          </span>
                        )}
                        <span className="flex items-center gap-1 font-semibold text-amber-700">
                          <ShieldCheck size={12} />
                          <span>Statut : En attente du débit mobile</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Barre de polling active (Synchronisation automatique toutes les 5s) */}
              {!showCancelConfirm && (
                <>
                  <div className="w-full bg-emerald-500/10 border border-emerald-300/40 rounded-xl p-2.5 sm:p-3 flex items-center justify-between text-xs text-emerald-900 mb-3">
                    <div className="flex items-center gap-2">
                      <RefreshCw 
                        size={14} 
                        className={`text-emerald-600 ${isManualChecking ? 'animate-spin' : ''}`} 
                      />
                      <span className="text-[11.5px] sm:text-xs">
                        Synchronisation automatique en direct <strong className="font-bold">({countdown}s)</strong>
                      </span>
                    </div>
                    <div className="text-[10.5px] text-emerald-700 font-medium">
                      {checkCount > 0 ? `${checkCount} vérif.` : 'En écoute...'}
                    </div>
                  </div>

                  {/* Actions d'attente et d'annulation */}
                  <div className="w-full space-y-2">
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                      <button
                        type="button"
                        onClick={() => verifyStatus(true)}
                        disabled={isManualChecking}
                        className="w-full sm:flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 min-h-[44px] cursor-pointer"
                      >
                        <RefreshCw size={14} className={isManualChecking ? 'animate-spin' : ''} />
                        <span>{isManualChecking ? 'Vérification...' : 'Vérifier maintenant'}</span>
                      </button>

                      {/* BOUTON D'ANNULATION PROÉMINENT */}
                      <button
                        id="cancel-pending-moncash-btn"
                        type="button"
                        onClick={() => setShowCancelConfirm(true)}
                        className="w-full sm:w-auto flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 font-bold text-xs border border-rose-200 transition-colors min-h-[44px] cursor-pointer"
                        title="Annuler cette transaction non aboutie"
                      >
                        <Ban size={14} />
                        <span>Annuler la transaction</span>
                      </button>
                    </div>

                    {/* Bascule de validation manuelle par SMS */}
                    {!showManualInput ? (
                      <button
                        type="button"
                        onClick={() => setShowManualInput(true)}
                        className="text-[11px] text-slate-500 hover:text-red-700 font-semibold underline underline-offset-2 py-1 transition-colors cursor-pointer"
                      >
                        Le parent a déjà reçu le SMS Digicel ? Valider avec le N° de transaction
                      </button>
                    ) : (
                      <form onSubmit={handleManualValidation} className="bg-slate-100/80 p-3 rounded-xl border border-slate-200 mt-2 text-left space-y-2 animate-in fade-in duration-150">
                        <label className="text-[11px] font-bold text-slate-700 block">
                          Numéro de Transaction reçu par SMS (ex: TRX-9821034)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={manualSmsReference}
                            onChange={(e) => setManualSmsReference(e.target.value.toUpperCase())}
                            placeholder="Ex: MC-8492019"
                            className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 uppercase outline-none focus:border-red-600 focus:ring-2 focus:ring-red-500/10 min-h-[40px]"
                            autoFocus
                          />
                          <button
                            type="submit"
                            disabled={isSubmittingManual || !manualSmsReference.trim()}
                            className="px-3.5 py-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 shrink-0 cursor-pointer min-h-[40px]"
                          >
                            {isSubmittingManual ? 'Validation...' : 'Valider'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* ÉTAT 2 : TRANSACTION MONCASH CONFIRMÉE ET VALIDÉE AVEC SUCCÈS      */}
          {/* ================================================================= */}
          {status === 'COMPLETED' && (
            <div className="flex flex-col items-center text-center py-2 animate-in fade-in duration-200">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/20">
                <CheckCircle2 size={34} className="animate-in zoom-in duration-200 text-emerald-600" />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-800 text-[11px] font-black uppercase tracking-wider mb-1.5">
                <Sparkles size={13} className="text-emerald-600" />
                <span>Paiement Validé & Scellé</span>
              </div>

              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Paiement MonCash Réussi !
              </h2>

              <p className="text-slate-500 text-xs sm:text-sm mt-0.5 max-w-sm">
                Le règlement a été certifié avec succès côté serveur. La facture et le reçu officiel sont prêts.
              </p>

              {/* DÉTAILS DE TRAÇABILITÉ OFFICIELLE COMPLÈTE */}
              <div className="w-full bg-emerald-50/70 border border-emerald-200/90 rounded-2xl p-3.5 sm:p-4 my-3.5 text-left space-y-2.5">
                {/* Montant validé */}
                <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Montant Perçu</span>
                  <div className="text-right">
                    <span className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">
                      {Math.round(amount).toLocaleString()}
                    </span>
                    <span className="text-xs font-bold text-emerald-700 ml-1 uppercase">HTG</span>
                  </div>
                </div>

                {/* Élève & Frais */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium text-[11px]">Élève</span>
                    <span className="font-bold text-slate-800 truncate block">{studentName}</span>
                    {studentClass && (
                      <span className="text-[11px] text-slate-500">{studentClass}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium text-[11px]">Motif</span>
                    <span className="font-bold text-slate-800 truncate block">{feeTypeLabel}</span>
                  </div>
                </div>

                {/* AUTHENTIQUE ID TRANSACTION OFFICIEL DIGICEL */}
                <div className="pt-2 border-t border-emerald-200/60 space-y-2">
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-200 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                        <ShieldCheck size={12} className="text-emerald-600" />
                        <span>ID Transaction MonCash (Officiel Digicel)</span>
                      </div>
                      <div className="font-mono text-xs sm:text-sm font-black text-slate-900 truncate mt-0.5">
                        {confirmedPayment?.transaction_reference || confirmedPayment?.reference_number || transactionReference || `TRX-${Date.now()}`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyText(confirmedPayment?.transaction_reference || confirmedPayment?.reference_number || transactionReference || '', false)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
                      title="Copier l'identifiant officiel"
                    >
                      {copiedTx ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    </button>
                  </div>

                  {/* N° Commande d'Origine */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                    <span>Réf. Commande Origine :</span>
                    <span className="font-mono font-bold text-slate-700">{orderId}</span>
                  </div>

                  {/* Horodatage de validation */}
                  <div className="flex items-center justify-between text-[10.5px] text-slate-500 px-1">
                    <span>Horodatage de certification :</span>
                    <span className="font-mono font-medium text-slate-700">
                      {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* BOUTONS D'ACTION : IMPRESSION DU REÇU & WHATSAPP */}
              <div className="w-full space-y-2">
                {/* 1. BOUTON PRIMAIRE : AFFICHER & IMPRIMER LE REÇU OFFICIEL DE CAISSE */}
                <button
                  id="print-official-receipt-btn"
                  type="button"
                  onClick={() => onConfirmed(confirmedPayment)}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer min-h-[46px]"
                >
                  <Printer size={16} />
                  <span>Imprimer le Reçu Officiel (Ticket Caisse 80mm)</span>
                  <ArrowRight size={15} />
                </button>

                {/* 2. BOUTON SECONDAIRE : ENVOI WHATSAPP 0 HTG */}
                <button
                  id="share-whatsapp-receipt-btn"
                  type="button"
                  onClick={handleShareReceiptWhatsApp}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer min-h-[44px]"
                >
                  <Share2 size={16} />
                  <span>Partager le Reçu via WhatsApp (0 HTG)</span>
                </button>

                {/* 3. CLÔTURE RAPIDE */}
                <button
                  type="button"
                  onClick={() => onConfirmed(confirmedPayment)}
                  className="w-full py-2 text-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  Terminer et Nouvel Encaissement
                </button>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* ÉTAT 3 : ÉCHEC OU REJET DE LA TRANSACTION MONCASH                 */}
          {/* ================================================================= */}
          {status === 'FAILED' && (
            <div className="flex flex-col items-center text-center py-4 animate-in fade-in duration-200">
              <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-rose-500/20">
                <AlertCircle size={32} />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-200 rounded-full text-rose-800 text-[11px] font-bold uppercase tracking-wider mb-2">
                Transaction Non Aboutie
              </div>

              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Échec du paiement MonCash
              </h2>

              <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-sm">
                {errorMessage || "Le paiement n'a pas pu être validé sur le compte MonCash du parent."}
              </p>

              <div className="w-full flex flex-col sm:flex-row items-center gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => {
                    setStatus('PENDING');
                    verifyStatus(true);
                  }}
                  className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm transition-all min-h-[44px] cursor-pointer"
                >
                  Réessayer la vérification
                </button>
                <button
                  type="button"
                  onClick={handleCancelTransaction}
                  disabled={isCancelling}
                  className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs sm:text-sm border border-rose-200 transition-colors min-h-[44px] cursor-pointer"
                >
                  Annuler la transaction
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Pied de page informatif de sécurité et audit */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-1 text-[10.5px] text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
            <span>Passerelle officielle Digicel MonCash • Traçabilité certifiée</span>
          </div>
          {lastCheckTime && (
            <div className="flex items-center gap-1 text-slate-400">
              <Clock size={11} />
              <span>Dernier contrôle : {lastCheckTime}</span>
            </div>
          )}
        </div>

        {/* Modal d'agrandissement du QR Code pour scan à distance */}
        {showQrModal && qrCodeDataUrl && (
          <div className="fixed inset-0 z-60 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl border border-red-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="text-left">
                  <span className="text-[10px] font-black uppercase text-red-600 tracking-wider">Passerelle Digicel</span>
                  <h4 className="text-sm font-black text-slate-900">Scanner pour Payer</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQrModal(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="bg-gradient-to-b from-red-50 to-white p-4 rounded-2xl border border-red-100">
                <img
                  src={qrCodeDataUrl}
                  alt="QR Code MonCash Agrandissement"
                  className="w-64 h-64 mx-auto rounded-xl shadow-sm"
                />
              </div>

              <div className="text-xs text-slate-600 space-y-1">
                <div className="font-bold text-slate-900">
                  Montant à régler : <span className="font-mono text-red-600 font-black text-sm">{Math.round(amount).toLocaleString()} HTG</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Pointez l'appareil photo du smartphone vers le code. La page chiffrée Digicel MonCash s'ouvrira immédiatement.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer transition-colors"
              >
                Fermer l'agrandissement
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonCashWaitingModal;
