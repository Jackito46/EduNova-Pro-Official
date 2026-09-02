import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  X, 
  CheckCircle2, 
  Lock, 
  Unlock, 
  Printer, 
  Calendar, 
  RefreshCcw, 
  ShieldCheck, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Receipt, 
  FileText, 
  Clock, 
  AlertTriangle,
  User,
  ChevronRight,
  Filter,
  Search,
  Check,
  Building2,
  RotateCcw,
  FileEdit,
  ShieldAlert,
  History,
  Eye,
  Info,
  BadgeCheck,
  AlertCircle,
  Download,
  FileSpreadsheet,
  Sparkles
} from 'lucide-react';
import { DatePickerPill } from './DatePickerPill';
import { toast } from 'sonner';
import { UserProfile, UserRole } from '../types';
import { useSchool } from '../contexts/SchoolContext';
import { 
  CashClosureRecord, 
  getCashClosureReport, 
  saveOrValidateCashClosure, 
  computeDailyTransactions,
  fetchClosureHistory,
  getCashClosureBadgeInfo,
  CashClosureBadgeType
} from '../services/cashClosureService';
import { AuditLogger } from '../utils/auditLogger';
import { getLocalTodayString } from '../utils/dateUtils';

interface DailyCashClosureModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  initialDate?: string;
  onClosureUpdated?: () => void;
}

