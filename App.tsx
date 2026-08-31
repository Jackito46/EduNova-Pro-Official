import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert, RefreshCw, Loader2 } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import StudentForm from './components/StudentForm';
import StudentList from './components/StudentList';
import StudentDetailView from './components/StudentDetailView';
import { StudentProfileView } from './components/StudentProfileView';
import { StudentCoursesView } from './components/StudentCoursesView';
import { StudentGradesView } from './components/StudentGradesView';
import { StudentFinanceView } from './components/StudentFinanceView';
import { StudentScheduleView } from './components/StudentScheduleView';
import ClassManagement from './components/ClassManagement';
import ClassForm from './components/ClassForm';
import SubjectForm from './components/SubjectForm';
import ClassSubjectManager from './components/ClassSubjectManager';
import GradesView from './components/GradesView';
import SyllabusHub from './components/SyllabusHub';
import ReportCardsView from './components/ReportCardsView';
import ScheduleView from './components/ScheduleView';
import CourseSignatureView from './components/CourseSignatureView';
import AttendanceView from './components/AttendanceView';
import SettingsView from './components/SettingsView';
import TuitionPaymentForm from './components/TuitionPaymentForm';
import FeePlanningView from './components/FeePlanningView';
import ReceiptManagementView from './components/ReceiptManagementView';
import StudentPaymentTracking from './components/StudentPaymentTracking';
import AccountStatementView from './components/AccountStatementView';
import PaymentHistoryList from './components/PaymentHistoryList';
import FinanceHub from './components/FinanceHub';
import ExpensesView from './components/ExpensesView';
import ExpenseForm from './components/ExpenseForm';
import SuppliesView from './components/SuppliesView';
import PayrollManagementView from './components/PayrollManagementView';
import DiscountManagementView from './components/DiscountManagementView';
import ReductionReportView from './components/ReductionReportView';
import AdHocCampaignsView from './components/AdHocCampaignsView';
import StaffManagement from './components/StaffManagement'; 
import StaffForm from './components/StaffForm';
import StaffAssignmentView from './components/StaffAssignmentView'; 
import StaffAttendanceView from './components/StaffAttendanceView';
import DisciplinaryView from './components/DisciplinaryView';
import FinancialAuditView from './components/FinancialAuditView';
import BudgetPlanningView from './components/BudgetPlanningView';
import DebtorsListView from './components/DebtorsListView';
import UserManagementView from './components/UserManagementView';
import ReportsView from './components/ReportsView';
import { MultiCampusDashboardView } from './components/MultiCampusDashboardView';
// import GuideView from './components/GuideView';
import { AuditLogsView } from './components/AuditLogsView';
import ValidationList from './components/ValidationList';
import { ForcePasswordChange } from './components/ForcePasswordChange';
import ConnectivityBanner from './components/ConnectivityBanner';
import { AddressBarInstallHint } from './components/AddressBarInstallHint';
import { PwaInstallBanner } from './components/PwaInstallBanner';
import { PwaInstallModal } from './components/PwaInstallModal';
import { OfflineDashboard } from './components/OfflineDashboard';
import Login from './components/Login';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { SuperAdminRoute } from './components/SuperAdminRoute';
import { SystemHealthView } from './components/SystemHealthView';
import { SubscriptionGuard } from './components/SubscriptionGuard';
import { UserProfile, UserRole } from './types';
import { supabase, clearAuthStorage, isRefreshTokenError, hasStoredAuthToken } from './supabase';
import { AuditLogger } from './utils/auditLogger';
import { ErrorBoundary } from './components/ErrorBoundary';
import EmailModule from './components/EmailModule';
import SmsModule from './components/SmsModule';
import PushModule from './components/PushModule';
import WhatsAppModule from './components/WhatsAppModule';

import { SessionGuard } from './components/SessionGuard';
import { RoleGuard } from './components/RoleGuard';
import { useSecurity } from './components/SecurityGuard';
import { SchoolProvider } from './contexts/SchoolContext';
import Logo from './components/Logo';

import { NotificationBanner } from './components/NotificationBanner';
import { AiQuotaAlertBanner } from './components/AiQuotaAlertBanner';
import { GlobalShortcuts } from './components/GlobalShortcuts';
import { ModernDashboardSkeleton } from './components/SkeletonLoader';
import { AppLoadingScreen } from './components/AppLoadingScreen';

// Intercept toast.error globally to prevent scary technical auth errors from showing to the user
const originalToastError = toast.error;
(toast as any).error = function(message: any, options?: any) {
  const msgStr = typeof message === 'string' ? message.toLowerCase() : String(message).toLowerCase();
  if (msgStr.includes('refresh token')) {
    return originalToastError("Session expirée. Veuillez vous reconnecter.", options);
  }
  return originalToastError(message, options);
};

// Globally suppress console.error for expected refresh token errors to avoid AI Studio alert noise
if (typeof window !== 'undefined') {
  console.log('--- DIAGNOSTIC SCRIPT: DEPLOYMENT INFO ---');
  console.log('Build Timestamp:', typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : 'N/A');
  console.log('Render Git Commit:', typeof __RENDER_GIT_COMMIT__ !== 'undefined' ? __RENDER_GIT_COMMIT__ : 'N/A');
  console.log('Node Env:', typeof __NODE_ENV__ !== 'undefined' ? __NODE_ENV__ : 'N/A');
  console.log('Environment variables loaded:', {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? '✓ Configured' : 'Missing',
  });
  console.log('-------------------------------------------');

  const originalConsoleError = console.error;
  console.error = function(...args: any[]) {
    try {
      const errorStr = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ').toLowerCase();
      if (
        errorStr.includes('refresh token') || 
        errorStr.includes('refresh_token_not_found') || 
        errorStr.includes('session not found') ||
        errorStr.includes('compte désactivé') ||
        errorStr.includes('déconnexion forcée') ||
        errorStr.includes('pgrst116')
      ) {
        // Just log as warn to avoid triggering AI Studio's error overlay
        return console.warn('[Suppressed Auth State Notice]', ...args);
      }
    } catch(e) {}
    return originalConsoleError.apply(console, args);
  };
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}



