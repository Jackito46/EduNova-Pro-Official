import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import Sidebar from './Sidebar';
import ConnectivityBanner from './ConnectivityBanner';
import { SuperAdminRoute } from './SuperAdminRoute';
import { SubscriptionGuard } from './SubscriptionGuard';
import { SessionGuard } from './SessionGuard';
import { RoleGuard } from './RoleGuard';
import { ModuleGuard } from './ModuleGuard';
import { DesktopDeviceGuard } from './DesktopDeviceGuard';
import { ErrorBoundary } from './ErrorBoundary';
import { SchoolProvider } from '../contexts/SchoolContext';
import AppFooter from './AppFooter';
import { NotificationBanner } from './NotificationBanner';
import { AiQuotaAlertBanner } from './AiQuotaAlertBanner';
import { AutonomousAdminWarningBanner } from './AutonomousAdminWarningBanner';
import { PayrollSensitiveNotificationListener } from './PayrollSensitiveNotificationListener';
import { GlobalShortcuts } from './GlobalShortcuts';
import { ModernDashboardSkeleton, FluidLoadingState, StudentDossierSkeleton } from './SkeletonLoader';
import { UserProfile, UserRole } from '../types';
import { lazyWithRetry } from '../utils/lazyWithRetry';
import { OfflineDashboard } from './OfflineDashboard';
import { scheduleIdleRoutePrefetch } from '../utils/routePrefetch';

const Dashboard = lazyWithRetry(() => import('./Dashboard'));
const StudentForm = lazyWithRetry(() => import('./StudentForm'));
const StudentList = lazyWithRetry(() => import('./StudentList'));
const StudentDetailView = lazyWithRetry(() => import('./StudentDetailView'));
const StudentProfileView = lazyWithRetry(() => import('./StudentProfileView').then(m => ({ default: m.StudentProfileView })));
const StudentCoursesView = lazyWithRetry(() => import('./StudentCoursesView').then(m => ({ default: m.StudentCoursesView })));
const StudentGradesView = lazyWithRetry(() => import('./StudentGradesView').then(m => ({ default: m.StudentGradesView })));
const StudentFinanceView = lazyWithRetry(() => import('./StudentFinanceView').then(m => ({ default: m.StudentFinanceView })));
const StudentScheduleView = lazyWithRetry(() => import('./StudentScheduleView').then(m => ({ default: m.StudentScheduleView })));
const StudentHeader = lazyWithRetry(() => import('./StudentHeader').then(m => ({ default: m.StudentHeader })));
const ClassManagement = lazyWithRetry(() => import('./ClassManagement'));
const ClassForm = lazyWithRetry(() => import('./ClassForm'));
const SubjectForm = lazyWithRetry(() => import('./SubjectForm'));
const ClassSubjectManager = lazyWithRetry(() => import('./ClassSubjectManager'));
const GradesView = lazyWithRetry(() => import('./GradesView'));
const SyllabusHub = lazyWithRetry(() => import('./SyllabusHub'));
const HomeworkManager = lazyWithRetry(() => import('./HomeworkManager').then(m => ({ default: m.HomeworkManager })));
const ReportCardsView = lazyWithRetry(() => import('./ReportCardsView'));
const ScheduleView = lazyWithRetry(() => import('./ScheduleView'));
const CourseSignatureView = lazyWithRetry(() => import('./CourseSignatureView'));
const AttendanceView = lazyWithRetry(() => import('./AttendanceView'));
const SettingsView = lazyWithRetry(() => import('./SettingsView'));
const TuitionPaymentForm = lazyWithRetry(() => import('./TuitionPaymentForm'));
const FeePlanningView = lazyWithRetry(() => import('./FeePlanningView'));
const ReceiptManagementView = lazyWithRetry(() => import('./ReceiptManagementView'));
const StudentPaymentTracking = lazyWithRetry(() => import('./StudentPaymentTracking'));
const AccountStatementView = lazyWithRetry(() => import('./AccountStatementView'));
const PaymentHistoryList = lazyWithRetry(() => import('./PaymentHistoryList'));
const FinanceHub = lazyWithRetry(() => import('./FinanceHub'));
const ExpensesView = lazyWithRetry(() => import('./ExpensesView'));
const ExpenseForm = lazyWithRetry(() => import('./ExpenseForm'));
const SuppliesView = lazyWithRetry(() => import('./SuppliesView'));
const PayrollManagementView = lazyWithRetry(() => import('./PayrollManagementView'));
const DiscountManagementView = lazyWithRetry(() => import('./DiscountManagementView'));
const ReductionReportView = lazyWithRetry(() => import('./ReductionReportView'));
const AdHocCampaignsView = lazyWithRetry(() => import('./AdHocCampaignsView'));
const StaffManagement = lazyWithRetry(() => import('./StaffManagement'));
const StaffForm = lazyWithRetry(() => import('./StaffForm'));
const StaffAssignmentView = lazyWithRetry(() => import('./StaffAssignmentView'));
const StaffAttendanceView = lazyWithRetry(() => import('./StaffAttendanceView'));
const DisciplinaryView = lazyWithRetry(() => import('./DisciplinaryView'));
const FinancialAuditView = lazyWithRetry(() => import('./FinancialAuditView'));
const StudentCurrencyDiagnosticView = lazyWithRetry(() => import('./StudentCurrencyDiagnosticView'));
const BudgetPlanningView = lazyWithRetry(() => import('./BudgetPlanningView'));
const DebtorsListView = lazyWithRetry(() => import('./DebtorsListView'));
const UserManagementView = lazyWithRetry(() => import('./UserManagementView'));
const ReportsView = lazyWithRetry(() => import('./ReportsView'));
const MultiCampusDashboardView = lazyWithRetry(() => import('./MultiCampusDashboardView').then(m => ({ default: m.MultiCampusDashboardView })));
const AuditLogsView = lazyWithRetry(() => import('./AuditLogsView').then(m => ({ default: m.AuditLogsView })));
const ValidationList = lazyWithRetry(() => import('./ValidationList'));
const ForcePasswordChange = lazyWithRetry(() => import('./ForcePasswordChange').then(m => ({ default: m.ForcePasswordChange })));
const PwaInstallModal = lazyWithRetry(() => import('./PwaInstallModal').then(m => ({ default: m.PwaInstallModal })));
const SuperAdminDashboard = lazyWithRetry(() => import('./SuperAdminDashboard').then(m => ({ default: m.SuperAdminDashboard })));
const SystemHealthView = lazyWithRetry(() => import('./SystemHealthView').then(m => ({ default: m.SystemHealthView })));
const EmailModule = lazyWithRetry(() => import('./EmailModule'));
const SmsModule = lazyWithRetry(() => import('./SmsModule'));
const PushModule = lazyWithRetry(() => import('./PushModule'));
const WhatsAppModule = lazyWithRetry(() => import('./WhatsAppModule'));

