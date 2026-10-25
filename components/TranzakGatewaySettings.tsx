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
  ArrowRight
} from 'lucide-react';
import { useSchool } from '../contexts/SchoolContext';
import { UserProfile } from '../types';
import { toast } from 'sonner';
import { supabase } from '../supabase';

export interface TranzakGatewaySettingsProps {
  user: UserProfile;
  canManageAllCampuses: boolean;
}

export const TranzakGatewaySettings: React.FC<TranzakGatewaySettingsProps> = ({
  user,
  canManageAllCampuses
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

  if (loading) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
        <p className="text-xs text-slate-500 font-medium">Chargement des paramètres Tranzak...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. Carte Guide de Remplissage Tranzak Dashboard */}
      <div className="bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 text-white rounded-2xl p-5 border border-blue-900/40 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
              <Layers size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-500/30 text-blue-300 border border-blue-400/40">
                  Documentation & Intégration
                </span>
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Configuration sur le Tableau de Bord Tranzak
                </h3>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Remplissez les champs ci-dessous dans la modale <strong className="text-white">"Add Website"</strong> de votre compte Tranzak.
              </p>
            </div>
          </div>

          <a 
            href="https://dashboard.tranzak.co/customer/developer" 
            target="_blank" 
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <span>Ouvrir Tranzak Developer</span>
            <ExternalLink size={13} />
          </a>
        </div>

        {/* Grille des informations à copier directement */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {/* Website Name */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Website Name *</span>
              <span className="font-mono text-white font-semibold text-xs truncate block">EduNova PRO</span>
            </div>
            <button 
              type="button" 
              onClick={() => handleCopy('EduNova PRO', 'Nom du site')}
              className="p-1.5 bg-white/10 hover:bg-white/20 text-slate-200 rounded-lg transition-colors shrink-0"
              title="Copier"
            >
              {copiedField === 'Nom du site' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>

          {/* Domain (Important : sans https://) */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Domain *</span>
                <span className="text-[9px] px-1 py-0.2 bg-amber-500/20 text-amber-300 rounded font-semibold">Sans https://</span>
              </div>
              <span className="font-mono text-amber-200 font-bold text-xs truncate block">{cleanDomain}</span>
            </div>
            <button 
              type="button" 
              onClick={() => handleCopy(cleanDomain, 'Domaine')}
              className="p-1.5 bg-white/10 hover:bg-white/20 text-slate-200 rounded-lg transition-colors shrink-0"
              title="Copier"
            >
              {copiedField === 'Domaine' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>

          {/* Callback URL */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between gap-2 md:col-span-2">
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Callback URL (Webhook Notifications) *</span>
              <span className="font-mono text-emerald-300 font-semibold text-xs truncate block">{callbackUrl}</span>
            </div>
            <button 
              type="button" 
              onClick={() => handleCopy(callbackUrl, 'Callback URL')}
              className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg transition-colors shrink-0"
              title="Copier"
            >
              {copiedField === 'Callback URL' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>

          {/* Return URL */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Return URL (Redirection Succès)</span>
              <span className="font-mono text-white text-[11px] truncate block">{returnUrl}</span>
            </div>
            <button 
              type="button" 
              onClick={() => handleCopy(returnUrl, 'Return URL')}
              className="p-1.5 bg-white/10 hover:bg-white/20 text-slate-200 rounded-lg transition-colors shrink-0"
              title="Copier"
            >
              {copiedField === 'Return URL' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>

          {/* Cancel URL */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cancel URL (Redirection Annulation)</span>
              <span className="font-mono text-white text-[11px] truncate block">{cancelUrl}</span>
            </div>
            <button 
              type="button" 
              onClick={() => handleCopy(cancelUrl, 'Cancel URL')}
              className="p-1.5 bg-white/10 hover:bg-white/20 text-slate-200 rounded-lg transition-colors shrink-0"
              title="Copier"
            >
              {copiedField === 'Cancel URL' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        {/* Note importante */}
        <div className="mt-3.5 p-2.5 bg-blue-900/30 border border-blue-700/40 rounded-xl flex items-start gap-2 text-[11px] text-blue-200">
          <HelpCircle size={15} className="shrink-0 text-blue-300 mt-0.5" />
          <p>
            <strong>Point critique :</strong> Dans la boîte de dialogue de Tranzak, pour le champ <em>Domain</em>, saisissez simplement <strong>{cleanDomain}</strong> (sans <code>https://</code> et sans <code>/#/</code>).
          </p>
        </div>
      </div>

      {/* 2. Formulaire des Identifiants Tranzak (Clé API & Webhook Secret) */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center justify-center shrink-0">
              <Smartphone size={20} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-950">
                Clés API Tranzak (MonCash &amp; NatCash)
              </h4>
              <p className="text-xs text-slate-700 font-semibold mt-0.5">
                Passerelle unifiée permettant d'encaisser MonCash et NatCash avec une seule clé d'API.
              </p>
            </div>
          </div>

          {/* Toggle Actif / Inactif */}
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-black text-slate-950">Activer Tranzak :</span>
            <button
              type="button"
              onClick={() => setConfig(prev => ({ ...prev, is_active: !prev.is_active }))}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                config.is_active ? 'bg-emerald-600' : 'bg-slate-400'
              }`}
            >
              <span className={`block w-4 h-4 rounded-full bg-white transition-transform transform ${
                config.is_active ? 'translate-x-6' : 'translate-x-1'
              } top-1 absolute`} />
            </button>
          </div>
        </div>

        {/* Sélection de l'environnement (Live vs Test) */}
        <div className="flex items-center gap-3 bg-slate-100/90 p-3 rounded-xl border border-slate-300">
          <span className="text-xs font-black text-slate-950">Environnement Tranzak :</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfig(prev => ({ ...prev, mode: 'live' }))}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                config.mode === 'live' 
                  ? 'bg-emerald-700 text-white shadow-xs ring-2 ring-emerald-500/30' 
                  : 'bg-white text-slate-800 hover:bg-slate-50 border border-slate-300 font-bold'
              }`}
            >
              🟢 Production (Live - tk_live_...)
            </button>
            <button
              type="button"
              onClick={() => setConfig(prev => ({ ...prev, mode: 'test' }))}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                config.mode === 'test' 
                  ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-500/30' 
                  : 'bg-white text-slate-800 hover:bg-slate-50 border border-slate-300 font-bold'
              }`}
            >
              🟡 Test (Sandbox - tk_test_...)
            </button>
          </div>
        </div>

        {/* Champs de saisie */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tranzak API Key */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-950 flex items-center justify-between">
              <span>Clé API Tranzak (X-Api-Key) *</span>
              {config.has_key && (
                <span className="text-[11px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 border border-emerald-300">
                  <ShieldCheck size={13} className="text-emerald-700" /> Configurée &amp; Active
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
                placeholder={config.has_key ? '••••••••••••••••••••••••••••••••' : (config.mode === 'live' ? 'tk_live_xxxxxxxxxxxxxxxx' : 'tk_test_xxxxxxxxxxxxxxxx')}
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border-2 border-slate-300 focus:border-blue-600 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-950 placeholder:text-slate-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all shadow-2xs"
              />
              <Key size={16} className="absolute left-3 top-3 text-slate-600 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-2.5 text-slate-600 hover:text-slate-950 p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                title={showApiKey ? "Masquer la clé" : "Afficher la clé"}
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-xs text-slate-700 font-semibold leading-relaxed">
              Disponible directement dans votre dashboard Tranzak sous <strong className="font-bold text-slate-950 underline decoration-slate-400">Developer → Websites</strong>.
            </p>
          </div>

          {/* Webhook Secret */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-950 flex items-center justify-between">
              <span>Secret Webhook (Signature HMAC-SHA256)</span>
              {config.has_webhook_secret && (
                <span className="text-[11px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 border border-emerald-300">
                  <ShieldCheck size={13} className="text-emerald-700" /> Configuré &amp; Actif
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type={showWebhookSecret ? 'text' : 'password'}
                value={config.webhook_secret}
                onChange={e => setConfig(prev => ({ ...prev, webhook_secret: e.target.value }))}
                placeholder={config.has_webhook_secret ? '••••••••••••••••••••••••••••••••' : 'whsec_xxxxxxxxxxxxxxxx'}
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border-2 border-slate-300 focus:border-blue-600 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-950 placeholder:text-slate-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all shadow-2xs"
              />
              <Lock size={16} className="absolute left-3 top-3 text-slate-600 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                className="absolute right-3 top-2.5 text-slate-600 hover:text-slate-950 p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                title={showWebhookSecret ? "Masquer le secret" : "Afficher le secret"}
              >
                {showWebhookSecret ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-xs text-slate-700 font-semibold leading-relaxed">
              Permet de valider cryptographiquement l'authenticité des notifications de paiement HMAC-SHA256.
            </p>
          </div>
        </div>

        {/* Résultat du test */}
        {testResult && (
          <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
            testResult.status === 'success' 
              ? 'bg-emerald-50 text-emerald-950 border-2 border-emerald-300 shadow-2xs' 
              : 'bg-rose-50 text-rose-950 border-2 border-rose-300 shadow-2xs'
          }`}>
            {testResult.status === 'success' ? (
              <CheckCircle2 size={18} className="text-emerald-700 shrink-0" />
            ) : (
              <AlertCircle size={18} className="text-rose-700 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-black text-sm text-slate-950">{testResult.message}</p>
              {testResult.timestamp && (
                <span className="text-xs font-bold text-emerald-800 font-mono block mt-0.5">
                  Test effectué à {testResult.timestamp}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Boutons d'action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing || (!config.api_key && !config.has_key)}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
          >
            {testing ? <Loader2 size={15} className="animate-spin text-blue-400" /> : <RefreshCw size={15} />}
            <span>Tester la connexion Tranzak</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !canManageAllCampuses}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/25 cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            <span>Enregistrer dans le Coffre-fort</span>
          </button>
        </div>
      </div>

      {/* 3. Règles et fonctionnement Tranzak */}
      <div className="bg-slate-100/90 border border-slate-300 rounded-2xl p-4 text-xs space-y-3">
        <h5 className="font-black text-slate-950 flex items-center gap-2 text-sm">
          <Coins size={16} className="text-amber-600" />
          Règles Opérationnelles Tranzak (MonCash &amp; NatCash)
        </h5>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-700">
          <div className="bg-white p-3 rounded-xl border-2 border-slate-200 shadow-2xs">
            <strong className="text-slate-950 font-black block mb-1">Devise Gourdes (HTG) :</strong>
            Les montants en USD sont automatiquement convertis en HTG au taux de change configuré avant transmission.
          </div>
          <div className="bg-white p-3 rounded-xl border-2 border-slate-200 shadow-2xs">
            <strong className="text-slate-950 font-black block mb-1">Montant Minimum :</strong>
            20 HTG minimum par transaction exigé par l'API Tranzak.
          </div>
          <div className="bg-white p-3 rounded-xl border-2 border-slate-200 shadow-2xs">
            <strong className="text-slate-950 font-black block mb-1">Confirmation Instantanée :</strong>
            Dès validation par le parent, le reçu de paiement est généré et la balance est mise à jour immédiatement.
          </div>
        </div>
      </div>
    </div>
  );
};
