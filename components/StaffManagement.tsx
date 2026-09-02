import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Search, Plus, MoreVertical, Briefcase, RefreshCcw, BookOpen, WifiOff, BadgeCheck, Edit2, Trash2, ChevronRight, UserCog, AlertTriangle, X, ShieldAlert,
  Loader2, Clock, Settings, FileText, TrendingUp, History, LayoutGrid, List, Phone, Mail, Banknote, Coins, UserCheck, Shield, Sparkles, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { supabase, isValidUuid } from '../supabase';
import { StaffMember, UserProfile, UserRole } from '../types';
import Modal from './Modal';
import { AuditLogger } from '../utils/auditLogger';
import { formatStudentName } from '../utils/formatters';
import StaffRolesManager from './StaffRolesManager';
import SettlementSlip from './SettlementSlip';
import SalaryUpdateModal from './SalaryUpdateModal';
import SalaryHistoryModal from './SalaryHistoryModal';
import StaffDetailModal from './StaffDetailModal';
import { useSchool } from '../contexts/SchoolContext';
import { ModernRegistrySkeleton, SkeletonCard, SkeletonTable, FluidLoadingState } from './SkeletonLoader';

const StaffManagement: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { currentCampusId, campuses } = useSchool();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);
  
  const [deleteCandidate, setDeleteCandidate] = useState<StaffMember | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [fireCandidate, setFireCandidate] = useState<StaffMember | null>(null);
  const [isFiring, setIsFiring] = useState(false);
  const [fireReason, setFireReason] = useState('');
  const [noticeAmount, setNoticeAmount] = useState<string>('');
  const [isRolesManagerOpen, setIsRolesManagerOpen] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState<StaffMember | null>(null);
  const [schoolName, setSchoolName] = useState('EduNova Pro');

  const [salaryUpdateTarget, setSalaryUpdateTarget] = useState<StaffMember | null>(null);
  const [salaryHistoryTarget, setSalaryHistoryTarget] = useState<StaffMember | null>(null);
  const [viewingStaff, setViewingStaff] = useState<StaffMember | null>(null);

  const [isRehiring, setIsRehiring] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [contractFilter, setContractFilter] = useState<'all' | 'Permanent' | 'Vacationnaire'>('all');

  const fetchStaff = useCallback(async () => {
    if (!user?.school_id) return;
    setLoading(true);
    try {
      let staffQuery = supabase
          .from('staff')
          .select('*')
          .eq('school_id', user.school_id)
          .order('last_name', { ascending: true });

      if (currentCampusId && isValidUuid(currentCampusId)) {
        staffQuery = staffQuery.eq('campus_id', currentCampusId);
      }

      const [staffRes, schoolRes] = await Promise.all([
        staffQuery,
        supabase
          .from('schools')
          .select('name')
          .eq('id', user.school_id)
          .single()
      ]);

      if (staffRes.error) throw staffRes.error;
      if (schoolRes.data) setSchoolName(schoolRes.data.name);

      if (staffRes.data) {
        // Fetch active year to filter assignments correctly
        const { data: years } = await supabase
          .from('academic_years')
          .select('id')
          .eq('school_id', user.school_id)
          .or('status.eq.ACTIVE,is_active.eq.true')
          .limit(1);
        
        const activeYearId = years && years.length > 0 ? years[0].id : null;

        let query = supabase
          .from('staff_assignments')
          .select('staff_id, duration_hours, hourly_rate, staff!inner(school_id)')
          .eq('school_id', user.school_id);
        
        if (activeYearId) {
          query = query.or(`academic_year_id.eq.${activeYearId},academic_year_id.is.null`);
        }

        const { data: hoursData } = await query;
        
        const staffWithHours = staffRes.data.map(s => {
          const memberAssignments = hoursData?.filter(h => h.staff_id === s.id) || [];
          const hours = memberAssignments.reduce((acc, curr) => acc + (curr.duration_hours || 0), 0);
          
          const fixedSalary = s.pay_type === 'Fixe' ? (s.amount || 0) : 0;
          const teachingSalary = memberAssignments.reduce((acc, curr) => {
            const rate = curr.hourly_rate || (s.pay_type === 'Horaire' ? (s.amount || 0) : 0);
            return acc + ((curr.duration_hours || 0) * rate * 4);
          }, 0);

          const calculated_base_salary = s.pay_type === 'Horaire' && memberAssignments.length === 0 && hours > 0
            ? (hours * (s.amount || 0) * 4)
            : (fixedSalary + teachingSalary);

          return { ...s, weekly_hours: hours, calculated_base_salary };
        });

        setStaff(staffWithHours);
        localStorage.setItem('edunova_staff_cache', JSON.stringify(staffWithHours));
        setIsOfflineMode(false);
      }
    } catch (error) {
      console.error(error);
      const cached = localStorage.getItem('edunova_staff_cache');
      if (cached) setStaff(JSON.parse(cached));
      setIsOfflineMode(true);
    } finally {
      setLoading(false);
    }
  }, [user.school_id, currentCampusId]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    if (currentCampusId && deleteCandidate.campus_id && deleteCandidate.campus_id !== currentCampusId) {
      toast.error("Action interdite : Cet employé appartient à un autre campus.");
      return;
    }
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('staff').delete().eq('id', deleteCandidate.id).eq('school_id', user.school_id);
      if (error) throw error;

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'DELETE',
        entity_type: 'staff',
        entity_id: deleteCandidate.id,
        details: { name: formatStudentName(deleteCandidate.last_name, deleteCandidate.first_name).fullName, role: deleteCandidate.role }
      });

      setStaff(prev => prev.filter(s => s.id !== deleteCandidate.id));
      setDeleteCandidate(null);
      toast.success("Membre du personnel supprimé avec succès.");
    } catch (err) {
      toast.error("Erreur lors de la suppression Cloud.");
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmFire = async () => {
    if (!fireCandidate) return;
    if (!fireReason.trim()) {
      toast.error("Veuillez indiquer un motif de licenciement.");
      return;
    }
    if (currentCampusId && fireCandidate.campus_id && fireCandidate.campus_id !== currentCampusId) {
      toast.error("Action interdite : Cet employé appartient à un autre campus.");
      return;
    }
    setIsFiring(true);
    try {
      // 1. Update staff status and details
      const termDetails = {
        reason: fireReason,
        notice_amount: noticeAmount ? parseFloat(noticeAmount) : 0,
        date: new Date().toISOString(),
        fired_by: user.id
      };

      const { error: staffError } = await supabase
        .from('staff')
        .update({ 
          status: 'Licencié',
          termination_details: termDetails
        })
        .eq('id', fireCandidate.id)
        .eq('school_id', user.school_id);
        
      if (staffError) throw staffError;

      // 2. Delete their current assignments to free up the schedule
      const { error: assignmentsError } = await supabase
        .from('staff_assignments')
        .delete()
        .eq('staff_id', fireCandidate.id)
        .eq('school_id', user.school_id);
        
      if (assignmentsError) {
        console.warn("Failed to delete staff assignments", assignmentsError);
      }

      // 3. Find associated user profile by email
      if (fireCandidate.email) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', fireCandidate.email)
          .eq('school_id', user.school_id);

        if (profiles && profiles.length > 0) {
          // 4. Disable user access
          for (const profile of profiles) {
             // 4. Disable user access natively
             const { error: toggleError } = await supabase.from('profiles').update({ is_active: false }).eq('id', profile.id);
             
             if (toggleError) {
               console.error("Failed to toggle user status via network:", toggleError);
             }
          }
        }
      }

      // 5. Log the action
      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'FIRE_STAFF',
        entity_type: 'staff',
        entity_id: fireCandidate.id,
        details: { 
          name: formatStudentName(fireCandidate.last_name, fireCandidate.first_name).fullName, 
          role: fireCandidate.role,
          reason: fireReason,
          notice_amount: termDetails.notice_amount
        }
      });

      setStaff(prev => prev.map(s => s.id === fireCandidate.id ? { ...s, status: 'Licencié', termination_details: termDetails } : s));
      setFireCandidate(null);
      setFireReason('');
      setNoticeAmount('');
      toast.success("Employé licencié avec succès. Ses accès ont été révoqués. Vous pouvez le retrouver en cochant 'Afficher inactifs'.");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erreur lors du licenciement.");
    } finally {
      setIsFiring(false);
    }
  };

  const confirmRehire = async (staffMember: StaffMember) => {
    if (currentCampusId && staffMember.campus_id && staffMember.campus_id !== currentCampusId) {
      toast.error("Action interdite : Cet employé appartient à un autre campus.");
      return;
    }
    setIsRehiring(true);
    try {
      const { error: staffError } = await supabase
        .from('staff')
        .update({ 
          status: 'Actif',
          termination_details: null
        })
        .eq('id', staffMember.id)
        .eq('school_id', user.school_id);
        
      if (staffError) throw staffError;

      // Reactivate user profile
      if (staffMember.email) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', staffMember.email)
          .eq('school_id', user.school_id);

        if (profiles && profiles.length > 0) {
          for (const profile of profiles) {
             await supabase.from('profiles').update({ is_active: true }).eq('id', profile.id);
          }
        }
      }

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'staff',
        entity_id: staffMember.id,
        details: { 
          name: formatStudentName(staffMember.last_name, staffMember.first_name).fullName, 
          event: 'REHIRE'
        }
      });

      setStaff(prev => prev.map(s => s.id === staffMember.id ? { ...s, status: 'Actif', termination_details: undefined } : s));
      toast.success("Collaborateur ré-embauché avec succès.");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erreur lors de la ré-embauche.");
    } finally {
      setIsRehiring(false);
    }
  };

  const statsKPI = useMemo(() => {
    const activeStaff = staff.filter(s => s.status === 'Actif' || s.status === 'Congé');
    const males = activeStaff.filter(s => s.gender === 'M').length;
    const females = activeStaff.filter(s => s.gender === 'F').length;
    const permanentCount = activeStaff.filter(s => s.contract_type === 'Permanent').length;
    const vacationnaireCount = activeStaff.filter(s => s.contract_type === 'Vacationnaire').length;
    
    const totalPayroll = activeStaff.reduce((acc, s) => {
      const salary = s.calculated_base_salary ?? (
        s.pay_type === 'Horaire'
          ? ((s.weekly_hours || 0) * (s.amount || 0) * 4)
          : (s.amount || 0)
      );
      return acc + salary;
    }, 0);

    return { total: activeStaff.length, males, females, permanentCount, vacationnaireCount, totalPayroll };
  }, [staff]);

  const filteredStaff = useMemo(() => {
    return staff.filter(s => {
      const matchesSearch = formatStudentName(s.last_name, s.first_name).fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.role.toLowerCase().includes(searchTerm.toLowerCase());
      
      const isActive = s.status === 'Actif' || s.status === 'Congé';
      const matchesActive = showInactive ? true : isActive;
      const matchesContract = contractFilter === 'all' ? true : s.contract_type === contractFilter;

      return matchesSearch && matchesActive && matchesContract;
    });
  }, [staff, searchTerm, showInactive, contractFilter]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-700 pb-20 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 md:p-7 rounded-2xl md:rounded-3xl shadow-lg border border-slate-800 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="z-10 space-y-1">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-widest">
            <Briefcase size={14} /> Personnel & RH
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
            Registre des Collaborateurs
          </h2>
          <p className="text-xs text-slate-300 font-medium">
            {schoolName} • {statsKPI.total} collaborateurs actifs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 z-10 w-full md:w-auto">
          <button 
            onClick={fetchStaff}
            className="p-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all active:scale-95 flex items-center justify-center cursor-pointer"
            title="Rafraîchir"
          >
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          
          {(user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.DIRECTOR) && (
            <>
              <button 
                onClick={() => setIsRolesManagerOpen(true)}
                className="bg-slate-800/90 text-indigo-300 font-bold py-2.5 px-3.5 rounded-xl border border-indigo-500/30 hover:bg-indigo-950 transition-all flex items-center gap-1.5 text-xs cursor-pointer"
              >
                <Settings size={15} /> <span>Postes</span>
              </button>
              <button 
                onClick={() => navigate('/personnel/embaucher')}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-black py-2.5 px-4 rounded-xl shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5 text-xs active:scale-95 cursor-pointer"
              >
                <Plus size={16} /> <span>Recruter</span>
              </button>
            </>
          )}
        </div>
      </div>

      <StaffRolesManager 
        user={user} 
        isOpen={isRolesManagerOpen} 
        onClose={() => setIsRolesManagerOpen(false)} 
      />

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
            <Users size={22} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Effectif RH</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{statsKPI.total}</p>
            <p className="text-[10px] text-slate-500 font-medium">{statsKPI.males} Hommes • {statsKPI.females} Femmes</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
            <UserCheck size={22} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Permanents</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{statsKPI.permanentCount}</p>
            <p className="text-[10px] text-emerald-600 font-bold">Contrats Fixes</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
            <Clock size={22} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Vacationnaires</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{statsKPI.vacationnaireCount}</p>
            <p className="text-[10px] text-amber-600 font-bold">Paye à l'heure</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <Coins size={22} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Masse Salariale Mensuelle</p>
            <p className="text-base font-mono font-black text-slate-900 mt-0.5">
              {statsKPI.totalPayroll.toLocaleString()} <span className="text-[10px] text-slate-400 font-sans">HTG</span>
            </p>
            <p className="text-[10px] text-blue-600 font-bold">Estimation Brute</p>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="flex items-center flex-1 w-full bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
          <Search className="text-slate-400 mr-2 shrink-0" size={18} />
          <input 
            type="text" 
            placeholder="Rechercher par nom, prénom, rôle ou téléphone..." 
            className="flex-1 bg-transparent text-slate-800 font-bold text-xs outline-none placeholder:text-slate-400 placeholder:font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filters and View Switcher */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          {/* Contract Filter Pills */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs">
            <button
              onClick={() => setContractFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${contractFilter === 'all' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Tous
            </button>
            <button
              onClick={() => setContractFilter('Permanent')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${contractFilter === 'Permanent' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Permanents
            </button>
            <button
              onClick={() => setContractFilter('Vacationnaire')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${contractFilter === 'Vacationnaire' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Vacationnaires
            </button>
          </div>

          <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3.5 py-2 rounded-2xl border border-slate-200 hover:bg-slate-100 transition-colors">
            <input 
              type="checkbox" 
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            <span className="text-xs text-slate-600 font-bold">Inactifs</span>
          </label>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
              title="Vue Cartes"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-xl transition-all ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
              title="Vue Tableau"
            >
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Staff Registry Container */}
      {loading && staff.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm space-y-6">
          <FluidLoadingState 
            message="Chargement du Registre RH & Collaborateurs..." 
            subtext="Récupération sécurisée des dossiers du personnel, contrats et paies..." 
          />
          {viewMode === 'grid' ? (
            <SkeletonCard count={6} />
          ) : (
            <SkeletonTable rows={6} />
          )}
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-500 flex items-center justify-center">
            <Users size={32} />
          </div>
          <p className="text-slate-800 font-black text-base">Aucun collaborateur trouvé</p>
          <p className="text-xs text-slate-400 max-w-sm">
            Aucun dossier ne correspond à vos critères de recherche.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW OF CARDS */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredStaff.map((s) => {
              const fullName = formatStudentName(s.last_name, s.first_name).fullName;
              const isInactive = s.status === 'Inactif' || s.status === 'Licencié';

              return (
                <motion.div
                  key={s.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className={`bg-white rounded-3xl p-6 border shadow-sm transition-all hover:shadow-md flex flex-col justify-between space-y-5 relative overflow-hidden group ${
                    isInactive ? 'border-slate-200 opacity-80 bg-slate-50/50' : 'border-slate-200/90 hover:border-indigo-300'
                  }`}
                >
                  {/* Top Row: Avatar + Status Badge Top Bar */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <button
                        onClick={() => setViewingStaff(s)}
                        className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white font-black text-sm flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0 hover:scale-105 transition-transform"
                        title="Consulter dossier"
                      >
                        {s.first_name?.charAt(0)}{s.last_name?.charAt(0)}
                      </button>

                      {/* Status Tag - Only rendered if non-active */}
                      {s.status !== 'Actif' && (
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 shadow-xs ${
                          s.status === 'Congé' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {s.status}
                        </span>
                      )}
                    </div>

                    {/* Full Name & Role - Unclipped & Fluid */}
                    <div className="space-y-1">
                      <h4 
                        onClick={() => setViewingStaff(s)}
                        className="font-black text-slate-900 text-base leading-snug break-words cursor-pointer hover:text-indigo-600 transition-colors"
                        title="Consulter dossier complet"
                      >
                        {fullName}
                      </h4>
                      <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-bold">
                        <Briefcase size={13} className="shrink-0 text-indigo-500" />
                        <span className="break-words">{s.role}</span>
                      </div>
                    </div>

                    {/* Meta Details */}
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs">
                      {/* Contract & Pay */}
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400 font-medium">Contrat :</span>
                        <span className={`font-bold px-2 py-0.5 rounded-lg text-[11px] ${
                          s.contract_type === 'Permanent' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {s.contract_type} ({s.pay_type})
                        </span>
                      </div>

                      {/* Salary Amount */}
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400 font-medium">Salaire Mensuel :</span>
                        <span className="font-mono font-black text-slate-900 text-xs">
                          {`${(s.calculated_base_salary ?? (s.pay_type === 'Horaire' ? ((s.weekly_hours || 0) * (s.amount || 0) * 4) : (s.amount || 0))).toLocaleString()} HTG`}
                        </span>
                      </div>

                      {/* Weekly Hours */}
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400 font-medium">Charge Horaire :</span>
                        <span className="font-bold text-slate-700 flex items-center gap-1">
                          <Clock size={12} className="text-indigo-500" />
                          {s.weekly_hours ? `${s.weekly_hours}h / Semaine` : 'Non renseigné'}
                        </span>
                      </div>

                      {/* Phone & Email */}
                      {(s.phone || s.email) && (
                        <div className="pt-2 flex flex-col gap-1 text-[11px] text-slate-500">
                          {s.phone && (
                            <div className="flex items-center gap-1.5">
                              <Phone size={12} className="text-emerald-600 shrink-0" />
                              <span className="font-mono font-bold text-slate-800">{s.phone}</span>
                            </div>
                          )}
                          {s.email && (
                            <div className="flex items-center gap-1.5 truncate">
                              <Mail size={12} className="text-slate-400 shrink-0" />
                              <span className="truncate">{s.email}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar Footer */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => setViewingStaff(s)} 
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        title="Consulter le dossier complet"
                      >
                        <Eye size={16} />
                      </button>
                      {(user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.DIRECTOR) && (
                        <>
                          <button 
                            onClick={() => navigate(`/personnel/affectation/${s.id}`)} 
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                            title="Affectation de cours"
                          >
                            <BookOpen size={16} />
                          </button>
                          <button 
                            onClick={() => navigate(`/personnel/modifier/${s.id}`)} 
                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                            title="Éditer le profil"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => setSalaryUpdateTarget(s)} 
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                            title="Ajuster Salaire"
                          >
                            <TrendingUp size={16} />
                          </button>
                        </>
                      )}
                      <button 
                        onClick={() => setSalaryHistoryTarget(s)} 
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                        title="Historique Salarial"
                      >
                        <History size={16} />
                      </button>
                    </div>

                    {(user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.DIRECTOR) && (
                      <div className="flex items-center gap-1">
                        {s.status === 'Licencié' ? (
                          <button 
                            onClick={() => confirmRehire(s)}
                            className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-all"
                          >
                            Ré-embaucher
                          </button>
                        ) : (
                          <button 
                            onClick={() => setFireCandidate(s)}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                            title="Licencier"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left min-w-full">
              <thead>
                <tr className="bg-slate-900 text-slate-200 text-[11px] xl:text-xs font-extrabold tracking-wider border-b border-slate-800 uppercase">
                  <th scope="col" className="px-4 py-3.5 whitespace-nowrap">Collaborateur & Rôle</th>
                  <th scope="col" className="px-4 py-3.5 whitespace-nowrap">Statut / Contrat</th>
                  <th scope="col" className="px-4 py-3.5 whitespace-nowrap">Rémunération Mensuelle</th>
                  <th scope="col" className="px-4 py-3.5 whitespace-nowrap">Volume Hebdo</th>
                  <th scope="col" className="px-4 py-3.5 text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs xl:text-sm">
                {filteredStaff.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setViewingStaff(s)}
                          className="w-9 h-9 bg-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-xs transition-colors"
                          title="Consulter le dossier complet"
                        >
                          {s.first_name?.charAt(0)}{s.last_name?.charAt(0)}
                        </button>
                        <div className="min-w-0">
                          <p 
                            onClick={() => setViewingStaff(s)}
                            className="font-bold text-slate-900 text-xs xl:text-sm leading-snug cursor-pointer hover:text-indigo-600 transition-colors truncate"
                            title="Consulter le dossier complet"
                          >
                            {formatStudentName(s.last_name, s.first_name).fullName}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            <span className="font-semibold text-indigo-700">{s.role}</span>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold ${
                          s.contract_type === 'Permanent' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                        }`}>
                          {s.contract_type} ({s.pay_type})
                        </span>
                        {s.status !== 'Actif' && (
                          <span className={`text-xs font-bold ${
                            s.status === 'Congé' ? 'text-amber-600' : 'text-rose-600'
                          }`}>
                            ● {s.status}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono font-extrabold text-slate-900 text-xs xl:text-sm">
                      {`${(s.calculated_base_salary ?? (s.pay_type === 'Horaire' ? ((s.weekly_hours || 0) * (s.amount || 0) * 4) : (s.amount || 0))).toLocaleString()} HTG`}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-semibold text-slate-800 text-xs xl:text-sm flex items-center gap-1.5">
                        <Clock size={14} className="text-indigo-500 shrink-0" />
                        {s.weekly_hours ? `${s.weekly_hours}h / sem.` : 'Non renseigné'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          onClick={() => setViewingStaff(s)} 
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors" 
                          title="Consulter dossier complet"
                        >
                          <Eye size={17} />
                        </button>
                        {(user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.DIRECTOR) && (
                          <>
                            <button onClick={() => navigate(`/personnel/affectation/${s.id}`)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors" title="Affectations">
                              <BookOpen size={17} />
                            </button>
                            <button onClick={() => navigate(`/personnel/modifier/${s.id}`)} className="p-2 text-amber-600 hover:bg-amber-50 rounded-xl transition-colors" title="Modifier">
                              <Edit2 size={17} />
                            </button>
                            <button onClick={() => setSalaryUpdateTarget(s)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors" title="Ajuster Salaire">
                              <TrendingUp size={17} />
                            </button>
                          </>
                        )}
                        <button onClick={() => setSalaryHistoryTarget(s)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors" title="Historique">
                          <History size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal 
        isOpen={!!deleteCandidate}
        onClose={() => setDeleteCandidate(null)}
        onConfirm={confirmDelete}
        isLoading={isDeleting}
        type="danger"
        title="Supprimer Collaborateur"
        message={`Confirmez-vous la suppression définitive du dossier de ${formatStudentName(deleteCandidate?.last_name, deleteCandidate?.first_name).fullName} ? Cette action est irréversible.`}
        confirmLabel="Oui, Supprimer"
      />

      <Modal 
        isOpen={!!fireCandidate}
        onClose={() => {
          setFireCandidate(null);
          setFireReason('');
          setNoticeAmount('');
        }}
        onConfirm={confirmFire}
        isLoading={isFiring}
        type="danger"
        title="Licencier / Révoquer un employé"
        message={`Vous êtes sur le point de licencier ${formatStudentName(fireCandidate?.last_name, fireCandidate?.first_name).fullName}. Ses accès au système seront révoqués immédiatement.`}
        confirmLabel="Confirmer le licenciement"
      >
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motif du licenciement (Obligatoire pour la traçabilité)
            </label>
            <textarea
              value={fireReason}
              onChange={(e) => setFireReason(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              rows={3}
              placeholder="Ex: Fin de contrat, Faute grave, Restructuration..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Montant du préavis (HTG) - Optionnel
            </label>
            <div className="relative">
              <input
                type="number"
                value={noticeAmount}
                onChange={(e) => setNoticeAmount(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 pr-12 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                placeholder="0.00"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">HTG</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1 italic">
              Ce montant sera enregistré dans le dossier de licenciement pour le calcul final.
            </p>
          </div>
        </div>
      </Modal>

      {selectedSettlement && (
        <SettlementSlip 
          staff={selectedSettlement}
          schoolName={schoolName}
          currentUser={user}
          onClose={() => setSelectedSettlement(null)}
        />
      )}

      {salaryUpdateTarget && (
        <SalaryUpdateModal 
          staff={salaryUpdateTarget}
          user={user}
          isOpen={!!salaryUpdateTarget}
          onClose={() => setSalaryUpdateTarget(null)}
          onSuccess={fetchStaff}
        />
      )}

      {salaryHistoryTarget && (
        <SalaryHistoryModal 
          staff={salaryHistoryTarget}
          isOpen={!!salaryHistoryTarget}
          onClose={() => setSalaryHistoryTarget(null)}
        />
      )}

      {viewingStaff && (
        <StaffDetailModal
          staff={viewingStaff}
          isOpen={!!viewingStaff}
          onClose={() => setViewingStaff(null)}
          user={user}
          onEdit={(id) => navigate(`/personnel/modifier/${id}`)}
          onAssign={(id) => navigate(`/personnel/affectation/${id}`)}
          onUpdateSalary={(st) => setSalaryUpdateTarget(st)}
          onViewSalaryHistory={(st) => setSalaryHistoryTarget(st)}
        />
      )}
    </div>
  );
};

export default StaffManagement;