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

interface AuditLog {
  id: string;
  created_at: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
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
  fee_type: 'Rubrique de frais',
  plan_name: 'Rubrique / Échéance',
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
  period: 'Période',
  academic_year: 'Année académique'
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

  // Rendu épuré et propre du corps du modal
  const renderDetailModalContent = (log: AuditLog) => {
    const d = log.details;
    const isObject = d && typeof d === 'object';

    return (
      <div className="space-y-4">
        {/* En-tête avec bascule propre JSON si nécessaire */}
        <div className="flex items-center justify-between pb-1">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            {detailModalTab === 'METIER' ? "Paramètres enregistrés" : "Données techniques brutes"}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDetailModalTab(prev => prev === 'METIER' ? 'JSON' : 'METIER')}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-all cursor-pointer border border-slate-200"
            >
              {detailModalTab === 'METIER' ? 'Voir format JSON' : 'Vue synthétique'}
            </button>
            {detailModalTab === 'JSON' && (
              <button
                onClick={() => copyToClipboard(JSON.stringify(log.details, null, 2))}
                className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 rounded-lg text-[11px] font-bold transition-colors cursor-pointer border border-slate-200 shadow-2xs"
              >
                {copiedDetail ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                {copiedDetail ? "Copié" : "Copier"}
              </button>
            )}
          </div>
        </div>

        {detailModalTab === 'METIER' ? (
          <div className="space-y-3">
            {/* Grille des informations structurées */}
            {isObject ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(d)
                  .filter(([key]) => !['school_id', 'campus_id', 'updated_at', 'created_at'].includes(key))
                  .map(([key, value]) => {
                    const label = FIELD_LABELS[key] || key;
                    const isUrl = isUrlString(value) || key.includes('url');
                    const isAmount = key.includes('amount') || key.includes('salary') || key.includes('htg') || key.includes('usd') || key.includes('reduction');

                    return (
                      <div key={key} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-1 shadow-2xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          {label}
                        </span>

                        {isUrl && typeof value === 'string' ? (
                          <div className="pt-0.5">
                            <a
                              href={value}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors shadow-xs"
                            >
                              <FileText size={13} />
                              <span>Consulter le document</span>
                              <ExternalLink size={11} />
                            </a>
                          </div>
                        ) : key === 'payment_method' || key === 'method' ? (
                          <span className="inline-block px-2.5 py-1 bg-indigo-50 text-indigo-800 rounded-lg text-xs font-extrabold border border-indigo-100">
                            {formatPaymentMethod(String(value))}
                          </span>
                        ) : (
                          <p className="text-xs font-bold text-slate-900 break-words">
                            {isAmount && typeof value === 'number'
                              ? `${value.toLocaleString()} ${d.currency || 'HTG'}`
                              : (typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value))}
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-slate-800 text-xs font-medium">
                {String(d || 'Aucun détail supplémentaire')}
              </div>
            )}
          </div>
        ) : (
          /* Vue JSON épurée */
          <div className="space-y-2">
            <pre className="p-4 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-2xl overflow-x-auto max-h-80 leading-relaxed border border-slate-800 shadow-inner">
              {JSON.stringify(log.details, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xs border border-slate-200/90 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="p-4 sm:p-5 bg-slate-900 text-white rounded-2xl shadow-md shrink-0">
            <ShieldCheck size={28} className="sm:w-8 sm:h-8" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Audit des Flux Financiers</h2>
            <p className="text-slate-600 text-xs sm:text-sm mt-0.5 font-medium">
              Traçabilité certifiée, ventilation claire des écritures et pièces justificatives.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-center">
          <button 
            onClick={fetchLogs}
            className="p-3 bg-white border border-slate-300 text-slate-800 rounded-xl hover:bg-slate-50 transition-all shadow-2xs active:scale-95 cursor-pointer"
            title="Actualiser le journal"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all shadow-sm font-bold text-xs tracking-wider uppercase active:scale-95 cursor-pointer"
          >
            <FileSpreadsheet size={16} /> Exporter CSV
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/90 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[240px] relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={16} />
            <input 
              type="text"
              placeholder="Rechercher par signataire, élève, rubrique, référence ou montant..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all shadow-2xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Filter size={15} className="text-slate-500" />
              <select 
                className="bg-white border border-slate-300 text-slate-900 rounded-xl text-xs font-bold py-2.5 px-3 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer shadow-2xs"
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
              >
                <option value="ALL" className="text-slate-900 font-bold">Toutes Actions</option>
                <option value="CREATE" className="text-slate-900 font-bold">Créations (CREATE)</option>
                <option value="UPDATE" className="text-slate-900 font-bold">Modifications (UPDATE)</option>
                <option value="DELETE" className="text-slate-900 font-bold">Suppressions (DELETE)</option>
              </select>
            </div>

            <select 
              className="bg-white border border-slate-300 text-slate-900 rounded-xl text-xs font-bold py-2.5 px-3 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer shadow-2xs"
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value)}
            >
              <option value="ALL" className="text-slate-900 font-bold">Toutes Entités</option>
              <option value="payment" className="text-slate-900 font-bold">Paiements Élèves</option>
              <option value="expense" className="text-slate-900 font-bold">Dépenses d'Exploitation</option>
              <option value="scholarship" className="text-slate-900 font-bold">Bourses & Allègements</option>
              <option value="salary" className="text-slate-900 font-bold">Salaires & Paie</option>
              <option value="cash_closure" className="text-slate-900 font-bold">Clôtures de Caisse</option>
            </select>

            <select
              className="bg-white border border-slate-300 text-slate-900 rounded-xl text-xs font-bold py-2.5 px-3 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer shadow-2xs"
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
            >
              <option value={10}>10 / page</option>
              <option value={15}>15 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-600 flex items-center gap-1.5 text-[11px]">
              <Calendar size={13} className="text-indigo-600" /> Période :
            </span>
            <div className="flex items-center gap-1.5">
              <input 
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:border-indigo-600 shadow-2xs"
                title="Date Début"
              />
              <span className="text-slate-400 font-bold">à</span>
              <input 
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:border-indigo-600 shadow-2xs"
                title="Date Fin"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="px-2 py-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
              >
                Effacer dates
              </button>
            )}
          </div>

          <span className="text-[11px] font-bold text-slate-500">
            {filteredLogs.length} écriture{filteredLogs.length > 1 ? 's' : ''} certifiée{filteredLogs.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Audit Table with Responsive Self-Contained Horizontal Scroll */}
      <div className="bg-white rounded-3xl shadow-xs border border-slate-200/90 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-900 text-slate-100 border-b border-slate-800">
                <th className="px-5 py-4 text-[10px] font-black text-slate-200 uppercase tracking-wider w-40">Certifié le</th>
                <th className="px-5 py-4 text-[10px] font-black text-slate-200 uppercase tracking-wider w-48">Signataire</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-200 uppercase tracking-wider w-32">Type d'Acte</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-200 uppercase tracking-wider w-32">Périmètre</th>
                <th className="px-5 py-4 text-[10px] font-black text-slate-200 uppercase tracking-wider">Détails de l'Opération</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-200 uppercase tracking-wider text-right w-20">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
                    <p className="text-slate-600 text-xs font-bold mt-4">Analyse du journal d'audit en cours...</p>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-slate-500 text-xs font-bold mt-4">Aucune trace financière trouvée pour ces critères</p>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                    {/* Timestamp */}
                    <td className="px-5 py-4 whitespace-nowrap align-top">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Clock size={13} className="text-slate-400 shrink-0" />
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
                    <td className="px-5 py-4 whitespace-nowrap align-top">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0">
                          {log.profiles?.full_name?.charAt(0) || 'U'}
                        </div>
                        <span className="text-xs font-bold text-slate-900 truncate max-w-[140px]" title={log.profiles?.full_name || 'Utilisateur Inconnu'}>
                          {log.profiles?.full_name || 'Utilisateur Inconnu'}
                        </span>
                      </div>
                    </td>

                    {/* Action Type */}
                    <td className="px-4 py-4 whitespace-nowrap align-top">
                      <div className="flex items-center gap-1.5">
                        {getActionIcon(log.action)}
                        <span className={`text-[10px] font-black uppercase tracking-wider ${
                          log.action === 'CREATE' ? 'text-emerald-700 font-extrabold' : 
                          log.action === 'UPDATE' ? 'text-amber-700 font-extrabold' : 'text-rose-700 font-extrabold'
                        }`}>
                          {log.action}
                        </span>
                      </div>
                    </td>

                    {/* Entity */}
                    <td className="px-4 py-4 whitespace-nowrap align-top">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg text-[10px] font-bold uppercase border border-slate-200 inline-block">
                        {getEntityLabel(log.entity_type)}
                      </span>
                    </td>

                    {/* Details column (Formatted preview) */}
                    <td className="px-5 py-4 align-top">
                      <div className="text-[11px] text-slate-700 max-w-lg font-medium">
                        {renderCertifiedDetailsColumn(log)}
                      </div>
                    </td>

                    {/* Quick view button */}
                    <td className="px-4 py-4 text-right whitespace-nowrap align-top">
                      <button
                        onClick={() => {
                          setSelectedLogForDetail(log);
                          setDetailModalTab('METIER');
                        }}
                        className="p-2 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded-xl border border-slate-200 transition-all cursor-pointer shadow-2xs"
                        title="Consulter le dossier d'audit complet"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/80">
            <span className="text-xs text-slate-700 font-bold">
              Page {currentPage} sur {totalPages} ({filteredLogs.length} éléments au total)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer shadow-2xs"
                title="Première page"
              >
                ««
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer shadow-2xs"
              >
                Précédent
              </button>
              
              {/* Visible page pill */}
              <span className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-black shadow-2xs">
                {currentPage}
              </span>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer shadow-2xs"
              >
                Suivant
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer shadow-2xs"
                title="Dernière page"
              >
                »»
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLogForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[88vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600/30 text-indigo-400 rounded-xl border border-indigo-500/30">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="font-black text-white text-sm">Détails de l'Opération</h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Réf. Audit : <span className="font-mono font-bold text-indigo-300">{selectedLogForDetail.id}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLogForDetail(null)}
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Date & Heure</span>
                  <p className="font-black text-slate-900 mt-0.5">
                    {new Date(selectedLogForDetail.created_at).toLocaleString('fr-FR')}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Opérateur</span>
                  <p className="font-black text-slate-900 mt-0.5 truncate" title={selectedLogForDetail.profiles?.full_name || 'Inconnu'}>
                    {selectedLogForDetail.profiles?.full_name || 'Inconnu'}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Action</span>
                  <p className={`font-black mt-0.5 uppercase ${
                    selectedLogForDetail.action === 'CREATE' ? 'text-emerald-700' :
                    selectedLogForDetail.action === 'UPDATE' ? 'text-amber-700' : 'text-rose-700'
                  }`}>
                    {selectedLogForDetail.action}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Entité</span>
                  <p className="font-black text-slate-900 mt-0.5 uppercase">
                    {getEntityLabel(selectedLogForDetail.entity_type)}
                  </p>
                </div>
              </div>

              {selectedLogForDetail.entity_id && (
                <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-indigo-700 uppercase block">ID de l'objet audité</span>
                    <span className="font-mono font-bold text-slate-900 text-xs">{selectedLogForDetail.entity_id}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(selectedLogForDetail.entity_id)}
                    className="p-1.5 px-3 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Copy size={12} /> Copier ID
                  </button>
                </div>
              )}

              {/* Rendu dynamique des détails */}
              {renderDetailModalContent(selectedLogForDetail)}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end rounded-b-3xl">
              <button
                onClick={() => setSelectedLogForDetail(null)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
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

export default FinancialAuditView;

const Loader2 = ({ className, size }: { className?: string, size?: number }) => (
  <RefreshCw className={`${className} animate-spin`} size={size} />
);