const AnimatedRoutes: React.FC<{ user: UserProfile, purgeSystemState: () => void, maintenanceMode: boolean }> = ({ user, purgeSystemState, maintenanceMode }) => {
  const location = useLocation();

  // Détection du mode PWA / Autonome pour masquer les éléments superflus
  const isPwaStandalone = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')
    );
  }, []);
  
  // Define role groups for easier management
  const adminRoles = [UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR];
  const financeRoles = [...adminRoles, UserRole.ACCOUNTANT];
  const cashierRoles = [...adminRoles, UserRole.ACCOUNTANT, UserRole.SECRETARY];
  const hrRoles = [...adminRoles]; // Removed SECRETARY from hrRoles
  const studentMgmtRoles = [...adminRoles, UserRole.SECRETARY];
  const academicRoles = [...adminRoles, UserRole.SECRETARY, UserRole.TEACHER, UserRole.SUPERVISOR];
  const restrictedAcademicRoles = [...adminRoles, UserRole.SECRETARY, UserRole.SUPERVISOR];
  const allStaffRoles = [...academicRoles, UserRole.ACCOUNTANT, UserRole.LIBRARIAN];

  if (maintenanceMode && user.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 text-center space-y-6 border border-slate-100 animate-in fade-in zoom-in duration-300">
          <div className="w-24 h-24 bg-amber-100 text-amber-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert size={48} />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Maintenance en cours</h1>
            <p className="text-slate-500 font-medium leading-relaxed text-sm">
              La plateforme EduNova Pro est actuellement en maintenance pour des améliorations techniques. 
              Vos données restent en toute sécurité.
            </p>
          </div>
          <div className="pt-2 space-y-3">
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 flex items-center justify-center gap-2"
            >
              <RefreshCw size={18} /> Vérifier la disponibilité
            </button>
            <button 
              onClick={purgeSystemState}
              className="w-full py-3 bg-slate-100 text-slate-700 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all active:scale-95"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (user.force_password_change) {
    return <ForcePasswordChange user={user} onPasswordChanged={(updated) => purgeSystemState()} />;
  }

  return (
    <SchoolProvider user={user} schoolId={user.school_id}>
      <SessionGuard user={user}>
        <GlobalShortcuts user={user} />
        <div className="flex h-screen bg-[#f3f4f6] overflow-hidden font-sans">
        <ErrorBoundary>
          <Sidebar user={user} onLogout={purgeSystemState} />
        </ErrorBoundary>
        <main className="flex-1 overflow-y-auto p-4 pt-16 sm:p-5 lg:p-6 2xl:p-8 custom-scrollbar relative print:p-0 print:overflow-visible">
          <ConnectivityBanner />
          <NotificationBanner userId={user.id} schoolId={user.school_id || ''} />
          <AiQuotaAlertBanner user={user} />
          <AddressBarInstallHint />
          <ErrorBoundary key={location.pathname}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="w-full"
              >
                <Routes location={location}>
              <Route path="/" element={<Dashboard user={user} />} />
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route path="/offline" element={<OfflineDashboard user={user} />} />
              <Route path="/super-admin" element={
                <SuperAdminRoute user={user}>
                  <SuperAdminDashboard user={user} />
                </SuperAdminRoute>
              } />
              <Route path="/super-admin/system-health" element={
                <SuperAdminRoute user={user}>
                  <SystemHealthView user={user} />
                </SuperAdminRoute>
              } />
              <Route path="/super-admin/sante-systeme" element={
                <SuperAdminRoute user={user}>
                  <SystemHealthView user={user} />
                </SuperAdminRoute>
              } />
              <Route path="/system-health" element={
                <SuperAdminRoute user={user}>
                  <SystemHealthView user={user} />
                </SuperAdminRoute>
              } />

              {/* Student Portal Routes */}
              <Route path="/profil" element={<RoleGuard user={user} allowedRoles={[UserRole.STUDENT]}><StudentProfileView user={user} /></RoleGuard>} />
              <Route path="/mes-cours" element={<RoleGuard user={user} allowedRoles={[UserRole.STUDENT]}><StudentCoursesView user={user} /></RoleGuard>} />
              <Route path="/mes-notes" element={<RoleGuard user={user} allowedRoles={[UserRole.STUDENT]}><StudentGradesView user={user} /></RoleGuard>} />
              <Route path="/mon-economat" element={<RoleGuard user={user} allowedRoles={[UserRole.STUDENT]}><StudentFinanceView user={user} /></RoleGuard>} />
              <Route path="/mon-horaire" element={<RoleGuard user={user} allowedRoles={[UserRole.STUDENT]}><StudentScheduleView user={user} /></RoleGuard>} />
              
              {/* Academic Routes */}
              <Route path="/eleves" element={<RoleGuard user={user} allowedRoles={restrictedAcademicRoles}><StudentList user={user} /></RoleGuard>} />
              <Route path="/eleves/validation" element={<RoleGuard user={user} allowedRoles={studentMgmtRoles}><ValidationList user={user} /></RoleGuard>} />
              <Route path="/eleves/detail/:id" element={<RoleGuard user={user} allowedRoles={restrictedAcademicRoles}><StudentDetailView user={user} /></RoleGuard>} />
              <Route path="/eleves/ajouter" element={<RoleGuard user={user} allowedRoles={studentMgmtRoles}><StudentForm user={user} /></RoleGuard>} />
              <Route path="/eleves/modifier/:id" element={<RoleGuard user={user} allowedRoles={studentMgmtRoles}><StudentForm user={user} /></RoleGuard>} />
              <Route path="/eleves/reinscrire/:id" element={<RoleGuard user={user} allowedRoles={studentMgmtRoles}><StudentForm user={user} /></RoleGuard>} />
              <Route path="/classes" element={<RoleGuard user={user} allowedRoles={restrictedAcademicRoles}><ClassManagement user={user} /></RoleGuard>} />
              <Route path="/classes/ajouter" element={<RoleGuard user={user} allowedRoles={adminRoles}><ClassForm user={user} /></RoleGuard>} />
              <Route path="/classes/modifier/:id" element={<RoleGuard user={user} allowedRoles={adminRoles}><ClassForm user={user} /></RoleGuard>} />
              <Route path="/classes/:id/matieres" element={<RoleGuard user={user} allowedRoles={adminRoles}><ClassSubjectManager user={user} /></RoleGuard>} />
              <Route path="/matieres/ajouter" element={<RoleGuard user={user} allowedRoles={adminRoles}><SubjectForm user={user} /></RoleGuard>} />
              <Route path="/matieres/modifier/:id" element={<RoleGuard user={user} allowedRoles={adminRoles}><SubjectForm user={user} /></RoleGuard>} />
              <Route path="/notes" element={<RoleGuard user={user} allowedRoles={academicRoles}><GradesView user={user} /></RoleGuard>} />
              <Route path="/enseignant/syllabus" element={<RoleGuard user={user} allowedRoles={academicRoles}><SyllabusHub user={user} /></RoleGuard>} />
              <Route path="/presences" element={<RoleGuard user={user} allowedRoles={academicRoles}><AttendanceView user={user} /></RoleGuard>} />
              <Route path="/bulletins" element={<RoleGuard user={user} allowedRoles={restrictedAcademicRoles}><ReportCardsView user={user} /></RoleGuard>} />
              <Route path="/discipline" element={<RoleGuard user={user} allowedRoles={academicRoles}><DisciplinaryView user={user} /></RoleGuard>} />
              <Route path="/horaire" element={<RoleGuard user={user} allowedRoles={academicRoles}><ScheduleView user={user} /></RoleGuard>} />
              <Route path="/enseignant/pointage" element={<RoleGuard user={user} allowedRoles={[UserRole.TEACHER, ...adminRoles, UserRole.SECRETARY]}><CourseSignatureView user={user} /></RoleGuard>} />
              
              {/* HR Routes */}
              <Route path="/personnel" element={<RoleGuard user={user} allowedRoles={hrRoles}><StaffManagement user={user} /></RoleGuard>} />
              <Route path="/personnel/embaucher" element={<RoleGuard user={user} allowedRoles={adminRoles}><StaffForm user={user} /></RoleGuard>} />
              <Route path="/personnel/modifier/:id" element={<RoleGuard user={user} allowedRoles={adminRoles}><StaffForm user={user} /></RoleGuard>} />
              <Route path="/personnel/affectation/:id" element={<RoleGuard user={user} allowedRoles={adminRoles}><StaffAssignmentView user={user} /></RoleGuard>} />
              <Route path="/personnel/pointage" element={<RoleGuard user={user} allowedRoles={hrRoles}><StaffAttendanceView user={user} /></RoleGuard>} />
              
              {/* Finance Routes */}
              <Route path="/economat" element={<RoleGuard user={user} allowedRoles={financeRoles}><FinanceHub user={user} /></RoleGuard>} />
              <Route path="/economat/frais" element={<RoleGuard user={user} allowedRoles={cashierRoles}><TuitionPaymentForm user={user} /></RoleGuard>} />
              <Route path="/economat/factures" element={<RoleGuard user={user} allowedRoles={cashierRoles}><ReceiptManagementView user={user} /></RoleGuard>} />
              <Route path="/economat/releves" element={<RoleGuard user={user} allowedRoles={cashierRoles}><AccountStatementView user={user} /></RoleGuard>} />
              <Route path="/economat/releve-compte" element={<RoleGuard user={user} allowedRoles={cashierRoles}><AccountStatementView user={user} /></RoleGuard>} />
              <Route path="/economat/suivi" element={<RoleGuard user={user} allowedRoles={cashierRoles}><StudentPaymentTracking user={user} /></RoleGuard>} />
              <Route path="/economat/debiteurs" element={<RoleGuard user={user} allowedRoles={cashierRoles}><DebtorsListView user={user} /></RoleGuard>} />
              <Route path="/economat/liste" element={<RoleGuard user={user} allowedRoles={cashierRoles}><PaymentHistoryList user={user} /></RoleGuard>} />
              <Route path="/economat/depenses" element={<RoleGuard user={user} allowedRoles={[...adminRoles, UserRole.ACCOUNTANT]}><ExpensesView user={user} /></RoleGuard>} />
              <Route path="/economat/depenses/ajouter" element={<RoleGuard user={user} allowedRoles={[...adminRoles, UserRole.ACCOUNTANT]}><ExpenseForm user={user} /></RoleGuard>} />
              <Route path="/economat/depenses/modifier/:id" element={<RoleGuard user={user} allowedRoles={[...adminRoles, UserRole.ACCOUNTANT]}><ExpenseForm user={user} /></RoleGuard>} />
              <Route path="/economat/fournitures" element={<RoleGuard user={user} allowedRoles={cashierRoles}><SuppliesView user={user} /></RoleGuard>} />
              <Route path="/economat/planification" element={<RoleGuard user={user} allowedRoles={[...adminRoles, UserRole.ACCOUNTANT]}><FeePlanningView user={user} /></RoleGuard>} />
              <Route path="/economat/frais-occasionnels" element={<RoleGuard user={user} allowedRoles={financeRoles}><AdHocCampaignsView user={user} /></RoleGuard>} />
              <Route path="/economat/derogations" element={<RoleGuard user={user} allowedRoles={adminRoles}><DiscountManagementView user={user} /></RoleGuard>} />
              <Route path="/economat/rapport-reductions" element={<RoleGuard user={user} allowedRoles={financeRoles}><ReductionReportView user={user} /></RoleGuard>} />
              <Route path="/economat/paie" element={<RoleGuard user={user} allowedRoles={[...adminRoles, UserRole.ACCOUNTANT]}><PayrollManagementView user={user} /></RoleGuard>} />
              <Route path="/economat/budget" element={<RoleGuard user={user} allowedRoles={[...adminRoles, UserRole.ACCOUNTANT]}><BudgetPlanningView user={user} /></RoleGuard>} />
              <Route path="/economat/audit" element={<RoleGuard user={user} allowedRoles={[...adminRoles, UserRole.ACCOUNTANT]}><FinancialAuditView user={user} /></RoleGuard>} />
              
              {/* Reports Routes */}
              <Route path="/rapports" element={<RoleGuard user={user} allowedRoles={[...adminRoles, UserRole.ACCOUNTANT, UserRole.SECRETARY]}><ReportsView user={user} /></RoleGuard>} />
              <Route path="/supervision-annexes" element={<RoleGuard user={user} allowedRoles={[...adminRoles, UserRole.ACCOUNTANT, UserRole.DIRECTOR]}><MultiCampusDashboardView user={user} /></RoleGuard>} />
              <Route path="/direction/supervision-annexes" element={<RoleGuard user={user} allowedRoles={[...adminRoles, UserRole.ACCOUNTANT, UserRole.DIRECTOR]}><MultiCampusDashboardView user={user} /></RoleGuard>} />
              
              {/* Guide Route */}
              {/* <Route path="/guide" element={<GuideView />} /> */}
              
              {/* Communication Routes */}
              <Route path="/communication/whatsapp" element={<RoleGuard user={user} allowedRoles={adminRoles}><WhatsAppModule user={user} /></RoleGuard>} />
              <Route path="/communication/email" element={<RoleGuard user={user} allowedRoles={adminRoles}><EmailModule user={user} /></RoleGuard>} />
              <Route path="/communication/sms" element={<RoleGuard user={user} allowedRoles={adminRoles}><SmsModule user={user} /></RoleGuard>} />
              <Route path="/communication/push" element={<RoleGuard user={user} allowedRoles={adminRoles}><PushModule user={user} /></RoleGuard>} />
              
              {/* Settings Routes */}
              <Route path="/settings/ecole" element={<RoleGuard user={user} allowedRoles={adminRoles}><SettingsView user={user} /></RoleGuard>} />
              <Route path="/settings/utilisateurs" element={<RoleGuard user={user} allowedRoles={adminRoles}><UserManagementView currentUser={user} /></RoleGuard>} />
              <Route path="/settings/audit" element={<RoleGuard user={user} allowedRoles={adminRoles}><AuditLogsView user={user} /></RoleGuard>} />
              
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </ErrorBoundary>

          {/* Application Footer - Masqué automatiquement sur mobile (< md) et en mode PWA autonome */}
          {!isPwaStandalone && (
            <footer className="hidden md:block mt-8 py-4 border-t border-slate-200/60 text-center select-none">
              <p className="text-slate-400 text-[10px] font-medium tracking-wider">
                &copy; {new Date().getFullYear()} EduNova Technologies <span className="mx-1 text-slate-300">•</span> Gestion Académique Intégrée
              </p>
            </footer>
          )}
        </main>
      </div>
    </SessionGuard>
  </SchoolProvider>
  );
};

