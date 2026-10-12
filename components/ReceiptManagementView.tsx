import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../supabase';
import { useSchool } from '../contexts/SchoolContext';
import { 
  Search, 
  Printer, 
  FileText, 
  ChevronDown, 
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X, 
  History, 
  User, 
  Layers,
  CheckCircle2,
  Calendar,
  Eye,
  AlertCircle,
  RefreshCcw,
  ShieldCheck,
  Receipt,
  SearchCheck,
  Clock,
  Sparkles,
  Banknote,
  Smartphone,
  Landmark,
  Wallet,
  Copy,
  Check,
  Globe,
  Zap,
  QrCode,
  MoveHorizontal,
  Maximize2,
  Minimize2,
  SlidersHorizontal
} from 'lucide-react';
import { generateReceiptQRCode } from '../utils/receiptVerification';
import { toast } from 'sonner';
import { UserProfile } from '../types';
import { formatStudentName } from '../utils/formatters';
import { DailyCashClosureModal } from './DailyCashClosureModal';
import { ModernRegistrySkeleton, FluidLoadingState, SkeletonTable } from './SkeletonLoader';
import { PrintPreviewModal } from './PrintPreviewModal';
import { AcademicSessionPill } from './AcademicSessionPill';
import { ClassSelectorPill } from './ClassSelectorPill';
import { SelectPill, SelectOption } from './SelectPill';
import { DatePickerPill } from './DatePickerPill';

