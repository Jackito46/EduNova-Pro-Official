import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ShieldCheck,
  Layers,
  CreditCard,
  ArrowRight,
  Lock,
  Copy,
  ExternalLink,
  Zap,
  AlertCircle,
  Check,
  Smartphone,
  Info,
  Server,
  Database,
  ArrowUpRight
} from 'lucide-react';
import { UserProfile } from '../types';
import { MobileMoneyGateway } from '../services/mobilePaymentRouterService';
import { supabase } from '../supabase';
import { toast } from 'sonner';

interface ApiConfigAuditViewProps {
  schoolId: string;
  user: UserProfile;
  activeGateway: MobileMoneyGateway;
  isGatewaysEnabledForSchool: boolean;
  canManageAllCampuses: boolean;
  onSwitchActiveGateway: (gw: MobileMoneyGateway) => Promise<void>;
  onNavigateToTab: (tab: 'tranzak' | 'kobara' | 'moncash' | 'natcash') => void;
}

export interface GatewayAuditResult {
  gateway: 'tranzak' | 'kobara' | 'moncash';
  name: string;
  badge: string;
  mode: string;
  isSaaSAllowed: boolean;
  isSchoolActiveGateway: boolean;
  hasCredentials: boolean;
  hasWebhookSecret: boolean;
  connectionStatus: 'VALID' | 'INVALID' | 'UNTESTED' | 'CHECKING' | 'ERROR';
  pingLatencyMs?: number;
  message: string;
  issues: string[];
  recommendations: string[];
  webhookUrl: string;
  expectedHeaders: string;
}

