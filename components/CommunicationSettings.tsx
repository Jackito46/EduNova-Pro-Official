import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  Mail, 
  MessageSquare, 
  Shield, 
  Loader2, 
  CheckCircle2, 
  Key, 
  Server, 
  Send, 
  HelpCircle, 
  ExternalLink, 
  Copy, 
  Sparkles,
  Smartphone,
  Globe2,
  Lock
} from 'lucide-react';
import { UserProfile } from '../types';
import { supabase } from '../supabase';
import { toast } from 'sonner';

interface CommunicationSettingsProps {
  user: UserProfile;
}

const CommunicationSettings: React.FC<CommunicationSettingsProps> = ({ user }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    email_from_name: '',
    email_from_address: '',
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_pass: '',
    sms_provider: 'none',
    sms_api_key: '',
    whatsapp_provider: 'wa_me',
    whatsapp_api_key: '',
    whatsapp_phone_number_id: ''
  });

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const { data } = await supabase
          .from('communication_settings')
          .select('*')
          .eq('school_id', user.school_id)
          .single();
        
        if (data) {
          const apiKey = data.sms_api_key || '';
          setSettings({
            email_from_name: data.email_from_name || '',
            email_from_address: data.email_from_address || '',
            smtp_host: data.smtp_host || '',
            smtp_port: data.smtp_port || 587,
            smtp_user: data.smtp_user || '',
            smtp_pass: data.smtp_pass || '',
            sms_provider: data.sms_provider || 'none',
            sms_api_key: apiKey,
            whatsapp_provider: data.whatsapp_provider || 'wa_me',
            whatsapp_api_key: data.whatsapp_api_key || '',
            whatsapp_phone_number_id: data.whatsapp_phone_number_id || ''
          });
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, [user.school_id]);

  const [isTesting, setIsTesting] = useState(false);

  const handleTestSmtp = async () => {
    if (!settings.smtp_host || !settings.smtp_pass || !settings.email_from_address) {
      toast.error("Veuillez renseigner le serveur hôte, le mot de passe et l'email d'expédition.");
      return;
    }

    setIsTesting(true);
    try {
      const response = await fetch('/api/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      }).catch(err => {
        if (err.message === 'Failed to fetch') {
          throw new Error("Erreur réseau: Impossible de contacter la passerelle d'envoi. Vérifiez votre connexion.");
        }
        throw err;
      });

      const result = await response.json().catch(() => ({ error: 'Réponse serveur invalide' }));
      if (response.ok) {
        toast.success("Connexion SMTP établie avec succès ! Un email test a été expédié à " + settings.email_from_address);
      } else {
        throw new Error(result.error || `Échec de vérification SMTP (${response.status})`);
      }
    } catch (err: any) {
      console.error("SMTP Test Error:", err);
      const errorMsg = err.message || "Échec du test SMTP";
      
      if ((errorMsg.includes('535') || errorMsg.includes('534')) && (errorMsg.toLowerCase().includes('google') || errorMsg.toLowerCase().includes('gsmtp'))) {
        toast.error("Authentification Gmail refusée (Erreur 535)", {
          description: "Google requiert un 'Mot de passe d'application' à 16 lettres (avec validation en 2 étapes activée).",
          duration: 12000,
        });
      } else {
        toast.error("Erreur passerelle SMTP : " + errorMsg);
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    toast.success("Copié dans le presse-papier !");
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('communication_settings')
        .upsert({
          school_id: user.school_id,
          ...settings,
          sms_api_key: settings.sms_api_key,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      toast.success("Paramètres de communication enregistrés avec succès !");
    } catch (err: any) {
      console.error("Error saving settings:", err);
      toast.error("Erreur lors de l'enregistrement : " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <Loader2 size={36} className="animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium text-sm">Chargement des paramètres de communication...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-400">
      
      {/* CARD PRINCIPALE DE CONFIGURATION */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Header Institutionnel */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-7 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-white/10 rounded-2xl border border-white/10 text-blue-400 shadow-inner">
              <Settings size={22} className="stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black tracking-tight">Paramètres de Passerelle & Communication</h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-black uppercase tracking-wider">
                  Standard SMTP & API
                </span>
              </div>
              <p className="text-slate-300 text-xs mt-0.5">Configuration des protocoles d'envoi pour la messagerie académique, les notifications et le routage</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-400/20 text-emerald-300 text-xs font-bold">
              <Globe2 size={13} /> Chiffrement TLS / SSL
            </span>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-6 sm:p-8 space-y-10">
          
          {/* SECTION 1: SERVEUR SMTP */}
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100 shadow-2xs">
                  <Mail size={20} className="stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Serveur de Messagerie Sortante (SMTP)</h3>
                  <p className="text-xs text-slate-500">Routage certifié des reçus, convocations et bulletins scolaires par email</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSettings(prev => ({
                    ...prev,
                    smtp_host: 'smtp.gmail.com',
                    smtp_port: 587
                  }));
                  toast.success("Pré-remplissage Gmail appliqué !");
                }}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/70 border border-blue-200/80 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                <Sparkles size={13} /> Préconfigurer Gmail
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Nom de l'expéditeur affiché</label>
                <input
                  type="text"
                  value={settings.email_from_name}
                  onChange={e => setSettings({...settings, email_from_name: e.target.value})}
                  placeholder="Ex: Direction du Collège des Innovations"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/70 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Adresse email d'expédition</label>
                <input
                  type="email"
                  value={settings.email_from_address}
                  onChange={e => setSettings({...settings, email_from_address: e.target.value})}
                  placeholder="Ex: contact@ecole.com ou direction@gmail.com"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/70 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>Hôte Serveur SMTP</span>
                  <span className="text-[10px] text-slate-400 font-normal lowercase">smtp.domaine.com</span>
                </label>
                <div className="relative">
                  <Server className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    value={settings.smtp_host}
                    onChange={e => setSettings({...settings, smtp_host: e.target.value})}
                    placeholder="Ex: smtp.gmail.com"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/70 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Port Réseau SMTP</label>
                <input
                  type="number"
                  value={settings.smtp_port}
                  onChange={e => setSettings({...settings, smtp_port: parseInt(e.target.value) || 587})}
                  placeholder="587 ou 465"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/70 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Identifiant de Connexion SMTP</label>
                <input
                  type="text"
                  value={settings.smtp_user}
                  onChange={e => setSettings({...settings, smtp_user: e.target.value})}
                  placeholder="Votre adresse email complète ou nom d'utilisateur"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/70 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>Clé d'accès ou Mot de passe SMTP</span>
                  <span className="text-[10px] text-blue-600 font-bold">16 caractères pour Gmail</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="password"
                    value={settings.smtp_pass}
                    onChange={e => setSettings({...settings, smtp_pass: e.target.value})}
                    placeholder="••••••••••••••••"
                    className="w-full pl-10 pr-10 py-3 rounded-2xl border border-slate-200 bg-slate-50/70 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium font-mono"
                  />
                  <Shield className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: CANAL WHATSAPP & ROUTAGE */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-100 shadow-2xs">
                <MessageSquare size={20} className="stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Passerelle WhatsApp Business</h3>
                <p className="text-xs text-slate-500">Mode d'intégration pour la diffusion instantanée sur les terminaux mobiles des parents</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Mode Opérationnel WhatsApp</label>
                <select
                  value={settings.whatsapp_provider}
                  onChange={e => setSettings({...settings, whatsapp_provider: e.target.value})}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/70 text-slate-900 focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-sm font-medium cursor-pointer"
                >
                  <option value="wa_me">Routage Direct wa.me (Recommandé • Gratuit • Sans passerelle tierce)</option>
                  <option value="whatsapp_cloud">Meta WhatsApp Cloud API (Diffusion Serveur Automatique)</option>
                  <option value="twilio">Twilio for WhatsApp Business</option>
                  <option value="green_api">Passerelle Tierce (Green API / Ultramsg)</option>
                </select>
              </div>

              {settings.whatsapp_provider !== 'wa_me' ? (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700">ID Numéro de Téléphone Meta / SID</label>
                    <div className="relative">
                      <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="text"
                        value={settings.whatsapp_phone_number_id}
                        onChange={e => setSettings({...settings, whatsapp_phone_number_id: e.target.value})}
                        placeholder="Ex: 104857930211..."
                        className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/70 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-sm font-medium font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Jeton d'Accès Permanent / Clé API</label>
                    <div className="relative">
                      <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="password"
                        value={settings.whatsapp_api_key}
                        onChange={e => setSettings({...settings, whatsapp_api_key: e.target.value})}
                        placeholder="EAAG..."
                        className="w-full pl-10 pr-10 py-3 rounded-2xl border border-slate-200 bg-slate-50/70 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-sm font-medium font-mono"
                      />
                      <Shield className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 flex items-center gap-3">
                  <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                  <p className="text-xs text-emerald-950 leading-relaxed font-medium">
                    Le mode <strong>wa.me</strong> est prêt à l'emploi : vos messages personnalisés s'ouvrent directement dans WhatsApp Web ou l'application mobile en 1 clic sans coûts d'API.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3: PASSERELLE SMS */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center border border-amber-100 shadow-2xs">
                <MessageSquare size={20} className="stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Passerelle SMS Optionnelle</h3>
                <p className="text-xs text-slate-500">Distribution par SMS conventionnel pour les alertes d'urgence ou absences</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Opérateur SMS</label>
                <select
                  value={settings.sms_provider}
                  onChange={e => setSettings({...settings, sms_provider: e.target.value})}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/70 text-slate-900 focus:bg-white focus:border-amber-600 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all text-sm font-medium cursor-pointer"
                >
                  <option value="none">Désactivé (Recommandé si WhatsApp utilisé)</option>
                  <option value="sent.dm">Sent.dm Gateway</option>
                  <option value="twilio">Twilio SMS</option>
                  <option value="bulksms">BulkSMS</option>
                </select>
              </div>

              {settings.sms_provider !== 'none' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Clé d'API SMS</label>
                  <div className="relative">
                    <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="password"
                      value={settings.sms_api_key}
                      onChange={e => setSettings({...settings, sms_api_key: e.target.value})}
                      placeholder="Votre clé secrète SMS"
                      className="w-full pl-10 pr-10 py-3 rounded-2xl border border-slate-200 bg-slate-50/70 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-amber-600 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all text-sm font-medium font-mono"
                    />
                    <Shield className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* BARRE D'ACTIONS */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleTestSmtp}
              disabled={isTesting || isSaving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300 transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
            >
              {isTesting ? (
                <>
                  <Loader2 size={16} className="animate-spin text-blue-600" />
                  <span>Test de connexion en cours...</span>
                </>
              ) : (
                <>
                  <Send size={15} className="text-blue-600" />
                  <span>Tester la connexion SMTP</span>
                </>
              )}
            </button>
            
            <button
              type="submit"
              disabled={isSaving || isTesting}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Enregistrement en cours...</span>
                </>
              ) : (
                <>
                  <Save size={16} className="text-emerald-400" />
                  <span>Enregistrer les configurations</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* GUIDE PROTOCOLAIRE : GMAIL & ERREUR 535 (DESIGN INTERNATIONAL ÉPURÉ) */}
      <div className="bg-gradient-to-br from-blue-50/90 via-white to-indigo-50/50 rounded-3xl p-6 sm:p-7 border border-blue-200/90 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-blue-100">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-md shadow-blue-600/20 shrink-0">
              <Shield size={22} className="stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-base font-black text-slate-900">Protocole de Sécurité Google & Erreur 535</h4>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-black uppercase tracking-wider">
                  Requis pour @gmail.com
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Google bloque les mots de passe de compte classiques sur SMTP. Vous devez générer un <strong>Mot de passe d'application</strong> officiel.
              </p>
            </div>
          </div>
          
          <a
            href="https://myaccount.google.com/apppasswords"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-50 border border-blue-200 px-3.5 py-2 rounded-xl transition-all shadow-2xs active:scale-95 shrink-0"
          >
            <span>Ouvrir Google Sécurité</span>
            <ExternalLink size={13} />
          </a>
        </div>

        {/* ÉTAPES STANDARDISÉES EN 4 BLOCS CLAIRS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5">
          <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-2xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs font-black flex items-center justify-center">1</span>
              <Lock size={14} className="text-slate-400" />
            </div>
            <p className="text-xs font-bold text-slate-800">Validation 2 Étapes</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Vérifiez que la validation en 2 étapes est bien active sur votre compte Google.
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-2xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs font-black flex items-center justify-center">2</span>
              <Settings size={14} className="text-slate-400" />
            </div>
            <p className="text-xs font-bold text-slate-800">Espace Sécurité</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Dans <em>Gérer votre compte</em>, ouvrez l'onglet <strong>Sécurité</strong>.
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-2xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs font-black flex items-center justify-center">3</span>
              <Key size={14} className="text-slate-400" />
            </div>
            <p className="text-xs font-bold text-slate-800">Mots de passe d'app</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Recherchez <strong>"Mots de passe des applications"</strong> et donnez le nom <em>"EduNova"</em>.
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-2xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs font-black flex items-center justify-center">4</span>
              <CheckCircle2 size={14} className="text-emerald-500" />
            </div>
            <p className="text-xs font-bold text-slate-800">Copier les 16 lettres</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Collez le code de 16 caractères dans le champ <strong>Mot de passe SMTP</strong> ci-dessus.
            </p>
          </div>
        </div>

        {/* PARAMÈTRES TECHNIQUES DE RÉFÉRENCE */}
        <div className="mt-5 pt-4 border-t border-blue-100/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-mono bg-white px-2.5 py-1 rounded-lg border border-blue-100 text-slate-700">
              Serveur : <strong>smtp.gmail.com</strong>
            </span>
            <span className="font-mono bg-white px-2.5 py-1 rounded-lg border border-blue-100 text-slate-700">
              Port : <strong>587</strong> (STARTTLS) ou <strong>465</strong> (SSL)
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleCopyText('smtp.gmail.com', 'host')}
            className="text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Copy size={12} />
            <span>{copiedKey === 'host' ? 'Copié !' : 'Copier l\'adresse du serveur'}</span>
          </button>
        </div>
      </div>

    </div>
  );
};

export default CommunicationSettings;

