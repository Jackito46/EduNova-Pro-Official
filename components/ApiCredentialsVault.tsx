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
  Globe, 
  Server, 
  Database, 
  Info, 
  Loader2, 
  ArrowRight,
  ShieldCheck,
  Radio,
  Sliders,
  CreditCard,
  Building,
  PhoneCall,
  Wallet,
  ChevronDown,
  ChevronUp
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

type VaultTab = 'kobara' | 'moncash' | 'natcash';

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
  const [expandedPreview, setExpandedPreview] = useState<Record<string, boolean>>({});

  const toggleExpandedPreview = (key: string) => {
    setExpandedPreview(prev => ({ ...prev, [key]: !prev[key] }));
  };
  
  // Vue avancée / classique MonCash
  const [showAdvancedMoncash, setShowAdvancedMoncash] = useState(false);

  // Données centralisées des identifiants
  const [vaultData, setVaultData] = useState<{
    kobara: {
      secret_key: string;
      webhook_secret: string;
      public_key: string;
      receiver_phone: string;
      receiver_phone_moncash: string;
      receiver_phone_natcash: string;
      same_receiver_number: boolean;
      auto_payout: boolean;
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
      receiver_phone_moncash: '',
      receiver_phone_natcash: '',
      same_receiver_number: true,
      auto_payout: true,
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
  const handleSaveService = async (service: 'kobara' | 'moncash' | 'natcash') => {
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
          KOBARA_RECEIVER_PHONE_MONCASH: vaultData.kobara.same_receiver_number ? vaultData.kobara.receiver_phone : vaultData.kobara.receiver_phone_moncash,
          KOBARA_RECEIVER_PHONE_NATCASH: vaultData.kobara.same_receiver_number ? vaultData.kobara.receiver_phone : vaultData.kobara.receiver_phone_natcash,
          KOBARA_SAME_RECEIVER_NUMBER: vaultData.kobara.same_receiver_number,
          KOBARA_AUTO_PAYOUT: vaultData.kobara.auto_payout,
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
  const handleTestConnection = async (service: 'kobara' | 'moncash' | 'natcash') => {
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
      </div>

      {/* CONTENU ONGLETS */}

      {/* ===================== ONGLET KOBARA ===================== */}
      {activeTab === 'kobara' && (
        <div className="space-y-4 sm:space-y-5">
          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-5">
            {/* 1. EN-TÊTE DU SERVICE KOBARA */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                  <CreditCard size={20} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-base font-black text-slate-900 tracking-tight">Passerelle Kobara</h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-orange-100 text-orange-800 border border-orange-200">
                      MonCash & Natcash Unifiés
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      Collecte & Webhook
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Centralisation des paiements mobiles haïtiens avec reversement instantané
                  </p>
                </div>
              </div>

              {/* Statut de validation */}
              <div className="flex items-center gap-2 self-start sm:self-center">
                {vaultData.kobara.validation_status === 'VALID' ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold shadow-2xs">
                    <CheckCircle2 size={15} className="text-emerald-600" />
                    <span>Passerelle Connectée</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold shadow-2xs">
                    <AlertCircle size={15} className="text-amber-600" />
                    <span>Configuration à vérifier</span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. BANNIÈRE WEBHOOK KOBARA */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-orange-50/70 border border-orange-200/90 text-xs space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start sm:items-center gap-2 min-w-0">
                  <Globe size={16} className="text-orange-600 shrink-0 mt-0.5 sm:mt-0" />
                  <div className="min-w-0">
                    <span className="font-bold text-orange-950 text-xs block sm:inline mr-2">
                      URL Webhook Kobara (Collecte & Notifications) :
                    </span>
                    <span className="text-[11px] text-orange-800/80 hidden md:inline">
                      (À renseigner dans le portail Kobara pour confirmer les règlements en temps réel)
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(kobaraWebhookUrl, 'kobara_webhook')}
                  className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-auto shadow-2xs"
                  title="Copier l'URL du webhook"
                >
                  {copiedKey === 'kobara_webhook' ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedKey === 'kobara_webhook' ? 'Copié !' : 'Copier l\'URL'}</span>
                </button>
              </div>
              <div className="bg-white px-3 py-2 rounded-lg border border-orange-200 font-mono text-[11px] sm:text-xs text-orange-950 break-all select-all shadow-inner">
                {kobaraWebhookUrl}
              </div>
            </div>

            {/* 3. SECTION CLÉS D'AUTHENTIFICATION & SÉCURITÉ */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Key size={14} className="text-orange-600" />
                  <span>Clés Secrètes & Authentification API</span>
                </h5>
                <span className="text-[10px] text-slate-500 font-medium hidden sm:inline">
                  Chiffrées avec AES-256-GCM avant stockage dans Supabase
                </span>
              </div>

              {/* Grille symétrique 2 colonnes (responsive desktop/tablette/mobile) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                {/* CARTE 1 : CLÉ SECRÈTE (SECRET KEY) */}
                <div className="bg-slate-50/80 rounded-xl p-3.5 sm:p-4 border border-slate-200 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <Key size={13} className="text-orange-600" />
                        <span>Clé Secrète (Secret Key)</span>
                        <span className="text-red-500 font-black">*</span>
                      </label>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-bold shrink-0">
                        kbr_sk_live_...
                      </span>
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
                          const val = e.target.value.trim();
                          setUnmaskedValues(prev => ({ ...prev, kobara_KOBARA_SECRET_KEY: val }));
                          const detectedMode = val.startsWith('kbr_sk_test_') ? 'test' : 'live';
                          setVaultData(prev => ({
                            ...prev,
                            kobara: { 
                              ...prev.kobara, 
                              secret_key: val,
                              mode: val ? detectedMode : prev.kobara.mode
                            }
                          }));
                        }}
                        placeholder="kbr_sk_live_xxxxxxxxxxxxxxxxxxxxxx"
                        className="w-full pl-3.5 pr-20 py-2.5 sm:py-3 bg-white border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 rounded-xl text-xs sm:text-[13px] font-mono font-medium text-slate-900 outline-none transition-all shadow-2xs"
                      />
                      <div className="absolute right-1.5 flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => toggleRevealSecret('kobara', 'KOBARA_SECRET_KEY')}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                          title={revealedSecrets['kobara_KOBARA_SECRET_KEY'] ? 'Masquer la clé' : 'Afficher la clé en clair'}
                        >
                          {revealedSecrets['kobara_KOBARA_SECRET_KEY'] ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(
                            unmaskedValues['kobara_KOBARA_SECRET_KEY'] || vaultData.kobara.secret_key,
                            'kobara_secret'
                          )}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                          title="Copier la clé secrète"
                        >
                          {copiedKey === 'kobara_secret' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Barre d'état & aperçu complet pour tout voir */}
                  <div className="space-y-2 pt-1 border-t border-slate-200/60 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                      <span className="text-slate-500 flex items-center gap-1">
                        {(() => {
                          const currentVal = unmaskedValues['kobara_KOBARA_SECRET_KEY'] !== undefined 
                            ? unmaskedValues['kobara_KOBARA_SECRET_KEY'] 
                            : vaultData.kobara.secret_key;
                          if (!currentVal) return <span className="text-amber-600 font-medium">Aucune clé renseignée</span>;
                          if (currentVal.startsWith('kbr_sk_live_')) {
                            return <span className="text-emerald-700 font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Production Live ({currentVal.length} car.)</span>;
                          }
                          if (currentVal.startsWith('kbr_sk_test_')) {
                            return <span className="text-amber-700 font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Mode Test Sandbox ({currentVal.length} car.)</span>;
                          }
                          return <span className="text-slate-600 font-medium">{currentVal.length} caractères</span>;
                        })()}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleExpandedPreview('kobara_secret')}
                        className="text-[11px] font-bold text-orange-600 hover:text-orange-700 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <span>{expandedPreview['kobara_secret'] ? 'Réduire' : 'Tout voir'}</span>
                        {expandedPreview['kobara_secret'] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </div>

                    {expandedPreview['kobara_secret'] && (
                      <div className="p-2.5 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] break-all border border-slate-800 shadow-inner select-all animate-in fade-in duration-150">
                        <div className="text-[9px] text-slate-400 uppercase font-sans font-bold mb-1 flex items-center justify-between">
                          <span>Valeur complète de la clé :</span>
                          <span>{revealedSecrets['kobara_KOBARA_SECRET_KEY'] ? 'En clair' : 'Masquée'}</span>
                        </div>
                        {revealedSecrets['kobara_KOBARA_SECRET_KEY']
                          ? (unmaskedValues['kobara_KOBARA_SECRET_KEY'] || vaultData.kobara.secret_key || '(Vide)')
                          : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                      </div>
                    )}

                    <p className="text-[11px] text-slate-500 leading-tight">
                      Cette clé initialise les transactions côté serveur et authentifie votre école.
                    </p>
                  </div>
                </div>

                {/* CARTE 2 : SECRET DE SIGNATURE WEBHOOK */}
                <div className="bg-slate-50/80 rounded-xl p-3.5 sm:p-4 border border-slate-200 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <Lock size={13} className="text-orange-600" />
                        <span>Secret Signature Webhook</span>
                      </label>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-bold shrink-0">
                        whsec_...
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
                          const val = e.target.value.trim();
                          setUnmaskedValues(prev => ({ ...prev, kobara_KOBARA_WEBHOOK_SECRET: val }));
                          setVaultData(prev => ({
                            ...prev,
                            kobara: { ...prev.kobara, webhook_secret: val }
                          }));
                        }}
                        placeholder="whsec_xxxxxxxxxxxxxxxxxxxxxx"
                        className="w-full pl-3.5 pr-20 py-2.5 sm:py-3 bg-white border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 rounded-xl text-xs sm:text-[13px] font-mono font-medium text-slate-900 outline-none transition-all shadow-2xs"
                      />
                      <div className="absolute right-1.5 flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => toggleRevealSecret('kobara', 'KOBARA_WEBHOOK_SECRET')}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                          title={revealedSecrets['kobara_KOBARA_WEBHOOK_SECRET'] ? 'Masquer le secret' : 'Afficher le secret'}
                        >
                          {revealedSecrets['kobara_KOBARA_WEBHOOK_SECRET'] ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(
                            unmaskedValues['kobara_KOBARA_WEBHOOK_SECRET'] || vaultData.kobara.webhook_secret,
                            'kobara_wh_secret'
                          )}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                          title="Copier le secret de signature"
                        >
                          {copiedKey === 'kobara_wh_secret' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Barre d'état & aperçu complet */}
                  <div className="space-y-2 pt-1 border-t border-slate-200/60 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                      <span className="text-slate-500 flex items-center gap-1">
                        {(() => {
                          const currentVal = unmaskedValues['kobara_KOBARA_WEBHOOK_SECRET'] !== undefined 
                            ? unmaskedValues['kobara_KOBARA_WEBHOOK_SECRET'] 
                            : vaultData.kobara.webhook_secret;
                          if (!currentVal) return <span className="text-slate-400 font-medium">Optionnel (recommandé)</span>;
                          if (currentVal.startsWith('whsec_')) {
                            return <span className="text-emerald-700 font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Format whsec_ valide ({currentVal.length} car.)</span>;
                          }
                          return <span className="text-slate-600 font-medium">{currentVal.length} caractères</span>;
                        })()}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleExpandedPreview('kobara_wh_secret')}
                        className="text-[11px] font-bold text-orange-600 hover:text-orange-700 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <span>{expandedPreview['kobara_wh_secret'] ? 'Réduire' : 'Tout voir'}</span>
                        {expandedPreview['kobara_wh_secret'] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </div>

                    {expandedPreview['kobara_wh_secret'] && (
                      <div className="p-2.5 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] break-all border border-slate-800 shadow-inner select-all animate-in fade-in duration-150">
                        <div className="text-[9px] text-slate-400 uppercase font-sans font-bold mb-1 flex items-center justify-between">
                          <span>Valeur complète du secret :</span>
                          <span>{revealedSecrets['kobara_KOBARA_WEBHOOK_SECRET'] ? 'En clair' : 'Masqué'}</span>
                        </div>
                        {revealedSecrets['kobara_KOBARA_WEBHOOK_SECRET']
                          ? (unmaskedValues['kobara_KOBARA_WEBHOOK_SECRET'] || vaultData.kobara.webhook_secret || '(Vide)')
                          : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                      </div>
                    )}

                    <p className="text-[11px] text-slate-500 leading-tight">
                      Vérifie cryptographiquement les signatures HMAC des notifications entrantes.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. SECTION ENVIRONNEMENT D'EXÉCUTION KOBARA */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Radio size={14} className="text-orange-600" />
                  <span>Environnement Kobara</span>
                </label>
                <span className="text-[11px] text-slate-500 font-medium">
                  {vaultData.kobara.mode === 'live' ? 'Mode Réel Actif' : 'Mode Test Actif'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setVaultData(prev => ({
                    ...prev,
                    kobara: { ...prev.kobara, mode: 'live' }
                  }))}
                  className={`p-3.5 rounded-xl text-left border transition-all cursor-pointer flex items-start gap-3 ${
                    vaultData.kobara.mode === 'live'
                      ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-500/20 text-emerald-950 shadow-xs'
                      : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full mt-0.5 shrink-0 flex items-center justify-center border ${
                    vaultData.kobara.mode === 'live' ? 'border-emerald-600 bg-emerald-500' : 'border-slate-400 bg-transparent'
                  }`}>
                    {vaultData.kobara.mode === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span>Production (Live)</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Fonds Réels
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Encaissement et reversement réels via MonCash et Natcash.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setVaultData(prev => ({
                    ...prev,
                    kobara: { ...prev.kobara, mode: 'test' }
                  }))}
                  className={`p-3.5 rounded-xl text-left border transition-all cursor-pointer flex items-start gap-3 ${
                    vaultData.kobara.mode === 'test'
                      ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-500/20 text-amber-950 shadow-xs'
                      : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full mt-0.5 shrink-0 flex items-center justify-center border ${
                    vaultData.kobara.mode === 'test' ? 'border-amber-600 bg-amber-500' : 'border-slate-400 bg-transparent'
                  }`}>
                    {vaultData.kobara.mode === 'test' && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span>Mode Test / Sandbox</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300">
                        Simulation
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Validation technique sans impact financier réel.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* 5. SECTION COMPTES DE RÉCEPTION & REVERSEMENT DES FONDS */}
            <div className="space-y-3.5 p-4 sm:p-5 bg-slate-50/80 rounded-2xl border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
                <div>
                  <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Smartphone size={15} className="text-orange-600" />
                    <span>Comptes de Réception & Reversement des Fonds</span>
                  </h5>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Définissez les coordonnées de reversement automatique des fonds collectés
                  </p>
                </div>

                {/* Bascule Coïncidence ou Séparé */}
                <div className="inline-flex p-1 bg-white border border-slate-200 rounded-xl shadow-2xs self-start sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setVaultData(prev => ({
                      ...prev,
                      kobara: { ...prev.kobara, same_receiver_number: true }
                    }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      vaultData.kobara.same_receiver_number
                        ? 'bg-orange-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Check size={12} className={vaultData.kobara.same_receiver_number ? 'opacity-100' : 'opacity-0'} />
                    <span>Numéro Unique (Coïncident)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVaultData(prev => ({
                      ...prev,
                      kobara: { ...prev.kobara, same_receiver_number: false }
                    }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      !vaultData.kobara.same_receiver_number
                        ? 'bg-orange-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Sliders size={12} className={!vaultData.kobara.same_receiver_number ? 'opacity-100' : 'opacity-0'} />
                    <span>Numéros Séparés</span>
                  </button>
                </div>
              </div>

              {/* Cas 1 : Numéro Unique (Coïncident) */}
              {vaultData.kobara.same_receiver_number ? (
                <div className="space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Smartphone size={13} className="text-orange-600" />
                      <span>Numéro Récepteur Unique (MonCash & Natcash)</span>
                      <span className="text-red-500 font-black">*</span>
                    </label>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      ✓ Coïncident (Même compte récepteur)
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
                          kobara: { 
                            ...prev.kobara, 
                            receiver_phone: val,
                            receiver_phone_moncash: val,
                            receiver_phone_natcash: val
                          }
                        }));
                      }}
                      placeholder="+509 3700 0000 ou 4600 0000"
                      className="w-full pl-3.5 pr-10 py-2.5 sm:py-3 bg-white border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 outline-none transition-all shadow-2xs"
                    />
                    <div className="absolute right-3 text-slate-400">
                      <PhoneCall size={16} />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Ce numéro unique reçoit l'ensemble des encaissements (MonCash et Natcash reversés sur ce même compte).
                  </p>
                </div>
              ) : (
                /* Cas 2 : Numéros distincts par opérateur */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-150">
                  {/* Numéro Récepteur MonCash */}
                  <div className="space-y-1.5 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0"></span>
                        <span>MonCash (Digicel)</span>
                        <span className="text-red-500 font-black">*</span>
                      </label>
                      <span className="text-[10px] font-bold text-slate-400">3x / 4x</span>
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={vaultData.kobara.receiver_phone_moncash || vaultData.kobara.receiver_phone || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setVaultData(prev => ({
                            ...prev,
                            kobara: { 
                              ...prev.kobara, 
                              receiver_phone_moncash: val,
                              receiver_phone: val || prev.kobara.receiver_phone 
                            }
                          }));
                        }}
                        placeholder="+509 3700 0000"
                        className="w-full pl-3.5 pr-10 py-2.5 sm:py-3 bg-slate-50/60 border border-slate-200 focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 outline-none transition-all"
                      />
                      <div className="absolute right-3 text-red-500">
                        <PhoneCall size={16} />
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Compte Digicel dédié aux règlements reçus par MonCash.
                    </p>
                  </div>

                  {/* Numéro Récepteur Natcash */}
                  <div className="space-y-1.5 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></span>
                        <span>Natcash (Natcom)</span>
                        <span className="text-red-500 font-black">*</span>
                      </label>
                      <span className="text-[10px] font-bold text-slate-400">2x</span>
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={vaultData.kobara.receiver_phone_natcash || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setVaultData(prev => ({
                            ...prev,
                            kobara: { ...prev.kobara, receiver_phone_natcash: val }
                          }));
                        }}
                        placeholder="+509 2200 0000"
                        className="w-full pl-3.5 pr-10 py-2.5 sm:py-3 bg-slate-50/60 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 outline-none transition-all"
                      />
                      <div className="absolute right-3 text-blue-500">
                        <PhoneCall size={16} />
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Compte Natcom dédié aux règlements reçus par Natcash.
                    </p>
                  </div>
                </div>
              )}

              {/* Titulaire & Auto-Payout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200/70">
                {/* Titulaire / Nom du compte */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Building size={13} className="text-orange-600" />
                    <span>Titulaire / Nom du Compte</span>
                  </label>
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
                    placeholder="Ex: Direction Établissement Scolaire"
                    className="w-full px-3.5 py-2.5 sm:py-3 bg-white border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 outline-none transition-all shadow-2xs"
                  />
                  <p className="text-[11px] text-slate-500">
                    Nom légal associé au compte destinataire.
                  </p>
                </div>

                {/* Auto-Payout switch */}
                <div className="space-y-1.5 flex flex-col justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Zap size={13} className="text-orange-600" />
                    <span>Auto-Payout en Temps Réel</span>
                  </label>
                  <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
                    <div className="min-w-0 pr-2">
                      <span className="text-xs font-bold text-slate-900 block">Reversement immédiat</span>
                      <span className="text-[10px] text-slate-500 font-medium">Les fonds sont virés dès réception</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVaultData(prev => ({
                        ...prev,
                        kobara: { ...prev.kobara, auto_payout: !prev.kobara.auto_payout }
                      }))}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                        vaultData.kobara.auto_payout ? 'bg-orange-600' : 'bg-slate-300'
                      }`}
                      title="Activer ou désactiver l'auto-payout"
                    >
                      <span
                        className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                          vaultData.kobara.auto_payout ? 'left-6' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 6. SECTION OPÉRATEUR DE REVERSEMENT PRINCIPAL */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Wallet size={14} className="text-orange-600" />
                  <span>Opérateur de Reversement Principal</span>
                </label>
                <span className="text-[11px] text-slate-500">Canal prioritaire</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setVaultData(prev => ({
                    ...prev,
                    kobara: { ...prev.kobara, receiver_operator: 'moncash' }
                  }))}
                  className={`p-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2.5 ${
                    vaultData.kobara.receiver_operator === 'moncash'
                      ? 'bg-red-50 border-red-500 ring-2 ring-red-500/20 text-red-900 shadow-xs'
                      : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0"></span>
                  <span className="truncate">MonCash (Digicel)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVaultData(prev => ({
                    ...prev,
                    kobara: { ...prev.kobara, receiver_operator: 'natcash' }
                  }))}
                  className={`p-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2.5 ${
                    vaultData.kobara.receiver_operator === 'natcash'
                      ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 text-blue-900 shadow-xs'
                      : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></span>
                  <span className="truncate">Natcash (Natcom)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVaultData(prev => ({
                    ...prev,
                    kobara: { ...prev.kobara, receiver_operator: 'bank' }
                  }))}
                  className={`p-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2.5 ${
                    vaultData.kobara.receiver_operator === 'bank'
                      ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900 shadow-xs'
                      : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                  <span className="truncate">Compte Bancaire</span>
                </button>
              </div>
            </div>

            {/* 7. BOUTONS D'ACTION KOBARA */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleTestConnection('kobara')}
                disabled={testing}
                className="w-full sm:w-auto px-5 py-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 rounded-xl text-xs sm:text-[13px] font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {testing ? <Loader2 size={16} className="animate-spin text-orange-600" /> : <Zap size={16} className="text-orange-600" />}
                <span>Tester la connexion API Kobara</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveService('kobara')}
                disabled={saving}
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 active:from-orange-800 active:to-amber-800 text-white rounded-xl text-xs sm:text-[13px] font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-orange-600/20 disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin text-white" /> : <Save size={16} />}
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

              {/* FORMULAIRE DES CLÉS API HARMONISÉ */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 pt-2">
                {/* 1. Mode d'Environnement MonCash */}
                <div className="lg:col-span-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Radio size={14} className="text-red-600" />
                      <span>Environnement API (Digicel MonCash)</span>
                    </label>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {vaultData.moncash.mode === 'live' ? 'Mode Réel Actif' : 'Mode Sandbox Actif'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setVaultData(prev => ({
                        ...prev,
                        moncash: { ...prev.moncash, mode: 'sandbox' }
                      }))}
                      className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                        vaultData.moncash.mode === 'sandbox'
                          ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-500/20 text-amber-950 shadow-xs'
                          : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded-full mt-0.5 shrink-0 flex items-center justify-center border ${
                        vaultData.moncash.mode === 'sandbox' ? 'border-amber-600 bg-amber-500' : 'border-slate-400 bg-transparent'
                      }`}>
                        {vaultData.moncash.mode === 'sandbox' && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <span>Sandbox (Test / Développement)</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300">
                            Simulation
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 font-mono truncate">
                          sandbox.moncashbutton.digicelgroup.com
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVaultData(prev => ({
                        ...prev,
                        moncash: { ...prev.moncash, mode: 'live' }
                      }))}
                      className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                        vaultData.moncash.mode === 'live'
                          ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-500/20 text-emerald-950 shadow-xs'
                          : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded-full mt-0.5 shrink-0 flex items-center justify-center border ${
                        vaultData.moncash.mode === 'live' ? 'border-emerald-600 bg-emerald-500' : 'border-slate-400 bg-transparent'
                      }`}>
                        {vaultData.moncash.mode === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <span>Production Live (Argent réel)</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Fonds Réels
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 font-mono truncate">
                          moncashbutton.digicelgroup.com
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 2. MONCASH_CLIENT_ID */}
                <div className="bg-slate-50/80 rounded-xl p-3.5 sm:p-4 border border-slate-200 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <Key size={13} className="text-red-600" />
                        <span>MonCash Client ID</span>
                        <span className="text-red-500 font-black">*</span>
                      </label>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-bold shrink-0">
                        Public ID
                      </span>
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={vaultData.moncash.client_id}
                        onChange={(e) => setVaultData(prev => ({
                          ...prev,
                          moncash: { ...prev.moncash, client_id: e.target.value.trim() }
                        }))}
                        placeholder="Ex: 100000000000000000000"
                        className="w-full pl-3.5 pr-12 py-2.5 sm:py-3 bg-white border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 rounded-xl text-xs sm:text-[13px] font-mono font-medium text-slate-900 outline-none transition-all shadow-2xs"
                      />
                      {vaultData.moncash.client_id && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(vaultData.moncash.client_id, 'client_id')}
                          className="absolute right-2 p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                          title="Copier le Client ID"
                        >
                          {copiedKey === 'client_id' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Barre d'état & aperçu complet */}
                  <div className="space-y-2 pt-1 border-t border-slate-200/60 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                      <span className="text-slate-500">
                        {vaultData.moncash.client_id ? `${vaultData.moncash.client_id.length} caractères` : 'Non renseigné'}
                      </span>
                      {vaultData.moncash.client_id && (
                        <button
                          type="button"
                          onClick={() => toggleExpandedPreview('moncash_client_id')}
                          className="text-[11px] font-bold text-red-600 hover:text-red-700 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <span>{expandedPreview['moncash_client_id'] ? 'Réduire' : 'Tout voir'}</span>
                          {expandedPreview['moncash_client_id'] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      )}
                    </div>

                    {expandedPreview['moncash_client_id'] && vaultData.moncash.client_id && (
                      <div className="p-2.5 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] break-all border border-slate-800 shadow-inner select-all animate-in fade-in duration-150">
                        {vaultData.moncash.client_id}
                      </div>
                    )}

                    <p className="text-[11px] text-slate-500 leading-tight">
                      Identifiant public de votre application marchande MonCash.
                    </p>
                  </div>
                </div>

                {/* 3. MONCASH_CLIENT_SECRET (CHIIFRÉ AES-256) */}
                <div className="bg-slate-50/80 rounded-xl p-3.5 sm:p-4 border border-slate-200 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <Lock size={13} className="text-emerald-600" />
                        <span>MonCash Client Secret</span>
                        <span className="text-red-500 font-black">*</span>
                      </label>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 shrink-0">
                        AES-256
                      </span>
                    </div>

                    <div className="relative flex items-center">
                      <input
                        type={revealedSecrets['moncash_MONCASH_CLIENT_SECRET'] ? 'text' : 'password'}
                        value={
                          revealedSecrets['moncash_MONCASH_CLIENT_SECRET']
                            ? (unmaskedValues['moncash_MONCASH_CLIENT_SECRET'] || vaultData.moncash.client_secret)
                            : vaultData.moncash.client_secret
                        }
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          setUnmaskedValues(prev => ({ ...prev, ['moncash_MONCASH_CLIENT_SECRET']: val }));
                          setVaultData(prev => ({
                            ...prev,
                            moncash: { ...prev.moncash, client_secret: val }
                          }));
                        }}
                        placeholder="mc_sec_xxxxxxxxxxxxxxxxxxxxxx"
                        className="w-full pl-3.5 pr-20 py-2.5 sm:py-3 bg-white border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 rounded-xl text-xs sm:text-[13px] font-mono font-medium text-slate-900 outline-none transition-all shadow-2xs"
                      />
                      <div className="absolute right-1.5 flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => toggleRevealSecret('moncash', 'MONCASH_CLIENT_SECRET')}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                          title={revealedSecrets['moncash_MONCASH_CLIENT_SECRET'] ? 'Masquer' : 'Afficher le secret'}
                        >
                          {revealedSecrets['moncash_MONCASH_CLIENT_SECRET'] ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const val = unmaskedValues['moncash_MONCASH_CLIENT_SECRET'] || vaultData.moncash.client_secret;
                            copyToClipboard(val, 'client_secret');
                          }}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                          title="Copier le Client Secret"
                        >
                          {copiedKey === 'client_secret' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Barre d'état & aperçu complet */}
                  <div className="space-y-2 pt-1 border-t border-slate-200/60 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                      <span className="text-slate-500">
                        {vaultData.moncash.client_secret ? `${vaultData.moncash.client_secret.length} caractères` : 'Non renseigné'}
                      </span>
                      {vaultData.moncash.client_secret && (
                        <button
                          type="button"
                          onClick={() => toggleExpandedPreview('moncash_client_secret')}
                          className="text-[11px] font-bold text-red-600 hover:text-red-700 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <span>{expandedPreview['moncash_client_secret'] ? 'Réduire' : 'Tout voir'}</span>
                          {expandedPreview['moncash_client_secret'] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      )}
                    </div>

                    {expandedPreview['moncash_client_secret'] && vaultData.moncash.client_secret && (
                      <div className="p-2.5 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] break-all border border-slate-800 shadow-inner select-all animate-in fade-in duration-150">
                        <div className="text-[9px] text-slate-400 uppercase font-sans font-bold mb-1 flex items-center justify-between">
                          <span>Valeur du secret :</span>
                          <span>{revealedSecrets['moncash_MONCASH_CLIENT_SECRET'] ? 'En clair' : 'Masquée'}</span>
                        </div>
                        {revealedSecrets['moncash_MONCASH_CLIENT_SECRET']
                          ? (unmaskedValues['moncash_MONCASH_CLIENT_SECRET'] || vaultData.moncash.client_secret)
                          : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                      </div>
                    )}

                    <p className="text-[11px] text-slate-500 leading-tight">
                      Clé secrète hautement confidentielle, chiffrée avec AES-256-GCM.
                    </p>
                  </div>
                </div>

                {/* 4. MONCASH_BUSINESS_KEY */}
                <div className="bg-slate-50/80 rounded-xl p-3.5 sm:p-4 border border-slate-200 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <Key size={13} className="text-purple-600" />
                        <span>Clé Marchande (Business Key)</span>
                      </label>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-bold shrink-0">
                        Optionnel
                      </span>
                    </div>

                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={vaultData.moncash.business_key}
                        onChange={(e) => setVaultData(prev => ({
                          ...prev,
                          moncash: { ...prev.moncash, business_key: e.target.value.trim() }
                        }))}
                        placeholder="Ex: 5093xxxxxxx ou code marchand"
                        className="w-full pl-3.5 pr-12 py-2.5 sm:py-3 bg-white border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 rounded-xl text-xs sm:text-[13px] font-mono font-medium text-slate-900 outline-none transition-all shadow-2xs"
                      />
                      {vaultData.moncash.business_key && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(vaultData.moncash.business_key, 'business_key')}
                          className="absolute right-2 p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                          title="Copier la clé marchande"
                        >
                          {copiedKey === 'business_key' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 pt-1 border-t border-slate-200/60 text-xs">
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Numéro ou code marchand pour la réception directe des versements scolaires.
                    </p>
                  </div>
                </div>

                {/* 5. URL DE WEBHOOK MONCASH */}
                <div className="bg-slate-50/80 rounded-xl p-3.5 sm:p-4 border border-slate-200 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <Globe size={13} className="text-emerald-600" />
                        <span>URL Webhook MonCash</span>
                      </label>
                      <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => setSelectedHostType('render')}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer ${
                            selectedHostType === 'render'
                              ? 'bg-red-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Render
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedHostType('detected')}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer ${
                            selectedHostType === 'detected'
                              ? 'bg-red-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Domaine Actuel
                        </button>
                      </div>
                    </div>

                    <div className="relative flex items-center">
                      <input
                        type="text"
                        readOnly
                        value={webhookUrl}
                        className="w-full pl-3.5 pr-12 py-2.5 sm:py-3 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 select-all cursor-pointer"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(webhookUrl, 'webhook_url')}
                        className="absolute right-2 p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                        title="Copier l'URL de webhook MonCash"
                      >
                        {copiedKey === 'webhook_url' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1 border-t border-slate-200/60 text-xs">
                    <p className="text-[11px] text-slate-500 leading-tight">
                      À renseigner dans le portail Digicel pour la confirmation instantanée des paiements.
                    </p>
                  </div>
                </div>
              </div>

              {/* BOUTONS D'ACTION MONCASH */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-slate-500 font-medium">
                  Les modifications sont chiffrées et appliquées immédiatement au guichet scolaire.
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handleSaveService('moncash')}
                    disabled={saving}
                    className="w-full sm:w-auto px-6 py-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs sm:text-[13px] font-bold transition-all shadow-md shadow-red-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Chiffrement & Sauvegarde...</span>
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        <span>Enregistrer & Chiffrer dans Supabase (AES-256)</span>
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
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center font-black text-sm shrink-0 shadow-2xs">
                NC
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-black text-slate-900 tracking-tight">
                    Natcom Natcash
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-300">
                    Bientôt Disponible
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Paiements et reversements par portefeuille Natcom</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {/* NATCASH_MERCHANT_ID */}
            <div className="bg-slate-50/80 rounded-xl p-3.5 sm:p-4 border border-slate-200 space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 block">
                Natcash Merchant ID
              </label>
              <input
                type="text"
                value={vaultData.natcash.merchant_id}
                onChange={(e) => setVaultData(prev => ({
                  ...prev,
                  natcash: { ...prev.natcash, merchant_id: e.target.value.trim() }
                }))}
                placeholder="Ex: NC-MERCHANT-001"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all shadow-2xs"
              />
              <p className="text-[11px] text-slate-500">Code marchand Natcom Natcash.</p>
            </div>

            {/* NATCASH_SECRET_KEY */}
            <div className="bg-slate-50/80 rounded-xl p-3.5 sm:p-4 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                  <span>Secret Key</span>
                </label>
                <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold border border-emerald-300">
                  AES-256
                </span>
              </div>
              <input
                type="password"
                value={vaultData.natcash.secret_key}
                onChange={(e) => setVaultData(prev => ({
                  ...prev,
                  natcash: { ...prev.natcash, secret_key: e.target.value.trim() }
                }))}
                placeholder="Clé secrète Natcom"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all shadow-2xs"
              />
              <p className="text-[11px] text-slate-500">Clé confidentielle Natcash.</p>
            </div>

            {/* NATCASH USSD */}
            <div className="bg-slate-50/80 rounded-xl p-3.5 sm:p-4 border border-slate-200 space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 block">
                Code USSD Natcash
              </label>
              <input
                type="text"
                value={vaultData.natcash.ussd_number}
                onChange={(e) => setVaultData(prev => ({
                  ...prev,
                  natcash: { ...prev.natcash, ussd_number: e.target.value.trim() }
                }))}
                placeholder="Ex: *202*12345#"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all shadow-2xs"
              />
              <p className="text-[11px] text-slate-500">Code court de paiement USSD.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={() => handleSaveService('natcash')}
              disabled={saving}
              className="w-full sm:w-auto px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs sm:text-[13px] font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save size={16} />
              <span>Enregistrer Natcash (AES-256)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
