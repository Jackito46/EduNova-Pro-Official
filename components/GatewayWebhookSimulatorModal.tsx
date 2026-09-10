import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Radio, 
  Smartphone, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Copy, 
  Check, 
  RefreshCw, 
  Play, 
  FileText, 
  Terminal, 
  Layers, 
  Trash2, 
  HelpCircle, 
  Info, 
  CheckCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { supabase } from '../supabase';

interface GatewayWebhookSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  onSimulationSuccess?: () => void;
  initialOperator?: 'moncash' | 'natcash';
  initialStudentId?: string;
  initialAmount?: number;
  initialFeeType?: string;
}

interface WebhookAuditLog {
  id: string;
  timestamp: string;
  school_id?: string;
  gateway: 'kobara' | 'moncash';
  operator: 'moncash' | 'natcash';
  event_type: string;
  order_id?: string;
  transaction_id?: string;
  amount: number;
  currency: string;
  payer_phone?: string;
  receiver_phone?: string;
  receiver_mode?: 'single_unified' | 'separated_operator';
  signature_status?: 'valid' | 'invalid' | 'missing' | 'simulated';
  persisted_to_db: boolean;
  http_status: number;
  simulated: boolean;
  status: 'VALIDE' | 'EN_ATTENTE' | 'ECHOUE';
  notes?: string;
  raw_payload?: any;
  student_name?: string;
}

interface GatewayConfig {
  secret_key: string;
  webhook_secret: string;
  receiver_phone: string;
  receiver_phone_moncash: string;
  receiver_phone_natcash: string;
  same_receiver_number: boolean;
  auto_payout: boolean;
  receiver_name: string;
  receiver_operator: string;
  mode: string;
}

