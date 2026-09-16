import React, { useState, useEffect, useMemo } from 'react';
import { 
  History, Search, Filter, Calendar, 
  ArrowDownRight, ArrowUpRight, AlertCircle,
  FileText, User, Clock, Shield, Trash2, Edit3,
  Download, Printer, RefreshCw, ShieldCheck,
  ChevronLeft, ChevronRight, Eye, X, Copy, Check,
  FileSpreadsheet, ExternalLink, CreditCard,
  Wallet, DollarSign, Tag, CheckCircle2,
  Building2, ArrowRight, Layers, FileCode
} from 'lucide-react';
import { supabase } from '../supabase';
import { UserProfile } from '../types';
import { toast } from 'sonner';
import { useSchool } from '../contexts/SchoolContext';
import { SelectPill, SelectOption } from './SelectPill';
import { DatePickerPill } from './DatePickerPill';

interface AuditLog {
  id: string;
  created_at: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  details: any;
  profiles?: {
    full_name: string;
  };
}

// Dictionnaire de traduction des champs techniques pour les utilisateurs finaux
const FIELD_LABELS: Record<string, string> = {
  amount: 'Montant',
  amount_htg: 'Montant (HTG)',
  amount_usd: 'Montant (USD)',
  net_total_htg: 'Total Net (HTG)',
  net_total_usd: 'Total Net (USD)',
  cash_htg: 'Espèces (HTG)',
  cash_usd: 'Espèces (USD)',
  payment_method: 'Mode de versement',
  method: 'Mode de versement',
  receipt_number: 'N° de reçu',
  receipt_no: 'N° de reçu',
  reference_number: 'N° de référence',
  reference: 'Référence bordereau',
  transaction_id: 'ID Transaction',
  transaction_reference: 'Réf. Transaction',
  fee_type: 'Rubrique de frais',
  feetype: 'Rubrique de frais',
  feeType: 'Rubrique de frais',
  fee_type_id: 'Réf. Rubrique',
  plan_name: 'Rubrique / Échéance',
  plan_id: 'Plan de scolarité',
  category: 'Catégorie de dépense',
  expense_type: 'Type de dépense',
  student_name: 'Nom de l\'élève',
  student_id: 'Matricule / Réf. élève',
  student_matricule: 'Matricule élève',
  beneficiary: 'Bénéficiaire',
  payee: 'Bénéficiaire / Prestataire',
  vendor: 'Fournisseur / Prestataire',
  employee_name: 'Salarié / Collaborateur',
  staff_name: 'Membre du personnel',
  reason: 'Motif / Justification',
  motif: 'Motif',
  description: 'Description',
  notes: 'Remarques',
  comments: 'Commentaires',
  status: 'Statut',
  currency: 'Devise',
  closure_date: 'Date de clôture',
  due_date: 'Date d\'échéance',
  payment_date: 'Date de versement',
  date: 'Date',
  paid_by: 'Payeur',
  payer_name: 'Nom du payeur',
  recorded_by: 'Enregistré par',
  authorized_by: 'Autorisé par',
  discount_label: 'Régime d\'allègement',
  discount_rate: 'Taux de réduction (%)',
  discount_amount: 'Montant déduit',
  reduction_htg: 'Bourse / Déduction (HTG)',
  reduction_usd: 'Bourse / Déduction (USD)',
  url: 'Document / Bordereau',
  receipt_url: 'Reçu / Bordereau',
  attachment_url: 'Document joint',
  file_url: 'Fichier PDF',
  proof_url: 'Preuve de paiement',
  created_at: 'Date d\'enregistrement',
  updated_at: 'Date de modification',
  class_name: 'Classe',
  className: 'Classe',
  student_class: 'Classe',
  class_id: 'ID Classe',
  period: 'Période',
  academic_year: 'Année académique',
  academic_year_id: 'Session académique',
  exchange_rate: 'Taux de change',
  exchange_rate_applied: 'Taux appliqué',
  order_id: 'N° de Commande',
  channel: 'Canal de paiement',
  payment_channel: 'Canal de versement',
  cash_desk_id: 'Caisse',
  closure_id: 'Réf. Clôture',
  enrollment_id: 'Réf. Inscription',
  action_type: 'Type d\'opération'
};

const formatFieldKey = (key: string): string => {
  const low = key.toLowerCase();
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  if (FIELD_LABELS[low]) return FIELD_LABELS[low];
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .toUpperCase();
};

