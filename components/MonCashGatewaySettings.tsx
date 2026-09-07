import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  ExternalLink, 
  Copy, 
  Check, 
  ShieldCheck, 
  FlaskConical, 
  Smartphone, 
  ChevronDown, 
  HelpCircle, 
  Coins, 
  Building2, 
  Zap, 
  CheckCircle,
  XCircle,
  Info,
  Wifi,
  WifiOff,
  RefreshCw,
  Activity
} from 'lucide-react';
import { useSchool } from '../contexts/SchoolContext';
import { UserProfile } from '../types';
import { toast } from 'sonner';

export interface MonCashGatewaySettingsProps {
  moncashConfig: {
    id?: string;
    school_id?: string;
    gateway_name?: string;
    client_id?: string;
    client_secret?: string;
    business_key?: string;
    mode?: 'sandbox' | 'live';
    is_active?: boolean;
    [key: string]: any;
  };
  setMoncashConfig: React.Dispatch<React.SetStateAction<any>>;
  onSave: () => Promise<void>;
  saving: boolean;
  canManageAllCampuses: boolean;
  user: UserProfile;
}

export const MonCashGatewaySettings: React.FC<MonCashGatewaySettingsProps> = ({
  moncashConfig,
  setMoncashConfig,
  onSave,
  saving,
  canManageAllCampuses,
  user
}) => {
  const { terminology, campuses, school } = useSchool();
  const [showSecret, setShowSecret] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [isEnvDropdownOpen, setIsEnvDropdownOpen] = useState(false);
  const [testResult, setTestResult] = useState<{ status: 'idle' | 'success' | 'warning' | 'error'; message: string } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    status: 'success' | 'error';
    message: string;
    timestamp: string;
    mode: 'sandbox' | 'live';
    details?: any;
  } | null>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownMenuRef = useRef<HTMLDivElement>(null);

  const [popoverCoords, setPopoverCoords] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const updateDropdownPosition = useCallback(() => {
    if (!triggerButtonRef.current || typeof window === 'undefined') return;
    const rect = triggerButtonRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    const popoverWidth = Math.max(rect.width, 280);
    let left = rect.left;
    if (left + popoverWidth > viewportWidth - 12) {
      left = viewportWidth - popoverWidth - 12;
    }
    if (left < 12) left = 12;

    const spaceBelow = viewportHeight - rect.bottom;
    const openUpward = spaceBelow < 220 && rect.top > spaceBelow;

    setPopoverCoords({
      top: openUpward ? rect.top - 180 : rect.bottom + 6,
      left,
      width: popoverWidth,
    });
  }, []);

  useEffect(() => {
    if (isEnvDropdownOpen) {
      updateDropdownPosition();
      const handleScrollOrResize = () => updateDropdownPosition();
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [isEnvDropdownOpen, updateDropdownPosition]);

  // Close environment dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerButtonRef.current && 
        !triggerButtonRef.current.contains(target) &&
        dropdownMenuRef.current && 
        !dropdownMenuRef.current.contains(target)
      ) {
        setIsEnvDropdownOpen(false);
      }
    };
    if (isEnvDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEnvDropdownOpen]);

  const currentMode = moncashConfig.mode === 'live' ? 'live' : 'sandbox';
  const isActive = Boolean(moncashConfig.is_active);

  const handleCopy = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`${fieldName} copié dans le presse-papier`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSelectMode = (newMode: 'sandbox' | 'live') => {
    if (!canManageAllCampuses) return;
    setMoncashConfig((prev: any) => ({ ...prev, mode: newMode }));
    setIsEnvDropdownOpen(false);
    setTestResult(null);
    setConnectionResult(null);
  };

  const handleTestConnection = async () => {
    const { client_id, client_secret, business_key, mode } = moncashConfig;

    if (!client_id || !client_id.trim()) {
      toast.error('Veuillez renseigner le Client ID avant de tester la connexion.');
      setConnectionResult({
        status: 'error',
        message: 'Le Client ID MonCash est obligatoire pour initialiser la vérification.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        mode: mode === 'live' ? 'live' : 'sandbox',
      });
      return;
    }

    if (!client_secret || !client_secret.trim()) {
      toast.error('Veuillez renseigner le Client Secret avant de tester la connexion.');
      setConnectionResult({
        status: 'error',
        message: 'Le Client Secret MonCash est obligatoire pour authentifier la passerelle.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        mode: mode === 'live' ? 'live' : 'sandbox',
      });
      return;
    }

    setTestingConnection(true);
    setConnectionResult(null);

    try {
      const res = await fetch('/api/moncash/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: client_id.trim(),
          client_secret: client_secret.trim(),
          business_key: business_key?.trim(),
          mode: mode || 'sandbox'
        })
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        setConnectionResult({
          status: 'success',
          message: data.message || `Authentification réussie auprès de Digicel MonCash (${data.mode === 'live' ? 'Live' : 'Sandbox'}).`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          mode: data.mode || (mode === 'live' ? 'live' : 'sandbox'),
          details: data
        });
        toast.success(`Connexion MonCash validée avec succès (${data.mode === 'live' ? 'Live' : 'Sandbox'}) !`);
      } else {
        const errorMsg = data?.error || `Échec de connexion MonCash (HTTP ${res.status}).`;
        setConnectionResult({
          status: 'error',
          message: errorMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          mode: mode === 'live' ? 'live' : 'sandbox',
          details: data
        });
        toast.error(errorMsg);
      }
    } catch (err: any) {
      const errorMsg = `Erreur réseau : ${err.message || 'Impossible de joindre le serveur'}`;
      setConnectionResult({
        status: 'error',
        message: errorMsg,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        mode: mode === 'live' ? 'live' : 'sandbox'
      });
      toast.error(errorMsg);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleDiagnose = () => {
    const { client_id, client_secret, business_key } = moncashConfig;
    if (!client_id?.trim() || !client_secret?.trim() || !business_key?.trim()) {
      setTestResult({
        status: 'warning',
        message: "Identifiants incomplets : Veuillez renseigner le Client ID, le Client Secret et la Clé Marchand (Business Key)."
      });
      return;
    }
    if (client_id.trim().length < 8 || client_secret.trim().length < 8) {
      setTestResult({
        status: 'warning',
        message: "Les clés saisies semblent trop courtes pour des identifiants API Digicel valides."
      });
      return;
    }

    setTestResult({
      status: 'success',
      message: `Paramètres API validés avec succès ! La passerelle est prête pour le mode ${currentMode === 'live' ? 'Production (Live)' : 'Sandbox (Test)'}.`
    });
  };

  // Base webhook URL calculation
  const webhookUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/moncash/webhook` 
    : 'https://votre-domaine.com/api/moncash/webhook';

  return (
    <div className="space-y-3 sm:space-y-3.5">
      {/* 1. Alerte Campus / Siège Social si droits restreints */}
      {!canManageAllCampuses && (
        <div className="bg-amber-50/90 border border-amber-200/90 px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-800 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <Lock size={15} className="text-amber-700 shrink-0" />
            <p className="font-medium truncate">
              <strong className="font-bold">Passerelle API verrouillée (Annexe) :</strong> Seule la Direction du Siège Social peut modifier les clés de paiement MonCash.
            </p>
          </div>
          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-mono text-[10px] font-bold rounded-md uppercase shrink-0">
            Lecture Seule
          </span>
        </div>
      )}

      {/* 2. Carte Principale Passerelle MonCash */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 relative">
        {/* En-tête compact & moderne */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 bg-slate-50/60 rounded-t-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Badge Marque Digicel MonCash */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 via-rose-600 to-red-700 text-white shadow-xs flex items-center justify-center shrink-0 border border-red-500/30">
              <Smartphone size={20} className="stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black tracking-tight text-slate-900 truncate">
                  Passerelle API - Intégration MonCash
                </h3>
                {/* Pilule Statut En Ligne */}
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  isActive 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  {isActive ? 'Active au guichet' : 'Désactivée'}
                </span>
                {/* Pilule Environnement Actuel */}
                <span className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  currentMode === 'live' 
                    ? 'bg-blue-50 text-blue-700 border-blue-200' 
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {currentMode === 'live' ? <ShieldCheck size={11} /> : <FlaskConical size={11} />}
                  {currentMode === 'live' ? 'Production (Live)' : 'Sandbox (Test)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                Encaissement mobile Digicel Haïti • Frais de scolarité & fournitures
              </p>
            </div>
          </div>

          {/* Boutons d'Action Header */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap sm:flex-nowrap">
            {/* Bouton Tester la connexion (directement connecté à l'endpoint MonCash) */}
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testingConnection || !canManageAllCampuses || !moncashConfig.client_id || !moncashConfig.client_secret}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95 border ${
                connectionResult?.status === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  : connectionResult?.status === 'error'
                  ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90 hover:border-slate-300'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title="Effectuer une requête de test légère vers l'API Digicel MonCash"
            >
              {testingConnection ? (
                <Loader2 size={13} className="animate-spin text-red-600" />
              ) : connectionResult?.status === 'success' ? (
                <CheckCircle2 size={13} className="text-emerald-600" />
              ) : connectionResult?.status === 'error' ? (
                <WifiOff size={13} className="text-rose-600" />
              ) : (
                <Wifi size={13} className="text-red-600" />
              )}
              <span>{testingConnection ? 'Test en cours...' : 'Tester la connexion'}</span>
            </button>

            {/* Bouton Enregistrer */}
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !canManageAllCampuses}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              <span>{saving ? 'Enregistrement...' : 'Enregistrer'}</span>
            </button>
          </div>
        </div>

        {/* Corps du Formulaire Dense & Compact */}
        <div className="p-3.5 sm:p-4 md:p-5 space-y-3.5">
          {/* Feedback Visuel : Résultat du Test de Connexion API MonCash */}
          {connectionResult && (
            <div 
              className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs shadow-2xs animate-in fade-in slide-in-from-top-1 duration-200 ${
                connectionResult.status === 'success'
                  ? 'bg-emerald-50/95 border-emerald-300 text-emerald-950'
                  : 'bg-rose-50/95 border-rose-300 text-rose-950'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div 
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 shadow-xs ${
                    connectionResult.status === 'success'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-rose-600 text-white'
                  }`}
                >
                  {connectionResult.status === 'success' ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <WifiOff size={16} />
                  )}
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-xs tracking-tight">
                      {connectionResult.status === 'success' 
                        ? 'Authentification MonCash Réussie' 
                        : 'Échec de Connexion MonCash'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-mono tracking-wider ${
                      connectionResult.mode === 'live' 
                        ? 'bg-blue-100 text-blue-900 border border-blue-200' 
                        : 'bg-amber-100 text-amber-900 border border-amber-200'
                    }`}>
                      {connectionResult.mode === 'live' ? 'Mode Live' : 'Mode Sandbox'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono font-medium">
                      Vérifié à {connectionResult.timestamp}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed font-medium">
                    {connectionResult.message}
                  </p>
                  {connectionResult.status === 'success' && (
                    <div className="flex items-center gap-2 pt-0.5 text-[10px] font-bold text-emerald-800">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                        Jeton d'accès validé par Digicel
                      </span>
                      <span>•</span>
                      <span>Vous pouvez enregistrer cette configuration en toute sécurité.</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                    connectionResult.status === 'success'
                      ? 'bg-white hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-white hover:bg-rose-100 text-rose-800 border-rose-200'
                  }`}
                  title="Retester la connexion"
                >
                  <RefreshCw size={12} className={testingConnection ? 'animate-spin' : ''} />
                </button>
                <button
                  type="button"
                  onClick={() => setConnectionResult(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                  title="Fermer ce message"
                >
                  <XCircle size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Diagnostic Result Alert */}
          {testResult && (
            <div className={`p-2.5 rounded-xl border flex items-start justify-between gap-2.5 text-xs animate-in fade-in duration-200 ${
              testResult.status === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : testResult.status === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              <div className="flex items-center gap-2">
                {testResult.status === 'success' ? (
                  <CheckCircle size={15} className="text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle size={15} className="text-amber-600 shrink-0" />
                )}
                <span className="font-semibold">{testResult.message}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setTestResult(null)} 
                className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                &times;
              </button>
            </div>
          )}

          {/* Bandeau d'aide compact avec dépliable rapide */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-xs text-slate-700">
              <Info size={15} className="text-red-600 shrink-0" />
              <span>
                Obtenez vos clés API sur le portail officiel marchand <strong className="font-bold">Digicel MonCash Business</strong>.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <a 
                href={currentMode === 'live' 
                  ? 'https://moncashbutton.digicelgroup.com/Moncash-business/' 
                  : 'https://sandbox.moncashbutton.digicelgroup.com/Moncash-business/'} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-red-600 hover:text-red-800 inline-flex items-center gap-1 hover:underline cursor-pointer bg-red-50/80 px-2.5 py-1 rounded-lg border border-red-200/80"
                title={currentMode === 'live' ? 'Accéder au portail MonCash Business Live' : 'Accéder au portail MonCash Business Sandbox'}
              >
                Portail MonCash ({currentMode === 'live' ? 'Live' : 'Sandbox'}) <ExternalLink size={11} />
              </a>
              <span className="text-slate-300 hidden sm:inline">•</span>
              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                className="text-[11px] font-bold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer"
              >
                {showGuide ? 'Masquer aide' : 'Liens & Guide'}
                <ChevronDown size={11} className={`transition-transform duration-200 ${showGuide ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {/* Guide déployé avec liens officiels vérifiés */}
          {showGuide && (
            <div className="p-3.5 bg-red-50/50 border border-red-100 rounded-xl text-xs space-y-3 text-slate-700 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <h5 className="font-bold text-red-900 flex items-center gap-1.5 text-xs">
                  <Smartphone size={13} className="text-red-600" />
                  Portails officiels & Instructions Digicel Haïti
                </h5>
                <span className="text-[10px] text-slate-500 font-mono">
                  Portail : /Moncash-business/
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[11px]">
                <div className="bg-white p-3 rounded-lg border border-red-100/90 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900">1. Mode Sandbox (Essai & Développement)</p>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-200">
                      Sandbox
                    </span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    Créez un compte test gratuit pour générer vos identifiants REST API Sandbox (Client ID, Secret, Business Key) :
                  </p>
                  <div className="pt-1 flex flex-wrap gap-2">
                    <a
                      href="https://sandbox.moncashbutton.digicelgroup.com/Moncash-business/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red-600 hover:text-red-800 font-bold underline inline-flex items-center gap-1"
                    >
                      Connexion Sandbox <ExternalLink size={10} />
                    </a>
                    <span className="text-slate-300">•</span>
                    <a
                      href="https://sandbox.moncashbutton.digicelgroup.com/Moncash-business/New"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red-600 hover:text-red-800 font-bold underline inline-flex items-center gap-1"
                    >
                      Créer compte Sandbox <ExternalLink size={10} />
                    </a>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-red-100/90 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900">2. Mode Live (Production Réelle)</p>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-blue-100 text-blue-900 border border-blue-200">
                      Live
                    </span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    Accessible aux commerçants et institutions avec un contrat marchand Digicel validé :
                  </p>
                  <div className="pt-1 flex flex-wrap gap-2">
                    <a
                      href="https://moncashbutton.digicelgroup.com/Moncash-business/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 hover:text-blue-900 font-bold underline inline-flex items-center gap-1"
                    >
                      Portail Marchand Live <ExternalLink size={10} />
                    </a>
                    <span className="text-slate-300">•</span>
                    <a
                      href="https://moncashdfs.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-600 hover:text-slate-900 font-medium underline inline-flex items-center gap-1"
                    >
                      MonCash DFS <ExternalLink size={10} />
                    </a>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-0.5">
                    Contact Digicel Business : <a href="mailto:MFS_B.Services@digicelgroup.com" className="font-mono text-red-600 hover:underline">MFS_B.Services@digicelgroup.com</a> ou tél. 202
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Grille des Champs API - Agencement Dense & Compact */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* 1. Client ID */}
            <div className="space-y-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <Key size={12} className="text-slate-500" />
                    Client ID
                  </label>
                  {connectionResult && (
                    <span className={`inline-flex items-center gap-0.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${
                      connectionResult.status === 'success'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {connectionResult.status === 'success' ? <Check size={9} /> : <AlertCircle size={9} />}
                      {connectionResult.status === 'success' ? 'Validé' : 'À vérifier'}
                    </span>
                  )}
                </div>
                {moncashConfig.client_id && (
                  <button
                    type="button"
                    onClick={() => handleCopy(moncashConfig.client_id, 'Client ID')}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    {copiedField === 'Client ID' ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
                    {copiedField === 'Client ID' ? 'Copié' : 'Copier'}
                  </button>
                )}
              </div>
              <div className="relative">
                <input 
                  type="text" 
                  className="w-full px-3 py-1.5 bg-slate-50/90 text-slate-900 border border-slate-200 rounded-xl font-mono text-xs font-bold outline-none focus:bg-white focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all shadow-2xs placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 disabled:opacity-60 disabled:cursor-not-allowed"
                  value={moncashConfig.client_id || ''}
                  disabled={!canManageAllCampuses}
                  onChange={e => {
                    setMoncashConfig((prev: any) => ({ ...prev, client_id: e.target.value }));
                    if (connectionResult) setConnectionResult(null);
                  }}
                  placeholder="Ex: 10002938491823..."
                />
              </div>
            </div>

            {/* 2. Client Secret */}
            <div className="space-y-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <Lock size={12} className="text-slate-500" />
                    Client Secret
                  </label>
                  {connectionResult && (
                    <span className={`inline-flex items-center gap-0.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${
                      connectionResult.status === 'success'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {connectionResult.status === 'success' ? <Check size={9} /> : <AlertCircle size={9} />}
                      {connectionResult.status === 'success' ? 'Validé' : 'À vérifier'}
                    </span>
                  )}
                </div>
                {moncashConfig.client_secret && (
                  <button
                    type="button"
                    onClick={() => handleCopy(moncashConfig.client_secret, 'Client Secret')}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    {copiedField === 'Client Secret' ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
                    {copiedField === 'Client Secret' ? 'Copié' : 'Copier'}
                  </button>
                )}
              </div>
              <div className="relative">
                <input 
                  type={showSecret ? "text" : "password"}
                  className="w-full pl-3 pr-8 py-1.5 bg-slate-50/90 text-slate-900 border border-slate-200 rounded-xl font-mono text-xs font-bold outline-none focus:bg-white focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all shadow-2xs placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 disabled:opacity-60 disabled:cursor-not-allowed"
                  value={moncashConfig.client_secret || ''}
                  disabled={!canManageAllCampuses}
                  onChange={e => {
                    setMoncashConfig((prev: any) => ({ ...prev, client_secret: e.target.value }));
                    if (connectionResult) setConnectionResult(null);
                  }}
                  placeholder="••••••••••••••••"
                />
                <button 
                  type="button" 
                  onClick={() => setShowSecret(!showSecret)} 
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
                  title={showSecret ? "Masquer" : "Afficher"}
                >
                  {showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>

            {/* 3. Business Key (Clé Marchand Digicel) */}
            <div className="space-y-1 min-w-0">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Building2 size={12} className="text-slate-500" />
                  Business Key (Marchand)
                </label>
                {moncashConfig.business_key && (
                  <button
                    type="button"
                    onClick={() => handleCopy(moncashConfig.business_key, 'Business Key')}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    {copiedField === 'Business Key' ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
                    {copiedField === 'Business Key' ? 'Copié' : 'Copier'}
                  </button>
                )}
              </div>
              <div className="relative">
                <input 
                  type="text" 
                  className="w-full px-3 py-1.5 bg-slate-50/90 text-slate-900 border border-slate-200 rounded-xl font-mono text-xs font-bold outline-none focus:bg-white focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all shadow-2xs placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 disabled:opacity-60 disabled:cursor-not-allowed"
                  value={moncashConfig.business_key || ''}
                  disabled={!canManageAllCampuses}
                  onChange={e => setMoncashConfig((prev: any) => ({ ...prev, business_key: e.target.value }))}
                  placeholder="Ex: MS_8839210 ou 1000..."
                />
              </div>
            </div>
          </div>

          {/* Deuxième Ligne : Sélecteurs Pilules Harmoniques (Environnement, Devise, Périmètre) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {/* SÉLECTEUR PILULE 1 : ENVIRONNEMENT API (Harmonisé avec Feuille de Présence) */}
            <div className="space-y-1 min-w-0">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Globe size={12} className="text-slate-500" />
                  Environnement API
                </label>
                {/* Pilules de sélection rapide (style Feuille de Présence) */}
                <div className="flex items-center gap-1 bg-slate-100/90 p-0.5 rounded-full border border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => handleSelectMode('sandbox')}
                    disabled={!canManageAllCampuses}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black transition-all cursor-pointer ${
                      currentMode === 'sandbox' 
                        ? 'bg-amber-500 text-white shadow-2xs' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Sandbox
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectMode('live')}
                    disabled={!canManageAllCampuses}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black transition-all cursor-pointer ${
                      currentMode === 'live' 
                        ? 'bg-blue-600 text-white shadow-2xs' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Live
                  </button>
                </div>
              </div>
              
              <div className="relative">
                {/* Bouton Pillule Déroulant */}
                <button
                  ref={triggerButtonRef}
                  type="button"
                  onClick={() => canManageAllCampuses && setIsEnvDropdownOpen(!isEnvDropdownOpen)}
                  disabled={!canManageAllCampuses}
                  className={`w-full px-3 py-1.5 bg-white border rounded-xl text-xs font-bold flex items-center justify-between gap-2 transition-all shadow-2xs cursor-pointer select-none ${
                    isEnvDropdownOpen 
                      ? 'border-red-600 ring-2 ring-red-100 shadow-xs' 
                      : 'border-slate-200/90 hover:border-slate-300'
                  } ${!canManageAllCampuses ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {/* Badge Pilule interne */}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                      currentMode === 'live' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {currentMode === 'live' ? <ShieldCheck size={11} /> : <FlaskConical size={11} />}
                      {currentMode === 'live' ? 'Live (Production)' : 'Sandbox (Développement)'}
                    </span>
                  </div>
                  <ChevronDown size={13} className={`text-slate-400 transition-transform duration-200 shrink-0 ${isEnvDropdownOpen ? 'rotate-180 text-red-600' : ''}`} />
                </button>

                {/* Popover Pilule Déroulant via Portal pour ne jamais être bloqué par les conteneurs parents */}
                {isEnvDropdownOpen && popoverCoords && typeof document !== 'undefined' && createPortal(
                  <div 
                    ref={dropdownMenuRef}
                    style={{
                      position: 'fixed',
                      top: `${popoverCoords.top}px`,
                      left: `${popoverCoords.left}px`,
                      width: `${popoverCoords.width}px`,
                      zIndex: 99999
                    }}
                    className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150"
                  >
                    {/* Option Sandbox */}
                    <button
                      type="button"
                      onClick={() => handleSelectMode('sandbox')}
                      className={`w-full text-left p-2.5 rounded-xl text-xs transition-all flex items-start justify-between gap-2 cursor-pointer ${
                        currentMode === 'sandbox' 
                          ? 'bg-amber-50/80 border border-amber-200/80 text-amber-950 font-bold' 
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold flex items-center gap-1">
                            <FlaskConical size={10} /> Sandbox
                          </span>
                          <span className="font-bold text-xs text-slate-900">Développement & Tests</span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-normal leading-tight">
                          Simulation sans débit réel. Idéal pour tester le guichet avec des numéros de test.
                        </p>
                      </div>
                      {currentMode === 'sandbox' && <Check size={14} className="text-amber-600 shrink-0 mt-1" />}
                    </button>

                    {/* Option Live */}
                    <button
                      type="button"
                      onClick={() => handleSelectMode('live')}
                      className={`w-full text-left p-2.5 rounded-xl text-xs transition-all flex items-start justify-between gap-2 cursor-pointer ${
                        currentMode === 'live' 
                          ? 'bg-blue-50/80 border border-blue-200/80 text-blue-950 font-bold' 
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold flex items-center gap-1">
                            <ShieldCheck size={10} /> Live
                          </span>
                          <span className="font-bold text-xs text-slate-900">Production Réelle</span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-normal leading-tight">
                          Transferts bancaires réels en Gourdes Haïtiennes (HTG) crédités sur votre compte Digicel.
                        </p>
                      </div>
                      {currentMode === 'live' && <Check size={14} className="text-blue-600 shrink-0 mt-1" />}
                    </button>
                  </div>,
                  document.body
                )}
              </div>
            </div>

            {/* SÉLECTEUR PILULE 2 : DEVISE DE RÈGLEMENT */}
            <div className="space-y-1 min-w-0">
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                <Coins size={12} className="text-slate-500" />
                Devise MonCash
              </label>
              <div className="w-full px-3 py-1.5 bg-slate-50/90 border border-slate-200/90 rounded-xl text-xs font-bold flex items-center justify-between gap-2 shadow-2xs">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  HTG (Gourde Haïtienne)
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Standard Digicel</span>
              </div>
            </div>

            {/* SÉLECTEUR PILULE 3 : PÉRIMÈTRE ÉTABLISSEMENT / ANNEXE */}
            <div className="space-y-1 min-w-0 sm:col-span-2 lg:col-span-1">
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                <Building2 size={12} className="text-slate-500" />
                Périmètre d'application
              </label>
              <div className="w-full px-3 py-1.5 bg-slate-50/90 border border-slate-200/90 rounded-xl text-xs font-bold flex items-center justify-between gap-2 shadow-2xs">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-200/80 text-slate-800 truncate">
                  {campuses && campuses.length > 1 ? 'Tous les campus / annexes (Siège)' : (school?.name || 'Établissement Principal')}
                </span>
                <span className="text-[10px] text-slate-400 font-medium shrink-0">Centralisé</span>
              </div>
            </div>
          </div>

          {/* Troisième Groupe : Switch d'Activation du Guichet & URL Webhook */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-1">
            {/* Interrupteur Activation au Guichet */}
            <div className="lg:col-span-7">
              <label 
                className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 shadow-2xs ${
                  isActive 
                    ? 'bg-red-50/50 border-red-200/80' 
                    : 'bg-slate-50/80 border-slate-200/80'
                } ${!canManageAllCampuses ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:border-red-300'}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isActive ? 'bg-red-600 text-white shadow-xs' : 'bg-slate-200 text-slate-500'
                  }`}>
                    <Smartphone size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-slate-900 truncate">
                      Activer MonCash sur le guichet de paiement
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium leading-tight truncate">
                      Permet aux {terminology.students.toLowerCase()} de régler directement par portefeuille mobile.
                    </p>
                  </div>
                </div>

                {/* Toggle Pill Switch */}
                <div className="relative shrink-0">
                  <input 
                    type="checkbox" 
                    id="moncash_active"
                    className="sr-only peer"
                    checked={isActive}
                    disabled={!canManageAllCampuses}
                    onChange={e => setMoncashConfig((prev: any) => ({ ...prev, is_active: e.target.checked }))}
                  />
                  <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                </div>
              </label>
            </div>

            {/* URL Webhook / Callback IPN (Lecture et Copie Rapide) */}
            <div className="lg:col-span-5 space-y-1 min-w-0">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Globe size={12} className="text-slate-500" />
                  URL Callback / Webhook Digicel
                </label>
                <button
                  type="button"
                  onClick={() => handleCopy(webhookUrl, 'URL Webhook')}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-0.5 cursor-pointer"
                >
                  {copiedField === 'URL Webhook' ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
                  {copiedField === 'URL Webhook' ? 'Copié' : 'Copier'}
                </button>
              </div>
              <div className="flex items-center bg-slate-50/90 border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
                <input 
                  type="text" 
                  readOnly
                  value={webhookUrl}
                  className="w-full bg-transparent font-mono text-[11px] text-slate-600 outline-none truncate cursor-default"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
