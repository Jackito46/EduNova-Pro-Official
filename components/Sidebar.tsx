import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  UserPlus, 
  BookOpen, 
  Settings, 
  ChevronDown, 
  ChevronRight,
  Menu,
  X,
  PenTool,
  ClipboardList,
  Files,
  FileText,
  FileCheck,
  CircleDollarSign,
  Briefcase,
  UserCog,
  GraduationCap,
  CalendarCheck,
  Receipt,
  School,
  Clock,
  ArrowRight,
  Target,
  RefreshCcw,
  LogOut,
  ShieldAlert,
  Package,
  Wallet,
  History,
  Mail,
  MessageSquare,
  MessageCircle,
  HelpCircle,
  Keyboard,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  MapPin,
  Rocket,
  Download,
  UserCircle,
  TrendingUp,
  KeyRound,
  Sparkles,
  Building2,
  Activity
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { motion } from 'framer-motion';
import Modal from './Modal';
import { ChangePasswordModal } from './ChangePasswordModal';
import { LogoutConfirmModal } from './LogoutConfirmModal';

import { useSchool } from '../contexts/SchoolContext';
import Logo from './Logo';
import { usePwaInstall } from '../hooks/usePwaInstall';

import { toast } from 'sonner';

interface SidebarNavLinkProps {
  item: { name: string; path: string; icon?: any };
  isSubItem?: boolean;
  icon?: any;
  isActive: boolean;
  isNarrow: boolean;
  onNavigate: () => void;
}

const SidebarNavLink = React.memo<SidebarNavLinkProps>(({ item, isSubItem = false, icon: Icon, isActive, isNarrow, onNavigate }) => {
  const IconComponent = Icon || item.icon;

  return (
    <Link
      to={item.path}
      className={`relative flex items-center py-1.5 rounded-xl transition-all duration-150 group select-none ${
        isActive 
          ? 'bg-blue-600 text-white font-semibold shadow-sm shadow-blue-500/20' 
          : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
      } ${
        isNarrow 
          ? 'justify-center px-0 min-h-[42px]' 
          : isSubItem 
            ? 'pl-2 pr-1.5 min-h-[36px] text-[12.5px] sm:text-[13px]' 
            : 'px-2.5 min-h-[40px] text-[13.5px]'
      }`}
      onClick={onNavigate}
      title={item.name}
    >
      <div className={`relative z-10 flex items-center gap-2 w-full min-w-0 ${isNarrow ? 'justify-center' : ''}`}>
        {IconComponent && (
          <IconComponent 
            size={isActive ? 17 : isSubItem ? 15 : 18} 
            className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'} shrink-0 transition-colors`} 
          />
        )}
        {!isNarrow && (
          <span 
            className={`${isSubItem ? 'font-medium' : 'font-bold tracking-tight'} text-left truncate flex-1 min-w-0 whitespace-nowrap`} 
            title={item.name}
          >
            {item.name}
          </span>
        )}
      </div>
    </Link>
  );
});
SidebarNavLink.displayName = 'SidebarNavLink';

interface SidebarMenuHeaderProps {
  id: string;
  label: string;
  icon: any;
  isOpen: boolean;
  isNarrow: boolean;
  onToggle: (id: string) => void;
}

const SidebarMenuHeader = React.memo<SidebarMenuHeaderProps>(({ id, label, icon: Icon, isOpen, isNarrow, onToggle }) => (
  <button 
    type="button"
    onClick={() => onToggle(id)} 
    className={`flex items-center justify-between w-full py-2 min-h-[40px] text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 rounded-xl transition-all select-none cursor-pointer ${
      isOpen ? 'text-slate-900 bg-slate-200/50 font-semibold' : ''
    } ${isNarrow ? 'justify-center px-0' : 'px-2.5'}`}
    title={label}
  >
    <div className={`flex items-center gap-2.5 ${isNarrow ? 'justify-center' : ''} flex-1 min-w-0 overflow-hidden`}>
      <Icon size={18} className={`${isOpen ? 'text-blue-600' : 'text-slate-400'} shrink-0 transition-colors`} />
      {!isNarrow && (
        <span className="font-bold tracking-tight text-[13.5px] text-left truncate flex-1 min-w-0 whitespace-nowrap" title={label}>
          {label}
        </span>
      )}
    </div>
    {!isNarrow && (isOpen ? <ChevronDown size={15} className="text-slate-400 shrink-0 ml-1.5" /> : <ChevronRight size={15} className="text-slate-400 opacity-60 shrink-0 ml-1.5" />)}
  </button>
));
SidebarMenuHeader.displayName = 'SidebarMenuHeader';

