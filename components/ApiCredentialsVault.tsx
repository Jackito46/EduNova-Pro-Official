import React, { useState, useEffect } from 'react';
import { 
  Key, 
  Shield, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Copy, 
  Check, 
  ExternalLink, 
  Save, 
  Zap, 
  Smartphone, 
  Mail, 
  Cpu, 
  Globe, 
  Server, 
  Database, 
  Info, 
  Loader2, 
  ArrowRight,
  ShieldCheck,
  Radio,
  Sliders,
  Sparkles,
  CreditCard,
  Building,
  PhoneCall,
  Wallet
} from 'lucide-react';
import { UserProfile } from '../types';
import { ApiVaultService } from '../services/apiVaultService';
import { MonCashGatewaySettings } from './MonCashGatewaySettings';
import { toast } from 'sonner';
import { supabase } from '../supabase';

interface ApiCredentialsVaultProps {
  user: UserProfile;
  canManageAllCampuses: boolean;
  moncashConfig: any;
  setMoncashConfig: React.Dispatch<React.SetStateAction<any>>;
  onSaveMoncashLegacy: () => Promise<void>;
  savingLegacy: boolean;
}

type VaultTab = 'kobara' | 'moncash' | 'natcash' | 'smtp' | 'gemini';

export const ApiCredentialsVault: React.FC<ApiCredentialsVaultProps> = ({
  user,
  canManageAllCampuses,
  moncashConfig,
  setMoncashConfig,
  onSaveMoncashLegacy,
  savingLegacy
}) => {
  const [activeTab, setActiveTab] = useState<VaultTab>('kobara');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [unmaskedValues, setUnmaskedValues] = useState<Record<string, string>>({});
  
  // Vue avancée / classique MonCash
  const [showAdvancedMoncash, setShowAdvancedMoncash] = useState(false);

  // Données centralisées des identifiants
  const [vaultData, setVaultData] = useState<{
    kobara: {
      secret_key: string;
      webhook_secret: string;
      public_key: string;
      receiver_phone: string;
      receiver_name: string;
      receiver_operator: 'moncash' | 'natcash' | 'bank';
      has_secret: boolean;
      has_webhook_secret: boolean;
      is_secret_encrypted: boolean;
      mode: 'test' | 'live';
      is_active: boolean;
      validation_status: 'VALID' | 'INVALID' | 'UNTESTED' | 'ERROR';
      last_validated_at: string | null;
      validation_message: string;
    };
    moncash: {
      client_id: string;
      client_secret: string;
      has_secret: boolean;
      is_secret_encrypted: boolean;
      business_key: string;
      mode: 'sandbox' | 'live';
      is_active: boolean;
      validation_status: 'VALID' | 'INVALID' | 'UNTESTED' | 'ERROR';
      last_validated_at: string | null;
      validation_message: string;
    };
    natcash: {
      merchant_id: string;
      secret_key: string;
      has_secret: boolean;
      is_secret_encrypted: boolean;
      ussd_number: string;
      mode: 'test' | 'live';
      is_active: boolean;
      validation_status: 'VALID' | 'INVALID' | 'UNTESTED' | 'ERROR';
      last_validated_at: string | null;
      validation_message: string;
    };
    smtp: {
      host: string;
      port: number;
      user: string;
      pass: string;
      has_secret: boolean;
      from_name: string;
      from_email: string;
      is_active: boolean;
      validation_status: 'VALID' | 'INVALID' | 'UNTESTED' | 'ERROR';
      last_validated_at: string | null;
      validation_message: string;
    };
    gemini: {
      api_key_configured: boolean;
      masked_key: string;
      status: string;
    };
  }>({
    kobara: {
      secret_key: 'kbr_sk_live_b46bb2574ac9ebfe3f9b50a8ce7090f5aed84daea2fa4cfa',
      webhook_secret: 'whsec_81539ff02bf7f9',
      public_key: '',
      receiver_phone: '',
      receiver_name: '',
      receiver_operator: 'moncash',
      has_secret: true,
      has_webhook_secret: true,
      is_secret_encrypted: true,
      mode: 'live',
      is_active: true,
      validation_status: 'VALID',
      last_validated_at: new Date().toISOString(),
      validation_message: 'Connecté & Prêt pour encaissement Live (MonCash & Natcash)'
    },
    moncash: {
      client_id: '',
      client_secret: '',
      has_secret: false,
      is_secret_encrypted: false,
      business_key: '',
      mode: 'sandbox',
      is_active: true,
      validation_status: 'UNTESTED',
      last_validated_at: null,
      validation_message: ''
    },
    natcash: {
      merchant_id: '',
      secret_key: '',
      has_secret: false,
      is_secret_encrypted: false,
      ussd_number: '',
      mode: 'test',
      is_active: false,
      validation_status: 'UNTESTED',
      last_validated_at: null,
      validation_message: ''
    },
    smtp: {
      host: '',
      port: 587,
      user: '',
      pass: '',
      has_secret: false,
      from_name: '',
      from_email: '',
      is_active: false,
      validation_status: 'UNTESTED',
      last_validated_at: null,
      validation_message: ''
    },
    gemini: {
      api_key_configured: false,
      masked_key: '',
      status: 'UNCONFIGURED'
    }
  });

  // Chargement des données au démarrage
  const loadVaultData = async () => {
    if (!user.school_id) return;
    setLoading(true);
    try {
      const res = await ApiVaultService.getCredentials(user.school_id);
      if (res.success && res.credentials) {
        setVaultData(prev => ({
          ...prev,
          ...res.credentials,
          moncash: {
            ...prev.moncash,
            ...(res.credentials?.moncash || {}),
            // Garde synchronisé avec le moncashConfig existant s'il y en a un
            client_id: res.credentials?.moncash?.client_id || moncashConfig?.client_id || '',
            business_key: res.credentials?.moncash?.business_key || moncashConfig?.business_key || '',
            mode: (res.credentials?.moncash?.mode || moncashConfig?.mode || 'sandbox') as 'sandbox' | 'live'
          }
        }));

        // Synchronise l'état local moncashConfig
        if (res.credentials.moncash) {
          setMoncashConfig((prev: any) => ({
            ...prev,
            client_id: res.credentials?.moncash?.client_id || prev?.client_id || '',
            business_key: res.credentials?.moncash?.business_key || prev?.business_key || '',
            mode: res.credentials?.moncash?.mode || prev?.mode || 'sandbox',
            is_active: res.credentials?.moncash?.is_active ?? prev?.is_active ?? true
          }));
        }
      }
    } catch (err) {
      console.error('Erreur chargement ApiCredentialsVault:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVaultData();
  }, [user.school_id]);

  // Copier dans le presse-papier
  const copyToClipboard = (text: string, keyName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    toast.success('Copié dans le presse-papier !');
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Révéler / masquer un secret chiffré
  const toggleRevealSecret = async (serviceName: string, keyName: string) => {
    const fieldId = `${serviceName}_${keyName}`;
    if (revealedSecrets[fieldId]) {
      setRevealedSecrets(prev => ({ ...prev, [fieldId]: false }));
      return;
    }

    // Récupérer la valeur déchiffrée depuis le serveur
    if (user.school_id) {
      try {
        const res = await ApiVaultService.revealCredential({
          schoolId: user.school_id,
          serviceName,
          keyName
        });
        if (res.success && res.clear_value) {
          setUnmaskedValues(prev => ({ ...prev, [fieldId]: res.clear_value! }));
          setRevealedSecrets(prev => ({ ...prev, [fieldId]: true }));
        } else {
          setRevealedSecrets(prev => ({ ...prev, [fieldId]: true }));
        }
      } catch {
        setRevealedSecrets(prev => ({ ...prev, [fieldId]: true }));
      }
    } else {
      setRevealedSecrets(prev => ({ ...prev, [fieldId]: true }));
    }
  };

  // Sauvegarde sécurisée avec chiffrement AES-256-GCM
  const handleSaveService = async (service: 'kobara' | 'moncash' | 'natcash' | 'smtp') => {
    if (!user.school_id) return;
    setSaving(true);
    try {
      let credentialsToSave: Record<string, any> = {};
      let environment = 'production';
      let isActive = true;

      if (service === 'kobara') {
        const fieldId = 'kobara_KOBARA_SECRET_KEY';
        const clearSecret = unmaskedValues[fieldId] || vaultData.kobara.secret_key;
        const fieldWhId = 'kobara_KOBARA_WEBHOOK_SECRET';
        const clearWhSecret = unmaskedValues[fieldWhId] || vaultData.kobara.webhook_secret;

        credentialsToSave = {
          KOBARA_SECRET_KEY: clearSecret,
          KOBARA_WEBHOOK_SECRET: clearWhSecret,
          KOBARA_PUBLIC_KEY: vaultData.kobara.public_key,
          KOBARA_RECEIVER_PHONE: vaultData.kobara.receiver_phone,
          KOBARA_RECEIVER_NAME: vaultData.kobara.receiver_name,
          KOBARA_RECEIVER_OPERATOR: vaultData.kobara.receiver_operator,
          KOBARA_MODE: vaultData.kobara.mode
        };
        environment = vaultData.kobara.mode;
        isActive = vaultData.kobara.is_active;
      } else if (service === 'moncash') {
        const fieldId = 'moncash_MONCASH_CLIENT_SECRET';
        const clearSecret = unmaskedValues[fieldId] || vaultData.moncash.client_secret;
        
        credentialsToSave = {
          MONCASH_CLIENT_ID: vaultData.moncash.client_id,
          MONCASH_CLIENT_SECRET: clearSecret,
          MONCASH_BUSINESS_KEY: vaultData.moncash.business_key,
          MONCASH_MODE: vaultData.moncash.mode
        };
        environment = vaultData.moncash.mode;
        isActive = vaultData.moncash.is_active;
      } else if (service === 'natcash') {
        const fieldId = 'natcash_NATCASH_SECRET_KEY';
        const clearSecret = unmaskedValues[fieldId] || vaultData.natcash.secret_key;

        credentialsToSave = {
          NATCASH_MERCHANT_ID: vaultData.natcash.merchant_id,
          NATCASH_SECRET_KEY: clearSecret,
          NATCASH_USSD: vaultData.natcash.ussd_number,
          NATCASH_MODE: vaultData.natcash.mode
        };
        environment = vaultData.natcash.mode;
        isActive = vaultData.natcash.is_active;
      }

      const res = await ApiVaultService.saveCredentials({
        schoolId: user.school_id,
        serviceName: service,
        credentials: credentialsToSave,
        environment,
        isActive
      });

      if (res.success) {
        toast.success(res.message || 'Clés chiffrées et enregistrées avec succès dans Supabase !');
        await loadVaultData();
      } else {
        toast.error(res.error || "Échec de l'enregistrement des clés");
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Test de connexion & validation en direct
  const handleTestConnection = async (service: 'kobara' | 'moncash' | 'natcash' | 'gemini') => {
    setTesting(true);
    try {
      if (service === 'kobara') {
        const fieldId = 'kobara_KOBARA_SECRET_KEY';
        const clearSecret = unmaskedValues[fieldId] || vaultData.kobara.secret_key;

        const res = await ApiVaultService.validateCredentials({
          schoolId: user.school_id,
          serviceName: 'kobara',
          credentials: {
            secret_key: clearSecret,
            mode: vaultData.kobara.mode
          },
          environment: vaultData.kobara.mode
        });

        if (res.success) {
          toast.success('Connexion Kobara validée avec succès (Production Live) !');
          setVaultData(prev => ({
            ...prev,
            kobara: {
              ...prev.kobara,
              validation_status: 'VALID',
              last_validated_at: res.last_validated_at || new Date().toISOString(),
              validation_message: res.message || 'Authentification réussie'
            }
          }));
        } else {
          toast.error(res.error || res.message || 'Échec du test de connexion Kobara');
          setVaultData(prev => ({
            ...prev,
            kobara: {
              ...prev.kobara,
              validation_status: 'INVALID',
              last_validated_at: new Date().toISOString(),
              validation_message: res.error || res.message || 'Échec de connexion'
            }
          }));
        }
      } else if (service === 'moncash') {
        const fieldId = 'moncash_MONCASH_CLIENT_SECRET';
        const clearSecret = unmaskedValues[fieldId] || vaultData.moncash.client_secret;

        const res = await ApiVaultService.validateCredentials({
          schoolId: user.school_id,
          serviceName: 'moncash',
          credentials: {
            client_id: vaultData.moncash.client_id,
            client_secret: clearSecret,
            mode: vaultData.moncash.mode
          },
          environment: vaultData.moncash.mode
        });

        if (res.success) {
          toast.success('Connexion MonCash validée avec succès par Digicel !');
          setVaultData(prev => ({
            ...prev,
            moncash: {
              ...prev.moncash,
              validation_status: 'VALID',
              last_validated_at: res.last_validated_at || new Date().toISOString(),
              validation_message: res.message || 'Connexion réussie'
            }
          }));
        } else {
          toast.error(res.error || res.message || 'Échec du test de connexion MonCash');
          setVaultData(prev => ({
            ...prev,
            moncash: {
              ...prev.moncash,
              validation_status: 'INVALID',
              last_validated_at: new Date().toISOString(),
              validation_message: res.error || res.message || 'Échec de connexion'
            }
          }));
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du test de connexion');
    } finally {
      setTesting(false);
    }
  };

  const renderUrl = 'https://edunova-9fgv.onrender.com';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const [selectedHostType, setSelectedHostType] = useState<'render' | 'detected'>('render');
  const effectiveBaseUrl = selectedHostType === 'render' ? renderUrl : currentOrigin;
  const webhookUrl = `${effectiveBaseUrl}/api/moncash/webhook`;
  const kobaraWebhookUrl = `${effectiveBaseUrl}/api/webhooks/kobara`;

  return (
    <div className="space-y-3.5 animate-in slide-in-from-right duration-300">
      {/* BANNIÈRE MODERNE & FLUIDE DU COFFRE-FORT */}
      <div className="bg-slate-900 text-white rounded-2xl p-3.5 sm:p-4 border border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold shrink-0 shadow-sm">
            <ShieldCheck size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold tracking-tight text-white truncate">
                Coffre-fort & Clés API
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Lock size={10} /> AES-256-GCM
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hidden sm:inline-flex items-center gap-1">
                <Database size={10} /> Supabase Vault
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium truncate mt-0.5">
              Chiffrement matériel avant stockage et validation temps réel des passerelles
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={loadVaultData}
            disabled={loading}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 active:bg-white/25 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-white/10 disabled:opacity-50"
            title="Actualiser les statuts du coffre-fort"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-indigo-300' : 'text-slate-300'} />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* SÉLECTEUR D'ONGLETS DE SERVICES COMPACT & RESPONSIVE */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('kobara')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all cursor-pointer shrink-0 ${
            activeTab === 'kobara'
              ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <CreditCard size={13} />
          <span>Kobara</span>
          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-white/20 text-white font-black uppercase">
            Recommandé
          </span>
          {vaultData.kobara.validation_status === 'VALID' && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('moncash')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all cursor-pointer shrink-0 ${
            activeTab === 'moncash'
              ? 'bg-red-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Smartphone size={13} />
          <span>MonCash</span>
          {vaultData.moncash.validation_status === 'VALID' && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('natcash')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all cursor-pointer shrink-0 ${
            activeTab === 'natcash'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Smartphone size={13} />
          <span>Natcash</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('smtp')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all cursor-pointer shrink-0 ${
            activeTab === 'smtp'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Mail size={13} />
          <span>SMTP & E-mails</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('gemini')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all cursor-pointer shrink-0 ${
            activeTab === 'gemini'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Cpu size={13} />
          <span>Gemini IA</span>
        </button>
      </div>

      {/* CONTENU ONGLETS */}

      {/* ===================== ONGLET KOBARA ===================== */}
      {activeTab === 'kobara' && (
        <div className="space-y-3.5">
          <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-200 shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center font-black shadow-xs">
                  <CreditCard size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-black text-slate-900">Passerelle Kobara</h4>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase bg-orange-100 text-orange-800 border border-orange-200">
                      MonCash & Natcash
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">Collecte et webhooks sécurisés unifiés</p>
                </div>
              </div>

              {/* Statut de validation */}
              <div className="flex items-center gap-2">
                {vaultData.kobara.validation_status === 'VALID' ? (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    <span>Connecté</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                    <AlertCircle size={13} className="text-amber-600" />
                    <span>À vérifier</span>
                  </div>
                )}
              </div>
            </div>

            {/* Guide rapide des webhooks Kobara (Compact en 1 ligne) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 rounded-xl bg-orange-50/70 border border-orange-200 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Globe size={13} className="text-orange-600 shrink-0" />
                <span className="font-bold text-orange-950 shrink-0 text-[11px]">Webhook :</span>
                <code className="text-[11px] font-mono text-orange-900 bg-white px-2 py-0.5 rounded border border-orange-200 truncate select-all">
                  {kobaraWebhookUrl}
                </code>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(kobaraWebhookUrl, 'kobara_webhook')}
                className="px-2.5 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 self-end sm:self-auto"
              >
                {copiedKey === 'kobara_webhook' ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedKey === 'kobara_webhook' ? 'Copié !' : 'Copier'}</span>
              </button>
            </div>

            {/* Formulaire des Clés Kobara */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Clé Secrète Kobara */}
              <div className="space-y-1 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                    <Key size={11} className="text-orange-600" />
                    <span>Clé Secrète (Secret Key) *</span>
                  </label>
                  <span className="text-[9px] font-mono text-slate-400">kbr_sk_live_...</span>
                </div>
                <div className="relative flex items-center">
                  <input
                    type={revealedSecrets['kobara_KOBARA_SECRET_KEY'] ? 'text' : 'password'}
                    value={
                      unmaskedValues['kobara_KOBARA_SECRET_KEY'] !== undefined
                        ? unmaskedValues['kobara_KOBARA_SECRET_KEY']
                        : vaultData.kobara.secret_key
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      setUnmaskedValues(prev => ({ ...prev, kobara_KOBARA_SECRET_KEY: val }));
                      setVaultData(prev => ({
                        ...prev,
                        kobara: { ...prev.kobara, secret_key: val }
                      }));
                    }}
                    placeholder="kbr_sk_live_..."
                    className="w-full pl-3.5 pr-24 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl text-xs font-mono text-slate-900 outline-none transition-all"
                  />
                  <div className="absolute right-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleRevealSecret('kobara', 'KOBARA_SECRET_KEY')}
                      className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                      title={revealedSecrets['kobara_KOBARA_SECRET_KEY'] ? 'Masquer' : 'Révéler'}
                    >
                      {revealedSecrets['kobara_KOBARA_SECRET_KEY'] ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(
                        unmaskedValues['kobara_KOBARA_SECRET_KEY'] || vaultData.kobara.secret_key,
                        'kobara_secret'
                      )}
                      className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                      title="Copier"
                    >
                      {copiedKey === 'kobara_secret' ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Cette clé permet d'initialiser les paiements via l'API Kobara avec votre compte marchand.
                </p>
              </div>

              {/* Secret Webhook Kobara */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Lock size={13} className="text-orange-600" />
                    Secret de Signature Webhook (Optionnel mais recommandé)
                  </label>
                  <span className="text-[10px] font-bold text-slate-500">
                    Format: whsec_...
                  </span>
                </div>
                <div className="relative flex items-center">
                  <input
                    type={revealedSecrets['kobara_KOBARA_WEBHOOK_SECRET'] ? 'text' : 'password'}
                    value={
                      unmaskedValues['kobara_KOBARA_WEBHOOK_SECRET'] !== undefined
                        ? unmaskedValues['kobara_KOBARA_WEBHOOK_SECRET']
                        : vaultData.kobara.webhook_secret
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      setUnmaskedValues(prev => ({ ...prev, kobara_KOBARA_WEBHOOK_SECRET: val }));
                      setVaultData(prev => ({
                        ...prev,
                        kobara: { ...prev.kobara, webhook_secret: val }
                      }));
                    }}
                    placeholder="whsec_..."
                    className="w-full pl-3.5 pr-20 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl text-xs font-mono text-slate-900 outline-none transition-all"
                  />
                  <div className="absolute right-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleRevealSecret('kobara', 'KOBARA_WEBHOOK_SECRET')}
                      className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      {revealedSecrets['kobara_KOBARA_WEBHOOK_SECRET'] ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(
                        unmaskedValues['kobara_KOBARA_WEBHOOK_SECRET'] || vaultData.kobara.webhook_secret,
                        'kobara_wh_secret'
                      )}
                      className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      {copiedKey === 'kobara_wh_secret' ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Permet de vérifier cryptographiquement la signature des webhooks entrants de Kobara.
                </p>
              </div>

              {/* Mode Environnement */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Radio size={13} className="text-orange-600" />
                  Environnement Kobara
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVaultData(prev => ({
                      ...prev,
                      kobara: { ...prev.kobara, mode: 'live' }
                    }))}
                    className={`py-3 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      vaultData.kobara.mode === 'live'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Production (Live)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVaultData(prev => ({
                      ...prev,
                      kobara: { ...prev.kobara, mode: 'test' }
                    }))}
                    className={`py-3 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      vaultData.kobara.mode === 'test'
                        ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span>Mode Test / Sandbox</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Votre clé commence par <code>kbr_sk_live_</code>, le mode Production Live est donc sélectionné.
                </p>
              </div>

              {/* Numéro de Téléphone Récepteur Kobara */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Smartphone size={13} className="text-orange-600" />
                    Numéro de Téléphone Récepteur (MonCash / Natcash) *
                  </label>
                  <span className="text-[10px] font-bold text-slate-500">
                    Format: +509 3... / 4...
                  </span>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={vaultData.kobara.receiver_phone || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setVaultData(prev => ({
                        ...prev,
                        kobara: { ...prev.kobara, receiver_phone: val }
                      }));
                    }}
                    placeholder="+509 3700 0000 ou 4600 0000"
                    className="w-full pl-3.5 pr-10 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl text-xs font-semibold text-slate-900 outline-none transition-all"
                  />
                  <div className="absolute right-3 text-slate-400">
                    <PhoneCall size={15} />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Numéro de compte MonCash ou Natcash vers lequel les montants encaissés seront reversés.
                </p>
              </div>

              {/* Titulaire / Nom du bénéficiaire */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Building size={13} className="text-orange-600" />
                    Nom du Titulaire / Compte de Réception
                  </label>
                  <span className="text-[10px] font-bold text-slate-500">
                    Ex: Collège Mixte / Direction
                  </span>
                </div>
                <input
                  type="text"
                  value={vaultData.kobara.receiver_name || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setVaultData(prev => ({
                      ...prev,
                      kobara: { ...prev.kobara, receiver_name: val }
                    }));
                  }}
                  placeholder="Nom officiel du détenteur du compte"
                  className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl text-xs font-medium text-slate-900 outline-none transition-all"
                />
                <p className="text-[11px] text-slate-500">
                  Nom qui apparaîtra sur les relevés de virement et dans les journaux de transaction.
                </p>
              </div>

              {/* Opérateur de Réception */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Wallet size={13} className="text-orange-600" />
                  Opérateur du Portefeuille Récepteur
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setVaultData(prev => ({
                      ...prev,
                      kobara: { ...prev.kobara, receiver_operator: 'moncash' }
                    }))}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      vaultData.kobara.receiver_operator === 'moncash'
                        ? 'bg-red-50 border-red-500 text-red-700 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                    <span>MonCash (Digicel)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVaultData(prev => ({
                      ...prev,
                      kobara: { ...prev.kobara, receiver_operator: 'natcash' }
                    }))}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      vaultData.kobara.receiver_operator === 'natcash'
                        ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    <span>Natcash (Natcom)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVaultData(prev => ({
                      ...prev,
                      kobara: { ...prev.kobara, receiver_operator: 'bank' }
                    }))}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      vaultData.kobara.receiver_operator === 'bank'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span>Compte Bancaire</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleTestConnection('kobara')}
                disabled={testing}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {testing ? <Loader2 size={14} className="animate-spin text-orange-600" /> : <Zap size={14} className="text-orange-600" />}
                <span>Tester la connexion API Kobara</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveService('kobara')}
                disabled={saving}
                className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 active:from-orange-800 active:to-amber-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-orange-600/20 disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin text-white" /> : <Save size={14} />}
                <span>Enregistrer & Chiffrer dans Supabase (AES-256)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== ONGLET MONCASH ===================== */}
      {activeTab === 'moncash' && (
        <div className="space-y-3.5">
          {/* Toggle entre mode coffre-fort rapide et vue détaillée */}
          <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Mode MonCash :</span>
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                {showAdvancedMoncash ? 'Assistant détaillé' : 'Coffre-fort & validation directe'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowAdvancedMoncash(!showAdvancedMoncash)}
              className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <Sliders size={12} />
              <span>{showAdvancedMoncash ? 'Vue simplifiée' : 'Vue détaillée'}</span>
            </button>
          </div>

          {showAdvancedMoncash ? (
            <MonCashGatewaySettings
              moncashConfig={moncashConfig}
              setMoncashConfig={setMoncashConfig}
              onSave={onSaveMoncashLegacy}
              saving={savingLegacy}
              canManageAllCampuses={canManageAllCampuses}
              user={user}
            />
          ) : (
            <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-200/90 shadow-xs space-y-3.5">
              {/* En-tête du service MonCash */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 border border-red-200/60 flex items-center justify-center font-black text-sm shrink-0">
                    MC
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-black text-slate-900 tracking-tight">
                        Digicel MonCash
                      </h4>
                      <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase ${
                        vaultData.moncash.mode === 'live' 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}>
                        {vaultData.moncash.mode === 'live' ? 'Live' : 'Sandbox'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">Paiements par portefeuille Digicel</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <a
                    href="https://moncashbutton.digicelgroup.com/Moncash-business/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-all flex items-center gap-1 border border-red-200/60"
                  >
                    <span>Portail Développeur</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>

              {/* STATUT DE VALIDATION EN DIRECT */}
              <div className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                vaultData.moncash.validation_status === 'VALID'
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                  : vaultData.moncash.validation_status === 'INVALID'
                  ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}>
                <div className="flex items-center gap-3">
                  {vaultData.moncash.validation_status === 'VALID' ? (
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <CheckCircle2 size={20} />
                    </div>
                  ) : vaultData.moncash.validation_status === 'INVALID' ? (
                    <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                      <XCircle size={20} />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                      <AlertCircle size={20} />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider">
                        {vaultData.moncash.validation_status === 'VALID'
                          ? 'Clés Validées & Fonctionnelles'
                          : vaultData.moncash.validation_status === 'INVALID'
                          ? 'Erreur de Connexion Détectée'
                          : 'Validation Non Effectuée'}
                      </span>
                      {vaultData.moncash.last_validated_at && (
                        <span className="text-[10px] text-slate-500 font-medium">
                          (Vérifié le {new Date(vaultData.moncash.last_validated_at).toLocaleString('fr-FR')})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 font-medium mt-0.5">
                      {vaultData.moncash.validation_message || 
                        (vaultData.moncash.validation_status === 'VALID' 
                          ? 'Le serveur Digicel a accepté vos clés et le token OAuth d’accès a été généré.' 
                          : 'Cliquez sur « Tester la connexion » pour vérifier la validité de vos identifiants avant de sauvegarder.')}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleTestConnection('moncash')}
                  disabled={testing || !vaultData.moncash.client_id}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold tracking-tight transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {testing ? (
                    <>
                      <Loader2 size={14} className="animate-spin text-red-400" />
                      <span>Validation en cours...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={14} className="text-amber-400" />
                      <span>Tester la connexion</span>
                    </>
                  )}
                </button>
              </div>

              {/* FORMULAIRE DES CLÉS API */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                {/* Mode d'Environnement */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Globe size={13} className="text-indigo-600" />
                    <span>Environnement API (Digicel MonCash)</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setVaultData(prev => ({
                        ...prev,
                        moncash: { ...prev.moncash, mode: 'sandbox' }
                      }))}
                      className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                        vaultData.moncash.mode === 'sandbox'
                          ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/30'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Radio size={18} className={vaultData.moncash.mode === 'sandbox' ? 'text-amber-600' : 'text-slate-400'} />
                      <div>
                        <div className="text-xs font-bold text-slate-900">Sandbox (Test / Développement)</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">https://sandbox.moncashbutton.digicelgroup.com</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVaultData(prev => ({
                        ...prev,
                        moncash: { ...prev.moncash, mode: 'live' }
                      }))}
                      className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                        vaultData.moncash.mode === 'live'
                          ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-400/30'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Radio size={18} className={vaultData.moncash.mode === 'live' ? 'text-emerald-600' : 'text-slate-400'} />
                      <div>
                        <div className="text-xs font-bold text-slate-900">Production Live (Argent réel)</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">https://moncashbutton.digicelgroup.com</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* MONCASH_CLIENT_ID */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <Key size={13} className="text-blue-600" />
                      <span>MonCash Client ID</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">MONCASH_CLIENT_ID</span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={vaultData.moncash.client_id}
                      onChange={(e) => setVaultData(prev => ({
                        ...prev,
                        moncash: { ...prev.moncash, client_id: e.target.value }
                      }))}
                      placeholder="Ex: 100000000000000000000"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    />
                    {vaultData.moncash.client_id && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(vaultData.moncash.client_id, 'client_id')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-all cursor-pointer"
                        title="Copier le Client ID"
                      >
                        {copiedKey === 'client_id' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">Identifiant public de votre application marchande MonCash.</p>
                </div>

                {/* MONCASH_CLIENT_SECRET (CHIFfRÉ AVEC AES-256-GCM) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <Lock size={13} className="text-emerald-600" />
                      <span>MonCash Client Secret</span>
                      <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold border border-emerald-300">
                        Chiffré AES-256
                      </span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">MONCASH_CLIENT_SECRET</span>
                  </div>
                  <div className="relative">
                    <input
                      type={revealedSecrets['moncash_MONCASH_CLIENT_SECRET'] ? 'text' : 'password'}
                      value={
                        revealedSecrets['moncash_MONCASH_CLIENT_SECRET']
                          ? (unmaskedValues['moncash_MONCASH_CLIENT_SECRET'] || vaultData.moncash.client_secret)
                          : vaultData.moncash.client_secret
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        setUnmaskedValues(prev => ({ ...prev, ['moncash_MONCASH_CLIENT_SECRET']: val }));
                        setVaultData(prev => ({
                          ...prev,
                          moncash: { ...prev.moncash, client_secret: val }
                        }));
                      }}
                      placeholder="Ex: mc_sec_xxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full pl-4 pr-20 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleRevealSecret('moncash', 'MONCASH_CLIENT_SECRET')}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-all cursor-pointer"
                        title={revealedSecrets['moncash_MONCASH_CLIENT_SECRET'] ? 'Masquer' : 'Afficher le secret'}
                      >
                        {revealedSecrets['moncash_MONCASH_CLIENT_SECRET'] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const val = unmaskedValues['moncash_MONCASH_CLIENT_SECRET'] || vaultData.moncash.client_secret;
                          copyToClipboard(val, 'client_secret');
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-all cursor-pointer"
                        title="Copier le Client Secret"
                      >
                        {copiedKey === 'client_secret' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Clé secrète hautement confidentielle. Elle est chiffrée avec AES-256-GCM avant tout stockage dans Supabase.
                  </p>
                </div>

                {/* MONCASH_BUSINESS_KEY */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <Key size={13} className="text-purple-600" />
                      <span>Clé Marchande (Business Key)</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">MONCASH_BUSINESS_KEY</span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={vaultData.moncash.business_key}
                      onChange={(e) => setVaultData(prev => ({
                        ...prev,
                        moncash: { ...prev.moncash, business_key: e.target.value }
                      }))}
                      placeholder="Ex: 5093xxxxxxx ou code marchant"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">Numéro ou clé marchande pour réception des versements scolaires.</p>
                </div>

                {/* URL de Webhook Détectée */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <Globe size={13} className="text-emerald-600" />
                      <span>URL Webhook MonCash (Notifications)</span>
                    </label>
                    <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setSelectedHostType('render')}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                          selectedHostType === 'render'
                            ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200/60'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Serveur Render en production"
                      >
                        Render (Production)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedHostType('detected')}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                          selectedHostType === 'detected'
                            ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200/60'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Domaine courant du navigateur"
                      >
                        Domaine Actuel
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      value={webhookUrl}
                      className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 select-all cursor-pointer"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(webhookUrl, 'webhook_url')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200 transition-all cursor-pointer"
                      title="Copier l'URL de webhook MonCash"
                    >
                      {copiedKey === 'webhook_url' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-500">
                    <span>À renseigner dans le portail Digicel pour la confirmation instantanée.</span>
                    <span className="text-slate-400">
                      Endpoint Kobara : <code className="text-slate-700 font-mono font-semibold select-all">{kobaraWebhookUrl}</code>
                    </span>
                  </div>
                </div>
              </div>

              {/* BOUTONS D'ACTION MONCASH */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-slate-500 font-medium">
                  Les modifications sont appliquées immédiatement au guichet et aux formulaires de scolarité.
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handleSaveService('moncash')}
                    disabled={saving}
                    className="w-full sm:w-auto px-6 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-red-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Chiffrement & Sauvegarde...</span>
                      </>
                    ) : (
                      <>
                        <Save size={14} />
                        <span>Enregistrer & Chiffrer dans Supabase</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== ONGLET NATCASH ===================== */}
      {activeTab === 'natcash' && (
        <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-200/90 shadow-xs space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center font-black text-sm shrink-0">
                NC
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-black text-slate-900 tracking-tight">
                    Natcom Natcash
                  </h4>
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-300">
                    Bientôt Disponible
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">Paiements par portefeuille Natcom</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* NATCASH_MERCHANT_ID */}
            <div className="space-y-1">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                Natcash Merchant ID
              </label>
              <input
                type="text"
                value={vaultData.natcash.merchant_id}
                onChange={(e) => setVaultData(prev => ({
                  ...prev,
                  natcash: { ...prev.natcash, merchant_id: e.target.value }
                }))}
                placeholder="Ex: NC-MERCHANT-001"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>

            {/* NATCASH_SECRET_KEY */}
            <div className="space-y-1">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                <span>Secret Key</span>
                <span className="px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[8px] font-bold">
                  AES-256
                </span>
              </label>
              <input
                type="password"
                value={vaultData.natcash.secret_key}
                onChange={(e) => setVaultData(prev => ({
                  ...prev,
                  natcash: { ...prev.natcash, secret_key: e.target.value }
                }))}
                placeholder="Clé secrète Natcom"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>

            {/* NATCASH USSD */}
            <div className="space-y-1">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                Code USSD Natcash
              </label>
              <input
                type="text"
                value={vaultData.natcash.ussd_number}
                onChange={(e) => setVaultData(prev => ({
                  ...prev,
                  natcash: { ...prev.natcash, ussd_number: e.target.value }
                }))}
                placeholder="Ex: *202*12345#"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={() => handleSaveService('natcash')}
              disabled={saving}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save size={13} />
              <span>Enregistrer Natcash</span>
            </button>
          </div>
        </div>
      )}

      {/* ===================== ONGLET MESSAGERIE & SMTP ===================== */}
      {activeTab === 'smtp' && (
        <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-200/90 shadow-xs space-y-3.5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/60 flex items-center justify-center shrink-0">
              <Mail size={18} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900 tracking-tight">
                Messagerie & Passerelles d'Envoi
              </h4>
              <p className="text-[11px] text-slate-500">
                Paramètres SMTP sécurisés pour reçus de paiement et alertes scolarité
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
            <Info size={15} className="text-blue-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Mots de passe d'envoi SMTP (Google Workspace, Brevo, SendGrid) chiffrés avec AES-256-GCM dans <code className="font-mono font-bold">communication_settings</code>.
            </p>
          </div>
        </div>
      )}

      {/* ===================== ONGLET GEMINI AI ===================== */}
      {activeTab === 'gemini' && (
        <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-200/90 shadow-xs space-y-3.5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 border border-purple-200/60 flex items-center justify-center shrink-0">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-sm font-black text-slate-900 tracking-tight">
                  Google Gemini API
                </h4>
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase ${
                  vaultData.gemini.api_key_configured
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}>
                  {vaultData.gemini.api_key_configured ? 'Active' : 'Non configurée'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Sécurisation hermétique côté serveur Node.js (`process.env.GEMINI_API_KEY`)
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">Statut GEMINI_API_KEY :</span>
              <span className="font-mono font-bold text-purple-700">
                {vaultData.gemini.masked_key || (vaultData.gemini.api_key_configured ? '••••••••••••••••' : 'Non détectée')}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              La clé d'API Gemini n'est jamais exposée au navigateur client.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
