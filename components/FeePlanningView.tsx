import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Plus, Settings2, Save, Trash2, Edit3, Info, CreditCard, Layers,
  ChevronDown, DollarSign, TrendingUp, X, School, CheckCircle2,
  Loader2, CalendarDays, RefreshCw, AlertCircle, ArrowLeft, History, Search,
  Send, Download, Sparkles, Building2, Globe, SlidersHorizontal, Percent, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import { UserProfile, SchoolClass, UserRole } from '../types';
import Modal from './Modal';
import { useSchool } from '../contexts/SchoolContext';
import { AuditLogger } from '../utils/auditLogger';
import FeeHistoryModal from './FeeHistoryModal';
import { FluidLoadingState, SkeletonTable } from './SkeletonLoader';
import { AcademicSessionPill } from './AcademicSessionPill';
import { ClassSelectorPill } from './ClassSelectorPill';
import { SelectPill } from './SelectPill';

interface AcademicYear {
  id: string;
  label: string;
  is_active: boolean;
  status?: 'ACTIVE' | 'FUTURE' | 'ARCHIVED';
}

interface FeePlan {
  id: string;
  class_id: string;
  academic_year_id: string;
  inscription_fee: number;
  inscription_fee_usd?: number;
  reenrollment_fee: number;
  reenrollment_fee_usd?: number;
  tuition_fee: number;
  tuition_fee_usd?: number;
  misc_fee_usd: number;
  misc_fee_htg: number;
  is_misc_mandatory: boolean;
  payment_structure?: { label: string; amount: number; due_date?: string }[];
  class?: {
    name: string;
    level: string;
    campus_id?: string;
  };
}

