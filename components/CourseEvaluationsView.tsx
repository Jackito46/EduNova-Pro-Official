import React, { useState, useEffect } from "react";
import { UserProfile, CourseEvaluation } from "../types";
import { supabase } from "../supabase";
import { toast } from "sonner";
import { useSchool } from "../contexts/SchoolContext";
import { getExamsListForClass } from "../lib/evaluations";
import { useSearchParams } from "react-router-dom";
import { ClassSelectorPill } from "./ClassSelectorPill";
import { SelectPill } from "./SelectPill";
import { 
  BookOpen, 
  Calendar, 
  Plus, 
  Trash2, 
  Save, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  PieChart,
  Target,
  Edit2
} from "lucide-react";

interface CourseEvaluationsViewProps {
  user: UserProfile;
}

export const CourseEvaluationsView: React.FC<CourseEvaluationsViewProps & { hideHeader?: boolean }> = ({ user, hideHeader }) => {
  const { terminology, school, currentCampusId } = useSchool();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Data
  const [assignments, setAssignments] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<CourseEvaluation[]>([]);
  const [allCourseEvaluations, setAllCourseEvaluations] = useState<CourseEvaluation[]>([]);
  
  // Selection
  const [selectedClassId, setSelectedClassId] = useState<string>(searchParams.get("class") || "");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(searchParams.get("subject") || "");
  const [selectedTerm, setSelectedTerm] = useState<string>("");
  
  // To avoid hardcoding, we can fetch active year
  const [activeYearId, setActiveYearId] = useState<string>("");

  // Derived state for better filtering
  const classesMap = new Map();
  assignments.forEach(a => {
    const cls = Array.isArray(a.class) ? a.class[0] : a.class;
    if (!cls) return;

    if (!classesMap.has(cls.id)) {
      classesMap.set(cls.id, { ...cls, subjects: [] });
    }
    const subjectObj = Array.isArray(a.subject) ? a.subject[0] : a.subject;
    const staffObj = Array.isArray(a.staff) ? a.staff[0] : a.staff;
    const staffName = staffObj ? `${staffObj.first_name} ${staffObj.last_name}` : 'Non assigné';

    if (subjectObj) {
        const existingSubject = classesMap.get(cls.id).subjects.find((s:any) => s.id === subjectObj.id);
        if (!existingSubject) {
            classesMap.get(cls.id).subjects.push({
                ...subjectObj,
                assignmentId: a.id,
                staffName
            });
        }
    }
  });

  const availableClasses = Array.from(classesMap.values()).sort((a:any, b:any) => a.name.localeCompare(b.name));
  
  useEffect(() => {
    if (availableClasses.length > 0 && !availableClasses.find(c => c.id === selectedClassId)) {
      setSelectedClassId(availableClasses[0].id);
    }
  }, [availableClasses, selectedClassId]);

  const selectedClass = availableClasses.find(c => c.id === selectedClassId);
  const availableSubjects = selectedClass ? selectedClass.subjects.sort((a:any, b:any) => a.name.localeCompare(b.name)) : [];

  useEffect(() => {
    if (availableSubjects.length > 0) {
       const exists = availableSubjects.find((s:any) => s.id === selectedSubjectId);
       if (!exists) {
         setSelectedSubjectId(availableSubjects[0].id);
       }
    } else {
       setSelectedSubjectId("");
    }
  }, [availableSubjects, selectedSubjectId]);

  // Sync to URL when selection changes
  useEffect(() => {
    if (selectedClassId || selectedSubjectId) {
      setSearchParams(prev => {
        const newParams = new URLSearchParams(prev);
        if (selectedClassId) newParams.set('class', selectedClassId);
        if (selectedSubjectId) newParams.set('subject', selectedSubjectId);
        return newParams;
      }, { replace: true });
    }
  }, [selectedClassId, selectedSubjectId, setSearchParams]);

  const selectedSubject = availableSubjects.find((s:any) => s.id === selectedSubjectId);
  const selectedAssignmentId = selectedSubject?.assignmentId;
  const selectedAssignment = assignments.find(a => a.id === selectedAssignmentId);

  const currentCls = selectedAssignment ? (Array.isArray(selectedAssignment.class) ? selectedAssignment.class[0] : selectedAssignment.class) : undefined;
  const examsList = getExamsListForClass(currentCls, school?.school_type);

  useEffect(() => {
    fetchInitialData();
  }, [user, currentCampusId]);

  useEffect(() => {
    if (selectedAssignmentId && activeYearId && selectedTerm) {
      fetchEvaluations();
    } else {
      setEvaluations([]);
      setAllCourseEvaluations([]);
    }
  }, [selectedAssignmentId, activeYearId, selectedTerm]);

  useEffect(() => {
    if (examsList.length > 0 && !examsList.includes(selectedTerm)) {
      setSelectedTerm(examsList[0]);
    }
  }, [examsList, selectedTerm]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch active academic year
      const { data: yearData, error: yearError } = await supabase
        .from('academic_years')
        .select('*')
        .eq('school_id', user.school_id)
        .eq('is_active', true)
        .single();
        
      if (yearError) throw yearError;
      setActiveYearId(yearData.id);

      // 2. Fetch classes belonging to this school and campus to support planning before student enrollment (multi-tenant & branch-safe)
      const activeCampusId = user.campus_id || currentCampusId;
      let classesQuery = supabase
        .from('classes')
        .select('id, name, description')
        .eq('school_id', user.school_id);
        
      if (activeCampusId) {
         classesQuery = classesQuery.eq('campus_id', activeCampusId);
      }
      
      const { data: schoolClasses } = await classesQuery;
        
      const activeClassIds = (schoolClasses || []).map(c => c.id);
      
      let csData: any[] = [];
      if (activeClassIds.length > 0) {
        const { data, error: csError } = await supabase
          .from('class_subjects')
          .select(`
            id,
            class_id,
            subject_id,
            class:classes(id, name, description),
            subject:subjects(id, name, code)
          `)
          .in('class_id', activeClassIds);
          
        if (csError) throw csError;
        csData = data || [];
      }

      // 3. Fetch staff assignments for the year to see who teaches what
      const { data: assignData } = await supabase
        .from('staff_assignments')
        .select(`
           class_id,
           subject_id,
           staff_id,
           staff(first_name, last_name, email)
        `)
        .eq('school_id', user.school_id)
        .eq('academic_year_id', yearData.id);

      // 4. Merge class_subjects and staff_assignments
      let mergedData = csData.map(cs => {
          // A staff assignment matches if it's the exact same class AND subject
          // OR if subject is null (which might mean principal teacher for all subjects, if implemented that way)
          const assignment = (assignData || []).find(a => 
              a.class_id === cs.class_id && 
              (a.subject_id === cs.subject_id || !a.subject_id)
          );
          const staffObj: any = assignment?.staff;
          const email = staffObj ? (Array.isArray(staffObj) ? staffObj[0]?.email : staffObj.email) : null;
          return {
              ...cs,
              staff: staffObj ? (Array.isArray(staffObj) ? staffObj[0] : staffObj) : null,
              staff_id: assignment ? assignment.staff_id : null,
              staff_email: email
          };
      });

      // 5. If user is TEACHER, filter out subjects they don't teach
      if (user.role === 'TEACHER') {
          mergedData = mergedData.filter(item => item.staff_email === user.email);
      }

      setAssignments(mergedData);

    } catch (error: any) {
      console.error("Error fetching configurations:", error);
      toast.error("Erreur lors du chargement des classes et matières");
    } finally {
      setLoading(false);
    }
  };

  const fetchEvaluations = async () => {
    const assignment = assignments.find(a => a.id === selectedAssignmentId);
    if (!assignment) return;
    
    // We only fetch for this specific class and subject
    const subjectId = assignment.subject_id;
    const classId = assignment.class_id;
    
    setLoading(true);
    try {
        // Query for active selected term
        let query = supabase
          .from('course_evaluations')
          .select('*')
          .eq('school_id', user.school_id)
          .eq('academic_year_id', activeYearId)
          .eq('term', selectedTerm);

        if (classId) {
            query = query.eq('class_id', classId);
        } else {
            query = query.is('class_id', null);
        }

        if (subjectId) {
            query = query.eq('subject_id', subjectId);
        } else {
            query = query.is('subject_id', null);
        }

        const { data, error } = await query.order('created_at', { ascending: true });
        
        if (error) throw error;
        setEvaluations(data || []);

        // Also query for ALL terms for overview
        let allQuery = supabase
          .from('course_evaluations')
          .select('*')
          .eq('school_id', user.school_id)
          .eq('academic_year_id', activeYearId);

        if (classId) {
            allQuery = allQuery.eq('class_id', classId);
        } else {
            allQuery = allQuery.is('class_id', null);
        }

        if (subjectId) {
            allQuery = allQuery.eq('subject_id', subjectId);
        } else {
            allQuery = allQuery.is('subject_id', null);
        }

        const { data: allData, error: allError } = await allQuery.order('date', { ascending: true });
        if (allError) throw allError;
        setAllCourseEvaluations(allData || []);

    } catch (error: any) {
        console.error("error fetching syllabus", error);
        toast.error("Erreur lors du chargement du syllabus");
    } finally {
        setLoading(false);
    }
  };

  const handleAddEvaluation = () => {
    if (!selectedAssignment) return;
    
    const currentTotalWeight = evaluations.reduce((acc, curr) => acc + (Number(curr.weight_percentage) || 0), 0);
    const defaultWeight = currentTotalWeight < 100 ? (100 - currentTotalWeight) : 10;
    const isUniv = school?.school_type === 'UNIVERSITY';
    const isProf = school?.school_type === 'PROFESSIONAL';
    const isUnivOrProf = isUniv || isProf;
    const defaultTotalMarks = isUnivOrProf ? 100 : 20;

    const defaultName = isUnivOrProf 
      ? `Évaluation ${evaluations.length + 1}`
      : `Devoir ${evaluations.length + 1}`;

    const newEval: Partial<CourseEvaluation> = {
      id: crypto.randomUUID(), 
      school_id: user.school_id,
      class_id: selectedAssignment.class_id || null,
      subject_id: selectedAssignment.subject_id || null,
      academic_year_id: activeYearId || null,
      teacher_id: selectedAssignment.staff_id || null,
      term: selectedTerm,
      name: defaultName,
      weight_percentage: defaultWeight,
      total_marks: defaultTotalMarks,
      date: new Date().toISOString().split('T')[0],
      description: ""
    };
    
    setEvaluations([...evaluations, newEval as CourseEvaluation]);
  };

  const handleApplyPreset = (presetType: string) => {
    if (!selectedAssignment) return;

    let items: Partial<CourseEvaluation>[] = [];
    const baseDate = new Date();
    
    const d1Date = new Date();
    d1Date.setDate(baseDate.getDate() + 15);
    const d2Date = new Date();
    d2Date.setDate(baseDate.getDate() + 40);
    const d3Date = new Date();
    d3Date.setDate(baseDate.getDate() + 65);
    const finalDate = new Date();
    finalDate.setDate(baseDate.getDate() + 75);

    const isUniv = school?.school_type === 'UNIVERSITY';
    const isProf = school?.school_type === 'PROFESSIONAL';
    const isUnivOrProf = isUniv || isProf;
    const defaultTotalMarks = isUnivOrProf ? 100 : 20;

    if (presetType === 'devoirs_50_50' || presetType === 'intra_final_50_50') {
      items = [
        {
          id: crypto.randomUUID(),
          school_id: user.school_id,
          class_id: selectedAssignment.class_id || null,
          subject_id: selectedAssignment.subject_id || null,
          academic_year_id: activeYearId,
          teacher_id: selectedAssignment.staff_id,
          term: selectedTerm,
          name: isUniv ? "Examen Intra (Mi-Session)" : "Devoir 1",
          total_marks: defaultTotalMarks,
          weight_percentage: 50,
          date: d1Date.toISOString().split('T')[0],
          description: isUniv ? "Évaluation de mi-parcours" : "Premier devoir surveillé de la période"
        },
        {
          id: crypto.randomUUID(),
          school_id: user.school_id,
          class_id: selectedAssignment.class_id || null,
          subject_id: selectedAssignment.subject_id || null,
          academic_year_id: activeYearId,
          teacher_id: selectedAssignment.staff_id,
          term: selectedTerm,
          name: isUniv ? "Examen Final" : "Devoir 2",
          total_marks: defaultTotalMarks,
          weight_percentage: 50,
          date: d2Date.toISOString().split('T')[0],
          description: isUniv ? "Évaluation de fin de semestre" : "Deuxième devoir surveillé de la période"
        }
      ];
    } else if (presetType === 'devoirs_3_tiers') {
      items = [
        {
          id: crypto.randomUUID(),
          school_id: user.school_id,
          class_id: selectedAssignment.class_id || null,
          subject_id: selectedAssignment.subject_id || null,
          academic_year_id: activeYearId,
          teacher_id: selectedAssignment.staff_id,
          term: selectedTerm,
          name: "Devoir 1",
          total_marks: defaultTotalMarks,
          weight_percentage: 30,
          date: d1Date.toISOString().split('T')[0],
          description: "1er Devoir en classe"
        },
        {
          id: crypto.randomUUID(),
          school_id: user.school_id,
          class_id: selectedAssignment.class_id || null,
          subject_id: selectedAssignment.subject_id || null,
          academic_year_id: activeYearId,
          teacher_id: selectedAssignment.staff_id,
          term: selectedTerm,
          name: "Devoir 2",
          total_marks: defaultTotalMarks,
          weight_percentage: 30,
          date: d2Date.toISOString().split('T')[0],
          description: "2ème Devoir en classe"
        },
        {
          id: crypto.randomUUID(),
          school_id: user.school_id,
          class_id: selectedAssignment.class_id || null,
          subject_id: selectedAssignment.subject_id || null,
          academic_year_id: activeYearId,
          teacher_id: selectedAssignment.staff_id,
          term: selectedTerm,
          name: "Devoir 3 / Contrôle",
          total_marks: defaultTotalMarks,
          weight_percentage: 40,
          date: d3Date.toISOString().split('T')[0],
          description: "3ème Devoir ou Contrôle récapitulatif"
        }
      ];
    } else if (presetType === 'intra_final_40_60' || presetType === 'devoir_controle_40_60') {
      items = [
        {
          id: crypto.randomUUID(),
          school_id: user.school_id,
          class_id: selectedAssignment.class_id || null,
          subject_id: selectedAssignment.subject_id || null,
          academic_year_id: activeYearId,
          teacher_id: selectedAssignment.staff_id,
          term: selectedTerm,
          name: isUniv ? "Examen Intra (Mi-Session)" : "Devoir de Contrôle (40%)",
          total_marks: defaultTotalMarks,
          weight_percentage: 40,
          date: d1Date.toISOString().split('T')[0],
          description: isUniv ? "Évaluation de mi-parcours" : "Devoirs et interrogations de période"
        },
        {
          id: crypto.randomUUID(),
          school_id: user.school_id,
          class_id: selectedAssignment.class_id || null,
          subject_id: selectedAssignment.subject_id || null,
          academic_year_id: activeYearId,
          teacher_id: selectedAssignment.staff_id,
          term: selectedTerm,
          name: isUniv ? "Examen Final" : "Examen / Composition de Période (60%)",
          total_marks: defaultTotalMarks,
          weight_percentage: 60,
          date: finalDate.toISOString().split('T')[0],
          description: isUniv ? "Évaluation finale cumulative" : "Évaluation récapitulative de la période"
        }
      ];
    } else if (presetType === 'final_only') {
      items = [
        {
          id: crypto.randomUUID(),
          school_id: user.school_id,
          class_id: selectedAssignment.class_id || null,
          subject_id: selectedAssignment.subject_id || null,
          academic_year_id: activeYearId,
          teacher_id: selectedAssignment.staff_id,
          term: selectedTerm,
          name: isUniv ? "Examen Final" : "Contrôle Unique de Période",
          total_marks: defaultTotalMarks,
          weight_percentage: 100,
          date: finalDate.toISOString().split('T')[0],
          description: isUniv ? "Évaluation finale unique" : "Évaluation unique de fin de période"
        }
      ];
    } else if (presetType === 'continuous_eval') {
      items = [
        {
          id: crypto.randomUUID(),
          school_id: user.school_id,
          class_id: selectedAssignment.class_id || null,
          subject_id: selectedAssignment.subject_id || null,
          academic_year_id: activeYearId,
          teacher_id: selectedAssignment.staff_id,
          term: selectedTerm,
          name: isUniv ? "Devoirs & TP (Contrôle Continu)" : "Devoirs & Travaux Pratiques",
          total_marks: defaultTotalMarks,
          weight_percentage: 30,
          date: d1Date.toISOString().split('T')[0],
          description: "Moyenne des devoirs de classe et travaux pratiques"
        },
        {
          id: crypto.randomUUID(),
          school_id: user.school_id,
          class_id: selectedAssignment.class_id || null,
          subject_id: selectedAssignment.subject_id || null,
          academic_year_id: activeYearId,
          teacher_id: selectedAssignment.staff_id,
          term: selectedTerm,
          name: isUniv ? "Examen Intra" : "Interrogation / Devoir Surveillé",
          total_marks: defaultTotalMarks,
          weight_percentage: 30,
          date: d2Date.toISOString().split('T')[0],
          description: isUniv ? "Évaluation de mi-semestre" : "Évaluation intermédiaire"
        },
        {
          id: crypto.randomUUID(),
          school_id: user.school_id,
          class_id: selectedAssignment.class_id || null,
          subject_id: selectedAssignment.subject_id || null,
          academic_year_id: activeYearId,
          teacher_id: selectedAssignment.staff_id,
          term: selectedTerm,
          name: isUniv ? "Examen Final" : "Examen Périodique",
          total_marks: defaultTotalMarks,
          weight_percentage: 40,
          date: finalDate.toISOString().split('T')[0],
          description: "Examen / Composition finale de période"
        }
      ];
    }

    setEvaluations(items as CourseEvaluation[]);
    toast.info("Modèle appliqué ! N'oubliez pas de cliquer sur 'Enregistrer le syllabus'.");
  };

  const handleRemoveEvaluation = async (id: string, isSavedInDb: boolean) => {
    if (isSavedInDb) {
      if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette évaluation ?")) return;
      
      try {
        const { error } = await supabase
          .from('course_evaluations')
          .delete()
          .eq('id', id);
        if (error) throw error;
        toast.success("Évaluation supprimée");
      } catch (err) {
        toast.error("Erreur lors de la suppression");
        return;
      }
    }
    setEvaluations(evaluations.filter(e => e.id !== id));
  };

  const handleUpdateEvaluation = (id: string, field: keyof CourseEvaluation, value: any) => {
    setEvaluations(evaluations.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const saveSyllabus = async () => {
    if (!selectedAssignment) return;
    
    // Check total weight validation if using percentages
    const totalWeight = evaluations.reduce((acc, curr) => acc + (Number(curr.weight_percentage) || 0), 0);
    if (evaluations.length > 0 && totalWeight > 100) {
        toast.error(`La somme des pondérations (${totalWeight}%) dépasse 100%. Veuillez corriger.`);
        return;
    }

    setSaving(true);
    try {
      const payload = evaluations.map(e => ({
          ...e,
          date: e.date === "" ? null : e.date,
          class_id: e.class_id || null,
          subject_id: e.subject_id || null,
          academic_year_id: e.academic_year_id || null,
          teacher_id: e.teacher_id || null,
          school_id: e.school_id || null,
          updated_at: new Date().toISOString()
      }));
      console.log('Upsert payload:', payload);

      const { error } = await supabase
        .from('course_evaluations')
        .upsert(payload);

      if (error) throw error;

      toast.success("Syllabus d'évaluations enregistré !");
      await fetchEvaluations();
    } catch (error: any) {
      console.error('saveSyllabus error details:', error);
      toast.error(`Erreur lors de l'enregistrement: ${error.message || ''}`);
    } finally {
      setSaving(false);
    }
  };

  const totalWeight = evaluations.reduce((acc, curr) => acc + (Number(curr.weight_percentage) || 0), 0);

  if (loading && assignments.length === 0) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-white rounded-2xl p-12 text-center border font-sans drop-shadow-sm">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 text-blue-500 mb-4">
            <BookOpen size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Aucune affectation trouvée</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            Vous n'avez pas de {terminology.classes.toLowerCase()} ou {terminology.subjects.toLowerCase()} affecté(e)s pour cette période. Veuillez contacter l'administration pour configurer vos affectations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 font-sans">
      <div className={`flex flex-col md:flex-row ${hideHeader ? 'justify-end' : 'justify-between'} items-start md:items-center gap-4`}>
        {!hideHeader && (
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Syllabus des Évaluations</h1>
            <p className="text-sm md:text-base text-gray-500 mt-1">Configurez vos évaluations par {terminology.class.toLowerCase()} et par période.</p>
          </div>
        )}
        <button
          onClick={saveSyllabus}
          disabled={saving || evaluations.length === 0}
          className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium w-full md:w-auto text-sm md:text-base"
        >
          {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
          Enregistrer le syllabus
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-2">{terminology.class}</label>
          <ClassSelectorPill
            classes={availableClasses}
            selectedClassId={selectedClassId}
            onSelectClass={(id) => setSelectedClassId(id)}
            allowAll={false}
            emptyLabel={availableClasses.length === 0 ? "Aucune affectation" : "Choisir une classe..."}
            variant="field"
            size="md"
            colorScheme="blue"
            labelPrefix=""
            disabled={availableClasses.length === 0}
          />
        </div>
        <div>
          <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-2">{terminology.subject}</label>
          <SelectPill
            options={availableSubjects.map((s: any) => ({
              value: s.id,
              label: `${s.name}${user.role !== 'TEACHER' && s.staffName !== 'Non assigné' ? ` (${s.staffName})` : ''}`
            }))}
            value={selectedSubjectId}
            onChange={(val) => setSelectedSubjectId(val)}
            variant="field"
            size="md"
            colorScheme="blue"
            icon={BookOpen}
            placeholder={availableSubjects.length === 0 ? "Aucune affectation" : "Choisir une matière..."}
            disabled={availableSubjects.length === 0}
          />
        </div>
        <div>
          <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-2">Période d'évaluation</label>
          <SelectPill
            options={examsList.map(ex => ({ value: ex, label: ex }))}
            value={selectedTerm}
            onChange={(val) => setSelectedTerm(val)}
            variant="field"
            size="md"
            colorScheme="blue"
            icon={Calendar}
            placeholder="Sélectionner une période..."
            disabled={!selectedAssignmentId || examsList.length === 0}
          />
        </div>
      </div>

      {/* Configuration Area */}
      <div className="bg-white p-4 md:p-6 rounded-2xl border drop-shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Target className="text-blue-500 flex-shrink-0" size={24} />
            <h2 className="text-base md:text-lg font-bold text-gray-900">
              Liste des évaluations - {selectedTerm}
            </h2>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {evaluations.length > 0 && (
              <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-xl border">
                <span className="text-[10px] text-gray-500 font-semibold uppercase px-2">Modèles :</span>
                {school?.school_type === 'UNIVERSITY' ? (
                  <>
                    <button
                      onClick={() => {
                        if (window.confirm("Remplacer vos évaluations actuelles par le modèle Intra (40%) & Final (60%) ?")) {
                          handleApplyPreset('intra_final_40_60');
                        }
                      }}
                      className="px-2 py-1 text-xs font-medium text-gray-700 bg-white rounded-lg border border-gray-150 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-xs"
                      title="Appliquer le preset 40% / 60%"
                    >
                      40/60
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm("Remplacer vos évaluations actuelles par le modèle Intra (50%) & Final (50%) ?")) {
                          handleApplyPreset('intra_final_50_50');
                        }
                      }}
                      className="px-2 py-1 text-xs font-medium text-gray-700 bg-white rounded-lg border border-gray-150 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-xs"
                      title="Appliquer le preset 50% / 50%"
                    >
                      50/50
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm("Remplacer vos évaluations actuelles par l'Examen Final unique (100%) ?")) {
                          handleApplyPreset('final_only');
                        }
                      }}
                      className="px-2 py-1 text-xs font-medium text-gray-700 bg-white rounded-lg border border-gray-150 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-xs"
                      title="Examen final direct à 100%"
                    >
                      Final 100%
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        if (window.confirm("Remplacer vos évaluations actuelles par 2 Devoirs (50% / 50%) ?")) {
                          handleApplyPreset('devoirs_50_50');
                        }
                      }}
                      className="px-2 py-1 text-xs font-medium text-gray-700 bg-white rounded-lg border border-gray-150 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-xs"
                      title="Appliquer 2 Devoirs (50% / 50%)"
                    >
                      2 Devoirs (50/50)
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm("Remplacer vos évaluations actuelles par 3 Devoirs (30% / 30% / 40%) ?")) {
                          handleApplyPreset('devoirs_3_tiers');
                        }
                      }}
                      className="px-2 py-1 text-xs font-medium text-gray-700 bg-white rounded-lg border border-gray-150 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-xs"
                      title="Appliquer 3 Devoirs"
                    >
                      3 Devoirs
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm("Remplacer vos évaluations actuelles par Devoir (40%) & Contrôle (60%) ?")) {
                          handleApplyPreset('devoir_controle_40_60');
                        }
                      }}
                      className="px-2 py-1 text-xs font-medium text-gray-700 bg-white rounded-lg border border-gray-150 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-xs"
                      title="Devoir + Contrôle de Période"
                    >
                      Devoir + Contrôle
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm("Remplacer vos évaluations actuelles par Contrôle Unique (100%) ?")) {
                          handleApplyPreset('final_only');
                        }
                      }}
                      className="px-2 py-1 text-xs font-medium text-gray-700 bg-white rounded-lg border border-gray-150 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-xs"
                      title="Contrôle Unique 100%"
                    >
                      Unique (100%)
                    </button>
                  </>
                )}
              </div>
            )}

            {evaluations.length > 0 && (
              <div className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 ${totalWeight === 100 ? 'bg-emerald-50 text-emerald-700' : totalWeight > 100 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                <PieChart size={16} />
                Poids total: {totalWeight.toFixed(0)}%
              </div>
            )}
          </div>
        </div>

        {evaluations.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 p-6">
            <Calendar className="text-gray-400 mb-3" size={40} />
            <p className="text-gray-700 font-bold mb-1 text-center text-base md:text-lg">Planification rapide du Syllabus</p>
            <p className="text-xs text-gray-500 mb-6 text-center max-w-lg">
              {school?.school_type === 'UNIVERSITY'
                ? "Configurez vos examens semestriels en un clic avec nos modèles standards, ou ajoutez-les manuellement."
                : "Planifiez les devoirs et contrôles périodiques pour vos élèves (Devoir 1, Devoir 2, Contrôles continus, etc.) en un clic."}
            </p>
            
            {school?.school_type === 'UNIVERSITY' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full max-w-4xl mb-6">
                <button 
                  onClick={() => handleApplyPreset('intra_final_40_60')}
                  className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 hover:border-blue-500 hover:bg-blue-50/30 rounded-xl transition-all text-center group shadow-sm hover:shadow-md"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-2 font-bold text-xs group-hover:bg-blue-100">40/60</div>
                  <span className="font-bold text-gray-800 text-sm mb-1 group-hover:text-blue-600">Intra (40%) & Final (60%)</span>
                  <span className="text-xs text-gray-400">2 examens sur 100</span>
                </button>
                
                <button 
                  onClick={() => handleApplyPreset('intra_final_50_50')}
                  className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 hover:border-blue-500 hover:bg-blue-50/30 rounded-xl transition-all text-center group shadow-sm hover:shadow-md"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 font-bold text-xs group-hover:bg-emerald-100">50/50</div>
                  <span className="font-bold text-gray-800 text-sm mb-1 group-hover:text-blue-600">Intra (50%) & Final (50%)</span>
                  <span className="text-xs text-gray-400">2 examens sur 100</span>
                </button>

                <button 
                  onClick={() => handleApplyPreset('final_only')}
                  className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 hover:border-blue-500 hover:bg-blue-50/30 rounded-xl transition-all text-center group shadow-sm hover:shadow-md"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 font-bold text-xs group-hover:bg-indigo-100">100</div>
                  <span className="font-bold text-gray-800 text-sm mb-1 group-hover:text-blue-600">Final Uniquement (100%)</span>
                  <span className="text-xs text-gray-400">1 seul examen sur 100</span>
                </button>

                <button 
                  onClick={() => handleApplyPreset('continuous_eval')}
                  className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 hover:border-blue-500 hover:bg-blue-50/30 rounded-xl transition-all text-center group shadow-sm hover:shadow-md"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-2 font-bold text-xs group-hover:bg-amber-100">30+</div>
                  <span className="font-bold text-gray-800 text-sm mb-1 group-hover:text-blue-600">Contrôle Continu</span>
                  <span className="text-xs text-gray-400">30% TP, 30% Intra, 40% Final</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full max-w-4xl mb-6">
                <button 
                  onClick={() => handleApplyPreset('devoirs_50_50')}
                  className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 hover:border-blue-500 hover:bg-blue-50/30 rounded-xl transition-all text-center group shadow-sm hover:shadow-md"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-2 font-bold text-xs group-hover:bg-blue-100">50/50</div>
                  <span className="font-bold text-gray-800 text-sm mb-1 group-hover:text-blue-600">2 Devoirs (50% / 50%)</span>
                  <span className="text-xs text-gray-400">Devoir 1 & Devoir 2</span>
                </button>
                
                <button 
                  onClick={() => handleApplyPreset('devoirs_3_tiers')}
                  className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 hover:border-blue-500 hover:bg-blue-50/30 rounded-xl transition-all text-center group shadow-sm hover:shadow-md"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 font-bold text-xs group-hover:bg-emerald-100">3x</div>
                  <span className="font-bold text-gray-800 text-sm mb-1 group-hover:text-blue-600">3 Devoirs / Contrôles</span>
                  <span className="text-xs text-gray-400">30% / 30% / 40%</span>
                </button>

                <button 
                  onClick={() => handleApplyPreset('devoir_controle_40_60')}
                  className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 hover:border-blue-500 hover:bg-blue-50/30 rounded-xl transition-all text-center group shadow-sm hover:shadow-md"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 font-bold text-xs group-hover:bg-indigo-100">40/60</div>
                  <span className="font-bold text-gray-800 text-sm mb-1 group-hover:text-blue-600">Devoir (40%) & Contrôle (60%)</span>
                  <span className="text-xs text-gray-400">Devoirs + Composition</span>
                </button>

                <button 
                  onClick={() => handleApplyPreset('final_only')}
                  className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 hover:border-blue-500 hover:bg-blue-50/30 rounded-xl transition-all text-center group shadow-sm hover:shadow-md"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-2 font-bold text-xs group-hover:bg-amber-100">100%</div>
                  <span className="font-bold text-gray-800 text-sm mb-1 group-hover:text-blue-600">Contrôle Unique (100%)</span>
                  <span className="text-xs text-gray-400">1 seule note pour la période</span>
                </button>
              </div>
            )}

            <div className="flex items-center gap-4 w-full justify-center">
              <div className="h-px bg-gray-200 flex-1 max-w-xs"></div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">OU PLANIFIER MANUELLEMENT</span>
              <div className="h-px bg-gray-200 flex-1 max-w-xs"></div>
            </div>

            <button 
              onClick={handleAddEvaluation}
              className="mt-6 flex items-center gap-2 text-blue-600 bg-blue-50 border border-blue-200/50 px-5 py-3 rounded-xl font-bold hover:bg-blue-100 transition-colors text-sm shadow-xs"
            >
               <Plus size={18} /> Ajouter une première évaluation vide
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header row: hidden on mobile, visible on desktop */}
            <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1.5fr_auto] gap-7 mb-2 px-4 font-semibold text-sm text-gray-500">
                <div>Nom de l'évaluation</div>
                <div>Sur (Total)</div>
                <div>Poids (%)</div>
                <div>Date prévue</div>
                <div className="w-10"></div>
            </div>

            {evaluations.map((evalItem, index) => (
              <div 
                key={evalItem.id} 
                className="flex flex-col md:grid md:grid-cols-[2fr_1fr_1fr_1.5fr_auto] gap-3 md:gap-7 items-stretch md:items-center bg-gray-50 md:bg-transparent p-4 md:p-1 md:py-2 rounded-xl md:rounded-none border md:border-b md:border-t-0 md:border-l-0 md:border-r-0 border-gray-200 md:border-gray-100 transition-all hover:border-gray-300 md:hover:border-gray-200 focus-within:ring-1 focus-within:ring-blue-100 relative"
              >
                {/* Delete button: Absolute on mobile, normal in grid on desktop */}
                <button 
                  onClick={() => handleRemoveEvaluation(evalItem.id, !!evalItem.created_at)}
                  className="absolute top-3 right-3 md:relative md:top-auto md:right-auto md:order-last p-2 text-red-500 hover:bg-red-50 md:hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center self-end md:self-auto"
                  title="Supprimer"
                >
                  <Trash2 size={18} />
                </button>

                {/* Nom */}
                <div className="w-full">
                  <label className="block md:hidden text-xs font-semibold text-gray-500 mb-1">Nom de l'évaluation</label>
                  <input 
                    type="text"
                    value={evalItem.name}
                    onChange={(e) => handleUpdateEvaluation(evalItem.id, 'name', e.target.value)}
                    placeholder="Ex: TP1, Interrogation écrite..."
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 outline-none text-gray-900 font-medium"
                  />
                </div>

                {/* Sub-grid for Total and Weight on Mobile, falls back to direct children on desktop */}
                <div className="grid grid-cols-2 md:contents gap-3">
                  <div>
                    <label className="block md:hidden text-xs font-semibold text-gray-500 mb-1">Sur (Total)</label>
                    <input 
                      type="number"
                      value={evalItem.total_marks}
                      onChange={(e) => handleUpdateEvaluation(evalItem.id, 'total_marks', parseFloat(e.target.value) || 0)}
                      placeholder="20"
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 outline-none text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block md:hidden text-xs font-semibold text-gray-500 mb-1">Poids (%)</label>
                    <div className="relative">
                      <input 
                        type="number"
                        value={evalItem.weight_percentage || ''}
                        onChange={(e) => handleUpdateEvaluation(evalItem.id, 'weight_percentage', parseFloat(e.target.value) || 0)}
                        placeholder="25"
                        className="w-full bg-white border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm focus:border-blue-500 focus:ring-1 outline-none text-gray-900"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">%</span>
                    </div>
                  </div>
                </div>

                {/* Date prévue */}
                <div className="w-full pr-10 md:pr-0">
                  <label className="block md:hidden text-xs font-semibold text-gray-500 mb-1">Date prévue</label>
                  <input 
                    type="date"
                    value={evalItem.date || ''}
                    onChange={(e) => handleUpdateEvaluation(evalItem.id, 'date', e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 outline-none text-gray-600"
                  />
                </div>
              </div>
            ))}

            <button 
              onClick={handleAddEvaluation}
              className="mt-4 flex items-center justify-center w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 font-medium hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-all gap-2 text-sm md:text-base"
            >
               <Plus size={20} /> Ajouter une autre évaluation
            </button>
          </div>
        )}
      </div>

      {/* Overview of all planned schedulings */}
      {selectedAssignmentId && (
        <div className="bg-white p-4 md:p-6 rounded-2xl border drop-shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b pb-4">
            <BookOpen className="text-emerald-500 flex-shrink-0" size={24} />
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Aperçu global du Syllabus — {selectedSubject?.name || "Matière"}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Suivi des évaluations planifiées par période pour cette classe et matière.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {examsList.map((termName) => {
              const termEvals = allCourseEvaluations.filter(e => e.term === termName);
              const termWeight = termEvals.reduce((acc, curr) => acc + (Number(curr.weight_percentage) || 0), 0);
              const isSelected = selectedTerm === termName;
              
              // Status Styling
              let statusBadgeClass = "bg-gray-100 text-gray-700 border border-gray-200/50";
              let statusBg = "bg-gray-400";
              let statusText = "Non planifié (0%)";
              
              if (termWeight === 100) {
                statusBadgeClass = "bg-emerald-50 text-emerald-700 border border-emerald-200/60";
                statusBg = "bg-emerald-500";
                statusText = "Syllabus Complet (100%)";
              } else if (termWeight > 100) {
                statusBadgeClass = "bg-rose-50 text-rose-700 border border-rose-200/60";
                statusBg = "bg-rose-500";
                statusText = `Surcharge (${termWeight}%)`;
              } else if (termWeight > 0) {
                statusBadgeClass = "bg-amber-50 text-amber-700 border border-amber-200/60";
                statusBg = "bg-amber-500";
                statusText = `Incomplet (${termWeight}%)`;
              }

              return (
                <div 
                  key={termName}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                    isSelected 
                      ? "border-blue-500 ring-4 ring-blue-50 bg-blue-50/10 shadow-xs" 
                      : "border-gray-150 bg-white hover:border-gray-300 hover:shadow-xs"
                  }`}
                >
                  <div>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 pb-3 border-b border-gray-100">
                      <div>
                        <h3 className="font-bold text-gray-900 text-sm md:text-base flex items-center gap-2 font-sans">
                          {termName}
                          {isSelected && (
                            <span className="inline-flex w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" title="Période en cours de modification" />
                          )}
                        </h3>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mt-0.5">
                          Période académique
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${statusBadgeClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusBg}`} />
                        {statusText}
                      </span>
                    </div>

                    {termEvals.length === 0 ? (
                      <div className="py-6 flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-xl bg-gray-50/30 text-center px-4">
                        <p className="text-xs text-gray-400 italic">Aucune évaluation enregistrée pour le moment</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {termEvals.map((e) => {
                          const formattedDate = e.date ? e.date.split('-').reverse().join('/') : null;
                          return (
                            <div 
                              key={e.id}
                              className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors text-xs"
                            >
                              <div>
                                <div className="font-bold text-gray-800 truncate max-w-[160px] md:max-w-[240px]" title={e.name}>
                                  {e.name}
                                </div>
                                {formattedDate && (
                                  <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                                    <Calendar size={10} />
                                    <span>Prévu le : {formattedDate}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-gray-500 flex-shrink-0 font-medium">
                                <span>Note : {e.total_marks} pts</span>
                                <span className="h-3 w-px bg-gray-200"></span>
                                <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md font-extrabold text-[11px]">
                                  {e.weight_percentage}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      {termEvals.length} {termEvals.length > 1 ? "évaluations" : "évaluation"}
                    </div>
                    {isSelected ? (
                      <span className="text-[11px] text-blue-600 font-bold bg-blue-50 px-3 py-1 rounded-lg border border-blue-100/50">
                        Éditeur actif
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedTerm(termName);
                          // Scroll editor into view
                          const el = document.getElementById("selected-term-filter");
                          if (el) {
                            el.scrollIntoView({ behavior: 'smooth' });
                          } else {
                            window.scrollTo({ top: 300, behavior: 'smooth' });
                          }
                        }}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline transition-all flex items-center gap-1"
                      >
                        Planifier cette période →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-blue-50 text-blue-900 border border-blue-100 p-6 rounded-2xl flex gap-4">
          <div className="mt-1"><AlertCircle className="text-blue-600" size={24} /></div>
          <div>
              <h3 className="font-bold mb-1">Comment fonctionne le syllabus des évaluations ?</h3>
              <p className="text-sm opacity-90 leading-relaxed mb-3">
                  Ce syllabus permet de planifier les évaluations pour vos classes. Une fois configurées, ces évaluations :
              </p>
              <ul className="text-sm space-y-2 opacity-90">
                  <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-blue-600"/> Modèleront l'interface de saisie des notes (le carnet de notes s'adaptera exactement à ces colonnes).</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-blue-600"/> Calculeront automatiquement la moyenne de l'{terminology.student.toLowerCase()} pour cette période (en respectant les pourcentages indiqués).</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-blue-600"/> Seront visibles par les {terminology.students.toLowerCase()} dans leur planning académique.</li>
              </ul>
          </div>
      </div>
    </div>
  );
};
