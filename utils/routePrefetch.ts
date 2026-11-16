// Route chunk prefetcher so navigating across primary screens works even if connectivity drops later

const prefetchedPaths = new Set<string>();

const ROUTE_PREFETCHERS: Record<string, () => Promise<unknown>> = {
  '/': () => import('../components/Dashboard'),
  '/dashboard': () => import('../components/Dashboard'),
  '/offline': () => import('../components/OfflineDashboard'),
  '/settings/ecole': () => import('../components/SettingsView'),
  '/settings/utilisateurs': () => import('../components/UserManagementView'),
  '/settings/audit': () => import('../components/AuditLogsView'),
  '/eleves': () => import('../components/StudentList'),
  '/eleves/detail': () => import('../components/StudentDetailView'),
  '/eleves/ajouter': () => import('../components/StudentForm'),
  '/eleves/reinscrire': () => import('../components/StudentForm'),
  '/eleves/validation': () => import('../components/ValidationList'),
  '/classes': () => import('../components/ClassManagement'),
  '/notes': () => import('../components/GradesView'),
  '/presences': () => import('../components/AttendanceView'),
  '/bulletins': () => import('../components/ReportCardsView'),
  '/horaire': () => import('../components/ScheduleView'),
  '/devoirs': () => import('../components/HomeworkManager'),
  '/discipline': () => import('../components/DisciplinaryView'),
  '/personnel': () => import('../components/StaffManagement'),
  '/economat': () => import('../components/FinanceHub'),
  '/economat/frais': () => import('../components/TuitionPaymentForm'),
  '/economat/paiement': () => import('../components/TuitionPaymentForm'),
  '/economat/factures': () => import('../components/ReceiptManagementView'),
  '/economat/releves': () => import('../components/AccountStatementView'),
  '/economat/liste': () => import('../components/PaymentHistoryList'),
  '/economat/depenses': () => import('../components/ExpensesView'),
  '/economat/paie': () => import('../components/PayrollManagementView'),
  '/economat/planification': () => import('../components/FeePlanningView'),
  '/rapports': () => import('../components/ReportsView'),
};

export const prefetchRouteChunk = (rawPath: string) => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  const cleanPath = (rawPath || '').split('?')[0];
  if (!cleanPath) return;

  const matchedKey = ROUTE_PREFETCHERS[cleanPath]
    ? cleanPath
    : Object.keys(ROUTE_PREFETCHERS).find((key) => key !== '/' && cleanPath.startsWith(`${key}/`));

  if (!matchedKey || prefetchedPaths.has(matchedKey)) return;
  const loader = ROUTE_PREFETCHERS[matchedKey];
  if (!loader) return;

  prefetchedPaths.add(matchedKey);
  void loader().catch(() => {
    prefetchedPaths.delete(matchedKey);
  });
};

export const scheduleIdleRoutePrefetch = () => {
  if (typeof window === 'undefined' || !navigator.onLine) return;
  const conn = (navigator as any).connection;
  if (conn?.saveData || conn?.effectiveType === 'slow-2g' || conn?.effectiveType === '2g') {
    // Still ensure the offline vault route is preloaded even on slow connections
    prefetchRouteChunk('/offline');
    return;
  }

  const priorityRoutes = [
    '/offline',
    '/eleves',
    '/eleves/detail',
    '/economat/frais',
    '/settings/ecole',
    '/notes',
    '/classes',
  ];

  const runPrefetch = () => {
    priorityRoutes.forEach((p, idx) => {
      setTimeout(() => {
        if (navigator.onLine) prefetchRouteChunk(p);
      }, idx * 450);
    });
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(runPrefetch, { timeout: 2500 });
  } else {
    setTimeout(runPrefetch, 1200);
  }
};
