import React, { useState } from 'react';
import { 
  Wallet, 
  CreditCard, 
  Plus, 
  Save, 
  Loader2, 
  Check, 
  Copy, 
  Trash2, 
  Edit3, 
  Settings2, 
  Lock, 
  DollarSign, 
  ShieldCheck, 
  Smartphone, 
  Building2, 
  Info, 
  Banknote, 
  Receipt, 
  Layers, 
  CheckCircle2, 
  X,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PaymentMethodConfig, getSchoolPaymentMethods } from '../lib/paymentMethods';

interface PaymentMethodManagerProps {
  schoolData: any;
  setSchoolData: (data: any) => void;
  handleUpdateSchool: () => void | Promise<void>;
  saving: boolean;
  canManageAllCampuses: boolean;
}

export const PaymentMethodManager: React.FC<PaymentMethodManagerProps> = ({
  schoolData,
  setSchoolData,
  handleUpdateSchool,
  saving,
  canManageAllCampuses
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'methods' | 'banks'>('methods');
  const [editingMethodId, setEditingMethodId] = useState<string | null>(null);
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);

  // New Custom Method Form State
  const [isAddingCustomMethod, setIsAddingCustomMethod] = useState(false);
  const [customMethodName, setCustomMethodName] = useState('');
  const [customMethodDescription, setCustomMethodDescription] = useState('');
  const [customMethodAccount, setCustomMethodAccount] = useState('');
  const [customMethodInstructions, setCustomMethodInstructions] = useState('');
  const [customMethodCurrencies, setCustomMethodCurrencies] = useState<('HTG' | 'USD')[]>(['HTG', 'USD']);
  const [customMethodRequiresRef, setCustomMethodRequiresRef] = useState(true);
  const [customMethodRequiresBank, setCustomMethodRequiresBank] = useState(false);

  // New Bank Account Form State
  const [newBankName, setNewBankName] = useState('');
  const [customBankName, setCustomBankName] = useState('');
  const [newBankAccount, setNewBankAccount] = useState('');
  const [newBankLabel, setNewBankLabel] = useState('');
  const [showAddBankCard, setShowAddBankCard] = useState(false);

  // Helpers
  const paymentMethods = getSchoolPaymentMethods(schoolData);
  const activeMethodsCount = paymentMethods.filter(m => m.enabled).length;
  const banksList: string[] = schoolData?.global_settings?.banks || [];

  const handleToggleMethod = (methodId: string) => {
    if (!canManageAllCampuses) {
      toast.error("Seuls les administrateurs du Siège Social peuvent modifier les modes de règlement.");
      return;
    }

    const currentMethods = getSchoolPaymentMethods(schoolData);
    const updated = currentMethods.map(m => {
      if (m.id === methodId) {
        return { ...m, enabled: !m.enabled };
      }
      return m;
    });

    const activeCount = updated.filter(m => m.enabled).length;
    if (activeCount === 0) {
      toast.error("Au moins un mode de paiement doit rester actif.");
      return;
    }

    const updatedSettings = {
      ...(schoolData.global_settings || {}),
      payment_methods: updated
    };
    setSchoolData({ ...schoolData, global_settings: updatedSettings });
    toast.success("Statut du mode mis à jour. N'oubliez pas d'enregistrer.");
  };

  const handleSaveMethodEdit = (methodId: string, updates: Partial<PaymentMethodConfig>) => {
    if (!canManageAllCampuses) return;
    const currentMethods = getSchoolPaymentMethods(schoolData);
    const updated = currentMethods.map(m => {
      if (m.id === methodId) {
        return { ...m, ...updates };
      }
      return m;
    });

    const updatedSettings = {
      ...(schoolData.global_settings || {}),
      payment_methods: updated
    };
    setSchoolData({ ...schoolData, global_settings: updatedSettings });
    setEditingMethodId(null);
    toast.success("Paramètres du mode mis à jour.");
  };

  const handleAddCustomMethod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageAllCampuses) return;
    if (!customMethodName.trim()) {
      toast.error("Le nom du mode de paiement est obligatoire.");
      return;
    }

    const id = `CUSTOM_${Date.now()}`;
    const newMethod: PaymentMethodConfig = {
      id,
      code: customMethodName.trim(),
      name: customMethodName.trim(),
      description: customMethodDescription.trim() || 'Mode de paiement personnalisé',
      enabled: true,
      requires_bank: customMethodRequiresBank,
      requires_reference: customMethodRequiresRef,
      requires_deposit_date: false,
      supported_currencies: customMethodCurrencies.length > 0 ? customMethodCurrencies : ['HTG'],
      account_info: customMethodAccount.trim(),
      instructions: customMethodInstructions.trim() || 'Enregistrer le justificatif de transaction.',
      icon_name: 'wallet',
      is_custom: true
    };

    const currentMethods = getSchoolPaymentMethods(schoolData);
    const updated = [...currentMethods, newMethod];

    const updatedSettings = {
      ...(schoolData.global_settings || {}),
      payment_methods: updated
    };
    setSchoolData({ ...schoolData, global_settings: updatedSettings });
    setIsAddingCustomMethod(false);
    setCustomMethodName('');
    setCustomMethodDescription('');
    setCustomMethodAccount('');
    setCustomMethodInstructions('');
    setCustomMethodCurrencies(['HTG', 'USD']);
    toast.success("Nouveau mode de paiement ajouté avec succès.");
  };

  const handleDeleteCustomMethod = (methodId: string) => {
    if (!canManageAllCampuses) return;
    const currentMethods = getSchoolPaymentMethods(schoolData);
    const updated = currentMethods.filter(m => m.id !== methodId);
    const updatedSettings = {
      ...(schoolData.global_settings || {}),
      payment_methods: updated
    };
    setSchoolData({ ...schoolData, global_settings: updatedSettings });
    toast.success("Mode personnalisé supprimé.");
  };

  const handleAddBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageAllCampuses) return;

    const resolved = newBankName === 'AUTRE' ? customBankName.trim() : newBankName.trim();
    if (!resolved) {
      toast.error('Veuillez spécifier le nom de la banque.');
      return;
    }

    let combined = resolved;
    if (newBankAccount.trim()) {
      combined += ` - ${newBankAccount.trim()}`;
    }
    if (newBankLabel.trim()) {
      combined += ` (${newBankLabel.trim()})`;
    }

    if (banksList.includes(combined)) {
      toast.error('Ce compte ou cette banque existe déjà dans la liste.');
      return;
    }

    const updatedSettings = {
      ...(schoolData.global_settings || {}),
      banks: [...banksList, combined]
    };

    setSchoolData({ ...schoolData, global_settings: updatedSettings });
    setNewBankName('');
    setCustomBankName('');
    setNewBankAccount('');
    setNewBankLabel('');
    setShowAddBankCard(false);
    toast.success(`Compte bancaire ajouté à la liste.`);
  };

  const handleDeleteBank = (bankToRemove: string) => {
    if (!canManageAllCampuses) return;
    const updatedBanks = banksList.filter(b => b !== bankToRemove);
    const updatedSettings = {
      ...(schoolData.global_settings || {}),
      banks: updatedBanks
    };
    setSchoolData({ ...schoolData, global_settings: updatedSettings });
    toast.success('Compte bancaire retiré de la liste.');
  };

  const getMethodIcon = (iconName: string, id: string) => {
    if (id === 'MONCASH' || id === 'NATCASH') return <Smartphone size={18} />;
    if (id === 'DEPOT_BANCAIRE' || iconName === 'landmark') return <Building2 size={18} />;
    if (id === 'CHEQUE' || iconName === 'receipt') return <Receipt size={18} />;
    if (id === 'CARTE' || iconName === 'credit-card') return <CreditCard size={18} />;
    if (id === 'CASH' || iconName === 'banknote') return <Banknote size={18} />;
    return <Wallet size={18} />;
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* RESTRICTION BANNER FOR SUB-CAMPUSES */}
      {!canManageAllCampuses && (
        <div className="bg-amber-50 border border-amber-200/90 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-800 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <Lock size={16} className="text-amber-700 shrink-0" />
            <p className="font-medium truncate sm:whitespace-normal">
              <strong className="font-bold">Accès restreint (Annexe) :</strong> Seule la direction du Siège Social est autorisée à modifier les règlements et comptes bancaires.
            </p>
          </div>
          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-mono text-[10px] font-bold rounded uppercase shrink-0">
            Lecture Seule
          </span>
        </div>
      )}

      {/* UNIFIED COMPACT & RESPONSIVE HEADER CARD */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/90">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Title & Icon */}
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
              {activeSubTab === 'methods' ? <Wallet size={20} className="sm:size-5" /> : <CreditCard size={20} className="sm:size-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
                  Modes de Règlement & Banques
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Standard International
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1 sm:line-clamp-none">
                Contrôle centralisé des encaissements au guichet et des coordonnées bancaires institutionnelles.
              </p>
            </div>
          </div>

          {/* Action Buttons - Fully Responsive without Overflow */}
          <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
            {activeSubTab === 'methods' && canManageAllCampuses && (
              <button
                type="button"
                onClick={() => setIsAddingCustomMethod(true)}
                className="flex-1 sm:flex-initial px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0 border border-slate-200"
              >
                <Plus size={15} />
                <span>Nouveau Mode</span>
              </button>
            )}

            {activeSubTab === 'banks' && canManageAllCampuses && (
              <button
                type="button"
                onClick={() => setShowAddBankCard(prev => !prev)}
                className="flex-1 sm:flex-initial px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0 border border-slate-200"
              >
                <Plus size={15} />
                <span>{showAddBankCard ? 'Fermer le formulaire' : 'Ajouter un Compte'}</span>
              </button>
            )}

            <button 
              type="button"
              onClick={handleUpdateSchool} 
              disabled={saving || !canManageAllCampuses} 
              className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs tracking-tight flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>Enregistrer</span>
            </button>
          </div>
        </div>

        {/* MODERN NAVIGATION PILLS */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setActiveSubTab('methods')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'methods'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
            }`}
          >
            <Wallet size={14} />
            <span>Modes de Paiement (Guichet)</span>
            <span className={`px-1.5 py-0.5 text-[10px] rounded-md font-mono font-bold ${
              activeSubTab === 'methods' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {activeMethodsCount} actifs
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('banks')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'banks'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
            }`}
          >
            <CreditCard size={14} />
            <span>Comptes Bancaires & Réception</span>
            <span className={`px-1.5 py-0.5 text-[10px] rounded-md font-mono font-bold ${
              activeSubTab === 'banks' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {banksList.length} répertoriés
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: MODES DE RÈGLEMENT (GUICHET) */}
      {/* ========================================================================= */}
      {activeSubTab === 'methods' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Modal / Inline Creator for Custom Method */}
          {isAddingCustomMethod && (
            <div className="bg-white rounded-2xl p-4 sm:p-5 border-2 border-slate-900 shadow-lg space-y-4 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                    <Plus size={16} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">Nouveau Mode de Règlement Personnalisé</h4>
                    <p className="text-[11px] text-slate-500">Ajoutez un moyen de paiement propre à vos processus de caisse.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingCustomMethod(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddCustomMethod} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">Nom du Mode *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Western Union, Virement Zelle, POS MonCash"
                      value={customMethodName}
                      onChange={e => setCustomMethodName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-slate-800 transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">Identifiant de Compte / Destinataire (Optionnel)</label>
                    <input
                      type="text"
                      placeholder="Ex: Numéro marchand, ID récepteur"
                      value={customMethodAccount}
                      onChange={e => setCustomMethodAccount(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:bg-white focus:border-slate-800 transition-all font-mono"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[11px] font-bold text-slate-700">Description courte</label>
                    <input
                      type="text"
                      placeholder="Ex: Transfert direct reçu par la trésorerie"
                      value={customMethodDescription}
                      onChange={e => setCustomMethodDescription(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:bg-white focus:border-slate-800 transition-all"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[11px] font-bold text-slate-700">Consignes & Instructions pour le caissier</label>
                    <textarea
                      rows={2}
                      placeholder="Ex: Exiger le code de transfert et la copie de pièce d'identité du payeur."
                      value={customMethodInstructions}
                      onChange={e => setCustomMethodInstructions(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:bg-white focus:border-slate-800 transition-all resize-none"
                    />
                  </div>
                </div>

                {/* Options & Currencies */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-bold text-slate-700">Devises acceptées :</span>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customMethodCurrencies.includes('HTG')}
                        onChange={e => {
                          if (e.target.checked) setCustomMethodCurrencies([...customMethodCurrencies, 'HTG']);
                          else setCustomMethodCurrencies(customMethodCurrencies.filter(c => c !== 'HTG'));
                        }}
                        className="rounded border-slate-300 text-slate-900 focus:ring-0"
                      />
                      HTG (Gourdes)
                    </label>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customMethodCurrencies.includes('USD')}
                        onChange={e => {
                          if (e.target.checked) setCustomMethodCurrencies([...customMethodCurrencies, 'USD']);
                          else setCustomMethodCurrencies(customMethodCurrencies.filter(c => c !== 'USD'));
                        }}
                        className="rounded border-slate-300 text-slate-900 focus:ring-0"
                      />
                      USD (Dollars)
                    </label>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customMethodRequiresRef}
                        onChange={e => setCustomMethodRequiresRef(e.target.checked)}
                        className="rounded border-slate-300 text-slate-900 focus:ring-0"
                      />
                      N° Réf / Reçu obligatoire
                    </label>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customMethodRequiresBank}
                        onChange={e => setCustomMethodRequiresBank(e.target.checked)}
                        className="rounded border-slate-300 text-slate-900 focus:ring-0"
                      />
                      Banque liée requise
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingCustomMethod(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Plus size={14} />
                    Créer ce mode
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Grid of Payment Methods */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {paymentMethods.map((method: PaymentMethodConfig) => {
              const isEditing = editingMethodId === method.id;
              const isConfiguredMoncash = method.id === 'MONCASH';
              const isConfiguredNatcash = method.id === 'NATCASH';

              return (
                <div
                  key={method.id}
                  className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-xs hover:border-slate-300 ${
                    method.enabled ? 'border-slate-200' : 'border-slate-200/60 opacity-85 bg-slate-50/40'
                  }`}
                >
                  <div className="p-4 sm:p-4.5 space-y-3">
                    {/* Header line */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                            method.enabled
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {getMethodIcon(method.icon_name, method.id)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight truncate">
                              {method.name}
                            </h4>
                            {method.is_custom && (
                              <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase rounded bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                                Personnalisé
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {method.description}
                          </p>
                        </div>
                      </div>

                      {/* Toggle Switch */}
                      <button
                        type="button"
                        onClick={() => handleToggleMethod(method.id)}
                        disabled={!canManageAllCampuses}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                          method.enabled ? 'bg-emerald-600' : 'bg-slate-200'
                        }`}
                        role="switch"
                        aria-checked={method.enabled}
                        title={method.enabled ? 'Désactiver au guichet' : 'Activer au guichet'}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            method.enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Status & Rules Pills */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider ${
                          method.enabled
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${method.enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {method.enabled ? 'Actif au guichet' : 'Désactivé'}
                      </span>

                      {/* Currency Badges */}
                      <div className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-200/60">
                        <span className="text-[9px] font-mono font-bold text-slate-400 uppercase">Devises:</span>
                        {method.supported_currencies.map(curr => (
                          <span
                            key={curr}
                            className="px-1.5 py-0.2 bg-slate-900 text-white font-mono text-[9px] font-bold rounded"
                          >
                            {curr}
                          </span>
                        ))}
                      </div>

                      {method.requires_reference && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-mono text-[9px] font-bold border border-blue-200/70 uppercase">
                          Réf / Reçu Obligatoire
                        </span>
                      )}

                      {method.requires_bank && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-mono text-[9px] font-bold border border-amber-200/70 uppercase">
                          Banque Liée
                        </span>
                      )}
                    </div>

                    {/* Mobile / Account Info Notice if any */}
                    {method.account_info && (
                      <div className="p-2 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-slate-400 font-bold text-[10px] uppercase">N° Compte / Marchand:</span>
                          <span className="font-bold text-slate-900 truncate">{method.account_info}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(method.account_info || '');
                            toast.success('Numéro copié !');
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer shrink-0"
                          title="Copier"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    )}

                    {/* Instructions display */}
                    {method.instructions && !isEditing && (
                      <p className="text-[11px] text-slate-600 bg-slate-50/60 p-2 rounded-xl border border-slate-100 italic">
                        "{method.instructions}"
                      </p>
                    )}

                    {/* INLINE EDIT FORM */}
                    {isEditing && (
                      <div className="pt-2 border-t border-slate-100 space-y-3 animate-in fade-in duration-150">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 uppercase font-mono">
                            N° Marchand / Compte / Téléphone
                          </label>
                          <input
                            type="text"
                            defaultValue={method.account_info || ''}
                            id={`acc_${method.id}`}
                            placeholder="Ex: 509-3800-0000 ou 102-990-281"
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none focus:border-slate-800"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 uppercase font-mono">
                            Consignes caissier
                          </label>
                          <input
                            type="text"
                            defaultValue={method.instructions || ''}
                            id={`inst_${method.id}`}
                            placeholder="Ex: Exiger la référence SMS..."
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 outline-none focus:border-slate-800"
                          />
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                defaultChecked={method.supported_currencies.includes('HTG')}
                                id={`curr_htg_${method.id}`}
                                className="rounded text-slate-900 border-slate-300"
                              />
                              HTG
                            </label>
                            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                defaultChecked={method.supported_currencies.includes('USD')}
                                id={`curr_usd_${method.id}`}
                                className="rounded text-slate-900 border-slate-300"
                              />
                              USD
                            </label>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingMethodId(null)}
                              className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-medium cursor-pointer"
                            >
                              Annuler
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const accEl = document.getElementById(`acc_${method.id}`) as HTMLInputElement;
                                const instEl = document.getElementById(`inst_${method.id}`) as HTMLInputElement;
                                const htgEl = document.getElementById(`curr_htg_${method.id}`) as HTMLInputElement;
                                const usdEl = document.getElementById(`curr_usd_${method.id}`) as HTMLInputElement;

                                const currs: ('HTG' | 'USD')[] = [];
                                if (htgEl?.checked) currs.push('HTG');
                                if (usdEl?.checked) currs.push('USD');

                                handleSaveMethodEdit(method.id, {
                                  account_info: accEl?.value || '',
                                  instructions: instEl?.value || '',
                                  supported_currencies: currs.length > 0 ? currs : ['HTG']
                                });
                              }}
                              className="px-3 py-1 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold font-mono cursor-pointer"
                            >
                              Valider
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer Card Controls */}
                  <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="text-[10px] font-mono text-slate-400 font-medium">
                      Code: <strong className="text-slate-700">{method.code}</strong>
                    </div>

                    <div className="flex items-center gap-2">
                      {canManageAllCampuses && !isEditing && (
                        <button
                          type="button"
                          onClick={() => setEditingMethodId(method.id)}
                          className="flex items-center gap-1 px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          <Edit3 size={12} />
                          <span>Configurer</span>
                        </button>
                      )}

                      {method.is_custom && canManageAllCampuses && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomMethod(method.id)}
                          className="flex items-center gap-1 px-2 py-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          <Trash2 size={12} />
                          <span>Supprimer</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: COMPTES BANCAIRES & RÉCEPTION */}
      {/* ========================================================================= */}
      {activeSubTab === 'banks' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Quick Bank Addition Form Card */}
          {showAddBankCard && canManageAllCampuses && (
            <div className="bg-white rounded-2xl p-4 sm:p-5 border-2 border-slate-900 shadow-lg space-y-4 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                    <Building2 size={16} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">Nouveau Compte Bancaire Officiel</h4>
                    <p className="text-[11px] text-slate-500">Ajoutez une institution bancaire de réception pour les dépôts et virements.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddBankCard(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddBank} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">Institution Bancaire *</label>
                    <select
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-slate-800 transition-all cursor-pointer"
                      value={newBankName}
                      onChange={e => {
                        setNewBankName(e.target.value);
                        if (e.target.value !== 'AUTRE') setCustomBankName('');
                      }}
                      required
                    >
                      <option value="" disabled>Sélectionner une banque...</option>
                      <option value="UNIBANK">UNIBANK</option>
                      <option value="Sogebank">Sogebank</option>
                      <option value="BNC">BNC (Banque Nationale de Crédit)</option>
                      <option value="BUH">BUH (Banque de l'Union Haïtienne)</option>
                      <option value="Capital Bank">Capital Bank</option>
                      <option value="Banque Populaire Haïtienne">Banque Populaire Haïtienne (BPH)</option>
                      <option value="Citibank">Citibank</option>
                      <option value="AUTRE">Autre banque internationale (Saisie)...</option>
                    </select>
                  </div>

                  {newBankName === 'AUTRE' && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">Nom de la banque *</label>
                      <input
                        type="text"
                        required
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-slate-800 transition-all"
                        placeholder="Ex: Bank of America, Chase, etc."
                        value={customBankName}
                        onChange={e => setCustomBankName(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">Numéro de Compte</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none focus:bg-white focus:border-slate-800 transition-all"
                      placeholder="Ex: 102-394-1928"
                      value={newBankAccount}
                      onChange={e => setNewBankAccount(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">Libellé / Devise (Optionnel)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:bg-white focus:border-slate-800 transition-all"
                      placeholder="Ex: Compte USD, Gourdes, Principal"
                      value={newBankLabel}
                      onChange={e => setNewBankLabel(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddBankCard(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={!newBankName}
                    className="px-5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <Plus size={14} />
                    Ajouter le compte
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Grid of Bank Accounts */}
          {banksList.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {banksList.map((bank: string, idx: number) => {
                const parts = bank.split(' - ');
                const name = parts[0] || bank;
                let account = parts[1] || '';
                let label = '';
                if (account.includes('(')) {
                  const lblIndex = account.indexOf('(');
                  label = account.substring(lblIndex + 1, account.length - 1);
                  account = account.substring(0, lblIndex).trim();
                }

                return (
                  <div
                    key={idx}
                    className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-4 shadow-xs transition-all flex flex-col justify-between space-y-3 relative overflow-hidden group"
                  >
                    <div className="space-y-3">
                      {/* Bank header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-xs shrink-0 shadow-xs">
                            {name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <p className="font-bold text-slate-900 tracking-tight text-xs uppercase truncate">
                              {name}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono font-medium">Réception Officielle</p>
                          </div>
                        </div>

                        {label && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono font-bold text-[10px] rounded border border-slate-200/60 uppercase shrink-0">
                            {label}
                          </span>
                        )}
                      </div>

                      {/* Account Number Box */}
                      {account ? (
                        <div className="bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[9px] text-slate-400 font-mono font-bold uppercase">N° de Compte</p>
                            <p className="text-xs font-mono font-bold text-slate-900 tracking-wider truncate">
                              {account}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(account);
                              setCopiedAccount(account);
                              toast.success('Numéro de compte copié !');
                              setTimeout(() => setCopiedAccount(null), 2000);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors shrink-0 cursor-pointer"
                            title="Copier le numéro"
                          >
                            {copiedAccount === account ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                          </button>
                        </div>
                      ) : (
                        <div className="bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-100 border-dashed text-slate-400 font-mono text-[11px] italic">
                          Sans numéro spécifié
                        </div>
                      )}
                    </div>

                    {/* Bank card footer */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-mono font-bold text-emerald-700 uppercase">Actif</span>
                      </div>

                      {canManageAllCampuses && (
                        <button
                          type="button"
                          onClick={() => handleDeleteBank(bank)}
                          className="flex items-center gap-1 text-[11px] font-mono font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded transition-colors cursor-pointer"
                          title="Supprimer ce compte"
                        >
                          <Trash2 size={12} />
                          Retirer
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 bg-slate-50 border border-slate-200 border-dashed rounded-2xl">
              <Building2 size={36} className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-800 font-bold text-xs">Aucun compte bancaire configuré</p>
              <p className="text-slate-500 text-[11px] mt-0.5 max-w-sm mx-auto">
                {canManageAllCampuses
                  ? "Ajoutez vos comptes UNIBANK, Sogebank, BNC ou internationaux pour faciliter les encaissements par virement."
                  : "Veuillez contacter le Siège Social pour configurer les banques institutionnelles."}
              </p>
              {canManageAllCampuses && (
                <button
                  type="button"
                  onClick={() => setShowAddBankCard(true)}
                  className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-black transition-all"
                >
                  <Plus size={13} />
                  Ajouter un premier compte
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
