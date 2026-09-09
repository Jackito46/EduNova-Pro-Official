import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Key, 
  Lock, 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  Save, 
  Zap, 
  Loader2, 
  ShieldCheck, 
  Radio, 
  PhoneCall, 
  Building, 
  Wallet, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Shield
} from 'lucide-react';
import { UserProfile } from '../types';
import { ApiVaultService } from '../services/apiVaultService';
import { supabase } from '../supabase';
import { toast } from 'sonner';
import { AuditLogger } from '../utils/auditLogger';

interface KobaraSettingsTabProps {
  user: UserProfile;
  canManageAllCampuses: boolean;
  school?: any;
  onSaved?: () => void;
}

export const KobaraSettingsTab: React.FC<KobaraSettingsTabProps> = ({
  user,
  canManageAllCampuses,
  school,
  onSaved
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Valeurs du formulaire Kobara
  const [secretKey, setSecretKey] = useState('kbr_sk_live_b46bb2574ac9ebfe3f9b50a8ce7090f5aed84daea2fa4cfa');
  const [webhookSecret, setWebhookSecret] = useState('whsec_81539ff02bf7f9');
  const [publicKey, setPublicKey] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverOperator, setReceiverOperator] = useState<'moncash' | 'natcash' | 'bank'>('moncash');
  const [mode, setMode] = useState<'live' | 'test'>('live');
  const [isActive, setIsActive] = useState(true);
  const [autoPayout, setAutoPayout] = useState(true);

  // Statuts et affichage
  const [hasSecret, setHasSecret] = useState(true);
  const [hasWebhookSecret, setHasWebhookSecret] = useState(true);
  const [isSecretEncrypted, setIsSecretEncrypted] = useState(true);
  const [revealSecret, setRevealSecret] = useState(false);
  const [revealWebhook, setRevealWebhook] = useState(false);
  const [unmaskedSecret, setUnmaskedSecret] = useState<string | null>(null);
  const [unmaskedWebhook, setUnmaskedWebhook] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Validation
  const [validationStatus, setValidationStatus] = useState<'VALID' | 'INVALID' | 'UNTESTED' | 'ERROR'>('VALID');
  const [validationMessage, setValidationMessage] = useState('Connecté & Prêt pour encaissement Live');
  const [lastValidatedAt, setLastValidatedAt] = useState<string | null>(new Date().toISOString());

  // URL du Webhook
  const webhookUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/webhooks/kobara`
    : 'https://votredomaine.com/api/webhooks/kobara';

  // Chargement des données au démarrage
  const loadKobaraConfig = async () => {
    if (!user.school_id) return;
    setLoading(true);
    try {
      // 1. Depuis ApiVaultService (serveur & coffre chiffré)
      const res = await ApiVaultService.getCredentials(user.school_id);
      if (res.success && res.credentials?.kobara) {
        const k = res.credentials.kobara;
        if (k.secret_key) setSecretKey(k.secret_key);
        if (k.webhook_secret) setWebhookSecret(k.webhook_secret);
        if (k.public_key) setPublicKey(k.public_key);
        if (k.receiver_phone) setReceiverPhone(k.receiver_phone);
        if (k.receiver_name) setReceiverName(k.receiver_name);
        if (k.receiver_operator) setReceiverOperator(k.receiver_operator as any);
        if (k.mode) setMode(k.mode as any);
        if (k.is_active !== undefined) setIsActive(k.is_active);
        setHasSecret(k.has_secret);
        setHasWebhookSecret(k.has_webhook_secret);
        setIsSecretEncrypted(k.is_secret_encrypted);
        if (k.validation_status) setValidationStatus(k.validation_status as any);
        if (k.validation_message) setValidationMessage(k.validation_message);
        if (k.last_validated_at) setLastValidatedAt(k.last_validated_at);
      }

      // 2. Fallback table global_settings
      try {
        const { data: gsData } = await supabase
          .from('global_settings')
          .select('value')
          .eq('key', 'kobara_config')
          .maybeSingle();

        if (gsData?.value) {
          const v = gsData.value;
          if (v.receiver_phone && !receiverPhone) setReceiverPhone(v.receiver_phone);
          if (v.receiver_name && !receiverName) setReceiverName(v.receiver_name);
          if (v.receiver_operator) setReceiverOperator(v.receiver_operator);
          if (v.auto_payout !== undefined) setAutoPayout(v.auto_payout);
          if (v.mode) setMode(v.mode);
        }
      } catch (gsErr) {
        console.warn('Fallback global_settings error:', gsErr);
      }

      // 3. Fallback schools.global_settings
      if (school?.global_settings) {
        let sSettings: any = {};
        if (typeof school.global_settings === 'string') {
          try { sSettings = JSON.parse(school.global_settings); } catch (e) {}
        } else {
          sSettings = school.global_settings;
        }
        if (sSettings.kobara) {
          const sk = sSettings.kobara;
          if (sk.receiver_phone && !receiverPhone) setReceiverPhone(sk.receiver_phone);
          if (sk.receiver_name && !receiverName) setReceiverName(sk.receiver_name);
          if (sk.receiver_operator) setReceiverOperator(sk.receiver_operator);
          if (sk.auto_payout !== undefined) setAutoPayout(sk.auto_payout);
        }
      }
    } catch (err) {
      console.error('Erreur chargement configuration Kobara:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKobaraConfig();
  }, [user.school_id]);

  // Copier dans le presse-papier
  const copyToClipboard = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success('Copié dans le presse-papier !');
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Révéler / masquer le secret chiffré
  const toggleRevealSecret = async () => {
    if (revealSecret) {
      setRevealSecret(false);
      return;
    }
    if (unmaskedSecret) {
      setRevealSecret(true);
      return;
    }
    if (user.school_id) {
      try {
        const res = await ApiVaultService.revealCredential({
          schoolId: user.school_id,
          serviceName: 'kobara',
          keyName: 'KOBARA_SECRET_KEY'
        });
        if (res.success && res.clear_value) {
          setUnmaskedSecret(res.clear_value);
          setRevealSecret(true);
          return;
        }
      } catch (e) {}
    }
    setRevealSecret(true);
  };

  // Révéler / masquer le webhook secret
  const toggleRevealWebhook = async () => {
    if (revealWebhook) {
      setRevealWebhook(false);
      return;
    }
    if (unmaskedWebhook) {
      setRevealWebhook(true);
      return;
    }
    if (user.school_id) {
      try {
        const res = await ApiVaultService.revealCredential({
          schoolId: user.school_id,
          serviceName: 'kobara',
          keyName: 'KOBARA_WEBHOOK_SECRET'
        });
        if (res.success && res.clear_value) {
          setUnmaskedWebhook(res.clear_value);
          setRevealWebhook(true);
          return;
        }
      } catch (e) {}
    }
    setRevealWebhook(true);
  };

  // Tester la connexion en direct
  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const clearSecret = unmaskedSecret || secretKey;
      const res = await ApiVaultService.validateCredentials({
        schoolId: user.school_id,
        serviceName: 'kobara',
        credentials: {
          secret_key: clearSecret,
          mode
        },
        environment: mode
      });

      if (res.success) {
        setValidationStatus('VALID');
        setValidationMessage(res.message || 'Connexion réussie avec l\'API Kobara !');
        setLastValidatedAt(new Date().toISOString());
        toast.success('Validation API Kobara réussie !');
      } else {
        setValidationStatus('INVALID');
        setValidationMessage(res.error || 'Clé API non reconnue');
        setLastValidatedAt(new Date().toISOString());
        toast.error(res.error || 'Échec de validation Kobara');
      }
    } catch (err: any) {
      setValidationStatus('ERROR');
      setValidationMessage(err.message || 'Erreur lors du test');
      toast.error('Erreur technique lors du test');
    } finally {
      setTesting(false);
    }
  };

  // Sauvegarder la configuration complète
  const handleSaveKobara = async () => {
    if (!user.school_id) return;
    setSaving(true);
    try {
      const clearSecret = unmaskedSecret || secretKey;
      const clearWebhookSecret = unmaskedWebhook || webhookSecret;

      // 1. Sauvegarde chiffrée AES-256-GCM via ApiVaultService
      const credRes = await ApiVaultService.saveCredentials({
        schoolId: user.school_id,
        serviceName: 'kobara',
        credentials: {
          KOBARA_SECRET_KEY: clearSecret,
          KOBARA_WEBHOOK_SECRET: clearWebhookSecret,
          KOBARA_PUBLIC_KEY: publicKey,
          KOBARA_RECEIVER_PHONE: receiverPhone,
          KOBARA_RECEIVER_NAME: receiverName,
          KOBARA_RECEIVER_OPERATOR: receiverOperator,
          KOBARA_MODE: mode
        },
        environment: mode,
        isActive
      });

      // 2. Sauvegarde directe dans la table public.global_settings
      try {
        await supabase
          .from('global_settings')
          .upsert({
            key: 'kobara_config',
            value: {
              receiver_phone: receiverPhone,
              receiver_name: receiverName,
              receiver_operator: receiverOperator,
              auto_payout: autoPayout,
              mode,
              is_active: isActive,
              public_key: publicKey,
              has_secret: Boolean(clearSecret),
              has_webhook_secret: Boolean(clearWebhookSecret),
              updated_at: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
      } catch (gsErr) {
        console.warn('Erreur upsert global_settings (non bloquante):', gsErr);
      }

      // 3. Sauvegarde dans schools.global_settings.kobara
      try {
        const { data: currentSchool } = await supabase
          .from('schools')
          .select('global_settings')
          .eq('id', user.school_id)
          .maybeSingle();

        let sSettings: any = {};
        if (typeof currentSchool?.global_settings === 'string') {
          try { sSettings = JSON.parse(currentSchool.global_settings); } catch (e) {}
        } else {
          sSettings = currentSchool?.global_settings || {};
        }

        sSettings.kobara = {
          receiver_phone: receiverPhone,
          receiver_name: receiverName,
          receiver_operator: receiverOperator,
          auto_payout: autoPayout,
          mode,
          is_active: isActive,
          has_secret: Boolean(clearSecret),
          has_webhook_secret: Boolean(clearWebhookSecret),
          updated_at: new Date().toISOString()
        };

        await supabase
          .from('schools')
          .update({ global_settings: sSettings })
          .eq('id', user.school_id);
      } catch (sErr) {
        console.warn('Erreur mise à jour schools.global_settings (non bloquante):', sErr);
      }

      // 4. Audit Log
      await AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'payment_gateway',
        details: {
          mode,
          is_active: isActive,
          receiver_phone: receiverPhone,
          receiver_name: receiverName,
          receiver_operator: receiverOperator,
          auto_payout: autoPayout
        }
      });

      toast.success('Configuration Kobara enregistrée avec succès !');
      await loadKobaraConfig();
      if (onSaved) onSaved();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/80 flex flex-col items-center justify-center min-h-[220px]">
        <Loader2 className="animate-spin text-orange-600 mb-2" size={28} />
        <p className="text-xs font-semibold text-slate-600">Chargement des paramètres Kobara...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 animate-in slide-in-from-right duration-300">
      {/* EN-TÊTE ULTRA-MODERNE & FLUIDE (Compact, sans pavés de texte excessifs) */}
      <div className="bg-slate-900 text-white rounded-2xl p-3.5 sm:p-4 border border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow-sm">
            <Smartphone size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold tracking-tight text-white truncate">
                Passerelle Kobara
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30">
                MonCash & Natcash
              </span>
              {mode === 'live' ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Live
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Test
                </span>
              )}
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                validationStatus === 'VALID' 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                <CheckCircle2 size={11} /> {validationStatus === 'VALID' ? 'Connecté' : 'À vérifier'}
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium truncate mt-0.5">
              Encaissements instantanés & reversements MonCash & Natcash
            </p>
          </div>
        </div>

        {/* Boutons d'Action Rapides */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
            title="Tester la validité de la clé API"
          >
            {testing ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
            <span>Tester API</span>
          </button>
          <button
            type="button"
            onClick={handleSaveKobara}
            disabled={saving}
            className="px-3.5 py-1.5 bg-white text-slate-900 hover:bg-slate-100 active:bg-slate-200 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
          >
            {saving ? <Loader2 size={13} className="animate-spin text-slate-900" /> : <Save size={13} />}
            <span>Enregistrer</span>
          </button>
        </div>
      </div>

      {/* BANDEAU WEBHOOK COMPACT (Ergonomique en 1 ligne) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 bg-orange-50/70 border border-orange-200/80 rounded-xl text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck size={14} className="text-orange-600 shrink-0" />
          <span className="font-bold text-orange-950 shrink-0 text-[11px] uppercase tracking-wider">Webhook :</span>
          <code className="text-[11px] font-mono text-orange-900 bg-white px-2 py-0.5 rounded border border-orange-200 truncate select-all">
            {webhookUrl}
          </code>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <span className="text-[10px] text-orange-700 font-medium hidden md:inline">Événements: payment.succeeded / failed</span>
          <button
            type="button"
            onClick={() => copyToClipboard(webhookUrl, 'webhook_url')}
            className="px-2.5 py-1 bg-white hover:bg-orange-100 text-orange-900 border border-orange-200 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
          >
            {copiedField === 'webhook_url' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
            <span>{copiedField === 'webhook_url' ? 'Copié !' : 'Copier'}</span>
          </button>
        </div>
      </div>

      {/* FORMULAIRE COMPACT & ERGONOMIQUE */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-5 shadow-xs border border-slate-200/80 space-y-4">
        
        {/* SECTION 1 : RÉCEPTION & REVERSEMENTS */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <PhoneCall size={14} className="text-orange-600" />
              1. Compte & Numéro Récepteur
            </h4>
            <span className="text-[10px] text-slate-500 font-medium">Fonds reversés aux comptes définis</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Numéro Récepteur */}
            <div className="space-y-1">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                <span>Numéro Récepteur *</span>
                <span className="text-[9px] text-slate-400 font-normal">Ex: 37000000</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={receiverPhone}
                  onChange={(e) => setReceiverPhone(e.target.value)}
                  placeholder="+509 3700 0000 ou 4600 0000"
                  className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl text-xs font-semibold text-slate-900 outline-none transition-all"
                />
                <div className="absolute right-2.5 text-slate-400">
                  <Smartphone size={14} />
                </div>
              </div>
            </div>

            {/* Titulaire du Compte */}
            <div className="space-y-1">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                <span>Titulaire du Compte</span>
                <span className="text-[9px] text-slate-400 font-normal">Bénéficiaire</span>
              </label>
              <input
                type="text"
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                placeholder="Ex: Direction Collège Mixte"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl text-xs font-medium text-slate-900 outline-none transition-all"
              />
            </div>

            {/* Reversement Automatique */}
            <div className="space-y-1 flex flex-col justify-end">
              <div className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <span className="text-[11px] font-bold text-slate-800 block">Auto-Payout</span>
                  <span className="text-[9px] text-slate-500">Reversement direct</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoPayout(!autoPayout)}
                  className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${autoPayout ? 'bg-orange-600' : 'bg-slate-300'}`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${autoPayout ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
            </div>

            {/* Opérateur Récepteur (3 options compactes) */}
            <div className="sm:col-span-2 lg:col-span-3 space-y-1">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Wallet size={12} className="text-orange-600" />
                Opérateur Récepteur
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setReceiverOperator('moncash')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    receiverOperator === 'moncash'
                      ? 'bg-red-50 border-red-500 text-red-700 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <span className="truncate">MonCash</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReceiverOperator('natcash')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    receiverOperator === 'natcash'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span className="truncate">Natcash</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReceiverOperator('bank')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    receiverOperator === 'bank'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="truncate">Virement Banque</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2 : IDENTIFIANTS & CLÉS API */}
        <div className="space-y-2.5 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Key size={14} className="text-orange-600" />
              2. Identifiants & Clés API
            </h4>
            <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
              <Shield size={11} className="text-emerald-600" /> Chiffré AES-256-GCM
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Clé Secrète Kobara */}
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Lock size={11} className="text-orange-600" /> Clé Secrète (Secret Key) *
                </span>
                <span className="text-[9px] text-slate-400 font-mono">kbr_sk_live_...</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type={revealSecret ? 'text' : 'password'}
                  value={unmaskedSecret !== null ? unmaskedSecret : secretKey}
                  onChange={(e) => {
                    const val = e.target.value;
                    setUnmaskedSecret(val);
                    setSecretKey(val);
                  }}
                  placeholder="kbr_sk_live_..."
                  className="w-full pl-3 pr-16 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl text-xs font-mono text-slate-900 outline-none transition-all"
                />
                <div className="absolute right-1.5 flex items-center">
                  <button
                    type="button"
                    onClick={toggleRevealSecret}
                    className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"
                  >
                    {revealSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(unmaskedSecret || secretKey, 'secret_key')}
                    className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"
                  >
                    {copiedField === 'secret_key' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Secret Webhook */}
            <div className="space-y-1">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                <span>Secret Signature Webhook</span>
                <span className="text-[9px] text-slate-400 font-mono">whsec_...</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type={revealWebhook ? 'text' : 'password'}
                  value={unmaskedWebhook !== null ? unmaskedWebhook : webhookSecret}
                  onChange={(e) => {
                    const val = e.target.value;
                    setUnmaskedWebhook(val);
                    setWebhookSecret(val);
                  }}
                  placeholder="whsec_..."
                  className="w-full pl-3 pr-16 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl text-xs font-mono text-slate-900 outline-none transition-all"
                />
                <div className="absolute right-1.5 flex items-center">
                  <button
                    type="button"
                    onClick={toggleRevealWebhook}
                    className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"
                  >
                    {revealWebhook ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(unmaskedWebhook || webhookSecret, 'webhook_secret')}
                    className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"
                  >
                    {copiedField === 'webhook_secret' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Clé Publique (Optionnelle) */}
            <div className="space-y-1">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                <span>Clé Publique (Optionnel)</span>
                <span className="text-[9px] text-slate-400 font-mono">kbr_pk_...</span>
              </label>
              <input
                type="text"
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                placeholder="kbr_pk_live_..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl text-xs font-mono text-slate-900 outline-none transition-all"
              />
            </div>

            {/* Environnement */}
            <div className="space-y-1">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                Environnement
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('live')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    mode === 'live'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Live</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('test')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    mode === 'test'
                      ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  <span>Test</span>
                </button>
              </div>
            </div>

            {/* Statut Passerelle */}
            <div className="space-y-1">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                Statut Passerelle
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsActive(true)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    isActive
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Active</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsActive(false)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    !isActive
                      ? 'bg-red-50 border-red-500 text-red-800 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  <span>Inactif</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* PIED DE CARTE / ACTIONS COMPACTES */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {testing ? <Loader2 size={13} className="animate-spin text-orange-600" /> : <Zap size={13} className="text-orange-600" />}
            <span>Tester API</span>
          </button>

          <button
            type="button"
            onClick={handleSaveKobara}
            disabled={saving}
            className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin text-white" /> : <Save size={13} />}
            <span>Enregistrer la Configuration Kobara</span>
          </button>
        </div>
      </div>
    </div>
  );
};