const App: React.FC = () => {
  const { isInOfficeHours, isAllowedLocation } = useSecurity();
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const isLoggedOut = window.localStorage.getItem('edunova_logged_out') === 'true';
      if (isLoggedOut) return null;
      const cached = window.localStorage.getItem('edunova_user_profile');
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (e) {
      try { window.localStorage.removeItem('edunova_user_profile'); } catch (err) {}
      return null;
    }
  });
  
  const [loading, setLoading] = useState(() => {
    try {
      const isLoggedOut = window.localStorage.getItem('edunova_logged_out') === 'true';
      if (isLoggedOut) return false;
      const cached = window.localStorage.getItem('edunova_user_profile');
      if (cached) return false; // Immediate render if cached profile exists!
      // If no cached profile and no auth token stored, user is 100% unauthenticated -> render Login instantly!
      return hasStoredAuthToken();
    } catch (e) {
      return false;
    }
  });
  const [loadingStage, setLoadingStage] = useState<1 | 2 | 3>(1);
  const [isExiting, setIsExiting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(() => {
    try {
      const cached = window.localStorage.getItem('edunova_session_timeout');
      if (cached) {
        const val = parseInt(cached, 10);
        if (!isNaN(val) && val > 0) return val;
      }
    } catch(e) {}
    return 30;
  });

  useEffect(() => {
    try { window.localStorage.setItem('edunova_session_timeout', sessionTimeoutMinutes.toString()); } catch(e){}
  }, [sessionTimeoutMinutes]);
  
  // Inactivity Warning States
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const isWarningShowing = useRef(false);

  const syncProfile = useCallback(async (userId: string, isRecovery: boolean = false) => {
    console.log("App.tsx: Starting syncProfile for user", userId, { isRecovery });
    
    if (!navigator.onLine) {
      console.warn("App.tsx: Browser is offline, skipping syncProfile and using cache.");
      setLoading(false);
      return;
    }
    
    try {
      // Wrap the query in a Promise.race with a 5-second timeout
      const queryPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      let timeoutId: NodeJS.Timeout;
      const timeoutPromise = new Promise<{data: any, error: any}>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("syncProfile timeout")), 5000);
      });
      
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
      clearTimeout(timeoutId!);

      
      if (error) {
        if (error.code === 'PGRST116') {
          console.warn("Profil introuvable ou filtré par RLS. Vérification du cache local...");
          
          const cachedStr = window.localStorage.getItem('edunova_user_profile');
          if (cachedStr) {
            try {
              const cached = JSON.parse(cachedStr);
              if (cached && cached.id === userId) {
                console.log("App.tsx: Utilisation du profil en cache suite à PGRST116 pour", cached.email);
                if (isRecovery) cached.force_password_change = true;
                setUser(cached);
                return;
              }
            } catch (e) {}
          }
          
          console.warn("Profil introuvable et aucun cache valide. Réinitialisation de l'état.");
          setUser(null);
          return;
        }
        throw error;
      }
      
      if (data) {
        console.log("App.tsx: Profile synced successfully");
        const profile = data as UserProfile;
        if (isRecovery) {
          profile.force_password_change = true;
        } else if (profile.is_active === false && profile.role !== 'SUPER_ADMIN' && !profile.is_super_admin) {
          console.warn("Compte désactivé. Déconnexion forcée.");
          try { await supabase.auth.signOut(); } catch (e) {}
          try { window.localStorage.removeItem('edunova_user_profile'); } catch (err) {}
          setUser(null);
          try { window.sessionStorage.setItem('edunova_login_error', "Votre compte a été désactivé par l'administration."); } catch (e) {}
          return;
        }

        // Check school status if not super admin
        if (profile.school_id && profile.role !== 'SUPER_ADMIN' && !profile.is_super_admin) {
          try {
            const { data: schoolData, error: schoolErr } = await supabase
              .from('schools')
              .select('status')
              .eq('id', profile.school_id)
              .single();
            
            if (!schoolErr && schoolData && schoolData.status !== 'ACTIVE') {
              console.warn("Établissement inactif ou suspendu. Déconnexion forcée.");
              try { await supabase.auth.signOut(); } catch (e) {}
              try { window.localStorage.removeItem('edunova_user_profile'); } catch (err) {}
              setUser(null);
              try { window.sessionStorage.setItem('edunova_login_error', "Votre établissement est actuellement désactivé ou suspendu. Veuillez contacter l'administration principale."); } catch (e) {}
              return;
            }
          } catch (schoolCatchErr) {
            console.warn("Error checking school status inside syncProfile:", schoolCatchErr);
          }
        }

        setUser(prev => {
          const finalProfile = isRecovery ? { ...profile, force_password_change: true } : profile;
          if (prev && JSON.stringify(prev) === JSON.stringify(finalProfile)) {
            return prev;
          }
          return finalProfile;
        });
        if (profile.current_session_id) {
          try { 
            window.localStorage.setItem('edunova_session_id', profile.current_session_id); 
            window.localStorage.setItem('edunova_session_synced', 'true');
          } catch (err) {}
        }
        try { window.localStorage.setItem('edunova_user_profile', JSON.stringify(profile)); } catch (err) {}
      }
    } catch (err: any) {
      console.warn("Sync error:", err.message || err);
      // On continue avec le cache local si disponible
    } finally {
      console.log("App.tsx: syncProfile finished, setting loading to false");
      setLoading(false);
    }
  }, []);

  const purgeSystemState = useCallback(async () => {
    setIsExiting(true);
    
    // Purge Service Worker and local caches immediately
    clearAuthStorage();
    try { window.localStorage.setItem('edunova_logged_out', 'true'); } catch (e) {}

    // Sécurité : Si signOut bloque (mode hors-ligne ou réseau lent), on force la déconnexion locale après 1.5s
    const timeout = setTimeout(() => {
      clearAuthStorage();
      try { window.localStorage.setItem('edunova_logged_out', 'true'); } catch (e) {}
      setUser(null);
      setIsExiting(false);
      window.location.reload();
    }, 1500);

    try {
      // Direct call with timeout race for getUser and profile cleanup
      const getUserPromise = supabase.auth.getUser();
      const getUserTimeout = new Promise<{ data: { user: null } }>(res => setTimeout(() => res({ data: { user: null } }), 800));
      const { data: { user: currentUser } } = await Promise.race([getUserPromise, getUserTimeout]) as any;

      if (currentUser) {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('school_id')
            .eq('id', currentUser.id)
            .single();
            
          if (currentUser.user_metadata?.school_id || data?.school_id) {
            await AuditLogger.log({
              school_id: data?.school_id || currentUser.user_metadata?.school_id,
              user_id: currentUser.id,
              action: 'LOGOUT',
              entity_type: 'auth',
              details: { }
            });
          }

          // Clear session ID in DB & invalidate tokens with 800ms race timeout
          await Promise.race([
            supabase.from('profiles').update({ current_session_id: null }).eq('id', currentUser.id),
            new Promise(res => setTimeout(res, 800))
          ]);

          await Promise.race([
            supabase.rpc('invalidate_user_sessions', { p_user_id: currentUser.id }),
            new Promise(res => setTimeout(res, 800))
          ]);
        } catch (dbErr) {
          console.warn("DB session cleanup error during purge:", dbErr);
        }
      }

      // Fast signOut attempt
      try {
        await Promise.race([
          supabase.auth.signOut(),
          new Promise(res => setTimeout(res, 800))
        ]);
      } catch (e) {}

      clearTimeout(timeout);
      clearAuthStorage();
      try { window.localStorage.setItem('edunova_logged_out', 'true'); } catch (e) {}
      setUser(null);
      setLoading(false);
    } catch (e) {
      clearAuthStorage();
      try { window.localStorage.setItem('edunova_logged_out', 'true'); } catch (err) {}
      setUser(null);
      setLoading(false);
    } finally {
      setIsExiting(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Failsafe timeout to prevent infinite loading - 2.5s max
    const loadingTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn("App.tsx: Loading timeout reached (2.5s), forcing loading to false");
        setLoading(false);
      }
    }, 2500);

    const initializeAuth = async (retryCount = 0) => {
      setLoadingStage(1);
      const isLoggedOut = window.localStorage.getItem('edunova_logged_out') === 'true';
      const hasToken = hasStoredAuthToken();

      if (isLoggedOut || !hasToken) {
        console.log("App.tsx: Unauthenticated user or explicit logout, rendering Login screen immediately.");
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      const cachedUserStr = window.localStorage.getItem('edunova_user_profile');
      if (cachedUserStr && mounted) {
        try {
          setUser(JSON.parse(cachedUserStr));
          setLoading(false);
        } catch (e) {}
      }

      if (!navigator.onLine) {
        console.warn("App.tsx: Browser is offline, using cached session.");
        if (mounted) setLoading(false);
        return;
      }

      console.log(`App.tsx: Starting initializeAuth (Attempt ${retryCount + 1})`);
      setLoadingStage(2);
      let sessionTimeoutId: NodeJS.Timeout;
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{data: {session: null}, error: Error}>((_, reject) => {
          sessionTimeoutId = setTimeout(() => reject(new Error("getSession timeout")), 2500);
        });
        
        const result = await Promise.race([sessionPromise, timeoutPromise]) as any;
        clearTimeout(sessionTimeoutId!);
        
        const error = result?.error;
        const session = result?.data?.session;

        if (error || isRefreshTokenError(error)) {
          const actualError = error || (result as any);
          if (isRefreshTokenError(actualError)) {
            console.warn("App.tsx: Refresh token error in getSession, clearing session...");
            try { await supabase.auth.signOut(); } catch (e) {}
            clearAuthStorage();
            if (mounted) {
              setUser(null);
              setLoading(false);
            }
            return;
          }

          if (mounted) setLoading(false);
          return;
        }

        if (session?.user && mounted) {
          setLoadingStage(3);
          window.sessionStorage.setItem('edunova_session_active', 'true');
          const isRecoveryFlow = window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery');
          if (isRecoveryFlow) {
            toast.info("Réinitialisation du mot de passe", {
              description: "Veuillez définir votre nouveau mot de passe de sécurité.",
              duration: 8000,
            });
          }
          
          // Non-blocking background sync of profile
          syncProfile(session.user.id, isRecoveryFlow).catch(() => {});
          if (mounted) setLoading(false);
        } else if (mounted) {
          console.log("App.tsx: No user in session, setting user to null");
          setUser(null);
          try { window.localStorage.removeItem('edunova_user_profile'); } catch (err) {}
          setLoading(false);
        }
      } catch (err: any) {
        clearTimeout(sessionTimeoutId!);
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    // Listen for custom auth errors from supabase.ts
    const handleCustomAuthError = (e: any) => {
      console.warn("App.tsx: Received edunova_auth_error event, logging out...");
      if (mounted) {
         setUser(null);
         setLoading(false);
         // Only show toast if we were previously logged in or have cached profile
         const hasCachedProfile = !!window.localStorage.getItem('edunova_user_profile');
         if (hasCachedProfile) {
           toast.error("Session expirée", {
             description: "Votre session de sécurité a expiré. Veuillez vous reconnecter.",
             duration: 5000,
           });
         }
         try { window.localStorage.removeItem('edunova_user_profile'); } catch (err) {}
      }
    };
    window.addEventListener('edunova_auth_error', handleCustomAuthError);

    // Fetch maintenance mode
    const fetchGlobalSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('global_settings')
          .select('key, value')
          .in('key', ['system_status', 'security_policy']);
        
        if (error) {
          const isNetworkError = 
            error.message === 'Failed to fetch' || 
            error.message?.includes('Erreur réseau') || 
            error.code === 'NETWORK_ERROR' ||
            (error as any).status === 503;
          
          if (isNetworkError) {
            console.warn("Avertissement réseau : Impossible de se connecter à Supabase pour vérifier les paramètres globaux.");
          } else {
            console.warn("Avertissement lors de la récupération des paramètres globaux:", error?.message || error);
          }
          setMaintenanceMode(false);
          return;
        }

        if (data) {
          const status = data.find(item => item.key === 'system_status');
          if (status && status.value) setMaintenanceMode(status.value.maintenance_mode);
          
          const security = data.find(item => item.key === 'security_policy');
          if (security && security.value && security.value.session_timeout_minutes) {
             setSessionTimeoutMinutes(security.value.session_timeout_minutes);
          }
        }
      } catch (err: any) {
        const isNetworkError = 
          err.message === 'Failed to fetch' || 
          err.message?.includes('Erreur réseau') || 
          err.code === 'NETWORK_ERROR' ||
          err.status === 503;

        if (isNetworkError) {
          console.warn("Exception réseau lors de la récupération des paramètres globaux:", err.message);
          setApiError("Erreur de connexion au serveur. Certaines fonctionnalités peuvent être limitées.");
        } else {
          console.warn("Exception lors de la récupération des paramètres globaux:", err?.message || err);
        }
        setMaintenanceMode(false);
      }
    };

    fetchGlobalSettings();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("App.tsx: Auth state change event:", event);
      
      if (event === 'SIGNED_IN' && session?.user && mounted) {
        const isLoginInProgress = window.sessionStorage.getItem('edunova_login_in_progress') === 'true';
        if (!isLoginInProgress) {
          syncProfile(session.user.id).catch(err => {
            if (!isRefreshTokenError(err)) {
              console.error("Error syncing profile on auth state change:", err);
            }
          });
        }
        fetchGlobalSettings();
      } else if (event === 'SIGNED_OUT' && mounted) {
        console.log("App.tsx: User signed out");
        try {
          window.localStorage.removeItem('edunova_user_profile');
          window.localStorage.removeItem('edunova-auth-token');
        } catch (e) {}
        setUser(null);
        setLoading(false);
      } else if (event === 'PASSWORD_RECOVERY' && session?.user && mounted) {
        console.log("App.tsx: Password recovery event detected");
        await syncProfile(session.user.id, true);
        toast.info("Réinitialisation du mot de passe", {
          description: "Veuillez définir votre nouveau mot de passe de sécurité.",
          duration: 8000,
        });
      } else if (event === 'TOKEN_REFRESHED') {
        // Token refreshed successfully
      } else if (event === 'USER_UPDATED') {
        // User updated
      }
    });

    // Real-time listener for global_settings
    const channel = supabase
      .channel('global_settings_changes')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'global_settings',
      }, (payload) => {
        if (payload.new && payload.new.key === 'system_status' && payload.new.value) {
          setMaintenanceMode(payload.new.value.maintenance_mode);
        } else if (payload.new && payload.new.key === 'security_policy' && payload.new.value) {
          if (payload.new.value.session_timeout_minutes) {
            setSessionTimeoutMinutes(payload.new.value.session_timeout_minutes);
          }
        }
      })
      .subscribe();

    return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
      supabase.removeChannel(channel);
      window.removeEventListener('edunova_auth_error', handleCustomAuthError);
    };
  }, [syncProfile]);

  // Register active session flag in sessionStorage when a user is successfully logged in.
  // When they close the browser tab or browser, sessionStorage is automatically deleted.
  // On subsequent reopenings, if this flag is missing, the security check detects it and logs them out.
  useEffect(() => {
    if (user) {
      try {
        window.sessionStorage.setItem('edunova_session_active', 'true');
      } catch (e) {}
    }
  }, [user]);

  // Read school-specific timeout from custom school settings when authenticated
  useEffect(() => {
    if (!user?.school_id) return;

    let active = true;
    const fetchSchoolTimeout = async () => {
      try {
        const { data, error } = await supabase
          .from('schools')
          .select('global_settings')
          .eq('id', user.school_id)
          .single();

        if (error) {
          console.warn("App.tsx: school settings fetch error (falling back to global policy):", error.message);
          return;
        }

        if (data && data.global_settings && active) {
          let settings: any = {};
          if (typeof data.global_settings === 'string') {
            try { settings = JSON.parse(data.global_settings); } catch (e) {}
          } else {
            settings = data.global_settings;
          }

          if (settings && settings.session_timeout_minutes) {
            const timeoutVal = Number(settings.session_timeout_minutes);
            if (!isNaN(timeoutVal) && timeoutVal > 0) {
              console.log("App.tsx: Applying school-specific timeout limit:", timeoutVal, "minutes");
              setSessionTimeoutMinutes(timeoutVal);
            }
          }
        }
      } catch (err) {
        console.error("App.tsx: Error fetching custom school timeout:", err);
      }
    };

    fetchSchoolTimeout();

    // Listen to real-time updates for school settings too!
    const schoolChannel = supabase
      .channel(`school_settings_changes_${user.school_id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'schools',
        filter: `id=eq.${user.school_id}`
      }, (payload) => {
        if (payload.new && payload.new.global_settings && active) {
          let settings: any = {};
          if (typeof payload.new.global_settings === 'string') {
            try { settings = JSON.parse(payload.new.global_settings); } catch (e) {}
          } else {
            settings = payload.new.global_settings;
          }
          if (settings && settings.session_timeout_minutes) {
            const timeoutVal = Number(settings.session_timeout_minutes);
            if (!isNaN(timeoutVal) && timeoutVal > 0) {
              console.log("App.tsx: Real-time update of school timeout limit:", timeoutVal, "minutes");
              setSessionTimeoutMinutes(timeoutVal);
            }
          }
        }
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(schoolChannel);
    };
  }, [user?.school_id]);

  // Heartbeat Mechanism: Keep Render & Supabase connections alive
  useEffect(() => {
    if (!user) return; // Only send heartbeats when logged in
    
    // Function to ping the server and a lightweight table
    const pingHeartbeat = async () => {
      try {
        // Ping Node.js backend to prevent Render from sleeping
        await fetch('/api/health', { method: 'HEAD' }).catch(() => {});
        
        // Ping Supabase to keep connection pool active
        await supabase.from('global_settings').select('id').limit(1).maybeSingle();
        
        console.debug("Heartbeat sent");
      } catch (err) {
        // Silently ignore heartbeat errors
      }
    };

    // 4 minutes = 240000 ms
    const intervalId = setInterval(pingHeartbeat, 240000);
    
    return () => clearInterval(intervalId);
  }, [user]);

  // Auto-logout & Concurrent Session Check
  useEffect(() => {
    if (!user) return;
    // Bypass auto-logout and session purging during maintenance mode to let users read the maintenance message
    if (maintenanceMode && user.role !== 'SUPER_ADMIN') return;

    const timeoutMins = Math.max(15, Number(sessionTimeoutMinutes) || 15);
    const INACTIVITY_LIMIT = timeoutMins * 60 * 1000; // e.g. 15 minutes in ms
    const GRACE_PERIOD = 30 * 1000; // 30 seconds warning modal countdown
    const TOTAL_ALLOWED_INACTIVITY = INACTIVITY_LIMIT + GRACE_PERIOD;

    // Retrieve last activity from localStorage or set current time
    let lastActivityTimestamp = Date.now();
    const storedLastActivity = window.localStorage.getItem('edunova_last_activity');
    if (storedLastActivity) {
      const parsed = parseInt(storedLastActivity, 10);
      if (!isNaN(parsed) && parsed > 0) {
        lastActivityTimestamp = parsed;
      }
    } else {
      window.localStorage.setItem('edunova_last_activity', lastActivityTimestamp.toString());
    }

    let lastDbUpdateTimestamp = Date.now();
    const isExcludedFromInactivity = false;

    const performInactivityLogout = () => {
      console.warn("Déconnexion forcée pour inactivité prolongée.");
      isWarningShowing.current = true;
      setShowInactivityWarning(false);
      try {
        window.sessionStorage.setItem('edunova_login_error', "Votre session a expiré suite à une période d'inactivité prolongée.");
      } catch (e) {}
      purgeSystemState();
    };

    const evaluateInactivityState = () => {
      if (isExcludedFromInactivity) return;
      const now = Date.now();
      const elapsed = now - lastActivityTimestamp;

      if (elapsed >= TOTAL_ALLOWED_INACTIVITY) {
        performInactivityLogout();
        return;
      }

      if (elapsed >= INACTIVITY_LIMIT) {
        const remainingSeconds = Math.max(1, Math.ceil((TOTAL_ALLOWED_INACTIVITY - elapsed) / 1000));
        setCountdown(remainingSeconds);
        if (!isWarningShowing.current) {
          isWarningShowing.current = true;
          setShowInactivityWarning(true);
        }
      } else {
        if (isWarningShowing.current) {
          isWarningShowing.current = false;
          setShowInactivityWarning(false);
        }
      }
    };

    const resetInactivityTimer = () => {
      if (isWarningShowing.current) return;
      if (isExcludedFromInactivity) return;
      
      const now = Date.now();
      // Throttle localStorage updates to once every 3 seconds
      if (now - lastActivityTimestamp > 3000) {
        window.localStorage.setItem('edunova_last_activity', now.toString());
      }
      lastActivityTimestamp = now;
      evaluateInactivityState();
    };

    const checkSessionState = async () => {
      if (maintenanceMode && user.role !== 'SUPER_ADMIN') return;
      const isLoginInProgress = window.sessionStorage.getItem('edunova_login_in_progress') === 'true';
      if (isLoginInProgress) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('current_session_id, role, is_super_admin, is_active, school_id')
          .eq('id', user.id)
          .single();
          
        if (error) {
          console.warn("App.tsx info: concurrent session check failed:", error.message);
          return;
        }

        if (data) {
          if (data.is_active === false && data.role !== 'SUPER_ADMIN' && !data.is_super_admin) {
            console.warn("Compte désactivé détecté.");
            try { window.sessionStorage.setItem('edunova_login_error', "Votre compte a été désactivé par l'administration."); } catch(e){}
            purgeSystemState();
            return;
          }

          const isSuper = data.role === UserRole.SUPER_ADMIN || data.is_super_admin === true;
          if (data.school_id && !isSuper) {
            const { data: schoolData } = await supabase
              .from('schools')
              .select('status')
              .eq('id', data.school_id)
              .single();
              
            if (schoolData && schoolData.status !== 'ACTIVE') {
              console.warn("Établissement désactivé ou suspendu.");
              try { window.sessionStorage.setItem('edunova_login_error', "Votre établissement a été désactivé ou suspendu."); } catch(e){}
              purgeSystemState();
              return;
            }
          }

          const isExemptFromConcurrent = isSuper;
          const localSessionId = window.localStorage.getItem('edunova_session_id');
          const isSessionSynced = window.localStorage.getItem('edunova_session_synced') === 'true';

          if (!localSessionId) {
            if (data.current_session_id) {
              try { 
                window.localStorage.setItem('edunova_session_id', data.current_session_id); 
                window.localStorage.setItem('edunova_session_synced', 'true');
              } catch(e){}
            }
          } else if (!isExemptFromConcurrent) {
            if (data.current_session_id && data.current_session_id !== localSessionId) {
              // Smooth auto-sync localSessionId to DB to prevent disconnection glitches across tabs
              try {
                await supabase
                  .from('profiles')
                  .update({ current_session_id: localSessionId })
                  .eq('id', user.id);
                try { window.localStorage.setItem('edunova_session_synced', 'true'); } catch(e){}
              } catch (syncCatchErr) {
                console.warn("App.tsx: Session auto-heal sync notice:", syncCatchErr);
              }
            } else if (!data.current_session_id && localSessionId) {
              // Auto-sync missing session ID to database to prevent orphaned state
              try {
                await supabase.from('profiles').update({ current_session_id: localSessionId }).eq('id', user.id);
                window.localStorage.setItem('edunova_session_synced', 'true');
              } catch (e) {}
            }
          }
        }

        if (!isExcludedFromInactivity && lastActivityTimestamp > lastDbUpdateTimestamp) {
          try {
            await supabase
              .from('profiles')
              .update({ last_activity_at: new Date().toISOString() })
              .eq('id', user.id);
            lastDbUpdateTimestamp = Date.now();
          } catch (updateErr) {
            console.error("Error updating activity:", updateErr);
          }
        }
      } catch (err) {
        console.error("Erreur check session:", err);
      }
    };

    const handleVisibilityOrFocus = () => {
      // Re-read stored activity timestamp on wake or focus
      const stored = window.localStorage.getItem('edunova_last_activity');
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed > 0) {
          lastActivityTimestamp = parsed;
        }
      }

      evaluateInactivityState();
      if (document.visibilityState === 'visible') {
        checkSessionState();
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'edunova_last_activity' && e.newValue) {
        const parsed = parseInt(e.newValue, 10);
        if (!isNaN(parsed) && parsed > 0) {
          lastActivityTimestamp = parsed;
          if (isWarningShowing.current) {
            isWarningShowing.current = false;
            setShowInactivityWarning(false);
          }
        }
      }
    };

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    if (!isExcludedFromInactivity) {
      activityEvents.forEach(event => document.addEventListener(event, resetInactivityTimer, { passive: true }));
    }
    
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('storage', handleStorageChange);

    // Initial evaluation on mount
    evaluateInactivityState();

    // Ticker running every 3 seconds to guarantee strict inactivity monitoring
    const inactivityCheckTicker = setInterval(evaluateInactivityState, 3000);
    const updateActivityInterval = setInterval(checkSessionState, 60000);

    // Initial session check
    checkSessionState();

    return () => {
      clearInterval(inactivityCheckTicker);
      clearInterval(updateActivityInterval);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('storage', handleStorageChange);
      if (!isExcludedFromInactivity) {
        activityEvents.forEach(event => document.removeEventListener(event, resetInactivityTimer));
      }
    };
  }, [user, purgeSystemState, sessionTimeoutMinutes, maintenanceMode]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showInactivityWarning) {
      setCountdown(30); // 30 seconds to react
      interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            purgeSystemState();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showInactivityWarning, purgeSystemState]);

  if (isExiting) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-indigo-600 border-r-transparent mx-auto"></div>
          <p className="text-slate-600 font-medium text-sm">Fermeture sécurisée...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    console.log("App.tsx: Rendering AppLoadingScreen with dynamic stages and session hydration");
    const cachedProfile = (() => {
      try {
        const raw = window.localStorage.getItem('edunova_user_profile');
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    })();

    return (
      <AppLoadingScreen
        currentStage={loadingStage}
        cachedUserName={cachedProfile?.full_name || cachedProfile?.email}
        cachedUserRole={cachedProfile?.role}
        isOffline={!navigator.onLine}
        onContinueOffline={() => {
          if (cachedProfile) {
            setUser(cachedProfile);
            setLoading(false);
          }
        }}
        onSkipToLogin={() => {
          setLoading(false);
          setUser(null);
        }}
      />
    );
  }

  if (!user) {
    console.log("App.tsx: Rendering Login component");
    return (
      <ErrorBoundary>
        <Login onLogin={(u) => {
          try { window.sessionStorage.removeItem('edunova_login_in_progress'); } catch(e){}
          setUser(u);
          // Force redirection to dashboard on login to avoid landing on a deep link from a previous session
          if (window.location.hash !== '#/') {
            window.location.hash = '#/';
          }
        }} onReset={purgeSystemState} />
        <PwaInstallModal />
      </ErrorBoundary>
    );
  }

  console.log("App.tsx: Rendering AnimatedRoutes for user", user.id);
  
  const isDirection = [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR].includes(user.role);
  if (!isDirection && (!isInOfficeHours || !isAllowedLocation)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert size={40} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Accès Restreint</h1>
          <p className="text-slate-600 mb-8 leading-relaxed">
            Pour des raisons de sécurité, l'accès au système n'est autorisé que depuis le territoire national et pendant les heures régulières de bureau (06h00 - 19h00).
          </p>
          <button 
            onClick={purgeSystemState}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-4 rounded-xl transition-colors"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <HashRouter>
        <Toaster position="top-center" richColors closeButton expand={false} mobile-bottom-center />
        {apiError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-4 z-[9999] bg-rose-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 w-[90%] md:w-auto">
          <ShieldAlert size={20} className="shrink-0" />
          <p className="font-bold text-sm tracking-tight">{apiError}</p>
        </div>
      )}
      {showInactivityWarning && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              ⏳
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Session expirée imminente</h2>
            <p className="text-slate-600 mb-6">
              Pour des raisons de sécurité, votre session sera fermée dans <span className="font-bold text-red-600 text-lg">{countdown}s</span> suite à une inactivité.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => purgeSystemState()}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors"
              >
                Me déconnecter
              </button>
              <button
                onClick={() => {
                  const now = Date.now();
                  try {
                    window.localStorage.setItem('edunova_last_activity', now.toString());
                  } catch (e) {}
                  setShowInactivityWarning(false);
                  isWarningShowing.current = false;
                }}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-200"
              >
                Rester connecté
              </button>
            </div>
          </div>
        </div>
      )}
      <SubscriptionGuard user={user} onLogout={purgeSystemState}>
        <AnimatedRoutes user={user} purgeSystemState={purgeSystemState} maintenanceMode={maintenanceMode} />
      </SubscriptionGuard>
      <PwaInstallModal />
    </HashRouter>
    </ErrorBoundary>
  );
};

export default App;