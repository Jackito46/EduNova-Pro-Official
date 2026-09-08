import React, { useState, useEffect, useMemo } from 'react';
import { 
  MessageSquare, 
  Send, 
  Smartphone, 
  CheckCircle2, 
  RefreshCw, 
  Edit3, 
  Sparkles, 
  ShieldCheck, 
  Check, 
  Phone, 
  User, 
  Clock, 
  FileText,
  AlertCircle,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  generatePaymentSmsText, 
  sendPaymentConfirmationSms, 
  getSchoolSmsConfig,
  type SmsTemplateOptions 
} from '../services/paymentSmsService';

export interface PaymentSmsConfirmationProps {
  schoolId: string;
  schoolName: string;
  studentId: string;
  studentName: string;
  studentClass?: string;
  parentName?: string;
  defaultPhone?: string;
  amount: number;
  currency: string;
  feeTypeLabel: string;
  transactionRef: string;
  remainingAmount?: number;
  paymentMethod?: string;
  autoSendEnabled?: boolean;
  onSmsSent?: (result: { success: boolean; simulated?: boolean; phone: string }) => void;
  isOpen?: boolean;
  onClose?: () => void;
  isInline?: boolean; // Pour affichage direct intégré dans la page du reçu
}

export const PaymentSmsConfirmation: React.FC<PaymentSmsConfirmationProps> = ({
  schoolId,
  schoolName,
  studentId,
  studentName,
  studentClass,
  parentName,
  defaultPhone = '',
  amount,
  currency,
  feeTypeLabel,
  transactionRef,
  remainingAmount,
  paymentMethod,
  autoSendEnabled = false,
  onSmsSent,
  isOpen = true,
  onClose,
  isInline = false
}) => {
  const [phoneNumber, setPhoneNumber] = useState(defaultPhone);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [templateType, setTemplateType] = useState<'standard' | 'with_balance' | 'compact'>('standard');
  const [customText, setCustomText] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  
  const [isSending, setIsSending] = useState(false);
  const [sentStatus, setSentStatus] = useState<{
    sent: boolean;
    simulated?: boolean;
    timestamp?: string;
    phone?: string;
    provider?: string;
  } | null>(null);

  const [providerConfig, setProviderConfig] = useState<{ isConfigured: boolean; provider: string } | null>(null);

  // Charger la configuration de la passerelle SMS
  useEffect(() => {
    let isMounted = true;
    if (schoolId) {
      getSchoolSmsConfig(schoolId).then(cfg => {
        if (isMounted) setProviderConfig(cfg);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [schoolId]);

  // Synchroniser le numéro par défaut
  useEffect(() => {
    if (defaultPhone && !phoneNumber) {
      setPhoneNumber(defaultPhone);
    }
  }, [defaultPhone]);

  // Génération du texte actuel
  const templateParams: SmsTemplateOptions = useMemo(() => ({
    type: templateType,
    studentName,
    parentName,
    schoolName,
    amount,
    currency,
    feeTypeLabel,
    transactionRef,
    remainingAmount,
    studentClass
  }), [templateType, studentName, parentName, schoolName, amount, currency, feeTypeLabel, transactionRef, remainingAmount, studentClass]);

  const activeMessage = useMemo(() => {
    if (isCustomMode && customText.trim()) {
      return customText;
    }
    return generatePaymentSmsText(templateParams);
  }, [isCustomMode, customText, templateParams]);

  // Calcul du nombre de caractères et SMS
  const charCount = activeMessage.length;
  const smsCount = charCount <= 160 ? 1 : Math.ceil(charCount / 153);

  // Envoi effectif du SMS
  const handleSendSms = async () => {
    if (!phoneNumber || !phoneNumber.trim()) {
      toast.error("Veuillez renseigner un numéro de téléphone valide pour le parent.");
      setIsEditingPhone(true);
      return;
    }

    setIsSending(true);
    try {
      const result = await sendPaymentConfirmationSms({
        schoolId,
        studentId,
        studentName,
        parentName,
        parentPhone: phoneNumber.trim(),
        amount,
        currency,
        feeTypeLabel,
        transactionRef,
        schoolName,
        remainingAmount,
        studentClass,
        customMessage: activeMessage,
        paymentMethod
      });

      const nowStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      setSentStatus({
        sent: true,
        simulated: result.simulated,
        timestamp: nowStr,
        phone: phoneNumber.trim(),
        provider: result.provider
      });

      if (result.simulated) {
        toast.info("Simulation d'envoi SMS réussie !", {
          description: `SMS enregistré dans l'historique de l'école pour ${phoneNumber}. (Passerelle non configurée)`,
          duration: 5000
        });
      } else {
        toast.success("SMS de confirmation transmis au parent !", {
          description: `Message délivré avec succès au ${phoneNumber} via ${result.provider?.toUpperCase()}.`,
          duration: 6000
        });
      }

      if (onSmsSent) {
        onSmsSent({
          success: true,
          simulated: result.simulated,
          phone: phoneNumber.trim()
        });
      }
    } catch (err: any) {
      console.error("Erreur lors de l'envoi du SMS:", err);
      toast.error("Échec de l'envoi du SMS: " + (err.message || "Erreur réseau"));
    } finally {
      setIsSending(false);
    }
  };

  // Envoi automatique si l'option est pré-activée dès l'ouverture
  useEffect(() => {
    if (autoSendEnabled && phoneNumber && !sentStatus?.sent && !isSending) {
      handleSendSms();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSendEnabled]);

  if (!isOpen && !isInline) return null;

  const content = (
    <div className="space-y-4 text-left">
      {/* En-tête : Transparence & Confiance */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
            <MessageSquare size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                Confirmation SMS Parent
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                <ShieldCheck size={11} className="text-indigo-600" />
                Confiance
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Rassurez instantanément la famille avec un accusé de réception officiel sur son mobile.
            </p>
          </div>
        </div>

        {onClose && !isInline && (
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
            title="Fermer"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* DESTINATAIRE DU SMS */}
      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
            <User size={13} className="text-slate-400" />
            <span>Destinataire :</span>
            <span className="font-bold text-slate-800 truncate">
              {parentName && parentName.trim() ? parentName : `Parent de ${studentName}`}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Phone size={13} className="text-indigo-600" />
            {!isEditingPhone ? (
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {phoneNumber || <span className="text-amber-600 italic font-normal">Numéro non renseigné</span>}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingPhone(true)}
                  className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-200/60 transition-colors"
                  title="Modifier le numéro"
                >
                  <Edit3 size={13} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Ex: +509 3400 0000"
                  className="px-2.5 py-1 bg-white border border-indigo-400 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setIsEditingPhone(false)}
                  className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-[11px] font-bold hover:bg-indigo-700 transition-colors"
                >
                  OK
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Indicateur de passerelle */}
        <div className="shrink-0 flex items-center gap-1.5 text-[11px] text-slate-500 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200">
          <div className={`w-2 h-2 rounded-full ${providerConfig?.isConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
          <span>
            Passerelle : <strong className="font-bold text-slate-700 uppercase">{providerConfig?.isConfigured ? providerConfig.provider : 'Simulation'}</strong>
          </span>
        </div>
      </div>

      {/* SÉLECTEUR DE MODÈLE EN 1 CLIC */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
          Modèle de message
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => {
              setTemplateType('standard');
              setIsCustomMode(false);
            }}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center ${
              templateType === 'standard' && !isCustomMode
                ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Standard
          </button>
          <button
            type="button"
            onClick={() => {
              setTemplateType('with_balance');
              setIsCustomMode(false);
            }}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center ${
              templateType === 'with_balance' && !isCustomMode
                ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Avec Solde
          </button>
          <button
            type="button"
            onClick={() => {
              setTemplateType('compact');
              setIsCustomMode(false);
            }}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center ${
              templateType === 'compact' && !isCustomMode
                ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Court (1 SMS)
          </button>
        </div>
      </div>

      {/* APERÇU STYLE BULLE SMARTPHONE */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
            <Smartphone size={12} className="text-slate-400" />
            Aperçu SMS sur le mobile du parent
          </span>
          <button
            type="button"
            onClick={() => {
              if (!isCustomMode) {
                setCustomText(activeMessage);
              }
              setIsCustomMode(!isCustomMode);
            }}
            className="text-indigo-600 hover:text-indigo-800 font-bold transition-colors flex items-center gap-1"
          >
            <Edit3 size={11} />
            <span>{isCustomMode ? 'Restaurer modèle' : 'Personnaliser'}</span>
          </button>
        </div>

        {/* Cadre smartphone stylisé */}
        <div className="bg-slate-900 p-3.5 sm:p-4 rounded-2xl shadow-inner border border-slate-800">
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-2 border-b border-slate-800/80 pb-1.5">
            <span className="font-bold tracking-wider text-slate-300 truncate max-w-[180px]">
              {schoolName || 'DIRECTION'}
            </span>
            <span className="flex items-center gap-1 text-slate-500">
              <Clock size={10} />
              Maintenant
            </span>
          </div>

          {!isCustomMode ? (
            <div className="bg-gradient-to-br from-indigo-700 to-indigo-800 text-white p-3 rounded-2xl rounded-tl-sm text-xs sm:text-[13px] leading-relaxed shadow-md font-sans">
              {activeMessage}
            </div>
          ) : (
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              rows={4}
              className="w-full bg-slate-800 text-white p-3 rounded-xl text-xs sm:text-[13px] leading-relaxed border border-indigo-500/50 outline-none focus:ring-2 focus:ring-indigo-400 font-sans resize-none"
              placeholder="Saisissez votre message personnalisé..."
            />
          )}

          {/* Compteur de caractères & segments SMS */}
          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2.5 pt-1.5 border-t border-slate-800/60">
            <span>
              Longueur : <strong className="text-slate-200 font-mono font-bold">{charCount}</strong> caractères
            </span>
            <span className={`px-2 py-0.5 rounded-full font-bold font-mono text-[10px] ${
              smsCount === 1 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50' : 'bg-amber-950 text-amber-400 border border-amber-800/50'
            }`}>
              {smsCount} crédit{smsCount > 1 ? 's' : ''} SMS ({charCount <= 160 ? `${charCount}/160` : `${charCount}/306`})
            </span>
          </div>
        </div>
      </div>

      {/* ZONE D'ACTION / STATUT D'ENVOI */}
      {sentStatus?.sent ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center shrink-0">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-900">
                SMS de confirmation transmis avec succès !
              </p>
              <p className="text-[11px] text-emerald-700">
                Délivré au <strong className="font-mono">{sentStatus.phone}</strong> à {sentStatus.timestamp} {sentStatus.simulated && '(Mode test)'}.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSendSms}
            disabled={isSending}
            className="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-300 shadow-sm transition-all shrink-0 flex items-center gap-1.5"
          >
            <RefreshCw size={12} className={isSending ? 'animate-spin' : ''} />
            <span>Renvoyer</span>
          </button>
        </div>
      ) : (
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSendSms}
            disabled={isSending || !phoneNumber}
            className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Transmission via SmsModule en cours...</span>
              </>
            ) : (
              <>
                <Send size={16} />
                <span>Envoyer le SMS de confirmation au parent</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );

  if (isInline) {
    return (
      <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-200/80 transition-all print:hidden">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200/80 p-5 sm:p-7 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        {content}
      </div>
    </div>
  );
};

export default PaymentSmsConfirmation;
