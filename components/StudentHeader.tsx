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
      className="sticky top-0 z-30 -mt-2 sm:-mt-3 mb-5 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-xs px-3.5 py-2.5 sm:px-5 sm:py-3 transition-all"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        {/* Student Identity Display */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-blue-600 text-white font-black text-sm sm:text-base flex items-center justify-center shadow-xs border border-indigo-200">
              {initials}
            </div>
            <span 
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" 
              title="Session élève active"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                <Sparkles size={10} className="text-indigo-500" />
                Espace {terminology.student}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/70 truncate max-w-[150px] sm:max-w-xs">
                <GraduationCap size={11} className="text-slate-500 shrink-0" />
                {className}
              </span>
              {matricule && (
                <span className="hidden sm:inline-block text-[10px] font-mono text-slate-400">
                  Matricule: {matricule}
                </span>
              )}
            </div>

            {/* Dynamic Full Name */}
            <div className="flex items-baseline gap-2 mt-0.5">
              <h2 
                id="student-header-fullname"
                className="text-sm sm:text-base lg:text-lg font-black text-slate-900 tracking-tight truncate" 
                title={formattedName.fullName}
              >
                {formattedName.fullName}
              </h2>
            </div>
          </div>
        </div>

        {/* Navigation Tabs - Permanent During Navigation */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto custom-scrollbar py-0.5 -mx-1 px-1 shrink-0">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                id={`student-nav-${item.path.replace('/', '') || 'dashboard'}`}
                to={item.path}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 min-h-[36px] ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/60'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
                <span>{item.name}</span>
              </Link>
            );
          })}

          {(activeYear?.label || (activeYear as any)?.name) && (
            <div className="hidden xl:inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-200/70 px-2.5 py-1.5 rounded-xl whitespace-nowrap ml-1">
              <Calendar size={12} className="text-slate-400" />
              <span>{activeYear?.label || (activeYear as any)?.name}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
