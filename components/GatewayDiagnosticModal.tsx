import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Activity, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Play, 
  Radio, 
  Copy, 
  Check, 
  Layers, 
  Smartphone, 
  ExternalLink, 
  Lock, 
  Building2, 
  Sparkles, 
  Clock, 
  ArrowRight, 
  HelpCircle, 
  Info, 
  Sliders, 
  Terminal, 
  CheckCircle,
  FileText,
  UserCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { UserProfile } from '../types';
import { useSchool } from '../contexts/SchoolContext';
import { supabase } from '../supabase';
import { ApiVaultService, GatewayDiagnosticResult, GatewayDiagnosticCheck } from '../services/apiVaultService';
import { toast } from 'sonner';

export interface GatewayDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  initialGateway?: 'moncash' | 'kobara';
  initialOperator?: 'moncash' | 'natcash';
}

type TabType = 'diagnostic' | 'simulation' | 'audit';

export const GatewayDiagnosticModal: React.FC<GatewayDiagnosticModalProps> = ({
  isOpen,
  onClose,
  user,
  initialGateway = 'moncash',
  initialOperator = 'moncash'
}) => {
  const navigate = useNavigate();
  const { school } = useSchool();
  const activeSchoolId = user?.school_id || school?.id || '';
  const schoolDisplayName = school?.name || 'Établissement Scolaire';

  // Navigation interne
  const [activeTab, setActiveTab] = useState<TabType>('diagnostic');
  
  // Configuration de test
  const [selectedGateway, setSelectedGateway] = useState<'moncash' | 'kobara'>(initialGateway);
  const [selectedOperator, setSelectedOperator] = useState<'moncash' | 'natcash'>(initialOperator);
  const [mode, setMode] = useState<'sandbox' | 'live' | 'test'>('sandbox');
  const [testAmount, setTestAmount] = useState<number>(250);
  const [testPhone, setTestPhone] = useState<string>('50937889900');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentsList, setStudentsList] = useState<Array<{ id: string; name: string; class: string }>>([]);

  // États du diagnostic
  const [running, setRunning] = useState<boolean>(false);
  const [diagnosticResult, setDiagnosticResult] = useState<GatewayDiagnosticResult | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showPayload, setShowPayload] = useState<boolean>(false);

  // Synchronisation du mode selon la passerelle
  useEffect(() => {
    if (selectedGateway === 'moncash') {
      setMode(prev => (prev === 'live' ? 'live' : 'sandbox'));
      setTestPhone('50937889900');
    } else {
      setMode(prev => (prev === 'live' ? 'live' : 'test'));
      setTestPhone(selectedOperator === 'natcash' ? '50922445566' : '50937889900');
    }
  }, [selectedGateway, selectedOperator]);

  // Chargement des élèves pour le sélecteur d'élève témoin
  useEffect(() => {
    if (!isOpen || !activeSchoolId) return;
    const fetchStudents = async () => {
      try {
        const { data } = await supabase
          .from('students')
          .select('id, first_name, last_name, class_name')
          .eq('school_id', activeSchoolId)
          .limit(15);
        if (data && data.length > 0) {
          setStudentsList(
            data.map(s => ({
              id: s.id,
              name: `${s.first_name} ${s.last_name}`.trim(),
              class: s.class_name || 'Élève'
            }))
          );
        }
      } catch (e) {
        console.warn('Erreur chargement élèves test:', e);
      }
    };
    fetchStudents();
  }, [isOpen, activeSchoolId]);

  // Chargement des logs d'audit du tenant
  const fetchAuditLogs = useCallback(async () => {
    if (!activeSchoolId) return;
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/webhooks/logs?school_id=${encodeURIComponent(activeSchoolId)}`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch (e) {
      console.warn('Erreur chargement audit logs:', e);
    } finally {
      setLoadingLogs(false);
    }
  }, [activeSchoolId]);

  useEffect(() => {
    if (isOpen && activeSchoolId) {
      fetchAuditLogs();
    }
  }, [isOpen, activeSchoolId, fetchAuditLogs]);

  // Exécution du diagnostic en temps réel
  const handleRunDiagnostic = async () => {
    if (!activeSchoolId) {
      toast.error("Identifiant d'établissement manquant.");
      return;
    }

    setRunning(true);
    setDiagnosticResult(null);

    try {
      const result = await ApiVaultService.runGatewayDiagnostic({
        schoolId: activeSchoolId,
        gateway: selectedGateway,
        operator: selectedOperator,
        mode: mode,
        testAmount: Number(testAmount) || 250,
        testPhone: testPhone,
        testStudentId: selectedStudentId || undefined
      });

      setDiagnosticResult(result);
      if (result.success) {
        toast.success(`Diagnostic ${selectedGateway.toUpperCase()} validé avec succès (${result.latency_ms || 0}ms) !`);
      } else {
        toast.error(`Diagnostic ${selectedGateway.toUpperCase()} : Vérifications requises.`);
      }
      fetchAuditLogs();
    } catch (err: any) {
      toast.error(`Échec du diagnostic : ${err.message || 'Erreur réseau'}`);
    } finally {
      setRunning(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Copié dans le presse-papier");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* HEADER MODALE AVEC IDENTITÉ MULTI-TENANT & BANNIÈRE ZÉRO IMPACT */}
        <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-purple-950 p-3.5 sm:p-5 text-white flex items-start sm:items-center justify-between gap-3 relative shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shrink-0">
              <Radio size={18} className="animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base md:text-lg font-black tracking-tight text-white truncate">
                  Diagnostic Passerelles & Clés API
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1 shrink-0">
                  <ShieldCheck size={11} />
                  <span>Zéro Impact Solde</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-300 mt-0.5 flex-wrap">
                <span className="flex items-center gap-1 font-medium truncate max-w-[180px] sm:max-w-xs">
                  <Building2 size={11} className="text-indigo-400 shrink-0" />
                  {schoolDisplayName}
                </span>
                <span className="text-slate-500 hidden sm:inline">•</span>
                <span className="text-slate-400 font-mono text-[9px] sm:text-[10px]">
                  Tenant: {activeSchoolId ? `${activeSchoolId.slice(0, 8)}...` : 'Non défini'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* BANNIÈRE DE SANCTUARISATION FINANCIÈRE */}
        <div className="bg-emerald-50/90 border-b border-emerald-200/80 px-3.5 sm:px-4 py-2 sm:py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 text-xs">
          <div className="flex items-start sm:items-center gap-2 text-emerald-900 font-medium leading-relaxed">
            <ShieldCheck size={16} className="text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
            <span>
              <strong>Environnement de Test Isolé :</strong> Interrogation directe des serveurs MonCash et Kobara sans impacter la dette ni les versements de l'élève.
            </span>
          </div>
          <button
            onClick={() => {
              onClose();
              navigate('/parametres?tab=api_vault');
            }}
            className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-white px-2.5 py-1 rounded-lg border border-indigo-200/70 hover:border-indigo-300 shadow-2xs transition-all flex items-center gap-1 self-start sm:self-center shrink-0 cursor-pointer"
          >
            <Lock size={11} />
            <span>Coffre-Fort Clés API</span>
            <ArrowRight size={10} />
          </button>
        </div>

        {/* NAVIGATION PAR ONGLETS */}
        <div className="bg-slate-50 border-b border-slate-200 px-3 sm:px-4 flex items-center gap-1 sm:gap-2 shrink-0 overflow-x-auto no-scrollbar scroll-smooth">
          <button
            onClick={() => setActiveTab('diagnostic')}
            className={`py-2.5 sm:py-3 px-3 sm:px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'diagnostic'
                ? 'border-indigo-600 text-indigo-700 bg-white/60'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity size={14} className={activeTab === 'diagnostic' ? 'text-indigo-600' : 'text-slate-400'} />
            <span>Diagnostic & Validation</span>
          </button>

          <button
            onClick={() => setActiveTab('simulation')}
            className={`py-2.5 sm:py-3 px-3 sm:px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'simulation'
                ? 'border-purple-600 text-purple-700 bg-white/60'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders size={14} className={activeTab === 'simulation' ? 'text-purple-600' : 'text-slate-400'} />
            <span>Paramètres de Simulation</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`py-2.5 sm:py-3 px-3 sm:px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'audit'
                ? 'border-slate-800 text-slate-900 bg-white/60'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText size={14} className={activeTab === 'audit' ? 'text-slate-800' : 'text-slate-400'} />
            <span>Journal d'Audit ({auditLogs.length})</span>
          </button>
        </div>

        {/* CORPS DE LA MODALE */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* SELECTION PASSERELLE & OPÉRATEUR */}
          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Passerelle Mobile Money à diagnostiquer
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 font-medium">Environnement :</span>
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-bold shadow-2xs">
                  {selectedGateway === 'moncash' ? (
                    <>
                      <button
                        onClick={() => setMode('sandbox')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          mode === 'sandbox' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Sandbox Dev
                      </button>
                      <button
                        onClick={() => setMode('live')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          mode === 'live' ? 'bg-emerald-600 text-white font-black' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Production Live
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setMode('test')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          mode === 'test' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Mode Test
                      </button>
                      <button
                        onClick={() => setMode('live')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          mode === 'live' ? 'bg-emerald-600 text-white font-black' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Production Live
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* CHOIX DE LA PASSERELLE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* CARTE MONCASH */}
              <div
                onClick={() => setSelectedGateway('moncash')}
                className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                  selectedGateway === 'moncash'
                    ? 'border-rose-500 bg-rose-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${
                    selectedGateway === 'moncash' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    MC
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-slate-900">
                      Digicel MonCash Direct
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      OAuth 2.0 • Validation directe avec les serveurs Digicel
                    </p>
                  </div>
                </div>
                {selectedGateway === 'moncash' && (
                  <CheckCircle2 size={18} className="text-rose-600 shrink-0" />
                )}
              </div>

              {/* CARTE KOBARA UNIFIÉE */}
              <div
                onClick={() => setSelectedGateway('kobara')}
                className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                  selectedGateway === 'kobara'
                    ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${
                    selectedGateway === 'kobara' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    KBR
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs sm:text-sm font-black text-slate-900">
                        Passerelle Unifiée Kobara
                      </h4>
                      <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded font-bold">
                        MonCash & Natcash
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Bearer Secret • Webhooks HMAC • Routage Économat
                    </p>
                  </div>
                </div>
                {selectedGateway === 'kobara' && (
                  <CheckCircle2 size={18} className="text-indigo-600 shrink-0" />
                )}
              </div>
            </div>

            {/* SOUS-CHOIX OPÉRATEUR POUR KOBARA */}
            {selectedGateway === 'kobara' && (
              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between flex-wrap gap-2 text-xs">
                <span className="text-slate-600 font-medium">
                  Opérateur simulé via Kobara :
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedOperator('moncash')}
                    className={`px-3 py-1 rounded-lg font-bold text-xs border transition-all cursor-pointer ${
                      selectedOperator === 'moncash'
                        ? 'bg-rose-50 border-rose-400 text-rose-700 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    MonCash (Digicel)
                  </button>
                  <button
                    onClick={() => setSelectedOperator('natcash')}
                    className={`px-3 py-1 rounded-lg font-bold text-xs border transition-all cursor-pointer ${
                      selectedOperator === 'natcash'
                        ? 'bg-indigo-50 border-indigo-400 text-indigo-700 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    Natcash (Natcom)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ONGLET 1 : DIAGNOSTIC & RAPPORT EN TEMPS RÉEL */}
          {activeTab === 'diagnostic' && (
            <div className="space-y-4">
              
              {/* BOUTON D'ACTION PRINCIPAL DE LANCEMENT DU DIAGNOSTIC */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-900 to-indigo-900 p-3.5 sm:p-4 rounded-xl text-white shadow-md">
                <div className="space-y-0.5 min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold flex items-center gap-2 text-white">
                    <Sparkles size={16} className="text-amber-400 shrink-0" />
                    <span>Lancer la vérification en temps réel</span>
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-300">
                    Interroge en direct l'API {selectedGateway === 'moncash' ? 'Digicel MonCash' : 'Kobara'} avec les identifiants de l'établissement sans modifier les soldes élèves.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleRunDiagnostic}
                  disabled={running}
                  className="w-full sm:w-auto px-4 py-2 sm:py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
                >
                  {running ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Test en cours...</span>
                    </>
                  ) : (
                    <>
                      <Play size={15} className="fill-slate-950" />
                      <span>Diagnostiquer Maintenant</span>
                    </>
                  )}
                </button>
              </div>

              {/* RÉSULTAT DU DIAGNOSTIC */}
              {diagnosticResult ? (
                <div className="space-y-3.5 animate-in fade-in duration-300">
                  
                  {/* BARRE DE SYNTHÈSE DE SANTÉ */}
                  <div className={`p-4 rounded-xl border flex items-center justify-between flex-wrap gap-3 ${
                    diagnosticResult.success
                      ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                      : 'bg-amber-50/80 border-amber-300 text-amber-950'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        diagnosticResult.success ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                      }`}>
                        {diagnosticResult.success ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black">
                            {diagnosticResult.success
                              ? `Passerelle ${selectedGateway.toUpperCase()} 100% Opérationnelle`
                              : `Configuration ${selectedGateway.toUpperCase()} à réviser`}
                          </h4>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            diagnosticResult.success
                              ? 'bg-emerald-200 text-emerald-900'
                              : 'bg-amber-200 text-amber-900'
                          }`}>
                            {diagnosticResult.overall_status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {diagnosticResult.student_impact?.message}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      {diagnosticResult.latency_ms !== undefined && (
                        <div className="bg-white/80 px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono text-[11px] flex items-center gap-1.5">
                          <Clock size={12} className="text-indigo-600" />
                          <span>Latence: <strong>{diagnosticResult.latency_ms} ms</strong></span>
                        </div>
                      )}
                      <button
                        onClick={() => handleCopy(JSON.stringify(diagnosticResult, null, 2), 'diag_full')}
                        className="bg-white hover:bg-slate-100 text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        {copiedKey === 'diag_full' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                        <span>Copier Rapport</span>
                      </button>
                    </div>
                  </div>

                  {/* LISTE DES CONTRÔLES DE CONFORMITÉ */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle size={14} className="text-indigo-600" />
                      <span>Détail des 6 Points de Contrôle de Conformité</span>
                    </h4>

                    <div className="grid grid-cols-1 gap-2">
                      {diagnosticResult.checks?.map((check: GatewayDiagnosticCheck, idx: number) => {
                        const isPass = check.status === 'pass';
                        const isWarn = check.status === 'warn';
                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border flex items-start gap-3 transition-all ${
                              isPass 
                                ? 'bg-white border-slate-200/90' 
                                : isWarn 
                                  ? 'bg-amber-50/50 border-amber-200' 
                                  : 'bg-rose-50/50 border-rose-200'
                            }`}
                          >
                            <div className="mt-0.5 shrink-0">
                              {isPass ? (
                                <CheckCircle2 size={17} className="text-emerald-600" />
                              ) : isWarn ? (
                                <AlertTriangle size={17} className="text-amber-600" />
                              ) : (
                                <XCircle size={17} className="text-rose-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <h5 className="text-xs font-black text-slate-900 truncate">
                                  {check.name}
                                </h5>
                                <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                  isPass 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : isWarn 
                                      ? 'bg-amber-100 text-amber-800' 
                                      : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {check.status}
                                </span>
                              </div>
                              <p className="text-xs text-slate-700 mt-0.5">
                                {check.message}
                              </p>
                              {check.details && (
                                <p className="text-[11px] text-slate-500 font-mono mt-0.5 break-all">
                                  {check.details}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ACCORDÉON PAYLOAD DE SIMULATION TECHNIQUE */}
                  {diagnosticResult.simulated_payload && (
                    <div className="bg-slate-900 rounded-xl overflow-hidden text-slate-200 border border-slate-800">
                      <button
                        onClick={() => setShowPayload(prev => !prev)}
                        className="w-full p-3 flex items-center justify-between text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Terminal size={14} className="text-emerald-400" />
                          <span>Payload JSON de Simulation & Traces d'Exécution</span>
                        </div>
                        {showPayload ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>

                      {showPayload && (
                        <div className="p-3 pt-0 border-t border-slate-800">
                          <pre className="text-[11px] font-mono bg-slate-950 p-2.5 rounded-lg overflow-x-auto text-emerald-400 max-h-48">
                            {JSON.stringify(diagnosticResult.simulated_payload, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              ) : (
                /* ÉTAT INITIAL SANS ENCORE DE RÉSULTAT */
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100">
                    <Activity size={24} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Prêt pour le diagnostic en temps réel
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Cliquez sur <strong>Diagnostiquer Maintenant</strong> pour vérifier l'état des clés d'API auprès des serveurs distants en préservant à 100% les soldes élèves.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ONGLET 2 : PARAMÈTRES DE LA TRANSACTION DE TEST */}
          {activeTab === 'simulation' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders size={14} className="text-purple-600" />
                  <span>Personnalisation de la Transaction de Test</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* MONTANT DE TEST */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      Montant du test (HTG)
                    </label>
                    <input
                      type="number"
                      min={20}
                      step={10}
                      value={testAmount}
                      onChange={e => setTestAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      placeholder="Ex: 250"
                    />
                    <p className="text-[10px] text-slate-500">
                      Montant fictif pour tester la création d'ordre ou la notification webhook.
                    </p>
                  </div>

                  {/* TÉLÉPHONE PAYEUR DE TEST */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      Téléphone émetteur simulé
                    </label>
                    <input
                      type="text"
                      value={testPhone}
                      onChange={e => setTestPhone(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-mono"
                      placeholder="Ex: 50937889900"
                    />
                    <p className="text-[10px] text-slate-500">
                      Numéro test (MonCash: 50937... • Natcash: 50922...)
                    </p>
                  </div>
                </div>

                {/* ÉLÈVE TÉMOIN OPTIONNEL */}
                <div className="space-y-1 pt-2 border-t border-slate-200/80">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <UserCheck size={14} className="text-emerald-600" />
                      <span>Élève témoin pour métadonnées (Optionnel)</span>
                    </label>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Zéro Impact Solde Garanti
                    </span>
                  </div>
                  <select
                    value={selectedStudentId}
                    onChange={e => setSelectedStudentId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer"
                  >
                    <option value="">-- Aucun élève rattaché (Paiement général anonyme) --</option>
                    {studentsList.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.class})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500">
                    Permet uniquement de vérifier que les champs métadonnées (nom, identifiant élève) sont correctement transmis au webhook sans toucher aux finances de cet élève.
                  </p>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => {
                      setActiveTab('diagnostic');
                      handleRunDiagnostic();
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Play size={13} />
                    <span>Appliquer et Lancer le Diagnostic</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ONGLET 3 : JOURNAL D'AUDIT DU TENANT */}
          {activeTab === 'audit' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Historique des Simulations & Diagnostics du Tenant
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Traçabilité en mémoire des vérifications et tests exécutés pour {schoolDisplayName}.
                  </p>
                </div>
                <button
                  onClick={fetchAuditLogs}
                  disabled={loadingLogs}
                  className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw size={12} className={loadingLogs ? 'animate-spin' : ''} />
                  <span>Actualiser</span>
                </button>
              </div>

              {auditLogs.length > 0 ? (
                <div className="space-y-2">
                  {auditLogs.map((log: any, index: number) => (
                    <div
                      key={log.id || index}
                      className="p-3 bg-white rounded-xl border border-slate-200 text-xs flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[9.5px] font-black px-1.5 py-0.2 rounded uppercase ${
                            log.status === 'VALIDE' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {log.status}
                          </span>
                          <span className="font-bold text-slate-900">
                            {log.gateway ? String(log.gateway).toUpperCase() : 'GATEWAY'} • {log.operator ? String(log.operator).toUpperCase() : ''}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 truncate">
                          {log.notes || 'Simulation isolée'}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-black text-slate-900">
                          {log.amount} {log.currency || 'HTG'}
                        </span>
                        <div className="text-[10px] text-emerald-600 font-bold">
                          Zéro Impact
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  Aucun log de simulation enregistré pour le moment. Lancez un diagnostic pour peupler l'historique.
                </div>
              )}
            </div>
          )}

        </div>

        {/* PIED DE MODALE */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Partition Multi-Tenant active & isolée</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={handleRunDiagnostic}
              disabled={running}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={running ? 'animate-spin' : ''} />
              <span>Relancer Test</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
