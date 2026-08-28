import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { 
  Search, 
  RefreshCcw, 
  UserCheck, 
  DollarSign, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight,
  X,
  Sparkles,
  ChevronDown,
  ShieldAlert,
  Loader2,
  Building2,
  Filter,
  FileSpreadsheet,
  Trash2,
  Award,
  Users,
  TrendingDown,
  Layers,
  ListFilter,
  Edit3
} from 'lucide-react';
import { toast } from 'sonner';
import { useSchool } from '../contexts/SchoolContext';
import { supabase } from '../supabase';
import { UserProfile } from '../types';
import { AuditLogger } from '../utils/auditLogger';
import { formatStudentName } from '../utils/formatters';
import Modal from './Modal';
import { FluidLoadingState, SkeletonTable } from './SkeletonLoader';

const discountSchema = z.object({
  category: z.string().min(1, "Veuillez sélectionner un motif de réévaluation"),
  scholarshipRegime: z.enum(['standard', 'complete']),
  customAmount: z.number().min(0, "Le montant de la réévaluation ne peut pas être négatif").optional(),
  targetType: z.enum(['student', 'class', 'school'])
});

export type ScholarshipRegime = 'standard' | 'complete';

// Génère les motifs adaptés dynamiquement selon le régime de bourse sélectionné
const getDiscountCategories = (regime: ScholarshipRegime) => {
  if (regime === 'complete') {
    return [
      { id: 'excellence', label: 'Bourse Complète Excellence (100% Scolarité + Frais Divers)', value: 100 },
      { id: 'social', label: 'Cas Social / Prise en Charge Totale (100%)', value: 100 },
      { id: 'social_partial', label: 'Cas Social / Partenariat Partiel (50%)', value: 50 },
      { id: 'staff', label: 'Avantage Collaborateur Complet (50%)', value: 50 },
      { id: 'custom', label: 'Exonération Forfaitaire Personnalisée (HTG)', value: 0 },
      { id: 'reset', label: 'Annuler toute réévaluation / Rétablir Tarif Plein (0%)', value: 0 }
    ];
  }

  return [
    { id: 'excellence', label: 'Bourse Excellence (100% Scolarité)', value: 100 },
    { id: 'staff', label: 'Avantage Collaborateur (50% Scolarité)', value: 50 },
    { id: 'social', label: 'Cas Social / Partenariat (25% Scolarité)', value: 25 },
    { id: 'sibling', label: 'Réduction Fratrie (15% Scolarité)', value: 15 },
    { id: 'custom', label: 'Ajustement Spécial Forfaitaire (HTG)', value: 0 },
    { id: 'reset', label: 'Annuler toute réévaluation / Rétablir Tarif Plein (0%)', value: 0 }
  ];
};

type TargetType = 'student' | 'class' | 'school';
type ViewTab = 'form' | 'register';

