import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  X, 
  Lock, 
  Eye, 
  EyeOff, 
  Receipt, 
  Calendar, 
  Check, 
  Clock,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabase';

interface MonCashStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: any;
  schoolId: string;
  activeYear?: any;
  existingPayments?: any[];
  preselectedPayment?: any;
  onSuccess: (result: any) => void;
}

export const MonCashStatusModal: React.FC<MonCashStatusModalProps> = ({
  isOpen,
  onClose,
  student,
  schoolId,
  activeYear,
  existingPayments = [],
  preselectedPayment,
  onSuccess
}) => {
  // Filtrer les paiements MonCash existants
  const moncashPayments = existingPayments.filter(p => 
    p.status !== 'ANNULE' && (
      (p.payment_method || '').toLowerCase().includes('moncash') ||
      (p.method || '').toLowerCase().includes('moncash') ||
      Boolean(p.moncash_order_id)
    )
  );

  const pendingPayments = moncashPayments.filter(p => 
    p.status === 'EN_ATTENTE' || 
    p.moncash_status === 'PENDING' || 
    p.status === 'PENDING'
  );

  const [selectedPaymentId, setSelectedPaymentId] = useState<string>('');
  const [manualOrderId, setManualOrderId] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [isManualEntry, setIsManualEntry] = useState<boolean>(false);
  const [manualAmount, setManualAmount] = useState<string>('');
  const [manualFeeType, setManualFeeType] = useState<string>('SCOLARITE');
  
  const [loading, setLoading] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialisation lors de l'ouverture ou changement de paiement présélectionné
  useEffect(() => {
    if (isOpen) {
      setValidationResult(null);
      setErrorMessage(null);
      setPin('');
      setShowPin(false);

      if (preselectedPayment) {
        setSelectedPaymentId(preselectedPayment.id);
        setManualOrderId(preselectedPayment.moncash_order_id || preselectedPayment.reference_number || '');
        setIsManualEntry(false);
      } else if (pendingPayments.length > 0) {
        setSelectedPaymentId(pendingPayments[0].id);
        setManualOrderId(pendingPayments[0].moncash_order_id || pendingPayments[0].reference_number || '');
        setIsManualEntry(false);
      } else if (moncashPayments.length > 0) {
        setSelectedPaymentId(moncashPayments[0].id);
        setManualOrderId(moncashPayments[0].moncash_order_id || moncashPayments[0].reference_number || '');
        setIsManualEntry(false);
      } else {
        setSelectedPaymentId('');
        setManualOrderId('');
        setIsManualEntry(true);
      }
    }
  }, [isOpen, preselectedPayment]);

  if (!isOpen) return null;

  const currentSelectedPayment = moncashPayments.find(p => p.id === selectedPaymentId);

  // Validation et appel RPC vers Supabase
  const handleVerifyStatusAndConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedPin = pin.trim();
    if (!trimmedPin) {
      setErrorMessage('Veuillez saisir le code PIN MonCash (4 à 6 chiffres).');
      return;
    }

    if (!/^[0-9]{4,6}$/.test(trimmedPin)) {
      setErrorMessage('Le code PIN MonCash doit comporter entre 4 et 6 chiffres numériques.');
      return;
    }

    const orderIdToVerify = isManualEntry 
      ? manualOrderId.trim() 
      : (currentSelectedPayment?.moncash_order_id || currentSelectedPayment?.reference_number || manualOrderId.trim());

    if (!isManualEntry && !selectedPaymentId && !orderIdToVerify) {
      setErrorMessage('Veuillez sélectionner une transaction ou saisir un N° d’ordre MonCash.');
      return;
    }

    if (isManualEntry && !orderIdToVerify && (!manualAmount || Number(manualAmount) <= 0)) {
      setErrorMessage('Veuillez renseigner le N° de commande MonCash ou un montant valide en HTG.');
      return;
    }

    try {
      setLoading(true);

      const rpcPayload: any = {
        p_pin: trimmedPin,
        p_student_id: student?.id || null,
        p_school_id: schoolId || null,
        p_order_id: orderIdToVerify || null,
        p_payment_id: (!isManualEntry && selectedPaymentId) ? selectedPaymentId : null,
        p_amount: isManualEntry && manualAmount ? Number(manualAmount) : null,
        p_fee_type: isManualEntry ? manualFeeType : null,
        p_currency: 'HTG'
      };

      console.log('Appel RPC Supabase verify_moncash_payment_status avec:', rpcPayload);

      const { data, error } = await supabase.rpc('verify_moncash_payment_status', rpcPayload);

      if (error) {
        console.error('Erreur RPC Supabase verify_moncash_payment_status:', error);
        throw new Error(error.message || 'Erreur lors de la communication avec la fonction RPC Supabase.');
      }

      console.log('Résultat RPC MonCash:', data);

      if (!data || data.success === false) {
        setErrorMessage(data?.message || 'Échec de la validation de la transaction MonCash.');
        toast.error(data?.message || 'Erreur de validation MonCash.');
        return;
      }

      // Succès
      setValidationResult(data);
      toast.success(data.message || 'Paiement MonCash validé et confirmé avec succès !');
      onSuccess(data);
    } catch (err: any) {
      console.error('Erreur vérification statut MonCash:', err);
      setErrorMessage(err?.message || 'Une erreur inattendue est survenue lors de la vérification.');
      toast.error(err?.message || 'Erreur lors de la vérification MonCash.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Entête Stylisé Digicel MonCash */}
        <div className="bg-gradient-to-r from-red-600 via-red-700 to-rose-700 px-6 py-4 text-white relative flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/20 shadow-inner">
              <Smartphone size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base tracking-tight leading-none text-white">
                  Vérifier Statut MonCash
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 text-white px-2 py-0.5 rounded-full border border-white/20">
                  RPC Temps Réel
                </span>
              </div>
              <p className="text-xs text-red-100 font-medium mt-1">
                Validation du code PIN et confirmation immédiate auprès de Digicel
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 active:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
            title="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corps du formulaire */}
        <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar">
          {/* Dossier Élève */}
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/70 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Dossier Élève</span>
              <span className="font-bold text-slate-800 text-sm">
                {student?.first_name} {student?.last_name}
              </span>
              <span className="text-slate-500 text-[11px] block mt-0.5">
                Classe : <strong className="text-slate-700">{student?.class?.name || student?.class_id || 'N/A'}</strong>
                {student?.reference_number && ` • Réf: #${student.reference_number}`}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Année Scolaire</span>
              <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 text-xs inline-block">
                {activeYear?.label || 'En cours'}
              </span>
            </div>
          </div>

          {/* Écran de Succès si validé */}
          {validationResult && validationResult.success ? (
            <div className="space-y-4 py-2 text-center animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl mx-auto flex items-center justify-center shadow-inner border border-emerald-200">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-900">Transaction MonCash Confirmée !</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Le code PIN a été validé et le versement a été scellé en direct dans Supabase. Le solde de l'élève est actualisé.
                </p>
              </div>

              <div className="bg-emerald-50/70 rounded-2xl p-4 border border-emerald-200/80 text-left space-y-2.5 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 font-sans">Statut Supabase :</span>
                  <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded uppercase text-[11px]">
                    {validationResult.status || 'VALIDE'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 font-sans">Statut MonCash :</span>
                  <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded uppercase text-[11px]">
                    {validationResult.moncash_status || 'COMPLETED'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 font-sans">Montant Confirmé :</span>
                  <span className="font-black text-slate-900 text-sm">
                    {Number(validationResult.amount || 0).toLocaleString()} {validationResult.currency || 'HTG'}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-emerald-200/60 pt-2">
                  <span className="text-slate-600 font-sans">Réf. Transaction Digicel :</span>
                  <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                    {validationResult.transaction_id || validationResult.order_id || 'N/A'}
                  </span>
                </div>
                {validationResult.order_id && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-sans">N° Commande :</span>
                    <span className="text-slate-700 text-[11px]">
                      {validationResult.order_id}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 px-4 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer shadow-sm"
                >
                  Fermer et consulter les finances actualisées
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleVerifyStatusAndConfirm} className="space-y-4">
              {/* Message d'erreur s'il y a lieu */}
              {errorMessage && (
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-700 text-xs flex items-start gap-2 animate-in fade-in duration-150">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Échec de la validation</strong>
                    <span>{errorMessage}</span>
                  </div>
                </div>
              )}

              {/* Sélection du mode : Transaction existante ou Saisie manuelle */}
              {moncashPayments.length > 0 && (
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setIsManualEntry(false)}
                    className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all cursor-pointer ${
                      !isManualEntry 
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Transactions Détectées ({moncashPayments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsManualEntry(true)}
                    className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all cursor-pointer ${
                      isManualEntry 
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Autre Réf / N° de Commande
                  </button>
                </div>
              )}

              {/* Liste des transactions MonCash existantes */}
              {!isManualEntry && moncashPayments.length > 0 ? (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Sélectionner la transaction à vérifier :
                  </label>
                  <div className="max-h-48 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                    {moncashPayments.map(p => {
                      const isSelected = p.id === selectedPaymentId;
                      const isPending = p.status === 'EN_ATTENTE' || p.moncash_status === 'PENDING';
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedPaymentId(p.id);
                            setManualOrderId(p.moncash_order_id || p.reference_number || '');
                          }}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                            isSelected 
                              ? 'border-red-500 bg-red-50/60 shadow-xs ring-1 ring-red-400' 
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected ? 'border-red-600 bg-red-600 text-white' : 'border-slate-300'
                            }`}>
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                <span>{p.nature || p.fee_type || 'Scolarité'}</span>
                                {isPending ? (
                                  <span className="text-[9px] font-bold uppercase bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded">
                                    En Attente PIN
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                                    {p.status || 'VALIDE'}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                Ordre: <span className="text-slate-700">{p.moncash_order_id || p.reference_number || 'Auto'}</span>
                                {p.date && ` • ${new Date(p.date).toLocaleDateString('fr-FR')}`}
                              </div>
                            </div>
                          </div>

                          <div className="text-right font-mono shrink-0">
                            <span className="font-bold text-slate-900 block text-xs">
                              {Number(p.amount || 0).toLocaleString()} {p.currency || 'HTG'}
                            </span>
                            <span className="text-[10px] text-red-600 font-bold">
                              MonCash
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Saisie manuelle de l'ordre MonCash si sélectionné ou si aucune transaction */}
              {(isManualEntry || moncashPayments.length === 0) && (
                <div className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      N° de Commande ou Référence MonCash
                    </label>
                    <input
                      type="text"
                      value={manualOrderId}
                      onChange={(e) => setManualOrderId(e.target.value)}
                      placeholder="Ex: MC-20260910-482910 ou 982341..."
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-slate-800 font-mono text-xs focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Indiquez la référence reçue par SMS ou affichée lors du transfert MonCash.
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Montant (HTG)
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={manualAmount}
                        onChange={(e) => setManualAmount(e.target.value)}
                        placeholder="Ex: 5000"
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-slate-800 font-mono text-xs focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Type de Frais
                      </label>
                      <select
                        value={manualFeeType}
                        onChange={(e) => setManualFeeType(e.target.value)}
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-slate-800 text-xs focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
                      >
                        <option value="SCOLARITE">Scolarité (Écolage)</option>
                        <option value="INSCRIPTION">Admission / Inscription</option>
                        <option value="DIVERS">Frais Divers</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Champ Saisie Code PIN MonCash */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Lock size={13} className="text-red-600" />
                    Code PIN de Validation MonCash (4 à 6 chiffres) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                  >
                    {showPin ? <EyeOff size={12} /> : <Eye size={12} />}
                    <span>{showPin ? 'Masquer' : 'Afficher'}</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setPin(val);
                    }}
                    placeholder="••••"
                    required
                    disabled={loading}
                    className="w-full px-4 py-3 bg-slate-50 focus:bg-white rounded-xl border border-slate-200 text-slate-900 font-mono text-center tracking-widest text-lg font-black focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all disabled:opacity-50"
                  />
                </div>

                <p className="text-[11px] text-slate-500 flex items-start gap-1 mt-1 leading-relaxed">
                  <ShieldCheck size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    La validation via RPC vérifie le code PIN en temps réel et scelle le reçu de versement dans la base Supabase.
                  </span>
                </p>
              </div>

              {/* Actions du Modal */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={loading || !pin.trim()}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold text-xs shadow-md shadow-red-500/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  {loading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Validation RPC Supabase...</span>
                    </>
                  ) : (
                    <>
                      <Smartphone size={14} />
                      <span>Vérifier & Valider le Paiement</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default MonCashStatusModal;
