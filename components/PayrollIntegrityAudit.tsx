import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, AlertTriangle, Building2, Users, CheckCircle2, 
  Sparkles, Trash2, ChevronDown, ChevronUp, AlertCircle, 
  ArrowRight, Filter, RefreshCw, FileText, Check
} from 'lucide-react';
import { StaffMember, PayrollPeriod, PayrollSlip, SalaryAdvance, SchoolCampus } from '../types';
import { Terminology } from '../lib/terminology';

interface PayrollIntegrityAuditProps {
  currentPeriod: PayrollPeriod;
  periodName: string;
  allSchoolStaff: StaffMember[];
  campuses: SchoolCampus[];
  hasMultipleCampuses: boolean;
  slips: PayrollSlip[];
  advances: SalaryAdvance[];
  terminology?: Terminology;
  loading: boolean;
  onPrepareCampus: (campusId: string | null, campusName: string) => Promise<void>;
  onPurgeDuplicate: (slip: PayrollSlip, staffName: string) => Promise<void>;
  onFilterMissingStaff?: () => void;
  onFilterDuplicates?: () => void;
}

export interface CampusAuditRow {
  campus: SchoolCampus;
  activeStaffCount: number;
  preparedSlipsCount: number;
  missingStaff: StaffMember[];
  coveragePercent: number;
  isOmitted: boolean;
  isComplete: boolean;
  duplicatesCount: number;
  totalNet: number;
}

export interface DuplicateSlipGroup {
  staffId: string;
  staffName: string;
  role?: string;
  slips: PayrollSlip[];
  campusNames: string[];
}