const ReceiptManagementView: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { school, terminology, currentCampusId, campuses } = useSchool();
  const effectiveSchoolId = user?.school_id || school?.id;
  const [schoolDetails, setSchoolDetails] = useState<any>(null);
  const [cashierName, setCashierName] = useState<string>('');

  const activeCampusName = useMemo(() => {
    if (!campuses || campuses.length === 0) return "Siège Principal";
    if (campuses.length === 1) return campuses[0].name;
    if (!currentCampusId || currentCampusId === 'GLOBAL') return "Tous les campus (Vue globale)";
    const found = campuses.find(c => c.id === currentCampusId);
    return found ? `Annexe : ${found.name}` : "Tous les campus (Vue globale)";
  }, [currentCampusId, campuses]);

  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [rcpAutoMode, setRcpAutoMode] = useState<boolean>(false);
  const [rcpSuffix, setRcpSuffix] = useState<string>('');
  const [deepSearch, setDeepSearch] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [dateFilter, setDateFilter] = useState("Toutes les dates");
  
  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const [customDate, setCustomDate] = useState<string>(todayStr);
  const [activeView, setActiveView] = useState<'journal' | 'generator'>('journal');
  const [isClosureModalOpen, setIsClosureModalOpen] = useState(false);

  // Pagination pour le tableau du Journal des Reçus
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(15);
  
  // Ascenseurs et navigation responsive (écrans 13"-15" pouces avec sidebar ouverte)
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false);
  const [canScrollRight, setCanScrollRight] = useState<boolean>(false);
  const [isScrollable, setIsScrollable] = useState<boolean>(false);
  const [isScrollHeightMode, setIsScrollHeightMode] = useState<boolean>(false);

  const checkScroll = () => {
    const el = tableContainerRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth + 5;
    setIsScrollable(hasOverflow);
    setCanScrollLeft(el.scrollLeft > 15);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 15);
  };

  const scrollTable = (direction: 'left' | 'right') => {
    const el = tableContainerRef.current;
    if (!el) return;
    const delta = direction === 'left' ? -350 : 350;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };
  
  // Options de filtrage de dates harmonisées (SelectPill)
  const dateFilterOptions: SelectOption[] = useMemo(() => [
    { value: "Aujourd'hui", label: "Aujourd'hui", description: "Transactions du jour" },
    { value: 'Cette semaine', label: 'Cette semaine', description: "Depuis début de semaine" },
    { value: 'Ce mois', label: 'Ce mois', description: "Mois civil en cours" },
    { value: 'Date précise', label: 'Date précise', description: "Sélectionner au calendrier" },
    { value: 'Toutes les dates', label: 'Toutes les dates', description: "Historique complet" },
  ], []);

  // States du Générateur
  const [genYear, setGenYear] = useState('');
  const [genClass, setGenClass] = useState('');
  const [selectedGenStudent, setSelectedGenStudent] = useState<any | null>(null);

  const [printPreview, setPrintPreview] = useState<any | null>(null);
  const [reprintQrDataUrl, setReprintQrDataUrl] = useState<string>('');
  const [reprintQrSignature, setReprintQrSignature] = useState<string>('');

  useEffect(() => {
    if (!printPreview) {
      setReprintQrDataUrl('');
      setReprintQrSignature('');
      return;
    }

    const appliedRate = printPreview.exchange_rate_applied || schoolDetails?.exchange_rate;
    const paidAmt = Number(printPreview.paid_amount ?? printPreview.amount ?? 0);
    const paidCurrency = printPreview.currency || 'HTG';

    generateReceiptQRCode({
      ref: printPreview.ref || printPreview.receipt_number || (printPreview.id ? `RCP-${printPreview.id.substring(0,8).toUpperCase()}` : `RCP-${Date.now()}`),
      studentName: printPreview.studentName || printPreview.student_name || 'Élève',
      studentClass: printPreview.classe || printPreview.class_name || '',
      amount: paidAmt,
      currency: paidCurrency,
      feeType: printPreview.nature || printPreview.fee_type || 'Frais Scolaires',
      date: (printPreview.date ? `${printPreview.date} ${printPreview.time || ''}` : new Date(printPreview.created_at || Date.now()).toLocaleDateString('fr-FR')).trim(),
      cashierName: cashierName || 'Comptabilité',
      schoolName: schoolDetails?.name || school?.name || 'Établissement Scolaire',
      exchangeRate: appliedRate,
      schoolId: effectiveSchoolId
    }).then(res => {
      setReprintQrDataUrl(res.dataUrl);
      setReprintQrSignature(res.signature);
    }).catch(err => {
      console.error('Erreur génération QR duplicata:', err);
    });
  }, [printPreview, cashierName, schoolDetails, school, effectiveSchoolId]);

  useEffect(() => {
    const fetchContext = async () => {
      if (!effectiveSchoolId) return;
      try {
        setLoading(true);
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
        if (profile) setCashierName(profile.full_name || '');

        const { data: schoolData } = await supabase.from('schools').select('name, address, phone, logo_url, exchange_rate').eq('id', effectiveSchoolId).maybeSingle();
        
        const cachedLogo = localStorage.getItem(`school_logo_${effectiveSchoolId}`);
        const cachedName = localStorage.getItem(`school_name_${effectiveSchoolId}`);

        if (schoolData) {
          setSchoolDetails({
            ...schoolData,
            logo_url: schoolData.logo_url || cachedLogo
          });
          // Sync cache
          if (schoolData.logo_url) localStorage.setItem(`school_logo_${effectiveSchoolId}`, schoolData.logo_url);
          if (schoolData.name) localStorage.setItem(`school_name_${effectiveSchoolId}`, schoolData.name);
        } else if (cachedLogo || cachedName) {
          setSchoolDetails({
            name: cachedName || 'Institution Scolaire',
            logo_url: cachedLogo,
            address: '',
            phone: ''
          });
        }

        const { data: yearsData } = await supabase.from('academic_years').select('*').eq('school_id', effectiveSchoolId).order('label', { ascending: false });
        if (yearsData) {
          setAcademicYears(yearsData);
          const active = yearsData.find(y => y.status === 'ACTIVE') || yearsData[0];
          if (active) {
            setSelectedYear(active.id);
            setGenYear(active.id);
          }
        }

        const { data: classesData } = await supabase.from('classes').select('*').eq('school_id', effectiveSchoolId).order('name');
        if (classesData) {
          setClasses(classesData);
          if (classesData.length > 0) setGenClass(classesData[0].id);
        }

        // Chargement fiable des élèves sans colonne inexistante 'code' (qui causait l'erreur 42703)
        const { data: studentsData, error: stErr } = await supabase
          .from('students')
          .select('id, first_name, last_name, class_id, reference_number, phone, parent_phone, campus_id')
          .eq('school_id', effectiveSchoolId);
        
        if (stErr) console.warn("Avertissement chargement élèves:", stErr);
        if (studentsData) setStudents(studentsData);

        // Paiements scellés avec jointure enrichie directe (student, class, campaign)
        const { data: paymentsData, error: payErr } = await supabase
          .from('payments')
          .select(`
            *,
            campaign:ad_hoc_campaigns(id, name, amount, currency),
            student:students(id, first_name, last_name, reference_number, class_id, campus_id, class:classes(id, name))
          `)
          .eq('school_id', effectiveSchoolId)
          .order('created_at', { ascending: false });
        
        if (payErr) console.warn("Avertissement chargement paiements:", payErr);

        // Récupération et harmonisation des reçus de fournitures scolaires avec jointure élève
        const { data: suppliesData, error: supErr } = await supabase
          .from('school_supplies')
          .select(`
            *,
            student:students(id, first_name, last_name, reference_number, class_id, campus_id, class:classes(id, name))
          `)
          .eq('school_id', effectiveSchoolId)
          .order('created_at', { ascending: false });

        if (supErr) console.warn("Avertissement chargement fournitures:", supErr);

        const groupedHistorySupplies = new Map<string, any>();
        (suppliesData || []).forEach((s: any) => {
          const txId = s.transaction_id || s.id;
          if (groupedHistorySupplies.has(txId)) {
            const existing = groupedHistorySupplies.get(txId);
            existing.total_amount = Number(existing.total_amount || 0) + Number(s.total_amount || 0);
            existing.amount_htg_equivalent = Number(existing.amount_htg_equivalent || 0) + Number(s.amount_htg_equivalent || s.total_amount || 0);
            if (!existing.student && s.student) existing.student = s.student;
            if (s.description) {
              existing.items_list = existing.items_list || [existing.description];
              existing.items_list.push(s.description);
            }
          } else {
            groupedHistorySupplies.set(txId, { 
              ...s,
              items_list: [s.description || 'Article de fourniture']
            });
          }
        });

        const suppliesPayments = Array.from(groupedHistorySupplies.values()).map((s: any) => {
          const isUSD = s.currency === 'USD';
          const totalAmt = Number(s.total_amount || 0);
          const equivHTG = Number(s.amount_htg_equivalent || (isUSD && s.exchange_rate_applied ? totalAmt * s.exchange_rate_applied : totalAmt));
          return {
            ...s,
            id: s.transaction_id || s.id,
            source: 'school_supplies',
            amount: isUSD ? totalAmt : equivHTG,
            paid_amount: isUSD ? totalAmt : equivHTG,
            original_amount: totalAmt,
            amount_htg_equivalent: equivHTG,
            currency: s.currency || 'HTG',
            is_foreign_currency: isUSD,
            exchange_rate_applied: s.exchange_rate_applied || 1,
            payment_method: s.payment_method?.replace(' (EN ATTENTE)', '')?.replace(' (REJETÉ)', '') || 'Cash',
            nature: 'Fournitures Scolaires',
            description: s.items_list ? s.items_list.join(', ') : (s.description || 'Fournitures Scolaires'),
            receipt_number: s.receipt_number || (s.transaction_id ? (s.transaction_id.startsWith('POS-') ? s.transaction_id : `FOU-${s.transaction_id.substring(0, 8).toUpperCase()}`) : `FOU-${s.id.substring(0, 8).toUpperCase()}`),
          };
        });

        const allPayments = [...(paymentsData || []), ...suppliesPayments];
        setPayments(allPayments);

      } catch (e) {
        console.error("Erreur chargement contexte", e);
      } finally {
        setLoading(false);
      }
    };
    fetchContext();
  }, [user, effectiveSchoolId]);

  const getMethodBadge = (method?: string) => {
    const m = (method || 'Cash').toUpperCase();
    if (m.includes('MONCASH')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
          <Smartphone size={10} />
          MonCash
        </span>
      );
    }
    if (m.includes('BANQUE') || m.includes('VIREMENT') || m.includes('TRANSFERT')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
          <Landmark size={10} />
          Virement
        </span>
      );
    }
    if (m.includes('CHÈQUE') || m.includes('CHEQUE')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap">
          <FileText size={10} />
          Chèque
        </span>
      );
    }
    if (m.includes('PORTEFEUILLE') || m.includes('WALLET')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
          <Wallet size={10} />
          Portefeuille
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
        <Banknote size={10} />
        Cash
      </span>
    );
  };

  const normalizeReceiptPayment = (p: any, studentObj?: any, studentClassName?: string) => {
    const isUSD = p.currency === 'USD';
    const rawAmount = Number(p.amount || 0);
    const rawOriginal = Number(p.original_amount || p.amount || 0);
    const rawEquivHTG = Number(p.amount_htg_equivalent || 0);
    const rawEquivUSD = Number(p.amount_usd_equivalent || 0);

    let appliedRate = p.exchange_rate_applied ? Number(p.exchange_rate_applied) : (schoolDetails?.exchange_rate ? Number(schoolDetails.exchange_rate) : 145);

    let paidAmount = rawAmount;
    let equivHTG = rawEquivHTG;
    let equivUSD = rawEquivUSD;

    if (isUSD) {
      paidAmount = rawOriginal > 0 && rawOriginal !== rawEquivHTG ? rawOriginal : rawAmount;
      if (equivHTG <= 0 && appliedRate > 0) {
        equivHTG = Math.round(paidAmount * appliedRate);
      } else if (equivHTG <= 0) {
        equivHTG = paidAmount;
      }
      equivUSD = paidAmount;
    } else {
      paidAmount = rawAmount > 0 ? rawAmount : rawOriginal;
      equivHTG = paidAmount;
      if (equivUSD <= 0 && appliedRate > 0) {
        equivUSD = Math.round((paidAmount / appliedRate) * 100) / 100;
      }
    }

    // Détection du barème fixé en USD (campagne USD, mention dans description, etc.)
    let plannedUSD = 0;
    if (p.campaign?.currency === 'USD') {
      plannedUSD = Number(p.campaign.amount || 0);
    } else if (p.description) {
      const match = p.description.match(/Barème:\s*\$?(\d+(?:\.\d+)?)\s*USD/i);
      if (match && match[1]) {
        plannedUSD = Number(match[1]);
      }
    }
    if (plannedUSD === 0 && !isUSD && p.amount_usd_equivalent > 0 && (p.fee_type === 'DIVERS' || p.ad_hoc_campaign_id || p.description?.includes('USD'))) {
      plannedUSD = Number(p.amount_usd_equivalent);
    }

    const effectiveStudent = studentObj || p.student || students.find((s: any) => s.id === (p.student_id || p.student?.id));
    const effectiveClass = studentClassName || effectiveStudent?.class?.name || (classes.find(c => c.id === effectiveStudent?.class_id)?.name) || (classes.find(c => c.id === p.class_id)?.name) || p.classe || p.className || 'N/A';
    const effectiveStudentName = effectiveStudent 
      ? formatStudentName(effectiveStudent.last_name, effectiveStudent.first_name).fullName 
      : (p.studentName || p.student_name || 'Élève Inconnu');

    const createdDate = p.created_at ? new Date(p.created_at) : new Date();

    const idPrefix = (p.id || '').substring(0, 8).toUpperCase();
    const formattedRef = p.receipt_number
      ? (p.receipt_number.toUpperCase().startsWith('RCP-') || p.receipt_number.toUpperCase().startsWith('FOU-') || p.receipt_number.toUpperCase().startsWith('POS-')
          ? p.receipt_number.toUpperCase() 
          : `RCP-${p.receipt_number.toUpperCase()}`)
      : (p.source === 'school_supplies' ? `FOU-${idPrefix}` : `RCP-${idPrefix}`);

    const studentCampus = campuses?.find((c: any) => c.id === (p.campus_id || effectiveStudent?.campus_id));

    return {
      ...p,
      ref: formattedRef,
      receipt_code: idPrefix,
      student: effectiveStudent,
      student_id: p.student_id || effectiveStudent?.id,
      studentName: effectiveStudentName,
      classe: effectiveClass,
      matricule: effectiveStudent?.reference_number || p.reference_number || p.student?.reference_number || null,
      campus_name: studentCampus?.name || null,
      date: createdDate.toLocaleDateString('fr-FR'),
      time: createdDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      nature: p.nature || (p.campaign?.name 
        ? `Campagne: ${p.campaign.name}` 
        : p.ad_hoc_campaign_id 
        ? 'Frais de Campagne' 
        : (p.fee_type === 'SCOLARITE' || (!p.fee_type && (!p.nature || p.nature === 'SCOLARITE' || p.nature === 'Scolarité'))) 
        ? 'Scolarité' 
        : ((p.fee_type === 'INSCRIPTION' || p.nature === 'INSCRIPTION' || p.nature === "Frais d'inscription") 
          ? 'Inscription' 
          : (p.source === 'school_supplies' ? 'Fournitures Scolaires' : (p.nature || p.type || p.fee_type || 'Frais Divers')))),
      paid_amount: paidAmount,
      amount: paidAmount,
      original_amount: isUSD ? paidAmount : (plannedUSD > 0 ? plannedUSD : paidAmount),
      equiv_amount_htg: equivHTG,
      equiv_amount_usd: equivUSD,
      currency: p.currency || 'HTG',
      is_foreign_currency: isUSD,
      exchange_rate_applied: appliedRate,
      planned_usd_bareme: plannedUSD,
      payment_method: p.payment_method || 'Cash'
    };
  };

  // Terme de recherche effectif (selon mode Auto-RCP ou texte libre)
  const activeSearchQuery = useMemo(() => {
    if (rcpAutoMode) {
      return rcpSuffix.trim() ? `RCP-${rcpSuffix.trim().toUpperCase()}` : '';
    }
    return searchTerm.trim();
  }, [rcpAutoMode, rcpSuffix, searchTerm]);

  // Détection si la requête cible spécifiquement un reçu ou si recherche approfondie
  const cleanSearchCode = useMemo(() => {
    return activeSearchQuery.replace(/^(rcp|rec|fou|pos)[\s-_]*/i, '').trim().toLowerCase();
  }, [activeSearchQuery]);

  const isReceiptLookup = useMemo(() => {
    if (!activeSearchQuery) return false;
    const lower = activeSearchQuery.toLowerCase();
    return rcpAutoMode || lower.startsWith('rcp') || lower.startsWith('fou') || lower.startsWith('pos') || (cleanSearchCode.length >= 3 && /^[0-9a-fA-F\-]+$/.test(cleanSearchCode));
  }, [activeSearchQuery, rcpAutoMode, cleanSearchCode]);

  const isDeepSearchEffective = useMemo(() => {
    return deepSearch || (isReceiptLookup && cleanSearchCode.length >= 3);
  }, [deepSearch, isReceiptLookup, cleanSearchCode]);

  // Filtrage archives globales
  const filteredPayments = useMemo(() => {
    const rawQuery = activeSearchQuery;
    const cleanCode = cleanSearchCode;
    const fullTerm = rawQuery.toLowerCase();

    return payments.filter(p => {
      const student = p.student || students.find(s => s.id === p.student_id);
      const studentName = student ? formatStudentName(student.last_name, student.first_name).fullName : (p.studentName || 'Inconnu');
      const studentClass = student?.class?.name || (classes.find(c => c.id === student?.class_id)?.name) || (classes.find(c => c.id === p.class_id)?.name) || (p.classe || 'N/A');

      // Clés de correspondance pour reçus
      const idPrefix = (p.id || '').substring(0, 8).toLowerCase();
      const fullId = (p.id || '').toLowerCase();
      const studentId = (p.student_id || student?.id || '').toLowerCase();
      const pRef = (p.ref || `rcp-${idPrefix}`).toLowerCase();
      const pReceiptNum = (p.receipt_number || '').toLowerCase();
      const pReference = (p.reference_number || '').toLowerCase();
      const pTxId = (p.transaction_id || '').toLowerCase();
      const studentFullName = studentName.toLowerCase();

      const matchesSearch = !rawQuery ? true : (
        studentId.includes(fullTerm) ||
        studentId.includes(cleanCode) ||
        pRef.includes(fullTerm) ||
        pRef.includes(cleanCode) ||
        idPrefix.includes(cleanCode) ||
        fullId.includes(cleanCode) ||
        fullId.includes(fullTerm) ||
        pReceiptNum.includes(fullTerm) ||
        pReceiptNum.includes(cleanCode) ||
        pReference.includes(fullTerm) ||
        pReference.includes(cleanCode) ||
        pTxId.includes(cleanCode) ||
        studentFullName.includes(fullTerm) ||
        (student?.reference_number || '').toLowerCase().includes(fullTerm) ||
        (student?.phone || '').includes(rawQuery) ||
        (student?.parent_phone || '').includes(rawQuery) ||
        studentClass.toLowerCase().includes(fullTerm)
      );

      if (!matchesSearch) return false;

      // Si recherche approfondie active ou recherche ciblée (ID précis, ID élève, N° reçu), on ignore les restrictions de date et de session
      const isTargetedSearch = isDeepSearchEffective || (rawQuery.length >= 6 && (studentId.includes(fullTerm) || fullId.includes(fullTerm) || studentFullName.includes(fullTerm)));
      if (isTargetedSearch) return true;

      // Filtres standard
      const matchesYear = !selectedYear || selectedYear === 'all' || !p.academic_year_id || p.academic_year_id === selectedYear;
      const matchesClass = selectedClass === 'all' || student?.class_id === selectedClass || p.class_id === selectedClass;

      let matchesDate = true;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const paymentDateMidnight = new Date(p.created_at);
      paymentDateMidnight.setHours(0, 0, 0, 0);

      if (dateFilter === "Aujourd'hui") {
        matchesDate = paymentDateMidnight.getTime() === today.getTime();
      } else if (dateFilter === 'Cette semaine') {
        const firstDay = new Date(today);
        const dayOfWeek = today.getDay();
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        firstDay.setDate(diff);
        firstDay.setHours(0, 0, 0, 0);
        matchesDate = paymentDateMidnight >= firstDay && paymentDateMidnight <= new Date();
      } else if (dateFilter === 'Ce mois') {
        matchesDate = paymentDateMidnight.getMonth() === today.getMonth() && paymentDateMidnight.getFullYear() === today.getFullYear();
      } else if (dateFilter === 'Date précise') {
        if (customDate) {
          const [cYear, cMonth, cDay] = customDate.split('-').map(Number);
          const targetDate = new Date(cYear, cMonth - 1, cDay);
          targetDate.setHours(0, 0, 0, 0);
          matchesDate = paymentDateMidnight.getTime() === targetDate.getTime();
        }
      }

      return matchesYear && matchesClass && matchesDate;
    }).map(p => {
      const student = p.student || students.find(s => s.id === p.student_id);
      const studentClass = student?.class?.name || (classes.find(c => c.id === student?.class_id)?.name) || (classes.find(c => c.id === p.class_id)?.name) || (p.classe || 'N/A');
      return normalizeReceiptPayment(p, student, studentClass);
    });
  }, [payments, selectedYear, selectedClass, activeSearchQuery, cleanSearchCode, isDeepSearchEffective, dateFilter, customDate, students, classes]);

  // Totaux comptables rigoureux sur les paiements filtrés
  const receiptsFilteredTotals = useMemo(() => {
    let foreignUSD = 0;
    let localHTG = 0;
    let totalEquivHTG = 0;

    filteredPayments.forEach(p => {
      if (
        p.status === 'ANNULE' || 
        p.payment_method?.includes('EN ATTENTE') || 
        p.payment_method?.includes('REJETÉ') ||
        p.moncash_status === 'PENDING'
      ) return;

      totalEquivHTG += Number(p.equiv_amount_htg || p.amount || 0);
      if (p.currency === 'USD' || p.is_foreign_currency) {
        foreignUSD += Number(p.paid_amount || p.amount || 0);
      } else {
        localHTG += Number(p.paid_amount || p.amount || 0);
      }
    });

    return { foreignUSD, localHTG, totalEquivHTG };
  }, [filteredPayments]);

  // Réinitialiser la page courante à 1 dès qu'un critère de filtre ou recherche change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedYear, selectedClass, dateFilter, customDate]);

  // Nombre total de pages pour la pagination du journal
  const totalPages = useMemo(() => {
    if (itemsPerPage >= 9999) return 1;
    return Math.max(1, Math.ceil(filteredPayments.length / itemsPerPage));
  }, [filteredPayments.length, itemsPerPage]);

  // Ajustement si la page courante dépasse le nombre total de pages
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Découpage des paiements pour la page courante
  const paginatedPayments = useMemo(() => {
    if (itemsPerPage >= 9999) return filteredPayments;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPayments.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPayments, currentPage, itemsPerPage]);

  // Actualisation dynamique de l'état de l'ascenseur responsive (ResizeObserver + window resize)
  useEffect(() => {
    checkScroll();
    const el = tableContainerRef.current;
    let observer: ResizeObserver | null = null;
    if (el && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        checkScroll();
      });
      observer.observe(el);
    }
    const handleResize = () => checkScroll();
    window.addEventListener('resize', handleResize);
    const timeout = setTimeout(checkScroll, 100);
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeout);
    };
  }, [itemsPerPage, currentPage, isScrollHeightMode, filteredPayments.length]);

  // Sous-total de la page affichée
  const receiptsPageSubtotals = useMemo(() => {
    let foreignUSD = 0;
    let localHTG = 0;
    let totalEquivHTG = 0;

    paginatedPayments.forEach(p => {
      if (
        p.status === 'ANNULE' || 
        p.payment_method?.includes('EN ATTENTE') || 
        p.payment_method?.includes('REJETÉ') ||
        p.moncash_status === 'PENDING'
      ) return;

      totalEquivHTG += Number(p.equiv_amount_htg || p.amount || 0);
      if (p.currency === 'USD' || p.is_foreign_currency) {
        foreignUSD += Number(p.paid_amount || p.amount || 0);
      } else {
        localHTG += Number(p.paid_amount || p.amount || 0);
      }
    });

    return { foreignUSD, localHTG, totalEquivHTG };
  }, [paginatedPayments]);

  // Étudiants disponibles pour la classe sélectionnée dans le générateur
  const availableStudentsForGen = useMemo(() => {
    return students.filter(s => s.class_id === genClass).map(s => {
      const formatted = formatStudentName(s.last_name, s.first_name);
      return {
        ...s,
        name: formatted.fullName
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [students, genClass]);

  // Options pour le SelectPill de sélection d'élève
  const studentGenOptions: SelectOption[] = useMemo(() => {
    return availableStudentsForGen.map(s => ({
      value: s.id,
      label: s.name,
      badge: `ID: ${s.id.substring(0, 8)}`,
      description: classes.find(c => c.id === s.class_id)?.name || undefined
    }));
  }, [availableStudentsForGen, classes]);

  // Historique des paiements de l'élève sélectionné dans le générateur
  const studentPaymentsHistory = useMemo(() => {
    if (!selectedGenStudent) return [];
    return payments
      .filter(p => p.student_id === selectedGenStudent.id && (!genYear || genYear === 'all' || !p.academic_year_id || p.academic_year_id === genYear))
      .map(p => {
        const studentClass = classes.find(c => c.id === selectedGenStudent.class_id)?.name || selectedGenStudent.class?.name || 'N/A';
        return normalizeReceiptPayment(p, selectedGenStudent, studentClass);
      });
  }, [payments, selectedGenStudent, genYear, classes]);

  // Totaux des versements de l'élève sélectionné
  const studentHistoryTotals = useMemo(() => {
    let foreignUSD = 0;
    let localHTG = 0;
    let totalEquivHTG = 0;

    studentPaymentsHistory.forEach(p => {
      if (p.status === 'ANNULE' || p.payment_method?.includes('EN ATTENTE')) return;
      totalEquivHTG += Number(p.equiv_amount_htg || p.amount || 0);
      if (p.currency === 'USD' || p.is_foreign_currency) {
        foreignUSD += Number(p.paid_amount || p.amount || 0);
      } else {
        localHTG += Number(p.paid_amount || p.amount || 0);
      }
    });

    return { foreignUSD, localHTG, totalEquivHTG };
  }, [studentPaymentsHistory]);

  const handleOpenPreview = (payment: any) => {
    setPrintPreview(payment);
  };

  const executePrint = () => {
    window.print();
  };

  return (
    <>
      <div className={`w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-none mx-auto space-y-6 animate-in fade-in duration-500 pb-20 ${printPreview ? 'print:hidden' : 'print:p-0'}`}>
        
        {/* NAVIGATION HAUTE */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden bg-white p-5 sm:p-6 rounded-2xl shadow-xs border border-slate-200/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-[10px] uppercase tracking-widest">
            <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            <span>Économat • Facturation</span>
            <span className="text-slate-300">•</span>
            <span className="bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-100 font-extrabold flex items-center gap-1">
              {activeCampusName}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Gestion des Reçus</h2>
          <p className="text-slate-500 font-medium text-xs">Archives, traçabilité et émissions certifiées des paiements.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-1.5 bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/50 w-full lg:w-auto">
          <button 
            onClick={() => setActiveView('journal')}
            className={`flex-1 lg:flex-none px-4 sm:px-6 py-2 rounded-lg text-xs font-bold tracking-tight transition-all flex items-center justify-center gap-2 cursor-pointer ${activeView === 'journal' ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}
          >
            <History size={15} />
            Registre Global
          </button>
          <button 
            onClick={() => { setActiveView('generator'); setSelectedGenStudent(null); }}
            className={`flex-1 lg:flex-none px-4 sm:px-6 py-2 rounded-lg text-xs font-bold tracking-tight transition-all flex items-center justify-center gap-2 cursor-pointer ${activeView === 'generator' ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}
          >
            <Printer size={15} />
            Émettre Reçu
          </button>
          <button 
            onClick={() => setIsClosureModalOpen(true)}
            className="flex-1 lg:flex-none px-3.5 sm:px-5 py-2 rounded-lg text-xs font-bold tracking-tight transition-all flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white shadow-xs active:scale-98 border border-slate-700 cursor-pointer"
          >
            <ShieldCheck size={15} className="text-emerald-400" />
            Clôture de Caisse
          </button>
        </div>
      </div>

      {activeView === 'journal' ? (
        <>
          {/* FILTRES ARCHIVES GLOBALES */}
          <div className="bg-white p-3.5 sm:p-5 rounded-2xl shadow-2xs border border-slate-200/80 print:hidden relative z-20 overflow-visible">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-end">
              {/* 1. Session */}
              <div className="space-y-1.5 min-w-0">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider ml-1 flex items-center gap-1.5 whitespace-nowrap">
                  <Calendar size={13} className="text-indigo-600 shrink-0" />
                  <span>Session {terminology.academicYear.includes('Académique') ? 'Académique' : 'Scolaire'}</span>
                </label>
                <AcademicSessionPill
                  academicYears={academicYears}
                  selectedYearId={selectedYear}
                  onSelectYear={(yearId) => setSelectedYear(yearId)}
                  variant="field"
                  size="sm"
                  colorScheme="indigo"
                  portal={true}
                  className="w-full"
                />
              </div>

              {/* 2. Filtre Classe / Option */}
              <div className="space-y-1.5 min-w-0">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider ml-1 flex items-center gap-1.5 whitespace-nowrap">
                  <Layers size={13} className="text-indigo-600 shrink-0" />
                  <span>Filtre {terminology.option}</span>
                </label>
                <ClassSelectorPill
                  classes={classes}
                  selectedClassId={selectedClass}
                  onSelectClass={(classId) => setSelectedClass(classId)}
                  allowAll={true}
                  allLabel={`Toutes les ${terminology.classes.toLowerCase()}`}
                  variant="field"
                  size="sm"
                  colorScheme="indigo"
                  portal={true}
                  className="w-full"
                  title={`Filtrer par ${terminology.class.toLowerCase()}`}
                />
              </div>

              {/* 3. Période & DateTime (Harmonisé DatePickerPill / SelectPill) */}
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider ml-1 flex items-center gap-1.5 whitespace-nowrap">
                    <Clock size={13} className="text-indigo-600 shrink-0" />
                    <span>Période d'Émission</span>
                  </label>
                  {dateFilter === 'Date précise' && customDate !== todayStr && (
                    <button
                      type="button"
                      onClick={() => setCustomDate(todayStr)}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer shrink-0"
                    >
                      Aujourd'hui
                    </button>
                  )}
                </div>
                {dateFilter === 'Date précise' ? (
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 min-w-0">
                      <DatePickerPill
                        selectedDate={customDate}
                        onSelectDate={(newDate) => setCustomDate(newDate)}
                        variant="field"
                        size="sm"
                        colorScheme="indigo"
                        showShortcuts={false}
                        showQuickArrows={true}
                        showTodayBadge={true}
                        className="w-full"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setDateFilter("Aujourd'hui")}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer"
                      title="Revenir aux filtres rapides"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <SelectPill
                    options={dateFilterOptions}
                    value={dateFilter}
                    onChange={(val) => setDateFilter(val)}
                    variant="field"
                    size="sm"
                    colorScheme="indigo"
                    icon={Calendar}
                    className="w-full"
                  />
                )}
              </div>

              {/* 4. Recherche Rapide avec Mode Auto RCP- & Recherche Approfondie */}
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider ml-1 flex items-center gap-1.5 whitespace-nowrap">
                    <Search size={13} className="text-indigo-600 shrink-0" />
                    <span>Recherche Rapide</span>
                  </label>
                  <div className="flex items-center gap-1">
                    {/* Bascule Mode Auto-RCP */}
                    <button
                      type="button"
                      onClick={() => {
                        const next = !rcpAutoMode;
                        setRcpAutoMode(next);
                        if (next) {
                          const clean = searchTerm.replace(/^(rcp|rec|fou)[\s-_]*/i, '').replace(/[^a-zA-Z0-9]/g, '').trim().toUpperCase();
                          setRcpSuffix(clean);
                        } else {
                          if (rcpSuffix) setSearchTerm(rcpSuffix);
                        }
                      }}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-tight flex items-center gap-1 transition-all cursor-pointer border ${
                        rcpAutoMode 
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs' 
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200/80 hover:bg-indigo-100'
                      }`}
                      title="Saisie assistée automatique avec préfixe RCP-"
                    >
                      <Receipt size={10} />
                      <span>{rcpAutoMode ? 'Mode Auto RCP- ✓' : 'Auto RCP-'}</span>
                    </button>

                    {/* Bascule Recherche Approfondie */}
                    <button
                      type="button"
                      onClick={() => setDeepSearch(!deepSearch)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-tight flex items-center gap-1 transition-all cursor-pointer border ${
                        deepSearch 
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs' 
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/70'
                      }`}
                      title="Recherche sur tout le système (ignore les filtres de date et session)"
                    >
                      <Globe size={10} />
                      <span>Approfondie</span>
                    </button>
                  </div>
                </div>

                {rcpAutoMode ? (
                  <div className="relative flex items-center">
                    <div className="absolute left-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-indigo-600 text-white font-mono font-black text-xs px-2.5 py-1 rounded-lg shadow-2xs select-none">
                      <Receipt size={12} />
                      <span>RCP-</span>
                    </div>
                    <input 
                      type="text" 
                      placeholder="EC1F67F2..."
                      className="w-full pl-22 pr-8 py-2 bg-indigo-50/40 border-2 border-indigo-500 rounded-xl text-xs font-mono font-black text-slate-900 placeholder-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all min-h-[38px] tracking-wider uppercase"
                      value={rcpSuffix}
                      autoFocus
                      onChange={(e) => {
                        const raw = e.target.value;
                        const cleaned = raw.replace(/^(rcp|rec|fou)[\s-_]*/i, '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 12);
                        setRcpSuffix(cleaned);
                      }}
                    />
                    {rcpSuffix && (
                      <button
                        type="button"
                        onClick={() => setRcpSuffix('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md hover:bg-slate-200/50 cursor-pointer"
                        title="Effacer"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
                    <input 
                      type="text" 
                      placeholder={`${terminology.student}, classe ou N° Reçu (ex: RCP-EC1F67F2)...`}
                      className="w-full pl-10 pr-20 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all min-h-[38px]"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {searchTerm ? (
                        <button
                          type="button"
                          onClick={() => setSearchTerm('')}
                          className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200/50 cursor-pointer"
                        >
                          <X size={13} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRcpAutoMode(true)}
                          className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-mono font-bold text-[10px] rounded border border-indigo-200 transition-colors cursor-pointer"
                          title="Basculer vers la saisie automatique avec préfixe RCP-"
                        >
                          + RCP-
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* BANNIÈRE CONTEXTUELLE DE RECHERCHE APPROFONDIE */}
            {isDeepSearchEffective && (
              <div className="mt-3.5 px-4 py-2.5 bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50 border border-indigo-200/80 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-indigo-950 animate-in fade-in shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="p-1.5 rounded-lg bg-indigo-600 text-white shrink-0 shadow-2xs">
                    <Globe size={13} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-black text-xs text-indigo-900 leading-tight">
                      Recherche Approfondie Active {isReceiptLookup ? `• N° Reçu ciblé : ${activeSearchQuery}` : '• Système Global'}
                    </p>
                    <p className="text-[10.5px] text-indigo-700 font-medium truncate">
                      Recherche étendue sur l'historique complet (toutes les dates et sessions déverrouillées).
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <span className="font-mono font-black text-xs px-2.5 py-0.5 bg-white text-indigo-800 rounded-lg border border-indigo-200 shadow-2xs">
                    {filteredPayments.length} reçu{filteredPayments.length > 1 ? 's' : ''} trouvé{filteredPayments.length > 1 ? 's' : ''}
                  </span>
                  {deepSearch && (
                    <button
                      type="button"
                      onClick={() => setDeepSearch(false)}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                    >
                      Désactiver
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* TABLEAU REGISTRE GLOBAL */}
          <div className="bg-white rounded-2xl sm:rounded-[2rem] shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="px-5 sm:px-6 lg:px-8 py-4 sm:py-5 bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2.5 sm:p-3 bg-white/10 rounded-xl border border-white/10 shrink-0">
                  <History size={20} className="text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold tracking-tight">Registre Historique</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{filteredPayments.length} transactions enregistrées</p>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:gap-4 print:hidden w-full md:w-auto justify-between md:justify-end">
                <div className="bg-white/5 px-4 sm:px-5 py-2 rounded-xl border border-white/10 text-right">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Collecte Totale</p>
                  <div className="font-mono text-right">
                    {receiptsFilteredTotals.foreignUSD > 0 && receiptsFilteredTotals.localHTG === 0 ? (
                      <>
                        <p className="text-base sm:text-xl font-black text-teal-300 whitespace-nowrap leading-tight">
                          {receiptsFilteredTotals.foreignUSD.toLocaleString('fr-FR')} <span className="text-xs font-bold">USD</span>
                        </p>
                        <p className="text-[10px] text-emerald-300 font-extrabold whitespace-nowrap mt-0.5">
                          Total Équivalent : {receiptsFilteredTotals.totalEquivHTG.toLocaleString('fr-FR')} HTG
                        </p>
                      </>
                    ) : receiptsFilteredTotals.foreignUSD > 0 ? (
                      <>
                        <p className="text-base sm:text-xl font-black text-emerald-300 whitespace-nowrap leading-tight">
                          {receiptsFilteredTotals.totalEquivHTG.toLocaleString('fr-FR')} <span className="text-xs font-bold">HTG (Eq)</span>
                        </p>
                        <p className="text-[10px] text-teal-200 font-bold whitespace-nowrap mt-0.5">
                          Dont : {receiptsFilteredTotals.localHTG.toLocaleString('fr-FR')} HTG + {receiptsFilteredTotals.foreignUSD.toLocaleString('fr-FR')} USD
                        </p>
                      </>
                    ) : (
                      <p className="text-base sm:text-xl font-black text-emerald-400 whitespace-nowrap leading-tight">
                        {receiptsFilteredTotals.localHTG.toLocaleString('fr-FR')} <span className="text-xs font-bold">HTG</span>
                      </p>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs tracking-tight transition-all shadow-lg shadow-indigo-500/20 active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  <Printer size={15} />
                  <span>Imprimer</span>
                </button>
              </div>
            </div>
            {/* BARRE D'ASCENSEUR & NAVIGATION ERGONOMIQUE (ADAPTATIVE SELON LA TAILLE D'ÉCRAN : MOBILE, TABLETTE, LAPTOP, GRAND ÉCRAN) */}
            <div className="px-3 sm:px-6 py-2 sm:py-2.5 bg-slate-800 text-slate-300 border-b border-slate-700/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 text-xs print:hidden">
              <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
                {isScrollable ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-300 font-bold text-[10.5px] sm:text-[11px] border border-indigo-500/30 whitespace-nowrap animate-in fade-in duration-200">
                      <MoveHorizontal size={13} className="text-indigo-400 shrink-0" />
                      <span>Ascenseur horizontal actif ↔</span>
                    </span>
                    <span className="text-slate-400 text-[10.5px] sm:text-[11px] sm:hidden">
                      (Glissez pour naviguer)
                    </span>
                    <span className="text-slate-400 text-[11px] hidden lg:inline">
                      (Colonnes étendues : défilez avec l'ascenseur ou les flèches sans devoir réduire la barre latérale)
                    </span>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-300 font-bold text-[10.5px] sm:text-[11px] border border-emerald-500/25 whitespace-nowrap animate-in fade-in duration-200">
                      <Check size={13} className="text-emerald-400 shrink-0" />
                      <span>Vue intégrale (Grand écran)</span>
                    </span>
                    <span className="text-slate-400 text-[10.5px] sm:text-[11px] hidden sm:inline">
                      (Toutes les colonnes sont directement visibles sans défilement horizontal)
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2">
                {/* Bascule mode hauteur déroulante avec ascenseur vertical */}
                <button
                  type="button"
                  onClick={() => setIsScrollHeightMode(!isScrollHeightMode)}
                  className={`inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg font-bold text-[10.5px] sm:text-[11px] transition-all cursor-pointer border flex-1 sm:flex-none whitespace-nowrap ${
                    isScrollHeightMode || itemsPerPage >= 9999
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                      : 'bg-white/10 hover:bg-white/20 text-slate-200 border-white/10'
                  }`}
                  title={isScrollHeightMode ? "Revenir à la hauteur normale par page" : "Activer la vue déroulante avec ascenseur vertical et en-tête figé"}
                >
                  {isScrollHeightMode || itemsPerPage >= 9999 ? <Minimize2 size={12} className="shrink-0" /> : <Maximize2 size={12} className="shrink-0" />}
                  <span>{isScrollHeightMode || itemsPerPage >= 9999 ? 'Ascenseur vertical actif' : 'Mode Déroulant'}</span>
                </button>

                {/* Boutons de défilement horizontal rapide ◄ ► (affichés UNIQUEMENT si l'écran a besoin de défiler) */}
                {isScrollable && (
                  <div className="flex items-center gap-0.5 sm:gap-1 bg-white/10 p-0.5 rounded-lg border border-white/10 shrink-0 animate-in fade-in duration-200">
                    <button
                      type="button"
                      onClick={() => scrollTable('left')}
                      disabled={!canScrollLeft}
                      className="p-1 rounded text-slate-300 hover:text-white hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      title="Défiler le tableau vers la gauche"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-[10px] font-mono px-0.5 sm:px-1 text-slate-400 font-bold select-none">◄ ►</span>
                    <button
                      type="button"
                      onClick={() => scrollTable('right')}
                      disabled={!canScrollRight}
                      className="p-1 rounded text-slate-300 hover:text-white hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      title="Défiler le tableau vers la droite"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div 
              ref={tableContainerRef}
              onScroll={checkScroll}
              className={`w-full overflow-x-auto ${isScrollable ? 'table-scrollbar' : 'custom-scrollbar'} print:overflow-visible transition-all overscroll-x-contain touch-pan-x ${
                isScrollHeightMode || itemsPerPage >= 9999 
                  ? 'max-h-[58vh] sm:max-h-[68vh] lg:max-h-[70vh] 2xl:max-h-[750px] overflow-y-auto relative overscroll-contain' 
                  : ''
              }`}
            >
              <table className="w-full text-left border-collapse min-w-[980px] xl:min-w-[1040px] 2xl:min-w-0">
                <thead className={isScrollHeightMode || itemsPerPage >= 9999 ? 'sticky top-0 z-20 shadow-2xs' : ''}>
                  <tr className="bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-widest border-b border-slate-200">
                    <th className="bg-slate-100 px-3.5 sm:px-4 py-3.5 whitespace-nowrap w-[130px]">Date & Heure</th>
                    <th className="bg-slate-100 px-3.5 sm:px-4 py-3.5 min-w-[200px]">{terminology.student} & {terminology.class}</th>
                    <th className="bg-slate-100 px-3.5 sm:px-4 py-3.5 whitespace-nowrap w-[140px]">Référence</th>
                    <th className="bg-slate-100 px-3.5 sm:px-4 py-3.5 whitespace-nowrap w-[125px]">Nature</th>
                    <th className="bg-slate-100 px-3.5 sm:px-4 py-3.5 whitespace-nowrap w-[115px]">Mode</th>
                    <th className="bg-slate-100 px-3.5 sm:px-4 py-3.5 text-right whitespace-nowrap w-[160px]">Montant</th>
                    <th className="bg-slate-100 px-3.5 sm:px-4 py-3.5 text-center whitespace-nowrap w-[95px]">Statut</th>
                    <th className="bg-slate-100 px-3.5 sm:px-4 py-3.5 text-right whitespace-nowrap w-[115px] print:hidden">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-8">
                        <FluidLoadingState message="Chargement des reçus..." subtext="Synchronisation en cours" />
                        <SkeletonTable rows={5} />
                      </td>
                    </tr>
                  ) : paginatedPayments.map((p) => (
                    <tr key={p.id} className="group hover:bg-slate-50/80 transition-colors">
                      <td className="px-3.5 sm:px-4 py-3 sm:py-3.5 whitespace-nowrap align-middle">
                        <div className="flex items-center gap-2">
                          <Calendar size={13} className="text-blue-600 shrink-0 hidden sm:block" />
                          <div>
                            <span className="font-bold text-slate-900 text-xs block whitespace-nowrap">{p.date}</span>
                            <span className="text-[10px] text-slate-400 font-mono font-bold block whitespace-nowrap">{p.time}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3.5 sm:px-4 py-3 sm:py-3.5 align-middle">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            {p.studentName ? p.studentName.charAt(0).toUpperCase() : '?'}
                          </div>
                          <div className="min-w-0 truncate">
                            <p className="font-bold text-slate-900 text-xs truncate" title={p.studentName}>{p.studentName}</p>
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight truncate" title={p.classe}>{p.classe}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3.5 sm:px-4 py-3 sm:py-3.5 whitespace-nowrap align-middle">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md font-mono text-[11px] font-black border border-slate-200/80 shadow-2xs whitespace-nowrap">
                            {p.ref || `RCP-${p.id?.substring(0, 8).toUpperCase()}`}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const textToCopy = p.ref || `RCP-${p.id?.substring(0, 8).toUpperCase()}`;
                              navigator.clipboard?.writeText(textToCopy);
                              setCopiedId(p.id);
                              toast.success(`N° Reçu ${textToCopy} copié !`);
                              setTimeout(() => setCopiedId(null), 2000);
                            }}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                            title="Copier le N° de reçu"
                          >
                            {copiedId === p.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          </button>
                        </div>
                      </td>
                      <td className="px-3.5 sm:px-4 py-3 sm:py-3.5 whitespace-nowrap align-middle">
                        <span className="inline-block text-[10px] font-bold text-slate-700 uppercase tracking-tight bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/70 whitespace-nowrap">
                          {p.nature}
                        </span>
                      </td>
                      <td className="px-3.5 sm:px-4 py-3 sm:py-3.5 whitespace-nowrap align-middle">
                        {getMethodBadge(p.payment_method)}
                      </td>
                      <td className="px-3.5 sm:px-4 py-3 sm:py-3.5 text-right whitespace-nowrap align-middle">
                        {p.currency === 'USD' || p.is_foreign_currency ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-teal-100/80 text-teal-900 text-[10px] font-black border border-teal-300/70">
                                USD
                              </span>
                              <span className="text-xs font-black text-teal-900 font-mono">
                                {(p.paid_amount ?? p.amount)?.toLocaleString('fr-FR')} USD
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-bold block font-mono">
                              Eq: {p.equiv_amount_htg?.toLocaleString('fr-FR')} HTG {p.exchange_rate_applied ? `(@${p.exchange_rate_applied})` : ''}
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100/80 text-emerald-900 text-[10px] font-black border border-emerald-300/70">
                                HTG
                              </span>
                              <span className="text-xs font-black text-emerald-900 font-mono">
                                {(p.paid_amount ?? p.amount)?.toLocaleString('fr-FR')} HTG
                              </span>
                            </div>
                            {p.planned_usd_bareme > 0 && (
                              <span className="text-[10px] text-amber-700 font-bold block font-mono">
                                Barème: ${p.planned_usd_bareme} USD {p.exchange_rate_applied ? `(@${p.exchange_rate_applied})` : ''}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 sm:px-4 py-3 sm:py-3.5 text-center whitespace-nowrap align-middle">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tight whitespace-nowrap border ${
                          p.payment_method?.includes('EN ATTENTE') 
                            ? 'bg-amber-50 text-amber-700 border-amber-200' 
                            : p.status === 'ANNULE' 
                              ? 'bg-rose-50 text-rose-700 border-rose-200' 
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {p.payment_method?.includes('EN ATTENTE') ? 'En attente' : p.status === 'ANNULE' ? 'Annulé' : 'Validé'}
                        </span>
                      </td>
                      <td className="px-3.5 sm:px-4 py-3 sm:py-3.5 text-right whitespace-nowrap align-middle print:hidden">
                        <button 
                          onClick={() => handleOpenPreview(p)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-lg text-[11px] uppercase tracking-tight shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                          title="Réimprimer ce reçu"
                        >
                          <Printer size={12} />
                          <span>Réimprimer</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  
                  {!loading && filteredPayments.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-14 text-center">
                        <div className="max-w-md mx-auto space-y-3 px-4">
                          <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                            <Receipt size={24} />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">Aucun reçu trouvé pour ces critères</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {activeSearchQuery 
                                ? `Aucune transaction ne correspond à "${activeSearchQuery}" dans les dates ou classes sélectionnées.` 
                                : 'Aucune transaction enregistrée pour les filtres actuels.'}
                            </p>
                          </div>
                          {!isDeepSearchEffective && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeepSearch(true);
                                setDateFilter('Toutes les dates');
                              }}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                            >
                              <Globe size={14} />
                              <span>Lancer la Recherche Approfondie (Toutes les dates & sessions)</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>

                {/* PIED DE TABLEAU COMPTABLE RIGOUREUX */}
                {!loading && filteredPayments.length > 0 && (
                  <tfoot className={isScrollHeightMode || itemsPerPage >= 9999 ? 'sticky bottom-0 z-20 shadow-md' : ''}>
                    {/* Ligne 1 : Sous-total de la page affichée */}
                    <tr className="bg-slate-100 border-t-2 border-slate-200 text-slate-700 font-extrabold text-xs">
                      <td colSpan={5} className="bg-slate-100 px-4 py-3 text-right">
                        <span className="text-[11px] uppercase tracking-wider text-slate-500 font-black">
                          {itemsPerPage >= 9999 
                            ? `Total Liste Complète (${paginatedPayments.length} reçu${paginatedPayments.length > 1 ? 's' : ''}) :`
                            : `Sous-total Page ${currentPage} (${paginatedPayments.length} reçu${paginatedPayments.length > 1 ? 's' : ''}) :`}
                        </span>
                      </td>
                      <td className="bg-slate-100 px-4 py-3 text-right whitespace-nowrap font-mono font-black text-xs">
                        {receiptsPageSubtotals.foreignUSD > 0 && receiptsPageSubtotals.localHTG === 0 ? (
                          <>
                            <span className="text-teal-800 text-xs font-black">{receiptsPageSubtotals.foreignUSD.toLocaleString('fr-FR')} USD</span>
                            <span className="block text-[10px] text-slate-500 font-bold">
                              Eq: {receiptsPageSubtotals.totalEquivHTG.toLocaleString('fr-FR')} HTG
                            </span>
                          </>
                        ) : receiptsPageSubtotals.foreignUSD > 0 ? (
                          <>
                            <span className="text-emerald-800 text-xs font-black">{receiptsPageSubtotals.totalEquivHTG.toLocaleString('fr-FR')} HTG (Eq)</span>
                            <span className="block text-[10px] text-teal-800 font-bold">
                              {receiptsPageSubtotals.localHTG.toLocaleString('fr-FR')} HTG + {receiptsPageSubtotals.foreignUSD.toLocaleString('fr-FR')} USD
                            </span>
                          </>
                        ) : (
                          <span className="text-emerald-800 text-xs font-black">{receiptsPageSubtotals.localHTG.toLocaleString('fr-FR')} HTG</span>
                        )}
                      </td>
                      <td colSpan={2} className="bg-slate-100 px-4 py-3"></td>
                    </tr>

                    {/* Ligne 2 : Total de la sélection / période filtrée */}
                    <tr className="bg-slate-950 text-white font-extrabold text-xs border-t border-indigo-900/60">
                      <td colSpan={5} className="bg-slate-950 px-4 py-3.5 text-right">
                        <span className="text-[11px] uppercase tracking-wider text-indigo-300 font-black">
                          Total Sélection ({filteredPayments.length} reçu{filteredPayments.length > 1 ? 's' : ''}) :
                        </span>
                      </td>
                      <td className="bg-slate-950 px-4 py-3.5 text-right whitespace-nowrap font-mono font-black text-xs text-white">
                        {receiptsFilteredTotals.foreignUSD > 0 && receiptsFilteredTotals.localHTG === 0 ? (
                          <>
                            <span className="text-teal-300 text-sm font-black">{receiptsFilteredTotals.foreignUSD.toLocaleString('fr-FR')} USD</span>
                            <span className="block text-[11px] text-emerald-300 font-extrabold">
                              Total Équivalent : {receiptsFilteredTotals.totalEquivHTG.toLocaleString('fr-FR')} HTG
                            </span>
                          </>
                        ) : receiptsFilteredTotals.foreignUSD > 0 ? (
                          <>
                            <span className="text-emerald-300 text-sm font-black">{receiptsFilteredTotals.totalEquivHTG.toLocaleString('fr-FR')} HTG</span>
                            <span className="block text-[11px] text-teal-200 font-bold">
                              Dont : {receiptsFilteredTotals.localHTG.toLocaleString('fr-FR')} HTG + {receiptsFilteredTotals.foreignUSD.toLocaleString('fr-FR')} USD
                            </span>
                          </>
                        ) : (
                          <span className="text-emerald-300 text-sm font-black">{receiptsFilteredTotals.localHTG.toLocaleString('fr-FR')} HTG</span>
                        )}
                      </td>
                      <td colSpan={2} className="bg-slate-950 px-4 py-3.5"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* BARRE DE PAGINATION MODERNE ET ERGONOMIQUE */}
            {!loading && filteredPayments.length > 0 && (
              <div className="px-4 sm:px-6 py-3 sm:py-3.5 bg-slate-50/80 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs print:hidden">
                <div className="flex flex-wrap items-center justify-between sm:justify-start gap-3 w-full sm:w-auto text-slate-600 font-medium">
                  <span>
                    {itemsPerPage >= 9999 ? (
                      <>
                        Affichage des <span className="font-bold text-slate-900">{filteredPayments.length}</span> reçu{filteredPayments.length > 1 ? 's' : ''}
                        <span className="ml-2 text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded text-[11px] border border-indigo-100">
                          (Liste complète défilable avec ascenseur)
                        </span>
                      </>
                    ) : (
                      <>
                        Affichage de <span className="font-bold text-slate-900">{filteredPayments.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</span> à <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, filteredPayments.length)}</span> sur <span className="font-bold text-slate-900">{filteredPayments.length}</span> reçu{filteredPayments.length > 1 ? 's' : ''}
                      </>
                    )}
                  </span>

                  {/* Sélecteur de pagination par page */}
                  <div className="flex items-center gap-1.5 pl-2 sm:border-l sm:border-slate-200">
                    <span className="text-slate-500 text-[11px]">Afficher :</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setItemsPerPage(val);
                        setCurrentPage(1);
                        if (val >= 9999) {
                          setIsScrollHeightMode(true);
                        }
                      }}
                      className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 cursor-pointer shadow-2xs transition-colors"
                    >
                      <option value={10}>10 / page</option>
                      <option value={15}>15 / page</option>
                      <option value={25}>25 / page</option>
                      <option value={50}>50 / page</option>
                      <option value={100}>100 / page</option>
                      <option value={200}>200 / page</option>
                      <option value={99999}>Tous (Liste complète avec ascenseur)</option>
                    </select>
                  </div>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    {/* Première page */}
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs"
                      title="Première page"
                    >
                      <ChevronsLeft size={15} />
                    </button>

                    {/* Page précédente */}
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs"
                      title="Page précédente"
                    >
                      <ChevronLeft size={15} />
                    </button>

                    {/* Numéros de page avec fenêtre dynamique */}
                    <div className="flex items-center gap-1 mx-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(page => {
                          if (totalPages <= 7) return true;
                          if (page === 1 || page === totalPages) return true;
                          return Math.abs(page - currentPage) <= 1;
                        })
                        .reduce<(number | string)[]>((acc, page, index, arr) => {
                          if (index > 0 && (page as number) - (arr[index - 1] as number) > 1) {
                            acc.push('...');
                          }
                          acc.push(page);
                          return acc;
                        }, [])
                        .map((item, idx) => {
                          if (typeof item === 'string') {
                            return (
                              <span key={`ellipsis-${idx}`} className="px-1 text-xs font-bold text-slate-400">
                                ...
                              </span>
                            );
                          }
                          return (
                            <button
                              key={item}
                              onClick={() => setCurrentPage(item as number)}
                              className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                currentPage === item
                                  ? 'bg-indigo-600 text-white shadow-2xs font-black'
                                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 shadow-2xs'
                              }`}
                            >
                              {item}
                            </button>
                          );
                        })}
                    </div>

                    {/* Page suivante */}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs"
                      title="Page suivante"
                    >
                      <ChevronRight size={15} />
                    </button>

                    {/* Dernière page */}
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs"
                      title="Dernière page"
                    >
                      <ChevronsRight size={15} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        /* ASSISTANT D'ÉMISSION ERGONOMIQUE */
        <div className="max-w-6xl mx-auto animate-in slide-in-from-bottom-8 duration-500 print:hidden space-y-8">
          
          {/* BARRE DE SÉLECTION */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-3.5 sm:p-5 flex flex-col md:flex-row items-end gap-3 sm:gap-4">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 w-full">
              {/* 1. Session */}
              <div className="space-y-1.5 min-w-0">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider ml-1 flex items-center gap-1.5 whitespace-nowrap">
                  <Calendar size={13} className="text-indigo-600 shrink-0" />
                  <span>1. Session {terminology.academicYear.includes('Académique') ? 'Académique' : 'Scolaire'}</span>
                </label>
                <AcademicSessionPill
                  academicYears={academicYears}
                  selectedYearId={genYear}
                  onSelectYear={(yearId) => setGenYear(yearId)}
                  variant="field"
                  size="sm"
                  colorScheme="indigo"
                  className="w-full"
                />
              </div>

              {/* 2. Classe / Option */}
              <div className="space-y-1.5 min-w-0">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider ml-1 flex items-center gap-1.5 whitespace-nowrap">
                  <Layers size={13} className="text-indigo-600 shrink-0" />
                  <span>2. {terminology.option}</span>
                </label>
                <ClassSelectorPill
                  classes={classes}
                  selectedClassId={genClass}
                  onSelectClass={(classId) => {
                    setGenClass(classId);
                    setSelectedGenStudent(null);
                  }}
                  allowAll={false}
                  emptyLabel={`Sélectionner une ${terminology.class.toLowerCase()}`}
                  variant="field"
                  size="sm"
                  colorScheme="indigo"
                  className="w-full"
                  title={`Sélectionner une ${terminology.class.toLowerCase()}`}
                />
              </div>

              {/* 3. Choisir Élève */}
              <div className="space-y-1.5 min-w-0">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider ml-1 flex items-center gap-1.5 whitespace-nowrap">
                  <User size={13} className="text-indigo-600 shrink-0" />
                  <span>3. Choisir {terminology.student.toLowerCase()}</span>
                </label>
                <SelectPill
                  options={studentGenOptions}
                  value={selectedGenStudent?.id || ''}
                  onChange={(val) => {
                    const student = availableStudentsForGen.find(s => s.id === val);
                    setSelectedGenStudent(student || null);
                  }}
                  placeholder={availableStudentsForGen.length === 0 ? "Aucun élève disponible" : `Choisir un(e) ${terminology.student.toLowerCase()}...`}
                  searchable={true}
                  variant="field"
                  size="sm"
                  colorScheme="indigo"
                  icon={User}
                  className="w-full"
                  disabled={availableStudentsForGen.length === 0}
                />
              </div>
            </div>
            {selectedGenStudent && (
              <button 
                onClick={() => setSelectedGenStudent(null)}
                className="p-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl transition-all active:scale-95 border border-rose-200/70 shrink-0 cursor-pointer"
                title="Effacer la sélection"
              >
                <RefreshCcw size={16} />
              </button>
            )}
          </div>

          {/* TABLEAU DES PAIEMENTS DE L'ÉLÈVE (ERGONOMIE MAXIMALE) */}
          {selectedGenStudent ? (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
              
              {/* Profil rapide de l'élève */}
              <div className="bg-slate-900 p-8 rounded-[2rem] text-white shadow-sm flex flex-col md:flex-row items-center justify-between gap-8 border-b-[6px] border-b-emerald-500">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center font-bold text-3xl border border-white/10 shadow-xl">
                    {selectedGenStudent.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold tracking-tight leading-none">{selectedGenStudent.name}</h3>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-white/5 px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1.5">
                        <ShieldCheck size={12} className="text-emerald-400" />
                        ID: {selectedGenStudent.id.substring(0,8)}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {classes.find(c => c.id === genClass)?.name}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="bg-white/5 px-6 sm:px-8 py-4 sm:py-5 rounded-2xl border border-white/10 text-center md:text-right font-mono">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Encaissé</p>
                  {studentHistoryTotals.foreignUSD > 0 && studentHistoryTotals.localHTG === 0 ? (
                    <>
                      <p className="text-2xl sm:text-3xl font-black text-teal-300 tracking-tight whitespace-nowrap">
                        {studentHistoryTotals.foreignUSD.toLocaleString('fr-FR')} <span className="text-sm font-bold">USD</span>
                      </p>
                      <p className="text-xs text-emerald-300 font-extrabold whitespace-nowrap mt-1">
                        Total Équivalent : {studentHistoryTotals.totalEquivHTG.toLocaleString('fr-FR')} HTG
                      </p>
                    </>
                  ) : studentHistoryTotals.foreignUSD > 0 ? (
                    <>
                      <p className="text-2xl sm:text-3xl font-black text-emerald-300 tracking-tight whitespace-nowrap">
                        {studentHistoryTotals.totalEquivHTG.toLocaleString('fr-FR')} <span className="text-sm font-bold">HTG (Eq)</span>
                      </p>
                      <p className="text-xs text-teal-200 font-bold whitespace-nowrap mt-1">
                        Dont : {studentHistoryTotals.localHTG.toLocaleString('fr-FR')} HTG + {studentHistoryTotals.foreignUSD.toLocaleString('fr-FR')} USD
                      </p>
                    </>
                  ) : (
                    <p className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight whitespace-nowrap">
                      {studentHistoryTotals.localHTG.toLocaleString('fr-FR')} <span className="text-sm font-bold">HTG</span>
                    </p>
                  )}
                </div>
              </div>

              {/* TABLEAU DE LISTE PAIEMENT */}
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center">
                       <Clock size={20} />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-900 tracking-tight">Historique des versements</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{studentPaymentsHistory.length} transaction(s) trouvée(s)</p>
                    </div>
                  </div>
                </div>

                {studentPaymentsHistory.length > 0 ? (
                  <div className="w-full overflow-x-auto table-scrollbar touch-pan-x overscroll-x-contain">
                    <table className="w-full text-left border-collapse min-w-[720px]">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100">
                          <th className="px-4 py-3.5 whitespace-nowrap w-[130px]">Date & Heure</th>
                          <th className="px-4 py-3.5 whitespace-nowrap w-[125px]">Référence</th>
                          <th className="px-4 py-3.5 whitespace-nowrap w-[130px]">Nature</th>
                          <th className="px-4 py-3.5 whitespace-nowrap w-[110px]">Mode</th>
                          <th className="px-4 py-3.5 text-right whitespace-nowrap w-[150px]">Montant</th>
                          <th className="px-4 py-3.5 text-right whitespace-nowrap w-[130px]">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {studentPaymentsHistory.map((p) => (
                          <tr key={p.id} className="group hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3.5 whitespace-nowrap align-middle">
                              <div className="flex items-center gap-2">
                                <Calendar size={13} className="text-blue-600 shrink-0 hidden sm:block" />
                                <div>
                                  <p className="font-bold text-slate-900 text-xs whitespace-nowrap">{p.date}</p>
                                  <p className="text-[10px] text-slate-400 font-mono font-bold whitespace-nowrap">{p.time}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap align-middle">
                              <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold border border-slate-200/70 whitespace-nowrap">
                                RCP-{p.id.substring(0, 8)}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap align-middle">
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                                <span className="inline-block text-[10px] font-bold text-slate-700 uppercase tracking-tight bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/70 whitespace-nowrap">
                                  {p.nature}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap align-middle">
                              {getMethodBadge(p.payment_method)}
                            </td>
                            <td className="px-4 py-3.5 text-right whitespace-nowrap align-middle">
                              {p.currency === 'USD' || p.is_foreign_currency ? (
                                <div className="space-y-0.5">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <span className="px-1.5 py-0.5 rounded bg-teal-100/80 text-teal-900 text-[10px] font-black border border-teal-300/70">
                                      USD
                                    </span>
                                    <span className="text-xs font-black text-teal-900 font-mono">
                                      {p.original_amount?.toLocaleString('fr-FR')} USD
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-500 font-bold block font-mono">
                                    Eq: {p.amount?.toLocaleString('fr-FR')} HTG {p.exchange_rate_applied ? `(@${p.exchange_rate_applied})` : ''}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1.5">
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-100/80 text-emerald-900 text-[10px] font-black border border-emerald-300/70">
                                    HTG
                                  </span>
                                  <span className="text-xs font-black text-emerald-900 font-mono">
                                    {p.amount?.toLocaleString('fr-FR')} HTG
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-right whitespace-nowrap align-middle">
                              <button 
                                onClick={() => handleOpenPreview(p)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-lg text-[11px] uppercase tracking-tight shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                              >
                                <Printer size={12} />
                                <span>Imprimer Reçu</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-900 text-white font-extrabold text-xs border-t-2 border-slate-800">
                          <td colSpan={4} className="px-4 py-3.5 text-right">
                            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-black">
                              Total Reçu pour {selectedGenStudent.name} :
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap font-mono font-black text-xs text-white">
                            {studentHistoryTotals.foreignUSD > 0 && studentHistoryTotals.localHTG === 0 ? (
                              <>
                                <span className="text-teal-300 text-xs font-black">{studentHistoryTotals.foreignUSD.toLocaleString('fr-FR')} USD</span>
                                <span className="block text-[10px] text-emerald-300 font-extrabold">
                                  Total Équivalent : {studentHistoryTotals.totalEquivHTG.toLocaleString('fr-FR')} HTG
                                </span>
                              </>
                            ) : studentHistoryTotals.foreignUSD > 0 ? (
                              <>
                                <span className="text-emerald-300 text-xs font-black">{studentHistoryTotals.totalEquivHTG.toLocaleString('fr-FR')} HTG</span>
                                <span className="block text-[10px] text-teal-200 font-bold">
                                  Dont : {studentHistoryTotals.localHTG.toLocaleString('fr-FR')} HTG + {studentHistoryTotals.foreignUSD.toLocaleString('fr-FR')} USD
                                </span>
                              </>
                            ) : (
                              <span className="text-emerald-300 text-xs font-black">{studentHistoryTotals.localHTG.toLocaleString('fr-FR')} HTG</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="p-20 text-center space-y-6">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                      <AlertCircle size={32} className="text-slate-300" />
                    </div>
                    <div>
                      <p className="text-slate-900 font-bold">Aucune transaction trouvée</p>
                      <p className="text-xs text-slate-500 font-medium mt-1">Vérifiez la session ou assurez-vous que le paiement a été validé.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50/50 p-20 rounded-[3rem] border-2 border-dashed border-slate-200 text-center space-y-6 max-w-4xl mx-auto">
              <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-slate-100">
                <SearchCheck size={40} className="text-indigo-400 animate-pulse" />
              </div>
              <div className="space-y-2">
                <p className="text-slate-900 font-bold text-xl tracking-tight">Prêt à l'émission</p>
                <p className="text-slate-500 font-medium text-sm max-w-md mx-auto leading-relaxed">
                  Veuillez sélectionner un(e) {terminology.student.toLowerCase()} dans la liste contextuelle de sa {terminology.class.toLowerCase()} pour visualiser et imprimer ses reçus officiels.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
      </div>

      {/* MODAL APERÇU (SLIM) */}
      <PrintPreviewModal
        isOpen={!!printPreview}
        onClose={() => setPrintPreview(null)}
        title="Réimpression de Reçu"
        subtitle="Transaction certifiée • EduNova Pro"
        onPrint={executePrint}
      >
        {printPreview && (
          <div id="thermal-reprint-receipt" className="bg-white p-4 sm:p-6 w-[80mm] max-w-[80mm] mx-auto shadow-2xl rounded-xl border border-gray-200 text-black font-sans leading-tight flex flex-col print:shadow-none print:border-none print:m-0 print:p-2 print:w-[80mm]">
            {/* LIGNE DE DÉCOUPE SUPÉRIEURE STYLISÉE */}
            <div className="w-full flex justify-between items-center opacity-30 text-[6px] tracking-[0.25em] mb-2 font-mono print:hidden select-none" aria-hidden="true">
              <span>• • • • • • • • • • • • • • • • • • • • • • • • • •</span>
            </div>

            {/* HEADER SCOLAIRE */}
            <div className="w-full text-center border-b-2 border-black pb-2 mb-3">
              {schoolDetails?.logo_url ? (
                <img src={schoolDetails.logo_url} alt="Logo" className="h-12 mx-auto mb-1 object-contain" referrerPolicy="no-referrer" />
              ) : (
                <img src="/logo.png" alt="Logo" className="h-12 mx-auto mb-1 object-contain grayscale" />
              )}
              <h1 className="text-[13px] font-black uppercase leading-tight">{schoolDetails?.name || 'INSTITUTION SCOLAIRE'}</h1>
              {(() => {
                const campusDisplay = printPreview.campus_name || (activeCampusName && activeCampusName !== 'Tous les campus (Vue globale)' ? activeCampusName : null);
                return campusDisplay ? (
                  <p className="text-[9.5px] font-black uppercase tracking-wider text-black mt-0.5">
                    Annexe / Campus : {campusDisplay}
                  </p>
                ) : null;
              })()}
              <div className="text-[9px] font-bold opacity-90 italic mt-0.5 space-y-0.5">
                {schoolDetails?.address && <p>{schoolDetails.address}</p>}
                {schoolDetails?.phone && <p>Téls: {schoolDetails.phone}</p>}
              </div>
            </div>

            {/* TITRE DU DOCUMENT */}
            <div className="w-full text-center mb-3 py-1.5 bg-gray-100 rounded border border-gray-200 print:bg-gray-100">
              <h2 className="text-[12px] font-black tracking-widest uppercase">REÇU OFFICIEL (DUPLICATA)</h2>
              <p className="text-[9px] font-black font-mono mt-0.5">#{printPreview.ref || `RCP-${printPreview.id?.substring(0,8).toUpperCase()}`}</p>
              {printPreview.payment_method?.includes('EN ATTENTE') && (
                <span className="inline-block mt-1 px-2 py-0.5 text-[7px] font-black bg-gray-100 text-black border border-black uppercase tracking-widest rounded">
                  Paiement En Attente
                </span>
              )}
              {/* Pattern simulation code-barres thermique propre */}
              <div className="w-32 mx-auto my-1 flex justify-center items-center gap-[1.5px] opacity-80 h-3 overflow-hidden select-none" aria-hidden="true">
                {[1, 2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 3, 2, 1, 2, 1, 3, 1, 2].map((w, idx) => (
                  <span
                    key={idx}
                    className="h-full bg-black block"
                    style={{ width: `${w}px` }}
                  />
                ))}
              </div>
            </div>

            {/* GRID DETAILS (2 COLONNES COMPACTES) */}
            <div className="w-full grid grid-cols-2 gap-2 text-[9px] mb-3 border-b border-black pb-2">
              <div className="space-y-1">
                <div>
                  <p className="text-[7px] uppercase font-black text-gray-500">Date & Heure</p>
                  <p className="font-bold leading-none">{printPreview.date} {printPreview.time ? `à ${printPreview.time}` : ''}</p>
                </div>
                <div>
                  <p className="text-[7px] uppercase font-black text-gray-500">Caissier</p>
                  <p className="font-bold leading-none">{cashierName || 'Comptabilité'}</p>
                </div>
              </div>
              <div className="space-y-1 text-right border-l border-gray-200 pl-2">
                <div>
                  <p className="text-[7px] uppercase font-black text-gray-500">Élève</p>
                  <p className="font-black text-[10px] leading-tight">{printPreview.studentName}</p>
                  <p className="text-[8px] font-bold text-gray-600 italic">{printPreview.classe || 'Non assignée'}</p>
                  {printPreview.matricule && (
                    <p className="text-[7px] font-mono text-gray-500">Mat: {printPreview.matricule}</p>
                  )}
                </div>
              </div>
            </div>

            {/* MOTIF & PAIEMENT */}
            <div className="w-full text-[9px] mb-3 space-y-1.5 border-b border-dashed border-gray-400 pb-2">
              <div className="flex justify-between items-start py-0.5">
                <span className="font-bold uppercase text-gray-600 shrink-0">Type de Frais Payé :</span>
                <div className="text-right pl-2">
                  <span className="font-black text-[10.5px] block text-black uppercase">{printPreview.nature}</span>
                  {printPreview.planned_usd_bareme > 0 && (
                    <span className="inline-block mt-0.5 text-[8px] font-black text-amber-900 bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded">
                      Barème fixé en Dollars : ${printPreview.planned_usd_bareme} USD
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="font-bold uppercase text-gray-600">Mode de Règlement :</span>
                <span className="font-black text-[10px] text-black">{printPreview.payment_method || 'Cash'}</span>
              </div>
              {printPreview.reference_number && (
                <div className="flex justify-between items-center py-0.5 text-[8px]">
                  <span className="font-bold uppercase text-gray-500">Réf. Transaction / Pièce :</span>
                  <span className="font-mono font-black">{printPreview.reference_number}</span>
                </div>
              )}
              {printPreview.description && printPreview.description !== printPreview.nature && (
                <div className="flex justify-between items-center py-0.5 text-[8px] text-gray-600">
                  <span className="font-medium uppercase">Précision :</span>
                  <span className="font-semibold italic text-right pl-2">{printPreview.description}</span>
                </div>
              )}
            </div>

            {/* NET PERÇU (BOX DE MISE EN VALEUR CLAIR MONOCHROME) */}
            <div className="w-full border-2 border-black rounded-lg p-2.5 mb-3 text-center bg-gray-50 text-black">
              <p className="text-[8px] font-black uppercase tracking-wider text-gray-700">Montant Certifié Payé</p>
              <p className="text-[17px] font-black tracking-tight leading-none mt-1 text-black font-mono">
                {(printPreview.paid_amount ?? printPreview.amount)?.toLocaleString('fr-FR')} <span className="text-[11px] font-bold">{printPreview.currency || 'HTG'}</span>
              </p>
              {/* BLOC CONVERSION DE TAUX DE CHANGE CLAIR ET TRANSPARENT */}
              {(() => {
                const rate = printPreview.exchange_rate_applied || schoolDetails?.exchange_rate;
                const isUSD = printPreview.currency === 'USD';
                const paidAmt = Number(printPreview.paid_amount ?? printPreview.amount ?? 0);

                if (isUSD && rate) {
                  const equivHTG = printPreview.equiv_amount_htg || Math.round(paidAmt * rate);
                  return (
                    <div className="mt-2 pt-2 border-t border-black/25 text-left space-y-1 bg-white p-2 rounded border border-black/10">
                      <div className="flex justify-between items-center text-[8.5px] font-black text-black">
                        <span className="uppercase text-gray-700">Taux de conversion appliqué :</span>
                        <span className="font-mono bg-black text-white px-1.5 py-0.5 rounded text-[8px] font-black">
                          1 USD = {rate} HTG
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[8px] font-bold text-gray-800">
                        <span>Montant versé (Devise USD) :</span>
                        <span className="font-mono font-black">${paidAmt.toLocaleString()} USD</span>
                      </div>
                      <div className="flex justify-between items-center text-[8.5px] font-black text-black border-t border-dashed border-gray-300 pt-0.5">
                        <span>Contre-valeur perçue (HTG) :</span>
                        <span className="font-mono font-black">{equivHTG.toLocaleString()} HTG</span>
                      </div>
                    </div>
                  );
                }

                const plannedUSD = printPreview.planned_usd_bareme;
                if (!isUSD && plannedUSD > 0 && rate > 0) {
                  const equivCoveredUSD = (paidAmt / rate).toFixed(2);
                  return (
                    <div className="mt-2 pt-2 border-t border-black/25 text-left space-y-1 bg-white p-2 rounded border border-black/10">
                      <div className="flex justify-between items-center text-[8.5px] font-black text-black">
                        <span className="uppercase text-gray-700">Taux de conversion appliqué :</span>
                        <span className="font-mono bg-black text-white px-1.5 py-0.5 rounded text-[8px] font-black">
                          1 USD = {rate} HTG
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[8px] font-bold text-gray-800">
                        <span>Barème fixé en Dollars :</span>
                        <span className="font-mono font-black">${plannedUSD} USD</span>
                      </div>
                      <div className="flex justify-between items-center text-[8px] font-bold text-gray-800">
                        <span>Valeur équivalente couverte :</span>
                        <span className="font-mono font-black">≈ ${equivCoveredUSD} USD</span>
                      </div>
                      <div className="flex justify-between items-center text-[8.5px] font-black text-black border-t border-dashed border-gray-300 pt-0.5">
                        <span>Montant effectif encaissé en Gourdes :</span>
                        <span className="font-mono font-black">{paidAmt.toLocaleString()} HTG</span>
                      </div>
                    </div>
                  );
                }

                return null;
              })()}
            </div>

            {/* BLOC QR CODE UNIQUE D'AUTHENTICITÉ (SCAN RAPIDE SMARTPHONE) */}
            <div className="w-full my-2.5 p-2 bg-gray-50 rounded border border-black/30 text-center flex flex-col items-center justify-center print:bg-white print:border-black">
              <div className="bg-white p-1 rounded border border-black/40 mb-1 inline-block">
                {reprintQrDataUrl ? (
                  <img
                    src={reprintQrDataUrl}
                    alt="QR Code d'Authenticité"
                    className="w-24 h-24 sm:w-28 sm:h-28 object-contain mx-auto block"
                  />
                ) : (
                  <div className="w-24 h-24 flex items-center justify-center bg-gray-100">
                    <QrCode size={30} className="text-gray-400" />
                  </div>
                )}
              </div>
              <p className="text-[7.5px] font-black uppercase tracking-wider text-black">
                Scan Rapide • Vérification d'Authenticité
              </p>
              <p className="text-[7px] font-mono font-bold text-gray-800 mt-0.5">
                Scellé : {reprintQrSignature || `EDN-${printPreview.ref || printPreview.id}`}
              </p>
              <p className="text-[6.5px] text-gray-600 italic mt-0.5">
                Scannez avec votre smartphone pour attester la validité de ce duplicata
              </p>
            </div>

            {/* SIGNATURE & MENTION LÉGALE */}
            <div className="w-full text-center space-y-3 mt-2">
              <div className="w-3/4 mx-auto space-y-1 pt-2">
                <div className="h-7 border-b border-black"></div>
                <p className="text-[7px] font-black uppercase tracking-widest">Sign. Caissier: {cashierName || 'Direction'}</p>
              </div>

              <p className="text-[8px] font-bold italic pt-2 border-t border-black text-center">
                Merci de votre confiance ! Duplicata officiel EduNova Pro.
              </p>
            </div>

            {/* BUFFER MARGE DE COUPE (AUTO-CUTTER EPSON PRINTER) */}
            <div className="w-full pt-3 mt-2 border-t border-dashed border-gray-400 text-center">
              <p className="text-[7px] font-black uppercase tracking-[0.25em] opacity-60 text-gray-500 print:text-black">- - - MARGE DE COUPE EPSON - - -</p>
              <div className="h-6 print:h-12"></div>
            </div>
          </div>
        )}
      </PrintPreviewModal>

      {/* STYLES D'IMPRESSION OPTIMISÉS 80MM */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; background: white !important; color: black !important; margin: 0 !important; padding: 0 !important; }
          .print\\:hidden { display: none !important; }
          #thermal-reprint-receipt { 
            visibility: visible !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 4mm !important;
            display: flex !important;
            flex-direction: column !important;
            box-shadow: none !important;
            border: none !important;
            font-family: 'Courier New', Courier, monospace, sans-serif !important;
            color: black !important;
            background: white !important;
            page-break-after: always !important;
            break-after: page !important;
          }
          #thermal-reprint-receipt * { 
            visibility: visible !important; 
            color: black !important;
            border-color: black !important;
          }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { size: 80mm auto; margin: 0; }
        }
      `}</style>

      <DailyCashClosureModal
        isOpen={isClosureModalOpen}
        onClose={() => setIsClosureModalOpen(false)}
        user={user}
      />
    </>
  );
};

export default ReceiptManagementView;
