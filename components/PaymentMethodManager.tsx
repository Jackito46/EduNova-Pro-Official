import React, { useState, useEffect, useRef } from 'react';
import {
  Wallet,
  CreditCard,
  Plus,
  Save,
  Loader2,
  Check,
  Copy,
  Trash2,
  Edit2,
  Lock,
  DollarSign,
  Smartphone,
  Landmark,
  Receipt,
  Banknote,
  X,
  SlidersHorizontal,
  ChevronDown,
  Search,
  Eye,
  EyeOff,
  Sparkles,
  HelpCircle,
  Building
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  PaymentMethodConfig,
  getSchoolPaymentMethods,
  DEFAULT_PAYMENT_METHODS
} from '../lib/paymentMethods';

export interface PaymentMethodManagerProps {
  schoolData: any;
  setSchoolData: (data: any) => void;
  handleUpdateSchool?: () => void | Promise<void>;
  saving?: boolean;
  canManageAllCampuses: boolean;
  initialTab?: 'unified' | 'methods' | 'banks';
}

type TabType = 'unified' | 'methods' | 'banks';
type MethodFilter = 'all' | 'active' | 'inactive' | 'mobile' | 'bank' | 'custom';

export const PaymentMethodManager: React.FC<PaymentMethodManagerProps> = ({
  schoolData,
  setSchoolData,
  handleUpdateSchool,
  saving = false,
  canManageAllCampuses,
  initialTab = 'unified'
}) => {
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown states
  const [openMethodMenuId, setOpenMethodMenuId] = useState<string | null>(null);
  const [openBankMenuIdx, setOpenBankMenuIdx] = useState<number | null>(null);

  // New Bank Form State
  const [showAddBank, setShowAddBank] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [customBankName, setCustomBankName] = useState('');
  const [newBankAccount, setNewBankAccount] = useState('');
  const [newBankLabel, setNewBankLabel] = useState('');
  const [editingBankIdx, setEditingBankIdx] = useState<number | null>(null);
  const [editBankName, setEditBankName] = useState('');
  const [editBankAccount, setEditBankAccount] = useState('');
  const [editBankLabel, setEditBankLabel] = useState('');

  // Custom Method Modal State
  const [isAddingCustomMethod, setIsAddingCustomMethod] = useState(false);
  const [customMethodName, setCustomMethodName] = useState('');
  const [customMethodDescription, setCustomMethodDescription] = useState('');
  const [customMethodAccount, setCustomMethodAccount] = useState('');
  const [customMethodInstructions, setCustomMethodInstructions] = useState('');
  const [customMethodCurrencies, setCustomMethodCurrencies] = useState<('HTG' | 'USD')[]>(['HTG', 'USD']);
  const [customMethodRequiresRef, setCustomMethodRequiresRef] = useState(true);
  const [customMethodRequiresBank, setCustomMethodRequiresBank] = useState(false);
  const [customMethodIcon, setCustomMethodIcon] = useState<PaymentMethodConfig['icon_name']>('credit-card');

  // In-card configuration state
  const [editingMethodId, setEditingMethodId] = useState<string | null>(null);

  // Copy feedback
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropdown-box]')) {
        setOpenMethodMenuId(null);
        setOpenBankMenuIdx(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast.success(`${label} copié !`);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const methods = getSchoolPaymentMethods(schoolData);
  const banks: string[] = schoolData?.global_settings?.banks || [];

  const activeMethodsCount = methods.filter(m => m.enabled).length;
  const customMethodsCount = methods.filter(m => m.is_custom).length;

  // Toggle method active status
  const toggleMethodActive = (methodId: string) => {
    if (!canManageAllCampuses) {
      toast.error('Modification réservée au Siège Social');
      return;
    }
    const target = methods.find(m => m.id === methodId);
    if (!target) return;

    const updated = methods.map(m => {
      if (m.id === methodId) {
        return { ...m, enabled: !m.enabled };
      }
      return m;
    });

    const activeCount = updated.filter(m => m.enabled).length;
    if (activeCount === 0) {
      toast.error('Au moins un mode de règlement doit rester actif.');
      return;
    }

    const updatedSettings = {
      ...(schoolData.global_settings || {}),
      payment_methods: updated
    };
    setSchoolData({ ...schoolData, global_settings: updatedSettings });
    toast.success(`${target.name} ${!target.enabled ? 'activé' : 'désactivé'} au guichet`);
    setOpenMethodMenuId(null);
  };

  // Toggle currency support
  const toggleMethodCurrency = (methodId: string, curr: 'HTG' | 'USD') => {
    if (!canManageAllCampuses) return;
    const target = methods.find(m => m.id === methodId);
    if (!target) return;

    const currs = target.supported_currencies || ['HTG'];
    let nextCurrs: ('HTG' | 'USD')[];

    if (currs.includes(curr)) {
      if (currs.length === 1) {
        toast.error('Au moins une devise doit être acceptée');
        return;
      }
      nextCurrs = currs.filter(c => c !== curr);
    } else {
      nextCurrs = [...currs, curr];
    }

    const updated = methods.map(m => {
      if (m.id === methodId) {
        return { ...m, supported_currencies: nextCurrs };
      }
      return m;
    });

    const updatedSettings = {
      ...(schoolData.global_settings || {}),
      payment_methods: updated
    };
    setSchoolData({ ...schoolData, global_settings: updatedSettings });
    toast.success(`Devise ${curr} mise à jour`);
  };

  // Remove custom method
  const removeCustomMethod = (methodId: string) => {
    if (!canManageAllCampuses) return;
    const updated = methods.filter(m => m.id !== methodId);
    const updatedSettings = {
      ...(schoolData.global_settings || {}),
      payment_methods: updated
    };
    setSchoolData({ ...schoolData, global_settings: updatedSettings });
    toast.success('Méthode personnalisée supprimée.');
    setOpenMethodMenuId(null);
  };

  // Submit custom method
  const handleSaveCustomMethod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageAllCampuses) return;

    const nameTrimmed = customMethodName.trim();
    if (!nameTrimmed) {
      toast.error('Le nom du mode est obligatoire');
      return;
    }

    if (customMethodCurrencies.length === 0) {
      toast.error('Sélectionnez au moins une devise (HTG ou USD)');
      return;
    }

    const newId = `CUSTOM_${Date.now().toString(36).toUpperCase()}`;
    const newConfig: PaymentMethodConfig = {
      id: newId,
      code: nameTrimmed.toUpperCase().replace(/\s+/g, '_').substring(0, 16),
      name: nameTrimmed,
      description: customMethodDescription.trim() || 'Mode personnalisé d’encaissement',
      account_info: customMethodAccount.trim(),
      instructions: customMethodInstructions.trim(),
      enabled: true,
      requires_reference: customMethodRequiresRef,
      requires_bank: customMethodRequiresBank,
      requires_deposit_date: false,
      supported_currencies: customMethodCurrencies,
      icon_name: customMethodIcon,
      is_custom: true
    };

    const updated = [...methods, newConfig];
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
    toast.success(`Mode "${nameTrimmed}" créé avec succès !`);
  };

  // Add Bank
  const handleAddBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageAllCampuses) return;

    const resolvedName = newBankName === 'AUTRE' ? customBankName.trim() : newBankName.trim();
    if (!resolvedName) {
      toast.error('Veuillez sélectionner ou saisir le nom de la banque');
      return;
    }

    let combined = resolvedName;
    if (newBankAccount.trim()) {
      combined += ` - ${newBankAccount.trim()}`;
    }
    if (newBankLabel.trim()) {
      combined += ` (${newBankLabel.trim()})`;
    }

    if (banks.includes(combined)) {
      toast.error('Ce compte existe déjà');
      return;
    }

    const updatedBanks = [...banks, combined];
    const updatedSettings = {
      ...(schoolData.global_settings || {}),
      banks: updatedBanks
    };

    setSchoolData({ ...schoolData, global_settings: updatedSettings });
    setNewBankName('');
    setCustomBankName('');
    setNewBankAccount('');
    setNewBankLabel('');
    setShowAddBank(false);
    toast.success(`Compte "${resolvedName}" ajouté.`);
  };

  // Remove Bank
  const handleRemoveBank = (bankStr: string) => {
    if (!canManageAllCampuses) return;
    const updatedBanks = banks.filter(b => b !== bankStr);
    const updatedSettings = {
      ...(schoolData.global_settings || {}),
      banks: updatedBanks
    };
    setSchoolData({ ...schoolData, global_settings: updatedSettings });
    toast.success('Compte bancaire supprimé.');
    setOpenBankMenuIdx(null);
  };

  // Save edit bank
  const handleSaveEditBank = (idx: number) => {
    if (!canManageAllCampuses) return;
    const resolvedName = editBankName.trim();
    if (!resolvedName) {
      toast.error('Le nom de la banque est obligatoire');
      return;
    }

    let combined = resolvedName;
    if (editBankAccount.trim()) {
      combined += ` - ${editBankAccount.trim()}`;
    }
    if (editBankLabel.trim()) {
      combined += ` (${editBankLabel.trim()})`;
    }

    const updatedBanks = [...banks];
    updatedBanks[idx] = combined;

    const updatedSettings = {
      ...(schoolData.global_settings || {}),
      banks: updatedBanks
    };

    setSchoolData({ ...schoolData, global_settings: updatedSettings });
    setEditingBankIdx(null);
    toast.success('Compte bancaire mis à jour.');
  };

  // Parse Bank String
  const parseBank = (bankStr: string) => {
    const parts = bankStr.split(' - ');
    const name = parts[0] || bankStr;
    let account = parts[1] || '';
    let label = '';
    if (account.includes('(')) {
      const lblIndex = account.indexOf('(');
      label = account.substring(lblIndex + 1, account.length - 1);
      account = account.substring(0, lblIndex).trim();
    }
    return { name, account, label, full: bankStr };
  };

  // Filter methods
  const filteredMethods = methods.filter(m => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = m.name.toLowerCase().includes(q);
      const matchDesc = (m.description || '').toLowerCase().includes(q);
      const matchAcc = (m.account_info || '').toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchAcc) return false;
    }

    if (methodFilter === 'active') return m.enabled;
    if (methodFilter === 'inactive') return !m.enabled;
    if (methodFilter === 'mobile') return m.icon_name === 'smartphone' || m.id.includes('CASH') || m.name.toLowerCase().includes('cash');
    if (methodFilter === 'bank') return m.requires_bank || m.icon_name === 'landmark';
    if (methodFilter === 'custom') return m.is_custom;
    return true;
  });

  const renderMethodIcon = (iconName: PaymentMethodConfig['icon_name'], enabled: boolean) => {
    const props = { size: 18 };
    let iconElement = <Banknote {...props} />;
    if (iconName === 'smartphone') iconElement = <Smartphone {...props} />;
    else if (iconName === 'landmark') iconElement = <Landmark {...props} />;
    else if (iconName === 'receipt') iconElement = <Receipt {...props} />;
    else if (iconName === 'credit-card') iconElement = <CreditCard {...props} />;
    else if (iconName === 'wallet') iconElement = <Wallet {...props} />;
    else if (iconName === 'dollar-sign') iconElement = <DollarSign {...props} />;

    return (
      <div
        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
          enabled
            ? 'bg-slate-900 text-emerald-400 shadow-xs'
            : 'bg-slate-100 text-slate-400'
        }`}
      >
        {iconElement}
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Sub-campus restricted notice */}
      {!canManageAllCampuses && (
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <Lock size={14} className="text-amber-700 shrink-0" />
            <p className="font-medium">
              <strong className="font-bold">Consultation :</strong> Seul le Siège Social configure les règlements et comptes bancaires.
            </p>
          </div>
          <span className="px-2 py-0.5 bg-amber-200/70 text-amber-900 font-mono text-[10px] font-bold rounded uppercase">
            Lecture Seule
          </span>
        </div>
      )}

      {/* MODERN STREAMLINED HEADER (Minimal text, ultra fluid & responsive) */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 md:p-5 shadow-xs border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Title and compact subtitle */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center shadow-xs shrink-0">
              <Wallet size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                  Modes de Règlement & Banques
                </h3>
                <span className="hidden xs:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Trésorerie
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                Canaux d'encaissement et comptes bancaires de l'établissement.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {canManageAllCampuses && (
              <button
                type="button"
                onClick={() => {
                  setIsAddingCustomMethod(true);
                  setCustomMethodName('');
                  setCustomMethodDescription('');
                  setCustomMethodAccount('');
                  setCustomMethodInstructions('');
                  setCustomMethodCurrencies(['HTG', 'USD']);
                  setCustomMethodRequiresRef(true);
                  setCustomMethodRequiresBank(false);
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 border border-slate-200/80"
              >
                <Plus size={14} className="text-slate-800" />
                <span>Nouveau Mode</span>
              </button>
            )}

            {handleUpdateSchool && (
              <button
                type="button"
                onClick={handleUpdateSchool}
                disabled={saving || !canManageAllCampuses}
                className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin text-emerald-400" />
                ) : (
                  <Save size={14} className="text-emerald-400" />
                )}
                <span>Enregistrer</span>
              </button>
            )}
          </div>
        </div>

        {/* METRICS ROW (Clean & Responsive on all displays) */}
        <div className="mt-3.5 pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/70">
            <span className="text-[10px] font-mono font-bold uppercase text-slate-500 block">Modes Actifs</span>
            <span className="text-sm font-bold text-slate-900 font-mono">
              <span className="text-emerald-600">{activeMethodsCount}</span> / {methods.length}
            </span>
          </div>

          <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/70">
            <span className="text-[10px] font-mono font-bold uppercase text-slate-500 block">Comptes Bancaires</span>
            <span className="text-sm font-bold text-slate-900 font-mono">
              {banks.length} <span className="text-slate-400 text-xs font-normal">comptes</span>
            </span>
          </div>

          <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/70">
            <span className="text-[10px] font-mono font-bold uppercase text-slate-500 block">Devises</span>
            <span className="text-xs font-bold text-slate-800 font-mono inline-flex gap-1 mt-0.5">
              <span className="px-1.5 py-0.2 bg-white rounded border border-slate-300 text-slate-900 font-bold">HTG</span>
              <span className="px-1.5 py-0.2 bg-white rounded border border-slate-300 text-slate-900 font-bold">USD</span>
            </span>
          </div>

          <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/70">
            <span className="text-[10px] font-mono font-bold uppercase text-slate-500 block">Personnalisés</span>
            <span className="text-sm font-bold text-indigo-600 font-mono">
              {customMethodsCount} <span className="text-slate-400 text-xs font-normal">créés</span>
            </span>
          </div>
        </div>
      </div>

      {/* VIEW SELECTOR PILLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('unified')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'unified'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <SlidersHorizontal size={13} />
            <span>Vue Globale</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('methods')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'methods'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Wallet size={13} />
            <span>Modes de Règlement</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
              activeTab === 'methods' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
            }`}>
              {activeMethodsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('banks')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'banks'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <CreditCard size={13} />
            <span>Comptes Bancaires</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
              activeTab === 'banks' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
            }`}>
              {banks.length}
            </span>
          </button>
        </div>
      </div>

      {/* SECTION 1: MODES DE RÈGLEMENT */}
      {(activeTab === 'unified' || activeTab === 'methods') && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/40">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/60">
                <Wallet size={16} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900">Modes d'Encaissement au Guichet</h4>
                <p className="text-[11px] text-slate-500 font-medium">Activation et paramétrage des canaux de paiement</p>
              </div>
            </div>

            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
              {activeMethodsCount} / {methods.length} Actifs
            </span>
          </div>

          <div className="p-3.5 sm:p-4 md:p-5 space-y-4">
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher (MonCash, Espèces, Virement...)"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-slate-800 shadow-xs"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                {(['all', 'active', 'inactive', 'mobile', 'bank', 'custom'] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setMethodFilter(f)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      methodFilter === f
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {f === 'all' && 'Tous'}
                    {f === 'active' && 'Actifs'}
                    {f === 'inactive' && 'Inactifs'}
                    {f === 'mobile' && 'Mobiles'}
                    {f === 'bank' && 'Banques'}
                    {f === 'custom' && 'Sur-mesure'}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid of Methods */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredMethods.map((method: PaymentMethodConfig) => {
                const isMenuOpen = openMethodMenuId === method.id;
                const isEditing = editingMethodId === method.id;
                const isConfiguredMoncash = method.id === 'MONCASH';

                return (
                  <div
                    key={method.id}
                    className={`bg-white rounded-xl border transition-all relative ${
                      method.enabled
                        ? 'border-slate-200/90 shadow-xs hover:border-slate-300'
                        : 'border-slate-200 bg-slate-50/40 opacity-75'
                    }`}
                  >
                    <div className="p-3.5 space-y-3">
                      {/* Top: Icon + Title + Dropdown Actions */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {renderMethodIcon(method.icon_name, method.enabled)}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h5 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight truncate">
                                {method.name}
                              </h5>
                              {method.is_custom && (
                                <span className="px-1.5 py-0.2 bg-blue-50 text-blue-700 font-mono text-[9px] font-bold rounded border border-blue-200 uppercase shrink-0">
                                  Perso
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium line-clamp-1">
                              {method.description}
                            </p>
                          </div>
                        </div>

                        {/* ACTIONS DROPDOWN */}
                        <div className="relative shrink-0" data-dropdown-box>
                          <button
                            type="button"
                            onClick={() => setOpenMethodMenuId(isMenuOpen ? null : method.id)}
                            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 ${
                              isMenuOpen
                                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                            }`}
                          >
                            <span>Actions</span>
                            <ChevronDown size={13} className={`transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
                          </button>

                          <AnimatePresence>
                            {isMenuOpen && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 4 }}
                                transition={{ duration: 0.12 }}
                                className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-40 text-xs font-medium space-y-0.5"
                              >
                                <div className="px-3 py-1 border-b border-slate-100 text-[10px] font-mono font-bold text-slate-400 uppercase truncate">
                                  {method.name}
                                </div>

                                {canManageAllCampuses && (
                                  <button
                                    type="button"
                                    onClick={() => toggleMethodActive(method.id)}
                                    className="w-full px-3 py-1.5 text-left hover:bg-slate-50 flex items-center justify-between text-slate-800 font-semibold cursor-pointer"
                                  >
                                    <span className="flex items-center gap-2">
                                      {method.enabled ? <EyeOff size={13} className="text-rose-500" /> : <Eye size={13} className="text-emerald-600" />}
                                      <span>{method.enabled ? 'Désactiver' : 'Activer'}</span>
                                    </span>
                                    <span className={`w-2 h-2 rounded-full ${method.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingMethodId(isEditing ? null : method.id);
                                    setOpenMethodMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-800 font-semibold cursor-pointer"
                                >
                                  <Edit2 size={13} className="text-blue-600" />
                                  <span>{isEditing ? 'Fermer détails' : 'Modifier infos & consignes'}</span>
                                </button>

                                {method.account_info && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      copyToClipboard(method.account_info || '', 'ID / Compte');
                                      setOpenMethodMenuId(null);
                                    }}
                                    className="w-full px-3 py-1.5 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700 cursor-pointer"
                                  >
                                    <Copy size={13} className="text-slate-500" />
                                    <span>Copier N° Compte / ID</span>
                                  </button>
                                )}

                                {canManageAllCampuses && (
                                  <div className="px-3 py-1.5 border-t border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase font-mono mb-1">Devises autorisées :</p>
                                    <div className="flex gap-1">
                                      {(['HTG', 'USD'] as const).map(curr => {
                                        const isSupported = (method.supported_currencies || []).includes(curr);
                                        return (
                                          <button
                                            key={curr}
                                            type="button"
                                            onClick={() => toggleMethodCurrency(method.id, curr)}
                                            disabled={isConfiguredMoncash && curr === 'USD'}
                                            className={`flex-1 py-0.5 rounded text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                                              isSupported
                                                ? 'bg-slate-900 text-white border-slate-900'
                                                : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                                            }`}
                                          >
                                            {curr} {isSupported ? '✓' : ''}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {method.is_custom && canManageAllCampuses && (
                                  <div className="pt-1 border-t border-slate-100">
                                    <button
                                      type="button"
                                      onClick={() => removeCustomMethod(method.id)}
                                      className="w-full px-3 py-1.5 text-left hover:bg-rose-50 text-rose-600 font-bold flex items-center gap-2 cursor-pointer"
                                    >
                                      <Trash2 size={13} />
                                      <span>Supprimer</span>
                                    </button>
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-100">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase font-mono flex items-center gap-1 ${
                            method.enabled
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${method.enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {method.enabled ? 'Actif' : 'Désactivé'}
                        </span>

                        <div className="flex items-center gap-1">
                          {(method.supported_currencies || ['HTG']).map(curr => (
                            <span key={curr} className="px-1.5 py-0.2 bg-slate-100 text-slate-800 font-mono text-[10px] font-bold rounded border border-slate-200">
                              {curr}
                            </span>
                          ))}
                        </div>

                        {method.requires_reference && (
                          <span className="px-1.5 py-0.2 bg-indigo-50 text-indigo-700 font-mono text-[9px] font-bold rounded border border-indigo-100 uppercase">
                            Réf requise
                          </span>
                        )}
                        {method.requires_bank && (
                          <span className="px-1.5 py-0.2 bg-amber-50 text-amber-700 font-mono text-[9px] font-bold rounded border border-amber-100 uppercase">
                            Banque liée
                          </span>
                        )}
                      </div>

                      {/* In-Card Config Form (High contrast dark text on white) */}
                      {isEditing ? (
                        <div className="space-y-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200 animate-in fade-in">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-slate-700 font-mono">
                              Compte / ID Marchand
                            </label>
                            <input
                              type="text"
                              value={method.account_info || ''}
                              onChange={e => {
                                const updated = methods.map(m => {
                                  if (m.id === method.id) return { ...m, account_info: e.target.value };
                                  return m;
                                });
                                setSchoolData({
                                  ...schoolData,
                                  global_settings: { ...(schoolData.global_settings || {}), payment_methods: updated }
                                });
                              }}
                              placeholder="Ex: +509 3844-0000 / Compte..."
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-slate-800 shadow-xs"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-slate-700 font-mono">
                              Consignes caissiers
                            </label>
                            <textarea
                              rows={2}
                              value={method.instructions || ''}
                              onChange={e => {
                                const updated = methods.map(m => {
                                  if (m.id === method.id) return { ...m, instructions: e.target.value };
                                  return m;
                                });
                                setSchoolData({
                                  ...schoolData,
                                  global_settings: { ...(schoolData.global_settings || {}), payment_methods: updated }
                                });
                              }}
                              placeholder="Ex: Vérifier le SMS officiel Digicel..."
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-slate-800 resize-none shadow-xs"
                            />
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => setEditingMethodId(null)}
                              className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-black transition-colors cursor-pointer"
                            >
                              Terminer
                            </button>
                          </div>
                        </div>
                      ) : (
                        (method.account_info || method.instructions) && (
                          <div className="space-y-1 text-xs pt-0.5">
                            {method.account_info && (
                              <div className="flex items-center justify-between gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200/70">
                                <div className="min-w-0 truncate">
                                  <span className="text-[9px] uppercase font-bold text-slate-500 font-mono mr-1">ID:</span>
                                  <span className="font-mono font-bold text-slate-900 text-xs">{method.account_info}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(method.account_info || '', 'ID Marchand')}
                                  className="p-0.5 text-slate-400 hover:text-slate-800 transition-colors"
                                >
                                  {copiedText === method.account_info ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                                </button>
                              </div>
                            )}
                            {method.instructions && (
                              <p className="text-[11px] text-slate-600 italic bg-slate-50/60 p-1.5 rounded-lg border border-slate-100 line-clamp-2">
                                "{method.instructions}"
                              </p>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: COMPTES BANCAIRES */}
      {(activeTab === 'unified' || activeTab === 'banks') && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/40">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200/60">
                <CreditCard size={16} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900">Comptes Bancaires de l'Établissement</h4>
                <p className="text-[11px] text-slate-500 font-medium">Comptes institutionnels pour dépôts et virements</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                {banks.length} Comptes
              </span>
              {canManageAllCampuses && !showAddBank && (
                <button
                  type="button"
                  onClick={() => setShowAddBank(true)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={12} />
                  <span>Ajouter</span>
                </button>
              )}
            </div>
          </div>

          <div className="p-3.5 sm:p-4 md:p-5 space-y-4">
            {/* INLINE BANK ADDITION FORM */}
            {canManageAllCampuses && showAddBank && (
              <div className="bg-slate-50/90 p-3.5 sm:p-4 rounded-xl border border-slate-200 space-y-3 animate-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-slate-900 font-mono uppercase tracking-wider flex items-center gap-1.5">
                    <Plus size={13} className="text-emerald-600" /> Ajouter un Compte Bancaire
                  </h5>
                  <button
                    type="button"
                    onClick={() => setShowAddBank(false)}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                  >
                    <X size={14} />
                  </button>
                </div>

                <form onSubmit={handleAddBank} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">Institution Bancaire *</label>
                      <select
                        className="w-full px-3 py-2 bg-white text-slate-900 font-semibold border border-slate-300 rounded-lg text-xs outline-none focus:border-slate-800 shadow-xs cursor-pointer"
                        value={newBankName}
                        onChange={e => {
                          setNewBankName(e.target.value);
                          if (e.target.value !== 'AUTRE') setCustomBankName('');
                        }}
                      >
                        <option value="" disabled>Sélectionner une banque...</option>
                        <option value="UNIBANK">UNIBANK</option>
                        <option value="Sogebank">Sogebank</option>
                        <option value="BNC">BNC (Banque Nationale de Crédit)</option>
                        <option value="BUH">BUH (Banque de l'Union Haïtienne)</option>
                        <option value="Capital Bank">Capital Bank</option>
                        <option value="Banque Populaire Haïtienne">Banque Populaire Haïtienne (BPH)</option>
                        <option value="Citibank">Citibank</option>
                        <option value="AUTRE">Autre banque...</option>
                      </select>
                    </div>

                    {newBankName === 'AUTRE' && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">Nom de la banque *</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 bg-white text-slate-900 font-semibold border border-slate-300 rounded-lg text-xs placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-slate-800 shadow-xs"
                          placeholder="Nom de la banque"
                          value={customBankName}
                          onChange={e => setCustomBankName(e.target.value)}
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">Numéro de compte</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 bg-white text-slate-900 font-mono font-bold border border-slate-300 rounded-lg text-xs placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-slate-800 shadow-xs"
                        placeholder="Ex: 102-394-1928"
                        value={newBankAccount}
                        onChange={e => setNewBankAccount(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">Libellé / Devise</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 bg-white text-slate-900 font-semibold border border-slate-300 rounded-lg text-xs placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-slate-800 shadow-xs"
                        placeholder="Ex: Courant HTG, Épargne USD..."
                        value={newBankLabel}
                        onChange={e => setNewBankLabel(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddBank(false)}
                      className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={!newBankName || (newBankName === 'AUTRE' && !customBankName.trim())}
                      className="px-4 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                    >
                      <Plus size={13} />
                      <span>Ajouter le compte</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* LIST OF BANK ACCOUNTS */}
            {banks.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Landmark size={24} className="mx-auto text-slate-400 mb-1.5" />
                <p className="text-xs font-bold text-slate-700">Aucun compte bancaire configuré</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Ajoutez les comptes bancaires autorisés pour les virements et dépôts directs.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {banks.map((bankStr, idx) => {
                  const { name, account, label } = parseBank(bankStr);
                  const isMenuOpen = openBankMenuIdx === idx;
                  const isEditing = editingBankIdx === idx;

                  return (
                    <div
                      key={idx}
                      className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-3.5 space-y-2.5 transition-all relative"
                    >
                      {isEditing ? (
                        <div className="space-y-2 animate-in fade-in">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-slate-700 font-mono">Banque</label>
                            <input
                              type="text"
                              value={editBankName}
                              onChange={e => setEditBankName(e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 outline-none focus:border-slate-800"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-slate-700 font-mono">N° Compte</label>
                              <input
                                type="text"
                                value={editBankAccount}
                                onChange={e => setEditBankAccount(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none focus:border-slate-800"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-slate-700 font-mono">Libellé / Devise</label>
                              <input
                                type="text"
                                value={editBankLabel}
                                onChange={e => setEditBankLabel(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 outline-none focus:border-slate-800"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingBankIdx(null)}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                              Annuler
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEditBank(idx)}
                              className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-black cursor-pointer"
                            >
                              Enregistrer
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-100">
                                <Landmark size={15} />
                              </div>
                              <div className="min-w-0">
                                <h6 className="text-xs sm:text-sm font-bold text-slate-900 truncate">{name}</h6>
                                {label && (
                                  <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                                    {label}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* DROPDOWN ACTIONS FOR BANK ACCOUNT */}
                            <div className="relative shrink-0" data-dropdown-box>
                              <button
                                type="button"
                                onClick={() => setOpenBankMenuIdx(isMenuOpen ? null : idx)}
                                className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 ${
                                  isMenuOpen
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                                }`}
                              >
                                <span>Actions</span>
                                <ChevronDown size={13} className={`transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
                              </button>

                              <AnimatePresence>
                                {isMenuOpen && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 4 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 4 }}
                                    transition={{ duration: 0.12 }}
                                    className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-40 text-xs font-medium space-y-0.5"
                                  >
                                    {account && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          copyToClipboard(account, 'Numéro de compte');
                                          setOpenBankMenuIdx(null);
                                        }}
                                        className="w-full px-3 py-1.5 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-800 font-semibold cursor-pointer"
                                      >
                                        <Copy size={13} className="text-slate-500" />
                                        <span>Copier N° Compte</span>
                                      </button>
                                    )}

                                    {canManageAllCampuses && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingBankIdx(idx);
                                          setEditBankName(name);
                                          setEditBankAccount(account);
                                          setEditBankLabel(label);
                                          setOpenBankMenuIdx(null);
                                        }}
                                        className="w-full px-3 py-1.5 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-800 font-semibold cursor-pointer"
                                      >
                                        <Edit2 size={13} className="text-blue-600" />
                                        <span>Modifier détails</span>
                                      </button>
                                    )}

                                    {canManageAllCampuses && (
                                      <div className="pt-1 border-t border-slate-100">
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveBank(bankStr)}
                                          className="w-full px-3 py-1.5 text-left hover:bg-rose-50 text-rose-600 font-bold flex items-center gap-2 cursor-pointer"
                                        >
                                          <Trash2 size={13} />
                                          <span>Supprimer le compte</span>
                                        </button>
                                      </div>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>

                          {account && (
                            <div className="flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/70 text-xs font-mono">
                              <span className="font-bold text-slate-900">{account}</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(account, 'Numéro de compte')}
                                className="text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
                              >
                                {copiedText === account ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: NOUVEAU MODE DE RÈGLEMENT (RESPONSIVE MOBILE / TABLETTE / LAPTOP 14" / DESKTOP) */}
      <AnimatePresence>
        {isAddingCustomMethod && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-5 md:p-6 shadow-2xl border border-slate-200 relative my-auto max-h-[92vh] overflow-y-auto custom-scrollbar"
            >
              {/* Close button */}
              <button
                type="button"
                onClick={() => setIsAddingCustomMethod(false)}
                className="absolute right-3.5 top-3.5 sm:right-4 sm:top-4 p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>

              {/* Modal Header */}
              <div className="flex items-center gap-3 mb-4 pr-6">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center shadow-xs shrink-0">
                  <Wallet size={20} />
                </div>
                <div>
                  <h4 className="text-base sm:text-lg font-bold text-slate-900">Nouveau Mode de Règlement</h4>
                  <p className="text-xs text-slate-500 font-medium">Ajouter une méthode personnalisée d'encaissement</p>
                </div>
              </div>

              {/* Modal Form (Clear high-contrast text inputs) */}
              <form onSubmit={handleSaveCustomMethod} className="space-y-3.5 text-xs">
                {/* Method Name */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-800">Nom de la méthode *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Western Union, Zelle, Chèque Scolaire, Cam Transfert"
                    value={customMethodName}
                    onChange={e => setCustomMethodName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-slate-800 shadow-xs"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-800">Description courte</label>
                  <input
                    type="text"
                    placeholder="Ex: Réception de transferts internationaux ou locaux"
                    value={customMethodDescription}
                    onChange={e => setCustomMethodDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-slate-800 shadow-xs"
                  />
                </div>

                {/* Account ID & Icon type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-800">Numéro Marchand / ID Compte</label>
                    <input
                      type="text"
                      placeholder="Ex: email@zelle.com ou +509..."
                      value={customMethodAccount}
                      onChange={e => setCustomMethodAccount(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-slate-800 shadow-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-800">Type d'icône</label>
                    <select
                      value={customMethodIcon}
                      onChange={e => setCustomMethodIcon(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 outline-none focus:border-slate-800 shadow-xs cursor-pointer"
                    >
                      <option value="credit-card">Carte / Terminal (TPE)</option>
                      <option value="smartphone">Portefeuille Mobile (App/SMS)</option>
                      <option value="landmark">Virement Bancaire</option>
                      <option value="receipt">Bordereau / Reçu</option>
                      <option value="banknote">Espèces / Cash</option>
                      <option value="dollar-sign">Devises / Dollars</option>
                    </select>
                  </div>
                </div>

                {/* Supported Currencies */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-800">Devises acceptées</label>
                  <div className="flex gap-2">
                    {(['HTG', 'USD'] as const).map(curr => {
                      const isSelected = customMethodCurrencies.includes(curr);
                      return (
                        <button
                          key={curr}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              if (customMethodCurrencies.length === 1) {
                                toast.error('Au moins une devise doit être acceptée');
                                return;
                              }
                              setCustomMethodCurrencies(customMethodCurrencies.filter(c => c !== curr));
                            } else {
                              setCustomMethodCurrencies([...customMethodCurrencies, curr]);
                            }
                          }}
                          className={`flex-1 py-2 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {curr} {isSelected ? '✓' : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Rules Checkboxes */}
                <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customMethodRequiresRef}
                      onChange={e => setCustomMethodRequiresRef(e.target.checked)}
                      className="w-4 h-4 rounded text-slate-900 focus:ring-0"
                    />
                    <span className="text-xs font-semibold text-slate-800">Exiger un numéro de bordereau / transaction / référence</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customMethodRequiresBank}
                      onChange={e => setCustomMethodRequiresBank(e.target.checked)}
                      className="w-4 h-4 rounded text-slate-900 focus:ring-0"
                    />
                    <span className="text-xs font-semibold text-slate-800">Nécessite la sélection d'une banque affiliée</span>
                  </label>
                </div>

                {/* Cashier instructions */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-800">Consignes particulières de caisse</label>
                  <textarea
                    rows={2}
                    placeholder="Instructions affichées au caissier lors de la sélection..."
                    value={customMethodInstructions}
                    onChange={e => setCustomMethodInstructions(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-slate-800 resize-none shadow-xs"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddingCustomMethod(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    Enregistrer la Méthode
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
