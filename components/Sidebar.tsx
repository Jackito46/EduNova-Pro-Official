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
  Rocket,
  Download,
  UserCircle,
  TrendingUp,
  KeyRound,
  Sparkles,
  Building2
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

interface SidebarProps {
  user: UserProfile;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout }) => {
  const { school, terminology, campuses, currentCampusId, setCurrentCampusId } = useSchool();
  const isPresencesEnabled = school?.global_settings?.modules?.presences ?? (school?.school_type !== 'UNIVERSITY' && school?.school_type !== 'PROFESSIONAL');
  const isDisciplineEnabled = school?.global_settings?.modules?.discipline ?? (school?.school_type !== 'UNIVERSITY' && school?.school_type !== 'PROFESSIONAL');

  const { isInstallable, isInstalled, installPwa } = usePwaInstall();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({
    vieAcademique: false,
    finance: false, 
    rh: false,
    communication: false,
    config: false,
    rapports: false
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
  
  const location = useLocation();

  // Role-based access control for sidebar
  const adminRoles = [UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR];
  const financeRoles = [...adminRoles, UserRole.ACCOUNTANT];
  const cashierRoles = [...adminRoles, UserRole.ACCOUNTANT, UserRole.SECRETARY];
  const hrRoles = [...adminRoles]; // Removed SECRETARY from hrRoles
  const academicRoles = [...adminRoles, UserRole.SECRETARY, UserRole.TEACHER, UserRole.SUPERVISOR];
  const restrictedAcademicRoles = [...adminRoles, UserRole.SECRETARY, UserRole.SUPERVISOR];

  const hasAccess = (allowedRoles: UserRole[]) => {
    if (user.role === UserRole.SUPER_ADMIN || user.is_super_admin) return true;
    return allowedRoles.includes(user.role);
  };

  const schoolInfo = {
    name: school?.name || 'EduNova Pro',
    logo_url: school?.logo_url || null
  };

  const toggleMenu = (menu: string) => {
    setOpenMenus(prev => ({ ...prev, [menu]: !prev[menu] }));
  };

  const NavLink: React.FC<{ item: any; isSubItem?: boolean; icon?: any }> = ({ item, isSubItem = false, icon: Icon }) => {
    const isActive = location.pathname === item.path;
    const IconComponent = Icon || item.icon;

    return (
      <Link
        to={item.path}
        className={`relative flex items-center gap-3 py-3 min-h-[44px] rounded-xl transition-all group ${
          isActive 
            ? 'text-white font-semibold' 
            : `text-slate-500 hover:bg-slate-200/50 hover:text-slate-900 text-[14px]`
        } ${isNarrow ? 'justify-center px-0' : (isSubItem ? 'pl-10 pr-4' : 'px-4')}`}
        onClick={() => setMobileOpen(false)}
        title={isNarrow ? item.name : undefined}
      >
        {isActive && (
          <motion.div
            layoutId="active-sidebar-pill"
            className="absolute inset-0 bg-blue-600 rounded-xl shadow-md shadow-blue-500/25"
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            style={{ zIndex: 0 }}
          />
        )}
        <span className="relative z-10 flex items-center gap-3 w-full">
          {IconComponent && <IconComponent size={isActive ? 20 : isSubItem ? 18 : 20} className={`${isActive ? 'text-white' : 'text-slate-400'} shrink-0`} />}
          {!isNarrow && <span className={`${isSubItem ? 'font-medium' : 'font-bold tracking-tight'} text-left break-words`}>{item.name}</span>}
        </span>
      </Link>
    );
  };

  const MenuHeader: React.FC<{ id: string; label: string; icon: any }> = ({ id, label, icon: Icon }) => (
    <button 
      onClick={() => {
        if (isNarrow && sidebarMode === 'collapsed') {
           setSidebarMode('expanded'); // Auto expand on click if closed and clicked
           setOpenMenus(prev => ({ ...prev, [id]: true }));
        } else {
           toggleMenu(id);
        }
      }} 
      className={`flex items-center justify-between w-full py-3 min-h-[44px] text-slate-500 hover:bg-slate-200/50 hover:text-slate-900 rounded-xl transition-all hover-tremble ${openMenus[id] ? 'text-slate-900 bg-slate-200/50' : ''} ${isNarrow ? 'justify-center px-0' : 'px-4'}`}
      title={isNarrow ? label : undefined}
    >
      <div className={`flex items-center gap-3 ${isNarrow ? 'justify-center' : ''} flex-1 overflow-hidden`}>
        <Icon size={20} className={`${openMenus[id] ? 'text-blue-600' : 'text-slate-400'} shrink-0`} />
        {!isNarrow && <span className="font-bold tracking-tight text-[14px] text-left break-words">{label}</span>}
      </div>
      {!isNarrow && (openMenus[id] ? <ChevronDown size={16} className="text-slate-400 shrink-0 ml-2" /> : <ChevronRight size={16} className="text-slate-400 opacity-60 shrink-0 ml-2" />)}
    </button>
  );

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
        className={`${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} fixed lg:static inset-y-0 left-0 z-50 ${isNarrow ? 'w-[280px] lg:w-20' : 'w-[280px] lg:w-[300px]'} bg-slate-100 text-slate-800 transition-all duration-300 ease-in-out flex flex-col border-r border-slate-200 shadow-xl lg:shadow-sm print:hidden group`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* LOGO AREA */}
        <div className={`p-4 flex items-center gap-3 border-b border-slate-200 bg-transparent min-h-[88px] text-left ${isNarrow ? 'justify-center lg:px-2' : ''}`}>
          <Logo src={schoolInfo.logo_url || "/logo.png"} size="md" className="ring-offset-2 ring-offset-slate-100" />
          {!isNarrow && (
            <div className="overflow-hidden flex-1 relative flex flex-col gap-1.5">
              <h1 className="text-[12px] font-black tracking-tight text-slate-900 leading-tight uppercase line-clamp-3 md:line-clamp-2" title={schoolInfo.name}>
                {schoolInfo.name}
              </h1>
              {(() => {
                if (!school?.has_multi_campus || (campuses && campuses.length <= 1)) {
                  return null;
                }
                // If the logged-in user is a global / Siège Social administrator with the dropdown selector,
                // we do not need to display the badge here to avoid repeating "Siège Social" or "Vue Globale" twice.
                if (!user.campus_id && campuses && campuses.length > 1) {
                  return null;
                }
                const activeCampus = campuses?.find(c => c.id === currentCampusId);
                if (activeCampus) {
                  const isSiege = activeCampus.name.toLowerCase().includes('siège') || activeCampus.id === '3dd425c2-2e23-4e3c-a02a-c67ed85ca490';
                  if (isSiege) {
                    return (
                      <span className="self-start px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-md text-[9px] font-black uppercase tracking-wider whitespace-nowrap">
                        Siège Social
                      </span>
                    );
                  } else {
                    return (
                      <span className="self-start px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">
                        📍 Annexe : {activeCampus.name}
                      </span>
                    );
                  }
                } else if (campuses && campuses.length > 1) {
                  return (
                    <span className="self-start px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-[9px] font-extrabold uppercase tracking-wider whitespace-nowrap">
                      Vue Globale
                    </span>
                  );
                }
                return null;
              })()}
            </div>
          )}
        </div>

        {/* CAMPUS SELECTOR AREA */}
        {school?.has_multi_campus && hasAccess([UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR]) && !user.campus_id && campuses && campuses.length > 1 && (
          <div className={`px-4 py-3 border-b border-slate-200 bg-slate-50/50 ${isNarrow ? 'flex justify-center' : ''}`}>
            {isNarrow ? (
              <div 
                className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-sm text-blue-600 cursor-pointer hover:bg-slate-50"
                title={campuses.find(c => c.id === currentCampusId)?.name || 'Tous les campus'}
                onClick={() => setSidebarMode('expanded')}
              >
                <School size={18} />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest leading-none">
                  Filière / Campus / Annexe
                </label>
                <div className="relative">
                  <select
                    value={currentCampusId || ''}
                    onChange={(e) => setCurrentCampusId(e.target.value ? e.target.value : null)}
                    className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 rounded-lg text-xs font-bold text-slate-700 appearance-none shadow-sm cursor-pointer hover:bg-slate-50/80 transition-all select-none"
                  >
                    <option value="">🌍 Vue Globale (Tous)</option>
                    {campuses.map((campus) => (
                      <option key={campus.id} value={campus.id}>
                        📍 {campus.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <School size={14} className="text-slate-400" />
                  </div>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <ChevronDown size={12} className="text-slate-400" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* NAVIGATION */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto mt-6 sidebar-scrollbar pb-10">
          <NavLink item={{ name: 'Tableau de Bord', path: '/', icon: LayoutDashboard }} />

          {user.role === UserRole.STUDENT && (
            <div className="space-y-1 pt-2">
               <MenuHeader id="espaceEtudiant" label="Mon Espace ÉduNova" icon={GraduationCap} />
               {openMenus.espaceEtudiant && (
                 <div className="space-y-0.5 animate-in slide-in-from-top-2 duration-200 border-l border-slate-200 ml-6">
                   <NavLink isSubItem icon={UserCircle} item={{ name: 'Mon Profil', path: '/profil' }} />
                   <NavLink isSubItem icon={BookOpen} item={{ name: 'Mes Cours', path: '/mes-cours' }} />
                   <NavLink isSubItem icon={Clock} item={{ name: 'Mon Horaire', path: '/mon-horaire' }} />
                   <NavLink isSubItem icon={TrendingUp} item={{ name: 'Mes Notes', path: '/mes-notes' }} />
                   <NavLink isSubItem icon={Receipt} item={{ name: 'Mon Économat', path: '/mon-economat' }} />
                 </div>
               )}
            </div>
          )}

          {hasAccess(academicRoles) && (
            <div className="space-y-1 pt-2">
              <MenuHeader id="vieAcademique" label="Gestion Académique" icon={GraduationCap} />
              {openMenus.vieAcademique && (
                <div className="space-y-0.5 animate-in slide-in-from-top-2 duration-200 border-l border-slate-200 ml-6">
                  {hasAccess(restrictedAcademicRoles) && <NavLink isSubItem icon={Users} item={{ name: `Registre ${terminology.students}`, path: '/eleves' }} />}
                  {hasAccess([...adminRoles, UserRole.SECRETARY]) && <NavLink isSubItem icon={FileCheck} item={{ name: 'Validation de Dossiers', path: '/eleves/validation' }} />}
                  {hasAccess([...adminRoles, UserRole.SECRETARY]) && <NavLink isSubItem icon={UserPlus} item={{ name: terminology.enrollment, path: '/eleves/ajouter' }} />}
                  {school?.school_type !== 'CLASSIC' && (
                    <NavLink isSubItem icon={BookOpen} item={{ name: 'Syllabus d\'évaluations', path: '/enseignant/syllabus' }} />
                  )}
                  <NavLink isSubItem icon={ClipboardList} item={{ name: 'Saisie des Notes', path: '/notes' }} />
                  {hasAccess(restrictedAcademicRoles) && isPresencesEnabled && <NavLink isSubItem icon={CalendarCheck} item={{ name: 'Présences', path: '/presences' }} />}
                  {hasAccess(restrictedAcademicRoles) && <NavLink isSubItem icon={Files} item={{ name: 'Bulletins', path: '/bulletins' }} />}
                  {hasAccess(academicRoles) && isDisciplineEnabled && <NavLink isSubItem icon={ShieldAlert} item={{ name: 'Discipline', path: '/discipline' }} />}
                  {hasAccess(restrictedAcademicRoles) && <NavLink isSubItem icon={Clock} item={{ name: 'Emplois du Temps', path: '/horaire' }} />}
                </div>
              )}
            </div>
          )}

          {hasAccess([...hrRoles, UserRole.SECRETARY]) && (
            <div className="space-y-1">
              <MenuHeader id="rh" label="Ressources Humaines" icon={Briefcase} />
              {openMenus.rh && (
                <div className="space-y-0.5 animate-in slide-in-from-top-2 duration-200 border-l border-slate-200 ml-6">
                  {hasAccess(hrRoles) && <NavLink isSubItem icon={Users} item={{ name: 'Registre RH', path: '/personnel' }} />}
                  {hasAccess(adminRoles) && <NavLink isSubItem icon={UserPlus} item={{ name: 'Recrutement', path: '/personnel/embaucher' }} />}
                  {hasAccess(hrRoles) && <NavLink isSubItem icon={ClipboardList} item={{ name: 'Présences Employés', path: '/personnel/pointage' }} />}
                  {hasAccess([...adminRoles, UserRole.SECRETARY]) && <NavLink isSubItem icon={PenTool} item={{ name: 'Signatures des Cours', path: '/enseignant/pointage' }} />}
                </div>
              )}
            </div>
          )}

          {hasAccess(cashierRoles) && (
            <div className="space-y-1">
              <MenuHeader id="finance" label="Finance" icon={CircleDollarSign} />
              {openMenus.finance && (
                <div className="space-y-0.5 animate-in slide-in-from-top-2 duration-200 border-l border-slate-200 ml-6">
                  {hasAccess([...adminRoles, UserRole.ACCOUNTANT]) && <NavLink isSubItem icon={Target} item={{ name: 'Direction Économat', path: '/economat' }} />}
                  <NavLink isSubItem icon={Receipt} item={{ name: 'Guichet d’Encaissement', path: '/economat/frais' }} />
                  <NavLink isSubItem icon={Files} item={{ name: 'Factures (Réimpression)', path: '/economat/factures' }} />
                  <NavLink isSubItem icon={FileText} item={{ name: 'Relevé de Compte', path: '/economat/releves' }} />
                  {hasAccess([...adminRoles, UserRole.ACCOUNTANT]) && <NavLink isSubItem icon={History} item={{ name: 'Registre & Validations', path: '/economat/liste' }} />}
                  {hasAccess([...adminRoles, UserRole.ACCOUNTANT]) && <NavLink isSubItem icon={ArrowRight} item={{ name: 'Registre Dépenses', path: '/economat/depenses' }} />}
                  {hasAccess([...adminRoles, UserRole.ACCOUNTANT]) && <NavLink isSubItem icon={Wallet} item={{ name: 'Gestion Payroll', path: '/economat/paie' }} />}
                  <NavLink isSubItem icon={Package} item={{ name: 'Fournitures', path: '/economat/fournitures' }} />
                  {hasAccess(adminRoles) && <NavLink isSubItem icon={RefreshCcw} item={{ name: 'Réévaluations', path: '/economat/derogations' }} />}
                  {hasAccess([...adminRoles, UserRole.ACCOUNTANT]) && <NavLink isSubItem icon={Rocket} item={{ name: 'Campagnes & Événements', path: '/economat/frais-occasionnels' }} />}
                </div>
              )}
            </div>
          )}

          {hasAccess([...adminRoles, UserRole.ACCOUNTANT]) && (
            <div className="space-y-1">
              <MenuHeader id="rapports" label="Direction & Rapports" icon={Target} />
              {openMenus.rapports && (
                <div className="space-y-0.5 animate-in slide-in-from-top-2 duration-200 border-l border-slate-200 ml-6">
                  <NavLink isSubItem icon={Files} item={{ name: 'Rapports & Bilans', path: '/rapports' }} />
                  {school?.has_multi_campus && !user.campus_id && (
                    <NavLink isSubItem icon={Building2} item={{ name: 'Supervision Multi-Annexes', path: '/supervision-annexes' }} />
                  )}
                </div>
              )}
            </div>
          )}

          {hasAccess(adminRoles) && (
            <div className="space-y-1">
              <MenuHeader id="communication" label="Communication" icon={MessageSquare} />
              {openMenus.communication && (
                <div className="space-y-0.5 animate-in slide-in-from-top-2 duration-200 border-l border-slate-200 ml-6">
                  <NavLink isSubItem icon={MessageCircle} item={{ name: 'WhatsApp', path: '/communication/whatsapp' }} />
                  <NavLink isSubItem icon={Mail} item={{ name: 'Emailing', path: '/communication/email' }} />
                  <NavLink isSubItem icon={MessageSquare} item={{ name: 'SMS', path: '/communication/sms' }} />
                  <NavLink isSubItem icon={Target} item={{ name: 'Notifications Push', path: '/communication/push' }} />
                </div>
              )}
            </div>
          )}

          {hasAccess(adminRoles) && (
            <div className="space-y-1">
              <MenuHeader id="config" label="Configuration" icon={Settings} />
              {openMenus.config && (
                <div className="space-y-0.5 animate-in slide-in-from-top-2 duration-200 border-l border-slate-200 ml-6">
                  <NavLink isSubItem icon={School} item={{ name: 'Identité Établissement', path: '/settings/ecole' }} />
                  <NavLink isSubItem icon={BookOpen} item={{ name: `${terminology.classes} & ${terminology.subjects}`, path: '/classes' }} />
                  <NavLink isSubItem icon={CalendarCheck} item={{ name: `Planification ${terminology.academicYear}`, path: '/economat/planification' }} />
                  <NavLink isSubItem icon={UserCog} item={{ name: 'Utilisateurs', path: '/settings/utilisateurs' }} />
                  <NavLink isSubItem icon={History} item={{ name: 'Journal d\'Audit', path: '/settings/audit' }} />
                </div>
              )}
            </div>
          )}

          {user.is_super_admin && (
            <div className="mt-8 pt-4 border-t border-slate-200">
              <NavLink item={{ name: 'Super Administrateur', path: '/super-admin', icon: ShieldAlert }} />
            </div>
          )}
        </nav>

        {/* FOOTER ACTIONS & LOGOUT - MODERN INTERNATIONAL STANDARD */}
        <div className={`p-3 border-t border-slate-200/80 bg-slate-50/50 ${isNarrow ? 'flex flex-col items-center gap-3 relative' : 'relative'}`}>
          <div className={`flex items-center ${isNarrow ? 'flex-col gap-2 w-full justify-center' : 'justify-between gap-1 bg-slate-100/70 p-1.5 rounded-2xl border border-slate-200/60'}`}>
            
            {user?.role !== UserRole.STUDENT && user?.role !== UserRole.PARENT && (
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

export default Sidebar;