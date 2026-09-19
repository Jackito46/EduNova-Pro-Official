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
      secret_key: '',
      webhook_secret: '',
      public_key: '',
      receiver_phone: '',
      receiver_phone_moncash: '',
      receiver_phone_natcash: '',
      same_receiver_number: true,
      auto_payout: true,
      receiver_name: '',
      receiver_operator: 'moncash',
      has_secret: false,
      has_webhook_secret: false,
      is_secret_encrypted: false,
      mode: 'live',
      is_active: true,
      validation_status: 'UNTESTED',
      last_validated_at: null,
      validation_message: ''
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

  const configuredAppUrl = (import.meta.env.VITE_APP_URL || '').trim();
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const [selectedHostType, setSelectedHostType] = useState<'env' | 'detected'>(configuredAppUrl ? 'env' : 'detected');
  const effectiveBaseUrl = (selectedHostType === 'env' && configuredAppUrl) ? configuredAppUrl : currentOrigin;
  const webhookUrl = `${effectiveBaseUrl}/api/moncash/webhook`;
  const kobaraWebhookUrl = `${effectiveBaseUrl}/api/webhooks/kobara`;

  return (
    <div className="space-y-3 animate-in slide-in-from-right duration-300">
      {/* 1. BANNIÈRE COFFRE-FORT ÉPURÉE & COMPACTE */}
      <div className="bg-slate-900 text-white rounded-xl p-3 sm:p-3.5 border border-slate-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-2xs">
            <ShieldCheck size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-sm sm:text-base font-bold tracking-tight text-white truncate">
                Passerelles & Clés API
              </h3>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Lock size={9} /> AES-256-GCM
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hidden sm:inline-flex items-center gap-1">
                <Database size={9} /> Supabase Vault
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium truncate">
              Chiffrement matériel et validation en temps réel
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={loadVaultData}
            disabled={loading}
            className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 active:bg-white/25 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-white/10 disabled:opacity-50"
            title="Actualiser les statuts du coffre-fort"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin text-indigo-300' : 'text-slate-300'} />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* 2. SÉLECTEUR D'ONGLETS COMPACT */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('kobara')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs whitespace-nowrap transition-all cursor-pointer shrink-0 ${
            activeTab === 'kobara'
              ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-2xs'
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs whitespace-nowrap transition-all cursor-pointer shrink-0 ${
            activeTab === 'moncash'
              ? 'bg-red-600 text-white shadow-2xs'
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs whitespace-nowrap transition-all cursor-pointer shrink-0 ${
            activeTab === 'natcash'
              ? 'bg-amber-600 text-white shadow-2xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Smartphone size={13} />
          <span>Natcash</span>
        </button>
      </div>

      {/* ===================== ONGLET KOBARA ===================== */}
      {activeTab === 'kobara' && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200 shadow-2xs space-y-3.5">
            {/* EN-TÊTE DU SERVICE KOBARA */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center font-bold shadow-2xs shrink-0">
                  <CreditCard size={16} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h4 className="text-sm font-bold text-slate-900 tracking-tight">Passerelle Kobara</h4>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase bg-orange-100 text-orange-800 border border-orange-200">
                      MonCash & Natcash
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">Centralisation des paiements mobiles</span>
                </div>
              </div>

              {/* Statut de validation */}
              <div className="flex items-center gap-2 self-start sm:self-center">
                {vaultData.kobara.validation_status === 'VALID' ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    <span>Connectée</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                    <AlertCircle size={13} className="text-amber-600" />
                    <span>À vérifier</span>
                  </div>
                )}
              </div>
            </div>

            {/* WEBHOOK KOBARA */}
            <div className="p-2.5 rounded-lg bg-orange-50/70 border border-orange-200/90 text-xs space-y-1.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Globe size={14} className="text-orange-600 shrink-0" />
                  <span className="font-bold text-orange-950 text-xs truncate">
                    URL Webhook Kobara
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(kobaraWebhookUrl, 'kobara_webhook')}
                  className="px-2.5 py-1 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shrink-0 self-start sm:self-auto shadow-2xs"
                  title="Copier l'URL du webhook"
                >
                  {copiedKey === 'kobara_webhook' ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedKey === 'kobara_webhook' ? 'Copié !' : 'Copier'}</span>
                </button>
              </div>
              <div className="bg-white px-2.5 py-1.5 rounded-md border border-orange-200 font-mono text-[11px] text-orange-950 break-all select-all shadow-inner">
                {kobaraWebhookUrl}
              </div>
            </div>

            {/* CLÉS D'AUTHENTIFICATION KOBARA */}
            <div className="space-y-2">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 sm:gap-3">
                {/* CLÉ SECRÈTE */}
                <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200 flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Key size={13} className="text-orange-600" />
                        <span>Clé Secrète</span>
                        <span className="text-red-500 font-bold">*</span>
                      </label>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white border border-slate-200 text-slate-600 font-bold shrink-0">
                        kbr_sk_...
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
                        className="w-full pl-3 pr-16 py-1.5 sm:py-2 bg-white border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 rounded-lg text-xs font-mono font-medium text-slate-900 outline-none transition-all shadow-2xs"
                      />
                      <div className="absolute right-1 flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => toggleRevealSecret('kobara', 'KOBARA_SECRET_KEY')}
                          className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                          title={revealedSecrets['kobara_KOBARA_SECRET_KEY'] ? 'Masquer' : 'Afficher en clair'}
                        >
                          {revealedSecrets['kobara_KOBARA_SECRET_KEY'] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(
                            unmaskedValues['kobara_KOBARA_SECRET_KEY'] || vaultData.kobara.secret_key,
                            'kobara_secret'
                          )}
                          className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                          title="Copier"
                        >
                          {copiedKey === 'kobara_secret' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Statut condensé & aperçu */}
                  <div className="space-y-1.5 pt-1 border-t border-slate-200/60 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                      <span className="text-slate-500">
                        {(() => {
                          const currentVal = unmaskedValues['kobara_KOBARA_SECRET_KEY'] !== undefined 
                            ? unmaskedValues['kobara_KOBARA_SECRET_KEY'] 
                            : vaultData.kobara.secret_key;
                          if (!currentVal) return <span className="text-amber-600 font-medium">Non renseignée</span>;
                          if (currentVal.startsWith('kbr_sk_live_')) {
                            return <span className="text-emerald-700 font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Production Live</span>;
                          }
                          if (currentVal.startsWith('kbr_sk_test_')) {
                            return <span className="text-amber-700 font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Mode Test</span>;
                          }
                          return <span className="text-slate-600 font-medium">{currentVal.length} car.</span>;
                        })()}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleExpandedPreview('kobara_secret')}
                        className="text-[10.5px] font-bold text-orange-600 hover:text-orange-700 transition-colors cursor-pointer flex items-center gap-0.5"
                      >
                        <span>{expandedPreview['kobara_secret'] ? 'Réduire' : 'Aperçu'}</span>
                        {expandedPreview['kobara_secret'] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </div>

                    {expandedPreview['kobara_secret'] && (
                      <div className="p-2 rounded-md bg-slate-900 text-slate-100 font-mono text-[10px] break-all border border-slate-800 shadow-inner select-all animate-in fade-in duration-150">
                        {revealedSecrets['kobara_KOBARA_SECRET_KEY']
                          ? (unmaskedValues['kobara_KOBARA_SECRET_KEY'] || vaultData.kobara.secret_key || '(Vide)')
                          : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                      </div>
                    )}
                  </div>
                </div>

                {/* SECRET SIGNATURE WEBHOOK */}
                <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200 flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Lock size={13} className="text-orange-600" />
                        <span>Secret Signature Webhook</span>
                      </label>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white border border-slate-200 text-slate-600 font-bold shrink-0">
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
                        className="w-full pl-3 pr-16 py-1.5 sm:py-2 bg-white border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 rounded-lg text-xs font-mono font-medium text-slate-900 outline-none transition-all shadow-2xs"
                      />
                      <div className="absolute right-1 flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => toggleRevealSecret('kobara', 'KOBARA_WEBHOOK_SECRET')}
                          className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                          title={revealedSecrets['kobara_KOBARA_WEBHOOK_SECRET'] ? 'Masquer' : 'Afficher en clair'}
                        >
                          {revealedSecrets['kobara_KOBARA_WEBHOOK_SECRET'] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(
                            unmaskedValues['kobara_KOBARA_WEBHOOK_SECRET'] || vaultData.kobara.webhook_secret,
                            'kobara_wh_secret'
                          )}
                          className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                          title="Copier"
                        >
                          {copiedKey === 'kobara_wh_secret' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Statut condensé & aperçu */}
                  <div className="space-y-1.5 pt-1 border-t border-slate-200/60 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                      <span className="text-slate-500">
                        {(() => {
                          const currentVal = unmaskedValues['kobara_KOBARA_WEBHOOK_SECRET'] !== undefined 
                            ? unmaskedValues['kobara_KOBARA_WEBHOOK_SECRET'] 
                            : vaultData.kobara.webhook_secret;
                          if (!currentVal) return <span className="text-slate-400 font-medium">Optionnel</span>;
                          if (currentVal.startsWith('whsec_')) {
                            return <span className="text-emerald-700 font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Format whsec_ valide</span>;
                          }
                          return <span className="text-slate-600 font-medium">{currentVal.length} car.</span>;
                        })()}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleExpandedPreview('kobara_wh_secret')}
                        className="text-[10.5px] font-bold text-orange-600 hover:text-orange-700 transition-colors cursor-pointer flex items-center gap-0.5"
                      >
                        <span>{expandedPreview['kobara_wh_secret'] ? 'Réduire' : 'Aperçu'}</span>
                        {expandedPreview['kobara_wh_secret'] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </div>

                    {expandedPreview['kobara_wh_secret'] && (
                      <div className="p-2 rounded-md bg-slate-900 text-slate-100 font-mono text-[10px] break-all border border-slate-800 shadow-inner select-all animate-in fade-in duration-150">
                        {revealedSecrets['kobara_KOBARA_WEBHOOK_SECRET']
                          ? (unmaskedValues['kobara_KOBARA_WEBHOOK_SECRET'] || vaultData.kobara.webhook_secret || '(Vide)')
                          : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ENVIRONNEMENT KOBARA */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Radio size={13} className="text-orange-600" />
                <span>Environnement</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVaultData(prev => ({
                    ...prev,
                    kobara: { ...prev.kobara, mode: 'live' }
                  }))}
                  className={`p-2.5 rounded-lg text-left border transition-all cursor-pointer flex items-center gap-2.5 ${
                    vaultData.kobara.mode === 'live'
                      ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-500/20 text-emerald-950 shadow-2xs'
                      : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full shrink-0 flex items-center justify-center border ${
                    vaultData.kobara.mode === 'live' ? 'border-emerald-600 bg-emerald-500' : 'border-slate-400 bg-transparent'
                  }`}>
                    {vaultData.kobara.mode === 'live' && <span className="w-1 h-1 rounded-full bg-white"></span>}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Production (Live)</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Fonds Réels
                      </span>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setVaultData(prev => ({
                    ...prev,
                    kobara: { ...prev.kobara, mode: 'test' }
                  }))}
                  className={`p-2.5 rounded-lg text-left border transition-all cursor-pointer flex items-center gap-2.5 ${
                    vaultData.kobara.mode === 'test'
                      ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-500/20 text-amber-950 shadow-2xs'
                      : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full shrink-0 flex items-center justify-center border ${
                    vaultData.kobara.mode === 'test' ? 'border-amber-600 bg-amber-500' : 'border-slate-400 bg-transparent'
                  }`}>
                    {vaultData.kobara.mode === 'test' && <span className="w-1 h-1 rounded-full bg-white"></span>}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Test / Sandbox</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300">
                        Simulation
                      </span>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* COMPTES DE RÉCEPTION & REVERSEMENT */}
            <div className="space-y-2.5 p-3 sm:p-3.5 bg-slate-50/80 rounded-xl border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
                <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Smartphone size={14} className="text-orange-600" />
                  <span>Reversement des Fonds</span>
                </h5>

                {/* Bascule Coïncidence ou Séparé */}
                <div className="inline-flex p-0.5 bg-white border border-slate-200 rounded-lg shadow-2xs self-start sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setVaultData(prev => ({
                      ...prev,
                      kobara: { ...prev.kobara, same_receiver_number: true }
                    }))}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      vaultData.kobara.same_receiver_number
                        ? 'bg-orange-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Check size={11} className={vaultData.kobara.same_receiver_number ? 'opacity-100' : 'opacity-0'} />
                    <span>Numéro Unique</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVaultData(prev => ({
                      ...prev,
                      kobara: { ...prev.kobara, same_receiver_number: false }
                    }))}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      !vaultData.kobara.same_receiver_number
                        ? 'bg-orange-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Sliders size={11} className={!vaultData.kobara.same_receiver_number ? 'opacity-100' : 'opacity-0'} />
                    <span>Séparés</span>
                  </button>
                </div>
              </div>

              {/* Cas 1 : Numéro Unique (Coïncident) */}
              {vaultData.kobara.same_receiver_number ? (
                <div className="space-y-1 animate-in fade-in duration-150">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                    <span>Numéro Récepteur Unique (MonCash & Natcash) *</span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      Coïncident
                    </span>
                  </label>
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
                      className="w-full pl-3 pr-8 py-2 bg-white border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 rounded-lg text-xs font-semibold text-slate-900 outline-none transition-all shadow-2xs"
                    />
                    <div className="absolute right-2.5 text-slate-400">
                      <PhoneCall size={14} />
                    </div>
                  </div>
                </div>
              ) : (
                /* Cas 2 : Numéros Séparés */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 animate-in fade-in duration-150">
                  <div className="space-y-1 bg-white p-2.5 rounded-lg border border-slate-200/90 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
                        <span>MonCash (Digicel) *</span>
                      </label>
                      <span className="text-[9px] font-bold text-slate-400">3x / 4x</span>
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
                        className="w-full pl-3 pr-8 py-1.5 sm:py-2 bg-slate-50/60 border border-slate-200 focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 rounded-lg text-xs font-semibold text-slate-900 outline-none transition-all"
                      />
                      <div className="absolute right-2.5 text-red-500">
                        <PhoneCall size={14} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 bg-white p-2.5 rounded-lg border border-slate-200/90 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                        <span>Natcash (Natcom) *</span>
                      </label>
                      <span className="text-[9px] font-bold text-slate-400">2x</span>
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
                        className="w-full pl-3 pr-8 py-1.5 sm:py-2 bg-slate-50/60 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg text-xs font-semibold text-slate-900 outline-none transition-all"
                      />
                      <div className="absolute right-2.5 text-blue-500">
                        <PhoneCall size={14} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Titulaire & Auto-Payout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-200/70">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <Building size={12} className="text-orange-600" />
                    <span>Titulaire du Compte</span>
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
                    className="w-full px-3 py-1.5 sm:py-2 bg-white border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 rounded-lg text-xs font-semibold text-slate-900 outline-none transition-all shadow-2xs"
                  />
                </div>

                <div className="space-y-1 flex flex-col justify-between">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <Zap size={12} className="text-orange-600" />
                    <span>Auto-Payout Temps Réel</span>
                  </label>
                  <div className="flex items-center justify-between px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-2xs">
                    <span className="text-xs font-medium text-slate-700">Reversement immédiat</span>
                    <button
                      type="button"
                      onClick={() => setVaultData(prev => ({
                        ...prev,
                        kobara: { ...prev.kobara, auto_payout: !prev.kobara.auto_payout }
                      }))}
                      className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                        vaultData.kobara.auto_payout ? 'bg-orange-600' : 'bg-slate-300'
                      }`}
                      title="Activer ou désactiver l'auto-payout"
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                          vaultData.kobara.auto_payout ? 'left-5' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* OPÉRATEUR DE REVERSEMENT */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Wallet size={13} className="text-orange-600" />
                  <span>Opérateur Prioritaire</span>
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setVaultData(prev => ({
                    ...prev,
                    kobara: { ...prev.kobara, receiver_operator: 'moncash' }
                  }))}
                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2 ${
                    vaultData.kobara.receiver_operator === 'moncash'
                      ? 'bg-red-50/80 border-red-400 text-red-950 shadow-2xs'
                      : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0"></span>
                  <div className="min-w-0">
                    <span className="text-xs font-bold block">MonCash</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setVaultData(prev => ({
                    ...prev,
                    kobara: { ...prev.kobara, receiver_operator: 'natcash' }
                  }))}
                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2 ${
                    vaultData.kobara.receiver_operator === 'natcash'
                      ? 'bg-blue-50/80 border-blue-400 text-blue-950 shadow-2xs'
                      : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></span>
                  <div className="min-w-0">
                    <span className="text-xs font-bold block">Natcash</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setVaultData(prev => ({
                    ...prev,
                    kobara: { ...prev.kobara, receiver_operator: 'bank' }
                  }))}
                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2 ${
                    vaultData.kobara.receiver_operator === 'bank'
                      ? 'bg-emerald-50/80 border-emerald-400 text-emerald-950 shadow-2xs'
                      : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                  <div className="min-w-0">
                    <span className="text-xs font-bold block">Virement Bancaire</span>
                  </div>
                </button>
              </div>
            </div>

            {/* BOUTONS D'ACTION KOBARA */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleTestConnection('kobara')}
                disabled={testing}
                className="w-full sm:w-auto px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {testing ? <Loader2 size={13} className="animate-spin text-orange-600" /> : <Zap size={13} className="text-orange-600" />}
                <span>Tester la connexion</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveService('kobara')}
                disabled={saving}
                className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
              >
                {saving ? <Loader2 size={13} className="animate-spin text-white" /> : <Save size={13} />}
                <span>Enregistrer (AES-256)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== ONGLET MONCASH ===================== */}
      {activeTab === 'moncash' && (
        <div className="space-y-3">
          {/* Toggle vue simplifiée / détaillée */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-700">
              Configuration Digicel MonCash
            </span>
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
            <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs space-y-3.5">
              {/* En-tête MonCash */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 border border-red-200/60 flex items-center justify-center font-bold text-xs shrink-0">
                    MC
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-bold text-slate-900 tracking-tight">
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
                    <span className="text-[11px] text-slate-500">Portefeuille mobile Digicel</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <a
                    href="https://moncashbutton.digicelgroup.com/Moncash-business/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 text-[11px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-all flex items-center gap-1 border border-red-200/60"
                  >
                    <span>Portail Développeur</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              </div>

              {/* STATUT DE VALIDATION EN DIRECT */}
              <div className={`p-2.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                vaultData.moncash.validation_status === 'VALID'
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                  : vaultData.moncash.validation_status === 'INVALID'
                  ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}>
                <div className="flex items-center gap-2.5">
                  {vaultData.moncash.validation_status === 'VALID' ? (
                    <div className="w-7 h-7 rounded-md bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <CheckCircle2 size={16} />
                    </div>
                  ) : vaultData.moncash.validation_status === 'INVALID' ? (
                    <div className="w-7 h-7 rounded-md bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                      <XCircle size={16} />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-md bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                      <AlertCircle size={16} />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wide">
                        {vaultData.moncash.validation_status === 'VALID'
                          ? 'Clés Validées'
                          : vaultData.moncash.validation_status === 'INVALID'
                          ? 'Erreur de Connexion'
                          : 'Non Validé'}
                      </span>
                      {vaultData.moncash.last_validated_at && (
                        <span className="text-[10px] text-slate-500">
                          ({new Date(vaultData.moncash.last_validated_at).toLocaleTimeString('fr-FR')})
                        </span>
                      )}
                    </div>
                    {vaultData.moncash.validation_message && (
                      <p className="text-[11px] text-slate-600 font-medium line-clamp-1">
                        {vaultData.moncash.validation_message}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleTestConnection('moncash')}
                  disabled={testing || !vaultData.moncash.client_id}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 shadow-2xs"
                >
                  {testing ? (
                    <>
                      <Loader2 size={12} className="animate-spin text-red-400" />
                      <span>Test en cours...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={12} className="text-amber-400" />
                      <span>Tester</span>
                    </>
                  )}
                </button>
              </div>

              {/* FORMULAIRE DES CLÉS API */}
              <div className="space-y-3 pt-1">
                {/* Mode d'Environnement MonCash */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Radio size={13} className="text-red-600" />
                    <span>Environnement</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setVaultData(prev => ({
                        ...prev,
                        moncash: { ...prev.moncash, mode: 'sandbox' }
                      }))}
                      className={`p-2.5 rounded-lg text-left border transition-all cursor-pointer flex items-center gap-2.5 ${
                        vaultData.moncash.mode === 'sandbox'
                          ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-500/20 text-amber-950 shadow-2xs'
                          : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full shrink-0 flex items-center justify-center border ${
                        vaultData.moncash.mode === 'sandbox' ? 'border-amber-600 bg-amber-500' : 'border-slate-400 bg-transparent'
                      }`}>
                        {vaultData.moncash.mode === 'sandbox' && <span className="w-1 h-1 rounded-full bg-white"></span>}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-900 block">Sandbox (Test)</span>
                        <span className="text-[10px] text-slate-400 font-mono truncate block">sandbox.moncashbutton.digicelgroup.com</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVaultData(prev => ({
                        ...prev,
                        moncash: { ...prev.moncash, mode: 'live' }
                      }))}
                      className={`p-2.5 rounded-lg text-left border transition-all cursor-pointer flex items-center gap-2.5 ${
                        vaultData.moncash.mode === 'live'
                          ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-500/20 text-emerald-950 shadow-2xs'
                          : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full shrink-0 flex items-center justify-center border ${
                        vaultData.moncash.mode === 'live' ? 'border-emerald-600 bg-emerald-500' : 'border-slate-400 bg-transparent'
                      }`}>
                        {vaultData.moncash.mode === 'live' && <span className="w-1 h-1 rounded-full bg-white"></span>}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-900 block">Production (Live)</span>
                        <span className="text-[10px] text-slate-400 font-mono truncate block">moncashbutton.digicelgroup.com</span>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 sm:gap-3">
                  {/* MONCASH_CLIENT_ID */}
                  <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Key size={13} className="text-red-600" />
                          <span>Client ID</span>
                          <span className="text-red-500 font-bold">*</span>
                        </label>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white border border-slate-200 text-slate-600 font-bold shrink-0">
                          Public
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
                          className="w-full pl-3 pr-10 py-1.5 sm:py-2 bg-white border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 rounded-lg text-xs font-mono font-medium text-slate-900 outline-none transition-all shadow-2xs"
                        />
                        {vaultData.moncash.client_id && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(vaultData.moncash.client_id, 'client_id')}
                            className="absolute right-1.5 p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-all cursor-pointer"
                            title="Copier"
                          >
                            {copiedKey === 'client_id' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1 border-t border-slate-200/60 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                        <span className="text-slate-500">
                          {vaultData.moncash.client_id ? `${vaultData.moncash.client_id.length} car.` : 'Non renseigné'}
                        </span>
                        {vaultData.moncash.client_id && (
                          <button
                            type="button"
                            onClick={() => toggleExpandedPreview('moncash_client_id')}
                            className="text-[10.5px] font-bold text-red-600 hover:text-red-700 transition-colors cursor-pointer flex items-center gap-0.5"
                          >
                            <span>{expandedPreview['moncash_client_id'] ? 'Réduire' : 'Aperçu'}</span>
                            {expandedPreview['moncash_client_id'] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        )}
                      </div>

                      {expandedPreview['moncash_client_id'] && vaultData.moncash.client_id && (
                        <div className="p-2 rounded-md bg-slate-900 text-slate-100 font-mono text-[10px] break-all border border-slate-800 shadow-inner select-all animate-in fade-in duration-150">
                          {vaultData.moncash.client_id}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* MONCASH_CLIENT_SECRET */}
                  <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Lock size={13} className="text-red-600" />
                          <span>Client Secret</span>
                          <span className="text-red-500 font-bold">*</span>
                        </label>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white border border-slate-200 text-slate-600 font-bold shrink-0">
                          Secret
                        </span>
                      </div>
                      <div className="relative flex items-center">
                        <input
                          type={revealedSecrets['moncash_MONCASH_CLIENT_SECRET'] ? 'text' : 'password'}
                          value={
                            unmaskedValues['moncash_MONCASH_CLIENT_SECRET'] !== undefined
                              ? unmaskedValues['moncash_MONCASH_CLIENT_SECRET']
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
                          className="w-full pl-3 pr-16 py-1.5 sm:py-2 bg-white border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 rounded-lg text-xs font-mono font-medium text-slate-900 outline-none transition-all shadow-2xs"
                        />
                        <div className="absolute right-1 flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => toggleRevealSecret('moncash', 'MONCASH_CLIENT_SECRET')}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                            title={revealedSecrets['moncash_MONCASH_CLIENT_SECRET'] ? 'Masquer' : 'Afficher'}
                          >
                            {revealedSecrets['moncash_MONCASH_CLIENT_SECRET'] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const val = unmaskedValues['moncash_MONCASH_CLIENT_SECRET'] || vaultData.moncash.client_secret;
                              copyToClipboard(val, 'client_secret');
                            }}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                            title="Copier"
                          >
                            {copiedKey === 'client_secret' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1 border-t border-slate-200/60 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                        <span className="text-slate-500">
                          {vaultData.moncash.client_secret ? `${vaultData.moncash.client_secret.length} car.` : 'Non renseigné'}
                        </span>
                        {vaultData.moncash.client_secret && (
                          <button
                            type="button"
                            onClick={() => toggleExpandedPreview('moncash_client_secret')}
                            className="text-[10.5px] font-bold text-red-600 hover:text-red-700 transition-colors cursor-pointer flex items-center gap-0.5"
                          >
                            <span>{expandedPreview['moncash_client_secret'] ? 'Réduire' : 'Aperçu'}</span>
                            {expandedPreview['moncash_client_secret'] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        )}
                      </div>

                      {expandedPreview['moncash_client_secret'] && vaultData.moncash.client_secret && (
                        <div className="p-2 rounded-md bg-slate-900 text-slate-100 font-mono text-[10px] break-all border border-slate-800 shadow-inner select-all animate-in fade-in duration-150">
                          {revealedSecrets['moncash_MONCASH_CLIENT_SECRET']
                            ? (unmaskedValues['moncash_MONCASH_CLIENT_SECRET'] || vaultData.moncash.client_secret)
                            : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* MONCASH_BUSINESS_KEY */}
                  <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Key size={13} className="text-purple-600" />
                          <span>Business Key</span>
                        </label>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white border border-slate-200 text-slate-600 font-bold shrink-0">
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
                          className="w-full pl-3 pr-10 py-1.5 sm:py-2 bg-white border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 rounded-lg text-xs font-mono font-medium text-slate-900 outline-none transition-all shadow-2xs"
                        />
                        {vaultData.moncash.business_key && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(vaultData.moncash.business_key, 'business_key')}
                            className="absolute right-1.5 p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-all cursor-pointer"
                            title="Copier"
                          >
                            {copiedKey === 'business_key' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* URL DE WEBHOOK MONCASH */}
                  <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Globe size={13} className="text-emerald-600" />
                          <span>URL Webhook MonCash</span>
                        </label>
                        <div className="flex items-center gap-0.5 bg-white p-0.5 rounded border border-slate-200 shadow-2xs">
                          {configuredAppUrl && (
                            <button
                              type="button"
                              onClick={() => setSelectedHostType('env')}
                              className={`px-1.5 py-0.2 text-[9px] font-bold rounded transition-all cursor-pointer ${
                                selectedHostType === 'env'
                                  ? 'bg-red-600 text-white shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Configurée
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedHostType('detected')}
                            className={`px-1.5 py-0.2 text-[9px] font-bold rounded transition-all cursor-pointer ${
                              selectedHostType === 'detected'
                                ? 'bg-red-600 text-white shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Actuel
                          </button>
                        </div>
                      </div>

                      <div className="relative flex items-center">
                        <input
                          type="text"
                          readOnly
                          value={webhookUrl}
                          className="w-full pl-3 pr-10 py-1.5 sm:py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 select-all cursor-pointer"
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <button
                          type="button"
                          onClick={() => copyToClipboard(webhookUrl, 'webhook_url')}
                          className="absolute right-1.5 p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-all cursor-pointer"
                          title="Copier"
                        >
                          {copiedKey === 'webhook_url' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* BOUTONS D'ACTION MONCASH */}
              <div className="pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveService('moncash')}
                  disabled={saving}
                  className="w-full sm:w-auto px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <Save size={13} />
                      <span>Enregistrer (AES-256)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== ONGLET NATCASH ===================== */}
      {activeTab === 'natcash' && (
        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200 shadow-2xs space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                NC
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                    Natcom Natcash
                  </h4>
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-300">
                    Bientôt Disponible
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">Portefeuille mobile Natcom</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
            {/* NATCASH_MERCHANT_ID */}
            <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200 space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Merchant ID
              </label>
              <input
                type="text"
                value={vaultData.natcash.merchant_id}
                onChange={(e) => setVaultData(prev => ({
                  ...prev,
                  natcash: { ...prev.natcash, merchant_id: e.target.value.trim() }
                }))}
                placeholder="Ex: NC-MERCHANT-001"
                className="w-full px-3 py-1.5 sm:py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all shadow-2xs"
              />
            </div>

            {/* NATCASH_SECRET_KEY */}
            <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
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
                className="w-full px-3 py-1.5 sm:py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all shadow-2xs"
              />
            </div>

            {/* NATCASH USSD */}
            <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200 space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Code USSD
              </label>
              <input
                type="text"
                value={vaultData.natcash.ussd_number}
                onChange={(e) => setVaultData(prev => ({
                  ...prev,
                  natcash: { ...prev.natcash, ussd_number: e.target.value.trim() }
                }))}
                placeholder="Ex: *202*12345#"
                className="w-full px-3 py-1.5 sm:py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all shadow-2xs"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={() => handleSaveService('natcash')}
              disabled={saving}
              className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              <Save size={13} />
              <span>Enregistrer Natcash (AES-256)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
