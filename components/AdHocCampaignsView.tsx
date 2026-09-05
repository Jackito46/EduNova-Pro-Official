import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Settings2, Save, Trash2, Edit3, CalendarDays, Rocket, 
  Users, CheckCircle, CheckCircle2, CircleDashed, Users2, Info, Loader2, ArrowLeft, Search, RefreshCw, X,
  Printer, FileText, ShieldCheck, Filter,
  Banknote, Landmark, Smartphone, Receipt, CreditCard, Wallet, DollarSign, Calculator, ArrowRight, Sparkles, Building2, Hash, Calendar, Percent, Check, AlertCircle, Phone
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import { UserProfile, SchoolClass, UserRole } from '../types';
import { useSchool } from '../contexts/SchoolContext';
import { AuditLogger } from '../utils/auditLogger';
import { FluidLoadingState, SkeletonCard, SkeletonTable } from './SkeletonLoader';
import { getActiveSchoolPaymentMethods, getPaymentMethodConfig } from '../lib/paymentMethods';
import { AcademicSessionPill } from './AcademicSessionPill';
import { SelectPill } from './SelectPill';
import { DatePickerPill } from './DatePickerPill';

interface AcademicYear {
  id: string;
  label: string;
  is_active: boolean;
  status?: string;
}

interface Campaign {
  id: string;
  name: string;
  description: string;
  amount: number;
  currency: string;
  due_date: string | null;
  academic_year_id: string;
  type: string;
  duration_days: number | null;
  start_date: string | null;
  end_date: string | null;
  campus_id: string | null;
  class_id: string | null;
  school_campuses?: { name: string };
  classes?: { name: string };
  assigned_count?: number;
  status?: 'DRAFT' | 'PROGRESS' | 'COMPLETED';
}

const CAMPAIGN_TYPES_MAP: Record<string, string> = {
  STAGE: '📐 Activité Spéciale / Stage',
  VISITE: '🚌 Visite / Excursion / Sortie',
  SPORTS_CULTURE: '⚽ Activités Sportives & Culturelles',
  SOUTIEN_SCOL: '🧠 Soutien Scolaire / Coaching / Tutorat',
  CEREMONIE: '🎓 Cérémonie / Remise de Diplômes',
  EXAMEN: '📝 Examens de Reprise / Sessions',
  INSCRIPTION_CONCOURS: '🎫 Concours d\'Entrée & Dossiers',
  TRANSPORT: '🚍 Service de Transport / Navette',
  BIBLIOTHEQUE: '📚 Bibliothèque / Accès Médias',
  LABORATOIRE: '🧪 Travaux Pratiques / Sciences',
  UNIFORME: '👕 Uniforme & Écussons',
  ASSURANCE: '🛡️ Assurance Scolaire Obligatoire',
  TECH_SALL_INFO: '💻 Salle Info / Internet / Plateformes',
  PROJET_MEMOIRE: '📖 Projet de Fin d\'Études / Mémoire',
  SEMINAIRE_COLLOQUE: '🎤 Séminaire, Colloque & Conférence',
  SOUTENANCE: '🏛️ Frais de Soutenance',
  HEBERGEMENT: '🏠 Logement / Internat / Résidence',
  CANTINE: '🍽️ Cantine / Restauration Scolaire',
  SANTE: '🩺 Services de Santé / Médical',
  RETARD_SCOLARITE: '⚠️ Pénalité de Retard de Paiement',
  AUTRE: '📋 Autre Frais'
};

const TYPES_WITH_DATES = [
  'STAGE',
  'VISITE',
  'SPORTS_CULTURE',
  'SOUTIEN_SCOL',
  'SEMINAIRE_COLLOQUE',
  'PROJET_MEMOIRE'
];

const getCampaignTypeLabel = (type: string) => {
  return CAMPAIGN_TYPES_MAP[type] || type || '📋 Autre Frais';
};

