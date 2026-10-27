import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { useStudent } from '../hooks/useStudent';
import { supabase } from '../supabase';
import { useSchool } from '../contexts/SchoolContext';
import { Clock, ShieldAlert, Calendar, CalendarDays } from 'lucide-react';

interface StudentScheduleViewProps {
  user: UserProfile;
}

export const StudentScheduleView: React.FC<StudentScheduleViewProps> = ({ user }) => {
  const { terminology } = useSchool();
  const { studentData, activeYear, loading: studentLoading } = useStudent(user);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSchedule = async () => {
      if (!studentData?.class_id || !activeYear) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        let { data, error } = await supabase
          .from('staff_assignments')
          .select('*, staff:staff(*)')
          .eq('class_id', studentData.class_id)
          .eq('academic_year_id', activeYear.id);

        if (error) throw error;

        if ((!data || data.length === 0) && studentData.class?.name) {
          const fallbackRes = await supabase
            .from('staff_assignments')
            .select('*, staff:staff(*)')
            .eq('class_name', studentData.class.name)
            .eq('academic_year_id', activeYear.id);
          
          if (!fallbackRes.error && fallbackRes.data && fallbackRes.data.length > 0) {
            data = fallbackRes.data;
          }
        }

        setSchedule(data || []);
      } catch (err) {
        console.error("Error fetching schedule: ", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSchedule();
  }, [studentData, activeYear]);

  const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

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
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Mon Emploi du Temps
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                Semaine
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Classe : <span className="text-slate-800 font-bold">{studentData.class?.name || '--'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <div className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <CalendarDays size={14} className="text-purple-500" />
            <span>{activeYear?.label || 'Session Active'}</span>
          </div>
        </div>
      </div>

      {schedule.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-3 text-slate-300">
            <Calendar size={22} />
          </div>
          <h3 className="text-sm font-bold text-slate-700 mb-1">Emploi du temps non disponible</h3>
          <p className="text-slate-500 font-medium text-xs max-w-sm mx-auto">
            L'emploi du temps n'a pas encore été configuré ou publié pour votre classe.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {days.map(day => {
            const dayBlocks = schedule
              .filter(s => s.day_of_week === day)
              .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
            if (dayBlocks.length === 0 && (day === 'Samedi' || day === 'Dimanche')) return null;
            
            return (
              <div key={day} className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
                <div className="px-3 py-2 bg-slate-50/80 border-b border-slate-100 text-center">
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">{day}</h3>
                </div>
                <div className="p-2.5 flex-1 flex flex-col gap-2">
                  {dayBlocks.length === 0 ? (
                    <div className="flex-1 flex flex-col justify-center items-center text-slate-300 min-h-[80px]">
                      <span className="text-xs font-medium">Libre</span>
                    </div>
                  ) : (
                    dayBlocks.map(block => (
                      <div
                        key={block.id}
                        className="p-2 rounded-lg border border-purple-100 bg-purple-50/60 flex flex-col gap-1 relative overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                        <span className="text-[10px] font-black text-purple-700 tracking-wider pl-1">
                          {(block.start_time || '').substring(0, 5)} - {(block.end_time || '').substring(0, 5)}
                        </span>
                        <span className="text-xs font-bold text-slate-800 leading-tight pl-1 line-clamp-2">
                          {block.subject_name || block.subject?.name || 'Cours'}
                        </span>
                        {block.staff && (
                          <span className="text-[10px] font-medium text-slate-500 truncate pl-1">
                            {block.staff.first_name} {block.staff.last_name}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
