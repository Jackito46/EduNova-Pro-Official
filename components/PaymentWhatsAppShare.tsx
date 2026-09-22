import React, { useState, useMemo } from 'react';
import { 
  MessageSquare, 
  Send, 
  Smartphone, 
  CheckCircle2, 
  Copy, 
  Check, 
  Edit3, 
  ExternalLink,
  Phone,
  User,
  ShieldCheck,
  RotateCcw,
  X
} from 'lucide-react';
import { toast } from 'sonner';

export interface PaymentWhatsAppShareProps {
  schoolName: string;
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
  isInline?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

/**
 * Nettoie et formate le numéro pour l'URL wa.me
 * En Haïti, les numéros locaux comportent 8 chiffres (ex: 48324487).
 * On leur préfixe '509' si l'indicatif pays est omis.
 */
export const cleanPhoneForWhatsApp = (rawPhone: string): string => {
  if (!rawPhone) return '';
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 8) {
    return `509${digits}`;
  }
  return digits;
};

/**
 * Génère le texte pré-formaté avec Markdown WhatsApp et émojis
 */
export const buildPaymentWhatsAppText = (params: {
  schoolName: string;
  studentName: string;
  studentClass?: string;
  parentName?: string;
  amount: number;
  currency: string;
  feeTypeLabel: string;
  transactionRef: string;
  remainingAmount?: number;
  paymentMethod?: string;
}): string => {
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const salutation = params.parentName?.trim() ? `Bonjour *${params.parentName.trim()}*,` : 'Bonjour,';
  const classStr = params.studentClass ? ` (${params.studentClass})` : '';
  const methodStr = params.paymentMethod ? `\n💳 *Mode de règlement :* ${params.paymentMethod}` : '';
  
  let remainingStr = '';
  if (params.remainingAmount !== undefined) {
    if (params.remainingAmount > 0) {
      remainingStr = `\n💵 *Solde restant dû :* ${params.remainingAmount.toLocaleString()} ${params.currency}`;
    } else if (params.remainingAmount === 0) {
      remainingStr = `\n🎉 *Solde restant :* 0 ${params.currency} (Scolarité à jour)`;
    }
  }

  return `🎓 *${params.schoolName.toUpperCase()}*
━━━━━━━━━━━━━━━━━━━━━━━━
🧾 *CONFIRMATION OFFICIELLE DE PAIEMENT*

${salutation}
Nous vous confirmons la bonne réception du versement effectué pour votre enfant :

👤 *Élève :* ${params.studentName}${classStr}
💰 *Montant versé :* ${params.amount.toLocaleString()} ${params.currency}
🏷️ *Motif :* ${params.feeTypeLabel}${methodStr}
🔢 *Reçu N° :* #${params.transactionRef}
📅 *Date :* ${dateStr} à ${timeStr}${remainingStr}

━━━━━━━━━━━━━━━━━━━━━━━━
✅ *Règlement certifié par l'administration.*
Merci de votre confiance et bonne année académique !`;
};