const getActionMeta = (action: string) => {
  const norm = (action || '').toUpperCase();
  if (norm === 'CREATE' || norm.includes('CREATE') || norm.includes('PROCESSED') || norm.includes('ENCAISSE')) {
    let label = 'Création';
    if (norm === 'PAYMENT_PROCESSED') label = 'Paiement';
    else if (norm === 'EXPENSE_CREATED') label = 'Dépense';
    else if (norm === 'PAYROLL_PROCESSED') label = 'Paie';
    return {
      label,
      fullLabel: norm.replace(/_/g, ' '),
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      badgeClass: 'bg-emerald-100 text-emerald-800',
      icon: <ArrowDownRight className="text-emerald-600 shrink-0" size={13} />
    };
  }
  if (norm === 'UPDATE' || norm.includes('MODIF') || norm.includes('UPDATE')) {
    let label = 'Modification';
    if (norm === 'CASH_CLOSURE_MODIFIED') label = 'Modif. Clôture';
    return {
      label,
      fullLabel: norm.replace(/_/g, ' '),
      bg: 'bg-amber-50 text-amber-700 border-amber-200',
      badgeClass: 'bg-amber-100 text-amber-800',
      icon: <Edit3 className="text-amber-600 shrink-0" size={13} />
    };
  }
  if (norm === 'DELETE' || norm.includes('DELETE') || norm.includes('SUPPR') || norm.includes('VOID') || norm.includes('CANCEL')) {
    let label = norm.includes('VOID') || norm.includes('CANCEL') ? 'Annulation' : 'Suppression';
    return {
      label,
      fullLabel: norm.replace(/_/g, ' '),
      bg: 'bg-rose-50 text-rose-700 border-rose-200',
      badgeClass: 'bg-rose-100 text-rose-800',
      icon: <Trash2 className="text-rose-600 shrink-0" size={13} />
    };
  }
  if (norm.includes('VALIDAT')) {
    return {
      label: 'Validation',
      fullLabel: norm.replace(/_/g, ' '),
      bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      badgeClass: 'bg-indigo-100 text-indigo-800',
      icon: <Check size={13} className="text-indigo-600 shrink-0" />
    };
  }
  if (norm.includes('REOPEN')) {
    return {
      label: 'Réouverture',
      fullLabel: norm.replace(/_/g, ' '),
      bg: 'bg-purple-50 text-purple-700 border-purple-200',
      badgeClass: 'bg-purple-100 text-purple-800',
      icon: <RefreshCw size={13} className="text-purple-600 shrink-0" />
    };
  }

  return {
    label: norm.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase()),
    fullLabel: norm.replace(/_/g, ' '),
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    badgeClass: 'bg-slate-200 text-slate-800',
    icon: <History size={13} className="text-slate-600 shrink-0" />
  };
};

