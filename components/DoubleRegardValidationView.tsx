import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Eye, 
  Trash2, 
  DollarSign, 
  UserX, 
  KeyRound, 
  Settings, 
  Building2, 
  RefreshCw, 
  Search, 
  Filter, 
  ChevronRight, 
  Check, 
  X, 
  FileText,
  UserCheck,
  Info
} from 'lucide-react';
import { PendingAction, UserProfile, UserRole } from '../types';
import { PendingActionsService } from '../services/pendingActionsService';
import { isTitulaireAdmin, isAutonomousAccount } from '../utils/autonomousAdminGuard';
import { toast } from 'sonner';

interface DoubleRegardValidationViewProps {
  user: UserProfile;
  schoolId: string;
  selectedCampus: string;
  isCampusLocked: boolean;
  terminology?: any;
  onCountChange?: (count: number) => void;
}

export const DoubleRegardValidationView: React.FC<DoubleRegardValidationViewProps> = ({
  user,
  schoolId,
  selectedCampus,
  isCampusLocked,
  terminology,
  onCountChange
}) => {
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'USER' | 'PAYROLL' | 'CONFIG'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [reviewingAction, setReviewingAction] = useState<PendingAction | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectingAction, setRejectingAction] = useState<PendingAction | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [inspectingAction, setInspectingAction] = useState<PendingAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Check if current user is certified RH
  const userIsCertifiedRH = useMemo(() => isTitulaireAdmin(user), [user]);
  const userIsAutonomous = useMemo(() => isAutonomousAccount(user), [user]);

  const loadActions = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const data = await PendingActionsService.fetchPendingActions(schoolId, {
        status: statusFilter,
        campusId: selectedCampus
      });
      setActions(data);

      // Update pending count for parent badge
      const pendingCount = await PendingActionsService.getPendingCount(schoolId, selectedCampus);
      if (onCountChange) {
        onCountChange(pendingCount);
      }
    } catch (err) {
      console.error("Error loading pending actions:", err);
      toast.error("Impossible de charger les opérations du Double Regard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActions();
  }, [schoolId, selectedCampus, statusFilter]);

  // Filter actions
  const filteredActions = useMemo(() => {
    return actions.filter(action => {
      // Category filter
      if (categoryFilter === 'USER') {
        if (!['DELETE_USER', 'RESET_USER_PASSWORD', 'CHANGE_USER_ROLE'].includes(action.action_type)) return false;
      } else if (categoryFilter === 'PAYROLL') {
        if (!['UPDATE_PAYROLL', 'DELETE_PAYROLL_SLIP', 'DELETE_PAYROLL_PERIOD', 'APPROVE_ADVANCE', 'PROCESS_PAYROLL_PAYMENT', 'UPDATE_SALARY'].includes(action.action_type)) return false;
      } else if (categoryFilter === 'CONFIG') {
        if (!['UPDATE_MONCASH'].includes(action.action_type)) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchTitle = action.action_title?.toLowerCase().includes(term);
        const matchDesc = action.description?.toLowerCase().includes(term);
        const matchRequester = action.requester_name?.toLowerCase().includes(term);
        const matchType = action.action_type?.toLowerCase().includes(term);
        if (!matchTitle && !matchDesc && !matchRequester && !matchType) return false;
      }

      return true;
    });
  }, [actions, categoryFilter, searchTerm]);

  // Handle Approve & Execute
  const handleApprove = async () => {
    if (!reviewingAction) return;

    if (!userIsCertifiedRH) {
      toast.error("Seul un Administrateur certifié RH (titulaire) peut valider une action critique.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await PendingActionsService.approveAndExecuteAction(
        reviewingAction, 
        user, 
        approvalNotes
      );

      if (res.success) {
        toast.success("Action validée et exécutée avec succès dans le système !", { duration: 5000 });
        setReviewingAction(null);
        setApprovalNotes('');
        loadActions();
      } else {
        toast.error(res.error || "Erreur lors de la validation.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur inattendue.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Reject
  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingAction) return;

    if (!userIsCertifiedRH) {
      toast.error("Seul un Administrateur certifié RH peut statuer sur un rejet.");
      return;
    }

    if (!rejectionReason.trim()) {
      toast.error("Veuillez indiquer un motif de rejet explicite.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await PendingActionsService.rejectAction(
        rejectingAction, 
        user, 
        rejectionReason.trim()
      );

      if (res.success) {
        toast.success("L'action critique a été rejetée.");
        setRejectingAction(null);
        setRejectionReason('');
        loadActions();
      } else {
        toast.error(res.error || "Erreur lors du rejet.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur inattendue.");
    } finally {
      setActionLoading(false);
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'DELETE_USER':
        return <UserX className="w-5 h-5 text-rose-600" />;
      case 'UPDATE_PAYROLL':
      case 'UPDATE_SALARY':
      case 'PROCESS_PAYROLL_PAYMENT':
        return <DollarSign className="w-5 h-5 text-emerald-600" />;
      case 'DELETE_PAYROLL_SLIP':
      case 'DELETE_PAYROLL_PERIOD':
        return <Trash2 className="w-5 h-5 text-rose-600" />;
      case 'APPROVE_ADVANCE':
        return <DollarSign className="w-5 h-5 text-blue-600" />;
      case 'RESET_USER_PASSWORD':
        return <KeyRound className="w-5 h-5 text-amber-600" />;
      default:
        return <Settings className="w-5 h-5 text-slate-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
            <Clock size={12} className="animate-spin text-amber-600" />
            En attente de validation
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle size={12} className="text-emerald-600" />
            Validée & Exécutée
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle size={12} className="text-rose-600" />
            Rejetée
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Bandeau d'Habilitation & Quorum RH */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        userIsCertifiedRH 
          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
          : 'bg-amber-50/80 border-amber-200 text-amber-950'
      }`}>
        <div className="flex items-start sm:items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            userIsCertifiedRH 
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
          }`}>
            {userIsCertifiedRH ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-black tracking-tight">
                {userIsCertifiedRH 
                  ? "Vous êtes habilité comme Administrateur Titulaire Certifié RH"
                  : "Compte Opérateur en Mode Autonome (Sous Tutelle RH)"
                }
              </p>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                userIsCertifiedRH ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'
              }`}>
                {userIsCertifiedRH ? "Quorum Habilité" : "Lecture Seule"}
              </span>
            </div>
            <p className="text-xs opacity-90 mt-0.5">
              {userIsCertifiedRH 
                ? "Vous disposez des droits légaux et de la certification RH requise pour co-valider et libérer les opérations critiques."
                : "Seuls les administrateurs titulaires disposant d'un dossier RH formel peuvent valider ces opérations critiques."
              }
            </p>
          </div>
        </div>

        <button
          onClick={loadActions}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 bg-white rounded-xl border border-slate-200 shadow-sm text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shrink-0"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Actualiser
        </button>
      </div>

      {/* Barre d'Onglets d'État et Filtres */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        
        {/* Onglets de Statut */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              statusFilter === 'PENDING'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Clock size={14} />
            À Valider
          </button>
          <button
            onClick={() => setStatusFilter('APPROVED')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              statusFilter === 'APPROVED'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <CheckCircle size={14} />
            Validées
          </button>
          <button
            onClick={() => setStatusFilter('REJECTED')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              statusFilter === 'REJECTED'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <XCircle size={14} />
            Rejetées
          </button>
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              statusFilter === 'ALL'
                ? 'bg-slate-800 text-white shadow-md shadow-slate-800/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Toutes
          </button>
        </div>

        {/* Filtres Catégorie & Recherche */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="relative shrink-0">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="pl-8 pr-4 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 outline-none cursor-pointer"
            >
              <option value="ALL">Toutes les catégories</option>
              <option value="PAYROLL">Paie & Salaires</option>
              <option value="USER">Comptes Utilisateurs</option>
              <option value="CONFIG">Configuration & MonCash</option>
            </select>
          </div>

          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher une opération..."
              className="w-full pl-8 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 outline-none focus:bg-white focus:border-amber-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Liste des Opérations */}
      {loading ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-amber-600 mx-auto" />
          <p className="text-sm font-bold text-slate-600">Chargement des opérations critiques en attente...</p>
        </div>
      ) : filteredActions.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Aucune opération dans cette file</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {statusFilter === 'PENDING' 
              ? "Toutes les opérations critiques soumises au Double Regard ont été traitées."
              : "Aucune opération ne correspond aux critères sélectionnés."
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredActions.map((action) => {
            const isPending = action.status === 'PENDING';
            const isRequesterSelf = action.requester_id === user.id;

            return (
              <div 
                key={action.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all space-y-4"
              >
                {/* En-tête de la carte */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                      {getActionIcon(action.action_type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                          {action.action_title}
                        </span>
                        {getStatusBadge(action.status)}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Soumis le {new Date(action.created_at).toLocaleDateString('fr-FR', { 
                          day: '2-digit', 
                          month: 'long', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setInspectingAction(action)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                      title="Inspecter le contenu technique"
                    >
                      <Eye size={14} />
                      Détails
                    </button>
                  </div>
                </div>

                {/* Corps : Demandeur & Description */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Demandeur */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Demandeur</span>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold">
                        {action.requester_name ? action.requester_name[0] : 'U'}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 leading-tight">
                          {action.requester_name || "Utilisateur"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {action.requester_role || "Opérateur"}
                        </p>
                      </div>
                    </div>
                    {action.is_autonomous_requester && (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                        <AlertTriangle size={10} />
                        Mode Autonome (Sous Tutelle)
                      </div>
                    )}
                  </div>

                  {/* Détails de l'action */}
                  <div className="md:col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description & Impact</span>
                    <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                      {action.description || "Aucune description détaillée."}
                    </p>
                    {action.target_entity_type && (
                      <p className="text-[11px] text-slate-500">
                        Cible : <span className="font-semibold text-slate-700">{action.target_entity_type}</span> {action.target_entity_id ? `(#${action.target_entity_id.slice(0, 8)})` : ''}
                      </p>
                    )}
                  </div>
                </div>

                {/* Bloc de Revue (Si déjà approuvée ou rejetée) */}
                {action.reviewed_by && (
                  <div className={`p-3 rounded-xl border text-xs space-y-1 ${
                    action.status === 'APPROVED' 
                      ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                      : 'bg-rose-50/60 border-rose-200 text-rose-950'
                  }`}>
                    <div className="flex items-center gap-2 font-bold">
                      {action.status === 'APPROVED' ? <CheckCircle size={14} className="text-emerald-600" /> : <XCircle size={14} className="text-rose-600" />}
                      <span>
                        {action.status === 'APPROVED' ? 'Validé par' : 'Rejeté par'} : {action.reviewer_name || "Administrateur Titulaire"}
                      </span>
                      {action.reviewed_at && (
                        <span className="text-[11px] font-normal opacity-80">
                          le {new Date(action.reviewed_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    {action.review_notes && (
                      <p className="text-slate-600 pl-5">Note du validateur : "{action.review_notes}"</p>
                    )}
                    {action.rejection_reason && (
                      <p className="text-rose-700 font-semibold pl-5">Motif du rejet : "{action.rejection_reason}"</p>
                    )}
                  </div>
                )}

                {/* Actions de validation pour les actions en attente */}
                {isPending && (
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-slate-500 flex items-center gap-1.5">
                      <ShieldCheck size={14} className={userIsCertifiedRH ? "text-emerald-600" : "text-amber-500"} />
                      <span>
                        {userIsCertifiedRH 
                          ? (isRequesterSelf 
                              ? "⚠️ Vous êtes le demandeur : un autre administrateur certifié RH doit valider (Principe des 4-Yeux)"
                              : "Vous pouvez valider cette opération critique")
                          : "Validation bloquée : requiert un compte certifié RH"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setRejectingAction(action);
                          setRejectionReason('');
                        }}
                        disabled={!userIsCertifiedRH}
                        className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border transition-all ${
                          userIsCertifiedRH 
                            ? 'text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100'
                            : 'text-slate-400 bg-slate-50 border-slate-200 cursor-not-allowed'
                        }`}
                      >
                        <X size={14} />
                        Rejeter
                      </button>

                      <button
                        onClick={() => {
                          setReviewingAction(action);
                          setApprovalNotes('');
                        }}
                        disabled={!userIsCertifiedRH || (isRequesterSelf && !user.is_super_admin && user.role !== UserRole.SUPER_ADMIN)}
                        className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-xl shadow-md transition-all ${
                          userIsCertifiedRH && (!isRequesterSelf || user.is_super_admin || user.role === UserRole.SUPER_ADMIN)
                            ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                            : 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                        }`}
                      >
                        <Check size={14} />
                        Valider & Exécuter
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Validation Formelle (Double Regard) */}
      {reviewingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-5 text-white flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight text-white">
                    Approbation Double Regard
                  </h3>
                  <p className="text-xs text-emerald-100">
                    Contrôle formel et exécution immédiate
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setReviewingAction(null)}
                disabled={actionLoading}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle size={14} className="text-emerald-600" />
                  Confirmation de responsabilité RH
                </p>
                <p className="text-emerald-800 leading-relaxed">
                  En validant cette opération, vous engagez votre signature en tant qu'Administrateur certifié RH. L'action demandée par <strong>{reviewingAction.requester_name}</strong> sera appliquée directement dans la base de données.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="font-bold text-slate-500 uppercase tracking-wider">Action à libérer</div>
                <div className="text-sm font-black text-slate-900">{reviewingAction.action_title}</div>
                <p className="text-slate-600 whitespace-pre-line">{reviewingAction.description}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Note d'audit / Avis du validateur (Optionnel)
                </label>
                <textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Ex: Vérification effectuée, conforme à l'accord RH..."
                  rows={2}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReviewingAction(null)}
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                >
                  <Check size={14} />
                  {actionLoading ? "Exécution en cours..." : "Confirmer & Exécuter"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Rejet Formel */}
      {rejectingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-rose-600 to-rose-700 p-5 text-white flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0">
                  <XCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight text-white">
                    Rejet de l'Opération Critique
                  </h3>
                  <p className="text-xs text-rose-100">
                    Motif obligatoire et traçabilité
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setRejectingAction(null)}
                disabled={actionLoading}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleReject} className="p-6 space-y-4">
              <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div className="font-bold text-slate-500 uppercase tracking-wider">Action concernée</div>
                <div className="text-sm font-black text-slate-900">{rejectingAction.action_title}</div>
                <p className="text-slate-600">Demandée par : {rejectingAction.requester_name}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Motif du rejet (Obligatoire) *
                </label>
                <textarea
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Indiquez pourquoi cette action est rejetée ou quelles corrections sont attendues..."
                  rows={3}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectingAction(null)}
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !rejectionReason.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                >
                  <X size={14} />
                  {actionLoading ? "Enregistrement..." : "Confirmer le Rejet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal d'Inspection Payload */}
      {inspectingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-base font-black text-white">
                    Inspection Technique du Payload
                  </h3>
                  <p className="text-xs text-slate-400">
                    {inspectingAction.action_type} • ID: {inspectingAction.id}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setInspectingAction(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">Statut</span>
                  <span className="font-black text-slate-800">{inspectingAction.status}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">Statut d'exécution</span>
                  <span className="font-black text-slate-800">{inspectingAction.execution_status || 'IDLE'}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">Demandeur</span>
                  <span className="text-slate-800">{inspectingAction.requester_name} ({inspectingAction.requester_role})</span>
                </div>
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">Mode Autonome</span>
                  <span className="text-slate-800">{inspectingAction.is_autonomous_requester ? 'OUI (Sans dossier RH)' : 'NON (Titulaire RH)'}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Données Brutes du Payload (JSON)
                </label>
                <pre className="p-4 bg-slate-950 text-emerald-400 text-xs rounded-xl overflow-x-auto font-mono max-h-60">
                  {JSON.stringify(inspectingAction.payload, null, 2)}
                </pre>
              </div>

              {inspectingAction.execution_error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                  <span className="font-bold">Erreur d'exécution :</span> {inspectingAction.execution_error}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setInspectingAction(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
