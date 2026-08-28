import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { useStudent } from '../hooks/useStudent';
import { supabase } from '../supabase';
import { useSchool } from '../contexts/SchoolContext';
import { Clock, ShieldAlert, Calendar } from 'lucide-react';

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
        // Note: The schema for schedules is staff_assignments.
        // Try fetching by class_id first
        let { data, error } = await supabase
          .from('staff_assignments')
          .select('*, staff:staff(*)')
          .eq('class_id', studentData.class_id)
          .eq('academic_year_id', activeYear.id);

        if (error) throw error;

        // Fallback to class_name if no records found by class_id
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
           <div className="p-3 bg-purple-100 text-purple-700 rounded-xl">
             <Clock size={28} />
           </div>
           <div>
             <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mon Emploi du Temps</h1>
             <p className="text-sm font-medium text-slate-500">
               Session de la classe <span className="text-slate-800 font-bold">{studentData.class?.name || '--'}</span>
             </p>
           </div>
         </div>
      </div>

      {schedule.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <Calendar className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium text-sm">L'emploi du temps n'a pas encore été publié pour votre classe.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {days.map(day => {
            const dayBlocks = schedule.filter(s => s.day_of_week === day).sort((a, b) => a.start_time.localeCompare(b.start_time));
            if (dayBlocks.length === 0 && (day === 'Samedi' || day === 'Dimanche')) return null;
            
            return (
              <div key={day} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                 <div className="p-3 bg-slate-50/50 border-b border-slate-100 text-center">
                   <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">{day}</h3>
                 </div>
                 <div className="p-3 flex-1 flex flex-col gap-3">
                    {dayBlocks.length === 0 ? (
                      <div className="flex-1 flex flex-col justify-center items-center text-slate-300 min-h-[100px]">
                        <span className="text-xs font-medium">Libre</span>
                      </div>
                    ) : (
                      dayBlocks.map(block => (
                        <div key={block.id} className="p-3 rounded-xl border border-purple-100 bg-purple-50 flex flex-col gap-1.5 relative group">
                           <div className="absolute top-0 left-0 w-1 h-full bg-purple-500 rounded-l-xl"></div>
                           <span className="text-[10px] font-black text-purple-600 tracking-wider">
                             {block.start_time.substring(0, 5)} - {block.end_time.substring(0, 5)}
                           </span>
                           <span className="text-xs font-bold text-slate-800 leading-tight">
                             {block.subject_name}
                           </span>
                           <span className="text-[10px] font-medium text-slate-500 truncate">
                             {block.staff ? `${block.staff.first_name} ${block.staff.last_name}` : ''}
                           </span>
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
