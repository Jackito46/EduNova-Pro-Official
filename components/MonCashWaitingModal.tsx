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
  MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import { 
  checkMonCashPaymentStatus, 
  confirmMonCashPaymentManually,
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
  const [copied, setCopied] = useState(false);

  // Mode validation manuelle avec SMS
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualSmsReference, setManualSmsReference] = useState('');
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingActive = useRef<boolean>(false);

  // Fonction centrale pour sonder l'état du paiement
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
        toast.success("Paiement MonCash confirmé avec succès !");
        
        // Stopper le polling
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        isPollingActive.current = false;

        // Déclencher le callback après une courte animation
        setTimeout(() => {
          onConfirmed(result.paymentRecord);
        }, 1200);
      } else if (result.isFailed) {
        setStatus('FAILED');
        setErrorMessage(result.message || 'La transaction MonCash a échoué.');
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
  }, [paymentId, orderId, transactionReference, schoolId, onConfirmed, onFailed]);

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

  // Copie de l'Order ID dans le presse-papier
  const handleCopyOrderId = () => {
    if (orderId) {
      navigator.clipboard.writeText(orderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.info("Référence de commande copiée !");
    }
  };

  // Validation manuelle de secours si le parent montre son SMS Digicel
  const handleManualValidation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualSmsReference.trim()) {
      toast.error("Veuillez saisir le numéro de transaction Digicel présent sur le SMS.");
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
        setTimeout(() => {
          onConfirmed(res.paymentRecord);
        }, 1000);
      } else {
        toast.error("Erreur de validation manuelle : " + (res.error || 'Veuillez vérifier la référence.'));
      }
    } catch (err: any) {
      toast.error("Erreur inattendue : " + err.message);
    } finally {
      setIsSubmittingManual(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Barre d'accentuation MonCash (Rouge & Ambre officiel) */}
        <div className="h-2 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 w-full animate-pulse" />

        {/* Bouton de fermeture */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors z-10"
          title="Fermer la fenêtre d'attente"
        >
          <X size={18} />
        </button>

        <div className="p-5 sm:p-7">
          {/* ================================================================= */}
          {/* ÉTAT 1 : EN ATTENTE DE CONFIRMATION (POLLING TOUTES LES 5 SECONDES) */}
          {/* ================================================================= */}
          {status === 'PENDING' && (
            <div className="flex flex-col items-center text-center">
              {/* Animation radar / pulsation */}
              <div className="relative mb-5">
                <div className="absolute inset-0 rounded-full bg-amber-400/30 animate-ping" />
                <div className="absolute -inset-2 rounded-full bg-red-500/20 animate-pulse" />
                <div className="relative w-20 h-20 bg-gradient-to-tr from-red-600 to-amber-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/30">
                  <Smartphone size={36} className="animate-bounce" style={{ animationDuration: '2s' }} />
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-md">
                    <Radio size={16} className="text-red-600 animate-pulse" />
                  </div>
                </div>
              </div>

              {/* Titre & Statut */}
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200/80 rounded-full text-amber-800 text-xs font-black uppercase tracking-wider mb-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                Attente de confirmation MonCash
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Validation sur le téléphone du parent
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-sm">
                Le parent doit approuver la transaction en saisissant son code PIN secret sur son mobile Digicel.
              </p>

              {/* Carte récapitulative de la transaction */}
              <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-4 my-5 text-left space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Montant à régler</span>
                  <div className="text-right">
                    <span className="text-2xl font-black text-slate-900">
                      {Math.round(amount).toLocaleString()}
                    </span>
                    <span className="text-xs font-bold text-red-600 ml-1.5 uppercase">HTG (Gourdes)</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Élève concerné</span>
                    <span className="font-bold text-slate-800 truncate block">{studentName}</span>
                    {studentClass && (
                      <span className="text-[11px] text-slate-500">{studentClass}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Type de frais</span>
                    <span className="font-bold text-slate-800 truncate block">{feeTypeLabel}</span>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-200/60 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-slate-400 font-medium">ID Unique MonCash :</span>
                      <span className="font-mono font-bold text-slate-800 truncate">{orderId}</span>
                    </div>
                    <button
                      onClick={handleCopyOrderId}
                      className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors shrink-0"
                      title="Copier la référence"
                    >
                      {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    </button>
                  </div>

                  {initiatedAt && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium flex items-center gap-1">
                        <Clock size={12} className="text-amber-600" />
                        Date d'initiative :
                      </span>
                      <span className="font-mono font-semibold text-slate-700">
                        {new Date(initiatedAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/40">
                    <span className="text-slate-400 font-medium flex items-center gap-1">
                      <ShieldCheck size={12} className="text-amber-600" />
                      Statut Serveur :
                    </span>
                    <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                      EN ATTENTE DE VALIDATION
                    </span>
                  </div>
                </div>
              </div>

              {/* Barre de polling active (Synchronisation automatique toutes les 5s) */}
              <div className="w-full bg-amber-500/10 border border-amber-300/40 rounded-xl p-3 flex items-center justify-between text-xs text-amber-900 mb-4">
                <div className="flex items-center gap-2">
                  <RefreshCw 
                    size={15} 
                    className={`text-amber-600 ${isManualChecking ? 'animate-spin' : ''}`} 
                  />
                  <span>
                    Synchronisation automatique active <strong className="font-bold">({countdown}s)</strong>
                  </span>
                </div>
                <div className="text-[11px] text-amber-700/80 font-medium">
                  {checkCount > 0 ? `${checkCount} vérification${checkCount > 1 ? 's' : ''}` : 'En cours...'}
                </div>
              </div>

              {/* Liens et actions d'attente */}
              <div className="w-full space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => verifyStatus(true)}
                    disabled={isManualChecking}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    <RefreshCw size={15} className={isManualChecking ? 'animate-spin' : ''} />
                    <span>{isManualChecking ? 'Vérification...' : 'Vérifier maintenant'}</span>
                  </button>

                  {redirectUrl && (
                    <button
                      type="button"
                      onClick={() => window.open(redirectUrl, '_blank')}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs border border-red-200 transition-colors"
                      title="Ouvrir la passerelle web MonCash"
                    >
                      <ExternalLink size={14} />
                      <span className="hidden sm:inline">Page MonCash</span>
                    </button>
                  )}
                </div>

                {/* Bascule de validation manuelle par SMS */}
                {!showManualInput ? (
                  <button
                    type="button"
                    onClick={() => setShowManualInput(true)}
                    className="text-[11px] text-slate-500 hover:text-red-700 font-semibold underline underline-offset-2 py-1 transition-colors"
                  >
                    Le parent a déjà reçu le SMS Digicel ? Valider avec le N° de transaction
                  </button>
                ) : (
                  <form onSubmit={handleManualValidation} className="bg-slate-100/80 p-3 rounded-xl border border-slate-200 mt-2 text-left space-y-2">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      Numéro de Transaction reçu par SMS (ex: TRX-9821034)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={manualSmsReference}
                        onChange={(e) => setManualSmsReference(e.target.value.toUpperCase())}
                        placeholder="Ex: MC-8492019"
                        className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 uppercase outline-none focus:border-red-600 focus:ring-2 focus:ring-red-500/10"
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={isSubmittingManual || !manualSmsReference.trim()}
                        className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 shrink-0"
                      >
                        {isSubmittingManual ? 'Validation...' : 'Valider'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* ÉTAT 2 : TRANSACTION MONCASH CONFIRMÉE ET VALIDÉE AVEC SUCCÈS      */}
          {/* ================================================================= */}
          {status === 'COMPLETED' && (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20 animate-in zoom-in-50 duration-300">
                <CheckCircle2 size={36} className="animate-in zoom-in duration-300" />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-800 text-xs font-black uppercase tracking-wider mb-2">
                <Sparkles size={13} className="text-emerald-600" />
                Paiement Encaissé avec Succès
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Paiement MonCash Confirmé !
              </h2>

              <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-sm">
                Le compte de l'établissement a bien été crédité. La facture et le reçu officiel sont scellés.
              </p>

              <div className="w-full bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 my-5 text-left space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Montant validé</span>
                  <span className="font-black text-emerald-700 text-base">
                    {Math.round(amount).toLocaleString()} HTG
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Élève</span>
                  <span className="font-bold text-slate-800">{studentName}</span>
                </div>
                <div className="flex justify-between text-xs pt-2 border-t border-emerald-200/50">
                  <span className="text-slate-500 font-medium">Référence MonCash</span>
                  <span className="font-mono font-bold text-slate-900">
                    {confirmedPayment?.transaction_reference || orderId}
                  </span>
                </div>
              </div>

              {/* Mention SMS Parent pour sceller la confiance */}
              <div className="w-full mb-4 px-3 py-2 bg-indigo-50/80 border border-indigo-200/60 rounded-xl flex items-center gap-2.5 text-left">
                <MessageSquare size={16} className="text-indigo-600 shrink-0" />
                <p className="text-[11px] text-indigo-900 leading-tight">
                  <strong className="font-bold">Confirmation SMS :</strong> Le reçu et l'interface d'envoi du SMS personnalisé au parent sont prêts à l'écran.
                </p>
              </div>

              <button
                type="button"
                onClick={() => onConfirmed(confirmedPayment)}
                className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98]"
              >
                <Receipt size={16} />
                <span>Afficher et Imprimer le Reçu</span>
                <ArrowRight size={15} />
              </button>
            </div>
          )}

          {/* ================================================================= */}
          {/* ÉTAT 3 : ÉCHEC OU REJET DE LA TRANSACTION MONCASH                 */}
          {/* ================================================================= */}
          {status === 'FAILED' && (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-rose-500/20">
                <AlertCircle size={36} />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-200 rounded-full text-rose-800 text-xs font-black uppercase tracking-wider mb-2">
                Transaction Non Aboutie
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Échec du paiement MonCash
              </h2>

              <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-sm">
                {errorMessage || "Le paiement n'a pas pu être validé sur le compte MonCash du parent."}
              </p>

              <div className="w-full flex items-center gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setStatus('PENDING');
                    verifyStatus(true);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm transition-all"
                >
                  Réessayer la vérification
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm transition-all"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Pied de page informatif de sécurité */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Sécurisé par passerelle officielle Digicel MonCash</span>
          </div>
          {lastCheckTime && (
            <div className="flex items-center gap-1 text-slate-400">
              <Clock size={12} />
              <span>Dernière synchro : {lastCheckTime}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MonCashWaitingModal;
