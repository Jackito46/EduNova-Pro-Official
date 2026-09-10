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
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import { MonCashWaitingModal } from './MonCashWaitingModal';
import { MonCashSummaryModal } from './MonCashSummaryModal';
import { useSchool } from '../contexts/SchoolContext';
import { getTerminology } from '../lib/terminology';

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

const PRESET_AMOUNTS = [250, 500, 1000, 2500, 5000];

export const StudentWalletTopUpModal: React.FC<StudentWalletTopUpModalProps> = ({
  isOpen,
  onClose,
  student,
  schoolName = 'Établissement Scolaire',
  schoolId,
  onSuccess
}) => {
  let contextTerminology = null;
  try {
    const schoolCtx = useSchool();
    contextTerminology = schoolCtx?.terminology;
  } catch {
    // Graceful fallback
  }
  const terminology = contextTerminology || getTerminology();

  const [selectedAmount, setSelectedAmount] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);
  const [phone, setPhone] = useState(student.parent_phone?.replace(/\D/g, '') || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // État du modal récapitulatif avant confirmation finale MonCash
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // État du modal d'attente MonCash
  const [isWaitingModalOpen, setIsWaitingModalOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string>('');
  const [activePaymentId, setActivePaymentId] = useState<string>('');
  const [activeTransactionRef, setActiveTransactionRef] = useState<string>('');
  const [confirmedPayment, setConfirmedPayment] = useState<any | null>(null);
  const [completedBalance, setCompletedBalance] = useState<number | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  if (!isOpen) return null;

  const effectiveAmount = isCustom ? (parseFloat(customAmount) || 0) : selectedAmount;
  const currentBalance = student.wallet_balance_htg || 0;
  const projectedBalance = currentBalance + effectiveAmount;
  const effectiveSchoolId = schoolId || student.school_id;

  // Formater le numéro de téléphone pour Digicel Haïti
  const cleanPhone = phone.replace(/\D/g, '');
  const displayPhone = cleanPhone.startsWith('509') ? cleanPhone.slice(3) : cleanPhone;

  // 1. Étape de vérification pré-paiement : Contrôle de l'élève
  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (effectiveAmount < 25) {
      setError('Le montant minimum de recharge MonCash est de 25 HTG.');
      return;
    }

    if (displayPhone.length < 8) {
      setError('Veuillez saisir un numéro MonCash valide (ex: 37123456 ou 48123456).');
      return;
    }

    setShowSummaryModal(true);
  };

  // 2. Lancer la demande réelle de recharge MonCash après confirmation
  const executeTopUp = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      // 1. Générer une référence de commande unique pour la recharge
      const timestamp = Date.now();
      const orderId = `WLT-${student.reference_number || student.id.slice(0, 6)}-${timestamp}`.toUpperCase();

      // 2. Créer l'enregistrement de paiement prévisionnel en attente
      const { data: paymentRecord, error: insertErr } = await supabase
        .from('payments')
        .insert([{
          school_id: effectiveSchoolId,
          student_id: student.id,
          amount: effectiveAmount,
          amount_htg_equivalent: effectiveAmount,
          currency: 'HTG',
          fee_type: 'CREDIT_PORTEFEUILLE',
          payment_method: 'MonCash',
          status: 'EN_ATTENTE',
          order_id: orderId,
          transaction_reference: orderId,
          notes: `Recharge Portefeuille Élève MonCash (${student.first_name} ${student.last_name}) | Tél: ${displayPhone}`,
          payment_date: new Date().toISOString().split('T')[0]
        }])
        .select()
        .single();

      if (insertErr) {
        console.warn('Erreur insertion paiement (poursuite en mode direct):', insertErr);
      }

      setActiveOrderId(orderId);
      setActivePaymentId(paymentRecord?.id || orderId);
      setActiveTransactionRef(orderId);

      // 3. Appel de l'API MonCash côté serveur pour déclencher le paiement
      try {
        const response = await fetch('/api/moncash/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: effectiveAmount,
            orderId,
            schoolId: effectiveSchoolId,
            payerPhone: displayPhone,
            description: `Recharge Portefeuille ${student.first_name} ${student.last_name}`
          })
        });

        const data = await response.json();
        if (data.redirect_url) {
          // Si l'API renvoie un lien direct MonCash
          console.log('[MonCash TopUp] Redirection MonCash reçue:', data.redirect_url);
        }
      } catch (apiErr) {
        console.warn('[MonCash TopUp] API serveur en mode veille, bascule sur surveillance polling:', apiErr);
      }

      // 4. Ouvrir la modale d'attente MonCash avec détection en temps réel
      setIsWaitingModalOpen(true);
    } catch (err: any) {
      console.error('Erreur lancement recharge portefeuille:', err);
      setError(err?.message || 'Impossible de lancer la requête MonCash.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Traitement du succès de la recharge
  const handlePaymentConfirmed = async (payment: any) => {
    setIsWaitingModalOpen(false);
    const newBal = currentBalance + effectiveAmount;
    setCompletedBalance(newBal);
    setConfirmedPayment(payment || { transaction_reference: activeOrderId });

    // Mise à jour immédiate du solde de l'élève dans la base Supabase
    try {
      await supabase
        .from('students')
        .update({
          wallet_balance_htg: newBal,
          updated_at: new Date().toISOString()
        })
        .eq('id', student.id);
    } catch (updateErr) {
      console.warn('Avertissement mise à jour solde local:', updateErr);
    }

    toast.success(`Portefeuille rechargé avec succès : +${effectiveAmount.toLocaleString()} HTG !`);
    if (onSuccess) {
      onSuccess(newBal, payment);
    }
  };

  // Partage instantané du reçu sur WhatsApp (100% GRATUIT)
  const handleShareWhatsApp = () => {
    const studentFullName = `${student.first_name} ${student.last_name}`;
    const ref = confirmedPayment?.transaction_reference || activeOrderId;
    const finalBal = completedBalance ?? projectedBalance;

    const message = `*REÇU DE RECHARGE PORTEFEUILLE ÉLÈVE* 👛📲
------------------------------------
*Établissement* : ${schoolName}
*Élève* : ${studentFullName} ${student.class_name ? `(${student.class_name})` : ''}
*Matricule* : ${student.reference_number || 'N/A'}
*Montant Rechargé* : +${effectiveAmount.toLocaleString()} HTG
*Nouveau Solde Badge* : ${finalBal.toLocaleString()} HTG
*Moyen* : Digicel MonCash
*Réf. Transaction* : ${ref}
*Date* : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
------------------------------------
_Ce crédit est disponible immédiatement à la cantine et à l'économat de l'école via le badge de l'élève._`;

    const encodedMessage = encodeURI(message);
    const targetPhone = displayPhone.length >= 8 ? `509${displayPhone}` : '';
    const whatsappUrl = targetPhone 
      ? `https://wa.me/${targetPhone}?text=${encodedMessage}`
      : `https://api.whatsapp.com/send?text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyRef = () => {
    const ref = confirmedPayment?.transaction_reference || activeOrderId;
    if (ref) {
      navigator.clipboard.writeText(ref);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
      toast.success('Référence copiée !');
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
        <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
          {/* Entête avec dégradé MonCash Rouge */}
          <div className="relative px-5 py-4 bg-gradient-to-r from-red-600 via-red-700 to-rose-700 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner">
                <Wallet size={22} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                    Digicel MonCash
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

          {/* Contenu principal */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
            {/* Si confirmation terminée */}
            {completedBalance !== null ? (
              <div className="text-center py-3 space-y-4 animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 size={36} />
                </div>

                <div>
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-800 text-xs font-black uppercase tracking-wider mb-1">
                    <Sparkles size={12} className="text-emerald-600" />
                    Recharge Réussie
                  </span>
                  <h4 className="text-xl font-black text-slate-900 tracking-tight">
                    +{effectiveAmount.toLocaleString()} HTG crédités !
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Le portefeuille de {student.first_name} est immédiatement disponible pour les achats.
                  </p>
                </div>

                {/* Carte de solde actualisé */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Ancien solde</span>
                    <span className="font-mono text-slate-600">{currentBalance.toLocaleString()} HTG</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-emerald-600 font-bold">Recharge MonCash</span>
                    <span className="font-mono font-black text-emerald-600">+{effectiveAmount.toLocaleString()} HTG</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-800">Nouveau Solde Disponible</span>
                    <span className="text-lg font-black text-slate-900 font-mono">
                      {completedBalance.toLocaleString()} HTG
                    </span>
                  </div>
                </div>

                {/* Actions de partage gratuites */}
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <Share2 size={16} />
                    <span>Envoyer le Reçu par WhatsApp (0 HTG)</span>
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCopyRef}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer border border-slate-200"
                    >
                      {copiedRef ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      <span>{copiedRef ? 'Copié !' : 'Copier Réf.'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer"
                    >
                      Fermer
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePreSubmit} className="space-y-4">
                {/* Récapitulatif de l'élève & Solde actuel */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-wide">Élève Bénéficiaire</p>
                    <h4 className="text-sm font-black text-slate-900 truncate">
                      {student.first_name} {student.last_name}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {student.class_name || 'Classe'} {student.reference_number ? `• Matr: ${student.reference_number}` : ''}
                    </p>
                  </div>

                  <div className="text-right shrink-0 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Solde Actuel</span>
                    <span className="text-sm font-black text-emerald-600 font-mono">
                      {currentBalance.toLocaleString()} HTG
                    </span>
                  </div>
                </div>

                {/* Sélection rapide du montant en Gourdes */}
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wide">
                    Montant de la recharge (HTG)
                  </label>

                  <div className="grid grid-cols-3 gap-2">
                    {PRESET_AMOUNTS.map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setSelectedAmount(amt);
                          setIsCustom(false);
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                          !isCustom && selectedAmount === amt
                            ? 'bg-red-600 text-white border-red-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {amt.toLocaleString()} G
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setIsCustom(true)}
                      className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                        isCustom
                          ? 'bg-red-600 text-white border-red-600 shadow-sm'
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
                          placeholder="Entrez le montant en Gourdes (ex: 750)"
                          min="25"
                          step="25"
                          autoFocus
                          className="w-full px-3.5 py-2.5 bg-white border border-red-300 rounded-xl text-sm font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-red-500/20"
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                          HTG
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Saisie du numéro MonCash */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wide">
                    Numéro MonCash du payeur
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-400">
                      <Smartphone size={16} />
                      <span className="text-xs font-bold text-slate-600">+509</span>
                    </div>
                    <input
                      type="tel"
                      value={displayPhone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="37123456 ou 48123456"
                      maxLength={8}
                      className="w-full pl-20 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-500/10"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Info size={12} className="shrink-0 text-slate-400" />
                    Le parent recevra l'invite PIN MonCash directement sur ce numéro.
                  </p>
                </div>

                {/* Projection du solde après recharge */}
                {effectiveAmount > 0 && (
                  <div className="p-3 bg-red-50/60 border border-red-200/70 rounded-2xl flex items-center justify-between text-xs">
                    <div>
                      <span className="text-red-900 font-bold block">Solde après recharge</span>
                      <span className="text-[11px] text-red-700">Cantine & Fournitures scolaires</span>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black text-red-700 font-mono">
                        {projectedBalance.toLocaleString()} HTG
                      </span>
                      <span className="text-[10px] text-red-600 block font-bold">
                        (+{effectiveAmount.toLocaleString()} G)
                      </span>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                    <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Bouton de confirmation MonCash */}
                <button
                  type="submit"
                  disabled={isSubmitting || effectiveAmount <= 0}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-black text-sm shadow-lg shadow-red-600/25 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Connexion MonCash...</span>
                    </>
                  ) : (
                    <>
                      <Wallet size={16} />
                      <span>Vérifier & Recharger {effectiveAmount > 0 ? `${effectiveAmount.toLocaleString()} HTG` : ''} via MonCash</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>

                {/* Mention de sécurité */}
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium">
                  <ShieldCheck size={13} className="text-emerald-600" />
                  <span>Transaction sécurisée par chiffrement bancaire MonCash</span>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Modal récapitulatif anti-erreur avant confirmation finale */}
      <MonCashSummaryModal
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        onConfirm={() => {
          setShowSummaryModal(false);
          executeTopUp();
        }}
        isSubmitting={isSubmitting}
        student={{
          id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          reference_number: student.reference_number,
          class_name: student.class_name,
          parent_name: student.parent_name,
          parent_phone: student.parent_phone
        }}
        feeLabel={`Recharge Portefeuille ${terminology.student}`}
        feeCategory="Portefeuille"
        amount={effectiveAmount}
        currency="HTG"
        payerPhone={displayPhone}
        schoolName={schoolName}
        terminology={terminology}
      />

      {/* Modal de suivi d'attente MonCash en temps réel */}
      {isWaitingModalOpen && (
        <MonCashWaitingModal
          isOpen={isWaitingModalOpen}
          onClose={() => setIsWaitingModalOpen(false)}
          paymentId={activePaymentId}
          orderId={activeOrderId}
          transactionReference={activeTransactionRef}
          amount={effectiveAmount}
          currency="HTG"
          studentName={`${student.first_name} ${student.last_name}`}
          studentCode={student.reference_number}
          studentClass={student.class_name}
          feeTypeLabel="Recharge Portefeuille Élève"
          payerPhone={displayPhone}
          schoolId={effectiveSchoolId}
          onConfirmed={handlePaymentConfirmed}
          onFailed={(err) => {
            setIsWaitingModalOpen(false);
            setError(err || 'Échec du paiement MonCash.');
          }}
          onCancelled={() => {
            setIsWaitingModalOpen(false);
            setIsSubmitting(false);
            toast.info("Recharge MonCash annulée.");
          }}
        />
      )}
    </>
  );
};