const DiscountManagementView: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { school, terminology, currentCampusId, campuses } = useSchool();
  const hasMultipleCampuses = Array.isArray(campuses) && campuses.length > 1;

  const [activeTab, setActiveTab] = useState<ViewTab>('form');
  const [targetType, setTargetType] = useState<TargetType>('student');
  const [selectedCampusFilterId, setSelectedCampusFilterId] = useState<string>(
    user.campus_id || currentCampusId || 'all'
  );

  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [scholarshipRegime, setScholarshipRegime] = useState<ScholarshipRegime>('standard');
  const [customAmount, setCustomAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [activeYear, setActiveYear] = useState<any>(null);

  // Registre des Réévaluations State
  const [registerLoading, setRegisterLoading] = useState(false);
  const [discountedStudents, setDiscountedStudents] = useState<any[]>([]);
  const [registerSearchTerm, setRegisterSearchTerm] = useState('');
  const [registerClassFilter, setRegisterClassFilter] = useState('all');
  const [registerCampusFilter, setRegisterCampusFilter] = useState('all');
  
  // Single student reset modal state
  const [resetModalStudent, setResetModalStudent] = useState<any | null>(null);

  const getCampusName = useCallback((campusId?: string | null) => {
    if (!campusId) return 'Campus Principal';
    const found = campuses?.find(c => c.id === campusId);
    return found ? found.name : 'Campus Principal';
  }, [campuses]);

  // Charge l'année active et la liste des classes
  useEffect(() => {
    const fetchInitial = async () => {
      if (!user?.school_id) return;
      const { data: years } = await supabase.from('academic_years').select('*').eq('school_id', user.school_id);
      const year = years?.find(y => y.is_active || y.status === 'ACTIVE') || years?.[0];
      setActiveYear(year);

      let clsQuery = supabase
        .from('classes')
        .select('*')
        .eq('school_id', user.school_id)
        .order('name');
      
      const activeCampusId = user.campus_id || (selectedCampusFilterId !== 'all' ? selectedCampusFilterId : null);
      if (activeCampusId) {
        clsQuery = clsQuery.eq('campus_id', activeCampusId);
      }
      
      const { data: cls } = await clsQuery;
      setClasses(cls || []);
    };
    fetchInitial();
  }, [user?.school_id, user?.campus_id, selectedCampusFilterId]);

  // Recherche dynamique des élèves pour le formulaire
  useEffect(() => {
    const search = async () => {
      if (searchTerm.length < 2 || targetType !== 'student' || !user?.school_id) {
        setSearchResults([]);
        return;
      }
      const searchCampusId = user.campus_id || (selectedCampusFilterId !== 'all' ? selectedCampusFilterId : null);
      const { data, error } = await supabase.rpc('search_students_accent_insensitive', {
        p_school_id: user.school_id,
        p_query: searchTerm,
        p_limit: 8,
        p_campus_id: searchCampusId
      });

      if (error) {
        console.error("Erreur de recherche d'élèves:", error);
        return;
      }

      const mappedData = data?.map((s: any) => ({
        ...s,
        class: s.class_name ? { name: s.class_name } : null
      }));

      setSearchResults(mappedData || []);
    };
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, targetType, user?.school_id, user?.campus_id, selectedCampusFilterId]);

  // Charger le tarif et l'historique financier de l'élève sélectionné
  const loadStudentPricing = useCallback(async (student: any) => {
    if (!activeYear || !user?.school_id) return;
    
    // 1. Taux de change
    const { data: rateRes } = await supabase
      .from('exchange_rates')
      .select('*')
      .eq('school_id', user.school_id)
      .order('effective_date', { ascending: false })
      .limit(1);

    const exchangeRate = rateRes?.[0]?.rate_usd_to_htg || rateRes?.[0]?.rate || 135;

    // 2. Class ID & Enrollment info pour l'année active
    let currentEnrollment = null;
    try {
      const { data: enrollData } = await supabase
        .from('enrollments')
        .select('class_id, tuition_discount, tuition_addition')
        .eq('school_id', user.school_id)
        .eq('student_id', student.id)
        .eq('academic_year_id', activeYear.id)
        .maybeSingle();
      currentEnrollment = enrollData;
    } catch (err) {
      console.error("Erreur chargement enrollment:", err);
    }

    const effectiveClassId = currentEnrollment?.class_id || student.class_id;

    // 3. Grille tarifaire (Fee Plan)
    let plan = null;
    if (effectiveClassId) {
      const { data: planData, error: planError } = await supabase
        .from('fee_plans')
        .select('*')
        .eq('school_id', user.school_id)
        .eq('class_id', effectiveClassId)
        .eq('academic_year_id', activeYear.id)
        .maybeSingle();
      
      if (planError) {
        console.error("Erreur chargement fee_plans:", planError);
      }
      plan = planData;
    }

    // 4. Inscriptions antérieures (Réinscription vs Inscription)
    const { data: prevEnrollments } = await supabase
      .from('enrollments')
      .select('id')
      .eq('school_id', user.school_id)
      .eq('student_id', student.id)
      .neq('academic_year_id', activeYear.id)
      .limit(1);
    
    const hasPreviousEnrollment = (prevEnrollments?.length || 0) > 0;

    // 5. Campagnes & Frais Ad-Hoc / Spéciaux assignés à l'élève
    let adHocFeesTotal = 0;
    try {
      const { data: adHocData } = await supabase
        .from('student_ad_hoc_fees')
        .select(`
          custom_amount,
          campaign:ad_hoc_campaigns!campaign_id(id, amount, currency, academic_year_id)
        `)
        .eq('school_id', user.school_id)
        .eq('student_id', student.id);

      if (adHocData) {
        adHocData.forEach((fee: any) => {
          if (fee.campaign && fee.campaign.academic_year_id === activeYear.id) {
            const amt = fee.custom_amount !== null && fee.custom_amount !== undefined 
              ? Number(fee.custom_amount) 
              : Number(fee.campaign.amount || 0);
            const amtHtg = fee.campaign.currency === 'USD' ? amt * exchangeRate : amt;
            adHocFeesTotal += amtHtg;
          }
        });
      }
    } catch (err) {
      console.error("Erreur chargement ad_hoc_fees:", err);
    }

    // 6. Calcul exhaustif des composantes du contrat
    let admHTG = 0;
    let admUSD = 0;
    let tuiHTG = 0;
    let tuiUSD = 0;
    let miscHTG = 0;
    let miscUSD = 0;
    let admissionTotal = 0;
    let tuitionTotal = 0;
    let miscTotal = 0;

    if (plan) {
      // Admission / Inscription (HTG + USD converti)
      admHTG = hasPreviousEnrollment ? Number(plan.reenrollment_fee || 0) : Number(plan.inscription_fee || 0);
      admUSD = hasPreviousEnrollment ? Number(plan.reenrollment_fee_usd || 0) : Number(plan.inscription_fee_usd || 0);
      admissionTotal = admHTG + (admUSD * exchangeRate);

      // Scolarité (HTG + USD + statut étranger + ajustements individuels/tuition_addition)
      tuiHTG = Number(plan.tuition_fee || 0);
      tuiUSD = Number(plan.tuition_fee_usd || 0);
      const baseTuition = tuiHTG + (tuiUSD * exchangeRate);
      const applicableTuition = (student.is_foreign && plan.foreign_tuition_fee) ? Number(plan.foreign_tuition_fee) : baseTuition;
      tuitionTotal = applicableTuition + Number(currentEnrollment?.tuition_addition || 0);

      // Frais Divers Obligatoires (HTG + USD converti)
      if (plan.is_misc_mandatory) {
        miscHTG = Number(plan.misc_fee_htg || 0);
        miscUSD = Number(plan.misc_fee_usd || 0);
        miscTotal = miscHTG + (miscUSD * exchangeRate);
      }
    }

    const initialTotal = admissionTotal + tuitionTotal + miscTotal + adHocFeesTotal;

    // 7. Paiements déjà effectués
    const { data: payments } = await supabase
      .from('payments')
      .select('amount, currency, amount_htg_equivalent, payment_method, status')
      .eq('school_id', user.school_id)
      .eq('student_id', student.id)
      .eq('academic_year_id', activeYear.id);

    const paidAmount = payments?.filter(p => 
      !p.payment_method?.includes('EN ATTENTE') && 
      !p.payment_method?.includes('REJETÉ') &&
      p.status !== 'ANNULE'
    ).reduce((acc, p) => acc + Number(p.currency === 'USD' ? p.amount * exchangeRate : (p.amount_htg_equivalent || p.amount || 0)), 0) || 0;

    const existingDiscountAmount = Number(student.discount_amount || 0) + Number(currentEnrollment?.tuition_discount || 0);
    const hasExistingDiscount = existingDiscountAmount > 0;
    const netContractTotal = Math.max(0, initialTotal - existingDiscountAmount);
    const detteRestanteReelle = Math.max(0, netContractTotal - paidAmount);

    setSelectedStudent({ 
      ...student, 
      admHTG,
      admUSD,
      tuiHTG,
      tuiUSD,
      miscHTG,
      miscUSD,
      admissionTotal,
      tuitionTotal,
      miscTotal,
      adHocFeesTotal,
      initialTotal, 
      existingDiscountAmount,
      hasExistingDiscount, 
      netContractTotal,
      detteRestanteReelle,
      paidAmount,
      exchangeRate
    });
  }, [activeYear, user.school_id]);

  // Charger le registre des réévaluations
  const fetchRegisterData = useCallback(async () => {
    if (!user?.school_id) return;
    setRegisterLoading(true);
    try {
      let query = supabase
        .from('students')
        .select(`
          id,
          first_name,
          last_name,
          discount_amount,
          discount_label,
          campus_id,
          class_id,
          created_at,
          class:classes (
            id,
            name,
            level
          )
        `)
        .eq('school_id', user.school_id)
        .gt('discount_amount', 0);

      const activeCampusId = user.campus_id || (registerCampusFilter !== 'all' ? registerCampusFilter : null);
      if (activeCampusId) {
        query = query.eq('campus_id', activeCampusId);
      }

      const { data, error } = await query.order('last_name');
      if (error) throw error;
      setDiscountedStudents(data || []);
    } catch (err: any) {
      console.error("Erreur chargement registre réévaluations:", err);
      toast.error("Impossible de charger le registre des réévaluations.");
    } finally {
      setRegisterLoading(false);
    }
  }, [user?.school_id, user?.campus_id, registerCampusFilter]);

  useEffect(() => {
    if (activeTab === 'register') {
      fetchRegisterData();
    }
  }, [activeTab, fetchRegisterData]);

  // Calcul dynamique de la valeur de la réévaluation selon l'Option Standard (Scolarité Pure) ou Bourse Complète (Scolarité + Frais Divers)
  const currentCategories = useMemo(() => getDiscountCategories(scholarshipRegime), [scholarshipRegime]);

  const { discountValue, originalDiscountValue, isCapped, eligibleBaseAmount } = useMemo(() => {
    const cat = currentCategories.find(c => c.id === selectedCategory);
    if (!cat) return { discountValue: 0, originalDiscountValue: 0, isCapped: false, eligibleBaseAmount: 0 };
    
    if (targetType === 'student') {
      if (!selectedStudent) return { discountValue: 0, originalDiscountValue: 0, isCapped: false, eligibleBaseAmount: 0 };
      
      const tuitionBase = Number(selectedStudent.tuitionTotal || 0);
      const miscBase = Number(selectedStudent.miscTotal || 0);
      
      // Assiette d'éligibilité : Scolarité pure (Standard) OU Scolarité + Frais Divers (Bourse Complète/Sociale)
      const baseEligible = scholarshipRegime === 'complete'
        ? (tuitionBase + miscBase)
        : tuitionBase;
      
      let rawDiscount = 0;
      if (cat.id === 'custom') {
        rawDiscount = Math.max(0, parseFloat(customAmount) || 0);
      } else {
        rawDiscount = (baseEligible * cat.value) / 100;
      }
      
      // Plafonné à l'assiette éligible de l'élève
      const cappedDiscount = Math.min(rawDiscount, baseEligible);
      
      return {
        discountValue: cappedDiscount,
        originalDiscountValue: rawDiscount,
        isCapped: rawDiscount > baseEligible,
        eligibleBaseAmount: baseEligible
      };
    }
    
    return {
      discountValue: cat.value,
      originalDiscountValue: cat.value,
      isCapped: false,
      eligibleBaseAmount: 0
    }; 
  }, [selectedCategory, scholarshipRegime, customAmount, selectedStudent, targetType, currentCategories]);

  const finalTotal = targetType === 'student' && selectedStudent 
    ? Math.max(0, (selectedStudent.netContractTotal ?? selectedStudent.initialTotal) - discountValue) 
    : 0;

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    try {
      const parsedAmount = customAmount ? parseFloat(customAmount) : undefined;
      const validationResult = discountSchema.safeParse({
        category: selectedCategory,
        scholarshipRegime: scholarshipRegime,
        customAmount: parsedAmount,
        targetType: targetType
      });

      if (!validationResult.success) {
        toast.error(validationResult.error.issues[0].message);
        return;
      }

      if (parsedAmount !== undefined && parsedAmount < 0) {
         toast.error("Le montant de la réévaluation ne peut pas être négatif");
         return;
      }

      const cat = currentCategories.find(c => c.id === selectedCategory);
      if (!cat) return;

      if (targetType === 'student') {
        if (selectedStudent?.hasExistingDiscount) {
          setPendingSubmit({ type: 'student' });
          setIsConfirmModalOpen(true);
          return;
        }
      } else {
        setPendingSubmit({ type: targetType });
        setIsConfirmModalOpen(true);
        return;
      }

      executeSubmit();
    } catch (err) {
      toast.error("Données malformées.");
    }
  };

  const executeSubmit = async () => {
    const cat = currentCategories.find(c => c.id === selectedCategory);
    if (!cat) return;

    setIsSubmitting(true);
    try {
      let updatedCount = 0;
      let skippedCount = 0;

      if (targetType === 'student') {
        if (!selectedStudent) return;

        let computedLabel: string | null = null;
        if (cat.id !== 'reset') {
          computedLabel = cat.label;
        }

        const { error } = await supabase
          .from('students')
          .update({ 
            discount_amount: discountValue,
            discount_label: computedLabel
          })
          .eq('id', selectedStudent.id)
          .eq('school_id', user.school_id);

        if (error) throw error;

        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: 'UPDATE',
          entity_type: 'student',
          entity_id: selectedStudent.id,
          details: { 
            type: 'discount_applied',
            amount: discountValue,
            label: computedLabel,
            regime: scholarshipRegime,
            student_name: formatStudentName(selectedStudent.last_name, selectedStudent.first_name).fullName
          }
        });
      } else {
        // Bulk Reevaluation
        let query = supabase.from('students').select('id, class_id, first_name, last_name, discount_amount, campus_id, is_foreign').eq('school_id', user.school_id);
        if (targetType === 'class') query = query.eq('class_id', selectedClassId);
        
        const activeCampusId = user.campus_id || (selectedCampusFilterId !== 'all' ? selectedCampusFilterId : null);
        if (activeCampusId) query = query.eq('campus_id', activeCampusId);
        
        const { data: studentsToUpdate } = await query;
        if (!studentsToUpdate || studentsToUpdate.length === 0) throw new Error(`Aucun(e) ${terminology.student.toLowerCase()} trouvé(e).`);

        // Fetch exchange rate
        const { data: rateRes } = await supabase
          .from('exchange_rates')
          .select('*')
          .eq('school_id', user.school_id)
          .order('effective_date', { ascending: false })
          .limit(1);

        const exchangeRate = rateRes?.[0]?.rate_usd_to_htg || rateRes?.[0]?.rate || 135;

        // Fetch fee plans for classes
        const classIds = Array.from(new Set(studentsToUpdate.map(s => s.class_id).filter(Boolean)));
        const { data: plans } = classIds.length > 0 ? await supabase
          .from('fee_plans')
          .select('*')
          .eq('school_id', user.school_id)
          .in('class_id', classIds)
          .eq('academic_year_id', activeYear.id) : { data: [] };

        const planMap = new Map(plans?.map(p => [p.class_id, p]) || []);

        // Fetch active enrollments (for effective class_id and tuition_addition)
        const studentIds = studentsToUpdate.map(s => s.id);
        const { data: activeEnrollments } = await supabase
          .from('enrollments')
          .select('student_id, class_id, tuition_addition')
          .eq('school_id', user.school_id)
          .eq('academic_year_id', activeYear.id)
          .in('student_id', studentIds);

        const activeEnrollMap = new Map(activeEnrollments?.map(e => [e.student_id, e]) || []);

        for (const student of studentsToUpdate) {
          const activeEnroll = activeEnrollMap.get(student.id);
          const effectiveClassId = activeEnroll?.class_id || student.class_id;
          const plan = planMap.get(effectiveClassId);

          let tuitionTotal = 0;
          let miscTotal = 0;

          if (plan) {
            const tuiHTG = Number(plan.tuition_fee || 0);
            const tuiUSD = Number(plan.tuition_fee_usd || 0);
            const baseTuition = tuiHTG + (tuiUSD * exchangeRate);
            const applicableTuition = (student.is_foreign && plan.foreign_tuition_fee) ? Number(plan.foreign_tuition_fee) : baseTuition;
            tuitionTotal = applicableTuition + Number(activeEnroll?.tuition_addition || 0);

            if (plan.is_misc_mandatory) {
              const miscHTG = Number(plan.misc_fee_htg || 0);
              const miscUSD = Number(plan.misc_fee_usd || 0);
              miscTotal = miscHTG + (miscUSD * exchangeRate);
            }
          }

          const baseEligible = scholarshipRegime === 'complete' ? (tuitionTotal + miscTotal) : tuitionTotal;
          let calculatedDiscount = cat.id === 'reset' ? 0 : (cat.id === 'custom' ? Math.max(0, parseFloat(customAmount) || 0) : (baseEligible * cat.value) / 100);
          calculatedDiscount = Math.min(calculatedDiscount, baseEligible);
          
          if (cat.id !== 'reset' && Number(student.discount_amount || 0) >= calculatedDiscount) {
            skippedCount++;
            continue;
          }

          let finalLabel: string | null = null;
          if (cat.id !== 'reset') {
            finalLabel = cat.label;
          }

          await supabase
            .from('students')
            .update({ 
              discount_amount: calculatedDiscount,
              discount_label: finalLabel
            })
            .eq('id', student.id)
            .eq('school_id', user.school_id);
            
          updatedCount++;
        }

        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: 'UPDATE',
          entity_type: 'student',
          details: { 
            type: 'bulk_discount_applied',
            target: targetType,
            class_id: targetType === 'class' ? selectedClassId : null,
            label: cat.label,
            regime: scholarshipRegime,
            count: updatedCount,
            skipped: skippedCount
          }
        });
      }

      setShowSuccess(true);
      toast.success(targetType === 'student' ? "Remise appliquée avec succès !" : `Réévaluation terminée : ${updatedCount} mis à jour, ${skippedCount} ignorés.`);
      fetchRegisterData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
      setIsConfirmModalOpen(false);
      setPendingSubmit(null);
    }
  };

  // Annulation directe d'une réévaluation depuis le registre
  const handleCancelStudentDiscount = async () => {
    if (!resetModalStudent || !user?.school_id) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('students')
        .update({
          discount_amount: 0,
          discount_label: null
        })
        .eq('id', resetModalStudent.id)
        .eq('school_id', user.school_id);

      if (error) throw error;

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'student',
        entity_id: resetModalStudent.id,
        details: {
          type: 'discount_reset',
          student_name: formatStudentName(resetModalStudent.last_name, resetModalStudent.first_name).fullName
        }
      });

      toast.success(`La réévaluation de ${resetModalStudent.first_name} ${resetModalStudent.last_name} a été annulée.`);
      setResetModalStudent(null);
      fetchRegisterData();
    } catch (err: any) {
      toast.error("Erreur lors de l'annulation de la remise.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedStudent(null);
    setSearchTerm('');
    setSelectedCategory('');
    setCustomAmount('');
    setShowSuccess(false);
    setSelectedClassId('');
  };

  // Filtrage du registre des réévaluations
  const filteredRegisterStudents = useMemo(() => {
    return discountedStudents.filter(st => {
      const nameMatch = (st.first_name || '').toLowerCase().includes(registerSearchTerm.toLowerCase()) ||
                        (st.last_name || '').toLowerCase().includes(registerSearchTerm.toLowerCase()) ||
                        (st.discount_label || '').toLowerCase().includes(registerSearchTerm.toLowerCase());
      
      const classMatch = registerClassFilter === 'all' || st.class_id === registerClassFilter;

      const campusMatch = user.campus_id 
        ? (st.campus_id === user.campus_id || !st.campus_id)
        : (registerCampusFilter === 'all' || st.campus_id === registerCampusFilter || (!st.campus_id && registerCampusFilter === campuses?.[0]?.id));

      return nameMatch && classMatch && campusMatch;
    });
  }, [discountedStudents, registerSearchTerm, registerClassFilter, registerCampusFilter, user.campus_id, campuses]);

  // Stat de synthèse du registre
  const totalRegisterDiscountHTG = useMemo(() => {
    return filteredRegisterStudents.reduce((acc, st) => acc + Number(st.discount_amount || 0), 0);
  }, [filteredRegisterStudents]);

  // Exportation CSV du registre
  const handleExportRegisterCSV = () => {
    if (filteredRegisterStudents.length === 0) {
      toast.error("Aucune donnée à exporter.");
      return;
    }

    const headers = hasMultipleCampuses 
      ? ["Nom", "Prenom", "Classe", "Campus/Annexe", "Motif de Réévaluation", "Montant Remise (HTG)"]
      : ["Nom", "Prenom", "Classe", "Motif de Réévaluation", "Montant Remise (HTG)"];

    const rows = filteredRegisterStudents.map(st => {
      const row = [
        st.last_name.replace(/;/g, ' '),
        st.first_name.replace(/;/g, ' '),
        (st.class?.name || 'N/A').replace(/;/g, ' ')
      ];
      if (hasMultipleCampuses) {
        row.push(getCampusName(st.campus_id).replace(/;/g, ' '));
      }
      row.push(
        (st.discount_label || 'Ajustement').replace(/;/g, ' '),
        st.discount_amount
      );
      return row;
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Registre_Reevaluations_${school?.name || 'etablissement'}_${activeYear?.label || 'active'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Registre des réévaluations exporté avec succès.");
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20 px-3 sm:px-4 md:px-0">
      {/* Header Banner - Concise & Ergonomic */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full -mr-32 -mt-32 blur-2xl pointer-events-none"></div>
        
        <div className="relative z-10 space-y-1.5">
          <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-widest">
            <ShieldCheck size={14} className="text-indigo-600" /> 
            Direction de l'Économat
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Audit & Actes de Réévaluation</h2>
          
          <div className="flex items-center gap-2 flex-wrap pt-0.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-lg border border-indigo-100">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              {school?.name || 'Établissement'}
            </span>
            {hasMultipleCampuses && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-lg border border-slate-200">
                {user.campus_id 
                  ? getCampusName(user.campus_id)
                  : selectedCampusFilterId === 'all'
                    ? 'Tous les Campus'
                    : getCampusName(selectedCampusFilterId)}
              </span>
            )}
            <span className="text-slate-500 text-xs font-mono font-bold">
              Session {activeYear?.label || 'Active'}
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 relative z-10 shadow-inner w-full md:w-auto">
          <button
            onClick={() => setActiveTab('form')}
            className={`flex-1 md:flex-none px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-tight transition-all duration-200 flex items-center justify-center gap-2 ${activeTab === 'form' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Edit3 size={15} /> Acte de Réévaluation
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`flex-1 md:flex-none px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-tight transition-all duration-200 flex items-center justify-center gap-2 ${activeTab === 'register' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Award size={15} /> Registre & Audit ({discountedStudents.length})
          </button>
        </div>
      </div>

      {/* TAB 1: FORMULAIRE D'AJUSTEMENT SOUVERAIN */}
      {activeTab === 'form' && (
        <div className="space-y-6">
          {/* Controls Bar for Scope selection */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <Layers size={16} className="text-indigo-600" /> Périmètre d'application :
            </div>
            
            <div className="flex items-center gap-2 w-full md:w-auto">
              {(['student', 'class', 'school'] as TargetType[]).map(t => (
                <button
                  key={t}
                  onClick={() => { setTargetType(t); resetForm(); }}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${targetType === t ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                >
                  {t === 'student' ? 'Révision Individuelle' : t === 'class' ? `Ajustement ${terminology.class}` : 'Souveraineté École'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Scope Target */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div className="flex items-center gap-2">
                    <UserCheck className="text-indigo-600" size={20} />
                    <h3 className="text-base font-bold text-gray-900">Ciblage du Périmètre</h3>
                  </div>

                  {/* Multi-Campus Selector inside Form (if applicable) */}
                  {!user.campus_id && hasMultipleCampuses && (
                    <div className="relative">
                      <select 
                        className="pl-8 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer hover:bg-slate-100"
                        value={selectedCampusFilterId}
                        onChange={(e) => {
                          setSelectedCampusFilterId(e.target.value);
                          resetForm();
                        }}
                      >
                        <option value="all">TOUS LES CAMPUS</option>
                        {campuses.map(c => (
                          <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>
                        ))}
                      </select>
                      <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
                    </div>
                  )}
                </div>
                
                {targetType === 'student' && (
                  !selectedStudent ? (
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Rechercher l'{terminology.student.toLowerCase()}</label>
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                          type="text" 
                          placeholder={`Tapez le nom, prénom ou ID de l'${terminology.student.toLowerCase()}...`} 
                          className="w-full pl-12 pr-4 py-3.5 bg-gray-50 text-gray-900 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all" 
                          value={searchTerm} 
                          onChange={(e) => setSearchTerm(e.target.value)} 
                        />
                        {searchResults.length > 0 && (
                          <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95">
                            {searchResults.map(s => (
                              <button 
                                key={s.id} 
                                onClick={() => loadStudentPricing(s)} 
                                className="w-full flex justify-between items-center px-5 py-3.5 hover:bg-indigo-50 border-b border-gray-100 last:border-0 group transition-colors text-left"
                              >
                                <div>
                                  <p className="font-bold text-gray-900 text-sm">{formatStudentName(s.last_name, s.first_name).fullName}</p>
                                  <p className="text-xs text-gray-500 mt-0.5">{s.class?.name || 'Classe non assignée'} {hasMultipleCampuses && `• ${getCampusName(s.campus_id)}`}</p>
                                </div>
                                <ArrowRight size={16} className="text-gray-400 group-hover:text-indigo-600 transition-transform group-hover:translate-x-1" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 rounded-2xl text-white relative overflow-hidden bg-indigo-600 shadow-md">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-xl pointer-events-none"></div>
                      <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center font-black text-xl border border-white/20">
                            {selectedStudent.last_name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="text-lg font-bold">{formatStudentName(selectedStudent.last_name, selectedStudent.first_name).fullName}</h4>
                            <p className="text-xs font-medium text-indigo-100 mt-0.5">
                              ID-{selectedStudent.id.substring(0,8)} • {selectedStudent.class?.name || 'Classe non définie'}
                              {hasMultipleCampuses && ` • ${getCampusName(selectedStudent.campus_id)}`}
                            </p>
                          </div>
                        </div>
                        <button onClick={resetForm} className="p-2 hover:bg-white/20 rounded-xl transition-colors text-white" title="Changer d'élève">
                          <X size={20} />
                        </button>
                      </div>
                    </div>
                  )
                )}

                {targetType === 'class' && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Sélectionner la {terminology.class.toLowerCase()} cible</label>
                    <div className="relative">
                      <select 
                        className="w-full px-4 py-3.5 bg-gray-50 text-gray-900 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 appearance-none transition-all"
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                      >
                        <option value="">-- Choisir une {terminology.class.toLowerCase()} --</option>
                        {classes.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.level}) {hasMultipleCampuses ? ` - [${getCampusName(c.campus_id)}]` : ''}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                    </div>
                  </div>
                )}

                {targetType === 'school' && (
                  <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-4">
                    <div className="p-3 bg-rose-100 text-rose-600 rounded-xl shrink-0"><ShieldAlert size={24} /></div>
                    <div>
                      <h4 className="text-rose-900 font-bold text-base">Action Souveraine Globale</h4>
                      <p className="text-rose-700 text-xs mt-1 leading-relaxed">
                        Cette réévaluation s'appliquera à TOUS les {terminology.students.toLowerCase()} inscrit(e)s 
                        {selectedCampusFilterId !== 'all' ? ` du campus ${getCampusName(selectedCampusFilterId)}` : ' de l\'établissement'} pour la session active.
                      </p>
                    </div>
                  </div>
                )}

                {/* Financial Summary Card for Selected Student */}
                {targetType === 'student' && selectedStudent && (
                  <div className="space-y-4 animate-in slide-in-from-bottom duration-300">
                    {selectedStudent.hasExistingDiscount && (
                      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-amber-900">
                        <ShieldAlert size={20} className="mt-0.5 text-amber-600 shrink-0" />
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider">Réévaluation déjà existante</p>
                          <p className="text-xs text-amber-800 mt-1">
                            Cet(te) {terminology.student.toLowerCase()} bénéficie déjà d'un ajustement de <strong>{selectedStudent.discount_amount?.toLocaleString()} HTG</strong> ({selectedStudent.discount_label}).
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Contrat de Base Brut</p>
                        <p className="text-base font-black text-slate-900">{selectedStudent.initialTotal?.toLocaleString()} HTG</p>
                        {selectedStudent.hasExistingDiscount && (
                          <span className="text-[10px] font-bold text-amber-700 block mt-0.5">
                            - Rééval. : {selectedStudent.existingDiscountAmount?.toLocaleString()} HTG
                          </span>
                        )}
                      </div>
                      <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200">
                        <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wider mb-1">Déjà Encaissé</p>
                        <p className="text-base font-black text-emerald-950">{Number(selectedStudent.paidAmount || 0).toLocaleString()} HTG</p>
                      </div>
                      <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-200">
                        <p className="text-[10px] font-black text-indigo-700 uppercase tracking-wider mb-1">Dette Restante Réelle</p>
                        <p className="text-base font-black text-indigo-950">{(selectedStudent.detteRestanteReelle ?? Math.max(0, (selectedStudent.initialTotal - (selectedStudent.existingDiscountAmount || 0)) - Number(selectedStudent.paidAmount || 0))).toLocaleString()} HTG</p>
                      </div>
                    </div>

                    {/* Décomposition Détaillée du Contrat Réel */}
                    <div className="bg-slate-50/90 border border-slate-200 p-4 rounded-2xl text-xs space-y-2">
                      <div className="font-bold text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200 pb-1.5 flex items-center justify-between">
                        <span>Décomposition Détaillée du Contrat Réel & Devises Initiales</span>
                        <div className="text-right">
                          <span className="text-indigo-600 font-mono font-bold">{selectedStudent.netContractTotal?.toLocaleString()} HTG Net</span>
                          <span className="text-[9px] text-slate-400 block font-normal">(Brut: {selectedStudent.initialTotal?.toLocaleString()} HTG)</span>
                        </div>
                      </div>
                      {(() => {
                        const hasMisc = Number(selectedStudent.miscTotal || 0) > 0;
                        const hasAdHoc = Number(selectedStudent.adHocFeesTotal || 0) > 0;
                        const colsCount = 2 + (hasMisc ? 1 : 0) + (hasAdHoc ? 1 : 0);
                        const gridClass = colsCount === 4 ? 'sm:grid-cols-4' : colsCount === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';

                        return (
                          <div className={`grid grid-cols-2 ${gridClass} gap-2.5 text-slate-600 pt-1`}>
                            <div>
                              <span className="text-[10px] text-slate-400 block font-medium">Inscription / Admission</span>
                              <span className="font-bold text-slate-800 block">{Number(selectedStudent.admissionTotal || 0).toLocaleString()} HTG</span>
                              {selectedStudent.admUSD > 0 && (
                                <span className="text-[9px] font-mono text-indigo-600 font-bold block">(${selectedStudent.admUSD} USD)</span>
                              )}
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block font-medium">Frais Scolarité</span>
                              <span className="font-bold text-slate-800 block">{Number(selectedStudent.tuitionTotal || 0).toLocaleString()} HTG</span>
                              {selectedStudent.tuiUSD > 0 && (
                                <span className="text-[9px] font-mono text-slate-500 block">({selectedStudent.tuiHTG.toLocaleString()} G + ${selectedStudent.tuiUSD} USD)</span>
                              )}
                            </div>
                            {hasMisc && (
                              <div>
                                <span className="text-[10px] text-slate-400 block font-medium">Frais Divers Obligatoires</span>
                                <span className="font-bold text-slate-800 block">{Number(selectedStudent.miscTotal || 0).toLocaleString()} HTG</span>
                                {selectedStudent.miscUSD > 0 && (
                                  <span className="text-[9px] font-mono font-bold text-indigo-600 block">Devise Initiale : ${selectedStudent.miscUSD} USD</span>
                                )}
                              </div>
                            )}
                            {hasAdHoc && (
                              <div>
                                <span className="text-[10px] text-slate-400 block font-medium">Campagnes & Frais Spéciaux</span>
                                <span className="font-bold text-slate-800 block">{Number(selectedStudent.adHocFeesTotal || 0).toLocaleString()} HTG</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between text-[10px] text-slate-500 font-medium gap-2">
                        <span>Taux de change planifié : <strong>1 USD = {selectedStudent.exchangeRate || 135} HTG</strong></span>
                        {selectedStudent.hasExistingDiscount && (
                          <span className="text-amber-700 font-bold">Réévaluation Actuelle : -{selectedStudent.existingDiscountAmount?.toLocaleString()} HTG</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Act & Final Calculation */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6 relative flex flex-col">
                {showSuccess ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 py-8 animate-in zoom-in">
                    <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
                      <CheckCircle2 size={28} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Ajustement Scellé</h3>
                      <p className="text-gray-500 text-xs mt-1">La nouvelle balance est immédiatement effective au guichet.</p>
                    </div>
                    <button onClick={resetForm} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm">
                      Etablir un Autre Acte
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5">
                        <Sparkles className="text-amber-500" size={18} />
                        <h3 className="text-sm font-bold text-gray-900">Ajustement Souverain</h3>
                      </div>

                      <div className="space-y-3.5">
                        {/* Regime Selection */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Catégorie / Régime de Bourse</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setScholarshipRegime('standard');
                                setSelectedCategory('');
                              }}
                              className={`p-2.5 rounded-xl border text-left transition-all ${
                                scholarshipRegime === 'standard'
                                  ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20 text-indigo-950 shadow-sm'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-xs font-black">Option Standard</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${scholarshipRegime === 'standard' ? 'bg-indigo-200/60 text-indigo-900' : 'bg-slate-200 text-slate-600'}`}>Scolarité</span>
                              </div>
                              <p className="text-[10px] leading-tight text-slate-500">
                                Bourse sur Scolarité (Exclut les frais divers)
                              </p>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setScholarshipRegime('complete');
                                setSelectedCategory('');
                              }}
                              className={`p-2.5 rounded-xl border text-left transition-all ${
                                scholarshipRegime === 'complete'
                                  ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-950 shadow-sm'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-xs font-black">Option Complète</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${scholarshipRegime === 'complete' ? 'bg-amber-200/60 text-amber-900' : 'bg-slate-200 text-slate-600'}`}>Complète</span>
                              </div>
                              <p className="text-[10px] leading-tight text-slate-500">
                                Bourse Complète / Sociale (Scolarité + Frais Divers)
                              </p>
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Motif de Réévaluation</label>
                          <div className="relative">
                            <select 
                              required 
                              disabled={(targetType === 'student' && !selectedStudent) || (targetType === 'class' && !selectedClassId)} 
                              className="w-full px-3.5 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 appearance-none disabled:opacity-50 transition-all cursor-pointer" 
                              value={selectedCategory} 
                              onChange={(e) => setSelectedCategory(e.target.value)}
                            >
                              <option value="" className="bg-white text-slate-700">-- Choisir le Motif de l'Acte ({scholarshipRegime === 'complete' ? 'Bourse Complète' : 'Bourse Scolarité'}) --</option>
                              {currentCategories.map(cat => (
                                <option key={cat.id} value={cat.id} className="bg-white text-slate-900 font-medium py-1">
                                  {cat.label}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={15} />
                          </div>
                        </div>

                        {selectedCategory === 'custom' && (
                          <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                            <label className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">Montant à déduire (HTG)</label>
                            <div className="relative">
                              <input 
                                type="number" 
                                min="0" 
                                required 
                                className="w-full px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm font-bold text-amber-950 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all" 
                                placeholder="0.00" 
                                value={customAmount} 
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (val < 0) setCustomAmount('0');
                                  else setCustomAmount(e.target.value);
                                }} 
                              />
                              <DollarSign className="absolute right-3.5 top-1/2 -translate-y-1/2 text-amber-600" size={16} />
                            </div>
                          </div>
                        )}
                        
                        {targetType === 'student' && selectedStudent && (
                          <div className="space-y-3 pt-1">
                            {isCapped && (
                              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900 animate-in fade-in duration-300">
                                <ShieldAlert size={16} className="mt-0.5 text-amber-600 shrink-0" />
                                <div>
                                  <p className="text-xs font-bold">Ajustement Plafonné</p>
                                  <p className="text-[10px] text-amber-800 mt-0.5 leading-relaxed">
                                    Le montant demandé de <strong>{originalDiscountValue.toLocaleString()} HTG</strong> dépasse l'assiette éligible (<strong>{eligibleBaseAmount.toLocaleString()} HTG</strong>). Il a été ramené à cette limite.
                                  </p>
                                </div>
                              </div>
                            )}

                            <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl space-y-3 shadow-lg border border-slate-800 text-white">
                               <div>
                                 <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Engagement Final de l'Élève</p>
                                 <p className="text-2xl lg:text-3xl font-black tracking-tight tabular-nums">{finalTotal.toLocaleString()} <span className="text-xs font-medium text-slate-400">HTG</span></p>
                               </div>
                               <div className="flex items-center justify-between pt-2.5 border-t border-slate-800 text-emerald-400">
                                 <div className="flex items-center gap-1.5">
                                   <Sparkles size={13} />
                                   <p className="text-[10px] font-bold uppercase tracking-widest">Économie Accordée ({scholarshipRegime === 'complete' ? 'Bourse Complète' : 'Bourse Scolarité'})</p>
                                 </div>
                                 <p className="text-base lg:text-lg font-black tabular-nums">-{discountValue.toLocaleString()} HTG</p>
                                </div>
                            </div>
                          </div>
                        )}

                        {targetType !== 'student' && selectedCategory && (
                          <div className="bg-indigo-50/80 p-4 rounded-xl space-y-1.5 border border-indigo-100">
                            <p className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Aperçu d'ajustement global</p>
                            <div className="flex items-center justify-between pt-0.5">
                              <span className="text-indigo-800 font-medium text-xs">Abonnement / Valeur :</span>
                              <span className="text-indigo-700 font-black text-sm">
                                {selectedCategory === 'custom' ? `${parseFloat(customAmount || '0').toLocaleString()} HTG` : `${currentCategories.find(c => c.id === selectedCategory)?.value}%`}
                              </span>
                            </div>
                            <p className="text-[10px] text-indigo-600 leading-relaxed pt-0.5">
                              L'ajustement sera calculé individuellement pour chaque {terminology.student.toLowerCase()} basé sur son tarif de classe.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={(targetType === 'student' && !selectedStudent) || (targetType === 'class' && !selectedClassId) || !selectedCategory || isSubmitting} 
                      className="w-full mt-1 py-3.5 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-xs uppercase tracking-wider active:scale-[0.99]"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <><ShieldCheck size={16} /> Sceller la Réévaluation</>}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REGISTRE ET AUDIT DES RÉÉVALUATIONS */}
      {activeTab === 'register' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* KPI Summary Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 shrink-0">
                <TrendingDown size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Réévalué / Remises</p>
                <p className="text-2xl font-black text-slate-900 tracking-tight font-mono mt-0.5">
                  -{totalRegisterDiscountHTG.toLocaleString()} <span className="text-xs text-slate-400 font-sans">HTG</span>
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 shrink-0">
                <Users size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Élèves Boursiers & Bénéficiaires</p>
                <p className="text-2xl font-black text-slate-900 tracking-tight font-mono mt-0.5">
                  {filteredRegisterStudents.length} <span className="text-xs text-slate-400 font-sans">{terminology.students.toLowerCase()}</span>
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100 shrink-0">
                <Award size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Moyenne Réévaluation / Élève</p>
                <p className="text-2xl font-black text-slate-900 tracking-tight font-mono mt-0.5">
                  {filteredRegisterStudents.length > 0 
                    ? Math.round(totalRegisterDiscountHTG / filteredRegisterStudents.length).toLocaleString() 
                    : 0} <span className="text-xs text-slate-400 font-sans">HTG</span>
                </p>
              </div>
            </div>
          </div>

          {/* Table Toolbar / Controls */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full md:w-auto flex-1">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text"
                  placeholder="Rechercher par nom ou motif..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 text-gray-900 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-indigo-500 transition-all"
                  value={registerSearchTerm}
                  onChange={(e) => setRegisterSearchTerm(e.target.value)}
                />
              </div>

              {/* Class Filter */}
              <div className="relative">
                <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <select 
                  className="w-full pl-10 pr-8 py-2.5 bg-gray-50 text-gray-900 border border-gray-200 rounded-xl text-xs font-bold outline-none appearance-none cursor-pointer focus:bg-white focus:border-indigo-500 transition-all"
                  value={registerClassFilter}
                  onChange={(e) => setRegisterClassFilter(e.target.value)}
                >
                  <option value="all">TOUTES LES CLASSES</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
              </div>

              {/* Campus Filter (ONLY if multi-campus) */}
              {!user.campus_id && hasMultipleCampuses && (
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <select 
                    className="w-full pl-10 pr-8 py-2.5 bg-gray-50 text-gray-900 border border-gray-200 rounded-xl text-xs font-bold outline-none appearance-none cursor-pointer focus:bg-white focus:border-indigo-500 transition-all"
                    value={registerCampusFilter}
                    onChange={(e) => setRegisterCampusFilter(e.target.value)}
                  >
                    <option value="all">TOUS LES CAMPUS</option>
                    {campuses.map(c => (
                      <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button 
                onClick={fetchRegisterData} 
                className="p-2.5 text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all"
                title="Rafraîchir"
              >
                <RefreshCcw size={16} className={registerLoading ? "animate-spin text-indigo-600" : ""} />
              </button>

              <button 
                onClick={handleExportRegisterCSV}
                className="px-4 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
              >
                <FileSpreadsheet size={15} /> Export Grand Livre CSV
              </button>
            </div>
          </div>

          {/* Audit Register Table */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
            {registerLoading ? (
              <div className="py-8">
                <FluidLoadingState 
                  message="Chargement du registre des réévaluations & réductions..." 
                  subtext="Récupération sécurisée des bourses, exonérations et actes de révision financière..." 
                />
                <SkeletonTable rows={5} />
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-slate-100 text-[11px] font-black uppercase tracking-wider border-b border-slate-800">
                    <th scope="col" className="px-6 py-4 text-slate-100 font-black">{terminology.student}</th>
                    <th scope="col" className="px-6 py-4 text-slate-100 font-black">{terminology.class}</th>
                    {hasMultipleCampuses && <th scope="col" className="px-6 py-4 text-slate-100 font-black">Campus / Annexe</th>}
                    <th scope="col" className="px-6 py-4 text-slate-100 font-black">Motif de l'Acte</th>
                    <th scope="col" className="px-6 py-4 text-right text-slate-100 font-black">Remise Accordée</th>
                    <th scope="col" className="px-6 py-4 text-center text-slate-100 font-black">Actions Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {filteredRegisterStudents.map(st => (
                    <tr key={st.id} className="hover:bg-indigo-50/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                            {st.last_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">
                              {formatStudentName(st.last_name, st.first_name).fullName}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">ID-{st.id.substring(0,8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-800">{st.class?.name || 'Non assignée'}</span>
                      </td>
                      {hasMultipleCampuses && (
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            {getCampusName(st.campus_id)}
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 rounded-full text-xs font-bold border border-amber-200">
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          {st.discount_label || 'Ajustement Spécial'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-mono text-sm font-black text-rose-600">
                          -{Number(st.discount_amount).toLocaleString()} HTG
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => {
                              setActiveTab('form');
                              setTargetType('student');
                              loadStudentPricing(st);
                            }}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Ajuster la réévaluation"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button 
                            onClick={() => setResetModalStudent(st)}
                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Annuler la remise"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {!registerLoading && filteredRegisterStudents.length === 0 && (
                    <tr>
                      <td colSpan={hasMultipleCampuses ? 6 : 5} className="py-24 text-center">
                        <Award size={40} className="mx-auto text-slate-200 mb-3" />
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                          Aucune réévaluation répertoriée pour ce filtre
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: Confirmation d'Acte Globale / Individuelle */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => {
          setIsConfirmModalOpen(false);
          setPendingSubmit(null);
        }}
        onConfirm={executeSubmit}
        title="Confirmer l'Acte de Réévaluation"
        type={targetType === 'school' ? 'danger' : 'info'}
        confirmLabel="Confirmer et Sceller"
        cancelLabel="Annuler"
        isLoading={isSubmitting}
      >
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-3">
            <ShieldAlert className="text-amber-600 shrink-0" size={20} />
            <p className="text-xs text-amber-900 font-medium leading-relaxed">
              {targetType === 'student' 
                ? `Cet(te) ${terminology.student.toLowerCase()} bénéficie déjà d'une réévaluation. Voulez-vous écraser l'ajustement précédent par ce nouveau montant de ${discountValue.toLocaleString()} HTG ?`
                : targetType === 'class'
                ? `Voulez-vous appliquer cette réévaluation (${currentCategories.find(c => c.id === selectedCategory)?.label}) à TOUTE la ${terminology.class.toLowerCase()} sélectionnée ?`
                : `ATTENTION : Cette opération va appliquer une réévaluation à TOUS les ${terminology.students.toLowerCase()} de l'établissement. Cette action est souveraine et impactera la balance globale.`
              }
            </p>
          </div>
          <p className="text-xs text-slate-500 italic">
            Cette action sera scellée et enregistrée dans le journal d'audit avec votre signature numérique.
          </p>
        </div>
      </Modal>

      {/* MODAL 2: Confirmation d'annulation d'une remise pour un élève */}
      <Modal
        isOpen={!!resetModalStudent}
        onClose={() => setResetModalStudent(null)}
        onConfirm={handleCancelStudentDiscount}
        title="Annuler la Réévaluation"
        type="danger"
        confirmLabel="Annuler la Remise (0 HTG)"
        cancelLabel="Conserver"
        isLoading={isSubmitting}
      >
        {resetModalStudent && (
          <div className="space-y-3">
            <p className="text-xs text-slate-700 leading-relaxed">
              Voulez-vous retirer la remise de <strong>{Number(resetModalStudent.discount_amount).toLocaleString()} HTG</strong> pour l'{terminology.student.toLowerCase()} <strong>{formatStudentName(resetModalStudent.last_name, resetModalStudent.first_name).fullName}</strong> ?
            </p>
            <p className="text-[11px] text-rose-600 font-semibold bg-rose-50 p-3 rounded-xl border border-rose-100">
              L'élève repassera au tarif standard complet de sa classe ({resetModalStudent.class?.name}).
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DiscountManagementView;
