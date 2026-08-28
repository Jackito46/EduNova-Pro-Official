import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Coins, 
  GraduationCap, 
  Award, 
  Unlock, 
  Lock, 
  Scale, 
  FileText, 
  UserCheck, 
  Sparkles, 
  Info,
  ChevronDown
} from 'lucide-react';

export type AcademicEvaluationStatus = 
  | 'EXCELLENT_ADMIS' 
  | 'ADMIS' 
  | 'AJOURNE_RATTRAPAGE' 
  | 'REDOUBLEMENT_CONSEILLE' 
  | 'NOTES_EN_ATTENTE';

export type ReenrollmentMode = 
  | 'REGULAR' 
  | 'CONDITIONAL_ACADEMIC' 
  | 'ADMINISTRATIVE_DISPENSATION';

export interface ReenrollmentEvaluation {
  studentDebt: number;
  isFinancialCleared: boolean;
  gradesCount: number;
  averageGrade: number | null;
  maxScale: number; // 10, 20 or 100
  academicStatus: AcademicEvaluationStatus;
  academicSummary: string;
  recommendedClass?: { name: string; level: string } | null;
  currentClassName?: string | null;
  currentClassLevel?: string | null;
}

export interface AdministrativeDispensation {
  enabled: boolean;
  reason: string;
  category: 'FINANCIAL_ARRANGEMENT' | 'ACADEMIC_PENDING' | 'COUNCIL_REPRIEVE' | 'DIRECTION_DECISION' | 'OTHER';
  author: string;
  notes: string;
}

interface ReenrollmentEligibilityCardProps {
  evaluation: ReenrollmentEvaluation;
  dispensation: AdministrativeDispensation;
  onDispensationChange: (dispensation: AdministrativeDispensation) => void;
  terminology: {
    student: string;
    class: string;
    enrollment: string;
    tuition: string;
  };
}

const PRESET_REASONS: Record<AdministrativeDispensation['category'], string> = {
  FINANCIAL_ARRANGEMENT: "Protocole d'accord financier et échéancier de paiement signé avec les parents",
  ACADEMIC_PENDING: "Autorisation provisoire de rentrée - En attente de délibération finale ou saisie des notes",
  COUNCIL_REPRIEVE: "Repêchage et autorisation de passage validés par le Conseil de Classe",
  DIRECTION_DECISION: "Dérogation spéciale octroyée par la Direction Générale de l'Établissement",
  OTHER: "Autre motif administratif particulier"
};

