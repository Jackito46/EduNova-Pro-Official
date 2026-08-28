import React, { useState, useEffect } from 'react';
import { UserProfile, SchoolClass } from '../types';
import { useStudent } from '../hooks/useStudent';
import { supabase } from '../supabase';
import { BookOpen, AlertCircle, Calendar, ShieldAlert } from 'lucide-react';
import { useSchool } from '../contexts/SchoolContext';

interface StudentCoursesViewProps {
  user: UserProfile;
}

export const StudentCoursesView: React.FC<StudentCoursesViewProps> = ({ user }) => {
  const { terminology } = useSchool();
  const { studentData, activeYear, loading: studentLoading } = useStudent(user);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      if (!studentData?.class_id || !activeYear) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // 1. Fetch class subjects
        const { data: csData, error: csError } = await supabase
          .from('class_subjects')
          .select('*, subject:subjects(*)')
          .eq('class_id', studentData.class_id);

        if (csError) throw csError;

        // 2. Fetch staff assignments for the class to get staff details
        const { data: assignData, error: assignError } = await supabase
          .from('staff_assignments')
          .select('subject_id, staff:staff(first_name, last_name, nif_cin)')
          .eq('class_id', studentData.class_id)
          .eq('academic_year_id', activeYear.id);

        if (assignError) {
          console.error("Error fetching staff assignments: ", assignError);
        }

        // 3. Merge them
        const merged = (csData || []).map(cs => {
          const assignment = (assignData || []).find(a => a.subject_id === cs.subject_id);
          const staffObj = assignment?.staff;
          return {
            ...cs,
            staff: staffObj ? (Array.isArray(staffObj) ? staffObj[0] : staffObj) : null
          };
        });

        setSubjects(merged);
      } catch (err) {
        console.error("Error fetching courses: ", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, [studentData, activeYear]);

  if (studentLoading || loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin text-blue-600 rounded-full border-2 border-slate-200 border-t-blue-600 w-8 h-8"></div>
      </div>
    );
  }

  if (!studentData) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl shadow-sm border border-slate-100 mt-8">
        <ShieldAlert className="mx-auto h-12 w-12 text-slate-400 mb-3" />
        <h2 className="text-xl font-bold text-slate-700">Dossier introuvable</h2>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-6">
         <div className="flex items-center gap-3">
           <div className="p-3 bg-indigo-100 text-indigo-700 rounded-xl">
             <BookOpen size={28} />
           </div>
           <div>
             <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mes {terminology.subjects}</h1>
             <p className="text-sm font-medium text-slate-500">
               Votre cursus pour la classe <span className="text-slate-800 font-bold">{studentData.class?.name || '--'}</span>
             </p>
           </div>
         </div>
      </div>

      {subjects.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <BookOpen className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium text-sm">Aucun cours n'est assigné à votre classe pour le moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map(item => (
            <div key={item.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-shadow overflow-hidden flex flex-col group">
               <div className="p-5 border-b border-slate-100">
                 <div className="flex items-center gap-2 mb-2">
                   <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                     <BookOpen size={16} />
                   </div>
                   <h3 className="font-bold text-slate-800 text-base leading-tight group-hover:text-indigo-600 transition-colors line-clamp-2">
                     {item.subject?.name}
                   </h3>
                 </div>
                 <span className="inline-block px-2.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold tracking-widest uppercase rounded">
                   Code: {item.subject?.code}
                 </span>
               </div>
               
               <div className="p-5 bg-slate-50/50 flex-1">
                 <p className="text-xs text-slate-500 leading-relaxed mb-4 line-clamp-3">
                   {item.subject?.description || "Aucune description fournie pour ce cours."}
                 </p>
                 
                 <div className="space-y-3 mt-auto">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">Professeur</span>
                      <span className="font-semibold text-slate-800">
                        {item.staff ? `${item.staff.first_name} ${item.staff.last_name}` : 'À déterminer'}
                      </span>
                    </div>
                    {item.coefficient > 1 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">Coefficient</span>
                        <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                          {item.coefficient}
                        </span>
                      </div>
                    )}
                 </div>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
