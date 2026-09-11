import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserProfile } from '../types';
import { useSchool } from '../contexts/SchoolContext';
import { formatFullName } from '../utils/formatters';
import { 
  BookOpen, 
  TrendingUp, 
  Receipt, 
  Wallet, 
  GraduationCap, 
  ChevronRight, 
  Clock, 
  Smartphone, 
  Layers, 
  Search, 
  Award, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  User, 
  X,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';

interface StudentDashboardGridProps {
  user: UserProfile;
  student: any;
  studentStats: {
    className: string;
    attendanceRate: number;
    averageGrade: number;
    paymentsStatus: string;
    globalDebt: number;
    totalPaid: number;
    totalDue: number;
    admissionExpected: number;
    admissionPaid: number;
    admissionBalance: number;
    tuitionExpected: number;
    tuitionPaid: number;
    tuitionBalance: number;
    miscExpected?: number;
    miscPaid?: number;
    miscBalance?: number;
    campaignsExpected: number;
    campaignsPaid: number;
    campaignsBalance: number;
    hasCampaigns: boolean;
    discountAmount: number;
    wallet_balance_htg: number;
    wallet_balance_usd: number;
  };
  courses: any[];
  grades: any[];
  onOpenWalletTopUp: () => void;
  academicYearLabel?: string;
}

export const StudentDashboardGrid: React.FC<StudentDashboardGridProps> = ({
  user,
  student,
  studentStats,
  courses,
  grades,
  onOpenWalletTopUp,
  academicYearLabel
}) => {
  const navigate = useNavigate();
  const { terminology } = useSchool();

  // Interactive filters
  const [courseSearch, setCourseSearch] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('ALL');
  const [selectedCourseDetail, setSelectedCourseDetail] = useState<any | null>(null);

  // Filtered courses
  const filteredCourses = useMemo(() => {
    if (!courseSearch.trim()) return courses;
    const query = courseSearch.toLowerCase();
    return courses.filter(c => {
      const subjectName = (c.subject?.name || c.name || '').toLowerCase();
      const code = (c.subject?.code || c.code || '').toLowerCase();
      const teacher = c.staff ? `${c.staff.first_name || ''} ${c.staff.last_name || ''}`.toLowerCase() : '';
      return subjectName.includes(query) || code.includes(query) || teacher.includes(query);
    });
  }, [courses, courseSearch]);

  // Unique terms in grades
  const termsList = useMemo(() => {
    const set = new Set<string>();
    grades.forEach(g => {
      if (g.term) set.add(g.term);
    });
    return Array.from(set);
  }, [grades]);

  // Filtered grades
  const filteredGrades = useMemo(() => {
    if (selectedTerm === 'ALL') return grades;
    return grades.filter(g => g.term === selectedTerm);
  }, [grades, selectedTerm]);

  // Grade badge helper
  const getGradeScoreBadge = (score: number, maxScore: number = 20) => {
    const ratio = maxScore > 0 ? (score / maxScore) * 100 : 0;
    if (ratio >= 80) {
      return {
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
        label: 'Très bien'
      };
    } else if (ratio >= 60) {
      return {
        bg: 'bg-blue-50 text-blue-700 border-blue-200',
        dot: 'bg-blue-500',
        label: 'Bien'
      };
    } else if (ratio >= 50) {
      return {
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-500',
        label: 'Passable'
      };
    }
    return {
      bg: 'bg-rose-50 text-rose-700 border-rose-200',
      dot: 'bg-rose-500',
      label: 'Insuffisant'
    };
  };

  return (
    <div id="student-dashboard-grid-root" className="space-y-8 animate-in fade-in duration-500">
      {/* 1. TOP AIRY KPI BAR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Card 1: Ma Classe */}
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 flex flex-col justify-between hover:shadow-md hover:border-indigo-200 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              Ma {terminology.class}
            </span>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100/70 shadow-xs">
              <GraduationCap size={20} />
            </div>
          </div>
          <div>
            <p className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              {studentStats.className || 'Non assigné'}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-semibold text-slate-500">
                {academicYearLabel || 'Session Académique Active'}
              </span>
              {courses.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {courses.length} {terminology.subjects.toLowerCase()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Ma Moyenne */}
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 flex flex-col justify-between hover:shadow-md hover:border-emerald-200 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              Moyenne Académique
            </span>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100/70 shadow-xs">
              <TrendingUp size={20} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                {studentStats.averageGrade > 0 ? studentStats.averageGrade : '--'}
              </p>
              {studentStats.averageGrade > 0 && (
                <span className="text-sm font-bold text-slate-400">/ 20</span>
              )}
            </div>
            <p className="mt-2 text-xs font-semibold flex items-center gap-1.5 text-slate-500">
              <span className={`w-2 h-2 rounded-full ${studentStats.averageGrade >= 10 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {studentStats.averageGrade >= 14 ? 'Excellente progression' : studentStats.averageGrade >= 10 ? 'Résultats satisfaisants' : 'Relevé disponible en continu'}
            </p>
          </div>
        </div>

        {/* Card 3: Situation Économat */}
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 flex flex-col justify-between hover:shadow-md hover:border-amber-200 transition-all duration-300 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              Total Versé
            </span>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100/70 shadow-xs">
              <Receipt size={20} />
            </div>
          </div>
          <div>
            <p className="text-2xl lg:text-3xl font-black text-amber-600 tracking-tight">
              {studentStats.totalPaid.toLocaleString()} HTG
            </p>
            <p className={`mt-2 text-xs font-bold flex items-center gap-1.5 ${studentStats.globalDebt <= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
              <span className={`h-2 w-2 rounded-full ${studentStats.globalDebt <= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              {studentStats.globalDebt <= 0 ? 'Compte scolarité en règle' : `Solde restant : ${studentStats.globalDebt.toLocaleString()} HTG`}
            </p>
          </div>
        </div>
      </div>

      {/* 2. MAIN 3-SECTION AIRY GRID: COURS, NOTES, FINANCE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
        
        {/* ========================================================================= */}
        {/* SECTION 1: CARTE INTERACTIVE 'COURS' */}
        {/* ========================================================================= */}
        <div 
          id="student-card-courses"
          className="bg-white rounded-3xl shadow-xs border border-slate-200/80 overflow-hidden flex flex-col hover:border-indigo-200 transition-all duration-300"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-indigo-50/40 via-white to-slate-50/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-xs shrink-0">
                <BookOpen size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Mes {terminology.subjects}
                  </h3>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0">
                    {courses.length}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium truncate">
                  Programme académique officiel
                </p>
              </div>
            </div>
            <Link
              to="/mes-cours"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-white hover:bg-indigo-50 border border-slate-200/80 px-3 py-1.5 rounded-xl transition-all shadow-2xs flex items-center gap-1 shrink-0"
            >
              <span>Voir tout</span>
              <ChevronRight size={13} />
            </Link>
          </div>

          {/* Search bar inside courses card */}
          {courses.length > 4 && (
            <div className="p-4 border-b border-slate-100 bg-slate-50/40">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={`Rechercher une matière ou un enseignant...`}
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>
          )}

          {/* Course List */}
          <div className="p-4 sm:p-5 max-h-[380px] overflow-y-auto custom-scrollbar space-y-2.5">
            {filteredCourses.length === 0 ? (
              <div className="text-center py-12 px-4 space-y-2">
                <BookOpen size={36} className="mx-auto text-slate-300 stroke-[1.5]" />
                <p className="text-sm font-bold text-slate-700">Aucune matière trouvée</p>
                <p className="text-xs text-slate-400">
                  {courseSearch ? 'Aucun résultat ne correspond à votre recherche.' : 'Aucun cours n\'est encore assigné pour cette classe.'}
                </p>
              </div>
            ) : (
              filteredCourses.map((c) => {
                const subjectName = c.subject?.name || c.name || 'Matière';
                const code = c.subject?.code || c.code || '';
                const coeff = c.coefficient || c.subject?.coefficient || 1;
                const teacherName = c.staff 
                  ? formatFullName(`${c.staff.first_name || ''} ${c.staff.last_name || ''}`)
                  : null;

                return (
                  <div
                    key={c.id || subjectName}
                    onClick={() => setSelectedCourseDetail(c)}
                    className="p-3.5 rounded-2xl bg-slate-50/70 hover:bg-indigo-50/40 border border-slate-200/70 hover:border-indigo-200 transition-all duration-200 cursor-pointer group flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-indigo-700 transition-colors">
                          {subjectName}
                        </span>
                        {code && (
                          <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-white text-slate-500 border border-slate-200/80">
                            {code}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                        {teacherName ? (
                          <span className="flex items-center gap-1 text-slate-600 truncate">
                            <User size={11} className="text-slate-400 shrink-0" />
                            {teacherName}
                          </span>
                        ) : (
                          <span className="italic text-slate-400 text-[10px]">Professeur non assigné</span>
                        )}
                        <span className="font-semibold text-indigo-600 bg-indigo-50/80 px-1.5 py-0.2 rounded text-[10px]">
                          Coeff. {coeff}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 p-1 rounded-lg text-slate-400 group-hover:text-indigo-600 group-hover:bg-white transition-all">
                      <ArrowUpRight size={16} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Card Actions */}
          <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-3">
            <Link
              to="/mon-horaire"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors"
            >
              <Clock size={13} className="text-slate-400" />
              <span>Emploi du temps</span>
            </Link>
            <button
              type="button"
              onClick={() => navigate('/mes-cours')}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
            >
              Accéder aux cours
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 2: CARTE INTERACTIVE 'NOTES' */}
        {/* ========================================================================= */}
        <div 
          id="student-card-grades"
          className="bg-white rounded-3xl shadow-xs border border-slate-200/80 overflow-hidden flex flex-col hover:border-emerald-200 transition-all duration-300"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-emerald-50/40 via-white to-slate-50/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-xs shrink-0">
                <TrendingUp size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Mes Notes
                  </h3>
                  {studentStats.averageGrade > 0 && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
                      Moy: {studentStats.averageGrade}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-medium truncate">
                  Évaluations et relevés continus
                </p>
              </div>
            </div>
            <Link
              to="/mes-notes"
              className="text-xs font-bold text-emerald-600 hover:text-emerald-800 bg-white hover:bg-emerald-50 border border-slate-200/80 px-3 py-1.5 rounded-xl transition-all shadow-2xs flex items-center gap-1 shrink-0"
            >
              <span>Bulletins</span>
              <ChevronRight size={13} />
            </Link>
          </div>

          {/* Period filter buttons if multiple terms exist */}
          {termsList.length > 1 && (
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/40 flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedTerm('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  selectedTerm === 'ALL'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70'
                }`}
              >
                Toutes
              </button>
              {termsList.map(term => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setSelectedTerm(term)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    selectedTerm === term
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70'
                  }`}
                >
                  {term}
                </button>
              ))}
            </div>
          )}

          {/* Grades List */}
          <div className="p-4 sm:p-5 max-h-[380px] overflow-y-auto custom-scrollbar space-y-2.5">
            {filteredGrades.length === 0 ? (
              <div className="text-center py-12 px-4 space-y-2">
                <Award size={36} className="mx-auto text-slate-300 stroke-[1.5]" />
                <p className="text-sm font-bold text-slate-700">Aucune note enregistrée</p>
                <p className="text-xs text-slate-400">
                  Les résultats d'évaluations et de contrôles apparaitront ici dès leur saisie par les enseignants.
                </p>
              </div>
            ) : (
              filteredGrades.map((g, idx) => {
                const subjectTitle = g.subject?.name || 'Matière';
                const score = Number(g.score);
                const maxScore = Number(g.max_score || 20);
                const badge = getGradeScoreBadge(score, maxScore);

                return (
                  <div
                    key={g.id || idx}
                    className="p-3.5 rounded-2xl bg-slate-50/70 hover:bg-emerald-50/40 border border-slate-200/70 hover:border-emerald-200 transition-all duration-200 flex items-center justify-between gap-3 shadow-2xs group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-emerald-700 transition-colors">
                          {subjectTitle}
                        </span>
                        {g.term && (
                          <span className="text-[10px] font-semibold text-slate-400 px-1.5 py-0.2 rounded bg-white border border-slate-200/60">
                            {g.term}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {g.evaluation_title || 'Évaluation périodique'}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black border ${badge.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                        {score} / {maxScore}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Card Actions */}
          <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-500">
              {filteredGrades.length} note(s) affichée(s)
            </span>
            <button
              type="button"
              onClick={() => navigate('/mes-notes')}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
            >
              Relevé complet
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 3: CARTE INTERACTIVE 'FINANCE' */}
        {/* ========================================================================= */}
        <div 
          id="student-card-finance"
          className="bg-white rounded-3xl shadow-xs border border-slate-200/80 overflow-hidden flex flex-col hover:border-amber-200 transition-all duration-300"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-amber-50/40 via-white to-slate-50/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 bg-amber-500 text-white rounded-2xl shadow-xs shrink-0">
                <Wallet size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Finance & Économat
                  </h3>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                    studentStats.globalDebt <= 0 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {studentStats.globalDebt <= 0 ? 'À jour' : 'Solde restant'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium truncate">
                  Contributions, scolarité et portefeuille
                </p>
              </div>
            </div>
            <Link
              to="/mon-economat"
              className="text-xs font-bold text-amber-700 hover:text-amber-900 bg-white hover:bg-amber-50 border border-slate-200/80 px-3 py-1.5 rounded-xl transition-all shadow-2xs flex items-center gap-1 shrink-0"
            >
              <span>Reçus</span>
              <ChevronRight size={13} />
            </Link>
          </div>

          {/* Body: Financial Breakdown & Wallet */}
          <div className="p-4 sm:p-5 max-h-[380px] overflow-y-auto custom-scrollbar space-y-3.5">
            {/* High-level Debt Pill Box */}
            <div className="p-3.5 rounded-2xl bg-slate-900 text-white flex items-center justify-between gap-2 shadow-xs">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Solde à Régler
                </span>
                <span className="text-lg sm:text-xl font-black">
                  {studentStats.globalDebt <= 0 ? '0 HTG' : `${studentStats.globalDebt.toLocaleString()} HTG`}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                  Total Versé
                </span>
                <span className="text-sm sm:text-base font-bold text-emerald-300">
                  +{studentStats.totalPaid.toLocaleString()} G
                </span>
              </div>
            </div>

            {/* Category breakdown rows */}
            <div className="space-y-2">
              {/* Inscription / Admission */}
              <div className="p-3 rounded-2xl bg-slate-50/70 border border-slate-200/70 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800 block">Frais d'Admission</span>
                  <span className="text-[10px] text-slate-400">Exigible: {studentStats.admissionExpected?.toLocaleString()} HTG</span>
                </div>
                <div className="text-right">
                  <span className={`font-black text-xs ${studentStats.admissionBalance <= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {studentStats.admissionBalance <= 0 ? 'Réglé' : `Reste ${studentStats.admissionBalance?.toLocaleString()} G`}
                  </span>
                </div>
              </div>

              {/* Scolarité (Écolage) */}
              <div className="p-3 rounded-2xl bg-slate-50/70 border border-slate-200/70 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800 block">Écolage Annuel</span>
                  <span className="text-[10px] text-slate-400">Exigible: {studentStats.tuitionExpected?.toLocaleString()} HTG</span>
                </div>
                <div className="text-right">
                  <span className={`font-black text-xs ${studentStats.tuitionBalance <= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {studentStats.tuitionBalance <= 0 ? 'Réglé' : `Reste ${studentStats.tuitionBalance?.toLocaleString()} G`}
                  </span>
                </div>
              </div>

              {/* Frais Divers Obligatoires */}
              {((studentStats.miscExpected || 0) > 0 || (studentStats.miscPaid || 0) > 0) && (
                <div className="p-3 rounded-2xl bg-slate-50/70 border border-slate-200/70 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800 block">Frais Divers</span>
                    <span className="text-[10px] text-slate-400">Exigible: {(studentStats.miscExpected || 0).toLocaleString()} HTG</span>
                  </div>
                  <div className="text-right">
                    <span className={`font-black text-xs ${(studentStats.miscBalance || 0) <= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {(studentStats.miscBalance || 0) <= 0 ? 'Réglé' : `Reste ${(studentStats.miscBalance || 0).toLocaleString()} G`}
                    </span>
                  </div>
                </div>
              )}

              {/* Campagnes et Activités Ad-Hoc */}
              {((studentStats.campaignsExpected || 0) > 0 || (studentStats.campaignsPaid || 0) > 0) && (
                <div className="p-3 rounded-2xl bg-slate-50/70 border border-slate-200/70 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800 block">Campagnes & Activités</span>
                    <span className="text-[10px] text-slate-400">Exigible: {(studentStats.campaignsExpected || 0).toLocaleString()} HTG</span>
                  </div>
                  <div className="text-right">
                    <span className={`font-black text-xs ${(studentStats.campaignsBalance || 0) <= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {(studentStats.campaignsBalance || 0) <= 0 ? 'Réglé' : `Reste ${(studentStats.campaignsBalance || 0).toLocaleString()} G`}
                    </span>
                  </div>
                </div>
              )}

              {/* Portefeuille MonCash / Natcash */}
              <div className="p-3.5 rounded-2xl bg-cyan-50/50 border border-cyan-200/70 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Smartphone size={15} className="text-cyan-600" />
                    <span className="font-bold text-xs text-slate-800">Portefeuille Étudiant</span>
                  </div>
                  <span className="text-xs font-black text-cyan-800 font-mono">
                    {studentStats.wallet_balance_htg?.toLocaleString()} HTG
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenWalletTopUp}
                  className="w-full py-2 px-3 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Smartphone size={13} />
                  <span>Recharger via MonCash</span>
                </button>
              </div>
            </div>
          </div>

          {/* Footer Card Actions */}
          <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-500">
              Économat en ligne
            </span>
            <button
              type="button"
              onClick={() => navigate('/mon-economat')}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
            >
              Gérer mes reçus
            </button>
          </div>
        </div>
      </div>

      {/* Course Detail Modal */}
      {selectedCourseDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-50/40">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-2xl">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">
                    {selectedCourseDetail.subject?.name || selectedCourseDetail.name}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">Fiche descriptive de la matière</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCourseDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Coefficient</span>
                  <span className="text-sm font-black text-slate-800">
                    Coeff. {selectedCourseDetail.coefficient || selectedCourseDetail.subject?.coefficient || 1}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Code Matière</span>
                  <span className="text-sm font-mono font-bold text-slate-800">
                    {selectedCourseDetail.subject?.code || selectedCourseDetail.code || 'N/A'}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Professeur Référent</span>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                    <User size={14} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      {selectedCourseDetail.staff 
                        ? formatFullName(`${selectedCourseDetail.staff.first_name || ''} ${selectedCourseDetail.staff.last_name || ''}`)
                        : 'Enseignant non assigné'
                      }
                    </p>
                    <p className="text-[10px] text-slate-400">Corps professoral actif</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCourseDetail(null);
                    navigate('/mon-horaire');
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  Voir l'horaire
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCourseDetail(null);
                    navigate('/mes-cours');
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
                >
                  Ouvrir l'Espace Cours
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