interface AuthenticatedShellProps {
  user: UserProfile;
  purgeSystemState: (options?: any) => void;
  maintenanceMode: boolean;
}

const getRouteLoadingLabel = (pathname: string): string => {
  if (pathname.startsWith('/eleves/detail/')) return 'Ouverture de la fiche élève...';
  if (pathname.startsWith('/eleves/reinscrire/')) return 'Ouverture de la réinscription...';
  if (pathname.startsWith('/eleves/modifier/')) return 'Modification du dossier élève...';
  if (pathname.startsWith('/eleves/ajouter') || pathname.startsWith('/eleves/inscrire')) {
    return 'Nouvelle inscription...';
  }
  if (pathname.startsWith('/eleves/validation')) return 'Validation des dossiers...';
  if (pathname.startsWith('/eleves')) return 'Registre des élèves...';
  if (pathname.startsWith('/settings/ecole') || pathname === '/settings' || pathname === '/parametres') {
    return 'Identité Établissement...';
  }
  if (pathname.startsWith('/settings/utilisateurs')) return 'Gestion des Utilisateurs...';
  if (pathname.startsWith('/settings/audit')) return 'Journal d’Audit...';
  if (pathname.startsWith('/classes') || pathname.startsWith('/matieres')) return 'Classes & Matières...';
  if (pathname.startsWith('/notes')) return 'Saisie des Notes...';
  if (pathname.startsWith('/presences')) return 'Suivi des Présences...';
  if (pathname.startsWith('/bulletins')) return 'Édition des Bulletins...';
  if (pathname.startsWith('/economat') || pathname === '/fees') return 'Économat & Finance...';
  if (pathname.startsWith('/personnel')) return 'Ressources Humaines...';
  if (pathname.startsWith('/rapports')) return 'Rapports & Bilans...';
  if (pathname.startsWith('/communication')) return 'Communication...';
  return 'Ouverture...';
};

const RouteSuspenseFallback: React.FC<{ pathname: string; onRetry: () => void }> = ({ pathname, onRetry }) => {
  const [isSlowWait, setIsSlowWait] = useState(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    setIsSlowWait(typeof navigator !== 'undefined' ? !navigator.onLine : false);
    const timer = setTimeout(() => setIsSlowWait(true), 3000);
    const onOffline = () => setIsSlowWait(true);
    window.addEventListener('offline', onOffline);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('offline', onOffline);
    };
  }, [pathname]);

  if (pathname === '/' || pathname === '/dashboard') {
    return <ModernDashboardSkeleton onRetry={onRetry} />;
  }

  if (pathname.startsWith('/eleves/detail/')) {
    return <StudentDossierSkeleton title={getRouteLoadingLabel(pathname)} onRetry={onRetry} />;
  }

  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  const subtext = isOffline
    ? 'Hors-ligne — cache local requis'
    : isSlowWait
      ? 'Connexion lente, patientez ou réessayez'
      : undefined;

  return (
    <div className="max-w-lg mx-auto my-8 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
      <FluidLoadingState
        message={getRouteLoadingLabel(pathname)}
        subtext={subtext}
      />
      {(isSlowWait || isOffline) && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              if (isOffline) {
                window.location.hash = '#/offline';
              } else {
                onRetry();
              }
            }}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            {isOffline ? 'Coffre hors-ligne' : 'Réessayer'}
          </button>
        </div>
      )}
    </div>
  );
};

