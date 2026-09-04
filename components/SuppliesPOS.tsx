import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, Plus, Minus, Trash2, ArrowLeft, 
  ShoppingCart, DollarSign, UserCheck, 
  AlertTriangle, CheckCircle2, Loader2,
  Banknote, Receipt, ArrowRight, Package,
  GraduationCap, BookOpen, PenTool, Shirt,
  ChevronRight, X, ChevronDown, Sparkles, Printer, Clock,
  ShoppingBag, Store, BadgeCheck, Landmark, Layers, Tag,
  CreditCard, Wallet, Check, Smartphone, Calculator, AlertCircle,
  RefreshCw, Info, LayoutGrid, List
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import { UserProfile } from '../types';
import { AuditLogger } from '../utils/auditLogger';
import { formatStudentName } from '../utils/formatters';
import { MonCashService } from '../services/moncashService';
import { useSchool } from '../contexts/SchoolContext';
import { isRestrictedBankDate, getLocalTodayString } from '../utils/dateUtils';
import { ModernSaleReceiptModal } from './ModernSaleReceiptModal';
import { getActiveSchoolPaymentMethods, getPaymentMethodConfig } from '../lib/paymentMethods';
import { SelectPill, SelectOption } from './SelectPill';

interface SuppliesPOSProps {
  user: UserProfile;
  catalog: any[];
  classes: any[];
  selectedYearId: string;
  selectedYearLabel: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface CartItem {
  catalog_item_id: string;
  label: string;
  unit_price: number;
  quantity: number;
  currency: 'HTG' | 'USD';
  planned_exchange_rate: number;
  unit_measure?: string;
  is_deferred?: boolean;
}

const CATEGORIES = [
  { id: 'ALL', label: 'Tous', icon: Package },
  { id: 'UNIFORME', label: 'Uniformes', icon: Shirt },
  { id: 'LIVRE', label: 'Livres', icon: BookOpen },
  { id: 'FOURNITURE', label: 'Fournitures', icon: PenTool },
];

const SuppliesPOS: React.FC<SuppliesPOSProps> = ({ user, catalog, classes, selectedYearId, selectedYearLabel, onClose, onSuccess }) => {
  const { terminology, currentCampusId, school } = useSchool();

  // Mobile navigation tab state
  const [mobileTab, setMobileTab] = useState<'catalog' | 'cart'>('catalog');

  // Step 1: Student
  const [selectedClassId, setSelectedClassId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [isSearchingStudent, setIsSearchingStudent] = useState(false);
  const [studentResults, setStudentResults] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [classStudents, setClassStudents] = useState<any[]>([]);
  const [isLoadingClassStudents, setIsLoadingClassStudents] = useState(false);
  const [activeClassIds, setActiveClassIds] = useState<string[]>([]);
  const [isLoadingActiveClassIds, setIsLoadingActiveClassIds] = useState(false);
  const [studentViewMode, setStudentViewMode] = useState<'table' | 'grid'>('table');

  // Step 2: Catalog
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [itemSearch, setItemSearch] = useState('');
  const [catalogViewMode, setCatalogViewMode] = useState<'grid' | 'table'>('grid');

  // Fetch classes with active enrollments for the selected academic year & campus (multi-tenant)
  useEffect(() => {
    const fetchActiveClassIds = async () => {
      if (!selectedYearId || !user?.school_id) return;
      setIsLoadingActiveClassIds(true);
      try {
        let query = supabase
          .from('enrollments')
          .select('class_id')
          .eq('school_id', user.school_id)
          .eq('academic_year_id', selectedYearId);
          
        if (currentCampusId) {
          query = query.eq('campus_id', currentCampusId);
        }

        const { data, error } = await query.limit(4000);
          
        if (error) {
          console.error("Error fetching active enrollments:", error);
          return;
        }
        
        if (data) {
          const uniqueIds = Array.from(new Set(data.map(item => item.class_id).filter(Boolean))) as string[];
          setActiveClassIds(uniqueIds);
        }
      } catch (err) {
        console.error("Failed to load active classes:", err);
      } finally {
        setIsLoadingActiveClassIds(false);
      }
    };
    fetchActiveClassIds();
  }, [selectedYearId, user?.school_id, currentCampusId]);

  // Filter the classes array to only include those with active registrations (with fallback to all classes)
  const filteredClassesList = useMemo(() => {
    if (activeClassIds.length > 0) {
      const active = classes.filter(cls => activeClassIds.includes(cls.id));
      if (active.length > 0) return active;
    }
    return classes;
  }, [classes, activeClassIds]);

  // Harmonized class options for SelectPill
  const classOptions: SelectOption[] = useMemo(() => {
    const countLabel = isLoadingActiveClassIds 
      ? '(Chargement...)' 
      : `(${filteredClassesList.length} ${filteredClassesList.length > 1 ? terminology.classes.toLowerCase() : terminology.class.toLowerCase()})`;

    const list: SelectOption[] = [
      {
        value: '',
        label: `Toutes les ${terminology.classes.toLowerCase()} ${countLabel}`,
        badge: filteredClassesList.length > 0 ? `${filteredClassesList.length}` : undefined,
        icon: GraduationCap
      }
    ];

    filteredClassesList.forEach(cls => {
      list.push({
        value: cls.id,
        label: cls.name,
        icon: GraduationCap,
        description: cls.section || cls.level ? `${cls.section || ''} ${cls.level ? '• ' + cls.level : ''}`.trim() : undefined
      });
    });

    return list;
  }, [filteredClassesList, isLoadingActiveClassIds, terminology.classes, terminology.class]);

  // Fetch students when class changes (strict Multi-Tenant & Campus)
  useEffect(() => {
    const fetchClassStudents = async () => {
      if (!selectedClassId || !selectedYearId) {
        setClassStudents([]);
        return;
      }
      setIsLoadingClassStudents(true);
      try {
        let query = supabase
          .from('enrollments')
          .select('student_id, students(id, first_name, last_name, reference_number, wallet_balance_htg, wallet_balance_usd, gender, status)')
          .eq('class_id', selectedClassId)
          .eq('academic_year_id', selectedYearId)
          .eq('school_id', user.school_id);

        if (currentCampusId) {
          query = query.eq('campus_id', currentCampusId);
        }

        const { data, error } = await query.limit(300);
          
        if (error) {
          console.error("Error fetching enrolled class students:", error);
          setClassStudents([]);
          return;
        }

        if (data) {
          const enrolledStudents = data
            .map((e: any) => {
              const s = Array.isArray(e.students) ? e.students[0] : e.students;
              return s;
            })
            .filter(Boolean);

          // Sort by last name
          enrolledStudents.sort((a: any, b: any) => {
            const nameA = (a.last_name || '').toLowerCase();
            const nameB = (b.last_name || '').toLowerCase();
            return nameA.localeCompare(nameB);
          });

          setClassStudents(enrolledStudents);
        }
      } catch (err) {
        console.error("Failed to fetch class students:", err);
        setClassStudents([]);
      } finally {
        setIsLoadingClassStudents(false);
      }
    };
    fetchClassStudents();
  }, [selectedClassId, selectedYearId, user.school_id, currentCampusId]);

  // Step 3 & 4: Cart & Payment
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentCurrency, setPaymentCurrency] = useState<'HTG' | 'USD'>('HTG');
  const [paymentMethod, setPaymentMethod] = useState<string>('Dépôt Bancaire');
  const [bankName, setBankName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [depositDate, setDepositDate] = useState(getLocalTodayString());
  const [refError, setRefError] = useState<string | null>(null);
  const [isCheckingRef, setIsCheckingRef] = useState(false);
  const [schoolDetails, setSchoolDetails] = useState<any>(null);
  const [cashierName, setCashierName] = useState<string>('');

  // Cash Calculator & Contextual Fields
  const [receivedCash, setReceivedCash] = useState<string>('');
  const [senderPhone, setSenderPhone] = useState<string>('');
  const [checkIssuerName, setCheckIssuerName] = useState<string>('');

  // Méthodes de paiement dynamiques
  const activePaymentMethods = useMemo(() => {
    return getActiveSchoolPaymentMethods(schoolDetails || school);
  }, [schoolDetails, school]);

  const currentMethodConfig = useMemo(() => {
    return getPaymentMethodConfig(paymentMethod, schoolDetails || school);
  }, [paymentMethod, schoolDetails, school]);

  // Synchroniser la méthode par défaut si la sélectionnée est inactive
  useEffect(() => {
    if (activePaymentMethods.length > 0 && !activePaymentMethods.some(m => m.code === paymentMethod)) {
      setPaymentMethod(activePaymentMethods[0].code);
    }
  }, [activePaymentMethods, paymentMethod]);
  
  // Step 5 & 6: Validation & Receipt
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [transactionRef, setTransactionRef] = useState('');
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'payment'>('cart');

  // Real-time reference check for duplicates
  const verifyReference = async (ref: string, currentBank: string = '') => {
    const requiresRef = currentMethodConfig?.requires_reference ?? (paymentMethod === 'Chèque' || paymentMethod === 'Dépôt Bancaire' || paymentMethod === 'MonCash' || paymentMethod === 'Natcash' || paymentMethod === 'Carte');
    if (!ref || !user?.school_id || !requiresRef) {
      setRefError(null);
      return;
    }
    setIsCheckingRef(true);
    try {
      let supplyQuery = supabase
        .from('school_supplies')
        .select('id')
        .eq('school_id', user.school_id)
        .eq('reference_number', ref);

      const requiresBank = currentMethodConfig?.requires_bank ?? (paymentMethod === 'Chèque' || paymentMethod === 'Dépôt Bancaire');
      if (requiresBank && currentBank) {
        supplyQuery = supplyQuery.eq('bank_name', currentBank);
      }

      const { data } = await supplyQuery.limit(1);
      
      if (data && data.length > 0) {
        setRefError(`Ce numéro de ${paymentMethod === 'Chèque' ? 'chèque' : paymentMethod === 'MonCash' || paymentMethod === 'Natcash' ? 'transaction' : paymentMethod === 'Carte' ? 'ticket TPE' : 'bordereau'} existe déjà pour cette banque.`);
      } else {
        let paymentsQuery = supabase
          .from('payments')
          .select('id')
          .eq('school_id', user.school_id)
          .eq('reference_number', ref);

        if (requiresBank && currentBank) {
          paymentsQuery = paymentsQuery.eq('bank_name', currentBank);
        }

        const { data: payData } = await paymentsQuery.limit(1);

        if (payData && payData.length > 0) {
          setRefError(`Ce numéro de ${paymentMethod === 'Chèque' ? 'chèque' : paymentMethod === 'MonCash' || paymentMethod === 'Natcash' ? 'transaction' : paymentMethod === 'Carte' ? 'ticket TPE' : 'bordereau'} existe déjà (Scolarité) pour cette banque.`);
        } else {
          setRefError(null);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCheckingRef(false);
    }
  };

  // --- REFRESH STUDENT WALLET ---
  const refreshStudentWallet = async () => {
    if (!selectedStudent?.id) return;
    try {
      const { data: freshStudent } = await supabase
        .from('students')
        .select('id, first_name, last_name, reference_number, wallet_balance_htg, wallet_balance_usd, status')
        .eq('id', selectedStudent.id)
        .maybeSingle();
      if (freshStudent) {
        setSelectedStudent((prev: any) => prev ? { ...prev, ...freshStudent } : freshStudent);
        toast.success("Solde du portefeuille actualisé !");
      }
    } catch (e) {
      console.error("Erreur actualisation portefeuille", e);
    }
  };

  // --- FETCH CONTEXT ---
  useEffect(() => {
    const fetchContext = async () => {
      try {
        const { data: profile } = await supabase.from('profiles').select('school_id, full_name').eq('id', user.id).single();
        if (profile) {
          setCashierName(profile.full_name || '');
          const { data: schoolData } = await supabase.from('schools').select('name, address, phone, logo_url, email, global_settings').eq('id', profile.school_id).single();
          if (schoolData) setSchoolDetails(schoolData);
        }
      } catch (e) {
        console.error("Erreur chargement contexte", e);
      }
    };
    fetchContext();
  }, [user.id]);

  // --- STUDENT SEARCH (Debounced) ---
  useEffect(() => {
    const searchStudents = async () => {
      if (studentSearch.length < 2) {
        setStudentResults([]);
        return;
      }
      setIsSearchingStudent(true);
      const { data, error } = await supabase.rpc('search_students_accent_insensitive', {
        p_school_id: user.school_id,
        p_query: studentSearch,
        p_limit: 15,
        p_campus_id: user.campus_id || currentCampusId || null
      });

      if (error) {
        console.error("Search error:", error);
        setIsSearchingStudent(false);
        return;
      }

      const mappedData = data?.map((s: any) => ({
        ...s,
        classes: s.class_name ? { name: s.class_name } : null
      }));
      
      setStudentResults(mappedData || []);
      setIsSearchingStudent(false);
    };

    const timer = setTimeout(searchStudents, 300);
    return () => clearTimeout(timer);
  }, [studentSearch, user.school_id, user.campus_id, currentCampusId]);

  const handleSelectStudent = async (student: any) => {
    // Check if enrolled in selected year
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('class_id, class:classes(name)')
      .eq('student_id', student.id)
      .eq('academic_year_id', selectedYearId)
      .maybeSingle();

    // Fetch fresh student data to guarantee fresh wallet balances
    const { data: freshStudent } = await supabase
      .from('students')
      .select('id, first_name, last_name, reference_number, wallet_balance_htg, wallet_balance_usd, gender, status')
      .eq('id', student.id)
      .maybeSingle();

    setSelectedStudent({
      ...(freshStudent || student),
      effectiveClassName: (enrollment?.class as any)?.name || student.classes?.name || 'Non assigné'
    });
    setStudentSearch('');
    setStudentResults([]);
    setReceivedCash('');
  };

  // --- CATALOG FILTERING ---
  const filteredCatalog = useMemo(() => {
    return catalog.filter(item => {
      const matchesSearch = item.label.toLowerCase().includes(itemSearch.toLowerCase());
      const matchesCategory = selectedCategory === 'ALL' || 
        (selectedCategory === 'UNIFORME' && item.category?.toLowerCase().includes('uniforme')) ||
        (selectedCategory === 'LIVRE' && item.category?.toLowerCase().includes('livre')) ||
        (selectedCategory === 'FOURNITURE' && item.category?.toLowerCase().includes('fourniture'));
      return matchesSearch && matchesCategory;
    });
  }, [catalog, itemSearch, selectedCategory]);

  // --- CART OPERATIONS ---
  const cartEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    cartEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [cart]);

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.catalog_item_id === item.id);
      const currentQty = existing ? existing.quantity : 0;
      const defaultStep = (item.unit_measure?.toLowerCase().includes('aune') || item.category?.toLowerCase().includes('uniforme')) ? 1 : 1;
      const nextQty = Math.round((currentQty + defaultStep) * 100) / 100;
      const available = Number(item.stock_quantity ?? 0);
      const isDeferred = nextQty > available;
      
      if (isDeferred) {
        const msg = available <= 0
          ? `📦 ${item.label} : Article en rupture de stock. Ajouté en Précommande / Livraison Différée.`
          : `📦 ${item.label} : Stock physique immédiat atteint (${available} dispo). Article ajouté en Précommande / Livraison Différée.`;
        toast.warning(msg, {
          id: `deferred-toast-${item.id}`,
          duration: 3500
        });
      } else {
        const remaining = available - nextQty;
        toast.success(`✓ ${item.label} ajouté au panier (${remaining} restant en stock immédiat).`, {
          id: `stock-toast-${item.id}`,
          duration: 2000
        });
      }

      if (existing) {
        return prev.map(i => i.catalog_item_id === item.id ? { ...i, quantity: nextQty, is_deferred: isDeferred } : i);
      }

      return [...prev, {
        catalog_item_id: item.id,
        label: item.label,
        unit_price: item.unit_price,
        quantity: 1,
        currency: item.currency || 'HTG',
        planned_exchange_rate: item.planned_exchange_rate || 1,
        unit_measure: item.unit_measure || (item.category?.toLowerCase().includes('uniforme') ? 'Aune' : 'Unité'),
        is_deferred: isDeferred
      }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.catalog_item_id === id) {
        const newQ = Math.max(0.01, Math.round((i.quantity + delta) * 100) / 100);
        const item = catalog.find(c => c.id === id);
        const available = Number(item?.stock_quantity ?? 0);
        const isDeferred = newQ > available;
        
        if (delta > 0 && isDeferred) {
          toast.warning(`📦 Quantité (${newQ}) supérieure au stock disponible (${available}). Placé en Livraison Différée.`, {
            id: `deferred-update-${id}`,
            duration: 3000
          });
        }
        return newQ > 0 ? { ...i, quantity: newQ, is_deferred: isDeferred } : i;
      }
      return i;
    }));
  };

  const setDirectQuantity = (id: string, val: number) => {
    setCart(prev => prev.map(i => {
      if (i.catalog_item_id === id) {
        const item = catalog.find(c => c.id === id);
        const available = Number(item?.stock_quantity ?? 0);
        const isDeferred = val > available;
        if (isDeferred) {
          toast.warning(`📦 Quantité (${val}) supérieure au stock disponible (${available}). Placé en Livraison Différée.`);
        }
        return { ...i, quantity: val, is_deferred: isDeferred };
      }
      return i;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.catalog_item_id !== id));
  };

  // --- CURRENCY & TOTALS ---
  const hasMixedCurrencies = useMemo(() => {
    const hasUSD = cart.some(i => i.currency === 'USD');
    const hasHTG = cart.some(i => i.currency === 'HTG');
    return hasUSD && hasHTG;
  }, [cart]);

  const canPayInUSD = useMemo(() => {
    return cart.every(i => i.currency === 'USD');
  }, [cart]);

  useEffect(() => {
    if (hasMixedCurrencies) {
      setPaymentCurrency('HTG');
    } else if (cart.length > 0) {
      setPaymentCurrency(cart[0].currency);
    }
  }, [hasMixedCurrencies, cart]);

  const cartTotals = useMemo(() => {
    let totalHTG = 0;
    let totalUSD = 0;
    let convertedTotalHTG = 0;

    cart.forEach(item => {
      const lineTotal = item.unit_price * item.quantity;
      if (item.currency === 'HTG') {
        totalHTG += lineTotal;
        convertedTotalHTG += lineTotal;
      } else {
        totalUSD += lineTotal;
        convertedTotalHTG += (lineTotal * item.planned_exchange_rate);
      }
    });

    return { 
      totalHTG: Math.round(totalHTG * 100) / 100, 
      totalUSD: Math.round(totalUSD * 100) / 100, 
      convertedTotalHTG: Math.round(convertedTotalHTG * 100) / 100 
    };
  }, [cart]);

  const requiredAmount = paymentCurrency === 'USD' ? cartTotals.totalUSD : cartTotals.convertedTotalHTG;
  const studentWallet = paymentCurrency === 'USD' 
    ? Number(selectedStudent?.wallet_balance_usd || 0) 
    : Number(selectedStudent?.wallet_balance_htg || 0);
  const isWalletInsufficient = paymentMethod === 'Portefeuille' && studentWallet < requiredAmount;

  // --- PAYMENT VALIDATION ---
  const handlePayment = async () => {
    if (!selectedStudent || cart.length === 0 || !selectedYearId || refError) return;
    
    if (paymentMethod === 'Dépôt Bancaire' && depositDate) {
      const restriction = isRestrictedBankDate(depositDate);
      if (restriction.restricted) {
        toast.error(`Opération bloquée : ${restriction.reason}.`);
        return;
      }
    }

    if (hasMixedCurrencies && paymentCurrency === 'USD') {
      toast.error("Impossible de payer un panier mixte en USD. Veuillez convertir en HTG ou payer séparément.");
      return;
    }

    const requiredAmount = paymentCurrency === 'USD' ? cartTotals.totalUSD : cartTotals.convertedTotalHTG;

    // Strict Wallet Balance Verification
    if (paymentMethod === 'Portefeuille') {
      const studentWallet = paymentCurrency === 'USD' 
        ? Number(selectedStudent.wallet_balance_usd || 0) 
        : Number(selectedStudent.wallet_balance_htg || 0);

      if (studentWallet < requiredAmount) {
        toast.error(`Solde insuffisant ! Le portefeuille de l'élève dispose de ${studentWallet.toLocaleString()} ${paymentCurrency}, alors que le montant requis est de ${requiredAmount.toLocaleString()} ${paymentCurrency}.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if ((paymentMethod === 'Chèque' || paymentMethod === 'Dépôt Bancaire' || paymentMethod === 'MonCash' || paymentMethod === 'Natcash' || paymentMethod === 'Carte') && referenceNumber) {
        // Double check
        let supQuery = supabase
          .from('school_supplies')
          .select('id')
          .eq('school_id', user.school_id)
          .eq('reference_number', referenceNumber);

        if ((paymentMethod === 'Chèque' || paymentMethod === 'Dépôt Bancaire') && bankName) {
          supQuery = supQuery.eq('bank_name', bankName);
        }

        const { data: existingSupplies } = await supQuery.limit(1);
        if (existingSupplies && existingSupplies.length > 0) {
           toast.error(`Ce numéro de ${paymentMethod === 'Chèque' ? 'chèque' : paymentMethod === 'MonCash' || paymentMethod === 'Natcash' ? 'transaction' : paymentMethod === 'Carte' ? 'ticket TPE' : 'bordereau'} a déjà été utilisé dans le système boutique pour cette banque.`);
           setIsSubmitting(false);
           return;
        }

        let payQuery = supabase
          .from('payments')
          .select('id')
          .eq('school_id', user.school_id)
          .eq('reference_number', referenceNumber);

        if ((paymentMethod === 'Chèque' || paymentMethod === 'Dépôt Bancaire') && bankName) {
          payQuery = payQuery.eq('bank_name', bankName);
        }

        const { data: existingPayment } = await payQuery.limit(1);
        if (existingPayment && existingPayment.length > 0) {
           toast.error(`Ce numéro de ${paymentMethod === 'Chèque' ? 'chèque' : paymentMethod === 'MonCash' || paymentMethod === 'Natcash' ? 'transaction' : paymentMethod === 'Carte' ? 'ticket TPE' : 'bordereau'} a déjà été utilisé dans le système de scolarité pour cette banque.`);
           setIsSubmitting(false);
           return;
        }
      }

      const txId = `POS-${Date.now().toString().slice(-6)}`;
      const isPending = paymentMethod === 'MonCash' || paymentMethod === 'Chèque';
      const finalPaymentMethod = paymentMethod;
      const moncashOrderId = paymentMethod === 'MonCash' ? `POS-${Date.now()}` : null;
      
      // 1. Insert into school_supplies for each item (Multi-tenant & Campus / Annexe)
      const suppliesPayload = cart.map(item => {
        const catItem = catalog.find(c => c.id === item.catalog_item_id);
        const available = Number(catItem?.stock_quantity ?? 0);
        const isDeferred = item.is_deferred || (item.quantity > available);
        const descriptionWithTag = isDeferred && !item.label.includes('Livraison Différée')
          ? `${item.label} [Livraison Différée - Attente Fournisseur]`
          : item.label;

        const effectiveRef = (paymentMethod === 'Chèque' || paymentMethod === 'Dépôt Bancaire' || paymentMethod === 'MonCash' || paymentMethod === 'Natcash' || paymentMethod === 'Carte') 
          ? (referenceNumber || (senderPhone ? `TEL:${senderPhone}` : null))
          : null;

        return {
          school_id: user.school_id,
          campus_id: currentCampusId || null,
          academic_year_id: selectedYearId,
          student_id: selectedStudent.id,
          catalog_item_id: item.catalog_item_id,
          description: descriptionWithTag,
          quantity: item.quantity,
          total_amount: item.unit_price * item.quantity,
          currency: item.currency,
          amount_htg_equivalent: item.currency === 'USD' 
            ? Math.round(((item.unit_price * item.quantity) * (item.planned_exchange_rate || 1)) * 100) / 100
            : (item.unit_price * item.quantity),
          exchange_rate_applied: item.currency === 'USD' ? (item.planned_exchange_rate || 1) : 1,
          status: isPending ? 'EN_ATTENTE' : 'PAID',
          payment_method: finalPaymentMethod,
          bank_name: (paymentMethod === 'Chèque' || paymentMethod === 'Dépôt Bancaire') ? bankName : null,
          reference_number: effectiveRef,
          deposit_date: paymentMethod === 'Dépôt Bancaire' ? depositDate : null,
          transaction_id: txId,
          moncash_order_id: moncashOrderId,
          moncash_status: paymentMethod === 'MonCash' ? 'PENDING' : null
        };
      });

      let { data: insertedSupplies, error: suppliesError } = await supabase
        .from('school_supplies')
        .insert(suppliesPayload)
        .select();

      if (suppliesError) {
        if (suppliesError.code === 'PGRST204' || suppliesError.code === '42703') {
           const fallbackPayload = suppliesPayload.map(p => {
             const { amount_htg_equivalent, ...rest } = p;
             return rest;
           });
           const { data: retryData, error: retryError } = await supabase
             .from('school_supplies')
             .insert(fallbackPayload)
             .select();
           
           if (retryError) throw retryError;
           insertedSupplies = retryData;
        } else {
          throw suppliesError;
        }
      }

      if (!insertedSupplies) throw new Error("Aucune donnée d'insertion récupérée");

      // 2. Insert into supply_payments
      const paymentsPayload = insertedSupplies.map(sup => {
        const cartItem = cart.find(c => c.catalog_item_id === sup.catalog_item_id);
        const amount = sup.total_amount;
        
        let payAmount = amount;
        let payCurrency = paymentCurrency;
        let exchangeRate = 1;
        let htgEquivalent = amount;

        if (paymentCurrency === 'HTG' && sup.currency === 'USD') {
          payAmount = amount * (cartItem?.planned_exchange_rate || 1);
          exchangeRate = cartItem?.planned_exchange_rate || 1;
          htgEquivalent = Math.round(payAmount * 100) / 100;
        } else if (paymentCurrency === 'USD' && sup.currency === 'USD') {
          payAmount = amount;
          exchangeRate = cartItem?.planned_exchange_rate || 1;
          htgEquivalent = Math.round((amount * exchangeRate) * 100) / 100;
        } else if (paymentCurrency === 'HTG' && sup.currency === 'HTG') {
          payAmount = amount;
          exchangeRate = 1;
          htgEquivalent = amount;
        }

        return {
          supply_id: sup.id,
          school_id: user.school_id,
          campus_id: currentCampusId || null,
          amount: Math.round(payAmount * 100) / 100,
          currency: payCurrency,
          exchange_rate_applied: exchangeRate,
          amount_htg_equivalent: htgEquivalent,
          payment_date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]
        };
      });

      const { error: paymentsError } = await supabase
        .from('supply_payments')
        .insert(paymentsPayload);

      if (paymentsError) throw paymentsError;

      // 3. Decrement stock directly in supply_catalog table
      for (const item of cart) {
        const catalogItem = catalog.find(c => c.id === item.catalog_item_id);
        if (catalogItem) {
          const currentStock = Number(catalogItem.stock_quantity ?? 0);
          const qtySold = Number(item.quantity ?? 1);
          const newStock = Math.max(0, Math.round((currentStock - qtySold) * 100) / 100);

          const { error: stockErr } = await supabase
            .from('supply_catalog')
            .update({ stock_quantity: newStock })
            .eq('id', item.catalog_item_id);

          if (stockErr) {
            console.error("Erreur mise à jour stock supply_catalog:", stockErr);
          }
        }
      }

      // 4. Deduct student wallet if paid with Portefeuille
      if (paymentMethod === 'Portefeuille') {
        const updateField = paymentCurrency === 'USD' ? 'wallet_balance_usd' : 'wallet_balance_htg';
        const currentWallet = paymentCurrency === 'USD' 
          ? Number(selectedStudent.wallet_balance_usd || 0) 
          : Number(selectedStudent.wallet_balance_htg || 0);
        const newBalance = Math.max(0, Math.round((currentWallet - requiredAmount) * 100) / 100);

        const { error: walletUpdateErr } = await supabase
          .from('students')
          .update({ [updateField]: newBalance })
          .eq('id', selectedStudent.id);

        if (walletUpdateErr) {
          console.error("Erreur déduction portefeuille étudiant:", walletUpdateErr);
          toast.error("Vente enregistrée mais une erreur est survenue lors de la déduction du portefeuille: " + walletUpdateErr.message);
        } else {
          setSelectedStudent((prev: any) => prev ? { ...prev, [updateField]: newBalance } : prev);
        }
      }

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'CREATE',
        entity_type: 'payment',
        details: { 
          type: 'supplies_payment',
          transaction_ref: txId,
          student_id: selectedStudent.id,
          student_name: formatStudentName(selectedStudent.last_name, selectedStudent.first_name).fullName,
          items_count: cart.length,
          total_amount: requiredAmount,
          currency: paymentCurrency,
          payment_method: paymentMethod
        }
      });

      setTransactionRef(txId);

      if (paymentMethod === 'MonCash' && moncashOrderId) {
        try {
          const totalHTG = cartTotals.convertedTotalHTG;
          const redirectUrl = await MonCashService.initiatePayment(user.school_id, {
            amount: totalHTG,
            orderId: moncashOrderId,
            description: `Achat Fournitures - ${formatStudentName(selectedStudent.last_name, selectedStudent.first_name).fullName}`
          });
          
          if (redirectUrl) {
            toast.info("Redirection vers MonCash...");
            setTimeout(() => {
              window.open(redirectUrl, '_blank');
              setShowReceipt(true);
            }, 1500);
          }
        } catch (err: any) {
          console.error("MonCash POS Error:", err);
          toast.error("Erreur MonCash: " + err.message);
        }
      } else {
        setShowReceipt(true);
      }

      toast.success(paymentMethod === 'Portefeuille' ? "Paiement débité du portefeuille avec succès !" : "Paiement effectué avec succès !");
    } catch (err: any) {
      console.error("Payment error:", err);
      toast.error("Erreur lors du paiement: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- RECEIPT VIEW ---
  if (showReceipt) {
    return (
      <ModernSaleReceiptModal
        isOpen={showReceipt}
        onClose={() => {
          setShowReceipt(false);
          onSuccess();
        }}
        onNewSale={() => {
          setShowReceipt(false);
          setCart([]);
          setPaymentCurrency('HTG');
          setMobileTab('catalog');
          setCheckoutStep('cart');
        }}
        transactionRef={transactionRef}
        created_at={new Date()}
        student={selectedStudent}
        items={cart}
        totalAmount={paymentCurrency === 'HTG' ? cartTotals.convertedTotalHTG : cartTotals.totalUSD}
        currency={paymentCurrency}
        paymentMethod={paymentMethod}
        bankName={bankName}
        referenceNumber={referenceNumber}
        cashierName={cashierName}
        schoolDetails={schoolDetails}
        academicYearLabel={selectedYearLabel}
        exchangeRate={cart[0]?.planned_exchange_rate}
      />
    );
  }


  const totalCartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-md flex flex-col lg:flex-row overflow-hidden animate-in fade-in duration-300">
      
      {/* MOBILE / TABLET TOP NAVIGATION BAR */}
      <div className="lg:hidden bg-slate-950/95 backdrop-blur-xl text-white p-3.5 border-b border-slate-800/80 flex items-center justify-between z-30 shrink-0 shadow-lg shadow-black/20">
        <div className="flex items-center gap-2.5">
          <button 
            onClick={onClose} 
            className="p-2.5 bg-slate-800/90 text-slate-300 hover:text-white rounded-xl border border-slate-700/60 transition-all active:scale-95 flex items-center justify-center min-w-[40px] min-h-[40px]"
            title="Retour"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <Store size={14} className="text-emerald-400" />
              <h2 className="text-sm font-black text-white leading-tight">Caisse Boutique</h2>
            </div>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
              Session: <span className="text-indigo-400">{selectedYearLabel}</span>
            </p>
          </div>
        </div>

        {/* Segmented Switcher for Mobile / Tablet */}
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 shadow-inner">
          <button 
            onClick={() => setMobileTab('catalog')} 
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
              mobileTab === 'catalog' 
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Package size={14} />
            <span>Catalogue</span>
          </button>
          
          <button 
            onClick={() => setMobileTab('cart')} 
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 relative ${
              mobileTab === 'cart' 
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShoppingCart size={14} />
            <span>Panier</span>
            {totalCartCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-emerald-400 text-slate-950 rounded-full font-black text-[10px] shadow-xs">
                {totalCartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* LEFT PANEL: STUDENT & CATALOG */}
      <div className={`w-full lg:w-7/12 xl:w-8/12 flex-col h-full bg-slate-50/60 lg:bg-white border-r border-slate-200/80 overflow-y-auto ${mobileTab === 'catalog' ? 'flex' : 'hidden lg:flex'}`}>
        
        {/* DESKTOP HEADER */}
        <div className="hidden lg:flex px-6 py-4.5 border-b border-slate-200/70 items-center justify-between bg-white/95 backdrop-blur-md sticky top-0 z-20 shadow-xs shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={onClose} 
              className="px-3.5 py-2 bg-slate-100/90 hover:bg-slate-200/90 text-slate-700 hover:text-slate-900 rounded-xl transition-all flex items-center gap-2 border border-slate-200 font-extrabold text-xs active:scale-95 shadow-2xs"
            >
              <ArrowLeft size={16} />
              <span>Retour au Menu</span>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-sm shadow-emerald-500/20">
                  <Store size={18} />
                </div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Caisse Boutique & Fournitures</h2>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-indigo-50/80 border border-indigo-100/80 px-3.5 py-1.5 rounded-full text-xs font-bold text-indigo-900 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Session: <strong className="text-indigo-700 font-black">{selectedYearLabel}</strong></span>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-6 flex-1 pb-28 lg:pb-8">
          
          {/* STEP 1: STUDENT SELECTION */}
          <section className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center text-xs font-black shadow-sm shadow-indigo-200">
                  1
                </span>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Sélection de l'élève acheteur
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Associez la vente à un élève inscrit pour l'édition du reçu officiel
                  </p>
                </div>
              </div>
              {selectedStudent && (
                <button 
                  onClick={() => setSelectedStudent(null)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-extrabold text-xs transition-colors flex items-center gap-1.5 border border-indigo-100"
                >
                  <UserCheck size={14} />
                  <span>Changer d'élève</span>
                </button>
              )}
            </div>
            
            {!selectedStudent ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* SELECT BY CLASS WITH HARMONIZED SELECTPILL */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                    <GraduationCap size={14} className="text-indigo-600" />
                    Filtrer par {terminology.class}
                  </label>
                  <SelectPill 
                    options={classOptions}
                    value={selectedClassId}
                    onChange={(val) => {
                      setSelectedClassId(val);
                      setStudentSearch('');
                    }}
                    placeholder={`Toutes les ${terminology.classes.toLowerCase()}...`}
                    icon={GraduationCap}
                    colorScheme="indigo"
                    size="sm"
                    searchable={filteredClassesList.length > 5}
                    className="w-full"
                  />
                </div>

                {/* SEARCH INPUT */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                    <Search size={14} className="text-indigo-600" />
                    Recherche directe (Nom ou Matricule)
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Tapez un nom, prénom ou matricule..." 
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50/80 hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all min-h-[42px]"
                      value={studentSearch}
                      onChange={e => {
                        setStudentSearch(e.target.value);
                        if (e.target.value) setSelectedClassId('');
                      }}
                    />
                    {isSearchingStudent ? (
                      <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 text-indigo-600 animate-spin" size={16} />
                    ) : studentSearch ? (
                      <button 
                        onClick={() => setStudentSearch('')} 
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200/60 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* RESULTS LIST WITH DUAL VIEW: TABLEAU & CARTES GRILLES */}
                <div className="col-span-full">
                  {(selectedClassId || studentSearch.length >= 2) && (
                    <div className="bg-slate-50/60 border border-slate-200/90 rounded-2xl overflow-hidden shadow-inner p-3 space-y-3">
                      {/* HEADER CONTROLS & VIEW SWITCHER */}
                      <div className="flex items-center justify-between pb-1 px-1 border-b border-slate-200/60">
                        <p className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                          {(selectedClassId ? classStudents : studentResults).length}{' '}
                          {(selectedClassId ? classStudents : studentResults).length > 1 ? terminology.students.toLowerCase() : terminology.student.toLowerCase()}{' '}
                          trouvé{(selectedClassId ? classStudents : studentResults).length > 1 ? 's' : ''}
                        </p>

                        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => setStudentViewMode('table')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                              studentViewMode === 'table'
                                ? 'bg-indigo-50 text-indigo-800 font-black border border-indigo-200/80 shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                            title="Vue Tableau"
                          >
                            <List size={13} className={studentViewMode === 'table' ? 'text-indigo-600' : 'text-slate-500'} />
                            <span>Tableau</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setStudentViewMode('grid')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                              studentViewMode === 'grid'
                                ? 'bg-indigo-50 text-indigo-800 font-black border border-indigo-200/80 shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                            title="Vue Cartes grilles"
                          >
                            <LayoutGrid size={13} className={studentViewMode === 'grid' ? 'text-indigo-600' : 'text-slate-500'} />
                            <span>Cartes grilles</span>
                          </button>
                        </div>
                      </div>

                      {isLoadingClassStudents || isSearchingStudent ? (
                        <div className="p-8 text-center space-y-2">
                          <Loader2 className="mx-auto animate-spin text-indigo-600" size={24} />
                          <p className="text-xs font-bold text-slate-500">Recherche des élèves en cours...</p>
                        </div>
                      ) : (
                        <>
                          {(selectedClassId ? classStudents : studentResults).length > 0 ? (
                            studentViewMode === 'table' ? (
                              /* VUE TABLEAU DES ÉLÈVES */
                              <div className="overflow-x-auto max-h-[300px] overflow-y-auto rounded-xl border border-slate-200 bg-white">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                    <tr>
                                      <th className="py-2.5 px-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">N°</th>
                                      <th className="py-2.5 px-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">Élève</th>
                                      <th className="py-2.5 px-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">Matricule</th>
                                      <th className="py-2.5 px-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">Classe</th>
                                      <th className="py-2.5 px-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">Portefeuille</th>
                                      <th className="py-2.5 px-3 text-[10px] font-black uppercase text-slate-500 tracking-wider text-right">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {(selectedClassId ? classStudents : studentResults).map((student, idx) => {
                                      const matricule = student.reference_number || student.code || student.id.substring(0, 8);
                                      const className = student?.classes?.name || classes.find(c => c.id === selectedClassId)?.name || `Sans ${terminology.class.toLowerCase()}`;
                                      const htgBal = Number(student.wallet_balance_htg) || 0;
                                      const usdBal = Number(student.wallet_balance_usd) || 0;

                                      return (
                                        <tr 
                                          key={student.id}
                                          onClick={() => handleSelectStudent(student)}
                                          className="hover:bg-indigo-50/70 transition-colors cursor-pointer group"
                                        >
                                          <td className="py-2.5 px-3 font-mono text-slate-400 font-bold text-[11px]">
                                            {String(idx + 1).padStart(2, '0')}
                                          </td>
                                          <td className="py-2.5 px-3">
                                            <div className="flex items-center gap-2.5">
                                              <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center border border-indigo-200/80 shrink-0">
                                                {student.last_name?.charAt(0) || '?'}
                                              </div>
                                              <span className="font-black text-slate-900 group-hover:text-indigo-700 transition-colors">
                                                {formatStudentName(student.last_name, student.first_name).fullName}
                                              </span>
                                            </div>
                                          </td>
                                          <td className="py-2.5 px-3">
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono text-[10px] font-bold rounded-md border border-slate-200">
                                              #{matricule}
                                            </span>
                                          </td>
                                          <td className="py-2.5 px-3 text-slate-700 font-bold text-xs">
                                            {className}
                                          </td>
                                          <td className="py-2.5 px-3">
                                            <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold">
                                              <span className={htgBal > 0 ? 'text-emerald-700 font-black' : 'text-slate-400'}>
                                                {htgBal.toLocaleString()} HTG
                                              </span>
                                              {usdBal > 0 && (
                                                <span className="text-teal-700 font-black text-[10px]">
                                                  • {usdBal.toLocaleString()} $
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="py-2.5 px-3 text-right">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleSelectStudent(student);
                                              }}
                                              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] inline-flex items-center gap-1 shadow-2xs group-hover:scale-105 transition-all"
                                            >
                                              <span>Choisir</span>
                                              <ChevronRight size={13} />
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              /* VUE CARTES GRILLES DES ÉLÈVES */
                              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                                {(selectedClassId ? classStudents : studentResults).map(student => {
                                  const matricule = student.reference_number || student.code || student.id.substring(0, 8);
                                  const className = student?.classes?.name || classes.find(c => c.id === selectedClassId)?.name || `Sans ${terminology.class.toLowerCase()}`;
                                  const htgBal = Number(student.wallet_balance_htg) || 0;
                                  const usdBal = Number(student.wallet_balance_usd) || 0;

                                  return (
                                    <button 
                                      key={student.id}
                                      onClick={() => handleSelectStudent(student)}
                                      className="w-full text-left p-3.5 bg-white hover:bg-indigo-50/70 border border-slate-200/90 hover:border-indigo-300 rounded-xl flex flex-col justify-between gap-3 group transition-all shadow-2xs hover:shadow-sm"
                                    >
                                      <div className="flex items-start justify-between gap-2 w-full">
                                        <div className="flex items-center gap-2.5">
                                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-50 to-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center border border-indigo-200/70 shadow-2xs group-hover:scale-105 transition-transform shrink-0">
                                            {student.last_name?.charAt(0) || '?'}
                                          </div>
                                          <div>
                                            <p className="font-black text-slate-900 text-xs sm:text-sm group-hover:text-indigo-700 transition-colors line-clamp-1">
                                              {formatStudentName(student.last_name, student.first_name).fullName}
                                            </p>
                                            <span className="text-[11px] font-bold text-slate-500">
                                              {className}
                                            </span>
                                          </div>
                                        </div>
                                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 font-mono text-[9px] font-bold rounded border border-slate-200 shrink-0">
                                          #{matricule}
                                        </span>
                                      </div>

                                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 w-full">
                                        <div className="text-[10px] font-bold text-slate-500">
                                          Solde:{' '}
                                          <span className={`font-mono ${htgBal > 0 ? 'text-emerald-700 font-black' : 'text-slate-400'}`}>
                                            {htgBal.toLocaleString()} HTG
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1 text-indigo-600 font-bold text-[11px] group-hover:translate-x-0.5 transition-transform">
                                          <span>Sélectionner</span>
                                          <ChevronRight size={14} />
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )
                          ) : (
                            <div className="p-8 text-center space-y-1">
                              <p className="text-xs font-black text-slate-600">Aucun {terminology.student.toLowerCase()} trouvé</p>
                              <p className="text-[11px] text-slate-400">Veuillez ajuster votre filtre ou saisir un autre terme de recherche.</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* SELECTED STUDENT VIP CARD */
              <div className="bg-gradient-to-r from-indigo-50/70 via-white to-purple-50/50 border border-indigo-100 rounded-2xl p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 bg-gradient-to-tr from-indigo-600 to-violet-600 text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-md shadow-indigo-200 shrink-0">
                    {selectedStudent.last_name?.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-slate-900 text-base">
                        {formatStudentName(selectedStudent.last_name, selectedStudent.first_name).fullName}
                      </h4>
                      <BadgeCheck size={16} className="text-emerald-500 shrink-0" />
                      {(selectedStudent.reference_number || selectedStudent.code) && (
                        <span className="text-[10px] font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                          #{selectedStudent.reference_number || selectedStudent.code}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-indigo-700 mt-0.5">
                      Matricule: <span className="font-mono text-slate-800 font-bold">{selectedStudent.reference_number || selectedStudent.code || selectedStudent.id.substring(0,8)}</span> • Classe: <span className="font-black text-slate-900">{selectedStudent.effectiveClassName}</span>
                    </p>
                  </div>
                </div>

                {/* WALLET BALANCE BADGES & STATUS */}
                <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
                  {/* HTG Wallet Badge */}
                  <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-black transition-all ${
                    (Number(selectedStudent.wallet_balance_htg) || 0) > 0 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-2xs' 
                      : 'bg-slate-100/90 text-slate-500 border-slate-200'
                  }`}>
                    <Wallet size={14} className={(Number(selectedStudent.wallet_balance_htg) || 0) > 0 ? 'text-emerald-600' : 'text-slate-400'} />
                    <span>Portefeuille G:</span>
                    <span className="font-mono font-black">{(Number(selectedStudent.wallet_balance_htg) || 0).toLocaleString()} HTG</span>
                  </div>

                  {/* USD Wallet Badge */}
                  <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-black transition-all ${
                    (Number(selectedStudent.wallet_balance_usd) || 0) > 0 
                      ? 'bg-blue-50 text-blue-800 border-blue-200 shadow-2xs' 
                      : 'bg-slate-100/90 text-slate-500 border-slate-200'
                  }`}>
                    <DollarSign size={14} className={(Number(selectedStudent.wallet_balance_usd) || 0) > 0 ? 'text-blue-600' : 'text-slate-400'} />
                    <span>Portefeuille $:</span>
                    <span className="font-mono font-black">{(Number(selectedStudent.wallet_balance_usd) || 0).toLocaleString()} USD</span>
                  </div>

                  <button
                    type="button"
                    onClick={refreshStudentWallet}
                    title="Actualiser le solde portefeuille"
                    className="p-2 bg-white hover:bg-slate-100 text-slate-600 hover:text-indigo-600 rounded-xl border border-slate-200 shadow-2xs transition-colors"
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* STEP 2: CATALOG ITEMS */}
          <section className={`bg-white p-5 rounded-3xl border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] space-y-5 transition-all duration-300 ${!selectedStudent ? 'opacity-50 grayscale-[40%] pointer-events-none' : 'opacity-100'}`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center text-xs font-black shadow-sm shadow-emerald-200">
                  2
                </span>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Articles & Fournitures Scolaires
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Cliquez sur un article pour l'ajouter directement au panier
                  </p>
                </div>
              </div>

              {/* SEARCH INPUT & VIEW SWITCHER */}
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-60">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input 
                    type="text" 
                    placeholder="Filtrer un article..." 
                    className="w-full pl-9 pr-8 py-2 bg-slate-50/80 hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all min-h-[38px]"
                    value={itemSearch}
                    onChange={e => setItemSearch(e.target.value)}
                  />
                  {itemSearch && (
                    <button onClick={() => setItemSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200/60">
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* VUE TABLEAU / VUE CARTES GRILLES */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => setCatalogViewMode('grid')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      catalogViewMode === 'grid'
                        ? 'bg-white text-slate-950 shadow-xs border border-slate-200/80 font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Vue Cartes grilles"
                  >
                    <LayoutGrid size={14} className={catalogViewMode === 'grid' ? 'text-emerald-600' : 'text-slate-500'} />
                    <span className="hidden sm:inline">Cartes grilles</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogViewMode('table')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      catalogViewMode === 'table'
                        ? 'bg-white text-slate-950 shadow-xs border border-slate-200/80 font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Vue Tableau"
                  >
                    <List size={14} className={catalogViewMode === 'table' ? 'text-emerald-600' : 'text-slate-500'} />
                    <span className="hidden sm:inline">Tableau</span>
                  </button>
                </div>
              </div>
            </div>

            {/* CATEGORY PILLS */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const active = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs whitespace-nowrap transition-all border shrink-0 min-h-[42px] ${
                      active 
                        ? 'bg-slate-950 text-white border-slate-950 shadow-md shadow-slate-950/20 scale-[1.02]' 
                        : 'bg-slate-50/80 border-slate-200/80 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon size={15} className={active ? 'text-emerald-400' : 'text-slate-400'} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* DUAL VIEW: TABLEAU OU CARTES GRILLES */}
            {catalogViewMode === 'table' ? (
              /* VUE TABLEAU DU CATALOGUE */
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 text-[10px] font-black uppercase text-slate-500 tracking-wider">Article & Désignation</th>
                      <th className="py-3 px-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">Catégorie</th>
                      <th className="py-3 px-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">Prix unitaire</th>
                      <th className="py-3 px-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">Stock instantané</th>
                      <th className="py-3 px-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">Disponibilité</th>
                      <th className="py-3 px-4 text-[10px] font-black uppercase text-slate-500 tracking-wider text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCatalog.map(item => {
                      const cartItem = cart.find(c => c.catalog_item_id === item.id);
                      const inCartQty = cartItem ? cartItem.quantity : 0;
                      const initialStock = Number(item.stock_quantity ?? 0);
                      // Instant stock dynamically reduced by items currently in the cart
                      const instantStock = Math.max(0, initialStock - inCartQty);
                      const isOutOfStock = instantStock <= 0;
                      const isLowStock = !isOutOfStock && instantStock <= (item.low_stock_threshold || 5);
                      const isUniform = item.category?.toLowerCase().includes('uniforme');
                      const isBook = item.category?.toLowerCase().includes('livre');

                      return (
                        <tr
                          key={item.id}
                          onClick={() => addToCart(item)}
                          className={`hover:bg-emerald-50/50 transition-colors cursor-pointer group ${
                            inCartQty > 0 ? 'bg-indigo-50/30' : ''
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 ${
                                isUniform 
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                                  : isBook 
                                  ? 'bg-amber-50 text-amber-800 border-amber-200' 
                                  : 'bg-slate-50 text-slate-700 border-slate-200'
                              }`}>
                                {isUniform ? <Shirt size={15} /> : isBook ? <BookOpen size={15} /> : <Package size={15} />}
                              </div>
                              <div>
                                <p className="font-extrabold text-slate-900 text-xs sm:text-sm group-hover:text-emerald-700 transition-colors">
                                  {item.label}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] font-bold text-slate-400">
                                    Unité: {item.unit_measure || 'Pièce'}
                                  </span>
                                  {inCartQty > 0 && (
                                    <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-800 text-[10px] font-black rounded-md border border-indigo-200">
                                      {inCartQty} au panier
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2.5 py-0.5 font-black text-[9px] uppercase tracking-wider rounded-lg border inline-block ${
                              isUniform 
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                                : isBook 
                                ? 'bg-amber-50 text-amber-800 border-amber-200' 
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {item.category}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-mono font-black text-slate-900 text-sm">
                              {item.unit_price.toLocaleString()} <span className="text-[11px] font-bold text-slate-500">{item.currency || 'HTG'}</span>
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-col gap-0.5">
                              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold inline-flex items-center gap-1.5 border w-fit ${
                                isOutOfStock 
                                  ? 'bg-amber-100/80 text-amber-900 border-amber-300' 
                                  : isLowStock
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  isOutOfStock ? 'bg-amber-600 animate-pulse' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}></span>
                                {instantStock > 0 ? `${instantStock} en stock` : '0 disponible'}
                              </span>
                              {inCartQty > 0 && (
                                <span className="text-[9px] font-bold text-slate-500 ml-1">
                                  Initial: {initialStock}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {isOutOfStock ? (
                              <span className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
                                <Clock size={12} className="text-amber-600 shrink-0" />
                                <span>Précommande active</span>
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                                <Check size={12} className="shrink-0" />
                                <span>Immédiat</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isOutOfStock ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToCart(item);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-black text-xs inline-flex items-center gap-1.5 border border-amber-300 shadow-2xs transition-all cursor-pointer"
                                title="Ajouter en précommande / livraison différée"
                              >
                                <Clock size={13} />
                                <span>Précommander</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToCart(item);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1 shadow-2xs group-hover:scale-105 transition-all cursor-pointer"
                              >
                                <Plus size={14} />
                                <span>Ajouter</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* CATALOG GRID (VUE CARTES GRILLES) */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {filteredCatalog.map(item => {
                  const cartItem = cart.find(c => c.catalog_item_id === item.id);
                  const inCartQty = cartItem ? cartItem.quantity : 0;
                  const initialStock = Number(item.stock_quantity ?? 0);
                  // Instant stock dynamically reduced by items currently in the cart
                  const instantStock = Math.max(0, initialStock - inCartQty);
                  const isOutOfStock = instantStock <= 0;
                  const isLowStock = !isOutOfStock && instantStock <= (item.low_stock_threshold || 5);
                  const isUniform = item.category?.toLowerCase().includes('uniforme');
                  const isBook = item.category?.toLowerCase().includes('livre');

                  return (
                    <button 
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className={`p-4.5 rounded-2xl border transition-all text-left group flex flex-col justify-between h-full min-h-[142px] relative overflow-hidden active:scale-98 shadow-2xs hover:shadow-md cursor-pointer ${
                        inCartQty > 0
                          ? 'ring-2 ring-indigo-500/20 bg-indigo-50/20'
                          : ''
                      } ${
                        isOutOfStock 
                          ? 'bg-gradient-to-br from-amber-50/50 via-white to-amber-50/20 border-amber-200/90 hover:border-amber-400' 
                          : isLowStock
                          ? 'bg-white border-amber-200/70 hover:border-amber-400'
                          : 'bg-white border-slate-200/80 hover:border-emerald-500 hover:-translate-y-0.5'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <span className={`px-2.5 py-0.5 font-black text-[9px] uppercase tracking-wider rounded-lg border ${
                            isUniform 
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                              : isBook 
                              ? 'bg-amber-50 text-amber-800 border-amber-200' 
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {item.category}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {inCartQty > 0 && (
                              <span className="px-2 py-0.5 rounded-lg text-[9px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                                {inCartQty} panier
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1.5 border ${
                              isOutOfStock 
                                ? 'bg-amber-100/90 text-amber-900 border-amber-300' 
                                : isLowStock
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                isOutOfStock ? 'bg-amber-600 animate-pulse' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}></span>
                              {instantStock > 0 ? `${instantStock} dispo` : '0 dispo (Différé)'}
                            </span>
                          </div>
                        </div>

                        <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm leading-snug group-hover:text-emerald-700 transition-colors line-clamp-2">
                          {item.label}
                        </h4>
                      </div>

                      <div className="pt-3 border-t border-slate-100 mt-3 flex items-end justify-between">
                        <div>
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Prix unitaire</p>
                          <p className="text-base sm:text-lg font-black text-slate-900 font-mono tracking-tight">
                            {item.unit_price.toLocaleString()} <span className="text-[11px] font-bold text-slate-500">{item.currency || 'HTG'} / {item.unit_measure || 'Pièce'}</span>
                          </p>
                        </div>

                        {isOutOfStock ? (
                          <div className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-950 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors flex items-center gap-1.5 text-[11px] font-black border border-amber-300 shadow-2xs">
                            <Clock size={13} />
                            <span>Précommander</span>
                          </div>
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-all flex items-center justify-center font-black border border-emerald-100 group-hover:shadow-sm group-hover:scale-105">
                            <Plus size={18} />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {filteredCatalog.length === 0 && (
              <div className="col-span-full py-16 bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-center space-y-2">
                <Package size={32} className="mx-auto text-slate-300" />
                <p className="text-xs font-black text-slate-500">Aucun article trouvé dans cette sélection</p>
                <p className="text-[11px] text-slate-400">Essayez un autre mot-clé ou changez de catégorie.</p>
              </div>
            )}
          </section>

        </div>

        {/* FLOATING ACTION BAR FOR MOBILE WHEN IN CATALOG TAB WITH CART ITEMS */}
        {totalCartCount > 0 && (
          <div className="lg:hidden fixed bottom-4 left-4 right-4 z-50 bg-slate-950 text-white p-3.5 rounded-2xl shadow-2xl flex items-center justify-between border border-slate-800 animate-in slide-in-from-bottom-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center font-black text-sm border border-emerald-500/30">
                {totalCartCount}
              </div>
              <div>
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Panier ({totalCartCount} articles)</p>
                <p className="text-base font-black text-white font-mono">{cartTotals.convertedTotalHTG.toLocaleString()} HTG</p>
              </div>
            </div>
            <button 
              onClick={() => setMobileTab('cart')}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-2 active:scale-95 transition-all"
            >
              <span>Voir Panier</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}

      </div>

      {/* RIGHT PANEL: CART & PAYMENT */}
      <div className={`w-full lg:w-5/12 xl:w-4/12 flex-col h-full bg-slate-950 text-white overflow-y-auto ${mobileTab === 'cart' ? 'flex' : 'hidden lg:flex'}`}>
        
        {/* PANEL HEADER */}
        <div className="p-5 border-b border-slate-800/90 bg-slate-950/90 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {checkoutStep === 'payment' && (
              <button 
                onClick={() => setCheckoutStep('cart')} 
                className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center border border-slate-800"
                title="Retour au panier"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div>
              <h3 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                <ShoppingCart size={18} className="text-emerald-400" />
                {checkoutStep === 'cart' ? 'Panier d\'Achat' : 'Encaissement & Règlement'}
              </h3>
              <p className="text-[10px] font-bold text-slate-400">
                {checkoutStep === 'cart' ? `${totalCartCount} article(s) sélectionné(s)` : 'Sélectionnez la méthode de règlement'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {cart.length > 0 && checkoutStep === 'cart' && (
              <button 
                onClick={() => setCart([])}
                className="px-2.5 py-1 text-[10px] font-black text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors uppercase tracking-wider flex items-center gap-1"
              >
                <Trash2 size={12} />
                <span>Vider</span>
              </button>
            )}
          </div>
        </div>

        {/* CART STEP CONTENT */}
        {checkoutStep === 'cart' ? (
          <div className="flex-1 flex flex-col justify-between p-4 sm:p-5 space-y-6 overflow-y-auto">
            <div className="space-y-3 flex-1">
              {cart.length === 0 ? (
                <div className="py-24 text-center text-slate-500 space-y-3">
                  <div className="w-16 h-16 bg-slate-900/80 rounded-3xl flex items-center justify-center mx-auto text-slate-600 border border-slate-800 shadow-inner">
                    <ShoppingCart size={28} />
                  </div>
                  <p className="text-sm font-black text-slate-300">Votre panier est vide</p>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                    Sélectionnez un élève puis cliquez sur les articles du catalogue pour les ajouter au panier.
                  </p>
                </div>
              ) : (
                cart.map((item, idx) => (
                  <div key={idx} className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800/90 hover:border-slate-700/80 transition-all flex flex-col gap-3 shadow-sm">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-white text-xs sm:text-sm leading-snug">{item.label}</h4>
                          {item.is_deferred && (
                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md text-[9px] font-black tracking-tight flex items-center gap-1">
                              <Clock size={10} /> Livraison Différée
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 font-mono mt-0.5">
                          PU: {item.unit_price.toLocaleString()} {item.currency} / {item.unit_measure || 'Pièce'}
                        </p>
                      </div>
                      <button 
                        onClick={() => removeFromCart(item.catalog_item_id)} 
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all min-w-[32px] min-h-[32px] flex items-center justify-center"
                        title="Retirer cet article"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/70">
                      <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                        <button 
                          onClick={() => updateQuantity(item.catalog_item_id, (item.unit_measure?.toLowerCase().includes('aune') || item.unit_measure?.toLowerCase().includes('mètre')) ? -0.5 : -1)} 
                          className="w-7 h-7 flex items-center justify-center bg-slate-900 text-slate-200 hover:bg-slate-800 rounded-lg active:scale-95 transition-all text-xs font-bold"
                          title="Diminuer"
                        >
                          <Minus size={13} />
                        </button>
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          value={item.quantity}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val > 0) {
                              setDirectQuantity(item.catalog_item_id, val);
                            }
                          }}
                          className="w-14 bg-slate-900 text-emerald-400 font-mono font-black text-center text-xs py-1 border border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500"
                        />
                        <button 
                          onClick={() => updateQuantity(item.catalog_item_id, (item.unit_measure?.toLowerCase().includes('aune') || item.unit_measure?.toLowerCase().includes('mètre')) ? 0.5 : 1)} 
                          className="w-7 h-7 flex items-center justify-center bg-slate-900 text-slate-200 hover:bg-slate-800 rounded-lg active:scale-95 transition-all text-xs font-bold"
                          title="Augmenter"
                        >
                          <Plus size={13} />
                        </button>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1.5">
                          {item.unit_measure || 'Unité'}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[9px] font-black text-slate-500 block uppercase tracking-wider">Total Ligne</span>
                        <span className="text-sm sm:text-base font-black text-emerald-400 font-mono">
                          {(item.unit_price * item.quantity).toLocaleString()} <span className="text-[10px] font-normal text-slate-400">{item.currency}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={cartEndRef} />
            </div>

            {/* TOTALS AND PROCEED BUTTON */}
            <div className="space-y-3.5 pt-3 border-t border-slate-800/90 mt-auto sticky bottom-0 bg-slate-950/95 p-1">
              <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 space-y-2 shadow-lg">
                <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                  <span>Articles au panier:</span>
                  <span className="text-white font-mono font-black">{totalCartCount}</span>
                </div>
                <div className="flex justify-between items-end pt-2 border-t border-slate-800">
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Montant Total Net</p>
                    <p className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight">
                      {cartTotals.convertedTotalHTG.toLocaleString()} <span className="text-xs text-slate-400">HTG</span>
                    </p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setCheckoutStep('payment')}
                disabled={cart.length === 0 || !selectedStudent}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm tracking-tight rounded-2xl shadow-xl shadow-emerald-500/20 active:scale-98 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[52px]"
              >
                <span>Procéder à l'Encaissement</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        ) : (
          /* PAYMENT STEP CONTENT */
          <div className="flex-1 flex flex-col justify-between p-4 sm:p-5 space-y-6 overflow-y-auto">
            <div className="space-y-5">
              
              {/* MIXED CURRENCY WARNING */}
              {hasMixedCurrencies && (
                <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-2xl flex items-start gap-3">
                  <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-amber-200 leading-relaxed">
                    Devises mixtes détectées. Le paiement global sera converti et perçu en Gourdes (HTG).
                  </p>
                </div>
              )}

              {/* PAYMENT METHOD SELECTOR */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                    <Wallet size={14} className="text-emerald-400" />
                    Mode de règlement
                  </label>
                  {paymentMethod === 'Portefeuille' && (
                    <span className="text-[10px] font-bold text-slate-400">
                      Solde élève: <strong className="text-emerald-400 font-mono">{studentWallet.toLocaleString()} {paymentCurrency}</strong>
                    </span>
                  )}
                </div>
                
                {/* Modern Grid Selector */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {activePaymentMethods.map(m => {
                    const active = paymentMethod === m.code;
                    const isWallet = m.code === 'Portefeuille';
                    const walletInsufficientForThis = isWallet && studentWallet < requiredAmount;
                    
                    const Icon = m.code === 'Cash' ? Banknote 
                      : m.code === 'MonCash' || m.code === 'Natcash' ? Smartphone 
                      : m.code === 'Chèque' ? Receipt 
                      : m.code === 'Portefeuille' ? Wallet 
                      : m.code === 'Carte' ? CreditCard 
                      : Landmark;

                    return (
                      <button
                        key={m.code}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(m.code);
                          setBankName('');
                          setReferenceNumber('');
                          setDepositDate(getLocalTodayString());
                          setReceivedCash('');
                          if (m.supported_currencies && m.supported_currencies.length === 1) {
                            setPaymentCurrency(m.supported_currencies[0]);
                          }
                        }}
                        className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between gap-1.5 min-h-[68px] ${
                          active
                            ? 'bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border-emerald-500 text-white shadow-md shadow-emerald-950/40'
                            : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850'
                        } ${walletInsufficientForThis ? 'border-dashed border-rose-800/60' : ''}`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <Icon size={18} className={active ? 'text-emerald-400' : walletInsufficientForThis ? 'text-rose-400' : 'text-slate-400'} />
                          {active && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/80" />
                          )}
                          {isWallet && (
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md font-mono ${
                              walletInsufficientForThis ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                            }`}>
                              {studentWallet.toLocaleString()} {paymentCurrency}
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-xs font-black truncate block">{m.name}</span>
                          {isWallet && walletInsufficientForThis && (
                            <span className="text-[9px] font-bold text-rose-400 block leading-tight">Solde insuffisant</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SPECIAL BLOCK: PORTEFEUILLE ÉLÈVE DÉTAIL & CONTRÔLE */}
              {paymentMethod === 'Portefeuille' && (
                <div className={`p-4 rounded-2xl border space-y-3 transition-all ${
                  studentWallet < requiredAmount 
                    ? 'bg-rose-950/30 border-rose-500/40 text-rose-200' 
                    : 'bg-gradient-to-br from-emerald-950/30 to-teal-950/20 border-emerald-500/30 text-emerald-200'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-xl ${studentWallet < requiredAmount ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        <Wallet size={20} />
                      </div>
                      <div>
                        <h5 className="font-black text-white text-xs">Portefeuille de l'élève</h5>
                        <p className="text-[11px] text-slate-400">
                          {formatStudentName(selectedStudent.last_name, selectedStudent.first_name).fullName} (#{selectedStudent.reference_number || selectedStudent.code || selectedStudent.id.substring(0,8)})
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={refreshStudentWallet}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] flex items-center gap-1 font-bold transition-all"
                    >
                      <RefreshCw size={11} /> Actualiser
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-center font-mono">
                    <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800">
                      <p className="text-[9px] uppercase font-sans font-bold text-slate-400">Solde Actuel</p>
                      <p className="text-xs font-black text-white mt-0.5">{studentWallet.toLocaleString()} {paymentCurrency}</p>
                    </div>
                    <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800">
                      <p className="text-[9px] uppercase font-sans font-bold text-slate-400">Montant Débité</p>
                      <p className="text-xs font-black text-rose-400 mt-0.5">-{requiredAmount.toLocaleString()} {paymentCurrency}</p>
                    </div>
                    <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800">
                      <p className="text-[9px] uppercase font-sans font-bold text-slate-400">Solde Restant</p>
                      <p className={`text-xs font-black mt-0.5 ${studentWallet - requiredAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {(studentWallet - requiredAmount).toLocaleString()} {paymentCurrency}
                      </p>
                    </div>
                  </div>

                  {studentWallet < requiredAmount ? (
                    <div className="flex items-start gap-2 bg-rose-500/20 p-2.5 rounded-xl border border-rose-500/30 text-rose-300 text-xs font-bold">
                      <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
                      <span>
                        Solde insuffisant pour finaliser cette transaction. Veuillez recharger le portefeuille de l'élève ou choisir un autre mode de paiement (Cash, Dépôt, etc.).
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 text-emerald-300 text-[11px] font-bold">
                      <Check size={14} className="shrink-0 text-emerald-400" />
                      <span>Le solde est suffisant. Le débit de {requiredAmount.toLocaleString()} {paymentCurrency} sera appliqué instantanément lors de la validation.</span>
                    </div>
                  )}
                </div>
              )}

              {/* SPECIAL BLOCK: CASH CHANGE CALCULATOR */}
              {paymentMethod === 'Cash' && (
                <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-3.5 shadow-inner">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Calculator size={14} className="text-emerald-400" />
                      Calculateur de monnaie (Cash)
                    </label>
                    <span className="text-[10px] font-bold text-slate-500">Montant net: {requiredAmount.toLocaleString()} {paymentCurrency}</span>
                  </div>

                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        placeholder={`Montant remis en ${paymentCurrency}...`}
                        value={receivedCash}
                        onChange={(e) => setReceivedCash(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 focus:border-emerald-500 text-white rounded-xl text-sm font-bold font-mono outline-none"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 font-mono">
                        {paymentCurrency}
                      </span>
                    </div>

                    {/* Quick fill chips */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setReceivedCash(requiredAmount.toString())}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold transition-colors"
                      >
                        Montant exact ({requiredAmount.toLocaleString()})
                      </button>
                      {[100, 500, 1000, 2500, 5000].map(addVal => {
                        const calculated = Math.ceil(requiredAmount / addVal) * addVal;
                        if (calculated <= requiredAmount) return null;
                        return (
                          <button
                            key={addVal}
                            type="button"
                            onClick={() => setReceivedCash(calculated.toString())}
                            className="px-2 py-1 bg-slate-800/80 hover:bg-slate-750 text-slate-400 hover:text-white rounded-lg text-[10px] font-bold font-mono transition-colors"
                          >
                            {calculated.toLocaleString()}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Change output */}
                  {receivedCash && !isNaN(parseFloat(receivedCash)) && (
                    <div className={`p-3 rounded-xl border flex items-center justify-between font-mono ${
                      parseFloat(receivedCash) >= requiredAmount 
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' 
                        : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                    }`}>
                      <span className="text-xs font-bold font-sans">
                        {parseFloat(receivedCash) >= requiredAmount ? 'Monnaie à rendre au client :' : 'Montant insuffisant (reste à payer) :'}
                      </span>
                      <span className="text-sm font-black">
                        {Math.abs(parseFloat(receivedCash) - requiredAmount).toLocaleString()} {paymentCurrency}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Instructions ou compte pour la méthode active */}
              {(currentMethodConfig?.account_info || currentMethodConfig?.instructions) && paymentMethod !== 'Cash' && paymentMethod !== 'Portefeuille' && (
                <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-2xl text-xs space-y-1.5 text-slate-300">
                  {currentMethodConfig.account_info && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px] font-bold">Compte officiel / Marchand :</span>
                      <span className="font-mono text-emerald-400 font-black px-2 py-0.5 bg-slate-950 rounded-lg border border-slate-800">
                        {currentMethodConfig.account_info}
                      </span>
                    </div>
                  )}
                  {currentMethodConfig.instructions && (
                    <p className="text-[11px] text-slate-400 leading-relaxed flex items-start gap-1.5">
                      <Info size={13} className="shrink-0 mt-0.5 text-slate-400" />
                      <span>{currentMethodConfig.instructions}</span>
                    </p>
                  )}
                </div>
              )}

              {/* BANK DETAILS / CHEQUE / REFERENCE / MOBILE MONEY */}
              {Boolean(currentMethodConfig?.requires_reference || currentMethodConfig?.requires_bank || paymentMethod === 'Chèque' || paymentMethod === 'Dépôt Bancaire' || paymentMethod === 'MonCash' || paymentMethod === 'Natcash' || paymentMethod === 'Carte') && (
                <div className="space-y-4 p-4 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-inner">
                  {Boolean(currentMethodConfig?.requires_bank || paymentMethod === 'Chèque' || paymentMethod === 'Dépôt Bancaire') && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                        <Landmark size={13} className="text-slate-400" />
                        Institution Bancaire
                      </label>
                      <div className="relative">
                        <select 
                          required 
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-700 text-white rounded-xl text-xs font-bold outline-none focus:border-emerald-500 appearance-none" 
                          value={bankName} 
                          onChange={(e) => {
                            const newBank = e.target.value;
                            setBankName(newBank);
                            if (referenceNumber) verifyReference(referenceNumber, newBank);
                          }} 
                        >
                          <option value="" disabled>Sélectionner une banque</option>
                          {(schoolDetails?.global_settings?.banks && schoolDetails?.global_settings?.banks?.length > 0) ? (
                            schoolDetails.global_settings.banks.map((b: string) => (
                              <option key={b} value={b}>{b}</option>
                            ))
                          ) : (
                            <>
                              <option value="BUH">BUH (Banque de l'Union Haïtienne)</option>
                              <option value="SOGEBANK">SOGEBANK</option>
                              <option value="UNIBANK">UNIBANK</option>
                              <option value="BNC">BNC (Banque Nationale de Crédit)</option>
                              <option value="CAPITAL_BANK">Capital Bank</option>
                            </>
                          )}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                      </div>
                    </div>
                  )}

                  {/* Optional Issuer Name for Cheque */}
                  {paymentMethod === 'Chèque' && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1">
                        Nom de l'émetteur du chèque
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Jean Baptiste (Parent)"
                        value={checkIssuerName}
                        onChange={(e) => setCheckIssuerName(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 focus:border-emerald-500 text-white rounded-xl text-xs font-bold outline-none"
                      />
                    </div>
                  )}

                  {/* Optional Phone Number for MonCash / Natcash */}
                  {(paymentMethod === 'MonCash' || paymentMethod === 'Natcash') && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1">
                        Numéro de téléphone expéditeur ({paymentMethod})
                      </label>
                      <input
                        type="tel"
                        placeholder="Ex: +509 3700-0000"
                        value={senderPhone}
                        onChange={(e) => setSenderPhone(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 focus:border-emerald-500 text-white rounded-xl text-xs font-bold outline-none font-mono"
                      />
                    </div>
                  )}
                  
                  {Boolean(currentMethodConfig?.requires_reference || paymentMethod === 'MonCash' || paymentMethod === 'Natcash' || paymentMethod === 'Chèque' || paymentMethod === 'Dépôt Bancaire' || paymentMethod === 'Carte') && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1">
                        {paymentMethod === 'MonCash' ? 'N° Transaction MonCash' 
                          : paymentMethod === 'Natcash' ? 'N° Transaction Natcash' 
                          : paymentMethod === 'Chèque' ? 'N° du chèque' 
                          : paymentMethod === 'Carte' ? 'N° Autorisation / Ticket TPE'
                          : 'N° Bordereau / Transaction / Référence'}
                      </label>
                      <div className="relative">
                        <input 
                          type="text" 
                          required 
                          className={`w-full px-4 py-3 bg-slate-950 border ${refError ? 'border-rose-500 focus:border-rose-500' : 'border-slate-700 focus:border-emerald-500'} text-white rounded-xl text-xs font-bold outline-none font-mono`} 
                          placeholder={paymentMethod === 'MonCash' ? 'Ex: 9A8B7C6D' : paymentMethod === 'Natcash' ? 'Ex: NAT-445566' : 'Ex: BDR-99881122'}
                          value={referenceNumber} 
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            setReferenceNumber(val);
                            verifyReference(val, bankName);
                          }} 
                        >
                        </input>
                        {isCheckingRef && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-slate-400" size={16} />}
                      </div>
                      {refError && <p className="text-[10px] text-rose-400 font-bold mt-1">{refError}</p>}
                    </div>
                  )}

                  {(paymentMethod === 'Dépôt Bancaire' || currentMethodConfig?.requires_deposit_date) && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1">
                        Date effective du versement
                      </label>
                      <input 
                        type="date" 
                        required 
                        max={getLocalTodayString()}
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 text-white rounded-xl text-xs font-bold outline-none focus:border-emerald-500" 
                        value={depositDate} 
                        onChange={(e) => {
                          const restriction = isRestrictedBankDate(e.target.value);
                          if (restriction.restricted) {
                            toast.error(`Opération impossible : ${restriction.reason}.`);
                            return;
                          }
                          setDepositDate(e.target.value);
                        }} 
                      />
                    </div>
                  )}
                </div>
              )}

              {/* CURRENCY TOGGLE */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1">Devise d'encaissement</label>
                <div className="flex gap-2 p-1.5 bg-slate-900 rounded-xl border border-slate-800">
                  <button 
                    onClick={() => setPaymentCurrency('HTG')}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-black transition-all ${
                      paymentCurrency === 'HTG' 
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Gourdes (HTG)
                  </button>
                  <button 
                    onClick={() => setPaymentCurrency('USD')}
                    disabled={hasMixedCurrencies || !canPayInUSD || paymentMethod === 'MonCash'}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-black transition-all ${
                      paymentCurrency === 'USD' 
                        ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20' 
                        : 'text-slate-400 hover:text-white'
                    } ${hasMixedCurrencies || !canPayInUSD || paymentMethod === 'MonCash' ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    Dollars (USD)
                  </button>
                </div>
              </div>
            </div>

            {/* PAYMENT VALIDATION BUTTON */}
            <div className="space-y-4 pt-4 border-t border-slate-800/90">
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center justify-between shadow-lg">
                <span className="text-xs font-bold text-slate-400">Total Net Perçu:</span>
                <span className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
                  {paymentCurrency === 'HTG' 
                    ? `${cartTotals.convertedTotalHTG.toLocaleString()} HTG` 
                    : `${cartTotals.totalUSD.toLocaleString()} USD`}
                </span>
              </div>

              <button 
                onClick={handlePayment}
                disabled={cart.length === 0 || !selectedStudent || isSubmitting || !!refError || (paymentMethod === 'Portefeuille' && isWalletInsufficient)}
                className={`w-full py-4 font-black text-sm tracking-tight rounded-2xl shadow-xl active:scale-98 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[54px] ${
                  paymentMethod === 'Portefeuille' && isWalletInsufficient
                    ? 'bg-rose-600/60 text-white cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/25'
                }`}
              >
                {isSubmitting ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : paymentMethod === 'Portefeuille' && isWalletInsufficient ? (
                  <AlertCircle size={20} className="text-rose-200" />
                ) : paymentMethod === 'Portefeuille' ? (
                  <Wallet size={20} />
                ) : (
                  <Banknote size={20} />
                )}
                <span>
                  {paymentMethod === 'Portefeuille' && isWalletInsufficient
                    ? `Solde portefeuille insuffisant (${studentWallet.toLocaleString()} ${paymentCurrency})`
                    : `Valider l'Encaissement (${requiredAmount.toLocaleString()} ${paymentCurrency})`}
                </span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default SuppliesPOS;