export const PaymentWhatsAppShare: React.FC<PaymentWhatsAppShareProps> = ({
  schoolName,
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
  isInline = false,
  isOpen = true,
  onClose
}) => {
  const [phoneNumber, setPhoneNumber] = useState<string>(defaultPhone);
  const [isCustomizingText, setIsCustomizingText] = useState<boolean>(false);
  const [customText, setCustomText] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [hasShared, setHasShared] = useState<boolean>(false);

  // Génération automatique du message par défaut
  const defaultMessage = useMemo(() => {
    return buildPaymentWhatsAppText({
      schoolName: schoolName || 'Établissement Scolaire',
      studentName,
      studentClass,
      parentName,
      amount,
      currency,
      feeTypeLabel,
      transactionRef,
      remainingAmount,
      paymentMethod
    });
  }, [schoolName, studentName, studentClass, parentName, amount, currency, feeTypeLabel, transactionRef, remainingAmount, paymentMethod]);

  const activeMessage = isCustomizingText && customText ? customText : defaultMessage;
  const cleanedPhone = useMemo(() => cleanPhoneForWhatsApp(phoneNumber), [phoneNumber]);

  if (!isOpen) return null;

  const handleShareWhatsApp = () => {
    const waUrl = cleanedPhone
      ? `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(activeMessage)}`
      : `https://wa.me/?text=${encodeURIComponent(activeMessage)}`;

    window.open(waUrl, '_blank');
    setHasShared(true);
    toast.success("WhatsApp ouvert avec le reçu officiel pré-rempli !");
    if (onClose) {
      setTimeout(() => {
        onClose();
      }, 1200);
    }
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(activeMessage);
      setCopied(true);
      toast.success("Message copié dans le presse-papier !");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Impossible de copier automatiquement le texte");
    }
  };

  const handleResetText = () => {
    setCustomText('');
    setIsCustomizingText(false);
    toast.info("Message réinitialisé au format standard");
  };

  const content = (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden transition-all w-full max-w-lg">
      {/* Header avec identité WhatsApp et Badge Gratuit */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white p-4 sm:p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 transform translate-x-6 -translate-y-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none"></div>

        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white text-emerald-700 flex items-center justify-center font-black shadow-md shrink-0">
              <MessageSquare size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Partager le Reçu WhatsApp
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-400 text-emerald-950 shadow-xs flex items-center gap-1">
                  <ShieldCheck size={11} />
                  100% Gratuit
                </span>
              </div>
              <p className="text-emerald-100 text-xs mt-0.5">
                Vérifiez le numéro destinataire avant transmission directe au parent.
              </p>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/15 rounded-xl transition-all cursor-pointer shrink-0"
              title="Fermer"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* Vérification et Saisie du Numéro Destinataire */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
              <Phone size={14} className="text-emerald-600" />
              <span>Numéro WhatsApp du parent</span>
            </label>
            {parentName && (
              <span className="text-[11px] font-semibold text-slate-500 truncate max-w-[200px]" title={parentName}>
                👤 {parentName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="tel"
                placeholder="Ex: 3887-3523 ou +509 3887 3523"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full pl-3.5 pr-3 py-2.5 bg-white border-2 border-emerald-300 focus:border-emerald-500 rounded-xl text-sm font-bold text-slate-900 font-mono focus:outline-none focus:ring-3 focus:ring-emerald-100 transition-all"
                autoFocus
              />
            </div>
            {cleanedPhone && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-2.5 rounded-xl whitespace-nowrap hidden sm:inline-block">
                +{cleanedPhone}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Élève : <strong className="text-slate-800">{studentName}</strong> {studentClass ? `(${studentClass})` : ''}</span>
            <span>Montant : <strong className="text-emerald-700 font-mono">{amount.toLocaleString()} {currency}</strong></span>
          </div>
        </div>

        {/* Barre d'outils Message : Personnaliser / Copier */}
        <div className="flex items-center justify-between text-xs pt-1">
          <span className="font-bold text-slate-700 flex items-center gap-1.5">
            <Smartphone size={13} className="text-slate-500" />
            {isCustomizingText ? 'Modifier le texte :' : 'Aperçu du reçu formaté :'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!isCustomizingText) {
                  setCustomText(defaultMessage);
                }
                setIsCustomizingText(!isCustomizingText);
              }}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <Edit3 size={12} />
              <span>{isCustomizingText ? 'Format standard' : 'Personnaliser'}</span>
            </button>
            <button
              type="button"
              onClick={handleCopyMessage}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
              <span>{copied ? 'Copié !' : 'Copier'}</span>
            </button>
          </div>
        </div>

        {/* Zone d'édition ou Aperçu du Message WhatsApp */}
        {isCustomizingText ? (
          <div className="space-y-1.5">
            <textarea
              rows={6}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all leading-relaxed"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleResetText}
                className="text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw size={11} />
                Réinitialiser au reçu original
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-[#e5ddd5] dark:bg-slate-900 p-3 sm:p-3.5 rounded-2xl border border-slate-200 max-h-44 overflow-y-auto custom-scrollbar">
            <div className="bg-white text-slate-900 rounded-xl p-3 shadow-xs font-sans text-xs leading-relaxed whitespace-pre-line border border-slate-100">
              {activeMessage}
              <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 mt-1 font-mono">
                <span>{new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-emerald-600 font-bold">✓✓</span>
              </div>
            </div>
          </div>
        )}

        {/* Boutons d'actions */}
        <div className="pt-2 flex items-center gap-2.5">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
            >
              Fermer
            </button>
          )}

          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-black text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
          >
            <MessageSquare size={16} className="stroke-[2.5]" />
            <span>Envoyer sur WhatsApp</span>
            <ExternalLink size={14} className="opacity-80" />
          </button>
        </div>

        {hasShared && (
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-xl animate-in fade-in">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span>WhatsApp ouvert ! Le parent recevra ce reçu certifié.</span>
          </div>
        )}
      </div>
    </div>
  );

  if (isInline) {
    return content;
  }

  // Modal mode avec backdrop
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200 print:hidden">
      {content}
    </div>
  );
};

export default PaymentWhatsAppShare;
