import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  User, Users, FileText, CheckCircle2, TrendingUp,
  ArrowRight, ChevronDown, ShieldCheck, ArrowLeft, Loader2,
  AlertCircle, Fingerprint, ShieldAlert, RefreshCw, Edit2, RotateCcw,
  CalendarCheck, ArrowUpCircle, Wallet, Ban, Coins, GraduationCap,
  Layers, MapPin, Phone, Info, AlertTriangle, Baby, Sparkles,
  Building2, CreditCard, Receipt, Check, Calendar, Mail, Home, Clock,
  FileCheck2, XCircle, Search, School as SchoolIcon, ChevronRight,
  Banknote
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase, isValidUuid } from '../supabase';
import { useSchool } from '../contexts/SchoolContext';
import { useFormDraft } from '../hooks/useFormDraft';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { AuditLogger } from '../utils/auditLogger';
import { UserProfile, SchoolClass, SchoolLevel, DocumentStatus } from '../types';
import { studentSchema } from '../utils/validation';
import { formatStudentName, getDefiniteArticle } from '../utils/formatters';
import { getAllowedClassesForReenrollment, getClassAgeRange, ACADEMIC_PATH, getNextClassLevel } from '../utils/academicPath';
import { 
  getDocumentDefinitionsForSchoolType, 
  normalizeStudentDocuments, 
  calculateDocumentsCompleteness 
} from '../utils/documentRequirements';
import { getActiveSchoolPaymentMethods, getPaymentMethodConfig } from '../lib/paymentMethods';
import { 
  ReenrollmentEligibilityCard, 
  ReenrollmentEvaluation, 
  AdministrativeDispensation, 
  AcademicEvaluationStatus 
} from './ReenrollmentEligibilityCard';

