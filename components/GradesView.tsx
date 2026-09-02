import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  GraduationCap,
  Filter,
  FileSpreadsheet,
  CheckCircle2,
  Eraser,
  Search,
  Save,
  Table as TableIcon,
  ChevronDown,
  Loader2,
  AlertCircle,
  RefreshCw,
  Calendar,
  Layers,
  ClipboardCheck,
  Sparkles,
  User,
  Info,
  Download,
  X,
  Building2,
  FileText,
  SlidersHorizontal,
  Check,
  ArrowRight,
  TrendingUp,
  Percent,
  Lock,
  Unlock,
  ShieldCheck,
  FileDown,
  Maximize2,
  Minimize2,
  Keyboard,
  Sliders,
  Expand,
  Shrink,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "../supabase";
import { useSchool } from "../contexts/SchoolContext";
import { UserProfile, SchoolType } from "../types";
import { AcademicSessionPill } from "./AcademicSessionPill";
import { ClassSelectorPill } from "./ClassSelectorPill";
import { SubjectSelectorPill } from "./SubjectSelectorPill";
import { SelectPill, SelectOption } from "./SelectPill";
import Modal from "./Modal";
import { AuditLogger } from "../utils/auditLogger";
import { getExamsListForClass } from "../lib/evaluations";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useSecurity } from "./SecurityGuard";
import { addSecurityWatermark } from "../utils/pdfWatermark";
import { formatStudentName } from "../utils/formatters";

// Helper pour déterminer le niveau d'une classe et le programme de matières adapté
const getClassLevelKey = (classObj: any): "MATERNELLE" | "FONDAMENTALE" | "SECONDAIRE" | "UNIVERSITE" => {
  const name = (classObj?.name || "").toUpperCase();
  const rawLevel = (classObj?.level || "").toUpperCase();

  if (
    rawLevel === "MATERNELLE" ||
    rawLevel === "PRESCOLAIRE" ||
    name.includes("PETITE") ||
    name.includes("MOYENNE") ||
    name.includes("GRANDE") ||
    name.includes("MATERNELLE") ||
    name.includes("PRESCOLAIRE") ||
    name.includes("PRE-K") ||
    name.includes("KINDERGARTEN") ||
    name.includes("GARDERIE")
  ) {
    return "MATERNELLE";
  }

  if (
    rawLevel === "FONDAMENTALE" ||
    rawLevel === "PRIMAIRE" ||
    name.includes("AF") ||
    name.includes("FONDAMENTALE") ||
    name.includes("PRIMAIRE") ||
    name.includes("1ER CYCLE") ||
    name.includes("2EME CYCLE") ||
    name.includes("3EME CYCLE")
  ) {
    return "FONDAMENTALE";
  }

  if (
    rawLevel === "SECONDAIRE" ||
    rawLevel === "LYCEE" ||
    name.includes("NS1") ||
    name.includes("NS2") ||
    name.includes("NS3") ||
    name.includes("NS4") ||
    name.includes("3EME") ||
    name.includes("2NDE") ||
    name.includes("RHETO") ||
    name.includes("PHILO") ||
    name.includes("SECONDAIRE") ||
    name.includes("LYCEE")
  ) {
    return "SECONDAIRE";
  }

  if (
    rawLevel === "LICENCE" ||
    rawLevel === "MASTER" ||
    rawLevel === "UNIVERSITE" ||
    rawLevel === "PROFESSIONNEL" ||
    name.includes("LICENCE") ||
    name.includes("MASTER") ||
    name.includes("SEMESTRE") ||
    name.includes("FACULTE") ||
    name.includes("PRO")
  ) {
    return "UNIVERSITE";
  }

  return "FONDAMENTALE";
};

const LEVEL_CURRICULUMS: Record<string, Array<{ name: string; code: string; coef: number; maxScore: number }>> = {
  MATERNELLE: [
    { name: "Langage et Communication", code: "LANG-COMM", coef: 100, maxScore: 100 },
    { name: "Initiation aux Mathématiques & Logique", code: "INIT-MATH", coef: 100, maxScore: 100 },
    { name: "Psychomotricité & Activités Physiques", code: "PSYCHOMOT", coef: 100, maxScore: 100 },
    { name: "Arts Plastiques & Éveil Artistique", code: "ARTS-DESS", coef: 100, maxScore: 100 },
    { name: "Éveil Scientifique & Sensoriel", code: "EVEIL-SCI", coef: 100, maxScore: 100 },
    { name: "Éducation Morale & Vie Sociale", code: "MOR-CIV", coef: 100, maxScore: 100 },
  ],
  FONDAMENTALE: [
    { name: "Communication Française", code: "FRAN-FOND", coef: 300, maxScore: 300 },
    { name: "Mathématiques", code: "MATH-FOND", coef: 300, maxScore: 300 },
    { name: "Communication Créole", code: "CREO-FOND", coef: 200, maxScore: 200 },
    { name: "Sciences Expérimentales", code: "SCI-EXP", coef: 200, maxScore: 200 },
    { name: "Sciences Sociales", code: "SCI-SOC", coef: 200, maxScore: 200 },
    { name: "Anglais", code: "ANGL-GEN", coef: 100, maxScore: 100 },
    { name: "Informatique", code: "INFO-TECH", coef: 100, maxScore: 100 },
    { name: "Éducation Physique et Sportive (EPS)", code: "EPS-SPORT", coef: 100, maxScore: 100 },
  ],
  SECONDAIRE: [
    { name: "Communication Française", code: "FRA-STD", coef: 300, maxScore: 300 },
    { name: "Mathématiques", code: "MAT-STD", coef: 300, maxScore: 300 },
    { name: "Physique", code: "PHY-STD", coef: 300, maxScore: 300 },
    { name: "Chimie", code: "CHI-STD", coef: 200, maxScore: 200 },
    { name: "Biologie (SVT)", code: "SVT-STD", coef: 200, maxScore: 200 },
    { name: "Communication Créole", code: "CRE-STD", coef: 200, maxScore: 200 },
    { name: "Sciences Sociales", code: "SCI-SOC", coef: 200, maxScore: 200 },
    { name: "Économie et Société", code: "ECO-STD", coef: 200, maxScore: 200 },
    { name: "Philosophie", code: "PHI-STD", coef: 200, maxScore: 200 },
    { name: "Anglais", code: "ANG-STD", coef: 200, maxScore: 200 },
    { name: "Espagnol", code: "ESP-STD", coef: 200, maxScore: 200 },
    { name: "Informatique", code: "INF-STD", coef: 100, maxScore: 100 },
    { name: "Éducation Physique", code: "EPS-STD", coef: 100, maxScore: 100 },
  ],
  UNIVERSITE: [
    { name: "Communication Française & Rédaction", code: "COM-FR", coef: 100, maxScore: 100 },
    { name: "Anglais Académique", code: "ANG-ACAD", coef: 100, maxScore: 100 },
    { name: "Méthodologie de la Recherche", code: "METHOD-RECH", coef: 100, maxScore: 100 },
    { name: "Mathématiques Générales", code: "MATH-GEN", coef: 100, maxScore: 100 },
    { name: "Informatique & Systèmes", code: "INFO-SYS", coef: 100, maxScore: 100 },
  ],
};

