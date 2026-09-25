import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
  Edit3,
  GraduationCap,
  Printer,
  Calendar,
  Eye,
  Check,
  FileText,
  Clock,
  BookOpen
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useSchool } from '../contexts/SchoolContext';
import { supabase } from '../supabase';
import { UserProfile } from '../types';
import { AuditLogger } from '../utils/auditLogger';
import { formatStudentName } from '../utils/formatters';
import Modal from './Modal';
import { FluidLoadingState, SkeletonTable } from './SkeletonLoader';
import { SelectPill, SelectOption } from './SelectPill';
import { ClassSelectorPill } from './ClassSelectorPill';
import { useSecurity } from './SecurityGuard';
import { appendSecuritySheet } from '../utils/excelWatermark';

const discountSchema = z.object({
  category: z.string().min(1, "Veuillez sélectionner un motif de réévaluation"),
  scholarshipRegime: z.enum(['standard', 'complete']),
  customAmount: z.number().min(0, "Le montant de la réévaluation ne peut pas être négatif").optional(),
  targetType: z.enum(['student', 'class', 'school'])
});

export type ScholarshipRegime = 'standard' | 'complete';

export interface DiscountCategoryItem {
  id: string;
  label: string;
  value: number;
  group: 'scholarship' | 'discount' | 'custom' | 'reset';
  groupLabel: string;
  badge: string;
  description: string;
}

// Génère les motifs adaptés dynamiquement selon le périmètre d'assiette sélectionné
const getDiscountCategories = (regime: ScholarshipRegime): DiscountCategoryItem[] => {
  if (regime === 'complete') {
    return [
      { 
        id: 'excellence', 
        label: "Bourse d'Excellence Intégrale (100% Contrat Global)", 
        value: 100,
        group: 'scholarship',
        groupLabel: "Bourses Scolaires",
        badge: '100% Global',
        description: "Exonération intégrale de la scolarité et de l'ensemble des frais obligatoires"
      },
      { 
        id: 'social', 
        label: "Prise en Charge Sociale Totale (100% Contrat Global)", 
        value: 100,
        group: 'scholarship',
        groupLabel: "Bourses Scolaires",
        badge: '100% Social',
        description: "Prise en charge intégrale au titre d'une aide sociale ou d'un parrainage"
      },
      { 
        id: 'social_partial', 
        label: "Prise en Charge Sociale Partielle (50% Contrat Global)", 
        value: 50,
        group: 'scholarship',
        groupLabel: "Bourses Scolaires",
        badge: '50% Social',
        description: "Aide sociale couvrant 50% de l'ensemble du contrat scolaire"
      },
      { 
        id: 'staff', 
        label: "Avantage Collaborateur Complet (50% Contrat Global)", 
        value: 50,
        group: 'discount',
        groupLabel: "Réductions Conventionnelles",
        badge: '50% Personnel',
        description: "Tarif préférentiel personnel appliqué sur la scolarité et les frais obligatoires"
      },
      { 
        id: 'custom', 
        label: "Ajustement Spécial Forfaitaire (HTG)", 
        value: 0,
        group: 'custom',
        groupLabel: "Ajustement Sur-Mesure",
        badge: 'Fixe HTG',
        description: "Déduction d'un montant personnalisé fixe en Gourdes sur le contrat global"
      },
      { 
        id: 'reset', 
        label: "Rétablir Tarif Plein Standard (0 HTG)", 
        value: 0,
        group: 'reset',
        groupLabel: "Plein Tarif",
        badge: 'Tarif Standard',
        description: "Annulation de toute exonération et rétablissement du tarif contractuel nominal"
      }
    ];
  }

  return [
    { 
      id: 'excellence', 
      label: "Bourse d'Excellence (100% Scolarité)", 
      value: 100,
      group: 'scholarship',
      groupLabel: "Bourses Scolaires",
      badge: '100% Scolarité',
      description: "Prise en charge intégrale des frais de scolarité annuelle"
    },
    { 
      id: 'social', 
      label: "Bourse d'Appui Social / Partenariat (25% Scolarité)", 
      value: 25,
      group: 'scholarship',
      groupLabel: "Bourses Scolaires",
      badge: '25% Social',
      description: "Convention de partenariat ou allègement pour motif social"
    },
    { 
      id: 'sibling', 
      label: "Réduction Fratrie (15% Scolarité)", 
      value: 15,
      group: 'discount',
      groupLabel: "Réductions Conventionnelles",
      badge: '15% Fratrie',
      description: "Remise statutaire accordée aux membres d'une même fratrie"
    },
    { 
      id: 'staff', 
      label: "Avantage Collaborateur (50% Scolarité)", 
      value: 50,
      group: 'discount',
      groupLabel: "Réductions Conventionnelles",
      badge: '50% Personnel',
      description: "Tarif préférentiel accordé aux enfants des collaborateurs et enseignants"
    },
    { 
      id: 'custom', 
      label: "Ajustement Spécial Forfaitaire (HTG)", 
      value: 0,
      group: 'custom',
      groupLabel: "Ajustement Sur-Mesure",
      badge: 'Fixe HTG',
      description: "Déduction d'un montant personnalisé fixe en Gourdes sur la scolarité"
    },
    { 
      id: 'reset', 
      label: "Rétablir Tarif Plein Standard (0 HTG)", 
      value: 0,
      group: 'reset',
      groupLabel: "Plein Tarif",
      badge: 'Tarif Standard',
      description: "Annulation de toute exonération et rétablissement du tarif contractuel nominal"
    }
  ];
};

type TargetType = 'student' | 'class' | 'school';
type ViewTab = 'form' | 'register' | 'report';

