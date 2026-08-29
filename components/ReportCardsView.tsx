import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fixOklchForCanvas } from '../utils/pdfFix';
import {
  Files,
  ChevronDown,
  Printer,
  User,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ArrowLeft,
  Search,
  Users,
  Loader2,
  Sparkles,
  FileSpreadsheet,
  Trophy,
  Building2,
  Calendar,
  Layers,
  ShieldCheck,
  Award,
  SlidersHorizontal,
  CheckCircle,
  HelpCircle,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import { useSchool } from '../contexts/SchoolContext';
import { PrintPreviewModal } from './PrintPreviewModal';
import { UserProfile, SchoolCampus } from '../types';
import { useSecurity } from './SecurityGuard';
import { addSecurityWatermark } from '../utils/pdfWatermark';
import { formatStudentName, getDefiniteArticle } from '../utils/formatters';
import { getExamsListForClass } from '../lib/evaluations';
import { ReportCardItem, getMention, getDecision } from './report-cards/ReportCardItem';
import { PalmaresView } from './report-cards/PalmaresView';
import { ReportCardStudent, ReportCardOptions } from './report-cards/types';
import { AcademicSessionPill } from './AcademicSessionPill';

const ReportCardsView: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { ipAddress } = useSecurity();
  const { terminology, currentCampusId, setCurrentCampusId, campuses } = useSchool();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [school, setSchool] = useState<any>(null);

  // Form selections
  const [generationMode, setGenerationMode] = useState<'class' | 'student'>('class');
  const [selectedYearId, setSelectedYearId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [term, setTerm] = useState('1er Contrôle');

  // Generation options
  const [reportOptions, setReportOptions] = useState<ReportCardOptions>({
    showRank: true,
    showClassAverage: true,
    showQrCode: true,
    showStamp: true,
    showDecision: true,
    showHonorsBadge: true,
    density: 'auto',
    colorTheme: 'navy',
    colorMode: 'monochrome'
  });

  // Readiness state
  const [gradeReadiness, setGradeReadiness] = useState<{ totalStudents: number; gradedStudents: number; isReady: boolean; totalGradesCount: number }>({
    totalStudents: 0,
    gradedStudents: 0,
    isReady: false,
    totalGradesCount: 0
  });
  const [checkingReadiness, setCheckingReadiness] = useState(false);

  // Preview & Export state
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [activeSubView, setActiveSubView] = useState<'bulletins' | 'palmares'>('bulletins');
  const [generatedData, setGeneratedData] = useState<ReportCardStudent[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const selectedYearLabel = academicYears.find(y => y.id === selectedYearId)?.label || '';
  const hasMultipleCampuses = campuses && campuses.length > 1;
  const currentCampusObj = hasMultipleCampuses ? campuses.find(c => c.id === currentCampusId) : null;
  const activeCampusName = hasMultipleCampuses
    ? (currentCampusObj ? currentCampusObj.name : 'Tous les Campus')
    : undefined;

  const availableExams = React.useMemo(() => {
    const currentCls = classes.find((c) => c.id === selectedClassId);
    return getExamsListForClass(currentCls, school?.school_type);
  }, [classes, selectedClassId, school]);

  useEffect(() => {
    if (selectedClassId && availableExams.length > 0 && !availableExams.includes(term)) {
      setTerm(availableExams[0]);
    }
  }, [availableExams, selectedClassId, term]);

  // Initial Reference Fetch
  const fetchRefs = useCallback(async () => {
    setLoading(true);
    try {
      const [ayRes, schoolRes] = await Promise.all([
        supabase.from('academic_years').select('*').eq('school_id', user.school_id).order('label', { ascending: false }),
        supabase.from('schools').select('*').eq('id', user.school_id).maybeSingle()
      ]);

      if (schoolRes.data) {
        setSchool(schoolRes.data);
      }

      if (ayRes.data) {
        const finalYears = ayRes.data.filter(y => y.status !== 'VIERGE' && y.status !== 'FUTURE');
        setAcademicYears(finalYears);
        if (finalYears.length > 0) {
          const active = finalYears.find(y => y.is_active || y.status === 'ACTIVE') || finalYears[0];
          setSelectedYearId(active.id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user.school_id]);

  useEffect(() => {
    fetchRefs();
  }, [fetchRefs]);

  // Fetch Classes scoped by academic year, campus, and school
  useEffect(() => {
    const fetchClassesForYear = async () => {
      if (!selectedYearId || !user.school_id) return;

      try {
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('class_id')
          .eq('school_id', user.school_id)
          .eq('academic_year_id', selectedYearId);

        const activeClassIds = Array.from(new Set((enrollments || []).map(e => e.class_id).filter(Boolean)));

        let classesQuery = supabase
          .from('classes')
          .select('*')
          .eq('school_id', user.school_id);

        if (activeClassIds.length > 0) {
          classesQuery = classesQuery.in('id', activeClassIds);
        }

        if (currentCampusId) {
          classesQuery = classesQuery.eq('campus_id', currentCampusId);
        }

        const { data: cls } = await classesQuery.order('name');
        const finalCls = cls || [];
        setClasses(finalCls);

        if (finalCls.length > 0) {
          setSelectedClassId(prevId => {
            if (prevId && finalCls.some(c => c.id === prevId)) {
              return prevId;
            }
            return finalCls[0].id;
          });
        } else {
          setSelectedClassId('');
        }
      } catch (err: any) {
        console.error("Error fetching classes:", err);
      }
    };

    fetchClassesForYear();
  }, [selectedYearId, user.school_id, currentCampusId]);

  // Fetch Students for selected class
  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedClassId || !user.school_id) {
        setStudents([]);
        return;
      }

      try {
        if (selectedYearId) {
          const { data: enrollData } = await supabase
            .from('enrollments')
            .select('student:students(*)')
            .eq('school_id', user.school_id)
            .eq('academic_year_id', selectedYearId)
            .eq('class_id', selectedClassId);

          let enrolledStudents = (enrollData || [])
            .map((e: any) => e.student)
            .filter((s: any) => s && (s.status === 'Actif' || s.status === 'ACTIF' || !s.status));

          if (currentCampusId) {
            enrolledStudents = enrolledStudents.filter((s: any) => !s.campus_id || s.campus_id === currentCampusId);
          }

          if (enrolledStudents.length > 0) {
            enrolledStudents.sort((a: any, b: any) => (a.last_name || '').localeCompare(b.last_name || ''));
            setStudents(enrolledStudents);
            return;
          }
        }

        // Fallback direct query
        let stQuery = supabase
          .from('students')
          .select('*')
          .eq('school_id', user.school_id)
          .eq('class_id', selectedClassId);

        if (currentCampusId) {
          stQuery = stQuery.eq('campus_id', currentCampusId);
        }

        const { data: directStudents } = await stQuery.order('last_name');
        setStudents(directStudents || []);
      } catch (err) {
        console.error("Error fetching students:", err);
      }
    };

    fetchStudents();
  }, [selectedClassId, selectedYearId, user.school_id, currentCampusId]);

  // Check Grade Completion & Readiness
  useEffect(() => {
    const checkClassReadiness = async () => {
      if (!selectedClassId || !term || students.length === 0) {
        setGradeReadiness({ totalStudents: students.length, gradedStudents: 0, isReady: false, totalGradesCount: 0 });
        return;
      }

      setCheckingReadiness(true);
      try {
        const studentIds = students.map(s => s.id);
        const { data: gradesData } = await supabase
          .from('grades')
          .select('student_id, score')
          .eq('school_id', user.school_id)
          .eq('term', term)
          .in('student_id', studentIds);

        const gradedStudentIds = new Set((gradesData || []).map(g => g.student_id));
        const countGraded = gradedStudentIds.size;
        const total = students.length;

        setGradeReadiness({
          totalStudents: total,
          gradedStudents: countGraded,
          isReady: countGraded === total && total > 0,
          totalGradesCount: (gradesData || []).length
        });
      } catch (err) {
        console.error("Readiness check error:", err);
      } finally {
        setCheckingReadiness(false);
      }
    };

    checkClassReadiness();
  }, [selectedClassId, term, students, user.school_id]);

  const studentResults = studentSearch.length > 1
    ? students.filter(s =>
        formatStudentName(s.last_name, s.first_name).fullName.toLowerCase().includes(studentSearch.toLowerCase()) ||
        (s.nisu && s.nisu.toLowerCase().includes(studentSearch.toLowerCase()))
      )
    : [];

  const handleTest18Subjects = () => {
    const mockSubjects = [
      { name: "Français & Littérature", coef: 4, note: 8.5 },
      { name: "Mathématiques Avancées", coef: 5, note: 7.0 },
      { name: "Anglais / Langue Vivante 1", coef: 3, note: 9.0 },
      { name: "Histoire & Géographie", coef: 3, note: 6.5 },
      { name: "Sciences de la Vie & Terre", coef: 2, note: 8.0 },
      { name: "Physique", coef: 3, note: 7.5 },
      { name: "Chimie Générale", coef: 2, note: 8.0 },
      { name: "Éducation Physique & Sportive", coef: 2, note: 9.5 },
      { name: "Arts Plastiques & Visuels", coef: 1, note: 8.0 },
      { name: "Éducation Musicale & Rythmique", coef: 1, note: 7.0 },
      { name: "Philosophie & Pensée Critique", coef: 2, note: 6.0 },
      { name: "Sciences Économiques & Sociales", coef: 3, note: 7.5 },
      { name: "Informatique & Algorithmique", coef: 2, note: 9.0 },
      { name: "Espagnol / LV2", coef: 2, note: 8.5 },
      { name: "Latin & Culture Antique", coef: 1, note: 7.0 },
      { name: "Créole Haïtien & Culture", coef: 2, note: 8.5 },
      { name: "Théâtre & Art Oratoire", coef: 1, note: 9.0 },
      { name: "Initiation au Droit & Civisme", coef: 2, note: 8.0 },
      { name: "Sociologie & Société", coef: 2, note: 7.5 },
      { name: "Projet Scientifique & Tech", coef: 2, note: 8.5 }
    ];

    const totalCoef = mockSubjects.reduce((acc, s) => acc + s.coef, 0);
    const totalPoints = mockSubjects.reduce((acc, s) => acc + s.note * s.coef, 0);
    const average = totalPoints / totalCoef;

    const isLastExamTest = availableExams.length > 0 && term === availableExams[availableExams.length - 1];

    const mockData: ReportCardStudent[] = [
      {
        id: 'test-20',
        name: "Jean-Baptiste Peterson",
        nisu: "EDU-2026-001",
        class: "NS IV (Terminale)",
        total: mockSubjects.reduce((acc, s) => acc + s.note, 0),
        totalCoef: totalCoef,
        average: average,
        annualAverage: isLastExamTest ? average + 0.5 : average,
        base: null,
        isMaxPointsSystem: false,
        isMaternelle: false,
        campusName: activeCampusName,
        grades: mockSubjects.map(s => {
          let termScores: Record<string, number | null> = {};
          if (isLastExamTest) {
            availableExams.forEach(ex => {
              termScores[ex] = Math.max(0, Math.min(10, s.note + (Math.random() * 2 - 1)));
            });
          }
          return {
            ...s,
            annualNote: isLastExamTest ? s.note + 0.5 : null,
            termScores: isLastExamTest ? termScores : null
          };
        }),
        place: "1er",
        classAverage: 7.45
      }
    ];

    setGeneratedData(mockData);
    setShowPreview(true);
    toast.info("Mode Test Super Admin : 20 matières simulées avec succès.");
  };

  const handleGenerate = async () => {
    if (generationMode === 'student' && !selectedStudent) {
      toast.error(`Veuillez sélectionner un ${terminology.student.toLowerCase()}.`);
      return;
    }
    if (!selectedClassId || !selectedYearId || !term) {
      toast.error("Veuillez sélectionner la classe, l'année et la période.");
      return;
    }

    setIsGenerating(true);
    try {
      // 1. Fetch subjects and coefficients
      const { data: subData } = await supabase
        .from('class_subjects')
        .select('subject_id, coefficient, subject:subjects(id, name)')
        .eq('class_id', selectedClassId);

      const classSubjects =
        subData?.map((s: any) => {
          const subj = Array.isArray(s.subject) ? s.subject[0] : s.subject;
          return {
            id: s.subject_id || subj?.id,
            name: subj?.name || 'Inconnu',
            coef: s.coefficient || 1
          };
        }) || [];

      // 2. Target students
      const targetStudents = students;
      if (targetStudents.length === 0) {
        toast.error(`Aucun ${terminology.student.toLowerCase()} trouvé pour cette sélection.`);
        return;
      }

      // 3. Fetch grades for all students
      const studentIds = targetStudents.map(s => s.id);
      let query = supabase
        .from('grades')
        .select('*')
        .eq('school_id', user.school_id)
        .in('student_id', studentIds);

      if (selectedYearId) {
        query = query.eq('academic_year_id', selectedYearId);
      }

      const isLastTerm = availableExams.length > 0 && term === availableExams[availableExams.length - 1];

      if (!isLastTerm) {
        query = query.eq('term', term);
      } else {
        query = query.in('term', availableExams);
      }

      let { data: gradeData, error: gradeError } = await query;

      if (gradeError && gradeError.code === '42703' && selectedYearId) {
        let fallbackQuery = supabase
          .from('grades')
          .select('*')
          .eq('school_id', user.school_id)
          .in('student_id', studentIds);

        if (!isLastTerm) {
          fallbackQuery = fallbackQuery.eq('term', term);
        } else {
          fallbackQuery = fallbackQuery.in('term', availableExams);
        }

        const fallback = await fallbackQuery;
        gradeData = fallback.data;
      }

      const currentClassObj = classes.find(c => c.id === selectedClassId);
      const classNameUpper = (currentClassObj?.name || '').toUpperCase();
      const classLevelUpper = (currentClassObj?.level || '').toUpperCase();
      const isMaternelle =
        classLevelUpper === 'MATERNELLE' ||
        classLevelUpper === 'PRESCOLAIRE' ||
        classNameUpper.includes('MATERNELLE') ||
        classNameUpper.includes('PETITE') ||
        classNameUpper.includes('MOYENNE') ||
        classNameUpper.includes('GRANDE') ||
        classNameUpper.includes('PRESCOLAIRE') ||
        classNameUpper.includes('PRE-K') ||
        classNameUpper.includes('KINDERGARTEN') ||
        classNameUpper.includes('GARDERIE');

      // 4. Calculate averages & scores
      const results: ReportCardStudent[] = targetStudents.map(student => {
        let totalPoints = 0;
        let totalCoef = 0;
        let sumOfNotes = 0;

        let annualTotalPoints = 0;
        let annualTotalCoef = 0;

        const isMaxPointsSystem = classSubjects.some(sub => sub.coef > 20);

        const studentGrades = classSubjects.map(sub => {
          const gradesForSubject = gradeData?.filter(g => g.student_id === student.id && g.subject_id === sub.id) || [];

          let note: number | null = null;
          let annualNote: number | null = null;
          let termScores: Record<string, number | null> = {};
          availableExams.forEach(ex => {
            termScores[ex] = null;
          });

          const grade = gradesForSubject.find(g => g.term === term);
          note = grade && grade.score !== undefined ? grade.score : null;

          if (isLastTerm) {
            const controls = gradesForSubject.filter(g => availableExams.includes(g.term));
            controls.forEach(c => {
              termScores[c.term] = c.score;
            });
            const controlsSum = controls.reduce((acc, g) => acc + g.score, 0);
            const divisor = controls.length > 0 ? controls.length : availableExams.length;
            annualNote = controlsSum / divisor;
          }

          if (note !== null) {
            sumOfNotes += note;
            totalCoef += sub.coef;
            totalPoints += isMaxPointsSystem ? note : note * sub.coef;
          }

          if (annualNote !== null) {
            annualTotalCoef += sub.coef;
            annualTotalPoints += isMaxPointsSystem ? annualNote : annualNote * sub.coef;
          }

          return {
            name: sub.name,
            coef: sub.coef,
            note: note,
            annualNote: annualNote,
            termScores: isLastTerm ? termScores : null
          };
        });

        let average = 0;
        if (totalCoef > 0) {
          average = isMaxPointsSystem ? (totalPoints / totalCoef) * 10 : totalPoints / totalCoef;
        }

        let annualAverage = 0;
        if (annualTotalCoef > 0) {
          annualAverage = isMaxPointsSystem ? (annualTotalPoints / annualTotalCoef) * 10 : annualTotalPoints / annualTotalCoef;
        }

        return {
          id: student.id,
          name: formatStudentName(student.last_name, student.first_name).fullName,
          nisu: student.nisu || 'N/A',
          class: currentClassObj?.name || '',
          total: sumOfNotes,
          totalCoef: totalCoef,
          average: average,
          annualAverage: annualAverage,
          base: isMaxPointsSystem ? 10 : null,
          isMaxPointsSystem: isMaxPointsSystem,
          isMaternelle: isMaternelle,
          campusName: activeCampusName,
          grades: studentGrades,
          place: '',
          classAverage: 0
        };
      });

      // 5. Ranking
      results.sort((a, b) => b.average - a.average);

      const classAverage = results.length > 0 ? results.reduce((acc, r) => acc + r.average, 0) / results.length : 0;

      let currentRank = 1;
      for (let i = 0; i < results.length; i++) {
        if (i > 0 && results[i].average === results[i - 1].average) {
          results[i].place = currentRank === 1 ? '1er ex' : `${currentRank}e ex`;
        } else {
          currentRank = i + 1;
          results[i].place = currentRank === 1 ? '1er' : `${currentRank}e`;
        }
        results[i].classAverage = classAverage;
      }

      const finalResults =
        generationMode === 'student' ? results.filter(r => r.id === selectedStudent.id) : results;

      setGeneratedData(finalResults);
      setShowPreview(true);
      toast.success(`${finalResults.length} bulletin(s) généré(s) avec succès.`);
    } catch (err) {
      console.error("Generation error:", err);
      toast.error("Erreur lors de la génération des bulletins.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDirectPrint = () => {
    window.focus();
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleExportPDF = async () => {
    if (!printRef.current || generatedData.length === 0) return;
    setIsExporting(true);
    const toastId = toast.loading("Préparation de l'exportation PDF Haute Résolution...");

    const container = printRef.current;
    const originalStyle = container.style.cssText;

    try {
      container.classList.remove('hidden');
      container.style.display = 'block';
      container.style.position = 'absolute';
      container.style.left = '0';
      container.style.top = '0';
      container.style.width = '794px';
      container.style.overflow = 'visible';
      container.style.height = 'auto';
      container.style.maxHeight = 'none';
      container.style.backgroundColor = '#ffffff';
      container.style.zIndex = '-9999';
      container.style.opacity = '1';
      container.style.pointerEvents = 'none';

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const children = Array.from(container.children) as HTMLElement[];
      const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      let renderedCount = 0;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (!child.classList.contains('font-serif') && !child.classList.contains('font-sans') && !child.classList.contains('report-card-printable')) {
          continue;
        }

        toast.loading(`Génération du bulletin ${renderedCount + 1} sur ${children.length}...`, { id: toastId });

        const originalChildStyle = child.style.cssText;
        child.style.display = 'flex';
        child.style.visibility = 'visible';
        child.style.opacity = '1';
        child.style.width = '794px';
        child.style.minHeight = '1123px';
        child.style.maxHeight = '1123px';
        child.style.boxSizing = 'border-box';
        child.style.margin = '0';
        child.style.backgroundColor = '#ffffff';
        child.style.position = 'relative';

        await wait(120);

        const canvas = await html2canvas(child, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: 794,
          height: 1123,
          windowWidth: 794,
          windowHeight: 1123,
          allowTaint: true,
          imageTimeout: 15000,
          onclone: clonedDoc => {
            fixOklchForCanvas(clonedDoc);
          }
        });

        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        child.style.cssText = originalChildStyle;

        if (renderedCount > 0) {
          pdf.addPage();
        }

        pdf.addImage(dataUrl, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
        renderedCount++;
        if (i % 2 === 0) await wait(30);
      }

      const classNameClean = classes.find(c => c.id === selectedClassId)?.name || 'Classe';
      const fileName = `Bulletins_${classNameClean.replace(/\s+/g, '_')}_${term.replace(/\s+/g, '_')}.pdf`;
      addSecurityWatermark(pdf, { user, ipAddress });
      pdf.save(fileName);
      toast.success("Document PDF officiel téléchargé avec succès !", { id: toastId });
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Une erreur est survenue lors de l'exportation.", { id: toastId });
    } finally {
      container.style.cssText = originalStyle;
      container.classList.add('hidden');
      setIsExporting(false);
    }
  };

  const handleExportPalmaresPDF = () => {
    if (generatedData.length === 0) return;

    const doc = new jsPDF();
    const className = classes.find(c => c.id === selectedClassId)?.name || '';

    doc.setFontSize(18);
    doc.setTextColor(30, 27, 75); // Navy-950
    doc.text(`Palmarès Officiel — ${className}`, 14, 20);

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(
      `Période : ${term} | Année Académique : ${selectedYearLabel} | Annexe / Campus : ${activeCampusName}`,
      14,
      27
    );
    doc.text(`Date d'Édition : ${new Date().toLocaleDateString('fr-FR')}`, 14, 33);

    const isLastExam = availableExams.length > 0 && term === availableExams[availableExams.length - 1];

    const tableData = generatedData.map(s => [
      s.place,
      s.name,
      s.nisu,
      s.average.toFixed(2),
      getMention(s.average, s.base || 10),
      isLastExam ? getDecision(s.annualAverage || s.average, s.base || 10) : '-'
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Rang', 'Nom & Prénom', 'Matricule (NISU)', 'Moyenne', 'Mention', 'Décision du Conseil']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 27, 75], textColor: [255, 255, 255] },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center' },
        3: { fontStyle: 'bold', halign: 'center' },
        5: { halign: 'center' }
      }
    });

    addSecurityWatermark(doc, { user, ipAddress });
    doc.save(`Palmares_${className.replace(/\s+/g, '_')}_${term.replace(/\s+/g, '_')}.pdf`);
    toast.success("Palmarès officiel exporté au format PDF.");
  };

  if (loading) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={44} />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
          Chargement du Module des Bulletins...
        </p>
      </div>
    );
  }

  // PREVIEW MODAL
  if (showPreview) {
    const customControls = (
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        {/* View Switcher (Bulletins vs Palmarès) */}
        <div className="inline-flex items-center bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <button
            onClick={() => setActiveSubView('bulletins')}
            className={`px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubView === 'bulletins' 
                ? 'bg-white text-indigo-600 shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Files size={13} className={activeSubView === 'bulletins' ? 'text-indigo-600' : 'text-slate-400'} />
            <span>Bulletins ({generatedData.length})</span>
          </button>
          <button
            onClick={() => setActiveSubView('palmares')}
            className={`px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubView === 'palmares' 
                ? 'bg-white text-indigo-600 shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Trophy size={13} className={activeSubView === 'palmares' ? 'text-indigo-600' : 'text-slate-400'} />
            <span>Palmarès & Stats</span>
          </button>
        </div>

        {/* Density Segmented Controls */}
        <div className="inline-flex items-center bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <button
            onClick={() => setReportOptions(prev => ({ ...prev, density: 'auto' }))}
            className={`px-2.5 py-1.5 text-[10.5px] font-bold rounded-lg transition-all ${
              reportOptions.density === 'auto' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Ajustement automatique"
          >
            Auto
          </button>
          <button
            onClick={() => setReportOptions(prev => ({ ...prev, density: 'dense' }))}
            className={`px-2.5 py-1.5 text-[10.5px] font-bold rounded-lg transition-all ${
              reportOptions.density === 'dense' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Pour 8 à 14 matières"
          >
            Dense
          </button>
          <button
            onClick={() => setReportOptions(prev => ({ ...prev, density: 'super-dense' }))}
            className={`px-2.5 py-1.5 text-[10.5px] font-bold rounded-lg transition-all ${
              reportOptions.density === 'super-dense' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Compact (15+ matières)"
          >
            18+ Mat.
          </button>
        </div>

        {generationMode === 'class' && (
          <button
            onClick={handleExportPalmaresPDF}
            className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-extrabold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 text-[10.5px] border border-slate-200 shadow-2xs hover:border-slate-300 uppercase tracking-wider shrink-0"
            title="Télécharger le palmarès de classe en PDF"
          >
            <FileSpreadsheet size={13} className="text-emerald-600" />
            <span>Palmarès</span>
          </button>
        )}
      </div>
    );

    return (
      <PrintPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title="Aperçu & Certification des Bulletins"
        subtitle={`${generationMode === 'student' ? `${terminology.student} Unique` : classes.find(c => c.id === selectedClassId)?.name} — ${term}${hasMultipleCampuses && activeCampusName ? ` (${activeCampusName})` : ''}`}
        onPrint={handleDirectPrint}
        onExportPDF={handleExportPDF}
        isExporting={isExporting}
        customControls={customControls}
      >
        <div className="w-full" ref={printRef}>
          <div className="w-full mx-auto flex flex-col items-center gap-10 print:gap-0 print:block">
            {activeSubView === 'bulletins' ? (
              generatedData.map((student, idx) => (
                <div key={student.id} className="w-full flex flex-col items-center gap-3 print:gap-0 print:block group">
                  <div className="bg-indigo-900 px-5 py-1.5 shadow-md text-[10px] font-black text-white rounded-full tracking-widest uppercase flex items-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity print:hidden">
                    <span>Bulletin {idx + 1} / {generatedData.length}</span>
                    <span className="h-3 w-px bg-white/30"></span>
                    <span>{student.name}</span>
                    <span className="h-3 w-px bg-white/30"></span>
                    <span className="text-indigo-200">{student.nisu}</span>
                  </div>
                  <div className="w-full max-w-[21cm] shadow-2xl rounded-2xl overflow-hidden transition-all duration-300 print:shadow-none print:rounded-none print:max-w-none print:overflow-visible">
                    <ReportCardItem
                      student={student}
                      term={term}
                      year={selectedYearLabel}
                      school={school}
                      campusName={hasMultipleCampuses ? activeCampusName : undefined}
                      isLast={idx === generatedData.length - 1}
                      options={reportOptions}
                      availableExams={availableExams}
                    />
                  </div>
                </div>
              ))
            ) : (
              <PalmaresView
                students={generatedData}
                classNameTitle={classes.find(c => c.id === selectedClassId)?.name || ''}
                term={term}
                yearLabel={selectedYearLabel}
                campusName={hasMultipleCampuses ? activeCampusName : undefined}
                onExportPalmares={handleExportPalmaresPDF}
                availableExams={availableExams}
              />
            )}
          </div>
        </div>
      </PrintPreviewModal>
    );
  }

  // MAIN GENERATOR HUB VIEW
  return (
    <div className="space-y-3.5 max-w-7xl mx-auto pb-16 px-2 sm:px-4 animate-in fade-in duration-300">
      {/* En-tête Principal Harmonisé avec le Système */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-xs border border-slate-200/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-xs border border-slate-800 shrink-0">
            <Files size={20} className="text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight font-serif">
                {school?.school_type === 'UNIVERSITE' || school?.school_type === 'SUPERIEUR' ? 'Relevés de Notes & Bulletins' : 'Édition des Bulletins'}
              </h2>
              {hasMultipleCampuses && activeCampusName && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[11px] font-bold border border-indigo-200">
                  <Building2 size={11} />
                  <span>{activeCampusName}</span>
                </span>
              )}
            </div>
            <p className="text-slate-500 font-medium text-xs">
              {school?.name || 'Établissement'} • Génération, calculs de moyennes et certification officielle
            </p>
          </div>
        </div>

        {/* Campus Switcher (only if multi-campus) */}
        {hasMultipleCampuses && (user.role === 'SUPER_ADMIN' || user.role === 'DIRECTOR') && (
          <div className="relative min-w-[200px] w-full md:w-auto">
            <select
              className="w-full bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-semibold pl-8 pr-8 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none transition-all"
              value={currentCampusId || ''}
              onChange={e => setCurrentCampusId(e.target.value || null)}
            >
              <option value="">Tous les Campus</option>
              {campuses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Building2 size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        )}
      </div>

      {/* Main Form Box */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Mode Segmented Switcher & Status Bar */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="inline-flex bg-slate-200/70 p-1 rounded-xl">
            <button
              onClick={() => {
                setGenerationMode('class');
                setSelectedStudent(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all ${
                generationMode === 'class' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users size={14} />
              <span>{terminology.class} Entière</span>
              <span className="ml-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold">
                {students.length}
              </span>
            </button>
            <button
              onClick={() => setGenerationMode('student')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all ${
                generationMode === 'student' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User size={14} />
              <span>{terminology.student} Unique</span>
            </button>
          </div>

          {/* Quick Readiness Badge */}
          <div className="flex items-center gap-2.5 text-xs">
            <span className="text-slate-500 font-medium">Saisie des notes :</span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs ${
              gradeReadiness.isReady ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {gradeReadiness.isReady ? <CheckCircle size={13} /> : <Clock size={13} />}
              {gradeReadiness.gradedStudents}/{gradeReadiness.totalStudents} notés
              {gradeReadiness.isReady && ' (100% Complet)'}
            </span>
          </div>
        </div>

        {/* Core Dropdowns Row */}
        <div className="p-5 sm:p-7 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">
            {/* Academic Year */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={13} className="text-indigo-600" />
                {terminology.academicYear || 'Année Académique'}
              </label>
              <AcademicSessionPill
                academicYears={academicYears}
                selectedYearId={selectedYearId}
                onSelectYear={(yearId) => setSelectedYearId(yearId)}
                variant="field"
                size="md"
                colorScheme="indigo"
              />
            </div>

            {/* Class */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={13} className="text-indigo-600" />
                {terminology.class || 'Classe'} & Section
              </label>
              <div className="relative">
                <select
                  className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-semibold text-xs text-slate-800 cursor-pointer appearance-none transition-all"
                  value={selectedClassId}
                  onChange={e => {
                    setSelectedClassId(e.target.value);
                    setSelectedStudent(null);
                  }}
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.level ? `(${c.level})` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>

            {/* Period / Exam Term */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={13} className="text-indigo-600" />
                {school?.school_type === 'UNIVERSITE' || school?.school_type === 'SUPERIEUR' ? 'Session / Examen' : 'Période / Évaluation'}
              </label>
              <div className="relative">
                <select
                  className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-semibold text-xs text-slate-800 cursor-pointer appearance-none transition-all"
                  value={term}
                  onChange={e => setTerm(e.target.value)}
                >
                  {availableExams.map(ex => (
                    <option key={ex} value={ex}>
                      {ex}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>
          </div>

          {/* Student Selector (in Single Mode) */}
          {generationMode === 'student' && (
            <div className="p-4 bg-indigo-50/40 border border-indigo-100 rounded-xl space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder={`Rechercher un ${terminology.student.toLowerCase()} (nom ou NISU)...`}
                    className="w-full pl-8 pr-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <select
                    className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
                    value={selectedStudent?.id || ''}
                    onChange={e => {
                      const st = students.find(s => s.id === e.target.value);
                      setSelectedStudent(st || null);
                    }}
                  >
                    <option value="">-- Choisir un(e) {terminology.student.toLowerCase()} ({students.length}) --</option>
                    {(studentSearch ? studentResults : students).map(s => (
                      <option key={s.id} value={s.id}>
                        {formatStudentName(s.last_name, s.first_name).fullName} ({s.nisu || 'Sans NISU'})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                </div>
              </div>

              {selectedStudent && (
                <div className="flex items-center gap-2.5 px-3 py-2 bg-white rounded-lg border border-indigo-100 text-xs">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">
                    {selectedStudent.first_name?.[0] || 'E'}
                  </div>
                  <span className="font-bold text-slate-900">{formatStudentName(selectedStudent.last_name, selectedStudent.first_name).fullName}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-500 font-mono text-[11px]">NISU : {selectedStudent.nisu || 'N/A'}</span>
                </div>
              )}
            </div>
          )}

          {/* Clean Display Options Row (Only meaningful pedagogical preferences) */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Options d'affichage :
              </span>

              <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer text-xs font-semibold text-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={reportOptions.showHonorsBadge}
                  onChange={e => setReportOptions(prev => ({ ...prev, showHonorsBadge: e.target.checked }))}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                />
                <span>{school?.school_type === 'UNIVERSITE' || school?.school_type === 'SUPERIEUR' ? 'Mentions & Honneurs' : "Tableau d'Honneur"}</span>
              </label>

              <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer text-xs font-semibold text-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={reportOptions.showClassAverage}
                  onChange={e => setReportOptions(prev => ({ ...prev, showClassAverage: e.target.checked }))}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                />
                <span>Moyenne de {terminology.class?.toLowerCase() || 'classe'}</span>
              </label>
            </div>

            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-emerald-500" />
              <span>QR Code & Sceau officiel certifiés</span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || (generationMode === 'student' && !selectedStudent)}
              className={`flex-1 w-full py-3.5 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2.5 transition-all transform active:scale-98 disabled:opacity-50 ${
                isGenerating ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
              }`}
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText size={16} />}
              <span>{isGenerating ? 'Génération...' : `Générer les Bulletins (${generationMode === 'student' ? `1 ${terminology.student.toLowerCase()}` : `${students.length} ${terminology.students.toLowerCase()}`})`}</span>
            </button>

            {user.role === 'SUPER_ADMIN' && (
              <button
                onClick={handleTest18Subjects}
                className="w-full sm:w-auto px-4 py-3.5 border border-amber-200 bg-amber-50/50 hover:bg-amber-50 text-amber-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                title="Simulateur diagnostic Super Admin : test de gabarit complet avec 20 matières"
              >
                <Sparkles size={14} className="text-amber-600" />
                <span>Test Super Admin (20 Mat.)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportCardsView;