interface SidebarProps {
  user: UserProfile;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout }) => {
  const { school, terminology, campuses, currentCampusId, setCurrentCampusId, isModuleEnabled } = useSchool();
  const location = useLocation();
  const isFinanceEnabled = isModuleEnabled('finance');
  const isExamsEnabled = isModuleEnabled('exams');
  const isAttendanceEnabled = isModuleEnabled('attendance');
  const isDisciplineEnabled = isModuleEnabled('discipline');
  const isInventoryEnabled = isModuleEnabled('inventory');
  const isSuperAdmin = Boolean(user?.is_super_admin || (user?.role as any) === UserRole.SUPER_ADMIN || (user?.role as any) === 'SUPER_ADMIN');
  const isParent = Boolean(user?.role === UserRole.PARENT || (user?.role as any) === 'PARENT' || (user?.role as any) === 'parent');
  const canAccessShortcuts = Boolean(
    !isParent && (
      isSuperAdmin || 
      user?.role === UserRole.DIRECTOR || 
      (user?.role as any) === 'DIRECTOR' ||
      user?.role === UserRole.SCHOOL_ADMIN ||
      (user?.role as any) === 'SCHOOL_ADMIN' ||
      (user?.role as any) === 'admin'
    )
  );

  const { isInstallable, isInstalled, installPwa } = usePwaInstall();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  
  const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>(() => {
    const p = (typeof window !== 'undefined' ? (window.location.hash || window.location.pathname) : '') || '';
    return {
      espaceEtudiant: p.includes('/profil') || p.includes('/mes-cours') || p.includes('/mon-horaire') || p.includes('/mes-notes') || p.includes('/mon-economat'),
      vieAcademique: p.includes('/eleves') || p.includes('/notes') || p.includes('/presences') || p.includes('/bulletins') || p.includes('/discipline') || p.includes('/horaire') || p.includes('/syllabus'),
      finance: p.includes('/economat'),
      rh: p.includes('/personnel') || p.includes('/pointage'),
      rapports: p.includes('/rapports') || p.includes('/supervision-annexes'),
      communication: p.includes('/communication'),
      config: p.includes('/settings') || p.includes('/classes')
    };
  });
  
  const [sidebarMode, setSidebarMode] = useState<'expanded' | 'collapsed' | 'hover'>(() => {
    return (localStorage.getItem('sidebarMode') as 'expanded' | 'collapsed' | 'hover') || 'expanded';
  });
  const [isHovered, setIsHovered] = useState(false);
  const [showControlMenu, setShowControlMenu] = useState(false);

  useEffect(() => {
    localStorage.setItem('sidebarMode', sidebarMode);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sidebarModeChanged', { detail: sidebarMode }));
    }
  }, [sidebarMode]);

  const isNarrow = sidebarMode === 'collapsed' || (sidebarMode === 'hover' && !isHovered);

  // Role-based access control for sidebar
  const adminRoles = [UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR];
  const financeRoles = [...adminRoles, UserRole.ACCOUNTANT];
  const cashierRoles = [...adminRoles, UserRole.ACCOUNTANT, UserRole.SECRETARY];
  const hrRoles = [...adminRoles];
  const academicRoles = [...adminRoles, UserRole.SECRETARY, UserRole.TEACHER, UserRole.SUPERVISOR];
  const restrictedAcademicRoles = [...adminRoles, UserRole.SECRETARY, UserRole.SUPERVISOR];

  const hasAccess = React.useCallback((allowedRoles: UserRole[]) => {
    if (user.role === UserRole.SUPER_ADMIN || user.is_super_admin) return true;
    return allowedRoles.includes(user.role);
  }, [user.role, user.is_super_admin]);

  const schoolInfo = React.useMemo(() => ({
    name: school?.name || 'EduNova Pro',
    logo_url: school?.logo_url || null
  }), [school?.name, school?.logo_url]);

  const schoolNameLen = (schoolInfo.name || '').length;
  const sidebarSchoolNameClasses = React.useMemo(() => {
    if (schoolNameLen > 55) {
      return "text-[11px] leading-[1.25]";
    }
    if (schoolNameLen > 35) {
      return "text-[11.5px] leading-[1.3]";
    }
    if (schoolNameLen > 20) {
      return "text-[12.5px] leading-snug";
    }
    return "text-[13.5px] leading-snug";
  }, [schoolNameLen]);

  const handleToggleMenu = React.useCallback((menuId: string) => {
    if (isNarrow && sidebarMode === 'collapsed') {
      setSidebarMode('expanded');
      setOpenMenus(prev => ({ ...prev, [menuId]: true }));
    } else {
      setOpenMenus(prev => ({ ...prev, [menuId]: !prev[menuId] }));
    }
  }, [isNarrow, sidebarMode]);

  const handleNavigate = React.useCallback(() => {
    setMobileOpen(false);
  }, []);

  const renderNavLink = React.useCallback((item: { name: string; path: string; icon?: any }, isSubItem = false, icon?: any) => (
    <SidebarNavLink
      key={item.path}
      item={item}
      isSubItem={isSubItem}
      icon={icon}
      isActive={location.pathname === item.path}
      isNarrow={isNarrow}
      onNavigate={handleNavigate}
    />
  ), [location.pathname, isNarrow, handleNavigate]);

  const renderMenuHeader = React.useCallback((id: string, label: string, icon: any) => (
    <SidebarMenuHeader
      key={id}
      id={id}
      label={label}
      icon={icon}
      isOpen={Boolean(openMenus[id])}
      isNarrow={isNarrow}
      onToggle={handleToggleMenu}
    />
  ), [openMenus, isNarrow, handleToggleMenu]);

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <button 
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 min-h-[44px] min-w-[44px] bg-white text-slate-900 border border-slate-200 rounded-xl shadow-sm flex items-center justify-center hover:bg-slate-50 transition-colors print:hidden" 
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <aside 
        className={`${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} fixed lg:static inset-y-0 left-0 z-50 ${isNarrow ? 'w-[280px] lg:w-20' : 'w-[280px] sm:w-[285px] lg:w-[275px] xl:w-[285px] 2xl:w-[295px]'} bg-slate-100 text-slate-800 transition-all duration-300 ease-in-out flex flex-col border-r border-slate-200 shadow-xl lg:shadow-sm print:hidden group`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* LOGO & SCHOOL IDENTITY HEADER */}
        <div className={`relative border-b border-slate-200/80 bg-white/50 backdrop-blur-xs text-left transition-all duration-200 ${
          isNarrow ? 'p-2.5 flex flex-col items-center justify-center gap-2' : 'px-3.5 py-3 flex items-start justify-between gap-2.5'
        }`}>
          <div className={`flex items-start gap-2.5 min-w-0 flex-1 ${isNarrow ? 'justify-center w-full' : ''}`}>
            {/* Logo with rounded squircle badge and active ping */}
            <div 
              className="relative shrink-0 flex items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-105 mt-0.5"
              onClick={() => isNarrow && setSidebarMode('expanded')}
              title={isNarrow ? `${schoolInfo.name} - Cliquer pour agrandir le menu` : schoolInfo.name}
            >
              <div className="p-1 rounded-2xl bg-white shadow-xs border border-slate-200/90 flex items-center justify-center">
                <Logo src={schoolInfo.logo_url || "/logo.png"} size="sm" className="w-9 h-9 object-contain rounded-xl" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border-2 border-white"></span>
              </span>
            </div>

            {/* School Name & Campus / Connecté Status Badges */}
            {!isNarrow && (
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h1 
                  className={`${sidebarSchoolNameClasses} font-black tracking-tight text-slate-900 break-normal [overflow-wrap:anywhere] hover:text-blue-600 transition-colors cursor-default select-text`} 
                  title={schoolInfo.name}
                >
                  {schoolInfo.name}
                </h1>

                {/* Status / Campus pill */}
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  {(() => {
                    if (school?.has_multi_campus && campuses && campuses.length > 1) {
                      const activeCampus = campuses.find(c => c.id === currentCampusId);
                      if (activeCampus) {
                        const isSiege = activeCampus.name.toLowerCase().includes('siège') || activeCampus.id === '3dd425c2-2e23-4e3c-a02a-c67ed85ca490';
                        return (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-extrabold tracking-wide uppercase ${
                            isSiege 
                              ? 'bg-blue-50 text-blue-700 border border-blue-200/70' 
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                          }`}>
                            <MapPin size={10} className={isSiege ? 'text-blue-500' : 'text-emerald-500'} />
                            <span className="truncate max-w-[130px]">{isSiege ? 'Siège Central' : activeCampus.name}</span>
                          </span>
                        );
                      }
                      return (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[9.5px] font-extrabold tracking-wide uppercase">
                          <Building2 size={10} className="text-slate-500" />
                          Vue Globale
                        </span>
                      );
                    }
                    
                    const isUniversity = school?.school_type === 'UNIVERSITY' || /universit|faculté|institut sup/i.test(schoolInfo.name);
                    return (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                        <Sparkles size={11} className={isUniversity ? "text-indigo-500" : "text-amber-500"} />
                        <span>{isUniversity ? 'Université Connectée' : 'École Connectée'}</span>
                      </span>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Header Action Buttons (Quick Collapse/Expand Toggle on Desktop, Close on Mobile) */}
          <div className={`flex items-center shrink-0 ${isNarrow ? 'w-full justify-center' : ''}`}>
            {/* Desktop Quick Collapse/Expand Toggle */}
            <button
              type="button"
              onClick={() => setSidebarMode(isNarrow ? 'expanded' : 'collapsed')}
              className="hidden lg:flex items-center justify-center w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors"
              title={isNarrow ? "Développer le menu latéral" : "Réduire le menu latéral"}
              aria-label="Basculer l'affichage du menu"
            >
              {isNarrow ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>

            {/* Mobile Drawer Close Button */}
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="lg:hidden flex items-center justify-center w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors"
              aria-label="Fermer le menu"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* CAMPUS SELECTOR AREA */}
        {school?.has_multi_campus && hasAccess([UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR]) && (!user.campus_id || user.is_super_admin || user.role === UserRole.SUPER_ADMIN) && campuses && campuses.length > 1 && (
          <div className={`px-3 py-2 border-b border-slate-200/80 bg-slate-50/70 transition-all ${
            isNarrow ? 'flex justify-center py-2 px-1' : ''
          }`}>
            {isNarrow ? (
              <button 
                type="button"
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200/90 shadow-2xs text-blue-600 hover:bg-blue-50/60 hover:border-blue-300 transition-all"
                title={`Annexe : ${campuses.find(c => c.id === currentCampusId)?.name || 'Tous les campus'} (Cliquer pour développer)`}
                onClick={() => setSidebarMode('expanded')}
              >
                <School size={17} />
              </button>
            ) : (
              <div className="relative group/campus">
                <div className="relative flex items-center bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-blue-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100/80 transition-all">
                  <div className="pl-2.5 pr-1 text-blue-600 pointer-events-none shrink-0">
                    <Building2 size={14} />
                  </div>
                  <select
                    value={currentCampusId || ''}
                    onChange={(e) => setCurrentCampusId(e.target.value ? e.target.value : null)}
                    className="w-full py-1.5 pl-1 pr-7 bg-transparent text-[12px] font-bold text-slate-700 appearance-none focus:outline-none cursor-pointer truncate select-none"
                    title="Sélectionner l'annexe ou le campus d'activité"
                  >
                    <option value="">🌍 Tous les Campus (Vue Globale)</option>
                    {campuses.map((campus) => (
                      <option key={campus.id} value={campus.id}>
                        📍 {campus.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none shrink-0">
                    <ChevronDown size={13} className="transition-transform group-hover/campus:translate-y-0.5" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* NAVIGATION */}
        <nav className="flex-1 px-2 sm:px-2.5 space-y-1 overflow-y-auto mt-4 sidebar-scrollbar pb-10">
          {renderNavLink({ name: 'Tableau de Bord', path: '/', icon: LayoutDashboard })}

          {user.role === UserRole.STUDENT && (
            <div className="space-y-1 pt-2">
               {renderMenuHeader("espaceEtudiant", "Mon Espace ÉduNova", GraduationCap)}
               {openMenus.espaceEtudiant && (
                 <div className="space-y-0.5 animate-in slide-in-from-top-2 duration-200 border-l-2 border-slate-200/80 ml-2.5 pl-1">
                   {renderNavLink({ name: 'Mon Profil', path: '/profil' }, true, UserCircle)}
                   {renderNavLink({ name: 'Mes Cours', path: '/mes-cours' }, true, BookOpen)}
                   {renderNavLink({ name: 'Mon Horaire', path: '/mon-horaire' }, true, Clock)}
                   {isExamsEnabled && renderNavLink({ name: 'Mes Notes', path: '/mes-notes' }, true, TrendingUp)}
                   {isFinanceEnabled && renderNavLink({ name: 'Mon Économat', path: '/mon-economat' }, true, Receipt)}
                 </div>
               )}
            </div>
          )}

          {hasAccess(academicRoles) && (
            <div className="space-y-1 pt-2">
              {renderMenuHeader("vieAcademique", "Gestion Académique", GraduationCap)}
              {openMenus.vieAcademique && (
                <div className="space-y-0.5 animate-in slide-in-from-top-2 duration-200 border-l-2 border-slate-200/80 ml-2.5 pl-1">
                  {hasAccess(restrictedAcademicRoles) && renderNavLink({ name: `Registre ${terminology.students}`, path: '/eleves' }, true, Users)}
                  {hasAccess([...adminRoles, UserRole.SECRETARY]) && renderNavLink({ name: 'Validation de Dossiers', path: '/eleves/validation' }, true, FileCheck)}
                  {hasAccess([...adminRoles, UserRole.SECRETARY]) && renderNavLink({ name: terminology.enrollment, path: '/eleves/ajouter' }, true, UserPlus)}
                  {school?.school_type !== 'CLASSIC' && (
                    renderNavLink({ name: 'Syllabus d\'évaluations', path: '/enseignant/syllabus' }, true, BookOpen)
                  )}
                  {isExamsEnabled && renderNavLink({ name: 'Saisie des Notes', path: '/notes' }, true, ClipboardList)}
                  {hasAccess(academicRoles) && isAttendanceEnabled && renderNavLink({ name: 'Présences', path: '/presences' }, true, CalendarCheck)}
                  {hasAccess(restrictedAcademicRoles) && isExamsEnabled && renderNavLink({ name: 'Bulletins', path: '/bulletins' }, true, Files)}
                  {hasAccess(academicRoles) && isDisciplineEnabled && renderNavLink({ name: 'Discipline', path: '/discipline' }, true, ShieldAlert)}
                  {hasAccess(academicRoles) && renderNavLink({ name: 'Emplois du Temps', path: '/horaire' }, true, Clock)}
                </div>
              )}
            </div>
          )}

          {hasAccess([...hrRoles, UserRole.SECRETARY]) && (
            <div className="space-y-1">
              {renderMenuHeader("rh", "Ressources Humaines", Briefcase)}
              {openMenus.rh && (
                <div className="space-y-0.5 animate-in slide-in-from-top-2 duration-200 border-l-2 border-slate-200/80 ml-2.5 pl-1">
                  {hasAccess(hrRoles) && renderNavLink({ name: 'Registre RH', path: '/personnel' }, true, Users)}
                  {hasAccess(adminRoles) && renderNavLink({ name: 'Recrutement', path: '/personnel/embaucher' }, true, UserPlus)}
                  {hasAccess(hrRoles) && renderNavLink({ name: 'Présences Employés', path: '/personnel/pointage' }, true, ClipboardList)}
                  {hasAccess([...adminRoles, UserRole.SECRETARY]) && renderNavLink({ name: 'Signatures des Cours', path: '/enseignant/pointage' }, true, PenTool)}
                </div>
              )}
            </div>
          )}

          {hasAccess(cashierRoles) && isFinanceEnabled && (
            <div className="space-y-1">
              {renderMenuHeader("finance", "Finance", CircleDollarSign)}
              {openMenus.finance && (
                <div className="space-y-0.5 animate-in slide-in-from-top-2 duration-200 border-l-2 border-slate-200/80 ml-2.5 pl-1">
                  {hasAccess([...adminRoles, UserRole.ACCOUNTANT]) && renderNavLink({ name: 'Direction Économat', path: '/economat' }, true, Target)}
                  {renderNavLink({ name: 'Guichet d’Encaissement', path: '/economat/frais' }, true, Receipt)}
                  {renderNavLink({ name: 'Factures (Réimpression)', path: '/economat/factures' }, true, Files)}
                  {renderNavLink({ name: 'Relevé de Compte', path: '/economat/releves' }, true, FileText)}
                  {hasAccess([...adminRoles, UserRole.ACCOUNTANT]) && renderNavLink({ name: 'Registre & Validations', path: '/economat/liste' }, true, History)}
                  {hasAccess([...adminRoles, UserRole.ACCOUNTANT]) && renderNavLink({ name: 'Registre Dépenses', path: '/economat/depenses' }, true, ArrowRight)}
                  {hasAccess([...adminRoles, UserRole.ACCOUNTANT]) && renderNavLink({ name: 'Gestion Payroll', path: '/economat/paie' }, true, Wallet)}
                  {isInventoryEnabled && renderNavLink({ name: 'Fournitures & Stocks', path: '/economat/fournitures' }, true, Package)}
                  {hasAccess(adminRoles) && renderNavLink({ name: 'Réévaluations', path: '/economat/derogations' }, true, RefreshCcw)}
                  {hasAccess([...adminRoles, UserRole.ACCOUNTANT]) && renderNavLink({ name: 'Campagnes & Événements', path: '/economat/frais-occasionnels' }, true, Rocket)}
                </div>
              )}
            </div>
          )}

          {hasAccess([...adminRoles, UserRole.ACCOUNTANT]) && (
            <div className="space-y-1">
              {renderMenuHeader("rapports", "Direction & Rapports", Target)}
              {openMenus.rapports && (
                <div className="space-y-0.5 animate-in slide-in-from-top-2 duration-200 border-l-2 border-slate-200/80 ml-2.5 pl-1">
                  {renderNavLink({ name: 'Rapports & Bilans', path: '/rapports' }, true, Files)}
                  {school?.has_multi_campus && !user.campus_id && (
                    renderNavLink({ name: 'Supervision Multi-Annexes', path: '/supervision-annexes' }, true, Building2)
                  )}
                </div>
              )}
            </div>
          )}

          {hasAccess(adminRoles) && (
            <div className="space-y-1">
              {renderMenuHeader("communication", "Communication", MessageSquare)}
              {openMenus.communication && (
                <div className="space-y-0.5 animate-in slide-in-from-top-2 duration-200 border-l-2 border-slate-200/80 ml-2.5 pl-1">
                  {renderNavLink({ name: 'WhatsApp', path: '/communication/whatsapp' }, true, MessageCircle)}
                  {renderNavLink({ name: 'Emailing', path: '/communication/email' }, true, Mail)}
                  {renderNavLink({ name: 'SMS', path: '/communication/sms' }, true, MessageSquare)}
                  {renderNavLink({ name: 'Notifications Push', path: '/communication/push' }, true, Target)}
                </div>
              )}
            </div>
          )}

          {hasAccess(adminRoles) && (
            <div className="space-y-1">
              {renderMenuHeader("config", "Configuration", Settings)}
              {openMenus.config && (
                <div className="space-y-0.5 animate-in slide-in-from-top-2 duration-200 border-l-2 border-slate-200/80 ml-2.5 pl-1">
                  {renderNavLink({ name: 'Identité Établissement', path: '/settings/ecole' }, true, School)}
                  {renderNavLink({ name: `${terminology.classes} & ${terminology.subjects}`, path: '/classes' }, true, BookOpen)}
                  {renderNavLink({ name: `Planification ${terminology.academicYear}`, path: '/economat/planification' }, true, CalendarCheck)}
                  {renderNavLink({ name: 'Utilisateurs', path: '/settings/utilisateurs' }, true, UserCog)}
                  {renderNavLink({ name: 'Journal d\'Audit', path: '/settings/audit' }, true, History)}
                </div>
              )}
            </div>
          )}

          {isSuperAdmin && (
            <div className="mt-8 pt-4 border-t border-slate-200 space-y-1">
              {renderNavLink({ name: 'Super Administrateur', path: '/super-admin', icon: ShieldAlert })}
              {renderNavLink({ name: 'Santé Système & Quotas', path: '/super-admin/system-health', icon: Activity })}
            </div>
          )}
        </nav>

        {/* FOOTER ACTIONS & LOGOUT - MODERN INTERNATIONAL STANDARD */}
        <div className={`p-3 border-t border-slate-200/80 bg-slate-50/50 ${isNarrow ? 'flex flex-col items-center gap-3 relative' : 'relative'}`}>
          <div className={`flex items-center ${isNarrow ? 'flex-col gap-2 w-full justify-center' : 'justify-between gap-1 bg-slate-100/70 p-1.5 rounded-2xl border border-slate-200/60'}`}>
            
            {canAccessShortcuts && (
              <button
                type="button"
                onClick={() => document.dispatchEvent(new CustomEvent('openShortcutHelp'))}
                className={`hidden lg:flex rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-xs transition-all outline-none items-center justify-center cursor-pointer ${
                  isNarrow ? 'w-10 h-10 bg-slate-50 border border-slate-200/60' : 'flex-1 h-9'
                }`}
                title={`Raccourcis Clavier (Ctrl+/) • ${user.full_name || user.email}`}
                aria-label="Raccourcis Clavier"
              >
                <Keyboard size={18} />
              </button>
            )}

            {!isInstalled && (
              <button
                type="button"
                onClick={installPwa}
                className={`rounded-xl transition-all outline-none flex items-center justify-center cursor-pointer text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-xs ${
                  isNarrow ? 'w-10 h-10 bg-slate-50 border border-slate-200/60' : 'flex-1 h-9'
                }`}
                title="Installer l'application sur cet appareil (PWA)"
                aria-label="Installer l'application"
              >
                <Download size={18} />
              </button>
            )}

            <div className={`relative group/control hidden lg:block ${isNarrow ? 'w-10' : 'flex-1'}`}>
              <button 
                type="button"
                onClick={() => setShowControlMenu(!showControlMenu)} 
                className={`w-full rounded-xl flex items-center justify-center transition-all outline-none cursor-pointer ${
                  showControlMenu 
                    ? 'bg-white shadow-xs text-blue-600 border border-slate-200' 
                    : 'text-slate-400 hover:text-slate-900 hover:bg-white hover:shadow-xs'
                } ${isNarrow ? 'h-10 bg-slate-50 border border-slate-200/60' : 'h-9'}`}
                title="Affichage & Contrôle du menu latéral"
                aria-label="Affichage du menu"
              >
                <PanelLeft size={18} />
              </button>
              {showControlMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowControlMenu(false)}></div>
                  <div className={`absolute z-50 bottom-12 ${isNarrow ? 'left-12' : 'left-0'} w-52 bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] border border-slate-200 text-sm overflow-hidden transform transition-all`}>
                    <div className="px-4 py-2.5 text-xs font-bold text-slate-500 bg-slate-50 border-b border-slate-100">
                      Affichage du menu
                    </div>
                    <button 
                      type="button"
                      onClick={() => { setSidebarMode('expanded'); setShowControlMenu(false); }} 
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-[13px] text-slate-700 flex items-center gap-2.5 cursor-pointer"
                    >
                      <span className={`w-2 h-2 rounded-full ${sidebarMode === 'expanded' ? 'bg-blue-600 ring-4 ring-blue-100' : 'bg-slate-300'}`}></span> 
                      <span className={sidebarMode === 'expanded' ? 'font-bold text-slate-900' : 'font-medium'}>Déplié (Standard)</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => { setSidebarMode('collapsed'); setShowControlMenu(false); }} 
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-[13px] text-slate-700 flex items-center gap-2.5 cursor-pointer"
                    >
                      <span className={`w-2 h-2 rounded-full ${sidebarMode === 'collapsed' ? 'bg-blue-600 ring-4 ring-blue-100' : 'bg-slate-300'}`}></span> 
                      <span className={sidebarMode === 'collapsed' ? 'font-bold text-slate-900' : 'font-medium'}>Réduit (Icônes)</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => { setSidebarMode('hover'); setShowControlMenu(false); }} 
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-[13px] text-slate-700 flex items-center gap-2.5 cursor-pointer"
                    >
                      <span className={`w-2 h-2 rounded-full ${sidebarMode === 'hover' ? 'bg-blue-600 ring-4 ring-blue-100' : 'bg-slate-300'}`}></span> 
                      <span className={sidebarMode === 'hover' ? 'font-bold text-slate-900' : 'font-medium'}>Déplier au survol</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            <button 
              type="button"
              onClick={() => setIsChangePasswordModalOpen(true)}
              className={`rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-xs transition-all active:scale-95 group flex items-center justify-center cursor-pointer ${
                isNarrow ? 'w-10 h-10 bg-slate-50 border border-slate-200/60' : 'flex-1 h-9'
              }`}
              title="Sécurité & Changement de mot de passe"
              aria-label="Changer le mot de passe"
            >
              <KeyRound size={18} className="group-hover:rotate-12 transition-transform" />
            </button>

            <button 
              type="button"
              onClick={() => setIsLogoutModalOpen(true)}
              className={`rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50/80 hover:shadow-xs transition-all active:scale-95 group flex items-center justify-center cursor-pointer ${
                isNarrow ? 'w-10 h-10 bg-slate-50 border border-slate-200/60' : 'flex-1 h-9'
              }`}
              title={`Déconnexion (${user.full_name || user.email})`}
              aria-label="Déconnexion"
            >
              <LogOut size={18} className="group-hover:translate-x-0.5 transition-transform" />
            </button>

          </div>
        </div>
      </aside>

      {/* MODAL CHANGEMENT DE MOT DE PASSE POUR TOUS LES UTILISATEURS */}
      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
        user={user}
      />

      {/* CONFIRMATION DE DÉCONNEXION MODERNE */}
      <LogoutConfirmModal 
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={() => {
          setIsLogoutModalOpen(false);
          onLogout();
        }}
        user={user}
      />
    </>
  );
};

export default React.memo(Sidebar);