export const DailyCashClosureModal: React.FC<DailyCashClosureModalProps> = ({
  isOpen,
  onClose,
  user,
  initialDate,
  onClosureUpdated
}) => {
  const { school, currentCampusId, terminology, campuses } = useSchool();
  const effectiveSchoolId = user?.school_id || school?.id;

  const [selectedDate, setSelectedDate] = useState<string>(initialDate || getLocalTodayString());
  const [selectedCampusId, setSelectedCampusId] = useState<string | null>(user?.campus_id || currentCampusId || null);
  const [report, setReport] = useState<CashClosureRecord | null>(null);
  const [rawTransactions, setRawTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [showUnlockConfirm, setShowUnlockConfirm] = useState<boolean>(false);
  const [reopenReason, setReopenReason] = useState<string>('');
  const [confirmKeyword, setConfirmKeyword] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'summary' | 'journal' | 'history'>('summary');
  
  // Printing & Export state
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState<boolean>(false);
  const [includeTransactionsInPrint, setIncludeTransactionsInPrint] = useState<boolean>(true);

  // Historical closures list state
  const [historyClosures, setHistoryClosures] = useState<CashClosureRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [historyFilter, setHistoryFilter] = useState<'ALL' | CashClosureBadgeType>('ALL');
  const [historySearch, setHistorySearch] = useState<string>('');

  // Keep campus in sync with user or context when modal opens
  useEffect(() => {
    if (user?.campus_id) {
      setSelectedCampusId(user.campus_id);
    } else if (currentCampusId !== undefined) {
      setSelectedCampusId(currentCampusId);
    }
  }, [user?.campus_id, currentCampusId]);

  const isAdmin = user.role === UserRole.SUPER_ADMIN || 
                  user.role === UserRole.SCHOOL_ADMIN || 
                  user.role === UserRole.DIRECTOR || 
                  user.is_super_admin;

  const hasMultipleCampuses = Boolean(campuses && campuses.length > 1);

  const activeCampusName = useMemo(() => {
    if (!hasMultipleCampuses) {
      return campuses && campuses.length === 1 ? campuses[0].name : null;
    }
    if (!selectedCampusId || selectedCampusId === 'GLOBAL') return "Tous les Campus (Vue Consolidée)";
    const found = campuses?.find(c => c.id === selectedCampusId);
    return found ? `Annexe : ${found.name}` : "Annexe Sélectionnée";
  }, [selectedCampusId, campuses, hasMultipleCampuses]);

  const loadReport = useCallback(async () => {
    if (!effectiveSchoolId) return;
    setLoading(true);
    try {
      const rep = await getCashClosureReport(effectiveSchoolId, selectedCampusId, selectedDate);
      setReport(rep);
      setNotes(rep.notes || '');

      // Compute transactions detail
      const computed = await computeDailyTransactions(effectiveSchoolId, selectedCampusId, selectedDate);
      setRawTransactions(computed.transactions || []);
    } catch (e) {
      console.error("Erreur chargement rapport de clôture:", e);
      toast.error("Erreur lors de la préparation du rapport de clôture.");
    } finally {
      setLoading(false);
    }
  }, [effectiveSchoolId, selectedCampusId, selectedDate]);

  const loadHistory = useCallback(async () => {
    if (!effectiveSchoolId) return;
    setHistoryLoading(true);
    try {
      const historyList = await fetchClosureHistory(effectiveSchoolId, selectedCampusId);
      setHistoryClosures(historyList);
    } catch (err) {
      console.error("Erreur chargement historique clôtures:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [effectiveSchoolId, selectedCampusId]);

  useEffect(() => {
    if (isOpen) {
      loadReport();
      loadHistory();
    }
  }, [isOpen, loadReport, loadHistory]);

  const currentBadgeInfo = useMemo(() => {
    return getCashClosureBadgeInfo(report);
  }, [report]);

  const handleValidateClosure = async () => {
    if (!report || !effectiveSchoolId) return;
    setIsValidating(true);
    try {
      const isPostReopen = Boolean(report.is_reopened || (report.reopen_count && report.reopen_count > 0) || report.reopen_reason);
      const auditTrail = report.audit_trail ? [...report.audit_trail] : [];
      
      auditTrail.push({
        action: isPostReopen ? 'MODIFIED' : 'VALIDATED',
        user_id: user.id,
        user_name: user.full_name || 'Administrateur',
        timestamp: new Date().toISOString(),
        notes: notes || undefined
      });

      const updatedReport: CashClosureRecord = {
        ...report,
        status: 'VALIDATED',
        notes: notes,
        validated_by: user.id,
        validated_by_name: user.full_name || 'Administrateur',
        validated_at: new Date().toISOString(),
        created_by: report.created_by || user.id,
        created_by_name: report.created_by_name || user.full_name || 'Caissier',
        created_at: report.created_at || new Date().toISOString(),
        is_reopened: false, // successfully re-closed
        is_modified: isPostReopen, // mark modified if it had been reopened
        audit_trail: auditTrail
      };

      const result = await saveOrValidateCashClosure(updatedReport);
      if (result.success) {
        setReport(updatedReport);

        // Audit Logger
        await AuditLogger.log({
          school_id: effectiveSchoolId,
          user_id: user.id,
          action: isPostReopen ? 'UPDATE' : 'CREATE',
          entity_type: 'payment',
          entity_id: `CASH_CLOSURE_${selectedDate}`,
          details: {
            action_type: isPostReopen ? 'CASH_CLOSURE_MODIFIED' : 'CASH_CLOSURE_VALIDATED',
            closure_date: selectedDate,
            campus_id: selectedCampusId,
            net_total_htg: report.net_total_htg,
            net_total_usd: report.net_total_usd,
            is_modified: isPostReopen,
            validated_by: user.full_name
          }
        });

        toast.success(
          isPostReopen 
            ? `Clôture modifiée du ${selectedDate} re-validée avec succès (Trace d'audit enregistrée).`
            : `Clôture de caisse originale du ${selectedDate} validée et verrouillée avec succès !`
        );
        if (onClosureUpdated) onClosureUpdated();
        await loadHistory();
      } else {
        toast.error(result.error || "Erreur lors de la validation.");
      }
    } catch (e: any) {
      console.error("Erreur validation clôture:", e);
      toast.error("Erreur lors de la validation de la clôture.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleReopenClosure = async () => {
    if (!report || !isAdmin || !effectiveSchoolId) return;

    const trimmedReason = reopenReason.trim();
    if (!trimmedReason || trimmedReason.length < 5) {
      toast.error("Veuillez saisir un motif explicatif d'au moins 5 caractères pour la réouverture de caisse.");
      return;
    }

    if (confirmKeyword.trim().toUpperCase() !== 'CONFIRMER') {
      toast.error("Saisie incorrecte : veuillez taper exactement le mot 'CONFIRMER' en majuscules.");
      return;
    }

    setIsValidating(true);
    try {
      const nowStr = new Date().toISOString();
      const auditTrail = report.audit_trail ? [...report.audit_trail] : [];
      
      auditTrail.push({
        action: 'REOPENED',
        user_id: user.id,
        user_name: user.full_name || 'Administrateur',
        timestamp: nowStr,
        reason: trimmedReason
      });

      const updatedNotes = notes 
        ? `${notes}\n[RÉOUVERTURE le ${new Date().toLocaleDateString('fr-FR')} par ${user.full_name || 'Admin'}]: ${trimmedReason}`
        : `[RÉOUVERTURE le ${new Date().toLocaleDateString('fr-FR')} par ${user.full_name || 'Admin'}]: ${trimmedReason}`;

      const updatedReport: CashClosureRecord = {
        ...report,
        status: 'OPEN',
        validated_by: undefined,
        validated_by_name: undefined,
        validated_at: undefined,
        is_reopened: true,
        reopen_count: (report.reopen_count || 0) + 1,
        reopen_reason: trimmedReason,
        reopened_by: user.id,
        reopened_by_name: user.full_name || 'Administrateur',
        reopened_at: nowStr,
        notes: updatedNotes,
        audit_trail: auditTrail
      };

      const res = await saveOrValidateCashClosure(updatedReport);
      if (res.success) {
        setReport(updatedReport);
        setNotes(updatedNotes);
        setShowUnlockConfirm(false);
        setReopenReason('');
        setConfirmKeyword('');

        // Audit Logger
        await AuditLogger.log({
          school_id: effectiveSchoolId,
          user_id: user.id,
          action: 'UPDATE',
          entity_type: 'payment',
          entity_id: `CASH_CLOSURE_${selectedDate}`,
          details: {
            action_type: 'CASH_CLOSURE_REOPENED',
            closure_date: selectedDate,
            campus_id: selectedCampusId,
            reason: trimmedReason,
            reopened_by: user.full_name,
            timestamp: nowStr
          }
        });

        toast.success(`Caisse du ${selectedDate} réouverte avec succès. Le motif a été consigné dans l'audit.`);
        if (onClosureUpdated) onClosureUpdated();
        await loadReport();
        await loadHistory();
      } else {
        toast.error(res.error || "Erreur lors de la réouverture.");
      }
    } catch (e) {
      console.error("Erreur réouverture:", e);
      toast.error("Erreur lors de la réouverture de la caisse.");
    } finally {
      setIsValidating(false);
    }
  };

  const handlePrintReport = () => {
    setIsPrintPreviewOpen(true);
  };

  const handleDirectPrint = () => {
    window.focus();
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleExportCSV = () => {
    if (!rawTransactions || rawTransactions.length === 0) {
      toast.error("Aucune transaction enregistrée pour cette journée.");
      return;
    }

    const headers = [
      "Date de Caisse",
      "Heure",
      "Type d'Opération",
      "Référence / Reçu",
      "Tiers / Élève",
      "Nature / Motif",
      "Mode de Règlement",
      "Montant",
      "Devise"
    ];

    const rows = rawTransactions.map(t => [
      `"${selectedDate}"`,
      `"${t.time || ''}"`,
      `"${t.type || ''}"`,
      `"${t.reference || ''}"`,
      `"${(t.student_name || '').replace(/"/g, '""')}"`,
      `"${(t.nature || '').replace(/"/g, '""')}"`,
      `"${t.payment_method || ''}"`,
      `"${t.amount || 0}"`,
      `"${t.currency || 'HTG'}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `PV_Cloture_Caisse_${selectedDate}_${(school?.name || 'Ecole').replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Journal de caisse exporté au format CSV / Excel avec succès !");
  };

  const filteredTransactions = useMemo(() => {
    if (!searchTerm) return rawTransactions;
    const term = searchTerm.toLowerCase();
    return rawTransactions.filter(t => 
      (t.student_name && t.student_name.toLowerCase().includes(term)) ||
      (t.nature && t.nature.toLowerCase().includes(term)) ||
      (t.reference && t.reference.toLowerCase().includes(term)) ||
      (t.payment_method && t.payment_method.toLowerCase().includes(term))
    );
  }, [rawTransactions, searchTerm]);

  // Filtered historical closures
  const filteredHistory = useMemo(() => {
    return historyClosures.filter(c => {
      const badgeInfo = getCashClosureBadgeInfo(c);
      if (historyFilter !== 'ALL' && badgeInfo.type !== historyFilter) {
        return false;
      }
      if (!historySearch.trim()) return true;
      const q = historySearch.toLowerCase();
      return (
        c.closure_date.includes(q) ||
        (c.validated_by_name && c.validated_by_name.toLowerCase().includes(q)) ||
        (c.reopened_by_name && c.reopened_by_name.toLowerCase().includes(q)) ||
        (c.reopen_reason && c.reopen_reason.toLowerCase().includes(q)) ||
        (c.notes && c.notes.toLowerCase().includes(q))
      );
    });
  }, [historyClosures, historyFilter, historySearch]);

  const selectHistoryDate = (dateStr: string, campusId?: string | null) => {
    setSelectedDate(dateStr);
    if (campusId !== undefined) {
      setSelectedCampusId(campusId);
    }
    setActiveTab('summary');
  };

  const renderPVContent = (isPrintOnly: boolean) => {
    const totalRecettesHTG = report?.total_collections_htg || 0;
    const totalRecettesUSD = report?.total_collections_usd || 0;
    const totalDepensesHTG = report?.total_expenses_htg || 0;
    const totalDepensesUSD = report?.total_expenses_usd || 0;
    const soldeNetHTG = report?.net_total_htg || 0;
    const soldeNetUSD = report?.net_total_usd || 0;

    const b = report?.breakdown;
    const scolariteHTG = b?.scolarite_htg || 0;
    const scolariteUSD = b?.scolarite_usd || 0;
    const inscriptionHTG = b?.inscription_htg || 0;
    const inscriptionUSD = b?.inscription_usd || 0;
    const fournituresHTG = b?.fournitures_htg || 0;
    const fournituresUSD = b?.fournitures_usd || 0;
    const autresHTG = b?.autres_htg || 0;
    const autresUSD = b?.autres_usd || 0;

    const cashHTG = b?.by_method?.['CASH']?.htg || (b?.by_method?.['ESPECES']?.htg || 0);
    const cashUSD = b?.by_method?.['CASH']?.usd || (b?.by_method?.['ESPECES']?.usd || 0);
    const moncashHTG = b?.by_method?.['MONCASH']?.htg || (b?.by_method?.['NATCASH']?.htg || 0);
    const bankHTG = b?.by_method?.['BANK']?.htg || (b?.by_method?.['VIREMENT']?.htg || 0);
    const checkHTG = b?.by_method?.['CHECK']?.htg || (b?.by_method?.['CHEQUE']?.htg || 0);

    return (
      <div className={`space-y-6 text-slate-900 bg-white leading-normal ${isPrintOnly ? 'text-[11px]' : 'text-xs'}`}>
        {/* Entête Institutionnelle */}
        <div className="border-b-2 border-slate-900 pb-4 text-center space-y-1">
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-700">
            RÉPUBLIQUE D'HAÏTI • MINISTÈRE DE L'ÉDUCATION NATIONALE ET DE LA FORMATION PROFESSIONNELLE (MENFP)
          </div>
          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-950">
            {school?.name || 'COLLÈGE DES INNOVATIONS'}
          </h1>
          <p className="text-xs text-slate-600 font-medium">
            {school?.address || 'Port-au-Prince, Haïti'} • Tél : {school?.phone || '(509) 2813-0000'} • Email : {school?.email || 'direction@ecole.edu.ht'}
          </p>
          {hasMultipleCampuses && activeCampusName && (
            <div className="inline-block mt-1 px-3 py-0.5 rounded-full bg-slate-100 border border-slate-300 text-xs font-bold text-slate-800">
              Campus / Annexe : {activeCampusName}
            </div>
          )}
        </div>

        {/* Titre & Bloc d'Authentification */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-300 rounded-lg">
          <div>
            <h2 className="text-sm sm:text-base font-black uppercase tracking-wide text-slate-900 flex items-center gap-2">
              <span>PROCÈS-VERBAL DE CLÔTURE JOURNALIÈRE DE CAISSE</span>
            </h2>
            <div className="text-xs text-slate-600 font-semibold mt-0.5">
              Journée comptable : <strong className="text-slate-900">{new Date(selectedDate + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>
            </div>
          </div>
          <div className="text-left sm:text-right text-xs space-y-0.5">
            <div className="font-mono text-[11px] text-slate-500">
              Réf : <strong>{report?.id ? `PV-${report.id.substring(0, 8).toUpperCase()}` : `PV-${selectedDate.replace(/-/g, '')}`}</strong>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase border border-slate-400 bg-white">
              <span>{currentBadgeInfo.label}</span>
            </div>
            <div className="text-[10px] text-slate-500">
              Édité le : {new Date().toLocaleString('fr-FR')}
            </div>
          </div>
        </div>

        {/* Tableaux Récapitulatifs Financiers (Recettes & Décaissements) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tableau Recettes */}
          <div className="border border-slate-300 rounded-lg overflow-hidden">
            <div className="bg-emerald-700 text-white font-black text-xs px-3 py-1.5 uppercase tracking-wider flex items-center justify-between">
              <span>I. Recettes Encaissées (Crédits)</span>
              <span>Montant</span>
            </div>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="p-2 text-slate-700">Scolarités & Écolages</td>
                  <td className="p-2 text-right font-bold text-slate-900">
                    {Math.round(scolariteHTG).toLocaleString()} HTG
                    {scolariteUSD > 0 && <span className="block text-[10px] text-slate-500">+${scolariteUSD} USD</span>}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 text-slate-700">Inscriptions & Réinscriptions</td>
                  <td className="p-2 text-right font-bold text-slate-900">
                    {Math.round(inscriptionHTG).toLocaleString()} HTG
                    {inscriptionUSD > 0 && <span className="block text-[10px] text-slate-500">+${inscriptionUSD} USD</span>}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 text-slate-700">Ventes Fournitures / Économat</td>
                  <td className="p-2 text-right font-bold text-slate-900">
                    {Math.round(fournituresHTG).toLocaleString()} HTG
                    {fournituresUSD > 0 && <span className="block text-[10px] text-slate-500">+${fournituresUSD} USD</span>}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 text-slate-700">Autres Recettes Diverses</td>
                  <td className="p-2 text-right font-bold text-slate-900">
                    {Math.round(autresHTG).toLocaleString()} HTG
                    {autresUSD > 0 && <span className="block text-[10px] text-slate-500">+${autresUSD} USD</span>}
                  </td>
                </tr>
              </tbody>
              <tfoot className="bg-emerald-50 border-t-2 border-emerald-600 font-black text-emerald-950">
                <tr>
                  <td className="p-2 uppercase text-[11px]">Total Recettes (A)</td>
                  <td className="p-2 text-right text-xs">
                    {Math.round(totalRecettesHTG).toLocaleString()} HTG
                    {totalRecettesUSD > 0 && <span className="block text-[10px]">(${totalRecettesUSD.toLocaleString()} USD)</span>}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Tableau Décaissements */}
          <div className="border border-slate-300 rounded-lg overflow-hidden">
            <div className="bg-rose-700 text-white font-black text-xs px-3 py-1.5 uppercase tracking-wider flex items-center justify-between">
              <span>II. Décaissements Effectués (Débits)</span>
              <span>Montant</span>
            </div>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="p-2 text-slate-700">Dépenses de Fonctionnement & Achats</td>
                  <td className="p-2 text-right font-bold text-slate-900">
                    {Math.round(totalDepensesHTG).toLocaleString()} HTG
                    {totalDepensesUSD > 0 && <span className="block text-[10px] text-slate-500">-${totalDepensesUSD} USD</span>}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 text-slate-700">Salaires & Rémunérations Personnel</td>
                  <td className="p-2 text-right font-bold text-slate-900">
                    Inclus dans journal
                  </td>
                </tr>
                <tr>
                  <td className="p-2 text-slate-400 italic">Autres déductions directes</td>
                  <td className="p-2 text-right font-medium text-slate-400">0 HTG</td>
                </tr>
                <tr>
                  <td className="p-2 text-slate-400 italic">Pertes / Écarts constatés</td>
                  <td className="p-2 text-right font-medium text-slate-400">0 HTG</td>
                </tr>
              </tbody>
              <tfoot className="bg-rose-50 border-t-2 border-rose-600 font-black text-rose-950">
                <tr>
                  <td className="p-2 uppercase text-[11px]">Total Décaissements (B)</td>
                  <td className="p-2 text-right text-xs">
                    {Math.round(totalDepensesHTG).toLocaleString()} HTG
                    {totalDepensesUSD > 0 && <span className="block text-[10px]">(-${totalDepensesUSD.toLocaleString()} USD)</span>}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Bilan Net Final de Caisse */}
        <div className="border-2 border-slate-900 bg-slate-900 text-white rounded-lg p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-300">
              III. SOLDE NET DE CAISSE DE LA JOURNÉE (A - B)
            </div>
            <div className="text-[10px] text-slate-400">
              Total Recettes encaissées diminué du total des décaissements
            </div>
          </div>
          <div className="text-right">
            <div className="text-base sm:text-xl font-black text-emerald-400">
              {Math.round(soldeNetHTG).toLocaleString()} HTG
            </div>
            {soldeNetUSD !== 0 && (
              <div className="text-xs font-bold text-slate-300">
                {soldeNetUSD > 0 ? `+ $${soldeNetUSD.toLocaleString()} USD` : `- $${Math.abs(soldeNetUSD).toLocaleString()} USD`}
              </div>
            )}
          </div>
        </div>

        {/* Ventilation des Modes de Règlement */}
        <div className="border border-slate-300 rounded-lg p-3 bg-slate-50 space-y-2">
          <div className="text-[11px] font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
            IV. Répartition des Recettes par Mode de Paiement
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-white p-2 rounded border border-slate-200">
              <span className="text-[10px] text-slate-500 font-bold block">Espèces (Cash)</span>
              <strong className="text-slate-900">{Math.round(cashHTG).toLocaleString()} HTG</strong>
              {cashUSD > 0 && <span className="text-[10px] text-slate-600 block">+${cashUSD} USD</span>}
            </div>
            <div className="bg-white p-2 rounded border border-slate-200">
              <span className="text-[10px] text-slate-500 font-bold block">MonCash / Natcash</span>
              <strong className="text-slate-900">{Math.round(moncashHTG).toLocaleString()} HTG</strong>
            </div>
            <div className="bg-white p-2 rounded border border-slate-200">
              <span className="text-[10px] text-slate-500 font-bold block">Virements Bancaires</span>
              <strong className="text-slate-900">{Math.round(bankHTG).toLocaleString()} HTG</strong>
            </div>
            <div className="bg-white p-2 rounded border border-slate-200">
              <span className="text-[10px] text-slate-500 font-bold block">Chèques / Autres</span>
              <strong className="text-slate-900">{Math.round(checkHTG).toLocaleString()} HTG</strong>
            </div>
          </div>
        </div>

        {/* Journal Détaillé des Transactions (Si activé) */}
        {includeTransactionsInPrint && rawTransactions.length > 0 && (
          <div className="border border-slate-300 rounded-lg overflow-hidden space-y-0">
            <div className="bg-slate-800 text-white font-black text-xs px-3 py-1.5 uppercase tracking-wider flex items-center justify-between">
              <span>V. Journal des Opérations du Jour ({rawTransactions.length} transaction{rawTransactions.length > 1 ? 's' : ''})</span>
              <span>Détails</span>
            </div>
            <table className="w-full text-[10px] leading-tight">
              <thead className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
                <tr>
                  <th className="p-1.5 text-left">N° / Heure</th>
                  <th className="p-1.5 text-left">Réf. / Reçu</th>
                  <th className="p-1.5 text-left">Type</th>
                  <th className="p-1.5 text-left">Tiers / Élève</th>
                  <th className="p-1.5 text-left">Nature / Motif</th>
                  <th className="p-1.5 text-center">Mode</th>
                  <th className="p-1.5 text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rawTransactions.map((tx, idx) => (
                  <tr key={tx.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                    <td className="p-1.5 font-mono text-slate-600 whitespace-nowrap">
                      #{idx + 1} {tx.time ? `(${tx.time})` : ''}
                    </td>
                    <td className="p-1.5 font-mono font-bold text-slate-800 whitespace-nowrap">
                      {tx.reference || '--'}
                    </td>
                    <td className="p-1.5 font-bold whitespace-nowrap">
                      {tx.type === 'INCOME' ? (
                        <span className="text-emerald-700">+ RECETTE</span>
                      ) : (
                        <span className="text-rose-700">- DÉPENSE</span>
                      )}
                    </td>
                    <td className="p-1.5 font-medium text-slate-900 max-w-[140px] truncate">
                      {tx.student_name || 'Divers'}
                    </td>
                    <td className="p-1.5 text-slate-700 max-w-[160px] truncate">
                      {tx.nature || '--'}
                    </td>
                    <td className="p-1.5 text-center text-slate-600 uppercase font-semibold">
                      {tx.payment_method || 'CASH'}
                    </td>
                    <td className="p-1.5 text-right font-black whitespace-nowrap">
                      {tx.type === 'INCOME' ? '+' : '-'}{Math.round(tx.amount || 0).toLocaleString()} {tx.currency || 'HTG'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Observations & Traçabilité */}
        <div className="border border-slate-300 rounded-lg p-3 space-y-1.5 bg-slate-50/80">
          <div className="text-[11px] font-black uppercase text-slate-800">
            VI. Observations & Certifications Administratives
          </div>
          <p className="text-slate-700 text-xs italic">
            {notes || report?.notes || "Aucune divergence ni irrégularité constatée lors du dépouillement physique des espèces de la caisse."}
          </p>
          {report?.reopen_reason && (
            <div className="mt-2 p-2 bg-amber-50 border border-amber-300 rounded text-[11px] text-amber-900">
              <strong>Audit de Réouverture de Caisse :</strong> {report.reopen_reason} (Par : {report.reopened_by_name || 'Admin'} le {report.reopened_at ? new Date(report.reopened_at).toLocaleString('fr-FR') : '--'})
            </div>
          )}
        </div>

        {/* Zone Officielle de Signatures et Approbations Tripartites */}
        <div className="pt-2">
          <div className="text-[11px] font-black uppercase tracking-wider text-slate-800 mb-2 text-center">
            VII. Visas & Signatures Règlementaires
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            
            {/* Volet 1: Caissier */}
            <div className="border border-slate-400 rounded-lg p-2.5 flex flex-col justify-between min-h-[105px] bg-white">
              <div className="border-b border-slate-300 pb-1">
                <span className="text-[11px] font-black uppercase text-slate-800 block">Le/La Caissier(ère)</span>
                <span className="text-[9px] text-slate-500 font-medium">Comptage & Dépôt physique</span>
              </div>
              <div className="text-[10px] text-slate-400 italic my-auto">
                Nom & Signature :
              </div>
              <div className="text-[10px] font-bold text-slate-700 border-t border-slate-200 pt-1">
                {report?.created_by_name || user?.full_name || 'Service Caisse'}
              </div>
            </div>

            {/* Volet 2: Économe / Comptable */}
            <div className="border border-slate-400 rounded-lg p-2.5 flex flex-col justify-between min-h-[105px] bg-white">
              <div className="border-b border-slate-300 pb-1">
                <span className="text-[11px] font-black uppercase text-slate-800 block">L'Économe / Comptable</span>
                <span className="text-[9px] text-slate-500 font-medium">Contrôle & Rapprochement</span>
              </div>
              <div className="text-[10px] text-slate-400 italic my-auto">
                Visa & Date :
              </div>
              <div className="text-[10px] font-bold text-slate-700 border-t border-slate-200 pt-1">
                {report?.validated_by_name || 'Comptabilité Générale'}
              </div>
            </div>

            {/* Volet 3: Direction Générale */}
            <div className="border border-slate-400 rounded-lg p-2.5 flex flex-col justify-between min-h-[105px] bg-white">
              <div className="border-b border-slate-300 pb-1">
                <span className="text-[11px] font-black uppercase text-slate-800 block">La Direction Générale</span>
                <span className="text-[9px] text-slate-500 font-medium">Approbation & Sceau Officiel</span>
              </div>
              <div className="text-[10px] text-slate-400 italic my-auto">
                Cachet de l'Établissement :
              </div>
              <div className="text-[10px] font-bold text-slate-700 border-t border-slate-200 pt-1">
                Collège des Innovations
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:hidden">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          
          {/* Modal Header */}
          <div className="bg-slate-900 text-white p-4 sm:p-6 flex flex-wrap items-center justify-between gap-4 shrink-0 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${
                currentBadgeInfo.type === 'ORIGINAL'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : currentBadgeInfo.type === 'MODIFIED'
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : currentBadgeInfo.type === 'REOPENED'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-slate-700/50 text-slate-300 border border-slate-600'
              }`}>
                {currentBadgeInfo.type === 'ORIGINAL' && <ShieldCheck size={22} />}
                {currentBadgeInfo.type === 'MODIFIED' && <FileEdit size={22} />}
                {currentBadgeInfo.type === 'REOPENED' && <RotateCcw size={22} />}
                {currentBadgeInfo.type === 'PENDING' && <Clock size={22} />}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                    Rapport de Clôture de Caisse
                  </h2>
                  
                  {/* Visual Traçabilité Badge in Header */}
                  <div 
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 border shadow-2xs ${
                      currentBadgeInfo.type === 'ORIGINAL'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : currentBadgeInfo.type === 'MODIFIED'
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                        : currentBadgeInfo.type === 'REOPENED'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-700/80 text-slate-300 border-slate-600'
                    }`}
                    title={currentBadgeInfo.sublabel}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${currentBadgeInfo.dotClass}`} />
                    {currentBadgeInfo.type === 'ORIGINAL' && <ShieldCheck size={12} className="text-emerald-400" />}
                    {currentBadgeInfo.type === 'MODIFIED' && <FileEdit size={12} className="text-purple-400" />}
                    {currentBadgeInfo.type === 'REOPENED' && <RotateCcw size={12} className="text-amber-400" />}
                    {currentBadgeInfo.type === 'PENDING' && <Clock size={12} className="text-slate-400" />}
                    <span>{currentBadgeInfo.label}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 font-medium mt-0.5 flex flex-wrap items-center gap-2">
                  <span>Établissement : {school?.name || 'Collège des Innovations'}</span>
                  {hasMultipleCampuses && activeCampusName && (
                    <>
                      <span>•</span>
                      <span className="text-emerald-400 font-bold">{activeCampusName}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700 cursor-pointer shadow-2xs"
                title="Exporter les transactions au format CSV / Excel"
              >
                <FileSpreadsheet size={15} />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
              <button
                type="button"
                onClick={handlePrintReport}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border border-indigo-500/50 shadow-md shadow-indigo-900/30 cursor-pointer"
                title="Aperçu et impression officielle du Procès-Verbal de Clôture (A4)"
              >
                <Printer size={15} />
                <span>Imprimer PV</span>
              </button>
              <button 
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
          </div>

        {/* Date & Campus Selector Controls Bar */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Selector */}
            <div className="w-full sm:w-auto min-w-[220px]">
              <DatePickerPill
                selectedDate={selectedDate}
                onSelectDate={(newDate) => setSelectedDate(newDate)}
                maxDate={getLocalTodayString()}
                variant="field"
                size="sm"
                colorScheme="indigo"
                showTodayBadge={true}
              />
            </div>

            {/* Campus / Annexe Selector - ONLY if school has multiple campuses */}
            {hasMultipleCampuses && (
              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                <Building2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Site :</span>
                {user?.campus_id ? (
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    {campuses?.find(c => c.id === user.campus_id)?.name || 'Annexe Actuelle'}
                  </span>
                ) : (
                  <select
                    value={selectedCampusId || 'GLOBAL'}
                    onChange={(e) => setSelectedCampusId(e.target.value === 'GLOBAL' ? null : e.target.value)}
                    className="bg-transparent text-xs font-black text-slate-900 dark:text-white border-none outline-none focus:ring-0 cursor-pointer pr-1"
                  >
                    <option value="GLOBAL">Tous les Campus (Consolidé)</option>
                    {campuses && campuses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <button
              onClick={() => { loadReport(); loadHistory(); }}
              disabled={loading}
              className="p-2 text-slate-600 hover:bg-slate-200/80 dark:text-slate-400 dark:hover:bg-slate-700 rounded-xl transition-all"
              title="Actualiser les données en temps réel"
            >
              <RefreshCcw size={16} className={loading ? 'animate-spin text-indigo-600' : ''} />
            </button>
          </div>

          {/* Tab Selection */}
          <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'summary' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
            >
              Synthèse Financière
            </button>
            <button
              onClick={() => setActiveTab('journal')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'journal' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
            >
              Journal ({filteredTransactions.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'history' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
            >
              <History size={13} className="text-indigo-500" />
              <span>Historique Clôtures ({historyClosures.length})</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {loading && activeTab !== 'history' ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Génération automatique du bilan de caisse pour le {selectedDate}...</p>
            </div>
          ) : !report && activeTab !== 'history' ? (
            <div className="py-12 text-center text-slate-500">
              Aucune donnée disponible pour cette date.
            </div>
          ) : activeTab === 'summary' ? (
            <>
              {/* Validation Status Banner with Visual Badge */}
              {report?.status === 'VALIDATED' ? (
                <div className={`p-4 rounded-2xl border space-y-3 ${
                  currentBadgeInfo.type === 'MODIFIED' 
                    ? 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/50 text-purple-900 dark:text-purple-100'
                    : 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-100'
                }`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        currentBadgeInfo.type === 'MODIFIED'
                          ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300'
                          : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                      }`}>
                        {currentBadgeInfo.type === 'MODIFIED' ? <FileEdit size={20} /> : <ShieldCheck size={20} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black uppercase tracking-wider">
                            {currentBadgeInfo.type === 'MODIFIED' ? 'Caisse Clôturée & Rectifiée (Modifiée)' : 'Caisse Clôturée et Certifiée (Originale)'}
                          </p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${currentBadgeInfo.bgClass} ${currentBadgeInfo.textClass} ${currentBadgeInfo.borderClass}`}>
                            {currentBadgeInfo.label}
                          </span>
                        </div>
                        <p className="text-xs opacity-90 mt-0.5">
                          Validé par <span className="font-bold">{report.validated_by_name || 'Admin'}</span> le {report.validated_at ? new Date(report.validated_at).toLocaleString('fr-FR') : '--'}
                        </p>
                        {report.reopen_count && report.reopen_count > 0 && (
                          <p className="text-[11px] text-purple-700 dark:text-purple-300 mt-1 font-semibold flex items-center gap-1">
                            <RotateCcw size={11} /> Réouverte {report.reopen_count} fois dans le cadre de corrections comptables.
                          </p>
                        )}
                      </div>
                    </div>

                    {isAdmin && (
                      <button
                        onClick={() => setShowUnlockConfirm(true)}
                        disabled={isValidating}
                        className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-amber-50 hover:border-amber-300 text-amber-800 dark:text-amber-300 active:scale-98 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        title="Réouvrir la clôture en cas d'erreur ou d'omission (Trace d'audit et confirmation renforcée obligatoires)"
                      >
                        <RotateCcw size={14} />
                        Réouvrir / Modifier
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
                  currentBadgeInfo.type === 'REOPENED'
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      currentBadgeInfo.type === 'REOPENED'
                        ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}>
                      {currentBadgeInfo.type === 'REOPENED' ? <RotateCcw size={20} /> : <AlertTriangle size={20} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-black uppercase tracking-wider">
                          {currentBadgeInfo.type === 'REOPENED' ? 'Caisse Réouverte en Cours d\'Ajustement' : `Caisse non clôturée pour la journée du ${selectedDate}`}
                        </p>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${currentBadgeInfo.bgClass} ${currentBadgeInfo.textClass} ${currentBadgeInfo.borderClass}`}>
                          {currentBadgeInfo.label}
                        </span>
                      </div>
                      <p className="text-xs opacity-80 mt-0.5">
                        {currentBadgeInfo.type === 'REOPENED' && report?.reopened_by_name 
                          ? `Réouverte par ${report.reopened_by_name} le ${report.reopened_at ? new Date(report.reopened_at).toLocaleString('fr-FR') : ''} ${report.reopen_reason ? `(Motif: ${report.reopen_reason})` : ''}`
                          : 'Les écritures ci-dessous sont calculées en temps réel. Un administrateur peut valider la clôture ci-dessous.'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* KPI Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Total Collections */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider opacity-90">Total Encaissements</span>
                    <TrendingUp size={18} className="opacity-80" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-2xl font-black">{Math.round(report?.total_collections_htg || 0).toLocaleString()} <span className="text-sm font-normal">HTG</span></div>
                    {(report?.total_collections_usd || 0) > 0 && (
                      <div className="text-sm font-bold opacity-90">+ ${report?.total_collections_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD</div>
                    )}
                  </div>
                  <div className="text-[10px] opacity-75 font-medium pt-1 border-t border-white/20">
                    Scolarité, Inscription & Économat
                  </div>
                </div>

                {/* Total Expenses */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider opacity-90">Total Décaissements</span>
                    <TrendingDown size={18} className="opacity-80" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-2xl font-black">{Math.round(report?.total_expenses_htg || 0).toLocaleString()} <span className="text-sm font-normal">HTG</span></div>
                    {(report?.total_expenses_usd || 0) > 0 && (
                      <div className="text-sm font-bold opacity-90">+ ${report?.total_expenses_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD</div>
                    )}
                  </div>
                  <div className="text-[10px] opacity-75 font-medium pt-1 border-t border-white/20">
                    Charges, achats & dépenses décaissées
                  </div>
                </div>

                {/* Net Balance */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-lg shadow-indigo-600/10 space-y-2 sm:col-span-2 lg:col-span-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider opacity-90">Solde Net de Caisse</span>
                    <Receipt size={18} className="opacity-80" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-2xl font-black">{Math.round(report?.net_total_htg || 0).toLocaleString()} <span className="text-sm font-normal">HTG</span></div>
                    {report?.net_total_usd !== 0 && (
                      <div className="text-sm font-bold opacity-90">+ ${report?.net_total_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD</div>
                    )}
                  </div>
                  <div className="text-[10px] opacity-75 font-medium pt-1 border-t border-white/20">
                    {report?.transaction_count || 0} transaction(s) enregistrée(s) au total
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Collections Breakdown */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Ventilation des Recettes</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Encaissements</span>
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{terminology.tuition} (Scolarité)</span>
                      <span className="font-black text-slate-900 dark:text-white">
                        {Math.round(report?.breakdown.scolarite_htg || 0).toLocaleString()} HTG
                        {(report?.breakdown.scolarite_usd || 0) > 0 ? ` / $${report?.breakdown.scolarite_usd} USD` : ''}
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Frais d'Inscription</span>
                      <span className="font-black text-slate-900 dark:text-white">
                        {Math.round(report?.breakdown.inscription_htg || 0).toLocaleString()} HTG
                        {(report?.breakdown.inscription_usd || 0) > 0 ? ` / $${report?.breakdown.inscription_usd} USD` : ''}
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Ventes Économat / Fournitures</span>
                      <span className="font-black text-slate-900 dark:text-white">
                        {Math.round(report?.breakdown.fournitures_htg || 0).toLocaleString()} HTG
                        {(report?.breakdown.fournitures_usd || 0) > 0 ? ` / $${report?.breakdown.fournitures_usd} USD` : ''}
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Frais Divers & Campagnes</span>
                      <span className="font-black text-slate-900 dark:text-white">
                        {Math.round(report?.breakdown.autres_htg || 0).toLocaleString()} HTG
                        {(report?.breakdown.autres_usd || 0) > 0 ? ` / $${report?.breakdown.autres_usd} USD` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment Methods Breakdown */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Ventilation par Mode de Paiement
                  </h3>
                  <div className="space-y-2 text-xs">
                    {Object.keys(report?.breakdown.by_method || {}).length === 0 ? (
                      <p className="text-slate-400 italic text-center py-4">Aucune transaction enregistrée</p>
                    ) : (
                      Object.entries(report?.breakdown.by_method || {}).map(([method, val]) => (
                        <div key={method} className="flex justify-between items-center p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{method}</span>
                            <span className="text-[10px] text-slate-400 ml-2">({val.count} op.)</span>
                          </div>
                          <span className="font-black text-slate-900 dark:text-white">
                            {Math.round(val.htg).toLocaleString()} HTG
                            {val.usd > 0 ? ` / $${val.usd} USD` : ''}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Notes & Admin One-Click Validation Box */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-4 shadow-xl border border-slate-800">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Notes ou Observations de Clôture
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={report?.status === 'VALIDATED' && !isAdmin}
                    placeholder="Inscrivez d'éventuels écarts de caisse, comptage des billets ou remarques particulières..."
                    rows={2}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Validation Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
                  <div className="text-xs text-slate-400">
                    {report?.status === 'VALIDATED' ? (
                      <span className="text-emerald-400 font-medium">
                        ✓ Clôture verrouillée. Toute modification future sera tracée sous badge « Modifiée ».
                      </span>
                    ) : (
                      <span>
                        Une fois validée, la date du <strong className="text-white">{selectedDate}</strong> sera certifiée.
                      </span>
                    )}
                  </div>

                  {isAdmin && report?.status === 'VALIDATED' && (
                    <button
                      onClick={() => setShowUnlockConfirm(true)}
                      disabled={isValidating}
                      className="w-full sm:w-auto px-4 py-2.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RotateCcw size={15} />
                      <span>Réouvrir la Caisse</span>
                    </button>
                  )}

                  {isAdmin && report?.status !== 'VALIDATED' && (
                    <button
                      onClick={handleValidateClosure}
                      disabled={isValidating}
                      className="w-full sm:w-auto px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isValidating ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Lock size={16} />
                      )}
                      <span>
                        {report?.is_reopened || (report?.reopen_count && report?.reopen_count > 0)
                          ? `Re-Valider & Verrouiller la Caisse (Modifiée)`
                          : `Valider & Verrouiller la Caisse Originale`}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Document Export / Print Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <FileText size={16} className="text-indigo-600 dark:text-indigo-400" />
                  <span>Procès-Verbal Officiel de Clôture de Caisse (Format A4)</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="px-3.5 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <FileSpreadsheet size={14} className="text-emerald-600" />
                    <span>Exporter CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintReport}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-900/20"
                  >
                    <Printer size={14} />
                    <span>Imprimer le Procès-Verbal (A4)</span>
                  </button>
                </div>
              </div>
            </>
          ) : activeTab === 'journal' ? (
            /* Journal Tab */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="w-full sm:flex-1 flex items-center gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <Search size={16} className="text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Rechercher par élève, nature, référence..."
                    className="bg-transparent border-none text-xs w-full text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="px-3 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    title="Exporter tout le journal de la journée"
                  >
                    <FileSpreadsheet size={14} />
                    <span>Export CSV ({filteredTransactions.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintReport}
                    className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-indigo-900/20 cursor-pointer"
                    title="Imprimer le journal complet"
                  >
                    <Printer size={14} />
                    <span>Imprimer Journal</span>
                  </button>
                </div>
              </div>

              {filteredTransactions.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs italic">
                  Aucune transaction enregistrée pour cette journée.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 text-[10px]">
                        <th className="p-3">Heure</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Intitulé / Élève</th>
                        <th className="p-3">Mode</th>
                        <th className="p-3 text-right">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {filteredTransactions.map((tx, idx) => (
                        <tr key={tx.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="p-3 font-semibold text-slate-500 whitespace-nowrap">{tx.time}</td>
                          <td className="p-3 font-bold whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                              tx.type === 'DECAISSEMENT' 
                                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800' 
                                : tx.type === 'FOURNITURE' 
                                ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800' 
                                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                            }`}>
                              {tx.type}
                            </span>
                          </td>
                          <td className="p-3 font-medium text-slate-900 dark:text-slate-100">
                            <div>{tx.student_name}</div>
                            <div className="text-[10px] text-slate-400 font-normal">{tx.nature} • Ref: {tx.reference}</div>
                          </td>
                          <td className="p-3 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{tx.payment_method}</td>
                          <td className={`p-3 text-right font-black whitespace-nowrap ${tx.type === 'DECAISSEMENT' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {tx.type === 'DECAISSEMENT' ? '-' : '+'}{Math.round(tx.amount).toLocaleString()} {tx.currency}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* History of Closures with Visual Badges */
            <div className="space-y-4">
              {/* Legend & Guide Bar */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200">
                    <ShieldCheck size={16} className="text-indigo-600 dark:text-indigo-400" />
                    <span>Légende des Badges de Traçabilité Financière</span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Contrôle de conformité et audit
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                  <div className="p-2 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/50 flex items-start gap-2">
                    <span className="p-1 rounded bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-100 shrink-0 mt-0.5">
                      <ShieldCheck size={12} />
                    </span>
                    <div>
                      <strong className="text-emerald-900 dark:text-emerald-200">Clôture Originale :</strong>
                      <p className="text-emerald-700 dark:text-emerald-400 text-[10px] leading-tight mt-0.5">Certifiée à la première clôture sans réouverture.</p>
                    </div>
                  </div>

                  <div className="p-2 bg-amber-50/80 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/50 flex items-start gap-2">
                    <span className="p-1 rounded bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-100 shrink-0 mt-0.5">
                      <RotateCcw size={12} />
                    </span>
                    <div>
                      <strong className="text-amber-900 dark:text-amber-200">Caisse Réouverte :</strong>
                      <p className="text-amber-700 dark:text-amber-400 text-[10px] leading-tight mt-0.5">Déverrouillée pour correction (en cours de rectification).</p>
                    </div>
                  </div>

                  <div className="p-2 bg-purple-50/80 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800/50 flex items-start gap-2">
                    <span className="p-1 rounded bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-100 shrink-0 mt-0.5">
                      <FileEdit size={12} />
                    </span>
                    <div>
                      <strong className="text-purple-900 dark:text-purple-200">Clôture Modifiée :</strong>
                      <p className="text-purple-700 dark:text-purple-400 text-[10px] leading-tight mt-0.5">Re-verrouillée après réouverture et régularisations.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filters & Search Header */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="relative w-full sm:w-72">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filtrer par date, responsable, motif..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                  />
                </div>

                {/* Filter Badges Chips */}
                <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto justify-start sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setHistoryFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      historyFilter === 'ALL' 
                        ? 'bg-slate-900 text-white shadow-2xs' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    Toutes ({historyClosures.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setHistoryFilter('ORIGINAL')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                      historyFilter === 'ORIGINAL'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                    }`}
                  >
                    <ShieldCheck size={12} />
                    Originales ({historyClosures.filter(c => getCashClosureBadgeInfo(c).type === 'ORIGINAL').length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setHistoryFilter('REOPENED')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                      historyFilter === 'REOPENED'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
                    }`}
                  >
                    <RotateCcw size={12} />
                    Réouvertes ({historyClosures.filter(c => getCashClosureBadgeInfo(c).type === 'REOPENED').length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setHistoryFilter('MODIFIED')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                      historyFilter === 'MODIFIED'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40'
                    }`}
                  >
                    <FileEdit size={12} />
                    Modifiées ({historyClosures.filter(c => getCashClosureBadgeInfo(c).type === 'MODIFIED').length})
                  </button>
                </div>
              </div>

              {/* Closures Table */}
              {historyLoading ? (
                <div className="py-16 text-center space-y-2">
                  <RefreshCcw size={24} className="animate-spin text-indigo-600 mx-auto" />
                  <p className="text-xs text-slate-500">Chargement de l'historique des clôtures...</p>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs italic bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                  Aucune clôture ne correspond aux critères sélectionnés.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 text-[10px]">
                        <th className="p-3">Date de Caisse</th>
                        {hasMultipleCampuses && <th className="p-3">Site / Annexe</th>}
                        <th className="p-3">Badge Traçabilité</th>
                        <th className="p-3 text-right">Recettes (HTG/USD)</th>
                        <th className="p-3 text-right">Dépenses</th>
                        <th className="p-3 text-right">Solde Net</th>
                        <th className="p-3">Validé / Audit</th>
                        <th className="p-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {filteredHistory.map((c, idx) => {
                        const bInfo = getCashClosureBadgeInfo(c);
                        const isCurrentActive = c.closure_date === selectedDate;

                        return (
                          <tr 
                            key={c.id || `${c.closure_date}_${c.campus_id || 'ALL'}_${idx}`} 
                            className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                              isCurrentActive ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                            }`}
                          >
                            <td className="p-3 font-black text-slate-900 dark:text-white whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Calendar size={13} className="text-indigo-500 shrink-0" />
                                <span>{new Date(c.closure_date + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
                              </div>
                            </td>
                            {hasMultipleCampuses && (
                              <td className="p-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                {c.campus_id ? campuses?.find(cp => cp.id === c.campus_id)?.name || 'Annexe' : 'Consolidé (Tous)'}
                              </td>
                            )}
                            <td className="p-3 whitespace-nowrap">
                              <div className="space-y-1">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black border ${bInfo.bgClass} ${bInfo.textClass} ${bInfo.borderClass}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${bInfo.dotClass}`} />
                                  {bInfo.type === 'ORIGINAL' && <ShieldCheck size={12} />}
                                  {bInfo.type === 'MODIFIED' && <FileEdit size={12} />}
                                  {bInfo.type === 'REOPENED' && <RotateCcw size={12} />}
                                  {bInfo.type === 'PENDING' && <Clock size={12} />}
                                  <span>{bInfo.label}</span>
                                </span>
                                {c.reopen_reason && (
                                  <div className="text-[10px] text-amber-700 dark:text-amber-300 italic max-w-xs truncate" title={c.reopen_reason}>
                                    Motif: {c.reopen_reason}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                              <div>+{Math.round(c.total_collections_htg).toLocaleString()} HTG</div>
                              {c.total_collections_usd > 0 && (
                                <div className="text-[10px] text-emerald-700 dark:text-emerald-300">+${c.total_collections_usd.toLocaleString()} USD</div>
                              )}
                            </td>
                            <td className="p-3 text-right font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                              <div>-{Math.round(c.total_expenses_htg).toLocaleString()} HTG</div>
                              {c.total_expenses_usd > 0 && (
                                <div className="text-[10px] text-rose-700 dark:text-rose-300">-${c.total_expenses_usd.toLocaleString()} USD</div>
                              )}
                            </td>
                            <td className="p-3 text-right font-black text-slate-900 dark:text-white whitespace-nowrap">
                              <div className={c.net_total_htg >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600'}>
                                {Math.round(c.net_total_htg).toLocaleString()} HTG
                              </div>
                            </td>
                            <td className="p-3 text-[11px] text-slate-500 whitespace-nowrap">
                              <div>{c.validated_by_name || c.created_by_name || 'Admin'}</div>
                              <div className="text-[10px] text-slate-400">
                                {c.validated_at ? new Date(c.validated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--'}
                              </div>
                            </td>
                            <td className="p-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => selectHistoryDate(c.closure_date, c.campus_id)}
                                  className={`px-2.5 py-1.5 rounded-xl font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer ${
                                    isCurrentActive
                                      ? 'bg-indigo-600 text-white shadow-2xs'
                                      : 'bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                                  }`}
                                  title="Charger cette journée dans la synthèse"
                                >
                                  <Eye size={12} />
                                  <span>{isCurrentActive ? 'Actif' : 'Consulter'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    selectHistoryDate(c.closure_date, c.campus_id);
                                    setTimeout(() => setIsPrintPreviewOpen(true), 150);
                                  }}
                                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-all cursor-pointer"
                                  title="Aperçu et impression du Procès-Verbal de cette date"
                                >
                                  <Printer size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reinforced Confirmation Modal Dialog for Cash Closure Reopening */}
        {showUnlockConfirm && (
          <div 
            id="reopen-cash-closure-confirmation-modal"
            className="fixed inset-0 z-[10005] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
          >
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full border border-amber-400/80 dark:border-amber-500/40 overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-200">
              
              {/* Header */}
              <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white p-5 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
                    <ShieldAlert size={22} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                      <span>Confirmation Renforcée</span>
                    </h3>
                    <p className="text-xs text-amber-100 font-medium mt-0.5">
                      Déverrouillage et réouverture d'une clôture de caisse scellée
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowUnlockConfirm(false);
                    setReopenReason('');
                    setConfirmKeyword('');
                  }}
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                  title="Fermer la boîte de confirmation"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[75vh]">
                
                {/* Target Closure Information Summary */}
                <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/50 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-400 font-bold">Journée de caisse :</span>
                    <span className="font-black text-amber-950 dark:text-amber-200 text-sm">{selectedDate}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Annexe / Campus :</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{activeCampusName}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Solde net certifié :</span>
                    <span className="font-black text-slate-900 dark:text-white">
                      {Math.round(report?.net_total_htg || 0).toLocaleString()} HTG
                      {(report?.net_total_usd || 0) > 0 ? ` + $${report?.net_total_usd} USD` : ''}
                    </span>
                  </div>
                </div>

                {/* Audit & Compliance Warning */}
                <div className="flex items-start gap-2.5 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                  <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    <strong>Avertissement d'audit :</strong> Cette opération réouvre la journée aux modifications financières. Le statut passera sous badge <span className="font-bold text-amber-700 dark:text-amber-300">« Caisse Réouverte »</span> et l'identité de l'administrateur (<span className="font-semibold">{user.full_name || 'Admin'}</span>) ainsi que le motif seront inscrits de manière inaltérable dans le registre d'audit.
                  </p>
                </div>

                {/* Step 1: Mandatory Reason */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <span>1. Motif obligatoire de la réouverture</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <span className={`text-[10px] font-bold ${
                      reopenReason.trim().length >= 5 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                    }`}>
                      {reopenReason.trim().length >= 5 ? '✓ Motif renseigné' : `5 car. min (${reopenReason.trim().length}/5)`}
                    </span>
                  </div>
                  <textarea
                    value={reopenReason}
                    onChange={(e) => setReopenReason(e.target.value)}
                    placeholder="Ex: Régularisation reçu d'écolage omis, annulation d'une dépense saisie en double..."
                    rows={3}
                    className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none text-slate-900 dark:text-white placeholder-slate-400 resize-none font-medium"
                  />
                </div>

                {/* Step 2: Mandatory Keyword 'CONFIRMER' */}
                <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <span>2. Confirmation de sécurité manuelle</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    {confirmKeyword.trim().toUpperCase() === 'CONFIRMER' ? (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 size={12} /> Mot-clé vérifié
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                        Saisie requise
                      </span>
                    )}
                  </div>
                  
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Pour valider et prévenir toute action involontaire, veuillez taper le mot <strong className="text-slate-900 dark:text-white font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">CONFIRMER</strong> ci-dessous :
                  </p>

                  <div className="relative">
                    <input
                      type="text"
                      value={confirmKeyword}
                      onChange={(e) => setConfirmKeyword(e.target.value.toUpperCase())}
                      placeholder="Tapez CONFIRMER ici..."
                      className={`w-full p-3 text-xs uppercase font-mono font-bold tracking-widest bg-slate-50 dark:bg-slate-800 rounded-xl border focus:outline-none transition-all ${
                        confirmKeyword.trim().toUpperCase() === 'CONFIRMER'
                          ? 'border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                          : 'border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white'
                      }`}
                    />
                    {confirmKeyword.trim().toUpperCase() === 'CONFIRMER' && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600">
                        <Check size={18} />
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Footer Actions */}
              <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowUnlockConfirm(false);
                    setReopenReason('');
                    setConfirmKeyword('');
                  }}
                  disabled={isValidating}
                  className="px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleReopenClosure}
                  disabled={isValidating || reopenReason.trim().length < 5 || confirmKeyword.trim().toUpperCase() !== 'CONFIRMER'}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-amber-600/20 cursor-pointer"
                >
                  {isValidating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Déverrouillage en cours...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw size={15} />
                      <span>Déverrouiller & Réouvrir la Caisse</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>

      {/* ========================================================================= */}
      {/* PRINT PREVIEW MODAL (ON-SCREEN INTERACTIVE PREVIEW BEFORE PRINTING)       */}
      {/* ========================================================================= */}
      {isPrintPreviewOpen && (
        <div className="fixed inset-0 z-[10010] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-2 sm:p-4 overflow-y-auto print:hidden animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
            
            {/* Preview Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <Printer size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight flex items-center gap-2">
                    <span>Aperçu Avant Impression • Procès-Verbal de Clôture</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase">
                      Format A4
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Journée de caisse du {selectedDate} • {school?.name || 'Collège des Innovations'}
                  </p>
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeTransactionsInPrint}
                    onChange={(e) => setIncludeTransactionsInPrint(e.target.checked)}
                    className="w-3.5 h-3.5 text-indigo-600 rounded bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer"
                  />
                  <span>Inclure le journal détaillé ({rawTransactions.length} tx)</span>
                </label>

                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700 cursor-pointer shadow-2xs"
                  title="Télécharger les données en CSV"
                >
                  <FileSpreadsheet size={15} />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={handleDirectPrint}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-98 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-900/40 cursor-pointer"
                >
                  <Printer size={15} />
                  <span>Lancer l'Impression Directe (A4)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPrintPreviewOpen(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                  title="Fermer l'aperçu"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Preview Sheet Container with Paper Style */}
            <div className="p-4 sm:p-6 overflow-y-auto bg-slate-950/60 flex justify-center flex-1">
              <div className="bg-white text-black w-full max-w-[210mm] p-6 sm:p-8 rounded-lg shadow-2xl space-y-6 text-slate-900 font-sans text-xs border border-slate-200">
                {/* On-screen A4 Paper Layout Preview */}
                {renderPVContent(false)}
              </div>
            </div>

            {/* Preview Modal Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
              <span className="flex items-center gap-1.5">
                <Info size={14} className="text-indigo-400" />
                Document conforme aux exigences de gestion comptable et d'audit du MENFP.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPrintPreviewOpen(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold cursor-pointer"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={handleDirectPrint}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-black flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-900/30"
                >
                  <Printer size={13} />
                  <span>Imprimer (A4)</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DEDICATED PRINTABLE DOCUMENT (RENDERED ONLY DURING BROWSER WINDOW.PRINT)  */}
      {/* ========================================================================= */}
      <div id="cash-closure-printable-sheet" className="hidden print:block p-4 bg-white text-black font-sans">
        {renderPVContent(true)}
      </div>
    </>
  );
};
