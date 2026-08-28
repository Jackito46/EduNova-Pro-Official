import React, { useState, useMemo } from 'react';
import { 
  X, 
  Calculator, 
  Sliders, 
  Search, 
  Download, 
  Printer, 
  Award, 
  Sparkles, 
  CheckCircle2, 
  Info, 
  Users, 
  HeartHandshake, 
  ShieldCheck, 
  DollarSign, 
  ChevronDown, 
  ArrowUpDown, 
  Check, 
  Filter, 
  Receipt,
  GraduationCap,
  Building2,
  FileSpreadsheet,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatStudentName } from '../utils/formatters';
import { UserProfile } from '../types';

export interface ReevaluatedStudentItem {
  studentId: string;
  matricule?: string;
  firstName: string;
  lastName: string;
  gender?: string;
  regime?: string | null;
  className: string;
  discountLabel: string;
  discountAmountHTG: number;
  tuitionHTG: number;
  tuitionUSD: number;
  miscHTG: number;
  miscUSD: number;
  grossHTG: number;
  grossUSD: number;
  reductionHTG: number;
  reductionUSD: number;
  netHTG: number;
  netUSD: number;
  isCompleteScholarship?: boolean;
}

interface ReevaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  reevaluatedStudents: ReevaluatedStudentItem[];
  totalGrossExpectedHTG: number;
  totalGrossExpectedUSD: number;
  totalReductionsHTG: number;
  totalReductionsUSD: number;
  totalExpectedHTG: number;
  totalExpectedUSD: number;
  discountedStudents: number;
  isTargetReevaluated: boolean;
  onToggleTargetReevaluated: () => void;
  onConfirmReevaluation: () => void;
  exchangeRate: number;
  school?: any;
  user: UserProfile;
  terminology: any;
}

type MotifCategoryKey = 'ALL' | 'excellence' | 'social' | 'sibling' | 'staff' | 'custom';
type SortOption = 'reduction-desc' | 'reduction-asc' | 'net-desc' | 'net-asc' | 'name-asc' | 'class-asc';

// Helper to determine clean, truthful badge and scope description
export const getDiscountBadgeInfo = (st: ReevaluatedStudentItem) => {
  const label = (st.discountLabel || '').trim();
  const lower = label.toLowerCase();
  const isComplete = Boolean(
    st.isCompleteScholarship || 
    lower.includes('complète') || 
    lower.includes('complete') || 
    lower.includes('sociale') || 
    lower.includes('frais divers') ||
    lower.includes('totale')
  );

  const matchPct = label.match(/(\d+)\s*%/);
  let pct: number | null = matchPct ? parseInt(matchPct[1], 10) : null;
  if (pct === null) {
    if (lower.includes('excellence') || lower.includes('intégrale')) pct = 100;
    else if (lower.includes('demi') || lower.includes('collaborateur')) pct = 50;
    else if (lower.includes('fratrie')) pct = 15;
    else if (lower.includes('social')) pct = 25;
  }

  let categoryKey: MotifCategoryKey = 'custom';
  let badgeStyle = 'bg-slate-100 text-slate-800 border-slate-200';
  let icon = Sparkles;
  let categoryTitle = 'Ajustement Économat';
  let scopeLabel = '';

  if (lower.includes('excellence') || pct === 100) {
    categoryKey = 'excellence';
    badgeStyle = 'bg-amber-50 text-amber-900 border-amber-300 ring-1 ring-amber-400/20';
    icon = Award;
    categoryTitle = "Bourse d'Excellence";
    scopeLabel = isComplete 
      ? 'Prise en charge intégrale (Scolarité + Frais Obligatoires)' 
      : 'Exonération Totale de Scolarité (100%)';
  } else if (lower.includes('social')) {
    categoryKey = 'social';
    badgeStyle = 'bg-purple-50 text-purple-900 border-purple-200 ring-1 ring-purple-400/20';
    icon = HeartHandshake;
    categoryTitle = 'Cas Social / Partenariat';
    scopeLabel = isComplete 
      ? 'Prise en charge sociale étendue' 
      : (pct ? `Exonération Scolarité (${pct}%)` : 'Allègement Social');
  } else if (lower.includes('fratrie') || lower.includes('sibling')) {
    categoryKey = 'sibling';
    badgeStyle = 'bg-sky-50 text-sky-900 border-sky-200 ring-1 ring-sky-400/20';
    icon = Users;
    categoryTitle = 'Réduction Fratrie';
    scopeLabel = pct ? `Remise fratrie (${pct}% sur la scolarité)` : 'Remise fratrie';
  } else if (lower.includes('collaborateur') || lower.includes('personnel') || lower.includes('staff') || lower.includes('professeur') || lower.includes('enseignant')) {
    categoryKey = 'staff';
    badgeStyle = 'bg-emerald-50 text-emerald-900 border-emerald-200 ring-1 ring-emerald-400/20';
    icon = ShieldCheck;
    categoryTitle = 'Enfant du Personnel';
    scopeLabel = pct ? `Avantage personnel (${pct}% sur la scolarité)` : 'Tarif préférentiel personnel';
  } else {
    categoryKey = 'custom';
    badgeStyle = 'bg-indigo-50 text-indigo-900 border-indigo-200 ring-1 ring-indigo-400/20';
    icon = Sparkles;
    categoryTitle = label || 'Remise Économat';
    scopeLabel = pct 
      ? `Déduction autorisée (${pct}%)` 
      : (st.discountAmountHTG > 0 ? `Remise forfaitaire (-${Number(st.discountAmountHTG).toLocaleString()} HTG)` : 'Déduction accordée');
  }

  return {
    categoryKey,
    badgeStyle,
    Icon: icon,
    categoryTitle,
    scopeLabel,
    pct,
    isComplete,
    rawLabel: label
  };
};

