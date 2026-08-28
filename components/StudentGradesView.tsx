import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile } from '../types';
import { useStudent } from '../hooks/useStudent';
import { supabase } from '../supabase';
import { useSchool } from '../contexts/SchoolContext';
import { TrendingUp, FileText, AlertCircle, BookOpen } from 'lucide-react';

interface StudentGradesViewProps {
  user: UserProfile;
}

export const StudentGradesView: React.FC<StudentGradesViewProps> = ({ user }) => {
  const { terminology } = useSchool();
  const { studentData, activeYear, loading: studentLoading } = useStudent(user);
  const [grades, setGrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGrades = async () => {
      if (!studentData || !activeYear) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Fallback for DB schema versions without academic_year_id on grades
        let { data, error } = await supabase
          .from('grades')
          .select('*, subject:subjects(name, code)')
          .eq('student_id', studentData.id)
          .eq('academic_year_id', activeYear.id);

        if (error && error.code === '42703') {
           // Retry without academic_year_id
           const retry = await supabase
             .from('grades')
             .select('*, subject:subjects(name, code)')
             .eq('student_id', studentData.id);
           data = retry.data;
           error = retry.error;
        }

        if (error) throw error;
        setGrades(data || []);
      } catch (err) {
        console.error("Error fetching grades: ", err);
      } finally {
        setLoading(false);
      }
    };
    fetchGrades();
  }, [studentData, activeYear]);

  const terms = useMemo(() => {
    return Array.from(new Set(grades.map(g => g.term))).filter(Boolean).sort();
  }, [grades]);

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
        <AlertCircle className="mx-auto h-12 w-12 text-slate-400 mb-3" />
        <h2 className="text-xl font-bold text-slate-700">Dossier introuvable</h2>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-6">
         <div className="flex items-center gap-3">
           <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
             <TrendingUp size={28} />
           </div>
           <div>
             <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mes Notes & Résultats</h1>
             <p className="text-sm font-medium text-slate-500">
               Année Académique: <span className="text-slate-800 font-bold">{activeYear?.label || '--'}</span>
             </p>
           </div>
         </div>
      </div>

      {grades.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4 text-slate-300">
            <FileText size={24} />
          </div>
          <p className="text-slate-500 font-medium text-sm max-w-md mx-auto">Aucune note n'a encore été saisie pour votre dossier sur l'année académique en cours.</p>
        </div>
      ) : (
        <div className="space-y-8">
            {terms.map(term => {
              const termGrades = grades.filter(g => g.term === term);
              const termAvg = termGrades.reduce((sum, g) => sum + (Number(g.score) || 0), 0) / termGrades.length;
              
              return (
                <div key={term} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 bg-slate-50/50 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-slate-800">{term}</h2>
                    <div className="px-3 py-1.5 bg-white border border-slate-200 shadow-sm rounded-lg flex items-center gap-2">
                       <span className="text-[10px] font-extrabold text-slate-400 tracking-widest uppercase">Moyenne</span>
                       <span className="text-base font-black text-emerald-600">{termAvg.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="px-6 py-2 overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="py-3 text-[10px] uppercase tracking-widest text-slate-400 font-bold w-1/2">{terminology.subject}</th>
                          <th className="py-3 text-[10px] uppercase tracking-widest text-slate-400 font-bold w-1/4">Note / {termGrades[0]?.base || 100}</th>
                          <th className="py-3 text-[10px] uppercase tracking-widest text-slate-400 font-bold w-1/4">Appréciation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {termGrades.map((grade, idx) => (
                          <tr key={idx} className="border-b border-slate-50 last:border-none hover:bg-slate-50/50 transition-colors">
                             <td className="py-3">
                               <div className="flex flex-col">
                                 <span className="text-sm font-bold text-slate-800">{grade.subject?.name || grade.subject_id}</span>
                                 <span className="text-[10px] font-mono text-slate-400 uppercase">{grade.subject?.code}</span>
                               </div>
                             </td>
                             <td className="py-3">
                               <span className={`text-sm font-black ${Number(grade.score) >= ((grade.base || 100) / 2) ? 'text-emerald-600' : 'text-rose-600'}`}>
                                 {grade.score}
                               </span>
                             </td>
                             <td className="py-3">
                               <span className="text-xs font-medium text-slate-500 italic max-w-xs block truncate line-clamp-2" title={grade.appreciation || '--'}>
                                 {grade.appreciation || '--'}
                               </span>
                             </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};