const FeePlanningView: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { terminology, school, currentCampusId, campuses } = useSchool();
  const siegeCampus = campuses?.find(
    (c) =>
      c.name.toLowerCase().includes("siège") ||
      c.name.toLowerCase().includes("siege")
  );
  const siegeCampusId = siegeCampus ? siegeCampus.id : null;
  const isSiegeActive = !user.campus_id && (!currentCampusId || currentCampusId === siegeCampusId);

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeCycle, setActiveCycle] = useState('Tous');

  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [plans, setPlans] = useState<FeePlan[]>([]);
  const [isMigrating, setIsMigrating] = useState(false);
  const [showMigrateModal, setShowMigrateModal] = useState(false);
  const [migrateSourceId, setMigrateSourceId] = useState<string>('');
  
  const [showHistoryForPlan, setShowHistoryForPlan] = useState<{id: string, className: string} | null>(null);
  const [pendingPropagation, setPendingPropagation] = useState<{
    type: 'inscription' | 'reenrollment' | 'tuition' | 'misc' | 'all';
    val: number;
    currency: 'HTG' | 'USD';
    label: string;
    targetCount: number;
    scope?: 'current_campus' | 'all_campuses';
  } | null>(null);

  const [injectModal, setInjectModal] = useState<{
    isOpen: boolean;
    selectedCampusIds: string[];
    isSubmitting: boolean;
    success: string | null;
    error: string | null;
  }>({
    isOpen: false,
    selectedCampusIds: [],
    isSubmitting: false,
    success: null,
    error: null,
  });

  const [importModal, setImportModal] = useState<{
    isOpen: boolean;
    isSubmitting: boolean;
    success: string | null;
    error: string | null;
  }>({
    isOpen: false,
    isSubmitting: false,
    success: null,
    error: null,
  });

  const [showBulkAdjustModal, setShowBulkAdjustModal] = useState(false);
  const [bulkAdjustConfig, setBulkAdjustConfig] = useState<{
    feeTarget: 'tuition' | 'inscription' | 'reenrollment' | 'misc' | 'all';
    adjustType: 'PERCENT' | 'ADD_AMOUNT' | 'SET_FIXED';
    value: number;
    currency: 'HTG' | 'USD';
    cycleTarget: string;
  }>({
    feeTarget: 'tuition',
    adjustType: 'PERCENT',
    value: 10,
    currency: 'HTG',
    cycleTarget: 'ALL'
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const schoolId = user.school_id;
    if (!schoolId) {
      setLoading(false);
      return;
    }

    const cacheKeyYears = `edunova_cached_years_${schoolId}`;
    const cacheKeyClasses = `edunova_cached_classes_${schoolId}_${currentCampusId || 'GLOBAL'}`;

    // Read caches first for immediate, low-bandwidth/offline responsive load
    try {
      const cachedYears = localStorage.getItem(cacheKeyYears);
      if (cachedYears) {
        const parsedYears = JSON.parse(cachedYears);
        setAcademicYears(parsedYears);
        if (parsedYears.length > 0) {
          const active = parsedYears.find((y: any) => y.is_active || y.status === 'ACTIVE') || parsedYears[0];
          setSelectedYearId(active.id);
        }
      }
      const cachedClasses = localStorage.getItem(cacheKeyClasses);
      if (cachedClasses) {
        setClasses(JSON.parse(cachedClasses));
      }
    } catch (e) {
      console.warn("Cache read warning:", e);
    }

    try {
      // 1. Charger les années académiques (Seulement Active et Future)
      const { data: ayData, error: ayError } = await supabase
        .from('academic_years')
        .select('*')
        .eq('school_id', schoolId)
        .order('label', { ascending: false });

      if (ayError) {
        console.error("Erreur chargement années académiques:", ayError);
      }

      if (ayData && ayData.length > 0) {
        // Fallback: if status is missing, use is_active
        const filtered = ayData.filter(y => y.status === 'ACTIVE' || y.status === 'FUTURE' || y.is_active);
        const finalYears = filtered.length > 0 ? filtered : ayData;
        setAcademicYears(finalYears);
        const active = finalYears.find(y => y.is_active || y.status === 'ACTIVE') || finalYears[0];
        setSelectedYearId(active.id);
        try {
          localStorage.setItem(cacheKeyYears, JSON.stringify(finalYears));
        } catch (e) {}
      } else {
        // Fallback: Créer une année par défaut si vide
        console.warn("Aucune année académique trouvée pour cette école.");
      }

      // 2. Charger toutes les classes
      let classesQuery = supabase
        .from('classes')
        .select('*')
        .eq('school_id', schoolId);
        
      if (currentCampusId) {
        classesQuery = classesQuery.eq('campus_id', currentCampusId);
      }

      const { data: classesData, error: classesError } = await classesQuery.order('name');
      
      if (classesError) {
        const isNetworkError = 
          classesError?.code === 'NETWORK_ERROR' || 
          classesError?.message?.includes('Erreur réseau') || 
          classesError?.message?.includes('Failed to fetch') ||
          classesError?.message === 'Failed to fetch';

        if (isNetworkError) {
          console.warn("Avertissement réseau lors de la récupération des classes:", classesError.message);
          try {
            const cachedClasses = localStorage.getItem(cacheKeyClasses);
            if (cachedClasses) {
              setClasses(JSON.parse(cachedClasses));
            }
          } catch (e) {}
        } else {
          console.error("Error fetching classes:", classesError);
        }
      } else if (classesData) {
        console.log("Classes from server:", classesData);
        setClasses(classesData);
        try {
          localStorage.setItem(cacheKeyClasses, JSON.stringify(classesData));
        } catch (e) {}
      }

    } catch (err) {
      console.error("Erreur chargement structure académique:", err);
    } finally {
      setLoading(false);
    }
  }, [user.school_id, currentCampusId]);

  const fetchPlans = useCallback(async () => {
    if (!selectedYearId || !user.school_id) return;
    const cacheKeyPlans = `edunova_cached_plans_${selectedYearId}_${currentCampusId || 'GLOBAL'}`;

    try {
      const { data, error } = await supabase
        .from('fee_plans')
        .select('*, class:classes(name, level, campus_id)')
        .eq('academic_year_id', selectedYearId)
        .eq('school_id', user.school_id);
      
      if (error) throw error;
      if (data) {
        let finalPlans = data;
        // Filter plans to only those belonging to the current campus's classes safely
        if (currentCampusId) {
          finalPlans = data.filter(p => {
            if (p.class?.campus_id) return p.class.campus_id === currentCampusId;
            if (classes && classes.length > 0) return classes.some(c => c.id === p.class_id);
            return true;
          });
        }
        setPlans(finalPlans);
        try {
          localStorage.setItem(cacheKeyPlans, JSON.stringify(finalPlans));
        } catch (e) {}
      }
    } catch (err) {
      console.error("Erreur chargement des tarifs:", err);
    }
  }, [selectedYearId, user.school_id, currentCampusId, classes]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (selectedYearId) fetchPlans(); }, [selectedYearId, fetchPlans]);

  const [formData, setFormData] = useState({
    id: '',
    class_id: '',
    inscription_fee: '',
    inscription_fee_usd: '0',
    inscription_currency: 'HTG',
    reenrollment_fee: '0',
    reenrollment_fee_usd: '0',
    reenrollment_currency: 'HTG',
    tuition_fee: '',
    tuition_fee_usd: '0',
    tuition_currency: 'HTG',
    misc_fee_usd: '0',
    misc_fee_htg: '0',
    misc_currency: 'USD',
    is_misc_mandatory: false,
    payment_structure: [] as { label: string; amount: number; due_date?: string }[]
  });

  const propagateFees = (type: 'inscription' | 'reenrollment' | 'tuition' | 'misc' | 'all') => {
    if (!selectedYearId || !user.school_id) return;
    
    let feeValue = '';
    let currency: 'HTG' | 'USD' = 'HTG';
    
    if (type === 'inscription') {
      currency = formData.inscription_currency as 'HTG' | 'USD';
      feeValue = currency === 'HTG' ? formData.inscription_fee : formData.inscription_fee_usd;
    } else if (type === 'reenrollment') {
      currency = formData.reenrollment_currency as 'HTG' | 'USD';
      feeValue = currency === 'HTG' ? formData.reenrollment_fee : formData.reenrollment_fee_usd;
    } else if (type === 'tuition') {
      currency = formData.tuition_currency as 'HTG' | 'USD';
      feeValue = currency === 'HTG' ? formData.tuition_fee : formData.tuition_fee_usd;
    } else if (type === 'misc') {
      currency = formData.misc_currency as 'HTG' | 'USD';
      feeValue = currency === 'USD' ? formData.misc_fee_usd : formData.misc_fee_htg;
    } else if (type === 'all') {
      currency = formData.inscription_currency as 'HTG' | 'USD';
      feeValue = currency === 'HTG' ? formData.inscription_fee : formData.inscription_fee_usd;
    }

    const val = parseFloat(feeValue) || 0;
    const label = type === 'inscription' 
      ? "Frais d'Inscription (Nouveaux)" 
      : type === 'reenrollment' 
        ? "Frais de Réinscription (Anciens)" 
        : type === 'tuition'
          ? terminology.tuition
          : type === 'misc'
            ? "Frais Divers (Annexes/Obligatoires)"
            : "Plan Tarifaire Complet";

    const targetClasses = validClasses && validClasses.length > 0 ? validClasses : classes;

    setPendingPropagation({
      type,
      val,
      currency,
      label,
      targetCount: targetClasses ? targetClasses.length : 0,
      scope: 'current_campus'
    });
  };

  const executePropagation = async () => {
    if (!pendingPropagation || !selectedYearId || !user.school_id) return;
    const { type, val, currency, label, scope = 'current_campus' } = pendingPropagation;

    setIsSubmitting(true);
    try {
      let targetClassesList = validClasses && validClasses.length > 0 ? validClasses : classes;

      if (scope === 'all_campuses' && school?.has_multi_campus) {
        const { data: allCompClasses, error: classErr } = await supabase
          .from('classes')
          .select('*')
          .eq('school_id', user.school_id);
        if (!classErr && allCompClasses && allCompClasses.length > 0) {
          targetClassesList = allCompClasses;
        }
      }

      if (!targetClassesList || targetClassesList.length === 0) {
        toast.error("Aucune classe disponible pour propager ces frais.");
        return;
      }

      const targetClassIds = targetClassesList.map(c => c.id);

      const { data: existingPlans, error: fetchErr } = await supabase
        .from('fee_plans')
        .select('*')
        .eq('school_id', user.school_id)
        .eq('academic_year_id', selectedYearId)
        .in('class_id', targetClassIds);

      if (fetchErr) throw fetchErr;

      const formInsHTG = formData.inscription_currency === 'HTG' ? (parseFloat(formData.inscription_fee) || 0) : 0;
      const formInsUSD = formData.inscription_currency === 'USD' ? (parseFloat(formData.inscription_fee_usd) || 0) : 0;
      
      const formReHTG = formData.reenrollment_currency === 'HTG' ? (parseFloat(formData.reenrollment_fee) || 0) : 0;
      const formReUSD = formData.reenrollment_currency === 'USD' ? (parseFloat(formData.reenrollment_fee_usd) || 0) : 0;

      const formTuiHTG = formData.tuition_currency === 'HTG' ? (parseFloat(formData.tuition_fee) || 0) : 0;
      const formTuiUSD = formData.tuition_currency === 'USD' ? (parseFloat(formData.tuition_fee_usd) || 0) : 0;

      const formMiscHTG = formData.misc_currency === 'HTG' ? (parseFloat(formData.misc_fee_htg) || 0) : 0;
      const formMiscUSD = formData.misc_currency === 'USD' ? (parseFloat(formData.misc_fee_usd) || 0) : 0;

      const finalUpdates = targetClassesList.map(cls => {
        const existing = existingPlans?.find(p => p.class_id === cls.id);
        const planId = existing?.id || crypto.randomUUID();

        return {
          id: planId,
          school_id: user.school_id,
          academic_year_id: selectedYearId,
          class_id: cls.id,

          inscription_fee: (type === 'inscription' || type === 'all')
            ? (currency === 'HTG' ? val : 0)
            : (existing ? (existing.inscription_fee ?? 0) : formInsHTG),

          inscription_fee_usd: (type === 'inscription' || type === 'all')
            ? (currency === 'USD' ? val : 0)
            : (existing ? (existing.inscription_fee_usd ?? 0) : formInsUSD),

          reenrollment_fee: (type === 'reenrollment' || type === 'all')
            ? (currency === 'HTG' ? val : 0)
            : (existing ? (existing.reenrollment_fee ?? 0) : formReHTG),

          reenrollment_fee_usd: (type === 'reenrollment' || type === 'all')
            ? (currency === 'USD' ? val : 0)
            : (existing ? (existing.reenrollment_fee_usd ?? 0) : formReUSD),

          tuition_fee: (type === 'tuition' || type === 'all')
            ? (currency === 'HTG' ? val : 0)
            : (existing ? (existing.tuition_fee ?? 0) : formTuiHTG),

          tuition_fee_usd: (type === 'tuition' || type === 'all')
            ? (currency === 'USD' ? val : 0)
            : (existing ? (existing.tuition_fee_usd ?? 0) : formTuiUSD),

          payment_structure: (existing?.payment_structure && existing.payment_structure.length > 0) 
            ? existing.payment_structure 
            : ((type === 'tuition' || type === 'all') ? formData.payment_structure : []),

          misc_fee_htg: (type === 'misc' || type === 'all')
            ? (currency === 'HTG' ? val : 0)
            : (existing ? (existing.misc_fee_htg ?? 0) : formMiscHTG),

          misc_fee_usd: (type === 'misc' || type === 'all')
            ? (currency === 'USD' ? val : 0)
            : (existing ? (existing.misc_fee_usd ?? 0) : formMiscUSD),

          is_misc_mandatory: (type === 'misc' || type === 'all')
            ? formData.is_misc_mandatory
            : (existing?.is_misc_mandatory ?? formData.is_misc_mandatory)
        };
      });

      // Upsert using guaranteed non-null UUID ids
      const { error: upsertErr } = await supabase
        .from('fee_plans')
        .upsert(finalUpdates, { onConflict: 'academic_year_id,class_id' });

      if (upsertErr) {
        console.warn("Propagation upsert warning, attempting fallback row sync:", upsertErr);
        for (const item of finalUpdates) {
          const { error: singleErr } = await supabase.from('fee_plans').upsert([item]);
          if (singleErr) console.error("Single row upsert error:", singleErr);
        }
      }

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'fee_plan',
        details: { 
          propagation_type: type, 
          amount: val, 
          currency, 
          classes_count: finalUpdates.length,
          scope,
          campus_id: currentCampusId 
        }
      });

      toast.success(`✨ ${label} (${val.toLocaleString()} ${currency}) propagé(s) avec succès à ${finalUpdates.length} classe(s) !`);
      setPendingPropagation(null);
      await fetchPlans();
    } catch (error: any) {
      console.error("Error propagating fees:", error);
      toast.error("Erreur lors de la propagation des frais : " + (error.message || ""));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.class_id) {
      toast.error("Veuillez sélectionner une classe.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (formData.class_id === 'ALL') {
        const targetClasses = validClasses && validClasses.length > 0 ? validClasses : classes;
        if (!targetClasses || targetClasses.length === 0) {
          toast.error("Aucune classe disponible.");
          return;
        }

        const payloadList = targetClasses.map(cls => {
          const existing = plans.find(p => p.class_id === cls.id);
          const planId = existing?.id || crypto.randomUUID();
          return {
            id: planId,
            school_id: user.school_id,
            academic_year_id: selectedYearId,
            class_id: cls.id,
            inscription_fee: formData.inscription_currency === 'HTG' ? (parseFloat(formData.inscription_fee) || 0) : 0,
            inscription_fee_usd: formData.inscription_currency === 'USD' ? (parseFloat(formData.inscription_fee_usd) || 0) : 0,
            reenrollment_fee: formData.reenrollment_currency === 'HTG' ? (parseFloat(formData.reenrollment_fee) || 0) : 0,
            reenrollment_fee_usd: formData.reenrollment_currency === 'USD' ? (parseFloat(formData.reenrollment_fee_usd) || 0) : 0,
            tuition_fee: formData.tuition_currency === 'HTG' ? (parseFloat(formData.tuition_fee) || 0) : 0,
            tuition_fee_usd: formData.tuition_currency === 'USD' ? (parseFloat(formData.tuition_fee_usd) || 0) : 0,
            misc_fee_usd: formData.misc_currency === 'USD' ? (parseFloat(formData.misc_fee_usd) || 0) : 0,
            misc_fee_htg: formData.misc_currency === 'HTG' ? (parseFloat(formData.misc_fee_htg) || 0) : 0,
            is_misc_mandatory: formData.is_misc_mandatory,
            payment_structure: formData.payment_structure
          };
        });

        const { error: upsErr } = await supabase
          .from('fee_plans')
          .upsert(payloadList, { onConflict: 'academic_year_id,class_id' });

        if (upsErr) {
          console.warn("Bulk save upsert fallback:", upsErr);
          for (const item of payloadList) {
            await supabase.from('fee_plans').upsert([item]);
          }
        }

        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: 'CREATE',
          entity_type: 'fee_plan',
          details: { 
            mode: 'BULK_ALL_CLASSES', 
            classes_count: targetClasses.length,
            campus_id: currentCampusId 
          }
        });

        toast.success(`✨ Grille tarifaire appliquée avec succès aux ${targetClasses.length} classes de l'établissement !`);
        setShowForm(false);
        setFormData({ id: '', class_id: '', inscription_fee: '', inscription_fee_usd: '0', inscription_currency: 'HTG', reenrollment_fee: '0', reenrollment_fee_usd: '0', reenrollment_currency: 'HTG', tuition_fee: '', tuition_fee_usd: '0', tuition_currency: 'HTG', misc_fee_usd: '0', misc_fee_htg: '0', misc_currency: 'USD', is_misc_mandatory: false, payment_structure: [] });
        fetchPlans();
        return;
      }

      const payload = {
        school_id: user.school_id,
        academic_year_id: selectedYearId,
        class_id: formData.class_id,
        inscription_fee: formData.inscription_currency === 'HTG' ? (parseFloat(formData.inscription_fee) || 0) : 0,
        inscription_fee_usd: formData.inscription_currency === 'USD' ? (parseFloat(formData.inscription_fee_usd) || 0) : 0,
        reenrollment_fee: formData.reenrollment_currency === 'HTG' ? (parseFloat(formData.reenrollment_fee) || 0) : 0,
        reenrollment_fee_usd: formData.reenrollment_currency === 'USD' ? (parseFloat(formData.reenrollment_fee_usd) || 0) : 0,
        tuition_fee: formData.tuition_currency === 'HTG' ? (parseFloat(formData.tuition_fee) || 0) : 0,
        tuition_fee_usd: formData.tuition_currency === 'USD' ? (parseFloat(formData.tuition_fee_usd) || 0) : 0,
        misc_fee_usd: formData.misc_currency === 'USD' ? (parseFloat(formData.misc_fee_usd) || 0) : 0,
        misc_fee_htg: formData.misc_currency === 'HTG' ? (parseFloat(formData.misc_fee_htg) || 0) : 0,
        is_misc_mandatory: formData.is_misc_mandatory,
        payment_structure: formData.payment_structure
      };

      let newId = formData.id;
      let oldData = null;

      if (formData.id) {
        const { data: existingData } = await supabase.from('fee_plans').select('*').eq('id', formData.id).single();
        oldData = existingData;

        const { error } = await supabase.from('fee_plans').update(payload).eq('id', formData.id).eq('school_id', user.school_id);
        if (error) throw error;
      } else {
        // Check if plan already exists for this class_id and academic_year_id to avoid constraint violation
        const { data: existingPlan } = await supabase
          .from('fee_plans')
          .select('id')
          .eq('school_id', user.school_id)
          .eq('academic_year_id', selectedYearId)
          .eq('class_id', formData.class_id)
          .maybeSingle();

        if (existingPlan?.id) {
          newId = existingPlan.id;
          const { error: updErr } = await supabase
            .from('fee_plans')
            .update(payload)
            .eq('id', existingPlan.id);
          if (updErr) throw updErr;
        } else {
          const { data, error } = await supabase
            .from('fee_plans')
            .insert([payload])
            .select()
            .single();
          if (error) {
            const { data: upsData, error: upsErr } = await supabase
              .from('fee_plans')
              .upsert([payload])
              .select()
              .single();
            if (upsErr) throw upsErr;
            if (upsData) newId = upsData.id;
          } else if (data) {
            newId = data.id;
          }
        }
      }
      
      const cls = classes.find(c => c.id === formData.class_id);
      const isDeviation = !isSiegeActive;
      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: formData.id ? 'UPDATE' : 'CREATE',
        entity_type: 'fee_plan',
        entity_id: newId || undefined,
        details: { 
          class_name: cls?.name, 
          old_data: oldData,
          new_data: payload,
          is_local_deviation: isDeviation,
          campus_id: currentCampusId,
          campus_name: campuses?.find(c => c.id === currentCampusId)?.name,
          deviation_alert: isDeviation ? "DÉVIATION LOCALE DE BAREME TARIF-FRAIS" : undefined
        }
      });

      if (isDeviation) {
        toast.warning(
          `Alerte Traçabilité : Modification d'une règle tarifaire sur l'annexe locale "${campuses?.find(c => c.id === currentCampusId)?.name || 'locale'}" signalée et historisée.`,
          { duration: 6000 }
        );
      }

      toast.success("Règle tarifaire enregistrée avec succès !");
      setShowForm(false);
      setFormData({ id: '', class_id: '', inscription_fee: '', inscription_fee_usd: '0', inscription_currency: 'HTG', reenrollment_fee: '0', reenrollment_fee_usd: '0', reenrollment_currency: 'HTG', tuition_fee: '', tuition_fee_usd: '0', tuition_currency: 'HTG', misc_fee_usd: '0', misc_fee_htg: '0', misc_currency: 'USD', is_misc_mandatory: false, payment_structure: [] });
      await fetchPlans();
    } catch (err: any) {
      toast.error("Erreur de sauvegarde Cloud: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openMigrateModal = () => {
    if (!migrateSourceId) {
      const defaultSource = academicYears.find(y => y.id !== selectedYearId && y.is_active)?.id || academicYears.find(y => y.id !== selectedYearId)?.id || '';
      setMigrateSourceId(defaultSource);
    }
    setShowMigrateModal(true);
  };

  const handleMigrateData = async () => {
    if (!migrateSourceId) {
      toast.warning("Veuillez sélectionner l'année académique source dans la liste déroulante avant de copier.");
      return;
    }
    if (!selectedYearId || !user.school_id) {
      toast.error("Session cible introuvable.");
      return;
    }
    
    setIsMigrating(true);
    const sourceId = migrateSourceId;
    try {
      // 1. Récupérer les plans de la source
      const { data: sourcePlans, error: srcErr } = await supabase
        .from('fee_plans')
        .select('*')
        .eq('academic_year_id', sourceId)
        .eq('school_id', user.school_id);

      if (srcErr) throw srcErr;

      if (!sourcePlans || sourcePlans.length === 0) {
        toast.error("Aucun plan tarifaire trouvé dans la session source sélectionnée.");
        return;
      }

      // 2. Préparer les nouveaux plans pour la cible
      const newPlans = sourcePlans.map(p => ({
        school_id: user.school_id,
        class_id: p.class_id,
        academic_year_id: selectedYearId,
        inscription_fee: p.inscription_fee || 0,
        inscription_fee_usd: p.inscription_fee_usd || 0,
        reenrollment_fee: p.reenrollment_fee || 0,
        reenrollment_fee_usd: p.reenrollment_fee_usd || 0,
        tuition_fee: p.tuition_fee || 0,
        tuition_fee_usd: p.tuition_fee_usd || 0,
        misc_fee_usd: p.misc_fee_usd || 0,
        misc_fee_htg: p.misc_fee_htg || 0,
        is_misc_mandatory: p.is_misc_mandatory || false,
        payment_structure: p.payment_structure || []
      }));

      // 3. Upsert dans la cible
      const { error: insertError } = await supabase
        .from('fee_plans')
        .upsert(newPlans, { onConflict: 'academic_year_id,class_id' });

      if (insertError) {
        for (const item of newPlans) {
          await supabase.from('fee_plans').upsert([item]);
        }
      }

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'CREATE',
        entity_type: 'fee_plan',
        details: { mode: 'fee_plan_migration', count: newPlans.length, source_year: sourceId, target_year: selectedYearId }
      });

      const sourceYearObj = academicYears.find(y => y.id === sourceId);
      const targetYearLabel = currentYearObj ? `${currentYearObj.label} ${currentYearObj.status === 'FUTURE' ? '(PRÉPARATION)' : '(ACTIVE)'}` : '';

      toast.success(`✨ ${newPlans.length} grille(s) tarifaire(s) copiée(s) avec succès depuis "${sourceYearObj?.label || 'Source'}" vers "${targetYearLabel}" !`);

      setShowMigrateModal(false);
      setMigrateSourceId('');
      await fetchPlans();
    } catch (err: any) {
      console.error("Erreur migration : " + err.message);
      toast.error("Erreur lors de la copie des tarifs : " + err.message);
    } finally {
      setIsMigrating(false);
    }
  };

  const handleExecuteDiffusion = async () => {
    const { selectedCampusIds } = injectModal;
    if (selectedCampusIds.length === 0) {
      setInjectModal(prev => ({ ...prev, error: "Veuillez sélectionner au moins une annexe." }));
      return;
    }

    setInjectModal(prev => ({ ...prev, isSubmitting: true, error: null, success: null }));

    try {
      const currentSchoolId = user.school_id;
      if (!currentSchoolId) {
        throw new Error("L'identifiant de l'établissement est introuvable.");
      }
      if (!selectedYearId) {
        throw new Error("Aucune année académique sélectionnée.");
      }

      // 1. Fetch siege classes
      const { data: siegeClasses, error: scErr } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', currentSchoolId)
        .eq('campus_id', siegeCampusId || currentCampusId); // if no siegeCampusId, default to active
        
      if (scErr) throw scErr;
      if (!siegeClasses || siegeClasses.length === 0) {
        throw new Error("Aucune classe trouvée pour le Siège Social.");
      }

      // 2. Fetch reference fee plans of siege for this year
      const siegeClassIds = siegeClasses.map(c => c.id);
      const { data: siegePlans, error: spErr } = await supabase
        .from('fee_plans')
        .select('*')
        .eq('school_id', currentSchoolId)
        .eq('academic_year_id', selectedYearId)
        .in('class_id', siegeClassIds);

      if (spErr) throw spErr;
      if (!siegePlans || siegePlans.length === 0) {
        throw new Error("Aucun plan tarifaire de référence n'a été configuré au Siège Social pour cette année académique.");
      }

      let totalInsertedPlans = 0;

      // 3. For each target campus, copy fee plans
      for (const targetCampusId of selectedCampusIds) {
        // Fetch all target classes
        const { data: targetClasses, error: tcErr } = await supabase
          .from('classes')
          .select('id, name')
          .eq('school_id', currentSchoolId)
          .eq('campus_id', targetCampusId);

        if (tcErr) throw tcErr;
        if (!targetClasses || targetClasses.length === 0) continue;

        const targetClassIds = targetClasses.map(c => c.id);

        // Delete old plans for these target classes to avoid key conflicts
        await supabase
          .from('fee_plans')
          .delete()
          .eq('school_id', currentSchoolId)
          .eq('academic_year_id', selectedYearId)
          .in('class_id', targetClassIds);

        // Map plans based on class names
        const plansToInsert = [];
        for (const sp of siegePlans) {
          const siegeClass = siegeClasses.find(c => c.id === sp.class_id);
          if (!siegeClass) continue;

          // Find matching class on target campus
          const targetClass = targetClasses.find(c => c.name === siegeClass.name);
          if (!targetClass) continue;

          plansToInsert.push({
            school_id: currentSchoolId,
            academic_year_id: selectedYearId,
            class_id: targetClass.id,
            inscription_fee: sp.inscription_fee,
            inscription_fee_usd: sp.inscription_fee_usd || 0,
            reenrollment_fee: sp.reenrollment_fee || 0,
            reenrollment_fee_usd: sp.reenrollment_fee_usd || 0,
            tuition_fee: sp.tuition_fee,
            tuition_fee_usd: sp.tuition_fee_usd || 0,
            misc_fee_usd: sp.misc_fee_usd || 0,
            misc_fee_htg: sp.misc_fee_htg || 0,
            is_misc_mandatory: sp.is_misc_mandatory,
            payment_structure: sp.payment_structure || []
          });
        }

        if (plansToInsert.length > 0) {
          const { error: insErr } = await supabase
            .from('fee_plans')
            .insert(plansToInsert);

          if (insErr) {
            console.error(`Error inserting plans for campus ${targetCampusId}:`, insErr);
          } else {
            totalInsertedPlans += plansToInsert.length;
          }
        }
      }

      AuditLogger.log({
        school_id: currentSchoolId,
        user_id: user.id,
        action: "CREATE",
        entity_type: "fee_plan",
        entity_id: "mass-inject-tarifs",
        details: { academic_year_id: selectedYearId, campuses_count: selectedCampusIds.length, plans_inserted: totalInsertedPlans },
      });

      setInjectModal(prev => ({
        ...prev,
        isSubmitting: false,
        success: `Les tarifs ont été correctement diffusés et synchronisés sur les annexes sélectionnées (${totalInsertedPlans} grilles tarifaires créées/mises à jour au total).`,
      }));

      await fetchPlans();
    } catch (err: any) {
      console.error("Execute Rates Diffusion Error:", err);
      setInjectModal(prev => ({
        ...prev,
        isSubmitting: false,
        error: err.message || "Une erreur s'est produite lors de la diffusion.",
      }));
    }
  };

  const handleExecuteImport = async () => {
    setImportModal(prev => ({ ...prev, isSubmitting: true, error: null, success: null }));

    try {
      const currentSchoolId = user.school_id;
      if (!currentSchoolId) {
        throw new Error("L'identifiant de l'établissement est introuvable.");
      }
      if (!currentCampusId) {
        throw new Error("L'identifiant de l'annexe active est introuvable.");
      }
      if (!selectedYearId) {
        throw new Error("Aucune année académique sélectionnée.");
      }
      if (!siegeCampusId) {
        throw new Error("L'identifiant du Siège Social est introuvable.");
      }

      // 1. Fetch siege classes
      const { data: siegeClasses, error: scErr } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', currentSchoolId)
        .eq('campus_id', siegeCampusId);
        
      if (scErr) throw scErr;
      if (!siegeClasses || siegeClasses.length === 0) {
        throw new Error("Aucune classe de référence n'a été trouvée pour le Siège Social.");
      }

      // 2. Fetch reference fee plans of siege for this year
      const siegeClassIds = siegeClasses.map(c => c.id);
      const { data: siegePlans, error: spErr } = await supabase
        .from('fee_plans')
        .select('*')
        .eq('school_id', currentSchoolId)
        .eq('academic_year_id', selectedYearId)
        .in('class_id', siegeClassIds);

      if (spErr) throw spErr;
      if (!siegePlans || siegePlans.length === 0) {
        throw new Error("Aucun plan tarifaire de référence n'a été configuré au Siège Social pour cette année académique.");
      }

      // 3. Fetch current campus classes
      const { data: localClasses, error: lcErr } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', currentSchoolId)
        .eq('campus_id', currentCampusId);

      if (lcErr) throw lcErr;
      if (!localClasses || localClasses.length === 0) {
        throw new Error("Aucune classe n'a été trouvée pour votre annexe. Veuillez d'abord importer ou créer les classes de discipline.");
      }

      const localClassIds = localClasses.map(c => c.id);

      // 4. Delete old plans for local classes to avoid key conflicts
      await supabase
        .from('fee_plans')
        .delete()
        .eq('school_id', currentSchoolId)
        .eq('academic_year_id', selectedYearId)
        .in('class_id', localClassIds);

      // 5. Map plans based on class names
      const plansToInsert = [];
      for (const sp of siegePlans) {
        const siegeClass = siegeClasses.find(c => c.id === sp.class_id);
        if (!siegeClass) continue;

        // Find matching class locally
        const targetClass = localClasses.find(c => c.name === siegeClass.name);
        if (!targetClass) continue;

        plansToInsert.push({
          school_id: currentSchoolId,
          academic_year_id: selectedYearId,
          class_id: targetClass.id,
          inscription_fee: sp.inscription_fee,
          inscription_fee_usd: sp.inscription_fee_usd || 0,
          reenrollment_fee: sp.reenrollment_fee || 0,
          reenrollment_fee_usd: sp.reenrollment_fee_usd || 0,
          tuition_fee: sp.tuition_fee,
          tuition_fee_usd: sp.tuition_fee_usd || 0,
          misc_fee_usd: sp.misc_fee_usd || 0,
          misc_fee_htg: sp.misc_fee_htg || 0,
          is_misc_mandatory: sp.is_misc_mandatory,
          payment_structure: sp.payment_structure || []
        });
      }

      if (plansToInsert.length === 0) {
        throw new Error("Aucune classe de votre annexe ne correspond aux classes du Siège Social. Assurez-vous d'abord d'importer les classes de la discipline.");
      }

      const { error: insErr } = await supabase
        .from('fee_plans')
        .insert(plansToInsert);

      if (insErr) throw insErr;

      AuditLogger.log({
        school_id: currentSchoolId,
        user_id: user.id,
        action: "CREATE",
        entity_type: "fee_plan",
        entity_id: "import-siege-tarifs",
        details: { academic_year_id: selectedYearId, campus_id: currentCampusId, plans_inserted: plansToInsert.length },
      });

      setImportModal(prev => ({
        ...prev,
        isSubmitting: false,
        success: `Importation réussie ! ${plansToInsert.length} grilles tarifaires de référence ont été importées et synchronisées pour votre annexe pour cette session.`,
      }));

      await fetchPlans();
    } catch (err: any) {
      console.error("Execute Rates Import Error:", err);
      setImportModal(prev => ({
        ...prev,
        isSubmitting: false,
        error: err.message || "Une erreur s'est produite lors de l'importation.",
      }));
    }
  };
  const performDelete = async () => {
    if (!deleteId) return;
    const isDeviation = !isSiegeActive;
    const deletedPlan = plans.find(p => p.id === deleteId);
    
    const { error } = await supabase.from('fee_plans').delete().eq('id', deleteId).eq('school_id', user.school_id);
    if (!error) {
      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'DELETE',
        entity_type: 'fee_plan',
        entity_id: deleteId,
        details: { 
          class_name: deletedPlan?.class?.name,
          class_id: deletedPlan?.class_id,
          is_local_deviation: isDeviation,
          campus_id: currentCampusId,
          campus_name: campuses?.find(c => c.id === currentCampusId)?.name,
          deviation_alert: isDeviation ? "ALERTE SUPPRESSION DE TARIFS PAR UNE ANNEXE LOCALE" : undefined
        }
      });
      if (isDeviation) {
        toast.warning(
          `Alerte Traçabilité : Suppression d'une règle tarifaire sur l'annexe locale "${campuses?.find(c => c.id === currentCampusId)?.name || 'locale'}" signalée au Siège Social.`
        );
      }
      setPlans(prev => prev.filter(p => p.id !== deleteId));
    }
    setDeleteId(null);
  };

  const normalizeLevel = (level?: string) => {
    if (!level) return '';
    return level.toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace('È', 'E')
      .replace('É', 'E')
      .replace('Ê', 'E')
      .replace('Ô', 'O')
      .replace('Î', 'I')
      .replace('Û', 'U');
  };

  const validClasses = useMemo(() => {
    if (!school) return classes;
    const type = school.school_type;
    
    const classicLevels = ['MATERNELLE', 'FONDAMENTALE', 'SECONDAIRE'];
    const uniLevels = ['DIPLÔME', 'DIPLOME', 'LICENCE', 'MASTER'];
    const proLevels = ['CERTIFICAT', 'DIPLOME', 'DIPLÔME'];

    const allStandardLevels = [...classicLevels, ...uniLevels, ...proLevels];

    return classes.filter(c => {
      const level = c.level?.toUpperCase() || '';
      if (!allStandardLevels.includes(level)) return true;
      if (type === 'UNIVERSITY') return uniLevels.includes(level);
      if (type === 'PROFESSIONAL') return proLevels.includes(level);
      return classicLevels.includes(level);
    });
  }, [classes, school]);

  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
      // Only show plans for classes in the current campus 
      if (!validClasses.find(c => c.id === p.class_id)) return false;

      let matchSearch = true;
      if (searchQuery.trim()) {
        const search = searchQuery.toLowerCase();
        matchSearch = (p.class?.name?.toLowerCase() || '').includes(search) || 
                      (p.class?.level?.toLowerCase() || '').includes(search);
      }

      if (activeCycle === 'Tous') return matchSearch;
      const pLevel = normalizeLevel(p.class?.level);
      const aCycle = normalizeLevel(activeCycle);
      return matchSearch && pLevel === aCycle;
    });
  }, [plans, validClasses, activeCycle, searchQuery]);

  const getDisciplineName = (className: string) => {
    let name = className.replace(
      /\s*(I|II|III|IV|V|VI|\d+|Année \d+|Niveau \d+|Niveau [IVX]+|\(L\d+\)|Licence \d+|Master \d+)\s*$/i,
      "",
    );
    name = name.replace(/^Licence\s*(en|de)?\s*/i, "");
    name = name.replace(/^Master\s*(en|de)?\s*/i, "");
    name = name.replace(/^Diplôme\s*(en|de)?\s*/i, "");
    name = name.replace(/^Diplome\s*(en|de)?\s*/i, "");
    name = name.replace(/^Certificat\s*(en|de)?\s*/i, "");
    return name.trim();
  };

  const groupedPlans = useMemo(() => {
    const groups: Record<string, typeof filteredPlans> = {};
    const isHigherEd = school?.school_type === 'UNIVERSITY' || school?.school_type === 'PROFESSIONAL';
    
    filteredPlans.forEach(plan => {
       const groupKey = isHigherEd 
         ? getDisciplineName(plan.class?.name || 'Inconnue') 
         : (plan.class?.level || 'Non classé');
       if (!groups[groupKey]) groups[groupKey] = [];
       groups[groupKey].push(plan);
    });
    
    // Sort groups alphabetically
    return Object.fromEntries(
      Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
    );
  }, [filteredPlans, school]);

  const globalStats = useMemo(() => {
    if (!plans || plans.length === 0) return null;
    
    const totalPlans = plans.length;
    const uniqueClassesCount = new Set(filteredPlans.map(p => p.class_id)).size;
    
    const activeCampusIds = new Set(
      plans.map(p => p.class?.campus_id).filter(Boolean) as string[]
    );
    const campusesConfiguredCount = activeCampusIds.size;
    
    const htgPlans = filteredPlans.filter(p => p.tuition_fee > 0);
    const usdPlans = filteredPlans.filter(p => (p.tuition_fee_usd || 0) > 0);
    
    const avgTuitionHtg = htgPlans.length > 0 
      ? htgPlans.reduce((acc, p) => acc + p.tuition_fee, 0) / htgPlans.length
      : 0;
      
    const avgTuitionUsd = usdPlans.length > 0
      ? usdPlans.reduce((acc, p) => acc + (p.tuition_fee_usd || 0), 0) / usdPlans.length
      : 0;

    return {
      totalPlans,
      uniqueClassesCount,
      campusesConfiguredCount,
      avgTuitionHtg,
      avgTuitionUsd,
      activeCampusIds: Array.from(activeCampusIds)
    };
  }, [plans, filteredPlans]);

  const currentYearObj = useMemo(() => {
    return academicYears.find(y => y.id === selectedYearId);
  }, [academicYears, selectedYearId]);

  const availableCycles = useMemo(() => {
    if (school?.school_type === 'UNIVERSITY') {
      return ['Tous', 'Diplôme', 'Licence', 'Master'];
    }
    if (school?.school_type === 'PROFESSIONAL') {
      return ['Tous', 'Certificat', 'Diplôme'];
    }
    return ['Tous', 'Maternelle', 'Fondamentale', 'Secondaire'];
  }, [school?.school_type]);

  const executeBulkAdjustment = async () => {
    if (!selectedYearId || !user.school_id || plans.length === 0) {
      toast.error("Aucun plan tarifaire à ajuster pour cette session.");
      return;
    }
    setIsSubmitting(true);
    try {
      let targetPlans = plans;
      if (bulkAdjustConfig.cycleTarget !== 'ALL') {
        targetPlans = plans.filter(p => normalizeLevel(p.class?.level) === normalizeLevel(bulkAdjustConfig.cycleTarget));
      }

      if (targetPlans.length === 0) {
        toast.error("Aucune classe trouvée pour le cycle sélectionné.");
        return;
      }

      const { feeTarget, adjustType, value, currency } = bulkAdjustConfig;

      const applyOp = (currentVal: number, opCurrency: 'HTG' | 'USD') => {
        if (adjustType === 'PERCENT') {
          return Math.max(0, Math.round(currentVal * (1 + value / 100)));
        }
        if (currency !== opCurrency) return currentVal;
        if (adjustType === 'ADD_AMOUNT') {
          return Math.max(0, currentVal + value);
        } else if (adjustType === 'SET_FIXED') {
          return Math.max(0, value);
        }
        return currentVal;
      };

      const updatedPayloads = targetPlans.map(p => {
        let insHtg = p.inscription_fee || 0;
        let insUsd = p.inscription_fee_usd || 0;
        let reHtg = p.reenrollment_fee || 0;
        let reUsd = p.reenrollment_fee_usd || 0;
        let tuiHtg = p.tuition_fee || 0;
        let tuiUsd = p.tuition_fee_usd || 0;
        let miscHtg = p.misc_fee_htg || 0;
        let miscUsd = p.misc_fee_usd || 0;

        if (feeTarget === 'tuition' || feeTarget === 'all') {
          if (tuiHtg > 0 || (currency === 'HTG' && adjustType === 'SET_FIXED')) tuiHtg = applyOp(tuiHtg, 'HTG');
          if (tuiUsd > 0 || (currency === 'USD' && adjustType === 'SET_FIXED')) tuiUsd = applyOp(tuiUsd, 'USD');
        }

        if (feeTarget === 'inscription' || feeTarget === 'all') {
          if (insHtg > 0 || (currency === 'HTG' && adjustType === 'SET_FIXED')) insHtg = applyOp(insHtg, 'HTG');
          if (insUsd > 0 || (currency === 'USD' && adjustType === 'SET_FIXED')) insUsd = applyOp(insUsd, 'USD');
        }

        if (feeTarget === 'reenrollment' || feeTarget === 'all') {
          if (reHtg > 0 || (currency === 'HTG' && adjustType === 'SET_FIXED')) reHtg = applyOp(reHtg, 'HTG');
          if (reUsd > 0 || (currency === 'USD' && adjustType === 'SET_FIXED')) reUsd = applyOp(reUsd, 'USD');
        }

        if (feeTarget === 'misc' || feeTarget === 'all') {
          if (miscHtg > 0 || (currency === 'HTG' && adjustType === 'SET_FIXED')) miscHtg = applyOp(miscHtg, 'HTG');
          if (miscUsd > 0 || (currency === 'USD' && adjustType === 'SET_FIXED')) miscUsd = applyOp(miscUsd, 'USD');
        }

        return {
          id: p.id,
          school_id: user.school_id,
          academic_year_id: selectedYearId,
          class_id: p.class_id,
          inscription_fee: insHtg,
          inscription_fee_usd: insUsd,
          reenrollment_fee: reHtg,
          reenrollment_fee_usd: reUsd,
          tuition_fee: tuiHtg,
          tuition_fee_usd: tuiUsd,
          misc_fee_htg: miscHtg,
          misc_fee_usd: miscUsd,
          is_misc_mandatory: p.is_misc_mandatory ?? false,
          payment_structure: p.payment_structure || []
        };
      });

      const { error: upsErr } = await supabase
        .from('fee_plans')
        .upsert(updatedPayloads, { onConflict: 'academic_year_id,class_id' });

      if (upsErr) {
        for (const item of updatedPayloads) {
          await supabase.from('fee_plans').upsert([item]);
        }
      }

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'fee_plan',
        details: {
          mode: 'BULK_ADJUSTMENT',
          target_year: selectedYearId,
          feeTarget,
          adjustType,
          value,
          currency,
          classes_count: updatedPayloads.length
        }
      });

      const targetLabel = currentYearObj ? `${currentYearObj.label} ${currentYearObj.status === 'FUTURE' ? '(PRÉPARATION)' : '(ACTIVE)'}` : '';
      toast.success(`✨ Ajustement appliqué avec succès à ${updatedPayloads.length} classe(s) pour la session ${targetLabel} !`);
      setShowBulkAdjustModal(false);
      await fetchPlans();
    } catch (err: any) {
      console.error("Erreur ajustement:", err);
      toast.error("Erreur lors de l'ajustement: " + (err.message || ""));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-5 animate-in fade-in duration-500 pb-16">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 bg-white p-3.5 sm:p-5 rounded-2xl shadow-xs border border-slate-200/90 relative">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.history.back()}
            className="p-2 sm:p-2.5 hover:bg-slate-100 transition-all text-slate-500 hover:text-slate-800 rounded-xl border border-slate-200 flex items-center gap-1.5 cursor-pointer shrink-0"
            title="Retour"
          >
            <ArrowLeft size={18} />
            <span className="text-xs font-bold sm:inline-block hidden">Retour</span>
          </button>
          <div>
            <div className="flex items-center gap-1.5 text-blue-600 font-bold text-xs">
              <Settings2 size={14} /> Configuration Économat
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-serif">Plan Tarifaire</h2>
            <p className="text-slate-500 text-xs mt-0.5">Grille officielle des tarifs d'admission et {terminology.tuition.toLowerCase()}</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 w-full md:w-auto flex-wrap">
          {/* SÉLECTEUR D'ANNÉE ACADÉMIQUE */}
          <AcademicSessionPill
            academicYears={academicYears}
            selectedYearId={selectedYearId}
            onSelectYear={(yearId) => setSelectedYearId(yearId)}
            size="md"
            colorScheme="blue"
          />
          
          {/* CAS 1 : SESSION SANS AUCUNE PLANIFICATION (0 TARIF) */}
          {user.role !== UserRole.SECRETARY && plans.length === 0 && (
            <>
              {academicYears.length > 1 && (
                <button 
                  onClick={openMigrateModal}
                  disabled={isMigrating} 
                  className="flex items-center justify-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm transition-all text-xs disabled:opacity-50 w-full sm:w-auto cursor-pointer"
                  title="Dupliquer la grille complète d'une autre année"
                >
                  {isMigrating ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Dupliquer d'une session
                </button>
              )}
              <button 
                onClick={() => { setFormData({id:'', class_id:'', inscription_fee:'', inscription_fee_usd: '0', inscription_currency: 'HTG', reenrollment_fee: '0', reenrollment_fee_usd: '0', reenrollment_currency: 'HTG', tuition_fee:'', tuition_fee_usd: '0', tuition_currency: 'HTG', misc_fee_usd: '0', misc_fee_htg: '0', misc_currency: 'USD', is_misc_mandatory: false, payment_structure: []}); setShowForm(true); }} 
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors text-xs w-full sm:w-auto cursor-pointer shadow-sm"
              >
                <Plus size={16} /> Nouvelle Règle
              </button>
            </>
          )}

          {/* CAS 2 : SESSION EN PRÉPARATION AVEC TARIFS DÉJÀ PRÉSENTS */}
          {user.role !== UserRole.SECRETARY && plans.length > 0 && currentYearObj?.status === 'FUTURE' && (
            <>
              <button 
                onClick={() => setShowBulkAdjustModal(true)}
                className="flex items-center justify-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-sm text-xs w-full sm:w-auto cursor-pointer"
                title="Ajuster les tarifs en masse (+% ou +montant) pour la rentrée future"
              >
                <SlidersHorizontal size={14} /> Ajustement Global (+%)
              </button>

              <button 
                onClick={() => {
                  setPendingPropagation({
                    type: 'inscription',
                    val: parseFloat(formData.inscription_fee) || 2500,
                    currency: (formData.inscription_currency as 'HTG' | 'USD') || 'HTG',
                    label: "Frais d'Inscription (Nouveaux)",
                    targetCount: validClasses?.length || classes.length,
                    scope: 'current_campus'
                  });
                }} 
                className="flex items-center justify-center gap-2 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-all shadow-sm text-xs w-full sm:w-auto cursor-pointer"
                title="Propager une valeur tarifaire à toutes les classes"
              >
                <Sparkles size={14} /> Propager
              </button>

              <button 
                onClick={() => { setFormData({id:'', class_id:'', inscription_fee:'', inscription_fee_usd: '0', inscription_currency: 'HTG', reenrollment_fee: '0', reenrollment_fee_usd: '0', reenrollment_currency: 'HTG', tuition_fee:'', tuition_fee_usd: '0', tuition_currency: 'HTG', misc_fee_usd: '0', misc_fee_htg: '0', misc_currency: 'USD', is_misc_mandatory: false, payment_structure: []}); setShowForm(true); }} 
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors text-xs w-full sm:w-auto cursor-pointer shadow-sm"
              >
                <Plus size={16} /> Nouvelle Règle
              </button>

              {academicYears.length > 1 && (
                <button 
                  onClick={openMigrateModal}
                  disabled={isMigrating} 
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl border border-slate-200 transition-all text-xs disabled:opacity-50 w-full sm:w-auto cursor-pointer"
                  title="Re-synchroniser depuis une autre session"
                >
                  <RefreshCw size={13} /> Re-migrer
                </button>
              )}
            </>
          )}

          {/* CAS 3 : SESSION ACTIVE AVEC TARIFS DÉJÀ ÉTABLIS */}
          {user.role !== UserRole.SECRETARY && plans.length > 0 && currentYearObj?.status !== 'FUTURE' && (
            <>
              {school?.has_multi_campus && isSiegeActive && campuses && campuses.length > 1 && (
                <button 
                  onClick={() => setInjectModal({
                    isOpen: true,
                    selectedCampusIds: [],
                    isSubmitting: false,
                    success: null,
                    error: null,
                  })}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all shadow-sm text-sm w-full sm:w-auto cursor-pointer"
                >
                  <Send size={16} />
                  Diffuser les Tarifs
                </button>
              )}

              {!isSiegeActive && (
                <button 
                  onClick={() => setImportModal({
                    isOpen: true,
                    isSubmitting: false,
                    success: null,
                    error: null,
                  })}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-sm text-sm w-full sm:w-auto cursor-pointer"
                >
                  <Download size={16} />
                  Importer du Siège
                </button>
              )}

              <button 
                onClick={() => { setFormData({id:'', class_id:'', inscription_fee:'', inscription_fee_usd: '0', inscription_currency: 'HTG', reenrollment_fee: '0', reenrollment_fee_usd: '0', reenrollment_currency: 'HTG', tuition_fee:'', tuition_fee_usd: '0', tuition_currency: 'HTG', misc_fee_usd: '0', misc_fee_htg: '0', misc_currency: 'USD', is_misc_mandatory: false, payment_structure: []}); setShowForm(true); }} 
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors text-xs w-full sm:w-auto cursor-pointer shadow-sm"
              >
                <Plus size={16} /> Nouvelle Règle
              </button>
            </>
          )}
        </div>
      </header>

      {!isSiegeActive && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3.5 rounded-2xl text-xs flex gap-3 animate-in slide-in-from-top-2 duration-200">
          <AlertCircle className="shrink-0 text-amber-600 mt-0.5" size={16} />
          <div>
            <div className="font-bold text-amber-950 text-sm">Mode Annexe Active - Traçabilité Tarifs unifiée</div>
            <p className="mt-0.5 text-amber-805 leading-relaxed">
              Toute modification locale apportée à la grille de tarification (frais de scolarité, inscription ou frais divers) par rapport aux valeurs de référence du Siège Social sera <strong className="font-bold underline text-amber-900">surveillée et journalisée de manière indélébile</strong>. Les dérogations de tarifs feront l'objet d'alertes automatiques remontées au Siège Social.
            </p>
          </div>
        </div>
      )}

      {/* VUE GLOBALE CONSOLIDÉE - STATISTIQUES GLOBALES */}
      {!currentCampusId && globalStats && (
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${school?.has_multi_campus ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 animate-in fade-in duration-300`}>
          {/* Card 1: Plans Count */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-sm border border-slate-700/50 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">Tarifs Consolidés</span>
              <div className="p-1.5 bg-slate-800 rounded-lg text-blue-400"><Layers size={16} /></div>
            </div>
            <div className="mt-4">
              <h4 className="text-3xl font-bold tracking-tight">{globalStats.totalPlans}</h4>
              <p className="text-slate-400 text-[10px] mt-1 font-medium">
                {school?.has_multi_campus 
                  ? `Grilles réparties sur ${globalStats.campusesConfiguredCount} annexes actives.` 
                  : "Grilles actives pour l'ensemble des classes."}
              </p>
            </div>
          </div>

          {/* Card 2: Campus Coverage */}
          {school?.has_multi_campus && (
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Couverture Annexes</span>
                <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600"><School size={16} /></div>
              </div>
              <div className="mt-4">
                <h4 className="text-3xl font-bold text-gray-900">{globalStats.campusesConfiguredCount} <span className="text-sm font-medium text-gray-400">/ {campuses?.length || 0}</span></h4>
                <p className="text-gray-500 text-[10px] mt-1 font-medium">Établissements avec règles tarifaires actives.</p>
              </div>
            </div>
          )}

          {/* Card 3: HTG Average */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Scolarité Moyenne (HTG)</span>
              <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600"><TrendingUp size={16} /></div>
            </div>
            <div className="mt-4">
              <h4 className="text-2xl font-bold text-gray-950">{Math.round(globalStats.avgTuitionHtg).toLocaleString()} G</h4>
              <p className="text-gray-500 text-[10px] mt-1 font-medium">Moyenne calculée sur les tarifs en gourdes.</p>
            </div>
          </div>

          {/* Card 4: USD Average */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Scolarité Moyenne (USD)</span>
              <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600 font-bold">$</div>
            </div>
            <div className="mt-4">
              <h4 className="text-2xl font-bold text-gray-950">${Math.round(globalStats.avgTuitionUsd).toLocaleString()}</h4>
              <p className="text-gray-500 text-[10px] mt-1 font-medium">Moyenne calculée sur les tarifs en dollars.</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-2 sm:p-2.5 rounded-2xl shadow-xs border border-slate-200/90 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        <div className="flex bg-slate-100/90 p-1 rounded-xl border border-slate-200/60 overflow-x-auto custom-scrollbar gap-1 flex-1">
          {(school?.school_type === 'UNIVERSITY' 
            ? ['Tous', 'Diplôme', 'Licence'] 
            : school?.school_type === 'PROFESSIONAL' 
            ? ['Tous', 'Certificat', 'Diplôme'] 
            : ['Tous', 'Maternelle', 'Fondamentale', 'Secondaire']).map((cycle) => (
            <button
              key={cycle}
              onClick={() => setActiveCycle(cycle)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex-1 text-center ${
                activeCycle === cycle
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
              }`}
            >
              {cycle}
            </button>
          ))}
        </div>
        <div className="flex items-center bg-slate-50 hover:bg-slate-100/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 px-3 py-1.5 rounded-xl border border-slate-200 transition-all relative flex-1 md:max-w-xs">
          <Search size={15} className="text-slate-400 shrink-0 mr-2" />
          <input 
            type="text" 
            placeholder="Rechercher une classe..." 
            className="w-full bg-transparent text-xs font-bold text-slate-900 placeholder:text-slate-500 outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full cursor-pointer ml-1"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden min-h-[300px]">
        {plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center max-w-lg mx-auto animate-in fade-in zoom-in-95 duration-300">
            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-4 shadow-inner ${
              currentYearObj?.status === 'FUTURE' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-blue-50 text-blue-600 border border-blue-200'
            }`}>
              <Sparkles size={30} />
            </div>
            <h3 className="text-lg font-black text-slate-900">
              {currentYearObj?.status === 'FUTURE' ? `Préparation de la session ${currentYearObj?.label}` : `Session ${currentYearObj?.label || ''}`}
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-md">
              Aucune grille tarifaire n'est encore configurée pour cette session. 
              {academicYears.length > 1 
                ? " Vous pouvez dupliquer en 1 clic l'ensemble des tarifs d'une autre année pour démarrer rapidement, ou créer vos règles manuellement."
                : " Créez votre première règle tarifaire pour initialiser l'économat."}
            </p>
            
            {user.role !== UserRole.SECRETARY && (
              <div className="flex flex-col sm:flex-row items-center gap-3 mt-6 w-full">
                {academicYears.length > 1 && (
                  <button
                    onClick={openMigrateModal}
                    className="w-full sm:flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RefreshCw size={15} />
                    Dupliquer d'une session
                  </button>
                )}
                <button
                  onClick={() => {
                    setFormData({id:'', class_id:'', inscription_fee:'', inscription_fee_usd: '0', inscription_currency: 'HTG', reenrollment_fee: '0', reenrollment_fee_usd: '0', reenrollment_currency: 'HTG', tuition_fee:'', tuition_fee_usd: '0', tuition_currency: 'HTG', misc_fee_usd: '0', misc_fee_htg: '0', misc_currency: 'USD', is_misc_mandatory: false, payment_structure: []});
                    setShowForm(true);
                  }}
                  className="w-full sm:flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <Plus size={15} />
                  Créer manuellement
                </button>
              </div>
            )}
          </div>
        ) : filteredPlans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <Info size={40} className="text-gray-300" />
            <p className="text-gray-500 font-medium text-sm">Aucun tarif trouvé pour votre recherche "{searchQuery}"</p>
            <button 
              onClick={() => { setSearchQuery(''); setActiveCycle('Tous'); }}
              className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {(() => {
              const hasAnyMiscFeeInPlans = plans.some(p => (Number(p.misc_fee_usd || 0) > 0 || Number(p.misc_fee_htg || 0) > 0));
              const totalCols = (user.role !== UserRole.SECRETARY ? (hasAnyMiscFeeInPlans ? 6 : 5) : (hasAnyMiscFeeInPlans ? 5 : 4));

              return (
                <table className="w-full text-left">
                  <thead>
                      <tr className="bg-gray-50 text-gray-600 text-sm font-semibold border-b border-gray-200">
                        <th className="px-6 py-4">{terminology.class} / Niveau</th>
                        <th className="px-6 py-4 text-center">{school?.school_type === 'UNIVERSITY' || school?.school_type === 'PROFESSIONAL' ? 'Admission / Inscription' : 'Inscription (Nouveau)'}</th>
                        <th className="px-6 py-4 text-center">{school?.school_type === 'UNIVERSITY' || school?.school_type === 'PROFESSIONAL' ? 'Réinscription' : 'Réinscription (Ancien)'}</th>
                        <th className="px-6 py-4 text-center">{terminology.tuition}</th>
                        {hasAnyMiscFeeInPlans && <th className="px-6 py-4 text-center">Frais Divers (USD/HTG)</th>}
                        {user.role !== UserRole.SECRETARY && <th className="px-6 py-4 text-center">Actions</th>}
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr>
                        <td colSpan={totalCols} className="py-8">
                          <FluidLoadingState 
                            message="Chargement des plans de facturation..." 
                            subtext="Synchronisation des tarifs réels..." 
                          />
                          <SkeletonTable rows={6} />
                        </td>
                      </tr>
                    ) : Object.keys(groupedPlans).length === 0 ? (
                      <tr>
                        <td colSpan={totalCols} className="py-12 text-center text-gray-500 font-medium italic">
                          Aucun plan de facturation trouvé pour ces critères.
                        </td>
                      </tr>
                    ) : Object.entries(groupedPlans).map(([level, classPlans]) => (
                      <React.Fragment key={level}>
                        <tr className="bg-slate-50 border-y border-slate-200">
                          <td colSpan={totalCols} className="px-6 py-3">
                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{level}</span>
                          </td>
                        </tr>
                        {classPlans.map((plan) => (
                          <tr key={plan.id} className="group hover:bg-blue-50/30 transition-colors bg-white">
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-0.5">
                                <p className="font-semibold text-gray-900 text-sm">{plan.class?.name}</p>
                                <div className="flex flex-wrap items-center gap-1">
                                  {(school?.school_type === 'UNIVERSITY' || school?.school_type === 'PROFESSIONAL') && (
                                    <span className="text-xs font-medium text-blue-600 bg-blue-50/50 px-1 py-0.2 rounded">{plan.class?.level}</span>
                                  )}
                                  {school?.has_multi_campus && !currentCampusId && plan.class?.campus_id && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-205">
                                      📍 {campuses.find(c => c.id === plan.class?.campus_id)?.name || 'Annexe locale'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center font-semibold text-gray-900">
                              <div className="flex flex-col">
                                <span>{plan.inscription_fee.toLocaleString()} G</span>
                                {plan.inscription_fee_usd > 0 && <span className="text-[10px] text-blue-600 font-bold">${plan.inscription_fee_usd}</span>}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center font-semibold text-indigo-600">
                              <div className="flex flex-col items-center">
                                {(plan.reenrollment_fee === 0 && (plan.reenrollment_fee_usd || 0) === 0) ? (
                                  <span className="text-emerald-700 text-[11px] font-extrabold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/80 shadow-2xs">Gratuit (0 G)</span>
                                ) : (
                                  <>
                                    {plan.reenrollment_fee > 0 && <span>{plan.reenrollment_fee.toLocaleString()} G</span>}
                                    {(plan.reenrollment_fee_usd || 0) > 0 && <span className="text-[10px] text-blue-600 font-bold">${plan.reenrollment_fee_usd}</span>}
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center font-semibold text-gray-900">
                              <div className="flex flex-col">
                                <span>{plan.tuition_fee.toLocaleString()} G</span>
                                {plan.tuition_fee_usd > 0 && <span className="text-[10px] text-blue-600 font-bold">${plan.tuition_fee_usd}</span>}
                              </div>
                            </td>
                            {hasAnyMiscFeeInPlans && (
                              <td className="px-6 py-4 text-center">
                                <div className="flex flex-col items-center gap-1">
                                  <span className="font-semibold text-gray-900">{plan.misc_fee_usd > 0 ? `$${plan.misc_fee_usd}` : ''} {plan.misc_fee_usd > 0 && plan.misc_fee_htg > 0 ? '/' : ''} {plan.misc_fee_htg > 0 ? `${plan.misc_fee_htg} G` : ''} {plan.misc_fee_usd === 0 && plan.misc_fee_htg === 0 ? '-' : ''}</span>
                                  {plan.is_misc_mandatory && <span className="text-[10px] font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">Obligatoire</span>}
                                </div>
                              </td>
                            )}
                            {user.role !== UserRole.SECRETARY && (
                              <td className="px-6 py-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button onClick={() => setShowHistoryForPlan({ id: plan.id, className: plan.class?.name || 'Inconnue' })} className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Voir l'historique">
                                    <History size={18} />
                                  </button>
                                  <button onClick={() => { setFormData({ id: plan.id, class_id: plan.class_id, inscription_fee: plan.inscription_fee.toString(), inscription_fee_usd: (plan.inscription_fee_usd || 0).toString(), inscription_currency: (plan.inscription_fee_usd || 0) > 0 ? 'USD' : 'HTG', reenrollment_fee: (plan.reenrollment_fee || 0).toString(), reenrollment_fee_usd: (plan.reenrollment_fee_usd || 0).toString(), reenrollment_currency: (plan.reenrollment_fee_usd || 0) > 0 ? 'USD' : 'HTG', tuition_fee: plan.tuition_fee.toString(), tuition_fee_usd: (plan.tuition_fee_usd || 0).toString(), tuition_currency: (plan.tuition_fee_usd || 0) > 0 ? 'USD' : 'HTG', misc_fee_usd: (plan.misc_fee_usd || 0).toString(), misc_fee_htg: (plan.misc_fee_htg || 0).toString(), misc_currency: (plan.misc_fee_htg || 0) > 0 ? 'HTG' : 'USD', is_misc_mandatory: plan.is_misc_mandatory || false, payment_structure: plan.payment_structure || [] }); setShowForm(true); }} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"><Edit3 size={18} /></button>
                                  <button onClick={() => setDeleteId(plan.id)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </div>
        )}
      </div>

      {showHistoryForPlan && (
        <FeeHistoryModal
          user={user}
          planId={showHistoryForPlan.id}
          className={showHistoryForPlan.className}
          onClose={() => setShowHistoryForPlan(null)}
        />
      )}

      {/* Mobile FAB for New Rule */}
      {user.role !== UserRole.SECRETARY && (
        <button 
          onClick={() => { setFormData({id:'', class_id:'', inscription_fee:'', inscription_fee_usd: '0', inscription_currency: 'HTG', reenrollment_fee: '0', reenrollment_fee_usd: '0', reenrollment_currency: 'HTG', tuition_fee:'', tuition_fee_usd: '0', tuition_currency: 'HTG', misc_fee_usd: '0', misc_fee_htg: '0', misc_currency: 'USD', is_misc_mandatory: false, payment_structure: []}); setShowForm(true); }} 
          className="sm:hidden fixed bottom-6 right-6 w-14 h-14 bg-gray-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-gray-800 transition-transform active:scale-90 z-40"
        >
          <Plus size={24} />
        </button>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-1 sm:p-3 md:p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full h-full sm:h-auto sm:max-h-[92vh] max-w-3xl lg:max-w-4xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col">
            {/* Header compact */}
            <div className="px-3.5 sm:px-5 py-2 sm:py-2.5 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-10 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="p-1 sm:p-1.5 bg-blue-600 rounded-lg shadow-sm text-white">
                  <CreditCard size={16} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black tracking-tight font-serif">Configuration du Plan Tarifaire</h3>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-[9.5px] text-blue-300 font-bold uppercase tracking-wider">Grille des frais</p>
                    {currentYearObj && (
                      <span className={`text-[8.5px] sm:text-[9.5px] font-black uppercase px-1.5 py-0.2 rounded ${
                        currentYearObj.status === 'FUTURE' ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                      }`}>
                        Session : {currentYearObj.label} {currentYearObj.status === 'FUTURE' ? '(PRÉPARATION)' : '(ACTIVE)'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setShowForm(false)} 
                className="p-1 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Content - Compact Visual Rhythm & Dense Responsive Layout */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
              <div className="p-2 sm:p-3 space-y-2">
                {/* Unified Target Session & Class Context Bar - Dense on Mobile, Tablet & Desktop */}
                <div className="bg-slate-50/90 p-2 rounded-xl border border-slate-200/80 grid grid-cols-1 sm:grid-cols-12 gap-1.5 sm:gap-2 items-center">
                  {/* Session Target Indicator */}
                  {currentYearObj && (
                    <div className="sm:col-span-4 flex items-center gap-2 min-w-0">
                      <div className={`p-1 rounded-lg text-white shrink-0 shadow-2xs ${
                        currentYearObj.status === 'FUTURE' ? 'bg-amber-500' : 'bg-blue-600'
                      }`}>
                        <CalendarDays size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-500 block leading-tight">Session cible</span>
                        <div className="flex items-center gap-1 leading-tight">
                          <span className="text-xs font-black text-slate-900 truncate">{currentYearObj.label}</span>
                          <span className={`text-[8px] sm:text-[8.5px] px-1 py-0.2 rounded font-black uppercase tracking-wider shrink-0 ${
                            currentYearObj.status === 'FUTURE' ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'
                          }`}>
                            {currentYearObj.status === 'FUTURE' ? 'Prép.' : 'Active'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Class Target Selector */}
                  <div className={`${currentYearObj ? 'sm:col-span-8' : 'sm:col-span-12'} space-y-0.5`}>
                    <div className="flex items-center justify-between">
                      <label className="text-[9.5px] sm:text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
                        <Layers size={11} className="text-blue-600" /> {terminology.class} ou Programme
                      </label>
                      {formData.class_id === 'ALL' && (
                        <span className="text-[9px] font-bold text-blue-700 bg-blue-100/70 px-1.5 py-0.2 rounded">
                          ✨ Grille globale ({validClasses.length} classes)
                        </span>
                      )}
                    </div>
                    <ClassSelectorPill
                      classes={validClasses}
                      selectedClassId={formData.class_id}
                      onSelectClass={(id) => setFormData(prev => ({ ...prev, class_id: id }))}
                      allowAll={!formData.id}
                      allLabel={`✨ TOUTES LES CLASSES (${validClasses.length}) — Grille globale`}
                      emptyLabel="-- Choisir la classe concernée --"
                      variant="field"
                      size="sm"
                      colorScheme="blue"
                      disabled={!!formData.id}
                      portal={true}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Admission & Re-enrollment Fees - Ultra Compact 2-Col Grid */}
                <div className="bg-slate-50/80 p-2 rounded-xl border border-slate-200/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="p-0.5 bg-white rounded-md shadow-2xs border border-slate-200 text-blue-600">
                        <CreditCard size={12} />
                      </div>
                      <h4 className="text-[10.5px] sm:text-[11px] font-black uppercase tracking-wider text-slate-800">
                        Frais d'Admission & Réinscription
                      </h4>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                    {/* Inscription */}
                    <div className="space-y-0.5 bg-white p-1.5 sm:p-2 rounded-lg border border-slate-200/80">
                      <div className="flex items-center justify-between gap-1">
                        <label className="text-[9px] sm:text-[9.5px] font-black text-slate-700 uppercase tracking-wider truncate">
                          {school?.school_type === 'UNIVERSITY' || school?.school_type === 'PROFESSIONAL' ? 'Admission / Inscription' : 'Inscription (Nouveau)'}
                        </label>
                        <button
                          type="button"
                          onClick={() => propagateFees('inscription')}
                          className="text-[8.5px] text-blue-600 hover:text-blue-800 font-bold bg-blue-50 hover:bg-blue-100 px-1.5 py-0.2 rounded transition-all shrink-0 cursor-pointer"
                          title="Propager ce montant à toutes les classes"
                        >
                          Appliquer partout
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input 
                          type="number" 
                          min="0"
                          className="flex-1 min-w-0 px-2.5 py-1 bg-slate-50 text-slate-900 border border-slate-200 rounded-lg text-xs sm:text-sm font-bold outline-none focus:border-emerald-500 focus:bg-white transition-all font-mono" 
                          value={formData.inscription_currency === 'HTG' ? formData.inscription_fee : formData.inscription_fee_usd} 
                          onChange={(e) => {
                            const val = e.target.value;
                            if (formData.inscription_currency === 'HTG') {
                              setFormData({...formData, inscription_fee: val, inscription_fee_usd: '0'});
                            } else {
                              setFormData({...formData, inscription_fee_usd: val, inscription_fee: '0'});
                            }
                          }} 
                          placeholder="0"
                        />
                        <SelectPill
                          options={[
                            { value: 'HTG', label: 'HTG' },
                            { value: 'USD', label: 'USD' }
                          ]}
                          value={formData.inscription_currency}
                          onChange={(newCurrency) => {
                            const currentVal = formData.inscription_currency === 'HTG' ? formData.inscription_fee : formData.inscription_fee_usd;
                            if (newCurrency === 'HTG') {
                              setFormData({...formData, inscription_currency: 'HTG', inscription_fee: currentVal, inscription_fee_usd: '0'});
                            } else {
                              setFormData({...formData, inscription_currency: 'USD', inscription_fee_usd: currentVal, inscription_fee: '0'});
                            }
                          }}
                          variant="field"
                          size="sm"
                          colorScheme="emerald"
                          portal={true}
                          className="w-18 sm:w-20 shrink-0"
                        />
                      </div>
                    </div>

                    {/* Réinscription */}
                    <div className="space-y-0.5 bg-white p-1.5 sm:p-2 rounded-lg border border-slate-200/80">
                      <div className="flex items-center justify-between gap-1">
                        <label className="text-[9px] sm:text-[9.5px] font-black text-slate-700 uppercase tracking-wider truncate">
                          {school?.school_type === 'UNIVERSITY' || school?.school_type === 'PROFESSIONAL' ? 'Réinscription' : 'Réinscription (Ancien)'}
                        </label>
                        <button
                          type="button"
                          onClick={() => propagateFees('reenrollment')}
                          className="text-[8.5px] text-blue-600 hover:text-blue-800 font-bold bg-blue-50 hover:bg-blue-100 px-1.5 py-0.2 rounded transition-all shrink-0 cursor-pointer"
                          title="Propager ce montant à toutes les classes"
                        >
                          Appliquer partout
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input 
                          type="number" 
                          min="0"
                          className="flex-1 min-w-0 px-2.5 py-1 bg-slate-50 text-slate-900 border border-slate-200 rounded-lg text-xs sm:text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all font-mono" 
                          value={formData.reenrollment_currency === 'HTG' ? formData.reenrollment_fee : formData.reenrollment_fee_usd} 
                          onChange={(e) => {
                            const val = e.target.value;
                            if (formData.reenrollment_currency === 'HTG') {
                              setFormData({...formData, reenrollment_fee: val, reenrollment_fee_usd: '0'});
                            } else {
                              setFormData({...formData, reenrollment_fee_usd: val, reenrollment_fee: '0'});
                            }
                          }} 
                          placeholder="0"
                        />
                        <SelectPill
                          options={[
                            { value: 'HTG', label: 'HTG' },
                            { value: 'USD', label: 'USD' }
                          ]}
                          value={formData.reenrollment_currency}
                          onChange={(newCurrency) => {
                            const currentVal = formData.reenrollment_currency === 'HTG' ? formData.reenrollment_fee : formData.reenrollment_fee_usd;
                            if (newCurrency === 'HTG') {
                              setFormData({...formData, reenrollment_currency: 'HTG', reenrollment_fee: currentVal, reenrollment_fee_usd: '0'});
                            } else {
                              setFormData({...formData, reenrollment_currency: 'USD', reenrollment_fee_usd: currentVal, reenrollment_fee: '0'});
                            }
                          }}
                          variant="field"
                          size="sm"
                          colorScheme="indigo"
                          portal={true}
                          className="w-18 sm:w-20 shrink-0"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tuition & Payment Schedule - Compact Rhythm & Ergonomics */}
                <div className="bg-blue-50/40 p-2 sm:p-2.5 rounded-xl border border-blue-200/80 space-y-1.5 sm:space-y-2">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="p-0.5 bg-blue-600 text-white rounded-md shadow-2xs">
                        <TrendingUp size={12} />
                      </div>
                      <h4 className="text-[10.5px] sm:text-[11px] font-black uppercase tracking-wider text-blue-950">{terminology.tuition}</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => propagateFees('tuition')}
                      className="text-[8.5px] text-blue-700 hover:text-blue-900 font-bold bg-blue-100/70 hover:bg-blue-200/80 px-1.5 py-0.2 rounded transition-all shrink-0 cursor-pointer"
                      title="Propager ce montant de scolarité à toutes les classes"
                    >
                      Appliquer partout
                    </button>
                  </div>

                  {/* Tuition Total + Currency */}
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <input 
                        type="number" 
                        min="0"
                        className="w-full px-2.5 py-1 bg-white text-slate-900 border border-slate-200 rounded-lg text-xs sm:text-sm font-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/10 transition-all font-mono" 
                        value={formData.tuition_currency === 'HTG' ? formData.tuition_fee : formData.tuition_fee_usd} 
                        onChange={(e) => {
                          const val = e.target.value;
                          if (formData.tuition_currency === 'HTG') {
                            setFormData({...formData, tuition_fee: val, tuition_fee_usd: '0'});
                          } else {
                            setFormData({...formData, tuition_fee_usd: val, tuition_fee: '0'});
                          }
                        }} 
                        placeholder={`Total ${terminology.tuition}`}
                      />
                    </div>
                    <SelectPill
                      options={[
                        { value: 'HTG', label: 'HTG (G)' },
                        { value: 'USD', label: 'USD ($)' }
                      ]}
                      value={formData.tuition_currency}
                      onChange={(newCurrency) => {
                        const currentVal = formData.tuition_currency === 'HTG' ? formData.tuition_fee : formData.tuition_fee_usd;
                        if (newCurrency === 'HTG') {
                          setFormData({...formData, tuition_currency: 'HTG', tuition_fee: currentVal, tuition_fee_usd: '0'});
                        } else {
                          setFormData({...formData, tuition_currency: 'USD', tuition_fee_usd: currentVal, tuition_fee: '0'});
                        }
                      }}
                      variant="field"
                      size="sm"
                      colorScheme="blue"
                      portal={true}
                      className="w-24 sm:w-28 shrink-0"
                    />
                  </div>

                  {/* Predefined Models & Installments List */}
                  <div className="pt-1.5 border-t border-blue-200/50 space-y-1">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span className="text-[9px] sm:text-[9.5px] font-black uppercase tracking-wider text-blue-800">
                        Modèles d'Échéancier
                      </span>
                      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                        {(school?.school_type === 'UNIVERSITY' || school?.school_type === 'PROFESSIONAL') ? (
                          <>
                            <button 
                              type="button"
                              onClick={() => {
                                const val = formData.tuition_currency === 'HTG' ? parseFloat(formData.tuition_fee || '0') : parseFloat(formData.tuition_fee_usd || '0');
                                const amount = Math.round((val / 2) * 100) / 100;
                                setFormData({...formData, payment_structure: [
                                  { label: '1er Semestre', amount: amount },
                                  { label: '2ème Semestre', amount: val - amount }
                                ]});
                              }}
                              className="text-[9px] font-bold text-blue-700 bg-white px-1.5 py-0.5 rounded-md border border-blue-200 hover:bg-blue-50 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                            >
                              2 Semestres
                            </button>
                            <button 
                              type="button"
                              onClick={() => {
                                const val = formData.tuition_currency === 'HTG' ? parseFloat(formData.tuition_fee || '0') : parseFloat(formData.tuition_fee_usd || '0');
                                const amount = Math.round((val / 3) * 100) / 100;
                                setFormData({...formData, payment_structure: [
                                  { label: '1er Versement', amount: amount },
                                  { label: '2ème Versement', amount: amount },
                                  { label: 'Solde final', amount: val - (amount * 2) }
                                ]});
                              }}
                              className="text-[9px] font-bold text-blue-700 bg-white px-1.5 py-0.5 rounded-md border border-blue-200 hover:bg-blue-50 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                            >
                              3 Versements
                            </button>
                            <button 
                              type="button"
                              onClick={() => {
                                const val = formData.tuition_currency === 'HTG' ? parseFloat(formData.tuition_fee || '0') : parseFloat(formData.tuition_fee_usd || '0');
                                const amount = Math.round((val / 4) * 100) / 100;
                                setFormData({...formData, payment_structure: [
                                  { label: '1er Versement', amount: amount },
                                  { label: '2ème Versement', amount: amount },
                                  { label: '3ème Versement', amount: amount },
                                  { label: 'Solde final', amount: val - (amount * 3) }
                                ]});
                              }}
                              className="text-[9px] font-bold text-blue-700 bg-white px-1.5 py-0.5 rounded-md border border-blue-200 hover:bg-blue-50 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                            >
                              4 Versements
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              type="button"
                              onClick={() => {
                                const val = formData.tuition_currency === 'HTG' ? parseFloat(formData.tuition_fee || '0') : parseFloat(formData.tuition_fee_usd || '0');
                                const amount = Math.round((val / 3) * 100) / 100;
                                setFormData({...formData, payment_structure: [
                                  { label: '1er Trimestre', amount: amount },
                                  { label: '2ème Trimestre', amount: amount },
                                  { label: '3ème Trimestre', amount: val - (amount * 2) }
                                ]});
                              }}
                              className="text-[9px] font-bold text-blue-700 bg-white px-1.5 py-0.5 rounded-md border border-blue-200 hover:bg-blue-50 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                            >
                              3 Tranches
                            </button>
                            <button 
                              type="button"
                              onClick={() => {
                                const val = formData.tuition_currency === 'HTG' ? parseFloat(formData.tuition_fee || '0') : parseFloat(formData.tuition_fee_usd || '0');
                                const amount = Math.round((val / 10) * 100) / 100;
                                setFormData({...formData, payment_structure: Array.from({ length: 10 }).map((_, i) => ({
                                  label: `Mois ${i + 1}`, amount: i === 9 ? val - (amount * 9) : amount
                                }))});
                              }}
                              className="text-[9px] font-bold text-blue-700 bg-white px-1.5 py-0.5 rounded-md border border-blue-200 hover:bg-blue-50 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                            >
                              10 Mois
                            </button>
                          </>
                        )}
                        <button 
                          type="button"
                          onClick={() => {
                            const newStructure = [...(formData.payment_structure || [])];
                            newStructure.push({ label: `${newStructure.length + 1}${newStructure.length === 0 ? 'er' : 'ème'} Versement`, amount: 0 });
                            setFormData({...formData, payment_structure: newStructure});
                          }}
                          className="text-[9px] font-black text-white bg-blue-600 hover:bg-blue-700 px-2 py-0.5 rounded-md transition-all shadow-2xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        >
                          <Plus size={11} /> Ajouter
                        </button>
                      </div>
                    </div>

                    {/* Responsive Installments List - Compact for Mobile, Tablet & Desktop */}
                    <div className="space-y-1">
                      {(formData.payment_structure || []).length === 0 ? (
                        <p className="text-[9px] text-blue-600/70 font-bold italic text-center py-1 bg-white/70 rounded-lg border border-blue-100">
                          Structure par incréments libres (par défaut)
                        </p>
                      ) : (
                        <div className="space-y-1 max-h-44 sm:max-h-48 overflow-y-auto custom-scrollbar pr-0.5">
                          {formData.payment_structure?.map((step, idx) => (
                            <div key={idx} className="p-1 sm:p-1.5 bg-white rounded-lg border border-blue-100/90 shadow-2xs hover:border-blue-200 transition-colors">
                              {/* Desktop / Tablet: One single dense line. Mobile: Dense 2-level layout */}
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-1.5">
                                {/* Libellé */}
                                <div className="flex-1 min-w-0">
                                  <input 
                                    type="text"
                                    placeholder={`Libellé ${idx + 1}`}
                                    className="w-full px-2 py-0.5 sm:py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-bold text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition-all"
                                    value={step.label}
                                    onChange={(e) => {
                                      const newStructure = [...formData.payment_structure!];
                                      newStructure[idx].label = e.target.value;
                                      setFormData({...formData, payment_structure: newStructure});
                                    }}
                                  />
                                </div>

                                {/* Montant, Date & Supprimer */}
                                <div className="flex items-center gap-1 shrink-0">
                                  <div className="w-24 sm:w-28">
                                    <input 
                                      type="number" 
                                      placeholder="Montant"
                                      className="w-full px-2 py-0.5 sm:py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-bold text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition-all font-mono text-right"
                                      value={step.amount || ''}
                                      onChange={(e) => {
                                        const newStructure = [...formData.payment_structure!];
                                        newStructure[idx].amount = parseFloat(e.target.value) || 0;
                                        setFormData({...formData, payment_structure: newStructure});
                                      }}
                                    />
                                  </div>
                                  <div className="w-28 sm:w-32">
                                    <input 
                                      type="date"
                                      className="w-full px-1.5 py-0.5 sm:py-1 bg-slate-50 border border-slate-200 rounded-md text-[10px] font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
                                      value={step.due_date || ''}
                                      onChange={(e) => {
                                        const newStructure = [...formData.payment_structure!];
                                        newStructure[idx].due_date = e.target.value;
                                        setFormData({...formData, payment_structure: newStructure});
                                      }}
                                    />
                                  </div>
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      const newStructure = formData.payment_structure!.filter((_, i) => i !== idx);
                                      setFormData({...formData, payment_structure: newStructure});
                                    }}
                                    className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer shrink-0"
                                    title="Supprimer ce versement"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}

                          {/* Summary Check - Ultra Compact */}
                          <div className="flex items-center justify-between px-2 py-0.5 bg-blue-100/60 rounded-lg text-xs">
                            <span className="text-[9px] font-black text-blue-900 uppercase">Total Échéancier :</span>
                            <span className={`text-[11px] font-black ${(formData.payment_structure?.reduce((acc, s) => acc + s.amount, 0) || 0) !== (formData.tuition_currency === 'HTG' ? parseFloat(formData.tuition_fee) : parseFloat(formData.tuition_fee_usd)) ? 'text-rose-600' : 'text-emerald-700'}`}>
                              {(formData.payment_structure?.reduce((acc, s) => acc + s.amount, 0) || 0).toLocaleString()} {formData.tuition_currency === 'HTG' ? 'G' : '$'}
                            </span>
                          </div>

                          {(() => {
                             const sum = formData.payment_structure?.reduce((acc, s) => acc + (parseFloat(s.amount.toString()) || 0), 0) || 0;
                             const currentFee = parseFloat(formData.tuition_currency === 'HTG' ? (formData.tuition_fee || '0') : (formData.tuition_fee_usd || '0')) || 0;
                             if (sum > 0 && Math.abs(sum - currentFee) > 0.01) {
                               return (
                                 <div className="p-1 bg-rose-50 border border-rose-200 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-1">
                                   <p className="text-[9px] text-rose-700 font-bold leading-tight">
                                     Écart : Total versements ({sum.toLocaleString()} {formData.tuition_currency === 'HTG' ? 'G' : '$'}) ≠ Scolarité ({currentFee.toLocaleString()} {formData.tuition_currency === 'HTG' ? 'G' : '$'})
                                   </p>
                                   <button 
                                     type="button"
                                     onClick={() => {
                                       if (formData.tuition_currency === 'HTG') {
                                         setFormData({...formData, tuition_fee: sum.toString()});
                                       } else {
                                         setFormData({...formData, tuition_fee_usd: sum.toString()});
                                       }
                                     }}
                                     className="text-[8.5px] font-bold text-white bg-rose-600 hover:bg-rose-700 px-2 py-0.5 rounded transition-all shadow-2xs whitespace-nowrap cursor-pointer"
                                   >
                                     Fixer à {sum.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2})} {formData.tuition_currency === 'HTG' ? 'G' : '$'}
                                   </button>
                                 </div>
                               );
                             }
                             return null;
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Misc Fees Section - Compact & Unified */}
                <div className="bg-slate-50/80 p-2 rounded-xl border border-slate-200/80 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="p-0.5 bg-white rounded-md shadow-2xs border border-slate-200 text-indigo-600">
                        <Plus size={12} />
                      </div>
                      <h4 className="text-[10.5px] sm:text-[11px] font-black uppercase tracking-wider text-slate-900">
                        Frais Divers (Optionnel)
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => propagateFees('misc')}
                      className="text-[8.5px] text-indigo-700 hover:text-indigo-900 font-bold bg-indigo-50 hover:bg-indigo-100/80 px-1.5 py-0.2 rounded transition-all shrink-0 cursor-pointer border border-indigo-200/60"
                      title="Propager ces frais divers à toutes les classes"
                    >
                      Appliquer partout
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-center">
                    <div className="sm:col-span-8 flex items-center gap-1.5">
                      <input 
                        type="number" 
                        inputMode="decimal"
                        enterKeyHint="done"
                        className="flex-1 min-w-0 px-2.5 py-1 bg-white text-slate-900 border border-slate-200 rounded-lg text-xs sm:text-sm font-bold outline-none focus:border-emerald-500 transition-all font-mono" 
                        placeholder="0.00"
                        value={formData.misc_currency === 'USD' ? formData.misc_fee_usd : formData.misc_fee_htg} 
                        onChange={(e) => {
                          const val = e.target.value;
                          if (formData.misc_currency === 'USD') {
                            setFormData({...formData, misc_fee_usd: val, misc_fee_htg: '0'});
                          } else {
                            setFormData({...formData, misc_fee_htg: val, misc_fee_usd: '0'});
                          }
                        }} 
                      />
                      <SelectPill
                        options={[
                          { value: 'USD', label: 'USD ($)' },
                          { value: 'HTG', label: 'HTG (G)' }
                        ]}
                        value={formData.misc_currency}
                        onChange={(newCurrency) => {
                          const currentVal = formData.misc_currency === 'USD' ? formData.misc_fee_usd : formData.misc_fee_htg;
                          if (newCurrency === 'USD') {
                            setFormData({...formData, misc_currency: 'USD', misc_fee_usd: currentVal, misc_fee_htg: '0'});
                          } else {
                            setFormData({...formData, misc_currency: 'HTG', misc_fee_htg: currentVal, misc_fee_usd: '0'});
                          }
                        }}
                        variant="field"
                        size="sm"
                        colorScheme="slate"
                        portal={true}
                        className="w-24 sm:w-28 shrink-0"
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <button 
                        type="button"
                        className="w-full flex items-center gap-2 cursor-pointer p-1 bg-white border border-slate-200 rounded-lg hover:border-rose-300 transition-all text-left" 
                        onClick={() => setFormData({...formData, is_misc_mandatory: !formData.is_misc_mandatory})}
                      >
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all flex-shrink-0 ${formData.is_misc_mandatory ? 'bg-rose-600 border-rose-600 shadow-2xs' : 'bg-white border-slate-300'}`}>
                          {formData.is_misc_mandatory && <CheckCircle2 size={10} className="text-white" />}
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold text-slate-800 leading-none block">Frais obligatoires</span>
                          <span className="text-[8.5px] text-slate-500 font-medium block leading-tight truncate">À acquitter en priorité</span>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Subtitle / Safety Note */}
                <div className="bg-blue-50/70 px-2 py-1 border-l-2 border-blue-600 flex items-center gap-1.5 rounded-lg">
                  <Info className="text-blue-600 shrink-0" size={12} />
                  <p className="text-[9.5px] font-bold text-blue-900 leading-tight truncate">
                    Tarifs appliqués automatiquement lors des nouvelles {terminology.enrollments.toLowerCase()} pour {currentYearObj?.label}.
                  </p>
                </div>
              </div>

              {/* Sticky Compact Footer */}
              <div className="px-3.5 sm:px-5 py-2 bg-white border-t border-slate-200 sticky bottom-0 z-10 flex items-center justify-end gap-2 mt-auto shrink-0">
                <button 
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-3 py-1 text-slate-600 font-bold text-xs hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button 
                  disabled={isSubmitting} 
                  type="submit" 
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-sm active:scale-95 cursor-pointer"
                >
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 
                  {formData.id ? 'Mettre à jour' : 'Valider la tarification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Modal
        isOpen={showMigrateModal}
        onClose={() => { setShowMigrateModal(false); setMigrateSourceId(''); }}
        onConfirm={handleMigrateData}
        isLoading={isMigrating}
        title="Migration des Tarifs d'une Année à l'Autre"
        confirmLabel="Copier les tarifs vers cette session"
        type="info"
      >
        <div className="space-y-2.5 mt-2 text-left">
          {/* Target session info */}
          {currentYearObj && (
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs font-bold text-blue-950 flex items-center justify-between">
              <span>🎯 Session Cible (Destination) :</span>
              <span className="font-black text-blue-900">{currentYearObj.label} {currentYearObj.status === 'FUTURE' ? '(PRÉPARATION)' : '(ACTIVE)'}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Sélectionnez l'année académique source à dupliquer :
            </label>
            <SelectPill
              options={[
                { value: '', label: '-- Choisir une session source (ex: 2025-2026) --' },
                ...academicYears.filter(y => y.id !== selectedYearId).map(y => ({
                  value: y.id,
                  label: `Session Source : ${y.label} ${y.is_active ? '⭐ (Session Active Actuelle)' : ''}`
                }))
              ]}
              value={migrateSourceId}
              onChange={(val) => setMigrateSourceId(val)}
              variant="field"
              size="sm"
              colorScheme={!migrateSourceId ? 'amber' : 'blue'}
              portal={true}
              className="w-full"
            />
          </div>

          {migrateSourceId && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              <span>
                Prêt à dupliquer la grille complète de <strong>{academicYears.find(y => y.id === migrateSourceId)?.label}</strong> vers <strong>{currentYearObj?.label}</strong>.
              </span>
            </div>
          )}

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs leading-relaxed flex items-start gap-2">
            <Info size={15} className="text-slate-500 mt-0.5 shrink-0" />
            <div className="text-[11px]">
              <strong className="text-slate-900">Garantie d'intégrité :</strong> Les tarifs de la session source restent 100% intacts. Une nouvelle copie autonome est injectée sous la session cible.
            </div>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={performDelete}
        type="danger"
        title="Supprimer la règle"
        message={`Attention : Retirer cette règle tarifaire n'effacera pas les dettes des ${terminology.student.toLowerCase()}s déjà inscrits, mais empêchera le calcul automatique des nouveaux dossiers.`}
      />

      {/* MODALE DE PROPAGATION GLOBALE MODERNE & FLUIDE */}
      {pendingPropagation && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-2.5 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-xl my-auto shadow-2xl border border-slate-100 overflow-hidden transform transition-all animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] sm:max-h-[85vh]">
            {/* Header */}
            <div className="px-4 sm:px-5 py-3 sm:py-3.5 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20">
                  <Sparkles className="text-yellow-300" size={16} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black tracking-wide">Propagation Globale des Frais</h3>
                  <p className="text-blue-100/90 text-[10px] sm:text-[11px] font-medium">Application d'un tarif uniforme à plusieurs classes</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setPendingPropagation(null)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white cursor-pointer"
                title="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 sm:p-4 space-y-2.5 sm:space-y-3 overflow-y-auto custom-scrollbar flex-1">
              {/* Academic Year Clarity Box */}
              {currentYearObj && (
                <div className="flex items-center justify-between p-2.5 bg-blue-50/80 border border-blue-200/80 rounded-xl text-xs font-bold text-blue-950">
                  <div className="flex items-center gap-2">
                    <CalendarDays size={15} className="text-blue-600 shrink-0" />
                    <span>Session concernée : <strong className="text-blue-900">{currentYearObj.label}</strong></span>
                  </div>
                  <span className={`text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                    currentYearObj.status === 'FUTURE' ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                  }`}>
                    {currentYearObj.status === 'FUTURE' ? 'Préparation' : 'Active'}
                  </span>
                </div>
              )}

              {/* Fee Category Selector Tabs */}
              <div>
                <label className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                  1. Choisir la Catégorie de Frais à Propager
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
                  {[
                    { id: 'inscription', label: "Frais d'Inscription", icon: CreditCard },
                    { id: 'reenrollment', label: "Réinscription", icon: RefreshCw },
                    { id: 'tuition', label: terminology.tuition, icon: TrendingUp },
                    { id: 'misc', label: "Frais Divers", icon: CheckCircle2 },
                    { id: 'all', label: "Plan Tarifaire Complet", icon: Layers }
                  ].map(cat => {
                    const isSelected = pendingPropagation.type === cat.id;
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          let defaultVal = pendingPropagation.val;
                          let defaultCurr = pendingPropagation.currency;
                          let labelName = cat.label;
                          if (cat.id === 'inscription') {
                            defaultCurr = (formData.inscription_currency as 'HTG' | 'USD') || 'HTG';
                            defaultVal = parseFloat(defaultCurr === 'HTG' ? formData.inscription_fee : formData.inscription_fee_usd) || defaultVal || 2500;
                            labelName = "Frais d'Inscription (Nouveaux)";
                          } else if (cat.id === 'reenrollment') {
                            defaultCurr = (formData.reenrollment_currency as 'HTG' | 'USD') || 'HTG';
                            defaultVal = parseFloat(defaultCurr === 'HTG' ? formData.reenrollment_fee : formData.reenrollment_fee_usd) || defaultVal || 0;
                            labelName = "Frais de Réinscription (Anciens)";
                          } else if (cat.id === 'tuition') {
                            defaultCurr = (formData.tuition_currency as 'HTG' | 'USD') || 'HTG';
                            defaultVal = parseFloat(defaultCurr === 'HTG' ? formData.tuition_fee : formData.tuition_fee_usd) || defaultVal || 20000;
                            labelName = terminology.tuition;
                          } else if (cat.id === 'misc') {
                            defaultCurr = (formData.misc_currency as 'HTG' | 'USD') || 'USD';
                            defaultVal = parseFloat(defaultCurr === 'USD' ? formData.misc_fee_usd : formData.misc_fee_htg) || defaultVal || 0;
                            labelName = "Frais Divers";
                          } else if (cat.id === 'all') {
                            labelName = "Grille Complète de Frais";
                          }

                          setPendingPropagation({
                            ...pendingPropagation,
                            type: cat.id as any,
                            val: defaultVal,
                            currency: defaultCurr,
                            label: labelName
                          });
                        }}
                        className={`p-2 sm:p-2.5 rounded-xl border text-left flex flex-col justify-between gap-1 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-300 shadow-sm scale-[1.01]'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <Icon size={14} className={isSelected ? 'text-blue-400' : 'text-slate-500'} />
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
                        </div>
                        <span className="text-[10px] sm:text-[11px] font-bold leading-tight truncate">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Amount and Currency Controls */}
              {pendingPropagation.type !== 'all' && (
                <div className="bg-slate-50/90 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 space-y-1">
                  <label className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-600 block">
                    2. Montant Uniforme à Appliquer
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="0"
                        className="w-full pl-3 pr-2.5 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl text-xs sm:text-sm font-black outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 transition-all font-mono"
                        value={pendingPropagation.val || ''}
                        onChange={(e) => setPendingPropagation({ ...pendingPropagation, val: parseFloat(e.target.value) || 0 })}
                        placeholder="Montant du frais"
                      />
                    </div>
                    <SelectPill
                      options={[
                        { value: 'HTG', label: 'HTG (G)' },
                        { value: 'USD', label: 'USD ($)' }
                      ]}
                      value={pendingPropagation.currency}
                      onChange={(val) => setPendingPropagation({ ...pendingPropagation, currency: val as 'HTG' | 'USD' })}
                      variant="field"
                      size="sm"
                      colorScheme="blue"
                      portal={true}
                      className="w-24 sm:w-28 shrink-0"
                    />
                  </div>
                </div>
              )}

              {/* Multi-Tenant / Campus Scope Selector */}
              <div>
                <label className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                  3. Périmètre d'Application
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingPropagation({ ...pendingPropagation, scope: 'current_campus' })}
                    className={`p-2.5 rounded-xl border text-left flex items-start gap-2 transition-all cursor-pointer ${
                      (pendingPropagation.scope || 'current_campus') === 'current_campus'
                        ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 text-blue-950 font-semibold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Building2 className={`shrink-0 mt-0.5 ${pendingPropagation.scope !== 'all_campuses' ? 'text-blue-600' : 'text-slate-400'}`} size={16} />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Campus Actuel Uniquement</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Appliquer aux {validClasses?.length || classes.length} classes de cet établissement
                      </div>
                    </div>
                  </button>

                  {school?.has_multi_campus && (
                    <button
                      type="button"
                      onClick={() => setPendingPropagation({ ...pendingPropagation, scope: 'all_campuses' })}
                      className={`p-2.5 rounded-xl border text-left flex items-start gap-2 transition-all cursor-pointer ${
                        pendingPropagation.scope === 'all_campuses'
                          ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500/20 text-purple-950 font-semibold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Globe className={`shrink-0 mt-0.5 ${pendingPropagation.scope === 'all_campuses' ? 'text-purple-600' : 'text-slate-400'}`} size={16} />
                      <div>
                        <div className="text-xs font-bold text-slate-900">Toutes les Annexes & Campus</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Réseau ({campuses?.length || 1} établissement(s))
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* Real-time Summary Badge */}
              <div className="p-2.5 sm:p-3 bg-emerald-50/90 border border-emerald-200/80 rounded-xl flex items-start gap-2 text-emerald-950">
                <CheckCircle2 className="shrink-0 text-emerald-600 mt-0.5" size={15} />
                <div className="text-[11px] leading-relaxed font-medium">
                  <strong>Résumé :</strong> <strong className="font-extrabold text-emerald-900 font-mono">{pendingPropagation.val.toLocaleString()} {pendingPropagation.currency}</strong> ({pendingPropagation.label}) pour <strong className="font-black text-emerald-900">{pendingPropagation.scope === 'all_campuses' ? 'toutes les classes de toutes les annexes' : `${validClasses?.length || classes.length} classes`}</strong> (session <strong className="text-emerald-900">{currentYearObj?.label}</strong>).
                  <span className="block text-[9px] text-emerald-700 mt-0.5 italic">Les autres postes et sessions restent inchangés.</span>
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="px-4 py-2.5 sm:py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setPendingPropagation(null)}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={executePropagation}
                className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Propagation...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Propager maintenant
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE D'AJUSTEMENT GLOBAL / MAJORATION EN MASSE */}
      {showBulkAdjustModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-2.5 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-xl my-auto shadow-2xl border border-slate-100 overflow-hidden transform transition-all animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] sm:max-h-[85vh]">
            {/* Header */}
            <div className="px-4 sm:px-5 py-3 sm:py-3.5 bg-gradient-to-r from-emerald-700 via-teal-700 to-slate-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20">
                  <SlidersHorizontal className="text-emerald-300" size={16} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black tracking-wide">Ajustement & Réévaluation Globale</h3>
                  <p className="text-emerald-100/90 text-[10px] sm:text-[11px] font-medium">Majoration ou montant forfaitaire en 1 clic</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowBulkAdjustModal(false)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white cursor-pointer"
                title="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 sm:p-4 space-y-2.5 sm:space-y-3 overflow-y-auto custom-scrollbar flex-1">
              {/* Target Session Clear Box */}
              {currentYearObj && (
                <div className={`p-2.5 sm:p-3 rounded-xl border flex items-center justify-between gap-2 ${
                  currentYearObj.status === 'FUTURE' ? 'bg-amber-50 border-amber-200 text-amber-950' : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                }`}>
                  <div className="flex items-center gap-2">
                    <CalendarDays size={16} className={currentYearObj.status === 'FUTURE' ? "text-amber-600" : "text-emerald-600"} />
                    <div>
                      <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-500">Session Cible de l'Ajustement</div>
                      <div className="text-xs sm:text-sm font-black text-slate-900">{currentYearObj.label}</div>
                    </div>
                  </div>
                  <span className={`text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                    currentYearObj.status === 'FUTURE' ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'
                  }`}>
                    {currentYearObj.status === 'FUTURE' ? 'Préparation' : 'Active'}
                  </span>
                </div>
              )}

              {/* 1. Fee target selector */}
              <div>
                <label className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                  1. Poste de frais à ajuster
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
                  {[
                    { id: 'tuition', label: terminology.tuition, icon: TrendingUp },
                    { id: 'inscription', label: "Frais d'Inscription", icon: CreditCard },
                    { id: 'reenrollment', label: "Réinscription", icon: RefreshCw },
                    { id: 'misc', label: "Frais Divers", icon: CheckCircle2 },
                    { id: 'all', label: "Tous les frais", icon: Layers },
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setBulkAdjustConfig({ ...bulkAdjustConfig, feeTarget: item.id as any })}
                      className={`p-2 rounded-xl border text-left flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
                        bulkAdjustConfig.feeTarget === item.id 
                          ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-xs' 
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <item.icon size={14} className={bulkAdjustConfig.feeTarget === item.id ? 'text-emerald-400' : 'text-slate-500'} />
                      <span className="text-[10px] sm:text-xs truncate">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Adjustment Mode */}
              <div>
                <label className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                  2. Type d'Ajustement
                </label>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  {[
                    { id: 'PERCENT', label: "Pourcentage (%)", desc: "ex: +10% inflation" },
                    { id: 'ADD_AMOUNT', label: "Montant Forfaitaire", desc: "ex: +1 000 G" },
                    { id: 'SET_FIXED', label: "Montant Fixe", desc: "ex: = 25 000 G" }
                  ].map(mode => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setBulkAdjustConfig({ ...bulkAdjustConfig, adjustType: mode.id as any })}
                      className={`p-2 rounded-xl border text-left flex flex-col justify-between gap-0.5 transition-all cursor-pointer ${
                        bulkAdjustConfig.adjustType === mode.id
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/20 font-bold'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span className="text-[10px] sm:text-xs font-black truncate">{mode.label}</span>
                      <span className="text-[9px] text-slate-400 truncate">{mode.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Value & Currency Input */}
              <div className="bg-slate-50/90 p-2.5 sm:p-3 rounded-xl border border-slate-200 space-y-1">
                <label className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-600 block">
                  3. Valeur de l'ajustement
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step={bulkAdjustConfig.adjustType === 'PERCENT' ? '1' : '100'}
                      className="w-full pl-3 pr-2.5 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl text-xs sm:text-sm font-black outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all font-mono"
                      value={bulkAdjustConfig.value}
                      onChange={(e) => setBulkAdjustConfig({ ...bulkAdjustConfig, value: parseFloat(e.target.value) || 0 })}
                      placeholder={bulkAdjustConfig.adjustType === 'PERCENT' ? '10' : '1000'}
                    />
                    {bulkAdjustConfig.adjustType === 'PERCENT' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 font-black text-slate-400 text-xs sm:text-sm">%</span>
                    )}
                  </div>
                  {bulkAdjustConfig.adjustType !== 'PERCENT' && (
                    <SelectPill
                      options={[
                        { value: 'HTG', label: 'HTG (G)' },
                        { value: 'USD', label: 'USD ($)' }
                      ]}
                      value={bulkAdjustConfig.currency}
                      onChange={(val) => setBulkAdjustConfig({ ...bulkAdjustConfig, currency: val as 'HTG' | 'USD' })}
                      variant="field"
                      size="sm"
                      colorScheme="emerald"
                      portal={true}
                      className="w-24 sm:w-28 shrink-0"
                    />
                  )}
                </div>
              </div>

              {/* 4. Target Cycle filter */}
              <div>
                <label className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                  4. Classes / Cycles Ciblés
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {availableCycles.map(c => {
                    const isAll = c === 'Tous';
                    const isSel = isAll ? bulkAdjustConfig.cycleTarget === 'ALL' : bulkAdjustConfig.cycleTarget === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setBulkAdjustConfig({ ...bulkAdjustConfig, cycleTarget: isAll ? 'ALL' : c })}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          isSel ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Preview / Safety Note */}
              <div className="p-2.5 sm:p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-xl text-emerald-950 text-xs space-y-0.5">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>Sécurisation & Résumé de l'opération :</span>
                </div>
                <p className="text-[11px] leading-relaxed text-emerald-900 font-medium">
                  {bulkAdjustConfig.adjustType === 'PERCENT' && `Les montants seront majorés de +${bulkAdjustConfig.value}% pour l'ensemble des classes ciblées.`}
                  {bulkAdjustConfig.adjustType === 'ADD_AMOUNT' && `Un supplément de +${bulkAdjustConfig.value.toLocaleString()} ${bulkAdjustConfig.currency} sera ajouté aux montants existants.`}
                  {bulkAdjustConfig.adjustType === 'SET_FIXED' && `Le tarif sera fixé à ${bulkAdjustConfig.value.toLocaleString()} ${bulkAdjustConfig.currency} pour toutes les classes ciblées.`}
                </p>
                <p className="text-[10px] text-emerald-700 italic">
                  🔒 L'année active 2025-2026 ne subira aucune modification. Seule la session {currentYearObj?.label} sera mise à jour.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 sm:py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowBulkAdjustModal(false)}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={executeBulkAdjustment}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Application...
                  </>
                ) : (
                  <>
                    <SlidersHorizontal size={14} />
                    Appliquer l'Ajustement
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE DE DIFFUSION DES TARIFS AUX ANNEXES */}
      {injectModal.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-2.5 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden transform transition-all animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] sm:max-h-[85vh]">
            <div className="px-4 sm:px-5 py-3 sm:py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm sm:text-base font-bold">Diffusion unifiée des Tarifs</h3>
                <p className="text-emerald-100 text-[10px] sm:text-xs">Année active "{academicYears.find(y => y.id === selectedYearId)?.label}"</p>
              </div>
              <button 
                type="button"
                onClick={() => setInjectModal(prev => ({ ...prev, isOpen: false, success: null, error: null }))}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white cursor-pointer"
                title="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 sm:p-4 space-y-2.5 sm:space-y-3 overflow-y-auto custom-scrollbar flex-1">
              {injectModal.success ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-start gap-2.5">
                  <CheckCircle2 className="shrink-0 text-emerald-600 mt-0.5" size={16} />
                  <div className="text-xs sm:text-sm font-medium">{injectModal.success}</div>
                </div>
              ) : (
                <>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    Vous allez diffuser les tarifs de référence configurés au Siège Social vers les annexes sélectionnées. Les tarifs de chaque classe correspondante seront synchronisés.
                  </p>
                  
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 rounded-xl text-xs flex gap-2">
                    <AlertCircle className="shrink-0 text-amber-600 mt-0.5" size={15} />
                    <div className="text-[11px] leading-relaxed">
                      <strong>Avertissement :</strong> Les tarifs existants des classes de ces annexes pour l'année sélectionnée seront écrasés. Chaque annexe pourra les adapter localement par la suite.
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <span>Sélectionner les annexes destinataires</span>
                      <div className="flex gap-2">
                        <button 
                          type="button"
                          onClick={() => {
                            const annexIds = campuses?.filter(c => c.id !== siegeCampusId).map(c => c.id) || [];
                            setInjectModal(prev => ({ ...prev, selectedCampusIds: annexIds }));
                          }}
                          className="text-emerald-600 hover:underline font-bold cursor-pointer"
                        >
                          Tout sélectionner
                        </button>
                        <span>•</span>
                        <button 
                          type="button"
                          onClick={() => setInjectModal(prev => ({ ...prev, selectedCampusIds: [] }))}
                          className="text-slate-500 hover:underline font-bold cursor-pointer"
                        >
                          Rien
                        </button>
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-44 overflow-y-auto">
                      {campuses?.filter(c => c.id !== siegeCampusId).map(campus => {
                        const isSelected = injectModal.selectedCampusIds.includes(campus.id);
                        return (
                          <label key={campus.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer select-none">
                            <input 
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setInjectModal(prev => {
                                  const updated = prev.selectedCampusIds.includes(campus.id)
                                    ? prev.selectedCampusIds.filter(id => id !== campus.id)
                                    : [...prev.selectedCampusIds, campus.id];
                                  return { ...prev, selectedCampusIds: updated };
                                });
                              }}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <div>
                              <div className="text-xs sm:text-sm font-semibold text-slate-900">{campus.name}</div>
                              <div className="text-[10px] text-slate-400">Annexe de l'établissement</div>
                            </div>
                          </label>
                        );
                      })}
                      {(!campuses || campuses.filter(c => c.id !== siegeCampusId).length === 0) && (
                        <div className="p-3 text-center text-xs text-slate-400">Aucune annexe configurée ou disponible.</div>
                      )}
                    </div>
                  </div>

                  {injectModal.error && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-center gap-2">
                      <AlertCircle className="shrink-0 text-rose-500" size={15} />
                      {injectModal.error}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-4 py-2.5 sm:py-3 bg-slate-50 border-t border-slate-100 flex gap-2 justify-end shrink-0">
              <button 
                type="button"
                onClick={() => setInjectModal(prev => ({ ...prev, isOpen: false, success: null, error: null }))}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                {injectModal.success ? 'Fermer' : 'Annuler'}
              </button>
              {!injectModal.success && (
                <button 
                  type="button"
                  disabled={injectModal.isSubmitting}
                  onClick={handleExecuteDiffusion}
                  className="px-4 py-1.5 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {injectModal.isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Lancer la diffusion
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODALE D'IMPORTATION DES TARIFS DU SIEGE SOCIAL */}
      {importModal.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-2.5 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden transform transition-all animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] sm:max-h-[85vh]">
            <div className="px-4 sm:px-5 py-3 sm:py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm sm:text-base font-bold">Importation depuis le Siège</h3>
                <p className="text-blue-100 text-[10px] sm:text-xs">Année active "{academicYears.find(y => y.id === selectedYearId)?.label}"</p>
              </div>
              <button 
                type="button"
                onClick={() => setImportModal(prev => ({ ...prev, isOpen: false, success: null, error: null }))}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white cursor-pointer"
                title="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 sm:p-4 space-y-2.5 sm:space-y-3 overflow-y-auto custom-scrollbar flex-1">
              {importModal.success ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-start gap-2.5">
                  <CheckCircle2 className="shrink-0 text-emerald-600 mt-0.5" size={16} />
                  <div className="text-xs sm:text-sm font-medium">{importModal.success}</div>
                </div>
              ) : (
                <>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-semibold">
                    Voulez-vous importer la grille officielle des tarifs de référence configurée au Siège Social pour l'année académique sélectionnée ?
                  </p>
                  
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 rounded-xl text-xs flex gap-2">
                    <AlertCircle className="shrink-0 text-amber-600 mt-0.5" size={15} />
                    <div className="text-[11px] leading-relaxed">
                      <strong>Attention :</strong> Toutes les configurations tarifaires existantes ({terminology.tuition.toLowerCase()}, frais d'inscription/réinscription) pour les classes de votre annexe active seront restaurées aux valeurs du Siège Social.
                    </div>
                  </div>

                  {importModal.error && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-center gap-2">
                      <AlertCircle className="shrink-0 text-rose-500" size={15} />
                      {importModal.error}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-4 py-2.5 sm:py-3 bg-slate-50 border-t border-slate-100 flex gap-2 justify-end shrink-0">
              <button 
                type="button"
                onClick={() => setImportModal(prev => ({ ...prev, isOpen: false, success: null, error: null }))}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                {importModal.success ? 'Fermer' : 'Annuler'}
              </button>
              {!importModal.success && (
                <button 
                  type="button"
                  disabled={importModal.isSubmitting}
                  onClick={handleExecuteImport}
                  className="px-4 py-1.5 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {importModal.isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  Lancer l'importation
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeePlanningView;