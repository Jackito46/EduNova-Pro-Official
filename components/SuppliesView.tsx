import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, Plus, RefreshCw, Trash2, Calendar,
  ChevronDown, X, Package, DollarSign,
  UserCheck, CheckCircle2, CheckCircle,
  Loader2, AlertCircle, TrendingUp, History, 
  Printer, ArrowRight, ShieldCheck, BadgeCheck,
  ChevronRight, Clock, Receipt, Calculator, ShoppingBag, Tag,
  Settings, Edit2, Archive, ListFilter,
  Save, Sparkles, Filter, ArrowLeft, CreditCard,
  Truck, FileText, Building2, Layers, Zap, Wrench, Lock, LayoutGrid,
  SlidersHorizontal, BarChart3, Sliders, ArrowUpDown, ClipboardCheck,
  BookOpen, Shirt, PenTool, FlaskConical, Laptop, Armchair, Trophy,
  FileSpreadsheet, Eye, Minus
} from 'lucide-react';
import { toast } from 'sonner';
import { useSchool } from '../contexts/SchoolContext';
import { supabase } from '../supabase';
import { UserProfile, UserRole } from '../types';
import Modal from './Modal';
import { FluidLoadingState, SkeletonTable } from './SkeletonLoader';
import SuppliesPOS from './SuppliesPOS';
import { ModernSaleReceiptModal } from './ModernSaleReceiptModal';
import { InventoryAdjustmentModal } from './InventoryAdjustmentModal';
import { PrintableInventoryModal } from './PrintableInventoryModal';
import { AuditLogger } from '../utils/auditLogger';
import { formatStudentName } from '../utils/formatters';
import { AcademicSessionPill } from './AcademicSessionPill';
import { SelectPill, SelectOption } from './SelectPill';
import { DatePickerPill } from './DatePickerPill';

interface CatalogItem {
  id: string;
  label: string;
  unit_price: number;
  category: string;
  academic_year_id?: string;
  currency?: string;
  planned_exchange_rate?: number;
  stock_quantity?: number;
  low_stock_threshold?: number;
  discipline_name?: string | null;
  unit_measure?: string;
}

interface SupplyRecord {
  id: string;
  student_id: string;
  academic_year_id: string;
  catalog_item_id?: string;
  description: string;
  quantity?: number;
  total_amount: number;
  paid_amount?: number;
  transaction_id?: string;
  created_at?: string;
  student?: {
    first_name: string;
    last_name: string;
    class?: { name: string }
  };
  payments?: any[];
}

const CATEGORIES = [
  'Uniforme', 
  'Manuel', 
  'Fourniture', 
  'Service', 
  'Laboratoire & Sciences', 
  'Informatique & Tech', 
  'Mobilier & Entretien', 
  'Sport & Loisirs', 
  'Papeterie'
];

