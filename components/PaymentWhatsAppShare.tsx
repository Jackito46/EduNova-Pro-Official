import React, { useState, useMemo } from 'react';
import { 
  MessageSquare, 
  Send, 
  Smartphone, 
  CheckCircle2, 
  Copy, 
  Check, 
  Edit3, 
  Share2, 
  ExternalLink,
  Phone,
  User,
  ShieldCheck,
  RotateCcw
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
  isInline = true
}) => {
  const [phoneNumber, setPhoneNumber] = useState<string>(defaultPhone);
  const [isEditingPhone, setIsEditingPhone] = useState<boolean>(!defaultPhone);
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

  const handleShareWhatsApp = () => {
    const waUrl = cleanedPhone
      ? `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(activeMessage)}`
      : `https://wa.me/?text=${encodeURIComponent(activeMessage)}`;

    window.open(waUrl, '_blank');
    setHasShared(true);
    toast.success("WhatsApp ouvert avec le reçu pré-rempli !");
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

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-emerald-200/90 shadow-lg overflow-hidden transition-all my-4">
      {/* Header avec identité WhatsApp et Badge Gratuit */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white p-4 sm:p-5 relative overflow-hidden">
        {/* Éléments graphiques décoratifs subtils */}
        <div className="absolute top-0 right-0 transform translate-x-6 -translate-y-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none"></div>

        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white text-emerald-700 flex items-center justify-center font-black shadow-md shrink-0">
              <MessageSquare size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Partager le Reçu sur WhatsApp
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-400 text-emerald-950 shadow-xs flex items-center gap-1">
                  <ShieldCheck size={12} />
                  100% Gratuit (Sans Frais SMS)
                </span>
              </div>
              <p className="text-emerald-100 text-xs mt-0.5">
                Transmettez instantanément l'accusé de paiement officiel et certifié au parent sur son mobile.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* Ligne Destinataire & Numéro Téléphone */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <User size={18} />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold uppercase tracking-wider">
                <span>Destinataire</span>
                {parentName ? <span className="text-slate-700">({parentName})</span> : null}
              </div>
              
              {isEditingPhone ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="tel"
                    placeholder="Ex: 48324487 ou +509 48324487"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48 sm:w-56"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setIsEditingPhone(false)}
                    className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono font-black text-slate-900 text-sm">
                    {phoneNumber ? phoneNumber : <span className="text-amber-600 italic">Aucun numéro enregistré</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingPhone(true)}
                    className="p-1 text-slate-400 hover:text-emerald-600 rounded-md transition-colors"
                    title="Modifier le numéro WhatsApp"
                  >
                    <Edit3 size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={() => {
                if (!isCustomizingText) {
                  setCustomText(defaultMessage);
                }
                setIsCustomizingText(!isCustomizingText);
              }}
              className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Edit3 size={13} />
              <span>{isCustomizingText ? 'Aperçu Standard' : 'Personnaliser'}</span>
            </button>
            <button
              type="button"
              onClick={handleCopyMessage}
              className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
              <span>{copied ? 'Copié !' : 'Copier'}</span>
            </button>
          </div>
        </div>

        {/* Zone d'édition personnalisée si activée */}
        {isCustomizingText ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600">
              <span>Modifier le message avant envoi :</span>
              <button
                type="button"
                onClick={handleResetText}
                className="text-rose-600 hover:underline flex items-center gap-1"
              >
                <RotateCcw size={12} />
                Réinitialiser
              </button>
            </div>
            <textarea
              rows={6}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>
        ) : (
          /* Aperçu du Message style Bulle WhatsApp */
          <div className="bg-[#e5ddd5] dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 relative">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Smartphone size={13} />
                Aperçu du message reçu par le parent
              </span>
              <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-full text-[9px]">WhatsApp Direct</span>
            </div>

            <div className="bg-white text-slate-900 rounded-2xl p-3.5 shadow-sm max-w-lg font-sans text-xs sm:text-[12.5px] leading-relaxed relative whitespace-pre-line border border-slate-100">
              {activeMessage}
              <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 mt-2 font-mono">
                <span>{new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-emerald-600 font-bold">✓✓</span>
              </div>
            </div>
          </div>
        )}

        {/* Bouton d'action principal 1-clic */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="w-full sm:flex-1 py-3.5 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl sm:rounded-2xl font-black text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 active:scale-98 cursor-pointer"
          >
            <MessageSquare size={18} className="stroke-[2.5]" />
            <span>Partager le reçu sur WhatsApp</span>
            <ExternalLink size={15} className="opacity-80" />
          </button>

          {hasShared && (
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 rounded-xl">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>Message transmis avec succès vers WhatsApp !</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentWhatsAppShare;