const GradesView: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { ipAddress } = useSecurity();
  const { terminology, school, currentCampusId, campuses, setCurrentCampusId } = useSchool();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [existingGrades, setExistingGrades] = useState<any[]>([]);
  const [schoolName, setSchoolName] = useState("EduNova Pro");

  // Filtres de Contexte
  const [selectedYearId, setSelectedYearId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("1er Contrôle");
  const [isCustomTermMode, setIsCustomTermMode] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [columns, setColumns] = useState<any[]>([]);

  // Grille de données locale (valeurs des cellules)
  const [gridData, setGridData] = useState<Record<string, Record<string, string>>>({});
  // Copie de référence pour détecter les modifications non enregistrées
  const [initialGridData, setInitialGridData] = useState<Record<string, Record<string, string>>>({});

  // Cellule actuellement active / focusée
  const [focusedCell, setFocusedCell] = useState<{
    studentId: string;
    columnId: string;
  } | null>(null);

  // Ergonomie & Affichage du Tableau
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tableHeightMode, setTableHeightMode] = useState<"adaptive" | "fixed-500" | "fixed-750" | "full">("adaptive");
  const [density, setDensity] = useState<"compact" | "comfortable">("compact");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | "ALL">(25);

  // Modale de nettoyage & Modale d'attribution massive
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [bulkFillScore, setBulkFillScore] = useState("");
  const [bulkFillTargetCol, setBulkFillTargetCol] = useState<string | null>(null);

  // Nom du campus actif
  const activeCampusName = useMemo(() => {
    if (!currentCampusId || !campuses || campuses.length === 0) return null;
    const found = campuses.find((c) => c.id === currentCampusId);
    return found?.name || "Annexe locale";
  }, [currentCampusId, campuses]);

  // Récupérer la liste dynamique des examens pour la classe
  const getExamsList = () => {
    const currentCls = classes.find((c) => c.id === selectedClassId);
    return getExamsListForClass(currentCls, school?.school_type);
  };

  const examsList = getExamsList();

  // Options mémorisées pour le Sélecteur de Campus (Style Pilule)
  const campusSelectOptions: SelectOption[] = useMemo(() => {
    const opts: SelectOption[] = [
      { value: "", label: "🌐 Tous les Campus", badge: "Global" }
    ];
    if (campuses && campuses.length > 0) {
      campuses.forEach((c) => {
        opts.push({
          value: c.id,
          label: c.name,
          badge: "Annexe",
          icon: Building2
        });
      });
    }
    return opts;
  }, [campuses]);

  // Options mémorisées pour le Sélecteur de Période / Évaluation (Style Pilule)
  const termSelectOptions: SelectOption[] = useMemo(() => {
    const opts: SelectOption[] = examsList.map((exam) => ({
      value: exam,
      label: exam,
      badge: school?.school_type === SchoolType.UNIVERSITY ? "Session" : "Évaluation",
      icon: FileText
    }));
    opts.push({
      value: "__CUSTOM__",
      label: "➕ Autre nom d'évaluation...",
      badge: "Personnalisé",
      description: "Saisir un libellé sur-mesure"
    });
    return opts;
  }, [examsList, school?.school_type]);

  useEffect(() => {
    if (!isCustomTermMode && examsList.length > 0 && !examsList.includes(selectedTerm)) {
      setSelectedTerm(examsList[0]);
    }
  }, [examsList, selectedTerm, isCustomTermMode]);

  const selectedYear = academicYears.find((y) => y.id === selectedYearId);
  const selectedClassObj = useMemo(() => classes.find((c) => c.id === selectedClassId), [classes, selectedClassId]);
  const classLevelKey = useMemo(() => getClassLevelKey(selectedClassObj), [selectedClassObj]);

  const isYearActive = selectedYear
    ? selectedYear.status === "ACTIVE" || selectedYear.is_active
    : false;
  const isAdmin =
    user.role === "SCHOOL_ADMIN" ||
    user.role === "DIRECTOR" ||
    user.role === "SUPER_ADMIN" ||
    user.role === "SECRETARY";
  const isTeacher = user.role === "TEACHER";
  const canWriteGrades = (isAdmin || isTeacher) && (isYearActive || isAdmin);
  const isReadOnly = !canWriteGrades;

  // Calcul du nombre de modifications non enregistrées
  const unsavedCount = useMemo(() => {
    let diff = 0;
    Object.keys(gridData).forEach((sId) => {
      const row = gridData[sId] || {};
      const initialRow = initialGridData[sId] || {};
      Object.keys(row).forEach((colId) => {
        if ((row[colId] || "") !== (initialRow[colId] || "")) {
          diff++;
        }
      });
    });
    return diff;
  }, [gridData, initialGridData]);

  // Raccourci clavier global Ctrl+S pour sauvegarder et Echap pour quitter le plein écran
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!isReadOnly && !saving && unsavedCount > 0) {
          handleSaveGrades();
        }
      }
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isReadOnly, saving, unsavedCount, gridData, isFullscreen]);

  // Déverrouillage d'une note scellée spécifique (Admin / Direction)
  const unlockSingleGrade = async (gradeId: string) => {
    if (!isAdmin) return;
    try {
      const { error } = await supabase
        .from("grades")
        .update({ is_sealed: false })
        .eq("id", gradeId)
        .eq("school_id", user.school_id);
      if (error) throw error;
      toast.success("Note déverrouillée avec succès.");
      loadGradeContext();
    } catch (err: any) {
      toast.error("Erreur de déverrouillage : " + err.message);
    }
  };

  // 1. CHARGEMENT DES RÉFÉRENTIELS (Années, Classes, Établissement) avec isolation Multi-Tenant & Campus
  const fetchRefs = useCallback(async () => {
    setLoading(true);
    try {
      const [ayRes, clsRes, schoolRes] = await Promise.all([
        supabase
          .from("academic_years")
          .select("*")
          .eq("school_id", user.school_id)
          .order("label", { ascending: false }),
        (() => {
          let query = supabase
            .from("classes")
            .select("*")
            .eq("school_id", user.school_id);
          if (currentCampusId) {
            query = query.or(`campus_id.eq.${currentCampusId},campus_id.is.null`);
          }
          return query.order("name");
        })(),
        supabase
          .from("schools")
          .select("name")
          .eq("id", user.school_id)
          .maybeSingle(),
      ]);

      if (schoolRes.data) {
        setSchoolName(schoolRes.data.name || "EduNova Pro");
      }

      if (ayRes.data) {
        const filteredYears = ayRes.data.filter(
          (y) => y.status !== "VIERGE" && y.status !== "FUTURE",
        );
        const finalYears =
          filteredYears.length > 0
            ? filteredYears
            : ayRes.data.filter((y) => y.status !== "FUTURE");
        setAcademicYears(finalYears);
        if (!selectedYearId || !finalYears.some((y) => y.id === selectedYearId)) {
          const active =
            finalYears.find((y) => y.is_active || y.status === "ACTIVE") ||
            finalYears[0];
          setSelectedYearId(active?.id || "");
        }
      }

      // Filtrer les classes pour les enseignants
      if (clsRes.data) {
        let availableClasses = clsRes.data;

        if (user.role === "TEACHER") {
          const { data: staffData } = await supabase
            .from("staff")
            .select("id")
            .eq("school_id", user.school_id)
            .eq("email", user.email)
            .maybeSingle();

          if (staffData) {
            const { data: assignments } = await supabase
              .from("staff_assignments")
              .select("class_name, class_id")
              .eq("school_id", user.school_id)
              .eq("staff_id", staffData.id);

            const assignedClassNames = assignments?.map((a) => a.class_name).filter(Boolean) || [];
            const assignedClassIds = assignments?.map((a) => a.class_id).filter(Boolean) || [];

            const filteredClasses = availableClasses.filter(
              (c) => assignedClassNames.includes(c.name) || assignedClassIds.includes(c.id)
            );
            availableClasses = filteredClasses;
          } else {
            availableClasses = [];
          }
        }

        setClasses(availableClasses);
        if (availableClasses.length > 0) {
          if (!selectedClassId || !availableClasses.some((c) => c.id === selectedClassId)) {
            setSelectedClassId(availableClasses[0].id);
          }
        } else {
          setSelectedClassId("");
        }
      }
    } catch (err) {
      console.error("Refs Error:", err);
    } finally {
      setLoading(false);
    }
  }, [user.school_id, user.role, user.email, selectedYearId, selectedClassId, currentCampusId]);

  useEffect(() => {
    fetchRefs();
  }, [fetchRefs]);

  // 2. CHARGEMENT DU CONTEXTE DE SAISIE (Matières assignées, Élèves, Notes existantes)
  const loadGradeContext = useCallback(async () => {
    if (!selectedYearId || !selectedClassId || !selectedTerm) return;

    setLoading(true);
    try {
      const currentClassObj = classes.find((c) => c.id === selectedClassId);
      const levelKey = getClassLevelKey(currentClassObj);

      // A. CHARGER TOUTES LES MATIÈRES ASSIGNÉES À CETTE CLASSE
      const [classSubRes, allSchoolSubsRes] = await Promise.all([
        supabase
          .from("class_subjects")
          .select("id, class_id, subject_id, coefficient")
          .eq("class_id", selectedClassId),
        supabase
          .from("subjects")
          .select("id, name, code, category, description")
          .eq("school_id", user.school_id)
          .order("name"),
      ]);

      const rawClassSubs = classSubRes.data || [];
      const schoolSubjects = allSchoolSubsRes.data || [];
      const subjectsMap = new Map<string, any>();
      schoolSubjects.forEach((s) => subjectsMap.set(s.id, s));

      const missingSubjectIds = rawClassSubs
        .map((cs) => cs.subject_id)
        .filter((id) => id && !subjectsMap.has(id));

      if (missingSubjectIds.length > 0) {
        const { data: extraSubs } = await supabase
          .from("subjects")
          .select("id, name, code, category, description")
          .in("id", missingSubjectIds);
        extraSubs?.forEach((s) => subjectsMap.set(s.id, s));
      }

      let mappedSubjects: Array<{
        id: string;
        name: string;
        code: string;
        category: string;
        coefficient: number;
        maxScore: number;
      }> = [];

      // 1. Priorité absolue : Les matières explicitement assignées à la classe dans class_subjects
      if (rawClassSubs.length > 0) {
        rawClassSubs.forEach((cs) => {
          const sObj = subjectsMap.get(cs.subject_id);
          if (sObj && sObj.name) {
            const coef = Number(cs.coefficient) || 1;
            const computedMaxScore = coef > 20 ? coef : 20;
            mappedSubjects.push({
              id: sObj.id,
              name: sObj.name,
              code: sObj.code || "",
              category: sObj.category || "GENERAL",
              coefficient: coef,
              maxScore: computedMaxScore,
            });
          }
        });
      }

      // 2. Fallback 1 : Matières de l'école adaptées au niveau
      if (mappedSubjects.length === 0 && schoolSubjects.length > 0) {
        const levelFiltered = schoolSubjects.filter((s: any) => {
          const code = (s.code || "").toUpperCase();
          const name = (s.name || "").toUpperCase();

          if (levelKey === "MATERNELLE") {
            return (
              ["LANG-COMM", "INIT-MATH", "PSYCHOMOT", "ARTS-DESS", "EVEIL-SCI", "MOR-CIV"].includes(code) ||
              name.includes("INITIATION") ||
              name.includes("EVEIL") ||
              name.includes("PSYCHOMOT") ||
              name.includes("DESSIN") ||
              name.includes("LANGAGE")
            );
          }
          if (levelKey === "FONDAMENTALE") {
            return (
              ["FRAN-FOND", "MATH-FOND", "CREO-FOND", "SCI-EXP", "SCI-SOC", "ANGL-GEN", "INFO-TECH", "EPS-SPORT", "FRA-STD", "MAT-STD", "CRE-STD"].includes(code) ||
              name.includes("FRANÇAISE") ||
              name.includes("MATHÉMATIQUES") ||
              name.includes("CRÉOLE") ||
              name.includes("EXPÉRIMENTALE") ||
              name.includes("SOCIALES")
            );
          }
          return true;
        });

        const pool = levelFiltered.length > 0 ? levelFiltered : schoolSubjects;
        mappedSubjects = pool.map((s: any) => {
          const coef = 100;
          return {
            id: s.id,
            name: s.name,
            code: s.code || "",
            category: s.category || "GENERAL",
            coefficient: coef,
            maxScore: coef > 20 ? coef : 20,
          };
        });
      }

      // 3. Fallback 2 : Programme officiel de secours
      if (mappedSubjects.length === 0) {
        const defaultList = LEVEL_CURRICULUMS[levelKey] || LEVEL_CURRICULUMS.FONDAMENTALE;
        mappedSubjects = defaultList.map((s, idx) => ({
          id: `def-sub-${idx}-${s.code}`,
          name: s.name,
          code: s.code,
          category: "GENERAL",
          coefficient: s.coef,
          maxScore: s.coef > 20 ? s.coef : 20,
        }));
      }

      mappedSubjects.sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));

      // Filtrer pour l'enseignant si assignations
      if (user.role === "TEACHER") {
        const { data: staffData } = await supabase
          .from("staff")
          .select("id")
          .eq("school_id", user.school_id)
          .eq("email", user.email)
          .maybeSingle();

        if (staffData) {
          const currentClassName = currentClassObj?.name;
          let filterAssignQuery = supabase
            .from("staff_assignments")
            .select("subject_name, subject_id")
            .eq("school_id", user.school_id)
            .eq("staff_id", staffData.id);

          if (selectedClassId && currentClassName) {
            filterAssignQuery = filterAssignQuery.or(`class_id.eq.${selectedClassId},class_name.eq.${currentClassName}`);
          }

          const { data: assignments } = await filterAssignQuery;
          const assignedSubjectNames = assignments?.map((a) => a.subject_name).filter(Boolean) || [];
          const assignedSubjectIds = assignments?.map((a) => a.subject_id).filter(Boolean) || [];

          if (assignedSubjectNames.length > 0 || assignedSubjectIds.length > 0) {
            const filtered = mappedSubjects.filter(
              (s) => assignedSubjectNames.includes(s.name) || assignedSubjectIds.includes(s.id)
            );
            if (filtered.length > 0) {
              mappedSubjects = filtered;
            }
          }
        }
      }

      setSubjects(mappedSubjects);
      if (selectedSubjectId !== "ALL" && !mappedSubjects.some((s) => s.id === selectedSubjectId)) {
        setSelectedSubjectId("ALL");
      }

      // B. CHARGEMENT ROBUSTE DES ÉLÈVES (Multi-Tenant & Annexe)
      // 1. Récupérer d'abord les IDs d'inscriptions pour cette classe
      let enrolledStudentIds: string[] = [];
      const { data: enrollData } = await supabase
        .from("enrollments")
        .select("student_id")
        .eq("school_id", user.school_id)
        .eq("class_id", selectedClassId)
        .or(`academic_year_id.eq.${selectedYearId},academic_year_id.is.null`);

      if (enrollData && enrollData.length > 0) {
        enrolledStudentIds = Array.from(new Set(enrollData.map((e) => e.student_id).filter(Boolean)));
      }

      // 2. Charger les données des étudiants depuis la table students avec les colonnes vérifiées
      let stuData: any[] = [];

      // Si nous avons des inscriptions, les requêter
      if (enrolledStudentIds.length > 0) {
        let stQuery = supabase
          .from("students")
          .select("id, first_name, last_name, status, campus_id, reference_number, gender, class_id")
          .eq("school_id", user.school_id)
          .in("id", enrolledStudentIds);

        if (currentCampusId) {
          stQuery = stQuery.or(`campus_id.eq.${currentCampusId},campus_id.is.null`);
        }

        const { data: fromEnroll } = await stQuery;
        stuData = (fromEnroll || []).filter(
          (s: any) => s && (s.status === "Actif" || s.status === "ACTIF" || !s.status)
        );
      }

      // Fallback direct par class_id si aucun élève trouvé via enrollments
      if (stuData.length === 0) {
        let directQuery = supabase
          .from("students")
          .select("id, first_name, last_name, status, campus_id, reference_number, gender, class_id")
          .eq("school_id", user.school_id)
          .eq("class_id", selectedClassId);

        if (currentCampusId) {
          directQuery = directQuery.or(`campus_id.eq.${currentCampusId},campus_id.is.null`);
        }

        const { data: directStudents } = await directQuery;
        stuData = (directStudents || []).filter(
          (s: any) => s && (s.status === "Actif" || s.status === "ACTIF" || !s.status)
        );
      }

      // Normaliser le matricule pour chaque étudiant
      stuData = stuData.map((s) => ({
        ...s,
        matricule: s.reference_number || s.matricule || "-",
      }));

      // Trier les élèves par Nom puis Prénom
      stuData.sort((a: any, b: any) =>
        (a.last_name || "").localeCompare(b.last_name || "", "fr", { sensitivity: "base" })
      );

      setStudents(stuData);

      // C. CHARGER LES ÉVALUATIONS PARTICULIÈRES (Course evaluations syllabus)
      const subIds = mappedSubjects.map((s) => s.id);
      let evalData: any[] = [];
      if (subIds.length > 0) {
        let evQuery = supabase
          .from("course_evaluations")
          .select("id, name, subject_id, total_marks, weight_percentage")
          .eq("school_id", user.school_id)
          .eq("term", selectedTerm)
          .in("subject_id", subIds);

        if (selectedClassId) {
          evQuery = evQuery.or(`class_id.eq.${selectedClassId},class_id.is.null`);
        } else {
          evQuery = evQuery.is("class_id", null);
        }

        const { data } = await evQuery;
        evalData = data || [];
      }
      setEvaluations(evalData);

      // D. CONSTRUIRE LES COLONNES DYNAMIQUES DE LA GRILLE
      const columnsList: any[] = [];
      mappedSubjects.forEach((sub) => {
        const subEvals = evalData.filter((e) => e.subject_id === sub.id);
        if (subEvals.length > 0) {
          subEvals.forEach((ev) => {
            columnsList.push({
              id: `eval_${ev.id}`,
              subjectId: sub.id,
              courseEvaluationId: ev.id,
              name: `${sub.name} - ${ev.name}`,
              shortName: ev.name,
              subjectName: sub.name,
              category: sub.category,
              maxScore: ev.total_marks || sub.maxScore || 20,
              weight: ev.weight_percentage || 100,
              coefficient: sub.coefficient,
            });
          });
        } else {
          columnsList.push({
            id: `subj_${sub.id}`,
            subjectId: sub.id,
            courseEvaluationId: null,
            name: sub.name,
            shortName: "Générale",
            subjectName: sub.name,
            category: sub.category,
            maxScore: sub.maxScore || (sub.coefficient > 20 ? sub.coefficient : 20),
            weight: 100,
            coefficient: sub.coefficient,
          });
        }
      });
      setColumns(columnsList);

      // E. CHARGER LES NOTES EXISTANTES DANS LA BASE DE DONNÉES
      let gradeData: any[] = [];
      if (stuData && stuData.length > 0) {
        const studentIds = stuData.map((s: any) => s.id);
        let query = supabase
          .from("grades")
          .select("*, is_sealed")
          .eq("school_id", user.school_id)
          .eq("term", selectedTerm)
          .in("student_id", studentIds);

        if (selectedYearId) {
          query = query.eq("academic_year_id", selectedYearId);
        }

        const { data, error } = await query;
        if (!error && data) {
          gradeData = data;
        } else if (error) {
          console.warn("Grades fetch error:", error);
        }
      }

      setExistingGrades(gradeData);

      // F. INITIALISER LA GRILLE LOCALE
      const initialGrid: Record<string, Record<string, string>> = {};
      stuData.forEach((s) => {
        initialGrid[s.id] = {};
        columnsList.forEach((col) => {
          const found = gradeData.find(
            (g) =>
              g.student_id === s.id &&
              g.subject_id === col.subjectId &&
              (col.courseEvaluationId
                ? g.course_evaluation_id === col.courseEvaluationId
                : !g.course_evaluation_id)
          );
          initialGrid[s.id][col.id] = found ? found.score.toString() : "";
        });
      });

      setGridData(initialGrid);
      setInitialGridData(JSON.parse(JSON.stringify(initialGrid)));
    } catch (err) {
      console.error("Context Load Error:", err);
      toast.error("Erreur lors du chargement du journal des évaluations.");
    } finally {
      setLoading(false);
    }
  }, [selectedYearId, selectedClassId, selectedTerm, user.school_id, user.role, user.email, currentCampusId, classes]);

  useEffect(() => {
    loadGradeContext();
  }, [loadGradeContext]);

  // GESTION DE LA SAISIE INDIVIDUELLE DANS LA GRILLE
  const handleScoreChange = (
    studentId: string,
    columnId: string,
    value: string,
    maxScore: number,
    colName?: string,
  ) => {
    const normalizedValue = value.replace(",", ".");

    if (value === "") {
      setGridData((prev) => ({
        ...prev,
        [studentId]: {
          ...(prev[studentId] || {}),
          [columnId]: "",
        },
      }));
      return;
    }

    const num = Number(normalizedValue);

    if (isNaN(num)) {
      return;
    }

    if (num < 0) {
      toast.warning("La note ne peut pas être négative.");
      return;
    }

    if (num > maxScore) {
      toast.warning(
        `Note invalide (${normalizedValue}) : Max ${maxScore} pour ${colName || "cette matière"}.`
      );
      return;
    }

    setGridData((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [columnId]: normalizedValue,
      },
    }));
  };

  // NAVIGATION CLAVIER FLUIDE ET ERGONOMIQUE (Flèches, Entrée, Tab)
  const handleKeyDown = (
    e: React.KeyboardEvent,
    studentIndex: number,
    columnIndex: number,
  ) => {
    const studentCount = filteredStudents.length;
    const colCount = activeColumns.length;

    let nextStudentIndex = studentIndex;
    let nextColumnIndex = columnIndex;

    if (e.key === "ArrowUp") {
      e.preventDefault();
      nextStudentIndex = Math.max(0, studentIndex - 1);
    } else if (e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault();
      if (studentIndex < studentCount - 1) {
        nextStudentIndex = studentIndex + 1;
      } else {
        if (columnIndex < colCount - 1) {
          nextStudentIndex = 0;
          nextColumnIndex = columnIndex + 1;
        }
      }
    } else if (e.key === "ArrowLeft") {
      if ((e.target as HTMLInputElement).selectionStart === 0) {
        e.preventDefault();
        nextColumnIndex = Math.max(0, columnIndex - 1);
      } else {
        return;
      }
    } else if (e.key === "ArrowRight") {
      const input = e.target as HTMLInputElement;
      if (input.selectionStart === input.value.length) {
        e.preventDefault();
        nextColumnIndex = Math.min(colCount - 1, columnIndex + 1);
      } else {
        return;
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        nextColumnIndex = Math.max(0, columnIndex - 1);
      } else {
        nextColumnIndex = Math.min(colCount - 1, columnIndex + 1);
      }
    } else {
      return;
    }

    const nextStudent = filteredStudents[nextStudentIndex];
    const nextCol = activeColumns[nextColumnIndex];
    if (nextStudent && nextCol) {
      const nextInput = document.getElementById(`grade-${nextStudent.id}-${nextCol.id}`);
      if (nextInput) {
        (nextInput as HTMLInputElement).focus();
        (nextInput as HTMLInputElement).select();
      }
    }
  };

  // ENREGISTREMENT ET SCELLAGE MASSIF
  const handleSaveGrades = async () => {
    setSaving(true);
    try {
      const recordsToUpsert: any[] = [];
      const recordsToDelete: string[] = [];

      Object.entries(gridData).forEach(([studentId, scores]) => {
        Object.entries(scores).forEach(([colId, score]) => {
          const colDef = columns.find((c) => c.id === colId);
          if (!colDef) return;

          const existingGrade = existingGrades.find(
            (g) =>
              g.student_id === studentId &&
              g.subject_id === colDef.subjectId &&
              (colDef.courseEvaluationId
                ? g.course_evaluation_id === colDef.courseEvaluationId
                : !g.course_evaluation_id)
          );

          if (user.role === "TEACHER" && existingGrade?.is_sealed) {
            return;
          }

          if (score !== "") {
            const gradeId =
              existingGrade?.id ||
              (typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
                    const r = (Math.random() * 16) | 0;
                    const v = c === "x" ? r : (r & 0x3) | 0x8;
                    return v.toString(16);
                  }));

            const record: any = {
              id: gradeId,
              school_id: user.school_id,
              student_id: studentId,
              subject_id: colDef.subjectId,
              course_evaluation_id: colDef.courseEvaluationId || null,
              term: selectedTerm,
              score: parseFloat(score),
              is_sealed: true,
            };
            if (selectedYearId) {
              record.academic_year_id = selectedYearId;
            }
            recordsToUpsert.push(record);
          } else if (existingGrade) {
            recordsToDelete.push(existingGrade.id);
          }
        });
      });

      if (recordsToUpsert.length > 0) {
        // Sanitize records to ensure only valid grades table columns are sent
        const sanitizedRecords = recordsToUpsert.map(({ campus_id, ...validGrade }: any) => validGrade);
        const { error } = await supabase.from("grades").upsert(sanitizedRecords);
        if (error) {
          if (
            error.code === "42703" ||
            error.code === "PGRST204" ||
            error.message?.includes("column") ||
            error.message?.includes("schema cache")
          ) {
            const fallbackRecords = sanitizedRecords.map(
              ({ academic_year_id, course_evaluation_id, ...rest }: any) => rest,
            );
            const { error: retryError } = await supabase
              .from("grades")
              .upsert(fallbackRecords);
            if (retryError) throw retryError;
          } else {
            throw error;
          }
        }
      }

      if (recordsToDelete.length > 0) {
        const chunkSize = 100;
        for (let i = 0; i < recordsToDelete.length; i += chunkSize) {
          const chunk = recordsToDelete.slice(i, i + chunkSize);
          const { error: delError } = await supabase
            .from("grades")
            .delete()
            .eq("school_id", user.school_id)
            .in("id", chunk);
          if (delError) throw delError;
        }
      }

      if (recordsToUpsert.length === 0 && recordsToDelete.length === 0) {
        toast.info("Aucune modification à enregistrer.");
        setSaving(false);
        return;
      }

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: "UPDATE",
        entity_type: "student",
        details: {
          type: "grades_batch",
          class_name: selectedClassObj?.name,
          campus_id: currentCampusId || selectedClassObj?.campus_id,
          term: selectedTerm,
          count: recordsToUpsert.length,
        },
      });

      toast.success("✨ Journal des évaluations synchronisé et scellé avec succès !");
      loadGradeContext();
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error("Erreur de sauvegarde : " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ATTRIBUTION MASSIVE (BULK FILL) POUR UNE MATIÈRE
  const handleApplyBulkFill = (columnId: string, value: string) => {
    const col = columns.find((c) => c.id === columnId);
    if (!col) return;
    const max = col.maxScore || 100;
    const num = Number(value);
    if (isNaN(num) || num < 0 || num > max) {
      toast.error(`La note doit être comprise entre 0 et ${max}.`);
      return;
    }

    setGridData((prev) => {
      const next = { ...prev };
      students.forEach((stu) => {
        next[stu.id] = {
          ...(next[stu.id] || {}),
          [columnId]: value,
        };
      });
      return next;
    });

    toast.success(`Note ${value}/${max} attribuée à tous les élèves pour ${col.name}.`);
    setBulkFillTargetCol(null);
    setBulkFillScore("");
  };

  // FILTRAGE DES ÉLÈVES SELON RECHERCHE
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const fullName = formatStudentName(s.last_name, s.first_name).fullName;
      const matricule = s.matricule || "";
      const search = searchTerm.toLowerCase();
      return (
        fullName.toLowerCase().includes(search) ||
        matricule.toLowerCase().includes(search)
      );
    });
  }, [students, searchTerm]);

  // Réinitialiser la page courante quand la recherche, la classe ou la matière change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedClassId, selectedSubjectId, itemsPerPage]);

  // PAGINATION DES ÉLÈVES
  const totalPages = useMemo(() => {
    if (itemsPerPage === "ALL" || filteredStudents.length === 0) return 1;
    return Math.ceil(filteredStudents.length / itemsPerPage);
  }, [filteredStudents.length, itemsPerPage]);

  const paginatedStudents = useMemo(() => {
    if (itemsPerPage === "ALL") return filteredStudents;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredStudents.slice(start, start + itemsPerPage);
  }, [filteredStudents, currentPage, itemsPerPage]);

  const startIndex = useMemo(() => {
    if (filteredStudents.length === 0) return 0;
    if (itemsPerPage === "ALL") return 1;
    return (currentPage - 1) * itemsPerPage + 1;
  }, [filteredStudents.length, currentPage, itemsPerPage]);

  const endIndex = useMemo(() => {
    if (itemsPerPage === "ALL") return filteredStudents.length;
    return Math.min(currentPage * itemsPerPage, filteredStudents.length);
  }, [filteredStudents.length, currentPage, itemsPerPage]);

  // FILTRAGE DES COLONNES SELON MATIÈRE SÉLECTIONNÉE
  const activeColumns = useMemo(() => {
    if (selectedSubjectId === "ALL") {
      return columns;
    }
    return columns.filter((c) => c.subjectId === selectedSubjectId);
  }, [columns, selectedSubjectId]);

  // STATISTIQUES & INDICATEURS DE PERFORMANCE (KPIs)
  const kpiStats = useMemo(() => {
    if (!students.length || !activeColumns.length) {
      return {
        studentCount: students.length,
        classAvg: "-",
        successRate: "-",
        filledCount: 0,
        totalCells: 0,
        percentageFilled: 0,
        sealedCount: existingGrades.filter((g) => g.is_sealed).length,
      };
    }

    let totalPointsSum = 0;
    let studentsWithNotes = 0;
    let successCount = 0;
    let filledCount = 0;
    const totalCells = students.length * activeColumns.length;

    students.forEach((student) => {
      let studentPoints = 0;
      let studentCoef = 0;

      activeColumns.forEach((col) => {
        const val = gridData[student.id]?.[col.id];
        if (val !== undefined && val !== "" && !isNaN(parseFloat(val))) {
          filledCount++;
          const note = parseFloat(val);
          const points10 = (note / col.maxScore) * 10;
          studentPoints += points10 * col.coefficient;
          studentCoef += col.coefficient;
        }
      });

      if (studentCoef > 0) {
        const studentAvg = studentPoints / studentCoef;
        totalPointsSum += studentAvg;
        studentsWithNotes++;
        if (studentAvg >= 5.0) {
          successCount++;
        }
      }
    });

    const classAvg =
      studentsWithNotes > 0
        ? (totalPointsSum / studentsWithNotes).toFixed(2) + " / 10"
        : "-";
    const successRate =
      studentsWithNotes > 0
        ? Math.round((successCount / studentsWithNotes) * 100) + "%"
        : "-";
    const percentageFilled =
      totalCells > 0 ? Math.round((filledCount / totalCells) * 100) : 0;

    return {
      studentCount: students.length,
      classAvg,
      successRate,
      filledCount,
      totalCells,
      percentageFilled,
      sealedCount: existingGrades.filter((g) => g.is_sealed).length,
    };
  }, [students, activeColumns, gridData, existingGrades]);

  // EXPORT EXCEL (.XLSX)
  const exportJournalExcel = () => {
    if (!selectedClassId || students.length === 0) return;

    const data: any[] = [];
    filteredStudents.forEach((student, index) => {
      let totalPoints = 0;
      let totalCoef = 0;

      const row: any = {
        "N°": index + 1,
        "Matricule": student.matricule || "-",
        "Nom": (student.last_name || "").toUpperCase(),
        "Prénom": student.first_name || "",
        "Sexe": student.gender || "-",
      };

      activeColumns.forEach((col) => {
        const val = gridData[student.id]?.[col.id];
        if (val !== undefined && val !== "" && !isNaN(parseFloat(val))) {
          const note = parseFloat(val);
          row[`${col.name} (Coef ${col.coefficient})`] = note;
          totalPoints += (note / col.maxScore) * 10 * col.coefficient;
          totalCoef += col.coefficient;
        } else {
          row[`${col.name} (Coef ${col.coefficient})`] = "-";
        }
      });

      const avg = totalCoef > 0 ? (totalPoints / totalCoef).toFixed(2) : "-";
      row["Moyenne Générale (/10)"] = avg;
      row["Mention"] =
        avg !== "-"
          ? parseFloat(avg) >= 8.5
            ? "Excellent"
            : parseFloat(avg) >= 7.0
              ? "Bien"
              : parseFloat(avg) >= 5.0
                ? "Passable"
                : "Insuffisant"
          : "-";

      data.push(row);
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Journal Évaluations");
    const fileName = `Journal_${selectedClassObj?.name || "Classe"}_${selectedTerm.replace(/\s+/g, "_")}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success("Export Excel généré avec succès !");
  };

  // EXPORT PDF PAYSAGE ÉLÉGANT & OFFICIEL
  const exportJournalPDF = () => {
    if (!selectedClassId || students.length === 0) return;

    const doc = new jsPDF("l", "mm", "a4");
    const currentYear = academicYears.find((y) => y.id === selectedYearId);
    const currentClass = classes.find((c) => c.id === selectedClassId);

    // Titre & En-tête Institutionnel
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(schoolName.toUpperCase(), 14, 14);

    doc.setFontSize(12);
    doc.setTextColor(37, 99, 235);
    doc.text("JOURNAL OFFICIEL DES ÉVALUATIONS", 14, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);

    const campusText = activeCampusName ? ` • Annexe : ${activeCampusName}` : "";
    doc.text(
      `Session : ${currentYear?.label || "N/A"} • Classe : ${currentClass?.name || "N/A"}${campusText} • Période : ${selectedTerm}`,
      14,
      25,
    );
    doc.text(`Date d'impression : ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}`, 14, 30);

    // En-têtes du tableau
    const head = [
      [
        "N°",
        "NOM & PRÉNOM",
        ...activeColumns.map((s) => `${s.name}\n(Coef: ${s.coefficient} • /${s.maxScore})`),
        "TOTAL",
        "MOYENNE",
      ],
    ];

    let classTotalPoints = 0;
    let classTotalStudentsWithNotes = 0;
    let highestAverage = 0;
    let lowestAverage = 10;
    let successCount = 0;

    const body = filteredStudents.map((student, index) => {
      let totalPoints = 0;
      let totalCoef = 0;

      const subjectGroups: Record<string, { pts: number; weightTotal: number; coef: number }> = {};
      const scores = activeColumns.map((sub) => {
        const val = gridData[student.id]?.[sub.id];
        if (val !== "" && val !== undefined && !isNaN(parseFloat(val))) {
          const note = parseFloat(val);
          if (!subjectGroups[sub.subjectId]) {
            subjectGroups[sub.subjectId] = { pts: 0, weightTotal: 0, coef: sub.coefficient };
          }
          if (sub.courseEvaluationId) {
            const weight = sub.weight || 0;
            subjectGroups[sub.subjectId].pts += (note / sub.maxScore) * weight;
            subjectGroups[sub.subjectId].weightTotal += weight;
          } else {
            subjectGroups[sub.subjectId].pts += (note / sub.maxScore) * 100;
            subjectGroups[sub.subjectId].weightTotal += 100;
          }
          return note.toString();
        }
        return "-";
      });

      Object.values(subjectGroups).forEach((group) => {
        if (group.weightTotal > 0) {
          const subjectPoints = (group.pts / group.weightTotal) * group.coef;
          totalPoints += subjectPoints;
          totalCoef += group.coef;
        }
      });

      const avgNum = totalCoef > 0 ? (totalPoints / totalCoef) * 10 : null;
      const average = avgNum !== null ? avgNum.toFixed(2) : "-";

      if (avgNum !== null) {
        classTotalPoints += avgNum;
        classTotalStudentsWithNotes++;
        if (avgNum > highestAverage) highestAverage = avgNum;
        if (avgNum < lowestAverage) lowestAverage = avgNum;
        if (avgNum >= 5) successCount++;
      }

      return [
        index + 1,
        formatStudentName(student.last_name, student.first_name).fullName,
        ...scores,
        totalPoints > 0 ? totalPoints.toFixed(1) : "-",
        average,
      ];
    });

    autoTable(doc, {
      startY: 35,
      head: head,
      body: body,
      theme: "grid",
      headStyles: {
        fillColor: [30, 58, 138],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: "bold",
        halign: "center",
      },
      styles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 45 },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index >= 2) {
          data.cell.styles.halign = "center";
          const val = data.cell.raw;
          if (val === "-") data.cell.styles.textColor = [180, 180, 180];
          if (data.column.index === head[0].length - 1 && val !== "-") {
            const num = parseFloat(val as string);
            if (num < 5) {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fontStyle = "bold";
            } else {
              data.cell.styles.textColor = [22, 163, 74];
              data.cell.styles.fontStyle = "bold";
            }
          }
        }
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 6 : 160;
    if (classTotalStudentsWithNotes > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 58, 138);
      doc.text("Statistiques Globales de la Classe", 14, finalY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const classAvg = (classTotalPoints / classTotalStudentsWithNotes).toFixed(2);
      const successRate = ((successCount / classTotalStudentsWithNotes) * 100).toFixed(1);

      doc.text(`• Effectif évalué : ${classTotalStudentsWithNotes} / ${students.length}`, 14, finalY + 4);
      doc.text(`• Moyenne générale : ${classAvg} / 10`, 14, finalY + 8);
      doc.text(`• Plus forte moyenne : ${highestAverage.toFixed(2)} / 10`, 85, finalY + 4);
      doc.text(`• Plus faible moyenne : ${lowestAverage.toFixed(2)} / 10`, 85, finalY + 8);
      doc.text(`• Taux de réussite (≥ 5.0) : ${successRate}%`, 160, finalY + 4);
    }

    const sigY = Math.min(finalY + 20, 185);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text("Signature du Professeur / Titulaire", 30, sigY);
    doc.line(30, sigY + 2, 95, sigY + 2);

    doc.text("Direction des Études / Sceau", 195, sigY);
    doc.line(195, sigY + 2, 265, sigY + 2);

    addSecurityWatermark(doc, { user, ipAddress });
    doc.save(`Journal_${currentClass?.name}_${selectedTerm.replace(/\s+/g, "_")}.pdf`);
  };

  return (
    <div className="space-y-3.5 max-w-7xl mx-auto pb-16 px-2 sm:px-4">
      {/* 1. EN-TÊTE PRINCIPAL ULTRA-COMPACT */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-xs border border-slate-200/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-xs border border-slate-800 shrink-0">
            <ClipboardCheck size={20} className="text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight font-serif">
                Journal des Évaluations
              </h2>
              {activeCampusName && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[11px] font-bold border border-blue-200">
                  <Building2 size={11} />
                  <span>{activeCampusName}</span>
                </span>
              )}
            </div>
            <p className="text-slate-500 font-medium text-xs">
              Calcul automatique et scellage sécurisé des notes
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {/* Campus Switcher (if multi-campus) - Harmonisé en style Pilule SelectPill */}
          {campuses && campuses.length > 0 && !user.campus_id && (user.role === 'SUPER_ADMIN' || user.role === 'DIRECTOR') && (
            <div className="w-full sm:w-auto min-w-[180px] sm:min-w-[210px]">
              <SelectPill
                options={campusSelectOptions}
                value={currentCampusId || ''}
                onChange={(val) => setCurrentCampusId(val || null)}
                variant="compact"
                size="sm"
                colorScheme="blue"
                icon={Building2}
                placeholder="Sélectionner un campus..."
                className="w-full"
              />
            </div>
          )}

          {/* Bouton Mode Plein Écran */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`px-3 py-1.5 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5 border shadow-xs cursor-pointer ${
              isFullscreen
                ? "bg-slate-900 text-white border-slate-700"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
            }`}
            title="Basculer en mode plein écran (Focus saisie des notes)"
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span className="hidden sm:inline">{isFullscreen ? "Quitter Plein Écran" : "Plein Écran"}</span>
          </button>

          <button
            onClick={exportJournalPDF}
            disabled={!selectedClassId || students.length === 0}
            className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 border border-blue-200/60 shadow-2xs cursor-pointer"
            title="Imprimer le journal au format PDF paysage"
          >
            <Download size={14} />
            <span className="hidden sm:inline">PDF</span>
          </button>

          <button
            onClick={exportJournalExcel}
            disabled={!selectedClassId || students.length === 0}
            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 border border-emerald-200/60 shadow-2xs cursor-pointer"
            title="Exporter les notes vers Excel"
          >
            <FileSpreadsheet size={14} />
            <span className="hidden sm:inline">Excel</span>
          </button>

          <button
            onClick={() => {
              fetchRefs();
              loadGradeContext();
            }}
            className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-600 rounded-xl hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all active:rotate-180 shrink-0 cursor-pointer shadow-2xs"
            title="Recharger le contexte"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-blue-600" : ""} />
          </button>
        </div>
      </div>

      {/* 2. FILTRES DE CONTEXTE CONDENSÉS (STYLE PILULE HARMONISÉ) */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-xs border border-slate-200/90 space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Année Académique */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Calendar size={12} className="text-blue-500" />
              <span>Année Académique</span>
            </label>
            <AcademicSessionPill
              academicYears={academicYears}
              selectedYearId={selectedYearId}
              onSelectYear={(yearId) => setSelectedYearId(yearId)}
              variant="field"
              size="sm"
              colorScheme="blue"
            />
          </div>

          {/* Classe */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <GraduationCap size={12} className="text-blue-500" />
                <span>{terminology?.class || "Classe"}</span>
              </label>
              {selectedClassObj && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                  {classLevelKey}
                </span>
              )}
            </div>
            <ClassSelectorPill
              classes={classes}
              selectedClassId={selectedClassId}
              onSelectClass={(classId) => setSelectedClassId(classId === "all" ? (classes[0]?.id || "") : classId)}
              allowAll={false}
              labelPrefix=""
              variant="field"
              size="sm"
              colorScheme="blue"
            />
          </div>

          {/* Matière */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Layers size={12} className="text-blue-500" />
                <span>{terminology?.subject || "Matière"}</span>
              </label>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                {subjects.length} assignée(s)
              </span>
            </div>
            <SubjectSelectorPill
              subjects={subjects}
              selectedSubjectId={selectedSubjectId}
              onSelectSubject={(subjectId) => setSelectedSubjectId(subjectId)}
              allLabel={`✨ Toutes les matières (${subjects.length})`}
              labelPrefix=""
              variant="field"
              size="sm"
              colorScheme="blue"
            />
          </div>
        </div>

        {/* Période d'évaluation / Contrôles - Harmonisation Pilule Complète */}
        <div className="pt-3 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 shrink-0">
              <FileText size={12} className="text-blue-500" />
              <span>{school?.school_type === SchoolType.UNIVERSITY ? 'Session :' : 'Évaluation :'}</span>
            </span>

            {/* Sélecteur Déroulant de type Pilule (SelectPill fluide) */}
            <div className="w-full sm:w-auto min-w-[220px] max-w-full sm:max-w-xs flex-1">
              <SelectPill
                options={termSelectOptions}
                value={isCustomTermMode ? "__CUSTOM__" : selectedTerm}
                onChange={(val) => {
                  if (val === "__CUSTOM__") {
                    setIsCustomTermMode(true);
                  } else {
                    setIsCustomTermMode(false);
                    setSelectedTerm(val);
                  }
                }}
                variant="field"
                size="sm"
                colorScheme="blue"
                icon={FileText}
                placeholder="Choisir une période..."
                searchable={examsList.length > 6}
                className="w-full"
              />
            </div>

            {/* Puces / Pilules de sélection rapide en 1 clic */}
            {!isCustomTermMode && (
              <div className="hidden sm:flex flex-wrap items-center gap-1.5">
                {examsList.slice(0, 4).map((exam) => (
                  <button
                    key={exam}
                    type="button"
                    onClick={() => setSelectedTerm(exam)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                      selectedTerm === exam
                        ? "bg-blue-600 text-white ring-2 ring-blue-400/30 shadow-xs"
                        : "bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/80"
                    }`}
                  >
                    <span>{exam}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Champ personnalisé si mode custom */}
            {isCustomTermMode && (
              <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                <input
                  type="text"
                  value={selectedTerm}
                  onChange={(e) => setSelectedTerm(e.target.value)}
                  placeholder="Nom de l'évaluation personnalisée..."
                  className="px-3.5 py-1.5 text-xs border border-blue-400 rounded-xl font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs min-w-[200px]"
                />
                <button
                  type="button"
                  onClick={() => setIsCustomTermMode(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 font-bold border border-slate-200 cursor-pointer shadow-2xs"
                >
                  Annuler
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsCustomTermMode(!isCustomTermMode)}
            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer self-start lg:self-auto shrink-0"
          >
            {isCustomTermMode ? "↩ Revenir aux évaluations standards" : "+ Autre nom d'évaluation..."}
          </button>
        </div>
      </div>

      {/* 3. MINI-KPIS CONDENSÉS EN UNE LIGNE */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/90 shadow-xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <User size={15} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase truncate">Effectif</p>
            <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">
              {kpiStats.studentCount} Élève(s)
            </p>
          </div>
        </div>

        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/90 shadow-xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <TrendingUp size={15} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase truncate">Moyenne Classe</p>
            <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">
              {kpiStats.classAvg}
            </p>
          </div>
        </div>

        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/90 shadow-xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Percent size={15} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase truncate">Taux de Réussite</p>
            <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">
              {kpiStats.successRate}
            </p>
          </div>
        </div>

        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/90 shadow-xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={15} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase truncate">Saisie Globale</p>
            <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">
              {kpiStats.filledCount} / {kpiStats.totalCells} ({kpiStats.percentageFilled}%)
            </p>
          </div>
        </div>
      </div>

      {/* 4. BARRE D'OUTILS, COMMANDES D'AFFICHAGE & RECHERCHE */}
      <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <div className="relative flex-1 min-w-[140px] sm:min-w-[220px] max-w-sm sm:max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher un élève par nom ou matricule..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all shadow-2xs"
            />
          </div>

          {/* Sélecteur de pagination par page - Harmonisé en Pilule */}
          <div className="hidden md:flex items-center gap-1 bg-slate-50 border border-slate-200/90 rounded-xl p-1 text-[11px] font-medium text-slate-600 shrink-0 shadow-2xs">
            <span className="px-1.5 text-slate-400 font-bold text-[10px] uppercase">Par page:</span>
            {[15, 25, 50].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setItemsPerPage(num)}
                className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                  itemsPerPage === num
                    ? "bg-white text-blue-600 font-black shadow-xs border border-slate-200"
                    : "hover:text-slate-900 font-bold"
                }`}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setItemsPerPage("ALL")}
              className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                itemsPerPage === "ALL"
                  ? "bg-white text-blue-600 font-black shadow-xs border border-slate-200"
                  : "hover:text-slate-900 font-bold"
              }`}
            >
              Tous
            </button>
          </div>

          {/* Sélecteur de Hauteur de Vue - Harmonisé en Pilule */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-50 border border-slate-200/90 rounded-xl p-1 text-[11px] font-medium text-slate-600 shrink-0 shadow-2xs">
            <span className="px-1.5 text-slate-400 font-bold text-[10px] uppercase">Hauteur:</span>
            <button
              type="button"
              onClick={() => setTableHeightMode("adaptive")}
              className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                tableHeightMode === "adaptive"
                  ? "bg-white text-blue-600 font-black shadow-xs border border-slate-200"
                  : "hover:text-slate-900 font-bold"
              }`}
              title="Hauteur adaptée automatiquement à votre écran"
            >
              Écran
            </button>
            <button
              type="button"
              onClick={() => setTableHeightMode("fixed-500")}
              className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                tableHeightMode === "fixed-500"
                  ? "bg-white text-blue-600 font-black shadow-xs border border-slate-200"
                  : "hover:text-slate-900 font-bold"
              }`}
              title="Hauteur fixe compacte (500px)"
            >
              500px
            </button>
            <button
              type="button"
              onClick={() => setTableHeightMode("fixed-750")}
              className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                tableHeightMode === "fixed-750"
                  ? "bg-white text-blue-600 font-black shadow-xs border border-slate-200"
                  : "hover:text-slate-900 font-bold"
              }`}
              title="Hauteur fixe large (750px - Idéal pour grands écrans)"
            >
              750px
            </button>
            <button
              type="button"
              onClick={() => setTableHeightMode("full")}
              className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                tableHeightMode === "full"
                  ? "bg-white text-blue-600 font-black shadow-xs border border-slate-200"
                  : "hover:text-slate-900 font-bold"
              }`}
              title="Afficher tous les élèves sans barre de défilement interne"
            >
              Tous
            </button>
          </div>

          {/* Aide Navigation Raccourcis Clavier Compacte */}
          <div className="relative group shrink-0">
            <button
              type="button"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 text-xs font-bold transition-all shadow-2xs cursor-pointer"
              title="Touches rapides de navigation clavier"
            >
              <Keyboard size={13} className="text-blue-600 shrink-0" />
              <span className="text-[11px]">Raccourcis</span>
            </button>
            <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover:flex group-focus-within:flex flex-col z-30 bg-slate-900 text-white text-[11px] p-2.5 rounded-xl shadow-xl border border-slate-800 whitespace-nowrap min-w-[210px] pointer-events-none">
              <span className="font-bold text-blue-400 mb-1 flex items-center gap-1">
                <Keyboard size={12} /> Navigation clavier :
              </span>
              <div className="space-y-1 text-slate-300">
                <div><kbd className="px-1 py-0.2 bg-slate-800 border border-slate-700 rounded text-[10px] text-white">Entrée</kbd> / <kbd className="px-1 py-0.2 bg-slate-800 border border-slate-700 rounded text-[10px] text-white">↓</kbd> Ligne suiv.</div>
                <div><kbd className="px-1 py-0.2 bg-slate-800 border border-slate-700 rounded text-[10px] text-white">Tab</kbd> / <kbd className="px-1 py-0.2 bg-slate-800 border border-slate-700 rounded text-[10px] text-white">→</kbd> Matière suiv.</div>
                <div><kbd className="px-1 py-0.2 bg-slate-800 border border-slate-700 rounded text-[10px] text-white">Ctrl+S</kbd> Sceller les notes</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {unsavedCount > 0 && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold border border-amber-200 animate-pulse">
              <AlertCircle size={12} />
              <span>{unsavedCount} modif(s) non scellée(s)</span>
            </span>
          )}

          {!isReadOnly && (
            <button
              onClick={handleSaveGrades}
              disabled={saving}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 size={13} className="animate-spin text-blue-400" />
                  <span>Scellage...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={14} className="text-emerald-400" />
                  <span>Sceller les Notes</span>
                  <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">(Ctrl+S)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 5. GRILLE DE NOTATION ERGONOMIQUE & ADAPTATIVE */}
      <div
        className={`bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden flex flex-col transition-all ${
          isFullscreen
            ? "fixed inset-0 z-50 rounded-none border-0 shadow-2xl p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md flex flex-col"
            : ""
        }`}
      >
        {/* Barre d'en-tête spécifique au Mode Plein Écran */}
        {isFullscreen && (
          <div className="bg-slate-900 text-white p-3 rounded-t-xl border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                <ClipboardCheck size={16} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <span>{selectedClassObj?.name || "Classe"}</span>
                  <span className="text-slate-400 font-normal text-xs">• {selectedTerm}</span>
                  {activeCampusName && (
                    <span className="text-[10px] px-2 py-0.5 bg-indigo-900/60 text-indigo-300 rounded border border-indigo-700/60">
                      {activeCampusName}
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Mode plein écran actif • Saisie ultra-rapide (Ctrl+S pour sceller • Échap pour quitter)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative max-w-xs">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher élève..."
                  className="pl-7 pr-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 focus:bg-slate-900 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {unsavedCount > 0 && (
                <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 rounded-lg text-xs font-bold border border-amber-500/40 animate-pulse">
                  {unsavedCount} modif(s)
                </span>
              )}

              {!isReadOnly && (
                <button
                  onClick={handleSaveGrades}
                  disabled={saving}
                  className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={14} />}
                  <span>Sceller</span>
                </button>
              )}

              <button
                onClick={() => setIsFullscreen(false)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-700"
                title="Quitter le plein écran (Échap)"
              >
                <Minimize2 size={13} />
                <span>Quitter</span>
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <Loader2 size={32} className="animate-spin text-blue-600" />
            <p className="text-xs font-semibold text-slate-500">Chargement de la grille des évaluations...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-20 text-center px-4 space-y-2">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
              <User size={24} />
            </div>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Aucun élève trouvé pour les critères sélectionnés
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Vérifiez que la classe sélectionnée contient des élèves actifs pour l'année académique en cours.
            </p>
          </div>
        ) : (
          <div
            className={`overflow-auto relative w-full ${
              isFullscreen
                ? "flex-1 max-h-[calc(100vh-140px)] bg-slate-900"
                : tableHeightMode === "adaptive"
                  ? "max-h-[calc(100vh-290px)] min-h-[460px]"
                  : tableHeightMode === "fixed-500"
                    ? "h-[500px]"
                    : tableHeightMode === "fixed-750"
                      ? "h-[750px]"
                      : "h-auto max-h-none"
            }`}
          >
            <table className="w-full text-left border-collapse text-xs">
              {/* EN-TÊTE FIXÉ (STICKY) */}
              <thead className="bg-slate-900 text-white sticky top-0 z-20 shadow-md">
                <tr>
                  {/* Colonne 1: N° (Sticky) */}
                  <th className="py-2.5 px-2 font-bold uppercase tracking-wider text-center w-10 sticky left-0 z-30 bg-slate-950 border-r border-slate-800 select-none">
                    N°
                  </th>
                  {/* Colonne 2: NOM & PRÉNOM (Sticky) */}
                  <th className="py-2.5 px-3.5 font-bold uppercase tracking-wider min-w-[200px] max-w-[240px] sticky left-10 z-30 bg-slate-950 border-r border-slate-800 shadow-md select-none">
                    Nom & Prénom
                  </th>
                  {/* Colonnes Matières */}
                  {activeColumns.map((col) => {
                    const isColFocused = focusedCell?.columnId === col.id;
                    return (
                      <th
                        key={col.id}
                        className={`py-2 px-2.5 font-bold text-center border-r border-slate-800 min-w-[105px] max-w-[145px] select-none transition-colors ${
                          isColFocused
                            ? "bg-blue-800 text-white ring-2 ring-blue-400 z-10 shadow-inner"
                            : "bg-slate-900 text-slate-100"
                        }`}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <span
                            className="truncate max-w-[125px] font-bold text-xs"
                            title={`${col.name} (Coef: ${col.coefficient} • Sur ${col.maxScore})`}
                          >
                            {col.name}
                          </span>
                          <div className="flex items-center gap-1 text-[10px] text-slate-300 font-normal">
                            <span className="px-1 py-0.2 bg-slate-800 rounded text-[9px] font-semibold text-slate-300">
                              Coef: {col.coefficient}
                            </span>
                            <span>•</span>
                            <span className="text-blue-300 font-semibold">
                              /{col.maxScore}
                            </span>
                          </div>
                          {/* Bouton d'attribution massive rapide */}
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => {
                                setBulkFillTargetCol(col.id);
                                setBulkFillScore("");
                              }}
                              className="mt-0.5 text-[9px] text-slate-400 hover:text-blue-300 underline font-normal"
                              title={`Attribuer une note identique à toute la classe en ${col.name}`}
                            >
                              Attribuer à tous
                            </button>
                          )}
                        </div>
                      </th>
                    );
                  })}
                  {/* Colonne Finale: Moyenne (Sticky Right) */}
                  <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-center w-28 sticky right-0 z-20 bg-slate-950 border-l border-slate-800 shadow-md">
                    Moyenne (/10)
                  </th>
                </tr>
              </thead>

              {/* CORPS DE LA GRILLE */}
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedStudents.map((student, sIdx) => {
                  const globalIndex = startIndex + sIdx;
                  // Calculer la moyenne en direct de cet élève
                  let totalPoints = 0;
                  let totalCoef = 0;
                  activeColumns.forEach((col) => {
                    const val = gridData[student.id]?.[col.id];
                    if (val !== "" && val !== undefined && !isNaN(parseFloat(val))) {
                      const note = parseFloat(val);
                      totalPoints += (note / col.maxScore) * 10 * col.coefficient;
                      totalCoef += col.coefficient;
                    }
                  });
                  const studentAvg = totalCoef > 0 ? (totalPoints / totalCoef).toFixed(2) : null;
                  const isPassing = studentAvg !== null && parseFloat(studentAvg) >= 5.0;
                  const isRowFocused = focusedCell?.studentId === student.id;

                  const rowPadding = density === "compact" ? "py-1.5" : "py-2.5";
                  const inputHeight = density === "compact" ? "h-7 sm:h-7.5" : "h-8 sm:h-9";

                  return (
                    <tr
                      key={student.id}
                      className={`transition-colors ${
                        isRowFocused
                          ? "bg-blue-50/90 ring-1 ring-blue-300/80 font-medium"
                          : sIdx % 2 === 0
                            ? "bg-white hover:bg-slate-50/80"
                            : "bg-slate-50/40 hover:bg-slate-100/70"
                      }`}
                    >
                      {/* Numéro (Sticky Left) */}
                      <td
                        className={`${rowPadding} px-2 text-center font-mono text-xs sticky left-0 z-10 border-r border-slate-200 ${
                          isRowFocused
                            ? "bg-blue-100/80 text-blue-950 font-bold"
                            : sIdx % 2 === 0
                              ? "bg-white text-slate-400"
                              : "bg-slate-50 text-slate-400"
                        }`}
                      >
                        {globalIndex}
                      </td>

                      {/* Nom & Prénom + Matricule (Sticky Left) */}
                      <td
                        className={`${rowPadding} px-3 font-medium sticky left-10 z-10 border-r border-slate-200 shadow-sm ${
                          isRowFocused
                            ? "bg-blue-100/80 text-blue-950"
                            : sIdx % 2 === 0
                              ? "bg-white"
                              : "bg-slate-50"
                        }`}
                      >
                        <div className="flex flex-col">
                          <span
                            className={`text-xs truncate max-w-[200px] ${
                              isRowFocused
                                ? "font-extrabold text-blue-950"
                                : "font-bold text-slate-900"
                            }`}
                            title={formatStudentName(student.last_name, student.first_name).fullName}
                          >
                            {formatStudentName(student.last_name, student.first_name).fullName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {student.matricule || "Sans matricule"}
                          </span>
                        </div>
                      </td>

                      {/* Notes par matière */}
                      {activeColumns.map((col, cIdx) => {
                        const cellValue = gridData[student.id]?.[col.id] || "";
                        const existing = existingGrades.find(
                          (g) =>
                            g.student_id === student.id &&
                            g.subject_id === col.subjectId &&
                            (col.courseEvaluationId
                              ? g.course_evaluation_id === col.courseEvaluationId
                              : !g.course_evaluation_id)
                        );
                        const isSealed = existing?.is_sealed;
                        const isLockedForTeacher = user.role === "TEACHER" && isSealed;
                        const numVal = parseFloat(cellValue);
                        const isPassingGrade = !isNaN(numVal) && (numVal / col.maxScore) * 10 >= 5.0;
                        const isColFocused = focusedCell?.columnId === col.id;

                        return (
                          <td
                            key={col.id}
                            className={`${rowPadding} px-1.5 text-center border-r border-slate-100 ${
                              isColFocused ? "bg-blue-50/30" : ""
                            }`}
                          >
                            <div className="relative flex items-center justify-center">
                              <input
                                id={`grade-${student.id}-${col.id}`}
                                type="text"
                                inputMode="decimal"
                                value={cellValue}
                                disabled={isReadOnly || isLockedForTeacher}
                                onChange={(e) =>
                                  handleScoreChange(
                                    student.id,
                                    col.id,
                                    e.target.value,
                                    col.maxScore,
                                    col.name,
                                  )
                                }
                                onKeyDown={(e) => handleKeyDown(e, sIdx, cIdx)}
                                onFocus={(e) => {
                                  e.target.select();
                                  setFocusedCell({ studentId: student.id, columnId: col.id });
                                }}
                                onBlur={() => setFocusedCell(null)}
                                placeholder="-"
                                className={`w-14 sm:w-16 ${inputHeight} text-center text-xs font-bold rounded-lg border transition-all focus:outline-hidden ${
                                  cellValue === ""
                                    ? "bg-slate-50 border-slate-200 text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                                    : isPassingGrade
                                      ? "bg-emerald-50/80 border-emerald-300 text-emerald-800 font-bold focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400"
                                      : "bg-red-50/80 border-red-300 text-red-700 font-bold focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-400"
                                } ${isLockedForTeacher ? "opacity-75 cursor-not-allowed bg-slate-100" : ""}`}
                              />
                              {isSealed && (
                                <span
                                  className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer"
                                  title={isAdmin ? "Note scellée (Cliquer pour déverrouiller)" : "Note scellée"}
                                  onClick={() => isAdmin && existing && unlockSingleGrade(existing.id)}
                                >
                                  <Lock size={10} className="text-slate-400 hover:text-blue-600" />
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      {/* Moyenne Générale (Sticky Right) */}
                      <td
                        className={`${rowPadding} px-3 text-center border-l border-slate-200 font-mono font-bold text-xs sticky right-0 z-10 shadow-sm ${
                          isRowFocused
                            ? "bg-blue-100/80"
                            : sIdx % 2 === 0
                              ? "bg-white"
                              : "bg-slate-50"
                        }`}
                      >
                        {studentAvg !== null ? (
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                              isPassing
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : "bg-red-100 text-red-700 border border-red-300"
                            }`}
                          >
                            {studentAvg}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-normal">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* BARRE DE CONTRÔLE DE PAGINATION (STYLE PILULE) */}
        {filteredStudents.length > 0 && itemsPerPage !== "ALL" && totalPages > 1 && (
          <div className="bg-white px-4 py-2.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-slate-600 font-medium">
              Affichage des élèves <span className="font-bold text-slate-900">{startIndex}</span> à{" "}
              <span className="font-bold text-slate-900">{endIndex}</span> sur{" "}
              <span className="font-bold text-slate-900">{filteredStudents.length}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <ChevronLeft size={13} />
                <span className="hidden sm:inline">Précédent</span>
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  // Show current, first, last, and immediate neighbors
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`w-7 h-7 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          currentPage === page
                            ? "bg-blue-600 text-white shadow-2xs"
                            : "text-slate-600 hover:bg-slate-100 border border-slate-200"
                        }`}
                      >
                        {page}
                      </button>
                    );
                  } else if (
                    (page === currentPage - 2 && page > 1) ||
                    (page === currentPage + 2 && page < totalPages)
                  ) {
                    return (
                      <span key={page} className="px-1 text-slate-400 text-xs">
                        ...
                      </span>
                    );
                  }
                  return null;
                })}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <span className="hidden sm:inline">Suivant</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* PIED DE PAGE LÉGENDE */}
        <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-2 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              <span>≥ Moyenne (Succès)</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
              <span>&lt; Moyenne (À renforcer)</span>
            </span>
            <span className="flex items-center gap-1">
              <Lock size={11} className="text-slate-400" />
              <span>Scellé</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-slate-400 hidden sm:inline">
              {filteredStudents.length} élève(s) affiché(s) • Raccourci: Ctrl+S
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              EDUNOVA PRO • MULTI-TENANT & CAMPUS READY
            </span>
          </div>
        </div>
      </div>

      {/* MODALE D'ATTRIBUTION MASSIVE (BULK FILL) */}
      {bulkFillTargetCol && (
        <Modal
          isOpen={true}
          onClose={() => setBulkFillTargetCol(null)}
          title={`Attribution massive : ${columns.find((c) => c.id === bulkFillTargetCol)?.name}`}
        >
          <div className="space-y-4 p-1">
            <p className="text-xs text-slate-600">
              Saisissez une note à attribuer automatiquement à tous les élèves de la classe pour cette matière :
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Note à attribuer (Sur {columns.find((c) => c.id === bulkFillTargetCol)?.maxScore || 100})
              </label>
              <input
                type="number"
                step="0.25"
                value={bulkFillScore}
                onChange={(e) => setBulkFillScore(e.target.value)}
                placeholder="Ex: 85"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBulkFillTargetCol(null)}
                className="px-3.5 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => handleApplyBulkFill(bulkFillTargetCol, bulkFillScore)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                Appliquer à tous
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default GradesView;
