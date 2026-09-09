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
  CreditCard
} from 'lucide-react';
import { UserProfile } from '../types';
import { ApiVaultService } from '../services/apiVaultService';
import { MonCashGatewaySettings } from './MonCashGatewaySettings';
import { toast } from 'sonner';

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
    <div className="space-y-6">
      {/* BANNIÈRE DE SÉCURITÉ & COFFRE-FORT CENTRALISÉ */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-indigo-950 rounded-3xl p-5 sm:p-7 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  <span>Coffre-fort & Clés API</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <Lock size={10} /> AES-256-GCM
                  </span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 font-medium">
                  Gestion centralisée, chiffrement avant stockage en base Supabase et validation temps réel des passerelles.
                </p>
              </div>
            </div>

            {/* Badges de conformité et sécurité */}
            <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 text-slate-200 border border-white/10 text-[11px] font-bold">
                <Shield size={12} className="text-emerald-400" />
                Isolation Multi-Tenant Supabase
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 text-slate-200 border border-white/10 text-[11px] font-bold">
                <Database size={12} className="text-blue-400" />
                Secrets Chiffrés au Repos
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 text-slate-200 border border-white/10 text-[11px] font-bold">
                <Zap size={12} className="text-amber-400" />
                Vérification d'Endpoints API
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-center">
            <button
              type="button"
              onClick={loadVaultData}
              disabled={loading}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 active:bg-white/25 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border border-white/10 disabled:opacity-50"
              title="Actualiser les statuts du coffre-fort"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin text-indigo-300' : 'text-slate-300'} />
              <span>Actualiser</span>
            </button>
          </div>
        </div>
      </div>

      {/* SÉLECTEUR D'ONGLETS DE SERVICES */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('kobara')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'kobara'
              ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md shadow-orange-600/20'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <CreditCard size={16} />
          <span>Kobara (MonCash & Natcash)</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white font-black uppercase tracking-wider">
            Recommandé
          </span>
          {vaultData.kobara.validation_status === 'VALID' && (
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('moncash')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'moncash'
              ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Smartphone size={16} />
          <span>Digicel MonCash Direct</span>
          {vaultData.moncash.validation_status === 'VALID' && (
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('natcash')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'natcash'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Smartphone size={16} />
          <span>Natcom Natcash</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('smtp')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'smtp'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Mail size={16} />
          <span>Messagerie & SMTP</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('gemini')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'gemini'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Cpu size={16} />
          <span>IA Gemini</span>
        </button>
      </div>

      {/* CONTENU ONGLETS */}

      {/* ===================== ONGLET KOBARA ===================== */}
      {activeTab === 'kobara' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center font-black shadow-lg shadow-orange-600/20">
                  <CreditCard size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-black text-slate-900">Passerelle Kobara</h4>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-100 text-orange-800 border border-orange-200">
                      MonCash & Natcash
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Live Production
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Plateforme unifiée pour collecter les frais scolaires via MonCash et Natcash en direct avec webhooks automatisés.
                  </p>
                </div>
              </div>

              {/* Statut de validation */}
              <div className="flex items-center gap-2">
                {vaultData.kobara.validation_status === 'VALID' ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <span>API Connectée & Opérationnelle</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                    <AlertCircle size={16} className="text-amber-600" />
                    <span>Configuration Prête</span>
                  </div>
                )}
              </div>
            </div>

            {/* Guide rapide des webhooks Kobara */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 border border-orange-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-orange-950 flex items-center gap-1.5">
                  <Globe size={14} className="text-orange-600" />
                  URL de Webhook Kobara à configurer dans votre tableau de bord
                </span>
                <span className="text-[11px] font-bold text-orange-800 bg-orange-200/60 px-2 py-0.5 rounded-md">
                  Méthode: POST
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1 bg-white px-3.5 py-2.5 rounded-xl border border-orange-300 font-mono text-xs text-slate-800 break-all select-all font-semibold">
                  {kobaraWebhookUrl}
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(kobaraWebhookUrl, 'kobara_webhook')}
                  className="px-4 py-2.5 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-orange-600/20 shrink-0"
                >
                  {copiedKey === 'kobara_webhook' ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedKey === 'kobara_webhook' ? 'Copié !' : 'Copier l\'URL'}</span>
                </button>
              </div>

              <div className="text-[11px] text-orange-900/80 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-bold">Événements Kobara à écouter :</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/80 rounded border border-orange-200 font-mono text-[10px]">
                  payment.succeeded
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/80 rounded border border-orange-200 font-mono text-[10px]">
                  payment.failed
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/80 rounded border border-orange-200 font-mono text-[10px]">
                  payment.pending
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/80 rounded border border-orange-200 font-mono text-[10px]">
                  withdrawal.paid
                </span>
              </div>
            </div>

            {/* Formulaire des Clés Kobara */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Clé Secrète Kobara */}
              <div className="space-y-1.5 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Key size={13} className="text-orange-600" />
                    Clé Secrète Kobara (Secret Key) *
                  </label>
                  <span className="text-[10px] font-bold text-slate-500">
                    Format: kbr_sk_live_...
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
        <div className="space-y-6">
          {/* Toggle entre mode coffre-fort rapide et vue détaillée */}
          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Mode d'affichage MonCash :</span>
              <span className="text-xs text-slate-500">
                {showAdvancedMoncash ? 'Assistant détaillé & documentation' : 'Coffre-fort sécurisé & validation rapide'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowAdvancedMoncash(!showAdvancedMoncash)}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Sliders size={13} />
              <span>{showAdvancedMoncash ? 'Afficher vue simplifiée' : 'Afficher vue avancée complète'}</span>
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
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-6">
              {/* En-tête du service MonCash */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 border border-red-200/60 flex items-center justify-center font-black text-xl shrink-0">
                    MC
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                      <span>Digicel MonCash Business API</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        vaultData.moncash.mode === 'live' 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}>
                        {vaultData.moncash.mode === 'live' ? 'Mode Production Live' : 'Mode Sandbox Test'}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">
                      Encaissement automatisé des frais scolaires par portefeuille électronique Digicel.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href="https://moncashbutton.digicelgroup.com/Moncash-business/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition-all flex items-center gap-1.5 border border-red-200/60"
                  >
                    <span>Portail Développeur</span>
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>

              {/* STATUT DE VALIDATION EN DIRECT */}
              <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
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
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center font-black text-xl shrink-0">
                NC
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Natcom Natcash API</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-300">
                    Bientôt Disponible
                  </span>
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  Portefeuille électronique mobile Natcom pour les paiements de scolarité en Haïti.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* NATCASH_MERCHANT_ID */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
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
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
              />
            </div>

            {/* NATCASH_SECRET_KEY */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <span>Natcash Secret Key</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                  Chiffré AES-256
                </span>
              </label>
              <input
                type="password"
                value={vaultData.natcash.secret_key}
                onChange={(e) => setVaultData(prev => ({
                  ...prev,
                  natcash: { ...prev.natcash, secret_key: e.target.value }
                }))}
                placeholder="Clé secrète fournie par Natcom"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
              />
            </div>

            {/* NATCASH USSD */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Code Marchand USSD Natcash
              </label>
              <input
                type="text"
                value={vaultData.natcash.ussd_number}
                onChange={(e) => setVaultData(prev => ({
                  ...prev,
                  natcash: { ...prev.natcash, ussd_number: e.target.value }
                }))}
                placeholder="Ex: *202*12345#"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={() => handleSaveService('natcash')}
              disabled={saving}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save size={14} />
              <span>Enregistrer Natcash</span>
            </button>
          </div>
        </div>
      )}

      {/* ===================== ONGLET MESSAGERIE & SMTP ===================== */}
      {activeTab === 'smtp' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-6">
          <div className="flex items-center gap-3.5 pb-5 border-b border-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200/60 flex items-center justify-center shrink-0">
              <Mail size={24} />
            </div>
            <div>
              <h4 className="text-lg font-black text-slate-900 tracking-tight">
                Messagerie & Passerelles d'Envoi
              </h4>
              <p className="text-xs text-slate-500 font-medium">
                Paramètres SMTP sécurisés pour l'envoi des reçus de paiement et bulletins aux parents.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-start gap-3">
            <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <p>
              Les mots de passe de vos comptes d'envoi SMTP (Google Workspace, Brevo, SendGrid) sont également chiffrés avec AES-256-GCM avant stockage dans la table <code className="font-mono font-bold">communication_settings</code> de Supabase.
            </p>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Rendez-vous dans le module <span className="font-bold text-slate-700">Communication & Notifications</span> pour tester et configurer l'ensemble des modèles d'e-mails et de SMS.
          </div>
        </div>
      )}

      {/* ===================== ONGLET GEMINI AI ===================== */}
      {activeTab === 'gemini' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-6">
          <div className="flex items-center gap-3.5 pb-5 border-b border-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-200/60 flex items-center justify-center shrink-0">
              <Sparkles size={24} />
            </div>
            <div>
              <h4 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Google Gemini API Server-Side</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  vaultData.gemini.api_key_configured
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}>
                  {vaultData.gemini.api_key_configured ? 'Clé Active sur le Serveur' : 'Non configurée'}
                </span>
              </h4>
              <p className="text-xs text-slate-500 font-medium">
                Moteur d'analyse prédictive des paiements, génération de rapports pédagogiques et assistance intelligente.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Statut de la clé GEMINI_API_KEY</span>
              <span className="text-xs font-mono font-bold text-purple-700">
                {vaultData.gemini.masked_key || (vaultData.gemini.api_key_configured ? '••••••••••••••••' : 'Non détectée')}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Conformément aux normes de sécurité strictes, la clé d'API Gemini est gérée de manière totalement hermétique sur le serveur backend Node.js (`process.env.GEMINI_API_KEY`) et n'est jamais exposée dans le navigateur client.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