const SuppliesView: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { terminology, currentCampusId, campuses } = useSchool();
  const siegeCampus = campuses?.find(
    (c) =>
      c.name.toLowerCase().includes("siège") ||
      c.name.toLowerCase().includes("siege")
  );
  const siegeCampusId = siegeCampus ? siegeCampus.id : null;
  const isSiegeActive = !user.campus_id && (!currentCampusId || currentCampusId === siegeCampusId);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'sales' | 'catalog' | 'pos' | 'inventory'>('sales');
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([]);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseMode, setPurchaseMode] = useState<'single' | 'batch'>('single');
  const [batchSupplier, setBatchSupplier] = useState<string>('');
  const [batchDate, setBatchDate] = useState<string>(
    new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]
  );
  const [batchItems, setBatchItems] = useState<Array<{ item_id: string; quantity: string; unit_cost: string }>>([
    { item_id: '', quantity: '10', unit_cost: '' }
  ]);
  const [supplierHistoryFilter, setSupplierHistoryFilter] = useState<string>('Tous');
  const [purchaseFormData, setPurchaseFormData] = useState({
    item_id: '',
    quantity: '',
    unit_cost: '',
    supplier: '',
    date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]
  });
  const [records, setRecords] = useState<SupplyRecord[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [isMigrating, setIsMigrating] = useState(false);
  const [showMigrateModal, setShowMigrateModal] = useState(false);
  const [migrateSourceId, setMigrateSourceId] = useState<string>('');
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [catalogSearchTerm, setCatalogSearchTerm] = useState('');
  const [dateFilterFrom, setDateFilterFrom] = useState('');
  const [dateFilterTo, setDateFilterTo] = useState('');
  const [activeCatalogCat, setActiveCatalogCat] = useState('Tous');
  const [selectedDisciplineFilter, setSelectedDisciplineFilter] = useState('Tous');
  const [salesStats, setSalesStats] = useState({ currentYear: 0, allTime: 0, receivedHTG: 0, receivedUSD: 0, receivedTotal: 0 });
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'low' | 'out' | 'ok'>('all');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('Tous');
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventorySubTab, setInventorySubTab] = useState<'stock' | 'purchases' | 'deliveries' | 'combined'>('stock');
  const [inventoryViewMode, setInventoryViewMode] = useState<'table' | 'grid'>('table');
  const [adjustingStockItem, setAdjustingStockItem] = useState<CatalogItem | null>(null);
  const [showInventorySheetModal, setShowInventorySheetModal] = useState<boolean>(false);
  const [editingPriceItem, setEditingPriceItem] = useState<{ id: string; label: string; current_price: number; new_price: string } | null>(null);
  const [updateCatalogPriceInPurchase, setUpdateCatalogPriceInPurchase] = useState<boolean>(false);
  const [newSellingPriceInPurchase, setNewSellingPriceInPurchase] = useState<string>('');

  const canEditPrices = useMemo(() => {
    const role = (user.role || '').toUpperCase();
    return ['SUPER_ADMIN', 'ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR', 'ACCOUNTANT', 'ECONOME', 'FINANCE', 'GESTIONNAIRE', 'COMPTABLE'].includes(role);
  }, [user.role]);
  const [catalogViewMode, setCatalogViewMode] = useState<'table' | 'grid'>('table');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  
  const [schoolDetails, setSchoolDetails] = useState<any>(null);
  const [cashierName, setCashierName] = useState<string>('');

  // Modales
  const [showModal, setShowModal] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState<SupplyRecord | null>(null);
  const [printJob, setPrintJob] = useState<any | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMigratingUnits, setIsMigratingUnits] = useState(false);
  const [modalClassId, setModalClassId] = useState('');
  const [availableStudents, setAvailableStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [existingSupply, setExistingSupply] = useState<any | null>(null);
  
  // Form Vente
  const [formData, setFormData] = useState({
    catalog_item_id: '',
    description: '',
    total_amount: '',
    payment_amount: '',
    payment_date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
    paid_amount_existing: 0
  });

  // Form Catalogue
  const [catalogFormData, setCatalogFormData] = useState({
    id: '',
    label: '',
    unit_price: '',
    category: 'Fourniture',
    currency: 'HTG',
    planned_exchange_rate: '132.50',
    stock_quantity: '',
    low_stock_threshold: '5',
    discipline_name: '',
    unit_measure: 'Pièce'
  });

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'record' | 'catalog'>('record');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch school details and cashier name
      const { data: profile } = await supabase.from('profiles').select('school_id, full_name').eq('id', user.id).single();
      if (profile) {
        setCashierName(profile.full_name || '');
        const { data: schoolData } = await supabase.from('schools').select('name, address, phone, logo_url, email').eq('id', profile.school_id).single();
        if (schoolData) setSchoolDetails(schoolData);
      }

      const { data: ayData, error: ayError } = await supabase
        .from('academic_years')
        .select('*')
        .eq('school_id', user.school_id)
        .order('label', { ascending: false });
      
      if (ayError) console.error("Erreur chargement années académiques:", ayError);

      let currentYearId = selectedYearId;
      if (ayData && ayData.length > 0) {
        const filtered = ayData.filter(y => y.status && y.status !== 'FUTURE' && y.status !== 'VIERGE' && y.label && y.label.trim() !== '');
        const finalYears = filtered;
        setAcademicYears(finalYears);
        
        const yearExists = finalYears.some(y => y.id === currentYearId);
        if (!currentYearId || !yearExists) {
          const active = finalYears.find(y => y.is_active || y.status === 'ACTIVE') || finalYears[0];
          currentYearId = active?.id || '';
          setSelectedYearId(currentYearId);
        }
      }

      let catData;
      try {
        let query = supabase.from('supply_catalog')
          .select('*')
          .eq('school_id', user.school_id);
          
        if (currentCampusId) {
          query = query.or(`campus_id.eq.${currentCampusId},campus_id.is.null`);
        }
          
        query = query.order('category', { ascending: true })
          .order('label', { ascending: true });
        
        if (currentYearId) {
          query = query.or(`academic_year_id.eq.${currentYearId},academic_year_id.is.null`);
        }
        
        const { data, error } = await query;
        
        if (error && (error.code === '42703' || error?.message?.includes('schema cache'))) {
          let fallback = supabase.from('supply_catalog')
            .select('*')
            .eq('school_id', user.school_id);
          if (currentCampusId) fallback = fallback.or(`campus_id.eq.${currentCampusId},campus_id.is.null`);
          fallback = fallback.order('category', { ascending: true })
            .order('label', { ascending: true });
            
          const fRes = await fallback;
          catData = fRes.data;
        } else {
          catData = data;
        }
      } catch (e) {
        let fallback = supabase.from('supply_catalog')
          .select('*')
          .eq('school_id', user.school_id);
        if (currentCampusId) fallback = fallback.or(`campus_id.eq.${currentCampusId},campus_id.is.null`);
        fallback = fallback.order('category', { ascending: true })
          .order('label', { ascending: true });
          
        const fRes = await fallback;
        catData = fRes.data;
      }
      if (catData) {
        const normalizedCatalog = catData.map((item: any) => ({
          ...item,
          unit_measure: getItemUnitMeasure(item)
        }));
        setCatalog(normalizedCatalog);
      }

      // 4. Fetch Purchase History (from expenses)
      let expensesQuery = supabase
        .from('expenses')
        .select('*')
        .eq('school_id', user.school_id);
      
      if (currentCampusId) {
        expensesQuery = expensesQuery.eq('campus_id', currentCampusId);
      }
      
      const { data: expensesData } = await expensesQuery
        .ilike('label', '%ACHAT STOCK%')
        .order('expense_date', { ascending: false });
      setPurchaseHistory(expensesData || []);

      let clsQuery = supabase
        .from('classes')
        .select('*')
        .eq('school_id', user.school_id);
        
      if (currentCampusId) {
        clsQuery = clsQuery.eq('campus_id', currentCampusId);
      }
      
      const { data: clsData } = await clsQuery.order('name');
      if (clsData) setClasses(clsData);

      if (selectedYearId) {
        let supData;
        try {
          let query = supabase.from('school_supplies')
            .select(`
              *,
              student:students(first_name, last_name, class:classes(name)),
              payments:supply_payments(*)
            `)
            .eq('school_id', user.school_id);
            
          if (currentCampusId) {
            query = query.or(`campus_id.eq.${currentCampusId},campus_id.is.null`);
          }
          
          query = query.order('created_at', { ascending: false });
          
          if (selectedYearId) {
            query = query.or(`academic_year_id.eq.${selectedYearId},academic_year_id.is.null`);
          }
          const { data, error } = await query;
          
          if (error && (error.code === '42703' || error.message?.includes('schema cache'))) {
            let fallback = supabase.from('school_supplies')
              .select(`
                *,
                student:students(first_name, last_name, class:classes(name)),
                payments:supply_payments(*)
              `)
              .eq('school_id', user.school_id);
            if (currentCampusId) fallback = fallback.or(`campus_id.eq.${currentCampusId},campus_id.is.null`);
            fallback = fallback.order('created_at', { ascending: false });
            
            const fRes = await fallback;
            supData = fRes.data;
          } else {
            supData = data;
          }
        } catch (e) {
          let fallback = supabase.from('school_supplies')
            .select(`
              *,
              student:students(first_name, last_name, class:classes(name)),
              payments:supply_payments(*)
            `)
            .eq('school_id', user.school_id);
          if (currentCampusId) fallback = fallback.or(`campus_id.eq.${currentCampusId},campus_id.is.null`);
          fallback = fallback.order('created_at', { ascending: false });
          
          const fRes = await fallback;
          supData = fRes.data;
        }
        
        let currentYearTotal = 0;
        let receivedHTG = 0;
        let receivedUSD = 0;
        let receivedTotal = 0;

        if (supData && supData.length > 0) {
           currentYearTotal = supData.filter((s: any) => s.status !== 'ANNULE').reduce((acc: any, s: any) => acc + Number(s.amount_htg_equivalent || s.total_amount || 0), 0);
           
           supData.forEach((s: any) => {
             if (s.status !== 'ANNULE' && s.payments) {
               s.payments.forEach((p: any) => {
                 const amt = Number(p.amount || 0);
                 const htgEq = Number(p.amount_htg_equivalent || p.amount || 0);
                 receivedTotal += htgEq;
                 if (p.currency === 'USD') receivedUSD += amt;
                 else receivedHTG += amt;
               });
             }
           });
        }

        setSalesStats({ currentYear: currentYearTotal, allTime: 0, receivedHTG, receivedUSD, receivedTotal });

        if (supData) {
          const enriched = supData.map(s => ({
            ...s,
            paid_amount: s.payments?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0
          }));
          setRecords(enriched);
        }
      }
    } catch (err: any) {
      console.error("Critical Load Error:", err.message);
    } finally {
      setLoading(false);
    }
  }, [user.school_id, selectedYearId, currentCampusId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const loadStudents = async () => {
      if (modalClassId && modalClassId.toLowerCase() !== 'all') {
        const { data } = await supabase
          .from('students')
          .select('id, first_name, last_name')
          .eq('class_id', modalClassId)
          .order('last_name');
        setAvailableStudents(data || []);
      }
    };
    loadStudents();
  }, [modalClassId]);

  // --- GESTION & ERGONOMIE DES FOURNISSEURS ET RÉAPPROVISIONNEMENTS ---
  const knownSuppliers = useMemo(() => {
    const defaults = ['HENRY DESCHAMPS', 'infostars', 'Maison Henri Deschamps', 'Fournitures Scolaires SA', 'Papeterie Centrale', 'Imprimerie Haïtienne'];
    const set = new Set<string>(defaults);
    purchaseHistory.forEach(p => {
      if (p.description) {
        const match = p.description.match(/Fournisseur:\s*([^.]+)/i);
        if (match && match[1]) {
          const name = match[1].trim();
          if (name) set.add(name);
        }
      }
    });
    return Array.from(set).sort();
  }, [purchaseHistory]);

  const getLastPurchaseInfo = useCallback((itemId: string) => {
    const item = catalog.find(i => i.id === itemId);
    if (!item) return null;

    const lastExp = purchaseHistory.find(p => p.label && p.label.toLowerCase().includes(item.label.toLowerCase()));
    if (!lastExp) return null;

    let supplier = '';
    let unitCost = 0;
    if (lastExp.description) {
      const suppMatch = lastExp.description.match(/Fournisseur:\s*([^.]+)/i);
      if (suppMatch && suppMatch[1]) supplier = suppMatch[1].trim();

      const costMatch = lastExp.description.match(/Coût unitaire:\s*([\d.]+)/i);
      if (costMatch && costMatch[1]) unitCost = parseFloat(costMatch[1]);
    }

    return {
      supplier,
      unitCost: unitCost || (item.unit_price ? Math.round(item.unit_price * 0.6) : 0),
      date: lastExp.expense_date,
      amount: lastExp.amount
    };
  }, [catalog, purchaseHistory]);

  const handleSelectPurchaseItem = (itemId: string) => {
    const item = catalog.find(i => i.id === itemId);
    const lastInfo = getLastPurchaseInfo(itemId);
    
    setPurchaseFormData(prev => ({
      ...prev,
      item_id: itemId,
      unit_cost: lastInfo?.unitCost ? lastInfo.unitCost.toString() : (item?.unit_price ? Math.round(item.unit_price * 0.6).toString() : prev.unit_cost),
      supplier: lastInfo?.supplier || prev.supplier || (knownSuppliers[0] || ''),
    }));
    setNewSellingPriceInPurchase(item?.unit_price ? item.unit_price.toString() : '');
    setUpdateCatalogPriceInPurchase(false);
  };

  const handleQuickRestock = (item: CatalogItem) => {
    const lastInfo = getLastPurchaseInfo(item.id);
    setPurchaseMode('single');
    setPurchaseFormData({
      item_id: item.id,
      quantity: '10',
      unit_cost: lastInfo?.unitCost ? lastInfo.unitCost.toString() : (item.unit_price ? Math.round(item.unit_price * 0.6).toString() : '0'),
      supplier: lastInfo?.supplier || (knownSuppliers[0] || ''),
      date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]
    });
    setNewSellingPriceInPurchase(item.unit_price ? item.unit_price.toString() : '');
    setUpdateCatalogPriceInPurchase(false);
    setShowPurchaseModal(true);
  };

  const handleSaveQuickPrice = async () => {
    if (!editingPriceItem || !canEditPrices) {
      toast.error("Autorisation insuffisante : Seule la Direction, l'Économe ou la Comptabilité peut modifier les prix.");
      return;
    }
    const newP = parseFloat(editingPriceItem.new_price);
    if (isNaN(newP) || newP <= 0) {
      toast.error("Veuillez saisir un prix de vente valide.");
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('supply_catalog')
        .update({ unit_price: newP })
        .eq('id', editingPriceItem.id)
        .eq('school_id', user.school_id);

      if (error) throw error;

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'settings',
        entity_id: editingPriceItem.id,
        details: { type: 'update_selling_price', previous: editingPriceItem.current_price, new: newP }
      });

      toast.success(`Succès : Nouveau prix de vente fixé à ${newP.toLocaleString()} HTG pour "${editingPriceItem.label}"`);
      setEditingPriceItem(null);
      fetchData();
    } catch (err: any) {
      toast.error("Erreur mise à jour prix : " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillLowStockBatch = () => {
    const lowOrOut = catalog.filter(i => (i.stock_quantity || 0) <= (i.low_stock_threshold || 5));
    if (lowOrOut.length === 0) {
      toast.info("Aucun article en alerte de stock bas ou en rupture !");
      return;
    }
    const rows = lowOrOut.map(i => {
      const lastInfo = getLastPurchaseInfo(i.id);
      const needed = Math.max(10, (i.low_stock_threshold || 5) * 3 - (i.stock_quantity || 0));
      return {
        item_id: i.id,
        quantity: needed.toString(),
        unit_cost: lastInfo?.unitCost ? lastInfo.unitCost.toString() : (i.unit_price ? Math.round(i.unit_price * 0.6).toString() : '0')
      };
    });
    setPurchaseMode('batch');
    setBatchItems(rows);
    if (!batchSupplier && knownSuppliers.length > 0) {
      setBatchSupplier(knownSuppliers[0]);
    }
    setShowPurchaseModal(true);
  };

  const handleRecordBatchPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchSupplier.trim()) {
      toast.error("Veuillez indiquer ou sélectionner un fournisseur.");
      return;
    }
    const validRows = batchItems.filter(r => r.item_id && parseInt(r.quantity) > 0);
    if (validRows.length === 0) {
      toast.error("Veuillez renseigner au moins un article avec une quantité supérieure à 0.");
      return;
    }

    setIsSubmitting(true);
    try {
      let successCount = 0;
      for (const row of validRows) {
        const item = catalog.find(i => i.id === row.item_id);
        if (!item) continue;

        const qty = parseInt(row.quantity);
        const cost = parseFloat(row.unit_cost) || 0;
        const total = qty * cost;

        // 1. Create Expense
        const { error: expError } = await supabase.from('expenses').insert([{
          school_id: user.school_id,
          campus_id: user.campus_id || currentCampusId || null,
          academic_year_id: selectedYearId,
          label: `ACHAT STOCK: ${item.label} (${qty} unités)`,
          amount: total,
          expense_date: batchDate,
          description: `Fournisseur: ${batchSupplier.trim()}. Coût unitaire: ${cost} G.`,
          category_legacy: 'Fournitures Scolaires', currency: 'HTG', exchange_rate_applied: 1, amount_htg_equivalent: total
        }]);
        if (expError) throw expError;

        // 2. Update Stock
        const newStock = (item.stock_quantity || 0) + qty;
        const { error: stockError } = await supabase
          .from('supply_catalog')
          .update({ stock_quantity: newStock })
          .eq('school_id', user.school_id)
          .eq('id', item.id);

        if (stockError) throw stockError;

        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: 'UPDATE',
          entity_type: 'settings',
          entity_id: item.id,
          details: { type: 'stock_replenishment', qty, previous: item.stock_quantity, new: newStock, supplier: batchSupplier.trim() }
        });
        successCount++;
      }

      toast.success(`Succès : ${successCount} article(s) réapprovisionné(s) auprès de "${batchSupplier.trim()}" !`);
      setShowPurchaseModal(false);
      fetchData();
    } catch (err: any) {
      toast.error("Erreur réapprovisionnement groupé : " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const item = catalog.find(i => i.id === purchaseFormData.item_id);
      if (!item) throw new Error("Article non trouvé");

      const qty = parseInt(purchaseFormData.quantity);
      const cost = parseFloat(purchaseFormData.unit_cost);
      const total = qty * cost;

      // 1. Create Expense
      const { error: expError } = await supabase.from('expenses').insert([{
        school_id: user.school_id,
        campus_id: user.campus_id || currentCampusId || null,
        academic_year_id: selectedYearId,
        label: `ACHAT STOCK: ${item.label} (${qty} unités)`,
        amount: total,
        expense_date: purchaseFormData.date,
        description: `Fournisseur: ${purchaseFormData.supplier}. Coût unitaire: ${cost} G.`,
        category_legacy: 'Fournitures Scolaires', currency: 'HTG', exchange_rate_applied: 1, amount_htg_equivalent: total
      }]);

      if (expError) throw expError;

      // 2. Update Stock & Optionally Selling Price
      const newStock = (item.stock_quantity || 0) + qty;
      const updatePayload: any = { stock_quantity: newStock };
      
      let priceMsg = "";
      if (canEditPrices && updateCatalogPriceInPurchase && parseFloat(newSellingPriceInPurchase) > 0) {
        const newSelling = parseFloat(newSellingPriceInPurchase);
        updatePayload.unit_price = newSelling;
        priceMsg = ` | Prix de vente mis à jour : ${newSelling.toLocaleString()} HTG`;
      }

      const { error: stockError } = await supabase
        .from('supply_catalog')
        .update(updatePayload)
        .eq('school_id', user.school_id)
        .eq('id', item.id);

      if (stockError) throw stockError;

      // 3. Log
      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'settings',
        entity_id: item.id,
        details: { type: 'stock_replenishment', qty, previous: item.stock_quantity, new: newStock, updatedSellingPrice: updatePayload.unit_price || item.unit_price }
      });

      toast.success("Stock réapprovisionné et dépense enregistrée" + priceMsg);
      setShowPurchaseModal(false);
      fetchData();
    } catch (err: any) {
      toast.error("Erreur réapprovisionnement: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getItemUnitMeasure = (item: any) => {
    if (item.unit_measure) return item.unit_measure;
    if (item.discipline_name) {
      const match = item.discipline_name.match(/\[Unité:\s*([^\]]+)\]/i);
      if (match && match[1]) return match[1].trim();
    }
    return 'Pièce';
  };

  const getItemCleanDiscipline = (item: any) => {
    if (!item.discipline_name) return null;
    const clean = item.discipline_name.replace(/\[Unité:[^\]]+\]/gi, '').trim();
    return clean || null;
  };

  const handleMigrateCatalogUnits = async () => {
    setIsMigratingUnits(true);
    try {
      const { data: items, error } = await supabase
        .from('supply_catalog')
        .select('*')
        .eq('school_id', user.school_id);

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!items || items.length === 0) {
        toast.info("Aucun article dans le catalogue à harmoniser.");
        setIsMigratingUnits(false);
        return;
      }

      let updatedCount = 0;
      for (const item of items) {
        const unit = getItemUnitMeasure(item);
        const cleanDisc = getItemCleanDiscipline(item) || '';
        const encodedDisc = cleanDisc ? `${cleanDisc} [Unité: ${unit}]` : `[Unité: ${unit}]`;

        const basePayload: any = {
          discipline_name: encodedDisc
        };

        const { error: err1 } = await supabase
          .from('supply_catalog')
          .update({ ...basePayload, unit_measure: unit })
          .eq('id', item.id)
          .eq('school_id', user.school_id);

        if (err1) {
          await supabase
            .from('supply_catalog')
            .update(basePayload)
            .eq('id', item.id)
            .eq('school_id', user.school_id);
        }
        updatedCount++;
      }

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'settings',
        details: { type: 'migrate_catalog_units', count: updatedCount }
      });

      toast.success(`✅ Outil Migration Unités : ${updatedCount} article(s) du catalogue harmonisés avec succès !`);
      fetchData();
    } catch (err: any) {
      console.error("Erreur migration unités catalogue:", err);
      toast.error("Erreur outil migration : " + (err.message || "Échec de l'harmonisation"));
    } finally {
      setIsMigratingUnits(false);
    }
  };

  const handleSaveCatalog = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const selectedUnit = catalogFormData.unit_measure || 'Pièce';
      const unitTag = `[Unité: ${selectedUnit}]`;
      const cleanDisc = (catalogFormData.discipline_name || '').replace(/\[Unité:[^\]]+\]/g, '').trim();
      const encodedDiscipline = cleanDisc ? `${cleanDisc} ${unitTag}` : unitTag;

      const basePayload: any = {
        school_id: user.school_id,
        campus_id: user.campus_id || currentCampusId || null,
        label: catalogFormData.label,
        unit_price: parseFloat(catalogFormData.unit_price) || 0,
        category: catalogFormData.category || 'Fourniture',
        currency: catalogFormData.currency || 'HTG',
        planned_exchange_rate: parseFloat(catalogFormData.planned_exchange_rate) || 1,
        stock_quantity: parseFloat(catalogFormData.stock_quantity) || 0,
        low_stock_threshold: parseFloat(catalogFormData.low_stock_threshold) || 5,
        discipline_name: catalogFormData.discipline_name || null
      };

      if (selectedYearId) {
        basePayload.academic_year_id = selectedYearId;
      }

      // Progression of fallback payloads if table columns do not exist in schema cache
      const payloadAttempts = [
        // 1. Primary attempt: Direct unit_measure column
        { ...basePayload, unit_measure: selectedUnit },

        // 2. Fallback: Strip unit_measure, encode in discipline_name
        { ...basePayload, discipline_name: encodedDiscipline },

        // 3. Fallback without academic_year_id and low_stock_threshold
        (() => {
          const { academic_year_id, low_stock_threshold, ...p } = basePayload;
          return { ...p, discipline_name: encodedDiscipline };
        })(),

        // 4. Fallback without currency, planned_exchange_rate, stock_quantity
        (() => {
          const { academic_year_id, low_stock_threshold, currency, planned_exchange_rate, stock_quantity, ...p } = basePayload;
          return { ...p, discipline_name: encodedDiscipline };
        })()
      ];

      let savedRecord: any = null;
      let lastError: any = null;

      for (const attemptPayload of payloadAttempts) {
        try {
          if (catalogFormData.id) {
            const { error } = await supabase
              .from('supply_catalog')
              .update(attemptPayload)
              .eq('id', catalogFormData.id)
              .eq('school_id', user.school_id);

            if (!error) {
              savedRecord = { id: catalogFormData.id };
              lastError = null;
              break;
            }
            lastError = error;
          } else {
            const { data, error } = await supabase
              .from('supply_catalog')
              .insert([attemptPayload])
              .select()
              .single();

            if (!error && data) {
              savedRecord = data;
              lastError = null;
              break;
            }
            lastError = error;
          }
        } catch (err: any) {
          lastError = err;
        }
      }

      if (lastError && !savedRecord) {
        throw lastError;
      }

      if (catalogFormData.id) {
        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: 'UPDATE',
          entity_type: 'settings',
          entity_id: catalogFormData.id,
          details: { 
            type: 'supply_catalog', 
            label: catalogFormData.label, 
            price: catalogFormData.unit_price,
            is_local_deviation: !isSiegeActive,
            campus_id: currentCampusId,
            campus_name: campuses?.find(c => c.id === currentCampusId)?.name,
            deviation_alert: !isSiegeActive ? "MODIFICATION LOCALE DE TARIF DE FOURNITURE" : undefined
          }
        });
        toast.success("Article du catalogue mis à jour avec succès.");
      } else {
        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: 'CREATE',
          entity_type: 'settings',
          entity_id: savedRecord?.id || 'NEW',
          details: { 
            type: 'supply_catalog', 
            label: catalogFormData.label, 
            price: catalogFormData.unit_price,
            is_local_deviation: !isSiegeActive,
            campus_id: currentCampusId,
            campus_name: campuses?.find(c => c.id === currentCampusId)?.name,
            deviation_alert: !isSiegeActive ? "CRÉATION LOCALE COMPTABILISÉE" : undefined
          }
        });
        toast.success("Nouvel article ajouté au catalogue !");
      }

      if (!isSiegeActive) {
        toast.warning(`Alerte Traçabilité : Modification d'un article du catalogue par l'annexe locale "${campuses?.find(c => c.id === currentCampusId)?.name || 'locale'}" signalée au Siège Social.`);
      }

      setShowCatalogModal(false);
      setCatalogFormData({ id: '', label: '', unit_price: '', category: 'Fourniture', currency: 'HTG', planned_exchange_rate: '132.50', stock_quantity: '', low_stock_threshold: '5', discipline_name: '', unit_measure: 'Pièce' });
      fetchData();
    } catch (err: any) {
      toast.error("Erreur catalogue : " + (err.message || "Impossible d'enregistrer l'article"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveInventoryAdjustment = async (data: {
    itemId: string;
    adjustmentType: 'set' | 'add' | 'subtract';
    quantity: number;
    newStock: number;
    reason: string;
    createExpense: boolean;
    costPerUnit?: number;
  }) => {
    setIsSubmitting(true);
    try {
      const item = catalog.find(i => i.id === data.itemId);
      if (!item) throw new Error("Article introuvable dans le catalogue");

      const previousStock = item.stock_quantity ?? 0;
      const difference = data.newStock - previousStock;

      const { error: updateErr } = await supabase
        .from('supply_catalog')
        .update({ stock_quantity: data.newStock })
        .eq('id', item.id)
        .eq('school_id', user.school_id);

      if (updateErr) throw updateErr;

      if (data.createExpense && difference > 0 && data.costPerUnit && data.costPerUnit > 0) {
        const totalExpense = difference * data.costPerUnit;
        await supabase.from('expenses').insert([{
          school_id: user.school_id,
          campus_id: user.campus_id || currentCampusId || null,
          academic_year_id: selectedYearId,
          label: `AJUSTEMENT STOCK: ${item.label} (+${difference})`,
          amount: totalExpense,
          expense_date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
          description: `Régularisation inventaire matériel (${data.reason}). P.U: ${data.costPerUnit} HTG.`,
          category_legacy: 'Fournitures Scolaires',
          currency: 'HTG',
          exchange_rate_applied: 1,
          amount_htg_equivalent: totalExpense
        }]);
      }

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'settings',
        entity_id: item.id,
        details: {
          type: 'inventory_manual_adjustment',
          label: item.label,
          category: item.category,
          previousStock,
          newStock: data.newStock,
          difference,
          reason: data.reason
        }
      });

      toast.success(`✅ Stock de "${item.label}" mis à jour : ${previousStock} ➔ ${data.newStock} !`);
      setAdjustingStockItem(null);
      fetchData();
    } catch (err: any) {
      console.error("Erreur ajustement inventaire:", err);
      toast.error("Échec de l'ajustement de stock : " + (err.message || "Erreur inconnue"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleItemSelect = (itemId: string) => {
    const item = catalog.find(i => i.id === itemId);
    if (item) {
      setFormData(prev => ({
        ...prev,
        catalog_item_id: itemId,
        description: item.label,
        total_amount: item.unit_price.toString()
      }));
    }
  };

  useEffect(() => {
    const checkExisting = async () => {
      if (selectedStudent && selectedYearId) {
        const { data } = await supabase
          .from('school_supplies')
          .select('*, payments:supply_payments(*)')
          .eq('student_id', selectedStudent.id)
          .eq('academic_year_id', selectedYearId)
          .maybeSingle();
        
        if (data) {
          setExistingSupply(data);
          const totalPaid = data.payments?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0;
          setFormData(prev => ({
            ...prev,
            catalog_item_id: data.catalog_item_id || '',
            description: data.description || '',
            total_amount: data.total_amount?.toString() || '0',
            paid_amount_existing: totalPaid
          }));
        } else {
          setExistingSupply(null);
          setFormData(prev => ({ 
            ...prev, catalog_item_id: '', description: '', total_amount: '', paid_amount_existing: 0 
          }));
        }
      }
    };
    checkExisting();
  }, [selectedStudent, selectedYearId]);

  const handleSaveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !selectedYearId || !user.school_id) return;

    setIsSubmitting(true);
    try {
      let supplyId = existingSupply?.id;
      const versementAmount = parseFloat(formData.payment_amount || '0');

      if (!supplyId) {
        const payload: any = {
          school_id: user.school_id,
          campus_id: user.campus_id || currentCampusId || null,
          student_id: selectedStudent.id,
          catalog_item_id: formData.catalog_item_id || null,
          description: formData.description,
          total_amount: parseFloat(formData.total_amount)
        };

        if (selectedYearId) {
          payload.academic_year_id = selectedYearId;
        }

        const { data: newSup, error: supErr } = await supabase
          .from('school_supplies')
          .insert([payload])
          .select().single();
        
        if (supErr) {
          if (supErr.code === '42703' || supErr.message?.includes('schema cache')) {
            const { academic_year_id, ...fallback } = payload;
            const { data: retrySup, error: retryErr } = await supabase
              .from('school_supplies')
              .insert([fallback])
              .select().single();
            if (retryErr) throw retryErr;
            supplyId = retrySup.id;
          } else {
            throw supErr;
          }
        } else {
          supplyId = newSup.id;
        }

        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: 'CREATE',
          entity_type: 'payment',
          entity_id: supplyId,
          details: { type: 'school_supplies_record', student_id: selectedStudent.id, student_name: formatStudentName(selectedStudent.last_name, selectedStudent.first_name).fullName, amount: parseFloat(formData.total_amount) }
        });
      }

      let paymentData = null;
      if (versementAmount > 0) {
        const { data: pData, error: payErr } = await supabase
          .from('supply_payments')
          .insert([{
            supply_id: supplyId,
            school_id: user.school_id,
            campus_id: user.campus_id || currentCampusId || null,
            amount: versementAmount,
            payment_date: formData.payment_date
          }])
          .select().single();
        if (payErr) throw payErr;
        paymentData = pData;

        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: 'CREATE',
          entity_type: 'payment',
          entity_id: pData.id,
          details: { type: 'supply_payment', amount: versementAmount, supply_id: supplyId, student_name: formatStudentName(selectedStudent.last_name, selectedStudent.first_name).fullName }
        });
      }

      if (paymentData) {
        setPrintJob({
          payment: paymentData,
          student: selectedStudent,
          description: formData.description,
          total_pack: parseFloat(formData.total_amount),
          previous_paid: formData.paid_amount_existing,
          current_paid: versementAmount
        });
      }

      setShowModal(false);
      resetSaleForm();
      fetchData();
      toast.success("Transaction enregistrée.");
    } catch (err: any) {
      toast.error("Erreur transaction: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetSaleForm = () => {
    setModalClassId('');
    setSelectedStudent(null);
    setExistingSupply(null);
    setFormData({ catalog_item_id: '', description: '', total_amount: '', payment_amount: '', payment_date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0], paid_amount_existing: 0 });
  };

  const handleMigrateCatalog = async () => {
    if (!migrateSourceId || !selectedYearId) return;
    
    setIsMigrating(true);
    const sourceId = migrateSourceId;
    try {
      const { data: sourceItems } = await supabase
        .from('supply_catalog')
        .select('*')
        .eq('school_id', user.school_id)
        .eq('academic_year_id', sourceId);

      if (!sourceItems || sourceItems.length === 0) {
        throw new Error("Aucun article trouvé dans le catalogue source.");
      }

      const newItems = sourceItems.map(item => ({
        school_id: user.school_id,
        academic_year_id: selectedYearId,
        label: item.label,
        unit_price: item.unit_price,
        category: item.category
      }));

      const { error } = await supabase.from('supply_catalog').insert(newItems);
      if (error) throw error;

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'CREATE',
        entity_type: 'settings',
        details: { type: 'migrate_supply_catalog', count: newItems.length, source_year: sourceId, target_year: selectedYearId }
      });

      fetchData();
      setShowMigrateModal(false);
      setMigrateSourceId('');
      toast.success("Catalogue migré avec succès.");
    } catch (err: any) {
      console.error("Erreur migration catalogue : " + err.message);
      toast.error("Erreur migration catalogue : " + err.message);
    } finally {
      setIsMigrating(false);
    }
  };

  const performDelete = async () => {
    if (!deleteId) return;
    const table = deleteType === 'record' ? 'school_supplies' : 'supply_catalog';
    
    let error;

    // 1. Restock items & clean payment history if a sale is cancelled/returned
    if (deleteType === 'record') {
      try {
        let itemsToRestock: any[] = [];
        let supplyIdsToDelete: string[] = [];

        if (deleteId.startsWith('POS-')) {
          const { data: saleItems } = await supabase
            .from('school_supplies')
            .select('id, catalog_item_id, quantity')
            .eq('transaction_id', deleteId)
            .eq('school_id', user.school_id);
          if (saleItems) {
            itemsToRestock = saleItems;
            supplyIdsToDelete = saleItems.map(s => s.id);
          }
        } else {
          const { data: saleItem } = await supabase
            .from('school_supplies')
            .select('id, catalog_item_id, quantity')
            .eq('id', deleteId)
            .eq('school_id', user.school_id)
            .single();
          if (saleItem) {
            itemsToRestock = [saleItem];
            supplyIdsToDelete = [saleItem.id];
          }
        }

        // Apply restock to catalog
        for (const item of itemsToRestock) {
          if (item.catalog_item_id) {
             const catalogItem = catalog.find(c => c.id === item.catalog_item_id);
             if (catalogItem && catalogItem.stock_quantity !== undefined) {
               const restoredQuantity = item.quantity || 1;
               const newStock = (catalogItem.stock_quantity || 0) + restoredQuantity;
               await supabase.from('supply_catalog').update({ stock_quantity: newStock }).eq('id', item.catalog_item_id);
             }
          }
        }

        // Clean up associated payment entries in supply_payments to correct student balances
        if (supplyIdsToDelete.length > 0) {
          await supabase.from('supply_payments').delete().in('supply_id', supplyIdsToDelete).eq('school_id', user.school_id);
        }
      } catch (e) {
        console.error('Erreur lors du restockage et nettoyage des paiements:', e);
      }
    }

    if (deleteType === 'record' && deleteId.startsWith('POS-')) {
      const res = await supabase.from(table).delete().eq('transaction_id', deleteId).eq('school_id', user.school_id);
      error = res.error;
    } else {
      const res = await supabase.from(table).delete().eq('id', deleteId).eq('school_id', user.school_id);
      error = res.error;
    }

    if (!error) {
      if (!isSiegeActive) {
        toast.warning(`Alerte Traçabilité : Annulation/Suppression d'une ressource d'économat par l'annexe locale "${campuses?.find(c => c.id === currentCampusId)?.name || 'locale'}" signalée au Siège Social.`);
      }
      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'DELETE',
        entity_type: deleteType === 'record' ? 'payment' : 'settings',
        entity_id: deleteId,
        details: { 
          type: deleteType === 'record' ? 'school_supplies_record' : 'supply_catalog',
          is_local_deviation: !isSiegeActive,
          campus_id: currentCampusId,
          campus_name: campuses?.find(c => c.id === currentCampusId)?.name,
          deviation_alert: !isSiegeActive ? "SUPPRESSION LOCALE DE RESSOURCE" : undefined
        }
      });
      fetchData();
      if (deleteType === 'record') {
        toast.success("✅ Vente annulée : articles réintégrés en stock & solde financier élève corrigé avec succès !");
      } else {
        toast.success("Suppression du catalogue réussie.");
      }
    }
    else toast.error("Impossible de supprimer : Cet élément est déjà lié à des ventes.");
    setDeleteId(null);
  };

  const filteredRecords = records.filter(r => {
    const matchesSearch = formatStudentName(r.student?.last_name, r.student?.first_name).fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.transaction_id && r.transaction_id.toLowerCase().includes(searchTerm.toLowerCase()));

    let matchesDate = true;
    if (r.created_at) {
      const recordDate = r.created_at.split('T')[0];
      if (dateFilterFrom && recordDate < dateFilterFrom) matchesDate = false;
      if (dateFilterTo && recordDate > dateFilterTo) matchesDate = false;
    } else if (r.payments && r.payments.length > 0) {
      // Pour les transactions enregistrées différemment (supply_payments fallback)
      const maxPaymentDate = r.payments.reduce((max: string, p: any) => p.payment_date > max ? p.payment_date : max, '1970-01-01');
      if (dateFilterFrom && maxPaymentDate < dateFilterFrom) matchesDate = false;
      if (dateFilterTo && maxPaymentDate > dateFilterTo) matchesDate = false;
    }

    return matchesSearch && matchesDate;
  });

  const groupedRecords = useMemo(() => {
    const groups: Record<string, any> = {};
    
    filteredRecords.forEach(r => {
      const key = r.transaction_id || `legacy-${r.id}`;
      if (!groups[key]) {
        groups[key] = {
          transaction_id: r.transaction_id || 'Vente Individuelle',
          group_key: key,
          student: r.student,
          created_at: r.created_at,
          items: [],
          total_amount: 0,
          paid_amount: 0,
          isLegacy: !r.transaction_id
        };
      }
      groups[key].items.push(r);
      groups[key].total_amount += r.total_amount;
      groups[key].paid_amount += r.paid_amount || 0;
    });

    return Object.values(groups).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [filteredRecords]);

  const displayedStats = useMemo(() => {
    return {
      totalVendu: groupedRecords.reduce((acc, g) => acc + g.total_amount, 0),
      totalEncaisse: groupedRecords.reduce((acc, g) => acc + g.paid_amount, 0),
      countTransactions: groupedRecords.length
    };
  }, [groupedRecords]);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getDisciplineName = useCallback((className: string) => {
    let name = className.replace(
      /\s*(I|II|III|IV|V|VI|\d+|Année \d+|Niveau \d+|Niveau [IVX]+|\(L\d+\)|Licence \d+|Master \d+)\s*$/i,
      "",
    );
    name = name.replace(/^(licence|master|dipl[ôo]me|certificat)\s*(en|de)?\s*/i, "");
    return name.trim() || className;
  }, []);

  const disciplinesList = useMemo(() => {
    const uniqueNames = new Set<string>();
    classes.forEach(c => {
      if (c.name) {
        uniqueNames.add(getDisciplineName(c.name));
      }
    });
    return Array.from(uniqueNames).sort();
  }, [classes, getDisciplineName]);

  const [isGeneratingRecs, setIsGeneratingRecs] = useState(false);

  const handleGenerateRecs = async () => {
    if (selectedDisciplineFilter === 'Tous' || !user?.school_id) return;
    setIsGeneratingRecs(true);
    try {
      const recommendations = [
        {
          school_id: user.school_id,
          academic_year_id: selectedYearId || null,
          campus_id: user.campus_id || currentCampusId || null,
          label: `Uniforme Réglementaire - ${selectedDisciplineFilter}`,
          category: 'Uniforme',
          unit_price: 2500,
          currency: 'HTG',
          planned_exchange_rate: 132.50,
          stock_quantity: 50,
          low_stock_threshold: 5,
          discipline_name: selectedDisciplineFilter
        },
        {
          school_id: user.school_id,
          academic_year_id: selectedYearId || null,
          campus_id: user.campus_id || currentCampusId || null,
          label: `Manuel d'Étude & Syllabus - ${selectedDisciplineFilter}`,
          category: 'Manuel',
          unit_price: 3500,
          currency: 'HTG',
          planned_exchange_rate: 132.50,
          stock_quantity: 40,
          low_stock_threshold: 5,
          discipline_name: selectedDisciplineFilter
        },
        {
          school_id: user.school_id,
          academic_year_id: selectedYearId || null,
          campus_id: user.campus_id || currentCampusId || null,
          label: `Trousse de Fournitures Spécifiques - ${selectedDisciplineFilter}`,
          category: 'Fourniture',
          unit_price: 1500,
          currency: 'HTG',
          planned_exchange_rate: 132.50,
          stock_quantity: 60,
          low_stock_threshold: 5,
          discipline_name: selectedDisciplineFilter
        },
        {
          school_id: user.school_id,
          academic_year_id: selectedYearId || null,
          campus_id: user.campus_id || currentCampusId || null,
          label: `Frais d'Atelier, TP & Labo - ${selectedDisciplineFilter}`,
          category: 'Service',
          unit_price: 5000,
          currency: 'HTG',
          planned_exchange_rate: 132.50,
          stock_quantity: 9999,
          low_stock_threshold: 0,
          discipline_name: selectedDisciplineFilter
        }
      ];

      const { error } = await supabase.from('supply_catalog').insert(recommendations);
      if (error) throw error;

      toast.success(`4 articles recommandés ont été générés pour la discipline "${selectedDisciplineFilter}" !`);
      fetchData();
    } catch (err: any) {
      console.error("Error generating recommendations:", err);
      toast.error("Impossible de générer les recommandations : " + err.message);
    } finally {
      setIsGeneratingRecs(false);
    }
  };

  const filteredCatalog = catalog.filter(i => 
    (activeCatalogCat === 'Tous' || i.category === activeCatalogCat) &&
    (selectedDisciplineFilter === 'Tous' || !i.discipline_name || i.discipline_name === 'Toutes' || i.discipline_name === selectedDisciplineFilter) &&
    (i.label.toLowerCase().includes(catalogSearchTerm.toLowerCase()) || 
     i.category.toLowerCase().includes(catalogSearchTerm.toLowerCase()) ||
     (i.discipline_name && i.discipline_name.toLowerCase().includes(catalogSearchTerm.toLowerCase())))
  );

  const deferredDeliveries = useMemo(() => {
    return records.filter(r => 
      r.description && (
        r.description.toLowerCase().includes('livraison différée') ||
        r.description.toLowerCase().includes('attente fournisseur') ||
        r.description.toLowerCase().includes('differee')
      ) && !r.description.includes('[LIVRÉ À L\'ÉLÈVE]')
    );
  }, [records]);

  const handleMarkDelivered = async (record: any) => {
    try {
      const updatedDescription = record.description
        .replace(/\[Livraison Différée - Attente Fournisseur\]/gi, '[LIVRÉ À L\'ÉLÈVE]')
        .replace(/\[Livraison Différée\]/gi, '[LIVRÉ À L\'ÉLÈVE]')
        .trim() + ' [LIVRÉ À L\'ÉLÈVE]';

      // 1. Mark supply record as delivered
      const { error } = await supabase
        .from('school_supplies')
        .update({ description: updatedDescription })
        .eq('id', record.id);

      if (error) throw error;

      // 2. Decrement physical stock from catalog upon actual handover to student
      const qtyToDeduct = Number(record.quantity || 1);
      const catItem = catalog.find(c => 
        (record.catalog_item_id && c.id === record.catalog_item_id) || 
        (c.label && record.description && record.description.toLowerCase().includes(c.label.toLowerCase()))
      );

      let stockSummary = "";
      if (catItem) {
        const currentStock = Number(catItem.stock_quantity ?? 0);
        const newStock = Math.max(0, Math.round((currentStock - qtyToDeduct) * 100) / 100);

        const { error: stockErr } = await supabase
          .from('supply_catalog')
          .update({ stock_quantity: newStock })
          .eq('id', catItem.id)
          .eq('school_id', user.school_id);

        if (stockErr) {
          console.error("Erreur décrémentation stock livraison:", stockErr);
        } else {
          stockSummary = ` Stock décrémenté (${currentStock} ➔ ${newStock}).`;
        }
      }

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'supply',
        entity_id: record.id,
        details: { type: 'mark_delivered', previous: record.description, new: updatedDescription, qty: qtyToDeduct }
      });

      toast.success(`✅ Article marqué comme DÉLIVRÉ à l'élève !${stockSummary}`);
      fetchData();
    } catch (err: any) {
      toast.error("Erreur mise à jour livraison : " + err.message);
    }
  };

  const renderInventoryView = () => {
    const lowStockItems = catalog.filter(i => i.stock_quantity !== undefined && i.stock_quantity <= (i.low_stock_threshold || 0));
    const outOfStockItems = catalog.filter(i => (i.stock_quantity || 0) <= 0);
    const inStockItems = catalog.filter(i => (i.stock_quantity || 0) > (i.low_stock_threshold || 0));
    
    const totalUnitsInStock = catalog.reduce((acc, i) => acc + (i.stock_quantity || 0), 0);
    const totalValue = catalog.reduce((acc, i) => acc + ((i.stock_quantity || 0) * (i.unit_price || 0)), 0);
    
    // Estimated purchase cost calculation
    const totalEstimatedCost = catalog.reduce((acc, i) => {
      const lastInfo = getLastPurchaseInfo(i.id);
      const buyCost = lastInfo?.unitCost || (i.unit_price ? i.unit_price * 0.6 : 0);
      return acc + ((i.stock_quantity || 0) * buyCost);
    }, 0);
    const totalPotentialMargin = Math.max(0, totalValue - totalEstimatedCost);

    let filteredInventory = catalog;
    
    // Filter by category
    if (inventoryCategoryFilter !== 'Tous') {
      filteredInventory = filteredInventory.filter(i => i.category === inventoryCategoryFilter);
    }

    // Filter by stock status
    if (inventoryFilter === 'low') {
      filteredInventory = filteredInventory.filter(i => i.stock_quantity !== undefined && i.stock_quantity <= (i.low_stock_threshold || 0) && (i.stock_quantity || 0) > 0);
    } else if (inventoryFilter === 'out') {
      filteredInventory = filteredInventory.filter(i => (i.stock_quantity || 0) <= 0);
    } else if (inventoryFilter === 'ok') {
      filteredInventory = filteredInventory.filter(i => (i.stock_quantity || 0) > (i.low_stock_threshold || 0));
    }

    if (inventorySearch) {
      filteredInventory = filteredInventory.filter(i => 
        i.label.toLowerCase().includes(inventorySearch.toLowerCase()) ||
        i.category.toLowerCase().includes(inventorySearch.toLowerCase()) ||
        (i.discipline_name && i.discipline_name.toLowerCase().includes(inventorySearch.toLowerCase()))
      );
    }
    
    const lowStockCount = lowStockItems.length + outOfStockItems.length;
    
    // Filter purchase history by selected supplier
    const filteredHistory = purchaseHistory.filter(p => {
      if (supplierHistoryFilter === 'Tous') return true;
      return p.description && p.description.toLowerCase().includes(supplierHistoryFilter.toLowerCase());
    });
    const totalSupplierExpense = filteredHistory.reduce((acc, p) => acc + (p.amount || 0), 0);

    return (
      <div className="space-y-5 animate-in fade-in duration-300">
        
        {/* BANNIÈRE ACTIONS COMPACTE */}
        <div className="bg-slate-900 text-white rounded-2xl p-4 md:p-5 shadow-md border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-indigo-500/20 text-indigo-300 rounded-xl flex items-center justify-center shrink-0 border border-indigo-400/30">
              <Package size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">Inventaire & Stocks</h3>
                {knownSuppliers.length > 0 && (
                  <span className="text-[10px] font-semibold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                    {knownSuppliers.length} fournisseur(s)
                  </span>
                )}
                {!canEditPrices && (
                  <span className="text-[10px] font-medium text-amber-300 bg-amber-500/20 border border-amber-400/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Lock size={10} /> Tarifs verrouillés
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {lowStockCount > 0 && (
              <button
                onClick={handleFillLowStockBatch}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Zap size={14} />
                <span>Ruptures ({lowStockCount})</span>
              </button>
            )}

            <button
              onClick={() => setShowInventorySheetModal(true)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-xl border border-slate-700 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Printer size={14} className="text-indigo-300" />
              <span>Fiche A4</span>
            </button>

            <button
              onClick={() => {
                setPurchaseMode('batch');
                if (batchItems.length === 0 || (batchItems.length === 1 && !batchItems[0].item_id)) {
                  setBatchItems([{ item_id: '', quantity: '10', unit_cost: '' }]);
                }
                if (!batchSupplier && knownSuppliers.length > 0) setBatchSupplier(knownSuppliers[0]);
                setShowPurchaseModal(true);
              }}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
            >
              <FileText size={14} />
              <span>Bon de Commande</span>
            </button>

            <button
              onClick={() => {
                setPurchaseMode('single');
                setPurchaseFormData({
                  item_id: '',
                  quantity: '10',
                  unit_cost: '',
                  supplier: knownSuppliers[0] || '',
                  date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]
                });
                setShowPurchaseModal(true);
              }}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white font-medium text-xs rounded-xl border border-white/20 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Plus size={14} />
              <span>Achat Direct</span>
            </button>
          </div>
        </div>

        {/* KPI CARDS ÉPURÉES */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div 
            onClick={() => { setInventoryFilter('all'); setInventoryCategoryFilter('Tous'); }}
            className={`p-4 rounded-2xl bg-white border transition-all cursor-pointer ${inventoryFilter === 'all' && inventoryCategoryFilter === 'Tous' ? 'border-slate-900 ring-2 ring-slate-900/10 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Matériels</span>
              <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg"><Package size={16} /></div>
            </div>
            <div className="flex items-baseline gap-1.5 mt-2">
              <p className="text-2xl font-black text-slate-900 font-mono">{catalog.length}</p>
              <span className="text-xs text-slate-500">articles</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">{totalUnitsInStock.toLocaleString()} pièces au total</p>
          </div>

          <div 
            onClick={() => setInventoryFilter('low')}
            className={`p-4 rounded-2xl bg-white border transition-all cursor-pointer ${inventoryFilter === 'low' ? 'border-amber-500 ring-2 ring-amber-500/10 shadow-sm' : 'border-slate-200 hover:border-amber-300'}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Stock Bas</span>
              <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg"><AlertCircle size={16} /></div>
            </div>
            <div className="flex items-baseline gap-1.5 mt-2">
              <p className="text-2xl font-black text-amber-600 font-mono">{lowStockItems.length}</p>
              <span className="text-xs text-amber-700/80">sous seuil</span>
            </div>
            <p className="text-[11px] text-amber-700/90 mt-1 font-medium">À réapprovisionner</p>
          </div>

          <div 
            onClick={() => setInventoryFilter('out')}
            className={`p-4 rounded-2xl bg-white border transition-all cursor-pointer ${inventoryFilter === 'out' ? 'border-rose-500 ring-2 ring-rose-500/10 shadow-sm' : 'border-slate-200 hover:border-rose-300'}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Ruptures</span>
              <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg"><Archive size={16} /></div>
            </div>
            <div className="flex items-baseline gap-1.5 mt-2">
              <p className="text-2xl font-black text-rose-600 font-mono">{outOfStockItems.length}</p>
              <span className="text-xs text-rose-700/80">à zéro</span>
            </div>
            <p className="text-[11px] text-rose-700/90 mt-1 font-medium">{deferredDeliveries.length} différée(s)</p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Valeur du Stock</span>
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><DollarSign size={16} /></div>
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              <p className="text-2xl font-black text-slate-900 font-mono">{totalValue.toLocaleString()}</p>
              <span className="text-xs text-slate-500 font-bold">HTG</span>
            </div>
            <p className="text-[11px] text-emerald-600 mt-1 font-semibold font-mono">+{totalPotentialMargin.toLocaleString()} HTG marge</p>
          </div>
        </div>

        {/* SUB-TABS ÉPURÉS */}
        <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
            <button
              onClick={() => setInventorySubTab('stock')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                inventorySubTab === 'stock'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Package size={15} />
              <span>État des Stocks</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${inventorySubTab === 'stock' ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {catalog.length}
              </span>
            </button>

            <button
              onClick={() => setInventorySubTab('purchases')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                inventorySubTab === 'purchases'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Truck size={15} />
              <span>Journal Achats</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${inventorySubTab === 'purchases' ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {purchaseHistory.length}
              </span>
            </button>

            {deferredDeliveries.length > 0 && (
              <button
                onClick={() => setInventorySubTab('deliveries')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                  inventorySubTab === 'deliveries'
                    ? 'bg-amber-500 text-slate-950 shadow-xs font-bold'
                    : 'text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                <Clock size={15} />
                <span>Livraisons Différées</span>
                <span className="px-1.5 py-0.2 rounded-md text-[10px] bg-amber-950 text-white font-mono font-bold">
                  {deferredDeliveries.length}
                </span>
              </button>
            )}

            <button
              onClick={() => setInventorySubTab('combined')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                inventorySubTab === 'combined'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <LayoutGrid size={15} />
              <span>Vue Mixte</span>
            </button>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => setInventoryViewMode('table')}
                className={`p-1.5 rounded-md transition-colors ${inventoryViewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-400 hover:text-slate-700'}`}
                title="Tableau"
              >
                <ListFilter size={15} />
              </button>
              <button
                onClick={() => setInventoryViewMode('grid')}
                className={`p-1.5 rounded-md transition-colors ${inventoryViewMode === 'grid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-400 hover:text-slate-700'}`}
                title="Grille"
              >
                <LayoutGrid size={15} />
              </button>
            </div>

            <div className="text-xs font-bold text-slate-600 px-3 py-1 bg-slate-50 rounded-lg border border-slate-200 font-mono">
              <span className="text-emerald-600">{totalValue.toLocaleString()} HTG</span>
            </div>
          </div>
        </div>

        {/* TAB 1: ÉTAT ACTUEL DES STOCKS & TARIFS */}
        {(inventorySubTab === 'stock' || inventorySubTab === 'combined') && (
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            
            {/* TOOLBAR FLUIDE ET ÉPURÉE */}
            <div className="p-3.5 border-b border-slate-100 bg-slate-50/50 space-y-2.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                {/* RECHERCHE */}
                <div className="relative flex-1 sm:w-72">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Rechercher un matériel..."
                    className="pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-600 w-full"
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                  />
                  {inventorySearch && (
                    <button onClick={() => setInventorySearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* FILTRES STATUTS */}
                <div className="flex items-center bg-slate-200/70 p-1 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setInventoryFilter('all')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${inventoryFilter === 'all' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Tous
                  </button>
                  <button
                    onClick={() => setInventoryFilter('ok')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${inventoryFilter === 'ok' ? 'bg-emerald-600 text-white font-bold shadow-xs' : 'text-emerald-800 hover:text-emerald-950'}`}
                  >
                    En Stock ({inStockItems.length})
                  </button>
                  <button
                    onClick={() => setInventoryFilter('low')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${inventoryFilter === 'low' ? 'bg-amber-500 text-slate-950 font-bold shadow-xs' : 'text-amber-800 hover:text-amber-950'}`}
                  >
                    Stock Bas ({lowStockItems.length})
                  </button>
                  <button
                    onClick={() => setInventoryFilter('out')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${inventoryFilter === 'out' ? 'bg-rose-600 text-white font-bold shadow-xs' : 'text-rose-800 hover:text-rose-950'}`}
                  >
                    Rupture ({outOfStockItems.length})
                  </button>
                </div>
              </div>

              {/* CATÉGORIES CHIPS */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
                <button
                  onClick={() => setInventoryCategoryFilter('Tous')}
                  className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    inventoryCategoryFilter === 'Tous'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>Tous</span>
                  <span className="px-1.5 py-0.2 bg-slate-200/50 rounded text-[10px] font-mono">
                    {catalog.length}
                  </span>
                </button>

                {CATEGORIES.map(cat => {
                  const countInCat = catalog.filter(i => i.category === cat).length;
                  if (countInCat === 0 && !['Uniforme', 'Manuel', 'Fourniture', 'Service'].includes(cat)) return null;

                  return (
                    <button
                      key={cat}
                      onClick={() => setInventoryCategoryFilter(cat)}
                      className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                        inventoryCategoryFilter === cat
                          ? 'bg-indigo-600 text-white font-bold shadow-xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {cat === 'Uniforme' && <Shirt size={12} />}
                      {cat === 'Manuel' && <BookOpen size={12} />}
                      {cat === 'Fourniture' && <PenTool size={12} />}
                      {cat === 'Laboratoire & Sciences' && <FlaskConical size={12} />}
                      {cat === 'Informatique & Tech' && <Laptop size={12} />}
                      {cat === 'Mobilier & Entretien' && <Armchair size={12} />}
                      {cat === 'Sport & Loisirs' && <Trophy size={12} />}
                      <span>{cat}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${inventoryCategoryFilter === cat ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {countInCat}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* VUE TABLEAU */}
            {inventoryViewMode === 'table' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      <th className="px-4 py-3">Matériel</th>
                      <th className="px-4 py-3">Dernier Fournisseur</th>
                      <th className="px-4 py-3 text-right">Prix Achat</th>
                      <th className="px-4 py-3 text-right">Prix Vente</th>
                      <th className="px-4 py-3 text-right">Marge</th>
                      <th className="px-4 py-3 text-center">Stock</th>
                      <th className="px-4 py-3 text-center">Statut</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredInventory.map((item) => {
                      const isOut = (item.stock_quantity || 0) <= 0;
                      const isLow = !isOut && item.stock_quantity !== undefined && item.stock_quantity <= (item.low_stock_threshold || 0);
                      const lastInfo = getLastPurchaseInfo(item.id);
                      const buyCost = lastInfo?.unitCost || 0;
                      const sellPrice = item.unit_price || 0;
                      const margin = sellPrice - buyCost;
                      const marginPct = buyCost > 0 ? ((margin / buyCost) * 100).toFixed(1) : '0';
                      const stockQty = item.stock_quantity ?? 0;
                      const threshold = item.low_stock_threshold || 5;
                      const stockRatio = threshold > 0 ? Math.min(100, Math.round((stockQty / (threshold * 2)) * 100)) : 100;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                              <span>{item.label}</span>
                              {item.unit_measure && (
                                <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                  /{item.unit_measure}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                {item.category}
                              </span>
                              {item.discipline_name && (
                                <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                                  {item.discipline_name}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-3.5">
                            {lastInfo?.supplier ? (
                              <div>
                                <div className="font-bold text-slate-800 flex items-center gap-1">
                                  <Truck size={12} className="text-slate-400 shrink-0" />
                                  <span>{lastInfo.supplier}</span>
                                </div>
                                <div className="text-[10px] font-medium text-slate-400">
                                  Le {new Date(lastInfo.date).toLocaleDateString('fr-FR')}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Aucun achat enregistré</span>
                            )}
                          </td>

                          <td className="px-5 py-3.5 text-right font-mono font-bold">
                            {buyCost > 0 ? (
                              <span className="text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-xs">
                                {buyCost.toLocaleString()} HTG
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">Non renseigné</span>
                            )}
                          </td>

                          <td className="px-5 py-3.5 text-right font-mono font-bold">
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="text-slate-900 font-black text-sm">
                                {sellPrice.toLocaleString()} HTG
                              </span>
                              {canEditPrices ? (
                                <button
                                  onClick={() => setEditingPriceItem({
                                    id: item.id,
                                    label: item.label,
                                    current_price: sellPrice,
                                    new_price: sellPrice.toString()
                                  })}
                                  className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                                  title="Modifier le prix de vente au catalogue"
                                >
                                  <Edit2 size={14} />
                                </button>
                              ) : (
                                <span title="Réservé à la Direction/Économe" className="text-slate-300">
                                  <Lock size={12} />
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-3.5 text-right font-mono font-bold">
                            {buyCost > 0 ? (
                              <div>
                                <div className={`text-xs ${margin >= 0 ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}`}>
                                  {margin >= 0 ? '+' : ''}{margin.toLocaleString()} HTG
                                </div>
                                <div className={`text-[10px] ${margin >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                  ({marginPct}%)
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[10px] italic">—</span>
                            )}
                          </td>

                          <td className="px-5 py-3.5 text-center min-w-[140px]">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between font-mono text-xs">
                                <span className={`font-black ${isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                                  {stockQty} {item.unit_measure ? `/${item.unit_measure}` : 'unités'}
                                </span>
                                <span className="text-[10px] text-slate-400 font-sans font-bold">
                                  Min: {threshold}
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    isOut ? 'bg-rose-500 w-0' :
                                    isLow ? 'bg-amber-500' :
                                    'bg-emerald-500'
                                  }`}
                                  style={{ width: `${isOut ? 4 : Math.max(8, stockRatio)}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-3.5 text-center">
                            {isOut ? (
                              <span className="px-3 py-1 bg-rose-100 text-rose-800 rounded-lg text-[10px] font-black uppercase inline-flex items-center gap-1 border border-rose-200 shadow-sm">
                                <Archive size={11} /> Rupture
                              </span>
                            ) : isLow ? (
                              <span className="px-3 py-1 bg-amber-100 text-amber-900 rounded-lg text-[10px] font-black uppercase inline-flex items-center gap-1 border border-amber-200 shadow-sm">
                                <AlertCircle size={11} /> Stock Bas
                              </span>
                            ) : (
                              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-black uppercase inline-flex items-center gap-1 border border-emerald-200 shadow-sm">
                                <CheckCircle2 size={11} /> En Stock
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button 
                                onClick={() => handleQuickRestock(item)}
                                className="px-2.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all border border-indigo-200 flex items-center gap-1 active:scale-95 shadow-sm"
                                title="Réapprovisionner auprès d'un fournisseur"
                              >
                                <Plus size={13} />
                                <span>Achat</span>
                              </button>

                              <button 
                                onClick={() => setAdjustingStockItem(item)}
                                className="px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all border border-slate-200 flex items-center gap-1 active:scale-95 shadow-sm"
                                title="Ajuster manuellement suite à comptage physique"
                              >
                                <ClipboardCheck size={13} />
                                <span>Ajuster</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredInventory.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-slate-400 text-xs font-bold">
                          Aucun matériel correspondant aux filtres sélectionnés.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* VUE GRILLE DE CARTES ERGONOMIQUE */
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredInventory.map(item => {
                  const isOut = (item.stock_quantity || 0) <= 0;
                  const isLow = !isOut && item.stock_quantity !== undefined && item.stock_quantity <= (item.low_stock_threshold || 0);
                  const lastInfo = getLastPurchaseInfo(item.id);
                  const buyCost = lastInfo?.unitCost || 0;
                  const sellPrice = item.unit_price || 0;
                  const margin = sellPrice - buyCost;
                  const stockQty = item.stock_quantity ?? 0;
                  const threshold = item.low_stock_threshold || 5;

                  return (
                    <div 
                      key={item.id}
                      className="bg-white rounded-2xl border border-slate-200 p-4.5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-extrabold text-[10px] uppercase border border-slate-200">
                            {item.category}
                          </span>
                          {isOut ? (
                            <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 rounded-md text-[10px] font-black uppercase">
                              Rupture
                            </span>
                          ) : isLow ? (
                            <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 rounded-md text-[10px] font-black uppercase">
                              Stock Bas
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-black uppercase">
                              En Stock
                            </span>
                          )}
                        </div>

                        <div>
                          <h5 className="font-black text-slate-900 text-sm leading-snug">
                            {item.label}
                          </h5>
                          {item.discipline_name && (
                            <p className="text-[11px] font-semibold text-indigo-600 mt-0.5">
                              {item.discipline_name}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* STATS & VALORISATION CARD */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium">Prix Vente :</span>
                          <span className="font-black font-mono text-slate-900">{sellPrice.toLocaleString()} HTG</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium">Stock Physique :</span>
                          <span className={`font-black font-mono text-sm ${isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                            {stockQty} {item.unit_measure ? `/${item.unit_measure}` : 'unités'}
                          </span>
                        </div>
                        {buyCost > 0 && (
                          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                            <span className="text-slate-500 font-medium">Marge brute :</span>
                            <span className="font-bold font-mono text-emerald-600">+{margin.toLocaleString()} HTG</span>
                          </div>
                        )}
                      </div>

                      {/* CARD ACTIONS */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleQuickRestock(item)}
                          className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1 shadow-sm"
                        >
                          <Plus size={14} />
                          <span>Achat Fournisseur</span>
                        </button>
                        <button
                          onClick={() => setAdjustingStockItem(item)}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all border border-slate-200"
                          title="Ajuster le stock"
                        >
                          <ClipboardCheck size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: JOURNAL D'ACHAT FOURNISSEURS */}
        {(inventorySubTab === 'purchases' || inventorySubTab === 'combined') && (
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-3.5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center border border-rose-100 font-bold shrink-0">
                  <Truck size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <span>Journal des Achats</span>
                    <span className="text-xs font-bold text-slate-400 font-mono">({filteredHistory.length})</span>
                  </h4>
                </div>
              </div>

              {/* FILTRE PAR FOURNISSEUR ET RECAP FINANCIER */}
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                {supplierHistoryFilter !== 'Tous' && (
                  <div className="text-xs font-bold text-rose-900 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 flex items-center gap-1">
                    <span>Total:</span>
                    <span className="font-mono font-black text-rose-700">-{totalSupplierExpense.toLocaleString()} HTG</span>
                  </div>
                )}

                <div className="w-full sm:w-56">
                  <SelectPill
                    options={[
                      { value: 'Tous', label: 'Tous les Fournisseurs' },
                      ...knownSuppliers.map(s => ({ value: s, label: s }))
                    ]}
                    value={supplierHistoryFilter}
                    onChange={(val) => setSupplierHistoryFilter(val)}
                    icon={Truck}
                    variant="field"
                    size="xs"
                    colorScheme="rose"
                    className="w-full"
                    searchable={knownSuppliers.length > 5}
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <th className="px-5 py-3.5">Date & Saisie</th>
                    <th className="px-5 py-3.5">Fournisseur</th>
                    <th className="px-5 py-3.5">Libellé & Quantité</th>
                    <th className="px-5 py-3.5">Catégorie Comptable</th>
                    <th className="px-5 py-3.5 text-right">Somme Décaissée de Caisse</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center text-slate-400 text-xs font-bold">
                        <Archive size={32} className="mx-auto text-slate-200 mb-2" />
                        Aucun achat ou décaissement enregistré pour ce filtre.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((p) => (
                      <tr key={p.id} className="hover:bg-rose-50/20 transition-colors">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="font-extrabold text-slate-800">
                            {new Date(p.expense_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            Ref: {p.id.slice(0, 8)}
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          {(() => {
                            const desc = p.description || '';
                            const match = desc.match(/Fournisseur:\s*([^.]+)/i);
                            const supplierName = match ? match[1].trim() : 'Fournisseur Général';
                            return (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-800 font-bold text-xs rounded-lg border border-slate-200">
                                <Truck size={13} className="text-slate-500" />
                                <span>{supplierName}</span>
                              </div>
                            );
                          })()}
                        </td>

                        <td className="px-5 py-3.5">
                          <div className="font-extrabold text-slate-900">{p.label}</div>
                          <div className="text-[11px] font-medium text-slate-500 mt-0.5">{p.description}</div>
                        </td>

                        <td className="px-5 py-3.5">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 font-semibold text-[10px] rounded-md border border-slate-200 uppercase">
                            {p.category_legacy || 'Fournitures Scolaires'}
                          </span>
                        </td>

                        <td className="px-5 py-3.5 text-right whitespace-nowrap font-mono">
                          <span className="text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl font-black text-sm inline-block shadow-xs">
                            -{p.amount.toLocaleString()} HTG
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: LIVRAISONS DIFFÉRÉES ÉLÈVES */}
        {(inventorySubTab === 'deliveries' || (inventorySubTab === 'combined' && deferredDeliveries.length > 0)) && (
          <div className="bg-amber-50/40 rounded-2xl border border-amber-200/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-amber-200/60 bg-amber-100/50 flex justify-between items-center">
              <div className="flex items-center gap-2 font-bold text-amber-950 text-sm">
                <Clock size={18} className="text-amber-700" />
                <span>Commandes & Livraisons Différées Élèves ({deferredDeliveries.length})</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-amber-100/30 text-[10px] font-black text-amber-900 uppercase tracking-widest border-b border-amber-200/50">
                    <th className="px-5 py-3.5">Élève & Classe</th>
                    <th className="px-5 py-3.5">Article Commandé & Réf. Vente</th>
                    <th className="px-5 py-3.5 text-center">Quantité</th>
                    <th className="px-5 py-3.5 text-center">Date Vente</th>
                    <th className="px-5 py-3.5 text-center">Disponibilité Stock</th>
                    <th className="px-5 py-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-200/40 text-xs">
                  {deferredDeliveries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-emerald-800 text-xs font-bold">
                        <ShieldCheck size={28} className="mx-auto text-emerald-600/60 mb-2" />
                        Aucune livraison différée en attente. Tous les articles vendus ont été remis aux élèves !
                      </td>
                    </tr>
                  ) : (
                    deferredDeliveries.map((rec) => {
                      const studentName = formatStudentName(rec.student?.last_name, rec.student?.first_name).fullName;
                      const className = rec.student?.class?.name || 'Classe N/A';
                      const catItem = catalog.find(c => c.id === rec.catalog_item_id);
                      const availableStock = Number(catItem?.stock_quantity ?? 0);
                      const isStockReady = availableStock >= (rec.quantity || 1);

                      return (
                        <tr key={rec.id} className="hover:bg-amber-100/40 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="font-extrabold text-slate-900">{studentName}</div>
                            <div className="text-[10px] font-bold text-slate-500">{className}</div>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-slate-800">{rec.description}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              Ref / Tx: {rec.transaction_id || rec.id.slice(0, 8)}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-center font-bold text-slate-900 font-mono">
                            {rec.quantity || 1}
                          </td>
                          <td className="px-5 py-3.5 text-center text-slate-600">
                            {rec.created_at ? new Date(rec.created_at).toLocaleDateString('fr-FR') : 'N/A'}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            {isStockReady ? (
                              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-black uppercase inline-flex items-center gap-1 border border-emerald-200">
                                <CheckCircle2 size={12} /> Stock Prêt ({availableStock} dispo)
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-lg text-[10px] font-black uppercase inline-flex items-center gap-1 border border-amber-300">
                                <Clock size={12} /> En attente fournisseur ({availableStock} dispo)
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <button
                              onClick={() => handleMarkDelivered(rec)}
                              className={`px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 mx-auto active:scale-95 ${
                                isStockReady
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse'
                                  : 'bg-slate-900 hover:bg-slate-800 text-white'
                              }`}
                            >
                              <CheckCircle size={14} />
                              <span>Honoré / Délivré</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      {/* MODAL MODIFICATION RAPIDE DE PRIX CATALOGUE (POUR DIRECTION/ÉCONOME) */}
      {editingPriceItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-400/30 text-indigo-300">
                  <Edit2 size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">Mise à jour Prix Catalogue</h3>
                  <p className="text-xs text-slate-300 font-medium">{editingPriceItem.label}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingPriceItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveQuickPrice} className="p-6 space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Prix Actuel :</span>
                <span className="font-mono font-black text-slate-900 text-sm">{editingPriceItem.current_price.toLocaleString()} HTG</span>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Nouveau Prix Vente Élève (HTG Gourdes)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    autoFocus
                    value={editingPriceItem.new_price}
                    onChange={(e) => setEditingPriceItem({ ...editingPriceItem, new_price: e.target.value })}
                    className="w-full pl-3.5 pr-14 py-2.5 bg-white border border-slate-300 rounded-xl text-lg font-black font-mono text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10"
                    placeholder="Ex: 250"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono font-bold text-xs text-slate-400">
                    HTG
                  </span>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingPriceItem(null)}
                  className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-500 shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                  Enregistrer Prix
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-20 px-4 md:px-0">
      
      {/* HEADER DE PILOTAGE */}
      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 md:gap-6 print:hidden">
        <div className="flex items-center gap-3 sm:gap-4 w-full xl:w-auto">
          <button 
            onClick={() => window.history.back()}
            className="p-2.5 sm:p-3 hover:bg-slate-100 transition-all text-slate-500 rounded-xl border border-slate-200 flex items-center justify-center shrink-0"
            title="Retour"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="space-y-0.5 text-left min-w-0 flex-1">
            <div className="flex items-center gap-2 text-slate-600 font-bold text-[10px] tracking-wider uppercase">
              <ShoppingBag size={14} className="text-indigo-600 shrink-0" /> UNITÉ COMMERCIALE SCOLAIRE
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight truncate">Fournitures & Services</h2>
            <p className="text-slate-500 text-xs sm:text-sm line-clamp-1">Gérez le catalogue et les ventes de fournitures scolaires.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 w-full xl:w-auto gap-1 shrink-0 overflow-x-auto max-w-full">
          <button 
            onClick={() => setViewMode("sales")} 
            className={`flex-1 xl:flex-none px-3.5 sm:px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${viewMode === "sales" ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"}`}
          >
            <ShoppingBag size={15} className="shrink-0" />
            <span>Transactions</span>
            <span className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 text-slate-700 rounded-md font-bold">{groupedRecords.length}</span>
          </button>
          
          <button 
            onClick={() => setViewMode("catalog")} 
            className={`flex-1 xl:flex-none px-3.5 sm:px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${viewMode === "catalog" ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"}`}
          >
            <Tag size={15} className="shrink-0" />
            <span>Catalogue Officiel</span>
            <span className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 text-slate-700 rounded-md font-bold">{catalog.length}</span>
          </button>
          
          <button 
            onClick={() => setViewMode("inventory")} 
            className={`flex-1 xl:flex-none px-3.5 sm:px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${viewMode === "inventory" ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"}`}
          >
            <Package size={15} className="shrink-0" />
            <span>Inventaire & Stocks</span>
            {catalog.some(i => (i.stock_quantity || 0) <= (i.low_stock_threshold || 5)) && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" title="Stock Bas présent" />
            )}
          </button>
        </div>
      </div>

      {!isSiegeActive && (
        <div className="bg-amber-50/80 border border-amber-200 text-amber-900 px-4 py-3.5 rounded-2xl text-xs flex gap-3 print:hidden animate-in slide-in-from-top-2 duration-200">
          <AlertCircle className="shrink-0 text-amber-600 mt-0.5" size={16} />
          <div>
            <div className="font-bold text-amber-950 text-sm">Mode Annexe Active - Traçabilité d'Économat renforcée</div>
            <p className="mt-0.5 text-amber-800 leading-relaxed">
              Toute modification locale apportée au catalogue officiel des fournitures ou à l'inventaire par rapport au référentiel du Siège Social est <strong className="font-bold underline text-amber-900">surveillée et journalisée de manière indélébile</strong>.
            </p>
          </div>
        </div>
      )}

      {viewMode === 'sales' && (
        <>
          {/* STATS GLOBALES ET FILTRÉES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Transactions</p>
                <p className="text-2xl font-black text-slate-900">{displayedStats.countTransactions}</p>
                <p className="text-[10px] text-slate-400 font-bold mt-1">
                  {dateFilterFrom || dateFilterTo ? 'Période filtrée' : 'Toutes périodes'}
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <Receipt size={22} />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center justify-between border-l-4 border-l-indigo-500">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Total Vendu</p>
                <p className="text-2xl font-black text-slate-900">
                  {displayedStats.totalVendu.toLocaleString()} <span className="text-xs font-normal text-slate-500">HTG</span>
                </p>
                <p className="text-[10px] text-slate-400 font-bold mt-1">Montant brut engagé</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <ShoppingBag size={22} />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex justify-between items-center border-l-4 border-l-emerald-500">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Total Encaissé</p>
                <p className="text-2xl font-black text-emerald-600">
                  {displayedStats.totalEncaisse.toLocaleString()} <span className="text-xs font-normal text-emerald-600/70">HTG</span>
                </p>
                <p className="text-[10px] text-emerald-600/80 font-bold mt-1">Montant perçu en caisse</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 size={22} />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex justify-between items-center border-l-4 border-l-amber-500">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Reste à Recouvrer</p>
                <p className="text-2xl font-black text-amber-600">
                  {(displayedStats.totalVendu - displayedStats.totalEncaisse).toLocaleString()} <span className="text-xs font-normal text-amber-600/70">HTG</span>
                </p>
                <p className="text-[10px] text-amber-600/80 font-bold mt-1">Créances à percevoir</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <DollarSign size={22} />
              </div>
            </div>
          </div>

          {/* BARRE DE FILTRAGE TRANSACTIONS */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4 print:hidden">
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              {/* RECHERCHE AVEC BOUTON CLEAR */}
              <div className="relative w-full lg:w-1/3 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder={`Rechercher élève, référence ou article...`} 
                  className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all text-slate-900 text-sm font-medium placeholder:text-slate-400"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* FILTRES DE STATUT DE PAIEMENT */}
              <div className="flex items-center gap-1.5 w-full lg:w-auto bg-slate-100 p-1 rounded-xl">
                <button 
                  onClick={() => setStatusFilter('all')} 
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${statusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  Toutes
                </button>
                <button 
                  onClick={() => setStatusFilter('paid')} 
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${statusFilter === 'paid' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-emerald-700'}`}
                >
                  Soldées
                </button>
                <button 
                  onClick={() => setStatusFilter('unpaid')} 
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${statusFilter === 'unpaid' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-500 hover:text-amber-700'}`}
                >
                  Créances / Non-Soldées
                </button>
              </div>

              {/* ACTION NOUVELLE VENTE POS */}
              <button 
                onClick={() => setViewMode('pos')} 
                className="w-full lg:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs tracking-wider shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 shrink-0"
              >
                <Plus size={18} /> Nouvelle Vente
              </button>
            </div>

            {/* SECONDE LIGNE FILTRES DATES ET ANNEE ACADEMIQUE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 pt-2 border-t border-slate-100 items-center">
              <div className="md:col-span-4">
                <AcademicSessionPill
                  academicYears={academicYears}
                  selectedYearId={selectedYearId}
                  onSelectYear={(yearId) => setSelectedYearId(yearId)}
                  size="sm"
                  colorScheme="slate"
                />
              </div>

              <div className="md:col-span-3">
                <DatePickerPill
                  selectedDate={dateFilterFrom}
                  onSelectDate={(d) => setDateFilterFrom(d)}
                  labelPrefix="Du"
                  placeholder="Date début"
                  clearable
                  variant="field"
                  size="sm"
                  colorScheme="slate"
                  className="w-full"
                />
              </div>

              <div className="md:col-span-3">
                <DatePickerPill
                  selectedDate={dateFilterTo}
                  onSelectDate={(d) => setDateFilterTo(d)}
                  labelPrefix="Au"
                  placeholder="Date fin"
                  clearable
                  variant="field"
                  size="sm"
                  colorScheme="slate"
                  className="w-full"
                />
              </div>

              <div className="md:col-span-2 flex justify-center">
                <button onClick={fetchData} title="Rafraîchir les données" className="p-2.5 w-full justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all border border-slate-200 flex items-center gap-2">
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                  <span>Actualiser</span>
                </button>
              </div>
            </div>
          </div>

          {/* TABLEAU DES TRANSACTIONS */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px] print:hidden">
             {loading ? (
                <div className="py-8">
                  <FluidLoadingState 
                    message="Chargement des fournitures, paniers & ventes d'articles..." 
                    subtext="Récupération du catalogue des stocks, commandes et historiques de vente..." 
                  />
                  <SkeletonTable rows={5} />
                </div>
             ) : (
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="bg-slate-50 text-[10px] font-black tracking-widest border-b border-slate-200 text-slate-400 uppercase">
                         <th className="px-6 py-4">ÉLÈVE & CLASSE</th>
                         <th className="px-6 py-4">DÉSIGNATION / PANIER</th>
                         <th className="px-6 py-4 text-right">MONTANT TOTAL</th>
                         <th className="px-6 py-4 text-right">PERÇU</th>
                         <th className="px-6 py-4 text-center">STATUT / BAL.</th>
                         <th className="px-6 py-4 text-center">ACTIONS</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {groupedRecords.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-bold text-xs">
                            Aucune transaction de fournitures enregistrée pour cette sélection.
                          </td>
                        </tr>
                      ) : (
                        groupedRecords
                          .filter(group => {
                          const balance = group.total_amount - group.paid_amount;
                          if (statusFilter === 'paid') return balance <= 0;
                          if (statusFilter === 'unpaid') return balance > 0;
                          return true;
                        })
                        .map((group) => {
                        const balance = group.total_amount - group.paid_amount;
                        const isExpanded = expandedGroups[group.group_key];
                        const studentName = formatStudentName(group.student?.last_name, group.student?.first_name).fullName;
                        const initials = studentName.split(' ').map((n: string) => n[0]).join('').substring(0,2).toUpperCase();

                        return (
                          <React.Fragment key={group.group_key}>
                            <tr className="group hover:bg-slate-50/70 transition-all cursor-pointer" onClick={() => toggleGroup(group.group_key)}>
                              <td className="px-6 py-4">
                                 <div className="flex items-center gap-3">
                                   <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 font-black text-xs flex items-center justify-center shrink-0 border border-slate-200">
                                     {initials || 'ST'}
                                   </div>
                                   <div>
                                     <p className="font-bold text-slate-900 text-sm">{studentName}</p>
                                     <div className="flex items-center gap-2 mt-0.5">
                                       <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{group.student?.class?.name || 'Classe non renseignée'}</span>
                                       <span className="text-[10px] font-medium text-slate-400">
                                         {new Date(group.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                                       </span>
                                     </div>
                                   </div>
                                 </div>
                              </td>

                              <td className="px-6 py-4">
                                 <div className="flex items-center gap-2">
                                   <Tag size={14} className="text-slate-400" />
                                   <span className="text-sm font-semibold text-slate-800 truncate max-w-[220px]">
                                     {group.items.length > 1 ? `${group.items.length} articles (Panier Multi-articles)` : group.items[0].description}
                                   </span>
                                   {group.items.length > 1 && (
                                     <ChevronDown size={14} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                   )}
                                 </div>
                                 {group.transaction_id !== 'Vente Individuelle' && (
                                   <p className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">Ref: {group.transaction_id}</p>
                                 )}
                              </td>

                              <td className="px-6 py-4 text-right font-mono font-bold text-slate-900 text-sm">{group.total_amount.toLocaleString()} G</td>
                              <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600 text-sm">{group.paid_amount.toLocaleString()} G</td>
                              
                              <td className="px-6 py-4 text-center">
                                 <span className={`px-2.5 py-1 rounded-lg font-black text-[10px] uppercase border tracking-wider ${balance <= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                    {balance <= 0 ? 'SOLDÉ' : `${balance.toLocaleString()} G`}
                                 </span>
                              </td>

                              <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                 <div className="flex items-center justify-center gap-1">
                                    <button onClick={() => setPrintJob(group)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all" title="Imprimer le reçu thermographique 80mm"><Printer size={16} /></button>
                                    <button onClick={() => setShowHistoryModal(group.items[0])} className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-all" title="Historique des paiements"><History size={16} /></button>
                                    <button onClick={() => { setDeleteId(group.transaction_id !== 'Vente Individuelle' ? group.transaction_id : group.items[0].id); setDeleteType('record'); }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all" title="Annuler/Supprimer la transaction"><Trash2 size={16} /></button>
                                 </div>
                              </td>
                            </tr>
                            {isExpanded && group.items.length > 1 && group.items.map((item: any) => (
                              <tr key={item.id} className="bg-slate-50/50 border-l-4 border-slate-400">
                                <td className="px-6 py-2.5 pl-12 text-[11px] font-bold text-slate-400 uppercase">
                                  Détail Panier
                                </td>
                                <td className="px-6 py-2.5 text-xs font-semibold text-slate-700">
                                  {item.description}
                                </td>
                                <td className="px-6 py-2.5 text-right font-mono text-xs text-slate-600">{item.total_amount.toLocaleString()} G</td>
                                <td className="px-6 py-2.5 text-right font-mono text-xs text-emerald-600 font-bold">{(item.paid_amount || 0).toLocaleString()} G</td>
                                <td className="px-6 py-2.5 text-center"></td>
                                <td className="px-6 py-2.5 text-center">
                                  <button onClick={() => { setDeleteId(item.id); setDeleteType('record'); }} className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-all" title="Supprimer cet article"><Trash2 size={13} /></button>
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })
                    )}
                   </tbody>
                </table>
             </div>
             )}
          </div>
        </>
      )}

      {viewMode === 'catalog' && (
        /* VUE GESTION CATALOGUE OFFICIEL */
        <div className="space-y-6 animate-in fade-in duration-300">
           {/* BARRE DE FILTRAGE CATALOGUE */}
           <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
             <div className="flex flex-col md:flex-row items-center justify-between gap-4">
               <div className="relative flex-1 w-full">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                 <input 
                   type="text" 
                   placeholder="Rechercher un article du catalogue..." 
                   className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all text-slate-900 text-sm font-medium placeholder:text-slate-400"
                   value={catalogSearchTerm}
                   onChange={e => setCatalogSearchTerm(e.target.value)}
                 />
                 {catalogSearchTerm && (
                   <button onClick={() => setCatalogSearchTerm('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                     <X size={16} />
                   </button>
                 )}
               </div>

               <div className="flex items-center gap-3 w-full md:w-auto">
                 {/* TOGGLE VUE TABLEAU / VUE GRILLE */}
                 <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                   <button 
                     onClick={() => setCatalogViewMode('table')}
                     className={`p-2 rounded-lg text-xs font-bold transition-all ${catalogViewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                     title="Vue Tableau"
                   >
                     <ListFilter size={16} />
                   </button>
                   <button 
                     onClick={() => setCatalogViewMode('grid')}
                     className={`p-2 rounded-lg text-xs font-bold transition-all ${catalogViewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                     title="Vue Cartes Grille"
                   >
                     <Package size={16} />
                   </button>
                 </div>

                 {user.role !== UserRole.SECRETARY && catalog.length === 0 && academicYears.length > 1 && (
                   <button 
                     onClick={() => setShowMigrateModal(true)}
                     disabled={isMigrating} 
                     className="px-5 py-3 bg-slate-100 text-slate-800 rounded-xl font-bold text-xs tracking-tight hover:bg-slate-200 transition-all flex items-center gap-2 border border-slate-200 shrink-0"
                   >
                      <RefreshCw size={16} className={isMigrating ? 'animate-spin' : ''} />
                      Migrer
                   </button>
                 )}

                 {user.role !== UserRole.SECRETARY && (
                   <button 
                     onClick={() => { setCatalogFormData({id:'', label:'', unit_price:'', category:'Fourniture', currency: 'HTG', planned_exchange_rate: '132.50', stock_quantity: '', low_stock_threshold: '5', discipline_name: '', unit_measure: 'Pièce'}); setShowCatalogModal(true); }} 
                     className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs shadow-md hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2 shrink-0"
                   >
                      <Plus size={18} /> Nouvel Article
                   </button>
                 )}
               </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
               <div>
                 <SelectPill
                   options={[
                     { value: 'Tous', label: `Toutes les catégories (${CATEGORIES.length})` },
                     ...CATEGORIES.map(cat => ({ value: cat, label: cat }))
                   ]}
                   value={activeCatalogCat}
                   onChange={(val) => setActiveCatalogCat(val)}
                   icon={Filter}
                   variant="field"
                   size="sm"
                   colorScheme="slate"
                   className="w-full"
                   searchable={CATEGORIES.length > 6}
                 />
               </div>

               <div>
                 <SelectPill
                   options={[
                     { value: 'Tous', label: 'Toutes les disciplines' },
                     ...disciplinesList.map(disc => ({ value: disc, label: disc }))
                   ]}
                   value={selectedDisciplineFilter}
                   onChange={(val) => setSelectedDisciplineFilter(val)}
                   icon={ListFilter}
                   variant="field"
                   size="sm"
                   colorScheme="slate"
                   className="w-full"
                   searchable={disciplinesList.length > 6}
                 />
               </div>

               <AcademicSessionPill
                 academicYears={academicYears}
                 selectedYearId={selectedYearId}
                 onSelectYear={(yearId) => setSelectedYearId(yearId)}
                 size="sm"
                 colorScheme="slate"
               />
             </div>
           </div>

           {selectedDisciplineFilter !== 'Tous' && filteredCatalog.filter(item => item.discipline_name === selectedDisciplineFilter).length === 0 && (
             <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 text-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in duration-300">
               <div className="flex gap-4 items-start">
                 <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shrink-0 mt-0.5"><Sparkles size={18} /></div>
                 <div>
                   <h4 className="font-extrabold text-sm text-slate-900">Articles Recommandés pour : {selectedDisciplineFilter}</h4>
                   <p className="text-xs text-slate-500 mt-0.5">Aucun produit spécifique n'est configuré pour cette discipline. Vous pouvez générer un kit standard d'articles requis (Syllabus, Uniforme, Trousse & Frais techniques) en un seul clic !</p>
                 </div>
               </div>
               <button 
                 onClick={handleGenerateRecs}
                 disabled={isGeneratingRecs}
                 className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs tracking-wider uppercase rounded-xl transition-all shadow-sm shadow-indigo-600/10 flex items-center gap-2 shrink-0 disabled:opacity-50 font-sans"
               >
                 {isGeneratingRecs ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                 Générer le Kit Recommandé
               </button>
             </div>
           )}

           {catalogViewMode === 'grid' ? (
             /* VUE GRILLE DE CARTES ERGONOMIQUE */
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
               {filteredCatalog.map(item => (
                 <div key={item.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                   <div>
                     <div className="flex items-center justify-between gap-2 mb-3">
                       <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-extrabold text-[10px] uppercase rounded-lg border border-slate-200">{item.category}</span>
                       <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                         (item.stock_quantity || 0) <= (item.low_stock_threshold || 5)
                           ? 'bg-rose-50 text-rose-600 border border-rose-200'
                           : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                       }`}>
                         {(item.stock_quantity || 0)} en stock
                       </span>
                     </div>
                     
                     <h3 className="font-extrabold text-slate-900 text-base leading-snug group-hover:text-indigo-600 transition-colors mb-2">{item.label}</h3>
                     
                     {item.discipline_name && (
                       <div className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg mb-3">
                         <Tag size={12} /> {item.discipline_name}
                       </div>
                     )}
                   </div>

                   <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
                     <div>
                       <p className="text-[10px] font-black uppercase text-slate-400">Prix unitaire / Unité</p>
                       <p className="text-xl font-black text-slate-900 font-mono">{item.unit_price.toLocaleString()} <span className="text-xs font-normal text-slate-500">HTG / {getItemUnitMeasure(item)}</span></p>
                     </div>

                     {user.role !== UserRole.SECRETARY && (
                       <div className="flex items-center gap-1">
                         <button 
                           onClick={() => { setCatalogFormData({id: item.id, label: item.label, unit_price: item.unit_price.toString(), category: item.category, currency: item.currency || 'HTG', planned_exchange_rate: (item.planned_exchange_rate || 132.50).toString(), stock_quantity: (item.stock_quantity || 0).toString(), low_stock_threshold: (item.low_stock_threshold || 5).toString(), discipline_name: getItemCleanDiscipline(item) || '', unit_measure: getItemUnitMeasure(item)}); setShowCatalogModal(true); }} 
                           className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all" 
                           title="Modifier"
                         >
                           <Edit2 size={16} />
                         </button>
                         <button 
                           onClick={() => { setDeleteId(item.id); setDeleteType('catalog'); }} 
                           className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all" 
                           title="Supprimer"
                         >
                           <Trash2 size={16} />
                         </button>
                       </div>
                     )}
                   </div>
                 </div>
               ))}
               {filteredCatalog.length === 0 && (
                 <div className="col-span-full py-20 bg-white rounded-2xl border border-slate-200 text-center">
                   <AlertCircle size={40} className="mx-auto text-slate-300 mb-3" />
                   <p className="text-slate-500 font-bold text-sm">Aucun article dans cette sélection</p>
                 </div>
               )}
             </div>
           ) : (
             /* VUE TABLEAU RESTRUCTURÉE ET ÉPURÉE */
             <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
                <div className="overflow-x-auto">
                   <table className="w-full text-left border-collapse">
                      <thead>
                         <tr className="bg-slate-50 text-[10px] font-black tracking-widest border-b border-slate-200 text-slate-400 uppercase">
                            <th className="px-6 py-4">CATÉGORIE</th>
                            <th className="px-6 py-4">ARTICLE & PROGRAMME</th>
                            <th className="px-6 py-4">UNITÉ</th>
                            <th className="px-6 py-4 text-right">DISPONIBILITÉ STOCK</th>
                            <th className="px-6 py-4 text-right">PRIX UNITAIRE (HTG)</th>
                            {user.role !== UserRole.SECRETARY && <th className="px-6 py-4 text-center">ACTIONS</th>}
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {filteredCatalog.map(item => (
                           <tr key={item.id} className="group hover:bg-slate-50/70 transition-colors">
                             <td className="px-6 py-4">
                                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-extrabold text-[10px] tracking-wider uppercase border border-slate-200">{item.category}</span>
                             </td>
                             <td className="px-6 py-4">
                                <p className="text-sm font-bold text-slate-900">{item.label}</p>
                                {item.discipline_name ? (
                                  <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                                    <Tag size={10} /> {item.discipline_name}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-slate-400">
                                    Tous programmes
                                  </span>
                                )}
                             </td>
                             <td className="px-6 py-4 font-bold text-xs text-indigo-700">
                                <span className="px-2.5 py-1 bg-indigo-50 rounded-lg border border-indigo-100">{getItemUnitMeasure(item)}</span>
                             </td>
                             <td className="px-6 py-4 text-right">
                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono ${
                                  (item.stock_quantity || 0) <= (item.low_stock_threshold || 5) 
                                    ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                }`}>
                                  {item.stock_quantity || 0} en stock
                                </span>
                             </td>
                             <td className="px-6 py-4 text-right">
                                <p className="text-base font-black text-slate-900 tracking-tight font-mono">{item.unit_price.toLocaleString()} <span className="text-xs font-normal text-slate-500">HTG / {getItemUnitMeasure(item)}</span></p>
                             </td>
                             {user.role !== UserRole.SECRETARY && (
                               <td className="px-6 py-4 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                     <button onClick={() => { setCatalogFormData({id: item.id, label: item.label, unit_price: item.unit_price.toString(), category: item.category, currency: item.currency || 'HTG', planned_exchange_rate: (item.planned_exchange_rate || 132.50).toString(), stock_quantity: (item.stock_quantity || 0).toString(), low_stock_threshold: (item.low_stock_threshold || 5).toString(), discipline_name: getItemCleanDiscipline(item) || '', unit_measure: getItemUnitMeasure(item)}); setShowCatalogModal(true); }} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all" title="Modifier"><Edit2 size={16} /></button>
                                     <button onClick={() => { setDeleteId(item.id); setDeleteType('catalog'); }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all" title="Supprimer"><Trash2 size={16} /></button>
                                  </div>
                               </td>
                             )}
                           </tr>
                         ))}
                         {filteredCatalog.length === 0 && (
                           <tr>
                             <td colSpan={user.role !== UserRole.SECRETARY ? 5 : 4} className="py-24 text-center">
                                <AlertCircle size={40} className="mx-auto text-slate-300 mb-3" />
                                <p className="text-slate-500 font-bold text-xs">Aucun article dans cette sélection</p>
                             </td>
                           </tr>
                         )}
                      </tbody>
                   </table>
                </div>
             </div>
           )}
        </div>
      )}

       {viewMode === 'inventory' && renderInventoryView()}

      {viewMode === 'pos' && (
        <SuppliesPOS 
          user={user}
          catalog={catalog}
          classes={classes}
          selectedYearId={selectedYearId}
          selectedYearLabel={academicYears.find(y => y.id === selectedYearId)?.label || ''}
          onClose={() => setViewMode('sales')}
          onSuccess={() => {
            setViewMode('sales');
            fetchData();
          }}
        />
      )}

      {/* MODALE CATALOGUE (ÉDITEUR D'ARTICLES) */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-[300] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-0 md:p-4 animate-in fade-in duration-300">
           <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-xl shadow-sm overflow-y-auto flex flex-col animate-in zoom-in-95">
              <div className="p-4 md:p-6 lg:p-8 bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between sticky top-0 z-10 gap-4">
                <div className="flex items-center justify-between w-full md:w-auto">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100"><Sparkles size={24} /></div>
                     <div>
                       <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none">{catalogFormData.id ? 'Ajuster Tarification' : 'Nouvel Article'}</h3>
                       <p className="text-xs font-semibold text-slate-500 mt-1">Catalogue Officiel</p>
                     </div>
                  </div>
                  <button onClick={() => setShowCatalogModal(false)} className="p-2 md:hidden text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors flex items-center justify-center">
                    <X size={24} />
                  </button>
                </div>
                <button onClick={() => setShowCatalogModal(false)} className="hidden md:flex px-4 py-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors items-center gap-2 font-bold border border-transparent">
                  <span className="text-sm font-bold tracking-tight">Fermer</span>
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSaveCatalog} className="p-4 md:p-6 lg:p-8 space-y-8 flex-1">
                 <div className="space-y-3">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Libellé de l'Article</label>
                    <input required type="text" placeholder="Ex: Uniforme Complet Secondaire" className="w-full px-5 py-3.5 bg-slate-50 text-slate-900 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 shadow-sm transition-all" value={catalogFormData.label} onChange={e => setCatalogFormData({...catalogFormData, label: e.target.value})} />
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                    <div className="space-y-3">
                       <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Catégorie</label>
                       <SelectPill
                         options={CATEGORIES.map(c => ({ value: c, label: c }))}
                         value={catalogFormData.category}
                         onChange={(val) => setCatalogFormData({ ...catalogFormData, category: val })}
                         variant="field"
                         size="md"
                         colorScheme="indigo"
                         className="w-full"
                       />
                    </div>
                    <div className="space-y-3">
                       <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Discipline Associée (Optionnel)</label>
                       <SelectPill
                         options={[
                           { value: '', label: 'Tous programmes / Générique' },
                           ...disciplinesList.map(disc => ({ value: disc, label: disc }))
                         ]}
                         value={catalogFormData.discipline_name || ''}
                         onChange={(val) => setCatalogFormData({ ...catalogFormData, discipline_name: val })}
                         variant="field"
                         size="md"
                         colorScheme="indigo"
                         className="w-full"
                         searchable={disciplinesList.length > 5}
                       />
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                    <div className="space-y-3">
                       <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-2">
                          <DollarSign size={14} /> Prix Unitaire
                       </label>
                       <input required type="number" step="0.01" className="w-full px-5 py-3.5 bg-white border-2 border-slate-200 rounded-xl text-xl font-bold text-slate-900 outline-none focus:border-indigo-500 shadow-sm font-mono transition-all" value={catalogFormData.unit_price} onChange={e => setCatalogFormData({...catalogFormData, unit_price: e.target.value})} />
                    </div>
                    <div className="space-y-3">
                       <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Devise de Vente</label>
                       <SelectPill
                         options={[
                           { value: 'HTG', label: 'Gourdes (HTG)' },
                           { value: 'USD', label: 'Dollars (USD)' }
                         ]}
                         value={catalogFormData.currency || 'HTG'}
                         onChange={(val) => setCatalogFormData({ ...catalogFormData, currency: val })}
                         variant="field"
                         size="md"
                         colorScheme="indigo"
                         className="w-full"
                       />
                    </div>
                 </div>

                 {catalogFormData.currency === 'USD' && (
                   <div className="space-y-3">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-2">
                         <DollarSign size={14} /> Taux de change planifié (USD vers HTG)
                      </label>
                      <input required type="number" step="0.01" className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-lg font-bold text-slate-900 outline-none focus:border-indigo-500 shadow-sm font-mono transition-all" value={catalogFormData.planned_exchange_rate} onChange={e => setCatalogFormData({...catalogFormData, planned_exchange_rate: e.target.value})} />
                   </div>
                 )}

                 <div className="space-y-3">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Unité de Vente / Mesure</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <SelectPill
                        options={[
                          { value: 'Pièce', label: 'Pièce / Article individuel' },
                          { value: 'Aune', label: 'Aune (Tissu / Uniforme)' },
                          { value: 'Paquet', label: 'Paquet / Ramette' },
                          { value: 'Mètre', label: 'Mètre (Ruban, Tissu)' },
                          { value: 'Paire', label: 'Paire (Chaussettes, Chaussures)' },
                          { value: 'Ensemble', label: 'Ensemble complet' },
                          { value: 'Unité', label: 'Unité générale' },
                          { value: 'Carton', label: 'Carton' },
                          { value: 'Boîte', label: 'Boîte' },
                          { value: 'Rouleau', label: 'Rouleau' },
                          { value: 'Dozaine', label: 'Dozaine' },
                          { value: 'Autre', label: 'Autre (Saisie libre...)' }
                        ]}
                        value={['Aune', 'Pièce', 'Mètre', 'Paquet', 'Paire', 'Ensemble', 'Unité', 'Carton', 'Boîte', 'Rouleau', 'Dozaine'].includes(catalogFormData.unit_measure) ? catalogFormData.unit_measure : 'Autre'}
                        onChange={(val) => {
                          if (val !== 'Autre') {
                            setCatalogFormData({ ...catalogFormData, unit_measure: val });
                          } else {
                            setCatalogFormData({ ...catalogFormData, unit_measure: '' });
                          }
                        }}
                        variant="field"
                        size="md"
                        colorScheme="indigo"
                        className="w-full"
                      />

                      {(!['Aune', 'Pièce', 'Mètre', 'Paquet', 'Paire', 'Ensemble', 'Unité', 'Carton', 'Boîte', 'Rouleau', 'Dozaine'].includes(catalogFormData.unit_measure)) && (
                        <input
                          type="text"
                          placeholder="Nom de l'unité (ex: Sac, Livre, etc.)"
                          className="w-full px-5 py-3.5 bg-white text-slate-900 border-2 border-indigo-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 shadow-sm transition-all"
                          value={catalogFormData.unit_measure}
                          onChange={e => setCatalogFormData({...catalogFormData, unit_measure: e.target.value})}
                        />
                      )}
                    </div>
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                    <div className="space-y-3">
                       <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Quantité (Stock Initial/Actuel)</label>
                       <input required type="number" step="any" className="w-full px-5 py-3.5 bg-white text-slate-900 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 shadow-sm transition-all" value={catalogFormData.stock_quantity} onChange={e => setCatalogFormData({...catalogFormData, stock_quantity: e.target.value})} />
                    </div>
                    <div className="space-y-3">
                       <label className="text-[11px] font-bold text-rose-500 uppercase tracking-wider ml-1">Seuil Alerte (Stock Bas)</label>
                       <input required type="number" step="any" className="w-full px-5 py-3.5 bg-white text-rose-900 border-2 border-rose-200 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 rounded-xl text-sm font-bold outline-none shadow-sm transition-all" value={catalogFormData.low_stock_threshold} onChange={e => setCatalogFormData({...catalogFormData, low_stock_threshold: e.target.value})} />
                    </div>
                 </div>

                 <div className="pt-2">
                    <button disabled={isSubmitting} type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl text-sm font-bold tracking-tight shadow-md shadow-indigo-600/20 hover:bg-indigo-700 hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3">
                      {isSubmitting ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}
                      Enregistrer au Registre
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* MODAL VENTE REMPLACÉ PAR LE POS */}

      {/* APERÇU REÇU THERMIQUE & FICHE DE VENTE MODERNE ET SOUPLE */}
      {printJob && (
        <ModernSaleReceiptModal
          isOpen={!!printJob}
          onClose={() => setPrintJob(null)}
          transactionRef={printJob.transaction_id !== 'Vente Individuelle' ? printJob.transaction_id : (printJob.items[0]?.id?.substring(0, 8).toUpperCase() || 'TX')}
          created_at={printJob.created_at || new Date()}
          student={printJob.student}
          items={printJob.items?.map((it: any) => ({
            id: it.id,
            label: it.description || it.label,
            description: it.description,
            unit_price: (it.total_amount || 0) / (it.quantity || 1),
            quantity: it.quantity || 1,
            currency: it.currency || 'HTG',
            total_amount: it.total_amount
          }))}
          totalAmount={printJob.paid_amount || printJob.total_amount}
          currency="HTG"
          paymentMethod={printJob.payment_method || 'Cash (Comptant)'}
          bankName={printJob.bank_name}
          referenceNumber={printJob.reference_number}
          cashierName={cashierName}
          schoolDetails={schoolDetails}
          academicYearLabel={academicYears.find(y => y.id === selectedYearId)?.label || ''}
        />
      )}

      <style>{`
        @media print {
          body * { visibility: hidden !important; background: white !important; color: black !important; margin: 0 !important; }
          .print\\:hidden { display: none !important; }
          #thermal-supply-receipt { 
            visibility: visible !important;
            position: absolute !important; left: 0 !important; top: 0 !important;
            width: 80mm !important; margin: 0 !important; padding: 5mm !important;
            display: flex !important; flex-direction: column !important; align-items: center !important;
            box-shadow: none !important; border: none !important;
            font-family: 'Courier New', Courier, monospace !important;
            color: black !important;
            page-break-after: always !important;
            break-after: page !important;
          }
          #thermal-supply-receipt * { 
            visibility: visible !important; 
            color: black !important;
            border-color: black !important;
          }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { size: 80mm auto; margin: 0; }
        }
      `}</style>

      <Modal
        isOpen={showMigrateModal}
        onClose={() => { setShowMigrateModal(false); setMigrateSourceId(''); }}
        onConfirm={handleMigrateCatalog}
        isLoading={isMigrating}
        title="Migration du Catalogue"
        confirmLabel="Migrer le catalogue"
        type="info"
      >
        <div className="space-y-4 mt-4 text-left">
          <p className="text-sm text-gray-600">
            Sélectionnez l'année scolaire source depuis laquelle vous souhaitez copier le catalogue vers la session actuelle :
          </p>
          <SelectPill
            options={[
              { value: '', label: 'Choisir une session source...' },
              ...academicYears.filter(y => y.id !== selectedYearId).map(y => ({
                value: y.id,
                label: `${y.label} ${y.is_active ? '(Active)' : ''}`
              }))
            ]}
            value={migrateSourceId}
            onChange={(val) => setMigrateSourceId(val)}
            placeholder="Choisir une session source..."
            variant="field"
            size="md"
            colorScheme="indigo"
            className="w-full"
          />
        </div>
      </Modal>

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={performDelete} type="danger" title="Confirmation" message={deleteType === 'catalog' ? "Voulez-vous retirer cet article du catalogue ? Cela n'effacera pas les ventes passées mais bloquera les futures." : "Voulez-vous annuler ce dossier de vente ?"} />
      {/* MODALE DE RÉAPPROVISIONNEMENT & COMMANDES FOURNISSEURS */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* HEADER DE LA MODALE */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-500/20 text-indigo-300 rounded-xl flex items-center justify-center border border-indigo-500/30">
                  <Truck size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white tracking-tight leading-none">Réapprovisionnement des Stocks</h3>
                  <p className="text-[11px] text-slate-300 mt-1">Fournisseurs, coûts d'achat & sorties de caisse</p>
                </div>
              </div>
              
              {/* SELECTEUR DE MODE : UNITAIRE vs EN LOT */}
              <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
                <button
                  type="button"
                  onClick={() => setPurchaseMode('single')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${purchaseMode === 'single' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  Unitaire
                </button>
                <button
                  type="button"
                  onClick={() => setPurchaseMode('batch')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${purchaseMode === 'batch' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  En Lot / Groupé
                </button>
              </div>

              <button onClick={() => setShowPurchaseModal(false)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors ml-2">
                <X size={20} />
              </button>
            </div>

            {/* FORMULAIRE UNITAIRE */}
            {purchaseMode === 'single' ? (
              <form onSubmit={handleRecordPurchase} className="p-6 overflow-y-auto space-y-5">
                
                {/* ARTICLE CONCERNÉ */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                    <span>Article à Réapprovisionner</span>
                    {purchaseFormData.item_id && (
                      <span className="text-indigo-600 font-bold">
                        Stock actuel: {catalog.find(i => i.id === purchaseFormData.item_id)?.stock_quantity || 0}
                      </span>
                    )}
                  </label>
                  <SelectPill
                    options={[
                      { value: '', label: 'Sélectionner un article du catalogue...' },
                      ...catalog.map(item => ({
                        value: item.id,
                        label: `${item.label} — (Prix Vente: ${item.unit_price} HTG | Stock: ${item.stock_quantity || 0})`
                      }))
                    ]}
                    value={purchaseFormData.item_id}
                    onChange={(val) => handleSelectPurchaseItem(val)}
                    placeholder="Sélectionner un article du catalogue..."
                    variant="field"
                    size="md"
                    colorScheme="indigo"
                    className="w-full"
                    searchable={catalog.length > 5}
                  />
                </div>

                {/* FOURNISSEUR ET DATE */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fournisseur</label>
                    <div className="space-y-2">
                      <SelectPill
                        options={[
                          { value: 'AUTRE', label: '--- Saisir un fournisseur personnalisé ---' },
                          ...knownSuppliers.map(s => ({ value: s, label: s }))
                        ]}
                        value={knownSuppliers.includes(purchaseFormData.supplier) ? purchaseFormData.supplier : 'AUTRE'}
                        onChange={(val) => {
                          if (val !== 'AUTRE') {
                            setPurchaseFormData({ ...purchaseFormData, supplier: val });
                          }
                        }}
                        variant="field"
                        size="sm"
                        colorScheme="slate"
                        className="w-full"
                        searchable={knownSuppliers.length > 5}
                      />

                      <input 
                        required
                        type="text"
                        placeholder="Nom du fournisseur (ex: Maison Deschamps)..."
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 outline-none"
                        value={purchaseFormData.supplier}
                        onChange={(e) => setPurchaseFormData({ ...purchaseFormData, supplier: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date d'Achat & Décaissement</label>
                    <DatePickerPill
                      selectedDate={purchaseFormData.date}
                      onSelectDate={(d) => setPurchaseFormData({ ...purchaseFormData, date: d })}
                      variant="field"
                      size="md"
                      colorScheme="indigo"
                      className="w-full"
                    />
                  </div>
                </div>

                {/* TARIFICATION ET COMPARAISON ACHAT / VENTE */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-600">Analyse Prix & Marge</span>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-lg">
                      Devise: HTG (Gourdes)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Prix d'Achat Fournisseur</label>
                      <div className="relative mt-1">
                        <input 
                          required
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black font-mono text-slate-900 outline-none focus:border-indigo-600"
                          value={purchaseFormData.unit_cost}
                          onChange={(e) => setPurchaseFormData({ ...purchaseFormData, unit_cost: e.target.value })}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">G</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Prix Vente Élèves</label>
                      <div className="relative mt-1">
                        <input 
                          disabled
                          type="text"
                          className="w-full pl-3 pr-8 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-black font-mono text-slate-700 cursor-not-allowed"
                          value={catalog.find(i => i.id === purchaseFormData.item_id)?.unit_price || 0}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">G</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Quantité Achetée</label>
                      <input 
                        required
                        type="number"
                        min="1"
                        className="w-full px-3 py-2.5 mt-1 bg-white border border-slate-200 rounded-xl text-sm font-black font-mono text-slate-900 outline-none focus:border-indigo-600"
                        value={purchaseFormData.quantity}
                        onChange={(e) => setPurchaseFormData({ ...purchaseFormData, quantity: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* CALCUL DE MARGE STIMÉE */}
                  {purchaseFormData.item_id && (
                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-600">Marge Brute par Unité :</span>
                      {(() => {
                        const sell = catalog.find(i => i.id === purchaseFormData.item_id)?.unit_price || 0;
                        const buy = parseFloat(purchaseFormData.unit_cost) || 0;
                        const margin = sell - buy;
                        const pct = buy > 0 ? ((margin / buy) * 100).toFixed(1) : '0';
                        return (
                          <span className={`font-mono font-black ${margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {margin >= 0 ? '+' : ''}{margin.toLocaleString()} HTG ({pct}%)
                          </span>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <div className="bg-gradient-to-br from-rose-50 via-rose-50/90 to-amber-50/40 p-4 rounded-2xl border border-rose-200 shadow-sm flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-xs font-black uppercase tracking-wider text-rose-950">
                      Sortie de Caisse
                    </span>
                    <div className="text-2xl font-black font-mono text-rose-700 tracking-tight flex items-baseline gap-1.5">
                      <span>-{((parseInt(purchaseFormData.quantity) || 0) * (parseFloat(purchaseFormData.unit_cost) || 0)).toLocaleString()}</span>
                      <span className="text-xs font-bold font-sans text-rose-900/80">HTG</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-rose-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-rose-600/20 shrink-0">
                    <DollarSign size={20} />
                  </div>
                </div>

                {/* BOUTONS D'ACTION */}
                <div className="pt-2 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowPurchaseModal(false)}
                    className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition-all"
                  >
                    Annuler
                  </button>
                  <button 
                    disabled={isSubmitting || !purchaseFormData.item_id || !purchaseFormData.supplier.trim()}
                    type="submit"
                    className="flex-1 py-3 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                    Enregistrer & Valider Décaissement
                  </button>
                </div>
              </form>
            ) : (
              /* FORMULAIRE GROUPÉ / BON DE COMMANDE */
              <form onSubmit={handleRecordBatchPurchase} className="p-6 overflow-y-auto space-y-5">
                
                {/* FOURNISSEUR & DATE BATCH */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fournisseur du Lot</label>
                    <div className="space-y-2">
                      <SelectPill
                        options={[
                          { value: 'AUTRE', label: '--- Choisir un fournisseur connu ---' },
                          ...knownSuppliers.map(s => ({ value: s, label: s }))
                        ]}
                        value={knownSuppliers.includes(batchSupplier) ? batchSupplier : 'AUTRE'}
                        onChange={(val) => {
                          if (val !== 'AUTRE') setBatchSupplier(val);
                        }}
                        variant="field"
                        size="sm"
                        colorScheme="slate"
                        className="w-full"
                        searchable={knownSuppliers.length > 5}
                      />

                      <input 
                        required
                        type="text"
                        placeholder="Fournisseur principal..."
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 outline-none"
                        value={batchSupplier}
                        onChange={(e) => setBatchSupplier(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date de Commande</label>
                    <DatePickerPill
                      selectedDate={batchDate}
                      onSelectDate={(d) => setBatchDate(d)}
                      variant="field"
                      size="md"
                      colorScheme="indigo"
                      className="w-full"
                    />
                  </div>
                </div>

                {/* TABLE DES ARTICLES DU LOT */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-400">Articles à Commander en Lot ({batchItems.length})</span>
                    <button
                      type="button"
                      onClick={() => setBatchItems([...batchItems, { item_id: '', quantity: '10', unit_cost: '' }])}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <Plus size={14} /> Ajouter une ligne
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {batchItems.map((row, idx) => {
                      const selItem = catalog.find(i => i.id === row.item_id);
                      const cost = parseFloat(row.unit_cost) || 0;
                      const qty = parseInt(row.quantity) || 0;
                      const lineTotal = cost * qty;

                      return (
                        <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center gap-2">
                          <div className="flex-1 w-full">
                            <SelectPill
                              options={[
                                { value: '', label: 'Sélectionner un article...' },
                                ...catalog.map(cat => ({
                                  value: cat.id,
                                  label: `${cat.label} (Stock: ${cat.stock_quantity || 0})`
                                }))
                              ]}
                              value={row.item_id}
                              onChange={(newId) => {
                                const lastInfo = getLastPurchaseInfo(newId);
                                const item = catalog.find(i => i.id === newId);
                                const newRows = [...batchItems];
                                newRows[idx].item_id = newId;
                                newRows[idx].unit_cost = lastInfo?.unitCost ? lastInfo.unitCost.toString() : (item?.unit_price ? Math.round(item.unit_price * 0.6).toString() : '');
                                setBatchItems(newRows);
                              }}
                              placeholder="Sélectionner un article..."
                              variant="field"
                              size="sm"
                              colorScheme="indigo"
                              className="w-full"
                              searchable={catalog.length > 5}
                            />
                          </div>

                          <div className="w-full sm:w-24">
                            <input
                              required
                              type="number"
                              min="1"
                              placeholder="Qte"
                              className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none"
                              value={row.quantity}
                              onChange={(e) => {
                                const newRows = [...batchItems];
                                newRows[idx].quantity = e.target.value;
                                setBatchItems(newRows);
                              }}
                            />
                          </div>

                          <div className="w-full sm:w-28">
                            <input
                              required
                              type="number"
                              step="0.01"
                              placeholder="Coût Achat (G)"
                              className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none"
                              value={row.unit_cost}
                              onChange={(e) => {
                                const newRows = [...batchItems];
                                newRows[idx].unit_cost = e.target.value;
                                setBatchItems(newRows);
                              }}
                            />
                          </div>

                          <div className="w-full sm:w-28 text-right font-mono font-bold text-xs text-rose-600">
                            -{lineTotal.toLocaleString()} G
                          </div>

                          {batchItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setBatchItems(batchItems.filter((_, i) => i !== idx))}
                              className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-rose-50 via-rose-50/90 to-amber-50/40 p-4 rounded-2xl border border-rose-200 shadow-sm flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-xs font-black uppercase tracking-wider text-rose-950">
                      Total Sortie de Caisse
                    </span>
                    <div className="text-2xl font-black font-mono text-rose-700 tracking-tight flex items-baseline gap-1.5">
                      <span>-{batchItems.reduce((acc, r) => acc + (parseInt(r.quantity) || 0) * (parseFloat(r.unit_cost) || 0), 0).toLocaleString()}</span>
                      <span className="text-xs font-bold font-sans text-rose-900/80">HTG</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-rose-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-rose-600/20 shrink-0">
                    <Receipt size={20} />
                  </div>
                </div>

                {/* BOUTONS D'ACTION */}
                <div className="pt-2 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowPurchaseModal(false)}
                    className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition-all"
                  >
                    Annuler
                  </button>
                  <button 
                    disabled={isSubmitting || !batchSupplier.trim() || batchItems.every(r => !r.item_id)}
                    type="submit"
                    className="flex-1 py-3 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                    Valider la Commande Groupée
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL D'AJUSTEMENT PHYSIQUE DE STOCK & COMPTAGE */}
      <InventoryAdjustmentModal
        isOpen={!!adjustingStockItem}
        onClose={() => setAdjustingStockItem(null)}
        item={adjustingStockItem}
        onSaveAdjustment={handleSaveInventoryAdjustment}
        isSubmitting={isSubmitting}
      />

      {/* MODAL FICHE D'INVENTAIRE A4 IMPRIMABLE & EXCEL */}
      <PrintableInventoryModal
        isOpen={showInventorySheetModal}
        onClose={() => setShowInventorySheetModal(false)}
        catalog={catalog}
        schoolDetails={schoolDetails}
        academicYearLabel={academicYears.find(y => y.id === selectedYearId)?.label || 'Année Académique'}
        selectedCategory={inventoryCategoryFilter}
      />
    </div>
  );
};

export default SuppliesView;