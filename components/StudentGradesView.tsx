import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile } from '../types';
import { useStudent } from '../hooks/useStudent';
import { supabase } from '../supabase';
import { useSchool } from '../contexts/SchoolContext';
import { TrendingUp, FileText, AlertCircle, Award, CheckCircle2 } from 'lucide-react';

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
      <div className="flex justify-center items-center h-48">
        <div className="animate-spin text-blue-600 rounded-full border-2 border-slate-200 border-t-blue-600 w-7 h-7"></div>
      </div>
    );
  }

  if (!studentData) {
    return (
      <div className="p-6 text-center bg-white rounded-2xl shadow-sm border border-slate-200/80 max-w-lg mx-auto mt-4">
        <AlertCircle className="mx-auto h-9 w-9 text-slate-400 mb-2" />
        <h2 className="text-base font-bold text-slate-700">Dossier introuvable</h2>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-3.5 sm:space-y-4 pb-8">
      {/* En-tête Compact */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
            <TrendingUp size={20} />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Mes Notes & Résultats
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                {grades.length} note(s)
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Année Académique : <span className="text-slate-800 font-bold">{activeYear?.label || '--'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <div className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <Award size={14} className="text-emerald-500" />
            <span>Évaluations Officielles</span>
          </div>
        </div>
      </div>

      {grades.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-3 text-slate-300">
            <FileText size={22} />
          </div>
          <h3 className="text-sm font-bold text-slate-700 mb-1">Aucune note enregistrée</h3>
          <p className="text-slate-500 font-medium text-xs max-w-sm mx-auto">
            Les résultats d'évaluations et examens apparaîtront ici dès leur validation par les enseignants.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5 sm:space-y-4">
          {terms.map(term => {
            const termGrades = grades.filter(g => g.term === term);
            const termAvg = termGrades.reduce((sum, g) => sum + (Number(g.score) || 0), 0) / (termGrades.length || 1);
            
            return (
              <div key={term} className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50/70 border-b border-slate-200/80 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <h2 className="text-sm sm:text-base font-bold text-slate-800">{term}</h2>
                  </div>
                  <div className="px-2.5 py-1 bg-white border border-slate-200 shadow-xs rounded-lg flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase">Moyenne</span>
                    <span className="text-sm font-black text-emerald-600">{termAvg.toFixed(2)}</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/30 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        <th className="py-2.5 px-3.5 sm:px-4 w-1/2">{terminology.subject}</th>
                        <th className="py-2.5 px-3.5 sm:px-4 w-1/4">Note / {termGrades[0]?.base || 100}</th>
                        <th className="py-2.5 px-3.5 sm:px-4 w-1/4">Appréciation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {termGrades.map((grade, idx) => {
                        const baseVal = Number(grade.base) || 100;
                        const isPassing = Number(grade.score) >= (baseVal / 2);
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-2.5 px-3.5 sm:px-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800 text-xs sm:text-sm">
                                  {grade.subject?.name || grade.subject_id}
                                </span>
                                {grade.subject?.code && (
                                  <span className="text-[10px] font-mono text-slate-400 uppercase">
                                    {grade.subject.code}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3.5 sm:px-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-black text-xs ${
                                isPassing 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}>
                                {grade.score}
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5 sm:px-4">
                              <span className="font-medium text-slate-500 italic block truncate max-w-xs" title={grade.appreciation || '--'}>
                                {grade.appreciation || '--'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
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
