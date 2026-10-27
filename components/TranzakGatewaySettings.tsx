import React, { useState, useEffect } from 'react';
import { 
  Key, 
  Lock, 
  Eye, 
  EyeOff, 
  Save, 
  Loader2, 
  Globe, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  ShieldCheck, 
  Zap, 
  Smartphone, 
  HelpCircle, 
  Building2, 
  ExternalLink,
  RefreshCw,
  Coins,
  Shield,
  Layers,
  ArrowRight,
  Wallet,
  Receipt,
  CreditCard,
  ArrowUpRight
} from 'lucide-react';
import { useSchool } from '../contexts/SchoolContext';
import { UserProfile } from '../types';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import { formatStudentName } from '../utils/formatters';

export interface TranzakGatewaySettingsProps {
  user: UserProfile;
  canManageAllCampuses: boolean;
  isActiveGateway?: boolean;
  isGatewaysEnabledForSchool?: boolean;
  onMakeActiveGateway?: () => void;
}

export const TranzakGatewaySettings: React.FC<TranzakGatewaySettingsProps> = ({
  user,
  canManageAllCampuses,
  isActiveGateway = false,
  isGatewaysEnabledForSchool = true,
  onMakeActiveGateway
}) => {
  const { school } = useSchool();
  const currentSchoolId = user.school_id || school?.id || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(true);
  const [showWebhookSecret, setShowWebhookSecret] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [config, setConfig] = useState<{
    api_key: string;
    webhook_secret: string;
    mode: 'live' | 'test';
    is_active: boolean;
    has_key: boolean;
    has_webhook_secret: boolean;
  }>({
    api_key: '',
    webhook_secret: '',
    mode: 'live',
    is_active: true,
    has_key: false,
    has_webhook_secret: false
  });

  const [testResult, setTestResult] = useState<{
    status: 'idle' | 'success' | 'error';
    message: string;
    timestamp?: string;
  } | null>(null);

  // Transactions Tranzak reçues par l'établissement
  const [tranzakPayments, setTranzakPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const loadTranzakTransactions = async () => {
    if (!currentSchoolId) return;
    setLoadingPayments(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('id, receipt_number, amount, amount_htg_equivalent, currency, payment_method, reference_number, fee_type, status, payment_date, created_at, notes, student_id, student:students(id, first_name, last_name, matricule)')
        .eq('school_id', currentSchoolId)
        .or('payment_method.ilike.%tranzak%,reference_number.ilike.TZK-%,fee_type.eq.CREDIT_PORTEFEUILLE,fee_type.eq.RECHARGE_PORTEFEUILLE')
        .order('created_at', { ascending: false })
        .limit(30);

      if (!error && data) {
        setTranzakPayments(data);
      }
    } catch (err) {
      console.warn('Erreur chargement transactions Tranzak:', err);
    } finally {
      setLoadingPayments(false);
    }
  };

  // Charger les identifiants existants
  useEffect(() => {
    let isMounted = true;
    async function loadTranzakConfig() {
      if (!currentSchoolId) {
        setLoading(false);
        return;
      }
      try {
        const token = (await supabase.auth.getSession()).data?.session?.access_token;
        const res = await fetch(`/api/settings/api-credentials?school_id=${encodeURIComponent(currentSchoolId)}`, {
          headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data?.credentials?.tranzak) {
            const tz = data.credentials.tranzak;
            setConfig({
              api_key: tz.api_key || '',
              webhook_secret: tz.webhook_secret || '',
              mode: (tz.mode === 'test' ? 'test' : 'live'),
              is_active: tz.is_active ?? true,
              has_key: tz.has_key || Boolean(tz.api_key),
              has_webhook_secret: tz.has_webhook_secret || Boolean(tz.webhook_secret)
            });
          }
        }
      } catch (err) {
        console.warn('Erreur chargement Tranzak:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadTranzakConfig();
    loadTranzakTransactions();
    return () => { isMounted = false; };
  }, [currentSchoolId]);

  const handleCopy = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`${fieldName} copié dans le presse-papier`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSave = async () => {
    if (!canManageAllCampuses) {
      toast.error("Seule la direction générale peut modifier les clés de passerelle.");
      return;
    }
    if (!config.api_key && !config.has_key) {
      toast.error("Veuillez renseigner la Clé API Tranzak (tk_live_... ou tk_test_...).");
      return;
    }

    setSaving(true);
    try {
      const token = (await supabase.auth.getSession()).data?.session?.access_token;
      const res = await fetch('/api/settings/api-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          school_id: currentSchoolId,
          service_name: 'tranzak',
          credentials: {
            api_key: config.api_key,
            webhook_secret: config.webhook_secret,
            mode: config.mode,
            is_active: config.is_active
          },
          environment: config.mode === 'test' ? 'test' : 'production',
          is_active: config.is_active
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Paramètres Tranzak enregistrés et chiffrés avec succès !");
        setConfig(prev => ({
          ...prev,
          has_key: Boolean(prev.api_key) || prev.has_key,
          has_webhook_secret: Boolean(prev.webhook_secret) || prev.has_webhook_secret
        }));
      } else {
        throw new Error(data.error || "Erreur lors de l'enregistrement");
      }
    } catch (err: any) {
      toast.error(err.message || "Impossible d'enregistrer les paramètres Tranzak");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const token = (await supabase.auth.getSession()).data?.session?.access_token;
      const res = await fetch('/api/tranzak/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          school_id: currentSchoolId,
          api_key: config.api_key,
          mode: config.mode
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          status: 'success',
          message: data.message || `Connexion à Tranzak (${config.mode === 'live' ? 'Live' : 'Test'}) validée avec succès !`,
          timestamp: new Date().toLocaleTimeString()
        });
        toast.success("Passerelle Tranzak opérationnelle !");
      } else {
        setTestResult({
          status: 'error',
          message: data.error || "Échec de validation de la clé API Tranzak.",
          timestamp: new Date().toLocaleTimeString()
        });
        toast.error(data.error || "Clé API Tranzak non reconnue");
      }
    } catch (err: any) {
      setTestResult({
        status: 'error',
        message: err.message || "Erreur de connexion au serveur Tranzak.",
        timestamp: new Date().toLocaleTimeString()
      });
      toast.error("Erreur réseau lors du test Tranzak");
    } finally {
      setTesting(false);
    }
  };

  // Détermination dynamique des URL de production / dev
  const rawOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://edunova-pro.tech';
  // Nettoyage pour le champ Domain de Tranzak (sans http:// ni /#/)
  const cleanDomain = rawOrigin.replace(/^https?:\/\//, '').replace(/\/.*$/, '') || 'edunova-pro.tech';
  const callbackUrl = `${rawOrigin}/api/tranzak/webhook`;
  const returnUrl = `${rawOrigin}/#/fees?payment=success`;
  const cancelUrl = `${rawOrigin}/#/fees?payment=cancel`;

  // Calcul des statistiques des encaissements Tranzak pour l'établissement
  const stats = React.useMemo(() => {
    let totalHTG = 0;
    let walletHTG = 0;
    let validCount = 0;

    for (const p of tranzakPayments) {
      const amt = Number(p.amount_htg_equivalent || p.amount || 0);
      const isValide = !p.status || p.status.toUpperCase() === 'VALIDE' || p.status.toUpperCase() === 'PAID';
      if (isValide) {
        totalHTG += amt;
        validCount++;
        if (
          p.fee_type === 'CREDIT_PORTEFEUILLE' || 
          p.fee_type === 'RECHARGE_PORTEFEUILLE' || 
          (p.notes || '').toLowerCase().includes('portefeuille')
        ) {
          walletHTG += amt;
        }
      }
    }

    return { totalHTG, walletHTG, validCount };
  }, [tranzakPayments]);

  if (loading) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
        <p className="text-xs text-slate-500 font-medium">Chargement des paramètres Tranzak...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* BANDEAU D'ÉTAT D'ACTIVITÉ EN DIRECT */}
      <div className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
        !isGatewaysEnabledForSchool
          ? 'bg-amber-50/80 border-amber-200 text-amber-950'
          : isActiveGateway 
          ? 'bg-emerald-50 border-emerald-200 text-emerald-950 shadow-2xs' 
          : 'bg-slate-50 border-slate-200 text-slate-800'
      }`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            !isGatewaysEnabledForSchool
              ? 'bg-amber-500 text-white'
              : isActiveGateway 
              ? 'bg-emerald-600 text-white shadow-xs' 
              : 'bg-slate-200 text-slate-600'
          }`}>
            <Layers size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-black tracking-tight">Passerelle Tranzak :</span>
              {!isGatewaysEnabledForSchool ? (
                <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider bg-amber-500 text-white flex items-center gap-1">
                  <Lock size={10} />
                  <span>SUSPENDU (GOUVERNANCE SAAS)</span>
                </span>
              ) : isActiveGateway ? (
                <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-2xs flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                  <span>EN SERVICE • ACTIVE</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700">
                  En Veille
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5 truncate">
              {!isGatewaysEnabledForSchool
                ? "Passerelles API désactivées par le Super Admin pour cette école. Mode manuel actif."
                : isActiveGateway 
                ? 'Tranzak traite en direct tous les encaissements MonCash & NatCash.' 
                : 'Passerelle sauvegardée. Une autre passerelle est prioritaire.'}
            </p>
          </div>
        </div>

        {isGatewaysEnabledForSchool && !isActiveGateway && onMakeActiveGateway && (
          <button
            type="button"
            onClick={onMakeActiveGateway}
            className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-center"
          >
            <CheckCircle2 size={13} />
            <span>Activer Tranzak en 1 clic</span>
          </button>
        )}
      </div>

      {/* NOTICE ISOLATION TRANZAK POUR L'ÉCOLE */}
      <div className="p-2.5 rounded-lg bg-blue-50/80 border border-blue-200/90 text-xs flex items-start gap-2.5 text-blue-900">
        <ShieldCheck size={16} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <span className="font-bold text-blue-950">Clés Tranzak Propres à l'Établissement ({school?.name || 'Votre École'})</span>
          <p className="text-[11px] text-blue-800/90 leading-relaxed mt-0.5">
            Les clés API renseignées ci-dessous sont enregistrées avec l'identifiant de votre école (<code className="font-mono bg-blue-100/60 px-1 py-0.2 rounded text-[10px]">{currentSchoolId || 'school_id'}</code>). Elles se substituent aux clés globales de la plateforme et dirigent tous les encaissements MonCash &amp; NatCash directement sur votre compte marchand Tranzak.
          </p>
        </div>
      </div>

      {/* 1. GUIDE D'INTÉGRATION COMPACT TRANZAK DASHBOARD */}
      <div className="bg-slate-900 text-white rounded-xl p-3 sm:p-3.5 border border-slate-800 shadow-2xs space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
              <Layers size={14} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold text-white tracking-tight">
                  Paramètres Tranzak (Add Website)
                </h4>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Webhooks
                </span>
              </div>
              <p className="text-[10.5px] text-slate-400">
                Copiez ces paramètres dans votre compte Tranzak Developer.
              </p>
            </div>
          </div>

          <a 
            href="https://dashboard.tranzak.co/customer/developer" 
            target="_blank" 
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer shrink-0"
          >
            <span>Tranzak Developer</span>
            <ExternalLink size={12} />
          </a>
        </div>

        {/* Grille compacte des 3 informations principales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
          {/* Domain */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-2.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Domain *</span>
                <span className="text-[8.5px] px-1 py-0.2 bg-amber-500/20 text-amber-300 rounded font-semibold">Sans https://</span>
              </div>
              <span className="font-mono text-amber-200 font-bold text-xs truncate block">{cleanDomain}</span>
            </div>
            <button 
              type="button" 
              onClick={() => handleCopy(cleanDomain, 'Domaine')}
              className="p-1.5 bg-white/10 hover:bg-white/20 text-slate-200 rounded-md transition-colors shrink-0 cursor-pointer"
              title="Copier le domaine"
            >
              {copiedField === 'Domaine' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
          </div>

          {/* Callback URL */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-2.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[9.5px] font-bold text-emerald-400 uppercase tracking-wider block">Callback URL (Webhook) *</span>
              <span className="font-mono text-emerald-300 font-semibold text-xs truncate block">{callbackUrl}</span>
            </div>
            <button 
              type="button" 
              onClick={() => handleCopy(callbackUrl, 'Callback URL')}
              className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-md transition-colors shrink-0 cursor-pointer"
              title="Copier l'URL de notification"
            >
              {copiedField === 'Callback URL' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
          </div>

          {/* Website Name */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-2.5 flex items-center justify-between gap-2 sm:col-span-2 lg:col-span-1">
            <div className="min-w-0">
              <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Website Name *</span>
              <span className="font-mono text-white font-semibold text-xs truncate block">EduNova PRO</span>
            </div>
            <button 
              type="button" 
              onClick={() => handleCopy('EduNova PRO', 'Nom du site')}
              className="p-1.5 bg-white/10 hover:bg-white/20 text-slate-200 rounded-md transition-colors shrink-0 cursor-pointer"
              title="Copier le nom"
            >
              {copiedField === 'Nom du site' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
          </div>
        </div>

        {/* Redirections secondaires en bande compacte */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-white/10">
          <div className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Return URL (Succès)</span>
              <span className="font-mono text-slate-300 text-[10.5px] truncate block">{returnUrl}</span>
            </div>
            <button 
              type="button" 
              onClick={() => handleCopy(returnUrl, 'Return URL')}
              className="p-1 bg-white/10 hover:bg-white/20 text-slate-300 rounded transition-colors shrink-0 cursor-pointer"
              title="Copier"
            >
              {copiedField === 'Return URL' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            </button>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Cancel URL (Annulation)</span>
              <span className="font-mono text-slate-300 text-[10.5px] truncate block">{cancelUrl}</span>
            </div>
            <button 
              type="button" 
              onClick={() => handleCopy(cancelUrl, 'Cancel URL')}
              className="p-1 bg-white/10 hover:bg-white/20 text-slate-300 rounded transition-colors shrink-0 cursor-pointer"
              title="Copier"
            >
              {copiedField === 'Cancel URL' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            </button>
          </div>
        </div>
      </div>

      {/* 2. FORMULAIRE DES IDENTIFIANTS TRANZAK (CLÉ API & WEBHOOK SECRET) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center justify-center shrink-0">
              <Smartphone size={16} />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                Clés API Tranzak (MonCash &amp; NatCash)
              </h4>
              <p className="text-[11px] text-slate-500">
                Encaissez MonCash et NatCash avec une clé unique.
              </p>
            </div>
          </div>

          {/* Mode & Toggle */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setConfig(prev => ({ ...prev, mode: 'live' }))}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  config.mode === 'live' 
                    ? 'bg-emerald-600 text-white shadow-2xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Production
              </button>
              <button
                type="button"
                onClick={() => setConfig(prev => ({ ...prev, mode: 'test' }))}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  config.mode === 'test' 
                    ? 'bg-amber-600 text-white shadow-2xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Test
              </button>
            </div>

            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
              <span className="text-[11px] font-bold text-slate-700">Actif :</span>
              <button
                type="button"
                onClick={() => setConfig(prev => ({ ...prev, is_active: !prev.is_active }))}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                  config.is_active ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span className={`block w-3.5 h-3.5 rounded-full bg-white transition-transform transform ${
                  config.is_active ? 'translate-x-4.5' : 'translate-x-0.5'
                } top-0.5 absolute`} />
              </button>
            </div>
          </div>
        </div>

        {/* Champs de saisie compacts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Tranzak API Key */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-900 flex items-center justify-between">
              <span>Clé API (X-Api-Key) *</span>
              {config.has_key && (
                <span className="text-[10px] text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded font-bold flex items-center gap-1 border border-emerald-200">
                  <ShieldCheck size={11} className="text-emerald-600" /> Configurée
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={config.api_key}
                onChange={e => {
                  const val = e.target.value.trim();
                  const detectedMode = val.startsWith('tk_test_') ? 'test' : (val.startsWith('tk_live_') ? 'live' : config.mode);
                  setConfig(prev => ({ ...prev, api_key: val, mode: detectedMode }));
                }}
                placeholder={config.has_key ? '••••••••••••••••••••••••••••••••' : (config.mode === 'live' ? 'tk_live_...' : 'tk_test_...')}
                className="w-full pl-8 pr-8 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-lg text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all"
              />
              <Key size={14} className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 p-1 rounded transition-colors cursor-pointer"
                title={showApiKey ? 'Masquer' : 'Afficher'}
              >
                {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-[10.5px] text-slate-500">
              Dashboard Tranzak → Developer → Websites.
            </p>
          </div>

          {/* Webhook Secret */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-900 flex items-center justify-between">
              <span>Secret Webhook (Signature HMAC-SHA256)</span>
              {config.has_webhook_secret && (
                <span className="text-[10px] text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded font-bold flex items-center gap-1 border border-emerald-200">
                  <ShieldCheck size={11} className="text-emerald-600" /> Configuré
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type={showWebhookSecret ? 'text' : 'password'}
                value={config.webhook_secret}
                onChange={e => setConfig(prev => ({ ...prev, webhook_secret: e.target.value }))}
                placeholder={config.has_webhook_secret ? '••••••••••••••••••••••••••••••••' : 'whsec_...'}
                className="w-full pl-8 pr-8 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-lg text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all"
              />
              <Lock size={14} className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 p-1 rounded transition-colors cursor-pointer"
                title={showWebhookSecret ? 'Masquer' : 'Afficher'}
              >
                {showWebhookSecret ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-[10.5px] text-slate-500">
              Valide l'authenticité des notifications instantanées HMAC-SHA256.
            </p>
          </div>
        </div>

        {/* Résultat du test compact */}
        {testResult && (
          <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
            testResult.status === 'success' 
              ? 'bg-emerald-50 text-emerald-950 border border-emerald-200' 
              : 'bg-rose-50 text-rose-950 border border-rose-200'
          }`}>
            {testResult.status === 'success' ? (
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={15} className="text-rose-600 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-xs text-slate-900">{testResult.message}</p>
              {testResult.timestamp && (
                <span className="text-[10px] text-slate-500 block">
                  Test à {testResult.timestamp}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Boutons d'action compacts */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2.5 border-t border-slate-100">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing || (!config.api_key && !config.has_key)}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {testing ? <Loader2 size={13} className="animate-spin text-blue-400" /> : <RefreshCw size={13} />}
            <span>Tester la connexion</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !canManageAllCampuses}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            <span>Enregistrer dans le Coffre-fort</span>
          </button>
        </div>
      </div>

      {/* 3. RÈGLES OPÉRATIONNELLES COMPACTES */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-3 text-xs space-y-2">
        <h5 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
          <Coins size={14} className="text-amber-600" />
          <span>Règles Opérationnelles Tranzak (MonCash &amp; NatCash)</span>
        </h5>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-600 text-[11px]">
          <div className="bg-white p-2 rounded-lg border border-slate-200">
            <strong className="text-slate-900 font-bold block mb-0.5">Devise HTG :</strong>
            Conversion auto des montants USD en HTG au taux configuré.
          </div>
          <div className="bg-white p-2 rounded-lg border border-slate-200">
            <strong className="text-slate-900 font-bold block mb-0.5">Minimum :</strong>
            20 HTG minimum par transaction exigé par l'API.
          </div>
          <div className="bg-white p-2 rounded-lg border border-slate-200">
            <strong className="text-slate-900 font-bold block mb-0.5">Validation :</strong>
            Reçu de paiement et balance mis à jour en direct.
          </div>
        </div>
      </div>

      {/* 4. HISTORIQUE & AUDIT DES ENCAISSEMENTS TRANZAK DE L'ÉTABLISSEMENT */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-purple-50 text-purple-700 rounded-lg border border-purple-200">
                <Receipt size={16} />
              </div>
              <h5 className="font-bold text-slate-900 text-sm">
                Journal des Encaissements &amp; Dépôts Reçus (Tranzak / SAGACETECH)
              </h5>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Montants directement perçus sur le compte Tranzak de l'établissement et répercutés sur les portefeuilles des élèves.
            </p>
          </div>

          <button
            type="button"
            onClick={loadTranzakTransactions}
            disabled={loadingPayments}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw size={13} className={loadingPayments ? "animate-spin text-purple-600" : "text-slate-500"} />
            <span>Actualiser</span>
          </button>
        </div>

        {/* 3 Cartes statistiques Tranzak */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50/40 p-3 rounded-xl border border-purple-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">
              Total Perçu sur Compte Tranzak
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-black text-purple-950 font-mono">
                {stats.totalHTG.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-purple-700">HTG</span>
            </div>
            <span className="text-[10.5px] text-purple-800/80 mt-0.5 block">
              {stats.validCount} transaction(s) certifiée(s)
            </span>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-teal-50/40 p-3 rounded-xl border border-emerald-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
              Dont Dépôts Portefeuilles Élèves
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-black text-emerald-950 font-mono">
                {stats.walletHTG.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-emerald-700">HTG</span>
            </div>
            <span className="text-[10.5px] text-emerald-800/80 mt-0.5 block">
              Crédits cantine &amp; fournitures
            </span>
          </div>

          <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 p-3 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
              Passerelle &amp; Sécurité
            </span>
            <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <ShieldCheck size={16} className="text-emerald-600" />
              <span>{config.mode === 'live' ? 'Production Réelle' : 'Mode Test Sandbox'}</span>
            </div>
            <span className="text-[10.5px] text-slate-500 mt-0.5 block">
              Agrégateur SAGACETECH Haïti
            </span>
          </div>
        </div>

        {/* Tableau des transactions Tranzak de l'établissement */}
        {loadingPayments ? (
          <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 size={20} className="animate-spin text-purple-600" />
            <span className="text-xs">Chargement des transactions Tranzak...</span>
          </div>
        ) : tranzakPayments.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-slate-500 text-xs">
            <Receipt className="mx-auto text-slate-400 mb-1" size={24} />
            <p className="font-bold text-slate-700">Aucun encaissement Tranzak enregistré pour l'instant</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Les versements effectués par les parents ou via le bouton de test apparaîtront immédiatement dans ce journal.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">Reçu</th>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Élève</th>
                  <th className="py-2 px-3">Nature</th>
                  <th className="py-2 px-3">Réf. Tranzak</th>
                  <th className="py-2 px-3 text-right">Montant (HTG)</th>
                  <th className="py-2 px-3 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {tranzakPayments.map((p) => {
                  const studentObj = p.student;
                  const isWallet = p.fee_type === 'CREDIT_PORTEFEUILLE' || 
                    p.fee_type === 'RECHARGE_PORTEFEUILLE' || 
                    (p.notes || '').toLowerCase().includes('portefeuille');
                  const pDate = p.payment_date || p.created_at;
                  const formattedDate = pDate ? new Date(pDate).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : '-';

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-3 font-mono font-bold text-indigo-700 whitespace-nowrap">
                        #{p.receipt_number || 'SANS-NO'}
                      </td>
                      <td className="py-2 px-3 text-slate-500 whitespace-nowrap text-[11px]">
                        {formattedDate}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-900 whitespace-nowrap">
                        {studentObj 
                          ? formatStudentName(studentObj.last_name, studentObj.first_name).fullName 
                          : 'Élève'}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        {isWallet ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Wallet size={10} className="text-emerald-600 shrink-0" />
                            Dépôt Portefeuille
                          </span>
                        ) : (
                          <span className="text-slate-700 text-[11px]">
                            {p.fee_type || 'Scolarité'}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-mono text-[10.5px] text-purple-700 font-bold whitespace-nowrap">
                        {p.reference_number || '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-black text-slate-900 font-mono whitespace-nowrap">
                        {Number(p.amount_htg_equivalent || p.amount || 0).toLocaleString()} HTG
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={10} />
                          Validé
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