export const GatewayWebhookSimulatorModal: React.FC<GatewayWebhookSimulatorModalProps> = ({
  isOpen,
  onClose,
  schoolId,
  onSimulationSuccess,
  initialOperator,
  initialStudentId,
  initialAmount,
  initialFeeType
}) => {
  // Config & state
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [gatewayConfig, setGatewayConfig] = useState<GatewayConfig | null>(null);

  // Form state
  const [operator, setOperator] = useState<'moncash' | 'natcash'>(initialOperator || 'moncash');
  const [eventType, setEventType] = useState<'payment.succeeded' | 'payment.pending' | 'payment.failed'>('payment.succeeded');
  const [amount, setAmount] = useState<number>(initialAmount || 2500);
  const [currency] = useState<'HTG' | 'USD'>('HTG');
  const [payerPhone, setPayerPhone] = useState<string>('50937123456');
  const [orderId, setOrderId] = useState<string>(() => `ORD-SIM-${Math.floor(100000 + Math.random() * 900000)}`);
  const [transactionId, setTransactionId] = useState<string>(() => `TX-SIM-${Math.floor(100000 + Math.random() * 900000)}`);
  const [feeType, setFeeType] = useState<string>(initialFeeType || 'SCOLARITE');
  const [signValid, setSignValid] = useState<boolean>(true);
  const [persist, setPersist] = useState<boolean>(true);

  // Student selection
  const [students, setStudents] = useState<Array<{ id: string; first_name: string; last_name: string; matricule?: string; class_name?: string }>>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);

  // Execution state
  const [simulating, setSimulating] = useState(false);
  const [lastResult, setLastResult] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'audit' | 'payload' | 'headers' | 'history'>('audit');
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Logs
  const [auditLogs, setAuditLogs] = useState<WebhookAuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Fetch gateway configuration for school
  const fetchGatewayConfig = useCallback(async () => {
    if (!schoolId) return;
    setLoadingConfig(true);
    try {
      const res = await fetch(`/api/settings/api-credentials?school_id=${schoolId}`);
      const data = await res.json();
      if (data.success && data.credentials?.kobara) {
        setGatewayConfig(data.credentials.kobara);
      }
    } catch (e) {
      console.warn('Erreur récupération configuration passerelle:', e);
    } finally {
      setLoadingConfig(false);
    }
  }, [schoolId]);

  // Fetch recent logs
  const fetchLogs = useCallback(async () => {
    if (!schoolId) return;
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/webhooks/logs?school_id=${schoolId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        setAuditLogs(data.logs);
      }
    } catch (e) {
      console.warn('Erreur récupération logs webhooks:', e);
    } finally {
      setLoadingLogs(false);
    }
  }, [schoolId]);

  // Search students for association
  useEffect(() => {
    if (!schoolId || !isOpen) return;
    const loadStudents = async () => {
      setLoadingStudents(true);
      try {
        const { data } = await supabase
          .from('students')
          .select('id, first_name, last_name, matricule, current_classroom')
          .eq('school_id', schoolId)
          .limit(20);
        if (data) {
          setStudents(data.map(s => ({
            id: s.id,
            first_name: s.first_name,
            last_name: s.last_name,
            matricule: s.matricule,
            class_name: s.current_classroom
          })));
        }
      } catch (e) {
        console.warn('Erreur chargement élèves:', e);
      } finally {
        setLoadingStudents(false);
      }
    };
    loadStudents();
  }, [schoolId, isOpen]);

  useEffect(() => {
    if (isOpen && schoolId) {
      if (initialOperator) setOperator(initialOperator);
      if (initialStudentId) setSelectedStudentId(initialStudentId);
      if (initialAmount) setAmount(initialAmount);
      if (initialFeeType) setFeeType(initialFeeType);
      fetchGatewayConfig();
      fetchLogs();
    }
  }, [isOpen, schoolId, initialOperator, initialStudentId, initialAmount, initialFeeType, fetchGatewayConfig, fetchLogs]);

  // Regenerate identifiers
  const regenerateIds = () => {
    const rand = Math.floor(100000 + Math.random() * 900000);
    setOrderId(`ORD-SIM-${rand}`);
    setTransactionId(`TX-SIM-${rand}`);
  };

  // Run simulation
  const handleRunSimulation = async () => {
    if (!schoolId) return;
    setSimulating(true);
    setLastResult(null);

    try {
      const payload = {
        school_id: schoolId,
        gateway: 'kobara',
        operator,
        event_type: eventType,
        amount: Number(amount) || 0,
        currency,
        payer_phone: payerPhone,
        order_id: orderId,
        transaction_id: transactionId,
        student_id: selectedStudentId || undefined,
        fee_type: feeType,
        sign_valid: signValid,
        persist,
        description: `Simulation Webhook Économat • ${operator === 'natcash' ? 'Natcash' : 'MonCash'}`
      };

      const res = await fetch('/api/webhooks/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      setLastResult(data);

      // Refresh logs
      fetchLogs();

      // If persistent and success, notify parent to refresh financial stats
      if (data.success && persist && eventType === 'payment.succeeded' && onSimulationSuccess) {
        onSimulationSuccess();
      }

      // Generate new IDs for next test
      regenerateIds();
    } catch (err: any) {
      setLastResult({
        success: false,
        http_status: 500,
        error: err.message || 'Échec de la simulation de notification'
      });
    } finally {
      setSimulating(false);
    }
  };

  // Replay a log item
  const handleReplayLog = (log: WebhookAuditLog) => {
    setOperator(log.operator);
    setEventType(log.event_type as any);
    setAmount(log.amount);
    setPayerPhone(log.payer_phone || '50937123456');
    regenerateIds();
    setActiveTab('audit');
  };

  // Clear logs
  const handleClearLogs = async () => {
    if (!confirm('Êtes-vous sûr de vouloir réinitialiser l\'historique des simulations ?')) return;
    try {
      await fetch('/api/webhooks/logs/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: schoolId })
      });
      setAuditLogs([]);
    } catch (e) {
      console.warn('Erreur purge logs:', e);
    }
  };

  if (!isOpen) return null;

  // Resolve target receiver phone according to fusion logic
  const isSameReceiver = gatewayConfig ? gatewayConfig.same_receiver_number : true;
  const resolvedReceiverNumber = gatewayConfig 
    ? (isSameReceiver 
        ? (gatewayConfig.receiver_phone || gatewayConfig.receiver_phone_moncash || 'Non configuré')
        : (operator === 'natcash' 
            ? (gatewayConfig.receiver_phone_natcash || 'Non configuré') 
            : (gatewayConfig.receiver_phone_moncash || gatewayConfig.receiver_phone || 'Non configuré')))
    : 'Chargement...';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 p-4 sm:p-5 text-white flex items-center justify-between relative shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
              <Radio size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  Simulateur de Webhook & Passerelles
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/30 text-purple-200 border border-purple-400/30">
                  MonCash & Natcash
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Test en direct de la réception des notifications et validation de la logique de passerelle unifiée
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* DIAGNOSTIC BANNER: GATEWAY FUSION STATUS */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Layers size={14} className="text-indigo-600" />
              <span className="text-slate-500 font-medium">Architecture :</span>
              <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                Passerelle Unifiée Kobara
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Smartphone size={14} className="text-purple-600" />
              <span className="text-slate-500 font-medium">Logique Récepteur :</span>
              <span className={`font-bold px-2 py-0.5 rounded border ${
                isSameReceiver 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                  : 'bg-indigo-50 text-indigo-800 border-indigo-200'
              }`}>
                {isSameReceiver ? 'Numéro Unique Coïncident' : 'Numéros Séparés (MonCash/Natcash)'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Compte récepteur actif :</span>
              <span className="font-mono font-bold text-slate-800 bg-slate-200/70 px-2 py-0.5 rounded">
                {loadingConfig ? 'Chargement...' : resolvedReceiverNumber}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-emerald-700 font-bold text-[11px]">Serveur Écoute Active (POST /api/webhooks/kobara)</span>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="overflow-y-auto p-4 sm:p-5 space-y-5 flex-1">

          {/* MAIN FORM GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

            {/* LEFT COLUMN: SIMULATION FORM */}
            <div className="lg:col-span-6 space-y-4">
              
              {/* OPERATOR TOGGLE */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  1. Choisir l'opérateur mobile
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setOperator('moncash')}
                    className={`p-3 rounded-xl border-2 text-left transition-all flex items-center justify-between ${
                      operator === 'moncash'
                        ? 'border-rose-500 bg-rose-50 text-rose-950 shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-black text-sm flex items-center gap-1.5 text-rose-700">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                        MonCash
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">Digicel Haïti</div>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                      HTG
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOperator('natcash')}
                    className={`p-3 rounded-xl border-2 text-left transition-all flex items-center justify-between ${
                      operator === 'natcash'
                        ? 'border-sky-500 bg-sky-50 text-sky-950 shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-black text-sm flex items-center gap-1.5 text-sky-700">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-600" />
                        Natcash
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">Natcom Haïti</div>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800">
                      HTG
                    </span>
                  </button>
                </div>
              </div>

              {/* EVENT STATUS SELECTION */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  2. Statut de la notification
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEventType('payment.succeeded')}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-bold transition-all text-center ${
                      eventType === 'payment.succeeded'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Succès (200)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEventType('payment.pending')}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-bold transition-all text-center ${
                      eventType === 'payment.pending'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    En Attente
                  </button>
                  <button
                    type="button"
                    onClick={() => setEventType('payment.failed')}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-bold transition-all text-center ${
                      eventType === 'payment.failed'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Échoué
                  </button>
                </div>
              </div>

              {/* AMOUNT & PRESETS */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    3. Montant du paiement
                  </label>
                  <div className="flex gap-1">
                    {[500, 1500, 3000, 7500].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAmount(val)}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          amount === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {val} G
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full pl-3 pr-14 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    placeholder="2500"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                    HTG
                  </div>
                </div>
              </div>

              {/* STUDENT ATTACHMENT */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  4. Associer à un élève (Facultatif)
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  <option value="">-- Aucun élève (Paiement général anonyme) --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.first_name} {s.last_name} {s.matricule ? `(${s.matricule})` : ''} {s.class_name ? `• ${s.class_name}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Si associé, le versement sera automatiquement crédité sur la fiche comptable de l'élève.
                </p>
              </div>

              {/* PAYER PHONE & NATURE */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Numéro Payeur
                  </label>
                  <input
                    type="text"
                    value={payerPhone}
                    onChange={(e) => setPayerPhone(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    placeholder="50937123456"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Type de Frais
                  </label>
                  <select
                    value={feeType}
                    onChange={(e) => setFeeType(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-800 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    <option value="SCOLARITE">Scolarité / Écolage</option>
                    <option value="INSCRIPTION">Inscription</option>
                    <option value="FOURNITURES">Fournitures</option>
                    <option value="DIVERS">Frais Divers</option>
                  </select>
                </div>
              </div>

              {/* SECURITY & PERSISTENCE TOGGLES */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className={signValid ? 'text-emerald-600' : 'text-amber-500'} />
                    <div>
                      <div className="text-xs font-bold text-slate-800">Signature Webhook HMAC-SHA256</div>
                      <div className="text-[10px] text-slate-500">
                        {signValid ? 'Signature valide calculée' : 'Simulation d\'une signature altérée (Test Rejet)'}
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={signValid}
                    onChange={(e) => setSignValid(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className={persist ? 'text-indigo-600' : 'text-slate-400'} />
                    <div>
                      <div className="text-xs font-bold text-slate-800">Enregistrer dans l'Économat</div>
                      <div className="text-[10px] text-slate-500">
                        {persist ? 'Crédite la caisse et la scolarité de l\'élève' : 'Mode test à blanc (Dry-Run)'}
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={persist}
                    onChange={(e) => setPersist(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* TRIGGER BUTTON */}
              <button
                type="button"
                onClick={handleRunSimulation}
                disabled={simulating}
                className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-sm rounded-xl shadow-md hover:shadow-purple-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
              >
                {simulating ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>Envoi du Webhook et Vérification...</span>
                  </>
                ) : (
                  <>
                    <Play size={18} />
                    <span>Déclencher le Webhook {operator === 'natcash' ? 'Natcash' : 'MonCash'}</span>
                  </>
                )}
              </button>
            </div>

            {/* RIGHT COLUMN: INSPECTOR & RESULTS */}
            <div className="lg:col-span-6 flex flex-col space-y-3 bg-slate-900 text-slate-100 p-4 rounded-xl border border-slate-800 min-h-[380px]">
              
              {/* TABS */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveTab('audit')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                      activeTab === 'audit' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Rapport de Fusion
                  </button>
                  <button
                    onClick={() => setActiveTab('payload')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                      activeTab === 'payload' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Payload JSON
                  </button>
                  <button
                    onClick={() => setActiveTab('headers')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                      activeTab === 'headers' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Headers HTTP
                  </button>
                  <button
                    onClick={() => setActiveTab('history')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                      activeTab === 'history' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Historique ({auditLogs.length})
                  </button>
                </div>

                {lastResult && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(lastResult, null, 2));
                      setCopiedPayload(true);
                      setTimeout(() => setCopiedPayload(false), 2000);
                    }}
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedPayload ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{copiedPayload ? 'Copié' : 'Copier'}</span>
                  </button>
                )}
              </div>

              {/* TAB CONTENT: AUDIT / DIAGNOSTIC */}
              {activeTab === 'audit' && (
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                  {lastResult ? (
                    <div className="space-y-3">
                      {/* STATUS BANNER */}
                      <div className={`p-3 rounded-xl border flex items-start gap-3 ${
                        lastResult.success && lastResult.diagnostic?.security?.signature_valid
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                          : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                      }`}>
                        {lastResult.success && lastResult.diagnostic?.security?.signature_valid ? (
                          <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle size={20} className="text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="font-black text-sm text-white">
                            HTTP {lastResult.http_status} • {lastResult.message || 'Notification traitée'}
                          </div>
                          <div className="text-[11px] opacity-90 mt-0.5">
                            Passerelle : {lastResult.diagnostic?.gateway_tested}
                          </div>
                        </div>
                      </div>

                      {/* KEY CHECKS */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* Receiver Resolution Check */}
                        <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                          <div className="text-[10px] text-slate-400 uppercase font-bold">1. Compte Récepteur</div>
                          <div className="font-bold text-white mt-1">
                            {lastResult.diagnostic?.receiver_resolution?.resolved_phone || 'Non configuré'}
                          </div>
                          <div className="text-[10px] text-purple-300 mt-0.5">
                            Mode : {lastResult.diagnostic?.receiver_resolution?.mode_label}
                          </div>
                        </div>

                        {/* Signature Check */}
                        <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                          <div className="text-[10px] text-slate-400 uppercase font-bold">2. Contrôle de Sécurité</div>
                          <div className="font-bold text-white mt-1 flex items-center gap-1">
                            {lastResult.diagnostic?.security?.signature_valid ? (
                              <span className="text-emerald-400 flex items-center gap-1">
                                <Check size={12} /> HMAC-SHA256 Valide
                              </span>
                            ) : (
                              <span className="text-rose-400 flex items-center gap-1">
                                <X size={12} /> Signature Altérée
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Secret : {lastResult.diagnostic?.security?.webhook_secret_configured ? 'Configuré' : 'Test Défaut'}
                          </div>
                        </div>

                        {/* Accounting Check */}
                        <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                          <div className="text-[10px] text-slate-400 uppercase font-bold">3. Écriture Comptable</div>
                          <div className="font-bold text-white mt-1">
                            {lastResult.diagnostic?.accounting?.persisted_to_payments ? (
                              <span className="text-emerald-400 flex items-center gap-1">
                                <Check size={12} /> Enregistré en Caisse
                              </span>
                            ) : (
                              <span className="text-slate-400">Mode Dry-Run (Non écrit)</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Montant : {lastResult.diagnostic?.accounting?.amount} HTG
                          </div>
                        </div>

                        {/* Student Link Check */}
                        <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                          <div className="text-[10px] text-slate-400 uppercase font-bold">4. Fiche Élève</div>
                          <div className="font-bold text-white mt-1 truncate">
                            {lastResult.diagnostic?.accounting?.student_name}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            ID : {lastResult.diagnostic?.accounting?.student_id || 'Général'}
                          </div>
                        </div>
                      </div>

                      {/* EXPLANATION NOTE */}
                      <div className="p-2.5 bg-slate-800/50 rounded-lg border border-slate-700/60 text-slate-300 text-[11px] leading-relaxed">
                        <span className="font-bold text-white">Vérification de fusion : </span>
                        {lastResult.diagnostic?.receiver_resolution?.configured_mode === 'single_unified' ? (
                          <span>
                            Le même numéro récepteur centralisé ({lastResult.diagnostic?.receiver_resolution?.resolved_phone}) collecte à la fois les flux MonCash et Natcash sans divergence.
                          </span>
                        ) : (
                          <span>
                            L'opérateur ({lastResult.diagnostic?.operator}) est routé vers son compte récepteur dédié ({lastResult.diagnostic?.receiver_resolution?.resolved_phone}).
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
                      <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-purple-400">
                        <Terminal size={24} />
                      </div>
                      <div className="font-bold text-slate-200">Prêt pour la simulation</div>
                      <p className="text-xs max-w-sm text-slate-400">
                        Sélectionnez l'opérateur (MonCash ou Natcash), paramétrez le test puis cliquez sur "Déclencher le Webhook" pour tester la logique de fusion.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB CONTENT: PAYLOAD JSON */}
              {activeTab === 'payload' && (
                <div className="flex-1 overflow-auto">
                  <pre className="font-mono text-[11px] text-slate-300 p-2 bg-slate-950 rounded border border-slate-800 overflow-x-auto">
                    {lastResult?.payload_sent 
                      ? JSON.stringify(lastResult.payload_sent, null, 2)
                      : '// Le payload JSON généré apparaîtra ici après le déclenchement.'}
                  </pre>
                </div>
              )}

              {/* TAB CONTENT: HEADERS */}
              {activeTab === 'headers' && (
                <div className="flex-1 overflow-auto">
                  <pre className="font-mono text-[11px] text-slate-300 p-2 bg-slate-950 rounded border border-slate-800 overflow-x-auto">
                    {lastResult?.headers_simulated 
                      ? JSON.stringify(lastResult.headers_simulated, null, 2)
                      : '// Les en-têtes HTTP de la notification apparaîtront ici.'}
                  </pre>
                </div>
              )}

              {/* TAB CONTENT: AUDIT LOGS HISTORY */}
              {activeTab === 'history' && (
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-[11px]">
                    <span className="text-slate-400">{auditLogs.length} événements récents</span>
                    {auditLogs.length > 0 && (
                      <button
                        onClick={handleClearLogs}
                        className="text-rose-400 hover:text-rose-300 flex items-center gap-1 font-medium"
                      >
                        <Trash2 size={12} /> Purger
                      </button>
                    )}
                  </div>

                  {auditLogs.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs">
                      Aucune notification simulée ou reçue pour le moment.
                    </div>
                  ) : (
                    auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 bg-slate-800/80 rounded-lg border border-slate-700/80 flex items-center justify-between gap-2 hover:bg-slate-800 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                              log.operator === 'natcash' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}>
                              {log.operator}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              log.status === 'VALIDE' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                            }`}>
                              {log.amount} HTG
                            </span>
                            {log.simulated && (
                              <span className="px-1 py-0.2 rounded text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                SIM
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">
                            Réf: {log.order_id} • {new Date(log.timestamp).toLocaleTimeString()} {log.student_name ? `• ${log.student_name}` : ''}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleReplayLog(log)}
                          className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold shrink-0 transition-colors"
                        >
                          Rejouer
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

            </div>

          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="bg-slate-100 border-t border-slate-200 px-4 sm:px-5 py-3 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <div className="flex items-center gap-2">
            <Info size={14} className="text-purple-600" />
            <span>
              Les tests confirment le routage des notifications avant le passage en production réelle.
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg transition-colors"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};
