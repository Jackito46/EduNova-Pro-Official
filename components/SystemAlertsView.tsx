import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ShieldAlert, AlertTriangle, RefreshCw, CheckCircle2, XCircle, 
  Search, Filter, ShieldCheck, Download, Bell, BellOff,
  Clock, Database, Lock, UserX, Activity, Info, Eye, 
  Trash2, Radio, Zap, AlertCircle, ArrowUpRight, Check,
  Server, Laptop, Globe, Key, Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import { UserProfile } from '../types';

interface SystemAlertsViewProps {
  user: UserProfile;
}

export interface SystemAlertItem {
  id: string;
  created_at: string;
  category: 'SYNC_ERROR' | 'LOGIN_FAILURE' | 'UNAUTHORIZED_ACCESS';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  user_name?: string;
  user_email?: string;
  user_id?: string;
  user_role?: string;
  school_id?: string;
  school_name?: string;
  ip_address?: string;
  user_agent?: string;
  failure_reason?: string;
  attempt_count?: number;
  details?: Record<string, any>;
  status: 'UNRESOLVED' | 'RESOLVED';
  resolved_at?: string;
  resolved_by?: string;
}

export const SystemAlertsView: React.FC<SystemAlertsViewProps> = ({ user }) => {
  const [alerts, setAlerts] = useState<SystemAlertItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRealtimeActive, setIsRealtimeActive] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [selectedAlert, setSelectedAlert] = useState<SystemAlertItem | null>(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'SYNC_ERROR' | 'LOGIN_FAILURE' | 'UNAUTHORIZED_ACCESS'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'INFO'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNRESOLVED' | 'RESOLVED'>('UNRESOLVED');
  const [timeRange, setTimeRange] = useState<'1H' | '24H' | '7D' | 'ALL'>('24H');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Simulation Modal State
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState<boolean>(false);
  const [simType, setSimType] = useState<'SYNC_ERROR' | 'LOGIN_FAILURE' | 'UNAUTHORIZED_ACCESS'>('SYNC_ERROR');
  const [simSeverity, setSimSeverity] = useState<'CRITICAL' | 'WARNING' | 'INFO'>('CRITICAL');
  const [simCustomMsg, setSimCustomMsg] = useState<string>('');
  const [simUserName, setSimUserName] = useState<string>('Jean-Michel Dupont');
  const [simUserEmail, setSimUserEmail] = useState<string>('compta.dupont@univ-excellence.edu');
  const [simUserRole, setSimUserRole] = useState<string>('COMPTABLE');
  const [simFailureReason, setSimFailureReason] = useState<string>('Mot de passe erroné (5 tentatives consécutives)');
  const [simAttempts, setSimAttempts] = useState<number>(5);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Connection Metrics
  const [latencyMs, setLatencyMs] = useState<number>(42);
  const [supabaseStatus, setSupabaseStatus] = useState<'CONNECTED' | 'DEGRADED' | 'DISCONNECTED'>('CONNECTED');

  // Map raw audit log to alert item
  const mapAuditToAlert = (item: any): SystemAlertItem => {
    const actionUpper = (item.action || '').toUpperCase();
    const details = item.details || {};
    
    let category: 'SYNC_ERROR' | 'LOGIN_FAILURE' | 'UNAUTHORIZED_ACCESS' = 'SYNC_ERROR';
    let severity: 'CRITICAL' | 'WARNING' | 'INFO' = 'INFO';
    let isRealIncident = false;
    let title = item.action || 'Événement système';

    // 1. Genuine Auth & Login Failures
    if (
      actionUpper.includes('LOGIN_FAILED') || 
      actionUpper.includes('FAILED_LOGIN') || 
      actionUpper.includes('AUTH_ERROR') || 
      details.type === 'LOGIN_FAILURE'
    ) {
      category = 'LOGIN_FAILURE';
      severity = details.severity || 'WARNING';
      title = 'Échec d\'authentification';
      isRealIncident = true;
    } 
    // 2. Genuine Unauthorized Access & Security RLS Violations
    else if (
      actionUpper.includes('UNAUTHORIZED_ACCESS') || 
      actionUpper.includes('RLS_VIOLATION') || 
      actionUpper.includes('SECURITY_BREACH') || 
      actionUpper.includes('SECURITY_ALERT') || 
      actionUpper.includes('BLOCKED_USER') || 
      details.type === 'UNAUTHORIZED_ACCESS'
    ) {
      category = 'UNAUTHORIZED_ACCESS';
      severity = details.severity || 'CRITICAL';
      title = 'Tentative d\'accès non autorisée (RLS)';
      isRealIncident = true;
    } 
    // 3. Genuine Sync & Database Failures
    else if (
      actionUpper.includes('SYNC_ERROR') || 
      actionUpper.includes('BACKUP_FAILED') || 
      actionUpper.includes('DATABASE_ERROR') || 
      actionUpper.includes('TRANSACTION_FAILED') || 
      actionUpper.includes('CRITICAL_ERROR') || 
      details.type === 'SYNC_ERROR' ||
      details.error
    ) {
      category = 'SYNC_ERROR';
      severity = details.severity || 'CRITICAL';
      title = 'Erreur critique de synchronisation';
      isRealIncident = true;
    } 
    // 4. Standard Operational Audit Events (Normal Operations)
    else {
      isRealIncident = false;
      severity = 'INFO';
      if (actionUpper.includes('LOGIN') || actionUpper.includes('LOGOUT')) {
        category = 'LOGIN_FAILURE';
        title = `Connexion / Session : ${item.action}`;
      } else if (actionUpper.includes('PASSWORD') || actionUpper.includes('ROLE') || actionUpper.includes('REVOKE') || actionUpper.includes('UNBLOCK')) {
        category = 'UNAUTHORIZED_ACCESS';
        title = `Gestion Sécurité & Accès : ${item.action}`;
      } else {
        category = 'SYNC_ERROR';
        title = `Activité Système : ${item.action || 'Opération enregistrée'}`;
      }
    }

    if (details.severity) {
      severity = details.severity as any;
    }
    if (details.title) {
      title = details.title;
    }

    const description = details.message || details.error || details.reason || item.details?.type || `Action ${item.action} exécutée avec succès sur ${item.entity_type || 'le système'}`;

    // Extract detailed User Identity fields
    const userName = details.user_name || details.full_name || details.userName || details.name || details.target_user || details.target_name || item.user_name || (details.user_email ? details.user_email.split('@')[0].replace(/[._]/g, ' ') : (item.user_id ? `Utilisateur (${item.user_id.slice(0, 8)})` : 'Système EduNova'));
    
    const userRole = details.user_role || details.role || details.target_role || (actionUpper.includes('ADMIN') ? 'SUPER_ADMIN' : actionUpper.includes('COMPTA') ? 'COMPTABLE' : actionUpper.includes('DIRECTEUR') ? 'DIRECTEUR' : 'UTILISATEUR');

    const failureReason = details.failure_reason || details.reason || details.error || (isRealIncident ? (category === 'LOGIN_FAILURE' ? 'Mot de passe incorrect ou tentative d\'accès bloquée' : category === 'UNAUTHORIZED_ACCESS' ? 'Restriction de privilèges RLS' : 'Incident technique') : 'Opération normale');

    const attemptCount = details.attempt_count || details.attempts || 1;

    // A record is unresolved ONLY if it's an actual incident AND has not been marked resolved
    const isResolved = !isRealIncident || !!details.resolved;

    return {
      id: item.id || `alert-${Math.random()}`,
      created_at: item.created_at || details.timestamp || new Date().toISOString(),
      category,
      severity,
      title,
      description,
      user_name: userName,
      user_email: details.user_email || details.email || (item.user_id ? `user_${item.user_id.slice(0, 8)}@edunova.pro` : 'systeme@edunova.pro'),
      user_id: item.user_id,
      user_role: userRole,
      school_id: item.school_id,
      school_name: details.school_name || (item.school_id ? `Établissement ${item.school_id.slice(0, 6)}` : 'Système Global'),
      ip_address: details.ip_address || details.ip || 'Secured Internal IP',
      user_agent: details.userAgent || 'EduNova Security Subsystem',
      failure_reason: failureReason,
      attempt_count: attemptCount,
      details,
      status: isResolved ? 'RESOLVED' : 'UNRESOLVED',
      resolved_at: details.resolved_at,
      resolved_by: details.resolved_by
    };
  };

  // Main Fetch Function
  const fetchAlerts = useCallback(async () => {
    try {
      const startTime = performance.now();
      // Fetch recent security/error audit logs from Supabase
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      const endTime = performance.now();
      setLatencyMs(Math.round(endTime - startTime));

      if (error) {
        console.warn("Erreur de lecture audit_logs:", error);
        setSupabaseStatus('DEGRADED');
        setAlerts([]);
      } else {
        setSupabaseStatus('CONNECTED');
        const realAlerts: SystemAlertItem[] = (data || []).map(mapAuditToAlert);
        setAlerts(realAlerts);
      }

      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Erreur de récupération des alertes système:", err);
      setSupabaseStatus('DEGRADED');
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Set up initial load and Realtime / Polling listener
  useEffect(() => {
    fetchAlerts();

    // Setup periodic polling interval (every 8 seconds) for live updates
    const interval = setInterval(() => {
      if (isRealtimeActive) {
        fetchAlerts();
      }
    }, 8000);

    // Setup Supabase Realtime subscription on `audit_logs`
    let channel: any = null;
    try {
      channel = supabase
        .channel('system-alerts-realtime')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'audit_logs' },
          (payload) => {
            if (payload.new) {
              const newAlert = mapAuditToAlert(payload.new);
              setAlerts(prev => [newAlert, ...prev]);
              toast.error(`⚠️ Alerte Temps Réel : ${newAlert.title}`, {
                description: newAlert.description,
                duration: 5000
              });
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setIsRealtimeActive(true);
          }
        });
    } catch (e) {
      console.warn("Realtime subscription fallback to polling mode:", e);
    }

    return () => {
      clearInterval(interval);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchAlerts, isRealtimeActive]);

  // Simulate inserting a new alert
  const handleTriggerSimulatedAlert = async () => {
    setIsSimulating(true);
    try {
      const titlesMap = {
        SYNC_ERROR: 'Erreur critique de resynchronisation des notes',
        LOGIN_FAILURE: `Échecs de connexion répétés pour ${simUserName}`,
        UNAUTHORIZED_ACCESS: `Violation de sécurité RLS par ${simUserName}`
      };

      const defaultMsgs = {
        SYNC_ERROR: 'Échec lors de l\'écriture atomique dans la base de données. Transaction annulée.',
        LOGIN_FAILURE: `5 tentatives de connexion consécutives avec mot de passe erroné pour le compte ${simUserRole} (${simUserName}).`,
        UNAUTHORIZED_ACCESS: `L'utilisateur ${simUserName} (${simUserRole}) a tenté d'accéder à des données protégées de la table des bulletins.`
      };

      const title = titlesMap[simType];
      const message = simCustomMsg.trim() || defaultMsgs[simType];

      const newAlertPayload = {
        action: simType === 'LOGIN_FAILURE' ? 'FAILED_LOGIN' : simType === 'UNAUTHORIZED_ACCESS' ? 'UNAUTHORIZED_ACCESS' : 'SYNC_ERROR',
        entity_type: 'system',
        school_id: user.school_id,
        user_id: user.id,
        details: {
          type: simType,
          severity: simSeverity,
          title,
          message,
          user_name: simUserName,
          user_email: simUserEmail,
          role: simUserRole,
          failure_reason: simFailureReason,
          attempts: simAttempts,
          ip_address: '190.115.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250),
          userAgent: navigator.userAgent,
          simulated: true,
          timestamp: new Date().toISOString()
        }
      };

      // Try inserting into audit_logs table
      const { error } = await supabase
        .from('audit_logs')
        .insert([newAlertPayload]);

      if (error) {
        console.warn("Insertion Supabase audit_logs simulée en local:", error);
      }

      // Local state update immediately
      const createdAlertItem: SystemAlertItem = {
        id: `sim-${Date.now()}`,
        created_at: new Date().toISOString(),
        category: simType,
        severity: simSeverity,
        title,
        description: message,
        user_name: simUserName,
        user_email: simUserEmail,
        user_id: user.id,
        user_role: simUserRole,
        failure_reason: simFailureReason,
        attempt_count: simAttempts,
        school_name: 'Établissement Test (Simulateur)',
        ip_address: newAlertPayload.details.ip_address,
        user_agent: navigator.userAgent,
        details: newAlertPayload.details,
        status: 'UNRESOLVED'
      };

      setAlerts(prev => [createdAlertItem, ...prev]);
      setIsSimulateModalOpen(false);
      setSimCustomMsg('');
      toast.success("Alerte de test générée en temps réel !");
    } catch (err: any) {
      toast.error("Erreur lors de la simulation : " + (err.message || 'Erreur inconnue'));
    } finally {
      setIsSimulating(false);
    }
  };

  // Mark single alert as resolved
  const handleResolveAlert = (id: string) => {
    setAlerts(prev =>
      prev.map(a =>
        a.id === id
          ? {
              ...a,
              status: 'RESOLVED',
              resolved_at: new Date().toISOString(),
              resolved_by: user.email || 'Super Admin'
            }
          : a
      )
    );
    if (selectedAlert && selectedAlert.id === id) {
      setSelectedAlert(prev => prev ? { ...prev, status: 'RESOLVED', resolved_at: new Date().toISOString(), resolved_by: user.email || 'Super Admin' } : null);
    }
    toast.success("Alerte marquée comme résolue.");
  };

  // Resolve all alerts
  const handleResolveAll = () => {
    const nowIso = new Date().toISOString();
    const adminEmail = user.email || 'Super Admin';
    setAlerts(prev =>
      prev.map(a => ({
        ...a,
        status: 'RESOLVED',
        resolved_at: a.resolved_at || nowIso,
        resolved_by: a.resolved_by || adminEmail
      }))
    );
    toast.success("Toutes les alertes système ont été marquées comme résolues.");
  };

  // Export Alerts to JSON
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredAlerts, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `alertes-systeme-edunova-${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("Exportation JSON réussie.");
  };

  // Filter Logic
  const filteredAlerts = useMemo(() => {
    const now = new Date().getTime();

    return alerts.filter(item => {
      // Category filter
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;

      // Severity filter
      if (severityFilter !== 'ALL' && item.severity !== severityFilter) return false;

      // Status filter
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;

      // Time range filter
      const itemTime = new Date(item.created_at).getTime();
      if (timeRange === '1H' && now - itemTime > 60 * 60 * 1000) return false;
      if (timeRange === '24H' && now - itemTime > 24 * 60 * 60 * 1000) return false;
      if (timeRange === '7D' && now - itemTime > 7 * 24 * 60 * 60 * 1000) return false;

      // Search term
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(term);
        const matchDesc = item.description.toLowerCase().includes(term);
        const matchName = (item.user_name || '').toLowerCase().includes(term);
        const matchEmail = (item.user_email || '').toLowerCase().includes(term);
        const matchRole = (item.user_role || '').toLowerCase().includes(term);
        const matchReason = (item.failure_reason || '').toLowerCase().includes(term);
        const matchIp = (item.ip_address || '').toLowerCase().includes(term);
        const matchSchool = (item.school_name || '').toLowerCase().includes(term);
        return matchTitle || matchDesc || matchName || matchEmail || matchRole || matchReason || matchIp || matchSchool;
      }

      return true;
    });
  }, [alerts, categoryFilter, severityFilter, statusFilter, timeRange, searchTerm]);

  // Key Statistics - based on active unresolved incidents
  const stats = useMemo(() => {
    const total = alerts.length;
    const unresolved = alerts.filter(a => a.status === 'UNRESOLVED').length;
    const syncErrors = alerts.filter(a => a.category === 'SYNC_ERROR' && a.status === 'UNRESOLVED').length;
    const loginFailures = alerts.filter(a => a.category === 'LOGIN_FAILURE' && a.status === 'UNRESOLVED').length;
    const unauthorized = alerts.filter(a => a.category === 'UNAUTHORIZED_ACCESS' && a.status === 'UNRESOLVED').length;
    const criticals = alerts.filter(a => a.severity === 'CRITICAL' && a.status === 'UNRESOLVED').length;

    return {
      total,
      unresolved,
      syncErrors,
      loginFailures,
      unauthorized,
      criticals
    };
  }, [alerts]);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* HEADER SECTION - Modern & Compact */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3.5">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl flex items-center justify-center shrink-0">
            <ShieldAlert size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">Alertes Système & Sécurité</h2>
              <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200/80 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                Live
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500">
              Surveillance temps réel : synchronisation, authentification et restrictions d'accès
            </p>
          </div>
        </div>

        {/* Real-time Indicator & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsRealtimeActive(!isRealtimeActive)}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 border cursor-pointer ${
              isRealtimeActive 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isRealtimeActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            <span className="text-[11px]">{isRealtimeActive ? 'Flux actif' : 'En pause'}</span>
          </button>

          <button
            onClick={() => setIsSimulateModalOpen(true)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all shadow-2xs flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <Zap size={13} />
            <span className="text-[11px]">Simuler alerte</span>
          </button>

          <button
            onClick={fetchAlerts}
            disabled={loading}
            className="p-1.5 sm:p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            title="Actualiser les alertes"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-indigo-600' : ''} />
          </button>
        </div>
      </div>

      {/* METRICS DASHBOARD CARDS - Responsive Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        {/* Total Pending Alerts */}
        <div 
          onClick={() => { setStatusFilter('UNRESOLVED'); setCategoryFilter('ALL'); }}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer shadow-2xs ${
            statusFilter === 'UNRESOLVED' && categoryFilter === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-indigo-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className={`p-1.5 rounded-lg ${statusFilter === 'UNRESOLVED' && categoryFilter === 'ALL' ? 'bg-slate-800 text-indigo-400' : 'bg-rose-50 text-rose-600'}`}>
              <AlertTriangle size={15} />
            </span>
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
              stats.unresolved > 0 ? (statusFilter === 'UNRESOLVED' && categoryFilter === 'ALL' ? 'bg-rose-500/30 text-rose-200' : 'bg-rose-100 text-rose-800') : 'bg-emerald-100 text-emerald-800'
            }`}>
              {stats.unresolved} en attente
            </span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">Non Résolues</p>
          <p className="text-xl sm:text-2xl font-black mt-0.5 tracking-tight">{stats.unresolved}</p>
        </div>

        {/* Sync Errors */}
        <div 
          onClick={() => { setCategoryFilter('SYNC_ERROR'); }}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer shadow-2xs ${
            categoryFilter === 'SYNC_ERROR'
              ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200 hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className={`p-1.5 rounded-lg ${categoryFilter === 'SYNC_ERROR' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-600'}`}>
              <Database size={15} />
            </span>
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
              categoryFilter === 'SYNC_ERROR' ? 'bg-amber-600/60 text-white' : 'bg-amber-100 text-amber-800'
            }`}>
              Sync
            </span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Erreurs Sync</p>
          <p className="text-xl sm:text-2xl font-black mt-0.5 tracking-tight">{stats.syncErrors}</p>
        </div>

        {/* Failed Logins */}
        <div 
          onClick={() => { setCategoryFilter('LOGIN_FAILURE'); }}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer shadow-2xs ${
            categoryFilter === 'LOGIN_FAILURE'
              ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-500/20'
              : 'bg-white border-slate-200 hover:border-blue-200'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className={`p-1.5 rounded-lg ${categoryFilter === 'LOGIN_FAILURE' ? 'bg-blue-700 text-white' : 'bg-blue-50 text-blue-600'}`}>
              <UserX size={15} />
            </span>
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
              categoryFilter === 'LOGIN_FAILURE' ? 'bg-blue-700/60 text-white' : 'bg-blue-100 text-blue-800'
            }`}>
              Auth
            </span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Échecs Connexion</p>
          <p className="text-xl sm:text-2xl font-black mt-0.5 tracking-tight">{stats.loginFailures}</p>
        </div>

        {/* Unauthorized Access */}
        <div 
          onClick={() => { setCategoryFilter('UNAUTHORIZED_ACCESS'); }}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer shadow-2xs ${
            categoryFilter === 'UNAUTHORIZED_ACCESS'
              ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-500/20'
              : 'bg-white border-slate-200 hover:border-rose-200'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className={`p-1.5 rounded-lg ${categoryFilter === 'UNAUTHORIZED_ACCESS' ? 'bg-rose-700 text-white' : 'bg-rose-50 text-rose-600'}`}>
              <Lock size={15} />
            </span>
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
              categoryFilter === 'UNAUTHORIZED_ACCESS' ? 'bg-rose-700/60 text-white' : 'bg-rose-100 text-rose-800'
            }`}>
              RLS
            </span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Accès Refusés</p>
          <p className="text-xl sm:text-2xl font-black mt-0.5 tracking-tight">{stats.unauthorized}</p>
        </div>

        {/* Network & Latency Info */}
        <div className="col-span-2 sm:col-span-1 p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Activity size={15} />
            </span>
            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md uppercase">
              {supabaseStatus}
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Latence API</p>
            <div className="flex items-baseline gap-1.5">
              <p className="text-xl font-black text-slate-900 tracking-tight">{latencyMs} ms</p>
              <span className="text-[9px] font-bold text-slate-400">
                {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* FILTER & CONTROL TOOLBAR */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setCategoryFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                categoryFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              Toutes ({alerts.length})
            </button>
            <button
              onClick={() => setCategoryFilter('SYNC_ERROR')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                categoryFilter === 'SYNC_ERROR'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60'
              }`}
            >
              <Database size={12} />
              Sync ({stats.syncErrors})
            </button>
            <button
              onClick={() => setCategoryFilter('LOGIN_FAILURE')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                categoryFilter === 'LOGIN_FAILURE'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/60'
              }`}
            >
              <UserX size={12} />
              Auth ({stats.loginFailures})
            </button>
            <button
              onClick={() => setCategoryFilter('UNAUTHORIZED_ACCESS')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                categoryFilter === 'UNAUTHORIZED_ACCESS'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60'
              }`}
            >
              <Lock size={12} />
              RLS ({stats.unauthorized})
            </button>
          </div>

          {/* Quick Actions Right */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleResolveAll}
              disabled={alerts.filter(a => a.status === 'UNRESOLVED').length === 0}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold text-[11px] rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              <CheckCircle2 size={13} />
              Acquitter tout
            </button>

            <button
              onClick={handleExportJSON}
              className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-[11px] rounded-lg transition-all flex items-center gap-1.5 border border-slate-200 cursor-pointer"
            >
              <Download size={13} />
              <span className="hidden sm:inline">JSON</span>
            </button>
          </div>
        </div>

        {/* Detailed Search & Sub-filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
          {/* Search Box */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrer email, IP, école, motif..."
              className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <XCircle size={13} />
              </button>
            )}
          </div>

          {/* Severity Dropdown */}
          <div className="relative">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="w-full pl-3 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="ALL">Toutes gravités</option>
              <option value="CRITICAL">Critique</option>
              <option value="WARNING">Avertissement</option>
              <option value="INFO">Information</option>
            </select>
            <Filter size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Status Dropdown */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full pl-3 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="ALL">Tous les statuts</option>
              <option value="UNRESOLVED">Non résolues (En attente)</option>
              <option value="RESOLVED">Résolues (Acquittées)</option>
            </select>
            <Filter size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Time Range Selector */}
          <div className="flex bg-slate-50 border border-slate-200 rounded-lg p-0.5">
            {[
              { key: '1H', label: '1h' },
              { key: '24H', label: '24h' },
              { key: '7D', label: '7j' },
              { key: 'ALL', label: 'Tout' }
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTimeRange(t.key as any)}
                className={`flex-1 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  timeRange === t.key ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ALERTS LIST / TABLE - Sleek, Uncluttered & Compact */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-xs sm:text-sm tracking-tight">
              Registre des Incidents & Alertes ({filteredAlerts.length})
            </h3>
          </div>
          <span className="text-[11px] font-medium text-slate-400">
            Tri antéchronologique
          </span>
        </div>

        {loading ? (
          <div className="p-10 text-center flex flex-col items-center justify-center">
            <RefreshCw size={24} className="animate-spin text-indigo-600 mb-2.5" />
            <p className="text-xs font-bold text-slate-500">Chargement des alertes...</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="p-10 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-2.5">
              <CheckCircle2 size={24} />
            </div>
            <h4 className="text-sm font-bold text-slate-800">Aucune alerte active</h4>
            <p className="text-xs text-slate-400 font-medium max-w-sm mt-0.5">
              Tous les sous-systèmes fonctionnent normalement.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredAlerts.map((alert) => {
              const isResolved = alert.status === 'RESOLVED';

              const severityBadge = {
                CRITICAL: 'bg-rose-50 text-rose-700 border-rose-200',
                WARNING: 'bg-amber-50 text-amber-700 border-amber-200',
                INFO: 'bg-blue-50 text-blue-700 border-blue-200'
              }[alert.severity];

              const categoryBadge = {
                SYNC_ERROR: { label: 'Sync', bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: Database },
                LOGIN_FAILURE: { label: 'Auth', bg: 'bg-blue-50 text-blue-700 border-blue-200', icon: UserX },
                UNAUTHORIZED_ACCESS: { label: 'RLS', bg: 'bg-rose-50 text-rose-700 border-rose-200', icon: Lock }
              }[alert.category];

              const CategoryIcon = categoryBadge.icon;

              return (
                <div
                  key={alert.id}
                  className={`p-3.5 sm:p-4 hover:bg-slate-50/70 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isResolved ? 'opacity-65 bg-slate-50/40' : ''
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Compact Icon */}
                    <div className={`p-2 rounded-xl border shrink-0 mt-0.5 ${categoryBadge.bg}`}>
                      <CategoryIcon size={16} />
                    </div>

                    <div className="space-y-1 flex-1 min-w-0">
                      {/* Top Line: Title + Pills */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm tracking-tight truncate max-w-md">
                          {alert.title}
                        </h4>

                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${severityBadge}`}>
                          {alert.severity}
                        </span>

                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${categoryBadge.bg}`}>
                          {categoryBadge.label}
                        </span>

                        {isResolved ? (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
                            <Check size={10} /> Résolue
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" /> En attente
                          </span>
                        )}
                      </div>

                      {/* Clean 1-2 line description */}
                      <p className="text-xs text-slate-600 font-normal leading-normal line-clamp-2">
                        {alert.description}
                      </p>

                      {/* Clean context metadata chips */}
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 pt-0.5">
                        <span className="flex items-center gap-1 text-slate-400 font-mono text-[10px]">
                          <Clock size={11} />
                          {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(alert.created_at).toLocaleDateString()}
                        </span>

                        {alert.user_name && (
                          <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded text-[10px] font-semibold border border-slate-200/60">
                            {alert.user_name} {alert.user_role ? `(${alert.user_role})` : ''}
                          </span>
                        )}

                        {alert.school_name && (
                          <span className="text-slate-600 text-[10px] font-medium">
                            • {alert.school_name}
                          </span>
                        )}

                        {alert.failure_reason && (
                          <span className="text-rose-600 font-medium text-[10px] truncate max-w-xs">
                            • {alert.failure_reason}
                          </span>
                        )}

                        {alert.attempt_count && alert.attempt_count > 1 && (
                          <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded text-[10px] font-bold">
                            {alert.attempt_count} tentatives
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => setSelectedAlert(alert)}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-lg transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <Eye size={13} />
                      <span>Inspecter</span>
                    </button>

                    {!isResolved ? (
                      <button
                        onClick={() => handleResolveAlert(alert.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1 shadow-2xs active:scale-95 cursor-pointer"
                      >
                        <Check size={13} />
                        <span>Acquitter</span>
                      </button>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400 italic">
                        Acquittée
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: INSPECT ALERT DETAILS */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-xl flex items-center justify-center">
                  <ShieldAlert size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">{selectedAlert.title}</h3>
                  <p className="text-xs text-slate-400 font-mono">ID: {selectedAlert.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Alert Status Banner */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                selectedAlert.status === 'RESOLVED' 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                <div className="flex items-center gap-3">
                  {selectedAlert.status === 'RESOLVED' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider">
                      Statut: {selectedAlert.status === 'RESOLVED' ? 'Alerte Acquittée' : 'Alerte Active (En Attente)'}
                    </p>
                    <p className="text-xs font-medium opacity-80">
                      {selectedAlert.status === 'RESOLVED'
                        ? `Résolue le ${new Date(selectedAlert.resolved_at || '').toLocaleString()} par ${selectedAlert.resolved_by}`
                        : 'Cette alerte nécessite votre attention ou une intervention technique.'}
                    </p>
                  </div>
                </div>

                {selectedAlert.status === 'UNRESOLVED' && (
                  <button
                    onClick={() => handleResolveAlert(selectedAlert.id)}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shrink-0"
                  >
                    Acquitter maintenant
                  </button>
                )}
              </div>

              {/* User Identity Highlight Card */}
              <div className="p-4 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                  <span className="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                    👤 Identité & Rôle de l'Utilisateur Concerné
                  </span>
                  {selectedAlert.user_role && (
                    <span className="px-2.5 py-0.5 bg-indigo-600 text-white font-extrabold text-[10px] rounded-full uppercase tracking-wider">
                      {selectedAlert.user_role}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest block">Nom de l'utilisateur</span>
                    <span className="font-black text-slate-900 text-sm">{selectedAlert.user_name || 'Anonyme / Non spécifié'}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest block">Adresse Email</span>
                    <span className="font-bold text-slate-800">{selectedAlert.user_email || 'N/A'}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest block">Raison / Motif d'Échec</span>
                    <span className="font-bold text-rose-700">{selectedAlert.failure_reason || selectedAlert.description}</span>
                  </div>
                </div>

                {selectedAlert.attempt_count && selectedAlert.attempt_count > 1 && (
                  <div className="text-[11px] font-bold text-rose-800 bg-rose-100/80 p-2.5 rounded-xl border border-rose-200 flex items-center justify-between flex-wrap gap-2">
                    <span>⚡ Seuil de sécurité atteint : {selectedAlert.attempt_count} tentatives infructueuses enregistrées</span>
                    <span className="font-black underline cursor-pointer hover:text-rose-950">Action Recommandée : Réinitialiser le Mot de Passe</span>
                  </div>
                )}
              </div>

              {/* Grid Context Info */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Catégorie</span>
                  <span className="font-bold text-slate-800">{selectedAlert.category}</span>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Gravité</span>
                  <span className={`font-black ${
                    selectedAlert.severity === 'CRITICAL' ? 'text-rose-600' : 'text-amber-600'
                  }`}>{selectedAlert.severity}</span>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Horodatage</span>
                  <span className="font-bold text-slate-800">{new Date(selectedAlert.created_at).toLocaleString()}</span>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Adresse IP Client</span>
                  <span className="font-mono font-bold text-slate-800">{selectedAlert.ip_address || 'N/A'}</span>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">ID Supabase</span>
                  <span className="font-mono text-[10px] font-bold text-slate-800">{selectedAlert.user_id || 'Non attribué'}</span>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Établissement</span>
                  <span className="font-bold text-slate-800">{selectedAlert.school_name || 'Global'}</span>
                </div>
              </div>

              {/* Full Description */}
              <div>
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Description complète</h4>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 leading-relaxed">
                  {selectedAlert.description}
                </div>
              </div>

              {/* JSON Payload Details */}
              {selectedAlert.details && (
                <div>
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Payload Technique (JSON)</h4>
                  <pre className="p-4 bg-slate-900 text-indigo-300 rounded-2xl text-[11px] font-mono overflow-x-auto leading-relaxed">
                    {JSON.stringify(selectedAlert.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setSelectedAlert(null)}
                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-all"
              >
                Fermer
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: TEST ALERT SIMULATION */}
      {isSimulateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl shadow-2xl max-w-xl w-full border border-slate-200 my-auto max-h-[90vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                  <Zap size={22} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">Simulateur d'Alerte Temps Réel</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Injecter une alerte de test pour valider le flux en direct</p>
                </div>
              </div>
              <button
                onClick={() => setIsSimulateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>

            {/* Form Fields - Scrollable body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1">
              <div>
                <label className="block font-black text-slate-700 uppercase tracking-wider mb-1.5 text-[10px]">
                  Type d'incident
                </label>
                <select
                  value={simType}
                  onChange={(e) => setSimType(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs"
                >
                  <option value="SYNC_ERROR">🔄 Erreur de synchronisation des données</option>
                  <option value="LOGIN_FAILURE">🔑 Échecs de connexion / Auth</option>
                  <option value="UNAUTHORIZED_ACCESS">🛡️ Tentative d'accès non autorisée (RLS)</option>
                </select>
              </div>

              {/* Target User Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <div>
                  <label className="block font-extrabold text-slate-700 text-[10px] uppercase mb-1">
                    Nom de l'utilisateur
                  </label>
                  <input
                    type="text"
                    value={simUserName}
                    onChange={(e) => setSimUserName(e.target.value)}
                    placeholder="Ex: Jean-Michel Dupont"
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-extrabold text-slate-700 text-[10px] uppercase mb-1">
                    Email de l'utilisateur
                  </label>
                  <input
                    type="email"
                    value={simUserEmail}
                    onChange={(e) => setSimUserEmail(e.target.value)}
                    placeholder="Ex: compta.dupont@univ-excellence.edu"
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-extrabold text-slate-700 text-[10px] uppercase mb-1">
                    Rôle de l'utilisateur
                  </label>
                  <select
                    value={simUserRole}
                    onChange={(e) => setSimUserRole(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 text-xs focus:outline-none"
                  >
                    <option value="COMPTABLE">COMPTABLE</option>
                    <option value="DIRECTEUR">DIRECTEUR</option>
                    <option value="TEACHER">ENSEIGNANT</option>
                    <option value="CAISSIER">CAISSIER</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                </div>

                <div>
                  <label className="block font-extrabold text-slate-700 text-[10px] uppercase mb-1">
                    Nombre d'essais
                  </label>
                  <input
                    type="number"
                    value={simAttempts}
                    onChange={(e) => setSimAttempts(parseInt(e.target.value) || 1)}
                    min={1}
                    max={20}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-black text-slate-700 uppercase tracking-wider mb-1.5 text-[10px]">
                  Motif précis de l'échec / Incident
                </label>
                <input
                  type="text"
                  value={simFailureReason}
                  onChange={(e) => setSimFailureReason(e.target.value)}
                  placeholder="Ex: Mot de passe erroné (5 tentatives consécutives)"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-black text-slate-700 uppercase tracking-wider mb-1.5 text-[10px]">
                  Niveau de gravité
                </label>
                <select
                  value={simSeverity}
                  onChange={(e) => setSimSeverity(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="CRITICAL">🔥 Critique (Urgence Haute)</option>
                  <option value="WARNING">⚠️ Avertissement (Moyen)</option>
                  <option value="INFO">ℹ️ Information (Faible)</option>
                </select>
              </div>

              <div>
                <label className="block font-black text-slate-700 uppercase tracking-wider mb-1.5 text-[10px]">
                  Message personnalisé (Optionnel)
                </label>
                <textarea
                  value={simCustomMsg}
                  onChange={(e) => setSimCustomMsg(e.target.value)}
                  placeholder="Laissez vide pour utiliser la description générée..."
                  rows={2}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            {/* Footer Buttons - Pinned */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={() => setIsSimulateModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all"
              >
                Annuler
              </button>

              <button
                onClick={handleTriggerSimulatedAlert}
                disabled={isSimulating}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 shadow-md active:scale-95 disabled:opacity-50"
              >
                {isSimulating ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                Déclencher l'alerte
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default SystemAlertsView;