export const ReevaluationModal: React.FC<ReevaluationModalProps> = ({
  isOpen,
  onClose,
  reevaluatedStudents,
  totalGrossExpectedHTG,
  totalGrossExpectedUSD,
  totalReductionsHTG,
  totalReductionsUSD,
  totalExpectedHTG,
  totalExpectedUSD,
  discountedStudents,
  isTargetReevaluated,
  onToggleTargetReevaluated,
  onConfirmReevaluation,
  exchangeRate,
  school,
  user,
  terminology
}) => {
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<MotifCategoryKey>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('reduction-desc');
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Compute available classes with counts and sums
  const availableClasses = useMemo(() => {
    const classSet = new Set(reevaluatedStudents.map(st => st.className || 'Non spécifiée'));
    return Array.from(classSet).sort();
  }, [reevaluatedStudents]);

  const classBreakdown = useMemo(() => {
    return availableClasses.map(clsName => {
      const list = reevaluatedStudents.filter(st => (st.className || 'Non spécifiée') === clsName);
      const usd = list.reduce((acc, curr) => acc + (curr.reductionUSD || 0), 0);
      const htg = list.reduce((acc, curr) => acc + (curr.reductionHTG || 0), 0);
      const totalEqHTG = htg + (usd * exchangeRate);
      return { className: clsName, count: list.length, usd, htg, totalEqHTG };
    });
  }, [availableClasses, reevaluatedStudents, exchangeRate]);

  // Filtered & sorted student list
  const filteredStudents = useMemo(() => {
    return reevaluatedStudents.filter(st => {
      // 1. Class filter
      if (selectedClass !== 'ALL' && (st.className || 'Non spécifiée') !== selectedClass) {
        return false;
      }

      // 2. Category filter
      const badgeInfo = getDiscountBadgeInfo(st);
      if (selectedCategory !== 'ALL' && badgeInfo.categoryKey !== selectedCategory) {
        return false;
      }

      // 3. Search term filter
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const fullName = `${st.firstName} ${st.lastName}`.toLowerCase();
        const matricule = (st.matricule || '').toLowerCase();
        const className = (st.className || '').toLowerCase();
        const discountLabel = (st.discountLabel || '').toLowerCase();
        const scope = badgeInfo.scopeLabel.toLowerCase();

        return (
          fullName.includes(query) ||
          matricule.includes(query) ||
          className.includes(query) ||
          discountLabel.includes(query) ||
          scope.includes(query)
        );
      }

      return true;
    }).sort((a, b) => {
      const aEqReduction = (a.reductionHTG || 0) + ((a.reductionUSD || 0) * exchangeRate);
      const bEqReduction = (b.reductionHTG || 0) + ((b.reductionUSD || 0) * exchangeRate);
      const aEqNet = (a.netHTG || 0) + ((a.netUSD || 0) * exchangeRate);
      const bEqNet = (b.netHTG || 0) + ((b.netUSD || 0) * exchangeRate);

      switch (sortBy) {
        case 'reduction-desc':
          return bEqReduction - aEqReduction;
        case 'reduction-asc':
          return aEqReduction - bEqReduction;
        case 'net-desc':
          return bEqNet - aEqNet;
        case 'net-asc':
          return aEqNet - bEqNet;
        case 'name-asc':
          return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
        case 'class-asc':
          return (a.className || '').localeCompare(b.className || '');
        default:
          return 0;
      }
    });
  }, [reevaluatedStudents, selectedClass, selectedCategory, searchTerm, sortBy, exchangeRate]);

  // Aggregate totals for the filtered subset
  const filteredTotals = useMemo(() => {
    return filteredStudents.reduce((acc, curr) => {
      acc.grossHTG += curr.grossHTG || 0;
      acc.grossUSD += curr.grossUSD || 0;
      acc.miscHTG += curr.miscHTG || 0;
      acc.miscUSD += curr.miscUSD || 0;
      acc.tuitionHTG += curr.tuitionHTG || 0;
      acc.tuitionUSD += curr.tuitionUSD || 0;
      acc.reductionHTG += curr.reductionHTG || 0;
      acc.reductionUSD += curr.reductionUSD || 0;
      acc.netHTG += curr.netHTG || 0;
      acc.netUSD += curr.netUSD || 0;
      return acc;
    }, {
      grossHTG: 0,
      grossUSD: 0,
      miscHTG: 0,
      miscUSD: 0,
      tuitionHTG: 0,
      tuitionUSD: 0,
      reductionHTG: 0,
      reductionUSD: 0,
      netHTG: 0,
      netUSD: 0
    });
  }, [filteredStudents]);

  // Total Eq calculations for top metrics
  const totalGrossEqHTG = totalGrossExpectedHTG + (totalGrossExpectedUSD * exchangeRate);
  const totalReductionsEqHTG = totalReductionsHTG + (totalReductionsUSD * exchangeRate);
  const totalNetEqHTG = totalExpectedHTG + (totalExpectedUSD * exchangeRate);
  const reductionPercentage = totalGrossEqHTG > 0 ? ((totalReductionsEqHTG / totalGrossEqHTG) * 100).toFixed(1) : '0';

  // Export to Excel handler
  const handleExportExcel = () => {
    if (reevaluatedStudents.length === 0) return;

    const data = reevaluatedStudents.map(st => {
      const badgeInfo = getDiscountBadgeInfo(st);
      const studentNameObj = formatStudentName(st.lastName, st.firstName);
      return {
        'Matricule': st.matricule || st.studentId?.slice(0, 8) || 'N/A',
        'Nom Complet': studentNameObj.fullName,
        'Classe': st.className || 'Non spécifiée',
        'Motif Officiel': st.discountLabel,
        'Catégorie': badgeInfo.categoryTitle,
        'Portée Précise': badgeInfo.scopeLabel,
        'Scolarité USD': st.tuitionUSD || 0,
        'Scolarité HTG': st.tuitionHTG || 0,
        'Frais Annexes USD': st.miscUSD || 0,
        'Frais Annexes HTG': st.miscHTG || 0,
        'Total Brut HTG Eq.': Math.round((st.grossHTG || 0) + ((st.grossUSD || 0) * exchangeRate)),
        'Déduction Accordée USD': st.reductionUSD || 0,
        'Déduction Accordée HTG': st.reductionHTG || 0,
        'Total Déduit HTG Eq.': Math.round((st.reductionHTG || 0) + ((st.reductionUSD || 0) * exchangeRate)),
        'Solde Net Exigible USD': st.netUSD || 0,
        'Solde Net Exigible HTG': st.netHTG || 0,
        'Total Net HTG Eq.': Math.round((st.netHTG || 0) + ((st.netUSD || 0) * exchangeRate)),
        'Date Audit': new Date().toLocaleDateString('fr-FR')
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reevaluation_Financiere');
    
    // Auto-fit column widths
    const maxProps = Object.keys(data[0] || {}).map(key => ({
      wch: Math.max(key.length, ...data.map(d => String((d as any)[key] ?? '').length)) + 2
    }));
    ws['!cols'] = maxProps;

    const schoolCleanName = school?.name ? school.name.replace(/\s+/g, '_') : 'Etablissement';
    XLSX.writeFile(wb, `Audit_Reevaluation_Financiere_${schoolCleanName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Print summary report handler
  const handlePrintSummary = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md animate-fade-in">
      <div 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="reevaluation-title" 
        className="bg-white rounded-3xl max-w-6xl w-full max-h-[94vh] shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden text-slate-900"
      >
        
        {/* =========================================================================
            1. MODAL HEADER WITH SOPHISTICATED GRADIENT & BADGES
           ========================================================================= */}
        <div className="relative p-5 sm:p-6 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white rounded-t-3xl border-b border-indigo-900/40 shrink-0">
          <div className="flex items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 sm:gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-400/30 shadow-inner backdrop-blur-md shrink-0">
                <Calculator size={24} className="text-indigo-400" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/25 border border-indigo-400/30 text-indigo-300">
                    <ShieldCheck size={12} />
                    Audit Économat & Recouvrement
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                    Taux : 1 USD = {exchangeRate} HTG
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {discountedStudents} dossiers réévalués
                  </span>
                </div>
                <h2 id="reevaluation-title" className="text-lg sm:text-xl font-black tracking-tight text-white">
                  Réévaluation & Ventilation de l'Objectif Financier
                </h2>
                <p className="text-xs text-slate-300 font-medium max-w-2xl">
                  Bilan analytique après déduction rigoureuse des bourses d'excellence, remises fratries, cas sociaux et avantages collaborateurs.
                </p>
              </div>
            </div>

            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer active:scale-95 shrink-0"
              title="Fermer le panneau"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* =========================================================================
            2. MODAL SCROLLABLE BODY
           ========================================================================= */}
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1 bg-slate-50/50">
          
          {/* TOP 3 EXECUTIVE KPI TILES */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
            
            {/* Card 1: Objectif Brut Initial */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                  <Receipt size={14} className="text-slate-400" />
                  1. Objectif Brut Initial
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md border border-slate-200">
                  Théorique
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
                    {totalGrossExpectedUSD.toLocaleString()}
                  </p>
                  <span className="text-xs font-black text-slate-500 font-sans">USD</span>
                  <span className="text-slate-300 font-light">•</span>
                  <p className="text-base sm:text-lg font-bold text-slate-700 font-mono">
                    {totalGrossExpectedHTG.toLocaleString()} <span className="text-xs font-medium font-sans text-slate-500">HTG</span>
                  </p>
                </div>
                <p className="text-xs font-bold text-slate-500">
                  ≈ {Math.round(totalGrossEqHTG).toLocaleString()} HTG équivalent
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Barème plein officiel</span>
                <span className="font-bold text-slate-700">100% Assiette</span>
              </div>
            </div>

            {/* Card 2: Bourses & Déductions Accordées */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white border border-amber-200/90 shadow-xs hover:border-amber-300 transition-all space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-amber-800 tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-600" />
                  2. Bourses & Allègements
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100/80 text-amber-900 rounded-md border border-amber-300/60">
                  -{reductionPercentage}% de l'objectif
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <p className="text-xl sm:text-2xl font-black text-amber-700 font-mono tracking-tight">
                    -{totalReductionsUSD.toLocaleString()}
                  </p>
                  <span className="text-xs font-black text-amber-700 font-sans">USD</span>
                  <span className="text-amber-300 font-light">•</span>
                  <p className="text-base sm:text-lg font-bold text-amber-700 font-mono">
                    -{totalReductionsHTG.toLocaleString()} <span className="text-xs font-medium font-sans text-amber-700">HTG</span>
                  </p>
                </div>
                <p className="text-xs font-bold text-amber-700">
                  ≈ -{Math.round(totalReductionsEqHTG).toLocaleString()} HTG exonéré
                </p>
              </div>
              <div className="pt-2 border-t border-amber-100 flex items-center justify-between text-[11px] text-amber-800">
                <span>{discountedStudents} dossiers réévalués</span>
                <span className="font-bold text-amber-900">{availableClasses.length} classes concernées</span>
              </div>
            </div>

            {/* Card 3: Objectif Réel Corrigé (Net Recouvrable) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-white border border-emerald-200/90 shadow-xs hover:border-emerald-300 transition-all space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-emerald-800 tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  3. Objectif Réel Corrigé
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md border border-emerald-300/60">
                  Net Recouvrable
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <p className="text-xl sm:text-2xl font-black text-emerald-700 font-mono tracking-tight">
                    {totalExpectedUSD.toLocaleString()}
                  </p>
                  <span className="text-xs font-black text-emerald-700 font-sans">USD</span>
                  <span className="text-emerald-300 font-light">•</span>
                  <p className="text-base sm:text-lg font-bold text-emerald-700 font-mono">
                    {totalExpectedHTG.toLocaleString()} <span className="text-xs font-medium font-sans text-emerald-700">HTG</span>
                  </p>
                </div>
                <p className="text-xs font-bold text-emerald-700">
                  ≈ {Math.round(totalNetEqHTG).toLocaleString()} HTG cible d'encaissement
                </p>
              </div>
              <div className="pt-2 border-t border-emerald-100 flex items-center justify-between text-[11px] text-emerald-800">
                <span>Engagement Économat</span>
                <span className="font-bold text-emerald-900">{(100 - parseFloat(reductionPercentage)).toFixed(1)}% Recouvrabilité</span>
              </div>
            </div>

          </div>

          {/* =========================================================================
              3. SMART INTERACTIVE FILTER SUITE & CLASS PILL BAR
             ========================================================================= */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            
            {/* Category / Motif Filter Tabs & Search Row */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              
              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
                {[
                  { key: 'ALL', label: 'Tous les motifs', icon: Filter },
                  { key: 'excellence', label: "Excellence (100%)", icon: Award },
                  { key: 'sibling', label: 'Fratrie', icon: Users },
                  { key: 'social', label: 'Cas Sociaux', icon: HeartHandshake },
                  { key: 'staff', label: 'Personnel', icon: ShieldCheck },
                  { key: 'custom', label: 'Forfaits & Autres', icon: Sparkles }
                ].map(tab => {
                  const IconComp = tab.icon;
                  const isActive = selectedCategory === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setSelectedCategory(tab.key as MotifCategoryKey)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/60'
                      }`}
                    >
                      <IconComp size={13} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Search & Sort Controls */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Rechercher élève, classe..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-400"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="appearance-none pl-3 pr-7 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 hover:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-all"
                  >
                    <option value="reduction-desc">Déduction Décroissante</option>
                    <option value="reduction-asc">Déduction Croissante</option>
                    <option value="net-desc">Net Exigible Décroissant</option>
                    <option value="net-asc">Net Exigible Croissant</option>
                    <option value="name-asc">Nom (A → Z)</option>
                    <option value="class-asc">Classe (A → Z)</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Class Pill Horizontal Bar */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                  <Sliders size={13} className="text-indigo-600" />
                  Ventilation par Classe ({availableClasses.length})
                </span>
                <span className="text-[11px] text-slate-500">
                  {filteredStudents.length} élève{filteredStudents.length > 1 ? 's' : ''} affiché{filteredStudents.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 max-h-28 overflow-y-auto pr-1">
                <button
                  onClick={() => setSelectedClass('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    selectedClass === 'ALL'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <span className="font-black">Toutes les classes</span>
                  <span className="ml-1.5 opacity-80">({reevaluatedStudents.length})</span>
                </button>

                {classBreakdown.map(item => {
                  const isSelected = selectedClass === item.className;
                  return (
                    <button
                      key={item.className}
                      onClick={() => setSelectedClass(isSelected ? 'ALL' : item.className)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span>{item.className}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {item.count}
                      </span>
                      <span className={`font-mono text-[11px] ${isSelected ? 'text-indigo-100' : 'text-amber-700'}`}>
                        -{Math.round(item.totalEqHTG).toLocaleString()} HTG
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* =========================================================================
              4. DETAILED AUDIT TABLE & VENTILATION
             ========================================================================= */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Layers size={14} className="text-indigo-600" />
                  Ventilation Analytique des Dossiers Réévalués
                </h3>
                {selectedClass !== 'ALL' && (
                  <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full border border-indigo-200">
                    Classe : {selectedClass}
                  </span>
                )}
              </div>

              {/* Quick Table Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportExcel}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-2xs"
                  title="Télécharger l'audit complet sous format Excel"
                >
                  <FileSpreadsheet size={14} className="text-emerald-700" />
                  <span>Exporter Excel</span>
                </button>

                <button
                  onClick={handlePrintSummary}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-2xs"
                  title="Imprimer le bordereau d'audit"
                >
                  <Printer size={14} className="text-slate-600" />
                  <span>Imprimer</span>
                </button>
              </div>
            </div>

            {/* Table Container */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
              <div className="overflow-x-auto max-h-[420px] scrollbar-thin">
                <table className="w-full text-left border-collapse min-w-[780px]">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-900 text-slate-100 text-[10px] font-black uppercase tracking-wider border-b border-slate-800">
                      <th className="p-3.5 text-slate-100 font-black">Élève & Identification</th>
                      <th className="p-3.5 text-slate-100 font-black">Motif & Statut d'Allègement</th>
                      <th className="p-3.5 text-right text-slate-100 font-black">Scolarité Brute</th>
                      <th className="p-3.5 text-right text-slate-100 font-black">Frais Annexes</th>
                      <th className="p-3.5 text-right text-amber-300 font-black">Déduction Accordée</th>
                      <th className="p-3.5 text-right text-emerald-400 font-black">Solde Net Exigible</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredStudents.map((st, idx) => {
                      const badgeInfo = getDiscountBadgeInfo(st);
                      const studentNameObj = formatStudentName(st.lastName, st.firstName);
                      const isExpanded = expandedStudentId === st.studentId;
                      const IconComp = badgeInfo.Icon;

                      const grossEq = (st.grossHTG || 0) + ((st.grossUSD || 0) * exchangeRate);
                      const reductionEq = (st.reductionHTG || 0) + ((st.reductionUSD || 0) * exchangeRate);
                      const netEq = (st.netHTG || 0) + ((st.netUSD || 0) * exchangeRate);

                      return (
                        <React.Fragment key={st.studentId || idx}>
                          <tr 
                            onClick={() => setExpandedStudentId(isExpanded ? null : st.studentId)}
                            className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                          >
                            {/* Élève & Classe */}
                            <td className="p-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-800 to-indigo-700 text-white font-black text-xs flex items-center justify-center shadow-2xs shrink-0">
                                  {studentNameObj.firstName.charAt(0)}{studentNameObj.lastName.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900 text-xs group-hover:text-indigo-700 transition-colors truncate">
                                    {studentNameObj.fullName}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold border border-slate-200 text-[10px]">
                                      {st.className}
                                    </span>
                                    {st.matricule && (
                                      <span className="text-[10px] font-mono text-slate-500">
                                        #{st.matricule}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Motif & Statut d'Allègement - TRUTHFUL, ACCURATE & BEAUTIFUL */}
                            <td className="p-3.5">
                              <div className="space-y-1">
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border shadow-2xs"
                                     style={{
                                       backgroundColor: badgeInfo.categoryKey === 'excellence' ? '#fef3c7' :
                                                        badgeInfo.categoryKey === 'social' ? '#f3e8ff' :
                                                        badgeInfo.categoryKey === 'sibling' ? '#e0f2fe' :
                                                        badgeInfo.categoryKey === 'staff' ? '#dcfce7' : '#e0e7ff',
                                       borderColor: badgeInfo.categoryKey === 'excellence' ? '#fde68a' :
                                                    badgeInfo.categoryKey === 'social' ? '#e9d5ff' :
                                                    badgeInfo.categoryKey === 'sibling' ? '#bae6fd' :
                                                    badgeInfo.categoryKey === 'staff' ? '#bbf7d0' : '#c7d2fe',
                                       color: badgeInfo.categoryKey === 'excellence' ? '#78350f' :
                                              badgeInfo.categoryKey === 'social' ? '#581c87' :
                                              badgeInfo.categoryKey === 'sibling' ? '#075985' :
                                              badgeInfo.categoryKey === 'staff' ? '#14532d' : '#312e81'
                                     }}
                                >
                                  <IconComp size={13} className="shrink-0" />
                                  <span className="truncate max-w-[180px]">{st.discountLabel}</span>
                                </div>
                                <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                  <span>{badgeInfo.scopeLabel}</span>
                                </p>
                              </div>
                            </td>

                            {/* Scolarité Brute */}
                            <td className="p-3.5 text-right font-mono font-medium text-slate-700">
                              {st.tuitionUSD > 0 && (
                                <p className="font-bold text-indigo-700">{st.tuitionUSD.toLocaleString()} USD</p>
                              )}
                              <p className={st.tuitionUSD > 0 ? 'text-[11px] text-slate-500' : 'font-bold'}>
                                {st.tuitionHTG.toLocaleString()} HTG
                              </p>
                            </td>

                            {/* Frais Annexes / Divers */}
                            <td className="p-3.5 text-right font-mono font-medium text-slate-700">
                              {st.miscUSD > 0 && (
                                <p className="font-bold text-indigo-700">{st.miscUSD.toLocaleString()} USD</p>
                              )}
                              {st.miscHTG > 0 && (
                                <p className={st.miscUSD > 0 ? 'text-[11px] text-slate-500' : 'font-bold'}>
                                  {st.miscHTG.toLocaleString()} HTG
                                </p>
                              )}
                              {st.miscUSD === 0 && st.miscHTG === 0 && (
                                <span className="text-slate-400 italic text-[11px]">—</span>
                              )}
                            </td>

                            {/* Déduction Accordée */}
                            <td className="p-3.5 text-right font-mono font-bold text-amber-700">
                              {st.reductionUSD > 0 && (
                                <p className="font-bold text-amber-700">-{st.reductionUSD.toLocaleString()} USD</p>
                              )}
                              {st.reductionHTG > 0 && (
                                <p className="font-bold text-amber-700">-{st.reductionHTG.toLocaleString()} HTG</p>
                              )}
                              {st.reductionUSD === 0 && st.reductionHTG === 0 && (
                                <span className="text-slate-400">0 HTG</span>
                              )}
                              <span className="inline-block mt-0.5 text-[9px] font-sans px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-200">
                                -{Math.round(reductionEq).toLocaleString()} HTG eq.
                              </span>
                            </td>

                            {/* Solde Net Exigible */}
                            <td className="p-3.5 text-right font-mono font-black text-emerald-700 bg-emerald-50/30">
                              {st.netUSD > 0 && (
                                <p className="text-emerald-800 font-bold">{st.netUSD.toLocaleString()} USD</p>
                              )}
                              <p className="text-emerald-900 font-black">{st.netHTG.toLocaleString()} HTG</p>
                              <span className="inline-block mt-0.5 text-[9px] font-sans px-1.5 py-0.2 rounded bg-emerald-100/70 text-emerald-900 font-bold border border-emerald-200">
                                {Math.round(netEq).toLocaleString()} HTG net
                              </span>
                            </td>
                          </tr>

                          {/* Expandable Breakdown Drawer */}
                          {isExpanded && (
                            <tr className="bg-slate-900 text-white animate-fade-in">
                              <td colSpan={6} className="p-4 border-t border-slate-800">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                                  <div className="space-y-1">
                                    <p className="text-[11px] font-black uppercase text-indigo-400 tracking-wider">
                                      Formule de Calcul pour {studentNameObj.fullName} ({st.className})
                                    </p>
                                    <div className="flex items-center gap-2 flex-wrap text-slate-300 font-mono text-xs pt-1">
                                      <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-200">
                                        Assiette Brute : {Math.round(grossEq).toLocaleString()} HTG
                                      </span>
                                      <span className="text-amber-400 font-bold">-</span>
                                      <span className="px-2 py-1 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 font-bold">
                                        Allègement ({badgeInfo.scopeLabel}) : -{Math.round(reductionEq).toLocaleString()} HTG
                                      </span>
                                      <span className="text-emerald-400 font-bold">=</span>
                                      <span className="px-2 py-1 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-black">
                                        Net Exigible : {Math.round(netEq).toLocaleString()} HTG
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Statut Comptable</p>
                                    <p className="text-xs font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
                                      <CheckCircle2 size={13} />
                                      Validé & Appliqué au Suivi
                                    </p>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}

                    {filteredStudents.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-10 text-center text-slate-500 space-y-2">
                          <Info size={28} className="mx-auto text-slate-400" />
                          <p className="font-bold text-sm text-slate-700">Aucun dossier trouvé pour ces filtres</p>
                          <p className="text-xs text-slate-400">Essayez de modifier votre recherche ou de réinitialiser le filtre de classe.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>

                  {/* Dynamic Filtered Summary Footer */}
                  {filteredStudents.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300 text-xs">
                        <td colSpan={2} className="p-3.5 text-slate-800 font-black uppercase text-[11px]">
                          Sous-total Filtré ({filteredStudents.length} élèves)
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold">
                          {filteredTotals.tuitionUSD > 0 && <p className="text-indigo-700">{filteredTotals.tuitionUSD.toLocaleString()} USD</p>}
                          <p>{filteredTotals.tuitionHTG.toLocaleString()} HTG</p>
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold">
                          {filteredTotals.miscUSD > 0 && <p className="text-indigo-700">{filteredTotals.miscUSD.toLocaleString()} USD</p>}
                          <p>{filteredTotals.miscHTG.toLocaleString()} HTG</p>
                        </td>
                        <td className="p-3.5 text-right font-mono font-black text-amber-700">
                          {filteredTotals.reductionUSD > 0 && <p>-{filteredTotals.reductionUSD.toLocaleString()} USD</p>}
                          <p>-{filteredTotals.reductionHTG.toLocaleString()} HTG</p>
                        </td>
                        <td className="p-3.5 text-right font-mono font-black text-emerald-800 bg-emerald-100/50">
                          {filteredTotals.netUSD > 0 && <p>{filteredTotals.netUSD.toLocaleString()} USD</p>}
                          <p>{filteredTotals.netHTG.toLocaleString()} HTG</p>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>

        </div>

        {/* =========================================================================
            5. MODAL ACTION FOOTER WITH VIEW TOGGLE & ACTIONS
           ========================================================================= */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-b-3xl shrink-0">
          
          {/* Mode Toggle Button */}
          <button
            type="button"
            onClick={onToggleTargetReevaluated}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center justify-center gap-2 ${
              isTargetReevaluated
                ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200 shadow-2xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
          >
            <div className={`w-2.5 h-2.5 rounded-full ${isTargetReevaluated ? 'bg-indigo-600 animate-pulse' : 'bg-slate-400'}`} />
            <span>
              Mode Tableau de Bord : <strong>{isTargetReevaluated ? 'Objectif Corrigé (Actif)' : 'Objectif Brut Initial'}</strong>
            </span>
          </button>

          {/* Primary Actions */}
          <div className="flex items-center gap-2.5 justify-end">
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Download size={14} className="text-slate-600" />
              <span>Exporter XLSX</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onConfirmReevaluation();
                onClose();
              }}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md hover:shadow-indigo-500/25 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Check size={16} />
              <span>Valider & Enregistrer l'Objectif</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