export const PayrollIntegrityAudit: React.FC<PayrollIntegrityAuditProps> = ({
  currentPeriod,
  periodName,
  allSchoolStaff,
  campuses,
  hasMultipleCampuses,
  slips,
  advances,
  terminology,
  loading,
  onPrepareCampus,
  onPurgeDuplicate,
  onFilterMissingStaff,
  onFilterDuplicates
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'matrix' | 'duplicates' | 'unassigned'>('matrix');
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  const getCampusName = (campusId?: string | null, staffMember?: StaffMember | null) => {
    const cId = campusId || staffMember?.campus_id;
    if (!cId) return 'Non assigné';
    const found = campuses?.find(c => c.id === cId);
    return found ? found.name : 'Annexe';
  };

  const isSlipInCampus = (s: PayrollSlip, campusId: string | null) => {
    if (!campusId) return true;
    return s.campus_id === campusId || (!s.campus_id && s.staff?.campus_id === campusId);
  };

  // Slips strictly for the current period
  const periodSlips = useMemo(() => {
    return slips.filter(s => s.period_id === currentPeriod.id);
  }, [slips, currentPeriod.id]);

  // 1. Détection des doublons de bulletins (même employé avec >1 fiche dans la même période)
  const duplicateGroups: DuplicateSlipGroup[] = useMemo(() => {
    const map: Record<string, PayrollSlip[]> = {};
    periodSlips.forEach(s => {
      if (!map[s.staff_id]) map[s.staff_id] = [];
      map[s.staff_id].push(s);
    });

    return Object.entries(map)
      .filter(([_, staffSlips]) => staffSlips.length > 1)
      .map(([staffId, staffSlips]) => {
        const member = allSchoolStaff.find(m => m.id === staffId) || staffSlips[0]?.staff;
        const staffName = member 
          ? `${member.first_name} ${member.last_name}`
          : (staffSlips[0]?.staff ? `${staffSlips[0].staff.first_name} ${staffSlips[0].staff.last_name}` : 'Employé inconnu');
        
        return {
          staffId,
          staffName,
          role: member?.role,
          slips: staffSlips,
          campusNames: Array.from(new Set(staffSlips.map(s => getCampusName(s.campus_id, s.staff))))
        };
      });
  }, [periodSlips, allSchoolStaff, campuses]);

  // 2. Analyse croisée par annexe / campus
  const campusMatrix: CampusAuditRow[] = useMemo(() => {
    if (!campuses || campuses.length === 0) return [];

    return campuses.map(campus => {
      const activeCampusStaff = allSchoolStaff.filter(m => m.campus_id === campus.id);
      const campusSlips = periodSlips.filter(s => isSlipInCampus(s, campus.id));
      const preparedStaffIds = new Set(campusSlips.map(s => s.staff_id));
      const missingStaff = activeCampusStaff.filter(m => !preparedStaffIds.has(m.id));

      const campusDuplicates = duplicateGroups.filter(d => 
        d.slips.some(s => isSlipInCampus(s, campus.id))
      );

      const coveragePercent = activeCampusStaff.length > 0 
        ? Math.min(100, Math.round((campusSlips.length / activeCampusStaff.length) * 100))
        : 100;
      
      const isOmitted = activeCampusStaff.length > 0 && campusSlips.length === 0;
      const isComplete = activeCampusStaff.length > 0 && missingStaff.length === 0 && campusDuplicates.length === 0;
      const totalNet = campusSlips.reduce((sum, s) => sum + (s.net_salary || 0), 0);

      return {
        campus,
        activeStaffCount: activeCampusStaff.length,
        preparedSlipsCount: campusSlips.length,
        missingStaff,
        coveragePercent,
        isOmitted,
        isComplete,
        duplicatesCount: campusDuplicates.length,
        totalNet
      };
    });
  }, [campuses, allSchoolStaff, periodSlips, duplicateGroups]);

  // 3. Personnel non assigné à une annexe (risque d'oubli en multi-campus)
  const unassignedActiveStaff = useMemo(() => {
    if (!hasMultipleCampuses) return [];
    return allSchoolStaff.filter(m => !m.campus_id);
  }, [allSchoolStaff, hasMultipleCampuses]);

  const unassignedSlips = useMemo(() => {
    return periodSlips.filter(s => !s.campus_id && (!s.staff || !s.staff.campus_id));
  }, [periodSlips]);

  // 4. Incohérences d'affectation (fiche dans un campus différent de l'employé)
  const mismatchedSlips = useMemo(() => {
    return periodSlips.filter(s => {
      const staffMember = allSchoolStaff.find(m => m.id === s.staff_id) || s.staff;
      return s.campus_id && staffMember?.campus_id && s.campus_id !== staffMember.campus_id;
    });
  }, [periodSlips, allSchoolStaff]);

  // Synthèse globale
  const totalActiveStaff = allSchoolStaff.length;
  const totalSlipsPrepared = periodSlips.length;
  const totalDuplicates = duplicateGroups.length;
  const totalOmittedCampuses = campusMatrix.filter(c => c.isOmitted).length;
  const totalMissingStaffCount = campusMatrix.reduce((sum, c) => sum + c.missingStaff.length, 0);

  const hasCriticalAnomalies = totalDuplicates > 0 || (hasMultipleCampuses && totalOmittedCampuses > 0) || mismatchedSlips.length > 0;
  const is100PercentComplete = !hasCriticalAnomalies && totalMissingStaffCount === 0 && totalActiveStaff > 0;

  const handlePrepareCampusClick = async (campusId: string | null, campusName: string) => {
    setProcessingAction(`prepare-${campusId}`);
    try {
      await onPrepareCampus(campusId, campusName);
    } finally {
      setProcessingAction(null);
    }
  };

  const handlePurgeDuplicateClick = async (slip: PayrollSlip, staffName: string) => {
    setProcessingAction(`purge-${slip.id}`);
    try {
      await onPurgeDuplicate(slip, staffName);
    } finally {
      setProcessingAction(null);
    }
  };

  return (
    <div className={`rounded-2xl border transition-all duration-200 overflow-hidden shadow-2xs ${
      hasCriticalAnomalies
        ? 'bg-rose-50/40 border-rose-200/90'
        : totalMissingStaffCount > 0
        ? 'bg-amber-50/40 border-amber-200/90'
        : 'bg-emerald-50/30 border-emerald-200/80'
    }`}>
      {/* Entête du Widget d'Intégrité */}
      <div className="p-3.5 sm:p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className={`p-2.5 rounded-xl shrink-0 ${
            hasCriticalAnomalies
              ? 'bg-rose-500 text-white shadow-xs'
              : totalMissingStaffCount > 0
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-emerald-500 text-white shadow-xs'
          }`}>
            {hasCriticalAnomalies ? (
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            ) : totalMissingStaffCount > 0 ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight truncate">
                Contrôle d'Intégrité des Effectifs & Annexes
              </h3>
              {is100PercentComplete ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  100% Conforme • 0 anomalie
                </span>
              ) : hasCriticalAnomalies ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                  {totalDuplicates > 0 ? `${totalDuplicates} doublon(s)` : ''}
                  {totalDuplicates > 0 && totalOmittedCampuses > 0 ? ' • ' : ''}
                  {totalOmittedCampuses > 0 ? `${totalOmittedCampuses} annexe(s) oubliée(s)` : ''}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                  <AlertCircle className="w-3 h-3 text-amber-600" />
                  {totalMissingStaffCount} employé(s) en attente de bulletin
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-slate-600 mt-0.5">
              Croisement actif : <span className="font-bold text-slate-800">{totalSlipsPrepared}</span> fiches générées sur <span className="font-bold text-slate-800">{totalActiveStaff}</span> effectifs sous contrat pour la période <span className="font-bold text-slate-900">{periodName}</span>.
            </p>
          </div>
        </div>

        {/* Boutons d'Action Rapide & Dépliement */}
        <div className="flex items-center gap-2 self-end md:self-center shrink-0">
          {totalDuplicates > 0 && onFilterDuplicates && (
            <button
              type="button"
              onClick={onFilterDuplicates}
              className="px-2.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border border-rose-200 cursor-pointer shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Gérer les doublons ({totalDuplicates})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-200 cursor-pointer shadow-2xs"
          >
            <span>{isExpanded ? 'Réduire' : 'Vérifier les détails'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Détails Dépliables */}
      {isExpanded && (
        <div className="border-t border-slate-200/70 p-3.5 sm:p-5 space-y-4 sm:space-y-5 bg-white">
          {/* Grille des KPIs de contrôle */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Effectif Actif Total</span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-xl sm:text-2xl font-black text-slate-900">{totalActiveStaff}</span>
                <span className="text-xs font-bold text-slate-600">employés</span>
              </div>
              <span className="text-[10px] font-semibold text-slate-500 block mt-0.5">
                {hasMultipleCampuses ? `${campuses.length} annexes actives` : 'Site principal'}
              </span>
            </div>

            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Bulletins Générés</span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-xl sm:text-2xl font-black text-blue-700">{totalSlipsPrepared}</span>
                <span className="text-xs font-bold text-slate-600">/ {totalActiveStaff}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    totalSlipsPrepared >= totalActiveStaff ? 'bg-emerald-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${totalActiveStaff > 0 ? Math.min(100, Math.round((totalSlipsPrepared / totalActiveStaff) * 100)) : 0}%` }}
                />
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${
              totalDuplicates > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50/80 border-slate-200/80'
            }`}>
              <span className={`text-[11px] font-bold uppercase tracking-wider block ${
                totalDuplicates > 0 ? 'text-rose-700' : 'text-slate-500'
              }`}>
                Doublons de Bulletin
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className={`text-xl sm:text-2xl font-black ${
                  totalDuplicates > 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}>
                  {totalDuplicates}
                </span>
                <span className="text-xs font-bold text-slate-600">anomalie(s)</span>
              </div>
              <span className={`text-[10px] font-semibold block mt-0.5 ${
                totalDuplicates > 0 ? 'text-rose-600 font-bold' : 'text-emerald-600'
              }`}>
                {totalDuplicates === 0 ? 'Aucun doublon détecté' : 'Action immédiate requise'}
              </span>
            </div>

            <div className={`p-3 rounded-xl border ${
              totalOmittedCampuses > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50/80 border-slate-200/80'
            }`}>
              <span className={`text-[11px] font-bold uppercase tracking-wider block ${
                totalOmittedCampuses > 0 ? 'text-rose-700' : 'text-slate-500'
              }`}>
                Annexes Oubliées
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className={`text-xl sm:text-2xl font-black ${
                  totalOmittedCampuses > 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}>
                  {totalOmittedCampuses}
                </span>
                <span className="text-xs font-bold text-slate-600">/ {campuses.length}</span>
              </div>
              <span className={`text-[10px] font-semibold block mt-0.5 ${
                totalOmittedCampuses > 0 ? 'text-rose-600 font-bold' : 'text-emerald-600'
              }`}>
                {totalOmittedCampuses === 0 ? 'Toutes les annexes couvertes' : 'Aucun bulletin préparé'}
              </span>
            </div>
          </div>

          {/* Onglets secondaires de diagnostic */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('matrix')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'matrix'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Matrice par Annexe ({campusMatrix.length})</span>
            </button>

            {totalDuplicates > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('duplicates')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'duplicates'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Doublons à corriger ({totalDuplicates})</span>
              </button>
            )}

            {unassignedActiveStaff.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('unassigned')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'unassigned'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Sans Annexe ({unassignedActiveStaff.length})</span>
              </button>
            )}
          </div>

          {/* CONTENU ONGLET 1 : MATRICE CROISÉE PAR ANNEXE */}
          {activeTab === 'matrix' && (
            <div className="space-y-3">
              {hasMultipleCampuses && campusMatrix.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs min-w-[620px]">
                    <thead className="bg-slate-100 text-slate-800 font-extrabold border-b border-slate-200 uppercase tracking-wider">
                      <tr>
                        <th className="px-3.5 py-2.5">Annexe / Campus</th>
                        <th className="px-3.5 py-2.5 text-center">Effectif Actif</th>
                        <th className="px-3.5 py-2.5 text-center">Bulletins Générés</th>
                        <th className="px-3.5 py-2.5 text-center">Couverture</th>
                        <th className="px-3.5 py-2.5">Statut Diagnostic</th>
                        <th className="px-3.5 py-2.5 text-right">Masse Salariale</th>
                        <th className="px-3.5 py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {campusMatrix.map((item) => {
                        const isActionLoading = processingAction === `prepare-${item.campus.id}`;
                        return (
                          <tr key={item.campus.id} className={`hover:bg-slate-50/80 transition-colors ${
                            item.isOmitted 
                              ? 'bg-rose-50/30' 
                              : item.duplicatesCount > 0 
                              ? 'bg-rose-50/20' 
                              : item.missingStaff.length > 0 
                              ? 'bg-amber-50/20' 
                              : ''
                          }`}>
                            <td className="px-3.5 py-3">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                                  <Building2 className="w-4 h-4" />
                                </div>
                                <div>
                                  <span className="font-extrabold text-slate-900 block text-xs sm:text-sm">
                                    {item.campus.name}
                                  </span>
                                  {item.campus.address && (
                                    <span className="text-[10px] text-slate-500 block truncate max-w-[180px]">
                                      {item.campus.address}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="px-3.5 py-3 text-center font-bold text-slate-800">
                              {item.activeStaffCount}
                            </td>

                            <td className="px-3.5 py-3 text-center font-bold text-blue-700">
                              {item.preparedSlipsCount}
                            </td>

                            <td className="px-3.5 py-3 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className={`text-[11px] font-black ${
                                  item.coveragePercent === 100 
                                    ? 'text-emerald-700' 
                                    : item.coveragePercent === 0 
                                    ? 'text-rose-700' 
                                    : 'text-amber-700'
                                }`}>
                                  {item.coveragePercent}%
                                </span>
                                <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${
                                      item.coveragePercent === 100 
                                        ? 'bg-emerald-500' 
                                        : item.coveragePercent === 0 
                                        ? 'bg-rose-500' 
                                        : 'bg-amber-500'
                                    }`}
                                    style={{ width: `${item.coveragePercent}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            <td className="px-3.5 py-3">
                              {item.isOmitted ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                                  Annexe Oubliée (0%)
                                </span>
                              ) : item.duplicatesCount > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                  <AlertCircle className="w-3 h-3 text-rose-600" />
                                  {item.duplicatesCount} Doublon(s)
                                </span>
                              ) : item.missingStaff.length > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                                  <AlertCircle className="w-3 h-3 text-amber-600" />
                                  {item.missingStaff.length} en attente
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  100% Conforme
                                </span>
                              )}
                            </td>

                            <td className="px-3.5 py-3 text-right font-extrabold text-slate-900 tabular-nums">
                              {item.totalNet.toLocaleString()} <span className="text-[10px] text-slate-500 font-bold">HTG</span>
                            </td>

                            <td className="px-3.5 py-3 text-right">
                              {item.missingStaff.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => handlePrepareCampusClick(item.campus.id, item.campus.name)}
                                  disabled={loading || isActionLoading || currentPeriod.status === 'VALIDATED' || currentPeriod.status === 'CLOSED'}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer"
                                  title={`Générer les ${item.missingStaff.length} fiches manquantes`}
                                >
                                  <Sparkles className="w-3 h-3" />
                                  <span>{isActionLoading ? 'Génération...' : `Générer (${item.missingStaff.length})`}</span>
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> À jour
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <p className="text-xs font-bold text-slate-700">
                    Configuration mono-site : Tous les employés actifs ({totalActiveStaff}) sont rattachés au site principal.
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {totalMissingStaffCount > 0 
                      ? `${totalMissingStaffCount} employé(s) restent à préparer.` 
                      : 'Tous les employés disposent d\'une fiche de paie générée.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* CONTENU ONGLET 2 : GESTION DES DOUBLONS */}
          {activeTab === 'duplicates' && (
            <div className="space-y-3">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-900 font-medium">
                  <span className="font-black">Alerte intégrité paie :</span> Plusieurs bulletins ont été émis pour le même employé durant la même période ({periodName}). Cette anomalie peut fausser la masse salariale et les déclarations sociales. Vous pouvez purger les bulletins redondants ci-dessous.
                </div>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                {duplicateGroups.map((group) => (
                  <div key={group.staffId} className="p-3 sm:p-4 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900">{group.staffName}</span>
                        {group.role && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                            {group.role}
                          </span>
                        )}
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                          {group.slips.length} fiches en conflit
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-500">
                        Annexes : {group.campusNames.join(', ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {group.slips.map((slip, index) => {
                        const isPurging = processingAction === `purge-${slip.id}`;
                        return (
                          <div 
                            key={slip.id} 
                            className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-800">
                                  Bulletin #{index + 1}
                                </span>
                                <span className={`text-[10px] font-black px-1.5 py-0.2 rounded border ${
                                  slip.status === 'PAID' 
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}>
                                  {slip.status === 'PAID' ? 'Déjà Payé' : 'Non payé'}
                                </span>
                              </div>
                              <div className="text-[11px] font-extrabold text-slate-900 mt-0.5">
                                Net: {slip.net_salary?.toLocaleString()} HTG
                                <span className="text-[10px] font-normal text-slate-500 ml-1.5">
                                  ({getCampusName(slip.campus_id, slip.staff)})
                                </span>
                              </div>
                            </div>

                            {/* Ne pas supprimer les fiches déjà payées sauf confirmation */}
                            <button
                              type="button"
                              onClick={() => handlePurgeDuplicateClick(slip, group.staffName)}
                              disabled={loading || isPurging || slip.status === 'PAID'}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-all border border-rose-200 flex items-center gap-1 cursor-pointer disabled:opacity-40"
                              title={slip.status === 'PAID' ? 'Impossible de supprimer un bulletin déjà payé' : 'Supprimer ce doublon'}
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>{isPurging ? 'Suppression...' : 'Supprimer'}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CONTENU ONGLET 3 : PERSONNEL SANS ANNEXE */}
          {activeTab === 'unassigned' && (
            <div className="space-y-3">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 font-medium">
                  <span className="font-black">Attention d'affectation :</span> {unassignedActiveStaff.length} membre(s) du personnel actif(s) ne sont affectés à aucune annexe ou campus dans le système. Leurs fiches de paie risquent d'être exclues lors des filtrages par annexe.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {unassignedActiveStaff.map(member => {
                  const hasSlip = periodSlips.some(s => s.staff_id === member.id);
                  return (
                    <div key={member.id} className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                      <div>
                        <span className="font-extrabold text-xs sm:text-sm text-slate-900 block">
                          {member.first_name} {member.last_name}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500 block">
                          {member.role || 'Personnel'} • {member.pay_type || 'Fixe'}
                        </span>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                        hasSlip 
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {hasSlip ? 'Bulletin généré' : 'En attente'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
