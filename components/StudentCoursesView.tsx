import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { useStudent } from '../hooks/useStudent';
import { supabase } from '../supabase';
import { BookOpen, ShieldAlert, User, Layers } from 'lucide-react';
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
      <div className="flex justify-center items-center h-48">
        <div className="animate-spin text-blue-600 rounded-full border-2 border-slate-200 border-t-blue-600 w-7 h-7"></div>
      </div>
    );
  }

  if (!studentData) {
    return (
      <div className="p-6 text-center bg-white rounded-2xl shadow-sm border border-slate-200/80 max-w-lg mx-auto mt-4">
        <ShieldAlert className="mx-auto h-9 w-9 text-slate-400 mb-2" />
        <h2 className="text-base font-bold text-slate-700">Dossier introuvable</h2>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-3.5 sm:space-y-4 pb-8">
      {/* Header Compact */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
            <BookOpen size={20} />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Mes {terminology.subjects}
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                {subjects.length} cours
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Programme de la classe : <span className="text-slate-800 font-bold">{studentData.class?.name || '--'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <div className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <Layers size={14} className="text-indigo-500" />
            <span>Session {activeYear?.label || 'En cours'}</span>
          </div>
        </div>
      </div>

      {subjects.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-3 text-slate-300">
            <BookOpen size={22} />
          </div>
          <h3 className="text-sm font-bold text-slate-700 mb-1">Aucun cours assigné</h3>
          <p className="text-slate-500 font-medium text-xs max-w-sm mx-auto">
            Aucun cours ou matière n'est assigné à votre classe pour le moment.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {subjects.map(item => (
            <div
              key={item.id}
              className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden group"
            >
              <div className="p-3.5 sm:p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <BookOpen size={14} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm leading-tight group-hover:text-indigo-600 transition-colors line-clamp-1">
                        {item.subject?.name}
                      </h3>
                      {item.subject?.code && (
                        <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">
                          {item.subject.code}
                        </span>
                      )}
                    </div>
                  </div>
                  {item.coefficient > 1 && (
                    <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-md shrink-0">
                      Coef. {item.coefficient}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mt-2">
                  {item.subject?.description || "Programme officiel de la classe."}
                </p>
              </div>

              <div className="px-3.5 py-2.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <User size={13} className="text-slate-400" />
                  <span className="font-medium truncate max-w-[170px]">
                    {item.staff ? `${item.staff.first_name} ${item.staff.last_name}` : 'Enseignant non désigné'}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Actif
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
