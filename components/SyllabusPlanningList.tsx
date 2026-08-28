import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useSchool } from '../contexts/SchoolContext';
import { 
  Search, 
  Filter,
  BookOpen,
  Users,
  User,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface SyllabusGroup {
  id: string; // class_id + subject_id
  class_id: string;
  className: string;
  subject_id: string;
  subjectName: string;
  teacher_id: string;
  teacherName: string;
  evaluationsCount: number;
  totalWeight: number;
  lastUpdated: string;
}

import { UserProfile } from '../types';

interface SyllabusPlanningListProps {
  user: UserProfile;
}

export default function SyllabusPlanningList({ user }: SyllabusPlanningListProps) {
  const { school, terminology } = useSchool();
  const [loading, setLoading] = useState(true);
  const [syllabusGroups, setSyllabusGroups] = useState<SyllabusGroup[]>([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  
  // Available filter options
  const [classes, setClasses] = useState<{id: string, name: string}[]>([]);
  const [teachers, setTeachers] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    if (user && school) {
      fetchSyllabusData();
    }
  }, [user, school]);

  const fetchSyllabusData = async () => {
    setLoading(true);
    try {
      const { data: years } = await supabase
          .from('academic_years')
          .select('id, is_active, status')
          .eq('school_id', user.school_id);
          
      const activeYear = years?.find(y => y.is_active || y.status === 'ACTIVE') || years?.[0];
      if (!activeYear) {
         setLoading(false);
         return;
      }

      // 2. Fetch classes belonging to this school and campus to support planning before student enrollment (multi-tenant & branch-safe)
      let classesQuery = supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', user.school_id);
        
      const activeCampusId = user.campus_id;
      if (activeCampusId) {
         classesQuery = classesQuery.eq('campus_id', activeCampusId);
      }
      
      const { data: schoolClasses } = await classesQuery;
        
      const classIds = (schoolClasses || []).map(c => c.id);

      let csData: any[] = [];
      if (classIds.length > 0) {
        const { data: cs } = await supabase
          .from('class_subjects')
          .select(`
            id,
            class_id,
            subject_id,
            class:classes(id, name),
            subject:subjects(id, name)
          `)
          .in('class_id', classIds);
        csData = cs || [];
      }

      // Fetch staff assignments
      const { data: assignData } = await supabase
        .from('staff_assignments')
        .select(`
           class_id,
           subject_id,
           staff_id,
           staff(first_name, last_name, email)
        `)
        .eq('school_id', user.school_id)
        .eq('academic_year_id', activeYear.id);

      // Fetch course evaluations
      const { data: evaluations, error } = await supabase
        .from('course_evaluations')
        .select('class_id, subject_id, weight_percentage, updated_at')
        .eq('school_id', user.school_id)
        .eq('academic_year_id', activeYear.id);
      
      if (error) throw error;

      const groupedMap = new Map<string, SyllabusGroup>();
      const uniqueClasses = new Map<string, string>();
      const uniqueTeachers = new Map<string, string>();

      // Initialize map with all class subjects
      csData.forEach(cs => {
        if (!cs.class_id || !cs.subject_id) return;
        const key = `${cs.class_id}-${cs.subject_id}`;
        
        const className = (cs.class as any)?.name || 'Inconnue';
        const subjectName = (cs.subject as any)?.name || 'Inconnue';
        
        const assignment = (assignData || []).find(a => 
            a.class_id === cs.class_id && 
            (a.subject_id === cs.subject_id || !a.subject_id)
        );
        const staffObj: any = assignment?.staff;
        const staffEmail = staffObj ? (Array.isArray(staffObj) ? staffObj[0]?.email : staffObj.email) : null;
        let teacherName = 'Non assigné';
        if (staffObj) {
           const s = Array.isArray(staffObj) ? staffObj[0] : staffObj;
           teacherName = `${s.first_name} ${s.last_name}`;
        }
        
        const teacher_id = assignment?.staff_id || '';

        // Only add if user is admin OR if user is teacher and they teach this subject
        if (user.role === 'TEACHER' && staffEmail !== user.email) {
          return; // Skip subjects not taught by this teacher
        }

        if (!uniqueClasses.has(cs.class_id)) uniqueClasses.set(cs.class_id, className);
        if (teacher_id && !uniqueTeachers.has(teacher_id)) uniqueTeachers.set(teacher_id, teacherName);

        groupedMap.set(key, {
            id: key,
            class_id: cs.class_id,
            className,
            subject_id: cs.subject_id,
            subjectName,
            teacher_id,
            teacherName,
            evaluationsCount: 0,
            totalWeight: 0,
            lastUpdated: new Date().toISOString()
        });
      });

      // Now add evaluations to the groups
      (evaluations || []).forEach(e => {
        if (!e.class_id || !e.subject_id) return;
        
        const key = `${e.class_id}-${e.subject_id}`;
        const weight = Number(e.weight_percentage) || 0;
        
        if (groupedMap.has(key)) {
          const group = groupedMap.get(key)!;
          group.evaluationsCount += 1;
          group.totalWeight += weight;
          if (e.updated_at && new Date(e.updated_at) > new Date(group.lastUpdated)) {
            group.lastUpdated = e.updated_at;
          }
        }
      });

      setSyllabusGroups(Array.from(groupedMap.values()));
      setClasses(Array.from(uniqueClasses.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)));
      setTeachers(Array.from(uniqueTeachers.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)));

    } catch (error) {
      console.error('Error fetching syllabus data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredGroups = syllabusGroups.filter(g => {
    const matchesSearch = g.subjectName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          g.className.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          g.teacherName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClass ? g.class_id === selectedClass : true;
    const matchesTeacher = selectedTeacher ? g.teacher_id === selectedTeacher : true;
    
    return matchesSearch && matchesClass && matchesTeacher;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
          <div className="flex-1 md:max-w-md w-full relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all sm:text-sm"
              placeholder="Rechercher par matière, classe ou enseignant..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex w-full md:w-auto items-center gap-3">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full md:w-auto border border-gray-200 rounded-xl px-4 py-2.5 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"
            >
              <option value="">Toutes les classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="w-full md:w-auto border border-gray-200 rounded-xl px-4 py-2.5 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"
            >
              <option value="">Tous les enseignants</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center items-center text-blue-500">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="py-12 flex flex-col justify-center items-center text-center px-4 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
            <BookOpen className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Aucune planification trouvée</h3>
            <p className="text-sm text-gray-500 max-w-sm">
              Commencez à planifier des évaluations depuis l'outil Syllabus pour qu'elles apparaissent ici.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50/80 border-y border-gray-100">
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-400 tracking-wider uppercase rounded-tl-xl">Matière</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-400 tracking-wider uppercase">Classe</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-400 tracking-wider uppercase">Enseignant</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-400 tracking-wider uppercase">Évaluations</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-400 tracking-wider uppercase">Progression</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-400 tracking-wider uppercase">Statut</th>
                  <th className="px-6 py-4 text-right text-[11px] font-bold text-gray-400 tracking-wider uppercase rounded-tr-xl">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredGroups.map((group) => {
                  const isComplete = group.totalWeight === 100;
                  const isOver = group.totalWeight > 100;
                  const progressWidth = Math.min(100, group.totalWeight);
                  
                  return (
                    <tr key={group.id} className="hover:bg-blue-50/30 transition-colors group/row">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <BookOpen className="w-4 h-4 text-blue-600" />
                          </div>
                          <span className="font-semibold text-gray-900 text-sm">{group.subjectName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100/50">
                          <Users className="w-3 h-3" />
                          {group.className}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center">
                            <User className="w-3 h-3 text-orange-600" />
                          </div>
                          <span className="text-sm text-gray-600">{group.teacherName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-600">
                          {group.evaluationsCount} étape{group.evaluationsCount > 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="px-6 py-4 w-48">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${isComplete ? 'bg-emerald-500' : isOver ? 'bg-rose-500' : 'bg-blue-500'}`} 
                              style={{ width: `${progressWidth}%` }}
                            />
                          </div>
                          <span className={`text-xs font-bold w-9 ${isComplete ? 'text-emerald-700' : isOver ? 'text-rose-700' : 'text-blue-700'}`}>
                            {group.totalWeight}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {isComplete ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/50">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Complet
                          </span>
                        ) : isOver ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200/50">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            Surcharge
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/50">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Incomplet
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link 
                          to={`/enseignant/syllabus?class=${group.class_id}&subject=${group.subject_id}`}
                          className="inline-flex items-center justify-center p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