const AuthenticatedRoutes: React.FC<AuthenticatedShellProps> = ({
  user,
  purgeSystemState,
  maintenanceMode
}) => {
  const location = useLocation();
  const [routeRetryNonce, setRouteRetryNonce] = useState(0);

  useEffect(() => {
    scheduleIdleRoutePrefetch();
  }, []);

  const isPwaStandalone = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')
    );
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const searchStr = window.location.search || '';
    const hashStr = window.location.hash || '';
    const fullUrl = searchStr + hashStr;

    if (fullUrl.includes('payment=success') || fullUrl.includes('payment=cancel') || searchStr.includes('redirect_to=')) {
      const searchParams = new URLSearchParams(searchStr.replace(/^\?/, ''));
      const hashQueryPart = hashStr.includes('?') ? hashStr.split('?')[1] : '';
      const hashParams = new URLSearchParams(hashQueryPart);

      const ref = searchParams.get('ref') || hashParams.get('ref') || '';
      const amount = searchParams.get('amount') || hashParams.get('amount') || '';
      const studentId = searchParams.get('student_id') || hashParams.get('student_id') || '';
      const operator = searchParams.get('operator') || hashParams.get('operator') || 'moncash';
      const redirectTo = searchParams.get('redirect_to') || hashParams.get('redirect_to') || '';
      const isSuccess = fullUrl.includes('payment=success');

      const isStudentOrParent =
        user.role === UserRole.STUDENT ||
        user.role === UserRole.PARENT ||
        Boolean(studentId) ||
        redirectTo === 'mon-economat';

      if (isStudentOrParent) {
        const targetQuery = isSuccess
          ? `payment=success&ref=${encodeURIComponent(ref)}&amount=${encodeURIComponent(amount)}&student_id=${encodeURIComponent(studentId)}&operator=${encodeURIComponent(operator)}`
          : `payment=cancel&ref=${encodeURIComponent(ref)}`;

        const targetHashUrl = `#/mon-economat?${targetQuery}`;

        if (searchStr || !window.location.hash.includes('mon-economat')) {
          window.history.replaceState({}, document.title, `${window.location.pathname}${targetHashUrl}`);
          if (window.location.hash !== `#/mon-economat?${targetQuery}`) {
            window.location.hash = `#/mon-economat?${targetQuery}`;
          }
        }
      }
    }
  }, [user.role]);

  const isDashboard = location.pathname === '/' || location.pathname === '/dashboard';

  const adminRoles = [UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR];
  const financeRoles = [...adminRoles, UserRole.ACCOUNTANT];
  const cashierRoles = [...adminRoles, UserRole.ACCOUNTANT, UserRole.SECRETARY, UserRole.SUPERVISOR];
  const hrRoles = [...adminRoles];
  const studentMgmtRoles = [...adminRoles, UserRole.SECRETARY];
  const academicRoles = [...adminRoles, UserRole.SECRETARY, UserRole.TEACHER, UserRole.SUPERVISOR];
  const restrictedAcademicRoles = [...adminRoles, UserRole.SECRETARY, UserRole.SUPERVISOR];
  const allStaffRoles = [...academicRoles, UserRole.ACCOUNTANT, UserRole.LIBRARIAN];

  const [mainContentBg, setMainContentBg] = useState<string>('rgb(248, 250, 252)');

  useEffect(() => {
    const scrollContainer = document.getElementById('main-content-scroll');
    if (!scrollContainer) return;

    let rafId: number | null = null;
    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const scrollTop = scrollContainer.scrollTop || 0;
        const progress = Math.min(1, Math.max(0, scrollTop / 200));
        const r = Math.round(248 - (248 - 241) * progress);
        const g = Math.round(250 - (250 - 245) * progress);
        const b = Math.round(252 - (252 - 249) * progress);
        setMainContentBg(`rgb(${r}, ${g}, ${b})`);
      });
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [location.pathname]);

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
              onClick={() => purgeSystemState()}
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
    return (
      <React.Suspense fallback={<ModernDashboardSkeleton />}>
        <ForcePasswordChange user={user} onPasswordChanged={() => purgeSystemState()} />
      </React.Suspense>
    );
  }

  return (
    <SchoolProvider user={user} schoolId={user.school_id}>
      <SessionGuard user={user}>
        {Boolean(
          user &&
          user.role !== UserRole.PARENT &&
          (user.role as any) !== 'PARENT' &&
          (user.role as any) !== 'parent' &&
          (
            user.is_super_admin ||
            user.role === UserRole.SUPER_ADMIN ||
            (user.role as any) === 'SUPER_ADMIN' ||
            user.role === UserRole.DIRECTOR ||
            (user.role as any) === 'DIRECTOR' ||
            user.role === UserRole.SCHOOL_ADMIN ||
            (user.role as any) === 'SCHOOL_ADMIN' ||
            (user.role as any) === 'admin'
          )
        ) && (
          <GlobalShortcuts user={user} />
        )}
        <div className="flex h-screen bg-[#f3f4f6] overflow-hidden font-sans">
          <ErrorBoundary>
            <Sidebar user={user} onLogout={purgeSystemState} />
          </ErrorBoundary>
          <main
            id="main-content-scroll"
            style={{ backgroundColor: mainContentBg }}
            className={`flex-1 min-w-0 overflow-y-auto custom-scrollbar relative print:p-0 print:overflow-visible transition-colors duration-150 ease-out ${
              isDashboard ? 'p-0' : 'p-4 pt-16 sm:p-5 lg:p-6 2xl:p-8'
            }`}
          >
            {user.role === UserRole.STUDENT && !isDashboard && (
              <React.Suspense fallback={<div className="h-16 animate-pulse bg-white/70 rounded-xl mb-4" />}>
                <StudentHeader user={user} />
              </React.Suspense>
            )}
            {!isDashboard && (
              <>
                <ConnectivityBanner />
                <NotificationBanner userId={user.id} schoolId={user.school_id || ''} />
                <AutonomousAdminWarningBanner user={user} />
                <PayrollSensitiveNotificationListener user={user} />
                <AiQuotaAlertBanner user={user} />
              </>
            )}
            <ErrorBoundary key={`${location.pathname}-${routeRetryNonce}`}>
              <div key={location.pathname} className="w-full min-w-0 animate-in fade-in duration-150">
                <React.Suspense
                  fallback={
                    <RouteSuspenseFallback
                      pathname={location.pathname}
                      onRetry={() => setRouteRetryNonce((n) => n + 1)}
                    />
                  }
                >
                  <Routes location={location}>
                      <Route path="/" element={<Dashboard user={user} />} />
                      <Route path="/dashboard" element={<Navigate to="/" replace />} />
                      <Route path="/offline" element={<RoleGuard user={user} allowedRoles={allStaffRoles}><OfflineDashboard user={user} /></RoleGuard>} />
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

                      {/* Student & Parent Portal Routes */}
                      <Route path="/profil" element={<RoleGuard user={user} allowedRoles={[UserRole.STUDENT, UserRole.PARENT, ...adminRoles]}><StudentProfileView user={user} /></RoleGuard>} />
                      <Route path="/mes-cours" element={<RoleGuard user={user} allowedRoles={[UserRole.STUDENT, UserRole.PARENT, ...adminRoles]}><StudentCoursesView user={user} /></RoleGuard>} />
                      <Route path="/mes-devoirs" element={<RoleGuard user={user} allowedRoles={[UserRole.STUDENT, UserRole.PARENT, ...academicRoles]}><HomeworkManager user={user} defaultTab="student" /></RoleGuard>} />
                      <Route path="/mes-notes" element={<ModuleGuard moduleId="exams" moduleName="Mes Notes" user={user}><RoleGuard user={user} allowedRoles={[UserRole.STUDENT, UserRole.PARENT, ...adminRoles]}><StudentGradesView user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/mon-economat" element={<ModuleGuard moduleId="finance" moduleName="Mon Économat" user={user}><RoleGuard user={user} allowedRoles={[UserRole.STUDENT, UserRole.PARENT, ...adminRoles, UserRole.ACCOUNTANT]}><StudentFinanceView user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/mon-horaire" element={<RoleGuard user={user} allowedRoles={[UserRole.STUDENT, UserRole.PARENT, ...adminRoles]}><StudentScheduleView user={user} /></RoleGuard>} />

                      {/* Academic Routes */}
                      <Route path="/eleves" element={<RoleGuard user={user} allowedRoles={restrictedAcademicRoles}><StudentList user={user} /></RoleGuard>} />
                      <Route path="/eleves/liste" element={<RoleGuard user={user} allowedRoles={restrictedAcademicRoles}><StudentList user={user} /></RoleGuard>} />
                      <Route path="/eleves/validation" element={<RoleGuard user={user} allowedRoles={studentMgmtRoles}><ValidationList user={user} /></RoleGuard>} />
                      <Route path="/eleves/detail/:id" element={<RoleGuard user={user} allowedRoles={restrictedAcademicRoles}><StudentDetailView user={user} /></RoleGuard>} />
                      <Route path="/eleves/ajouter" element={<RoleGuard user={user} allowedRoles={studentMgmtRoles}><StudentForm user={user} /></RoleGuard>} />
                      <Route path="/eleves/inscrire" element={<RoleGuard user={user} allowedRoles={studentMgmtRoles}><StudentForm user={user} /></RoleGuard>} />
                      <Route path="/eleves/modifier/:id" element={<RoleGuard user={user} allowedRoles={studentMgmtRoles}><StudentForm user={user} /></RoleGuard>} />
                      <Route path="/eleves/reinscrire/:id" element={<RoleGuard user={user} allowedRoles={studentMgmtRoles}><StudentForm user={user} /></RoleGuard>} />
                      <Route path="/classes" element={<RoleGuard user={user} allowedRoles={restrictedAcademicRoles}><ClassManagement user={user} /></RoleGuard>} />
                      <Route path="/classes/ajouter" element={<RoleGuard user={user} allowedRoles={adminRoles}><ClassForm user={user} /></RoleGuard>} />
                      <Route path="/classes/modifier/:id" element={<RoleGuard user={user} allowedRoles={adminRoles}><ClassForm user={user} /></RoleGuard>} />
                      <Route path="/classes/:id/matieres" element={<RoleGuard user={user} allowedRoles={adminRoles}><ClassSubjectManager user={user} /></RoleGuard>} />
                      <Route path="/matieres" element={<RoleGuard user={user} allowedRoles={restrictedAcademicRoles}><ClassManagement user={user} /></RoleGuard>} />
                      <Route path="/matieres/ajouter" element={<RoleGuard user={user} allowedRoles={adminRoles}><SubjectForm user={user} /></RoleGuard>} />
                      <Route path="/matieres/modifier/:id" element={<RoleGuard user={user} allowedRoles={adminRoles}><SubjectForm user={user} /></RoleGuard>} />
                      <Route path="/notes" element={<ModuleGuard moduleId="exams" moduleName="Saisie des Notes" user={user}><RoleGuard user={user} allowedRoles={academicRoles}><GradesView user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/devoirs" element={<RoleGuard user={user} allowedRoles={academicRoles}><HomeworkManager user={user} defaultTab="teacher" /></RoleGuard>} />
                      <Route path="/enseignant/syllabus" element={<RoleGuard user={user} allowedRoles={academicRoles}><SyllabusHub user={user} /></RoleGuard>} />
                      <Route path="/presences" element={<ModuleGuard moduleId="attendance" moduleName="Suivi des Présences" user={user}><RoleGuard user={user} allowedRoles={academicRoles}><AttendanceView user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/bulletins" element={<ModuleGuard moduleId="exams" moduleName="Édition & Clôture des Bulletins Scolaires" user={user}><RoleGuard user={user} allowedRoles={restrictedAcademicRoles}><DesktopDeviceGuard user={user} moduleTitle="Édition & Clôture des Bulletins Scolaires"><ReportCardsView user={user} /></DesktopDeviceGuard></RoleGuard></ModuleGuard>} />
                      <Route path="/discipline" element={<ModuleGuard moduleId="discipline" moduleName="Discipline & Vie Scolaire" user={user}><RoleGuard user={user} allowedRoles={academicRoles}><DisciplinaryView user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/horaire" element={<RoleGuard user={user} allowedRoles={academicRoles}><ScheduleView user={user} /></RoleGuard>} />
                      <Route path="/enseignant/pointage" element={<RoleGuard user={user} allowedRoles={[UserRole.TEACHER, ...adminRoles, UserRole.SECRETARY]}><CourseSignatureView user={user} /></RoleGuard>} />

                      {/* HR Routes */}
                      <Route path="/personnel" element={<RoleGuard user={user} allowedRoles={hrRoles}><StaffManagement user={user} /></RoleGuard>} />
                      <Route path="/personnel/embaucher" element={<RoleGuard user={user} allowedRoles={adminRoles}><StaffForm user={user} /></RoleGuard>} />
                      <Route path="/personnel/modifier/:id" element={<RoleGuard user={user} allowedRoles={adminRoles}><StaffForm user={user} /></RoleGuard>} />
                      <Route path="/personnel/affectation/:id" element={<RoleGuard user={user} allowedRoles={adminRoles}><StaffAssignmentView user={user} /></RoleGuard>} />
                      <Route path="/personnel/pointage" element={<RoleGuard user={user} allowedRoles={hrRoles}><StaffAttendanceView user={user} /></RoleGuard>} />

                      {/* Finance Routes */}
                      <Route path="/fees" element={<ModuleGuard moduleId="finance" moduleName="Guichet d'Encaissement" user={user}><RoleGuard user={user} allowedRoles={cashierRoles}><TuitionPaymentForm user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/economat" element={<ModuleGuard moduleId="finance" moduleName="Direction Économat" user={user}><RoleGuard user={user} allowedRoles={financeRoles}><FinanceHub user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/economat/frais" element={<ModuleGuard moduleId="finance" moduleName="Guichet d'Encaissement" user={user}><RoleGuard user={user} allowedRoles={cashierRoles}><TuitionPaymentForm user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/economat/paiement" element={<ModuleGuard moduleId="finance" moduleName="Guichet d'Encaissement" user={user}><RoleGuard user={user} allowedRoles={cashierRoles}><TuitionPaymentForm user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/economat/paiements" element={<ModuleGuard moduleId="finance" moduleName="Guichet d'Encaissement" user={user}><RoleGuard user={user} allowedRoles={cashierRoles}><TuitionPaymentForm user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/economat/factures" element={<ModuleGuard moduleId="finance" moduleName="Factures & Reçus" user={user}><RoleGuard user={user} allowedRoles={cashierRoles}><ReceiptManagementView user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/economat/facture/:id" element={<ModuleGuard moduleId="finance" moduleName="Factures & Reçus" user={user}><RoleGuard user={user} allowedRoles={cashierRoles}><ReceiptManagementView user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/economat/recus" element={<ModuleGuard moduleId="finance" moduleName="Factures & Reçus" user={user}><RoleGuard user={user} allowedRoles={cashierRoles}><ReceiptManagementView user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/economat/recu/:id" element={<ModuleGuard moduleId="finance" moduleName="Factures & Reçus" user={user}><RoleGuard user={user} allowedRoles={cashierRoles}><ReceiptManagementView user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/economat/releves" element={<ModuleGuard moduleId="finance" moduleName="Relevé de Compte" user={user}><RoleGuard user={user} allowedRoles={cashierRoles}><AccountStatementView user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/economat/releve-compte" element={<ModuleGuard moduleId="finance" moduleName="Relevé de Compte" user={user}><RoleGuard user={user} allowedRoles={cashierRoles}><AccountStatementView user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/economat/suivi" element={<ModuleGuard moduleId="finance" moduleName="Suivi des Paiements" user={user}><RoleGuard user={user} allowedRoles={cashierRoles}><StudentPaymentTracking user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/economat/debiteurs" element={<ModuleGuard moduleId="finance" moduleName="Liste des Débiteurs" user={user}><RoleGuard user={user} allowedRoles={cashierRoles}><DebtorsListView user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/economat/liste" element={<ModuleGuard moduleId="finance" moduleName="Registre des Paiements" user={user}><RoleGuard user={user} allowedRoles={cashierRoles}><PaymentHistoryList user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/economat/historique" element={<ModuleGuard moduleId="finance" moduleName="Registre des Paiements" user={user}><RoleGuard user={user} allowedRoles={cashierRoles}><PaymentHistoryList user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/economat/depenses" element={<ModuleGuard moduleId="finance" moduleName="Registre des Dépenses" user={user}><RoleGuard user={user} allowedRoles={[...adminRoles, UserRole.ACCOUNTANT]}><ExpensesView user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/economat/depenses/ajouter" element={<ModuleGuard moduleId="finance" moduleName="Ajouter une Dépense" user={user}><RoleGuard user={user} allowedRoles={[...adminRoles, UserRole.ACCOUNTANT]}><ExpenseForm user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/economat/depenses/modifier/:id" element={<ModuleGuard moduleId="finance" moduleName="Modifier une Dépense" user={user}><RoleGuard user={user} allowedRoles={[...adminRoles, UserRole.ACCOUNTANT]}><ExpenseForm user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/economat/fournitures" element={<ModuleGuard moduleId="inventory" moduleName="Fournitures & Stocks (Inventaire)" user={user}><RoleGuard user={user} allowedRoles={cashierRoles}><SuppliesView user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/economat/planification" element={<ModuleGuard moduleId="finance" moduleName="Planification Frais" user={user}><RoleGuard user={user} allowedRoles={[...adminRoles, UserRole.ACCOUNTANT]}><FeePlanningView user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/economat/planning" element={<ModuleGuard moduleId="finance" moduleName="Planification Frais" user={user}><RoleGuard user={user} allowedRoles={[...adminRoles, UserRole.ACCOUNTANT]}><FeePlanningView user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/economat/frais-occasionnels" element={<ModuleGuard moduleId="finance" moduleName="Campagnes & Événements" user={user}><RoleGuard user={user} allowedRoles={financeRoles}><AdHocCampaignsView user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/economat/derogations" element={<ModuleGuard moduleId="finance" moduleName="Dérogations & Réévaluations" user={user}><RoleGuard user={user} allowedRoles={adminRoles}><DiscountManagementView user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/economat/rapport-reductions" element={<ModuleGuard moduleId="finance" moduleName="Rapports Réductions" user={user}><RoleGuard user={user} allowedRoles={financeRoles}><ReductionReportView user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/economat/paie" element={<ModuleGuard moduleId="finance" moduleName="Gestion Payroll" user={user}><RoleGuard user={user} allowedRoles={[...adminRoles, UserRole.ACCOUNTANT]}><PayrollManagementView user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/economat/budget" element={<ModuleGuard moduleId="finance" moduleName="Planification Budgétaire" user={user}><RoleGuard user={user} allowedRoles={[...adminRoles, UserRole.ACCOUNTANT]}><DesktopDeviceGuard user={user} moduleTitle="Planification Budgétaire & Arbitrages"><BudgetPlanningView user={user} /></DesktopDeviceGuard></RoleGuard></ModuleGuard>} />
                      <Route path="/economat/audit" element={<ModuleGuard moduleId="finance" moduleName="Audit Financier" user={user}><RoleGuard user={user} allowedRoles={[...adminRoles, UserRole.ACCOUNTANT]}><DesktopDeviceGuard user={user} moduleTitle="Audit Financier & Clôtures"><FinancialAuditView user={user} /></DesktopDeviceGuard></RoleGuard></ModuleGuard>} />
                      <Route path="/economat/diagnostic" element={<ModuleGuard moduleId="finance" moduleName="Diagnostic Barème & Devises" user={user}><RoleGuard user={user} allowedRoles={financeRoles}><StudentCurrencyDiagnosticView user={user} /></RoleGuard></ModuleGuard>} />
                      <Route path="/economat/diagnostic-bareme" element={<ModuleGuard moduleId="finance" moduleName="Diagnostic Barème & Devises" user={user}><RoleGuard user={user} allowedRoles={financeRoles}><StudentCurrencyDiagnosticView user={user} /></RoleGuard></ModuleGuard>} />

                      {/* Reports Routes */}
                      <Route path="/rapports" element={<RoleGuard user={user} allowedRoles={[...adminRoles, UserRole.ACCOUNTANT, UserRole.SECRETARY]}><ReportsView user={user} /></RoleGuard>} />
                      <Route path="/supervision-annexes" element={<RoleGuard user={user} allowedRoles={[...adminRoles, UserRole.ACCOUNTANT, UserRole.DIRECTOR]}><DesktopDeviceGuard user={user} moduleTitle="Supervision Multi-Campus Institutionnelle"><MultiCampusDashboardView user={user} /></DesktopDeviceGuard></RoleGuard>} />
                      <Route path="/direction/supervision-annexes" element={<RoleGuard user={user} allowedRoles={[...adminRoles, UserRole.ACCOUNTANT, UserRole.DIRECTOR]}><DesktopDeviceGuard user={user} moduleTitle="Supervision Multi-Campus Institutionnelle"><MultiCampusDashboardView user={user} /></DesktopDeviceGuard></RoleGuard>} />

                      {/* Communication Routes */}
                      <Route path="/communication" element={<Navigate to="/communication/whatsapp" replace />} />
                      <Route path="/communication/whatsapp" element={<RoleGuard user={user} allowedRoles={adminRoles}><WhatsAppModule user={user} /></RoleGuard>} />
                      <Route path="/communication/email" element={<RoleGuard user={user} allowedRoles={adminRoles}><EmailModule user={user} /></RoleGuard>} />
                      <Route path="/communication/sms" element={<RoleGuard user={user} allowedRoles={adminRoles}><SmsModule user={user} /></RoleGuard>} />
                      <Route path="/communication/push" element={<RoleGuard user={user} allowedRoles={adminRoles}><PushModule user={user} /></RoleGuard>} />

                      {/* Settings Routes */}
                      <Route path="/settings" element={<Navigate to="/settings/ecole" replace />} />
                      <Route path="/parametres" element={<Navigate to="/settings/ecole" replace />} />
                      <Route path="/settings/ecole" element={<RoleGuard user={user} allowedRoles={adminRoles}><SettingsView user={user} /></RoleGuard>} />
                      <Route path="/settings/utilisateurs" element={<RoleGuard user={user} allowedRoles={adminRoles}><UserManagementView currentUser={user} /></RoleGuard>} />
                      <Route path="/settings/audit" element={<RoleGuard user={user} allowedRoles={adminRoles}><AuditLogsView user={user} /></RoleGuard>} />

                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </React.Suspense>
              </div>
            </ErrorBoundary>

            {!isPwaStandalone && <AppFooter />}
          </main>
        </div>
      </SessionGuard>
    </SchoolProvider>
  );
};

export const AuthenticatedShell: React.FC<AuthenticatedShellProps> = ({
  user,
  purgeSystemState,
  maintenanceMode
}) => {
  return (
    <>
      <SubscriptionGuard user={user} onLogout={purgeSystemState}>
        <AuthenticatedRoutes
          user={user}
          purgeSystemState={purgeSystemState}
          maintenanceMode={maintenanceMode}
        />
      </SubscriptionGuard>
      <React.Suspense fallback={null}>
        <PwaInstallModal />
      </React.Suspense>
    </>
  );
};

export default AuthenticatedShell;