export const ReenrollmentEligibilityCard: React.FC<ReenrollmentEligibilityCardProps> = ({
  evaluation,
  dispensation,
  onDispensationChange,
  terminology
}) => {
  const {
    studentDebt,
    isFinancialCleared,
    gradesCount,
    averageGrade,
    maxScale,
    academicStatus,
    academicSummary,
    recommendedClass,
    currentClassName
  } = evaluation;

  // Calcul du statut effectif de réinscription
  const isRegular = isFinancialCleared && (academicStatus === 'EXCELLENT_ADMIS' || academicStatus === 'ADMIS');
  const isConditionalAcademic = isFinancialCleared && academicStatus === 'NOTES_EN_ATTENTE' && !dispensation.enabled;
  const isDispensationActive = dispensation.enabled;

  const currentMode: ReenrollmentMode = isDispensationActive 
    ? 'ADMINISTRATIVE_DISPENSATION' 
    : isConditionalAcademic 
      ? 'CONDITIONAL_ACADEMIC' 
      : 'REGULAR';

  const hasBlockingIssues = (!isFinancialCleared || academicStatus === 'REDOUBLEMENT_CONSEILLE' || academicStatus === 'AJOURNE_RATTRAPAGE') && !dispensation.enabled;

  // Calcul du niveau de progression (0 à 100%)
  const isStep1Complete = isFinancialCleared || dispensation.enabled;
  const isStep2Complete = academicStatus === 'EXCELLENT_ADMIS' || academicStatus === 'ADMIS' || academicStatus === 'NOTES_EN_ATTENTE' || dispensation.enabled;
  const isStep3Complete = !hasBlockingIssues;

  let completedStepsCount = 0;
  if (isStep1Complete) completedStepsCount++;
  if (isStep2Complete) completedStepsCount++;
  if (isStep3Complete) completedStepsCount++;

  const progressPercentage = Math.round((completedStepsCount / 3) * 100);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Header Banner */}
      <div className={`p-4 sm:p-5 border-b transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
        isDispensationActive
          ? 'bg-amber-500/10 border-amber-200'
          : hasBlockingIssues
            ? 'bg-rose-50/70 border-rose-200'
            : isConditionalAcademic
              ? 'bg-indigo-50/70 border-indigo-200'
              : 'bg-emerald-50/70 border-emerald-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
            isDispensationActive
              ? 'bg-amber-100 text-amber-800 border-amber-300'
              : hasBlockingIssues
                ? 'bg-rose-100 text-rose-700 border-rose-300'
                : isConditionalAcademic
                  ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                  : 'bg-emerald-100 text-emerald-700 border-emerald-300'
          }`}>
            {isDispensationActive ? (
              <Unlock size={20} className="stroke-[2.5]" />
            ) : hasBlockingIssues ? (
              <Lock size={20} className="stroke-[2.5]" />
            ) : (
              <ShieldCheck size={20} className="stroke-[2.5]" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-900 tracking-tight">
                Bilan d'Éligibilité & Critères de Réinscription
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                isDispensationActive
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : hasBlockingIssues
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : isConditionalAcademic
                      ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-300'
              }`}>
                {isDispensationActive ? 'Dérogation Direction' : hasBlockingIssues ? 'Condition Non Remplie' : isConditionalAcademic ? 'Sous Réserve des Notes' : 'Éligible d\'Office'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Évaluation combinée : Quitus Financier (solde) + Verdict Académique (bulletins) + Décision Administrative
            </p>
          </div>
        </div>

        {/* Global Status Pill */}
        <div className="shrink-0 flex items-center gap-2">
          {currentMode === 'REGULAR' && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>Dossier Conforme (Standard)</span>
            </div>
          )}
          {currentMode === 'CONDITIONAL_ACADEMIC' && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-bold">
              <Clock size={14} className="text-indigo-600" />
              <span>Réinscription Conditionnelle</span>
            </div>
          )}
          {currentMode === 'ADMINISTRATIVE_DISPENSATION' && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold">
              <Sparkles size={14} className="text-amber-600" />
              <span>Dérogation Active</span>
            </div>
          )}
        </div>
      </div>

      {/* Visual Progress Bar & Step Tracker */}
      <div className="p-4 sm:p-5 bg-slate-50/60 border-b border-slate-200/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700">Progression des Prérequis :</span>
            <span className="text-xs font-bold text-slate-500 font-mono">({completedStepsCount}/3 étapes validées)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-extrabold font-mono ${
              progressPercentage === 100 
                ? 'text-emerald-600' 
                : progressPercentage >= 66 
                  ? 'text-indigo-600' 
                  : 'text-amber-600'
            }`}>
              {progressPercentage}% Complété
            </span>
          </div>
        </div>

        {/* Dynamic Progress Track */}
        <div className="w-full bg-slate-200/90 rounded-full h-2 overflow-hidden mb-4 shadow-inner">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={`h-full rounded-full transition-all ${
              progressPercentage === 100 
                ? 'bg-emerald-500' 
                : progressPercentage >= 66 
                  ? 'bg-indigo-500' 
                  : 'bg-amber-500'
            }`}
          />
        </div>

        {/* 3 Interactive Milestone Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* STEP 1 : Paiement / Quitus Financier */}
          <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
            isFinancialCleared 
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' 
              : dispensation.enabled
                ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                : 'bg-rose-50/70 border-rose-200 text-rose-900'
          }`}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              isFinancialCleared 
                ? 'bg-emerald-600 text-white' 
                : dispensation.enabled
                  ? 'bg-amber-500 text-white'
                  : 'bg-rose-600 text-white'
            }`}>
              {isFinancialCleared ? <CheckCircle2 size={15} /> : dispensation.enabled ? <Unlock size={15} /> : <AlertTriangle size={15} />}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-black uppercase tracking-tight truncate">
                1. Quitus Financier
              </div>
              <div className="text-[10px] font-semibold opacity-85 truncate">
                {isFinancialCleared ? 'Apurement soldé (0 G)' : dispensation.enabled ? 'Dérogé (Arrangement)' : `Arriérés (${studentDebt.toLocaleString()} G)`}
              </div>
            </div>
          </div>

          {/* STEP 2 : Notes & Bulletins */}
          <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
            academicStatus === 'EXCELLENT_ADMIS' || academicStatus === 'ADMIS'
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              : academicStatus === 'NOTES_EN_ATTENTE'
                ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900'
                : dispensation.enabled
                  ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                  : 'bg-rose-50/70 border-rose-200 text-rose-900'
          }`}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              academicStatus === 'EXCELLENT_ADMIS' || academicStatus === 'ADMIS'
                ? 'bg-emerald-600 text-white'
                : academicStatus === 'NOTES_EN_ATTENTE'
                  ? 'bg-indigo-600 text-white'
                  : dispensation.enabled
                    ? 'bg-amber-500 text-white'
                    : 'bg-rose-600 text-white'
            }`}>
              {academicStatus === 'EXCELLENT_ADMIS' || academicStatus === 'ADMIS' ? (
                <CheckCircle2 size={15} />
              ) : academicStatus === 'NOTES_EN_ATTENTE' ? (
                <Clock size={15} />
              ) : dispensation.enabled ? (
                <Unlock size={15} />
              ) : (
                <AlertTriangle size={15} />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-black uppercase tracking-tight truncate">
                2. Bilan Académique
              </div>
              <div className="text-[10px] font-semibold opacity-85 truncate">
                {academicStatus === 'EXCELLENT_ADMIS' || academicStatus === 'ADMIS'
                  ? `Moyenne validée (${averageGrade?.toFixed(2) || 'OK'})`
                  : academicStatus === 'NOTES_EN_ATTENTE'
                    ? 'Notes en attente (Autorisé)'
                    : dispensation.enabled
                      ? 'Dérogé (Conseil/Direct.)'
                      : 'Non admis d\'office'}
              </div>
            </div>
          </div>

          {/* STEP 3 : Validation Administrative & Promotion */}
          <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
            isStep3Complete
              ? dispensation.enabled
                ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              : 'bg-slate-100 border-slate-200 text-slate-600'
          }`}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              isStep3Complete
                ? dispensation.enabled
                  ? 'bg-amber-500 text-white'
                  : 'bg-emerald-600 text-white'
                : 'bg-slate-400 text-white'
            }`}>
              {isStep3Complete ? <CheckCircle2 size={15} /> : <FileText size={15} />}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-black uppercase tracking-tight truncate">
                3. Validation Admin.
              </div>
              <div className="text-[10px] font-semibold opacity-85 truncate">
                {isStep3Complete 
                  ? (dispensation.enabled ? 'Autorisé sous Dérogation' : 'Prêt à être scellé') 
                  : 'Action requise'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Criteria Grid */}
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CRITÈRE 1: QUITUS FINANCIER */}
        <div className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
          isFinancialCleared
            ? 'bg-emerald-50/30 border-emerald-200/80'
            : 'bg-rose-50/30 border-rose-200/80'
        }`}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${isFinancialCleared ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  <Coins size={16} />
                </div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  1. Quitus Financier (Apurement)
                </h4>
              </div>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                isFinancialCleared 
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                  : 'bg-rose-100 text-rose-800 border-rose-200'
              }`}>
                {isFinancialCleared ? 'Acquitté (0 G)' : 'Arriérés Dûs'}
              </span>
            </div>

            <p className="text-xs text-slate-600 font-medium">
              {isFinancialCleared ? (
                <>L'{terminology.student.toLowerCase()} est totalement à jour de ses règlements sur les sessions précédentes. <strong>Solde débiteur : 0 HTG</strong>.</>
              ) : (
                <>Un arriéré de <strong className="text-rose-700 font-mono font-bold">{studentDebt.toLocaleString()} HTG</strong> est constaté sur le compte de l'{terminology.student.toLowerCase()}.</>
              )}
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">Règle d'économat :</span>
            <span className={`font-bold ${isFinancialCleared ? 'text-emerald-700' : 'text-rose-700'}`}>
              {isFinancialCleared ? 'Paiements réguliers validés' : 'Régularisation requise ou dérogation'}
            </span>
          </div>
        </div>

        {/* CRITÈRE 2: BILAN ACADÉMIQUE & NOTES DU BULLETIN */}
        <div className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
          academicStatus === 'EXCELLENT_ADMIS' || academicStatus === 'ADMIS'
            ? 'bg-emerald-50/30 border-emerald-200/80'
            : academicStatus === 'NOTES_EN_ATTENTE'
              ? 'bg-indigo-50/30 border-indigo-200/80'
              : 'bg-amber-50/30 border-amber-200/80'
        }`}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${
                  academicStatus === 'EXCELLENT_ADMIS' || academicStatus === 'ADMIS'
                    ? 'bg-emerald-100 text-emerald-700'
                    : academicStatus === 'NOTES_EN_ATTENTE'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-amber-100 text-amber-700'
                }`}>
                  <GraduationCap size={16} />
                </div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  2. Bilan Académique & Notes
                </h4>
              </div>

              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                academicStatus === 'EXCELLENT_ADMIS' || academicStatus === 'ADMIS'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : academicStatus === 'NOTES_EN_ATTENTE'
                    ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                    : 'bg-amber-100 text-amber-800 border-amber-200'
              }`}>
                {academicStatus === 'EXCELLENT_ADMIS' && 'Admis d\'office (Mention)'}
                {academicStatus === 'ADMIS' && 'Admis en classe sup.'}
                {academicStatus === 'NOTES_EN_ATTENTE' && 'Notes en attente'}
                {academicStatus === 'AJOURNE_RATTRAPAGE' && 'Ajourné / Rattrapage'}
                {academicStatus === 'REDOUBLEMENT_CONSEILLE' && 'Redoublement proposé'}
              </span>
            </div>

            <div className="text-xs text-slate-600 font-medium">
              {academicStatus === 'NOTES_EN_ATTENTE' ? (
                <div className="flex items-start gap-1.5 text-indigo-900 bg-indigo-50/60 p-2 rounded-lg border border-indigo-100">
                  <Info size={14} className="text-indigo-600 mt-0.5 shrink-0" />
                  <p className="text-[11px] leading-relaxed">
                    Les notes du bulletin annuel ne sont pas encore complètement publiées. <strong>La réinscription provisoire est autorisée</strong> ; les notes seront saisies ultérieurement.
                  </p>
                </div>
              ) : (
                <p className="leading-relaxed">
                  {academicSummary}. {gradesCount > 0 && (
                    <span className="font-semibold text-slate-800">
                      Moyenne constatée : <strong className="font-mono">{averageGrade?.toFixed(2)} / {maxScale}</strong> ({gradesCount} évaluations).
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">Parcours suggéré :</span>
            <span className="font-bold text-slate-900 truncate">
              {recommendedClass ? `${recommendedClass.name} (${recommendedClass.level})` : currentClassName || 'Classe supérieure'}
            </span>
          </div>
        </div>
      </div>

      {/* CRITÈRE 3: DÉROGATION ADMINISTRATIVE & BYPASS SOUPLE */}
      <div className="px-5 pb-5">
        <div className={`p-4 rounded-2xl border transition-all ${
          dispensation.enabled 
            ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/20' 
            : 'bg-slate-50/80 border-slate-200/80'
        }`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className={`p-2 rounded-xl shrink-0 ${
                dispensation.enabled ? 'bg-amber-500 text-white shadow-xs' : 'bg-slate-200 text-slate-600'
              }`}>
                <Scale size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black text-slate-900 tracking-tight uppercase">
                    3. Dérogation Administrative / Accord Direction
                  </h4>
                  {dispensation.enabled && (
                    <span className="px-2 py-0.5 bg-amber-200/70 text-amber-900 border border-amber-300 rounded text-[10px] font-extrabold">
                      ACTIVÉE
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  Permet à l'administration d'autoriser la réinscription même en cas d'arriérés comptables ou de notes non délibérées.
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input 
                type="checkbox" 
                checked={dispensation.enabled}
                onChange={(e) => {
                  const checked = e.target.checked;
                  onDispensationChange({
                    ...dispensation,
                    enabled: checked,
                    reason: checked && !dispensation.reason ? PRESET_REASONS[dispensation.category] : dispensation.reason
                  });
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>

          {/* Formulaire de Dérogation si activé */}
          <AnimatePresence>
            {dispensation.enabled && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-amber-200/80 space-y-3.5"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-amber-950 block mb-1">
                      Catégorie de Dérogation <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={dispensation.category}
                      onChange={(e) => {
                        const cat = e.target.value as AdministrativeDispensation['category'];
                        onDispensationChange({
                          ...dispensation,
                          category: cat,
                          reason: PRESET_REASONS[cat]
                        });
                      }}
                      className="w-full text-xs font-semibold rounded-xl border border-amber-300 p-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    >
                      <option value="ACADEMIC_PENDING">Notes en attente / Délibération ultérieure</option>
                      <option value="FINANCIAL_ARRANGEMENT">Accord d'échéancier financier avec les parents</option>
                      <option value="COUNCIL_REPRIEVE">Repêchage du Conseil de Classe</option>
                      <option value="DIRECTION_DECISION">Décision expresse de la Direction</option>
                      <option value="OTHER">Autre motif administratif</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-amber-950 block mb-1">
                      Autorisé par (Direction / Économe / Rôle)
                    </label>
                    <input 
                      type="text"
                      placeholder="Ex: Direction Générale / Économat"
                      value={dispensation.author}
                      onChange={(e) => onDispensationChange({ ...dispensation, author: e.target.value })}
                      className="w-full text-xs font-semibold rounded-xl border border-amber-300 p-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-amber-950 block mb-1">
                    Motif Officiel & Justification Légale <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Saisissez ou ajustez le motif de la dérogation..."
                    value={dispensation.reason}
                    onChange={(e) => onDispensationChange({ ...dispensation, reason: e.target.value })}
                    className="w-full text-xs font-medium rounded-xl border border-amber-300 p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>

                <div className="flex items-center gap-2 p-2.5 bg-amber-100/70 rounded-xl border border-amber-200 text-xs text-amber-900 font-medium">
                  <UserCheck size={16} className="text-amber-700 shrink-0" />
                  <p className="text-[11px]">
                    Cette dérogation sera tracée dans le journal d'audit institutionnel et mentionnée sur le certificat de réinscription.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
