import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { UserProfile, UserRole, SchoolType } from '../types';
import { 
  Loader2, 
  ShieldAlert, 
  History, 
  User, 
  Calendar, 
  Tag, 
  FileText, 
  X, 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  Eye, 
  Building2, 
  GraduationCap, 
  School, 
  Clock, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle,
  KeyRound,
  Trash2,
  Edit3,
  PlusCircle,
  LogIn,
  LogOut,
  CreditCard,
  Copy,
  Check
} from 'lucide-react';
import { useSchool } from '../contexts/SchoolContext';
import { SelectPill, SelectOption } from './SelectPill';
import { DatePickerPill } from './DatePickerPill';

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: any;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
    role: string;
    campus_id: string | null;
  } | null;
}

export const AuditLogsView: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { terminology, campuses, currentCampusId, school } = useSchool();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAuditError, setLastAuditError] = useState<string | null>(null);

  // Filtres
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedActionFilter, setSelectedActionFilter] = useState<string>('ALL');
  const [selectedCampusFilter, setSelectedCampusFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [activeDatePreset, setActiveDatePreset] = useState<'ALL' | 'TODAY' | '7D' | '30D'>('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Modal d'inspection détaillée
  const [selectedLogForModal, setSelectedLogForModal] = useState<AuditLog | null>(null);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);

  const schoolType = (school?.school_type as SchoolType) || SchoolType.CLASSIC;
  const isUniversity = schoolType === SchoolType.UNIVERSITY;
  const isClassic = schoolType === SchoolType.CLASSIC;

  const userBelongsToSiege = user.email === 'vilinfo2014@gmail.com' || (user.campus_id === null || user.campus_id === '3dd425c2-2e23-4e3c-a02a-c67ed85ca490');
  const hasMultiCampusActive = Boolean(school?.has_multi_campus && campuses && campuses.length > 1);
  const canManageAllCampuses = hasMultiCampusActive && (!user.campus_id || userBelongsToSiege);

  // Traduction contextuelle de l'action
  const translateAction = (action: string) => {
    const map: Record<string, string> = {
      'LOGIN': 'Connexion',
      'LOGOUT': 'Déconnexion',
      'CREATE': 'Création',
      'UPDATE': 'Modification',
      'DELETE': 'Suppression',
      'PAYMENT_PROCESSED': 'Paiement',
      'FIRE_STAFF': 'Licenciement',
      'PASSWORD_RESET': 'Réinit. Mot de Passe',
      'RESET_PASSWORD': 'Réinit. Mot de Passe',
    };
    return map[action] || action;
  };

  // Traduction contextuelle de l'entité (Classique & Universitaire)
  const translateEntity = (entity: string) => {
    const map: Record<string, string> = {
      'auth': 'Authentification',
      'student': isUniversity ? (terminology?.student || 'Étudiant') : (terminology?.student || 'Élève'),
      'staff': 'Personnel',
      'class': isUniversity ? (terminology?.class || 'Promotion / Filière') : (terminology?.class || 'Classe'),
      'payment': 'Paiement',
      'expense': 'Dépense',
      'subject': isUniversity ? (terminology?.subject || 'Cours / UE') : (terminology?.subject || 'Matière'),
      'class_subject': isUniversity 
        ? `${terminology?.subject || 'Cours'} par ${terminology?.class || 'Promotion'}`
        : `${terminology?.subject || 'Matière'} par ${terminology?.class || 'Classe'}`,
      'grade': 'Note / Évaluation',
      'attendance': 'Présence',
      'user': 'Compte Utilisateur',
      'school': 'Établissement',
      'department': 'Département / Faculté',
      'semester': 'Semestre Académique',
      'syllabus': 'Syllabus / Programme',
    };
    return map[entity] || entity;
  };

  // Description enrichie pour le système école connectée
  const generateActionDescription = (log: AuditLog) => {
    const { action, entity_type, details } = log;
    let obj = details;
    if (typeof details === 'string') {
      try { obj = JSON.parse(details); } catch (e) {}
    }

    const studentLabel = isUniversity ? (terminology?.student || 'étudiant(e)') : (terminology?.student || 'élève');
    const classLabel = isUniversity ? (terminology?.class || 'promotion') : (terminology?.class || 'classe');

    if (action === 'LOGIN') return "Connexion sécurisée à la plateforme académique.";
    if (action === 'LOGOUT') return "Déconnexion de la plateforme.";
    if (action === 'PASSWORD_RESET' || action === 'RESET_PASSWORD') {
      const forcedText = obj?.forced_change || obj?.forceChange ? "Changement obligatoire à la prochaine connexion." : "Réinitialisation standard.";
      return `Réinitialisation du mot de passe pour ${obj?.target_user || 'l\'utilisateur'}. ${forcedText}`;
    }
    
    if (action === 'CREATE') {
      if (entity_type === 'student') return `Inscription d'un(e) nouvel(le) ${studentLabel} (${obj?.first_name || ''} ${obj?.last_name || ''}).`;
      if (entity_type === 'class') return `Création de la ${classLabel} ${obj?.name || ''} ${obj?.level ? `(${obj.level})` : ''}.`;
      if (entity_type === 'staff') {
        if (obj?.type === 'payroll_period') return `Ouverture de la période de paie (${obj?.period || ''}).`;
        if (obj?.type === 'payroll_slip') return `Génération de fiche de paie pour ${obj?.staff_name || ''} (${obj?.period || ''}).`;
        if (obj?.type === 'payroll_batch') return `Génération de ${obj?.count || 0} fiches de paie (${obj?.period || ''}).`;
        return `Recrutement d'un membre du personnel (${obj?.first_name || ''} ${obj?.last_name || ''}).`;
      }
      if (entity_type === 'expense') return `Enregistrement d'une dépense de ${obj?.amount ?? ''} ${obj?.currency || 'HTG'} (${obj?.label || ''}).`;
      if (entity_type === 'payment') {
        if (obj?.type === 'supplies_payment') {
          return `Achat de fournitures (${obj?.total_amount ?? ''} ${obj?.currency || 'HTG'}) pour ${obj?.student_name || studentLabel}.`;
        }
        if (obj?.type === 'school_supplies_record') {
          return `Pack de fournitures de ${obj?.amount ?? ''} pour ${obj?.student_name || studentLabel}.`;
        }
        if (obj?.type === 'supply_payment') {
          return `Versement de fournitures de ${obj?.amount ?? ''} pour ${obj?.student_name || studentLabel}.`;
        }
        return `Enregistrement d'un versement de scolarité (${obj?.amount ?? ''} ${obj?.currency || ''}).`;
      }
      if (entity_type === 'user') return `Création du compte (${obj?.full_name || obj?.email || ''} - ${obj?.role || ''}).`;
      if (entity_type === 'subject') return `Ajout du cours/matière ${obj?.name || ''}.`;
    }
    
    if (action === 'FIRE_STAFF') {
      const notice = obj?.notice_amount ? ` | Préavis: ${obj.notice_amount.toLocaleString()} HTG` : '';
      return `Fin de contrat / Licenciement de ${obj?.name || 'l\'employé'}. Motif: ${obj?.reason || 'Non spécifié'}${notice}.`;
    }

    if (action === 'UPDATE') {
      if (entity_type === 'student') {
        if (obj?.type === 'reenrollment') return `Réinscription de l'${studentLabel} pour ${terminology.academicYear.toLowerCase()}.`;
        return `Mise à jour du dossier de l'${studentLabel} (${obj?.student_name || ''}).`;
      }
      if (entity_type === 'class') return `Mise à jour de la ${classLabel} ${obj?.name || ''}.`;
      if (entity_type === 'staff') {
        if (obj?.type === 'payroll_slip') return `Mise à jour de la fiche de paie de ${obj?.staff_name || ''} (${obj?.period || ''}).`;
        return `Mise à jour du dossier personnel (${obj?.first_name || ''} ${obj?.last_name || ''}).`;
      }
      if (entity_type === 'expense') return `Modification d'une dépense de ${obj?.amount ?? ''} (${obj?.label || ''}).`;
      if (entity_type === 'user') return `Mise à jour des autorisations / statut du compte.`;
      if (entity_type === 'settings') return `Mise à jour des paramètres de l'établissement.`;
      if (entity_type === 'grade') return `Modification de notes ou appréciations périodiques.`;
    }
    
    if (action === 'DELETE') {
      if (entity_type === 'student') return `Suppression définitive du dossier ${studentLabel} (${obj?.student_name || ''}).`;
      if (entity_type === 'class') return `Suppression de la ${classLabel} (${obj?.class_name || ''}).`;
      if (entity_type === 'staff') return `Suppression d'un dossier personnel.`;
      if (entity_type === 'user') return `Suppression du compte utilisateur ${obj?.user_name || ''}.`;
      if (entity_type === 'payment') return `Annulation d'un paiement (${obj?.payment_id || ''}).`;
      if (entity_type === 'expense') return `Suppression d'une écriture comptable de dépense.`;
    }
    
    if (action === 'PAYMENT_PROCESSED') {
      if (entity_type === 'staff') {
        return `Versement salarial de ${obj?.amount ?? ''} ${obj?.currency || ''} effectué pour ${obj?.staff_name || ''} (${obj?.period || ''}).`;
      }
      return `Paiement scolarité de ${obj?.amount ?? ''} ${obj?.currency || ''} validé (${obj?.feeType || obj?.reason || ''}).`;
    }

    return `${translateAction(action)} sur l'élément ${translateEntity(entity_type)}.`;
  };

  const fetchLogs = async (showRefreshIndicator = false) => {
    if (!user.school_id && !user.is_super_admin) return;
    
    if (showRefreshIndicator) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      let query = supabase
        .from('audit_logs')
        .select(`
          *,
          profiles:user_id(full_name, email, role, campus_id)
        `)
        .order('created_at', { ascending: false })
        .limit(350);

      if (user.school_id) {
        query = query.eq('school_id', user.school_id);
      }

      if (user.role === UserRole.SECRETARY) {
        query = query.eq('user_id', user.id);
      }

      const { data, error: fetchErr } = await query;

      if (fetchErr) throw fetchErr;
      setLogs(data || []);
      setError(null);
    } catch (err: any) {
      console.error('Erreur chargement logs audit:', err);
      setError(err.message || 'Impossible de charger le journal d\'audit.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    
    // Vérification des erreurs historisées dans le local storage
    try {
      const err = window.localStorage.getItem('last_audit_error');
      if (err) {
        setLastAuditError(err);
      }
    } catch (e) {}
  }, [user.school_id, user.is_super_admin, currentCampusId]);

  // Définition des raccourcis de date
  const applyDatePreset = (preset: 'ALL' | 'TODAY' | '7D' | '30D') => {
    setActiveDatePreset(preset);
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    if (preset === 'ALL') {
      setDateFrom('');
      setDateTo('');
    } else if (preset === 'TODAY') {
      const formatted = formatDate(today);
      setDateFrom(formatted);
      setDateTo(formatted);
    } else if (preset === '7D') {
      const past7 = new Date();
      past7.setDate(today.getDate() - 7);
      setDateFrom(formatDate(past7));
      setDateTo(formatDate(today));
    } else if (preset === '30D') {
      const past30 = new Date();
      past30.setDate(today.getDate() - 30);
      setDateFrom(formatDate(past30));
      setDateTo(formatDate(today));
    }
    setCurrentPage(1);
  };

  // Réinitialiser tous les filtres
  const resetAllFilters = () => {
    setSearchTerm('');
    setSelectedActionFilter('ALL');
    setSelectedCampusFilter('ALL');
    setDateFrom('');
    setDateTo('');
    setActiveDatePreset('ALL');
    setCurrentPage(1);
  };

  const isAnyFilterActive = useMemo(() => {
    return searchTerm.trim() !== '' ||
      selectedActionFilter !== 'ALL' ||
      selectedCampusFilter !== 'ALL' ||
      dateFrom !== '' ||
      dateTo !== '';
  }, [searchTerm, selectedActionFilter, selectedCampusFilter, dateFrom, dateTo]);

  // Filtrage complet des logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // 1. Filtre campus contextuel
      if (currentCampusId) {
        if (log.profiles?.campus_id !== currentCampusId) return false;
      }
      if (!canManageAllCampuses) {
        if (log.profiles?.campus_id !== user.campus_id) return false;
      }

      // 2. Filtre Annexe sélectionnée
      if (selectedCampusFilter !== 'ALL') {
        if (selectedCampusFilter === 'SIEGE') {
          const isSiege = !log.profiles?.campus_id || log.profiles?.campus_id === '3dd425c2-2e23-4e3c-a02a-c67ed85ca490';
          if (!isSiege) return false;
        } else {
          if (log.profiles?.campus_id !== selectedCampusFilter) return false;
        }
      }

      // 3. Filtre Type d'Action
      if (selectedActionFilter !== 'ALL') {
        if (selectedActionFilter === 'AUTH') {
          if (!['LOGIN', 'LOGOUT', 'PASSWORD_RESET', 'RESET_PASSWORD'].includes(log.action)) return false;
        } else if (selectedActionFilter === 'PAYMENT') {
          if (!['PAYMENT_PROCESSED'].includes(log.action) && log.entity_type !== 'payment') return false;
        } else if (selectedActionFilter === 'DELETE_OR_FIRE') {
          if (!['DELETE', 'FIRE_STAFF'].includes(log.action)) return false;
        } else if (log.action !== selectedActionFilter) {
          return false;
        }
      }

      // 4. Filtre par Plage de Date
      if (dateFrom) {
        const logDate = new Date(log.created_at).toISOString().split('T')[0];
        if (logDate < dateFrom) return false;
      }
      if (dateTo) {
        const logDate = new Date(log.created_at).toISOString().split('T')[0];
        if (logDate > dateTo) return false;
      }

      // 5. Filtre de Recherche textuelle
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const userName = (log.profiles?.full_name || '').toLowerCase();
        const userEmail = (log.profiles?.email || '').toLowerCase();
        const actionText = translateAction(log.action).toLowerCase();
        const entityText = translateEntity(log.entity_type).toLowerCase();
        const description = generateActionDescription(log).toLowerCase();
        const detailsString = typeof log.details === 'string' ? log.details.toLowerCase() : JSON.stringify(log.details || {}).toLowerCase();

        const match = userName.includes(term) ||
          userEmail.includes(term) ||
          actionText.includes(term) ||
          entityText.includes(term) ||
          description.includes(term) ||
          detailsString.includes(term);

        if (!match) return false;
      }

      return true;
    });
  }, [logs, currentCampusId, canManageAllCampuses, user.campus_id, selectedCampusFilter, selectedActionFilter, dateFrom, dateTo, searchTerm]);

  // Réinitialiser la page si les résultats filtrés diminuent
  useEffect(() => {
    const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [filteredLogs.length, pageSize, currentPage]);

  // Données de la page courante
  const paginatedLogs = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredLogs.slice(startIdx, startIdx + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));

  // Statistiques condensées
  const stats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    let todayCount = 0;
    let criticalCount = 0;
    const usersSet = new Set<string>();

    logs.forEach(l => {
      const d = new Date(l.created_at).toISOString().split('T')[0];
      if (d === todayStr) todayCount++;
      if (['DELETE', 'FIRE_STAFF', 'PASSWORD_RESET', 'RESET_PASSWORD'].includes(l.action)) criticalCount++;
      if (l.profiles?.email) usersSet.add(l.profiles.email);
    });

    return {
      total: logs.length,
      today: todayCount,
      critical: criticalCount,
      activeUsers: usersSet.size
    };
  }, [logs]);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;

    const headers = ["Date & Heure", "Utilisateur", "Email", "Rôle", "Annexe", "Action", "Entité", "Description", "ID Entité"];
    const rows = filteredLogs.map(l => {
      const logCampusId = l.profiles?.campus_id;
      const isSiege = !logCampusId || logCampusId === '3dd425c2-2e23-4e3c-a02a-c67ed85ca490';
      const campusName = isSiege ? "Siège Social" : (campuses.find(c => c.id === logCampusId)?.name || 'Inconnue');

      return [
        `"${new Date(l.created_at).toLocaleString('fr-FR')}"`,
        `"${(l.profiles?.full_name || 'Inconnu').replace(/"/g, '""')}"`,
        `"${(l.profiles?.email || '').replace(/"/g, '""')}"`,
        `"${(l.profiles?.role || '').replace(/"/g, '""')}"`,
        `"${campusName.replace(/"/g, '""')}"`,
        `"${translateAction(l.action)}"`,
        `"${translateEntity(l.entity_type)}"`,
        `"${generateActionDescription(l).replace(/"/g, '""')}"`,
        `"${l.entity_id || ''}"`
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 10);
    link.setAttribute('href', url);
    link.setAttribute('download', `edunova_journal_audit_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copie des détails JSON
  const handleCopyDetails = (log: AuditLog) => {
    const text = typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2);
    navigator.clipboard.writeText(text);
    setCopiedLogId(log.id);
    setTimeout(() => setCopiedLogId(null), 2000);
  };

  // Styles visuels des actions
  const getActionBadge = (action: string) => {
    switch (action) {
      case 'LOGIN':
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-200/80',
          icon: <LogIn size={11} className="shrink-0 text-blue-600" />
        };
      case 'LOGOUT':
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          icon: <LogOut size={11} className="shrink-0 text-slate-500" />
        };
      case 'CREATE':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
          icon: <PlusCircle size={11} className="shrink-0 text-emerald-600" />
        };
      case 'UPDATE':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200/80',
          icon: <Edit3 size={11} className="shrink-0 text-amber-600" />
        };
      case 'DELETE':
      case 'FIRE_STAFF':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200/80',
          icon: <Trash2 size={11} className="shrink-0 text-rose-600" />
        };
      case 'PAYMENT_PROCESSED':
        return {
          bg: 'bg-teal-50 text-teal-700 border-teal-200/80',
          icon: <CreditCard size={11} className="shrink-0 text-teal-600" />
        };
      case 'PASSWORD_RESET':
      case 'RESET_PASSWORD':
        return {
          bg: 'bg-purple-50 text-purple-700 border-purple-200/80',
          icon: <KeyRound size={11} className="shrink-0 text-purple-600" />
        };
      default:
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          icon: <Tag size={11} className="shrink-0 text-slate-500" />
        };
    }
  };

  // Options pour le composant SelectPill des campus
  const campusOptions: SelectOption[] = useMemo(() => {
    const list: SelectOption[] = [
      { value: 'ALL', label: 'Toutes les annexes', badge: 'Global' },
      { value: 'SIEGE', label: 'Siège Social uniquement', badge: 'Central' }
    ];
    if (campuses && campuses.length > 0) {
      campuses
        .filter(c => !c.name.toLowerCase().includes('siège'))
        .forEach(c => {
          list.push({
            value: c.id,
            label: c.name,
            badge: 'Annexe'
          });
        });
    }
    return list;
  }, [campuses]);

  // Options pour SelectPill d'action
  const actionOptions: SelectOption[] = [
    { value: 'ALL', label: 'Toutes les actions', badge: 'Tout' },
    { value: 'CREATE', label: 'Créations uniquement', badge: 'Nouveau' },
    { value: 'UPDATE', label: 'Modifications', badge: 'Édition' },
    { value: 'DELETE_OR_FIRE', label: 'Suppressions & Licenciements', badge: 'Sensible' },
    { value: 'PAYMENT', label: 'Opérations Financières', badge: 'Comptable' },
    { value: 'AUTH', label: 'Connexions & Mots de passe', badge: 'Sécurité' },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-3">
        <Loader2 className="animate-spin text-blue-600" size={36} />
        <p className="text-xs font-semibold text-slate-500 animate-pulse">
          Synchronisation du registre d'audit certifié...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 max-w-7xl mx-auto pb-12 animate-in fade-in duration-200">
      
      {/* ========================================================= */}
      {/* EN-TÊTE COMPACT ET ERGONOMIQUE                            */}
      {/* ========================================================= */}
      <header className="bg-white p-3.5 sm:p-4 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl flex items-center justify-center shadow-2xs shrink-0">
            <History size={20} className="text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-none">
                Journal d'Audit & Traçabilité
              </h1>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                isUniversity 
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                {isUniversity ? 'Enseignement Supérieur' : 'Système Scolaire Connecté'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Registre Immuable
              </span>
            </div>
            <p className="text-slate-500 text-xs font-medium mt-0.5">
              Historique horodaté et certifié des flux opérationnels, administratifs et académiques.
            </p>
          </div>
        </div>

        {/* Actions rapides de l'en-tête */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => fetchLogs(true)}
            disabled={isRefreshing}
            className="p-2 sm:px-3 sm:py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Rafraîchir les logs"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-blue-600' : ''} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredLogs.length === 0}
            className="p-2 sm:px-3 sm:py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            title="Exporter les logs affichés en CSV"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Exporter ({filteredLogs.length})</span>
          </button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* BANDEAU DES INDICATEURS STATISTIQUES (COMPACT)            */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/80 shadow-2xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <FileText size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">Total Événements</p>
            <p className="text-base font-extrabold text-slate-900 leading-tight">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/80 shadow-2xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <Clock size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">Aujourd'hui</p>
            <p className="text-base font-extrabold text-emerald-700 leading-tight">{stats.today}</p>
          </div>
        </div>

        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/80 shadow-2xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
            <AlertTriangle size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">Actions Sensibles</p>
            <p className="text-base font-extrabold text-rose-700 leading-tight">{stats.critical}</p>
          </div>
        </div>

        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/80 shadow-2xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
            <User size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">Utilisateurs Actifs</p>
            <p className="text-base font-extrabold text-purple-700 leading-tight">{stats.activeUsers}</p>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* ALERTES ERREURS OU NOTIFICATIONS HISTORIQUES             */}
      {/* ========================================================= */}
      {error && (
        <div className="bg-rose-50 text-rose-800 p-3 rounded-xl border border-rose-200/80 flex items-start gap-2.5 text-xs font-medium shadow-2xs animate-in fade-in">
          <ShieldAlert size={16} className="mt-0.5 shrink-0 text-rose-600" />
          <div>
            <span className="font-bold">Avertissement :</span> {error}
          </div>
        </div>
      )}

      {lastAuditError && (
        <div className="bg-amber-50 text-amber-900 p-3 rounded-xl border border-amber-200/80 relative shadow-2xs animate-in fade-in">
          <button 
            onClick={() => {
              try { window.localStorage.removeItem('last_audit_error'); } catch (e) {}
              setLastAuditError(null);
            }}
            className="absolute top-2.5 right-2.5 p-1 text-amber-500 hover:text-amber-800 hover:bg-amber-100 rounded-lg transition-all cursor-pointer"
            title="Masquer"
          >
            <X size={14} />
          </button>
          <div className="flex items-center gap-2 font-bold text-xs mb-1">
            <ShieldAlert size={14} className="text-amber-600 shrink-0" />
            <span>Historique de diagnostic Supabase :</span>
          </div>
          <pre className="text-[11px] bg-white/80 p-2 rounded-lg border border-amber-200/60 overflow-auto font-mono text-slate-700 max-h-24">
            {lastAuditError}
          </pre>
        </div>
      )}

      {/* ========================================================= */}
      {/* PANNEAU DE FILTRES ET RECHERCHE CONCENTRÉE                */}
      {/* ========================================================= */}
      <div className="bg-white p-3 sm:p-3.5 rounded-2xl shadow-xs border border-slate-200/80 space-y-2.5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 sm:gap-2.5">
          
          {/* Recherche textuelle en direct */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
            <input
              type="text"
              placeholder={`Rechercher par utilisateur, email, action, ${isUniversity ? 'étudiant, cours' : 'élève, classe'}...`}
              className="w-full pl-9 pr-8 py-2 bg-slate-50/70 hover:bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/10 outline-none transition-all shadow-2xs placeholder:text-slate-400"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filtre Type d'Action via SelectPill */}
          <div className="w-full lg:w-56 shrink-0">
            <SelectPill
              value={selectedActionFilter}
              onChange={(val) => {
                setSelectedActionFilter(val);
                setCurrentPage(1);
              }}
              options={actionOptions}
              variant="field"
              size="sm"
              colorScheme="slate"
              icon={Filter}
              portal={true}
              className="w-full"
            />
          </div>

          {/* Filtre Annexe / Campus si multi-campus */}
          {canManageAllCampuses && (
            <div className="w-full lg:w-56 shrink-0">
              <SelectPill
                value={selectedCampusFilter}
                onChange={(val) => {
                  setSelectedCampusFilter(val);
                  setCurrentPage(1);
                }}
                options={campusOptions}
                variant="field"
                size="sm"
                colorScheme="emerald"
                icon={Building2}
                portal={true}
                className="w-full"
              />
            </div>
          )}
        </div>

        {/* Ligne 2 : Période de Date et Raccourcis temporels (Harmonisé DatePickerPill) */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[11px] uppercase tracking-wider shrink-0">
              <Calendar size={13} className="text-blue-600" />
              <span>Période :</span>
            </div>

            {/* Date début (Harmonisé DatePickerPill) */}
            <div className="w-36 sm:w-44 shrink-0">
              <DatePickerPill
                selectedDate={dateFrom}
                onSelectDate={(newDate) => {
                  setDateFrom(newDate);
                  setActiveDatePreset('ALL');
                  setCurrentPage(1);
                }}
                labelPrefix="Du"
                placeholder="Date de début"
                variant="field"
                size="sm"
                colorScheme="blue"
                showShortcuts={false}
                showQuickArrows={false}
                showTodayBadge={false}
                clearable={true}
                className="w-full"
              />
            </div>

            <span className="text-slate-400 font-bold text-xs shrink-0">au</span>

            {/* Date fin (Harmonisé DatePickerPill) */}
            <div className="w-36 sm:w-44 shrink-0">
              <DatePickerPill
                selectedDate={dateTo}
                onSelectDate={(newDate) => {
                  setDateTo(newDate);
                  setActiveDatePreset('ALL');
                  setCurrentPage(1);
                }}
                labelPrefix="Au"
                placeholder="Date de fin"
                variant="field"
                size="sm"
                colorScheme="blue"
                showShortcuts={false}
                showQuickArrows={false}
                showTodayBadge={false}
                clearable={true}
                dropdownAlign="right"
                className="w-full"
              />
            </div>

            {/* Raccourcis rapides */}
            <div className="flex items-center gap-1 bg-slate-100/90 p-0.5 rounded-lg border border-slate-200/60 shrink-0">
              <button
                type="button"
                onClick={() => applyDatePreset('TODAY')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  activeDatePreset === 'TODAY' 
                    ? 'bg-white text-blue-700 shadow-2xs font-extrabold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Aujourd'hui
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('7D')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  activeDatePreset === '7D' 
                    ? 'bg-white text-blue-700 shadow-2xs font-extrabold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                7 jours
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('30D')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  activeDatePreset === '30D' 
                    ? 'bg-white text-blue-700 shadow-2xs font-extrabold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                30 jours
              </button>
            </div>
          </div>

          {/* Réinitialisation et sélecteur taille de page */}
          <div className="flex items-center gap-2 ml-auto">
            {isAnyFilterActive && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200/70 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              >
                <X size={12} />
                <span>Réinitialiser</span>
              </button>
            )}

            <div className="flex items-center gap-1 text-[11px] text-slate-500 font-bold">
              <span>Lignes :</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-0.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-lg font-bold text-xs outline-none cursor-pointer"
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TABLEAU COMPACT ET RESPONSIVE                             */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        
        {/* Entête du tableau avec compte d'affichage */}
        <div className="px-3.5 py-2.5 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <span>Flux de traçabilité des opérations</span>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">
            {filteredLogs.length === 0 
              ? 'Aucun résultat' 
              : `${filteredLogs.length} événement${filteredLogs.length > 1 ? 's' : ''} trouvé${filteredLogs.length > 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Tableau scrollable */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider select-none">
                <th className="py-2.5 px-3 border-b border-slate-800 whitespace-nowrap">Horodatage</th>
                <th className="py-2.5 px-3 border-b border-slate-800 whitespace-nowrap">Auteur / Opérateur</th>
                {hasMultiCampusActive && (
                  <th className="py-2.5 px-3 border-b border-slate-800 whitespace-nowrap">Annexe</th>
                )}
                <th className="py-2.5 px-3 border-b border-slate-800 whitespace-nowrap">Action</th>
                <th className="py-2.5 px-3 border-b border-slate-800 whitespace-nowrap">Entité</th>
                <th className="py-2.5 px-3 border-b border-slate-800 min-w-[280px]">Détails de l'Opération</th>
                <th className="py-2.5 px-3 border-b border-slate-800 text-right whitespace-nowrap">Inspecter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={hasMultiCampusActive ? 7 : 6} className="py-12 px-4 text-center">
                    <div className="max-w-sm mx-auto space-y-2">
                      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <Search size={18} />
                      </div>
                      <p className="font-bold text-slate-800 text-sm">Aucun événement ne correspond à ces critères</p>
                      <p className="text-slate-500 text-xs">
                        Essayez de modifier vos filtres de recherche ou réinitialisez la période.
                      </p>
                      {isAnyFilterActive && (
                        <button
                          type="button"
                          onClick={resetAllFilters}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          <RefreshCw size={13} />
                          Réinitialiser les filtres
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const logCampusId = log.profiles?.campus_id;
                  const isSiegeLog = !logCampusId || logCampusId === '3dd425c2-2e23-4e3c-a02a-c67ed85ca490';
                  const campusName = isSiegeLog 
                    ? "Siège Central" 
                    : (campuses.find(c => c.id === logCampusId)?.name || 'Annexe');

                  const actionBadge = getActionBadge(log.action);
                  const description = generateActionDescription(log);

                  return (
                    <tr 
                      key={log.id} 
                      className="hover:bg-blue-50/30 transition-colors group"
                    >
                      {/* 1. Horodatage Style Pilule Harmonisé */}
                      <td className="py-2 px-3 align-top whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200/90 shadow-2xs transition-colors group-hover:border-blue-200">
                          <Calendar size={12} className="text-blue-600 shrink-0 stroke-[2.2]" />
                          <span className="font-extrabold text-[11px] text-slate-800">
                            {new Date(log.created_at).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                          <span className="text-slate-300 font-light">•</span>
                          <Clock size={11} className="text-slate-400 shrink-0" />
                          <span className="font-mono text-[10px] text-slate-500 font-semibold">
                            {new Date(log.created_at).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </span>
                        </div>
                      </td>

                      {/* 2. Utilisateur */}
                      <td className="py-2 px-3 align-top">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center font-black text-xs shrink-0 shadow-2xs group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-colors">
                            {log.profiles?.full_name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate leading-snug">
                              {log.profiles?.full_name || 'Utilisateur Système'}
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium truncate">
                              {log.profiles?.role || 'Utilisateur'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 3. Annexe si multi-campus */}
                      {hasMultiCampusActive && (
                        <td className="py-2 px-3 align-top whitespace-nowrap">
                          {isSiegeLog ? (
                            <span className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/80 rounded-md text-[10px] font-extrabold tracking-wide">
                              Siège Central
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-md text-[10px] font-bold tracking-wide">
                              {campusName}
                            </span>
                          )}
                        </td>
                      )}

                      {/* 4. Action avec pastille */}
                      <td className="py-2 px-3 align-top whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-extrabold border ${actionBadge.bg}`}>
                          {actionBadge.icon}
                          <span>{translateAction(log.action)}</span>
                        </span>
                      </td>

                      {/* 5. Entité */}
                      <td className="py-2 px-3 align-top whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100/80 text-slate-700 rounded-lg text-[11px] font-bold border border-slate-200/70">
                          <Tag size={11} className="text-slate-400" />
                          <span>{translateEntity(log.entity_type)}</span>
                        </div>
                      </td>

                      {/* 6. Description & détails opérationnels */}
                      <td className="py-2 px-3 align-top">
                        <div className="text-slate-800 font-medium leading-relaxed break-words line-clamp-2 sm:line-clamp-3">
                          {description}
                        </div>
                      </td>

                      {/* 7. Bouton Inspecter le log */}
                      <td className="py-2 px-3 align-top text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedLogForModal(log)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                          title="Inspecter le payload complet"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ========================================================= */}
        {/* CONTRÔLES DE PAGINATION INTÉGRÉS                          */}
        {/* ========================================================= */}
        {filteredLogs.length > 0 && (
          <div className="px-3.5 py-2.5 bg-slate-50/80 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-600 font-medium">
              Affichage de <span className="font-bold text-slate-900">{(currentPage - 1) * pageSize + 1}</span> à{' '}
              <span className="font-bold text-slate-900">{Math.min(currentPage * pageSize, filteredLogs.length)}</span> sur{' '}
              <span className="font-bold text-slate-900">{filteredLogs.length}</span> entrées (Page {currentPage} sur {totalPages})
            </div>

            <div className="flex items-center gap-1 self-center">
              {/* Premier */}
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs"
                title="Première page"
              >
                <ChevronsLeft size={14} />
              </button>

              {/* Précédent */}
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs"
                title="Page précédente"
              >
                <ChevronLeft size={14} />
              </button>

              {/* Numéros de page dynamiques */}
              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    return page === 1 || 
                           page === totalPages || 
                           Math.abs(page - currentPage) <= 1;
                  })
                  .reduce((acc: (number | string)[], page, idx, arr) => {
                    if (idx > 0 && page - (arr[idx - 1] as number) > 1) {
                      acc.push('...');
                    }
                    acc.push(page);
                    return acc;
                  }, [])
                  .map((item, idx) => {
                    if (item === '...') {
                      return (
                        <span key={`dots-${idx}`} className="px-1 text-slate-400 font-bold select-none">
                          …
                        </span>
                      );
                    }
                    const pageNum = item as number;
                    const isCurrent = pageNum === currentPage;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-blue-600 text-white shadow-2xs font-extrabold'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
              </div>

              {/* Suivant */}
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs"
                title="Page suivante"
              >
                <ChevronRight size={14} />
              </button>

              {/* Dernier */}
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs"
                title="Dernière page"
              >
                <ChevronsRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL D'INSPECTION DÉTAILLÉE DU LOG                       */}
      {/* ========================================================= */}
      {selectedLogForModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* Header Modal */}
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <ShieldAlert size={18} className="text-blue-400" />
                <h3 className="font-bold text-sm tracking-tight">
                  Détail de l'Enregistrement d'Audit
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLogForModal(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Corps Modal */}
            <div className="p-4 overflow-y-auto space-y-3.5 text-xs">
              
              {/* Résumé des métadonnées */}
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                <div>
                  <span className="text-slate-500 font-bold block text-[10px] uppercase">Auteur :</span>
                  <span className="font-bold text-slate-900">{selectedLogForModal.profiles?.full_name || 'Système'}</span>
                  <span className="text-[10px] text-slate-500 block">{selectedLogForModal.profiles?.email || 'N/A'}</span>
                </div>

                <div>
                  <span className="text-slate-500 font-bold block text-[10px] uppercase">Rôle :</span>
                  <span className="font-bold text-slate-900">{selectedLogForModal.profiles?.role || 'Utilisateur'}</span>
                </div>

                <div>
                  <span className="text-slate-500 font-bold block text-[10px] uppercase mb-1">Horodatage précis :</span>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white text-slate-800 rounded-lg border border-slate-200 font-bold text-xs shadow-2xs">
                    <Calendar size={12} className="text-blue-600 shrink-0 stroke-[2.2]" />
                    <span>
                      {new Date(selectedLogForModal.created_at).toLocaleDateString('fr-FR', {
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                    <span className="text-slate-300">•</span>
                    <Clock size={11} className="text-slate-500 shrink-0" />
                    <span className="font-mono text-slate-700">
                      {new Date(selectedLogForModal.created_at).toLocaleTimeString('fr-FR')}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-bold block text-[10px] uppercase">Action / Entité :</span>
                  <span className="font-bold text-slate-900">
                    {translateAction(selectedLogForModal.action)} ({translateEntity(selectedLogForModal.entity_type)})
                  </span>
                </div>
              </div>

              {/* Description explicite */}
              <div className="space-y-1">
                <span className="text-slate-500 font-bold text-[10px] uppercase tracking-wider block">
                  Description de l'action :
                </span>
                <p className="p-2.5 bg-blue-50 text-blue-900 font-medium rounded-xl border border-blue-200/80 leading-relaxed">
                  {generateActionDescription(selectedLogForModal)}
                </p>
              </div>

              {/* Payload JSON brut */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold text-[10px] uppercase tracking-wider block">
                    Payload Technique (Détails) :
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyDetails(selectedLogForModal)}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedLogId === selectedLogForModal.id ? (
                      <>
                        <Check size={12} className="text-emerald-600" />
                        <span className="text-emerald-600">Copié !</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copier</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] overflow-auto max-h-56 leading-tight border border-slate-800">
                  {typeof selectedLogForModal.details === 'string'
                    ? selectedLogForModal.details
                    : JSON.stringify(selectedLogForModal.details, null, 2)}
                </pre>
              </div>

              {/* Identifiants système */}
              <div className="text-[10px] text-slate-400 font-mono space-y-0.5 pt-2 border-t border-slate-100">
                <div>ID Log : {selectedLogForModal.id}</div>
                {selectedLogForModal.entity_id && (
                  <div>ID Entité ciblée : {selectedLogForModal.entity_id}</div>
                )}
              </div>
            </div>

            {/* Pied Modal */}
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedLogForModal(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
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
