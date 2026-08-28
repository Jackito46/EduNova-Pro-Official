import React from 'react';
import { School, SchoolClass, StaffMember, StaffAssignment } from '../types';
import { formatStudentName } from '../utils/formatters';
import { Clock, MapPin, Calendar, BookOpen, User } from 'lucide-react';

interface SchedulePrintDocumentProps {
  school: School | null;
  campusName?: string;
  yearLabel?: string;
  viewMode: 'class' | 'staff';
  selectedClass?: SchoolClass;
  selectedStaff?: StaffMember;
  schedules: StaffAssignment[];
  days: string[];
  timeSlots: string[];
  currency?: string;
}

export const SchedulePrintDocument: React.FC<SchedulePrintDocumentProps> = ({
  school,
  campusName,
  yearLabel,
  viewMode,
  selectedClass,
  selectedStaff,
  schedules,
  days,
  timeSlots,
  currency = 'GNF'
}) => {
  const title = viewMode === 'class'
    ? `Emploi du Temps — Classe : ${selectedClass?.name || 'Non spécifiée'}`
    : `Emploi du Temps — Enseignant : ${selectedStaff ? formatStudentName(selectedStaff.last_name, selectedStaff.first_name).fullName : 'Non spécifié'}`;

  // Calculs statistiques
  const totalCourses = schedules.length;
  const totalHours = schedules.reduce((acc, s) => acc + (s.duration_hours || 1), 0);

  const getSubjectStyle = (name: string) => {
    const colors = [
      { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
      { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' },
      { bg: '#f5f3ff', text: '#5b21b6', border: '#ddd6fe' },
      { bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
      { bg: '#fff1f2', text: '#9f1239', border: '#fecdd3' },
      { bg: '#f0f9ff', text: '#075985', border: '#bae6fd' },
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % colors.length;
    return colors[idx];
  };

  return (
    <div className="w-full max-w-[297mm] mx-auto bg-white p-6 md:p-8 text-slate-900 font-sans print:p-0">
      {/* Header Institutionnel Haut de Gamme */}
      <div className="border-b-2 border-slate-900 pb-4 mb-5 flex items-start justify-between">
        <div className="flex items-center gap-4">
          {school?.logo_url ? (
            <img
              src={school.logo_url}
              alt="Logo"
              className="w-16 h-16 object-contain rounded-lg border border-slate-200"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-xl">
              {school?.name?.charAt(0) || 'E'}
            </div>
          )}
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              {school?.name || 'ÉTABLISSEMENT SCOLAIRE'}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-1 font-medium">
              {campusName && (
                <span className="inline-flex items-center gap-1 font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                  <MapPin size={12} /> {campusName}
                </span>
              )}
              {yearLabel && (
                <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                  <Calendar size={12} /> Année Académique : {yearLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="inline-block bg-slate-900 text-white px-3 py-1 rounded text-xs font-black uppercase tracking-widest mb-1">
            DOCUMENT OFFICIEL
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Généré le {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Bannière de l'Objet de l'Emploi du Temps */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Planning Hebdomadaire</span>
          <h2 className="text-lg font-black text-slate-900">{title}</h2>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold text-slate-700">
          <div className="px-3 py-1.5 bg-white rounded-lg border border-slate-200 shadow-2xs flex items-center gap-1.5">
            <BookOpen size={14} className="text-indigo-600" />
            <span>{totalCourses} cours programmés</span>
          </div>
          <div className="px-3 py-1.5 bg-white rounded-lg border border-slate-200 shadow-2xs flex items-center gap-1.5">
            <Clock size={14} className="text-emerald-600" />
            <span>{totalHours} heures / semaine</span>
          </div>
        </div>
      </div>

      {/* Grille Standard Internationale d'Emploi du Temps */}
      <div className="border border-slate-300 rounded-lg overflow-hidden shadow-xs">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="p-2.5 w-20 text-center font-black uppercase tracking-wider text-[11px] border-r border-slate-700">
                Horaire
              </th>
              {days.map(day => (
                <th key={day} className="p-2.5 text-center font-black uppercase tracking-wider text-[11px] border-r border-slate-700 last:border-0">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map((time, idx) => {
              const hourPrefix = time.substring(0, 2);
              const nextHour = `${(parseInt(hourPrefix) + 1).toString().padStart(2, '0')}:00`;

              return (
                <tr key={time} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                  <td className="p-2 text-center font-black text-slate-600 border-t border-r border-slate-200 bg-slate-100/70 text-[11px]">
                    {time} - {nextHour}
                  </td>
                  {days.map(day => {
                    const daySchedules = schedules.filter(s =>
                      s.day_of_week === day && s.start_time.startsWith(hourPrefix)
                    );

                    return (
                      <td key={day} className="p-1.5 border-t border-r border-slate-200 last:border-0 align-top h-20 w-[13.5%]">
                        {daySchedules.map(schedule => {
                          const style = getSubjectStyle(schedule.subject_name);
                          return (
                            <div
                              key={schedule.id}
                              style={{ backgroundColor: style.bg, borderColor: style.border, color: style.text }}
                              className="w-full p-2 rounded border mb-1 last:mb-0 shadow-2xs"
                            >
                              <div className="font-black text-[11px] leading-tight uppercase truncate">
                                {schedule.subject_name}
                              </div>
                              <div className="text-[10px] font-bold opacity-90 truncate mt-0.5">
                                {viewMode === 'class'
                                  ? (schedule.staff ? formatStudentName(schedule.staff.last_name, schedule.staff.first_name).fullName : 'Professeur non assigné')
                                  : schedule.class_name
                                }
                              </div>
                              <div className="text-[9px] font-semibold opacity-75 mt-1 pt-1 border-t border-current/20 flex justify-between">
                                <span>{schedule.start_time.substring(0, 5)} - {schedule.end_time.substring(0, 5)}</span>
                                <span>{schedule.duration_hours}h</span>
                              </div>
                            </div>
                          );
                        })}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pied de Page avec Signatures et Sceaux */}
      <div className="mt-8 pt-4 border-t border-slate-200 grid grid-cols-3 gap-6 text-center text-xs">
        <div>
          <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Le Responsable Pédagogique</p>
          <div className="h-14 border-b border-dashed border-slate-300 mt-2"></div>
          <p className="text-[10px] text-slate-400 mt-1">Visa & Signature</p>
        </div>
        <div>
          <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Sceau de l'Établissement</p>
          <div className="h-14 border-b border-dashed border-slate-300 mt-2 flex items-center justify-center">
            <span className="text-[9px] text-slate-300 uppercase tracking-widest">Cachet Officiel</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Certifié conforme</p>
        </div>
        <div>
          <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">La Direction des Études</p>
          <div className="h-14 border-b border-dashed border-slate-300 mt-2"></div>
          <p className="text-[10px] text-slate-400 mt-1">Approbation finale</p>
        </div>
      </div>
    </div>
  );
};