const DiscountManagementView: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { school, terminology, currentCampusId, campuses } = useSchool();
  const { ipAddress } = useSecurity();
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

  // Calcul du solde restant dû après application de l'ajustement
  const newRemainingDebt = targetType === 'student' && selectedStudent
    ? Math.max(0, finalTotal - Number(selectedStudent.paidAmount || 0))
    : 0;

  // Libellé dynamique précis et contextuel sans mention abusive de "Bourse" s'il n'y en a pas
  const discountSummaryLabel = useMemo(() => {
    if (!selectedCategory || selectedCategory === 'reset') {
      return 'Tarif Plein Rétabli (0 HTG)';
    }
    if (discountValue === 0) {
      return 'Aucune Déduction Appliquée';
    }
    const cat = currentCategories.find(c => c.id === selectedCategory);
    if (cat?.id === 'custom') {
      return `Déduction Forfaitaire (${scholarshipRegime === 'complete' ? 'Contrat Global' : 'Scolarité Seule'})`;
    }
    if (cat?.id === 'sibling') {
      return 'Réduction Fratrie Accordée';
    }
    if (cat?.id === 'staff') {
      return 'Avantage Collaborateur Accordé';
    }
    if (cat?.id === 'excellence') {
      return scholarshipRegime === 'complete' ? 'Bourse d\'Excellence Intégrale' : 'Bourse d\'Excellence Accordée';
    }
    if (cat?.id === 'social' || cat?.id === 'social_partial') {
      return 'Prise en Charge Sociale';
    }
    return `Déduction Accordée (${cat?.label || 'Ajustement'})`;
  }, [selectedCategory, discountValue, scholarshipRegime, currentCategories]);

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
        if (targetType === 'class' && selectedClassId && selectedClassId.toLowerCase() !== 'all') query = query.eq('class_id', selectedClassId);
        
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
    if (registerLoading) {
      toast.error("Veuillez patienter pendant le chargement du registre...");
      return;
    }
    if (filteredRegisterStudents.length === 0) {
      toast.error("Aucune donnée à exporter.");
      return;
    }

    const headers = hasMultipleCampuses 
      ? ["Nom", "Prenom", "Classe", "Campus/Annexe", "Motif de Réévaluation", "Montant Remise (HTG)"]
      : ["Nom", "Prenom", "Classe", "Motif de Réévaluation", "Montant Remise (HTG)"];

    const rows = filteredRegisterStudents.map(st => {
      const row = [
        (st.last_name || '').replace(/;/g, ' '),
        (st.first_name || '').replace(/;/g, ' '),
        (st.class?.name || 'N/A').replace(/;/g, ' ')
      ];
      if (hasMultipleCampuses) {
        row.push(getCampusName(st.campus_id).replace(/;/g, ' '));
      }
      row.push(
        (st.discount_label || 'Ajustement').replace(/;/g, ' '),
        st.discount_amount || 0
      );
      return row;
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Registre_Reevaluations_${school?.name ? school.name.replace(/\s+/g, '_') : 'etablissement'}_${activeYear?.label || 'active'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Registre des réévaluations exporté avec succès.");
  };

  // Exportation Excel du registre
  const handleExportRegisterExcel = () => {
    if (registerLoading) {
      toast.error("Veuillez patienter pendant le chargement du registre...");
      return;
    }
    if (filteredRegisterStudents.length === 0) {
      toast.error("Aucune donnée à exporter.");
      return;
    }

    const data = filteredRegisterStudents.map((st, idx) => {
      const row: any = {
        'N°': idx + 1,
        [terminology.student]: formatStudentName(st.last_name || '', st.first_name || '').fullName,
        'Matricule / ID': st.id?.substring(0, 8) || 'N/A',
        [terminology.class]: st.class?.name || 'N/A',
      };
      if (hasMultipleCampuses) {
        row['Campus / Annexe'] = getCampusName(st.campus_id);
      }
      row['Motif de Réévaluation'] = st.discount_label || 'Ajustement';
      row['Montant Remise (HTG)'] = Number(st.discount_amount || 0);
      row['Statut'] = 'Scellé & Validé';
      row['Session Académique'] = activeYear?.label || 'Active';
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Audit Réévaluations');
    appendSecuritySheet(wb, { user, ipAddress });
    XLSX.writeFile(wb, `Registre_Audit_Reevaluations_${school?.name ? school.name.replace(/\s+/g, '_') : 'etablissement'}_${activeYear?.label || 'active'}.xlsx`);
    toast.success("Registre exporté en Excel avec succès.");
  };

  return (
    <div className="max-w-7xl mx-auto space-y-3.5 sm:space-y-4 animate-in fade-in duration-300 pb-12 px-2.5 sm:px-4 md:px-0">
      {/* Header Banner - Concise, Dense & Ergonomic */}
      <div className="bg-white p-3.5 sm:p-4 lg:p-4.5 rounded-xl shadow-xs border border-slate-200 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/40 rounded-full -mr-32 -mt-32 blur-2xl pointer-events-none"></div>
        
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-1.5 text-indigo-600 font-bold text-[10px] uppercase tracking-wider">
            <ShieldCheck size={13} className="text-indigo-600 shrink-0" /> 
            <span>Direction de l'Économat</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
            Audit & Actes de Réévaluation
          </h2>
          
          <div className="flex items-center gap-2 flex-wrap pt-0.5 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-md border border-indigo-100">
              <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>{school?.name || 'Établissement'}</span>
            </span>
            {hasMultipleCampuses && (
              !user.campus_id && (user.role === 'SUPER_ADMIN' || user.role === 'DIRECTOR') ? (
                <div className="relative min-w-[160px]">
                  <SelectPill
                    value={selectedCampusFilterId}
                    onChange={(val) => {
                      setSelectedCampusFilterId(val);
                      resetForm();
                    }}
                    options={[
                      { value: 'all', label: 'Tous les Campus / Annexes', badge: campuses.length.toString() },
                      ...campuses.map(c => ({ value: c.id, label: c.name }))
                    ]}
                    icon={Building2}
                    variant="pill"
                    size="sm"
                    colorScheme="indigo"
                    labelPrefix="Campus : "
                  />
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-md border border-slate-200">
                  <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{getCampusName(user.campus_id || selectedCampusFilterId)}</span>
                </span>
              )
            )}
            <span className="text-slate-500 text-xs font-mono font-bold">
              Session {activeYear?.label || 'Active'}
            </span>
          </div>
        </div>

        {/* 3 Header Buttons - Dynamiquement Responsive sur Mobile, Tablette et Desktop */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100/90 rounded-xl border border-slate-200/90 relative z-10 w-full lg:w-auto lg:flex lg:items-center shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 lg:px-4 py-2 rounded-lg text-xs font-bold transition-all duration-150 min-h-[38px] cursor-pointer select-none ${
              activeTab === 'form' 
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/90 ring-1 ring-slate-900/5' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
            title="Établir un acte souverain de réévaluation"
          >
            <Edit3 size={14} className={`shrink-0 ${activeTab === 'form' ? 'text-indigo-600' : 'text-slate-500'}`} /> 
            <span className="hidden lg:inline whitespace-nowrap">Acte de Réévaluation</span>
            <span className="hidden sm:inline lg:hidden whitespace-nowrap">Acte Rééval.</span>
            <span className="sm:hidden text-center truncate">Acte</span>
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 lg:px-4 py-2 rounded-lg text-xs font-bold transition-all duration-150 min-h-[38px] cursor-pointer select-none ${
              activeTab === 'register' 
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/90 ring-1 ring-slate-900/5' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
            title="Consulter le registre officiel et l'audit des remises"
          >
            <Award size={14} className={`shrink-0 ${activeTab === 'register' ? 'text-indigo-600' : 'text-slate-500'}`} /> 
            <span className="hidden lg:inline whitespace-nowrap">Registre & Audit</span>
            <span className="hidden sm:inline lg:hidden whitespace-nowrap">Registre</span>
            <span className="sm:hidden text-center truncate">Registre</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold tabular-nums shrink-0 transition-colors ${
              activeTab === 'register' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200/80 text-slate-600'
            }`}>
              {discountedStudents.length}
            </span>
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab('report')}
            className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 lg:px-4 py-2 rounded-lg text-xs font-bold transition-all duration-150 min-h-[38px] cursor-pointer select-none ${
              activeTab === 'report' 
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/90 ring-1 ring-slate-900/5' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
            title="Grand Livre analytique et extrait officiel certifié"
          >
            <FileSpreadsheet size={14} className={`shrink-0 ${activeTab === 'report' ? 'text-indigo-600' : 'text-slate-500'}`} /> 
            <span className="hidden xl:inline whitespace-nowrap">Grand Livre & Rapport</span>
            <span className="hidden sm:inline xl:hidden whitespace-nowrap">Grand Livre</span>
            <span className="sm:hidden text-center truncate">Livre</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold tabular-nums shrink-0 transition-colors ${
              activeTab === 'report' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200/80 text-slate-600'
            }`}>
              {filteredRegisterStudents.length}
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: FORMULAIRE D'AJUSTEMENT SOUVERAIN */}
      {activeTab === 'form' && (
        <div className="space-y-3.5">
          {/* Controls Bar for Scope selection - Compact & Ergonomic */}
          <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider shrink-0">
              <Layers size={14} className="text-indigo-600 shrink-0" /> 
              <span>Périmètre d'application :</span>
            </div>
            
            <div className="grid grid-cols-3 gap-1.5 w-full sm:w-auto">
              {(['student', 'class', 'school'] as TargetType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTargetType(t); resetForm(); }}
                  className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all text-center whitespace-nowrap min-h-[34px] sm:min-h-[36px] flex items-center justify-center cursor-pointer ${
                    targetType === t 
                      ? 'bg-indigo-600 text-white shadow-xs' 
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                  }`}
                >
                  {t === 'student' ? `Individuel (${terminology.student})` : t === 'class' ? `Classe entière` : 'Établissement'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4">
            {/* Left Column: Scope Target */}
            <div className="lg:col-span-7 space-y-3.5">
              <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-3.5 sm:p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="text-indigo-600" size={17} />
                    <h3 className="text-sm font-bold text-slate-900">Ciblage du Périmètre</h3>
                  </div>

                  {/* Multi-Campus Selector inside Form (if applicable) - Harmonisé Style Pilule */}
                  {!user.campus_id && hasMultipleCampuses && (
                    <SelectPill
                      value={selectedCampusFilterId}
                      onChange={(val) => {
                        setSelectedCampusFilterId(val);
                        resetForm();
                      }}
                      options={[
                        { value: 'all', label: 'Tous les Campus / Annexes', badge: campuses.length.toString() },
                        ...campuses.map(c => ({ value: c.id, label: c.name }))
                      ]}
                      icon={Building2}
                      variant="pill"
                      size="sm"
                      colorScheme="indigo"
                      labelPrefix="Campus : "
                    />
                  )}
                </div>
                
                {targetType === 'student' && (
                  !selectedStudent ? (
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Rechercher l'{terminology.student.toLowerCase()}</label>
                      <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          placeholder={`Tapez le nom, prénom ou ID de l'${terminology.student.toLowerCase()}...`} 
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-lg text-xs sm:text-sm font-medium outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all min-h-[38px]" 
                          value={searchTerm} 
                          onChange={(e) => setSearchTerm(e.target.value)} 
                        />
                        {searchResults.length > 0 && (
                          <div className="absolute top-full left-0 right-0 z-50 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden animate-in zoom-in-95">
                            {searchResults.map(s => (
                              <button 
                                key={s.id} 
                                onClick={() => loadStudentPricing(s)} 
                                className="w-full flex justify-between items-center px-4 py-2.5 hover:bg-indigo-50 border-b border-slate-100 last:border-0 group transition-colors text-left"
                              >
                                <div>
                                  <p className="font-bold text-slate-900 text-xs sm:text-sm">{formatStudentName(s.last_name, s.first_name).fullName}</p>
                                  <p className="text-[11px] text-slate-500 mt-0.5">{s.class?.name || 'Classe non assignée'} {hasMultipleCampuses && `• ${getCampusName(s.campus_id)}`}</p>
                                </div>
                                <ArrowRight size={14} className="text-slate-400 group-hover:text-indigo-600 transition-transform group-hover:translate-x-1" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 sm:p-4 rounded-xl text-white relative overflow-hidden bg-indigo-600 shadow-xs">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-xl pointer-events-none"></div>
                      <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center font-black text-lg border border-white/20 shrink-0">
                            {selectedStudent.last_name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="text-sm sm:text-base font-bold leading-tight">{formatStudentName(selectedStudent.last_name, selectedStudent.first_name).fullName}</h4>
                            <p className="text-xs font-medium text-indigo-100 mt-0.5">
                              ID-{selectedStudent.id.substring(0,8)} • {selectedStudent.class?.name || `${terminology.class} non définie`}
                              {hasMultipleCampuses && ` • ${getCampusName(selectedStudent.campus_id)}`}
                            </p>
                          </div>
                        </div>
                        <button onClick={resetForm} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white cursor-pointer" title={`Changer d'${terminology.student.toLowerCase()}`}>
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  )
                )}

                {targetType === 'class' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <GraduationCap size={14} className="text-indigo-600" />
                        <span>Sélectionner la {terminology.class.toLowerCase()} cible</span>
                      </label>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100">
                        {classes.length} {classes.length > 1 ? terminology.classes.toLowerCase() : terminology.class.toLowerCase()}
                      </span>
                    </div>
                    <ClassSelectorPill
                      classes={classes}
                      selectedClassId={selectedClassId}
                      onSelectClass={(classId) => setSelectedClassId(classId)}
                      allowAll={false}
                      emptyLabel={`-- Choisir une ${terminology.class.toLowerCase()} --`}
                      variant="field"
                      size="md"
                      colorScheme="indigo"
                      className="w-full"
                    />
                  </div>
                )}

                {targetType === 'school' && (
                  <div className="p-3.5 sm:p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
                    <div className="p-2.5 bg-rose-100 text-rose-600 rounded-lg shrink-0"><ShieldAlert size={20} /></div>
                    <div>
                      <h4 className="text-rose-900 font-bold text-sm">Action Souveraine Globale</h4>
                      <p className="text-rose-700 text-xs mt-0.5 leading-relaxed">
                        Cette réévaluation s'appliquera à TOUS les {terminology.students.toLowerCase()} inscrit(e)s 
                        {selectedCampusFilterId !== 'all' ? ` du campus ${getCampusName(selectedCampusFilterId)}` : ' de l\'établissement'} pour la session active.
                      </p>
                    </div>
                  </div>
                )}

                {/* Financial Summary Card for Selected Student */}
                {targetType === 'student' && selectedStudent && (
                  <div className="space-y-2.5 animate-in slide-in-from-bottom duration-200">
                    {selectedStudent.hasExistingDiscount && (
                      <div className="bg-amber-50 border border-amber-200 p-2.5 sm:p-3 rounded-lg flex items-start gap-2.5 text-amber-900">
                        <ShieldAlert size={18} className="mt-0.5 text-amber-600 shrink-0" />
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider">Réévaluation déjà existante</p>
                          <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                            Cet(te) {terminology.student.toLowerCase()} bénéficie déjà d'un ajustement de <strong>{selectedStudent.discount_amount?.toLocaleString()} HTG</strong> ({selectedStudent.discount_label}).
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
                      <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Contrat de Base Brut</p>
                        <p className="text-sm sm:text-base font-black text-slate-900 font-mono">{selectedStudent.initialTotal?.toLocaleString()} HTG</p>
                        {selectedStudent.hasExistingDiscount && (
                          <span className="text-[10px] font-bold text-amber-700 block mt-0.5">
                            - Rééval. : {selectedStudent.existingDiscountAmount?.toLocaleString()} HTG
                          </span>
                        )}
                      </div>
                      <div className="bg-emerald-50/70 p-2.5 sm:p-3 rounded-xl border border-emerald-200">
                        <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-0.5">Déjà Encaissé</p>
                        <p className="text-sm sm:text-base font-black text-emerald-950 font-mono">{Number(selectedStudent.paidAmount || 0).toLocaleString()} HTG</p>
                      </div>
                      <div className="bg-indigo-50/70 p-2.5 sm:p-3 rounded-xl border border-indigo-200">
                        <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider mb-0.5">Dette Restante Réelle</p>
                        <p className="text-sm sm:text-base font-black text-indigo-950 font-mono">{(selectedStudent.detteRestanteReelle ?? Math.max(0, (selectedStudent.initialTotal - (selectedStudent.existingDiscountAmount || 0)) - Number(selectedStudent.paidAmount || 0))).toLocaleString()} HTG</p>
                      </div>
                    </div>

                    {/* Décomposition Détaillée du Contrat Réel */}
                    <div className="bg-slate-50/90 border border-slate-200 p-3 rounded-xl text-xs space-y-1.5">
                      <div className="font-bold text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200 pb-1 flex items-center justify-between">
                        <span>Décomposition Détaillée du Contrat Réel</span>
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
                          <div className={`grid grid-cols-2 ${gridClass} gap-2 text-slate-600 pt-0.5`}>
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
                                  <span className="text-[9px] font-mono font-bold text-indigo-600 block">(${selectedStudent.miscUSD} USD)</span>
                                )}
                              </div>
                            )}
                            {hasAdHoc && (
                              <div>
                                <span className="text-[10px] text-slate-400 block font-medium">Campagnes Spéciales</span>
                                <span className="font-bold text-slate-800 block">{Number(selectedStudent.adHocFeesTotal || 0).toLocaleString()} HTG</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      <div className="pt-1.5 border-t border-slate-200/60 flex flex-wrap items-center justify-between text-[10px] text-slate-500 font-medium gap-2">
                        <span>Taux planifié : <strong>1 USD = {selectedStudent.exchangeRate || 135} HTG</strong></span>
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
              <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-3.5 sm:p-4 relative flex flex-col">
                {showSuccess ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 py-6 animate-in zoom-in">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Ajustement Scellé</h3>
                      <p className="text-slate-500 text-xs mt-0.5">La nouvelle balance est immédiatement effective au guichet.</p>
                    </div>
                    <button onClick={resetForm} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer">
                      Établir un Autre Acte
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
                        <Sparkles className="text-amber-500" size={16} />
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Ajustement Souverain</h3>
                      </div>

                      <div className="space-y-3">
                        {/* Périmètre d'Application / Assiette */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                              <Layers size={13} className="text-indigo-600" />
                              <span>Assiette d'Application</span>
                            </label>
                            {targetType === 'student' && selectedStudent && (
                              <span className="text-[10px] font-bold text-slate-500 font-mono">
                                Base : {scholarshipRegime === 'complete' 
                                  ? (Number(selectedStudent.tuitionTotal || 0) + Number(selectedStudent.miscTotal || 0)).toLocaleString() 
                                  : Number(selectedStudent.tuitionTotal || 0).toLocaleString()} HTG
                              </span>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setScholarshipRegime('standard');
                                setSelectedCategory('');
                              }}
                              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                scholarshipRegime === 'standard'
                                  ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/20 text-indigo-950 shadow-xs'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/80'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-xs font-bold flex items-center gap-1">
                                  <GraduationCap size={13} className={scholarshipRegime === 'standard' ? 'text-indigo-600' : 'text-slate-400'} />
                                  Scolarité Seule
                                </span>
                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md ${
                                  scholarshipRegime === 'standard' ? 'bg-indigo-200/70 text-indigo-900' : 'bg-slate-200 text-slate-600'
                                }`}>
                                  Standard
                                </span>
                              </div>
                              <p className="text-[10px] leading-tight text-slate-500">
                                Frais d'études purs (exclut divers)
                              </p>
                              {targetType === 'student' && selectedStudent && (
                                <p className="text-[10px] font-mono font-bold text-indigo-700 mt-1">
                                  {Number(selectedStudent.tuitionTotal || 0).toLocaleString()} HTG
                                </p>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setScholarshipRegime('complete');
                                setSelectedCategory('');
                              }}
                              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                scholarshipRegime === 'complete'
                                  ? 'bg-amber-50/90 border-amber-500 ring-2 ring-amber-500/20 text-amber-950 shadow-xs'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/80'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-xs font-bold flex items-center gap-1">
                                  <Layers size={13} className={scholarshipRegime === 'complete' ? 'text-amber-600' : 'text-slate-400'} />
                                  Contrat Global
                                </span>
                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md ${
                                  scholarshipRegime === 'complete' ? 'bg-amber-200/70 text-amber-900' : 'bg-slate-200 text-slate-600'
                                }`}>
                                  Intégral
                                </span>
                              </div>
                              <p className="text-[10px] leading-tight text-slate-500">
                                Prise en charge étendue globale
                              </p>
                              {targetType === 'student' && selectedStudent && (
                                <p className="text-[10px] font-mono font-bold text-amber-700 mt-1">
                                  {(Number(selectedStudent.tuitionTotal || 0) + Number(selectedStudent.miscTotal || 0)).toLocaleString()} HTG
                                </p>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Motif de Réévaluation - Choix Moderne et Fluide */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                              <Award size={13} className="text-indigo-600" />
                              <span>Motif de Réévaluation</span>
                            </label>
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.2 rounded border border-indigo-100">
                              {scholarshipRegime === 'complete' ? 'Contrat Global' : 'Scolarité Seule'}
                            </span>
                          </div>

                          {/* Raccourcis Rapides en Pilules / Catégories */}
                          <div className="flex items-center gap-1 flex-wrap">
                            {currentCategories.map(cat => (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => setSelectedCategory(cat.id)}
                                disabled={(targetType === 'student' && !selectedStudent) || (targetType === 'class' && !selectedClassId)}
                                className={`text-[10px] sm:text-[11px] px-2 py-0.5 rounded-lg font-bold transition-all border flex items-center gap-1 cursor-pointer ${
                                  selectedCategory === cat.id
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                {cat.group === 'scholarship' && <Award size={11} className={selectedCategory === cat.id ? 'text-indigo-200' : 'text-indigo-600'} />}
                                {cat.group === 'discount' && <Users size={11} className={selectedCategory === cat.id ? 'text-indigo-200' : 'text-blue-600'} />}
                                {cat.group === 'custom' && <DollarSign size={11} className={selectedCategory === cat.id ? 'text-indigo-200' : 'text-amber-600'} />}
                                {cat.group === 'reset' && <CheckCircle2 size={11} className={selectedCategory === cat.id ? 'text-indigo-200' : 'text-slate-500'} />}
                                <span>{cat.badge}</span>
                              </button>
                            ))}
                          </div>

                          {/* Liste déroulante SelectPill harmonisée */}
                          <SelectPill
                            value={selectedCategory}
                            onChange={(val) => setSelectedCategory(val)}
                            options={[
                              { value: '', label: '-- Sélectionner le motif de réévaluation --' },
                              ...currentCategories.map(cat => ({
                                value: cat.id,
                                label: cat.label,
                                badge: cat.badge,
                                description: cat.description
                              }))
                            ]}
                            placeholder="-- Sélectionner le motif de réévaluation --"
                            disabled={(targetType === 'student' && !selectedStudent) || (targetType === 'class' && !selectedClassId)}
                            icon={Award}
                            variant="field"
                            size="md"
                            colorScheme="indigo"
                            searchable={false}
                            className="w-full"
                          />
                        </div>

                        {/* Montant Forfaitaire Personnalisé (HTG) */}
                        {selectedCategory === 'custom' && (
                          <div className="space-y-1.5 p-2.5 sm:p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl animate-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block">
                                Montant Forfaitaire à Déduire (HTG)
                              </label>
                              {eligibleBaseAmount > 0 && (
                                <span className="text-[10px] text-amber-700 font-medium font-mono">
                                  Plafond : <strong>{eligibleBaseAmount.toLocaleString()} HTG</strong>
                                </span>
                              )}
                            </div>
                            <div className="relative">
                              <input 
                                type="number" 
                                min="0" 
                                max={eligibleBaseAmount > 0 ? eligibleBaseAmount : undefined}
                                required 
                                className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs sm:text-sm font-black text-amber-950 outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all font-mono" 
                                placeholder="ex: 10000" 
                                value={customAmount} 
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (val < 0) setCustomAmount('0');
                                  else setCustomAmount(e.target.value);
                                }} 
                              />
                              <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-600" size={15} />
                            </div>

                            {/* Raccourcis rapides ergonomiques */}
                            {eligibleBaseAmount > 0 && (
                              <div className="flex items-center gap-1 pt-0.5 flex-wrap">
                                <span className="text-[10px] text-amber-700 font-bold uppercase mr-0.5">Suggestions :</span>
                                {[5000, 10000, 15000, eligibleBaseAmount]
                                  .filter(val => val <= eligibleBaseAmount)
                                  .map((val, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => setCustomAmount(val.toString())}
                                      className={`text-[10px] px-1.5 py-0.5 rounded border font-mono font-bold transition-all cursor-pointer ${
                                        customAmount === val.toString()
                                          ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                                          : 'bg-white text-amber-900 border-amber-200 hover:bg-amber-100'
                                      }`}
                                    >
                                      {val === eligibleBaseAmount ? 'Totalité' : `${val.toLocaleString()} G`}
                                    </button>
                                  ))}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Synthèse Visuelle Moderne pour l'Élève */}
                        {targetType === 'student' && selectedStudent && (
                          <div className="space-y-2 pt-0.5">
                            {isCapped && (
                              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-amber-900 animate-in fade-in duration-200">
                                <ShieldAlert size={15} className="mt-0.5 text-amber-600 shrink-0" />
                                <div>
                                  <p className="text-xs font-bold">Ajustement Plafonné</p>
                                  <p className="text-[10px] text-amber-800 mt-0.5 leading-relaxed">
                                    Le montant demandé de <strong>{originalDiscountValue.toLocaleString()} HTG</strong> dépasse l'assiette éligible (<strong>{eligibleBaseAmount.toLocaleString()} HTG</strong>). Il a été ramené à cette limite.
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Carte Sombre Moderne Récapitulative - Compacte */}
                            <div className="bg-slate-900 p-3.5 sm:p-4 rounded-xl space-y-2.5 shadow-md border border-slate-800 text-white animate-in fade-in duration-150">
                              <div className="flex items-start justify-between gap-2.5">
                                <div>
                                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-0.5">
                                    Contrat Net Réévalué
                                  </p>
                                  <p className="text-xl sm:text-2xl font-black tracking-tight tabular-nums font-mono">
                                    {finalTotal.toLocaleString()} <span className="text-xs font-medium text-slate-400 font-sans">HTG</span>
                                  </p>
                                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                                    Brut initial : {selectedStudent.initialTotal?.toLocaleString()} HTG
                                  </span>
                                </div>

                                {Number(selectedStudent.paidAmount || 0) > 0 && (
                                  <div className="text-right bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/60">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                                      Nouveau Reste
                                    </p>
                                    <p className="text-base font-black text-amber-400 tabular-nums font-mono">
                                      {newRemainingDebt.toLocaleString()} <span className="text-[10px] font-semibold text-amber-300/80 font-sans">HTG</span>
                                    </p>
                                    <span className="text-[9px] text-emerald-400 font-medium block mt-0.5">
                                      Versé : {Number(selectedStudent.paidAmount).toLocaleString()} HTG
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Ligne d'ajustement dynamique et contextuelle */}
                              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                                <div className="flex items-center gap-1.5">
                                  {selectedCategory === 'reset' || discountValue === 0 ? (
                                    <CheckCircle2 size={13} className="text-slate-400 shrink-0" />
                                  ) : (
                                    <Sparkles size={13} className="text-emerald-400 shrink-0" />
                                  )}
                                  <p className={`text-[10px] font-bold uppercase tracking-wider ${
                                    discountValue > 0 ? 'text-emerald-400' : 'text-slate-400'
                                  }`}>
                                    {discountSummaryLabel}
                                  </p>
                                </div>
                                <p className={`text-sm sm:text-base font-black tabular-nums font-mono ${
                                  discountValue > 0 ? 'text-emerald-400' : 'text-slate-400'
                                }`}>
                                  {discountValue > 0 ? `-${discountValue.toLocaleString()} HTG` : '0 HTG'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {targetType !== 'student' && selectedCategory && (
                          <div className="bg-indigo-50/80 p-3 rounded-lg space-y-1 border border-indigo-100">
                            <p className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Aperçu d'ajustement global</p>
                            <div className="flex items-center justify-between pt-0.5">
                              <span className="text-indigo-800 font-medium text-xs">Valeur appliquée :</span>
                              <span className="text-indigo-700 font-black text-sm font-mono">
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
                      className="w-full mt-1 py-2.5 sm:py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-xs hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-xs uppercase tracking-wider active:scale-[0.99] cursor-pointer"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin" size={15} /> : <><ShieldCheck size={15} /> Sceller la Réévaluation</>}
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
        <div className="space-y-3.5 animate-in fade-in duration-200">
          {/* KPI Summary Banner - Compact */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg border border-rose-100 shrink-0">
                <TrendingDown size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Réévalué / Remises</p>
                <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
                  -{totalRegisterDiscountHTG.toLocaleString()} <span className="text-xs text-slate-400 font-sans">HTG</span>
                </p>
              </div>
            </div>

            <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100 shrink-0">
                <Users size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Élèves Boursiers & Bénéficiaires</p>
                <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
                  {filteredRegisterStudents.length} <span className="text-xs text-slate-400 font-sans">{terminology.students.toLowerCase()}</span>
                </p>
              </div>
            </div>

            <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-100 shrink-0">
                <Award size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Moyenne Réévaluation / Élève</p>
                <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
                  {filteredRegisterStudents.length > 0 
                    ? Math.round(totalRegisterDiscountHTG / filteredRegisterStudents.length).toLocaleString() 
                    : 0} <span className="text-xs text-slate-400 font-sans">HTG</span>
                </p>
              </div>
            </div>
          </div>

          {/* Table Toolbar / Controls - Harmonisé & Compact */}
          <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-2.5 shadow-2xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 w-full md:w-auto flex-1">
              {/* Search */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Search size={11} className="text-indigo-500" />
                  <span>Recherche Rapide</span>
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="text"
                    placeholder={`Rechercher ${terminology.student.toLowerCase()}, motif...`}
                    className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all min-h-[34px] sm:min-h-[36px]"
                    value={registerSearchTerm}
                    onChange={(e) => setRegisterSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Class Filter - Style Pilule Harmonisé */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <GraduationCap size={11} className="text-indigo-500" />
                  <span>{terminology.class}</span>
                </label>
                <ClassSelectorPill
                  classes={classes}
                  selectedClassId={registerClassFilter}
                  onSelectClass={(classId) => setRegisterClassFilter(classId)}
                  allowAll={true}
                  allLabel={`Toutes les ${terminology.classes.toLowerCase()}`}
                  variant="field"
                  size="sm"
                  colorScheme="indigo"
                  className="w-full"
                />
              </div>

              {/* Campus Filter (ONLY if multi-campus) - Style Pilule Harmonisé */}
              {!user.campus_id && hasMultipleCampuses && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <Building2 size={11} className="text-indigo-500" />
                    <span>Campus / Annexe</span>
                  </label>
                  <SelectPill
                    value={registerCampusFilter}
                    onChange={(val) => setRegisterCampusFilter(val)}
                    options={[
                      { value: 'all', label: 'Tous les Campus / Annexes', badge: campuses.length.toString() },
                      ...campuses.map(c => ({ value: c.id, label: c.name }))
                    ]}
                    icon={Building2}
                    variant="field"
                    size="sm"
                    colorScheme="indigo"
                    className="w-full"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 w-full md:w-auto justify-end flex-wrap">
              <button 
                onClick={fetchRegisterData} 
                className="p-2 text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg transition-all border border-slate-200/60 cursor-pointer min-h-[34px] flex items-center justify-center"
                title="Rafraîchir"
              >
                <RefreshCcw size={14} className={registerLoading ? "animate-spin text-indigo-600" : ""} />
              </button>

              <button 
                onClick={handleExportRegisterExcel}
                disabled={registerLoading || filteredRegisterStudents.length === 0}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer min-h-[34px]"
                title="Exporter le registre au format Excel (.xlsx)"
              >
                <FileSpreadsheet size={13} /> Export Excel
              </button>

              <button 
                onClick={handleExportRegisterCSV}
                disabled={registerLoading || filteredRegisterStudents.length === 0}
                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer min-h-[34px]"
                title="Exporter au format CSV"
              >
                <FileText size={13} /> Grand Livre CSV
              </button>
            </div>
          </div>

          {/* Audit Register Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {registerLoading ? (
              <div className="py-6">
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
                  <tr className="bg-slate-900 text-slate-100 text-[11px] font-bold uppercase tracking-wider border-b border-slate-800">
                    <th scope="col" className="px-4 py-2.5 text-slate-100">{terminology.student}</th>
                    <th scope="col" className="px-4 py-2.5 text-slate-100">{terminology.class}</th>
                    {hasMultipleCampuses && <th scope="col" className="px-4 py-2.5 text-slate-100">Campus / Annexe</th>}
                    <th scope="col" className="px-4 py-2.5 text-slate-100">Motif de l'Acte</th>
                    <th scope="col" className="px-4 py-2.5 text-right text-slate-100">Remise Accordée</th>
                    <th scope="col" className="px-4 py-2.5 text-center text-slate-100">Actions Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {filteredRegisterStudents.map(st => (
                    <tr key={st.id} className="hover:bg-indigo-50/30 transition-colors group">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0">
                            {st.last_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-xs sm:text-sm">
                              {formatStudentName(st.last_name, st.first_name).fullName}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">ID-{st.id.substring(0,8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-bold text-slate-800">{st.class?.name || `${terminology.class} non assignée`}</span>
                      </td>
                      {hasMultipleCampuses && (
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold border border-slate-200">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            {getCampusName(st.campus_id)}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 text-amber-800 rounded-md text-xs font-bold border border-amber-200">
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          {st.discount_label || 'Ajustement Spécial'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="font-mono text-xs sm:text-sm font-black text-rose-600">
                          -{Number(st.discount_amount).toLocaleString()} HTG
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            onClick={() => {
                              setActiveTab('form');
                              setTargetType('student');
                              loadStudentPricing(st);
                            }}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                            title={`Ajuster la réévaluation de cet(te) ${terminology.student.toLowerCase()}`}
                          >
                            <Edit3 size={15} />
                          </button>
                          <button 
                            onClick={() => setResetModalStudent(st)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                            title="Annuler la remise"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {!registerLoading && filteredRegisterStudents.length === 0 && (
                    <tr>
                      <td colSpan={hasMultipleCampuses ? 6 : 5} className="py-12 text-center">
                        <Award size={32} className="mx-auto text-slate-200 mb-2" />
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

      {/* TAB 3: GRAND LIVRE & RAPPORT OFFICIEL DES RÉÉVALUATIONS */}
      {activeTab === 'report' && (
        <div className="space-y-3.5 animate-in fade-in duration-200">
          {/* Statistical KPI Cards - Compact */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg border border-rose-100 shrink-0">
                <TrendingDown size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Volume Total Allégé</p>
                <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
                  -{totalRegisterDiscountHTG.toLocaleString()} <span className="text-xs text-slate-400 font-sans">HTG</span>
                </p>
              </div>
            </div>

            <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100 shrink-0">
                <Users size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{terminology.students} Scellé(e)s & Acté(e)s</p>
                <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
                  {filteredRegisterStudents.length} <span className="text-xs text-slate-400 font-sans">{terminology.students.toLowerCase()}</span>
                </p>
              </div>
            </div>

            <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-100 shrink-0">
                <Award size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Moyenne Déduite / {terminology.student}</p>
                <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
                  {filteredRegisterStudents.length > 0 
                    ? Math.round(totalRegisterDiscountHTG / filteredRegisterStudents.length).toLocaleString() 
                    : 0} <span className="text-xs text-slate-400 font-sans">HTG</span>
                </p>
              </div>
            </div>
          </div>

          {/* Report Toolbar & Filters - Harmonisé & Compact */}
          <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-2.5 shadow-2xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 w-full md:w-auto flex-1">
              {/* Search */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Search size={11} className="text-indigo-500" />
                  <span>Recherche & Filtre</span>
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="text"
                    placeholder={`Filtrer par ${terminology.student.toLowerCase()}, matricule...`}
                    className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all min-h-[34px] sm:min-h-[36px]"
                    value={registerSearchTerm}
                    onChange={(e) => setRegisterSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Class Filter - Style Pilule Harmonisé */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <GraduationCap size={11} className="text-indigo-500" />
                  <span>{terminology.class}</span>
                </label>
                <ClassSelectorPill
                  classes={classes}
                  selectedClassId={registerClassFilter}
                  onSelectClass={(classId) => setRegisterClassFilter(classId)}
                  allowAll={true}
                  allLabel={`Toutes les ${terminology.classes.toLowerCase()}`}
                  variant="field"
                  size="sm"
                  colorScheme="indigo"
                  className="w-full"
                />
              </div>

              {/* Campus Filter (ONLY if multi-campus) - Style Pilule Harmonisé */}
              {!user.campus_id && hasMultipleCampuses ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <Building2 size={11} className="text-indigo-500" />
                    <span>Campus / Annexe</span>
                  </label>
                  <SelectPill
                    value={registerCampusFilter}
                    onChange={(val) => setRegisterCampusFilter(val)}
                    options={[
                      { value: 'all', label: 'Tous les Campus / Annexes', badge: campuses.length.toString() },
                      ...campuses.map(c => ({ value: c.id, label: c.name }))
                    ]}
                    icon={Building2}
                    variant="field"
                    size="sm"
                    colorScheme="indigo"
                    className="w-full"
                  />
                </div>
              ) : <div className="hidden md:block" />}
            </div>

            <div className="flex items-center gap-1.5 w-full md:w-auto justify-end flex-wrap">
              <button 
                onClick={fetchRegisterData} 
                className="p-2 text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg transition-all border border-slate-200/60 cursor-pointer min-h-[34px] flex items-center justify-center"
                title="Rafraîchir"
              >
                <RefreshCcw size={14} className={registerLoading ? "animate-spin text-indigo-600" : ""} />
              </button>

              <button 
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer min-h-[34px]"
                title="Imprimer l'état officiel"
              >
                <Printer size={13} /> Imprimer
              </button>

              <button 
                onClick={handleExportRegisterExcel}
                disabled={registerLoading || filteredRegisterStudents.length === 0}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer min-h-[34px]"
                title="Exporter au format Excel (.xlsx)"
              >
                <FileSpreadsheet size={13} /> Export Excel
              </button>

              <button 
                onClick={handleExportRegisterCSV}
                disabled={registerLoading || filteredRegisterStudents.length === 0}
                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer min-h-[34px]"
                title="Exporter au format Grand Livre CSV"
              >
                <FileText size={13} /> Grand Livre CSV
              </button>
            </div>
          </div>

          {/* Grand Livre Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden print:border-none print:shadow-none">
            <div className="p-3 sm:p-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/60">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <FileSpreadsheet size={16} className="text-indigo-600" />
                  Grand Livre Analytique & État Scellé des Dérogations
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Extrait certifié conforme pour l'audit comptable et le contrôle de gestion • Session {activeYear?.label || 'Active'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                  {filteredRegisterStudents.length} acte{filteredRegisterStudents.length > 1 ? 's' : ''} scellé{filteredRegisterStudents.length > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-slate-100 text-[11px] font-bold uppercase tracking-wider border-b border-slate-800">
                    <th scope="col" className="px-4 py-2.5 text-slate-100">N°</th>
                    <th scope="col" className="px-4 py-2.5 text-slate-100">{terminology.student}</th>
                    <th scope="col" className="px-4 py-2.5 text-slate-100">{terminology.class}</th>
                    {hasMultipleCampuses && <th scope="col" className="px-4 py-2.5 text-slate-100">Campus / Annexe</th>}
                    <th scope="col" className="px-4 py-2.5 text-slate-100">Motif & Catégorie</th>
                    <th scope="col" className="px-4 py-2.5 text-right text-slate-100">Montant Alloué</th>
                    <th scope="col" className="px-4 py-2.5 text-center text-slate-100">Certificat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {filteredRegisterStudents.map((st, idx) => (
                    <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 font-mono font-bold text-slate-400 text-xs">{idx + 1}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0">
                            {st.last_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-xs sm:text-sm">
                              {formatStudentName(st.last_name, st.first_name).fullName}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">ID-{st.id.substring(0,8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-bold text-slate-800">{st.class?.name || `${terminology.class} non assignée`}</span>
                      </td>
                      {hasMultipleCampuses && (
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold border border-slate-200">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            {getCampusName(st.campus_id)}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-xs font-bold border border-indigo-100">
                          <Award className="w-3 h-3 text-indigo-600" />
                          {st.discount_label || 'Ajustement Spécial'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="font-mono text-xs sm:text-sm font-black text-rose-600">
                          -{Number(st.discount_amount).toLocaleString()} HTG
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <Check size={11} className="text-emerald-600" /> Scellé
                        </span>
                      </td>
                    </tr>
                  ))}

                  {filteredRegisterStudents.length === 0 && (
                    <tr>
                      <td colSpan={hasMultipleCampuses ? 7 : 6} className="py-12 text-center text-slate-400">
                        <Award size={32} className="mx-auto text-slate-200 mb-2" />
                        <p className="font-bold text-xs">Aucune entrée trouvée pour les filtres sélectionnés</p>
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredRegisterStudents.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 font-black text-slate-900 border-t-2 border-slate-200">
                      <td colSpan={hasMultipleCampuses ? 5 : 4} className="px-4 py-2.5 text-right uppercase text-xs">
                        Total Général Allégé :
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-sm sm:text-base text-rose-600">
                        -{totalRegisterDiscountHTG.toLocaleString()} HTG
                      </td>
                      <td className="px-4 py-2.5 text-center text-[10px] text-slate-500 font-mono">
                        {filteredRegisterStudents.length} dossiers
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
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