const InfoTooltip = ({ content, title }: { content: string; title?: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative inline-flex items-center ml-1">
      <button
        type="button"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onClick={() => setIsOpen(!isOpen)}
        className="text-slate-400 hover:text-indigo-600 focus:text-indigo-600 focus:outline-none transition-colors p-0.5 rounded-full hover:bg-indigo-50"
        title="Information complémentaire"
        aria-label="Aide contextuelle"
      >
        <Info size={14} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 z-50 p-3 bg-slate-900 text-white text-xs font-medium rounded-xl shadow-xl border border-slate-700 pointer-events-none"
          >
            {title && <p className="font-bold text-indigo-300 text-[11px] mb-1 uppercase tracking-wider">{title}</p>}
            <p className="leading-relaxed text-[11px] text-slate-200">{content}</p>
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FormField = ({ label, name, type = 'text', placeholder = '', required = false, value, onChange, disabled = false, icon: Icon, error, autoComplete, tooltip }: any) => {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div className="flex flex-col gap-1.5 group">
      <div className="flex items-center justify-between">
        <label htmlFor={name} className="text-xs font-bold text-slate-600 tracking-tight flex items-center gap-1.5 group-focus-within:text-indigo-600 transition-colors">
          {Icon && <Icon size={14} className="text-slate-400 group-focus-within:text-indigo-600 transition-colors" />}
          <span>{label}</span>
          {required && <span className="text-rose-500 font-bold ml-0.5">*</span>}
        </label>
        {tooltip && (
          <div className="relative flex items-center">
            <button
              type="button"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onFocus={() => setShowTooltip(true)}
              onBlur={() => setShowTooltip(false)}
              onClick={() => setShowTooltip(!showTooltip)}
              className="text-slate-400 hover:text-indigo-600 focus:text-indigo-600 focus:outline-none transition-colors p-0.5 rounded-full hover:bg-indigo-50"
              aria-label={`Information sur ${label}`}
            >
              <Info size={13} />
            </button>
            <AnimatePresence>
              {showTooltip && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.95 }}
                  className="absolute right-0 bottom-full mb-2 w-64 z-50 p-2.5 bg-slate-900 text-white text-xs font-medium rounded-xl shadow-xl border border-slate-700 pointer-events-none"
                >
                  <p className="leading-relaxed text-[11px] text-slate-200">{tooltip}</p>
                  <div className="absolute top-full right-2 border-4 border-transparent border-t-slate-900" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
      <input 
        id={name}
        type={type} 
        name={name} 
        placeholder={placeholder} 
        required={required} 
        value={value} 
        onChange={onChange} 
        disabled={disabled}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        className={`w-full px-3.5 py-2.5 min-h-[44px] border rounded-xl text-sm font-medium outline-none transition-all ${
          disabled 
            ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed' 
            : error 
              ? 'bg-rose-50/50 border-rose-300 text-rose-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20' 
              : 'bg-white border-slate-200 text-slate-900 hover:border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/15'
        }`}
      />
      {error && (
        <p id={`${name}-error`} className="text-xs font-medium text-rose-500 mt-1 flex items-center gap-1">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
};

const StudentForm: React.FC<{ user: UserProfile }> = ({ user }) => {
  const navigate = useNavigate();
  const { terminology, school, currentCampusId, campuses, activeAcademicYear } = useSchool();
  
  const getInitialCycle = () => {
    if (school?.school_type === 'UNIVERSITY') return 'LICENCE';
    if (school?.school_type === 'PROFESSIONAL') return 'CERTIFICAT';
    return 'FONDAMENTALE';
  };
  
  const getCyclesList = () => {
    if (school?.school_type === 'UNIVERSITY') return ['LICENCE', 'MASTER', 'DOCTORAT', 'AUTRE'];
    if (school?.school_type === 'PROFESSIONAL') return ['CERTIFICAT', 'DIPLOME', 'AUTRE'];
    return ['MATERNELLE', 'FONDAMENTALE', 'SECONDAIRE', 'AUTRE'];
  };

  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isReenroll = location.pathname.includes('/reinscrire');
  const isEdit = !!id && !isReenroll;

  const [activeStep, setActiveStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  
  // Data Refs
  const [activeYear, setActiveYear] = useState<any>(null);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [targetYearId, setTargetYearId] = useState<string>('');
  const [dbClasses, setDbClasses] = useState<SchoolClass[]>([]);
  const [dbFees, setDbFees] = useState<any[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);

  // Multi-campus / Annexe state selection within form
  const [selectedCampusId, setSelectedCampusId] = useState<string | null>(currentCampusId || null);

  // Filter States inside Form
  const [selectedCycle, setSelectedCycle] = useState<string>(getInitialCycle());
  const [classSearchTerm, setClassSearchTerm] = useState<string>('');
  const [studentDebt, setStudentDebt] = useState<number>(0);
  const [currentStudentClassName, setCurrentStudentClassName] = useState<string | null>(null);
  const [currentStudentClassLevel, setCurrentStudentClassLevel] = useState<string | null>(null);
  
  // Gestion avancée de la réinscription : Bilan académique, Quitus financier & Dérogation administrative
  const [dispensation, setDispensation] = useState<AdministrativeDispensation>({
    enabled: false,
    reason: '',
    category: 'ACADEMIC_PENDING',
    author: user.full_name || 'Direction / Économat',
    notes: ''
  });

  const [reenrollEvaluation, setReenrollEvaluation] = useState<ReenrollmentEvaluation>({
    studentDebt: 0,
    isFinancialCleared: true,
    gradesCount: 0,
    averageGrade: null,
    maxScale: 10,
    academicStatus: 'NOTES_EN_ATTENTE',
    academicSummary: 'En attente de délibération des notes',
    recommendedClass: null,
    currentClassName: null,
    currentClassLevel: null
  });

  const isFinanciallyLocked = isReenroll && studentDebt > 0 && !dispensation.enabled;

  const isUniversity = school?.school_type === 'UNIVERSITY';
  const isProfessional = school?.school_type === 'PROFESSIONAL';
  const isClassic = !isUniversity && !isProfessional;

  const recommendedPromotion = useMemo(() => {
    if (isReenroll && currentStudentClassName && currentStudentClassLevel) {
      return getNextClassLevel(currentStudentClassName, currentStudentClassLevel);
    }
    return null;
  }, [isReenroll, currentStudentClassName, currentStudentClassLevel]);

  const isAdultLevel = isUniversity || isProfessional || ['LICENCE', 'MASTER', 'DOCTORAT', 'CERTIFICAT', 'DIPLOME'].includes(selectedCycle);

  const initialFormState = {
    lastName: '', firstName: '', gender: 'Masculin', dob: '', pob: '', nif: '', address: '', phone: '', email: '', reference_number: '',
    parentName: '', parentRelation: isAdultLevel ? 'Conjoint(e)' : 'Père', parentPhone: '', parentEmail: '', parentJob: '',
    selectedClassId: ''
  };

  // Ensure clean state without automatic draft contamination for new enrollments
  const [formData, setFormData] = useState<typeof initialFormState>(initialFormState);

  const clearDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(`draft_student_new_${user.school_id}`);
      window.localStorage.removeItem(`draft_student_undefined_${user.school_id}`);
      if (id) {
        window.localStorage.removeItem(`draft_student_${id}_${user.school_id}`);
      }
    } catch (e) {
      // Ignored
    }
  }, [id, user.school_id]);

  const handleResetForm = useCallback(() => {
    setFormData({
      lastName: '', firstName: '', gender: 'Masculin', dob: '', pob: '', nif: '', address: '', phone: '', email: '', reference_number: '',
      parentName: '', parentRelation: isAdultLevel ? 'Conjoint(e)' : 'Père', parentPhone: '', parentEmail: '', parentJob: '',
      selectedClassId: ''
    });
    setActiveStep(1);
    setApiError(null);
    clearDraft();
  }, [isAdultLevel, clearDraft]);

  const hasUnsavedChanges = JSON.stringify(formData) !== JSON.stringify(initialFormState) && !isSuccess;
  useUnsavedChanges(hasUnsavedChanges);

  const [savedStudentId, setSavedStudentId] = useState<string | null>(null);
  const [payInscriptionNow, setPayInscriptionNow] = useState(true);
  const [inscriptionPaymentMethod, setInscriptionPaymentMethod] = useState('Cash');
  const [inscriptionCurrency, setInscriptionCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(0);

  const activePaymentMethods = useMemo(() => {
    return getActiveSchoolPaymentMethods(school);
  }, [school]);

  const currentInscriptionMethodConfig = useMemo(() => {
    return getPaymentMethodConfig(inscriptionPaymentMethod, school);
  }, [inscriptionPaymentMethod, school]);

  useEffect(() => {
    if (activePaymentMethods.length > 0 && !activePaymentMethods.some(m => m.code === inscriptionPaymentMethod)) {
      setInscriptionPaymentMethod(activePaymentMethods[0].code);
    }
  }, [activePaymentMethods, inscriptionPaymentMethod]);

  // Pieces justificatives exigées avec statut et observations
  const [submittedDocs, setSubmittedDocs] = useState<Record<string, {
    status: DocumentStatus;
    notes?: string;
  }>>({});

  // Memoized dynamic documents definitions for this school
  const docDefs = useMemo(() => {
    return getDocumentDefinitionsForSchoolType(school?.school_type, school?.global_settings);
  }, [school?.school_type, school?.global_settings]);

  const normalizedDocs = useMemo(() => {
    return normalizeStudentDocuments(submittedDocs, school?.school_type, school?.global_settings);
  }, [submittedDocs, school?.school_type, school?.global_settings]);

  const completeness = useMemo(() => {
    return calculateDocumentsCompleteness(normalizedDocs, school?.school_type, school?.global_settings);
  }, [normalizedDocs, school?.school_type, school?.global_settings]);

  // --- RÉINITIALISATION OBLIGATOIRE SUR NOUVELLE INSCRIPTION ---
  useEffect(() => {
    if (!id && !isReenroll) {
      setActiveStep(1);
      setIsSuccess(false);
      setApiError(null);
      setStudentDebt(0);
      setDispensation({
        enabled: false,
        reason: '',
        category: 'ACADEMIC_PENDING',
        author: user.full_name || 'Direction / Économat',
        notes: ''
      });
      setFormData({
        lastName: '', firstName: '', gender: 'Masculin', dob: '', pob: '', nif: '', address: '', phone: '', email: '', reference_number: '',
        parentName: '', parentRelation: isAdultLevel ? 'Conjoint(e)' : 'Père', parentPhone: '', parentEmail: '', parentJob: '',
        selectedClassId: ''
      });
      clearDraft();
    }
  }, [id, isReenroll, location.pathname, isAdultLevel, clearDraft]);

  // Sync selectedCampusId with currentCampusId if it updates externally
  useEffect(() => {
    if (currentCampusId) {
      setSelectedCampusId(currentCampusId);
    }
  }, [currentCampusId]);

  // --- CALCUL D'ÂGE ---
  const calculatedAge = useMemo(() => {
    if (!formData.dob) return null;
    const birthDate = new Date(formData.dob);
    if (isNaN(birthDate.getTime())) return null;
    const today = new Date();
    const refDate = new Date(today.getFullYear(), 8, 1); 
    let age = refDate.getFullYear() - birthDate.getFullYear();
    const m = refDate.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && refDate.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  }, [formData.dob]);

  const loadReferenceData = useCallback(async () => {
    setLoadingRefs(true);
    setApiError(null);
    try {
      let classesQuery = supabase.from('classes').select('*').eq('school_id', user.school_id).order('name');

      const [yearsRes, classesRes, rateRes] = await Promise.all([
        supabase.from('academic_years')
          .select('*')
          .eq('school_id', user.school_id)
          .order('label', { ascending: true }),
        classesQuery,
        supabase.from('exchange_rates').select('*').eq('school_id', user.school_id).order('effective_date', { ascending: false }).limit(1)
      ]);
      
      if (rateRes.data && rateRes.data.length > 0) {
        setExchangeRate(Number(rateRes.data[0].rate));
      }

      if (yearsRes.error) console.error("Erreur chargement années académiques:", yearsRes.error);

      const allYears = yearsRes.data || [];
      // Accepter les années actives, planifiées/futures, en préparation ou archivées récentes
      const validYears = allYears.filter(y => y.status === 'ACTIVE' || y.status === 'FUTURE' || y.status === 'PLANIFIEE' || y.status === 'PREPARATION' || y.is_active);
      const years = validYears.length > 0 ? validYears : allYears;
      setAcademicYears(years);
      
      const currentActive = years.find(y => y.status === 'ACTIVE' || y.is_active) || allYears.find(y => y.status === 'ACTIVE' || y.is_active);
      setActiveYear(currentActive);

      // Par défaut, si on réinscrit, on cherche d'abord la session FUTURE / PLANIFIÉE / EN PRÉPARATION, sinon la suivante dans la liste, sinon l'active
      if (isReenroll) {
        const futureYear = years.find(y => y.status === 'FUTURE' || y.status === 'PLANIFIEE' || y.status === 'PREPARATION');
        if (futureYear) {
          setTargetYearId(futureYear.id);
        } else if (currentActive) {
          const activeIdx = years.findIndex(y => y.id === currentActive.id);
          const nextYear = years[activeIdx + 1];
          if (nextYear) {
            setTargetYearId(nextYear.id);
          } else {
            setTargetYearId(currentActive.id);
          }
        } else if (years.length > 0) {
          setTargetYearId(years[0].id);
        }
      } else if (currentActive) {
        setTargetYearId(currentActive.id);
      } else if (years.length > 0) {
        setTargetYearId(years[0].id);
      }

      if (classesRes.data) setDbClasses(classesRes.data);

      if (id) {
        const { data: student } = await supabase.from('students').select('*, class:classes(name, level)').eq('id', id).eq('school_id', user.school_id).single();
        if (student) {
          if (currentCampusId && student.campus_id && student.campus_id !== currentCampusId) {
             setApiError("Vous n'avez pas l'autorisation d'éditer ou réinscrire un élève de cette annexe/campus.");
             return;
          }
          if (student.campus_id) {
            setSelectedCampusId(student.campus_id);
          }

          let debtValue = 0;
          try {
            const { data: realDebt, error: rpcError } = await supabase.rpc('get_student_global_debt', { p_student_id: id });
            if (rpcError) {
              console.warn("RPC get_student_global_debt failed, falling back to 0", rpcError);
            }
            debtValue = Number(realDebt || 0);
            setStudentDebt(debtValue);
          } catch (e) {
            console.warn("Exception calling get_student_global_debt", e);
            setStudentDebt(0);
          }
          
          if (student.class?.level) {
            setSelectedCycle(student.class.level);
            setCurrentStudentClassLevel(student.class.level);
          }
          if (student.class?.name) setCurrentStudentClassName(student.class.name);

          let targetLevel = student.class?.level || 'FONDAMENTALE';
          let initialSelectedClassId = isReenroll ? '' : (student.class_id || '');
          let nextInfo = null;

          if (isReenroll && student.class?.name && student.class?.level) {
            nextInfo = getNextClassLevel(student.class.name, student.class.level);
            if (nextInfo) {
              targetLevel = nextInfo.level;
              setSelectedCycle(nextInfo.level);
              
              const nextClassLower = nextInfo.name.toLowerCase();
              const foundClass = classesRes.data?.find(c => 
                c.level === nextInfo.level && (
                  c.name.toLowerCase() === nextClassLower ||
                  c.name.toLowerCase().startsWith(nextClassLower) ||
                  c.name.toLowerCase().includes(nextClassLower)
                )
              );
              if (foundClass) {
                initialSelectedClassId = foundClass.id;
              }
            }

            // Récupération des notes & calcul de la moyenne annuelle pour la réinscription
            let gradesCount = 0;
            let averageGrade: number | null = null;
            let academicStatus: AcademicEvaluationStatus = 'NOTES_EN_ATTENTE';
            let academicSummary = 'Notes du bulletin annuel en cours de saisie ou non clôturées.';
            let maxScale = 10;

            try {
              const { data: gradesData } = await supabase
                .from('grades')
                .select('score, term')
                .eq('student_id', id);

              if (gradesData && gradesData.length > 0) {
                const validScores = gradesData
                  .map(g => Number(g.score))
                  .filter(s => !isNaN(s) && s !== null);

                if (validScores.length > 0) {
                  gradesCount = validScores.length;
                  const sum = validScores.reduce((a, b) => a + b, 0);
                  const avg = sum / validScores.length;
                  averageGrade = avg;

                  const maxFound = Math.max(...validScores);
                  if (maxFound > 20) {
                    maxScale = 100;
                    if (avg >= 70) academicStatus = 'EXCELLENT_ADMIS';
                    else if (avg >= 50) academicStatus = 'ADMIS';
                    else if (avg >= 40) academicStatus = 'AJOURNE_RATTRAPAGE';
                    else academicStatus = 'REDOUBLEMENT_CONSEILLE';
                  } else if (maxFound > 10) {
                    maxScale = 20;
                    if (avg >= 14) academicStatus = 'EXCELLENT_ADMIS';
                    else if (avg >= 10) academicStatus = 'ADMIS';
                    else if (avg >= 8) academicStatus = 'AJOURNE_RATTRAPAGE';
                    else academicStatus = 'REDOUBLEMENT_CONSEILLE';
                  } else {
                    maxScale = 10;
                    if (avg >= 7) academicStatus = 'EXCELLENT_ADMIS';
                    else if (avg >= 5) academicStatus = 'ADMIS';
                    else if (avg >= 4) academicStatus = 'AJOURNE_RATTRAPAGE';
                    else academicStatus = 'REDOUBLEMENT_CONSEILLE';
                  }

                  if (academicStatus === 'EXCELLENT_ADMIS') {
                    academicSummary = `Excellents résultats annuels (${avg.toFixed(2)}/${maxScale}) - Félicitations du Conseil`;
                  } else if (academicStatus === 'ADMIS') {
                    academicSummary = `Résultats annuels validés (${avg.toFixed(2)}/${maxScale}) - Admis pour la classe supérieure`;
                  } else if (academicStatus === 'AJOURNE_RATTRAPAGE') {
                    academicSummary = `Moyenne juste (${avg.toFixed(2)}/${maxScale}) - Examen de rattrapage ou passage conditionnel`;
                  } else {
                    academicSummary = `Moyenne annuelle inférieure au seuil (${avg.toFixed(2)}/${maxScale}) - Redoublement recommandé`;
                  }
                }
              }
            } catch (gradeErr) {
              console.warn("Échec récupération des notes pour réinscription:", gradeErr);
            }

            setReenrollEvaluation({
              studentDebt: debtValue,
              isFinancialCleared: debtValue <= 0,
              gradesCount,
              averageGrade,
              maxScale,
              academicStatus,
              academicSummary,
              recommendedClass: nextInfo,
              currentClassName: student.class?.name,
              currentClassLevel: student.class?.level
            });
          }

          setFormData(prev => ({
            ...prev,
            level: targetLevel as SchoolLevel,
            lastName: student.last_name || '', firstName: student.first_name || '', gender: student.gender || 'Masculin',
            dob: student.dob || '', pob: student.pob || '', nif: student.nif || '', address: student.address || '',
            phone: student.phone || '', email: student.email || '', reference_number: student.reference_number || '',
            parentName: student.parent_name || '', parentRelation: student.parent_relation || (isAdultLevel ? 'Conjoint(e)' : 'Père'),
            parentPhone: student.parent_phone || '', parentEmail: student.parent_email || '', 
            parentJob: student.parent_job || '', selectedClassId: initialSelectedClassId
          }));

          if (student.submitted_documents) {
            const normalized = normalizeStudentDocuments(student.submitted_documents, school?.school_type, school?.global_settings);
            setSubmittedDocs(normalized);
          }
        }
      }
    } catch (err: any) {
      setApiError(err.message);
    } finally {
      setLoadingRefs(false);
    }
  }, [user.school_id, id, isReenroll, currentCampusId, school?.school_type, school?.global_settings]);

  useEffect(() => { loadReferenceData(); }, [loadReferenceData]);

  // Charger les tarifs dès que l'année cible change
  useEffect(() => {
    const fetchFees = async () => {
      if (!targetYearId) return;
      const { data } = await supabase.from('fee_plans').select('*').eq('academic_year_id', targetYearId);
      if (data) setDbFees(data);
    };
    fetchFees();
  }, [targetYearId]);

  // Filtrage des classes selon le campus/annexe sélectionné et le cycle
  const classesForStep = useMemo(() => {
    let filtered = dbClasses;
    
    // Filtrer par annexe/campus si spécifié
    if (selectedCampusId && isValidUuid(selectedCampusId)) {
      filtered = filtered.filter(c => !c.campus_id || c.campus_id === selectedCampusId);
    }

    if (isReenroll && currentStudentClassName) {
      return getAllowedClassesForReenrollment(currentStudentClassName, selectedCycle, filtered);
    }
    return filtered.filter(c => c.level === selectedCycle);
  }, [dbClasses, selectedCycle, isReenroll, currentStudentClassName, selectedCampusId]);

  const getDisciplineName = (className: string) => {
    let name = className.replace(/\s*(I|II|III|IV|V|VI|\d+|Année \d+|Niveau \d+|Niveau [IVX]+|\(L\d+\)|Licence \d+|Master \d+)\s*$/i, '');
    name = name.replace(/^Licence\s*(en|de)?\s*/i, '');
    name = name.replace(/^Master\s*(en|de)?\s*/i, '');
    return name.trim();
  };

  const groupedClassesForStep = useMemo(() => {
    const groups: Record<string, typeof classesForStep> = {};
    const searchLower = classSearchTerm.trim().toLowerCase();

    classesForStep.forEach(cls => {
      if (searchLower && !cls.name.toLowerCase().includes(searchLower)) {
        return;
      }
      const discipline = getDisciplineName(cls.name);
      if (!groups[discipline]) groups[discipline] = [];
      groups[discipline].push(cls);
    });
    return groups;
  }, [classesForStep, classSearchTerm]);

  const currentPricing = useMemo(() => {
    const plan = dbFees.find(f => f.class_id === formData.selectedClassId);
    if (!plan) return { exists: false, inscription: { amount: 0, currency: 'HTG' }, tuition: { amount: 0, currency: 'HTG' }, miscFee: { amount: 0, currency: 'HTG' }, isMiscMandatory: false };

    const inscription = isReenroll ? (plan.reenrollment_fee || 0) : (plan.inscription_fee || 0);
    const inscription_usd = isReenroll ? (plan.reenrollment_fee_usd || 0) : (plan.inscription_fee_usd || 0);
    
    const tuition = (plan.tuition_fee || 0);
    const tuition_usd = (plan.tuition_fee_usd || 0);
    
    const miscFee = plan.misc_fee_htg || 0;
    const miscFee_usd = plan.misc_fee_usd || 0;

    return { 
      inscription: inscription_usd > 0 ? { amount: inscription_usd, currency: 'USD' } : { amount: inscription, currency: 'HTG' },
      tuition: tuition_usd > 0 ? { amount: tuition_usd, currency: 'USD' } : { amount: tuition, currency: 'HTG' },
      miscFee: miscFee_usd > 0 ? { amount: miscFee_usd, currency: 'USD' } : { amount: miscFee, currency: 'HTG' },
      isMiscMandatory: plan.is_misc_mandatory || false,
      exists: true 
    };
  }, [formData.selectedClassId, dbFees, isReenroll]);

  const stepsConfig = useMemo(() => [
    { number: 1, title: isAdultLevel ? "Identité Étudiant" : "Identité de l'Élève", subtitle: "État civil & profil", icon: User },
    { number: 2, title: isAdultLevel ? "Contact d'Urgence" : "Responsable Légal", subtitle: "Filiation & coordonnées", icon: Users },
    { number: 3, title: isUniversity ? "Faculté & Session" : isProfessional ? "Filière & Annexe" : "Classe & Annexe", subtitle: "Affectation académique", icon: GraduationCap },
    { number: 4, title: "Pièces & Validation", subtitle: "Dossier & finalisation", icon: ShieldCheck },
  ], [isAdultLevel, isUniversity, isProfessional]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (activeStep < 4) {
      if (activeStep === 1) {
        if (!formData.lastName?.trim() || !formData.firstName?.trim() || !formData.dob || !formData.gender) {
          setApiError("Veuillez renseigner tous les champs obligatoires (Nom, Prénoms, Date de naissance, Genre).");
          return;
        }
      }

      if (activeStep === 2) {
        if (!formData.parentName?.trim() || !formData.parentPhone?.trim() || !formData.parentRelation) {
          setApiError(`Veuillez renseigner le nom du responsable ou contact d'urgence, son téléphone et le lien.`);
          return;
        }
      }

      if (activeStep === 3) {
        if (!formData.selectedClassId) {
          setApiError(`Veuillez sélectionner une ${terminology.class.toLowerCase()} ou filière avant de continuer.`);
          return;
        }

        if (isFinanciallyLocked) {
          setApiError(`BLOCAGE FINANCIER : ${getDefiniteArticle(terminology.student, true)} ${terminology.student.toLowerCase()} présente un arriéré de ${studentDebt.toLocaleString()} G. Vous pouvez lever ce blocage en activant la Dérogation Administrative (accord de la direction).`);
          return;
        }
        if (!currentPricing.exists && !isEdit) {
          setApiError("PRÉVISION TARIFAIRE MANQUANTE : Aucun plan tarifaire n'a été défini pour cette classe dans la session cible. Veuillez configurer les tarifs (Économat > Planification) avant l'inscription.");
          return;
        }
      }
      setApiError(null);
      setActiveStep(prev => prev + 1);
      return;
    }

    setIsSubmitting(true);
    try {
      const validationResult = studentSchema.safeParse(formData);
      if (!validationResult.success) {
        setApiError(validationResult.error.issues[0].message);
        setIsSubmitting(false);
        return;
      }

      if (!targetYearId) {
        setApiError("Aucune session académique active ou en préparation n'est configurée pour cet établissement. Veuillez créer ou activer une session dans Configuration > Années Académiques.");
        setIsSubmitting(false);
        return;
      }

      const targetYear = academicYears.find(y => y.id === targetYearId);
      const isTargetActive = targetYear?.status === 'ACTIVE' || targetYear?.is_active;

      const selectedClass = dbClasses.find(c => c.id === formData.selectedClassId);
      const resolvedCampusId = selectedClass?.campus_id || selectedCampusId || currentCampusId || null;

      const formatted = formatStudentName(formData.lastName, formData.firstName);

      const docDefs = getDocumentDefinitionsForSchoolType(school?.school_type, school?.global_settings);
      const normalizedDocs = normalizeStudentDocuments(submittedDocs, school?.school_type, school?.global_settings);

      // Une pièce justificative en attente ne bloque pas l'inscription de l'élève.
      // Le statut dans la table students respecte la contrainte ('Actif', 'Inactif', 'Suspendu', 'En attente')
      const initialStudentStatus = 'Actif';
      const initialEnrollmentStatus = 'ACTIVE';

      const submittedDocsPayload: Record<string, any> = {};
      docDefs.forEach(def => {
        const item = normalizedDocs[def.id] || { status: 'VALIDE', notes: '' };
        submittedDocsPayload[def.id] = {
          name: def.name,
          status: item.status || 'VALIDE',
          notes: item.notes || '',
          updated_at: new Date().toISOString(),
          updated_by: user.full_name || user.email
        };
      });

      const payload = {
        school_id: user.school_id, 
        campus_id: resolvedCampusId,
        ...(isTargetActive ? { class_id: formData.selectedClassId } : {}),
        first_name: formatted.firstName, last_name: formatted.lastName,
        gender: formData.gender, dob: formData.dob, pob: formData.pob, nif: formData.nif, address: formData.address,
        phone: formData.phone || null,
        email: formData.email || null,
        reference_number: formData.reference_number || null,
        parent_name: formData.parentName,
        parent_relation: formData.parentRelation, parent_phone: formData.parentPhone,
        parent_email: formData.parentEmail, parent_job: formData.parentJob,
        submitted_documents: submittedDocsPayload,
        status: initialStudentStatus
      };

      if (isReenroll) {
        const { error: updateError } = await supabase.from('students').update(payload).eq('id', id).eq('school_id', user.school_id);
        if (updateError) throw updateError;

        const { error: enrollError } = await supabase.from('enrollments').upsert({
          school_id: user.school_id,
          student_id: id,
          academic_year_id: targetYearId,
          class_id: formData.selectedClassId,
          status: initialEnrollmentStatus
        });
        if (enrollError) throw enrollError;
        
        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: 'UPDATE',
          entity_type: 'student',
          entity_id: id,
          details: { 
            type: 'reenrollment', 
            class_id: formData.selectedClassId, 
            academic_year_id: targetYearId, 
            is_active_update: isTargetActive,
            reenrollment_mode: dispensation.enabled 
              ? 'ADMINISTRATIVE_DISPENSATION' 
              : (reenrollEvaluation.academicStatus === 'NOTES_EN_ATTENTE' ? 'CONDITIONAL_ACADEMIC' : 'REGULAR'),
            dispensation: dispensation.enabled ? {
              category: dispensation.category,
              reason: dispensation.reason,
              author: dispensation.author || user.full_name || user.email
            } : null,
            financial_cleared: reenrollEvaluation.isFinancialCleared,
            debt_amount: studentDebt,
            academic_status: reenrollEvaluation.academicStatus,
            average_grade: reenrollEvaluation.averageGrade
          }
        });
      } else if (isEdit) {
        const { error } = await supabase.from('students').update(payload).eq('id', id).eq('school_id', user.school_id);
        if (error) throw error;
        
        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: 'UPDATE',
          entity_type: 'student',
          entity_id: id,
          details: { type: 'edit' }
        });
      } else {
        const newStudentPayload = { ...payload, class_id: formData.selectedClassId };
        const { data: newStudent, error: insertError } = await supabase.from('students').insert([newStudentPayload]).select().single();
        if (insertError) throw insertError;

        await supabase.from('enrollments').insert({
          school_id: user.school_id,
          student_id: newStudent.id,
          academic_year_id: targetYearId,
          class_id: formData.selectedClassId,
          status: initialEnrollmentStatus
        });
        
        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: 'CREATE',
          entity_type: 'student',
          entity_id: newStudent.id,
          details: { class_id: formData.selectedClassId, academic_year_id: targetYearId }
        });
        
        var savedStudentId = newStudent.id;
      }
      
      const targetStudentId = isReenroll ? id : savedStudentId;

      // Encaissement optionnel immédiat
      if (payInscriptionNow && currentPricing.inscription.amount > 0 && targetStudentId) {
        let amountToSave = currentPricing.inscription.amount;
        let equivalentHtgToSave = amountToSave;
        let paymentCurrency = currentPricing.inscription.currency;
        const actualExchangeRate = exchangeRate || 132.50;
        
        if (currentPricing.inscription.currency === 'USD') {
           paymentCurrency = inscriptionCurrency;
           if (inscriptionCurrency === 'HTG') {
               amountToSave = Math.round((currentPricing.inscription.amount * actualExchangeRate) * 100) / 100;
               equivalentHtgToSave = amountToSave;
           } else {
               equivalentHtgToSave = Math.round((currentPricing.inscription.amount * actualExchangeRate) * 100) / 100;
           }
        } else {
           paymentCurrency = 'HTG';
        }

        await supabase.from('payments').insert({
          school_id: user.school_id,
          campus_id: resolvedCampusId,
          student_id: targetStudentId,
          academic_year_id: targetYearId,
          date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
          amount: amountToSave,
          amount_htg_equivalent: equivalentHtgToSave,
          exchange_rate_applied: paymentCurrency === 'USD' ? actualExchangeRate : 1,
          currency: paymentCurrency,
          nature: 'RECOUVREMENT',
          type: 'Revenu',
          fee_type: 'INSCRIPTION',
          method: inscriptionPaymentMethod,
          payment_method: inscriptionPaymentMethod,
          status: 'VALIDE'
        });

        await supabase.from('students').update({ status: 'Actif' }).eq('id', targetStudentId);
        await supabase.from('enrollments')
          .update({ status: 'ACTIVE' })
          .eq('student_id', targetStudentId)
          .eq('academic_year_id', targetYearId);
      }

      clearDraft();
      setSavedStudentId(targetStudentId);
      setIsSuccess(true);
    } catch (err: any) {
      setApiError(err.message || "Une erreur est survenue lors de l'enregistrement.");
    } finally { 
      setIsSubmitting(false); 
    }
  };

  if (loadingRefs) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-12 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 animate-pulse">
          <Loader2 className="animate-spin" size={24} />
        </div>
        <p className="text-xs font-semibold text-slate-500">Chargement des données de référence...</p>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl mx-auto my-8 p-8 sm:p-10 text-center bg-white rounded-3xl shadow-sm border border-slate-200/80 space-y-6"
      >
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100 shadow-xs">
          <CheckCircle2 size={32} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            {isReenroll ? 'Promotion Validée avec Succès' : isEdit ? 'Dossier Mis à Jour' : 'Inscription Enregistrée'}
          </h2>
          <p className="text-sm text-slate-500 font-medium">
            Le dossier de <strong className="text-slate-800">{formData.firstName} {formData.lastName}</strong> a été scellé et synchronisé sur le serveur.
          </p>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left space-y-2 text-xs">
          <div className="flex justify-between items-center text-slate-600">
            <span>Session Académique :</span>
            <span className="font-bold text-slate-900">
              {academicYears.find(y => y.id === targetYearId)?.label || '2025-2026'}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-600">
            <span>{terminology.class} :</span>
            <span className="font-bold text-indigo-600">
              {dbClasses.find(c => c.id === formData.selectedClassId)?.name || '-'}
            </span>
          </div>
          {campuses && campuses.length > 0 && (
            <div className="flex justify-between items-center text-slate-600">
              <span>Annexe / Campus :</span>
              <span className="font-semibold text-slate-800">
                {campuses.find(c => c.id === selectedCampusId)?.name || 'Campus Principal'}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button 
            onClick={() => navigate('/economat/frais', { state: { studentId: savedStudentId || id, academicYearId: targetYearId } })} 
            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <Banknote size={15} />
            Encaisser au Guichet
          </button>
          <button 
            onClick={() => navigate('/eleves')} 
            className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors shadow-xs cursor-pointer"
          >
            Accéder au Registre
          </button>
          {!isEdit && !isReenroll && (
            <button 
              onClick={() => {
                setIsSuccess(false);
                setActiveStep(1);
                setFormData(initialFormState);
              }} 
              className="w-full sm:w-auto px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Inscrire un autre {terminology.student.toLowerCase()}
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  const selectedClass = dbClasses.find(c => c.id === formData.selectedClassId);
  const activeCampusObj = campuses.find(c => c.id === selectedCampusId) || campuses.find(c => c.id === currentCampusId);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 px-2 sm:px-4">
      {/* Modern Header Banner */}
      <motion.div 
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-5 sm:p-6 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${
            isFinanciallyLocked 
              ? 'bg-rose-50 text-rose-600 border-rose-200' 
              : isReenroll && dispensation.enabled
                ? 'bg-amber-50 text-amber-700 border-amber-300'
                : isReenroll 
                  ? 'bg-indigo-50 text-indigo-600 border-indigo-100' 
                  : 'bg-blue-50 text-blue-600 border-blue-100'
          }`}>
            {isFinanciallyLocked ? <Ban size={24} /> : isReenroll ? <ArrowUpCircle size={24} /> : <Fingerprint size={24} />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                {isReenroll ? `Promotion & Réinscription de l'${terminology.student}` : isEdit ? `Édition Dossier ${terminology.student}` : `${terminology.enrollment} Administrative`}
              </h2>
              {/* Type Badge */}
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                isUniversity ? 'bg-purple-50 text-purple-700 border-purple-200' :
                isProfessional ? 'bg-amber-50 text-amber-700 border-amber-200' :
                'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                {isUniversity ? 'Universitaire' : isProfessional ? 'Professionnel' : 'Scolaire'}
              </span>

              {isReenroll && (
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  dispensation.enabled
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : isFinanciallyLocked
                      ? 'bg-rose-100 text-rose-900 border-rose-300'
                      : reenrollEvaluation.academicStatus === 'NOTES_EN_ATTENTE'
                        ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                        : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                }`}>
                  {dispensation.enabled 
                    ? 'Dérogation Active' 
                    : isFinanciallyLocked 
                      ? 'Arriérés Dûs' 
                      : reenrollEvaluation.academicStatus === 'NOTES_EN_ATTENTE'
                        ? 'Notes en attente'
                        : 'Quitus & Notes OK'}
                </span>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-3 mt-1.5">
              {/* Academic Year Selector */}
              <div className="relative inline-flex items-center">
                <CalendarCheck className="absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-600 pointer-events-none" size={13} />
                <select 
                  value={targetYearId} 
                  onChange={(e) => setTargetYearId(e.target.value)}
                  className="pl-7 pr-7 py-1.5 bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 rounded-lg text-xs font-bold outline-none appearance-none cursor-pointer transition-colors shadow-2xs focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                >
                  {academicYears.map(y => (
                    <option key={y.id} value={y.id} className="bg-white text-slate-900 font-medium">
                      {y.label} {y.status === 'ACTIVE' ? '(Active)' : y.status === 'FUTURE' ? '(Rentrée / Préparation)' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
              </div>

              {/* Multi-Campus / Annexe Badge if exists */}
              {campuses && campuses.length > 1 && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600">
                  <Building2 size={13} className="text-slate-400" />
                  <span>{activeCampusObj?.name || 'Multi-Annexes'}</span>
                </div>
              )}

              {studentDebt > 0 && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                  <Coins size={13} /> Arriérés : {studentDebt.toLocaleString()} G
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stepper Progress Indicator */}
        <div className="flex items-center gap-2 self-stretch md:self-auto justify-between sm:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
          <div className="flex items-center gap-1.5">
            {stepsConfig.map((s) => {
              const isPassed = activeStep > s.number;
              const isCurrent = activeStep === s.number;
              return (
                <button
                  key={s.number}
                  type="button"
                  onClick={() => isPassed && setActiveStep(s.number)}
                  disabled={!isPassed}
                  title={`${s.number}. ${s.title}`}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isCurrent 
                      ? 'bg-indigo-600 text-white shadow-xs' 
                      : isPassed 
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60 cursor-pointer' 
                        : 'bg-slate-50 text-slate-400 border border-slate-200/60 cursor-not-allowed opacity-70'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black">
                    {isPassed ? <Check size={12} className="stroke-[3]" /> : s.number}
                  </span>
                  <span className="hidden sm:inline">{s.title.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {apiError && (
        <motion.div 
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-start gap-3 text-rose-800"
        >
          <ShieldAlert className="text-rose-600 mt-0.5 flex-shrink-0" size={20} />
          <div className="text-xs font-semibold leading-relaxed">
            {apiError}
          </div>
        </motion.div>
      )}

      {/* Main Multi-Step Form Container */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        {/* Progress Bar */}
        <div className="w-full bg-slate-100 h-1">
          <motion.div 
            className="bg-gradient-to-r from-blue-600 to-indigo-600 h-1"
            initial={{ width: '25%' }}
            animate={{ width: `${(activeStep / 4) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="p-5 sm:p-7 md:p-8">
          <AnimatePresence mode="wait">
            {/* STEP 1: IDENTITÉ & ÉTAT CIVIL */}
            {activeStep === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100/80">
                      <User size={16} />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-base">
                        {isAdultLevel ? `Identité & Informations de l'${terminology.student}` : `Identité de l'${terminology.student}`}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Renseignements légaux d'état civil pour le registre officiel
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {calculatedAge !== null && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        <Baby size={13} /> {calculatedAge} ans révolus
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleResetForm}
                      title="Effacer et réinitialiser tous les champs"
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors"
                    >
                      <RotateCcw size={12} />
                      <span className="hidden sm:inline">Réinitialiser</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  <FormField 
                    label="Nom de famille" 
                    name="lastName" 
                    required 
                    value={formData.lastName} 
                    onChange={(e: any) => setFormData((prev: any) => ({ ...prev, lastName: e.target.value.toUpperCase() }))} 
                    placeholder="EX: MARCELIN" 
                    autoComplete="family-name" 
                    tooltip="Nom patronymique officiel tel qu'inscrit à l'extrait d'acte de naissance ou sur la pièce d'identité." 
                  />

                  <FormField 
                    label="Prénoms" 
                    name="firstName" 
                    required 
                    value={formData.firstName} 
                    onChange={(e: any) => setFormData((prev: any) => ({ ...prev, firstName: e.target.value }))} 
                    placeholder="EX: Jean-Baptiste" 
                    autoComplete="given-name" 
                    tooltip="Prénom usuel et prénoms secondaires de l'élève séparés par un espace." 
                  />

                  <FormField 
                    label="Date de Naissance" 
                    name="dob" 
                    type="date" 
                    required 
                    value={formData.dob} 
                    onChange={(e: any) => setFormData((prev: any) => ({ ...prev, dob: e.target.value }))} 
                    tooltip="Date de naissance officielle pour le calcul automatique de l'âge et les listes ministérielles." 
                  />

                  {/* Sexe / Genre Segmented selector */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-600 tracking-tight">
                        Genre / Sexe <span className="text-rose-500 font-bold">*</span>
                      </label>
                      <InfoTooltip content="Sexe légal inscrit sur l'acte d'état civil." />
                    </div>
                    <div className="grid grid-cols-2 gap-2 min-h-[44px]">
                      <button
                        type="button"
                        onClick={() => setFormData((prev: any) => ({ ...prev, gender: 'Masculin' }))}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                          formData.gender === 'Masculin'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        Masculin
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData((prev: any) => ({ ...prev, gender: 'Féminin' }))}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                          formData.gender === 'Féminin'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        Féminin
                      </button>
                    </div>
                  </div>

                  <FormField 
                    label="Lieu de Naissance" 
                    name="pob" 
                    value={formData.pob} 
                    onChange={(e: any) => setFormData((prev: any) => ({ ...prev, pob: e.target.value }))} 
                    placeholder="Ville / Commune" 
                    tooltip="Lieu de naissance officiel inscrit sur l'acte de naissance." 
                  />

                  <FormField 
                    label={isAdultLevel ? "Numéro NIF / CIN" : "Numéro NIF / Matricule"} 
                    name="nif" 
                    value={formData.nif} 
                    onChange={(e: any) => setFormData((prev: any) => ({ ...prev, nif: e.target.value }))} 
                    placeholder={isAdultLevel ? "000-000-000-0" : "Optionnel"} 
                    tooltip="Identifiant fiscal NIF, Carte d'Identité Nationale ou Matricule scolaire officiel." 
                  />

                  {/* Coordonnées directes si étudiant adulte ou universitaire */}
                  {isAdultLevel && (
                    <>
                      <FormField 
                        label="Téléphone Personnel Étudiant" 
                        name="phone" 
                        value={formData.phone} 
                        onChange={(e: any) => setFormData((prev: any) => ({ ...prev, phone: e.target.value }))} 
                        placeholder="EX: +509 3700-0000" 
                        autoComplete="tel" 
                        icon={Phone}
                        tooltip="Numéro mobile pour les alertes SMS et notifications de cours." 
                      />

                      <FormField 
                        label="Email Personnel Étudiant" 
                        name="email" 
                        type="email"
                        value={formData.email} 
                        onChange={(e: any) => setFormData((prev: any) => ({ ...prev, email: e.target.value }))} 
                        placeholder="etudiant@universite.edu" 
                        autoComplete="email" 
                        icon={Mail}
                        tooltip="Adresse électronique pour l'accès aux portails et supports pédagogiques." 
                      />
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 2: RESPONSABLE LÉGAL & COORDONNÉES */}
            {activeStep === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100/80">
                    <Users size={16} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">
                      {isAdultLevel ? "Contact d'Urgence & Personne de Référence" : "Responsable Légal & Tuteurs"}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {isAdultLevel ? "Personne à contacter en cas d'urgence ou pour le dossier administratif" : "Parents ou tuteur légal responsable du suivi et de la scolarité"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  <FormField 
                    label={isAdultLevel ? "Nom du Contact d'Urgence" : "Nom du Responsable"} 
                    name="parentName" 
                    required 
                    value={formData.parentName} 
                    onChange={(e: any) => setFormData((prev: any) => ({ ...prev, parentName: e.target.value }))} 
                    placeholder="EX: MARCELIN Pierre" 
                    tooltip="Nom complet de la personne responsable ou du contact de référence." 
                  />

                  <FormField 
                    label="Téléphone Principal" 
                    name="parentPhone" 
                    required 
                    value={formData.parentPhone} 
                    onChange={(e: any) => setFormData((prev: any) => ({ ...prev, parentPhone: e.target.value }))} 
                    placeholder="EX: +509 3701-2345" 
                    autoComplete="tel" 
                    icon={Phone}
                    tooltip="Numéro de téléphone direct pour les communications administratives et urgences." 
                  />

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-600 tracking-tight">
                        {isAdultLevel ? "Lien avec l'Étudiant" : "Lien de Parenté"} <span className="text-rose-500 font-bold">*</span>
                      </label>
                      <InfoTooltip content="Lien relationnel avec l'élève ou étudiant." />
                    </div>
                    <div className="relative">
                      <select 
                        name="parentRelation" 
                        value={formData.parentRelation} 
                        onChange={(e: any) => setFormData((prev: any) => ({ ...prev, parentRelation: e.target.value }))} 
                        className="w-full px-3.5 py-2.5 min-h-[44px] bg-white text-slate-900 border border-slate-200 rounded-xl text-sm font-medium outline-none appearance-none cursor-pointer focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/15 transition-all"
                      >
                        {isAdultLevel ? (
                          <>
                            <option value="Conjoint(e)">Conjoint(e)</option>
                            <option value="Père/Mère">Père / Mère</option>
                            <option value="Tuteur">Tuteur Légal / Référent</option>
                            <option value="Ami(e)">Ami(e) Proche</option>
                            <option value="Autre">Autre</option>
                          </>
                        ) : (
                          <>
                            <option value="Père">Père</option>
                            <option value="Mère">Mère</option>
                            <option value="Tuteur">Tuteur Légal</option>
                            <option value="Autre">Autre Responsable</option>
                          </>
                        )}
                      </select>
                      <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    </div>
                  </div>

                  <FormField 
                    label="Email du Responsable" 
                    name="parentEmail" 
                    type="email"
                    value={formData.parentEmail} 
                    onChange={(e: any) => setFormData((prev: any) => ({ ...prev, parentEmail: e.target.value }))} 
                    placeholder="email@responsable.com" 
                    autoComplete="email" 
                    icon={Mail}
                    tooltip="Courriel pour la transmission des bulletins et des reçus de caisse." 
                  />

                  <FormField 
                    label="Profession / Activité" 
                    name="parentJob" 
                    value={formData.parentJob} 
                    onChange={(e: any) => setFormData((prev: any) => ({ ...prev, parentJob: e.target.value }))} 
                    placeholder="EX: Enseignant, Commerçant..." 
                    tooltip="Activité professionnelle du responsable." 
                  />

                  <FormField 
                    label="Adresse Domicile" 
                    name="address" 
                    value={formData.address} 
                    onChange={(e: any) => setFormData((prev: any) => ({ ...prev, address: e.target.value }))} 
                    placeholder="Rue, Quartier, Ville..." 
                    autoComplete="street-address" 
                    icon={Home}
                    tooltip="Adresse de résidence pour le dossier permanent." 
                  />
                </div>
              </motion.div>
            )}

            {/* STEP 3: AFFECTATION ACADÉMIQUE, MULTI-ANNEXES & TARIFICATION */}
            {activeStep === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Module d'évaluation multi-critères et Dérogation Administrative pour la réinscription */}
                {isReenroll && (
                  <ReenrollmentEligibilityCard
                    evaluation={reenrollEvaluation}
                    dispensation={dispensation}
                    onDispensationChange={setDispensation}
                    terminology={terminology}
                  />
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: Academic Year Session + Campus selector + Cycles + Classes grid */}
                  <div className="lg:col-span-7 space-y-5">
                    {/* Session Académique Cible (Active ou En préparation) */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Calendar size={14} className="text-indigo-600" />
                          <span>Session Académique Cible</span>
                        </label>
                        {academicYears.length > 0 ? (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {academicYears.find(y => y.id === targetYearId)?.status === 'ACTIVE' || academicYears.find(y => y.id === targetYearId)?.is_active
                              ? 'Session Active'
                              : 'Session en Préparation / Future'}
                          </span>
                        ) : (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            Non configurée
                          </span>
                        )}
                      </div>

                      {academicYears.length === 0 ? (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900">
                          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                          <p className="text-xs font-medium leading-relaxed">
                            <strong>Aucune session académique active ou en préparation</strong> n'est enregistrée pour cet établissement. Veuillez vous rendre dans <em>Paramètres &gt; Années Académiques</em> pour en créer ou activer une.
                          </p>
                        </div>
                      ) : academicYears.length === 1 ? (
                        <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <GraduationCap size={15} className="text-slate-500" />
                            <span className="text-xs font-bold text-slate-800 font-mono">{academicYears[0].label}</span>
                          </div>
                          <span className="text-[11px] font-semibold text-slate-500">
                            {academicYears[0].status === 'ACTIVE' || academicYears[0].is_active ? 'Active' : 'Planifiée'}
                          </span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {academicYears.map(year => {
                            const isSelected = targetYearId === year.id;
                            const isActive = year.status === 'ACTIVE' || year.is_active;
                            return (
                              <button
                                key={year.id}
                                type="button"
                                onClick={() => setTargetYearId(year.id)}
                                className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-between ${
                                  isSelected 
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100/70'
                                }`}
                              >
                                <span className="font-mono">{year.label}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  isSelected 
                                    ? 'bg-indigo-500/60 text-white' 
                                    : isActive 
                                      ? 'bg-emerald-100 text-emerald-800' 
                                      : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {isActive ? 'Active' : 'En préparation'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Multi-Tenant / Multi-Campus Selection if multiple campuses exist */}
                    {campuses && campuses.length > 1 && (
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Building2 size={14} className="text-indigo-600" />
                            <span>Annexe / Campus d'Affectation</span>
                          </label>
                          <span className="text-[11px] font-semibold text-slate-400">Multi-Établissement</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCampusId(null);
                              setFormData((prev: any) => ({ ...prev, selectedClassId: '' }));
                            }}
                            className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-between ${
                              !selectedCampusId 
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100/70'
                            }`}
                          >
                            <span>Tous les Campus / Siège</span>
                            {!selectedCampusId && <Check size={14} />}
                          </button>
                          {campuses.map(campus => (
                            <button
                              key={campus.id}
                              type="button"
                              onClick={() => {
                                setSelectedCampusId(campus.id);
                                setFormData((prev: any) => ({ ...prev, selectedClassId: '' }));
                              }}
                              className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-between truncate ${
                                selectedCampusId === campus.id 
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100/70'
                              }`}
                            >
                              <span className="truncate">{campus.name}</span>
                              {selectedCampusId === campus.id && <Check size={14} className="shrink-0 ml-1" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Cycle Selection Pills */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700">
                          1. {terminology.cycle} / Niveau Académique
                        </label>
                        <span className="text-[11px] font-medium text-slate-400">
                          {classesForStep.length} {terminology.classes.toLowerCase()} disponibles
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {getCyclesList().map(cycle => (
                          <button 
                            key={cycle} 
                            type="button" 
                            onClick={() => { 
                              setSelectedCycle(cycle); 
                              setFormData((prev: any) => ({ ...prev, selectedClassId: '' })); 
                            }} 
                            className={`py-2 px-3 rounded-xl border text-xs font-bold tracking-tight transition-all text-center ${
                              selectedCycle === cycle 
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs' 
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {cycle}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Class Selection Grid */}
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <label className="text-xs font-bold text-slate-700">
                          2. {terminology.class} / Filière ({selectedCycle}) <span className="text-rose-500 font-bold">*</span>
                        </label>
                        
                        {/* Search input for large class lists */}
                        {classesForStep.length > 6 && (
                          <div className="relative w-full sm:w-48">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                            <input 
                              type="text"
                              placeholder="Filtrer les classes..."
                              value={classSearchTerm}
                              onChange={(e) => setClassSearchTerm(e.target.value)}
                              className="w-full pl-7 pr-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:border-indigo-600"
                            />
                          </div>
                        )}
                      </div>

                      {Object.keys(groupedClassesForStep).length === 0 ? (
                        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-1.5">
                          <SchoolIcon size={24} className="mx-auto text-slate-400" />
                          <p className="text-xs font-bold text-slate-700">Aucune classe trouvée pour ce niveau</p>
                          <p className="text-[11px] text-slate-500 font-medium">Vérifiez vos filtres ou créez des classes dans la section Configuration.</p>
                        </div>
                      ) : (
                        <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                          {Object.entries(groupedClassesForStep).map(([discipline, classes]) => (
                            <div key={discipline} className="bg-slate-50/60 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5">
                              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                <Layers size={13} className="text-indigo-600" />
                                <span>{discipline}</span>
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {classes.sort((a, b) => a.name.localeCompare(b.name)).map(cls => {
                                  const isSelected = formData.selectedClassId === cls.id;
                                  const range = getClassAgeRange(cls.name, selectedCycle);
                                  const classCampus = campuses.find(c => c.id === cls.campus_id);

                                  return (
                                    <button 
                                      key={cls.id} 
                                      type="button" 
                                      onClick={() => setFormData((prev: any) => ({ ...prev, selectedClassId: cls.id }))} 
                                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 relative ${
                                        isSelected 
                                          ? 'bg-indigo-50/90 border-indigo-500 text-indigo-950 shadow-xs ring-2 ring-indigo-500/20' 
                                          : 'bg-white border-slate-200/80 text-slate-700 hover:border-slate-300 hover:bg-slate-50/50'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <span className="text-xs font-bold leading-tight">
                                          {cls.name.replace(discipline, '').trim() || cls.name}
                                        </span>
                                        {isSelected && (
                                          <div className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                                            <Check size={11} className="stroke-[3]" />
                                          </div>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-2 flex-wrap">
                                        {range && (
                                          <span className={`text-[10px] font-medium ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`}>
                                            Âge : {range.minAge}-{range.maxAge} ans
                                          </span>
                                        )}
                                        {classCampus && (
                                          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                            {classCampus.name}
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Dynamic Pricing Card */}
                  <div className="lg:col-span-5">
                    <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/80 h-full flex flex-col justify-between space-y-4">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/70">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                              <Wallet size={16} />
                            </div>
                            <h4 className="text-sm font-black text-slate-900">Bilan Financier Prévisionnel</h4>
                          </div>
                          <InfoTooltip content="Tarifs officiels définis pour cette classe à l'économat." />
                        </div>

                        {currentPricing.exists ? (
                          <div className="space-y-3">
                            <div className="flex justify-between items-center text-xs py-1 border-b border-slate-200/60">
                              <span className="text-slate-600 font-medium">{terminology.tuition} Annuelle :</span>
                              <span className="font-bold text-slate-900 font-mono">
                                {currentPricing.tuition.amount.toLocaleString()} {currentPricing.tuition.currency}
                              </span>
                            </div>

                            <div className="flex justify-between items-center text-xs py-1 border-b border-slate-200/60">
                              <span className="text-slate-600 font-medium">{isReenroll ? 'Frais de Réinscription :' : "Frais d'Inscription :"}</span>
                              <span className={`font-bold font-mono ${isReenroll && currentPricing.inscription.amount === 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                                {isReenroll && currentPricing.inscription.amount === 0 ? 'OFFERT (0 HTG)' : `${currentPricing.inscription.amount.toLocaleString()} ${currentPricing.inscription.currency}`}
                              </span>
                            </div>

                            {currentPricing.miscFee.amount > 0 && (
                              <div className="flex justify-between items-center text-xs py-1 border-b border-slate-200/60">
                                <div>
                                  <span className="text-slate-600 font-medium">Frais Accessoires :</span>
                                  {currentPricing.isMiscMandatory && <span className="ml-1 text-[9px] font-bold text-indigo-600 uppercase">Obligatoire</span>}
                                </div>
                                <span className="font-bold text-slate-900 font-mono">
                                  {currentPricing.miscFee.amount.toLocaleString()} {currentPricing.miscFee.currency}
                                </span>
                              </div>
                            )}

                            {/* Total Net Card */}
                            <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 text-center space-y-1 mt-2">
                              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                Total Annuel Prévu
                              </span>
                              {(() => {
                                const htgTotal = (currentPricing.tuition.currency === 'HTG' ? currentPricing.tuition.amount : 0) +
                                                 (currentPricing.inscription.currency === 'HTG' ? currentPricing.inscription.amount : 0) +
                                                 (currentPricing.isMiscMandatory && currentPricing.miscFee.currency === 'HTG' ? currentPricing.miscFee.amount : 0);
                                const usdTotal = (currentPricing.tuition.currency === 'USD' ? currentPricing.tuition.amount : 0) +
                                                 (currentPricing.inscription.currency === 'USD' ? currentPricing.inscription.amount : 0) +
                                                 (currentPricing.isMiscMandatory && currentPricing.miscFee.currency === 'USD' ? currentPricing.miscFee.amount : 0);
                                
                                return (
                                  <div className="flex flex-col items-center gap-1">
                                    {htgTotal > 0 && (
                                      <p className="text-2xl font-black text-slate-900 font-mono">
                                        {htgTotal.toLocaleString()} <span className="text-xs font-bold text-indigo-600">HTG</span>
                                      </p>
                                    )}
                                    {usdTotal > 0 && (
                                      <p className="text-2xl font-black text-slate-900 font-mono">
                                        {usdTotal.toLocaleString()} <span className="text-xs font-bold text-emerald-600">USD</span>
                                      </p>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        ) : (
                          <div className="py-8 text-center space-y-1 text-slate-400">
                            <Clock size={20} className="mx-auto text-slate-300" />
                            <p className="text-xs font-medium">Sélectionnez une classe pour calculer le bilan tarifaire</p>
                          </div>
                        )}
                      </div>

                      {/* Selected Class info badge */}
                      {selectedClass && (
                        <div className="p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-center gap-2 text-xs">
                          <CheckCircle2 size={15} className="text-indigo-600 shrink-0" />
                          <span className="text-indigo-950 font-bold truncate">Affecté à : {selectedClass.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 4: PIÈCES JUSTIFICATIVES, BILAN & FINALISATION */}
            {activeStep === 4 && (() => {
              const selectedClassObj = dbClasses.find(c => c.id === formData.selectedClassId);
              const assignedCampusObj = campuses.find(c => c.id === selectedClassObj?.campus_id) || campuses.find(c => c.id === selectedCampusId) || campuses.find(c => c.id === currentCampusId);
              const campusLabel = assignedCampusObj?.name || 'Campus Principal';
              const initials = `${formData.firstName?.[0] || ''}${formData.lastName?.[0] || ''}`.toUpperCase() || 'ID';

              const docDefs = getDocumentDefinitionsForSchoolType(school?.school_type, school?.global_settings);
              const normalized = normalizeStudentDocuments(submittedDocs, school?.school_type, school?.global_settings);
              const completeness = calculateDocumentsCompleteness(normalized, school?.school_type, school?.global_settings);

              const handleSetAllStatus = (newStatus: DocumentStatus) => {
                const updated: Record<string, any> = { ...submittedDocs };
                docDefs.forEach(def => {
                  updated[def.id] = {
                    ...(typeof updated[def.id] === 'object' ? updated[def.id] : {}),
                    status: newStatus
                  };
                });
                setSubmittedDocs(updated);
              };

              const handleDocStatusChange = (docId: string, newStatus: DocumentStatus) => {
                setSubmittedDocs(prev => ({
                  ...prev,
                  [docId]: {
                    ...(typeof prev[docId] === 'object' ? prev[docId] : {}),
                    status: newStatus
                  }
                }));
              };

              const handleDocNotesChange = (docId: string, notes: string) => {
                setSubmittedDocs(prev => ({
                  ...prev,
                  [docId]: {
                    ...(typeof prev[docId] === 'object' ? prev[docId] : { status: 'VALIDE' }),
                    notes
                  }
                }));
              };

              return (
                <motion.div 
                  key="step4"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  {/* Summary Header Card */}
                  <div className="bg-slate-50/70 rounded-2xl p-4 sm:p-5 border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                        {initials}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-black text-slate-900 tracking-tight">
                            {formData.lastName.toUpperCase()} {formData.firstName}
                          </h4>
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                            {formData.gender}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          {selectedClassObj?.name || 'Classe non sélectionnée'} • {campusLabel} • Session {academicYears.find(y => y.id === targetYearId)?.label || '2025-2026'}
                        </p>
                      </div>
                    </div>

                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border ${
                      completeness.isComplete ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      completeness.hasRejection ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {completeness.isComplete ? <CheckCircle2 size={13} className="text-emerald-600" /> :
                       completeness.hasRejection ? <XCircle size={13} className="text-rose-600" /> :
                       <Clock size={13} className="text-amber-600" />}
                      Dossier : {completeness.validatedCount}/{completeness.total} Pièces Validées
                    </span>
                  </div>

                  {/* Document Review Section */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200/80 space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <FileCheck2 size={18} className="text-indigo-600" />
                        <div>
                          <h4 className="text-sm font-black text-slate-900">
                            Contrôle des Pièces Justificatives Exigées
                          </h4>
                          <p className="text-xs text-slate-500 font-medium">
                            Conformité réglementaire ({isUniversity ? 'Universitaire' : isProfessional ? 'Professionnel' : 'Scolaire'})
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSetAllStatus('VALIDE')}
                          className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                        >
                          Tout Valider
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetAllStatus('EN_ATTENTE')}
                          className="px-2.5 py-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors"
                        >
                          Tout En Attente
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {docDefs.map(def => {
                        const item = normalized[def.id] || { status: 'EN_ATTENTE', notes: '' };
                        const status = item.status || 'EN_ATTENTE';

                        return (
                          <div
                            key={def.id}
                            className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                              status === 'VALIDE' ? 'bg-emerald-50/20 border-emerald-200/70' :
                              status === 'REJETE' ? 'bg-rose-50/20 border-rose-200/70' :
                              'bg-slate-50/50 border-slate-200/70'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-bold text-slate-900 leading-snug">{def.name}</div>
                              <div className="text-[11px] text-slate-500 font-medium leading-relaxed">{def.description}</div>
                            </div>

                            {/* 3-state Segmented Selector */}
                            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200/60">
                              <button
                                type="button"
                                onClick={() => handleDocStatusChange(def.id, 'VALIDE')}
                                className={`flex-1 py-1 px-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                                  status === 'VALIDE'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-emerald-700 hover:bg-white/60'
                                }`}
                              >
                                <CheckCircle2 size={12} />
                                <span>Validé</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDocStatusChange(def.id, 'EN_ATTENTE')}
                                className={`flex-1 py-1 px-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                                  status === 'EN_ATTENTE'
                                    ? 'bg-amber-500 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-amber-700 hover:bg-white/60'
                                }`}
                              >
                                <Clock size={12} />
                                <span>En attente</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDocStatusChange(def.id, 'REJETE')}
                                className={`flex-1 py-1 px-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                                  status === 'REJETE'
                                    ? 'bg-rose-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-rose-700 hover:bg-white/60'
                                }`}
                              >
                                <XCircle size={12} />
                                <span>Rejeté</span>
                              </button>
                            </div>

                            {status === 'REJETE' && (
                              <div>
                                <input
                                  type="text"
                                  placeholder="Motif du rejet (ex: document expiré, illisible...)"
                                  value={item.notes || ''}
                                  onChange={(e) => handleDocNotesChange(def.id, e.target.value)}
                                  className="w-full px-2.5 py-1 bg-rose-50/60 border border-rose-200 rounded-lg text-xs font-medium text-rose-900 placeholder:text-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Immediate Payment Option */}
                  {!isEdit && currentPricing.inscription.amount > 0 && (
                    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 space-y-3">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                            <Receipt size={16} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-black text-slate-900">
                                {isReenroll ? 'Règlement Immédiat des Frais de Réinscription' : "Règlement Immédiat des Frais d'Inscription"}
                              </h4>
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                                {currentPricing.inscription.amount.toLocaleString()} {currentPricing.inscription.currency}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                              Encaisser dès maintenant à l'économat et générer le reçu officiel.
                            </p>
                          </div>
                        </div>

                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input 
                            type="checkbox" 
                            checked={payInscriptionNow} 
                            onChange={(e) => setPayInscriptionNow(e.target.checked)} 
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>

                      {payInscriptionNow && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3"
                        >
                          <div>
                            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                              Mode de Règlement
                            </label>
                            <div className="relative">
                              <select 
                                value={inscriptionPaymentMethod} 
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setInscriptionPaymentMethod(val);
                                  if (val === 'MonCash') setInscriptionCurrency('HTG');
                                }}
                                className="w-full text-xs font-bold rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 p-2.5 bg-white text-slate-900 shadow-2xs outline-none cursor-pointer appearance-none pr-8"
                              >
                                {activePaymentMethods.map(m => (
                                  <option key={m.code} value={m.code} className="bg-white text-slate-900 font-medium">
                                    {m.name}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                            </div>
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                              Devise Encaissée
                            </label>
                            <div className="relative">
                              <select
                                value={inscriptionCurrency}
                                onChange={(e) => setInscriptionCurrency(e.target.value)}
                                disabled={currentPricing.inscription.currency === 'HTG' || inscriptionPaymentMethod === 'MonCash'}
                                className="w-full text-xs font-bold rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 p-2.5 bg-white text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 shadow-2xs outline-none cursor-pointer appearance-none pr-8"
                              >
                                {(currentPricing.inscription.currency === 'HTG' || inscriptionPaymentMethod === 'MonCash') ? (
                                  <option value="HTG" className="bg-white text-slate-900 font-medium">HTG (Gourdes Haïtiennes)</option>
                                ) : (
                                  <>
                                    <option value="USD" className="bg-white text-slate-900 font-medium">USD (Dollars Américains)</option>
                                    <option value="HTG" className="bg-white text-slate-900 font-medium">HTG (Converti au taux officiel)</option>
                                  </>
                                )}
                              </select>
                              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                            </div>
                            {currentPricing.inscription.currency === 'USD' && (
                              <p className="text-[10px] text-slate-600 font-medium mt-1">
                                Montant équivalent : <span className="font-bold text-slate-900">{inscriptionCurrency === 'HTG' ? `${((currentPricing.inscription.amount * (exchangeRate || 132.50))).toLocaleString()} HTG` : `${currentPricing.inscription.amount.toLocaleString()} USD`}</span>
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })()}
          </AnimatePresence>
        </div>

        {/* Form Bottom Navigation Bar */}
        <div className="p-4 sm:px-7 sm:py-4 bg-slate-50/90 border-t border-slate-200/80 flex flex-col sm:flex-row justify-between items-center gap-3">
          <button 
            type="button" 
            disabled={activeStep === 1 || isSubmitting} 
            onClick={() => setActiveStep(prev => prev - 1)} 
            className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 flex items-center justify-center gap-1.5 transition-all disabled:opacity-40"
          >
            <ArrowLeft size={14} /> Précédent
          </button>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {activeStep < 4 ? (
              <button 
                type="submit" 
                className="w-full sm:w-auto px-7 py-2.5 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99]"
              >
                <span>{activeStep === 3 ? "Aperçu & Pièces Justificatives" : "Continuer"}</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <button 
                type="submit" 
                disabled={isSubmitting || (isFinanciallyLocked && isReenroll)} 
                className={`w-full sm:w-auto px-7 py-2.5 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 ${
                  isFinanciallyLocked 
                    ? 'bg-rose-400 cursor-not-allowed opacity-90' 
                    : isReenroll && dispensation.enabled
                      ? 'bg-amber-600 hover:bg-amber-700 active:scale-[0.99] shadow-amber-600/20'
                      : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99]'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Scellement en cours...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={15} />
                    <span>
                      {isFinanciallyLocked
                        ? 'Blocage Financier (Dérogation requise)'
                        : isReenroll
                          ? (dispensation.enabled
                              ? 'Valider sous Dérogation Direction'
                              : reenrollEvaluation.academicStatus === 'NOTES_EN_ATTENTE'
                                ? 'Valider la Réinscription (Notes en attente)'
                                : 'Sceller la Promotion & Réinscription')
                          : "Finaliser & Valider l'Inscription"}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

export default StudentForm;