const renderFieldValue = (key: string, value: any, detailsObj: any) => {
  const isUrl = isUrlString(value) || key.toLowerCase().includes('url');
  const isAmount = key.toLowerCase().includes('amount') || 
                   key.toLowerCase().includes('salary') || 
                   key.toLowerCase().includes('htg') || 
                   key.toLowerCase().includes('usd') || 
                   key.toLowerCase().includes('reduction') ||
                   key.toLowerCase().includes('total');

  if (isUrl && typeof value === 'string') {
    return (
      <div className="pt-0.5">
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer max-w-full truncate"
        >
          <FileText size={13} className="shrink-0" />
          <span className="truncate">Consulter le document</span>
          <ExternalLink size={11} className="shrink-0" />
        </a>
      </div>
    );
  }

  if (key === 'payment_method' || key === 'method') {
    return (
      <span className="inline-block px-2.5 py-1 bg-indigo-50 text-indigo-800 rounded-lg text-xs font-black border border-indigo-100 truncate max-w-full">
        {formatPaymentMethod(String(value))}
      </span>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${
        value ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
      }`}>
        {value ? 'Oui' : 'Non'}
      </span>
    );
  }

  if (isAmount && (typeof value === 'number' || (!isNaN(Number(value)) && String(value).trim() !== ''))) {
    const num = Number(value);
    const curr = detailsObj?.currency || (key.toLowerCase().includes('usd') ? 'USD' : 'HTG');
    return (
      <p className="text-xs font-black text-slate-900 font-mono tracking-tight truncate">
        {num.toLocaleString()} {curr}
      </p>
    );
  }

  if (typeof value === 'string') {
    // Si référence de frais ad-hoc
    if (value.startsWith('ADHOC_') || value.startsWith('adhoc_')) {
      const cleanRef = value.replace(/^ADHOC_/i, '');
      return (
        <div className="space-y-1 min-w-0">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">
            Frais Exceptionnel (Ad-hoc)
          </span>
          <p className="text-[10px] font-mono text-slate-500 break-all select-all leading-tight">
            Réf : {cleanRef}
          </p>
        </div>
      );
    }

    // Détection date ISO
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && !isNaN(Date.parse(value))) {
      return (
        <p className="text-xs font-bold text-slate-900 truncate">
          {new Date(value).toLocaleString('fr-FR')}
        </p>
      );
    }

    // Détection UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
    if (isUuid) {
      return (
        <span className="font-mono text-[10.5px] font-bold text-slate-800 bg-slate-100/90 px-2 py-0.5 rounded-md break-all select-all inline-block max-w-full border border-slate-200/60">
          {value}
        </span>
      );
    }

    return (
      <p className="text-xs font-bold text-slate-900 break-words break-all leading-snug">
        {value}
      </p>
    );
  }

  if (typeof value === 'object' && value !== null) {
    return (
      <div className="text-[10.5px] font-mono bg-slate-100/90 p-2 rounded-xl text-slate-800 break-all whitespace-pre-wrap max-h-36 overflow-y-auto border border-slate-200/80">
        {JSON.stringify(value, null, 2)}
      </div>
    );
  }

  return (
    <p className="text-xs font-bold text-slate-900 break-words">
      {String(value ?? '—')}
    </p>
  );
};

const formatPaymentMethod = (method?: string): string => {
  if (!method) return '';
  const m = String(method).toUpperCase();
  switch (m) {
    case 'CASH': case 'ESPECES': return 'Espèces';
    case 'MONCASH': return 'MonCash';
    case 'NATCASH': return 'NatCash';
    case 'BANK_TRANSFER': case 'VIREMENT': case 'TRANSFER': return 'Virement bancaire';
    case 'CHECK': case 'CHEQUE': return 'Chèque';
    case 'CARD': case 'CARTE': return 'Carte bancaire';
    case 'ONLINE': return 'Paiement en ligne';
    default: return method;
  }
};

const isUrlString = (str: any): boolean => {
  if (typeof str !== 'string') return false;
  return str.startsWith('http://') || str.startsWith('https://') || str.startsWith('data:image/') || str.startsWith('blob:');
};

const FinancialAuditView: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { currentCampusId } = useSchool();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [filterEntity, setFilterEntity] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Detail Modal state
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<AuditLog | null>(null);
  const [detailModalTab, setDetailModalTab] = useState<'METIER' | 'JSON'>('METIER');
  const [copiedDetail, setCopiedDetail] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select(`
          *,
          profiles:user_id (full_name)
        `)
        .eq('school_id', user.school_id)
        .order('created_at', { ascending: false });

      // Filter for financial entities
      const financialEntities = ['payment', 'expense', 'scholarship', 'discount', 'salary', 'payroll', 'cash_closure'];
      query = query.in('entity_type', financialEntities);

      if (filterAction !== 'ALL') {
        query = query.eq('action', filterAction);
      }
      if (filterEntity !== 'ALL') {
        query = query.eq('entity_type', filterEntity);
      }

      const { data, error } = await query.limit(500);

      if (error) throw error;
      setLogs(data || []);
      setCurrentPage(1);
    } catch (err: any) {
      toast.error("Erreur lors du chargement de l'audit: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filterAction, filterEntity]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Multi-campus/annex isolation filtering
      if (currentCampusId) {
        const logCampusId = log.details?.campus_id || log.details?.details?.campus_id;
        if (logCampusId && logCampusId !== currentCampusId) {
          return false;
        }
      }

      // Date range filtering
      if (startDate) {
        const logDate = new Date(log.created_at).toISOString().split('T')[0];
        if (logDate < startDate) return false;
      }
      if (endDate) {
        const logDate = new Date(log.created_at).toISOString().split('T')[0];
        if (logDate > endDate) return false;
      }

      // Text search
      const search = searchTerm ? searchTerm.toLowerCase().trim() : '';
      if (!search) return true;

      const detailsStr = log.details ? JSON.stringify(log.details).toLowerCase() : '';
      const userStr = log.profiles?.full_name?.toLowerCase() || '';
      const entityIdStr = log.entity_id ? String(log.entity_id).toLowerCase() : '';
      const actionStr = log.action ? String(log.action).toLowerCase() : '';
      const entityTypeStr = log.entity_type ? String(log.entity_type).toLowerCase() : '';

      return detailsStr.includes(search) || 
             userStr.includes(search) || 
             entityIdStr.includes(search) ||
             actionStr.includes(search) ||
             entityTypeStr.includes(search);
    });
  }, [logs, currentCampusId, startDate, endDate, searchTerm]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, startDate, endDate, filterAction, filterEntity, itemsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage, itemsPerPage]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'CREATE': return <ArrowDownRight className="text-emerald-600" size={15} />;
      case 'UPDATE': return <Edit3 className="text-amber-600" size={15} />;
      case 'DELETE': return <Trash2 className="text-rose-600" size={15} />;
      default: return <History size={15} />;
    }
  };

  const getEntityLabel = (type: string) => {
    switch (type) {
      case 'payment': return 'Paiement';
      case 'expense': return 'Dépense';
      case 'scholarship': return 'Bourse';
      case 'discount': return 'Réduction';
      case 'salary': return 'Salaire';
      case 'payroll': return 'Paie';
      case 'cash_closure': return 'Clôture Caisse';
      default: return type;
    }
  };

  const exportToCSV = () => {
    if (filteredLogs.length === 0) {
      toast.error("Aucune donnée à exporter.");
      return;
    }
    const headers = ["Date", "Signataire", "Action", "Entité", "ID Entité", "Détails Explicites"];
    const rows = filteredLogs.map(l => {
      const d = l.details || {};
      const desc = typeof d === 'object' 
        ? Object.entries(d)
            .filter(([k]) => k !== 'campus_id' && k !== 'school_id')
            .map(([k, v]) => `${FIELD_LABELS[k] || k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
            .join(' | ')
        : String(d);

      return [
        new Date(l.created_at).toLocaleString('fr-FR'),
        l.profiles?.full_name || 'Utilisateur Inconnu',
        l.action,
        getEntityLabel(l.entity_type),
        l.entity_id || '',
        `"${desc.replace(/"/g, '""')}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `audit_flux_financiers_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Fichier CSV généré avec succès !");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDetail(true);
    toast.success("Copié dans le presse-papier !");
    setTimeout(() => setCopiedDetail(false), 2000);
  };

  // Rendu intelligent et explicite des détails dans la colonne du tableau
  const renderCertifiedDetailsColumn = (log: AuditLog) => {
    const d = log.details;

    // Cas 1 : Clôtures de caisse
    if (d?.action_type === 'CASH_CLOSURE_REOPENED') {
      return (
        <div className="space-y-1.5 bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-amber-900 shadow-2xs">
          <div className="flex items-center gap-1.5 font-black text-amber-900 text-xs">
            <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 uppercase text-[9px] font-black tracking-wider">
              Caisse Réouverte
            </span>
            <span>Journée du {d.closure_date || 'N/A'}</span>
          </div>
          <p className="text-xs font-semibold text-amber-950">
            <span className="text-amber-800 font-bold">Motif officiel :</span> {d.reason || 'Non spécifié'}
          </p>
        </div>
      );
    }

    if (d?.action_type === 'CASH_CLOSURE_MODIFIED') {
      return (
        <div className="space-y-1.5 bg-purple-50 p-2.5 rounded-xl border border-purple-200 text-purple-900 shadow-2xs">
          <div className="flex items-center gap-1.5 font-black text-purple-900 text-xs">
            <span className="px-2 py-0.5 rounded-md bg-purple-200 text-purple-900 uppercase text-[9px] font-black tracking-wider">
              Clôture Modifiée
            </span>
            <span>Journée du {d.closure_date || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-purple-900">
            <span>Net Encaissé :</span>
            <span className="font-mono font-black">{Math.round(d.net_total_htg || 0).toLocaleString()} HTG</span>
            {d.net_total_usd > 0 && <span className="font-mono font-black text-purple-700">({d.net_total_usd} USD)</span>}
          </div>
        </div>
      );
    }

    if (d?.action_type === 'CASH_CLOSURE_VALIDATED') {
      return (
        <div className="space-y-1.5 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 text-emerald-900 shadow-2xs">
          <div className="flex items-center gap-1.5 font-black text-emerald-900 text-xs">
            <span className="px-2 py-0.5 rounded-md bg-emerald-200 text-emerald-900 uppercase text-[9px] font-black tracking-wider">
              Clôture Enregistrée
            </span>
            <span>Journée du {d.closure_date || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
            <span>Net Caisse :</span>
            <span className="font-mono font-black">{Math.round(d.net_total_htg || 0).toLocaleString()} HTG</span>
            {d.net_total_usd > 0 && <span className="font-mono font-black text-emerald-700">({d.net_total_usd} USD)</span>}
          </div>
        </div>
      );
    }

    // Cas 2 : Données simples non-objet
    if (!d || typeof d !== 'object') {
      return (
        <p className="line-clamp-2 leading-relaxed text-slate-700 break-words text-xs font-medium">
          {String(d || 'Aucun détail certifié')}
        </p>
      );
    }

    // Extraire les champs clés
    const amountVal = d.amount ?? d.amount_htg ?? d.amount_usd ?? d.total_amount ?? d.net_salary;
    const currencyVal = d.currency || (d.amount_usd ? 'USD' : 'HTG');
    const methodVal = formatPaymentMethod(d.payment_method || d.method);
    const receiptNo = d.receipt_number || d.receipt_no || d.reference_number || d.reference || d.transaction_id;
    const feeLabel = d.fee_type || d.plan_name || d.category || d.expense_type || d.label || d.description || d.motif;
    const studentOrPerson = d.student_name || d.beneficiary || d.payee || d.employee_name || d.vendor;
    const docUrl = d.url || d.receipt_url || d.attachment_url || d.file_url || d.proof_url;

    // Cas 3 : Suppression (DELETE)
    if (log.action === 'DELETE') {
      return (
        <div className="space-y-1 bg-rose-50/70 p-2.5 rounded-xl border border-rose-200 text-rose-900">
          <div className="flex items-center gap-1.5 font-black text-xs text-rose-800">
            <Trash2 size={13} className="text-rose-600" />
            <span>Suppression définitive {log.entity_id ? `(#${log.entity_id.substring(0, 8)})` : ''}</span>
          </div>
          {amountVal !== undefined && (
            <p className="text-xs font-bold text-rose-900">
              Montant annulé : <span className="font-mono font-black">{Number(amountVal).toLocaleString()} {currencyVal}</span>
            </p>
          )}
          {feeLabel && <p className="text-[11px] text-rose-700 font-medium truncate">Motif : {feeLabel}</p>}
          {d.reason && <p className="text-[11px] text-slate-600 italic">Justification : {d.reason}</p>}
        </div>
      );
    }

    // Cas 4 : Modification (UPDATE)
    if (log.action === 'UPDATE') {
      const changeEntries = Object.entries(d).filter(([k]) => !['school_id', 'campus_id', 'updated_at', 'created_at'].includes(k));
      return (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-black uppercase tracking-wider">
              Modification
            </span>
            <span>Objet #{log.entity_id ? log.entity_id.substring(0, 8) : 'N/A'}</span>
          </div>

          <div className="space-y-1 max-h-20 overflow-y-auto pr-1">
            {changeEntries.slice(0, 3).map(([key, value]) => {
              const label = FIELD_LABELS[key] || key;
              const isUrl = isUrlString(value) || key.includes('url');
              const isAmount = key.includes('amount') || key.includes('salary') || key.includes('htg') || key.includes('usd');

              return (
                <div key={key} className="flex items-center gap-1.5 text-xs">
                  <span className="font-bold text-slate-500 shrink-0">{label} :</span>
                  {isUrl && typeof value === 'string' ? (
                    <a
                      href={value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold border border-indigo-200 transition-colors"
                    >
                      <FileText size={11} /> Consulter la pièce
                      <ExternalLink size={10} />
                    </a>
                  ) : (
                    <span className="text-slate-900 font-semibold truncate">
                      {isAmount && typeof value === 'number' 
                        ? `${value.toLocaleString()} HTG/USD`
                        : (typeof value === 'object' ? JSON.stringify(value) : String(value))}
                    </span>
                  )}
                </div>
              );
            })}
            {changeEntries.length > 3 && (
              <span className="text-[10px] text-indigo-600 font-bold block">
                +{changeEntries.length - 3} autres paramètres modifiés...
              </span>
            )}
          </div>
        </div>
      );
    }

    // Cas 5 : Création / Encaissement / Dépense / Bourse (CREATE)
    return (
      <div className="space-y-1.5">
        {/* Ligne 1 : Montant & Mode de règlement & N° Reçu */}
        <div className="flex items-center flex-wrap gap-2">
          {amountVal !== undefined && (
            <span className={`px-2 py-0.5 rounded-lg text-xs font-black font-mono tracking-tight ${
              log.entity_type === 'expense' 
                ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}>
              {log.entity_type === 'expense' ? '-' : '+'}{Number(amountVal).toLocaleString()} {currencyVal}
            </span>
          )}

          {methodVal && (
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-extrabold border border-slate-200">
              {methodVal}
            </span>
          )}

          {receiptNo && (
            <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-100 truncate max-w-[150px]">
              Réf : {receiptNo}
            </span>
          )}
        </div>

        {/* Ligne 2 : Rubrique & Bénéficiaire / Élève */}
        <div className="text-xs text-slate-700 leading-snug">
          {feeLabel && (
            <span className="font-bold text-slate-900">
              {feeLabel}
            </span>
          )}
          {studentOrPerson && (
            <span className="text-slate-600 font-medium ml-1.5">
              • Pour : <strong className="text-slate-800">{studentOrPerson}</strong>
            </span>
          )}
          {d.className && (
            <span className="text-slate-500 font-medium ml-1">
              ({d.className})
            </span>
          )}
        </div>

        {/* Ligne 3 : Pièce justificative / Reçu cliquable si présent */}
        {docUrl && typeof docUrl === 'string' && isUrlString(docUrl) && (
          <div className="pt-0.5">
            <a
              href={docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold border border-indigo-200 transition-colors shadow-2xs"
            >
              <FileText size={12} className="text-indigo-600" />
              <span>Consulter le document</span>
              <ExternalLink size={10} className="text-indigo-500" />
            </a>
          </div>
        )}
      </div>
    );
  };

  // Rendu épuré et propre du corps du modal sans débordement
  const renderDetailModalContent = (log: AuditLog) => {
    const d = log.details;
    const isObject = d && typeof d === 'object' && !Array.isArray(d);

    return (
      <div className="space-y-4 min-w-0">
        {/* En-tête avec bascule propre JSON si nécessaire */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
            <Layers size={14} className="text-indigo-600 shrink-0" />
            <span className="truncate">
              {detailModalTab === 'METIER' ? "Paramètres enregistrés" : "Données techniques brutes"}
            </span>
          </span>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setDetailModalTab(prev => prev === 'METIER' ? 'JSON' : 'METIER')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200/80 shadow-2xs"
            >
              {detailModalTab === 'METIER' ? 'Format JSON brut' : 'Vue formulaire'}
            </button>
            {detailModalTab === 'JSON' && (
              <button
                type="button"
                onClick={() => copyToClipboard(JSON.stringify(log.details, null, 2))}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 active:scale-95 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200 shadow-2xs"
              >
                {copiedDetail ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                <span>{copiedDetail ? "Copié !" : "Copier"}</span>
              </button>
            )}
          </div>
        </div>

        {detailModalTab === 'METIER' ? (
          <div className="space-y-3 min-w-0">
            {/* Grille des informations structurées */}
            {isObject ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 min-w-0">
                {Object.entries(d)
                  .filter(([key]) => !['school_id', 'campus_id', 'updated_at', 'created_at'].includes(key))
                  .map(([key, value]) => {
                    const label = formatFieldKey(key);

                    return (
                      <div
                        key={key}
                        className="p-3 bg-slate-50/90 rounded-2xl border border-slate-200/80 space-y-1.5 shadow-2xs min-w-0 overflow-hidden flex flex-col justify-between"
                      >
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block truncate"
                          title={label}
                        >
                          {label}
                        </span>

                        <div className="min-w-0 overflow-hidden">
                          {renderFieldValue(key, value, d)}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-slate-800 text-xs font-medium break-words">
                {String(d || 'Aucun détail supplémentaire')}
              </div>
            )}
          </div>
        ) : (
          /* Vue JSON épurée sans débordement horizontal */
          <div className="space-y-2 min-w-0">
            <pre className="p-4 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-2xl overflow-x-auto max-h-80 leading-relaxed border border-slate-800 shadow-inner break-all whitespace-pre-wrap">
              {JSON.stringify(log.details, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };

  const ACTION_OPTIONS: SelectOption[] = [
    { value: 'ALL', label: 'Toutes Actions', icon: Filter },
    { value: 'CREATE', label: 'Créations (CREATE)' },
    { value: 'UPDATE', label: 'Modifications (UPDATE)' },
    { value: 'DELETE', label: 'Suppressions (DELETE)' }
  ];

  const ENTITY_OPTIONS: SelectOption[] = [
    { value: 'ALL', label: 'Toutes Entités', icon: Layers },
    { value: 'payment', label: 'Paiements Élèves' },
    { value: 'expense', label: "Dépenses d'Exploitation" },
    { value: 'scholarship', label: 'Bourses & Allègements' },
    { value: 'salary', label: 'Salaires & Paie' },
    { value: 'cash_closure', label: 'Clôtures de Caisse' }
  ];

  const PER_PAGE_OPTIONS: SelectOption[] = [
    { value: '10', label: '10 / page' },
    { value: '15', label: '15 / page' },
    { value: '25', label: '25 / page' },
    { value: '50', label: '50 / page' }
  ];

  const setDateShortcut = (type: 'today' | '7days' | 'month' | 'clear') => {
    const today = new Date();
    const formatYMD = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (type === 'today') {
      const todayStr = formatYMD(today);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (type === '7days') {
      const past = new Date(today);
      past.setDate(today.getDate() - 7);
      setStartDate(formatYMD(past));
      setEndDate(formatYMD(today));
    } else if (type === 'month') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setStartDate(formatYMD(startOfMonth));
      setEndDate(formatYMD(endOfMonth));
    } else if (type === 'clear') {
      setStartDate('');
      setEndDate('');
    }
  };

  return (
    <div className="space-y-3 sm:space-y-3.5 animate-in fade-in duration-300">
      {/* Header Compact et Harmonisé */}
      <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-xs border border-slate-200/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 bg-slate-900 text-white rounded-xl shadow-xs shrink-0">
            <ShieldCheck size={20} className="sm:size-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">Audit des Flux Financiers</h2>
            <p className="text-slate-500 text-xs mt-0.5 font-medium">
              Traçabilité certifiée, ventilation claire des écritures et pièces justificatives.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button 
            onClick={fetchLogs}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all border border-slate-200 shadow-2xs active:scale-95 cursor-pointer"
            title="Actualiser le journal"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={exportToCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-all shadow-xs font-bold text-xs tracking-wider uppercase active:scale-95 cursor-pointer"
          >
            <FileSpreadsheet size={14} /> <span>Exporter CSV</span>
          </button>
        </div>
      </div>

      {/* Filters Bar Compacte avec Sélecteurs Pilules & DateTime Harmonisé Feuille de Présence */}
      <div className="bg-white p-3 sm:p-3.5 rounded-xl sm:rounded-2xl shadow-xs border border-slate-200/90 space-y-2.5">
        {/* Ligne 1 : Recherche + Pilules d'Actions, Entités et Pagination */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
          {/* Champ Recherche Instantanée */}
          <div className="flex-1 min-w-0 relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors pointer-events-none" size={14} />
            <input 
              type="text"
              placeholder="Rechercher signataire, élève, rubrique, référence, montant..."
              className="w-full pl-8.5 pr-7 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-2xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Grille Sélecteurs Pilules (Harmonisé Feuille de Présence) */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
            <div className="col-span-1 min-w-[140px] sm:w-auto">
              <SelectPill
                options={ACTION_OPTIONS}
                value={filterAction}
                onChange={(val) => setFilterAction(val)}
                icon={Filter}
                variant="field"
                size="sm"
                colorScheme="indigo"
                className="w-full"
              />
            </div>

            <div className="col-span-1 min-w-[155px] sm:w-auto">
              <SelectPill
                options={ENTITY_OPTIONS}
                value={filterEntity}
                onChange={(val) => setFilterEntity(val)}
                icon={Layers}
                variant="field"
                size="sm"
                colorScheme="indigo"
                className="w-full"
              />
            </div>

            <div className="col-span-2 sm:col-span-1 sm:w-auto min-w-[110px]">
              <SelectPill
                options={PER_PAGE_OPTIONS}
                value={String(itemsPerPage)}
                onChange={(val) => setItemsPerPage(Number(val))}
                variant="field"
                size="sm"
                colorScheme="slate"
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Ligne 2 : Période DateTime Pilule Harmonisé + Raccourcis + Compteur d'écritures */}
        <div className="pt-2 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-500 flex items-center gap-1.5 text-[11px] uppercase tracking-wider shrink-0">
              <Calendar size={13} className="text-indigo-600" /> Période :
            </span>

            {/* Sélecteurs DateTime Pilule (Du ... Au ...) */}
            <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
              <div className="w-36 sm:w-40 min-w-0">
                <DatePickerPill
                  selectedDate={startDate}
                  onSelectDate={(newDate) => setStartDate(newDate)}
                  labelPrefix="Du "
                  placeholder="Date début"
                  variant="field"
                  size="sm"
                  colorScheme="indigo"
                  clearable={true}
                  className="w-full"
                />
              </div>
              <span className="text-slate-400 font-bold text-xs shrink-0">à</span>
              <div className="w-36 sm:w-40 min-w-0">
                <DatePickerPill
                  selectedDate={endDate}
                  onSelectDate={(newDate) => setEndDate(newDate)}
                  labelPrefix="Au "
                  placeholder="Date fin"
                  variant="field"
                  size="sm"
                  colorScheme="indigo"
                  clearable={true}
                  className="w-full"
                />
              </div>
            </div>

            {/* Pilules de raccourcis rapides */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 sm:pb-0">
              <button
                type="button"
                onClick={() => setDateShortcut('today')}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer"
              >
                Aujourd'hui
              </button>
              <button
                type="button"
                onClick={() => setDateShortcut('7days')}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer"
              >
                7 jours
              </button>
              <button
                type="button"
                onClick={() => setDateShortcut('month')}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer"
              >
                Ce mois
              </button>
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => setDateShortcut('clear')}
                  className="px-2 py-1 text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-all shrink-0 cursor-pointer flex items-center gap-1"
                >
                  <X size={11} /> Effacer
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-end md:self-auto">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-bold border border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>{filteredLogs.length} écriture{filteredLogs.length > 1 ? 's' : ''} certifiée{filteredLogs.length > 1 ? 's' : ''}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Audit Table Compacte et Dense avec Scroll Horizontal fluide */}
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-xs border border-slate-200/90 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[780px]">
            <thead>
              <tr className="bg-slate-900 text-slate-100 border-b border-slate-800">
                <th className="px-3.5 py-2.5 sm:px-4 sm:py-2.5 text-[10px] font-black text-slate-200 uppercase tracking-wider w-36 sm:w-40">Certifié le</th>
                <th className="px-3.5 py-2.5 sm:px-4 sm:py-2.5 text-[10px] font-black text-slate-200 uppercase tracking-wider w-40 sm:w-44">Signataire</th>
                <th className="px-3 py-2.5 sm:px-3.5 sm:py-2.5 text-[10px] font-black text-slate-200 uppercase tracking-wider w-28 sm:w-32">Type d'Acte</th>
                <th className="px-3 py-2.5 sm:px-3.5 sm:py-2.5 text-[10px] font-black text-slate-200 uppercase tracking-wider w-28 sm:w-32">Périmètre</th>
                <th className="px-3.5 py-2.5 sm:px-4 sm:py-2.5 text-[10px] font-black text-slate-200 uppercase tracking-wider">Détails de l'Opération</th>
                <th className="px-3 py-2.5 sm:px-3.5 sm:py-2.5 text-[10px] font-black text-slate-200 uppercase tracking-wider text-right w-16 sm:w-20">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
                    <p className="text-slate-600 text-xs font-bold mt-2">Analyse du journal d'audit en cours...</p>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center">
                    <AlertCircle className="w-6 h-6 text-slate-400 mx-auto" />
                    <p className="text-slate-500 text-xs font-bold mt-2">Aucune trace financière trouvée pour ces critères</p>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                    {/* Timestamp */}
                    <td className="px-3.5 py-2 sm:px-4 sm:py-2.5 whitespace-nowrap align-middle">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Clock size={12} className="text-slate-400 shrink-0" />
                        <span className="text-[11px] font-bold text-slate-900">
                          {new Date(log.created_at).toLocaleString('fr-FR', { 
                            day: '2-digit', 
                            month: 'short', 
                            year: 'numeric', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                    </td>

                    {/* Signer */}
                    <td className="px-3.5 py-2 sm:px-4 sm:py-2.5 whitespace-nowrap align-middle">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-md flex items-center justify-center text-[9px] font-black shrink-0">
                          {log.profiles?.full_name?.charAt(0) || 'U'}
                        </div>
                        <span className="text-xs font-bold text-slate-900 truncate max-w-[120px] sm:max-w-[140px]" title={log.profiles?.full_name || 'Utilisateur Inconnu'}>
                          {log.profiles?.full_name || 'Utilisateur Inconnu'}
                        </span>
                      </div>
                    </td>

                    {/* Action Type */}
                    <td className="px-3 py-2 sm:px-3.5 sm:py-2.5 whitespace-nowrap align-middle">
                      {(() => {
                        const meta = getActionMeta(log.action);
                        return (
                          <div className="flex items-center gap-1">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${meta.bg}`} title={meta.fullLabel}>
                              {meta.icon}
                              <span>{meta.label}</span>
                            </span>
                          </div>
                        );
                      })()}
                    </td>

                    {/* Entity */}
                    <td className="px-3 py-2 sm:px-3.5 sm:py-2.5 whitespace-nowrap align-middle">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md text-[10px] font-bold uppercase border border-slate-200 inline-block">
                        {getEntityLabel(log.entity_type)}
                      </span>
                    </td>

                    {/* Details column (Formatted preview) */}
                    <td className="px-3.5 py-2 sm:px-4 sm:py-2.5 align-middle">
                      <div className="text-[11px] text-slate-700 max-w-lg font-medium">
                        {renderCertifiedDetailsColumn(log)}
                      </div>
                    </td>

                    {/* Quick view button */}
                    <td className="px-3 py-2 sm:px-3.5 sm:py-2.5 text-right whitespace-nowrap align-middle">
                      <button
                        onClick={() => {
                          setSelectedLogForDetail(log);
                          setDetailModalTab('METIER');
                        }}
                        className="p-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded-lg border border-slate-200 transition-all cursor-pointer shadow-2xs"
                        title="Consulter le dossier d'audit complet"
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination Compacte */}
        {totalPages > 1 && (
          <div className="p-2.5 sm:p-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 bg-slate-50/80">
            <span className="text-xs text-slate-700 font-bold">
              Page {currentPage} sur {totalPages} ({filteredLogs.length} éléments au total)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer shadow-2xs transition-colors"
                title="Première page"
              >
                ««
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer shadow-2xs transition-colors"
              >
                Précédent
              </button>
              
              {/* Visible page pill */}
              <span className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-black shadow-2xs">
                {currentPage}
              </span>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer shadow-2xs transition-colors"
              >
                Suivant
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer shadow-2xs transition-colors"
                title="Dernière page"
              >
                »»
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLogForDetail && (() => {
        const actionMeta = getActionMeta(selectedLogForDetail.action);
        return (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="shrink-0 p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900 text-white rounded-t-3xl gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 bg-indigo-600/30 text-indigo-400 rounded-xl border border-indigo-500/30 shrink-0">
                    <ShieldCheck size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-white text-sm sm:text-base truncate">Détails de l'Opération</h3>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                      <span className="shrink-0">Réf. Audit :</span>
                      <span
                        className="font-mono font-bold text-indigo-300 truncate max-w-[180px] sm:max-w-[320px] select-all cursor-pointer hover:underline"
                        onClick={() => copyToClipboard(selectedLogForDetail.id)}
                        title="Cliquer pour copier la référence"
                      >
                        {selectedLogForDetail.id}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLogForDetail(null)}
                  className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer shrink-0"
                  title="Fermer la fenêtre"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
                {/* 4 Métriques en-tête avec min-w-0 et overflow-hidden */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 min-w-0 overflow-hidden flex flex-col justify-between shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider truncate">Date & Heure</span>
                    <p className="font-black text-slate-900 mt-1 text-xs truncate" title={new Date(selectedLogForDetail.created_at).toLocaleString('fr-FR')}>
                      {new Date(selectedLogForDetail.created_at).toLocaleString('fr-FR', {
                        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 min-w-0 overflow-hidden flex flex-col justify-between shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider truncate">Opérateur</span>
                    <p className="font-black text-slate-900 mt-1 text-xs truncate" title={selectedLogForDetail.profiles?.full_name || 'Inconnu'}>
                      {selectedLogForDetail.profiles?.full_name || 'Inconnu'}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 min-w-0 overflow-hidden flex flex-col justify-between shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider truncate">Action</span>
                    <div className="mt-1 min-w-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-black border ${actionMeta.bg} truncate max-w-full`}
                        title={selectedLogForDetail.action}
                      >
                        {actionMeta.icon}
                        <span className="truncate">{actionMeta.label}</span>
                      </span>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 min-w-0 overflow-hidden flex flex-col justify-between shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider truncate">Entité</span>
                    <p className="font-black text-slate-900 mt-1 text-xs truncate" title={getEntityLabel(selectedLogForDetail.entity_type)}>
                      {getEntityLabel(selectedLogForDetail.entity_type)}
                    </p>
                  </div>
                </div>

                {/* ID Entité avec bouton copier aligné et responsive */}
                {selectedLogForDetail.entity_id && (
                  <div className="p-3 sm:p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold text-indigo-700 uppercase block tracking-wider">ID de l'objet audité</span>
                      <span className="font-mono font-bold text-slate-900 text-xs break-all select-all block mt-0.5">
                        {selectedLogForDetail.entity_id}
                      </span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(selectedLogForDetail.entity_id)}
                      className="shrink-0 p-1.5 px-3 bg-white border border-indigo-200 hover:bg-indigo-50 active:scale-95 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all self-start sm:self-center"
                    >
                      {copiedDetail ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      <span>{copiedDetail ? "Copié !" : "Copier ID"}</span>
                    </button>
                  </div>
                )}

                {/* Rendu dynamique des détails */}
                {renderDetailModalContent(selectedLogForDetail)}
              </div>

              {/* Modal Footer */}
              <div className="shrink-0 p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between rounded-b-3xl gap-3">
                <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 min-w-0 truncate">
                  <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                  <span className="truncate">Entrée certifiée conforme dans le journal immuable</span>
                </div>
                <button
                  onClick={() => setSelectedLogForDetail(null)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 shadow-xs"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default FinancialAuditView;

const Loader2 = ({ className, size }: { className?: string, size?: number }) => (
  <RefreshCw className={`${className} animate-spin`} size={size} />
);