const AdHocCampaignsView: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { school, terminology, currentCampusId } = useSchool();
  const isPrivilegedUser = user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.DIRECTOR;
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  
  const [showForm, setShowForm] = useState(false);
  const [campuses, setCampuses] = useState<any[]>([]);
  const [schoolClasses, setSchoolClasses] = useState<any[]>([]);
  const [classIdsWithStudents, setClassIdsWithStudents] = useState<Set<string>>(new Set());
  const [campaignToDelete, setCampaignToDelete] = useState<{ id: string; name: string } | null>(null);
  const [linkedPaymentsCount, setLinkedPaymentsCount] = useState<number>(0);
  const [hasLinkedPayments, setHasLinkedPayments] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [managingCampaign, setManagingCampaign] = useState<Campaign | null>(null);
  const [formData, setFormData] = useState({
    id: '', 
    name: '',
    description: '',
    amount: '',
    currency: 'HTG',
    due_date: '',
    type: 'AUTRE',
    duration_days: '',
    start_date: '',
    end_date: '',
    campus_id: user.campus_id || currentCampusId || '',
    class_id: '',
         status: 'DRAFT'
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'PROGRESS' | 'COMPLETED'>('ALL');
  const [campusFilter, setCampusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  const isUniv = school?.school_type === 'UNIVERSITY' || school?.school_type === 'PROFESSIONAL';

  useEffect(() => {
    if (showForm) {
      if (!formData.id) {
        setFormData(prev => ({ ...prev, type: isUniv ? 'STAGE' : 'VISITE' }));
      }
    }
  }, [showForm, formData.id, isUniv]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const activeCampusId = user.campus_id || currentCampusId;

      const { data: ayData } = await supabase
        .from('academic_years')
        .select('*')
        .eq('school_id', user.school_id)
        .order('label', { ascending: false });

      if (ayData && ayData.length > 0) {
        setAcademicYears(ayData);
        setSelectedYearId(ayData.find(y => y.is_active)?.id || ayData[0].id);
      }
      
      let campusQuery = supabase
        .from('school_campuses')
        .select('*')
        .eq('school_id', user.school_id);
      if (activeCampusId) {
        campusQuery = campusQuery.eq('id', activeCampusId);
      }
      const { data: campusData } = await campusQuery.order('name');
        
      if (campusData) {
        setCampuses(campusData);
      }
      
      let classesQuery = supabase
        .from('classes')
        .select('*')
        .eq('school_id', user.school_id);
      if (activeCampusId) {
        classesQuery = classesQuery.eq('campus_id', activeCampusId);
      }
      const { data: classesData } = await classesQuery.order('name');
        
      if (classesData) {
        setSchoolClasses(classesData);
      }

      let studentsQuery = supabase
        .from('students')
        .select('class_id')
        .eq('school_id', user.school_id);
      if (activeCampusId) {
        studentsQuery = studentsQuery.eq('campus_id', activeCampusId);
      }
      const { data: studentsData } = await studentsQuery;

      const withStudents = new Set<string>();
      if (studentsData) {
        studentsData.forEach((s: any) => {
          if (s.class_id) {
            withStudents.add(s.class_id);
          }
        });
      }
      setClassIdsWithStudents(withStudents);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user.school_id, user.campus_id, currentCampusId]);

  const fetchCampaigns = useCallback(async () => {
    if (!selectedYearId) return;
    try {
      let query = supabase
        .from('ad_hoc_campaigns')
        .select(`
          *,
          student_ad_hoc_fees(count),
          school_campuses(name),
          classes(name)
        `)
        .eq('academic_year_id', selectedYearId)
        .eq('school_id', user.school_id);

      const activeCampusId = user.campus_id || currentCampusId;
      if (activeCampusId) {
        query = query.or(`campus_id.is.null,campus_id.eq.${activeCampusId}`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (data) {
        setCampaigns(data.map(d => ({ ...d, assigned_count: d.student_ad_hoc_fees[0]?.count || 0 })));
      }
    } catch (err) { }
  }, [selectedYearId, user.school_id, user.campus_id, currentCampusId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (selectedYearId) fetchCampaigns(); }, [selectedYearId, fetchCampaigns]);

  // Real-time synchronization for campaigns list
  useEffect(() => {
    if (!user?.school_id || !selectedYearId) return;

    const channelName = `admin_campaigns_list_${selectedYearId}`;
    const campaignsSub = supabase.channel(channelName)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'ad_hoc_campaigns', 
        filter: `school_id=eq.${user.school_id}` 
      }, () => {
        fetchCampaigns();
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'student_ad_hoc_fees' 
      }, () => {
        fetchCampaigns();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(campaignsSub);
    };
  }, [user?.school_id, selectedYearId, fetchCampaigns]);

  // Calcul automatique de la durée en jours de l'événement selon les dates choisies
  useEffect(() => {
    if (formData.start_date && formData.end_date && TYPES_WITH_DATES.includes(formData.type)) {
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
        const calculated = diffDays > 0 ? diffDays.toString() : '0';
        if (formData.duration_days !== calculated) {
          setFormData(prev => ({ ...prev, duration_days: calculated }));
        }
      }
    }
  }, [formData.start_date, formData.end_date, formData.type, formData.duration_days]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedYear = academicYears.find(y => y.id === selectedYearId);
    if (selectedYear?.status === 'PAST') {
      toast.error("Impossible d'enregistrer : Cette année académique est archivée et verrouillée.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        school_id: user.school_id,
        academic_year_id: selectedYearId,
        name: formData.name,
        description: formData.description,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        due_date: formData.due_date || null,
        type: formData.type || 'AUTRE',
        duration_days: formData.duration_days ? parseInt(formData.duration_days) : null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        campus_id: user.campus_id || formData.campus_id || currentCampusId || null,
        class_id: formData.class_id || null
      };

      if (formData.id) {
        payload.status = formData.status || 'DRAFT';
        await supabase.from('ad_hoc_campaigns').update(payload).eq('id', formData.id);
      } else {
        payload.status = 'DRAFT';
        await supabase.from('ad_hoc_campaigns').insert([payload]);
      }
      
      toast.success("Campagne enregistrée !");
      setShowForm(false);
      fetchCampaigns();
    } catch (err) {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const selectedYear = academicYears.find(y => y.id === selectedYearId);
    if (selectedYear?.status === 'PAST') {
      toast.error("Impossible de supprimer : l'année académique de cette campagne est archivée.");
      return;
    }

    const campaign = campaigns.find(c => c.id === id);
    if (!isPrivilegedUser && campaign && (campaign.status === 'PROGRESS' || campaign.status === 'COMPLETED')) {
      toast.error("Suppression impossible : Les campagnes en cours ou terminées ne peuvent pas être supprimées.");
      return;
    }

    try {
      const { count, error } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('ad_hoc_campaign_id', id);

      if (error) throw error;
      setLinkedPaymentsCount(count || 0);
      setHasLinkedPayments((count || 0) > 0);
    } catch (err: any) {
      console.error("Error checking linked payments:", err);
      setLinkedPaymentsCount(0);
      setHasLinkedPayments(false);
    }

    setCampaignToDelete({ id, name });
  };

  const confirmDeleteCampaign = async (mode: 'direct' | 'detach' | 'cascade' | 'refund' = 'direct') => {
    if (!campaignToDelete) return;
    const campaign = campaigns.find(c => c.id === campaignToDelete.id);
    if (!isPrivilegedUser && campaign && (campaign.status === 'PROGRESS' || campaign.status === 'COMPLETED')) {
      toast.error("Suppression impossible : Les campagnes en cours ou terminées ne peuvent pas être supprimées.");
      return;
    }
    setIsDeleting(true);
    try {
      // Fetch active payments before we alter or delete them
      const { data: activePayments, error: fetchPaymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('ad_hoc_campaign_id', campaignToDelete.id)
        .neq('status', 'ANNULE');

      if (fetchPaymentsError) {
        toast.error("Erreur de récupération des paiements liés: " + fetchPaymentsError.message);
        setIsDeleting(false);
        return;
      }

      if (mode === 'detach' || mode === 'refund') {
        if (activePayments && activePayments.length > 0) {
          // Group refund amounts by student and currency
          const refundMap = new Map<string, { htg: number; usd: number }>();
          for (const p of activePayments) {
            const sId = p.student_id;
            const amt = Number(p.amount || 0);
            const isUsd = p.currency === 'USD';
            
            if (!refundMap.has(sId)) {
              refundMap.set(sId, { htg: 0, usd: 0 });
            }
            const curObj = refundMap.get(sId)!;
            if (isUsd) {
              curObj.usd += amt;
            } else {
              curObj.htg += amt;
            }
          }

          // Apply refund to each student's wallet balance
          for (const [studentId, refundAmounts] of refundMap.entries()) {
            const { data: sData, error: sError } = await supabase
              .from('students')
              .select('wallet_balance_htg, wallet_balance_usd')
              .eq('id', studentId)
              .single();

            if (sError) {
              console.error(`Erreur chargement portefeuille pour ${studentId}:`, sError);
              continue;
            }

            const currentHtg = Number(sData?.wallet_balance_htg || 0);
            const currentUsd = Number(sData?.wallet_balance_usd || 0);

            const newHtg = currentHtg + refundAmounts.htg;
            const newUsd = currentUsd + refundAmounts.usd;

            const { error: walletUpdateErr } = await supabase
              .from('students')
              .update({
                wallet_balance_htg: newHtg,
                wallet_balance_usd: newUsd
              })
              .eq('id', studentId);

            if (walletUpdateErr) {
              console.error(`Erreur mise à jour portefeuille pour ${studentId}:`, walletUpdateErr);
              throw new Error(`Impossible de mettre à jour le portefeuille de l'étudiant (${studentId}). Opération de suppression annulée pour des raisons de sécurité.`);
            }
          }
        }
      }

      if (mode === 'detach') {
        const { error: updateError } = await supabase
          .from('payments')
          .update({ 
            ad_hoc_campaign_id: null,
            status: 'ANNULE',
            payment_method: 'CRÉDIT_PORTEFEUILLE',
            cancel_reason: `Conversion de la campagne '${campaignToDelete.name}' en crédit Portefeuille`
          })
          .eq('ad_hoc_campaign_id', campaignToDelete.id);
        
        if (updateError) {
          toast.error("Erreur lors de la conversion en crédit portefeuille: " + updateError.message);
          setIsDeleting(false);
          return;
        }
      } else if (mode === 'cascade') {
        const { error: deletePaymentsError } = await supabase
          .from('payments')
          .delete()
          .eq('ad_hoc_campaign_id', campaignToDelete.id);
        
        if (deletePaymentsError) {
          toast.error("Erreur lors de la suppression en cascade: " + deletePaymentsError.message);
          setIsDeleting(false);
          return;
        }
      } else if (mode === 'refund') {
        const { error: refundPaymentsError } = await supabase
          .from('payments')
          .update({ 
            status: 'ANNULE', 
            payment_method: 'REMBOUSE_CAMPAGNE',
            cancel_reason: `Remboursement de la campagne '${campaignToDelete.name}' vers Portefeuille`
          })
          .eq('ad_hoc_campaign_id', campaignToDelete.id);
        
        if (refundPaymentsError) {
          toast.error("Erreur lors du remboursement des paiements: " + refundPaymentsError.message);
          setIsDeleting(false);
          return;
        }
      }

      // Explicitly delete student ad hoc fees first to avoid foreign key violations
      await supabase.from('student_ad_hoc_fees').delete().eq('campaign_id', campaignToDelete.id);

      const { error } = await supabase.from('ad_hoc_campaigns').delete().eq('id', campaignToDelete.id);
      if (error) {
        if (error.message && error.message.includes('payments_ad_hoc_campaign_id_fkey')) {
          toast.error("Impossible de supprimer directement : des paiements sont liés à cette campagne. Veuillez choisir l'option de détachement ou cascade.");
        } else {
          toast.error("Erreur de suppression: " + error.message);
        }
      } else {
        toast.success("Campagne supprimée et portefeuille mis à jour !");
        
        // Log this privileged forced action
        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: 'DELETE' as any,
          entity_type: 'settings' as any,
          entity_id: campaignToDelete.id,
          details: { action_type: 'FORCE_DELETE_CAMPAIGN', name: campaignToDelete.name, mode }
        }).catch(console.error);

        fetchCampaigns();
      }
    } catch (err: any) {
      toast.error("Erreur de suppression: " + err.message);
    } finally {
      setCampaignToDelete(null);
      setHasLinkedPayments(false);
      setLinkedPaymentsCount(0);
      setIsDeleting(false);
    }
  };

  const selectedYear = academicYears.find(y => y.id === selectedYearId);
  const isYearArchived = selectedYear?.status === 'PAST';

  // Calculations for KPI Header
  const totalCampaignsCount = campaigns.length;
  const inProgressCampaignsCount = campaigns.filter(c => c.status === 'PROGRESS').length;
  const completedCampaignsCount = campaigns.filter(c => c.status === 'COMPLETED').length;
  const totalParticipantsAssigned = campaigns.reduce((acc, c) => acc + (c.assigned_count || 0), 0);

  // Check if school actually has multi-campus enabled with more than 1 campus
  const hasMultiCampus = Boolean(school?.has_multi_campus && campuses && campuses.length > 1);

  // Filter campaigns
  const filteredCampaigns = campaigns.filter(c => {
    if (statusFilter !== 'ALL' && (c.status || 'DRAFT') !== statusFilter) return false;
    if (campusFilter !== '' && c.campus_id !== campusFilter && !(campusFilter === 'GLOBAL' && !c.campus_id)) return false;
    if (typeFilter !== '' && c.type !== typeFilter) return false;
    
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchesName = (c.name || '').toLowerCase().includes(q);
      const matchesDesc = (c.description || '').toLowerCase().includes(q);
      const matchesType = getCampaignTypeLabel(c.type).toLowerCase().includes(q);
      const matchesCampus = (c.school_campuses?.name || '').toLowerCase().includes(q);
      const matchesClass = (c.classes?.name || '').toLowerCase().includes(q);
      return matchesName || matchesDesc || matchesType || matchesCampus || matchesClass;
    }
    return true;
  });

  if (managingCampaign) {
    return <AssignCampaignView user={user} campaign={managingCampaign} onBack={() => { setManagingCampaign(null); fetchCampaigns(); }} school={school} isYearArchived={isYearArchived} />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 relative">
        <div className="md:ml-20">
          <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-xs uppercase tracking-widest mb-1">
            <Rocket size={16} /> Campagnes & Événements Scolaies
          </div>
          <h2 className="text-2xl font-black text-gray-900 leading-tight">Frais Occasionnels & Activités</h2>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Excursions, Stages, Cérémonies, Uniformes, Examens et activités à facturation ponctuelle.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <AcademicSessionPill
            academicYears={academicYears}
            selectedYearId={selectedYearId}
            onSelectYear={(yearId) => setSelectedYearId(yearId)}
            size="md"
            colorScheme="indigo"
          />
          <button 
            disabled={isYearArchived}
            onClick={() => { setFormData({ id: '', name: '', description: '', amount: '', currency: 'HTG', due_date: '', type: 'AUTRE', duration_days: '', start_date: '', end_date: '', campus_id: user.campus_id || currentCampusId || '', class_id: '', status: 'DRAFT' }); setShowForm(true); }} 
            className="flex justify-center items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-extrabold text-xs rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 disabled:opacity-40 disabled:hover:bg-indigo-600 active:scale-95 cursor-pointer"
            title={isYearArchived ? "Cette année académique est archivée" : "Créer une nouvelle campagne"}
          >
            <Plus size={18} /> Nouvelle Campagne
          </button>
        </div>
      </header>

      {/* KPI METRICS BANNER */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Rocket size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Campagnes</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{totalCampaignsCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <RefreshCw size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">En Cours / Actives</p>
            <p className="text-xl font-black text-blue-700 mt-0.5">{inProgressCampaignsCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Users size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Inscrits</p>
            <p className="text-xl font-black text-emerald-700 mt-0.5">{totalParticipantsAssigned}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <CheckCircle size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Terminées</p>
            <p className="text-xl font-black text-purple-700 mt-0.5">{completedCampaignsCount}</p>
          </div>
        </div>
      </div>

      {(selectedYear?.status === 'PREPARATION' || selectedYear?.status === 'FUTURE') && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-start gap-4 animate-in fade-in duration-300">
          <div className="p-2.5 bg-emerald-100/50 border border-emerald-200 text-emerald-700 rounded-xl shrink-0">
            <Rocket size={20} className="animate-pulse" />
          </div>
          <div className="space-y-1">
            <h4 className="font-extrabold text-emerald-900 text-sm">Session Future ou en Préparation ({selectedYear?.label})</h4>
            <p className="text-xs text-emerald-700 font-medium leading-relaxed">
              Planification anticipée active : Vous pouvez créer, configurer et préparer les campagnes de frais occasionnels à l'avance pour cette session. Elles seront prêtes à être lancées dès l'activation officielle de cette année académique.
            </p>
          </div>
        </div>
      )}

      {isYearArchived && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4 animate-in fade-in duration-300">
          <div className="p-2.5 bg-amber-100/50 border border-amber-200 text-amber-700 rounded-xl shrink-0">
            <Info size={20} />
          </div>
          <div className="space-y-1">
            <h4 className="font-extrabold text-amber-900 text-sm">Année Académique Archivée ({selectedYear?.label})</h4>
            <p className="text-xs text-amber-700 font-medium leading-relaxed">
              Cette session est archivée. Il n'est pas possible de créer de nouvelles campagnes, d'en modifier d'existantes, ou d'effectuer des suppressions de campagnes dans cette période de référence historique.
            </p>
          </div>
        </div>
      )}

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une campagne par nom, type, description, annexe..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Campus Filter - Only if school has multiple campuses */}
          {hasMultiCampus && (
            <SelectPill
              options={[
                { value: '', label: '🏢 Toutes les Annexes / Campus' },
                { value: 'GLOBAL', label: '🌐 Portée Globale (Siège)' },
                ...campuses.map(camp => ({
                  value: camp.id,
                  label: `📍 ${camp.name}`
                }))
              ]}
              value={campusFilter}
              onChange={(val) => setCampusFilter(val)}
              icon={Filter}
              variant="field"
              size="sm"
              colorScheme="slate"
            />
          )}

          {/* Type Filter */}
          <SelectPill
            options={[
              { value: '', label: "🏷️ Tous les Types d'Activités" },
              { value: 'EXCURSION', label: 'Excursion / Visite' },
              { value: 'CEREMONIE', label: 'Cérémonie / Graduation' },
              { value: 'UNIFORME', label: 'Uniforme / Kit' },
              { value: 'STAGE', label: 'Stage / Pratique' },
              { value: 'EXAMEN', label: 'Examen / Reprise' },
              { value: 'CANTINE', label: 'Cantine / Restauration' },
              { value: 'TRANSPORT', label: 'Transport Scolaire' },
              { value: 'AUTRE', label: 'Autre Frais Occasionnel' }
            ]}
            value={typeFilter}
            onChange={(val) => setTypeFilter(val)}
            variant="field"
            size="sm"
            colorScheme="slate"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 border-t border-slate-100 pt-3 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            Toutes ({campaigns.length})
          </button>
          <button
            onClick={() => setStatusFilter('PROGRESS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
              statusFilter === 'PROGRESS'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-blue-600 hover:bg-blue-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            En Cours ({campaigns.filter(c => c.status === 'PROGRESS').length})
          </button>
          <button
            onClick={() => setStatusFilter('DRAFT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
              statusFilter === 'DRAFT'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Brouillons ({campaigns.filter(c => (c.status || 'DRAFT') === 'DRAFT').length})
          </button>
          <button
            onClick={() => setStatusFilter('COMPLETED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
              statusFilter === 'COMPLETED'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            Terminées ({campaigns.filter(c => c.status === 'COMPLETED').length})
          </button>
        </div>
      </div>

      {/* CAMPAIGNS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-8 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <FluidLoadingState 
              message="Chargement des campagnes & événements ad hoc..." 
              subtext="Récupération sécurisée des appels de cotisations, sorties et activités occasionnelles..." 
            />
            <SkeletonCard count={3} />
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-dashed border-slate-200 shadow-sm p-8">
            <Rocket size={36} className="text-slate-300 mx-auto mb-3" />
            <h4 className="font-black text-slate-800 text-base">Aucune campagne trouvée</h4>
            <p className="text-slate-400 text-xs mt-1 max-w-md mx-auto font-medium">
              Aucun frais occasionnel ne correspond aux filtres sélectionnés. Essayez de modifier la recherche ou créez une nouvelle campagne.
            </p>
          </div>
        ) : filteredCampaigns.map(c => (
          <div key={c.id} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
            {/* Gradient accent top border */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <div>
              <div className="flex justify-between items-start gap-2 mb-3.5">
                <div className="flex gap-1.5 items-center flex-wrap">
                  {/* Type Badge */}
                  <span className="inline-flex items-center px-2.5 py-1 bg-indigo-50/90 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-lg border border-indigo-100/60 shadow-2xs">
                    {getCampaignTypeLabel(c.type)}
                  </span>

                  {/* Status Badge */}
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg shadow-2xs ${
                    c.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60' :
                    c.status === 'PROGRESS' ? 'bg-blue-50 text-blue-800 border border-blue-200/60' :
                    'bg-slate-100 text-slate-700 border border-slate-200/60'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      c.status === 'COMPLETED' ? 'bg-emerald-500' :
                      c.status === 'PROGRESS' ? 'bg-blue-500 animate-pulse' :
                      'bg-slate-400'
                    }`} />
                    {c.status === 'COMPLETED' ? 'Terminé' :
                     c.status === 'PROGRESS' ? 'En Cours' :
                     'Brouillon'}
                  </span>

                  {/* Campus Badge - ONLY if multi-campus school */}
                  {hasMultiCampus && (
                    c.school_campuses ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 text-[10px] font-black uppercase tracking-wider rounded-lg border border-emerald-100/60" title="Campus / Annexe dédiée">
                        📍 {c.school_campuses.name}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-lg border border-slate-200/60" title="Portée globale siège">
                        🌐 Portée Siège
                      </span>
                    )
                  )}

                  {/* Class Badge */}
                  {c.classes && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-800 text-[10px] font-black uppercase tracking-wider rounded-lg border border-amber-200/60">
                      🎓 {c.classes.name}
                    </span>
                  )}
                </div>
                
                {/* Actions */}
                <div className="flex gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/50 shrink-0 opacity-90 group-hover:opacity-100 transition-opacity">
                  <button 
                    disabled={c.status === 'COMPLETED' || isYearArchived}
                    onClick={() => { setFormData({ id: c.id, name: c.name, description: c.description || '', currency: c.currency, amount: c.amount.toString(), due_date: c.due_date || '', type: c.type || 'AUTRE', duration_days: (c.duration_days||'').toString(), start_date: c.start_date || '', end_date: c.end_date || '', campus_id: c.campus_id || '', class_id: c.class_id || '', status: c.status || 'DRAFT' }); setShowForm(true); }} 
                    className="p-1.5 text-indigo-600 hover:bg-white hover:shadow-2xs rounded-lg transition-all disabled:opacity-40 cursor-pointer"
                    title={isYearArchived ? "Cette année académique est archivée" : c.status === 'COMPLETED' ? "Désactiver pour modifier (Remettre en Brouillon d'abord)" : "Modifier la campagne"}
                  >
                    <Edit3 size={14} />
                  </button>
                  <button 
                    disabled={(!isPrivilegedUser && (c.status === 'PROGRESS' || c.status === 'COMPLETED')) || isYearArchived}
                    onClick={() => handleDelete(c.id, c.name)} 
                    className="p-1.5 text-rose-600 hover:bg-white hover:shadow-2xs rounded-lg transition-all disabled:opacity-40 cursor-pointer"
                    title={
                      isYearArchived ? "Cette année académique est archivée" : 
                      (!isPrivilegedUser && (c.status === 'PROGRESS' || c.status === 'COMPLETED')) ? "Suppression réservée aux administrateurs" : 
                      "Supprimer la campagne"
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Title */}
              <h3 className="font-black text-lg text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug mb-2">
                {c.name}
              </h3>

              {/* Description */}
              <p className="text-xs text-slate-500 mb-4 line-clamp-2 min-h-[36px] font-medium leading-relaxed">
                {c.description || "Aucune description renseignée pour cette campagne."}
              </p>
              
              {/* Period Pill */}
              {c.duration_days && (
                <div className="mb-4 text-[11px] font-bold text-slate-700 flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100/80 w-max">
                  <CalendarDays size={14} className="text-indigo-500 shrink-0" /> 
                  <span>{c.duration_days} jours d'activité</span>
                  {c.start_date && c.end_date && (
                    <span className="text-slate-400 font-medium ml-0.5">
                      ({new Date(c.start_date).toLocaleDateString('fr-FR')} - {new Date(c.end_date).toLocaleDateString('fr-FR')})
                    </span>
                  )}
                </div>
              )}
              
              {/* Financial Box */}
              <div className="flex items-center justify-between mb-4 bg-gradient-to-br from-slate-50 to-indigo-50/30 p-4 rounded-2xl border border-slate-100">
                <div>
                  <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black mb-0.5">Frais Exigé</p>
                  <p className="font-black text-2xl text-slate-900 font-mono tracking-tight">
                    {c.amount.toLocaleString('fr-FR')} <span className="text-xs font-black text-indigo-600">{c.currency}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black mb-0.5">Échéance</p>
                  <p className="font-extrabold text-xs text-slate-700">
                    {c.due_date ? new Date(c.due_date).toLocaleDateString('fr-FR') : 'Indéfinie'}
                  </p>
                </div>
              </div>
            </div>

            {/* Manage CTA */}
            <button 
              onClick={() => setManagingCampaign(c)} 
              className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs tracking-wide rounded-xl transition-all shadow-md shadow-indigo-100/80 hover:shadow-indigo-200 flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
            >
              <Users size={16} /> Gérer Participants ({c.assigned_count || 0}) & Caisse
            </button>
          </div>
        ))}
      </div>


      {/* Modal Formulaire Créer / Modifier une Campagne */}
      {showForm && (
        <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
          <div className="bg-white max-w-2xl md:max-w-4xl lg:max-w-5xl w-full rounded-2xl md:rounded-3xl shadow-2xl animate-in duration-200 zoom-in-95 border border-slate-100 overflow-hidden my-auto max-h-[94vh] flex flex-col">
            
            {/* Modal Modern Compact Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 sm:px-6 py-3 sm:py-3.5 border-b border-slate-100 bg-slate-50/90 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 sm:p-2.5 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-xl shadow-xs shrink-0">
                  <Rocket size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight">
                      {formData.id ? 'Modifier la Campagne' : 'Créer une Nouvelle Campagne'}
                    </h3>
                    <span className="hidden sm:inline-block text-[9px] font-black px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wider">
                      Frais Occasionnel
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Paramétrage de tarification, échéancier et ciblage d'étudiants
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                {/* Status Switcher in Form Header */}
                <div className="flex bg-slate-200/80 p-0.5 rounded-xl gap-0.5">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, status: 'DRAFT' })}
                    className={`px-2 py-1 text-[9.5px] font-black rounded-lg transition-all ${
                      (formData.status || 'DRAFT') === 'DRAFT'
                        ? 'bg-white text-slate-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Brouillon
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, status: 'PROGRESS' })}
                    className={`px-2 py-1 text-[9.5px] font-black rounded-lg transition-all ${
                      formData.status === 'PROGRESS'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    • En Cours
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, status: 'COMPLETED' })}
                    className={`px-2 py-1 text-[9.5px] font-black rounded-lg transition-all ${
                      formData.status === 'COMPLETED'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ✓ Terminé
                  </button>
                </div>

                <button 
                  type="button" 
                  onClick={() => setShowForm(false)} 
                  className="p-1.5 hover:bg-slate-200/70 rounded-xl text-slate-400 hover:text-slate-700 transition-all cursor-pointer active:scale-95"
                  title="Fermer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Form Body with Compact Spacing */}
            <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 p-3.5 sm:p-5 md:p-6 overflow-y-auto flex-1 bg-slate-50/40">
                
                {/* Profile & Multi-Tenant Context Banner (Streamlined) */}
                <div className="md:col-span-12 bg-white/90 px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg shrink-0">
                      <ShieldCheck size={16} />
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Contexte Établissement</span>
                      <p className="text-[11px] font-bold text-slate-800 leading-tight">
                        Calibrage : <span className="text-indigo-600 font-black">{isUniv ? 'Enseignement Supérieur & Professionnel' : 'Enseignement Général / Classique'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9.5px] font-black tracking-wider uppercase ${isUniv ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                      {isUniv ? '🎓 SUPÉRIEUR' : '🎒 CLASSIQUE'}
                    </span>
                    {hasMultiCampus && (
                      formData.campus_id ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9.5px] font-black bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-wider">
                          📍 {campuses.find(c => c.id === formData.campus_id)?.name || 'Annexe Dédiée'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9.5px] font-black bg-purple-50 text-purple-700 border border-purple-100 uppercase tracking-wider">
                          🌐 Portée Siège
                        </span>
                      )
                    )}
                  </div>
                </div>

                {/* Left Panel: Identité & Ciblage Structure (7 cols) */}
                <div className="md:col-span-7 space-y-3 sm:space-y-3.5">
                  <div className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 space-y-3 shadow-2xs">
                    <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
                      <span className="p-1 bg-indigo-50 text-indigo-600 rounded-md"><FileText size={13} /></span>
                      <span>Informations Générales de l'Événement</span>
                    </h4>

                    {/* Name field */}
                    <div>
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1 block">
                        Nom de la Campagne / Intitulé du Frais *
                      </label>
                      <input 
                        required 
                        placeholder={isUniv ? "Ex: Frais de Soutenance PFE 2026, Stage Pratique..." : "Ex: Excursion Botanique, Kits Uniformes, Frais de Labo..."} 
                        className="w-full border border-slate-200 bg-slate-50/50 px-3 py-2 rounded-xl font-bold text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-400" 
                        value={formData.name} 
                        onChange={e => setFormData({...formData, name: e.target.value})} 
                      />
                    </div>

                    {/* Type selection */}
                    <div>
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1 block">
                        Catégorie / Nature de la Charge
                      </label>
                      <SelectPill
                        options={isUniv ? [
                          { value: 'STAGE', label: '📐 Activité Spéciale / Stage Pratique' },
                          { value: 'PROJET_MEMOIRE', label: "📖 Mémoires & Projets de Fin d'Études" },
                          { value: 'SEMINAIRE_COLLOQUE', label: '🎤 Séminaire, Colloque & Conférence' },
                          { value: 'SOUTENANCE', label: '🏛️ Frais de Soutenance devant Jury' },
                          { value: 'EXAMEN', label: '📝 Examens de Reprise / Sessions Spéciales' },
                          { value: 'INSCRIPTION_CONCOURS', label: "🎫 Concours d'Entrée & Traitement Dossiers" },
                          { value: 'HEBERGEMENT', label: '🏠 Logement Étudiant / Campus Résidence' },
                          { value: 'LABORATOIRE', label: '🧪 Travaux Pratiques / Matériel de Labo' },
                          { value: 'TECH_SALL_INFO', label: '💻 Accès Informatique, Internet & Plateforme' },
                          { value: 'SOUTIEN_SCOL', label: '🧠 Tutorat & Coaching Académique' },
                          { value: 'RETARD_SCOLARITE', label: '⚠️ Pénalités & Retard de Paiement' },
                          { value: 'AUTRE', label: '📋 Autre Frais Académique Exceptionnel' }
                        ] : [
                          { value: 'VISITE', label: '🚌 Visite / Excursion / Sortie Pédagogique' },
                          { value: 'SPORTS_CULTURE', label: '⚽ Activités Sportives, Art & Culture' },
                          { value: 'CEREMONIE', label: '🎓 Cérémonie / Collation / Diplômes' },
                          { value: 'UNIFORME', label: '👕 Uniforme Officiel, Tissu & Écusson' },
                          { value: 'ASSURANCE', label: '🛡️ Assurance Scolaire Obligatoire' },
                          { value: 'TRANSPORT', label: 'Navette / Transport Scolaire' },
                          { value: 'CANTINE', label: '🍽️ Cantine / Restauration Scolaire' },
                          { value: 'BIBLIOTHEQUE', label: '📚 Bibliothèque / Manuels & Livres' },
                          { value: 'SANTE', label: '🩺 Cabinet Médical & Soins' },
                          { value: 'RETARD_SCOLARITE', label: '⚠️ Pénalités de Retard de Paiement' },
                          { value: 'AUTRE', label: '📋 Autre Frais Occasionnel / Ad-Hoc' }
                        ]}
                        value={formData.type}
                        onChange={(val) => setFormData({ ...formData, type: val })}
                        variant="field"
                        size="md"
                        colorScheme="indigo"
                        className="w-full"
                        searchable
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1 block">
                        Description / Notes pour l'Économat et les Parents
                      </label>
                      <textarea 
                        rows={2} 
                        placeholder="Précisez les détails logistiques, conditions de participation ou matériel inclus..." 
                        className="w-full border border-slate-200 bg-slate-50/50 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" 
                        value={formData.description} 
                        onChange={e => setFormData({...formData, description: e.target.value})} 
                      />
                    </div>
                  </div>

                  {/* Ciblage de Structure / Scope */}
                  <div className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                        <span className="p-1 bg-emerald-50 text-emerald-600 rounded-md"><Users2 size={13} /></span>
                        <span>🎯 Périmètre de Ciblage (Rattachement)</span>
                      </h4>
                      <span className="text-[10px] font-bold text-slate-400">
                        Optionnel
                      </span>
                    </div>

                    <div className={`grid gap-2.5 sm:gap-3 ${hasMultiCampus ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                      {hasMultiCampus && (
                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 block">
                            Annexe / Campus *
                          </label>
                          <SelectPill
                            options={[
                              { value: '', label: '🌐 Toutes les annexes (Portée Siège)' },
                              ...campuses.map(c => ({ value: c.id, label: `📍 ${c.name}` }))
                            ]}
                            value={formData.campus_id}
                            onChange={(val) => setFormData({ ...formData, campus_id: val, class_id: '' })}
                            variant="field"
                            size="md"
                            colorScheme="indigo"
                            className="w-full"
                          />
                        </div>
                      )}

                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 block">
                          {terminology?.class || 'Classe'} / Promotion Spécifique
                        </label>
                        <SelectPill
                          options={[
                            { value: '', label: `🎓 Toutes les ${terminology?.classes?.toLowerCase() || 'classes'}` },
                            ...schoolClasses
                              .filter(c => !formData.campus_id || c.campus_id === formData.campus_id)
                              .map(c => ({
                                value: c.id,
                                label: c.name,
                                badge: classIdsWithStudents.has(c.id) ? 'Inscrits' : undefined
                              }))
                          ]}
                          value={formData.class_id}
                          onChange={(val) => setFormData({ ...formData, class_id: val })}
                          variant="field"
                          size="md"
                          colorScheme="indigo"
                          className="w-full"
                          searchable={schoolClasses.length > 4}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Panel: Finance & Period (5 cols) */}
                <div className="md:col-span-5 space-y-3 sm:space-y-3.5">
                  
                  {/* Financial Configuration */}
                  <div className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 space-y-3 shadow-2xs">
                    <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
                      <span className="p-1 bg-purple-50 text-purple-600 rounded-md"><Settings2 size={13} /></span>
                      <span>💰 Tarification & Échéance</span>
                    </h4>

                    {/* Amount & Currency */}
                    <div>
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1 block">
                        Montant du Frais Exigé *
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input 
                            required 
                            type="number" 
                            min="0" 
                            step="any"
                            placeholder="0.00" 
                            className="w-full border border-slate-200 bg-slate-50/50 pl-3.5 pr-12 py-2 rounded-xl font-black text-sm sm:text-base focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-mono text-slate-900" 
                            value={formData.amount} 
                            onChange={e => setFormData({...formData, amount: e.target.value})} 
                          />
                          <span className="absolute right-3 top-2 text-xs font-black text-indigo-600 font-mono">
                            {formData.currency}
                          </span>
                        </div>
                        <div className="w-24 sm:w-28">
                          <SelectPill
                            options={[
                              { value: 'HTG', label: 'HTG' },
                              { value: 'USD', label: 'USD' }
                            ]}
                            value={formData.currency}
                            onChange={(val) => setFormData({ ...formData, currency: val })}
                            variant="field"
                            size="md"
                            colorScheme="indigo"
                            className="w-full"
                          />
                        </div>
                      </div>

                      {/* Quick Presets */}
                      <div className="mt-2 flex items-center gap-1 flex-wrap">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 mr-1">Raccourcis :</span>
                        {(formData.currency === 'HTG' ? [500, 1000, 2500, 5000, 10000] : [10, 25, 50, 100, 250]).map(val => (
                          <button
                            type="button"
                            key={val}
                            onClick={() => setFormData({ ...formData, amount: val.toString() })}
                            className="px-1.5 py-0.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 rounded-md text-[9.5px] font-black font-mono transition-all border border-slate-200/60"
                          >
                            +{val} {formData.currency}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Payment Due Date */}
                    <div>
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1 block">
                        Date Limite de Paiement (Échéance)
                      </label>
                      <DatePickerPill
                        selectedDate={formData.due_date}
                        onSelectDate={(d) => setFormData({ ...formData, due_date: d })}
                        placeholder="Sélectionner une date..."
                        clearable
                        variant="field"
                        size="md"
                        colorScheme="indigo"
                        className="w-full"
                      />
                    </div>
                  </div>

                  {/* Period Planning Block */}
                  {TYPES_WITH_DATES.includes(formData.type) ? (
                    <div className="bg-indigo-50/50 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-indigo-100 space-y-3 shadow-2xs animate-in fade-in duration-300">
                      <h4 className="text-xs font-black uppercase text-indigo-900 tracking-wider flex items-center gap-2 border-b border-indigo-100/80 pb-2">
                        <CalendarDays size={14} className="text-indigo-600" />
                        <span>📅 Plage de Dates & Durée</span>
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Date Début</label>
                          <DatePickerPill
                            selectedDate={formData.start_date}
                            onSelectDate={(d) => setFormData({ ...formData, start_date: d })}
                            placeholder="Début..."
                            clearable
                            variant="field"
                            size="sm"
                            colorScheme="indigo"
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Date Fin</label>
                          <DatePickerPill
                            selectedDate={formData.end_date}
                            onSelectDate={(d) => setFormData({ ...formData, end_date: d })}
                            placeholder="Fin..."
                            clearable
                            variant="field"
                            size="sm"
                            colorScheme="indigo"
                            className="w-full"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Durée Évaluée (Jours)</label>
                        <div className="relative">
                          <input 
                            type="number" 
                            min="1" 
                            placeholder="Auto-calculé..." 
                            className="w-full border border-indigo-200 bg-white px-3 py-1.5 pr-14 rounded-xl font-black text-xs text-indigo-950 focus:border-indigo-500 outline-none transition-all" 
                            value={formData.duration_days} 
                            onChange={e => setFormData({...formData, duration_days: e.target.value})} 
                          />
                          <span className="absolute right-2 top-1.5 text-[8px] font-black tracking-widest text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-md uppercase">
                            Auto
                          </span>
                        </div>
                      </div>

                      <p className="text-[9.5px] text-indigo-700 font-semibold flex items-center gap-1.5">
                        <Info size={11} className="shrink-0 text-indigo-500" />
                        Calcul automatique en fonction de la période saisie.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/70 flex items-center gap-2.5 shadow-2xs">
                      <div className="p-2 bg-white text-slate-400 rounded-lg shrink-0 border border-slate-200/60">
                        <CalendarDays size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-slate-700 uppercase tracking-wider leading-tight">Frais ponctuel</p>
                        <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                          Aucune plage de dates requise pour cette catégorie.
                        </p>
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {/* Action Buttons Sticky Footer with Compact Ergonomics */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-50/90 border-t border-slate-200/80 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setShowForm(false)} 
                  className="w-full sm:w-auto px-5 py-2 bg-slate-200/80 hover:bg-slate-200 text-slate-700 rounded-xl font-extrabold text-xs transition-all cursor-pointer text-center active:scale-95"
                >
                  Annuler et Fermer
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="w-full sm:w-auto px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" /> Enregistrement...
                      </>
                    ) : formData.id ? (
                      <>
                        <Save size={14} /> Enregistrer les Modifications
                      </>
                    ) : (
                      <>
                        <Rocket size={14} /> Créer et Publier la Campagne
                      </>
                    )}
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Premium, Iframe-safe, Custom Delete Confirmation Dialog Modal */}
      {campaignToDelete && (
        <div className="fixed inset-0 z-[110] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl animate-in duration-200 zoom-in-95 border border-slate-100 overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center animate-pulse">
                <Trash2 size={24} />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-black text-slate-900 leading-tight">Supprimer la Campagne ?</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Voulez-vous vraiment supprimer définitivement la campagne <span className="font-bold text-slate-800">"{campaignToDelete.name}"</span> et toutes ses fiches d'affectation ? Cette action est irréversible.
                </p>

                {hasLinkedPayments && (
                  <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200 text-left space-y-3">
                    <div className="flex items-start gap-2">
                      <Info className="text-amber-600 shrink-0 mt-0.5" size={16} />
                      <div>
                        <p className="text-xs font-bold text-amber-900">Paiements Liés Détectés !</p>
                        <p className="text-[11px] text-amber-700 leading-normal">
                          Cette campagne a déjà enregistré <span className="font-bold text-rose-600">{linkedPaymentsCount} paiement(s)</span> de la part des {terminology.students?.toLowerCase() || 'élèves'}. Comment souhaitez-vous procéder ?
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 pt-1">
                      {isPrivilegedUser && (
                        <button
                          type="button"
                          onClick={() => confirmDeleteCampaign('refund')}
                          disabled={isDeleting}
                          className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all text-left flex items-center gap-2 cursor-pointer shadow-xs active:scale-[0.98]"
                        >
                          <ShieldCheck size={12} className="text-white shrink-0 animate-pulse" />
                          <span>Annuler & Rembourser définitivement (Statut 'ANNULÉ')</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => confirmDeleteCampaign('detach')}
                        disabled={isDeleting}
                        className="w-full py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all text-left flex items-center gap-2 cursor-pointer shadow-xs active:scale-[0.98]"
                      >
                        <RefreshCw size={12} className={isDeleting ? "animate-spin" : "text-indigo-500 shrink-0"} />
                        <span>Détacher (Convertir en Crédit Portefeuille des {terminology.students?.toLowerCase() || 'élèves'})</span>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => confirmDeleteCampaign('cascade')}
                        disabled={isDeleting}
                        className="w-full py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all text-left flex items-center gap-2 cursor-pointer shadow-xs active:scale-[0.98]"
                      >
                        <Trash2 size={12} className="text-rose-500 shrink-0" />
                        <span>Supprimer tout en cascade (Effacer les paiements)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex border-t border-slate-100 bg-slate-50/50 p-4 gap-3">
              <button
                type="button"
                onClick={() => { setCampaignToDelete(null); setHasLinkedPayments(false); setLinkedPaymentsCount(0); }}
                disabled={isDeleting}
                className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
              >
                Annuler
              </button>
              
              {!hasLinkedPayments && (
                <button
                  type="button"
                  onClick={() => confirmDeleteCampaign('direct')}
                  disabled={isDeleting}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.98]"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" /> Suppression...
                    </>
                  ) : (
                    'Oui, Supprimer'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AssignCampaignView: React.FC<{ user: UserProfile, campaign: Campaign, onBack: () => void, school: any, isYearArchived?: boolean }> = ({ user, campaign, onBack, school, isYearArchived = false }) => {
  const { terminology } = useSchool();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [campuses, setCampuses] = useState<any[]>([]);
  const [filterClass, setFilterClass] = useState(campaign.class_id || '');
  const [filterCampus, setFilterCampus] = useState(campaign.campus_id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [assignments, setAssignments] = useState<Record<string, any>>({});
  const [adjustmentModal, setAdjustmentModal] = useState<{ student: any; currentCustomAmount: string; reason: string } | null>(null);
  const [isSavingAdjustment, setIsSavingAdjustment] = useState(false);
  const [studentPayments, setStudentPayments] = useState<Record<string, number>>({});
  const [paymentsByStudent, setPaymentsByStudent] = useState<Record<string, any[]>>({});
  const [printPreview, setPrintPreview] = useState<any | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [cashierName, setCashierName] = useState('');
  const [currentCampaignStatus, setCurrentCampaignStatus] = useState<'DRAFT' | 'PROGRESS' | 'COMPLETED'>(campaign.status || 'DRAFT');
  const [showStatusConfirm, setShowStatusConfirm] = useState<{ newStatus: 'DRAFT' | 'PROGRESS' | 'COMPLETED'; unpaidCount: number } | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  
  const [paymentModalStudent, setPaymentModalStudent] = useState<any | null>(null);
  const [paymentModalAmount, setPaymentModalAmount] = useState<string>('');
  const [paymentModalCurrency, setPaymentModalCurrency] = useState<'HTG' | 'USD'>('HTG');
  const [paymentModalMethod, setPaymentModalMethod] = useState<string>('Cash');
  const [paymentModalBank, setPaymentModalBank] = useState('');
  const [paymentModalRef, setPaymentModalRef] = useState('');
  const [paymentModalDepositDate, setPaymentModalDepositDate] = useState('');
  const [paymentModalReceivedCash, setPaymentModalReceivedCash] = useState('');
  const [paymentModalSenderPhone, setPaymentModalSenderPhone] = useState('');
  const [paymentModalIssuerName, setPaymentModalIssuerName] = useState('');
  const [paymentModalCardLast4, setPaymentModalCardLast4] = useState('');
  const [paymentModalNotes, setPaymentModalNotes] = useState('');
  const [paymentModalIsSubmitting, setPaymentModalIsSubmitting] = useState(false);
  const [activeExchangeRate, setActiveExchangeRate] = useState<number>(134.5);

  const activePaymentMethods = React.useMemo(() => {
    return getActiveSchoolPaymentMethods(school);
  }, [school]);

  const currentMethodConfig = React.useMemo(() => {
    return getPaymentMethodConfig(paymentModalMethod, school);
  }, [paymentModalMethod, school]);

  useEffect(() => {
    if (activePaymentMethods.length > 0 && !activePaymentMethods.some(m => m.code === paymentModalMethod)) {
      setPaymentModalMethod(activePaymentMethods[0].code);
    }
  }, [activePaymentMethods, paymentModalMethod]);
  
  useEffect(() => {
    supabase.from('classes').select('*').eq('school_id', user.school_id).order('name').then(({data}) => {
       if (data) setClasses(data);
    });
    supabase.from('school_campuses').select('*').eq('school_id', user.school_id).order('name').then(({data}) => {
       if (data) setCampuses(data);
    });
    supabase.from('academic_years').select('*').eq('school_id', user.school_id).then(({data}) => {
       if (data) setAcademicYears(data);
    });
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle().then(({data}) => {
       if (data) setCashierName(data.full_name || '');
    });
    supabase.from('exchange_rates').select('rate_usd_to_htg, rate').eq('school_id', user.school_id).order('created_at', { ascending: false }).limit(1).then(({data}) => {
       if (data && data[0]) {
         const r = Number(data[0].rate_usd_to_htg || data[0].rate || 134.5);
         if (r > 0) setActiveExchangeRate(r);
       }
    });
  }, [user.school_id, user.id]);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const { data: enrolled, error: enrollError } = await supabase.from('enrollments')
         .select('student_id, students(id, first_name, last_name, reference_number, campus_id), class_id')
         .eq('academic_year_id', campaign.academic_year_id);
          
      if (enrollError) throw enrollError;

      const { data: assigns, error: assignError } = await supabase.from('student_ad_hoc_fees')
         .select('*')
         .eq('campaign_id', campaign.id);

      if (assignError) throw assignError;

      const { data: campaignPayments, error: paymentsError } = await supabase.from('payments')
         .select('*')
         .eq('ad_hoc_campaign_id', campaign.id);

      if (paymentsError) throw paymentsError;

      const pmtsMap: Record<string, number> = {};
      const pmtsByStudentMap: Record<string, any[]> = {};
      if (campaignPayments) {
        campaignPayments.forEach((p: any) => {
           if (p.status === 'ANNULE') return;
           const sid = p.student_id;
           let val = Number(p.amount || 0);
           if (campaign.currency === 'HTG' && p.currency === 'USD') {
             val = Number(p.amount_htg_equivalent || (val * activeExchangeRate));
           } else if (campaign.currency === 'USD' && p.currency === 'HTG') {
             val = val / (activeExchangeRate || 1);
           }
           pmtsMap[sid] = (pmtsMap[sid] || 0) + val;
           
           if (!pmtsByStudentMap[sid]) pmtsByStudentMap[sid] = [];
           pmtsByStudentMap[sid].push(p);
        });
      }
      setStudentPayments(pmtsMap);
      setPaymentsByStudent(pmtsByStudentMap);
          
      if (enrolled) {
        const validStudents = enrolled
          .filter(e => e.students)
          .map(e => ({
            ...(e.students as any),
            class_id: e.class_id
          }));
        setStudents(validStudents);
      }
      if (assigns) {
        setAssignedIds(new Set(assigns.map(a => a.student_id)));
        const map: Record<string, any> = {};
        assigns.forEach((a: any) => {
          map[a.student_id] = a;
        });
        setAssignments(map);
      }
    } catch (e: any) {
      toast.error(`Erreur de chargement: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  }, [campaign.academic_year_id, campaign.id, campaign.currency]);

  useEffect(() => {
    fetchStudents();
  }, [campaign.id, fetchStudents]);

  // Real-time synchronization for selected campaign assignments and payments
  useEffect(() => {
    if (!user?.school_id || !campaign?.id) return;

    const channelName = `admin_campaign_assign_${campaign.id}`;
    const assignSub = supabase.channel(channelName)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'student_ad_hoc_fees', 
        filter: `campaign_id=eq.${campaign.id}` 
      }, () => {
        fetchStudents();
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'payments', 
        filter: `ad_hoc_campaign_id=eq.${campaign.id}` 
      }, () => {
        fetchStudents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(assignSub);
    };
  }, [user?.school_id, campaign?.id, fetchStudents]);

  const handleSaveAdjustment = async () => {
    if (!adjustmentModal) return;
    const { student, currentCustomAmount, reason } = adjustmentModal;
    setIsSavingAdjustment(true);
    try {
      const customAmtVal = currentCustomAmount.trim() === '' ? null : Number(currentCustomAmount);
      if (customAmtVal !== null && isNaN(customAmtVal)) {
        throw new Error("Le montant saisi n'est pas un nombre valide.");
      }
      if (customAmtVal !== null && customAmtVal < 0) {
        throw new Error("Le montant ajusté ne peut pas être négatif.");
      }
      
      const alreadyPaid = studentPayments[student.id] || 0;
      if (customAmtVal !== null && customAmtVal < alreadyPaid) {
        throw new Error(`Le montant ajusté (${customAmtVal.toLocaleString()} ${campaign.currency}) ne peut pas être inférieur au montant déjà payé par l'${terminology.student.toLowerCase()} (${alreadyPaid.toLocaleString()} ${campaign.currency}).`);
      }

      if (customAmtVal !== null && !reason.trim()) {
        throw new Error("Veuillez saisir un motif pour l'ajustement.");
      }

      const { error } = await supabase
        .from('student_ad_hoc_fees')
        .update({
          custom_amount: customAmtVal,
          adjustment_reason: customAmtVal !== null ? reason.trim() : null,
          modified_at: new Date().toISOString(),
          modified_by: user.id
        })
        .eq('campaign_id', campaign.id)
        .eq('student_id', student.id);

      if (error) throw error;

      // Log audit
      await AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'student',
        entity_id: student.id,
        details: {
          action_detail: 'CAMPAIGN_FEE_ADJUSTMENT',
          message: `Ajustement du frais de campagne ${campaign.name} pour ${student.last_name} ${student.first_name} : ${customAmtVal !== null ? customAmtVal.toLocaleString() : 'Frais standard'} ${campaign.currency}. Motif: ${reason || 'N/A'}`
        }
      });

      toast.success("Frais de campagne ajusté avec succès !");
      setAdjustmentModal(null);
      fetchStudents(); // Refresh data
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'enregistrement de l'ajustement");
    } finally {
      setIsSavingAdjustment(false);
    }
  };

  const handleUpdateStatus = async (newStatus: 'DRAFT' | 'PROGRESS' | 'COMPLETED') => {
    if (isYearArchived) {
      toast.error("Cette année académique est archivée. Aucune modification de statut n'est permise.");
      return;
    }
    try {
      if (newStatus === 'COMPLETED') {
         if (assignedIds.size === 0) {
           toast.error("Impossible de terminer une campagne sans aucun participant.");
           return;
         }
         
         const unpaidCount = Array.from(assignedIds).filter(id => {
           const customAmt = assignments[id]?.custom_amount;
           const expectedAmt = customAmt !== undefined && customAmt !== null ? Number(customAmt) : campaign.amount;
           return (studentPayments[id] || 0) < expectedAmt;
         }).length;
         if (unpaidCount > 0) {
           setShowStatusConfirm({ newStatus, unpaidCount });
           return;
         }
      }

      await executeStatusUpdate(newStatus);
    } catch (e: any) {
      toast.error(e.message || "Erreur lors du changement de statut");
    }
  };

  const executeStatusUpdate = async (newStatus: 'DRAFT' | 'PROGRESS' | 'COMPLETED') => {
    if (isYearArchived) {
      toast.error("Cette année académique est archivée. Aucune modification de statut n'est permise.");
      return;
    }
    setIsUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('ad_hoc_campaigns')
        .update({ status: newStatus })
        .eq('id', campaign.id);

      if (error) throw error;
      
      setCurrentCampaignStatus(newStatus);
      toast.success(
        newStatus === 'COMPLETED' ? "Félicitations ! La campagne s'est achevée avec succès et a été clôturée." :
        newStatus === 'PROGRESS' ? "La campagne est maintenant en cours d'exécution." :
        "La campagne a été remise en statut de brouillon."
      );
      setShowStatusConfirm(null);
    } catch (e: any) {
      toast.error(e.message || "Erreur lors du changement de statut");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleRegisterCampaignPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalStudent) return;
    
    const amt = Number(paymentModalAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Veuillez saisir un montant valide supérieur à 0.");
      return;
    }

    const paidSoFar = studentPayments[paymentModalStudent.id] || 0;
    const customAmt = assignments[paymentModalStudent.id]?.custom_amount;
    const expectedAmt = customAmt !== undefined && customAmt !== null ? Number(customAmt) : campaign.amount;
    const remaining = expectedAmt - paidSoFar;
    if (amt > remaining + 5) {
      toast.error(`Le montant saisi (${amt.toLocaleString()} ${paymentModalCurrency}) dépasse le solde restant dû (${remaining.toLocaleString()} ${paymentModalCurrency}).`);
      return;
    }

    setPaymentModalIsSubmitting(true);
    try {
      const isPending = paymentModalMethod === 'Chèque' || paymentModalMethod === 'MonCash' || paymentModalMethod === 'Natcash';
      const moncashOrderId = paymentModalMethod === 'MonCash' ? `MC-${Date.now()}` : paymentModalMethod === 'Natcash' ? `NC-${Date.now()}` : null;
      const mappedType = `Stage / Frais: ${campaign.name}`;
      
      const isBankRequired = paymentModalMethod === 'Chèque' || paymentModalMethod === 'Dépôt Bancaire' || currentMethodConfig?.requires_bank;
      const isRefRequired = paymentModalMethod === 'Chèque' || paymentModalMethod === 'Dépôt Bancaire' || paymentModalMethod === 'MonCash' || paymentModalMethod === 'Natcash' || paymentModalMethod === 'Carte' || currentMethodConfig?.requires_reference;
      
      const payload: any = {
        school_id: user.school_id,
        campus_id: paymentModalStudent.campus_id || campaign.campus_id || null,
        student_id: paymentModalStudent.id,
        amount: amt,
        type: mappedType,
        nature: mappedType,
        fee_type: 'DIVERS',
        ad_hoc_campaign_id: campaign.id,
        currency: paymentModalCurrency,
        payment_method: paymentModalMethod,
        bank_name: isBankRequired ? paymentModalBank : null,
        reference_number: isRefRequired ? paymentModalRef : null,
        deposit_date: (paymentModalMethod === 'Dépôt Bancaire' || currentMethodConfig?.requires_deposit_date) ? paymentModalDepositDate : null,
        status: isPending ? 'EN_ATTENTE' : 'VALIDE',
        amount_htg_equivalent: paymentModalCurrency === 'USD' ? Math.round((amt * activeExchangeRate) * 100) / 100 : amt,
        exchange_rate_applied: activeExchangeRate || 140,
        moncash_order_id: moncashOrderId,
        moncash_status: (paymentModalMethod === 'MonCash' || paymentModalMethod === 'Natcash') ? 'PENDING' : null,
        academic_year_id: campaign.academic_year_id
      };

      console.log("Saving ad-hoc campaign payment...", payload);

      const { data, error } = await supabase.from('payments').insert([payload]).select().single();

      let finalData = data;
      let usedFallback = false;

      if (error) {
        if (error.code === 'PGRST204' || error.code === '42703') {
          console.warn("Retrying ad-hoc payment with fallback...", error.message);
          const retryPayload = { ...payload };
          if (error.message.includes('type')) delete retryPayload.type;
          if (error.message.includes('nature')) delete retryPayload.nature;
          if (error.message.includes('fee_type')) delete retryPayload.fee_type;
          if (error.message.includes('ad_hoc_campaign_id')) delete retryPayload.ad_hoc_campaign_id;
          if (error.message.includes('amount_htg_equivalent')) delete retryPayload.amount_htg_equivalent;
          if (error.message.includes('exchange_rate_applied')) delete retryPayload.exchange_rate_applied;
          if (error.message.includes('academic_year_id')) delete retryPayload.academic_year_id;
          if (error.message.includes('status')) delete retryPayload.status;

          const { data: retryData, error: retryError } = await supabase
            .from('payments')
            .insert([retryPayload])
            .select()
            .single();

          if (retryError) throw retryError;
          finalData = retryData;
          usedFallback = true;
        } else {
          throw error;
        }
      }

      toast.success(usedFallback ? "Versement enregistré avec succès (fallback appliqué) !" : "Versement enregistré avec succès !");

      const paymentId = finalData?.id || `REC-${Date.now().toString().substring(6)}`;
      const equivAmount = finalData?.amount_htg_equivalent || payload.amount_htg_equivalent || amt;
      const origAmount = finalData?.amount || payload.amount || amt;
      const currencyVal = finalData?.currency || payload.currency || 'HTG';
      const methodVal = finalData?.payment_method || payload.payment_method || 'Cash';

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'PAYMENT_PROCESSED',
        entity_type: 'payment',
        entity_id: paymentId,
        details: { student_id: paymentModalStudent.id, amount: amt, currency: paymentModalCurrency, ad_hoc_campaign_id: campaign.id }
      }).catch(console.error);

      setPrintPreview({
        id: paymentId,
        date: new Date().toLocaleDateString('fr-FR'),
        studentName: `${paymentModalStudent.last_name} ${paymentModalStudent.first_name}`,
        student_id: paymentModalStudent.id,
        classe: classes.find(c => c.id === paymentModalStudent.class_id)?.name || 'Classe non assignée',
        academic_year_id: campaign.academic_year_id,
        nature: mappedType,
        amount: equivAmount,
        original_amount: origAmount,
        currency: currencyVal,
        payment_method: methodVal
      });

      setPaymentModalStudent(null);
      fetchStudents();
    } catch (err: any) {
      console.error("Error registering payment:", err);
      toast.error(`Erreur d'enregistrement: ${err.message || err}`);
    } finally {
      setPaymentModalIsSubmitting(false);
    }
  };

  const toggleStudent = async (studentId: string) => {
    if (isYearArchived) {
       toast.error("Cette année académique est archivée. Aucune modification d'affectation n'est permise.");
       return;
    }
    if (currentCampaignStatus === 'COMPLETED') {
       toast.error("Cette campagne est clôturée. Aucune modification d'affectation n'est permise.");
       return;
    }

    const isAssigned = assignedIds.has(studentId);
    try {
      if (isAssigned) {
        const paidAmt = studentPayments[studentId] || 0;
        if (paidAmt > 0) {
          toast.error(`Désassignation refusée : ce ${terminology.student.toLowerCase()} a déjà effectué des versements.`, {
            description: `Montant enregistré : ${paidAmt.toLocaleString()} ${campaign.currency}`
          });
          return;
        }

        const { error } = await supabase.from('student_ad_hoc_fees')
          .delete()
          .eq('campaign_id', campaign.id)
          .eq('student_id', studentId);
        if (error) throw error;
        setAssignedIds(prev => { const n = new Set(prev); n.delete(studentId); return n; });
        toast.success("Désassignation réussie");
        fetchStudents();
      } else {
        const { error } = await supabase.from('student_ad_hoc_fees')
          .insert([{ school_id: user.school_id, campaign_id: campaign.id, student_id: studentId }]);
        if (error) throw error;
        setAssignedIds(prev => { const n = new Set(prev); n.add(studentId); return n; });
        toast.success("Assignation réussie");
        fetchStudents();
      }
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la modification de l'assignation");
    }
  };

  // Filter students based on state (Campus, Class, Search query)
  const filteredStudents = students.filter(s => {
    if (filterClass !== '' && s.class_id !== filterClass) return false;
    if (filterCampus !== '' && s.campus_id !== filterCampus) return false;
    
    if (searchQuery.trim() !== '') {
      const term = searchQuery.toLowerCase();
      const fullName = `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase();
      const matricule = (s.reference_number || '').toLowerCase();
      return fullName.includes(term) || matricule.includes(term);
    }
    return true;
  });

  const visibleAssignedCount = filteredStudents.filter(s => assignedIds.has(s.id)).length;
  const visibleUnassignedCount = filteredStudents.length - visibleAssignedCount;

  // Financial calculations
  const totalExpected = Array.from(assignedIds).reduce((sum, id) => {
    const customAmt = assignments[id]?.custom_amount;
    return sum + (customAmt !== undefined && customAmt !== null ? Number(customAmt) : campaign.amount);
  }, 0);
  const totalCollected = Array.from(assignedIds).reduce((sum, id) => sum + (studentPayments[id] || 0), 0);
  const totalRemaining = totalExpected - totalCollected;
  const recoveryRate = totalExpected > 0 ? ((totalCollected / totalExpected) * 100).toFixed(1) : "0.0";

  const assignAllVisible = async () => {
    if (isYearArchived) {
       toast.error("Cette année académique est archivée. Aucune modification n'est permise.");
       return;
    }
    if (currentCampaignStatus === 'COMPLETED') {
       toast.error("Cette campagne est clôturée. Aucune modification n'est permise.");
       return;
    }

    const toAssign = filteredStudents.filter(s => !assignedIds.has(s.id)).map(s => s.id);
    if (toAssign.length === 0) {
      toast.info(`Tous les ${terminology.student.toLowerCase()}s de cette sélection filtrée sont déjà assignés.`);
      return;
    }
    try {
       const { error } = await supabase.from('student_ad_hoc_fees').insert(toAssign.map(id => ({
          school_id: user.school_id, campaign_id: campaign.id, student_id: id
       })));
       if (error) throw error;
       
       const newSet = new Set(assignedIds);
       toAssign.forEach(id => newSet.add(id));
       setAssignedIds(newSet);
       toast.success(`${toAssign.length} ${terminology.student.toLowerCase()}s assignés à la campagne avec succès !`);
    } catch (e: any) {
       toast.error(e.message || "Erreur lors de l'assignation en masse");
    }
  };

  const unassignAllVisible = async () => {
    if (isYearArchived) {
       toast.error("Cette année académique est archivée. Aucune modification n'est permise.");
       return;
    }
    if (currentCampaignStatus === 'COMPLETED') {
       toast.error("Cette campagne est clôturée. Aucune modification n'est permise.");
       return;
    }

    const toUnassign = filteredStudents.filter(s => {
       const hasPaid = (studentPayments[s.id] || 0) > 0;
       return assignedIds.has(s.id) && !hasPaid;
    }).map(s => s.id);

    const paidCount = filteredStudents.filter(s => assignedIds.has(s.id) && (studentPayments[s.id] || 0) > 0).length;

    if (toUnassign.length === 0) {
      if (paidCount > 0) {
        toast.info(`Aucun ${terminology.student.toLowerCase()} ne peut être désassigné car tous ont déjà effectué un paiement.`);
      } else {
        toast.info(`Aucun ${terminology.student.toLowerCase()} de cette sélection filtrée n'est actuellement assigné.`);
      }
      return;
    }

    try {
       const { error } = await supabase.from('student_ad_hoc_fees')
          .delete()
          .eq('campaign_id', campaign.id)
          .in('student_id', toUnassign);
       if (error) throw error;
       
       const newSet = new Set(assignedIds);
       toUnassign.forEach(id => newSet.delete(id));
       setAssignedIds(newSet);
       
       if (paidCount > 0) {
         toast.success(`${toUnassign.length} ${terminology.student.toLowerCase()}s retirés. ${paidCount} ${terminology.student.toLowerCase()}(s) conservé(s) en raison de paiements existants.`);
       } else {
         toast.success(`${toUnassign.length} ${terminology.student.toLowerCase()}s retirés de la campagne avec succès !`);
       }
    } catch (e: any) {
       toast.error(e.message || "Erreur lors de l'annulation en masse");
    }
  };

  return (
    <div className={`max-w-6xl mx-auto space-y-6 pb-20 animate-in slide-in-from-right duration-300 ${printPreview ? 'print:hidden' : 'print:p-0'}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all active:scale-[0.97]"><ArrowLeft size={22} className="text-gray-600" /></button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-lg inline-block">📋 Campagne Active</span>
              <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg inline-block ${
                currentCampaignStatus === 'DRAFT' ? 'bg-slate-100 text-slate-800' :
                currentCampaignStatus === 'PROGRESS' ? 'bg-blue-100 text-blue-800' :
                'bg-emerald-100 text-emerald-800'
              }`}>
                {currentCampaignStatus === 'DRAFT' ? 'Brouillon' :
                 currentCampaignStatus === 'PROGRESS' ? 'En Cours' :
                 'Terminé avec Succès'}
              </span>
            </div>
            <h2 className="text-2xl font-black text-gray-900 leading-none mt-1.5">{campaign.name}</h2>
            <p className="text-gray-500 font-medium text-xs mt-1">
              Frais d'affectation : <span className="font-bold text-indigo-600 font-mono">{campaign.amount.toLocaleString()} {campaign.currency}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
          {currentCampaignStatus === 'DRAFT' && (
            <button
              onClick={() => handleUpdateStatus('PROGRESS')}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm active:scale-[0.98]"
              title="Débuter la campagne pour autoriser les suivis et encaissements"
            >
              <CheckCircle2 size={14} /> Débuter la Campagne
            </button>
          )}

          {currentCampaignStatus === 'PROGRESS' && (
            <>
              <button
                onClick={() => handleUpdateStatus('COMPLETED')}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm active:scale-[0.98]"
                title="Clôturer la campagne avec succès"
              >
                <CheckCircle2 size={14} /> Terminer avec Succès
              </button>
              <button
                onClick={() => handleUpdateStatus('DRAFT')}
                className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-medium text-xs transition-colors active:scale-[0.98]"
                title="Repasser la campagne en brouillon"
              >
                Retour en Brouillon
              </button>
            </>
          )}

          {currentCampaignStatus === 'COMPLETED' && (
            <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-100 px-4 py-2.5 rounded-xl text-xs font-bold leading-none">
              <span className="shrink-0 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Campagne Verrouillée (Terminée)
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
        {/* Financial Summary Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-center">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 mb-1">Total Attendu</span>
            <span className="text-xl font-black text-slate-800 font-mono">{totalExpected.toLocaleString()} {campaign.currency}</span>
          </div>
          <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 flex flex-col justify-center">
            <span className="text-[10px] uppercase font-black tracking-wider text-emerald-600 mb-1">Total Encaissé</span>
            <span className="text-xl font-black text-emerald-700 font-mono">{totalCollected.toLocaleString()} {campaign.currency}</span>
          </div>
          <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100 flex flex-col justify-center">
            <span className="text-[10px] uppercase font-black tracking-wider text-rose-600 mb-1">Reste à Recouvrer</span>
            <span className="text-xl font-black text-rose-700 font-mono">{totalRemaining.toLocaleString()} {campaign.currency}</span>
          </div>
          <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 flex flex-col justify-center relative overflow-hidden">
            <span className="text-[10px] uppercase font-black tracking-wider text-indigo-600 mb-1">Taux de Recouv.</span>
            <span className="text-2xl font-black text-indigo-700 font-mono">{recoveryRate}%</span>
            <div className="absolute bottom-0 left-0 h-1.5 bg-indigo-200 w-full opacity-50">
              <div className="h-full bg-indigo-500 rounded-r-full transition-all duration-1000" style={{ width: `${recoveryRate}%` }} />
            </div>
          </div>
        </div>

        {/* Advanced Filters Block */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Search Input */}
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                placeholder={`Chercher par nom ou matricule...`}
                className="w-full pl-9 pr-8 py-3 bg-white border border-slate-200 rounded-xl font-semibold text-xs text-gray-800 outline-none focus:border-indigo-500 placeholder:text-slate-400 transition-all font-sans"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-2.5 flex items-center text-slate-400 hover:text-slate-600">
                  <X size={14} className="bg-slate-100 rounded-full p-0.5" />
                </button>
              )}
            </div>

            {/* Campus Selector */}
            {campuses.length > 0 && (
              <SelectPill
                disabled={!!campaign.campus_id}
                options={[
                  { value: '', label: 'Toutes les Annexes (Campuses)' },
                  ...campuses.map(c => ({ value: c.id, label: c.name }))
                ]}
                value={filterCampus}
                onChange={(val) => { setFilterCampus(val); setFilterClass(''); }}
                variant="field"
                size="md"
                colorScheme="indigo"
                className="w-full"
              />
            )}

            {/* Class Selector */}
            <SelectPill
              disabled={!!campaign.class_id}
              options={[
                { value: '', label: `Toutes les ${terminology?.classes?.toLowerCase() || 'classes'}` },
                ...classes.filter(c => filterCampus === '' || c.campus_id === filterCampus).map(c => ({ value: c.id, label: c.name }))
              ]}
              value={filterClass}
              onChange={(val) => setFilterClass(val)}
              variant="field"
              size="md"
              colorScheme="indigo"
              className="w-full"
              searchable={classes.length > 5}
            />
          </div>

          {/* Mass Actions Roster Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-3 border-t border-slate-200/60 font-sans">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600 px-1 py-1 bg-slate-100 rounded-lg justify-center sm:justify-start">
              <span>📋 Sélection : <b className="text-gray-900 font-mono text-[13px]">{filteredStudents.length}</b> {terminology.student.toLowerCase()}(s)</span>
              <span className="text-slate-300">|</span>
              <span className="text-emerald-700">Assignés : <b className="font-mono text-[13px]">{visibleAssignedCount}</b></span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500">Non-assignés : <b className="font-mono text-[13px]">{visibleUnassignedCount}</b></span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <button 
                onClick={assignAllVisible} 
                disabled={currentCampaignStatus === 'COMPLETED'}
                className="bg-emerald-600 text-white font-black text-[11px] px-4 py-2.5 rounded-xl hover:bg-emerald-700 hover:shadow-md hover:shadow-emerald-200/50 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                title={`Assigner tous les ${terminology.students?.toLowerCase() || 'élèves'} affichés ci-dessous`}
              >
                <CheckCircle2 size={14} className="shrink-0" /> Tout Assigner
              </button>
              <button 
                onClick={unassignAllVisible} 
                disabled={currentCampaignStatus === 'COMPLETED'}
                className="bg-rose-600 text-white font-black text-[11px] px-4 py-2.5 rounded-xl hover:bg-rose-700 hover:shadow-md hover:shadow-rose-200/50 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                title={`Retirer tous les ${terminology.students?.toLowerCase() || 'élèves'} d'un seul coup (Sauf s'ils ont payé)`}
              >
                <X size={14} className="shrink-0" /> Tout Retirer
              </button>
              <button
                onClick={() => window.print()}
                className="bg-slate-800 text-white font-black text-[11px] px-4 py-2.5 rounded-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
                title="Imprimer le rapport de la sélection actuelle"
              >
                <Printer size={14} className="shrink-0" /> Imprimer Rapport
              </button>
            </div>
          </div>
        </div>
        
        {loading ? (
          <div className="py-8 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <FluidLoadingState 
              message={`Chargement sécurisé de la liste des ${terminology.students.toLowerCase()}...`} 
              subtext="Synchronisation des paiements et participations à la campagne..." 
            />
            <SkeletonTable rows={5} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStudents.map(s => {
               const isAssigned = assignedIds.has(s.id);
               
               // Resolve student's class name and campus
               const clsObj = classes.find(c => c.id === s.class_id);
               const classNameStr = clsObj ? clsObj.name : `${terminology?.class || 'Classe'} non assignée`;
               const classLevel = clsObj ? clsObj.level : 'N/A';
               
               const campusObj = campuses.find(c => c.id === s.campus_id || (clsObj && c.id === clsObj.campus_id));
               const campusNameStr = campusObj ? campusObj.name : '';

               return (
                 <div 
                   key={s.id} 
                   onClick={() => {
                     if (!isAssigned) {
                       toggleStudent(s.id);
                     }
                   }} 
                   className={`group p-4 rounded-2xl border-2 flex flex-col justify-between gap-4 transition-all hover:shadow-md active:scale-[0.99] duration-200 relative overflow-hidden ${
                     isAssigned 
                       ? 'bg-emerald-50/70 border-emerald-500 shadow-md shadow-emerald-100/30 cursor-default' 
                       : 'bg-white border-slate-100 hover:border-indigo-300 hover:bg-slate-50/20 cursor-pointer'
                   } ${currentCampaignStatus === 'COMPLETED' ? 'opacity-85 grayscale-[15%] cursor-not-allowed' : ''}`}
                 >
                   {/* Background aura effect on active / Unassign Button */}
                   {isAssigned && currentCampaignStatus !== 'COMPLETED' && (studentPayments[s.id] || 0) === 0 ? (
                     <button
                       type="button"
                       onClick={(e) => {
                         e.stopPropagation();
                         toggleStudent(s.id);
                       }}
                       className="absolute top-2 right-2 p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 transition-colors z-10 cursor-pointer flex items-center justify-center"
                       title={`Retirer cet ${terminology.student?.toLowerCase() || 'élève'} de la campagne`}
                     >
                       <X size={12} />
                     </button>
                   ) : isAssigned ? (
                     <span className="absolute top-2 right-2 w-7 h-7 bg-emerald-500/10 rounded-full flex items-center justify-center pointer-events-none">
                       <CheckCircle2 className="text-emerald-600" size={14} />
                     </span>
                   ) : null}

                   <div className="flex gap-3">
                     {/* Initial Avatar circle */}
                     <div className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center font-black text-xs font-mono border transition-colors ${
                       isAssigned 
                         ? 'bg-emerald-100 border-emerald-200 text-emerald-800' 
                         : 'bg-slate-100 border-slate-200 text-slate-700 group-hover:bg-indigo-50 group-hover:text-indigo-700'
                     }`}>
                       {((s.last_name || '?').charAt(0) + (s.first_name || '').charAt(0)).toUpperCase()}
                     </div>

                     <div className="space-y-0.5 overflow-hidden">
                       <h4 className={`font-black text-sm tracking-tight truncate leading-tight ${isAssigned ? 'text-emerald-950' : 'text-slate-800'}`}>
                         {s.last_name} {s.first_name}
                       </h4>
                       <p className="text-[10px] font-bold font-mono text-slate-400">
                         Matricule: <span className={isAssigned ? 'text-emerald-700' : 'text-slate-600'}>{s.reference_number || 'Aucun'}</span>
                       </p>
                     </div>
                   </div>

                   {/* Badges and disciplines metadata */}
                   <div className="space-y-1.5 pt-2 border-t border-slate-100/80">
                      <div className="flex flex-wrap gap-1">
                        {/* Class Specialty Badge */}
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/50 truncate max-w-full">
                          📚 {classNameStr}
                        </span>
                        
                        {/* Level badge if configured */}
                        {classLevel && classLevel !== 'N/A' && (
                          <span className="inline-flex items-center text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-wide">
                            🎓 {classLevel}
                          </span>
                        )}
                      </div>

                      {/* Campus/Annexe label */}
                      {campusNameStr && (
                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500">
                          <span className="text-emerald-500">📍</span> Annexe: <span className="text-slate-700 font-extrabold">{campusNameStr}</span>
                        </div>
                      )}
                   </div>

                   {/* Toggle Row Indicator Badge */}
                   <div className="flex flex-col gap-1.5 border-t border-dashed border-slate-100/80 pt-2.5">
                     <div className="flex justify-between items-center text-[10px] font-bold">
                       <span className="text-slate-400 text-[9px]">Status d'affectation :</span>
                       <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                         isAssigned 
                           ? 'bg-emerald-500 text-white' 
                           : 'bg-slate-100 text-slate-500 border border-slate-200'
                       }`}>
                         {isAssigned ? '✓ Assigné' : 'Non assigné'}
                       </span>
                     </div>

                     {isAssigned && (
                       <>
                         {/* Required Fee with Adjustment Edit Option */}
                         <div className="flex justify-between items-center text-[10px] font-bold text-slate-700">
                           <span className="text-slate-400 text-[9px]">Frais exigé :</span>
                           <div className="flex items-center gap-1.5">
                             {assignments[s.id]?.custom_amount !== undefined && assignments[s.id]?.custom_amount !== null ? (
                               <div className="flex flex-col items-end">
                                 <span className="font-extrabold text-[10px] text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100 flex items-center gap-1" title={`Ajusté (Original: ${campaign.amount.toLocaleString()} ${campaign.currency})`}>
                                   ✏️ {Number(assignments[s.id].custom_amount).toLocaleString()} {campaign.currency}
                                 </span>
                                 {assignments[s.id]?.adjustment_reason && (
                                   <span className="text-[8px] text-slate-500 italic max-w-[120px] truncate" title={assignments[s.id].adjustment_reason}>
                                     "{assignments[s.id].adjustment_reason}"
                                   </span>
                                 )}
                               </div>
                             ) : (
                               <span className="font-extrabold text-[10px] text-slate-700">{campaign.amount.toLocaleString()} {campaign.currency}</span>
                             )}
                             
                             {currentCampaignStatus !== 'COMPLETED' && !isYearArchived && (
                               <button
                                 type="button"
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setAdjustmentModal({
                                     student: s,
                                     currentCustomAmount: assignments[s.id]?.custom_amount !== undefined && assignments[s.id]?.custom_amount !== null ? assignments[s.id].custom_amount.toString() : '',
                                     reason: assignments[s.id]?.adjustment_reason || ''
                                   });
                                 }}
                                 className="text-indigo-600 hover:text-indigo-800 p-1 hover:bg-slate-200/60 rounded transition-all cursor-pointer"
                                 title="Ajuster le frais (diminuer ou augmenter)"
                               >
                                 <Edit3 size={11} />
                               </button>
                             )}
                           </div>
                         </div>

                         <div className="flex justify-between items-center text-[10px] font-bold text-slate-700">
                           <span className="text-slate-400 text-[9px]">Paiement :</span>
                           {(() => {
                             const customAmt = assignments[s.id]?.custom_amount;
                             const expectedAmt = customAmt !== undefined && customAmt !== null ? Number(customAmt) : campaign.amount;
                             const paid = studentPayments[s.id] || 0;
                             if (paid === 0) {
                               return <span className="inline-flex items-center gap-1 font-extrabold text-[10px] text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">⚠️ Non payé</span>;
                             } else if (paid < expectedAmt) {
                               return <span className="inline-flex items-center gap-1 font-extrabold text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">⏳ Partiel ({paid.toLocaleString()}/{expectedAmt.toLocaleString()})</span>;
                             } else {
                               return <span className="inline-flex items-center gap-1 font-extrabold text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">✅ Reçu total</span>;
                             }
                           })()}
                         </div>

                          {/* Collect payment button */}
                          {(() => {
                            const customAmt = assignments[s.id]?.custom_amount;
                            const expectedAmt = customAmt !== undefined && customAmt !== null ? Number(customAmt) : campaign.amount;
                            const paid = studentPayments[s.id] || 0;
                            if (paid < expectedAmt && currentCampaignStatus !== 'COMPLETED' && !isYearArchived) {
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPaymentModalStudent(s);
                                    setPaymentModalAmount((expectedAmt - paid).toString());
                                    setPaymentModalCurrency(campaign.currency as any || 'HTG');
                                    setPaymentModalMethod('Cash');
                                    setPaymentModalBank('');
                                    setPaymentModalRef('');
                                    setPaymentModalDepositDate(new Date().toISOString().split('T')[0]);
                                  }}
                                  className="mt-3 w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-100 active:scale-[0.98] cursor-pointer"
                                >
                                  💸 Encaisser un versement
                                </button>
                              );
                            }
                            return null;
                          })()}

                         {paymentsByStudent[s.id] && paymentsByStudent[s.id].length > 0 && (
                           <div className="mt-2 pt-2 border-t border-slate-100/60 flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
                             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                               <FileText size={10} className="text-indigo-500" /> Reçus de Paiement :
                             </p>
                             <div className="flex flex-col gap-1">
                               {paymentsByStudent[s.id].map((p, pIdx) => (
                                 <button
                                   key={p.id || pIdx}
                                   type="button"
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     setPrintPreview({
                                       id: p.id,
                                       date: new Date(p.created_at || p.date).toLocaleDateString('fr-FR'),
                                       studentName: `${s.last_name} ${s.first_name}`,
                                       student_id: s.id,
                                       classe: classNameStr,
                                       academic_year_id: p.academic_year_id,
                                       nature: p.nature || `Campagne: ${campaign.name}`,
                                       amount: p.amount_htg_equivalent || p.amount,
                                       original_amount: p.amount,
                                       currency: p.currency || 'HTG',
                                       payment_method: p.payment_method || p.method || 'Cash'
                                     });
                                   }}
                                   className="w-full flex items-center justify-between px-2.5 py-1.5 bg-indigo-50/60 hover:bg-indigo-100/80 text-indigo-700 hover:text-indigo-900 rounded-lg text-[10px] font-bold transition-all border border-indigo-100/30 active:scale-[0.98]"
                                 >
                                   <span className="flex items-center gap-1 truncate max-w-[120px]">
                                     RCP-{p.id?.substring(0,8) || pIdx}
                                   </span>
                                   <span className="flex items-center gap-1 shrink-0 font-mono text-[9px] bg-white px-1.5 py-0.5 rounded shadow-sm border border-indigo-200/40">
                                     <Printer size={10} /> {p.amount.toLocaleString()} {p.currency}
                                   </span>
                                 </button>
                               ))}
                             </div>
                           </div>
                         )}
                       </>
                     )}
                   </div>
                 </div>
               );
            })}
            
            {filteredStudents.length === 0 && (
              <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <p className="font-bold text-slate-400 mb-1 text-sm">Aucun {terminology.student.toLowerCase()} trouvé dans cette vue.</p>
                <p className="text-xs text-slate-400 font-medium">Ajustez vos filtres de recherche, de campus ou de {terminology?.class?.toLowerCase() || 'classe'}.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom warning modal for status closing with unpaid fees */}
      {showStatusConfirm && (
        <div className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl animate-in duration-200 zoom-in-95 border border-slate-100 overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center">
                <Info size={24} />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-black text-slate-900 leading-tight font-sans">Clôturer la campagne avec soldes dus ?</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed font-sans">
                  Attention : <span className="font-black text-rose-600">{showStatusConfirm.unpaidCount} participant(s)</span> n'ont pas encore réglé la totalité de leurs frais pour cette campagne.
                </p>
                <p className="text-xs text-slate-400 leading-normal font-sans">
                  Voulez-vous quand même clore cette campagne avec succès ? Une fois clôturée, elle sera verrouillée.
                </p>
              </div>
            </div>
            <div className="flex border-t border-slate-100 bg-slate-50/50 p-4 gap-3">
              <button
                type="button"
                onClick={() => setShowStatusConfirm(null)}
                disabled={isUpdatingStatus}
                className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-[11px] uppercase tracking-wider rounded-xl transition-all cursor-pointer text-center"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => executeStatusUpdate(showStatusConfirm.newStatus)}
                disabled={isUpdatingStatus}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.98]"
              >
                {isUpdatingStatus ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" /> Mise à jour...
                  </>
                ) : (
                  'Oui, Clôturer'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Payment Collection Modal */}
      {paymentModalStudent && (
        <div className="fixed inset-0 z-[110] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white max-w-xl w-full rounded-2xl sm:rounded-3xl shadow-2xl animate-in duration-200 zoom-in-95 border border-slate-100 overflow-hidden flex flex-col my-auto max-h-[94vh]">
            {/* Header */}
            <div className="px-4 sm:px-6 py-3 sm:py-3.5 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Banknote size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-md">
                      Encaissement Campagne
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight font-sans mt-0.5">
                    Nouveau versement
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalStudent(null)}
                className="p-1.5 bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition-all cursor-pointer border border-slate-200 shadow-2xs"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRegisterCampaignPayment} className="p-3.5 sm:p-5 space-y-3 sm:space-y-3.5 overflow-y-auto flex-1">
              {/* Student and Campaign Bento Summary */}
              {(() => {
                const customAmt = assignments[paymentModalStudent.id]?.custom_amount;
                const expectedAmt = customAmt !== undefined && customAmt !== null ? Number(customAmt) : campaign.amount;
                const paid = studentPayments[paymentModalStudent.id] || 0;
                const remaining = Math.max(0, expectedAmt - paid);
                const progressPct = expectedAmt > 0 ? Math.min(100, Math.round((paid / expectedAmt) * 100)) : 0;
                const studentClass = classes.find(c => c.id === paymentModalStudent.class_id)?.name || 'Classe non assignée';
                const initials = `${(paymentModalStudent.first_name || '')[0] || ''}${(paymentModalStudent.last_name || '')[0] || ''}`.toUpperCase() || 'EL';

                return (
                  <div className="bg-gradient-to-br from-indigo-50/80 via-white to-slate-50 p-3 sm:p-3.5 rounded-xl border border-indigo-100/80 space-y-2.5 shadow-2xs">
                    {/* Student Identity */}
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-indigo-100 text-indigo-700 font-black text-xs sm:text-sm flex items-center justify-center border border-indigo-200 shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-tight truncate">
                              {paymentModalStudent.last_name} {paymentModalStudent.first_name}
                            </h4>
                            {paymentModalStudent.code && (
                              <span className="text-[9px] font-mono font-bold text-slate-500 bg-white px-1 py-0.5 rounded border border-slate-200">
                                #{paymentModalStudent.code}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] sm:text-[11px] text-slate-500 font-semibold truncate mt-0.5">
                            {terminology.class} : <span className="text-slate-800 font-bold">{studentClass}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                          Événement
                        </span>
                        <span className="text-xs font-black text-indigo-950 block truncate max-w-[120px] sm:max-w-[160px]" title={campaign.name}>
                          {campaign.name}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[9.5px] font-bold text-slate-500">
                        <span>Progression du règlement</span>
                        <span className="font-black text-indigo-700">{progressPct}%</span>
                      </div>
                      <div className="w-full h-1.5 sm:h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60 p-0.5">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Financial 3-Pill Stat Grid */}
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-0.5">
                      <div className="bg-white/90 p-2 rounded-lg sm:rounded-xl border border-slate-200/70 text-center shadow-2xs">
                        <span className="text-[8.5px] font-bold uppercase tracking-wider text-slate-400 block">
                          Frais Exigé
                        </span>
                        <span className="text-[11px] sm:text-xs font-black text-slate-800 block mt-0.5 font-sans">
                          {expectedAmt.toLocaleString()} <span className="text-[9px] font-bold text-slate-500">{campaign.currency}</span>
                        </span>
                      </div>

                      <div className="bg-emerald-50/70 p-2 rounded-lg sm:rounded-xl border border-emerald-200/70 text-center shadow-2xs">
                        <span className="text-[8.5px] font-bold uppercase tracking-wider text-emerald-700 block flex items-center justify-center gap-0.5">
                          <Check size={9} /> Déjà Versé
                        </span>
                        <span className="text-[11px] sm:text-xs font-black text-emerald-800 block mt-0.5 font-sans">
                          {paid.toLocaleString()} <span className="text-[9px] font-bold text-emerald-600">{campaign.currency}</span>
                        </span>
                      </div>

                      <div className="bg-rose-50/80 p-2 rounded-lg sm:rounded-xl border border-rose-200/80 text-center shadow-2xs">
                        <span className="text-[8.5px] font-bold uppercase tracking-wider text-rose-700 block">
                          Reste Dû
                        </span>
                        <span className="text-[11px] sm:text-xs font-black text-rose-700 block mt-0.5 font-sans">
                          {remaining.toLocaleString()} <span className="text-[9px] font-bold text-rose-600">{campaign.currency}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Amount Field & Fast Shortcuts */}
              {(() => {
                const customAmt = assignments[paymentModalStudent.id]?.custom_amount;
                const expectedAmt = customAmt !== undefined && customAmt !== null ? Number(customAmt) : campaign.amount;
                const paid = studentPayments[paymentModalStudent.id] || 0;
                const remaining = Math.max(0, expectedAmt - paid);
                const currentNum = Number(paymentModalAmount) || 0;
                const isOverRemaining = currentNum > remaining;

                return (
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] sm:text-[11px] font-black uppercase text-slate-600 tracking-wider">
                        Montant à Encaisser ({campaign.currency}) *
                      </label>
                      <div className="flex items-center gap-1">
                        {[
                          { label: '25%', val: Math.round(remaining * 0.25) },
                          { label: '50%', val: Math.round(remaining * 0.50) },
                          { label: '75%', val: Math.round(remaining * 0.75) },
                          { label: '100% Solde', val: remaining }
                        ].map((btn) => {
                          const isActive = currentNum === btn.val && btn.val > 0;
                          return (
                            <button
                              key={btn.label}
                              type="button"
                              onClick={() => setPaymentModalAmount(btn.val.toString())}
                              className={`px-2 py-0.5 text-[9.5px] font-extrabold rounded-md transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                            >
                              {btn.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                        <span className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 font-black text-[11px] flex items-center justify-center">
                          {campaign.currency === 'USD' ? '$' : 'G'}
                        </span>
                      </div>
                      <input
                        type="number"
                        required
                        min="1"
                        step="any"
                        value={paymentModalAmount}
                        onChange={(e) => setPaymentModalAmount(e.target.value)}
                        className={`w-full pl-11 pr-4 py-2 sm:py-2.5 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 text-slate-900 font-black text-sm sm:text-base transition-all ${
                          isOverRemaining
                            ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500 bg-rose-50/30'
                            : 'border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-600'
                        }`}
                        placeholder="0.00"
                      />
                    </div>

                    {isOverRemaining && (
                      <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1 animate-in fade-in duration-150">
                        <AlertCircle size={12} />
                        Le montant dépasse le solde restant dû ({remaining.toLocaleString()} {campaign.currency}).
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Payment Method Modern Selector (Interactive Cards) */}
              <div className="space-y-1.5">
                <label className="block text-[10px] sm:text-[11px] font-black uppercase text-slate-600 tracking-wider">
                  Mode de Paiement *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
                  {activePaymentMethods.map((m) => {
                    const isSelected = paymentModalMethod === m.code;
                    const getIcon = () => {
                      if (m.code === 'Cash') return <Banknote size={15} className={isSelected ? 'text-indigo-600' : 'text-slate-500'} />;
                      if (m.code === 'Dépôt Bancaire') return <Landmark size={15} className={isSelected ? 'text-indigo-600' : 'text-slate-500'} />;
                      if (m.code === 'MonCash') return <Smartphone size={15} className={isSelected ? 'text-rose-600' : 'text-rose-500'} />;
                      if (m.code === 'Natcash') return <Smartphone size={15} className={isSelected ? 'text-amber-600' : 'text-amber-500'} />;
                      if (m.code === 'Chèque') return <Receipt size={15} className={isSelected ? 'text-indigo-600' : 'text-slate-500'} />;
                      if (m.code === 'Carte') return <CreditCard size={15} className={isSelected ? 'text-indigo-600' : 'text-slate-500'} />;
                      return <Wallet size={15} className={isSelected ? 'text-indigo-600' : 'text-slate-500'} />;
                    };

                    return (
                      <button
                        key={m.code}
                        type="button"
                        onClick={() => {
                          setPaymentModalMethod(m.code);
                          if (m.code === 'Cash') {
                            setPaymentModalBank('');
                            setPaymentModalRef('');
                          }
                        }}
                        className={`p-2 sm:p-2.5 rounded-xl border text-left flex flex-col justify-between gap-1 transition-all cursor-pointer relative ${
                          isSelected
                            ? 'bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                            : 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className={`p-1 rounded-lg ${isSelected ? 'bg-white shadow-2xs' : 'bg-slate-100'}`}>
                            {getIcon()}
                          </div>
                          {m.code === 'MonCash' && (
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 uppercase">
                              Digicel
                            </span>
                          )}
                          {m.code === 'Natcash' && (
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 uppercase">
                              Natcom
                            </span>
                          )}
                          {isSelected && (
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 ring-2 ring-indigo-200" />
                          )}
                        </div>
                        <div>
                          <span className={`text-[11px] sm:text-xs font-black block leading-tight ${isSelected ? 'text-indigo-950' : 'text-slate-800'}`}>
                            {m.name}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Contextual Panels per Payment Method */}
              <div className="space-y-2 sm:space-y-2.5">
                {/* 1. CASH / ESPÈCES */}
                {paymentModalMethod === 'Cash' && (
                  <div className="p-3 sm:p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-2.5 animate-in fade-in duration-200">
                    <div className="flex items-start gap-2">
                      <div className="p-1 bg-emerald-100 text-emerald-700 rounded-md shrink-0 mt-0.5">
                        <Banknote size={14} />
                      </div>
                      <div>
                        <p className="text-[11px] sm:text-xs font-bold text-emerald-950">
                          Encaissement en Espèces à la Caisse
                        </p>
                        <p className="text-[10px] sm:text-[10.5px] text-emerald-800/90 leading-relaxed font-medium">
                          Vérifier l’authenticité des billets et remettre immédiatement le reçu à l'élève ou au tuteur.
                        </p>
                      </div>
                    </div>

                    {/* Change Calculator */}
                    <div className="pt-2 border-t border-emerald-200/60">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 space-y-1">
                          <label className="text-[10px] font-black uppercase text-emerald-900 tracking-wider flex items-center gap-1">
                            <Calculator size={12} /> Montant Reçu en Main
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={paymentModalReceivedCash}
                            onChange={(e) => setPaymentModalReceivedCash(e.target.value)}
                            placeholder="Ex: 5000"
                            className="w-full px-3 py-1.5 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                          />
                        </div>
                        {paymentModalReceivedCash && Number(paymentModalReceivedCash) > 0 && (
                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900 block">
                              Monnaie à Rendre
                            </span>
                            {(() => {
                              const rec = Number(paymentModalReceivedCash) || 0;
                              const due = Number(paymentModalAmount) || 0;
                              const change = rec - due;
                              return (
                                <span
                                  className={`text-sm font-black block mt-0.5 ${
                                    change >= 0 ? 'text-emerald-700' : 'text-amber-700'
                                  }`}
                                >
                                  {change >= 0 ? `+ ${change.toLocaleString()} ${campaign.currency}` : `Insuffisant (${Math.abs(change).toLocaleString()})`}
                                </span>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. DÉPÔT BANCAIRE / VIREMENT */}
                {paymentModalMethod === 'Dépôt Bancaire' && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 pb-1 border-b border-slate-200/60">
                      <Landmark size={15} className="text-indigo-600" />
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                        Informations du Dépôt / Virement
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">
                          Banque de Destination *
                        </label>
                        {school?.global_settings?.banks && school?.global_settings?.banks?.length > 0 ? (
                          <SelectPill
                            options={[
                              { value: '', label: 'Sélectionner la banque' },
                              ...school.global_settings.banks.map((b: string) => ({ value: b, label: b }))
                            ]}
                            value={paymentModalBank}
                            onChange={(val) => setPaymentModalBank(val)}
                            placeholder="Sélectionner la banque"
                            variant="field"
                            size="sm"
                            colorScheme="indigo"
                            className="w-full"
                          />
                        ) : (
                          <input
                            type="text"
                            required
                            value={paymentModalBank}
                            onChange={(e) => setPaymentModalBank(e.target.value)}
                            placeholder="SOGEBANK, UNIBANK, BUH..."
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                          />
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">
                          N° Bordereau / Réf. Transaction *
                        </label>
                        <input
                          type="text"
                          required
                          value={paymentModalRef}
                          onChange={(e) => setPaymentModalRef(e.target.value)}
                          placeholder="Ex: BOR-928174"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">
                        Date Effectuée sur le Bordereau *
                      </label>
                      <DatePickerPill
                        selectedDate={paymentModalDepositDate}
                        onSelectDate={(d) => setPaymentModalDepositDate(d)}
                        variant="field"
                        size="sm"
                        colorScheme="indigo"
                        className="w-full"
                      />
                    </div>

                    {currentMethodConfig?.account_info && (
                      <div className="p-2.5 bg-indigo-50/80 rounded-xl border border-indigo-100 text-[11px] text-indigo-950 flex items-center justify-between">
                        <span className="text-slate-600 font-bold">Compte École :</span>
                        <span className="font-mono font-black text-indigo-900 bg-white px-2 py-0.5 rounded border border-indigo-200">
                          {currentMethodConfig.account_info}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. MONCASH (DIGICEL) */}
                {paymentModalMethod === 'MonCash' && (
                  <div className="p-4 bg-rose-50/60 border border-rose-200/80 rounded-2xl space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between pb-1 border-b border-rose-200/60">
                      <div className="flex items-center gap-2">
                        <Smartphone size={15} className="text-rose-600" />
                        <span className="text-xs font-black text-rose-950 uppercase tracking-wider">
                          Paiement Électronique MonCash
                        </span>
                      </div>
                      <span className="text-[9px] font-black px-2 py-0.5 bg-rose-600 text-white rounded-full">
                        Digicel
                      </span>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-black uppercase text-rose-900 tracking-wider">
                        N° Transaction / Référence SMS MonCash *
                      </label>
                      <input
                        type="text"
                        required
                        value={paymentModalRef}
                        onChange={(e) => setPaymentModalRef(e.target.value)}
                        placeholder="Ex: MC-84920194 ou Réf. SMS"
                        className="w-full px-3 py-2 bg-white border border-rose-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-black uppercase text-rose-900 tracking-wider">
                        N° Téléphone Expéditeur (Optionnel)
                      </label>
                      <input
                        type="tel"
                        value={paymentModalSenderPhone}
                        onChange={(e) => setPaymentModalSenderPhone(e.target.value)}
                        placeholder="+509 37XX-XXXX"
                        className="w-full px-3 py-2 bg-white border border-rose-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600"
                      />
                    </div>

                    {currentMethodConfig?.account_info && (
                      <p className="text-[11px] text-rose-900/90 font-medium leading-relaxed bg-white/80 p-2.5 rounded-xl border border-rose-200/70">
                        📱 Compte MonCash Marchand officiel de l'école : <span className="font-mono font-bold text-rose-700">{currentMethodConfig.account_info}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* 4. NATCASH (NATCOM) */}
                {paymentModalMethod === 'Natcash' && (
                  <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-2xl space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between pb-1 border-b border-amber-200/60">
                      <div className="flex items-center gap-2">
                        <Smartphone size={15} className="text-amber-600" />
                        <span className="text-xs font-black text-amber-950 uppercase tracking-wider">
                          Paiement Électronique Natcash
                        </span>
                      </div>
                      <span className="text-[9px] font-black px-2 py-0.5 bg-amber-500 text-white rounded-full">
                        Natcom
                      </span>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-black uppercase text-amber-900 tracking-wider">
                        Code de Transaction Natcash *
                      </label>
                      <input
                        type="text"
                        required
                        value={paymentModalRef}
                        onChange={(e) => setPaymentModalRef(e.target.value)}
                        placeholder="Ex: NC-72810394"
                        className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-black uppercase text-amber-900 tracking-wider">
                        N° Téléphone Expéditeur (Optionnel)
                      </label>
                      <input
                        type="tel"
                        value={paymentModalSenderPhone}
                        onChange={(e) => setPaymentModalSenderPhone(e.target.value)}
                        placeholder="+509 41XX-XXXX"
                        className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                      />
                    </div>

                    {currentMethodConfig?.account_info && (
                      <p className="text-[11px] text-amber-900/90 font-medium leading-relaxed bg-white/80 p-2.5 rounded-xl border border-amber-200/70">
                        📲 Compte Natcash officiel de l'école : <span className="font-mono font-bold text-amber-800">{currentMethodConfig.account_info}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* 5. CHÈQUE BANCAIRE */}
                {paymentModalMethod === 'Chèque' && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 pb-1 border-b border-slate-200/60">
                      <Receipt size={15} className="text-indigo-600" />
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                        Détails du Chèque Certifié / Direction
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">
                          Banque Émettrice *
                        </label>
                        {school?.global_settings?.banks && school?.global_settings?.banks?.length > 0 ? (
                          <SelectPill
                            options={[
                              { value: '', label: 'Sélectionner la banque' },
                              ...school.global_settings.banks.map((b: string) => ({ value: b, label: b }))
                            ]}
                            value={paymentModalBank}
                            onChange={(val) => setPaymentModalBank(val)}
                            placeholder="Sélectionner la banque"
                            variant="field"
                            size="sm"
                            colorScheme="indigo"
                            className="w-full"
                          />
                        ) : (
                          <input
                            type="text"
                            required
                            value={paymentModalBank}
                            onChange={(e) => setPaymentModalBank(e.target.value)}
                            placeholder="SOGEBANK, UNIBANK, BUH..."
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                          />
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">
                          Numéro du Chèque *
                        </label>
                        <input
                          type="text"
                          required
                          value={paymentModalRef}
                          onChange={(e) => setPaymentModalRef(e.target.value)}
                          placeholder="Ex: CHQ-001928"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">
                        Émetteur / Titulaire du Compte (Optionnel)
                      </label>
                      <input
                        type="text"
                        value={paymentModalIssuerName}
                        onChange={(e) => setPaymentModalIssuerName(e.target.value)}
                        placeholder="Nom complet figurant sur le chèque"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                      />
                    </div>

                    <p className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200/80">
                      ⚠️ Le chèque doit être impérativement libellé à l'ordre exact de l'établissement. L'encaissement sera validé après compensation bancaire.
                    </p>
                  </div>
                )}

                {/* 6. CARTE BANCAIRE / TPE */}
                {paymentModalMethod === 'Carte' && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 pb-1 border-b border-slate-200/60">
                      <CreditCard size={15} className="text-indigo-600" />
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                        Transaction Carte / Terminal TPE
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">
                          N° Autorisation / Ticket TPE *
                        </label>
                        <input
                          type="text"
                          required
                          value={paymentModalRef}
                          onChange={(e) => setPaymentModalRef(e.target.value)}
                          placeholder="Ex: AUT-839210"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">
                          4 Derniers Chiffres Carte (Optionnel)
                        </label>
                        <input
                          type="text"
                          maxLength={4}
                          value={paymentModalCardLast4}
                          onChange={(e) => setPaymentModalCardLast4(e.target.value.replace(/\D/g, ''))}
                          placeholder="Ex: 4829"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 7. PORTEFEUILLE / AVOIR */}
                {paymentModalMethod === 'Portefeuille' && (
                  <div className="p-4 bg-indigo-50/60 border border-indigo-200/80 rounded-2xl space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg shrink-0 mt-0.5">
                        <Wallet size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-indigo-950">
                          Imputation sur le Portefeuille / Avoir de l'Élève
                        </p>
                        <p className="text-[11px] text-indigo-800/90 leading-relaxed font-medium mt-0.5">
                          Le montant sera directement déduit du solde créditeur disponible de l'élève.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions Footer inside form */}
              <div className="flex items-center gap-2.5 pt-3 border-t border-slate-100 bg-white shrink-0">
                <button
                  type="button"
                  onClick={() => setPaymentModalStudent(null)}
                  disabled={paymentModalIsSubmitting}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer text-center"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={paymentModalIsSubmitting || !Number(paymentModalAmount) || Number(paymentModalAmount) <= 0}
                  className="flex-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  {paymentModalIsSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Enregistrement...
                    </>
                  ) : (
                    <>
                      <ArrowRight size={14} />
                      <span>
                        Enregistrer {Number(paymentModalAmount) > 0 ? `${Number(paymentModalAmount).toLocaleString()} ${campaign.currency}` : 'le versement'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dynamic Adjustment Modal */}
      {adjustmentModal && (
        <div className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl animate-in duration-200 zoom-in-95 border border-slate-100 overflow-hidden flex flex-col my-auto max-h-[92vh]">
            <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex justify-between items-center shrink-0">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  ✏️ AJUSTEMENT DES FRAIS
                </span>
                <h3 className="text-sm sm:text-base font-black text-slate-950 mt-0.5 leading-tight font-sans">
                  Modifier le frais exigé
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAdjustmentModal(null)}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-xl transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3.5 sm:p-5 space-y-3 overflow-y-auto flex-1">
              <div className="bg-indigo-50/40 border border-indigo-100/50 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">{terminology.student} :</span>
                  <span className="font-extrabold text-slate-800">
                    {adjustmentModal.student.last_name} {adjustmentModal.student.first_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Campagne :</span>
                  <span className="font-extrabold text-slate-800">{campaign.name}</span>
                </div>
                <div className="flex justify-between border-t border-indigo-100/50 pt-1.5">
                  <span className="text-slate-400 font-bold">Frais de base :</span>
                  <span className="font-extrabold text-slate-800">
                    {campaign.amount.toLocaleString()} {campaign.currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Déjà payé par l'{terminology.student?.toLowerCase() || 'élève'} :</span>
                  <span className="font-extrabold text-emerald-600">
                    {(studentPayments[adjustmentModal.student.id] || 0).toLocaleString()} {campaign.currency}
                  </span>
                </div>
              </div>

              {/* Amount Field */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  Nouveau montant requis ({campaign.currency})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={adjustmentModal.currentCustomAmount}
                  onChange={(e) => setAdjustmentModal(prev => prev ? { ...prev, currentCustomAmount: e.target.value } : null)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-black text-xs sm:text-sm"
                  placeholder={`Laissez vide pour le montant standard (${campaign.amount})`}
                />
                <p className="text-[9.5px] text-slate-400">
                  Laissez ce champ vide pour réinitialiser au frais standard de la campagne.
                </p>
              </div>

              {/* Dynamic Preview Section */}
              {(() => {
                const valStr = adjustmentModal.currentCustomAmount.trim();
                if (valStr === '') return null;
                const val = Number(valStr);
                if (isNaN(val) || val < 0) return null;

                const originalAmt = campaign.amount;
                const paid = studentPayments[adjustmentModal.student.id] || 0;
                const diff = originalAmt - val;
                const remaining = val - paid;

                return (
                  <div className="mt-1.5 bg-slate-50 border border-slate-200/50 rounded-xl p-3 space-y-1.5 text-xs">
                    <p className="font-extrabold text-[9.5px] uppercase tracking-wider text-slate-400">
                      💡 APERÇU DE L'AJUSTEMENT :
                    </p>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Nouveau total exigé :</span>
                      <span className="font-black text-slate-800">
                        {val.toLocaleString()} {campaign.currency}
                      </span>
                    </div>
                    {diff > 0 ? (
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Rabais accordé :</span>
                        <span className="font-extrabold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
                          - {diff.toLocaleString()} {campaign.currency} ({Math.round((diff / originalAmt) * 100)}%)
                        </span>
                      </div>
                    ) : diff < 0 ? (
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Majoration :</span>
                        <span className="font-extrabold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded text-[11px]">
                          + {Math.abs(diff).toLocaleString()} {campaign.currency}
                        </span>
                      </div>
                    ) : null}
                    <div className="flex justify-between border-t border-slate-200/50 pt-1.5 font-bold">
                      <span className="text-slate-600">Nouveau solde restant dû :</span>
                      {remaining < 0 ? (
                        <span className="text-rose-600 font-extrabold bg-rose-50 px-1.5 py-0.5 rounded text-[11px]">
                          Trop-perçu ({Math.abs(remaining).toLocaleString()} {campaign.currency})
                        </span>
                      ) : (
                        <span className="text-slate-800 font-black">
                          {remaining.toLocaleString()} {campaign.currency}
                        </span>
                      )}
                    </div>
                    {remaining < 0 && (
                      <div className="mt-1 text-[9.5px] text-rose-600 font-bold bg-rose-50 p-2 rounded-lg border border-rose-100">
                        ⚠️ Erreur : Le nouveau montant requis ne peut pas être inférieur au montant déjà payé ({paid.toLocaleString()} {campaign.currency}).
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Adjustment Reason */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  Motif de l'ajustement *
                </label>
                <textarea
                  required={adjustmentModal.currentCustomAmount.trim() !== ''}
                  value={adjustmentModal.reason}
                  onChange={(e) => setAdjustmentModal(prev => prev ? { ...prev, reason: e.target.value } : null)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-medium text-xs min-h-[60px]"
                  placeholder="Ex: Réduction accordée par la direction, majoration de retard..."
                />
              </div>

              {/* Actions Footer */}
              <div className="flex border-t border-slate-100 pt-3 gap-2 bg-white">
                <button
                  type="button"
                  onClick={() => setAdjustmentModal(null)}
                  disabled={isSavingAdjustment}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer text-center"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSaveAdjustment}
                  disabled={isSavingAdjustment}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  {isSavingAdjustment ? (
                    <>
                      <Loader2 size={12} className="animate-spin" /> Enregistrement...
                    </>
                  ) : (
                    '💾 Confirmer'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic thermal-optimized receipt modal */}
      {printPreview && (
        <div id="receipt-print-modal" className="fixed inset-0 z-[1000] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-0 md:p-6 print:absolute print:inset-0 print:bg-white print:backdrop-blur-none animate-in fade-in duration-300 overflow-hidden print:overflow-visible">
          <div className="w-full h-full max-w-4xl flex flex-col animate-in zoom-in-95 duration-500 print:block">
            
            <div className="flex flex-col md:flex-row justify-between items-center w-full bg-white p-6 md:rounded-t-[2rem] shadow-xl border-b-[6px] border-b-indigo-600 gap-4 print:hidden">
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl items-center justify-center border border-indigo-100 shadow-sm">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-xl tracking-tight leading-none">Réimpression de Reçu</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-1.5">
                    <ShieldCheck size={12} className="text-emerald-500" />
                    Transaction certifiée • EduNova Pro
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button 
                  onClick={() => { setPrintPreview(null); fetchStudents(); }} 
                  className="flex-1 sm:flex-none px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all text-xs tracking-tight active:scale-95"
                >
                  <X size={16} className="inline mr-2" /> Fermer
                </button>
                <button 
                  onClick={() => window.print()} 
                  className="flex-1 sm:flex-none px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition-all text-xs tracking-tight flex items-center justify-center gap-2 active:scale-95"
                >
                  <Printer size={18} /> Imprimer Reçu
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-100 overflow-y-auto p-4 md:p-10 md:rounded-b-[2rem] print:bg-white print:p-0 print:overflow-visible">
              {/* REÇU TICKET THERMIQUE 80MM */}
              <div id="adhoc-thermal-reprint-receipt" className="bg-white p-4 sm:p-6 w-[80mm] max-w-[80mm] mx-auto shadow-2xl rounded-xl border border-gray-200 text-black font-sans leading-tight flex flex-col print:shadow-none print:border-none print:m-0 print:p-2 print:w-[80mm]">
                {/* HEADER SCOLAIRE */}
                <div className="w-full text-center border-b-2 border-black pb-2 mb-3">
                  {school?.logo_url ? (
                    <img src={school.logo_url} alt="Logo" className="h-12 mx-auto mb-1 object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <img src="/logo.png" alt="Logo" className="h-12 mx-auto mb-1 object-contain grayscale" />
                  )}
                  <h1 className="text-[13px] font-black uppercase leading-tight">{school?.name || 'INSTITUTION SCOLAIRE'}</h1>
                  <div className="text-[9px] font-bold opacity-90 italic mt-0.5 space-y-0.5">
                    {school?.address && <p>{school.address}</p>}
                    {school?.phone && <p>Téls: {school.phone}</p>}
                  </div>
                </div>

                {/* TITRE DU DOCUMENT */}
                <div className="w-full text-center mb-3 py-1.5 bg-gray-100 rounded border border-gray-200 print:bg-gray-100">
                  <h2 className="text-[12px] font-black tracking-widest uppercase">REÇU OFFICIEL (DUPLICATA)</h2>
                  <p className="text-[9px] font-bold opacity-80 mt-0.5">#RCP-{printPreview.id?.substring(0,8)}</p>
                </div>

                {/* GRID DETAILS (2 COLONNES COMPACTES) */}
                <div className="w-full grid grid-cols-2 gap-2 text-[9px] mb-3 border-b border-black pb-2">
                  <div className="space-y-1">
                    <div>
                      <p className="text-[7px] uppercase font-black text-gray-500">Date & Heure</p>
                      <p className="font-bold leading-none">{printPreview.date || new Date().toLocaleDateString('fr-FR')}</p>
                    </div>
                    <div>
                      <p className="text-[7px] uppercase font-black text-gray-500">Caissier</p>
                      <p className="font-bold leading-none">{cashierName || 'Administration'}</p>
                    </div>
                  </div>
                  <div className="space-y-1 text-right border-l border-gray-200 pl-2">
                    <div>
                      <p className="text-[7px] uppercase font-black text-gray-500">Élève</p>
                      <p className="font-black text-[10px] leading-tight">{printPreview.studentName}</p>
                      <p className="text-[8px] font-bold text-gray-600 italic">{printPreview.classe || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* MOTIF & PAIEMENT */}
                <div className="w-full text-[9px] mb-3 space-y-1 border-b border-dashed border-gray-400 pb-2">
                  <div className="flex justify-between items-center py-0.5">
                    <span className="font-bold uppercase text-gray-600">Motif:</span>
                    <span className="font-black text-[10px]">{printPreview.nature}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="font-bold uppercase text-gray-600">Mode:</span>
                    <span className="font-black text-[10px]">{printPreview.payment_method || 'Cash'}</span>
                  </div>
                </div>

                {/* NET PERÇU (BOX DE MISE EN VALEUR CLAIR MONOCHROME) */}
                <div className="w-full border-2 border-black rounded-lg p-2 mb-3 text-center bg-gray-50 text-black">
                  <p className="text-[8px] font-black uppercase tracking-wider text-gray-700">Montant Certifié Payé</p>
                  <p className="text-[16px] font-black tracking-tight leading-none mt-1 text-black">
                    {printPreview.amount?.toLocaleString()} <span className="text-[11px] font-bold">HTG</span>
                  </p>
                  {printPreview.currency && printPreview.currency !== 'HTG' && (
                    <p className="text-[9px] font-bold mt-1 pt-1 border-t border-black/20">
                      Équivalent Origine: {printPreview.original_amount?.toLocaleString()} {printPreview.currency}
                    </p>
                  )}
                </div>

                {/* SIGNATURE & MENTION LÉGALE */}
                <div className="w-full text-center space-y-3 mt-2">
                  <div className="w-3/4 mx-auto space-y-1 pt-2">
                    <div className="h-7 border-b border-black"></div>
                    <p className="text-[7px] font-black uppercase tracking-widest">Sign. Caissier: {cashierName || 'Administration'}</p>
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
            </div>
          </div>
        </div>
      )}

      {/* STYLES D'IMPRESSION OPTIMISÉS 80MM */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; background: white !important; color: black !important; margin: 0 !important; padding: 0 !important; }
          .print\\:hidden { display: none !important; }
          #adhoc-thermal-reprint-receipt { 
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
          #adhoc-thermal-reprint-receipt * { 
            visibility: visible !important; 
            color: black !important;
            border-color: black !important;
          }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { size: 80mm auto; margin: 0; }
        }
      `}</style>
    </div>
  );
};

export default AdHocCampaignsView;
