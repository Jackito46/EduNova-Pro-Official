import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserProfile } from '../types';
import { useStudent } from '../hooks/useStudent';
import { useSchool } from '../contexts/SchoolContext';
import { formatStudentName, formatFullName } from '../utils/formatters';
import { 
  LayoutDashboard, 
  BookOpen, 
  TrendingUp, 
  Receipt, 
  Clock, 
  GraduationCap,
  Calendar,
  Sparkles
} from 'lucide-react';

interface StudentHeaderProps {
  user: UserProfile;
}

export const StudentHeader: React.FC<StudentHeaderProps> = ({ user }) => {
  const location = useLocation();
  const { terminology, school } = useSchool();
  const { studentData, activeYear } = useStudent(user);

  // Dynamic formatting of the student's full name
  const formattedName = useMemo(() => {
    const lastName = studentData?.last_name || (user as any).last_name || '';
    const firstName = studentData?.first_name || (user as any).first_name || '';

    if (lastName || firstName) {
      return formatStudentName(lastName, firstName);
    }
    if (user.full_name) {
      const parts = user.full_name.trim().split(/\s+/);
      if (parts.length > 1) {
        return formatStudentName(parts[0], parts.slice(1).join(' '));
      }
      return {
        lastName: user.full_name.toUpperCase(),
        firstName: '',
        fullName: formatFullName(user.full_name)
      };
    }
    return { lastName: 'ÉLÈVE', firstName: '', fullName: 'Élève' };
  }, [studentData, user]);

  const initials = useMemo(() => {
    const fn = formattedName.firstName?.charAt(0) || '';
    const ln = formattedName.lastName?.charAt(0) || '';
    return (ln + fn).toUpperCase() || 'E';
  }, [formattedName]);

  const className = studentData?.class?.name || 'Classe non assignée';
  const matricule = studentData?.reference_number || studentData?.id?.substring(0, 8) || '';

  const navItems = [
    { name: 'Tableau de bord', path: '/', icon: LayoutDashboard },
    { name: `Mes ${terminology.subjects}`, path: '/mes-cours', icon: BookOpen },
    { name: 'Mes Notes', path: '/mes-notes', icon: TrendingUp },
    { name: 'Mon Économat', path: '/mon-economat', icon: Receipt },
    { name: 'Mon Horaire', path: '/mon-horaire', icon: Clock },
  ];

  return (
    <header 
      id="student-persistent-header"
      className="sticky top-0 z-30 -mt-1 sm:-mt-2 mb-3.5 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-2xs px-3 py-2 sm:px-4 sm:py-2.5 transition-all"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3">
        {/* Student Identity Display */}
        <Link 
          to="/profil"
          title="Consulter mon dossier étudiant" 
          className="flex items-center gap-2.5 min-w-0 group hover:opacity-95 transition-opacity"
        >
          <div className="relative shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-blue-600 text-white font-black text-xs sm:text-sm flex items-center justify-center shadow-2xs border border-indigo-200 group-hover:scale-105 transition-transform">
              {initials}
            </div>
            <span 
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" 
              title="Session élève active"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[9.5px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                <Sparkles size={9} className="text-indigo-500" />
                Espace {terminology.student}
              </span>
              <span className="inline-flex items-center gap-1 text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200/70">
                <GraduationCap size={10} className="text-slate-500 shrink-0" />
                <span>{className}</span>
              </span>
              {matricule && (
                <span className="hidden sm:inline-block text-[9.5px] font-mono text-slate-400">
                  Matricule: {matricule}
                </span>
              )}
            </div>

            {/* Full Name without premature ellipsis */}
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <h2 
                id="student-header-fullname"
                className="text-xs sm:text-sm lg:text-base font-black text-slate-900 tracking-tight whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px] sm:max-w-[320px] lg:max-w-none" 
                title={formattedName.fullName}
              >
                {formattedName.fullName}
              </h2>
            </div>
          </div>
        </Link>

        {/* Navigation Tabs - Compact segmented rhythm */}
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto custom-scrollbar py-0.5 -mx-1 px-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                id={`student-nav-${item.path.replace('/', '') || 'dashboard'}`}
                to={item.path}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap shrink-0 min-h-[32px] sm:min-h-[34px] cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/70'
                }`}
              >
                <Icon size={13} className={isActive ? 'text-white' : 'text-slate-400'} />
                <span>{item.name}</span>
              </Link>
            );
          })}

          {(activeYear?.label || (activeYear as any)?.name) && (
            <div className="hidden xl:inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-500 bg-slate-50 border border-slate-200/70 px-2 py-1 rounded-xl whitespace-nowrap ml-0.5">
              <Calendar size={11} className="text-slate-400" />
              <span>{activeYear?.label || (activeYear as any)?.name}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