export const ApiConfigAuditView: React.FC<ApiConfigAuditViewProps> = ({
  schoolId,
  user,
  activeGateway,
  isGatewaysEnabledForSchool,
  canManageAllCampuses,
  onSwitchActiveGateway,
  onNavigateToTab
}) => {
  const [auditing, setAuditing] = useState(false);
  const [lastAuditDate, setLastAuditDate] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [auditResults, setAuditResults] = useState<Record<string, GatewayAuditResult>>({});
  const [paymentMethodsCheck, setPaymentMethodsCheck] = useState<{
    moncashAtGuichet: boolean;
    natcashAtGuichet: boolean;
  }>({ moncashAtGuichet: false, natcashAtGuichet: false });

  const rawOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://edunova-pro.tech';
  const tranzakWebhookUrl = `${rawOrigin}/api/tranzak/webhook`;
  const kobaraWebhookUrl = `${rawOrigin}/api/webhooks/kobara`;
  const moncashWebhookUrl = `${rawOrigin}/api/moncash/webhook`;

  const copyToClipboard = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    toast.success('URL copiée dans le presse-papier !');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Exécution de l'audit complet des passerelles
  const runFullAudit = useCallback(async () => {
    if (!schoolId) return;
    setAuditing(true);

    try {
      // 1. Récupération des données du coffre-fort & modes de règlement de l'école
      const token = (await supabase.auth.getSession()).data?.session?.access_token;
      const [credRes, schoolRes] = await Promise.all([
        fetch(`/api/settings/api-credentials?school_id=${encodeURIComponent(schoolId)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }),
        supabase.from('schools').select('payment_methods').eq('id', schoolId).maybeSingle()
      ]);

      const credData = credRes.ok ? await credRes.json() : null;
      const schoolPaymentMethods = schoolRes.data?.payment_methods || [];

      // Vérifier si MonCash / NatCash sont activés au Guichet
      const hasMoncashGuichet = schoolPaymentMethods.some((pm: any) => {
        const id = (pm.id || pm.name || '').toLowerCase();
        return (id.includes('moncash') || id === 'moncash') && pm.is_active;
      });
      const hasNatcashGuichet = schoolPaymentMethods.some((pm: any) => {
        const id = (pm.id || pm.name || '').toLowerCase();
        return (id.includes('natcash') || id === 'natcash') && pm.is_active;
      });

      setPaymentMethodsCheck({
        moncashAtGuichet: hasMoncashGuichet,
        natcashAtGuichet: hasNatcashGuichet
      });

      const tzConfig = credData?.credentials?.tranzak || {};
      const kbConfig = credData?.credentials?.kobara || {};
      const mcConfig = credData?.credentials?.moncash || {};

      // 2. Tester en direct la connectivité Tranzak
      let tranzakAudit: GatewayAuditResult = {
        gateway: 'tranzak',
        name: 'Tranzak / SAGACETECH',
        badge: 'Direct (MonCash + NatCash)',
        mode: tzConfig.mode === 'test' ? 'Sandbox' : 'Production Live',
        isSaaSAllowed: isGatewaysEnabledForSchool,
        isSchoolActiveGateway: isGatewaysEnabledForSchool && activeGateway === 'tranzak',
        hasCredentials: Boolean(tzConfig.has_key || tzConfig.api_key),
        hasWebhookSecret: Boolean(tzConfig.has_webhook_secret || tzConfig.webhook_secret),
        connectionStatus: 'CHECKING',
        message: 'Validation en cours...',
        issues: [],
        recommendations: [],
        webhookUrl: tranzakWebhookUrl,
        expectedHeaders: 'X-Tranzak-Signature (HMAC-SHA256)'
      };

      try {
        const t0 = performance.now();
        const testRes = await fetch('/api/tranzak/test-connection', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            school_id: schoolId,
            api_key: tzConfig.api_key,
            mode: tzConfig.mode
          })
        });
        const latency = Math.round(performance.now() - t0);
        tranzakAudit.pingLatencyMs = latency;
        const testData = await testRes.json();

        if (testRes.ok && testData.success) {
          tranzakAudit.connectionStatus = 'VALID';
          tranzakAudit.message = testData.message || 'Authentification API Tranzak réussie.';
        } else {
          tranzakAudit.connectionStatus = 'INVALID';
          tranzakAudit.message = testData.error || 'Clé Tranzak refusée ou non configurée.';
        }
      } catch (e: any) {
        tranzakAudit.connectionStatus = 'ERROR';
        tranzakAudit.message = e.message || 'Échec de connexion réseau avec le serveur Tranzak.';
      }

      // Analyse des diagnostics Tranzak
      if (!isGatewaysEnabledForSchool) {
        tranzakAudit.issues.push("Passerelles API désactivées par le Super Admin SaaS (Gouvernance).");
        tranzakAudit.recommendations.push("Demandez au Super Administrateur de réactiver les passerelles pour votre établissement.");
      } else if (activeGateway !== 'tranzak') {
        tranzakAudit.issues.push(`Tranzak n'est pas la passerelle active (Active actuelle : ${activeGateway === 'none' ? 'Mode Manuel Exclusif' : activeGateway.toUpperCase()}).`);
        tranzakAudit.recommendations.push("Basculez sur Tranzak dans le sélecteur central pour que les encaissements mobiles s'y dirigent.");
      }

      if (!tranzakAudit.hasCredentials) {
        tranzakAudit.issues.push("Clé API Tranzak (tk_live_... ou tk_test_...) absente dans le coffre-fort.");
        tranzakAudit.recommendations.push("Renseignez votre clé API marchande dans l'onglet Tranzak.");
      }

      if (!tranzakAudit.hasWebhookSecret) {
        tranzakAudit.issues.push("Secret Webhook HMAC-SHA256 non renseigné.");
        tranzakAudit.recommendations.push("Ajoutez la clé secrète Webhook pour sécuriser la vérification cryptographique des notifications.");
      }

      if (!hasMoncashGuichet && !hasNatcashGuichet) {
        tranzakAudit.issues.push("Les canaux MonCash et NatCash sont tous deux inactifs au Guichet d'encaissement.");
        tranzakAudit.recommendations.push("Activez MonCash ou NatCash dans l'onglet 'Modes de Règlement' pour permettre aux caissiers d'encaisser.");
      }

      // 3. Tester en direct la connectivité Kobara
      let kobaraAudit: GatewayAuditResult = {
        gateway: 'kobara',
        name: 'Kobara Agrégateur',
        badge: 'Agrégateur National Haïti',
        mode: kbConfig.mode === 'test' ? 'Sandbox' : 'Production Live',
        isSaaSAllowed: isGatewaysEnabledForSchool,
        isSchoolActiveGateway: isGatewaysEnabledForSchool && activeGateway === 'kobara',
        hasCredentials: Boolean(kbConfig.has_secret || kbConfig.secret_key),
        hasWebhookSecret: Boolean(kbConfig.has_webhook_secret || kbConfig.webhook_secret),
        connectionStatus: 'CHECKING',
        message: 'Validation en cours...',
        issues: [],
        recommendations: [],
        webhookUrl: kobaraWebhookUrl,
        expectedHeaders: 'X-Kobara-Signature / Bearer Token'
      };

      try {
        const t0 = performance.now();
        const testRes = await fetch('/api/settings/api-credentials/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            school_id: schoolId,
            service_name: 'kobara',
            credentials: {
              secret_key: kbConfig.secret_key,
              mode: kbConfig.mode
            },
            environment: kbConfig.mode || 'live'
          })
        });
        const latency = Math.round(performance.now() - t0);
        kobaraAudit.pingLatencyMs = latency;
        const testData = await testRes.json();

        if (testRes.ok && testData.success) {
          kobaraAudit.connectionStatus = 'VALID';
          kobaraAudit.message = testData.message || 'Authentification API Kobara validée avec succès.';
        } else {
          kobaraAudit.connectionStatus = 'INVALID';
          kobaraAudit.message = testData.error || 'Clé secrète Kobara invalide ou absente.';
        }
      } catch (e: any) {
        kobaraAudit.connectionStatus = 'ERROR';
        kobaraAudit.message = e.message || 'Erreur réseau lors du test de connectivité Kobara.';
      }

      // Analyse des diagnostics Kobara
      if (!isGatewaysEnabledForSchool) {
        kobaraAudit.issues.push("Passerelles API désactivées au niveau SaaS.");
      } else if (activeGateway !== 'kobara') {
        kobaraAudit.issues.push(`Kobara n'est pas la passerelle active (Active actuelle : ${activeGateway === 'none' ? 'Mode Manuel' : activeGateway.toUpperCase()}).`);
      }

      if (!kobaraAudit.hasCredentials) {
        kobaraAudit.issues.push("Clé secrète Kobara (kbr_sk_...) non configurée.");
        kobaraAudit.recommendations.push("Enregistrez votre clé secrète Kobara dans l'onglet Kobara.");
      }

      const receiverPhone = kbConfig.receiver_phone || '';
      if (!receiverPhone || receiverPhone.length < 8) {
        kobaraAudit.issues.push("Numéro de téléphone récepteur pour le reversement automatique non défini.");
        kobaraAudit.recommendations.push("Renseignez le numéro récepteur MonCash/NatCash dans l'onglet Kobara.");
      }

      // 4. Synthèse des résultats
      setAuditResults({
        tranzak: tranzakAudit,
        kobara: kobaraAudit
      });

      setLastAuditDate(new Date().toLocaleTimeString('fr-FR'));
      toast.success("Audit de connectivité des passerelles terminé avec succès !");
    } catch (err: any) {
      console.error("Erreur lors de l'audit API:", err);
      toast.error("Erreur lors de l'exécution de l'audit");
    } finally {
      setAuditing(false);
    }
  }, [schoolId, activeGateway, isGatewaysEnabledForSchool, tranzakWebhookUrl, kobaraWebhookUrl]);

  useEffect(() => {
    runFullAudit();
  }, [schoolId, runFullAudit]);

  const tranzak = auditResults.tranzak;
  const kobara = auditResults.kobara;

  // Calcul du score global de santé API
  let totalIssuesCount = (tranzak?.issues?.length || 0) + (kobara?.issues?.length || 0);
  const activeGatewayAudit = activeGateway === 'tranzak' ? tranzak : activeGateway === 'kobara' ? kobara : null;
  const isHealthyActive = activeGatewayAudit ? activeGatewayAudit.connectionStatus === 'VALID' && activeGatewayAudit.issues.length === 0 : isGatewaysEnabledForSchool;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* 1. EN-TÊTE DE L'AUDIT & ACTIONS RAPIDES */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-xl p-3 sm:p-4 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-inner">
            <Activity size={20} className={auditing ? "animate-spin text-indigo-400" : "text-indigo-300"} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm sm:text-base font-black tracking-tight text-white">
                Audit de Configuration API &amp; Connectivité Passerelles
              </h4>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border ${
                isHealthyActive
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}>
                {isHealthyActive ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
                <span>{isHealthyActive ? 'Système Opérationnel' : `${totalIssuesCount} Point(s) d'Attention`}</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              Vérification automatique de la validité des credentials, webhooks et flux de paiement pour identifier pourquoi les encaissements ne s'actualisent pas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center shrink-0">
          {lastAuditDate && (
            <span className="text-[10px] text-slate-400 hidden sm:inline">
              Dernier audit : <strong className="text-slate-200 font-mono">{lastAuditDate}</strong>
            </span>
          )}
          <button
            type="button"
            onClick={runFullAudit}
            disabled={auditing}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <RefreshCw size={13} className={auditing ? "animate-spin" : ""} />
            <span>{auditing ? 'Audit en cours...' : 'Relancer l’audit global'}</span>
          </button>
        </div>
      </div>

      {/* 2. DIAGNOSTIC RAPIDE : POURQUOI MES ENCAISSEMENTS NE S'ACTUALISENT PAS ? */}
      {totalIssuesCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4 text-amber-950 space-y-2.5">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-amber-600 shrink-0" />
            <h5 className="font-bold text-xs sm:text-sm text-amber-900">
              Pourquoi les encaissements ou dépôts ne s'actualisent pas automatiquement ?
            </h5>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            Le moteur de diagnostic a identifié les points de blocage ci-dessous. Dès qu'un point est résolu, les notifications de paiement seront instantanément répercutées sur les comptes élèves.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
            {tranzak?.issues?.map((issue, idx) => (
              <div key={`tz-iss-${idx}`} className="flex items-start gap-2 bg-white/80 p-2.5 rounded-lg border border-amber-200 text-xs">
                <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 shrink-0">Tranzak</span>
                <span className="text-slate-700">{issue}</span>
              </div>
            ))}
            {kobara?.issues?.map((issue, idx) => (
              <div key={`kb-iss-${idx}`} className="flex items-start gap-2 bg-white/80 p-2.5 rounded-lg border border-amber-200 text-xs">
                <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 shrink-0">Kobara</span>
                <span className="text-slate-700">{issue}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. TABLEAU DE BORD COMPARATIF DES PASSERELLES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {/* CARTE TRANZAK */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 space-y-3.5 shadow-2xs flex flex-col justify-between">
          <div className="space-y-3">
            {/* Titre & Statuts */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center font-black">
                  <Layers size={16} />
                </div>
                <div>
                  <h5 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <span>Tranzak / SAGACETECH</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 font-black">DIRECT</span>
                  </h5>
                  <span className="text-[11px] text-slate-500">MonCash + NatCash avec une seule clé marchande</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {tranzak?.isSchoolActiveGateway ? (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                    <span>Active en Caisse</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                    En Veille
                  </span>
                )}
              </div>
            </div>

            {/* Grille de conformité technique */}
            <div className="space-y-2 text-xs">
              {/* Statut Authentification API */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-600 font-medium">Authentification Clé API</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  tranzak?.connectionStatus === 'VALID'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : tranzak?.connectionStatus === 'CHECKING'
                    ? 'bg-slate-100 text-slate-600'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {tranzak?.connectionStatus === 'VALID' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                  <span>{tranzak?.connectionStatus === 'VALID' ? 'Validée (HTTP 200)' : tranzak?.connectionStatus === 'CHECKING' ? 'Vérification...' : 'Invalide / Rejetée'}</span>
                </span>
              </div>

              {/* Secret Webhook HMAC */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-600 font-medium">Signature HMAC-SHA256</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  tranzak?.hasWebhookSecret
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {tranzak?.hasWebhookSecret ? <Check size={11} /> : <AlertTriangle size={11} />}
                  <span>{tranzak?.hasWebhookSecret ? 'Secret Configuré' : 'Secret Non Renseigné'}</span>
                </span>
              </div>

              {/* Mode Environnement */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-600 font-medium">Environnement</span>
                <span className="font-mono font-bold text-slate-800 text-[11px]">
                  {tranzak?.mode || 'Production Live'}
                </span>
              </div>

              {/* URL Webhook à enregistrer */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Callback URL Webhook (Tranzak Developer Portal) :
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(tranzakWebhookUrl, 'tz_wh')}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'tz_wh' ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                    <span>{copiedKey === 'tz_wh' ? 'Copié' : 'Copier'}</span>
                  </button>
                </div>
                <div className="font-mono text-[10.5px] text-slate-700 bg-white p-1.5 rounded border border-slate-200 truncate select-all">
                  {tranzakWebhookUrl}
                </div>
              </div>
            </div>

            {/* Message de test serveur */}
            <div className={`p-2.5 rounded-lg text-xs border ${
              tranzak?.connectionStatus === 'VALID'
                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                : 'bg-red-50/60 border-red-200 text-red-900'
            }`}>
              <strong className="font-bold block mb-0.5">Diagnostic API :</strong>
              <span>{tranzak?.message || 'En attente du test...'}</span>
              {tranzak?.pingLatencyMs !== undefined && (
                <span className="text-[10.5px] text-slate-500 block mt-0.5">
                  Temps de réponse serveur : {tranzak.pingLatencyMs} ms
                </span>
              )}
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap">
            <button
              type="button"
              onClick={() => onNavigateToTab('tranzak')}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>Paramètres Tranzak</span>
              <ArrowRight size={11} />
            </button>

            {canManageAllCampuses && isGatewaysEnabledForSchool && !tranzak?.isSchoolActiveGateway && (
              <button
                type="button"
                onClick={() => onSwitchActiveGateway('tranzak')}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs ml-auto"
              >
                <span>Activer Tranzak</span>
                <Check size={12} />
              </button>
            )}
          </div>
        </div>

        {/* CARTE KOBARA */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 space-y-3.5 shadow-2xs flex flex-col justify-between">
          <div className="space-y-3">
            {/* Titre & Statuts */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-700 border border-orange-200 flex items-center justify-center font-black">
                  <CreditCard size={16} />
                </div>
                <div>
                  <h5 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <span>Kobara Agrégateur</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-orange-50 text-orange-700 border border-orange-200 font-black">NATIONAL</span>
                  </h5>
                  <span className="text-[11px] text-slate-500">Reversement automatique par numéro de téléphone</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {kobara?.isSchoolActiveGateway ? (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                    <span>Active en Caisse</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                    En Veille
                  </span>
                )}
              </div>
            </div>

            {/* Grille de conformité technique */}
            <div className="space-y-2 text-xs">
              {/* Statut Authentification API */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-600 font-medium">Authentification Clé Secrète</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  kobara?.connectionStatus === 'VALID'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : kobara?.connectionStatus === 'CHECKING'
                    ? 'bg-slate-100 text-slate-600'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {kobara?.connectionStatus === 'VALID' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                  <span>{kobara?.connectionStatus === 'VALID' ? 'Validée (HTTP 200)' : kobara?.connectionStatus === 'CHECKING' ? 'Vérification...' : 'Invalide / Rejetée'}</span>
                </span>
              </div>

              {/* Secret Webhook */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-600 font-medium">Secret Webhook</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  kobara?.hasWebhookSecret
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {kobara?.hasWebhookSecret ? <Check size={11} /> : <AlertTriangle size={11} />}
                  <span>{kobara?.hasWebhookSecret ? 'Secret Configuré' : 'Non Renseigné'}</span>
                </span>
              </div>

              {/* Mode Environnement */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-600 font-medium">Environnement</span>
                <span className="font-mono font-bold text-slate-800 text-[11px]">
                  {kobara?.mode || 'Production Live'}
                </span>
              </div>

              {/* URL Webhook à enregistrer */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Callback URL Webhook (Portail Kobara) :
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(kobaraWebhookUrl, 'kb_wh')}
                    className="text-[10px] font-bold text-orange-600 hover:text-orange-800 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'kb_wh' ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                    <span>{copiedKey === 'kb_wh' ? 'Copié' : 'Copier'}</span>
                  </button>
                </div>
                <div className="font-mono text-[10.5px] text-slate-700 bg-white p-1.5 rounded border border-slate-200 truncate select-all">
                  {kobaraWebhookUrl}
                </div>
              </div>
            </div>

            {/* Message de test serveur */}
            <div className={`p-2.5 rounded-lg text-xs border ${
              kobara?.connectionStatus === 'VALID'
                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                : 'bg-red-50/60 border-red-200 text-red-900'
            }`}>
              <strong className="font-bold block mb-0.5">Diagnostic API :</strong>
              <span>{kobara?.message || 'En attente du test...'}</span>
              {kobara?.pingLatencyMs !== undefined && (
                <span className="text-[10.5px] text-slate-500 block mt-0.5">
                  Temps de réponse serveur : {kobara.pingLatencyMs} ms
                </span>
              )}
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap">
            <button
              type="button"
              onClick={() => onNavigateToTab('kobara')}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>Paramètres Kobara</span>
              <ArrowRight size={11} />
            </button>

            {canManageAllCampuses && isGatewaysEnabledForSchool && !kobara?.isSchoolActiveGateway && (
              <button
                type="button"
                onClick={() => onSwitchActiveGateway('kobara')}
                className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs ml-auto"
              >
                <span>Activer Kobara</span>
                <Check size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. VÉRIFICATION DU GUICHET D'ENCAISSEMENT & DES MODES DE RÈGLEMENT */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 space-y-2.5 shadow-2xs">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Smartphone size={16} className="text-slate-700" />
            <h5 className="font-bold text-xs sm:text-sm text-slate-900">
              État de Visibilité au Guichet d'Encaissement (Modes de Règlement)
            </h5>
          </div>
          <span className="text-[11px] text-slate-500">
            Synchronisation Paramètres &harr; Guichet
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className={`p-2.5 rounded-lg border flex items-center justify-between ${
            paymentMethodsCheck.moncashAtGuichet
              ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
              : 'bg-amber-50/60 border-amber-200 text-amber-950'
          }`}>
            <div>
              <span className="font-bold block">Canal MonCash au Guichet</span>
              <span className="text-[11px] text-slate-600">
                {paymentMethodsCheck.moncashAtGuichet 
                  ? 'Visible et sélectionnable lors de la saisie d’un paiement' 
                  : 'Désactivé dans "Modes de Règlement" (Inapplicable au guichet)'}
              </span>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              paymentMethodsCheck.moncashAtGuichet ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
            }`}>
              {paymentMethodsCheck.moncashAtGuichet ? 'Actif' : 'Inactif'}
            </span>
          </div>

          <div className={`p-2.5 rounded-lg border flex items-center justify-between ${
            paymentMethodsCheck.natcashAtGuichet
              ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
              : 'bg-amber-50/60 border-amber-200 text-amber-950'
          }`}>
            <div>
              <span className="font-bold block">Canal NatCash au Guichet</span>
              <span className="text-[11px] text-slate-600">
                {paymentMethodsCheck.natcashAtGuichet 
                  ? 'Visible et sélectionnable lors de la saisie d’un paiement' 
                  : 'Désactivé dans "Modes de Règlement" (Inapplicable au guichet)'}
              </span>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              paymentMethodsCheck.natcashAtGuichet ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
            }`}>
              {paymentMethodsCheck.natcashAtGuichet ? 'Actif' : 'Inactif'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
